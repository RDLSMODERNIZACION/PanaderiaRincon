"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Download, PackageCheck, RefreshCw, Search, Truck, Wheat } from "lucide-react"
import Button from "@/components/ui/Button"
import Input from "@/components/ui/Input"
import { Card, CardBody, CardHeader } from "@/components/ui/Card"
import { EmptyBlock, ErrorBlock, LoadingBlock } from "@/components/data/AsyncState"
import { useAuth } from "@/features/auth/AuthProvider"
import { apiGet, unwrapData } from "@/lib/api"
import { downloadCsv } from "@/lib/csv"
import type { RowData } from "@/features/crud/types"

type StockAuditRow = {
  id: string
  fecha: string
  repartoId: string
  repartidor: string
  recorrido: string
  producto: string
  productId: string
  unidad: string
  estadoReparto: string

  cargado: number
  entregado: number
  vuelveEsperado: number

  panViejoKg: number
}

type ProductSummary = {
  producto: string
  unidad: string
  cargado: number
  entregado: number
  vuelveEsperado: number
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

export default function StockOverviewView() {
  const { session } = useAuth()

  const [rows, setRows] = useState<StockAuditRow[]>([])
  const [q, setQ] = useState("")
  const [fecha, setFecha] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [warning, setWarning] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!session) return

    setLoading(true)
    setError(null)
    setWarning(null)

    try {
      const [stockPayload, productsPayload, runsPayload, employeesPayload, routesPayload] = await Promise.all([
        apiGet(session, "/api/admin/crud/delivery_run_stock?limit=1000&order_by=created_at&desc=true"),
        apiGet(session, "/api/admin/crud/products?limit=1000&order_by=nombre"),
        apiGet(session, "/api/admin/crud/delivery_runs?limit=1000&order_by=fecha&desc=true"),
        apiGet(session, "/api/admin/crud/employees?limit=1000&order_by=nombre"),
        apiGet(session, "/api/admin/crud/delivery_routes?limit=1000&order_by=nombre")
      ])

      const stockRows = unwrapData<RowData[]>(stockPayload) || []
      const products = unwrapData<RowData[]>(productsPayload) || []
      const runs = unwrapData<RowData[]>(runsPayload) || []
      const employees = unwrapData<RowData[]>(employeesPayload) || []
      const routes = unwrapData<RowData[]>(routesPayload) || []

      async function optionalRows(path: string, label: string) {
        try {
          const payload = await apiGet(session, path)
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

      const visitRunByVisitId = new Map<string, string>()

      for (const visit of visits) {
        const visitId = getId(visit)
        const runId = getVisitRunId(visit)
        if (visitId && runId) visitRunByVisitId.set(visitId, runId)
      }

      const deliveredByRunProduct = new Map<string, number>()

      for (const item of visitItems) {
        if (getItemTipo(item) !== "venta") continue

        const visitId = getItemVisitId(item)
        const runId = visitRunByVisitId.get(visitId)
        const productId = getItemProductId(item)

        if (!runId || !productId) continue

        const key = `${runId}__${productId}`
        deliveredByRunProduct.set(key, (deliveredByRunProduct.get(key) || 0) + getItemCantidad(item))
      }

      const breadByRun = new Map<string, number>()

      for (const movement of breadcrumbs) {
        const visitId = getBreadcrumbVisitId(movement)
        const runId = visitRunByVisitId.get(visitId)

        if (!runId) continue

        breadByRun.set(runId, (breadByRun.get(runId) || 0) + getKgEntrada(movement))
      }

      const nextRows: StockAuditRow[] = stockRows
        .map(stock => {
          const runId = getRunId(stock)
          const productId = getProductId(stock)

          const run = runById.get(runId)
          const product = productById.get(productId)
          const employee = run ? employeeById.get(getDriverId(run)) : undefined
          const route = run ? routeById.get(getRouteId(run)) : undefined

          const cargado = getLoaded(stock)
          const entregado = deliveredByRunProduct.get(`${runId}__${productId}`) || 0
          const vuelveEsperado = Math.max(cargado - entregado, 0)

          return {
            id: getId(stock),
            fecha: String(run?.fecha || run?.date || ""),
            repartoId: runId,
            repartidor: getName(employee) || getDriverId(run),
            recorrido: getName(route) || getRouteId(run),
            producto: getProductName(product) || productId,
            productId,
            unidad: getUnit(product),
            estadoReparto: String(run?.estado || "-"),

            cargado,
            entregado,
            vuelveEsperado,

            panViejoKg: breadByRun.get(runId) || 0
          }
        })
        .filter(row => row.cargado > 0)
        .sort((a, b) => {
          const byDate = String(b.fecha).localeCompare(String(a.fecha))
          if (byDate !== 0) return byDate
          const byRun = String(a.repartoId).localeCompare(String(b.repartoId))
          if (byRun !== 0) return byRun
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

  const filteredRows = useMemo(() => {
    const search = q.trim().toLowerCase()

    return rows.filter(row => {
      if (fecha && row.fecha !== fecha) return false

      if (!search) return true

      const text = [
        row.fecha,
        row.repartoId,
        row.repartidor,
        row.recorrido,
        row.producto,
        row.unidad,
        row.estadoReparto
      ]
        .map(normalize)
        .join(" ")

      return text.includes(search)
    })
  }, [rows, q, fecha])

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
      item.cargado += row.cargado
      item.entregado += row.entregado
      item.vuelveEsperado += row.vuelveEsperado
    }

    return Array.from(map.values()).sort((a, b) => b.cargado - a.cargado)
  }, [filteredRows])

  const repartosConStock = useMemo(() => {
    return new Set(filteredRows.map(row => row.repartoId)).size
  }, [filteredRows])

  const totalDebeVolver = useMemo(() => {
    return filteredRows.reduce((sum, row) => sum + row.vuelveEsperado, 0)
  }, [filteredRows])

  const panViejoTotal = useMemo(() => {
    const seen = new Set<string>()
    let total = 0

    for (const row of filteredRows) {
      if (seen.has(row.repartoId)) continue
      seen.add(row.repartoId)
      total += row.panViejoKg
    }

    return total
  }, [filteredRows])

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
          subtitle="Auditoría de mercadería: salió, entregado, debe volver y pan viejo recibido."
          right={
            <div className="flex flex-wrap justify-end gap-2">
              <div className="relative w-full sm:w-[300px]">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
                <Input
                  value={q}
                  onChange={e => setQ(e.target.value)}
                  placeholder="Buscar producto, repartidor, recorrido..."
                  className="pl-9"
                />
              </div>

              <Input
                type="date"
                value={fecha}
                onChange={e => setFecha(e.target.value)}
                className="w-full sm:w-[160px]"
              />

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
              <div className="text-xs opacity-80">repartos con stock</div>
            </div>

            <div className="rounded-2xl border border-zinc-200 p-4">
              <PackageCheck className="h-5 w-5 text-zinc-500" />
              <div className="mt-2 text-2xl font-semibold text-zinc-900">{filteredRows.length}</div>
              <div className="text-xs text-zinc-500">productos cargados</div>
            </div>

            <div className="rounded-2xl border border-zinc-200 p-4">
              <div className="text-xs font-medium text-zinc-500">Debe volver</div>
              <div className="mt-2 text-2xl font-semibold text-zinc-900">{qty(totalDebeVolver)}</div>
              <div className="text-xs text-zinc-500">total esperado</div>
            </div>

            <div className="rounded-2xl border border-zinc-200 p-4">
              <Wheat className="h-5 w-5 text-amber-600" />
              <div className="mt-2 text-2xl font-semibold text-zinc-900">{qty(panViejoTotal)} kg</div>
              <div className="text-xs text-zinc-500">pan viejo recibido</div>
            </div>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Resumen por producto"
          subtitle="Total cargado, entregado y esperado de vuelta según el filtro actual."
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
                    <th className="px-4 py-3">Entregado</th>
                    <th className="px-4 py-3">Debe volver</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-zinc-100">
                  {productSummary.map(row => (
                    <tr key={`${row.producto}_${row.unidad}`}>
                      <td className="px-4 py-3 font-medium text-zinc-900">{row.producto}</td>
                      <td className="px-4 py-3 text-zinc-600">{row.unidad || "-"}</td>
                      <td className="px-4 py-3 text-zinc-900">{qty(row.cargado)}</td>
                      <td className="px-4 py-3 text-zinc-900">{qty(row.entregado)}</td>
                      <td className="px-4 py-3 text-zinc-900">{qty(row.vuelveEsperado)}</td>
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
          title="Detalle por reparto"
          subtitle="Control de cada producto cargado contra lo entregado y lo que debería volver."
        />

        <CardBody className="p-0">
          {filteredRows.length === 0 ? (
            <div className="p-5">
              <EmptyBlock label="No hay stock cargado para mostrar." />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1040px] text-left text-sm">
                <thead className="border-b border-zinc-100 bg-zinc-50 text-xs font-medium text-zinc-500">
                  <tr>
                    <th className="px-4 py-3">Fecha</th>
                    <th className="px-4 py-3">Repartidor</th>
                    <th className="px-4 py-3">Recorrido</th>
                    <th className="px-4 py-3">Producto</th>
                    <th className="px-4 py-3">Salió</th>
                    <th className="px-4 py-3">Entregado</th>
                    <th className="px-4 py-3">Debe volver</th>
                    <th className="px-4 py-3">Pan viejo</th>
                    <th className="px-4 py-3">Estado reparto</th>
                    <th className="px-4 py-3">Reparto</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-zinc-100">
                  {filteredRows.map(row => (
                    <tr key={row.id} className="hover:bg-zinc-50">
                      <td className="px-4 py-3 text-zinc-700">{formatDate(row.fecha)}</td>
                      <td className="px-4 py-3 font-medium text-zinc-900">{row.repartidor || "-"}</td>
                      <td className="px-4 py-3 text-zinc-700">{row.recorrido || "-"}</td>
                      <td className="px-4 py-3 font-medium text-zinc-900">{row.producto}</td>
                      <td className="px-4 py-3 text-zinc-900">{qty(row.cargado)} {row.unidad}</td>
                      <td className="px-4 py-3 text-zinc-900">{qty(row.entregado)} {row.unidad}</td>
                      <td className="px-4 py-3 font-semibold text-zinc-900">{qty(row.vuelveEsperado)} {row.unidad}</td>
                      <td className="px-4 py-3 text-zinc-700">{qty(row.panViejoKg)} kg</td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2 py-1 text-xs font-medium ${estadoRepartoClass(row.estadoReparto)}`}>
                          {row.estadoReparto}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-zinc-500">{row.repartoId}</td>
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
      </div>
    </div>
  )
}