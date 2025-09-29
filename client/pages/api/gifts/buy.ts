import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import { validateTelegramInitData, parseTelegramUser } from "../../../lib/validateTelegram";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();
  try {
    // Validate Telegram WebApp initData from header 'x-init-data' or query 'initData'
    const initData = String(req.headers['x-init-data'] || req.query.initData || '');
    const ok = validateTelegramInitData(initData, process.env.TG_BOT_TOKEN!);
    if (!ok) return res.status(401).json({ ok:false, error: 'INVALID_INIT_DATA' });
    const user = parseTelegramUser(initData);
    if (!user?.id) return res.status(400).json({ ok:false, error: 'NO_TELEGRAM_USER' });
    const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);
    const gift_id = Number(req.body?.gift_id);
    if (!gift_id) return res.status(400).json({ ok:false, error: "gift_id_required" });
    const { data: gift, error: gErr } = await supabase.from('gifts').select('*').eq('id', gift_id).maybeSingle();
    if (gErr || !gift || !gift.enabled) return res.status(400).json({ ok:false, error: "gift_not_available" });

    // find user_id by tg_id
    const { data: u, error: uErr } = await supabase.from('users').select('id').eq('tg_id', user.id).maybeSingle();
    if (uErr || !u) return res.status(400).json({ ok:false, error: "user_not_found" });

    // check balance
    const { data: bal, error: bErr } = await supabase.from('balances').select('available_rub').eq('user_id', u.id).maybeSingle();
    if (bErr) return res.status(500).json({ ok:false, error: bErr.message });
    const price = Number(gift.price_rub);
    const available = Number(bal?.available_rub || 0);
    if (available < price) return res.status(400).json({ ok:false, error: "not_enough_funds", available, price });

    // charge & create order atomically
    const { error: lErr } = await supabase.from('ledger').insert({
      user_id: u.id,
      type: 'gift_purchase',
      amount_rub: -price,
      metadata: { gift_id, tme_link: gift.tme_link }
    });
    if (lErr) return res.status(500).json({ ok:false, error: lErr.message });

    // update balance
    const { error: updErr } = await supabase.rpc('debit_user_balance', { p_user_id: u.id, p_amount: price });
    if (updErr) return res.status(500).json({ ok:false, error: updErr.message });

    // create order
    const { error: oErr } = await supabase.from('gift_orders').insert({
      user_id: u.id,
      tg_id: user.id,
      gift_id: gift_id,
      price: price,
      status: 'paid'
    });
    if (oErr) return res.status(500).json({ ok:false, error: oErr.message });

    res.json({ ok:true, tme_link: gift.tme_link });
  } catch (e:any) {
    res.status(500).json({ ok:false, error: String(e?.message || e) });
  }
}
