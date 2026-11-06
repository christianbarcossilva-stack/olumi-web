-- Olumi 1.34 · Borrar una empresa entera y salir de una empresa.
-- Correr una sola vez en Supabase → SQL Editor (se puede volver a correr, no rompe nada).
--
--   admin_delete_org(o, nombre)  → Panel de Unity Tech: borra la empresa con todos sus datos.
--   delete_my_org(o, nombre)     → el dueño borra su propia empresa (Catálogo y ajustes → Equipo).
--   leave_org(o)                 → alguien sale de una empresa en la que está (no el dueño).
-- Para borrar hay que escribir el nombre exacto de la empresa (evita borrar la equivocada).
-- Todo lo que cuelga de la empresa (datos, equipo, invitaciones, soporte, WhatsApp) se borra solo (on delete cascade).
-- Los archivos subidos (fotos, planos) quedan en Storage → archivos/<id de la empresa>/ y se pueden borrar a mano.

create table if not exists public.orgs_borradas (
  id uuid primary key,
  name text,
  borrada_por uuid,
  borrada_en timestamptz not null default now(),
  datos int,
  usuarios int
);
alter table public.orgs_borradas enable row level security;
revoke all on public.orgs_borradas from anon, authenticated;

create or replace function public._borrar_org(o uuid, nombre text) returns void
language plpgsql security definer set search_path = public as $$
declare g record;
begin
  select * into g from orgs where id = o;
  if not found then raise exception 'no_existe'; end if;
  if lower(trim(coalesce(nombre, ''))) <> lower(trim(g.name)) then raise exception 'nombre_no_coincide'; end if;
  insert into orgs_borradas (id, name, borrada_por, datos, usuarios)
    values (g.id, g.name, auth.uid(), (select count(*) from docs where org_id = o), (select count(*) from members where org_id = o))
    on conflict (id) do nothing;
  delete from orgs where id = o;
end $$;
revoke execute on function public._borrar_org(uuid, text) from anon, authenticated, public;

create or replace function public.admin_delete_org(o uuid, nombre text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_platform_admin() then raise exception 'sin_permiso'; end if;
  perform public._borrar_org(o, nombre);
end $$;

create or replace function public.delete_my_org(o uuid, nombre text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from members where org_id = o and user_id = auth.uid() and role = 'owner') then raise exception 'sin_permiso'; end if;
  perform public._borrar_org(o, nombre);
end $$;

create or replace function public.leave_org(o uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from members where org_id = o and user_id = auth.uid() and role = 'owner') then raise exception 'es_dueno'; end if;
  delete from members where org_id = o and user_id = auth.uid();
end $$;

revoke execute on function public.admin_delete_org(uuid, text) from anon;
revoke execute on function public.delete_my_org(uuid, text) from anon;
revoke execute on function public.leave_org(uuid) from anon;
grant execute on function public.admin_delete_org(uuid, text) to authenticated;
grant execute on function public.delete_my_org(uuid, text) to authenticated;
grant execute on function public.leave_org(uuid) to authenticated;

select 'listo' as olumi_1_34;
