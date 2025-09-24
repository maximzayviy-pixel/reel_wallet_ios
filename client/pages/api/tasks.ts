// client/pages/api/tasks.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

const TG_TOKEN = process.env.TELEGRAM_BOT_TOKEN!;

async function resolveChannelMeta(username: string) {
  // 1) Узнаём title и photo_file_id
  const chatResp = await fetch(
    `https://api.telegram.org/bot${TG_TOKEN}/getChat?chat_id=@${username}`
  );
  if (!chatResp.ok) return { title: null, avatarUrl: null };

  const chat = await chatResp.json();
  const title: string | null = chat?.result?.title ?? null;
  const smallFileId: string | null = chat?.result?.photo?.small_file_id ?? null;

  // 2) Если есть фото — получаем file_path → строим URL
  if (smallFileId) {
    const fileResp = await fetch(
      `https://api.telegram.org/bot${TG_TOKEN}/getFile?file_id=${smallFileId}`
    );
    if (fileResp.ok) {
      const file = await fileResp.json();
      const filePath = file?.result?.file_path;
      if (filePath) {
        const avatarUrl = `https://api.telegram.org/file/bot${TG_TOKEN}/${filePath}`;
        return { title, avatarUrl };
      }
    }
  }
  return { title, avatarUrl: null };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).end();

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { data, error } = await supabase
    .from("subscription_tasks")
    .select("id, channel_username, title, reward_stars, is_active")
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (error) return res.status(500).json({ error: error.message });

  // Параллельно обогащаем данными TG
  const tasks = await Promise.all(
    (data || []).map(async (t) => {
      const meta = await resolveChannelMeta(t.channel_username);
      return {
        id: t.id,
        channel_username: t.channel_username,
        title: t.title || meta.title || `@${t.channel_username}`,
        reward_stars: t.reward_stars,
        channel_title: meta.title,      // на всякий случай отдельно
        avatar_url: meta.avatarUrl,     // может быть null
      };
    })
  );

  res.json({ tasks });
}
