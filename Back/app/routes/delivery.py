from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, Query
from psycopg import sql

from app.core.security import AuthContext, ensure_any_permission, get_auth_context
from app.db import fetch_all, fetch_one, get_conn
from app.repositories.crud import delete_row, get_row, insert_row, list_rows, new_id, patch_row
from app.repositories.tables import (
    BREADCRUMB_ACCOUNT_MOVEMENTS,
    CUSTOMER_ACCOUNT_MOVEMENTS,
    CUSTOMERS,
    DELIVERY_ROUTE_CUSTOMERS,
    DELIVERY_ROUTES,
    DELIVERY_RUN_CLOSURES,
    DELIVERY_RUN_STOCK,
    DELIVERY_RUNS,
    DELIVERY_VISIT_ITEMS,
    DELIVERY_VISITS,
    PAYMENTS,
    PRODUCT_PRICES,
)
from app.routes.common import ok, raise_not_found
from app.services.audit import write_audit

router = APIRouter(prefix="/api/reparto", tags=["reparto"])


def _now():
    return datetime.now(timezone.utc)


def _visit_totals(visit_id: str) -> dict:
    return fetch_one(
        """
        select
          coalesce(sum(case when tipo = 'venta' then subtotal else 0 end), 0) as total_vendido,
          coalesce(sum(case when tipo = 'devolucion' then subtotal else 0 end), 0) as total_devolucion,
          coalesce(sum(case when tipo = 'bonificacion' then subtotal else 0 end), 0) as total_bonificacion,
          coalesce(sum(case when tipo = 'ajuste' then subtotal else 0 end), 0) as total_ajuste
        from public.delivery_visit_items
        where visit_id = %s
        """,
        [visit_id],
    ) or {"total_vendido": 0, "total_devolucion": 0, "total_bonificacion": 0, "total_ajuste": 0}


def _confirmed_payments_total(visit_id: str) -> float:
    row = fetch_one(
        """
        select coalesce(sum(amount), 0) as total
        from public.payments
        where visit_id = %s and estado = 'confirmado'
        """,
        [visit_id],
    )
    return float(row["total"] if row else 0)


# Clientes / comercios
@router.get("/clientes")
def listar_clientes(
    activo: bool | None = True,
    q: str | None = None,
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    auth: AuthContext = Depends(get_auth_context),
):
    ensure_any_permission(auth, "delivery.read", "admin.crud.read")
    where = None
    params: list[Any] = []
    if activo is not None:
        where = sql.SQL("where activo = %s")
        params.append(activo)
    rows = list_rows(CUSTOMERS, where_sql=where, params=params, q=q, limit=limit, offset=offset)
    return ok(rows)


@router.get("/clientes/{customer_id}")
def obtener_cliente(customer_id: str, auth: AuthContext = Depends(get_auth_context)):
    ensure_any_permission(auth, "delivery.read", "admin.crud.read")
    row = get_row(CUSTOMERS, customer_id)
    if not row:
        raise_not_found("Cliente")
    saldo = fetch_one("select * from public.v_customer_balances where customer_id = %s", [customer_id])
    pan = fetch_one("select * from public.v_breadcrumb_balances where customer_id = %s", [customer_id])
    row["saldo_cuenta"] = saldo
    row["saldo_pan_rallado"] = pan
    return ok(row)


@router.post("/clientes")
def crear_cliente(payload: dict[str, Any], auth: AuthContext = Depends(get_auth_context)):
    ensure_any_permission(auth, "delivery.write", "admin.crud.write")
    row = insert_row(CUSTOMERS, payload)
    write_audit(tabla="customers", record_id=row["id"], accion="crear", usuario_id=auth.audit_user_id, datos_nuevos=row)
    return ok(row)


@router.patch("/clientes/{customer_id}")
def actualizar_cliente(customer_id: str, payload: dict[str, Any], auth: AuthContext = Depends(get_auth_context)):
    ensure_any_permission(auth, "delivery.write", "admin.crud.write")
    before = get_row(CUSTOMERS, customer_id)
    if not before:
        raise_not_found("Cliente")
    row = patch_row(CUSTOMERS, customer_id, payload)
    write_audit(tabla="customers", record_id=customer_id, accion="editar", usuario_id=auth.audit_user_id, datos_anteriores=before, datos_nuevos=row)
    return ok(row)


