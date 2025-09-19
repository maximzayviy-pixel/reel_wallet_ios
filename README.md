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


### Fixes 7 (2025-09-19T13:58:35.664066Z)
- Stars invoice endpoint подписывает payload HMAC-SHA256 (env INVOICE_SECRET).
- SQL view balances_by_tg для прямого селекта.
- Skeleton shimmer компонент и интеграция на Home/Profile/History.


### Fixes 8
- Все API перенесены в `client/pages/api/*` (Next.js) — больше не будет 404 на Vercel.
- На клиенте добавлена защита от `res.json()` при 404, чтобы не падал `JSON.parse`.
- В `_app.tsx` — повторные попытки получить Telegram `initDataUnsafe.user`.


### Stars Payments Setup (2025-09-19T14:04:31.278611Z)
1) В @BotFather включите **Payments → Stars** для вашего бота.
2) Установите вебхук бота на: `https://<your-domain>/api/telegram-webhook`.
3) В Vercel ENV укажите: `TELEGRAM_BOT_TOKEN`, `INVOICE_SECRET`.
4) В приложении `/topup` создайте инвойс (эндпоинт `/api/stars-invoice-bot`), Mini App откроет оплату через `WebApp.openInvoice`.
5) После `successful_payment` бот пришлёт апдейт на вебхук, сервер проверит подпись payload и зачислит звёзды и рублёвый эквивалент.


### Troubleshooting Stars
- Проверь, что в @BotFather включены **Payments → Stars** для твоего бота.
- Проверь ENV `TELEGRAM_BOT_TOKEN` (валидный токен бота).
- Если /api/stars-invoice-bot возвращает ошибку — в ответе теперь есть `error`/`raw`.
- Помни: инвойс в XTR доступен только из Telegram, не из обычного браузера.


### Fixes 13
- Перенёс обработчик вебхука в `client/pages/api/webhooks/telegram.ts` чтобы совпадал с URL, прописанным в Bot API.
- Старый файл `client/pages/api/telegram-webhook.ts` оставлен с комментарием-редиректом (на случай прямых обращений).


### Fixes 15 (2025-09-19T14:36:07.087400Z)
- Добавлен API `GET/POST /api/my-balance` — читает `tg_id` из заголовка `x-telegram-init-data` и берёт баланс из view `balances_by_tg` (через SERVICE_KEY), без RLS-проблем.
- Главная (`index.tsx`) теперь запрашивает баланс с сервера и показывает реальные `stars`, `ton` и общий рублёвый эквивалент.
