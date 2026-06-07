from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Query

from app.core.security import require_api_key
from app.db import get_conn
from app.repositories.crud import new_id
from app.routes.common import ok, raise_not_found
from app.schemas import TicketCreate

router = APIRouter(prefix="/api/ventas", tags=["ventas"])


def _ticket_by_id(ticket_id: str) -> dict | None:
    with get_conn() as conn, conn.cursor() as cur:
        cur.execute(
            """
            select t.*,
              coalesce(
                json_agg(
                  json_build_object(
                    'id', ti.id,
                    'product_id', ti.product_id,
                    'producto_nombre', p.nombre,
                    'cantidad', ti.cantidad,
                    'precio_unitario', ti.precio_unitario,
                    'subtotal', ti.cantidad * ti.precio_unitario
                  ) order by ti.id
                ) filter (where ti.id is not null),
                '[]'::json
              ) as items
            from public.tickets t
            left join public.ticket_items ti on ti.ticket_id = t.id
            left join public.products p on p.id = ti.product_id
            where t.id = %s
            group by t.id
            """,
            [ticket_id],
        )
        return cur.fetchone()


@router.get("")
def listar_ventas(
    desde: str | None = None,
    hasta: str | None = None,
    canal: str | None = None,
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
):
    where = []
    params: list = []

    if desde:
        params.append(desde)
        where.append(f"t.fecha >= %s")
    if hasta:
        params.append(hasta)
        where.append(f"t.fecha < (%s::date + interval '1 day')")
    if canal:
        params.append(canal)
        where.append("t.canal = %s")

    where_sql = "where " + " and ".join(where) if where else ""
    params.extend([limit, offset])

    with get_conn() as conn, conn.cursor() as cur:
        cur.execute(
            f"""
            select t.*,
              coalesce(sum(ti.cantidad * ti.precio_unitario), 0) - t.descuento as total,
              count(ti.id)::int as items_count
            from public.tickets t
            left join public.ticket_items ti on ti.ticket_id = t.id
            {where_sql}
            group by t.id
            order by t.fecha desc
            limit %s offset %s
            """,
            params,
        )
        return ok(cur.fetchall())


@router.get("/{ticket_id}")
def obtener_venta(ticket_id: str):
    row = _ticket_by_id(ticket_id)
    if not row:
        raise_not_found("Venta")
    return ok(row)


@router.post("", dependencies=[Depends(require_api_key)])
def crear_venta(payload: TicketCreate):
    if not payload.items:
        raise ValueError("La venta debe tener al menos un item.")

    ticket_id = payload.id or new_id("ticket")
    fecha = payload.fecha or datetime.now(timezone.utc)
    total_bruto = sum(item.cantidad * item.precio_unitario for item in payload.items)
    total = max(0, total_bruto - payload.descuento)

    with get_conn() as conn:
        with conn.transaction(), conn.cursor() as cur:
            cur.execute(
                """
                insert into public.tickets (id, fecha, canal, medio_pago, descuento, total)
                values (%s, %s, %s, %s, %s, %s)
                """,
                [ticket_id, fecha, payload.canal, payload.medio_pago, payload.descuento, total],
            )
            for item in payload.items:
                cur.execute(
                    """
                    insert into public.ticket_items (id, ticket_id, product_id, cantidad, precio_unitario)
                    values (%s, %s, %s, %s, %s)
                    """,
                    [new_id("ti"), ticket_id, item.product_id, item.cantidad, item.precio_unitario],
                )

    return ok(_ticket_by_id(ticket_id))


@router.delete("/{ticket_id}", dependencies=[Depends(require_api_key)])
def eliminar_venta(ticket_id: str):
    with get_conn() as conn, conn.cursor() as cur:
        cur.execute("delete from public.tickets where id = %s", [ticket_id])
        if cur.rowcount == 0:
            raise_not_found("Venta")
    return ok(message="Venta eliminada")
