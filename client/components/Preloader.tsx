export default function Preloader({fullscreen=false}:{fullscreen?:boolean}){
  return (<div className={fullscreen? "fixed inset-0 z-50 flex items-center justify-center bg-white" : "py-6 flex items-center justify-center"}>
    <img src="/update.gif" alt="loading" className="w-24 h-24 object-contain opacity-90" />
  </div>);
}