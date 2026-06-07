from __future__ import annotations

from fastapi import APIRouter, Depends, Query

from app.core.security import require_api_key
from app.db import get_conn
from app.repositories.crud import new_id
from app.routes.common import ok, raise_not_found
from app.schemas import RecetaCreate, RecetaPatch

router = APIRouter(prefix="/api/recetas", tags=["recetas"])


def _get_recipe(recipe_id: str) -> dict | None:
    with get_conn() as conn, conn.cursor() as cur:
        cur.execute(
            """
            select r.*,
              coalesce(
                json_agg(
                  json_build_object(
                    'id', ri.id,
                    'insumo_id', ri.supply_id,
                    'cantidad', ri.cantidad,
                    'unidad', ri.unidad,
                    'nombre', s.nombre
                  ) order by ri.id
                ) filter (where ri.id is not null),
                '[]'::json
              ) as ingredientes
            from public.recipes r
            left join public.recipe_items ri on ri.recipe_id = r.id
            left join public.supplies s on s.id = ri.supply_id
            where r.id = %s
            group by r.id
            """,
            [recipe_id],
        )
        return cur.fetchone()


@router.get("")
def listar_recetas(limit: int = Query(100, ge=1, le=500), offset: int = Query(0, ge=0)):
    with get_conn() as conn, conn.cursor() as cur:
        cur.execute(
            """
            select r.*, p.nombre as producto_nombre,
              coalesce(count(ri.id), 0)::int as ingredientes_count
            from public.recipes r
            left join public.products p on p.id = r.product_id
            left join public.recipe_items ri on ri.recipe_id = r.id
            group by r.id, p.nombre
            order by p.nombre asc nulls last, r.created_at desc
            limit %s offset %s
            """,
            [limit, offset],
        )
        return ok(cur.fetchall())


@router.get("/{receta_id}")
def obtener_receta(receta_id: str):
    row = _get_recipe(receta_id)
    if not row:
        raise_not_found("Receta")
    return ok(row)


@router.post("", dependencies=[Depends(require_api_key)])
def crear_receta(payload: RecetaCreate):
    recipe_id = payload.id or new_id("receta")
    with get_conn() as conn:
        with conn.transaction(), conn.cursor() as cur:
            cur.execute(
                """
                insert into public.recipes (id, product_id, rinde_unidades)
                values (%s, %s, %s)
                returning *
                """,
                [recipe_id, payload.product_id, payload.rinde_unidades],
            )
            for item in payload.ingredientes:
                cur.execute(
                    """
                    insert into public.recipe_items (id, recipe_id, supply_id, cantidad, unidad)
                    values (%s, %s, %s, %s, %s)
                    """,
                    [new_id("ri"), recipe_id, item.insumo_id, item.cantidad, item.unidad],
                )
    return ok(_get_recipe(recipe_id))


@router.patch("/{receta_id}", dependencies=[Depends(require_api_key)])
def actualizar_receta(receta_id: str, payload: RecetaPatch):
    current = _get_recipe(receta_id)
    if not current:
        raise_not_found("Receta")

    data = payload.model_dump(exclude_unset=True)
    with get_conn() as conn:
        with conn.transaction(), conn.cursor() as cur:
            if "product_id" in data or "rinde_unidades" in data:
                cur.execute(
                    """
                    update public.recipes
                    set product_id = coalesce(%s, product_id),
                        rinde_unidades = coalesce(%s, rinde_unidades)
                    where id = %s
                    """,
                    [data.get("product_id"), data.get("rinde_unidades"), receta_id],
                )

            if payload.ingredientes is not None:
                cur.execute("delete from public.recipe_items where recipe_id = %s", [receta_id])
                for item in payload.ingredientes:
                    cur.execute(
                        """
                        insert into public.recipe_items (id, recipe_id, supply_id, cantidad, unidad)
                        values (%s, %s, %s, %s, %s)
                        """,
                        [new_id("ri"), receta_id, item.insumo_id, item.cantidad, item.unidad],
                    )

    return ok(_get_recipe(receta_id))


@router.delete("/{receta_id}", dependencies=[Depends(require_api_key)])
def eliminar_receta(receta_id: str):
    with get_conn() as conn, conn.cursor() as cur:
        cur.execute("delete from public.recipes where id = %s", [receta_id])
        if cur.rowcount == 0:
            raise_not_found("Receta")
    return ok(message="Receta eliminada")
