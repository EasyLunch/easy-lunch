import { useState, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'

/**
 * Almacenamiento con localStorage + sessionStorage como fuentes de verdad.
 * sessionStorage es el fallback: sobrevive un refresh pero no cierre de pestaña.
 * Supabase recibe una copia en background (solo escritura, nunca pisa lo local).
 */
export function useSupabaseStorage<T>(key: string, initialValue: T) {
  const [value, setReactValue] = useState<T>(() => {
    try {
      const local = localStorage.getItem(key)
      if (local) {
        const parsed = JSON.parse(local) as T
        console.log(`[Storage] Loaded ${key} from localStorage`)
        return parsed
      }
      const session = sessionStorage.getItem(key)
      if (session) {
        const parsed = JSON.parse(session) as T
        console.warn(`[Storage] localStorage empty for ${key}, loaded from sessionStorage`)
        // Restaurar en localStorage
        try { localStorage.setItem(key, session) } catch {}
        return parsed
      }
      console.warn(`[Storage] No local data for ${key}, using initial value`)
      return initialValue
    } catch (e) {
      console.error(`[Storage] Parse error for ${key}:`, e)
      return initialValue
    }
  })

  const valueRef = useRef(value)
  valueRef.current = value

  const setValue = useCallback((newValueOrFn: T | ((prev: T) => T)) => {
    const newValue =
      typeof newValueOrFn === 'function'
        ? (newValueOrFn as (p: T) => T)(valueRef.current)
        : newValueOrFn

    setReactValue(newValue)
    valueRef.current = newValue

    const serialized = JSON.stringify(newValue)
    const count = Array.isArray(newValue) ? ` (${(newValue as unknown[]).length} items)` : ''

    // localStorage
    try {
      localStorage.setItem(key, serialized)
      console.log(`[Storage] Saved ${key} to localStorage${count}`)
    } catch (e) {
      console.error(`[Storage] localStorage FAILED for ${key}:`, e)
    }

    // sessionStorage como backup
    try {
      sessionStorage.setItem(key, serialized)
    } catch {}

    // Supabase (background, nunca pisa local)
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
