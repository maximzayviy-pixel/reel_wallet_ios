import Layout from "../components/Layout";
export default function Browser(){
  return (<Layout title="Витрина подарков">
    <div className="min-h-[60vh] flex flex-col items-center justify-center text-center p-6">
      <img src="/update.gif" className="w-28 h-28 mb-3" />
      <div className="text-lg font-semibold">Раздел в разработке</div>
      <div className="text-sm text-slate-500">Следите за обновлениями</div>
    </div>
  </Layout>);
}