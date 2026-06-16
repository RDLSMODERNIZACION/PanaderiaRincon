"use client"

import { useEffect } from "react"
import { usePathname, useRouter } from "next/navigation"
import { useAuth } from "@/features/auth/AuthProvider"
import Sidebar from "@/components/layout/Sidebar"
import Topbar from "@/components/layout/Topbar"
import MobileBottomNav from "@/components/layout/MobileBottomNav"
import PendingRoleView from "@/features/auth/PendingRoleView"
import { LoadingBlock } from "@/components/data/AsyncState"

function isConsultaUser(user: any) {
  const roleId = user?.roleId || user?.role_id
  const roleName = String(user?.roleName || user?.role_name || "").toLowerCase()
  const permissions = user?.permissions || []

  if (roleId === "role_consulta") return true
  if (roleName === "consulta") return true

  return permissions.length === 0 && !user?.isApiKey && !user?.is_api_key && !user?.isDevelopmentOpen && !user?.is_development_open
}

function loginUrl(pathname: string | null) {
  const next = pathname && pathname !== "/login" ? pathname : "/"
  return `/login?next=${encodeURIComponent(next)}`
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const { session, user, loading } = useAuth()

  useEffect(() => {
    if (!loading && (!session || !user)) {
      router.replace(loginUrl(pathname))
    }
  }, [loading, session, user, pathname, router])

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-zinc-50 p-4">
        <LoadingBlock label="Verificando sesión…" />
      </div>
    )
  }

  if (!session || !user) {
    return (
      <div className="grid min-h-screen place-items-center bg-zinc-50 p-4">
        <LoadingBlock label="Redirigiendo al login…" />
      </div>
    )
  }

  if (isConsultaUser(user)) {
    return <PendingRoleView />
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="flex">
        <Sidebar />

        <div className="min-w-0 flex-1">
          <Topbar />

          <main className="px-3 py-3 pb-28 md:px-6 md:py-5 md:pb-5 lg:px-8">
            {children}
          </main>
        </div>
      </div>

      <MobileBottomNav />
    </div>
  )
}
