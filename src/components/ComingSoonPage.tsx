import {FormEvent, useEffect, useState} from 'react';
import {ArrowLeft, ArrowRight, Check, CheckCircle2, Layers3, Mail, ShieldCheck, TrendingUp} from 'lucide-react';
import {ChartReplayLogo} from './ChartReplayLogo';
import {LegalDocumentKey, LegalLinks} from './LegalLinks';
import {FaqAssistant} from './FaqAssistant';

export function ComingSoonPage({onBack,onOpenLegal}:{onBack:()=>void;onOpenLegal:(page:LegalDocumentKey)=>void}){
  const [name,setName]=useState('');const [email,setEmail]=useState('');const [consent,setConsent]=useState(false);const [website,setWebsite]=useState('');
  const [status,setStatus]=useState<'idle'|'saving'|'saved'>('idle');const [error,setError]=useState('');
  useEffect(()=>{const previous=document.title;document.title='Coming soon · Chart Replay';return()=>{document.title=previous;};},[]);
  const [enabled,setEnabled]=useState(false);
  useEffect(()=>{const controller=new AbortController();fetch('/api/waitlist',{signal:controller.signal}).then(response=>response.ok?response.json():null).then(data=>setEnabled(data?.enabled===true)).catch(()=>{});return()=>controller.abort();},[]);
  const join=async(event:FormEvent)=>{
    event.preventDefault();if(status==='saving')return;setError('');
    if(!enabled){setStatus('saved');setEmail('');setName('');setConsent(false);return;}
    setStatus('saving');
    try{
      const response=await fetch('/api/waitlist',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,email,consent,website}),signal:AbortSignal.timeout(15000)});
      const data=await response.json();if(!response.ok||data.ok!==true)throw new Error(data.error||'We could not save your signup. Please try again.');
      setStatus('saved');setEmail('');setName('');setConsent(false);
    }catch(reason){setStatus('idle');setError(reason instanceof Error&&reason.name!=='TimeoutError'?reason.message:'The request took too long. Please try again.');}
  };
  return <main className="h-[100dvh] overflow-y-auto overflow-x-hidden bg-[#070c14] text-slate-100 selection:bg-emerald-400/30"><div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_20%_0%,rgba(16,185,129,0.18),transparent_45%),radial-gradient(ellipse_at_90%_30%,rgba(59,82,246,0.20),transparent_50%)]" aria-hidden="true"/>
    <div className="relative mx-auto max-w-6xl px-5 sm:px-8"><header className="flex items-center justify-between gap-4 py-6 sm:py-8"><ChartReplayLogo size={36}/><button onClick={onBack} className="inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-xs text-slate-300 hover:bg-white/5"><ArrowLeft size={14}/>Back to homepage</button></header>
    <div className="grid items-center gap-12 pb-16 pt-10 lg:grid-cols-[1.05fr_1fr] lg:gap-16 lg:pt-20"><section><div className="mb-6 inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/[0.07] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-300"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400"/>Something good is taking shape</div>
    <h1 className="text-5xl font-semibold tracking-[-0.05em] leading-[1.08] sm:text-6xl">Your next chapter<br/>starts with <span className="bg-gradient-to-r from-emerald-300 via-cyan-300 to-blue-400 bg-clip-text text-transparent">practice.</span></h1><p className="mt-6 max-w-md text-base leading-7 text-slate-400">A clearer space to replay the markets, build your process and understand your progress. Join the waiting list for launch news and early-access updates.</p>
      <div className="mt-8 space-y-4">{[[TrendingUp,'Practise with purpose','Replay available market history at your pace.'],[Layers3,'Build your trading process','Keep your sessions, strategies and notes together.'],[ShieldCheck,'Keep the risk virtual','Develop your skills with simulated money.']].map(([Icon,title,description])=>{const FeatureIcon=Icon as typeof TrendingUp;return <div key={String(title)} className="flex gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03]"><FeatureIcon size={18} className="text-emerald-300"/></div><div><h2 className="text-sm font-semibold">{String(title)}</h2><p className="mt-1 text-xs text-slate-500">{String(description)}</p></div></div>;})}</div>
      <p className="mt-8 text-xs text-slate-500">Built in South Africa. Made for your progress.</p></section>
      <section aria-labelledby="waitlist-heading" className="relative rounded-[28px] border border-cyan-300/20 bg-gradient-to-br from-[#143137]/80 via-[#101c2c]/95 to-[#211d3b]/90 p-6 shadow-2xl shadow-black/25 sm:p-9">
        <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl border border-emerald-300/20 bg-emerald-400/10"><Mail size={23} className="text-emerald-300"/></div>
        <h2 id="waitlist-heading" className="text-2xl font-semibold tracking-tight">Be part of what's next.</h2><p className="mt-2 text-sm leading-6 text-slate-400">{enabled?'Leave your email for launch and early-access updates.':'Launch updates, straight to your inbox. Our waiting list is opening soon.'}</p>
        {status==='saved'?<div role="status" className="mt-7 rounded-2xl border border-emerald-400/25 bg-emerald-400/10 p-5"><CheckCircle2 className="mb-3 text-emerald-300" size={28}/><h3 className="font-semibold text-emerald-200">{enabled?"You're on the list.":'The list is opening soon.'}</h3><p className="mt-2 text-sm leading-6 text-slate-300">{enabled?'Your signup has been saved for launch and early-access updates. No payment or trading deposit is required.':'This is a preview of the waiting list. Your details have not been submitted or saved. Come back when signups open to reserve your place.'}</p></div>:<form onSubmit={join} className="mt-7 space-y-4">
          <div><label htmlFor="waitlist-name" className="mb-2 block text-xs text-slate-300">Name</label><input id="waitlist-name" required autoComplete="name" value={name} onChange={event=>setName(event.target.value)} maxLength={80} placeholder="What should we call you?" className="w-full rounded-xl border border-white/10 bg-[#070e18]/60 px-4 py-3 text-sm outline-none focus:border-emerald-400/60"/></div>
          <div><label htmlFor="waitlist-email" className="mb-2 block text-xs text-slate-300">Email address</label><input id="waitlist-email" type="email" autoComplete="email" required maxLength={254} value={email} onChange={event=>setEmail(event.target.value)} placeholder="you@example.com" className="w-full rounded-xl border border-white/10 bg-[#070e18]/60 px-4 py-3 text-sm outline-none focus:border-emerald-400/60"/></div>
          <div className="hidden" aria-hidden="true"><label htmlFor="waitlist-website">Website</label><input id="waitlist-website" tabIndex={-1} autoComplete="off" value={website} onChange={event=>setWebsite(event.target.value)}/></div>
          <label className="flex items-start gap-3 pt-1 text-xs leading-5 text-slate-400"><input type="checkbox" required checked={consent} onChange={event=>setConsent(event.target.checked)} className="mt-1 accent-emerald-400"/><span>Email me about launch and early access. I can withdraw consent at any time by contacting <a href="mailto:info@voomay.co.za" className="text-slate-200 underline">info@voomay.co.za</a>.</span></label>
          {error&&<p role="alert" className="rounded-xl border border-rose-300/20 bg-rose-400/10 p-3 text-xs leading-5 text-rose-200">{error}</p>}
          <button disabled={status==='saving'} className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-400 to-cyan-400 px-4 py-3.5 text-sm font-bold text-[#062c2b] hover:brightness-110 disabled:opacity-60">{status==='saving'?'Saving your place…':'Join the waitlist'}<ArrowRight size={16}/></button>
        </form>}
        <div className="mt-5 flex items-center gap-2 text-[11px] text-slate-500"><Check size={13} className="text-emerald-400"/>Launch updates only. No launch date promised.</div><p className="mt-4 text-[11px] leading-5 text-slate-500">{enabled?'We save your name, email and consent to manage launch updates. To request removal, email info@voomay.co.za. Read our':'Preview only: this form does not submit or save your details yet. Read our'} <button onClick={()=>onOpenLegal('privacy')} className="text-slate-300 underline">Privacy Policy</button> for details.</p>
      </section></div>
      <footer className="flex flex-col justify-between gap-4 border-t border-white/10 py-6 pb-28 text-[11px] text-slate-500 sm:flex-row"><p>Technology for trader development. Simulated money only.</p><LegalLinks onOpen={onOpenLegal}/></footer>
    </div><FaqAssistant/>
  </main>;
}
