"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { CheckCircle2, Download, RefreshCw, Search, Store, WalletCards, Wheat } from "lucide-react"
import Button from "@/components/ui/Button"
import Input from "@/components/ui/Input"
import Select from "@/components/ui/Select"
import { Card, CardBody, CardHeader } from "@/components/ui/Card"
import { EmptyBlock, ErrorBlock, LoadingBlock } from "@/components/data/AsyncState"
import { useAuth } from "@/features/auth/AuthProvider"
import { apiGet, unwrapData } from "@/lib/api"
import { downloadCsv } from "@/lib/csv"
import type { RowData } from "@/features/crud/types"

type VisitRow = {
  id: string
  fecha: string
  hora: string
  sortTs: string
  arrivedAt: string
  closedAt: string
  estado: string

  repartoId: string
  repartidorId: string
  repartidor: string
  recorrido: string

  cliente: string
  direccion: string
  productos: string
  totalVendido: number
  totalCobrado: number
  deuda: number
  panViejoKg: number
  observaciones: string
}

type DriverSummary = {
  repartidor: string
  visitas: number
  vendido: number
  cobrado: number
  deuda: number
  panViejoKg: number
}

type RunOption = {
  runId: string
  fecha: string
  hora: string
  sortTs: string
  repartidor: string
  repartidorId: string
  recorrido: string
  estado: string
}

function getId(row?: RowData) {
  return String(row?.id || "")
}

function getName(row?: RowData) {
  return String(row?.nombre || row?.name || row?.email || row?.id || "")
}

function getVisitRunId(row: RowData) {
  return String(row.deliveryRunId || row.delivery_run_id || "")
}

function getVisitCustomerId(row: RowData) {
  return String(row.customerId || row.customer_id || "")
}

function getRunDriverId(row?: RowData) {
  return String(row?.driverId || row?.driver_id || "")
}

function getRunRouteId(row?: RowData) {
  return String(row?.routeId || row?.route_id || "")
}

function getRunCreatedAt(row?: RowData) {
  return String(row?.startedAt || row?.started_at || row?.createdAt || row?.created_at || "")
}

function getPaymentVisitId(row: RowData) {
  return String(row.visitId || row.visit_id || "")
}

function getPaymentAmount(row: RowData) {
  const n = Number(row.amount ?? 0)
  return Number.isFinite(n) ? n : 0
}

function getPaymentEstado(row: RowData) {
  return String(row.estado || "")
}

function getMovementReferenceType(row: RowData) {
  return String(row.referenceType || row.reference_type || "")
}

function getMovementReferenceId(row: RowData) {
  return String(row.referenceId || row.reference_id || "")
}

function getMovementTipo(row: RowData) {
  return String(row.tipo || "")
}

function getDebe(row: RowData) {
  const n = Number(row.debe ?? 0)
  return Number.isFinite(n) ? n : 0
}

function getHaber(row: RowData) {
  const n = Number(row.haber ?? 0)
  return Number.isFinite(n) ? n : 0
}

function getBreadcrumbVisitId(row: RowData) {
  return String(row.visitId || row.visit_id || "")
}

function getKgEntrada(row: RowData) {
  const n = Number(row.kgEntrada ?? row.kg_entrada ?? 0)
  return Number.isFinite(n) ? n : 0
}

function getItemVisitId(row: RowData) {
  return String(row.visitId || row.visit_id || "")
}

function getItemProductId(row: RowData) {
  return String(row.productId || row.product_id || "")
}

function getItemCantidad(row: RowData) {
  const n = Number(row.cantidad ?? 0)
  return Number.isFinite(n) ? n : 0
}

function getItemSubtotal(row: RowData) {
  const n = Number(row.subtotal ?? 0)
  return Number.isFinite(n) ? n : 0
}

function getItemTipo(row: RowData) {
  return String(row.tipo || "venta")
}

function todayLocalDate() {
  const d = new Date()
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
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

function formatHour(value: unknown) {
  if (!value) return "-"

  const d = new Date(String(value))
  if (Number.isNaN(d.getTime())) return "-"

  return d.toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit"
  })
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
  if (estado === "cerrada") return "bg-emerald-100 text-emerald-700"
  if (estado === "abierta") return "bg-blue-100 text-blue-700"
  if (estado === "anulada") return "bg-red-100 text-red-700"
  return "bg-zinc-100 text-zinc-700"
}

