// pages/api/scan-submit.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

export const config = { api: { bodyParser: { sizeLimit: "6mb" } } };

// ---- helpers ---------------------------------------------------------------
function ok(res: NextApiResponse, body: any = { ok: true }) {
  return res.status(200).json(body);
}
function bad(res: NextApiResponse, error: string, code = 400, extra?: any) {
  return res.status(code).json({ ok: false, error, ...extra });
}

// Keep supabase arg as any to avoid generic mismatches at build time
async function getRubBalance(
  supabase: any,
  tgId: string
): Promise<{ rub: number; stars: number; ton: number }> {
  // 1) preferred view (balances_by_tg)
  const { data: vdata } = await supabase
    .from("balances_by_tg")
    .select("stars, ton, total_rub")
    .eq("tg_id", tgId)
    .maybeSingle<any>();
  if (vdata) {
    const stars = Number(vdata.stars ?? 0);
    const ton = Number(vdata.ton ?? 0);
    const rub = Number(
      vdata.total_rub != null ? vdata.total_rub : stars / 2 + ton * 300
    );
    return { rub, stars, ton };
  }

  // 2) fallback: users -> balances(user_id)
  const { data: u } = await supabase
    .from("users")
    .select("id")
    .eq("tg_id", tgId)
    .maybeSingle<any>();
  if (!u?.id) return { rub: 0, stars: 0, ton: 0 };

  const { data: bdata } = await supabase
    .from("balances")
    .select("stars, ton")
    .eq("user_id", u.id)
    .maybeSingle<any>();

  const stars = Number(bdata?.stars ?? 0);
  const ton = Number(bdata?.ton ?? 0);
  const rub = stars / 2 + ton * 300;
  return { rub, stars, ton };
}

function parseDataUrl(dataUrl: string): { mime: string; buffer: Buffer } | null {
  try {
    const m = dataUrl.match(/^data:(.*?);base64,(.*)$/);
    if (!m) return null;
    return { mime: m[1], buffer: Buffer.from(m[2], "base64") };
  } catch {
    return null;
  }
}

// Keep supabase arg as any to avoid generic mismatches at build time
async function uploadQrIfNeeded(
  supabase: any,
  tgId: string,
  b64?: string | null
): Promise<string | null> {
  if (!b64) return null;
  const parsed = parseDataUrl(b64);
  if (!parsed) return null;

  const bucket = process.env.SUPABASE_QR_BUCKET || "qr";
  try {
    // Best-effort create bucket if absent
    // @ts-ignore
    await (supabase.storage as any).createBucket?.(bucket, { public: true });
  } catch {}

  const ext = parsed.mime.includes("png")
    ? "png"
    : parsed.mime.includes("webp")
    ? "webp"
    : "jpg";
  const key = `${tgId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

  await supabase.storage.from(bucket).upload(key, parsed.buffer, {
    contentType: parsed.mime,
    upsert: false
  });
  const { data: pub } = supabase.storage.from(bucket).getPublicUrl(key);
  return pub?.publicUrl || null;
}

// ---- handler ---------------------------------------------------------------
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "GET") return ok(res, { ok: true });
  if (req.method !== "POST") return ok(res);

  try {
    const SUPABASE_URL =
      process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || "";
    const TG_BOT_TOKEN =
      process.env.TG_BOT_TOKEN ||
      process.env.TELEGRAM_BOT_TOKEN ||
      process.env.TELEGRAM_BOT ||
      process.env.BOT_TOKEN ||
      "";
    const ADMIN_TG_ID =
      process.env.ADMIN_TG_ID ||
      process.env.TELEGRAM_ADMIN_CHAT ||
      process.env.TELEGRAM_ADMIN_ID ||
      process.env.TELEGRAM_ADMIN ||
      "";

    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      return bad(res, "SUPABASE_MISCONFIGURED", 500);
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    const body = (req.body || {}) as any;
    const tgId = String(body.tg_id ?? body.user_id ?? "").trim();
    const qr_payload = String(body.qr_payload ?? "").trim();
    const amountRub = Number(body.amount_rub ?? body.amount ?? 0);
    const maxLimitRub =
      body.max_limit_rub != null ? Number(body.max_limit_rub) : null;
    const qr_image_b64 = body.qr_image_b64 as string | undefined;

    if (!tgId || !qr_payload || !amountRub) {
      return bad(res, "tg_id, qr_payload, amount_rub are required", 400);
    }

    // 1) balance
    const { rub: totalRub } = await getRubBalance(supabase as any, tgId);
    if (totalRub < amountRub) {
      return bad(res, "INSUFFICIENT_FUNDS", 402, {
        totalRub,
        amountRub
      });
    }

    // 2) store QR
    const imageUrl = await uploadQrIfNeeded(supabase as any, tgId, qr_image_b64);

    // 3) create request
    const { data: ins, error: insErr } = await supabase
      .from("payment_requests")
      .insert({
        tg_id: tgId,
        qr_payload,
        amount_rub: amountRub,
        image_url: imageUrl || null,
        status: "pending",
        admin_id: null,
        admin_note: null
      })
      .select("*")
      .maybeSingle<any>();

    if (insErr || !ins) {
      return bad(res, "DB_INSERT_FAILED", 500, { error: insErr });
    }

    // 4) notify admin (best-effort)
    let admin_notified = false;
    try {
      if (TG_BOT_TOKEN && ADMIN_TG_ID) {
        const caption =
          `<b>Новая оплата</b>\n` +
          `ID: <code>${tgId}</code>\n` +
          `Сумма: <b>${amountRub} ₽</b>`;

        if (imageUrl) {
          await fetch(`https://api.telegram.org/bot${TG_BOT_TOKEN}/sendPhoto`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: ADMIN_TG_ID,
              photo: imageUrl,
              caption,
              parse_mode: "HTML",
              reply_markup: {
                inline_keyboard: [
                  [
                    { text: "✅ Оплатить", callback_data: `confirm:${ins.id}` },
                    { text: "❌ Отказать",  callback_data: `reject:${ins.id}` }
                  ]
                ]
              }
            })
          });
        } else {
          await fetch(`https://api.telegram.org/bot${TG_BOT_TOKEN}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: ADMIN_TG_ID,
              text: caption,
              parse_mode: "HTML",
              reply_markup: {
                inline_keyboard: [
                  [
                    { text: "✅ Оплатить", callback_data: `confirm:${ins.id}` },
                    { text: "❌ Отказать",  callback_data: `reject:${ins.id}` }
                  ]
                ]
              }
            })
          });
        }
        admin_notified = true;
      }
    } catch {
      admin_notified = false;
    }

    return ok(res, { ok: true, id: ins.id, admin_notified });
  } catch (e: any) {
    return ok(res, { ok: false, error: e?.message || "UNKNOWN" });
  }
}
