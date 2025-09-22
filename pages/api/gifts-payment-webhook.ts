import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);
const ADMIN_CHAT = process.env.TELEGRAM_ADMIN_CHAT;
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();
  const secret = req.headers["x-invoice-secret"] || req.headers["x-webhook-secret"];
  if (secret !== process.env.INVOICE_SECRET) return res.status(401).json({ error: "unauthorized" });

  const { order_id } = req.body || {};
  if (!order_id) return res.status(400).json({ error: "order_id required" });

  const { data: order, error: e1 } = await supabase.from("gift_orders").select("*").eq("id", order_id).single();
  if (e1 || !order) return res.status(404).json({ error: "order not found" });
  if (order.status === "paid") return res.json({ ok: true });

  // reduce stock & mark paid
  const { data: listing } = await supabase.from("gift_listings").select("*").eq("id", order.listing_id).single();
  const newQty = Math.max(0, (listing?.quantity || 1) - 1);
  await supabase.from("gift_listings").update({ quantity: newQty }).eq("id", order.listing_id);
  await supabase.from("gift_orders").update({ status: "paid" }).eq("id", order.id);

  // credit to seller ledger (example: add to balances table if exists)
  await supabase.from("ledger").insert([{
    tg_id: listing.seller_tg_id,
    type: "gift_sale",
    stars: order.stars,
    meta: { order_id: order.id, listing_id: order.listing_id }
  }]);

  // notify admin (optional)
  if (ADMIN_CHAT) {
    fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: ADMIN_CHAT,
        text: `✅ Оплата подарка #${order.id}\nПродавец: ${listing.seller_tg_id}\nПокупатель: ${order.buyer_tg_id}\n⭐ ${order.stars}`
      })
    }).catch(()=>{});
  }

  return res.json({ ok: true });
}
