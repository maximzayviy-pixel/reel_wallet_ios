
// client/components/AdminNav.tsx
import Link from 'next/link';
import React from 'react';

const Item = ({ href, children }: { href:string, children: React.ReactNode }) => (
  <Link href={href} className="px-3 py-2 rounded-xl bg-white shadow hover:shadow-md transition text-sm">
    {children}
  </Link>
);

export default function AdminNav() {
  return (
    <div className="flex gap-2 flex-wrap mb-4">
      <Item href="/admin">Заявки</Item>
      <Item href="/admin/users">Пользователи</Item>
      <Item href="/admin/balances">Балансы</Item>
      <Item href="/admin/gifts">Gifts/Orders</Item>
      <Item href="/admin/promocodes">Промокоды</Item>
      <Item href="/admin/webhooks">Webhook Logs</Item>
    </div>
  );
}
