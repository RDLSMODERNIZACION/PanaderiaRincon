"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"
import { apiGet, apiPost, type ApiSession, unwrapData } from "@/lib/api"
import { cleanApiBaseUrl } from "@/lib/utils"

type AuthUser = {
  userId?: string | null
  user_id?: string | null
  roleId?: string | null
  role_id?: string | null
  roleName?: string | null
  role_name?: string | null
  permissions?: string[]
  isApiKey?: boolean
  is_api_key?: boolean
  isDevelopmentOpen?: boolean
  is_development_open?: boolean
}

type LoginInput = {
  apiBaseUrl?: string
  username: string
  password: string
}

type RegisterInput = {
  apiBaseUrl?: string
  username: string
  password: string
  nombre?: string
}

type AuthContextType = {
  session: ApiSession | null
  user: AuthUser | null
  loading: boolean
  error: string | null
  login: (input: LoginInput) => Promise<void>
  registerUser: (input: RegisterInput) => Promise<void>
  logout: () => void
  refreshMe: () => Promise<void>
  can: (...permissions: string[]) => boolean
}

const STORAGE_KEY = "panaderia_rincon_session_v1"
const AuthContext = createContext<AuthContextType | null>(null)

function defaultApiBaseUrl() {
  return cleanApiBaseUrl(process.env.NEXT_PUBLIC_API_BASE_URL || process.env.NEXT_PUBLIC_API_URL || "https://panaderia-backend-vrfl.onrender.com")
}

function normalizeApiBaseUrl(value?: string) {
  return cleanApiBaseUrl(value || defaultApiBaseUrl())
}

function getUserId(data: AuthUser | any): string | undefined {
  return data?.userId || data?.user_id || data?.id || undefined
}

function normalizeUser(data: AuthUser): AuthUser {
  return {
    ...data,
    userId: data.userId || data.user_id || null,
    user_id: data.user_id || data.userId || null,
    roleId: data.roleId || data.role_id || null,
    role_id: data.role_id || data.roleId || null,
    roleName: data.roleName || data.role_name || null,
    role_name: data.role_name || data.roleName || null,
    isApiKey: Boolean(data.isApiKey || data.is_api_key),
    is_api_key: Boolean(data.is_api_key || data.isApiKey),
    isDevelopmentOpen: Boolean(data.isDevelopmentOpen || data.is_development_open),
    is_development_open: Boolean(data.is_development_open || data.isDevelopmentOpen),
    permissions: data.permissions || []
  }
}

function sessionFromUser(apiBaseUrl: string, data: AuthUser | any): ApiSession {
  const userId = getUserId(data)
  if (!userId) throw new Error("El backend no devolvió userId.")

  return {
    apiBaseUrl,
    userId
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

    if (!current?.apiBaseUrl || !current?.userId) return

    const payload = await apiGet(current, "/api/seguridad/me")
    const data = normalizeUser(unwrapData<AuthUser>(payload))

    setSession(current)
    setUser(data)
    setError(null)

    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(current))
    }
  }, [session])

  useEffect(() => {
    async function boot() {
      try {
        const raw = window.localStorage.getItem(STORAGE_KEY)

        if (raw) {
          const saved = JSON.parse(raw) as ApiSession

          if (saved?.apiBaseUrl && saved?.userId) {
            const payload = await apiGet(saved, "/api/seguridad/me")
            setSession(saved)
            setUser(normalizeUser(unwrapData<AuthUser>(payload)))
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
    const apiBaseUrl = normalizeApiBaseUrl(input.apiBaseUrl)
    const username = input.username.trim()

    if (!username || !input.password) {
      throw new Error("Ingresá usuario y contraseña.")
    }

    setLoading(true)

    try {
      const loginPayload = await apiPost({ apiBaseUrl }, "/api/seguridad/login", {
        username,
        password: input.password
      })

      const loginData = unwrapData<AuthUser>(loginPayload)
      const newSession = sessionFromUser(apiBaseUrl, loginData)

      const mePayload = await apiGet(newSession, "/api/seguridad/me")
      const meData = normalizeUser(unwrapData<AuthUser>(mePayload))

      setSession(newSession)
      setUser(meData)
      setError(null)
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(newSession))
    } catch (exc: any) {
      setError(exc?.message || "No se pudo iniciar sesión")
      throw exc
    } finally {
      setLoading(false)
    }
  }, [])

  const registerUser = useCallback(async (input: RegisterInput) => {
    const apiBaseUrl = normalizeApiBaseUrl(input.apiBaseUrl)
    const username = input.username.trim()

    if (!username || !input.password) {
      throw new Error("Ingresá usuario y contraseña.")
    }

    setLoading(true)

    try {
      await apiPost({ apiBaseUrl }, "/api/seguridad/register", {
        username,
        password: input.password,
        nombre: input.nombre || username
      })

      setError(null)
    } catch (exc: any) {
      setError(exc?.message || "No se pudo registrar el usuario")
      throw exc
    } finally {
      setLoading(false)
    }
  }, [])

  const logout = useCallback(() => {
    setSession(null)
    setUser(null)
    setError(null)

    if (typeof window !== "undefined") {
      window.localStorage.removeItem(STORAGE_KEY)
    }
  }, [])

  const can = useCallback((...permissions: string[]) => {
    const p = user?.permissions || []

    if (p.includes("*")) return true
    if (user?.isDevelopmentOpen || user?.is_development_open) return true
    if (permissions.length === 0) return true

    return permissions.some(permission => p.includes(permission))
  }, [user])

  const value = useMemo<AuthContextType>(
    () => ({
      session,
      user,
      loading,
      error,
      login,
      registerUser,
      logout,
      refreshMe,
      can
    }),
    [session, user, loading, error, login, registerUser, logout, refreshMe, can]
  )

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