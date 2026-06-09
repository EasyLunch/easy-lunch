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

  const valueRef = useRef(value)
  valueRef.current = value

  useEffect(() => {
    const localItem = localStorage.getItem(key)

    if (localItem) {
      // Tenemos datos locales → son la fuente de verdad, sincronizar a Supabase
      const localValue = JSON.parse(localItem) as T
      supabase
        .from('app_data')
        .upsert({ key, value: localValue, updated_at: new Date().toISOString() })
        .then(({ error }) => {
          if (error) console.error('[Supabase] Error syncing', key, error)
          else console.log('[Supabase] Synced', key)
        })
    } else {
      // Sin datos locales (computadora nueva) → cargar desde Supabase
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
            console.log('[Supabase] Loaded from cloud', key)
          }
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
