import { useState } from 'react'
import Layout from './components/Layout'
import Insumos from './pages/Insumos'
import SubRecetas from './pages/SubRecetas'
import Platos from './pages/Platos'
import Planificacion from './pages/Planificacion'
import Clientes from './pages/Clientes'
import Dashboard from './pages/Dashboard'
import { DataContext } from './context/DataContext'
import { useSupabaseStorage } from './hooks/useSupabaseStorage'
import { useInsumosTable } from './hooks/useInsumosTable'
import { useSubrecetasTable } from './hooks/useSubrecetasTable'
import { usePlatosTable } from './hooks/usePlatosTable'
import { useClientesTable } from './hooks/useClientesTable'
import { HISTORIAL_INICIALES } from './data/mockData'
import { HistorialPrecio, HistorialPrecioCliente, PedidoSemanal } from './types'

export type Tab = 'insumos' | 'subrecetas' | 'platos' | 'planificacion' | 'clientes' | 'dashboard'

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('insumos')

  // ── Tablas relacionales (una fila por ítem, sin riesgo de sobreescritura) ──
  const [platos,     setPlatos,     loadingPlatos]  = usePlatosTable()
  const [insumos,    setInsumos,    loadingInsumos] = useInsumosTable()
  const [subrecetas, setSubrecetas, loadingSub]     = useSubrecetasTable()
  const [clientes,   setClientes]                   = useClientesTable()

  // ── JSONB (datos simples o append-only, sin riesgo de conflicto) ───────────
  const [pedidos,           setPedidos]           = useSupabaseStorage<PedidoSemanal[]>('el_pedidos', [])
  const [historial,         setHistorial]         = useSupabaseStorage<HistorialPrecio[]>('el_historial', HISTORIAL_INICIALES)
  const [historialClientes, setHistorialClientes] = useSupabaseStorage<HistorialPrecioCliente[]>('el_historial_clientes', [])
  const [xlPorcentaje,      setXlPorcentaje]      = useSupabaseStorage<number>('el_xl_porcentaje', 30)

  const appLoading = loadingPlatos || loadingInsumos || loadingSub

  if (appLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f9fafb' }}>
        <img src="/logo.png" alt="Easy Lunch" style={{ width: 160, marginBottom: 24, opacity: 0.85 }} />
        <div style={{ width: 40, height: 40, border: '3px solid #D2EA8E', borderTopColor: '#2C3B4B', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <p style={{ marginTop: 16, color: '#6b7280', fontSize: 14 }}>Cargando datos...</p>
        <style>{'@keyframes spin { to { transform: rotate(360deg) } }'}</style>
      </div>
    )
  }

  return (
    <DataContext.Provider value={{
      platos, setPlatos,
      insumos, setInsumos,
      subrecetas, setSubrecetas,
      pedidos, setPedidos,
      historial, setHistorial,
      clientes, setClientes,
      historialClientes, setHistorialClientes,
      xlPorcentaje, setXlPorcentaje,
    }}>
      <Layout activeTab={activeTab} setActiveTab={setActiveTab}>
        {activeTab === 'insumos'       && <Insumos />}
        {activeTab === 'subrecetas'    && <SubRecetas />}
        {activeTab === 'platos'        && <Platos />}
        {activeTab === 'planificacion' && <Planificacion />}
        {activeTab === 'clientes'      && <Clientes />}
        {activeTab === 'dashboard'     && <Dashboard />}
      </Layout>
    </DataContext.Provider>
  )
}
