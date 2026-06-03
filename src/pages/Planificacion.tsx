import { useState, useRef } from 'react'
import { v4 as uuidv4 } from 'uuid'
import * as XLSX from 'xlsx'
import {
  Upload, ShoppingCart, Download, CalendarDays,
  FileSpreadsheet, CheckCircle, AlertCircle, Trash2, AlertTriangle
} from 'lucide-react'
import {
  Plato, Insumo, SubReceta, PedidoItem, PedidoRow, CompraItem, PedidoSemanal
} from '../types'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { INSUMOS_INICIALES, PLATOS_INICIALES, SUBRECETAS_INICIALES } from '../data/mockData'
import { yieldFactor, toGramos } from '../utils/costos'

// ─── Helpers de parseo ────────────────────────────────────────────────────────

const MESES: Record<string, string> = {
  enero: '01', febrero: '02', marzo: '03', abril: '04',
  mayo: '05', junio: '06', julio: '07', agosto: '08',
  septiembre: '09', octubre: '10', noviembre: '11', diciembre: '12',
}

function parsearFecha(anio: unknown, mes: unknown, dia: unknown): string {
  const a = String(anio ?? '').trim()
  const m = MESES[String(mes ?? '').toLowerCase().trim()] ?? '01'
  const d = String(dia ?? '').trim().padStart(2, '0')
  return `${a}-${m}-${d}`
}

// Match flexible: busca el plato cuyo nombre esté contenido en el texto del Excel (o viceversa)
function matchearPlato(textoExcel: string, platos: Plato[]): Plato | undefined {
  const texto = textoExcel.toLowerCase().replace(/^xl\s+/i, '').trim()
  // 1. Coincidencia exacta
  let found = platos.find(p => p.nombre.toLowerCase() === texto)
  if (found) return found
  // 2. El nombre del sistema está contenido en el texto del Excel
  found = platos.find(p => texto.includes(p.nombre.toLowerCase()))
  if (found) return found
  // 3. El texto del Excel está contenido en el nombre del sistema
  found = platos.find(p => p.nombre.toLowerCase().includes(texto))
  if (found) return found
  return undefined
}

// ─── Lógica de cálculo de compras ────────────────────────────────────────────

const UNIDADES_PESO = new Set(['g', 'kg', 'ml', 'lt'])

function calcularListaCompras(
  items: PedidoItem[],
  platos: Plato[],
  insumos: Insumo[],
  subrecetas: SubReceta[],
  xlPorcentaje: number   // % de incremento para viandas XL (ej: 30 → ×1.30)
): CompraItem[] {
  const xlMultiplier = 1 + xlPorcentaje / 100
  const mapaInsumos: Record<string, { neta: number; esPeso: boolean }> = {}

  const addInsumo = (insumo_id: string, cantidadNeta: number, unidadIngrediente: string) => {
    const ins = insumos.find(i => i.id === insumo_id)
    if (!ins) return
    const esPeso = UNIDADES_PESO.has(ins.unidad)
    if (!mapaInsumos[insumo_id]) mapaInsumos[insumo_id] = { neta: 0, esPeso }
    if (esPeso) {
      mapaInsumos[insumo_id].neta += toGramos(cantidadNeta, unidadIngrediente)
    } else {
      mapaInsumos[insumo_id].neta += cantidadNeta
    }
  }

  for (const item of items) {
    const plato = platos.find(p => p.id === item.plato_id)
    if (!plato) continue
    const cantNormal = item.cantidad
    const cantXL     = item.cantidad_xl ?? 0

    for (const ing of plato.ingredientes) {
      if (ing.tipo === 'insumo') {
        const ins = insumos.find(i => i.id === ing.ref_id)
        if (!ins) continue
        const esDescartable = ins.categoria === 'descartables'
        const xlFactor      = esDescartable ? 1 : xlMultiplier
        // Viandas normales
        addInsumo(ing.ref_id, ing.cantidad * cantNormal, ing.unidad)
        // Viandas XL (descartables no se incrementan)
        if (cantXL > 0) addInsumo(ing.ref_id, ing.cantidad * cantXL * xlFactor, ing.unidad)
      } else {
        const sr = subrecetas.find(s => s.id === ing.ref_id)
        if (!sr || sr.rendimiento === 0) continue
        const rendG = toGramos(sr.rendimiento, sr.unidad_rendimiento)
        if (rendG === 0) continue
        // Viandas normales
        const ratioNormal = toGramos(ing.cantidad, ing.unidad) * cantNormal / rendG
        // Viandas XL (sub-recetas siempre se incrementan, son comida)
        const ratioXL = cantXL > 0
          ? toGramos(ing.cantidad, ing.unidad) * cantXL * xlMultiplier / rendG
          : 0
        for (const srIng of sr.ingredientes) {
          addInsumo(srIng.insumo_id, srIng.cantidad * ratioNormal, srIng.unidad)
          if (ratioXL > 0) addInsumo(srIng.insumo_id, srIng.cantidad * ratioXL, srIng.unidad)
        }
      }
    }
  }

  return Object.entries(mapaInsumos).map(([insumo_id, { neta, esPeso }]) => {
    const ins = insumos.find(i => i.id === insumo_id)!
    if (!esPeso) {
      const count = Math.ceil(neta)
      return {
        insumo_id, insumo_nombre: ins.nombre, unidad: ins.unidad,
        cantidad_neta: count, cantidad_bruta: count,
        proveedor: ins.proveedor, costo_estimado: count * ins.precio,
      }
    }
    const yf      = yieldFactor(ins.merma_crudo, ins.variacion_coccion)
    const brutaG  = yf > 0 ? neta / yf : neta
    const brutaKg = brutaG / 1000
    const netaKg  = neta   / 1000
    return {
      insumo_id, insumo_nombre: ins.nombre, unidad: ins.unidad,
      cantidad_neta:  Math.round(netaKg  * 1000) / 1000,
      cantidad_bruta: Math.round(brutaKg * 1000) / 1000,
      proveedor: ins.proveedor,
      costo_estimado: brutaKg * ins.precio,
    }
  }).sort((a, b) => a.insumo_nombre.localeCompare(b.insumo_nombre))
}

