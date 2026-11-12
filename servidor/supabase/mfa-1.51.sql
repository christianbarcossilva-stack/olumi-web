-- Olumi 1.51h · Doble verificación exigida también en el servidor.
-- Quien tiene la doble verificación activada solo puede leer y escribir datos con la sesión verificada (aal2).
-- Quien no la tiene, sigue igual. NO CORRER hasta que la app de clientes y la del iPhone pidan el código al entrar
-- (si no, alguien que la activó en la beta abriría la app de clientes y la vería vacía).
create or replace function public.mfa_ok() returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
      or not exists (select 1 from auth.mfa_factors f where f.user_id = auth.uid() and f.status = 'verified');
$$;
revoke all on function public.mfa_ok() from public;
grant execute on function public.mfa_ok() to authenticated;

create policy docs_mfa on public.docs as restrictive for all to authenticated
  using (public.mfa_ok()) with check (public.mfa_ok());
create policy members_mfa on public.members as restrictive for all to authenticated
  using (public.mfa_ok()) with check (public.mfa_ok());
create policy objetos_mfa on storage.objects as restrictive for all to authenticated
  using (public.mfa_ok()) with check (public.mfa_ok());
