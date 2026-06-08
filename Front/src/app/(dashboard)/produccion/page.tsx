export const dynamic = "force-dynamic"

import ResourceTabs from "@/features/crud/ResourceTabs"
export default function Page() {
  return <ResourceTabs title="Producción" subtitle="Producción, recetas e ingredientes." tabs={[{ table: "production_batches", label: "Lotes" }, { table: "recipes", label: "Recetas" }, { table: "recipe_items", label: "Ingredientes" }]} />
}
