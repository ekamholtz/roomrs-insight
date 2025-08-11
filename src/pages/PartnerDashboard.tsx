import { useEffect, useState } from "react";
import { useAvailableMonths, usePartnerUnitSummary } from "@/hooks/useKpis";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";


function setSEO(title: string, description: string) {
  document.title = title;
  const meta = document.querySelector('meta[name="description"]');
  if (meta) meta.setAttribute("content", description);
}

export default function PartnerDashboard() {
  useEffect(() => {
    setSEO("Partner Portal – Roomrs Statements", "View and download your scoped monthly statements.");
  }, []);

  const { data: months } = useAvailableMonths();
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedMonth && months && months.length > 0) {
      setSelectedMonth(months[0]);
    }
  }, [months, selectedMonth]);

  const { data: rows, isLoading } = usePartnerUnitSummary(selectedMonth);

  const fmtCurrency = (n: number | undefined) =>
    new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(Number(n ?? 0));
  const fmtMonth = (d: string | null | undefined) => {
    if (!d) return "—";
    const date = new Date(`${d}T00:00:00Z`);
    return date.toLocaleDateString(undefined, { year: "numeric", month: "long" });
  };

  return (
    <main className="min-h-screen p-6 bg-background">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">Partner Portal</h1>
        <p className="text-muted-foreground">Your organization’s statements and KPIs.</p>
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
<section className="space-y-4">
  <div className="text-sm text-muted-foreground">Period: {fmtMonth(selectedMonth)}</div>
  <div className="rounded-lg border overflow-x-auto">
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Unit</TableHead>
          <TableHead className="text-right">Total Revenue</TableHead>
          <TableHead className="text-right">Management Fee</TableHead>
          <TableHead className="text-right">OpEx</TableHead>
          <TableHead className="text-right">NOI</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {isLoading ? (
          <TableRow><TableCell colSpan={5}>Loading...</TableCell></TableRow>
        ) : (rows && rows.length > 0) ? (
          rows.map((r) => (
            <TableRow key={r.unit_id}>
              <TableCell>{r.unit_name}</TableCell>
              <TableCell className="text-right">{fmtCurrency(r.total_revenue)}</TableCell>
              <TableCell className="text-right">{fmtCurrency(r.management_fee)}</TableCell>
              <TableCell className="text-right">{fmtCurrency(r.total_opex)}</TableCell>
              <TableCell className="text-right">{fmtCurrency(r.noi)}</TableCell>
            </TableRow>
          ))
        ) : (
          <TableRow><TableCell colSpan={5}>No data</TableCell></TableRow>
        )}
      </TableBody>
    </Table>
  </div>
</section>
    </main>
  );
}
