-- ПОЛНОЕ ИСПРАВЛЕНИЕ СИСТЕМЫ

-- 1. ИСПРАВЛЯЕМ RLS ПОЛИТИКИ
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users_self" ON users;
DROP POLICY IF EXISTS "users_select" ON users;
DROP POLICY IF EXISTS "users_insert" ON users;
DROP POLICY IF EXISTS "users_update" ON users;
DROP POLICY IF EXISTS "users_delete" ON users;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_all_access" ON users 
FOR ALL 
USING (true)
WITH CHECK (true);

-- 2. СОЗДАЁМ ФУНКЦИЮ ДЛЯ СОЗДАНИЯ ПОЛЬЗОВАТЕЛЕЙ
CREATE OR REPLACE FUNCTION create_or_update_user(
  p_tg_id BIGINT,
  p_username TEXT DEFAULT NULL,
  p_first_name TEXT DEFAULT NULL,
  p_last_name TEXT DEFAULT NULL
)
RETURNS TABLE(
  id UUID,
  tg_id BIGINT,
  username TEXT,
  first_name TEXT,
  last_name TEXT,
  role TEXT,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  INSERT INTO users (tg_id, username, first_name, last_name, role)
  VALUES (p_tg_id, p_username, p_first_name, p_last_name, 'user')
  ON CONFLICT (tg_id) 
  DO UPDATE SET
    username = COALESCE(EXCLUDED.username, users.username),
    first_name = COALESCE(EXCLUDED.first_name, users.first_name),
    last_name = COALESCE(EXCLUDED.last_name, users.last_name)
  WHERE users.tg_id = p_tg_id;
  
  RETURN QUERY
  SELECT 
    u.id, u.tg_id, u.username, u.first_name, u.last_name, u.role, u.created_at
  FROM users u
  WHERE u.tg_id = p_tg_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. СОЗДАЁМ ФУНКЦИЮ ДЛЯ ОБНОВЛЕНИЯ БАЛАНСА
CREATE OR REPLACE FUNCTION update_user_balance_by_tg_id(p_tg_id BIGINT)
RETURNS VOID AS $$
DECLARE
    user_uuid UUID;
    total_stars NUMERIC := 0;
    total_ton NUMERIC := 0;
    total_rub NUMERIC := 0;
BEGIN
    SELECT id INTO user_uuid FROM users WHERE tg_id = p_tg_id;
    
    IF user_uuid IS NULL THEN
        RAISE WARNING 'User not found for tg_id: %', p_tg_id;
        RETURN;
    END IF;
    
    SELECT COALESCE(SUM(amount), 0) INTO total_stars
    FROM ledger WHERE user_id = user_uuid AND type LIKE '%stars%' AND status = 'done';
    
    SELECT COALESCE(SUM(amount), 0) INTO total_ton
    FROM ledger WHERE user_id = user_uuid AND type LIKE '%ton%' AND status = 'done';
    
    SELECT COALESCE(SUM(amount_rub), 0) INTO total_rub
    FROM ledger WHERE user_id = user_uuid AND status = 'done';
    
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

-- 4. СОЗДАЁМ ФУНКЦИЮ ДЛЯ МАССОВОГО ОБНОВЛЕНИЯ БАЛАНСОВ
CREATE OR REPLACE FUNCTION refresh_all_balances()
RETURNS VOID AS $$
DECLARE
    user_record RECORD;
BEGIN
    FOR user_record IN SELECT id, tg_id FROM users LOOP
        PERFORM update_user_balance_by_tg_id(user_record.tg_id);
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- 5. ДАЁМ ПРАВА НА ВЫПОЛНЕНИЕ
GRANT EXECUTE ON FUNCTION create_or_update_user TO anon;
GRANT EXECUTE ON FUNCTION create_or_update_user TO authenticated;
GRANT EXECUTE ON FUNCTION update_user_balance_by_tg_id TO anon;
GRANT EXECUTE ON FUNCTION update_user_balance_by_tg_id TO authenticated;
GRANT EXECUTE ON FUNCTION refresh_all_balances TO anon;
GRANT EXECUTE ON FUNCTION refresh_all_balances TO authenticated;

-- 6. ИСПРАВЛЯЕМ ЗАПИСИ С NULL USER_ID
UPDATE ledger 
SET user_id = (SELECT u.id FROM users u WHERE u.tg_id = ledger.tg_id LIMIT 1)
WHERE user_id IS NULL AND tg_id IS NOT NULL;

-- 7. ОБНОВЛЯЕМ ВСЕ БАЛАНСЫ
SELECT refresh_all_balances();

-- 8. ПРОВЕРЯЕМ РЕЗУЛЬТАТ
SELECT 
    COUNT(*) as total_users,
    COUNT(CASE WHEN role = 'user' THEN 1 END) as regular_users,
    COUNT(CASE WHEN role = 'admin' THEN 1 END) as admins
FROM users;

SELECT 
    COUNT(*) as total_ledger_records,
    COUNT(user_id) as records_with_user_id,
    COUNT(*) - COUNT(user_id) as records_without_user_id
FROM ledger;

SELECT 
    COUNT(*) as total_balance_records,
    AVG(stars) as avg_stars,
    SUM(stars) as total_stars
FROM balances;
