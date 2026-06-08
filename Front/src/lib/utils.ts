import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrencyARS(value: unknown) {
  const n = typeof value === "number" ? value : Number(value ?? 0)
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0
  }).format(Number.isFinite(n) ? n : 0)
}

export function formatNumber(value: unknown, max = 2) {
  const n = typeof value === "number" ? value : Number(value ?? 0)
  return new Intl.NumberFormat("es-AR", { maximumFractionDigits: max }).format(Number.isFinite(n) ? n : 0)
}

export function formatPercent(value: unknown) {
  const n = typeof value === "number" ? value : Number(value ?? 0)
  return new Intl.NumberFormat("es-AR", { style: "percent", maximumFractionDigits: 1 }).format(Number.isFinite(n) ? n : 0)
}

export function formatDateShort(value?: unknown) {
  if (!value) return "—"
  const d = new Date(String(value))
  if (Number.isNaN(d.getTime())) return String(value)
  return new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "2-digit", year: "2-digit" }).format(d)
}

export function formatDateTime(value?: unknown) {
  if (!value) return "—"
  const d = new Date(String(value))
  if (Number.isNaN(d.getTime())) return String(value)
  return new Intl.DateTimeFormat("es-AR", { dateStyle: "short", timeStyle: "short" }).format(d)
}

export function humanizeKey(key: string) {
  return key
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, l => l.toUpperCase())
}

export function toCamel(value: string) {
  return value.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase())
}

export function toSnake(value: string) {
  return value.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`)
}

export function getByAnyKey(row: Record<string, any>, key: string) {
  return row[key] ?? row[toCamel(key)] ?? row[toSnake(key)]
}

export function cleanApiBaseUrl(value: string) {
  return String(value || "").trim().replace(/\/+$/, "")
}

export function isMoneyField(field: string) {
  return /precio|costo|total|amount|debe|haber|efectivo|venta|cobrado|deuda|descuento|saldo|valor/i.test(field)
}

export function isNumericField(field: string) {
  return isMoneyField(field) || /cantidad|stock|kg|kwh|horas|merma|planificado|producido|latitud|longitud|orden|rinde|diferencia|min|max/i.test(field)
}

export function isDateField(field: string) {
  return /fecha|date|_at$|At$|started_at|closed_at|confirmed_at|locked_at|arrived_at|updated_at|created_at/i.test(field)
}

export function truncate(value: unknown, len = 60) {
  const s = value == null ? "" : String(value)
  return s.length > len ? `${s.slice(0, len)}…` : s
}
