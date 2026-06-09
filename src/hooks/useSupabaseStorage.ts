import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export function useSupabaseStorage<T>(key: string, initialValue: T) {
  // Load from localStorage first for instant render
  const [value, setReactValue] = useState<T>(() => {
    try {
      const item = localStorage.getItem(key)
      return item ? JSON.parse(item) : initialValue
    } catch {
      return initialValue
    }
  })

  // Keep a ref so setValue always uses latest value (avoids stale closures)
  const valueRef = useRef(value)
  valueRef.current = value

  // On mount: fetch from Supabase (source of truth)
  useEffect(() => {
    supabase
      .from('app_data')
      .select('value')
      .eq('key', key)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) {
          console.error('[Supabase] Error loading', key, error)
          return
        }
        if (data?.value !== undefined) {
          // Supabase has data → use it as source of truth
          const v = data.value as T
          localStorage.setItem(key, JSON.stringify(v))
          setReactValue(v)
          valueRef.current = v
        } else {
          // Supabase empty → migrate localStorage data to Supabase
          const localItem = localStorage.getItem(key)
          if (localItem) {
            const localValue = JSON.parse(localItem) as T
            supabase
              .from('app_data')
              .insert({ key, value: localValue, updated_at: new Date().toISOString() })
              .then(({ error: e }) => {
                if (e) console.error('[Supabase] Error migrating', key, e)
                else console.log('[Supabase] Migrated', key)
              })
          }
        }
      })
  }, [key])

  const setValue = useCallback((newValueOrFn: T | ((prev: T) => T)) => {
    const newValue =
      typeof newValueOrFn === 'function'
        ? (newValueOrFn as (p: T) => T)(valueRef.current)
        : newValueOrFn

    // Update React state immediately
    setReactValue(newValue)
    valueRef.current = newValue

    // Save to localStorage immediately (fast fallback)
    try {
      localStorage.setItem(key, JSON.stringify(newValue))
    } catch (e) {
      console.error('[localStorage] Error saving', key, e)
    }

    // Save to Supabase in background
    supabase
      .from('app_data')
      .upsert({ key, value: newValue, updated_at: new Date().toISOString() })
      .then(({ error }) => {
        if (error) console.error('[Supabase] Error saving', key, error)
      })
  }, [key])

  return [value, setValue] as const
}
