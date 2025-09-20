// pages/api/scan-submit.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

function parseInitData(initData?: string) {
  // Telegram WebApp initData — это querystring (без ?, с хэшами). Нам нужен user.id
  if (!initData) return null;
  try {
    const params = new URLSearchParams(initData);
    const userStr = params.get('user');
    if (userStr) {
      const user = JSON.parse(userStr);
      return user?.id ? String(user.id) : null;
    }
  } catch {}
  return null;
}

// NSPK: https://qr.nspk.ru/... ?sum=10700&cur=RUB (как правило, копейки)
function parseNspkAmountRub(urlStr: string): number | null {
  try {
    const u = new URL(urlStr);
    const sumRaw = u.searchParams.get('sum');
    if (!sumRaw) return null;
    const n = Number(sumRaw);
    if (!isFinite(n) || n <= 0) return null;
    // хак: если похоже на копейки (>= 100), трактуем как копейки
    if (n >= 100) return Math.round(n) / 100;
    // иначе это уже рубли
    return n;
  } catch {
    return null;
  }
}

// Простой EMV-TLV парсер (только верхний уровень, теги 54 (Amount), 62 - не нужен для суммы)
function parseEmvAmountRub(payload: string): number | null {
  try {
    let i = 0;
    const read = (len: number) => payload.slice(i, (i += len));
    while (i + 4 <= payload.length) {
      const tag = read(2);
      const len = parseInt(read(2), 10);
      if (!Number.isFinite(len) || len < 0) return null;
      const val = read(len);
      if (tag === '54') {
        // Amount — как правило "###.##"
        const n = Number(val.replace(',', '.'));
        if (isFinite(n) && n > 0) return n;
      }
    }
  } catch {}
  return null;
}

async function uploadBase64ToSupabase(base64: string, supabase: ReturnType<typeof createClient>): Promise<string|null> {
  try {
    if (!base64.startsWith('data:')) return null;
    const [meta, b64] = base64.split(',', 2);
    const mime = meta.split(';')[0];               // data:image/png
    const ext = (mime.split('/')[1] || 'png').toLowerCase();
    const fileName = `qr_${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
    const bin = Buffer.from(b64, 'base64');
    const up = await supabase.storage.from('qr').upload(fileName, bin, {
      contentType: mime,
      upsert: false,
    });
    if (up.error) {
      console.error('upload error', up.error.message);
      return null;
    }
    const pub = supabase.storage.from('qr').getPublicUrl(up.data.path);
    return pub?.data?.publicUrl || null;
  } catch (e:any) {
    console.error('upload ex', e?.message || e);
    return null;
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const SUPABASE_URL = process.env.SUPABASE_URL!;
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return res.status(500).json({ error: 'Missing SUPABASE env' });
  }
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });

  try {
    const b = req.body || {};

    // 1) tg_id: из тела или из x-telegram-init-data
    let tg_id: string | null = b.tg_id ? String(b.tg_id) : null;
    if (!tg_id) {
      const fromHeader = parseInitData(String(req.headers['x-telegram-init-data'] || ''));
      if (fromHeader) tg_id = fromHeader;
    }

    // 2) qr_payload: допускаем алиасы
    const qr_payload: string | null =
      b.qr_payload || b.payload || b.qr || b.data || null;

    // 3) amount_rub: если нет — попробуем распарсить из qr_payload
    let amount_rub: number | null =
      b.amount_rub != null ? Number(b.amount_rub) : null;

    if ((!amount_rub || !(amount_rub > 0)) && typeof qr_payload === 'string') {
      // NSPK URL?
      if (/^https?:\/\/qr\.nspk\.ru/i.test(qr_payload)) {
        const n = parseNspkAmountRub(qr_payload);
        if (n && n > 0) amount_rub = n;
      }
      // EMV?
      if ((!amount_rub || !(amount_rub > 0)) && /^[0-9A-Z]+$/.test(qr_payload)) {
        const n = parseEmvAmountRub(qr_payload);
        if (n && n > 0) amount_rub = n;
      }
    }

    // 4) картинка
    let image_url: string | null = b.image_url || null;
    if (!image_url && typeof b.image_base64 === 'string' && b.image_base64.startsWith('data:')) {
      image_url = await uploadBase64ToSupabase(b.image_base64, supabase);
    }

    // Валидация
    if (!tg_id || !qr_payload || !amount_rub || !(amount_rub > 0)) {
      // Вернём, что именно он увидел — поможет дебажить прямо из клиента
      return res.status(400).json({
        error: 'tg_id, qr_payload, amount_rub are required',
        seen: { tg_id, has_qr: !!qr_payload, amount_rub, hint: 'Передай tg_id, qr_payload и amount_rub (или NSPK/EMV для авто-парсинга)' }
      });
    }

    const { data, error } = await supabase
      .from('payment_requests')
      .insert([{
        tg_id,
        qr_payload,
        amount_rub,
        image_url
      }])
      .select('id,status,image_url')
      .maybeSingle();

    if (error) return res.status(500).json({ error: error.message });

    res.json({ ok: true, id: data?.id, status: data?.status || 'pending', image_url: data?.image_url || null });
  } catch (e:any) {
    console.error('scan-submit ex', e?.message || e);
    res.status(500).json({ error: e?.message || 'server error' });
  }
}
