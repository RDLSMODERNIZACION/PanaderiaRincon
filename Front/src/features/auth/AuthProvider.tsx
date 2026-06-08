"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"
import { apiGet, type ApiSession, unwrapData } from "@/lib/api"
import { cleanApiBaseUrl } from "@/lib/utils"

type AuthUser = {
  userId?: string | null
  roleId?: string | null
  roleName?: string | null
  permissions?: string[]
  isApiKey?: boolean
  isDevelopmentOpen?: boolean
}

type LoginInput = {
  apiBaseUrl: string
  apiKey?: string
  userId?: string
}

type AuthContextType = {
  session: ApiSession | null
  user: AuthUser | null
  loading: boolean
  error: string | null
  login: (input: LoginInput) => Promise<void>
  logout: () => void
  refreshMe: () => Promise<void>
  can: (...permissions: string[]) => boolean
}

const STORAGE_KEY = "panaderia_rincon_session_v1"
const AuthContext = createContext<AuthContextType | null>(null)

function defaultApiBaseUrl() {
  return cleanApiBaseUrl(process.env.NEXT_PUBLIC_API_BASE_URL || process.env.NEXT_PUBLIC_API_URL || "https://panaderia-backend-vrfl.onrender.com")
}

function normalizeSession(input: LoginInput): ApiSession {
  return {
    apiBaseUrl: cleanApiBaseUrl(input.apiBaseUrl || defaultApiBaseUrl()),
    apiKey: input.apiKey?.trim() || process.env.NEXT_PUBLIC_DEFAULT_API_KEY || process.env.NEXT_PUBLIC_API_KEY || undefined,
    userId: input.userId?.trim() || undefined
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<ApiSession | null>(null)
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refreshMe = useCallback(async () => {
    const raw = typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null
    const current = session || (raw ? (JSON.parse(raw) as ApiSession) : null)
    if (!current?.apiBaseUrl) return

    const payload = await apiGet(current, "/api/seguridad/me")
    const data = unwrapData<AuthUser>(payload)
    setSession(current)
    setUser(data)
    setError(null)
    if (typeof window !== "undefined") window.localStorage.setItem(STORAGE_KEY, JSON.stringify(current))
  }, [session])

  useEffect(() => {
    async function boot() {
      try {
        const raw = window.localStorage.getItem(STORAGE_KEY)
        if (raw) {
          const saved = JSON.parse(raw) as ApiSession
          if (saved?.apiBaseUrl) {
            const payload = await apiGet(saved, "/api/seguridad/me")
            setSession(saved)
            setUser(unwrapData<AuthUser>(payload))
          }
        }
      } catch (exc) {
        console.warn(exc)
        window.localStorage.removeItem(STORAGE_KEY)
      } finally {
        setLoading(false)
      }
    }
    boot()
  }, [])

  const login = useCallback(async (input: LoginInput) => {
    const normalized = normalizeSession(input)
    setLoading(true)
    try {
      const payload = await apiGet(normalized, "/api/seguridad/me")
      const data = unwrapData<AuthUser>(payload)
      setSession(normalized)
      setUser(data)
      setError(null)
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized))
    } catch (exc: any) {
      setError(exc?.message || "No se pudo iniciar sesión")
      throw exc
    } finally {
      setLoading(false)
    }
  }, [])

  const logout = useCallback(() => {
    setSession(null)
    setUser(null)
    setError(null)
    if (typeof window !== "undefined") window.localStorage.removeItem(STORAGE_KEY)
  }, [])

  const can = useCallback((...permissions: string[]) => {
    const p = user?.permissions || []
    if (p.includes("*")) return true
    if (user?.isDevelopmentOpen) return true
    if (permissions.length === 0) return true
    return permissions.some(permission => p.includes(permission))
  }, [user])

  const value = useMemo<AuthContextType>(() => ({ session, user, loading, error, login, logout, refreshMe, can }), [session, user, loading, error, login, logout, refreshMe, can])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth debe usarse dentro de AuthProvider")
  return ctx
}

export function getDefaultApiBaseUrl() {
  return defaultApiBaseUrl()
}
