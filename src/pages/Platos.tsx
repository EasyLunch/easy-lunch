import { useState, useRef } from 'react'
import { v4 as uuidv4 } from 'uuid'
import * as XLSX from 'xlsx'
import { Plus, Pencil, Trash2, X, UtensilsCrossed, Scale, DollarSign, Upload, Download, CheckCircle, AlertCircle, Camera, Printer } from 'lucide-react'
import {
  Plato, TipoPlato, IngredientePlato, TipoIngredientePlato,
  TIPOS_PLATO, Insumo, SubReceta, UNIDADES
} from '../types'
import { useData } from '../context/DataContext'
import { precioRealPorKg, toGramos, yieldFactor } from '../utils/costos'

// ─── Lógica de cálculo ───────────────────────────────────────────────────────

function calcularCostoIngrediente(ing: IngredientePlato, insumos: Insumo[], subrecetas: SubReceta[]): number {
  if (ing.tipo === 'insumo') {
    const ins = insumos.find(i => i.id === ing.ref_id)
    if (!ins) return 0
    const PESO_UNITS = new Set(['g', 'kg', 'ml', 'lt'])
    if (PESO_UNITS.has(ing.unidad)) {
      const cantKg = toGramos(ing.cantidad, ing.unidad) / 1000
      // Crudo: precio bruto × kg crudos; Cocido: precioRealPorKg × kg netos
      return ing.crudo
        ? ins.precio * cantKg
        : precioRealPorKg(ins.precio, ins.merma_crudo, ins.variacion_coccion) * cantKg
    } else {
      return ing.cantidad * ins.precio
    }
  } else {
    const sr = subrecetas.find(s => s.id === ing.ref_id)
    if (!sr) return 0
    const costoSr = sr.ingredientes.reduce((sum, srIng) => {
      const ins = insumos.find(i => i.id === srIng.insumo_id)
      if (!ins) return sum
      const cantKg = toGramos(srIng.cantidad, srIng.unidad) / 1000
      return sum + (srIng.crudo
        ? ins.precio * cantKg
        : precioRealPorKg(ins.precio, ins.merma_crudo, ins.variacion_coccion) * cantKg)
    }, 0)
    const cantG = toGramos(ing.cantidad, ing.unidad)
    const rendG = toGramos(sr.rendimiento, sr.unidad_rendimiento)
    const ratio = rendG > 0 ? cantG / rendG : 0
    return ratio * costoSr
  }
}

function calcularPlato(plato: Plato, insumos: Insumo[], subrecetas: SubReceta[]) {
  let costoTotal = 0
  let pesoTotal = 0

  for (const ing of plato.ingredientes) {
    if (ing.tipo === 'insumo') {
      const ins = insumos.find(i => i.id === ing.ref_id)
      if (!ins) continue
      const PESO_UNITS = new Set(['g', 'kg', 'ml', 'lt'])
      if (PESO_UNITS.has(ing.unidad)) {
        const cantG  = toGramos(ing.cantidad, ing.unidad)
        const cantKg = cantG / 1000
        if (ing.crudo) {
          // Cantidad en crudo: costo = precio bruto × kg crudos; peso cocido = kg × yieldFactor
          costoTotal += ins.precio * cantKg
          pesoTotal  += cantG * yieldFactor(ins.merma_crudo, ins.variacion_coccion)
        } else {
          costoTotal += precioRealPorKg(ins.precio, ins.merma_crudo, ins.variacion_coccion) * cantKg
          pesoTotal  += cantG
        }
      } else {
        // Unidad, docena, atado, sobre: precio por unidad × cantidad
        costoTotal += ing.cantidad * ins.precio
      }
    } else {
      const sr = subrecetas.find(s => s.id === ing.ref_id)
      if (!sr) continue
      const costoSr = sr.ingredientes.reduce((sum, srIng) => {
        const ins = insumos.find(i => i.id === srIng.insumo_id)
        if (!ins) return sum
        const cantKg = toGramos(srIng.cantidad, srIng.unidad) / 1000
        return sum + precioRealPorKg(ins.precio, ins.merma_crudo, ins.variacion_coccion) * cantKg
      }, 0)
      const cantG = toGramos(ing.cantidad, ing.unidad)
      const rendG = toGramos(sr.rendimiento, sr.unidad_rendimiento)
      const ratio = rendG > 0 ? cantG / rendG : 0
      costoTotal += ratio * costoSr
      pesoTotal  += cantG
    }
  }

  return {
    costoTotal,
    costoPorVianda: plato.porciones > 0 ? costoTotal / plato.porciones : 0,
    pesoPorVianda:  plato.porciones > 0 ? pesoTotal  / plato.porciones : 0,
  }
}

// ─── Imprimir PDF ─────────────────────────────────────────────────────────────

