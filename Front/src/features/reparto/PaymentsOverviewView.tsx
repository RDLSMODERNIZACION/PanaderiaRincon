"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  Banknote,
  CreditCard,
  Download,
  Landmark,
  QrCode,
  RefreshCw,
  Search,
  WalletCards
} from "lucide-react"
import Button from "@/components/ui/Button"
import Input from "@/components/ui/Input"
import Select from "@/components/ui/Select"
import { Card, CardBody, CardHeader } from "@/components/ui/Card"
import { EmptyBlock, ErrorBlock, LoadingBlock } from "@/components/data/AsyncState"
import { useAuth } from "@/features/auth/AuthProvider"
import { apiGet, unwrapData } from "@/lib/api"
import { downloadCsv } from "@/lib/csv"
import type { RowData } from "@/features/crud/types"

type PaymentRow = {
  id: string
  fecha: string
  hora: string
  sortTs: string
  createdAt: string

  cliente: string
  direccion: string

  repartidorId: string
  repartidor: string
  recorrido: string
  repartoId: string
  visitId: string

  metodo: string
  estado: string
  amount: number
  referencia: string
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

type MethodSummary = {
  metodo: string
  cantidad: number
  total: number
}

function getId(row?: RowData) {
  return String(row?.id || "")
}

function getName(row?: RowData) {
  return String(row?.nombre || row?.name || row?.email || row?.id || "")
}

function getPaymentVisitId(row: RowData) {
  return String(row.visitId || row.visit_id || "")
}

function getPaymentCustomerId(row: RowData) {
  return String(row.customerId || row.customer_id || "")
}

function getPaymentRunId(row: RowData) {
  return String(row.deliveryRunId || row.delivery_run_id || "")
}

function getVisitRunId(row?: RowData) {
  return String(row?.deliveryRunId || row?.delivery_run_id || "")
}

function getVisitCustomerId(row?: RowData) {
  return String(row?.customerId || row?.customer_id || "")
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

function getAmount(row: RowData) {
  const n = Number(row.amount ?? 0)
  return Number.isFinite(n) ? n : 0
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

function normalize(text: unknown) {
  return String(text || "").toLowerCase()
}

function metodoLabel(value: string) {
  if (value === "efectivo") return "Efectivo"
  if (value === "transferencia") return "Transferencia"
  if (value === "mercado_pago") return "Mercado Pago"
  if (value === "qr") return "QR"
  if (value === "otro") return "Otro"
  return value || "-"
}

function estadoClass(estado: string) {
  if (estado === "confirmado") return "bg-emerald-100 text-emerald-700"
  if (estado === "pendiente") return "bg-amber-100 text-amber-800"
  if (estado === "rechazado") return "bg-red-100 text-red-700"
  return "bg-zinc-100 text-zinc-700"
}

function isConfirmed(row: PaymentRow) {
  return row.estado === "confirmado"
}

export default function PaymentsOverviewView() {
  const { session } = useAuth()

  const [rows, setRows] = useState<PaymentRow[]>([])
  const [q, setQ] = useState("")
  const [fecha, setFecha] = useState("")
  const [repartidorId, setRepartidorId] = useState("")
  const [repartoId, setRepartoId] = useState("")
  const [metodo, setMetodo] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [warning, setWarning] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!session) {
      setLoading(false)
      return
    }

    const currentSession = session

    setLoading(true)
    setError(null)
    setWarning(null)

    try {
      const paymentsPayload = await apiGet(currentSession, "/api/admin/crud/payments?limit=1000&order_by=created_at&desc=true")
      const payments = unwrapData<RowData[]>(paymentsPayload) || []

      async function optionalRows(path: string, label: string): Promise<RowData[]> {
        try {
          const payload = await apiGet(currentSession, path)
          return unwrapData<RowData[]>(payload) || []
        } catch (exc) {
          console.warn(`No se pudo cargar ${label}`, exc)
          setWarning("Algunos datos secundarios no se pudieron cargar. La tabla principal sigue disponible.")
          return []
        }
      }

      const [customers, visits, runs, employees, routes] = await Promise.all([
        optionalRows("/api/admin/crud/customers?limit=1000&order_by=nombre", "clientes"),
        optionalRows("/api/admin/crud/delivery_visits?limit=1000&order_by=arrived_at&desc=true", "visitas"),
        optionalRows("/api/admin/crud/delivery_runs?limit=1000&order_by=fecha&desc=true", "repartos"),
        optionalRows("/api/admin/crud/employees?limit=1000&order_by=nombre", "empleados"),
        optionalRows("/api/admin/crud/delivery_routes?limit=1000&order_by=nombre", "recorridos")
      ])

      const customerById = new Map(customers.map(customer => [getId(customer), customer]))
      const visitById = new Map(visits.map(visit => [getId(visit), visit]))
      const runById = new Map(runs.map(run => [getId(run), run]))
      const employeeById = new Map(employees.map(employee => [getId(employee), employee]))
      const routeById = new Map(routes.map(route => [getId(route), route]))

      const nextRows: PaymentRow[] = payments.map(payment => {
        const visitId = getPaymentVisitId(payment)
        const visit = visitById.get(visitId)

        const runId = getPaymentRunId(payment) || getVisitRunId(visit)
        const customerId = getPaymentCustomerId(payment) || getVisitCustomerId(visit)

        const run = runById.get(runId)
        const customer = customerById.get(customerId)

        const driverId = getRunDriverId(run)
        const routeId = getRunRouteId(run)

        const employee = run ? employeeById.get(driverId) : undefined
        const route = run ? routeById.get(routeId) : undefined

        const createdAt = String(payment.createdAt || payment.created_at || "")
        const runTs = getRunCreatedAt(run) || createdAt
        const fecha = String(run?.fecha || run?.date || (createdAt ? createdAt.slice(0, 10) : ""))

        return {
          id: getId(payment),
          fecha,
          hora: formatHour(runTs),
          sortTs: runTs || createdAt || fecha,
          createdAt,

          cliente: getName(customer) || customerId,
          direccion: String(customer?.direccion || ""),

          repartidorId: driverId,
          repartidor: getName(employee) || driverId,
          recorrido: getName(route) || routeId,
          repartoId: runId,
          visitId,

          metodo: String(payment.metodo || "-"),
          estado: String(payment.estado || "-"),
          amount: getAmount(payment),
          referencia: String(payment.referencia || "")
        }
      })

      nextRows.sort((a, b) => {
        const byDate = String(b.fecha).localeCompare(String(a.fecha))
        if (byDate !== 0) return byDate

        const byTs = String(b.sortTs).localeCompare(String(a.sortTs))
        if (byTs !== 0) return byTs

        return String(b.createdAt).localeCompare(String(a.createdAt))
      })

      setRows(nextRows)
    } catch (exc: any) {
      setError(exc?.message || "No se pudieron cargar los pagos")
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
      if (metodo && row.metodo !== metodo) return false

      if (!search) return true

      const text = [
        row.fecha,
        row.hora,
        row.cliente,
        row.direccion,
        row.repartidor,
        row.recorrido,
        row.metodo,
        row.estado,
        row.referencia,
        row.repartoId,
        row.visitId
      ]
        .map(normalize)
        .join(" ")

      return text.includes(search)
    })
  }, [rows, q, fecha, repartidorId, repartoId, metodo])

  const confirmedRows = useMemo(() => {
    return filteredRows.filter(isConfirmed)
  }, [filteredRows])

  const totalRendir = useMemo(() => {
    return confirmedRows.reduce((sum, row) => sum + row.amount, 0)
  }, [confirmedRows])

  const totalEfectivo = useMemo(() => {
    return confirmedRows.filter(row => row.metodo === "efectivo").reduce((sum, row) => sum + row.amount, 0)
  }, [confirmedRows])

  const totalTransferencia = useMemo(() => {
    return confirmedRows.filter(row => row.metodo === "transferencia").reduce((sum, row) => sum + row.amount, 0)
  }, [confirmedRows])

  const totalQr = useMemo(() => {
    return confirmedRows.filter(row => row.metodo === "qr").reduce((sum, row) => sum + row.amount, 0)
  }, [confirmedRows])

  const totalMercadoPago = useMemo(() => {
    return confirmedRows.filter(row => row.metodo === "mercado_pago").reduce((sum, row) => sum + row.amount, 0)
  }, [confirmedRows])

  const totalOtro = useMemo(() => {
    return confirmedRows.filter(row => row.metodo === "otro").reduce((sum, row) => sum + row.amount, 0)
  }, [confirmedRows])

  const methodSummary = useMemo<MethodSummary[]>(() => {
    const map = new Map<string, MethodSummary>()

    for (const row of confirmedRows) {
      const key = row.metodo || "otro"

      if (!map.has(key)) {
        map.set(key, {
          metodo: key,
          cantidad: 0,
          total: 0
        })
      }

      const item = map.get(key)!
      item.cantidad += 1
      item.total += row.amount
    }

    return Array.from(map.values()).sort((a, b) => b.total - a.total)
  }, [confirmedRows])

  function setTodayFilter() {
    setFecha(todayLocalDate())
  }

  function clearFilters() {
    setQ("")
    setFecha("")
    setRepartidorId("")
    setRepartoId("")
    setMetodo("")
  }

  function exportRows() {
    downloadCsv(`pagos_reparto_${new Date().toISOString().slice(0, 10)}.csv`, filteredRows)
  }

  if (loading) return <LoadingBlock />
  if (error) return <ErrorBlock error={error} onRetry={load} />

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader
          title="Pagos"
          subtitle="Control de caja por repartidor, fecha, reparto y método de pago."
          right={
            <div className="flex flex-wrap justify-end gap-2">
              <div className="relative w-full sm:w-[280px]">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
                <Input
                  value={q}
                  onChange={e => setQ(e.target.value)}
                  placeholder="Buscar cliente, repartidor..."
                  className="pl-9"
                />
              </div>

              <Select
                value={repartidorId}
                onChange={e => setRepartidorId(e.target.value)}
                className="w-full sm:w-[190px]"
              >
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

              <Select
                value={repartoId}
                onChange={e => setRepartoId(e.target.value)}
                className="w-full sm:w-[260px]"
              >
                <option value="">Todos los repartos</option>
                {runOptions.map(option => (
                  <option key={option.runId} value={option.runId}>
                    {option.hora} · {option.repartidor} · {option.recorrido}
                  </option>
                ))}
              </Select>

              <Select
                value={metodo}
                onChange={e => setMetodo(e.target.value)}
                className="w-full sm:w-[170px]"
              >
                <option value="">Todos los métodos</option>
                <option value="efectivo">Efectivo</option>
                <option value="transferencia">Transferencia</option>
                <option value="qr">QR</option>
                <option value="mercado_pago">Mercado Pago</option>
                <option value="otro">Otro</option>
              </Select>

              {(q || fecha || repartidorId || repartoId || metodo) ? (
                <Button variant="secondary" onClick={clearFilters}>
                  Limpiar
                </Button>
              ) : null}

              <Button variant="secondary" onClick={load}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Actualizar
              </Button>

              <Button variant="secondary" onClick={exportRows}>
                <Download className="mr-2 h-4 w-4" />
                CSV
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

          <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
            <div className="rounded-2xl bg-zinc-900 p-4 text-white">
              <WalletCards className="h-5 w-5 opacity-80" />
              <div className="mt-2 text-2xl font-semibold">{money(totalRendir)}</div>
              <div className="text-xs opacity-80">total a rendir</div>
            </div>

            <div className="rounded-2xl border border-zinc-200 p-4">
              <Banknote className="h-5 w-5 text-zinc-500" />
              <div className="mt-2 text-2xl font-semibold text-zinc-900">{money(totalEfectivo)}</div>
              <div className="text-xs text-zinc-500">efectivo</div>
            </div>

            <div className="rounded-2xl border border-zinc-200 p-4">
              <Landmark className="h-5 w-5 text-zinc-500" />
              <div className="mt-2 text-2xl font-semibold text-zinc-900">{money(totalTransferencia)}</div>
              <div className="text-xs text-zinc-500">transferencia</div>
            </div>

            <div className="rounded-2xl border border-zinc-200 p-4">
              <QrCode className="h-5 w-5 text-zinc-500" />
              <div className="mt-2 text-2xl font-semibold text-zinc-900">{money(totalQr)}</div>
              <div className="text-xs text-zinc-500">QR</div>
            </div>

            <div className="rounded-2xl border border-zinc-200 p-4">
              <CreditCard className="h-5 w-5 text-zinc-500" />
              <div className="mt-2 text-2xl font-semibold text-zinc-900">{money(totalMercadoPago)}</div>
              <div className="text-xs text-zinc-500">Mercado Pago</div>
            </div>

            <div className="rounded-2xl border border-zinc-200 p-4">
              <div className="text-xs font-medium text-zinc-500">Otro</div>
              <div className="mt-2 text-2xl font-semibold text-zinc-900">{money(totalOtro)}</div>
              <div className="text-xs text-zinc-500">otros métodos</div>
            </div>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Resumen por método"
          subtitle="Totales confirmados según los filtros actuales."
        />

        <CardBody className="p-0">
          {methodSummary.length === 0 ? (
            <div className="p-5">
              <EmptyBlock label="No hay pagos para resumir." />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead className="border-b border-zinc-100 bg-zinc-50 text-xs font-medium text-zinc-500">
                  <tr>
                    <th className="px-4 py-3">Método</th>
                    <th className="px-4 py-3">Cantidad</th>
                    <th className="px-4 py-3">Total</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-zinc-100">
                  {methodSummary.map(row => (
                    <tr key={row.metodo}>
                      <td className="px-4 py-3 font-medium text-zinc-900">{metodoLabel(row.metodo)}</td>
                      <td className="px-4 py-3 text-zinc-700">{row.cantidad}</td>
                      <td className="px-4 py-3 text-zinc-900">{money(row.total)}</td>
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
          title="Detalle de pagos"
          subtitle="Control por repartidor, cliente y método de pago."
        />

        <CardBody className="p-0">
          {filteredRows.length === 0 ? (
            <div className="p-5">
              <EmptyBlock label="No hay pagos para mostrar." />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1120px] text-left text-sm">
                <thead className="border-b border-zinc-100 bg-zinc-50 text-xs font-medium text-zinc-500">
                  <tr>
                    <th className="px-4 py-3">Fecha</th>
                    <th className="px-4 py-3">Hora</th>
                    <th className="px-4 py-3">Repartidor</th>
                    <th className="px-4 py-3">Recorrido</th>
                    <th className="px-4 py-3">Cliente</th>
                    <th className="px-4 py-3">Método</th>
                    <th className="px-4 py-3">Monto</th>
                    <th className="px-4 py-3">Referencia</th>
                    <th className="px-4 py-3">Estado</th>
                    <th className="px-4 py-3">Registrado</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-zinc-100">
                  {filteredRows.map(row => (
                    <tr key={row.id} className="hover:bg-zinc-50">
                      <td className="px-4 py-3 text-zinc-700">{formatDate(row.fecha)}</td>
                      <td className="px-4 py-3 text-zinc-700">{row.hora}</td>
                      <td className="px-4 py-3 font-medium text-zinc-900">{row.repartidor || "-"}</td>
                      <td className="px-4 py-3 text-zinc-700">{row.recorrido || "-"}</td>

                      <td className="px-4 py-3">
                        <div className="font-medium text-zinc-900">{row.cliente}</div>
                        {row.direccion ? <div className="mt-1 text-xs text-zinc-500">{row.direccion}</div> : null}
                      </td>

                      <td className="px-4 py-3 text-zinc-700">{metodoLabel(row.metodo)}</td>
                      <td className="px-4 py-3 font-semibold text-zinc-900">{money(row.amount)}</td>
                      <td className="px-4 py-3 text-zinc-600">{row.referencia || "-"}</td>

                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2 py-1 text-xs font-medium ${estadoClass(row.estado)}`}>
                          {row.estado}
                        </span>
                      </td>

                      <td className="px-4 py-3 text-zinc-600">{formatDateTime(row.createdAt)}</td>
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