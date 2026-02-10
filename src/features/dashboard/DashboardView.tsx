"use client"

import { Card, CardBody, CardHeader } from "@/components/ui/Card"
import Badge from "@/components/ui/Badge"
import Button from "@/components/ui/Button"
import { energia, insumos, lotesProduccion, productos, tickets, turnosPersonal, empleados } from "@/data/seed"
import { computeMargenBruto, computeMerma, computeTicketPromedio, computeVentas, seriesVentasPorDia, topProductosPorVentas } from "@/lib/kpi"
import { formatCurrencyARS, formatNumber, formatPercent } from "@/lib/utils"
import SalesArea from "@/components/charts/SalesArea"
import TopProductsBar from "@/components/charts/TopProductsBar"
import { ArrowUpRight, Flame, PackageX, Sparkles } from "lucide-react"

export default function DashboardView() {
  const ventas = computeVentas(tickets)
  const ticketProm = computeTicketPromedio(tickets)
  const margen = computeMargenBruto(tickets, productos)
  const merma = computeMerma(lotesProduccion)

  const stockBajo = insumos
    .filter(i => i.stockActual <= i.stockMinimo)
    .map(i => ({ nombre: i.nombre, actual: i.stockActual, min: i.stockMinimo }))

  const ventasSeries = seriesVentasPorDia(tickets).slice(-14)
  const topProd = topProductosPorVentas(tickets, productos, 7).map(p => ({ nombre: p.nombre, ventas: p.ventas }))

  const costoEnergia = energia.reduce((a, e) => a + e.costo, 0)

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Dashboard</h1>
          <p className="mt-1 text-sm text-zinc-600">
            Vista general (demo). Todo está hardcodeado en <code className="rounded bg-zinc-100 px-1">src/data/seed.ts</code>.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary">
            <Sparkles className="mr-2 h-4 w-4" /> Acciones rápidas
          </Button>
          <Button>
            <ArrowUpRight className="mr-2 h-4 w-4" /> Exportar resumen
          </Button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardBody>
            <div className="text-xs text-zinc-500">Ventas (rango demo)</div>
            <div className="mt-1 text-2xl font-semibold">{formatCurrencyARS(ventas)}</div>
            <div className="mt-2 text-xs text-zinc-600">Tickets: <span className="font-semibold">{tickets.length}</span></div>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <div className="text-xs text-zinc-500">Ticket promedio</div>
            <div className="mt-1 text-2xl font-semibold">{formatCurrencyARS(ticketProm)}</div>
            <div className="mt-2 text-xs text-zinc-600">Más útil por franja horaria</div>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <div className="text-xs text-zinc-500">Margen bruto estimado</div>
            <div className="mt-1 text-2xl font-semibold">{formatPercent(margen.pct)}</div>
            <div className="mt-2 text-xs text-zinc-600">Costo MP estimado: <span className="font-semibold">{formatCurrencyARS(margen.costo)}</span></div>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <div className="text-xs text-zinc-500">Merma (producción)</div>
            <div className="mt-1 text-2xl font-semibold">{formatPercent(merma.pct)}</div>
            <div className="mt-2 text-xs text-zinc-600">Merma total: <span className="font-semibold">{formatNumber(merma.merma)}</span> u</div>
          </CardBody>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Ventas por día" subtitle="Últimos puntos del rango demo (recharts)" />
          <CardBody>
            <SalesArea data={ventasSeries} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Alertas operativas" subtitle="Para priorizar acciones del día" />
          <CardBody className="space-y-3">
            <div className="flex items-start gap-3 rounded-2xl border border-zinc-200 bg-zinc-50 p-3">
              <PackageX className="mt-0.5 h-5 w-5 text-zinc-700" />
              <div>
                <div className="text-sm font-semibold">Stock bajo</div>
                {stockBajo.length === 0 ? (
                  <div className="mt-1 text-sm text-zinc-600">Todo OK ✅</div>
                ) : (
                  <div className="mt-1 text-sm text-zinc-600">
                    {stockBajo.slice(0, 3).map(s => (
                      <div key={s.nombre} className="flex items-center justify-between gap-3">
                        <span>{s.nombre}</span>
                        <Badge variant="warning">{s.actual} / min {s.min}</Badge>
                      </div>
                    ))}
                    {stockBajo.length > 3 ? <div className="mt-1 text-xs text-zinc-500">+{stockBajo.length - 3} más…</div> : null}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-2xl border border-zinc-200 bg-zinc-50 p-3">
              <Flame className="mt-0.5 h-5 w-5 text-zinc-700" />
              <div>
                <div className="text-sm font-semibold">Energía</div>
                <div className="mt-1 text-sm text-zinc-600">
                  Costo acumulado demo: <span className="font-semibold">{formatCurrencyARS(costoEnergia)}</span>
                </div>
                <div className="mt-2 text-xs text-zinc-500">
                  Tip: medí kWh/kg para comparar hornos y turnos.
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-zinc-200 bg-white p-3">
              <div className="text-sm font-semibold">Personal (turnos cargados)</div>
              <div className="mt-1 text-sm text-zinc-600">
                Turnos: <span className="font-semibold">{turnosPersonal.length}</span> · Empleados activos:{" "}
                <span className="font-semibold">{empleados.filter(e => e.activo).length}</span>
              </div>
            </div>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader title="Top productos por ventas" subtitle="Para decidir plan de producción / promos" />
        <CardBody>
          <TopProductsBar data={topProd} />
        </CardBody>
      </Card>
    </div>
  )
}
