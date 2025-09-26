import React, { useState } from 'react';

type TaskForm = {
  title: string;
  channel_username: string;
  reward_stars: number;
  is_active: boolean;
};

function getTmaAuthHeader(): string | null {
  if (typeof window === 'undefined') return null;
  const initDataRaw = (window as any)?.Telegram?.WebApp?.initData || '';
  return initDataRaw ? `tma ${initDataRaw}` : null;
}

export default function TasksAdminPage() {
  const [form, setForm] = useState<TaskForm>({
    title: '',
    channel_username: '',
    reward_stars: 30,
    is_active: true,
  });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);

    // FIX: build headers as a concrete Record<string, string>, not a union
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const auth = getTmaAuthHeader();
    if (auth) headers['Authorization'] = auth;

    try {
      const res = await fetch('/api/admin/tasks', {
        method: 'POST',
        headers,
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || `HTTP ${res.status}`);
      }
      setMsg('Задание добавлено');
      setForm({ title: '', channel_username: '', reward_stars: 30, is_active: true });
    } catch (err: any) {
      setMsg(`Ошибка: ${err?.message || err}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main style={{ maxWidth: 640, margin: '40px auto', fontFamily: 'system-ui', padding: 16 }}>
      <h1 style={{ marginBottom: 16 }}>Админ: Задания за подписку</h1>
      <form onSubmit={onSubmit} style={{ display: 'grid', gap: 12 }}>
        <label>
          <div>Название</div>
          <input
            required
            value={form.title}
            onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            style={{ width: '100%', padding: 8 }}
          />
        </label>
        <label>
          <div>Юзернейм канала (без @)</div>
          <input
            required
            value={form.channel_username}
            onChange={e => setForm(f => ({ ...f, channel_username: e.target.value }))}
            style={{ width: '100%', padding: 8 }}
          />
        </label>
        <label>
          <div>Награда (stars)</div>
          <input
            type="number"
            min={1}
            value={form.reward_stars}
            onChange={e => setForm(f => ({ ...f, reward_stars: Number(e.target.value || 0) }))}
            style={{ width: '100%', padding: 8 }}
          />
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            type="checkbox"
            checked={form.is_active}
            onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))}
          />
          Активно
        </label>
        <button
          type="submit"
          disabled={busy}
          style={{ padding: '10px 14px', borderRadius: 8, border: '1px solid #ccc' }}
        >
          {busy ? 'Сохраняю…' : 'Создать задание'}
        </button>
      </form>
      {msg && <p style={{ marginTop: 12 }}>{msg}</p>}

      <p style={{ marginTop: 24, fontSize: 12, opacity: 0.7 }}>
        Совет: открывайте эту страницу из Telegram Mini App, чтобы заголовок Authorization заполнился автоматически.
      </p>
    </main>
  );
}
