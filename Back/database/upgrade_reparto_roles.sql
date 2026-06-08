-- Schema completo Panadería Rincón
-- FastAPI + Supabase PostgreSQL
-- Incluye: productos, stock, personal, roles, usuarios, reparto, cuenta corriente, pan viejo/pan rallado y auditoría.

begin;

create extension if not exists pgcrypto;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- =========================
-- Configuración general
-- =========================

create table if not exists public.business_settings (
  id text primary key default 'main',
  nombre text not null default 'Panadería',
  moneda text not null default 'ARS',
  alertas boolean not null default true,
  merma_max numeric(8, 4) not null default 0.06,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =========================
-- Seguridad / roles
-- =========================

create table if not exists public.app_roles (
  id text primary key default gen_random_uuid()::text,
  nombre text not null unique,
  descripcion text,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.app_permissions (
  id text primary key default gen_random_uuid()::text,
  clave text not null unique,
  descripcion text,
  modulo text not null default 'general',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.app_role_permissions (
  id text primary key default gen_random_uuid()::text,
  role_id text not null references public.app_roles(id) on delete cascade,
  permission_id text not null references public.app_permissions(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (role_id, permission_id)
);

create table if not exists public.app_users (
  id text primary key default gen_random_uuid()::text,
  email text unique,
  nombre text not null,
  role_id text references public.app_roles(id) on delete set null,
  employee_id text,
  status text not null default 'active' check (status in ('active', 'disabled')),
  pin_hash text,
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =========================
-- Productos / insumos / recetas
-- =========================

create table if not exists public.products (
  id text primary key default gen_random_uuid()::text,
  nombre text not null,
  categoria text not null default 'Panadería',
  unidad_venta text not null default 'u',
  precio_venta numeric(14, 2) not null default 0,
  costo_unitario numeric(14, 2) not null default 0,
  activo boolean not null default true,
  receta_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.supplies (
  id text primary key default gen_random_uuid()::text,
  nombre text not null,
  unidad text not null default 'kg',
  proveedor text not null default '',
  costo_unitario numeric(14, 2) not null default 0,
  stock_actual numeric(14, 3) not null default 0,
  stock_minimo numeric(14, 3) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.recipes (
  id text primary key default gen_random_uuid()::text,
  product_id text not null references public.products(id) on delete cascade,
  rinde_unidades numeric(14, 3) not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.recipe_items (
  id text primary key default gen_random_uuid()::text,
  recipe_id text not null references public.recipes(id) on delete cascade,
  supply_id text not null references public.supplies(id) on delete restrict,
  cantidad numeric(14, 4) not null,
  unidad text not null default 'kg',
  created_at timestamptz not null default now()
);

-- =========================
-- Ventas mostrador/base
-- =========================

create table if not exists public.tickets (
  id text primary key default gen_random_uuid()::text,
  fecha timestamptz not null default now(),
  canal text not null default 'Mostrador',
  medio_pago text not null default 'Efectivo',
  descuento numeric(14, 2) not null default 0,
  total numeric(14, 2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ticket_items (
  id text primary key default gen_random_uuid()::text,
  ticket_id text not null references public.tickets(id) on delete cascade,
  product_id text not null references public.products(id) on delete restrict,
  cantidad numeric(14, 3) not null,
  precio_unitario numeric(14, 2) not null,
  created_at timestamptz not null default now()
);

-- =========================
-- Producción / inventario / personal / energía
-- =========================

create table if not exists public.production_batches (
  id text primary key default gen_random_uuid()::text,
  fecha timestamptz not null default now(),
  turno text not null default 'Mañana',
  product_id text not null references public.products(id) on delete restrict,
  planificado numeric(14, 3) not null default 0,
  producido numeric(14, 3) not null default 0,
  merma numeric(14, 3) not null default 0,
  nota text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.inventory_movements (
  id text primary key default gen_random_uuid()::text,
  fecha timestamptz not null default now(),
  supply_id text not null references public.supplies(id) on delete restrict,
  tipo text not null default 'Entrada',
  cantidad numeric(14, 3) not null,
  motivo text not null default '',
  referencia text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.employees (
  id text primary key default gen_random_uuid()::text,
  nombre text not null,
  rol text not null default 'Delivery',
  costo_hora numeric(14, 2) not null default 0,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.app_users add column if not exists employee_id text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'app_users_employee_fk'
      and conrelid = 'public.app_users'::regclass
  ) then
    execute 'alter table public.app_users add constraint app_users_employee_fk foreign key (employee_id) references public.employees(id) on delete set null not valid';
  end if;
end $$;

create table if not exists public.employee_shifts (
  id text primary key default gen_random_uuid()::text,
  fecha timestamptz not null default now(),
  employee_id text not null references public.employees(id) on delete restrict,
  horas numeric(8, 2) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.energy_records (
  id text primary key default gen_random_uuid()::text,
  fecha timestamptz not null default now(),
  horno text not null default 'Horno 1',
  kwh numeric(14, 3) not null default 0,
  costo numeric(14, 2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.integration_connections (
  id text primary key default gen_random_uuid()::text,
  nombre text not null,
  tipo text not null,
  estado text not null default 'pendiente' check (estado in ('pendiente', 'activa', 'pausada', 'error')),
  config jsonb not null default '{}'::jsonb,
  ultimo_evento timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =========================
-- Reparto / clientes / cuenta corriente
-- =========================

create table if not exists public.customers (
  id text primary key default gen_random_uuid()::text,
  nombre text not null,
  direccion text,
  telefono text,
  latitud numeric(10,7),
  longitud numeric(10,7),
  activo boolean not null default true,
  observaciones text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.product_prices (
  id text primary key default gen_random_uuid()::text,
  product_id text not null references public.products(id) on delete restrict,
  customer_id text references public.customers(id) on delete cascade,
  precio numeric(14,2) not null,
  fecha_desde date not null default current_date,
  fecha_hasta date,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.delivery_routes (
  id text primary key default gen_random_uuid()::text,
  nombre text not null,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.delivery_route_customers (
  id text primary key default gen_random_uuid()::text,
  route_id text not null references public.delivery_routes(id) on delete cascade,
  customer_id text not null references public.customers(id) on delete cascade,
  orden int not null default 0,
  created_at timestamptz not null default now(),
  unique (route_id, customer_id)
);

create table if not exists public.delivery_runs (
  id text primary key default gen_random_uuid()::text,
  fecha date not null default current_date,
  driver_id text references public.employees(id) on delete restrict,
  route_id text references public.delivery_routes(id) on delete restrict,
  estado text not null default 'preparado' check (estado in ('preparado','en_recorrido','cerrado','cancelado')),
  started_at timestamptz,
  closed_at timestamptz,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.delivery_run_stock (
  id text primary key default gen_random_uuid()::text,
  delivery_run_id text not null references public.delivery_runs(id) on delete cascade,
  product_id text not null references public.products(id) on delete restrict,
  cantidad_cargada numeric(14,3) not null default 0,
  cantidad_devuelta_real numeric(14,3) not null default 0,
  cantidad_esperada numeric(14,3) not null default 0,
  diferencia numeric(14,3) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (delivery_run_id, product_id)
);

create table if not exists public.delivery_visits (
  id text primary key default gen_random_uuid()::text,
  delivery_run_id text not null references public.delivery_runs(id) on delete cascade,
  customer_id text not null references public.customers(id) on delete restrict,
  visit_number int not null default 1,
  arrived_at timestamptz not null default now(),
  closed_at timestamptz,
  estado text not null default 'abierta' check (estado in ('abierta','cerrada','anulada')),
  latitud numeric(10,7),
  longitud numeric(10,7),
  gps_ok boolean not null default false,
  fuera_de_zona_motivo text,
  locked_at timestamptz,
  observaciones text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.delivery_visit_items (
  id text primary key default gen_random_uuid()::text,
  visit_id text not null references public.delivery_visits(id) on delete cascade,
  product_id text not null references public.products(id) on delete restrict,
  tipo text not null default 'venta' check (tipo in ('venta','devolucion','bonificacion','ajuste')),
  cantidad numeric(14,3) not null,
  precio_unitario numeric(14,2) not null default 0,
  subtotal numeric(14,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.payments (
  id text primary key default gen_random_uuid()::text,
  visit_id text references public.delivery_visits(id) on delete set null,
  customer_id text not null references public.customers(id) on delete restrict,
  delivery_run_id text references public.delivery_runs(id) on delete set null,
  metodo text not null check (metodo in ('efectivo','transferencia','mercado_pago','qr','otro')),
  estado text not null default 'confirmado' check (estado in ('confirmado','pendiente','rechazado')),
  amount numeric(14,2) not null,
  referencia text,
  comprobante_url text,
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.customer_account_movements (
  id text primary key default gen_random_uuid()::text,
  customer_id text not null references public.customers(id) on delete cascade,
  fecha timestamptz not null default now(),
  tipo text not null check (tipo in ('venta','pago','ajuste_admin','nota_credito','saldo_inicial')),
  debe numeric(14,2) not null default 0,
  haber numeric(14,2) not null default 0,
  descripcion text,
  reference_type text,
  reference_id text,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.breadcrumb_account_movements (
  id text primary key default gen_random_uuid()::text,
  customer_id text not null references public.customers(id) on delete cascade,
  fecha timestamptz not null default now(),
  visit_id text references public.delivery_visits(id) on delete set null,
  tipo text not null check (tipo in ('pan_viejo_recibido','pan_rallado_entregado','ajuste_admin','saldo_inicial')),
  kg_entrada numeric(14,3) not null default 0,
  kg_salida numeric(14,3) not null default 0,
  observaciones text,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.delivery_run_closures (
  id text primary key default gen_random_uuid()::text,
  delivery_run_id text not null references public.delivery_runs(id) on delete cascade,
  total_vendido numeric(14,2) not null default 0,
  total_cobrado numeric(14,2) not null default 0,
  total_deuda numeric(14,2) not null default 0,
  efectivo_esperado numeric(14,2) not null default 0,
  efectivo_real numeric(14,2) not null default 0,
  diferencia_efectivo numeric(14,2) not null default 0,
  diferencia_stock_total numeric(14,3) not null default 0,
  notes text,
  closed_by text,
  closed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.audit_log (
  id text primary key default gen_random_uuid()::text,
  tabla text not null,
  record_id text not null,
  accion text not null check (accion in ('crear','editar','anular','ajustar','borrar')),
  usuario_id text,
  datos_anteriores jsonb,
  datos_nuevos jsonb,
  motivo text,
  created_at timestamptz not null default now()
);

-- =========================
-- Compatibilidad con tablas ya creadas durante pruebas
-- =========================

alter table public.products alter column id set default gen_random_uuid()::text;
alter table public.supplies alter column id set default gen_random_uuid()::text;
alter table public.employees alter column id set default gen_random_uuid()::text;
alter table public.tickets alter column id set default gen_random_uuid()::text;

alter table public.products drop constraint if exists products_categoria_check;
alter table public.products drop constraint if exists products_unidad_venta_check;
alter table public.supplies drop constraint if exists supplies_unidad_check;
alter table public.employees drop constraint if exists employees_rol_check;
alter table public.tickets drop constraint if exists tickets_canal_check;
alter table public.tickets drop constraint if exists tickets_medio_pago_check;
alter table public.production_batches drop constraint if exists production_batches_turno_check;
alter table public.inventory_movements drop constraint if exists inventory_movements_tipo_check;
alter table public.energy_records drop constraint if exists energy_records_horno_check;
alter table public.audit_log drop constraint if exists audit_log_accion_check;
alter table public.audit_log add constraint audit_log_accion_check check (accion in ('crear','editar','anular','ajustar','borrar')) not valid;

alter table public.products add column if not exists receta_id text;
alter table public.app_users add column if not exists employee_id text;
alter table public.app_users add column if not exists pin_hash text;
alter table public.payments add column if not exists confirmed_at timestamptz;

-- =========================
-- Triggers updated_at
-- =========================

drop trigger if exists business_settings_touch_updated_at on public.business_settings;
create trigger business_settings_touch_updated_at before update on public.business_settings for each row execute function public.touch_updated_at();

drop trigger if exists app_roles_touch_updated_at on public.app_roles;
create trigger app_roles_touch_updated_at before update on public.app_roles for each row execute function public.touch_updated_at();

drop trigger if exists app_permissions_touch_updated_at on public.app_permissions;
create trigger app_permissions_touch_updated_at before update on public.app_permissions for each row execute function public.touch_updated_at();

drop trigger if exists app_users_touch_updated_at on public.app_users;
create trigger app_users_touch_updated_at before update on public.app_users for each row execute function public.touch_updated_at();

drop trigger if exists products_touch_updated_at on public.products;
create trigger products_touch_updated_at before update on public.products for each row execute function public.touch_updated_at();

drop trigger if exists supplies_touch_updated_at on public.supplies;
create trigger supplies_touch_updated_at before update on public.supplies for each row execute function public.touch_updated_at();

drop trigger if exists recipes_touch_updated_at on public.recipes;
create trigger recipes_touch_updated_at before update on public.recipes for each row execute function public.touch_updated_at();

drop trigger if exists tickets_touch_updated_at on public.tickets;
create trigger tickets_touch_updated_at before update on public.tickets for each row execute function public.touch_updated_at();

drop trigger if exists production_batches_touch_updated_at on public.production_batches;
create trigger production_batches_touch_updated_at before update on public.production_batches for each row execute function public.touch_updated_at();

drop trigger if exists inventory_movements_touch_updated_at on public.inventory_movements;
create trigger inventory_movements_touch_updated_at before update on public.inventory_movements for each row execute function public.touch_updated_at();

drop trigger if exists employees_touch_updated_at on public.employees;
create trigger employees_touch_updated_at before update on public.employees for each row execute function public.touch_updated_at();

drop trigger if exists employee_shifts_touch_updated_at on public.employee_shifts;
create trigger employee_shifts_touch_updated_at before update on public.employee_shifts for each row execute function public.touch_updated_at();

drop trigger if exists energy_records_touch_updated_at on public.energy_records;
create trigger energy_records_touch_updated_at before update on public.energy_records for each row execute function public.touch_updated_at();

drop trigger if exists integration_connections_touch_updated_at on public.integration_connections;
create trigger integration_connections_touch_updated_at before update on public.integration_connections for each row execute function public.touch_updated_at();

drop trigger if exists customers_touch_updated_at on public.customers;
create trigger customers_touch_updated_at before update on public.customers for each row execute function public.touch_updated_at();

drop trigger if exists product_prices_touch_updated_at on public.product_prices;
create trigger product_prices_touch_updated_at before update on public.product_prices for each row execute function public.touch_updated_at();

drop trigger if exists delivery_routes_touch_updated_at on public.delivery_routes;
create trigger delivery_routes_touch_updated_at before update on public.delivery_routes for each row execute function public.touch_updated_at();

drop trigger if exists delivery_runs_touch_updated_at on public.delivery_runs;
create trigger delivery_runs_touch_updated_at before update on public.delivery_runs for each row execute function public.touch_updated_at();

drop trigger if exists delivery_run_stock_touch_updated_at on public.delivery_run_stock;
create trigger delivery_run_stock_touch_updated_at before update on public.delivery_run_stock for each row execute function public.touch_updated_at();

drop trigger if exists delivery_visits_touch_updated_at on public.delivery_visits;
create trigger delivery_visits_touch_updated_at before update on public.delivery_visits for each row execute function public.touch_updated_at();

drop trigger if exists delivery_visit_items_touch_updated_at on public.delivery_visit_items;
create trigger delivery_visit_items_touch_updated_at before update on public.delivery_visit_items for each row execute function public.touch_updated_at();

drop trigger if exists payments_touch_updated_at on public.payments;
create trigger payments_touch_updated_at before update on public.payments for each row execute function public.touch_updated_at();

drop trigger if exists customer_account_movements_touch_updated_at on public.customer_account_movements;
create trigger customer_account_movements_touch_updated_at before update on public.customer_account_movements for each row execute function public.touch_updated_at();

drop trigger if exists breadcrumb_account_movements_touch_updated_at on public.breadcrumb_account_movements;
create trigger breadcrumb_account_movements_touch_updated_at before update on public.breadcrumb_account_movements for each row execute function public.touch_updated_at();

drop trigger if exists delivery_run_closures_touch_updated_at on public.delivery_run_closures;
create trigger delivery_run_closures_touch_updated_at before update on public.delivery_run_closures for each row execute function public.touch_updated_at();

-- =========================
-- Vistas de control
-- =========================

create or replace view public.v_customer_balances as
select
  c.id as id,
  c.id as customer_id,
  c.nombre,
  coalesce(sum(m.debe), 0) as total_debe,
  coalesce(sum(m.haber), 0) as total_haber,
  coalesce(sum(m.debe - m.haber), 0) as saldo
from public.customers c
left join public.customer_account_movements m on m.customer_id = c.id
group by c.id, c.nombre;

create or replace view public.v_breadcrumb_balances as
select
  c.id as id,
  c.id as customer_id,
  c.nombre,
  coalesce(sum(m.kg_entrada), 0) as kg_entrada,
  coalesce(sum(m.kg_salida), 0) as kg_salida,
  coalesce(sum(m.kg_entrada - m.kg_salida), 0) as kg_pendiente
from public.customers c
left join public.breadcrumb_account_movements m on m.customer_id = c.id
group by c.id, c.nombre;

create or replace view public.v_delivery_visit_totals as
select
  v.id as id,
  v.id as visit_id,
  v.delivery_run_id,
  v.customer_id,
  c.nombre as customer_nombre,
  v.visit_number,
  v.arrived_at,
  v.closed_at,
  v.estado,
  coalesce(sum(case when i.tipo = 'venta' then i.subtotal else 0 end), 0) as total_vendido,
  coalesce(sum(case when i.tipo = 'bonificacion' then i.subtotal else 0 end), 0) as total_bonificado,
  coalesce(sum(case when i.tipo = 'devolucion' then i.subtotal else 0 end), 0) as total_devuelto,
  coalesce((select sum(p.amount) from public.payments p where p.visit_id = v.id and p.estado = 'confirmado'), 0) as total_cobrado,
  coalesce((select sum(p.amount) from public.payments p where p.visit_id = v.id and p.estado = 'pendiente'), 0) as total_pendiente
from public.delivery_visits v
join public.customers c on c.id = v.customer_id
left join public.delivery_visit_items i on i.visit_id = v.id
group by v.id, c.nombre;

create or replace view public.v_delivery_run_summary as
select
  dr.id as id,
  dr.id as delivery_run_id,
  dr.fecha,
  dr.driver_id,
  e.nombre as driver_nombre,
  dr.route_id,
  r.nombre as route_nombre,
  dr.estado,
  coalesce(sum(vt.total_vendido), 0) as total_vendido,
  coalesce(sum(vt.total_cobrado), 0) as total_cobrado,
  coalesce(sum(vt.total_pendiente), 0) as total_pendiente,
  coalesce(sum(vt.total_vendido - vt.total_cobrado), 0) as total_deuda,
  coalesce((select sum(p.amount) from public.payments p where p.delivery_run_id = dr.id and p.estado = 'confirmado' and p.metodo = 'efectivo'), 0) as efectivo_confirmado,
  count(v.id)::int as visitas_count
from public.delivery_runs dr
left join public.employees e on e.id = dr.driver_id
left join public.delivery_routes r on r.id = dr.route_id
left join public.delivery_visits v on v.delivery_run_id = dr.id
left join public.v_delivery_visit_totals vt on vt.visit_id = v.id
group by dr.id, e.nombre, r.nombre;

create or replace view public.v_delivery_run_stock_summary as
select
  s.id as id,
  s.delivery_run_id,
  s.product_id,
  p.nombre as producto_nombre,
  p.unidad_venta,
  s.cantidad_cargada,
  coalesce(sum(case when i.tipo in ('venta','bonificacion','ajuste') then i.cantidad when i.tipo = 'devolucion' then -i.cantidad else 0 end), 0) as cantidad_entregada,
  s.cantidad_cargada - coalesce(sum(case when i.tipo in ('venta','bonificacion','ajuste') then i.cantidad when i.tipo = 'devolucion' then -i.cantidad else 0 end), 0) as cantidad_esperada,
  s.cantidad_devuelta_real,
  s.cantidad_devuelta_real - (s.cantidad_cargada - coalesce(sum(case when i.tipo in ('venta','bonificacion','ajuste') then i.cantidad when i.tipo = 'devolucion' then -i.cantidad else 0 end), 0)) as diferencia
from public.delivery_run_stock s
join public.products p on p.id = s.product_id
left join public.delivery_visits v on v.delivery_run_id = s.delivery_run_id
left join public.delivery_visit_items i on i.visit_id = v.id and i.product_id = s.product_id
group by s.id, p.nombre, p.unidad_venta;

-- =========================
-- Índices
-- =========================

create index if not exists idx_products_activo on public.products(activo);
create index if not exists idx_products_categoria on public.products(categoria);
create index if not exists idx_supplies_stock on public.supplies(stock_actual, stock_minimo);
create index if not exists idx_recipes_product_id on public.recipes(product_id);
create index if not exists idx_recipe_items_recipe_id on public.recipe_items(recipe_id);
create index if not exists idx_recipe_items_supply_id on public.recipe_items(supply_id);
create index if not exists idx_tickets_fecha on public.tickets(fecha desc);
create index if not exists idx_ticket_items_ticket_id on public.ticket_items(ticket_id);
create index if not exists idx_production_batches_fecha on public.production_batches(fecha desc);
create index if not exists idx_inventory_movements_fecha on public.inventory_movements(fecha desc);
create index if not exists idx_employee_shifts_fecha on public.employee_shifts(fecha desc);
create index if not exists idx_energy_records_fecha on public.energy_records(fecha desc);
create index if not exists idx_customers_activo on public.customers(activo);
create index if not exists idx_customers_nombre on public.customers(nombre);
create index if not exists idx_product_prices_product_customer on public.product_prices(product_id, customer_id);
create index if not exists idx_delivery_runs_fecha on public.delivery_runs(fecha desc);
create index if not exists idx_delivery_runs_driver on public.delivery_runs(driver_id);
create index if not exists idx_delivery_visits_run on public.delivery_visits(delivery_run_id);
create index if not exists idx_delivery_visits_customer on public.delivery_visits(customer_id);
create index if not exists idx_delivery_visit_items_visit on public.delivery_visit_items(visit_id);
create index if not exists idx_payments_visit on public.payments(visit_id);
create index if not exists idx_payments_customer on public.payments(customer_id);
create index if not exists idx_customer_account_customer on public.customer_account_movements(customer_id, fecha desc);
create index if not exists idx_breadcrumb_account_customer on public.breadcrumb_account_movements(customer_id, fecha desc);
create index if not exists idx_audit_log_tabla_record on public.audit_log(tabla, record_id);

-- =========================
-- Datos base de seguridad
-- =========================

insert into public.business_settings (id, nombre, moneda, alertas, merma_max)
values ('main', 'Panadería Rincón', 'ARS', true, 0.0600)
on conflict (id) do nothing;

insert into public.app_roles (id, nombre, descripcion, activo) values
  ('role_admin', 'Administrador', 'Acceso completo al sistema', true),
  ('role_repartidor', 'Repartidor', 'Carga visitas, ventas, pagos y cierre de recorrido', true),
  ('role_consulta', 'Consulta', 'Solo lectura', true)
on conflict (id) do update set nombre = excluded.nombre, descripcion = excluded.descripcion, activo = excluded.activo;

insert into public.app_permissions (id, clave, descripcion, modulo) values
  ('perm_admin_crud_read', 'admin.crud.read', 'Ver cualquier tabla habilitada', 'admin'),
  ('perm_admin_crud_write', 'admin.crud.write', 'Crear y editar cualquier tabla habilitada', 'admin'),
  ('perm_admin_crud_delete', 'admin.crud.delete', 'Borrar o desactivar cualquier tabla habilitada', 'admin'),
  ('perm_admin_schema_read', 'admin.schema.read', 'Ver tablas y columnas', 'admin'),
  ('perm_security_roles_read', 'security.roles.read', 'Ver roles', 'seguridad'),
  ('perm_security_roles_write', 'security.roles.write', 'Crear y editar roles', 'seguridad'),
  ('perm_security_roles_delete', 'security.roles.delete', 'Borrar roles', 'seguridad'),
  ('perm_security_permissions_read', 'security.permissions.read', 'Ver permisos', 'seguridad'),
  ('perm_security_permissions_write', 'security.permissions.write', 'Crear permisos', 'seguridad'),
  ('perm_security_users_read', 'security.users.read', 'Ver usuarios', 'seguridad'),
  ('perm_security_users_write', 'security.users.write', 'Crear y editar usuarios', 'seguridad'),
  ('perm_security_users_delete', 'security.users.delete', 'Desactivar usuarios', 'seguridad'),
  ('perm_delivery_read', 'delivery.read', 'Ver reparto, clientes y recorridos', 'reparto'),
  ('perm_delivery_write', 'delivery.write', 'Crear y editar reparto', 'reparto'),
  ('perm_delivery_delete', 'delivery.delete', 'Eliminar/anular datos de reparto', 'reparto'),
  ('perm_delivery_close', 'delivery.close', 'Cerrar visitas y repartos', 'reparto'),
  ('perm_accounts_read', 'accounts.read', 'Ver cuentas corrientes', 'cuentas'),
  ('perm_accounts_write', 'accounts.write', 'Ajustar cuentas corrientes', 'cuentas')
on conflict (id) do update set clave = excluded.clave, descripcion = excluded.descripcion, modulo = excluded.modulo;

insert into public.app_role_permissions (id, role_id, permission_id)
select gen_random_uuid()::text, 'role_admin', p.id
from public.app_permissions p
on conflict (role_id, permission_id) do nothing;

insert into public.app_role_permissions (id, role_id, permission_id)
select gen_random_uuid()::text, 'role_repartidor', p.id
from public.app_permissions p
where p.clave in ('delivery.read','delivery.write','delivery.close','accounts.read')
on conflict (role_id, permission_id) do nothing;

insert into public.app_role_permissions (id, role_id, permission_id)
select gen_random_uuid()::text, 'role_consulta', p.id
from public.app_permissions p
where p.clave in ('delivery.read','accounts.read','admin.schema.read')
on conflict (role_id, permission_id) do nothing;

insert into public.app_users (id, email, nombre, role_id, status)
values ('user_admin', 'admin@panaderiarincon.local', 'Administrador', 'role_admin', 'active')
on conflict (id) do update set role_id = excluded.role_id, status = excluded.status;

commit;
