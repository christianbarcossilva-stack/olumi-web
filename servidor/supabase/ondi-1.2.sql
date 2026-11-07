-- Ondi 1.2 · Ondi como app propia (separada de Olumi en la app), permisos del cliente, pedidos de ayuda,
-- solicitudes de acceso, actividad y panel de control de Unity Tech.
-- Necesita ondi-1.0.sql y ondi-1.1.sql. Se puede volver a correr. Lee orgs y members de Olumi, pero no les cambia nada.

-- ---------- empresas que usan Ondi ----------
create table if not exists public.ondi_empresas (
  org_id uuid primary key references public.orgs(id) on delete cascade,
  plan text not null default 'prueba',
  activo boolean not null default true,
  notas text,
  created_at timestamptz not null default now()
);
alter table public.ondi_empresas enable row level security;
drop policy if exists ondi_emp_ver on public.ondi_empresas;
create policy ondi_emp_ver on public.ondi_empresas for select using (exists (select 1 from public.members m where m.org_id = ondi_empresas.org_id and m.user_id = auth.uid()));
revoke all on public.ondi_empresas from anon;
grant select on public.ondi_empresas to authenticated;
-- las que ya tienen clientes en Ondi quedan adentro
insert into public.ondi_empresas (org_id) select distinct org_id from public.ondi_sites on conflict do nothing;

-- ---------- administradores de Unity Tech y modo soporte ----------
create table if not exists public.ondi_super (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text,
  created_at timestamptz not null default now()
);
alter table public.ondi_super enable row level security;
revoke all on public.ondi_super from anon, authenticated;
insert into public.ondi_super (user_id, email) select id, email from auth.users where lower(email) = 'christianbarcossilva@gmail.com' on conflict do nothing;

create table if not exists public.ondi_soporte (
  org_id uuid not null references public.orgs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  hasta timestamptz not null,
  primary key (org_id, user_id)
);
alter table public.ondi_soporte enable row level security;
revoke all on public.ondi_soporte from anon, authenticated;

create or replace function public.ondi_super() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from ondi_super where user_id = auth.uid())
$$;
-- el rol en la empresa: el de Olumi, o "admin" mientras Unity Tech está ayudando en modo soporte
create or replace function public.ondi_rol(o uuid) returns text
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select role from members where org_id = o and user_id = auth.uid() limit 1),
    (select 'admin' from ondi_soporte s where s.org_id = o and s.user_id = auth.uid() and s.hasta > now() and public.ondi_super())
  )
$$;

-- ---------- permisos del cliente: solo ver, ver y pedir, o ver y editar su maqueta ----------
alter table public.ondi_accesos add column if not exists rol text not null default 'ver';
alter table public.ondi_accesos drop constraint if exists ondi_accesos_rol_check;
alter table public.ondi_accesos add constraint ondi_accesos_rol_check check (rol in ('ver', 'pedir', 'editar'));
create or replace function public.ondi_cli_editor(o uuid, s text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from ondi_accesos where org_id = o and site_id = s and user_id = auth.uid() and rol = 'editar')
$$;
drop policy if exists ondi_maq_alta on public.ondi_maquetas;
create policy ondi_maq_alta on public.ondi_maquetas for insert with check (public.ondi_editor(org_id) or public.ondi_cli_editor(org_id, site_id));
drop policy if exists ondi_maq_cambio on public.ondi_maquetas;
create policy ondi_maq_cambio on public.ondi_maquetas for update using (public.ondi_editor(org_id) or public.ondi_cli_editor(org_id, site_id)) with check (public.ondi_editor(org_id) or public.ondi_cli_editor(org_id, site_id));
drop policy if exists ondi_pl_alta on public.ondi_planos;
create policy ondi_pl_alta on public.ondi_planos for insert with check (public.ondi_editor(org_id) or public.ondi_cli_editor(org_id, site_id));
drop policy if exists ondi_pl_cambio on public.ondi_planos;
create policy ondi_pl_cambio on public.ondi_planos for update using (public.ondi_editor(org_id) or public.ondi_cli_editor(org_id, site_id)) with check (public.ondi_editor(org_id) or public.ondi_cli_editor(org_id, site_id));
drop policy if exists ondi_eq_alta on public.ondi_equipos;
create policy ondi_eq_alta on public.ondi_equipos for insert with check (public.ondi_editor(org_id) or public.ondi_cli_editor(org_id, site_id));
drop policy if exists ondi_eq_cambio on public.ondi_equipos;
create policy ondi_eq_cambio on public.ondi_equipos for update using (public.ondi_editor(org_id) or public.ondi_cli_editor(org_id, site_id)) with check (public.ondi_editor(org_id) or public.ondi_cli_editor(org_id, site_id));

