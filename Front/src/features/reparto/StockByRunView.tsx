"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Download, PackageCheck, Pencil, RefreshCw, Search, Truck } from "lucide-react"
import Badge from "@/components/ui/Badge"
import Button from "@/components/ui/Button"
import Input from "@/components/ui/Input"
import Modal from "@/components/ui/Modal"
import { Card, CardBody, CardHeader } from "@/components/ui/Card"
import { EmptyBlock, ErrorBlock, LoadingBlock } from "@/components/data/AsyncState"
import { apiGet, type ApiSession, unwrapData } from "@/lib/api"
import { downloadCsv } from "@/lib/csv"
import { formatCurrencyARS, formatDateTime, formatNumber } from "@/lib/utils"
import { useAuth } from "@/features/auth/AuthProvider"
import type { RowData } from "@/features/crud/types"
import RunStockModal from "@/features/reparto/RunStockModal"

type RunRow = RowData & {
  fecha?: string
  driver_id?: string
  driverId?: string
  route_id?: string
  routeId?: string
  driver_nombre?: string
  route_nombre?: string
  estado?: string
  total_vendido?: number | string
  total_cobrado?: number | string
  total_deuda?: number | string
}

type RunDetail = RunRow & {
  stock?: RowData[]
}

function idOf(row: RowData | null | undefined) {
  return String(row?.id || "")
}

function numberValue(value: unknown) {
  const n = Number(value ?? 0)
  return Number.isFinite(n) ? n : 0
}

function rowText(row: RowData, ...keys: string[]) {
  for (const key of keys) {
    const value = row[key]
    if (value !== undefined && value !== null && value !== "") return String(value)
  }

  return "-"
}

function rowName(row: RowData | undefined, fallback: string) {
  if (!row) return fallback || "-"
  return String(row.nombre || row.name || row.email || row.descripcion || row.id || fallback || "-")
}

function runDriverId(row: RowData) {
  return String(row.driver_id || row.driverId || "")
}

function runRouteId(row: RowData) {
  return String(row.route_id || row.routeId || "")
}

function stockRunId(row: RowData) {
  return String(row.delivery_run_id || row.deliveryRunId || "")
}

function stockProductId(row: RowData) {
  return String(row.product_id || row.productId || "")
}

function visitRunId(row: RowData) {
  return String(row.delivery_run_id || row.deliveryRunId || "")
}

function paymentRunId(row: RowData) {
  return String(row.delivery_run_id || row.deliveryRunId || "")
}

function paymentVisitId(row: RowData) {
  return String(row.visit_id || row.visitId || "")
}

function formatRunDate(value?: unknown) {
  if (!value) return "-"
  const text = String(value)

  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    const [year, month, day] = text.split("-")
    return `${day}/${month}/${year.slice(2)}`
  }

  return formatDateTime(text)
}

function estadoVariant(estado?: string): "default" | "success" | "warning" | "danger" | "muted" {
  if (estado === "cerrado") return "muted"
  if (estado === "en_recorrido") return "success"
  if (estado === "cancelado") return "danger"
  return "warning"
}

function normalizeEstado(estado?: string) {
  if (!estado) return "-"
  return estado.replace(/_/g, " ")
}

function runMatches(row: RunRow, q: string) {
  const search = q.trim().toLowerCase()
  if (!search) return true

  const text = [
    row.id,
    row.fecha,
    row.driver_nombre,
    row.driver_id,
    row.driverId,
    row.route_nombre,
    row.route_id,
    row.routeId,
    row.estado
  ].filter(Boolean).join(" ").toLowerCase()

  return text.includes(search)
}

function stockDifferenceClass(value: unknown) {
  const n = numberValue(value)
  if (n === 0) return "text-zinc-700"
  return n > 0 ? "text-emerald-700" : "text-red-700"
}

function differenceBadgeClass(value: unknown) {
  const n = numberValue(value)

  if (n === 0) return "bg-zinc-100 text-zinc-700 ring-zinc-200"
  if (n > 0) return "bg-emerald-100 text-emerald-800 ring-emerald-200"

  return "bg-red-100 text-red-800 ring-red-200"
}

