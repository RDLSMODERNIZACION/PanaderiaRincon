"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Download, PackageCheck, RefreshCw, Search, Truck, Wheat } from "lucide-react"
import Button from "@/components/ui/Button"
import Input from "@/components/ui/Input"
import Select from "@/components/ui/Select"
import { Card, CardBody, CardHeader } from "@/components/ui/Card"
import { EmptyBlock, ErrorBlock, LoadingBlock } from "@/components/data/AsyncState"
import { useAuth } from "@/features/auth/AuthProvider"
import { apiGet, unwrapData } from "@/lib/api"
import { downloadCsv } from "@/lib/csv"
import type { RowData } from "@/features/crud/types"

type RowKind = "stock" | "pan_devuelto"

type StockAuditRow = {
  id: string
  kind: RowKind
  fecha: string
  hora: string
  sortTs: string
  repartoId: string
  repartidor: string
  repartidorId: string
  recorrido: string
  comercio: string
  producto: string
  productId: string
  unidad: string
  estadoReparto: string

  cargado: number
  entregado: number
  vuelveEsperado: number
}

type ProductSummary = {
  producto: string
  unidad: string
  cargado: number
  entregado: number
  vuelveEsperado: number
}

type VisitInfo = {
  runId: string
  customerId: string
  customerName: string
}

type CommerceDelivery = {
  nombre: string
  cantidad: number
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
  if (!row) return ""
  return String(row.nombre || row.name || row.email || row.id || "")
}

function getRunId(row?: RowData) {
  return String(row?.deliveryRunId || row?.delivery_run_id || "")
}

function getProductId(row?: RowData) {
  return String(row?.productId || row?.product_id || "")
}

function getVisitRunId(row?: RowData) {
  return String(row?.deliveryRunId || row?.delivery_run_id || "")
}

