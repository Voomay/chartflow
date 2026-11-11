import React, { useEffect, useMemo, useRef, useState } from 'react';
import { BarChart3, Info, Layers, RefreshCw, Sparkles } from 'lucide-react';
import { AccountCurrency } from '../../types/trading';
import { formatMoney } from '../../services/simulationEngine';
import type { ComputedAnalyticsReport } from '../../services/storageAndAnalytics';
import { compactNumber, monotonePath, niceTicks } from './charts';

/* -------------------------------------------------------------------------- */
/*                Trade Simulator — forward projection from backtests           */
/*                                                                             */
/* Bootstraps (resamples with replacement) the P&L of the trades you already    */
/* backtested and projects the resulting equity over N future trades.           */
/*                                                                             */
/* Presentation follows the conventions used by professional backtest / Monte  */
/* Carlo reports (AmiBroker MC report, equity-curve simulators): a "straw       */
/* broom" of individual simulated runs, distinct labelled P5/P25/P50/P75/P95   */
/* equity lines, and a percentile distribution table of final equity, return,   */
/* max drawdown and lowest equity. This is a simulation, NOT a price forecast.  */
/* -------------------------------------------------------------------------- */

interface TradeSimulatorProps {
  report: ComputedAnalyticsReport;
  isLight: boolean;
  /** Prop-firm profit target in account currency, if the filtered session has one. */
  targetLine?: number | null;
  /** Prop-firm max-loss floor in account currency, if the filtered session has one. */
  floorLine?: number | null;
}

type SeriesKey = 'p5' | 'p25' | 'p50' | 'p75' | 'p95';

interface SimPoint {
  trade: number;
  p5: number;
  p25: number;
  p50: number;
  p75: number;
  p95: number;
  aboveStart: number;
}

interface PercentileRow {
  level: number;
  label: string;
  finalEquity: number;
  returnPct: number;
  maxDDPct: number;
  lowestEquity: number;
}

interface SimResult {
  points: SimPoint[];
  /** A handful of individual simulated equity paths ("straw broom" chart). */
  samplePaths: number[][];
  finalP5: number;
  finalP50: number;
  finalP95: number;
  probProfit: number;
  probTarget: number | null;
  probFloor: number | null;
  /** Fraction of runs that ever fell to 50% or less of the starting balance. */
  probRuin: number;
  medianMaxDDPct: number;
  worstMaxDDPct: number;
  expectancy: number;
  runs: number;
  trades: number;
  sampleCount: number;
  percentileRows: PercentileRow[];
}

interface SeriesDef {
  key: SeriesKey;
  label: string;
  short: string;
  color: string;
  width: number;
}

const MAX_TRADES = 1000;
const MAX_RUNS = 500;
const MAX_POINTS = 120;
const SAMPLE_PATH_COUNT = 12;
const PERCENTILE_LEVELS: Array<{ level: number; label: string }> = [
  { level: 5, label: 'Worst case' },
  { level: 25, label: 'Lower' },
  { level: 50, label: 'Median' },
  { level: 75, label: 'Upper' },
  { level: 95, label: 'Best case' },
];