@router.delete("/clientes/{customer_id}")
def borrar_cliente(customer_id: str, auth: AuthContext = Depends(get_auth_context)):
    ensure_any_permission(auth, "delivery.delete", "admin.crud.delete")
    before = get_row(CUSTOMERS, customer_id)
    if not before:
        raise_not_found("Cliente")
    delete_row(CUSTOMERS, customer_id)
    write_audit(tabla="customers", record_id=customer_id, accion="anular", usuario_id=auth.audit_user_id, datos_anteriores=before)
    return ok(message="Cliente desactivado")


# Precios
@router.get("/precios")
def listar_precios(product_id: str | None = None, customer_id: str | None = None, auth: AuthContext = Depends(get_auth_context)):
    ensure_any_permission(auth, "delivery.read", "admin.crud.read")
    parts: list[sql.SQL] = []
    params: list[Any] = []
    if product_id:
        parts.append(sql.SQL("product_id = %s")); params.append(product_id)
    if customer_id:
        parts.append(sql.SQL("customer_id = %s")); params.append(customer_id)
    where = sql.SQL("where ") + sql.SQL(" and ").join(parts) if parts else None
    rows = list_rows(PRODUCT_PRICES, where_sql=where, params=params, limit=500, offset=0)
    return ok(rows)


@router.post("/precios")
def crear_precio(payload: dict[str, Any], auth: AuthContext = Depends(get_auth_context)):
    ensure_any_permission(auth, "delivery.write", "admin.crud.write")
    row = insert_row(PRODUCT_PRICES, payload)
    write_audit(tabla="product_prices", record_id=row["id"], accion="crear", usuario_id=auth.audit_user_id, datos_nuevos=row)
    return ok(row)


@router.patch("/precios/{precio_id}")
def actualizar_precio(precio_id: str, payload: dict[str, Any], auth: AuthContext = Depends(get_auth_context)):
    ensure_any_permission(auth, "delivery.write", "admin.crud.write")
    before = get_row(PRODUCT_PRICES, precio_id)
    if not before:
        raise_not_found("Precio")
    row = patch_row(PRODUCT_PRICES, precio_id, payload)
    write_audit(tabla="product_prices", record_id=precio_id, accion="editar", usuario_id=auth.audit_user_id, datos_anteriores=before, datos_nuevos=row)
    return ok(row)


@router.delete("/precios/{precio_id}")
def borrar_precio(precio_id: str, auth: AuthContext = Depends(get_auth_context)):
    ensure_any_permission(auth, "delivery.delete", "admin.crud.delete")
    before = get_row(PRODUCT_PRICES, precio_id)
    if not before:
        raise_not_found("Precio")
    delete_row(PRODUCT_PRICES, precio_id)
    write_audit(tabla="product_prices", record_id=precio_id, accion="anular", usuario_id=auth.audit_user_id, datos_anteriores=before)
    return ok(message="Precio desactivado")


# Recorridos
@router.get("/recorridos")
def listar_recorridos(auth: AuthContext = Depends(get_auth_context)):
    ensure_any_permission(auth, "delivery.read", "admin.crud.read")
    rows = list_rows(DELIVERY_ROUTES, limit=500, offset=0)
    return ok(rows)


@router.post("/recorridos")
def crear_recorrido(payload: dict[str, Any], auth: AuthContext = Depends(get_auth_context)):
    ensure_any_permission(auth, "delivery.write", "admin.crud.write")
    row = insert_row(DELIVERY_ROUTES, payload)
    write_audit(tabla="delivery_routes", record_id=row["id"], accion="crear", usuario_id=auth.audit_user_id, datos_nuevos=row)
    return ok(row)


@router.patch("/recorridos/{route_id}")
def actualizar_recorrido(route_id: str, payload: dict[str, Any], auth: AuthContext = Depends(get_auth_context)):
    ensure_any_permission(auth, "delivery.write", "admin.crud.write")
    before = get_row(DELIVERY_ROUTES, route_id)
    if not before:
        raise_not_found("Recorrido")
    row = patch_row(DELIVERY_ROUTES, route_id, payload)
    write_audit(tabla="delivery_routes", record_id=route_id, accion="editar", usuario_id=auth.audit_user_id, datos_anteriores=before, datos_nuevos=row)
    return ok(row)


@router.delete("/recorridos/{route_id}")
def borrar_recorrido(route_id: str, auth: AuthContext = Depends(get_auth_context)):
    ensure_any_permission(auth, "delivery.delete", "admin.crud.delete")
    before = get_row(DELIVERY_ROUTES, route_id)
    if not before:
        raise_not_found("Recorrido")
    delete_row(DELIVERY_ROUTES, route_id)
    write_audit(tabla="delivery_routes", record_id=route_id, accion="anular", usuario_id=auth.audit_user_id, datos_anteriores=before)
    return ok(message="Recorrido desactivado")


