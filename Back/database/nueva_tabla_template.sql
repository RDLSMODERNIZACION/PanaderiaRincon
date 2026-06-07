-- Plantilla para futuras tablas.
-- Cambiar "nombre_tabla" y columnas según corresponda.

begin;

create table if not exists public.nombre_tabla (
  id text primary key,
  nombre text not null,
  activo boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists nombre_tabla_touch_updated_at on public.nombre_tabla;
create trigger nombre_tabla_touch_updated_at
before update on public.nombre_tabla
for each row execute function public.touch_updated_at();

create index if not exists idx_nombre_tabla_activo on public.nombre_tabla(activo);

commit;
