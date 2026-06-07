"use client"

import { useMemo, useState } from "react"
import { lotesProduccion, productos, tickets, empleados, turnosPersonal } from "@/data/seed"
import { Card, CardBody, CardHeader } from "@/components/ui/Card"
import Badge from "@/components/ui/Badge"
import Button from "@/components/ui/Button"
import Select from "@/components/ui/Select"
import {
  DateRangeKey,
  computeMargenBruto,
  computeMerma,
  computeTicketPromedio,
  computeVentas,
  filterByRange,
  topProductosPorVentas
} from "@/lib/kpi"
import { formatCurrencyARS, formatNumber, formatPercent } from "@/lib/utils"
import { downloadCsv } from "@/lib/csv"
import { Download } from "lucide-react"
import { Table, TD, TH, THead, TR } from "@/components/ui/Table"

export default function ReportesView() {
  const [range, setRange] = useState<DateRangeKey>("14d")

  const data = useMemo(() => {
    const t = filterByRange(tickets, range)
    const l = filterByRange(lotesProduccion, range)
    const ventas = computeVentas(t)
    const ticketProm = computeTicketPromedio(t)
    const margen = computeMargenBruto(t, productos)
    const merma = computeMerma(l)
    const top = topProductosPorVentas(t, productos, 10)

    const empMap = new Map(empleados.map(e => [e.id, e]))
    const turnos = filterByRange(turnosPersonal, range)
    const horas = turnos.reduce((a, x) => a + x.horas, 0)
    const costoLabor = turnos.reduce((a, x) => a + (empMap.get(x.empleadoId)?.costoHora ?? 0) * x.horas, 0)
    const costoLaborPct = ventas <= 0 ? 0 : costoLabor / ventas

    return { t, l, ventas, ticketProm, margen, merma, top, horas, costoLabor, costoLaborPct }
  }, [range])

  function exportarResumen() {
    downloadCsv(`reporte_resumen_${range}_${new Date().toISOString().slice(0, 10)}.csv`, [
      {
        rango: range,
        tickets: data.t.length,
        ventas: data.ventas,
        ticketPromedio: data.ticketProm,
        margenBrutoPct: data.margen.pct,
        mermaPct: data.merma.pct,
        horas: data.horas,
        costoLaboral: data.costoLabor,
        costoLaboralPct: data.costoLaborPct
      }
    ])
  }

  function exportarTop() {
    downloadCsv(
      `reporte_top_productos_${range}_${new Date().toISOString().slice(0, 10)}.csv`,
      data.top.map(x => ({ producto: x.nombre, ventas: x.ventas, unidades: x.unidades }))
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Reportes</h1>
          <p className="mt-1 text-sm text-zinc-600">Resumen por período (7/14/30 días demo) + top productos.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-[170px]">
            <Select value={range} onChange={e => setRange(e.target.value as DateRangeKey)}>
              <option value="7d">Últimos 7 días</option>
              <option value="14d">Últimos 14 días</option>
              <option value="30d">Últimos 30 días</option>
            </Select>
          </div>
          <Button variant="secondary" onClick={exportarResumen}>
            <Download className="mr-2 h-4 w-4" /> Export resumen
          </Button>
          <Button onClick={exportarTop}>
            <Download className="mr-2 h-4 w-4" /> Export top
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardBody>
            <div className="text-xs text-zinc-500">Ventas</div>
            <div className="mt-1 text-2xl font-semibold">{formatCurrencyARS(data.ventas)}</div>
            <div className="mt-2 text-xs text-zinc-600">
              Tickets: <span className="font-semibold">{formatNumber(data.t.length)}</span>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <div className="text-xs text-zinc-500">Ticket promedio</div>
            <div className="mt-1 text-2xl font-semibold">{formatCurrencyARS(data.ticketProm)}</div>
            <div className="mt-2 text-xs text-zinc-600">Mejor comparar por canal</div>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <div className="text-xs text-zinc-500">Margen bruto</div>
            <div className="mt-1 text-2xl font-semibold">{formatPercent(data.margen.pct)}</div>
            <div className="mt-2 text-xs text-zinc-600">
              Costo MP: <span className="font-semibold">{formatCurrencyARS(data.margen.costo)}</span>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <div className="text-xs text-zinc-500">Merma</div>
            <div className="mt-1 text-2xl font-semibold">{formatPercent(data.merma.pct)}</div>
            <div className="mt-2 text-xs text-zinc-600">
              Plan: <span className="font-semibold">{formatNumber(data.merma.plan)}</span> u
            </div>
          </CardBody>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Top productos" subtitle="Ordenado por ventas" right={<Badge variant="muted">{data.top.length} items</Badge>} />
          <CardBody className="p-0">
            <Table>
              <THead>
                <TR>
                  <TH>Producto</TH>
                  <TH className="text-right">Unidades</TH>
                  <TH className="text-right">Ventas</TH>
                </TR>
              </THead>
              <tbody>
                {data.top.map(x => (
                  <TR key={x.productoId}>
                    <TD className="font-semibold">{x.nombre}</TD>
                    <TD className="text-right">{formatNumber(x.unidades)}</TD>
                    <TD className="text-right font-semibold">{formatCurrencyARS(x.ventas)}</TD>
                  </TR>
                ))}
              </tbody>
            </Table>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Mano de obra" subtitle="Estimación del período" />
          <CardBody className="space-y-3">
            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
              <div className="text-xs text-zinc-500">Horas</div>
              <div className="mt-1 text-2xl font-semibold">{formatNumber(data.horas)}</div>
            </div>
            <div className="rounded-2xl border border-zinc-200 bg-white p-4">
              <div className="text-xs text-zinc-500">Costo laboral</div>
              <div className="mt-1 text-xl font-semibold">{formatCurrencyARS(data.costoLabor)}</div>
              <div className="mt-2 text-xs text-zinc-500">Costo laboral %</div>
              <div className="text-sm font-semibold">{formatPercent(data.costoLaborPct)}</div>
            </div>
            <div className="rounded-2xl border border-zinc-200 bg-white p-4 text-sm text-zinc-700">
              Tip: separá “horas producción” vs “horas mostrador” para ver productividad real.
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  )
}
