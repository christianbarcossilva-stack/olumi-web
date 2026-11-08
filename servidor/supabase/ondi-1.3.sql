-- Ondi 1.3 · alertas con estados, contactos de aviso por cliente y revisión automática cada 5 minutos
-- Se puede correr más de una vez.

-- ---------- último estado conocido de cada equipo (para registrar cada caída una sola vez) ----------
create table if not exists public.ondi_equipos_estado (
  org_id uuid not null,
  site_id text not null,
  uid text not null,
  nombre text,
  tipo text,
  modelo text,
  ip text,
  estado text,
  desde timestamptz not null default now(),
  visto timestamptz not null default now(),
  silenciado boolean not null default false,
  primary key (org_id, site_id, uid)
);
alter table public.ondi_equipos_estado enable row level security;
drop policy if exists ondi_ee_ver on public.ondi_equipos_estado;
create policy ondi_ee_ver on public.ondi_equipos_estado for select using (public.ondi_staff(org_id) or public.ondi_viewer(org_id, site_id));

-- ---------- alertas: Nueva → Notificada (ticket en Olumi) → Atendida → Cerrada ----------
create table if not exists public.ondi_alertas (
  id bigint generated always as identity primary key,
  org_id uuid not null,
  site_id text not null,
  uid text not null,
  equipo text not null,
  tipo text,
  modelo text,
  ip text,
  estado text not null default 'nueva',
  desde timestamptz not null default now(),
  volvio timestamptz,
  cerrada timestamptz,
  ticket_id text,
  ticket_numero text,
  nota text,
  avisada timestamptz,
  avisos jsonb not null default '[]'::jsonb,
  por uuid,
  actualizado timestamptz not null default now()
);
alter table public.ondi_alertas drop constraint if exists ondi_alertas_estado_check;
alter table public.ondi_alertas add constraint ondi_alertas_estado_check check (estado in ('nueva', 'notificada', 'atendida', 'cerrada'));
create index if not exists ondi_alertas_org on public.ondi_alertas (org_id, estado, desde desc);
create unique index if not exists ondi_alertas_abierta on public.ondi_alertas (org_id, site_id, uid) where estado in ('nueva', 'notificada');
alter table public.ondi_alertas enable row level security;
drop policy if exists ondi_al_ver on public.ondi_alertas;
create policy ondi_al_ver on public.ondi_alertas for select using (public.ondi_staff(org_id) or public.ondi_viewer(org_id, site_id));

-- ---------- contactos de aviso de cada cliente ----------
create table if not exists public.ondi_contactos (
  id bigint generated always as identity primary key,
  org_id uuid not null,
  site_id text not null,
  nombre text not null default '',
  email text,
  whatsapp text,
  avisar boolean not null default true,
  creado timestamptz not null default now()
);
create index if not exists ondi_contactos_site on public.ondi_contactos (org_id, site_id);
alter table public.ondi_contactos enable row level security;
drop policy if exists ondi_ct_ver on public.ondi_contactos;
create policy ondi_ct_ver on public.ondi_contactos for select using (public.ondi_staff(org_id));
drop policy if exists ondi_ct_alta on public.ondi_contactos;
create policy ondi_ct_alta on public.ondi_contactos for insert with check (public.ondi_editor(org_id));
drop policy if exists ondi_ct_cambio on public.ondi_contactos;
create policy ondi_ct_cambio on public.ondi_contactos for update using (public.ondi_editor(org_id)) with check (public.ondi_editor(org_id));
drop policy if exists ondi_ct_baja on public.ondi_contactos;
create policy ondi_ct_baja on public.ondi_contactos for delete using (public.ondi_editor(org_id));

-- ---------- configuración del servidor (solo la lee el servidor) ----------
create table if not exists public.ondi_config (k text primary key, v text not null);
alter table public.ondi_config enable row level security;
revoke all on public.ondi_config from anon, authenticated;
insert into public.ondi_config (k, v) values ('cron', replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '')) on conflict (k) do nothing;

-- ---------- resumen del cliente sin pisar el resto de sus datos ----------
create or replace function public.ondi_set_resumen(o uuid, s text, res jsonb) returns void
language sql security definer set search_path = public as $$
  update ondi_sites set data = coalesce(data, '{}'::jsonb) || jsonb_build_object('resumen', res) where org_id = o and id = s
