import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";
import { toast } from "sonner";
import { eur, fmtDate, fmtTime } from "@/lib/format";
import { ArrowLeft, Plus, Wallet } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { BookingDialog } from "@/components/booking-dialog";

export const Route = createFileRoute("/_authenticated/clients/$id")({
  component: ClientDetail,
});

function ClientDetail() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [pkgOpen, setPkgOpen] = useState(false);
  const [payOpenFor, setPayOpenFor] = useState<string | null>(null);
  const [bookOpen, setBookOpen] = useState(false);

  const { data: client } = useQuery({
    queryKey: ["client", id],
    queryFn: async () => (await supabase.from("clients").select("*").eq("id", id).maybeSingle()).data,
  });
  const { data: packages } = useQuery({
    queryKey: ["packages", id],
    queryFn: async () =>
      (
        await supabase
          .from("packages")
          .select("*, services(name), profiles:sold_by(full_name)")
          .eq("client_id", id)
          .order("created_at", { ascending: false })
      ).data ?? [],
  });
  const { data: usedMap } = useQuery({
    queryKey: ["pkg-usage", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("appointments")
        .select("package_id")
        .eq("client_id", id)
        .eq("status", "done");
      const m: Record<string, number> = {};
      (data ?? []).forEach((a: any) => {
        if (a.package_id) m[a.package_id] = (m[a.package_id] ?? 0) + 1;
      });
      return m;
    },
  });
  const { data: appts } = useQuery({
    queryKey: ["client-appts", id],
    queryFn: async () =>
      (
        await supabase
          .from("appointments")
          .select("*, services(name), rooms(name), profiles:therapist_id(full_name)")
          .eq("client_id", id)
          .order("start_at", { ascending: false })
          .limit(50)
      ).data ?? [],
  });

  return (
    <div className="p-8">
      <Link to="/clients" className="text-sm text-muted-foreground hover:text-primary inline-flex items-center gap-1 mb-4">
        <ArrowLeft className="size-4" /> Back to clients
      </Link>
      <PageHeader
        title={client?.name ?? "Client"}
        subtitle={client?.phone || ""}
        action={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setBookOpen(true)}>
              <Plus className="size-4 mr-1" /> Book
            </Button>
            <Button onClick={() => setPkgOpen(true)}>
              <Plus className="size-4 mr-1" /> Sell package
            </Button>
          </div>
        }
      />

      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="p-5">
          <h2 className="font-display text-2xl mb-4">Packages</h2>
          <div className="space-y-3">
            {packages?.map((p: any) => {
              const used = usedMap?.[p.id] ?? 0;
              const remaining = (p.total_sessions ?? 0) - used;
              const owed = Number(p.total_price) - Number(p.amount_paid ?? 0);
              return (
                <div key={p.id} className="rounded-md border border-border p-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-medium">{p.services?.name ?? "Package"}</div>
                      <div className="text-xs text-muted-foreground">
                        Sold by {p.profiles?.full_name} · {fmtDate(p.created_at)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-display text-xl text-primary">{eur(p.total_price)}</div>
                      <div className="text-xs text-muted-foreground">
                        per session {eur(Number(p.total_price) / Math.max(1, p.total_sessions))}
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-3 text-sm gap-2">
                    <div>
                      <div className="text-xs text-muted-foreground">Sessions</div>
                      <div>{used} / {p.total_sessions} <span className="text-muted-foreground">({remaining} left)</span></div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Paid</div>
                      <div>{eur(p.amount_paid)} / {eur(p.total_price)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Owed</div>
                      <div className={owed > 0 ? "text-destructive" : "text-emerald-400"}>{eur(owed)}</div>
                    </div>
                  </div>
                  {owed > 0 && (
                    <Button size="sm" variant="outline" className="mt-3" onClick={() => setPayOpenFor(p.id)}>
                      <Wallet className="size-4 mr-1" /> Add payment / top-up
                    </Button>
                  )}
                </div>
              );
            })}
            {packages?.length === 0 && <p className="text-sm text-muted-foreground">No packages yet.</p>}
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="font-display text-2xl mb-4">History</h2>
          <div className="space-y-2">
            {appts?.map((a: any) => (
              <div key={a.id} className="flex items-center justify-between p-2 rounded border border-border text-sm">
                <div>
                  <div>{fmtDate(a.start_at)} · {fmtTime(a.start_at)}</div>
                  <div className="text-xs text-muted-foreground">
                    {a.services?.name} · {a.rooms?.name} · {a.profiles?.full_name}
                  </div>
                </div>
                <div className="text-right">
                  <div>{eur(a.price)}</div>
                  <div className="text-xs text-muted-foreground">{a.status}</div>
                </div>
              </div>
            ))}
            {appts?.length === 0 && <p className="text-sm text-muted-foreground">No history yet.</p>}
          </div>
        </Card>
      </div>

      {pkgOpen && (
        <SellPackageDialog
          clientId={id}
          onClose={() => setPkgOpen(false)}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ["packages", id] });
            setPkgOpen(false);
          }}
          userId={user!.id}
        />
      )}
      {payOpenFor && (
        <PaymentDialog
          packageId={payOpenFor}
          onClose={() => setPayOpenFor(null)}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ["packages", id] });
            setPayOpenFor(null);
          }}
          userId={user!.id}
        />
      )}
      {bookOpen && (
        <BookingDialog
          open
          onOpenChange={(o) => !o && setBookOpen(false)}
          defaultClientId={id}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ["client-appts", id] });
            setBookOpen(false);
          }}
        />
      )}
    </div>
  );
}

