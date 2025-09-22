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


async function getRubBalance(
  supabase: ReturnType<typeof createClient>,
  tgId: string
): Promise<{ rub: number; stars: number; ton: number }> {
  // 1) пробуем VIEW balances_by_tg (ожидаем: tg_id, stars, ton, total_rub)
  const { data: vdata } = await supabase
    .from("balances_by_tg")
    .select("stars, ton, total_rub")
    .eq("tg_id", tgId)
    .maybeSingle();

  if (vdata) {
    const stars = Number(vdata.stars || 0);
    const ton = Number(vdata.ton || 0);
    const rub = Number(
      vdata.total_rub != null ? vdata.total_rub : stars / 2 + ton * 300
    );
    return { rub, stars, ton };
  }

  // 2) фоллбэк — найдём user_id по tg_id и посмотрим balances
  const { data: u } = await supabase
    .from("users")
    .select("id")
    .eq("tg_id", tgId)
    .maybeSingle();

  if (!u?.id) return { rub: 0, stars: 0, ton: 0 };

  const { data: bdata } = await supabase
    .from("balances")
    .select("stars, ton")
    .eq("user_id", u.id)
    .maybeSingle();

  const stars = Number(bdata?.stars || 0);
  const ton = Number(bdata?.ton || 0);
  const rub = stars / 2 + ton * 300;
  return { rub, stars, ton };
}


function parseDataUrl(dataUrl: string): { mime: string; buffer: Buffer } | null {
  try {
    const m = dataUrl.match(/^data:(.+);base64,(.*)$/);
    if (!m) return null;
    return { mime: m[1], buffer: Buffer.from(m[2], "base64") };
  } catch {
    return null;
  }
}

async function uploadQrIfNeeded(
  supabase: ReturnType<typeof createClient>,
  tgId: string,
  b64?: string | null
): Promise<string | null> {
  if (!b64) return null;
  const parsed = parseDataUrl(b64);
  if (!parsed) return null;

  const bucket = process.env.SUPABASE_QR_BUCKET || "qr";
  // убедимся, что бакет существует (best-effort)
  try {
    // @ts-ignore — у supabase-js нет typed API для создания bucket
    await (supabase.storage as any).createBucket?.(bucket, { public: true });
  } catch {}
  const ext = parsed.mime.includes("png") ? "png" : parsed.mime.includes("webp") ? "webp" : "jpg";
  const key = `${tgId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  await supabase.storage.from(bucket).upload(key, parsed.buffer, {
    contentType: parsed.mime,
    upsert: false,
  });
  const { data: pub } = supabase.storage.from(bucket).getPublicUrl(key);
  return pub?.publicUrl || null;
}

// ---- handler ---------------------------------------------------------------
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // разрешим GET для быстрой проверки
  if (req.method === "GET") return ok(res, { ok: true });
  if (req.method !== "POST") return ok(res); // чтобы не было ретраев

  try {
    const SUPABASE_URL =
      process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || "";
    const TG_BOT_TOKEN =
      process.env.TG_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN || "";
    const ADMIN_TG_ID = process.env.ADMIN_TG_ID || "";

    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      return bad(res, "SUPABASE_MISCONFIGURED", 500);
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: { persistSession: false },
    });

    // Совместимость: user_id (старый фронт) или tg_id
    const body = req.body || {};
    const tgId = String(body.tg_id ?? body.user_id ?? "").trim();
    const qr_payload = String(body.qr_payload ?? "").trim();
    const amountRub = Number(body.amount_rub ?? body.amount ?? 0);
    const maxLimitRub =
      body.max_limit_rub != null ? Number(body.max_limit_rub) : null;
    const qr_image_b64 = body.qr_image_b64 as string | undefined;

    if (!tgId || !qr_payload || !amountRub) {
      return bad(res, "tg_id, qr_payload, amount_rub are required", 400);
    }

    // 1) баланс (теперь корректно из balances_by_tg -> balances)
    const { rub: totalRub } = await getRubBalance(supabase, tgId);

    if (totalRub < amountRub) {
      return bad(res, "INSUFFICIENT_FUNDS", 402, {
        have_rub: totalRub,
        need_rub: amountRub,
      });
    }

    // 2) резерв: спишем в таблицу locks (в ₽)
    //    создайте таблицу `balances_locked`:
    //    id uuid pk default gen_random_uuid(), tg_id text, amount_rub numeric, status text default 'active', created_at timestamptz default now()
    const { data: lockIns, error: lockErr } = await supabase
      .from("balances_locked")
      .insert([{ tg_id: tgId, amount_rub: amountRub, status: "active" }])
      .select("id")
      .single();
    if (lockErr) {
      return bad(res, "LOCK_FAILED", 500, { details: lockErr.message });
    }

    // 3) сохраним фотку QR (если прислали)
    const imageUrl = await uploadQrIfNeeded(supabase, tgId, qr_image_b64);

    // 4) создаём заявку
    const { data: ins, error: insErr } = await supabase
      .from("payment_requests")
      .insert([
        {
          tg_id: tgId,
          qr_payload,
          amount_rub: amountRub,
          max_limit_rub: maxLimitRub ?? amountRub,
          status: "pending",
          image_url: imageUrl,
          lock_id: lockIns.id, // полезно связать с резервом
        },
      ])
      .select("id")
      .single();

    if (insErr) {
      return bad(res, "INSERT_FAILED", 500, { details: insErr.message });
    }

    // 5) уведомление админу
    let admin_notified = false;
    try {
      if (TG_BOT_TOKEN && ADMIN_TG_ID) {
        const caption =
          `<b>#${ins.id}</b>\n` +
          `Запрос оплаты от <code>${tgId}</code>\n` +
          `Сумма: <b>${amountRub} ₽</b>\n\n` +
          (qr_payload.length > 3800
            ? `<code>${qr_payload.slice(0, 3800)}...</code>`
            : `<code>${qr_payload}</code>`);

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
                    {
                      text: "✅ Оплатить",
                      callback_data: `confirm:${ins.id}`,
                    },
                    {
                      text: "❌ Отказать",
                      callback_data: `reject:${ins.id}`,
                    },
                  ],
                ],
              },
            }),
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
                    {
                      text: "✅ Оплатить",
                      callback_data: `confirm:${ins.id}`,
                    },
                    {
                      text: "❌ Отказать",
                      callback_data: `reject:${ins.id}`,
                    },
                  ],
                ],
              },
            }),
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
