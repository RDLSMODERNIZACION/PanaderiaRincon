"use client"

import { useRouter, usePathname } from "next/navigation"
import { useEffect } from "react"
import { Loader2 } from "lucide-react"
import { useAuth } from "@/features/auth/AuthProvider"

function loginUrl(pathname: string | null) {
  const next = pathname && pathname !== "/login" ? pathname : "/"
  return `/login?next=${encodeURIComponent(next)}`
}

export default function ProtectedShell({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const { session, user, loading } = useAuth()

  useEffect(() => {
    if (!loading && (!session || !user)) router.replace(loginUrl(pathname))
  }, [loading, session, user, pathname, router])

  if (loading || !session || !user) {
    return (
      <div className="grid min-h-screen place-items-center bg-zinc-50">
        <div className="flex items-center gap-3 rounded-2xl border border-zinc-200 bg-white px-5 py-4 shadow-soft">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm font-medium">Verificando sesión…</span>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