function imprimirRecetaPDF(
  plato: Plato,
  insumos: Insumo[],
  subrecetas: SubReceta[],
  calc: ReturnType<typeof calcularPlato>
): void {
  const tp = TIPOS_PLATO.find(t => t.value === plato.tipo)!
  const win = window.open('', '_blank')
  if (!win) return

  const fotoHTML = plato.foto
    ? '<img src="' + plato.foto + '" class="foto" alt="Foto del plato" />'
    : '<div class="foto-ph">Sin foto</div>'

  const ingredientesHTML = plato.ingredientes.map(ing => {
    if (ing.tipo === 'insumo') {
      const ins = insumos.find(i => i.id === ing.ref_id)
      const nombre = ins?.nombre ?? 'Insumo eliminado'
      return '<tr><td>' + nombre + '</td><td class="tipo insumo">Insumo</td><td class="cant">' + ing.cantidad + ' ' + ing.unidad + '</td></tr>'
    } else {
      const sr = subrecetas.find(s => s.id === ing.ref_id)
      const nombre = sr?.nombre ?? 'Sub-receta eliminada'
      return '<tr><td>' + nombre + '</td><td class="tipo sub">Sub-receta</td><td class="cant">' + ing.cantidad + ' ' + ing.unidad + '</td></tr>'
    }
  }).join('')

  const costoTotal     = calc.costoTotal.toLocaleString('es-AR', { maximumFractionDigits: 0 })
  const costoPorVianda = calc.costoPorVianda.toLocaleString('es-AR', { maximumFractionDigits: 0 })
  const pesoPorVianda  = calc.pesoPorVianda.toFixed(0)
  const fecha          = new Date().toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })

  const html = '<!DOCTYPE html>\n' +
    '<html lang="es"><head><meta charset="UTF-8">' +
    '<title>' + plato.nombre + ' — Receta Easy Lunch</title>' +
    '<style>' +
    '* { box-sizing: border-box; margin: 0; padding: 0; }' +
    'body { font-family: Arial, sans-serif; padding: 32px; color: #1a2b3c; font-size: 13px; }' +
    '.header { display: flex; gap: 20px; align-items: flex-start; border-bottom: 3px solid #ACE149; padding-bottom: 16px; margin-bottom: 20px; }' +
    '.foto { width: 160px; height: 120px; object-fit: cover; border-radius: 8px; flex-shrink: 0; }' +
    '.foto-ph { width: 160px; height: 120px; background: #f3f4f6; border-radius: 8px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; color: #bbb; font-size: 11px; }' +
    '.meta h1 { font-size: 20px; font-weight: 700; margin-bottom: 6px; }' +
    '.badge { display: inline-block; padding: 2px 10px; border-radius: 999px; background: #f0fad5; color: #4a6318; font-size: 11px; font-weight: 600; margin-bottom: 8px; }' +
    '.porciones { font-size: 12px; color: #666; }' +
    '.stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 20px; }' +
    '.stat { background: #f8f9fa; border-radius: 8px; padding: 12px; text-align: center; }' +
    '.stat-label { font-size: 10px; color: #888; text-transform: uppercase; letter-spacing: .5px; margin-bottom: 4px; }' +
    '.stat-value { font-size: 17px; font-weight: 700; color: #1a2b3c; }' +
    'h2 { font-size: 11px; text-transform: uppercase; letter-spacing: .8px; color: #999; font-weight: 600; margin-bottom: 8px; }' +
    'table { width: 100%; border-collapse: collapse; }' +
    'th { background: #f3f4f6; padding: 7px 12px; text-align: left; font-size: 11px; color: #666; font-weight: 600; }' +
    'td { padding: 8px 12px; border-bottom: 1px solid #f0f0f0; }' +
    'td.cant { font-weight: 600; text-align: right; }' +
    'td.tipo { text-align: center; }' +
    '.insumo { color: #2563eb; font-size: 11px; }' +
    '.sub { color: #7c3aed; font-size: 11px; }' +
    '.paso-paso { margin-top: 24px; }' +
    '.paso-paso p { font-size: 13px; color: #333; line-height: 1.7; background: #f8f9fa; border-radius: 8px; padding: 12px 16px; }' +
    '.footer { margin-top: 28px; text-align: center; font-size: 10px; color: #bbb; }' +
    '@media print { body { padding: 15px; } }' +
    '</style></head><body>' +
    '<div class="header">' + fotoHTML +
    '<div class="meta"><h1>' + plato.nombre + '</h1>' +
    '<div class="badge">' + tp.emoji + ' ' + tp.label + '</div>' +
    '<div class="porciones">Rinde <strong>' + plato.porciones + '</strong> porciones</div>' +
    '</div></div>' +
    '<div class="stats">' +
    '<div class="stat"><div class="stat-label">Costo total</div><div class="stat-value">$' + costoTotal + '</div></div>' +
    '<div class="stat"><div class="stat-label">Costo / vianda</div><div class="stat-value">$' + costoPorVianda + '</div></div>' +
    '<div class="stat"><div class="stat-label">Peso / vianda cocido</div><div class="stat-value">' + pesoPorVianda + ' g</div></div>' +
    '</div>' +
    '<h2>Ingredientes</h2>' +
    '<table><thead><tr><th>Nombre</th><th style="text-align:center">Tipo</th><th style="text-align:right">Cantidad</th></tr></thead>' +
    '<tbody>' + ingredientesHTML + '</tbody></table>' +
    (plato.descripcion
      ? '<div class="paso-paso"><h2>Paso a paso</h2><p>' + plato.descripcion.replace(/\n/g, '<br>') + '</p></div>'
      : '') +
    '<div class="footer">Easy Lunch · Generado el ' + fecha + '</div>' +
    '</body></html>'

  win.document.write(html)
  win.document.close()
  win.focus()
  setTimeout(() => win.print(), 400)
}

