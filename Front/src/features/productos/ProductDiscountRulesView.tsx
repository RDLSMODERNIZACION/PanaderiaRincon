"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Download, Pencil, Plus, RefreshCw, Search, Tags, Trash2 } from "lucide-react"
import Button from "@/components/ui/Button"
import Input from "@/components/ui/Input"
import Select from "@/components/ui/Select"
import Modal from "@/components/ui/Modal"
import { Card, CardBody, CardHeader } from "@/components/ui/Card"
import { EmptyBlock, ErrorBlock, LoadingBlock } from "@/components/data/AsyncState"
import { useAuth } from "@/features/auth/AuthProvider"
import { apiGet, createRow, deleteRow, updateRow, unwrapData } from "@/lib/api"
import { downloadCsv } from "@/lib/csv"
import type { RowData } from "@/features/crud/types"

type DiscountType = "pack" | "precio_por_cantidad"
type ActiveFilter = "" | "active" | "inactive"

type DiscountRule = {
  id: string
  productId: string
  customerId: string
  nombre: string
  tipo: DiscountType
  minCantidad: number
  packCantidad: number
  packPrecio: number
  precioUnitario: number
  fechaDesde: string
  fechaHasta: string
  activo: boolean
  prioridad: number
  createdAt: string
  updatedAt: string
}

type DiscountForm = {
  productId: string
  customerId: string
  nombre: string
  tipo: DiscountType
  minCantidad: string
  packCantidad: string
  packPrecio: string
  precioUnitario: string
  fechaDesde: string
  fechaHasta: string
  activo: boolean
  prioridad: string
}

function getId(row?: RowData) {
  return String(row?.id || "")
}

function getName(row?: RowData) {
  return String(row?.nombre || row?.name || row?.email || row?.id || "")
}

function getProductId(row?: RowData) {
  return String(row?.productId || row?.product_id || "")
}

function getCustomerId(row?: RowData) {
  return String(row?.customerId || row?.customer_id || "")
}

function asNumber(value: unknown) {
  const n = Number(value ?? 0)
  return Number.isFinite(n) ? n : 0
}

function asDateOnly(value: unknown) {
  const text = String(value || "")
  if (!text) return ""
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text
  return text.slice(0, 10)
}

function todayLocalDate() {
  const d = new Date()
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
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
  return d.toLocaleDateString("es-AR")
}

function money(value: number) {
  return `$ ${Number(value || 0).toLocaleString("es-AR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  })}`
}

