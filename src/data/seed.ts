import type { Empleado, Insumo, LoteProduccion, MovimientoInventario, Producto, Receta, RegistroEnergia, Ticket, TurnoPersonal } from "@/lib/types"

/**
 * Seed 100% hardcodeado / determinístico.
 * No hay DB. Podés editar valores acá sin miedo.
 */

const BASE = new Date("2026-02-08T12:00:00-03:00").getTime()

function d(daysAgo: number, hh = 9, mm = 0) {
  const x = new Date(BASE)
  x.setDate(x.getDate() - daysAgo)
  x.setHours(hh, mm, 0, 0)
  return x.toISOString()
}

// PRNG deterministic (para generar data siempre igual)
function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6D2B79F5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const rnd = mulberry32(1337)

export const insumos: Insumo[] = [
  { id: "harina-000", nombre: "Harina 000", unidad: "kg", proveedor: "Molino San José", costoUnitario: 520, stockActual: 220, stockMinimo: 80 },
  { id: "harina-0000", nombre: "Harina 0000", unidad: "kg", proveedor: "Molino San José", costoUnitario: 560, stockActual: 120, stockMinimo: 50 },
  { id: "levadura", nombre: "Levadura", unidad: "kg", proveedor: "LevanCo", costoUnitario: 1900, stockActual: 12, stockMinimo: 6 },
  { id: "sal", nombre: "Sal fina", unidad: "kg", proveedor: "Salinas SA", costoUnitario: 280, stockActual: 18, stockMinimo: 8 },
  { id: "azucar", nombre: "Azúcar", unidad: "kg", proveedor: "Dulce Norte", costoUnitario: 920, stockActual: 55, stockMinimo: 20 },
  { id: "manteca", nombre: "Manteca", unidad: "kg", proveedor: "Lácteos La Vaca", costoUnitario: 4200, stockActual: 24, stockMinimo: 10 },
  { id: "huevos", nombre: "Huevos", unidad: "u", proveedor: "Granja El Trigal", costoUnitario: 140, stockActual: 380, stockMinimo: 200 },
  { id: "dulce-leche", nombre: "Dulce de leche", unidad: "kg", proveedor: "Dulzor", costoUnitario: 3900, stockActual: 16, stockMinimo: 8 },
  { id: "jamon", nombre: "Jamón", unidad: "kg", proveedor: "Fiambres Don Pepe", costoUnitario: 6900, stockActual: 9, stockMinimo: 6 },
  { id: "queso", nombre: "Queso", unidad: "kg", proveedor: "Fiambres Don Pepe", costoUnitario: 8200, stockActual: 11, stockMinimo: 7 },
  { id: "cafe", nombre: "Café en grano", unidad: "kg", proveedor: "Tueste Barrio", costoUnitario: 12500, stockActual: 6, stockMinimo: 4 }
]

export const productos: Producto[] = [
  { id: "pan-frances", nombre: "Pan francés", categoria: "Panadería", unidadVenta: "kg", precioVenta: 2200, costoUnitario: 980, activo: true, recetaId: "r-pan-frances" },
  { id: "pan-lactal", nombre: "Pan lactal", categoria: "Panadería", unidadVenta: "u", precioVenta: 2800, costoUnitario: 1200, activo: true, recetaId: "r-pan-lactal" },
  { id: "fugazzeta", nombre: "Fugazzeta", categoria: "Panadería", unidadVenta: "u", precioVenta: 3500, costoUnitario: 1600, activo: true, recetaId: "r-fugazzeta" },
  { id: "medialuna-manteca", nombre: "Medialuna de manteca", categoria: "Facturería", unidadVenta: "u", precioVenta: 550, costoUnitario: 240, activo: true, recetaId: "r-medialuna" },
  { id: "factura-dulce", nombre: "Factura (D. leche)", categoria: "Facturería", unidadVenta: "u", precioVenta: 650, costoUnitario: 290, activo: true, recetaId: "r-factura" },
  { id: "chipa", nombre: "Chipá", categoria: "Facturería", unidadVenta: "u", precioVenta: 450, costoUnitario: 230, activo: true },
  { id: "torta-rogel", nombre: "Rogel", categoria: "Pastelería", unidadVenta: "u", precioVenta: 18000, costoUnitario: 8200, activo: true },
  { id: "brownie", nombre: "Brownie", categoria: "Pastelería", unidadVenta: "u", precioVenta: 2500, costoUnitario: 1100, activo: true },
  { id: "sandwich-jyq", nombre: "Sándwich JyQ", categoria: "Sandwiches", unidadVenta: "u", precioVenta: 5200, costoUnitario: 2600, activo: true },
  { id: "cafe-americano", nombre: "Café americano", categoria: "Café", unidadVenta: "u", precioVenta: 1800, costoUnitario: 520, activo: true },
  { id: "cafe-latte", nombre: "Café latte", categoria: "Café", unidadVenta: "u", precioVenta: 2300, costoUnitario: 720, activo: true }
]

