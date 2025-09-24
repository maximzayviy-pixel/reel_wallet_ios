// client/pages/api/check-subscription.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

function createServerSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceRole = process.env.SUPABASE_SERVICE_KEY!;
  return createClient(url, serviceRole, { auth: { persistSession: false } });
}

async function isSubscribed(tgId: number, channelUsername: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN!;
  const url = `https://api.telegram.org/bot${token}/getChatMember?chat_id=@${channelUsername}&user_id=${tgId}`;
  const resp = await fetch(url);
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
  const { data: users } = await supabase.from("users").select("id").eq("tg_id", tg_id).limit(1);
  const user = users?.[0];
  if (!user) return res.status(404).json({ error: "Пользователь не найден" });

  // 2) задача
  const { data: tasks, error: tErr } = await supabase
    .from("subscription_tasks")
    .select("*")
    .eq("id", task_id)
    .limit(1);
  if (tErr || !tasks?.[0]) return res.status(404).json({ error: "Задача не найдена" });
  const task = tasks[0];

  // 3) проверка подписки
  const subscribed = await isSubscribed(Number(tg_id), task.channel_username);
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

  // 4) не выдавали ли уже?
  const { data: prev } = await supabase
    .from("subscription_completions")
    .select("id, awarded_stars")
    .eq("user_id", user.id)
    .eq("task_id", task_id)
    .limit(1);
  if (prev?.[0]?.awarded_stars > 0) {
    return res.json({ ok: true, subscribed: true, already_awarded: true, stars: prev[0].awarded_stars });
  }

  // 5) начисляем звёзды
  // 5.1 пробуем через RPC (если функция есть)
  const { error: rpcErr } = await supabase.rpc("increment_stars_balance", {
    p_user_id: user.id,
    p_delta: task.reward_stars,
  });

  // 5.2 фоллбэк: ручной инкремент (upsert + сумма)
  if (rpcErr) {
    const { data: bal } = await supabase
      .from("balances")
      .select("stars")
      .eq("user_id", user.id)
      .single();
    const current = (bal?.stars as number | undefined) ?? 0;

    await supabase
      .from("balances")
      .upsert({ user_id: user.id, stars: current + task.reward_stars }, { onConflict: "user_id" });
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
