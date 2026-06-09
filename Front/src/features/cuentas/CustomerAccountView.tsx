"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { AlertTriangle, Download, Plus, RefreshCw, Search, UserRound, WalletCards } from "lucide-react"
import Button from "@/components/ui/Button"
import Input from "@/components/ui/Input"
import Select from "@/components/ui/Select"
import Modal from "@/components/ui/Modal"
import { Card, CardBody, CardHeader } from "@/components/ui/Card"
import { EmptyBlock, ErrorBlock, LoadingBlock } from "@/components/data/AsyncState"
import { useAuth } from "@/features/auth/AuthProvider"
import { apiGet, createRow, unwrapData } from "@/lib/api"
import { downloadCsv } from "@/lib/csv"
import type { RowData } from "@/features/crud/types"

type DebtLot = {
  fecha: string
  amount: number
}

type CustomerAccountRow = {
  customerId: string
  cliente: string
  direccion: string
  telefono: string

  deuda: number
  saldoFavor: number
  desde: string
  diasDeuda: number

  totalDebe: number
  totalPagado: number
  totalHaber: number
  totalAjustes: number

  ultimoPagoFecha: string
  ultimoPagoMonto: number
  movimientos: number
}

type MovementDetailRow = {
  id: string
  customerId: string
  fecha: string
  tipo: string
  debe: number
  haber: number
  saldo: number
  descripcion: string
  referencia: string
}

type EstadoFiltro = "" | "con_deuda" | "sin_deuda" | "saldo_favor"
type AntiguedadFiltro = "" | "0_7" | "8_30" | "31_60" | "61_plus"
type PaymentMethod = "efectivo" | "transferencia" | "qr" | "mercado_pago" | "otro"

function getId(row?: RowData) {
  return String(row?.id || "")
}

function getName(row?: RowData) {
  return String(row?.nombre || row?.name || row?.email || row?.id || "")
}

function getCustomerId(row?: RowData) {
  return String(row?.customerId || row?.customer_id || "")
}

