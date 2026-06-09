"use client"

import { useState } from "react"
import Button from "@/components/ui/Button"
import CrudTableView from "@/features/crud/CrudTableView"
import CustomerAccountView from "@/features/cuentas/CustomerAccountView"

type TabId = "cuenta_pesos" | "pan_rallado" | "clientes" | "pagos"

const tabs: { id: TabId; label: string }[] = [
  { id: "cuenta_pesos", label: "Cuenta en pesos" },
  { id: "pan_rallado", label: "Pan rallado" },
  { id: "clientes", label: "Clientes" },
  { id: "pagos", label: "Pagos" }
]

export default function CuentasView() {
  const [active, setActive] = useState<TabId>("cuenta_pesos")

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-end">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-zinc-900">
            Cuentas corrientes
          </h1>

          <p className="mt-1 text-sm text-zinc-600">
            Control de deuda, pagos, movimientos y saldos por cliente.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {tabs.map(tab => (
            <Button
              key={tab.id}
              type="button"
              variant={active === tab.id ? "primary" : "secondary"}
              onClick={() => setActive(tab.id)}
              className="whitespace-nowrap"
            >
              {tab.label}
            </Button>
          ))}
        </div>
      </div>

      {active === "cuenta_pesos" ? (
        <CustomerAccountView />
      ) : null}

      {active === "pan_rallado" ? (
        <CrudTableView
          tableName="breadcrumb_account_movements"
          title="Pan rallado"
          subtitle="Pan viejo recibido, pan rallado entregado y ajustes en kg."
        />
      ) : null}

      {active === "clientes" ? (
        <CrudTableView
          tableName="customers"
          title="Clientes"
          subtitle="Comercios vinculados a cuentas corrientes."
        />
      ) : null}

      {active === "pagos" ? (
        <CrudTableView
          tableName="payments"
          title="Pagos"
          subtitle="Pagos registrados por visitas o acreditaciones manuales."
        />
      ) : null}
    </div>
  )
}