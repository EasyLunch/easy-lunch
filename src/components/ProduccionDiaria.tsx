import { useEffect, useMemo, useState, Fragment } from 'react'
import * as XLSX from 'xlsx'
import {
  RefreshCw, Download, ChefHat, AlertTriangle, ChevronDown, ChevronRight, Layers, Package2, Printer
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useData } from '../context/DataContext'
import { useSupabaseStorage } from '../hooks/useSupabaseStorage'
import {
  PedidosProduccion, DiaProduccion, ResultadoProduccion, LineaInsumo, LineaSubreceta,
  calcularProduccion, claveNombre, fmtCant, numExcel
} from '../utils/produccion'

const KEY_PEDIDOS = 'el_produccion_pedidos'
const KEY_ASOC = 'el_produccion_asociaciones'

type Vista = 'categorias' | 'subrecetas' | 'insumos'

const subEsPeso = (s: LineaSubreceta) => !(s.sub.unidad_rendimiento === 'unidad' && !(s.sub.gramaje_unidad && s.sub.gramaje_unidad > 0))
const fmtTandas = (t: number) => t.toLocaleString('es-AR', { maximumFractionDigits: 2 })
const hoyISO = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function etiquetaDia(d: DiaProduccion) {
  const f = new Date(d.fecha + 'T12:00:00')
  return f.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' })
}

