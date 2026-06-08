"use client"

import { useRouter } from "next/navigation"
import { useEffect } from "react"
import { Loader2 } from "lucide-react"
import { useAuth } from "@/features/auth/AuthProvider"

export default function ProtectedShell({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const { session, loading } = useAuth()

  useEffect(() => {
    if (!loading && !session) router.replace("/login")
  }, [loading, session, router])

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-zinc-50">
        <div className="flex items-center gap-3 rounded-2xl border border-zinc-200 bg-white px-5 py-4 shadow-soft">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm font-medium">Conectando con backend…</span>
        </div>
      </div>
    )
  }

  if (!session) return null
  return <>{children}</>
}
