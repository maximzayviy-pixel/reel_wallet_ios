import BottomNav from "./BottomNav";
import Head from "next/head";

export default function Layout({ children, title = "Wallet" }: { children: React.ReactNode; title?: string }) {
  return (
    <div className="min-h-screen bg-slate-50">
      <Head><title>{title}</title></Head>
      <div className="pb-24">{children}</div>
      <BottomNav />
    </div>
  );
}
