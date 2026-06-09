import { useState, useMemo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts'
import {
  TrendingUp, UtensilsCrossed, ShoppingCart, DollarSign,
  AlertTriangle, TrendingDown,
} from 'lucide-react'
import { useData } from '../context/DataContext'
import {
  Insumo, Plato, PedidoSemanal, HistorialPrecio, Cliente,
  CATEGORIAS_INSUMO, TIPOS_PLATO, SubReceta,
} from '../types'
import { yieldFactor, toGramos } from '../utils/costos'

// ─── Constantes ───────────────────────────────────────────────────────────────

const DIAS_SEMANA = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

const PIE_COLORS: Record<string, string> = {
  verduras:     '#86efac',
  carnes:       '#fca5a5',
  lacteos:      '#fde68a',
  harinas:      '#fcd34d',
  aderezos:     '#fdba74',
  condimentos:  '#c4b5fd',
  descartables: '#d1d5db',
  otros:        '#94a3b8',
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function matchCliente(empresa: string, clientes: Cliente[]): Cliente | undefined {
  const e = empresa.toLowerCase().trim()
  return (
    clientes.find(c => c.nombre.toLowerCase() === e) ||
    clientes.find(c => e.includes(c.nombre.toLowerCase())) ||
    clientes.find(c => c.nombre.toLowerCase().includes(e))
  )
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, icon: Icon, lima }: {
  label: string; value: string; sub?: string
  icon: React.FC<{ className?: string }>; lima?: boolean
}) {
  return (
    <div className="card p-5 flex items-center gap-4">
      <div
        className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: lima ? '#D2EA8E' : '#F1F5F9', color: '#2C3B4B' }}
      >
        <Icon className="w-5 h-5" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-gray-500 font-medium">{label}</p>
        <p className="text-xl font-bold text-gray-900 truncate">{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const { insumos, platos, subrecetas, pedidos, historial, clientes } = useData()

  const [filtroSemana,     setFiltroSemana]     = useState<string>('todas')
  const [filtroEmpresa,    setFiltroEmpresa]    = useState<string>('todas')
  const [filtroTipoPlato,  setFiltroTipoPlato]  = useState<string>('todos')

  // ── 1. Pedidos filtrados por semana ──────────────────────────────────────
  const pedidosFiltrados = useMemo(() => {
    if (filtroSemana === 'todas') return pedidos
    return pedidos.filter(p => p.id === filtroSemana)
  }, [pedidos, filtroSemana])

  // ── 2. Empresas disponibles en los pedidos filtrados ─────────────────────
  const empresasDisponibles = useMemo(() => {
    const set = new Set<string>()
    pedidosFiltrados.forEach(p => (p.rows ?? []).forEach(r => set.add(r.empresa)))
    return [...set].sort()
  }, [pedidosFiltrados])

  // ── 3. Rows filtradas por empresa ────────────────────────────────────────
  const rowsFiltradas = useMemo(() => {
    const rows = pedidosFiltrados.flatMap(p => p.rows ?? [])
    if (filtroEmpresa === 'todas') return rows
    return rows.filter(r => r.empresa === filtroEmpresa)
  }, [pedidosFiltrados, filtroEmpresa])

  // ── 4. KPIs ──────────────────────────────────────────────────────────────
  const totalViandas = rowsFiltradas.length

  const revenue = useMemo(() =>
    rowsFiltradas.reduce((sum, r) => {
      const c = matchCliente(r.empresa, clientes)
      if (!c) return sum
      const precio = r.es_xl
        ? (c.precio_vianda_xl ?? c.precio_vianda)
        : c.precio_vianda
      return sum + precio
    }, 0),
  [rowsFiltradas, clientes])

  const costoTotal = useMemo(() => {
    const totalCosto = pedidosFiltrados.reduce((sum, p) =>
      sum + p.lista_compras.reduce((s, i) => s + i.costo_estimado, 0), 0)
    if (filtroEmpresa === 'todas') return totalCosto
    const totalRows = pedidosFiltrados.flatMap(p => p.rows ?? []).length
    if (totalRows === 0) return 0
    return totalCosto * (rowsFiltradas.length / totalRows)
  }, [pedidosFiltrados, filtroEmpresa, rowsFiltradas])

  const margen    = revenue - costoTotal
  const margenPct = revenue > 0 ? (margen / revenue * 100) : 0

  // ── 4b. Costo promedio por tipo de plato ─────────────────────────────────
  const UNIDADES_PESO_SET = new Set(['g', 'kg', 'ml', 'lt'])

  const costoPorTipoPlato = useMemo(() => {
    // Calcular costo unitario de cada plato
    const costoPlato = (plato: Plato): number => {
      let total = 0
      for (const ing of plato.ingredientes) {
        if (ing.tipo === 'insumo') {
          const ins = insumos.find(i => i.id === ing.ref_id)
          if (!ins) continue
          const esPeso = UNIDADES_PESO_SET.has(ing.unidad)
          const yf = yieldFactor(ins.merma_crudo, ins.variacion_coccion)
          const precioReal = yf > 0 ? ins.precio / yf : ins.precio
          if (esPeso) {
            const cantKg = toGramos(ing.cantidad, ing.unidad) / 1000
            total += cantKg * precioReal
          } else {
            total += ing.cantidad * ins.precio
          }
        } else {
          const sr = subrecetas.find(s => s.id === ing.ref_id)
          if (!sr || sr.rendimiento === 0) continue
          let costoSr = 0
          for (const sri of sr.ingredientes) {
            const ins = insumos.find(i => i.id === sri.insumo_id)
            if (!ins) continue
            const yf = yieldFactor(ins.merma_crudo, ins.variacion_coccion)
            const precioReal = yf > 0 ? ins.precio / yf : ins.precio
            const esPeso = UNIDADES_PESO_SET.has(sri.unidad)
            if (esPeso) {
              const cantKg = toGramos(sri.cantidad, sri.unidad) / 1000
              costoSr += cantKg * precioReal
            } else {
              costoSr += sri.cantidad * ins.precio
            }
          }
          const rendG = toGramos(sr.rendimiento, sr.unidad_rendimiento)
          const cantG = toGramos(ing.cantidad, ing.unidad)
          const ratio = rendG > 0 ? cantG / rendG : 0
          total += ratio * costoSr
        }
      }
      return total
    }

    // Filtrar rows por tipo de plato seleccionado
    const rowsFiltradas2 = filtroTipoPlato === 'todos'
      ? rowsFiltradas
      : rowsFiltradas.filter(r => {
          const plato = platos.find(p => p.id === r.plato_id)
          return plato?.tipo === filtroTipoPlato
        })

    if (rowsFiltradas2.length === 0) return null

    let sumasCosto = 0
    let countConReceta = 0
    for (const row of rowsFiltradas2) {
      const plato = platos.find(p => p.id === row.plato_id)
      if (!plato) continue
      sumasCosto += costoPlato(plato) / (plato.porciones || 1)
      countConReceta++
    }
    if (countConReceta === 0) return null
    return { promedio: sumasCosto / countConReceta, count: rowsFiltradas2.length }
  }, [rowsFiltradas, filtroTipoPlato, platos, insumos, subrecetas])

  // ── 5. Viandas por día de la semana ──────────────────────────────────────
  const viandasPorDia = useMemo(() => {
    const counts: Record<number, number> = {}
    rowsFiltradas.forEach(r => {
      const d = new Date(r.fecha + 'T00:00:00').getDay()
      counts[d] = (counts[d] ?? 0) + 1
    })
    return [1, 2, 3, 4, 5].map(d => ({ dia: DIAS_SEMANA[d], viandas: counts[d] ?? 0 }))
  }, [rowsFiltradas])

  // ── 6. Top platos más pedidos ─────────────────────────────────────────────
  const topPlatos = useMemo(() => {
    const counts: Record<string, { nombre: string; cantidad: number }> = {}
    rowsFiltradas.forEach(r => {
      const key    = r.plato_id ?? r.plato_excel
      const nombre = r.plato_nombre ?? r.plato_excel
      if (!counts[key]) counts[key] = { nombre, cantidad: 0 }
      counts[key].cantidad++
    })
    return Object.values(counts)
      .sort((a, b) => b.cantidad - a.cantidad)
      .slice(0, 8)
  }, [rowsFiltradas])

  // ── 7. Gasto por categoría de insumo ─────────────────────────────────────
  const gastoPorCategoria = useMemo(() => {
    const map: Record<string, number> = {}
    pedidosFiltrados.forEach(p => {
      const rowsP = p.rows ?? []
      const factor = (filtroEmpresa === 'todas' || rowsP.length === 0)
        ? 1
        : rowsP.filter(r => r.empresa === filtroEmpresa).length / rowsP.length
      p.lista_compras.forEach(item => {
        const ins = insumos.find(i => i.id === item.insumo_id)
        const cat = ins?.categoria ?? 'otros'
        map[cat] = (map[cat] ?? 0) + item.costo_estimado * factor
      })
    })
    return Object.entries(map)
      .map(([cat, costo]) => {
        const catInfo = CATEGORIAS_INSUMO.find(c => c.value === cat)
        return { cat, label: catInfo?.label ?? cat, emoji: catInfo?.emoji ?? '📦', costo: Math.round(costo) }
      })
      .filter(d => d.costo > 0)
      .sort((a, b) => b.costo - a.costo)
  }, [pedidosFiltrados, insumos, filtroEmpresa])

  // ── 8. Revenue y margen por empresa ──────────────────────────────────────
  const revenuePorCliente = useMemo(() => {
    const map: Record<string, { empresa: string; viandas: number; revenue: number; costo: number }> = {}
    rowsFiltradas.forEach(r => {
      if (!map[r.empresa]) map[r.empresa] = { empresa: r.empresa, viandas: 0, revenue: 0, costo: 0 }
      map[r.empresa].viandas++
      const c = matchCliente(r.empresa, clientes)
      const precio = c
        ? r.es_xl ? (c.precio_vianda_xl ?? c.precio_vianda) : c.precio_vianda
        : 0
      map[r.empresa].revenue += precio
    })
    // Pro-ratear costo por vianda
    pedidosFiltrados.forEach(p => {
      const totalCostoPedido = p.lista_compras.reduce((s, i) => s + i.costo_estimado, 0)
      const rowsP = p.rows ?? []
      if (rowsP.length === 0) return
      const costoPorVianda = totalCostoPedido / rowsP.length
      rowsP.forEach(r => {
        if (filtroEmpresa !== 'todas' && r.empresa !== filtroEmpresa) return
        if (map[r.empresa]) map[r.empresa].costo += costoPorVianda
      })
    })
    return Object.values(map).sort((a, b) => b.revenue - a.revenue)
  }, [rowsFiltradas, pedidosFiltrados, clientes, filtroEmpresa])

  // ── 9. Top 5 insumos por gasto ───────────────────────────────────────────
  const topInsumos = useMemo(() => {
    const map: Record<string, { nombre: string; costo: number }> = {}
    pedidosFiltrados.forEach(p => {
      const rowsP = p.rows ?? []
      const factor = (filtroEmpresa === 'todas' || rowsP.length === 0)
        ? 1
        : rowsP.filter(r => r.empresa === filtroEmpresa).length / rowsP.length
      p.lista_compras.forEach(item => {
        if (!map[item.insumo_id]) map[item.insumo_id] = { nombre: item.insumo_nombre, costo: 0 }
        map[item.insumo_id].costo += item.costo_estimado * factor
      })
    })
    return Object.values(map).sort((a, b) => b.costo - a.costo).slice(0, 5)
  }, [pedidosFiltrados, filtroEmpresa])

  // ── 10. Alertas de variación de precios ──────────────────────────────────
  const alertasPrecios = useMemo(() => {
    return insumos
      .map(ins => {
        const hist = historial.filter(h => h.insumo_id === ins.id)
          .sort((a, b) => a.fecha.localeCompare(b.fecha))
        if (hist.length < 2) return null
        const last = hist[hist.length - 1]
        const prev = hist[hist.length - 2]
        const pct  = (last.precio - prev.precio) / prev.precio * 100
        if (Math.abs(pct) < 5) return null
        return { ins, last, prev, pct }
      })
      .filter(Boolean)
      .sort((a, b) => Math.abs(b!.pct) - Math.abs(a!.pct))
      .slice(0, 6) as Array<{ ins: Insumo; last: HistorialPrecio; prev: HistorialPrecio; pct: number }>
  }, [insumos, historial])

  // ── 11. Costo semana actual vs anterior ──────────────────────────────────
  const semanaComparativa = useMemo(() => {
    const sorted = [...pedidos].sort((a, b) =>
      (b.fecha_inicio ?? b.semana).localeCompare(a.fecha_inicio ?? a.semana))
    const actual   = sorted[0]?.lista_compras.reduce((s, i) => s + i.costo_estimado, 0) ?? 0
    const anterior = sorted[1]?.lista_compras.reduce((s, i) => s + i.costo_estimado, 0) ?? 0
    const varPct   = anterior > 0 ? ((actual - anterior) / anterior * 100) : null
    return { actual, anterior, varPct, semActual: sorted[0]?.semana, semAnterior: sorted[1]?.semana }
  }, [pedidos])

  const sinDatos = pedidos.length === 0

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* Header + filtros */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">Estadísticas de tu operación</p>
        </div>

        {!sinDatos && (
          <div className="flex items-center gap-3 flex-wrap">
            <select
              className="input text-sm py-2 pr-8"
              value={filtroSemana}
              onChange={e => { setFiltroSemana(e.target.value); setFiltroEmpresa('todas') }}
            >
              <option value="todas">📅 Todas las semanas</option>
              {[...pedidos]
                .sort((a, b) => (b.fecha_inicio ?? b.semana).localeCompare(a.fecha_inicio ?? a.semana))
                .map(p => (
                  <option key={p.id} value={p.id}>
                    {p.semana}
                    {p.fecha_inicio
                      ? ` (${new Date(p.fecha_inicio + 'T00:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })})`
                      : ''}
                  </option>
                ))}
            </select>

            {empresasDisponibles.length > 0 && (
              <select
                className="input text-sm py-2 pr-8"
                value={filtroEmpresa}
                onChange={e => setFiltroEmpresa(e.target.value)}
              >
                <option value="todas">🏢 Todas las empresas</option>
                {empresasDisponibles.map(e => (
                  <option key={e} value={e}>{e}</option>
                ))}
              </select>
            )}
          </div>
        )}
      </div>

      {/* ── Sin datos ── */}
      {sinDatos ? (
        <div className="card p-20 text-center text-gray-400">
          <ShoppingCart className="w-12 h-12 mx-auto mb-4 opacity-20" />
          <p className="font-semibold text-lg">No hay pedidos guardados aún</p>
          <p className="text-sm mt-1">Cargá un Excel de planificación para ver las métricas aquí</p>
        </div>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              label="Viandas"
              value={totalViandas.toLocaleString('es-AR')}
              icon={UtensilsCrossed}
              lima
            />
            <StatCard
              label="Revenue estimado"
              value={revenue > 0 ? `$${revenue.toLocaleString('es-AR')}` : '—'}
              sub={revenue > 0 && totalViandas > 0
                ? `~$${Math.round(revenue / totalViandas).toLocaleString('es-AR')} / vianda`
                : undefined}
              icon={DollarSign}
            />
            <StatCard
              label="Costo estimado"
              value={costoTotal > 0 ? `$${Math.round(costoTotal).toLocaleString('es-AR')}` : '—'}
              sub={costoTotal > 0 && totalViandas > 0
                ? `~$${Math.round(costoTotal / totalViandas).toLocaleString('es-AR')} / vianda`
                : undefined}
              icon={ShoppingCart}
            />
            <StatCard
              label="Margen"
              value={revenue > 0 ? `${margenPct.toFixed(1)}%` : '—'}
              sub={margen > 0 ? `$${Math.round(margen).toLocaleString('es-AR')} neto` : undefined}
              icon={TrendingUp}
              lima={margenPct > 30}
            />
          </div>

          {/* Costo promedio por tipo de plato */}
          <div className="card p-5">
            <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
              <div>
                <h2 className="font-semibold text-gray-800">Costo por vianda</h2>
                <p className="text-xs text-gray-400 mt-0.5">Comparativa entre costo real del pedido y costo teórico de receta</p>
              </div>
              <select
                className="input text-sm py-2 pr-8"
                value={filtroTipoPlato}
                onChange={e => setFiltroTipoPlato(e.target.value)}
              >
                <option value="todos">Todos los tipos</option>
                {TIPOS_PLATO.map(t => (
                  <option key={t.value} value={t.value}>{t.emoji} {t.label}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-3 gap-6">
              {/* Costo real del pedido */}
              <div className="border-r border-gray-100 pr-6">
                <p className="text-xs font-medium text-gray-500 mb-1 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: '#2C3B4B' }}></span>
                  Costo real del pedido
                </p>
                <p className="text-3xl font-bold" style={{ color: '#2C3B4B' }}>
                  {totalViandas > 0
                    ? `$${Math.round(costoTotal / totalViandas).toLocaleString('es-AR')}`
                    : '—'}
                </p>
                <p className="text-xs text-gray-400 mt-1">por vianda · incluye XL y precios al momento de carga</p>
              </div>

              {/* Costo teórico de receta */}
              <div className="border-r border-gray-100 pr-6">
                <p className="text-xs font-medium text-gray-500 mb-1 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full inline-block bg-gray-300"></span>
                  Costo teórico de receta
                  {filtroTipoPlato !== 'todos' && (
                    <span className="ml-1">
                      · {TIPOS_PLATO.find(t => t.value === filtroTipoPlato)?.emoji}{' '}
                      {TIPOS_PLATO.find(t => t.value === filtroTipoPlato)?.label}
                    </span>
                  )}
                </p>
                {costoPorTipoPlato === null ? (
                  <p className="text-sm text-gray-400 mt-2">Sin datos para este tipo</p>
                ) : (
                  <>
                    <p className="text-3xl font-bold text-gray-600">
                      ${Math.round(costoPorTipoPlato.promedio).toLocaleString('es-AR')}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">por porción estándar · precios actuales · sin XL</p>
                  </>
                )}
              </div>

              {/* Precio cobrado y margen */}
              <div>
                <p className="text-xs font-medium text-gray-500 mb-1 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: '#D2EA8E' }}></span>
                  Precio cobrado promedio
                </p>
                {revenue > 0 && totalViandas > 0 ? (
                  <>
                    <p className="text-3xl font-bold text-gray-700">
                      ${Math.round(revenue / totalViandas).toLocaleString('es-AR')}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      margen real:{' '}
                      <span className={`font-semibold ${(revenue - costoTotal) > 0 ? 'text-green-600' : 'text-red-500'}`}>
                        ${Math.round((revenue - costoTotal) / totalViandas).toLocaleString('es-AR')} / vianda
                      </span>
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-gray-400 mt-2">Sin precios de clientes cargados</p>
                )}
              </div>
            </div>
          </div>

          {/* Costo vs semana anterior + Top insumos */}
          {pedidos.length >= 2 && (
            <div className="grid grid-cols-2 gap-6">
              <div className="card p-5">
                <h2 className="font-semibold text-gray-800 mb-5">Costo vs semana anterior</h2>
                <div className="flex items-end gap-6">
                  <div>
                    <p className="text-xs text-gray-400 mb-1">{semanaComparativa.semActual ?? 'Esta semana'}</p>
                    <p className="text-2xl font-bold" style={{ color: '#2C3B4B' }}>
                      ${Math.round(semanaComparativa.actual).toLocaleString('es-AR')}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 mb-1">{semanaComparativa.semAnterior ?? 'Anterior'}</p>
                    <p className="text-xl font-semibold text-gray-400">
                      ${Math.round(semanaComparativa.anterior).toLocaleString('es-AR')}
                    </p>
                  </div>
                  {semanaComparativa.varPct !== null && (
                    <div className="ml-auto text-right">
                      <p className={`text-2xl font-bold ${semanaComparativa.varPct > 0 ? 'text-red-500' : 'text-green-600'}`}>
                        {semanaComparativa.varPct > 0 ? '▲' : '▼'} {Math.abs(semanaComparativa.varPct).toFixed(1)}%
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">variación</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="card p-5">
                <h2 className="font-semibold text-gray-800 mb-4">Top 5 insumos por gasto</h2>
                {topInsumos.length === 0 ? (
                  <p className="text-sm text-gray-400">Sin datos</p>
                ) : (
                  <div className="space-y-2.5">
                    {topInsumos.map((ins, i) => {
                      const maxCosto = topInsumos[0]?.costo ?? 1
                      const pct = (ins.costo / maxCosto * 100)
                      return (
                        <div key={i} className="flex items-center gap-3">
                          <span className="text-xs text-gray-400 w-4 text-right">{i + 1}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-center mb-1">
                              <span className="text-sm font-medium text-gray-700 truncate">{ins.nombre}</span>
                              <span className="text-sm font-semibold ml-2 flex-shrink-0" style={{ color: '#2C3B4B' }}>
                                ${Math.round(ins.costo).toLocaleString('es-AR')}
                              </span>
                            </div>
                            <div className="h-1.5 bg-gray-100 rounded-full">
                              <div
                                className="h-1.5 rounded-full transition-all"
                                style={{ width: `${pct}%`, backgroundColor: '#D2EA8E' }}
                              />
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Viandas por día + Top platos */}
          <div className="grid grid-cols-2 gap-6">
            <div className="card p-5">
              <h2 className="font-semibold text-gray-800 mb-4">Viandas por día</h2>
              {rowsFiltradas.length === 0 ? (
                <div className="h-48 flex items-center justify-center text-gray-400 text-sm">Sin datos</div>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={viandasPorDia} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                    <XAxis dataKey="dia" tick={{ fontSize: 12, fill: '#6b7280' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
                      formatter={(v: number) => [v, 'Viandas']}
                    />
                    <Bar dataKey="viandas" fill="#2C3B4B" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            <div className="card p-5">
              <h2 className="font-semibold text-gray-800 mb-4">Platos más pedidos</h2>
              {topPlatos.length === 0 ? (
                <div className="h-48 flex items-center justify-center text-gray-400 text-sm">Sin datos</div>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart
                    data={topPlatos}
                    layout="vertical"
                    margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11, fill: '#6b7280' }} allowDecimals={false} />
                    <YAxis
                      dataKey="nombre"
                      type="category"
                      tick={{ fontSize: 10, fill: '#6b7280' }}
                      width={120}
                    />
                    <Tooltip
                      contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
                      formatter={(v: number) => [v, 'Pedidos']}
                    />
                    <Bar dataKey="cantidad" fill="#D2EA8E" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Gasto por categoría + Revenue por empresa */}
          <div className="grid grid-cols-2 gap-6">
            {/* Pie */}
            <div className="card p-5">
              <h2 className="font-semibold text-gray-800 mb-4">Gasto por categoría de insumo</h2>
              {gastoPorCategoria.length === 0 ? (
                <div className="h-48 flex items-center justify-center text-gray-400 text-sm">Sin datos</div>
              ) : (
                <div className="flex items-center gap-4">
                  <div style={{ width: 180, height: 200, flexShrink: 0 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={gastoPorCategoria}
                          dataKey="costo"
                          nameKey="label"
                          cx="50%"
                          cy="50%"
                          outerRadius={80}
                          innerRadius={42}
                        >
                          {gastoPorCategoria.map(entry => (
                            <Cell key={entry.cat} fill={PIE_COLORS[entry.cat] ?? '#d1d5db'} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
                          formatter={(v: number, name: string) => [`$${(v as number).toLocaleString('es-AR')}`, name]}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex-1 space-y-2 min-w-0">
                    {gastoPorCategoria.map(d => (
                      <div key={d.cat} className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <div
                            className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                            style={{ backgroundColor: PIE_COLORS[d.cat] ?? '#d1d5db' }}
                          />
                          <span className="text-xs text-gray-600 truncate">{d.emoji} {d.label}</span>
                        </div>
                        <span className="text-xs font-semibold text-gray-700 flex-shrink-0">
                          ${d.costo.toLocaleString('es-AR')}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Revenue y margen por empresa */}
            <div className="card p-5">
              <h2 className="font-semibold text-gray-800 mb-4">Revenue y margen por empresa</h2>
              {revenuePorCliente.length === 0 ? (
                <div className="h-48 flex items-center justify-center text-gray-400 text-sm">Sin datos</div>
              ) : (
                <div className="overflow-y-auto" style={{ maxHeight: 240 }}>
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="text-left pb-2.5 font-medium text-gray-500">Empresa</th>
                        <th className="text-right pb-2.5 font-medium text-gray-500">Viandas</th>
                        <th className="text-right pb-2.5 font-medium text-gray-500">Revenue</th>
                        <th className="text-right pb-2.5 font-medium text-gray-500">Margen</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {revenuePorCliente.map(r => {
                        const margenEmp    = r.revenue - r.costo
                        const margenPctEmp = r.revenue > 0 ? (margenEmp / r.revenue * 100) : null
                        const sinPrecio    = !matchCliente(r.empresa, clientes)
                        return (
                          <tr key={r.empresa} className="hover:bg-gray-50">
                            <td className="py-2.5 font-medium text-gray-700 pr-2">
                              <span className="truncate block" style={{ maxWidth: 140 }}>{r.empresa}</span>
                              {sinPrecio && (
                                <span className="text-orange-400 font-normal" style={{ fontSize: 10 }}>sin precio cargado</span>
                              )}
                            </td>
                            <td className="py-2.5 text-right text-gray-500">{r.viandas}</td>
                            <td className="py-2.5 text-right font-semibold" style={{ color: '#2C3B4B' }}>
                              {r.revenue > 0 ? `$${r.revenue.toLocaleString('es-AR')}` : '—'}
                            </td>
                            <td className="py-2.5 text-right">
                              {margenPctEmp !== null ? (
                                <span className={`font-bold ${margenPctEmp > 20 ? 'text-green-600' : margenPctEmp > 0 ? 'text-amber-500' : 'text-red-500'}`}>
                                  {margenPctEmp.toFixed(0)}%
                                </span>
                              ) : '—'}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* Alertas de variación de precios */}
          {alertasPrecios.length > 0 && (
            <div className="card p-5">
              <h2 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                Alertas de variación de precios de insumos
              </h2>
              <div className="divide-y divide-gray-50">
                {alertasPrecios.map(({ ins, last, prev, pct }) => (
                  <div key={ins.id} className="flex items-center justify-between py-3">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-sm flex-shrink-0"
                        style={{ backgroundColor: pct > 0 ? '#FEF2F2' : '#F0FDF4' }}
                      >
                        {pct > 0
                          ? <TrendingUp className="w-4 h-4 text-red-500" />
                          : <TrendingDown className="w-4 h-4 text-green-600" />
                        }
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-800">{ins.nombre}</p>
                        <p className="text-xs text-gray-400">
                          ${prev.precio.toLocaleString('es-AR')} → ${last.precio.toLocaleString('es-AR')} /{ins.unidad}
                          <span className="ml-2">
                            {new Date(last.fecha + 'T00:00:00').toLocaleDateString('es-AR')}
                          </span>
                        </p>
                      </div>
                    </div>
                    <span className={`text-sm font-bold flex-shrink-0 ml-4 ${pct > 0 ? 'text-red-500' : 'text-green-600'}`}>
                      {pct > 0 ? '+' : ''}{pct.toFixed(1)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

        </>
      )}
    </div>
  )
}
