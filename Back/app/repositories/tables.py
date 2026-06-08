from __future__ import annotations

from app.repositories.crud import TableConfig

PRODUCTS = TableConfig(
    table="products",
    id_prefix="prod",
    label="Productos",
    allowed_create=("id", "nombre", "categoria", "unidad_venta", "precio_venta", "costo_unitario", "activo", "receta_id"),
    allowed_patch=("nombre", "categoria", "unidad_venta", "precio_venta", "costo_unitario", "activo", "receta_id"),
    soft_delete_column="activo",
    search_columns=("id", "nombre", "categoria"),
    default_order_by="nombre",
    default_desc=False,
)

SUPPLIES = TableConfig(
    table="supplies",
    id_prefix="ins",
    label="Insumos",
    allowed_create=("id", "nombre", "unidad", "proveedor", "costo_unitario", "stock_actual", "stock_minimo"),
    allowed_patch=("nombre", "unidad", "proveedor", "costo_unitario", "stock_actual", "stock_minimo"),
    search_columns=("id", "nombre", "proveedor"),
    default_order_by="nombre",
    default_desc=False,
)

PRODUCTION_BATCHES = TableConfig(
    table="production_batches",
    id_prefix="lote",
    label="Producción",
    allowed_create=("id", "fecha", "turno", "product_id", "planificado", "producido", "merma", "nota"),
    allowed_patch=("fecha", "turno", "product_id", "planificado", "producido", "merma", "nota"),
    search_columns=("id", "turno", "nota"),
    default_order_by="fecha",
)

INVENTORY_MOVEMENTS = TableConfig(
    table="inventory_movements",
    id_prefix="mov",
    label="Movimientos de inventario",
    allowed_create=("id", "fecha", "supply_id", "tipo", "cantidad", "motivo", "referencia"),
    allowed_patch=("fecha", "supply_id", "tipo", "cantidad", "motivo", "referencia"),
    search_columns=("id", "tipo", "motivo", "referencia"),
    default_order_by="fecha",
)

EMPLOYEES = TableConfig(
    table="employees",
    id_prefix="emp",
    label="Personal",
    allowed_create=("id", "nombre", "rol", "costo_hora", "activo"),
    allowed_patch=("nombre", "rol", "costo_hora", "activo"),
    soft_delete_column="activo",
    search_columns=("id", "nombre", "rol"),
    default_order_by="nombre",
    default_desc=False,
)

EMPLOYEE_SHIFTS = TableConfig(
    table="employee_shifts",
    id_prefix="turno",
    label="Turnos de personal",
    allowed_create=("id", "fecha", "employee_id", "horas"),
    allowed_patch=("fecha", "employee_id", "horas"),
    default_order_by="fecha",
)

ENERGY_RECORDS = TableConfig(
    table="energy_records",
    id_prefix="en",
    label="Registros de energía",
    allowed_create=("id", "fecha", "horno", "kwh", "costo"),
    allowed_patch=("fecha", "horno", "kwh", "costo"),
    search_columns=("id", "horno"),
    default_order_by="fecha",
)

BUSINESS_SETTINGS = TableConfig(
    table="business_settings",
    id_prefix="cfg",
    label="Configuración del negocio",
    allowed_create=("id", "nombre", "moneda", "alertas", "merma_max"),
    allowed_patch=("nombre", "moneda", "alertas", "merma_max"),
    search_columns=("id", "nombre"),
)

TICKETS = TableConfig(
    table="tickets",
    id_prefix="ticket",
    label="Tickets",
    allowed_create=("id", "fecha", "canal", "medio_pago", "descuento", "total"),
    allowed_patch=("fecha", "canal", "medio_pago", "descuento", "total"),
    search_columns=("id", "canal", "medio_pago"),
    default_order_by="fecha",
)

TICKET_ITEMS = TableConfig(
    table="ticket_items",
    id_prefix="ti",
    label="Items de tickets",
    allowed_create=("id", "ticket_id", "product_id", "cantidad", "precio_unitario"),
    allowed_patch=("ticket_id", "product_id", "cantidad", "precio_unitario"),
)

RECIPES = TableConfig(
    table="recipes",
    id_prefix="receta",
    label="Recetas",
    allowed_create=("id", "product_id", "rinde_unidades"),
    allowed_patch=("product_id", "rinde_unidades"),
)

RECIPE_ITEMS = TableConfig(
    table="recipe_items",
    id_prefix="ri",
    label="Ingredientes de receta",
    allowed_create=("id", "recipe_id", "supply_id", "cantidad", "unidad"),
    allowed_patch=("recipe_id", "supply_id", "cantidad", "unidad"),
)

INTEGRATION_CONNECTIONS = TableConfig(
    table="integration_connections",
    id_prefix="int",
    label="Conexiones externas",
    allowed_create=("id", "nombre", "tipo", "estado", "config", "ultimo_evento"),
    allowed_patch=("nombre", "tipo", "estado", "config", "ultimo_evento"),
    search_columns=("id", "nombre", "tipo", "estado"),
)

