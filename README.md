# Telegram Wallet Mini App

## Deploy

1. Создай проект в Supabase, примени миграции из `supabase/schema.sql`
2. В Vercel добавь переменные окружения:
   - NEXT_PUBLIC_SUPABASE_URL
   - NEXT_PUBLIC_SUPABASE_ANON_KEY
   - SUPABASE_SERVICE_KEY
3. Подключи репозиторий к Vercel и задеплой
4. Настрой Mini App в BotFather с URL от Vercel


## Monorepo / Зависимости
- Корневой `package.json` содержит зависимости для API (`@supabase/supabase-js`) и TypeScript для сборки серверных функций.
- Клиентские зависимости находятся в `client/package.json`.
- Vercel билдит Next.js из `client/package.json`, а API — из `api/**/*.ts`.

## Сканер и вебхуки
- Страница **/scan** — камера, кадр → Supabase Storage (bucket `qr-shots`), заявка в `/api/scan-submit`.
  - Создай в Supabase Storage публичный bucket `qr-shots`.
- Вебхуки пополнений:
  - `POST /api/topup-ton` — `{ user_id, amount_ton }` → рубли по курсу 1 TON = 300 ₽.
  - `POST /api/topup-stars` — `{ user_id, stars }` → рубли по курсу 2 Stars = 1 ₽.
- Импортируй в БД: `supabase/functions.sql`, `supabase/functions_bonus.sql`, `supabase/functions_credit.sql`.

## Переменные окружения
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` — браузерный клиент.
- `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` — серверные вебхуки/API.
