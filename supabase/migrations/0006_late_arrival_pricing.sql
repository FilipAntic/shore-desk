-- Correct the full-day price and add a late-arrival discount tier:
-- renting after `late_arrival_time` charges `late_arrival_price` instead of `price_full_day`.
update public.config set value = '20.00', updated_at = now() where key = 'price_full_day';

insert into public.config (key, value) values
  ('late_arrival_price', '10.00'),
  ('late_arrival_time',  '17:00')
on conflict (key) do nothing;