@router.get("/recorridos/{route_id}/clientes")
def clientes_del_recorrido(route_id: str, auth: AuthContext = Depends(get_auth_context)):
    ensure_any_permission(auth, "delivery.read", "admin.crud.read")
    rows = fetch_all(
        """
        select rc.*, c.nombre, c.direccion, c.telefono, c.latitud, c.longitud
        from public.delivery_route_customers rc
        join public.customers c on c.id = rc.customer_id
        where rc.route_id = %s
        order by rc.orden asc, c.nombre asc
        """,
        [route_id],
    )
    return ok(rows)


@router.post("/recorridos/{route_id}/clientes")
def agregar_cliente_recorrido(route_id: str, payload: dict[str, Any], auth: AuthContext = Depends(get_auth_context)):
    ensure_any_permission(auth, "delivery.write", "admin.crud.write")
    data = {**payload, "route_id": route_id}
    row = insert_row(DELIVERY_ROUTE_CUSTOMERS, data)
    write_audit(tabla="delivery_route_customers", record_id=row["id"], accion="crear", usuario_id=auth.audit_user_id, datos_nuevos=row)
    return ok(row)


@router.delete("/recorridos/clientes/{route_customer_id}")
def quitar_cliente_recorrido(route_customer_id: str, auth: AuthContext = Depends(get_auth_context)):
    ensure_any_permission(auth, "delivery.write", "admin.crud.write")
    before = get_row(DELIVERY_ROUTE_CUSTOMERS, route_customer_id)
    if not before:
        raise_not_found("Cliente del recorrido")
    delete_row(DELIVERY_ROUTE_CUSTOMERS, route_customer_id, hard=True)
    write_audit(tabla="delivery_route_customers", record_id=route_customer_id, accion="anular", usuario_id=auth.audit_user_id, datos_anteriores=before)
    return ok(message="Cliente quitado del recorrido")


# Repartos diarios
@router.get("/repartos")
def listar_repartos(
    fecha: str | None = None,
    estado: str | None = None,
    driver_id: str | None = None,
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    auth: AuthContext = Depends(get_auth_context),
):
    ensure_any_permission(auth, "delivery.read", "admin.crud.read")
    parts: list[str] = []
    params: list[Any] = []
    if fecha:
        parts.append("dr.fecha = %s"); params.append(fecha)
    if estado:
        parts.append("dr.estado = %s"); params.append(estado)
    if driver_id:
        parts.append("dr.driver_id = %s"); params.append(driver_id)
    where = "where " + " and ".join(parts) if parts else ""
    params.extend([limit, offset])
    rows = fetch_all(
        f"""
        select dr.*, e.nombre as driver_nombre, r.nombre as route_nombre,
          coalesce(s.total_vendido, 0) as total_vendido,
          coalesce(s.total_cobrado, 0) as total_cobrado,
          coalesce(s.total_deuda, 0) as total_deuda
        from public.delivery_runs dr
        left join public.employees e on e.id = dr.driver_id
        left join public.delivery_routes r on r.id = dr.route_id
        left join public.v_delivery_run_summary s on s.delivery_run_id = dr.id
        {where}
        order by dr.fecha desc, dr.created_at desc
        limit %s offset %s
        """,
        params,
    )
    return ok(rows)


@router.get("/repartos/{run_id}")
def obtener_reparto(run_id: str, auth: AuthContext = Depends(get_auth_context)):
    ensure_any_permission(auth, "delivery.read", "admin.crud.read")
    row = fetch_one(
        """
        select dr.*, e.nombre as driver_nombre, r.nombre as route_nombre, s.*
        from public.delivery_runs dr
        left join public.employees e on e.id = dr.driver_id
        left join public.delivery_routes r on r.id = dr.route_id
        left join public.v_delivery_run_summary s on s.delivery_run_id = dr.id
        where dr.id = %s
        """,
        [run_id],
    )
    if not row:
        raise_not_found("Reparto")
    row["stock"] = fetch_all("select * from public.v_delivery_run_stock_summary where delivery_run_id = %s order by producto_nombre", [run_id])
    row["visitas"] = fetch_all("select * from public.v_delivery_visit_totals where delivery_run_id = %s order by arrived_at", [run_id])
    return ok(row)


