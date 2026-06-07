import { cn } from "@/lib/utils"
import type { SelectHTMLAttributes } from "react"

export default function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-300",
        className
      )}
      {...props}
    />
  )
}
