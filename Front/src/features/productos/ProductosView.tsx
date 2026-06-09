"use client"

import { useState } from "react"
import Button from "@/components/ui/Button"
import CrudTableView from "@/features/crud/CrudTableView"
import ProductDiscountRulesView from "@/features/productos/ProductDiscountRulesView"

type TabId = "productos" | "descuentos"

const tabs: { id: TabId; label: string }[] = [
  { id: "productos", label: "Productos" },
  { id: "descuentos", label: "Descuentos" }
]

export default function ProductosView() {
  const [active, setActive] = useState<TabId>("productos")

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-end">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-zinc-900">Productos</h1>
          <p className="mt-1 text-sm text-zinc-600">
            Catálogo, precios base y reglas comerciales aplicadas al reparto.
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

      {active === "productos" ? (
        <CrudTableView
          tableName="products"
          title="Productos"
          subtitle="Catálogo real conectado al backend."
          embedded
        />
      ) : null}

      {active === "descuentos" ? <ProductDiscountRulesView /> : null}
    </div>
  )
}
