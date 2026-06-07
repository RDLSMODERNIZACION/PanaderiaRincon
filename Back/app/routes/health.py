from __future__ import annotations

import time

from fastapi import APIRouter
from fastapi.responses import JSONResponse

from app.core.config import get_settings
from app.db import fetch_one

router = APIRouter(tags=["health"])
settings = get_settings()


@router.get("/")
def root():
    return {
        "ok": True,
        "service": settings.app_name,
        "version": settings.app_version,
        "docs": "/docs" if settings.docs_enabled else None,
        "health": "/health",
        "health_db": "/health/db",
    }


@router.get("/health")
def health():
    return {"ok": True, "service": settings.app_name}


@router.get("/health/db")
def health_db():
    started = time.perf_counter()
    try:
        row = fetch_one(
            """
            select
              now()::text as now,
              current_database() as database_name,
              current_user as database_user,
              version() as server_version
            """
        )
        return {
            "ok": True,
            "db": "up",
            "latencyMs": round((time.perf_counter() - started) * 1000),
            "database": row["database_name"],
            "user": row["database_user"],
            "now": row["now"],
            "server": row["server_version"].split(" on ")[0],
        }
    except Exception as exc:
        return JSONResponse(
            status_code=503,
            content={
                "ok": False,
                "db": "down",
                "error": str(exc),
            },
        )
