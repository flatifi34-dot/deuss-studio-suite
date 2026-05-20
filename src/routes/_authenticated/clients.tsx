import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Plus, Search } from "lucide-react";

export const Route = createFileRoute("/_authenticated/clients")({
  component: ClientsPage,
});

function ClientsPage() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", notes: "" });
  const [busy, setBusy] = useState(false);

  const { data } = useQuery({
    queryKey: ["clients", q],
    queryFn: async () => {
      let query = supabase.from("clients").select("*").order("name");
      if (q) query = query.ilike("name", `%${q}%`);
      return (await query).data ?? [];
    },
  });

  async function create() {
    if (!form.name.trim()) return toast.error("Name required");
    setBusy(true);
    const { error } = await supabase.from("clients").insert(form);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Client added");
    setOpen(false);
    setForm({ name: "", phone: "", notes: "" });
    qc.invalidateQueries({ queryKey: ["clients"] });
  }

  return (
    <div className="p-8">
      <PageHeader
        title="Clients"
        subtitle="Manage your client list"
        action={
          <Button onClick={() => setOpen(true)}>
            <Plus className="size-4 mr-1" /> New client
          </Button>
        }
      />
      <div className="relative mb-4 max-w-sm">
        <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name…" className="pl-9" />
      </div>
      <Card className="divide-y divide-border">
        {data?.map((c: any) => (
          <Link
            key={c.id}
            to="/clients/$id"
            params={{ id: c.id }}
            className="flex items-center justify-between p-4 hover:bg-secondary/40 transition-colors"
          >
            <div>
              <div className="font-medium">{c.name}</div>
              <div className="text-xs text-muted-foreground">{c.phone || "—"}</div>
            </div>
            <div className="text-xs text-primary">View →</div>
          </Link>
        ))}
        {data && data.length === 0 && (
          <div className="p-8 text-center text-muted-foreground text-sm">No clients found.</div>
        )}
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-display text-2xl">New client</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            <div><Label>Notes</Label><Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={create} disabled={busy}>{busy ? "Saving…" : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}