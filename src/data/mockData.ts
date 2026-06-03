import { Insumo, SubReceta, Plato, HistorialPrecio } from '../types';

export const INSUMOS_INICIALES: Insumo[] = [
  {
    id: 'ins-1', nombre: 'Pechuga de pollo', categoria: 'ave',
    precio: 4200, unidad: 'kg', proveedor: 'Frigorífico Del Sur',
    merma_crudo: 5, variacion_coccion: -25,
    createdAt: '2026-01-10T10:00:00Z', updatedAt: '2026-05-01T10:00:00Z',
  },
  {
    id: 'ins-2', nombre: 'Carne picada', categoria: 'vacuno',
    precio: 3800, unidad: 'kg', proveedor: 'Frigorífico Del Sur',
    merma_crudo: 0, variacion_coccion: -30,
    createdAt: '2026-01-10T10:00:00Z', updatedAt: '2026-05-01T10:00:00Z',
  },
  {
    id: 'ins-3', nombre: 'Lechuga', categoria: 'verduras',
    precio: 800, unidad: 'kg', proveedor: 'Verdulería Central',
    merma_crudo: 15, variacion_coccion: 0,
    createdAt: '2026-01-10T10:00:00Z', updatedAt: '2026-05-10T10:00:00Z',
  },
  {
    id: 'ins-4', nombre: 'Tomate', categoria: 'verduras',
    precio: 1200, unidad: 'kg', proveedor: 'Verdulería Central',
    merma_crudo: 10, variacion_coccion: 0,
    createdAt: '2026-01-10T10:00:00Z', updatedAt: '2026-05-10T10:00:00Z',
  },
  {
    id: 'ins-5', nombre: 'Papa', categoria: 'verduras',
    precio: 600, unidad: 'kg', proveedor: 'Verdulería Central',
    merma_crudo: 20, variacion_coccion: -5,
    createdAt: '2026-01-10T10:00:00Z', updatedAt: '2026-05-10T10:00:00Z',
  },
  {
    id: 'ins-6', nombre: 'Arroz', categoria: 'harinas',
    precio: 1100, unidad: 'kg', proveedor: 'Distribuidora Norte',
    merma_crudo: 0, variacion_coccion: 150,
    createdAt: '2026-01-10T10:00:00Z', updatedAt: '2026-04-15T10:00:00Z',
  },
  {
    id: 'ins-7', nombre: 'Aceite de girasol', categoria: 'aderezos',
    precio: 2200, unidad: 'lt', proveedor: 'Distribuidora Norte',
    merma_crudo: 0, variacion_coccion: 0,
    createdAt: '2026-01-10T10:00:00Z', updatedAt: '2026-04-15T10:00:00Z',
  },
  {
    id: 'ins-8', nombre: 'Contenedor 1lt', categoria: 'descartables',
    precio: 180, unidad: 'unidad', proveedor: 'Descartables SA',
    merma_crudo: 0, variacion_coccion: 0,
    createdAt: '2026-01-10T10:00:00Z', updatedAt: '2026-03-20T10:00:00Z',
  },
];

export const HISTORIAL_INICIALES: HistorialPrecio[] = [
  { id: 'hp-1', insumo_id: 'ins-1', precio: 3500, fecha: '2026-01-10', nota: 'Precio inicial' },
  { id: 'hp-2', insumo_id: 'ins-1', precio: 3800, fecha: '2026-02-15', nota: 'Aumento de temporada' },
  { id: 'hp-3', insumo_id: 'ins-1', precio: 4000, fecha: '2026-03-20' },
  { id: 'hp-4', insumo_id: 'ins-1', precio: 4200, fecha: '2026-05-01' },
  { id: 'hp-5', insumo_id: 'ins-3', precio: 600, fecha: '2026-01-10' },
  { id: 'hp-6', insumo_id: 'ins-3', precio: 750, fecha: '2026-03-15' },
  { id: 'hp-7', insumo_id: 'ins-3', precio: 800, fecha: '2026-05-10' },
];

export const SUBRECETAS_INICIALES: SubReceta[] = [
  {
    id: 'sr-1', nombre: 'Salsa provenzal', familia: 'salsa',
    rendimiento: 1, unidad_rendimiento: 'kg',
    ingredientes: [
      { id: 'sri-1', insumo_id: 'ins-7', cantidad: 0.2, unidad: 'lt' },
    ],
    createdAt: '2026-01-15T10:00:00Z',
  },
  {
    id: 'sr-2', nombre: 'Arroz blanco', familia: 'guarnicion',
    rendimiento: 1, unidad_rendimiento: 'kg',
    ingredientes: [
      { id: 'sri-2', insumo_id: 'ins-6', cantidad: 0.4, unidad: 'kg' },
    ],
    createdAt: '2026-01-15T10:00:00Z',
  },
];

export const PLATOS_INICIALES: Plato[] = [
  {
    id: 'pl-1', nombre: 'Pollo al horno con papas', tipo: 'clasico', porciones: 10,
    ingredientes: [
      { id: 'pli-1', tipo: 'insumo',    ref_id: 'ins-1', cantidad: 1.5, unidad: 'kg' },
      { id: 'pli-2', tipo: 'insumo',    ref_id: 'ins-5', cantidad: 2,   unidad: 'kg' },
      { id: 'pli-3', tipo: 'subreceta', ref_id: 'sr-1',  cantidad: 0.3, unidad: 'kg' },
    ],
    createdAt: '2026-01-20T10:00:00Z',
  },
  {
    id: 'pl-2', nombre: 'Ensalada caprese', tipo: 'ensalada', porciones: 8,
    ingredientes: [
      { id: 'pli-4', tipo: 'insumo', ref_id: 'ins-3', cantidad: 0.8, unidad: 'kg' },
      { id: 'pli-5', tipo: 'insumo', ref_id: 'ins-4', cantidad: 0.6, unidad: 'kg' },
    ],
    createdAt: '2026-01-20T10:00:00Z',
  },
];
