import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { Plato, IngredientePlato } from '../types'
import { PLATOS_INICIALES } from '../data/mockData'

function fromDbPlato(row: Record<string, unknown>, ings: Record<string, unknown>[]): Plato {
  return {
    id: row.id as string,
    nombre: row.nombre as string,
    tipo: row.tipo as Plato['tipo'],
    porciones: row.porciones as number,
    descripcion: row.descripcion as string | undefined,
    createdAt: (row.created_at as string) ?? new Date().toISOString(),
    ingredientes: ings
      .filter(i => i.plato_id === row.id)
      .map(({ plato_id: _, ...ing }) => ing as unknown as IngredientePlato),
  }
}

export function usePlatosTable(): [Plato[], (v: Plato[] | ((p: Plato[]) => Plato[])) => void, boolean] {
  const [platos, setPlatos] = useState<Plato[]>(PLATOS_INICIALES)
  const [loading, setLoading] = useState(true)
  const loadedRef = useRef(false)
  const ref = useRef<Plato[]>(platos)
  ref.current = platos

  useEffect(() => {
    Promise.all([
      supabase.from('platos').select('*').order('nombre'),
      supabase.from('plato_ingredientes').select('*'),
    ]).then(([{ data: ps, error: e1 }, { data: ings, error: e2 }]) => {
      loadedRef.current = true
      setLoading(false)
      if (e1 || e2) { console.error('[Platos] Error cargando:', e1 || e2); return }
      if (!ps || ps.length === 0) { console.warn('[Platos] Sin datos en tabla'); return }
      const mapped = ps.map(p => fromDbPlato(p as Record<string, unknown>, (ings ?? []) as Record<string, unknown>[]))
      console.log(`[Platos] Cargados ${mapped.length} platos`)
      setPlatos(mapped)
      ref.current = mapped
    })
  }, [])

  const update = useCallback((newValueOrFn: Plato[] | ((prev: Plato[]) => Plato[])) => {
    const prev = ref.current
    const next = typeof newValueOrFn === 'function' ? newValueOrFn(prev) : newValueOrFn
    setPlatos(next)
    ref.current = next
    if (!loadedRef.current) { console.warn('[Platos] No cargado, skip save'); return }

    const prevMap = new Map(prev.map(p => [p.id, p]))
    const nextMap = new Map(next.map(p => [p.id, p]))

    const toInsert = next.filter(p => !prevMap.has(p.id))
    const toDelete = prev.filter(p => !nextMap.has(p.id))
    const toUpdate = next.filter(p => {
      if (!prevMap.has(p.id)) return false
      return JSON.stringify(p) !== JSON.stringify(prevMap.get(p.id))
    })

    const saveRow = async (plato: Plato) => {
      const { ingredientes, foto: _foto, createdAt: _c, ...row } = plato
      const { error: e1 } = await supabase.from('platos').upsert({ ...row })
      if (e1) { console.error('[Platos] Error upsert:', e1); return }
      await supabase.from('plato_ingredientes').delete().eq('plato_id', plato.id)
      if (ingredientes.length > 0) {
        const { error: e2 } = await supabase.from('plato_ingredientes').insert(
          ingredientes.map(ing => ({ ...ing, plato_id: plato.id }))
        )
        if (e2) console.error('[Platos] Error ingredientes:', e2)
      }
    }

    const ops = [
      ...toInsert.map(saveRow),
      ...toUpdate.map(saveRow),
      ...toDelete.map(p => supabase.from('platos').delete().eq('id', p.id).then(({ error }) => {
        if (error) console.error('[Platos] Error eliminando:', error)
      })),
    ]

    if (ops.length > 0) {
      Promise.all(ops).then(() => {
        console.log(`[Platos] +${toInsert.length} ~${toUpdate.length} -${toDelete.length}`)
      })
    }
  }, [])

  return [platos, update, loading]
}
