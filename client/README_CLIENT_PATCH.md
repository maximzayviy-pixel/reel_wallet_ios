# Client Patch (Next.js 13 App Router)

Unzip **into the `client/` folder** of your repo.

This patch provides:
- `lib/requireAuth.ts` — satisfies `@/lib/requireAuth` import used by `app/api/admin/.../route.ts`, adds Telegram Mini App verification + `requireUser`/`requireAdmin`.
- `lib/supabaseAdmin.ts` — server Supabase client.
- `app/api/whoami/route.ts` — minimal route to test auth.
- `app/scan-kozen/page.tsx` — improved QR scanner for Kozen P12.
- `middleware.ts` — blocks `/admin` and `/api/admin/*` without `Authorization: tma <initDataRaw>`.
- `app/403/page.tsx` — Forbidden page.
- `supabase/hardening.sql` — SQL you can run in Supabase to enable RLS + ledger.

## Env
Set in Vercel:
- `SUPABASE_URL` (or `NEXT_PUBLIC_SUPABASE_URL`)
- `SUPABASE_SERVICE_KEY`
- `TG_BOT_TOKEN`
- `ADMIN_TG_IDS` (comma-separated Telegram IDs)

## Notes
- The helpers throw a `Response` on auth failure. In Next.js App Router this becomes the HTTP response automatically.
- If some admin routes still use old imports, point them to `@/lib/requireAuth` (this file).
