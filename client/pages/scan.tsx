// pages/scan.tsx
import Layout from "../components/Layout";
import { useEffect, useRef, useState } from "react";

// Простейший детектор NSPK: вытягиваем sum= из ссылки (10700 -> 107.00 ₽)
function parseNspkAmount(payload: string): number | null {
  try {
    const u = new URL(payload);
    const sumStr = u.searchParams.get("sum");
    if (!sumStr) return null;
    const v = Number(sumStr);
    if (!Number.isFinite(v)) return null;
    // NSPK часто отдаёт копейки *100
    const rub = v >= 1000 ? v / 100 : v / 100; // оставим /100 универсально
    return Math.round(rub * 100) / 100;
  } catch {
    return null;
  }
}

export default function Scan() {
  const [qr, setQr] = useState<string>("");
  const [amount, setAmount] = useState<number | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const tg: any = (typeof window !== "undefined") ? (window as any).Telegram?.WebApp : null;

  // Имитация "сканера": если у тебя уже есть сканер снизу — оставь его. Ниже мы просто реагируем на найденный payload.
  useEffect(() => {
    if (!qr) return;
    const a = parseNspkAmount(qr);
    setAmount(a);
    setConfirmOpen(true);
  }, [qr]);

  const onConfirm = async () => {
    try {
      setSubmitting(true);
      const tg_id = tg?.initDataUnsafe?.user?.id;
      if (!tg_id) throw new Error("No tg_id");

      const body = {
        tg_id,
        qr_payload: qr,
        amount_rub: amount ?? 0,
        image_url: sessionStorage.getItem("scan_last_photo") || null
      };

      const res = await fetch("/api/scan-submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const j = await res.json();
      if (!res.ok || !j.ok) {
        alert(j.error || "Ошибка отправки заявки");
      } else {
        toast("Отправлено админу");
        setConfirmOpen(false);
        setQr("");
      }
    } catch (e:any) {
      alert(e?.message || String(e));
    } finally {
      setSubmitting(false);
    }
  };

  const onCancel = () => {
    setConfirmOpen(false);
  };

  // Встраиваем твой сканер: вызови setQr(payload) когда распознаешь QR + сохрани фото в sessionStorage.setItem('scan_last_photo', url)
  // Пример фейкового скана кнопкой (удали в бою)
  const fakeScan = () => {
    const demo = "https://qr.nspk.ru/BD100071611VK3ET8V4P5OC3PCB51QRU?type=02&sum=10700&cur=RUB";
    setQr(demo);
    sessionStorage.setItem("scan_last_photo", "");
  };

  return (
    <Layout title="Сканировать QR">
      <div className="max-w-md mx-auto p-4">
        <div className="rounded-2xl bg-white p-4 shadow-sm text-center">
          <div className="text-sm text-slate-600 mb-2">Наведите камеру на QR СБП</div>
          <div className="aspect-square rounded-xl bg-slate-100 grid place-items-center">
            <button onClick={fakeScan} className="text-slate-500 text-sm underline">Фейк-скан (демо)</button>
          </div>
        </div>
      </div>

      {confirmOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center">
          <div className="w-full max-w-md bg-white rounded-t-2xl sm:rounded-2xl p-5">
            <div className="text-center">
              <div className="text-xs text-slate-500 mb-1">Сумма к оплате</div>
              <div className="text-3xl font-semibold mb-2">{amount != null ? `${amount.toFixed(2)} ₽` : "—"}</div>
              <div className="text-xs text-slate-500 break-all">{qr}</div>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <button
                onClick={onCancel}
                disabled={submitting}
                className="rounded-xl border border-slate-200 py-3 font-medium"
              >
                Отказаться
              </button>
              <button
                onClick={onConfirm}
                disabled={submitting}
                className="rounded-xl bg-blue-600 text-white py-3 font-medium"
              >
                {submitting ? "Отправляем…" : "Оплатить"}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}

// мини-тост без зависимостей
function toast(text: string) {
  const el = document.createElement("div");
  el.className = "fixed left-1/2 -translate-x-1/2 bottom-6 z-[60] bg-black text-white text-sm px-4 py-2 rounded-full shadow-xl";
  el.textContent = text;
  document.body.appendChild(el);
  setTimeout(() => { el.remove(); }, 1800);
}
