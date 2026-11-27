-- Motor de automatización de Unity Tech (reemplazo de n8n). Multiempresa: todo cuelga de org_id (la misma org de las apps).
-- Solo lo usa el motor con la clave de servicio: RLS prendido y sin políticas, así nadie más lo lee.

create table if not exists auto_flujos (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  receta text not null,                                   -- nombre del archivo en recetas/
  nombre text not null default '',
  prendido boolean not null default false,
  modo text not null default 'sombra' check (modo in ('sombra', 'real')),  -- sombra: hace todo menos mandar o registrar
  ajustes jsonb not null default '{}',
  token text not null unique default replace(gen_random_uuid()::text, '-', ''),  -- 32 letras al azar; va en la dirección del webhook
  creado timestamptz not null default now(),
  actualizado timestamptz not null default now()
);

create table if not exists auto_claves (                  -- claves de cada empresa, cifradas en el VPS (AES-256-GCM)
  org_id uuid not null,
  nombre text not null,
  valor text not null,
  actualizado timestamptz not null default now(),
  primary key (org_id, nombre)
);

create table if not exists auto_estado (                  -- lo que cada flujo recuerda (bloqueados, pidió parar, último aviso)
  flujo_id uuid not null references auto_flujos on delete cascade,
  clave text not null,
  valor jsonb not null,
  actualizado timestamptz not null default now(),
  primary key (flujo_id, clave)
);

create table if not exists auto_trabajos (                -- cola durable: un reinicio no pierde lo que estaba esperando
  id bigserial primary key,
  flujo_id uuid not null references auto_flujos on delete cascade,
  org_id uuid not null,
  paso text not null,
  datos jsonb not null default '{}',
  correr_en timestamptz not null default now(),
  intentos int not null default 0,
  estado text not null default 'pendiente' check (estado in ('pendiente', 'corriendo', 'listo', 'error')),
  tomado_en timestamptz,
  error text,
  creado timestamptz not null default now()
);
create index if not exists auto_trabajos_cola on auto_trabajos (correr_en) where estado = 'pendiente';

create table if not exists auto_ejecuciones (             -- registro de cada paso; se guarda 30 días
  id bigserial primary key,
  flujo_id uuid not null references auto_flujos on delete cascade,
  org_id uuid not null,
  trabajo_id bigint,
  paso text not null,
  estado text not null,                                   -- ok | fin | error | sombra
  ms int,
  gasto_usd numeric(10, 5) not null default 0,
  detalle jsonb,
  creado timestamptz not null default now()
);
create index if not exists auto_ejecuciones_org on auto_ejecuciones (org_id, creado desc);
create index if not exists auto_ejecuciones_flujo on auto_ejecuciones (flujo_id, creado desc);

create table if not exists auto_gasto (                   -- gasto de IA por empresa y por mes, con tope
  org_id uuid not null,
  mes text not null,                                      -- '2026-11'
  usd numeric(10, 5) not null default 0,
  tope_usd numeric(10, 2) not null default 20,
  primary key (org_id, mes)
);

alter table auto_flujos enable row level security;
alter table auto_claves enable row level security;
alter table auto_estado enable row level security;
alter table auto_trabajos enable row level security;
alter table auto_ejecuciones enable row level security;
alter table auto_gasto enable row level security;

-- Toma hasta n trabajos vencidos sin que dos motores agarren el mismo; respeta un máximo a la vez por empresa.
-- Los que quedaron "corriendo" más de 10 minutos (el motor se cayó) vuelven a la cola.
create or replace function auto_tomar(n int, por_empresa int default 3)
returns setof auto_trabajos language plpgsql security definer set search_path = public as $$
begin
  update auto_trabajos set estado = 'pendiente' where estado = 'corriendo' and tomado_en < now() - interval '10 minutes';
  return query
  with ocupadas as (select org_id, count(*) c from auto_trabajos where estado = 'corriendo' group by org_id),
  candidatos as (
    select t.id, row_number() over (partition by t.org_id order by t.correr_en) rn, coalesce(o.c, 0) c
    from auto_trabajos t left join ocupadas o using (org_id)
    where t.estado = 'pendiente' and t.correr_en <= now()
  ),
  elegidos as (
    select t.id from auto_trabajos t join candidatos k on k.id = t.id
    where k.rn + k.c <= por_empresa order by t.correr_en limit n for update of t skip locked
  )
  update auto_trabajos t set estado = 'corriendo', tomado_en = now(), intentos = t.intentos + 1
  from elegidos e where t.id = e.id returning t.*;
end $$;

