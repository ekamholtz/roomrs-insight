import { supabase } from "@/integrations/supabase/client";

/**
 * Helpers for ingesting Portfolio and Transactions JSON into Supabase.
 * Notes:
 * - Portfolio: filters Agreement Type = "Management", upserts org/building/unit/room, updates units.agreement_type,
 *   and writes room_counts per Unit as max(Bedrooms).
 * - Transactions: normalizes amount to positive, computes period_month as YYYY-MM-01, maps by Room name to IDs.
 * - Console logs are used extensively to follow flow during debugging.
 */

type PortfolioRow = {
  ["Agreement Type"]: string;
  ["Ownership Group"]: string;
  ["Building"]: string;
  ["Unit"]: string;
  ["Room"]: string;
  ["Bedrooms"]: number;
  ["Bathrooms"]?: number;
};

type TransactionRow = {
  entryDate: string; // ISO string
  amount: number;
  GLAccountName: string;
  Rooms: string; // Room name matches Portfolio "Room"
};

function monthStart(dateStr: string): string {
  const d = new Date(dateStr);
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${year}-${month}-01`;
}

// Normalize room/unit names for matching: unify dashes, collapse whitespace, lowercase
function normalizeName(s: string | undefined | null): string {
  if (!s) return "";
  return String(s)
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\u2012\u2013\u2014\u2212-]+/g, " ") // dash-like to space
    .replace(/\s+/g, " ")
    .trim();
}

async function findOrCreateOrganization(name: string): Promise<string> {
  console.log("findOrCreateOrganization", name);
  const { data: existing, error: selErr } = await supabase
    .from("organizations")
    .select("id")
    .eq("name", name)
    .limit(1)
    .maybeSingle();

  if (selErr) throw selErr;
  if (existing?.id) return existing.id;

  const { data: inserted, error: insErr } = await supabase
    .from("organizations")
    .insert({ name })
    .select("id")
    .single();

  if (insErr) throw insErr;
  return inserted.id;
}

async function findOrCreateBuilding(org_id: string, name: string): Promise<string> {
  console.log("findOrCreateBuilding", org_id, name);
  const { data: existing, error: selErr } = await supabase
    .from("buildings")
    .select("id")
    .eq("org_id", org_id)
    .eq("name", name)
    .limit(1)
    .maybeSingle();

  if (selErr) throw selErr;
  if (existing?.id) return existing.id;

  const { data: inserted, error: insErr } = await supabase
    .from("buildings")
    .insert({ org_id, name })
    .select("id")
    .single();

  if (insErr) throw insErr;
  return inserted.id;
}

async function findOrCreateUnit(org_id: string, building_id: string, name: string, agreement_type?: string): Promise<string> {
  console.log("findOrCreateUnit", org_id, building_id, name, agreement_type);
  const { data: existing, error: selErr } = await supabase
    .from("units")
    .select("id, agreement_type")
    .eq("org_id", org_id)
    .eq("building_id", building_id)
    .eq("name", name)
    .limit(1)
    .maybeSingle();

  if (selErr) throw selErr;
  if (existing?.id) {
    // Update agreement_type if provided and different
    if (agreement_type && existing.agreement_type !== agreement_type) {
      const { error: updErr } = await supabase
        .from("units")
        .update({ agreement_type })
        .eq("id", existing.id);
      if (updErr) throw updErr;
    }
    return existing.id;
  }

  const { data: inserted, error: insErr } = await supabase
    .from("units")
    .insert({ org_id, building_id, name, agreement_type })
    .select("id")
    .single();

  if (insErr) throw insErr;
  return inserted.id;
}

async function findOrCreateRoom(unit_id: string, name: string): Promise<string> {
  console.log("findOrCreateRoom", unit_id, name);
  const { data: existing, error: selErr } = await supabase
    .from("rooms")
    .select("id")
    .eq("unit_id", unit_id)
    .eq("name", name)
    .limit(1)
    .maybeSingle();

  if (selErr) throw selErr;
  if (existing?.id) return existing.id;

  const { data: inserted, error: insErr } = await supabase
    .from("rooms")
    .insert({ unit_id, name })
    .select("id")
    .single();

  if (insErr) throw insErr;
  return inserted.id;
}

export async function ingestPortfolio(jsonText: string, options?: { includeAllAgreementTypes?: boolean }) {
  console.log("ingestPortfolio start");
  const rows: PortfolioRow[] = JSON.parse(jsonText);

  const includeAll = options?.includeAllAgreementTypes ?? false;
  const filtered = includeAll
    ? rows
    : rows.filter(r => (r["Agreement Type"] || "").trim().toLowerCase() === "management");
  console.log(`Portfolio rows (${includeAll ? "including all agreement types" : "filtered to Management"}): ${filtered.length} / ${rows.length}`);

  const orgCache = new Map<string, string>();
  const buildingCache = new Map<string, { id: string; org_id: string }>();
  const unitCache = new Map<string, { id: string; org_id: string; building_id: string }>();
  const unitBedrooms = new Map<string, number>(); // unit_id -> max bedrooms

  for (const r of filtered) {
    const owner = r["Ownership Group"].trim();
    const buildingName = r["Building"].trim();
    const unitName = r["Unit"].trim();
    const roomName = r["Room"].trim();
    const bedrooms = Number(r["Bedrooms"] ?? 0);
    const agreement = r["Agreement Type"]?.trim();

    // Org
    const orgKey = owner.toLowerCase();
    let org_id = orgCache.get(orgKey);
    if (!org_id) {
      org_id = await findOrCreateOrganization(owner);
      orgCache.set(orgKey, org_id);
    }

    // Building
    const bKey = `${org_id}::${buildingName.toLowerCase()}`;
    let buildingEntry = buildingCache.get(bKey);
    if (!buildingEntry) {
      const building_id = await findOrCreateBuilding(org_id, buildingName);
      buildingEntry = { id: building_id, org_id };
      buildingCache.set(bKey, buildingEntry);
    }

    // Unit
    const uKey = `${buildingEntry.id}::${unitName.toLowerCase()}`;
    let unitEntry = unitCache.get(uKey);
    if (!unitEntry) {
      const unit_id = await findOrCreateUnit(buildingEntry.org_id, buildingEntry.id, unitName, agreement);
      unitEntry = { id: unit_id, org_id: buildingEntry.org_id, building_id: buildingEntry.id };
      unitCache.set(uKey, unitEntry);
    } else if (agreement) {
      // ensure agreement type is set (idempotent)
      await findOrCreateUnit(buildingEntry.org_id, buildingEntry.id, unitName, agreement);
    }

    // Room
    await findOrCreateRoom(unitEntry.id, roomName);

    // Bedrooms per unit -> keep max
    const prev = unitBedrooms.get(unitEntry.id) ?? 0;
    if (bedrooms > prev) unitBedrooms.set(unitEntry.id, bedrooms);
  }

  // Write room_counts per Unit (delete existing for touched units to avoid duplicates)
  const touchedUnitIds = Array.from(unitBedrooms.keys());
  if (touchedUnitIds.length > 0) {
    console.log("Cleaning existing room_counts for units:", touchedUnitIds.length);
    const { error: delErr } = await supabase
      .from("room_counts")
      .delete()
      .in("unit_id", touchedUnitIds);
    if (delErr) throw delErr;

    const toInsert: any[] = [];
    for (const [unit_id, room_count] of unitBedrooms.entries()) {
      // find org_id and building_id for this unit
      const entry = Array.from(unitCache.values()).find(u => u.id === unit_id);
      if (!entry) continue;
      toInsert.push({
        org_id: entry.org_id,
        building_id: entry.building_id,
        unit_id,
        room_count,
      });
    }

    if (toInsert.length > 0) {
      console.log("Inserting room_counts rows:", toInsert.length);
      const { error: insErr } = await supabase.from("room_counts").insert(toInsert);
      if (insErr) throw insErr;
    }
  }

  // Audit log
  await supabase.from("audit_logs").insert({
    action: "ingest_portfolio",
    entity_type: "portfolio_json",
    details: { rows_total: rows.length, rows_ingested: filtered.length, include_all_agreements: includeAll } as any,
  });

  console.log("ingestPortfolio done");
  return { ingested: filtered.length, total: rows.length };
}

export async function ingestTransactions(jsonText: string) {
  console.log("ingestTransactions start");
  const rows: TransactionRow[] = JSON.parse(jsonText);

  const dateOnly = (s: string) => {
    if (!s) return null as any;
    try {
      const d = new Date(s);
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${d.getFullYear()}-${month}-${day}`;
    } catch {
      return null as any;
    }
  };

