import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";

type Props = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  defaultRoomId?: string;
  defaultStart?: Date;
  editId?: string;
  defaultClientId?: string;
  onSaved?: () => void;
};

function toLocalInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function BookingDialog({
  open,
  onOpenChange,
  defaultRoomId,
  defaultStart,
  editId,
  defaultClientId,
  onSaved,
}: Props) {
  const { user, isAdmin } = useAuth();
  const [clientId, setClientId] = useState<string>(defaultClientId ?? "");
  const [serviceId, setServiceId] = useState<string>("");
  const [roomId, setRoomId] = useState<string>(defaultRoomId ?? "");
  const [therapistId, setTherapistId] = useState<string>(user?.id ?? "");
  const [packageId, setPackageId] = useState<string>("");
  const [start, setStart] = useState(defaultStart ? toLocalInput(defaultStart) : "");
  const [duration, setDuration] = useState(60);
  const [price, setPrice] = useState<string>("");
  const [status, setStatus] = useState<"scheduled" | "done" | "cancelled">("scheduled");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  const { data: clients } = useQuery({
    queryKey: ["clients-all"],
    queryFn: async () => (await supabase.from("clients").select("id,name").order("name")).data ?? [],
  });
  const { data: services } = useQuery({
    queryKey: ["services"],
    queryFn: async () => (await supabase.from("services").select("*").order("name")).data ?? [],
  });
  const { data: rooms } = useQuery({
    queryKey: ["rooms"],
    queryFn: async () => (await supabase.from("rooms").select("*").order("name")).data ?? [],
  });
  const { data: therapists } = useQuery({
    queryKey: ["therapists"],
    queryFn: async () => (await supabase.from("profiles").select("id,full_name").order("full_name")).data ?? [],
  });
  const { data: clientPackages } = useQuery({
    queryKey: ["client-packages", clientId],
    enabled: !!clientId,
    queryFn: async () =>
      (
        await supabase
          .from("packages")
          .select("id, total_sessions, total_price, service_id, services(name)")
          .eq("client_id", clientId)
      ).data ?? [],
  });

  useEffect(() => {
    if (!editId) return;
    (async () => {
      const { data } = await supabase.from("appointments").select("*").eq("id", editId).maybeSingle();
      if (!data) return;
      setClientId(data.client_id);
      setServiceId(data.service_id);
      setRoomId(data.room_id);
      setTherapistId(data.therapist_id);
      setPackageId(data.package_id ?? "");
      const s = new Date(data.start_at);
      const e = new Date(data.end_at);
      setStart(toLocalInput(s));
      setDuration(Math.round((e.getTime() - s.getTime()) / 60000));
      setPrice(String(data.price));
      setStatus(data.status);
      setNotes(data.notes ?? "");
    })();
  }, [editId]);

  useEffect(() => {
    if (!serviceId || price !== "") return;
    const s = services?.find((x: any) => x.id === serviceId);
    if (s) setPrice(String(s.default_price));
  }, [serviceId, services]);

  async function save() {
    if (!clientId || !serviceId || !roomId || !therapistId || !start) {
      toast.error("Please fill in all required fields");
      return;
    }
    setBusy(true);
    const startAt = new Date(start);
    const endAt = new Date(startAt.getTime() + duration * 60000);
    const payload = {
      client_id: clientId,
      service_id: serviceId,
      room_id: roomId,
      therapist_id: therapistId,
      package_id: packageId || null,
      start_at: startAt.toISOString(),
      end_at: endAt.toISOString(),
      price: parseFloat(price || "0"),
      status,
      notes: notes || null,
    };
    const { error } = editId
      ? await supabase.from("appointments").update(payload).eq("id", editId)
      : await supabase.from("appointments").insert({ ...payload, created_by: user!.id });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(editId ? "Appointment updated" : "Appointment booked");
    onSaved?.();
  }

  async function remove() {
    if (!editId) return;
    if (!confirm("Delete this appointment?")) return;
    const { error } = await supabase.from("appointments").delete().eq("id", editId);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    onSaved?.();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">
            {editId ? "Edit appointment" : "New appointment"}
          </DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <Label>Client</Label>
            <Select value={clientId} onValueChange={setClientId}>
              <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
              <SelectContent>
                {clients?.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Service</Label>
            <Select value={serviceId} onValueChange={setServiceId}>
              <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>
                {services?.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Room</Label>
            <Select value={roomId} onValueChange={setRoomId}>
              <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>
                {rooms?.map((r: any) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Therapist</Label>
            <Select value={therapistId} onValueChange={setTherapistId} disabled={!isAdmin && !!editId === false}>
              <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>
                {therapists?.map((t: any) => <SelectItem key={t.id} value={t.id}>{t.full_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Start</Label>
            <Input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} />
          </div>
          <div>
            <Label>Duration (min)</Label>
            <Input type="number" step={15} min={15} value={duration} onChange={(e) => setDuration(parseInt(e.target.value) || 60)} />
          </div>
          <div>
            <Label>Price (€)</Label>
            <Input type="number" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} />
          </div>
          {clientPackages && clientPackages.length > 0 && (
            <div className="col-span-2">
              <Label>Use package (optional)</Label>
              <Select value={packageId || "none"} onValueChange={(v) => setPackageId(v === "none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="No package" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No package</SelectItem>
                  {clientPackages.map((p: any) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.services?.name ?? "Package"} · {p.total_sessions} sessions · €{p.total_price}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {editId && (
            <div className="col-span-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="scheduled">Scheduled</SelectItem>
                  <SelectItem value="done">Done</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="col-span-2">
            <Label>Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-2">
          {editId && (
            <Button variant="ghost" onClick={remove} className="text-destructive mr-auto">
              <Trash2 className="size-4 mr-1" /> Delete
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={busy}>{busy ? "Saving…" : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}