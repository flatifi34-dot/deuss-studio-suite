import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { PageHeader } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { eur, fmtTime } from "@/lib/format";
import { Calendar, Euro, CheckCircle2, XCircle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardPage,
});

function DashboardPage() {
  const { user, isAdmin, profile } = useAuth();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const { data: today } = useQuery({
    queryKey: ["today-appts", user?.id, isAdmin],
    queryFn: async () => {
      const { data } = await supabase
        .from("appointments")
        .select("*, clients(name), services(name), rooms(name), profiles:therapist_id(full_name)")
        .gte("start_at", todayStart.toISOString())
        .lte("start_at", todayEnd.toISOString())
        .order("start_at");
      return data ?? [];
    },
  });

  const { data: stats } = useQuery({
    queryKey: ["dash-stats", user?.id, isAdmin],
    queryFn: async () => {
      const mineFilter = (q: any) => (isAdmin ? q : q.eq("therapist_id", user!.id));
      const [done, cancelled, packs] = await Promise.all([
        mineFilter(
          supabase
            .from("appointments")
            .select("price", { count: "exact" })
            .eq("status", "done")
            .gte("start_at", monthStart.toISOString()),
        ),
        mineFilter(
          supabase
            .from("appointments")
            .select("id", { count: "exact", head: true })
            .eq("status", "cancelled")
            .gte("start_at", monthStart.toISOString()),
        ),
        isAdmin
          ? supabase
              .from("packages")
              .select("total_price")
              .gte("created_at", monthStart.toISOString())
          : supabase
              .from("packages")
              .select("total_price")
              .eq("sold_by", user!.id)
              .gte("created_at", monthStart.toISOString()),
      ]);
      const revenue = (done.data ?? []).reduce(
        (s: number, r: any) => s + Number(r.price ?? 0),
        0,
      );
      const sold = (packs.data ?? []).reduce(
        (s: number, r: any) => s + Number(r.total_price ?? 0),
        0,
      );
      return {
        sessionsDone: done.count ?? 0,
        cancellations: cancelled.count ?? 0,
        revenue,
        sold,
      };
    },
  });

  return (
    <div className="p-4 sm:p-8">
      <PageHeader
        title={`Hello, ${profile?.full_name ?? ""}`}
        subtitle={isAdmin ? "Studio overview" : "Your month at a glance"}
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <StatCard label="Sessions done (month)" value={String(stats?.sessionsDone ?? 0)} icon={CheckCircle2} />
        <StatCard label="Cancellations (month)" value={String(stats?.cancellations ?? 0)} icon={XCircle} />
        <StatCard
          label={isAdmin ? "Studio revenue (month)" : "Your revenue (month)"}
          value={eur(stats?.revenue ?? 0)}
          icon={Euro}
        />
        <StatCard
          label={isAdmin ? "Packages sold (month)" : "Your packages sold (month)"}
          value={eur(stats?.sold ?? 0)}
          icon={Calendar}
        />
      </div>

      <Card className="p-6">
        <h2 className="font-display text-2xl mb-4">Today's appointments</h2>
        {today && today.length > 0 ? (
          <div className="space-y-2">
            {today.map((a: any) => (
              <div
                key={a.id}
                className="flex items-center gap-4 p-3 rounded-md bg-secondary/40 border border-border"
              >
                <div className="text-primary font-mono font-medium w-20">
                  {fmtTime(a.start_at)}–{fmtTime(a.end_at)}
                </div>
                <div className="flex-1">
                  <div className="font-medium">{a.clients?.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {a.services?.name} · {a.rooms?.name} · {a.profiles?.full_name}
                  </div>
                </div>
                <StatusPill status={a.status} />
              </div>
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">No appointments today.</p>
        )}
      </Card>
    </div>
  );
}

function StatCard({ label, value, icon: Icon }: { label: string; value: string; icon: any }) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
          <div className="font-display text-3xl mt-2 text-primary">{value}</div>
        </div>
        <Icon className="size-5 text-primary/70" />
      </div>
    </Card>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    scheduled: "bg-primary/15 text-primary border-primary/40",
    done: "bg-emerald-500/15 text-emerald-400 border-emerald-500/40",
    cancelled: "bg-destructive/15 text-destructive border-destructive/40",
  };
  return (
    <span className={`text-xs px-2 py-1 rounded-full border ${map[status] ?? ""}`}>{status}</span>
  );
}