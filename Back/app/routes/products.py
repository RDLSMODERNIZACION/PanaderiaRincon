from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from psycopg import sql

from app.core.security import require_api_key
from app.repositories.crud import delete_row, get_row, insert_row, list_rows, patch_row
from app.repositories.tables import PRODUCTS
from app.routes.common import ok, raise_not_found
from app.schemas import ProductoCreate, ProductoPatch

router = APIRouter(prefix="/api/productos", tags=["productos"])


@router.get("")
def listar_productos(
    activo: bool | None = None,
    categoria: str | None = None,
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
):
    parts: list[sql.SQL] = []
    params: list = []

    if activo is not None:
        parts.append(sql.SQL("activo = %s"))
        params.append(activo)
    if categoria:
        parts.append(sql.SQL("categoria = %s"))
        params.append(categoria)

    where = sql.SQL("where ") + sql.SQL(" and ").join(parts) if parts else None
    rows = list_rows(PRODUCTS, limit=limit, offset=offset, where_sql=where, params=params, order_by="nombre", desc=False)
    return ok(rows)


@router.get("/{producto_id}")
def obtener_producto(producto_id: str):
    row = get_row(PRODUCTS, producto_id)
    if not row:
        raise_not_found("Producto")
    return ok(row)


@router.post("", dependencies=[Depends(require_api_key)])
def crear_producto(payload: ProductoCreate):
    row = insert_row(PRODUCTS, payload.model_dump(exclude_unset=True))
    return ok(row)


@router.patch("/{producto_id}", dependencies=[Depends(require_api_key)])
def actualizar_producto(producto_id: str, payload: ProductoPatch):
    row = patch_row(PRODUCTS, producto_id, payload.model_dump(exclude_unset=True))
    if not row:
        raise_not_found("Producto")
    return ok(row)


@router.delete("/{producto_id}", dependencies=[Depends(require_api_key)])
def desactivar_producto(producto_id: str):
    deleted = delete_row(PRODUCTS, producto_id)
    if not deleted:
        raise_not_found("Producto")
    return ok(message="Producto desactivado")
