"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"
import { apiGet, apiPost, type ApiSession, unwrapData } from "@/lib/api"
import { cleanApiBaseUrl } from "@/lib/utils"

type AuthUser = {
  userId?: string | null
  user_id?: string | null
  id?: string | null
  nombre?: string | null
  name?: string | null
  username?: string | null
  email?: string | null
  fullName?: string | null
  full_name?: string | null
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
  login: (input: LoginInput) => Promise<AuthUser>
  registerUser: (input: RegisterInput) => Promise<void>
  logout: () => void
  refreshMe: () => Promise<void>
  can: (...permissions: string[]) => boolean
}

const STORAGE_KEY = "panaderia_rincon_session_v1"
const AuthContext = createContext<AuthContextType | null>(null)

function defaultApiBaseUrl() {
  return cleanApiBaseUrl(
    process.env.NEXT_PUBLIC_API_BASE_URL ||
      process.env.NEXT_PUBLIC_API_URL ||
      "https://panaderia-backend-vrfl.onrender.com"
  )
}

function normalizeApiBaseUrl(value?: string) {
  return cleanApiBaseUrl(value || defaultApiBaseUrl())
}

function getUserId(data: AuthUser | any): string | undefined {
  return data?.userId || data?.user_id || data?.id || undefined
}

function normalizeUser(data: AuthUser): AuthUser {
  const nombre =
    data.nombre ||
    data.name ||
    data.fullName ||
    data.full_name ||
    data.username ||
    data.email ||
    null

  return {
    ...data,
    userId: data.userId || data.user_id || data.id || null,
    user_id: data.user_id || data.userId || data.id || null,
    nombre,
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


function isDevelopmentUser(data: AuthUser | null | undefined) {
  if (!data) return false

  const roleName = String(data.roleName || data.role_name || "").toLowerCase()
  const roleId = String(data.roleId || data.role_id || "").toLowerCase()

  return (
    Boolean(data.isDevelopmentOpen || data.is_development_open) ||
    roleName === "desarrollo" ||
    roleName === "development" ||
    roleId === "development" ||
    roleId === "role_development"
  )
}

function sessionFromUser(apiBaseUrl: string, data: AuthUser | any): ApiSession {
  const userId = getUserId(data)

  if (!userId) {
    throw new Error("El backend no devolvió userId.")
  }

  return {
    apiBaseUrl,
    apiUrl: apiBaseUrl,
    userId
  }
}

function safeGetStoredValue(storage: Storage | undefined) {
  try {
    return storage?.getItem(STORAGE_KEY) || null
  } catch {
    return null
  }
}

function readStoredSession(): ApiSession | null {
  if (typeof window === "undefined") return null

  const rawValues = [
    safeGetStoredValue(window.localStorage),
    safeGetStoredValue(window.sessionStorage)
  ].filter(Boolean)

  for (const raw of rawValues) {
    try {
      const saved = JSON.parse(String(raw)) as ApiSession & { user_id?: string; id?: string }
      const apiBaseUrl = normalizeApiBaseUrl(saved.apiBaseUrl || saved.apiUrl)
      const userId = saved.userId || saved.user_id || saved.id

      if (apiBaseUrl && userId) {
        return {
          apiBaseUrl,
          apiUrl: apiBaseUrl,
          userId
        }
      }
    } catch {
      // Si una clave vieja quedó corrupta, se limpia abajo.
    }
  }

  return null
}

function saveStoredSession(session: ApiSession) {
  if (typeof window === "undefined") return

  const apiBaseUrl = normalizeApiBaseUrl(session.apiBaseUrl || session.apiUrl)
  const value = JSON.stringify({
    apiBaseUrl,
    apiUrl: apiBaseUrl,
    userId: session.userId
  })

  try {
    window.localStorage.setItem(STORAGE_KEY, value)
  } catch {
    // El estado en memoria sigue activo aunque el navegador no permita persistir la sesión.
  }

  try {
    window.sessionStorage.setItem(STORAGE_KEY, value)
  } catch {
    // El estado en memoria sigue activo aunque el navegador no permita persistir la sesión.
  }
}

function clearStoredSession() {
  if (typeof window === "undefined") return

  try {
    window.localStorage.removeItem(STORAGE_KEY)
  } catch {}

  try {
    window.sessionStorage.removeItem(STORAGE_KEY)
  } catch {}
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<ApiSession | null>(null)
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refreshMe = useCallback(async () => {
    const current = session || readStoredSession()

    if (!current?.apiBaseUrl || !current?.userId) {
      setSession(null)
      setUser(null)
      clearStoredSession()
      return
    }

    try {
      const payload = await apiGet(current, "/api/seguridad/me")
      const data = normalizeUser(unwrapData<AuthUser>(payload))

      if (isDevelopmentUser(data)) {
        throw new Error("La sesión guardada no corresponde a un usuario real. Volvé a iniciar sesión.")
      }

      setSession(current)
      setUser(data)
      setError(null)
      saveStoredSession(current)
    } catch (exc: any) {
      setSession(null)
      setUser(null)
      setError(exc?.message || "La sesión venció. Volvé a iniciar sesión.")
      clearStoredSession()
      throw exc
    }
  }, [session])

  useEffect(() => {
    let mounted = true

    async function boot() {
      try {
        const saved = readStoredSession()

        if (saved?.apiBaseUrl && saved?.userId) {
          const payload = await apiGet(saved, "/api/seguridad/me")
          const data = normalizeUser(unwrapData<AuthUser>(payload))

          if (isDevelopmentUser(data)) {
            throw new Error("Sesión de desarrollo inválida en producción.")
          }

          if (!mounted) return

          setSession(saved)
          setUser(data)
          setError(null)
          saveStoredSession(saved)
        } else {
          clearStoredSession()
        }
      } catch (exc) {
        console.warn(exc)
        clearStoredSession()

        if (mounted) {
          setSession(null)
          setUser(null)
        }
      } finally {
        if (mounted) setLoading(false)
      }
    }

    boot()

    return () => {
      mounted = false
    }
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

      if (isDevelopmentUser(meData)) {
        throw new Error("El backend respondió en modo desarrollo. Iniciá sesión con un usuario real.")
      }

      setSession(newSession)
      setUser(meData)
      setError(null)
      saveStoredSession(newSession)
      return meData
    } catch (exc: any) {
      setSession(null)
      setUser(null)
      clearStoredSession()
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
    clearStoredSession()
  }, [])

  const can = useCallback(
    (...permissions: string[]) => {
      if (!user) return false

      const p = user.permissions || []

      if (isDevelopmentUser(user)) return false
      if (p.includes("*")) return true
      if (permissions.length === 0) return true

      return permissions.some((permission) => p.includes(permission))
    },
    [user]
  )

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

const authFallback: AuthContextType = {
  session: null,
  user: null,
  loading: false,
  error: null,
  login: async () => {
    throw new Error("No se encontró AuthProvider. Recargá la página e iniciá sesión nuevamente.")
  },
  registerUser: async () => {
    throw new Error("No se encontró AuthProvider. Recargá la página e iniciá sesión nuevamente.")
  },
  logout: () => {
    clearStoredSession()
  },
  refreshMe: async () => {},
  can: () => false
}

export function useAuth() {
  const ctx = useContext(AuthContext)

  // En Next.js, la ruta interna /_not-found puede prerenderizarse fuera del árbol normal.
  // En ese caso no debe romper el build: devolvemos una sesión vacía y las pantallas protegidas redirigen al login.
  return ctx || authFallback
}

export function getDefaultApiBaseUrl() {
  return defaultApiBaseUrl()
}
