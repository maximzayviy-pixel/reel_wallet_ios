# Reel Wallet — Vercel API Patch

Положи папку `api/` в КОРЕНЬ репозитория (рядом с `vercel.json`).  
После деплоя появятся serverless‑эндпоинты:

- `GET /api/my-balance?tg_id=7086128174` — отдаёт `{stars, ton, total_rub}` из `balances_by_tg` (через SERVICE_KEY).
- `POST /api/stars-invoice-bot` — создаёт ссылку на инвойс Stars и шлёт кнопку в ЛС пользователю.
  Также можно тестить `GET /api/stars-invoice-bot?amount_stars=12&tg_id=7086128174`.

## ENV на Vercel
- `SUPABASE_URL`
- `SUPABASE_SERVICE_KEY`
- `TELEGRAM_BOT_TOKEN`

## Быстрая проверка
- https://<домен>/api/my-balance?tg_id=<id> → должен вернуть JSON с балансом.
- https://<домен>/api/stars-invoice-bot?amount_stars=12&tg_id=<id> → должен вернуть `{ ok:true, link }`.

