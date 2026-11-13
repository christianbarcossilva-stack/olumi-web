-- Estiba 1.0 · depósitos y la maqueta 3D de cada uno.
-- Usa las mismas cuentas y empresas de Olumi (tablas orgs y members). No toca nada de Olumi ni de Ondi.
-- Correr una sola vez en Supabase → SQL Editor (se puede volver a correr, no rompe nada). Termina con "listo".
--
-- Quién puede qué (rol en la empresa, el mismo de Olumi):
--   dueño / administrador    → crea y borra depósitos
--   encargado / técnico      → edita la maqueta y los datos del depósito
--   el resto del equipo      → ve todo, no cambia nada

create table if not exists public.estiba_depositos (
  org_id uuid not null references public.orgs(id) on delete cascade,
  id text not null default substr(md5(random()::text || clock_timestamp()::text), 1, 12),
  name text not null check (length(trim(name)) between 1 and 120),
  data jsonb not null default '{}'::jsonb,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (org_id, id)
);

create table if not exists public.estiba_maquetas (
  org_id uuid not null,
  deposito_id text not null,
  data jsonb not null default '{}'::jsonb,
  updated_by uuid default auth.uid(),
  updated_at timestamptz not null default now(),
  primary key (org_id, deposito_id),
  foreign key (org_id, deposito_id) references public.estiba_depositos(org_id, id) on delete cascade
);

create or replace function public.estiba_rol(o uuid) returns text
language sql stable security definer set search_path = public as $$
  select role from members where org_id = o and user_id = auth.uid() limit 1
$$;
create or replace function public.estiba_ve(o uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.estiba_rol(o) not in ('cliente', 'pendiente'), false)
$$;
create or replace function public.estiba_edita(o uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.estiba_rol(o) in ('owner', 'admin', 'encargado', 'tecnico'), false)
$$;
create or replace function public.estiba_admin(o uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.estiba_rol(o) in ('owner', 'admin'), false)
$$;

alter table public.estiba_depositos enable row level security;
alter table public.estiba_maquetas enable row level security;

drop policy if exists estiba_dep_ver on public.estiba_depositos;
create policy estiba_dep_ver on public.estiba_depositos for select using (public.estiba_ve(org_id));
drop policy if exists estiba_dep_alta on public.estiba_depositos;
create policy estiba_dep_alta on public.estiba_depositos for insert with check (public.estiba_admin(org_id));
drop policy if exists estiba_dep_cambio on public.estiba_depositos;
create policy estiba_dep_cambio on public.estiba_depositos for update using (public.estiba_edita(org_id)) with check (public.estiba_edita(org_id));
drop policy if exists estiba_dep_baja on public.estiba_depositos;
create policy estiba_dep_baja on public.estiba_depositos for delete using (public.estiba_admin(org_id));

drop policy if exists estiba_maq_ver on public.estiba_maquetas;
create policy estiba_maq_ver on public.estiba_maquetas for select using (public.estiba_ve(org_id));
drop policy if exists estiba_maq_alta on public.estiba_maquetas;
create policy estiba_maq_alta on public.estiba_maquetas for insert with check (public.estiba_edita(org_id));
drop policy if exists estiba_maq_cambio on public.estiba_maquetas;
create policy estiba_maq_cambio on public.estiba_maquetas for update using (public.estiba_edita(org_id)) with check (public.estiba_edita(org_id));

revoke all on public.estiba_depositos from anon;
revoke all on public.estiba_maquetas from anon;
grant select, insert, update, delete on public.estiba_depositos to authenticated;
grant select, insert, update on public.estiba_maquetas to authenticated;

create or replace function public.estiba_touch() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;
drop trigger if exists estiba_dep_touch on public.estiba_depositos;
create trigger estiba_dep_touch before update on public.estiba_depositos for each row execute function public.estiba_touch();
drop trigger if exists estiba_maq_touch on public.estiba_maquetas;
create trigger estiba_maq_touch before update on public.estiba_maquetas for each row execute function public.estiba_touch();

select 'listo' as estiba_1_0;