export const recetas: Receta[] = [
  {
    id: "r-pan-frances",
    productoId: "pan-frances",
    rindeUnidades: 10, // 10kg de pan (simplificado)
    ingredientes: [
      { insumoId: "harina-000", cantidad: 6, unidad: "kg" },
      { insumoId: "levadura", cantidad: 0.12, unidad: "kg" },
      { insumoId: "sal", cantidad: 0.12, unidad: "kg" }
    ]
  },
  {
    id: "r-pan-lactal",
    productoId: "pan-lactal",
    rindeUnidades: 8,
    ingredientes: [
      { insumoId: "harina-0000", cantidad: 2.2, unidad: "kg" },
      { insumoId: "levadura", cantidad: 0.06, unidad: "kg" },
      { insumoId: "sal", cantidad: 0.04, unidad: "kg" },
      { insumoId: "manteca", cantidad: 0.18, unidad: "kg" }
    ]
  },
  {
    id: "r-fugazzeta",
    productoId: "fugazzeta",
    rindeUnidades: 6,
    ingredientes: [
      { insumoId: "harina-000", cantidad: 1.8, unidad: "kg" },
      { insumoId: "levadura", cantidad: 0.05, unidad: "kg" },
      { insumoId: "sal", cantidad: 0.03, unidad: "kg" },
      { insumoId: "queso", cantidad: 0.6, unidad: "kg" }
    ]
  },
  {
    id: "r-medialuna",
    productoId: "medialuna-manteca",
    rindeUnidades: 40,
    ingredientes: [
      { insumoId: "harina-0000", cantidad: 2.4, unidad: "kg" },
      { insumoId: "azucar", cantidad: 0.25, unidad: "kg" },
      { insumoId: "manteca", cantidad: 0.55, unidad: "kg" },
      { insumoId: "huevos", cantidad: 6, unidad: "u" }
    ]
  },
  {
    id: "r-factura",
    productoId: "factura-dulce",
    rindeUnidades: 30,
    ingredientes: [
      { insumoId: "harina-0000", cantidad: 2.0, unidad: "kg" },
      { insumoId: "azucar", cantidad: 0.22, unidad: "kg" },
      { insumoId: "manteca", cantidad: 0.35, unidad: "kg" },
      { insumoId: "dulce-leche", cantidad: 0.55, unidad: "kg" },
      { insumoId: "huevos", cantidad: 4, unidad: "u" }
    ]
  }
]

export const empleados: Empleado[] = [
  { id: "e-ana", nombre: "Ana Díaz", rol: "Vendedor", costoHora: 4200, activo: true },
  { id: "e-mati", nombre: "Matías Rojas", rol: "Panadero", costoHora: 5600, activo: true },
  { id: "e-sol", nombre: "Sol Benítez", rol: "Pastelero", costoHora: 6100, activo: true },
  { id: "e-nico", nombre: "Nicolás Vera", rol: "Ayudante", costoHora: 3800, activo: true },
  { id: "e-vale", nombre: "Valeria Luna", rol: "Vendedor", costoHora: 4100, activo: true },
  { id: "e-lucho", nombre: "Luciano Paz", rol: "Delivery", costoHora: 3900, activo: true }
]

export const turnosPersonal: TurnoPersonal[] = Array.from({ length: 40 }).map((_, i) => {
  const day = Math.floor(i / 2) // 20 días
  const emp = empleados[Math.floor(rnd() * empleados.length)]
  const horas = 4 + Math.floor(rnd() * 6)
  return {
    id: `tp-${i + 1}`,
    fecha: d(day, 7 + Math.floor(rnd() * 10), 0),
    empleadoId: emp.id,
    horas
  }
})

