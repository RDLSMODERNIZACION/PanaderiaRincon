"use client"

import { cn } from "@/lib/utils"
import { X } from "lucide-react"
import { useEffect } from "react"

export default function Modal({
  open,
  onClose,
  title,
  children
}: {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose()
    }
    if (open) window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, onClose])

  useEffect(() => {
    if (!open) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"

    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [open])

  return (
    <div className={cn("fixed inset-0 z-50", open ? "" : "pointer-events-none")}>
      <div
        className={cn("absolute inset-0 bg-black/30 transition-opacity", open ? "opacity-100" : "opacity-0")}
        onClick={onClose}
      />

      <div className="absolute inset-0 grid place-items-end p-0 sm:place-items-center sm:p-4">
        <div
          className={cn(
            "flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-3xl border border-zinc-200 bg-white shadow-soft transition-transform sm:max-w-lg sm:rounded-2xl",
            open ? "translate-y-0 scale-100 opacity-100" : "translate-y-6 scale-95 opacity-0"
          )}
        >
          <div className="flex shrink-0 items-center justify-between border-b border-zinc-100 px-4 py-3 sm:px-5 sm:py-4">
            <div className="min-w-0 pr-3 text-sm font-semibold">{title}</div>
            <button
              className="grid h-10 w-10 shrink-0 place-items-center rounded-xl hover:bg-zinc-100 active:bg-zinc-100"
              onClick={onClose}
              aria-label="Cerrar"
              type="button"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-5">{children}</div>
        </div>
      </div>
    </div>
  )
}
