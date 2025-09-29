import type { NextApiRequest, NextApiResponse } from "next";
import { ensureIsAdminApi } from "../../../lib/admin";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // Проверка прав администратора
    await ensureIsAdminApi(req);

    if (req.method !== "POST") {
      res.setHeader("Allow", ["POST"]);
      return res.status(405).json({ error: "Method Not Allowed" });
    }

    const { walletId, stars } = req.body ?? {};

    if (!walletId || typeof walletId !== "string") {
      return res.status(400).json({ error: "walletId is required" });
    }
    if (typeof stars !== "number" || !Number.isFinite(stars)) {
      return res.status(400).json({ error: "stars must be a finite number" });
    }

    // Пример обновления в Supabase. Если у вас другая таблица/колонки — оставьте вашу логику как было.
    // Этот блок намеренно максимально нейтральный: если в вашем оригинальном файле уже есть запрос,
    // просто сохраните его — менять не нужно, важна именно правка ensureIsAdmin -> ensureIsAdminApi.
    const { error } = await supabaseAdmin
      .from("wallets")
      .update({ stars })
      .eq("id", walletId);

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({ ok: true });
  } catch (err: any) {
    // ensureIsAdminApi бросит ошибку при отсутствии прав
    const message = err?.message ?? "Unexpected error";
    const status = err?.statusCode ?? err?.status ?? 500;
    return res.status(status).json({ error: message });
  }
}
