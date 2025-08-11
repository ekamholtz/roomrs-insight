
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAvailableMonths, useInternalKpiSummary } from "@/hooks/useKpis";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

function setSEO(title: string, description: string) {
  document.title = title;
  const meta = document.querySelector('meta[name="description"]');
  if (meta) meta.setAttribute("content", description);
}

export default function InternalDashboard() {
  useEffect(() => {
    setSEO("Internal Console – Roomrs Financial Reporting", "Admin and finance dashboard to manage uploads, KPIs, and reports.");
  }, []);

  const { data: months } = useAvailableMonths();
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedMonth && months && months.length > 0) {
      setSelectedMonth(months[0]); // default to latest
    }
  }, [months, selectedMonth]);

  const { data: kpis, isLoading } = useInternalKpiSummary(selectedMonth);

  const fmtCurrency = (n: number | undefined) =>
    new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(Number(n ?? 0));
  const fmtPct = (n: number | undefined) =>
    new Intl.NumberFormat(undefined, { style: "percent", maximumFractionDigits: 1 }).format(Number(n ?? 0));
  const fmtMonth = (d: string | null | undefined) => {
    if (!d) return "—";
    const date = new Date(`${d}T00:00:00Z`); // ensure correct month in all timezones
    return date.toLocaleDateString(undefined, { year: "numeric", month: "long" });
  };

  return (
    <main className="min-h-screen p-6 bg-background">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">Internal Console</h1>
        <p className="text-muted-foreground">Upload data, run pipelines, and build reports.</p>
        <div className="mt-4 w-full max-w-xs">
          <label className="text-sm text-muted-foreground">Period</label>
          <Select value={selectedMonth ?? undefined} onValueChange={(v) => setSelectedMonth(v)}>
            <SelectTrigger className="mt-1">
              <SelectValue placeholder="Select month" />
            </SelectTrigger>
            <SelectContent align="start">
              {months?.map((m) => (
                <SelectItem key={m} value={m}>{fmtMonth(m)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </header>
<section className="space-y-4 mb-6">
  <div className="text-sm text-muted-foreground">
    Period: {fmtMonth(selectedMonth)}
  </div>
  <div className="grid gap-4 md:grid-cols-3">
    <Card>
      <CardHeader>
        <CardTitle>Gross Revenue</CardTitle>
      </CardHeader>
      <CardContent className="text-2xl font-semibold">
        {isLoading ? "Loading..." : fmtCurrency(kpis?.gross)}
      </CardContent>
    </Card>
    <Card>
      <CardHeader>
        <CardTitle>Roomrs Total Revenue</CardTitle>
      </CardHeader>
      <CardContent className="text-2xl font-semibold">
        {isLoading ? "Loading..." : fmtCurrency(kpis?.roomrsTotal)}
      </CardContent>
    </Card>
    <Card>
      <CardHeader>
        <CardTitle>Take Rate</CardTitle>
      </CardHeader>
      <CardContent className="text-2xl font-semibold">
        {isLoading ? "Loading..." : fmtPct(kpis?.takeRate)}
      </CardContent>
    </Card>
  </div>
</section>
      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Link to="/internal/ingest" className="rounded-lg border p-4 hover:bg-accent hover:text-accent-foreground transition-colors">
          Upload Data
        </Link>
        <Link to="/internal/pipelines" className="rounded-lg border p-4 hover:bg-accent hover:text-accent-foreground transition-colors">
          Run Pipelines
        </Link>
        <div className="rounded-lg border p-4">Saved Mappings</div>
        <div className="rounded-lg border p-4">KPI Editor</div>
        <div className="rounded-lg border p-4">Build Report</div>
        <div className="rounded-lg border p-4">Recent Jobs</div>
      </section>
    </main>
  );
}

