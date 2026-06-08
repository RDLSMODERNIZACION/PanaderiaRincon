from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, Query

from app.core.security import AuthContext, ensure_any_permission, get_auth_context
from app.db import fetch_all, get_conn
from app.repositories.crud import delete_row, get_row, insert_row, list_rows, patch_row, new_id
from app.repositories.tables import APP_PERMISSIONS, APP_ROLE_PERMISSIONS, APP_ROLES, APP_USERS
from app.routes.common import ok, raise_not_found
from app.services.audit import write_audit

router = APIRouter(prefix="/api/seguridad", tags=["seguridad"])


@router.get("/me")
def me(auth: AuthContext = Depends(get_auth_context)):
    return ok(
        {
            "user_id": auth.user_id,
            "role_id": auth.role_id,
            "role_name": auth.role_name,
            "permissions": sorted(auth.permissions),
            "is_api_key": auth.is_api_key,
            "is_development_open": auth.is_development_open,
        }
    )


@router.get("/roles")
def listar_roles(
    activo: bool | None = None,
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    auth: AuthContext = Depends(get_auth_context),
):
    ensure_any_permission(auth, "security.roles.read", "admin.crud.read")
    if activo is None:
        rows = list_rows(APP_ROLES, limit=limit, offset=offset)
    else:
        from psycopg import sql
        rows = list_rows(APP_ROLES, where_sql=sql.SQL("where activo = %s"), params=[activo], limit=limit, offset=offset)
    return ok(rows)


@router.get("/roles/{role_id}")
def obtener_rol(role_id: str, auth: AuthContext = Depends(get_auth_context)):
    ensure_any_permission(auth, "security.roles.read", "admin.crud.read")
    role = get_row(APP_ROLES, role_id)
    if not role:
        raise_not_found("Rol")
    permissions = fetch_all(
        """
        select p.*
        from public.app_role_permissions rp
        join public.app_permissions p on p.id = rp.permission_id
        where rp.role_id = %s
        order by p.clave
        """,
        [role_id],
    )
    role["permissions"] = permissions
    return ok(role)


@router.post("/roles")
def crear_rol(payload: dict[str, Any], auth: AuthContext = Depends(get_auth_context)):
    ensure_any_permission(auth, "security.roles.write", "admin.crud.write")
    row = insert_row(APP_ROLES, payload)
    write_audit(tabla="app_roles", record_id=row["id"], accion="crear", usuario_id=auth.audit_user_id, datos_nuevos=row)
    return ok(row)


@router.patch("/roles/{role_id}")
def actualizar_rol(role_id: str, payload: dict[str, Any], auth: AuthContext = Depends(get_auth_context)):
    ensure_any_permission(auth, "security.roles.write", "admin.crud.write")
    before = get_row(APP_ROLES, role_id)
    if not before:
        raise_not_found("Rol")
    row = patch_row(APP_ROLES, role_id, payload)
    write_audit(tabla="app_roles", record_id=role_id, accion="editar", usuario_id=auth.audit_user_id, datos_anteriores=before, datos_nuevos=row)
    return ok(row)


@router.delete("/roles/{role_id}")
def borrar_rol(role_id: str, hard: bool = False, auth: AuthContext = Depends(get_auth_context)):
    ensure_any_permission(auth, "security.roles.delete", "admin.crud.delete")
    before = get_row(APP_ROLES, role_id)
    if not before:
        raise_not_found("Rol")
    deleted = delete_row(APP_ROLES, role_id, hard=hard)
    if not deleted:
        raise_not_found("Rol")
    write_audit(tabla="app_roles", record_id=role_id, accion="anular", usuario_id=auth.audit_user_id, datos_anteriores=before)
    return ok(message="Rol eliminado/desactivado")


@router.get("/permisos")
def listar_permisos(auth: AuthContext = Depends(get_auth_context)):
    ensure_any_permission(auth, "security.permissions.read", "security.roles.read", "admin.crud.read")
    rows = list_rows(APP_PERMISSIONS, limit=1000, offset=0)
    return ok(rows)


@router.post("/permisos")
def crear_permiso(payload: dict[str, Any], auth: AuthContext = Depends(get_auth_context)):
    ensure_any_permission(auth, "security.permissions.write", "admin.crud.write")
    row = insert_row(APP_PERMISSIONS, payload)
    write_audit(tabla="app_permissions", record_id=row["id"], accion="crear", usuario_id=auth.audit_user_id, datos_nuevos=row)
    return ok(row)