function seriesDefs(isLight: boolean): SeriesDef[] {
  return [
    {
      key: 'p95',
      label: 'Best case',
      short: 'P95',
      color: isLight ? '#059669' : '#34d399',
      width: 1.9,
    },
    {
      key: 'p75',
      label: 'Upper',
      short: 'P75',
      color: isLight ? '#0284c7' : '#38bdf8',
      width: 1.7,
    },
    {
      key: 'p50',
      label: 'Median',
      short: 'P50',
      color: isLight ? '#4f46e5' : '#a5b4fc',
      width: 3,
    },
    {
      key: 'p25',
      label: 'Lower',
      short: 'P25',
      color: isLight ? '#b45309' : '#fbbf24',
      width: 1.7,
    },
    {
      key: 'p5',
      label: 'Worst case',
      short: 'P5',
      color: isLight ? '#be123c' : '#fb7185',
      width: 1.9,
    },
  ];
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

function runSimulation(
  pnls: number[],
  trades: number,
  runs: number,
  start: number,
  target: number | null,
  floor: number | null,
  sampleSeed: number
): SimResult | null {
  if (pnls.length === 0 || trades < 1 || runs < 1) return null;

  const checkpoints: number[] = [];
  const step = Math.max(1, Math.ceil(trades / MAX_POINTS));
  for (let i = 0; i <= trades; i += step) checkpoints.push(i);
  if (checkpoints[checkpoints.length - 1] !== trades) checkpoints.push(trades);

  const buckets: number[][] = checkpoints.map(() => []);
  const finalBalances: number[] = [];
  const maxDrawdowns: number[] = [];
  const lowestEquities: number[] = [];
  const samplePaths: number[][] = [];
  const ruinThreshold = start * 0.5;
  let reachedTargetCount = 0;
  let reachedFloorCount = 0;
  let ruinedCount = 0;

  let dataSeed = 2166136261;
  for (const p of pnls) dataSeed = Math.imul(dataSeed ^ Math.round(p * 100), 16777619) >>> 0;
  const rnd = mulberry32((dataSeed ^ (trades * 2654435761) ^ (runs << 10) ^ sampleSeed) >>> 0);

  for (let r = 0; r < runs; r++) {
    let equity = start;
    let peak = start;
    let lowest = start;
    let maxDD = 0;
    let cp = 0;
    let reachedTarget = target !== null && start >= target;
    let reachedFloor = floor !== null && start <= floor;
    let ruined = start <= ruinThreshold;
    const capturePath = r < SAMPLE_PATH_COUNT;
    const path: number[] = capturePath ? [start] : [];
    buckets[0].push(equity);

    for (let i = 1; i <= trades; i++) {
      equity += pnls[Math.floor(rnd() * pnls.length)];
      if (equity > peak) peak = equity;
      if (equity < lowest) lowest = equity;
      if (equity <= ruinThreshold) ruined = true;
      if (peak > 0) {
        const dd = ((peak - equity) / peak) * 100;
        if (dd > maxDD) maxDD = dd;
      }
      if (!reachedTarget && target !== null && equity >= target) reachedTarget = true;
      if (!reachedFloor && floor !== null && equity <= floor) reachedFloor = true;
      if (checkpoints[cp + 1] === i) {
        cp += 1;
        buckets[cp].push(equity);
        if (capturePath) path.push(equity);
      }
    }
    if (reachedTarget) reachedTargetCount += 1;
    if (reachedFloor) reachedFloorCount += 1;
    if (ruined) ruinedCount += 1;
    finalBalances.push(equity);
    maxDrawdowns.push(maxDD);
    lowestEquities.push(lowest);
    if (capturePath) samplePaths.push(path);
  }

  const sortedBuckets = buckets.map((b) => b.slice().sort((a, c) => a - c));
  const points: SimPoint[] = checkpoints.map((trade, idx) => {
    const bucket = sortedBuckets[idx];
    const above = bucket.reduce((sum, v) => sum + (v > start ? 1 : 0), 0);
    return {
      trade,
      p5: quantile(bucket, 0.05),
      p25: quantile(bucket, 0.25),
      p50: quantile(bucket, 0.5),
      p75: quantile(bucket, 0.75),
      p95: quantile(bucket, 0.95),
      aboveStart: bucket.length ? (above / bucket.length) * 100 : 0,
    };
  });

  const sortedFinal = finalBalances.slice().sort((a, b) => a - b);
  const sortedDD = maxDrawdowns.slice().sort((a, b) => a - b);
  const sortedLowest = lowestEquities.slice().sort((a, b) => a - b);
  const profitable = finalBalances.reduce((sum, v) => sum + (v > start ? 1 : 0), 0);

  const percentileRows: PercentileRow[] = PERCENTILE_LEVELS.map(({ level, label }) => {
    const finalEquity = quantile(sortedFinal, level / 100);
    return {
      level,
      label,
      finalEquity,
      returnPct: start > 0 ? (finalEquity / start - 1) * 100 : 0,
      maxDDPct: quantile(sortedDD, level / 100),
      lowestEquity: quantile(sortedLowest, level / 100),
    };
  });

  return {
    points,
    samplePaths,
    finalP5: quantile(sortedFinal, 0.05),
    finalP50: quantile(sortedFinal, 0.5),
    finalP95: quantile(sortedFinal, 0.95),
    probProfit: (profitable / runs) * 100,
    probTarget: target === null ? null : (reachedTargetCount / runs) * 100,
    probFloor: floor === null ? null : (reachedFloorCount / runs) * 100,
    probRuin: (ruinedCount / runs) * 100,
    medianMaxDDPct: quantile(sortedDD, 0.5),
    worstMaxDDPct: quantile(sortedDD, 0.95),
    expectancy: pnls.reduce((a, b) => a + b, 0) / pnls.length,
    runs,
    trades,
    sampleCount: pnls.length,
    percentileRows,
  };
}

function useElementWidth<T extends HTMLElement>(fallback = 720) {
  const ref = useRef<T | null>(null);
  const [width, setWidth] = useState(fallback);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      const w = el.getBoundingClientRect().width;
      if (w > 0) setWidth(Math.round(w));
    };
    update();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', update);
      return () => window.removeEventListener('resize', update);
    }
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

