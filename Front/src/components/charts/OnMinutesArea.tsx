"use client"

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { formatNumber } from "@/lib/utils"

export default function OnMinutesArea({ data }: { data: { dia: string; ventas: number }[] }) {
  return (
    <div className="h-[260px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ left: 0, right: 12, top: 10, bottom: 0 }}>
          <defs>
            <linearGradient id="onMinutes" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopOpacity={0.25} />
              <stop offset="100%" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <XAxis dataKey="dia" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `${formatNumber(v)}m`} />
          <Tooltip formatter={(v: any) => `${formatNumber(Number(v))} min`} />
          <Area type="monotone" dataKey="ventas" strokeWidth={2} fill="url(#onMinutes)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
