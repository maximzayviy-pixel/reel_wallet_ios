import { supabaseServer } from './supabaseServer'
import { createClient } from '@supabase/supabase-js'

const service = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE!,
)

export async function requireUser() {
  const supabase = supabaseServer()
  const { data } = await supabase.auth.getUser()
  if (!data.user) throw new Error('UNAUTHENTICATED')
  return data.user
}

export async function requireAdmin() {
  const user = await requireUser()
  const { data, error } = await service
    .from('users')
    .select('role, is_banned')
    .eq('id', user.id)
    .single()
  if (error) throw error
  if (data.is_banned) throw new Error('BANNED')
  if (data.role !== 'admin') throw new Error('FORBIDDEN')
  return user
}
