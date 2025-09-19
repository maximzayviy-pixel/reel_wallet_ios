# Telegram Wallet Mini App (TON + Stars → ₽)

Готовый каркас мини-аппа Telegram с админкой.

## Быстрый старт
1. Создай проект в Supabase. Импортируй SQL из `supabase/`:
   - `schema.sql`
   - `functions.sql`
   - `functions_bonus.sql`
   - `functions_credit.sql`
2. В Supabase Storage создай **bucket** `qr-shots` (public).
3. В Vercel добавь переменные окружения:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_KEY`
4. Залей репозиторий в GitHub и задеплой на Vercel.
5. В BotFather создай Mini App и укажи домен из Vercel.

## Навигация
- `/` — Главная (баланс)
- `/scan` — Сканер СБП
- `/admin` — Заявки
- `/admin/users` — Пользователи

Сборка: 2025-09-19T12:49:38.247480Z


## PRO апгрейд (2025-09-19T13:20:19.329663Z)
- EMV парсер (`client/lib/emv.ts`) — суммы/валюта/мерчант.
- Realtime-история (`/history`) — статусы обновляются онлайн.
- Привязка к Telegram ID (`/api/auth-upsert`) — сохраняем `tg_id` и создаём пользователя.
- Пуш-уведомления через бота — переменная `TELEGRAM_BOT_TOKEN`, отправка в `admin-confirm.ts`/`admin-reject.ts`.
