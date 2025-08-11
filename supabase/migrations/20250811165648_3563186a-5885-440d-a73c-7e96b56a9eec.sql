
-- 1) Room-level KPIs require a room_id on kpi_results
alter table public.kpi_results
  add column if not exists room_id uuid;

-- add FK for referential integrity (safe: new column is null by default)
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'kpi_results_room_id_fkey'
  ) then
    alter table public.kpi_results
      add constraint kpi_results_room_id_fkey
      foreign key (room_id) references public.rooms(id)
      on delete set null
      deferrable initially deferred;
  end if;
end $$;

-- helpful indexes for querying KPI results
create index if not exists kpi_results_name_period_idx on public.kpi_results (kpi_name, period_month);
create index if not exists kpi_results_scope_idx on public.kpi_results (org_id, building_id, unit_id, room_id);

-- 2) Persist Agreement Type on units (used by ingestion and filters)
alter table public.units
  add column if not exists agreement_type text;

create index if not exists units_agreement_type_idx on public.units (agreement_type);

-- 3) Seed default global OpEx parameters (only if a global active row doesn’t already exist)
insert into public.opex_parameters (
  org_id, building_id, unit_id, effective_start, effective_end,
  cleaning_per_unit, cleaning_per_room, electricity_per_room, gas_per_room, smartlocks_per_unit, is_active
)
select
  null, null, null, null, null,
  75, 15, 150, 25, 30, true
where not exists (
  select 1 from public.opex_parameters
  where org_id is null and building_id is null and unit_id is null and is_active = true
);

-- 4) Seed KPI definitions (partner and internal). Insert only if the name doesn’t exist.

-- Partner 1) Total Revenue (Landlord Portion)
insert into public.kpi_definitions (name, version, spec_json, is_active)
select 'partner_total_revenue', 1,
'{
  "name": "partner_total_revenue",
  "description": "Landlord revenue by Unit",
  "group_by": ["OwnershipGroup", "Building", "Unit"],
  "filters": {
    "AgreementType": "Management",
    "entryDate_month": "$month"
  },
  "formula": "SUM( IF(GLAccountName IN [\"Rent Income\",\"Utility Fee Income\"], Amount, 0) + IF(OwnershipGroup == \"Centennial Properties\" AND GLAccountName == \"Flex Fee Income\", Amount, 0) )",
  "notes": "Centennial receives Flex Fee as landlord revenue"
}'::jsonb, true
where not exists (select 1 from public.kpi_definitions where name = 'partner_total_revenue');

-- Partner 2) Management Fee (10%)
insert into public.kpi_definitions (name, version, spec_json, is_active)
select 'partner_management_fee', 1,
'{
  "name": "partner_management_fee",
  "description": "10% of landlord total revenue by Unit",
  "group_by": ["OwnershipGroup", "Building", "Unit"],
  "depends_on": ["partner_total_revenue"],
  "formula": "partner_total_revenue * 0.10"
}'::jsonb, true
where not exists (select 1 from public.kpi_definitions where name = 'partner_management_fee');

-- Partner 3) Cleaning Expense
insert into public.kpi_definitions (name, version, spec_json, is_active)
select 'partner_cleaning', 1,
'{
  "name": "partner_cleaning",
  "description": "Cleaning OpEx per Unit",
  "group_by": ["OwnershipGroup", "Building", "Unit"],
  "inputs": ["Bedrooms"],
  "formula": "(75) + (15 * Bedrooms)"
}'::jsonb, true
where not exists (select 1 from public.kpi_definitions where name = 'partner_cleaning');

-- Partner 4) Electricity Expense
insert into public.kpi_definitions (name, version, spec_json, is_active)
select 'partner_electricity', 1,
'{
  "name": "partner_electricity",
  "description": "Electricity OpEx per Unit",
  "group_by": ["OwnershipGroup", "Building", "Unit"],
  "inputs": ["Bedrooms"],
  "formula": "150 * Bedrooms"
}'::jsonb, true
where not exists (select 1 from public.kpi_definitions where name = 'partner_electricity');

-- Partner 5) Gas Expense
insert into public.kpi_definitions (name, version, spec_json, is_active)
select 'partner_gas', 1,
'{
  "name": "partner_gas",
  "description": "Gas OpEx per Unit",
  "group_by": ["OwnershipGroup", "Building", "Unit"],
  "inputs": ["Bedrooms"],
  "formula": "25 * Bedrooms"
}'::jsonb, true
where not exists (select 1 from public.kpi_definitions where name = 'partner_gas');

