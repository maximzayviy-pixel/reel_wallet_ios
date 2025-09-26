import { useState } from "react";

export default function InviteCodeForm({ tg_id }: { tg_id: number }) {
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<string|null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("loading");
    // Include init data to authenticate the request for this tg_id
    const tgInit = typeof window !== 'undefined' ? (window as any).Telegram?.WebApp?.initData : "";
    const res = await fetch("/api/redeem-invite", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-telegram-init-data": tgInit || "" },
      body: JSON.stringify({ tg_id, code }),
    });
    const data = await res.json();
    if (data.ok) setStatus("ok");
    else setStatus(data.error || "error");
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <label className="block text-sm opacity-80">Инвайт-код</label>
      <input value={code} onChange={e=>setCode(e.target.value)} className="w-full rounded-xl bg-neutral-900 border border-neutral-800 px-4 py-3 outline-none" placeholder="например: AB12CD34" />
      <button className="rounded-xl px-4 py-3 bg-white text-black font-semibold">Активировать</button>
      {status && <div className="text-sm opacity-80">Статус: {status}</div>}
    </form>
  );
}
