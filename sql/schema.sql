-- sql/schema.sql (ensure columns are present)
create table if not exists payment_requests (
  id uuid primary key default gen_random_uuid(),
  tg_id bigint not null,
  qr_payload text not null,
  image_url text,
  amount_rub integer not null check (amount_rub > 0),
  max_limit_rub integer,
  status text not null default 'pending' check (status in ('pending','paid','rejected','cancelled')),
  created_at timestamptz default now()
);
create index if not exists payment_requests_tg_id_idx on payment_requests (tg_id);
