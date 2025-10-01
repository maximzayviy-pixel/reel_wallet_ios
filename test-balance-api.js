// Тест баланса через API
const fetch = require('node-fetch');

async function testBalanceAPI() {
  console.log('🚨 Testing balance via API...\n');
  
  const testTgId = 7086128174;
  const baseUrl = 'http://localhost:3000'; // Замените на ваш URL
  
  try {
    // 1. Проверяем текущий баланс
    console.log('1. Checking current balance...');
    const balanceResponse = await fetch(`${baseUrl}/api/my-balance?tg_id=${testTgId}`);
    const balanceData = await balanceResponse.json();
    
    if (balanceData.ok) {
      console.log('✅ Current balance:', balanceData);
    } else {
      console.error('❌ Balance check failed:', balanceData);
    }
    
    // 2. Тестируем создание пользователя
    console.log('\n2. Testing user creation...');
    const userResponse = await fetch(`${baseUrl}/api/auth-upsert`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tg_id: testTgId,
        username: 'test_user',
        first_name: 'Test',
        last_name: 'User'
      })
    });
    
    const userData = await userResponse.json();
    if (userData.ok) {
      console.log('✅ User creation:', userData);
    } else {
      console.error('❌ User creation failed:', userData);
    }
    
    // 3. Проверяем баланс после создания пользователя
    console.log('\n3. Checking balance after user creation...');
    const balanceResponse2 = await fetch(`${baseUrl}/api/my-balance?tg_id=${testTgId}`);
    const balanceData2 = await balanceResponse2.json();
    
    if (balanceData2.ok) {
      console.log('✅ Balance after user creation:', balanceData2);
    } else {
      console.error('❌ Balance check failed:', balanceData2);
    }
    
  } catch (e) {
    console.error('Error:', e.message);
    console.log('Make sure the server is running on localhost:3000');
  }
}

testBalanceAPI();
