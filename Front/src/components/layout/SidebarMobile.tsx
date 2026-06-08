"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  BarChart3,
  Boxes,
  Coffee,
  Database,
  Home,
  PackageOpen,
  Route,
  Settings,
  Shield,
  ShoppingCart,
  Truck,
  Users,
  WalletCards,
  Wheat,
  X
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useAuth } from "@/features/auth/AuthProvider"

const nav = [
  { href: "/", label: "Dashboard", icon: Home, perms: ["admin.menu"] },

  { href: "/mi-reparto", label: "Mi reparto", icon: Truck, perms: ["delivery.self"] },

  { href: "/reparto", label: "Reparto", icon: Route, perms: ["delivery.admin"] },

  { href: "/cuentas", label: "Cuentas", icon: WalletCards, perms: ["admin.menu"] },
  { href: "/clientes", label: "Clientes", icon: Users, perms: ["admin.menu"] },
  { href: "/pan-rallado", label: "Pan rallado", icon: Wheat, perms: ["admin.menu"] },

  { href: "/ventas", label: "Ventas", icon: ShoppingCart, perms: ["admin.menu"] },
  { href: "/productos", label: "Productos", icon: Coffee, perms: ["admin.menu"] },
  { href: "/insumos", label: "Insumos", icon: PackageOpen, perms: ["admin.menu"] },
  { href: "/inventario", label: "Inventario", icon: Boxes, perms: ["admin.menu"] },
  { href: "/produccion", label: "Producción", icon: Database, perms: ["admin.menu"] },
  { href: "/personal", label: "Personal", icon: Users, perms: ["admin.menu"] },

  { href: "/reportes", label: "Reportes", icon: BarChart3, perms: ["admin.menu"] },
  { href: "/seguridad", label: "Seguridad", icon: Shield, perms: ["admin.menu"] },
  { href: "/admin", label: "CRUD completo", icon: Database, perms: ["admin.menu"] },
  { href: "/configuracion", label: "Configuración", icon: Settings, perms: ["admin.menu"] }
]

export default function SidebarMobile({
  open,
  onClose
}: {
  open: boolean
  onClose: () => void
}) {
  const pathname = usePathname()
  const { can } = useAuth()

  const visible = nav.filter(item => item.perms.length === 0 || can(...item.perms))

  return (
    <div className={cn("fixed inset-0 z-50 md:hidden", open ? "" : "pointer-events-none")}>
      <div
        className={cn(
          "absolute inset-0 bg-black/30 transition-opacity",
          open ? "opacity-100" : "opacity-0"
        )}
        onClick={onClose}
      />

      <div
        className={cn(
          "absolute left-0 top-0 h-full w-[300px] overflow-y-auto bg-white shadow-soft transition-transform",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-4">
          <div>
            <div className="text-sm font-semibold">Panadería Rincón</div>
            <div className="text-xs text-zinc-500">Gestión conectada</div>
          </div>

          <button
            className="rounded-xl p-2 hover:bg-zinc-100"
            onClick={onClose}
            aria-label="Cerrar"
            type="button"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="space-y-1 p-3">
          {visible.map(item => {
            const active = pathname === item.href || (item.href !== "/" && pathname?.startsWith(item.href))
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