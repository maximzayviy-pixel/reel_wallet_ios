// components/Roulette.tsx
import { useMemo, useRef, useState, useEffect } from "react";

type Props = {
  tgId: number;                   // обязателен
  stars: number;                  // текущие звезды
  onBalanceChange(v: number): void;
};

type SpinOk = { ok: true; prize: number | "PLUSH_PEPE_NFT"; balance: number; tg_id: number };
type SpinErr = { ok: false; error: string; details?: string; balance?: number; tg_id?: number };
type SpinResp = SpinOk | SpinErr;

const COST = 15;
const PRIZES = [
  { label: "+3 ⭐",    value: 3,    weight: 30 },
  { label: "+5 ⭐",    value: 5,    weight: 24 },
  { label: "+10 ⭐",   value: 10,   weight: 18 },
  { label: "+15 ⭐",   value: 15,   weight: 12 },
  { label: "+50 ⭐",   value: 50,   weight: 8  },
  { label: "+100 ⭐",  value: 100,  weight: 5.5},
  { label: "+1000 ⭐", value: 1000, weight: 2.4},
  { label: "Plush Pepe NFT", value: "PLUSH_PEPE_NFT" as const, weight: 0.1,
    image: "https://i.imgur.com/BmoA5Ui.jpeg" },
];

