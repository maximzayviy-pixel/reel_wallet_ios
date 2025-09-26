-- === Enable RLS and add basic policies (adjust to your schema as needed) ===

-- USERS
alter table if exists public.users enable row level security;

-- Read self
do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'users' and policyname = 'users_read_self'
  ) then
    create policy "users_read_self" on public.users
      for select using ( tg_id = current_setting('request.jwt.claims', true)::json->>'telegram_id' );
  end if;
end $$;

-- Update: allow self to update safe columns only (adapt in app logic; here we allow all, but expect server-only admin updates)
-- You should tailor this to your column list.
do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'users' and policyname = 'users_update_self_safe'
  ) then
    create policy "users_update_self_safe" on public.users
      for update using ( tg_id = current_setting('request.jwt.claims', true)::json->>'telegram_id' );
  end if;
end $$;

-- SUBSCRIPTION TASKS (example table name; adjust if different)
alter table if exists public.subscription_tasks enable row level security;

-- Only admins can write (expects 'role' in JWT; for service role this is bypassed anyway)
do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'subscription_tasks' and policyname = 'tasks_admin_write'
  ) then
    create policy "tasks_admin_write" on public.subscription_tasks
      for all
      using ( (current_setting('request.jwt.claims', true)::json->>'role') = 'admin' )
      with check ( (current_setting('request.jwt.claims', true)::json->>'role') = 'admin' );
  end if;
end $$;

-- === Balance ledger & adjust function ===
create table if not exists public.balance_ledger (
  id bigserial primary key,
  user_id uuid not null references public.users(id),
  delta_rub integer not null,
  reason text not null,
  created_at timestamptz not null default now()
);

create or replace function public.adjust_balance(p_user uuid, p_delta integer, p_reason text)
returns void language plpgsql security definer as $$
begin
  insert into public.balance_ledger(user_id, delta_rub, reason) values (p_user, p_delta, p_reason);
  update public.users set balance_rub = coalesce(balance_rub, 0) + p_delta where id = p_user;
end;
$$;

comment on function public.adjust_balance(uuid, integer, text) is 'Admin/server-only balance adjustment with ledger entry.';
