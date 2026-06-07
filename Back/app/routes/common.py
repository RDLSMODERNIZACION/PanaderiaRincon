from __future__ import annotations

from fastapi import HTTPException, Query

from app.utils.naming import camelize


def pagination(limit: int = Query(100, ge=1, le=500), offset: int = Query(0, ge=0)) -> tuple[int, int]:
    return limit, offset


def ok(data=None, **extra):
    payload = {"ok": True}
    if data is not None:
        payload["data"] = data
    payload.update(extra)
    return camelize(payload)


def raise_not_found(label: str = "Registro"):
    raise HTTPException(status_code=404, detail=f"{label} no encontrado.")
