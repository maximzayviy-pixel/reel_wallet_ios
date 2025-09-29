import BottomNav from "./BottomNav";
import Head from "next/head";
import useBanRedirect from "../lib/useBanRedirect";

export default function Layout({ children, title = "Reel Wallet" }: { children: React.ReactNode; title?: string }) {
  // Globally enforce ban redirection. This hook checks the current user's ban
  // status via `/api/user-info` and navigates to `/banned` if needed. It
  // gracefully does nothing when executed on the banned page itself.
  useBanRedirect();
  return (
    <div className="min-h-screen bg-slate-50">
      <Head><title>{title}</title></Head>
      <div className="pb-24">{children}</div>
      <BottomNav />
    </div>
  );
}