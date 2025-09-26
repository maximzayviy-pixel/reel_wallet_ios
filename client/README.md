# Admin Lockdown Patch (Next.js App Router + Supabase)

This patch:
- Locks `/admin` and `/api/admin/*` behind login
- Enforces server-side admin checks
- Adds an audit log + webhook alerts
- Provides an "Incidents" admin page

## How to apply
1) Copy the files to your project (App Router assumed). Merge/adjust paths if needed.
2) Set environment variables from `.env.example`.
3) Run SQL files (in order) in Supabase SQL editor:
   - `sql/01_app_settings_and_audit.sql`
   - `sql/02_user_bans_table.sql` (optional but recommended)
   - `sql/03_security_revoke_trigger.sql`
   - `sql/04_rls_optional.sql` (ONLY if you use RLS and know the impact)
4) Deploy.

## Notes
- `middleware.ts` blocks unauthenticated access and supports optional Basic Auth as an emergency brake.
- All `/api/admin/*` endpoints must call `requireAdmin()`.
- Edit `ADMIN_ALLOWED_ORIGIN` to your domain for CSRF checks.
- Update UI imports if your structure differs.
