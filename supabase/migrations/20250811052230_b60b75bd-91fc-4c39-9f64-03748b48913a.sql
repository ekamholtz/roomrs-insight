drop policy if exists "Users can read their own roles" on public.user_roles;
create policy "Users can read their own roles" on public.user_roles
for select to authenticated
using (user_id = auth.uid());

drop policy if exists "Bootstrap first admin" on public.user_roles;
create policy "Bootstrap first admin" on public.user_roles
for insert to authenticated
with check (
  role = 'admin'::public.app_role
  and user_id = auth.uid()
  and not exists (
    select 1 from public.user_roles ur where ur.role = 'admin'
  )
);
