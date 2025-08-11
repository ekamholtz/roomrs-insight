import { useEffect } from "react";

function setSEO(title: string, description: string) {
  document.title = title;
  const meta = document.querySelector('meta[name="description"]');
  if (meta) meta.setAttribute("content", description);
}

export default function PartnerDashboard() {
  useEffect(() => {
    setSEO("Partner Portal – Roomrs Statements", "View and download your scoped monthly statements.");
  }, []);

  return (
    <main className="min-h-screen p-6 bg-background">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">Partner Portal</h1>
        <p className="text-muted-foreground">Your organization’s statements and KPIs.</p>
      </header>
      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border p-4">KPI Summary (coming soon)</div>
        <div className="rounded-lg border p-4">Statements (coming soon)</div>
      </section>
    </main>
  );
}
