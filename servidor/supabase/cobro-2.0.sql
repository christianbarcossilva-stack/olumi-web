-- Unity Tech · cobro 2.0: una sola cuenta de Mercado Pago para Olumi, Ondi y Kliva.
-- NO SE APLICA sin el «sí» de Christian (cambia la base).
--
-- Qué hace:
--  1. cobro_ajustes: los días de gracia (14), los días de los avisos (1, 5 y 10) y si los avisos
--     a clientes están prendidos (arrancan APAGADOS: primero se cobra a mano).
--  2. org_plan (Olumi): la gracia sale de cobro_ajustes en vez de estar fija en 30 días.
--  3. cobro_planes: los planes de Ondi y Kliva (Olumi sigue con su tabla «plans»).
--     Se cargan apagados (activo = false) hasta que Christian apruebe los precios.
--  4. suscripciones: el plan pago de cada empresa en Ondi y Kliva (Olumi sigue en «orgs»).
--  5. cobro_estado(org, app): al día / aviso / suspendido, para el cartel dentro de cada app
--     y para el panel de Unity Tech.
-- Nada se borra: suspender es «solo para mirar», y al pagar vuelve todo.

-- 1. Ajustes ---------------------------------------------------------------
create table if not exists public.cobro_ajustes (
  clave text primary key,
  valor jsonb not null,
  nota text
);
alter table public.cobro_ajustes enable row level security;
insert into public.cobro_ajustes (clave, valor, nota) values
  ('gracia_dias',    '14',       'Días después de la fecha pagada hasta pasar a «solo para mirar»'),
  ('avisos_dias',    '[1,5,10]', 'Días de atraso en que sale cada aviso'),
  ('avisos_activos', 'false',    'false = los avisos quedan en el registro para Christian y no le llegan al cliente'),
  ('cobrar_en',      '"auto"',   'auto = se intenta en dólares; si Mercado Pago no acepta dólares, se cobra en pesos al dólar BROU. También: "USD" o "UYU"'),
  ('cotizacion',     '{"usd_uyu": null, "fecha": null, "fuente": "BROU, dólar billete, venta"}',
                                 'La actualiza cobro-avisos cada día desde brou.com.uy/cotizaciones')
on conflict (clave) do nothing;

