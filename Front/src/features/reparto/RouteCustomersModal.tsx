"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { ArrowDown, ArrowUp, Plus, Trash2, UserPlus, Users } from "lucide-react"
import Button from "@/components/ui/Button"
import Input from "@/components/ui/Input"
import Modal from "@/components/ui/Modal"
import Select from "@/components/ui/Select"
import { LoadingBlock } from "@/components/data/AsyncState"
import { apiDelete, apiGet, apiPatch, apiPost, type ApiSession, unwrapData } from "@/lib/api"
import type { RowData } from "@/features/crud/types"

type RouteCustomer = RowData & {
  customer?: RowData
}

type Props = {
  open: boolean
  route: RowData | null
  session: ApiSession | null
  onClose: () => void
  onChanged?: () => void
}

function rowLabel(row: RowData) {
  return String(row.nombre || row.name || row.email || row.direccion || row.id || "")
}

function routeCustomerRouteId(row: RowData) {
  return String(row.route_id || row.routeId || "")
}

function routeCustomerCustomerId(row: RowData) {
  return String(row.customer_id || row.customerId || "")
}

function routeCustomerOrder(row: RowData) {
  const raw = row.orden ?? row.order ?? 0
  const n = Number(raw)
  return Number.isFinite(n) ? n : 0
}

function customerMatches(row: RowData, q: string) {
  const search = q.trim().toLowerCase()
  if (!search) return true

  const text = [
    row.nombre,
    row.name,
    row.direccion,
    row.telefono,
    row.observaciones
  ].filter(Boolean).join(" ").toLowerCase()

  return text.includes(search)
}

