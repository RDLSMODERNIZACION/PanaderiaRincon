from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from app.core.security import AuthContext, ensure_any_permission, get_auth_context
from app.db import fetch_all, fetch_one, get_conn
from app.repositories.crud import delete_row, get_row, insert_row, list_rows, patch_row, new_id
from app.repositories.tables import APP_PERMISSIONS, APP_ROLES, APP_USERS
from app.routes.common import ok, raise_not_found
from app.services.audit import write_audit

router = APIRouter(prefix="/api/seguridad", tags=["seguridad"])


class LoginPayload(BaseModel):
    username: str
    password: str


class RegisterPayload(BaseModel):
    username: str
    password: str
    nombre: str | None = None


def _public_user(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "userId": row.get("id"),
        "user_id": row.get("id"),
        "email": row.get("email"),
        "nombre": row.get("nombre"),
        "roleId": row.get("role_id"),
        "role_id": row.get("role_id"),
        "roleName": row.get("role_name") or row.get("role_nombre"),
        "role_name": row.get("role_name") or row.get("role_nombre"),
        "status": row.get("status"),
    }


def _default_role_id() -> str:
    row = fetch_one("select id from public.app_roles where id = %s limit 1", ["role_consulta"])
    if row:
        return row["id"]

    with get_conn() as conn, conn.cursor() as cur:
        cur.execute(
            """
            insert into public.app_roles (id, nombre, descripcion, activo)
            values (%s, %s, %s, true)
            on conflict (id) do update set
              nombre = excluded.nombre,
              descripcion = excluded.descripcion,
              activo = true
            returning id
            """,
            [
                "role_consulta",
                "Consulta",
                "Usuario nuevo con acceso mínimo hasta que un administrador le asigne un rol.",
            ],
        )
        role = cur.fetchone()

    return role["id"]


@router.post("/login")
def login(payload: LoginPayload):
    username = payload.username.strip()
    password = payload.password

    if not username or not password:
        raise HTTPException(status_code=400, detail="Ingresá usuario y contraseña.")

    user = fetch_one(
        """
        select u.id, u.email, u.nombre, u.role_id, u.status, r.nombre as role_name
        from public.app_users u
        left join public.app_roles r on r.id = u.role_id
        where u.status = 'active'
          and coalesce(u.password_plain, '') = %s
          and (
            lower(coalesce(u.email, '')) = lower(%s)
            or lower(coalesce(u.nombre, '')) = lower(%s)
          )
        limit 1
        """,
        [password, username, username],
    )

    if not user:
        raise HTTPException(status_code=401, detail="Usuario o contraseña incorrectos.")

    with get_conn() as conn, conn.cursor() as cur:
        cur.execute("update public.app_users set last_login_at = now() where id = %s", [user["id"]])

    return ok(_public_user(user))


@router.post("/register")
def register(payload: RegisterPayload):
    username = payload.username.strip()
    password = payload.password
    nombre = (payload.nombre or username).strip()

    if not username or not password:
        raise HTTPException(status_code=400, detail="Ingresá usuario y contraseña.")

    existing = fetch_one(
        """
        select id
        from public.app_users
        where lower(coalesce(email, '')) = lower(%s)
           or lower(coalesce(nombre, '')) = lower(%s)
        limit 1
        """,
        [username, username],
    )

    if existing:
        raise HTTPException(status_code=409, detail="Ese usuario ya existe.")

    role_id = _default_role_id()
    email = username if "@" in username else None
    user_id = new_id("usr")

    with get_conn() as conn, conn.cursor() as cur:
        cur.execute(
            """
            insert into public.app_users (id, email, nombre, role_id, status, password_plain)
            values (%s, %s, %s, %s, 'active', %s)
            returning id, email, nombre, role_id, status
            """,
            [user_id, email, nombre, role_id, password],
        )
        user = cur.fetchone()

    return ok(_public_user(user))


@router.get("/me")
def me(auth: AuthContext = Depends(get_auth_context)):
    return ok(
        {
            "userId": auth.user_id,
            "user_id": auth.user_id,
            "roleId": auth.role_id,
            "role_id": auth.role_id,
            "roleName": auth.role_name,
            "role_name": auth.role_name,
            "permissions": sorted(auth.permissions),
            "isApiKey": auth.is_api_key,
            "is_api_key": auth.is_api_key,
            "isDevelopmentOpen": auth.is_development_open,
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
            select
              u.id,
              u.email,
              u.nombre,
              u.role_id,
              u.status,
              u.last_login_at,
              u.created_at,
              u.updated_at,
              r.nombre as role_nombre
            from public.app_users u
            left join public.app_roles r on r.id = u.role_id
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
    row.pop("password_plain", None)
    return ok(row)


@router.post("/usuarios")
def crear_usuario(payload: dict[str, Any], auth: AuthContext = Depends(get_auth_context)):
    ensure_any_permission(auth, "security.users.write", "admin.crud.write")

    if "password" in payload:
        payload["password_plain"] = payload.pop("password")

    row = insert_row(APP_USERS, payload)
    row.pop("password_plain", None)
    write_audit(tabla="app_users", record_id=row["id"], accion="crear", usuario_id=auth.audit_user_id, datos_nuevos=row)
    return ok(row)


@router.patch("/usuarios/{user_id}")
def actualizar_usuario(user_id: str, payload: dict[str, Any], auth: AuthContext = Depends(get_auth_context)):
    ensure_any_permission(auth, "security.users.write", "admin.crud.write")

    if "password" in payload:
        payload["password_plain"] = payload.pop("password")

    before = get_row(APP_USERS, user_id)
    if not before:
        raise_not_found("Usuario")

    row = patch_row(APP_USERS, user_id, payload)
    before.pop("password_plain", None)
    row.pop("password_plain", None)
    write_audit(tabla="app_users", record_id=user_id, accion="editar", usuario_id=auth.audit_user_id, datos_anteriores=before, datos_nuevos=row)
    return ok(row)


@router.delete("/usuarios/{user_id}")
def desactivar_usuario(user_id: str, auth: AuthContext = Depends(get_auth_context)):
    ensure_any_permission(auth, "security.users.delete", "admin.crud.delete")
    before = get_row(APP_USERS, user_id)
    if not before:
        raise_not_found("Usuario")
    row = patch_row(APP_USERS, user_id, {"status": "disabled"})
    before.pop("password_plain", None)
    row.pop("password_plain", None)
    write_audit(tabla="app_users", record_id=user_id, accion="anular", usuario_id=auth.audit_user_id, datos_anteriores=before, datos_nuevos=row)
    return ok(message="Usuario desactivado", data=row)