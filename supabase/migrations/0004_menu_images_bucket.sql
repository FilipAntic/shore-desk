-- Public storage bucket for menu item images
insert into storage.buckets (id, name, public)
values ('menu-images', 'menu-images', true);

-- Anyone can read (customers need to see images)
create policy "public can read menu images"
  on storage.objects for select
  using (bucket_id = 'menu-images');

-- Only staff can upload/update/delete
create policy "staff can upload menu images"
  on storage.objects for insert
  with check (
    bucket_id = 'menu-images'
    and public.current_user_role() in ('owner', 'manager')
  );

create policy "staff can update menu images"
  on storage.objects for update
  using (
    bucket_id = 'menu-images'
    and public.current_user_role() in ('owner', 'manager')
  );

create policy "staff can delete menu images"
  on storage.objects for delete
  using (
    bucket_id = 'menu-images'
    and public.current_user_role() in ('owner', 'manager')
  );
