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

  const valueRef    = useRef(value)
  valueRef.current  = value

  // Once the user makes any change, don't overwrite with stale Supabase data
  const hasMutated  = useRef(false)

  // On mount: fetch from Supabase (source of truth), but only apply if user
  // hasn't already made changes (avoids race condition overwriting new data)
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
          if (!hasMutated.current) {
            // No user changes yet → safe to apply Supabase data
            const v = data.value as T
            localStorage.setItem(key, JSON.stringify(v))
            setReactValue(v)
            valueRef.current = v
          }
          // If user already mutated → Supabase will be updated by their save, ignore old fetch
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
    // Mark as mutated so the Supabase initial fetch won't overwrite this
    hasMutated.current = true

    const newValue =
      typeof newValueOrFn === 'function'
        ? (newValueOrFn as (p: T) => T)(valueRef.current)
        : newValueOrFn

    setReactValue(newValue)
    valueRef.current = newValue

    // Save to localStorage immediately
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
