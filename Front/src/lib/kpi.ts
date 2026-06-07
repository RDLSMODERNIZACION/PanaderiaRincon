import type { LoteProduccion, Producto, Ticket, TurnoPersonal } from "@/lib/types"

export type DateRangeKey = "7d" | "14d" | "30d"

export function filterByRange<T extends { fecha: string }>(rows: T[], key: DateRangeKey) {
  const days = key === "7d" ? 7 : key === "14d" ? 14 : 30
  const max = new Date("2026-02-08T23:59:59-03:00").getTime()
  const min = max - days * 24 * 60 * 60 * 1000
  return rows.filter(r => {
    const t = new Date(r.fecha).getTime()
    return t >= min && t <= max
  })
}

export function ticketTotal(t: Ticket) {
  const subtotal = t.items.reduce((acc, it) => acc + it.cantidad * it.precioUnitario, 0)
  return Math.max(0, subtotal - t.descuento)
}

export function computeVentas(tickets: Ticket[]) {
  return tickets.reduce((acc, t) => acc + ticketTotal(t), 0)
}

export function computeTicketPromedio(tickets: Ticket[]) {
  if (tickets.length === 0) return 0
  return computeVentas(tickets) / tickets.length
}

export function computeMargenBruto(tickets: Ticket[], productos: Producto[]) {
  // estimación: costoUnitario * cantidad
  const map = new Map(productos.map(p => [p.id, p]))
  const ventas = computeVentas(tickets)
  const costo = tickets.reduce((acc, t) => {
    const c = t.items.reduce((a2, it) => {
      const p = map.get(it.productoId)
      const unitCost = p?.costoUnitario ?? 0
      return a2 + unitCost * it.cantidad
    }, 0)
    return acc + c
  }, 0)
  const margen = ventas - costo
  const pct = ventas <= 0 ? 0 : margen / ventas
  return { ventas, costo, margen, pct }
}

export function computeMerma(lotes: LoteProduccion[]) {
  const plan = lotes.reduce((a, l) => a + l.planificado, 0)
  const merma = lotes.reduce((a, l) => a + l.merma, 0)
  const pct = plan <= 0 ? 0 : merma / plan
  return { plan, merma, pct }
}

export function topProductosPorVentas(tickets: Ticket[], productos: Producto[], top = 7) {
  const mapProd = new Map(productos.map(p => [p.id, p]))
  const agg = new Map<string, { productoId: string; nombre: string; ventas: number; unidades: number }>()
  for (const t of tickets) {
    for (const it of t.items) {
      const p = mapProd.get(it.productoId)
      const key = it.productoId
      const prev = agg.get(key) ?? { productoId: key, nombre: p?.nombre ?? key, ventas: 0, unidades: 0 }
      prev.ventas += it.cantidad * it.precioUnitario
      prev.unidades += it.cantidad
      agg.set(key, prev)
    }
  }
  return Array.from(agg.values()).sort((a, b) => b.ventas - a.ventas).slice(0, top)
}

export function seriesVentasPorDia(tickets: Ticket[]) {
  // agrupamos por día (DD/MM) usando fecha del ticket
  const map = new Map<string, number>()
  for (const t of tickets) {
    const d = new Date(t.fecha)
    const key = `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`
    map.set(key, (map.get(key) ?? 0) + ticketTotal(t))
  }
  // orden básico por "mes/día" ya que el rango es corto
  const out = Array.from(map.entries()).map(([dia, ventas]) => ({ dia, ventas }))
  // keep as inserted order? We'll sort by parsed date using reference year 2026
  out.sort((a, b) => {
    const [da, ma] = a.dia.split("/").map(Number)
    const [db, mb] = b.dia.split("/").map(Number)
    const ta = new Date(2026, ma - 1, da).getTime()
    const tb = new Date(2026, mb - 1, db).getTime()
    return ta - tb
  })
  return out
}

export function computeCostoLaboral(turnos: TurnoPersonal[], empleadosMap: Map<string, { costoHora: number }>) {
  const horas = turnos.reduce((a, t) => a + t.horas, 0)
  const costo = turnos.reduce((a, t) => a + (empleadosMap.get(t.empleadoId)?.costoHora ?? 0) * t.horas, 0)
  return { horas, costo }
}
