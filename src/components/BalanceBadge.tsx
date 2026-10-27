import React from 'react';
import {Eye,EyeOff,Wallet} from 'lucide-react';
import {AccountCurrency} from '../types/trading';
import {formatMoney} from '../services/simulationEngine';
const CURRENCIES: { code: AccountCurrency; label: string }[] = [
  { code: 'USD', label: 'USD ($)' },
  { code: 'ZAR', label: 'ZAR (R)' },
  { code: 'EUR', label: 'EUR (€)' },
  { code: 'GBP', label: 'GBP (£)' },
  { code: 'AUD', label: 'AUD (A$)' },
  { code: 'CAD', label: 'CAD (C$)' },
  { code: 'JPY', label: 'JPY (¥)' },
];
export const BalanceBadge:React.FC<{balance:number;equity:number;currency:AccountCurrency;hidden:boolean;onToggle:()=>void;onChangeCurrency?:(currency:AccountCurrency)=>void;isLight:boolean;className?:string}>=({balance,equity,currency,hidden,onToggle,onChangeCurrency,isLight,className=''})=><div className={`items-center gap-2 rounded-lg border px-2 py-1 ${isLight?'bg-gradient-to-r from-emerald-50 to-cyan-50 border-emerald-200 text-slate-800':'bg-gradient-to-r from-emerald-500/10 to-cyan-500/10 border-emerald-500/20 text-slate-100'} ${className}`} aria-label="Simulated balance and equity"><Wallet className="w-3.5 h-3.5 text-emerald-500 shrink-0"/>{onChangeCurrency&&<select aria-label="Account currency" title="Switch account currency (USD, ZAR South African Rand, EUR, GBP, etc.)" value={currency} onChange={e=>onChangeCurrency(e.target.value as AccountCurrency)} className={`text-[10px] font-mono font-bold rounded px-1 py-0.5 border outline-none cursor-pointer ${isLight?'bg-white/80 border-emerald-200 text-emerald-900':'bg-[#0d141d] border-emerald-500/30 text-emerald-300'}`}>{CURRENCIES.map(c=><option key={c.code} value={c.code} className={isLight?'bg-white text-slate-900':'bg-[#0d141d] text-slate-100'}>{c.label}</option>)}</select>}<div className="font-mono text-[10px] whitespace-nowrap"><span className="text-[8px] font-sans font-semibold opacity-60 mr-1">BAL</span><strong>{hidden?'••••••':formatMoney(balance,currency)}</strong></div><span className="w-px h-4 bg-slate-500/20"/><div className="font-mono text-[10px] whitespace-nowrap"><span className="text-[8px] font-sans font-semibold opacity-60 mr-1">EQ</span><strong className={!hidden&&equity<balance?'text-rose-500':!hidden&&equity>balance?'text-emerald-500':''}>{hidden?'••••••':formatMoney(equity,currency)}</strong></div><button type="button" onClick={onToggle} aria-label={hidden?'Show balance and equity':'Hide balance and equity'} aria-pressed={hidden} title={hidden?'Show balance and equity':'Hide balance and equity'} className="p-1 rounded-md hover:bg-emerald-500/10 shrink-0">{hidden?<EyeOff className="w-3.5 h-3.5"/>:<Eye className="w-3.5 h-3.5"/>}</button></div>;
