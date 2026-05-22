import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { PageHeader } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { eur } from "@/lib/format";
import { useMemo, useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/revenue")({
  component: RevenuePage,
});

function RevenuePage() {
  const { isAdmin, user } = useAuth();
  const [monthOffset, setMonthOffset] = useState(0);

  const { start, end, label } = useMemo(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - monthOffset, 1);
    d.setHours(0, 0, 0, 0);
    const s = new Date(d);
    const e = new Date(d.getFullYear(), d.getMonth() + 1, 1);
    return {
      start: s.toISOString(),
      end: e.toISOString(),
      label: s.toLocaleDateString([], { month: "long", year: "numeric" }),
    };
  }, [monthOffset]);

  const { data: therapists } = useQuery({
    queryKey: ["therapists"],
    queryFn: async () => (await supabase.from("profiles").select("id,full_name").order("full_name")).data ?? [],
  });

  const { data: rows } = useQuery({
    queryKey: ["revenue", start, end, isAdmin, user?.id],
    queryFn: async () => {
      let q = supabase
        .from("appointments")
        .select("therapist_id, price, status")
        .gte("start_at", start)
        .lt("start_at", end)
        .eq("status", "done");
      if (!isAdmin) q = q.eq("therapist_id", user!.id);
      const { data } = await q;
      return data ?? [];
    },
  });

  const byTherapist: Record<string, number> = {};
  let total = 0;
  (rows ?? []).forEach((r: any) => {
    const p = Number(r.price ?? 0);
    total += p;
    byTherapist[r.therapist_id] = (byTherapist[r.therapist_id] ?? 0) + p;
  });

  return (
    <div className="p-4 sm:p-8">
      <PageHeader
        title="Revenue"
        subtitle={isAdmin ? "Studio earnings" : "Your earnings"}
        action={
          <Select value={String(monthOffset)} onValueChange={(v) => setMonthOffset(parseInt(v))}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              {Array.from({ length: 12 }, (_, i) => i).map((i) => {
                const d = new Date();
                d.setMonth(d.getMonth() - i, 1);
                return (
                  <SelectItem key={i} value={String(i)}>
                    {d.toLocaleDateString([], { month: "long", year: "numeric" })}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        }
      />
      <Card className="p-6 mb-6">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">
          Total — {label}
        </div>
        <div className="font-display text-5xl text-primary mt-2">{eur(total)}</div>
      </Card>

      {isAdmin && (
        <Card className="p-6">
          <h2 className="font-display text-2xl mb-4">By therapist</h2>
          <div className="divide-y divide-border">
            {therapists?.map((t: any) => (
              <div key={t.id} className="flex justify-between py-3">
                <div>{t.full_name}</div>
                <div className="text-primary font-medium">{eur(byTherapist[t.id] ?? 0)}</div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}