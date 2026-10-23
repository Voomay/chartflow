import React, {useEffect, useRef, useState} from 'react';
import {ArrowRight, Check, Loader2, X} from 'lucide-react';
import {claimMotivation, encouragements, motivationEnabled, setMotivationEnabled} from '../services/motivation';

interface Props {
  userKey: string;
  name: string;
  eligible: boolean;
  chartStatus: string;
  loading: boolean;
  isLight: boolean;
  onOpen: () => void;
  onDismiss: () => void;
}
export function MotivationWelcome({userKey, name, eligible, chartStatus, loading, isLight, onOpen, onDismiss}: Props) {
  const [message, setMessage] = useState<typeof encouragements[number] | null>(null);
  const [skip, setSkip] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const callbacks = useRef({onOpen, onDismiss});
  callbacks.current = {onOpen, onDismiss};
  useEffect(() => {
    if (!eligible) return;
    const timer = setTimeout(() => {
      const next = claimMotivation(userKey);
      if (next) { setMessage(next); callbacks.current.onOpen(); }
    }, 450);
    return () => clearTimeout(timer);
  }, [eligible, userKey]);
  useEffect(() => {
    if (!message) return;
    const node = dialog.current;
    node?.showModal();
    return () => { node?.close(); };
  }, [message]);
  const dismiss = () => { setMessage(null); callbacks.current.onDismiss(); };
  if (!message) return null;
  const firstName = name.trim().split(/\s+/)[0]?.slice(0, 32) || 'trader';
  return <dialog ref={dialog} aria-labelledby="motivation-title" aria-describedby="motivation-message" onCancel={event => { event.preventDefault(); dismiss(); }} className={`motivation-dialog rounded-2xl border p-0 shadow-2xl ${isLight ? 'bg-white text-slate-900 border-emerald-200' : 'bg-[#111b1c] text-white border-emerald-300/20'}`}>
    <div className="motivation-welcome relative px-6 py-6">
      <button type="button" aria-label="Close encouragement" onClick={dismiss} className="absolute right-3 top-3 rounded-full p-1.5 opacity-50 transition hover:bg-emerald-400/10 hover:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400"><X className="h-4 w-4" /></button>
      <p className={`mb-2 pr-6 text-xs font-semibold ${isLight ? 'text-emerald-700' : 'text-emerald-300'}`}>You've got this, {firstName}.</p>
      <h2 id="motivation-title" className="pr-3 text-2xl font-semibold leading-tight tracking-tight">{message.title}</h2>
      <p id="motivation-message" className={`mt-3 text-[13px] leading-6 ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>{message.message}</p>
      <button type="button" autoFocus onClick={dismiss} className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-400 px-4 py-2.5 text-xs font-bold text-slate-950 transition hover:bg-emerald-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400">Let's focus <ArrowRight className="h-3.5 w-3.5" /></button>
      <div role="status" className={`mt-2 flex items-center justify-center gap-1 text-[10px] ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>{loading ? <Loader2 className="h-3 w-3 animate-spin motion-reduce:animate-none" /> : <Check className="h-3 w-3 text-emerald-500" />}{chartStatus}</div>
      <label className={`mt-3 flex cursor-pointer items-center justify-center gap-1.5 text-[10px] ${isLight ? 'text-slate-500' : 'text-slate-400'}`}><input type="checkbox" checked={skip} onChange={event => {setSkip(event.target.checked); setMotivationEnabled(userKey, !event.target.checked);}} className="h-3 w-3 accent-emerald-500" />Skip these welcome messages</label>
    </div>
  </dialog>;
}

export function MotivationPreference({userKey}: {userKey: string}) {
  const [enabled, setEnabled] = useState(() => motivationEnabled(userKey));
  useEffect(() => { setEnabled(motivationEnabled(userKey)); }, [userKey]);
  return <label className="flex cursor-pointer items-center justify-between gap-4 border-t border-white/10 pt-4">
    <span><span className="block text-xs font-bold">Chart welcome motivation</span><span className="mt-1 block text-[11px] opacity-70">A personalized encouragement once per visit, before practice.</span></span>
    <input type="checkbox" aria-label="Chart welcome motivation" checked={enabled} onChange={event => {setEnabled(event.target.checked); setMotivationEnabled(userKey, event.target.checked);}} className="h-5 w-5 shrink-0 accent-emerald-500" />
  </label>;
}
