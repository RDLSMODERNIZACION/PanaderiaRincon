"use client"

import { useCallback, useEffect, useState } from "react"
import { CheckCircle2, Database, RefreshCw, Server, Shield } from "lucide-react"
import Button from "@/components/ui/Button"
import { Card, CardBody, CardHeader } from "@/components/ui/Card"
import Badge from "@/components/ui/Badge"
import CrudTableView from "@/features/crud/CrudTableView"
import { useAuth } from "@/features/auth/AuthProvider"
import { apiGet } from "@/lib/api"

export default function ConfiguracionView() {
  const { session, user, refreshMe } = useAuth()
  const [health, setHealth] = useState<any>(null)
  const [db, setDb] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  const test = useCallback(async () => {
    if (!session) return
    setError(null)
    try {
      const [h, d] = await Promise.all([apiGet(session, "/health"), apiGet(session, "/health/db")])
      setHealth(h)
      setDb(d)
    } catch (exc: any) {
      setError(exc?.message || "No se pudo probar la conexión")
    }
  }, [session])

  useEffect(() => { test() }, [test])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Configuración</h1>
        <p className="mt-1 text-sm text-zinc-600">Conexión, sesión y parámetros generales del negocio.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card>
          <CardHeader title="Backend" subtitle="Render / FastAPI" right={<Button variant="secondary" size="sm" onClick={test}><RefreshCw className="mr-2 h-4 w-4" />Probar</Button>} />
          <CardBody className="space-y-3 text-sm">
            <div className="flex items-center gap-2"><Server className="h-4 w-4" /><span className="truncate font-mono text-xs">{session?.apiBaseUrl}</span></div>
            <div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4" />API <Badge variant={health?.ok ? "success" : "danger"}>{health?.ok ? "OK" : "Sin probar"}</Badge></div>
            {error ? <div className="rounded-xl border border-red-200 bg-red-50 p-2 text-red-700">{error}</div> : null}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Base de datos" subtitle="Supabase PostgreSQL" />
          <CardBody className="space-y-3 text-sm">
            <div className="flex items-center gap-2"><Database className="h-4 w-4" />Estado <Badge variant={db?.ok ? "success" : "danger"}>{db?.ok ? "Conectada" : "Sin conexión"}</Badge></div>
            <div>Base: <span className="font-semibold">{db?.database || "—"}</span></div>
            <div>Usuario DB: <span className="font-semibold">{db?.user || "—"}</span></div>
            <div className="text-xs text-zinc-500">{db?.server}</div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Sesión" subtitle="Permisos recibidos" right={<Button variant="secondary" size="sm" onClick={refreshMe}>Actualizar</Button>} />
          <CardBody className="space-y-3 text-sm">
            <div className="flex items-center gap-2"><Shield className="h-4 w-4" />Rol <Badge>{user?.roleName || "Desarrollo"}</Badge></div>
            <div>ID usuario: <span className="font-mono text-xs">{user?.userId || "—"}</span></div>
            <div>Permisos: <span className="font-semibold">{user?.permissions?.includes("*") ? "todos" : user?.permissions?.length || 0}</span></div>
          </CardBody>
        </Card>
      </div>

      <CrudTableView tableName="business_settings" title="Parámetros del negocio" subtitle="Nombre, moneda, alertas y merma máxima." />
    </div>
  )
}
