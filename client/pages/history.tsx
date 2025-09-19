import Layout from "../components/Layout";

export default function History() {
  return (
    <Layout title="История">
      <div className="max-w-md mx-auto px-4 pt-10">
        <div className="bg-white rounded-2xl p-6 shadow-sm">
          <div className="text-sm text-slate-500 mb-2">История транзакций</div>
          <div className="text-slate-700">Здесь будут отображаться все ваши финансовые операции</div>
          <button className="mt-6 w-full bg-blue-600 text-white rounded-2xl py-3">+ Пополнить кошелёк</button>
        </div>
      </div>
    </Layout>
  );
}
