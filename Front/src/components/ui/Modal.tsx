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

  return (
    <div className={cn("fixed inset-0 z-50", open ? "" : "pointer-events-none")}>
      <div
        className={cn("absolute inset-0 bg-black/30 transition-opacity", open ? "opacity-100" : "opacity-0")}
        onClick={onClose}
      />
      <div className="absolute inset-0 grid place-items-center p-4">
        <div
          className={cn(
            "w-full max-w-lg rounded-2xl border border-zinc-200 bg-white shadow-soft transition-transform",
            open ? "scale-100 opacity-100" : "scale-95 opacity-0"
          )}
        >
          <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-4">
            <div className="text-sm font-semibold">{title}</div>
            <button className="rounded-xl p-2 hover:bg-zinc-100" onClick={onClose} aria-label="Cerrar">
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="px-5 py-4">{children}</div>
        </div>
      </div>
    </div>
  )
}
