// Скрипт для обновления всех балансов
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false },
});

async function refreshAllBalances() {
  console.log('Refreshing all balances...');
  
  try {
    // Сначала выполняем SQL функции
    console.log('Creating balance update functions...');
    
    const functionsSQL = `
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
    `;
    
    const { error: functionsError } = await supabase.rpc('exec_sql', { sql: functionsSQL });
    if (functionsError) {
      console.error('Error creating functions:', functionsError);
      return;
    }
    
    console.log('Functions created successfully');
    
    // Теперь обновляем все балансы
    console.log('Updating all balances...');
    const { error: refreshError } = await supabase.rpc('refresh_all_balances');
    
    if (refreshError) {
      console.error('Error refreshing balances:', refreshError);
      return;
    }
    
    console.log('All balances updated successfully!');
    
    // Проверим несколько балансов
    console.log('Checking some balances...');
    const { data: balances, error: balancesError } = await supabase
      .from('balances_by_tg')
      .select('*')
      .limit(5);
    
    if (balancesError) {
      console.error('Error checking balances:', balancesError);
    } else {
      console.log('Sample balances:', balances);
    }
    
  } catch (e) {
    console.error('Error:', e);
  }
}

refreshAllBalances();