export default function RouteCustomersModal({
  open,
  route,
  session,
  onClose,
  onChanged
}: Props) {
  const [items, setItems] = useState<RouteCustomer[]>([])
  const [customers, setCustomers] = useState<RowData[]>([])
  const [selectedCustomerId, setSelectedCustomerId] = useState("")
  const [customerSearch, setCustomerSearch] = useState("")
  const [newCustomer, setNewCustomer] = useState({ nombre: "", direccion: "", telefono: "" })
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const routeId = route?.id ? String(route.id) : ""

  const loadDetails = useCallback(async () => {
    if (!session || !routeId) return

    setLoading(true)
    setError(null)

    try {
      const [linksPayload, customersPayload] = await Promise.all([
        apiGet(session, "/api/admin/crud/delivery_route_customers?limit=1000"),
        apiGet(session, "/api/admin/crud/customers?limit=1000")
      ])

      const links = unwrapData<RowData[]>(linksPayload) || []
      const customerRows = unwrapData<RowData[]>(customersPayload) || []
      const customerById = new Map(customerRows.map(customer => [String(customer.id), customer]))

      const routeItems = links
        .filter(link => routeCustomerRouteId(link) === routeId)
        .map(link => ({
          ...link,
          customer: customerById.get(routeCustomerCustomerId(link))
        }))
        .sort((a, b) => routeCustomerOrder(a) - routeCustomerOrder(b))

      setCustomers(customerRows)
      setItems(routeItems)
    } catch (exc: any) {
      setError(exc?.message || "No se pudo cargar el recorrido")
    } finally {
      setLoading(false)
    }
  }, [session, routeId])

  useEffect(() => {
    if (open) {
      setSelectedCustomerId("")
      setCustomerSearch("")
      setNewCustomer({ nombre: "", direccion: "", telefono: "" })
      loadDetails()
    }
  }, [open, loadDetails])

  const usedCustomerIds = useMemo(() => {
    return new Set(items.map(item => routeCustomerCustomerId(item)).filter(Boolean))
  }, [items])

  const availableCustomers = useMemo(() => {
    return customers
      .filter(customer => !usedCustomerIds.has(String(customer.id)))
      .filter(customer => customerMatches(customer, customerSearch))
      .slice(0, 80)
  }, [customers, usedCustomerIds, customerSearch])

  async function refreshAfterChange() {
    await loadDetails()
    onChanged?.()
  }

  async function addExistingCustomer() {
    if (!session || !routeId || !selectedCustomerId) return

    setSaving(true)
    setError(null)

    try {
      const nextOrder = Math.max(0, ...items.map(routeCustomerOrder)) + 1

      await apiPost(session, "/api/admin/crud/delivery_route_customers", {
        route_id: routeId,
        customer_id: selectedCustomerId,
        orden: nextOrder
      })

      setSelectedCustomerId("")
      setCustomerSearch("")
      await refreshAfterChange()
    } catch (exc: any) {
      setError(exc?.message || "No se pudo agregar el cliente")
    } finally {
      setSaving(false)
    }
  }

  async function createAndAddCustomer() {
    if (!session || !routeId) return

    const nombre = newCustomer.nombre.trim()

    if (!nombre) {
      setError("Ingresá el nombre del cliente.")
      return
    }

    setSaving(true)
    setError(null)

    try {
      const customerPayload = await apiPost(session, "/api/admin/crud/customers", {
        nombre,
        direccion: newCustomer.direccion.trim() || undefined,
        telefono: newCustomer.telefono.trim() || undefined,
        activo: true
      })

      const customer = unwrapData<RowData>(customerPayload)
      const nextOrder = Math.max(0, ...items.map(routeCustomerOrder)) + 1

      await apiPost(session, "/api/admin/crud/delivery_route_customers", {
        route_id: routeId,
        customer_id: customer.id,
        orden: nextOrder
      })

      setNewCustomer({ nombre: "", direccion: "", telefono: "" })
      await refreshAfterChange()
    } catch (exc: any) {
      setError(exc?.message || "No se pudo crear y agregar el cliente")
    } finally {
      setSaving(false)
    }
  }

  async function removeCustomer(item: RouteCustomer) {
    if (!session || !item.id) return

    const label = item.customer ? rowLabel(item.customer) : "este cliente"
    if (!window.confirm(`¿Quitar ${label} del recorrido?`)) return

    setSaving(true)
    setError(null)

    try {
      await apiDelete(session, `/api/admin/crud/delivery_route_customers/${encodeURIComponent(String(item.id))}`)
      await refreshAfterChange()
    } catch (exc: any) {
      setError(exc?.message || "No se pudo quitar el cliente")
    } finally {
      setSaving(false)
    }
  }

  async function moveItem(index: number, direction: -1 | 1) {
    if (!session) return

    const current = items[index]
    const other = items[index + direction]

    if (!current || !other || !current.id || !other.id) return

    setSaving(true)
    setError(null)

    try {
      await Promise.all([
        apiPatch(session, `/api/admin/crud/delivery_route_customers/${encodeURIComponent(String(current.id))}`, {
          orden: routeCustomerOrder(other)
        }),
        apiPatch(session, `/api/admin/crud/delivery_route_customers/${encodeURIComponent(String(other.id))}`, {
          orden: routeCustomerOrder(current)
        })
      ])

      await refreshAfterChange()
    } catch (exc: any) {
      setError(exc?.message || "No se pudo cambiar el orden")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={`Recorrido · ${route ? rowLabel(route) : ""}`}>
      <div className="space-y-5">
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
                  <div className="text-sm font-semibold text-zinc-900">Clientes del recorrido</div>
                  <div className="text-xs text-zinc-500">{items.length} cliente(s) asociados</div>
                </div>
                <Users className="h-5 w-5 text-zinc-400" />
              </div>

              {items.length === 0 ? (
                <div className="px-4 py-6 text-sm text-zinc-500">
                  Todavía no hay clientes en este recorrido.
                </div>
              ) : (
                <div className="max-h-[260px] overflow-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="border-b border-zinc-100 bg-zinc-50 text-xs font-medium text-zinc-500">
                      <tr>
                        <th className="px-4 py-2">Orden</th>
                        <th className="px-4 py-2">Cliente</th>
                        <th className="px-4 py-2">Dirección</th>
                        <th className="px-4 py-2 text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {items.map((item, index) => (
                        <tr key={String(item.id)}>
                          <td className="px-4 py-2 text-zinc-600">{routeCustomerOrder(item)}</td>
                          <td className="px-4 py-2 font-medium text-zinc-900">
                            {item.customer ? rowLabel(item.customer) : routeCustomerCustomerId(item)}
                          </td>
                          <td className="px-4 py-2 text-zinc-600">
                            {String(item.customer?.direccion || "-")}
                          </td>
                          <td className="px-4 py-2">
                            <div className="flex justify-end gap-1">
                              <button
                                type="button"
                                className="rounded-lg p-2 hover:bg-zinc-100 disabled:opacity-40"
                                disabled={index === 0 || saving}
                                onClick={() => moveItem(index, -1)}
                                aria-label="Subir"
                              >
                                <ArrowUp className="h-4 w-4" />
                              </button>

                              <button
                                type="button"
                                className="rounded-lg p-2 hover:bg-zinc-100 disabled:opacity-40"
                                disabled={index === items.length - 1 || saving}
                                onClick={() => moveItem(index, 1)}
                                aria-label="Bajar"
                              >
                                <ArrowDown className="h-4 w-4" />
                              </button>

                              <button
                                type="button"
                                className="rounded-lg p-2 text-red-600 hover:bg-red-50 disabled:opacity-40"
                                disabled={saving}
                                onClick={() => removeCustomer(item)}
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

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-3 rounded-xl border border-zinc-200 p-4">
                <div>
                  <div className="text-sm font-semibold text-zinc-900">Agregar cliente existente</div>
                  <div className="text-xs text-zinc-500">Buscá un cliente ya cargado y sumalo a este recorrido.</div>
                </div>

                <Input
                  value={customerSearch}
                  onChange={e => setCustomerSearch(e.target.value)}
                  placeholder="Buscar cliente..."
                />

                <Select value={selectedCustomerId} onChange={e => setSelectedCustomerId(e.target.value)}>
                  <option value="">Seleccionar...</option>
                  {availableCustomers.map(customer => (
                    <option key={String(customer.id)} value={String(customer.id)}>
                      {rowLabel(customer)}
                    </option>
                  ))}
                </Select>

                <Button
                  type="button"
                  className="w-full"
                  disabled={saving || !selectedCustomerId}
                  onClick={addExistingCustomer}
                >
                  <Plus className="mr-2 h-4 w-4" /> Agregar al recorrido
                </Button>
              </div>

              <div className="space-y-3 rounded-xl border border-zinc-200 p-4">
                <div>
                  <div className="text-sm font-semibold text-zinc-900">Crear cliente nuevo</div>
                  <div className="text-xs text-zinc-500">Se crea el cliente y queda asociado automáticamente.</div>
                </div>

                <Input
                  value={newCustomer.nombre}
                  onChange={e => setNewCustomer(v => ({ ...v, nombre: e.target.value }))}
                  placeholder="Nombre del cliente"
                />

                <Input
                  value={newCustomer.direccion}
                  onChange={e => setNewCustomer(v => ({ ...v, direccion: e.target.value }))}
                  placeholder="Dirección"
                />

                <Input
                  value={newCustomer.telefono}
                  onChange={e => setNewCustomer(v => ({ ...v, telefono: e.target.value }))}
                  placeholder="Teléfono"
                />

                <Button
                  type="button"
                  className="w-full"
                  disabled={saving || !newCustomer.nombre.trim()}
                  onClick={createAndAddCustomer}
                >
                  <UserPlus className="mr-2 h-4 w-4" /> Crear y agregar
                </Button>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </Modal>
  )
}