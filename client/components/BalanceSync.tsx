// components/BalanceSync.tsx
import { useEffect, useState } from "react";
import { onStars } from "../lib/bus";

export default function BalanceSync() {
  const [tgId, setTgId] = useState<number>(0);

  // 1) определить tgId
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
    } catch {}
  }, []);

  // 2) подписка на события (для «живого» обновления)
  useEffect(() => {
    return onStars(({ stars }) => {
      try { localStorage.setItem("global_stars", String(stars)); } catch {}
      try { (window as any).__GLOBAL_STARS = stars; } catch {}
    });
  }, []);

  // 3) периодический подтяг кэша с сервера (например, при первом входе)
  useEffect(() => {
    if (!tgId) return;
    (async () => {
      try {
        const r = await fetch(`/api/my-balance?tg_id=${tgId}`);
        const j = await r.json();
        if (j?.ok) {
          const s = Number(j.stars || 0);
          try { localStorage.setItem("global_stars", String(s)); } catch {}
          try { (window as any).__GLOBAL_STARS = s; } catch {}
        }
      } catch {}
    })();
  }, [tgId]);

  return null; // невидимый мост
}
