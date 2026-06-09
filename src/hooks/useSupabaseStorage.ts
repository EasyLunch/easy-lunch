import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'

/**
 * Supabase es la fuente de verdad principal.
 * Al montar: carga desde Supabase.
 * Al guardar: guarda en Supabase + estado React (in-memory).
 * sessionStorage: solo se usa como cache rapido para evitar flash de pantalla vacia.
 */
export function useSupabaseStorage<T>(key: string, initialValue: T) {
  // Carga inicial desde sessionStorage para evitar pantalla vacia
  const [value, setReactValue] = useState<T>(() => {
    try {
      const raw = sessionStorage.getItem(key)
      if (raw) {
        console.log(`[Storage] Quick-load ${key} from sessionStorage`)
        return JSON.parse(raw) as T
      }
    } catch {}
    return initialValue
  })

  const valueRef = useRef(value)
  valueRef.current = value

  // Al montar: Supabase es la fuente de verdad
  useEffect(() => {
    supabase
      .from('app_data')
      .select('value')
      .eq('key', key)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) {
          console.error(`[Supabase] Error loading ${key}:`, error)
          return
        }
        if (data?.value != null) {
          const remote = data.value as T
          const remoteCount = Array.isArray(remote) ? (remote as unknown[]).length : -1
          const localCount = Array.isArray(valueRef.current) ? (valueRef.current as unknown[]).length : -1
          console.log(`[Supabase] Loaded ${key} (${remoteCount >= 0 ? remoteCount + ' items' : 'ok'})`)
          setReactValue(remote)
          valueRef.current = remote
          // Actualizar sessionStorage cache
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

    // Actualizar estado React inmediatamente (UI responsiva)
    setReactValue(newValue)
    valueRef.current = newValue

    const count = Array.isArray(newValue) ? ` (${(newValue as unknown[]).length} items)` : ''

    // Cache en sessionStorage (best-effort)
    try { sessionStorage.setItem(key, JSON.stringify(newValue)) } catch {}

    // Guardar en Supabase (fuente de verdad)
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
