-- See repo root README for context; run this in Supabase SQL editor after deploy.
alter table if exists public.users enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'users' and policyname = 'users_read_self'
  ) then
    create policy "users_read_self" on public.users
      for select using ( tg_id = current_setting('request.jwt.claims', true)::json->>'telegram_id' );
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'users' and policyname = 'users_update_self_safe'
  ) then
    create policy "users_update_self_safe" on public.users
      for update using ( tg_id = current_setting('request.jwt.claims', true)::json->>'telegram_id' );
  end if;
end $$;

alter table if exists public.subscription_tasks enable row level security;

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
