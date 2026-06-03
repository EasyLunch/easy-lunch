import { useState } from 'react'
import Layout from './components/Layout'
import Insumos from './pages/Insumos'
import SubRecetas from './pages/SubRecetas'
import Platos from './pages/Platos'
import Planificacion from './pages/Planificacion'
import Clientes from './pages/Clientes'
import Dashboard from './pages/Dashboard'

export type Tab = 'insumos' | 'subrecetas' | 'platos' | 'planificacion' | 'clientes' | 'dashboard'

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('insumos')

  return (
    <Layout activeTab={activeTab} setActiveTab={setActiveTab}>
      {activeTab === 'insumos'       && <Insumos />}
      {activeTab === 'subrecetas'    && <SubRecetas />}
      {activeTab === 'platos'        && <Platos />}
      {activeTab === 'planificacion' && <Planificacion />}
      {activeTab === 'clientes'      && <Clientes />}
      {activeTab === 'dashboard'     && <Dashboard />}
    </Layout>
  )
}
