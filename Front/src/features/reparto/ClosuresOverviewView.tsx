"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { CheckCircle2, Download, RefreshCw, Search, Truck, WalletCards, Wheat } from "lucide-react"
import Button from "@/components/ui/Button"
import Input from "@/components/ui/Input"
import Select from "@/components/ui/Select"
import { Card, CardBody, CardHeader } from "@/components/ui/Card"
import { EmptyBlock, ErrorBlock, LoadingBlock } from "@/components/data/AsyncState"
import { useAuth } from "@/features/auth/AuthProvider"
import { apiGet, unwrapData } from "@/lib/api"
import { downloadCsv } from "@/lib/csv"
import type { RowData } from "@/features/crud/types"

type ClosureRow = {
  runId: string
  fecha: string
  repartidor: string
  recorrido: string
  estado: string

  visitas: number
  visitasCerradas: number

  vendido: number
  cobrado: number
  deuda: number
  panViejoKg: number

  productosCargados: number
  productosPendientes: number

  cierreId: string
  cierreGuardado: boolean
  closedAt: string
  notes: string
}

type DriverSummary = {
  repartidor: string
  repartos: number
  visitas: number
  vendido: number
  cobrado: number
  deuda: number
  panViejoKg: number
}

function getId(row?: RowData) {
  return String(row?.id || "")
}

function getName(row?: RowData) {
  return String(row?.nombre || row?.name || row?.email || row?.id || "")
}

function getRunId(row?: RowData) {
  return String(row?.deliveryRunId || row?.delivery_run_id || "")
}

function getVisitRunId(row?: RowData) {
  return String(row?.deliveryRunId || row?.delivery_run_id || "")
}

function getVisitId(row?: RowData) {
  return String(row?.visitId || row?.visit_id || "")
}

function getCustomerMovementReferenceType(row?: RowData) {
  return String(row?.referenceType || row?.reference_type || "")
}

function getCustomerMovementReferenceId(row?: RowData) {
  return String(row?.referenceId || row?.reference_id || "")
}

function getRunDriverId(row?: RowData) {
  return String(row?.driverId || row?.driver_id || "")
}

function getRunRouteId(row?: RowData) {
  return String(row?.routeId || row?.route_id || "")
}

function getPaymentRunId(row?: RowData) {
  return String(row?.deliveryRunId || row?.delivery_run_id || "")
}

function getPaymentVisitId(row?: RowData) {
  return String(row?.visitId || row?.visit_id || "")
}

function getPaymentEstado(row?: RowData) {
  return String(row?.estado || "")
}

function getPaymentAmount(row?: RowData) {
  const n = Number(row?.amount ?? 0)
  return Number.isFinite(n) ? n : 0
}

function getDebe(row?: RowData) {
  const n = Number(row?.debe ?? 0)
  return Number.isFinite(n) ? n : 0
}

function getHaber(row?: RowData) {
  const n = Number(row?.haber ?? 0)
  return Number.isFinite(n) ? n : 0
}

function getBreadVisitId(row?: RowData) {
  return String(row?.visitId || row?.visit_id || "")
}

function getKgEntrada(row?: RowData) {
  const n = Number(row?.kgEntrada ?? row?.kg_entrada ?? 0)
  return Number.isFinite(n) ? n : 0
}

function getItemVisitId(row?: RowData) {
  return String(row?.visitId || row?.visit_id || "")
}

function getItemProductId(row?: RowData) {
  return String(row?.productId || row?.product_id || "")
}

function getItemTipo(row?: RowData) {
  return String(row?.tipo || "venta")
}

function getItemCantidad(row?: RowData) {
  const n = Number(row?.cantidad ?? 0)
  return Number.isFinite(n) ? n : 0
}

function getItemSubtotal(row?: RowData) {
  const n = Number(row?.subtotal ?? 0)
  return Number.isFinite(n) ? n : 0
}

function getStockProductId(row?: RowData) {
  return String(row?.productId || row?.product_id || "")
}

function getStockCantidad(row?: RowData) {
  const n = Number(row?.cantidadCargada ?? row?.cantidad_cargada ?? 0)
  return Number.isFinite(n) ? n : 0
}

function getClosureRunId(row?: RowData) {
  return String(row?.deliveryRunId || row?.delivery_run_id || "")
}

function formatDate(value: unknown) {
  if (!value) return "-"

  const text = String(value)

  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    const [year, month, day] = text.split("-")
    return `${day}/${month}/${year}`
  }

  const d = new Date(text)
  if (Number.isNaN(d.getTime())) return text

  return d.toLocaleDateString("es-AR")
}

