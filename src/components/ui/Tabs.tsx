"use client"

import { cn } from "@/lib/utils"
import { useState } from "react"

export type Tab = { key: string; label: string; content: React.ReactNode }

export default function Tabs({ tabs, initialKey }: { tabs: Tab[]; initialKey?: string }) {
  const [active, setActive] = useState(initialKey ?? tabs[0]?.key)
  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setActive(t.key)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-sm transition-colors",
              active === t.key
                ? "border-zinc-900 bg-zinc-900 text-white"
                : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="mt-4">{tabs.find(t => t.key === active)?.content}</div>
    </div>
  )
}
