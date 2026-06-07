from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from psycopg import sql

from app.core.security import require_api_key
from app.repositories.crud import delete_row, get_row, insert_row, list_rows, patch_row
from app.repositories.tables import SUPPLIES
from app.routes.common import ok, raise_not_found
from app.schemas import InsumoCreate, InsumoPatch

router = APIRouter(prefix="/api/insumos", tags=["insumos"])


@router.get("")
def listar_insumos(
    bajo_stock: bool | None = None,
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
):
    where = sql.SQL("where stock_actual <= stock_minimo") if bajo_stock else None
    rows = list_rows(SUPPLIES, limit=limit, offset=offset, where_sql=where, order_by="nombre", desc=False)
    return ok(rows)


@router.get("/{insumo_id}")
def obtener_insumo(insumo_id: str):
    row = get_row(SUPPLIES, insumo_id)
    if not row:
        raise_not_found("Insumo")
    return ok(row)


@router.post("", dependencies=[Depends(require_api_key)])
def crear_insumo(payload: InsumoCreate):
    row = insert_row(SUPPLIES, payload.model_dump(exclude_unset=True))
    return ok(row)


@router.patch("/{insumo_id}", dependencies=[Depends(require_api_key)])
def actualizar_insumo(insumo_id: str, payload: InsumoPatch):
    row = patch_row(SUPPLIES, insumo_id, payload.model_dump(exclude_unset=True))
    if not row:
        raise_not_found("Insumo")
    return ok(row)


@router.delete("/{insumo_id}", dependencies=[Depends(require_api_key)])
def eliminar_insumo(insumo_id: str):
    deleted = delete_row(SUPPLIES, insumo_id)
    if not deleted:
        raise_not_found("Insumo")
    return ok(message="Insumo eliminado")
