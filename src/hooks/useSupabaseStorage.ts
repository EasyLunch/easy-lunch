import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'

/**
 * Hook seguro: NO guarda en Supabase hasta que el load inicial haya completado.
 * Esto previene que el initialValue del codigo sobreescriba datos reales.
 */
export function useSupabaseStorage<T>(key: string, initialValue: T) {
  const supabaseLoaded = useRef(false)

  const [value, setReactValue] = useState<T>(() => {
    try {
      const raw = sessionStorage.getItem(key)
      if (raw) return JSON.parse(raw) as T
    } catch {}
    return initialValue
  })

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
        if (error) {
          console.error(`[Supabase] Error loading ${key}:`, error)
          return
        }
        if (data?.value != null) {
          const remote = data.value as T
          const count = Array.isArray(remote) ? ` (${(remote as unknown[]).length} items)` : ''
          console.log(`[Supabase] Loaded ${key}${count}`)
          setReactValue(remote)
          valueRef.current = remote
          try { sessionStorage.setItem(key, JSON.stringify(remote)) } catch {}
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

    const count = Array.isArray(newValue) ? ` (${(newValue as unknown[]).length} items)` : ''

    try { sessionStorage.setItem(key, JSON.stringify(newValue)) } catch {}

    // Solo guardar en Supabase si el load inicial ya completó
    if (!supabaseLoaded.current) {
      console.warn(`[Storage] Skipping Supabase save for ${key} - not loaded yet`)
      return
    }

    supabase
      .from('app_data')
      .upsert({ key, value: newValue, updated_at: new Date().toISOString() })
      .then(({ error }) => {
        if (error) console.error(`[Supabase] Error saving ${key}:`, error)
        else console.log(`[Supabase] Saved ${key}${count}`)
      })
  }, [key])

  return [value, setValue] as const
}
