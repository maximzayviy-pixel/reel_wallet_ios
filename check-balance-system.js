// Скрипт для проверки системы баланса
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

async function checkBalanceSystem() {
  console.log('🔍 Checking balance system...\n');
  
  try {
    // 1. Проверяем записи с null user_id в ledger
    console.log('1. Checking ledger records with null user_id...');
    const { data: nullUserRecords, error: nullUserError } = await supabase
      .from('ledger')
      .select('id, tg_id, type, amount, created_at')
      .is('user_id', null)
      .limit(10);
    
    if (nullUserError) {
      console.error('Error checking null user_id records:', nullUserError);
    } else {
      console.log(`Found ${nullUserRecords?.length || 0} records with null user_id`);
      if (nullUserRecords?.length > 0) {
        console.log('Sample records:', nullUserRecords);
      }
    }
    
    // 2. Проверяем пользователей
    console.log('\n2. Checking users...');
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, tg_id, created_at')
      .order('created_at', { ascending: false })
      .limit(5);
    
    if (usersError) {
      console.error('Error checking users:', usersError);
    } else {
      console.log(`Found ${users?.length || 0} users`);
      if (users?.length > 0) {
        console.log('Sample users:', users);
      }
    }
    
    // 3. Проверяем балансы
    console.log('\n3. Checking balances...');
    const { data: balances, error: balancesError } = await supabase
      .from('balances')
      .select('user_id, stars, ton, available_rub')
      .order('stars', { ascending: false })
      .limit(5);
    
    if (balancesError) {
      console.error('Error checking balances:', balancesError);
    } else {
      console.log(`Found ${balances?.length || 0} balance records`);
      if (balances?.length > 0) {
        console.log('Sample balances:', balances);
      }
    }
    
    // 4. Проверяем view balances_by_tg
    console.log('\n4. Checking balances_by_tg view...');
    const { data: balancesByTg, error: balancesByTgError } = await supabase
      .from('balances_by_tg')
      .select('tg_id, stars, ton, total_rub')
      .order('stars', { ascending: false })
      .limit(5);
    
    if (balancesByTgError) {
      console.error('Error checking balances_by_tg:', balancesByTgError);
    } else {
      console.log(`Found ${balancesByTg?.length || 0} records in balances_by_tg`);
      if (balancesByTg?.length > 0) {
        console.log('Sample balances_by_tg:', balancesByTg);
      }
    }
    
    // 5. Проверяем функции
    console.log('\n5. Testing balance update functions...');
    try {
      // Тестируем функцию обновления баланса
      const testTgId = users?.[0]?.tg_id;
      if (testTgId) {
        console.log(`Testing balance update for tg_id: ${testTgId}`);
        const { error: updateError } = await supabase.rpc('update_user_balance_by_tg_id', { 
          p_tg_id: testTgId 
        });
        
        if (updateError) {
          console.error('Error updating balance:', updateError);
        } else {
          console.log('✅ Balance update function works');
        }
      }
    } catch (e) {
      console.error('Error testing functions:', e);
    }
    
    // 6. Рекомендации
    console.log('\n📋 Recommendations:');
    if (nullUserRecords?.length > 0) {
      console.log('❌ Found records with null user_id - run fix-null-user-ids.sql');
    } else {
      console.log('✅ No records with null user_id found');
    }
    
    if (balances?.length === 0) {
      console.log('❌ No balance records found - run refresh_all_balances()');
    } else {
      console.log('✅ Balance records exist');
    }
    
    if (balancesByTg?.length === 0) {
      console.log('❌ No records in balances_by_tg view - check view definition');
    } else {
      console.log('✅ balances_by_tg view works');
    }
    
  } catch (e) {
    console.error('Error:', e);
  }
}

checkBalanceSystem();
