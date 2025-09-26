import AdminGuard from "../../components/AdminGuard";
import AdminTable from "../../components/AdminTable";

export default function AdminBalances(){
  return (
    <AdminGuard>
      <div className="max-w-6xl mx-auto p-6 space-y-4">
        <h1 className="text-xl font-semibold">Balances (ledger)</h1>
        <AdminTable
          fetchUrl="/api/admin/balances"
          columns={[
            { key: "id", title: "ID" },
            { key: "tg_id", title: "TG" },
            { key: "amount", title: "Сумма" },
            { key: "currency", title: "Валюта" },
            { key: "reason", title: "Причина" },
            { key: "created_at", title: "Создано" },
          ]}
        />
      </div>
    </AdminGuard>
  );
}
