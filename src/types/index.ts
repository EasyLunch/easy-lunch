// ─── Insumos ────────────────────────────────────────────────────────────────

export type CategoriaInsumo =
  | 'vacuno'
  | 'cerdo'
  | 'ave'
  | 'cordero'
  | 'pescado'
  | 'verduras'
  | 'lacteos'
  | 'harinas'
  | 'aderezos'
  | 'condimentos'
  | 'descartables'
  | 'productos_terminados'
  | 'almacen'
  | 'otros';

export const CATEGORIAS_INSUMO: { value: CategoriaInsumo; label: string; emoji: string; color: string }[] = [
  { value: 'vacuno',               label: 'Carne Vacuna',         emoji: '🥩', color: 'bg-red-100 text-red-700' },
  { value: 'cerdo',                label: 'Cerdo',                emoji: '🐷', color: 'bg-pink-100 text-pink-700' },
  { value: 'ave',                  label: 'Ave',                  emoji: '🍗', color: 'bg-orange-100 text-orange-700' },
  { value: 'cordero',              label: 'Cordero',              emoji: '🐑', color: 'bg-rose-100 text-rose-700' },
  { value: 'pescado',              label: 'Pescado y Mariscos',   emoji: '🐟', color: 'bg-cyan-100 text-cyan-700' },
  { value: 'verduras',             label: 'Verduras',             emoji: '🥦', color: 'bg-green-100 text-green-700' },
  { value: 'lacteos',              label: 'Lácteos',              emoji: '🧀', color: 'bg-yellow-100 text-yellow-700' },
  { value: 'harinas',              label: 'Harinas y Pastas',     emoji: '🌾', color: 'bg-amber-100 text-amber-700' },
  { value: 'aderezos',             label: 'Aderezos',             emoji: '🫙', color: 'bg-lime-100 text-lime-700' },
  { value: 'condimentos',          label: 'Condimentos',          emoji: '🧂', color: 'bg-purple-100 text-purple-700' },
  { value: 'descartables',         label: 'Descartables',         emoji: '📦', color: 'bg-gray-100 text-gray-700' },
  { value: 'productos_terminados', label: 'Productos Terminados', emoji: '🛒', color: 'bg-blue-100 text-blue-700' },
  { value: 'almacen',               label: 'Almacén',               emoji: '🏪', color: 'bg-indigo-100 text-indigo-700' },
  { value: 'otros',                label: 'Otros',                emoji: '📋', color: 'bg-slate-100 text-slate-700' },
];

export const UNIDADES = ['kg', 'g', 'lt', 'ml', 'unidad', 'docena', 'atado', 'sobre'];

export interface Insumo {
  id: string;
  nombre: string;
  categoria: CategoriaInsumo;
  precio: number;
  unidad: string;
  proveedor?: string;
  merma_crudo: number;
  variacion_coccion: number;
  createdAt: string;
  updatedAt: string;
}

export interface HistorialPrecio {
  id: string;
  insumo_id: string;
  precio: number;
  fecha: string;
  nota?: string;
}

// ─── Sub-recetas ─────────────────────────────────────────────────────────────

export type FamiliaSubReceta = 'salsa' | 'guarnicion' | 'principal' | 'base' | 'aderezo' | 'otro';

export const FAMILIAS_SUBRECETA: { value: FamiliaSubReceta; label: string; emoji: string; color: string }[] = [
  { value: 'salsa',      label: 'Salsa',      emoji: '🍅', color: 'bg-red-100 text-red-700' },
  { value: 'guarnicion', label: 'Guarnición', emoji: '🥗', color: 'bg-green-100 text-green-700' },
  { value: 'principal',  label: 'Principal',  emoji: '🍖', color: 'bg-orange-100 text-orange-700' },
  { value: 'base',       label: 'Base',       emoji: '🫓', color: 'bg-amber-100 text-amber-700' },
  { value: 'aderezo',    label: 'Aderezo',    emoji: '🫙', color: 'bg-yellow-100 text-yellow-700' },
  { value: 'otro',       label: 'Otro',       emoji: '📋', color: 'bg-gray-100 text-gray-700' },
];

export interface IngredienteSubReceta {
  id: string;
  insumo_id: string;
  cantidad: number;
  unidad: string;
}

export interface SubReceta {
  id: string;
  nombre: string;
  familia: FamiliaSubReceta;
  rendimiento: number;
  unidad_rendimiento: string;
  ingredientes: IngredienteSubReceta[];
  descripcion?: string;
  createdAt: string;
}

// ─── Platos ──────────────────────────────────────────────────────────────────

export type TipoPlato =
  | 'clasico'
  | 'vegetariano'
  | 'ensalada'
  | 'sandwich'
  | 'wrap'
  | 'tarta'
  | 'postre';

export const TIPOS_PLATO: { value: TipoPlato; label: string; emoji: string; color: string }[] = [
  { value: 'clasico',     label: 'Clásico',     emoji: '🍽', color: 'bg-blue-100 text-blue-700' },
  { value: 'vegetariano', label: 'Vegetariano', emoji: '🌿', color: 'bg-green-100 text-green-700' },
  { value: 'ensalada',    label: 'Ensalada',    emoji: '🥗', color: 'bg-lime-100 text-lime-700' },
  { value: 'sandwich',    label: 'Sándwich',    emoji: '🥪', color: 'bg-yellow-100 text-yellow-700' },
  { value: 'wrap',        label: 'Wrap',        emoji: '🌯', color: 'bg-amber-100 text-amber-700' },
  { value: 'tarta',       label: 'Tarta',       emoji: '🥧', color: 'bg-orange-100 text-orange-700' },
  { value: 'postre',      label: 'Postre',      emoji: '🍮', color: 'bg-pink-100 text-pink-700' },
];

export type TipoIngredientePlato = 'insumo' | 'subreceta';

export interface IngredientePlato {
  id: string;
  tipo: TipoIngredientePlato;
  ref_id: string;
  cantidad: number;
  unidad: string;
}

export interface Plato {
  id: string;
  nombre: string;
  tipo: TipoPlato;
  porciones: number;
  foto?: string;
  ingredientes: IngredientePlato[];
  descripcion?: string;
  createdAt: string;
}

// ─── Clientes ────────────────────────────────────────────────────────────────

export interface Cliente {
  id: string;
  nombre: string;
  precio_vianda: number;
  precio_vianda_xl?: number;
  contacto?: string;
  email?: string;
  createdAt: string;
  updatedAt: string;
}

export interface HistorialPrecioCliente {
  id: string;
  cliente_id: string;
  precio: number;
  fecha: string;
  nota?: string;
}

// ─── Planificación ───────────────────────────────────────────────────────────

export interface PedidoItem {
  plato_id: string;
  plato_nombre: string;
  cantidad: number;
  cantidad_xl?: number;
}

export interface PedidoRow {
  fecha: string;
  empresa: string;
  plato_excel: string;
  plato_id?: string;
  plato_nombre?: string;
  es_xl: boolean;
}

export interface CompraItem {
  insumo_id: string;
  insumo_nombre: string;
  unidad: string;
  cantidad_neta: number;
  cantidad_bruta: number;
  proveedor?: string;
  costo_estimado: number;
}

export interface PedidoSemanal {
  id: string;
  semana: string;
  fecha_inicio?: string;
  fecha_fin?: string;
  rows: PedidoRow[];
  items: PedidoItem[];
  lista_compras: CompraItem[];
  createdAt: string;
}
