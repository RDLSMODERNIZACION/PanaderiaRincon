"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  BarChart3,
  Coffee,
  Home,
  MoreHorizontal,
  Route,
  Shield,
  Truck,
  Users,
  WalletCards,
  X
} from "lucide-react"
import { useMemo, useState } from "react"
import { cn } from "@/lib/utils"
import { useAuth } from "@/features/auth/AuthProvider"

const nav = [
  { href: "/", label: "Inicio", icon: Home, perms: ["admin.menu"], primary: true },
  { href: "/mi-reparto", label: "Mi reparto", icon: Truck, perms: ["delivery.self"], primary: true },
  { href: "/reparto", label: "Reparto", icon: Route, perms: ["delivery.admin"], primary: true },
  { href: "/cuentas", label: "Cuentas", icon: WalletCards, perms: ["admin.menu"], primary: true },
  { href: "/clientes", label: "Clientes", icon: Users, perms: ["admin.menu"], primary: true },
  { href: "/productos", label: "Productos", icon: Coffee, perms: ["admin.menu"], primary: false },
  { href: "/reportes", label: "Reportes", icon: BarChart3, perms: ["admin.menu"], primary: false },
  { href: "/seguridad", label: "Seguridad", icon: Shield, perms: ["admin.menu"], primary: false }
]

export default function MobileBottomNav() {
  const pathname = usePathname()
  const { can, session, user } = useAuth()
  const [open, setOpen] = useState(false)

  const { mainItems, moreItems } = useMemo(() => {
    const visible = nav.filter(item => item.perms.length === 0 || can(...item.perms))
    const preferred = visible.filter(item => item.primary)
    const extra = visible.filter(item => !item.primary)

    if (preferred.length <= 4) {
      return { mainItems: preferred, moreItems: extra }
    }

    return {
      mainItems: preferred.slice(0, 4),
      moreItems: [...preferred.slice(4), ...extra]
    }
  }, [can])

  if (!session || !user) return null
  if (mainItems.length === 0 && moreItems.length === 0) return null

  const hasMore = moreItems.length > 0
  const columns = hasMore ? mainItems.length + 1 : mainItems.length
  const gridCols = columns <= 1 ? "grid-cols-1" : columns === 2 ? "grid-cols-2" : columns === 3 ? "grid-cols-3" : columns === 4 ? "grid-cols-4" : "grid-cols-5"

  function isActive(href: string) {
    return pathname === href || (href !== "/" && pathname?.startsWith(href))
  }

  return (
    <>
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-zinc-200 bg-white/95 px-2 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-2 shadow-[0_-10px_30px_rgba(0,0,0,0.08)] backdrop-blur md:hidden">
        <div className={cn("mx-auto grid max-w-md gap-1", gridCols)}>
          {mainItems.map(item => {
            const Icon = item.icon
            const active = isActive(item.href)

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex min-h-[58px] flex-col items-center justify-center gap-1 rounded-2xl px-1 text-[11px] font-medium transition-colors",
                  active ? "bg-zinc-900 text-white" : "text-zinc-600 active:bg-zinc-100"
                )}
              >
                <Icon className="h-5 w-5" />
                <span className="max-w-full truncate">{item.label}</span>
              </Link>
            )
          })}

          {hasMore ? (
            <button
              type="button"
              onClick={() => setOpen(current => !current)}
              className={cn(
                "flex min-h-[58px] flex-col items-center justify-center gap-1 rounded-2xl px-1 text-[11px] font-medium transition-colors",
                open ? "bg-zinc-900 text-white" : "text-zinc-600 active:bg-zinc-100"
              )}
            >
              <MoreHorizontal className="h-5 w-5" />
              <span>Más</span>
            </button>
          ) : null}
        </div>
      </nav>

      {hasMore ? (
        <div className={cn("fixed inset-0 z-50 md:hidden", open ? "" : "pointer-events-none")}>
          <div
            className={cn("absolute inset-0 bg-black/30 transition-opacity", open ? "opacity-100" : "opacity-0")}
            onClick={() => setOpen(false)}
          />

          <div
            className={cn(
              "absolute inset-x-0 bottom-0 rounded-t-3xl border-t border-zinc-200 bg-white p-4 pb-[max(env(safe-area-inset-bottom),1rem)] shadow-2xl transition-transform",
              open ? "translate-y-0" : "translate-y-full"
            )}
          >
            <div className="mb-3 flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-zinc-900">Más secciones</div>
                <div className="text-xs text-zinc-500">Accesos de administración</div>
              </div>

              <button
                type="button"
                onClick={() => setOpen(false)}
                className="grid h-10 w-10 place-items-center rounded-2xl border border-zinc-200 active:bg-zinc-100"
                aria-label="Cerrar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid gap-2">
              {moreItems.map(item => {
                const Icon = item.icon
                const active = isActive(item.href)

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "flex min-h-[54px] items-center gap-3 rounded-2xl border px-4 text-sm font-medium",
                      active ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-200 bg-white text-zinc-800 active:bg-zinc-50"
                    )}
                  >
                    <Icon className="h-5 w-5" />
                    <span>{item.label}</span>
                  </Link>
                )
              })}
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
