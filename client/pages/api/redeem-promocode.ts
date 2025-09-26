// pages/api/redeem-promocode.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import { requireUser } from "./_userAuth";

type Body = { tg_id?: number; code?: string };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(200).json({ ok: false, error: "METHOD_NOT_ALLOWED" });

  const { tg_id, code } = (req.body || {}) as Body;
  const normCode = (code || "").trim().toUpperCase();

  if (!tg_id || !normCode) return res.status(200).json({ ok: false, error: "BAD_INPUT" });

  // Authorise: ensure the caller is acting on behalf of this tg_id or is admin
  if (!requireUser(req, res, tg_id)) return;

  const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const SERVICE_KEY =
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY;
  if (!SUPABASE_URL || !SERVICE_KEY) return res.status(200).json({ ok: false, error: "NO_BACKEND_CREDS" });

  const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  try {
    // 1) сам промокод
    const { data: promo } = await sb.from("promocodes").select("*").eq("code", normCode).maybeSingle();
    if (!promo) return res.status(200).json({ ok: false, error: "PROMO_NOT_FOUND" });

    const maxUse: number = Number(promo.max_use ?? 1);
    const used: number = Number(promo.used ?? 0);

    if (maxUse > 0 && used >= maxUse) {
      return res.status(200).json({ ok: false, error: "PROMO_EXHAUSTED" });
    }

    // 2) защитимся от повторного использования юзером
    const { data: already } = await sb
      .from("promocode_usages")
      .select("id")
      .eq("code", normCode)
      .eq("tg_id", tg_id)
      .limit(1);
    if (already && already.length) {
      return res.status(200).json({ ok: false, error: "ALREADY_USED" });
    }

    // 3) применяем бонус через ledger и фиксируем использование
    const currency: string = String(promo.currency || "stars").toLowerCase(); // 'stars' | 'rub'
    const bonus: number = Number(promo.bonus || 0);
    if (bonus <= 0) return res.status(200).json({ ok: false, error: "PROMO_ZERO" });

    // ledger: единый источник истины
    const rate = 0.5; // 2⭐ = 1₽
    const insert = {
      tg_id,
      type: "promo_bonus",
      asset_amount: currency === "stars" ? bonus : Math.round(bonus * 2),
      amount_rub: currency === "rub" ? bonus : bonus * rate,
      rate_used: rate,
      status: "ok",
      metadata: { code: normCode },
    };

    await sb.from("ledger").insert([insert]);

    // usage + инкремент used
    await sb.from("promocode_usages").insert([{ code: normCode, tg_id, used_at: new Date().toISOString() }]);
    await sb.from("promocodes").update({ used: used + 1 }).eq("code", normCode);

    return res.status(200).json({
      ok: true,
      bonus,
      currency: currency === "stars" ? "stars" : "rub",
    });
  } catch (e: any) {
    // если есть уникальный индекс на (code, tg_id), словим дубль красиво
    const msg = e?.message || "";
    if (msg.includes("duplicate") || msg.includes("unique")) {
      return res.status(200).json({ ok: false, error: "ALREADY_USED" });
    }
    return res.status(200).json({ ok: false, error: "SERVER_ERROR" });
  }
}
