# Panadería Rincón Frontend

Frontend Next.js conectado al backend FastAPI/Supabase de Panadería Rincón.

## Qué incluye

- Login conectado al backend por `X-API-Key` o `X-User-Id`.
- Menú protegido por sesión.
- Dashboard real desde `/api/dashboard/resumen`, `/health` y `/health/db`.
- CRUD completo contra `/api/admin/crud/*`.
- Módulos listos para:
  - Reparto y rendición.
  - Clientes/comercios.
  - Cuentas corrientes en pesos.
  - Pan viejo / pan rallado en kg.
  - Productos, precios, insumos, inventario, ventas, producción y personal.
  - Seguridad: usuarios, roles, permisos y permisos por rol.
  - Auditoría.

No usa `src/data/seed.ts` ni datos hardcodeados de negocio. Las tablas se leen y escriben desde el backend.

## Variables de entorno

Copiar:

```bash
cp .env.local.example .env.local
```

Editar:

```env
NEXT_PUBLIC_API_URL=https://panaderia-backend-vrfl.onrender.com
NEXT_PUBLIC_API_KEY=
```

También podés poner la URL del backend directamente en el login.

## Levantar local

```bash
npm install
npm run dev
```

Abrir:

```text
http://localhost:3000/login
```

## Build / chequeo

```bash
npm run lint:types
npm run build
```

En este paquete se validó TypeScript con `npm run lint:types`.

## Login actual

El backend actual soporta estas formas de autenticación:

1. `X-API-Key`: entra como admin si coincide con `API_KEY` del backend.
2. `X-User-Id`: usa el usuario y rol guardados en `app_users`.
3. Desarrollo abierto: si `AUTH_REQUIRED=0` y `API_KEY` está vacío en Render, permite entrar sin credenciales reales.

Para producción real, conviene agregar al backend un endpoint de login con contraseña/PIN y token. Este frontend ya queda preparado para enviar headers y respetar permisos.

## Deploy en Vercel

- Root directory: carpeta del frontend.
- Build command: `npm run build`.
- Output: Next.js automático.
- Environment variables:

```env
NEXT_PUBLIC_API_URL=https://panaderia-backend-vrfl.onrender.com
NEXT_PUBLIC_API_KEY=
```

Si usás API key pública en `NEXT_PUBLIC_API_KEY`, recordá que queda visible en el navegador. Para prueba está bien; para producción no.
