import {useMemo,useState} from 'react';
import {AdminUser} from '../services/platformAccounts';
import {inSignupRange,signupBounds,SignupRange,southAfricaDay} from '../services/adminReporting';
const options:[SignupRange,string][]=[['today','Today'],['yesterday','Yesterday'],['tomorrow','Tomorrow'],['month','This month'],['lastMonth','Last month'],['year','This year'],['lastYear','Last year'],['all','All time'],['custom','Custom dates']];
export function AdminAnalytics({users}:{users:AdminUser[]}){
 const [range,setRange]=useState<SignupRange>('month'),[from,setFrom]=useState(southAfricaDay(Date.now()-30*86400000)),[to,setTo]=useState(southAfricaDay(Date.now()));
 const bounds=signupBounds(range,Date.now(),from,to),invalid=range==='custom'&&(!from||!to||from>to);
 const selected=invalid?[]:users.filter(user=>inSignupRange(user.joinedAt,bounds));
 const buckets=useMemo(()=>{
  if(invalid)return [];
  const validDates=users.map(user=>Date.parse(user.joinedAt)).filter(Number.isFinite);
  const first=bounds.from||(validDates.length?southAfricaDay(Math.min(...validDates)):southAfricaDay(Date.now()));
  const last=bounds.to||southAfricaDay(Date.now());
  const firstTime=Date.parse(`${first}T00:00:00+02:00`),lastTime=Date.parse(`${last}T00:00:00+02:00`);
  const monthly=(lastTime-firstTime)/86400000>62;
  const values=new Map<string,number>();
  if(monthly){let y=Number(first.slice(0,4)),m=Number(first.slice(5,7));while(`${y}-${String(m).padStart(2,'0')}`<=last.slice(0,7)&&values.size<1200){values.set(`${y}-${String(m).padStart(2,'0')}`,0);if(++m>12){m=1;y++;}}}
  else for(let time=firstTime;time<=lastTime;time+=86400000)values.set(southAfricaDay(time),0);
  selected.forEach(user=>{const day=southAfricaDay(user.joinedAt),key=monthly?day.slice(0,7):day;values.set(key,(values.get(key)||0)+1);});
  return [...values].map(([key,count])=>({key,count,label:monthly?new Intl.DateTimeFormat('en-ZA',{month:'short',year:'2-digit',timeZone:'Africa/Johannesburg'}).format(new Date(`${key}-01T12:00:00+02:00`)):key.slice(5)}));
 },[users,range,from,to]);
 const largest=Math.max(1,...buckets.map(item=>item.count));
 const recent=[...selected].sort((a,b)=>Date.parse(b.joinedAt)-Date.parse(a.joinedAt)).slice(0,5);
 return <section className="mt-6 space-y-5"><div className="flex flex-wrap items-end justify-between gap-5"><div><h2 className="text-xl font-semibold">Signup analytics</h2><p className="mt-2 text-xs text-slate-400">Explore registrations by date · South African time (SAST)</p></div><label className="text-xs text-slate-400">Reporting period<select aria-label="Signup reporting period" value={range} onChange={event=>setRange(event.target.value as SignupRange)} className="ml-3 rounded-xl border border-white/10 bg-[#111b29] px-4 py-3 text-slate-200">{options.map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label></div>
 {range==='custom'&&<div className="flex flex-wrap gap-4 text-xs text-slate-400"><label>From<input aria-label="Signup start date" type="date" value={from} onChange={event=>setFrom(event.target.value)} className="ml-2 rounded-lg bg-slate-800 p-2 text-white"/></label><label>To<input aria-label="Signup end date" type="date" value={to} onChange={event=>setTo(event.target.value)} className="ml-2 rounded-lg bg-slate-800 p-2 text-white"/></label></div>}
 {invalid&&<p role="alert" className="text-sm text-rose-300">Choose a valid date range with the start on or before the end.</p>}
 {range==='tomorrow'&&<p className="rounded-xl border border-cyan-400/20 bg-cyan-400/5 p-4 text-xs text-cyan-200">Tomorrow is a future date. Signups will appear when they happen; this is not a forecast.</p>}
 <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">{[['Signups in this period',selected.length],['Registered users · all time',users.length],['Successful logins · all time',users.reduce((sum,user)=>sum+(user.loginCount||0),0)],['Replay sessions · all time',users.reduce((sum,user)=>sum+(user.sessionCount||0),0)]].map(([label,value])=><div key={label} className="rounded-2xl border border-white/10 bg-gradient-to-br from-emerald-400/10 to-cyan-400/[0.02] p-5"><p className="text-xs text-slate-400">{label}</p><p className="mt-3 text-3xl font-semibold text-emerald-200">{value}</p></div>)}</div>
 <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 sm:p-6"><div className="flex justify-between gap-3"><h3 className="font-semibold text-sm">Registrations over time</h3><span className="text-xs text-slate-500">{bounds.from||'First signup'} → {bounds.to||'Today'}</span></div><div className="mt-7 overflow-x-auto"><div role="img" aria-label={`Signup chart: ${selected.length} registrations in the selected period`} className="flex h-56 gap-2 items-end" style={{minWidth:Math.max(300,buckets.length*32)}}>{buckets.map(item=><div key={item.key} className="flex flex-1 h-full min-w-6 flex-col items-center justify-end"><span className="text-[10px] text-slate-400 mb-2">{item.count}</span><div title={`${item.key}: ${item.count} signups`} className="w-full max-w-12 rounded-t bg-gradient-to-t from-emerald-500/30 to-cyan-300/80" style={{height:item.count?`${Math.max(5,item.count/largest*150)}px`:'2px'}}/><span className="mt-3 whitespace-nowrap text-[9px] text-slate-500">{item.label}</span></div>)}</div></div>{!selected.length&&<p className="mt-4 text-sm text-slate-500">No signups recorded for this period.</p>}</div>
 <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5"><h3 className="font-semibold text-sm">Latest registrations in this period</h3><div className="mt-4 divide-y divide-white/5">{recent.map(user=><div key={user.id} className="flex flex-wrap justify-between gap-2 py-3 text-xs"><span className="text-slate-200">{user.name}<span className="ml-3 text-slate-500">{user.email}</span></span><span className="text-slate-500">{southAfricaDay(user.joinedAt)}</span></div>)}{!recent.length&&<p className="text-xs text-slate-500">No registrations to display.</p>}</div></div>
 </section>;
}
