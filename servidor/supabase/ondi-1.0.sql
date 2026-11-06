-- Ondi 1.0 · cuentas, clientes, maqueta por cliente, conexión con UniFi y acceso del IT del cliente.
-- Usa las mismas cuentas y empresas de Olumi (tablas orgs y members). No toca nada de Olumi.
-- Correr una sola vez en Supabase → SQL Editor (se puede volver a correr, no rompe nada).
--
-- Quién puede qué (rol en la empresa instaladora, el mismo de Olumi):
--   dueño / administrador            → crea y borra clientes, carga la clave de UniFi, da accesos
--   encargado / técnico              → edita la maqueta y los datos del cliente
--   solo lectura                     → ve todo, no cambia nada
--   IT del cliente (ondi_accesos)    → ve solo la maqueta y los equipos de SU cliente, sin cambiar nada
-- La clave de UniFi se guarda en ondi_secretos: nadie la puede leer desde la app, ni el dueño.
-- Solo la lee la función ondi-unifi en el servidor.

-- ---------- tablas ----------
create table if not exists public.ondi_sites (
  org_id uuid not null references public.orgs(id) on delete cascade,
  id text not null default substr(md5(random()::text || clock_timestamp()::text), 1, 12),
  name text not null check (length(trim(name)) between 1 and 120),
  data jsonb not null default '{}'::jsonb,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (org_id, id)
);

create table if not exists public.ondi_maquetas (
  org_id uuid not null,
  site_id text not null,
  data jsonb not null default '{}'::jsonb,
  updated_by uuid default auth.uid(),
  updated_at timestamptz not null default now(),
  primary key (org_id, site_id),
  foreign key (org_id, site_id) references public.ondi_sites(org_id, id) on delete cascade
);

create table if not exists public.ondi_secretos (
  org_id uuid not null references public.orgs(id) on delete cascade,
  scope text not null default '',            -- '' = toda la empresa; si no, el id del cliente
  kind text not null check (kind in ('unifi')),
  value text not null,
  hint text,                                  -- últimos 4 caracteres, para reconocerla
  updated_by uuid,
  updated_at timestamptz not null default now(),
  primary key (org_id, scope, kind)
);

create table if not exists public.ondi_accesos (
  org_id uuid not null,
  site_id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  email text,
  name text,
  created_at timestamptz not null default now(),
  primary key (org_id, site_id, user_id),
  foreign key (org_id, site_id) references public.ondi_sites(org_id, id) on delete cascade
);

create table if not exists public.ondi_codigos (
  code text primary key,
  org_id uuid not null,
  site_id text not null,
  created_by uuid,
  created_at timestamptz not null default now(),
  foreign key (org_id, site_id) references public.ondi_sites(org_id, id) on delete cascade
);
create unique index if not exists ondi_codigos_site on public.ondi_codigos (org_id, site_id);

create table if not exists public.ondi_intentos (
  user_id uuid not null,
  at timestamptz not null default now()
);
create index if not exists ondi_intentos_u on public.ondi_intentos (user_id, at);

-- ---------- quién es quién ----------
create or replace function public.ondi_rol(o uuid) returns text
language sql stable security definer set search_path = public as $$
  select role from members where org_id = o and user_id = auth.uid() limit 1
$$;
create or replace function public.ondi_staff(o uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.ondi_rol(o) not in ('cliente', 'pendiente'), false)
$$;
create or replace function public.ondi_editor(o uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.ondi_rol(o) in ('owner', 'admin', 'encargado', 'tecnico'), false)
$$;
create or replace function public.ondi_admin(o uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.ondi_rol(o) in ('owner', 'admin'), false)
$$;
create or replace function public.ondi_viewer(o uuid, s text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from ondi_accesos where org_id = o and site_id = s and user_id = auth.uid())
$$;

-- ---------- reglas de acceso ----------
alter table public.ondi_sites enable row level security;
alter table public.ondi_maquetas enable row level security;
alter table public.ondi_secretos enable row level security;
alter table public.ondi_accesos enable row level security;
alter table public.ondi_codigos enable row level security;
alter table public.ondi_intentos enable row level security;

