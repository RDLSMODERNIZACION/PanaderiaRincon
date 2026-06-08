from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from psycopg import sql

from app.core.security import AuthContext, ensure_any_permission, get_auth_context
from app.repositories.crud import delete_row, get_row, insert_row, list_rows, patch_row
from app.repositories.tables import TABLES
from app.routes.common import ok, raise_not_found
from app.services.audit import write_audit

router = APIRouter(prefix="/api/admin/crud", tags=["admin-crud"])


def _table_or_404(table_name: str):
    cfg = TABLES.get(table_name)
    if not cfg:
        raise HTTPException(status_code=404, detail=f"Tabla no permitida o inexistente: {table_name}")
    return cfg


def _validate_order_by(cfg, order_by: str | None) -> str | None:
    if not order_by:
        return None
    allowed = cfg.all_allowed_columns | set(cfg.search_columns) | {cfg.default_order_by, "created_at", "updated_at", "fecha", "nombre", "id"}
    if order_by not in allowed:
        raise HTTPException(status_code=400, detail=f"No se permite ordenar {cfg.table} por {order_by}")
    return order_by


@router.get("/tables")
def listar_tablas(auth: AuthContext = Depends(get_auth_context)):
    ensure_any_permission(auth, "admin.crud.read", "admin.schema.read")
    data = []
    for name, cfg in sorted(TABLES.items()):
        data.append(
            {
                "table": name,
                "label": cfg.label or name,
                "readOnly": cfg.read_only,
                "softDeleteColumn": cfg.soft_delete_column,
                "allowedCreate": list(cfg.allowed_create),
                "allowedPatch": list(cfg.allowed_patch),
                "searchColumns": list(cfg.search_columns),
                "defaultOrderBy": cfg.default_order_by,
            }
        )
    return ok(data)


@router.get("/{table_name}")
def listar_registros(
    table_name: str,
    q: str | None = None,
    include_inactive: bool = Query(False),
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    order_by: str | None = None,
    desc: bool | None = None,
    auth: AuthContext = Depends(get_auth_context),
):
    ensure_any_permission(auth, "admin.crud.read")
    cfg = _table_or_404(table_name)
    order_by = _validate_order_by(cfg, order_by)

    where = None
    params: list[Any] = []
    if cfg.soft_delete_column and not include_inactive:
        where = sql.SQL("where {} = true").format(sql.Identifier(cfg.soft_delete_column))

    rows = list_rows(cfg, limit=limit, offset=offset, where_sql=where, params=params, order_by=order_by, desc=desc, q=q)
    return ok(rows, limit=limit, offset=offset)


@router.get("/{table_name}/{row_id}")
def obtener_registro(table_name: str, row_id: str, auth: AuthContext = Depends(get_auth_context)):
    ensure_any_permission(auth, "admin.crud.read")
    cfg = _table_or_404(table_name)
    row = get_row(cfg, row_id)
    if not row:
        raise_not_found("Registro")
    return ok(row)


@router.post("/{table_name}")
def crear_registro(
    table_name: str,
    payload: dict[str, Any],
    motivo: str | None = Query(None),
    auth: AuthContext = Depends(get_auth_context),
):
    ensure_any_permission(auth, "admin.crud.write", f"{table_name}.write")
    cfg = _table_or_404(table_name)
    row = insert_row(cfg, payload)
    write_audit(tabla=table_name, record_id=row["id"], accion="crear", usuario_id=auth.audit_user_id, datos_nuevos=row, motivo=motivo)
    return ok(row)


@router.patch("/{table_name}/{row_id}")
def actualizar_registro(
    table_name: str,
    row_id: str,
    payload: dict[str, Any],
    motivo: str | None = Query(None),
    auth: AuthContext = Depends(get_auth_context),
):
    ensure_any_permission(auth, "admin.crud.write", f"{table_name}.write")
    cfg = _table_or_404(table_name)
    before = get_row(cfg, row_id)
    if not before:
        raise_not_found("Registro")
    row = patch_row(cfg, row_id, payload)
    if not row:
        raise_not_found("Registro")
    write_audit(tabla=table_name, record_id=row_id, accion="editar", usuario_id=auth.audit_user_id, datos_anteriores=before, datos_nuevos=row, motivo=motivo)
    return ok(row)


@router.delete("/{table_name}/{row_id}")
def borrar_registro(
    table_name: str,
    row_id: str,
    hard: bool = Query(False),
    motivo: str | None = Query(None),
    auth: AuthContext = Depends(get_auth_context),
):
    ensure_any_permission(auth, "admin.crud.delete", f"{table_name}.delete")
    cfg = _table_or_404(table_name)
    before = get_row(cfg, row_id)
    if not before:
        raise_not_found("Registro")
    deleted = delete_row(cfg, row_id, hard=hard)
    if not deleted:
        raise_not_found("Registro")
    write_audit(tabla=table_name, record_id=row_id, accion="anular" if not hard else "borrar", usuario_id=auth.audit_user_id, datos_anteriores=before, motivo=motivo)
    return ok(message="Registro eliminado" if hard else "Registro desactivado/anulado")
