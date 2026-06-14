import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { Insumo } from '../types'
import { INSUMOS_INICIALES } from '../data/mockData'

function fromDb(row: Record<string, unknown>): Insumo {
  return {
    ...(row as Omit<Insumo, 'createdAt' | 'updatedAt'>),
    createdAt: (row.created_at as string) ?? new Date().toISOString(),
    updatedAt: (row.updated_at as string) ?? new Date().toISOString(),
  } as Insumo
}

function toDb(item: Insumo) {
  const { createdAt: _c, updatedAt: _u, ...rest } = item
  return { ...rest, updated_at: new Date().toISOString() }
}

export function useInsumosTable(): [Insumo[], (v: Insumo[] | ((p: Insumo[]) => Insumo[])) => void, boolean] {
  const [insumos, setInsumos] = useState<Insumo[]>(INSUMOS_INICIALES)
  const [loading, setLoading] = useState(true)
  const loadedRef = useRef(false)
  const ref = useRef<Insumo[]>(insumos)
  ref.current = insumos

  useEffect(() => {
    supabase.from('insumos').select('*').order('nombre').then(({ data, error }) => {
      loadedRef.current = true
      setLoading(false)
      if (error) { console.error('[Insumos] Error cargando:', error); return }
      if (!data || data.length === 0) { console.warn('[Insumos] Sin datos en tabla'); return }
      const mapped = data.map(fromDb)
      console.log(`[Insumos] Cargados ${mapped.length} insumos`)
      setInsumos(mapped)
      ref.current = mapped
    })
  }, [])

  const update = useCallback((newValueOrFn: Insumo[] | ((prev: Insumo[]) => Insumo[])) => {
    const prev = ref.current
    const next = typeof newValueOrFn === 'function' ? newValueOrFn(prev) : newValueOrFn
    setInsumos(next)
    ref.current = next
    if (!loadedRef.current) { console.warn('[Insumos] No cargado, skip save'); return }

    const prevMap = new Map(prev.map(i => [i.id, i]))
    const nextMap = new Map(next.map(i => [i.id, i]))

    const toInsert = next.filter(i => !prevMap.has(i.id))
    const toDelete = prev.filter(i => !nextMap.has(i.id))
    const toUpdate = next.filter(i => {
      if (!prevMap.has(i.id)) return false
      return JSON.stringify(i) !== JSON.stringify(prevMap.get(i.id))
    })

    const ops = [
      ...toInsert.map(i => supabase.from('insumos').insert(toDb(i)).then(({ error }) => {
        if (error) console.error('[Insumos] Error insertando:', error)
      })),
      ...toUpdate.map(i => supabase.from('insumos').update(toDb(i)).eq('id', i.id).then(({ error }) => {
        if (error) console.error('[Insumos] Error actualizando:', error)
      })),
      ...toDelete.map(i => supabase.from('insumos').delete().eq('id', i.id).then(({ error }) => {
        if (error) console.error('[Insumos] Error eliminando:', error)
      })),
    ]

    if (ops.length > 0) {
      Promise.all(ops).then(() => {
        console.log(`[Insumos] +${toInsert.length} ~${toUpdate.length} -${toDelete.length}`)
      })
    }
  }, [])

  return [insumos, update, loading]
}
