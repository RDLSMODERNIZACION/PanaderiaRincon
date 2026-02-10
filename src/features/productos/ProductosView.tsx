"use client"

import { useMemo, useState } from "react"
import { productos as seedProductos, recetas, insumos, tickets } from "@/data/seed"
import type { Producto } from "@/lib/types"
import { Card, CardBody, CardHeader } from "@/components/ui/Card"
import Badge from "@/components/ui/Badge"
import Button from "@/components/ui/Button"
import Input from "@/components/ui/Input"
import Modal from "@/components/ui/Modal"
import Tabs from "@/components/ui/Tabs"
import { Table, TD, TH, THead, TR } from "@/components/ui/Table"
import { formatCurrencyARS, formatPercent } from "@/lib/utils"
import { downloadCsv } from "@/lib/csv"
import { Download, Pencil, ToggleLeft, ToggleRight } from "lucide-react"

function recetaCostoUnit(productoId: string) {
  const r = recetas.find(x => x.productoId === productoId)
  if (!r) return null
  const costoTotal = r.ingredientes.reduce((acc, ing) => {
    const ins = insumos.find(i => i.id === ing.insumoId)
    const c = (ins?.costoUnitario ?? 0) * ing.cantidad
    return acc + c
  }, 0)
  return costoTotal / r.rindeUnidades
}

function ventasPorProducto(productoId: string) {
  let u = 0
  let v = 0
  for (const t of tickets) {
    for (const it of t.items) {
      if (it.productoId === productoId) {
        u += it.cantidad
        v += it.cantidad * it.precioUnitario
      }
    }
  }
  return { unidades: u, ventas: v }
}

