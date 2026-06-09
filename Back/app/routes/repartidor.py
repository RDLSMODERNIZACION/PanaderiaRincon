from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.core.security import AuthContext, get_auth_context
from app.db import fetch_all, fetch_one, get_conn
from app.repositories.crud import new_id
from app.routes.common import ok

router = APIRouter(prefix="/api/repartidor", tags=["repartidor"])


class VisitItemPayload(BaseModel):
    product_id: str
    cantidad: float = 0
    precio_unitario: float | None = None
    tipo: str = "venta"


class PaymentPayload(BaseModel):
    metodo: str = "efectivo"
    amount: float = 0
    referencia: str | None = None
    comprobante_url: str | None = None


class SaveVisitPayload(BaseModel):
    items: list[VisitItemPayload] = Field(default_factory=list)

    payments: list[PaymentPayload] = Field(default_factory=list)

    metodo: str = "efectivo"
    amount: float = 0
    monto_pagado: float | None = None
    referencia: str | None = None
    comprobante_url: str | None = None

    total_venta: float | None = None

    pan_viejo_kg: float = 0
    observaciones: str | None = None

    latitud: float | None = None
    longitud: float | None = None
    gps_ok: bool = False
    fuera_de_zona_motivo: str | None = None


def _is_admin(auth: AuthContext) -> bool:
    permissions = auth.permissions or set()
    return "*" in permissions or "admin.crud.read" in permissions or "admin.crud.write" in permissions


def _user_row(auth: AuthContext) -> dict[str, Any]:
    if not auth.user_id:
        raise HTTPException(status_code=401, detail="Usuario no identificado.")

    row = fetch_one(
        """
        select
          u.id,
          u.email,
          u.nombre,
          u.employee_id,
          u.role_id,
          u.status,
          e.nombre as employee_nombre,
          e.rol as employee_rol
        from public.app_users u
        left join public.employees e on e.id = u.employee_id
        where u.id = %s
        limit 1
        """,
        [auth.user_id],
    )

    if not row:
        raise HTTPException(status_code=401, detail="Usuario no encontrado.")

    if row.get("status") != "active":
        raise HTTPException(status_code=403, detail="Usuario desactivado.")

    if not row.get("employee_id"):
        employee = fetch_one(
            """
            select id, nombre, rol
            from public.employees
            where lower(nombre) = lower(%s)
            limit 1
            """,
            [row.get("nombre") or ""],
        )

        if employee:
            with get_conn() as conn, conn.cursor() as cur:
                cur.execute(
                    "update public.app_users set employee_id = %s where id = %s",
                    [employee["id"], row["id"]],
                )

            row["employee_id"] = employee["id"]
            row["employee_nombre"] = employee["nombre"]
            row["employee_rol"] = employee["rol"]

    return row


def _run_row_for_user(run_id: str | None, auth: AuthContext) -> dict[str, Any]:
    user = _user_row(auth)
    employee_id = user.get("employee_id")
    admin = _is_admin(auth)

    if not employee_id and not admin:
        raise HTTPException(status_code=403, detail="El usuario no está asociado a un empleado.")

    params: list[Any] = []
    where_parts: list[str] = []

    if run_id:
        where_parts.append("r.id = %s")
        params.append(run_id)

    if not admin:
        where_parts.append("r.driver_id = %s")
        params.append(employee_id)

    if not run_id:
        where_parts.append("r.estado in ('preparado', 'en_recorrido')")

    where_sql = " and ".join(where_parts) if where_parts else "true"

    row = fetch_one(
        f"""
        select
          r.id,
          r.fecha,
          r.driver_id,
          r.route_id,
          r.estado,
          r.started_at,
          r.closed_at,
          r.created_at,
          e.nombre as driver_nombre,
          e.rol as driver_rol,
          dr.nombre as route_nombre
        from public.delivery_runs r
        left join public.employees e on e.id = r.driver_id
        left join public.delivery_routes dr on dr.id = r.route_id
        where {where_sql}
        order by r.fecha desc, r.created_at desc
        limit 1
        """,
        params,
    )

    if not row:
        if run_id:
            raise HTTPException(status_code=404, detail="Reparto no encontrado o no asignado al usuario.")
        raise HTTPException(status_code=404, detail="No hay reparto activo asignado.")

    return row