function getFecha(row?: RowData) {
  return String(row?.fecha || row?.createdAt || row?.created_at || "")
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

function getDescripcion(row?: RowData) {
  return String(row?.descripcion || row?.description || "")
}

function getReference(row?: RowData) {
  return String(row?.referenceType || row?.reference_type || "")
}

function getReferenceId(row?: RowData) {
  return String(row?.referenceId || row?.reference_id || "")
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

function money(value: number) {
  return `$ ${Number(value || 0).toLocaleString("es-AR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  })}`
}

function normalize(text: unknown) {
  return String(text || "").toLowerCase()
}

function daysSince(value: string) {
  if (!value) return 0

  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return 0

  const now = new Date()
  const diff = now.getTime() - d.getTime()

  return Math.max(Math.floor(diff / (1000 * 60 * 60 * 24)), 0)
}

function ageLabel(days: number) {
  if (days <= 0) return "Hoy"
  if (days === 1) return "1 día"
  return `${days} días`
}

function debtAgeClass(days: number) {
  if (days >= 60) return "bg-red-100 text-red-700"
  if (days >= 30) return "bg-amber-100 text-amber-800"
  if (days > 0) return "bg-blue-100 text-blue-700"
  return "bg-zinc-100 text-zinc-700"
}

function tipoClass(tipo: string) {
  if (tipo === "venta") return "bg-red-100 text-red-700"
  if (tipo === "pago") return "bg-emerald-100 text-emerald-700"
  if (tipo === "nota_credito") return "bg-blue-100 text-blue-700"
  if (tipo === "ajuste_admin") return "bg-amber-100 text-amber-800"
  if (tipo === "saldo_inicial") return "bg-zinc-100 text-zinc-700"
  return "bg-zinc-100 text-zinc-700"
}

function methodLabel(value: PaymentMethod | string) {
  if (value === "efectivo") return "Efectivo"
  if (value === "transferencia") return "Transferencia"
  if (value === "qr") return "QR"
  if (value === "mercado_pago") return "Mercado Pago"
  if (value === "otro") return "Otro"
  return value || "-"
}

function parseAmount(value: string) {
  const normalized = String(value || "")
    .replace(/\./g, "")
    .replace(",", ".")

  const n = Number(normalized)
  return Number.isFinite(n) ? n : 0
}

function buildCustomerAccount(customer: RowData, movements: RowData[]): CustomerAccountRow {
  const sorted = [...movements].sort((a, b) => dateValue(getFecha(a)) - dateValue(getFecha(b)))

  const lots: DebtLot[] = []
  let credit = 0

  let totalDebe = 0
  let totalHaber = 0
  let totalPagado = 0
  let totalAjustes = 0
  let ultimoPagoFecha = ""
  let ultimoPagoMonto = 0

  for (const movement of sorted) {
    let debe = getDebe(movement)
    const haber = getHaber(movement)
    const tipo = getTipo(movement)
    const fecha = getFecha(movement)

    totalDebe += debe
    totalHaber += haber

    if (tipo === "pago" && haber > 0) {
      totalPagado += haber
      ultimoPagoFecha = fecha
      ultimoPagoMonto = haber
    }

    if (tipo === "ajuste_admin" || tipo === "nota_credito" || tipo === "saldo_inicial") {
      totalAjustes += debe - haber
    }

    if (debe > 0) {
      if (credit > 0) {
        const used = Math.min(credit, debe)
        credit -= used
        debe -= used
      }

      if (debe > 0) {
        lots.push({
          fecha,
          amount: debe
        })
      }
    }

    if (haber > 0) {
      let remaining = haber

      while (remaining > 0 && lots.length > 0) {
        const lot = lots[0]
        const used = Math.min(lot.amount, remaining)

        lot.amount -= used
        remaining -= used

        if (lot.amount <= 0.0001) {
          lots.shift()
        }
      }

      if (remaining > 0) {
        credit += remaining
      }
    }
  }

  const rawBalance = totalDebe - totalHaber
  const deuda = Math.max(rawBalance, 0)
  const saldoFavor = Math.max(-rawBalance, 0)

  const oldestLot = lots.find(lot => lot.amount > 0.0001)
  const desde = deuda > 0 ? oldestLot?.fecha || "" : ""
  const diasDeuda = desde ? daysSince(desde) : 0

  return {
    customerId: getId(customer),
    cliente: getName(customer),
    direccion: String(customer.direccion || ""),
    telefono: String(customer.telefono || ""),

    deuda,
    saldoFavor,
    desde,
    diasDeuda,

    totalDebe,
    totalPagado,
    totalHaber,
    totalAjustes,

    ultimoPagoFecha,
    ultimoPagoMonto,
    movimientos: movements.length
  }
}

function buildMovementDetails(movements: RowData[]) {
  const sorted = [...movements].sort((a, b) => dateValue(getFecha(a)) - dateValue(getFecha(b)))

  let saldo = 0

  const details: MovementDetailRow[] = sorted.map(movement => {
    const debe = getDebe(movement)
    const haber = getHaber(movement)

    saldo += debe - haber

    return {
      id: getId(movement),
      customerId: getCustomerId(movement),
      fecha: getFecha(movement),
      tipo: getTipo(movement),
      debe,
      haber,
      saldo,
      descripcion: getDescripcion(movement),
      referencia: [getReference(movement), getReferenceId(movement)].filter(Boolean).join(" · ")
    }
  })

  return details.reverse()
}

export default function CustomerAccountView() {
  const { session } = useAuth()

  const [customers, setCustomers] = useState<RowData[]>([])
  const [movements, setMovements] = useState<RowData[]>([])
  const [selectedCustomerId, setSelectedCustomerId] = useState("")
  const [q, setQ] = useState("")
  const [estado, setEstado] = useState<EstadoFiltro>("")
  const [antiguedad, setAntiguedad] = useState<AntiguedadFiltro>("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [paymentCustomer, setPaymentCustomer] = useState<CustomerAccountRow | null>(null)
  const [paymentAmount, setPaymentAmount] = useState("")
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("efectivo")
  const [paymentReference, setPaymentReference] = useState("")
  const [paymentNotes, setPaymentNotes] = useState("")
  const [paymentError, setPaymentError] = useState<string | null>(null)
  const [savingPayment, setSavingPayment] = useState(false)

  const load = useCallback(async () => {
    if (!session) return

    setLoading(true)
    setError(null)

    try {
      const [customersPayload, movementsPayload] = await Promise.all([
        apiGet(session, "/api/admin/crud/customers?limit=1000&order_by=nombre"),
        apiGet(session, "/api/admin/crud/customer_account_movements?limit=1000&order_by=fecha&desc=true")
      ])

      setCustomers(unwrapData<RowData[]>(customersPayload) || [])
      setMovements(unwrapData<RowData[]>(movementsPayload) || [])
    } catch (exc: any) {
      setError(exc?.message || "No se pudo cargar la cuenta corriente")
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

      if (!map.has(customerId)) {
        map.set(customerId, [])
      }

      map.get(customerId)!.push(movement)
    }

    return map
  }, [movements])

  const accountRows = useMemo(() => {
    return customers
      .map(customer => buildCustomerAccount(customer, movementsByCustomer.get(getId(customer)) || []))
      .sort((a, b) => {
        if (b.deuda !== a.deuda) return b.deuda - a.deuda
        return b.diasDeuda - a.diasDeuda
      })
  }, [customers, movementsByCustomer])

  const filteredRows = useMemo(() => {
    const search = q.trim().toLowerCase()

    return accountRows.filter(row => {
      if (estado === "con_deuda" && row.deuda <= 0) return false
      if (estado === "sin_deuda" && row.deuda > 0) return false
      if (estado === "saldo_favor" && row.saldoFavor <= 0) return false

      if (antiguedad === "0_7" && !(row.diasDeuda >= 0 && row.diasDeuda <= 7 && row.deuda > 0)) return false
      if (antiguedad === "8_30" && !(row.diasDeuda >= 8 && row.diasDeuda <= 30 && row.deuda > 0)) return false
      if (antiguedad === "31_60" && !(row.diasDeuda >= 31 && row.diasDeuda <= 60 && row.deuda > 0)) return false
      if (antiguedad === "61_plus" && !(row.diasDeuda >= 61 && row.deuda > 0)) return false

      if (!search) return true

      const text = [
        row.cliente,
        row.direccion,
        row.telefono,
        row.deuda,
        row.totalPagado,
        row.desde
      ]
        .map(normalize)
        .join(" ")

      return text.includes(search)
    })
  }, [accountRows, q, estado, antiguedad])

  const selectedCustomer = useMemo(() => {
    if (!selectedCustomerId) return null
    return accountRows.find(row => row.customerId === selectedCustomerId) || null
  }, [accountRows, selectedCustomerId])

  const selectedMovements = useMemo(() => {
    if (!selectedCustomerId) return []
    return buildMovementDetails(movementsByCustomer.get(selectedCustomerId) || [])
  }, [selectedCustomerId, movementsByCustomer])

  const totalDeuda = useMemo(() => filteredRows.reduce((sum, row) => sum + row.deuda, 0), [filteredRows])
  const totalPagado = useMemo(() => filteredRows.reduce((sum, row) => sum + row.totalPagado, 0), [filteredRows])
  const clientesConDeuda = useMemo(() => filteredRows.filter(row => row.deuda > 0).length, [filteredRows])
  const deudaVieja = useMemo(() => {
    return filteredRows
      .filter(row => row.deuda > 0 && row.diasDeuda >= 30)
      .reduce((sum, row) => sum + row.deuda, 0)
  }, [filteredRows])

  const paymentAmountNumber = useMemo(() => parseAmount(paymentAmount), [paymentAmount])

  const remainingDebtAfterPayment = useMemo(() => {
    if (!paymentCustomer) return 0
    return Math.max(paymentCustomer.deuda - paymentAmountNumber, 0)
  }, [paymentCustomer, paymentAmountNumber])

  const paymentIsInvalid = useMemo(() => {
    if (!paymentCustomer) return true
    if (!Number.isFinite(paymentAmountNumber)) return true
    if (paymentAmountNumber <= 0) return true
    if (paymentAmountNumber > paymentCustomer.deuda) return true
    return false
  }, [paymentCustomer, paymentAmountNumber])

  function resetPaymentModal() {
    setPaymentCustomer(null)
    setPaymentAmount("")
    setPaymentMethod("efectivo")
    setPaymentReference("")
    setPaymentNotes("")
    setPaymentError(null)
  }

  function openPaymentModal(row: CustomerAccountRow) {
    setSelectedCustomerId(row.customerId)

    if (row.deuda <= 0) return

    setPaymentCustomer(row)
    setPaymentAmount(String(row.deuda))
    setPaymentMethod("efectivo")
    setPaymentReference("")
    setPaymentNotes("")
    setPaymentError(null)
  }

  function closePaymentModal() {
    if (savingPayment) return
    resetPaymentModal()
  }

  async function submitPayment() {
    if (!session || !paymentCustomer) return

    setPaymentError(null)

    if (paymentAmountNumber <= 0) {
      setPaymentError("El monto debe ser mayor a cero.")
      return
    }

    if (paymentAmountNumber > paymentCustomer.deuda) {
      setPaymentError("El monto no puede superar la deuda actual del cliente.")
      return
    }

    setSavingPayment(true)

    try {
      const customerId = paymentCustomer.customerId
      const now = new Date()
      const manualReferenceId = `manual_${now.getTime()}`
      const referenceText = paymentReference.trim()
      const notesText = paymentNotes.trim()

      const description = [
        "Pago manual acreditado desde Cuentas",
        `Método: ${methodLabel(paymentMethod)}`,
        referenceText ? `Referencia: ${referenceText}` : "",
        notesText ? `Nota: ${notesText}` : ""
      ]
        .filter(Boolean)
        .join(" · ")

      await createRow(session, "customer_account_movements", {
        customer_id: customerId,
        fecha: now.toISOString(),
        tipo: "pago",
        debe: 0,
        haber: paymentAmountNumber,
        descripcion: description,
        reference_type: "manual_debt_payment",
        reference_id: manualReferenceId
      })

      setSelectedCustomerId(customerId)
      resetPaymentModal()
      await load()
    } catch (exc: any) {
      setPaymentError(exc?.message || "No se pudo acreditar el pago.")
    } finally {
      setSavingPayment(false)
    }
  }

  function clearFilters() {
    setQ("")
    setEstado("")
    setAntiguedad("")
  }

  function exportRows() {
    downloadCsv(`cuenta_corriente_clientes_${new Date().toISOString().slice(0, 10)}.csv`, filteredRows)
  }

  if (loading) return <LoadingBlock />
  if (error) return <ErrorBlock error={error} onRetry={load} />

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader
          title="Cuenta en pesos"
          subtitle="Control de deuda, pagos y movimientos por cliente."
          right={
            <div className="flex flex-wrap justify-end gap-2">
              <div className="relative w-full sm:w-[300px]">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
                <Input
                  value={q}
                  onChange={e => setQ(e.target.value)}
                  placeholder="Buscar cliente, dirección o teléfono..."
                  className="pl-9"
                />
              </div>

              <Select
                value={estado}
                onChange={e => setEstado(e.target.value as EstadoFiltro)}
                className="w-full sm:w-[170px]"
              >
                <option value="">Todos</option>
                <option value="con_deuda">Con deuda</option>
                <option value="sin_deuda">Sin deuda</option>
                <option value="saldo_favor">Saldo a favor</option>
              </Select>

              <Select
                value={antiguedad}
                onChange={e => setAntiguedad(e.target.value as AntiguedadFiltro)}
                className="w-full sm:w-[190px]"
              >
                <option value="">Toda antigüedad</option>
                <option value="0_7">0 a 7 días</option>
                <option value="8_30">8 a 30 días</option>
                <option value="31_60">31 a 60 días</option>
                <option value="61_plus">Más de 60 días</option>
              </Select>

              {(q || estado || antiguedad) ? (
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
            </div>
          }
        />

        <CardBody>
          <div className="grid gap-3 md:grid-cols-4">
            <div className="rounded-2xl bg-zinc-900 p-4 text-white">
              <WalletCards className="h-5 w-5 opacity-80" />
              <div className="mt-2 text-2xl font-semibold">{money(totalDeuda)}</div>
              <div className="text-xs opacity-80">deuda total</div>
            </div>

            <div className="rounded-2xl border border-zinc-200 p-4">
              <UserRound className="h-5 w-5 text-zinc-500" />
              <div className="mt-2 text-2xl font-semibold text-zinc-900">{clientesConDeuda}</div>
              <div className="text-xs text-zinc-500">clientes con deuda</div>
            </div>

            <div className="rounded-2xl border border-zinc-200 p-4">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              <div className="mt-2 text-2xl font-semibold text-zinc-900">{money(deudaVieja)}</div>
              <div className="text-xs text-zinc-500">deuda mayor a 30 días</div>
            </div>

            <div className="rounded-2xl border border-zinc-200 p-4">
              <div className="text-xs font-medium text-zinc-500">Pagado histórico</div>
              <div className="mt-2 text-2xl font-semibold text-zinc-900">{money(totalPagado)}</div>
            </div>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Clientes"
          subtitle="Tocá una fila para ver movimientos. Usá el signo + para acreditar un pago."
        />

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
                    <th className="px-4 py-3">Deuda actual</th>
                    <th className="px-4 py-3">Desde</th>
                    <th className="px-4 py-3">Antigüedad</th>
                    <th className="px-4 py-3">Pagó total</th>
                    <th className="px-4 py-3">Último pago</th>
                    <th className="px-4 py-3">Ventas / cargos</th>
                    <th className="px-4 py-3">Movimientos</th>
                    <th className="px-4 py-3 text-center">Acreditar</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-zinc-100">
                  {filteredRows.map(row => (
                    <tr
                      key={row.customerId}
                      onClick={() => setSelectedCustomerId(row.customerId)}
                      className={[
                        "cursor-pointer hover:bg-zinc-50",
                        selectedCustomerId === row.customerId ? "bg-zinc-50" : ""
                      ].join(" ")}
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium text-zinc-900">{row.cliente}</div>
                        {row.direccion ? <div className="mt-1 text-xs text-zinc-500">{row.direccion}</div> : null}
                        {row.telefono ? <div className="mt-1 text-xs text-zinc-500">{row.telefono}</div> : null}
                      </td>

                      <td className="px-4 py-3 font-semibold text-zinc-900">
                        <div>{money(row.deuda)}</div>

                        {row.saldoFavor > 0 ? (
                          <div className="mt-1 text-xs text-emerald-700">
                            Saldo a favor: {money(row.saldoFavor)}
                          </div>
                        ) : null}
                      </td>

                      <td className="px-4 py-3 text-zinc-700">
                        {row.desde ? formatDate(row.desde) : "-"}
                      </td>

                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2 py-1 text-xs font-medium ${debtAgeClass(row.diasDeuda)}`}>
                          {row.deuda > 0 ? ageLabel(row.diasDeuda) : "Sin deuda"}
                        </span>
                      </td>

                      <td className="px-4 py-3 text-zinc-700">{money(row.totalPagado)}</td>

                      <td className="px-4 py-3 text-zinc-700">
                        {row.ultimoPagoFecha ? (
                          <div>
                            <div>{formatDate(row.ultimoPagoFecha)}</div>
                            <div className="mt-1 text-xs text-zinc-500">{money(row.ultimoPagoMonto)}</div>
                          </div>
                        ) : "-"}
                      </td>

                      <td className="px-4 py-3 text-zinc-700">{money(row.totalDebe)}</td>
                      <td className="px-4 py-3 text-zinc-700">{row.movimientos}</td>

                      <td className="px-4 py-3 text-center">
                        {row.deuda > 0 ? (
                          <button
                            type="button"
                            title="Acreditar pago"
                            onClick={event => {
                              event.stopPropagation()
                              openPaymentModal(row)
                            }}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-zinc-900 text-white shadow-sm hover:bg-zinc-800"
                          >
                            <Plus className="h-4 w-4" />
                          </button>
                        ) : (
                          <span className="text-xs text-zinc-400">-</span>
                        )}
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
          title={selectedCustomer ? `Movimientos · ${selectedCustomer.cliente}` : "Movimientos del cliente"}
          subtitle={
            selectedCustomer
              ? `Deuda actual: ${money(selectedCustomer.deuda)} · Desde: ${
                  selectedCustomer.desde ? formatDate(selectedCustomer.desde) : "-"
                }`
              : "Seleccioná un cliente de la tabla superior para ver el detalle."
          }
        />

        <CardBody className="p-0">
          {!selectedCustomer ? (
            <div className="p-5">
              <EmptyBlock label="Seleccioná un cliente para ver sus registros." />
            </div>
          ) : selectedMovements.length === 0 ? (
            <div className="p-5">
              <EmptyBlock label="Este cliente no tiene movimientos." />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[960px] text-left text-sm">
                <thead className="border-b border-zinc-100 bg-zinc-50 text-xs font-medium text-zinc-500">
                  <tr>
                    <th className="px-4 py-3">Fecha</th>
                    <th className="px-4 py-3">Tipo</th>
                    <th className="px-4 py-3">Debe</th>
                    <th className="px-4 py-3">Haber / pago</th>
                    <th className="px-4 py-3">Saldo</th>
                    <th className="px-4 py-3">Descripción</th>
                    <th className="px-4 py-3">Referencia</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-zinc-100">
                  {selectedMovements.map(row => (
                    <tr key={row.id} className="hover:bg-zinc-50">
                      <td className="px-4 py-3 text-zinc-700">{formatDate(row.fecha)}</td>

                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2 py-1 text-xs font-medium ${tipoClass(row.tipo)}`}>
                          {row.tipo}
                        </span>
                      </td>

                      <td className="px-4 py-3 text-zinc-900">{row.debe > 0 ? money(row.debe) : "-"}</td>
                      <td className="px-4 py-3 text-zinc-900">{row.haber > 0 ? money(row.haber) : "-"}</td>
                      <td className="px-4 py-3 font-semibold text-zinc-900">{money(row.saldo)}</td>
                      <td className="max-w-[360px] px-4 py-3 text-zinc-700">{row.descripcion || "-"}</td>
                      <td className="px-4 py-3 text-zinc-500">{row.referencia || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>

      <Modal
        open={!!paymentCustomer}
        onClose={closePaymentModal}
        title={paymentCustomer ? `Acreditar pago · ${paymentCustomer.cliente}` : "Acreditar pago"}
      >
        {paymentCustomer ? (
          <form
            className="space-y-4"
            onSubmit={event => {
              event.preventDefault()
              submitPayment()
            }}
          >
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-zinc-200 p-3">
                <div className="text-xs text-zinc-500">Deuda actual</div>
                <div className="mt-1 text-lg font-semibold text-zinc-900">{money(paymentCustomer.deuda)}</div>
              </div>

              <div className="rounded-2xl border border-zinc-200 p-3">
                <div className="text-xs text-zinc-500">Antigüedad</div>
                <div className="mt-1 text-lg font-semibold text-zinc-900">
                  {paymentCustomer.deuda > 0 ? ageLabel(paymentCustomer.diasDeuda) : "-"}
                </div>
              </div>

              <div className="rounded-2xl border border-zinc-200 p-3">
                <div className="text-xs text-zinc-500">Luego del pago</div>
                <div className="mt-1 text-lg font-semibold text-zinc-900">{money(remainingDebtAfterPayment)}</div>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-600">
                Monto a acreditar
              </label>

              <Input
                type="number"
                min="0"
                max={paymentCustomer.deuda}
                step="0.01"
                value={paymentAmount}
                onChange={event => setPaymentAmount(event.target.value)}
                placeholder="Monto"
              />

              <div className="mt-2 flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setPaymentAmount(String(paymentCustomer.deuda))}
                >
                  Cancelar total
                </Button>

                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setPaymentAmount(String(Math.round(paymentCustomer.deuda / 2)))}
                >
                  50%
                </Button>

                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setPaymentAmount("")}
                >
                  Limpiar monto
                </Button>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-600">
                Método de pago
              </label>

              <Select
                value={paymentMethod}
                onChange={event => setPaymentMethod(event.target.value as PaymentMethod)}
              >
                <option value="efectivo">Efectivo</option>
                <option value="transferencia">Transferencia</option>
                <option value="qr">QR</option>
                <option value="mercado_pago">Mercado Pago</option>
                <option value="otro">Otro</option>
              </Select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-600">
                Referencia / comprobante
              </label>

              <Input
                value={paymentReference}
                onChange={event => setPaymentReference(event.target.value)}
                placeholder="Ej: transferencia, nro comprobante, efectivo caja..."
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-600">
                Observación
              </label>

              <textarea
                value={paymentNotes}
                onChange={event => setPaymentNotes(event.target.value)}
                placeholder="Nota interna opcional..."
                className="min-h-[88px] w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-300"
              />
            </div>

            {paymentError ? (
              <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {paymentError}
              </div>
            ) : null}

            {paymentAmountNumber > paymentCustomer.deuda ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                El pago no puede superar la deuda actual. Para saldo a favor se debería manejar como otro tipo de movimiento.
              </div>
            ) : null}

            <div className="flex justify-end gap-2 border-t border-zinc-100 pt-4">
              <Button type="button" variant="secondary" onClick={closePaymentModal} disabled={savingPayment}>
                Cancelar
              </Button>

              <Button type="submit" disabled={savingPayment || paymentIsInvalid}>
                {savingPayment ? "Acreditando..." : "Acreditar pago"}
              </Button>
            </div>
          </form>
        ) : null}
      </Modal>
    </div>
  )
}