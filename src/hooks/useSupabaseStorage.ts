import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export function useSupabaseStorage<T>(key: string, initialValue: T) {
  const [value, setReactValue] = useState<T>(() => {
    try {
      const item = localStorage.getItem(key)
      return item ? JSON.parse(item) : initialValue
    } catch {
      return initialValue
    }
  })

  const valueRef        = useRef(value)
  valueRef.current      = value

  // Once Supabase initial load is done, never overwrite again this session
  const supabaseLoaded  = useRef(false)

  useEffect(() => {
    const localItem = localStorage.getItem(key)

    if (!localItem) {
      // No local data → pull from Supabase (new computer scenario)
      supabase
        .from('app_data')
        .select('value')
        .eq('key', key)
        .maybeSingle()
        .then(({ data, error }) => {
          if (error) { console.error('[Supabase] Error loading', key, error); return }
          if (data?.value !== undefined) {
            const v = data.value as T
            localStorage.setItem(key, JSON.stringify(v))
            setReactValue(v)
            valueRef.current = v
          }
          supabaseLoaded.current = true
        })
    } else {
      // Local data exists → migrate to Supabase if needed, then mark loaded
      supabase
        .from('app_data')
        .select('key')
        .eq('key', key)
        .maybeSingle()
        .then(({ data }) => {
          if (!data) {
            const localValue = JSON.parse(localItem) as T
            supabase
              .from('app_data')
              .insert({ key, value: localValue, updated_at: new Date().toISOString() })
              .then(({ error: e }) => {
                if (e) console.error('[Supabase] Error migrating', key, e)
                else console.log('[Supabase] Migrated', key)
              })
          }
          supabaseLoaded.current = true
        })
    }
  }, [key])

  const setValue = useCallback((newValueOrFn: T | ((prev: T) => T)) => {
    const newValue =
      typeof newValueOrFn === 'function'
        ? (newValueOrFn as (p: T) => T)(valueRef.current)
        : newValueOrFn

    setReactValue(newValue)
    valueRef.current = newValue

    try {
      localStorage.setItem(key, JSON.stringify(newValue))
    } catch (e) {
      console.error('[localStorage] Error saving', key, e)
    }

    supabase
      .from('app_data')
      .upsert({ key, value: newValue, updated_at: new Date().toISOString() })
      .then(({ error }) => {
        if (error) console.error('[Supabase] Error saving', key, error)
      })
  }, [key])

  return [value, setValue] as const
}
