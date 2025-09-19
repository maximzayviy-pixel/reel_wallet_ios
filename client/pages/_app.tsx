import '../styles/globals.css'
import type { AppProps } from 'next/app'
import { useEffect } from 'react'

export default function MyApp({ Component, pageProps }: AppProps) {
  useEffect(() => {
    try {
      const tg = (window as any).Telegram?.WebApp;
      if (tg) {
        tg.ready();
        if (tg.expand) tg.expand();
        const user = tg.initDataUnsafe?.user;
        if (user?.id) localStorage.setItem('user_id', String(user.id));
      }
    } catch {}
  }, []);
  return <Component {...pageProps} />
}
