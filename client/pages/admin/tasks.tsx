// client/pages/admin/tasks.tsx
import { useEffect, useState } from "react";

export default function AdminTasks() {
  const [tasks, setTasks] = useState<any[]>([]);
  const [form, setForm] = useState({ title: "", channel_username: "", reward_stars: 30, is_active: true });
  const [busy, setBusy] = useState(false);

  async function load() {
    const r = await fetch("/api/admin/tasks");
    const j = await r.json();
    setTasks(j.tasks || []);
  }

  useEffect(() => { load(); }, []);

  // Build admin authorisation header
  const adminAuthHeader =
    typeof process !== 'undefined' && process.env && process.env.NEXT_PUBLIC_ADMIN_SECRET
      ? { Authorization: `Bearer ${process.env.NEXT_PUBLIC_ADMIN_SECRET}` }
      : {};

  async function createTask() {
    setBusy(true);
    try {
      await fetch("/api/admin/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...adminAuthHeader },
        body: JSON.stringify(form),
      });
      setForm({ title: "", channel_username: "", reward_stars: 30, is_active: true });
      await load();
    } finally { setBusy(false); }
  }

  async function updateTask(id: string, patch: any) {
    setBusy(true);
    try {
      await fetch("/api/admin/tasks", {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...adminAuthHeader },
        body: JSON.stringify({ id, ...patch }),
      });
      await load();
    } finally { setBusy(false); }
  }

  async function removeTask(id: string) {
    if (!confirm("Удалить задачу?")) return;
    setBusy(true);
    try {
      await fetch("/api/admin/tasks", {
        method: "DELETE",
        headers: { "Content-Type": "application/json", ...adminAuthHeader },
        body: JSON.stringify({ id }),
      });
      await load();
    } finally { setBusy(false); }
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-xl font-bold mb-4">Админка: задания на подписку</h1>

      <div className="border rounded-2xl p-4 mb-6 space-y-3">
        <input className="w-full border rounded-xl px-3 py-2" placeholder="Заголовок"
          value={form.title} onChange={e=>setForm({...form, title:e.target.value})}/>
        <input className="w-full border rounded-xl px-3 py-2" placeholder="Имя канала (без @)"
          value={form.channel_username} onChange={e=>setForm({...form, channel_username:e.target.value.replace(/^@/,'')})}/>
        <div className="flex items-center gap-3">
          <input type="number" className="border rounded-xl px-3 py-2 w-32" placeholder="Звёзды"
            value={form.reward_stars} onChange={e=>setForm({...form, reward_stars: Number(e.target.value)})}/>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.is_active}
              onChange={e=>setForm({...form, is_active:e.target.checked})}/>
            Активно
          </label>
          <button disabled={busy} onClick={createTask} className="ml-auto px-4 py-2 rounded-xl bg-slate-900 text-white">
            Добавить
          </button>
        </div>
      </div>

      {tasks.map(t => (
        <div key={t.id} className="border rounded-2xl p-4 mb-3">
          <div className="flex items-center gap-3">
            <div className="font-medium">{t.title}</div>
            <div className="text-slate-500">@{t.channel_username}</div>
            <div className="ml-auto text-sm">+{t.reward_stars}⭐</div>
          </div>
          <div className="flex items-center gap-3 mt-3">
            <button className="px-3 py-2 rounded-xl bg-emerald-600 text-white"
              onClick={()=>updateTask(t.id, { is_active: !t.is_active })}>
              {t.is_active ? "Выключить" : "Включить"}
            </button>
            <button className="px-3 py-2 rounded-xl bg-slate-800 text-white"
              onClick={async()=>{
                const r = prompt("Новая награда (⭐):", String(t.reward_stars));
                if(!r) return;
                await updateTask(t.id, { reward_stars: Number(r) });
              }}>
              Изменить звёзды
            </button>
            <button className="px-3 py-2 rounded-xl bg-red-600 text-white" onClick={()=>removeTask(t.id)}>
              Удалить
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
