import AdminGuard from "../../components/AdminGuard";
import Link from "next/link";

export default function AdminHome() {
  return (
    <AdminGuard>
      <div className="max-w-5xl mx-auto p-6 space-y-6">
        <h1 className="text-2xl font-semibold">Админка</h1>
        <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
          {["users","balances","webhooks","gifts","promocodes"].map(slug => (
            <Link key={slug} className="p-4 rounded-xl ring-1 ring-slate-200 bg-white hover:bg-slate-50" href={`/admin/${slug}`}>
              /admin/{slug}
            </Link>
          ))}
        </div>
      </div>
    </AdminGuard>
  );
}
