"use client"

import { useEffect, useMemo, useState } from "react"
import Button from "@/components/ui/Button"
import Input from "@/components/ui/Input"
import Select from "@/components/ui/Select"
import { apiGet, unwrapData } from "@/lib/api"
import { getByAnyKey, isDateField, isNumericField, toCamel } from "@/lib/utils"
import { useAuth } from "@/features/auth/AuthProvider"
import { ENUM_OPTIONS, LOOKUP_TABLE_BY_FIELD, fieldLabel, isBooleanField, isTextareaField } from "@/features/crud/fieldConfig"
import type { RowData } from "@/features/crud/types"

type LookupOption = { id: string; label: string }

type Props = {
  fields: string[]
  initial?: RowData | null
  mode: "create" | "edit"
  onSubmit: (payload: RowData) => Promise<void>
  onCancel: () => void
  submitLabel?: string
}

const CREATE_HIDDEN_FIELDS = new Set([
  "id",
  "created_at",
  "updated_at",
  "started_at",
  "closed_at",
  "last_login_at",
  "created_by",
  "updated_by"
])

const CREATE_HIDDEN_FIELDS_CAMEL = new Set([
  "id",
  "createdAt",
  "updatedAt",
  "startedAt",
  "closedAt",
  "lastLoginAt",
  "createdBy",
  "updatedBy"
])

const DRIVER_FIELDS = new Set([
  "driver_id",
  "driverId",
  "repartidor_id",
  "repartidorId"
])

const FIELD_LOOKUP_FALLBACK: Record<string, string> = {
  driver_id: "employees",
  driverId: "employees",
  repartidor_id: "employees",
  repartidorId: "employees",
  employee_id: "employees",
  employeeId: "employees",
  route_id: "delivery_routes",
  routeId: "delivery_routes",
  recorrido_id: "delivery_routes",
  recorridoId: "delivery_routes",
  customer_id: "customers",
  customerId: "customers",
  product_id: "products",
  productId: "products",
  delivery_run_id: "delivery_runs",
  deliveryRunId: "delivery_runs",
  visit_id: "delivery_visits",
  visitId: "delivery_visits"
}

const FIELD_ENUM_FALLBACK: Record<string, string[]> = {
  estado: ["preparado", "en_recorrido", "cerrado", "cancelado"],
  status: ["active", "disabled"],
  tipo: ["venta", "devolucion", "bonificacion", "ajuste"],
  metodo: ["efectivo", "transferencia", "mercado_pago", "qr", "otro"]
}

function todayInputDate() {
  return new Date().toISOString().slice(0, 10)
}

function toInputDateTime(value: unknown) {
  if (!value) return ""
  const d = new Date(String(value))
  if (Number.isNaN(d.getTime())) return String(value)
  return d.toISOString().slice(0, 16)
}

function toInputDate(value: unknown) {
  if (!value) return ""
  const d = new Date(String(value))
  if (Number.isNaN(d.getTime())) return String(value)
  return d.toISOString().slice(0, 10)
}

function cleanValue(field: string, value: string) {
  if (value === "") return undefined
  if (isBooleanField(field)) return value === "true"
  if (field === "id") return value.trim() || undefined

  if (/config|datos_/i.test(field)) {
    try {
      return JSON.parse(value)
    } catch {
      return value
    }
  }

  if (isNumericField(field)) {
    const n = Number(value)
    return Number.isFinite(n) ? n : value
  }

  return value
}

function isCreateHiddenField(field: string) {
  return CREATE_HIDDEN_FIELDS.has(field) || CREATE_HIDDEN_FIELDS_CAMEL.has(field)
}

function isDateOnlyField(field: string) {
  return /fecha$|_date$|fecha_desde|fecha_hasta/i.test(field)
}

function defaultValueForField(field: string, mode: "create" | "edit") {
  if (mode !== "create") return ""

  if (field === "fecha" || field === "date") return todayInputDate()
  if (field === "estado") return "preparado"
  if (field === "status") return "active"

  return ""
}

function lookupTableForField(field: string) {
  return LOOKUP_TABLE_BY_FIELD[field] || FIELD_LOOKUP_FALLBACK[field]
}

function enumOptionsForField(field: string) {
  return ENUM_OPTIONS[field] || FIELD_ENUM_FALLBACK[field]
}

function labelForField(field: string) {
  if (DRIVER_FIELDS.has(field)) return "Repartidor"
  if (field === "route_id" || field === "routeId") return "Recorrido"
  if (field === "fecha") return "Fecha"
  if (field === "estado") return "Estado"
  return fieldLabel(field)
}

function lookupLabel(row: RowData) {
  return String(
    row.nombre ||
      row.name ||
      row.email ||
      row.clave ||
      row.descripcion ||
      row.direccion ||
      row.id
  )
}

function shouldKeepLookupRow(field: string, row: RowData) {
  if (!DRIVER_FIELDS.has(field)) return true

  const rol = String(row.rol || row.role || row.employee_rol || "").toLowerCase()
  return rol === "repartidor"
}

