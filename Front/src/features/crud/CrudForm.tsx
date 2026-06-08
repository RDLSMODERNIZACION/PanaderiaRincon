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
    try { return JSON.parse(value) } catch { return value }
  }
  if (isNumericField(field)) {
    const n = Number(value)
    return Number.isFinite(n) ? n : value
  }
  return value
}

export default function CrudForm({ fields, initial, mode, onSubmit, onCancel, submitLabel }: Props) {
  const { session } = useAuth()
  const [values, setValues] = useState<RowData>({})
  const [lookups, setLookups] = useState<Record<string, LookupOption[]>>({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const visibleFields = useMemo(() => {
    if (mode === "create") return fields
    return fields.filter(field => field !== "id")
  }, [fields, mode])

  useEffect(() => {
    const next: RowData = {}
    for (const field of visibleFields) {
      const raw = initial ? getByAnyKey(initial, field) : undefined
      if (/fecha$|_date$|fecha_desde|fecha_hasta/i.test(field)) next[field] = toInputDate(raw)
      else if (isDateField(field) && raw) next[field] = toInputDateTime(raw)
      else if (/config|datos_/i.test(field) && raw && typeof raw === "object") next[field] = JSON.stringify(raw, null, 2)
      else next[field] = raw ?? ""
    }
    setValues(next)
  }, [initial, visibleFields])

  useEffect(() => {
    async function loadLookups() {
      if (!session) return
      const needed = Array.from(new Set(visibleFields.map(f => LOOKUP_TABLE_BY_FIELD[f]).filter(Boolean)))
      const next: Record<string, LookupOption[]> = {}
      await Promise.all(needed.map(async table => {
        try {
          const payload = await apiGet(session, `/api/admin/crud/${table}?limit=500`)
          const rows = unwrapData<RowData[]>(payload) || []
          next[table] = rows.map(row => ({
            id: String(row.id),
            label: String(row.nombre || row.name || row.email || row.clave || row.id)
          }))
        } catch {
          next[table] = []
        }
      }))
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
          const lookupTable = LOOKUP_TABLE_BY_FIELD[field]
          const lookupOptions = lookupTable ? lookups[lookupTable] || [] : []
          const enumOptions = ENUM_OPTIONS[field]
          const value = values[field] ?? ""
          const label = fieldLabel(field)

          if (lookupTable && lookupOptions.length > 0) {
            return (
              <label key={field} className="block">
                <span className="mb-1 block text-xs font-medium text-zinc-600">{label}</span>
                <Select value={String(value)} onChange={e => setValues(v => ({ ...v, [field]: e.target.value }))}>
                  <option value="">Seleccionar…</option>
                  {lookupOptions.map(opt => <option key={opt.id} value={opt.id}>{opt.label}</option>)}
                </Select>
              </label>
            )
          }

          if (enumOptions) {
            return (
              <label key={field} className="block">
                <span className="mb-1 block text-xs font-medium text-zinc-600">{label}</span>
                <Select value={String(value)} onChange={e => setValues(v => ({ ...v, [field]: e.target.value }))}>
                  <option value="">Seleccionar…</option>
                  {enumOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
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

          const type = field === "email" ? "email" : isDateField(field) ? (/(fecha$|_date$|fecha_desde|fecha_hasta)/i.test(field) ? "date" : "datetime-local") : isNumericField(field) ? "number" : "text"
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
        <Button disabled={saving}>{saving ? "Guardando…" : submitLabel || "Guardar"}</Button>
      </div>
    </form>
  )
}
