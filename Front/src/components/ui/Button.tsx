import { cn } from "@/lib/utils"
import type { ButtonHTMLAttributes } from "react"

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger"
  size?: "sm" | "md"
}

export default function Button({ className, variant = "primary", size = "md", ...props }: Props) {
  const base =
    "inline-flex items-center justify-center rounded-xl font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-zinc-400 disabled:opacity-50 disabled:pointer-events-none"
  const variants: Record<string, string> = {
    primary: "bg-zinc-900 text-white hover:bg-zinc-800",
    secondary: "bg-white border border-zinc-200 hover:bg-zinc-50 text-zinc-900",
    ghost: "bg-transparent hover:bg-zinc-100 text-zinc-900",
    danger: "bg-red-600 text-white hover:bg-red-700"
  }
  const sizes: Record<string, string> = {
    sm: "h-9 px-3 text-sm",
    md: "h-10 px-4 text-sm"
  }
  return <button className={cn(base, variants[variant], sizes[size], className)} {...props} />
}