@router.post("/repartos")
def crear_reparto(payload: dict[str, Any], auth: AuthContext = Depends(get_auth_context)):
    ensure_any_permission(auth, "delivery.write", "admin.crud.write")
    data = dict(payload)
    data.setdefault("fecha", datetime.now(timezone.utc).date().isoformat())
    data.setdefault("estado", "preparado")
    data.setdefault("created_by", auth.audit_user_id)
    stock_items = data.pop("stock", []) or []
    row = insert_row(DELIVERY_RUNS, data)
    for item in stock_items:
        insert_row(DELIVERY_RUN_STOCK, {**item, "delivery_run_id": row["id"]})
    write_audit(tabla="delivery_runs", record_id=row["id"], accion="crear", usuario_id=auth.audit_user_id, datos_nuevos={"run": row, "stock": stock_items})
    return ok(obtener_reparto(row["id"], auth)["data"])


@router.patch("/repartos/{run_id}")
def actualizar_reparto(run_id: str, payload: dict[str, Any], auth: AuthContext = Depends(get_auth_context)):
    ensure_any_permission(auth, "delivery.write", "admin.crud.write")
    before = get_row(DELIVERY_RUNS, run_id)
    if not before:
        raise_not_found("Reparto")
    row = patch_row(DELIVERY_RUNS, run_id, payload)
    write_audit(tabla="delivery_runs", record_id=run_id, accion="editar", usuario_id=auth.audit_user_id, datos_anteriores=before, datos_nuevos=row)
    return ok(row)


@router.post("/repartos/{run_id}/iniciar")
def iniciar_reparto(run_id: str, auth: AuthContext = Depends(get_auth_context)):
    ensure_any_permission(auth, "delivery.write", "admin.crud.write")
    row = patch_row(DELIVERY_RUNS, run_id, {"estado": "en_recorrido", "started_at": _now()})
    if not row:
        raise_not_found("Reparto")
    write_audit(tabla="delivery_runs", record_id=run_id, accion="editar", usuario_id=auth.audit_user_id, datos_nuevos=row, motivo="Inicio de reparto")
    return ok(row)


@router.get("/repartos/{run_id}/stock")
def stock_reparto(run_id: str, auth: AuthContext = Depends(get_auth_context)):
    ensure_any_permission(auth, "delivery.read", "admin.crud.read")
    rows = fetch_all("select * from public.v_delivery_run_stock_summary where delivery_run_id = %s order by producto_nombre", [run_id])
    return ok(rows)


@router.post("/repartos/{run_id}/stock")
def cargar_stock_reparto(run_id: str, payload: dict[str, Any], auth: AuthContext = Depends(get_auth_context)):
    ensure_any_permission(auth, "delivery.write", "admin.crud.write")
    data = {**payload, "delivery_run_id": run_id}
    row = insert_row(DELIVERY_RUN_STOCK, data)
    write_audit(tabla="delivery_run_stock", record_id=row["id"], accion="crear", usuario_id=auth.audit_user_id, datos_nuevos=row)
    return ok(row)


@router.patch("/stock/{stock_id}")
def actualizar_stock_reparto(stock_id: str, payload: dict[str, Any], auth: AuthContext = Depends(get_auth_context)):
    ensure_any_permission(auth, "delivery.write", "admin.crud.write")
    before = get_row(DELIVERY_RUN_STOCK, stock_id)
    if not before:
        raise_not_found("Stock de reparto")
    row = patch_row(DELIVERY_RUN_STOCK, stock_id, payload)
    write_audit(tabla="delivery_run_stock", record_id=stock_id, accion="editar", usuario_id=auth.audit_user_id, datos_anteriores=before, datos_nuevos=row)
    return ok(row)


# Visitas y carga del repartidor
@router.get("/visitas")
def listar_visitas(
    delivery_run_id: str | None = None,
    customer_id: str | None = None,
    estado: str | None = None,
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    auth: AuthContext = Depends(get_auth_context),
):
    ensure_any_permission(auth, "delivery.read", "admin.crud.read")
    parts: list[str] = []
    params: list[Any] = []
    if delivery_run_id:
        parts.append("v.delivery_run_id = %s"); params.append(delivery_run_id)
    if customer_id:
        parts.append("v.customer_id = %s"); params.append(customer_id)
    if estado:
        parts.append("v.estado = %s"); params.append(estado)
    where = "where " + " and ".join(parts) if parts else ""
    params.extend([limit, offset])
    rows = fetch_all(
        f"""
        select v.*, c.nombre as customer_nombre,
          coalesce(t.total_vendido, 0) as total_vendido,
          coalesce(t.total_cobrado, 0) as total_cobrado,
          coalesce(t.total_vendido, 0) - coalesce(t.total_cobrado, 0) as saldo_visita
        from public.delivery_visits v
        join public.customers c on c.id = v.customer_id
        left join public.v_delivery_visit_totals t on t.visit_id = v.id
        {where}
        order by v.arrived_at desc
        limit %s offset %s
        """,
        params,
    )
    return ok(rows)


