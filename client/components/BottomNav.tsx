import Link from "next/link";
import { useRouter } from "next/router";
import { Home, History, QrCode, Compass, User } from "lucide-react";

const Item = ({ href, label, icon }: { href: string; label: string; icon: React.ReactNode }) => {
  const router = useRouter();
  const active = router.pathname === href;
  return (
    <Link href={href} className={`flex-1 text-center py-2 ${active ? "text-blue-600" : "text-slate-500"}`}>
      <div className={`mx-auto w-9 h-9 rounded-2xl ${active ? "bg-blue-100" : "bg-slate-100"} flex items-center justify-center mb-1`}>
        {icon}
      </div>
      <div className="text-xs">{label}</div>
    </Link>
  );
};

export default function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-3 py-2 flex items-end justify-between max-w-md mx-auto">
      <Item href="/" label="Главная" icon={<Home size={16} />} />
      <Item href="/history" label="История" icon={<History size={16} />} />
      <Link href="/scan" className="relative -translate-y-6">
        <div className="w-16 h-16 rounded-2xl bg-blue-600 shadow-xl flex items-center justify-center text-white text-2xl">
          <QrCode size={24} />
        </div>
      </Link>
      <Item href="/browser" label="Браузер" icon={<Compass size={16} />} />
      <Item href="/profile" label="Профиль" icon={<User size={16} />} />
    </nav>
  );
}
