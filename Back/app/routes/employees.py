from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Query

from app.core.security import require_api_key
from app.db import get_conn
from app.repositories.crud import delete_row, get_row, insert_row, list_rows, new_id, patch_row
from app.repositories.tables import EMPLOYEES, EMPLOYEE_SHIFTS
from app.routes.common import ok, raise_not_found
from app.schemas import EmpleadoCreate, EmpleadoPatch, TurnoPersonalCreate

router = APIRouter(prefix="/api/personal", tags=["personal"])


@router.get("/empleados")
def listar_empleados(activo: bool | None = None, limit: int = Query(100, ge=1, le=500), offset: int = Query(0, ge=0)):
    # Para mantenerlo simple, si activo viene informado se filtra con SQL directa.
    if activo is None:
        rows = list_rows(EMPLOYEES, limit=limit, offset=offset, order_by="nombre", desc=False)
    else:
        from psycopg import sql
        rows = list_rows(EMPLOYEES, limit=limit, offset=offset, where_sql=sql.SQL("where activo = %s"), params=[activo], order_by="nombre", desc=False)
    return ok(rows)


@router.post("/empleados", dependencies=[Depends(require_api_key)])
def crear_empleado(payload: EmpleadoCreate):
    row = insert_row(EMPLOYEES, payload.model_dump(exclude_unset=True))
    return ok(row)


@router.patch("/empleados/{empleado_id}", dependencies=[Depends(require_api_key)])
def actualizar_empleado(empleado_id: str, payload: EmpleadoPatch):
    row = patch_row(EMPLOYEES, empleado_id, payload.model_dump(exclude_unset=True))
    if not row:
        raise_not_found("Empleado")
    return ok(row)


@router.delete("/empleados/{empleado_id}", dependencies=[Depends(require_api_key)])
def desactivar_empleado(empleado_id: str):
    deleted = delete_row(EMPLOYEES, empleado_id)
    if not deleted:
        raise_not_found("Empleado")
    return ok(message="Empleado desactivado")


@router.get("/turnos")
def listar_turnos(limit: int = Query(100, ge=1, le=500), offset: int = Query(0, ge=0)):
    with get_conn() as conn, conn.cursor() as cur:
        cur.execute(
            """
            select s.*, e.nombre as empleado_nombre, e.rol
            from public.employee_shifts s
            left join public.employees e on e.id = s.employee_id
            order by s.fecha desc
            limit %s offset %s
            """,
            [limit, offset],
        )
        return ok(cur.fetchall())


@router.post("/turnos", dependencies=[Depends(require_api_key)])
def crear_turno(payload: TurnoPersonalCreate):
    data = payload.model_dump(exclude_unset=True)
    data.setdefault("fecha", datetime.now(timezone.utc))
    data.setdefault("id", new_id("turno"))
    row = insert_row(EMPLOYEE_SHIFTS, data)
    return ok(row)


@router.delete("/turnos/{turno_id}", dependencies=[Depends(require_api_key)])
def eliminar_turno(turno_id: str):
    deleted = delete_row(EMPLOYEE_SHIFTS, turno_id)
    if not deleted:
        raise_not_found("Turno")
    return ok(message="Turno eliminado")