-- la instaladora cambia el permiso de cada persona del cliente
create or replace function public.ondi_set_rol(o uuid, s text, u uuid, nuevo text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.ondi_admin(o) then raise exception 'sin_permiso'; end if;
  if nuevo not in ('ver', 'pedir', 'editar') then raise exception 'rol_invalido'; end if;
  update ondi_accesos set rol = nuevo where org_id = o and site_id = s and user_id = u;
end $$;
-- y le da acceso directo a alguien que ya tiene cuenta, por su email
create or replace function public.ondi_dar_acceso(o uuid, s text, mail text, nuevo text) returns text
language plpgsql security definer set search_path = public as $$
declare u uuid; m text := lower(trim(coalesce(mail, '')));
begin
  if not public.ondi_admin(o) then raise exception 'sin_permiso'; end if;
  if not exists (select 1 from ondi_sites where org_id = o and id = s) then raise exception 'no_existe'; end if;
  if nuevo not in ('ver', 'pedir', 'editar') then raise exception 'rol_invalido'; end if;
  select id into u from auth.users where lower(email) = m limit 1;
  if u is null then return 'sin_cuenta'; end if;
  insert into ondi_accesos (org_id, site_id, user_id, email, rol) values (o, s, u, m, nuevo)
    on conflict (org_id, site_id, user_id) do update set rol = excluded.rol;
  update ondi_solicitudes set estado = 'resuelta', org_id = o, site_id = s, updated_at = now() where user_id = u and estado = 'nueva';
  return 'ok';
end $$;

-- ---------- solicitudes de acceso: el cliente crea su cuenta solo y pide entrar ----------
create table if not exists public.ondi_solicitudes (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  email text, nombre text, empresa text, instaladora text, telefono text, mensaje text,
  estado text not null default 'nueva' check (estado in ('nueva', 'resuelta', 'rechazada')),
  org_id uuid, site_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.ondi_solicitudes enable row level security;
drop policy if exists ondi_sol_ver on public.ondi_solicitudes;
create policy ondi_sol_ver on public.ondi_solicitudes for select using (user_id = auth.uid());
drop policy if exists ondi_sol_alta on public.ondi_solicitudes;
create policy ondi_sol_alta on public.ondi_solicitudes for insert with check (user_id = auth.uid() and estado = 'nueva');
revoke all on public.ondi_solicitudes from anon;
grant select, insert on public.ondi_solicitudes to authenticated;

-- ---------- pedidos de ayuda: del cliente a la instaladora, y de la instaladora a Unity Tech ----------
create table if not exists public.ondi_pedidos (
  id bigint generated always as identity primary key,
  org_id uuid not null references public.orgs(id) on delete cascade,
  site_id text,
  user_id uuid not null default auth.uid(),
  email text, nombre text,
  para text not null default 'instaladora' check (para in ('instaladora', 'unity')),
  tipo text not null default 'otro' check (tipo in ('agregar', 'cambio', 'problema', 'otro')),
  texto text not null check (length(trim(texto)) between 1 and 4000),
  estado text not null default 'abierto' check (estado in ('abierto', 'en_curso', 'resuelto')),
  respuesta text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.ondi_pedidos enable row level security;
drop policy if exists ondi_ped_ver on public.ondi_pedidos;
create policy ondi_ped_ver on public.ondi_pedidos for select using (public.ondi_staff(org_id) or user_id = auth.uid());
drop policy if exists ondi_ped_alta on public.ondi_pedidos;
create policy ondi_ped_alta on public.ondi_pedidos for insert with check (user_id = auth.uid() and estado = 'abierto' and respuesta is null and (public.ondi_staff(org_id) or (site_id is not null and para = 'instaladora' and exists (select 1 from public.ondi_accesos a where a.org_id = ondi_pedidos.org_id and a.site_id = ondi_pedidos.site_id and a.user_id = auth.uid() and a.rol in ('pedir', 'editar')))));
drop policy if exists ondi_ped_cambio on public.ondi_pedidos;
create policy ondi_ped_cambio on public.ondi_pedidos for update using (public.ondi_editor(org_id) and para = 'instaladora') with check (public.ondi_editor(org_id) and para = 'instaladora');
revoke all on public.ondi_pedidos from anon;
grant select, insert, update on public.ondi_pedidos to authenticated;
drop trigger if exists ondi_ped_touch on public.ondi_pedidos;
create trigger ondi_ped_touch before update on public.ondi_pedidos for each row execute function public.ondi_touch();

-- ---------- actividad: qué pasó, quién y cuándo ----------
create table if not exists public.ondi_actividad (
  id bigint generated always as identity primary key,
  org_id uuid, site_id text, user_id uuid, email text,
  que text not null, detalle text,
  created_at timestamptz not null default now()
);
create index if not exists ondi_act_org on public.ondi_actividad (org_id, created_at desc);
alter table public.ondi_actividad enable row level security;
drop policy if exists ondi_act_ver on public.ondi_actividad;
create policy ondi_act_ver on public.ondi_actividad for select using (public.ondi_admin(org_id));
revoke all on public.ondi_actividad from anon;
grant select on public.ondi_actividad to authenticated;

create or replace function public.ondi_log() returns trigger
language plpgsql security definer set search_path = public as $$
declare r record; o uuid; s text; q text; det text; mail text;
begin
  r := case when tg_op = 'DELETE' then old else new end;
  o := r.org_id;
  select email into mail from auth.users where id = auth.uid();
  if tg_table_name = 'ondi_sites' then s := r.id; q := case tg_op when 'INSERT' then 'Cliente creado' when 'DELETE' then 'Cliente borrado' else 'Datos del cliente cambiados' end; det := r.name;
    if tg_op = 'UPDATE' and old.name = new.name and old.data - 'resumen' - 'manuales' = new.data - 'resumen' - 'manuales' then return null; end if;
  elsif tg_table_name = 'ondi_maquetas' then s := r.site_id; q := 'Maqueta editada';
    if exists (select 1 from ondi_actividad where org_id = o and site_id = s and que = q and created_at > now() - interval '20 minutes') then return null; end if;
  elsif tg_table_name = 'ondi_accesos' then s := r.site_id; det := coalesce(r.email, '') || ' · ' || r.rol;
    q := case tg_op when 'INSERT' then 'Acceso dado al cliente' when 'DELETE' then 'Acceso quitado' else 'Permiso del cliente cambiado' end;
  elsif tg_table_name = 'ondi_secretos' then s := nullif(r.scope, ''); det := r.kind; q := case tg_op when 'DELETE' then 'Clave borrada' else 'Clave cargada' end;
  elsif tg_table_name = 'ondi_equipos' then s := r.site_id; det := r.nombre; q := case tg_op when 'INSERT' then 'Equipo agregado' when 'DELETE' then 'Equipo borrado' else 'Equipo cambiado' end;
  elsif tg_table_name = 'ondi_pedidos' then s := r.site_id; det := left(r.texto, 120); q := case when tg_op = 'INSERT' then 'Pedido de ayuda' else 'Pedido ' || replace(r.estado, '_', ' ') end;
    if tg_op = 'UPDATE' and old.estado = new.estado and coalesce(old.respuesta, '') = coalesce(new.respuesta, '') then return null; end if;
  end if;
  insert into ondi_actividad (org_id, site_id, user_id, email, que, detalle) values (o, s, auth.uid(), mail, q, det);
  return null;
end $$;
do $$ declare t text; begin
  foreach t in array array['ondi_sites', 'ondi_maquetas', 'ondi_accesos', 'ondi_secretos', 'ondi_equipos', 'ondi_pedidos'] loop
    execute format('drop trigger if exists ondi_log_t on public.%I', t);
    execute format('create trigger ondi_log_t after insert or update or delete on public.%I for each row execute function public.ondi_log()', t);
  end loop; end $$;

-- ---------- Ondi como app propia: empresas de Ondi, alta de empresa y permisos ----------
create or replace function public.ondi_mis_empresas() returns table (org_id uuid, name text, role text, plan text, activo boolean, soporte boolean)
language sql stable security definer set search_path = public as $$
  select g.id, g.name, m.role, e.plan, e.activo, false from members m join orgs g on g.id = m.org_id join ondi_empresas e on e.org_id = m.org_id
    where m.user_id = auth.uid() and m.role not in ('cliente', 'pendiente')
  union all
  select g.id, g.name, 'admin', e.plan, e.activo, true from ondi_soporte s join orgs g on g.id = s.org_id join ondi_empresas e on e.org_id = s.org_id
    where s.user_id = auth.uid() and s.hasta > now() and public.ondi_super() and not exists (select 1 from members m where m.org_id = s.org_id and m.user_id = auth.uid())
$$;
create or replace function public.ondi_crear_empresa(nombre text, my_name text) returns uuid
language plpgsql security definer set search_path = public as $$
declare o uuid;
begin
  if auth.uid() is null then raise exception 'sin_sesion'; end if;
  o := public.create_org(nombre, my_name);
  insert into ondi_empresas (org_id) values (o) on conflict do nothing;
  return o;
end $$;
-- una empresa de Olumi que quiere usar Ondi (el dueño o un admin la suma con un clic)
create or replace function public.ondi_sumar_empresa(o uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from members where org_id = o and user_id = auth.uid() and role in ('owner', 'admin')) then raise exception 'sin_permiso'; end if;
  insert into ondi_empresas (org_id) values (o) on conflict do nothing;
end $$;
create or replace function public.ondi_otras_empresas() returns table (org_id uuid, name text)
language sql stable security definer set search_path = public as $$
  select g.id, g.name from members m join orgs g on g.id = m.org_id
    where m.user_id = auth.uid() and m.role in ('owner', 'admin') and not exists (select 1 from ondi_empresas e where e.org_id = m.org_id)
$$;
create or replace function public.ondi_renombrar(o uuid, nombre text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.ondi_admin(o) then raise exception 'sin_permiso'; end if;
  if length(trim(coalesce(nombre, ''))) not between 2 and 80 then raise exception 'nombre_invalido'; end if;
  update orgs set name = trim(nombre) where id = o;
end $$;
-- equipo de la empresa con su email (para Ajustes)
create or replace function public.ondi_equipo(o uuid) returns table (user_id uuid, role text, nombre text, email text, ultimo timestamptz)
language sql stable security definer set search_path = public as $$
  select m.user_id, m.role, m.display_name, coalesce(m.email, u.email), u.last_sign_in_at from members m left join auth.users u on u.id = m.user_id
    where m.org_id = o and m.role not in ('cliente', 'pendiente') and public.ondi_staff(o)
$$;
-- el cliente pide ayuda a la instaladora: el pedido toma su nombre y email
create or replace function public.ondi_pedir(o uuid, s text, tp text, txt text, a_unity boolean default false) returns bigint
language plpgsql security definer set search_path = public as $$
declare i bigint; mail text; nm text;
begin
  if auth.uid() is null then raise exception 'sin_sesion'; end if;
  if a_unity and not public.ondi_staff(o) then raise exception 'sin_permiso'; end if;
  if not a_unity and not public.ondi_staff(o) and not exists (select 1 from ondi_accesos where org_id = o and site_id = s and user_id = auth.uid() and rol in ('pedir', 'editar')) then raise exception 'sin_permiso'; end if;
  select email into mail from auth.users where id = auth.uid();
  select coalesce((select name from ondi_accesos where org_id = o and site_id = s and user_id = auth.uid()), (select display_name from members where org_id = o and user_id = auth.uid() limit 1)) into nm;
  insert into ondi_pedidos (org_id, site_id, user_id, email, nombre, para, tipo, texto)
    values (o, nullif(s, ''), auth.uid(), mail, nm, case when a_unity then 'unity' else 'instaladora' end, coalesce(nullif(tp, ''), 'otro'), trim(txt)) returning id into i;
  return i;
end $$;

-- ---------- panel de control de Unity Tech (solo para quien está en ondi_super) ----------
create or replace function public.ondi_soy_super() returns boolean
language sql stable security definer set search_path = public as $$ select public.ondi_super() $$;
create or replace function public.ondi_super_panel() returns json
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.ondi_super() then raise exception 'sin_permiso'; end if;
  return json_build_object(
    'empresas', (select coalesce(json_agg(x order by x.name), '[]') from (
      select e.org_id, g.name, e.plan, e.activo, e.notas, e.created_at,
        (select count(*) from ondi_sites s where s.org_id = e.org_id) clientes,
        (select count(*) from members m where m.org_id = e.org_id and m.role not in ('cliente', 'pendiente')) equipo,
        (select count(*) from ondi_accesos a where a.org_id = e.org_id) usuarios_cliente,
        (select count(*) from ondi_pedidos p where p.org_id = e.org_id and p.estado <> 'resuelto') pedidos,
        (select max(created_at) from ondi_actividad a where a.org_id = e.org_id) ultimo,
        exists (select 1 from ondi_soporte s where s.org_id = e.org_id and s.user_id = auth.uid() and s.hasta > now()) soporte
      from ondi_empresas e join orgs g on g.id = e.org_id) x),
    'clientes', (select coalesce(json_agg(x order by x.empresa, x.name), '[]') from (
      select s.org_id, s.id, s.name, g.name empresa, s.data->>'direccion' direccion, s.created_at,
        (select count(*) from ondi_accesos a where a.org_id = s.org_id and a.site_id = s.id) usuarios,
        (select max(updated_at) from ondi_maquetas q where q.org_id = s.org_id and q.site_id = s.id) maqueta
      from ondi_sites s join orgs g on g.id = s.org_id) x),
    'usuarios', (select coalesce(json_agg(x order by x.email), '[]') from (
      select m.user_id, coalesce(m.email, u.email) email, m.display_name nombre, g.name empresa, m.org_id, m.role rol, 'equipo' tipo, null::text cliente, u.last_sign_in_at ultimo
        from members m join ondi_empresas e on e.org_id = m.org_id join orgs g on g.id = m.org_id left join auth.users u on u.id = m.user_id where m.role not in ('cliente', 'pendiente')
      union all
      select a.user_id, coalesce(a.email, u.email), a.name, g.name, a.org_id, a.rol, 'cliente', s.name, u.last_sign_in_at
        from ondi_accesos a join orgs g on g.id = a.org_id join ondi_sites s on s.org_id = a.org_id and s.id = a.site_id left join auth.users u on u.id = a.user_id) x),
    'solicitudes', (select coalesce(json_agg(x order by x.created_at desc), '[]') from (select * from ondi_solicitudes where estado = 'nueva' or updated_at > now() - interval '14 days') x),
    'pedidos', (select coalesce(json_agg(x order by x.estado = 'resuelto', x.para = 'instaladora', x.created_at desc), '[]') from (
      select p.*, g.name empresa, s.name cliente from ondi_pedidos p join orgs g on g.id = p.org_id left join ondi_sites s on s.org_id = p.org_id and s.id = p.site_id
      where p.estado <> 'resuelto' or p.updated_at > now() - interval '30 days' order by p.created_at desc limit 300) x),
    'actividad', (select coalesce(json_agg(x order by x.created_at desc), '[]') from (
      select a.*, g.name empresa from ondi_actividad a left join orgs g on g.id = a.org_id order by a.created_at desc limit 300) x));
end $$;
create or replace function public.ondi_super_empresa(o uuid, nuevo_plan text, activa boolean, nota text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.ondi_super() then raise exception 'sin_permiso'; end if;
  update ondi_empresas set plan = coalesce(nullif(nuevo_plan, ''), plan), activo = coalesce(activa, activo), notas = coalesce(nota, notas) where org_id = o;
end $$;
-- entrar a ayudar: da permisos de administrador en esa empresa por 2 horas (queda en la actividad)
create or replace function public.ondi_super_soporte(o uuid, entrar boolean) returns void
language plpgsql security definer set search_path = public as $$
declare mail text;
begin
  if not public.ondi_super() then raise exception 'sin_permiso'; end if;
  select email into mail from auth.users where id = auth.uid();
  if entrar then insert into ondi_soporte (org_id, user_id, hasta) values (o, auth.uid(), now() + interval '2 hours') on conflict (org_id, user_id) do update set hasta = excluded.hasta;
    insert into ondi_actividad (org_id, user_id, email, que, detalle) values (o, auth.uid(), mail, 'Unity Tech entró en modo soporte', 'Por 2 horas');
  else delete from ondi_soporte where org_id = o and user_id = auth.uid();
    insert into ondi_actividad (org_id, user_id, email, que) values (o, auth.uid(), mail, 'Unity Tech salió del modo soporte'); end if;
end $$;
create or replace function public.ondi_super_asignar(sol bigint, o uuid, s text, nuevo text) returns void
language plpgsql security definer set search_path = public as $$
declare r record;
begin
  if not public.ondi_super() then raise exception 'sin_permiso'; end if;
  select * into r from ondi_solicitudes where id = sol; if not found then raise exception 'no_existe'; end if;
  if o is null then update ondi_solicitudes set estado = 'rechazada', updated_at = now() where id = sol; return; end if;
  if not exists (select 1 from ondi_sites where org_id = o and id = s) then raise exception 'no_existe'; end if;
  insert into ondi_accesos (org_id, site_id, user_id, email, name, rol) values (o, s, r.user_id, r.email, r.nombre, coalesce(nullif(nuevo, ''), 'ver'))
    on conflict (org_id, site_id, user_id) do update set rol = excluded.rol;
  update ondi_solicitudes set estado = 'resuelta', org_id = o, site_id = s, updated_at = now() where id = sol;
end $$;
create or replace function public.ondi_super_responder(p bigint, nuevo_estado text, resp text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.ondi_super() then raise exception 'sin_permiso'; end if;
  update ondi_pedidos set estado = coalesce(nullif(nuevo_estado, ''), estado), respuesta = coalesce(resp, respuesta) where id = p;
end $$;

do $$ declare f text; begin
  foreach f in array array['ondi_super()', 'ondi_rol(uuid)', 'ondi_cli_editor(uuid, text)', 'ondi_set_rol(uuid, text, uuid, text)', 'ondi_dar_acceso(uuid, text, text, text)', 'ondi_mis_empresas()', 'ondi_crear_empresa(text, text)',
    'ondi_sumar_empresa(uuid)', 'ondi_otras_empresas()', 'ondi_renombrar(uuid, text)', 'ondi_equipo(uuid)', 'ondi_pedir(uuid, text, text, text, boolean)', 'ondi_soy_super()', 'ondi_super_panel()',
    'ondi_super_empresa(uuid, text, boolean, text)', 'ondi_super_soporte(uuid, boolean)', 'ondi_super_asignar(bigint, uuid, text, text)', 'ondi_super_responder(bigint, text, text)'] loop
    execute 'revoke execute on function public.' || f || ' from anon, public';
    execute 'grant execute on function public.' || f || ' to authenticated';
  end loop; end $$;

select 'listo' as ondi_1_2;
