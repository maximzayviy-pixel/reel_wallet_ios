# Security & Kozen P12 QR Fix Kit

This kit delivers:
- **Admin lockdown**: blocks `/admin` and `/api/admin/*` unless Telegram Mini App auth header is present.
- **Server-side Telegram Mini App signature verification** (`pages/api/_auth.ts`).
- **`/api/whoami`** endpoint to check role & session.
- **Supabase hardening SQL**: RLS policies + `adjust_balance` ledger function.
- **Improved QR scanner page** at `/scan-kozen` with ZXing hints and torch toggle for Kozen P12 terminals.

> Minimal downtime approach: deploy this first to cut off the exploit paths. Then run the SQL once in Supabase and rotate your keys.

---

## 0) Environment variables (Vercel project Settings → Environment Variables)
Set these (do **not** commit real secrets to git):
```
SUPABASE_URL=...
SUPABASE_SERVICE_KEY=...
TG_BOT_TOKEN=123456:ABC-DEF...   # Your bot token
ADMIN_TG_IDS=111111111,222222222 # Comma-separated Telegram user IDs with admin rights
```

After deployment, **rotate** your Supabase keys (`service_role` and `anon`) in Supabase → Settings → API.

---

## 1) What this immediately does after upload
- `middleware.ts` returns **403** for `/admin` and `/api/admin/*` unless the request includes `Authorization: tma <initDataRaw>`.
- All new secure APIs validate the Telegram Mini App signature **server-side**.
- A safe scanner page `/scan-kozen` improves QR reads from **Kozen P12** (high-contrast, TRY_HARDER, inverted, torch).

You can continue to use your existing app. Old unsafe admin routes are effectively blocked for anonymous requests.

---

## 2) Apply Supabase hardening (one-off)
Open `supabase/hardening.sql` and run its content in **Supabase SQL editor**.
It will:
- Enable **RLS** on sensitive tables (you can adapt table names if different).
- Add **ledger** table for balance changes + `adjust_balance(p_user uuid, p_delta integer, p_reason text)`.

> If your schemas/table names differ, adjust the SQL accordingly before running.

---

## 3) Test the new flow
- From your Mini App, call `/api/whoami` with header `Authorization: tma <initDataRaw>` — it should return the verified user and `is_admin` flag.
- Visit `/scan-kozen` page on a device and scan an NSPK/EMVCo QR from a Kozen P12 terminal.
  - Use the torch toggle if needed.
  - The page only **decodes** and shows payload; you can wire it to your existing submit endpoint.

---

## 4) Optional: wrap your existing admin APIs
Inside your old admin API handlers, call the helper from `pages/api/_auth.ts`:
```ts
import { requireAdmin } from '../_auth';
// ...
await requireAdmin(req, res, supabaseClient);
```
This enforces server-side admin verification **before** any database writes.

---

## 5) Notes
- Middleware check is a coarse front-door block; the **real** verification is done in the API via HMAC.
- If your project uses `app/` directory instead of `pages/`, move the API files into `app/api/.../route.ts` and adapt imports accordingly.
- If your existing scanner already uses ZXing, you can copy the relevant parts from `pages/scan-kozen.tsx`.

