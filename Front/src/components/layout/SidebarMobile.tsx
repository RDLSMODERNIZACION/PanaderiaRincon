"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  BarChart3,
  Coffee,
  Home,
  Route,
  Shield,
  Truck,
  Users,
  WalletCards,
  X
, type LucideIcon
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useAuth } from "@/features/auth/AuthProvider"
import { isAdminUser } from "@/features/auth/roleUtils"

type NavItem = {
  href: string
  label: string
  icon: LucideIcon
  perms: string[]
  adminOnly?: boolean
}

type NavGroup = {
  title: string
  items: NavItem[]
}

const groups: NavGroup[] = [
  {
    title: "Inicio",
    items: [
      { href: "/", label: "Dashboard", icon: Home, perms: ["admin.menu"], adminOnly: true }
    ]
  },
  {
    title: "Reparto",
    items: [
      { href: "/mi-reparto", label: "Mi reparto", icon: Truck, perms: ["delivery.self"] },
      { href: "/reparto", label: "Reparto", icon: Route, perms: ["delivery.admin"] }
    ]
  },
  {
    title: "Administración",
    items: [
      { href: "/cuentas", label: "Cuentas", icon: WalletCards, perms: ["admin.menu"] },
      { href: "/clientes", label: "Clientes", icon: Users, perms: ["admin.menu"] },
      { href: "/productos", label: "Productos", icon: Coffee, perms: ["admin.menu"] }
    ]
  },
  {
    title: "Sistema",
    items: [
      { href: "/reportes", label: "Reportes", icon: BarChart3, perms: ["admin.menu"] },
      { href: "/seguridad", label: "Seguridad", icon: Shield, perms: ["admin.menu"] }
    ]
  }
]

export default function SidebarMobile({
  open,
  onClose
}: {
  open: boolean
  onClose: () => void
}) {
  const pathname = usePathname()
  const { can, user } = useAuth()

  const visibleGroups = groups
    .map(group => ({
      ...group,
      items: group.items.filter(item => {
        if (item.adminOnly && !isAdminUser(user)) return false
        return item.perms.length === 0 || can(...item.perms)
      })
    }))
    .filter(group => group.items.length > 0)

  return (
    <div className={cn("fixed inset-0 z-50 md:hidden", open ? "" : "pointer-events-none")}> 
      <div
        className={cn(
          "absolute inset-0 bg-black/40 transition-opacity",
          open ? "opacity-100" : "opacity-0"
        )}
        onClick={onClose}
      />

      <div
        className={cn(
          "absolute left-0 top-0 flex h-full w-[88vw] max-w-[360px] flex-col overflow-hidden bg-white shadow-2xl transition-transform",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-4">
          <div>
            <div className="text-base font-semibold text-zinc-900">Panadería Rincón</div>
            <div className="text-xs text-zinc-500">Menú principal</div>
          </div>

          <button
            className="grid h-11 w-11 place-items-center rounded-2xl border border-zinc-200 hover:bg-zinc-100"
            onClick={onClose}
            aria-label="Cerrar"
            type="button"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4 pb-8">
          {visibleGroups.map(group => (
            <div key={group.title}>
              <div className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
                {group.title}
              </div>

              <div className="grid gap-2">
                {group.items.map(item => {
                  const active = pathname === item.href || (item.href !== "/" && pathname?.startsWith(item.href))
                  const Icon = item.icon

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={onClose}
                      className={cn(
                        "flex min-h-[56px] items-center gap-3 rounded-2xl px-4 text-base font-medium transition-colors",
                        active ? "bg-zinc-900 text-white" : "border border-zinc-200 bg-white text-zinc-800 hover:bg-zinc-50"
                      )}
                    >
                      <Icon className="h-5 w-5 shrink-0" />
                      <span>{item.label}</span>
                    </Link>
                  )
                })}
              </div>
            </div>
          ))}
        </nav>
      </div>
    </div>
  )
}
