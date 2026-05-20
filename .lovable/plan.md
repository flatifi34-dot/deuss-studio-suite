## Deuss Studio Massage CRM

### Stack
- Lovable Cloud (Postgres + Auth + RLS)
- TanStack Start + React + Tailwind
- Black & gold theme (oklch tokens in `src/styles.css`)

### Users (pre-seeded)
- **Admins**: Denisa, Valbona — email `admin@deuss.com` / `valbona@deuss.com`
- **Therapists**: Dion, Nesa, Arlinda, Diellza — `dion@deuss.com`, etc.
- Passwords as you specified. You can change them later in the Users panel.
- Roles stored in a separate `user_roles` table (admin / therapist) — required for safe RLS.

### Database tables
1. `profiles` — id (=auth user), full_name, email
2. `user_roles` — user_id, role (`admin` | `therapist`)
3. `clients` — name, phone, notes
4. `services` — name, default_price (Styx, Dynamic Massage, Face Lift — seeded)
5. `rooms` — 3 rooms seeded (Room 1/2/3)
6. `packages` — client_id, service_id, total_sessions, sessions_used, total_price, per_session_price (derived), amount_paid, created_by
7. `payments` — package_id, amount, paid_at, recorded_by (for top-ups until fully paid)
8. `appointments` — client_id, service_id, room_id, therapist_id (user), start_at, end_at, status (scheduled/done/cancelled), package_id (optional link), price

### Booking logic
- Slots 08:00–20:00, 30-min increments
- When creating: check no overlapping appointment exists for the chosen room — if all 3 rooms have overlapping appointments, block creation
- Appointment counts as a "session used" against the linked package when status = done

### Permissions (RLS)
- **Admins**: full read/write on everything, see total studio revenue
- **Therapists**:
  - See all appointments (read)
  - Edit/cancel only their own
  - See clients & packages (needed for booking)
  - See only their own revenue stats (sessions done, total sold this month, cancellations)

### Pages
- `/login` — email + password
- `/` (dashboard) — today's appointments, quick stats
- `/calendar` — week view with 3 room columns 08:00–20:00, click empty slot to book
- `/clients` — list + create + client detail with their packages & payment history
- `/packages` — create package (e.g. 10 sessions / 225€), see sessions remaining, record top-up payments
- `/stats` — therapist: own monthly sold, sessions done, cancellations; admin: studio totals + per-therapist breakdown
- `/users` (admin only) — list of staff

### Design
- Background near-black `oklch(0.15 0 0)`, gold accent `oklch(0.78 0.13 85)`, cream text
- Serif display headings (Cormorant) + clean sans body (Inter)
- Card-based, subtle gold borders, refined spa feel

### Notes
- I'll create the 6 auth users via a one-time seed script after Cloud is enabled.
- All passwords are stored hashed by Auth; the ones you listed will be set initially — please change them in production.
