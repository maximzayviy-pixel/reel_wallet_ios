-- Gift marketplace schema

create table if not exists public.gift_listings (
  id uuid primary key default gen_random_uuid(),
  seller_tg_id bigint not null,
  title text not null,
  media_url text,
  price_stars int not null check (price_stars > 0),
  quantity int not null default 1 check (quantity >= 0),
  status text not null default 'pending' check (status in ('pending','active','archived')),
  created_at timestamptz not null default now()
);

create table if not exists public.gift_orders (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.gift_listings(id) on delete cascade,
  buyer_tg_id bigint not null,
  stars int not null,
  status text not null default 'pending' check (status in ('pending','paid','cancelled')),
  invoice_link text,
  payload text,
  created_at timestamptz not null default now()
);

-- optional: a simple ledger (if not exists)
create table if not exists public.ledger (
  id uuid primary key default gen_random_uuid(),
  tg_id bigint not null,
  type text not null,
  stars int default 0,
  ton numeric default 0,
  meta jsonb,
  created_at timestamptz not null default now()
);

-- RLS
alter table public.gift_listings enable row level security;
alter table public.gift_orders enable row level security;

do $$ begin
  create policy if not exists gift_listings_select on public.gift_listings for select using (status = 'active');
exception when duplicate_object then null; end $$;

do $$ begin
  create policy if not exists gift_listings_insert on public.gift_listings for insert with check (true);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy if not exists gift_orders_insert on public.gift_orders for insert with check (true);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy if not exists gift_orders_select on public.gift_orders for select using (true);
exception when duplicate_object then null; end $$;
