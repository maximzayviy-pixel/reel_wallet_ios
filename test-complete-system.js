// Полный тест системы
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

async function testCompleteSystem() {
  console.log('🧪 Testing complete system...\n');
  
  const testTgId = 7086128174;
  
  try {
    // 1. Тестируем создание пользователя
    console.log('1. Testing user creation...');
    const { data: userData, error: userError } = await supabase.rpc('create_or_update_user', {
      p_tg_id: testTgId,
      p_username: 'test_user',
      p_first_name: 'Test',
      p_last_name: 'User'
    });
    
    if (userError) {
      console.error('❌ User creation failed:', userError);
      return;
    } else {
      console.log('✅ User created:', userData[0]);
    }
    
    // 2. Тестируем создание записи в ledger
    console.log('\n2. Testing ledger entry...');
    const { data: ledgerData, error: ledgerError } = await supabase
      .from('ledger')
      .insert([{
        user_id: userData[0].id,
        tg_id: testTgId,
        type: 'stars_spend_payment',
        amount: -10,
        amount_rub: -5,
        delta: -10,
        asset_amount: -10,
        status: 'done',
        metadata: { source: 'test' }
      }])
      .select();
    
    if (ledgerError) {
      console.error('❌ Ledger insert failed:', ledgerError);
      return;
    } else {
      console.log('✅ Ledger entry created:', ledgerData[0]);
    }
    
    // 3. Тестируем обновление баланса
    console.log('\n3. Testing balance update...');
    const { data: balanceResult, error: balanceError } = await supabase.rpc('update_user_balance_by_tg_id', {
      p_tg_id: testTgId
    });
    
    if (balanceError) {
      console.error('❌ Balance update failed:', balanceError);
    } else {
      console.log('✅ Balance updated:', balanceResult);
    }
    
    // 4. Проверяем баланс
    console.log('\n4. Checking balance...');
    const { data: balanceData, error: balanceCheckError } = await supabase
      .from('balances_by_tg')
      .select('*')
      .eq('tg_id', testTgId)
      .single();
    
    if (balanceCheckError) {
      console.error('❌ Balance check failed:', balanceCheckError);
    } else {
      console.log('✅ Balance check:', balanceData);
    }
    
    // 5. Тестируем API переводов
    console.log('\n5. Testing transfer API...');
    const transferResponse = await fetch('http://localhost:3000/api/transfer-stars', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from_tg_id: testTgId,
        to_tg_id: 123456789,
        amount_stars: 5
      })
    });
    
    const transferResult = await transferResponse.json();
    console.log('Transfer API result:', transferResult);
    
    if (transferResult.ok) {
      console.log('✅ Transfer API works');
    } else {
      console.log('❌ Transfer API failed:', transferResult.error);
    }
    
    console.log('\n🎉 System test completed!');
    
  } catch (e) {
    console.error('Error:', e);
  }
}

testCompleteSystem();
