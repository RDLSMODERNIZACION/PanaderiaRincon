from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Query
from psycopg import sql

from app.core.security import require_api_key
from app.repositories.crud import delete_row, get_row, insert_row, list_rows, patch_row
from app.repositories.tables import ENERGY_RECORDS
from app.routes.common import ok, raise_not_found
from app.schemas import EnergiaCreate, EnergiaPatch

router = APIRouter(prefix="/api/energia", tags=["energia"])


@router.get("/registros")
def listar_registros(
    horno: str | None = None,
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
):
    where = sql.SQL("where horno = %s") if horno else None
    rows = list_rows(ENERGY_RECORDS, limit=limit, offset=offset, where_sql=where, params=[horno] if horno else [], order_by="fecha", desc=True)
    return ok(rows)


@router.post("/registros", dependencies=[Depends(require_api_key)])
def crear_registro(payload: EnergiaCreate):
    data = payload.model_dump(exclude_unset=True)
    data.setdefault("fecha", datetime.now(timezone.utc))
    row = insert_row(ENERGY_RECORDS, data)
    return ok(row)


@router.patch("/registros/{registro_id}", dependencies=[Depends(require_api_key)])
def actualizar_registro(registro_id: str, payload: EnergiaPatch):
    row = patch_row(ENERGY_RECORDS, registro_id, payload.model_dump(exclude_unset=True))
    if not row:
        raise_not_found("Registro de energía")
    return ok(row)


@router.delete("/registros/{registro_id}", dependencies=[Depends(require_api_key)])
def eliminar_registro(registro_id: str):
    deleted = delete_row(ENERGY_RECORDS, registro_id)
    if not deleted:
        raise_not_found("Registro de energía")
    return ok(message="Registro eliminado")
