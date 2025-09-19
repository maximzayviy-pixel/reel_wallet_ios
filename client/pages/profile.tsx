import Layout from "../components/Layout";

export default function Profile() {
  return (
    <Layout title="Профиль">
      <div className="max-w-md mx-auto px-4 pt-8 space-y-4">
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-full bg-slate-200"></div>
            <div>
              <div className="font-semibold">@pravy_ru</div>
              <div className="text-xs text-slate-500">Новичок</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 mt-4">
            <div className="bg-slate-50 rounded-xl p-3">
              <div className="text-xs text-slate-500">KYC верификация</div>
              <div className="text-sm font-medium">Пройдено</div>
            </div>
            <div className="bg-slate-50 rounded-xl p-3">
              <div className="text-xs text-slate-500">@</div>
              <div className="text-sm font-medium">wusva@vk.com</div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <div className="font-semibold mb-2">ПАРАМЕТРЫ</div>
          {[
            {title: "Безопасность"}, {title:"Язык", right:"Русский"}, {title:"Устройства", right:"1"}
          ].map((it, i)=>(
            <div key={i} className="py-3 border-t border-slate-100 flex items-center justify-between">
              <div>{it.title}</div><div className="text-slate-500 text-sm">{it.right || "›"}</div>
            </div>
          ))}
        </div>
      </div>
    </Layout>
  );
}
