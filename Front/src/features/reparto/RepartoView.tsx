"use client"

import { useMemo, useState } from "react"
import CrudTableView from "@/features/crud/CrudTableView"
import StockOverviewView from "@/features/reparto/StockOverviewView"
import VisitsOverviewView from "@/features/reparto/VisitsOverviewView"
import PaymentsOverviewView from "@/features/reparto/PaymentsOverviewView"

type TabKey =
  | "delivery_runs"
  | "delivery_routes"
  | "delivery_run_stock"
  | "delivery_visits"
  | "payments"

type TabItem = {
  key: TabKey
  label: string
  title: string
  subtitle: string
}

const mainTabs: TabItem[] = [
  {
    key: "delivery_runs",
    label: "Repartos",
    title: "Repartos",
    subtitle: "Día, repartidor, recorrido, estado y mercadería asignada. Tocá una fila para cargar la mercadería del reparto."
  },
  {
    key: "delivery_routes",
    label: "Recorridos",
    title: "Recorridos",
    subtitle: "Recorridos habilitados. Tocá una fila para ver, agregar o quitar locales del recorrido."
  }
]

const controlTabs: TabItem[] = [
  {
    key: "delivery_run_stock",
    label: "Stock",
    title: "Stock",
    subtitle: "Auditoría de mercadería: salió, entregado, debe volver y pan devuelto."
  },
  {
    key: "delivery_visits",
    label: "Visitas",
    title: "Visitas",
    subtitle: "Vista rápida de visitas, ventas, cobros, deuda y pan viejo."
  },
  {
    key: "payments",
    label: "Pagos",
    title: "Pagos",
    subtitle: "Vista rápida de cobros por cliente, repartidor, método y estado."
  }
]

const allTabs = [...mainTabs, ...controlTabs]

function TabButton({
  active,
  children,
  onClick
}: {
  active: boolean
  children: React.ReactNode
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "rounded-2xl border px-5 py-3 text-sm font-semibold shadow-sm transition",
        active
          ? "border-zinc-900 bg-zinc-900 text-white"
          : "border-zinc-200 bg-white text-zinc-900 hover:bg-zinc-50"
      ].join(" ")}
    >
      {children}
    </button>
  )
}

export default function RepartoView() {
  const [activeTab, setActiveTab] = useState<TabKey>("delivery_runs")

  const active = useMemo(() => {
    return allTabs.find(tab => tab.key === activeTab) || allTabs[0]
  }, [activeTab])

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 border-b border-zinc-200 pb-5 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
            Reparto y rendición
          </h1>
          <p className="mt-1 text-sm text-zinc-600">
            Control de repartidores, mercadería cargada, visitas, pagos y devoluciones.
          </p>
        </div>

        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between xl:min-w-[620px]">
          <div className="flex flex-wrap gap-2">
            {mainTabs.map(tab => (
              <TabButton
                key={tab.key}
                active={activeTab === tab.key}
                onClick={() => setActiveTab(tab.key)}
              >
                {tab.label}
              </TabButton>
            ))}
          </div>

          <div className="hidden h-8 w-px bg-zinc-200 lg:block" />

          <div className="flex flex-wrap gap-2">
            {controlTabs.map(tab => (
              <TabButton
                key={tab.key}
                active={activeTab === tab.key}
                onClick={() => setActiveTab(tab.key)}
              >
                {tab.label}
              </TabButton>
            ))}
          </div>
        </div>
      </div>

      {active.key === "delivery_run_stock" ? (
        <StockOverviewView />
      ) : active.key === "delivery_visits" ? (
        <VisitsOverviewView />
      ) : active.key === "payments" ? (
        <PaymentsOverviewView />
      ) : (
        <CrudTableView
          key={active.key}
          tableName={active.key}
          title={active.title}
          subtitle={active.subtitle}
          embedded
        />
      )}
    </div>
  )
}