# Seguridad / roles
APP_ROLES = TableConfig(
    table="app_roles",
    id_prefix="role",
    label="Roles",
    allowed_create=("id", "nombre", "descripcion", "activo"),
    allowed_patch=("nombre", "descripcion", "activo"),
    soft_delete_column="activo",
    search_columns=("id", "nombre", "descripcion"),
    default_order_by="nombre",
    default_desc=False,
)

APP_PERMISSIONS = TableConfig(
    table="app_permissions",
    id_prefix="perm",
    label="Permisos",
    allowed_create=("id", "clave", "descripcion", "modulo"),
    allowed_patch=("clave", "descripcion", "modulo"),
    search_columns=("clave", "descripcion", "modulo"),
    default_order_by="clave",
    default_desc=False,
)

APP_ROLE_PERMISSIONS = TableConfig(
    table="app_role_permissions",
    id_prefix="rp",
    label="Permisos por rol",
    allowed_create=("id", "role_id", "permission_id"),
    allowed_patch=("role_id", "permission_id"),
)

APP_USERS = TableConfig(
    table="app_users",
    id_prefix="usr",
    label="Usuarios",
    allowed_create=("id", "email", "nombre", "role_id", "employee_id", "status", "pin_hash", "last_login_at"),
    allowed_patch=("email", "nombre", "role_id", "employee_id", "status", "pin_hash", "last_login_at"),
    soft_delete_column=None,
    search_columns=("id", "email", "nombre", "status"),
    default_order_by="nombre",
    default_desc=False,
)

# Reparto y control de rendición
CUSTOMERS = TableConfig(
    table="customers",
    id_prefix="cli",
    label="Clientes / comercios",
    allowed_create=("id", "nombre", "direccion", "telefono", "latitud", "longitud", "activo", "observaciones"),
    allowed_patch=("nombre", "direccion", "telefono", "latitud", "longitud", "activo", "observaciones"),
    soft_delete_column="activo",
    search_columns=("id", "nombre", "direccion", "telefono"),
    default_order_by="nombre",
    default_desc=False,
)

PRODUCT_PRICES = TableConfig(
    table="product_prices",
    id_prefix="precio",
    label="Precios por producto",
    allowed_create=("id", "product_id", "customer_id", "precio", "fecha_desde", "fecha_hasta", "activo"),
    allowed_patch=("product_id", "customer_id", "precio", "fecha_desde", "fecha_hasta", "activo"),
    soft_delete_column="activo",
    search_columns=("id", "product_id", "customer_id"),
    default_order_by="fecha_desde",
)

DELIVERY_ROUTES = TableConfig(
    table="delivery_routes",
    id_prefix="ruta",
    label="Recorridos",
    allowed_create=("id", "nombre", "activo"),
    allowed_patch=("nombre", "activo"),
    soft_delete_column="activo",
    search_columns=("id", "nombre"),
    default_order_by="nombre",
    default_desc=False,
)

DELIVERY_ROUTE_CUSTOMERS = TableConfig(
    table="delivery_route_customers",
    id_prefix="rc",
    label="Clientes por recorrido",
    allowed_create=("id", "route_id", "customer_id", "orden"),
    allowed_patch=("route_id", "customer_id", "orden"),
    default_order_by="orden",
    default_desc=False,
)

DELIVERY_RUNS = TableConfig(
    table="delivery_runs",
    id_prefix="rep",
    label="Repartos diarios",
    allowed_create=("id", "fecha", "driver_id", "route_id", "estado", "started_at", "closed_at", "created_by"),
    allowed_patch=("fecha", "driver_id", "route_id", "estado", "started_at", "closed_at", "created_by"),
    search_columns=("id", "estado", "driver_id"),
    default_order_by="fecha",
)

DELIVERY_RUN_STOCK = TableConfig(
    table="delivery_run_stock",
    id_prefix="rst",
    label="Stock del reparto",
    allowed_create=("id", "delivery_run_id", "product_id", "cantidad_cargada", "cantidad_devuelta_real", "cantidad_esperada", "diferencia"),
    allowed_patch=("delivery_run_id", "product_id", "cantidad_cargada", "cantidad_devuelta_real", "cantidad_esperada", "diferencia"),
)

DELIVERY_VISITS = TableConfig(
    table="delivery_visits",
    id_prefix="vis",
    label="Visitas del reparto",
    allowed_create=("id", "delivery_run_id", "customer_id", "visit_number", "arrived_at", "closed_at", "estado", "latitud", "longitud", "gps_ok", "fuera_de_zona_motivo", "locked_at", "observaciones"),
    allowed_patch=("delivery_run_id", "customer_id", "visit_number", "arrived_at", "closed_at", "estado", "latitud", "longitud", "gps_ok", "fuera_de_zona_motivo", "locked_at", "observaciones"),
    search_columns=("id", "customer_id", "estado", "observaciones"),
    default_order_by="arrived_at",
)

DELIVERY_VISIT_ITEMS = TableConfig(
    table="delivery_visit_items",
    id_prefix="vitem",
    label="Items de visita",
    allowed_create=("id", "visit_id", "product_id", "tipo", "cantidad", "precio_unitario", "subtotal"),
    allowed_patch=("visit_id", "product_id", "tipo", "cantidad", "precio_unitario", "subtotal"),
)