@router.get("/visitas/{visit_id}")
def obtener_visita(visit_id: str, auth: AuthContext = Depends(get_auth_context)):
    ensure_any_permission(auth, "delivery.read", "admin.crud.read")
    row = fetch_one(
        """
        select v.*, c.nombre as customer_nombre, t.*
        from public.delivery_visits v
        join public.customers c on c.id = v.customer_id
        left join public.v_delivery_visit_totals t on t.visit_id = v.id
        where v.id = %s
        """,
        [visit_id],
    )
    if not row:
        raise_not_found("Visita")
    row["items"] = fetch_all("select i.*, p.nombre as producto_nombre from public.delivery_visit_items i left join public.products p on p.id = i.product_id where visit_id = %s order by i.created_at", [visit_id])
    row["pagos"] = fetch_all("select * from public.payments where visit_id = %s order by created_at", [visit_id])
    row["pan_rallado"] = fetch_all("select * from public.breadcrumb_account_movements where visit_id = %s order by fecha", [visit_id])
    return ok(row)


@router.post("/visitas")
def crear_visita(payload: dict[str, Any], auth: AuthContext = Depends(get_auth_context)):
    ensure_any_permission(auth, "delivery.write", "admin.crud.write")
    data = dict(payload)
    data.setdefault("estado", "abierta")
    if not data.get("visit_number") and data.get("delivery_run_id") and data.get("customer_id"):
        row_count = fetch_one(
            "select count(*)::int as n from public.delivery_visits where delivery_run_id = %s and customer_id = %s",
            [data["delivery_run_id"], data["customer_id"]],
        )
        data["visit_number"] = int(row_count["n"] if row_count else 0) + 1
    row = insert_row(DELIVERY_VISITS, data)
    write_audit(tabla="delivery_visits", record_id=row["id"], accion="crear", usuario_id=auth.audit_user_id, datos_nuevos=row)
    return ok(row)


@router.patch("/visitas/{visit_id}")
def actualizar_visita(visit_id: str, payload: dict[str, Any], auth: AuthContext = Depends(get_auth_context)):
    ensure_any_permission(auth, "delivery.write", "admin.crud.write")
    before = get_row(DELIVERY_VISITS, visit_id)
    if not before:
        raise_not_found("Visita")
    if before.get("locked_at") and not ("*" in auth.permissions):
        raise ValueError("La visita está bloqueada. Hacé un ajuste desde administración.")
    row = patch_row(DELIVERY_VISITS, visit_id, payload)
    write_audit(tabla="delivery_visits", record_id=visit_id, accion="editar", usuario_id=auth.audit_user_id, datos_anteriores=before, datos_nuevos=row)
    return ok(row)


@router.post("/visitas/{visit_id}/items")
def agregar_item_visita(visit_id: str, payload: dict[str, Any], auth: AuthContext = Depends(get_auth_context)):
    ensure_any_permission(auth, "delivery.write", "admin.crud.write")
    visit = get_row(DELIVERY_VISITS, visit_id)
    if not visit:
        raise_not_found("Visita")
    if visit.get("locked_at") and not ("*" in auth.permissions):
        raise ValueError("La visita está bloqueada. Hacé un ajuste desde administración.")
    data = {**payload, "visit_id": visit_id}
    data.setdefault("tipo", "venta")
    if data.get("subtotal") is None:
        data["subtotal"] = float(data.get("cantidad", 0) or 0) * float(data.get("precio_unitario", 0) or 0)
    row = insert_row(DELIVERY_VISIT_ITEMS, data)
    write_audit(tabla="delivery_visit_items", record_id=row["id"], accion="crear", usuario_id=auth.audit_user_id, datos_nuevos=row)
    return ok(row)


