// client/pages/withdraw.tsx
"use client";
import Layout from "../components/Layout";
import useBanRedirect from "../lib/useBanRedirect";
import { useEffect, useState } from "react";

const SBP_BANKS = [
  { code: "sber", name: "Сбербанк" },
  { code: "tcs", name: "Тинькофф" },
  { code: "vtb", name: "ВТБ" },
  { code: "alpha", name: "Альфа-Банк" },
  { code: "gazprom", name: "Газпромбанк" },
  // добавь свои
];

export default function Withdraw() {
  useBanRedirect();
  const [amount, setAmount] = useState<number>(0);
  const [bank, setBank] = useState<string>(SBP_BANKS[0].code);
  const [account, setAccount] = useState<string>("");
  const [isVerified, setIsVerified] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    // подтягиваем статус верификации
    const tg = (window as any).__TG_INIT_DATA_USER__?.id; // если ты кладёшь tg_id в window; иначе передай через header
    if (!tg) return;
    fetch(`/api/user-info?tg_id=${tg}`).then(r=>r.json()).then(j=>setIsVerified(!!j?.is_verified));
  }, []);

  const submit = async () => {
    setMsg(null);
    if (!isVerified) return setMsg("Требуется верификация аккаунта.");
    if (amount <= 0) return setMsg("Укажи сумму в ⭐.");
    if (!account.trim()) return setMsg("Укажи номер для СБП (телефон).");

    setSubmitting(true);
    try {
      const r = await fetch("/api/withdraw-create", {
        method: "POST",
        headers: {"Content-Type":"application/json"},
        body: JSON.stringify({ amount_stars: amount, bank_code: bank, account })
      });
      const j = await r.json();
      if (!j?.ok) throw new Error(j?.error || "Ошибка");
      setMsg("Заявка отправлена. Ожидайте подтверждения админа.");
      setAmount(0); setAccount("");
    } catch (e:any) {
      setMsg(e.message || "Ошибка отправки");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Layout title="Вывод ⭐">
      <div className="max-w-md mx-auto p-4 space-y-3">
        <div className="space-y-2">
          <label className="block text-sm">Сумма (в ⭐)</label>
          <input type="number" className="w-full rounded-xl ring-1 ring-slate-200 px-3 py-2"
                 value={amount || ""} onChange={e=>setAmount(Number(e.target.value))}/>
        </div>

        <div className="space-y-2">
          <label className="block text-sm">Банк СБП</label>
          <select className="w-full rounded-xl ring-1 ring-slate-200 px-3 py-2"
                  value={bank} onChange={e=>setBank(e.target.value)}>
            {SBP_BANKS.map(b => <option key={b.code} value={b.code}>{b.name}</option>)}
          </select>
        </div>

        <div className="space-y-2">
          <label className="block text-sm">Номер телефона (СБП)</label>
          <input type="tel" className="w-full rounded-xl ring-1 ring-slate-200 px-3 py-2"
                 placeholder="+7XXXXXXXXXX" value={account} onChange={e=>setAccount(e.target.value)}/>
        </div>

        <button onClick={submit} disabled={submitting}
                className="w-full rounded-xl bg-emerald-600 disabled:bg-slate-300 text-white py-2">
          Отправить заявку
        </button>

        {msg && <div className="text-sm text-slate-700">{msg}</div>}
      </div>
    </Layout>
  );
}
