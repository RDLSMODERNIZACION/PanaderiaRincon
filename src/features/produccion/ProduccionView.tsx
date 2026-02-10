"use client"

import { useMemo, useState } from "react"
import { lotesProduccion, productos as seedProductos } from "@/data/seed"
import { Card, CardBody, CardHeader } from "@/components/ui/Card"
import Badge from "@/components/ui/Badge"
import Button from "@/components/ui/Button"
import Select from "@/components/ui/Select"
import { Table, TD, TH, THead, TR } from "@/components/ui/Table"
import { formatDateTime, formatNumber, formatPercent } from "@/lib/utils"
import { downloadCsv } from "@/lib/csv"
import { Download } from "lucide-react"
import SalesArea from "@/components/charts/SalesArea"

export default function ProduccionView() {
  const [turno, setTurno] = useState<string>("Todos")
  const [productoId, setProductoId] = useState<string>("Todos")

  const rows = useMemo(() => {
    return lotesProduccion
      .filter(l => (turno === "Todos" ? true : l.turno === turno))
      .filter(l => (productoId === "Todos" ? true : l.productoId === productoId))
      .map(l => {
        const p = seedProductos.find(x => x.id === l.productoId)
        const mermaPct = l.planificado <= 0 ? 0 : l.merma / l.planificado
        return { ...l, producto: p?.nombre ?? l.productoId, mermaPct }
      })
      .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())
  }, [turno, productoId])

  const mermaTotal = rows.reduce((a, r) => a + r.merma, 0)
  const planTotal = rows.reduce((a, r) => a + r.planificado, 0)
  const mermaPct = planTotal <= 0 ? 0 : mermaTotal / planTotal

  const mermaPorDia = useMemo(() => {
    const map = new Map<string, number>()
    for (const r of rows) {
      const d = new Date(r.fecha)
      const key = `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`
      map.set(key, (map.get(key) ?? 0) + r.merma)
    }
    const out = Array.from(map.entries()).map(([dia, ventas]) => ({ dia, ventas }))
    return out.slice(-14)
  }, [rows])

  function exportar() {
    downloadCsv(
      `produccion_panaderia_${new Date().toISOString().slice(0, 10)}.csv`,
      rows.map(r => ({
        id: r.id,
        fecha: r.fecha,
        turno: r.turno,
        producto: r.producto,
        planificado: r.planificado,
        producido: r.producido,
        merma: r.merma,
        mermaPct: r.mermaPct
      }))
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Producción</h1>
          <p className="mt-1 text-sm text-zinc-600">
            Lotes, plan vs producido y merma (demo hardcodeado).
          </p>
        </div>
        <Button variant="secondary" onClick={exportar}>
          <Download className="mr-2 h-4 w-4" /> Exportar CSV
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-4">
        <Card className="xl:col-span-3">
          <CardHeader
            title="Lotes de producción"
            subtitle="Filtrá por turno o producto"
            right={
              <div className="flex gap-2">
                <div className="w-[140px]">
                  <Select value={turno} onChange={e => setTurno(e.target.value)}>
                    <option>Todos</option>
                    <option>Mañana</option>
                    <option>Tarde</option>
                    <option>Noche</option>
                  </Select>
                </div>
                <div className="w-[220px]">
                  <Select value={productoId} onChange={e => setProductoId(e.target.value)}>
                    <option value="Todos">Todos</option>
                    {seedProductos.map(p => (
                      <option key={p.id} value={p.id}>{p.nombre}</option>
                    ))}
                  </Select>
                </div>
              </div>
            }
          />
          <CardBody className="p-0">
            <Table>
              <THead>
                <TR>
                  <TH>ID</TH>
                  <TH>Fecha</TH>
                  <TH>Turno</TH>
                  <TH>Producto</TH>
                  <TH className="text-right">Plan</TH>
                  <TH className="text-right">Prod.</TH>
                  <TH className="text-right">Merma</TH>
                  <TH className="text-right">%</TH>
                </TR>
              </THead>
              <tbody>
                {rows.map(r => (
                  <TR key={r.id}>
                    <TD className="font-medium">{r.id}</TD>
                    <TD>{formatDateTime(r.fecha)}</TD>
                    <TD>
                      <Badge variant={r.turno === "Mañana" ? "success" : r.turno === "Tarde" ? "muted" : "default"}>
                        {r.turno}
                      </Badge>
                    </TD>
                    <TD className="font-semibold">{r.producto}</TD>
                    <TD className="text-right">{formatNumber(r.planificado)}</TD>
                    <TD className="text-right">{formatNumber(r.producido)}</TD>
                    <TD className="text-right">{formatNumber(r.merma)}</TD>
                    <TD className="text-right font-semibold">{formatPercent(r.mermaPct)}</TD>
                  </TR>
                ))}
              </tbody>
            </Table>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Resumen" />
          <CardBody className="space-y-3">
            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
              <div className="text-xs text-zinc-500">Merma %</div>
              <div className="mt-1 text-xl font-semibold">{formatPercent(mermaPct)}</div>
              <div className="mt-2 text-xs text-zinc-600">
                Merma total: <span className="font-semibold">{formatNumber(mermaTotal)}</span>
              </div>
            </div>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader title="Merma por día" subtitle="Últimos días (demo)" />
        <CardBody>
          <SalesArea data={mermaPorDia} />
        </CardBody>
      </Card>
    </div>
  )
}
