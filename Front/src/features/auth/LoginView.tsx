"use client"

import Image from "next/image"
import { useRouter, useSearchParams } from "next/navigation"
import { FormEvent, useEffect, useMemo, useState } from "react"
import { Eye, EyeOff, LockKeyhole, LogIn, UserPlus, UserRound } from "lucide-react"
import Button from "@/components/ui/Button"
import Input from "@/components/ui/Input"
import { Card, CardBody } from "@/components/ui/Card"
import { LoadingBlock } from "@/components/data/AsyncState"
import { getDefaultApiBaseUrl, useAuth } from "@/features/auth/AuthProvider"
import { defaultHomeForUser } from "@/features/auth/roleUtils"

type AuthMode = "login" | "register"

function safeNextPath(value: string | null) {
  if (!value) return ""
  if (!value.startsWith("/") || value.startsWith("//")) return ""
  if (value.startsWith("/login")) return ""
  return value
}

function destinationForUser(user: any, next: string) {
  if (next && next !== "/") return next
  return defaultHomeForUser(user)
}

export default function LoginView() {
  const router = useRouter()
  const search = useSearchParams()
  const next = useMemo(() => safeNextPath(search.get("next")), [search])
  const { login, registerUser, session, user, loading: authLoading } = useAuth()

  const [mode, setMode] = useState<AuthMode>("login")
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isRegister = mode === "register"

  useEffect(() => {
    if (!authLoading && session && user) {
      router.replace(destinationForUser(user, next))
    }
  }, [authLoading, session, user, next, router])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    const cleanUsername = username.trim()

    if (!cleanUsername) {
      setError("Ingresá un usuario.")
      return
    }

    if (!password) {
      setError("Ingresá una contraseña.")
      return
    }

    if (isRegister && password !== confirmPassword) {
      setError("Las contraseñas no coinciden.")
      return
    }

    setLoading(true)

    try {
      const apiBaseUrl = getDefaultApiBaseUrl()

      if (isRegister) {
        await registerUser({
          apiBaseUrl,
          username: cleanUsername,
          password
        })
      }

      const loggedUser = await login({
        apiBaseUrl,
        username: cleanUsername,
        password
      })

      router.replace(destinationForUser(loggedUser, next))
    } catch (exc: any) {
      setError(exc?.message || (isRegister ? "No se pudo registrar el usuario" : "No se pudo iniciar sesión"))
    } finally {
      setLoading(false)
    }
  }

  if (authLoading) {
    return (
      <div className="grid min-h-screen place-items-center bg-zinc-50 px-4 py-10">
        <LoadingBlock label="Verificando sesión…" />
      </div>
    )
  }

  return (
    <div className="grid min-h-screen place-items-center bg-zinc-50 px-4 py-10">
      <div className="w-full max-w-md space-y-5">
        <div className="text-center">
          <div className="mx-auto grid h-20 w-20 place-items-center overflow-hidden rounded-full bg-black">
            <Image
              src="/brand/logo-panaderia-rincon.png.jpeg"
              alt="Panadería Rincón"
              width={80}
              height={80}
              className="h-20 w-20 object-contain"
              priority
            />
          </div>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight">Panadería Rincón</h1>
          <p className="mt-1 text-sm text-zinc-600">Sistema de gestión</p>
        </div>

        <Card>
          <CardBody className="space-y-4">
            <div className="grid grid-cols-2 gap-2 rounded-2xl bg-zinc-100 p-1">
              <button
                type="button"
                className={`rounded-xl px-3 py-2 text-sm font-medium transition ${
                  mode === "login" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-600 hover:text-zinc-900"
                }`}
                onClick={() => {
                  setMode("login")
                  setError(null)
                }}
              >
                Entrar
              </button>

              <button
                type="button"
                className={`rounded-xl px-3 py-2 text-sm font-medium transition ${
                  mode === "register" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-600 hover:text-zinc-900"
                }`}
                onClick={() => {
                  setMode("register")
                  setError(null)
                }}
              >
                Registrarse
              </button>
            </div>

            <form className="space-y-4" onSubmit={submit}>
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-600">Usuario</label>
                <div className="relative">
                  <UserRound className="absolute left-3 top-3 h-4 w-4 text-zinc-400" />
                  <Input
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    className="h-11 pl-9 text-base md:text-sm"
                    placeholder="usuario"
                    autoComplete="username"
                    autoCapitalize="none"
                    spellCheck={false}
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-600">Contraseña</label>
                <div className="relative">
                  <LockKeyhole className="absolute left-3 top-3 h-4 w-4 text-zinc-400" />
                  <Input
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="h-11 px-9 text-base md:text-sm"
                    type={showPassword ? "text" : "password"}
                    placeholder="contraseña"
                    autoComplete={isRegister ? "new-password" : "current-password"}
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-3 text-zinc-400 hover:text-zinc-700"
                    onClick={() => setShowPassword(value => !value)}
                    aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {isRegister ? (
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-600">Confirmar contraseña</label>
                  <div className="relative">
                    <LockKeyhole className="absolute left-3 top-3 h-4 w-4 text-zinc-400" />
                    <Input
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      className="h-11 pl-9 text-base md:text-sm"
                      type={showPassword ? "text" : "password"}
                      placeholder="repetir contraseña"
                      autoComplete="new-password"
                    />
                  </div>
                </div>
              ) : null}

              {error ? <div className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}

              <Button className="h-11 w-full" type="submit" disabled={loading}>
                {isRegister ? <UserPlus className="mr-2 h-4 w-4" /> : <LogIn className="mr-2 h-4 w-4" />}
                {loading ? "Procesando..." : isRegister ? "Crear usuario" : "Entrar"}
              </Button>
            </form>
          </CardBody>
        </Card>

        <p className="text-center text-xs text-zinc-500">
          Acceso privado al sistema de gestión.
        </p>
      </div>
    </div>
  )
}