function summaryFor(detail: RunDetail | null) {
  const stock = detail?.stock || []

  return {
    productos: stock.length,
    cargado: stock.reduce((sum, item) => sum + numberValue(item.cantidad_cargada ?? item.cantidadCargada), 0),
    entregado: stock.reduce((sum, item) => sum + numberValue(item.cantidad_entregada ?? item.cantidadEntregada), 0),
    esperado: stock.reduce((sum, item) => sum + numberValue(item.cantidad_esperada ?? item.cantidadEsperada), 0),
    devuelto: stock.reduce((sum, item) => sum + numberValue(item.cantidad_devuelta_real ?? item.cantidadDevueltaReal), 0),
    diferencia: stock.reduce((sum, item) => sum + numberValue(item.diferencia), 0)
  }
}

function totalsForRun(runId: string, visits: RowData[], payments: RowData[]) {
  const runVisits = visits.filter(visit => visitRunId(visit) === runId)
  const visitIds = new Set(runVisits.map(visit => String(visit.id)))

  const runPayments = payments.filter(payment => {
    const paymentDeliveryRunId = paymentRunId(payment)
    const paymentDeliveryVisitId = paymentVisitId(payment)

    return paymentDeliveryRunId === runId || visitIds.has(paymentDeliveryVisitId)
  })

  const totalCobrado = runPayments.reduce((sum, payment) => {
    return String(payment.estado || "") === "confirmado" ? sum + numberValue(payment.amount) : sum
  }, 0)

  const totalPendiente = runPayments.reduce((sum, payment) => {
    return String(payment.estado || "") === "pendiente" ? sum + numberValue(payment.amount) : sum
  }, 0)

  return {
    total_vendido: totalCobrado + totalPendiente,
    total_cobrado: totalCobrado,
    total_deuda: totalPendiente
  }
}

