-- Функция для обновления баланса пользователя на основе ledger
CREATE OR REPLACE FUNCTION update_user_balance(p_user_id UUID)
RETURNS VOID AS $$
DECLARE
    total_stars NUMERIC := 0;
    total_ton NUMERIC := 0;
    total_rub NUMERIC := 0;
BEGIN
    -- Считаем звёзды из ledger
    SELECT COALESCE(SUM(amount), 0) INTO total_stars
    FROM ledger 
    WHERE user_id = p_user_id 
    AND type LIKE '%stars%'
    AND status = 'done';
    
    -- Считаем TON из ledger
    SELECT COALESCE(SUM(amount), 0) INTO total_ton
    FROM ledger 
    WHERE user_id = p_user_id 
    AND type LIKE '%ton%'
    AND status = 'done';
    
    -- Считаем рубли из ledger
    SELECT COALESCE(SUM(amount_rub), 0) INTO total_rub
    FROM ledger 
    WHERE user_id = p_user_id 
    AND status = 'done';
    
    -- Обновляем или создаём запись в balances
    INSERT INTO balances (user_id, stars, ton, available_rub)
    VALUES (p_user_id, total_stars, total_ton, total_rub)
    ON CONFLICT (user_id) 
    DO UPDATE SET 
        stars = total_stars,
        ton = total_ton,
        available_rub = total_rub,
        bonus_rub = COALESCE(balances.bonus_rub, 0),
        hold_rub = COALESCE(balances.hold_rub, 0);
END;
$$ LANGUAGE plpgsql;

-- Функция для обновления баланса по tg_id
CREATE OR REPLACE FUNCTION update_user_balance_by_tg_id(p_tg_id BIGINT)
RETURNS VOID AS $$
DECLARE
    user_uuid UUID;
BEGIN
    -- Получаем user_id по tg_id
    SELECT id INTO user_uuid
    FROM users 
    WHERE tg_id = p_tg_id;
    
    IF user_uuid IS NOT NULL THEN
        PERFORM update_user_balance(user_uuid);
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Триггер для автоматического обновления баланса при изменении ledger
CREATE OR REPLACE FUNCTION trigger_update_balance()
RETURNS TRIGGER AS $$
BEGIN
    -- Обновляем баланс для user_id из записи
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        PERFORM update_user_balance(NEW.user_id);
    ELSIF TG_OP = 'DELETE' THEN
        PERFORM update_user_balance(OLD.user_id);
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Создаём триггер
DROP TRIGGER IF EXISTS ledger_balance_trigger ON ledger;
CREATE TRIGGER ledger_balance_trigger
    AFTER INSERT OR UPDATE OR DELETE ON ledger
    FOR EACH ROW
    EXECUTE FUNCTION trigger_update_balance();

-- Функция для массового обновления всех балансов
CREATE OR REPLACE FUNCTION refresh_all_balances()
RETURNS VOID AS $$
DECLARE
    user_record RECORD;
BEGIN
    FOR user_record IN SELECT id FROM users LOOP
        PERFORM update_user_balance(user_record.id);
    END LOOP;
END;
$$ LANGUAGE plpgsql;
