from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Query
from psycopg import sql

from app.core.security import require_api_key
from app.db import get_conn
from app.repositories.crud import delete_row, get_row, insert_row, list_rows, new_id, patch_row
from app.repositories.tables import INVENTORY_MOVEMENTS
from app.routes.common import ok, raise_not_found
from app.schemas import MovimientoInventarioCreate, MovimientoInventarioPatch

router = APIRouter(prefix="/api/inventario", tags=["inventario"])


@router.get("/movimientos")
def listar_movimientos(
    supply_id: str | None = None,
    tipo: str | None = None,
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
):
    parts: list[sql.SQL] = []
    params: list = []
    if supply_id:
        parts.append(sql.SQL("supply_id = %s"))
        params.append(supply_id)
    if tipo:
        parts.append(sql.SQL("tipo = %s"))
        params.append(tipo)
    where = sql.SQL("where ") + sql.SQL(" and ").join(parts) if parts else None
    rows = list_rows(INVENTORY_MOVEMENTS, limit=limit, offset=offset, where_sql=where, params=params, order_by="fecha", desc=True)
    return ok(rows)


@router.post("/movimientos", dependencies=[Depends(require_api_key)])
def crear_movimiento(payload: MovimientoInventarioCreate):
    data = payload.model_dump(exclude_unset=True)
    data.setdefault("fecha", datetime.now(timezone.utc))

    data.setdefault("id", new_id("mov"))

    with get_conn() as conn:
        with conn.transaction(), conn.cursor() as cur:
            cur.execute(
                """
                insert into public.inventory_movements
                  (id, fecha, supply_id, tipo, cantidad, motivo, referencia)
                values (%s, %s, %s, %s, %s, %s, %s)
                returning *
                """,
                [
                    data["id"],
                    data["fecha"],
                    data["supply_id"],
                    data["tipo"],
                    data["cantidad"],
                    data.get("motivo", ""),
                    data.get("referencia"),
                ],
            )
            row = cur.fetchone()
            signo = 1 if row["tipo"] == "Entrada" else -1 if row["tipo"] == "Salida" else 1
            cur.execute(
                """
                update public.supplies
                set stock_actual = stock_actual + %s
                where id = %s
                """,
                [signo * row["cantidad"], row["supply_id"]],
            )
    return ok(row)


@router.patch("/movimientos/{movimiento_id}", dependencies=[Depends(require_api_key)])
def actualizar_movimiento(movimiento_id: str, payload: MovimientoInventarioPatch):
    row = patch_row(INVENTORY_MOVEMENTS, movimiento_id, payload.model_dump(exclude_unset=True))
    if not row:
        raise_not_found("Movimiento")
    return ok(row)


@router.delete("/movimientos/{movimiento_id}", dependencies=[Depends(require_api_key)])
def eliminar_movimiento(movimiento_id: str):
    deleted = delete_row(INVENTORY_MOVEMENTS, movimiento_id)
    if not deleted:
        raise_not_found("Movimiento")
    return ok(message="Movimiento eliminado")


@router.get("/resumen")
def resumen_inventario():
    with get_conn() as conn, conn.cursor() as cur:
        cur.execute(
            """
            select
              count(*)::int as total_insumos,
              count(*) filter (where stock_actual <= stock_minimo)::int as bajo_stock,
              coalesce(sum(stock_actual * costo_unitario), 0) as valor_stock
            from public.supplies
            """
        )
        return ok(cur.fetchone())
