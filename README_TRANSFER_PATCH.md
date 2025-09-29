# Transfer Auth Patch

This patch fixes the P2P transfer endpoint by requiring **either**:
- Supabase Bearer token (recommended), or
- Telegram WebApp `initData` header (fallback).

## Files
- `client/pages/api/transfer-stars.ts` — updated API with dual authentication.
- `client/lib/sendTransfer.ts` — helper to call the API from the client.

## Env vars
- `SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` (or `SUPABASE_SERVICE_KEY`)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `TELEGRAM_BOT_TOKEN` — required to verify `initData`

## Frontend usage
Import and call:
```ts
import { sendTransfer } from "@/client/lib/sendTransfer";
await sendTransfer(7086128174, 10, "за обед");
```

The helper will use a Supabase session token if available; otherwise it sends `X-Telegram-Init-Data` header.
