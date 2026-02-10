"use client"

import { useMemo, useState } from "react"
import { insumos as seedInsumos, movimientosInventario as seedMovs } from "@/data/seed"
import type { Insumo, MovimientoInventario } from "@/lib/types"
import { Card, CardBody, CardHeader } from "@/components/ui/Card"
import Badge from "@/components/ui/Badge"
import Button from "@/components/ui/Button"
import Input from "@/components/ui/Input"
import Modal from "@/components/ui/Modal"
import Select from "@/components/ui/Select"
import { Table, TD, TH, THead, TR } from "@/components/ui/Table"
import { formatCurrencyARS, formatDateTime, formatNumber } from "@/lib/utils"
import { downloadCsv } from "@/lib/csv"
import { Download, Plus } from "lucide-react"

function nextId(prefix: string) {
  return `${prefix}-${Math.random().toString(16).slice(2, 8)}`
}

export default function InventarioView() {
  const [insumos, setInsumos] = useState<Insumo[]>(seedInsumos)
  const [movs, setMovs] = useState<MovimientoInventario[]>(seedMovs)
  const [q, setQ] = useState("")
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<{
    insumoId: string
    tipo: MovimientoInventario["tipo"]
    cantidad: string
    motivo: string
    referencia: string
  }>({
    insumoId: seedInsumos[0]?.id ?? "",
    tipo: "Entrada",
    cantidad: "10",
    motivo: "Compra proveedor",
    referencia: "FAC-0000"
  })

  const rows = useMemo(() => {
    return insumos
      .filter(i => (q.trim() ? i.nombre.toLowerCase().includes(q.toLowerCase()) : true))
      .map(i => {
        const bajo = i.stockActual <= i.stockMinimo
        const ratio = i.stockMinimo <= 0 ? 0 : i.stockActual / i.stockMinimo
        return { ...i, bajo, ratio }
      })
      .sort((a, b) => Number(b.bajo) - Number(a.bajo))
  }, [insumos, q])

  const movRows = useMemo(() => {
    return movs
      .map(m => ({ ...m, insumo: insumos.find(i => i.id === m.insumoId)?.nombre ?? m.insumoId }))
      .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())
  }, [movs, insumos])

  function aplicarMovimiento() {
    const cant = Number(form.cantidad)
    if (!Number.isFinite(cant) || cant === 0) return

    setInsumos(prev =>
      prev.map(i => {
        if (i.id !== form.insumoId) return i
        let nuevo = i.stockActual
        if (form.tipo === "Entrada") nuevo += cant
        if (form.tipo === "Salida") nuevo -= cant
        if (form.tipo === "Ajuste") nuevo += cant
        return { ...i, stockActual: Number(nuevo.toFixed(2)) }
      })
    )

    const movimiento: MovimientoInventario = {
      id: nextId("m"),
      fecha: new Date("2026-02-08T12:00:00-03:00").toISOString(),
      insumoId: form.insumoId,
      tipo: form.tipo,
      cantidad: cant,
      motivo: form.motivo,
      referencia: form.referencia || undefined
    }

    setMovs(prev => [movimiento, ...prev])
    setOpen(false)
  }

  function exportar() {
    downloadCsv(
      `inventario_panaderia_${new Date().toISOString().slice(0, 10)}.csv`,
      rows.map(r => ({
        id: r.id,
        nombre: r.nombre,
        unidad: r.unidad,
        proveedor: r.proveedor,
        costoUnitario: r.costoUnitario,
        stockActual: r.stockActual,
        stockMinimo: r.stockMinimo
      }))
    )
  }

  const stockBajo = rows.filter(r => r.bajo).length

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Inventario</h1>
          <p className="mt-1 text-sm text-zinc-600">Insumos, mínimos, movimientos y export (demo).</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={exportar}>
            <Download className="mr-2 h-4 w-4" /> Exportar CSV
          </Button>
          <Button onClick={() => setOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> Nuevo movimiento
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-4">
        <Card className="xl:col-span-3">
          <CardHeader
            title="Insumos"
            subtitle="Stock actual vs mínimo"
            right={
              <div className="w-[260px]">
                <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar insumo…" />
              </div>
            }
          />
          <CardBody className="p-0">
            <Table>
              <THead>
                <TR>
                  <TH>Insumo</TH>
                  <TH>Proveedor</TH>
                  <TH className="text-right">Costo</TH>
                  <TH className="text-right">Stock</TH>
                  <TH className="text-right">Mín.</TH>
                  <TH className="text-right">Estado</TH>
                </TR>
              </THead>
              <tbody>
                {rows.map(r => (
                  <TR key={r.id}>
                    <TD>
                      <div className="font-semibold">{r.nombre}</div>
                      <div className="text-xs text-zinc-500">{r.unidad}</div>
                    </TD>
                    <TD className="text-sm text-zinc-700">{r.proveedor}</TD>
                    <TD className="text-right">{formatCurrencyARS(r.costoUnitario)}</TD>
                    <TD className="text-right font-semibold">{formatNumber(r.stockActual)}</TD>
                    <TD className="text-right">{formatNumber(r.stockMinimo)}</TD>
                    <TD className="text-right">{r.bajo ? <Badge variant="warning">Bajo</Badge> : <Badge variant="success">OK</Badge>}</TD>
                  </TR>
                ))}
              </tbody>
            </Table>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Alertas" subtitle="Para compras del día" />
          <CardBody className="space-y-3">
            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
              <div className="text-xs text-zinc-500">Stock bajo</div>
              <div className="mt-1 text-2xl font-semibold">{stockBajo}</div>
              <div className="mt-2 text-xs text-zinc-600">de {rows.length} insumos</div>
            </div>
            <div className="rounded-2xl border border-zinc-200 bg-white p-4 text-sm text-zinc-700">
              Tip: sumá “días de cobertura” usando consumo promedio por receta/producción.
            </div>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader title="Movimientos" subtitle="Historial (demo)" />
        <CardBody className="p-0">
          <Table>
            <THead>
              <TR>
                <TH>Fecha</TH>
                <TH>Insumo</TH>
                <TH>Tipo</TH>
                <TH className="text-right">Cantidad</TH>
                <TH>Motivo</TH>
                <TH>Ref</TH>
              </TR>
            </THead>
            <tbody>
              {movRows.slice(0, 30).map(m => (
                <TR key={m.id}>
                  <TD>{formatDateTime(m.fecha)}</TD>
                  <TD className="font-semibold">{m.insumo}</TD>
                  <TD>
                    <Badge variant={m.tipo === "Entrada" ? "success" : m.tipo === "Salida" ? "danger" : "muted"}>
                      {m.tipo}
                    </Badge>
                  </TD>
                  <TD className="text-right">{formatNumber(m.cantidad)}</TD>
                  <TD className="text-sm text-zinc-700">{m.motivo}</TD>
                  <TD className="text-sm text-zinc-700">{m.referencia ?? "—"}</TD>
                </TR>
              ))}
            </tbody>
          </Table>
        </CardBody>
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title="Nuevo movimiento de inventario">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <div className="text-xs text-zinc-500">Insumo</div>
              <Select value={form.insumoId} onChange={e => setForm(s => ({ ...s, insumoId: e.target.value }))}>
                {insumos.map(i => (
                  <option key={i.id} value={i.id}>
                    {i.nombre}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <div className="text-xs text-zinc-500">Tipo</div>
              <Select value={form.tipo} onChange={e => setForm(s => ({ ...s, tipo: e.target.value as any }))}>
                <option>Entrada</option>
                <option>Salida</option>
                <option>Ajuste</option>
              </Select>
            </div>
            <div>
              <div className="text-xs text-zinc-500">Cantidad</div>
              <Input value={form.cantidad} onChange={e => setForm(s => ({ ...s, cantidad: e.target.value }))} />
            </div>
            <div className="col-span-2">
              <div className="text-xs text-zinc-500">Motivo</div>
              <Input value={form.motivo} onChange={e => setForm(s => ({ ...s, motivo: e.target.value }))} />
            </div>
            <div className="col-span-2">
              <div className="text-xs text-zinc-500">Referencia (opcional)</div>
              <Input value={form.referencia} onChange={e => setForm(s => ({ ...s, referencia: e.target.value }))} />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={aplicarMovimiento}>Aplicar</Button>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-600">
            Nota: esto actualiza stock <span className="font-semibold">solo en memoria</span> (sin DB).
          </div>
        </div>
      </Modal>
    </div>
  )
}
