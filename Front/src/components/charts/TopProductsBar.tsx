"use client"

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { formatCurrencyARS } from "@/lib/utils"

export default function TopProductsBar({ data }: { data: { nombre: string; ventas: number }[] }) {
  return (
    <div className="h-[260px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ left: 0, right: 12, top: 10, bottom: 0 }}>
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <XAxis dataKey="nombre" tick={{ fontSize: 11 }} interval={0} angle={-15} height={55} />
          <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
          <Tooltip formatter={(v: any) => formatCurrencyARS(Number(v))} />
          <Bar dataKey="ventas" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
