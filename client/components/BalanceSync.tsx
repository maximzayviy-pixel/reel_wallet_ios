// components/BalanceSync.tsx
import { useEffect, useState } from "react";
import { onStars } from "../lib/bus";

export default function BalanceSync() {
  const [tgId, setTgId] = useState<number>(0);
  const [stars, setStars] = useState<number>(0);

  // детект tgId (TG initData -> ?tg_id -> localStorage)
  useEffect(() => {
    try {
      const w: any = typeof window !== "undefined" ? window : undefined;
      const tg = w?.Telegram?.WebApp;
      const fromTg = tg?.initDataUnsafe?.user?.id ? Number(tg.initDataUnsafe.user.id) : 0;
      const params = new URLSearchParams(w?.location?.search || "");
      const fromQuery = Number(params.get("tg_id") || params.get("debug_tg_id") || 0);
      const fromLS = Number((() => { try { return localStorage.getItem("debug_tg_id") || "0"; } catch { return "0"; } })());
      const id = fromTg || fromQuery || fromLS || 0;
      if (id) {
        setTgId(id);
        try { localStorage.setItem("debug_tg_id", String(id)); } catch {}
      }
      // если есть кеш звёзд — покажем сразу
      const cached = Number((() => { try { return localStorage.getItem("global_stars") || "0"; } catch { return "0"; } })());
      if (!Number.isNaN(cached) && cached > 0) setStars(cached);
    } catch {}
  }, []);

  // загрузка текущего баланса 1 раз (если знаем tgId)
  useEffect(() => {
    if (!tgId) return;
    (async () => {
      try {
        const r = await fetch(`/api/my-balance?tg_id=${tgId}`);
        const j = await r.json();
        if (j?.ok) {
          const s = Number(j.stars || 0);
          setStars(s);
          try { localStorage.setItem("global_stars", String(s)); } catch {}
        }
      } catch {}
    })();
  }, [tgId]);

  // подписка на события от рулетки и других мест
  useEffect(() => {
    return onStars(({ stars }) => {
      setStars(stars);
      try { localStorage.setItem("global_stars", String(stars)); } catch {}
    });
  }, []);

  // Экспортируем в window для чужих компонентов, если им нужно быстро взять число
  useEffect(() => {
    try { (window as any).__GLOBAL_STARS = stars; } catch {}
  }, [stars]);

  // Ничего не рисуем — это «невидимый мост»
  return null;
}
