// lib/bus.ts — простая шина событий для звёзд
export type StarsEvent = { stars: number; tgId?: number };

const EVT = "stars:update";

export function emitStars(e: StarsEvent) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(EVT, { detail: e }));
  try { localStorage.setItem("global_stars", String(e.stars)); } catch {}
}

export function onStars(cb: (e: StarsEvent) => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = (ev: Event) => {
    // @ts-ignore
    const d = ev?.detail as StarsEvent | undefined;
    if (d && typeof d.stars === "number") cb(d);
  };
  window.addEventListener(EVT, handler as EventListener);
  return () => window.removeEventListener(EVT, handler as EventListener);
}
