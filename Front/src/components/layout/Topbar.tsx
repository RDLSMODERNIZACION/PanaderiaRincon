"use client"

import { LogOut, RefreshCw } from "lucide-react"
import { usePathname, useRouter } from "next/navigation"
import Button from "@/components/ui/Button"
import Badge from "@/components/ui/Badge"
import { useAuth } from "@/features/auth/AuthProvider"

export default function Topbar() {
  const router = useRouter()
  const pathname = usePathname()
  const { user, session, logout, refreshMe } = useAuth()

  function handleLogout() {
    logout()
    const next = pathname && pathname !== "/login" ? pathname : "/"
    router.replace(`/login?next=${encodeURIComponent(next)}`)
  }

  return (
    <header className="sticky top-0 z-30 border-b border-zinc-200 bg-white/95 backdrop-blur">
      <div className="flex min-h-[56px] items-center gap-2 px-3 py-2 md:min-h-[64px] md:gap-3 md:px-6 md:py-3">
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-zinc-900 md:text-base">Sistema de gestión</div>
          <div className="hidden truncate text-xs text-zinc-500 sm:block">{session?.apiBaseUrl}</div>
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-1.5 md:gap-2">
          <Badge variant="muted" className="hidden sm:inline-flex">
            {user?.roleName || "Desarrollo"}
          </Badge>

          <Button
            variant="secondary"
            size="sm"
            onClick={refreshMe}
            className="h-10 w-10 px-0"
            title="Actualizar permisos"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>

          <Button variant="secondary" size="sm" onClick={handleLogout} className="h-10 px-3">
            <LogOut className="h-4 w-4 md:mr-2" />
            <span className="hidden md:inline">Salir</span>
          </Button>
        </div>
      </div>
    </header>
  )
}