// ─── Import Modal ─────────────────────────────────────────────────────────────

interface FilaImportPlato {
  plato:       string
  tipo:        string
  porciones:   number
  ingrediente: string
  cantidad:    number
  unidad:      string
  insumo_id?:  string
  error?:      string
}

interface RecetaImport {
  nombre:       string
  tipo:         TipoPlato
  porciones:    number
  ingredientes: { insumo_id: string; cantidad: number; unidad: string }[]
  warnings:     string[]
}

const TIPOS_VALIDOS = TIPOS_PLATO.map(t => t.value)

function parsearFilasPlato(rows: Record<string, unknown>[], insumos: Insumo[]): FilaImportPlato[] {
  return rows.map(r => {
    const plato       = String(r['plato']       ?? r['Plato']       ?? '').trim()
    const tipoRaw     = String(r['tipo']        ?? r['Tipo']        ?? 'clasico').trim().toLowerCase()
    const porciones   = Number(r['porciones']   ?? r['Porciones']   ?? 10) || 10
    const ingrediente = String(r['ingrediente'] ?? r['Ingrediente'] ?? '').trim()
    const cantidad    = Number(r['cantidad']    ?? r['Cantidad']    ?? 0) || 0
    const unidad      = String(r['unidad']      ?? r['Unidad']      ?? 'g').trim().toLowerCase()

    if (!plato)        return { plato, tipo: tipoRaw, porciones, ingrediente, cantidad, unidad, error: 'Falta nombre del plato' }
    if (!ingrediente)  return { plato, tipo: tipoRaw, porciones, ingrediente, cantidad, unidad, error: 'Falta nombre del ingrediente' }
    if (cantidad <= 0) return { plato, tipo: tipoRaw, porciones, ingrediente, cantidad, unidad, error: 'Cantidad inválida' }

    const insumo = insumos.find(i => i.nombre.toLowerCase() === ingrediente.toLowerCase())

    return {
      plato,
      tipo:      (TIPOS_VALIDOS as string[]).includes(tipoRaw) ? tipoRaw : 'clasico',
      porciones,
      ingrediente,
      cantidad,
      unidad:    UNIDADES.includes(unidad) ? unidad : 'g',
      insumo_id: insumo?.id,
      error:     insumo ? undefined : `Insumo "${ingrediente}" no encontrado`,
    }
  })
}

function agruparRecetas(filas: FilaImportPlato[]): RecetaImport[] {
  const map: Record<string, RecetaImport> = {}

  for (const f of filas) {
    if (!f.plato) continue
    if (!map[f.plato]) {
      map[f.plato] = {
        nombre:      f.plato,
        tipo:        ((TIPOS_VALIDOS as string[]).includes(f.tipo) ? f.tipo : 'clasico') as TipoPlato,
        porciones:   f.porciones,
        ingredientes: [],
        warnings:    [],
      }
    }
    if (f.insumo_id) {
      map[f.plato].ingredientes.push({ insumo_id: f.insumo_id, cantidad: f.cantidad, unidad: f.unidad })
    } else if (f.ingrediente) {
      map[f.plato].warnings.push(`Ingrediente "${f.ingrediente}" no encontrado — omitido`)
    }
  }

  return Object.values(map)
}

