import { cn } from "@/lib/utils"

export default function Badge({
  children,
  variant = "default",
  className
}: {
  children: React.ReactNode
  variant?: "default" | "success" | "warning" | "danger" | "muted"
  className?: string
}) {
  const base = "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium"
  const variants: Record<string, string> = {
    default: "bg-zinc-900 text-white",
    success: "bg-emerald-100 text-emerald-800",
    warning: "bg-amber-100 text-amber-900",
    danger: "bg-red-100 text-red-800",
    muted: "bg-zinc-100 text-zinc-700"
  }
  return <span className={cn(base, variants[variant], className)}>{children}</span>
}
