"use client"

import { useState } from "react"
import Button from "@/components/ui/Button"
import CrudTableView from "@/features/crud/CrudTableView"
import { cn } from "@/lib/utils"

export type ResourceTab = {
  table: string
  label: string
  description?: string
}

export default function ResourceTabs({ title, subtitle, tabs }: { title: string; subtitle?: string; tabs: ResourceTab[] }) {
  const [active, setActive] = useState(tabs[0]?.table)
  const current = tabs.find(t => t.table === active) || tabs[0]

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-end">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
          {subtitle ? <p className="mt-1 text-sm text-zinc-600">{subtitle}</p> : null}
        </div>
        <div className="flex flex-wrap gap-2">
          {tabs.map(tab => (
            <Button key={tab.table} variant={tab.table === active ? "primary" : "secondary"} onClick={() => setActive(tab.table)} className={cn("whitespace-nowrap")}>{tab.label}</Button>
          ))}
        </div>
      </div>

      {current ? <CrudTableView tableName={current.table} title={current.label} subtitle={current.description} embedded /> : null}
    </div>
  )
}
