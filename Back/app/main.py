from __future__ import annotations

import logging

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse

from app.core.config import get_settings
from app.db import close_pool, get_pool
from app.routes import admin_crud, admin_schema, dashboard, delivery, employees, energy, health, inventory, production, products, recipes, sales, security, supplies

settings = get_settings()

logging.basicConfig(
    level=getattr(logging, settings.log_level.upper(), logging.INFO),
    format="%(asctime)s %(levelname)s %(name)s :: %(message)s",
)
logger = logging.getLogger(__name__)

app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    docs_url="/docs" if settings.docs_enabled else None,
    openapi_url="/openapi.json" if settings.docs_enabled else None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
    max_age=3600,
)
app.add_middleware(GZipMiddleware, minimum_size=1024)


@app.exception_handler(ValueError)
async def value_error_handler(_: Request, exc: ValueError):
    return JSONResponse(status_code=400, content={"ok": False, "error": str(exc)})


@app.exception_handler(Exception)
async def general_error_handler(_: Request, exc: Exception):
    logger.exception("Unhandled error")
    return JSONResponse(status_code=500, content={"ok": False, "error": "Error interno del backend", "detail": str(exc)})


app.include_router(health.router)
app.include_router(security.router)
app.include_router(products.router)
app.include_router(supplies.router)
app.include_router(recipes.router)
app.include_router(sales.router)
app.include_router(production.router)
app.include_router(inventory.router)
app.include_router(employees.router)
app.include_router(energy.router)
app.include_router(delivery.router)
app.include_router(dashboard.router)
app.include_router(admin_schema.router)
app.include_router(admin_crud.router)


@app.on_event("startup")
def startup():
    # Abre el pool si DATABASE_URL está configurado. Si no, la app levanta igual
    # y /health/db explica qué falta configurar.
    if settings.database_url:
        try:
            get_pool()
        except Exception:
            logger.exception("No se pudo abrir el pool PostgreSQL al iniciar")


@app.on_event("shutdown")
def shutdown():
    close_pool()
