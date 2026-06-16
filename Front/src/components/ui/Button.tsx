import { cn } from "@/lib/utils"
import type { ButtonHTMLAttributes } from "react"

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger"
  size?: "sm" | "md"
}

export default function Button({ className, variant = "primary", size = "md", ...props }: Props) {
  const base =
    "inline-flex touch-manipulation items-center justify-center rounded-xl font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-zinc-400 disabled:pointer-events-none disabled:opacity-50"
  const variants: Record<string, string> = {
    primary: "bg-zinc-900 text-white hover:bg-zinc-800 active:bg-zinc-950",
    secondary: "border border-zinc-200 bg-white text-zinc-900 hover:bg-zinc-50 active:bg-zinc-100",
    ghost: "bg-transparent text-zinc-900 hover:bg-zinc-100 active:bg-zinc-100",
    danger: "bg-red-600 text-white hover:bg-red-700 active:bg-red-800"
  }
  const sizes: Record<string, string> = {
    sm: "h-10 px-3 text-sm",
    md: "h-11 px-4 text-sm"
  }
  return <button className={cn(base, variants[variant], sizes[size], className)} {...props} />
}
