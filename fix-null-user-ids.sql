-- Скрипт для исправления записей с null user_id в ledger

-- 1. Найдём записи с null user_id
SELECT 
    id, 
    tg_id, 
    type, 
    amount, 
    amount_rub, 
    created_at
FROM ledger 
WHERE user_id IS NULL 
ORDER BY created_at DESC 
LIMIT 10;

-- 2. Обновим user_id для записей с null, где есть tg_id
UPDATE ledger 
SET user_id = (
    SELECT u.id 
    FROM users u 
    WHERE u.tg_id = ledger.tg_id 
    LIMIT 1
)
WHERE user_id IS NULL 
AND tg_id IS NOT NULL;

-- 3. Проверим, сколько записей осталось с null user_id
SELECT COUNT(*) as null_user_id_count
FROM ledger 
WHERE user_id IS NULL;

-- 4. Если есть записи с null user_id и null tg_id, удалим их (они бесполезны)
DELETE FROM ledger 
WHERE user_id IS NULL 
AND tg_id IS NULL;

-- 5. Создадим недостающих пользователей для записей с tg_id, но без user_id
INSERT INTO users (tg_id, created_at)
SELECT DISTINCT 
    ledger.tg_id,
    MIN(ledger.created_at) as created_at
FROM ledger 
WHERE ledger.user_id IS NULL 
AND ledger.tg_id IS NOT NULL
AND NOT EXISTS (
    SELECT 1 FROM users u WHERE u.tg_id = ledger.tg_id
)
GROUP BY ledger.tg_id;

-- 6. Снова обновим user_id для оставшихся записей
UPDATE ledger 
SET user_id = (
    SELECT u.id 
    FROM users u 
    WHERE u.tg_id = ledger.tg_id 
    LIMIT 1
)
WHERE user_id IS NULL 
AND tg_id IS NOT NULL;

-- 7. Проверим результат
SELECT 
    COUNT(*) as total_records,
    COUNT(user_id) as records_with_user_id,
    COUNT(*) - COUNT(user_id) as records_without_user_id
FROM ledger;

-- 8. Обновим все балансы
SELECT refresh_all_balances();

-- 9. Проверим несколько балансов
SELECT 
    u.tg_id,
    b.stars,
    b.ton,
    b.available_rub
FROM users u
LEFT JOIN balances b ON b.user_id = u.id
ORDER BY b.stars DESC NULLS LAST
LIMIT 10;
