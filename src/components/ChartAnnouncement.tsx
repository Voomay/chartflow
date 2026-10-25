import {useEffect,useRef} from 'react';
import {ArrowRight,Mail,X} from 'lucide-react';
import {ChartReplayMark} from './ChartReplayLogo';

const memoryAnnouncementSeen = new Set<string>();
export const announcementKey=(userKey:string)=>`chartflow_chart_announcement_v1:${encodeURIComponent(userKey.toLowerCase())}`;
export function hasSeenChartAnnouncement(userKey:string){return memoryAnnouncementSeen.has(announcementKey(userKey));}
export function markChartAnnouncementSeen(userKey:string){memoryAnnouncementSeen.add(announcementKey(userKey));}

export function ChartAnnouncement({open,onClose}:{open:boolean;onClose:()=>void}){
  const dialog=useRef<HTMLDialogElement>(null);
  useEffect(()=>{const node=dialog.current;if(!node)return;if(open&&!node.open)node.showModal();else if(!open&&node.open)node.close();return()=>{if(node.open)node.close();};},[open]);
  return (
    <dialog
      ref={dialog}
      aria-labelledby="chart-announcement-title"
      aria-describedby="chart-announcement-intro"
      onCancel={event=>{event.preventDefault();onClose();}}
      onClick={event=>{if(event.target===dialog.current)onClose();}}
      className="chart-announcement m-auto w-[calc(100%-32px)] max-w-[490px] overflow-hidden rounded-3xl border border-emerald-400/20 bg-[#0b1418] p-0 text-slate-200 shadow-2xl shadow-black/70"
    >
      <div className="relative overflow-hidden px-6 pt-5 pb-5 bg-[radial-gradient(ellipse_at_top_right,rgba(16,185,129,0.14),transparent_60%)]">
        {/* Letterhead */}
        <div className="flex items-center justify-between border-b border-white/10 pb-3.5">
          <div className="flex items-center gap-2.5">
            <ChartReplayMark size={28}/>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-400">From the Desk of Chart Replay</p>
              <p className="text-[11px] text-slate-400">A personal note to our traders</p>
            </div>
          </div>
          <button
            autoFocus
            type="button"
            onClick={onClose}
            aria-label="Close chart announcement"
            className="flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-400 transition-colors hover:border-emerald-400/30 hover:bg-white/10 hover:text-white"
          >
            <X size={14}/>
          </button>
        </div>

        {/* Letter Salutation & Body */}
        <div className="mt-4 space-y-2.5 text-[13px] leading-[1.65] text-slate-300">
          <h2 id="chart-announcement-title" className="text-base font-bold tracking-tight text-white">
            Dear Trader,
          </h2>
          <p id="chart-announcement-intro">
            We&apos;re shaping Chart Replay around the way you practise — clear candles, intuitive drawing tools, smooth replay, and a sharper view of your progress.
          </p>
          <p>
            Your feedback guides what we refine next. If a candle, drawing, or tool ever feels off, let us know the instrument and timeframe so we can investigate right away.
          </p>
          <div className="rounded-xl border border-amber-300/15 bg-amber-300/[0.05] px-3.5 py-2.5 text-[12px] leading-[1.55] text-slate-300">
            <span className="font-semibold text-amber-300">P.S. on US30 pricing — </span>
            Please give us a little grace while we finish validating our <strong className="font-semibold text-white">US30</strong> feed. Treat US30 prices as provisional while we complete final checks.
          </div>
        </div>

        {/* Letter Signature & CTA */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-4 border-t border-white/10 pt-4">
          <div>
            <p className="text-[11px] italic text-slate-400">Warm regards,</p>
            <p className="mt-0.5 text-[13px] font-bold tracking-tight text-white">The Chart Replay Team</p>
            <a
              href="mailto:info@voomay.co.za?subject=Chart%20Replay%20feedback"
              className="mt-0.5 inline-flex items-center gap-1 text-[11px] font-medium text-emerald-400 hover:text-emerald-300 hover:underline"
            >
              <Mail size={11}/>
              Share feedback
            </a>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="motivation-cta-btn inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-extrabold text-slate-950 transition-all"
          >
            <span>Let&apos;s keep improving</span>
            <ArrowRight size={14}/>
          </button>
        </div>
      </div>
    </dialog>
  );
}
