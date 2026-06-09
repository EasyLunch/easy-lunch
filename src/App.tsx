import { useState } from 'react'
import Layout from './components/Layout'
import Insumos from './pages/Insumos'
import SubRecetas from './pages/SubRecetas'
import Platos from './pages/Platos'
import Planificacion from './pages/Planificacion'
import Clientes from './pages/Clientes'
import Dashboard from './pages/Dashboard'
import { DataContext } from './context/DataContext'
import { useLocalStorage } from './hooks/useLocalStorage'
import { PLATOS_INICIALES, INSUMOS_INICIALES, SUBRECETAS_INICIALES, HISTORIAL_INICIALES } from './data/mockData'
import { Plato, Insumo, SubReceta, Cliente, HistorialPrecio, HistorialPrecioCliente, PedidoSemanal } from './types'

export type Tab = 'insumos' | 'subrecetas' | 'platos' | 'planificacion' | 'clientes' | 'dashboard'

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('insumos')

  const [platos,            setPlatos]            = useLocalStorage<Plato[]>('el_platos', PLATOS_INICIALES)
  const [insumos,           setInsumos]           = useLocalStorage<Insumo[]>('el_insumos', INSUMOS_INICIALES)
  const [subrecetas,        setSubrecetas]        = useLocalStorage<SubReceta[]>('el_subrecetas', SUBRECETAS_INICIALES)
  const [pedidos,           setPedidos]           = useLocalStorage<PedidoSemanal[]>('el_pedidos', [])
  const [historial,         setHistorial]         = useLocalStorage<HistorialPrecio[]>('el_historial', HISTORIAL_INICIALES)
  const [clientes,          setClientes]          = useLocalStorage<Cliente[]>('el_clientes', [])
  const [historialClientes, setHistorialClientes] = useLocalStorage<HistorialPrecioCliente[]>('el_historial_clientes', [])
  const [xlPorcentaje,      setXlPorcentaje]      = useLocalStorage<number>('el_xl_porcentaje', 30)

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
