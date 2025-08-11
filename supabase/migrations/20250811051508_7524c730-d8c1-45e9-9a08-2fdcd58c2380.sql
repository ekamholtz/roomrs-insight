-- Core enums
create type public.revenue_class as enum (
  'rent_income',
  'utility_fee_income',
  'bedroom_cleaning',
  'convenience_fee',
  'flex_fee_income',
  'late_fee_income',
  'lease_break_fee_income',
  'membership_fee_income'
);

create type public.entitlement_type as enum ('landlord', 'roomrs');

create type public.app_role as enum ('admin','finance','partner','readonly');

-- Timestamp helper
create or replace function public.update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Roles system
create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  unique (user_id, role)
);

alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role = _role
  );
$$;

-- Scope mapping for partners
create table if not exists public.user_scopes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  org_id uuid not null,
  building_id uuid null,
  unit_id uuid null,
  unique (user_id, org_id, building_id, unit_id)
);

alter table public.user_scopes enable row level security;

create or replace function public.is_scoped(
  _user_id uuid,
  _org uuid,
  _building uuid,
  _unit uuid
) returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_scopes s
    where s.user_id = _user_id
      and (
        (_unit is not null and s.unit_id is not null and s.unit_id = _unit)
        or (_building is not null and s.building_id is not null and s.building_id = _building)
        or (s.org_id = _org)
      )
  );
$$;

-- Entities
create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  external_id text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_organizations_updated
before update on public.organizations
for each row execute function public.update_updated_at_column();

alter table public.organizations enable row level security;

create table if not exists public.buildings (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  external_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, name)
);

create trigger trg_buildings_updated
before update on public.buildings
for each row execute function public.update_updated_at_column();

alter table public.buildings enable row level security;

create table if not exists public.units (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  building_id uuid not null references public.buildings(id) on delete cascade,
  name text not null,
  external_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (building_id, name)
);

create trigger trg_units_updated
before update on public.units
for each row execute function public.update_updated_at_column();

alter table public.units enable row level security;

create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.units(id) on delete cascade,
  name text,
  external_id text,
  created_at timestamptz not null default now()
);

alter table public.rooms enable row level security;

create table if not exists public.room_counts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  building_id uuid not null references public.buildings(id) on delete cascade,
  unit_id uuid not null references public.units(id) on delete cascade,
  room_count integer not null check (room_count >= 0),
  created_at timestamptz not null default now(),
  unique (unit_id)
);

alter table public.room_counts enable row level security;

-- Data sources and mappings
create table if not exists public.data_sources (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  file_name text not null,
  content_type text,
  size_bytes bigint,
  storage_path text,
  status text not null default 'uploaded',
  log text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_data_sources_updated
before update on public.data_sources
for each row execute function public.update_updated_at_column();

alter table public.data_sources enable row level security;

create table if not exists public.mapping_profiles (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  mapping_json jsonb not null,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, name)
);

create trigger trg_mapping_profiles_updated
before update on public.mapping_profiles
for each row execute function public.update_updated_at_column();

alter table public.mapping_profiles enable row level security;

-- Transactions
create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  building_id uuid references public.buildings(id) on delete set null,
  unit_id uuid references public.units(id) on delete set null,
  room_id uuid references public.rooms(id) on delete set null,
  period_month date not null,
  period_start date,
  period_end date,
  account_name text,
  account_code text,
  revenue_class public.revenue_class,
  amount numeric(14,2) not null,
  currency text not null default 'USD',
  memo text,
  source_file_id uuid references public.data_sources(id) on delete set null,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  extra_json jsonb
);

create index if not exists idx_transactions_org_building_unit_period
  on public.transactions (org_id, building_id, unit_id, period_month);

create trigger trg_transactions_updated
before update on public.transactions
for each row execute function public.update_updated_at_column();

alter table public.transactions enable row level security;

-- KPI definitions and results
create table if not exists public.kpi_definitions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  version integer not null default 1,
  spec_json jsonb not null,
  is_active boolean not null default false,
  scope_org_id uuid references public.organizations(id),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (name, version)
);

create trigger trg_kpi_definitions_updated
before update on public.kpi_definitions
for each row execute function public.update_updated_at_column();

alter table public.kpi_definitions enable row level security;

