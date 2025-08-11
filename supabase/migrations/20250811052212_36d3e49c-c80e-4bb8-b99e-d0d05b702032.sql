-- Allow users to read their own roles
create policy if not exists "Users can read their own roles" on public.user_roles
for select to authenticated
using (user_id = auth.uid());

-- Bootstrap: allow the very first admin role claim by any authenticated user, only if no admins exist
create policy if not exists "Bootstrap first admin" on public.user_roles
for insert to authenticated
with check (
  role = 'admin'::public.app_role
  and user_id = auth.uid()
  and not exists (
    select 1 from public.user_roles ur where ur.role = 'admin'
  )
);
