import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SVC = process.env.SUPABASE_SERVICE_KEY!;
const TG_TOKEN = process.env.TELEGRAM_BOT_TOKEN!;

function createServerSupabase() {
  return createClient(URL, SVC, { auth: { persistSession: false } });
}

async function isSubscribed(tgId: number, channelUsername?: string | null, chatId?: number | null) {
  const chatRef = chatId ?? (channelUsername ? `@${channelUsername}` : null);
  if (!chatRef) return { ok: false, subscribed: false, reason: "no_chat_ref" };

  const url = `https://api.telegram.org/bot${TG_TOKEN}/getChatMember?chat_id=${encodeURIComponent(
    String(chatRef)
  )}&user_id=${tgId}`;

  try {
    const resp = await fetch(url);
    const json = await resp.json().catch(() => ({}));
    const status = json?.result?.status as string | undefined;

    // Telegram может вернуть 400 "CHAT_ADMIN_REQUIRED" / "user not found"
    if (!resp.ok || !json?.ok) {
      return {
        ok: true,
        subscribed: false,
        reason: json?.description || "telegram_error",
        raw: json,
      };
    }

    const subscribed = ["member", "administrator", "creator"].includes(status ?? "");
    return { ok: true, subscribed, status };
  } catch (e: any) {
    return { ok: false, subscribed: false, reason: "fetch_failed", raw: String(e?.message ?? e) };
  }
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
  if (uErr) return res.status(200).json({ ok: false, subscribed: false, message: "db_error_users", details: uErr.message });
  const user = users?.[0];
  if (!user) return res.status(200).json({ ok: false, subscribed: false, message: "Пользователь не найден" });

  // 2) задача
  const { data: tasks, error: tErr } = await supabase
    .from("subscription_tasks")
    .select("id, channel_username, chat_id, reward_stars")
    .eq("id", task_id)
    .limit(1);
  if (tErr || !tasks?.[0]) {
    return res.status(200).json({ ok: false, subscribed: false, message: "Задача не найдена" });
  }
  const task = tasks[0];

  // 3) проверка подписки (всегда без 500)
  const chk = await isSubscribed(Number(tg_id), task.channel_username, (task as any).chat_id ?? null);
  if (!chk.ok) {
    return res.status(200).json({ ok: false, subscribed: false, message: "telegram_unreachable", details: chk.reason });
  }
  if (!chk.subscribed) {
    await supabase
      .from("subscription_completions")
      .upsert(
        { user_id: user.id, task_id, subscribed: false, awarded_stars: 0, checked_at: new Date().toISOString() },
        { onConflict: "user_id,task_id" }
      );
    return res.status(200).json({ ok: false, subscribed: false, message: "Подписка не обнаружена", details: chk.reason });
  }

  // 4) уже выдавали?
  const { data: prev, error: pErr } = await supabase
    .from("subscription_completions")
    .select("id, awarded_stars")
    .eq("user_id", user.id)
    .eq("task_id", task_id)
    .limit(1);
  if (pErr) {
    return res.status(200).json({ ok: false, subscribed: true, message: "db_error_prev", details: pErr.message });
  }
  if (prev?.[0]?.awarded_stars > 0) {
    return res.status(200).json({ ok: true, subscribed: true, already_awarded: true, stars: prev[0].awarded_stars });
  }

  // 5) НАЧИСЛЕНИЕ через public.ledger (минимальный набор колонок)
  const { error: lErr } = await supabase.from("ledger").insert({
    type_text: "stars_topup",
    asset_amount: task.reward_stars,
    status: "ok",
    metadata: { source: "subscription_task", task_id },
    tg_id: Number(tg_id),
  } as any);

  if (lErr) {
    // не падаем 500 — говорим, что подписка ок, но начисление не записалось
    return res.status(200).json({
      ok: false,
      subscribed: true,
      message: "ledger_insert_failed",
      details: lErr.message,
    });
  }

  // 6) фиксируем completion
  await supabase
    .from("subscription_completions")
    .upsert(
      { user_id: user.id, task_id, subscribed: true, awarded_stars: task.reward_stars, checked_at: new Date().toISOString() },
      { onConflict: "user_id,task_id" }
    );

  return res.status(200).json({ ok: true, subscribed: true, stars: task.reward_stars });
}
