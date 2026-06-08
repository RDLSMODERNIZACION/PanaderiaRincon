"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Minus, PackageCheck, Plus, RotateCcw, Save } from "lucide-react"
import Button from "@/components/ui/Button"
import Input from "@/components/ui/Input"
import Modal from "@/components/ui/Modal"
import { LoadingBlock } from "@/components/data/AsyncState"
import { apiDelete, apiGet, apiPatch, apiPost, type ApiSession, unwrapData } from "@/lib/api"
import type { RowData } from "@/features/crud/types"

type StockItem = RowData & {
  product?: RowData
}

type Props = {
  open: boolean
  run: RowData | null
  session: ApiSession | null
  onClose: () => void
  onChanged?: () => void
}

function rowLabel(row: RowData) {
  return String(row.nombre || row.name || row.email || row.descripcion || row.id || "")
}

function runIdOf(row: RowData) {
  return String(row.delivery_run_id || row.deliveryRunId || "")
}

function productIdOf(row: RowData) {
  return String(row.product_id || row.productId || "")
}

function loadedQuantity(row: RowData) {
  const raw = row.cantidad_cargada ?? row.cantidadCargada ?? 0
  const n = Number(raw)
  return Number.isFinite(n) ? n : 0
}

function productUnit(row: RowData) {
  return String(row.unidad_venta || row.unidadVenta || "")
}

function formatDate(value: unknown) {
  if (!value) return "-"
  const text = String(value)

  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    const [year, month, day] = text.split("-")
    return `${day}/${month}/${year}`
  }

  const d = new Date(text)
  if (Number.isNaN(d.getTime())) return text
  return d.toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" })
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

function stepForProduct(product: RowData) {
  const unit = productUnit(product).toLowerCase()

  if (unit === "kg") return 0.5

  return 1
}

