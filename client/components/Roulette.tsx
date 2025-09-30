// components/Roulette.tsx
import React, { useCallback, useMemo, useState } from "react";
import Image from "next/image";

const COST = 15;

type SpinRespOk = { ok: true; prize: number | "PLUSH_PEPE_NFT"; stars_after: number };
type SpinRespErr = { ok: false; error: string; details?: string };
type SpinResp = SpinRespOk | SpinRespErr;

function isOk(resp: SpinResp): resp is SpinRespOk {
  return resp.ok === true;
}

export default function Roulette({
  tgId,
  stars,
  onBalanceChange,
}: {
  tgId: number;
  stars: number;
  onBalanceChange: (v: number) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const prizes = useMemo(
    () => [
      { label: "+3 ⭐", val: 3, p: "30%" },
      { label: "+5 ⭐", val: 5, p: "24%" },
      { label: "+10 ⭐", val: 10, p: "18%" },
      { label: "+15 ⭐", val: 15, p: "12%" },
      { label: "+50 ⭐", val: 50, p: "8%" },
      { label: "+100 ⭐", val: 100, p: "5.5%" },
      { label: "+1000 ⭐", val: 1000, p: "2.4%" },
      { label: "Plush Pepe NFT", val: "PLUSH_PEPE_NFT" as const, p: "0.1%", img: "https://i.imgur.com/BmoA5Ui.jpeg" },
    ],
    []
  );

  const spin = useCallback(async () => {
    setErr(null);
    if (loading) return;
    if (stars < COST) {
      setErr("Недостаточно звёзд");
      return;
    }
    setLoading(true);
    try {
      const r = await fetch("/api/roulette-spin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tg_id: tgId }),
      });
      const json: SpinResp = await r.json();

      if (isOk(json)) {
        onBalanceChange(json.stars_after);
      } else {
        const msg = json.details ? `${json.error}: ${json.details}` : json.error;
        setErr(msg);
      }
    } catch {
      setErr("SPIN_FAILED");
    } finally {
      setLoading(false);
    }
  }, [tgId, stars, loading, onBalanceChange]);

  return (
    <div className="space-y-3">
      <div className="text-sm text-slate-600">
        Стоимость — <b>{COST} ⭐</b>
      </div>

      {/* колесо (горизонтальные карточки) */}
      <div className="relative overflow-hidden rounded-2xl border border-yellow-200 bg-gradient-to-br from-yellow-50 to-amber-50 p-3">
        <div className="flex gap-3 snap-x overflow-x-auto no-scrollbar">
          {prizes.map((p, i) => (
            <div
              key={i}
              className="snap-center shrink-0 w-48 h-28 rounded-xl border border-amber-200 bg-white/80 shadow-sm flex items-center justify-center relative"
            >
              {p.img ? (
                <Image
                  src={p.img}
                  alt="Plush Pepe"
                  width={56}
                  height={56}
                  className="absolute left-3 top-1/2 -translate-y-1/2 rounded-lg object-contain"
                />
              ) : null}
              <div className="text-center px-3 ml-14">
                <div className="text-xl font-semibold">{p.label}</div>
                <div className="mt-1 inline-block rounded-full px-2 py-0.5 text-xs bg-emerald-50 text-emerald-700">
                  {p.p}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* кнопки */}
      <div className="flex items-center gap-3">
        <button
          onClick={spin}
          disabled={loading}
          className="rounded-xl bg-blue-600 text-white px-4 py-3 font-semibold disabled:opacity-60"
        >
          {loading ? "Крутим…" : `Крутить за ${COST} ⭐`}
        </button>
        <div className="text-sm rounded-lg bg-emerald-50 text-emerald-700 px-3 py-2">
          баланс: <b>{stars}</b>
        </div>
      </div>

      {err && (
        <div className="text-red-600 text-sm bg-red-50 border border-red-100 rounded-xl p-3">
          {err}
        </div>
      )}
    </div>
  );
}
