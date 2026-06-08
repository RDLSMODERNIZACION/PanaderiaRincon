"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Download, Pencil, Plus, RefreshCw, Search, Trash2 } from "lucide-react"
import Button from "@/components/ui/Button"
import Input from "@/components/ui/Input"
import Modal from "@/components/ui/Modal"
import { Card, CardBody, CardHeader } from "@/components/ui/Card"
import { EmptyBlock, ErrorBlock, LoadingBlock } from "@/components/data/AsyncState"
import { useAuth } from "@/features/auth/AuthProvider"
import { apiDelete, apiGet, apiPatch, apiPost, buildQuery, unwrapData } from "@/lib/api"
import type { RowData, TableMeta } from "@/features/crud/types"
import CrudDataTable from "@/features/crud/CrudDataTable"
import CrudForm from "@/features/crud/CrudForm"
import RouteCustomersModal from "@/features/reparto/RouteCustomersModal"
import RunStockModal from "@/features/reparto/RunStockModal"
import { downloadCsv } from "@/lib/csv"

type RunStockSummary = {
  count: number
  total: number
}

type RunLookups = {
  employees: Record<string, string>
  routes: Record<string, string>
}

function rowLabel(row: RowData) {
  return String(row.nombre || row.name || row.email || row.id || "")
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
  return d.toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" })
}

function isActive(row: RowData) {
  if ("activo" in row) return Boolean(row.activo)
  if ("active" in row) return Boolean(row.active)
  return true
}

function runDriverId(row: RowData) {
  return String(row.driver_id || row.driverId || "")
}

function runRouteId(row: RowData) {
  return String(row.route_id || row.routeId || "")
}

function runStockStatus(summary?: RunStockSummary) {
  if (!summary || summary.count === 0) {
    return { label: "Sin asignar", className: "bg-amber-100 text-amber-800" }
  }

  return {
    label: `${summary.count} producto${summary.count === 1 ? "" : "s"}`,
    className: "bg-emerald-100 text-emerald-700"
  }
}