@router.patch("/items/{item_id}")
def actualizar_item_visita(item_id: str, payload: dict[str, Any], auth: AuthContext = Depends(get_auth_context)):
    ensure_any_permission(auth, "delivery.write", "admin.crud.write")
    before = get_row(DELIVERY_VISIT_ITEMS, item_id)
    if not before:
        raise_not_found("Item de visita")
    data = dict(payload)
    if "cantidad" in data or "precio_unitario" in data:
        cantidad = float(data.get("cantidad", before.get("cantidad", 0)) or 0)
        precio = float(data.get("precio_unitario", before.get("precio_unitario", 0)) or 0)
        data.setdefault("subtotal", cantidad * precio)
    row = patch_row(DELIVERY_VISIT_ITEMS, item_id, data)
    write_audit(tabla="delivery_visit_items", record_id=item_id, accion="editar", usuario_id=auth.audit_user_id, datos_anteriores=before, datos_nuevos=row)
    return ok(row)


@router.delete("/items/{item_id}")
def borrar_item_visita(item_id: str, auth: AuthContext = Depends(get_auth_context)):
    ensure_any_permission(auth, "delivery.delete", "admin.crud.delete")
    before = get_row(DELIVERY_VISIT_ITEMS, item_id)
    if not before:
        raise_not_found("Item de visita")
    delete_row(DELIVERY_VISIT_ITEMS, item_id, hard=True)
    write_audit(tabla="delivery_visit_items", record_id=item_id, accion="anular", usuario_id=auth.audit_user_id, datos_anteriores=before)
    return ok(message="Item eliminado")


@router.post("/visitas/{visit_id}/pagos")
def agregar_pago_visita(visit_id: str, payload: dict[str, Any], auth: AuthContext = Depends(get_auth_context)):
    ensure_any_permission(auth, "delivery.write", "admin.crud.write")
    visit = get_row(DELIVERY_VISITS, visit_id)
    if not visit:
        raise_not_found("Visita")
    data = {**payload, "visit_id": visit_id, "customer_id": visit["customer_id"], "delivery_run_id": visit["delivery_run_id"]}
    data.setdefault("estado", "confirmado")
    if data.get("estado") == "confirmado" and not data.get("confirmed_at"):
        data["confirmed_at"] = _now()
    row = insert_row(PAYMENTS, data)
    write_audit(tabla="payments", record_id=row["id"], accion="crear", usuario_id=auth.audit_user_id, datos_nuevos=row)
    return ok(row)


@router.patch("/pagos/{payment_id}")
def actualizar_pago(payment_id: str, payload: dict[str, Any], auth: AuthContext = Depends(get_auth_context)):
    ensure_any_permission(auth, "delivery.write", "admin.crud.write")
    before = get_row(PAYMENTS, payment_id)
    if not before:
        raise_not_found("Pago")
    data = dict(payload)
    if data.get("estado") == "confirmado" and not data.get("confirmed_at"):
        data["confirmed_at"] = _now()
    row = patch_row(PAYMENTS, payment_id, data)
    write_audit(tabla="payments", record_id=payment_id, accion="editar", usuario_id=auth.audit_user_id, datos_anteriores=before, datos_nuevos=row)
    return ok(row)


@router.post("/visitas/{visit_id}/pan-rallado")
def cargar_movimiento_pan_rallado(visit_id: str, payload: dict[str, Any], auth: AuthContext = Depends(get_auth_context)):
    ensure_any_permission(auth, "delivery.write", "admin.crud.write")
    visit = get_row(DELIVERY_VISITS, visit_id)
    if not visit:
        raise_not_found("Visita")
    data = {**payload, "visit_id": visit_id, "customer_id": visit["customer_id"], "created_by": auth.audit_user_id}
    row = insert_row(BREADCRUMB_ACCOUNT_MOVEMENTS, data)
    write_audit(tabla="breadcrumb_account_movements", record_id=row["id"], accion="crear", usuario_id=auth.audit_user_id, datos_nuevos=row)
    return ok(row)


