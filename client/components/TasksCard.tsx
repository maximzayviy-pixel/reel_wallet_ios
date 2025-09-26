// client/components/TasksCard.tsx
import { useEffect, useState } from "react";
import Link from "next/link";

type Task = {
  id: string;
  channel_username: string;
  chat_id?: number | null;
  title: string;
  reward_stars: number;
  channel_title?: string | null;
  avatar_url?: string | null;
  claimed?: boolean;
};

export default function TasksCard({
  tgId,
  hideClaimed = false,
}: {
  tgId?: number;
  hideClaimed?: boolean;
}) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [msg, setMsg] = useState<Record<string, string>>({});

  useEffect(() => {
    (async () => {
      const q = tgId ? `?tg_id=${tgId}` : "";
      const r = await fetch(`/api/tasks${q}`);
      const j = await r.json();
      setTasks(j.tasks || []);
      setLoading(false);
    })();
  }, [tgId]);

  async function check(task: Task) {
    if (!tgId) {
      alert("Откройте мини-приложение из Telegram, чтобы определить аккаунт.");
      return;
    }
    setBusyId(task.id);
    try {
      const r = await fetch("/api/check-subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task_id: task.id, tg_id: tgId }),
      });
      const j = await r.json();
      if (j.ok && j.subscribed) {
        setMsg((m) => ({ ...m, [task.id]: j.already_awarded ? "Уже получено ✓" : `+${j.stars}⭐ начислено` }));
        setTasks((list) =>
          list.map((x) => (x.id === task.id ? { ...x, claimed: true } : x)).filter((x) => (hideClaimed ? !x.claimed : true))
        );
      } else {
        setMsg((m) => ({ ...m, [task.id]: j.message || "Подписка не обнаружена" }));
      }
    } catch {
      setMsg((m) => ({ ...m, [task.id]: "Ошибка. Попробуйте ещё раз." }));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="relative overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-100">
      {/* фон мягкий */}
      <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.35]">
        <div className="absolute -top-10 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-violet-100 blur-3xl" />
        <div className="absolute -bottom-10 -right-10 h-72 w-72 rounded-full bg-amber-100 blur-3xl" />
      </div>

      <div className="relative p-6 sm:p-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-10 w-10 rounded-2xl bg-slate-900 flex items-center justify-center text-white text-sm">⭐</div>
          <h2 className="text-2xl font-semibold text-slate-900">Задания за подписку</h2>
        </div>

        {loading ? (
          <p className="text-slate-500">Загрузка…</p>
        ) : (
          <>
            {tasks.filter((t) => (hideClaimed ? !t.claimed : true)).length === 0 ? (
              <p className="text-slate-500">Пока заданий нет — загляните позже.</p>
            ) : (
              <>
                <div className="text-[11px] uppercase tracking-wide text-slate-500 mb-2">Одноразовые</div>
                <ul className="space-y-3">
                  {tasks
                    .filter((t) => (hideClaimed ? !t.claimed : true))
                    .map((t) => {
                      const claimed = t.claimed === true;
                      return (
                        <li key={t.id} className="rounded-2xl ring-1 ring-slate-100 bg-white/70 p-3">
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            {/* left: аватар + текст */}
                            <div className="flex items-center gap-3 min-w-0">
                              {t.avatar_url ? (
                                <img
                                  src={t.avatar_url}
                                  alt=""
                                  className="h-10 w-10 rounded-xl object-cover ring-1 ring-slate-200"
                                />
                              ) : (
                                <div className="h-10 w-10 rounded-xl bg-slate-200 ring-1 ring-slate-200 flex items-center justify-center text-slate-600">
                                  tg
                                </div>
                              )}
                              <div className="min-w-0">
                                <div className="text-sm font-medium text-slate-900 truncate">
                                  Подписаться на {t.channel_title || `@${t.channel_username}`}
                                </div>
                                <div className="text-xs text-slate-500 truncate">@{t.channel_username}</div>
                                {msg[t.id] && (
                                  <div className="text-xs mt-1 text-slate-600">{msg[t.id]}</div>
                                )}
                              </div>
                            </div>

                            {/* right: кнопки/статус */}
                            <div className="flex gap-2 sm:shrink-0">
                              <Link
                                href={`https://t.me/${t.channel_username}`}
                                target="_blank"
                                className="px-3 py-2 rounded-xl bg-slate-900 text-white text-xs text-center"
                              >
                                Открыть канал
                              </Link>

                              {claimed ? (
                                <span className="px-3 py-2 rounded-xl bg-emerald-50 text-emerald-700 text-xs ring-1 ring-emerald-200">
                                  Получено ✓
                                </span>
                              ) : (
                                <button
                                  onClick={() => check(t)}
                                  disabled={busyId === t.id}
                                  className="px-3 py-2 rounded-xl bg-emerald-600 text-white text-xs disabled:opacity-60"
                                >
                                  {busyId === t.id ? "Проверяем…" : `Проверить (+${t.reward_stars}⭐)`}
                                </button>
                              )}
                            </div>
                          </div>
                        </li>
                      );
                    })}
                </ul>
              </>
            )}
          </>
        )}

        <p className="mt-6 text-[11px] text-slate-400 text-center">
          Награда выдаётся 1 раз за задачу. Отписка в будущем не влияет на уже полученные звёзды.
        </p>
      </div>
    </div>
  );
}