function RoutesTable({
  rows,
  onOpen,
  onEdit,
  onDelete,
  canWrite,
  canDelete
}: {
  rows: RowData[]
  onOpen: (row: RowData) => void
  onEdit: (row: RowData) => void
  onDelete: (row: RowData) => void
  canWrite: boolean
  canDelete: boolean
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] text-left text-sm">
        <thead className="border-b border-zinc-100 bg-zinc-50 text-xs font-medium text-zinc-500">
          <tr>
            <th className="px-4 py-3">ID</th>
            <th className="px-4 py-3">Nombre</th>
            <th className="px-4 py-3">Activo</th>
            <th className="px-4 py-3">Creado</th>
            <th className="px-4 py-3 text-right">Acciones</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100">
          {rows.map(row => (
            <tr key={String(row.id)} className="cursor-pointer transition hover:bg-zinc-50" onClick={() => onOpen(row)}>
              <td className="px-4 py-3 font-mono text-xs text-zinc-600">{String(row.id || "-")}</td>
              <td className="px-4 py-3 font-medium text-zinc-900">{rowLabel(row)}</td>
              <td className="px-4 py-3">
                <span className={`rounded-full px-2 py-1 text-xs font-medium ${isActive(row) ? "bg-emerald-100 text-emerald-700" : "bg-zinc-100 text-zinc-600"}`}>
                  {isActive(row) ? "Sí" : "No"}
                </span>
              </td>
              <td className="px-4 py-3 text-zinc-600">{formatDate(row.created_at || row.createdAt)}</td>
              <td className="px-4 py-3">
                <div className="flex justify-end gap-2">
                  {canWrite ? (
                    <button
                      type="button"
                      className="rounded-xl border border-zinc-200 p-2 hover:bg-zinc-100"
                      onClick={event => {
                        event.stopPropagation()
                        onEdit(row)
                      }}
                      aria-label="Editar"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                  ) : null}

                  {canDelete ? (
                    <button
                      type="button"
                      className="rounded-xl bg-red-600 p-2 text-white hover:bg-red-700"
                      onClick={event => {
                        event.stopPropagation()
                        onDelete(row)
                      }}
                      aria-label="Eliminar"
                    >
                      <Trash2 className="h-4 w-4" />
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
}

function RunsTable({
  rows,
  stockByRun,
  lookups,
  onOpen,
  onEdit,
  onDelete,
  canWrite,
  canDelete
}: {
  rows: RowData[]
  stockByRun: Record<string, RunStockSummary>
  lookups: RunLookups
  onOpen: (row: RowData) => void
  onEdit: (row: RowData) => void
  onDelete: (row: RowData) => void
  canWrite: boolean
  canDelete: boolean
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[980px] text-left text-sm">
        <thead className="border-b border-zinc-100 bg-zinc-50 text-xs font-medium text-zinc-500">
          <tr>
            <th className="px-4 py-3">ID</th>
            <th className="px-4 py-3">Fecha</th>
            <th className="px-4 py-3">Repartidor</th>
            <th className="px-4 py-3">Recorrido</th>
            <th className="px-4 py-3">Estado</th>
            <th className="px-4 py-3">Mercadería</th>
            <th className="px-4 py-3">Creado</th>
            <th className="px-4 py-3 text-right">Acciones</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100">
          {rows.map(row => {
            const id = String(row.id)
            const driverId = runDriverId(row)
            const routeId = runRouteId(row)
            const stock = runStockStatus(stockByRun[id])

            return (
              <tr key={id} className="cursor-pointer transition hover:bg-zinc-50" onClick={() => onOpen(row)}>
                <td className="px-4 py-3 font-mono text-xs text-zinc-600">{id}</td>
                <td className="px-4 py-3 text-zinc-700">{formatDate(row.fecha || row.date)}</td>
                <td className="px-4 py-3 font-medium text-zinc-900">{lookups.employees[driverId] || driverId || "-"}</td>
                <td className="px-4 py-3 text-zinc-700">{lookups.routes[routeId] || routeId || "-"}</td>
                <td className="px-4 py-3">
                  <span className="rounded-full bg-zinc-900 px-2 py-1 text-xs font-medium text-white">
                    {String(row.estado || "-")}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-1 text-xs font-medium ${stock.className}`}>
                    {stock.label}
                  </span>
                </td>
                <td className="px-4 py-3 text-zinc-600">{formatDate(row.created_at || row.createdAt)}</td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-2">
                    {canWrite ? (
                      <button
                        type="button"
                        className="rounded-xl border border-zinc-200 p-2 hover:bg-zinc-100"
                        onClick={event => {
                          event.stopPropagation()
                          onEdit(row)
                        }}
                        aria-label="Editar"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                    ) : null}

                    {canDelete ? (
                      <button
                        type="button"
                        className="rounded-xl bg-red-600 p-2 text-white hover:bg-red-700"
                        onClick={event => {
                          event.stopPropagation()
                          onDelete(row)
                        }}
                        aria-label="Eliminar"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    ) : null}
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export default function CrudTableView({
  tableName,
  title,
  subtitle,
  embedded = false
}: {
  tableName: string
  title?: string
  subtitle?: string
  embedded?: boolean
}) {
  const { session, can } = useAuth()
  const [meta, setMeta] = useState<TableMeta | null>(null)
  const [rows, setRows] = useState<RowData[]>([])
  const [q, setQ] = useState("")
  const [includeInactive, setIncludeInactive] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editRow, setEditRow] = useState<RowData | null>(null)
  const [creating, setCreating] = useState(false)
  const [selectedRoute, setSelectedRoute] = useState<RowData | null>(null)
  const [selectedRun, setSelectedRun] = useState<RowData | null>(null)
  const [stockByRun, setStockByRun] = useState<Record<string, RunStockSummary>>({})
  const [runLookups, setRunLookups] = useState<RunLookups>({ employees: {}, routes: {} })

  const canWrite = can("admin.crud.write", `${tableName}.write`)
  const canDelete = can("admin.crud.delete", `${tableName}.delete`)
  const isRoutesTable = tableName === "delivery_routes"
  const isRunsTable = tableName === "delivery_runs"

  const load = useCallback(async () => {
    if (!session) return

    setLoading(true)
    setError(null)

    try {
      const tablesPayload = await apiGet(session, "/api/admin/crud/tables")
      const metas = unwrapData<TableMeta[]>(tablesPayload) || []
      const found = metas.find(t => t.table === tableName)

      if (!found) throw new Error(`La tabla ${tableName} no está habilitada en /api/admin/crud/tables`)

      setMeta(found)

      const query = buildQuery({
        q,
        include_inactive: includeInactive,
        limit: 200,
        order_by: found.defaultOrderBy || undefined
      })

      const rowsPayload = await apiGet(session, `/api/admin/crud/${tableName}${query}`)
      const loadedRows = unwrapData<RowData[]>(rowsPayload) || []
      setRows(loadedRows)

      if (tableName === "delivery_runs") {
  try {
    const [stockPayload, employeesPayload, routesPayload] = await Promise.all([
      apiGet(session, "/api/admin/crud/delivery_run_stock?limit=1000"),
      apiGet(session, "/api/admin/crud/employees?limit=1000"),
      apiGet(session, "/api/admin/crud/delivery_routes?limit=1000")
    ])

    const stockRows = unwrapData<RowData[]>(stockPayload) || []
    const employees = unwrapData<RowData[]>(employeesPayload) || []
    const routes = unwrapData<RowData[]>(routesPayload) || []

    const nextStock: Record<string, RunStockSummary> = {}

    for (const stock of stockRows) {
      const runId = String(stock.delivery_run_id || stock.deliveryRunId || "")
      if (!runId) continue

      const cantidad = Number(stock.cantidad_cargada || stock.cantidadCargada || 0)
      if (!nextStock[runId]) nextStock[runId] = { count: 0, total: 0 }
      nextStock[runId].count += 1
      nextStock[runId].total += Number.isFinite(cantidad) ? cantidad : 0
    }

    setStockByRun(nextStock)
    setRunLookups({
      employees: Object.fromEntries(employees.map(employee => [String(employee.id), rowLabel(employee)])),
      routes: Object.fromEntries(routes.map(route => [String(route.id), rowLabel(route)]))
    })
  } catch (lookupError) {
    console.warn("No se pudieron cargar datos extra de repartos", lookupError)
    setStockByRun({})
    setRunLookups({ employees: {}, routes: {} })
  }
}
    } catch (exc: any) {
      setError(exc?.message || "No se pudo cargar la tabla")
    } finally {
      setLoading(false)
    }
  }, [session, tableName, q, includeInactive])

  useEffect(() => {
    load()
  }, [load])

  async function createRow(payload: RowData) {
    if (!session) return
    await apiPost(session, `/api/admin/crud/${tableName}`, payload)
    setCreating(false)
    await load()
  }

  async function updateRow(payload: RowData) {
    if (!session || !editRow?.id) return
    await apiPatch(session, `/api/admin/crud/${tableName}/${encodeURIComponent(String(editRow.id))}`, payload)
    setEditRow(null)
    await load()
  }

  async function deleteRow(row: RowData) {
    if (!session || !row.id) return

    const label = row.nombre || row.email || row.id
    if (!window.confirm(`¿Eliminar o desactivar ${label}?`)) return

    await apiDelete(session, `/api/admin/crud/${tableName}/${encodeURIComponent(String(row.id))}`)
    await load()
  }

  function exportRows() {
    downloadCsv(`${tableName}_${new Date().toISOString().slice(0, 10)}.csv`, rows)
  }

  const body = useMemo(() => {
    if (loading) return <LoadingBlock />
    if (error) return <ErrorBlock error={error} onRetry={load} />
    if (!meta) return <EmptyBlock label="No se encontró configuración de tabla." />
    if (rows.length === 0) return <EmptyBlock label="No hay registros para mostrar." />

    if (isRoutesTable) {
      return (
        <RoutesTable
          rows={rows}
          onOpen={setSelectedRoute}
          onEdit={setEditRow}
          onDelete={deleteRow}
          canWrite={canWrite}
          canDelete={canDelete}
        />
      )
    }

    if (isRunsTable) {
      return (
        <RunsTable
          rows={rows}
          stockByRun={stockByRun}
          lookups={runLookups}
          onOpen={setSelectedRun}
          onEdit={setEditRow}
          onDelete={deleteRow}
          canWrite={canWrite}
          canDelete={canDelete}
        />
      )
    }

    return (
      <CrudDataTable
        meta={meta}
        rows={rows}
        onEdit={setEditRow}
        onDelete={deleteRow}
        canWrite={canWrite}
        canDelete={canDelete}
      />
    )
  }, [loading, error, meta, rows, load, canWrite, canDelete, isRoutesTable, isRunsTable, stockByRun, runLookups])

  const content = (
    <>
      <Card>
        <CardHeader
          title={title || meta?.label || tableName}
          subtitle={
            subtitle ||
            (isRoutesTable
              ? "Seleccioná una fila para administrar los clientes del recorrido."
              : isRunsTable
                ? "Seleccioná una fila para asignar la mercadería que sale con el repartidor."
                : `Tabla: ${tableName}. Datos reales desde backend.`)
          }
          right={
            <div className="flex flex-wrap justify-end gap-2">
              <div className="relative w-full sm:w-[260px]">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
                <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar..." className="pl-9" />
              </div>

              {meta?.softDeleteColumn ? (
                <Button variant={includeInactive ? "primary" : "secondary"} onClick={() => setIncludeInactive(v => !v)}>
                  Inactivos
                </Button>
              ) : null}

              <Button variant="secondary" onClick={load}>
                <RefreshCw className="mr-2 h-4 w-4" /> Actualizar
              </Button>

              <Button variant="secondary" onClick={exportRows}>
                <Download className="mr-2 h-4 w-4" /> CSV
              </Button>

              {meta && !meta.readOnly && canWrite ? (
                <Button onClick={() => setCreating(true)}>
                  <Plus className="mr-2 h-4 w-4" /> Nuevo
                </Button>
              ) : null}
            </div>
          }
        />
        <CardBody className="p-0">{body}</CardBody>
      </Card>

      <Modal open={creating} onClose={() => setCreating(false)} title={`Nuevo registro · ${meta?.label || tableName}`}>
        {meta ? (
          <CrudForm
            mode="create"
            fields={meta.allowedCreate}
            onSubmit={createRow}
            onCancel={() => setCreating(false)}
            submitLabel="Crear"
          />
        ) : null}
      </Modal>

      <Modal open={!!editRow} onClose={() => setEditRow(null)} title={`Editar · ${meta?.label || tableName}`}>
        {meta && editRow ? (
          <CrudForm
            mode="edit"
            fields={meta.allowedPatch}
            initial={editRow}
            onSubmit={updateRow}
            onCancel={() => setEditRow(null)}
            submitLabel="Guardar cambios"
          />
        ) : null}
      </Modal>

      {isRoutesTable ? (
        <RouteCustomersModal
          open={!!selectedRoute}
          route={selectedRoute}
          session={session}
          onClose={() => setSelectedRoute(null)}
          onChanged={load}
        />
      ) : null}

      {isRunsTable ? (
        <RunStockModal
          open={!!selectedRun}
          run={selectedRun}
          session={session}
          onClose={() => setSelectedRun(null)}
          onChanged={load}
        />
      ) : null}
    </>
  )

  if (embedded) return content
  return <div className="space-y-6">{content}</div>
}