create or replace function public.cobro_gracia() returns int
language sql stable security definer set search_path to 'public' as $$
  select coalesce((select (valor #>> '{}')::int from cobro_ajustes where clave = 'gracia_dias'), 14)
$$;

-- 2. Olumi: la gracia ahora sale de los ajustes -----------------------------
create or replace function public.org_plan(o uuid) returns text
language sql stable security definer set search_path to 'public' as $$
  select case
    when g.founder then g.plan
    when g.plan <> 'gratis' and g.paid_until is not null
         and g.paid_until + make_interval(days => cobro_gracia()) > now() then g.plan
    when g.trial_ends is not null and g.trial_ends > now() then 'pro'
    else 'gratis' end
  from orgs g where g.id = o
$$;

-- 3. Planes de Ondi y Kliva --------------------------------------------------
create table if not exists public.cobro_planes (
  app text not null check (app in ('ondi', 'kliva')),
  id text not null,
  nombre text not null,
  precio_usd numeric not null,           -- sin IVA, el que se publica
  monto numeric not null,                -- con IVA, lo que cobra la tarjeta por mes
  moneda text not null default 'USD',
  extra_nombre text,                     -- «equipo extra», «sitio extra»…
  extra_monto numeric not null default 0,-- con IVA, por cada extra y por mes
  activo boolean not null default false, -- se prende cuando Christian aprueba el precio
  orden int not null default 0,
  primary key (app, id)
);
alter table public.cobro_planes enable row level security;
drop policy if exists cobro_planes_leer on public.cobro_planes;
create policy cobro_planes_leer on public.cobro_planes for select using (activo);

-- Propuestas de precios.md (Ondi, sección 4) y kliva-precios-2611.md. APAGADAS.
insert into public.cobro_planes (app, id, nombre, precio_usd, monto, extra_nombre, extra_monto, orden) values
  ('ondi',  'chico',       'Sitio chico',  29,  35.38, null, 0, 1),
  ('ondi',  'mediano',     'Sitio mediano',59,  71.98, null, 0, 2),
  ('ondi',  'grande',      'Sitio grande', 149, 181.78, null, 0, 3),
  ('kliva', 'basico',      'Básico',       39,  47.58, 'equipo extra', 6.10, 1),
  ('kliva', 'pro',         'Pro',          99, 120.78, 'equipo extra', 6.10, 2),
  ('kliva', 'empresa',     'Empresa',     199, 242.78, 'equipo extra', 6.10, 3),
  ('kliva', 'instaladora', 'Instaladora', 299, 364.78, 'equipo extra', 6.10, 4)
on conflict (app, id) do nothing;

-- 4. Suscripciones de Ondi y Kliva -------------------------------------------
create table if not exists public.suscripciones (
  org_id uuid not null references public.orgs(id) on delete cascade,
  app text not null check (app in ('ondi', 'kliva')),
  plan text not null,
  ciclo text not null default 'mensual' check (ciclo in ('mensual', 'anual')),
  extra int not null default 0,
  cantidad int not null default 1,       -- Ondi: cuántos sitios de ese tamaño
  pago_hasta timestamptz,
  mp_preapproval_id text,
  mp_status text,
  manual boolean not null default false, -- true = paga por transferencia (lo marca Christian)
  updated_at timestamptz not null default now(),
  primary key (org_id, app)
);
alter table public.suscripciones enable row level security;
drop policy if exists suscripciones_leer on public.suscripciones;
create policy suscripciones_leer on public.suscripciones for select using (
  exists (select 1 from members m where m.org_id = suscripciones.org_id
          and m.user_id = auth.uid() and m.role in ('owner', 'admin'))
);
-- Escribe solo el servidor (aviso de cobro de Mercado Pago y el panel de Unity Tech).

-- billing_events ya existe (Olumi). Se le suma de qué app es cada movimiento.
alter table public.billing_events add column if not exists app text not null default 'olumi';

-- 5. Estado de cobro ----------------------------------------------------------
-- etapa: al_dia | prueba | atrasado | aviso_10 | suspendido | gratis | fundador
create or replace function public.cobro_estado(o uuid, a text default 'olumi') returns jsonb
language plpgsql stable security definer set search_path to 'public' as $$
declare
  hasta timestamptz; fundador boolean; plan text; trial timestamptz; dias int; g int := cobro_gracia();
  etapa text;
begin
  -- solo gente de esa empresa (o el servidor)
  if auth.uid() is not null and not exists (select 1 from members m where m.org_id = o and m.user_id = auth.uid()) then
    return null;
  end if;
  if a = 'olumi' then
    select x.paid_until, x.founder, x.plan, x.trial_ends into hasta, fundador, plan, trial from orgs x where x.id = o;
  else
    select s.pago_hasta, false, s.plan, null into hasta, fundador, plan, trial from suscripciones s where s.org_id = o and s.app = a;
    select x.founder into fundador from orgs x where x.id = o;
  end if;
  if coalesce(fundador, false) then return jsonb_build_object('etapa', 'fundador', 'plan', plan); end if;
  if hasta is null then
    etapa := case when trial is not null and trial > now() then 'prueba' else 'gratis' end;
    return jsonb_build_object('etapa', etapa, 'plan', plan, 'prueba_hasta', trial);
  end if;
  dias := greatest(0, floor(extract(epoch from (now() - hasta)) / 86400)::int);
  etapa := case
    when hasta > now() then 'al_dia'
    when dias >= g then 'suspendido'
    when dias >= 10 then 'aviso_10'
    else 'atrasado' end;
  return jsonb_build_object('etapa', etapa, 'plan', plan, 'pago_hasta', hasta,
    'dias_atraso', case when hasta > now() then 0 else dias end,
    'suspende_el', hasta + make_interval(days => g));
end $$;
grant execute on function public.cobro_estado(uuid, text) to authenticated;

-- 6. Una vez por día (09:07 de Uruguay) se revisan los atrasos ------------------
-- La función cobro-avisos se puede llamar sin clave: cada aviso sale una sola vez
-- por fecha de pago, y mientras avisos_activos sea false no le llega nada a ningún cliente.
select cron.unschedule('cobro-avisos') where exists (select 1 from cron.job where jobname = 'cobro-avisos');
select cron.schedule('cobro-avisos', '7 12 * * *', $$
  select net.http_post(url := 'https://pgriavmcmscchxdnfglv.supabase.co/functions/v1/cobro-avisos',
                       headers := '{"content-type":"application/json"}'::jsonb, body := '{}'::jsonb)
$$);

-- 7. Cuánto vale en dólares (con IVA, por mes o por año) la suscripción de una empresa ---------
create or replace function public.cobro_monto_usd(a text, p text, ciclo text, extra int, cantidad int default 1)
returns numeric language sql stable security definer set search_path to 'public' as $$
  select round(((base + coalesce(extra, 0) * ex) * greatest(coalesce(cantidad, 1), 1)
         * case when ciclo = 'anual' then 10 else 1 end)::numeric, 2)
  from (
    select charge_amount as base, extra_user_amount as ex from plans where a = 'olumi' and id = p
    union all
    select monto, extra_monto from cobro_planes where a <> 'olumi' and app = a and id = p
  ) x
$$;
