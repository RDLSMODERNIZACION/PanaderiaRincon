import { cn } from "@/lib/utils"

export function Table({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full border-separate border-spacing-0">{children}</table>
    </div>
  )
}

export function THead({ children }: { children: React.ReactNode }) {
  return <thead className="sticky top-0 z-10 bg-white">{children}</thead>
}

export function TH({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <th
      className={cn(
        "whitespace-nowrap border-b border-zinc-200 px-3 py-3 text-left text-xs font-semibold text-zinc-600",
        className
      )}
    >
      {children}
    </th>
  )
}

export function TR({ children, className, onClick }: { children: React.ReactNode; className?: string; onClick?: () => void }) {
  return (
    <tr
      className={cn(
        "border-b border-zinc-100 hover:bg-zinc-50/70 transition-colors",
        onClick ? "cursor-pointer" : "",
        className
      )}
      onClick={onClick}
    >
      {children}
    </tr>
  )
}

export function TD({ children, className }: { children: React.ReactNode; className?: string }) {
  return <td className={cn("px-3 py-3 text-sm text-zinc-900", className)}>{children}</td>
}