function ImportModal({ insumos, onImport, onClose }: {
  insumos:   Insumo[]
  onImport:  (recetas: RecetaImport[]) => void
  onClose:   () => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [filas, setFilas] = useState<FilaImportPlato[]>([])
  const [error, setError] = useState<string | null>(null)
  const [step, setStep]   = useState<'upload' | 'preview'>('upload')

  const descargarPlantilla = () => {
    const data = [
      { plato: 'Milanesa napolitana', tipo: 'clasico',   porciones: 10, ingrediente: 'Peceto',        cantidad: 2,   unidad: 'kg' },
      { plato: 'Milanesa napolitana', tipo: 'clasico',   porciones: 10, ingrediente: 'Tomate perita', cantidad: 0.5, unidad: 'kg' },
      { plato: 'Milanesa napolitana', tipo: 'clasico',   porciones: 10, ingrediente: 'Mozzarella',    cantidad: 0.4, unidad: 'kg' },
      { plato: 'Ensalada César',      tipo: 'ensalada',  porciones: 8,  ingrediente: 'Lechuga',        cantidad: 0.6, unidad: 'kg' },
      { plato: 'Ensalada César',      tipo: 'ensalada',  porciones: 8,  ingrediente: 'Pollo',          cantidad: 0.8, unidad: 'kg' },
    ]
    const ws = XLSX.utils.json_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Recetas')
    XLSX.writeFile(wb, 'plantilla-recetas.xlsx')
  }

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
        setFilas(parsearFilasPlato(rows, insumos))
        setStep('preview')
      } catch { setError('No se pudo leer el archivo. Verificá que sea .xlsx válido.') }
    }
    reader.readAsArrayBuffer(file)
    if (fileRef.current) fileRef.current.value = ''
  }

  const recetas     = agruparRecetas(filas)
  const conIngr     = recetas.filter(r => r.ingredientes.length > 0)
  const sinIngr     = recetas.filter(r => r.ingredientes.length === 0)
  const ignorados   = filas.filter(f => f.error).length
  const reconocidos = filas.filter(f => f.insumo_id).length

  const handleConfirm = () => {
    onImport(conIngr)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="font-semibold text-gray-900">Importar recetas desde Excel</h2>
            <p className="text-xs text-gray-400 mt-0.5">Cada fila = un ingrediente de una receta</p>
          </div>
          <button onClick={onClose} className="btn-ghost p-1.5"><X className="w-4 h-4" /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {step === 'upload' && (
            <>
              <div className="bg-gray-50 rounded-xl p-4">
                <p className="text-sm font-medium text-gray-700 mb-2">Columnas requeridas en el Excel:</p>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  {[
                    { col: 'plato',       desc: 'Nombre del plato' },
                    { col: 'tipo',        desc: 'clasico / vegetariano / ensalada / sandwich / wrap / tarta / postre' },
                    { col: 'porciones',   desc: 'Cantidad de porciones' },
                    { col: 'ingrediente', desc: 'Nombre exacto del insumo' },
                    { col: 'cantidad',    desc: 'Cantidad numérica' },
                    { col: 'unidad',      desc: 'kg / g / lt / ml / unidad...' },
                  ].map(({ col, desc }) => (
                    <div key={col} className="bg-white rounded-lg p-2 border border-gray-100">
                      <p className="font-mono font-semibold text-navy-700">{col}</p>
                      <p className="text-gray-400 mt-0.5 leading-tight">{desc}</p>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-gray-400 mt-3">
                  Los nombres de ingredientes deben coincidir con los insumos cargados ({insumos.length} disponibles).
                  Descargá la plantilla para ver el formato correcto.
                </p>
              </div>

              {error && (
                <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 rounded-lg px-3 py-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {error}
                </div>
              )}

              <div className="flex gap-2">
                <button className="btn-secondary flex-1" onClick={descargarPlantilla}>
                  <Download className="w-4 h-4" /> Descargar plantilla
                </button>
                <button className="btn-primary flex-1" onClick={() => fileRef.current?.click()}>
                  <Upload className="w-4 h-4" /> Subir Excel
                </button>
                <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFile} />
              </div>
            </>
          )}

          {step === 'preview' && (
            <>
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-green-50 rounded-xl p-3 text-center">
                  <CheckCircle className="w-5 h-5 mx-auto mb-1 text-green-500" />
                  <p className="text-lg font-bold text-green-800">{conIngr.length}</p>
                  <p className="text-xs text-green-600">Recetas listas</p>
                </div>
                <div className="bg-blue-50 rounded-xl p-3 text-center">
                  <CheckCircle className="w-5 h-5 mx-auto mb-1 text-blue-400" />
                  <p className="text-lg font-bold text-blue-800">{reconocidos}</p>
                  <p className="text-xs text-blue-600">Ingredientes reconocidos</p>
                </div>
                <div className={`rounded-xl p-3 text-center ${ignorados > 0 ? 'bg-orange-50' : 'bg-gray-50'}`}>
                  <AlertCircle className={`w-5 h-5 mx-auto mb-1 ${ignorados > 0 ? 'text-orange-400' : 'text-gray-300'}`} />
                  <p className={`text-lg font-bold ${ignorados > 0 ? 'text-orange-800' : 'text-gray-400'}`}>{ignorados}</p>
                  <p className={`text-xs ${ignorados > 0 ? 'text-orange-600' : 'text-gray-400'}`}>Ingredientes no encontrados</p>
                </div>
              </div>

              <div className="space-y-2 max-h-72 overflow-y-auto">
                {recetas.map((r, i) => {
                  const tp = TIPOS_PLATO.find(t => t.value === r.tipo)
                  const ok = r.ingredientes.length > 0
                  return (
                    <div key={i} className={`rounded-xl border p-3 ${ok ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          {ok
                            ? <CheckCircle className="w-3.5 h-3.5 text-green-500 shrink-0" />
                            : <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                          }
                          <span className="font-medium text-sm text-gray-800">{r.nombre}</span>
                          {tp && <span className={`badge ${tp.color}`}>{tp.emoji} {tp.label}</span>}
                          <span className="text-xs text-gray-400">{r.porciones} porciones</span>
                        </div>
                        <span className="text-xs text-gray-400">{r.ingredientes.length} ingrediente{r.ingredientes.length !== 1 ? 's' : ''}</span>
                      </div>
                      {r.warnings.length > 0 && (
                        <div className="mt-1 space-y-0.5">
                          {r.warnings.map((w, wi) => (
                            <p key={wi} className="text-xs text-orange-600">⚠ {w}</p>
                          ))}
                        </div>
                      )}
                      {!ok && (
                        <p className="text-xs text-red-500 mt-1">Sin ingredientes válidos — no se importará</p>
                      )}
                    </div>
                  )
                })}
              </div>

              {sinIngr.length > 0 && (
                <p className="text-xs text-orange-600 bg-orange-50 rounded-lg px-3 py-2">
                  ⚠ {sinIngr.length} receta{sinIngr.length !== 1 ? 's' : ''} sin ingredientes reconocidos serán ignoradas.
                  Revisá que los nombres de insumos coincidan exactamente.
                </p>
              )}
            </>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex gap-2">
          {step === 'preview' && (
            <button className="btn-secondary" onClick={() => setStep('upload')}>← Volver</button>
          )}
          <button className="btn-secondary flex-1" onClick={onClose}>Cancelar</button>
          {step === 'preview' && conIngr.length > 0 && (
            <button className="btn-primary flex-1" onClick={handleConfirm}>
              <CheckCircle className="w-4 h-4" />
              Importar {conIngr.length} receta{conIngr.length !== 1 ? 's' : ''}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Modal de Plato ──────────────────────────────────────────────────────────

interface ModalProps {
  plato?:     Plato
  insumos:    Insumo[]
  subrecetas: SubReceta[]
  onSave:     (p: Omit<Plato, 'id' | 'createdAt'>) => void
  onClose:    () => void
}

function PlatoModal({ plato, insumos, subrecetas, onSave, onClose }: ModalProps) {
  const [nombre, setNombre]             = useState(plato?.nombre ?? '')
  const [tipo, setTipo]                 = useState<TipoPlato>(plato?.tipo ?? 'clasico')
  const [porciones, setPorciones]       = useState(plato?.porciones ?? 10)
  const [foto, setFoto]                 = useState<string | undefined>(plato?.foto)
  const [descripcion, setDescripcion]   = useState(plato?.descripcion ?? '')
  const [ingredientes, setIngredientes] = useState<IngredientePlato[]>(plato?.ingredientes ?? [])
  const fotoRef                         = useRef<HTMLInputElement>(null)

  const handleFoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => setFoto(ev.target!.result as string)
    reader.readAsDataURL(file)
    if (fotoRef.current) fotoRef.current.value = ''
  }

  const addIng = (t: TipoIngredientePlato) => {
    if (t === 'insumo' && insumos.length === 0) return
    if (t === 'subreceta' && subrecetas.length === 0) return
    setIngredientes(prev => [...prev, {
      id: uuidv4(), tipo: t,
      ref_id: t === 'insumo' ? insumos[0].id : subrecetas[0].id,
      cantidad: 0, unidad: 'g'
    }])
  }

  const upd = (id: string, field: string, value: string | number) =>
    setIngredientes(prev => prev.map(i => i.id === id ? { ...i, [field]: value } : i))

  const rem = (id: string) => setIngredientes(prev => prev.filter(i => i.id !== id))

  const tempPlato: Plato = { id: '', nombre, tipo, porciones, ingredientes, createdAt: '' }
  const calc = calcularPlato(tempPlato, insumos, subrecetas)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!nombre.trim()) return
    onSave({ nombre, tipo, porciones, foto, ingredientes, descripcion: descripcion.trim() || undefined })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">
            {plato ? 'Editar receta' : 'Nueva receta de plato'}
          </h2>
          <button onClick={onClose} className="btn-ghost p-1.5"><X className="w-4 h-4" /></button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="label">Nombre del plato *</label>
              <input className="input" value={nombre} onChange={e => setNombre(e.target.value)}
                placeholder="Ej: Milanesa napolitana con papas" required />
            </div>
            <div>
              <label className="label">Tipo</label>
              <select className="input" value={tipo} onChange={e => setTipo(e.target.value as TipoPlato)}>
                {TIPOS_PLATO.map(t => (
                  <option key={t.value} value={t.value}>{t.emoji} {t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Cantidad de porciones *</label>
              <input className="input" type="number" min="1" value={porciones}
                onChange={e => setPorciones(parseInt(e.target.value) || 1)} required />
            </div>
          </div>

          <div>
            <label className="label">Foto del plato</label>
            <div className="flex items-center gap-3">
              {foto ? (
                <div className="relative w-24 h-20 shrink-0">
                  <img src={foto} alt="Foto" className="w-24 h-20 object-cover rounded-lg border border-gray-200" />
                  <button type="button" onClick={() => setFoto(undefined)}
                    className="absolute -top-1.5 -right-1.5 bg-white border border-gray-200 rounded-full p-0.5 text-red-400 hover:bg-red-50">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <div
                  onClick={() => fotoRef.current?.click()}
                  className="w-24 h-20 flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-200 cursor-pointer hover:border-lima-400 hover:bg-lima-50 transition-colors shrink-0">
                  <Camera className="w-5 h-5 text-gray-300 mb-1" />
                  <span className="text-xs text-gray-400">Subir foto</span>
                </div>
              )}
              <p className="text-xs text-gray-400">
                Foto opcional para identificar el plato. Se mostrará en el detalle y al imprimir la receta.
              </p>
              <input ref={fotoRef} type="file" accept="image/*" className="hidden" onChange={handleFoto} />
            </div>
          </div>

          <div>
            <label className="label">Paso a paso / Descripción</label>
            <textarea
              className="input resize-none"
              rows={4}
              placeholder="Ej: 1. Preparar la salsa... 2. Cocinar la carne a fuego fuerte..."
              value={descripcion}
              onChange={e => setDescripcion(e.target.value)}
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="label mb-0">Ingredientes</label>
              <div className="flex gap-2">
                <button type="button" onClick={() => addIng('insumo')}
                  className="btn-ghost text-xs py-1 px-2">
                  <Plus className="w-3 h-3" /> Insumo
                </button>
                <button type="button" onClick={() => addIng('subreceta')}
                  className="btn-ghost text-xs py-1 px-2">
                  <Plus className="w-3 h-3" /> Sub-receta
                </button>
              </div>
            </div>

            {ingredientes.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-4 border border-dashed border-gray-200 rounded-lg">
                Agregá insumos o sub-recetas
              </p>
            )}

            <div className="space-y-2">
              {ingredientes.map(ing => {
                const costo = calcularCostoIngrediente(ing, insumos, subrecetas)
                const esPeso = ['g', 'kg', 'ml', 'lt'].includes(ing.unidad)
                // Para insumos en crudo: calcular peso cocido resultante
                const pesoCocidoG = ing.tipo === 'insumo' && ing.crudo && esPeso
                  ? (() => {
                      const ins = insumos.find(i => i.id === ing.ref_id)
                      if (!ins) return null
                      return toGramos(ing.cantidad, ing.unidad) * yieldFactor(ins.merma_crudo, ins.variacion_coccion)
                    })()
                  : null
                return (
                  <div key={ing.id} className={`rounded-lg p-2 ${
                    ing.tipo === 'insumo' ? 'bg-blue-50' : 'bg-purple-50'
                  }`}>
                    <div className="flex gap-2 items-center">
                      <span className={`text-xs font-medium px-1.5 py-0.5 rounded shrink-0 ${
                        ing.tipo === 'insumo' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                      }`}>
                        {ing.tipo === 'insumo' ? 'Ins' : 'Sub'}
                      </span>
                      <select className="input text-sm flex-1"
                        value={ing.ref_id}
                        onChange={e => upd(ing.id, 'ref_id', e.target.value)}>
                        {ing.tipo === 'insumo'
                          ? insumos.map(i => <option key={i.id} value={i.id}>{i.nombre} ({i.unidad})</option>)
                          : subrecetas.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)
                        }
                      </select>
                      <input className="input text-sm w-24" type="number" min="0" step="0.001"
                        placeholder="Cant." value={ing.cantidad}
                        onChange={e => upd(ing.id, 'cantidad', parseFloat(e.target.value) || 0)} />
                      <select className="input text-sm w-20"
                        value={ing.unidad}
                        onChange={e => upd(ing.id, 'unidad', e.target.value)}>
                        {UNIDADES.map(u => <option key={u} value={u}>{u}</option>)}
                      </select>
                      {/* Toggle crudo/cocido — solo para insumos con unidad de peso */}
                      {ing.tipo === 'insumo' && esPeso && (
                        <button
                          type="button"
                          onClick={() => upd(ing.id, 'crudo', !ing.crudo)}
                          className={`text-xs font-semibold px-2 py-1 rounded-full border shrink-0 transition-colors ${
                            ing.crudo
                              ? 'bg-orange-100 text-orange-700 border-orange-300'
                              : 'bg-green-100 text-green-700 border-green-300'
                          }`}
                          title={ing.crudo ? 'Cantidad en crudo — clic para cambiar a cocido' : 'Cantidad en cocido — clic para cambiar a crudo'}
                        >
                          {ing.crudo ? '🥩 Crudo' : '✅ Cocido'}
                        </button>
                      )}
                      <div className="w-20 text-right shrink-0">
                        <span className={`text-xs font-semibold ${costo > 0 ? 'text-green-700' : 'text-gray-300'}`}>
                          {costo > 0
                            ? '$' + costo.toLocaleString('es-AR', { maximumFractionDigits: 0 })
                            : '—'
                          }
                        </span>
                      </div>
                      <button type="button" onClick={() => rem(ing.id)}
                        className="btn-ghost p-1 text-red-400 hover:bg-red-50">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    {/* Peso cocido resultante cuando está en modo crudo */}
                    {pesoCocidoG !== null && ing.cantidad > 0 && (
                      <p className="text-xs text-orange-600 mt-1 ml-8">
                        → rinde aprox. <strong>{pesoCocidoG >= 1000 ? (pesoCocidoG / 1000).toFixed(3) + ' kg' : pesoCocidoG.toFixed(0) + ' g'}</strong> cocido
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {ingredientes.length > 0 && (
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-lima-100 rounded-lg p-3 text-center">
                <DollarSign className="w-4 h-4 mx-auto mb-1 text-navy-700" />
                <p className="text-xs text-navy-700">Costo total</p>
                <p className="font-bold text-navy-800 text-sm">
                  ${calc.costoTotal.toLocaleString('es-AR', { maximumFractionDigits: 0 })}
                </p>
              </div>
              <div className="bg-green-50 rounded-lg p-3 text-center">
                <DollarSign className="w-4 h-4 mx-auto mb-1 text-green-500" />
                <p className="text-xs text-green-600">Costo/vianda</p>
                <p className="font-bold text-green-800 text-sm">
                  ${calc.costoPorVianda.toLocaleString('es-AR', { maximumFractionDigits: 0 })}
                </p>
              </div>
              <div className="bg-orange-50 rounded-lg p-3 text-center">
                <Scale className="w-4 h-4 mx-auto mb-1 text-orange-500" />
                <p className="text-xs text-orange-600">Peso/vianda (cocido)</p>
                <p className="font-bold text-orange-800 text-sm">
                  {calc.pesoPorVianda.toFixed(0)} g
                </p>
              </div>
            </div>
          )}

          <div className="flex gap-2 pt-2 border-t border-gray-100">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancelar</button>
            <button type="submit" className="btn-primary flex-1">
              {plato ? 'Guardar cambios' : 'Crear receta'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Modal Detalle ───────────────────────────────────────────────────────────

function DetalleModal({ plato, insumos, subrecetas, onEdit, onClose }: {
  plato:      Plato
  insumos:    Insumo[]
  subrecetas: SubReceta[]
  onEdit:     () => void
  onClose:    () => void
}) {
  const tp   = TIPOS_PLATO.find(t => t.value === plato.tipo)!
  const calc = calcularPlato(plato, insumos, subrecetas)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="font-semibold text-gray-900">{plato.nombre}</h2>
            <span className={`badge mt-1 ${tp.color}`}>{tp.emoji} {tp.label}</span>
          </div>
          <button onClick={onClose} className="btn-ghost p-1.5"><X className="w-4 h-4" /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {plato.foto && (
            <img src={plato.foto} alt={plato.nombre}
              className="w-full h-40 object-cover rounded-xl border border-gray-100" />
          )}

          <div className="grid grid-cols-3 gap-3">
            <div className="bg-gray-50 rounded-xl p-3 text-center">
              <p className="text-xs text-gray-500 mb-1">Porciones</p>
              <p className="font-bold text-gray-800 text-lg">{plato.porciones}</p>
            </div>
            <div className="rounded-xl p-3 text-center" style={{ backgroundColor: '#f4fad5' }}>
              <p className="text-xs mb-1" style={{ color: '#4a6318' }}>Costo/vianda</p>
              <p className="font-bold text-lg" style={{ color: '#2C3B4B' }}>
                ${calc.costoPorVianda.toLocaleString('es-AR', { maximumFractionDigits: 0 })}
              </p>
            </div>
            <div className="bg-orange-50 rounded-xl p-3 text-center">
              <p className="text-xs text-orange-600 mb-1">Peso/vianda</p>
              <p className="font-bold text-orange-800 text-lg">{calc.pesoPorVianda.toFixed(0)} g</p>
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Ingredientes</p>
            <div className="space-y-1.5">
              {plato.ingredientes.map(ing => {
                if (ing.tipo === 'insumo') {
                  const ins = insumos.find(i => i.id === ing.ref_id)
                  return (
                    <div key={ing.id} className="flex items-center justify-between py-2 px-3 bg-blue-50 rounded-lg text-sm">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">Ins</span>
                        <span className="text-gray-700">{ins?.nombre ?? 'Insumo eliminado'}</span>
                      </div>
                      <span className="font-medium text-gray-600">{ing.cantidad} {ing.unidad}</span>
                    </div>
                  )
                } else {
                  const sr = subrecetas.find(s => s.id === ing.ref_id)
                  return (
                    <div key={ing.id} className="flex items-center justify-between py-2 px-3 bg-purple-50 rounded-lg text-sm">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-purple-100 text-purple-700">Sub</span>
                        <span className="text-gray-700">{sr?.nombre ?? 'Sub-receta eliminada'}</span>
                      </div>
                      <span className="font-medium text-gray-600">{ing.cantidad} {ing.unidad}</span>
                    </div>
                  )
                }
              })}
            </div>
          </div>

          <div className="flex justify-between items-center py-3 px-4 rounded-xl border border-gray-100">
            <span className="text-sm text-gray-500">Costo total receta</span>
            <span className="font-bold text-gray-800">
              ${calc.costoTotal.toLocaleString('es-AR', { maximumFractionDigits: 0 })}
            </span>
          </div>

          {plato.descripcion && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Paso a paso</p>
              <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line bg-gray-50 rounded-xl px-4 py-3">
                {plato.descripcion}
              </p>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex gap-2">
          <button onClick={onClose} className="btn-secondary">Cerrar</button>
          <button
            onClick={() => imprimirRecetaPDF(plato, insumos, subrecetas, calc)}
            className="btn-secondary flex items-center gap-1.5">
            <Printer className="w-4 h-4" /> Imprimir / PDF
          </button>
          <button onClick={onEdit} className="btn-primary flex-1">
            <Pencil className="w-4 h-4" /> Editar receta
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Página ──────────────────────────────────────────────────────────────────

export default function Platos() {
  const { platos, setPlatos, insumos, subrecetas } = useData()

  const [modal, setModal]           = useState<'nuevo' | 'editar' | 'detalle' | 'importar' | null>(null)
  const [selected, setSelected]     = useState<Plato | null>(null)
  const [filtroTipo, setFiltroTipo] = useState<TipoPlato | 'todos'>('todos')

  const filtered = platos.filter(p => filtroTipo === 'todos' || p.tipo === filtroTipo)

  const handleSave = (data: Omit<Plato, 'id' | 'createdAt'>) => {
    const now = new Date().toISOString()
    if (modal === 'editar' && selected) {
      setPlatos(list => list.map(p => p.id === selected.id ? { ...p, ...data } : p))
    } else {
      setPlatos(list => [...list, { ...data, id: uuidv4(), createdAt: now }])
    }
    setModal(null)
  }

  const handleDelete = (id: string) => {
    if (!confirm('Eliminas esta receta?')) return
    setPlatos(list => list.filter(p => p.id !== id))
  }

  const handleImport = (recetas: RecetaImport[]) => {
    const now = new Date().toISOString()
    const nuevos: Plato[] = recetas.map(r => ({
      id:        uuidv4(),
      createdAt: now,
      nombre:    r.nombre,
      tipo:      r.tipo,
      porciones: r.porciones,
      ingredientes: r.ingredientes.map(ing => ({
        id:       uuidv4(),
        tipo:     'insumo' as TipoIngredientePlato,
        ref_id:   ing.insumo_id,
        cantidad: ing.cantidad,
        unidad:   ing.unidad,
      })),
    }))
    setPlatos(list => [...list, ...nuevos])
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Recetas de Platos</h1>
          <p className="text-sm text-gray-500 mt-0.5">{platos.length} platos en el menú</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={() => setModal('importar')}>
            <Upload className="w-4 h-4" /> Importar Excel
          </button>
          <button className="btn-primary" onClick={() => { setSelected(null); setModal('nuevo') }}>
            <Plus className="w-4 h-4" /> Nueva receta
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setFiltroTipo('todos')}
          className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
            filtroTipo === 'todos' ? 'bg-lima-400 text-navy-800 font-semibold' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          Todos
        </button>
        {TIPOS_PLATO.map(t => (
          <button
            key={t.value}
            onClick={() => setFiltroTipo(t.value)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              filtroTipo === t.value ? 'bg-lima-400 text-navy-800 font-semibold' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {t.emoji} {t.label}
          </button>
        ))}
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className="text-left px-5 py-3 font-medium text-gray-500">Plato</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Tipo</th>
              <th className="text-right px-4 py-3 font-medium text-gray-500">Porciones</th>
              <th className="text-right px-4 py-3 font-medium text-gray-500">Costo total</th>
              <th className="text-right px-4 py-3 font-medium text-gray-500">Costo/vianda</th>
              <th className="text-right px-4 py-3 font-medium text-gray-500">Peso/vianda</th>
              <th className="text-right px-4 py-3 font-medium text-gray-500">Ingredientes</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="text-center py-12">
                  <UtensilsCrossed className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                  <p className="text-gray-400">No hay platos aún</p>
                </td>
              </tr>
            )}
            {filtered.map(plato => {
              const tp   = TIPOS_PLATO.find(t => t.value === plato.tipo)!
              const calc = calcularPlato(plato, insumos, subrecetas)
              return (
                <tr key={plato.id} className="hover:bg-gray-50 transition-colors cursor-pointer"
                  onClick={() => { setSelected(plato); setModal('detalle') }}>
                  <td className="px-5 py-3.5 font-medium text-gray-800">{plato.nombre}</td>
                  <td className="px-4 py-3.5">
                    <span className={`badge ${tp.color}`}>{tp.emoji} {tp.label}</span>
                  </td>
                  <td className="px-4 py-3.5 text-right text-gray-600">{plato.porciones}</td>
                  <td className="px-4 py-3.5 text-right font-medium text-gray-800">
                    ${calc.costoTotal.toLocaleString('es-AR', { maximumFractionDigits: 0 })}
                  </td>
                  <td className="px-4 py-3.5 text-right font-semibold text-navy-700">
                    ${calc.costoPorVianda.toLocaleString('es-AR', { maximumFractionDigits: 0 })}
                  </td>
                  <td className="px-4 py-3.5 text-right text-gray-600">
                    {calc.pesoPorVianda.toFixed(0)} g
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <span className="badge bg-gray-100 text-gray-600">
                      {plato.ingredientes.length} items
                    </span>
                  </td>
                  <td className="px-4 py-3.5" onClick={e => e.stopPropagation()}>
                    <div className="flex gap-1 justify-end">
                      <button className="btn-ghost p-1.5"
                        onClick={() => { setSelected(plato); setModal('editar') }}>
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button className="btn-ghost p-1.5 text-red-500 hover:bg-red-50"
                        onClick={() => handleDelete(plato.id)}>
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

      {modal === 'detalle' && selected && (
        <DetalleModal
          plato={selected}
          insumos={insumos}
          subrecetas={subrecetas}
          onEdit={() => setModal('editar')}
          onClose={() => setModal(null)}
        />
      )}

      {(modal === 'nuevo' || modal === 'editar') && (
        <PlatoModal
          plato={modal === 'editar' ? selected ?? undefined : undefined}
          insumos={insumos}
          subrecetas={subrecetas}
          onSave={handleSave}
          onClose={() => setModal(null)}
        />
      )}

      {modal === 'importar' && (
        <ImportModal
          insumos={insumos}
          onImport={handleImport}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  )
}
