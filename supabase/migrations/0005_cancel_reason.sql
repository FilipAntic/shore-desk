-- Add cancel_reason to orders so staff can log why an order was cancelled
alter table public.orders add column cancel_reason text;