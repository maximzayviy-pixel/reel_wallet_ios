-- Ensure payment_requests table has needed columns
create table if not exists payment_requests (
  id uuid primary key default gen_random_uuid(),
  tg_id text not null,
  qr_payload text not null,
  amount_rub numeric not null,
  image_url text,
  status text not null default 'pending', -- pending|confirmed|rejected|paid
  admin_id text,
  admin_note text,
  created_at timestamptz default now()
);

create index if not exists pr_status_idx on payment_requests(status);
create index if not exists pr_tg_idx on payment_requests(tg_id);
create index if not exists pr_created_idx on payment_requests(created_at desc);

-- Storage bucket for QR snapshots
insert into storage.buckets (id, name, public) 
  values ('qr', 'qr', true)
  on conflict (id) do nothing;

-- RLS (optional example): allow anonymous insert to create request, only admins can update
alter table payment_requests enable row level security;

do $$ begin
  create role admin;
exception when duplicate_object then null; end $$;

-- policy: anyone can insert (Mini App anonymous/server inserts)
create policy pr_insert_any on payment_requests for insert to public with check (true);

-- policy: admins can select and update
create policy pr_admin_rw on payment_requests 
for all to admin 
using (true) with check (true);

-- storage policies for 'qr' bucket (public read, insert via service)
create policy qr_public_read on storage.objects for select to public using ( bucket_id = 'qr' );
create policy qr_admin_write on storage.objects for all to admin using ( bucket_id = 'qr' ) with check ( bucket_id = 'qr' );
