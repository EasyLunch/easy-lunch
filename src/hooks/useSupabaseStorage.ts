import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'

/**
 * Almacenamiento con localStorage + sessionStorage como fuentes de verdad.
 * sessionStorage es el fallback: sobrevive un refresh pero no cierre de pestaña.
 * Supabase: se carga al montar (para recuperar datos perdidos) y recibe copia en background.
 *
 * Estrategia de init:
 * 1. Lee ambos storages.
 * 2. Si existen los dos y son arrays, gana el que tenga MÁS items.
 * 3. Si localStorage falla al escribir, se borra la entrada stale para que sessionStorage tome precedencia en el próximo refresh.
 */
export function useSupabaseStorage<T>(key: string, initialValue: T) {
  const [value, setReactValue] = useState<T>(() => {
    try {
      const localRaw = localStorage.getItem(key)
      const sessionRaw = sessionStorage.getItem(key)

      if (localRaw && sessionRaw) {
        const parsedLocal = JSON.parse(localRaw) as T
        const parsedSession = JSON.parse(sessionRaw) as T
        // Para arrays, gana el que tenga más items (más reciente)
        if (
          Array.isArray(parsedLocal) &&
          Array.isArray(parsedSession) &&
          (parsedSession as unknown[]).length > (parsedLocal as unknown[]).length
        ) {
          console.warn(`[Storage] sessionStorage has more items for ${key}, using it`)
          try { localStorage.setItem(key, sessionRaw) } catch {}
          return parsedSession
        }
        console.log(`[Storage] Loaded ${key} from localStorage`)
        return parsedLocal
      }

      if (localRaw) {
        console.log(`[Storage] Loaded ${key} from localStorage`)
        return JSON.parse(localRaw) as T
      }

      if (sessionRaw) {
        const parsed = JSON.parse(sessionRaw) as T
        console.warn(`[Storage] localStorage empty for ${key}, loaded from sessionStorage`)
        try { localStorage.setItem(key, sessionRaw) } catch {}
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

  // Al montar, intentar recuperar desde Supabase si el local parece vacío
  useEffect(() => {
    const localRaw = localStorage.getItem(key)
    const sessionRaw = sessionStorage.getItem(key)
    const localCount = localRaw ? (JSON.parse(localRaw) as unknown[]).length ?? -1 : -1
    const hasLocal = localCount > 0

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
            const currentCount = Array.isArray(valueRef.current)
              ? (valueRef.current as unknown[]).length
              : -1
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

    // localStorage — si falla, borrar entrada stale para que sessionStorage tome precedencia
    try {
      localStorage.setItem(key, serialized)
      console.log(`[Storage] Saved ${key} to localStorage${count}`)
    } catch (e) {
      console.error(`[Storage] localStorage FAILED for ${key}:`, e)
      try { localStorage.removeItem(key) } catch {}
    }

    // sessionStorage como backup (sobrevive refresh)
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
