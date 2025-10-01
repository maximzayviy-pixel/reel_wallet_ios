// Тестовый скрипт для проверки кнопок Telegram
const TG_BOT_TOKEN = process.env.TG_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN;
const ADMIN_TG_ID = process.env.ADMIN_TG_ID || process.env.TELEGRAM_ADMIN_CHAT;

if (!TG_BOT_TOKEN || !ADMIN_TG_ID) {
  console.error('Missing TG_BOT_TOKEN or ADMIN_TG_ID environment variables');
  process.exit(1);
}

async function testTelegramButtons() {
  const base = `https://api.telegram.org/bot${TG_BOT_TOKEN}`;
  const testRequestId = 'test-' + Date.now();
  
  const testMessage = {
    chat_id: ADMIN_TG_ID,
    text: `🧪 <b>Тест кнопок</b>\n\nЗапрос #${testRequestId}\nСумма: 100 ₽ (200 ⭐)\nБаланс пользователя: 500 ⭐`,
    parse_mode: "HTML",
    reply_markup: {
      inline_keyboard: [
        [
          { text: "✅ Оплачено", callback_data: `pay:${testRequestId}` },
          { text: "❌ Отказать", callback_data: `rej:${testRequestId}` },
        ],
      ],
    },
  };

  try {
    console.log('Sending test message with buttons...');
    const response = await fetch(`${base}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testMessage),
    });
    
    const result = await response.json();
    console.log('Result:', result);
    
    if (result.ok) {
      console.log('✅ Test message sent successfully!');
      console.log('Check your Telegram chat for the message with buttons.');
    } else {
      console.error('❌ Failed to send test message:', result);
    }
  } catch (error) {
    console.error('❌ Error sending test message:', error);
  }
}

testTelegramButtons();
