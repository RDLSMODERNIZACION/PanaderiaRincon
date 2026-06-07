import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrencyARS(value: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0
  }).format(value)
}

export function formatNumber(value: number) {
  return new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 }).format(value)
}

export function formatPercent(value: number) {
  return new Intl.NumberFormat("es-AR", { style: "percent", maximumFractionDigits: 1 }).format(value)
}

export function formatDateShort(iso: string) {
  const d = new Date(iso)
  return new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "2-digit" }).format(d)
}

export function formatDateTime(iso: string) {
  const d = new Date(iso)
  return new Intl.DateTimeFormat("es-AR", { dateStyle: "short", timeStyle: "short" }).format(d)
}

export function startOfDay(d: Date) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

export function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}
