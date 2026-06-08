export const dynamic = "force-dynamic"

import ResourceTabs from "@/features/crud/ResourceTabs"
export default function Page() {
  return <ResourceTabs title="Personal" subtitle="Empleados, repartidores y turnos." tabs={[{ table: "employees", label: "Empleados" }, { table: "employee_shifts", label: "Turnos" }, { table: "app_users", label: "Usuarios" }]} />
}
