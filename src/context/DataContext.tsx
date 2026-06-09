import { createContext, useContext } from 'react'
import {
  Plato, Insumo, SubReceta, Cliente,
  HistorialPrecio, HistorialPrecioCliente, PedidoSemanal
} from '../types'

type Setter<T> = (value: T | ((prev: T) => T)) => void

interface DataContextType {
  platos:      Plato[];           setPlatos:      Setter<Plato[]>
  insumos:     Insumo[];          setInsumos:     Setter<Insumo[]>
  subrecetas:  SubReceta[];       setSubrecetas:  Setter<SubReceta[]>
  pedidos:     PedidoSemanal[];   setPedidos:     Setter<PedidoSemanal[]>
  historial:   HistorialPrecio[]; setHistorial:   Setter<HistorialPrecio[]>
  clientes:    Cliente[];         setClientes:    Setter<Cliente[]>
  historialClientes: HistorialPrecioCliente[]; setHistorialClientes: Setter<HistorialPrecioCliente[]>
  xlPorcentaje: number;           setXlPorcentaje: Setter<number>
}

export const DataContext = createContext<DataContextType>(null!)
export const useData = () => useContext(DataContext)