@router.post("/roles/{role_id}/permisos/{permission_id}")
def asignar_permiso(role_id: str, permission_id: str, auth: AuthContext = Depends(get_auth_context)):
    ensure_any_permission(auth, "security.roles.write", "admin.crud.write")
    with get_conn() as conn, conn.cursor() as cur:
        cur.execute(
            """
            insert into public.app_role_permissions (id, role_id, permission_id)
            values (%s, %s, %s)
            on conflict (role_id, permission_id) do nothing
            returning *
            """,
            [new_id("rp"), role_id, permission_id],
        )
        row = cur.fetchone()
    write_audit(tabla="app_role_permissions", record_id=f"{role_id}:{permission_id}", accion="crear", usuario_id=auth.audit_user_id, datos_nuevos={"role_id": role_id, "permission_id": permission_id})
    return ok(row or {"role_id": role_id, "permission_id": permission_id, "already_exists": True})


@router.delete("/roles/{role_id}/permisos/{permission_id}")
def quitar_permiso(role_id: str, permission_id: str, auth: AuthContext = Depends(get_auth_context)):
    ensure_any_permission(auth, "security.roles.write", "admin.crud.write")
    with get_conn() as conn, conn.cursor() as cur:
        cur.execute("delete from public.app_role_permissions where role_id = %s and permission_id = %s", [role_id, permission_id])
        deleted = cur.rowcount
    write_audit(tabla="app_role_permissions", record_id=f"{role_id}:{permission_id}", accion="anular", usuario_id=auth.audit_user_id)
    return ok(message="Permiso quitado", deleted=deleted)


@router.get("/usuarios")
def listar_usuarios(
    status: str | None = None,
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    auth: AuthContext = Depends(get_auth_context),
):
    ensure_any_permission(auth, "security.users.read", "admin.crud.read")
    params: list[Any] = []
    where = ""
    if status:
        where = "where u.status = %s"
        params.append(status)
    params.extend([limit, offset])
    with get_conn() as conn, conn.cursor() as cur:
        cur.execute(
            f"""
            select u.*, r.nombre as role_nombre, e.nombre as employee_nombre
            from public.app_users u
            left join public.app_roles r on r.id = u.role_id
            left join public.employees e on e.id = u.employee_id
            {where}
            order by u.nombre asc
            limit %s offset %s
            """,
            params,
        )
        rows = cur.fetchall()
    return ok(rows)


@router.get("/usuarios/{user_id}")
def obtener_usuario(user_id: str, auth: AuthContext = Depends(get_auth_context)):
    ensure_any_permission(auth, "security.users.read", "admin.crud.read")
    row = get_row(APP_USERS, user_id)
    if not row:
        raise_not_found("Usuario")
    return ok(row)


@router.post("/usuarios")
def crear_usuario(payload: dict[str, Any], auth: AuthContext = Depends(get_auth_context)):
    ensure_any_permission(auth, "security.users.write", "admin.crud.write")
    row = insert_row(APP_USERS, payload)
    write_audit(tabla="app_users", record_id=row["id"], accion="crear", usuario_id=auth.audit_user_id, datos_nuevos=row)
    return ok(row)


@router.patch("/usuarios/{user_id}")
def actualizar_usuario(user_id: str, payload: dict[str, Any], auth: AuthContext = Depends(get_auth_context)):
    ensure_any_permission(auth, "security.users.write", "admin.crud.write")
    before = get_row(APP_USERS, user_id)
    if not before:
        raise_not_found("Usuario")
    row = patch_row(APP_USERS, user_id, payload)
    write_audit(tabla="app_users", record_id=user_id, accion="editar", usuario_id=auth.audit_user_id, datos_anteriores=before, datos_nuevos=row)
    return ok(row)


@router.delete("/usuarios/{user_id}")
def desactivar_usuario(user_id: str, auth: AuthContext = Depends(get_auth_context)):
    ensure_any_permission(auth, "security.users.delete", "admin.crud.delete")
    before = get_row(APP_USERS, user_id)
    if not before:
        raise_not_found("Usuario")
    row = patch_row(APP_USERS, user_id, {"status": "disabled"})
    write_audit(tabla="app_users", record_id=user_id, accion="anular", usuario_id=auth.audit_user_id, datos_anteriores=before, datos_nuevos=row)
    return ok(message="Usuario desactivado", data=row)
