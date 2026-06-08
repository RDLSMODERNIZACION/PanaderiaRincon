"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { PackagePlus, Save, Trash2 } from "lucide-react"
import Button from "@/components/ui/Button"
import Input from "@/components/ui/Input"
import Modal from "@/components/ui/Modal"
import Select from "@/components/ui/Select"
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

function returnedQuantity(row: RowData) {
  const raw = row.cantidad_devuelta_real ?? row.cantidadDevueltaReal ?? 0
  const n = Number(raw)
  return Number.isFinite(n) ? n : 0
}

function expectedQuantity(row: RowData) {
  const raw = row.cantidad_esperada ?? row.cantidadEsperada ?? loadedQuantity(row)
  const n = Number(raw)
  return Number.isFinite(n) ? n : loadedQuantity(row)
}

function differenceQuantity(row: RowData) {
  const raw = row.diferencia ?? 0
  const n = Number(raw)
  return Number.isFinite(n) ? n : 0
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

export default function RunStockModal({
  open,
  run,
  session,
  onClose,
  onChanged
}: Props) {
  const [items, setItems] = useState<StockItem[]>([])
  const [products, setProducts] = useState<RowData[]>([])
  const [selectedProductId, setSelectedProductId] = useState("")
  const [quantity, setQuantity] = useState("")
  const [draftQuantities, setDraftQuantities] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const runId = run?.id ? String(run.id) : ""

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
        .sort((a, b) => rowLabel(a.product || a).localeCompare(rowLabel(b.product || b)))

      const nextDrafts: Record<string, string> = {}
      for (const item of runItems) {
        if (item.id) nextDrafts[String(item.id)] = String(loadedQuantity(item))
      }

      setProducts(productRows.filter(product => product.activo !== false))
      setItems(runItems)
      setDraftQuantities(nextDrafts)
    } catch (exc: any) {
      setError(exc?.message || "No se pudo cargar la mercadería del reparto")
    } finally {
      setLoading(false)
    }
  }, [session, runId])

  useEffect(() => {
    if (open) {
      setSelectedProductId("")
      setQuantity("")
      loadDetails()
    }
  }, [open, loadDetails])

  const usedProductIds = useMemo(() => {
    return new Set(items.map(item => productIdOf(item)).filter(Boolean))
  }, [items])

  const availableProducts = useMemo(() => {
    return products.filter(product => !usedProductIds.has(String(product.id)))
  }, [products, usedProductIds])

  const totalLoaded = useMemo(() => {
    return items.reduce((sum, item) => sum + loadedQuantity(item), 0)
  }, [items])

  async function refreshAfterChange() {
    await loadDetails()
    onChanged?.()
  }

  async function addProduct() {
    if (!session || !runId || !selectedProductId) return

    const cantidad = Number(quantity)

    if (!Number.isFinite(cantidad) || cantidad <= 0) {
      setError("Ingresá una cantidad válida.")
      return
    }

    setSaving(true)
    setError(null)

    try {
      await apiPost(session, "/api/admin/crud/delivery_run_stock", {
        delivery_run_id: runId,
        product_id: selectedProductId,
        cantidad_cargada: cantidad,
        cantidad_devuelta_real: 0,
        cantidad_esperada: cantidad,
        diferencia: 0
      })

      setSelectedProductId("")
      setQuantity("")
      await refreshAfterChange()
    } catch (exc: any) {
      setError(exc?.message || "No se pudo agregar la mercadería")
    } finally {
      setSaving(false)
    }
  }

  async function updateQuantity(item: StockItem) {
    if (!session || !item.id) return

    const cantidad = Number(draftQuantities[String(item.id)] ?? "")

    if (!Number.isFinite(cantidad) || cantidad < 0) {
      setError("Ingresá una cantidad válida.")
      return
    }

    setSaving(true)
    setError(null)

    try {
      await apiPatch(session, `/api/admin/crud/delivery_run_stock/${encodeURIComponent(String(item.id))}`, {
        cantidad_cargada: cantidad,
        cantidad_esperada: cantidad
      })

      await refreshAfterChange()
    } catch (exc: any) {
      setError(exc?.message || "No se pudo actualizar la cantidad")
    } finally {
      setSaving(false)
    }
  }

  async function removeItem(item: StockItem) {
    if (!session || !item.id) return

    const label = item.product ? rowLabel(item.product) : "este producto"
    if (!window.confirm(`¿Quitar ${label} de la mercadería del reparto?`)) return

    setSaving(true)
    setError(null)

    try {
      await apiDelete(session, `/api/admin/crud/delivery_run_stock/${encodeURIComponent(String(item.id))}`)
      await refreshAfterChange()
    } catch (exc: any) {
      setError(exc?.message || "No se pudo quitar la mercadería")
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
              <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3">
                <div>
                  <div className="text-sm font-semibold text-zinc-900">Mercadería cargada</div>
                  <div className="text-xs text-zinc-500">{items.length} producto(s) asignados al reparto</div>
                </div>
                <PackagePlus className="h-5 w-5 text-zinc-400" />
              </div>

              {items.length === 0 ? (
                <div className="px-4 py-6 text-sm text-zinc-500">
                  Todavía no se cargó mercadería para este reparto.
                </div>
              ) : (
                <div className="max-h-[280px] overflow-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="border-b border-zinc-100 bg-zinc-50 text-xs font-medium text-zinc-500">
                      <tr>
                        <th className="px-4 py-2">Producto</th>
                        <th className="px-4 py-2">Cargado</th>
                        <th className="px-4 py-2">Devuelto</th>
                        <th className="px-4 py-2">Esperado</th>
                        <th className="px-4 py-2">Diferencia</th>
                        <th className="px-4 py-2 text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {items.map(item => (
                        <tr key={String(item.id)}>
                          <td className="px-4 py-2 font-medium text-zinc-900">
                            {item.product ? rowLabel(item.product) : productIdOf(item)}
                          </td>
                          <td className="px-4 py-2">
                            <Input
                              type="number"
                              step="any"
                              value={draftQuantities[String(item.id)] ?? ""}
                              onChange={e => setDraftQuantities(v => ({ ...v, [String(item.id)]: e.target.value }))}
                              className="h-9 w-28"
                            />
                          </td>
                          <td className="px-4 py-2 text-zinc-600">{returnedQuantity(item)}</td>
                          <td className="px-4 py-2 text-zinc-600">{expectedQuantity(item)}</td>
                          <td className="px-4 py-2 text-zinc-600">{differenceQuantity(item)}</td>
                          <td className="px-4 py-2">
                            <div className="flex justify-end gap-1">
                              <button
                                type="button"
                                className="rounded-lg p-2 text-zinc-700 hover:bg-zinc-100 disabled:opacity-40"
                                disabled={saving}
                                onClick={() => updateQuantity(item)}
                                aria-label="Guardar cantidad"
                              >
                                <Save className="h-4 w-4" />
                              </button>

                              <button
                                type="button"
                                className="rounded-lg p-2 text-red-600 hover:bg-red-50 disabled:opacity-40"
                                disabled={saving}
                                onClick={() => removeItem(item)}
                                aria-label="Quitar"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="space-y-3 rounded-xl border border-zinc-200 p-4">
              <div>
                <div className="text-sm font-semibold text-zinc-900">Agregar producto al reparto</div>
                <div className="text-xs text-zinc-500">
                  Esta es la mercadería que administración le entrega al repartidor antes de salir.
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-[1fr_160px_auto]">
                <Select value={selectedProductId} onChange={e => setSelectedProductId(e.target.value)}>
                  <option value="">Seleccionar producto...</option>
                  {availableProducts.map(product => (
                    <option key={String(product.id)} value={String(product.id)}>
                      {rowLabel(product)}
                    </option>
                  ))}
                </Select>

                <Input
                  type="number"
                  step="any"
                  value={quantity}
                  onChange={e => setQuantity(e.target.value)}
                  placeholder="Cantidad"
                />

                <Button type="button" disabled={saving || !selectedProductId || !quantity} onClick={addProduct}>
                  <PackagePlus className="mr-2 h-4 w-4" /> Agregar
                </Button>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </Modal>
  )
}