"use client"

import { useCallback, useEffect, useState } from "react"
import { Activity, AlertTriangle, Database, DollarSign, Package, Route, ShoppingCart, Wheat } from "lucide-react"
import Badge from "@/components/ui/Badge"
import Button from "@/components/ui/Button"
import { Card, CardBody, CardHeader } from "@/components/ui/Card"
import { ErrorBlock, LoadingBlock } from "@/components/data/AsyncState"
import { useAuth } from "@/features/auth/AuthProvider"
import { apiGet, unwrapData } from "@/lib/api"
import { formatCurrencyARS, formatNumber } from "@/lib/utils"

type DashboardData = Record<string, any>

type ExtraData = {
  health?: any
  db?: any
  dashboard?: DashboardData
  deudas?: any[]
  pan?: any[]
}

function KpiCard({ title, value, subtitle, icon: Icon }: { title: string; value: React.ReactNode; subtitle?: string; icon: any }) {
  return (
    <Card>
      <CardBody>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-sm text-zinc-500">{title}</div>
            <div className="mt-2 text-2xl font-semibold tracking-tight">{value}</div>
            {subtitle ? <div className="mt-1 text-xs text-zinc-500">{subtitle}</div> : null}
          </div>
          <div className="grid h-10 w-10 place-items-center rounded-2xl bg-zinc-100 text-zinc-700"><Icon className="h-5 w-5" /></div>
        </div>
      </CardBody>
    </Card>
  )
}

export default function DashboardView() {
  const { session, user } = useAuth()
  const [data, setData] = useState<ExtraData>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!session) return
    setLoading(true)
    setError(null)
    try {
      const [health, db, dashboard, deudas, pan] = await Promise.allSettled([
        apiGet(session, "/health"),
        apiGet(session, "/health/db"),
        apiGet(session, "/api/dashboard/resumen"),
        apiGet(session, "/api/reparto/reportes/deudas-clientes"),
        apiGet(session, "/api/reparto/reportes/pan-rallado-pendiente")
      ])

      setData({
        health: health.status === "fulfilled" ? health.value : null,
        db: db.status === "fulfilled" ? db.value : null,
        dashboard: dashboard.status === "fulfilled" ? unwrapData(dashboard.value) : null,
        deudas: deudas.status === "fulfilled" ? unwrapData<any[]>(deudas.value) : [],
        pan: pan.status === "fulfilled" ? unwrapData<any[]>(pan.value) : []
      })
    } catch (exc: any) {
      setError(exc?.message || "No se pudo cargar el dashboard")
    } finally {
      setLoading(false)
    }
  }, [session])

  useEffect(() => { load() }, [load])

  if (loading) return <LoadingBlock label="Cargando panel desde Supabase…" />
  if (error) return <ErrorBlock error={error} onRetry={load} />

  const dash = data.dashboard || {}
  const ventas = dash.ventas || {}
  const produccion = dash.produccion || {}
  const inventario = dash.inventario || {}
  const energia = dash.energia || {}
  const top = dash.topProductos || dash.top_productos || []
  const deudaTotal = (data.deudas || []).reduce((acc, row) => acc + Number(row.saldoPesos || row.saldo_pesos || 0), 0)
  const panPendiente = (data.pan || []).reduce((acc, row) => acc + Number(row.kgPendientes || row.kg_pendientes || 0), 0)

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-end">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Dashboard</h1>
          <p className="mt-1 text-sm text-zinc-600">Resumen real tomado del backend. Si no hay datos, los valores quedan en cero.</p>
        </div>
        <div className="flex gap-2">
          <Badge variant={data.db?.ok ? "success" : "danger"}>{data.db?.ok ? "DB conectada" : "DB sin conexión"}</Badge>
          <Badge variant="muted">{user?.roleName || "Desarrollo"}</Badge>
          <Button variant="secondary" onClick={load}>Actualizar</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard title="Ventas 30 días" value={formatCurrencyARS(ventas.ventasTotal || ventas.ventas_total || 0)} subtitle={`${formatNumber(ventas.tickets || 0)} tickets`} icon={ShoppingCart} />
        <KpiCard title="Deuda clientes" value={formatCurrencyARS(deudaTotal)} subtitle={`${formatNumber((data.deudas || []).length)} clientes con saldo`} icon={DollarSign} />
        <KpiCard title="Pan rallado pendiente" value={`${formatNumber(panPendiente, 3)} kg`} subtitle="Saldo neto por comercios" icon={Wheat} />
        <KpiCard title="Stock valorizado" value={formatCurrencyARS(inventario.valorStock || inventario.valor_stock || 0)} subtitle={`${formatNumber(inventario.insumosBajoStock || inventario.insumos_bajo_stock || 0)} insumos bajo mínimo`} icon={Package} />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card>
          <CardHeader title="Producción" subtitle="Últimos 30 días" />
          <CardBody className="space-y-3">
            <div className="flex justify-between text-sm"><span>Planificado</span><span className="font-semibold">{formatNumber(produccion.planificado || 0, 3)}</span></div>
            <div className="flex justify-between text-sm"><span>Producido</span><span className="font-semibold">{formatNumber(produccion.producido || 0, 3)}</span></div>
            <div className="flex justify-between text-sm"><span>Merma</span><span className="font-semibold">{formatNumber(produccion.merma || 0, 3)}</span></div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Energía" subtitle="Registros de hornos" />
          <CardBody className="space-y-3">
            <div className="flex justify-between text-sm"><span>kWh</span><span className="font-semibold">{formatNumber(energia.kwh || 0, 2)}</span></div>
            <div className="flex justify-between text-sm"><span>Costo</span><span className="font-semibold">{formatCurrencyARS(energia.costo || 0)}</span></div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Estado técnico" subtitle="Backend / Supabase" />
          <CardBody className="space-y-3 text-sm">
            <div className="flex items-center gap-2"><Activity className="h-4 w-4" /> API: <span className="font-semibold">{data.health?.ok ? "online" : "sin respuesta"}</span></div>
            <div className="flex items-center gap-2"><Database className="h-4 w-4" /> DB: <span className="font-semibold">{data.db?.database || "—"}</span></div>
            <div className="text-xs text-zinc-500">{data.db?.server || "Sin información de servidor"}</div>
          </CardBody>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader title="Top productos" subtitle="Según tickets cargados" />
          <CardBody>
            {top.length === 0 ? (
              <div className="flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800"><AlertTriangle className="mt-0.5 h-4 w-4" /> Todavía no hay ventas cargadas.</div>
            ) : (
              <div className="space-y-2">
                {top.map((row: any) => (
                  <div key={row.id} className="flex items-center justify-between rounded-xl border border-zinc-200 px-3 py-2 text-sm">
                    <span className="font-medium">{row.nombre}</span>
                    <span>{formatCurrencyARS(row.total)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Control de reparto" subtitle="Diferencias a revisar" />
          <CardBody className="space-y-3 text-sm">
            <div className="flex items-center justify-between rounded-xl border border-zinc-200 px-3 py-2"><span>Clientes con deuda</span><span className="font-semibold">{formatNumber((data.deudas || []).length)}</span></div>
            <div className="flex items-center justify-between rounded-xl border border-zinc-200 px-3 py-2"><span>Saldo pan rallado pendiente</span><span className="font-semibold">{formatNumber(panPendiente, 3)} kg</span></div>
            <div className="flex items-center gap-2 text-xs text-zinc-500"><Route className="h-4 w-4" /> Abrí Reparto para revisar visitas, pagos, stock y cierres.</div>
          </CardBody>
        </Card>
      </div>
    </div>
  )
}
