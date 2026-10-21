import React, { useEffect, useRef, useState } from 'react';
import { ChartReplayMark } from './ChartReplayLogo';
import {
  ChevronDown,
  Crosshair,
  Minus,
  MousePointer2,
  Pause,
  PenLine,
  Ruler,
  SkipBack,
  SkipForward,
  Square,
  StepForward,
  Type,
} from 'lucide-react';

/* ---------------- Platform preview (mirrors the real terminal layout) ---------------- */

const CANDLES = [
  [2636.4, 2639.2, 2635.1, 2638.5], [2638.5, 2641.8, 2637.6, 2640.9], [2640.9, 2641.5, 2637.2, 2638.1],
  [2638.1, 2642.4, 2637.8, 2641.7], [2641.7, 2645.0, 2640.9, 2644.2], [2644.2, 2644.8, 2641.0, 2642.0],
  [2642.0, 2646.9, 2641.5, 2646.1], [2646.1, 2649.4, 2645.2, 2648.6], [2648.6, 2649.2, 2645.4, 2646.2],
  [2646.2, 2651.8, 2645.8, 2651.2], [2651.2, 2654.6, 2650.1, 2653.8], [2653.8, 2654.2, 2650.9, 2652.1],
  [2652.1, 2656.8, 2651.7, 2656.0], [2656.0, 2659.5, 2655.1, 2658.7], [2658.7, 2662.4, 2657.8, 2661.5],
  [2661.5, 2662.1, 2658.9, 2660.2], [2660.2, 2665.8, 2659.8, 2664.9], [2664.9, 2668.9, 2664.1, 2668.1],
  [2668.1, 2669.6, 2665.2, 2666.0], [2666.0, 2667.2, 2662.4, 2663.1], [2663.1, 2666.4, 2662.6, 2665.9],
  [2665.9, 2670.9, 2665.0, 2670.2],
];

const PreviewChart: React.FC = () => {
  const W = 520;
  const H = 260;
  const axisW = 46;
  const plotW = W - axisW;
  const min = 2632;
  const max = 2676;
  const y = (v: number) => 8 + (1 - (v - min) / (max - min)) * (H - 16);
  const step = plotW / (CANDLES.length + 4);
  const entry = 2651.2;
  const tp = 2672.4;
  const sl = 2644.8;
  const boxX = step * 9.5;
  const boxW = plotW - boxX - 6;
  const last = CANDLES[CANDLES.length - 1][3];
  const ticks = [2640, 2650, 2660, 2670];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-full block" preserveAspectRatio="none" aria-hidden="true">
      <rect width={W} height={H} fill="#131722" />
      {ticks.map((t) => (
        <g key={t}>
          <line x1="0" x2={plotW} y1={y(t)} y2={y(t)} stroke="#1e2330" />
          <text x={plotW + 6} y={y(t) + 3} fill="#787b86" fontSize="9" fontFamily="monospace">{t.toFixed(1)}</text>
        </g>
      ))}
      {[0.2, 0.4, 0.6, 0.8].map((f) => (
        <line key={f} x1={plotW * f} x2={plotW * f} y1="0" y2={H} stroke="#1a1f2b" />
      ))}
      <line x1={plotW} x2={plotW} y1="0" y2={H} stroke="#2a2e39" />

      {/* Long position tool */}
      <rect x={boxX} y={y(tp)} width={boxW} height={y(entry) - y(tp)} fill="#089981" fillOpacity="0.2" />
      <rect x={boxX} y={y(entry)} width={boxW} height={y(sl) - y(entry)} fill="#f23645" fillOpacity="0.2" />
      <line x1={boxX} x2={boxX + boxW} y1={y(entry)} y2={y(entry)} stroke="#d1d4dc" strokeWidth="1" />
      <rect x={boxX + 6} y={y(tp) + 5} width="92" height="15" rx="2" fill="#089981" />
      <text x={boxX + 11} y={y(tp) + 15.5} fill="#fff" fontSize="9" fontWeight="bold" fontFamily="monospace">TP 2672.4 · 3.3R</text>
      <rect x={boxX + 6} y={y(sl) - 20} width="80" height="15" rx="2" fill="#f23645" />
      <text x={boxX + 11} y={y(sl) - 9.5} fill="#fff" fontSize="9" fontWeight="bold" fontFamily="monospace">SL 2644.8 · 1%</text>

      {CANDLES.map(([o, h, l, c], i) => {
        const cx = step * (i + 0.5) + 4;
        const bull = c >= o;
        const col = bull ? '#089981' : '#f23645';
        const top = y(Math.max(o, c));
        const bh = Math.max(1.5, Math.abs(y(o) - y(c)));
        return (
          <g key={i}>
            <line x1={cx} x2={cx} y1={y(h)} y2={y(l)} stroke={col} strokeWidth="1" />
            <rect x={cx - step * 0.32} y={top} width={step * 0.64} height={bh} fill={col} />
          </g>
        );
      })}

      {/* Last price */}
      <line x1="0" x2={plotW} y1={y(last)} y2={y(last)} stroke="#089981" strokeDasharray="2 3" />
      <rect x={plotW} y={y(last) - 8} width={axisW} height="16" fill="#089981" />
      <text x={plotW + 4} y={y(last) + 3.5} fill="#fff" fontSize="9" fontWeight="bold" fontFamily="monospace">{last.toFixed(1)}</text>
      <rect x={plotW} y={y(entry) - 8} width={axisW} height="16" fill="#2962ff" />
      <text x={plotW + 4} y={y(entry) + 3.5} fill="#fff" fontSize="9" fontWeight="bold" fontFamily="monospace">{entry.toFixed(1)}</text>
    </svg>
  );
};

