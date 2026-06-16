"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Clock,
  MapPin,
  MapPinned,
  PackageCheck,
  Play,
  RefreshCw,
  Search,
  Store,
  Truck,
  XCircle
} from "lucide-react"
import Button from "@/components/ui/Button"
import Input from "@/components/ui/Input"
import { Card, CardBody, CardHeader } from "@/components/ui/Card"
import { EmptyBlock, ErrorBlock, LoadingBlock } from "@/components/data/AsyncState"
import { apiGet, apiPost, unwrapData } from "@/lib/api"
import { useAuth } from "@/features/auth/AuthProvider"
import VisitModal from "@/features/repartidor/VisitModal"

type RepartidorStock = {
  id: string
  productId?: string
  product_id?: string
  productNombre?: string
  product_nombre?: string
  unidadVenta?: string
  unidad_venta?: string
  precioVenta?: number
  precio_venta?: number
  cantidadCargada?: number
  cantidad_cargada?: number
  cantidadEntregada?: number
  cantidad_entregada?: number
  cantidadRestante?: number
  cantidad_restante?: number
}

type RepartidorCustomer = {
  routeCustomerId?: string
  route_customer_id?: string
  customerId?: string
  customer_id?: string
  orden?: number | string | null
  order?: number | string | null
  routeOrder?: number | string | null
  route_order?: number | string | null

  nombre?: string
  name?: string
  direccion?: string | null
  address?: string | null
  telefono?: string | null
  observaciones?: string | null

  latitud?: number | string | null
  longitud?: number | string | null
  lat?: number | string | null
  lng?: number | string | null

  estadoVisita?: string
  estado_visita?: string
  estado?: string
  visitada?: boolean
  visited?: boolean
  visit?: any
}

type MiRepartoData = {
  user: {
    userId?: string
    user_id?: string
    nombre?: string
    employeeId?: string
    employee_id?: string
    employeeNombre?: string
    employee_nombre?: string
    employeeRol?: string
    employee_rol?: string
  }
  run: {
    id: string
    fecha: string
    driverId?: string
    driver_id?: string
    driverNombre?: string
    driver_nombre?: string
    routeId?: string
    route_id?: string
    routeNombre?: string
    route_nombre?: string
    estado: string
    startedAt?: string | null
    started_at?: string | null
    closedAt?: string | null
    closed_at?: string | null
  }
  stock: RepartidorStock[]
  customers: RepartidorCustomer[]
  summary?: {
    productosCargados?: number
    productos_cargados?: number
    clientesTotal?: number
    clientes_total?: number
    clientesVisitados?: number
    clientes_visitados?: number
    clientesPendientes?: number
    clientes_pendientes?: number
  }
}

type CustomerFilter = "pendientes" | "todos" | "visitados"

function formatDate(value?: string | null) {
  if (!value) return "-"

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-")
    return `${day}/${month}/${year}`
  }

  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value

  return d.toLocaleString("es-AR", {
    dateStyle: "short",
    timeStyle: "short"
  })
}

function stockProductId(item: RepartidorStock) {
  return String(item.productId || item.product_id || "")
}

function stockName(item: RepartidorStock) {
  return String(item.productNombre || item.product_nombre || stockProductId(item))
}

function stockUnit(item: RepartidorStock) {
  return String(item.unidadVenta || item.unidad_venta || "")
}

function stockLoaded(item: RepartidorStock) {
  return Number(item.cantidadCargada ?? item.cantidad_cargada ?? 0)
}

function stockRemaining(item: RepartidorStock) {
  return Number(item.cantidadRestante ?? item.cantidad_restante ?? stockLoaded(item))
}

function customerId(customer: RepartidorCustomer) {
  return String(customer.customerId || customer.customer_id || "")
}

function customerName(customer: RepartidorCustomer) {
  return String(customer.nombre || customer.name || customerId(customer) || "Cliente")
}

function customerAddress(customer: RepartidorCustomer) {
  return String(customer.direccion || customer.address || "").trim()
}

function customerStatus(customer: RepartidorCustomer) {
  return String(customer.estadoVisita || customer.estado_visita || customer.estado || "pendiente").toLowerCase()
}

