import React, { useMemo, useState } from 'react';
import { Activity, ChevronDown, X } from 'lucide-react';
import { Candle } from '../types/trading';
import { computeMomentumPullback, momentumHourProfile, MomentumOptions, MomentumSession, MomentumSetup } from '../services/momentumPullback';
interface Props { study: ReturnType<typeof computeMomentumPullback>; candles: Candle[]; seconds: number; options: MomentumOptions; onOptions: (options: MomentumOptions) => void; onClose: () => void; onPlaceTool: (setup: MomentumSetup) => void; decimals: number; light: boolean; timezone: string; feedLabel?: string }
export function MomentumStudy({ study, candles, seconds, options, onOptions, onClose, onPlaceTool, decimals, light, timezone, feedLabel }: Props) {
  const [expanded, setExpanded] = useState(true);
  const profile = useMemo(() => momentumHourProfile(candles, seconds), [candles, seconds]);
  const latest = study.setups[study.setups.length - 1];
  const point = study.points[study.points.length - 1];
  const volumeName = /tick|biquote|capital/i.test(feedLabel || '') ? 'Feed tick activity' : /histdata/i.test(feedLabel || '') ? 'Archive volume unavailable' : 'Feed volume (basis unverified)';
  const control = `w-full rounded-lg border px-2 py-1.5 text-[11px] ${light ? 'bg-white border-slate-200' : 'bg-[#121d2b] border-white/10'}`;
  return <section aria-label="Momentum pullback indicator" className={`absolute left-3 top-28 z-20 w-[min(290px,calc(100%-90px))] rounded-xl border shadow-xl backdrop-blur-xl ${light ? 'bg-white/95 text-slate-800 border-slate-200' : 'bg-gradient-to-br from-[#102e30]/95 via-[#101c2b]/95 to-[#211b39]/95 text-slate-100 border-emerald-400/20'}`} onMouseDown={e => e.stopPropagation()} onTouchStart={e => e.stopPropagation()}>
    <header className="flex items-center gap-2 px-3 py-2">
      <Activity className="w-4 h-4 text-emerald-400" /><button aria-expanded={expanded} onClick={() => setExpanded(!expanded)} className="flex-1 flex items-center gap-2 text-left text-xs font-bold">Momentum Pullback <ChevronDown className={`w-3 h-3 transition-transform ${expanded ? '' : '-rotate-90'}`} /></button>
      <button aria-label="Close momentum indicator" onClick={onClose} className="p-1 rounded hover:bg-slate-500/20"><X className="w-3.5 h-3.5" /></button>
    </header>
    {expanded && <div className="px-3 pb-3 max-h-[45vh] overflow-y-auto space-y-2.5 text-[11px]">
      <div className="flex items-center justify-between"><strong className={study.trend === 'Uptrend' ? 'text-emerald-400' : 'text-rose-400'}>{study.confirmedBars < 56 ? 'Warming up · 56 bars needed' : study.trend}</strong><span className="text-slate-400">EMA 20 / 50 · ATR 14</span></div>
      <p className="text-slate-400">{study.phase} · completed candles only</p>
      <label className="block space-y-1"><span>Setup window</span><select aria-label="Momentum setup session" className={control} value={options.session} onChange={e => onOptions({ ...options, session: e.target.value as MomentumSession })}>
        <option value="all">All sessions</option><option value="london">London · 08:00–12:00 local</option><option value="newyork">New York · 08:00–12:00 local</option><option value="sa-morning">South Africa · 09:00–11:00</option><option value="sa-afternoon">South Africa · 13:00–15:00</option>
      </select></label>
      <div className="flex items-center justify-between gap-2"><label className="flex items-center gap-2"><input type="checkbox" checked={options.requireVolume} onChange={e => onOptions({ ...options, requireVolume: e.target.checked })} />Require volume</label><label className="flex items-center gap-1">RVOL ≥ <input aria-label="Minimum relative volume" type="number" min="1" max="5" step="0.1" value={options.minRelativeVolume} className={`${control} !w-14`} onChange={e => { const value = Number(e.target.value); if (value >= 1 && value <= 5) onOptions({ ...options, minRelativeVolume: value }); }} /></label></div>
      <p className={options.requireVolume && study.volumeCoverage < 0.9 ? 'rounded-lg p-2 bg-amber-500/10 text-amber-500' : 'text-slate-400'}>{volumeName} · {Math.round(study.volumeCoverage * 100)}% coverage. {point?.relativeVolume != null ? `Last RVOL ${point.relativeVolume.toFixed(2)}×.` : 'RVOL unavailable.'} {options.requireVolume && study.volumeCoverage < 0.9 ? 'Volume setups blocked where data is missing. Turn off Require volume to study price-only setups.' : !options.requireVolume ? 'Price-only mode: volume is not required.' : 'Relative to the prior 20 bars.'}</p>
      {latest ? <div className="rounded-lg border border-emerald-400/20 bg-emerald-500/5 p-2 space-y-1.5">
        <div className="flex justify-between font-bold"><span>{latest.side} · latest historical plan</span><span>1:2 R:R</span></div>
        <div className="text-[10px] text-slate-400">{new Intl.DateTimeFormat('en-GB', { timeZone: timezone, month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date((latest.time + seconds) * 1000))} · {timezone} · confirmed at close</div>
        <div className="grid grid-cols-3 gap-1 font-mono"><span>Entry<br /><b>{latest.entry.toFixed(decimals)}</b></span><span className="text-rose-400">SL<br /><b>{latest.stop.toFixed(decimals)}</b></span><span className="text-emerald-400">TP<br /><b>{latest.target.toFixed(decimals)}</b></span></div>
        <p className="text-[10px] text-slate-400">{latest.volumeConfirmed ? 'Volume confirmed' : 'Price-only'} · planned at signal close; not a filled or active order.</p>
        <button className="rounded-lg bg-emerald-500/15 border border-emerald-400/20 py-1.5 w-full text-emerald-400 font-semibold" onClick={() => onPlaceTool(latest)}>Place this 2R drawing</button>
      </div> : <p className="text-slate-400">No qualifying continuation in the revealed history.</p>}
      <details><summary className="cursor-pointer font-semibold">Activity by hour · South African time</summary><div className="mt-2 space-y-1.5">
        <p className="text-slate-400">Loaded history only. Complete hours, ≥5 samples per hour. Largest median range, not best returns.</p>
        {profile.length ? profile.slice(0, 3).map(row => <div key={row.hour} className="flex justify-between gap-1"><b>{String(row.hour).padStart(2, '0')}:00</b><span>{row.medianRangePct.toFixed(3)}% range</span><span className="text-slate-400">n={row.samples}</span></div>) : <p className="text-slate-400">Load more intraday history (1m–15m) for an hourly comparison.</p>}
      </div></details>
      <details><summary className="cursor-pointer font-semibold">How the setup works</summary><p className="mt-2 text-slate-400">Trend → impulse ≥0.8 ATR → retrace to EMA 20 zone → break of the previous candle with ≥0.45 ATR body. Pullback expires after 10 bars. Stop beyond the retracement; target 2× risk. Volume mode requires impulse and continuation RVOL confirmation. Session windows follow local daylight saving automatically. Settings are experimental and unvalidated for profitability; drawings never execute trades.</p></details>
    </div>}
  </section>;
}