function projectDate(baseMs: number, tradesElapsed: number, tradesPerDay: number): string {
  const days = tradesElapsed / Math.max(0.1, tradesPerDay);
  const d = new Date(baseMs + days * 86400000);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

const StatCard: React.FC<{
  label: string;
  value: string;
  sub?: string;
  tone?: 'green' | 'blue' | 'indigo' | 'amber' | 'rose';
  isLight: boolean;
}> = ({ label, value, sub, tone = 'blue', isLight }) => {
  const textTone: Record<string, string> = isLight
    ? {
        green: 'text-emerald-700',
        blue: 'text-sky-700',
        indigo: 'text-indigo-700',
        amber: 'text-amber-700',
        rose: 'text-rose-700',
      }
    : {
        green: 'text-emerald-400',
        blue: 'text-sky-400',
        indigo: 'text-indigo-300',
        amber: 'text-amber-400',
        rose: 'text-rose-400',
      };
  return (
    <div
      className={`rounded-xl border px-3 py-2.5 ${
        isLight ? 'bg-white/70 border-slate-200' : 'bg-white/[0.03] border-white/[0.08]'
      }`}
    >
      <div className="text-[9px] font-bold uppercase tracking-wider opacity-60">{label}</div>
      <div className={`mt-1 text-sm sm:text-base font-mono font-black tabular-nums ${textTone[tone]}`}>
        {value}
      </div>
      {sub && <div className="mt-0.5 text-[10px] font-mono opacity-55 truncate">{sub}</div>}
    </div>
  );
};

export const TradeSimulator: React.FC<TradeSimulatorProps> = ({
  report,
  isLight,
  targetLine = null,
  floorLine = null,
}) => {
  const currency: AccountCurrency = report.accountCurrency;
  const startBalance = Number.isFinite(report.currentBalance)
    ? report.currentBalance
    : report.startingBalance;

  const historicalPnls = useMemo(
    () =>
      report.filteredClosedTrades
        .map((t) => Number(t.pnl))
        .filter((v) => Number.isFinite(v)),
    [report.filteredClosedTrades]
  );

  const derivedTradesPerDay = useMemo(() => {
    const times = report.filteredClosedTrades
      .map((t) => t.exitTime || t.entryTime)
      .filter((ts): ts is number => typeof ts === 'number' && Number.isFinite(ts) && ts > 0);
    const distinctDays = new Set(
      times.map((ts) => new Date(ts * 1000).toISOString().slice(0, 10))
    ).size;
    if (distinctDays > 0 && times.length > 0) {
      return Math.max(0.5, Math.min(20, Math.round((times.length / distinctDays) * 10) / 10));
    }
    return 3;
  }, [report.filteredClosedTrades]);

  const [tradeCount, setTradeCount] = useState<number>(() =>
    Math.max(20, Math.min(200, historicalPnls.length || 50))
  );
  const [tradesPerDay, setTradesPerDay] = useState<number>(() => derivedTradesPerDay);
  const [runs, setRuns] = useState<number>(300);
  const [sampleSeed, setSampleSeed] = useState<number>(1);
  const [showSamplePaths, setShowSamplePaths] = useState<boolean>(false);
  const [hover, setHover] = useState<number | null>(null);

  const trades = Math.max(1, Math.min(MAX_TRADES, Math.round(tradeCount) || 1));
  const runCount = Math.max(50, Math.min(MAX_RUNS, runs));

  const simulation = useMemo(
    () =>
      runSimulation(
        historicalPnls,
        trades,
        runCount,
        startBalance,
        targetLine,
        floorLine,
        sampleSeed
      ),
    [historicalPnls, trades, runCount, startBalance, targetLine, floorLine, sampleSeed]
  );

  const series = useMemo(() => seriesDefs(isLight), [isLight]);

  const baseMs = useMemo(() => {
    const times = report.filteredClosedTrades
      .map((t) => t.exitTime || t.entryTime)
      .filter((ts): ts is number => typeof ts === 'number' && Number.isFinite(ts) && ts > 0);
    return times.length ? Math.max(...times) * 1000 : Date.now();
  }, [report.filteredClosedTrades]);

  const [wrapRef, width] = useElementWidth<HTMLDivElement>(720);

  const chart = useMemo(() => {
    const pts = simulation?.points ?? [];
    const padL = 68;
    const padR = 96; // room for right-edge P95/P50/P5 outcome labels
    const padT = 16;
    const padB = 36;
    const w = Math.max(320, width);
    const h = 272;
    const innerW = Math.max(1, w - padL - padR);
    const innerH = Math.max(1, h - padT - padB);

    // Scale the axis to the projection itself. Distant prop-firm guard rails
    // (e.g. a 110k target when all runs end near 104k) otherwise flatten every
    // line into a thin band; those are pinned to the edge with a label instead.
    const curveValues = pts.flatMap((p) => [p.p5, p.p95]);
    const rawMin = Math.min(startBalance, ...curveValues);
    const rawMax = Math.max(startBalance, ...curveValues);
    const dataRange = Math.max(1, rawMax - rawMin);
    const nearRefs = [targetLine, floorLine].filter(
      (v): v is number =>
        v !== null && v >= rawMin - dataRange * 0.6 && v <= rawMax + dataRange * 0.6
    );
    const axisValues = [...curveValues, startBalance, ...nearRefs];
    const viewMin = Math.min(...axisValues);
    const viewMax = Math.max(...axisValues);
    const padV = (viewMax - viewMin) * 0.06;
    const axis = niceTicks(viewMin - padV, viewMax + padV, 5);
    const span = Math.max(1e-9, axis.max - axis.min);
    const toY = (v: number) => padT + innerH - ((v - axis.min) / span) * innerH;
    const toX = (i: number) =>
      pts.length <= 1 ? padL + innerW / 2 : padL + (i / (pts.length - 1)) * innerW;

    return { pts, padL, padR, padT, padB, w, h, innerW, innerH, axis, toX, toY };
  }, [simulation, width, startBalance, targetLine, floorLine]);

  const gridColor = isLight ? 'rgba(15,23,42,0.10)' : 'rgba(148,163,184,0.09)';
  const axisText = isLight ? '#475569' : '#7c8799';
  const lastPoint = chart.pts[chart.pts.length - 1];

  // Guard rails that fall outside the visible axis are pinned to the plot edge
  // with their value, instead of being dropped or stretching the axis.
  const refLines = useMemo(() => {
    const top = chart.padT;
    const bottom = chart.h - chart.padB;
    const build = (v: number | null, color: string, label: string, dash: string) => {
      if (v === null) return null;
      const rawY = chart.toY(v);
      const clipped = rawY < top ? 'above' : rawY > bottom ? 'below' : null;
      const y = clipped === 'above' ? top + 2 : clipped === 'below' ? bottom - 2 : rawY;
      const valueLabel = compactNumber(v, 1);
      return {
        color,
        dash,
        y,
        text: clipped
          ? `${label} ${valueLabel} ${clipped === 'above' ? '↑' : '↓'}`
          : label,
      };
    };
    return [
      build(startBalance, isLight ? '#475569' : '#64748b', 'Now', '3 4'),
      build(targetLine, '#0d9488', 'Target', '6 4'),
      build(floorLine, '#e11d48', 'Floor', '6 4'),
    ].filter((x): x is NonNullable<typeof x> => x !== null);
  }, [chart, startBalance, targetLine, floorLine, isLight]);

  // Right-edge outcome labels with simple vertical collision avoidance.
  const endLabels = useMemo(() => {
    if (!lastPoint) return [];
    const items = series.map((s) => ({
      ...s,
      y: chart.toY(lastPoint[s.key]),
      value: lastPoint[s.key],
      labelY: 0,
    }));
    items.sort((a, b) => a.y - b.y);
    let prev = -Infinity;
    for (const item of items) {
      item.labelY = Math.max(item.y, prev + 16);
      prev = item.labelY;
    }
    const overflow = prev - (chart.h - chart.padB - 2);
    if (overflow > 0) for (const item of items) item.labelY -= overflow;
    return items;
  }, [series, lastPoint, chart]);

  const xTicks = useMemo(() => {
    const n = chart.pts.length;
    if (n === 0) return [];
    const count = Math.max(2, Math.min(5, Math.floor(chart.innerW / 110)));
    return Array.from(
      new Set(
        Array.from({ length: count }, (_, k) => Math.round((k / (count - 1)) * (n - 1)))
      )
    );
  }, [chart.pts.length, chart.innerW]);

  const milestones = useMemo(() => {
    if (!simulation) return [];
    const pts = simulation.points;
    return [0.25, 0.5, 0.75, 1].map((frac) => {
      const targetTrade = Math.round(simulation.trades * frac);
      let best = pts[0];
      for (const p of pts) {
        if (Math.abs(p.trade - targetTrade) < Math.abs(best.trade - targetTrade)) best = p;
      }
      return best;
    });
  }, [simulation]);

  const hovered = hover !== null ? chart.pts[hover] : null;

  return (
    <section
      className={`hub-surface relative overflow-hidden rounded-2xl border p-4 sm:p-5 space-y-4 ${
        isLight ? 'bg-white border-[#e0e3eb] shadow-sm' : 'bg-[#131922] border-white/[0.08]'
      }`}
      aria-label="Trade simulator"
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-violet-500/70 to-transparent" />
      <div className="pointer-events-none absolute -top-24 -right-20 h-56 w-56 rounded-full bg-violet-500/10 blur-3xl" />

      {/* Header */}
      <div className="relative flex items-start justify-between flex-wrap gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex h-7 w-7 items-center justify-center rounded-lg border ${
                isLight
                  ? 'border-violet-200 bg-violet-50 text-violet-600'
                  : 'border-violet-400/25 bg-violet-500/15 text-violet-300'
              }`}
            >
              <Sparkles className="h-3.5 w-3.5" />
            </span>
            <h3 className="text-xs font-extrabold uppercase tracking-wider bg-gradient-to-r from-violet-400 via-indigo-400 to-cyan-300 bg-clip-text text-transparent">
              Trade Simulator · Monte Carlo Equity Projection
            </h3>
          </div>
          <p className="mt-1.5 text-[11px] opacity-65 leading-snug">
            {simulation ? (
              <>
                {simulation.runs.toLocaleString()} simulated runs ·{' '}
                {historicalPnls.length.toLocaleString()} backtested trades reshuffled ·{' '}
                {trades} forward trades, starting from {formatMoney(startBalance, currency)}.
              </>
            ) : (
              <>
                Resamples the P&amp;L of your backtested trades to project where the next N trades
                could take your balance.
              </>
            )}
          </p>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] font-mono opacity-60">
          <BarChart3 className="h-3.5 w-3.5" />
          {simulation ? 'P5 / P25 / P50 / P75 / P95' : 'No sample'}
        </div>
      </div>

      {/* Controls */}
      <div className="relative flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-[9px] font-bold uppercase tracking-wider opacity-60">
            Number of trades
          </span>
          <input
            aria-label="Number of trades to simulate"
            type="number"
            min={1}
            max={MAX_TRADES}
            value={tradeCount}
            onChange={(e) => setTradeCount(Number(e.target.value))}
            className={`w-28 rounded-xl border px-3 py-2 font-mono text-xs font-bold outline-none ${
              isLight
                ? 'bg-white border-slate-200 text-slate-900 focus:border-violet-400'
                : 'bg-[#0e131b] border-white/10 text-slate-100 focus:border-violet-400/60'
            }`}
          />
        </label>
        <div className="flex items-center gap-1 pb-0.5">
          {[25, 50, 100, 250].map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => setTradeCount(preset)}
              className={`rounded-lg border px-2 py-1.5 font-mono text-[10px] font-bold transition ${
                trades === preset
                  ? 'border-violet-400/60 bg-violet-500/20 text-violet-300'
                  : isLight
                  ? 'border-slate-200 bg-white text-slate-600 hover:border-violet-300'
                  : 'border-white/10 bg-white/5 text-slate-400 hover:border-violet-400/40'
              }`}
            >
              {preset}
            </button>
          ))}
        </div>
        <label className="flex flex-col gap-1">
          <span className="text-[9px] font-bold uppercase tracking-wider opacity-60">
            Trades / day
          </span>
          <input
            aria-label="Trades per day for time axis"
            type="number"
            min={0.5}
            max={50}
            step={0.5}
            value={tradesPerDay}
            onChange={(e) => setTradesPerDay(Number(e.target.value))}
            className={`w-24 rounded-xl border px-3 py-2 font-mono text-xs font-bold outline-none ${
              isLight
                ? 'bg-white border-slate-200 text-slate-900 focus:border-violet-400'
                : 'bg-[#0e131b] border-white/10 text-slate-100 focus:border-violet-400/60'
            }`}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[9px] font-bold uppercase tracking-wider opacity-60">
            Simulated runs
          </span>
          <select
            aria-label="Number of simulated runs"
            value={runs}
            onChange={(e) => setRuns(Number(e.target.value))}
            className={`w-28 rounded-xl border px-3 py-2 font-mono text-xs font-bold outline-none ${
              isLight
                ? 'bg-white border-slate-200 text-slate-900 focus:border-violet-400'
                : 'bg-[#0e131b] border-white/10 text-slate-100 focus:border-violet-400/60'
            }`}
          >
            <option value={100}>100</option>
            <option value={300}>300</option>
            <option value={500}>500</option>
          </select>
        </label>
        <div className="ml-auto flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setShowSamplePaths((v) => !v)}
            aria-pressed={showSamplePaths}
            className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-[11px] font-bold transition ${
              showSamplePaths
                ? 'border-violet-400/60 bg-violet-500/15 text-violet-400'
                : isLight
                ? 'border-slate-200 bg-white text-slate-600 hover:border-violet-300'
                : 'border-white/10 bg-white/5 text-slate-400 hover:border-violet-400/40'
            }`}
            title="Overlay individual simulated equity runs (the industry 'straw broom' view)"
          >
            <Layers className="h-3.5 w-3.5" />
            Sample runs
          </button>
          <button
            type="button"
            onClick={() => {
              setSampleSeed((v) => v + 1);
              setTradesPerDay(derivedTradesPerDay);
            }}
            title="Draw a fresh random sample and reset trades/day from your history"
            className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-[11px] font-bold transition ${
              isLight
                ? 'border-slate-200 bg-white text-slate-700 hover:border-violet-300'
                : 'border-white/10 bg-white/5 text-slate-300 hover:border-violet-400/40'
            }`}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            New sample
          </button>
        </div>
      </div>

      {!simulation || historicalPnls.length === 0 ? (
        <div
          className={`relative rounded-xl border px-4 py-10 text-center text-xs ${
            isLight
              ? 'border-slate-200 bg-slate-50 text-slate-500'
              : 'border-white/10 bg-white/[0.02] text-slate-400'
          }`}
        >
          No closed backtested trades match the current analytics filters. Close a few trades in the
          terminal (or widen the filters) and the simulator will use their real P&amp;L as its sample.
        </div>
      ) : (
        <>
          {/* KPI row */}
          <div className="relative grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
            <StatCard
              label="Median outcome"
              value={formatMoney(simulation.finalP50, currency)}
              sub={`${((simulation.finalP50 / startBalance - 1) * 100).toFixed(2)}% vs now`}
              tone="indigo"
              isLight={isLight}
            />
            <StatCard
              label="Best case (P95)"
              value={formatMoney(simulation.finalP95, currency)}
              sub="Only 5% of runs finish higher"
              tone="green"
              isLight={isLight}
            />
            <StatCard
              label="Worst case (P5)"
              value={formatMoney(simulation.finalP5, currency)}
              sub="5% of runs finish lower"
              tone="rose"
              isLight={isLight}
            />
            <StatCard
              label="Profitable runs"
              value={`${simulation.probProfit.toFixed(1)}%`}
              sub={`Expectancy ${formatMoney(simulation.expectancy, currency, true)}/trade`}
              tone="blue"
              isLight={isLight}
            />
            <StatCard
              label={simulation.probTarget !== null ? 'Chance: hit target' : 'Median max DD'}
              value={
                simulation.probTarget !== null
                  ? `${simulation.probTarget.toFixed(1)}%`
                  : `-${simulation.medianMaxDDPct.toFixed(2)}%`
              }
              sub={
                simulation.probTarget !== null
                  ? `Target ${formatMoney(targetLine ?? 0, currency)}`
                  : 'Across all simulated runs'
              }
              tone={simulation.probTarget !== null ? 'green' : 'amber'}
              isLight={isLight}
            />
            <StatCard
              label={
                simulation.probFloor !== null ? 'Chance: hit loss floor' : 'Chance of ruin (−50%)'
              }
              value={
                simulation.probFloor !== null
                  ? `${simulation.probFloor.toFixed(1)}%`
                  : `${simulation.probRuin.toFixed(1)}%`
              }
              sub={
                simulation.probFloor !== null
                  ? `Floor ${formatMoney(floorLine ?? 0, currency)}`
                  : `Worst max DD -${simulation.worstMaxDDPct.toFixed(1)}%`
              }
              tone="rose"
              isLight={isLight}
            />
          </div>

          {/* Projection chart — smooth, individually coloured percentile lines */}
          <div
            className={`relative rounded-xl border p-2 pt-3 ${
              isLight
                ? 'bg-gradient-to-b from-slate-50 to-white border-slate-200'
                : 'bg-gradient-to-b from-[#141826] to-[#0e1117] border-white/5'
            }`}
          >
            <div ref={wrapRef} className="relative w-full select-none" style={{ height: chart.h }}>
              <svg
                width={chart.w}
                height={chart.h}
                viewBox={`0 0 ${chart.w} ${chart.h}`}
                className="block overflow-visible"
                role="img"
                aria-label="Smoothed Monte Carlo equity projection lines P5, P25, median, P75 and P95"
              >
                {/* Grid + Y axis */}
                {chart.axis.ticks.map((t) => (
                  <g key={`sim-y-${t}`}>
                    <line
                      x1={chart.padL}
                      x2={chart.w - chart.padR}
                      y1={chart.toY(t)}
                      y2={chart.toY(t)}
                      stroke={gridColor}
                      strokeWidth={1}
                    />
                    <text
                      x={chart.padL - 8}
                      y={chart.toY(t)}
                      textAnchor="end"
                      dominantBaseline="middle"
                      fontSize={10}
                      fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
                      fill={axisText}
                    >
                      {compactNumber(t, chart.axis.step)}
                    </text>
                  </g>
                ))}

                {/* X axis */}
                {xTicks.map((idx) => {
                  const p = chart.pts[idx];
                  if (!p) return null;
                  const x = chart.toX(idx);
                  return (
                    <g key={`sim-x-${idx}`}>
                      <line
                        x1={x}
                        x2={x}
                        y1={chart.padT}
                        y2={chart.h - chart.padB}
                        stroke={gridColor}
                        strokeDasharray="2 4"
                      />
                      <text
                        x={x}
                        y={chart.h - chart.padB + 15}
                        textAnchor="middle"
                        fontSize={10}
                        fontWeight={700}
                        fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
                        fill={axisText}
                      >
                        T{p.trade}
                      </text>
                      <text
                        x={x}
                        y={chart.h - chart.padB + 28}
                        textAnchor="middle"
                        fontSize={9}
                        fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
                        fill={axisText}
                        opacity={0.75}
                      >
                        {projectDate(baseMs, p.trade, tradesPerDay)}
                      </text>
                    </g>
                  );
                })}

                {/* Reference lines: start / prop target / loss floor */}
                {refLines.map((r) => (
                  <g key={r.text}>
                    <line
                      x1={chart.padL}
                      x2={chart.w - chart.padR}
                      y1={r.y}
                      y2={r.y}
                      stroke={r.color}
                      strokeOpacity={0.65}
                      strokeDasharray={r.dash}
                      strokeWidth={1.2}
                    />
                    <text
                      x={chart.padL + 4}
                      y={r.y - 4}
                      fontSize={9}
                      fontWeight={800}
                      fill={r.color}
                    >
                      {r.text}
                    </text>
                  </g>
                ))}

                {/* Optional straw-broom individual runs */}
                {showSamplePaths &&
                  simulation.samplePaths.map((path, idx) => (
                    <path
                      key={`run-${idx}`}
                      d={monotonePath(
                        path.map((v, i) => ({ x: chart.toX(i), y: chart.toY(v) }))
                      )}
                      fill="none"
                      stroke={isLight ? '#64748b' : '#94a3b8'}
                      strokeOpacity={0.24}
                      strokeWidth={1}
                      strokeLinecap="round"
                    />
                  ))}

                {/* Five distinct smoothed outcome lines (median drawn last, on top) */}
                {[...series]
                  .sort((a, b) => (a.key === 'p50' ? 1 : b.key === 'p50' ? -1 : 0))
                  .map((s) => (
                    <path
                      key={s.key}
                      d={monotonePath(
                        chart.pts.map((p, i) => ({ x: chart.toX(i), y: chart.toY(p[s.key]) }))
                      )}
                      fill="none"
                      stroke={s.color}
                      strokeWidth={s.width}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      opacity={s.key === 'p50' ? 1 : 0.92}
                    />
                  ))}

                {/* Right-edge outcome labels */}
                {endLabels.map((s) => (
                  <g key={`end-${s.key}`}>
                    <line
                      x1={chart.w - chart.padR}
                      x2={chart.w - chart.padR + 5}
                      y1={s.y}
                      y2={s.labelY}
                      stroke={s.color}
                      strokeOpacity={0.55}
                      strokeWidth={1}
                    />
                    <circle cx={chart.w - chart.padR} cy={s.y} r={2.5} fill={s.color} />
                    <text
                      x={chart.w - chart.padR + 9}
                      y={s.labelY}
                      dominantBaseline="middle"
                      fontSize={9.5}
                      fontWeight={800}
                      fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
                      fill={s.color}
                    >
                      {s.short} {compactNumber(s.value, 1)}
                    </text>
                  </g>
                ))}

                {/* Hover crosshair */}
                {hovered && hover !== null && (
                  <g pointerEvents="none">
                    <line
                      x1={chart.toX(hover)}
                      x2={chart.toX(hover)}
                      y1={chart.padT}
                      y2={chart.h - chart.padB}
                      stroke={isLight ? '#94a3b8' : '#475569'}
                      strokeDasharray="3 3"
                    />
                    {series.map((s) => (
                      <circle
                        key={`dot-${s.key}`}
                        cx={chart.toX(hover)}
                        cy={chart.toY(hovered[s.key])}
                        r={s.key === 'p50' ? 4 : 2.5}
                        fill={s.color}
                        stroke={isLight ? '#fff' : '#0d0f13'}
                        strokeWidth={1.2}
                      />
                    ))}
                  </g>
                )}

                <rect
                  x={chart.padL}
                  y={chart.padT}
                  width={chart.innerW}
                  height={chart.innerH}
                  fill="transparent"
                  onMouseMove={(e) => {
                    const svg = e.currentTarget.ownerSVGElement;
                    if (!svg) return;
                    const rect = svg.getBoundingClientRect();
                    const x = e.clientX - rect.left - chart.padL;
                    const ratio = chart.innerW > 0 ? x / chart.innerW : 0;
                    setHover(
                      Math.round(Math.max(0, Math.min(1, ratio)) * (chart.pts.length - 1))
                    );
                  }}
                  onMouseLeave={() => setHover(null)}
                  style={{ cursor: 'crosshair' }}
                />
              </svg>

              {hovered && hover !== null && (
                <div
                  className={`pointer-events-none absolute z-20 min-w-[180px] rounded-xl border px-3 py-2 text-[11px] font-mono shadow-2xl backdrop-blur-md ${
                    isLight
                      ? 'bg-white/95 border-slate-200 text-slate-800'
                      : 'bg-[#0f1219]/90 border-white/10 text-slate-100'
                  }`}
                  style={{
                    left: chart.toX(hover) > chart.w * 0.6 ? undefined : chart.toX(hover) + 14,
                    right:
                      chart.toX(hover) > chart.w * 0.6
                        ? chart.w - chart.toX(hover) + 14
                        : undefined,
                    top: Math.max(4, chart.toY(hovered.p50) - 60),
                  }}
                >
                  <div className="mb-1 flex items-center justify-between gap-3 border-b border-gray-500/20 pb-1">
                    <span className="font-extrabold">Trade #{hovered.trade}</span>
                    <span className="opacity-60">
                      {projectDate(baseMs, hovered.trade, tradesPerDay)}
                    </span>
                  </div>
                  {series.map((s) => (
                    <div key={`tt-${s.key}`} className="flex justify-between gap-4 leading-5">
                      <span style={{ color: s.color }} className="font-bold">
                        {s.short} {s.label}
                      </span>
                      <span className="font-bold">{formatMoney(hovered[s.key], currency)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between gap-4 leading-5 border-t border-gray-500/20 mt-1 pt-1">
                    <span className="opacity-70">Above start</span>
                    <span className="font-bold">{hovered.aboveStart.toFixed(0)}% of runs</span>
                  </div>
                </div>
              )}
            </div>

            {/* Legend: each output line, its colour and its ending value */}
            <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 px-2 pb-1 pt-2">
              {series.map((s) => (
                <span key={`legend-${s.key}`} className="flex items-center gap-1.5 text-[10px] font-mono">
                  <span
                    className="inline-block w-4 rounded-full"
                    style={{ backgroundColor: s.color, height: s.key === 'p50' ? 3 : 2 }}
                  />
                  <span className="font-extrabold" style={{ color: s.color }}>
                    {s.short}
                  </span>
                  <span className="opacity-60">{s.label}</span>
                  <span className="font-bold">
                    {lastPoint ? formatMoney(lastPoint[s.key], currency) : '—'}
                  </span>
                </span>
              ))}
            </div>
          </div>

          {/* Industry-standard Monte Carlo percentile distribution table */}
          <div className="relative overflow-x-auto">
            <div className="mb-1.5 flex items-center gap-2">
              <span className="text-[10px] font-extrabold uppercase tracking-wider opacity-70">
                Monte Carlo outcome distribution
              </span>
              <span className="text-[9px] font-mono opacity-50">
                {simulation.runs} runs · percentile of final equity
              </span>
            </div>
            <table className="w-full min-w-[520px] text-[11px] font-mono">
              <thead>
                <tr
                  className={`text-[9px] uppercase tracking-wider ${
                    isLight ? 'text-slate-500' : 'text-slate-400'
                  }`}
                >
                  <th className="py-1.5 text-left font-bold">Percentile</th>
                  <th className="py-1.5 text-right font-bold">Final equity</th>
                  <th className="py-1.5 text-right font-bold">Return</th>
                  <th className="py-1.5 text-right font-bold">Max drawdown</th>
                  <th className="py-1.5 text-right font-bold">Lowest equity</th>
                </tr>
              </thead>
              <tbody>
                {simulation.percentileRows.map((row) => {
                  const def = series.find((s) => s.short === `P${row.level}`);
                  return (
                    <tr
                      key={row.level}
                      className={`border-t ${
                        isLight ? 'border-slate-200/80' : 'border-white/[0.06]'
                      }`}
                    >
                      <td className="py-1.5 font-bold" style={{ color: def?.color }}>
                        P{row.level} · {row.label}
                      </td>
                      <td className="py-1.5 text-right font-bold">
                        {formatMoney(row.finalEquity, currency)}
                      </td>
                      <td className="py-1.5 text-right">
                        {row.returnPct >= 0 ? '+' : ''}
                        {row.returnPct.toFixed(2)}%
                      </td>
                      <td className="py-1.5 text-right text-amber-400">
                        -{row.maxDDPct.toFixed(2)}%
                      </td>
                      <td className="py-1.5 text-right opacity-70">
                        {formatMoney(row.lowestEquity, currency)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Predictions over time */}
          <div className="relative overflow-x-auto">
            <div className="mb-1.5 text-[10px] font-extrabold uppercase tracking-wider opacity-70">
              Projection checkpoints over time
            </div>
            <table className="w-full min-w-[520px] text-[11px] font-mono">
              <thead>
                <tr
                  className={`text-[9px] uppercase tracking-wider ${
                    isLight ? 'text-slate-500' : 'text-slate-400'
                  }`}
                >
                  <th className="py-1.5 text-left font-bold">Checkpoint</th>
                  <th className="py-1.5 text-left font-bold">Approx. date</th>
                  <th className="py-1.5 text-right font-bold">P5 downside</th>
                  <th className="py-1.5 text-right font-bold">Median P50</th>
                  <th className="py-1.5 text-right font-bold">P95 upside</th>
                  <th className="py-1.5 text-right font-bold">Above start</th>
                </tr>
              </thead>
              <tbody>
                {milestones.map((p, idx) => (
                  <tr
                    key={`${p.trade}-${idx}`}
                    className={`border-t ${
                      isLight ? 'border-slate-200/80' : 'border-white/[0.06]'
                    }`}
                  >
                    <td className="py-1.5 font-bold">
                      {[25, 50, 75, 100][idx]}% · T{p.trade}
                    </td>
                    <td className="py-1.5 opacity-65">
                      {projectDate(baseMs, p.trade, tradesPerDay)}
                    </td>
                    <td className="py-1.5 text-right" style={{ color: series[4].color }}>
                      {formatMoney(p.p5, currency)}
                    </td>
                    <td className="py-1.5 text-right font-black" style={{ color: series[2].color }}>
                      {formatMoney(p.p50, currency)}
                    </td>
                    <td className="py-1.5 text-right" style={{ color: series[0].color }}>
                      {formatMoney(p.p95, currency)}
                    </td>
                    <td className="py-1.5 text-right">{p.aboveStart.toFixed(0)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {historicalPnls.length < 10 && (
            <div
              className={`flex items-start gap-2 rounded-xl border px-3 py-2 text-[10.5px] ${
                isLight
                  ? 'border-amber-200 bg-amber-50 text-amber-800'
                  : 'border-amber-400/25 bg-amber-500/10 text-amber-200'
              }`}
            >
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                Only {historicalPnls.length} closed trade{historicalPnls.length === 1 ? '' : 's'} in
                this sample — projections are highly sensitive to individual outliers. Backtest more
                trades for a more stable distribution.
              </span>
            </div>
          )}

          <div className="flex items-start gap-2 text-[10px] opacity-55 leading-snug">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              Simulation only: each run randomly resamples the realised P&amp;L of your filtered
              backtested trades (with replacement), the standard Monte Carlo method used in
              professional backtest reports. P5/P25/P50/P75/P95 are cross-sectional percentiles at
              each trade, not a single "best" or "worst" run. Assumes your future trade distribution
              and position sizing stay the same; ignores changing market conditions. Not a forecast
              or financial advice. Dates are estimates from the trades-per-day setting.
            </span>
          </div>
        </>
      )}
    </section>
  );
};
