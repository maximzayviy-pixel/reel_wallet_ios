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


## ENTERPRISE апгрейд (2025-09-19T13:24:25.395829Z)
- EMV-парсер поддерживает теги 62.xx (terminal_id, order_id и пр.).
- Экран оплаты `/payment/[id]` с живым прогрессом статуса через Supabase Realtime.
- Supabase RLS + роли (user/admin) для безопасного доступа.
- UI-полиш: шрифт Inter, иконки lucide-react, анимации framer-motion, skeleton.


### Fixes 6 (2025-09-19T13:54:15.356959Z)
- Подключили Telegram WebApp скрипт через `_document.tsx`.
- Профиль ретраит initDataUnsafe до 4с, авто-upsert.
- Stars-инвойс через Bot API (`/api/stars-invoice-bot`).
- Сканер делает снимок кадра и отправляет на `/api/scan-submit`, бэкенд сохраняет в Supabase Storage (`qr-shots`).
