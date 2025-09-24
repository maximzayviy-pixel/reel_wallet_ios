// client/pages/api/admin/tasks.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { createServerSupabase } from "../../lib/supabaseServer";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const supabase = createServerSupabase();

  if (req.method === "GET") {
    const { data, error } = await supabase
      .from("subscription_tasks")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ tasks: data || [] });
  }

  if (req.method === "POST") {
    const { title, channel_username, reward_stars, is_active = true } = req.body || {};
    if (!title || !channel_username) return res.status(400).json({ error: "title и channel_username обязательны" });
    const { data, error } = await supabase.from("subscription_tasks").insert({
      title, channel_username, reward_stars: Number(reward_stars || 30), is_active
    }).select("*").single();
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ task: data });
  }

  if (req.method === "PUT") {
    const { id, ...fields } = req.body || {};
    if (!id) return res.status(400).json({ error: "id обязателен" });
    const { data, error } = await supabase.from("subscription_tasks").update(fields).eq("id", id).select("*").single();
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ task: data });
  }

  if (req.method === "DELETE") {
    const { id } = req.body || {};
    if (!id) return res.status(400).json({ error: "id обязателен" });
    const { error } = await supabase.from("subscription_tasks").delete().eq("id", id);
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ ok: true });
  }

  return res.status(405).end();
}
