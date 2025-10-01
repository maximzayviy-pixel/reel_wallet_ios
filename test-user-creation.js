// Скрипт для тестирования создания пользователей
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

async function testUserCreation() {
  console.log('🧪 Testing user creation...\n');
  
  const testTgId = 7086128174;
  const testData = {
    tg_id: testTgId,
    username: 'test_user',
    first_name: 'Test',
    last_name: 'User'
  };
  
  try {
    // 1. Тестируем RPC функцию
    console.log('1. Testing RPC function create_or_update_user...');
    const { data: rpcData, error: rpcError } = await supabase.rpc('create_or_update_user', {
      p_tg_id: testTgId,
      p_username: testData.username,
      p_first_name: testData.first_name,
      p_last_name: testData.last_name
    });
    
    if (rpcError) {
      console.error('❌ RPC function error:', rpcError);
    } else {
      console.log('✅ RPC function works:', rpcData);
    }
    
    // 2. Тестируем прямой upsert
    console.log('\n2. Testing direct upsert...');
    const { data: upsertData, error: upsertError } = await supabase
      .from('users')
      .upsert({
        tg_id: testTgId,
        username: testData.username,
        first_name: testData.first_name,
        last_name: testData.last_name
      }, { onConflict: 'tg_id' })
      .select();
    
    if (upsertError) {
      console.error('❌ Direct upsert error:', upsertError);
    } else {
      console.log('✅ Direct upsert works:', upsertData);
    }
    
    // 3. Проверяем, что пользователь создался
    console.log('\n3. Checking if user exists...');
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('tg_id', testTgId)
      .single();
    
    if (userError) {
      console.error('❌ User lookup error:', userError);
    } else {
      console.log('✅ User found:', userData);
    }
    
    // 4. Тестируем API endpoint
    console.log('\n4. Testing API endpoint...');
    const response = await fetch('http://localhost:3000/api/auth-upsert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testData)
    });
    
    const apiResult = await response.json();
    console.log('API response:', apiResult);
    
    if (apiResult.ok) {
      console.log('✅ API endpoint works');
    } else {
      console.log('❌ API endpoint error:', apiResult.error);
    }
    
  } catch (e) {
    console.error('Error:', e);
  }
}

testUserCreation();
