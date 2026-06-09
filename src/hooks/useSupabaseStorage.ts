import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'

/**
 * sessionStorage se escribe SIEMPRE (nunca falla silenciosamente con datos viejos).
 * localStorage puede quedar stale si setItem falla.
 * Por eso: al inicializar, sessionStorage tiene prioridad si existe.
 * Si no hay sessionStorage (tab nueva), usamos localStorage.
 * Supabase: carga al montar si no hay nada local.
 */
export function useSupabaseStorage<T>(key: string, initialValue: T) {
  const [value, setReactValue] = useState<T>(() => {
    try {
      const sessionRaw = sessionStorage.getItem(key)
      const localRaw = localStorage.getItem(key)

      // sessionStorage tiene prioridad: siempre es la version mas reciente
      if (sessionRaw) {
        const parsed = JSON.parse(sessionRaw) as T
        console.log(`[Storage] Loaded ${key} from sessionStorage (source of truth)`)
        // Sincronizar localStorage
        if (localRaw !== sessionRaw) {
          try { localStorage.setItem(key, sessionRaw) } catch {}
        }
        return parsed
      }

      // Fallback a localStorage (tab nueva, sessionStorage vacio)
      if (localRaw) {
        const parsed = JSON.parse(localRaw) as T
        console.log(`[Storage] Loaded ${key} from localStorage (new tab)`)
        try { sessionStorage.setItem(key, localRaw) } catch {}
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

  // Recuperar desde Supabase si no hay datos locales
  useEffect(() => {
    const sessionRaw = sessionStorage.getItem(key)
    const localRaw = localStorage.getItem(key)
    const hasLocal = !!(sessionRaw || localRaw)

    if (!hasLocal) {
      supabase
        .from('app_data')
        .select('value')
        .eq('key', key)
        .single()
        .then(({ data, error }) => {
          if (!error && data?.value) {
            const remote = data.value as T
            const remoteCount = Array.isArray(remote) ? (remote as unknown[]).length : -1
            const currentCount = Array.isArray(valueRef.current) ? (valueRef.current as unknown[]).length : -1
            if (remoteCount > currentCount) {
              console.warn(`[Storage] Recovered ${key} from Supabase (${remoteCount} items)`)
              setReactValue(remote)
              valueRef.current = remote
              const serialized = JSON.stringify(remote)
              try { localStorage.setItem(key, serialized) } catch {}
              try { sessionStorage.setItem(key, serialized) } catch {}
            }
          }
        })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  const setValue = useCallback((newValueOrFn: T | ((prev: T) => T)) => {
    const newValue =
      typeof newValueOrFn === 'function'
        ? (newValueOrFn as (p: T) => T)(valueRef.current)
        : newValueOrFn

    setReactValue(newValue)
    valueRef.current = newValue

    const serialized = JSON.stringify(newValue)
    const count = Array.isArray(newValue) ? ` (${(newValue as unknown[]).length} items)` : ''

    // sessionStorage PRIMERO — nunca falla con datos stale
    try {
      sessionStorage.setItem(key, serialized)
    } catch {}

    // localStorage
    try {
      localStorage.setItem(key, serialized)
      console.log(`[Storage] Saved ${key} to localStorage${count}`)
    } catch (e) {
      console.error(`[Storage] localStorage FAILED for ${key}:`, e)
      try { localStorage.removeItem(key) } catch {}
    }

    // Supabase (background)
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
