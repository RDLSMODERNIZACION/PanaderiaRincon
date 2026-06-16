type RouteCustomer = {
  id?: string
  nombre?: string
  name?: string
  direccion?: string
  address?: string
  latitud?: number | string | null
  longitud?: number | string | null
  lat?: number | string | null
  lng?: number | string | null
  orden?: number | string | null
  order?: number | string | null
  routeOrder?: number | string | null
  route_order?: number | string | null
  visitada?: boolean
  visited?: boolean
  estado?: string
  estadoVisita?: string
  estado_visita?: string
}

function numberOrNull(value: unknown) {
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function getOrder(customer: RouteCustomer, index: number) {
  const value =
    customer.orden ??
    customer.order ??
    customer.routeOrder ??
    customer.route_order ??
    index

  const n = Number(value)
  return Number.isFinite(n) ? n : index
}

function customerLabel(customer: RouteCustomer) {
  return String(customer.nombre || customer.name || "Cliente").trim()
}

function customerAddress(customer: RouteCustomer) {
  return String(customer.direccion || customer.address || "").trim()
}

function customerPoint(customer: RouteCustomer) {
  const lat = numberOrNull(customer.latitud ?? customer.lat)
  const lng = numberOrNull(customer.longitud ?? customer.lng)

  if (lat !== null && lng !== null) {
    return `${lat},${lng}`
  }

  const address = customerAddress(customer)

  if (!address) return ""

  return `${address}, Rincón de los Sauces, Neuquén, Argentina`
}

export function sortRouteCustomers(customers: RouteCustomer[]) {
  return [...customers].sort((a, b) => {
    return getOrder(a, 0) - getOrder(b, 0)
  })
}

export function isCustomerVisited(customer: RouteCustomer) {
  const estado = String(customer.estado || customer.estadoVisita || customer.estado_visita || "").toLowerCase()

  return (
    customer.visitada === true ||
    customer.visited === true ||
    estado === "visitado" ||
    estado === "cerrada" ||
    estado === "cerrado"
  )
}

export function buildGoogleMapsRouteUrl(customers: RouteCustomer[]) {
  const points = sortRouteCustomers(customers)
    .map(customerPoint)
    .filter(Boolean)

  if (points.length === 0) return ""

  if (points.length === 1) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(points[0])}`
  }

  const destination = encodeURIComponent(points[points.length - 1])
  const waypoints = points
    .slice(0, -1)
    .map(point => encodeURIComponent(point))
    .join("%7C")

  return [
    "https://www.google.com/maps/dir/?api=1",
    "origin=Current%20Location",
    `destination=${destination}`,
    waypoints ? `waypoints=${waypoints}` : "",
    "travelmode=driving"
  ]
    .filter(Boolean)
    .join("&")
}

export function buildAppleMapsNextStopUrl(customers: RouteCustomer[]) {
  const points = sortRouteCustomers(customers)
    .map(customerPoint)
    .filter(Boolean)

  if (points.length === 0) return ""

  return `https://maps.apple.com/?daddr=${encodeURIComponent(points[0])}&dirflg=d`
}

export function routeCustomersForMaps(customers: RouteCustomer[], onlyPending = true) {
  const list = Array.isArray(customers) ? customers : []

  const filtered = onlyPending
    ? list.filter(customer => !isCustomerVisited(customer))
    : list

  return sortRouteCustomers(filtered.length > 0 ? filtered : list)
}