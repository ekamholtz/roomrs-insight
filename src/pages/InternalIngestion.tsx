
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { ingestPortfolio, ingestTransactions } from "@/lib/ingest";
import * as XLSX from "xlsx";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

export default function InternalIngestion() {
  const { toast } = useToast();
  const [portfolioJson, setPortfolioJson] = useState("");
  const [transactionsJson, setTransactionsJson] = useState("");
  const [loadingPortfolio, setLoadingPortfolio] = useState(false);
  const [loadingTransactions, setLoadingTransactions] = useState(false);

  // Excel parsing state
  const [excelPortfolioRows, setExcelPortfolioRows] = useState<any[] | null>(null);
  const [excelTransactionRows, setExcelTransactionRows] = useState<any[] | null>(null);
  const [excelFileName, setExcelFileName] = useState<string | null>(null);
  const [parsingExcel, setParsingExcel] = useState(false);

  // Options
  const [includeAllAgreements, setIncludeAllAgreements] = useState(true);
  const [portfolioIssues, setPortfolioIssues] = useState<any[] | null>(null);

  // Excel helpers
  const excelDateToISO = (n: number) => {
    const epoch = Date.UTC(1899, 11, 30);
    const ms = n * 86400000;
    return new Date(epoch + ms).toISOString();
  };

  const handleExcelFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setExcelFileName(file.name);
    setParsingExcel(true);
    try {
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data, { type: "array", cellDates: true });

      const portfolioSheet = wb.Sheets["Roomrs Portfolio"]; // exact name
      const txSheet = wb.Sheets["Transaction_Detail_by_Account"] || wb.Sheets["Transaction Detail by Account"]; // support both

      const portfolioRows = portfolioSheet ? XLSX.utils.sheet_to_json(portfolioSheet, { defval: "" }) : [];
      const txRowsRaw = txSheet ? XLSX.utils.sheet_to_json(txSheet, { defval: "", raw: true }) : [];

      // Normalize entryDate
      const txRows = (txRowsRaw as any[]).map((r) => {
        let entryDate = r.entryDate;
        if (entryDate instanceof Date) entryDate = entryDate.toISOString();
        else if (typeof entryDate === "number") entryDate = excelDateToISO(entryDate);
        return { ...r, entryDate };
      });

      setExcelPortfolioRows(portfolioRows as any[]);
      setExcelTransactionRows(txRows as any[]);
      toast({ title: "Excel parsed", description: `${portfolioRows.length} portfolio rows, ${txRows.length} transaction rows` });
    } catch (err: any) {
      console.error(err);
      toast({ title: "Failed to parse Excel", description: err?.message || String(err), variant: "destructive" as any });
    } finally {
      setParsingExcel(false);
    }
  };

  const handleImportPortfolio = async () => {
    if (!portfolioJson.trim() && !(excelPortfolioRows && excelPortfolioRows.length)) {
      toast({ title: "No data", description: "Provide Portfolio JSON or upload Excel first.", variant: "destructive" as any });
      return;
    }
    setLoadingPortfolio(true);
    try {
      const payload = portfolioJson.trim() ? portfolioJson : JSON.stringify(excelPortfolioRows);
      const result = await ingestPortfolio(payload, { includeAllAgreementTypes: includeAllAgreements });
      setPortfolioIssues((result as any).issues ?? []);
      const issuesCount = (result as any).issuesCount ?? ((result as any).issues?.length ?? 0);
      const issuesMsg = issuesCount ? ` | ${issuesCount} rows need attention` : "";
      toast({ title: "Portfolio imported", description: `Ingested ${result.ingested} of ${result.total} rows${issuesMsg}.` });
    } catch (e: any) {
      console.error(e);
      toast({ title: "Portfolio import failed", description: e?.message ?? String(e), variant: "destructive" as any });
    } finally {
      setLoadingPortfolio(false);
    }
  };

  const handleImportTransactions = async () => {
    if (!transactionsJson.trim() && !(excelTransactionRows && excelTransactionRows.length)) {
      toast({ title: "No data", description: "Provide Transactions JSON or upload Excel first.", variant: "destructive" as any });
      return;
    }
    setLoadingTransactions(true);
    try {
      const payload = transactionsJson.trim() ? transactionsJson : JSON.stringify(excelTransactionRows);
      const result = await ingestTransactions(payload);
      const msgs: string[] = [];
      if ((result as any).duplicates) msgs.push(`${(result as any).duplicates} duplicates skipped`);
      if ((result as any).unmapped) msgs.push(`${(result as any).unmapped} unmapped`);
      const suffix = msgs.length ? ` (${msgs.join(", ")})` : "";
      toast({ title: "Transactions imported", description: `Inserted ${(result as any).inserted} of ${(result as any).total} rows${suffix}.` });
    } catch (e: any) {
      console.error(e);
      toast({ title: "Transactions import failed", description: e?.message ?? String(e), variant: "destructive" as any });
    } finally {
      setLoadingTransactions(false);
    }
  };

  const downloadPortfolioIssuesCsv = () => {
    if (!portfolioIssues?.length) return;
    const headers = ["index","missing","agreement","owner","buildingName","unitName","roomName","bedrooms"];
    const esc = (v: any) => {
      const s = v === null || v === undefined ? "" : String(v);
      return '"' + s.replace(/"/g, '""') + '"';
    };
    const rows = portfolioIssues.map((i: any) => [
      i.index + 1,
      (i.missing || []).join("; "),
      i.context?.agreement ?? "",
      i.context?.owner ?? "",
      i.context?.buildingName ?? "",
      i.context?.unitName ?? "",
      i.context?.roomName ?? "",
      i.context?.bedrooms ?? "",
    ]);
    const csv = [headers.map(esc).join(','), ...rows.map(r => r.map(esc).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'portfolio_issues.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <main className="min-h-screen p-6 bg-background">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">Data Ingestion</h1>
        <p className="text-muted-foreground">Upload an Excel workbook or paste JSON to populate the database.</p>
      </header>

      {/* Excel Upload */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Upload Excel (.xlsx)</CardTitle>
          <CardDescription>
            Expecting sheets named "Roomrs Portfolio" and "Transaction_Detail_by_Account" (or "Transaction Detail by Account").
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input type="file" accept=".xlsx,.xls" onChange={handleExcelFileChange} disabled={parsingExcel} />
          {excelFileName && (
            <p className="text-sm text-muted-foreground">
              {excelFileName}: {excelPortfolioRows?.length ?? 0} portfolio rows, {excelTransactionRows?.length ?? 0} transaction rows
            </p>
          )}
          <div className="flex items-center gap-2 pt-2">
            <Switch id="include-all-excel" checked={includeAllAgreements} onCheckedChange={setIncludeAllAgreements} />
            <Label htmlFor="include-all-excel" className="text-sm text-muted-foreground">Include all agreement types (recommended)</Label>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button onClick={handleImportPortfolio} disabled={loadingPortfolio || !(excelPortfolioRows && excelPortfolioRows.length)}>
              {loadingPortfolio ? "Importing..." : "Import Portfolio from Excel"}
            </Button>
            <Button onClick={handleImportTransactions} disabled={loadingTransactions || !(excelTransactionRows && excelTransactionRows.length)}>
              {loadingTransactions ? "Importing..." : "Import Transactions from Excel"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Roomrs Portfolio (JSON)</CardTitle>
            <CardDescription>By default filters to Agreement Type = "Management". Toggle "Include all agreement types" to ingest all; creates orgs/buildings/units/rooms and updates room counts.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea
              value={portfolioJson}
              onChange={(e) => setPortfolioJson(e.target.value)}
              placeholder='Paste the Portfolio JSON array here'
              className="min-h-[260px]"
            />
            <div className="flex items-center gap-2">
              <Switch id="include-all-json" checked={includeAllAgreements} onCheckedChange={setIncludeAllAgreements} />
              <Label htmlFor="include-all-json" className="text-sm text-muted-foreground">Include all agreement types (recommended)</Label>
            </div>
            <Button onClick={handleImportPortfolio} disabled={loadingPortfolio}>
              {loadingPortfolio ? "Importing..." : "Import Portfolio"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Transaction Detail by Account (JSON)</CardTitle>
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

      {portfolioIssues && portfolioIssues.length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Data Quality Report</CardTitle>
            <CardDescription>{portfolioIssues.length} portfolio rows have missing fields. Fix the source sheet and re-ingest.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-3">
              <Button variant="secondary" onClick={downloadPortfolioIssuesCsv}>Download issues (CSV)</Button>
              <p className="text-sm text-muted-foreground">Showing first 10 issues below.</p>
            </div>
            <ul className="text-sm list-disc pl-5">
              {portfolioIssues.slice(0, 10).map((i: any, idx: number) => (
                <li key={idx}>
                  Row {i.index + 1}: missing {i.missing?.join(', ')} — {i.context?.owner} / {i.context?.buildingName} / {i.context?.unitName} / {i.context?.roomName}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

    </main>
  );
}

