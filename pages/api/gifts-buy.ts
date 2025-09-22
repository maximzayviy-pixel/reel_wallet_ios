import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!;
const BOT_USERNAME = process.env.BOT_USERNAME!; // e.g. reelwallet_bot

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();
  const { listing_id, buyer_tg_id } = req.body || {};
  if (!listing_id || !buyer_tg_id) return res.status(400).json({ error: "listing_id, buyer_tg_id required" });

  // Load listing
  const { data: listing, error: e1 } = await supabase.from("gift_listings").select("*").eq("id", listing_id).single();
  if (e1 || !listing) return res.status(404).json({ error: "listing not found" });
  if (listing.status !== "active" || listing.quantity <= 0) return res.status(400).json({ error: "not available" });

  // Create order first
  const payload = JSON.stringify({ t: "gift", listing_id, buyer_tg_id, ts: Date.now() });
  const { data: order, error: e2 } = await supabase.from("gift_orders").insert([{
    listing_id, buyer_tg_id, stars: listing.price_stars, status: "pending", payload
  }]).select().single();
  if (e2) return res.status(500).json({ error: e2.message });

  // Stars invoice link
  try {
    const resp = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/createInvoiceLink`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: `Подарок: ${listing.title}`,
        description: `Покупка подарка у продавца ${listing.seller_tg_id}`,
        payload,
        currency: "XTR",
        prices: [{ label: "Gift", amount: listing.price_stars }],
        provider_token: "", // empty for Stars
      })
    });
    const j = await resp.json();
    if (!j.ok) return res.status(400).json({ error: j.description || "createInvoiceLink failed" });

    const link: string = j.result;
    // Also support deep-linking fallback
    const deep = `https://t.me/${BOT_USERNAME}?startapp=${encodeURIComponent(payload)}`;

    await supabase.from("gift_orders").update({ invoice_link: link }).eq("id", order.id);
    return res.json({ ok: true, invoice_link: link, deeplink: deep, order_id: order.id });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || "invoice error" });
  }
}
