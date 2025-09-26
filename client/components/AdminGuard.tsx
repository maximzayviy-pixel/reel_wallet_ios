import React from 'react';
import Forbidden from './Forbidden';

export default function AdminGuard({ children }: { children: React.ReactNode }) {
  const tg: any = (typeof window !== 'undefined') ? (window as any).Telegram?.WebApp : null;
  if (!tg) return <Forbidden reason="Откройте эту страницу через Telegram WebApp." />;

  const [ok, setOk] = React.useState<boolean | null>(null);

  React.useEffect(() => {
    tg.ready?.();
    const initData = tg.initData || '';
    fetch('/api/admin/_guard', { headers: { 'x-telegram-init-data': initData } })
      .then(r => setOk(r.ok))
      .catch(() => setOk(false));
  }, []);

  if (ok === null) return <div className="p-6">Загрузка…</div>;
  if (!ok) return <Forbidden />;
  return <>{children}</>;
}
