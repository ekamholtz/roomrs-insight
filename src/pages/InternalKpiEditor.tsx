import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

  // Create form state
  const [showCreate, setShowCreate] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createVersion, setCreateVersion] = useState<string>("1");
  const [createActive, setCreateActive] = useState<boolean>(false);
  const [createSpec, setCreateSpec] = useState<string>("{\n  \"formula\": \"\"\n}");

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

  async function createNew() {
    try {
      const name = createName.trim();
      if (!name) {
        toast.error("Name is required");
        return;
      }
      let spec: any = {};
      if (createSpec.trim()) spec = JSON.parse(createSpec);
      const version = Math.max(1, parseInt(createVersion || "1", 10) || 1);
      const { error } = await supabase.from("kpi_definitions").insert({
        name,
        version,
        is_active: createActive,
        spec_json: spec,
      });
      if (error) throw error;
      toast.success("KPI created");
      setCreateName("");
      setCreateVersion("1");
      setCreateActive(false);
      setCreateSpec("{\n  \"formula\": \"\"\n}");
      setShowCreate(false);
      await loadDefinitions();
    } catch (e: any) {
      toast.error(e.message || "Failed to create KPI (check JSON)");
    }
  }

  return (
    <main className="container mx-auto p-6">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">KPI Definitions Editor</h1>
        <p className="text-muted-foreground mt-1">View and manage KPI definitions used by pipelines.</p>
      </header>

      <section className="mb-6" aria-labelledby="create-kpi">
        <div className="flex items-center justify-between mb-3">
          <h2 id="create-kpi" className="text-lg font-medium">Add New KPI</h2>
          <Button variant="secondary" onClick={() => setShowCreate((v) => !v)}>
            {showCreate ? "Close" : "Add KPI"}
          </Button>
        </div>
        {showCreate && (
          <div className="bg-card border rounded-md p-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input id="name" placeholder="internal_gross_revenue" value={createName} onChange={(e) => setCreateName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="version">Version</Label>
                <Input id="version" type="number" min={1} value={createVersion} onChange={(e) => setCreateVersion(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="active">Active</Label>
                <div className="h-10 flex items-center">
                  <Switch id="active" checked={createActive} onCheckedChange={setCreateActive} />
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="spec">Spec JSON</Label>
              <Textarea id="spec" rows={8} value={createSpec} onChange={(e) => setCreateSpec(e.target.value)} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setShowCreate(false)}>Cancel</Button>
              <Button onClick={createNew}>Create KPI</Button>
            </div>
          </div>
        )}
      </section>

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