@router.post("/visitas/{visit_id}/cerrar")
def cerrar_visita(visit_id: str, auth: AuthContext = Depends(get_auth_context)):
    ensure_any_permission(auth, "delivery.write", "admin.crud.write")
    visit = get_row(DELIVERY_VISITS, visit_id)
    if not visit:
        raise_not_found("Visita")

    totals = _visit_totals(visit_id)
    total_venta = float(totals.get("total_vendido") or 0)
    total_pago = _confirmed_payments_total(visit_id)

    with get_conn() as conn:
        with conn.transaction(), conn.cursor() as cur:
            cur.execute(
                "delete from public.customer_account_movements where reference_type = 'delivery_visit' and reference_id = %s",
                [visit_id],
            )
            if total_venta:
                cur.execute(
                    """
                    insert into public.customer_account_movements
                      (id, customer_id, fecha, tipo, debe, haber, descripcion, reference_type, reference_id, created_by)
                    values (%s, %s, now(), 'venta', %s, 0, %s, 'delivery_visit', %s, %s)
                    """,
                    [new_id("cta"), visit["customer_id"], total_venta, f"Venta visita {visit_id}", visit_id, auth.audit_user_id],
                )
            # Un movimiento por cada pago confirmado para no perder medio/referencia.
            cur.execute(
                """
                select * from public.payments
                where visit_id = %s and estado = 'confirmado'
                """,
                [visit_id],
            )
            for payment in cur.fetchall():
                cur.execute(
                    """
                    insert into public.customer_account_movements
                      (id, customer_id, fecha, tipo, debe, haber, descripcion, reference_type, reference_id, created_by)
                    values (%s, %s, now(), 'pago', 0, %s, %s, 'payment', %s, %s)
                    """,
                    [new_id("cta"), visit["customer_id"], payment["amount"], f"Pago {payment['metodo']} visita {visit_id}", payment["id"], auth.audit_user_id],
                )
            cur.execute(
                """
                update public.delivery_visits
                set estado = 'cerrada', closed_at = coalesce(closed_at, now()), locked_at = coalesce(locked_at, now())
                where id = %s
                returning *
                """,
                [visit_id],
            )
            row = cur.fetchone()

    write_audit(tabla="delivery_visits", record_id=visit_id, accion="editar", usuario_id=auth.audit_user_id, datos_anteriores=visit, datos_nuevos=row, motivo="Cierre de visita")
    return ok({"visit": row, "total_vendido": total_venta, "total_pagado_confirmado": total_pago, "saldo_visita": total_venta - total_pago})


# Cuentas corrientes
@router.get("/clientes/{customer_id}/cuenta")
def cuenta_cliente(customer_id: str, auth: AuthContext = Depends(get_auth_context)):
    ensure_any_permission(auth, "delivery.read", "accounts.read", "admin.crud.read")
    customer = get_row(CUSTOMERS, customer_id)
    if not customer:
        raise_not_found("Cliente")
    movimientos = fetch_all("select * from public.customer_account_movements where customer_id = %s order by fecha desc", [customer_id])
    saldo = fetch_one("select * from public.v_customer_balances where customer_id = %s", [customer_id])
    return ok({"customer": customer, "saldo": saldo, "movimientos": movimientos})


@router.post("/clientes/{customer_id}/cuenta/ajuste")
def ajuste_cuenta_cliente(customer_id: str, payload: dict[str, Any], auth: AuthContext = Depends(get_auth_context)):
    ensure_any_permission(auth, "accounts.write", "admin.crud.write")
    customer = get_row(CUSTOMERS, customer_id)
    if not customer:
        raise_not_found("Cliente")
    data = {**payload, "customer_id": customer_id, "tipo": payload.get("tipo", "ajuste_admin"), "created_by": auth.audit_user_id}
    row = insert_row(CUSTOMER_ACCOUNT_MOVEMENTS, data)
    write_audit(tabla="customer_account_movements", record_id=row["id"], accion="ajustar", usuario_id=auth.audit_user_id, datos_nuevos=row, motivo=payload.get("descripcion"))
    return ok(row)


@router.get("/clientes/{customer_id}/pan-rallado")
def cuenta_pan_rallado(customer_id: str, auth: AuthContext = Depends(get_auth_context)):
    ensure_any_permission(auth, "delivery.read", "accounts.read", "admin.crud.read")
    customer = get_row(CUSTOMERS, customer_id)
    if not customer:
        raise_not_found("Cliente")
    movimientos = fetch_all("select * from public.breadcrumb_account_movements where customer_id = %s order by fecha desc", [customer_id])
    saldo = fetch_one("select * from public.v_breadcrumb_balances where customer_id = %s", [customer_id])
    return ok({"customer": customer, "saldo": saldo, "movimientos": movimientos})


@router.post("/clientes/{customer_id}/pan-rallado/ajuste")
def ajuste_pan_rallado(customer_id: str, payload: dict[str, Any], auth: AuthContext = Depends(get_auth_context)):
    ensure_any_permission(auth, "accounts.write", "admin.crud.write")
    customer = get_row(CUSTOMERS, customer_id)
    if not customer:
        raise_not_found("Cliente")
    data = {**payload, "customer_id": customer_id, "tipo": payload.get("tipo", "ajuste_admin"), "created_by": auth.audit_user_id}
    row = insert_row(BREADCRUMB_ACCOUNT_MOVEMENTS, data)
    write_audit(tabla="breadcrumb_account_movements", record_id=row["id"], accion="ajustar", usuario_id=auth.audit_user_id, datos_nuevos=row, motivo=payload.get("observaciones"))
    return ok(row)


