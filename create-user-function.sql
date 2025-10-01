-- Функция для создания/обновления пользователя (обходит RLS)
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
  -- Вставляем или обновляем пользователя
  INSERT INTO users (tg_id, username, first_name, last_name, role)
  VALUES (p_tg_id, p_username, p_first_name, p_last_name, 'user')
  ON CONFLICT (tg_id) 
  DO UPDATE SET
    username = COALESCE(EXCLUDED.username, users.username),
    first_name = COALESCE(EXCLUDED.first_name, users.first_name),
    last_name = COALESCE(EXCLUDED.last_name, users.last_name)
  WHERE users.tg_id = p_tg_id;
  
  -- Возвращаем данные пользователя
  RETURN QUERY
  SELECT 
    u.id,
    u.tg_id,
    u.username,
    u.first_name,
    u.last_name,
    u.role,
    u.created_at
  FROM users u
  WHERE u.tg_id = p_tg_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Даём права на выполнение функции
GRANT EXECUTE ON FUNCTION create_or_update_user TO anon;
GRANT EXECUTE ON FUNCTION create_or_update_user TO authenticated;
