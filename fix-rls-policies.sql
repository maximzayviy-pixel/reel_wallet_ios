-- Исправление RLS политик для таблицы users

-- 1. Включаем RLS для таблицы users (если не включен)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- 2. Удаляем старые политики
DROP POLICY IF EXISTS "users_self" ON users;
DROP POLICY IF EXISTS "users_insert" ON users;
DROP POLICY IF EXISTS "users_update" ON users;

-- 3. Создаём политику для SELECT (пользователи видят себя, админы видят всех)
CREATE POLICY "users_select" ON users 
FOR SELECT 
USING (
  auth.uid()::text = tg_id::text 
  OR EXISTS (
    SELECT 1 FROM users u 
    WHERE u.tg_id = auth.uid()::bigint 
    AND u.role = 'admin'
  )
);

-- 4. Создаём политику для INSERT (любой может создать пользователя)
CREATE POLICY "users_insert" ON users 
FOR INSERT 
WITH CHECK (true);

-- 5. Создаём политику для UPDATE (пользователи могут обновлять себя, админы всех)
CREATE POLICY "users_update" ON users 
FOR UPDATE 
USING (
  auth.uid()::text = tg_id::text 
  OR EXISTS (
    SELECT 1 FROM users u 
    WHERE u.tg_id = auth.uid()::bigint 
    AND u.role = 'admin'
  )
)
WITH CHECK (
  -- Пользователи не могут менять роль на admin
  (auth.uid()::text = tg_id::text AND role != 'admin')
  OR 
  -- Админы могут менять любые роли
  EXISTS (
    SELECT 1 FROM users u 
    WHERE u.tg_id = auth.uid()::bigint 
    AND u.role = 'admin'
  )
);

-- 6. Создаём политику для DELETE (только админы)
CREATE POLICY "users_delete" ON users 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM users u 
    WHERE u.tg_id = auth.uid()::bigint 
    AND u.role = 'admin'
  )
);

-- 7. Проверяем, что RLS включен
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'users';

-- 8. Проверяем политики
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies 
WHERE tablename = 'users'
ORDER BY policyname;
