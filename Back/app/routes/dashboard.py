from __future__ import annotations

from fastapi import APIRouter

from app.db import fetch_one, fetch_all
from app.routes.common import ok

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("/resumen")
def resumen_dashboard():
    ventas = fetch_one(
        """
        select
          coalesce(sum(total), 0) as ventas_total,
          count(*)::int as tickets,
          coalesce(avg(total), 0) as ticket_promedio
        from public.tickets
        where fecha >= now() - interval '30 days'
        """
    )
    produccion = fetch_one(
        """
        select
          coalesce(sum(planificado), 0) as planificado,
          coalesce(sum(producido), 0) as producido,
          coalesce(sum(merma), 0) as merma
        from public.production_batches
        where fecha >= now() - interval '30 days'
        """
    )
    inventario = fetch_one(
        """
        select
          count(*) filter (where stock_actual <= stock_minimo)::int as insumos_bajo_stock,
          coalesce(sum(stock_actual * costo_unitario), 0) as valor_stock
        from public.supplies
        """
    )
    energia = fetch_one(
        """
        select
          coalesce(sum(kwh), 0) as kwh,
          coalesce(sum(costo), 0) as costo
        from public.energy_records
        where fecha >= now() - interval '30 days'
        """
    )

    top_productos = fetch_all(
        """
        select p.id, p.nombre, coalesce(sum(ti.cantidad), 0) as cantidad, coalesce(sum(ti.cantidad * ti.precio_unitario), 0) as total
        from public.ticket_items ti
        join public.products p on p.id = ti.product_id
        join public.tickets t on t.id = ti.ticket_id
        where t.fecha >= now() - interval '30 days'
        group by p.id, p.nombre
        order by total desc
        limit 8
        """
    )

    return ok({
        "ventas": ventas,
        "produccion": produccion,
        "inventario": inventario,
        "energia": energia,
        "top_productos": top_productos,
    })
