import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { Cliente } from '../types'

function fromDb(row: Record<string, unknown>): Cliente {
  return {
    ...(row as Omit<Cliente, 'createdAt' | 'updatedAt'>),
    createdAt: (row.created_at as string) ?? new Date().toISOString(),
    updatedAt: (row.updated_at as string) ?? new Date().toISOString(),
  } as Cliente
}

function toDb(item: Cliente) {
  const { createdAt: _c, updatedAt: _u, ...rest } = item
  return { ...rest, updated_at: new Date().toISOString() }
}

export function useClientesTable(): [Cliente[], (v: Cliente[] | ((p: Cliente[]) => Cliente[])) => void, boolean] {
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [loading, setLoading] = useState(true)
  const loadedRef = useRef(false)
  const ref = useRef<Cliente[]>(clientes)
  ref.current = clientes

  useEffect(() => {
    supabase.from('clientes').select('*').order('nombre').then(({ data, error }) => {
      loadedRef.current = true
      setLoading(false)
      if (error) { console.error('[Clientes] Error cargando:', error); return }
      const mapped = (data ?? []).map(fromDb)
      console.log(`[Clientes] Cargados ${mapped.length}`)
      setClientes(mapped)
      ref.current = mapped
    })
  }, [])

  const update = useCallback((newValueOrFn: Cliente[] | ((prev: Cliente[]) => Cliente[])) => {
    const prev = ref.current
    const next = typeof newValueOrFn === 'function' ? newValueOrFn(prev) : newValueOrFn
    setClientes(next)
    ref.current = next
    if (!loadedRef.current) return

    const prevMap = new Map(prev.map(c => [c.id, c]))
    const nextMap = new Map(next.map(c => [c.id, c]))

    const toInsert = next.filter(c => !prevMap.has(c.id))
    const toDelete = prev.filter(c => !nextMap.has(c.id))
    const toUpdate = next.filter(c => {
      if (!prevMap.has(c.id)) return false
      return JSON.stringify(c) !== JSON.stringify(prevMap.get(c.id))
    })

    const ops = [
      ...toInsert.map(c => supabase.from('clientes').insert(toDb(c)).then(({ error }) => {
        if (error) console.error('[Clientes] Error insertando:', error)
      })),
      ...toUpdate.map(c => supabase.from('clientes').update(toDb(c)).eq('id', c.id).then(({ error }) => {
        if (error) console.error('[Clientes] Error actualizando:', error)
      })),
      ...toDelete.map(c => supabase.from('clientes').delete().eq('id', c.id).then(({ error }) => {
        if (error) console.error('[Clientes] Error eliminando:', error)
      })),
    ]

    if (ops.length > 0) {
      Promise.all(ops).then(() => {
        console.log(`[Clientes] +${toInsert.length} ~${toUpdate.length} -${toDelete.length}`)
      })
    }
  }, [])

  return [clientes, update, loading]
}
