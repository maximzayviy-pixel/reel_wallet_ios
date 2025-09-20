import Head from "next/head";
import Link from "next/link";
import { useEffect } from "react";
type Props = { title?: string; children: any };
export default function Layout({ title = "Reel Wallet", children }: Props) {
  useEffect(()=>{ try {
    const tg = (window as any)?.Telegram?.WebApp;
    tg?.setHeaderColor?.("bg_color");
    tg?.setBottomBarColor?.("#ffffff");
    tg?.ready?.(); tg?.expand?.();
  } catch {} }, []);
  return (
    <div className="min-h-screen bg-slate-50">
      <Head><title>{title}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" /></Head>
      <main className="pb-24">{children}</main>
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200">
        <div className="max-w-md mx-auto grid grid-cols-4 text-xs">
          <Link href="/" className="py-3 text-center">Главная</Link>
          <Link href="/topup" className="py-3 text-center">Пополнить</Link>
          <Link href="/scan" className="py-3 text-center">Оплатить</Link>
          <Link href="/profile" className="py-3 text-center">Профиль</Link>
        </div>
      </nav>
    </div>
  ); }