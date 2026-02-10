export type CanalVenta = "Mostrador" | "Delivery" | "Mayorista"
export type MedioPago = "Efectivo" | "Débito" | "Crédito" | "QR"
export type Turno = "Mañana" | "Tarde" | "Noche"

export type CategoriaProducto = "Panadería" | "Facturería" | "Pastelería" | "Sandwiches" | "Café"

export type UnidadInsumo = "kg" | "g" | "l" | "u"

export type Producto = {
  id: string
  nombre: string
  categoria: CategoriaProducto
  unidadVenta: "u" | "kg"
  precioVenta: number
  costoUnitario: number
  activo: boolean
  recetaId?: string
}

export type Insumo = {
  id: string
  nombre: string
  unidad: UnidadInsumo
  proveedor: string
  costoUnitario: number
  stockActual: number
  stockMinimo: number
}

export type RecetaIngrediente = {
  insumoId: string
  cantidad: number
  unidad: UnidadInsumo
}

export type Receta = {
  id: string
  productoId: string
  rindeUnidades: number
  ingredientes: RecetaIngrediente[]
}

export type TicketItem = {
  productoId: string
  cantidad: number
  precioUnitario: number
}

export type Ticket = {
  id: string
  fecha: string
  canal: CanalVenta
  medioPago: MedioPago
  items: TicketItem[]
  descuento: number
}

export type LoteProduccion = {
  id: string
  fecha: string
  turno: Turno
  productoId: string
  planificado: number
  producido: number
  merma: number
  nota?: string
}

export type MovimientoInventario = {
  id: string
  fecha: string
  insumoId: string
  tipo: "Entrada" | "Salida" | "Ajuste"
  cantidad: number
  motivo: string
  referencia?: string
}

export type Empleado = {
  id: string
  nombre: string
  rol: "Panadero" | "Ayudante" | "Vendedor" | "Pastelero" | "Delivery"
  costoHora: number
  activo: boolean
}

export type TurnoPersonal = {
  id: string
  fecha: string
  empleadoId: string
  horas: number
}

export type RegistroEnergia = {
  id: string
  fecha: string
  horno: "Horno 1" | "Horno 2"
  kwh: number
  costo: number
}
