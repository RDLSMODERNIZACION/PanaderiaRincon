"use client"

import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import {
  BarChart3,
  Boxes,
  Coffee,
  Factory,
  Home,
  Settings,
  ShoppingCart,
  Users,
  Wrench,
  Snowflake,
  Flame
} from "lucide-react"

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

const maquinaria = {
  label: "Maquinaria",
  icon: Wrench,
  items: [
    { href: "/maquinaria/camaras-frigorificas", label: "Cámaras frigoríficas", icon: Snowflake },
    { href: "/maquinaria/hornos", label: "Hornos", icon: Flame }
  ]
}

export default function Sidebar() {
  const pathname = usePathname()

  // activo si estoy parado en alguna ruta de maquinaria
  const maquinariaActive = pathname?.startsWith("/maquinaria/")

  return (
    <aside className="sticky top-0 hidden h-screen w-[280px] shrink-0 border-r border-zinc-200 bg-white px-4 py-5 md:block">
      <div className="flex items-center gap-3 px-2">
        {/* Logo */}
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
          <div className="text-xs text-zinc-500 leading-tight">Panel de gestión</div>
        </div>
      </div>

      <nav className="mt-6 space-y-1">
        {nav.map((item) => {
          const active = pathname === item.href
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

        {/* --- Maquinaria (grupo) --- */}
        <div className="pt-2">
          <details className="group" open={maquinariaActive}>
            <summary
              className={cn(
                "flex cursor-pointer list-none items-center justify-between rounded-2xl px-3 py-2.5 text-sm transition-colors",
                maquinariaActive ? "bg-zinc-900 text-white" : "text-zinc-700 hover:bg-zinc-100"
              )}
            >
              <div className="flex items-center gap-3">
                <maquinaria.icon className="h-4 w-4" />
                <span>{maquinaria.label}</span>
              </div>
              <span className={cn("text-xs transition-transform", "group-open:rotate-180")}>▾</span>
            </summary>

            <div className="mt-1 space-y-1 pl-3">
              {maquinaria.items.map((it) => {
                const active = pathname === it.href
                const Icon = it.icon
                return (
                  <Link
                    key={it.href}
                    href={it.href}
                    className={cn(
                      "flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm transition-colors",
                      active ? "bg-zinc-900 text-white" : "text-zinc-700 hover:bg-zinc-100"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{it.label}</span>
                  </Link>
                )
              })}
            </div>
          </details>
        </div>
      </nav>

      <div className="mt-6 rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
        <div className="text-xs font-semibold text-zinc-700">Tips rápidos</div>
        <ul className="mt-2 space-y-2 text-xs text-zinc-600">
          <li>• Medí merma por lote y por producto.</li>
          <li>• Mirá quiebres de stock (insumos críticos).</li>
          <li>• Ajustá plan según ventas por franja horaria.</li>
        </ul>
      </div>
    </aside>
  )
}
