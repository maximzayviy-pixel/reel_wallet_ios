# Gifts Marketplace (Stars)

Витрина подарков за ⭐ внутри страницы **/browser** + API.

## Установка

1. Залей файлы в корень `client/` (Next.js Pages Router).
2. Применить SQL в Supabase (таблицы + RLS):
   ```sql
   -- см. sql/schema.sql
   ```
3. Переменные окружения (Vercel → Project Settings → Env):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_KEY`
   - `TELEGRAM_BOT_TOKEN`
   - `BOT_USERNAME` (например, `reelwallet_bot`)
   - `INVOICE_SECRET` (любой секрет)
   - `TELEGRAM_ADMIN_CHAT` (chat_id админа, опционально)

## Маршруты API

- `GET /api/gifts-list` — активные листинги.
- `POST /api/gifts-create-listing` — создать листинг (status=`pending`). Body: `{ title, price_stars, quantity, media_url?, seller_tg_id }`.
- `POST /api/gifts-admin-activate` — активировать листинг (модерация). Header: `Authorization: Bearer ${INVOICE_SECRET}`. Body: `{ listing_id }`.
- `POST /api/gifts-buy` — создаёт order и выдаёт `invoice_link` Stars.
- `POST /api/gifts-payment-webhook` — помечает заказ оплаченным, уменьшает остаток, начисляет продавцу в `ledger`. Header: `x-invoice-secret: ${INVOICE_SECRET}`. Body: `{ order_id }`.

### Интеграция оплаты Stars

Мы используем `createInvoiceLink` с `currency: "XTR"`. После оплаты ты можешь:
- Либо вызывать `POST /api/gifts-payment-webhook` из своего основного Telegram webhook, когда получаешь `successful_payment` (передаёшь `order_id` из payload).
- Либо вручную дернуть `gifts-payment-webhook` для теста.

## UI

Страница `/browser` показывает сетку активных подарков и форму выставления своих подарков. Покупка открывает инвойс в Mini App.

