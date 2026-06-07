"use client"

import { useMemo, useState } from "react"
import { productos, tickets } from "@/data/seed"
import { ticketTotal } from "@/lib/kpi"
import { formatCurrencyARS, formatDateTime, formatNumber } from "@/lib/utils"
import { Card, CardBody, CardHeader } from "@/components/ui/Card"
import Input from "@/components/ui/Input"
import Select from "@/components/ui/Select"
import Button from "@/components/ui/Button"
import Drawer from "@/components/ui/Drawer"
import Badge from "@/components/ui/Badge"
import { Table, TD, TH, THead, TR } from "@/components/ui/Table"
import { downloadCsv } from "@/lib/csv"
import { Download, Receipt } from "lucide-react"

type Filtro = {
  q: string
  canal: string
  medioPago: string
}

function productoNombre(id: string) {
  return productos.find(p => p.id === id)?.nombre ?? id
}

export default function VentasView() {
  const [f, setF] = useState<Filtro>({ q: "", canal: "Todos", medioPago: "Todos" })
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const rows = useMemo(() => {
    return tickets
      .filter(t => (f.canal === "Todos" ? true : t.canal === f.canal))
      .filter(t => (f.medioPago === "Todos" ? true : t.medioPago === f.medioPago))
      .filter(t => {
        if (!f.q.trim()) return true
        const q = f.q.toLowerCase()
        const total = ticketTotal(t)
        const itemsText = t.items.map(it => productoNombre(it.productoId)).join(" ").toLowerCase()
        return t.id.toLowerCase().includes(q) || itemsText.includes(q) || String(total).includes(q)
      })
      .map(t => ({
        ...t,
        total: ticketTotal(t)
      }))
      .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())
  }, [f])

  const selected = useMemo(() => rows.find(r => r.id === selectedId) ?? null, [rows, selectedId])

  const ventas = rows.reduce((a, r) => a + r.total, 0)
  const ticketProm = rows.length ? ventas / rows.length : 0

  function exportar() {
    downloadCsv(
      `ventas_panaderia_${new Date().toISOString().slice(0, 10)}.csv`,
      rows.map(r => ({
        id: r.id,
        fecha: r.fecha,
        canal: r.canal,
        medioPago: r.medioPago,
        items: r.items.length,
        descuento: r.descuento,
        total: r.total
      }))
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Ventas</h1>
          <p className="mt-1 text-sm text-zinc-600">Tickets, detalle y export (demo hardcodeado).</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={exportar}>
            <Download className="mr-2 h-4 w-4" /> Exportar CSV
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-4">
        <Card className="xl:col-span-3">
          <CardHeader
            title="Listado de tickets"
            subtitle="Click en un ticket para ver el detalle"
            right={
              <div className="flex gap-2">
                <div className="w-[220px] hidden md:block">
                  <Input
                    value={f.q}
                    onChange={e => setF(s => ({ ...s, q: e.target.value }))}
                    placeholder="Buscar por producto / total / id…"
                  />
                </div>
                <div className="w-[140px]">
                  <Select value={f.canal} onChange={e => setF(s => ({ ...s, canal: e.target.value }))}>
                    <option>Todos</option>
                    <option>Mostrador</option>
                    <option>Delivery</option>
                    <option>Mayorista</option>
                  </Select>
                </div>
                <div className="w-[140px]">
                  <Select value={f.medioPago} onChange={e => setF(s => ({ ...s, medioPago: e.target.value }))}>
                    <option>Todos</option>
                    <option>Efectivo</option>
                    <option>Débito</option>
                    <option>Crédito</option>
                    <option>QR</option>
                  </Select>
                </div>
              </div>
            }
          />
          <CardBody className="p-0">
            <Table>
              <THead>
                <TR className="bg-white">
                  <TH>ID</TH>
                  <TH>Fecha</TH>
                  <TH>Canal</TH>
                  <TH>Medio</TH>
                  <TH className="text-right">Items</TH>
                  <TH className="text-right">Descuento</TH>
                  <TH className="text-right">Total</TH>
                </TR>
              </THead>
              <tbody>
                {rows.map(r => (
                  <TR
                    key={r.id}
                    onClick={() => setSelectedId(r.id)}
                    className={selectedId === r.id ? "bg-zinc-50" : ""}
                  >
                    <TD className="font-medium">{r.id}</TD>
                    <TD>{formatDateTime(r.fecha)}</TD>
                    <TD>
                      <Badge variant={r.canal === "Mayorista" ? "default" : r.canal === "Delivery" ? "muted" : "success"}>
                        {r.canal}
                      </Badge>
                    </TD>
                    <TD>{r.medioPago}</TD>
                    <TD className="text-right">{formatNumber(r.items.length)}</TD>
                    <TD className="text-right">{r.descuento ? formatCurrencyARS(r.descuento) : "—"}</TD>
                    <TD className="text-right font-semibold">{formatCurrencyARS(r.total)}</TD>
                  </TR>
                ))}
              </tbody>
            </Table>

            {rows.length === 0 ? <div className="p-6 text-sm text-zinc-600">No hay resultados con esos filtros.</div> : null}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Resumen" subtitle="Del listado filtrado" />
          <CardBody className="space-y-3">
            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
              <div className="text-xs text-zinc-500">Ventas</div>
              <div className="mt-1 text-xl font-semibold">{formatCurrencyARS(ventas)}</div>
            </div>
            <div className="rounded-2xl border border-zinc-200 bg-white p-4">
              <div className="text-xs text-zinc-500">Tickets</div>
              <div className="mt-1 text-xl font-semibold">{formatNumber(rows.length)}</div>
              <div className="mt-2 text-xs text-zinc-500">Ticket promedio</div>
              <div className="text-sm font-semibold">{formatCurrencyARS(ticketProm)}</div>
            </div>
            <div className="rounded-2xl border border-zinc-200 bg-white p-4">
              <div className="text-xs text-zinc-500">Idea</div>
              <div className="mt-1 text-sm text-zinc-700">
                Probá separar por <span className="font-semibold">franja horaria</span> para planificar hornadas.
              </div>
            </div>
          </CardBody>
        </Card>
      </div>

      <Drawer
        open={!!selected}
        onClose={() => setSelectedId(null)}
        title={selected ? `Ticket ${selected.id}` : "Ticket"}
        widthClass="max-w-2xl"
      >
        {selected ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-zinc-200 bg-white p-3">
                <div className="text-xs text-zinc-500">Fecha</div>
                <div className="text-sm font-semibold">{formatDateTime(selected.fecha)}</div>
              </div>
              <div className="rounded-2xl border border-zinc-200 bg-white p-3">
                <div className="text-xs text-zinc-500">Canal</div>
                <div className="text-sm font-semibold">{selected.canal}</div>
              </div>
              <div className="rounded-2xl border border-zinc-200 bg-white p-3">
                <div className="text-xs text-zinc-500">Medio de pago</div>
                <div className="text-sm font-semibold">{selected.medioPago}</div>
              </div>
              <div className="rounded-2xl border border-zinc-200 bg-white p-3">
                <div className="text-xs text-zinc-500">Total</div>
                <div className="text-sm font-semibold">{formatCurrencyARS(selected.total)}</div>
              </div>
            </div>

            <div className="rounded-2xl border border-zinc-200 bg-white">
              <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3">
                <div className="text-sm font-semibold flex items-center gap-2">
                  <Receipt className="h-4 w-4" /> Items
                </div>
                <Badge variant="muted">{selected.items.length} líneas</Badge>
              </div>
              <div className="p-4 space-y-2">
                {selected.items.map((it, idx) => (
                  <div key={idx} className="flex items-center justify-between gap-3 rounded-xl border border-zinc-200 px-3 py-2">
                    <div>
                      <div className="text-sm font-semibold">{productoNombre(it.productoId)}</div>
                      <div className="text-xs text-zinc-500">
                        {formatNumber(it.cantidad)} × {formatCurrencyARS(it.precioUnitario)}
                      </div>
                    </div>
                    <div className="text-sm font-semibold">{formatCurrencyARS(it.cantidad * it.precioUnitario)}</div>
                  </div>
                ))}
                {selected.descuento ? (
                  <div className="flex items-center justify-between rounded-xl bg-zinc-50 px-3 py-2">
                    <div className="text-sm text-zinc-700">Descuento</div>
                    <div className="text-sm font-semibold">- {formatCurrencyARS(selected.descuento)}</div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}
      </Drawer>
    </div>
  )
}
