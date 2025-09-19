const openStarsPayment = async () => {
  const stars = Number(starsAmount);
  if (!stars || stars <= 0) return alert("Укажи количество звёзд.");

  const tgId = tg?.initDataUnsafe?.user?.id;
  if (!tgId) return alert("Не удалось определить пользователя Telegram");

  const res = await fetch("/api/topup-stars", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tg_id: tgId, amount_stars: stars }),
  });

  let json: any = {};
  try { json = await res.json(); } catch {}

  if (!res.ok || !json?.ok || !json?.link) {
    return alert(
      (json?.error === "INVOICE_FAILED" && (json?.details?.description || json?.details)) ||
      json?.error ||
      "Ошибка формирования инвойса"
    );
  }

  // Если боту нельзя написать (пользователь не нажал START) — ведём его в бот
  if (json.needStartBot && json.botUsername) {
    const startUrl = `https://t.me/${json.botUsername}?start=start`;
    tg?.openTelegramLink ? tg.openTelegramLink(startUrl) : window.open(startUrl, "_blank");
    // и одновременно покажем ссылку на оплату (fallback)
    setTimeout(() => {
      tg?.openTelegramLink ? tg.openTelegramLink(json.link) : window.open(json.link, "_blank");
    }, 1200);
    return;
  }

  // Нормальный путь: бот прислал кнопку в личку → покажем анимацию
  if (json.userSent) {
    const el = document.createElement("div");
    el.className = "fixed inset-0 z-50 flex items-center justify-center bg-black/40";
    el.innerHTML =
      '<div class="bg-white rounded-2xl p-6 text-center shadow-xl animate-pulse"><div class="text-3xl mb-2">📩</div><div class="font-semibold mb-1">Ссылка отправлена в личку</div><div class="text-sm text-slate-500">Открой диалог с ботом и оплати</div></div>';
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1800);
  } else {
    // на всякий случай — откроем прямую ссылку
    tg?.openTelegramLink ? tg.openTelegramLink(json.link) : window.open(json.link, "_blank");
  }
};
