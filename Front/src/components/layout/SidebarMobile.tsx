"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { BarChart3, Boxes, Coffee, Factory, Home, Settings, ShoppingCart, Users, X } from "lucide-react"

const nav = [
  { href: "/", label: "Dashboard", icon: Home },
  { href: "/ventas", label: "Ventas", icon: ShoppingCart },
  { href: "/productos", label: "Productos", icon: Coffee },
  { href: "/produccion", label: "Producción", icon: Factory },
  { href: "/inventario", label: "Inventario", icon: Boxes },
  { href: "/personal", label: "Personal", icon: Users },
  { href: "/reportes", label: "Reportes", icon: BarChart3 },
  { href: "/configuracion", label: "Configuración", icon: Settings }
]

export default function SidebarMobile({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname()
  return (
    <div className={cn("fixed inset-0 z-50 md:hidden", open ? "" : "pointer-events-none")}>
      <div className={cn("absolute inset-0 bg-black/30 transition-opacity", open ? "opacity-100" : "opacity-0")} onClick={onClose} />
      <div className={cn("absolute left-0 top-0 h-full w-[290px] bg-white shadow-soft transition-transform", open ? "translate-x-0" : "-translate-x-full")}>
        <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-4">
          <div className="text-sm font-semibold">Panadería</div>
          <button className="rounded-xl p-2 hover:bg-zinc-100" onClick={onClose} aria-label="Cerrar">
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav className="p-3 space-y-1">
          {nav.map(item => {
            const active = pathname === item.href
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={cn(
                  "flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm transition-colors",
                  active ? "bg-zinc-900 text-white" : "text-zinc-700 hover:bg-zinc-100"
                )}
              >
                <Icon className="h-4 w-4" />
                <span>{item.label}</span>
              </Link>
            )
          })}
        </nav>
      </div>
    </div>
  )
}
