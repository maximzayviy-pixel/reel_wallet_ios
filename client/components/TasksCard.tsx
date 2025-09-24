// client/components/TasksCard.tsx
import { useEffect, useState } from "react";
import Link from "next/link";

type Task = {
  id: string;
  channel_username: string;
  title: string;
  reward_stars: number;
};

export default function TasksCard({ tgId }: { tgId?: number }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [result, setResult] = useState<Record<string, string>>({});

  useEffect(() => {
    (async () => {
      const r = await fetch("/api/tasks");
      const j = await r.json();
      setTasks(j.tasks || []);
      setLoading(false);
    })();
  }, []);

  async function check(task: Task) {
    if (!tgId) { alert("Не удалось определить Telegram ID пользователя"); return; }
    setBusyId(task.id);
    try {
      const r = await fetch("/api/check-subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task_id: task.id, tg_id: tgId }),
      });
      const j = await r.json();
      if (j.ok && j.subscribed) {
        setResult((s) => ({ ...s, [task.id]: j.already_awarded ? "Уже получено ✅" : `+${j.stars}⭐` }));
      } else {
        setResult((s) => ({ ...s, [task.id]: j.message || "Подписка не найдена" }));
      }
    } catch (e) {
      setResult((s) => ({ ...s, [task.id]: "Ошибка. Попробуйте ещё раз." }));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="relative overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-100">
      {/* фон как на витрине */}
      <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.35]">
        <div className="absolute -top-8 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-violet-100 blur-3xl" />
        <div className="absolute -bottom-10 -right-10 h-72 w-72 rounded-full bg-amber-100 blur-3xl" />
      </div>

      <div className="relative p-6 sm:p-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-10 w-10 rounded-2xl bg-slate-900 flex items-center justify-center text-white text-sm">⭐</div>
          <h2 className="text-xl sm:text-2xl font-semibold text-slate-900">Задания за подписку</h2>
        </div>

        {loading ? (
          <p className="text-slate-500">Загрузка…</p>
        ) : tasks.length === 0 ? (
          <p className="text-slate-500">Пока заданий нет — загляните позже.</p>
        ) : (
          <ul className="space-y-3">
            {tasks.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-100 p-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">{t.title}</p>
                  <p className="text-xs text-slate-500 truncate">@{t.channel_username}</p>
                  {result[t.id] && <p className="text-xs mt-1 text-slate-600">{result[t.id]}</p>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Link
                    className="px-3 py-2 rounded-xl bg-slate-900 text-white text-xs"
                    href={`https://t.me/${t.channel_username}`} target="_blank"
                  >
                    Открыть канал
                  </Link>
                  <button
                    onClick={() => check(t)}
                    disabled={busyId === t.id}
                    className="px-3 py-2 rounded-xl bg-emerald-600 text-white text-xs disabled:opacity-60"
                  >
                    Проверить (+{t.reward_stars}⭐)
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        <p className="mt-6 text-[11px] text-slate-400 text-center">
          Награда выдаётся 1 раз за задачу. Отписка в будущем не влияет на уже полученные звёзды.
        </p>
      </div>
    </div>
  );
}
