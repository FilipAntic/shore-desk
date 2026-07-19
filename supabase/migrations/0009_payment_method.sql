-- Track how a bed rental was paid for (cash vs. card)
create type payment_method as enum ('cash', 'card');

alter table public.rentals
  add column payment_method payment_method not null default 'cash';