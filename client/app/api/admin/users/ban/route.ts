import { createClient } from '@supabase/supabase-js'
import { requireAdmin } from '../../../../../lib/requireAuth';
const allowedOrigin = process.env.ADMIN_ALLOWED_ORIGIN || ''

export async function POST(req: Request) {
  try {
    await requireAdmin()
    const origin = req.headers.get('origin') || ''
    if (allowedOrigin && !origin.startsWith(allowedOrigin)) {
      return Response.json({ error: 'CSRF' }, { status: 403 })
    }

    const { user_id, reason } = await req.json()

    const { error } = await service
      .from('users')
      .update({ is_banned: true })
      .eq('id', user_id)
    if (error) throw error

    await service.from('user_bans').insert({ user_id, reason, status: 'active' }).catch(() => {})
    await service.from('audit_log').insert({
      event: 'ban_via_api',
      actor: null,
      target: user_id,
      details: { reason }
    }).catch(() => {})

    return Response.json({ ok: true })
  } catch (e: any) {
    const code = e.message === 'FORBIDDEN' ? 403 : e.message === 'UNAUTHENTICATED' ? 401 : 400
    return Response.json({ error: e.message }, { status: code })
  }
}