export default function RunStockModal({
  open,
  run,
  session,
  onClose,
  onChanged
}: Props) {
  const [items, setItems] = useState<StockItem[]>([])
  const [products, setProducts] = useState<RowData[]>([])
  const [quantities, setQuantities] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const runId = run?.id ? String(run.id) : ""

  const stockByProductId = useMemo(() => {
    const map = new Map<string, StockItem>()

    for (const item of items) {
      const productId = productIdOf(item)
      if (productId) map.set(productId, item)
    }

    return map
  }, [items])

  const activeProducts = useMemo(() => {
    return products
      .filter(product => product.activo !== false)
      .sort((a, b) => rowLabel(a).localeCompare(rowLabel(b)))
  }, [products])

  const totalLoaded = useMemo(() => {
    return activeProducts.reduce((sum, product) => {
      const productId = String(product.id)
      const cantidad = numberFromInput(quantities[productId] || "0")
      return sum + (Number.isFinite(cantidad) && cantidad > 0 ? cantidad : 0)
    }, 0)
  }, [activeProducts, quantities])

  const assignedCount = useMemo(() => {
    return activeProducts.filter(product => {
      const productId = String(product.id)
      const cantidad = numberFromInput(quantities[productId] || "0")
      return Number.isFinite(cantidad) && cantidad > 0
    }).length
  }, [activeProducts, quantities])

  const loadDetails = useCallback(async () => {
    if (!session || !runId) return

    setLoading(true)
    setError(null)

    try {
      const [stockPayload, productsPayload] = await Promise.all([
        apiGet(session, "/api/admin/crud/delivery_run_stock?limit=1000"),
        apiGet(session, "/api/admin/crud/products?limit=1000")
      ])

      const stockRows = unwrapData<RowData[]>(stockPayload) || []
      const productRows = unwrapData<RowData[]>(productsPayload) || []
      const productById = new Map(productRows.map(product => [String(product.id), product]))

      const runItems = stockRows
        .filter(item => runIdOf(item) === runId)
        .map(item => ({
          ...item,
          product: productById.get(productIdOf(item))
        }))

      const nextQuantities: Record<string, string> = {}

      for (const product of productRows) {
        nextQuantities[String(product.id)] = "0"
      }

      for (const item of runItems) {
        const productId = productIdOf(item)
        if (productId) nextQuantities[productId] = String(loadedQuantity(item))
      }

      setProducts(productRows)
      setItems(runItems)
      setQuantities(nextQuantities)
    } catch (exc: any) {
      setError(exc?.message || "No se pudo cargar la mercadería del reparto")
    } finally {
      setLoading(false)
    }
  }, [session, runId])

  useEffect(() => {
    if (open) loadDetails()
  }, [open, loadDetails])

  async function refreshAfterChange() {
    await loadDetails()
    onChanged?.()
  }

  function setProductQuantity(productId: string, value: string) {
    setQuantities(current => ({
      ...current,
      [productId]: value
    }))
  }

  function changeProductQuantity(product: RowData, delta: number) {
    const productId = String(product.id)
    const current = numberFromInput(quantities[productId] || "0")
    const safeCurrent = Number.isFinite(current) ? current : 0
    const next = safeCurrent + delta

    setProductQuantity(productId, normalizeNumber(next))
  }

  function resetAllToZero() {
    const next: Record<string, string> = {}

    for (const product of activeProducts) {
      next[String(product.id)] = "0"
    }

    setQuantities(next)
  }

  async function saveAll() {
    if (!session || !runId) return

    setSaving(true)
    setError(null)

    try {
      for (const product of activeProducts) {
        const productId = String(product.id)
        const existing = stockByProductId.get(productId)
        const cantidad = numberFromInput(quantities[productId] || "0")

        if (!Number.isFinite(cantidad) || cantidad < 0) {
          throw new Error(`Cantidad inválida en ${rowLabel(product)}.`)
        }

        if (cantidad > 0 && existing?.id) {
          await apiPatch(session, `/api/admin/crud/delivery_run_stock/${encodeURIComponent(String(existing.id))}`, {
            cantidad_cargada: cantidad,
            cantidad_esperada: cantidad,
            cantidad_devuelta_real: 0,
            diferencia: 0
          })
        }

        if (cantidad > 0 && !existing?.id) {
          await apiPost(session, "/api/admin/crud/delivery_run_stock", {
            delivery_run_id: runId,
            product_id: productId,
            cantidad_cargada: cantidad,
            cantidad_devuelta_real: 0,
            cantidad_esperada: cantidad,
            diferencia: 0
          })
        }

        if (cantidad === 0 && existing?.id) {
          await apiDelete(session, `/api/admin/crud/delivery_run_stock/${encodeURIComponent(String(existing.id))}`)
        }
      }

      await refreshAfterChange()
    } catch (exc: any) {
      setError(exc?.message || "No se pudo guardar la mercadería")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={`Mercadería · ${run?.id ? String(run.id) : ""}`}>
      <div className="space-y-5">
        <div className="grid gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm md:grid-cols-3">
          <div>
            <div className="text-xs font-medium text-zinc-500">Fecha</div>
            <div className="mt-1 font-semibold text-zinc-900">{formatDate(run?.fecha || run?.date)}</div>
          </div>

          <div>
            <div className="text-xs font-medium text-zinc-500">Estado</div>
            <div className="mt-1 font-semibold text-zinc-900">{String(run?.estado || "-")}</div>
          </div>

          <div>
            <div className="text-xs font-medium text-zinc-500">Total cargado</div>
            <div className="mt-1 font-semibold text-zinc-900">{totalLoaded}</div>
          </div>
        </div>

        {loading ? <LoadingBlock /> : null}

        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        {!loading ? (
          <>
            <div className="rounded-xl border border-zinc-200">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-100 px-4 py-3">
                <div>
                  <div className="text-sm font-semibold text-zinc-900">Carga de mercadería</div>
                  <div className="text-xs text-zinc-500">
                    {assignedCount} producto(s) cargados. Los productos en cero no se asignan.
                  </div>
                </div>

                <PackageCheck className="h-5 w-5 text-zinc-400" />
              </div>

              {activeProducts.length === 0 ? (
                <div className="px-4 py-6 text-sm text-zinc-500">
                  No hay productos activos cargados.
                </div>
              ) : (
                <div className="max-h-[460px] overflow-auto">
                  <div className="divide-y divide-zinc-100">
                    {activeProducts.map(product => {
                      const productId = String(product.id)
                      const cantidad = quantities[productId] ?? "0"
                      const step = stepForProduct(product)

                      return (
                        <div key={productId} className="grid grid-cols-[1fr_auto] gap-3 px-4 py-3">
                          <div className="min-w-0">
                            <div className="font-medium text-zinc-900">{rowLabel(product)}</div>
                            <div className="mt-1 text-xs text-zinc-500">
                              Unidad: {productUnit(product) || "-"}
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              disabled={saving}
                              onClick={() => changeProductQuantity(product, -step)}
                              className="grid h-11 w-11 place-items-center rounded-xl border border-zinc-200 bg-white text-zinc-900 shadow-sm hover:bg-zinc-50 disabled:opacity-40"
                              aria-label={`Restar ${rowLabel(product)}`}
                            >
                              <Minus className="h-5 w-5" />
                            </button>

                            <Input
                              type="number"
                              step="any"
                              min="0"
                              value={cantidad}
                              onChange={e => setProductQuantity(productId, e.target.value)}
                              className="h-11 w-24 text-center text-base font-semibold"
                            />

                            <button
                              type="button"
                              disabled={saving}
                              onClick={() => changeProductQuantity(product, step)}
                              className="grid h-11 w-11 place-items-center rounded-xl bg-zinc-900 text-white shadow-sm hover:bg-zinc-800 disabled:opacity-40"
                              aria-label={`Sumar ${rowLabel(product)}`}
                            >
                              <Plus className="h-5 w-5" />
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-wrap justify-end gap-2 border-t border-zinc-100 pt-4">
              <Button type="button" variant="secondary" disabled={saving} onClick={resetAllToZero}>
                <RotateCcw className="mr-2 h-4 w-4" /> Poner todo en cero
              </Button>

              <Button type="button" disabled={saving || activeProducts.length === 0} onClick={saveAll}>
                {saving ? (
                  "Guardando..."
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" /> Guardar mercadería
                  </>
                )}
              </Button>
            </div>

            <div className="rounded-xl bg-zinc-50 px-3 py-2 text-xs text-zinc-500">
              Administración carga únicamente la mercadería que sale con el repartidor. La devolución y diferencia se calculan después en la rendición.
            </div>
          </>
        ) : null}
      </div>
    </Modal>
  )
}