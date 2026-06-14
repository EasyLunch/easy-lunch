import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { SubReceta, IngredienteSubReceta } from '../types'
import { SUBRECETAS_INICIALES } from '../data/mockData'

function fromDbSr(row: Record<string, unknown>, ings: Record<string, unknown>[]): SubReceta {
  return {
    id: row.id as string,
    nombre: row.nombre as string,
    familia: row.familia as SubReceta['familia'],
    rendimiento: row.rendimiento as number,
    unidad_rendimiento: row.unidad_rendimiento as string,
    gramaje_unidad: row.gramaje_unidad as number | undefined,
    descripcion: row.descripcion as string | undefined,
    createdAt: (row.created_at as string) ?? new Date().toISOString(),
    ingredientes: ings
      .filter(i => i.subreceta_id === row.id)
      .map(({ subreceta_id: _, ...ing }) => ing as unknown as IngredienteSubReceta),
  }
}

export function useSubrecetasTable(): [SubReceta[], (v: SubReceta[] | ((p: SubReceta[]) => SubReceta[])) => void, boolean] {
  const [subrecetas, setSubrecetas] = useState<SubReceta[]>(SUBRECETAS_INICIALES)
  const [loading, setLoading] = useState(true)
  const loadedRef = useRef(false)
  const ref = useRef<SubReceta[]>(subrecetas)
  ref.current = subrecetas

  useEffect(() => {
    Promise.all([
      supabase.from('subrecetas').select('*').order('nombre'),
      supabase.from('subreceta_ingredientes').select('*'),
    ]).then(([{ data: srs, error: e1 }, { data: ings, error: e2 }]) => {
      loadedRef.current = true
      setLoading(false)
      if (e1 || e2) { console.error('[SubRecetas] Error cargando:', e1 || e2); return }
      if (!srs || srs.length === 0) { console.warn('[SubRecetas] Sin datos en tabla'); return }
      const mapped = srs.map(sr => fromDbSr(sr as Record<string, unknown>, (ings ?? []) as Record<string, unknown>[]))
      console.log(`[SubRecetas] Cargadas ${mapped.length} sub-recetas`)
      setSubrecetas(mapped)
      ref.current = mapped
    })
  }, [])

  const update = useCallback((newValueOrFn: SubReceta[] | ((prev: SubReceta[]) => SubReceta[])) => {
    const prev = ref.current
    const next = typeof newValueOrFn === 'function' ? newValueOrFn(prev) : newValueOrFn
    setSubrecetas(next)
    ref.current = next
    if (!loadedRef.current) { console.warn('[SubRecetas] No cargado, skip save'); return }

    const prevMap = new Map(prev.map(s => [s.id, s]))
    const nextMap = new Map(next.map(s => [s.id, s]))

    const toInsert = next.filter(s => !prevMap.has(s.id))
    const toDelete = prev.filter(s => !nextMap.has(s.id))
    const toUpdate = next.filter(s => {
      if (!prevMap.has(s.id)) return false
      return JSON.stringify(s) !== JSON.stringify(prevMap.get(s.id))
    })

    const saveRow = async (sr: SubReceta) => {
      const { ingredientes, createdAt: _c, ...row } = sr
      const { error: e1 } = await supabase.from('subrecetas').upsert({ ...row })
      if (e1) { console.error('[SubRecetas] Error upsert:', e1); return }
      await supabase.from('subreceta_ingredientes').delete().eq('subreceta_id', sr.id)
      if (ingredientes.length > 0) {
        const { error: e2 } = await supabase.from('subreceta_ingredientes').insert(
          ingredientes.map(ing => ({ ...ing, subreceta_id: sr.id }))
        )
        if (e2) console.error('[SubRecetas] Error ingredientes:', e2)
      }
    }

    const ops = [
      ...toInsert.map(saveRow),
      ...toUpdate.map(saveRow),
      ...toDelete.map(s => supabase.from('subrecetas').delete().eq('id', s.id).then(({ error }) => {
        if (error) console.error('[SubRecetas] Error eliminando:', error)
      })),
    ]

    if (ops.length > 0) {
      Promise.all(ops).then(() => {
        console.log(`[SubRecetas] +${toInsert.length} ~${toUpdate.length} -${toDelete.length}`)
      })
    }
  }, [])

  return [subrecetas, update, loading]
}
