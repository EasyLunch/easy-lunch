import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'

const APP_KEYS = ['el_platos', 'el_insumos', 'el_subrecetas', 'el_clientes', 'el_historial_clientes', 'el_xl_porcentaje']

function freeLocalStorage(exceptKey: string) {
  // Liberar espacio borrando versiones stale de otras claves
  for (const k of APP_KEYS) {
    if (k !== exceptKey) {
      try { localStorage.removeItem(k) } catch {}
    }
  }
}

export function useSupabaseStorage<T>(key: string, initialValue: T) {
  const [value, setReactValue] = useState<T>(() => {
    try {
      const sessionRaw = sessionStorage.getItem(key)
      const localRaw = localStorage.getItem(key)

      // sessionStorage tiene prioridad: es la version mas reciente
      if (sessionRaw) {
        const parsed = JSON.parse(sessionRaw) as T
        console.log(`[Storage] Loaded ${key} from sessionStorage (source of truth)`)
        if (localRaw !== sessionRaw) {
          try { localStorage.setItem(key, sessionRaw) } catch {}
        }
        return parsed
      }

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

  // Al montar: recuperar desde Supabase si tiene mas items que local
  useEffect(() => {
    supabase
      .from('app_data')
      .select('value')
      .eq('key', key)
      .single()
      .then(({ data, error }) => {
        if (!error && data?.value) {
          const remote = data.value as T
          const remoteCount = Array.isArray(remote) ? (remote as unknown[]).length : -1
          if (remoteCount <= 0) return
          const currentCount = Array.isArray(valueRef.current)
            ? (valueRef.current as unknown[]).length
            : -1
          if (remoteCount > currentCount) {
            console.warn(`[Storage] Supabase has more items for ${key} (${remoteCount} vs ${currentCount}), recovering`)
            setReactValue(remote)
            valueRef.current = remote
            const serialized = JSON.stringify(remote)
            try { sessionStorage.setItem(key, serialized) } catch (e) {
              console.error(`[Storage] sessionStorage FAILED for ${key}:`, e)
            }
            try { localStorage.setItem(key, serialized) } catch {}
          }
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

    const serialized = JSON.stringify(newValue)
    const count = Array.isArray(newValue) ? ` (${(newValue as unknown[]).length} items)` : ''

    // sessionStorage PRIMERO (nunca stale)
    try {
      sessionStorage.setItem(key, serialized)
    } catch (e) {
      console.error(`[Storage] sessionStorage FAILED for ${key}:`, e)
    }

    // localStorage
    try {
      localStorage.setItem(key, serialized)
      console.log(`[Storage] Saved ${key} to localStorage${count}`)
    } catch (e) {
      console.error(`[Storage] localStorage FAILED for ${key}:`, e)
      // Liberar espacio y reintentar
      try {
        localStorage.removeItem(key)
        freeLocalStorage(key)
        localStorage.setItem(key, serialized)
        console.warn(`[Storage] Saved ${key} to localStorage after freeing space${count}`)
      } catch {
        console.error(`[Storage] localStorage definitively full for ${key}, relying on sessionStorage`)
      }
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
