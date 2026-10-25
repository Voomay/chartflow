import {ReactNode,useEffect,useRef} from 'react';
export function AnimatedOrderPanel({open,mobile,onClose,children}:{open:boolean;mobile:boolean;onClose:()=>void;children:ReactNode}){
 const root=useRef<HTMLDivElement>(null);
 useEffect(()=>{if(root.current)root.current.inert=!open;},[open]);
 return <div ref={root} id="chart-order-panel" aria-hidden={!open} data-open={open} className={mobile?'order-panel-mobile':'order-panel-desktop'} onClick={event=>{if(mobile&&event.target===event.currentTarget)onClose();}}>
   <div className={mobile?'order-panel-mobile-body':'order-panel-desktop-body'}>
     {mobile&&<button type="button" onClick={onClose} className="ml-auto mr-3 mb-2 block rounded-full border border-slate-500/40 bg-[#192433] px-4 py-2 text-xs font-semibold text-slate-200">Close order panel ×</button>}
     <div className={mobile?'h-[75dvh] flex flex-col [&>aside]:!w-full [&>aside]:border-l-0 [&>aside]:border-t [&>aside]:rounded-t-3xl':''}>{children}</div>
   </div>
 </div>;
}
