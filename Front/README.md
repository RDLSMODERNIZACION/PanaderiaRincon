# Panadería Admin Full (Next.js + Node)

Un dashboard completo para **gestión de panadería** (todo con datos hardcodeados).
Pensado para correr con Node y luego conectar una API / Node-RED si querés.

## Levantar
```bash
npm install
npm run dev
```
Abrí: http://localhost:3000

## Qué trae
- Sidebar + topbar + layout estilo admin
- Dashboard con KPIs + charts
- Ventas (tickets) + drawer de detalle + export CSV
- Productos (precio/costo/margen) + modal de edición en memoria
- Producción (plan vs producido, merma) + chart + export CSV
- Inventario (insumos, stock mínimo, movimientos) + modal para movimientos + export CSV
- Personal (turnos, horas, costo) + chart + export CSV
- Reportes (resumen por período, tops) + export CSV

> Todo está en `src/data/seed.ts` (mock). No usa base de datos.
