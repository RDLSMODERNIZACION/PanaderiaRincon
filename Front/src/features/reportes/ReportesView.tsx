"use client"

import { useCallback, useEffect, useState } from "react"
import { AlertTriangle, DollarSign, Wheat } from "lucide-react"
import { Card, CardBody, CardHeader } from "@/components/ui/Card"
import { Table, TD, TH, THead, TR } from "@/components/ui/Table"
import Button from "@/components/ui/Button"
import { EmptyBlock, ErrorBlock, LoadingBlock } from "@/components/data/AsyncState"
import { useAuth } from "@/features/auth/AuthProvider"
import { apiGet, unwrapData } from "@/lib/api"
import { formatCurrencyARS, formatNumber } from "@/lib/utils"

type Row = Record<string, any>

export default function ReportesView() {
  const { session } = useAuth()
  const [deudas, setDeudas] = useState<Row[]>([])
  const [pan, setPan] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!session) return
    setLoading(true)
    setError(null)
    try {
      const [d, p] = await Promise.all([
        apiGet(session, "/api/reparto/reportes/deudas-clientes"),
        apiGet(session, "/api/reparto/reportes/pan-rallado-pendiente")
      ])
      setDeudas(unwrapData<Row[]>(d) || [])
      setPan(unwrapData<Row[]>(p) || [])
    } catch (exc: any) {
      setError(exc?.message || "No se pudieron cargar reportes")
    } finally {
      setLoading(false)
    }
  }, [session])

  useEffect(() => { load() }, [load])

  if (loading) return <LoadingBlock label="Cargando reportes reales…" />
  if (error) return <ErrorBlock error={error} onRetry={load} />

  const deudaTotal = deudas.reduce((acc, r) => acc + Number(r.saldo || r.saldoPesos || r.saldo_pesos || 0), 0)
  const panTotal = pan.reduce((acc, r) => acc + Number(r.kgPendiente || r.kg_pendiente || r.kgPendientes || 0), 0)

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-end">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Reportes</h1>
          <p className="mt-1 text-sm text-zinc-600">Alertas de deuda y pan rallado pendiente desde Supabase.</p>
        </div>
        <Button variant="secondary" onClick={load}>Actualizar</Button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card><CardBody><div className="flex items-center justify-between"><div><div className="text-sm text-zinc-500">Deuda total</div><div className="mt-2 text-2xl font-semibold">{formatCurrencyARS(deudaTotal)}</div></div><DollarSign className="h-8 w-8 text-zinc-500" /></div></CardBody></Card>
        <Card><CardBody><div className="flex items-center justify-between"><div><div className="text-sm text-zinc-500">Pan rallado pendiente</div><div className="mt-2 text-2xl font-semibold">{formatNumber(panTotal, 3)} kg</div></div><Wheat className="h-8 w-8 text-zinc-500" /></div></CardBody></Card>
      </div>

      <Card>
        <CardHeader title="Clientes con deuda" subtitle="Saldo distinto de cero." />
        <CardBody className="p-0">
          {deudas.length === 0 ? <EmptyBlock label="No hay deuda cargada." /> : (
            <Table><THead><TR><TH>Cliente</TH><TH className="text-right">Saldo</TH></TR></THead><tbody>{deudas.map((r, i) => <TR key={String(r.customerId || r.customer_id || i)}><TD>{r.nombre || r.customerId || r.customer_id}</TD><TD className="text-right font-semibold">{formatCurrencyARS(r.saldo || r.saldoPesos || r.saldo_pesos || 0)}</TD></TR>)}</tbody></Table>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Pan rallado pendiente" subtitle="Control en kg para evitar arreglos informales." />
        <CardBody className="p-0">
          {pan.length === 0 ? <EmptyBlock label="No hay saldo pendiente de pan rallado." /> : (
            <Table><THead><TR><TH>Cliente</TH><TH className="text-right">Pendiente kg</TH></TR></THead><tbody>{pan.map((r, i) => <TR key={String(r.customerId || r.customer_id || i)}><TD>{r.nombre || r.customerId || r.customer_id}</TD><TD className="text-right font-semibold">{formatNumber(r.kgPendiente || r.kg_pendiente || r.kgPendientes || 0, 3)}</TD></TR>)}</tbody></Table>
          )}
        </CardBody>
      </Card>

      <div className="flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        <AlertTriangle className="mt-0.5 h-4 w-4" /> Los reportes dependen de las vistas SQL creadas en el schema del backend.
      </div>
    </div>
  )
}
