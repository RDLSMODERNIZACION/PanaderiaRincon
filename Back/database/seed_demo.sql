-- Datos demo opcionales. Ejecutar después de schema.sql si querés probar rápido.

begin;

insert into public.supplies (id, nombre, unidad, proveedor, costo_unitario, stock_actual, stock_minimo) values
  ('harina-000', 'Harina 000', 'kg', 'Molino San José', 520, 220, 80),
  ('harina-0000', 'Harina 0000', 'kg', 'Molino San José', 560, 120, 50),
  ('levadura', 'Levadura', 'kg', 'LevanCo', 1900, 12, 6),
  ('sal', 'Sal fina', 'kg', 'Salinas SA', 280, 18, 8),
  ('azucar', 'Azúcar', 'kg', 'Dulce Norte', 920, 55, 20),
  ('manteca', 'Manteca', 'kg', 'Lácteos La Vaca', 4200, 24, 10),
  ('huevos', 'Huevos', 'u', 'Granja El Trigal', 140, 380, 200),
  ('dulce-leche', 'Dulce de leche', 'kg', 'Dulzor', 3900, 16, 8),
  ('jamon', 'Jamón', 'kg', 'Fiambres Don Pepe', 6900, 9, 6),
  ('queso', 'Queso', 'kg', 'Fiambres Don Pepe', 8200, 11, 7),
  ('cafe', 'Café en grano', 'kg', 'Tueste Barrio', 12500, 6, 4)
on conflict (id) do nothing;

insert into public.products (id, nombre, categoria, unidad_venta, precio_venta, costo_unitario, activo, receta_id) values
  ('pan-frances', 'Pan francés', 'Panadería', 'kg', 2200, 980, true, 'r-pan-frances'),
  ('pan-lactal', 'Pan lactal', 'Panadería', 'u', 2800, 1200, true, 'r-pan-lactal'),
  ('fugazzeta', 'Fugazzeta', 'Panadería', 'u', 3500, 1600, true, 'r-fugazzeta'),
  ('medialuna-manteca', 'Medialuna de manteca', 'Facturería', 'u', 550, 240, true, 'r-medialuna'),
  ('factura-dulce', 'Factura D. leche', 'Facturería', 'u', 650, 290, true, 'r-factura'),
  ('chipa', 'Chipá', 'Facturería', 'u', 450, 230, true, null),
  ('torta-rogel', 'Rogel', 'Pastelería', 'u', 18000, 8200, true, null),
  ('brownie', 'Brownie', 'Pastelería', 'u', 2500, 1100, true, null),
  ('sandwich-jyq', 'Sándwich JyQ', 'Sandwiches', 'u', 5200, 2600, true, null),
  ('cafe-americano', 'Café americano', 'Café', 'u', 1800, 520, true, null),
  ('cafe-latte', 'Café latte', 'Café', 'u', 2300, 720, true, null)
on conflict (id) do nothing;

insert into public.recipes (id, product_id, rinde_unidades) values
  ('r-pan-frances', 'pan-frances', 10),
  ('r-pan-lactal', 'pan-lactal', 8),
  ('r-fugazzeta', 'fugazzeta', 6),
  ('r-medialuna', 'medialuna-manteca', 40),
  ('r-factura', 'factura-dulce', 30)
on conflict (id) do nothing;

insert into public.recipe_items (id, recipe_id, supply_id, cantidad, unidad) values
  ('ri-pan-frances-1', 'r-pan-frances', 'harina-000', 6, 'kg'),
  ('ri-pan-frances-2', 'r-pan-frances', 'levadura', 0.12, 'kg'),
  ('ri-pan-frances-3', 'r-pan-frances', 'sal', 0.12, 'kg'),
  ('ri-pan-lactal-1', 'r-pan-lactal', 'harina-0000', 2.2, 'kg'),
  ('ri-pan-lactal-2', 'r-pan-lactal', 'levadura', 0.06, 'kg'),
  ('ri-pan-lactal-3', 'r-pan-lactal', 'sal', 0.04, 'kg'),
  ('ri-pan-lactal-4', 'r-pan-lactal', 'manteca', 0.18, 'kg'),
  ('ri-fugazzeta-1', 'r-fugazzeta', 'harina-000', 1.8, 'kg'),
  ('ri-fugazzeta-2', 'r-fugazzeta', 'levadura', 0.05, 'kg'),
  ('ri-fugazzeta-3', 'r-fugazzeta', 'sal', 0.03, 'kg'),
  ('ri-fugazzeta-4', 'r-fugazzeta', 'queso', 0.6, 'kg')
on conflict (id) do nothing;

insert into public.employees (id, nombre, rol, costo_hora, activo) values
  ('e-ana', 'Ana Díaz', 'Vendedor', 4200, true),
  ('e-mati', 'Matías Rojas', 'Panadero', 5600, true),
  ('e-sol', 'Sol Benítez', 'Pastelero', 6100, true),
  ('e-nico', 'Nicolás Vera', 'Ayudante', 3800, true),
  ('e-vale', 'Valeria Luna', 'Vendedor', 4100, true),
  ('e-lucho', 'Luciano Paz', 'Delivery', 3900, true)
on conflict (id) do nothing;

commit;
