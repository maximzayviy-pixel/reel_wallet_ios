import React from 'react';
export default function Forbidden({ reason }: { reason?: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <div className="max-w-md text-center bg-white shadow-lg rounded-2xl p-8">
        <h1 className="text-2xl font-bold mb-2">Доступ запрещён</h1>
        <p className="mb-4 text-gray-600">
          {reason || 'Эта страница доступна только администраторам и только из Telegram.'}
        </p>
        <ol className="text-left list-decimal list-inside text-gray-700">
          <li>Откройте Telegram и нашего бота.</li>
          <li>Нажмите «Открыть админку».</li>
        </ol>
      </div>
    </div>
  );
}
