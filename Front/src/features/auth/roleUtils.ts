export type RoleLikeUser = {
  roleId?: string | null
  role_id?: string | null
  roleName?: string | null
  role_name?: string | null
  permissions?: string[] | null
}

function clean(value: unknown) {
  return String(value || "").trim().toLowerCase()
}

function permissionsOf(user: RoleLikeUser | null | undefined) {
  return Array.isArray(user?.permissions) ? user.permissions : []
}

export function isAdminUser(user: RoleLikeUser | null | undefined) {
  if (!user) return false

  const roleId = clean(user.roleId || user.role_id)
  const roleName = clean(user.roleName || user.role_name)
  const permissions = permissionsOf(user)

  return (
    roleId === "role_admin" ||
    roleId === "admin" ||
    roleName === "administrador" ||
    roleName === "admin" ||
    permissions.includes("*")
  )
}

export function isRepartidorUser(user: RoleLikeUser | null | undefined) {
  if (!user) return false

  const roleId = clean(user.roleId || user.role_id)
  const roleName = clean(user.roleName || user.role_name)
  const permissions = permissionsOf(user)

  return (
    roleId === "role_repartidor" ||
    roleName === "repartidor" ||
    permissions.includes("delivery.self")
  )
}

export function isDeliveryAdminUser(user: RoleLikeUser | null | undefined) {
  if (!user) return false

  const permissions = permissionsOf(user)

  return isAdminUser(user) || permissions.includes("delivery.admin")
}

export function isAdministrationUser(user: RoleLikeUser | null | undefined) {
  if (!user) return false

  const roleId = clean(user.roleId || user.role_id)
  const roleName = clean(user.roleName || user.role_name)
  const permissions = permissionsOf(user)

  return (
    isAdminUser(user) ||
    roleId === "role_administracion" ||
    roleName === "administración" ||
    roleName === "administracion" ||
    permissions.includes("admin.menu")
  )
}

export function defaultHomeForUser(user: RoleLikeUser | null | undefined) {
  if (isAdminUser(user)) return "/"
  if (isRepartidorUser(user)) return "/mi-reparto"
  if (isDeliveryAdminUser(user)) return "/reparto"
  if (isAdministrationUser(user)) return "/cuentas"

  return "/login"
}