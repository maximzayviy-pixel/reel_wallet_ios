PATCH: Telegram ID admin auto-redirect
=====================================
Дата: 2025-09-22 08:46:51

Что внутри:
- client/hooks/useAdminRedirect.ts — хук, который читает window.Telegram.WebApp.initDataUnsafe.user.id
  и, если он в списке админов (NEXT_PUBLIC_ADMIN_IDS), делает мгновенный redirect на /admin.
- client/pages/_app.tsx — подключение хука. Дизайн НЕ тронут.
- middleware.ts (опционально) — серверный гард /admin по Telegram ID, если вы пробрасываете tgId в заголовок/куку.

Переменные окружения (Vercel):
- NEXT_PUBLIC_ADMIN_IDS="123456789,987654321"   # Telegram user.id через запятую

Как применить:
1) Распаковать архив в корень проекта, подтвердив замену файлов/папок.
2) В Vercel/локально добавить переменную NEXT_PUBLIC_ADMIN_IDS.
3) Задеплоить. Откройте WebApp из Telegram под админским аккаунтом — произойдёт автопереход в /admin.

Примечание: Хук не меняет стили/верстку, только логику редиректа.
