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
