import React from 'react';
import {ArrowUpRight,BarChart3,BookOpen,CircleDollarSign,Layers,NotebookPen,Play,Plus,TrendingUp,Trophy,Wallet} from 'lucide-react';
import {TradingSession} from '../types/trading';
import {computeLiveSessionMetrics,formatMoney} from '../services/simulationEngine';
interface DashboardOverviewProps {
 name?:string;sessions:TradingSession[];activeSession:TradingSession;strategyCount:number;isLight:boolean;
 onResume:()=>void;onCreate:(mode:'BACKTESTING'|'PROP_FIRM')=>void;onNotes:()=>void;onGuide:()=>void;
}
export const DashboardOverview:React.FC<DashboardOverviewProps>=({sessions,activeSession,onResume,onCreate,onNotes,onGuide})=>{
 const currency=activeSession.frozenConfig?.accountCurrency||activeSession.accountCurrency||'USD';
 const activeMetrics=computeLiveSessionMetrics(activeSession);
 const closed=sessions.flatMap(session=>(session.positions||[]).filter(position=>position.status.startsWith('CLOSED_')).map(position=>({...position,currency:session.frozenConfig?.accountCurrency||session.accountCurrency||'USD'})));
 const net=closed.filter(trade=>trade.currency===currency).reduce((sum,trade)=>sum+trade.pnl,0);
 const active=sessions.filter(session=>(session.challengeState?.status||session.status||'ACTIVE')==='ACTIVE').length;
 const stats=[{label:'Account balance',value:formatMoney(activeMetrics.startingBalance,currency),detail:`Current: ${formatMoney(activeMetrics.currentBalance,currency)}`,icon:Wallet,tone:'blue'},{label:'Active sessions',value:String(active),icon:Layers,tone:'teal'},{label:'Closed trades',value:String(closed.length),icon:BarChart3,tone:'violet'},{label:`Net P&L · ${currency}`,value:formatMoney(net,currency,true),icon:CircleDollarSign,tone:net>=0?'cyan':'rose'}];
 return <div className="space-y-5">
  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
   <div><h2 className="text-2xl lg:text-3xl font-semibold tracking-tight">Your trading workspace</h2><p className="text-sm opacity-60 mt-2">Practice. Review. Improve.</p></div>
   <button data-tour="hub-create" onClick={()=>onCreate('BACKTESTING')} className="hub-primary inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold"><Plus className="w-4 h-4"/>New session</button>
  </div>
  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">{stats.map(({label,value,detail,icon:Icon,tone})=><div key={label} className={`hub-metric hub-tone-${tone}`}><span className="hub-metric-icon"><Icon className="w-5 h-5"/></span><div className="min-w-0"><p className="text-[11px] opacity-70 mb-1">{label}</p><strong className="block text-sm sm:text-base font-semibold tracking-tight tabular-nums whitespace-nowrap">{value}</strong>{detail&&<span className="text-[10px] opacity-60 font-mono block mt-0.5 truncate">{detail}</span>}</div></div>)}</div>
  <section className="hub-resume rounded-2xl p-4 sm:p-5"><p className="text-[10px] font-semibold uppercase tracking-wider opacity-65 mb-3">Continue where you left off</p><div className="flex flex-col sm:flex-row sm:items-center gap-4"><span className="hub-metric-icon hidden sm:flex"><TrendingUp className="w-7 h-7"/></span><div className="flex-1 min-w-0"><h3 className="text-base font-semibold tracking-tight truncate">{activeSession.name}</h3><p className="text-xs opacity-65 mt-1.5">{activeSession.mode==='PROP_FIRM'?'Prop challenge':'Normal backtesting'} · Account: {formatMoney(activeMetrics.startingBalance,currency)} (Current: {formatMoney(activeMetrics.currentBalance,currency)}) · {activeSession.strategyName||'Your trading plan'}</p></div><button onClick={onResume} className="hub-primary inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-xs font-semibold shrink-0"><Play className="w-3.5 h-3.5 fill-current"/>Resume session</button></div></section>
  <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs"><button onClick={()=>onCreate('PROP_FIRM')} className="inline-flex items-center gap-1.5 opacity-65 hover:opacity-100"><Trophy className="w-3.5 h-3.5"/>New prop challenge<ArrowUpRight className="w-3 h-3"/></button><button onClick={onNotes} className="inline-flex items-center gap-1.5 opacity-65 hover:opacity-100"><NotebookPen className="w-3.5 h-3.5"/>Your notebook<ArrowUpRight className="w-3 h-3"/></button><button onClick={onGuide} className="inline-flex items-center gap-1.5 opacity-65 hover:opacity-100"><BookOpen className="w-3.5 h-3.5"/>Getting started<ArrowUpRight className="w-3 h-3"/></button></div>
 </div>;
};