PAYMENTS = TableConfig(
    table="payments",
    id_prefix="pay",
    label="Pagos",
    allowed_create=("id", "visit_id", "customer_id", "delivery_run_id", "metodo", "estado", "amount", "referencia", "comprobante_url", "confirmed_at"),
    allowed_patch=("visit_id", "customer_id", "delivery_run_id", "metodo", "estado", "amount", "referencia", "comprobante_url", "confirmed_at"),
    search_columns=("id", "metodo", "estado", "referencia"),
)

CUSTOMER_ACCOUNT_MOVEMENTS = TableConfig(
    table="customer_account_movements",
    id_prefix="cta",
    label="Cuenta corriente clientes",
    allowed_create=("id", "customer_id", "fecha", "tipo", "debe", "haber", "descripcion", "reference_type", "reference_id", "created_by"),
    allowed_patch=("customer_id", "fecha", "tipo", "debe", "haber", "descripcion", "reference_type", "reference_id", "created_by"),
    search_columns=("id", "tipo", "descripcion", "reference_type", "reference_id"),
    default_order_by="fecha",
)

BREADCRUMB_ACCOUNT_MOVEMENTS = TableConfig(
    table="breadcrumb_account_movements",
    id_prefix="panr",
    label="Pan viejo / pan rallado",
    allowed_create=("id", "customer_id", "fecha", "visit_id", "tipo", "kg_entrada", "kg_salida", "observaciones", "created_by"),
    allowed_patch=("customer_id", "fecha", "visit_id", "tipo", "kg_entrada", "kg_salida", "observaciones", "created_by"),
    search_columns=("id", "tipo", "observaciones"),
    default_order_by="fecha",
)

DELIVERY_RUN_CLOSURES = TableConfig(
    table="delivery_run_closures",
    id_prefix="cierre",
    label="Cierres de reparto",
    allowed_create=("id", "delivery_run_id", "total_vendido", "total_cobrado", "total_deuda", "efectivo_esperado", "efectivo_real", "diferencia_efectivo", "diferencia_stock_total", "notes", "closed_by", "closed_at"),
    allowed_patch=("delivery_run_id", "total_vendido", "total_cobrado", "total_deuda", "efectivo_esperado", "efectivo_real", "diferencia_efectivo", "diferencia_stock_total", "notes", "closed_by", "closed_at"),
    default_order_by="closed_at",
)

AUDIT_LOG = TableConfig(
    table="audit_log",
    id_prefix="audit",
    label="Auditoría",
    allowed_create=("id", "tabla", "record_id", "accion", "usuario_id", "datos_anteriores", "datos_nuevos", "motivo"),
    allowed_patch=("tabla", "record_id", "accion", "usuario_id", "datos_anteriores", "datos_nuevos", "motivo"),
    search_columns=("id", "tabla", "record_id", "accion", "motivo"),
    default_order_by="created_at",
    read_only=False,
)

V_CUSTOMER_BALANCES = TableConfig(
    table="v_customer_balances",
    id_prefix="view",
    label="Vista saldos clientes",
    allowed_create=(),
    allowed_patch=(),
    read_only=True,
    search_columns=("customer_id", "nombre"),
    default_order_by="nombre",
    default_desc=False,
)

V_BREADCRUMB_BALANCES = TableConfig(
    table="v_breadcrumb_balances",
    id_prefix="view",
    label="Vista saldos pan rallado",
    allowed_create=(),
    allowed_patch=(),
    read_only=True,
    search_columns=("customer_id", "nombre"),
    default_order_by="nombre",
    default_desc=False,
)

TABLES: dict[str, TableConfig] = {
    cfg.table: cfg for cfg in [
        BUSINESS_SETTINGS,
        PRODUCTS,
        SUPPLIES,
        RECIPES,
        RECIPE_ITEMS,
        TICKETS,
        TICKET_ITEMS,
        PRODUCTION_BATCHES,
        INVENTORY_MOVEMENTS,
        EMPLOYEES,
        EMPLOYEE_SHIFTS,
        ENERGY_RECORDS,
        INTEGRATION_CONNECTIONS,
        APP_ROLES,
        APP_PERMISSIONS,
        APP_ROLE_PERMISSIONS,
        APP_USERS,
        CUSTOMERS,
        PRODUCT_PRICES,
        DELIVERY_ROUTES,
        DELIVERY_ROUTE_CUSTOMERS,
        DELIVERY_RUNS,
        DELIVERY_RUN_STOCK,
        DELIVERY_VISITS,
        DELIVERY_VISIT_ITEMS,
        PAYMENTS,
        CUSTOMER_ACCOUNT_MOVEMENTS,
        BREADCRUMB_ACCOUNT_MOVEMENTS,
        DELIVERY_RUN_CLOSURES,
        AUDIT_LOG,
        V_CUSTOMER_BALANCES,
        V_BREADCRUMB_BALANCES,
    ]
}
