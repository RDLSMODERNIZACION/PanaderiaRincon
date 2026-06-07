from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable, Mapping
from uuid import uuid4

from psycopg import sql

from app.db import get_conn


@dataclass(frozen=True)
class TableConfig:
    table: str
    id_prefix: str
    allowed_create: tuple[str, ...]
    allowed_patch: tuple[str, ...]
    soft_delete_column: str | None = None


def new_id(prefix: str) -> str:
    return f"{prefix}_{uuid4().hex[:10]}"


def _clean_payload(payload: Mapping, allowed: Iterable[str]) -> dict:
    allowed_set = set(allowed)
    return {key: value for key, value in payload.items() if key in allowed_set and value is not None}


def list_rows(config: TableConfig, *, limit: int = 100, offset: int = 0, where_sql: sql.SQL | None = None, params: list | None = None, order_by: str = "created_at", desc: bool = True) -> list[dict]:
    params = list(params or [])
    order_direction = sql.SQL("desc") if desc else sql.SQL("asc")

    query = sql.SQL("select * from public.{table} {where} order by {order_by} {direction} limit %s offset %s").format(
        table=sql.Identifier(config.table),
        where=where_sql or sql.SQL(""),
        order_by=sql.Identifier(order_by),
        direction=order_direction,
    )
    params.extend([limit, offset])

    with get_conn() as conn, conn.cursor() as cur:
        cur.execute(query, params)
        return list(cur.fetchall())


def get_row(config: TableConfig, row_id: str) -> dict | None:
    query = sql.SQL("select * from public.{table} where id = %s").format(table=sql.Identifier(config.table))
    with get_conn() as conn, conn.cursor() as cur:
        cur.execute(query, [row_id])
        return cur.fetchone()


def insert_row(config: TableConfig, payload: Mapping) -> dict:
    data = _clean_payload(payload, config.allowed_create)
    data.setdefault("id", new_id(config.id_prefix))

    columns = list(data.keys())
    values = [data[col] for col in columns]

    query = sql.SQL("insert into public.{table} ({columns}) values ({placeholders}) returning *").format(
        table=sql.Identifier(config.table),
        columns=sql.SQL(", ").join(map(sql.Identifier, columns)),
        placeholders=sql.SQL(", ").join(sql.Placeholder() for _ in columns),
    )

    with get_conn() as conn, conn.cursor() as cur:
        cur.execute(query, values)
        return cur.fetchone()


def patch_row(config: TableConfig, row_id: str, payload: Mapping) -> dict | None:
    data = _clean_payload(payload, config.allowed_patch)
    if not data:
        return get_row(config, row_id)

    assignments = [sql.SQL("{} = {}").format(sql.Identifier(col), sql.Placeholder()) for col in data.keys()]
    values = list(data.values()) + [row_id]

    query = sql.SQL("update public.{table} set {assignments} where id = %s returning *").format(
        table=sql.Identifier(config.table),
        assignments=sql.SQL(", ").join(assignments),
    )

    with get_conn() as conn, conn.cursor() as cur:
        cur.execute(query, values)
        return cur.fetchone()


def delete_row(config: TableConfig, row_id: str) -> bool:
    if config.soft_delete_column:
        query = sql.SQL("update public.{table} set {col} = false where id = %s").format(
            table=sql.Identifier(config.table),
            col=sql.Identifier(config.soft_delete_column),
        )
    else:
        query = sql.SQL("delete from public.{table} where id = %s").format(table=sql.Identifier(config.table))

    with get_conn() as conn, conn.cursor() as cur:
        cur.execute(query, [row_id])
        return cur.rowcount > 0
