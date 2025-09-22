HOTFIX (без изменений дизайна / провайдеров)
==========================================
1) УДАЛИТЕ добавленные ранее файлы:
   - client/pages/_app.tsx
   - middleware.ts
2) Добавьте/замените только эти серверные роуты:
   - pages/api/scan-submit.ts
   - pages/api/buy-verify.ts
   - pages/api/complete-verify.ts
3) Переменные окружения (Vercel):
   - SUPABASE_URL / NEXT_PUBLIC_SUPABASE_URL
   - SUPABASE_SERVICE_KEY
   - NEXT_PUBLIC_SUPABASE_ANON_KEY (безопасно для клиента, но SERVICE_KEY — только на сервере)

Пояснение:
- Эти API-роуты не затрагивают клиентский UI и стили, не ломают провайдеры и не влияют на расчёт баланса.
- Баланс = как и раньше (зависит от вашей логики/таблиц). Если где-то стал 0, проблема была из-за перезаписи _app.tsx.
