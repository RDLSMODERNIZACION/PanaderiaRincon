"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Download, PackageCheck, RefreshCw, Search } from "lucide-react"
import Button from "@/components/ui/Button"
import Input from "@/components/ui/Input"
import { Card, CardBody, CardHeader } from "@/components/ui/Card"
import { EmptyBlock, ErrorBlock, LoadingBlock } from "@/components/data/AsyncState"
import { useAuth } from "@/features/auth/AuthProvider"
import { apiGet, unwrapData } from "@/lib/api"
import { downloadCsv } from "@/lib/csv"
import type { RowData } from "@/features/crud/types"

type StockRow = {
  id: string
  fecha: string
  repartoId: string
  repartidor: string
  recorrido: string
  producto: string
  cantidad: number
  unidad: string
  estado: string
  createdAt?: string
}

type ProductSummary = {
  producto: string
  unidad: string
  cantidad: number
}

function getId(row: RowData) {
  return String(row.id || "")
}

function getRunId(row: RowData) {
  return String(row.deliveryRunId || row.delivery_run_id || "")
}

function getProductId(row: RowData) {
  return String(row.productId || row.product_id || "")
}

function getDriverId(row: RowData) {
  return String(row.driverId || row.driver_id || "")
}

function getRouteId(row: RowData) {
  return String(row.routeId || row.route_id || "")
}

function getName(row?: RowData) {
  if (!row) return ""
  return String(row.nombre || row.name || row.email || row.id || "")
}

function getProductName(row?: RowData) {
  if (!row) return ""
  return String(row.nombre || row.name || row.id || "")
}

function getUnit(row?: RowData) {
  if (!row) return ""
  return String(row.unidadVenta || row.unidad_venta || "")
}

