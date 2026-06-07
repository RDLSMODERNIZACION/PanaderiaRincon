from __future__ import annotations

from fastapi import APIRouter, Depends

from app.core.security import require_api_key
from app.db import fetch_all
from app.routes.common import ok

router = APIRouter(prefix="/api/admin/schema", tags=["admin-schema"], dependencies=[Depends(require_api_key)])


@router.get("/tables")
def listar_tablas():
    rows = fetch_all(
        """
        select table_schema, table_name
        from information_schema.tables
        where table_schema = 'public'
          and table_type = 'BASE TABLE'
        order by table_name
        """
    )
    return ok(rows)


@router.get("/tables/{table_name}/columns")
def listar_columnas(table_name: str):
    rows = fetch_all(
        """
        select column_name, data_type, is_nullable, column_default
        from information_schema.columns
        where table_schema = 'public'
          and table_name = %s
        order by ordinal_position
        """,
        [table_name],
    )
    return ok(rows)
