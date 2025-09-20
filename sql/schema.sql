alter table users
  add column if not exists is_verified boolean not null default false;

create index if not exists users_tg_id_idx on users (tg_id);