function customerOrder(customer: RepartidorCustomer, index = 0) {
  const value = customer.orden ?? customer.order ?? customer.routeOrder ?? customer.route_order ?? index
  const n = Number(value)
  return Number.isFinite(n) ? n : index
}

function statusClass(status: string) {
  if (status === "visitado") return "bg-emerald-100 text-emerald-700"
  if (status === "abierta") return "bg-blue-100 text-blue-700"
  return "bg-amber-100 text-amber-800"
}

function statusLabel(status: string) {
  if (status === "visitado") return "Visitado"
  if (status === "abierta") return "Abierto"
  return "Pendiente"
}

function runStatusClass(status: string) {
  if (status === "en_recorrido") return "bg-blue-100 text-blue-700"
  if (status === "cerrado") return "bg-zinc-900 text-white"
  return "bg-amber-100 text-amber-800"
}

function qty(value: number) {
  return Number(value || 0).toLocaleString("es-AR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  })
}

function normalize(text: unknown) {
  return String(text || "").trim().toLowerCase()
}

function numberOrNull(value: unknown) {
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function customerMapPoint(customer: RepartidorCustomer) {
  const lat = numberOrNull(customer.latitud ?? customer.lat)
  const lng = numberOrNull(customer.longitud ?? customer.lng)

  if (lat !== null && lng !== null) {
    return `${lat},${lng}`
  }

  const address = customerAddress(customer)

  if (!address) return ""

  return `${address}, Rincón de los Sauces, Neuquén, Argentina`
}

function isCustomerVisited(customer: RepartidorCustomer) {
  const status = customerStatus(customer)

  return (
    customer.visitada === true ||
    customer.visited === true ||
    status === "visitado" ||
    status === "cerrada" ||
    status === "cerrado"
  )
}

function sortedRouteCustomers(customers: RepartidorCustomer[]) {
  return [...customers].sort((a, b) => customerOrder(a) - customerOrder(b))
}

function routeCustomersForMaps(customers: RepartidorCustomer[], onlyPending = true) {
  const sorted = sortedRouteCustomers(customers)
  const pending = sorted.filter(customer => !isCustomerVisited(customer))

  if (onlyPending && pending.length > 0) return pending
  return sorted
}

function buildGoogleMapsRouteUrl(customers: RepartidorCustomer[]) {
  const points = customers.map(customerMapPoint).filter(Boolean)

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

export default function MiRepartoView() {
  const { session } = useAuth()

  const [data, setData] = useState<MiRepartoData | null>(null)
  const [selectedCustomer, setSelectedCustomer] = useState<RepartidorCustomer | null>(null)
  const [loading, setLoading] = useState(true)
  const [starting, setStarting] = useState(false)
  const [finalizing, setFinalizing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [q, setQ] = useState("")
  const [filter, setFilter] = useState<CustomerFilter>("pendientes")

  const load = useCallback(async () => {
    if (!session) return

    setLoading(true)
    setError(null)

    try {
      const payload = await apiGet(session, "/api/repartidor/mi-reparto")
      setData(unwrapData<MiRepartoData>(payload))
    } catch (exc: any) {
      setError(exc?.message || "No se pudo cargar el reparto")
    } finally {
      setLoading(false)
    }
  }, [session])

  useEffect(() => {
    load()
  }, [load])

  const sortedCustomers = useMemo(() => {
    return sortedRouteCustomers(data?.customers || [])
  }, [data])

  const mapCustomers = useMemo(() => {
    return routeCustomersForMaps(sortedCustomers, true)
  }, [sortedCustomers])

  const googleMapsUrl = useMemo(() => {
    return buildGoogleMapsRouteUrl(mapCustomers)
  }, [mapCustomers])

  const filteredCustomers = useMemo(() => {
    const search = q.trim().toLowerCase()

    return sortedCustomers.filter(customer => {
      const status = customerStatus(customer)

      if (filter === "pendientes" && status === "visitado") return false
      if (filter === "visitados" && status !== "visitado") return false

      if (!search) return true

      const text = [
        customerOrder(customer),
        customerName(customer),
        customerAddress(customer),
        customer.telefono,
        customer.observaciones,
        status
      ]
        .map(normalize)
        .join(" ")

      return text.includes(search)
    })
  }, [sortedCustomers, q, filter])

  const visitedCount = useMemo(() => {
    return sortedCustomers.filter(customer => customerStatus(customer) === "visitado").length
  }, [sortedCustomers])

  const pendingCount = Math.max(sortedCustomers.length - visitedCount, 0)
  const progress = sortedCustomers.length > 0 ? Math.round((visitedCount / sortedCustomers.length) * 100) : 0

  function openGoogleMapsRoute() {
    if (!googleMapsUrl) return
    window.open(googleMapsUrl, "_blank", "noopener,noreferrer")
  }

  async function iniciarReparto() {
    if (!session || !data?.run?.id) return

    setStarting(true)
    setError(null)

    try {
      await apiPost(session, `/api/repartidor/mi-reparto/${encodeURIComponent(data.run.id)}/iniciar`, {})
      setFilter("pendientes")
      await load()
    } catch (exc: any) {
      setError(exc?.message || "No se pudo iniciar el reparto")
    } finally {
      setStarting(false)
    }
  }

  async function finalizarReparto() {
    if (!session || !data?.run?.id) return

    const text =
      pendingCount > 0
        ? `Todavía quedan ${pendingCount} local(es) pendiente(s). ¿Querés finalizar igual?`
        : "¿Querés finalizar el reparto?"

    if (!window.confirm(text)) return

    setFinalizing(true)
    setError(null)

    try {
      await apiPost(session, `/api/repartidor/mi-reparto/${encodeURIComponent(data.run.id)}/finalizar`, {})
      await load()
    } catch (exc: any) {
      setError(exc?.message || "No se pudo finalizar el reparto")
    } finally {
      setFinalizing(false)
    }
  }

  if (loading) return <LoadingBlock />
  if (error) return <ErrorBlock error={error} onRetry={load} />
  if (!data) return <EmptyBlock label="No hay reparto activo asignado." />

  const run = data.run
  const driverName = run.driverNombre || run.driver_nombre || "-"
  const routeName = run.routeNombre || run.route_nombre || "-"
  const productosCargados = data.summary?.productosCargados ?? data.summary?.productos_cargados ?? data.stock.length
  const isPrepared = run.estado === "preparado"
  const isInProgress = run.estado === "en_recorrido"
  const isClosed = run.estado === "cerrado"

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden">
        <div className="bg-zinc-900 px-4 py-4 text-white sm:px-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-xs font-medium text-zinc-300">
                <Truck className="h-4 w-4" />
                Mi reparto
              </div>

              <div className="mt-2 truncate text-2xl font-semibold">{routeName}</div>

              <div className="mt-1 text-sm text-zinc-300">
                {formatDate(run.fecha)} · {driverName}
              </div>
            </div>

            <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${runStatusClass(run.estado)}`}>
              {run.estado}
            </span>
          </div>

          <div className="mt-4">
            <div className="flex items-center justify-between text-xs text-zinc-300">
              <span>Avance del recorrido</span>
              <span>
                {visitedCount}/{sortedCustomers.length} locales
              </span>
            </div>

            <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/20">
              <div className="h-full rounded-full bg-white" style={{ width: `${progress}%` }} />
            </div>
          </div>
        </div>

        <CardBody>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-3">
              <PackageCheck className="h-5 w-5 text-zinc-500" />
              <div className="mt-2 text-2xl font-semibold text-zinc-900">{productosCargados}</div>
              <div className="text-xs text-zinc-500">productos</div>
            </div>

            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-3">
              <Store className="h-5 w-5 text-zinc-500" />
              <div className="mt-2 text-2xl font-semibold text-zinc-900">{sortedCustomers.length}</div>
              <div className="text-xs text-zinc-500">locales</div>
            </div>

            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-3">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              <div className="mt-2 text-2xl font-semibold text-zinc-900">{visitedCount}</div>
              <div className="text-xs text-zinc-500">visitados</div>
            </div>

            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-3">
              <Clock className="h-5 w-5 text-amber-600" />
              <div className="mt-2 text-2xl font-semibold text-zinc-900">{pendingCount}</div>
              <div className="text-xs text-zinc-500">pendientes</div>
            </div>
          </div>

          <div className="mt-4 hidden md:block">
            <Button
              type="button"
              onClick={openGoogleMapsRoute}
              disabled={!googleMapsUrl}
              className="h-12 w-full"
            >
              <MapPinned className="mr-2 h-5 w-5" />
              Ver recorrido
            </Button>
          </div>

          {!googleMapsUrl ? (
            <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              Para ver el recorrido, los clientes deben tener dirección o coordenadas cargadas.
            </div>
          ) : null}

          <div className="mt-4 hidden flex-col gap-2 md:flex md:flex-row md:justify-end">
            <Button variant="secondary" onClick={load} className="h-12 w-full md:w-auto">
              <RefreshCw className="mr-2 h-4 w-4" />
              Actualizar
            </Button>

            {isPrepared ? (
              <Button onClick={iniciarReparto} disabled={starting} className="h-12 w-full md:w-auto">
                <Play className="mr-2 h-4 w-4" />
                {starting ? "Iniciando..." : "Iniciar reparto"}
              </Button>
            ) : null}

            {isInProgress ? (
              <Button
                variant="secondary"
                onClick={finalizarReparto}
                disabled={finalizing}
                className="h-12 w-full md:w-auto"
              >
                <CheckCircle2 className="mr-2 h-4 w-4" />
                {finalizing ? "Finalizando..." : "Finalizar reparto"}
              </Button>
            ) : null}
          </div>
        </CardBody>
      </Card>

      {isClosed ? (
        <Card>
          <CardBody>
            <div className="flex gap-3 rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
              <XCircle className="mt-0.5 h-5 w-5 text-zinc-500" />

              <div>
                <div className="font-semibold text-zinc-900">Reparto cerrado</div>

                <div className="mt-1 text-sm text-zinc-600">
                  Este reparto ya fue finalizado. No se pueden cargar nuevas visitas.
                </div>
              </div>
            </div>
          </CardBody>
        </Card>
      ) : null}

      {isPrepared ? (
        <Card>
          <CardHeader
            title="Listo para salir"
            subtitle="Cuando administración termine de cargar mercadería, iniciá el recorrido."
          />

          <CardBody>
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <div className="flex gap-3">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />

                <div>
                  <div className="font-semibold">El reparto todavía está preparado.</div>

                  <div className="mt-1">
                    Iniciá el reparto para habilitar la carga de visitas en cada local.
                  </div>
                </div>
              </div>
            </div>
          </CardBody>
        </Card>
      ) : null}

      {isInProgress ? (
        <>
          <Card>
            <CardHeader
              title="Locales del recorrido"
              subtitle="Tocá un local para registrar entrega, cobro y pan viejo."
            />

            <CardBody className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-3.5 h-4 w-4 text-zinc-400" />

                <Input
                  value={q}
                  onChange={event => setQ(event.target.value)}
                  placeholder="Buscar local, dirección o teléfono..."
                  className="h-12 pl-9 text-base"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setFilter("pendientes")}
                  className={`rounded-2xl px-3 py-2 text-sm font-medium ${
                    filter === "pendientes"
                      ? "bg-zinc-900 text-white"
                      : "border border-zinc-200 bg-white text-zinc-700"
                  }`}
                >
                  Pendientes
                </button>

                <button
                  type="button"
                  onClick={() => setFilter("todos")}
                  className={`rounded-2xl px-3 py-2 text-sm font-medium ${
                    filter === "todos"
                      ? "bg-zinc-900 text-white"
                      : "border border-zinc-200 bg-white text-zinc-700"
                  }`}
                >
                  Todos
                </button>

                <button
                  type="button"
                  onClick={() => setFilter("visitados")}
                  className={`rounded-2xl px-3 py-2 text-sm font-medium ${
                    filter === "visitados"
                      ? "bg-zinc-900 text-white"
                      : "border border-zinc-200 bg-white text-zinc-700"
                  }`}
                >
                  Visitados
                </button>
              </div>
            </CardBody>

            <CardBody className="p-0">
              {filteredCustomers.length === 0 ? (
                <div className="p-5">
                  <EmptyBlock label="No hay locales para mostrar con este filtro." />
                </div>
              ) : (
                <div className="divide-y divide-zinc-100">
                  {filteredCustomers.map(customer => {
                    const status = customerStatus(customer)

                    return (
                      <button
                        key={customerId(customer)}
                        type="button"
                        onClick={() => setSelectedCustomer(customer)}
                        className="flex w-full items-center gap-3 px-4 py-4 text-left transition hover:bg-zinc-50 sm:px-5"
                      >
                        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-zinc-100 text-base font-bold text-zinc-700">
                          {customerOrder(customer) || "-"}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="truncate text-base font-semibold text-zinc-900">
                              {customerName(customer)}
                            </div>

                            <span className={`rounded-full px-2 py-1 text-[11px] font-medium ${statusClass(status)}`}>
                              {statusLabel(status)}
                            </span>
                          </div>

                          {customerAddress(customer) ? (
                            <div className="mt-1 flex items-center gap-1 text-sm text-zinc-500">
                              <MapPin className="h-3.5 w-3.5 shrink-0" />
                              <span className="truncate">{customerAddress(customer)}</span>
                            </div>
                          ) : null}

                          {customer.telefono ? (
                            <div className="mt-1 text-xs text-zinc-500">{customer.telefono}</div>
                          ) : null}
                        </div>

                        <ChevronRight className="h-5 w-5 shrink-0 text-zinc-400" />
                      </button>
                    )
                  })}
                </div>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Mercadería disponible" subtitle="Control rápido de lo que queda en el reparto." />

            <CardBody>
              {data.stock.length === 0 ? (
                <EmptyBlock label="No hay mercadería asignada." />
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {data.stock.map(item => (
                    <div key={String(item.id)} className="rounded-2xl border border-zinc-200 p-4">
                      <div className="font-semibold text-zinc-900">{stockName(item)}</div>
                      <div className="mt-1 text-xs text-zinc-500">Unidad: {stockUnit(item) || "-"}</div>

                      <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                        <div className="rounded-xl bg-zinc-50 p-3">
                          <div className="text-xs text-zinc-500">Cargado</div>
                          <div className="text-lg font-semibold text-zinc-900">{qty(stockLoaded(item))}</div>
                        </div>

                        <div className="rounded-xl bg-zinc-50 p-3">
                          <div className="text-xs text-zinc-500">Restante</div>
                          <div className="text-lg font-semibold text-zinc-900">{qty(stockRemaining(item))}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardBody>
          </Card>
        </>
      ) : null}

      {isPrepared || isInProgress ? (
        <div className="fixed inset-x-3 bottom-20 z-30 md:hidden">
          <div className="rounded-3xl border border-zinc-200 bg-white/95 p-2 shadow-2xl backdrop-blur">
            {isPrepared ? (
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={openGoogleMapsRoute}
                  disabled={!googleMapsUrl}
                  className="h-14 rounded-2xl text-base"
                >
                  <MapPinned className="mr-2 h-5 w-5" />
                  Recorrido
                </Button>

                <Button onClick={iniciarReparto} disabled={starting} className="h-14 rounded-2xl text-base">
                  <Play className="mr-2 h-5 w-5" />
                  {starting ? "Iniciando..." : "Iniciar"}
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={openGoogleMapsRoute}
                  disabled={!googleMapsUrl}
                  className="h-12 rounded-2xl"
                >
                  <MapPinned className="mr-1 h-4 w-4" />
                  Ruta
                </Button>

                <Button variant="secondary" onClick={load} className="h-12 rounded-2xl">
                  <RefreshCw className="mr-1 h-4 w-4" />
                  Act.
                </Button>

                <Button variant="secondary" onClick={finalizarReparto} disabled={finalizing} className="h-12 rounded-2xl">
                  <CheckCircle2 className="mr-1 h-4 w-4" />
                  Fin
                </Button>
              </div>
            )}
          </div>
        </div>
      ) : null}

      <VisitModal
        open={!!selectedCustomer}
        runId={run.id}
        customer={selectedCustomer}
        stock={data.stock}
        session={session}
        onClose={() => setSelectedCustomer(null)}
        onSaved={async () => {
          setSelectedCustomer(null)
          await load()
        }}
      />
    </div>
  )
}