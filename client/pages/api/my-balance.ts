import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string, // только сервисный ключ, не anon
  { auth: { persistSession: false } }
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const raw = (req.query.tg_id ?? "").toString().trim();
    const tgId = Number(raw);

    if (!tgId || !Number.isFinite(tgId)) {
      return res.status(400).json({ error: "tg_id is required" });
    }

    // вызываем функцию напрямую
    const { data, error } = await supabase.rpc("get_balance_by_tg", { tg_id: tgId });

    if (error) throw error;

    // get_balance_by_tg обычно возвращает массив, берём первую строку
    const row = Array.isArray(data) ? data[0] : data;

    const stars = Number(row?.stars ?? 0);
    const ton = Number(row?.ton ?? 0);
    const total_rub =
      row?.total_rub !== undefined ? Number(row.total_rub) : stars / 2 + ton * 300;

    return res.status(200).json({ stars, ton, total_rub });
  } catch (e: any) {
    console.error("my-balance error", e);
    return res.status(500).json({ error: "internal_error" });
  }
}