function getVisitCustomerId(row?: RowData) {
  return String(row?.customerId || row?.customer_id || "")
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

function getBreadcrumbVisitId(row?: RowData) {
  return String(row?.visitId || row?.visit_id || "")
}

function getKgEntrada(row?: RowData) {
  const n = Number(row?.kgEntrada ?? row?.kg_entrada ?? 0)
  return Number.isFinite(n) ? n : 0
}

function getDriverId(row?: RowData) {
  return String(row?.driverId || row?.driver_id || "")
}

function getRouteId(row?: RowData) {
  return String(row?.routeId || row?.route_id || "")
}

function getProductName(row?: RowData) {
  if (!row) return ""
  return String(row.nombre || row.name || row.id || "")
}

function getUnit(row?: RowData) {
  if (!row) return ""
  return String(row.unidadVenta || row.unidad_venta || "")
}

function getLoaded(row: RowData) {
  const raw = row.cantidadCargada ?? row.cantidad_cargada ?? 0
  const n = Number(raw)
  return Number.isFinite(n) ? n : 0
}

function getRunCreatedAt(row?: RowData) {
  return String(row?.startedAt || row?.started_at || row?.createdAt || row?.created_at || "")
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

function qty(value: number) {
  return Number(value || 0).toLocaleString("es-AR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  })
}

function normalize(text: unknown) {
  return String(text || "").toLowerCase()
}

function estadoRepartoClass(estado: string) {
  if (estado === "cerrado") return "bg-zinc-100 text-zinc-700"
  if (estado === "en_recorrido") return "bg-blue-100 text-blue-700"
  if (estado === "preparado") return "bg-amber-100 text-amber-800"
  if (estado === "cancelado") return "bg-red-100 text-red-700"
  return "bg-zinc-100 text-zinc-700"
}

function displayQuantity(row: StockAuditRow, field: "cargado" | "entregado" | "vuelveEsperado") {
  if (row.kind === "pan_devuelto") {
    if (field === "cargado") return "-"
    if (field === "vuelveEsperado") return "-"
    return `${qty(row.entregado)} kg`
  }

  return `${qty(row[field])} ${row.unidad || ""}`.trim()
}

export default function StockOverviewView() {
  const { session } = useAuth()

  const [rows, setRows] = useState<StockAuditRow[]>([])
  const [q, setQ] = useState("")
  const [fecha, setFecha] = useState("")
  const [repartidorId, setRepartidorId] = useState("")
  const [repartoId, setRepartoId] = useState("")
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
      const [stockPayload, productsPayload, runsPayload, employeesPayload, routesPayload, customersPayload] = await Promise.all([
        apiGet(currentSession, "/api/admin/crud/delivery_run_stock?limit=1000&order_by=created_at&desc=true"),
        apiGet(currentSession, "/api/admin/crud/products?limit=1000&order_by=nombre"),
        apiGet(currentSession, "/api/admin/crud/delivery_runs?limit=1000&order_by=fecha&desc=true"),
        apiGet(currentSession, "/api/admin/crud/employees?limit=1000&order_by=nombre"),
        apiGet(currentSession, "/api/admin/crud/delivery_routes?limit=1000&order_by=nombre"),
        apiGet(currentSession, "/api/admin/crud/customers?limit=1000&order_by=nombre")
      ])

      const stockRows = unwrapData<RowData[]>(stockPayload) || []
      const products = unwrapData<RowData[]>(productsPayload) || []
      const runs = unwrapData<RowData[]>(runsPayload) || []
      const employees = unwrapData<RowData[]>(employeesPayload) || []
      const routes = unwrapData<RowData[]>(routesPayload) || []
      const customers = unwrapData<RowData[]>(customersPayload) || []

      async function optionalRows(path: string, label: string): Promise<RowData[]> {
        try {
          const payload = await apiGet(currentSession, path)
          return unwrapData<RowData[]>(payload) || []
        } catch (exc) {
          console.warn(`No se pudo cargar ${label}`, exc)
          setWarning("Algunos datos secundarios no se pudieron cargar. La auditoría puede estar incompleta.")
          return []
        }
      }

      const [visits, visitItems, breadcrumbs] = await Promise.all([
        optionalRows("/api/admin/crud/delivery_visits?limit=1000&order_by=arrived_at&desc=true", "visitas"),
        optionalRows("/api/admin/crud/delivery_visit_items?limit=1000&order_by=id", "items de visita"),
        optionalRows("/api/admin/crud/breadcrumb_account_movements?limit=1000&order_by=fecha&desc=true", "pan viejo")
      ])

      const productById = new Map(products.map(product => [getId(product), product]))
      const runById = new Map(runs.map(run => [getId(run), run]))
      const employeeById = new Map(employees.map(employee => [getId(employee), employee]))
      const routeById = new Map(routes.map(route => [getId(route), route]))
      const customerById = new Map(customers.map(customer => [getId(customer), customer]))

      const visitInfoByVisitId = new Map<string, VisitInfo>()

      for (const visit of visits) {
        const visitId = getId(visit)
        const runId = getVisitRunId(visit)
        const customerId = getVisitCustomerId(visit)
        const customer = customerById.get(customerId)

        if (visitId && runId) {
          visitInfoByVisitId.set(visitId, {
            runId,
            customerId,
            customerName: getName(customer) || customerId || "-"
          })
        }
      }

      const deliveredByRunProduct = new Map<string, number>()
      const commerceByRunProduct = new Map<string, Map<string, CommerceDelivery>>()

      for (const item of visitItems) {
        if (getItemTipo(item) !== "venta") continue

        const visitId = getItemVisitId(item)
        const info = visitInfoByVisitId.get(visitId)
        const productId = getItemProductId(item)
        const cantidad = getItemCantidad(item)

        if (!info?.runId || !productId || cantidad <= 0) continue

        const key = `${info.runId}__${productId}`
        deliveredByRunProduct.set(key, (deliveredByRunProduct.get(key) || 0) + cantidad)

        if (!commerceByRunProduct.has(key)) {
          commerceByRunProduct.set(key, new Map())
        }

        const commerceMap = commerceByRunProduct.get(key)!
        const commerceKey = info.customerId || info.customerName

        if (!commerceMap.has(commerceKey)) {
          commerceMap.set(commerceKey, {
            nombre: info.customerName,
            cantidad: 0
          })
        }

        commerceMap.get(commerceKey)!.cantidad += cantidad
      }

      const panDevueltoRows: StockAuditRow[] = []

      for (const movement of breadcrumbs) {
        const visitId = getBreadcrumbVisitId(movement)
        const info = visitInfoByVisitId.get(visitId)
        const kg = getKgEntrada(movement)

        if (!info?.runId || kg <= 0) continue

        const run = runById.get(info.runId)
        const driverId = getDriverId(run)
        const routeId = getRouteId(run)
        const employee = run ? employeeById.get(driverId) : undefined
        const route = run ? routeById.get(routeId) : undefined
        const runTs = getRunCreatedAt(run)

        panDevueltoRows.push({
          id: `pan_devuelto_${getId(movement)}`,
          kind: "pan_devuelto",
          fecha: String(run?.fecha || run?.date || ""),
          hora: formatHour(runTs),
          sortTs: runTs || String(run?.fecha || ""),
          repartoId: info.runId,
          repartidor: getName(employee) || driverId,
          repartidorId: driverId,
          recorrido: getName(route) || routeId,
          comercio: info.customerName,
          producto: "Pan devuelto",
          productId: "pan_devuelto",
          unidad: "kg",
          estadoReparto: String(run?.estado || "-"),

          cargado: 0,
          entregado: kg,
          vuelveEsperado: 0
        })
      }

      const stockAuditRows: StockAuditRow[] = stockRows
        .map(stock => {
          const runId = getRunId(stock)
          const productId = getProductId(stock)

          const run = runById.get(runId)
          const product = productById.get(productId)
          const driverId = getDriverId(run)
          const routeId = getRouteId(run)
          const employee = run ? employeeById.get(driverId) : undefined
          const route = run ? routeById.get(routeId) : undefined

          const unidad = getUnit(product)
          const cargado = getLoaded(stock)
          const entregado = deliveredByRunProduct.get(`${runId}__${productId}`) || 0
          const vuelveEsperado = Math.max(cargado - entregado, 0)

          const runTs = getRunCreatedAt(run)
          const hora = formatHour(runTs)

          const commerceMap = commerceByRunProduct.get(`${runId}__${productId}`)
          const comercio = commerceMap
            ? Array.from(commerceMap.values())
                .sort((a, b) => a.nombre.localeCompare(b.nombre))
                .map(item => `${item.nombre}: ${qty(item.cantidad)} ${unidad || ""}`.trim())
                .join(", ")
            : "-"

          return {
            id: getId(stock),
            kind: "stock" as RowKind,
            fecha: String(run?.fecha || run?.date || ""),
            hora,
            sortTs: runTs || String(run?.fecha || ""),
            repartoId: runId,
            repartidor: getName(employee) || driverId,
            repartidorId: driverId,
            recorrido: getName(route) || routeId,
            comercio,
            producto: getProductName(product) || productId,
            productId,
            unidad,
            estadoReparto: String(run?.estado || "-"),

            cargado,
            entregado,
            vuelveEsperado
          }
        })
        .filter(row => row.cargado > 0)

      const nextRows = [...stockAuditRows, ...panDevueltoRows].sort((a, b) => {
        const byDate = String(b.fecha).localeCompare(String(a.fecha))
        if (byDate !== 0) return byDate

        const byTs = String(b.sortTs).localeCompare(String(a.sortTs))
        if (byTs !== 0) return byTs

        const byDriver = a.repartidor.localeCompare(b.repartidor)
        if (byDriver !== 0) return byDriver

        if (a.kind !== b.kind) return a.kind === "stock" ? -1 : 1

        return a.producto.localeCompare(b.producto)
      })

      setRows(nextRows)
    } catch (exc: any) {
      setError(exc?.message || "No se pudo cargar la auditoría de stock")
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
          estado: row.estadoReparto
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
        row.repartidor,
        row.recorrido,
        row.comercio,
        row.producto,
        row.unidad,
        row.estadoReparto
      ]
        .map(normalize)
        .join(" ")

      return text.includes(search)
    })
  }, [rows, q, fecha, repartidorId, repartoId])

  const productSummary = useMemo<ProductSummary[]>(() => {
    const map = new Map<string, ProductSummary>()

    for (const row of filteredRows) {
      const key = `${row.producto}__${row.unidad}`

      if (!map.has(key)) {
        map.set(key, {
          producto: row.producto,
          unidad: row.unidad,
          cargado: 0,
          entregado: 0,
          vuelveEsperado: 0
        })
      }

      const item = map.get(key)!

      if (row.kind === "stock") {
        item.cargado += row.cargado
        item.entregado += row.entregado
        item.vuelveEsperado += row.vuelveEsperado
      } else {
        item.entregado += row.entregado
      }
    }

    return Array.from(map.values()).sort((a, b) => {
      if (a.producto === "Pan devuelto") return 1
      if (b.producto === "Pan devuelto") return -1
      return b.cargado - a.cargado
    })
  }, [filteredRows])

  const repartosConStock = useMemo(() => {
    return new Set(filteredRows.map(row => row.repartoId)).size
  }, [filteredRows])

  const totalDebeVolver = useMemo(() => {
    return filteredRows
      .filter(row => row.kind === "stock")
      .reduce((sum, row) => sum + row.vuelveEsperado, 0)
  }, [filteredRows])

  const totalPanDevuelto = useMemo(() => {
    return filteredRows
      .filter(row => row.kind === "pan_devuelto")
      .reduce((sum, row) => sum + row.entregado, 0)
  }, [filteredRows])

  function clearFilters() {
    setQ("")
    setFecha("")
    setRepartidorId("")
    setRepartoId("")
  }

  function setTodayFilter() {
    setFecha(todayLocalDate())
  }

  function exportRows() {
    downloadCsv(`stock_auditoria_${new Date().toISOString().slice(0, 10)}.csv`, filteredRows)
  }

  if (loading) return <LoadingBlock />
  if (error) return <ErrorBlock error={error} onRetry={load} />

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader
          title="Stock"
          subtitle="Auditoría de mercadería por repartidor, fecha y reparto."
          right={
            <div className="flex flex-wrap justify-end gap-2">
              <div className="relative w-full sm:w-[260px]">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
                <Input
                  value={q}
                  onChange={e => setQ(e.target.value)}
                  placeholder="Buscar producto o comercio..."
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

          <div className="grid gap-3 md:grid-cols-4">
            <div className="rounded-2xl bg-zinc-900 p-4 text-white">
              <Truck className="h-5 w-5 opacity-80" />
              <div className="mt-2 text-2xl font-semibold">{repartosConStock}</div>
              <div className="text-xs opacity-80">repartos filtrados</div>
            </div>

            <div className="rounded-2xl border border-zinc-200 p-4">
              <PackageCheck className="h-5 w-5 text-zinc-500" />
              <div className="mt-2 text-2xl font-semibold text-zinc-900">{filteredRows.length}</div>
              <div className="text-xs text-zinc-500">líneas auditadas</div>
            </div>

            <div className="rounded-2xl border border-zinc-200 p-4">
              <div className="text-xs font-medium text-zinc-500">Debe volver</div>
              <div className="mt-2 text-2xl font-semibold text-zinc-900">{qty(totalDebeVolver)}</div>
              <div className="text-xs text-zinc-500">total esperado</div>
            </div>

            <div className="rounded-2xl border border-zinc-200 p-4">
              <Wheat className="h-5 w-5 text-amber-600" />
              <div className="mt-2 text-2xl font-semibold text-zinc-900">{qty(totalPanDevuelto)} kg</div>
              <div className="text-xs text-zinc-500">pan devuelto</div>
            </div>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Resumen por producto"
          subtitle="Total cargado, entregado o recibido según el filtro actual."
        />

        <CardBody className="p-0">
          {productSummary.length === 0 ? (
            <div className="p-5">
              <EmptyBlock label="No hay productos para auditar." />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="border-b border-zinc-100 bg-zinc-50 text-xs font-medium text-zinc-500">
                  <tr>
                    <th className="px-4 py-3">Producto</th>
                    <th className="px-4 py-3">Unidad</th>
                    <th className="px-4 py-3">Salió</th>
                    <th className="px-4 py-3">Entregado / recibido</th>
                    <th className="px-4 py-3">Debe volver</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-zinc-100">
                  {productSummary.map(row => {
                    const isPanDevuelto = row.producto === "Pan devuelto"

                    return (
                      <tr key={`${row.producto}_${row.unidad}`} className={isPanDevuelto ? "bg-amber-50" : ""}>
                        <td className="px-4 py-3 font-medium text-zinc-900">{row.producto}</td>
                        <td className="px-4 py-3 text-zinc-600">{row.unidad || "-"}</td>
                        <td className="px-4 py-3 text-zinc-900">{isPanDevuelto ? "-" : qty(row.cargado)}</td>
                        <td className="px-4 py-3 text-zinc-900">{qty(row.entregado)}</td>
                        <td className="px-4 py-3 text-zinc-900">{isPanDevuelto ? "-" : qty(row.vuelveEsperado)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Detalle por reparto"
          subtitle="Seleccioná repartidor, fecha y reparto para auditar salidas múltiples del mismo día."
        />

        <CardBody className="p-0">
          {filteredRows.length === 0 ? (
            <div className="p-5">
              <EmptyBlock label="No hay stock cargado para mostrar." />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1180px] text-left text-sm">
                <thead className="border-b border-zinc-100 bg-zinc-50 text-xs font-medium text-zinc-500">
                  <tr>
                    <th className="px-4 py-3">Fecha</th>
                    <th className="px-4 py-3">Hora</th>
                    <th className="px-4 py-3">Repartidor</th>
                    <th className="px-4 py-3">Recorrido</th>
                    <th className="px-4 py-3">Comercio / empresa</th>
                    <th className="px-4 py-3">Producto</th>
                    <th className="px-4 py-3">Salió</th>
                    <th className="px-4 py-3">Entregado / recibido</th>
                    <th className="px-4 py-3">Debe volver</th>
                    <th className="px-4 py-3">Estado reparto</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-zinc-100">
                  {filteredRows.map(row => (
                    <tr
                      key={row.id}
                      className={row.kind === "pan_devuelto" ? "bg-amber-50 hover:bg-amber-100/60" : "hover:bg-zinc-50"}
                    >
                      <td className="px-4 py-3 text-zinc-700">{formatDate(row.fecha)}</td>
                      <td className="px-4 py-3 text-zinc-700">{row.hora}</td>
                      <td className="px-4 py-3 font-medium text-zinc-900">{row.repartidor || "-"}</td>
                      <td className="px-4 py-3 text-zinc-700">{row.recorrido || "-"}</td>
                      <td className="max-w-[320px] px-4 py-3 text-zinc-700">{row.comercio}</td>
                      <td className="px-4 py-3 font-medium text-zinc-900">{row.producto}</td>
                      <td className="px-4 py-3 text-zinc-900">{displayQuantity(row, "cargado")}</td>
                      <td className="px-4 py-3 text-zinc-900">{displayQuantity(row, "entregado")}</td>
                      <td className="px-4 py-3 font-semibold text-zinc-900">{displayQuantity(row, "vuelveEsperado")}</td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2 py-1 text-xs font-medium ${estadoRepartoClass(row.estadoReparto)}`}>
                          {row.estadoReparto}
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

      <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-600">
        <strong>Nota:</strong> “Debe volver” se calcula como mercadería cargada menos mercadería entregada.
        El pan devuelto aparece como una fila aparte en color diferente.
      </div>
    </div>
  )
}