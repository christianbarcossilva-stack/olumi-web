-- Ondi 1.5 · integrador: un programa en una máquina virtual del cliente que revisa los equipos cargados a mano
-- y reporta hacia afuera (solo HTTPS de salida). Lo atiende la función ondi-integrador. Se puede correr más de una vez.

create table if not exists public.ondi_integradores (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  site_id text not null,
  token_hash text not null unique,                 -- sha256 del token; el token solo lo tiene el integrador
  estado text not null default 'activo' check (estado in ('activo', 'reemplazado', 'baja')),
  host text, so text, version text, ip text,
  creado timestamptz not null default now(),
  visto timestamptz,
  reporte jsonb not null default '{}'::jsonb,      -- último resumen: revisados, caídos, cola, sin internet
  reemplaza uuid,
  por uuid
);
create index if not exists ondi_integradores_site on public.ondi_integradores (org_id, site_id, estado);
create unique index if not exists ondi_integradores_uno on public.ondi_integradores (org_id, site_id) where estado = 'activo';
alter table public.ondi_integradores enable row level security;
revoke all on public.ondi_integradores from anon;
drop policy if exists ondi_in_ver on public.ondi_integradores;
create policy ondi_in_ver on public.ondi_integradores for select using (public.ondi_staff(org_id) or public.ondi_viewer(org_id, site_id) or public.ondi_super());

-- códigos de enlace: de un solo uso, vencen a las 24 horas
create table if not exists public.ondi_integrador_codigos (
  code text primary key,
  org_id uuid not null,
  site_id text not null,
  reemplaza uuid,
  por uuid,
  creado timestamptz not null default now()
);
alter table public.ondi_integrador_codigos enable row level security;
revoke all on public.ondi_integrador_codigos from anon, authenticated;

-- crea el código para conectar (o reemplazar) el integrador de un cliente
create or replace function public.ondi_integrador_codigo(o uuid, s text, reemplazar uuid default null) returns text
language plpgsql volatile security definer set search_path = public as $$
declare c text;
begin
  if not public.ondi_editor(o) then raise exception 'sin_permiso'; end if;
  if not exists (select 1 from ondi_sites where org_id = o and id = s) then raise exception 'sin_cliente'; end if;
  if reemplazar is not null and not exists (select 1 from ondi_integradores where id = reemplazar and org_id = o and site_id = s) then raise exception 'sin_integrador'; end if;
  delete from ondi_integrador_codigos where (org_id = o and site_id = s) or creado < now() - interval '24 hours';
  c := upper(substr(translate(encode(extensions.gen_random_bytes(12), 'base64'), '+/=0O1IL', ''), 1, 4) || '-' || substr(translate(encode(extensions.gen_random_bytes(12), 'base64'), '+/=0O1IL', ''), 1, 4));
  insert into ondi_integrador_codigos (code, org_id, site_id, reemplaza, por) values (c, o, s, reemplazar, auth.uid());
  return c;
end $$;

-- da de baja un integrador: deja de poder reportar
create or replace function public.ondi_integrador_baja(i uuid) returns void
language plpgsql volatile security definer set search_path = public as $$
declare r record;
begin
  select org_id, site_id into r from ondi_integradores where id = i;
  if r is null or not public.ondi_editor(r.org_id) then raise exception 'sin_permiso'; end if;
  update ondi_integradores set estado = 'baja' where id = i;
  update ondi_alertas set estado = 'cerrada', cerrada = now(), nota = 'Se dio de baja el integrador', actualizado = now()
    where org_id = r.org_id and site_id = r.site_id and uid = 'int:' || i and estado in ('nueva', 'notificada');
end $$;

-- cada 5 minutos: un integrador activo que no reporta hace más de 5 minutos abre una alerta (una sola vez)
create or replace function public.ondi_integradores_revisar() returns int
language plpgsql volatile security definer set search_path = public as $$
declare n int;
begin
  insert into ondi_alertas (org_id, site_id, uid, equipo, tipo, modelo, ip, desde)
  select i.org_id, i.site_id, 'int:' || i.id, 'Integrador de Ondi' || coalesce(' (' || i.host || ')', ''), 'integrador', i.version, i.ip, i.visto
  from ondi_integradores i where i.estado = 'activo' and i.visto < now() - interval '5 minutes'
    and not exists (select 1 from ondi_alertas a where a.org_id = i.org_id and a.site_id = i.site_id and a.uid = 'int:' || i.id and (a.estado in ('nueva', 'notificada') or a.desde >= i.visto))
  on conflict do nothing;
  get diagnostics n = row_count;
  return n;
end $$;
revoke execute on function public.ondi_integradores_revisar() from public, anon, authenticated;

do $$ begin
  perform cron.unschedule('ondi-integradores') where exists (select 1 from cron.job where jobname = 'ondi-integradores');
  perform cron.schedule('ondi-integradores', '*/5 * * * *', 'select public.ondi_integradores_revisar()');
exception when others then raise notice 'pg_cron no está: la alerta de integrador caído queda sin revisión automática';
end $$;

select 'listo' as ondi_1_5;
