"use client"

import { useMemo, useState } from "react"
import { empleados as seedEmpleados, turnosPersonal as seedTurnos } from "@/data/seed"
import type { Empleado, TurnoPersonal } from "@/lib/types"
import { Card, CardBody, CardHeader } from "@/components/ui/Card"
import Badge from "@/components/ui/Badge"
import Button from "@/components/ui/Button"
import Input from "@/components/ui/Input"
import Select from "@/components/ui/Select"
import { Table, TD, TH, THead, TR } from "@/components/ui/Table"
import { formatCurrencyARS, formatDateTime, formatNumber } from "@/lib/utils"
import { downloadCsv } from "@/lib/csv"
import HoursByRole from "@/components/charts/HoursByRole"
import { Download } from "lucide-react"

export default function PersonalView() {
  const [q, setQ] = useState("")
  const [rol, setRol] = useState<string>("Todos")
  const empleados = seedEmpleados
  const turnos = seedTurnos

  const empleadosMap = useMemo(() => new Map(empleados.map(e => [e.id, e])), [empleados])

  const rows = useMemo(() => {
    return turnos
      .map(t => {
        const e = empleadosMap.get(t.empleadoId)
        const costo = (e?.costoHora ?? 0) * t.horas
        return { ...t, empleado: e?.nombre ?? t.empleadoId, rol: e?.rol ?? "—", costo }
      })
      .filter(r => (rol === "Todos" ? true : r.rol === rol))
      .filter(r => (q.trim() ? r.empleado.toLowerCase().includes(q.toLowerCase()) : true))
      .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())
  }, [turnos, empleadosMap, q, rol])

  const totalHoras = rows.reduce((a, r) => a + r.horas, 0)
  const totalCosto = rows.reduce((a, r) => a + r.costo, 0)

  const horasPorRol = useMemo(() => {
    const map = new Map<string, number>()
    for (const r of rows) map.set(r.rol, (map.get(r.rol) ?? 0) + r.horas)
    return Array.from(map.entries()).map(([rol, horas]) => ({ rol, horas })).sort((a, b) => b.horas - a.horas)
  }, [rows])

  function exportar() {
    downloadCsv(
      `personal_panaderia_${new Date().toISOString().slice(0, 10)}.csv`,
      rows.map(r => ({
        id: r.id,
        fecha: r.fecha,
        empleado: r.empleado,
        rol: r.rol,
        horas: r.horas,
        costo: r.costo
      }))
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Personal</h1>
          <p className="mt-1 text-sm text-zinc-600">Turnos, horas, costo estimado y gráfico (demo).</p>
        </div>
        <Button variant="secondary" onClick={exportar}>
          <Download className="mr-2 h-4 w-4" /> Exportar CSV
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-4">
        <Card className="xl:col-span-3">
          <CardHeader
            title="Turnos cargados"
            subtitle="Filtrá por rol o nombre"
            right={
              <div className="flex gap-2">
                <div className="w-[160px]">
                  <Select value={rol} onChange={e => setRol(e.target.value)}>
                    <option>Todos</option>
                    <option>Panadero</option>
                    <option>Ayudante</option>
                    <option>Vendedor</option>
                    <option>Pastelero</option>
                    <option>Delivery</option>
                  </Select>
                </div>
                <div className="w-[220px]">
                  <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar persona…" />
                </div>
              </div>
            }
          />
          <CardBody className="p-0">
            <Table>
              <THead>
                <TR>
                  <TH>Fecha</TH>
                  <TH>Empleado</TH>
                  <TH>Rol</TH>
                  <TH className="text-right">Horas</TH>
                  <TH className="text-right">Costo</TH>
                </TR>
              </THead>
              <tbody>
                {rows.map(r => (
                  <TR key={r.id}>
                    <TD>{formatDateTime(r.fecha)}</TD>
                    <TD className="font-semibold">{r.empleado}</TD>
                    <TD>
                      <Badge variant="muted">{r.rol}</Badge>
                    </TD>
                    <TD className="text-right">{formatNumber(r.horas)}</TD>
                    <TD className="text-right font-semibold">{formatCurrencyARS(r.costo)}</TD>
                  </TR>
                ))}
              </tbody>
            </Table>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Resumen" subtitle="Del listado filtrado" />
          <CardBody className="space-y-3">
            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
              <div className="text-xs text-zinc-500">Horas</div>
              <div className="mt-1 text-2xl font-semibold">{formatNumber(totalHoras)}</div>
            </div>
            <div className="rounded-2xl border border-zinc-200 bg-white p-4">
              <div className="text-xs text-zinc-500">Costo</div>
              <div className="mt-1 text-xl font-semibold">{formatCurrencyARS(totalCosto)}</div>
              <div className="mt-2 text-xs text-zinc-500">Tip: compará costo laboral % vs ventas del período.</div>
            </div>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader title="Horas por rol" subtitle="Visual rápido" />
        <CardBody>
          <HoursByRole data={horasPorRol} />
        </CardBody>
      </Card>
    </div>
  )
}
