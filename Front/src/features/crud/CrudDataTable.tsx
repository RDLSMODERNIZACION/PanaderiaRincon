"use client"

import Badge from "@/components/ui/Badge"
import Button from "@/components/ui/Button"
import { Table, TD, TH, THead, TR } from "@/components/ui/Table"
import { fieldLabel } from "@/features/crud/fieldConfig"
import type { RowData, TableMeta } from "@/features/crud/types"
import { formatCurrencyARS, formatDateTime, formatNumber, getByAnyKey, isDateField, isMoneyField, isNumericField, truncate } from "@/lib/utils"
import { Pencil, Trash2 } from "lucide-react"

function formatCell(field: string, value: any) {
  if (value === null || value === undefined || value === "") return <span className="text-zinc-400">—</span>
  if (typeof value === "boolean") return value ? <Badge variant="success">Sí</Badge> : <Badge variant="muted">No</Badge>
  if (field === "activo") return value ? <Badge variant="success">Activo</Badge> : <Badge variant="danger">Inactivo</Badge>
  if (field === "status") return value === "active" ? <Badge variant="success">Activo</Badge> : <Badge variant="danger">{String(value)}</Badge>
  if (field === "estado") return <Badge variant={String(value).includes("cerr") ? "muted" : String(value).includes("pend") ? "warning" : "default"}>{String(value)}</Badge>
  if (isDateField(field)) return formatDateTime(value)
  if (isMoneyField(field)) return formatCurrencyARS(value)
  if (isNumericField(field)) return formatNumber(value, 3)
  if (typeof value === "object") return <code className="text-xs">{truncate(JSON.stringify(value), 42)}</code>
  return truncate(value, 72)
}

export default function CrudDataTable({
  meta,
  rows,
  onEdit,
  onDelete,
  canWrite,
  canDelete
}: {
  meta: TableMeta
  rows: RowData[]
  onEdit?: (row: RowData) => void
  onDelete?: (row: RowData) => void
  canWrite?: boolean
  canDelete?: boolean
}) {
  const preferred = ["id", "nombre", "email", "fecha", "customer_id", "product_id", "driver_id", "route_id", "estado", "tipo", "metodo", "amount", "precio", "precio_venta", "cantidad", "total", "debe", "haber", "kg_entrada", "kg_salida", "activo", "status", "created_at"]
  const rowKeys = rows.length > 0 ? Object.keys(rows[0]) : []
  const metaKeys = Array.from(new Set([...meta.allowedPatch, ...meta.allowedCreate, ...rowKeys]))
  const columns = preferred.filter(key => metaKeys.includes(key) || rowKeys.includes(key.replace(/_([a-z])/g, (_, l) => l.toUpperCase()))).slice(0, 9)
  const fallback = rowKeys.filter(k => !columns.includes(k)).slice(0, 8)
  const finalColumns = columns.length > 0 ? columns : fallback

  return (
    <Table>
      <THead>
        <TR>
          {finalColumns.map(col => <TH key={col}>{fieldLabel(col)}</TH>)}
          <TH className="text-right">Acciones</TH>
        </TR>
      </THead>
      <tbody>
        {rows.map(row => (
          <TR key={String(row.id)}>
            {finalColumns.map(col => <TD key={col}>{formatCell(col, getByAnyKey(row, col))}</TD>)}
            <TD className="text-right">
              <div className="inline-flex gap-2">
                {!meta.readOnly && canWrite && onEdit ? (
                  <Button size="sm" variant="secondary" onClick={() => onEdit(row)}><Pencil className="h-4 w-4" /></Button>
                ) : null}
                {!meta.readOnly && canDelete && onDelete ? (
                  <Button size="sm" variant="danger" onClick={() => onDelete(row)}><Trash2 className="h-4 w-4" /></Button>
                ) : null}
              </div>
            </TD>
          </TR>
        ))}
      </tbody>
    </Table>
  )
}
