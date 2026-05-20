import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { seedStaff } from "@/lib/seed.functions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";

export const Route = createFileRoute("/setup")({
  component: SetupPage,
});

function SetupPage() {
  const seed = useServerFn(seedStaff);
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<{ email: string; status: string }[] | null>(null);

  async function run() {
    setBusy(true);
    try {
      const r = await seed({});
      setResults(r.results);
      toast.success("Staff accounts initialized");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="p-8 max-w-lg w-full">
        <h1 className="font-display text-3xl mb-2">First-time setup</h1>
        <p className="text-sm text-muted-foreground mb-6">
          Create the six staff accounts (2 admins, 4 therapists). Safe to run multiple times — existing accounts will not be duplicated.
        </p>
        <Button onClick={run} disabled={busy} className="w-full mb-4">
          {busy ? "Initializing…" : "Initialize staff accounts"}
        </Button>
        {results && (
          <div className="space-y-1 text-sm">
            {results.map((r) => (
              <div key={r.email} className="flex justify-between py-1 border-b border-border">
                <span>{r.email}</span>
                <span className="text-muted-foreground">{r.status}</span>
              </div>
            ))}
          </div>
        )}
        <div className="mt-6 text-center">
          <Link to="/login" className="text-primary text-sm underline">
            Back to sign in
          </Link>
        </div>
      </Card>
    </div>
  );
}