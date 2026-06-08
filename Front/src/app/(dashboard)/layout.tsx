"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/features/auth/AuthProvider"
import Sidebar from "@/components/layout/Sidebar"
import Topbar from "@/components/layout/Topbar"
import PendingRoleView from "@/features/auth/PendingRoleView"
import { LoadingBlock } from "@/components/data/AsyncState"

function isConsultaUser(user: any) {
  const roleId = user?.roleId || user?.role_id
  const roleName = String(user?.roleName || user?.role_name || "").toLowerCase()
  const permissions = user?.permissions || []

  if (roleId === "role_consulta") return true
  if (roleName === "consulta") return true

  return (
    permissions.length === 0 &&
    !user?.isApiKey &&
    !user?.is_api_key &&
    !user?.isDevelopmentOpen &&
    !user?.is_development_open
  )
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const { session, user, loading } = useAuth()

  useEffect(() => {
    if (!loading && (!session || !user)) {
      router.replace("/login")
    }
  }, [loading, session, user, router])

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-zinc-50">
        <LoadingBlock />
      </div>
    )
  }

  if (!session || !user) {
    return null
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

          <main className="px-4 py-5 md:px-6 lg:px-8">
            {children}
          </main>
        </div>
      </div>
    </div>
  )
}