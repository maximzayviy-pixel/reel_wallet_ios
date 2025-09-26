// client/pages/api/tasks.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

const TG_TOKEN = process.env.TELEGRAM_BOT_TOKEN!;
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SVC  = process.env.SUPABASE_SERVICE_KEY!;

/** meta канала: title + avatar */
async function resolveChannelMeta(chatRef: string | number) {
  const chatR = await fetch(`https://api.telegram.org/bot${TG_TOKEN}/getChat?chat_id=${encodeURIComponent(String(chatRef))}`);
  if (!chatR.ok) return { title: null, avatarUrl: null };
  const chat = await chatR.json();
  const title = chat?.result?.title ?? null;
  const smallId = chat?.result?.photo?.small_file_id ?? null;

  let avatarUrl: string | null = null;
  if (smallId) {
    const fileR = await fetch(`https://api.telegram.org/bot${TG_TOKEN}/getFile?file_id=${smallId}`);
    if (fileR.ok) {
      const file = await fileR.json();
      const path = file?.result?.file_path;
      if (path) avatarUrl = `https://api.telegram.org/file/bot${TG_TOKEN}/${path}`;
    }
  }
  return { title, avatarUrl };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).end();

  // необязательный tg_id — тогда сразу отдадим claimed
  const tgId = req.query.tg_id ? String(req.query.tg_id) : null;

  // читаем задачи анонимно
  const pub = createClient(URL, ANON);
  const { data, error } = await pub
    .from("subscription_tasks")
    .select("id, channel_username, chat_id, title, reward_stars, is_active")
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (error) return res.status(500).json({ error: error.message });

  // если передали tg_id — серверным ключом подтянем completions
  let completed: Record<string, boolean> = {};
  if (tgId) {
    const svc = createClient(URL, SVC, { auth: { persistSession: false } });
    const { data: users } = await svc.from("users").select("id").eq("tg_id", tgId).limit(1);
    const u = users?.[0];
    if (u) {
      const { data: comps } = await svc
        .from("subscription_completions")
        .select("task_id, awarded_stars")
        .eq("user_id", u.id);
      (comps || []).forEach(c => (completed[c.task_id] = (c.awarded_stars ?? 0) > 0));
    }
  }

  // обогатим метаданными TG (в параллели)
  const tasks = await Promise.all(
    (data || []).map(async (t) => {
      const chatRef = t.chat_id ?? (t.channel_username ? `@${t.channel_username}` : null);
      const meta = chatRef ? await resolveChannelMeta(chatRef) : { title: null, avatarUrl: null };
      return {
        id: t.id,
        channel_username: t.channel_username,
        chat_id: t.chat_id ?? null,
        title: t.title || meta.title || `@${t.channel_username}`,
        reward_stars: t.reward_stars,
        channel_title: meta.title,
        avatar_url: meta.avatarUrl,
        claimed: completed[t.id] === true,
      };
    })
  );

  res.json({ tasks });
}
