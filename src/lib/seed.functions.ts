import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

type StaffSeed = {
  email: string;
  password: string;
  full_name: string;
  role: "admin" | "therapist";
};

const STAFF: StaffSeed[] = [
  { email: "admin@deuss.com", password: "admin1234", full_name: "Denisa", role: "admin" },
  { email: "valbona@deuss.com", password: "admin1234", full_name: "Valbona", role: "admin" },
  { email: "dion@deuss.com", password: "Dion1234", full_name: "Dion", role: "therapist" },
  { email: "nesa@deuss.com", password: "Nesa1234", full_name: "Nesa", role: "therapist" },
  { email: "arlinda@deuss.com", password: "Arlinda1234", full_name: "Arlinda", role: "therapist" },
  { email: "diellza@deuss.com", password: "Diellza1234", full_name: "Diellza", role: "therapist" },
];

export const seedStaff = createServerFn({ method: "POST" }).handler(async () => {
  const results: { email: string; status: string }[] = [];

  // If any admin already exists, do not allow re-seeding (one-shot)
  const { data: existingAdmins } = await supabaseAdmin
    .from("user_roles")
    .select("id")
    .eq("role", "admin")
    .limit(1);

  for (const s of STAFF) {
    // Check by listing — Admin createUser will fail if exists
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: s.email,
      password: s.password,
      email_confirm: true,
      user_metadata: { full_name: s.full_name },
    });

    let userId: string | null = created?.user?.id ?? null;

    if (error || !userId) {
      // Likely already exists — find by listing
      const { data: list } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
      const found = list?.users.find((u) => u.email === s.email);
      if (found) {
        userId = found.id;
        results.push({ email: s.email, status: "exists" });
      } else {
        results.push({ email: s.email, status: `error: ${error?.message ?? "unknown"}` });
        continue;
      }
    } else {
      results.push({ email: s.email, status: "created" });
    }

    // Ensure profile
    await supabaseAdmin
      .from("profiles")
      .upsert({ id: userId, full_name: s.full_name, email: s.email }, { onConflict: "id" });

    // Ensure role
    await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: userId, role: s.role }, { onConflict: "user_id,role" });
  }

  return { results, alreadySeeded: (existingAdmins?.length ?? 0) > 0 };
});