export const lotesProduccion: LoteProduccion[] = Array.from({ length: 55 }).map((_, i) => {
  const day = Math.floor(i / 3)
  const turno = (["Mañana", "Tarde", "Noche"] as const)[i % 3]
  const p = productos[Math.floor(rnd() * productos.length)]
  const plan = 30 + Math.floor(rnd() * 70)
  const producido = Math.max(0, plan - Math.floor(rnd() * 10))
  const merma = Math.max(0, plan - producido)
  return {
    id: `l-${i + 1}`,
    fecha: d(day, turno === "Mañana" ? 6 : turno === "Tarde" ? 13 : 19, 0),
    turno,
    productoId: p.id,
    planificado: plan,
    producido,
    merma,
    nota: merma > 6 ? "Ajustar fermentación / horneado" : ""
  }
})

// Tickets de ventas (últimos ~20 días) con items "realistas"
const productosVenta = productos.filter(p => p.activo)
function pick<T>(arr: T[]) { return arr[Math.floor(rnd() * arr.length)] }

export const tickets: Ticket[] = Array.from({ length: 85 }).map((_, i) => {
  const day = Math.floor(rnd() * 20)
  const hh = 7 + Math.floor(rnd() * 13) // 7..19
  const mm = rnd() > 0.7 ? 30 : 0
  const canal = pick(["Mostrador", "Delivery", "Mayorista"] as const)
  const medioPago = pick(["Efectivo", "Débito", "Crédito", "QR"] as const)
  const itemsCount = canal === "Mayorista" ? 6 : canal === "Delivery" ? 4 : 3
  const items = Array.from({ length: itemsCount }).map(() => {
    const prod = pick(productosVenta)
    const cantidad = prod.unidadVenta === "kg"
      ? Number((0.5 + rnd() * 2.5).toFixed(1))
      : 1 + Math.floor(rnd() * (canal === "Mayorista" ? 12 : 6))
    // para variar precios por promo
    const promo = rnd() > 0.92 ? 0.9 : 1
    return {
      productoId: prod.id,
      cantidad,
      precioUnitario: Math.round(prod.precioVenta * promo)
    }
  })
  const descuento = rnd() > 0.86 ? 500 + Math.floor(rnd() * 1500) : 0
  return {
    id: `t-${i + 1}`,
    fecha: d(day, hh, mm),
    canal,
    medioPago,
    items,
    descuento
  }
})

export const movimientosInventario: MovimientoInventario[] = Array.from({ length: 60 }).map((_, i) => {
  const day = Math.floor(rnd() * 25)
  const ins = pick(insumos)
  const tipo = pick(["Entrada", "Salida", "Ajuste"] as const)
  const cantidad = tipo === "Entrada"
    ? Number((2 + rnd() * 40).toFixed(1))
    : tipo === "Salida"
      ? Number((1 + rnd() * 25).toFixed(1))
      : Number(((rnd() > 0.5 ? 1 : -1) * (1 + rnd() * 5)).toFixed(1))
  const motivo = tipo === "Entrada"
    ? "Compra proveedor"
    : tipo === "Salida"
      ? "Consumo producción"
      : "Corrección conteo"
  return {
    id: `m-${i + 1}`,
    fecha: d(day, 8 + Math.floor(rnd() * 10), 0),
    insumoId: ins.id,
    tipo,
    cantidad,
    motivo,
    referencia: tipo === "Entrada" ? `FAC-${1000 + i}` : tipo === "Salida" ? `LOTE-${1 + Math.floor(rnd() * 55)}` : "INV"
  }
})

export const energia: RegistroEnergia[] = Array.from({ length: 30 }).map((_, i) => {
  const day = i
  const horno = rnd() > 0.5 ? "Horno 1" : "Horno 2"
  const kwh = Number((22 + rnd() * 35).toFixed(1))
  const costo = Math.round(kwh * (rnd() > 0.5 ? 220 : 240))
  return { id: `en-${i + 1}`, fecha: d(day, 21, 0), horno, kwh, costo }
})
