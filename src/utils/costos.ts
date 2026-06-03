// ─── Utilidades de costo y rendimiento ───────────────────────────────────────

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