-- Suma gasto y dice si la empresa todavía está bajo el tope.
create or replace function auto_sumar_gasto(org uuid, usd numeric)
returns boolean language sql security definer set search_path = public as $$
  insert into auto_gasto (org_id, mes, usd, tope_usd)   -- el tope pasa de un mes al siguiente
  values (org, to_char(now() at time zone 'America/Montevideo', 'YYYY-MM'), usd, coalesce((select g.tope_usd from auto_gasto g where g.org_id = org order by g.mes desc limit 1), 20))
  on conflict (org_id, mes) do update set usd = auto_gasto.usd + excluded.usd
  returning usd < tope_usd;
$$;

revoke all on function auto_tomar(int, int) from public, anon, authenticated;
revoke all on function auto_sumar_gasto(uuid, numeric) from public, anon, authenticated;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function auto_tomar(int, int), auto_sumar_gasto(uuid, numeric) to service_role;
  end if;
end $$;

-- ── Panel (unitytech.uy/admin/automatizacion): solo administradores de Unity Tech (is_platform_admin) ──
create table if not exists auto_motor (                   -- latido del motor: el panel muestra si está en línea
  id int primary key default 1 check (id = 1),
  visto timestamptz not null default now(),
  version text not null default ''
);
alter table auto_motor enable row level security;

create or replace function auto_panel()
returns json language plpgsql stable security definer set search_path = public as $$
begin
  if not coalesce(is_platform_admin(), false) then raise exception 'sin_permiso'; end if;
  return json_build_object(
    'ahora', now(),
    'motor', (select row_to_json(m) from auto_motor m),
    'flujos', coalesce((select json_agg(json_build_object('id', f.id, 'org', f.org_id, 'empresa', coalesce(o.name, '—'), 'receta', f.receta, 'nombre', f.nombre,
        'prendido', f.prendido, 'modo', f.modo, 'actualizado', f.actualizado,
        'hoy', (select count(*) from auto_ejecuciones e where e.flujo_id = f.id and e.creado > now() - interval '24 hours'),
        'errores', (select count(*) from auto_ejecuciones e where e.flujo_id = f.id and e.estado = 'error' and e.creado > now() - interval '24 hours'),
        'ultima', (select max(e.creado) from auto_ejecuciones e where e.flujo_id = f.id)) order by o.name, f.nombre)
      from auto_flujos f left join orgs o on o.id = f.org_id), '[]'),
    'cola', (select json_build_object('esperando', count(*) filter (where estado = 'pendiente'), 'corriendo', count(*) filter (where estado = 'corriendo'),
        'trabados', count(*) filter (where estado = 'error' and creado > now() - interval '7 days')) from auto_trabajos),
    'gasto', coalesce((select json_agg(json_build_object('org', g.org_id, 'empresa', coalesce(o.name, '—'), 'usd', g.usd, 'tope', g.tope_usd))
      from auto_gasto g left join orgs o on o.id = g.org_id where g.mes = to_char(now() at time zone 'America/Montevideo', 'YYYY-MM')), '[]'),
    'ejecuciones', coalesce((select json_agg(x order by x.creado desc) from (
      select e.id, e.flujo_id, coalesce(f.nombre, f.receta) flujo, coalesce(o.name, '—') empresa, e.paso, e.estado, e.ms, e.gasto_usd, e.detalle, e.creado
      from auto_ejecuciones e join auto_flujos f on f.id = e.flujo_id left join orgs o on o.id = e.org_id order by e.creado desc limit 150) x), '[]'));
end $$;

create or replace function auto_cambiar(flujo uuid, prender boolean default null, nuevo_modo text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not coalesce(is_platform_admin(), false) then raise exception 'sin_permiso'; end if;
  update auto_flujos set prendido = coalesce(prender, prendido), modo = coalesce(nuevo_modo, modo), actualizado = now() where id = flujo;
end $$;

create or replace function auto_poner_tope(org uuid, tope numeric)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not coalesce(is_platform_admin(), false) then raise exception 'sin_permiso'; end if;
  insert into auto_gasto (org_id, mes, tope_usd) values (org, to_char(now() at time zone 'America/Montevideo', 'YYYY-MM'), tope)
  on conflict (org_id, mes) do update set tope_usd = excluded.tope_usd;
end $$;

revoke all on function auto_panel(), auto_cambiar(uuid, boolean, text), auto_poner_tope(uuid, numeric) from public, anon;
grant execute on function auto_panel(), auto_cambiar(uuid, boolean, text), auto_poner_tope(uuid, numeric) to authenticated;
