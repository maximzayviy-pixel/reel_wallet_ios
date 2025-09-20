export default function InDev({title="Раздел в разработке"}:{title?:string}){
  return (<div className="bg-white rounded-2xl p-6 shadow-sm text-center">
    <img src="/update.gif" alt="dev" className="w-24 h-24 mx-auto mb-2" />
    <div className="font-semibold">{title}</div>
    <div className="text-xs text-slate-500 mt-1">Скоро станет доступно</div>
  </div>);
}