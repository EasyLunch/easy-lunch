import { useState } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { Plus, Pencil, Trash2, X, ChefHat, Search } from 'lucide-react'
import {
  SubReceta, FamiliaSubReceta, IngredienteSubReceta,
  FAMILIAS_SUBRECETA, Insumo, UNIDADES
} from '../types'
import { useData } from '../context/DataContext'
import { precioRealPorKg, toGramos, yieldFactor } from '../utils/costos'

// ─── Modal ───────────────────────────────────────────────────────────────────

interface ModalProps {
  subreceta?: SubReceta
  insumos: Insumo[]
  onSave: (sr: Omit<SubReceta, 'id' | 'createdAt'>) => void
  onClose: () => void
}

function SubRecetaModal({ subreceta, insumos, onSave, onClose }: ModalProps) {
  const [nombre, setNombre] = useState(subreceta?.nombre ?? '')
  const [familia, setFamilia] = useState<FamiliaSubReceta>(subreceta?.familia ?? 'salsa')
  const [rendimiento, setRendimiento] = useState(subreceta?.rendimiento ?? 1)
  const [unidadRendimiento, setUnidadRendimiento] = useState(subreceta?.unidad_rendimiento ?? 'kg')
  const [descripcion, setDescripcion] = useState(subreceta?.descripcion ?? '')
  const [gramajeUnidad, setGramajeUnidad] = useState<number>(subreceta?.gramaje_unidad ?? 0)
  const [ingredientes, setIngredientes] = useState<IngredienteSubReceta[]>(
    subreceta?.ingredientes ?? []
  )

  const addIngrediente = () => {
    if (insumos.length === 0) return
    setIngredientes(prev => [...prev, {
      id: uuidv4(), insumo_id: insumos[0].id, cantidad: 0, unidad: insumos[0].unidad
    }])
  }

  const updateIng = (id: string, field: string, value: string | number | boolean) => {
    setIngredientes(prev => prev.map(i => {
      if (i.id !== id) return i
      if (field === 'insumo_id') {
        const ins = insumos.find(x => x.id === value)
        return { ...i, insumo_id: value as string, unidad: ins?.unidad ?? i.unidad }
      }
      return { ...i, [field]: value }
    }))
  }

  const removeIng = (id: string) => setIngredientes(prev => prev.filter(i => i.id !== id))

  const PESO_UNITS = new Set(['g', 'kg', 'ml', 'lt'])
  const costoTotal = ingredientes.reduce((sum, ing) => {
    const ins = insumos.find(i => i.id === ing.insumo_id)
    if (!ins) return sum
    if (!PESO_UNITS.has(ing.unidad)) {
      return sum + ing.cantidad * ins.precio
    }
    const cantKg = toGramos(ing.cantidad, ing.unidad) / 1000
    return sum + (ing.crudo
      ? ins.precio * cantKg
      : precioRealPorKg(ins.precio, ins.merma_crudo, ins.variacion_coccion) * cantKg)
  }, 0)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!nombre.trim() || ingredientes.length === 0) return
    onSave({ nombre, familia, rendimiento, unidad_rendimiento: unidadRendimiento, gramaje_unidad: gramajeUnidad > 0 ? gramajeUnidad : undefined, ingredientes, descripcion: descripcion.trim() || undefined })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">
            {subreceta ? 'Editar sub-receta' : 'Nueva sub-receta'}
          </h2>
          <button onClick={onClose} className="btn-ghost p-1.5"><X className="w-4 h-4" /></button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Nombre *</label>
              <input className="input" value={nombre} onChange={e => setNombre(e.target.value)}
                placeholder="Ej: Salsa criolla" required />
            </div>
            <div>
              <label className="label">Familia *</label>
              <select className="input" value={familia}
                onChange={e => setFamilia(e.target.value as FamiliaSubReceta)}>
                {FAMILIAS_SUBRECETA.map(f => (
                  <option key={f.value} value={f.value}>{f.emoji} {f.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Rendimiento</label>
              <input className="input" type="number" min="0.001" step="0.001"
                value={rendimiento}
                onChange={e => setRendimiento(parseFloat(e.target.value) || 1)} />
            </div>
            <div>
              <label className="label">Unidad de rendimiento</label>
              <select className="input" value={unidadRendimiento}
                onChange={e => setUnidadRendimiento(e.target.value)}>
                {UNIDADES.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
          </div>

          {unidadRendimiento === 'unidad' && (
            <div>
              <label className="label">Peso por unidad (g)</label>
              <input className="input" type="number" min="0" step="1"
                value={gramajeUnidad}
                onChange={e => setGramajeUnidad(parseFloat(e.target.value) || 0)} />
              <p className="text-xs text-gray-400 mt-1">Peso en gramos de cada unidad producida (para calcular gramaje total del plato)</p>
            </div>
          )}

          <div>
            <label className="label">Paso a paso / Descripción</label>
            <textarea
              className="input resize-none"
              rows={4}
              placeholder="Ej: 1. Picar la cebolla finamente. 2. Rehogar en aceite a fuego medio..."
              value={descripcion}
              onChange={e => setDescripcion(e.target.value)}
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="label mb-0">Ingredientes *</label>
              <button type="button" onClick={addIngrediente}
                className="btn-ghost text-xs py-1 px-2">
                <Plus className="w-3 h-3" /> Agregar
              </button>
            </div>

            {ingredientes.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-4 border border-dashed border-gray-200 rounded-lg">
                Agregá al menos un ingrediente
              </p>
            )}

            <div className="space-y-2">
              {ingredientes.map(ing => {
                const ins = insumos.find(i => i.id === ing.insumo_id)
                const cantKg = ins ? toGramos(ing.cantidad, ing.unidad) / 1000 : 0
                const esPeso = ['g', 'kg', 'ml', 'lt'].includes(ing.unidad)
                const subtotal = ins
                  ? esPeso
                    ? ing.crudo
                      ? ins.precio * cantKg
                      : precioRealPorKg(ins.precio, ins.merma_crudo, ins.variacion_coccion) * cantKg
                    : ing.cantidad * ins.precio
                  : 0
                const pesoCocidoG = ins && ing.crudo && esPeso
                  ? toGramos(ing.cantidad, ing.unidad) * yieldFactor(ins.merma_crudo, ins.variacion_coccion)
                  : null
                return (
                  <div key={ing.id} className="bg-gray-50 rounded-lg p-2">
                    <div className="flex gap-2 items-center">
                      <select className="input text-sm flex-1"
                        value={ing.insumo_id}
                        onChange={e => updateIng(ing.id, 'insumo_id', e.target.value)}>
                        {insumos.map(i => (
                          <option key={i.id} value={i.id}>{i.nombre} ({i.unidad})</option>
                        ))}
                      </select>
                      <input className="input text-sm w-24" type="number" min="0" step="0.001"
                        placeholder="Cant." value={ing.cantidad}
                        onChange={e => updateIng(ing.id, 'cantidad', parseFloat(e.target.value) || 0)} />
                      <select className="input text-sm w-20"
                        value={ing.unidad}
                        onChange={e => updateIng(ing.id, 'unidad', e.target.value)}>
                        {UNIDADES.map(u => <option key={u} value={u}>{u}</option>)}
                      </select>
                      {esPeso && (
                        <button
                          type="button"
                          onClick={() => updateIng(ing.id, 'crudo', !ing.crudo)}
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
                      <span className="text-xs text-gray-500 w-20 text-right shrink-0">
                        ${subtotal.toLocaleString('es-AR', { maximumFractionDigits: 0 })}
                      </span>
                      <button type="button" onClick={() => removeIng(ing.id)}
                        className="btn-ghost p-1 text-red-400 hover:bg-red-50">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    {pesoCocidoG !== null && ing.cantidad > 0 && (
                      <p className="text-xs text-orange-600 mt-1 ml-1">
                        → rinde aprox. <strong>{pesoCocidoG >= 1000 ? (pesoCocidoG / 1000).toFixed(3) + ' kg' : pesoCocidoG.toFixed(0) + ' g'}</strong> cocido
                      </p>
                    )}
                  </div>
                )
              })}
            </div>

            {ingredientes.length > 0 && (
              <div className="flex justify-end mt-2">
                <p className="text-sm font-semibold text-navy-700">
                  Costo total: ${costoTotal.toLocaleString('es-AR', { maximumFractionDigits: 0 })}
                  {rendimiento > 0 && (
                    <span className="font-normal text-gray-500 ml-2">
                      (${(costoTotal / rendimiento).toLocaleString('es-AR', { maximumFractionDigits: 0 })}
                      /{unidadRendimiento})
                    </span>
                  )}
                </p>
              </div>
            )}
          </div>

          <div className="flex gap-2 pt-2 border-t border-gray-100">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancelar</button>
            <button type="submit" className="btn-primary flex-1">
              {subreceta ? 'Guardar cambios' : 'Crear sub-receta'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Página ──────────────────────────────────────────────────────────────────

export default function SubRecetas() {
  const { subrecetas, setSubrecetas, insumos } = useData()

  const [modal, setModal] = useState<'nuevo' | 'editar' | null>(null)
  const [selected, setSelected] = useState<SubReceta | null>(null)
  const [filtroFamilia, setFiltroFamilia] = useState<FamiliaSubReceta | 'todas'>('todas')
  const [busqueda, setBusqueda] = useState('')

  const filtered = subrecetas.filter(sr => {
    const pasaFamilia = filtroFamilia === 'todas' || sr.familia === filtroFamilia
    if (!busqueda.trim()) return pasaFamilia
    const q = busqueda.toLowerCase().trim()
    const nombreMatch = sr.nombre.toLowerCase().includes(q)
    const ingMatch = sr.ingredientes.some(ing =>
      insumos.find(i => i.id === ing.insumo_id)?.nombre.toLowerCase().includes(q)
    )
    return pasaFamilia && (nombreMatch || ingMatch)
  })

  const calcularCosto = (sr: SubReceta) => {
    const PESO = new Set(['g', 'kg', 'ml', 'lt'])
    return sr.ingredientes.reduce((sum, ing) => {
      const ins = insumos.find(i => i.id === ing.insumo_id)
      if (!ins) return sum
      if (!PESO.has(ing.unidad)) return sum + ing.cantidad * ins.precio
      const cantKg = toGramos(ing.cantidad, ing.unidad) / 1000
      return sum + (ing.crudo
        ? ins.precio * cantKg
        : precioRealPorKg(ins.precio, ins.merma_crudo, ins.variacion_coccion) * cantKg)
    }, 0)
  }

  const handleSave = (data: Omit<SubReceta, 'id' | 'createdAt'>) => {
    const now = new Date().toISOString()
    if (modal === 'editar' && selected) {
      setSubrecetas(list => list.map(sr => sr.id === selected.id
        ? { ...sr, ...data } : sr))
    } else {
      setSubrecetas(list => [...list, { ...data, id: uuidv4(), createdAt: now }])
    }
    setModal(null)
  }

  const handleDelete = (id: string) => {
    if (!confirm('¿Eliminás esta sub-receta?')) return
    setSubrecetas(list => list.filter(sr => sr.id !== id))
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Sub-recetas</h1>
          <p className="text-sm text-gray-500 mt-0.5">{subrecetas.length} sub-recetas registradas</p>
        </div>
        <button className="btn-primary" onClick={() => { setSelected(null); setModal('nuevo') }}>
          <Plus className="w-4 h-4" /> Nueva sub-receta
        </button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        <input
          className="input pl-9 text-sm"
          placeholder="Buscar por nombre o ingrediente…"
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setFiltroFamilia('todas')}
          className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
            filtroFamilia === 'todas' ? 'bg-lima-400 text-navy-800 font-semibold' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          Todas
        </button>
        {FAMILIAS_SUBRECETA.map(f => (
          <button
            key={f.value}
            onClick={() => setFiltroFamilia(f.value)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              filtroFamilia === f.value ? 'bg-lima-400 text-navy-800 font-semibold' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {f.emoji} {f.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="card p-12 text-center text-gray-400">
          <ChefHat className="w-8 h-8 mx-auto mb-3 opacity-30" />
          <p>{busqueda.trim() ? `Sin resultados para "${busqueda}"` : 'No hay sub-recetas aún'}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(sr => {
            const fam = FAMILIAS_SUBRECETA.find(f => f.value === sr.familia)!
            const costo = calcularCosto(sr)
            const costoPorUnidad = sr.rendimiento > 0 ? costo / sr.rendimiento : 0
            return (
              <div key={sr.id} className="card p-5 space-y-3 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-gray-800">{sr.nombre}</h3>
                    <span className={`badge mt-1 ${fam.color}`}>
                      {fam.emoji} {fam.label}
                    </span>
                  </div>
                  <div className="flex gap-1">
                    <button className="btn-ghost p-1.5"
                      onClick={() => { setSelected(sr); setModal('editar') }}>
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button className="btn-ghost p-1.5 text-red-500 hover:bg-red-50"
                      onClick={() => handleDelete(sr.id)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {sr.descripcion && (
                  <p className="text-xs text-gray-500 leading-relaxed line-clamp-3">{sr.descripcion}</p>
                )}

                <div className="space-y-1">
                  {sr.ingredientes.map(ing => {
                    const ins = insumos.find(i => i.id === ing.insumo_id)
                    return (
                      <div key={ing.id} className="flex justify-between text-xs text-gray-500">
                        <span>{ins?.nombre ?? 'Insumo eliminado'}</span>
                        <span>{ing.cantidad} {ing.unidad}</span>
                      </div>
                    )
                  })}
                </div>

                <div className="pt-2 border-t border-gray-100 flex justify-between items-center text-xs">
                  <span className="text-gray-400">
                    Rinde {sr.rendimiento} {sr.unidad_rendimiento}
                  </span>
                  <span className="font-semibold text-navy-700">
                    ${costoPorUnidad.toLocaleString('es-AR', { maximumFractionDigits: 0 })}/{sr.unidad_rendimiento}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {(modal === 'nuevo' || modal === 'editar') && (
        <SubRecetaModal
          subreceta={modal === 'editar' ? selected ?? undefined : undefined}
          insumos={insumos}
          onSave={handleSave}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  )
}
