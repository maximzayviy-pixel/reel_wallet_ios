// Простой тест для проверки синтаксиса
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'client/pages/api/telegram-webhook.ts');

try {
  const content = fs.readFileSync(filePath, 'utf8');
  
  // Проверяем, что нет лишних скобок
  const openBraces = (content.match(/\{/g) || []).length;
  const closeBraces = (content.match(/\}/g) || []).length;
  
  console.log('Open braces:', openBraces);
  console.log('Close braces:', closeBraces);
  console.log('Balance:', openBraces - closeBraces);
  
  if (openBraces === closeBraces) {
    console.log('✅ Braces are balanced');
  } else {
    console.log('❌ Braces are not balanced');
  }
  
  // Проверяем, что нет лишних else if
  const elseIfCount = (content.match(/\} else if/g) || []).length;
  console.log('Else if statements:', elseIfCount);
  
  if (elseIfCount === 0) {
    console.log('✅ No syntax errors found');
  } else {
    console.log('❌ Found } else if pattern - this is incorrect');
  }
  
} catch (error) {
  console.error('Error:', error.message);
}