// Load optional mapping profile "default"
let mapping: Record<string, string> = {};
{
  const { data: mp, error: mpErr } = await supabase
    .from("mapping_profiles")
    .select("mapping_json")
    .eq("name", "default")
    .maybeSingle();
  if (!mpErr && (mp as any)?.mapping_json) {
    mapping = (mp as any).mapping_json as Record<string, string>;
  }
}

const normMap = new Map<string, string>();
for (const [k, v] of Object.entries(mapping)) {
  normMap.set(normalizeName(k), v);
}

const dashToSpace = (s: string) => s.replace(/[\u2012\u2013\u2014\u2212-]+/g, " ").replace(/\s+/g, " ").trim();

// Collect candidate room names to fetch
const namesToFetchSet = new Set<string>();
for (const r of rows) {
  const raw = (r.Rooms || "").trim();
  if (!raw) continue;
  const norm = normalizeName(raw);
  const mapped = (mapping as any)[raw] ?? normMap.get(norm);
  const variant = dashToSpace(raw);
  namesToFetchSet.add(raw);
  if (variant && variant !== raw) namesToFetchSet.add(variant);
  if (mapped) {
    namesToFetchSet.add(mapped);
    const mappedVariant = dashToSpace(mapped);
    if (mappedVariant && mappedVariant !== mapped) namesToFetchSet.add(mappedVariant);
  }
}
const namesToFetch = Array.from(namesToFetchSet);
if (namesToFetch.length === 0) return { inserted: 0, total: rows.length, unmapped: rows.length, duplicates: 0 } as any;