export default function CrudForm({ fields, initial, mode, onSubmit, onCancel, submitLabel }: Props) {
  const { session } = useAuth()
  const [values, setValues] = useState<RowData>({})
  const [lookups, setLookups] = useState<Record<string, LookupOption[]>>({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const visibleFields = useMemo(() => {
    if (mode === "create") return fields.filter(field => !isCreateHiddenField(field))
    return fields.filter(field => field !== "id")
  }, [fields, mode])

  useEffect(() => {
    const next: RowData = {}

    for (const field of visibleFields) {
      const raw = initial ? getByAnyKey(initial, field) : undefined

      if (raw !== undefined && raw !== null) {
        if (isDateOnlyField(field)) next[field] = toInputDate(raw)
        else if (isDateField(field)) next[field] = toInputDateTime(raw)
        else if (/config|datos_/i.test(field) && typeof raw === "object") next[field] = JSON.stringify(raw, null, 2)
        else next[field] = raw
      } else {
        next[field] = defaultValueForField(field, mode)
      }
    }

    setValues(next)
  }, [initial, visibleFields, mode])

  useEffect(() => {
    async function loadLookups() {
      if (!session) return

      const lookupRequests = visibleFields
        .map(field => ({ field, table: lookupTableForField(field) }))
        .filter(item => Boolean(item.table))

      const next: Record<string, LookupOption[]> = {}

      await Promise.all(
        lookupRequests.map(async ({ field, table }) => {
          if (!table) return

          const key = `${field}:${table}`

          try {
            const payload = await apiGet(session, `/api/admin/crud/${table}?limit=500`)
            const rows = unwrapData<RowData[]>(payload) || []

            next[key] = rows
              .filter(row => shouldKeepLookupRow(field, row))
              .map(row => ({
                id: String(row.id),
                label: lookupLabel(row)
              }))
          } catch {
            next[key] = []
          }
        })
      )

      setLookups(next)
    }

    loadLookups()
  }, [session, visibleFields])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSaving(true)

    try {
      const payload: RowData = {}

      for (const field of visibleFields) {
        const cleaned = cleanValue(field, String(values[field] ?? ""))
        if (cleaned !== undefined) payload[field] = cleaned
      }

      await onSubmit(payload)
    } catch (exc: any) {
      setError(exc?.message || "No se pudo guardar")
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {visibleFields.map(field => {
          const lookupTable = lookupTableForField(field)
          const lookupKey = lookupTable ? `${field}:${lookupTable}` : ""
          const lookupOptions = lookupKey ? lookups[lookupKey] || [] : []
          const enumOptions = enumOptionsForField(field)
          const value = values[field] ?? ""
          const label = labelForField(field)

          if (lookupTable) {
            return (
              <label key={field} className="block">
                <span className="mb-1 block text-xs font-medium text-zinc-600">{label}</span>
                <Select value={String(value)} onChange={e => setValues(v => ({ ...v, [field]: e.target.value }))}>
                  <option value="">Seleccionar...</option>
                  {lookupOptions.map(opt => (
                    <option key={opt.id} value={opt.id}>{opt.label}</option>
                  ))}
                </Select>
              </label>
            )
          }

          if (enumOptions) {
            return (
              <label key={field} className="block">
                <span className="mb-1 block text-xs font-medium text-zinc-600">{label}</span>
                <Select value={String(value)} onChange={e => setValues(v => ({ ...v, [field]: e.target.value }))}>
                  <option value="">Seleccionar...</option>
                  {enumOptions.map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </Select>
              </label>
            )
          }

          if (isTextareaField(field)) {
            return (
              <label key={field} className="block md:col-span-2">
                <span className="mb-1 block text-xs font-medium text-zinc-600">{label}</span>
                <textarea
                  value={String(value)}
                  onChange={e => setValues(v => ({ ...v, [field]: e.target.value }))}
                  className="min-h-[92px] w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-300"
                />
              </label>
            )
          }

          const type =
            field === "email"
              ? "email"
              : isDateField(field)
                ? isDateOnlyField(field) ? "date" : "datetime-local"
                : isNumericField(field)
                  ? "number"
                  : "text"

          return (
            <label key={field} className="block">
              <span className="mb-1 block text-xs font-medium text-zinc-600">{label}</span>
              <Input
                type={type}
                step={type === "number" ? "any" : undefined}
                value={String(value)}
                onChange={e => setValues(v => ({ ...v, [field]: e.target.value }))}
                placeholder={toCamel(field)}
              />
            </label>
          )
        })}
      </div>

      {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}

      <div className="flex justify-end gap-2 border-t border-zinc-100 pt-4">
        <Button type="button" variant="secondary" onClick={onCancel}>Cancelar</Button>
        <Button disabled={saving}>{saving ? "Guardando..." : submitLabel || "Guardar"}</Button>
      </div>
    </form>
  )
}