function RunDetailModal({
  detail,
  loading,
  error,
  onClose
}: {
  detail: RunDetail | null
  loading: boolean
  error: string | null
  onClose: () => void
}) {
  const summary = summaryFor(detail)
  const stock = detail?.stock || []

  return (
    <Modal open={!!detail || loading || !!error} onClose={onClose} title="Detalle de stock del reparto">
      <div className="space-y-5">
        {loading ? <LoadingBlock /> : null}

        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        {detail && !loading ? (
          <>
            <div className="grid gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm md:grid-cols-4">
              <div>
                <div className="text-xs font-medium text-zinc-500">Fecha</div>
                <div className="mt-1 font-semibold text-zinc-900">{formatRunDate(detail.fecha)}</div>
              </div>

              <div>
                <div className="text-xs font-medium text-zinc-500">Repartidor</div>
                <div className="mt-1 font-semibold text-zinc-900">
                  {rowText(detail, "driver_nombre", "driver_id", "driverId")}
                </div>
              </div>

              <div>
                <div className="text-xs font-medium text-zinc-500">Recorrido</div>
                <div className="mt-1 font-semibold text-zinc-900">
                  {rowText(detail, "route_nombre", "route_id", "routeId")}
                </div>
              </div>

              <div>
                <div className="text-xs font-medium text-zinc-500">Estado</div>
                <div className="mt-1">
                  <Badge variant={estadoVariant(String(detail.estado || ""))}>
                    {normalizeEstado(String(detail.estado || ""))}
                  </Badge>
                </div>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-4">
              <div className="rounded-xl bg-zinc-900 p-4 text-white">
                <PackageCheck className="h-5 w-5 opacity-80" />
                <div className="mt-2 text-2xl font-semibold">{summary.productos}</div>
                <div className="text-xs opacity-80">productos cargados</div>
              </div>

              <div className="rounded-xl border border-zinc-200 p-4">
                <Truck className="h-5 w-5 text-zinc-500" />
                <div className="mt-2 text-2xl font-semibold">{formatNumber(summary.cargado, 3)}</div>
                <div className="text-xs text-zinc-500">cantidad cargada total</div>
              </div>

              <div className="rounded-xl border border-zinc-200 p-4">
                <div className="text-xs font-medium text-zinc-500">Debe volver</div>
                <div className="mt-2 text-2xl font-semibold text-zinc-900">
                  {formatNumber(summary.esperado, 3)}
                </div>
                <div className="text-xs text-zinc-500">cantidad esperada</div>
              </div>

              <div className="rounded-xl border border-zinc-200 p-4">
                <div className="text-xs font-medium text-zinc-500">Diferencia stock</div>
                <div className={`mt-2 text-2xl font-semibold ${stockDifferenceClass(summary.diferencia)}`}>
                  {formatNumber(summary.diferencia, 3)}
                </div>
                <div className="text-xs text-zinc-500">real devuelto vs esperado</div>
              </div>
            </div>

            <div className="rounded-xl border border-zinc-200 bg-white">
              <div className="flex flex-col gap-1 border-b border-zinc-100 px-4 py-3 md:flex-row md:items-end md:justify-between">
                <div>
                  <div className="text-sm font-semibold text-zinc-900">Mercadería por producto</div>
                  <div className="text-xs text-zinc-500">
                    Control de carga, entrega, devolución esperada y diferencia final.
                  </div>
                </div>

                <div className="text-xs font-medium text-zinc-500">
                  {stock.length} producto(s)
                </div>
              </div>

              {stock.length === 0 ? (
                <div className="px-4 py-6 text-sm text-zinc-500">
                  Este reparto todavía no tiene mercadería cargada.
                </div>
              ) : (
                <div className="space-y-3 p-4">
                  {stock.map(item => {
                    const producto = rowText(item, "producto_nombre", "productNombre", "product_id", "productId")
                    const unidad = rowText(item, "unidad_venta", "unidadVenta")
                    const productId = rowText(item, "product_id", "productId")

                    const cargado = numberValue(item.cantidad_cargada ?? item.cantidadCargada)
                    const entregado = numberValue(item.cantidad_entregada ?? item.cantidadEntregada)
                    const esperado = numberValue(item.cantidad_esperada ?? item.cantidadEsperada)
                    const devuelto = numberValue(item.cantidad_devuelta_real ?? item.cantidadDevueltaReal)
                    const diferencia = numberValue(item.diferencia)

                    return (
                      <div key={String(item.id)} className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
                        <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                          <div>
                            <div className="text-base font-semibold text-zinc-900">{producto}</div>
                            <div className="mt-0.5 text-xs text-zinc-500">ID: {productId}</div>
                          </div>

                          <div className="w-fit rounded-full bg-white px-3 py-1 text-xs font-semibold text-zinc-600 ring-1 ring-zinc-200">
                            {unidad}
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
                          <div className="rounded-lg bg-white p-3 ring-1 ring-zinc-200">
                            <div className="text-[11px] font-semibold uppercase text-zinc-500">Cargado</div>
                            <div className="mt-1 text-lg font-semibold text-zinc-900">
                              {formatNumber(cargado, 3)}
                            </div>
                          </div>

                          <div className="rounded-lg bg-white p-3 ring-1 ring-zinc-200">
                            <div className="text-[11px] font-semibold uppercase text-zinc-500">Entregado</div>
                            <div className="mt-1 text-lg font-semibold text-zinc-900">
                              {formatNumber(entregado, 3)}
                            </div>
                          </div>

                          <div className="rounded-lg bg-white p-3 ring-1 ring-zinc-200">
                            <div className="text-[11px] font-semibold uppercase text-zinc-500">Debe volver</div>
                            <div className="mt-1 text-lg font-semibold text-zinc-900">
                              {formatNumber(esperado, 3)}
                            </div>
                          </div>

                          <div className="rounded-lg bg-white p-3 ring-1 ring-zinc-200">
                            <div className="text-[11px] font-semibold uppercase text-zinc-500">Volvió real</div>
                            <div className="mt-1 text-lg font-semibold text-zinc-900">
                              {formatNumber(devuelto, 3)}
                            </div>
                          </div>

                          <div className="rounded-lg bg-white p-3 ring-1 ring-zinc-200">
                            <div className="text-[11px] font-semibold uppercase text-zinc-500">Diferencia</div>
                            <div
                              className={`mt-1 text-lg font-semibold ${
                                diferencia === 0
                                  ? "text-zinc-900"
                                  : diferencia > 0
                                    ? "text-emerald-700"
                                    : "text-red-700"
                              }`}
                            >
                              {formatNumber(diferencia, 3)}
                            </div>
                          </div>
                        </div>

                        <div className="mt-3 flex flex-wrap gap-2 text-xs">
                          <span className="rounded-full bg-white px-2.5 py-1 text-zinc-600 ring-1 ring-zinc-200">
                            Cargado: {formatNumber(cargado, 3)} {unidad}
                          </span>

                          <span className="rounded-full bg-white px-2.5 py-1 text-zinc-600 ring-1 ring-zinc-200">
                            Entregado: {formatNumber(entregado, 3)} {unidad}
                          </span>

                          <span className={`rounded-full px-2.5 py-1 font-semibold ring-1 ${differenceBadgeClass(diferencia)}`}>
                            Diferencia: {formatNumber(diferencia, 3)} {unidad}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </>
        ) : null}
      </div>
    </Modal>
  )
}

export default function StockByRunView() {
  const { session, can } = useAuth()
  const [runs, setRuns] = useState<RunRow[]>([])
  const [q, setQ] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [detail, setDetail] = useState<RunDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)
  const [stockRun, setStockRun] = useState<RowData | null>(null)

  const canWrite = can("delivery.write", "admin.crud.write")

  const load = useCallback(async () => {
    if (!session) {
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const [runsPayload, employeesPayload, routesPayload, visitsPayload, paymentsPayload] = await Promise.all([
        apiGet(session, "/api/admin/crud/delivery_runs?limit=200"),
        apiGet(session, "/api/admin/crud/employees?limit=1000"),
        apiGet(session, "/api/admin/crud/delivery_routes?limit=1000"),
        apiGet(session, "/api/admin/crud/delivery_visits?limit=1000"),
        apiGet(session, "/api/admin/crud/payments?limit=1000")
      ])

      const runRows = unwrapData<RunRow[]>(runsPayload) || []
      const employees = unwrapData<RowData[]>(employeesPayload) || []
      const routes = unwrapData<RowData[]>(routesPayload) || []
      const visits = unwrapData<RowData[]>(visitsPayload) || []
      const payments = unwrapData<RowData[]>(paymentsPayload) || []

      const employeeById = new Map(employees.map(employee => [String(employee.id), employee]))
      const routeById = new Map(routes.map(route => [String(route.id), route]))

      setRuns(
        runRows.map(run => {
          const runId = String(run.id || "")
          const driverId = runDriverId(run)
          const routeId = runRouteId(run)

          return {
            ...run,
            driver_nombre: rowName(employeeById.get(driverId), driverId),
            route_nombre: rowName(routeById.get(routeId), routeId),
            ...totalsForRun(runId, visits, payments)
          }
        })
      )
    } catch (exc: any) {
      setError(exc?.message || "No se pudieron cargar los repartos")
    } finally {
      setLoading(false)
    }
  }, [session])

  useEffect(() => {
    load()
  }, [load])

  const filteredRuns = useMemo(() => runs.filter(row => runMatches(row, q)), [runs, q])

  const openDetail = useCallback(async (run: RunRow) => {
    if (!session || !run.id) return

    const runId = String(run.id)

    setDetail(null)
    setDetailError(null)
    setDetailLoading(true)

    try {
      const [stockPayload, visitsPayload, paymentsPayload, productsPayload] = await Promise.all([
        apiGet(session, "/api/admin/crud/delivery_run_stock?limit=1000"),
        apiGet(session, "/api/admin/crud/delivery_visits?limit=1000"),
        apiGet(session, "/api/admin/crud/payments?limit=1000"),
        apiGet(session, "/api/admin/crud/products?limit=1000")
      ])

      const stockRows = unwrapData<RowData[]>(stockPayload) || []
      const visitsRows = unwrapData<RowData[]>(visitsPayload) || []
      const paymentRows = unwrapData<RowData[]>(paymentsPayload) || []
      const products = unwrapData<RowData[]>(productsPayload) || []

      const productById = new Map(products.map(product => [String(product.id), product]))

      const runVisits = visitsRows.filter(visit => visitRunId(visit) === runId)
      const visitIds = new Set(runVisits.map(visit => String(visit.id)))

      const runPayments = paymentRows.filter(payment => {
        const currentRunId = paymentRunId(payment)
        const currentVisitId = paymentVisitId(payment)

        return currentRunId === runId || visitIds.has(currentVisitId)
      })

      const stock = stockRows
        .filter(item => stockRunId(item) === runId)
        .map(item => {
          const productId = stockProductId(item)
          const cantidadCargada = numberValue(item.cantidad_cargada ?? item.cantidadCargada)
          const cantidadEsperada = numberValue(item.cantidad_esperada ?? item.cantidadEsperada)
          const cantidadDevueltaReal = numberValue(item.cantidad_devuelta_real ?? item.cantidadDevueltaReal)
          const cantidadEntregada = cantidadCargada - cantidadEsperada
          const product = productById.get(productId)

          return {
            ...item,
            producto_nombre: rowName(product, productId),
            unidad_venta: String(product?.unidad_venta || product?.unidadVenta || ""),
            cantidad_cargada: cantidadCargada,
            cantidad_entregada: cantidadEntregada,
            cantidad_esperada: cantidadEsperada,
            cantidad_devuelta_real: cantidadDevueltaReal,
            diferencia: cantidadDevueltaReal - cantidadEsperada
          }
        })

      const totalCobrado = runPayments.reduce((sum, payment) => {
        return String(payment.estado || "") === "confirmado" ? sum + numberValue(payment.amount) : sum
      }, 0)

      const totalPendiente = runPayments.reduce((sum, payment) => {
        return String(payment.estado || "") === "pendiente" ? sum + numberValue(payment.amount) : sum
      }, 0)

      setDetail({
        ...run,
        stock,
        total_vendido: totalCobrado + totalPendiente,
        total_cobrado: totalCobrado,
        total_deuda: totalPendiente
      })
    } catch (exc: any) {
      setDetailError(exc?.message || "No se pudo cargar el detalle del reparto")
    } finally {
      setDetailLoading(false)
    }
  }, [session])

  function exportRows() {
    downloadCsv(`stock_repartos_${new Date().toISOString().slice(0, 10)}.csv`, filteredRuns)
  }

  const body = useMemo(() => {
    if (loading) return <LoadingBlock />
    if (error) return <ErrorBlock error={error} onRetry={load} />
    if (filteredRuns.length === 0) return <EmptyBlock label="No hay repartos para mostrar." />

    return (
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1080px] text-left text-sm">
          <thead className="border-b border-zinc-100 bg-zinc-50 text-xs font-medium text-zinc-500">
            <tr>
              <th className="px-4 py-3">Fecha</th>
              <th className="px-4 py-3">Repartidor</th>
              <th className="px-4 py-3">Recorrido</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3 text-right">Vendido</th>
              <th className="px-4 py-3 text-right">Cobrado</th>
              <th className="px-4 py-3 text-right">Deuda</th>
              <th className="px-4 py-3 text-right">Acciones</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-zinc-100">
            {filteredRuns.map(run => (
              <tr key={idOf(run)} className="cursor-pointer transition hover:bg-zinc-50" onClick={() => openDetail(run)}>
                <td className="px-4 py-3 text-zinc-700">{formatRunDate(run.fecha)}</td>

                <td className="px-4 py-3 font-medium text-zinc-900">
                  {rowText(run, "driver_nombre", "driver_id", "driverId")}
                </td>

                <td className="px-4 py-3 text-zinc-700">
                  {rowText(run, "route_nombre", "route_id", "routeId")}
                </td>

                <td className="px-4 py-3">
                  <Badge variant={estadoVariant(run.estado)}>{normalizeEstado(run.estado)}</Badge>
                </td>

                <td className="px-4 py-3 text-right text-zinc-700">{formatCurrencyARS(run.total_vendido)}</td>
                <td className="px-4 py-3 text-right text-zinc-700">{formatCurrencyARS(run.total_cobrado)}</td>
                <td className="px-4 py-3 text-right text-zinc-700">{formatCurrencyARS(run.total_deuda)}</td>

                <td className="px-4 py-3">
                  <div className="flex justify-end gap-2">
                    {canWrite ? (
                      <button
                        type="button"
                        className="rounded-xl border border-zinc-200 p-2 hover:bg-zinc-100"
                        onClick={event => {
                          event.stopPropagation()
                          setStockRun(run)
                        }}
                        aria-label="Editar mercadería cargada"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }, [loading, error, filteredRuns, load, openDetail, canWrite])

  return (
    <>
      <Card>
        <CardHeader
          title="Stock"
          subtitle="Repartos completos: carga, ventas, devoluciones y diferencias por repartidor."
          right={
            <div className="flex flex-wrap justify-end gap-2">
              <div className="relative w-full sm:w-[260px]">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
                <Input value={q} onChange={event => setQ(event.target.value)} placeholder="Buscar..." className="pl-9" />
              </div>

              <Button variant="secondary" onClick={load}>
                <RefreshCw className="mr-2 h-4 w-4" /> Actualizar
              </Button>

              <Button variant="secondary" onClick={exportRows}>
                <Download className="mr-2 h-4 w-4" /> CSV
              </Button>
            </div>
          }
        />

        <CardBody className="p-0">{body}</CardBody>
      </Card>

      <RunDetailModal
        detail={detail}
        loading={detailLoading}
        error={detailError}
        onClose={() => {
          setDetail(null)
          setDetailError(null)
          setDetailLoading(false)
        }}
      />

      <RunStockModal
        open={!!stockRun}
        run={stockRun}
        session={session as ApiSession | null}
        onClose={() => setStockRun(null)}
        onChanged={load}
      />
    </>
  )
}