// ─── Excel ───────────────────────────────────────────────────────────────────
function exportarExcel(r: ResultadoProduccion, titulo: string) {
  const wb = XLSX.utils.book_new()
  const hoja = (nombre: string, filas: (string | number)[][], anchos: number[]) => {
    const ws = XLSX.utils.aoa_to_sheet(filas)
    ws['!cols'] = anchos.map(w => ({ wch: w }))
    XLSX.utils.book_append_sheet(wb, ws, nombre)
  }
  const ins = (i: LineaInsumo) => [i.insumo.nombre, numExcel(i.crudo, i.esPeso), numExcel(i.cocido, i.esPeso), i.unidad]

  // Platos por categoría
  const fp: (string | number)[][] = [[`PRODUCCIÓN · ${titulo}`], [], ['Categoría', 'Plato (sistema)', 'Receta', 'Cantidad', 'XL', 'Total', 'HIT', 'Sin HIT', 'g cocido/vianda', 'kg cocido total', 'Nota']]
  for (const c of r.categorias) {
    for (const p of c.platos) {
      fp.push([c.categoria, p.nombre, p.receta?.nombre ?? '⚠ SIN RECETA', p.cant, p.cantXL, p.cant + p.cantXL, p.hit, p.sinHit,
        Math.round(p.pesoViandaG), Math.round(p.totalCocidoG) / 1000, p.nota ?? ''])
    }
    fp.push(['', `Total ${c.categoria}`, '', '', '', c.totalViandas])
    fp.push([])
  }
  fp.push(['', 'TOTAL VIANDAS', '', '', '', r.totalViandas])
  hoja('Platos', fp, [26, 48, 40, 9, 6, 8, 6, 8, 14, 14, 40])

  // Subrecetas por categoría (con sus insumos)
  const fs: (string | number)[][] = [[`SUBRECETAS POR CATEGORÍA · ${titulo}`], [], ['Categoría', 'Subreceta / insumo', 'Cocido a obtener', 'Unidad', 'Tandas (veces la receta)', 'Crudo', 'Cocido', 'Unidad insumo', 'Platos que la usan']]
  for (const c of r.categorias) {
    if (!c.subrecetas.length) continue
    for (const s of c.subrecetas) {
      const p = subEsPeso(s)
      fs.push([c.categoria, s.sub.nombre, numExcel(s.cocido, p), p ? 'kg' : 'unidad', Math.round(s.tandas * 100) / 100, '', '', '', s.platos.join(' · ')])
      for (const i of s.insumos) fs.push(['', '   ' + i.insumo.nombre, '', '', '', numExcel(i.crudo, i.esPeso), numExcel(i.cocido, i.esPeso), i.unidad])
    }
    fs.push([])
  }
  hoja('Subrecetas x categoría', fs, [26, 44, 16, 8, 12, 12, 12, 10, 60])

  // Subrecetas totales
  const ft: (string | number)[][] = [[`SUBRECETAS DEL DÍA (TOTAL) · ${titulo}`], [], ['Subreceta / insumo', 'Cocido a obtener', 'Unidad', 'Tandas', 'Crudo', 'Cocido', 'Unidad insumo', 'Platos']]
  for (const s of r.subrecetas) {
    const p = subEsPeso(s)
    ft.push([s.sub.nombre, numExcel(s.cocido, p), p ? 'kg' : 'unidad', Math.round(s.tandas * 100) / 100, '', '', '', s.platos.join(' · ')])
    for (const i of s.insumos) ft.push(['   ' + i.insumo.nombre, '', '', '', numExcel(i.crudo, i.esPeso), numExcel(i.cocido, i.esPeso), i.unidad])
  }
  hoja('Subrecetas total', ft, [44, 16, 8, 10, 12, 12, 10, 60])

  // Insumos directos por categoría
  const fi: (string | number)[][] = [[`INSUMOS DIRECTOS POR CATEGORÍA (fuera de subrecetas) · ${titulo}`], [], ['Categoría', 'Insumo', 'Crudo', 'Cocido', 'Unidad']]
  for (const c of r.categorias) {
    for (const i of c.insumos) fi.push([c.categoria, ...ins(i)])
    if (c.insumos.length) fi.push([])
  }
  hoja('Insumos x categoría', fi, [26, 40, 12, 12, 8])

  // Insumos totales
  const fit: (string | number)[][] = [[`INSUMOS DEL DÍA (TOTAL, incluye los de subrecetas) · ${titulo}`], [], ['Insumo', 'Crudo', 'Cocido', 'Unidad', 'Proveedor']]
  for (const i of r.insumosTotales) fit.push([...ins(i), i.insumo.proveedor ?? ''])
  hoja('Insumos total', fit, [40, 12, 12, 8, 26])

  if (r.descartables.length) {
    hoja('Descartables', [['Descartable', 'Cantidad', 'Unidad'], ...r.descartables.map(i => [i.insumo.nombre, numExcel(i.cocido, i.esPeso), i.unidad])], [40, 10, 8])
  }
  if (r.sinReceta.length) {
    hoja('Sin receta', [['Categoría', 'Plato (sistema)', 'Cantidad'], ...r.sinReceta.map(p => [p.categoria, p.nombre, p.cant + p.cantXL])], [26, 50, 10])
  }
  XLSX.writeFile(wb, `Produccion ${titulo.replace(/[\/\\:*?"<>|]/g, '-')}.xlsx`)
}

