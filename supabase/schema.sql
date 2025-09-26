create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  tg_id bigint unique,
  username text,
  is_verified boolean default false,
  is_banned boolean default false,
  role text default 'user',
  created_at timestamptz default now()
  -- reason for banning a user; nullable if not banned
  ,ban_reason text
  -- optional message supplied by the user when appealing a ban
  ,ban_appeal text
  -- status of the ban/appeal. 'active' by default when a user is banned,
  -- can be 'pending' when a user has submitted an appeal, or null when no ban
  ,ban_status text
  -- if true, user is restricted from performing transfers or withdrawals
  ,wallet_restricted boolean default false
  -- optional per‑user limit for outgoing transfers in ₽ (rubles). If null or 0 no limit applies
  ,wallet_limit numeric
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

-- Role for admin
alter table if exists users add column if not exists role text default 'user';

-- Enable RLS
alter table if exists users enable row level security;
alter table if exists balances enable row level security;
alter table if exists payment_requests enable row level security;

-- Policies: users see themselves, admins see all
drop policy if exists "users_self" on users;
create policy "users_self" on users for select using (auth.uid()::text = tg_id::text or role='admin');

drop policy if exists "balances_self" on balances;
create policy "balances_self" on balances for select using (user_id in (select id from users where auth.uid()::text = tg_id::text) or exists(select 1 from users u where u.id=balances.user_id and u.role='admin'));

drop policy if exists "pr_self" on payment_requests;
create policy "pr_self" on payment_requests for select using (user_id in (select id from users where auth.uid()::text = tg_id::text) or exists(select 1 from users u where u.id=payment_requests.user_id and u.role='admin'));

-- asset balances
alter table if exists balances add column if not exists stars numeric default 0;
alter table if exists balances add column if not exists ton numeric default 0;


-- View for balances by tg_id
create or replace view balances_by_tg as
select u.tg_id, b.stars, b.ton, (coalesce(b.stars,0)/2 + coalesce(b.ton,0)*300) as total_rub
from users u
join balances b on b.user_id = u.id;
