-- СРОЧНОЕ ИСПРАВЛЕНИЕ БАЛАНСА

-- 1. Удаляем все существующие версии функции
DROP FUNCTION IF EXISTS update_user_balance_by_tg_id(BIGINT);
DROP FUNCTION IF EXISTS update_user_balance_by_tg_id(bigint);

-- 2. Создаём простую функцию обновления баланса
CREATE OR REPLACE FUNCTION update_user_balance_by_tg_id(p_tg_id BIGINT)
RETURNS VOID AS $$
DECLARE
    v_user_id UUID;
    v_total_stars NUMERIC := 0;
    v_total_ton NUMERIC := 0;
    v_total_rub NUMERIC := 0;
BEGIN
    -- Получаем user_id по tg_id
    SELECT u.id INTO v_user_id
    FROM users u
    WHERE u.tg_id = p_tg_id;
    
    IF v_user_id IS NULL THEN
        RAISE WARNING 'User not found for tg_id: %', p_tg_id;
        RETURN;
    END IF;
    
    -- Считаем звёзды из ledger
    SELECT COALESCE(SUM(l.amount), 0) INTO v_total_stars
    FROM ledger l
    WHERE l.user_id = v_user_id 
    AND l.type LIKE '%stars%'
    AND l.status = 'done';
    
    -- Считаем TON из ledger
    SELECT COALESCE(SUM(l.amount), 0) INTO v_total_ton
    FROM ledger l
    WHERE l.user_id = v_user_id 
    AND l.type LIKE '%ton%'
    AND l.status = 'done';
    
    -- Считаем рубли из ledger
    SELECT COALESCE(SUM(l.amount_rub), 0) INTO v_total_rub
    FROM ledger l
    WHERE l.user_id = v_user_id 
    AND l.status = 'done';
    
    -- Обновляем или создаём запись в balances
    INSERT INTO balances (user_id, stars, ton, available_rub)
    VALUES (v_user_id, v_total_stars, v_total_ton, v_total_rub)
    ON CONFLICT (user_id) 
    DO UPDATE SET 
        stars = v_total_stars,
        ton = v_total_ton,
        available_rub = v_total_rub,
        bonus_rub = COALESCE(balances.bonus_rub, 0),
        hold_rub = COALESCE(balances.hold_rub, 0);
    
    -- Логируем результат
    RAISE NOTICE 'Updated balance for user %: stars=%, ton=%, rub=%', p_tg_id, v_total_stars, v_total_ton, v_total_rub;
END;
$$ LANGUAGE plpgsql;

-- 3. Даём права на выполнение
GRANT EXECUTE ON FUNCTION update_user_balance_by_tg_id TO anon;
GRANT EXECUTE ON FUNCTION update_user_balance_by_tg_id TO authenticated;

-- 4. Тестируем функцию
SELECT update_user_balance_by_tg_id(7086128174);

-- 5. Проверяем результат
SELECT 
    u.tg_id,
    b.stars,
    b.ton,
    b.available_rub
FROM users u
LEFT JOIN balances b ON b.user_id = u.id
WHERE u.tg_id = 7086128174;
