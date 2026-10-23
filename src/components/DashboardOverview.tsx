import React from 'react';
import {ArrowUpRight, BookOpen, Compass, FolderKanban, NotebookPen, Play, Plus, Trophy} from 'lucide-react';
import {TradingSession} from '../types/trading';

interface DashboardOverviewProps {
  name?:string; sessions:TradingSession[]; strategyCount:number; isLight:boolean;
  onResume:()=>void; onCreate:(mode:'BACKTESTING'|'PROP_FIRM')=>void;
  onNotes:()=>void; onGuide:()=>void;
}

export const DashboardOverview:React.FC<DashboardOverviewProps>=({name,sessions,strategyCount,isLight,onResume,onCreate,onNotes,onGuide})=>{
  const surface=isLight?'bg-white border-slate-200':'bg-[#131922] border-white/[0.08]';
  const closed=sessions.reduce((total,session)=>total+(session.positions||[]).filter(position=>position.status.startsWith('CLOSED_')).length,0);
  const stats=[{label:'Practice sessions',value:sessions.length,icon:FolderKanban},{label:'Completed trades',value:closed,icon:BookOpen},{label:'Strategy playbooks',value:strategyCount,icon:Compass}];
  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pt-1">
        <div>
          <p className={`text-[10px] font-bold tracking-[.18em] uppercase mb-2 ${isLight?'text-emerald-700':'text-emerald-400'}`}>Your trading workspace</p>
          <h2 className="text-2xl lg:text-3xl font-semibold tracking-tight">Welcome back{name?.trim()?`, ${name.trim().split(/\s+/)[0]}`:''}.</h2>
          <p className="text-xs sm:text-sm opacity-60 mt-2">A clear plan. A little practice. Steady progress.</p>
        </div>
        <button onClick={onResume} className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 px-4 py-2.5 text-xs font-bold transition-colors shrink-0"><Play className="w-3.5 h-3.5 fill-current" />Continue trading<ArrowUpRight className="w-3.5 h-3.5 ml-1" /></button>
      </div>
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {stats.map(({label,value,icon:Icon})=><div key={label} className={`rounded-2xl border p-3 sm:p-4 ${surface}`}><div className="flex items-center justify-between gap-2"><span className="text-[10px] sm:text-xs opacity-60">{label}</span><Icon className="hidden sm:block w-4 h-4 opacity-40" aria-hidden="true" /></div><div className="text-2xl font-semibold tracking-tight tabular-nums mt-2">{value.toLocaleString()}</div></div>)}
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        <button onClick={()=>onCreate('BACKTESTING')} className={`group p-4 sm:p-5 rounded-2xl border text-left transition-colors hover:border-emerald-500/50 ${surface}`}>
          <div className="flex justify-between items-start"><span className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-500"><Compass className="w-5 h-5" /></span><ArrowUpRight className="w-4 h-4 opacity-35 group-hover:opacity-100" /></div>
          <h3 className="text-base font-semibold mt-4 tracking-tight">Backtest a strategy</h3><p className="text-xs leading-relaxed opacity-60 mt-1.5 max-w-sm">Replay the market, refine your entries, and build a repeatable process.</p>
          <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold mt-4 ${isLight?'text-emerald-700':'text-emerald-400'}`}><Plus className="w-3 h-3" />New practice session</span>
        </button>
        <button onClick={()=>onCreate('PROP_FIRM')} className={`group p-4 sm:p-5 rounded-2xl border text-left transition-colors hover:border-amber-500/50 ${surface}`}>
          <div className="flex justify-between items-start"><span className="p-2.5 rounded-xl bg-amber-500/10 text-amber-500"><Trophy className="w-5 h-5" /></span><ArrowUpRight className="w-4 h-4 opacity-35 group-hover:opacity-100" /></div>
          <h3 className="text-base font-semibold mt-4 tracking-tight">Take on a challenge</h3><p className="text-xs leading-relaxed opacity-60 mt-1.5 max-w-sm">Practice with profit targets, drawdown limits, and a structured evaluation.</p>
          <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold mt-4 ${isLight?'text-amber-700':'text-amber-400'}`}><Plus className="w-3 h-3" />New prop challenge</span>
        </button>
      </div>
      <div className={`grid sm:grid-cols-2 gap-px rounded-xl overflow-hidden border ${isLight?'border-slate-200 bg-slate-200':'border-white/[0.08] bg-white/[0.08]'}`}>
        {[{title:'Your notebook',detail:'Capture ideas and lessons',icon:NotebookPen,action:onNotes},{title:'Getting started',detail:'Find your way around the platform',icon:BookOpen,action:onGuide}].map(({title,detail,icon:Icon,action})=><button key={title} onClick={action} className={`flex items-center gap-3 p-3.5 text-left transition-colors ${isLight?'bg-white hover:bg-slate-50':'bg-[#111720] hover:bg-[#18212c]'}`}><Icon className="w-4 h-4 opacity-50 shrink-0" /><span className="flex-1"><span className="block text-xs font-semibold">{title}</span><span className="block text-[11px] opacity-50 mt-0.5">{detail}</span></span><ArrowUpRight className="w-3.5 h-3.5 opacity-40" /></button>)}
      </div>
    </div>
  );
};
