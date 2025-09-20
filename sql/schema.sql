
create table if not exists gift_listings (
  id uuid primary key default gen_random_uuid(),
  name text,
  price_stars int,
  seller_tg_id bigint,
  status text default 'pending',
  created_at timestamp default now()
);

create table if not exists gift_orders (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid references gift_listings(id),
  buyer_tg_id bigint,
  status text default 'pending',
  created_at timestamp default now()
);
