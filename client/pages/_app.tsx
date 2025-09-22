import '../styles/globals.css'
import type { AppProps } from 'next/app'
import { useEffect } from 'react'

export default function MyApp({ Component, pageProps }: AppProps) {
  useEffect(() => {
    try {
      const tg = (window as any).Telegram?.WebApp;
      if (tg) {
    let tries = 0;
    const i = setInterval(()=>{
      tries++;
      const user = tg?.initDataUnsafe?.user;
      if (user?.id) {
        localStorage.setItem('user_id', String(user.id));
        fetch('/api/auth-upsert', {
          method:'POST', headers:{'Content-Type':'application/json'},
          body: JSON.stringify({ tg_id: user.id, username: user.username, first_name: user.first_name, last_name: user.last_name })
        }).catch(()=>{});
        clearInterval(i);
      }
      if (tries>60) clearInterval(i);
    }, 100);

        tg.ready();
        if (tg.expand) tg.expand();
        const user = tg.initDataUnsafe?.user;
        if (user?.id) {
          localStorage.setItem('user_id', String(user.id));
          // Отправим на бэкенд для привязки профиля и создания баланса
          fetch('/api/auth-upsert', {
            method:'POST',
            headers:{'Content-Type':'application/json'},
            body: JSON.stringify({
              tg_id: user.id,
              username: user.username,
              first_name: user.first_name,
              last_name: user.last_name
            })
          }).catch(()=>{});
        }
      }
    } catch {}
  }, []);
  return <Component {...pageProps} />
}
