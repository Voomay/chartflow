import React, {useEffect, useRef, useState} from 'react';
import {Check, ListPlus, NotebookPen} from 'lucide-react';
import {cacheUserStrategyNotesLocally, loadUserStrategyNotes, saveUserStrategyNotes} from '../services/storageAndAnalytics';
import {fetchUserStrategyNotesFromSupabase} from '../services/supabaseClient';

interface StrategyNotesProps {userId: string; isLight: boolean;}

export const StrategyNotes: React.FC<StrategyNotesProps> = ({userId,isLight}) => {
  const [initial] = useState(()=>loadUserStrategyNotes(userId));
  const [notes,setNotes] = useState(initial.text);
  const [status,setStatus] = useState(initial.error ? 'Notes could not be loaded. Check browser storage.' : initial.text ? 'Saved on this browser' : 'Your notes save automatically');
  const [failed,setFailed] = useState(initial.error);
  const editor=useRef<HTMLTextAreaElement>(null);
  useEffect(()=>{
    const loaded=loadUserStrategyNotes(userId);
    setNotes(loaded.text);
    setFailed(loaded.error);
    setStatus(loaded.error ? 'Notes could not be loaded. Check browser storage.' : loaded.text ? 'Saved on this browser' : 'Your notes save automatically');
    let cancelled=false;
    void fetchUserStrategyNotesFromSupabase(userId).then(remoteText=>{
      if(cancelled||!remoteText)return;
      setNotes(prev=>{
        if(prev)return prev;
        cacheUserStrategyNotesLocally(userId,remoteText);
        setStatus('Saved on this browser');
        return remoteText;
      });
    });
    return()=>{cancelled=true;};
  },[userId]);
  const update=(text:string)=>{
    setNotes(text);
    const saved=saveUserStrategyNotes(userId,text);
    setFailed(!saved);
    setStatus(saved?'Saved on this browser':'Could not save. Keep this page open and copy your notes.');
  };
  const addPoint=()=>{
    const input=editor.current;
    const start=input?.selectionStart ?? notes.length,end=input?.selectionEnd ?? start;
    const prefix=start>0 && notes[start-1]!=='\n'?'\n• ':'• ';
    const next=notes.slice(0,start)+prefix+notes.slice(end);
    if(next.length>20000)return;
    update(next);
    requestAnimationFrame(()=>{input?.focus();input?.setSelectionRange(start+prefix.length,start+prefix.length);});
  };
  return (
    <section aria-labelledby="strategy-notes-heading" className={`rounded-2xl border p-4 sm:p-5 ${isLight?'bg-white border-slate-200':'bg-[#11151d] border-white/10'}`}>
      <div className="flex items-start gap-3 mb-4">
        <div className="rounded-xl bg-emerald-500/10 p-2 text-emerald-500"><NotebookPen className="w-4 h-4" aria-hidden="true" /></div>
        <div>
          <h3 id="strategy-notes-heading" className="text-sm font-extrabold">Notes &amp; key points</h3>
          <p className="text-xs opacity-60 mt-1">Keep your setup ideas, reminders, and lessons in one place.</p>
        </div>
      </div>
      <div className={`overflow-hidden rounded-xl border ${isLight?'border-slate-200 bg-slate-50':'border-white/10 bg-[#0b0e14]'}`}>
        <div className={`px-3 py-2 border-b flex items-center justify-between gap-3 ${isLight?'border-slate-200':'border-white/10'}`}>
          <button type="button" onClick={addPoint} disabled={notes.length>=19998} className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold hover:bg-emerald-500/10 disabled:opacity-40 transition-colors"><ListPlus className="w-3.5 h-3.5" aria-hidden="true" />Add point</button>
          <span className="text-[10px] opacity-45 tabular-nums">{notes.length.toLocaleString()} / 20,000</span>
        </div>
        <textarea ref={editor} aria-label="Personal notes" value={notes} onChange={event=>update(event.target.value)} maxLength={20000} rows={12} placeholder={'What do you want to remember?\n\n• My setup conditions\n• What worked during testing\n• What I want to improve next time'} className={`block w-full min-h-[280px] resize-y p-4 bg-transparent text-sm leading-7 outline-none focus:ring-2 focus:ring-inset focus:ring-emerald-500/40 ${isLight?'text-slate-900 placeholder:text-slate-500':'placeholder:text-slate-600'}`} />
      </div>
      <p role="status" className={`mt-2.5 flex items-center gap-1.5 text-[11px] ${failed?'text-rose-500':'opacity-55'}`}>
        {!failed && notes && <Check className="w-3 h-3 text-emerald-500" aria-hidden="true" />}{status}
      </p>
    </section>
  );
};
