import { cn } from "@/lib/utils"
import type { InputHTMLAttributes } from "react"

export default function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-base text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-300 sm:text-sm",
        className
      )}
      {...props}
    />
  )
}
