"use client"

import { useEffect, useMemo, useState } from "react"
import { Minus, Plus, Save, X } from "lucide-react"
import Button from "@/components/ui/Button"
import Input from "@/components/ui/Input"
import Select from "@/components/ui/Select"
import { apiPost, type ApiSession } from "@/lib/api"

type RepartidorStock = {
  id: string
  productId?: string
  product_id?: string
  productNombre?: string
  product_nombre?: string
  unidadVenta?: string
  unidad_venta?: string
  precioVenta?: number
  precio_venta?: number
  cantidadRestante?: number
  cantidad_restante?: number
}

type RepartidorCustomer = {
  customerId?: string
  customer_id?: string
  nombre?: string
  direccion?: string | null
  telefono?: string | null
}

type Props = {
  open: boolean
  runId: string
  customer: RepartidorCustomer | null
  stock: RepartidorStock[]
  session: ApiSession | null
  onClose: () => void
  onSaved: () => Promise<void> | void
}

function productId(item: RepartidorStock) {
  return String(item.productId || item.product_id || "")
}

function productName(item: RepartidorStock) {
  return String(item.productNombre || item.product_nombre || productId(item))
}

function productUnit(item: RepartidorStock) {
  return String(item.unidadVenta || item.unidad_venta || "")
}

function productPrice(item: RepartidorStock) {
  return Number(item.precioVenta ?? item.precio_venta ?? 0)
}

function productRemaining(item: RepartidorStock) {
  return Number(item.cantidadRestante ?? item.cantidad_restante ?? 0)
}

function customerId(customer: RepartidorCustomer | null) {
  return String(customer?.customerId || customer?.customer_id || "")
}

function numberFromInput(value: string) {
  if (value.trim() === "") return 0
  const n = Number(value)
  return Number.isFinite(n) ? n : NaN
}

function normalizeNumber(value: number) {
  if (!Number.isFinite(value)) return "0"
  if (value < 0) return "0"
  return String(Number(value.toFixed(2)))
}

function stepForProduct(item: RepartidorStock) {
  const unit = productUnit(item).toLowerCase()
  if (unit === "kg") return 0.5
  return 1
}

function money(value: number) {
  return `$ ${Number(value || 0).toLocaleString("es-AR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  })}`
}