// ─── Tablas chicas ───────────────────────────────────────────────────────────
function TablaInsumos({ lista, conProveedor }: { lista: LineaInsumo[]; conProveedor?: boolean }) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="bg-gray-50 border-b border-gray-100 text-gray-500">
          <th className="text-left px-4 py-2 font-medium">Insumo</th>
          <th className="text-right px-4 py-2 font-medium">Crudo</th>
          <th className="text-right px-4 py-2 font-medium">Cocido</th>
          {conProveedor && <th className="text-left px-4 py-2 font-medium">Proveedor</th>}
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-50">
        {lista.map(i => (
          <tr key={i.insumo.id + i.unidad} className="hover:bg-gray-50">
            <td className="px-4 py-2 text-gray-800">{i.insumo.nombre}</td>
            <td className="px-4 py-2 text-right font-semibold text-orange-700">{fmtCant(i.crudo, i.esPeso, i.unidad)}</td>
            <td className="px-4 py-2 text-right font-semibold text-green-700">{fmtCant(i.cocido, i.esPeso, i.unidad)}</td>
            {conProveedor && <td className="px-4 py-2 text-xs text-gray-500">{i.insumo.proveedor ?? '—'}</td>}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function TablaSubrecetas({ lista }: { lista: LineaSubreceta[] }) {
  const [abiertas, setAbiertas] = useState<Record<string, boolean>>({})
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="bg-gray-50 border-b border-gray-100 text-gray-500">
          <th className="text-left px-4 py-2 font-medium">Subreceta</th>
          <th className="text-right px-4 py-2 font-medium">Cocido a obtener</th>
          <th className="text-right px-4 py-2 font-medium">Tandas</th>
          <th className="text-right px-4 py-2 font-medium">Crudo (entrada)</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-50">
        {lista.map(s => {
          const ab = !!abiertas[s.sub.id]
          return (
            <Fragment key={s.sub.id}>
              <tr className="hover:bg-gray-50 cursor-pointer" onClick={() => setAbiertas(a => ({ ...a, [s.sub.id]: !ab }))}>
                <td className="px-4 py-2 text-gray-800">
                  <span className="inline-flex items-center gap-1.5 font-medium">
                    {ab ? <ChevronDown className="w-3.5 h-3.5 text-gray-400" /> : <ChevronRight className="w-3.5 h-3.5 text-gray-400" />}
                    {s.sub.nombre}
                  </span>
                  <span className="block text-xs text-gray-400 ml-5">{s.platos.join(' · ')}</span>
                </td>
                <td className="px-4 py-2 text-right font-semibold text-green-700">{fmtCant(s.cocido, subEsPeso(s))}</td>
                <td className="px-4 py-2 text-right text-gray-600" title={`Rinde ${s.sub.rendimiento} ${s.sub.unidad_rendimiento} por tanda`}>× {fmtTandas(s.tandas)}</td>
                <td className="px-4 py-2 text-right font-semibold text-orange-700">{s.crudo > 0 ? fmtCant(s.crudo, true) : '—'}</td>
              </tr>
              {ab && s.insumos.map(i => (
                <tr key={s.sub.id + i.insumo.id + i.unidad} className="bg-purple-50/40 text-xs">
                  <td className="pl-10 pr-4 py-1.5 text-gray-600">{i.insumo.nombre}</td>
                  <td className="px-4 py-1.5 text-right text-green-700">cocido {fmtCant(i.cocido, i.esPeso, i.unidad)}</td>
                  <td></td>
                  <td className="px-4 py-1.5 text-right text-orange-700">crudo {fmtCant(i.crudo, i.esPeso, i.unidad)}</td>
                </tr>
              ))}
            </Fragment>
          )
        })}
      </tbody>
    </table>
  )
}

// ─── Componente principal ────────────────────────────────────────────────────
export default function ProduccionDiaria() {
  const { platos, insumos, subrecetas, xlPorcentaje } = useData()
  const [datos, setDatos] = useState<PedidosProduccion | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [elegidos, setElegidos] = useState<string[]>([])
  const [vista, setVista] = useState<Vista>('categorias')
  const [cerradas, setCerradas] = useState<Record<string, boolean>>({})
  const [editando, setEditando] = useState('')
  const [asoc, setAsoc] = useSupabaseStorage<Record<string, string>>(KEY_ASOC, {})

  const traer = async () => {
    setCargando(true); setError('')
    const { data, error } = await supabase.from('app_data').select('value').eq('key', KEY_PEDIDOS).maybeSingle()
    setCargando(false)
    if (error) { setError('No pude leer los pedidos: ' + error.message); return }
    const v = data?.value as PedidosProduccion | undefined
    if (!v || !Array.isArray(v.dias)) { setError('Todavía no hay pedidos publicados desde Modificaciones.'); setDatos(null); return }
    setDatos(v)
    setElegidos(prev => {
      const existentes = prev.filter(f => v.dias.some(d => d.fecha === f))
      if (existentes.length) return existentes
      const hoy = hoyISO()
      const prox = v.dias.find(d => d.fecha > hoy && d.items.length) ?? v.dias.find(d => d.items.length)
      return prox ? [prox.fecha] : []
    })
  }
  useEffect(() => { traer() }, [])

  const diasElegidos = useMemo(() => (datos?.dias ?? []).filter(d => elegidos.includes(d.fecha)), [datos, elegidos])
  const items = useMemo(() => diasElegidos.flatMap(d => d.items), [diasElegidos])
  const res = useMemo(
    () => calcularProduccion(items, platos, insumos, subrecetas, xlPorcentaje, asoc),
    [items, platos, insumos, subrecetas, xlPorcentaje, asoc]
  )
  const titulo = diasElegidos.length === 1
    ? new Date(diasElegidos[0].fecha + 'T12:00:00').toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })
    : diasElegidos.map(etiquetaDia).join(' + ')
  const findeTxt = diasElegidos.some(d => d.finde?.length) ? ' (incluye pedidos de sábado y domingo)' : ''
  const platosOrdenados = useMemo(() => [...platos].sort((a, b) => a.nombre.localeCompare(b.nombre)), [platos])

  const toggleDia = (f: string, multi: boolean) =>
    setElegidos(prev => multi ? (prev.includes(f) ? prev.filter(x => x !== f) : [...prev, f].sort()) : [f])

  const asociar = (nombre: string, platoId: string) => {
    const k = claveNombre(nombre)
    setAsoc(prev => {
      const n = { ...prev }
      if (platoId) n[k] = platoId; else delete n[k]
      return n
    })
  }

  return (
    <div className="space-y-4">
      {/* Origen de los pedidos + días */}
      <div className="card p-5 space-y-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h2 className="font-semibold text-gray-800 flex items-center gap-2">
              <ChefHat className="w-4 h-4 text-navy-700" /> Producción diaria
            </h2>
            <p className="text-xs text-gray-500 mt-1">
              Pedidos de <b>Modificaciones de pedidos</b> (con bajas, altas y cambios aplicados), cruzados con las recetas y subrecetas.
              {datos && <> Actualizado {datos.actualizadoTxt}{datos.datosSistema ? ` · datos del sistema ${datos.datosSistema}` : ''} · se actualiza solo cada 30 min.</>}
            </p>
          </div>
          <div className="flex gap-2 print:hidden">
            <button className="btn-secondary text-sm" onClick={traer} disabled={cargando}>
              <RefreshCw className={`w-3.5 h-3.5 ${cargando ? 'animate-spin' : ''}`} /> Actualizar
            </button>
            <button className="btn-secondary text-sm" disabled={!items.length} onClick={() => window.print()}>
              <Printer className="w-3.5 h-3.5" /> Imprimir
            </button>
            <button className="btn-primary text-sm" disabled={!items.length} onClick={() => exportarExcel(res, titulo)}>
              <Download className="w-3.5 h-3.5" /> Excel
            </button>
          </div>
        </div>

        {error && (
          <div className="flex gap-2 p-3 bg-orange-50 rounded-lg text-xs text-orange-700">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /><p>{error}</p>
          </div>
        )}

        {datos && (
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
              Día de entrega <span className="normal-case font-normal">(clic = un día · Ctrl/⌘ + clic = sumar varios)</span>
            </p>
            <div className="flex flex-wrap gap-2">
              {datos.dias.map(d => {
                const act = elegidos.includes(d.fecha)
                return (
                  <button key={d.fecha} onClick={e => toggleDia(d.fecha, e.ctrlKey || e.metaKey)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${act ? 'border-transparent text-white' : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'}`}
                    style={act ? { backgroundColor: '#2C3B4B' } : undefined}>
                    {etiquetaDia(d)} <b className="ml-1">{d.platos}</b>{d.finde?.length ? ' +finde' : ''}
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {items.length > 0 && (
        <>
          {/* Resumen */}
          <div className="card p-5">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <p className="text-lg font-semibold text-gray-900 capitalize">{titulo}</p>
                <p className="text-xs text-gray-500">{res.totalViandas} viandas{findeTxt} · {res.subrecetas.length} subrecetas · {res.insumosTotales.length} insumos</p>
              </div>
              <div className="flex bg-gray-100 rounded-lg p-1 text-sm">
                {([['categorias', 'Por categoría', ChefHat], ['subrecetas', 'Subrecetas (total)', Layers], ['insumos', 'Insumos (total)', Package2]] as const).map(([v, l, Icon]) => (
                  <button key={v} onClick={() => setVista(v)}
                    className={`px-3 py-1.5 rounded-md font-medium flex items-center gap-1.5 ${vista === v ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}>
                    <Icon className="w-3.5 h-3.5" /> {l}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex flex-wrap gap-2 mt-3">
              {res.categorias.map(c => (
                <span key={c.categoria} className="px-2.5 py-1 rounded-lg text-xs font-medium" style={{ backgroundColor: '#f4fad5', color: '#2C3B4B' }}>
                  {c.categoria} <b>{c.platos.reduce((s, p) => s + p.cant + p.cantXL, 0)}</b>
                </span>
              ))}
            </div>
          </div>

          {/* Sin receta */}
          {res.sinReceta.length > 0 && (
            <div className="card p-5 border-orange-200 bg-orange-50/50">
              <p className="text-sm font-semibold text-orange-700 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" /> {res.sinReceta.length} plato{res.sinReceta.length > 1 ? 's' : ''} sin receta asociada (no suman subrecetas ni insumos)
              </p>
              <p className="text-xs text-orange-600 mt-0.5 mb-3">Elegí la receta que corresponde: queda guardado para los próximos días. "No lleva receta" lo saca de este aviso.</p>
              <div className="space-y-2">
                {res.sinReceta.map(p => (
                  <div key={p.categoria + p.nombre} className="flex items-center gap-3 flex-wrap bg-white rounded-lg px-3 py-2">
                    <span className="text-sm text-gray-800 flex-1 min-w-[220px]">
                      {p.nombre} <span className="text-xs text-gray-400">· {p.categoria} · {p.cant + p.cantXL}</span>
                    </span>
                    <select className="input w-72 text-xs py-1.5" value="" onChange={e => asociar(p.nombre, e.target.value)}>
                      <option value="">Elegir receta…</option>
                      <option value="-">No lleva receta</option>
                      {platosOrdenados.map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          )}

          {vista === 'categorias' && res.categorias.map(c => {
            const cerrada = !!cerradas[c.categoria]
            return (
              <div key={c.categoria} className="card overflow-hidden">
                <button className="w-full flex items-center justify-between px-5 py-3 text-left" style={{ backgroundColor: '#2C3B4B' }}
                  onClick={() => setCerradas(s => ({ ...s, [c.categoria]: !cerrada }))}>
                  <span className="font-semibold text-white flex items-center gap-2">
                    {cerrada ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />} {c.categoria}
                  </span>
                  <span className="text-sm font-bold" style={{ color: '#D2EA8E' }}>{c.platos.reduce((s, p) => s + p.cant + p.cantXL, 0)}</span>
                </button>
                {!cerrada && (
                  <div className="divide-y divide-gray-100">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-100 text-gray-500">
                          <th className="text-left px-4 py-2 font-medium">Plato</th>
                          <th className="text-right px-3 py-2 font-medium">Cant.</th>
                          <th className="text-right px-3 py-2 font-medium">HIT / sin HIT</th>
                          <th className="text-right px-3 py-2 font-medium">g/vianda</th>
                          <th className="text-right px-4 py-2 font-medium">Total cocido</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {c.platos.map(p => (
                          <tr key={p.nombre + p.tipo} className={p.receta ? '' : 'bg-orange-50/60'}>
                            <td className="px-4 py-2">
                              <span className="text-gray-800 font-medium">{p.nombre}</span>
                              <span className="block text-xs text-gray-400">
                                {p.receta ? `Receta: ${p.receta.nombre}${p.manual ? ' (elegida a mano)' : ''}` : p.noLleva ? 'no lleva receta' : '⚠ sin receta'}
                                {p.nota ? ` · ${p.nota}` : ''}
                                <button className="ml-2 underline hover:text-gray-600 print:hidden" onClick={() => setEditando(editando === c.categoria + p.nombre ? '' : c.categoria + p.nombre)}>cambiar</button>
                              </span>
                              {editando === c.categoria + p.nombre && (
                                <select className="input mt-1 w-80 text-xs py-1.5" value="" onChange={e => { asociar(p.nombre, e.target.value === '*' ? '' : e.target.value); setEditando('') }}>
                                  <option value="">Elegir receta…</option>
                                  <option value="*">Automática (por nombre)</option>
                                  <option value="-">No lleva receta</option>
                                  {platosOrdenados.map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}
                                </select>
                              )}
                            </td>
                            <td className="px-3 py-2 text-right font-bold text-gray-900">
                              {p.cant + p.cantXL}{p.cantXL > 0 && <span className="block text-xs font-normal text-gray-400">{p.cantXL} XL</span>}
                            </td>
                            <td className="px-3 py-2 text-right text-xs text-gray-500">{p.tipo === 'reventa' ? '—' : `${p.hit} / ${p.sinHit}`}</td>
                            <td className="px-3 py-2 text-right text-gray-600">{p.pesoViandaG ? Math.round(p.pesoViandaG) : '—'}</td>
                            <td className="px-4 py-2 text-right font-semibold text-green-700">{p.totalCocidoG ? fmtCant(p.totalCocidoG, true) : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {c.subrecetas.length > 0 && (
                      <div>
                        <p className="px-4 pt-3 pb-1 text-xs font-semibold text-purple-700 uppercase tracking-wider">Subrecetas a preparar</p>
                        <TablaSubrecetas lista={c.subrecetas} />
                      </div>
                    )}
                    {c.insumos.length > 0 && (
                      <div>
                        <p className="px-4 pt-3 pb-1 text-xs font-semibold text-blue-700 uppercase tracking-wider">Insumos directos (fuera de subrecetas)</p>
                        <TablaInsumos lista={c.insumos} />
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}

          {vista === 'subrecetas' && (
            <div className="card overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100">
                <h3 className="font-semibold text-gray-800">Subrecetas del día (todas las categorías sumadas)</h3>
                <p className="text-xs text-gray-500">Tocá una subreceta para ver sus insumos en crudo y en cocido.</p>
              </div>
              <TablaSubrecetas lista={res.subrecetas} />
            </div>
          )}

          {vista === 'insumos' && (
            <div className="space-y-4">
              <div className="card overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-100">
                  <h3 className="font-semibold text-gray-800">Insumos del día (incluye los que van dentro de subrecetas)</h3>
                  <p className="text-xs text-gray-500">Crudo = lo que entra a la cocina (con merma) · Cocido = lo que queda listo para emplatar.</p>
                </div>
                <TablaInsumos lista={res.insumosTotales} conProveedor />
              </div>
              {res.descartables.length > 0 && (
                <div className="card overflow-hidden">
                  <div className="px-5 py-3 border-b border-gray-100"><h3 className="font-semibold text-gray-800">Descartables</h3></div>
                  <table className="w-full text-sm">
                    <tbody className="divide-y divide-gray-50">
                      {res.descartables.map(i => (
                        <tr key={i.insumo.id}><td className="px-4 py-2">{i.insumo.nombre}</td><td className="px-4 py-2 text-right font-semibold">{fmtCant(i.cocido, i.esPeso, i.unidad)}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {(datos?.avisos?.length ?? 0) > 0 && (
            <details className="card p-4 text-xs text-gray-500">
              <summary className="cursor-pointer font-medium">Avisos de Modificaciones ({datos!.avisos!.length})</summary>
              <ul className="mt-2 space-y-1 list-disc pl-5">{datos!.avisos!.map((a, i) => <li key={i}>{a}</li>)}</ul>
            </details>
          )}
        </>
      )}

      {!cargando && datos && !items.length && (
        <div className="card p-12 text-center text-gray-400">
          <ChefHat className="w-10 h-10 mx-auto mb-3 opacity-25" />
          <p className="font-medium">Elegí un día con pedidos</p>
        </div>
      )}
    </div>
  )
}