drop policy if exists ondi_sites_ver on public.ondi_sites;
create policy ondi_sites_ver on public.ondi_sites for select using (public.ondi_staff(org_id) or public.ondi_viewer(org_id, id));
drop policy if exists ondi_sites_alta on public.ondi_sites;
create policy ondi_sites_alta on public.ondi_sites for insert with check (public.ondi_admin(org_id));
drop policy if exists ondi_sites_cambio on public.ondi_sites;
create policy ondi_sites_cambio on public.ondi_sites for update using (public.ondi_editor(org_id)) with check (public.ondi_editor(org_id));
drop policy if exists ondi_sites_baja on public.ondi_sites;
create policy ondi_sites_baja on public.ondi_sites for delete using (public.ondi_admin(org_id));

drop policy if exists ondi_maq_ver on public.ondi_maquetas;
create policy ondi_maq_ver on public.ondi_maquetas for select using (public.ondi_staff(org_id) or public.ondi_viewer(org_id, site_id));
drop policy if exists ondi_maq_alta on public.ondi_maquetas;
create policy ondi_maq_alta on public.ondi_maquetas for insert with check (public.ondi_editor(org_id));
drop policy if exists ondi_maq_cambio on public.ondi_maquetas;
create policy ondi_maq_cambio on public.ondi_maquetas for update using (public.ondi_editor(org_id)) with check (public.ondi_editor(org_id));

drop policy if exists ondi_acc_ver on public.ondi_accesos;
create policy ondi_acc_ver on public.ondi_accesos for select using (public.ondi_staff(org_id) or user_id = auth.uid());
drop policy if exists ondi_acc_baja on public.ondi_accesos;
create policy ondi_acc_baja on public.ondi_accesos for delete using (public.ondi_admin(org_id) or user_id = auth.uid());

-- secretos, códigos e intentos: sin reglas = nadie los lee desde la app
revoke all on public.ondi_secretos from anon, authenticated;
revoke all on public.ondi_codigos from anon, authenticated;
revoke all on public.ondi_intentos from anon, authenticated;
revoke all on public.ondi_sites from anon;
revoke all on public.ondi_maquetas from anon;
revoke all on public.ondi_accesos from anon;
grant select, insert, update, delete on public.ondi_sites to authenticated;
grant select, insert, update on public.ondi_maquetas to authenticated;
grant select, delete on public.ondi_accesos to authenticated;

-- fecha de último cambio
create or replace function public.ondi_touch() returns trigger language plpgsql as $$
begin new.updated_at = now(); if tg_table_name = 'ondi_maquetas' then new.updated_by = auth.uid(); end if; return new; end $$;
drop trigger if exists ondi_sites_touch on public.ondi_sites;
create trigger ondi_sites_touch before update on public.ondi_sites for each row execute function public.ondi_touch();
drop trigger if exists ondi_maq_touch on public.ondi_maquetas;
create trigger ondi_maq_touch before insert or update on public.ondi_maquetas for each row execute function public.ondi_touch();

-- ---------- clave de UniFi ----------
-- scope '' = la cuenta UniFi de la instaladora (sirve para todos sus clientes); o el id de un cliente con cuenta propia.
create or replace function public.ondi_set_unifi(o uuid, alcance text, clave text) returns text
language plpgsql security definer set search_path = public as $$
declare sc text := coalesce(alcance, ''); k text := trim(coalesce(clave, ''));
begin
  if not public.ondi_admin(o) then raise exception 'sin_permiso'; end if;
  if sc <> '' and not exists (select 1 from ondi_sites where org_id = o and id = sc) then raise exception 'no_existe'; end if;
  if k = '' then delete from ondi_secretos where org_id = o and scope = sc and kind = 'unifi'; return null; end if;
  if length(k) < 20 or length(k) > 200 or k ~ '\s' then raise exception 'clave_invalida'; end if;
  insert into ondi_secretos (org_id, scope, kind, value, hint, updated_by, updated_at)
    values (o, sc, 'unifi', k, right(k, 4), auth.uid(), now())
    on conflict (org_id, scope, kind) do update set value = excluded.value, hint = excluded.hint, updated_by = excluded.updated_by, updated_at = now();
  return right(k, 4);
end $$;