export default function VisitModal({
  open,
  runId,
  customer,
  stock,
  session,
  onClose,
  onSaved
}: Props) {
  const [quantities, setQuantities] = useState<Record<string, string>>({})
  const [panViejoKg, setPanViejoKg] = useState("0")
  const [metodo, setMetodo] = useState("efectivo")
  const [montoPagado, setMontoPagado] = useState("0")
  const [showNotes, setShowNotes] = useState(false)
  const [observaciones, setObservaciones] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return

    const next: Record<string, string> = {}

    for (const item of stock) {
      next[productId(item)] = "0"
    }

    setQuantities(next)
    setPanViejoKg("0")
    setMetodo("efectivo")
    setMontoPagado("0")
    setShowNotes(false)
    setObservaciones("")
    setError(null)
  }, [open, stock])

  const computedTotal = useMemo(() => {
    return stock.reduce((sum, item) => {
      const id = productId(item)
      const cantidad = numberFromInput(quantities[id] || "0")
      const price = productPrice(item)

      if (!Number.isFinite(cantidad) || cantidad <= 0) return sum
      return sum + cantidad * price
    }, 0)
  }, [stock, quantities])

  const hasDeliveredQuantity = useMemo(() => {
    return stock.some(item => {
      const id = productId(item)
      const cantidad = numberFromInput(quantities[id] || "0")
      return Number.isFinite(cantidad) && cantidad > 0
    })
  }, [stock, quantities])

  const hasMissingPrices = useMemo(() => {
    return stock.some(item => {
      const id = productId(item)
      const cantidad = numberFromInput(quantities[id] || "0")
      return Number.isFinite(cantidad) && cantidad > 0 && productPrice(item) <= 0
    })
  }, [stock, quantities])

  const deuda = useMemo(() => {
    const paid = numberFromInput(montoPagado)

    if (!Number.isFinite(paid)) return 0
    return Math.max(computedTotal - paid, 0)
  }, [computedTotal, montoPagado])

  function setProductQuantity(id: string, value: string) {
    setQuantities(current => ({
      ...current,
      [id]: value
    }))
  }

  function changeProductQuantity(item: RepartidorStock, delta: number) {
    const id = productId(item)
    const current = numberFromInput(quantities[id] || "0")
    const safeCurrent = Number.isFinite(current) ? current : 0
    const next = safeCurrent + delta

    setProductQuantity(id, normalizeNumber(next))
  }

  function changePanViejo(delta: number) {
    const current = numberFromInput(panViejoKg)
    const safeCurrent = Number.isFinite(current) ? current : 0
    setPanViejoKg(normalizeNumber(safeCurrent + delta))
  }

  async function saveVisit() {
    if (!session || !runId || !customerId(customer)) return

    const paid = numberFromInput(montoPagado)
    const panViejo = numberFromInput(panViejoKg)

    if (!Number.isFinite(paid) || paid < 0) {
      setError("Ingresá un monto pagado válido.")
      return
    }

    if (!Number.isFinite(panViejo) || panViejo < 0) {
      setError("Ingresá una cantidad válida de pan viejo.")
      return
    }

    const items = stock
      .map(item => {
        const id = productId(item)
        const cantidad = numberFromInput(quantities[id] || "0")

        return {
          product_id: id,
          cantidad,
          precio_unitario: productPrice(item),
          tipo: "venta"
        }
      })
      .filter(item => item.product_id && Number.isFinite(item.cantidad) && item.cantidad > 0)

    for (const item of stock) {
      const id = productId(item)
      const cantidad = numberFromInput(quantities[id] || "0")
      const restante = productRemaining(item)

      if (Number.isFinite(cantidad) && cantidad > restante) {
        setError(`No podés dejar más ${productName(item)} que lo disponible. Disponible: ${restante}.`)
        return
      }
    }

    setSaving(true)
    setError(null)

    try {
      await apiPost(
        session,
        `/api/repartidor/mi-reparto/${encodeURIComponent(runId)}/clientes/${encodeURIComponent(customerId(customer))}/visita`,
        {
          items,
          metodo,
          monto_pagado: paid,
          total_venta: computedTotal,
          pan_viejo_kg: panViejo,
          observaciones: observaciones.trim() || undefined,
          gps_ok: false
        }
      )

      await onSaved()
    } catch (exc: any) {
      setError(exc?.message || "No se pudo guardar la visita")
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      <div className="absolute inset-0 grid place-items-center p-3">
        <div className="flex max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-2xl">
          <div className="flex items-start justify-between gap-4 border-b border-zinc-100 px-5 py-4">
            <div>
              <div className="text-xl font-semibold text-zinc-900">
                {customer?.nombre || "Cliente"}
              </div>

              {customer?.direccion ? (
                <div className="mt-1 text-sm text-zinc-500">
                  {customer.direccion}
                </div>
              ) : null}

              {customer?.telefono ? (
                <div className="mt-1 text-xs text-zinc-500">
                  {customer.telefono}
                </div>
              ) : null}
            </div>

            <button type="button" className="rounded-xl p-2 hover:bg-zinc-100" onClick={onClose}>
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
            <div className="rounded-2xl border border-zinc-200">
              <div className="border-b border-zinc-100 px-4 py-3">
                <div className="text-base font-semibold text-zinc-900">Mercadería dejada</div>
                <div className="text-xs text-zinc-500">Cargá solo lo que quedó en el comercio.</div>
              </div>

              {stock.length === 0 ? (
                <div className="px-4 py-5 text-sm text-zinc-500">
                  No hay mercadería asignada al reparto.
                </div>
              ) : (
                <div className="divide-y divide-zinc-100">
                  {stock.map(item => {
                    const id = productId(item)
                    const cantidad = quantities[id] ?? "0"
                    const step = stepForProduct(item)

                    return (
                      <div key={id} className="grid grid-cols-[1fr_auto] gap-3 px-4 py-4">
                        <div className="min-w-0">
                          <div className="text-lg font-semibold text-zinc-900">{productName(item)}</div>
                          <div className="mt-1 text-xs text-zinc-500">
                            {productUnit(item) || "-"} · Disponible: {productRemaining(item)}
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            disabled={saving}
                            onClick={() => changeProductQuantity(item, -step)}
                            className="grid h-12 w-12 place-items-center rounded-2xl border border-zinc-200 bg-white text-zinc-900 shadow-sm hover:bg-zinc-50 disabled:opacity-40"
                          >
                            <Minus className="h-5 w-5" />
                          </button>

                          <Input
                            type="number"
                            step="any"
                            min="0"
                            value={cantidad}
                            onChange={e => setProductQuantity(id, e.target.value)}
                            className="h-12 w-24 text-center text-lg font-semibold"
                          />

                          <button
                            type="button"
                            disabled={saving}
                            onClick={() => changeProductQuantity(item, step)}
                            className="grid h-12 w-12 place-items-center rounded-2xl bg-zinc-900 text-white shadow-sm hover:bg-zinc-800 disabled:opacity-40"
                          >
                            <Plus className="h-5 w-5" />
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            <div className="grid gap-4 md:grid-cols-[0.9fr_1.1fr]">
              <div className="rounded-2xl border border-zinc-200 p-4">
                <div className="text-base font-semibold text-zinc-900">Pan viejo</div>
                <div className="text-xs text-zinc-500">Pan que el comercio devuelve.</div>

                <div className="mt-4 flex items-center gap-2">
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => changePanViejo(-0.5)}
                    className="grid h-12 w-12 place-items-center rounded-2xl border border-zinc-200 bg-white text-zinc-900 shadow-sm hover:bg-zinc-50 disabled:opacity-40"
                  >
                    <Minus className="h-5 w-5" />
                  </button>

                  <Input
                    type="number"
                    step="any"
                    min="0"
                    value={panViejoKg}
                    onChange={e => setPanViejoKg(e.target.value)}
                    className="h-12 text-center text-lg font-semibold"
                  />

                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => changePanViejo(0.5)}
                    className="grid h-12 w-12 place-items-center rounded-2xl bg-zinc-900 text-white shadow-sm hover:bg-zinc-800 disabled:opacity-40"
                  >
                    <Plus className="h-5 w-5" />
                  </button>
                </div>

                <div className="mt-2 text-xs text-zinc-500">Kg recibidos.</div>
              </div>

              <div className="rounded-2xl border border-zinc-200 p-4">
                <div className="text-base font-semibold text-zinc-900">Cobro</div>
                <div className="text-xs text-zinc-500">El total se calcula por mercadería y precios.</div>

                <div className="mt-4 rounded-2xl bg-zinc-50 px-4 py-3">
                  <div className="text-xs text-zinc-500">Total venta calculado</div>
                  <div className="text-2xl font-semibold text-zinc-900">{money(computedTotal)}</div>

                  {hasDeliveredQuantity && hasMissingPrices ? (
                    <div className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">
                      Hay productos sin precio. El total puede quedar en $0 hasta cargar precios.
                    </div>
                  ) : null}
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <label className="block">
                    <span className="mb-1 block text-xs font-medium text-zinc-600">Pagó</span>
                    <Input
                      type="number"
                      step="any"
                      min="0"
                      value={montoPagado}
                      onChange={e => setMontoPagado(e.target.value)}
                      placeholder="0"
                      className="h-12 text-lg font-semibold"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-1 block text-xs font-medium text-zinc-600">Método</span>
                    <Select value={metodo} onChange={e => setMetodo(e.target.value)} className="h-12">
                      <option value="efectivo">Efectivo</option>
                      <option value="transferencia">Transferencia</option>
                      <option value="mercado_pago">Mercado Pago</option>
                      <option value="qr">QR</option>
                      <option value="otro">Otro</option>
                    </Select>
                  </label>
                </div>

                <div className="mt-4 rounded-2xl bg-zinc-50 px-4 py-3">
                  <div className="text-xs text-zinc-500">Queda debiendo</div>
                  <div className="text-2xl font-semibold text-zinc-900">{money(deuda)}</div>
                </div>
              </div>
            </div>

            <div>
              <button
                type="button"
                onClick={() => setShowNotes(value => !value)}
                className="text-sm font-medium text-zinc-700 underline"
              >
                {showNotes ? "Ocultar observación" : "+ Agregar observación"}
              </button>

              {showNotes ? (
                <textarea
                  value={observaciones}
                  onChange={e => setObservaciones(e.target.value)}
                  className="mt-2 min-h-[90px] w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-300"
                  placeholder="Comentario opcional..."
                />
              ) : null}
            </div>

            {error ? (
              <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            ) : null}
          </div>

          <div className="flex justify-end gap-2 border-t border-zinc-100 px-5 py-4">
            <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
              Cancelar
            </Button>

            <Button type="button" onClick={saveVisit} disabled={saving}>
              <Save className="mr-2 h-4 w-4" />
              {saving ? "Guardando..." : "Guardar visita"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}