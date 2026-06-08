"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { BarChart3, Boxes, Coffee, Home, PackageOpen, Route, Settings, Shield, ShoppingCart, Users, WalletCards, Wheat, X, Database } from "lucide-react"
import { cn } from "@/lib/utils"
import { useAuth } from "@/features/auth/AuthProvider"

const nav = [
  { href: "/", label: "Dashboard", icon: Home, perms: [] },
  { href: "/reparto", label: "Reparto", icon: Route, perms: ["delivery.read", "admin.crud.read"] },
  { href: "/cuentas", label: "Cuentas", icon: WalletCards, perms: ["accounts.read", "admin.crud.read"] },
  { href: "/clientes", label: "Clientes", icon: Users, perms: ["delivery.read", "admin.crud.read"] },
  { href: "/pan-rallado", label: "Pan rallado", icon: Wheat, perms: ["accounts.read", "delivery.read", "admin.crud.read"] },
  { href: "/ventas", label: "Ventas", icon: ShoppingCart, perms: ["admin.crud.read"] },
  { href: "/productos", label: "Productos", icon: Coffee, perms: ["admin.crud.read"] },
  { href: "/insumos", label: "Insumos", icon: PackageOpen, perms: ["admin.crud.read"] },
  { href: "/inventario", label: "Inventario", icon: Boxes, perms: ["admin.crud.read"] },
  { href: "/produccion", label: "Producción", icon: Database, perms: ["admin.crud.read"] },
  { href: "/personal", label: "Personal", icon: Users, perms: ["admin.crud.read"] },
  { href: "/reportes", label: "Reportes", icon: BarChart3, perms: ["accounts.read", "delivery.read", "admin.crud.read"] },
  { href: "/seguridad", label: "Seguridad", icon: Shield, perms: ["security.users.read", "security.roles.read", "admin.crud.read"] },
  { href: "/configuracion", label: "Configuración", icon: Settings, perms: [] }
]

export default function SidebarMobile({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname()
  const { can } = useAuth()
  const visible = nav.filter(item => item.perms.length === 0 || can(...item.perms))

  return (
    <div className={cn("fixed inset-0 z-50 md:hidden", open ? "" : "pointer-events-none")}>
      <div className={cn("absolute inset-0 bg-black/30 transition-opacity", open ? "opacity-100" : "opacity-0")} onClick={onClose} />
      <div className={cn("absolute left-0 top-0 h-full w-[300px] overflow-y-auto bg-white shadow-soft transition-transform", open ? "translate-x-0" : "-translate-x-full")}>
        <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-4">
          <div className="text-sm font-semibold">Panadería Rincón</div>
          <button className="rounded-xl p-2 hover:bg-zinc-100" onClick={onClose} aria-label="Cerrar"><X className="h-5 w-5" /></button>
        </div>
        <nav className="space-y-1 p-3">
          {visible.map(item => {
            const active = pathname === item.href || (item.href !== "/" && pathname?.startsWith(item.href))
            const Icon = item.icon
            return (
              <Link key={item.href} href={item.href} onClick={onClose} className={cn("flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm transition-colors", active ? "bg-zinc-900 text-white" : "text-zinc-700 hover:bg-zinc-100")}>
                <Icon className="h-4 w-4" /><span>{item.label}</span>
              </Link>
            )
          })}
        </nav>
      </div>
    </div>
  )
}
