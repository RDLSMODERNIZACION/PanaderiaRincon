"use client"

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { formatNumber } from "@/lib/utils"

export default function HoursByRole({ data }: { data: { rol: string; horas: number }[] }) {
  return (
    <div className="h-[260px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ left: 0, right: 12, top: 10, bottom: 0 }}>
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <XAxis dataKey="rol" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => formatNumber(v)} />
          <Tooltip formatter={(v: any) => `${formatNumber(Number(v))} hs`} />
          <Bar dataKey="horas" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
