create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  tg_id bigint unique,
  username text,
  is_verified boolean default false,
  is_banned boolean default false,
  role text default 'user',
  created_at timestamptz default now()
);
create table if not exists balances (
  user_id uuid references users(id) on delete cascade,
  available_rub numeric default 0,
  bonus_rub numeric default 0,
  hold_rub numeric default 0,
  primary key(user_id)
);
create table if not exists ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id),
  type text not null,
  amount_rub numeric not null,
  asset_amount numeric,
  rate_used numeric,
  status text default 'done',
  metadata jsonb,
  created_at timestamptz default now()
);
create table if not exists payment_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id),
  qr_payload text,
  qr_image_url text,
  amount_rub numeric,
  max_limit_rub numeric,
  status text default 'new',
  admin_id uuid references users(id),
  paid_amount_rub numeric,
  created_at timestamptz default now(),
  paid_at timestamptz
);

-- ensure Telegram fields
alter table if exists users add column if not exists first_name text;
alter table if exists users add column if not exists last_name text;
-- index for tg id
create unique index if not exists users_tg_id_key on users(tg_id);
