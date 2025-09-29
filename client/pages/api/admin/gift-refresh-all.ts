// pages/api/admin/gift-refresh-all.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import { requireAdmin } from "./_guard";
import handlerSingle from "./gift-refresh";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const admin = await requireAdmin(req, res);
  if (!admin) return;
  if (req.method !== "POST") return res.status(405).end();

  const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);
  const { data: gifts, error } = await supabase
    .from("gifts")
    .select("id,tgs_url,image_url,anim_url")
    .order("id", { ascending: true });

  if (error) return res.status(500).json({ ok: false, error: error.message });

  const updated: Array<{ id: number; ok: boolean; error?: string }> = [];

  for (const g of gifts || []) {
    if (g.tgs_url && g.image_url) continue; // уже ок
    try {
      // переиспользуем одиночный обработчик
      const r = await fetch(process.env.NEXT_PUBLIC_BASE_URL
          ? `${process.env.NEXT_PUBLIC_BASE_URL}/api/admin/gift-refresh`
          : `${req.headers.origin}/api/admin/gift-refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-key": (process.env.ADMIN_HTTP_KEY || "") },
        body: JSON.stringify({ id: g.id })
      });
      const j = await r.json();
      updated.push({ id: g.id, ok: !!j.ok, error: j.error });
      await new Promise(r => setTimeout(r, 200));
    } catch (e: any) {
      updated.push({ id: g.id, ok: false, error: e?.message || "fetch_failed" });
    }
  }

  res.json({ ok: true, updated });
}
