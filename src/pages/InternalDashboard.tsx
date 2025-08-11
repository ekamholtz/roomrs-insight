import { useEffect } from "react";

function setSEO(title: string, description: string) {
  document.title = title;
  const meta = document.querySelector('meta[name="description"]');
  if (meta) meta.setAttribute("content", description);
}

export default function InternalDashboard() {
  useEffect(() => {
    setSEO("Internal Console – Roomrs Financial Reporting", "Admin and finance dashboard to manage uploads, KPIs, and reports.");
  }, []);

  return (
    <main className="min-h-screen p-6 bg-background">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">Internal Console</h1>
        <p className="text-muted-foreground">Upload data, edit KPIs, and build reports.</p>
      </header>
      {/* ... keep existing code (widgets and navigation will be added later) */}
      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-lg border p-4">Upload Data</div>
        <div className="rounded-lg border p-4">Saved Mappings</div>
        <div className="rounded-lg border p-4">KPI Editor</div>
        <div className="rounded-lg border p-4">Build Report</div>
        <div className="rounded-lg border p-4">Recent Jobs</div>
      </section>
    </main>
  );
}

