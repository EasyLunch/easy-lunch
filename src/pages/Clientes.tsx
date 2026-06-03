import { useState } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { Plus, Pencil, Trash2, X, TrendingUp, History, Building2 } from 'lucide-react'
import { Cliente, HistorialPrecioCliente } from '../types'
import { useLocalStorage } from '../hooks/useLocalStorage'

// ─── Modal Cliente ───────────────────────────────────────────────────────────

function ClienteModal({ cliente, onSave, onClose }: {
  cliente?: Cliente
  onSave: (data: Omit<Cliente, 'id' | 'createdAt' | 'updatedAt'>) => void
  onClose: () => void
}) {
  const [nombre, setNombre]     = useState(cliente?.nombre ?? '')
  const [precio, setPrecio]     = useState(cliente?.precio_vianda ?? 0)
  const [precioXL, setPrecioXL] = useState(cliente?.precio_vianda_xl ?? 0)
  const [contacto, setContacto] = useState(cliente?.contacto ?? '')
  const [email, setEmail]       = useState(cliente?.email ?? '')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!nombre.trim()) return
    onSave({
      nombre,
      precio_vianda:    precio,
      precio_vianda_xl: precioXL || undefined,
      contacto: contacto || undefined,
      email:    email    || undefined,
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">
            {cliente ? 'Editar cliente' : 'Nuevo cliente'}
          </h2>
          <button onClick={onClose} className="btn-ghost p-1.5"><X className="w-4 h-4" /></button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div>
            <label className="label">Empresa *</label>
            <input className="input" value={nombre} onChange={e => setNombre(e.target.value)}
              placeholder="Ej: Distrinando" required />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Precio vianda normal ($) *</label>
              <input className="input" type="number" min="0" step="1" value={precio}
                onChange={e => setPrecio(parseFloat(e.target.value) || 0)} required />
            </div>
            <div>
              <label className="label">Precio vianda XL ($)</label>
              <input className="input" type="number" min="0" step="1"
                value={precioXL || ''}
                onChange={e => setPrecioXL(parseFloat(e.target.value) || 0)}
                placeholder="igual que normal" />
            </div>
          </div>
          <p className="text-xs text-gray-400 -mt-2">
            Si no tiene precio XL, las viandas XL se cobran al precio normal.
          </p>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Contacto</label>
              <input className="input" value={contacto} onChange={e => setContacto(e.target.value)}
                placeholder="Nombre del contacto" />
            </div>
            <div>
              <label className="label">Email</label>
              <input className="input" type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="correo@empresa.com" />
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancelar</button>
            <button type="submit" className="btn-primary flex-1">
              {cliente ? 'Guardar cambios' : 'Agregar cliente'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Modal Historial de Precios ──────────────────────────────────────────────

function HistorialModal({ cliente, historial, onClose, onAddPrecio }: {
  cliente: Cliente
  historial: HistorialPrecioCliente[]
  onClose: () => void
  onAddPrecio: (precio: number, nota?: string) => void
}) {
  const [nuevoPrecio, setNuevoPrecio] = useState('')
  const [nota, setNota]               = useState('')

  const handle = (e: React.FormEvent) => {
    e.preventDefault()
    const p = parseFloat(nuevoPrecio)
    if (!p) return
    onAddPrecio(p, nota || undefined)
    setNuevoPrecio('')
    setNota('')
  }

  const sorted = [...historial].sort((a, b) => b.fecha.localeCompare(a.fecha))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="font-semibold text-gray-900">Historial de precios</h2>
            <p className="text-sm text-gray-500">{cliente.nombre}</p>
          </div>
          <button onClick={onClose} className="btn-ghost p-1.5"><X className="w-4 h-4" /></button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div className="space-y-1 max-h-56 overflow-y-auto">
            {sorted.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-4">Sin registros aun</p>
            )}
            {sorted.map((h, i) => {
              const prev = sorted[i + 1]
              const variacion = prev ? ((h.precio - prev.precio) / prev.precio * 100) : null
              return (
                <div key={h.id} className="flex items-center justify-between py-2.5 border-b border-gray-50 last:border-0">
                  <div>
                    <p className="text-sm font-semibold text-gray-800">
                      ${h.precio.toLocaleString('es-AR')}
                      {variacion !== null && (
                        <span className={`ml-2 text-xs font-normal ${variacion > 0 ? 'text-red-500' : 'text-green-600'}`}>
                          {variacion > 0 ? '▲' : '▼'} {Math.abs(variacion).toFixed(1)}%
                        </span>
                      )}
                    </p>
                    {h.nota && <p className="text-xs text-gray-400">{h.nota}</p>}
                  </div>
                  <p className="text-xs text-gray-400">{new Date(h.fecha).toLocaleDateString('es-AR')}</p>
                </div>
              )
            })}
          </div>

          <form onSubmit={handle} className="border-t border-gray-100 pt-4 space-y-3">
            <p className="text-sm font-medium text-gray-700">Registrar ajuste de precio</p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="label">Nuevo precio ($)</label>
                <input className="input" type="number" min="0" value={nuevoPrecio}
                  onChange={e => setNuevoPrecio(e.target.value)} placeholder="0" required />
              </div>
              <div>
                <label className="label">Nota (opcional)</label>
                <input className="input" value={nota}
                  onChange={e => setNota(e.target.value)} placeholder="Ej: ajuste mayo" />
              </div>
            </div>
            <button type="submit" className="btn-primary w-full">
              <TrendingUp className="w-4 h-4" /> Registrar ajuste
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

// ─── Pagina ──────────────────────────────────────────────────────────────────

export default function Clientes() {
  const [clientes, setClientes] = useLocalStorage<Cliente[]>('el_clientes', [])
  const [historial, setHistorial] = useLocalStorage<HistorialPrecioCliente[]>('el_historial_clientes', [])

  const [modal, setModal] = useState<'nuevo' | 'editar' | 'historial' | null>(null)
  const [selected, setSelected] = useState<Cliente | null>(null)

  const handleSave = (data: Omit<Cliente, 'id' | 'createdAt' | 'updatedAt'>) => {
    const now = new Date().toISOString()
    if (modal === 'editar' && selected) {
      if (data.precio_vianda !== selected.precio_vianda) {
        setHistorial(h => [...h, {
          id: uuidv4(), cliente_id: selected.id,
          precio: data.precio_vianda,
          fecha: now.split('T')[0],
          nota: 'Actualizacion manual',
        }])
      }
      setClientes(list => list.map(c => c.id === selected.id
        ? { ...c, ...data, updatedAt: now } : c))
    } else {
      const nuevo: Cliente = { ...data, id: uuidv4(), createdAt: now, updatedAt: now }
      setClientes(list => [...list, nuevo])
      setHistorial(h => [...h, {
        id: uuidv4(), cliente_id: nuevo.id,
        precio: data.precio_vianda,
        fecha: now.split('T')[0],
        nota: 'Precio inicial',
      }])
    }
    setModal(null)
  }

  const handleDelete = (id: string) => {
    if (!confirm('Eliminas este cliente?')) return
    setClientes(list => list.filter(c => c.id !== id))
  }

  const handleAddPrecio = (precio: number, nota?: string) => {
    if (!selected) return
    const now = new Date().toISOString()
    setHistorial(h => [...h, {
      id: uuidv4(), cliente_id: selected.id,
      precio, fecha: now.split('T')[0], nota,
    }])
    setClientes(list => list.map(c => c.id === selected.id
      ? { ...c, precio_vianda: precio, updatedAt: now } : c))
  }

  const clienteHistorial = selected
    ? historial.filter(h => h.cliente_id === selected.id)
    : []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Clientes</h1>
          <p className="text-sm text-gray-500 mt-0.5">{clientes.length} empresas registradas</p>
        </div>
        <button className="btn-primary" onClick={() => { setSelected(null); setModal('nuevo') }}>
          <Plus className="w-4 h-4" /> Nuevo cliente
        </button>
      </div>

      {clientes.length === 0 ? (
        <div className="card p-16 text-center text-gray-400">
          <Building2 className="w-10 h-10 mx-auto mb-3 opacity-25" />
          <p className="font-medium">No hay clientes registrados</p>
          <p className="text-sm mt-1">Agrega tus empresas clientes con su precio por vianda</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-5 py-3 font-medium text-gray-500">Empresa</th>
                <th className="text-right px-4 py-3 font-medium text-gray-500">Precio normal</th>
                <th className="text-right px-4 py-3 font-medium text-gray-500">Precio XL</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Contacto</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Email</th>
                <th className="text-right px-4 py-3 font-medium text-gray-500">Ult. actualizacion</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {clientes.map(c => {
                const hist = historial.filter(h => h.cliente_id === c.id)
                const prev = hist.length >= 2
                  ? [...hist].sort((a, b) => a.fecha.localeCompare(b.fecha)).slice(-2)[0]
                  : null
                const variacion = prev
                  ? ((c.precio_vianda - prev.precio) / prev.precio * 100)
                  : null
                return (
                  <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3.5 font-semibold text-gray-800">{c.nombre}</td>
                    <td className="px-4 py-3.5 text-right">
                      <span className="font-bold text-lg" style={{ color: '#2C3B4B' }}>
                        ${c.precio_vianda.toLocaleString('es-AR')}
                      </span>
                      {variacion !== null && (
                        <span className={`ml-2 text-xs ${variacion > 0 ? 'text-red-500' : 'text-green-600'}`}>
                          {variacion > 0 ? '▲' : '▼'}{Math.abs(variacion).toFixed(1)}%
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      {c.precio_vianda_xl
                        ? <span className="font-semibold" style={{ color: '#2C3B4B' }}>
                            ${c.precio_vianda_xl.toLocaleString('es-AR')}
                          </span>
                        : <span className="text-xs text-gray-400">= normal</span>
                      }
                    </td>
                    <td className="px-4 py-3.5 text-gray-500">{c.contacto || '—'}</td>
                    <td className="px-4 py-3.5 text-gray-500 text-xs">{c.email || '—'}</td>
                    <td className="px-4 py-3.5 text-right text-xs text-gray-400">
                      {new Date(c.updatedAt).toLocaleDateString('es-AR')}
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex gap-1 justify-end">
                        <button className="btn-ghost p-1.5" title="Historial de precios"
                          onClick={() => { setSelected(c); setModal('historial') }}>
                          <History className="w-3.5 h-3.5" />
                        </button>
                        <button className="btn-ghost p-1.5" title="Editar"
                          onClick={() => { setSelected(c); setModal('editar') }}>
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button className="btn-ghost p-1.5 text-red-500 hover:bg-red-50" title="Eliminar"
                          onClick={() => handleDelete(c.id)}>
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
      )}

      {(modal === 'nuevo' || modal === 'editar') && (
        <ClienteModal
          cliente={modal === 'editar' ? selected ?? undefined : undefined}
          onSave={handleSave}
          onClose={() => setModal(null)}
        />
      )}
      {modal === 'historial' && selected && (
        <HistorialModal
          cliente={selected}
          historial={clienteHistorial}
          onClose={() => setModal(null)}
          onAddPrecio={handleAddPrecio}
        />
      )}
    </div>
  )
}
