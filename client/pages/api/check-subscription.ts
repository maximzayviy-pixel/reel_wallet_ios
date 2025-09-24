// client/pages/api/check-subscription.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

function createServerSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceRole = process.env.SUPABASE_SERVICE_KEY!;
  return createClient(url, serviceRole, { auth: { persistSession: false } });
}

async function isSubscribed(tgId: number, channelUsername?: string | null, chatId?: number | null) {
  const token = process.env.TELEGRAM_BOT_TOKEN!;
  const chatRef = chatId ? chatId : (channelUsername ? `@${channelUsername}` : null);
  if (!chatRef) return false;
  const resp = await fetch(
    `https://api.telegram.org/bot${token}/getChatMember?chat_id=${encodeURIComponent(String(chatRef))}&user_id=${tgId}`
  );
  if (!resp.ok) return false;
  const json = await resp.json();
  const status = json?.result?.status;
  return ["member", "administrator", "creator"].includes(status);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();
  const { task_id, tg_id } = req.body || {};
  if (!task_id || !tg_id) return res.status(400).json({ error: "task_id и tg_id обязательны" });

  const supabase = createServerSupabase();

  // 1) пользователь
  const { data: users, error: uErr } = await supabase
    .from("users")
    .select("id, tg_id")
    .eq("tg_id", String(tg_id))
    .limit(1);
  if (uErr) return res.status(500).json({ error: uErr.message });
  const user = users?.[0];
  if (!user) return res.status(404).json({ error: "Пользователь не найден" });

  // 2) задача
  const { data: tasks, error: tErr } = await supabase
    .from("subscription_tasks")
    .select("id, channel_username, chat_id, reward_stars")
    .eq("id", task_id)
    .limit(1);
  if (tErr || !tasks?.[0]) return res.status(404).json({ error: "Задача не найдена" });
  const task = tasks[0];

  // 3) проверка подписки
  const subscribed = await isSubscribed(Number(tg_id), task.channel_username, (task as any).chat_id ?? null);
  if (!subscribed) {
    await supabase.from("subscription_completions").upsert(
      {
        user_id: user.id,
        task_id,
        subscribed: false,
        awarded_stars: 0,
        checked_at: new Date().toISOString(),
      },
      { onConflict: "user_id,task_id" }
    );
    return res.json({ ok: false, subscribed: false, message: "Подписка не обнаружена" });
  }

  // 4) уже выдавали?
  const { data: prev } = await supabase
    .from("subscription_completions")
    .select("id, awarded_stars")
    .eq("user_id", user.id)
    .eq("task_id", task_id)
    .limit(1);
  if (prev?.[0]?.awarded_stars > 0) {
    return res.json({ ok: true, subscribed: true, already_awarded: true, stars: prev[0].awarded_stars });
  }

  // 5) НАЧИСЛЕНИЕ через public.ledger
  // колонки под твой скрин: type_text, asset_amount, rate_usd, status, metadata, tg_id
  const insertPayload = {
    type_text: "stars_topup",
    asset_amount: task.reward_stars,    // сколько звёзд начисляем
    rate_usd: 0,                        // если не используется — ставим 0
    status: "ok",
    metadata: {
      source: "subscription_task",
      task_id,
    } as any,
    tg_id: Number(tg_id),
  };

  const { error: lErr } = await supabase.from("ledger").insert(insertPayload as any);
  if (lErr) {
    return res.status(500).json({ error: "Не удалось записать транзакцию в ledger", details: lErr.message });
  }

  // 6) фиксируем completion
  await supabase.from("subscription_completions").upsert(
    {
      user_id: user.id,
      task_id,
      subscribed: true,
      awarded_stars: task.reward_stars,
      checked_at: new Date().toISOString(),
    },
    { onConflict: "user_id,task_id" }
  );

  return res.json({ ok: true, subscribed: true, stars: task.reward_stars });
}