export const PlatformPreview: React.FC = () => {
  const tools = [Crosshair, MousePointer2, Minus, PenLine, Square, Ruler, Type];
  return (
    <div className="rounded-xl overflow-hidden bg-[#131722] border border-[#2a2e39] text-[#d1d4dc] font-sans select-none shadow-[0_30px_80px_rgba(0,0,0,0.6)]">
      {/* Top bar */}
      <div className="flex items-center gap-1.5 sm:gap-2 h-9 px-2 border-b border-[#2a2e39] bg-[#131722] text-[10px] sm:text-[11px] min-w-0">
        <ChartReplayMark size={20} />
        <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 font-bold shrink-0">Phase 1 · $100K</span>
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-[#2a2e39] font-bold text-white shrink-0">XAUUSD <ChevronDown className="w-3 h-3 text-[#787b86]" /></span>
        <span className="px-1.5 py-0.5 rounded bg-[#2962ff]/20 text-[#5b8cff] font-bold shrink-0">15m</span>
        <span className="hidden md:inline font-mono text-[#787b86] truncate">2024-11-06 14:45 UTC</span>
        <span className="ml-auto font-mono font-bold text-emerald-400 shrink-0">2670.2 <span className="hidden sm:inline">+1.29%</span></span>
      </div>

      <div className="flex h-[210px] sm:h-[280px] lg:h-[300px]">
        {/* Left toolbar */}
        <div className="hidden sm:flex flex-col items-center gap-1 w-9 py-2 border-r border-[#2a2e39] bg-[#131722] shrink-0">
          {tools.map((Icon, i) => (
            <span key={i} className={`w-7 h-7 rounded flex items-center justify-center ${i === 4 ? 'bg-[#2962ff]/20 text-[#5b8cff]' : 'text-[#9598a1]'}`}>
              <Icon className="w-3.5 h-3.5" />
            </span>
          ))}
        </div>

        {/* Chart */}
        <div className="flex-1 min-w-0 relative">
          <div className="absolute top-1.5 left-2 z-10 text-[9px] sm:text-[10px] font-mono text-[#9598a1] whitespace-nowrap">
            <span className="text-white font-bold">XAUUSD · 15</span> O <span className="text-emerald-400">2665.9</span> H <span className="text-emerald-400">2670.9</span> L <span className="text-emerald-400">2665.0</span> C <span className="text-emerald-400">2670.2</span>
          </div>
          <PreviewChart />
        </div>

        {/* Right order ticket */}
        <div className="hidden md:flex flex-col gap-2 w-[150px] lg:w-[168px] p-2.5 border-l border-[#2a2e39] bg-[#131722] shrink-0 text-[10px]">
          <div className="grid grid-cols-2 gap-1">
            <div className="rounded bg-[#f23645]/15 border border-[#f23645]/40 py-1 text-center">
              <div className="text-[#f23645] font-bold">SELL</div>
              <div className="font-mono text-white text-[11px]">2669.9</div>
            </div>
            <div className="rounded bg-[#2962ff] py-1 text-center">
              <div className="text-white/80 font-bold">BUY</div>
              <div className="font-mono text-white text-[11px] font-bold">2670.2</div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-1 text-center font-bold">
            {['Market', 'Limit', 'Stop'].map((t, i) => (
              <span key={t} className={`rounded py-0.5 ${i === 0 ? 'bg-[#2a2e39] text-white' : 'text-[#787b86]'}`}>{t}</span>
            ))}
          </div>
          <div className="flex justify-between items-center rounded bg-[#1e222a] border border-[#2a2e39] px-2 py-1">
            <span className="text-[#787b86]">Risk</span><span className="font-mono text-white">1.0 %</span>
          </div>
          <div className="flex justify-between items-center rounded bg-[#1e222a] border border-[#2a2e39] px-2 py-1">
            <span className="text-[#787b86]">Lots</span><span className="font-mono text-white">1.55</span>
          </div>
          <div className="grid grid-cols-3 gap-1 text-center font-bold">
            {['1R', '2R', '3R'].map((t, i) => (
              <span key={t} className={`rounded py-0.5 border ${i === 2 ? 'border-emerald-500/60 text-emerald-300 bg-emerald-500/10' : 'border-[#2a2e39] text-[#9598a1]'}`}>{t}</span>
            ))}
          </div>
          <div className="flex justify-between text-[#787b86]"><span>SL</span><span className="font-mono text-[#f23645]">2644.8</span></div>
          <div className="flex justify-between text-[#787b86]"><span>TP</span><span className="font-mono text-emerald-400">2672.4</span></div>
          <div className="mt-auto rounded bg-[#2962ff] text-white font-bold text-center py-1.5">Execute Buy</div>
        </div>
      </div>

      {/* Replay dock */}
      <div className="flex items-center gap-1.5 sm:gap-2 h-9 px-2 border-t border-[#2a2e39] bg-[#131722] text-[10px] min-w-0">
        {[SkipBack, Pause, StepForward, SkipForward].map((Icon, i) => (
          <span key={i} className={`w-6 h-6 rounded flex items-center justify-center shrink-0 ${i === 1 ? 'bg-[#2962ff] text-white' : 'text-[#9598a1] bg-[#1e222a]'}`}>
            <Icon className="w-3 h-3" />
          </span>
        ))}
        <span className="px-1.5 py-0.5 rounded bg-[#1e222a] font-mono font-bold text-white shrink-0">2x</span>
        <div className="flex-1 h-1 rounded bg-[#2a2e39] mx-1 min-w-[30px] overflow-hidden">
          <div className="h-full w-[68%] bg-gradient-to-r from-[#2962ff] to-emerald-400" />
        </div>
        <span className="hidden sm:inline font-mono text-[#787b86] shrink-0">Bar 1,284 / 1,890</span>
        <span className="font-mono font-bold text-emerald-400 shrink-0">+$1,240</span>
      </div>
    </div>
  );
};

/* ---------------- Live forex ticker ---------------- */

interface Quote { sym: string; price: number; open: number; dp: number; }

const BASE: Quote[] = [
  { sym: 'EURUSD', price: 1.0842, open: 1.0821, dp: 5 },
  { sym: 'GBPUSD', price: 1.2716, open: 1.2741, dp: 5 },
  { sym: 'USDJPY', price: 151.42, open: 150.88, dp: 3 },
  { sym: 'XAUUSD', price: 2670.2, open: 2636.4, dp: 2 },
  { sym: 'AUDUSD', price: 0.6583, open: 0.6571, dp: 5 },
  { sym: 'USDCAD', price: 1.3794, open: 1.3812, dp: 5 },
  { sym: 'USDCHF', price: 0.8812, open: 0.8798, dp: 5 },
  { sym: 'NZDUSD', price: 0.5974, open: 0.5989, dp: 5 },
  { sym: 'NAS100', price: 20184.5, open: 20012.3, dp: 1 },
  { sym: 'GER30', price: 19236.8, open: 19301.2, dp: 1 },
];

const fmt = (q: Quote) => q.price.toLocaleString('en-US', { minimumFractionDigits: q.dp, maximumFractionDigits: q.dp });

const TickerItem: React.FC<{ q: Quote; flash?: 'up' | 'down' }> = ({ q, flash }) => {
  const chg = ((q.price - q.open) / q.open) * 100;
  const up = chg >= 0;
  return (
    <span className="inline-flex items-center gap-2 px-5 sm:px-6 whitespace-nowrap text-xs sm:text-sm font-mono">
      <span className="font-bold text-white">{q.sym}</span>
      <span className={`tabular-nums transition-colors duration-500 ${flash === 'up' ? 'text-emerald-300' : flash === 'down' ? 'text-rose-300' : 'text-gray-300'}`}>{fmt(q)}</span>
      <span className={`inline-flex items-center gap-0.5 font-bold tabular-nums ${up ? 'text-emerald-400' : 'text-rose-400'}`}>
        <span aria-hidden="true">{up ? '▲' : '▼'}</span>
        {up ? '+' : ''}{chg.toFixed(2)}%
      </span>
      <span className="text-white/10 pl-3" aria-hidden="true">|</span>
    </span>
  );
};

export const ForexTicker: React.FC = () => {
  const [quotes, setQuotes] = useState<Quote[]>(BASE);
  const [flash, setFlash] = useState<Record<string, 'up' | 'down'>>({});
  const prev = useRef(quotes);

  useEffect(() => {
    const id = window.setInterval(() => {
      setQuotes((qs) => {
        const next = qs.map((q) => {
          if (Math.random() < 0.35) return q;
          const vol = q.price * 0.00018;
          const drift = (q.open - q.price) * 0.01;
          const price = q.price + drift + (Math.random() - 0.5) * 2 * vol;
          return { ...q, price: Number(price.toFixed(q.dp)) };
        });
        const f: Record<string, 'up' | 'down'> = {};
        next.forEach((q, i) => {
          if (q.price > prev.current[i].price) f[q.sym] = 'up';
          else if (q.price < prev.current[i].price) f[q.sym] = 'down';
        });
        prev.current = next;
        setFlash(f);
        return next;
      });
    }, 2000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="lp-ticker relative border-y border-white/[0.06] bg-[#080b12]/80 backdrop-blur py-3 overflow-hidden" aria-label="Live market prices">
      <div className="pointer-events-none absolute inset-y-0 left-0 w-12 sm:w-24 bg-gradient-to-r from-[#06080d] to-transparent z-10" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-12 sm:w-24 bg-gradient-to-l from-[#06080d] to-transparent z-10" />
      <div className="lp-ticker-track">
        {[0, 1].map((k) => (
          <div key={k} className="flex shrink-0" aria-hidden={k === 1}>
            {quotes.map((q) => <TickerItem key={q.sym} q={q} flash={flash[q.sym]} />)}
          </div>
        ))}
      </div>
    </div>
  );
};