def _customer_balance(customer_id: str, exclude_visit_id: str | None = None) -> float:
    if exclude_visit_id:
        row = fetch_one(
            """
            select coalesce(sum(debe - haber), 0) as saldo
            from public.customer_account_movements
            where customer_id = %s
              and not (
                reference_type = 'delivery_visit'
                and reference_id = %s
              )
            """,
            [customer_id, exclude_visit_id],
        )
    else:
        row = fetch_one(
            """
            select coalesce(sum(debe - haber), 0) as saldo
            from public.customer_account_movements
            where customer_id = %s
            """,
            [customer_id],
        )

    saldo = float(row["saldo"] or 0) if row else 0
    return max(saldo, 0)


def _base_product_price(product_id: str, customer_id: str) -> float:
    row = fetch_one(
        """
        select precio
        from public.product_prices
        where product_id = %s
          and activo = true
          and (customer_id = %s or customer_id is null)
          and fecha_desde <= current_date
          and (fecha_hasta is null or fecha_hasta >= current_date)
        order by
          case when customer_id = %s then 0 else 1 end,
          fecha_desde desc
        limit 1
        """,
        [product_id, customer_id, customer_id],
    )

    if row:
        try:
            return float(row["precio"] or 0)
        except Exception:
            return 0

    product = fetch_one(
        """
        select precio_venta
        from public.products
        where id = %s
        limit 1
        """,
        [product_id],
    )

    if product:
        try:
            return float(product["precio_venta"] or 0)
        except Exception:
            return 0

    return 0


