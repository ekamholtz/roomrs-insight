import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { runAllPipelines } from "@/lib/pipelines";

function setSEO(title: string, description: string) {
  document.title = title;
  const meta = document.querySelector('meta[name="description"]');
  if (meta) meta.setAttribute("content", description);
}

export default function InternalPipelines() {
  const { toast } = useToast();
  const [running, setRunning] = useState(false);
  const [lastRun, setLastRun] = useState<null | { staged: number; unitOpEx: number; partner: number; internal: number }>(null);

  useEffect(() => {
    setSEO(
      "Run Pipelines – Roomrs Financial Reporting",
      "Compute StagedTransactions, UnitOpEx, PartnerRevenueSummary, and Internal Metrics."
    );
  }, []);

  const onRun = async () => {
    try {
      setRunning(true);
      const res = await runAllPipelines();
      setLastRun(res);
      toast({ title: "Pipelines completed", description: `Staged: ${res.staged}, OpEx: ${res.unitOpEx}, Partner: ${res.partner}, Internal: ${res.internal}` });
    } catch (e: any) {
      toast({ title: "Pipeline error", description: e?.message || "Unknown error" });
    } finally {
      setRunning(false);
    }
  };

  return (
    <main className="min-h-screen p-6 bg-background">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">Run Pipelines</h1>
        <p className="text-muted-foreground">Compute KPIs from staged data. Filters to Agreement Type = Management and applies the Centennial flex-fee rule.</p>
      </header>

      <section className="rounded-lg border p-6 space-y-4">
        <p>Click to compute and persist KPIs to the database (kpi_results).</p>
        <Button onClick={onRun} disabled={running}>
          {running ? "Running..." : "Run Pipelines"}
        </Button>
        {lastRun && (
          <div className="text-sm text-muted-foreground">
            Last run: Staged {lastRun.staged}, OpEx {lastRun.unitOpEx}, Partner {lastRun.partner}, Internal {lastRun.internal}
          </div>
        )}
      </section>
    </main>
  );
}
