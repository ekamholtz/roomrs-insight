import { supabase } from "@/integrations/supabase/client";

// Helper types
export type StagedTransaction = {
  entryDate: string; // ISO date string (from period_month or entryDate)
  Month: string; // YYYY-MM
  AmountAbs: number;
  GLAccountName: string | null;
  Rooms: string | null; // room name
  "Ownership Group": string | null;
  Building: string | null;
  Unit: string | null;
  Room: string | null;
  Bedrooms: number | null; // derived from room_counts per unit
  "Agreement Type": string | null;
  IsLandlordRevenue: boolean;
  IsRoomrsFee: boolean;
  // IDs to help persistence
  org_id: string | null;
  building_id: string | null;
  unit_id: string | null;
  room_id: string | null;
  period_month: string; // YYYY-MM-01
};

function toMonth(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function monthToDate(month: string): string {
  // month: YYYY-MM -> YYYY-MM-01
  if (!month) return "";
  return `${month}-01`;
}

function safeDivide(n: number, d: number): number {
  if (!d || Math.abs(d) < 1e-9) return 0;
  return n / d;
}

export async function buildStagedTransactions(): Promise<StagedTransaction[]> {
  // 1) Fetch transactions with nested relationships
  const { data: txs, error: txErr } = await supabase
    .from("transactions")
    .select(
      `id, amount, account_name, revenue_class, period_month, room_id, unit_id, building_id, org_id,
       rooms:room_id(id, name, unit_id, units:unit_id(id, name, building_id, org_id, agreement_type)),
       organizations:org_id(id, name),
       buildings:building_id(id, name),
       units:unit_id(id, name, agreement_type)`
    );
  if (txErr) throw txErr;

  const items = txs ?? [];

  // Collect unit_ids to fetch room_counts and names maps
  const unitIds = Array.from(new Set(items.map((t: any) => t.unit_id).filter(Boolean)));

  const [{ data: rc, error: rcErr }, { data: orgs, error: orgErr }, { data: bldgs, error: bErr }, { data: units, error: uErr }] = await Promise.all([
    supabase.from("room_counts").select("unit_id, room_count"),
    supabase.from("organizations").select("id, name"),
    supabase.from("buildings").select("id, name"),
    supabase.from("units").select("id, name, agreement_type, org_id, building_id"),
  ]);
  if (rcErr) throw rcErr;
  if (orgErr) throw orgErr;
  if (bErr) throw bErr;
  if (uErr) throw uErr;

  const roomCountByUnit = new Map<string, number>();
  for (const r of rc ?? []) roomCountByUnit.set((r as any).unit_id, Number((r as any).room_count));

  const orgNameById = new Map<string, string>();
  for (const o of orgs ?? []) orgNameById.set((o as any).id, (o as any).name);

  const bldgNameById = new Map<string, string>();
  for (const b of bldgs ?? []) bldgNameById.set((b as any).id, (b as any).name);

  const unitInfoById = new Map<string, { name: string; agreement_type: string | null; org_id: string | null; building_id: string | null }>();
  for (const u of units ?? []) unitInfoById.set((u as any).id, {
    name: (u as any).name,
    agreement_type: (u as any).agreement_type ?? null,
    org_id: (u as any).org_id ?? null,
    building_id: (u as any).building_id ?? null,
  });

  // Load fee entitlement rules (data-driven classification)
  const { data: entRows, error: entErr } = await supabase
    .from("fee_entitlements")
    .select("revenue_class, entitlement, org_id, building_id, unit_id, effective_start, effective_end");
  if (entErr) throw entErr;

  type EntRow = {
    revenue_class: string | null;
    entitlement: string | null;
    org_id: string | null;
    building_id: string | null;
    unit_id: string | null;
    effective_start: string | null;
    effective_end: string | null;
  };

  const today = new Date();
  const isActive = (e: EntRow) => {
    const s = e.effective_start ? new Date(e.effective_start) : null;
    const en = e.effective_end ? new Date(e.effective_end) : null;
    if (s && s > today) return false;
    if (en && en < today) return false;
    return true;
  };

  const rulesByClass = new Map<string, EntRow[]>();
  for (const e of (entRows ?? []) as any[]) {
    const er = e as EntRow;
    if (!er.revenue_class || !er.entitlement) continue;
    if (!isActive(er)) continue;
    const key = String(er.revenue_class).toLowerCase();
    const arr = rulesByClass.get(key) ?? [];
    arr.push(er);
    rulesByClass.set(key, arr);
  }

  const getEntitlementFor = (
    org_id: string | null,
    building_id: string | null,
    unit_id: string | null,
    revClass: string
  ): string | null => {
    const list = rulesByClass.get(revClass) ?? [];
    // prioritize by specificity: unit > building > org > global
    const unitRule = list.find(r => r.unit_id && unit_id && r.unit_id === unit_id);
    if (unitRule) return String(unitRule.entitlement).toLowerCase();
    const bldgRule = list.find(r => r.building_id && building_id && r.building_id === building_id);
    if (bldgRule) return String(bldgRule.entitlement).toLowerCase();
    const orgRule = list.find(r => r.org_id && org_id && r.org_id === org_id);
    if (orgRule) return String(orgRule.entitlement).toLowerCase();
    const globalRule = list.find(r => !r.unit_id && !r.building_id && !r.org_id);
    if (globalRule) return String(globalRule.entitlement).toLowerCase();
    return null;
  };

  const toRevClass = (name: string | null): string | null => {
    if (!name) return null;
    return String(name)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
  };

  const out: StagedTransaction[] = [];
  for (const raw of items) {
    const unit_id: string | null = (raw as any).unit_id ?? (raw as any).rooms?.unit_id ?? null;
    const unitInfo = unit_id ? unitInfoById.get(unit_id) : undefined;
    const org_id: string | null = (raw as any).org_id ?? unitInfo?.org_id ?? null;
    const building_id: string | null = (raw as any).building_id ?? unitInfo?.building_id ?? null;

    const agreementType = unitInfo?.agreement_type ?? (raw as any).units?.agreement_type ?? null;

    // Filter Agreement Type = Management
    if ((agreementType || "").toLowerCase() !== "management") continue;

    const room_id: string | null = (raw as any).room_id ?? (raw as any).rooms?.id ?? null;
    const roomName: string | null = (raw as any).rooms?.name ?? null;
    const unitName: string | null = unit_id ? unitInfoById.get(unit_id)?.name ?? null : null;
    const orgName: string | null = org_id ? orgNameById.get(org_id) ?? null : (raw as any).organizations?.name ?? null;
    const bldgName: string | null = building_id ? bldgNameById.get(building_id) ?? null : (raw as any).buildings?.name ?? null;

    const amount = Number((raw as any).amount ?? 0);
    const period_month = (raw as any).period_month as string; // YYYY-MM-DD

    const monthStr = toMonth(period_month);

    const gl = (raw as any).account_name ?? null;

    const txnRevClass: string | null = (raw as any).revenue_class ?? null;
    const revClass: string | null = txnRevClass ?? toRevClass(gl);

    const entitlement = revClass ? getEntitlementFor(org_id, building_id, unit_id, revClass) : null;

    const isLandlordRevenue = entitlement === "landlord";
    const isRoomrsFee = entitlement === "roomrs";

    out.push({
      entryDate: period_month, // normalized to first of month already
      Month: monthStr,
      AmountAbs: Math.abs(amount),
      GLAccountName: gl,
      Rooms: roomName,
      "Ownership Group": orgName,
      Building: bldgName,
      Unit: unitName,
      Room: roomName,
      Bedrooms: unit_id ? roomCountByUnit.get(unit_id) ?? null : null,
      "Agreement Type": agreementType,
      IsLandlordRevenue: !!isLandlordRevenue,
      IsRoomrsFee: !!isRoomrsFee,
      org_id,
      building_id,
      unit_id,
      room_id,
      period_month,
    });
  }

  return out;
}

export type UnitOpExRow = {
  "Ownership Group": string | null;
  Building: string | null;
  Unit: string | null;
  RoomCount: number;
  Cleaning: number;
  Electricity: number;
  Gas: number;
  SmartLocks: number;
  TotalOpEx: number;
  org_id: string | null;
  building_id: string | null;
  unit_id: string | null;
};

export async function buildUnitOpEx(): Promise<UnitOpExRow[]> {
  // Use room_counts joined to units/orgs/buildings, filter to Management units
  const { data: units, error: uErr } = await supabase
    .from("units")
    .select("id, name, agreement_type, org_id, building_id");
  if (uErr) throw uErr;

  const managementUnitIds = new Set((units ?? []).filter((u: any) => ((u.agreement_type ?? "").toLowerCase() === "management")).map((u: any) => u.id));

  const { data: rc, error: rcErr } = await supabase
    .from("room_counts")
    .select("unit_id, room_count, org_id, building_id");
  if (rcErr) throw rcErr;

  const unitNameById = new Map<string, string>();
  const orgIdByUnit = new Map<string, string | null>();
  const bldgIdByUnit = new Map<string, string | null>();
  for (const u of units ?? []) {
    unitNameById.set((u as any).id, (u as any).name);
    orgIdByUnit.set((u as any).id, (u as any).org_id ?? null);
    bldgIdByUnit.set((u as any).id, (u as any).building_id ?? null);
  }

  const { data: orgs, error: orgErr } = await supabase.from("organizations").select("id, name");
  if (orgErr) throw orgErr;
  const { data: bldgs, error: bErr } = await supabase.from("buildings").select("id, name");
  if (bErr) throw bErr;

  const orgNameById = new Map<string, string>();
  for (const o of orgs ?? []) orgNameById.set((o as any).id, (o as any).name);
  const bldgNameById = new Map<string, string>();
  for (const b of bldgs ?? []) bldgNameById.set((b as any).id, (b as any).name);

  const out: UnitOpExRow[] = [];
  for (const r of rc ?? []) {
    const unit_id = (r as any).unit_id as string;
    if (!managementUnitIds.has(unit_id)) continue;

    const roomCount = Number((r as any).room_count ?? 0);
    const org_id = orgIdByUnit.get(unit_id) ?? null;
    const building_id = bldgIdByUnit.get(unit_id) ?? null;

    const Cleaning = 75 + 15 * roomCount;
    const Electricity = 150 * roomCount;
    const Gas = 25 * roomCount;
    const SmartLocks = 30;
    const TotalOpEx = Cleaning + Electricity + Gas + SmartLocks;

    out.push({
      "Ownership Group": org_id ? orgNameById.get(org_id) ?? null : null,
      Building: building_id ? bldgNameById.get(building_id) ?? null : null,
      Unit: unitNameById.get(unit_id) ?? null,
      RoomCount: roomCount,
      Cleaning,
      Electricity,
      Gas,
      SmartLocks,
      TotalOpEx,
      org_id,
      building_id,
      unit_id,
    });
  }

  return out;
}

export type PartnerRevenueRow = {
  "Ownership Group": string | null;
  Building: string | null;
  Unit: string | null;
  Month: string; // YYYY-MM
  RoomCount: number | null;
  TotalRevenue: number;
  ManagementFee: number;
  Cleaning: number | null;
  Electricity: number | null;
  Gas: number | null;
  SmartLocks: number | null;
  TotalOpEx: number | null;
  NOI: number;
  org_id: string | null;
  building_id: string | null;
  unit_id: string | null;
  period_month: string; // YYYY-MM-01
};

export function buildPartnerRevenueSummary(staged: StagedTransaction[], unitOpEx: UnitOpExRow[]): PartnerRevenueRow[] {
  // Index OpEx by unit_id
  const opexByUnit = new Map<string, UnitOpExRow>();
  for (const u of unitOpEx) if (u.unit_id) opexByUnit.set(u.unit_id, u);

  // Group by unit_id + month
  type Key = string;
  const agg = new Map<Key, { total: number; sample: StagedTransaction | null }>();

  for (const s of staged) {
    if (!s.IsLandlordRevenue) continue;
    const key = `${s.unit_id ?? ""}::${s.Month}`;
    const curr = agg.get(key) ?? { total: 0, sample: null };
    curr.total += s.AmountAbs;
    curr.sample = curr.sample ?? s;
    agg.set(key, curr);
  }

  const out: PartnerRevenueRow[] = [];
  for (const [key, { total, sample }] of agg.entries()) {
    if (!sample) continue;
    const unit_id = sample.unit_id;
    const period_month = monthToDate(sample.Month);
    const opex = unit_id ? opexByUnit.get(unit_id) : undefined;
    const ManagementFee = total * 0.1;
    const TotalOpEx = opex?.TotalOpEx ?? null;
    const NOI = total - ManagementFee - (TotalOpEx ?? 0);

    out.push({
      "Ownership Group": sample["Ownership Group"],
      Building: sample.Building,
      Unit: sample.Unit,
      Month: sample.Month,
      RoomCount: opex?.RoomCount ?? null,
      TotalRevenue: total,
      ManagementFee,
      Cleaning: opex?.Cleaning ?? null,
      Electricity: opex?.Electricity ?? null,
      Gas: opex?.Gas ?? null,
      SmartLocks: opex?.SmartLocks ?? null,
      TotalOpEx,
      NOI,
      org_id: sample.org_id,
      building_id: sample.building_id,
      unit_id: sample.unit_id,
      period_month,
    });
  }

  return out;
}

export type InternalMetricsRow = {
  "Ownership Group": string | null;
  Building: string | null;
  Unit: string | null;
  Room: string | null;
  Month: string; // YYYY-MM
  GrossRevenue: number;
  LandlordRevenue: number;
  RoomrsFeeIncome: number;
  ManagementFee: number;
  RoomrsTotalRevenue: number;
  TakeRatePct: number;
  org_id: string | null;
  building_id: string | null;
  unit_id: string | null;
  room_id: string | null;
  period_month: string; // YYYY-MM-01
};

export function buildRoomrsInternalMetrics(staged: StagedTransaction[]): InternalMetricsRow[] {
  type Key = string;
  const agg = new Map<Key, {
    gross: number;
    landlord: number;
    fees: number;
    sample: StagedTransaction | null;
  }>();

  for (const s of staged) {
    const key = `${s.room_id ?? ""}::${s.Month}`;
    const curr = agg.get(key) ?? { gross: 0, landlord: 0, fees: 0, sample: null };
    curr.gross += s.AmountAbs;
    if (s.IsLandlordRevenue) curr.landlord += s.AmountAbs;
    if (s.IsRoomrsFee) curr.fees += s.AmountAbs;
    curr.sample = curr.sample ?? s;
    agg.set(key, curr);
  }

  const out: InternalMetricsRow[] = [];
  for (const [_, { gross, landlord, fees, sample }] of agg) {
    if (!sample) continue;
    const ManagementFee = landlord * 0.1;
    const RoomrsTotalRevenue = ManagementFee + fees;
    const TakeRatePct = safeDivide(RoomrsTotalRevenue, gross);

    out.push({
      "Ownership Group": sample["Ownership Group"],
      Building: sample.Building,
      Unit: sample.Unit,
      Room: sample.Room,
      Month: sample.Month,
      GrossRevenue: gross,
      LandlordRevenue: landlord,
      RoomrsFeeIncome: fees,
      ManagementFee,
      RoomrsTotalRevenue,
      TakeRatePct,
      org_id: sample.org_id,
      building_id: sample.building_id,
      unit_id: sample.unit_id,
      room_id: sample.room_id,
      period_month: monthToDate(sample.Month),
    });
  }

  return out;
}

async function deleteExistingKpis(kpiName: string, keys: { unit_id?: string | null; room_id?: string | null; period_month: string }[]) {
  // Delete narrowly: by (period_month, room_id) or (period_month, unit_id)
  const pairsRoom = Array.from(
    new Set(keys.filter(k => k.room_id).map(k => `${k.period_month}::${k.room_id}`))
  ).map(s => {
    const [pm, rid] = s.split("::");
    return { period_month: pm, room_id: rid };
  });

  const pairsUnit = Array.from(
    new Set(keys.filter(k => !k.room_id && k.unit_id).map(k => `${k.period_month}::${k.unit_id}`))
  ).map(s => {
    const [pm, uid] = s.split("::");
    return { period_month: pm, unit_id: uid };
  });

  // Chunk to avoid too many parallel deletions
  const chunk = async <T,>(arr: T[], size = 50) => {
    for (let i = 0; i < arr.length; i += size) {
      const batch = arr.slice(i, i + size);
      await Promise.all(batch.map(async (it: any) => {
        let q = supabase.from("kpi_results").delete().eq("kpi_name", kpiName).eq("period_month", it.period_month);
        if (it.room_id) q = q.eq("room_id", it.room_id);
        if (it.unit_id) q = q.eq("unit_id", it.unit_id);
        const { error } = await q;
        if (error) throw error;
      }));
    }
  };

  await chunk(pairsRoom);
  await chunk(pairsUnit);
}


async function insertKpis(rows: { kpi_name: string; value: number; org_id: string | null; building_id: string | null; unit_id: string | null; room_id: string | null; period_month: string; }[]) {
  if (rows.length === 0) return;
  const { error } = await supabase.from("kpi_results").insert(rows);
  if (error) throw error;
}

export async function persistPartnerKPIs(partner: PartnerRevenueRow[]) {
  const toRows = (name: string, getter: (r: PartnerRevenueRow) => number | null) =>
    partner
      .map(r => ({
        kpi_name: name,
        value: Number(getter(r) ?? 0),
        org_id: r.org_id,
        building_id: r.building_id,
        unit_id: r.unit_id,
        room_id: null,
        period_month: r.period_month,
      }))
      .filter(r => !isNaN(r.value));

  const rows_total = [
    ...toRows("partner_total_revenue", r => r.TotalRevenue),
    ...toRows("partner_management_fee", r => r.ManagementFee),
    ...toRows("partner_total_opex", r => r.TotalOpEx ?? 0),
    ...toRows("partner_noi", r => r.NOI),
  ];

  await deleteExistingKpis("partner_total_revenue", rows_total.map(r => ({ period_month: r.period_month })) as any);
  await deleteExistingKpis("partner_management_fee", rows_total.map(r => ({ period_month: r.period_month })) as any);
  await deleteExistingKpis("partner_total_opex", rows_total.map(r => ({ period_month: r.period_month })) as any);
  await deleteExistingKpis("partner_noi", rows_total.map(r => ({ period_month: r.period_month })) as any);

  await insertKpis(rows_total);
}

export async function persistInternalKPIs(internal: InternalMetricsRow[]) {
  const toRows = (name: string, getter: (r: InternalMetricsRow) => number | null) =>
    internal
      .map(r => ({
        kpi_name: name,
        value: Number(getter(r) ?? 0),
        org_id: r.org_id,
        building_id: r.building_id,
        unit_id: r.unit_id,
        room_id: r.room_id,
        period_month: r.period_month,
      }))
      .filter(r => !isNaN(r.value));

  const rows_total = [
    ...toRows("internal_gross_revenue", r => r.GrossRevenue),
    ...toRows("internal_landlord_revenue", r => r.LandlordRevenue),
    ...toRows("internal_roomrs_fee_income", r => r.RoomrsFeeIncome),
    ...toRows("internal_management_fee", r => r.ManagementFee),
    ...toRows("internal_roomrs_total_revenue", r => r.RoomrsTotalRevenue),
    ...toRows("internal_take_rate_pct", r => r.TakeRatePct),
  ];

  await deleteExistingKpis("internal_gross_revenue", rows_total.map(r => ({ period_month: r.period_month })) as any);
  await deleteExistingKpis("internal_landlord_revenue", rows_total.map(r => ({ period_month: r.period_month })) as any);
  await deleteExistingKpis("internal_roomrs_fee_income", rows_total.map(r => ({ period_month: r.period_month })) as any);
  await deleteExistingKpis("internal_management_fee", rows_total.map(r => ({ period_month: r.period_month })) as any);
  await deleteExistingKpis("internal_roomrs_total_revenue", rows_total.map(r => ({ period_month: r.period_month })) as any);
  await deleteExistingKpis("internal_take_rate_pct", rows_total.map(r => ({ period_month: r.period_month })) as any);

  await insertKpis(rows_total);
}

export async function runAllPipelines() {
  const staged = await buildStagedTransactions();
  const unitOpEx = await buildUnitOpEx();
  const partner = buildPartnerRevenueSummary(staged, unitOpEx);
  const internal = buildRoomrsInternalMetrics(staged);

  await persistPartnerKPIs(partner);
  await persistInternalKPIs(internal);

  // Audit log
  await supabase.from("audit_logs").insert({
    action: "run_pipelines",
    entity_type: "kpi_results",
    details: {
      staged_rows: staged.length,
      unit_opex_rows: unitOpEx.length,
      partner_rows: partner.length,
      internal_rows: internal.length,
    } as any,
  });

  return { staged: staged.length, unitOpEx: unitOpEx.length, partner: partner.length, internal: internal.length };
}
