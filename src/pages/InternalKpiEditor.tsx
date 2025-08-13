import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

function setSEO(title: string, description: string) {
  if (typeof document !== "undefined") {
    document.title = title;
    const desc = document.querySelector('meta[name="description"]');
    if (desc) desc.setAttribute("content", description);
    else {
      const m = document.createElement("meta");
      m.name = "description";
      m.content = description;
      document.head.appendChild(m);
    }
    let canonical = document.querySelector("link[rel=canonical]") as HTMLLinkElement | null;
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.rel = "canonical";
      document.head.appendChild(canonical);
    }
    canonical.href = window.location.href;
  }
}

export default function InternalKpiEditor() {
  const [definitions, setDefinitions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editJson, setEditJson] = useState<string>("");

  useEffect(() => {
    setSEO("KPI Definitions Editor - Internal", "Manage active KPI definitions and specs.");
    loadDefinitions();
  }, []);

  async function loadDefinitions() {
    setLoading(true);
    try {
      const { data, error } = await supabase.from("kpi_definitions").select("*").order("name");
      if (error) throw error;
      setDefinitions(data || []);
    } catch (e: any) {
      toast.error(e.message || "Failed to load KPI definitions");
    } finally {
      setLoading(false);
    }
  }

  async function toggleActive(id: string, current: boolean) {
    try {
      const { error } = await supabase.from("kpi_definitions").update({ is_active: !current }).eq("id", id);
      if (error) throw error;
      setDefinitions((defs) => defs.map((d) => (d.id === id ? { ...d, is_active: !current } : d)));
      toast.success(!current ? "Activated" : "Deactivated");
    } catch (e: any) {
      toast.error(e.message || "Not allowed to change active state");
    }
  }

  function beginEdit(def: any) {
    setEditingId(def.id);
    setEditJson(JSON.stringify(def.spec_json ?? {}, null, 2));
  }

  async function saveEdit() {
    if (!editingId) return;
    try {
      let parsed: any = {};
      if (editJson.trim()) parsed = JSON.parse(editJson);
      const { error } = await supabase.from("kpi_definitions").update({ spec_json: parsed }).eq("id", editingId);
      if (error) throw error;
      setDefinitions((defs) => defs.map((d) => (d.id === editingId ? { ...d, spec_json: parsed } : d)));
      toast.success("Saved");
      setEditingId(null);
    } catch (e: any) {
      toast.error(e.message || "Invalid JSON or not allowed");
    }
  }

  return (
    <main className="container mx-auto p-6">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">KPI Definitions Editor</h1>
        <p className="text-muted-foreground mt-1">View and manage KPI definitions used by pipelines.</p>
      </header>

      <section aria-labelledby="kpi-list">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Version</TableHead>
              <TableHead>Active</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {definitions.map((def) => (
              <>
                <TableRow key={def.id}>
                  <TableCell className="font-medium">{def.name}</TableCell>
                  <TableCell>{def.version}</TableCell>
                  <TableCell>
                    <Switch checked={!!def.is_active} onCheckedChange={() => toggleActive(def.id, def.is_active)} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="secondary" size="sm" onClick={() => beginEdit(def)}>
                      Edit JSON
                    </Button>
                  </TableCell>
                </TableRow>
                {editingId === def.id && (
                  <TableRow>
                    <TableCell colSpan={4}>
                      <div className="space-y-3">
                        <Textarea value={editJson} onChange={(e) => setEditJson(e.target.value)} rows={10} />
                        <div className="flex gap-2 justify-end">
                          <Button variant="ghost" onClick={() => setEditingId(null)}>Cancel</Button>
                          <Button onClick={saveEdit}>Save</Button>
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </>
            ))}
            {definitions.length === 0 && !loading && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground">No KPI definitions found.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </section>
    </main>
  );
}
