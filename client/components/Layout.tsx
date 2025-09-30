// components/Layout.tsx
import BottomNav from "./BottomNav";
import Head from "next/head";
import BalanceSync from "./BalanceSync";

export default function Layout({
  children,
  title = "Reel Wallet",
}: {
  children: React.ReactNode;
  title?: string;
}) {
  return (
    <div className="min-h-screen bg-slate-50">
      <Head>
        <title>{title}</title>
      </Head>

      {/* Контент страницы */}
      <div className="pb-24">{children}</div>

      {/* Нижняя навигация */}
      <BottomNav />

      {/* Невидимый мост: слушает события из рулетки и подтягивает /api/my-balance */}
      <BalanceSync />
    </div>
  );
}
