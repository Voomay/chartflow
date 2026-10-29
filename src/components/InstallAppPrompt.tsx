import {useEffect, useRef, useState} from 'react';
import {Download, Share, X} from 'lucide-react';

interface InstallEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{outcome: 'accepted' | 'dismissed'}>;
}
const DISMISSED = 'chart_replay_install_dismissed_v1';
const WEEK = 7 * 24 * 60 * 60 * 1000;
let memoryDismissedAt = 0;

export function InstallAppPrompt() {
  const [visible, setVisible] = useState(false);
  const [help, setHelp] = useState(false);
  const [busy, setBusy] = useState(false);
  const [installed, setInstalled] = useState(false);
  const pending = useRef<InstallEvent | null>(null);
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  useEffect(() => {
    const display = window.matchMedia('(display-mode: standalone)');
    const isInstalled = () => display.matches || Boolean((navigator as Navigator & {standalone?: boolean}).standalone);
    if (isInstalled() || !window.isSecureContext || !('serviceWorker' in navigator)) return;
    const canShow = () => {
      return !memoryDismissedAt || Date.now() - memoryDismissedAt > WEEK;
    };
    const timer = window.setTimeout(() => {if (canShow() && !isInstalled()) setVisible(true);}, 6000);
    const beforeInstall = (event: Event) => {
      event.preventDefault(); pending.current = event as InstallEvent;
      if (canShow() && !isInstalled()) setVisible(true);
    };
    const complete = () => {pending.current = null; setVisible(false); setInstalled(true);};
    const onDisplay = () => {if (isInstalled()) complete();};
    window.addEventListener('beforeinstallprompt', beforeInstall);
    window.addEventListener('appinstalled', complete);
    display.addEventListener('change', onDisplay);
    return () => {window.clearTimeout(timer);window.removeEventListener('beforeinstallprompt', beforeInstall);window.removeEventListener('appinstalled', complete);display.removeEventListener('change', onDisplay);};
  }, []);
  const dismiss = () => {
    setVisible(false);setHelp(false);
    memoryDismissedAt = Date.now();
  };
  const install = async () => {
    const event = pending.current;
    if (!event) {setHelp(true);return;}
    setBusy(true);
    try {
      await event.prompt();
      const choice = await event.userChoice;
      pending.current = null;
      if (choice.outcome === 'accepted') setVisible(false); else dismiss();
    } catch {pending.current = null;setHelp(true);}
    finally {setBusy(false);}
  };
  if (!visible || installed) return null;
  return <aside aria-label="Install Chart Replay" className="fixed z-[120] bottom-[max(18px,env(safe-area-inset-bottom))] left-1/2 -translate-x-1/2 w-[calc(100%-32px)] max-w-[420px] rounded-2xl border border-emerald-400/25 bg-gradient-to-br from-[#112d32] via-[#111e2c] to-[#1b1934] text-slate-100 shadow-2xl shadow-black/50 p-4">
    <button type="button" aria-label="Dismiss install invitation" onClick={dismiss} className="absolute right-2 top-2 rounded-lg p-2 text-slate-400 hover:text-white focus-visible:outline focus-visible:outline-emerald-300"><X size={16}/></button>
    <div className="flex items-center gap-3 pr-7"><img src="/icons/app-192.png" alt="" className="h-11 w-11 rounded-xl"/><div><p className="font-bold text-sm">Your workspace. One tap away.</p><p className="mt-1 text-xs text-slate-300">Install Chart Replay for a dedicated app window.</p></div></div>
    {help && <div className="mt-3 rounded-xl bg-black/20 p-3 text-xs leading-relaxed text-slate-200" role="status">{ios ? <><Share className="inline mr-1" size={14}/>Open the browser's Share menu, choose <strong>Add to Home Screen</strong>, then <strong>Add</strong>. If the option is missing, open this site in Safari.</> : <>Open your browser's menu and choose <strong>Install Chart Replay</strong>, <strong>Install app</strong> or <strong>Add to Home screen</strong>. On Safari for Mac, choose <strong>File → Add to Dock</strong>. If your browser has no install option, open this site in Chrome or Edge.</>}</div>}
    <div className="mt-3 flex items-center gap-3"><button type="button" disabled={busy} onClick={install} className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-emerald-400 to-cyan-400 px-4 py-2 text-xs font-extrabold text-slate-950 disabled:opacity-60"><Download size={14}/>{busy?'Opening…':help?'Install instructions':'Install app'}</button><button type="button" onClick={dismiss} className="text-xs text-slate-400 hover:text-white">Maybe later</button></div>
  </aside>;
}
