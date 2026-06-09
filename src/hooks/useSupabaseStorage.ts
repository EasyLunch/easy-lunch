import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'

/**
 * Hook de almacenamiento con localStorage como fuente de verdad absoluta.
 * Supabase se usa SOLO para backup (escritura). Nunca se lee Supabase
 * automáticamente para no pisar datos locales. La lectura desde la nube
 * se hace explícitamente con el botón "Sincronizar desde la nube".
 */
export function useSupabaseStorage<T>(key: string, initialValue: T) {
  const [value, setReactValue] = useState<T>(() => {
    try {
      const item = localStorage.getItem(key)
      return item ? JSON.parse(item) : initialValue
    } catch {
      return initialValue
    }
  })

  const valueRef = useRef(value)
  valueRef.current = value

  // Al montar: si hay datos locales, subirlos a Supabase (backup).
  // NUNCA leer desde Supabase aquí para evitar race conditions.
  useEffect(() => {
    const localItem = localStorage.getItem(key)
    if (!localItem) return
    supabase
      .from('app_data')
      .upsert({ key, value: JSON.parse(localItem), updated_at: new Date().toISOString() })
      .then(({ error }) => {
        if (error) console.error('[Supabase] Error syncing', key, error)
        else console.log('[Supabase] Synced', key)
      })
  }, [key])

  const setValue = useCallback((newValueOrFn: T | ((prev: T) => T)) => {
    const newValue =
      typeof newValueOrFn === 'function'
        ? (newValueOrFn as (p: T) => T)(valueRef.current)
        : newValueOrFn

    setReactValue(newValue)
    valueRef.current = newValue

    try {
      localStorage.setItem(key, JSON.stringify(newValue))
    } catch (e) {
      console.error('[localStorage] Error saving', key, e)
    }

    supabase
      .from('app_data')
      .upsert({ key, value: newValue, updated_at: new Date().toISOString() })
      .then(({ error }) => {
        if (error) console.error('[Supabase] Error saving', key, error)
      })
  }, [key])

  return [value, setValue] as const
}