export default function ProductosView() {
  const [productos, setProductos] = useState<Producto[]>(seedProductos)
  const [q, setQ] = useState("")
  const [selected, setSelected] = useState<Producto | null>(null)
  const [edit, setEdit] = useState<{ precioVenta: string; costoUnitario: string } | null>(null)

  const rows = useMemo(() => {
    return productos
      .filter(p => (q.trim() ? p.nombre.toLowerCase().includes(q.toLowerCase()) : true))
      .map(p => {
        const margen = p.precioVenta <= 0 ? 0 : (p.precioVenta - p.costoUnitario) / p.precioVenta
        const recetaCost = recetaCostoUnit(p.id)
        const ventas = ventasPorProducto(p.id)
        return { ...p, margen, recetaCost, ventas }
      })
      .sort((a, b) => b.ventas.ventas - a.ventas.ventas)
  }, [productos, q])

  function toggleActivo(id: string) {
    setProductos(prev => prev.map(p => (p.id === id ? { ...p, activo: !p.activo } : p)))
  }

  function openEdit(p: Producto) {
    setSelected(p)
    setEdit({ precioVenta: String(p.precioVenta), costoUnitario: String(p.costoUnitario) })
  }

  function saveEdit() {
    if (!selected || !edit) return
    const precioVenta = Number(edit.precioVenta)
    const costoUnitario = Number(edit.costoUnitario)
    if (!Number.isFinite(precioVenta) || !Number.isFinite(costoUnitario)) return
    setProductos(prev => prev.map(p => (p.id === selected.id ? { ...p, precioVenta, costoUnitario } : p)))
    setSelected(null)
    setEdit(null)
  }

  function exportar() {
    downloadCsv(
      `productos_panaderia_${new Date().toISOString().slice(0, 10)}.csv`,
      rows.map(r => ({
        id: r.id,
        nombre: r.nombre,
        categoria: r.categoria,
        unidadVenta: r.unidadVenta,
        precioVenta: r.precioVenta,
        costoUnitario: r.costoUnitario,
        margenPct: r.margen,
        activo: r.activo ? "si" : "no"
      }))
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Productos</h1>
          <p className="mt-1 text-sm text-zinc-600">Precios, costos, margen, receta y ventas (demo).</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={exportar}>
            <Download className="mr-2 h-4 w-4" /> Exportar CSV
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader
          title="Catálogo"
          subtitle="Click en editar para abrir detalle con tabs"
          right={
            <div className="w-[260px]">
              <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar producto…" />
            </div>
          }
        />
        <CardBody className="p-0">
          <Table>
            <THead>
              <TR>
                <TH>Producto</TH>
                <TH>Categoría</TH>
                <TH className="text-right">Precio</TH>
                <TH className="text-right">Costo</TH>
                <TH className="text-right">Margen</TH>
                <TH className="text-right">Ventas</TH>
                <TH className="text-right">Estado</TH>
                <TH className="text-right">Acciones</TH>
              </TR>
            </THead>
            <tbody>
              {rows.map(r => (
                <TR key={r.id}>
                  <TD>
                    <div className="font-semibold">{r.nombre}</div>
                    <div className="text-xs text-zinc-500">{r.id}</div>
                  </TD>
                  <TD>
                    <Badge variant="muted">{r.categoria}</Badge>
                  </TD>
                  <TD className="text-right">{formatCurrencyARS(r.precioVenta)}</TD>
                  <TD className="text-right">{formatCurrencyARS(r.costoUnitario)}</TD>
                  <TD className="text-right font-semibold">{formatPercent(r.margen)}</TD>
                  <TD className="text-right">{formatCurrencyARS(r.ventas.ventas)}</TD>
                  <TD className="text-right">
                    {r.activo ? <Badge variant="success">Activo</Badge> : <Badge variant="danger">Pausado</Badge>}
                  </TD>
                  <TD className="text-right">
                    <div className="inline-flex gap-2">
                      <Button size="sm" variant="secondary" onClick={() => toggleActivo(r.id)}>
                        {r.activo ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
                      </Button>
                      <Button size="sm" onClick={() => openEdit(r)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </div>
                  </TD>
                </TR>
              ))}
            </tbody>
          </Table>
          {rows.length === 0 ? <div className="p-6 text-sm text-zinc-600">No hay productos que coincidan.</div> : null}
        </CardBody>
      </Card>

      <Modal
        open={!!selected}
        onClose={() => {
          setSelected(null)
          setEdit(null)
        }}
        title={selected ? `Editar ${selected.nombre}` : "Editar"}
      >
        {selected && edit ? (
          <div className="space-y-4">
            <Tabs
              tabs={[
                {
                  key: "info",
                  label: "Info",
                  content: (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <div className="text-xs text-zinc-500">Precio</div>
                        <Input
                          value={edit.precioVenta}
                          onChange={e => setEdit(s => (s ? { ...s, precioVenta: e.target.value } : s))}
                        />
                      </div>
                      <div>
                        <div className="text-xs text-zinc-500">Costo unitario</div>
                        <Input
                          value={edit.costoUnitario}
                          onChange={e => setEdit(s => (s ? { ...s, costoUnitario: e.target.value } : s))}
                        />
                      </div>
                      <div className="col-span-2 rounded-2xl border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-700">
                        Margen estimado:{" "}
                        <span className="font-semibold">
                          {formatPercent(
                            Number(edit.precioVenta) > 0
                              ? (Number(edit.precioVenta) - Number(edit.costoUnitario)) / Number(edit.precioVenta)
                              : 0
                          )}
                        </span>
                      </div>
                    </div>
                  )
                },
                {
                  key: "receta",
                  label: "Receta",
                  content: (() => {
                    const r = recetas.find(x => x.productoId === selected.id)
                    if (!r) return <div className="text-sm text-zinc-600">Este producto no tiene receta cargada (demo).</div>
                    const items = r.ingredientes.map(ing => {
                      const ins = insumos.find(i => i.id === ing.insumoId)
                      const costo = (ins?.costoUnitario ?? 0) * ing.cantidad
                      return { ...ing, nombre: ins?.nombre ?? ing.insumoId, costo }
                    })
                    const total = items.reduce((a, x) => a + x.costo, 0)
                    const unit = total / r.rindeUnidades
                    return (
                      <div className="space-y-3">
                        <div className="rounded-2xl border border-zinc-200 bg-white p-3 text-sm">
                          Rinde: <span className="font-semibold">{r.rindeUnidades}</span> · Costo receta:{" "}
                          <span className="font-semibold">{formatCurrencyARS(total)}</span> · Costo unit:{" "}
                          <span className="font-semibold">{formatCurrencyARS(unit)}</span>
                        </div>
                        <div className="space-y-2">
                          {items.map((it, idx) => (
                            <div key={idx} className="flex items-center justify-between rounded-xl border border-zinc-200 px-3 py-2">
                              <div>
                                <div className="text-sm font-semibold">{it.nombre}</div>
                                <div className="text-xs text-zinc-500">
                                  {it.cantidad} {it.unidad} ×{" "}
                                  {formatCurrencyARS(insumos.find(i => i.id === it.insumoId)?.costoUnitario ?? 0)}
                                </div>
                              </div>
                              <div className="text-sm font-semibold">{formatCurrencyARS(it.costo)}</div>
                            </div>
                          ))}
                        </div>
                        <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-600">
                          Tip: si el costo por receta difiere del “costo unitario” del producto, revisá desperdicio, energía, mano de obra o rendimiento real.
                        </div>
                      </div>
                    )
                  })()
                },
                {
                  key: "ventas",
                  label: "Ventas",
                  content: (() => {
                    const v = ventasPorProducto(selected.id)
                    return (
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <div className="rounded-2xl border border-zinc-200 bg-white p-3">
                            <div className="text-xs text-zinc-500">Unidades vendidas</div>
                            <div className="text-sm font-semibold">{v.unidades}</div>
                          </div>
                          <div className="rounded-2xl border border-zinc-200 bg-white p-3">
                            <div className="text-xs text-zinc-500">Ventas</div>
                            <div className="text-sm font-semibold">{formatCurrencyARS(v.ventas)}</div>
                          </div>
                        </div>
                        <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-700">
                          Este tab es una mini idea: podés sumar “ventas por franja” o “ventas por canal” acá.
                        </div>
                      </div>
                    )
                  })()
                }
              ]}
            />

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="secondary"
                onClick={() => {
                  setSelected(null)
                  setEdit(null)
                }}
              >
                Cancelar
              </Button>
              <Button onClick={saveEdit}>Guardar (en memoria)</Button>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  )
}
