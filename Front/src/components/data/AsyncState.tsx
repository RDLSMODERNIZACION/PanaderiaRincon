"use client"

import { Loader2 } from "lucide-react"
import Button from "@/components/ui/Button"

export function LoadingBlock({ label = "Cargando datos…" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center rounded-2xl border border-zinc-200 bg-white p-8 text-sm text-zinc-600">
      <Loader2 className="mr-2 h-5 w-5 animate-spin" /> {label}
    </div>
  )
}

export function ErrorBlock({ error, onRetry }: { error: string; onRetry?: () => void }) {
  return (
    <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
      <div className="font-semibold">No se pudo cargar</div>
      <div className="mt-1 whitespace-pre-wrap">{error}</div>
      {onRetry ? <Button className="mt-3" variant="secondary" size="sm" onClick={onRetry}>Reintentar</Button> : null}
    </div>
  )
}

export function EmptyBlock({ label = "No hay registros cargados." }: { label?: string }) {
  return <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-6 text-sm text-zinc-600">{label}</div>
}
