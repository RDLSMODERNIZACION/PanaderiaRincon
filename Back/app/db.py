from __future__ import annotations

import logging
from contextlib import contextmanager
from typing import Generator, Iterable, Optional

from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool

from app.core.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

_pool: Optional[ConnectionPool] = None


def _build_pool() -> ConnectionPool:
    if not settings.database_url:
        raise RuntimeError(
            "Falta DATABASE_URL. Copiá .env.example a .env y pegá la URL de Supabase/PostgreSQL."
        )

    return ConnectionPool(
        conninfo=settings.database_url,
        min_size=settings.db_pool_min,
        max_size=settings.db_pool_max,
        timeout=settings.db_pool_timeout,
        open=False,
        kwargs={
            "row_factory": dict_row,
            "sslmode": "require",
            "connect_timeout": settings.db_connect_timeout,
            # Supabase pooler funciona mejor sin prepared statements persistentes.
            "prepare_threshold": None,
        },
    )


def get_pool() -> ConnectionPool:
    global _pool
    if _pool is None:
        _pool = _build_pool()
        _pool.open(wait=True)
        logger.info("Pool PostgreSQL abierto")
    return _pool


@contextmanager
def get_conn() -> Generator:
    pool = get_pool()
    with pool.connection() as conn:
        yield conn


def fetch_all(sql: str, params: Iterable | dict | None = None) -> list[dict]:
    with get_conn() as conn, conn.cursor() as cur:
        cur.execute(sql, params)
        return list(cur.fetchall())


def fetch_one(sql: str, params: Iterable | dict | None = None) -> dict | None:
    with get_conn() as conn, conn.cursor() as cur:
        cur.execute(sql, params)
        row = cur.fetchone()
        return dict(row) if row else None


def execute(sql: str, params: Iterable | dict | None = None) -> int:
    with get_conn() as conn, conn.cursor() as cur:
        cur.execute(sql, params)
        return cur.rowcount


def close_pool() -> None:
    global _pool
    if _pool is not None:
        _pool.close()
        _pool = None
        logger.info("Pool PostgreSQL cerrado")