create or replace function public.ondi_claves(o uuid) returns table (scope text, kind text, hint text, updated_at timestamptz)
language sql stable security definer set search_path = public as $$
  select s.scope, s.kind, s.hint, s.updated_at from ondi_secretos s where s.org_id = o and public.ondi_staff(o)
$$;

-- ---------- acceso del IT del cliente ----------
create or replace function public.ondi_codigo(o uuid, s text, renovar boolean default false) returns text
language plpgsql security definer set search_path = public as $$
declare c text; abc text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; i int;
begin
  if not public.ondi_admin(o) then raise exception 'sin_permiso'; end if;
  if not exists (select 1 from ondi_sites where org_id = o and id = s) then raise exception 'no_existe'; end if;
  if not coalesce(renovar, false) then select code into c from ondi_codigos where org_id = o and site_id = s; if c is not null then return c; end if; end if;
  delete from ondi_codigos where org_id = o and site_id = s;
  loop
    c := '';
    for i in 1..8 loop c := c || substr(abc, 1 + floor(random() * length(abc))::int, 1); if i = 4 then c := c || '-'; end if; end loop;
    exit when not exists (select 1 from ondi_codigos where code = c);
  end loop;
  insert into ondi_codigos (code, org_id, site_id, created_by) values (c, o, s, auth.uid());
  return c;
end $$;

create or replace function public.ondi_sin_codigo(o uuid, s text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.ondi_admin(o) then raise exception 'sin_permiso'; end if;
  delete from ondi_codigos where org_id = o and site_id = s;
end $$;

create or replace function public.ondi_join(code text, my_name text) returns json
language plpgsql security definer set search_path = public as $$
declare k record; mail text; c text := upper(trim(coalesce(code, '')));
begin
  if auth.uid() is null then raise exception 'sin_sesion'; end if;
  if (select count(*) from ondi_intentos where user_id = auth.uid() and at > now() - interval '1 hour') >= 10 then raise exception 'demasiados_intentos'; end if;
  insert into ondi_intentos (user_id) values (auth.uid());
  if c !~ '-' and length(c) = 8 then c := substr(c, 1, 4) || '-' || substr(c, 5, 4); end if;
  select * into k from ondi_codigos where ondi_codigos.code = c;
  if not found then return null; end if;  -- null = código inválido (así el intento queda contado)
  select email into mail from auth.users where id = auth.uid();
  insert into ondi_accesos (org_id, site_id, user_id, email, name)
    values (k.org_id, k.site_id, auth.uid(), mail, nullif(trim(coalesce(my_name, '')), ''))
    on conflict (org_id, site_id, user_id) do update set name = coalesce(excluded.name, ondi_accesos.name);
  return json_build_object('org_id', k.org_id, 'site_id', k.site_id);
end $$;

-- clientes que ve el IT del cliente (con el nombre de la instaladora)
create or replace function public.ondi_mis_accesos() returns table (org_id uuid, site_id text, site_name text, org_name text)
language sql stable security definer set search_path = public as $$
  select a.org_id, a.site_id, s.name, g.name from ondi_accesos a
    join ondi_sites s on s.org_id = a.org_id and s.id = a.site_id
    join orgs g on g.id = a.org_id
  where a.user_id = auth.uid()
$$;

revoke execute on function public.ondi_set_unifi(uuid, text, text) from anon, public;
revoke execute on function public.ondi_claves(uuid) from anon, public;
revoke execute on function public.ondi_codigo(uuid, text, boolean) from anon, public;
revoke execute on function public.ondi_sin_codigo(uuid, text) from anon, public;
revoke execute on function public.ondi_join(text, text) from anon, public;
revoke execute on function public.ondi_mis_accesos() from anon, public;
grant execute on function public.ondi_set_unifi(uuid, text, text) to authenticated;
grant execute on function public.ondi_claves(uuid) to authenticated;
grant execute on function public.ondi_codigo(uuid, text, boolean) to authenticated;
grant execute on function public.ondi_sin_codigo(uuid, text) to authenticated;
grant execute on function public.ondi_join(text, text) to authenticated;
grant execute on function public.ondi_mis_accesos() to authenticated;

select 'listo' as ondi_1_0,
  (select count(*) from public.ondi_sites) as clientes,
  (select count(*) from public.ondi_secretos) as claves_unifi;
