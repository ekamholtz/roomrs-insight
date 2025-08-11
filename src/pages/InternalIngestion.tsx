
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { ingestPortfolio, ingestTransactions } from "@/lib/ingest";

export default function InternalIngestion() {
  const { toast } = useToast();
  const [portfolioJson, setPortfolioJson] = useState("");
  const [transactionsJson, setTransactionsJson] = useState("");
  const [loadingPortfolio, setLoadingPortfolio] = useState(false);
  const [loadingTransactions, setLoadingTransactions] = useState(false);

  const handleImportPortfolio = async () => {
    if (!portfolioJson.trim()) {
      toast({ title: "No data", description: "Paste Roomrs Portfolio JSON first.", variant: "destructive" as any });
      return;
    }
    setLoadingPortfolio(true);
    try {
      const result = await ingestPortfolio(portfolioJson);
      toast({ title: "Portfolio imported", description: `Ingested ${result.ingested} of ${result.total} rows.` });
    } catch (e: any) {
      console.error(e);
      toast({ title: "Portfolio import failed", description: e?.message ?? String(e), variant: "destructive" as any });
    } finally {
      setLoadingPortfolio(false);
    }
  };

  const handleImportTransactions = async () => {
    if (!transactionsJson.trim()) {
      toast({ title: "No data", description: "Paste Transactions JSON first.", variant: "destructive" as any });
      return;
    }
    setLoadingTransactions(true);
    try {
      const result = await ingestTransactions(transactionsJson);
      const extra = result.unmapped ? ` (${result.unmapped} rows could not be matched to a Room)` : "";
      toast({ title: "Transactions imported", description: `Inserted ${result.inserted} of ${result.total} rows${extra}.` });
    } catch (e: any) {
      console.error(e);
      toast({ title: "Transactions import failed", description: e?.message ?? String(e), variant: "destructive" as any });
    } finally {
      setLoadingTransactions(false);
    }
  };

  return (
    <main className="min-h-screen p-6 bg-background">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">JSON Ingestion</h1>
        <p className="text-muted-foreground">Paste the two datasets to populate the database.</p>
      </header>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Roomrs Portfolio</CardTitle>
            <CardDescription>Filters to Agreement Type = "Management"; creates orgs/buildings/units/rooms and updates room counts.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea
              value={portfolioJson}
              onChange={(e) => setPortfolioJson(e.target.value)}
              placeholder='Paste the Portfolio JSON array here'
              className="min-h-[260px]"
            />
            <Button onClick={handleImportPortfolio} disabled={loadingPortfolio}>
              {loadingPortfolio ? "Importing..." : "Import Portfolio"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Transaction Detail by Account</CardTitle>
            <CardDescription>Normalizes amounts to positive; maps by Room name and inserts monthly transactions.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea
              value={transactionsJson}
              onChange={(e) => setTransactionsJson(e.target.value)}
              placeholder='Paste the Transactions JSON array here'
              className="min-h-[260px]"
            />
            <Button onClick={handleImportTransactions} disabled={loadingTransactions}>
              {loadingTransactions ? "Importing..." : "Import Transactions"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

