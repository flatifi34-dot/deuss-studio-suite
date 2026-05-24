import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { fmtDate, fmtTime } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/history")({
  component: HistoryPage,
});

const actionStyles: Record<string, string> = {
  created: "bg-blue-500/15 text-blue-300 border-blue-500/40",
  updated: "bg-amber-500/15 text-amber-300 border-amber-500/40",
  cancelled: "bg-destructive/20 text-destructive border-destructive/40",
  completed: "bg-emerald-500/15 text-emerald-300 border-emerald-500/40",
  deleted: "bg-muted text-muted-foreground border-border",
};

function HistoryPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["appt-history"],
    queryFn: async () => {
      const { data } = await supabase
        .from("appointment_history")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(300);
      return data ?? [];
    },
  });

  return (
    <div className="p-4 sm:p-8">
      <PageHeader title="History" subtitle="Every booking change is logged here" />
      <Card className="p-0 overflow-hidden">
        {isLoading ? (
          <div className="p-6 text-muted-foreground text-sm">Loading…</div>
        ) : !data || data.length === 0 ? (
          <div className="p-6 text-muted-foreground text-sm">No activity yet.</div>
        ) : (
          <ul className="divide-y divide-border">
            {data.map((h: any) => (
              <li key={h.id} className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex items-center gap-3 min-w-[180px]">
                  <Badge variant="outline" className={actionStyles[h.action] ?? ""}>
                    {h.action}
                  </Badge>
                  <div className="text-xs text-muted-foreground">
                    {fmtDate(h.created_at)} · {fmtTime(h.created_at)}
                  </div>
                </div>
                <div className="flex-1 text-sm">
                  <div className="font-medium">
                    {h.client_name ?? "—"}{" "}
                    <span className="text-muted-foreground">·</span>{" "}
                    {h.service_name ?? "—"}{" "}
                    <span className="text-muted-foreground">in</span>{" "}
                    {h.room_name ?? "—"}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {h.start_at ? `${fmtDate(h.start_at)} ${fmtTime(h.start_at)}` : ""}
                    {h.therapist_name ? ` · ${h.therapist_name}` : ""}
                    {h.changed_by_name ? ` · by ${h.changed_by_name}` : ""}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}