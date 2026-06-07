from app.repositories.crud import TableConfig

PRODUCTS = TableConfig(
    table="products",
    id_prefix="prod",
    allowed_create=("id", "nombre", "categoria", "unidad_venta", "precio_venta", "costo_unitario", "activo", "receta_id"),
    allowed_patch=("nombre", "categoria", "unidad_venta", "precio_venta", "costo_unitario", "activo", "receta_id"),
    soft_delete_column="activo",
)

SUPPLIES = TableConfig(
    table="supplies",
    id_prefix="ins",
    allowed_create=("id", "nombre", "unidad", "proveedor", "costo_unitario", "stock_actual", "stock_minimo"),
    allowed_patch=("nombre", "unidad", "proveedor", "costo_unitario", "stock_actual", "stock_minimo"),
)

PRODUCTION_BATCHES = TableConfig(
    table="production_batches",
    id_prefix="lote",
    allowed_create=("id", "fecha", "turno", "product_id", "planificado", "producido", "merma", "nota"),
    allowed_patch=("fecha", "turno", "product_id", "planificado", "producido", "merma", "nota"),
)

INVENTORY_MOVEMENTS = TableConfig(
    table="inventory_movements",
    id_prefix="mov",
    allowed_create=("id", "fecha", "supply_id", "tipo", "cantidad", "motivo", "referencia"),
    allowed_patch=("fecha", "supply_id", "tipo", "cantidad", "motivo", "referencia"),
)

EMPLOYEES = TableConfig(
    table="employees",
    id_prefix="emp",
    allowed_create=("id", "nombre", "rol", "costo_hora", "activo"),
    allowed_patch=("nombre", "rol", "costo_hora", "activo"),
    soft_delete_column="activo",
)

EMPLOYEE_SHIFTS = TableConfig(
    table="employee_shifts",
    id_prefix="turno",
    allowed_create=("id", "fecha", "employee_id", "horas"),
    allowed_patch=("fecha", "employee_id", "horas"),
)

ENERGY_RECORDS = TableConfig(
    table="energy_records",
    id_prefix="en",
    allowed_create=("id", "fecha", "horno", "kwh", "costo"),
    allowed_patch=("fecha", "horno", "kwh", "costo"),
)
