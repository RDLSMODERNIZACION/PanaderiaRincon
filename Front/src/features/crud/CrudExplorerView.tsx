"use client"

import { useEffect, useState } from "react"
import Select from "@/components/ui/Select"
import { Card, CardBody, CardHeader } from "@/components/ui/Card"
import { ErrorBlock, LoadingBlock } from "@/components/data/AsyncState"
import CrudTableView from "@/features/crud/CrudTableView"
import type { TableMeta } from "@/features/crud/types"
import { useAuth } from "@/features/auth/AuthProvider"
import { apiGet, unwrapData } from "@/lib/api"

export default function CrudExplorerView() {
  const { session } = useAuth()
  const [tables, setTables] = useState<TableMeta[]>([])
  const [selected, setSelected] = useState<string>("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      if (!session) return
      setLoading(true)
      setError(null)
      try {
        const payload = await apiGet(session, "/api/admin/crud/tables")
        const data = unwrapData<TableMeta[]>(payload) || []
        setTables(data)
        setSelected(prev => prev || data.find(t => !t.readOnly)?.table || data[0]?.table || "")
      } catch (exc: any) {
        setError(exc?.message || "No se pudo cargar el catálogo de tablas")
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [session])

  if (loading) return <LoadingBlock />
  if (error) return <ErrorBlock error={error} />

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">CRUD completo</h1>
        <p className="mt-1 text-sm text-zinc-600">Crear, editar, desactivar o borrar cualquier tabla habilitada por el backend.</p>
      </div>

      <Card>
        <CardHeader title="Selector de tabla" subtitle="El backend decide qué tablas y campos se pueden modificar." />
        <CardBody>
          <Select value={selected} onChange={e => setSelected(e.target.value)}>
            {tables.map(t => <option key={t.table} value={t.table}>{t.label} · {t.table}{t.readOnly ? " · solo lectura" : ""}</option>)}
          </Select>
        </CardBody>
      </Card>

      {selected ? <CrudTableView tableName={selected} embedded /> : null}
    </div>
  )
}
