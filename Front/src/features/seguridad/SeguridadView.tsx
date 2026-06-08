import ResourceTabs from "@/features/crud/ResourceTabs"

export default function SeguridadView() {
  return (
    <ResourceTabs
      title="Seguridad y roles"
      subtitle="Usuarios, roles y permisos que devuelve el backend."
      tabs={[
        { table: "app_users", label: "Usuarios", description: "Usuarios habilitados o desactivados." },
        { table: "app_roles", label: "Roles", description: "Perfiles de acceso del sistema." },
        { table: "app_permissions", label: "Permisos", description: "Permisos disponibles por módulo." },
        { table: "app_role_permissions", label: "Permisos por rol", description: "Asignación de permisos a cada rol." },
        { table: "audit_log", label: "Auditoría", description: "Historial de cambios relevantes." }
      ]}
    />
  )
}