function qty(value: number) {
  return Number(value || 0).toLocaleString("es-AR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  })
}

function normalize(text: unknown) {
  return String(text || "").toLowerCase()
}

function normalizeRule(row: RowData): DiscountRule {
  return {
    id: getId(row),
    productId: getProductId(row),
    customerId: getCustomerId(row),
    nombre: String(row.nombre || ""),
    tipo: String(row.tipo || "pack") as DiscountType,
    minCantidad: asNumber(row.minCantidad ?? row.min_cantidad),
    packCantidad: asNumber(row.packCantidad ?? row.pack_cantidad),
    packPrecio: asNumber(row.packPrecio ?? row.pack_precio),
    precioUnitario: asNumber(row.precioUnitario ?? row.precio_unitario),
    fechaDesde: asDateOnly(row.fechaDesde ?? row.fecha_desde),
    fechaHasta: asDateOnly(row.fechaHasta ?? row.fecha_hasta),
    activo: row.activo === undefined ? true : Boolean(row.activo),
    prioridad: asNumber(row.prioridad ?? 100),
    createdAt: String(row.createdAt || row.created_at || ""),
    updatedAt: String(row.updatedAt || row.updated_at || "")
  }
}

function emptyForm(): DiscountForm {
  return {
    productId: "",
    customerId: "",
    nombre: "",
    tipo: "pack",
    minCantidad: "",
    packCantidad: "",
    packPrecio: "",
    precioUnitario: "",
    fechaDesde: todayLocalDate(),
    fechaHasta: "",
    activo: true,
    prioridad: "100"
  }
}

function ruleToForm(rule: DiscountRule): DiscountForm {
  return {
    productId: rule.productId,
    customerId: rule.customerId,
    nombre: rule.nombre,
    tipo: rule.tipo,
    minCantidad: rule.minCantidad ? String(rule.minCantidad) : "",
    packCantidad: rule.packCantidad ? String(rule.packCantidad) : "",
    packPrecio: rule.packPrecio ? String(rule.packPrecio) : "",
    precioUnitario: rule.precioUnitario ? String(rule.precioUnitario) : "",
    fechaDesde: rule.fechaDesde || todayLocalDate(),
    fechaHasta: rule.fechaHasta || "",
    activo: rule.activo,
    prioridad: String(rule.prioridad || 100)
  }
}

function conditionLabel(rule: DiscountRule) {
  if (rule.tipo === "pack") {
    return `${qty(rule.packCantidad)} unidades/kg por ${money(rule.packPrecio)}`
  }

  return `Desde ${qty(rule.minCantidad)} → ${money(rule.precioUnitario)} c/u`
}

function typeLabel(value: string) {
  if (value === "pack") return "Pack"
  if (value === "precio_por_cantidad") return "Precio por cantidad"
  return value || "-"
}

function isRuleCurrentlyValid(rule: DiscountRule) {
  if (!rule.activo) return false

  const today = todayLocalDate()
  if (rule.fechaDesde && rule.fechaDesde > today) return false
  if (rule.fechaHasta && rule.fechaHasta < today) return false

  return true
}

export default function ProductDiscountRulesView() {
  const { session, can } = useAuth()

  const [rules, setRules] = useState<DiscountRule[]>([])
  const [products, setProducts] = useState<RowData[]>([])
  const [customers, setCustomers] = useState<RowData[]>([])
  const [q, setQ] = useState("")
  const [tipo, setTipo] = useState<"" | DiscountType>("")
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>("active")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [warning, setWarning] = useState<string | null>(null)

  const [creating, setCreating] = useState(false)
  const [editingRule, setEditingRule] = useState<DiscountRule | null>(null)
  const [form, setForm] = useState<DiscountForm>(emptyForm())
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const canWrite = can("admin.crud.write", "product_discount_rules.write")
  const canDelete = can("admin.crud.delete", "product_discount_rules.delete")

  const load = useCallback(async () => {
    if (!session) return

    setLoading(true)
    setError(null)
    setWarning(null)

    try {
      const [rulesPayload, productsPayload] = await Promise.all([
        apiGet(session, "/api/admin/crud/product_discount_rules?limit=1000&order_by=prioridad"),
        apiGet(session, "/api/admin/crud/products?limit=1000&order_by=nombre&include_inactive=true")
      ])

      setRules((unwrapData<RowData[]>(rulesPayload) || []).map(normalizeRule))
      setProducts(unwrapData<RowData[]>(productsPayload) || [])

      try {
        const customersPayload = await apiGet(session, "/api/admin/crud/customers?limit=1000&order_by=nombre&include_inactive=true")
        setCustomers(unwrapData<RowData[]>(customersPayload) || [])
      } catch (exc) {
        console.warn("No se pudieron cargar clientes para descuentos", exc)
        setCustomers([])
        setWarning("No se pudieron cargar clientes. Los descuentos generales por producto siguen disponibles.")
      }
    } catch (exc: any) {
      setError(exc?.message || "No se pudieron cargar los descuentos")
    } finally {
      setLoading(false)
    }
  }, [session])

  useEffect(() => {
    load()
  }, [load])

  const productById = useMemo(() => {
    return new Map(products.map(product => [getId(product), product]))
  }, [products])

  const customerById = useMemo(() => {
    return new Map(customers.map(customer => [getId(customer), customer]))
  }, [customers])

  const filteredRules = useMemo(() => {
    const search = q.trim().toLowerCase()

    return rules.filter(rule => {
      if (tipo && rule.tipo !== tipo) return false
      if (activeFilter === "active" && !rule.activo) return false
      if (activeFilter === "inactive" && rule.activo) return false

      if (!search) return true

      const product = productById.get(rule.productId)
      const customer = customerById.get(rule.customerId)

      const text = [
        rule.nombre,
        rule.tipo,
        rule.productId,
        getName(product),
        rule.customerId,
        getName(customer),
        conditionLabel(rule)
      ]
        .map(normalize)
        .join(" ")

      return text.includes(search)
    })
  }, [rules, q, tipo, activeFilter, productById, customerById])

  const activeRules = useMemo(() => filteredRules.filter(rule => rule.activo).length, [filteredRules])
  const validToday = useMemo(() => filteredRules.filter(isRuleCurrentlyValid).length, [filteredRules])
  const packRules = useMemo(() => filteredRules.filter(rule => rule.tipo === "pack").length, [filteredRules])
  const quantityRules = useMemo(() => filteredRules.filter(rule => rule.tipo === "precio_por_cantidad").length, [filteredRules])

  function openCreate() {
    setCreating(true)
    setEditingRule(null)
    setForm(emptyForm())
    setFormError(null)
  }

  function openEdit(rule: DiscountRule) {
    setEditingRule(rule)
    setCreating(false)
    setForm(ruleToForm(rule))
    setFormError(null)
  }

  function closeForm() {
    if (saving) return
    setCreating(false)
    setEditingRule(null)
    setForm(emptyForm())
    setFormError(null)
  }

  function validateForm() {
    if (!form.productId) return "Seleccioná un producto."
    if (!form.nombre.trim()) return "Ingresá un nombre para el descuento."
    if (!form.fechaDesde) return "Ingresá una fecha desde."

    const minCantidad = asNumber(form.minCantidad)
    const packCantidad = asNumber(form.packCantidad)
    const packPrecio = asNumber(form.packPrecio)
    const precioUnitario = asNumber(form.precioUnitario)

    if (form.tipo === "pack") {
      if (packCantidad <= 0) return "Para un pack, la cantidad del pack debe ser mayor a cero."
      if (packPrecio <= 0) return "Para un pack, el precio del pack debe ser mayor a cero."
    }

    if (form.tipo === "precio_por_cantidad") {
      if (minCantidad <= 0) return "Para precio por cantidad, la cantidad mínima debe ser mayor a cero."
      if (precioUnitario <= 0) return "Para precio por cantidad, el precio unitario debe ser mayor a cero."
    }

    if (form.fechaHasta && form.fechaHasta < form.fechaDesde) {
      return "La fecha hasta no puede ser anterior a la fecha desde."
    }

    return null
  }

  function payloadFromForm() {
    const isPack = form.tipo === "pack"

    return {
      product_id: form.productId,
      customer_id: form.customerId || null,
      nombre: form.nombre.trim(),
      tipo: form.tipo,
      min_cantidad: isPack ? null : asNumber(form.minCantidad),
      pack_cantidad: isPack ? asNumber(form.packCantidad) : null,
      pack_precio: isPack ? asNumber(form.packPrecio) : null,
      precio_unitario: isPack ? null : asNumber(form.precioUnitario),
      fecha_desde: form.fechaDesde,
      fecha_hasta: form.fechaHasta || null,
      activo: form.activo,
      prioridad: asNumber(form.prioridad || 100)
    }
  }

  async function submitForm() {
    if (!session) return

    const validation = validateForm()
    if (validation) {
      setFormError(validation)
      return
    }

    setSaving(true)
    setFormError(null)

    try {
      const payload = payloadFromForm()

      if (editingRule) {
        await updateRow(session, "product_discount_rules", editingRule.id, payload)
      } else {
        await createRow(session, "product_discount_rules", payload)
      }

      closeForm()
      await load()
    } catch (exc: any) {
      setFormError(exc?.message || "No se pudo guardar el descuento.")
    } finally {
      setSaving(false)
    }
  }

  async function removeRule(rule: DiscountRule) {
    if (!session) return

    if (!window.confirm(`¿Eliminar o desactivar el descuento ${rule.nombre}?`)) return

    try {
      await deleteRow(session, "product_discount_rules", rule.id)
      await load()
    } catch (exc: any) {
      setError(exc?.message || "No se pudo eliminar el descuento.")
    }
  }

  function clearFilters() {
    setQ("")
    setTipo("")
    setActiveFilter("active")
  }

  function exportRows() {
    const rows = filteredRules.map(rule => ({
      id: rule.id,
      nombre: rule.nombre,
      producto: getName(productById.get(rule.productId)) || rule.productId,
      cliente: rule.customerId ? getName(customerById.get(rule.customerId)) || rule.customerId : "General",
      tipo: typeLabel(rule.tipo),
      condicion: conditionLabel(rule),
      fecha_desde: rule.fechaDesde,
      fecha_hasta: rule.fechaHasta,
      activo: rule.activo ? "Sí" : "No",
      prioridad: rule.prioridad
    }))

    downloadCsv(`descuentos_productos_${new Date().toISOString().slice(0, 10)}.csv`, rows)
  }

  if (loading) return <LoadingBlock />
  if (error) return <ErrorBlock error={error} onRetry={load} />

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader
          title="Descuentos"
          subtitle="Reglas de pack, precio por cantidad y descuentos específicos por cliente."
          right={
            <div className="flex flex-wrap justify-end gap-2">
              <div className="relative w-full sm:w-[300px]">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
                <Input
                  value={q}
                  onChange={event => setQ(event.target.value)}
                  placeholder="Buscar producto, cliente o descuento..."
                  className="pl-9"
                />
              </div>

              <Select value={tipo} onChange={event => setTipo(event.target.value as "" | DiscountType)} className="w-full sm:w-[190px]">
                <option value="">Todos los tipos</option>
                <option value="pack">Pack</option>
                <option value="precio_por_cantidad">Precio por cantidad</option>
              </Select>

              <Select value={activeFilter} onChange={event => setActiveFilter(event.target.value as ActiveFilter)} className="w-full sm:w-[150px]">
                <option value="active">Activos</option>
                <option value="">Todos</option>
                <option value="inactive">Inactivos</option>
              </Select>

              {(q || tipo || activeFilter !== "active") ? (
                <Button variant="secondary" onClick={clearFilters}>
                  Limpiar
                </Button>
              ) : null}

              <Button variant="secondary" onClick={load}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Actualizar
              </Button>

              <Button variant="secondary" onClick={exportRows}>
                <Download className="mr-2 h-4 w-4" />
                CSV
              </Button>

              {canWrite ? (
                <Button onClick={openCreate}>
                  <Plus className="mr-2 h-4 w-4" />
                  Nuevo
                </Button>
              ) : null}
            </div>
          }
        />

        <CardBody>
          {warning ? (
            <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              {warning}
            </div>
          ) : null}

          <div className="grid gap-3 md:grid-cols-4">
            <div className="rounded-2xl bg-zinc-900 p-4 text-white">
              <Tags className="h-5 w-5 opacity-80" />
              <div className="mt-2 text-2xl font-semibold">{validToday}</div>
              <div className="text-xs opacity-80">vigentes hoy</div>
            </div>

            <div className="rounded-2xl border border-zinc-200 p-4">
              <div className="text-xs font-medium text-zinc-500">Activos filtrados</div>
              <div className="mt-2 text-2xl font-semibold text-zinc-900">{activeRules}</div>
            </div>

            <div className="rounded-2xl border border-zinc-200 p-4">
              <div className="text-xs font-medium text-zinc-500">Packs</div>
              <div className="mt-2 text-2xl font-semibold text-zinc-900">{packRules}</div>
            </div>

            <div className="rounded-2xl border border-zinc-200 p-4">
              <div className="text-xs font-medium text-zinc-500">Precio por cantidad</div>
              <div className="mt-2 text-2xl font-semibold text-zinc-900">{quantityRules}</div>
            </div>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Reglas cargadas" subtitle="Se aplican según prioridad, producto, cliente y vigencia." />

        <CardBody className="p-0">
          {filteredRules.length === 0 ? (
            <div className="p-5">
              <EmptyBlock label="No hay descuentos para mostrar." />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1120px] text-left text-sm">
                <thead className="border-b border-zinc-100 bg-zinc-50 text-xs font-medium text-zinc-500">
                  <tr>
                    <th className="px-4 py-3">Descuento</th>
                    <th className="px-4 py-3">Producto</th>
                    <th className="px-4 py-3">Cliente</th>
                    <th className="px-4 py-3">Tipo</th>
                    <th className="px-4 py-3">Condición</th>
                    <th className="px-4 py-3">Vigencia</th>
                    <th className="px-4 py-3">Prioridad</th>
                    <th className="px-4 py-3">Estado</th>
                    <th className="px-4 py-3 text-right">Acciones</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-zinc-100">
                  {filteredRules.map(rule => {
                    const product = productById.get(rule.productId)
                    const customer = customerById.get(rule.customerId)
                    const valid = isRuleCurrentlyValid(rule)

                    return (
                      <tr key={rule.id} className="hover:bg-zinc-50">
                        <td className="px-4 py-3">
                          <div className="font-medium text-zinc-900">{rule.nombre}</div>
                          <div className="mt-1 font-mono text-xs text-zinc-400">{rule.id}</div>
                        </td>

                        <td className="px-4 py-3 text-zinc-700">{getName(product) || rule.productId || "-"}</td>

                        <td className="px-4 py-3 text-zinc-700">
                          {rule.customerId ? getName(customer) || rule.customerId : "General"}
                        </td>

                        <td className="px-4 py-3">
                          <span className="rounded-full bg-zinc-100 px-2 py-1 text-xs font-medium text-zinc-700">
                            {typeLabel(rule.tipo)}
                          </span>
                        </td>

                        <td className="px-4 py-3 text-zinc-900">{conditionLabel(rule)}</td>

                        <td className="px-4 py-3 text-zinc-700">
                          <div>Desde {formatDate(rule.fechaDesde)}</div>
                          <div className="mt-1 text-xs text-zinc-500">Hasta {rule.fechaHasta ? formatDate(rule.fechaHasta) : "sin vencimiento"}</div>
                        </td>

                        <td className="px-4 py-3 text-zinc-700">{rule.prioridad}</td>

                        <td className="px-4 py-3">
                          <span
                            className={`rounded-full px-2 py-1 text-xs font-medium ${
                              valid
                                ? "bg-emerald-100 text-emerald-700"
                                : rule.activo
                                  ? "bg-amber-100 text-amber-800"
                                  : "bg-zinc-100 text-zinc-600"
                            }`}
                          >
                            {valid ? "Vigente" : rule.activo ? "Fuera de fecha" : "Inactivo"}
                          </span>
                        </td>

                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-2">
                            {canWrite ? (
                              <button
                                type="button"
                                className="rounded-xl border border-zinc-200 p-2 hover:bg-zinc-100"
                                onClick={() => openEdit(rule)}
                                aria-label="Editar"
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                            ) : null}

                            {canDelete ? (
                              <button
                                type="button"
                                className="rounded-xl bg-red-600 p-2 text-white hover:bg-red-700"
                                onClick={() => removeRule(rule)}
                                aria-label="Eliminar"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>

      <Modal
        open={creating || !!editingRule}
        onClose={closeForm}
        title={editingRule ? `Editar descuento · ${editingRule.nombre}` : "Nuevo descuento"}
      >
        <form
          className="space-y-4"
          onSubmit={event => {
            event.preventDefault()
            submitForm()
          }}
        >
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-600">Producto</label>
            <Select value={form.productId} onChange={event => setForm(prev => ({ ...prev, productId: event.target.value }))}>
              <option value="">Seleccionar producto</option>
              {products.map(product => (
                <option key={getId(product)} value={getId(product)}>
                  {getName(product)}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-600">Cliente específico</label>
            <Select value={form.customerId} onChange={event => setForm(prev => ({ ...prev, customerId: event.target.value }))}>
              <option value="">General para todos</option>
              {customers.map(customer => (
                <option key={getId(customer)} value={getId(customer)}>
                  {getName(customer)}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-600">Nombre</label>
            <Input
              value={form.nombre}
              onChange={event => setForm(prev => ({ ...prev, nombre: event.target.value }))}
              placeholder="Ej: Budín 2x5000"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-600">Tipo de descuento</label>
              <Select
                value={form.tipo}
                onChange={event => setForm(prev => ({ ...prev, tipo: event.target.value as DiscountType }))}
              >
                <option value="pack">Pack</option>
                <option value="precio_por_cantidad">Precio por cantidad</option>
              </Select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-600">Prioridad</label>
              <Input
                type="number"
                value={form.prioridad}
                onChange={event => setForm(prev => ({ ...prev, prioridad: event.target.value }))}
                placeholder="100"
              />
            </div>
          </div>

          {form.tipo === "pack" ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-600">Cantidad del pack</label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.packCantidad}
                  onChange={event => setForm(prev => ({ ...prev, packCantidad: event.target.value }))}
                  placeholder="Ej: 2"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-600">Precio del pack</label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.packPrecio}
                  onChange={event => setForm(prev => ({ ...prev, packPrecio: event.target.value }))}
                  placeholder="Ej: 5000"
                />
              </div>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-600">Cantidad mínima</label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.minCantidad}
                  onChange={event => setForm(prev => ({ ...prev, minCantidad: event.target.value }))}
                  placeholder="Ej: 10"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-600">Precio unitario</label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.precioUnitario}
                  onChange={event => setForm(prev => ({ ...prev, precioUnitario: event.target.value }))}
                  placeholder="Ej: 2000"
                />
              </div>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-600">Desde</label>
              <Input
                type="date"
                value={form.fechaDesde}
                onChange={event => setForm(prev => ({ ...prev, fechaDesde: event.target.value }))}
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-600">Hasta</label>
              <Input
                type="date"
                value={form.fechaHasta}
                onChange={event => setForm(prev => ({ ...prev, fechaHasta: event.target.value }))}
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-600">Estado</label>
              <Select
                value={form.activo ? "true" : "false"}
                onChange={event => setForm(prev => ({ ...prev, activo: event.target.value === "true" }))}
              >
                <option value="true">Activo</option>
                <option value="false">Inactivo</option>
              </Select>
            </div>
          </div>

          {formError ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {formError}
            </div>
          ) : null}

          <div className="flex justify-end gap-2 border-t border-zinc-100 pt-4">
            <Button type="button" variant="secondary" onClick={closeForm} disabled={saving}>
              Cancelar
            </Button>

            <Button type="submit" disabled={saving}>
              {saving ? "Guardando..." : "Guardar"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