$$;
revoke all on function public.ondi_set_resumen(uuid, text, jsonb) from public, anon, authenticated;

-- ---------- lista de alertas (si el ticket de Olumi ya se resolvió, la alerta pasa a Atendida) ----------
create or replace function public.ondi_alertas_lista(o uuid, dias int default 30)
returns table (id bigint, site_id text, cliente text, uid text, equipo text, tipo text, modelo text, ip text, estado text,
  desde timestamptz, volvio timestamptz, cerrada timestamptz, ticket_numero text, ticket_estado text, nota text, avisada timestamptz, silenciado boolean)
language plpgsql security definer set search_path = public as $$
begin
  if not public.ondi_staff(o) then raise exception 'sin_permiso'; end if;
  if to_regclass('public.docs') is not null then
    update ondi_alertas a set estado = 'atendida', actualizado = now()
      from docs d where a.org_id = o and a.estado = 'notificada' and d.org_id = o and d.col = 'tickets' and d.id = a.ticket_id
        and d.data->>'estado' in ('resuelto', 'cerrado');
  end if;
  return query
    select a.id, a.site_id, s.name, a.uid, a.equipo, a.tipo, a.modelo, a.ip, a.estado, a.desde, a.volvio, a.cerrada, a.ticket_numero,
      case when to_regclass('public.docs') is null or a.ticket_id is null then null
        else (select d.data->>'estado' from docs d where d.org_id = o and d.col = 'tickets' and d.id = a.ticket_id) end,
      a.nota, a.avisada, coalesce(e.silenciado, false)
    from ondi_alertas a
    left join ondi_sites s on s.org_id = a.org_id and s.id = a.site_id
    left join ondi_equipos_estado e on e.org_id = a.org_id and e.site_id = a.site_id and e.uid = a.uid
    where a.org_id = o and (a.estado in ('nueva', 'notificada') or a.desde > now() - make_interval(days => greatest(dias, 1)))
    order by (a.estado in ('nueva', 'notificada')) desc, a.desde desc
    limit 500;
end $$;

-- ---------- cambiar el estado de una alerta ----------
create or replace function public.ondi_alerta_estado(a bigint, e text, n text default null) returns void
language plpgsql security definer set search_path = public as $$
declare r ondi_alertas;
begin
  select * into r from ondi_alertas where id = a;
  if r.id is null or not public.ondi_editor(r.org_id) then raise exception 'sin_permiso'; end if;
  if e not in ('nueva', 'notificada', 'atendida', 'cerrada') then raise exception 'estado_invalido'; end if;
  update ondi_alertas set estado = e, nota = coalesce(n, nota), por = auth.uid(), actualizado = now(),
    cerrada = case when e = 'cerrada' then now() else cerrada end where id = a;
  insert into ondi_actividad (org_id, site_id, user_id, email, que, detalle)
    values (r.org_id, r.site_id, auth.uid(), (select email from auth.users where id = auth.uid()), 'Alerta ' || e, r.equipo);
end $$;

