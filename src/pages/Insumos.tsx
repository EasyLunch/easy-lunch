import { useState, useRef } from 'react'
import { v4 as uuidv4 } from 'uuid'
import * as XLSX from 'xlsx'
import {
  Plus, Pencil, Trash2, TrendingUp, Search, X, History, Upload,
  Download, CheckCircle, AlertCircle
} from 'lucide-react'
import {
  Insumo, CategoriaInsumo, HistorialPrecio,
  CATEGORIAS_INSUMO, UNIDADES
} from '../types'
import { useData } from '../context/DataContext'
import { precioRealPorKg, yieldFactor } from '../utils/costos'

// ─── Helpers ────────────────────────────────────────────────────────────────

function getCategoriaInfo(cat: string) {
  return CATEGORIAS_INSUMO.find(c => c.value === cat) ?? { value: cat, label: cat, emoji: '📋', color: 'bg-slate-100 text-slate-700' }
}

function formatPrecio(p: number) {
  return `$${p.toLocaleString('es-AR')}`
}

// ─── Modal de Insumo ────────────────────────────────────────────────────────

interface InsumoModalProps {
  insumo?: Insumo
  onSave: (insumo: Omit<Insumo, 'id' | 'createdAt' | 'updatedAt'>) => void
  onClose: () => void
}

const EMPTY_FORM = {
  nombre: '', categoria: 'verduras' as CategoriaInsumo,
  precio: 0, unidad: 'kg', proveedor: '',
  merma_crudo: 0, variacion_coccion: 0, gramaje: 0,
}

