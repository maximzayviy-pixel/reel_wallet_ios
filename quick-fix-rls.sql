-- БЫСТРОЕ ИСПРАВЛЕНИЕ RLS ПОЛИТИК

-- 1. Отключаем RLS временно для исправления
ALTER TABLE users DISABLE ROW LEVEL SECURITY;

-- 2. Удаляем все старые политики
DROP POLICY IF EXISTS "users_self" ON users;
DROP POLICY IF EXISTS "users_select" ON users;
DROP POLICY IF EXISTS "users_insert" ON users;
DROP POLICY IF EXISTS "users_update" ON users;
DROP POLICY IF EXISTS "users_delete" ON users;

-- 3. Включаем RLS обратно
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- 4. Создаём простые политики без проверки ролей
CREATE POLICY "users_all_access" ON users 
FOR ALL 
USING (true)
WITH CHECK (true);

-- 5. Проверяем результат
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'users';

SELECT schemaname, tablename, policyname, permissive, roles, cmd
FROM pg_policies 
WHERE tablename = 'users';
