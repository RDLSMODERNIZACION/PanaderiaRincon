"use client"

import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import {
  BarChart3,
  Car,
  Coffee,
  Flame,
  Home,
  Route,
  Shield,
  ShoppingCart,
  Truck,
  Users,
  WalletCards
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useAuth } from "@/features/auth/AuthProvider"

const navGroups = [
  {
    title: "",
    items: [
      { href: "/", label: "Dashboard", icon: Home, perms: ["admin.menu"] }
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
      { href: "/ventas", label: "Ventas", icon: ShoppingCart, perms: ["admin.menu"] },
      { href: "/productos", label: "Productos", icon: Coffee, perms: ["admin.menu"] },
      { href: "/personal", label: "Personal", icon: Users, perms: ["admin.menu"] }
    ]
  },
  {
    title: "Maquinaria",
    items: [
      { href: "/vehiculos", label: "Vehículos", icon: Car, perms: ["admin.menu"] },
      { href: "/hornos", label: "Hornos", icon: Flame, perms: ["admin.menu"] }
    ]
  },
  {
    title: "KPI",
    items: [
      { href: "/reportes", label: "Reportes", icon: BarChart3, perms: ["admin.menu"] }
    ]
  },
  {
    title: "Sistema",
    items: [
      { href: "/seguridad", label: "Seguridad", icon: Shield, perms: ["admin.menu"] }
    ]
  }
]

export default function Sidebar() {
  const pathname = usePathname()
  const { can } = useAuth()

  const groups = navGroups
    .map(group => ({
      ...group,
      items: group.items.filter(item => item.perms.length === 0 || can(...item.perms))
    }))
    .filter(group => group.items.length > 0)

  return (
    <aside className="sticky top-0 hidden h-screen w-[292px] shrink-0 overflow-y-auto border-r border-zinc-200 bg-white px-4 py-5 md:block">
      <div className="flex items-center gap-3 px-2">
        <div className="h-10 w-10 overflow-hidden rounded-full bg-black">
          <Image
            src="/brand/logo-panaderia-rincon.png.jpeg"
            alt="Panadería Rincón"
            width={40}
            height={40}
            className="h-10 w-10 object-contain"
            priority
          />
        </div>

        <div>
          <div className="text-sm font-semibold leading-tight">Panadería Rincón</div>
          <div className="text-xs leading-tight text-zinc-500">Gestión conectada</div>
        </div>
      </div>

      <nav className="mt-6 space-y-6">
        {groups.map(group => (
          <div key={group.title || "inicio"}>
            {group.title ? (
              <div className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
                {group.title}
              </div>
            ) : null}

            <div className="space-y-1">
              {group.items.map(item => {
                const active = pathname === item.href || (item.href !== "/" && pathname?.startsWith(item.href))
                const Icon = item.icon

                return (
                  <Link
                    key={item.href}
                    href={item.href}
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
            </div>
          </div>
        ))}
      </nav>

      <div className="mt-6 rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
        <div className="text-xs font-semibold text-zinc-700">Control clave</div>
        <ul className="mt-2 space-y-2 text-xs text-zinc-600">
          <li>• Cada visita queda registrada.</li>
          <li>• Pagos pendientes se separan de confirmados.</li>
          <li>• Pan viejo/pan rallado se controla en kg.</li>
        </ul>
      </div>
    </aside>
  )
}