"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Banknote, CheckCircle2, Clock, Download, RefreshCw, Search, WalletCards, XCircle } from "lucide-react"
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
  createdAt: string
  cliente: string
  direccion: string
  repartidor: string
  recorrido: string
  metodo: string
  estado: string
  amount: number
  referencia: string
  repartoId: string
  visitId: string
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

function getAmount(row: RowData) {
  const n = Number(row.amount ?? 0)
  return Number.isFinite(n) ? n : 0
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

function normalize(text: unknown) {
  return String(text || "").toLowerCase()
}

export default function PaymentsOverviewView() {
  const { session } = useAuth()

  const [rows, setRows] = useState<PaymentRow[]>([])
  const [q, setQ] = useState("")
  const [fecha, setFecha] = useState("")
  const [estado, setEstado] = useState("")
  const [metodo, setMetodo] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [warning, setWarning] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!session) return

    setLoading(true)
    setError(null)
    setWarning(null)

    try {
      const paymentsPayload = await apiGet(session, "/api/admin/crud/payments?limit=1000&order_by=created_at&desc=true")
      const payments = unwrapData<RowData[]>(paymentsPayload) || []

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
        const employee = run ? employeeById.get(getRunDriverId(run)) : undefined
        const route = run ? routeById.get(getRunRouteId(run)) : undefined

        const createdAt = String(payment.createdAt || payment.created_at || "")
        const fecha = createdAt ? createdAt.slice(0, 10) : ""

        return {
          id: getId(payment),
          fecha,
          createdAt,
          cliente: getName(customer) || customerId,
          direccion: String(customer?.direccion || ""),
          repartidor: getName(employee) || getRunDriverId(run),
          recorrido: getName(route) || getRunRouteId(run),
          metodo: String(payment.metodo || "-"),
          estado: String(payment.estado || "-"),
          amount: getAmount(payment),
          referencia: String(payment.referencia || ""),
          repartoId: runId,
          visitId
        }
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

  const filteredRows = useMemo(() => {
    const search = q.trim().toLowerCase()

    return rows.filter(row => {
      if (fecha && row.fecha !== fecha) return false
      if (estado && row.estado !== estado) return false
      if (metodo && row.metodo !== metodo) return false

      if (!search) return true

      const text = [
        row.fecha,
        row.id,
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
  }, [rows, q, fecha, estado, metodo])

  const totalConfirmado = useMemo(
    () => filteredRows.filter(row => row.estado === "confirmado").reduce((sum, row) => sum + row.amount, 0),
    [filteredRows]
  )

  const totalPendiente = useMemo(
    () => filteredRows.filter(row => row.estado === "pendiente").reduce((sum, row) => sum + row.amount, 0),
    [filteredRows]
  )

  const totalRechazado = useMemo(
    () => filteredRows.filter(row => row.estado === "rechazado").reduce((sum, row) => sum + row.amount, 0),
    [filteredRows]
  )

  const pagosConfirmados = useMemo(
    () => filteredRows.filter(row => row.estado === "confirmado").length,
    [filteredRows]
  )

  const methodSummary = useMemo<MethodSummary[]>(() => {
    const map = new Map<string, MethodSummary>()

    for (const row of filteredRows) {
      if (row.estado === "rechazado") continue

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
  }, [filteredRows])

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
          subtitle="Consulta rápida de cobros por cliente, repartidor, método y estado."
          right={
            <div className="flex flex-wrap justify-end gap-2">
              <div className="relative w-full sm:w-[300px]">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
                <Input
                  value={q}
                  onChange={e => setQ(e.target.value)}
                  placeholder="Buscar cliente, repartidor, método..."
                  className="pl-9"
                />
              </div>

              <Input
                type="date"
                value={fecha}
                onChange={e => setFecha(e.target.value)}
                className="w-full sm:w-[160px]"
              />

              <Select value={estado} onChange={e => setEstado(e.target.value)} className="w-full sm:w-[150px]">
                <option value="">Todos</option>
                <option value="confirmado">Confirmados</option>
                <option value="pendiente">Pendientes</option>
                <option value="rechazado">Rechazados</option>
              </Select>

              <Select value={metodo} onChange={e => setMetodo(e.target.value)} className="w-full sm:w-[160px]">
                <option value="">Todos los métodos</option>
                <option value="efectivo">Efectivo</option>
                <option value="transferencia">Transferencia</option>
                <option value="mercado_pago">Mercado Pago</option>
                <option value="qr">QR</option>
                <option value="otro">Otro</option>
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

          <div className="grid gap-3 md:grid-cols-4">
            <div className="rounded-2xl bg-zinc-900 p-4 text-white">
              <WalletCards className="h-5 w-5 opacity-80" />
              <div className="mt-2 text-2xl font-semibold">{money(totalConfirmado)}</div>
              <div className="text-xs opacity-80">confirmado</div>
            </div>

            <div className="rounded-2xl border border-zinc-200 p-4">
              <Clock className="h-5 w-5 text-amber-600" />
              <div className="mt-2 text-2xl font-semibold text-zinc-900">{money(totalPendiente)}</div>
              <div className="text-xs text-zinc-500">pendiente</div>
            </div>

            <div className="rounded-2xl border border-zinc-200 p-4">
              <XCircle className="h-5 w-5 text-red-600" />
              <div className="mt-2 text-2xl font-semibold text-zinc-900">{money(totalRechazado)}</div>
              <div className="text-xs text-zinc-500">rechazado</div>
            </div>

            <div className="rounded-2xl border border-zinc-200 p-4">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              <div className="mt-2 text-2xl font-semibold text-zinc-900">{pagosConfirmados}</div>
              <div className="text-xs text-zinc-500">pagos confirmados</div>
            </div>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Resumen por método" subtitle="Totales cobrados según el filtro actual." />
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
          subtitle="Cliente, repartidor, método, estado y monto cobrado."
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
                    <th className="px-4 py-3">Cliente</th>
                    <th className="px-4 py-3">Repartidor</th>
                    <th className="px-4 py-3">Recorrido</th>
                    <th className="px-4 py-3">Método</th>
                    <th className="px-4 py-3">Monto</th>
                    <th className="px-4 py-3">Estado</th>
                    <th className="px-4 py-3">Referencia</th>
                    <th className="px-4 py-3">Hora</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-zinc-100">
                  {filteredRows.map(row => (
                    <tr key={row.id} className="hover:bg-zinc-50">
                      <td className="px-4 py-3 text-zinc-700">{formatDate(row.fecha)}</td>

                      <td className="px-4 py-3">
                        <div className="font-medium text-zinc-900">{row.cliente}</div>
                        {row.direccion ? <div className="mt-1 text-xs text-zinc-500">{row.direccion}</div> : null}
                      </td>

                      <td className="px-4 py-3 text-zinc-700">{row.repartidor || "-"}</td>
                      <td className="px-4 py-3 text-zinc-700">{row.recorrido || "-"}</td>
                      <td className="px-4 py-3 text-zinc-700">{metodoLabel(row.metodo)}</td>
                      <td className="px-4 py-3 font-semibold text-zinc-900">{money(row.amount)}</td>

                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2 py-1 text-xs font-medium ${estadoClass(row.estado)}`}>
                          {row.estado}
                        </span>
                      </td>

                      <td className="px-4 py-3 text-zinc-600">{row.referencia || "-"}</td>
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