'use client'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { useState } from 'react'

export default function LoginPage() {
  const supabase = createClientComponentClient()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [msg, setMsg] = useState('')

  async function onSubmit(e: any) {
    e.preventDefault()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return setMsg(error.message)
    const cookie = document.cookie.split('; ').find(x => x.startsWith('post_login_redirect='))
    const to = cookie?.split('=')[1] || '/'
    window.location.href = to
  }

  return (
    <main className="max-w-sm mx-auto p-6">
      <h1 className="text-xl font-semibold mb-4">Вход</h1>
      <form onSubmit={onSubmit} className="space-y-3">
        <input className="w-full border rounded p-2" placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} />
        <input type="password" className="w-full border rounded p-2" placeholder="Пароль" value={password} onChange={e=>setPassword(e.target.value)} />
        <button className="w-full rounded bg-black text-white py-2">Войти</button>
        <p className="text-sm text-red-600 min-h-[1.25rem]">{msg}</p>
      </form>
    </main>
  )
}
