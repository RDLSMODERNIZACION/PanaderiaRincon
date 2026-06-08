from __future__ import annotations

from dataclasses import dataclass, field
from typing import Iterable, Mapping, Any
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
    label: str | None = None
    search_columns: tuple[str, ...] = field(default_factory=tuple)
    default_order_by: str = "created_at"
    default_desc: bool = True
    read_only: bool = False

    @property
    def all_allowed_columns(self) -> set[str]:
        return set(self.allowed_create) | set(self.allowed_patch) | {"id"}


def new_id(prefix: str) -> str:
    return f"{prefix}_{uuid4().hex[:10]}"


def _clean_payload(payload: Mapping[str, Any], allowed: Iterable[str], *, skip_none: bool = False) -> dict[str, Any]:
    allowed_set = set(allowed)
    cleaned: dict[str, Any] = {}
    for key, value in payload.items():
        if key not in allowed_set:
            continue
        if skip_none and value is None:
            continue
        cleaned[key] = value
    return cleaned


def list_rows(
    config: TableConfig,
    *,
    limit: int = 100,
    offset: int = 0,
    where_sql: sql.SQL | None = None,
    params: list | None = None,
    order_by: str | None = None,
    desc: bool | None = None,
    q: str | None = None,
) -> list[dict]:
    params = list(params or [])
    where = where_sql or sql.SQL("")

    if q and config.search_columns:
        like_parts = [sql.SQL("{}::text ilike %s").format(sql.Identifier(col)) for col in config.search_columns]
        search_clause = sql.SQL("(") + sql.SQL(" or ").join(like_parts) + sql.SQL(")")
        where = (where + sql.SQL(" and ") + search_clause) if where_sql is not None else (sql.SQL("where ") + search_clause)
        params.extend([f"%{q}%"] * len(config.search_columns))

    order_column = order_by or config.default_order_by
    order_direction = sql.SQL("desc") if (config.default_desc if desc is None else desc) else sql.SQL("asc")

    query = sql.SQL(
        "select * from public.{table} {where} order by {order_by} {direction} limit %s offset %s"
    ).format(
        table=sql.Identifier(config.table),
        where=where,
        order_by=sql.Identifier(order_column),
        direction=order_direction,
    )
    params.extend([limit, offset])

    with get_conn() as conn, conn.cursor() as cur:
        cur.execute(query, params)
        return list(cur.fetchall())


def count_rows(config: TableConfig, *, where_sql: sql.SQL | None = None, params: list | None = None) -> int:
    query = sql.SQL("select count(*)::int as count from public.{table} {where}").format(
        table=sql.Identifier(config.table),
        where=where_sql or sql.SQL(""),
    )
    with get_conn() as conn, conn.cursor() as cur:
        cur.execute(query, params or [])
        row = cur.fetchone()
        return int(row["count"] if row else 0)


def get_row(config: TableConfig, row_id: str) -> dict | None:
    query = sql.SQL("select * from public.{table} where id = %s").format(table=sql.Identifier(config.table))
    with get_conn() as conn, conn.cursor() as cur:
        cur.execute(query, [row_id])
        return cur.fetchone()


def insert_row(config: TableConfig, payload: Mapping[str, Any]) -> dict:
    if config.read_only:
        raise ValueError(f"La tabla {config.table} es solo lectura.")
    data = _clean_payload(payload, config.allowed_create, skip_none=True)
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


def patch_row(config: TableConfig, row_id: str, payload: Mapping[str, Any]) -> dict | None:
    if config.read_only:
        raise ValueError(f"La tabla {config.table} es solo lectura.")
    data = _clean_payload(payload, config.allowed_patch, skip_none=False)
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


def delete_row(config: TableConfig, row_id: str, *, hard: bool = False) -> bool:
    if config.read_only:
        raise ValueError(f"La tabla {config.table} es solo lectura.")

    if config.soft_delete_column and not hard:
        query = sql.SQL("update public.{table} set {col} = false where id = %s").format(
            table=sql.Identifier(config.table),
            col=sql.Identifier(config.soft_delete_column),
        )
    else:
        query = sql.SQL("delete from public.{table} where id = %s").format(table=sql.Identifier(config.table))

    with get_conn() as conn, conn.cursor() as cur:
        cur.execute(query, [row_id])
        return cur.rowcount > 0
