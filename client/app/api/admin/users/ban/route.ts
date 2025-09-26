import { NextResponse } from 'next/server';
import { requireAdmin } from '../../../../../lib/requireAuth';
import { supabaseAdmin } from '../../../../../lib/supabaseAdmin';

export async function POST(req: Request) {
  // Ensure only verified admins can ban
  await requireAdmin(req as any);

  const body = await req.json().catch(() => ({}));
  const { user_id, reason } = body as { user_id?: string; reason?: string };

  if (!user_id) {
    return NextResponse.json({ ok: false, error: 'BAD_INPUT: user_id required' }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from('users')
    .update({ is_banned: true, ban_reason: reason ?? null })
    .eq('id', user_id);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function GET() {
  // Disallow accidental GETs on a mutating route
  return NextResponse.json({ ok: false, error: 'METHOD_NOT_ALLOWED' }, { status: 405 });
}
