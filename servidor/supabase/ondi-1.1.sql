-- Ondi 1.1 · ajustes de la empresa, plano de base por cliente, equipos cargados a mano y claves de más marcas.
-- Necesita ondi-1.0.sql. Se puede volver a correr. No toca nada de Olumi.

-- ---------- ajustes de la empresa (avisos, preferencias) ----------
create table if not exists public.ondi_ajustes (
  org_id uuid primary key references public.orgs(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_by uuid default auth.uid(),
  updated_at timestamptz not null default now()
);
alter table public.ondi_ajustes enable row level security;
drop policy if exists ondi_aj_ver on public.ondi_ajustes;
create policy ondi_aj_ver on public.ondi_ajustes for select using (public.ondi_staff(org_id));
drop policy if exists ondi_aj_alta on public.ondi_ajustes;
create policy ondi_aj_alta on public.ondi_ajustes for insert with check (public.ondi_admin(org_id));
drop policy if exists ondi_aj_cambio on public.ondi_ajustes;
create policy ondi_aj_cambio on public.ondi_ajustes for update using (public.ondi_admin(org_id)) with check (public.ondi_admin(org_id));
revoke all on public.ondi_ajustes from anon;
grant select, insert, update on public.ondi_ajustes to authenticated;

-- ---------- plano, foto o dibujo de base de cada maqueta (imagen chica, en JPEG) ----------
create table if not exists public.ondi_planos (
  org_id uuid not null,
  site_id text not null,
  data text not null check (length(data) < 4000000),
  updated_by uuid default auth.uid(),
  updated_at timestamptz not null default now(),
  primary key (org_id, site_id),
  foreign key (org_id, site_id) references public.ondi_sites(org_id, id) on delete cascade
);
alter table public.ondi_planos enable row level security;
drop policy if exists ondi_pl_ver on public.ondi_planos;
create policy ondi_pl_ver on public.ondi_planos for select using (public.ondi_staff(org_id) or public.ondi_viewer(org_id, site_id));
drop policy if exists ondi_pl_alta on public.ondi_planos;
create policy ondi_pl_alta on public.ondi_planos for insert with check (public.ondi_editor(org_id));
drop policy if exists ondi_pl_cambio on public.ondi_planos;
create policy ondi_pl_cambio on public.ondi_planos for update using (public.ondi_editor(org_id)) with check (public.ondi_editor(org_id));
drop policy if exists ondi_pl_baja on public.ondi_planos;
create policy ondi_pl_baja on public.ondi_planos for delete using (public.ondi_editor(org_id));
revoke all on public.ondi_planos from anon;
grant select, insert, update, delete on public.ondi_planos to authenticated;

-- ---------- equipos cargados a mano (marcas que se leen con el agente en la red del cliente) ----------
create table if not exists public.ondi_equipos (
  org_id uuid not null,
  site_id text not null,
  id text not null default substr(md5(random()::text || clock_timestamp()::text), 1, 10),
  marca text not null,
  tipo text not null,
  modelo text,
  nombre text not null,
  ip text,
  puerto int,
  ubicacion text,
  notas text,
  estado text not null default 'sin_dato',   -- sin_dato · en_linea · caido · atencion (lo actualiza el agente)
  visto timestamptz,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (org_id, site_id, id),
  foreign key (org_id, site_id) references public.ondi_sites(org_id, id) on delete cascade
);
alter table public.ondi_equipos enable row level security;
drop policy if exists ondi_eq_ver on public.ondi_equipos;
create policy ondi_eq_ver on public.ondi_equipos for select using (public.ondi_staff(org_id) or public.ondi_viewer(org_id, site_id));
drop policy if exists ondi_eq_alta on public.ondi_equipos;
create policy ondi_eq_alta on public.ondi_equipos for insert with check (public.ondi_editor(org_id));
drop policy if exists ondi_eq_cambio on public.ondi_equipos;
create policy ondi_eq_cambio on public.ondi_equipos for update using (public.ondi_editor(org_id)) with check (public.ondi_editor(org_id));
drop policy if exists ondi_eq_baja on public.ondi_equipos;
create policy ondi_eq_baja on public.ondi_equipos for delete using (public.ondi_editor(org_id));
revoke all on public.ondi_equipos from anon;
grant select, insert, update, delete on public.ondi_equipos to authenticated;

drop trigger if exists ondi_aj_touch on public.ondi_ajustes;
create trigger ondi_aj_touch before update on public.ondi_ajustes for each row execute function public.ondi_touch();
drop trigger if exists ondi_pl_touch on public.ondi_planos;
create trigger ondi_pl_touch before update on public.ondi_planos for each row execute function public.ondi_touch();
drop trigger if exists ondi_eq_touch on public.ondi_equipos;
create trigger ondi_eq_touch before update on public.ondi_equipos for each row execute function public.ondi_touch();

-- ---------- claves de más marcas (la de UniFi sigue igual) ----------
alter table public.ondi_secretos drop constraint if exists ondi_secretos_kind_check;
alter table public.ondi_secretos add constraint ondi_secretos_kind_check
  check (kind in ('unifi', 'meraki', 'omada', 'mikrotik', 'cisco', 'tplink', 'hikvision', 'dahua', 'intelbras', 'honeywell', 'agente'));

create or replace function public.ondi_set_clave(o uuid, alcance text, marca text, clave text) returns text
language plpgsql security definer set search_path = public as $$
declare sc text := coalesce(alcance, ''); k text := trim(coalesce(clave, '')); m text := lower(coalesce(marca, ''));
begin
  if not public.ondi_admin(o) then raise exception 'sin_permiso'; end if;
  if m not in ('unifi', 'meraki', 'omada', 'mikrotik', 'cisco', 'tplink', 'hikvision', 'dahua', 'intelbras', 'honeywell', 'agente') then raise exception 'marca_invalida'; end if;
  if sc <> '' and not exists (select 1 from ondi_sites where org_id = o and id = sc) then raise exception 'no_existe'; end if;
  if k = '' then delete from ondi_secretos where org_id = o and scope = sc and kind = m; return null; end if;
  if length(k) < 8 or length(k) > 500 then raise exception 'clave_invalida'; end if;
  insert into ondi_secretos (org_id, scope, kind, value, hint, updated_by, updated_at)
    values (o, sc, m, k, right(k, 4), auth.uid(), now())
    on conflict (org_id, scope, kind) do update set value = excluded.value, hint = excluded.hint, updated_by = excluded.updated_by, updated_at = now();
  return right(k, 4);
end $$;
revoke execute on function public.ondi_set_clave(uuid, text, text, text) from anon, public;
grant execute on function public.ondi_set_clave(uuid, text, text, text) to authenticated;

select 'listo' as ondi_1_1;
