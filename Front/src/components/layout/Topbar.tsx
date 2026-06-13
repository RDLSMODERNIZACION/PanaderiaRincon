"use client"

import { LogOut, Menu, RefreshCw } from "lucide-react"
import { useState } from "react"
import SidebarMobile from "./SidebarMobile"
import Button from "@/components/ui/Button"
import Badge from "@/components/ui/Badge"
import { useAuth } from "@/features/auth/AuthProvider"

export default function Topbar() {
  const [open, setOpen] = useState(false)
  const { user, session, logout, refreshMe } = useAuth()

  return (
    <header className="sticky top-0 z-30 border-b border-zinc-200 bg-white/90 backdrop-blur">
      <div className="flex items-center gap-2 px-3 py-2.5 md:gap-3 md:px-6 md:py-3">
        <button
          className="inline-flex h-11 items-center gap-2 rounded-2xl border border-zinc-200 px-3 text-sm font-medium hover:bg-zinc-100 md:hidden"
          onClick={() => setOpen(true)}
          aria-label="Abrir menú"
          type="button"
        >
          <Menu className="h-5 w-5" />
          Menú
        </button>

        <div className="min-w-0 flex-1 md:flex-none">
          <div className="truncate text-sm font-semibold text-zinc-900">Sistema de gestión</div>
          <div className="hidden truncate text-xs text-zinc-500 sm:block">{session?.apiBaseUrl}</div>
        </div>

        <div className="ml-auto flex items-center gap-1.5 md:gap-2">
          <Badge variant="muted" className="hidden sm:inline-flex">
            {user?.roleName || "Desarrollo"}
          </Badge>

          <Button variant="secondary" size="sm" onClick={refreshMe} className="h-10 w-10 px-0" title="Actualizar permisos">
            <RefreshCw className="h-4 w-4" />
          </Button>

          <Button variant="secondary" size="sm" onClick={logout} className="h-10 px-3">
            <LogOut className="h-4 w-4 md:mr-2" />
            <span className="hidden md:inline">Salir</span>
          </Button>
        </div>
      </div>

      <SidebarMobile open={open} onClose={() => setOpen(false)} />
    </header>
  )
}
