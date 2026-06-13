"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Coffee, Route, Truck, Users, WalletCards } from "lucide-react"
import { cn } from "@/lib/utils"
import { useAuth } from "@/features/auth/AuthProvider"

const nav = [
  { href: "/mi-reparto", label: "Mi reparto", icon: Truck, perms: ["delivery.self"] },
  { href: "/reparto", label: "Reparto", icon: Route, perms: ["delivery.admin"] },
  { href: "/cuentas", label: "Cuentas", icon: WalletCards, perms: ["admin.menu"] },
  { href: "/clientes", label: "Clientes", icon: Users, perms: ["admin.menu"] },
  { href: "/productos", label: "Productos", icon: Coffee, perms: ["admin.menu"] }
]

export default function MobileBottomNav() {
  const pathname = usePathname()
  const { can } = useAuth()

  const visible = nav.filter(item => item.perms.length === 0 || can(...item.perms)).slice(0, 5)

  if (visible.length === 0) return null

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-zinc-200 bg-white/95 px-2 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-2 shadow-[0_-10px_30px_rgba(0,0,0,0.08)] backdrop-blur md:hidden">
      <div className="mx-auto grid max-w-md grid-cols-5 gap-1">
        {visible.map(item => {
          const Icon = item.icon
          const active = pathname === item.href || (item.href !== "/" && pathname?.startsWith(item.href))

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex min-h-[58px] flex-col items-center justify-center gap-1 rounded-2xl px-1 text-[11px] font-medium transition-colors",
                active ? "bg-zinc-900 text-white" : "text-zinc-600 hover:bg-zinc-100"
              )}
            >
              <Icon className="h-5 w-5" />
              <span className="max-w-full truncate">{item.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