-- Partner 6) Smart Locks Expense
insert into public.kpi_definitions (name, version, spec_json, is_active)
select 'partner_smartlocks', 1,
'{
  "name": "partner_smartlocks",
  "description": "Smart locks OpEx per Unit",
  "group_by": ["OwnershipGroup", "Building", "Unit"],
  "formula": "30"
}'::jsonb, true
where not exists (select 1 from public.kpi_definitions where name = 'partner_smartlocks');

-- Partner 7) Total OpEx
insert into public.kpi_definitions (name, version, spec_json, is_active)
select 'partner_total_opex', 1,
'{
  "name": "partner_total_opex",
  "description": "Total OpEx per Unit",
  "group_by": ["OwnershipGroup", "Building", "Unit"],
  "depends_on": ["partner_cleaning","partner_electricity","partner_gas","partner_smartlocks"],
  "formula": "partner_cleaning + partner_electricity + partner_gas + partner_smartlocks"
}'::jsonb, true
where not exists (select 1 from public.kpi_definitions where name = 'partner_total_opex');

-- Partner 8) NOI
insert into public.kpi_definitions (name, version, spec_json, is_active)
select 'partner_noi', 1,
'{
  "name": "partner_noi",
  "description": "NOI per Unit",
  "group_by": ["OwnershipGroup", "Building", "Unit"],
  "depends_on": ["partner_total_revenue","partner_management_fee","partner_total_opex"],
  "formula": "partner_total_revenue - partner_management_fee - partner_total_opex"
}'::jsonb, true
where not exists (select 1 from public.kpi_definitions where name = 'partner_noi');

-- Partner 9) NOI Margin
insert into public.kpi_definitions (name, version, spec_json, is_active)
select 'partner_noi_margin', 1,
'{
  "name": "partner_noi_margin",
  "description": "NOI margin per Unit",
  "group_by": ["OwnershipGroup", "Building", "Unit"],
  "depends_on": ["partner_noi","partner_total_revenue"],
  "formula": "SAFE_DIVIDE(partner_noi, partner_total_revenue)"
}'::jsonb, true
where not exists (select 1 from public.kpi_definitions where name = 'partner_noi_margin');

-- Internal 1) Gross Revenue (All Streams)
insert into public.kpi_definitions (name, version, spec_json, is_active)
select 'internal_gross_revenue', 1,
'{
  "name": "internal_gross_revenue",
  "description": "All revenue collected by Room",
  "group_by": ["OwnershipGroup", "Building", "Unit", "Room"],
  "filters": {
    "AgreementType": "Management",
    "entryDate_month": "$month"
  },
  "formula": "SUM(Amount)"
}'::jsonb, true
where not exists (select 1 from public.kpi_definitions where name = 'internal_gross_revenue');

-- Internal 2) Landlord Revenue (Room-Level)
insert into public.kpi_definitions (name, version, spec_json, is_active)
select 'internal_landlord_revenue', 1,
'{
  "name": "internal_landlord_revenue",
  "description": "Landlord revenue by Room",
  "group_by": ["OwnershipGroup", "Building", "Unit", "Room"],
  "filters": {
    "AgreementType": "Management",
    "entryDate_month": "$month"
  },
  "formula": "SUM( IF(GLAccountName IN [\"Rent Income\",\"Utility Fee Income\"], Amount, 0) + IF(OwnershipGroup == \"Centennial Properties\" AND GLAccountName == \"Flex Fee Income\", Amount, 0) )"
}'::jsonb, true
where not exists (select 1 from public.kpi_definitions where name = 'internal_landlord_revenue');

-- Internal 3) Roomrs Fee Income (Room-Level)
insert into public.kpi_definitions (name, version, spec_json, is_active)
select 'internal_roomrs_fee_income', 1,
'{
  "name": "internal_roomrs_fee_income",
  "description": "Roomrs-owned fees by Room",
  "group_by": ["OwnershipGroup", "Building", "Unit", "Room"],
  "filters": {
    "AgreementType": "Management",
    "entryDate_month": "$month"
  },
  "formula": "SUM( IF(GLAccountName == \"Bedroom Cleaning\", Amount, 0) + IF(GLAccountName == \"Convenience Fee\", Amount, 0) + IF(OwnershipGroup != \"Centennial Properties\" AND GLAccountName == \"Flex Fee Income\", Amount, 0) + IF(GLAccountName == \"Late Fee Income\", Amount, 0) + IF(GLAccountName == \"Lease Break Fee Income\", Amount, 0) + IF(GLAccountName == \"Membership Fee Income\", Amount, 0) )"
}'::jsonb, true
where not exists (select 1 from public.kpi_definitions where name = 'internal_roomrs_fee_income');

