from __future__ import annotations

from dataclasses import dataclass
from typing import Callable

from fastapi import Depends, Header, HTTPException, status

from app.core.config import get_settings

settings = get_settings()


@dataclass(frozen=True)
class AuthContext:
    user_id: str | None
    role_id: str | None
    role_name: str | None
    permissions: set[str]
    is_api_key: bool = False
    is_development_open: bool = False

    @property
    def audit_user_id(self) -> str | None:
        if self.is_api_key:
            return "api_key"
        if self.is_development_open:
            return "dev_open"
        return self.user_id


def _api_key_ok(x_api_key: str | None) -> bool:
    return bool(settings.api_key and x_api_key and x_api_key == settings.api_key)


def require_api_key(x_api_key: str | None = Header(default=None)) -> None:
    """
    Protección simple compatible con la primera versión del backend.
    Si API_KEY está vacío y AUTH_REQUIRED=0, deja pasar para desarrollo.
    Si API_KEY está configurado, pedí header X-API-Key.
    """
    if _api_key_ok(x_api_key):
        return
    if not settings.auth_enabled and not settings.api_key:
        return
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="API key inválida o ausente.",
    )


def get_auth_context(
    x_api_key: str | None = Header(default=None),
    x_user_id: str | None = Header(default=None),
) -> AuthContext:
    if _api_key_ok(x_api_key):
        return AuthContext(user_id=None, role_id="admin", role_name="API Key Admin", permissions={"*"}, is_api_key=True)

    if not settings.auth_enabled and not settings.api_key:
        return AuthContext(user_id=None, role_id="dev", role_name="Desarrollo", permissions={"*"}, is_development_open=True)

    if not x_user_id:
        raise HTTPException(status_code=401, detail="Falta X-User-Id o X-API-Key.")

    from app.db import fetch_one, fetch_all

    user = fetch_one(
        """
        select u.id, u.role_id, r.nombre as role_name, u.status
        from public.app_users u
        left join public.app_roles r on r.id = u.role_id
        where u.id = %s
        """,
        [x_user_id],
    )
    if not user or user.get("status") != "active":
        raise HTTPException(status_code=401, detail="Usuario inexistente o inactivo.")

    rows = fetch_all(
        """
        select p.clave
        from public.app_role_permissions rp
        join public.app_permissions p on p.id = rp.permission_id
        where rp.role_id = %s
        """,
        [user["role_id"]],
    )
    permissions = {row["clave"] for row in rows}
    return AuthContext(
        user_id=user["id"],
        role_id=user["role_id"],
        role_name=user.get("role_name"),
        permissions=permissions,
    )


def require_permission(permission: str) -> Callable[[AuthContext], AuthContext]:
    def _dependency(auth: AuthContext = Depends(get_auth_context)) -> AuthContext:
        ensure_permission(auth, permission)
        return auth
    return _dependency


def ensure_permission(auth: AuthContext, permission: str) -> None:
    if "*" in auth.permissions or permission in auth.permissions:
        return
    raise HTTPException(status_code=403, detail=f"Falta permiso: {permission}")


def ensure_any_permission(auth: AuthContext, *permissions: str) -> None:
    if "*" in auth.permissions or any(permission in auth.permissions for permission in permissions):
        return
    raise HTTPException(status_code=403, detail=f"Falta alguno de estos permisos: {', '.join(permissions)}")
