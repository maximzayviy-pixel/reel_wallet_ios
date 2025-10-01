// Тестовый скрипт для проверки webhook'а
const testWebhook = async () => {
  const webhookUrl = 'https://your-app.vercel.app/api/telegram-webhook'; // Замените на ваш URL
  const testRequestId = 'test-' + Date.now();
  
  const testUpdate = {
    callback_query: {
      id: 'test-callback-' + Date.now(),
      from: { id: 7086128174 }, // ID админа из логов
      message: {
        chat: { id: 7086128174 },
        message_id: 999
      },
      data: `pay:${testRequestId}`
    }
  };

  try {
    console.log('Sending test webhook request...');
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testUpdate),
    });
    
    const result = await response.text();
    console.log('Response status:', response.status);
    console.log('Response body:', result);
    
  } catch (error) {
    console.error('Error testing webhook:', error);
  }
};

// Запуск теста
testWebhook();