function SellPackageDialog({
  clientId,
  onClose,
  onSaved,
  userId,
}: {
  clientId: string;
  onClose: () => void;
  onSaved: () => void;
  userId: string;
}) {
  const [serviceId, setServiceId] = useState("");
  const [sessions, setSessions] = useState(10);
  const [price, setPrice] = useState("225");
  const [paidNow, setPaidNow] = useState("0");
  const [busy, setBusy] = useState(false);

  const { data: services } = useQuery({
    queryKey: ["services"],
    queryFn: async () => (await supabase.from("services").select("*").order("name")).data ?? [],
  });

  async function save() {
    if (!serviceId) return toast.error("Service required");
    setBusy(true);
    const { data: pkg, error } = await supabase
      .from("packages")
      .insert({
        client_id: clientId,
        service_id: serviceId,
        sold_by: userId,
        total_sessions: sessions,
        total_price: parseFloat(price),
      })
      .select()
      .single();
    if (error) {
      setBusy(false);
      return toast.error(error.message);
    }
    const paid = parseFloat(paidNow);
    if (paid > 0 && pkg) {
      await supabase.from("payments").insert({
        package_id: pkg.id,
        amount: paid,
        recorded_by: userId,
      });
    }
    setBusy(false);
    toast.success("Package sold");
    onSaved();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle className="font-display text-2xl">Sell package</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Service</Label>
            <Select value={serviceId} onValueChange={setServiceId}>
              <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>
                {services?.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Sessions</Label><Input type="number" value={sessions} onChange={(e) => setSessions(parseInt(e.target.value) || 1)} /></div>
            <div><Label>Total price (€)</Label><Input type="number" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} /></div>
          </div>
          <div>
            <Label>Paid now (€)</Label>
            <Input type="number" step="0.01" value={paidNow} onChange={(e) => setPaidNow(e.target.value)} />
            <p className="text-xs text-muted-foreground mt-1">Per session: {eur(parseFloat(price || "0") / Math.max(1, sessions))}</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={busy}>{busy ? "Saving…" : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PaymentDialog({
  packageId,
  onClose,
  onSaved,
  userId,
}: {
  packageId: string;
  onClose: () => void;
  onSaved: () => void;
  userId: string;
}) {
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);

  async function save() {
    const a = parseFloat(amount);
    if (!a || a <= 0) return toast.error("Enter a positive amount");
    setBusy(true);
    const { error } = await supabase.from("payments").insert({
      package_id: packageId,
      amount: a,
      recorded_by: userId,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Payment recorded");
    onSaved();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle className="font-display text-2xl">Add payment</DialogTitle></DialogHeader>
        <div>
          <Label>Amount (€)</Label>
          <Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={busy}>{busy ? "Saving…" : "Confirm payment"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}