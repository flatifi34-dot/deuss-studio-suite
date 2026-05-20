
-- Roles enum + table
create type public.app_role as enum ('admin', 'therapist');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null,
  created_at timestamptz not null default now()
);

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  unique (user_id, role)
);

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create or replace function public.is_admin(_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.user_roles where user_id = _user_id and role = 'admin')
$$;

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.email
  ) on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Domain tables
create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

create table public.services (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  default_price numeric(10,2) not null default 0,
  created_at timestamptz not null default now()
);

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table public.packages (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  service_id uuid references public.services(id),
  total_sessions int not null check (total_sessions > 0),
  total_price numeric(10,2) not null check (total_price >= 0),
  amount_paid numeric(10,2) not null default 0 check (amount_paid >= 0),
  sold_by uuid references auth.users(id),
  notes text,
  created_at timestamptz not null default now()
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  package_id uuid not null references public.packages(id) on delete cascade,
  amount numeric(10,2) not null check (amount > 0),
  paid_at timestamptz not null default now(),
  recorded_by uuid references auth.users(id),
  note text
);

-- keep package.amount_paid in sync
create or replace function public.recalc_package_paid()
returns trigger language plpgsql as $$
declare pkg_id uuid;
begin
  pkg_id := coalesce(new.package_id, old.package_id);
  update public.packages
    set amount_paid = coalesce((select sum(amount) from public.payments where package_id = pkg_id), 0)
    where id = pkg_id;
  return null;
end; $$;

create trigger payments_recalc_aiud
  after insert or update or delete on public.payments
  for each row execute function public.recalc_package_paid();

create type public.appointment_status as enum ('scheduled', 'done', 'cancelled');

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  service_id uuid not null references public.services(id),
  room_id uuid not null references public.rooms(id),
  therapist_id uuid not null references auth.users(id),
  package_id uuid references public.packages(id),
  start_at timestamptz not null,
  end_at timestamptz not null,
  price numeric(10,2) not null default 0,
  status public.appointment_status not null default 'scheduled',
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  check (end_at > start_at)
);

create index appointments_start_idx on public.appointments(start_at);
create index appointments_therapist_idx on public.appointments(therapist_id);
create index appointments_room_idx on public.appointments(room_id);

-- Prevent overlapping appointments in the same room
create or replace function public.check_room_overlap()
returns trigger language plpgsql as $$
begin
  if new.status = 'cancelled' then return new; end if;
  if exists (
    select 1 from public.appointments a
    where a.room_id = new.room_id
      and a.id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid)
      and a.status <> 'cancelled'
      and a.start_at < new.end_at
      and a.end_at > new.start_at
  ) then
    raise exception 'Room is already booked for that time';
  end if;
  return new;
end; $$;

create trigger appointments_no_overlap
  before insert or update on public.appointments
  for each row execute function public.check_room_overlap();

-- Enable RLS
alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.rooms enable row level security;
alter table public.services enable row level security;
alter table public.clients enable row level security;
alter table public.packages enable row level security;
alter table public.payments enable row level security;
alter table public.appointments enable row level security;

-- profiles
create policy "all authed read profiles" on public.profiles for select to authenticated using (true);
create policy "admins manage profiles" on public.profiles for all to authenticated
  using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

-- user_roles
create policy "authed read roles" on public.user_roles for select to authenticated using (true);
create policy "admins manage roles" on public.user_roles for all to authenticated
  using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

-- rooms / services: everyone read, admin write
create policy "authed read rooms" on public.rooms for select to authenticated using (true);
create policy "admin write rooms" on public.rooms for all to authenticated
  using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

create policy "authed read services" on public.services for select to authenticated using (true);
create policy "admin write services" on public.services for all to authenticated
  using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

-- clients: all authed can read + create + update
create policy "authed read clients" on public.clients for select to authenticated using (true);
create policy "authed insert clients" on public.clients for insert to authenticated with check (auth.uid() is not null);
create policy "authed update clients" on public.clients for update to authenticated using (true) with check (true);
create policy "admin delete clients" on public.clients for delete to authenticated using (public.is_admin(auth.uid()));

-- packages: all authed can read + create; only sold_by or admin can update/delete
create policy "authed read packages" on public.packages for select to authenticated using (true);
create policy "authed insert packages" on public.packages for insert to authenticated with check (auth.uid() is not null);
create policy "owner or admin update packages" on public.packages for update to authenticated
  using (sold_by = auth.uid() or public.is_admin(auth.uid()))
  with check (sold_by = auth.uid() or public.is_admin(auth.uid()));
create policy "admin delete packages" on public.packages for delete to authenticated using (public.is_admin(auth.uid()));

-- payments
create policy "authed read payments" on public.payments for select to authenticated using (true);
create policy "authed insert payments" on public.payments for insert to authenticated with check (auth.uid() is not null);
create policy "admin update payments" on public.payments for update to authenticated using (public.is_admin(auth.uid()));
create policy "admin delete payments" on public.payments for delete to authenticated using (public.is_admin(auth.uid()));

-- appointments
create policy "authed read appointments" on public.appointments for select to authenticated using (true);
create policy "authed insert appointments" on public.appointments for insert to authenticated with check (auth.uid() is not null);
create policy "own or admin update appointments" on public.appointments for update to authenticated
  using (therapist_id = auth.uid() or public.is_admin(auth.uid()))
  with check (therapist_id = auth.uid() or public.is_admin(auth.uid()));
create policy "own or admin delete appointments" on public.appointments for delete to authenticated
  using (therapist_id = auth.uid() or public.is_admin(auth.uid()));

-- Seed services & rooms
insert into public.services (name, default_price) values
  ('Styx', 30),
  ('Dynamic Massage', 35),
  ('Face Lift', 40);

insert into public.rooms (name) values ('Room 1'), ('Room 2'), ('Room 3');
