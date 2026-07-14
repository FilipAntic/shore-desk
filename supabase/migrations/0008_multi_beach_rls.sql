-- ============================================================
-- Multi-beach support — row level security
-- ============================================================
-- Every existing role-gated policy gains an additive beach-match
-- clause: `current_user_role() = 'owner' or beach_id = current_user_beach_id()`.
-- Anchored on role = 'owner' rather than "beach_id is null" so that a
-- non-owner profile that somehow ends up with a null beach_id fails
-- closed (denied) instead of accidentally matching everything.
--
-- The public/anonymous policies (menu read, order/order_item insert,
-- and the `auth.uid() is null` branch of beds read) are left as-is —
-- there is no session to scope by beach for an anonymous customer;
-- beach-correctness on that path comes from the app query filtering
-- by the resolved beach id, not from RLS.

create or replace function public.current_user_beach_id()
returns uuid language sql security definer stable as $$
  select beach_id from public.profiles where id = auth.uid()
$$;

-- ── Beaches ──────────────────────────────────────────────────

create policy "staff can read own beach"
  on public.beaches for select
  using (
    (public.is_staff() and (public.current_user_role() = 'owner' or id = public.current_user_beach_id()))
    or auth.uid() is null -- public, needed to resolve a beach slug for the QR order flow
  );

create policy "owner can manage beaches"
  on public.beaches for all
  using (public.current_user_role() = 'owner');

-- ── Profiles ─────────────────────────────────────────────────

drop policy "staff can read profiles" on public.profiles;
create policy "staff can read profiles"
  on public.profiles for select
  using (public.is_staff() and (public.current_user_role() = 'owner' or beach_id = public.current_user_beach_id()));

drop policy "owner and manager can insert profiles" on public.profiles;
create policy "owner and manager can insert profiles"
  on public.profiles for insert
  with check (
    public.current_user_role() in ('owner', 'manager')
    and (public.current_user_role() = 'owner' or beach_id = public.current_user_beach_id())
  );

drop policy "owner and manager can update profiles" on public.profiles;
create policy "owner and manager can update profiles"
  on public.profiles for update
  using (
    public.current_user_role() in ('owner', 'manager')
    and (public.current_user_role() = 'owner' or beach_id = public.current_user_beach_id())
  );

-- ── Beds ─────────────────────────────────────────────────────

drop policy "staff can read beds" on public.beds;
create policy "staff can read beds"
  on public.beds for select
  using (
    (public.is_staff() and (public.current_user_role() = 'owner' or beach_id = public.current_user_beach_id()))
    or auth.uid() is null -- also public for QR orders
  );

drop policy "owner and manager can manage beds" on public.beds;
create policy "owner and manager can manage beds"
  on public.beds for all
  using (
    public.current_user_role() in ('owner', 'manager')
    and (public.current_user_role() = 'owner' or beach_id = public.current_user_beach_id())
  );

drop policy "seller can update bed status" on public.beds;
create policy "seller can update bed status"
  on public.beds for update
  using (public.current_user_role() = 'seller' and beach_id = public.current_user_beach_id());

-- ── Rentals ──────────────────────────────────────────────────

drop policy "staff can read rentals" on public.rentals;
create policy "staff can read rentals"
  on public.rentals for select
  using (public.is_staff() and (public.current_user_role() = 'owner' or beach_id = public.current_user_beach_id()));

drop policy "seller can insert rentals" on public.rentals;
create policy "seller can insert rentals"
  on public.rentals for insert
  with check (
    public.current_user_role() in ('owner', 'manager', 'seller')
    and (public.current_user_role() = 'owner' or beach_id = public.current_user_beach_id())
  );

drop policy "manager can update rentals" on public.rentals;
create policy "manager can update rentals"
  on public.rentals for update
  using (
    public.current_user_role() in ('owner', 'manager')
    and (public.current_user_role() = 'owner' or beach_id = public.current_user_beach_id())
  );

-- ── Menu items ───────────────────────────────────────────────
-- Unchanged: menu stays a single global catalog shared by every beach.

-- ── Orders ───────────────────────────────────────────────────

drop policy "staff can read orders" on public.orders;
create policy "staff can read orders"
  on public.orders for select
  using (public.is_staff() and (public.current_user_role() = 'owner' or beach_id = public.current_user_beach_id()));

drop policy "staff can update order status" on public.orders;
create policy "staff can update order status"
  on public.orders for update
  using (public.is_staff() and (public.current_user_role() = 'owner' or beach_id = public.current_user_beach_id()));

-- "anyone can insert orders" unchanged — public customer flow, no session to scope.

-- ── Order items ──────────────────────────────────────────────
-- No own beach_id column; scoped transitively via orders.

drop policy "staff can read order items" on public.order_items;
create policy "staff can read order items"
  on public.order_items for select
  using (
    public.is_staff() and exists (
      select 1 from public.orders o
      where o.id = order_items.order_id
        and (public.current_user_role() = 'owner' or o.beach_id = public.current_user_beach_id())
    )
  );

-- "anyone can insert order items" unchanged — public customer flow, no session to scope.

-- ── Config ───────────────────────────────────────────────────

drop policy "staff can read config" on public.config;
create policy "staff can read config"
  on public.config for select
  using (public.is_staff() and (public.current_user_role() = 'owner' or beach_id = public.current_user_beach_id()));

drop policy "owner and manager can update config" on public.config;
create policy "owner and manager can update config"
  on public.config for all
  using (
    public.current_user_role() in ('owner', 'manager')
    and (public.current_user_role() = 'owner' or beach_id = public.current_user_beach_id())
  );
