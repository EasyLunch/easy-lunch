// ─── Producción diaria: pedidos del día → platos, subrecetas e insumos (crudo y cocido) ──────────────
import { Plato, Insumo, SubReceta } from '../types'
import { yieldFactor, toGramos } from './costos'

// ─── Matching de nombres del sistema con las recetas ─────────────────────────

const STOPWORDS = new Set(['de', 'del', 'la', 'las', 'el', 'los', 'con', 'y', 'a', 'al', 'un', 'una', 'en', 'por', 'sin', 'mas', 'más'])

export function normalizarTexto(t: string): string {
  return t
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>')
    .replace(/[.,;:!()\[\]{}'"\-–]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Clave para guardar asociaciones manuales (sin tildes, sin el "XL " del principio). */
export function claveNombre(t: string): string {
  return normalizarTexto(t.replace(/^xl\s+/i, ''))
}

function palabrasClave(texto: string): string[] {
  return normalizarTexto(texto).split(' ').filter(w => w.length > 2 && !STOPWORDS.has(w))
}

export function matchearPlato(textoExcel: string, platos: Plato[]): Plato | undefined {
  const raw = textoExcel.replace(/^xl\s+/i, '').trim()
  const texto = normalizarTexto(raw)

  // 1. Exacto (normalizado)
  let found = platos.find(p => normalizarTexto(p.nombre) === texto)
  if (found) return found

  // 2. Inclusión de substring (normalizado)
  found = platos.find(p => texto.includes(normalizarTexto(p.nombre)))
  if (found) return found
  found = platos.find(p => normalizarTexto(p.nombre).includes(texto))
  if (found) return found

  // 3. Solapamiento de palabras clave (≥75% de las palabras del nombre de receta)
  const palabrasTexto = new Set(palabrasClave(raw))
  let bestMatch: Plato | undefined
  let bestScore = 0
  for (const plato of platos) {
    const pals = palabrasClave(plato.nombre)
    if (pals.length === 0) continue
    const matches = pals.filter(w => palabrasTexto.has(w)).length
    const score = matches / pals.length
    if (score >= 0.75 && score > bestScore) {
      bestScore = score
      bestMatch = plato
    }
  }
  return bestMatch
}

/** XL: el nombre empieza con "XL " o la categoría dice XL. */
export function esXL(nombre: string, categoria?: string): boolean {
  return /^xl\s+/i.test(nombre.trim()) || /\bxl\b/i.test(categoria ?? '')
}

// ─── Datos que publica Modificaciones (app_data → el_produccion_pedidos) ────

export interface ItemProduccion {
  plato: string
  categoria: string
  tipo: 'plato' | 'postre' | 'reventa'
  cant: number
  hit: number
  sinHit: number
  nota?: string
}

export interface DiaProduccion {
  fecha: string
  texto: string
  finde: string[]
  items: ItemProduccion[]
  platos: number
}

export interface PedidosProduccion {
  actualizado: string
  actualizadoTxt: string
  datosSistema?: string
  desde: string
  hasta: string
  version?: string
  avisos?: string[]
  dias: DiaProduccion[]
}

// ─── Resultado ───────────────────────────────────────────────────────────────

export interface LineaPlato {
  categoria: string
  nombre: string            // como figura en el sistema
  tipo: ItemProduccion['tipo']
  receta?: Plato
  cant: number
  cantXL: number
  hit: number
  sinHit: number
  pesoViandaG: number       // peso cocido por vianda (receta)
  totalCocidoG: number      // peso cocido total (incluye XL)
  nota?: string
  noLleva?: boolean         // marcado a mano: "no lleva receta"
  manual?: boolean          // receta elegida a mano
}

export interface Cantidad {
  crudo: number             // gramos (o unidades si esPeso = false)
  cocido: number
}

export interface LineaInsumo extends Cantidad {
  insumo: Insumo
  esPeso: boolean
  unidad: string            // 'kg' si es peso; si no, la unidad del insumo
}

export interface LineaSubreceta {
  sub: SubReceta
  cocido: number            // gramos (o unidades) a obtener
  tandas: number            // veces la receta
  crudo: number             // gramos de entrada (suma de insumos por peso, en crudo)
  insumos: LineaInsumo[]
  platos: string[]          // recetas que la usan
}

export interface BloqueCategoria {
  categoria: string
  platos: LineaPlato[]
  subrecetas: LineaSubreceta[]
  insumos: LineaInsumo[]    // insumos directos de las recetas (no los que van dentro de subrecetas)
  totalViandas: number
}

export interface ResultadoProduccion {
  categorias: BloqueCategoria[]
  subrecetas: LineaSubreceta[]      // todas, sumadas
  insumosTotales: LineaInsumo[]     // todo el día (directos + dentro de subrecetas), sin descartables
  descartables: LineaInsumo[]
  sinReceta: LineaPlato[]
  totalViandas: number
}

const UNIDADES_PESO = new Set(['g', 'kg', 'ml', 'lt'])

/** Orden de categorías: calientes, XL, el resto alfabético, guarnición, postres, reventa. */
export function rankCategoria(c: string): number {
  const t = c.toLowerCase()
  if (t.startsWith('reventa')) return 9
  if (t.startsWith('postre')) return 8
  if (t.startsWith('guarn')) return 7
  if (t.startsWith('platos calientes')) return t.includes('xl') ? 1 : 0
  return 5
}

/** Gramos de una subreceta que lleva un ingrediente de plato (por porción del plato = 1). */
function gramosSubreceta(ingCantidad: number, ingUnidad: string, sr: SubReceta): number {
  if (ingUnidad === 'unidad' && sr.unidad_rendimiento === 'unidad') return ingCantidad
  if (ingUnidad === 'unidad' && sr.gramaje_unidad && sr.gramaje_unidad > 0) return ingCantidad * sr.gramaje_unidad
  return toGramos(ingCantidad, ingUnidad)
}

function rendimientoG(sr: SubReceta): number {
  if (sr.unidad_rendimiento === 'unidad') {
    return sr.gramaje_unidad && sr.gramaje_unidad > 0 ? sr.rendimiento * sr.gramaje_unidad : sr.rendimiento
  }
  return toGramos(sr.rendimiento, sr.unidad_rendimiento)
}

/**
 * Cantidad crudo / cocido de un ingrediente.
 * - Por peso: si la receta lo carga "crudo", lo cargado es crudo y el cocido sale con merma y cocción;
 *   si lo carga "cocido", lo cargado es cocido y el crudo se calcula al revés.
 * - Por unidad: crudo = cocido = unidades.
 */
function crudoCocido(ins: Insumo, cantidad: number, unidad: string, crudo: boolean | undefined): Cantidad & { esPeso: boolean } {
  if (!UNIDADES_PESO.has(unidad)) return { crudo: cantidad, cocido: cantidad, esPeso: false }
  const g = toGramos(cantidad, unidad)
  const yf = yieldFactor(ins.merma_crudo || 0, ins.variacion_coccion || 0)
  if (crudo) return { crudo: g, cocido: g * yf, esPeso: true }
  return { crudo: yf > 0 ? g / yf : g, cocido: g, esPeso: true }
}

type Acum = Map<string, LineaInsumo>
function acumular(map: Acum, ins: Insumo, c: Cantidad & { esPeso: boolean }) {
  const k = ins.id + (c.esPeso ? '' : '#u')
  const prev = map.get(k)
  if (prev) { prev.crudo += c.crudo; prev.cocido += c.cocido; return }
  map.set(k, { insumo: ins, crudo: c.crudo, cocido: c.cocido, esPeso: c.esPeso, unidad: c.esPeso ? 'kg' : ins.unidad })
}
const ordenarInsumos = (m: Acum) => [...m.values()].sort((a, b) => a.insumo.nombre.localeCompare(b.insumo.nombre))

/**
 * Arma la producción de uno o varios días ya sumados.
 * asociaciones: { claveNombre(nombre del sistema): plato_id } elegidas a mano (pisan el matching automático).
 */
export function calcularProduccion(
  items: ItemProduccion[],
  platos: Plato[],
  insumos: Insumo[],
  subrecetas: SubReceta[],
  xlPorcentaje: number,
  asociaciones: Record<string, string>
): ResultadoProduccion {
  const insMap = new Map(insumos.map(i => [i.id, i]))
  const srMap = new Map(subrecetas.map(s => [s.id, s]))
  const platoMap = new Map(platos.map(p => [p.id, p]))
  const xlMult = 1 + xlPorcentaje / 100

  // 1) Líneas de platos (sumando por categoría + nombre del sistema)
  const lineas = new Map<string, LineaPlato>()
  for (const it of items) {
    const xl = esXL(it.plato, it.categoria)
    const nombre = it.plato.trim()
    const k = it.categoria + '|' + claveNombre(nombre) + '|' + it.tipo
    let l = lineas.get(k)
    if (!l) {
      const manual = asociaciones[claveNombre(nombre)]
      const noLleva = manual === '-'
      const receta = noLleva ? undefined : (manual && platoMap.get(manual)) || matchearPlato(nombre, platos)
      l = { categoria: it.categoria, nombre: nombre.replace(/^xl\s+/i, ''), tipo: it.tipo, receta, cant: 0, cantXL: 0, hit: 0, sinHit: 0,
        pesoViandaG: 0, totalCocidoG: 0, nota: it.nota, noLleva, manual: !!manual && !noLleva }
      lineas.set(k, l)
    }
    if (xl) l.cantXL += it.cant; else l.cant += it.cant
    l.hit += it.hit; l.sinHit += it.sinHit
  }

  // 2) Recorrer cada receta escalada
  const porCat = new Map<string, { platos: LineaPlato[]; subs: Map<string, LineaSubreceta>; ins: Acum }>()
  const subsTot = new Map<string, LineaSubreceta>()
  const insTot: Acum = new Map()
  const descart: Acum = new Map()
  const sinReceta: LineaPlato[] = []

  const lineaSub = (m: Map<string, LineaSubreceta>, sr: SubReceta) => {
    let s = m.get(sr.id)
    if (!s) { s = { sub: sr, cocido: 0, tandas: 0, crudo: 0, insumos: [], platos: [] }; m.set(sr.id, s) }
    return s
  }
  const subIns = new Map<LineaSubreceta, Acum>()

  for (const l of lineas.values()) {
    let C = porCat.get(l.categoria)
    if (!C) { C = { platos: [], subs: new Map(), ins: new Map() }; porCat.set(l.categoria, C) }
    C.platos.push(l)
    const p = l.receta
    if (!p) { if (!l.noLleva) sinReceta.push(l); continue }
    const porc = p.porciones > 0 ? p.porciones : 1
    // factor = porciones equivalentes (los XL llevan más de todo menos descartables)
    const fNormal = (l.cant + l.cantXL * xlMult) / porc
    const fDesc = (l.cant + l.cantXL) / porc
    let pesoReceta = 0

    for (const ing of p.ingredientes) {
      if (ing.tipo === 'insumo') {
        const ins = insMap.get(ing.ref_id)
        if (!ins) continue
        const esDesc = ins.categoria === 'descartables'
        const f = esDesc ? fDesc : fNormal
        const c = crudoCocido(ins, ing.cantidad * f, ing.unidad, ing.crudo)
        const unidad1 = crudoCocido(ins, ing.cantidad, ing.unidad, ing.crudo)
        if (esDesc) { acumular(descart, ins, c); continue }
        pesoReceta += unidad1.esPeso ? unidad1.cocido : unidad1.cocido * (ins.gramaje || 0)
        acumular(C.ins, ins, c)
        acumular(insTot, ins, c)
      } else {
        const sr = srMap.get(ing.ref_id)
        if (!sr) continue
        const rendG = rendimientoG(sr)
        if (!(rendG > 0)) continue
        const g1 = gramosSubreceta(ing.cantidad, ing.unidad, sr)
        pesoReceta += sr.unidad_rendimiento === 'unidad' && !(sr.gramaje_unidad! > 0) ? 0 : g1
        const necesario = g1 * fNormal
        const ratio = necesario / rendG
        for (const target of [lineaSub(C.subs, sr), lineaSub(subsTot, sr)]) {
          target.cocido += necesario
          target.tandas += ratio
          if (!target.platos.includes(p.nombre)) target.platos.push(p.nombre)
          let acc = subIns.get(target)
          if (!acc) { acc = new Map(); subIns.set(target, acc) }
          for (const si of sr.ingredientes) {
            const ins = insMap.get(si.insumo_id)
            if (!ins) continue
            const c = crudoCocido(ins, si.cantidad * ratio, si.unidad, si.crudo)
            acumular(acc, ins, c)
            if (c.esPeso) target.crudo += c.crudo
          }
        }
        for (const si of sr.ingredientes) {
          const ins = insMap.get(si.insumo_id)
          if (!ins) continue
          const c = crudoCocido(ins, si.cantidad * ratio, si.unidad, si.crudo)
          if (ins.categoria === 'descartables') acumular(descart, ins, c)
          else acumular(insTot, ins, c)
        }
      }
    }
    l.pesoViandaG = pesoReceta / porc
    l.totalCocidoG = l.pesoViandaG * (l.cant + l.cantXL * xlMult)
  }

  const cerrarSubs = (m: Map<string, LineaSubreceta>) => [...m.values()].map(s => {
    s.insumos = ordenarInsumos(subIns.get(s) ?? new Map())
    return s
  }).sort((a, b) => a.sub.nombre.localeCompare(b.sub.nombre))

  const categorias: BloqueCategoria[] = [...porCat.entries()].map(([categoria, C]) => ({
    categoria,
    platos: C.platos.sort((a, b) => a.nombre.localeCompare(b.nombre)),
    subrecetas: cerrarSubs(C.subs),
    insumos: ordenarInsumos(C.ins),
    totalViandas: C.platos.filter(x => x.tipo !== 'postre').reduce((s, x) => s + x.cant + x.cantXL, 0),
  })).sort((a, b) => rankCategoria(a.categoria) - rankCategoria(b.categoria) || a.categoria.localeCompare(b.categoria))

  return {
    categorias,
    subrecetas: cerrarSubs(subsTot),
    insumosTotales: ordenarInsumos(insTot),
    descartables: ordenarInsumos(descart),
    sinReceta: sinReceta.sort((a, b) => a.nombre.localeCompare(b.nombre)),
    totalViandas: categorias.reduce((s, c) => s + c.totalViandas, 0),
  }
}

/** "1,250 kg" / "320 g" / "12 unidad" */
export function fmtCant(v: number, esPeso: boolean, unidad = 'unidad'): string {
  if (!esPeso) return `${(Math.round(v * 10) / 10).toLocaleString('es-AR')} ${unidad}`
  if (Math.abs(v) >= 1000) return `${(v / 1000).toLocaleString('es-AR', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} kg`
  return `${Math.round(v).toLocaleString('es-AR')} g`
}

/** Para el Excel: kg con 3 decimales (o unidades). */
export function numExcel(v: number, esPeso: boolean): number {
  return esPeso ? Math.round(v) / 1000 : Math.round(v * 10) / 10
}
