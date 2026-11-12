-- Olumi 1.51 · Calendario
-- 1) Eventos privados: un evento marcado "privado" lo ve y lo cambia solo su dueño.
-- 2) Olumi en el calendario del teléfono: cada persona tiene una dirección propia (con una llave larga)
--    que el calendario del iPhone, Google Calendar u Outlook leen solos. La sirve la función "agenda".
-- Correr una vez en Supabase → SQL Editor → Run. Tiene que decir "listo". Se puede volver a correr.

-- 1) Eventos privados (regla que se suma a las que ya hay: no abre nada, solo cierra)
drop policy if exists docs_eventos_privados on public.docs;
create policy docs_eventos_privados on public.docs as restrictive for all
  using (col <> 'eventos' or coalesce(data->>'privado', '') <> 'true' or data->>'de' = auth.uid()::text)
  with check (col <> 'eventos' or coalesce(data->>'privado', '') <> 'true' or data->>'de' = auth.uid()::text);

-- 2) La llave de la dirección de cada persona
create table if not exists public.cal_tokens (
  token   text primary key check (token ~ '^[A-Za-z0-9_-]{32,80}$'),
  user_id uuid not null references auth.users(id) on delete cascade,
  org_id  uuid not null references public.orgs(id) on delete cascade,
  alcance text not null default 'mio' check (alcance in ('mio', 'equipo')),
  creado  timestamptz not null default now(),
  usado   timestamptz,
  unique (user_id, org_id)
);
alter table public.cal_tokens enable row level security;
drop policy if exists cal_tokens_mio on public.cal_tokens;
create policy cal_tokens_mio on public.cal_tokens for all
  using (user_id = auth.uid() and public.is_member(org_id))
  with check (user_id = auth.uid() and public.is_member(org_id));
revoke all on public.cal_tokens from anon;
grant select, insert, update, delete on public.cal_tokens to authenticated;

select 'listo' as resultado;
