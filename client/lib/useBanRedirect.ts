import { useEffect } from 'react';

/**
 * useBanRedirect checks whether the current Telegram user is banned by
 * requesting `/api/user-info`. If the user is banned it navigates to
 * the `/banned` page. Should be called at the top of pages that require
 * protection from banned users.
 */
export default function useBanRedirect() {
  useEffect(() => {
    const tg: any = (window as any)?.Telegram?.WebApp;
    const tg_id = tg?.initDataUnsafe?.user?.id;
    if (!tg_id) return;
    fetch(`/api/user-info?tg_id=${tg_id}`)
      .then((r) => r.json())
      .then((j) => {
        if (j?.info?.is_banned) {
          if (window.location.pathname !== '/banned') {
            window.location.href = '/banned';
          }
        }
      })
      .catch(() => {});
  }, []);
}