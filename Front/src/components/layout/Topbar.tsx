"use client"

import { Search, Bell, ChevronDown, Menu } from "lucide-react"
import Input from "@/components/ui/Input"
import { useState } from "react"
import SidebarMobile from "./SidebarMobile"
import Select from "@/components/ui/Select"

export default function Topbar() {
  const [open, setOpen] = useState(false)

  return (
    <header className="sticky top-0 z-30 border-b border-zinc-200 bg-white/80 backdrop-blur">
      <div className="flex items-center gap-3 px-4 py-3 md:px-6">
        <button className="rounded-xl p-2 hover:bg-zinc-100 md:hidden" onClick={() => setOpen(true)} aria-label="Abrir menú">
          <Menu className="h-5 w-5" />
        </button>

        <div className="hidden md:block w-[360px]">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-5 w-5 text-zinc-400" />
            <Input className="pl-10" placeholder="Buscar (demo visual)…" />
          </div>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <div className="hidden sm:block w-[170px]">
            <Select defaultValue="30d" aria-label="Rango">
              <option value="7d">Últimos 7 días</option>
              <option value="14d">Últimos 14 días</option>
              <option value="30d">Últimos 30 días</option>
            </Select>
          </div>

          <button className="rounded-xl p-2 hover:bg-zinc-100" aria-label="Notificaciones">
            <Bell className="h-5 w-5 text-zinc-700" />
          </button>

          <button className="flex items-center gap-2 rounded-xl border border-zinc-200 px-3 py-2 hover:bg-zinc-50">
            <div className="grid h-7 w-7 place-items-center rounded-full bg-zinc-900 text-xs font-semibold text-white">PA</div>
            <div className="hidden sm:block text-left leading-tight">
              <div className="text-xs font-semibold">Panadería Admin</div>
              <div className="text-[11px] text-zinc-500">demo@local</div>
            </div>
            <ChevronDown className="h-4 w-4 text-zinc-500" />
          </button>
        </div>
      </div>

      <SidebarMobile open={open} onClose={() => setOpen(false)} />
    </header>
  )
}
