from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Query
from psycopg import sql

from app.core.security import require_api_key
from app.repositories.crud import delete_row, get_row, insert_row, list_rows, patch_row
from app.repositories.tables import PRODUCTION_BATCHES
from app.routes.common import ok, raise_not_found
from app.schemas import ProduccionCreate, ProduccionPatch

router = APIRouter(prefix="/api/produccion", tags=["produccion"])


@router.get("")
def listar_produccion(
    desde: str | None = None,
    hasta: str | None = None,
    product_id: str | None = None,
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
):
    parts: list[sql.SQL] = []
    params: list = []
    if desde:
        parts.append(sql.SQL("fecha >= %s"))
        params.append(desde)
    if hasta:
        parts.append(sql.SQL("fecha < (%s::date + interval '1 day')"))
        params.append(hasta)
    if product_id:
        parts.append(sql.SQL("product_id = %s"))
        params.append(product_id)
    where = sql.SQL("where ") + sql.SQL(" and ").join(parts) if parts else None
    rows = list_rows(PRODUCTION_BATCHES, limit=limit, offset=offset, where_sql=where, params=params, order_by="fecha", desc=True)
    return ok(rows)


@router.get("/{lote_id}")
def obtener_lote(lote_id: str):
    row = get_row(PRODUCTION_BATCHES, lote_id)
    if not row:
        raise_not_found("Lote de producción")
    return ok(row)


@router.post("", dependencies=[Depends(require_api_key)])
def crear_lote(payload: ProduccionCreate):
    data = payload.model_dump(exclude_unset=True)
    data.setdefault("fecha", datetime.now(timezone.utc))
    row = insert_row(PRODUCTION_BATCHES, data)
    return ok(row)


@router.patch("/{lote_id}", dependencies=[Depends(require_api_key)])
def actualizar_lote(lote_id: str, payload: ProduccionPatch):
    row = patch_row(PRODUCTION_BATCHES, lote_id, payload.model_dump(exclude_unset=True))
    if not row:
        raise_not_found("Lote de producción")
    return ok(row)


@router.delete("/{lote_id}", dependencies=[Depends(require_api_key)])
def eliminar_lote(lote_id: str):
    deleted = delete_row(PRODUCTION_BATCHES, lote_id)
    if not deleted:
        raise_not_found("Lote de producción")
    return ok(message="Lote eliminado")
