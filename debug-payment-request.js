// Скрипт для отладки payment_request
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

async function debugPaymentRequest(requestId) {
  console.log('Looking up payment request:', requestId);
  
  try {
    const { data, error } = await supabase
      .from('payment_requests')
      .select('*')
      .eq('id', requestId)
      .maybeSingle();
    
    if (error) {
      console.error('Database error:', error);
      return;
    }
    
    if (!data) {
      console.log('Payment request not found');
      return;
    }
    
    console.log('Payment request found:', {
      id: data.id,
      tg_id: data.tg_id,
      amount_rub: data.amount_rub,
      status: data.status,
      created_at: data.created_at
    });
    
    // Проверим пользователя
    if (data.tg_id) {
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id, tg_id')
        .eq('tg_id', data.tg_id)
        .single();
      
      if (userError) {
        console.error('User lookup error:', userError);
      } else {
        console.log('User found:', userData);
      }
    }
    
  } catch (e) {
    console.error('Error:', e);
  }
}

// Используйте ID из логов
const requestId = process.argv[2] || '8b627cc3-5a35-43a3-b760-74c2c84427a7';
debugPaymentRequest(requestId);
