-- ============================================================
-- Shore Desk — Initial Schema
-- ============================================================

-- Extensions
create extension if not exists "uuid-ossp";

-- ── Enums ────────────────────────────────────────────────────

create type user_role as enum ('owner', 'manager', 'seller', 'waiter', 'kitchen', 'bar');
create type bed_status as enum ('available', 'occupied', 'reserved', 'disabled');
create type order_status as enum ('pending', 'preparing', 'ready', 'delivering', 'delivered', 'cancelled');
create type order_item_type as enum ('food', 'drink');
create type rental_duration as enum ('full_day');

-- ── Profiles ─────────────────────────────────────────────────
-- Extends Supabase auth.users with role and display name.

create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null,
  full_name   text not null,
  role        user_role not null default 'waiter',
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

-- Auto-create profile on new auth user
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.email)
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ── Beach layout ──────────────────────────────────────────────

create table public.beds (
  id          uuid primary key default uuid_generate_v4(),
  label       text not null,           -- e.g. "A3"
  row         smallint not null,
  col         smallint not null,
  section     text,                    -- e.g. "VIP", "Front row"
  status      bed_status not null default 'available',
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  unique (row, col)
);

-- ── Rentals ───────────────────────────────────────────────────

create table public.rentals (
  id              uuid primary key default uuid_generate_v4(),
  bed_id          uuid not null references public.beds(id),
  seller_id       uuid not null references public.profiles(id),
  started_at      timestamptz not null default now(),
  ends_at         timestamptz not null,
  amount_paid     numeric(10,2) not null,
  duration_type   rental_duration not null,
  notes           text,
  voided          boolean not null default false,
  voided_by       uuid references public.profiles(id),
  voided_at       timestamptz,
  void_reason     text,
  created_at      timestamptz not null default now()
);

-- ── Menu items ────────────────────────────────────────────────

create table public.menu_items (
  id            uuid primary key default uuid_generate_v4(),
  name          text not null,
  description   text,
  price         numeric(10,2) not null,
  category      text not null,          -- e.g. "Burgers", "Cocktails"
  type          order_item_type not null,
  image_url     text,
  is_available  boolean not null default true,
  sort_order    smallint not null default 0,
  created_at    timestamptz not null default now()
);

-- ── Orders ────────────────────────────────────────────────────

create sequence public.order_number_seq start 1;

create table public.orders (
  id              uuid primary key default uuid_generate_v4(),
  bed_id          uuid not null references public.beds(id),
  rental_id       uuid references public.rentals(id),
  customer_name   text,
  status          order_status not null default 'pending',
  notes           text,
  order_number    integer not null default nextval('public.order_number_seq'),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table public.order_items (
  id              uuid primary key default uuid_generate_v4(),
  order_id        uuid not null references public.orders(id) on delete cascade,
  menu_item_id    uuid not null references public.menu_items(id),
  quantity        smallint not null default 1,
  unit_price      numeric(10,2) not null,
  notes           text,
  created_at      timestamptz not null default now()
);

-- Auto-update orders.updated_at
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger orders_updated_at
  before update on public.orders
  for each row execute procedure public.set_updated_at();

-- ── Indexes ───────────────────────────────────────────────────

create index on public.rentals (bed_id);
create index on public.rentals (seller_id);
create index on public.rentals (started_at desc);
create index on public.orders (bed_id);
create index on public.orders (status);
create index on public.orders (created_at desc);
create index on public.order_items (order_id);

-- ── Row Level Security ────────────────────────────────────────

alter table public.profiles    enable row level security;
alter table public.beds        enable row level security;
alter table public.rentals     enable row level security;
alter table public.menu_items  enable row level security;
alter table public.orders      enable row level security;
alter table public.order_items enable row level security;

-- Helper: get current user role
create or replace function public.current_user_role()
returns user_role language sql security definer stable as $$
  select role from public.profiles where id = auth.uid()
$$;

-- Helper: is staff (any authenticated role)
create or replace function public.is_staff()
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and is_active = true
  )
$$;

-- Profiles: staff can read all, only owner/manager can write
create policy "staff can read profiles"
  on public.profiles for select
  using (public.is_staff());

create policy "owner and manager can insert profiles"
  on public.profiles for insert
  with check (public.current_user_role() in ('owner', 'manager'));

create policy "owner and manager can update profiles"
  on public.profiles for update
  using (public.current_user_role() in ('owner', 'manager'));

-- Beds: staff can read; owner/manager/seller can update
create policy "staff can read beds"
  on public.beds for select
  using (public.is_staff() or auth.uid() is null); -- also public for QR orders

create policy "owner and manager can manage beds"
  on public.beds for all
  using (public.current_user_role() in ('owner', 'manager'));

create policy "seller can update bed status"
  on public.beds for update
  using (public.current_user_role() in ('seller'));

-- Rentals: staff can read; seller/manager/owner can insert; manager/owner can update
create policy "staff can read rentals"
  on public.rentals for select
  using (public.is_staff());

create policy "seller can insert rentals"
  on public.rentals for insert
  with check (public.current_user_role() in ('owner', 'manager', 'seller'));

create policy "manager can update rentals"
  on public.rentals for update
  using (public.current_user_role() in ('owner', 'manager'));

-- Menu items: public read (customers need it); owner/manager write
create policy "anyone can read menu items"
  on public.menu_items for select
  using (true);

create policy "owner and manager can manage menu"
  on public.menu_items for all
  using (public.current_user_role() in ('owner', 'manager'));

-- Orders: public insert (customers place orders); staff read/update
create policy "anyone can insert orders"
  on public.orders for insert
  with check (true);

create policy "staff can read orders"
  on public.orders for select
  using (public.is_staff());

create policy "staff can update order status"
  on public.orders for update
  using (public.is_staff());

-- Order items: public insert; staff read
create policy "anyone can insert order items"
  on public.order_items for insert
  with check (true);

create policy "staff can read order items"
  on public.order_items for select
  using (public.is_staff());

-- ── Seed: default pricing config ─────────────────────────────

create table public.config (
  key    text primary key,
  value  text not null,
  updated_at timestamptz not null default now()
);

alter table public.config enable row level security;

create policy "staff can read config"
  on public.config for select using (public.is_staff());

create policy "owner and manager can update config"
  on public.config for all
  using (public.current_user_role() in ('owner', 'manager'));

insert into public.config (key, value) values
  ('price_full_day',        '18.00'),
  ('closing_time',          '18:00'),
  ('currency',              'EUR'),
  ('beach_name',            'Shore Bar'),
  ('order_timeout_minutes', '30');