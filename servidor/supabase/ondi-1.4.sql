-- Ondi 1.4 · estudios de las herramientas de Integraciones (predictivo de wifi y mapa de calor medido).
-- Cada estudio es de la empresa y, si se eligió, de un cliente. El plano subido va adentro (JPEG chico).
create table if not exists public.ondi_estudios (
  org_id uuid not null,
  id text not null default substr(md5(random()::text || clock_timestamp()::text), 1, 12),
  site_id text,
  tipo text not null check (tipo in ('wifi', 'calor', 'camaras')),
  nombre text not null default '',
  data jsonb not null default '{}'::jsonb check (length(data::text) < 6000000),
  updated_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (org_id, id),
  foreign key (org_id, site_id) references public.ondi_sites(org_id, id) on delete cascade
);
create index if not exists ondi_estudios_tipo on public.ondi_estudios (org_id, tipo, updated_at desc);
alter table public.ondi_estudios enable row level security;
drop policy if exists ondi_es_ver on public.ondi_estudios;
create policy ondi_es_ver on public.ondi_estudios for select using (public.ondi_staff(org_id));
drop policy if exists ondi_es_alta on public.ondi_estudios;
create policy ondi_es_alta on public.ondi_estudios for insert with check (public.ondi_editor(org_id));
drop policy if exists ondi_es_cambio on public.ondi_estudios;
create policy ondi_es_cambio on public.ondi_estudios for update using (public.ondi_editor(org_id)) with check (public.ondi_editor(org_id));
drop policy if exists ondi_es_baja on public.ondi_estudios;
create policy ondi_es_baja on public.ondi_estudios for delete using (public.ondi_editor(org_id));
revoke all on public.ondi_estudios from anon;
grant select, insert, update, delete on public.ondi_estudios to authenticated;
