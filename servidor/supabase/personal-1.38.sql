-- Olumi 1.38 · Ficha de personal y sueldos aparte.
-- Correr una sola vez en Supabase → SQL Editor → Run (se puede volver a correr, no rompe nada).
--
--   · La ficha de cada persona (colección "tecnicos") la ven y la cargan el dueño, los administradores y Administración.
--     Cada persona ve la suya.
--   · La primera vez que entra, cada persona puede completar SU ficha una sola vez (queda "completada");
--     después la actualiza Administración (por ejemplo, cuando renueva el carné de salud).
--   · Los sueldos y el valor hora van en una colección aparte ("sueldos") que solo ven el dueño,
--     los administradores y Administración. Ni el técnico ni el encargado ven plata de nadie.

create or replace function public.is_rrhh(o uuid) returns boolean
language sql security definer stable set search_path = public as $$
  select exists (select 1 from members where org_id = o and user_id = auth.uid() and role in ('owner', 'admin', 'administracion'))
     or public.is_soporte(o)
$$;

-- su propia ficha, mientras no esté completada
create or replace function public.ficha_propia_ok(o uuid, c text, i text) returns boolean
language sql security definer stable set search_path = public as $$
  select c = 'tecnicos' and i = auth.uid()::text and public.is_staff(o)
     and not exists (select 1 from docs d where d.org_id = o and d.col = 'tecnicos' and d.id = i and coalesce(d.data->>'completada', '') = 'true')
$$;

create or replace function public.can_write_col(o uuid, c text) returns boolean
language sql security definer stable set search_path = public as $$
  select public.can_write(o)
    and (c not in ('presupuestos', 'facturas') or public.org_has(o, c))
    and (c not in ('presupuestos', 'facturas', 'oportunidades')
         or exists (select 1 from members where org_id = o and user_id = auth.uid() and role in ('owner', 'admin', 'encargado', 'ventas', 'administracion')))
    and (c <> 'config' or public.is_lead(o))
    and (c <> 'tecnicos' or public.is_rrhh(o))
    and (c <> 'sueldos' or public.is_rrhh(o))
    and (c not in ('depositos', 'movimientos', 'equipos') or public.org_has(o, 'inventario'))
    and (c <> 'cuadrillas' or public.is_lead(o))
$$;

drop policy if exists docs_read on public.docs;
create policy docs_read on public.docs for select
  using ((public.is_staff(org_id)
           and (col <> 'tecnicos' or public.is_rrhh(org_id) or public.is_lead(org_id) or id = auth.uid()::text)
           and (col <> 'sueldos' or public.is_rrhh(org_id)))
         or public.sub_can_read(org_id, col, id, data));

drop policy if exists docs_insert on public.docs;
create policy docs_insert on public.docs for insert
  with check (public.can_write_col(org_id, col) or public.sub_can_save(org_id, col, id, data) or public.ficha_propia_ok(org_id, col, id));
drop policy if exists docs_update on public.docs;
create policy docs_update on public.docs for update
  using (public.can_write_col(org_id, col) or public.sub_can_read(org_id, col, id, data) or public.ficha_propia_ok(org_id, col, id))
  with check (public.can_write_col(org_id, col) or public.sub_can_save(org_id, col, id, data) or public.ficha_propia_ok(org_id, col, id));

-- Lo que había de plata en la ficha pasa a "sueldos" (una vez) y se borra de la ficha
insert into docs (org_id, col, id, data)
  select d.org_id, 'sueldos', d.id, jsonb_strip_nulls(jsonb_build_object('valorHora', d.data->'valorHora', 'valorExtra', d.data->'valorExtra', 'moneda', d.data->'moneda'))
  from docs d
  where d.col = 'tecnicos' and (d.data ? 'valorHora' or d.data ? 'valorExtra')
  on conflict do nothing;
update docs set data = data - 'valorHora' - 'valorExtra' - 'moneda'
  where col = 'tecnicos' and (data ? 'valorHora' or data ? 'valorExtra' or data ? 'moneda');

revoke execute on function public.is_rrhh(uuid) from anon;
revoke execute on function public.ficha_propia_ok(uuid, text, text) from anon;
grant execute on function public.is_rrhh(uuid) to authenticated;

select 'listo' as olumi_1_38,
  (select count(*) from docs where col = 'sueldos') as sueldos,
  (select count(*) from docs where col = 'tecnicos') as fichas;
