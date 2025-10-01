// Срочный тест баланса
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

async function testBalanceNow() {
  console.log('🚨 URGENT: Testing balance update...\n');
  
  const testTgId = 7086128174;
  
  try {
    // 1. Проверяем текущий баланс
    console.log('1. Current balance:');
    const { data: currentBalance, error: balanceError } = await supabase
      .from('balances_by_tg')
      .select('*')
      .eq('tg_id', testTgId)
      .single();
    
    if (balanceError) {
      console.error('❌ Balance check failed:', balanceError);
    } else {
      console.log('✅ Current balance:', currentBalance);
    }
    
    // 2. Проверяем записи в ledger
    console.log('\n2. Recent ledger records:');
    const { data: ledgerRecords, error: ledgerError } = await supabase
      .from('ledger')
      .select('amount, type, status, created_at')
      .eq('tg_id', testTgId)
      .order('created_at', { ascending: false })
      .limit(3);
    
    if (ledgerError) {
      console.error('❌ Ledger check failed:', ledgerError);
    } else {
      console.log('✅ Ledger records:', ledgerRecords);
    }
    
    // 3. Проверяем, существует ли функция
    console.log('\n3. Checking if function exists:');
    const { data: functions, error: funcError } = await supabase
      .rpc('exec_sql', { 
        sql: `SELECT routine_name FROM information_schema.routines WHERE routine_name = 'update_user_balance_by_tg_id'` 
      });
    
    if (funcError) {
      console.log('❌ Function check failed:', funcError);
    } else {
      console.log('✅ Function exists:', functions);
    }
    
    // 4. Тестируем функцию напрямую
    console.log('\n4. Testing function directly:');
    try {
      const { data: updateResult, error: updateError } = await supabase.rpc('update_user_balance_by_tg_id', {
        p_tg_id: testTgId
      });
      
      if (updateError) {
        console.error('❌ Function call failed:', updateError);
      } else {
        console.log('✅ Function call succeeded:', updateResult);
      }
    } catch (e) {
      console.error('❌ Function call exception:', e);
    }
    
    // 5. Проверяем баланс после обновления
    console.log('\n5. Balance after update:');
    const { data: newBalance, error: newBalanceError } = await supabase
      .from('balances_by_tg')
      .select('*')
      .eq('tg_id', testTgId)
      .single();
    
    if (newBalanceError) {
      console.error('❌ New balance check failed:', newBalanceError);
    } else {
      console.log('✅ New balance:', newBalance);
    }
    
    // 6. Сравниваем
    if (currentBalance && newBalance) {
      console.log('\n6. Comparison:');
      console.log('Before:', currentBalance.stars);
      console.log('After:', newBalance.stars);
      console.log('Changed:', newBalance.stars !== currentBalance.stars ? 'YES ✅' : 'NO ❌');
    }
    
  } catch (e) {
    console.error('Error:', e);
  }
}

testBalanceNow();
