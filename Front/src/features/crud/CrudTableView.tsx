"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Download, Plus, RefreshCw, Search } from "lucide-react"
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
import { downloadCsv } from "@/lib/csv"

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

  const canWrite = can("admin.crud.write", `${tableName}.write`)
  const canDelete = can("admin.crud.delete", `${tableName}.delete`)

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

      const query = buildQuery({ q, include_inactive: includeInactive, limit: 200, order_by: found.defaultOrderBy || undefined })
      const rowsPayload = await apiGet(session, `/api/admin/crud/${tableName}${query}`)
      setRows(unwrapData<RowData[]>(rowsPayload) || [])
    } catch (exc: any) {
      setError(exc?.message || "No se pudo cargar la tabla")
    } finally {
      setLoading(false)
    }
  }, [session, tableName, q, includeInactive])

  useEffect(() => { load() }, [load])

  async function createRow(payload: RowData) {
    if (!session) return
    await apiPost(session, `/api/admin/crud/${tableName}`, payload)
    setCreating(false)
    await load()
  }

  async function updateRow(payload: RowData) {
    if (!session || !editRow?.id) return
    await apiPatch(session, `/api/admin/crud/${tableName}/${editRow.id}`, payload)
    setEditRow(null)
    await load()
  }

  async function deleteRow(row: RowData) {
    if (!session || !row.id) return
    const label = row.nombre || row.email || row.id
    if (!window.confirm(`¿Eliminar o desactivar ${label}?`)) return
    await apiDelete(session, `/api/admin/crud/${tableName}/${row.id}`)
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
    return <CrudDataTable meta={meta} rows={rows} onEdit={setEditRow} onDelete={deleteRow} canWrite={canWrite} canDelete={canDelete} />
  }, [loading, error, meta, rows, load, canWrite, canDelete])

  const content = (
    <>
      <Card>
        <CardHeader
          title={title || meta?.label || tableName}
          subtitle={subtitle || `Tabla: ${tableName}. Datos reales desde backend.`}
          right={
            <div className="flex flex-wrap justify-end gap-2">
              <div className="relative w-full sm:w-[260px]">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
                <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar…" className="pl-9" />
              </div>
              {meta?.softDeleteColumn ? (
                <Button variant={includeInactive ? "primary" : "secondary"} onClick={() => setIncludeInactive(v => !v)}>Inactivos</Button>
              ) : null}
              <Button variant="secondary" onClick={load}><RefreshCw className="mr-2 h-4 w-4" />Actualizar</Button>
              <Button variant="secondary" onClick={exportRows}><Download className="mr-2 h-4 w-4" />CSV</Button>
              {meta && !meta.readOnly && canWrite ? <Button onClick={() => setCreating(true)}><Plus className="mr-2 h-4 w-4" />Nuevo</Button> : null}
            </div>
          }
        />
        <CardBody className="p-0">{body}</CardBody>
      </Card>

      <Modal open={creating} onClose={() => setCreating(false)} title={`Nuevo registro · ${meta?.label || tableName}`}>
        {meta ? <CrudForm mode="create" fields={meta.allowedCreate} onSubmit={createRow} onCancel={() => setCreating(false)} submitLabel="Crear" /> : null}
      </Modal>

      <Modal open={!!editRow} onClose={() => setEditRow(null)} title={`Editar · ${meta?.label || tableName}`}>
        {meta && editRow ? <CrudForm mode="edit" fields={meta.allowedPatch} initial={editRow} onSubmit={updateRow} onCancel={() => setEditRow(null)} submitLabel="Guardar cambios" /> : null}
      </Modal>
    </>
  )

  if (embedded) return content
  return <div className="space-y-6">{content}</div>
}
