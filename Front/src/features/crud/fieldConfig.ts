export const ENUM_OPTIONS: Record<string, string[]> = {
  activo: ["true", "false"],
  alertas: ["true", "false"],
  gps_ok: ["true", "false"],
  status: ["active", "disabled"],
  estado: ["preparado", "en_recorrido", "cerrado", "cancelado", "abierta", "anulada", "confirmado", "pendiente", "rechazado"],
  tipo: ["venta", "devolucion", "bonificacion", "ajuste", "Entrada", "Salida", "Ajuste", "pan_viejo_recibido", "pan_rallado_entregado", "ajuste_admin", "saldo_inicial", "pago", "nota_credito"],
  metodo: ["efectivo", "transferencia", "mercado_pago", "qr", "otro"],
  canal: ["Mostrador", "Delivery", "Mayorista"],
  medio_pago: ["Efectivo", "Débito", "Crédito", "QR"],
  unidad_venta: ["u", "kg"],
  unidad: ["kg", "g", "l", "u"],
  categoria: ["Panadería", "Facturería", "Pastelería", "Sandwiches", "Café"],
  turno: ["Mañana", "Tarde", "Noche"],
  rol: ["Panadero", "Ayudante", "Vendedor", "Pastelero", "Delivery", "Administrador", "Caja"]
}

export const LOOKUP_TABLE_BY_FIELD: Record<string, string> = {
  product_id: "products",
  producto_id: "products",
  supply_id: "supplies",
  insumo_id: "supplies",
  employee_id: "employees",
  driver_id: "employees",
  customer_id: "customers",
  route_id: "delivery_routes",
  delivery_run_id: "delivery_runs",
  visit_id: "delivery_visits",
  ticket_id: "tickets",
  recipe_id: "recipes",
  role_id: "app_roles",
  permission_id: "app_permissions"
}

export function fieldLabel(field: string) {
  const custom: Record<string, string> = {
    id: "ID",
    nombre: "Nombre",
    product_id: "Producto",
    supply_id: "Insumo",
    customer_id: "Cliente",
    driver_id: "Repartidor",
    route_id: "Recorrido",
    delivery_run_id: "Reparto",
    visit_id: "Visita",
    role_id: "Rol",
    permission_id: "Permiso",
    unidad_venta: "Unidad de venta",
    precio_venta: "Precio venta",
    costo_unitario: "Costo unitario",
    stock_actual: "Stock actual",
    stock_minimo: "Stock mínimo",
    rinde_unidades: "Rinde",
    medio_pago: "Medio de pago",
    created_at: "Creado",
    updated_at: "Actualizado"
  }
  if (custom[field]) return custom[field]
  return field.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())
}

export function isBooleanField(field: string) {
  return ["activo", "alertas", "gps_ok"].includes(field)
}

export function isTextareaField(field: string) {
  return /observaciones|descripcion|description|nota|notes|motivo|config|datos_/i.test(field)
}
