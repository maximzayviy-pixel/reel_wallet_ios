import { NextResponse } from 'next/server';
import { requireUser } from '../../../../lib/requireAuth';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';

export async function GET(req: Request) {
  try {
    // @ts-ignore NextRequest
    const { tgId, user } = await requireUser(req as any);
    const allow = (process.env.ADMIN_TG_IDS || '').split(',').map(s => s.trim()).filter(Boolean);
    let is_admin = allow.includes(String(tgId));
    if (!is_admin) {
      const { data } = await supabaseAdmin.from('users').select('role').eq('tg_id', String(tgId)).maybeSingle();
      is_admin = data?.role === 'admin';
    }
    return NextResponse.json({ ok:true, tgId, user, is_admin });
  } catch (e: any) {
    if (e instanceof Response) return e;
    return NextResponse.json({ ok:false, error: e?.message || 'UNAUTHORIZED' }, { status: 401 });
  }
}
