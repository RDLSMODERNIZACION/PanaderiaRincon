export const dynamic = "force-dynamic"

import ResourceTabs from "@/features/crud/ResourceTabs"
export default function Page() {
  return <ResourceTabs title="Inventario" subtitle="Insumos y movimientos de stock." tabs={[{ table: "supplies", label: "Insumos" }, { table: "inventory_movements", label: "Movimientos" }]} />
}
