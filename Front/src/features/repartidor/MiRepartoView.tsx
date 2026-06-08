"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  CheckCircle2,
  Clock,
  MapPin,
  PackageCheck,
  Play,
  RefreshCw,
  Store,
  Truck
} from "lucide-react"
import Button from "@/components/ui/Button"
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
  orden?: number
  nombre?: string
  direccion?: string | null
  telefono?: string | null
  observaciones?: string | null
  estadoVisita?: string
  estado_visita?: string
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
    createdAt?: string | null
    created_at?: string | null
  }
  stock: RepartidorStock[]
  customers: RepartidorCustomer[]
  summary: {
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

function customerStatus(customer: RepartidorCustomer) {
  return String(customer.estadoVisita || customer.estado_visita || "pendiente")
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

export default function MiRepartoView() {
  const { session } = useAuth()

  const [data, setData] = useState<MiRepartoData | null>(null)
  const [selectedCustomer, setSelectedCustomer] = useState<RepartidorCustomer | null>(null)
  const [loading, setLoading] = useState(true)
  const [starting, setStarting] = useState(false)
  const [finishing, setFinishing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (runId?: string) => {
    if (!session) return

    setLoading(true)
    setError(null)

    try {
      const path = runId
        ? `/api/repartidor/mi-reparto/${encodeURIComponent(runId)}`
        : "/api/repartidor/mi-reparto"

      const payload = await apiGet(session, path)
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
    return [...(data?.customers || [])].sort((a, b) => Number(a.orden || 0) - Number(b.orden || 0))
  }, [data])

  async function iniciarReparto() {
    if (!session || !data?.run?.id) return

    setStarting(true)
    setError(null)

    try {
      await apiPost(
        session,
        `/api/repartidor/mi-reparto/${encodeURIComponent(data.run.id)}/iniciar`,
        {}
      )

      await load(data.run.id)
    } catch (exc: any) {
      setError(exc?.message || "No se pudo iniciar el reparto")
    } finally {
      setStarting(false)
    }
  }

  async function finalizarReparto() {
    if (!session || !data?.run?.id) return

    if (!window.confirm("¿Finalizar este reparto? Después no se podrán cargar más visitas.")) return

    setFinishing(true)
    setError(null)

    try {
      await apiPost(
        session,
        `/api/repartidor/mi-reparto/${encodeURIComponent(data.run.id)}/finalizar`,
        {}
      )

      setSelectedCustomer(null)
      await load(data.run.id)
    } catch (exc: any) {
      setError(exc?.message || "No se pudo finalizar el reparto")
    } finally {
      setFinishing(false)
    }
  }

  if (loading) return <LoadingBlock />
  if (error) return <ErrorBlock error={error} onRetry={() => load(data?.run?.id)} />
  if (!data) return <EmptyBlock label="No hay reparto activo asignado." />

  const run = data.run
  const summary = data.summary || {}

  const isPrepared = run.estado === "preparado"
  const isStarted = run.estado === "en_recorrido"
  const isClosed = run.estado === "cerrado"

  const productosCargados = summary.productosCargados ?? summary.productos_cargados ?? data.stock.length
  const clientesTotal = summary.clientesTotal ?? summary.clientes_total ?? data.customers.length
  const clientesVisitados = summary.clientesVisitados ?? summary.clientes_visitados ?? 0
  const clientesPendientes = summary.clientesPendientes ?? summary.clientes_pendientes ?? 0

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader
          title="Mi reparto"
          subtitle="Pantalla operativa para el repartidor."
          right={
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="secondary" onClick={() => load(run.id)}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Actualizar
              </Button>

              {isPrepared ? (
                <Button onClick={iniciarReparto} disabled={starting}>
                  <Play className="mr-2 h-4 w-4" />
                  {starting ? "Iniciando..." : "Iniciar reparto"}
                </Button>
              ) : null}

              {isStarted ? (
                <Button onClick={finalizarReparto} disabled={finishing}>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  {finishing ? "Finalizando..." : "Finalizar reparto"}
                </Button>
              ) : null}
            </div>
          }
        />

        <CardBody>
          <div className="grid gap-3 md:grid-cols-4">
            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
              <div className="text-xs font-medium text-zinc-500">Fecha</div>
              <div className="mt-1 text-lg font-semibold text-zinc-900">{formatDate(run.fecha)}</div>
            </div>

            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
              <div className="text-xs font-medium text-zinc-500">Repartidor</div>
              <div className="mt-1 text-lg font-semibold text-zinc-900">{run.driverNombre || run.driver_nombre || "-"}</div>
            </div>

            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
              <div className="text-xs font-medium text-zinc-500">Recorrido</div>
              <div className="mt-1 text-lg font-semibold text-zinc-900">{run.routeNombre || run.route_nombre || "-"}</div>
            </div>

            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
              <div className="text-xs font-medium text-zinc-500">Estado</div>
              <div className="mt-1 text-lg font-semibold text-zinc-900">{run.estado}</div>
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-4">
            <div className="rounded-2xl bg-zinc-900 p-4 text-white">
              <PackageCheck className="h-5 w-5 opacity-80" />
              <div className="mt-2 text-2xl font-semibold">{productosCargados}</div>
              <div className="text-xs opacity-80">productos cargados</div>
            </div>

            <div className="rounded-2xl border border-zinc-200 p-4">
              <Store className="h-5 w-5 text-zinc-500" />
              <div className="mt-2 text-2xl font-semibold">{clientesTotal}</div>
              <div className="text-xs text-zinc-500">locales</div>
            </div>

            <div className="rounded-2xl border border-zinc-200 p-4">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              <div className="mt-2 text-2xl font-semibold">{clientesVisitados}</div>
              <div className="text-xs text-zinc-500">visitados</div>
            </div>

            <div className="rounded-2xl border border-zinc-200 p-4">
              <Clock className="h-5 w-5 text-amber-600" />
              <div className="mt-2 text-2xl font-semibold">{clientesPendientes}</div>
              <div className="text-xs text-zinc-500">pendientes</div>
            </div>
          </div>
        </CardBody>
      </Card>

      {!isStarted ? (
        <Card>
          <CardHeader
            title={isClosed ? "Reparto finalizado" : "Reparto pendiente de inicio"}
            subtitle={
              isClosed
                ? "Este reparto ya fue finalizado. No se pueden cargar más visitas."
                : "Para ver la mercadería, los locales y registrar visitas, primero tenés que iniciar el reparto."
            }
          />
          <CardBody>
            <div className={`rounded-2xl border px-4 py-4 text-sm ${
              isClosed
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-amber-200 bg-amber-50 text-amber-800"
            }`}>
              {isClosed
                ? "El reparto quedó cerrado para rendición."
                : "Tocá “Iniciar reparto” cuando el repartidor salga a la calle."}
            </div>
          </CardBody>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader title="Mercadería asignada" subtitle="Lo cargado por administración para este reparto." />
            <CardBody>
              {data.stock.length === 0 ? (
                <EmptyBlock label="Todavía no hay mercadería asignada." />
              ) : (
                <div className="grid gap-3 md:grid-cols-3">
                  {data.stock.map(item => (
                    <div key={String(item.id)} className="rounded-2xl border border-zinc-200 p-4">
                      <div className="font-semibold text-zinc-900">{stockName(item)}</div>
                      <div className="mt-1 text-xs text-zinc-500">Unidad: {stockUnit(item) || "-"}</div>

                      <div className="mt-3 flex items-end justify-between">
                        <div>
                          <div className="text-xs text-zinc-500">Cargado</div>
                          <div className="text-xl font-semibold">{stockLoaded(item)}</div>
                        </div>

                        <div className="text-right">
                          <div className="text-xs text-zinc-500">Restante</div>
                          <div className="text-xl font-semibold">{stockRemaining(item)}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Locales del recorrido" subtitle="Tocá un local para registrar mercadería, cobro, deuda y pan viejo." />
            <CardBody className="p-0">
              {sortedCustomers.length === 0 ? (
                <div className="p-5">
                  <EmptyBlock label="Este recorrido todavía no tiene clientes asociados." />
                </div>
              ) : (
                <div className="divide-y divide-zinc-100">
                  {sortedCustomers.map(customer => {
                    const status = customerStatus(customer)

                    return (
                      <button
                        key={customerId(customer)}
                        type="button"
                        onClick={() => setSelectedCustomer(customer)}
                        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition hover:bg-zinc-50"
                      >
                        <div className="flex min-w-0 items-start gap-3">
                          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-zinc-100 text-sm font-semibold text-zinc-700">
                            {customer.orden || "-"}
                          </div>

                          <div className="min-w-0">
                            <div className="font-semibold text-zinc-900">{customer.nombre || customerId(customer)}</div>

                            {customer.direccion ? (
                              <div className="mt-1 flex items-center gap-1 text-sm text-zinc-500">
                                <MapPin className="h-3.5 w-3.5" />
                                {customer.direccion}
                              </div>
                            ) : null}

                            {customer.telefono ? (
                              <div className="mt-1 text-xs text-zinc-500">{customer.telefono}</div>
                            ) : null}
                          </div>
                        </div>

                        <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${statusClass(status)}`}>
                          {statusLabel(status)}
                        </span>
                      </button>
                    )
                  })}
                </div>
              )}
            </CardBody>
          </Card>

          <VisitModal
            open={!!selectedCustomer}
            runId={run.id}
            customer={selectedCustomer}
            stock={data.stock}
            session={session}
            onClose={() => setSelectedCustomer(null)}
            onSaved={async () => {
              setSelectedCustomer(null)
              await load(run.id)
            }}
          />
        </>
      )}
    </div>
  )
}