create table if not exists public.kpi_results (
  id uuid primary key default gen_random_uuid(),
  kpi_name text not null,
  kpi_version integer,
  org_id uuid not null references public.organizations(id) on delete cascade,
  building_id uuid references public.buildings(id) on delete set null,
  unit_id uuid references public.units(id) on delete set null,
  period_month date not null,
  value numeric(18,2) not null,
  computed_at timestamptz not null default now(),
  extra_json jsonb,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_kpi_results_org_building_unit_period
  on public.kpi_results (org_id, building_id, unit_id, period_month);

alter table public.kpi_results enable row level security;

-- Parameter sets and fee entitlements
create table if not exists public.opex_parameters (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.organizations(id) on delete cascade,
  building_id uuid references public.buildings(id) on delete cascade,
  unit_id uuid references public.units(id) on delete cascade,
  effective_start date,
  effective_end date,
  cleaning_per_unit numeric(10,2) not null default 75,
  cleaning_per_room numeric(10,2) not null default 15,
  electricity_per_room numeric(10,2) not null default 150,
  gas_per_room numeric(10,2) not null default 25,
  smartlocks_per_unit numeric(10,2) not null default 30,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_opex_parameters_updated
before update on public.opex_parameters
for each row execute function public.update_updated_at_column();

alter table public.opex_parameters enable row level security;

create table if not exists public.fee_entitlements (
  id uuid primary key default gen_random_uuid(),
  revenue_class public.revenue_class not null,
  entitlement public.entitlement_type not null,
  org_id uuid references public.organizations(id) on delete cascade,
  building_id uuid references public.buildings(id) on delete cascade,
  unit_id uuid references public.units(id) on delete cascade,
  effective_start date,
  effective_end date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_fee_entitlements_updated
before update on public.fee_entitlements
for each row execute function public.update_updated_at_column();

alter table public.fee_entitlements enable row level security;

-- Statements metadata
create table if not exists public.statements (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  building_id uuid references public.buildings(id) on delete set null,
  period_month date not null,
  generated_by uuid references auth.users(id),
  pdf_path text,
  xlsx_path text,
  created_at timestamptz not null default now(),
  unique (org_id, period_month, building_id)
);

create index if not exists idx_statements_org_period
  on public.statements (org_id, period_month);

alter table public.statements enable row level security;

-- Audit log
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id),
  action text not null,
  entity_type text,
  entity_id uuid,
  details jsonb,
  created_at timestamptz not null default now()
);

alter table public.audit_logs enable row level security;

-- Seed baseline fee entitlements (global defaults)
insert into public.fee_entitlements (revenue_class, entitlement)
values
  ('rent_income','landlord'),
  ('utility_fee_income','landlord'),
  ('bedroom_cleaning','roomrs'),
  ('convenience_fee','roomrs'),
  ('flex_fee_income','roomrs'),
  ('late_fee_income','roomrs'),
  ('lease_break_fee_income','roomrs'),
  ('membership_fee_income','roomrs')
on conflict do nothing;

-- RLS Policies
-- user_roles
create policy "Admins and Finance can manage user_roles" on public.user_roles
for all to authenticated
using (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'finance'))
with check (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'finance'));

-- user_scopes (admin/finance manage, internal can read)
create policy "Internal can read user_scopes" on public.user_scopes
for select to authenticated
using (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'finance') or public.has_role(auth.uid(),'readonly'));

create policy "Admins and Finance can modify user_scopes" on public.user_scopes
for all to authenticated
using (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'finance'))
with check (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'finance'));

-- organizations
create policy "Internal can read organizations" on public.organizations
for select to authenticated
using (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'finance') or public.has_role(auth.uid(),'readonly'));

create policy "Partners can read scoped organizations" on public.organizations
for select to authenticated
using (public.is_scoped(auth.uid(), id, null, null));

create policy "Admins and Finance modify organizations" on public.organizations
for all to authenticated
using (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'finance'))
with check (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'finance'));

-- buildings
create policy "Internal can read buildings" on public.buildings
for select to authenticated
using (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'finance') or public.has_role(auth.uid(),'readonly'));

create policy "Partners can read scoped buildings" on public.buildings
for select to authenticated
using (public.is_scoped(auth.uid(), org_id, id, null));

create policy "Admins and Finance modify buildings" on public.buildings
for all to authenticated
using (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'finance'))
with check (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'finance'));

-- units
create policy "Internal can read units" on public.units
for select to authenticated
using (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'finance') or public.has_role(auth.uid(),'readonly'));

create policy "Partners can read scoped units" on public.units
for select to authenticated
using (public.is_scoped(auth.uid(), org_id, building_id, id));

create policy "Admins and Finance modify units" on public.units
for all to authenticated
using (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'finance'))
with check (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'finance'));

-- rooms
create policy "Internal can read rooms" on public.rooms
for select to authenticated
using (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'finance') or public.has_role(auth.uid(),'readonly'));

create policy "Partners can read scoped rooms" on public.rooms
for select to authenticated
using (exists (
  select 1 from public.units u
  where u.id = rooms.unit_id
    and public.is_scoped(auth.uid(), u.org_id, u.building_id, rooms.unit_id)
));

create policy "Admins and Finance modify rooms" on public.rooms
for all to authenticated
using (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'finance'))
with check (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'finance'));