function normalize(text: unknown) {
  return String(text || "").toLowerCase()
}

export default function VisitsOverviewView() {
  const { session } = useAuth()

  const [rows, setRows] = useState<VisitRow[]>([])
  const [q, setQ] = useState("")
  const [fecha, setFecha] = useState("")
  const [repartidorId, setRepartidorId] = useState("")
  const [repartoId, setRepartoId] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [warning, setWarning] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!session) return

    setLoading(true)
    setError(null)
    setWarning(null)

    try {
      const [visitsPayload, customersPayload, runsPayload, employeesPayload, routesPayload] = await Promise.all([
        apiGet(session, "/api/admin/crud/delivery_visits?limit=1000&order_by=arrived_at&desc=true"),
        apiGet(session, "/api/admin/crud/customers?limit=1000&order_by=nombre"),
        apiGet(session, "/api/admin/crud/delivery_runs?limit=1000&order_by=fecha&desc=true"),
        apiGet(session, "/api/admin/crud/employees?limit=1000&order_by=nombre"),
        apiGet(session, "/api/admin/crud/delivery_routes?limit=1000&order_by=nombre")
      ])

      const visits = unwrapData<RowData[]>(visitsPayload) || []
      const customers = unwrapData<RowData[]>(customersPayload) || []
      const runs = unwrapData<RowData[]>(runsPayload) || []
      const employees = unwrapData<RowData[]>(employeesPayload) || []
      const routes = unwrapData<RowData[]>(routesPayload) || []

      async function optionalRows(path: string, label: string) {
        try {
          const payload = await apiGet(session, path)
          return unwrapData<RowData[]>(payload) || []
        } catch (exc) {
          console.warn(`No se pudo cargar ${label}`, exc)
          setWarning("Algunos datos secundarios no se pudieron cargar. La tabla principal sigue disponible.")
          return []
        }
      }

      const [payments, movements, breadcrumbs, visitItems, products] = await Promise.all([
        optionalRows("/api/admin/crud/payments?limit=1000&order_by=created_at&desc=true", "pagos"),
        optionalRows("/api/admin/crud/customer_account_movements?limit=1000&order_by=fecha&desc=true", "cuentas corrientes"),
        optionalRows("/api/admin/crud/breadcrumb_account_movements?limit=1000&order_by=fecha&desc=true", "pan viejo"),
        optionalRows("/api/admin/crud/delivery_visit_items?limit=1000&order_by=id", "items de visita"),
        optionalRows("/api/admin/crud/products?limit=1000&order_by=nombre", "productos")
      ])

      const customerById = new Map(customers.map(customer => [getId(customer), customer]))
      const runById = new Map(runs.map(run => [getId(run), run]))
      const employeeById = new Map(employees.map(employee => [getId(employee), employee]))
      const routeById = new Map(routes.map(route => [getId(route), route]))
      const productById = new Map(products.map(product => [getId(product), product]))

      const paymentsByVisit = new Map<string, number>()

      for (const payment of payments) {
        const visitId = getPaymentVisitId(payment)
        if (!visitId) continue
        if (getPaymentEstado(payment) === "rechazado") continue

        paymentsByVisit.set(visitId, (paymentsByVisit.get(visitId) || 0) + getPaymentAmount(payment))
      }

      const balanceByVisit = new Map<string, number>()
      const salesMovementByVisit = new Map<string, number>()

      for (const movement of movements) {
        if (getMovementReferenceType(movement) !== "delivery_visit") continue

        const visitId = getMovementReferenceId(movement)
        if (!visitId) continue

        balanceByVisit.set(visitId, (balanceByVisit.get(visitId) || 0) + getDebe(movement) - getHaber(movement))

        if (getMovementTipo(movement) === "venta") {
          salesMovementByVisit.set(visitId, (salesMovementByVisit.get(visitId) || 0) + getDebe(movement))
        }
      }

      const breadByVisit = new Map<string, number>()

      for (const movement of breadcrumbs) {
        const visitId = getBreadcrumbVisitId(movement)
        if (!visitId) continue

        breadByVisit.set(visitId, (breadByVisit.get(visitId) || 0) + getKgEntrada(movement))
      }

      const itemsByVisit = new Map<string, { total: number; resumen: string[] }>()

      for (const item of visitItems) {
        const visitId = getItemVisitId(item)
        if (!visitId) continue

        if (!itemsByVisit.has(visitId)) {
          itemsByVisit.set(visitId, { total: 0, resumen: [] })
        }

        const group = itemsByVisit.get(visitId)!
        const product = productById.get(getItemProductId(item))
        const cantidad = getItemCantidad(item)
        const tipo = getItemTipo(item)
        const productName = getName(product) || getItemProductId(item)

        if (tipo === "venta") {
          group.total += getItemSubtotal(item)
        }

        if (cantidad > 0) {
          group.resumen.push(`${productName}: ${qty(cantidad)}`)
        }
      }

      const nextRows: VisitRow[] = visits.map(visit => {
        const visitId = getId(visit)
        const runId = getVisitRunId(visit)
        const customerId = getVisitCustomerId(visit)

        const run = runById.get(runId)
        const customer = customerById.get(customerId)

        const driverId = getRunDriverId(run)
        const routeId = getRunRouteId(run)

        const employee = run ? employeeById.get(driverId) : undefined
        const route = run ? routeById.get(routeId) : undefined

        const itemSummary = itemsByVisit.get(visitId)

        const totalCobrado = paymentsByVisit.get(visitId) || 0
        const balanceVisit = balanceByVisit.get(visitId) || 0
        const deuda = Math.max(balanceVisit, 0)

        const totalItems = itemSummary?.total || 0
        const totalMovement = salesMovementByVisit.get(visitId) || 0

        const totalVendido =
          totalItems > 0
            ? totalItems
            : totalMovement > 0
              ? totalMovement
              : Math.max(totalCobrado + deuda, 0)

        const arrivedAt = String(visit.arrivedAt || visit.arrived_at || "")
        const runTs = getRunCreatedAt(run) || arrivedAt
        const fecha = String(run?.fecha || run?.date || (arrivedAt ? arrivedAt.slice(0, 10) : ""))

        return {
          id: visitId,
          fecha,
          hora: formatHour(runTs),
          sortTs: runTs || arrivedAt || fecha,
          arrivedAt,
          closedAt: String(visit.closedAt || visit.closed_at || ""),
          estado: String(visit.estado || "-"),

          repartoId: runId,
          repartidorId: driverId,
          repartidor: getName(employee) || driverId,
          recorrido: getName(route) || routeId,

          cliente: getName(customer) || customerId,
          direccion: String(customer?.direccion || ""),
          productos: itemSummary?.resumen?.join(", ") || "-",
          totalVendido,
          totalCobrado,
          deuda,
          panViejoKg: breadByVisit.get(visitId) || 0,
          observaciones: String(visit.observaciones || "")
        }
      })

      nextRows.sort((a, b) => {
        const byDate = String(b.fecha).localeCompare(String(a.fecha))
        if (byDate !== 0) return byDate

        const byTs = String(b.sortTs).localeCompare(String(a.sortTs))
        if (byTs !== 0) return byTs

        return String(b.arrivedAt).localeCompare(String(a.arrivedAt))
      })

      setRows(nextRows)
    } catch (exc: any) {
      setError(exc?.message || "No se pudieron cargar las visitas")
    } finally {
      setLoading(false)
    }
  }, [session])

  useEffect(() => {
    load()
  }, [load])

  const repartidorOptions = useMemo(() => {
    const map = new Map<string, string>()

    for (const row of rows) {
      if (!row.repartidorId) continue
      map.set(row.repartidorId, row.repartidor || row.repartidorId)
    }

    return Array.from(map.entries())
      .map(([id, nombre]) => ({ id, nombre }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre))
  }, [rows])

  const runOptions = useMemo<RunOption[]>(() => {
    const map = new Map<string, RunOption>()

    for (const row of rows) {
      if (fecha && row.fecha !== fecha) continue
      if (repartidorId && row.repartidorId !== repartidorId) continue

      if (!map.has(row.repartoId)) {
        map.set(row.repartoId, {
          runId: row.repartoId,
          fecha: row.fecha,
          hora: row.hora,
          sortTs: row.sortTs,
          repartidor: row.repartidor,
          repartidorId: row.repartidorId,
          recorrido: row.recorrido,
          estado: row.estado
        })
      }
    }

    return Array.from(map.values()).sort((a, b) => {
      const byDate = String(b.fecha).localeCompare(String(a.fecha))
      if (byDate !== 0) return byDate
      return String(b.sortTs).localeCompare(String(a.sortTs))
    })
  }, [rows, fecha, repartidorId])

  useEffect(() => {
    if (!repartoId) return

    if (!runOptions.some(option => option.runId === repartoId)) {
      setRepartoId("")
    }
  }, [runOptions, repartoId])

  const filteredRows = useMemo(() => {
    const search = q.trim().toLowerCase()

    return rows.filter(row => {
      if (fecha && row.fecha !== fecha) return false
      if (repartidorId && row.repartidorId !== repartidorId) return false
      if (repartoId && row.repartoId !== repartoId) return false

      if (!search) return true

      const text = [
        row.fecha,
        row.hora,
        row.repartoId,
        row.cliente,
        row.direccion,
        row.repartidor,
        row.recorrido,
        row.productos,
        row.estado,
        row.observaciones
      ]
        .map(normalize)
        .join(" ")

      return text.includes(search)
    })
  }, [rows, q, fecha, repartidorId, repartoId])

  const totalVendido = useMemo(() => filteredRows.reduce((sum, row) => sum + row.totalVendido, 0), [filteredRows])
  const totalCobrado = useMemo(() => filteredRows.reduce((sum, row) => sum + row.totalCobrado, 0), [filteredRows])
  const totalDeuda = useMemo(() => filteredRows.reduce((sum, row) => sum + row.deuda, 0), [filteredRows])
  const totalPanViejo = useMemo(() => filteredRows.reduce((sum, row) => sum + row.panViejoKg, 0), [filteredRows])

  const driverSummary = useMemo<DriverSummary[]>(() => {
    const map = new Map<string, DriverSummary>()

    for (const row of filteredRows) {
      const key = row.repartidor || "Sin repartidor"

      if (!map.has(key)) {
        map.set(key, {
          repartidor: key,
          visitas: 0,
          vendido: 0,
          cobrado: 0,
          deuda: 0,
          panViejoKg: 0
        })
      }

      const item = map.get(key)!
      item.visitas += 1
      item.vendido += row.totalVendido
      item.cobrado += row.totalCobrado
      item.deuda += row.deuda
      item.panViejoKg += row.panViejoKg
    }

    return Array.from(map.values()).sort((a, b) => b.visitas - a.visitas)
  }, [filteredRows])

  function setTodayFilter() {
    setFecha(todayLocalDate())
  }

  function clearFilters() {
    setQ("")
    setFecha("")
    setRepartidorId("")
    setRepartoId("")
  }

  function exportRows() {
    downloadCsv(`visitas_reparto_${new Date().toISOString().slice(0, 10)}.csv`, filteredRows)
  }

  if (loading) return <LoadingBlock />
  if (error) return <ErrorBlock error={error} onRetry={load} />

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader
          title="Visitas"
          subtitle="Consulta rápida de visitas registradas por los repartidores."
          right={
            <div className="flex flex-wrap justify-end gap-2">
              <div className="relative w-full sm:w-[280px]">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
                <Input
                  value={q}
                  onChange={e => setQ(e.target.value)}
                  placeholder="Buscar cliente, repartidor, producto..."
                  className="pl-9"
                />
              </div>

              <Select value={repartidorId} onChange={e => setRepartidorId(e.target.value)} className="w-full sm:w-[190px]">
                <option value="">Todos los repartidores</option>
                {repartidorOptions.map(option => (
                  <option key={option.id} value={option.id}>
                    {option.nombre}
                  </option>
                ))}
              </Select>

              <div className="flex w-full gap-2 sm:w-auto">
                <Input
                  type="date"
                  value={fecha}
                  onChange={e => setFecha(e.target.value)}
                  className="w-full sm:w-[160px]"
                />

                <Button
                  type="button"
                  variant={fecha === todayLocalDate() ? "primary" : "secondary"}
                  onClick={setTodayFilter}
                >
                  Hoy
                </Button>
              </div>

              <Select value={repartoId} onChange={e => setRepartoId(e.target.value)} className="w-full sm:w-[260px]">
                <option value="">Todos los repartos</option>
                {runOptions.map(option => (
                  <option key={option.runId} value={option.runId}>
                    {option.hora} · {option.repartidor} · {option.recorrido} · {option.estado}
                  </option>
                ))}
              </Select>

              {(q || fecha || repartidorId || repartoId) ? (
                <Button variant="secondary" onClick={clearFilters}>
                  Limpiar
                </Button>
              ) : null}

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

          <div className="grid gap-3 md:grid-cols-5">
            <div className="rounded-2xl bg-zinc-900 p-4 text-white">
              <CheckCircle2 className="h-5 w-5 opacity-80" />
              <div className="mt-2 text-2xl font-semibold">{filteredRows.length}</div>
              <div className="text-xs opacity-80">visitas</div>
            </div>

            <div className="rounded-2xl border border-zinc-200 p-4">
              <Store className="h-5 w-5 text-zinc-500" />
              <div className="mt-2 text-2xl font-semibold text-zinc-900">{money(totalVendido)}</div>
              <div className="text-xs text-zinc-500">vendido</div>
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
        <CardHeader title="Resumen por repartidor" subtitle="Totales según el filtro actual." />
        <CardBody className="p-0">
          {driverSummary.length === 0 ? (
            <div className="p-5">
              <EmptyBlock label="No hay visitas para resumir." />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="border-b border-zinc-100 bg-zinc-50 text-xs font-medium text-zinc-500">
                  <tr>
                    <th className="px-4 py-3">Repartidor</th>
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
          title="Detalle de visitas"
          subtitle="Cliente, mercadería dejada, pago, deuda y pan viejo recibido."
        />

        <CardBody className="p-0">
          {filteredRows.length === 0 ? (
            <div className="p-5">
              <EmptyBlock label="No hay visitas para mostrar." />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1180px] text-left text-sm">
                <thead className="border-b border-zinc-100 bg-zinc-50 text-xs font-medium text-zinc-500">
                  <tr>
                    <th className="px-4 py-3">Fecha</th>
                    <th className="px-4 py-3">Hora</th>
                    <th className="px-4 py-3">Cliente</th>
                    <th className="px-4 py-3">Repartidor</th>
                    <th className="px-4 py-3">Recorrido</th>
                    <th className="px-4 py-3">Mercadería</th>
                    <th className="px-4 py-3">Vendido</th>
                    <th className="px-4 py-3">Cobrado</th>
                    <th className="px-4 py-3">Deuda</th>
                    <th className="px-4 py-3">Pan viejo</th>
                    <th className="px-4 py-3">Estado</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-zinc-100">
                  {filteredRows.map(row => (
                    <tr key={row.id} className="hover:bg-zinc-50">
                      <td className="px-4 py-3 text-zinc-700">{formatDate(row.fecha)}</td>
                      <td className="px-4 py-3 text-zinc-700">{row.hora}</td>

                      <td className="px-4 py-3">
                        <div className="font-medium text-zinc-900">{row.cliente}</div>
                        {row.direccion ? <div className="mt-1 text-xs text-zinc-500">{row.direccion}</div> : null}
                      </td>

                      <td className="px-4 py-3 text-zinc-700">{row.repartidor || "-"}</td>
                      <td className="px-4 py-3 text-zinc-700">{row.recorrido || "-"}</td>
                      <td className="max-w-[260px] px-4 py-3 text-zinc-700">{row.productos}</td>
                      <td className="px-4 py-3 text-zinc-900">{money(row.totalVendido)}</td>
                      <td className="px-4 py-3 text-zinc-900">{money(row.totalCobrado)}</td>
                      <td className="px-4 py-3 text-zinc-900">{money(row.deuda)}</td>
                      <td className="px-4 py-3 text-zinc-700">{qty(row.panViejoKg)} kg</td>

                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2 py-1 text-xs font-medium ${estadoClass(row.estado)}`}>
                          {row.estado}
                        </span>
                      </td>
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