import {FormEvent, useEffect, useRef, useState} from 'react';
import {ArrowUp, MessageCircle, X, ArrowUpRight} from 'lucide-react';
import {answerFaq, FAQ_ITEMS} from '../services/faq';

export function FaqAssistant(){
  const [open,setOpen]=useState(false);const [question,setQuestion]=useState('');
  const [messages,setMessages]=useState<{question:string;answer:string}[]>([]);
  const input=useRef<HTMLInputElement>(null);const trigger=useRef<HTMLButtonElement>(null);const end=useRef<HTMLDivElement>(null);
  useEffect(()=>{if(open)input.current?.focus();},[open]);
  useEffect(()=>{if(messages.length)end.current?.scrollIntoView({block:'nearest',behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});},[messages]);
  const close=()=>{setOpen(false);trigger.current?.focus();};
  const ask=(value:string)=>{const clean=value.trim().slice(0,300);if(!clean)return;setMessages(previous=>[...previous.slice(-9),{question:clean,answer:answerFaq(clean).answer}]);setQuestion('');};
  const submit=(event:FormEvent)=>{event.preventDefault();ask(question);};
  return <div className="fixed bottom-[max(20px,env(safe-area-inset-bottom))] right-4 sm:right-6 z-[110] text-slate-100">
    {open&&<section id="homepage-faq-assistant" role="dialog" aria-label="Chart Replay FAQ assistant" onKeyDown={event=>{if(event.key==='Escape')close();}} className="mb-3 flex w-[min(390px,calc(100vw-32px))] max-h-[min(620px,calc(100dvh-110px))] flex-col overflow-hidden rounded-2xl border border-cyan-300/20 bg-[#0e1724] shadow-2xl shadow-black/60">
      <header className="flex items-center justify-between border-b border-white/10 bg-gradient-to-r from-emerald-500/15 via-cyan-500/10 to-indigo-500/20 p-4"><div><h2 className="text-sm font-bold">A little help, right here.</h2><p className="mt-1 text-[11px] text-slate-400">FAQ assistant · instant answers</p></div><button onClick={close} aria-label="Close FAQ assistant" className="p-2 rounded-lg hover:bg-white/10"><X size={17}/></button></header>
      <div className="overflow-y-auto overscroll-contain p-4 space-y-4"><p className="text-sm text-slate-300 leading-6">Hi there. What would you like to know about Chart Replay?</p>
        <div className="flex flex-wrap gap-2">{FAQ_ITEMS.slice(0,6).map(item=><button key={item.id} onClick={()=>ask(item.question)} className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-left text-xs text-slate-300 hover:border-emerald-300/40 hover:text-white">{item.question}</button>)}</div>
        <div aria-live="polite" aria-relevant="additions" className="space-y-4">{messages.map((message,index)=><div key={index} className="space-y-2"><p className="ml-8 rounded-2xl rounded-br-sm bg-cyan-400/15 px-3 py-2 text-sm"><span className="sr-only">You: </span>{message.question}</p><p className="mr-3 rounded-2xl rounded-bl-sm border border-white/5 bg-white/[0.04] px-3 py-3 text-sm text-slate-300 leading-6"><span className="sr-only">FAQ assistant: </span>{message.answer}</p></div>)}</div><div ref={end}/>
      </div><footer className="border-t border-white/10 p-3"><form onSubmit={submit} className="flex gap-2"><label className="sr-only" htmlFor="faq-question">Ask a question</label><input ref={input} id="faq-question" value={question} onChange={event=>setQuestion(event.target.value)} maxLength={300} placeholder="Ask about the platform…" autoComplete="off" className="min-w-0 flex-1 rounded-xl border border-white/10 bg-[#080e18] px-3 py-2.5 text-sm outline-none focus:border-emerald-400/60"/><button aria-label="Send question" disabled={!question.trim()} className="rounded-xl bg-gradient-to-br from-emerald-400 to-cyan-400 p-3 text-slate-950 disabled:opacity-40"><ArrowUp size={16}/></button></form><div className="mt-2 flex justify-between gap-2 text-[10px] text-slate-500"><span>Answers from our FAQ. No financial advice.</span><a href="mailto:info@chartreplay.co.za" className="inline-flex items-center text-slate-400">Contact us <ArrowUpRight size={11}/></a></div></footer>
    </section>}
    <button ref={trigger} onClick={()=>open?close():setOpen(true)} aria-expanded={open} aria-controls="homepage-faq-assistant" aria-label={open?'Close FAQ assistant':'Open FAQ assistant'} className="ml-auto flex min-h-12 items-center gap-2 rounded-full border border-emerald-200/30 bg-gradient-to-r from-emerald-400 to-cyan-400 px-4 py-3 text-sm font-bold text-[#062825] shadow-xl shadow-emerald-950/40 hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-300">{open?<X size={19}/>:<MessageCircle size={19}/>}<span>Ask us</span></button>
  </div>;
}
