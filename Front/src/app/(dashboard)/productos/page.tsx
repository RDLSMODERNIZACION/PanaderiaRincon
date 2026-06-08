export const dynamic = "force-dynamic"

import CrudTableView from "@/features/crud/CrudTableView"
export default function Page() { return <CrudTableView tableName="products" title="Productos" subtitle="Catálogo real conectado al backend." /> }