export default function Roulette({ tgId, stars, onBalanceChange }: Props) {
  const [spinning, setSpinning] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [termsOk, setTermsOk] = useState<boolean>(true); // по умолчанию true, если уже согласился ранее

  useEffect(() => {
    try { setTermsOk(!!localStorage.getItem("roulette_terms_ok")); } catch {}
  }, []);

  const totalWeight = useMemo(() => PRIZES.reduce((s,p)=>s+p.weight, 0), []);
  const chances = useMemo(
    () => PRIZES.map(p => ({ ...p, chance: +(p.weight * 100 / totalWeight).toFixed(2) })),
    [totalWeight]
  );

  const railRef = useRef<HTMLDivElement>(null);

  const run = async () => {
    setErr(null);
    if (spinning) return;
    if (!termsOk) { setErr("Сначала отметь согласие с правилами ниже."); return; }
    if (!tgId) { setErr("Не удалось определить Telegram ID"); return; }
    if (stars < COST) { setErr("Недостаточно звёзд"); return; }

    setSpinning(true);
    try {
      const initData = (window as any)?.Telegram?.WebApp?.initData || "";
      const r = await fetch("/api/roulette-spin", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-init-data": initData,
          "x-tg-id": String(tgId),
        },
        body: JSON.stringify({ tg_id: tgId }),
      });

      const json: SpinResp = await r.json().catch(() => ({ ok: false, error: "BAD_JSON" }) as SpinErr);
      if (!json.ok) {
        setErr(`${json.error}${json.details ? `: ${json.details}` : ""}`);
      } else {
        onBalanceChange(json.balance);
        // плавно «докручиваем» к карточке приза (визуальный эффект)
        const idx = PRIZES.findIndex(p => p.value === json.prize);
        if (idx >= 0 && railRef.current) {
          const card = railRef.current.querySelectorAll<HTMLElement>("[data-card]")[idx + PRIZES.length]; // из средней тройной ленты
          if (card) {
            const rail = railRef.current;
            const center = rail.clientWidth / 2 - card.clientWidth / 2;
            const target = card.offsetLeft - center;
            rail.scrollTo({ left: target, behavior: "smooth" });
          }
        }
      }
    } catch {
      setErr("Сеть недоступна");
    } finally {
      setTimeout(() => setSpinning(false), 1200); // убираем гифку через 1.2s
    }
  };

  return (
    <section className="px-4 pb-24 pt-6">
      {/* затемнение, пока нет согласия */}
      {!termsOk && (
        <div className="fixed inset-0 z-30 bg-black/45 backdrop-blur-sm pointer-events-none" />
      )}

      <h2 className="text-[20px] font-semibold mb-2">Рулетка</h2>
      <div className="text-sm text-slate-600 mb-3">
        Стоимость — <b>{COST} ⭐</b>
        <span className="ml-2 rounded-full bg-emerald-50 text-emerald-700 px-2 py-0.5 text-xs">
          баланс: {stars}
        </span>
      </div>

      {/* Горизонтальный барабан с карточками */}
      <div ref={railRef} className="relative overflow-x-auto no-scrollbar rounded-3xl ring-1 ring-slate-200 bg-white" style={{ scrollBehavior: "smooth" }}>
        <div className="flex gap-3 p-4 min-w-max">
          {PRIZES.concat(PRIZES, PRIZES).map((p, i) => (
            <div key={i} data-card className="snap-center w-40 shrink-0 rounded-2xl ring-1 ring-slate-200 bg-gradient-to-b from-slate-50 to-slate-100 p-3 flex flex-col items-center justify-center">
              <div className="h-24 w-full flex items-center justify-center overflow-hidden">
                {p.image ? (
                  <img src={p.image} alt="Plush Pepe" className="h-24 w-full object-contain" />
                ) : (
                  <div className="text-2xl font-bold">
                    {String(p.label).replace(" ⭐","")}<span className="text-lg align-top">⭐</span>
                  </div>
                )}
              </div>
              <div className="mt-2 text-center text-sm font-medium">{p.label}</div>
            </div>
          ))}
        </div>

        {/* GIF-оверлей на время спина (зелёный хромакей притушен) */}
        {spinning && (
          <div className="absolute inset-0 z-20 grid place-items-center pointer-events-none">
            <img
              src="https://s4.ezgif.com/tmp/ezgif-4a73d92325fcc3.gif"
              alt=""
              className="h-40 w-40 object-contain mix-blend-multiply"
              // в вебе нет настоящего chroma-key, но mix-blend + белая подложка «гасит» зелёный
            />
          </div>
        )}
      </div>

      {/* Кнопка + ошибки */}
      <div className="mt-4 flex items-center justify-between gap-3">
        <div className="text-sm text-slate-500">Твой баланс: <b>{stars}</b> ⭐</div>
        <button onClick={run} disabled={spinning} className="h-11 px-5 rounded-xl bg-blue-600 text-white disabled:opacity-60">
          {spinning ? "Крутим…" : `Крутить за ${COST} ⭐`}
        </button>
      </div>
      {err && <div className="mt-2 text-sm text-red-600">{err}</div>}

      {/* Согласие (1 раз) */}
      {!termsOk && (
        <div className="mt-4 p-3 rounded-2xl bg-white ring-1 ring-slate-200">
          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              className="mt-0.5"
              onChange={(e) => {
                if (e.target.checked) {
                  try { localStorage.setItem("roulette_terms_ok", "1"); } catch {}
                  setTermsOk(true);
                }
              }}
            />
            <span className="text-sm">
              Я ознакомился с{" "}
              <a className="text-blue-600 underline" href="https://telegra.ph/Polzovatelskoe-soglashenie-Game-Reel-Wallet-09-29" target="_blank" rel="noreferrer">
                пользовательским соглашением
              </a>.
            </span>
          </label>
        </div>
      )}

      {/* Шансы — от зелёного к красному */}
      <div className="mt-6">
        <div className="text-sm font-medium mb-2">Шансы выпадения</div>
        <div className="grid grid-cols-2 gap-2">
          {chances.map((p, i) => {
            const t = p.chance / 100;    // 0..1
            const red = Math.round(255 * (1 - t));
            const green = Math.round(255 * t);
            const bg = `rgba(${red},${green},80,0.14)`;
            const border = `rgba(${red},${green},80,0.35)`;
            return (
              <div key={i} className="rounded-xl p-2 text-sm" style={{ background: bg, border: `1px solid ${border}` }}>
                <div className="flex justify-between">
                  <span>{typeof p.value === "number" ? `+${p.value} ⭐` : "Plush Pepe NFT"}</span>
                  <b>{p.chance}%</b>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Призы (карточки ниже) */}
      <div className="mt-6">
        <div className="text-sm font-medium mb-2">Призы</div>
        <div className="grid grid-cols-3 gap-3">
          {chances.map((p, i) => (
            <div key={i} className="rounded-2xl ring-1 ring-slate-200 bg-white p-3 text-center">
              <div className="h-20 flex items-center justify-center overflow-hidden">
                {("image" in p && (p as any).image) ? (
                  <img src={(p as any).image} alt="" className="h-20 w-full object-contain" />
                ) : (
                  <div className="text-xl font-bold">{typeof p.value === "number" ? `+${p.value} ⭐` : p.label}</div>
                )}
              </div>
              <div className="mt-2 text-xs text-slate-500">{p.chance}%</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