-- Internal 4) Management Fee (Room-Level)
insert into public.kpi_definitions (name, version, spec_json, is_active)
select 'internal_management_fee_room', 1,
'{
  "name": "internal_management_fee_room",
  "description": "Mgmt fee by Room (10% of landlord revenue at room level)",
  "group_by": ["OwnershipGroup", "Building", "Unit", "Room"],
  "depends_on": ["internal_landlord_revenue"],
  "formula": "internal_landlord_revenue * 0.10"
}'::jsonb, true
where not exists (select 1 from public.kpi_definitions where name = 'internal_management_fee_room');

-- Internal 5) Roomrs Total Revenue (Room-Level)
insert into public.kpi_definitions (name, version, spec_json, is_active)
select 'internal_roomrs_total_revenue_room', 1,
'{
  "name": "internal_roomrs_total_revenue_room",
  "description": "Roomrs revenue by Room",
  "group_by": ["OwnershipGroup", "Building", "Unit", "Room"],
  "depends_on": ["internal_management_fee_room","internal_roomrs_fee_income"],
  "formula": "internal_management_fee_room + internal_roomrs_fee_income"
}'::jsonb, true
where not exists (select 1 from public.kpi_definitions where name = 'internal_roomrs_total_revenue_room');

-- Internal 6) Take Rate % (Room-Level)
insert into public.kpi_definitions (name, version, spec_json, is_active)
select 'internal_take_rate_room_pct', 1,
'{
  "name": "internal_take_rate_room_pct",
  "description": "Take Rate by Room",
  "group_by": ["OwnershipGroup", "Building", "Unit", "Room"],
  "depends_on": ["internal_roomrs_total_revenue_room","internal_gross_revenue"],
  "formula": "SAFE_DIVIDE(internal_roomrs_total_revenue_room, internal_gross_revenue)"
}'::jsonb, true
where not exists (select 1 from public.kpi_definitions where name = 'internal_take_rate_room_pct');

-- Internal 7) Fee Attach Flag (by fee)
insert into public.kpi_definitions (name, version, spec_json, is_active)
select 'internal_attach_flag_by_fee', 1,
'{
  "name": "internal_attach_flag_by_fee",
  "description": "Per-fee flag at Room-level (1 if charged in month, else 0)",
  "group_by": ["OwnershipGroup", "Building", "Unit", "Room", "FeeType"],
  "filters": {
    "AgreementType": "Management",
    "entryDate_month": "$month"
  },
  "formula": "IF( SUM( IF(GLAccountName == FeeType, Amount, 0) ) > 0, 1, 0 )",
  "notes": "Aggregate mean of this flag over Rooms to get attach rate by Unit/Building/Owner"
}'::jsonb, true
where not exists (select 1 from public.kpi_definitions where name = 'internal_attach_flag_by_fee');

-- Internal 8) Attach Index (aggregated)
insert into public.kpi_definitions (name, version, spec_json, is_active)
select 'internal_attach_index', 1,
'{
  "name": "internal_attach_index",
  "description": "Average attach across core fees",
  "group_by": ["OwnershipGroup", "Building", "Unit"],
  "depends_on": ["internal_attach_flag_by_fee"],
  "formula": "AVG_BY_GROUP( attach_rate(Cleaning), attach_rate(Convenience), attach_rate(Membership), attach_rate(Flex) )",
  "notes": "attach_rate(Fee) = AVG of per-room attach flags for that fee within the group"
}'::jsonb, true
where not exists (select 1 from public.kpi_definitions where name = 'internal_attach_index');

-- Internal 9) Roomrs Revenue per Room (for rollups)
insert into public.kpi_definitions (name, version, spec_json, is_active)
select 'internal_roomrs_rev_per_room', 1,
'{
  "name": "internal_roomrs_rev_per_room",
  "description": "Average Roomrs revenue per room",
  "group_by": ["OwnershipGroup", "Building", "Unit"],
  "depends_on": ["internal_roomrs_total_revenue_room"],
  "formula": "AVG_BY_GROUP(internal_roomrs_total_revenue_room)"
}'::jsonb, true
where not exists (select 1 from public.kpi_definitions where name = 'internal_roomrs_rev_per_room');
