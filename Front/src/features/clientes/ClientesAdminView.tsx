"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  AlertTriangle,
  Download,
  Pencil,
  RefreshCw,
  RotateCcw,
  Search,
  Store,
  UserCheck,
  UserPlus,
  Users
} from "lucide-react"
import Button from "@/components/ui/Button"
import Input from "@/components/ui/Input"
import Select from "@/components/ui/Select"
import Modal from "@/components/ui/Modal"
import { Card, CardBody, CardHeader } from "@/components/ui/Card"
import { EmptyBlock, ErrorBlock, LoadingBlock } from "@/components/data/AsyncState"
import { useAuth } from "@/features/auth/AuthProvider"
import { createRow, getRows, updateRow } from "@/lib/api"
import { downloadCsv } from "@/lib/csv"
import type { RowData } from "@/features/crud/types"

type CustomerForm = {
  nombre: string
  direccion: string
  telefono: string
  observaciones: string
  activo: boolean
}

type CustomerRow = {
  id: string
  nombre: string
  direccion: string
  telefono: string
  observaciones: string
  activo: boolean
  createdAt: string

  deuda: number
  saldoFavor: number
  vendido: number
  pagado: number
  ultimoPagoFecha: string
  ultimoPagoMonto: number
  movimientos: number
  visitas: number
  ultimaVisita: string
}

type MovementRow = {
  id: string
  fecha: string
  tipo: string
  debe: number
  haber: number
  saldo: number
  descripcion: string
  referencia: string
}

type EstadoFiltro = "activos" | "todos" | "con_deuda" | "sin_deuda" | "saldo_favor" | "inactivos"

function getId(row?: RowData) {
  return String(row?.id || "")
}

function getCustomerId(row?: RowData) {
  return String(row?.customerId || row?.customer_id || "")
}

function getName(row?: RowData) {
  return String(row?.nombre || row?.name || row?.email || row?.id || "")
}

function getFecha(row?: RowData) {
  return String(row?.fecha || row?.arrivedAt || row?.arrived_at || row?.createdAt || row?.created_at || "")
}

function getTipo(row?: RowData) {
  return String(row?.tipo || "")
}

function getDebe(row?: RowData) {
  const n = Number(row?.debe ?? 0)
  return Number.isFinite(n) ? n : 0
}

function getHaber(row?: RowData) {
  const n = Number(row?.haber ?? 0)
  return Number.isFinite(n) ? n : 0
}

function getDescription(row?: RowData) {
  return String(row?.descripcion || row?.description || "")
}

function getReference(row?: RowData) {
  const type = String(row?.referenceType || row?.reference_type || "")
  const id = String(row?.referenceId || row?.reference_id || "")
  return [type, id].filter(Boolean).join(" · ")
}

function isActive(row?: RowData) {
  if (!row) return true
  if ("activo" in row) return Boolean(row.activo)
  if ("active" in row) return Boolean(row.active)
  return true
}

