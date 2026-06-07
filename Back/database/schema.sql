-- Schema inicial para Panadería Backend
-- Compatible con Supabase PostgreSQL.
-- Ejecutar una vez desde Supabase SQL Editor o con: python scripts/apply_schema.py

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

create table if not exists public.business_settings (
  id text primary key default 'main',
  nombre text not null default 'Panadería',
  moneda text not null default 'ARS',
  alertas boolean not null default true,
  merma_max numeric(8, 4) not null default 0.06,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.products (
  id text primary key,
  nombre text not null,
  categoria text not null check (categoria in ('Panadería', 'Facturería', 'Pastelería', 'Sandwiches', 'Café')),
  unidad_venta text not null check (unidad_venta in ('u', 'kg')),
  precio_venta numeric(14, 2) not null default 0,
  costo_unitario numeric(14, 2) not null default 0,
  activo boolean not null default true,
  receta_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.supplies (
  id text primary key,
  nombre text not null,
  unidad text not null check (unidad in ('kg', 'g', 'l', 'u')),
  proveedor text not null default '',
  costo_unitario numeric(14, 2) not null default 0,
  stock_actual numeric(14, 3) not null default 0,
  stock_minimo numeric(14, 3) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.recipes (
  id text primary key,
  product_id text not null references public.products(id) on delete cascade,
  rinde_unidades numeric(14, 3) not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.recipe_items (
  id text primary key,
  recipe_id text not null references public.recipes(id) on delete cascade,
  supply_id text not null references public.supplies(id) on delete restrict,
  cantidad numeric(14, 4) not null,
  unidad text not null check (unidad in ('kg', 'g', 'l', 'u')),
  created_at timestamptz not null default now()
);

create table if not exists public.tickets (
  id text primary key,
  fecha timestamptz not null default now(),
  canal text not null check (canal in ('Mostrador', 'Delivery', 'Mayorista')),
  medio_pago text not null check (medio_pago in ('Efectivo', 'Débito', 'Crédito', 'QR')),
  descuento numeric(14, 2) not null default 0,
  total numeric(14, 2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ticket_items (
  id text primary key,
  ticket_id text not null references public.tickets(id) on delete cascade,
  product_id text not null references public.products(id) on delete restrict,
  cantidad numeric(14, 3) not null,
  precio_unitario numeric(14, 2) not null,
  created_at timestamptz not null default now()
);

create table if not exists public.production_batches (
  id text primary key,
  fecha timestamptz not null default now(),
  turno text not null check (turno in ('Mañana', 'Tarde', 'Noche')),
  product_id text not null references public.products(id) on delete restrict,
  planificado numeric(14, 3) not null default 0,
  producido numeric(14, 3) not null default 0,
  merma numeric(14, 3) not null default 0,
  nota text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.inventory_movements (
  id text primary key,
  fecha timestamptz not null default now(),
  supply_id text not null references public.supplies(id) on delete restrict,
  tipo text not null check (tipo in ('Entrada', 'Salida', 'Ajuste')),
  cantidad numeric(14, 3) not null,
  motivo text not null default '',
  referencia text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.employees (
  id text primary key,
  nombre text not null,
  rol text not null check (rol in ('Panadero', 'Ayudante', 'Vendedor', 'Pastelero', 'Delivery')),
  costo_hora numeric(14, 2) not null default 0,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.employee_shifts (
  id text primary key,
  fecha timestamptz not null default now(),
  employee_id text not null references public.employees(id) on delete restrict,
  horas numeric(8, 2) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.energy_records (
  id text primary key,
  fecha timestamptz not null default now(),
  horno text not null check (horno in ('Horno 1', 'Horno 2')),
  kwh numeric(14, 3) not null default 0,
  costo numeric(14, 2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Tabla preparada para futuras conexiones externas: sensores, balanzas, hornos, cajas, etc.
create table if not exists public.integration_connections (
  id text primary key,
  nombre text not null,
  tipo text not null,
  estado text not null default 'pendiente' check (estado in ('pendiente', 'activa', 'pausada', 'error')),
  config jsonb not null default '{}'::jsonb,
  ultimo_evento timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Triggers updated_at

drop trigger if exists business_settings_touch_updated_at on public.business_settings;
create trigger business_settings_touch_updated_at before update on public.business_settings for each row execute function public.touch_updated_at();

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

-- Índices
create index if not exists idx_products_activo on public.products(activo);
create index if not exists idx_products_categoria on public.products(categoria);
create index if not exists idx_supplies_stock on public.supplies(stock_actual, stock_minimo);
create index if not exists idx_recipes_product_id on public.recipes(product_id);
create index if not exists idx_recipe_items_recipe_id on public.recipe_items(recipe_id);
create index if not exists idx_recipe_items_supply_id on public.recipe_items(supply_id);
create index if not exists idx_tickets_fecha on public.tickets(fecha desc);
create index if not exists idx_tickets_canal on public.tickets(canal);
create index if not exists idx_ticket_items_ticket_id on public.ticket_items(ticket_id);
create index if not exists idx_ticket_items_product_id on public.ticket_items(product_id);
create index if not exists idx_production_batches_fecha on public.production_batches(fecha desc);
create index if not exists idx_production_batches_product_id on public.production_batches(product_id);
create index if not exists idx_inventory_movements_fecha on public.inventory_movements(fecha desc);
create index if not exists idx_inventory_movements_supply_id on public.inventory_movements(supply_id);
create index if not exists idx_employee_shifts_fecha on public.employee_shifts(fecha desc);
create index if not exists idx_employee_shifts_employee_id on public.employee_shifts(employee_id);
create index if not exists idx_energy_records_fecha on public.energy_records(fecha desc);
create index if not exists idx_integration_connections_tipo on public.integration_connections(tipo);

insert into public.business_settings (id, nombre, moneda, alertas, merma_max)
values ('main', 'Panadería', 'ARS', true, 0.0600)
on conflict (id) do nothing;

commit;
