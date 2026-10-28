import React from 'react';
import {ArrowUpRight,BarChart3,BookOpen,CircleDollarSign,Layers,NotebookPen,Play,Plus,TrendingUp,Trophy,Wallet} from 'lucide-react';
import {AccountCurrency,TradingSession} from '../types/trading';
import {computeLiveSessionMetrics,convertBetweenAccountCurrencies,formatMoney} from '../services/simulationEngine';
interface DashboardOverviewProps {
 name?:string;sessions:TradingSession[];activeSession:TradingSession;strategyCount:number;isLight:boolean;
 onResume:()=>void;onCreate:(mode:'BACKTESTING'|'PROP_FIRM')=>void;onNotes:()=>void;onGuide:()=>void;onChangeCurrency?:(currency:AccountCurrency)=>void;
}
export const DashboardOverview:React.FC<DashboardOverviewProps>=({sessions,activeSession,onResume,onCreate,onNotes,onGuide,onChangeCurrency})=>{
 const hasSessions=sessions.length>0;
 const currency=activeSession.frozenConfig?.accountCurrency||activeSession.accountCurrency||'USD';
 const activeMetrics=computeLiveSessionMetrics(activeSession);
 const closed=sessions.flatMap(session=>(session.positions||[]).filter(position=>position.status.startsWith('CLOSED_')).map(position=>({...position,currency:session.frozenConfig?.accountCurrency||session.accountCurrency||'USD'})));
 const net=closed.reduce((sum,trade)=>sum+convertBetweenAccountCurrencies(trade.pnl,trade.currency,currency),0);
 const active=sessions.filter(session=>(session.challengeState?.status||session.status||'ACTIVE')==='ACTIVE').length;
 const stats=[
  {label:'Account balance',value:formatMoney(hasSessions?activeMetrics.startingBalance:0,currency),detail:hasSessions?`Current: ${formatMoney(activeMetrics.currentBalance,currency)}`:'Create a session to start',icon:Wallet,tone:'blue'},
  {label:'Active sessions',value:String(active),icon:Layers,tone:'teal'},
  {label:'Closed trades',value:String(closed.length),icon:BarChart3,tone:'violet'},
  {label:`Net P&L · ${currency}`,value:formatMoney(net,currency,true),icon:CircleDollarSign,tone:net>=0?'cyan':'rose'}
 ];
 return <div className="space-y-4 sm:space-y-5 min-w-0 max-w-full">
  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 min-w-0">
   <div className="min-w-0"><h2 className="text-xl sm:text-2xl lg:text-3xl font-semibold tracking-tight truncate">Your trading workspace</h2><p className="text-xs sm:text-sm opacity-60 mt-1 sm:mt-2">Practice. Review. Improve.</p></div>
   <div className="flex flex-wrap items-center gap-2 shrink-0">
    {onChangeCurrency&&hasSessions&&<div className="inline-flex items-center rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-0.5 text-xs font-mono font-bold"><button type="button" onClick={()=>onChangeCurrency('USD')} className={`px-2.5 py-1.5 rounded-lg transition ${currency==='USD'?'bg-emerald-600 text-white shadow':'opacity-75 hover:opacity-100'}`}>USD ($)</button><button type="button" onClick={()=>onChangeCurrency('ZAR')} className={`px-2.5 py-1.5 rounded-lg transition ${currency==='ZAR'?'bg-emerald-600 text-white shadow':'opacity-75 hover:opacity-100'}`}>ZAR (R)</button></div>}
    <button data-tour="hub-create" onClick={()=>onCreate('BACKTESTING')} className="hub-primary inline-flex items-center justify-center gap-2 rounded-xl px-4 sm:px-5 py-2.5 sm:py-3 text-xs sm:text-sm font-semibold shrink-0"><Plus className="w-4 h-4"/>New session</button>
   </div>
  </div>
  <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3 min-w-0">{stats.map(({label,value,detail,icon:Icon,tone})=><div key={label} className={`hub-metric hub-tone-${tone}`}><span className="hub-metric-icon"><Icon className="w-4 h-4 sm:w-5 sm:h-5"/></span><div className="min-w-0 flex-1"><p className="text-[10px] sm:text-[11px] opacity-70 mb-0.5 sm:mb-1 truncate">{label}</p><strong className="block text-xs sm:text-base font-semibold tracking-tight tabular-nums truncate">{value}</strong>{detail&&<span className="text-[9px] sm:text-[10px] opacity-60 font-mono block mt-0.5 truncate">{detail}</span>}</div></div>)}</div>
  {hasSessions?(
   <section className="hub-resume rounded-2xl p-3.5 sm:p-5 min-w-0"><p className="text-[10px] font-semibold uppercase tracking-wider opacity-65 mb-2 sm:mb-3">Continue where you left off</p><div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 min-w-0"><span className="hub-metric-icon hidden sm:flex"><TrendingUp className="w-7 h-7"/></span><div className="flex-1 min-w-0"><h3 className="text-sm sm:text-base font-semibold tracking-tight truncate">{activeSession.name}</h3><p className="text-[11px] sm:text-xs opacity-65 mt-1 break-words">{activeSession.mode==='PROP_FIRM'?'Prop challenge':'Normal backtesting'} · Account: {formatMoney(activeMetrics.startingBalance,currency)} (Current: {formatMoney(activeMetrics.currentBalance,currency)}) · {activeSession.strategyName||'Your trading plan'}</p></div><button onClick={onResume} className="hub-primary inline-flex items-center justify-center gap-2 rounded-xl px-4 sm:px-5 py-2.5 sm:py-3 text-xs font-semibold shrink-0"><Play className="w-3.5 h-3.5 fill-current"/>Resume session</button></div></section>
  ):(
   <section className="hub-resume rounded-2xl p-3.5 sm:p-5 min-w-0"><p className="text-[10px] font-semibold uppercase tracking-wider opacity-65 mb-2 sm:mb-3">Get started</p><div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 min-w-0"><span className="hub-metric-icon hidden sm:flex"><TrendingUp className="w-7 h-7"/></span><div className="flex-1 min-w-0"><h3 className="text-sm sm:text-base font-semibold tracking-tight truncate">Create your first trading session</h3><p className="text-[11px] sm:text-xs opacity-65 mt-1 break-words">You don&apos;t have any sessions yet. Create your own Backtesting or Prop Firm Challenge session to choose your instruments, starting capital, and trading plan.</p></div><button onClick={()=>onCreate('BACKTESTING')} className="hub-primary inline-flex items-center justify-center gap-2 rounded-xl px-4 sm:px-5 py-2.5 sm:py-3 text-xs font-semibold shrink-0"><Plus className="w-3.5 h-3.5"/>Create New Session</button></div></section>
  )}
  <div className="flex flex-wrap gap-x-4 sm:gap-x-5 gap-y-2 text-xs"><button onClick={()=>onCreate('PROP_FIRM')} className="inline-flex items-center gap-1.5 opacity-65 hover:opacity-100"><Trophy className="w-3.5 h-3.5"/>New prop challenge<ArrowUpRight className="w-3 h-3"/></button><button onClick={onNotes} className="inline-flex items-center gap-1.5 opacity-65 hover:opacity-100"><NotebookPen className="w-3.5 h-3.5"/>Your notebook<ArrowUpRight className="w-3 h-3"/></button><button onClick={onGuide} className="inline-flex items-center gap-1.5 opacity-65 hover:opacity-100"><BookOpen className="w-3.5 h-3.5"/>Getting started<ArrowUpRight className="w-3 h-3"/></button></div>
 </div>;
};
