// client/pages/api/withdraw-create.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();

  try {
    const tg_id = Number((req.headers["x-telegram-id"] as string) || req.query.tg_id);
    if (!tg_id) return res.status(400).json({ ok:false, error:"tg_id required" });

    const { amount_stars, bank_code, account } = req.body || {};
    if (!amount_stars || amount_stars <= 0) return res.status(400).json({ ok:false, error:"amount_stars > 0" });
    if (!bank_code || !account) return res.status(400).json({ ok:false, error:"bank_code and account required" });

    // is_verified
    const { data: userRow, error: uErr } = await supabase.from("users").select("is_verified").eq("tg_id", tg_id).maybeSingle();
    if (uErr) return res.status(400).json({ ok:false, error:uErr.message });
    if (!userRow?.is_verified) return res.status(403).json({ ok:false, error:"KYC required" });

    // баланс (используй свою функцию/представление)
    const { data: balData, error: bErr } = await supabase.rpc("get_balance_by_tg", { p_tg_id: tg_id });
    if (bErr) return res.status(400).json({ ok:false, error:bErr.message });
    const stars = Number(balData?.stars || 0);
    if (stars < amount_stars) return res.status(400).json({ ok:false, error:"Недостаточно ⭐" });

    const { data, error } = await supabase
      .from("withdraw_requests")
      .insert({ tg_id, amount_stars, bank_code, account, status: "pending" })
      .select()
      .single();

    if (error) return res.status(400).json({ ok:false, error:error.message });

    // Telegram админу
    const bot = process.env.TELEGRAM_BOT_TOKEN || "";
    const adminChat = process.env.TELEGRAM_ADMIN_CHAT || "";
    if (bot && adminChat) {
      const url = `https://api.telegram.org/bot${bot}/sendMessage`;
      const text =
        `<b>#${data.id}</b>\n` +
        `Заявка на вывод от <code>${tg_id}</code>\n` +
        `Сумма: <b>${amount_stars} ⭐</b>\n` +
        `Банк: ${bank_code}\n` +
        `Номер: ${account}\n\n` +
        `Approve: /wd_approve ${data.id}\nReject: /wd_reject ${data.id}`;
      await fetch(url, {
        method: "POST",
        headers: { "Content-Type":"application/json" },
        body: JSON.stringify({ chat_id: adminChat, text, parse_mode: "HTML" })
      }).catch(()=>{});
    }

    res.status(200).json({ ok:true, id: data.id });
  } catch (e:any) {
    res.status(500).json({ ok:false, error: e.message || "Server error" });
  }
}
