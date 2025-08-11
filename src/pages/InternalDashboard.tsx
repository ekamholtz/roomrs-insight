
import { useEffect } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLatestMonth, useInternalKpiSummary } from "@/hooks/useKpis";

function setSEO(title: string, description: string) {
  document.title = title;
  const meta = document.querySelector('meta[name="description"]');
  if (meta) meta.setAttribute("content", description);
}

export default function InternalDashboard() {
  useEffect(() => {
    setSEO("Internal Console – Roomrs Financial Reporting", "Admin and finance dashboard to manage uploads, KPIs, and reports.");
  }, []);

  const { data: latestMonth } = useLatestMonth();
  const { data: kpis, isLoading } = useInternalKpiSummary(latestMonth);

  const fmtCurrency = (n: number | undefined) =>
    new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(Number(n ?? 0));
  const fmtPct = (n: number | undefined) =>
    new Intl.NumberFormat(undefined, { style: "percent", maximumFractionDigits: 1 }).format(Number(n ?? 0));
  const fmtMonth = (d: string | null | undefined) => {
    if (!d) return "—";
    const date = new Date(d);
    return date.toLocaleDateString(undefined, { year: "numeric", month: "long" });
  };

  return (
    <main className="min-h-screen p-6 bg-background">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">Internal Console</h1>
        <p className="text-muted-foreground">Upload data, run pipelines, and build reports.</p>
      </header>
<section className="space-y-4 mb-6">
  <div className="text-sm text-muted-foreground">
    Period: {fmtMonth(latestMonth)}
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

