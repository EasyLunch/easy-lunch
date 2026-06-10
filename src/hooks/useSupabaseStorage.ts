import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export function useSupabaseStorage<T>(key: string, initialValue: T) {
  const supabaseLoaded = useRef(false)
  const [value, setReactValue] = useState<T>(initialValue)
  const [loading, setLoading] = useState(true)
  const valueRef = useRef(value)
  valueRef.current = value

  useEffect(() => {
    supabase
      .from('app_data')
      .select('value')
      .eq('key', key)
      .maybeSingle()
      .then(({ data, error }) => {
        supabaseLoaded.current = true
        setLoading(false)
        if (error) {
          console.error(`[Supabase] Error loading ${key}:`, error)
          return
        }
        if (data?.value != null) {
          const remote = data.value as T
          console.log(`[Supabase] Loaded ${key} (${Array.isArray(remote) ? (remote as unknown[]).length + ' items' : 'ok'})`)
          setReactValue(remote)
          valueRef.current = remote
        } else {
          console.warn(`[Supabase] No data for ${key}`)
        }
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  const setValue = useCallback((newValueOrFn: T | ((prev: T) => T)) => {
    const newValue =
      typeof newValueOrFn === 'function'
        ? (newValueOrFn as (p: T) => T)(valueRef.current)
        : newValueOrFn

    setReactValue(newValue)
    valueRef.current = newValue

    if (!supabaseLoaded.current) {
      console.warn(`[Storage] Skipping Supabase save for ${key} - not loaded yet`)
      return
    }

    supabase
      .from('app_data')
      .upsert({ key, value: newValue, updated_at: new Date().toISOString() })
      .then(({ error }) => {
        if (error) console.error(`[Supabase] Error saving ${key}:`, error)
        else console.log(`[Supabase] Saved ${key}`)
      })
  }, [key])

  return [value, setValue, loading] as const
}