// Fetch rooms with their parent unit org/building
const { data: rooms, error: roomsErr } = await supabase
  .from("rooms")
  .select("id, name, unit_id, units:unit_id(id, building_id, org_id)")
  .in("name", namesToFetch);

if (roomsErr) throw roomsErr;

const roomByExact = new Map<string, { room_id: string; unit_id: string; building_id: string | null; org_id: string | null }>();
const roomByNorm = new Map<string, { room_id: string; unit_id: string; building_id: string | null; org_id: string | null }>();
for (const r of rooms ?? []) {
  const name: string = (r as any).name;
  const unit = (r as any).units;
  const info = {
    room_id: (r as any).id,
    unit_id: unit?.id ?? (r as any).unit_id,
    building_id: unit?.building_id ?? null,
    org_id: unit?.org_id ?? null,
  };
  roomByExact.set(name, info);
  roomByNorm.set(normalizeName(name), info);
}

// Resolve by mapped/raw/norm with fallbacks
const resolveRoomInfo = (rawName: string) => {
  const rawTrim = (rawName || "").trim();
  const norm = normalizeName(rawTrim);
  const mapped = (mapping as any)[rawTrim] ?? normMap.get(norm) ?? null;

  if (mapped) {
    const byExact = roomByExact.get(mapped);
    if (byExact) return byExact;
    const byNorm = roomByNorm.get(normalizeName(mapped));
    if (byNorm) return byNorm;
  }
  const byExactRaw = roomByExact.get(rawTrim);
  if (byExactRaw) return byExactRaw;
  const variant = rawTrim.replace(/[\u2012\u2013\u2014\u2212-]+/g, " ").replace(/\s+/g, " ").trim();
  const byExactVariant = roomByExact.get(variant);
  if (byExactVariant) return byExactVariant;
  const byNormRaw = roomByNorm.get(norm);
  if (byNormRaw) return byNormRaw;
  return null;
};

// Prepare inserts
const inserts = rows.map(src => {
  const info = resolveRoomInfo(src.Rooms || "");
  const amountAbs = Math.abs(Number(src.amount || 0));

  return {
    amount: amountAbs,
    account_name: src.GLAccountName,
    period_month: monthStart(src.entryDate), // YYYY-MM-01
    entry_date: dateOnly(src.entryDate), // exact entry date for idempotency
    org_id: info?.org_id ?? null,
    building_id: info?.building_id ?? null,
    unit_id: info?.unit_id ?? null,
    room_id: info?.room_id ?? null,
    extra_json: { source_entry_date: src.entryDate, original_amount: src.amount, normalized_to_positive: true } as any,
  };
});

  // Filter out rows that couldn't be mapped to a room
  const validInserts = inserts.filter(i => i.room_id);
  console.log(`Transactions prepared: ${inserts.length}, with room match: ${validInserts.length}`);

  // In-memory de-duplication within this batch on (room_id, account_name, entry_date, amount)
  const seen = new Set<string>();
  const deduped: typeof validInserts = [] as any;
  let batchDuplicates = 0;
  for (const i of validInserts) {
    const key = `${i.room_id}|${i.account_name ?? ""}|${i.entry_date}|${i.amount}`;
    if (seen.has(key)) {
      batchDuplicates++;
      continue;
    }
    seen.add(key);
    (deduped as any).push(i);
  }

  let insertedCount = 0;
  let existingDuplicatesSkipped = 0;

  if (deduped.length > 0) {
    const { data, error: upErr } = await supabase
      .from("transactions")
      .upsert(deduped, { onConflict: "room_id,account_name,entry_date,amount", ignoreDuplicates: true })
      .select("id");
    if (upErr) throw upErr;
    insertedCount = data?.length ?? 0;
    existingDuplicatesSkipped = deduped.length - insertedCount;
  }

  const unmapped = inserts.length - validInserts.length;
  const duplicates = batchDuplicates + existingDuplicatesSkipped;

  // Audit log
  await supabase.from("audit_logs").insert({
    action: "ingest_transactions",
    entity_type: "transactions_json",
    details: {
      rows_total: rows.length,
      rows_inserted: insertedCount,
      deduped_in_batch: batchDuplicates,
      duplicates_skipped_existing: existingDuplicatesSkipped,
      unmapped_rooms: unmapped,
    } as any,
  });

  console.log("ingestTransactions done");
  return { inserted: insertedCount, total: rows.length, unmapped, duplicates } as any;
}
