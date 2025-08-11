import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type KpiRow = {
  kpi_name: string;
  value: number;
  period_month: string; // YYYY-MM-01
  org_id: string | null;
  building_id: string | null;
  unit_id: string | null;
  room_id: string | null;
};

export const INTERNAL_KPIS = [
  "internal_gross_revenue",
  "internal_landlord_revenue",
  "internal_roomrs_fee_income",
  "internal_management_fee",
  "internal_roomrs_total_revenue",
  "internal_take_rate_pct",
] as const;

export const PARTNER_KPIS = [
  "partner_total_revenue",
  "partner_management_fee",
  "partner_total_opex",
  "partner_noi",
] as const;

export function useAvailableMonths() {
  return useQuery({
    queryKey: ["kpi_available_months"],
    queryFn: async () => {
      // Only consider months that have raw transactions; de-duplicated and sorted desc
      const { data: tx, error: txErr } = await supabase
        .from("transactions")
        .select("period_month");
      if (txErr) throw txErr;
      const months = Array.from(new Set<string>((tx ?? []).map((r: any) => r.period_month as string)))
        .sort((a, b) => (a > b ? -1 : a < b ? 1 : 0));
      return months;
    },
  });
}

export function useLatestMonth() {
  return useQuery({
    queryKey: ["kpi_latest_month"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("kpi_results")
        .select("period_month")
        .order("period_month", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return (data?.period_month as string | undefined) ?? null;
    },
  });
}

export function useInternalKpiSummary(month: string | null | undefined) {
  return useQuery({
    enabled: !!month,
    queryKey: ["internal_kpis", month],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("kpi_results")
        .select("kpi_name,value,period_month,org_id,building_id,unit_id,room_id")
        .eq("period_month", month)
        .in("kpi_name", INTERNAL_KPIS as unknown as string[])
        .not("room_id", "is", null);
      if (error) throw error;
      const rows = (data as any[] as KpiRow[]) ?? [];
      const sumByName = new Map<string, number>();
      for (const r of rows) {
        const prev = sumByName.get(r.kpi_name) ?? 0;
        sumByName.set(r.kpi_name, prev + Number(r.value ?? 0));
      }
      const gross = sumByName.get("internal_gross_revenue") ?? 0;
      const roomrsTotal = sumByName.get("internal_roomrs_total_revenue") ?? 0;
      const landlord = sumByName.get("internal_landlord_revenue") ?? 0;
      const mgmt = sumByName.get("internal_management_fee") ?? 0;
      const feeIncome = sumByName.get("internal_roomrs_fee_income") ?? 0;
      const derivedTakeRate = gross > 0 ? roomrsTotal / gross : 0;
      return {
        gross,
        landlord,
        managementFee: mgmt,
        feeIncome,
        roomrsTotal,
        takeRate: derivedTakeRate,
      };
    },
  });
}

export type PartnerUnitSummary = {
  unit_id: string;
  unit_name: string;
  total_revenue: number;
  management_fee: number;
  total_opex: number;
  noi: number;
};

export function usePartnerUnitSummary(
  month: string | null | undefined,
  orgId?: string | null,
  buildingId?: string | null
) {
  return useQuery({
    enabled: !!month,
    queryKey: ["partner_unit_summary", month, orgId ?? "all", buildingId ?? "all"],
    queryFn: async () => {
      let query = supabase
        .from("kpi_results")
        .select("kpi_name,value,unit_id")
        .eq("period_month", month)
        .in("kpi_name", PARTNER_KPIS as unknown as string[]);
      if (orgId) query = query.eq("org_id", orgId);
      if (buildingId) query = query.eq("building_id", buildingId);
      const { data, error } = await query;
      if (error) throw error;
      const rows = (data as any[] as Pick<KpiRow, "kpi_name" | "value" | "unit_id">[]) ?? [];

      const byUnit = new Map<string, PartnerUnitSummary>();
      for (const r of rows) {
        const unit_id = (r.unit_id as string | null) ?? "";
        if (!unit_id) continue; // Only unit-level for partner
        const curr = byUnit.get(unit_id) ?? {
          unit_id,
          unit_name: "",
          total_revenue: 0,
          management_fee: 0,
          total_opex: 0,
          noi: 0,
        };
        switch (r.kpi_name) {
          case "partner_total_revenue":
            curr.total_revenue += Number(r.value ?? 0);
            break;
          case "partner_management_fee":
            curr.management_fee += Number(r.value ?? 0);
            break;
          case "partner_total_opex":
            curr.total_opex += Number(r.value ?? 0);
            break;
          case "partner_noi":
            curr.noi += Number(r.value ?? 0);
            break;
        }
        byUnit.set(unit_id, curr);
      }

      const unitIds = Array.from(byUnit.keys());
      if (unitIds.length > 0) {
        // Fetch unit names for display; RLS ensures scope for partner users
        const { data: units, error: unitsErr } = await supabase
          .from("units")
          .select("id,name")
          .in("id", unitIds);
        if (unitsErr) throw unitsErr;
        const nameById = new Map<string, string>();
        for (const u of units ?? []) nameById.set((u as any).id, (u as any).name);
        for (const id of unitIds) {
          const it = byUnit.get(id)!;
          it.unit_name = nameById.get(id) ?? id;
          byUnit.set(id, it);
        }
      }

      return Array.from(byUnit.values()).sort((a, b) => b.total_revenue - a.total_revenue);
    },
  });
}
