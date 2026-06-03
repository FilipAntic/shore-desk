-- Enable Supabase Realtime on tables that need live updates
alter publication supabase_realtime add table public.beds;
alter publication supabase_realtime add table public.rentals;
alter publication supabase_realtime add table public.orders;
alter publication supabase_realtime add table public.order_items;
