-- Datos demo opcionales para probar el backend.
-- Ejecutar después de database/schema.sql.

begin;

insert into public.products (id, nombre, categoria, unidad_venta, precio_venta, costo_unitario, activo) values
  ('prod_pan_kg', 'Pan', 'Panadería', 'kg', 2500, 1200, true),
  ('prod_pan_rallado_kg', 'Pan rallado', 'Panadería', 'kg', 1800, 600, true),
  ('prod_facturas_docena', 'Facturas', 'Facturería', 'docena', 9000, 4500, true),
  ('prod_prepizza_u', 'Prepizza', 'Panadería', 'u', 1500, 700, true)
on conflict (id) do update set
  nombre = excluded.nombre,
  categoria = excluded.categoria,
  unidad_venta = excluded.unidad_venta,
  precio_venta = excluded.precio_venta,
  costo_unitario = excluded.costo_unitario,
  activo = excluded.activo;

insert into public.employees (id, nombre, rol, costo_hora, activo) values
  ('emp_repartidor_1', 'Repartidor Demo', 'Delivery', 0, true),
  ('emp_admin_1', 'Administrador Demo', 'Administrador', 0, true)
on conflict (id) do update set nombre = excluded.nombre, rol = excluded.rol, activo = excluded.activo;

insert into public.app_users (id, email, nombre, role_id, employee_id, status) values
  ('user_admin', 'admin@panaderiarincon.local', 'Administrador', 'role_admin', 'emp_admin_1', 'active'),
  ('user_repartidor_1', 'repartidor@panaderiarincon.local', 'Repartidor Demo', 'role_repartidor', 'emp_repartidor_1', 'active')
on conflict (id) do update set role_id = excluded.role_id, employee_id = excluded.employee_id, status = excluded.status;

insert into public.customers (id, nombre, direccion, telefono, activo, observaciones) values
  ('cli_kiosco_centro', 'Kiosco Centro', 'Av. Principal 123', '', true, 'Cliente demo'),
  ('cli_almacen_norte', 'Almacén Norte', 'Barrio Norte', '', true, 'Cliente demo')
on conflict (id) do update set nombre = excluded.nombre, direccion = excluded.direccion, activo = excluded.activo;

insert into public.product_prices (id, product_id, customer_id, precio, fecha_desde, activo) values
  ('precio_pan_general', 'prod_pan_kg', null, 2500, current_date, true),
  ('precio_pan_rallado_general', 'prod_pan_rallado_kg', null, 1800, current_date, true),
  ('precio_facturas_general', 'prod_facturas_docena', null, 9000, current_date, true)
on conflict (id) do update set precio = excluded.precio, activo = excluded.activo;

insert into public.delivery_routes (id, nombre, activo) values
  ('ruta_centro', 'Centro', true)
on conflict (id) do update set nombre = excluded.nombre, activo = excluded.activo;

insert into public.delivery_route_customers (id, route_id, customer_id, orden) values
  ('rc_centro_1', 'ruta_centro', 'cli_kiosco_centro', 1),
  ('rc_centro_2', 'ruta_centro', 'cli_almacen_norte', 2)
on conflict (route_id, customer_id) do update set orden = excluded.orden;

commit;