function dateValue(value: string) {
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? 0 : d.getTime()
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

function formatDateTime(value: unknown) {
  if (!value) return "-"

  const d = new Date(String(value))
  if (Number.isNaN(d.getTime())) return String(value)

  return d.toLocaleString("es-AR", {
    dateStyle: "short",
    timeStyle: "short"
  })
}

function money(value: number) {
  return `$ ${Number(value || 0).toLocaleString("es-AR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  })}`
}

function normalize(value: unknown) {
  return String(value || "").toLowerCase()
}

function tipoClass(tipo: string) {
  if (tipo === "venta") return "bg-red-100 text-red-700"
  if (tipo === "pago") return "bg-emerald-100 text-emerald-700"
  if (tipo === "nota_credito") return "bg-blue-100 text-blue-700"
  if (tipo === "ajuste_admin") return "bg-amber-100 text-amber-800"
  return "bg-zinc-100 text-zinc-700"
}

function emptyForm(): CustomerForm {
  return {
    nombre: "",
    direccion: "",
    telefono: "",
    observaciones: "",
    activo: true
  }
}

function customerToForm(row: CustomerRow): CustomerForm {
  return {
    nombre: row.nombre,
    direccion: row.direccion,
    telefono: row.telefono,
    observaciones: row.observaciones,
    activo: row.activo
  }
}

function buildMovementRows(movements: RowData[]) {
  const sorted = [...movements].sort((a, b) => dateValue(getFecha(a)) - dateValue(getFecha(b)))
  let saldo = 0

  return sorted
    .map<MovementRow>(movement => {
      const debe = getDebe(movement)
      const haber = getHaber(movement)
      saldo += debe - haber

      return {
        id: getId(movement),
        fecha: getFecha(movement),
        tipo: getTipo(movement),
        debe,
        haber,
        saldo,
        descripcion: getDescription(movement),
        referencia: getReference(movement)
      }
    })
    .reverse()
}

export default function ClientesAdminView() {
  const { session } = useAuth()

  const [customers, setCustomers] = useState<RowData[]>([])
  const [movements, setMovements] = useState<RowData[]>([])
  const [visits, setVisits] = useState<RowData[]>([])

  const [q, setQ] = useState("")
  const [estado, setEstado] = useState<EstadoFiltro>("activos")
  const [selectedCustomerId, setSelectedCustomerId] = useState("")

  const [creating, setCreating] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState<CustomerRow | null>(null)
  const [form, setForm] = useState<CustomerForm>(emptyForm())
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!session) return

    setLoading(true)
    setError(null)

    try {
      const [customersRows, movementRows] = await Promise.all([
        getRows(session, "customers", {
          limit: 1000,
          orderBy: "nombre",
          includeInactive: true
        }),
        getRows(session, "customer_account_movements", {
          limit: 1000,
          orderBy: "fecha",
          desc: true
        })
      ])

      setCustomers(customersRows || [])
      setMovements(movementRows || [])

      try {
        const visitRows = await getRows(session, "delivery_visits", {
          limit: 1000,
          orderBy: "arrived_at",
          desc: true
        })
        setVisits(visitRows || [])
      } catch {
        setVisits([])
      }
    } catch (exc: any) {
      setError(exc?.message || "No se pudieron cargar los clientes")
    } finally {
      setLoading(false)
    }
  }, [session])

  useEffect(() => {
    load()
  }, [load])

  const movementsByCustomer = useMemo(() => {
    const map = new Map<string, RowData[]>()

    for (const movement of movements) {
      const customerId = getCustomerId(movement)
      if (!customerId) continue
      if (!map.has(customerId)) map.set(customerId, [])
      map.get(customerId)!.push(movement)
    }

    return map
  }, [movements])

  const visitSummaryByCustomer = useMemo(() => {
    const map = new Map<string, { count: number; last: string }>()

    for (const visit of visits) {
      const customerId = getCustomerId(visit)
      if (!customerId) continue

      const ts = getFecha(visit)

      if (!map.has(customerId)) {
        map.set(customerId, { count: 0, last: "" })
      }

      const item = map.get(customerId)!
      item.count += 1

      if (dateValue(ts) > dateValue(item.last)) {
        item.last = ts
      }
    }

    return map
  }, [visits])

  const rows = useMemo<CustomerRow[]>(() => {
    return customers
      .map(customer => {
        const customerId = getId(customer)
        const customerMovements = movementsByCustomer.get(customerId) || []
        const visitSummary = visitSummaryByCustomer.get(customerId)

        let vendido = 0
        let haberTotal = 0
        let pagado = 0
        let ultimoPagoFecha = ""
        let ultimoPagoMonto = 0

        for (const movement of customerMovements) {
          const debe = getDebe(movement)
          const haber = getHaber(movement)
          const tipo = getTipo(movement)
          const fecha = getFecha(movement)

          vendido += debe
          haberTotal += haber

          if (tipo === "pago" && haber > 0) {
            pagado += haber

            if (dateValue(fecha) >= dateValue(ultimoPagoFecha)) {
              ultimoPagoFecha = fecha
              ultimoPagoMonto = haber
            }
          }
        }

        const balance = vendido - haberTotal

        return {
          id: customerId,
          nombre: getName(customer),
          direccion: String(customer.direccion || ""),
          telefono: String(customer.telefono || ""),
          observaciones: String(customer.observaciones || ""),
          activo: isActive(customer),
          createdAt: String(customer.createdAt || customer.created_at || ""),

          deuda: Math.max(balance, 0),
          saldoFavor: Math.max(-balance, 0),
          vendido,
          pagado,
          totalDebe: vendido,
          totalHaber: haberTotal,
          ultimoPagoFecha,
          ultimoPagoMonto,
          movimientos: customerMovements.length,
          visitas: visitSummary?.count || 0,
          ultimaVisita: visitSummary?.last || ""
        }
      })
      .sort((a, b) => {
        if (Number(b.activo) !== Number(a.activo)) return Number(b.activo) - Number(a.activo)
        if (b.deuda !== a.deuda) return b.deuda - a.deuda
        return a.nombre.localeCompare(b.nombre)
      })
  }, [customers, movementsByCustomer, visitSummaryByCustomer])

  const filteredRows = useMemo(() => {
    const search = q.trim().toLowerCase()

    return rows.filter(row => {
      if (estado === "activos" && !row.activo) return false
      if (estado === "inactivos" && row.activo) return false
      if (estado === "con_deuda" && row.deuda <= 0) return false
      if (estado === "sin_deuda" && row.deuda > 0) return false
      if (estado === "saldo_favor" && row.saldoFavor <= 0) return false

      if (!search) return true

      const text = [
        row.nombre,
        row.direccion,
        row.telefono,
        row.observaciones,
        row.deuda,
        row.pagado
      ]
        .map(normalize)
        .join(" ")

      return text.includes(search)
    })
  }, [rows, q, estado])

  const selectedCustomer = useMemo(() => {
    if (!selectedCustomerId) return null
    return rows.find(row => row.id === selectedCustomerId) || null
  }, [rows, selectedCustomerId])

  const selectedMovements = useMemo(() => {
    if (!selectedCustomerId) return []
    return buildMovementRows(movementsByCustomer.get(selectedCustomerId) || [])
  }, [selectedCustomerId, movementsByCustomer])

  const totalClientes = filteredRows.length
  const clientesActivos = filteredRows.filter(row => row.activo).length
  const clientesConDeuda = filteredRows.filter(row => row.deuda > 0).length
  const deudaTotal = filteredRows.reduce((sum, row) => sum + row.deuda, 0)
  const clientesSinDatos = filteredRows.filter(row => !row.telefono || !row.direccion).length

  function clearFilters() {
    setQ("")
    setEstado("activos")
  }

  function openCreate() {
    setCreating(true)
    setEditingCustomer(null)
    setForm(emptyForm())
    setFormError(null)
  }

  function openEdit(row: CustomerRow) {
    setSelectedCustomerId(row.id)
    setCreating(false)
    setEditingCustomer(row)
    setForm(customerToForm(row))
    setFormError(null)
  }

  function closeForm() {
    if (saving) return
    setCreating(false)
    setEditingCustomer(null)
    setForm(emptyForm())
    setFormError(null)
  }

  async function submitForm() {
    if (!session) return

    const nombre = form.nombre.trim()

    setFormError(null)

    if (!nombre) {
      setFormError("El nombre del cliente es obligatorio.")
      return
    }

    setSaving(true)

    try {
      const payload = {
        nombre,
        direccion: form.direccion.trim() || null,
        telefono: form.telefono.trim() || null,
        observaciones: form.observaciones.trim() || null,
        activo: form.activo
      }

      if (editingCustomer) {
        await updateRow(session, "customers", editingCustomer.id, payload)
        setSelectedCustomerId(editingCustomer.id)
      } else {
        const created = await createRow(session, "customers", payload)
        setSelectedCustomerId(String(created?.id || ""))
      }

      closeForm()
      await load()
    } catch (exc: any) {
      setFormError(exc?.message || "No se pudo guardar el cliente.")
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(row: CustomerRow) {
    if (!session) return

    const nextActive = !row.activo
    const action = nextActive ? "reactivar" : "desactivar"

    if (!window.confirm(`¿Querés ${action} a ${row.nombre}?`)) return

    try {
      await updateRow(session, "customers", row.id, { activo: nextActive })
      await load()
    } catch (exc: any) {
      setError(exc?.message || `No se pudo ${action} el cliente.`)
    }
  }

  function exportRows() {
    downloadCsv(`clientes_${new Date().toISOString().slice(0, 10)}.csv`, filteredRows)
  }

  if (loading) return <LoadingBlock />
  if (error) return <ErrorBlock error={error} onRetry={load} />

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader
          title="Administración de clientes"
          subtitle="Listado útil de clientes, deuda, contacto y últimos movimientos."
          right={
            <div className="flex flex-wrap justify-end gap-2">
              <div className="relative w-full sm:w-[300px]">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
                <Input
                  value={q}
                  onChange={event => setQ(event.target.value)}
                  placeholder="Buscar cliente, teléfono, dirección..."
                  className="pl-9"
                />
              </div>

              <Select
                value={estado}
                onChange={event => setEstado(event.target.value as EstadoFiltro)}
                className="w-full sm:w-[170px]"
              >
                <option value="activos">Activos</option>
                <option value="todos">Todos</option>
                <option value="con_deuda">Con deuda</option>
                <option value="sin_deuda">Sin deuda</option>
                <option value="saldo_favor">Saldo a favor</option>
                <option value="inactivos">Inactivos</option>
              </Select>

              {(q || estado !== "activos") ? (
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

              <Button onClick={openCreate}>
                <UserPlus className="mr-2 h-4 w-4" />
                Nuevo
              </Button>
            </div>
          }
        />

        <CardBody>
          <div className="grid gap-3 md:grid-cols-5">
            <div className="rounded-2xl bg-zinc-900 p-4 text-white">
              <Users className="h-5 w-5 opacity-80" />
              <div className="mt-2 text-2xl font-semibold">{totalClientes}</div>
              <div className="text-xs opacity-80">clientes filtrados</div>
            </div>

            <div className="rounded-2xl border border-zinc-200 p-4">
              <UserCheck className="h-5 w-5 text-emerald-600" />
              <div className="mt-2 text-2xl font-semibold text-zinc-900">{clientesActivos}</div>
              <div className="text-xs text-zinc-500">activos</div>
            </div>

            <div className="rounded-2xl border border-zinc-200 p-4">
              <Store className="h-5 w-5 text-zinc-500" />
              <div className="mt-2 text-2xl font-semibold text-zinc-900">{clientesConDeuda}</div>
              <div className="text-xs text-zinc-500">con deuda</div>
            </div>

            <div className="rounded-2xl border border-zinc-200 p-4">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              <div className="mt-2 text-2xl font-semibold text-zinc-900">{money(deudaTotal)}</div>
              <div className="text-xs text-zinc-500">deuda total</div>
            </div>

            <div className="rounded-2xl border border-zinc-200 p-4">
              <div className="text-xs font-medium text-zinc-500">Faltan datos</div>
              <div className="mt-2 text-2xl font-semibold text-zinc-900">{clientesSinDatos}</div>
              <div className="text-xs text-zinc-500">sin teléfono o dirección</div>
            </div>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Listado de clientes" subtitle="Tocá una fila para ver la ficha y los movimientos." />

        <CardBody className="p-0">
          {filteredRows.length === 0 ? (
            <div className="p-5">
              <EmptyBlock label="No hay clientes para mostrar." />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1180px] text-left text-sm">
                <thead className="border-b border-zinc-100 bg-zinc-50 text-xs font-medium text-zinc-500">
                  <tr>
                    <th className="px-4 py-3">Cliente</th>
                    <th className="px-4 py-3">Contacto</th>
                    <th className="px-4 py-3">Deuda</th>
                    <th className="px-4 py-3">Vendido</th>
                    <th className="px-4 py-3">Pagado</th>
                    <th className="px-4 py-3">Último pago</th>
                    <th className="px-4 py-3">Última visita</th>
                    <th className="px-4 py-3">Estado</th>
                    <th className="px-4 py-3 text-right">Acciones</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-zinc-100">
                  {filteredRows.map(row => (
                    <tr
                      key={row.id}
                      onClick={() => setSelectedCustomerId(row.id)}
                      className={[
                        "cursor-pointer hover:bg-zinc-50",
                        selectedCustomerId === row.id ? "bg-zinc-50" : ""
                      ].join(" ")}
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium text-zinc-900">{row.nombre}</div>
                        {row.observaciones ? (
                          <div className="mt-1 max-w-[280px] text-xs text-zinc-500">{row.observaciones}</div>
                        ) : null}
                      </td>

                      <td className="px-4 py-3">
                        <div className="text-zinc-700">{row.telefono || "-"}</div>
                        <div className="mt-1 max-w-[280px] text-xs text-zinc-500">
                          {row.direccion || "Sin dirección"}
                        </div>
                      </td>

                      <td className="px-4 py-3 font-semibold text-zinc-900">
                        {money(row.deuda)}
                        {row.saldoFavor > 0 ? (
                          <div className="mt-1 text-xs text-emerald-700">Saldo a favor: {money(row.saldoFavor)}</div>
                        ) : null}
                      </td>

                      <td className="px-4 py-3 text-zinc-700">{money(row.vendido)}</td>
                      <td className="px-4 py-3 text-zinc-700">{money(row.pagado)}</td>

                      <td className="px-4 py-3 text-zinc-700">
                        {row.ultimoPagoFecha ? (
                          <div>
                            <div>{formatDate(row.ultimoPagoFecha)}</div>
                            <div className="mt-1 text-xs text-zinc-500">{money(row.ultimoPagoMonto)}</div>
                          </div>
                        ) : (
                          "-"
                        )}
                      </td>

                      <td className="px-4 py-3 text-zinc-700">
                        {row.ultimaVisita ? (
                          <div>
                            <div>{formatDateTime(row.ultimaVisita)}</div>
                            <div className="mt-1 text-xs text-zinc-500">{row.visitas} visitas</div>
                          </div>
                        ) : (
                          "-"
                        )}
                      </td>

                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-2 py-1 text-xs font-medium ${
                            row.activo ? "bg-emerald-100 text-emerald-700" : "bg-zinc-100 text-zinc-600"
                          }`}
                        >
                          {row.activo ? "Activo" : "Inactivo"}
                        </span>
                      </td>

                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            title="Editar"
                            onClick={event => {
                              event.stopPropagation()
                              openEdit(row)
                            }}
                            className="rounded-xl border border-zinc-200 p-2 hover:bg-zinc-100"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>

                          <button
                            type="button"
                            title={row.activo ? "Desactivar" : "Reactivar"}
                            onClick={event => {
                              event.stopPropagation()
                              toggleActive(row)
                            }}
                            className="rounded-xl border border-zinc-200 p-2 hover:bg-zinc-100"
                          >
                            <RotateCcw className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title={selectedCustomer ? `Ficha · ${selectedCustomer.nombre}` : "Ficha del cliente"}
          subtitle={
            selectedCustomer
              ? `Deuda: ${money(selectedCustomer.deuda)} · Vendido: ${money(selectedCustomer.vendido)} · Pagado: ${money(selectedCustomer.pagado)}`
              : "Seleccioná un cliente para ver sus datos y movimientos."
          }
        />

        <CardBody className="p-0">
          {!selectedCustomer ? (
            <div className="p-5">
              <EmptyBlock label="Seleccioná un cliente del listado." />
            </div>
          ) : (
            <div className="grid gap-0 lg:grid-cols-[340px_1fr]">
              <div className="border-b border-zinc-100 p-5 lg:border-b-0 lg:border-r">
                <div className="space-y-4">
                  <div>
                    <div className="text-xs text-zinc-500">Cliente</div>
                    <div className="mt-1 text-lg font-semibold text-zinc-900">{selectedCustomer.nombre}</div>
                  </div>

                  <div>
                    <div className="text-xs text-zinc-500">Teléfono</div>
                    <div className="mt-1 text-sm text-zinc-900">{selectedCustomer.telefono || "-"}</div>
                  </div>

                  <div>
                    <div className="text-xs text-zinc-500">Dirección</div>
                    <div className="mt-1 text-sm text-zinc-900">{selectedCustomer.direccion || "-"}</div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-2xl border border-zinc-200 p-3">
                      <div className="text-xs text-zinc-500">Deuda</div>
                      <div className="mt-1 font-semibold text-zinc-900">{money(selectedCustomer.deuda)}</div>
                    </div>

                    <div className="rounded-2xl border border-zinc-200 p-3">
                      <div className="text-xs text-zinc-500">Visitas</div>
                      <div className="mt-1 font-semibold text-zinc-900">{selectedCustomer.visitas}</div>
                    </div>
                  </div>

                  {selectedCustomer.observaciones ? (
                    <div>
                      <div className="text-xs text-zinc-500">Observaciones</div>
                      <div className="mt-1 rounded-xl bg-zinc-50 p-3 text-sm text-zinc-700">
                        {selectedCustomer.observaciones}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="overflow-x-auto">
                {selectedMovements.length === 0 ? (
                  <div className="p-5">
                    <EmptyBlock label="Este cliente no tiene movimientos." />
                  </div>
                ) : (
                  <table className="w-full min-w-[780px] text-left text-sm">
                    <thead className="border-b border-zinc-100 bg-zinc-50 text-xs font-medium text-zinc-500">
                      <tr>
                        <th className="px-4 py-3">Fecha</th>
                        <th className="px-4 py-3">Tipo</th>
                        <th className="px-4 py-3">Debe</th>
                        <th className="px-4 py-3">Haber</th>
                        <th className="px-4 py-3">Saldo</th>
                        <th className="px-4 py-3">Descripción</th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-zinc-100">
                      {selectedMovements.slice(0, 20).map(row => (
                        <tr key={row.id} className="hover:bg-zinc-50">
                          <td className="px-4 py-3 text-zinc-700">{formatDate(row.fecha)}</td>
                          <td className="px-4 py-3">
                            <span className={`rounded-full px-2 py-1 text-xs font-medium ${tipoClass(row.tipo)}`}>
                              {row.tipo || "-"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-zinc-900">{row.debe > 0 ? money(row.debe) : "-"}</td>
                          <td className="px-4 py-3 text-zinc-900">{row.haber > 0 ? money(row.haber) : "-"}</td>
                          <td className="px-4 py-3 font-semibold text-zinc-900">{money(row.saldo)}</td>
                          <td className="max-w-[360px] px-4 py-3 text-zinc-700">{row.descripcion || row.referencia || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}
        </CardBody>
      </Card>

      <Modal
        open={creating || !!editingCustomer}
        onClose={closeForm}
        title={editingCustomer ? `Editar cliente · ${editingCustomer.nombre}` : "Nuevo cliente"}
      >
        <form
          className="space-y-4"
          onSubmit={event => {
            event.preventDefault()
            submitForm()
          }}
        >
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-600">Nombre</label>
            <Input
              value={form.nombre}
              onChange={event => setForm(prev => ({ ...prev, nombre: event.target.value }))}
              placeholder="Nombre del comercio"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-600">Teléfono</label>
            <Input
              value={form.telefono}
              onChange={event => setForm(prev => ({ ...prev, telefono: event.target.value }))}
              placeholder="Teléfono"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-600">Dirección</label>
            <Input
              value={form.direccion}
              onChange={event => setForm(prev => ({ ...prev, direccion: event.target.value }))}
              placeholder="Dirección"
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

          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-600">Observaciones</label>
            <textarea
              value={form.observaciones}
              onChange={event => setForm(prev => ({ ...prev, observaciones: event.target.value }))}
              placeholder="Notas internas del cliente..."
              className="min-h-[88px] w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-300"
            />
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
