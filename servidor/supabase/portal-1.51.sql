-- =====================================================================
-- Olumi 1.51 · Portal del cliente: varias personas por cliente, cada una con sus permisos,
-- quién pidió cada cosa y el botón «Reclamar».
-- Supabase → SQL Editor → New query → pegar todo → Run. Se puede correr más de una vez.
-- Compatible hacia atrás: la app 1.47 sigue andando igual (no usa nada de esto).
-- NO CORRER sin el OK de Christian.
-- =====================================================================

-- 1. Permisos de cada persona del cliente. Sin tocar nada, todos ven facturas y presupuestos
--    (como hasta hoy) y nadie administra. «admin» = puede ver y cambiar los permisos de su gente.
alter table public.members add column if not exists portal_perm jsonb not null default '{}'::jsonb;

create or replace function public.my_portal_perm(o uuid, k text) returns boolean
language sql security definer stable set search_path = public as $$
  select coalesce((select case when m.portal_perm ? k then (m.portal_perm->>k)::boolean else k <> 'admin' end
                     from members m where m.org_id = o and m.user_id = auth.uid() and m.role = 'cliente' limit 1), false)
$$;

-- 2. Qué lee el cliente (misma regla que 1.4, más los permisos de facturas y presupuestos)
create or replace function public.client_can_read(o uuid, c text, i text, d jsonb) returns boolean
language plpgsql security definer stable set search_path = public as $$
declare cid text;
begin
  cid := public.my_client_id(o);
  if cid is null then return false; end if;
  if c = 'config' then return i = 'empresa'; end if;
  if c = 'clientes' then return i = cid; end if;
  if c in ('proyectos', 'tickets', 'trabajos', 'equipos') then return d->>'clienteId' = cid; end if;
  if c = 'facturas' then return d->>'clienteId' = cid and public.my_portal_perm(o, 'facturas'); end if;
  if c = 'presupuestos' then return d->>'clienteId' = cid and coalesce(d->>'estado', 'borrador') <> 'borrador' and public.my_portal_perm(o, 'presupuestos'); end if;
  return false;
end $$;

-- 3. Aceptar o rechazar un presupuesto: igual que 1.1, solo si tiene permiso de presupuestos
create or replace function public.portal_quote(o uuid, qid text, acepta boolean, nombre text) returns void
language plpgsql security definer set search_path = public as $$
declare cid text; q jsonb;
begin
  cid := public.my_client_id(o);
  if cid is null or not public.my_portal_perm(o, 'presupuestos') then raise exception 'sin_permiso'; end if;
  select data into q from docs where org_id = o and col = 'presupuestos' and id = qid;
  if q is null or q->>'clienteId' <> cid or q->>'estado' <> 'enviado' then raise exception 'no_disponible'; end if;
  update docs set data = q || jsonb_build_object(
      'estado', case when acepta then 'aceptado' else 'rechazado' end,
      'respuestaPortal', jsonb_build_object('nombre', left(coalesce(nombre, ''), 120), 'en', (extract(epoch from now()) * 1000)::bigint, 'user', auth.uid())),
    updated_at = now()
  where org_id = o and col = 'presupuestos' and id = qid;
end $$;

-- 4. Cada pedido del portal guarda el nombre de quién lo pidió (lo ven sus compañeros y el equipo)
create or replace function public.ticket_portal_nombre() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.data ? 'portalUser' and coalesce(new.data->>'portalNombre', '') = '' then
    new.data := new.data || jsonb_build_object('portalNombre', coalesce((select nullif(trim(m.display_name), '') from members m
      where m.org_id = new.org_id and m.user_id::text = new.data->>'portalUser' limit 1), ''));
  end if;
  return new;
end $$;
drop trigger if exists ticket_portal_nombre on public.docs;
create trigger ticket_portal_nombre before insert on public.docs
  for each row when (new.col = 'tickets') execute function public.ticket_portal_nombre();
