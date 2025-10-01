-- Простая функция для обновления баланса
CREATE OR REPLACE FUNCTION update_user_balance_by_tg_id(p_tg_id BIGINT)
RETURNS VOID AS $$
DECLARE
    user_uuid UUID;
    total_stars NUMERIC := 0;
    total_ton NUMERIC := 0;
    total_rub NUMERIC := 0;
BEGIN
    -- Получаем user_id по tg_id
    SELECT id INTO user_uuid
    FROM users 
    WHERE tg_id = p_tg_id;
    
    IF user_uuid IS NULL THEN
        RAISE WARNING 'User not found for tg_id: %', p_tg_id;
        RETURN;
    END IF;
    
    -- Считаем звёзды из ledger
    SELECT COALESCE(SUM(amount), 0) INTO total_stars
    FROM ledger 
    WHERE user_id = user_uuid 
    AND type LIKE '%stars%'
    AND status = 'done';
    
    -- Считаем TON из ledger
    SELECT COALESCE(SUM(amount), 0) INTO total_ton
    FROM ledger 
    WHERE user_id = user_uuid 
    AND type LIKE '%ton%'
    AND status = 'done';
    
    -- Считаем рубли из ledger
    SELECT COALESCE(SUM(amount_rub), 0) INTO total_rub
    FROM ledger 
    WHERE user_id = user_uuid 
    AND status = 'done';
    
    -- Обновляем или создаём запись в balances
    INSERT INTO balances (user_id, stars, ton, available_rub)
    VALUES (user_uuid, total_stars, total_ton, total_rub)
    ON CONFLICT (user_id) 
    DO UPDATE SET 
        stars = total_stars,
        ton = total_ton,
        available_rub = total_rub,
        bonus_rub = COALESCE(balances.bonus_rub, 0),
        hold_rub = COALESCE(balances.hold_rub, 0);
        
    RAISE NOTICE 'Updated balance for user %: stars=%, ton=%, rub=%', p_tg_id, total_stars, total_ton, total_rub;
END;
$$ LANGUAGE plpgsql;

-- Даём права на выполнение
GRANT EXECUTE ON FUNCTION update_user_balance_by_tg_id TO anon;
GRANT EXECUTE ON FUNCTION update_user_balance_by_tg_id TO authenticated;
