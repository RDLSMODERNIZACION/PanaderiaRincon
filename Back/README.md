# Panadería Rincón Backend FastAPI

Backend preparado para Render + Supabase/PostgreSQL.

Incluye:

- Conexión PostgreSQL/Supabase por `DATABASE_URL`.
- CRUD específico de productos, insumos, recetas, ventas, producción, inventario, personal, energía y dashboard.
- Módulo completo de reparto: clientes, recorridos, stock del repartidor, visitas, productos entregados, pagos, cuenta corriente, pan viejo/pan rallado y cierre diario.
- Roles, usuarios y permisos.
- CRUD genérico seguro por tabla permitida para crear, editar y borrar sin tener que crear un endpoint nuevo cada vez.
- Auditoría de cambios.

## 1. Variables de entorno

Copiar `.env.example` a `.env` en local.

```env
DATABASE_URL="postgresql://postgres.PROJECT_REF:TU_PASSWORD@aws-1-us-east-1.pooler.supabase.com:5432/postgres?sslmode=require"
AUTH_REQUIRED=0
API_KEY=""
```

Para Render, cargar `DATABASE_URL` desde Environment.

Durante pruebas puede quedar:

```env
AUTH_REQUIRED=0
API_KEY=
```

Cuando quieras cerrar el backend:

```env
AUTH_REQUIRED=1
API_KEY=una_clave_larga
```

Con `AUTH_REQUIRED=1`, el frontend debe mandar `X-API-Key` o `X-User-Id` de un usuario activo con permisos.

## 2. Crear/actualizar tablas en Supabase

En Supabase:

```text
SQL Editor > New query
```

Pegar y ejecutar:

```text
database/schema.sql
```

El archivo es idempotente: se puede ejecutar más de una vez. También queda duplicado como:

```text
database/upgrade_reparto_roles.sql
```

para usarlo como migración sobre la base que ya venías armando.

## 3. Levantar local

```bash
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 4000
```

Probar:

```text
http://localhost:4000/health
http://localhost:4000/health/db
http://localhost:4000/docs
```

## 4. Endpoints principales

### Health

```text
GET /health
GET /health/db
GET /docs
```

### Seguridad / roles

```text
GET    /api/seguridad/me
GET    /api/seguridad/roles
GET    /api/seguridad/roles/{role_id}
POST   /api/seguridad/roles
PATCH  /api/seguridad/roles/{role_id}
DELETE /api/seguridad/roles/{role_id}
GET    /api/seguridad/permisos
POST   /api/seguridad/permisos
POST   /api/seguridad/roles/{role_id}/permisos/{permission_id}
DELETE /api/seguridad/roles/{role_id}/permisos/{permission_id}
GET    /api/seguridad/usuarios
POST   /api/seguridad/usuarios
PATCH  /api/seguridad/usuarios/{user_id}
DELETE /api/seguridad/usuarios/{user_id}
```

### CRUD genérico por tabla

```text
GET    /api/admin/crud/tables
GET    /api/admin/crud/{table_name}
GET    /api/admin/crud/{table_name}/{row_id}
POST   /api/admin/crud/{table_name}
PATCH  /api/admin/crud/{table_name}/{row_id}
DELETE /api/admin/crud/{table_name}/{row_id}
```

Ejemplo:

```bash
curl -X POST https://TU_BACKEND.onrender.com/api/admin/crud/customers \
  -H "Content-Type: application/json" \
  -d '{"nombre":"Autoservicio Centro","direccion":"Av. Principal 123"}'
```

Tablas habilitadas en CRUD genérico:

```text
products
supplies
recipes
recipe_items
tickets
ticket_items
production_batches
inventory_movements
employees
employee_shifts
energy_records
integration_connections
app_roles
app_permissions
app_role_permissions
app_users
customers
product_prices
delivery_routes
delivery_route_customers
delivery_runs
delivery_run_stock
delivery_visits
delivery_visit_items
payments
customer_account_movements
breadcrumb_account_movements
delivery_run_closures
audit_log
```

### Reparto

```text
GET    /api/reparto/clientes
POST   /api/reparto/clientes
PATCH  /api/reparto/clientes/{customer_id}
DELETE /api/reparto/clientes/{customer_id}

GET    /api/reparto/precios
POST   /api/reparto/precios
PATCH  /api/reparto/precios/{precio_id}
DELETE /api/reparto/precios/{precio_id}

GET    /api/reparto/recorridos
POST   /api/reparto/recorridos
PATCH  /api/reparto/recorridos/{route_id}
DELETE /api/reparto/recorridos/{route_id}
GET    /api/reparto/recorridos/{route_id}/clientes
POST   /api/reparto/recorridos/{route_id}/clientes
DELETE /api/reparto/recorridos/clientes/{route_customer_id}

GET    /api/reparto/repartos
GET    /api/reparto/repartos/{run_id}
POST   /api/reparto/repartos
PATCH  /api/reparto/repartos/{run_id}
POST   /api/reparto/repartos/{run_id}/iniciar
GET    /api/reparto/repartos/{run_id}/stock
POST   /api/reparto/repartos/{run_id}/stock
PATCH  /api/reparto/stock/{stock_id}

GET    /api/reparto/visitas
GET    /api/reparto/visitas/{visit_id}
POST   /api/reparto/visitas
PATCH  /api/reparto/visitas/{visit_id}
POST   /api/reparto/visitas/{visit_id}/items
PATCH  /api/reparto/items/{item_id}
DELETE /api/reparto/items/{item_id}
POST   /api/reparto/visitas/{visit_id}/pagos
PATCH  /api/reparto/pagos/{payment_id}
POST   /api/reparto/visitas/{visit_id}/pan-rallado
POST   /api/reparto/visitas/{visit_id}/cerrar

GET    /api/reparto/clientes/{customer_id}/cuenta
POST   /api/reparto/clientes/{customer_id}/cuenta/ajuste
GET    /api/reparto/clientes/{customer_id}/pan-rallado
POST   /api/reparto/clientes/{customer_id}/pan-rallado/ajuste

POST   /api/reparto/repartos/{run_id}/cerrar
GET    /api/reparto/repartos/{run_id}/resumen
GET    /api/reparto/reportes/deudas-clientes
GET    /api/reparto/reportes/pan-rallado-pendiente
```

## 5. Flujo recomendado de reparto

1. Administración crea productos y precios.
2. Administración crea clientes/comercios.
3. Administración crea recorridos y asigna clientes.
4. Se crea un `delivery_run` del día con stock inicial.
5. El repartidor abre una `delivery_visit` por comercio.
6. Carga items vendidos y pagos.
7. Si retira pan viejo o entrega pan rallado, carga movimiento en `breadcrumb_account_movements`.
8. Cierra la visita. El backend genera movimientos de cuenta corriente:
   - venta = debe
   - pagos confirmados = haber
   - pagos pendientes QR/transferencia no descuentan deuda hasta confirmar
9. Al final se cierra el reparto. El backend compara:
   - stock cargado
   - mercadería entregada
   - stock esperado
   - stock real devuelto
   - efectivo esperado
   - efectivo real
   - diferencias

## 6. Notas de seguridad

- No subir `.env` a GitHub.
- No poner `DATABASE_URL` en código.
- Cambiar la contraseña de Supabase después de las pruebas si fue compartida.
- Para producción real, configurar `API_KEY` y `AUTH_REQUIRED=1`.
