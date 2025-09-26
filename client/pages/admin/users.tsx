"use client";
import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

// Supabase client using anonymous key for admin UI
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

/**
 * AdminUsers renders a management interface for administrators. It lists all users
 * with their verification and ban status, wallet limits and restrictions, and
 * provides buttons to perform actions such as verifying, banning/unbanning,
 * setting limits, crediting balances and viewing transaction history.
 */
export default function AdminUsers() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const { data, error } = await supabase.from('users').select('*');
    if (!error) setUsers(data || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // no dependencies: run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reload helper after performing an action
  const reload = () => load();

  // Verify user
  const verifyUser = async (u: any) => {
    await fetch('/api/admin-verify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(process.env.NEXT_PUBLIC_ADMIN_SECRET
          ? { Authorization: `Bearer ${process.env.NEXT_PUBLIC_ADMIN_SECRET}` }
          : {}),
      },
      body: JSON.stringify({ user_id: u.id }),
    });
    reload();
  };

  // Ban user with reason
  const banUser = async (u: any) => {
    const reason = prompt('Причина бана:', u.ban_reason || '');
    if (!reason) return;
    await fetch('/api/admin-ban', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(process.env.NEXT_PUBLIC_ADMIN_SECRET
          ? { Authorization: `Bearer ${process.env.NEXT_PUBLIC_ADMIN_SECRET}` }
          : {}),
      },
      body: JSON.stringify({ user_id: u.id, reason }),
    });
    reload();
  };

  // Unban user
  const unbanUser = async (u: any) => {
    if (!confirm('Снять бан пользователя?')) return;
    await fetch('/api/admin-unban', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(process.env.NEXT_PUBLIC_ADMIN_SECRET
          ? { Authorization: `Bearer ${process.env.NEXT_PUBLIC_ADMIN_SECRET}` }
          : {}),
      },
      body: JSON.stringify({ user_id: u.id }),
    });
    reload();
  };

  // Set wallet limit (in RUB). Use 0 or empty to remove limit
  const setLimit = async (u: any) => {
    const value = prompt('Лимит для операций в ₽ (0 или пусто для снятия):',
      u.wallet_limit != null ? String(u.wallet_limit) : '');
    if (value === null) return;
    const limit = value === '' ? null : Number(value);
    if (limit !== null && (isNaN(limit) || limit < 0)) {
      alert('Некорректный лимит');
      return;
    }
    await fetch('/api/admin-set-limit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(process.env.NEXT_PUBLIC_ADMIN_SECRET
          ? { Authorization: `Bearer ${process.env.NEXT_PUBLIC_ADMIN_SECRET}` }
          : {}),
      },
      body: JSON.stringify({ user_id: u.id, wallet_limit: limit }),
    });
    reload();
  };

  // Toggle wallet restriction
  const toggleRestriction = async (u: any) => {
    await fetch('/api/admin-set-limit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(process.env.NEXT_PUBLIC_ADMIN_SECRET
          ? { Authorization: `Bearer ${process.env.NEXT_PUBLIC_ADMIN_SECRET}` }
          : {}),
      },
      body: JSON.stringify({ user_id: u.id, wallet_restricted: !u.wallet_restricted }),
    });
    reload();
  };

  // Credit stars (rubles) using existing bonus mechanism
  const grantStars = async (u: any) => {
    const amountRubRaw = prompt('Сумма в ₽ для начисления звезд (2⭐ = 1₽):', '100');
    if (!amountRubRaw) return;
    const amountRub = Number(amountRubRaw);
    if (!isFinite(amountRub) || amountRub <= 0) {
      alert('Некорректная сумма');
      return;
    }
    await fetch('/api/admin-bonus', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(process.env.NEXT_PUBLIC_ADMIN_SECRET
          ? { Authorization: `Bearer ${process.env.NEXT_PUBLIC_ADMIN_SECRET}` }
          : {}),
      },
      body: JSON.stringify({ user_id: u.id, amount_rub: amountRub }),
    });
    alert('Начислено');
    reload();
  };

  // Credit TON
  const grantTon = async (u: any) => {
    const amountRaw = prompt('Количество TON для начисления:', '1');
    if (!amountRaw) return;
    const amountTon = Number(amountRaw);
    if (!isFinite(amountTon) || amountTon <= 0) {
      alert('Некорректная сумма TON');
      return;
    }
    await fetch('/api/admin-add-ton', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(process.env.NEXT_PUBLIC_ADMIN_SECRET
          ? { Authorization: `Bearer ${process.env.NEXT_PUBLIC_ADMIN_SECRET}` }
          : {}),
      },
      body: JSON.stringify({ user_id: u.id, amount_ton: amountTon }),
    });
    alert('TON начислены');
    reload();
  };

  // View transaction history for a user
  const viewHistory = async (u: any) => {
    const res = await fetch('/api/admin-transactions?user_id=' + u.id, {
      headers: {
        ...(process.env.NEXT_PUBLIC_ADMIN_SECRET
          ? { Authorization: `Bearer ${process.env.NEXT_PUBLIC_ADMIN_SECRET}` }
          : {}),
      },
    });
    const json = await res.json().catch(() => ({}));
    if (!json?.success) {
      alert('Не удалось получить историю');
      return;
    }
    const lines = (json.transactions || []).map((t: any) => {
      const date = new Date(t.created_at).toLocaleString('ru-RU');
      return `${date}: ${t.type} - ${t.amount_rub}₽ (${t.asset_amount ?? ''})`;
    });
    alert('История транзакций:\n' + (lines.join('\n') || 'нет записей'));
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Админка: Пользователи</h1>
      {loading && <div className="text-sm text-slate-500">Загрузка...</div>}
      {users.map((u) => (
        <div key={u.id} className="border p-4 rounded-xl mb-4 bg-white shadow-sm space-y-2">
          <div className="flex flex-wrap gap-2 text-sm">
            <div><b>ID:</b> {u.id}</div>
            <div><b>Username:</b> {u.username || '—'}</div>
            <div><b>Верификация:</b> {u.is_verified ? '✅' : '❌'}</div>
            <div><b>Бан:</b> {u.is_banned ? '🚫' : '—'}</div>
            {u.wallet_limit != null && (
              <div><b>Лимит:</b> {u.wallet_limit || 0}₽</div>
            )}
            <div><b>Ограничен:</b> {u.wallet_restricted ? 'Да' : 'Нет'}</div>
          </div>
          {u.is_banned && u.ban_reason && (
            <div className="text-xs text-rose-600">Причина: {u.ban_reason}</div>
          )}
          {u.ban_appeal && (
            <div className="text-xs text-yellow-700">
              Апелляция: {u.ban_appeal} (статус: {u.ban_status || '—'})
            </div>
          )}
          <div className="flex flex-wrap gap-2 mt-2">
            {/* Verify/unverify - we only allow verification */}
            {!u.is_verified && (
              <button
                className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded text-sm"
                onClick={() => verifyUser(u)}
              >
                Выдать галочку
              </button>
            )}
            {/* Ban/unban toggle */}
            {!u.is_banned ? (
              <button
                className="bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded text-sm"
                onClick={() => banUser(u)}
              >
                Забанить
              </button>
            ) : (
              <button
                className="bg-orange-600 hover:bg-orange-700 text-white px-3 py-2 rounded text-sm"
                onClick={() => unbanUser(u)}
              >
                Разбанить
              </button>
            )}
            <button
              className="bg-yellow-500 hover:bg-yellow-600 text-white px-3 py-2 rounded text-sm"
              onClick={() => setLimit(u)}
            >
              Установить лимит
            </button>
            <button
              className="bg-purple-500 hover:bg-purple-600 text-white px-3 py-2 rounded text-sm"
              onClick={() => toggleRestriction(u)}
            >
              {u.wallet_restricted ? 'Разрешить' : 'Огр. кошелек'}
            </button>
            <button
              className="bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded text-sm"
              onClick={() => grantStars(u)}
            >
              Начислить ₽ (⭐)
            </button>
            <button
              className="bg-teal-600 hover:bg-teal-700 text-white px-3 py-2 rounded text-sm"
              onClick={() => grantTon(u)}
            >
              Начислить TON
            </button>
            <button
              className="bg-gray-600 hover:bg-gray-700 text-white px-3 py-2 rounded text-sm"
              onClick={() => viewHistory(u)}
            >
              История
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}