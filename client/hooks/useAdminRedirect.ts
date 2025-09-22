// client/hooks/useAdminRedirect.ts
// Redirects Telegram admins (by Telegram user.id) to /admin as soon as the WebApp is ready.
import { useEffect } from "react";
import { useRouter } from "next/router";

function parseAdminIds(src?: string): string[] {
  if (!src) return [];
  return src
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);
}

export function useAdminRedirect() {
  const router = useRouter();

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Telegram WebApp user id
    const tgId = (window as any)?.Telegram?.WebApp?.initDataUnsafe?.user?.id;
    if (!tgId) return;

    const adminIds = parseAdminIds(process.env.NEXT_PUBLIC_ADMIN_IDS);
    const isAdmin = adminIds.includes(String(tgId));

    if (isAdmin && router.pathname !== "/admin") {
      // Prevent flashing other pages
      router.replace("/admin");
    }
  }, [router]);
}
