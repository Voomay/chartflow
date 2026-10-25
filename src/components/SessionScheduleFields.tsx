import React, {useEffect, useRef, useState} from 'react';
import {Calendar, Check, ChevronDown, ChevronLeft, ChevronRight, Clock, Globe2, X} from 'lucide-react';
import {DisplayTimezone} from '../types/trading';

interface Props {
  start: string; end: string; time: string; timezone: DisplayTimezone;
  onStart: (value:string)=>void; onEnd: (value:string)=>void;
  onTime: (value:string)=>void; onTimezone: (value:DisplayTimezone)=>void;
  zones: {value:DisplayTimezone;label:string}[];
}
const months=['January','February','March','April','May','June','July','August','September','October','November','December'];
const iso=(date:Date)=>date.toISOString().slice(0,10);
const parse=(value:string)=>new Date(value+'T00:00:00Z');
const pretty=(value:string)=>new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}).format(parse(value));
export function SessionScheduleFields({start,end,time,timezone,onStart,onEnd,onTime,onTimezone,zones}:Props) {
  const [open,setOpen]=useState<'start'|'end'|'time'|'zone'|null>(null);
  const [month,setMonth]=useState(()=>parse(start));
  const [view,setView]=useState<'days'|'months'|'years'>('days');
  const [hour,setHour]=useState('08'); const [minute,setMinute]=useState('00');
  const dialog=useRef<HTMLDialogElement>(null);
  const today=new Date().toLocaleDateString('en-CA');
  const min=open==='end'?start:'2010-01-01';
  const selected=open==='end'?end:start;
  const launch=(type:typeof open)=>{
    setView('days'); setMonth(parse(type==='end'?end:start));
    const [h,m]=time.split(':');setHour(h);setMinute(m);setOpen(type);
  };
  useEffect(()=>{
    if(!open)return;
    const node=dialog.current;node?.showModal();return()=>node?.close();
  },[open]);
  const choose=(value:string)=>{ if(value<min||value>today)return; (open==='end'?onEnd:onStart)(value);setOpen(null); };
  const changeMonth=(delta:number)=>setMonth(new Date(Date.UTC(month.getUTCFullYear(),month.getUTCMonth()+delta,1)));
  const first=new Date(Date.UTC(month.getUTCFullYear(),month.getUTCMonth(),1));
  const offset=(first.getUTCDay()+6)%7;
  const days=Array.from({length:42},(_,index)=>new Date(Date.UTC(month.getUTCFullYear(),month.getUTCMonth(),index-offset+1)));
  const field='group w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-left transition hover:border-slate-200 hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400';
  const label='mb-1.5 block text-[10px] font-medium text-slate-600';
  const numberInput='w-20 rounded-xl border border-slate-200 bg-white py-3 text-center text-2xl font-semibold tabular-nums text-slate-900 focus:border-emerald-400 focus:outline-none';
  const title=open==='start'?'Trade from':open==='end'?'Trade until':open==='time'?'Start time':'Chart timezone';
  return <>
    <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3 sm:p-4">
      <div className="mb-3 flex items-center gap-2 text-[11px] text-slate-600"><Calendar className="h-3.5 w-3.5"/>Your practice schedule</div>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <button type="button" aria-label={`Trade from: ${start}`} onClick={()=>launch('start')} className={field}><span className={label}>Trade from</span><span className="flex items-center justify-between gap-1 text-xs font-semibold text-slate-900">{pretty(start)}<Calendar className="h-3.5 w-3.5 shrink-0 text-slate-500"/></span></button>
        <button type="button" aria-label={`Trade until: ${end}`} onClick={()=>launch('end')} className={field}><span className={label}>Trade until</span><span className="flex items-center justify-between gap-1 text-xs font-semibold text-slate-900">{pretty(end)}<Calendar className="h-3.5 w-3.5 shrink-0 text-slate-500"/></span></button>
        <button type="button" aria-label={`Start time: ${time} UTC`} onClick={()=>launch('time')} className={field}><span className={label}>Start time · UTC</span><span className="flex items-center justify-between gap-1 text-xs font-semibold text-slate-900">{time}<Clock className="h-3.5 w-3.5 text-slate-500"/></span></button>
        <button type="button" aria-label="Chart timezone" onClick={()=>launch('zone')} className={field}><span className={label}>Chart timezone</span><span className="flex items-center justify-between gap-1 text-xs font-semibold text-slate-900"><span className="truncate">{zones.find(zone=>zone.value===timezone)?.label||timezone}</span><ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-500"/></span></button>
      </div>
      <p className="mt-2.5 text-[10px] leading-relaxed text-slate-500">Replay starts at the UTC time above. Chart timezone controls displayed session times.</p>
    </div>
    {open && <dialog ref={dialog} aria-labelledby="schedule-picker-title" onCancel={event=>{event.preventDefault();setOpen(null);}} className="schedule-picker w-[340px] max-w-[calc(100vw-24px)] rounded-2xl border border-slate-200 bg-white p-4 text-slate-900 shadow-2xl">
      <div className="mb-4 flex items-center justify-between"><h3 id="schedule-picker-title" className="text-sm font-semibold">{title}</h3><button type="button" aria-label="Close date and time picker" onClick={()=>setOpen(null)} className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100 hover:text-slate-900"><X className="h-4 w-4"/></button></div>
      {(open==='start'||open==='end') && <>
        <div className="mb-3 flex items-center justify-between gap-1">
          <button type="button" aria-label="Previous month" onClick={()=>changeMonth(-1)} disabled={iso(first).slice(0,7)<=min.slice(0,7)} className="rounded-lg p-2 hover:bg-slate-100 disabled:opacity-20"><ChevronLeft className="h-4 w-4"/></button>
          <div className="flex gap-1"><button type="button" onClick={()=>setView(view==='months'?'days':'months')} className="rounded-lg px-2 py-1.5 text-xs font-semibold hover:bg-slate-100">{months[month.getUTCMonth()]}</button><button type="button" aria-label="Choose year" onClick={()=>setView(view==='years'?'days':'years')} className="rounded-lg px-2 py-1.5 text-xs font-semibold text-teal-700 hover:bg-slate-100">{month.getUTCFullYear()}</button></div>
          <button type="button" aria-label="Next month" onClick={()=>changeMonth(1)} disabled={iso(first).slice(0,7)>=today.slice(0,7)} className="rounded-lg p-2 hover:bg-slate-100 disabled:opacity-20"><ChevronRight className="h-4 w-4"/></button>
        </div>
        {view==='years' ? <div className="grid max-h-64 grid-cols-4 gap-1 overflow-y-auto">{Array.from({length:parse(today).getUTCFullYear()-2010+1},(_,i)=>2010+i).map(year=><button type="button" key={year} disabled={year<parse(min).getUTCFullYear()} onClick={()=>{setMonth(new Date(Date.UTC(year,month.getUTCMonth(),1)));setView('months');}} className="rounded-lg py-2.5 text-xs hover:bg-teal-50 disabled:opacity-20">{year}</button>)}</div> : view==='months' ? <div className="grid grid-cols-3 gap-1">{months.map((name,index)=><button type="button" key={name} disabled={`${month.getUTCFullYear()}-${String(index+1).padStart(2,'0')}`<min.slice(0,7)||`${month.getUTCFullYear()}-${String(index+1).padStart(2,'0')}`>today.slice(0,7)} onClick={()=>{setMonth(new Date(Date.UTC(month.getUTCFullYear(),index,1)));setView('days');}} className="rounded-lg py-3 text-xs hover:bg-teal-50 disabled:opacity-20">{name.slice(0,3)}</button>)}</div> : <>
          <div className="mb-1 grid grid-cols-7 text-center text-[10px] text-slate-500">{['Mo','Tu','We','Th','Fr','Sa','Su'].map(day=><span key={day} className="py-1">{day}</span>)}</div>
          <div className="grid grid-cols-7 gap-1">{days.map(date=>{const value=iso(date);return <button type="button" key={value} aria-label={value} aria-pressed={value===selected} disabled={value<min||value>today} onClick={()=>choose(value)} className={`rounded-lg py-2 text-xs tabular-nums transition disabled:opacity-15 ${value===selected?'bg-emerald-400 font-bold text-slate-950':date.getUTCMonth()!==month.getUTCMonth()?'text-slate-600 hover:bg-slate-100':'text-slate-800 hover:bg-teal-50'} ${value===today&&value!==selected?'ring-1 ring-inset ring-emerald-500/60':''}`}>{date.getUTCDate()}</button>;})}</div>
        </>}
        <div className="mt-3 flex items-center justify-between border-t border-slate-200 pt-3 text-[11px]"><span className="text-slate-500">{selected}</span><button type="button" onClick={()=>choose(today)} className="rounded-lg px-2 py-1 text-teal-700 hover:bg-emerald-400/10">Today</button></div>
      </>}
      {open==='time' && <>
        <p className="mb-4 text-xs text-slate-600">Choose an exact replay start time in UTC.</p>
        <div className="flex items-center justify-center gap-3"><label className="text-center"><span className="mb-2 block text-[10px] text-slate-500">Hour</span><input aria-label="Start hour" inputMode="numeric" maxLength={2} value={hour} onChange={event=>setHour(event.target.value.replace(/[^0-9]/g,''))} className={numberInput}/></label><span className="pt-5 text-2xl text-slate-500">:</span><label className="text-center"><span className="mb-2 block text-[10px] text-slate-500">Minute</span><input aria-label="Start minute" inputMode="numeric" maxLength={2} value={minute} onChange={event=>setMinute(event.target.value.replace(/[^0-9]/g,''))} className={numberInput}/></label></div>
        <div className="mt-5 grid grid-cols-6 gap-1">{Array.from({length:24},(_,i)=>String(i).padStart(2,'0')).map(value=><button type="button" key={value} aria-label={`Hour ${value}`} onClick={()=>setHour(value)} className={`rounded-lg py-2 text-xs ${Number(hour)===Number(value)?'bg-emerald-400 text-slate-950':'bg-slate-100 text-slate-600 hover:bg-teal-50'}`}>{value}</button>)}</div>
        <div className="mt-3 flex justify-center gap-2">{['00','15','30','45'].map(value=><button type="button" key={value} aria-label={`Minute ${value}`} onClick={()=>setMinute(value)} className={`rounded-lg px-3 py-1.5 text-xs ${Number(minute)===Number(value)?'text-teal-700 bg-emerald-400/10':'text-slate-500 hover:bg-slate-100'}`}>:{value}</button>)}</div>
        <button type="button" disabled={!hour||!minute||Number(hour)>23||Number(minute)>59} onClick={()=>{onTime(`${hour.padStart(2,'0')}:${minute.padStart(2,'0')}`);setOpen(null);}} className="mt-5 w-full rounded-lg bg-emerald-400 py-2.5 text-xs font-bold text-slate-950 disabled:opacity-30">Use this time</button>
      </>}
      {open==='zone' && <div className="space-y-1">{zones.map(zone=><button type="button" key={zone.value} onClick={()=>{onTimezone(zone.value);setOpen(null);}} className={`flex w-full items-center gap-2 rounded-xl px-3 py-3 text-left text-xs ${timezone===zone.value?'bg-emerald-400/10 text-teal-700':'hover:bg-slate-100 text-slate-700'}`}><Globe2 className="h-4 w-4 opacity-50"/><span className="flex-1">{zone.label}</span>{timezone===zone.value&&<Check className="h-3.5 w-3.5"/>}</button>)}</div>}
    </dialog>}
  </>;
}
