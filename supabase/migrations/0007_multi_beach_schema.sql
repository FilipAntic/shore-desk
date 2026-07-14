-- ============================================================
-- Multi-beach support — schema
-- ============================================================
-- Introduces a `beaches` table so the system can run more than one
-- physical location. Every existing row is backfilled onto a single
-- default beach (derived from the current global `beach_name` config
-- value) so this is safe to run against live data.

create table public.beaches (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name        text not null,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

alter table public.beaches enable row level security;

do $$
declare
  default_name text;
  default_slug text;
  default_beach_id uuid;
begin
  select value into default_name from public.config where key = 'beach_name';
  default_name := coalesce(default_name, 'Main Beach');

  default_slug := regexp_replace(lower(trim(default_name)), '[^a-z0-9]+', '-', 'g');
  default_slug := trim(both '-' from default_slug);
  if default_slug = '' then
    default_slug := 'main';
  end if;

  insert into public.beaches (slug, name) values (default_slug, default_name)
  returning id into default_beach_id;

  -- ── Add beach_id columns (nullable first — backfilled below) ──

  alter table public.profiles add column beach_id uuid references public.beaches(id);
  alter table public.beds     add column beach_id uuid references public.beaches(id);
  alter table public.rentals  add column beach_id uuid references public.beaches(id);
  alter table public.orders   add column beach_id uuid references public.beaches(id);

  -- ── Backfill every existing row onto the one default beach ──
  -- profiles.beach_id stays null for role = 'owner' — null means
  -- "owner, sees every beach" (see current_user_beach_id() in the
  -- RLS migration that follows this one).

  update public.beds     set beach_id = default_beach_id;
  update public.rentals  set beach_id = default_beach_id;
  update public.orders   set beach_id = default_beach_id;
  update public.profiles set beach_id = default_beach_id where role <> 'owner';

  alter table public.beds    alter column beach_id set not null;
  alter table public.rentals alter column beach_id set not null;
  alter table public.orders  alter column beach_id set not null;

  -- ── Beds: uniqueness of (row, col) is now per-beach ──

  alter table public.beds drop constraint beds_row_col_key;
  alter table public.beds add constraint beds_beach_row_col_key unique (beach_id, row, col);

  -- ── Config: restructure to a per-beach key/value store ──
  -- `beach_name` becomes redundant with beaches.name, drop it.

  alter table public.config add column beach_id uuid references public.beaches(id);
  update public.config set beach_id = default_beach_id;
  delete from public.config where key = 'beach_name';
  alter table public.config drop constraint config_pkey;
  alter table public.config alter column beach_id set not null;
  alter table public.config add primary key (beach_id, key);
end $$;

-- ── Indexes ──────────────────────────────────────────────────

create index on public.profiles (beach_id);
create index on public.beds (beach_id);
create index on public.rentals (beach_id);
create index on public.orders (beach_id);