function formatDateTime(value: unknown) {
  if (!value) return "-"
  const d = new Date(String(value))
  if (Number.isNaN(d.getTime())) return String(value)
  return d.toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" })
}

function money(value: number) {
  return `$ ${Number(value || 0).toLocaleString("es-AR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  })}`
}

function qty(value: number) {
  return Number(value || 0).toLocaleString("es-AR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  })
}

function estadoClass(estado: string) {
  if (estado === "cerrado") return "bg-zinc-100 text-zinc-700"
  if (estado === "en_recorrido") return "bg-blue-100 text-blue-700"
  if (estado === "preparado") return "bg-amber-100 text-amber-800"
  if (estado === "cancelado") return "bg-red-100 text-red-700"
  return "bg-zinc-100 text-zinc-700"
}

function cierreClass(guardado: boolean) {
  return guardado ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-800"
}

function normalize(text: unknown) {
  return String(text || "").toLowerCase()
}

export default function ClosuresOverviewView() {
  const { session } = useAuth()

  const [rows, setRows] = useState<ClosureRow[]>([])
  const [q, setQ] = useState("")
  const [fecha, setFecha] = useState("")
  const [estadoCierre, setEstadoCierre] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [warning, setWarning] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!session) return

    setLoading(true)
    setError(null)
    setWarning(null)

    try {
      const [runsPayload, employeesPayload, routesPayload] = await Promise.all([
        apiGet(session, "/api/admin/crud/delivery_runs?limit=1000&order_by=fecha&desc=true"),
        apiGet(session, "/api/admin/crud/employees?limit=1000&order_by=nombre"),
        apiGet(session, "/api/admin/crud/delivery_routes?limit=1000&order_by=nombre")
      ])

      const runs = unwrapData<RowData[]>(runsPayload) || []
      const employees = unwrapData<RowData[]>(employeesPayload) || []
      const routes = unwrapData<RowData[]>(routesPayload) || []

      async function optionalRows(path: string, label: string) {
        try {
          const payload = await apiGet(session, path)
          return unwrapData<RowData[]>(payload) || []
        } catch (exc) {
          console.warn(`No se pudo cargar ${label}`, exc)
          setWarning("Algunos datos secundarios no se pudieron cargar. El resumen puede estar incompleto.")
          return []
        }
      }

      const [
        visits,
        visitItems,
        payments,
        movements,
        breadcrumbs,
        stockRows,
        closures
      ] = await Promise.all([
        optionalRows("/api/admin/crud/delivery_visits?limit=1000&order_by=arrived_at&desc=true", "visitas"),
        optionalRows("/api/admin/crud/delivery_visit_items?limit=1000&order_by=id", "items de visita"),
        optionalRows("/api/admin/crud/payments?limit=1000&order_by=created_at&desc=true", "pagos"),
        optionalRows("/api/admin/crud/customer_account_movements?limit=1000&order_by=fecha&desc=true", "cuentas corrientes"),
        optionalRows("/api/admin/crud/breadcrumb_account_movements?limit=1000&order_by=fecha&desc=true", "pan viejo"),
        optionalRows("/api/admin/crud/delivery_run_stock?limit=1000&order_by=created_at&desc=true", "stock"),
        optionalRows("/api/admin/crud/delivery_run_closures?limit=1000&order_by=closed_at&desc=true", "cierres")
      ])

      const employeeById = new Map(employees.map(employee => [getId(employee), employee]))
      const routeById = new Map(routes.map(route => [getId(route), route]))
      const closureByRunId = new Map(closures.map(closure => [getClosureRunId(closure), closure]))

      const visitRunByVisitId = new Map<string, string>()
      const visitsByRun = new Map<string, { total: number; cerradas: number }>()

      for (const visit of visits) {
        const visitId = getId(visit)
        const runId = getVisitRunId(visit)
        if (!visitId || !runId) continue

        visitRunByVisitId.set(visitId, runId)

        if (!visitsByRun.has(runId)) {
          visitsByRun.set(runId, { total: 0, cerradas: 0 })
        }

        const group = visitsByRun.get(runId)!
        group.total += 1
        if (String(visit.estado || "") === "cerrada") group.cerradas += 1
      }

      const soldByRun = new Map<string, number>()
      const deliveredByRunProduct = new Map<string, number>()

      for (const item of visitItems) {
        const visitId = getItemVisitId(item)
        const runId = visitRunByVisitId.get(visitId)
        if (!runId) continue
        if (getItemTipo(item) !== "venta") continue

        soldByRun.set(runId, (soldByRun.get(runId) || 0) + getItemSubtotal(item))

        const productKey = `${runId}__${getItemProductId(item)}`
        deliveredByRunProduct.set(productKey, (deliveredByRunProduct.get(productKey) || 0) + getItemCantidad(item))
      }

      const paidByRun = new Map<string, number>()

      for (const payment of payments) {
        if (getPaymentEstado(payment) === "rechazado") continue

        const runId = getPaymentRunId(payment) || visitRunByVisitId.get(getPaymentVisitId(payment)) || ""
        if (!runId) continue

        paidByRun.set(runId, (paidByRun.get(runId) || 0) + getPaymentAmount(payment))
      }

      const debtByRun = new Map<string, number>()

      for (const movement of movements) {
        let runId = ""

        if (getCustomerMovementReferenceType(movement) === "delivery_visit") {
          runId = visitRunByVisitId.get(getCustomerMovementReferenceId(movement)) || ""
        }

        if (!runId) continue

        debtByRun.set(runId, (debtByRun.get(runId) || 0) + getDebe(movement) - getHaber(movement))
      }

      const breadByRun = new Map<string, number>()

      for (const movement of breadcrumbs) {
        const runId = visitRunByVisitId.get(getBreadVisitId(movement)) || ""
        if (!runId) continue
        breadByRun.set(runId, (breadByRun.get(runId) || 0) + getKgEntrada(movement))
      }

      const loadedProductsByRun = new Map<string, number>()
      const pendingProductsByRun = new Map<string, number>()

      for (const stock of stockRows) {
        const runId = getRunId(stock)
        const productId = getStockProductId(stock)
        const loaded = getStockCantidad(stock)

        if (!runId || !productId || loaded <= 0) continue

        loadedProductsByRun.set(runId, (loadedProductsByRun.get(runId) || 0) + 1)

        const delivered = deliveredByRunProduct.get(`${runId}__${productId}`) || 0
        if (loaded - delivered > 0.0001) {
          pendingProductsByRun.set(runId, (pendingProductsByRun.get(runId) || 0) + 1)
        }
      }

      const nextRows: ClosureRow[] = runs.map(run => {
        const runId = getId(run)
        const employee = employeeById.get(getRunDriverId(run))
        const route = routeById.get(getRunRouteId(run))
        const closure = closureByRunId.get(runId)
        const visitStats = visitsByRun.get(runId) || { total: 0, cerradas: 0 }

        return {
          runId,
          fecha: String(run.fecha || run.date || ""),
          repartidor: getName(employee) || getRunDriverId(run),
          recorrido: getName(route) || getRunRouteId(run),
          estado: String(run.estado || "-"),

          visitas: visitStats.total,
          visitasCerradas: visitStats.cerradas,

          vendido: Number(closure?.totalVendido ?? closure?.total_vendido ?? soldByRun.get(runId) ?? 0),
          cobrado: Number(closure?.totalCobrado ?? closure?.total_cobrado ?? paidByRun.get(runId) ?? 0),
          deuda: Number(closure?.totalDeuda ?? closure?.total_deuda ?? debtByRun.get(runId) ?? 0),
          panViejoKg: breadByRun.get(runId) || 0,

          productosCargados: loadedProductsByRun.get(runId) || 0,
          productosPendientes: pendingProductsByRun.get(runId) || 0,

          cierreId: getId(closure),
          cierreGuardado: Boolean(closure),
          closedAt: String(closure?.closedAt || closure?.closed_at || ""),
          notes: String(closure?.notes || "")
        }
      })

      setRows(nextRows)
    } catch (exc: any) {
      setError(exc?.message || "No se pudieron cargar los cierres")
    } finally {
      setLoading(false)
    }
  }, [session])

  useEffect(() => {
    load()
  }, [load])

  const filteredRows = useMemo(() => {
    const search = q.trim().toLowerCase()

    return rows.filter(row => {
      if (fecha && row.fecha !== fecha) return false

      if (estadoCierre === "guardado" && !row.cierreGuardado) return false
      if (estadoCierre === "pendiente" && row.cierreGuardado) return false

      if (!search) return true

      const text = [
        row.fecha,
        row.runId,
        row.repartidor,
        row.recorrido,
        row.estado,
        row.notes
      ].map(normalize).join(" ")

      return text.includes(search)
    })
  }, [rows, q, fecha, estadoCierre])

  const totalVendido = useMemo(() => filteredRows.reduce((sum, row) => sum + row.vendido, 0), [filteredRows])
  const totalCobrado = useMemo(() => filteredRows.reduce((sum, row) => sum + row.cobrado, 0), [filteredRows])
  const totalDeuda = useMemo(() => filteredRows.reduce((sum, row) => sum + row.deuda, 0), [filteredRows])
  const totalPanViejo = useMemo(() => filteredRows.reduce((sum, row) => sum + row.panViejoKg, 0), [filteredRows])
  const cierresGuardados = useMemo(() => filteredRows.filter(row => row.cierreGuardado).length, [filteredRows])
  const cierresPendientes = useMemo(() => filteredRows.filter(row => !row.cierreGuardado).length, [filteredRows])

  const driverSummary = useMemo<DriverSummary[]>(() => {
    const map = new Map<string, DriverSummary>()

    for (const row of filteredRows) {
      const key = row.repartidor || "Sin repartidor"

      if (!map.has(key)) {
        map.set(key, {
          repartidor: key,
          repartos: 0,
          visitas: 0,
          vendido: 0,
          cobrado: 0,
          deuda: 0,
          panViejoKg: 0
        })
      }

      const item = map.get(key)!
      item.repartos += 1
      item.visitas += row.visitas
      item.vendido += row.vendido
      item.cobrado += row.cobrado
      item.deuda += row.deuda
      item.panViejoKg += row.panViejoKg
    }

    return Array.from(map.values()).sort((a, b) => b.cobrado - a.cobrado)
  }, [filteredRows])

  function exportRows() {
    downloadCsv(`cierres_reparto_${new Date().toISOString().slice(0, 10)}.csv`, filteredRows)
  }

  if (loading) return <LoadingBlock />
  if (error) return <ErrorBlock error={error} onRetry={load} />

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader
          title="Cierres"
          subtitle="Resumen operativo por reparto: vendido, cobrado, deuda, pan viejo y estado de cierre."
          right={
            <div className="flex flex-wrap justify-end gap-2">
              <div className="relative w-full sm:w-[300px]">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
                <Input
                  value={q}
                  onChange={e => setQ(e.target.value)}
                  placeholder="Buscar repartidor, recorrido, reparto..."
                  className="pl-9"
                />
              </div>

              <Input
                type="date"
                value={fecha}
                onChange={e => setFecha(e.target.value)}
                className="w-full sm:w-[160px]"
              />

              <Select value={estadoCierre} onChange={e => setEstadoCierre(e.target.value)} className="w-full sm:w-[160px]">
                <option value="">Todos</option>
                <option value="pendiente">Pendientes</option>
                <option value="guardado">Guardados</option>
              </Select>

              <Button variant="secondary" onClick={load}>
                <RefreshCw className="mr-2 h-4 w-4" /> Actualizar
              </Button>

              <Button variant="secondary" onClick={exportRows}>
                <Download className="mr-2 h-4 w-4" /> CSV
              </Button>
            </div>
          }
        />

        <CardBody>
          {warning ? (
            <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              {warning}
            </div>
          ) : null}

          <div className="grid gap-3 md:grid-cols-6">
            <div className="rounded-2xl bg-zinc-900 p-4 text-white">
              <Truck className="h-5 w-5 opacity-80" />
              <div className="mt-2 text-2xl font-semibold">{filteredRows.length}</div>
              <div className="text-xs opacity-80">repartos</div>
            </div>

            <div className="rounded-2xl border border-zinc-200 p-4">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              <div className="mt-2 text-2xl font-semibold text-zinc-900">{cierresGuardados}</div>
              <div className="text-xs text-zinc-500">cerrados</div>
            </div>

            <div className="rounded-2xl border border-zinc-200 p-4">
              <div className="text-xs font-medium text-zinc-500">Pendientes</div>
              <div className="mt-2 text-2xl font-semibold text-zinc-900">{cierresPendientes}</div>
            </div>

            <div className="rounded-2xl border border-zinc-200 p-4">
              <WalletCards className="h-5 w-5 text-emerald-600" />
              <div className="mt-2 text-2xl font-semibold text-zinc-900">{money(totalCobrado)}</div>
              <div className="text-xs text-zinc-500">cobrado</div>
            </div>

            <div className="rounded-2xl border border-zinc-200 p-4">
              <div className="text-xs font-medium text-zinc-500">Deuda</div>
              <div className="mt-2 text-2xl font-semibold text-zinc-900">{money(totalDeuda)}</div>
            </div>

            <div className="rounded-2xl border border-zinc-200 p-4">
              <Wheat className="h-5 w-5 text-amber-600" />
              <div className="mt-2 text-2xl font-semibold text-zinc-900">{qty(totalPanViejo)} kg</div>
              <div className="text-xs text-zinc-500">pan viejo</div>
            </div>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Resumen por repartidor" subtitle="Totales por repartidor según el filtro actual." />
        <CardBody className="p-0">
          {driverSummary.length === 0 ? (
            <div className="p-5">
              <EmptyBlock label="No hay datos para resumir." />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] text-left text-sm">
                <thead className="border-b border-zinc-100 bg-zinc-50 text-xs font-medium text-zinc-500">
                  <tr>
                    <th className="px-4 py-3">Repartidor</th>
                    <th className="px-4 py-3">Repartos</th>
                    <th className="px-4 py-3">Visitas</th>
                    <th className="px-4 py-3">Vendido</th>
                    <th className="px-4 py-3">Cobrado</th>
                    <th className="px-4 py-3">Deuda</th>
                    <th className="px-4 py-3">Pan viejo</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-zinc-100">
                  {driverSummary.map(row => (
                    <tr key={row.repartidor}>
                      <td className="px-4 py-3 font-medium text-zinc-900">{row.repartidor}</td>
                      <td className="px-4 py-3 text-zinc-700">{row.repartos}</td>
                      <td className="px-4 py-3 text-zinc-700">{row.visitas}</td>
                      <td className="px-4 py-3 text-zinc-700">{money(row.vendido)}</td>
                      <td className="px-4 py-3 text-zinc-700">{money(row.cobrado)}</td>
                      <td className="px-4 py-3 text-zinc-700">{money(row.deuda)}</td>
                      <td className="px-4 py-3 text-zinc-700">{qty(row.panViejoKg)} kg</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Detalle de cierre por reparto"
          subtitle="Vista rápida para rendición: visitas, ventas, cobros, deuda y stock pendiente."
        />

        <CardBody className="p-0">
          {filteredRows.length === 0 ? (
            <div className="p-5">
              <EmptyBlock label="No hay repartos para mostrar." />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1180px] text-left text-sm">
                <thead className="border-b border-zinc-100 bg-zinc-50 text-xs font-medium text-zinc-500">
                  <tr>
                    <th className="px-4 py-3">Fecha</th>
                    <th className="px-4 py-3">Repartidor</th>
                    <th className="px-4 py-3">Recorrido</th>
                    <th className="px-4 py-3">Visitas</th>
                    <th className="px-4 py-3">Vendido</th>
                    <th className="px-4 py-3">Cobrado</th>
                    <th className="px-4 py-3">Deuda</th>
                    <th className="px-4 py-3">Pan viejo</th>
                    <th className="px-4 py-3">Stock</th>
                    <th className="px-4 py-3">Estado</th>
                    <th className="px-4 py-3">Cierre</th>
                    <th className="px-4 py-3">Reparto</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-zinc-100">
                  {filteredRows.map(row => (
                    <tr key={row.runId} className="hover:bg-zinc-50">
                      <td className="px-4 py-3 text-zinc-700">{formatDate(row.fecha)}</td>
                      <td className="px-4 py-3 font-medium text-zinc-900">{row.repartidor || "-"}</td>
                      <td className="px-4 py-3 text-zinc-700">{row.recorrido || "-"}</td>
                      <td className="px-4 py-3 text-zinc-700">{row.visitasCerradas}/{row.visitas}</td>
                      <td className="px-4 py-3 text-zinc-900">{money(row.vendido)}</td>
                      <td className="px-4 py-3 font-semibold text-zinc-900">{money(row.cobrado)}</td>
                      <td className="px-4 py-3 text-zinc-900">{money(row.deuda)}</td>
                      <td className="px-4 py-3 text-zinc-700">{qty(row.panViejoKg)} kg</td>
                      <td className="px-4 py-3 text-zinc-700">
                        {row.productosCargados} prod.
                        {row.productosPendientes > 0 ? (
                          <span className="ml-2 rounded-full bg-amber-100 px-2 py-1 text-xs font-medium text-amber-800">
                            {row.productosPendientes} pendiente(s)
                          </span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2 py-1 text-xs font-medium ${estadoClass(row.estado)}`}>
                          {row.estado}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div>
                          <span className={`rounded-full px-2 py-1 text-xs font-medium ${cierreClass(row.cierreGuardado)}`}>
                            {row.cierreGuardado ? "Guardado" : "Pendiente"}
                          </span>
                          {row.closedAt ? (
                            <div className="mt-1 text-xs text-zinc-500">{formatDateTime(row.closedAt)}</div>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-zinc-500">{row.runId}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  )
}