-- room_counts
create policy "Internal can read room_counts" on public.room_counts
for select to authenticated
using (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'finance') or public.has_role(auth.uid(),'readonly'));

create policy "Partners can read scoped room_counts" on public.room_counts
for select to authenticated
using (public.is_scoped(auth.uid(), org_id, building_id, unit_id));

create policy "Admins and Finance modify room_counts" on public.room_counts
for all to authenticated
using (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'finance'))
with check (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'finance'));

-- data_sources (internal only)
create policy "Internal can read data_sources" on public.data_sources
for select to authenticated
using (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'finance') or public.has_role(auth.uid(),'readonly'));

create policy "Admins and Finance modify data_sources" on public.data_sources
for all to authenticated
using (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'finance'))
with check (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'finance'));

-- mapping_profiles (internal only)
create policy "Internal can read mapping_profiles" on public.mapping_profiles
for select to authenticated
using (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'finance') or public.has_role(auth.uid(),'readonly'));

create policy "Admins and Finance modify mapping_profiles" on public.mapping_profiles
for all to authenticated
using (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'finance'))
with check (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'finance'));

-- transactions
create policy "Internal can read transactions" on public.transactions
for select to authenticated
using (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'finance') or public.has_role(auth.uid(),'readonly'));

create policy "Partners can read scoped transactions" on public.transactions
for select to authenticated
using (public.is_scoped(auth.uid(), org_id, building_id, unit_id));

create policy "Admins and Finance modify transactions" on public.transactions
for all to authenticated
using (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'finance'))
with check (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'finance'));

-- KPI definitions (internal only)
create policy "Internal can read kpi_definitions" on public.kpi_definitions
for select to authenticated
using (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'finance') or public.has_role(auth.uid(),'readonly'));

create policy "Admins and Finance modify kpi_definitions" on public.kpi_definitions
for all to authenticated
using (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'finance'))
with check (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'finance'));

-- KPI results
create policy "Internal can read kpi_results" on public.kpi_results
for select to authenticated
using (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'finance') or public.has_role(auth.uid(),'readonly'));

create policy "Partners can read scoped kpi_results" on public.kpi_results
for select to authenticated
using (public.is_scoped(auth.uid(), org_id, building_id, unit_id));

create policy "Admins and Finance insert kpi_results" on public.kpi_results
for insert to authenticated
with check (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'finance'));

-- Parameters and entitlements (internal only)
create policy "Internal can read opex_parameters" on public.opex_parameters
for select to authenticated
using (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'finance') or public.has_role(auth.uid(),'readonly'));

create policy "Admins and Finance modify opex_parameters" on public.opex_parameters
for all to authenticated
using (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'finance'))
with check (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'finance'));

create policy "Internal can read fee_entitlements" on public.fee_entitlements
for select to authenticated
using (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'finance') or public.has_role(auth.uid(),'readonly'));

create policy "Admins and Finance modify fee_entitlements" on public.fee_entitlements
for all to authenticated
using (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'finance'))
with check (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'finance'));

-- Statements
create policy "Internal can read statements" on public.statements
for select to authenticated
using (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'finance') or public.has_role(auth.uid(),'readonly'));

create policy "Partners can read scoped statements" on public.statements
for select to authenticated
using (public.is_scoped(auth.uid(), org_id, building_id, null));

create policy "Admins and Finance modify statements" on public.statements
for all to authenticated
using (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'finance'))
with check (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'finance'));

-- Audit logs (internal read, system insert)
create policy "Internal can read audit_logs" on public.audit_logs
for select to authenticated
using (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'finance') or public.has_role(auth.uid(),'readonly'));

create policy "Admins and Finance insert audit_logs" on public.audit_logs
for insert to authenticated
with check (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'finance'));

-- Storage buckets
insert into storage.buckets (id, name, public)
values ('statements','statements', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('logos','logos', true)
on conflict (id) do nothing;

-- Storage policies for statements bucket (scoped by org_id as first folder segment)
create policy "Partners can read their statements"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'statements'
    and exists (
      select 1 from public.user_scopes s
      where s.user_id = auth.uid()
        and s.org_id::text = (storage.foldername(name))[1]
    )
  );

create policy "Internal can manage statements"
  on storage.objects for all
  to authenticated
  using (bucket_id = 'statements' and (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'finance')))
  with check (bucket_id = 'statements' and (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'finance')));

-- Storage policies for logos bucket (public read, internal write)
create policy "Public can read logos"
  on storage.objects for select
  to public
  using (bucket_id = 'logos');

create policy "Internal can manage logos"
  on storage.objects for all
  to authenticated
  using (bucket_id = 'logos' and (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'finance')))
  with check (bucket_id = 'logos' and (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'finance')));
