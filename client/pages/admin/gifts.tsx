import AdminGuard from "../../components/AdminGuard";
import AdminTable from "../../components/AdminTable";

export default function AdminGifts(){
  return (
    <AdminGuard>
      <div className="max-w-6xl mx-auto p-6 space-y-4">
        <h1 className="text-xl font-semibold">Gifts / Orders</h1>
        <AdminTable
          fetchUrl="/api/admin/gifts-orders"
          columns={[
            { key: "id", title: "ID" },
            { key: "tg_id", title: "TG" },
            { key: "gift_id", title: "Gift" },
            { key: "price", title: "Цена" },
            { key: "status", title: "Статус" },
            { key: "created_at", title: "Создано" },
          ]}
        />
      </div>
    </AdminGuard>
  );
}
