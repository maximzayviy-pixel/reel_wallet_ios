import AdminGuard from "../../components/AdminGuard";
import AdminTable from "../../components/AdminTable";

export default function AdminWebhooks(){
  return (
    <AdminGuard>
      <div className="max-w-6xl mx-auto p-6 space-y-4">
        <h1 className="text-xl font-semibold">Webhook logs</h1>
        <AdminTable
          fetchUrl="/api/admin/webhook-logs"
          columns={[
            { key: "id", title: "ID" },
            { key: "event", title: "Событие" },
            { key: "status", title: "Статус" },
            { key: "payload", title: "Payload" },
            { key: "created_at", title: "Создано" },
          ]}
        />
      </div>
    </AdminGuard>
  );
}