-- los pedidos que ya estaban
update public.docs d set data = d.data || jsonb_build_object('portalNombre', m.display_name)
  from public.members m
  where d.col = 'tickets' and d.data ? 'portalUser' and coalesce(d.data->>'portalNombre', '') = ''
    and m.org_id = d.org_id and m.user_id::text = d.data->>'portalUser' and coalesce(trim(m.display_name), '') <> '';

-- 5. Reclamar un pedido abierto (uno por día como máximo). Queda en el ticket: quién, cuándo y qué dijo.
create or replace function public.portal_reclamo(o uuid, tid text, texto text) returns void
language plpgsql security definer set search_path = public as $$
declare cid text; t jsonb; nom text; ahora bigint := (extract(epoch from now()) * 1000)::bigint;
begin
  cid := public.my_client_id(o);
  if cid is null then raise exception 'sin_permiso'; end if;
  select data into t from docs where org_id = o and col = 'tickets' and id = tid for update;
  if t is null or t->>'clienteId' <> cid then raise exception 'no_disponible'; end if;
  if coalesce(t->>'estado', 'nuevo') in ('resuelto', 'cerrado') then raise exception 'cerrado'; end if;
  if coalesce((t->>'reclamado')::bigint, 0) > ahora - 86400000 then raise exception 'ya_reclamado'; end if;
  select display_name into nom from members where org_id = o and user_id = auth.uid() limit 1;
  update docs set data = t || jsonb_build_object(
      'reclamado', ahora,
      'reclamos', coalesce(t->'reclamos', '[]'::jsonb) || jsonb_build_array(jsonb_build_object(
        'en', ahora, 'user', auth.uid(), 'nombre', coalesce(nom, ''), 'texto', left(coalesce(texto, ''), 1000))),
      'actualizado', ahora),
    updated_at = now()
  where org_id = o and col = 'tickets' and id = tid;
end $$;

-- 6. Las personas de un cliente y sus permisos: las ve y cambia el administrador de ese cliente o el equipo (dueño o admin)
create or replace function public.portal_people(o uuid, cid text default null) returns table (user_id uuid, display_name text, email text, portal_perm jsonb)
language plpgsql security definer stable set search_path = public as $$
declare c text;
begin
  if public.is_admin(o) then c := cid;
  elsif public.my_portal_perm(o, 'admin') then c := public.my_client_id(o);
  else raise exception 'sin_permiso'; end if;
  return query select m.user_id, m.display_name, m.email, m.portal_perm from members m
    where m.org_id = o and m.role = 'cliente' and m.client_id = c order by m.display_name;
end $$;

create or replace function public.portal_set_perm(o uuid, u uuid, p jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare c text; limpio jsonb := '{}'::jsonb; k text;
begin
  select client_id into c from members where org_id = o and user_id = u and role = 'cliente';
  if c is null then raise exception 'no_disponible'; end if;
  if not (public.is_admin(o) or (public.my_portal_perm(o, 'admin') and public.my_client_id(o) = c)) then raise exception 'sin_permiso'; end if;
  foreach k in array array['admin', 'facturas', 'presupuestos'] loop
    if p ? k then limpio := limpio || jsonb_build_object(k, (p->>k)::boolean); end if;
  end loop;
  update members set portal_perm = portal_perm || limpio where org_id = o and user_id = u;
end $$;

revoke execute on function public.my_portal_perm(uuid, text) from public, anon;
revoke execute on function public.portal_reclamo(uuid, text, text) from public, anon;
revoke execute on function public.portal_people(uuid, text) from public, anon;
revoke execute on function public.portal_set_perm(uuid, uuid, jsonb) from public, anon;
grant execute on function public.my_portal_perm(uuid, text) to authenticated;
grant execute on function public.portal_reclamo(uuid, text, text) to authenticated;
grant execute on function public.portal_people(uuid, text) to authenticated;
grant execute on function public.portal_set_perm(uuid, uuid, jsonb) to authenticated;

select 'listo' as olumi_portal_1_51;
