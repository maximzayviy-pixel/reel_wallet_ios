// client/pages/api/tasks.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

const TG_TOKEN = process.env.TELEGRAM_BOT_TOKEN!;

async function resolveChannelMeta(chatIdOrUsername: string | number) {
  const chat = await fetch(
    `https://api.telegram.org/bot${TG_TOKEN}/getChat?chat_id=${encodeURIComponent(
      String(chatIdOrUsername).startsWith("@") ? chatIdOrUsername : String(chatIdOrUsername)
    )}`
  ).then(r => r.ok ? r.json() : null);

  const title = chat?.result?.title ?? null;
  const smallFileId = chat?.result?.photo?.small_file_id ?? null;

  let avatarUrl: string | null = null;
  if (smallFileId) {
    const f = await fetch(`https://api.telegram.org/bot${TG_TOKEN}/getFile?file_id=${smallFileId}`)
      .then(r => r.ok ? r.json() : null);
    const path = f?.result?.file_path;
    if (path) avatarUrl = `https://api.telegram.org/file/bot${TG_TOKEN}/${path}`;
  }
  return { title, avatarUrl };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).end();

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { data, error } = await supabase
    .from("subscription_tasks")
    .select("id, channel_username, chat_id, title, reward_stars, is_active")
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (error) return res.status(500).json({ error: error.message });

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
      };
    })
  );

  res.json({ tasks });
}
