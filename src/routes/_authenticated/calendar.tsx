import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { PageHeader } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { fmtTime } from "@/lib/format";
import { BookingDialog } from "@/components/booking-dialog";

export const Route = createFileRoute("/_authenticated/calendar")({
  component: CalendarPage,
});

const HOURS = Array.from({ length: 13 }, (_, i) => 8 + i); // 8..20

function CalendarPage() {
  const { user, isAdmin } = useAuth();
  const [day, setDay] = useState(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [openSlot, setOpenSlot] = useState<{ roomId: string; start: Date } | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const qc = useQueryClient();

  const dayEnd = useMemo(() => {
    const d = new Date(day);
    d.setHours(23, 59, 59, 999);
    return d;
  }, [day]);

  const { data: rooms } = useQuery({
    queryKey: ["rooms"],
    queryFn: async () => (await supabase.from("rooms").select("*").order("name")).data ?? [],
  });

  const { data: appts } = useQuery({
    queryKey: ["appts", day.toISOString()],
    queryFn: async () => {
      const { data } = await supabase
        .from("appointments")
        .select("*, clients(name), services(name), profiles:therapist_id(full_name)")
        .gte("start_at", day.toISOString())
        .lte("start_at", dayEnd.toISOString())
        .order("start_at");
      return data ?? [];
    },
  });

  function shiftDay(d: number) {
    const n = new Date(day);
    n.setDate(n.getDate() + d);
    setDay(n);
  }

  return (
    <div className="p-4 sm:p-8">
      <PageHeader
        title="Calendar"
        subtitle="08:00 – 20:00 · 3 rooms"
        action={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => shiftDay(-1)}>
              <ChevronLeft className="size-4" />
            </Button>
            <div className="font-display text-base sm:text-xl w-40 sm:w-56 text-center truncate">
              {day.toLocaleDateString([], { weekday: "long", day: "numeric", month: "long" })}
            </div>
            <Button variant="outline" size="icon" onClick={() => shiftDay(1)}>
              <ChevronRight className="size-4" />
            </Button>
            <Button variant="outline" onClick={() => setDay(new Date(new Date().setHours(0, 0, 0, 0)))}>
              Today
            </Button>
          </div>
        }
      />

      <Card className="p-4 overflow-x-auto">
        <div
          className="grid gap-2 min-w-[700px]"
          style={{ gridTemplateColumns: `60px repeat(${rooms?.length ?? 3}, 1fr)` }}
        >
          <div />
          {rooms?.map((r: any) => (
            <div key={r.id} className="text-center font-display text-lg text-primary pb-2 border-b border-border">
              {r.name}
            </div>
          ))}
          {HOURS.map((h) => (
            <RowHour
              key={h}
              hour={h}
              day={day}
              rooms={rooms ?? []}
              appts={appts ?? []}
              onSlotClick={(roomId, start) => setOpenSlot({ roomId, start })}
              onApptClick={(id) => setEditId(id)}
              userId={user!.id}
              isAdmin={isAdmin}
            />
          ))}
        </div>
      </Card>

      {(openSlot || editId) && (
        <BookingDialog
          open
          onOpenChange={(o) => {
            if (!o) {
              setOpenSlot(null);
              setEditId(null);
            }
          }}
          defaultRoomId={openSlot?.roomId}
          defaultStart={openSlot?.start}
          editId={editId ?? undefined}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ["appts"] });
            qc.invalidateQueries({ queryKey: ["today-appts"] });
            setOpenSlot(null);
            setEditId(null);
          }}
        />
      )}
    </div>
  );
}

function RowHour({
  hour,
  day,
  rooms,
  appts,
  onSlotClick,
  onApptClick,
  userId,
  isAdmin,
}: {
  hour: number;
  day: Date;
  rooms: any[];
  appts: any[];
  onSlotClick: (roomId: string, start: Date) => void;
  onApptClick: (id: string) => void;
  userId: string;
  isAdmin: boolean;
}) {
  return (
    <>
      <div className="text-xs text-muted-foreground text-right pr-2 pt-1 font-mono">
        {String(hour).padStart(2, "0")}:00
      </div>
      {rooms.map((r) => {
        const slotStart = new Date(day);
        slotStart.setHours(hour, 0, 0, 0);
        const slotEnd = new Date(slotStart);
        slotEnd.setHours(hour + 1);
        const inSlot = appts.filter((a: any) => {
          if (a.room_id !== r.id) return false;
          const s = new Date(a.start_at);
          return s >= slotStart && s < slotEnd;
        });
        return (
          <div
            key={r.id}
            className="relative min-h-14 border border-border rounded-md hover:border-primary/50 transition-colors cursor-pointer"
            onClick={() => inSlot.length === 0 && onSlotClick(r.id, slotStart)}
          >
            {inSlot.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center text-muted-foreground/30 hover:text-primary/60">
                <Plus className="size-4" />
              </div>
            )}
            {inSlot.map((a: any) => {
              const own = a.therapist_id === userId;
              const canEdit = own || isAdmin;
              const therapistName = (a.profiles?.full_name ?? "").trim();
              const firstName = therapistName.split(" ")[0]?.toLowerCase() ?? "";
              const therapistStyles: Record<string, string> = {
                dion: "bg-blue-500/25 border-blue-400 text-blue-50",
                nesa: "bg-pink-500/25 border-pink-400 text-pink-50",
                arlinda: "bg-yellow-500/25 border-yellow-400 text-yellow-50",
                diellza: "bg-purple-500/25 border-purple-400 text-purple-50",
              };
              const baseStyle =
                a.status === "cancelled"
                  ? "bg-destructive/15 border-destructive/40 line-through"
                  : a.status === "done"
                  ? "bg-emerald-500/15 border-emerald-500/40"
                  : therapistStyles[firstName] ?? "bg-primary/15 border-primary/40";
              return (
                <button
                  key={a.id}
                  className={`flex h-full w-full flex-col items-center justify-center gap-0.5 p-2 text-xs border rounded-md ${baseStyle} ${
                    canEdit ? "cursor-pointer" : "cursor-default opacity-90"
                  }`}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (canEdit) onApptClick(a.id);
                  }}
                >
                  <div className="font-semibold uppercase tracking-wide truncate text-center">
                    {a.clients?.name} {therapistName ? `(${therapistName.split(" ")[0]})` : ""}
                  </div>
                  <div className="text-[10px] opacity-80 truncate text-center">
                    {fmtTime(a.start_at)} · {a.services?.name}
                  </div>
                </button>
              );
            })}
          </div>
        );
      })}
    </>
  );
}