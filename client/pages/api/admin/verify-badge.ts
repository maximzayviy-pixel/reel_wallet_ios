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

    const { walletId, verified } = req.body ?? {};

    if (!walletId || typeof walletId !== "string") {
      return res.status(400).json({ error: "walletId is required" });
    }
    if (typeof verified !== "boolean") {
      return res.status(400).json({ error: "verified must be a boolean" });
    }

    // Пример обновления в Supabase. Если в оригинале другая логика — оставьте её,
    // главное — заменить ensureIsAdmin -> ensureIsAdminApi.
    const { error } = await supabaseAdmin
      .from("wallets")
      .update({ verified })
      .eq("id", walletId);

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({ ok: true });
  } catch (err: any) {
    const message = err?.message ?? "Unexpected error";
    const status = err?.statusCode ?? err?.status ?? 500;
    return res.status(status).json({ error: message });
  }
}
