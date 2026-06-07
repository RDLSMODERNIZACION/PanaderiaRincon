# Panadería Backend FastAPI

Backend separado del frontend, armado con una estructura parecida al backend de referencia que pasaste:

- `app/main.py`: inicializa FastAPI, CORS, routers y pool de DB.
- `app/db.py`: conexión a PostgreSQL/Supabase con `psycopg_pool`.
- `app/routes/`: endpoints separados por módulo.
- `app/repositories/`: CRUD reutilizable para futuras tablas.
- `app/schemas.py`: modelos de entrada para validar datos.
- `database/schema.sql`: creación de tablas iniciales.
- `database/seed_demo.sql`: datos demo opcionales.
- `database/nueva_tabla_template.sql`: plantilla para nuevas tablas.
- `scripts/`: utilidades para probar conexión y aplicar schema.

## 1) Crear entorno

```bash
python -m venv .venv
```

Windows:

```bash
.venv\Scripts\activate
```

Linux/Mac:

```bash
source .venv/bin/activate
```

## 2) Instalar dependencias

```bash
pip install -r requirements.txt
```

## 3) Configurar Supabase

Copiá el archivo de ejemplo:

```bash
cp .env.example .env
```

Pegá tu conexión real de Supabase:

```env
DATABASE_URL="postgresql://postgres.xxxxx:CLAVE@aws-0-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require"
```

Recomendado en Supabase: usar **Transaction Pooler**, puerto `6543`, con `sslmode=require`.

## 4) Crear tablas

Opción A: desde Supabase

1. Abrí Supabase.
2. Entrá al proyecto.
3. Abrí **SQL Editor**.
4. Pegá el contenido de `database/schema.sql`.
5. Ejecutalo.

Opción B: desde terminal

```bash
python scripts/apply_schema.py
```

Opcional, cargar datos demo:

```bash
# Pegá database/seed_demo.sql en Supabase SQL Editor
```

## 5) Levantar backend

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 4000
```

Abrí:

```text
http://localhost:4000/docs
```

Probar conexión:

```text
GET http://localhost:4000/health/db
```

## Endpoints iniciales

### Health

```text
GET /
GET /health
GET /health/db
```

### Productos

```text
GET    /api/productos
GET    /api/productos/{producto_id}
POST   /api/productos
PATCH  /api/productos/{producto_id}
DELETE /api/productos/{producto_id}
```

Ejemplo:

```json
{
  "nombre": "Pan francés",
  "categoria": "Panadería",
  "unidadVenta": "kg",
  "precioVenta": 2200,
  "costoUnitario": 980,
  "activo": true
}
```

### Insumos

```text
GET    /api/insumos
GET    /api/insumos?bajo_stock=true
POST   /api/insumos
PATCH  /api/insumos/{insumo_id}
DELETE /api/insumos/{insumo_id}
```

### Recetas

```text
GET    /api/recetas
GET    /api/recetas/{receta_id}
POST   /api/recetas
PATCH  /api/recetas/{receta_id}
DELETE /api/recetas/{receta_id}
```

### Ventas

```text
GET    /api/ventas
GET    /api/ventas?desde=2026-06-01&hasta=2026-06-30
GET    /api/ventas/{ticket_id}
POST   /api/ventas
DELETE /api/ventas/{ticket_id}
```

Ejemplo:

```json
{
  "canal": "Mostrador",
  "medioPago": "Efectivo",
  "descuento": 0,
  "items": [
    {
      "productId": "pan-frances",
      "cantidad": 2,
      "precioUnitario": 2200
    }
  ]
}
```

### Producción

```text
GET    /api/produccion
POST   /api/produccion
PATCH  /api/produccion/{lote_id}
DELETE /api/produccion/{lote_id}
```

### Inventario

```text
GET    /api/inventario/resumen
GET    /api/inventario/movimientos
POST   /api/inventario/movimientos
PATCH  /api/inventario/movimientos/{movimiento_id}
DELETE /api/inventario/movimientos/{movimiento_id}
```

### Personal

```text
GET    /api/personal/empleados
POST   /api/personal/empleados
PATCH  /api/personal/empleados/{empleado_id}
DELETE /api/personal/empleados/{empleado_id}
GET    /api/personal/turnos
POST   /api/personal/turnos
DELETE /api/personal/turnos/{turno_id}
```

### Energía

```text
GET    /api/energia/registros
POST   /api/energia/registros
PATCH  /api/energia/registros/{registro_id}
DELETE /api/energia/registros/{registro_id}
```

### Dashboard

```text
GET /api/dashboard/resumen
```

### Admin schema

Sirve para ver qué tablas y columnas existen en Supabase. Es útil cuando empecemos a sumar más tablas.

```text
GET /api/admin/schema/tables
GET /api/admin/schema/tables/{table_name}/columns
```

## Seguridad simple

Por defecto `API_KEY` está vacío y no bloquea los `POST/PATCH/DELETE`.

Cuando quieras proteger escritura:

```env
API_KEY="una-clave-larga"
```

Y desde el frontend mandás:

```text
X-API-Key: una-clave-larga
```

## Cómo agregar una tabla nueva después

1. Copiá `database/nueva_tabla_template.sql`.
2. Cambiá `nombre_tabla` y las columnas.
3. Ejecutá el SQL en Supabase.
4. Copiá `app/routes/_template.py.example` a `app/routes/mi_tabla.py`.
5. Ajustá `TableConfig` con el nombre real de tabla y columnas permitidas.
6. Importá el router en `app/main.py` y agregá:

```python
app.include_router(mi_tabla.router)
```

Con eso queda conectado al mismo pool de Supabase y con estructura lista para crecer.
