// client/pages/api/kyc-submit.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

function htmlEscape(s: string) {
  return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();
  try {
    // tg_id берём из мини-аппы (как у тебя в профиле через TWA initData / /api/auth-upsert)
    const tg_id = Number((req.headers["x-telegram-id"] as string) || req.query.tg_id);
    if (!tg_id) return res.status(400).json({ ok:false, error:"tg_id required (header x-telegram-id или ?tg_id=)" });

    const { face_url, doc_url } = req.body || {};
    if (!face_url || !doc_url) return res.status(400).json({ ok:false, error:"face_url and doc_url required" });

    const { data, error } = await supabase
      .from("kyc_requests")
      .insert({ tg_id, face_url, doc_url, status: "pending" })
      .select()
      .single();

    if (error) return res.status(400).json({ ok:false, error: error.message });

    // Уведомление админу
    const bot = process.env.TELEGRAM_BOT_TOKEN || "";
    const adminChat = process.env.TELEGRAM_ADMIN_CHAT || "";
    if (bot && adminChat) {
      const url = `https://api.telegram.org/bot${bot}/sendMessage`;
      const caption =
        `<b>KYC</b> заявка от <code>${tg_id}</code>\n` +
        `face: ${htmlEscape(face_url)}\n` +
        `doc: ${htmlEscape(doc_url)}\n\n` +
        `Approve: /kyc_approve ${data.id}\nReject: /kyc_reject ${data.id}`;
      await fetch(url, {
        method: "POST",
        headers: {"Content-Type":"application/json"},
        body: JSON.stringify({ chat_id: adminChat, text: caption, parse_mode: "HTML" })
      }).catch(()=>{});
    }

    res.status(200).json({ ok:true, id: data.id });
  } catch (e:any) {
    res.status(500).json({ ok:false, error: e.message || "Server error" });
  }
}
