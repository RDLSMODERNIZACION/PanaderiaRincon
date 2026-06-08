"use client"

import { Bell, LogOut, Menu, RefreshCw } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"
import SidebarMobile from "./SidebarMobile"
import Button from "@/components/ui/Button"
import Badge from "@/components/ui/Badge"
import { useAuth } from "@/features/auth/AuthProvider"

export default function Topbar() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const { user, session, logout, refreshMe } = useAuth()

  function handleLogout() {
    logout()
    router.replace("/login")
    router.refresh()
  }

  return (
    <header className="sticky top-0 z-30 border-b border-zinc-200 bg-white/80 backdrop-blur">
      <div className="flex items-center gap-3 px-4 py-3 md:px-6">
        <button
          className="rounded-xl p-2 hover:bg-zinc-100 md:hidden"
          onClick={() => setOpen(true)}
          aria-label="Abrir menú"
          type="button"
        >
          <Menu className="h-5 w-5" />
        </button>

        <div className="min-w-0">
          <div className="truncate text-sm font-semibold">Sistema de gestión</div>
          <div className="truncate text-xs text-zinc-500">{session?.apiBaseUrl}</div>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <Badge variant="muted">
            {user?.roleName || user?.role_name || "Sin rol"}
          </Badge>

          <Button variant="secondary" size="sm" onClick={refreshMe}>
            <RefreshCw className="h-4 w-4" />
          </Button>

          <button className="rounded-xl p-2 hover:bg-zinc-100" aria-label="Notificaciones" type="button">
            <Bell className="h-5 w-5 text-zinc-700" />
          </button>

          <Button variant="secondary" size="sm" onClick={handleLogout}>
            <LogOut className="mr-2 h-4 w-4" />
            Salir
          </Button>
        </div>
      </div>

      <SidebarMobile open={open} onClose={() => setOpen(false)} />
    </header>
  )
}