// ─── Exportar a Excel ────────────────────────────────────────────────────────

function exportarCompras(lista: CompraItem[], semana: string) {
  const data = lista.map(item => ({
    'Insumo': item.insumo_nombre,
    'A comprar': item.cantidad_bruta,
    'Unidad': item.unidad,
    'Proveedor': item.proveedor ?? '',
    'Costo estimado ($)': Math.round(item.costo_estimado),
  }))
  const total = lista.reduce((s, i) => s + i.costo_estimado, 0)
  data.push({ 'Insumo': 'TOTAL', 'A comprar': 0, 'Unidad': '', 'Proveedor': '', 'Costo estimado ($)': Math.round(total) })
  const ws = XLSX.utils.json_to_sheet(data)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Lista de compras')
  XLSX.writeFile(wb, `lista-compras-${semana}.xlsx`)
}

// ─── Página ──────────────────────────────────────────────────────────────────

export default function Planificacion() {
  const [platos]     = useLocalStorage<Plato[]>('el_platos', PLATOS_INICIALES)
  const [insumos]    = useLocalStorage<Insumo[]>('el_insumos', INSUMOS_INICIALES)
  const [subrecetas] = useLocalStorage<SubReceta[]>('el_subrecetas', SUBRECETAS_INICIALES)
  const [pedidos, setPedidos] = useLocalStorage<PedidoSemanal[]>('el_pedidos', [])
  const [xlPorcentaje, setXlPorcentaje] = useLocalStorage<number>('el_xl_porcentaje', 30)

  const [semana, setSemana] = useState(() => {
    const hoy = new Date()
    const startOfYear = new Date(hoy.getFullYear(), 0, 1)
    const week = Math.ceil(((hoy.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getDay() + 1) / 7)
    return `${hoy.getFullYear()}-S${String(week).padStart(2, '0')}`
  })

  const [rows, setRows]               = useState<PedidoRow[]>([])
  const [items, setItems]             = useState<PedidoItem[]>([])
  const [listaCompras, setListaCompras] = useState<CompraItem[]>([])
  const [errores, setErrores]         = useState<string[]>([])
  const [uploadOk, setUploadOk]       = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // ── Upload Excel ──────────────────────────────────────────────────────────
  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setErrores([])
    setUploadOk(false)

    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const data = new Uint8Array(ev.target!.result as ArrayBuffer)
        const wb   = XLSX.read(data, { type: 'array' })

        // Intentar leer hoja "Base" primero, si no la primera hoja
        const sheetName = wb.SheetNames.includes('Base') ? 'Base' : wb.SheetNames[0]
        const ws   = wb.Sheets[sheetName]
        const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws)

        if (rawRows.length === 0) {
          setErrores(['El archivo está vacío o no tiene el formato esperado.'])
          return
        }

        const nuevosRows: PedidoRow[] = []
        const noMatcheados = new Set<string>()
        const errList: string[] = []

        for (const row of rawRows) {
          // Columnas esperadas: empresa, anio, mes, dia, plato
          const empresa = String(row['empresa'] ?? row['Empresa'] ?? '').trim()
          const anio    = row['anio']  ?? row['año']  ?? row['Año']  ?? row['Anio']
          const mes     = row['mes']   ?? row['Mes']
          const dia     = row['dia']   ?? row['Dia']   ?? row['día']
          const platoExcel = String(row['plato'] ?? row['Plato'] ?? '').trim()

          if (!empresa || !platoExcel || !anio || !mes || !dia) continue

          const fecha  = parsearFecha(anio, mes, dia)
          const esXL   = /^xl\s+/i.test(platoExcel)
          const platoMatch = matchearPlato(platoExcel, platos)

          if (!platoMatch) noMatcheados.add(platoExcel)

          nuevosRows.push({
            fecha, empresa, plato_excel: platoExcel,
            plato_id: platoMatch?.id,
            plato_nombre: platoMatch?.nombre,
            es_xl: esXL,
          })
        }

        if (nuevosRows.length === 0) {
          setErrores(['No se encontraron filas válidas. Verificá que el Excel tenga las columnas: empresa, anio, mes, dia, plato.'])
          return
        }

        if (noMatcheados.size > 0) {
          errList.push(`${noMatcheados.size} plato(s) no encontrados en el sistema (se omiten de la lista de compras): ${[...noMatcheados].slice(0, 3).join(', ')}${noMatcheados.size > 3 ? '...' : ''}`)
        }

        // Agregar por plato para lista de compras — separar normal vs XL
        const mapaItems: Record<string, { cantidad: number; cantidad_xl: number }> = {}
        for (const r of nuevosRows) {
          if (r.plato_id) {
            if (!mapaItems[r.plato_id]) mapaItems[r.plato_id] = { cantidad: 0, cantidad_xl: 0 }
            if (r.es_xl) mapaItems[r.plato_id].cantidad_xl++
            else         mapaItems[r.plato_id].cantidad++
          }
        }
        const nuevosItems: PedidoItem[] = Object.entries(mapaItems).map(([plato_id, { cantidad, cantidad_xl }]) => ({
          plato_id,
          plato_nombre: platos.find(p => p.id === plato_id)?.nombre ?? '',
          cantidad,
          cantidad_xl,
        }))

        // Fechas del período
        const fechas = nuevosRows.map(r => r.fecha).sort()
        const fechaInicio = fechas[0]
        const fechaFin    = fechas[fechas.length - 1]

        // Actualizar semana con el período detectado
        if (fechaInicio) {
          const d = new Date(fechaInicio + 'T12:00:00')
          setSemana(`${d.getFullYear()}-S${String(Math.ceil((d.getTime() - new Date(d.getFullYear(),0,1).getTime()) / 604800000)).padStart(2,'0')}`)
        }

        const lista = calcularListaCompras(nuevosItems, platos, insumos, subrecetas, xlPorcentaje)

        setRows(nuevosRows)
        setItems(nuevosItems)
        setListaCompras(lista)
        setErrores(errList)
        setUploadOk(true)
      } catch (err) {
        setErrores(['Error al leer el archivo. Verificá que sea un Excel válido (.xlsx).'])
      }
    }
    reader.readAsArrayBuffer(file)
    if (fileRef.current) fileRef.current.value = ''
  }

  const handleGuardar = () => {
    if (rows.length === 0) return
    const fechas = rows.map(r => r.fecha).sort()
    const nuevo: PedidoSemanal = {
      id: uuidv4(), semana, rows, items,
      lista_compras: listaCompras,
      fecha_inicio: fechas[0],
      fecha_fin: fechas[fechas.length - 1],
      createdAt: new Date().toISOString(),
    }
    setPedidos(list => [nuevo, ...list.filter(p => p.semana !== semana)])
    setRows([])
    setItems([])
    setListaCompras([])
    setUploadOk(false)
  }

  const cargarPedido = (p: PedidoSemanal) => {
    setSemana(p.semana)
    setRows(p.rows ?? [])
    setItems(p.items)
    setListaCompras(p.lista_compras)
    setUploadOk(true)
  }

  const costoTotal = listaCompras.reduce((s, i) => s + i.costo_estimado, 0)

  // Resumen por empresa para mostrar
  const resumenEmpresas = rows.reduce((acc, r) => {
    acc[r.empresa] = (acc[r.empresa] ?? 0) + 1
    return acc
  }, {} as Record<string, number>)

  // Fechas únicas para mostrar
  const fechasUnicas = [...new Set(rows.map(r => r.fecha))].sort()
  const noMatchCount = rows.filter(r => !r.plato_id).length
  const xlCount      = rows.filter(r => r.es_xl).length

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Planificación Semanal</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Subí el Excel de pedidos (hoja "Base") y generamos la lista de compras automáticamente
        </p>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Panel izquierdo */}
        <div className="col-span-1 space-y-4">
          <div className="card p-5 space-y-4">
            <h2 className="font-semibold text-gray-800 flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-navy-700" /> Semana
            </h2>
            <div>
              <label className="label">Identificador</label>
              <input className="input" value={semana} onChange={e => setSemana(e.target.value)}
                placeholder="Ej: 2026-S22" />
            </div>

            {/* Config XL */}
            <div className="border-t border-gray-100 pt-4">
              <label className="label flex items-center gap-1.5">
                <span className="text-base leading-none">📏</span> Incremento vianda XL
              </label>
              <div className="flex items-center gap-2 mt-1">
                <input
                  className="input w-24 text-center font-semibold"
                  type="number" min="0" max="200" step="5"
                  value={xlPorcentaje}
                  onChange={e => setXlPorcentaje(parseFloat(e.target.value) || 0)}
                />
                <span className="text-sm text-gray-500">%</span>
                <span className="text-xs text-gray-400 ml-1">sobre ingredientes (excl. descartables)</span>
              </div>
            </div>

            {/* Upload */}
            <div>
              <label className="label">Subir Excel de pedidos</label>
              <div onClick={() => fileRef.current?.click()}
                className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center cursor-pointer hover:border-navy-600 hover:bg-lima-100 transition-colors">
                <FileSpreadsheet className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                <p className="text-sm text-gray-500">Hacé clic para subir</p>
                <p className="text-xs text-gray-400 mt-1">
                  Hoja <strong>Base</strong> con columnas: <strong>empresa, anio, mes, dia, plato</strong>
                </p>
                <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFile} />
              </div>
            </div>

            {/* Feedback */}
            {errores.map((err, i) => (
              <div key={i} className="flex gap-2 p-3 bg-orange-50 rounded-lg text-xs text-orange-700">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <p>{err}</p>
              </div>
            ))}
            {uploadOk && (
              <div className="flex gap-2 p-3 bg-green-50 rounded-lg text-xs text-green-700">
                <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <p>
                    {rows.length} viandas · {fechasUnicas.length} días · {Object.keys(resumenEmpresas).length} empresas
                  </p>
                  {xlCount > 0 && (
                    <p className="mt-0.5 text-green-600">
                      📏 {xlCount} viandas XL (+{xlPorcentaje}% ingredientes)
                    </p>
                  )}
                  {noMatchCount > 0 && (
                    <p className="mt-0.5 text-orange-500">{noMatchCount} sin matchear</p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Pedidos anteriores */}
          {pedidos.length > 0 && (
            <div className="card p-5 space-y-3">
              <h3 className="font-medium text-gray-700 text-sm">Pedidos guardados</h3>
              {pedidos.slice(0, 5).map(p => (
                <div key={p.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-gray-700">{p.semana}</p>
                    <p className="text-xs text-gray-400">
                      {p.rows?.length ?? p.items.reduce((s, i) => s + i.cantidad, 0)} viandas
                      {p.fecha_inicio && ` · ${new Date(p.fecha_inicio + 'T12:00:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}`}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <button className="btn-ghost text-xs py-1 px-2" onClick={() => cargarPedido(p)}>Ver</button>
                    <button className="btn-ghost p-1.5 text-red-400 hover:bg-red-50"
                      onClick={() => setPedidos(list => list.filter(x => x.id !== p.id))}>
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Panel derecho */}
        <div className="col-span-2 space-y-4">
          {/* Resumen del pedido */}
          {rows.length > 0 && (
            <div className="card p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-gray-800">Pedido — {semana}</h2>
                <button className="btn-secondary text-sm" onClick={handleGuardar}>
                  Guardar pedido
                </button>
              </div>

              {/* Por fecha */}
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Por día</p>
                <div className="flex flex-wrap gap-2">
                  {fechasUnicas.map(f => {
                    const count = rows.filter(r => r.fecha === f).length
                    const d = new Date(f + 'T12:00:00')
                    return (
                      <div key={f} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
                        style={{ backgroundColor: '#f4fad5', color: '#2C3B4B' }}>
                        <span>{d.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' })}</span>
                        <span className="font-bold">{count}</span>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Por empresa */}
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Por empresa</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {Object.entries(resumenEmpresas).sort((a, b) => b[1] - a[1]).map(([emp, cant]) => {
                    const xlEmp = rows.filter(r => r.empresa === emp && r.es_xl).length
                    return (
                      <div key={emp} className="flex justify-between items-center py-1.5 px-3 bg-gray-50 rounded-lg">
                        <span className="text-sm text-gray-700">{emp}</span>
                        <span className="font-semibold text-sm" style={{ color: '#2C3B4B' }}>
                          {cant}
                          {xlEmp > 0 && <span className="text-xs font-normal text-gray-400 ml-1">({xlEmp} XL)</span>}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Platos no matcheados */}
              {noMatchCount > 0 && (
                <div className="bg-orange-50 rounded-lg p-3">
                  <p className="text-xs font-semibold text-orange-700 mb-1">
                    ⚠️ {noMatchCount} viandas no se pudieron asociar a una receta del sistema
                  </p>
                  <p className="text-xs text-orange-600">
                    Verificá que los nombres del Excel coincidan con los de tus recetas.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Lista de compras */}
          {listaCompras.length > 0 && (
            <div className="card overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                <h2 className="font-semibold text-gray-800 flex items-center gap-2">
                  <ShoppingCart className="w-4 h-4 text-navy-700" /> Lista de compras
                </h2>
                <button className="btn-primary text-sm" onClick={() => exportarCompras(listaCompras, semana)}>
                  <Download className="w-3.5 h-3.5" /> Exportar Excel
                </button>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="text-left px-5 py-3 font-medium text-gray-500">Insumo</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-500">A comprar</th>
                    <th className="text-left px-3 py-3 font-medium text-gray-500">Unidad</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500">Proveedor</th>
                    <th className="text-right px-5 py-3 font-medium text-gray-500">Costo estimado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {listaCompras.map(item => (
                    <tr key={item.insumo_id} className="hover:bg-gray-50">
                      <td className="px-5 py-3 font-medium text-gray-800">{item.insumo_nombre}</td>
                      <td className="px-4 py-3 text-right font-semibold text-navy-700">
                        {item.cantidad_bruta.toLocaleString('es-AR', { maximumFractionDigits: 3 })}
                      </td>
                      <td className="px-3 py-3 text-gray-500">{item.unidad}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{item.proveedor ?? '—'}</td>
                      <td className="px-5 py-3 text-right text-gray-700">
                        ${item.costo_estimado.toLocaleString('es-AR', { maximumFractionDigits: 0 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t" style={{ backgroundColor: '#f4fad5' }}>
                    <td colSpan={4} className="px-5 py-3 font-semibold" style={{ color: '#2C3B4B' }}>
                      Total estimado
                    </td>
                    <td className="px-5 py-3 text-right font-bold" style={{ color: '#2C3B4B' }}>
                      ${costoTotal.toLocaleString('es-AR', { maximumFractionDigits: 0 })}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          {rows.length === 0 && (
            <div className="card p-16 text-center text-gray-400">
              <Upload className="w-10 h-10 mx-auto mb-3 opacity-25" />
              <p className="font-medium">Subí el Excel para ver el pedido y la lista de compras</p>
              <p className="text-sm mt-1">El sistema lee la hoja "Base" con empresa, fecha y plato por empleado</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