def _product_pricing(product_id: str, customer_id: str, cantidad: float) -> dict[str, Any]:
    cantidad = float(cantidad or 0)
    base_price = _base_product_price(product_id, customer_id)

    if cantidad <= 0:
        return {
            "precio_unitario": base_price,
            "subtotal": 0.0,
            "discount_rule_id": None,
            "discount_name": None,
        }

    base_subtotal = cantidad * base_price

    rules = fetch_all(
        """
        select *
        from public.product_discount_rules
        where product_id = %s
          and activo = true
          and (customer_id = %s or customer_id is null)
          and fecha_desde <= current_date
          and (fecha_hasta is null or fecha_hasta >= current_date)
        order by
          case when customer_id = %s then 0 else 1 end,
          prioridad asc,
          created_at asc
        """,
        [product_id, customer_id, customer_id],
    )

    best_subtotal = base_subtotal
    best_rule_id = None
    best_rule_name = None

    for rule in rules:
        tipo = rule.get("tipo")
        candidate = None

        if tipo == "pack":
            pack_qty = float(rule.get("pack_cantidad") or 0)
            pack_price = float(rule.get("pack_precio") or 0)

            if pack_qty > 0 and pack_price > 0:
                packs = int(cantidad // pack_qty)
                remainder = cantidad - (packs * pack_qty)
                candidate = (packs * pack_price) + (remainder * base_price)

        elif tipo == "precio_por_cantidad":
            min_qty = float(rule.get("min_cantidad") or 0)
            unit_price = float(rule.get("precio_unitario") or 0)

            if cantidad >= min_qty and unit_price > 0:
                candidate = cantidad * unit_price

        if candidate is not None and candidate < best_subtotal:
            best_subtotal = candidate
            best_rule_id = rule.get("id")
            best_rule_name = rule.get("nombre")

    effective_unit = best_subtotal / cantidad if cantidad > 0 else base_price

    return {
        "precio_unitario": effective_unit,
        "subtotal": best_subtotal,
        "discount_rule_id": best_rule_id,
        "discount_name": best_rule_name,
    }


def _payment_method_for_db(method: str) -> str:
    method = (method or "efectivo").strip().lower()

    allowed = {
        "efectivo",
        "transferencia",
        "mercado_pago",
        "qr",
        "otro",
    }

    if method in allowed:
        return method

    if method in {"mercadopago", "mp"}:
        return "mercado_pago"

    return "otro"


def _payment_rows_from_payload(payload: SaveVisitPayload) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []

    if payload.payments:
        for payment in payload.payments:
            amount = float(payment.amount or 0)

            if amount < 0:
                raise HTTPException(status_code=400, detail="El monto de un pago no puede ser negativo.")

            if amount <= 0:
                continue

            rows.append(
                {
                    "metodo": _payment_method_for_db(payment.metodo),
                    "amount": amount,
                    "referencia": payment.referencia,
                    "comprobante_url": payment.comprobante_url,
                }
            )

        return rows

    amount = payload.monto_pagado if payload.monto_pagado is not None else payload.amount
    amount = float(amount or 0)

    if amount < 0:
        raise HTTPException(status_code=400, detail="El monto pagado no puede ser negativo.")

    if amount > 0:
        rows.append(
            {
                "metodo": _payment_method_for_db(payload.metodo),
                "amount": amount,
                "referencia": payload.referencia,
                "comprobante_url": payload.comprobante_url,
            }
        )

    return rows


def _visit_status(row: dict[str, Any] | None) -> str:
    if not row:
        return "pendiente"

    if row.get("estado") == "cerrada":
        return "visitado"

    if row.get("estado") == "abierta":
        return "abierta"

    return str(row.get("estado") or "pendiente")


def _latest_visits_by_customer(run_id: str) -> dict[str, dict[str, Any]]:
    visits = fetch_all(
        """
        select
          v.id,
          v.delivery_run_id,
          v.customer_id,
          v.visit_number,
          v.arrived_at,
          v.closed_at,
          v.estado,
          v.observaciones,
          coalesce((
            select sum(i.subtotal)
            from public.delivery_visit_items i
            where i.visit_id = v.id
              and i.tipo = 'venta'
          ), 0) as total_vendido,
          coalesce((
            select sum(p.amount)
            from public.payments p
            where p.visit_id = v.id
              and p.estado = 'confirmado'
          ), 0) as total_cobrado,
          greatest(coalesce((
            select sum(m.debe - m.haber)
            from public.customer_account_movements m
            where m.reference_type = 'delivery_visit'
              and m.reference_id = v.id
          ), 0), 0) as deuda,
          coalesce((
            select sum(b.kg_entrada)
            from public.breadcrumb_account_movements b
            where b.visit_id = v.id
              and b.tipo = 'pan_viejo_recibido'
          ), 0) as pan_viejo_kg
        from public.delivery_visits v
        where v.delivery_run_id = %s
          and v.estado <> 'anulada'
        order by v.arrived_at desc
        """,
        [run_id],
    )

    result: dict[str, dict[str, Any]] = {}

    for visit in visits:
        customer_id = str(visit["customer_id"])
        if customer_id not in result:
            result[customer_id] = visit

    return result


def _stock_for_run(run_id: str) -> list[dict[str, Any]]:
    rows = fetch_all(
        """
        select
          s.id,
          s.delivery_run_id,
          s.product_id,
          s.cantidad_cargada,
          s.cantidad_devuelta_real,
          s.cantidad_esperada,
          s.diferencia,
          p.nombre as product_nombre,
          p.categoria as product_categoria,
          p.unidad_venta as unidad_venta,
          p.precio_venta as precio_venta,
          coalesce((
            select sum(i.cantidad)
            from public.delivery_visit_items i
            join public.delivery_visits v on v.id = i.visit_id
            where v.delivery_run_id = s.delivery_run_id
              and i.product_id = s.product_id
              and i.tipo = 'venta'
              and v.estado <> 'anulada'
          ), 0) as cantidad_entregada
        from public.delivery_run_stock s
        join public.products p on p.id = s.product_id
        where s.delivery_run_id = %s
        order by p.nombre asc
        """,
        [run_id],
    )

    result: list[dict[str, Any]] = []

    for row in rows:
        cargada = float(row.get("cantidad_cargada") or 0)
        entregada = float(row.get("cantidad_entregada") or 0)

        result.append(
            {
                "id": row["id"],
                "delivery_run_id": row["delivery_run_id"],
                "product_id": row["product_id"],
                "product_nombre": row["product_nombre"],
                "product_categoria": row["product_categoria"],
                "unidad_venta": row["unidad_venta"],
                "precio_venta": float(row.get("precio_venta") or 0),
                "cantidad_cargada": cargada,
                "cantidad_entregada": entregada,
                "cantidad_restante": cargada - entregada,
            }
        )

    return result


def _stock_availability_for_run(run_id: str, exclude_visit_id: str | None = None) -> dict[str, dict[str, Any]]:
    if exclude_visit_id:
        rows = fetch_all(
            """
            select
              s.product_id,
              s.cantidad_cargada,
              p.nombre as product_nombre,
              coalesce((
                select sum(i.cantidad)
                from public.delivery_visit_items i
                join public.delivery_visits v on v.id = i.visit_id
                where v.delivery_run_id = s.delivery_run_id
                  and i.product_id = s.product_id
                  and i.tipo = 'venta'
                  and v.estado <> 'anulada'
                  and v.id <> %s
              ), 0) as cantidad_entregada
            from public.delivery_run_stock s
            join public.products p on p.id = s.product_id
            where s.delivery_run_id = %s
            """,
            [exclude_visit_id, run_id],
        )
    else:
        rows = fetch_all(
            """
            select
              s.product_id,
              s.cantidad_cargada,
              p.nombre as product_nombre,
              coalesce((
                select sum(i.cantidad)
                from public.delivery_visit_items i
                join public.delivery_visits v on v.id = i.visit_id
                where v.delivery_run_id = s.delivery_run_id
                  and i.product_id = s.product_id
                  and i.tipo = 'venta'
                  and v.estado <> 'anulada'
              ), 0) as cantidad_entregada
            from public.delivery_run_stock s
            join public.products p on p.id = s.product_id
            where s.delivery_run_id = %s
            """,
            [run_id],
        )

    result: dict[str, dict[str, Any]] = {}

    for row in rows:
        cargada = float(row.get("cantidad_cargada") or 0)
        entregada = float(row.get("cantidad_entregada") or 0)

        result[str(row["product_id"])] = {
            "product_id": row["product_id"],
            "product_nombre": row.get("product_nombre"),
            "cantidad_cargada": cargada,
            "cantidad_entregada": entregada,
            "cantidad_restante": cargada - entregada,
        }

    return result


def _customers_for_run(run: dict[str, Any]) -> list[dict[str, Any]]:
    route_id = run.get("route_id")
    run_id = run["id"]

    if not route_id:
        return []

    links = fetch_all(
        """
        select
          rc.id as route_customer_id,
          rc.route_id,
          rc.customer_id,
          rc.orden,
          c.nombre,
          c.direccion,
          c.telefono,
          c.latitud,
          c.longitud,
          c.observaciones,
          c.activo
        from public.delivery_route_customers rc
        join public.customers c on c.id = rc.customer_id
        where rc.route_id = %s
          and c.activo = true
        order by rc.orden asc, c.nombre asc
        """,
        [route_id],
    )

    visits = _latest_visits_by_customer(run_id)

    result: list[dict[str, Any]] = []

    for row in links:
        customer_id = str(row["customer_id"])
        visit = visits.get(customer_id)

        result.append(
            {
                "route_customer_id": row["route_customer_id"],
                "customer_id": row["customer_id"],
                "orden": row["orden"],
                "nombre": row["nombre"],
                "direccion": row["direccion"],
                "telefono": row["telefono"],
                "latitud": row["latitud"],
                "longitud": row["longitud"],
                "observaciones": row["observaciones"],
                "deuda_actual": _customer_balance(customer_id),
                "estado_visita": _visit_status(visit),
                "visit": visit,
            }
        )

    return result


def _run_detail(run: dict[str, Any], auth: AuthContext) -> dict[str, Any]:
    user = _user_row(auth)
    stock = _stock_for_run(run["id"])
    customers = _customers_for_run(run)

    return {
        "user": {
            "user_id": user.get("id"),
            "nombre": user.get("nombre"),
            "employee_id": user.get("employee_id"),
            "employee_nombre": user.get("employee_nombre"),
            "employee_rol": user.get("employee_rol"),
        },
        "run": {
            "id": run["id"],
            "fecha": run["fecha"],
            "driver_id": run["driver_id"],
            "driver_nombre": run.get("driver_nombre"),
            "route_id": run["route_id"],
            "route_nombre": run.get("route_nombre"),
            "estado": run["estado"],
            "started_at": run.get("started_at"),
            "closed_at": run.get("closed_at"),
            "created_at": run.get("created_at"),
        },
        "stock": stock,
        "customers": customers,
        "summary": {
            "productos_cargados": len([x for x in stock if float(x.get("cantidad_cargada") or 0) > 0]),
            "clientes_total": len(customers),
            "clientes_visitados": len([x for x in customers if x.get("estado_visita") == "visitado"]),
            "clientes_pendientes": len([x for x in customers if x.get("estado_visita") != "visitado"]),
        },
    }


@router.get("/mi-reparto")
def mi_reparto(auth: AuthContext = Depends(get_auth_context)):
    run = _run_row_for_user(None, auth)
    return ok(_run_detail(run, auth))


@router.get("/mi-reparto/{run_id}")
def detalle_reparto(run_id: str, auth: AuthContext = Depends(get_auth_context)):
    run = _run_row_for_user(run_id, auth)
    return ok(_run_detail(run, auth))


@router.get("/mis-repartos")
def mis_repartos(include_closed: bool = False, auth: AuthContext = Depends(get_auth_context)):
    user = _user_row(auth)
    employee_id = user.get("employee_id")
    admin = _is_admin(auth)

    params: list[Any] = []
    where_parts: list[str] = []

    if not admin:
        if not employee_id:
            raise HTTPException(status_code=403, detail="El usuario no está asociado a un empleado.")
        where_parts.append("r.driver_id = %s")
        params.append(employee_id)

    if not include_closed:
        where_parts.append("r.estado in ('preparado', 'en_recorrido')")

    where_sql = " and ".join(where_parts) if where_parts else "true"

    rows = fetch_all(
        f"""
        select
          r.id,
          r.fecha,
          r.driver_id,
          r.route_id,
          r.estado,
          r.started_at,
          r.closed_at,
          r.created_at,
          e.nombre as driver_nombre,
          dr.nombre as route_nombre
        from public.delivery_runs r
        left join public.employees e on e.id = r.driver_id
        left join public.delivery_routes dr on dr.id = r.route_id
        where {where_sql}
        order by r.fecha desc, r.created_at desc
        limit 50
        """,
        params,
    )

    return ok(rows)


@router.post("/mi-reparto/{run_id}/iniciar")
def iniciar_reparto(run_id: str, auth: AuthContext = Depends(get_auth_context)):
    run = _run_row_for_user(run_id, auth)

    if run["estado"] == "cerrado":
        raise HTTPException(status_code=400, detail="El reparto ya está cerrado.")

    with get_conn() as conn, conn.cursor() as cur:
        cur.execute(
            """
            update public.delivery_runs
            set estado = 'en_recorrido',
                started_at = coalesce(started_at, now())
            where id = %s
            returning *
            """,
            [run_id],
        )
        updated = cur.fetchone()

    return ok(updated)


@router.post("/mi-reparto/{run_id}/finalizar")
def finalizar_reparto(run_id: str, auth: AuthContext = Depends(get_auth_context)):
    run = _run_row_for_user(run_id, auth)

    if run["estado"] == "cerrado":
        raise HTTPException(status_code=400, detail="El reparto ya está cerrado.")

    if run["estado"] != "en_recorrido":
        raise HTTPException(status_code=400, detail="Solo se puede finalizar un reparto iniciado.")

    with get_conn() as conn, conn.cursor() as cur:
        cur.execute(
            """
            update public.delivery_runs
            set estado = 'cerrado',
                closed_at = coalesce(closed_at, now())
            where id = %s
            returning *
            """,
            [run_id],
        )
        updated = cur.fetchone()

    return ok(updated)


@router.post("/mi-reparto/{run_id}/clientes/{customer_id}/visita")
def guardar_visita(
    run_id: str,
    customer_id: str,
    payload: SaveVisitPayload,
    auth: AuthContext = Depends(get_auth_context),
):
    run = _run_row_for_user(run_id, auth)

    if run["estado"] == "cerrado":
        raise HTTPException(status_code=400, detail="El reparto ya está cerrado.")

    if run["estado"] != "en_recorrido":
        raise HTTPException(status_code=400, detail="Primero tenés que iniciar el reparto.")

    customer = fetch_one(
        """
        select c.*
        from public.customers c
        join public.delivery_route_customers rc on rc.customer_id = c.id
        where c.id = %s
          and rc.route_id = %s
        limit 1
        """,
        [customer_id, run["route_id"]],
    )

    if not customer:
        raise HTTPException(status_code=404, detail="Cliente no pertenece al recorrido.")

    existing_visit = fetch_one(
        """
        select *
        from public.delivery_visits
        where delivery_run_id = %s
          and customer_id = %s
          and estado <> 'anulada'
        order by arrived_at desc
        limit 1
        """,
        [run_id, customer_id],
    )

    existing_visit_id = existing_visit["id"] if existing_visit else None

    clean_items = [
        item for item in payload.items
        if item.product_id and float(item.cantidad or 0) > 0
    ]

    stock_available = _stock_availability_for_run(run_id, exclude_visit_id=existing_visit_id)

    requested_by_product: dict[str, float] = {}

    for item in clean_items:
        product_id = item.product_id
        cantidad = float(item.cantidad or 0)

        if cantidad <= 0:
            continue

        requested_by_product[product_id] = requested_by_product.get(product_id, 0) + cantidad

    for product_id, cantidad in requested_by_product.items():
        stock_row = stock_available.get(product_id)

        if not stock_row:
            raise HTTPException(
                status_code=400,
                detail=f"El producto {product_id} no está cargado en la mercadería del reparto.",
            )

        restante = float(stock_row.get("cantidad_restante") or 0)
        product_nombre = stock_row.get("product_nombre") or product_id

        if cantidad > restante + 0.0001:
            raise HTTPException(
                status_code=400,
                detail=f"No hay suficiente stock de {product_nombre}. Disponible: {restante}. Intentaste dejar: {cantidad}.",
            )

    computed_total = 0.0
    prepared_items: list[dict[str, Any]] = []

    for item in clean_items:
        cantidad = float(item.cantidad or 0)

        if cantidad <= 0:
            continue

        tipo = item.tipo or "venta"

        if tipo not in {"venta", "devolucion", "bonificacion", "ajuste"}:
            tipo = "venta"

        pricing = _product_pricing(item.product_id, customer_id, cantidad)

        precio_unitario = float(pricing["precio_unitario"] or 0)
        subtotal = float(pricing["subtotal"] or 0)

        if tipo == "venta":
            computed_total += subtotal

        prepared_items.append(
            {
                "product_id": item.product_id,
                "tipo": tipo,
                "cantidad": cantidad,
                "precio_unitario": precio_unitario,
                "subtotal": subtotal,
                "discount_rule_id": pricing.get("discount_rule_id"),
                "discount_name": pricing.get("discount_name"),
            }
        )

    total_venta = computed_total

    deuda_anterior = _customer_balance(customer_id, exclude_visit_id=existing_visit_id)
    total_a_cobrar = deuda_anterior + total_venta

    prepared_payments = _payment_rows_from_payload(payload)
    total_pagado = sum(float(payment["amount"] or 0) for payment in prepared_payments)

    if total_pagado > total_a_cobrar + 0.0001:
        raise HTTPException(
            status_code=400,
            detail=(
                f"El pago supera la deuda total del comercio. "
                f"Total a cobrar: {total_a_cobrar}. Pagó: {total_pagado}."
            ),
        )

    saldo_pendiente = max(total_a_cobrar - total_pagado, 0)

    with get_conn() as conn, conn.cursor() as cur:
        if existing_visit:
            visit_id = existing_visit["id"]

            cur.execute("delete from public.delivery_visit_items where visit_id = %s", [visit_id])
            cur.execute("delete from public.payments where visit_id = %s", [visit_id])
            cur.execute("delete from public.breadcrumb_account_movements where visit_id = %s", [visit_id])
            cur.execute(
                """
                delete from public.customer_account_movements
                where reference_type = 'delivery_visit'
                  and reference_id = %s
                """,
                [visit_id],
            )

            cur.execute(
                """
                update public.delivery_visits
                set estado = 'cerrada',
                    closed_at = now(),
                    latitud = %s,
                    longitud = %s,
                    gps_ok = %s,
                    fuera_de_zona_motivo = %s,
                    observaciones = %s
                where id = %s
                returning *
                """,
                [
                    payload.latitud,
                    payload.longitud,
                    payload.gps_ok,
                    payload.fuera_de_zona_motivo,
                    payload.observaciones,
                    visit_id,
                ],
            )
            visit = cur.fetchone()
        else:
            count_row = fetch_one(
                """
                select count(*) as total
                from public.delivery_visits
                where delivery_run_id = %s
                  and customer_id = %s
                """,
                [run_id, customer_id],
            )

            visit_number = int(count_row["total"] or 0) + 1
            visit_id = new_id("vis")

            cur.execute(
                """
                insert into public.delivery_visits (
                  id,
                  delivery_run_id,
                  customer_id,
                  visit_number,
                  arrived_at,
                  closed_at,
                  estado,
                  latitud,
                  longitud,
                  gps_ok,
                  fuera_de_zona_motivo,
                  observaciones
                )
                values (%s, %s, %s, %s, now(), now(), 'cerrada', %s, %s, %s, %s, %s)
                returning *
                """,
                [
                    visit_id,
                    run_id,
                    customer_id,
                    visit_number,
                    payload.latitud,
                    payload.longitud,
                    payload.gps_ok,
                    payload.fuera_de_zona_motivo,
                    payload.observaciones,
                ],
            )
            visit = cur.fetchone()

        for item in prepared_items:
            cur.execute(
                """
                insert into public.delivery_visit_items (
                  id,
                  visit_id,
                  product_id,
                  tipo,
                  cantidad,
                  precio_unitario,
                  subtotal
                )
                values (%s, %s, %s, %s, %s, %s, %s)
                """,
                [
                    new_id("vitem"),
                    visit_id,
                    item["product_id"],
                    item["tipo"],
                    item["cantidad"],
                    item["precio_unitario"],
                    item["subtotal"],
                ],
            )

        for payment in prepared_payments:
            cur.execute(
                """
                insert into public.payments (
                  id,
                  visit_id,
                  customer_id,
                  delivery_run_id,
                  metodo,
                  estado,
                  amount,
                  referencia,
                  comprobante_url
                )
                values (%s, %s, %s, %s, %s, 'confirmado', %s, %s, %s)
                """,
                [
                    new_id("pay"),
                    visit_id,
                    customer_id,
                    run_id,
                    payment["metodo"],
                    payment["amount"],
                    payment["referencia"],
                    payment["comprobante_url"],
                ],
            )

        if total_venta > 0:
            cur.execute(
                """
                insert into public.customer_account_movements (
                  id,
                  customer_id,
                  fecha,
                  tipo,
                  debe,
                  haber,
                  descripcion,
                  reference_type,
                  reference_id
                )
                values (%s, %s, now(), 'venta', %s, 0, %s, 'delivery_visit', %s)
                """,
                [
                    new_id("cta"),
                    customer_id,
                    total_venta,
                    f"Venta generada por visita de reparto {run_id}",
                    visit_id,
                ],
            )

        if total_pagado > 0:
            cur.execute(
                """
                insert into public.customer_account_movements (
                  id,
                  customer_id,
                  fecha,
                  tipo,
                  debe,
                  haber,
                  descripcion,
                  reference_type,
                  reference_id
                )
                values (%s, %s, now(), 'pago', 0, %s, %s, 'delivery_visit', %s)
                """,
                [
                    new_id("cta"),
                    customer_id,
                    total_pagado,
                    f"Pago recibido en visita de reparto {run_id}",
                    visit_id,
                ],
            )

        pan_viejo_kg = float(payload.pan_viejo_kg or 0)

        if pan_viejo_kg > 0:
            cur.execute(
                """
                insert into public.breadcrumb_account_movements (
                  id,
                  customer_id,
                  fecha,
                  visit_id,
                  tipo,
                  kg_entrada,
                  kg_salida,
                  observaciones
                )
                values (%s, %s, now(), %s, 'pan_viejo_recibido', %s, 0, %s)
                """,
                [
                    new_id("panr"),
                    customer_id,
                    visit_id,
                    pan_viejo_kg,
                    payload.observaciones,
                ],
            )

    return ok(
        {
            "visit": visit,
            "totals": {
                "deuda_anterior": deuda_anterior,
                "total_venta": total_venta,
                "total_a_cobrar": total_a_cobrar,
                "total_cobrado": total_pagado,
                "deuda": saldo_pendiente,
                "saldo_pendiente": saldo_pendiente,
                "pan_viejo_kg": float(payload.pan_viejo_kg or 0),
            },
            "payments": prepared_payments,
            "items": prepared_items,
            "run_detail": _run_detail(run, auth),
        }
    )