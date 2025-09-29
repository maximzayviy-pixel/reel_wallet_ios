# Admin patch for Reel Wallet (Next.js)

What’s included:
- Middleware to block `/admin/*` in browsers; shows a pretty "Доступ запрещён" page.
- `AdminGuard` client component validating session via `/api/admin/session`.
- Reusable `AdminTable` with pagination/sorting/search.
- Admin pages: `/admin` (hub), `/admin/balances`, `/admin/webhooks`, `/admin/gifts`, `/admin/promocodes`.
- API endpoints:
  - `GET /api/admin/session` — checks role admin.
  - `GET /api/admin/balances` + `POST` to credit balance via RPC `admin_credit_balance`.
  - `GET /api/admin/webhook-logs`
  - `GET /api/admin/gifts-orders`
  - `GET /api/admin/promocodes` + `POST` to create promocode with currency selection.
  - `POST /api/admin/ban` — ban/unban user.
  - `POST /api/admin/verify-badge` — toggle check mark.
  - `POST /api/admin/grant-stars` — grant Telegram Stars via RPC `admin_grant_stars`.

## Required SQL (you likely have similar)

```sql
-- Example RPCs (adjust names to your DB)
create or replace function admin_credit_balance(p_tg_id bigint, p_amount numeric, p_currency text, p_reason text default 'admin_adjustment')
returns void language plpgsql security definer as $$
begin
  insert into ledger(tg_id, amount, currency, reason) values (p_tg_id, p_amount, p_currency, p_reason);
end $$;

create or replace function admin_grant_stars(p_tg_id bigint, p_stars integer)
returns void language plpgsql security definer as $$
begin
  update users set balance_stars = coalesce(balance_stars,0) + p_stars where tg_id = p_tg_id;
  insert into ledger(tg_id, amount, currency, reason) values (p_tg_id, p_stars, 'STARS', 'admin_grant');
end $$;
```

## Env
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` (existing)
- `SUPABASE_SERVICE_KEY` (server-only)
- `NEXT_PUBLIC_ADMINS` optional list of Telegram IDs

Drop these files into your repo and deploy.
