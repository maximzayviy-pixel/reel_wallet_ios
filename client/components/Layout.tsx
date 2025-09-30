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

      {/* 👇 ВАЖНО: невидимый мост для синхронизации глобального баланса */}
      <BalanceSync />
    </div>
  );
}
