from __future__ import annotations

from typing import Any

from psycopg.types.json import Jsonb

from app.utils.naming import camelize
from app.db import get_conn
from app.repositories.crud import new_id


def write_audit(
    *,
    tabla: str,
    record_id: str,
    accion: str,
    usuario_id: str | None = None,
    datos_anteriores: dict[str, Any] | None = None,
    datos_nuevos: dict[str, Any] | None = None,
    motivo: str | None = None,
) -> None:
    try:
        with get_conn() as conn, conn.cursor() as cur:
            cur.execute(
                """
                insert into public.audit_log
                  (id, tabla, record_id, accion, usuario_id, datos_anteriores, datos_nuevos, motivo)
                values (%s, %s, %s, %s, %s, %s, %s, %s)
                """,
                [
                    new_id("audit"),
                    tabla,
                    record_id,
                    accion,
                    usuario_id,
                    Jsonb(camelize(datos_anteriores)) if datos_anteriores is not None else None,
                    Jsonb(camelize(datos_nuevos)) if datos_nuevos is not None else None,
                    motivo,
                ],
            )
    except Exception:
        # La auditoría no debe romper la operación principal si la tabla aún no existe.
        return
