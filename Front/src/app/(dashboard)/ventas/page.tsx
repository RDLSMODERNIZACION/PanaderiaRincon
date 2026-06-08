export const dynamic = "force-dynamic"

import ResourceTabs from "@/features/crud/ResourceTabs"
export default function Page() {
  return <ResourceTabs title="Ventas" subtitle="Tickets, items y pagos reales." tabs={[{ table: "tickets", label: "Tickets" }, { table: "ticket_items", label: "Items" }, { table: "payments", label: "Pagos" }]} />
}
