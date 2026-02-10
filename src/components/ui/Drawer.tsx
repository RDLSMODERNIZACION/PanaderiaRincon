"use client"

import { cn } from "@/lib/utils"
import { X } from "lucide-react"
import { useEffect } from "react"

export default function Drawer({
  open,
  onClose,
  title,
  children,
  widthClass = "max-w-xl"
}: {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  widthClass?: string
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
        className={cn(
          "absolute inset-0 bg-black/30 transition-opacity",
          open ? "opacity-100" : "opacity-0"
        )}
        onClick={onClose}
      />
      <div
        className={cn(
          "absolute right-0 top-0 h-full w-full bg-white shadow-soft transition-transform",
          widthClass,
          open ? "translate-x-0" : "translate-x-full"
        )}
      >
        <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-4">
          <div className="text-sm font-semibold">{title}</div>
          <button
            className="rounded-xl p-2 hover:bg-zinc-100"
            onClick={onClose}
            aria-label="Cerrar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="h-[calc(100%-57px)] overflow-auto px-5 py-4">{children}</div>
      </div>
    </div>
  )
}