# Cierre del reparto
@router.post("/repartos/{run_id}/cerrar")
def cerrar_reparto(run_id: str, payload: dict[str, Any] | None = None, auth: AuthContext = Depends(get_auth_context)):
    ensure_any_permission(auth, "delivery.close", "delivery.write", "admin.crud.write")
    payload = payload or {}
    run = get_row(DELIVERY_RUNS, run_id)
    if not run:
        raise_not_found("Reparto")

    summary = fetch_one("select * from public.v_delivery_run_summary where delivery_run_id = %s", [run_id]) or {}
    efectivo_real = float(payload.get("efectivo_real", payload.get("efectivoReal", 0)) or 0)
    efectivo_esperado = float(summary.get("efectivo_confirmado", 0) or 0)
    diferencia_efectivo = efectivo_real - efectivo_esperado

    # Actualiza diferencias de stock por producto según lo cargado y lo vendido.
    stock_rows = fetch_all("select * from public.v_delivery_run_stock_summary where delivery_run_id = %s", [run_id])
    diferencia_stock_total = 0.0
    with get_conn() as conn:
        with conn.transaction(), conn.cursor() as cur:
            for stock in stock_rows:
                esperado = float(stock.get("cantidad_esperada") or 0)
                real = float(stock.get("cantidad_devuelta_real") or 0)
                diferencia = real - esperado
                diferencia_stock_total += diferencia
                cur.execute(
                    """
                    update public.delivery_run_stock
                    set cantidad_esperada = %s, diferencia = %s
                    where id = %s
                    """,
                    [esperado, diferencia, stock["id"]],
                )
            cur.execute("delete from public.delivery_run_closures where delivery_run_id = %s", [run_id])
            cur.execute(
                """
                insert into public.delivery_run_closures
                  (id, delivery_run_id, total_vendido, total_cobrado, total_deuda, efectivo_esperado,
                   efectivo_real, diferencia_efectivo, diferencia_stock_total, notes, closed_by, closed_at)
                values (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, now())
                returning *
                """,
                [
                    new_id("cierre"),
                    run_id,
                    summary.get("total_vendido", 0),
                    summary.get("total_cobrado", 0),
                    summary.get("total_deuda", 0),
                    efectivo_esperado,
                    efectivo_real,
                    diferencia_efectivo,
                    diferencia_stock_total,
                    payload.get("notes") or payload.get("notas"),
                    auth.audit_user_id,
                ],
            )
            cierre = cur.fetchone()
            cur.execute("update public.delivery_runs set estado = 'cerrado', closed_at = now() where id = %s", [run_id])

    write_audit(tabla="delivery_runs", record_id=run_id, accion="editar", usuario_id=auth.audit_user_id, datos_anteriores=run, datos_nuevos={"cierre": cierre}, motivo="Cierre de reparto")
    return ok({"cierre": cierre, "summary": summary, "stock": stock_rows})


@router.get("/repartos/{run_id}/resumen")
def resumen_reparto(run_id: str, auth: AuthContext = Depends(get_auth_context)):
    ensure_any_permission(auth, "delivery.read", "admin.crud.read")
    run = obtener_reparto(run_id, auth)["data"]
    cierre = fetch_one("select * from public.delivery_run_closures where delivery_run_id = %s order by closed_at desc limit 1", [run_id])
    return ok({"reparto": run, "cierre": cierre})


@router.get("/reportes/deudas-clientes")
def reporte_deudas_clientes(auth: AuthContext = Depends(get_auth_context)):
    ensure_any_permission(auth, "accounts.read", "delivery.read", "admin.crud.read")
    rows = fetch_all("select * from public.v_customer_balances where saldo <> 0 order by saldo desc")
    return ok(rows)


@router.get("/reportes/pan-rallado-pendiente")
def reporte_pan_rallado(auth: AuthContext = Depends(get_auth_context)):
    ensure_any_permission(auth, "accounts.read", "delivery.read", "admin.crud.read")
    rows = fetch_all("select * from public.v_breadcrumb_balances where kg_pendiente <> 0 order by kg_pendiente desc")
    return ok(rows)
