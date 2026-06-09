import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'

const APP_KEYS = ['el_platos', 'el_insumos', 'el_subrecetas', 'el_clientes', 'el_historial_clientes', 'el_xl_porcentaje', 'el_pedidos', 'el_historial']

function freeStorage(storage: Storage, exceptKey: string) {
  for (const k of APP_KEYS) {
    if (k !== exceptKey) {
      try { storage.removeItem(k) } catch {}
    }
  }
}

function safeSet(storage: Storage, key: string, value: string, label: string): boolean {
  try {
    storage.setItem(key, value)
    return true
  } catch {
    // Liberar espacio y reintentar
    try {
      storage.removeItem(key)
      freeStorage(storage, key)
      storage.setItem(key, value)
      console.warn(`[Storage] Saved ${key} to ${label} after freeing space`)
      return true
    } catch (e) {
      console.error(`[Storage] ${label} definitively full for ${key}:`, e)
      return false
    }
  }
}

export function useSupabaseStorage<T>(key: string, initialValue: T) {
  const [value, setReactValue] = useState<T>(() => {
    try {
      const sessionRaw = sessionStorage.getItem(key)
      const localRaw = localStorage.getItem(key)

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
            safeSet(sessionStorage, key, serialized, 'sessionStorage')
            safeSet(localStorage, key, serialized, 'localStorage')
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

    // Guardar en ambos storages (sessionStorage primero)
    const savedSession = safeSet(sessionStorage, key, serialized, 'sessionStorage')
    const savedLocal = safeSet(localStorage, key, serialized, 'localStorage')

    if (savedSession || savedLocal) {
      console.log(`[Storage] Saved ${key}${count} (session:${savedSession} local:${savedLocal})`)
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