-- ---------- no avisar más de un equipo (por ejemplo, uno que se apaga de noche) ----------
create or replace function public.ondi_silenciar(o uuid, s text, u text, si boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.ondi_editor(o) then raise exception 'sin_permiso'; end if;
  insert into ondi_equipos_estado (org_id, site_id, uid, silenciado) values (o, s, u, si)
    on conflict (org_id, site_id, uid) do update set silenciado = si;
  if si then update ondi_alertas set estado = 'cerrada', cerrada = now(), nota = coalesce(nota, 'Equipo silenciado'), actualizado = now()
    where org_id = o and site_id = s and uid = u and estado = 'nueva'; end if;
end $$;

-- ---------- clientes de Olumi (para enlazar cada cliente de Ondi con el suyo) ----------
create or replace function public.ondi_olumi_clientes(o uuid) returns table (id text, nombre text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.ondi_staff(o) then raise exception 'sin_permiso'; end if;
  if to_regclass('public.docs') is null then return; end if;
  return query execute 'select d.id::text, coalesce(d.data->>''nombre'', d.id::text) from docs d where d.org_id = $1 and d.col = ''clientes'' order by 2' using o;
end $$;

-- ---------- levantar el ticket en Olumi desde una alerta ----------
create or replace function public.ondi_alerta_ticket(a bigint, detalle text default null) returns text
language plpgsql security definer set search_path = public as $$
declare r ondi_alertas; s ondi_sites; num text; tid text := gen_random_uuid()::text; ms bigint := (extract(epoch from now()) * 1000)::bigint;
begin
  select * into r from ondi_alertas where id = a;
  if r.id is null or not public.ondi_editor(r.org_id) then raise exception 'sin_permiso'; end if;
  if r.ticket_id is not null then return r.ticket_numero; end if;
  if to_regclass('public.docs') is null then raise exception 'sin_olumi'; end if;
  select * into s from ondi_sites where org_id = r.org_id and id = r.site_id;
  execute 'select ''T-'' || lpad((coalesce(max(nullif(regexp_replace(data->>''numero'', ''\D'', '''', ''g''), '''')::int), 0) + 1)::text, 4, ''0'') from docs where org_id = $1 and col = ''tickets'''
    into num using r.org_id;
  execute 'insert into docs (org_id, col, id, data, updated_at) values ($1, ''tickets'', $2, $3, now())'
    using r.org_id, tid, jsonb_build_object(
      'numero', num, 'titulo', 'Equipo caído: ' || r.equipo || coalesce(' · ' || s.name, ''),
      'clienteId', coalesce(s.data->>'olumiCliente', ''), 'tipo', 'reclamo', 'estado', 'nuevo', 'origen', 'Ondi',
      'obra', coalesce(s.data->>'direccion', s.name, ''),
      'descripcion', coalesce(detalle, '') || case when detalle is null or detalle = '' then '' else E'\n\n' end
        || 'Alerta de Ondi: ' || r.equipo || coalesce(' (' || nullif(r.modelo, '') || ')', '') || coalesce(' · IP ' || nullif(r.ip, ''), '')
        || ' · caído desde ' || to_char(r.desde at time zone 'America/Montevideo', 'DD/MM HH24:MI'),
      'creado', ms, 'actualizado', ms, 'ondiAlerta', r.id, 'ondiCliente', r.site_id);
  update ondi_alertas set estado = 'notificada', ticket_id = tid, ticket_numero = num, por = auth.uid(), actualizado = now() where id = a;
  insert into ondi_actividad (org_id, site_id, user_id, email, que, detalle)
    values (r.org_id, r.site_id, auth.uid(), (select email from auth.users where id = auth.uid()), 'Ticket en Olumi', num || ' · ' || r.equipo);
  return num;
end $$;

revoke all on function public.ondi_alertas_lista(uuid, int) from public, anon;
revoke all on function public.ondi_alerta_estado(bigint, text, text) from public, anon;
revoke all on function public.ondi_silenciar(uuid, text, text, boolean) from public, anon;
revoke all on function public.ondi_olumi_clientes(uuid) from public, anon;
revoke all on function public.ondi_alerta_ticket(bigint, text) from public, anon;
grant execute on function public.ondi_alertas_lista(uuid, int), public.ondi_alerta_estado(bigint, text, text), public.ondi_silenciar(uuid, text, text, boolean),
  public.ondi_olumi_clientes(uuid), public.ondi_alerta_ticket(bigint, text) to authenticated;

-- ---------- revisión automática cada 5 minutos (llama a ondi-unifi con la clave interna) ----------
create extension if not exists pg_net;
create extension if not exists pg_cron;
select cron.unschedule(jobid) from cron.job where jobname = 'ondi-revisar';
select cron.schedule('ondi-revisar', '*/5 * * * *', $cron$
  select net.http_post(
    url := 'https://pgriavmcmscchxdnfglv.supabase.co/functions/v1/ondi-unifi',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-ondi-cron', (select v from public.ondi_config where k = 'cron')),
    body := '{"accion":"revisar"}'::jsonb,
    timeout_milliseconds := 60000)
$cron$);

select 'listo' as ondi_1_3;
