import { cn } from "@/lib/utils"

export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("rounded-2xl border border-zinc-200 bg-white shadow-soft", className)}>{children}</div>
}

export function CardHeader({ title, subtitle, right }: { title: string; subtitle?: string; right?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 border-b border-zinc-100 px-4 py-4 sm:flex-row sm:items-start sm:justify-between sm:gap-4 sm:px-5">
      <div className="min-w-0">
        <div className="text-sm font-semibold text-zinc-900">{title}</div>
        {subtitle ? <div className="mt-1 text-xs text-zinc-500">{subtitle}</div> : null}
      </div>
      {right ? <div className="w-full sm:w-auto sm:shrink-0">{right}</div> : null}
    </div>
  )
}

export function CardBody({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("px-4 py-4 sm:px-5", className)}>{children}</div>
}