function getQuantity(row: RowData) {
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

function estadoClass(estado: string) {
  if (estado === "cerrado") return "bg-zinc-100 text-zinc-700"
  if (estado === "en_recorrido") return "bg-blue-100 text-blue-700"
  if (estado === "preparado") return "bg-amber-100 text-amber-800"
  return "bg-zinc-100 text-zinc-700"
}

function normalize(text: unknown) {
  return String(text || "").toLowerCase()
}

export default function StockOverviewView() {
  const { session } = useAuth()

  const [rows, setRows] = useState<StockRow[]>([])
  const [q, setQ] = useState("")
  const [fecha, setFecha] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!session) return

    setLoading(true)
    setError(null)

    try {
      const [stockPayload, productsPayload, runsPayload, employeesPayload, routesPayload] = await Promise.all([
        apiGet(session, "/api/admin/crud/delivery_run_stock?limit=1000"),
        apiGet(session, "/api/admin/crud/products?limit=1000"),
        apiGet(session, "/api/admin/crud/delivery_runs?limit=1000"),
        apiGet(session, "/api/admin/crud/employees?limit=1000"),
        apiGet(session, "/api/admin/crud/delivery_routes?limit=1000")
      ])

      const stock = unwrapData<RowData[]>(stockPayload) || []
      const products = unwrapData<RowData[]>(productsPayload) || []
      const runs = unwrapData<RowData[]>(runsPayload) || []
      const employees = unwrapData<RowData[]>(employeesPayload) || []
      const routes = unwrapData<RowData[]>(routesPayload) || []

      const productById = new Map(products.map(product => [getId(product), product]))
      const runById = new Map(runs.map(run => [getId(run), run]))
      const employeeById = new Map(employees.map(employee => [getId(employee), employee]))
      const routeById = new Map(routes.map(route => [getId(route), route]))

      const nextRows: StockRow[] = stock
        .map(item => {
          const runId = getRunId(item)
          const productId = getProductId(item)

          const run = runById.get(runId)
          const product = productById.get(productId)
          const employee = run ? employeeById.get(getDriverId(run)) : undefined
          const route = run ? routeById.get(getRouteId(run)) : undefined

          return {
            id: getId(item),
            fecha: String(run?.fecha || run?.date || ""),
            repartoId: runId,
            repartidor: getName(employee) || getDriverId(run || {}),
            recorrido: getName(route) || getRouteId(run || {}),
            producto: getProductName(product) || productId,
            cantidad: getQuantity(item),
            unidad: getUnit(product),
            estado: String(run?.estado || "-"),
            createdAt: String(item.createdAt || item.created_at || "")
          }
        })
        .filter(row => row.cantidad > 0)
        .sort((a, b) => {
          const byDate = String(b.fecha).localeCompare(String(a.fecha))
          if (byDate !== 0) return byDate
          return a.producto.localeCompare(b.producto)
        })

      setRows(nextRows)
    } catch (exc: any) {
      setError(exc?.message || "No se pudo cargar el stock")
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
        row.estado
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
          cantidad: 0
        })
      }

      map.get(key)!.cantidad += row.cantidad
    }

    return Array.from(map.values()).sort((a, b) => b.cantidad - a.cantidad)
  }, [filteredRows])

  const repartosConStock = useMemo(() => {
    return new Set(filteredRows.map(row => row.repartoId)).size
  }, [filteredRows])

  const productosDistintos = useMemo(() => {
    return new Set(filteredRows.map(row => row.producto)).size
  }, [filteredRows])

  function exportRows() {
    downloadCsv(
      `stock_reparto_${new Date().toISOString().slice(0, 10)}.csv`,
      filteredRows
    )
  }

  if (loading) return <LoadingBlock />
  if (error) return <ErrorBlock error={error} onRetry={load} />

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader
          title="Stock cargado"
          subtitle="Consulta rápida de mercadería asignada a repartos."
          right={
            <div className="flex flex-wrap justify-end gap-2">
              <div className="relative w-full sm:w-[280px]">
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

              {fecha ? (
                <Button variant="secondary" onClick={() => setFecha("")}>
                  Todas las fechas
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
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl bg-zinc-900 p-4 text-white">
              <PackageCheck className="h-5 w-5 opacity-80" />
              <div className="mt-2 text-2xl font-semibold">{repartosConStock}</div>
              <div className="text-xs opacity-80">repartos con stock</div>
            </div>

            <div className="rounded-2xl border border-zinc-200 p-4">
              <div className="text-xs font-medium text-zinc-500">Productos distintos</div>
              <div className="mt-2 text-2xl font-semibold text-zinc-900">{productosDistintos}</div>
            </div>

            <div className="rounded-2xl border border-zinc-200 p-4">
              <div className="text-xs font-medium text-zinc-500">Registros cargados</div>
              <div className="mt-2 text-2xl font-semibold text-zinc-900">{filteredRows.length}</div>
            </div>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Resumen por producto"
          subtitle="Cantidad total cargada según el filtro actual."
        />

        <CardBody className="p-0">
          {productSummary.length === 0 ? (
            <div className="p-5">
              <EmptyBlock label="No hay productos cargados para mostrar." />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-left text-sm">
                <thead className="border-b border-zinc-100 bg-zinc-50 text-xs font-medium text-zinc-500">
                  <tr>
                    <th className="px-4 py-3">Producto</th>
                    <th className="px-4 py-3">Cantidad total</th>
                    <th className="px-4 py-3">Unidad</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-zinc-100">
                  {productSummary.map(row => (
                    <tr key={`${row.producto}_${row.unidad}`}>
                      <td className="px-4 py-3 font-medium text-zinc-900">{row.producto}</td>
                      <td className="px-4 py-3 text-zinc-900">{row.cantidad}</td>
                      <td className="px-4 py-3 text-zinc-600">{row.unidad || "-"}</td>
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
          title="Detalle de stock por reparto"
          subtitle="Qué producto salió, con qué repartidor y en qué recorrido."
        />

        <CardBody className="p-0">
          {filteredRows.length === 0 ? (
            <div className="p-5">
              <EmptyBlock label="No hay stock cargado para mostrar." />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-left text-sm">
                <thead className="border-b border-zinc-100 bg-zinc-50 text-xs font-medium text-zinc-500">
                  <tr>
                    <th className="px-4 py-3">Fecha</th>
                    <th className="px-4 py-3">Repartidor</th>
                    <th className="px-4 py-3">Recorrido</th>
                    <th className="px-4 py-3">Producto</th>
                    <th className="px-4 py-3">Cantidad</th>
                    <th className="px-4 py-3">Unidad</th>
                    <th className="px-4 py-3">Estado</th>
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
                      <td className="px-4 py-3 text-zinc-900">{row.cantidad}</td>
                      <td className="px-4 py-3 text-zinc-600">{row.unidad || "-"}</td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2 py-1 text-xs font-medium ${estadoClass(row.estado)}`}>
                          {row.estado}
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
    </div>
  )
}