function InsumoModal({ insumo, onSave, onClose }: InsumoModalProps) {
  const [form, setForm] = useState(insumo ? {
    nombre: insumo.nombre, categoria: insumo.categoria,
    precio: insumo.precio, unidad: insumo.unidad,
    proveedor: insumo.proveedor ?? '',
    merma_crudo: insumo.merma_crudo,
    variacion_coccion: insumo.variacion_coccion,
    gramaje: insumo.gramaje ?? 0,
  } : EMPTY_FORM)

  const set = (field: string, value: string | number) =>
    setForm(f => ({ ...f, [field]: value }))

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.nombre.trim()) return
    onSave({ ...form, proveedor: form.proveedor || undefined })
  }

  // Cálculo ilustrativo
  const pesoNeto = form.merma_crudo > 0
    ? (1 - form.merma_crudo / 100).toFixed(3)
    : '1.000'
  const pesoCocido = (() => {
    const neto = 1 - form.merma_crudo / 100
    const final = neto * (1 + form.variacion_coccion / 100)
    return final.toFixed(3)
  })()
  const precioReal = form.precio > 0
    ? precioRealPorKg(form.precio, form.merma_crudo, form.variacion_coccion)
    : 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">
            {insumo ? 'Editar insumo' : 'Nuevo insumo'}
          </h2>
          <button onClick={onClose} className="btn-ghost p-1.5">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {/* Nombre */}
          <div>
            <label className="label">Nombre *</label>
            <input className="input" value={form.nombre}
              onChange={e => set('nombre', e.target.value)}
              placeholder="Ej: Pechuga de pollo" required />
          </div>

          {/* Categoría + Unidad */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Categoría *</label>
              <select className="input" value={form.categoria}
                onChange={e => set('categoria', e.target.value as CategoriaInsumo)}>
                {CATEGORIAS_INSUMO.map(c => (
                  <option key={c.value} value={c.value}>{c.emoji} {c.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Unidad *</label>
              <select className="input" value={form.unidad}
                onChange={e => set('unidad', e.target.value)}>
                {UNIDADES.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
          </div>

          {/* Precio + Proveedor */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Precio por {form.unidad} ($) *</label>
              <input className="input" type="number" min="0" step="1" value={form.precio}
                onChange={e => set('precio', parseFloat(e.target.value) || 0)} required />
            </div>
            <div>
              <label className="label">Proveedor recomendado</label>
              <input className="input" value={form.proveedor}
                onChange={e => set('proveedor', e.target.value)}
                placeholder="Opcional" />
            </div>
          </div>

          {/* Gramaje por unidad (solo para insumos no-peso) */}
          {!['g', 'kg', 'ml', 'lt'].includes(form.unidad) && (
            <div>
              <label className="label">Peso por unidad (g)</label>
              <input className="input" type="number" min="0" step="1"
                value={form.gramaje}
                onChange={e => set('gramaje', parseFloat(e.target.value) || 0)} />
              <p className="text-xs text-gray-400 mt-1">Para sumar al peso total del plato</p>
            </div>
          )}

          {/* Merma + Variación */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Merma en crudo (%)</label>
              <input className="input" type="number" min="0" max="100" step="0.1"
                value={form.merma_crudo}
                onChange={e => set('merma_crudo', parseFloat(e.target.value) || 0)} />
              <p className="text-xs text-gray-400 mt-1">Pérdida al limpiar/pelar</p>
            </div>
            <div>
              <label className="label">Variación post-cocción (%)</label>
              <input className="input" type="number" min="-100" max="300" step="0.1"
                value={form.variacion_coccion}
                onChange={e => set('variacion_coccion', parseFloat(e.target.value) || 0)} />
              <p className="text-xs text-gray-400 mt-1">Negativo = baja peso (carnes). Positivo = sube (arroz)</p>
            </div>
          </div>

          {/* Calculo preview */}
          <div className="bg-lima-100 rounded-lg p-3 text-xs text-navy-700 space-y-1">
            <p className="font-semibold">Vista previa por kg comprado:</p>
            <p>→ Después de limpiar: <strong>{pesoNeto} kg neto</strong></p>
            <p>→ Después de cocinar: <strong>{pesoCocido} kg utilizable</strong></p>
            {form.precio > 0 && (
              <p className="pt-1 border-t border-lima-300 font-semibold text-navy-800">
                💰 Precio real/kg neto: <strong>{formatPrecio(Math.round(precioReal))}</strong>
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">
              Cancelar
            </button>
            <button type="submit" className="btn-primary flex-1">
              {insumo ? 'Guardar cambios' : 'Agregar insumo'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Modal Historial ─────────────────────────────────────────────────────────

function HistorialModal({ insumo, historial, onClose, onAddPrecio }: {
  insumo: Insumo
  historial: HistorialPrecio[]
  onClose: () => void
  onAddPrecio: (precio: number, nota?: string) => void
}) {
  const [nuevoPrecio, setNuevoPrecio] = useState('')
  const [nota, setNota] = useState('')

  const handle = (e: React.FormEvent) => {
    e.preventDefault()
    const p = parseFloat(nuevoPrecio)
    if (!p) return
    onAddPrecio(p, nota || undefined)
    setNuevoPrecio('')
    setNota('')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="font-semibold text-gray-900">Historial de precios</h2>
            <p className="text-sm text-gray-500">{insumo.nombre}</p>
          </div>
          <button onClick={onClose} className="btn-ghost p-1.5"><X className="w-4 h-4" /></button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {/* Lista */}
          <div className="space-y-2 max-h-56 overflow-y-auto">
            {historial.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-4">Sin registros aún</p>
            )}
            {[...historial].reverse().map(h => (
              <div key={h.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                <div>
                  <p className="text-sm font-medium text-gray-800">{formatPrecio(h.precio)}</p>
                  {h.nota && <p className="text-xs text-gray-400">{h.nota}</p>}
                </div>
                <p className="text-xs text-gray-400">{new Date(h.fecha).toLocaleDateString('es-AR')}</p>
              </div>
            ))}
          </div>

          {/* Agregar nuevo */}
          <form onSubmit={handle} className="border-t border-gray-100 pt-4 space-y-3">
            <p className="text-sm font-medium text-gray-700">Registrar nuevo precio</p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="label">Precio ($)</label>
                <input className="input" type="number" min="0" value={nuevoPrecio}
                  onChange={e => setNuevoPrecio(e.target.value)} placeholder="0" required />
              </div>
              <div>
                <label className="label">Nota (opcional)</label>
                <input className="input" value={nota}
                  onChange={e => setNota(e.target.value)} placeholder="Ej: aumento mayo" />
              </div>
            </div>
            <button type="submit" className="btn-primary w-full">
              <TrendingUp className="w-4 h-4" /> Registrar
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

// ─── Modal Importar Excel ─────────────────────────────────────────────────────

const CATEGORIAS_VALIDAS = CATEGORIAS_INSUMO.map(c => c.value)
const UNIDADES_VALIDAS   = UNIDADES

interface FilaImport {
  nombre: string
  categoria: string
  precio: number
  unidad: string
  proveedor?: string
  merma_crudo: number
  variacion_coccion: number
  error?: string
}

function ImportModal({ onImport, onClose }: {
  onImport: (filas: FilaImport[]) => void
  onClose: () => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [filas, setFilas]   = useState<FilaImport[]>([])
  const [error, setError]   = useState<string | null>(null)

  const parsearFilas = (rows: Record<string, unknown>[]): FilaImport[] =>
    rows.map(row => {
      const nombre   = String(row['nombre']   ?? row['Nombre']   ?? '').trim()
      const categoria = String(row['categoria'] ?? row['Categoría'] ?? row['Categoria'] ?? 'otros').trim().toLowerCase()
      const precio   = parseFloat(String(row['precio']   ?? row['Precio']   ?? '0').replace(',', '.')) || 0
      const unidad   = String(row['unidad']   ?? row['Unidad']   ?? 'kg').trim().toLowerCase()
      const proveedor = String(row['proveedor'] ?? row['Proveedor'] ?? '').trim() || undefined
      const merma    = parseFloat(String(row['merma_crudo'] ?? row['merma'] ?? row['Merma'] ?? '0').replace(',', '.')) || 0
      const variacion = parseFloat(String(row['variacion_coccion'] ?? row['variacion'] ?? row['Variación'] ?? '0').replace(',', '.')) || 0

      const errores: string[] = []
      if (!nombre) errores.push('nombre vacío')
      if (!(CATEGORIAS_VALIDAS as string[]).includes(categoria)) errores.push(`categoría inválida: "${categoria}"`)
      if (!UNIDADES_VALIDAS.includes(unidad)) errores.push(`unidad inválida: "${unidad}"`)

      return {
        nombre, precio, proveedor,
        categoria: (CATEGORIAS_VALIDAS as string[]).includes(categoria) ? categoria as CategoriaInsumo : 'otros',
        unidad: UNIDADES_VALIDAS.includes(unidad) ? unidad : 'kg',
        merma_crudo: merma,
        variacion_coccion: variacion,
        error: errores.length ? errores.join(', ') : undefined,
      }
    }).filter(f => f.nombre)

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setError(null)
    const reader = new FileReader()
    reader.onload = ev => {
      try {
        const data = new Uint8Array(ev.target!.result as ArrayBuffer)
        const wb   = XLSX.read(data, { type: 'array' })
        const ws   = wb.Sheets[wb.SheetNames[0]]
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws)
        if (rows.length === 0) { setError('El archivo está vacío.'); return }
        setFilas(parsearFilas(rows))
      } catch { setError('No se pudo leer el archivo. Verificá que sea un .xlsx válido.') }
    }
    reader.readAsArrayBuffer(file)
    if (fileRef.current) fileRef.current.value = ''
  }

  const descargarPlantilla = () => {
    const data = [{ nombre: 'Ej: Lechuga', categoria: 'verduras', precio: 2000, unidad: 'kg', proveedor: 'Lucio', merma_crudo: 30, variacion_coccion: 0 }]
    const ws = XLSX.utils.json_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Insumos')
    XLSX.writeFile(wb, 'plantilla-insumos.xlsx')
  }

  const validas  = filas.filter(f => !f.error)
  const invalidas = filas.filter(f => f.error)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Importar insumos desde Excel</h2>
          <button onClick={onClose} className="btn-ghost p-1.5"><X className="w-4 h-4" /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {/* Instrucciones */}
          <div className="bg-gray-50 rounded-xl p-4 text-sm text-gray-600 space-y-1">
            <p className="font-semibold text-gray-800 mb-2">Columnas del Excel (en cualquier orden):</p>
            <div className="grid grid-cols-2 gap-x-6 gap-y-0.5 text-xs">
              <p><span className="font-mono bg-gray-200 px-1 rounded">nombre</span> — obligatorio</p>
              <p><span className="font-mono bg-gray-200 px-1 rounded">precio</span> — en $ por unidad</p>
              <p><span className="font-mono bg-gray-200 px-1 rounded">categoria</span> — {CATEGORIAS_VALIDAS.join(', ')}</p>
              <p><span className="font-mono bg-gray-200 px-1 rounded">unidad</span> — {UNIDADES_VALIDAS.join(', ')}</p>
              <p><span className="font-mono bg-gray-200 px-1 rounded">proveedor</span> — opcional</p>
              <p><span className="font-mono bg-gray-200 px-1 rounded">merma_crudo</span> — % (ej: 20)</p>
              <p><span className="font-mono bg-gray-200 px-1 rounded">variacion_coccion</span> — % (ej: -30)</p>
            </div>
          </div>

          {/* Acciones */}
          <div className="flex gap-2">
            <button className="btn-secondary flex-1" onClick={descargarPlantilla}>
              <Download className="w-4 h-4" /> Descargar plantilla
            </button>
            <button className="btn-primary flex-1" onClick={() => fileRef.current?.click()}>
              <Upload className="w-4 h-4" /> Subir Excel
            </button>
            <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFile} />
          </div>

          {error && (
            <div className="flex gap-2 p-3 bg-red-50 rounded-lg text-sm text-red-700">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /> {error}
            </div>
          )}

          {/* Preview */}
          {filas.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle className="w-4 h-4 text-green-500" />
                <span className="text-green-700 font-medium">{validas.length} filas válidas</span>
                {invalidas.length > 0 && (
                  <span className="text-orange-600 ml-2">· {invalidas.length} con advertencias (se importarán con valores por defecto)</span>
                )}
              </div>
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      <th className="text-left px-3 py-2 font-medium text-gray-500">Nombre</th>
                      <th className="text-left px-3 py-2 font-medium text-gray-500">Categoría</th>
                      <th className="text-right px-3 py-2 font-medium text-gray-500">Precio</th>
                      <th className="text-left px-3 py-2 font-medium text-gray-500">Unidad</th>
                      <th className="text-right px-3 py-2 font-medium text-gray-500">Merma</th>
                      <th className="text-right px-3 py-2 font-medium text-gray-500">Var.coc</th>
                      <th className="px-3 py-2"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 max-h-48 overflow-y-auto">
                    {filas.map((f, i) => (
                      <tr key={i} className={f.error ? 'bg-orange-50' : ''}>
                        <td className="px-3 py-2 font-medium text-gray-800">{f.nombre}</td>
                        <td className="px-3 py-2 text-gray-500">{f.categoria}</td>
                        <td className="px-3 py-2 text-right text-gray-700">${f.precio.toLocaleString('es-AR')}</td>
                        <td className="px-3 py-2 text-gray-500">{f.unidad}</td>
                        <td className="px-3 py-2 text-right text-gray-500">{f.merma_crudo}%</td>
                        <td className="px-3 py-2 text-right text-gray-500">{f.variacion_coccion}%</td>
                        <td className="px-3 py-2">
                          {f.error && <span className="text-orange-500" title={f.error}>⚠️</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex gap-2">
          <button onClick={onClose} className="btn-secondary flex-1">Cancelar</button>
          <button
            onClick={() => filas.length > 0 && onImport(filas)}
            disabled={filas.length === 0}
            className="btn-primary flex-1"
          >
            Importar {filas.length > 0 ? `${filas.length} insumos` : ''}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Página principal ────────────────────────────────────────────────────────

export default function Insumos() {
  const { insumos, setInsumos, historial, setHistorial } = useData()

  const [modal, setModal] = useState<'nuevo' | 'editar' | 'historial' | 'importar' | null>(null)
  const [selected, setSelected] = useState<Insumo | null>(null)
  const [catFilter, setCatFilter] = useState<CategoriaInsumo | 'todas'>('todas')
  const [search, setSearch] = useState('')

  const filtered = insumos.filter(i => {
    const matchCat = catFilter === 'todas' || i.categoria === catFilter
    const matchSearch = i.nombre.toLowerCase().includes(search.toLowerCase()) ||
      (i.proveedor ?? '').toLowerCase().includes(search.toLowerCase())
    return matchCat && matchSearch
  })

  const handleSave = (data: Omit<Insumo, 'id' | 'createdAt' | 'updatedAt'>) => {
    const now = new Date().toISOString()
    if (modal === 'editar' && selected) {
      // Snapshot del precio anterior si cambió
      if (data.precio !== selected.precio) {
        setHistorial(h => [...h, {
          id: uuidv4(), insumo_id: selected.id,
          precio: data.precio, fecha: new Date().toISOString().split('T')[0],
          nota: 'Actualización manual',
        }])
      }
      setInsumos(list => list.map(i => i.id === selected.id
        ? { ...i, ...data, updatedAt: now } : i))
    } else {
      const nuevo: Insumo = { ...data, id: uuidv4(), createdAt: now, updatedAt: now }
      setInsumos(list => [...list, nuevo])
      // Primer registro de precio
      setHistorial(h => [...h, {
        id: uuidv4(), insumo_id: nuevo.id,
        precio: data.precio, fecha: now.split('T')[0], nota: 'Precio inicial',
      }])
    }
    setModal(null)
  }

  const handleDelete = (id: string) => {
    if (!confirm('¿Eliminás este insumo?')) return
    setInsumos(list => list.filter(i => i.id !== id))
  }

  const handleAddPrecio = (precio: number, nota?: string) => {
    if (!selected) return
    const now = new Date().toISOString().split('T')[0]
    setHistorial(h => [...h, { id: uuidv4(), insumo_id: selected.id, precio, fecha: now, nota }])
    setInsumos(list => list.map(i => i.id === selected.id
      ? { ...i, precio, updatedAt: new Date().toISOString() } : i))
  }

  const insumoHistorial = selected ? historial.filter(h => h.insumo_id === selected.id) : []

  const handleImport = (filas: FilaImport[]) => {
    const now = new Date().toISOString()
    const nuevos: Insumo[] = filas.map(f => ({
      id: uuidv4(), createdAt: now, updatedAt: now,
      nombre: f.nombre,
      categoria: f.categoria as CategoriaInsumo,
      precio: f.precio,
      unidad: f.unidad,
      proveedor: f.proveedor,
      merma_crudo: f.merma_crudo,
      variacion_coccion: f.variacion_coccion,
    }))
    const nuevosHistorial: HistorialPrecio[] = nuevos.map(n => ({
      id: uuidv4(), insumo_id: n.id,
      precio: n.precio, fecha: now.split('T')[0], nota: 'Importación masiva',
    }))
    setInsumos(list => [...list, ...nuevos])
    setHistorial(h => [...h, ...nuevosHistorial])
    setModal(null)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Insumos</h1>
          <p className="text-sm text-gray-500 mt-0.5">{insumos.length} insumos registrados</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={() => setModal('importar')}>
            <Upload className="w-4 h-4" /> Importar Excel
          </button>
          <button className="btn-primary" onClick={() => { setSelected(null); setModal('nuevo') }}>
            <Plus className="w-4 h-4" /> Nuevo insumo
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="card p-4 flex flex-wrap gap-3 items-center">
        {/* Search */}
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input className="input pl-9" placeholder="Buscar insumo o proveedor..."
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        {/* Cat tabs */}
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setCatFilter('todas')}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              catFilter === 'todas' ? 'bg-lima-400 text-navy-800 font-semibold' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Todas
          </button>
          {CATEGORIAS_INSUMO.map(c => (
            <button
              key={c.value}
              onClick={() => setCatFilter(c.value)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                catFilter === c.value ? 'bg-lima-400 text-navy-800 font-semibold' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {c.emoji} {c.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tabla */}
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className="text-left px-5 py-3 font-medium text-gray-500">Nombre</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Categoría</th>
              <th className="text-right px-4 py-3 font-medium text-gray-500">Precio compra</th>
              <th className="text-right px-4 py-3 font-medium text-gray-500 text-lima-700" style={{ color: '#4a6318' }}>Precio real/kg</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Unidad</th>
              <th className="text-right px-4 py-3 font-medium text-gray-500">Merma crudo</th>
              <th className="text-right px-4 py-3 font-medium text-gray-500">Var. cocción</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Proveedor</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filtered.length === 0 && (
              <tr>
                <td colSpan={9} className="text-center py-12 text-gray-400">
                  No hay insumos que coincidan con la búsqueda
                </td>
              </tr>
            )}
            {filtered.map(ins => {
              const cat = getCategoriaInfo(ins.categoria)
              const yf = yieldFactor(ins.merma_crudo, ins.variacion_coccion)
              const precioReal = precioRealPorKg(ins.precio, ins.merma_crudo, ins.variacion_coccion)
              const tieneAjustes = ins.merma_crudo !== 0 || ins.variacion_coccion !== 0
              return (
                <tr key={ins.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3.5 font-medium text-gray-800">{ins.nombre}</td>
                  <td className="px-4 py-3.5">
                    <span className={`badge ${cat.color}`}>
                      {cat.emoji} {cat.label}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-right font-semibold text-gray-800">
                    {formatPrecio(ins.precio)}
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    {tieneAjustes ? (
                      <span className="font-bold" style={{ color: '#4a6318' }}>
                        {formatPrecio(Math.round(precioReal))}
                      </span>
                    ) : (
                      <span className="text-gray-400 text-xs">= precio compra</span>
                    )}
                    {tieneAjustes && (
                      <span className="block text-xs text-gray-400">
                        rinde {(yf * 100).toFixed(0)}%
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3.5 text-gray-500">{ins.unidad}</td>
                  <td className="px-4 py-3.5 text-right">
                    <span className={`text-sm font-medium ${ins.merma_crudo > 0 ? 'text-orange-600' : 'text-gray-400'}`}>
                      {ins.merma_crudo > 0 ? `-${ins.merma_crudo}%` : '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <span className={`text-sm font-medium ${
                      ins.variacion_coccion < 0 ? 'text-red-500' :
                      ins.variacion_coccion > 0 ? 'text-green-600' : 'text-gray-400'
                    }`}>
                      {ins.variacion_coccion !== 0
                        ? `${ins.variacion_coccion > 0 ? '+' : ''}${ins.variacion_coccion}%`
                        : '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-gray-500 text-sm">{ins.proveedor || '—'}</td>
                  <td className="px-4 py-3.5">
                    <div className="flex gap-1 justify-end">
                      <button
                        className="btn-ghost p-1.5"
                        title="Historial de precios"
                        onClick={() => { setSelected(ins); setModal('historial') }}
                      >
                        <History className="w-3.5 h-3.5" />
                      </button>
                      <button
                        className="btn-ghost p-1.5"
                        title="Editar"
                        onClick={() => { setSelected(ins); setModal('editar') }}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        className="btn-ghost p-1.5 text-red-500 hover:bg-red-50"
                        title="Eliminar"
                        onClick={() => handleDelete(ins.id)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Modals */}
      {(modal === 'nuevo' || modal === 'editar') && (
        <InsumoModal
          insumo={modal === 'editar' ? selected ?? undefined : undefined}
          onSave={handleSave}
          onClose={() => setModal(null)}
        />
      )}
      {modal === 'historial' && selected && (
        <HistorialModal
          insumo={selected}
          historial={insumoHistorial}
          onClose={() => setModal(null)}
          onAddPrecio={handleAddPrecio}
        />
      )}
      {modal === 'importar' && (
        <ImportModal
          onImport={handleImport}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  )
}
