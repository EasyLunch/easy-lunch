// ─── Utilidades de costo y rendimiento ───────────────────────────────────────
import type { Insumo, SubReceta } from '../types'

/**
 * Factor de rendimiento: qué fracción del peso bruto llega al plato.
 * merma: % de pérdida al limpiar/descongelar (ej: 20 → queda 0.80)
 * variacion: % de cambio post-cocción (ej: -30 → queda 0.70, +150 → queda 2.50)
 */
export function yieldFactor(merma: number, variacion: number): number {
  return (1 - merma / 100) * (1 + variacion / 100)
}

/**
 * Precio real por kg de producto NETO (ya limpio y cocido).
 * Es lo que realmente cuesta cada kg utilizable.
 * precio: precio de compra por kg bruto
 */
export function precioRealPorKg(precio: number, merma: number, variacion: number): number {
  const yf = yieldFactor(merma, variacion)
  return yf > 0 ? precio / yf : precio
}

/**
 * Convierte cualquier unidad de peso/volumen a gramos (o ml, tratados igual).
 * Para unidades no convertibles (ej: 'unidad') devuelve la cantidad tal cual.
 */
export function toGramos(cantidad: number, unidad: string): number {
  switch (unidad) {
    case 'g':   return cantidad
    case 'kg':  return cantidad * 1000
    case 'ml':  return cantidad
    case 'lt':  return cantidad * 1000
    default:    return cantidad // 'unidad', 'cdita', etc.
  }
}

const UNIDADES_PESO_COSTOS = new Set(['g', 'kg', 'ml', 'lt'])

/**
 * Peso cocido (g) de UNA unidad de una subreceta que rinde "unidad".
 * - Si tiene cargado "Peso por unidad" (gramaje_unidad), se usa ese.
 * - Si no, se calcula sumando sus ingredientes: los de peso en cocido (si están cargados crudos, con merma y cocción)
 *   y los de unidad × gramaje del insumo (ej: tortilla de wrap 110 g), dividido por lo que rinde.
 * - Las subrecetas que son solo descartables (packaging) pesan 0: no son comida.
 */
export function pesoUnidadSubreceta(sr: SubReceta, insumos: Insumo[] | Map<string, Insumo>): number {
  const get = (id: string) => (insumos instanceof Map ? insumos.get(id) : insumos.find(i => i.id === id))
  const ings = sr.ingredientes ?? []
  if (ings.length > 0 && ings.every(si => get(si.insumo_id)?.categoria === 'descartables')) return 0
  if (sr.gramaje_unidad && sr.gramaje_unidad > 0) return sr.gramaje_unidad
  if (sr.unidad_rendimiento !== 'unidad') return 0
  let total = 0
  for (const si of ings) {
    const ins = get(si.insumo_id)
    if (!ins || ins.categoria === 'descartables') continue
    if (UNIDADES_PESO_COSTOS.has(si.unidad)) {
      const g = toGramos(si.cantidad, si.unidad)
      total += si.crudo ? g * yieldFactor(ins.merma_crudo || 0, ins.variacion_coccion || 0) : g
    } else {
      total += si.cantidad * (ins.gramaje || 0)
    }
  }
  return sr.rendimiento > 0 ? total / sr.rendimiento : total
}
