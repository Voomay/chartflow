import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { formatMoney } from '../../services/simulationEngine';

/* -------------------------------------------------------------------------- */
/*                               Shared helpers                               */
/* -------------------------------------------------------------------------- */

export type ChartCurrency = Parameters<typeof formatMoney>[1];

export interface CurvePoint {
  index: number;
  timestamp: number;
  label: string;
  balance: number;
  equity: number;
  tradePnl: number;
  drawdownDollars: number;
  drawdownPct: number;
}

interface XY {
  x: number;
  y: number;
}

const isFiniteNum = (v: number) => typeof v === 'number' && Number.isFinite(v);

/**
 * Monotone cubic interpolation (Fritsch–Carlson, same as d3.curveMonotoneX).
 * Produces a smooth bezier path that never overshoots the data between
 * points, so e.g. a drawdown curve never rises above 0%.
 */
export function monotonePath(points: XY[]): string {
  const pts = points.filter((p) => isFiniteNum(p.x) && isFiniteNum(p.y));
  const n = pts.length;
  if (n === 0) return '';
  if (n === 1) return `M${pts[0].x},${pts[0].y}`;
  if (n === 2) return `M${pts[0].x},${pts[0].y}L${pts[1].x},${pts[1].y}`;

  const dx: number[] = [];
  const slope: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    const h = pts[i + 1].x - pts[i].x;
    dx.push(h);
    slope.push(h === 0 ? 0 : (pts[i + 1].y - pts[i].y) / h);
  }

  const tangent: number[] = new Array(n).fill(0);
  tangent[0] = slope[0];
  tangent[n - 1] = slope[n - 2];
  for (let i = 1; i < n - 1; i++) {
    const s0 = slope[i - 1];
    const s1 = slope[i];
    if (s0 * s1 <= 0) {
      tangent[i] = 0;
    } else {
      const h0 = dx[i - 1];
      const h1 = dx[i];
      const w1 = 2 * h1 + h0;
      const w2 = h1 + 2 * h0;
      tangent[i] = (w1 + w2) / (w1 / s0 + w2 / s1);
    }
  }

  let d = `M${pts[0].x},${pts[0].y}`;
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i] / 3;
    const c1x = pts[i].x + h;
    const c1y = pts[i].y + tangent[i] * h;
    const c2x = pts[i + 1].x - h;
    const c2y = pts[i + 1].y - tangent[i + 1] * h;
    d += `C${c1x},${c1y},${c2x},${c2y},${pts[i + 1].x},${pts[i + 1].y}`;
  }
  return d;
}

/** "Nice" rounded axis ticks spanning [min, max]. */
export function niceTicks(min: number, max: number, count = 5) {
  if (!isFiniteNum(min) || !isFiniteNum(max)) {
    return { ticks: [0, 1], min: 0, max: 1, step: 1 };
  }
  if (min === max) {
    const pad = Math.abs(min) * 0.01 || 1;
    min -= pad;
    max += pad;
  }
  if (min > max) [min, max] = [max, min];
  const rawStep = (max - min) / Math.max(1, count);
  const mag = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const norm = rawStep / mag;
  const niceNorm = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10;
  const step = niceNorm * mag;
  const niceMin = Math.floor(min / step + 1e-9) * step;
  const niceMax = Math.ceil(max / step - 1e-9) * step;
  const ticks: number[] = [];
  for (let v = niceMin; v <= niceMax + step * 0.5; v += step) {
    ticks.push(Number(v.toFixed(10)));
    if (ticks.length > 50) break;
  }
  return { ticks, min: niceMin, max: niceMax, step };
}

function decimalsForStep(step: number) {
  if (!isFiniteNum(step) || step <= 0) return 0;
  return Math.max(0, Math.min(4, -Math.floor(Math.log10(step) + 1e-9)));
}

export function compactNumber(v: number, step = 1) {
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `${(v / 1_000_000).toFixed(step >= 100_000 ? 1 : 2)}M`;
  if (abs >= 10_000) return `${(v / 1000).toFixed(step >= 1000 ? 0 : 1)}k`;
  return v.toLocaleString('en-US', {
    minimumFractionDigits: decimalsForStep(step),
    maximumFractionDigits: decimalsForStep(step),
  });
}

/** Evenly spaced x tick indices (always includes the first & last index). */
function xTickIndices(n: number, maxTicks: number) {
  if (n <= 0) return [];
  if (n === 1) return [0];
  const count = Math.max(2, Math.min(n, maxTicks));
  const set = new Set<number>();
  for (let k = 0; k < count; k++) set.add(Math.round((k / (count - 1)) * (n - 1)));
  return Array.from(set).sort((a, b) => a - b);
}

function xTickLabel(p: CurvePoint) {
  if (p.label === 'Start') return 'Start';
  if (p.label === 'Live Open') return 'Live';
  return `#${p.index}`;
}

function shortDate(ts: number) {
  if (!isFiniteNum(ts) || ts <= 0) return '';
  const d = new Date(ts * 1000);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

/** Tracks an element's rendered width so SVG text stays crisp (no scaling). */
function useElementWidth<T extends HTMLElement>(fallback = 600) {
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

function useHoverIndex(n: number, padL: number, innerW: number) {
  const [hover, setHover] = useState<number | null>(null);
  const onMove = useCallback(
    (e: React.MouseEvent<SVGRectElement>) => {
      if (n <= 0) return;
      const svg = e.currentTarget.ownerSVGElement;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const x = e.clientX - rect.left - padL;
      const ratio = innerW > 0 ? x / innerW : 0;
      const idx = Math.round(Math.max(0, Math.min(1, ratio)) * (n - 1));
      setHover(idx);
    },
    [n, padL, innerW]
  );
  const onLeave = useCallback(() => setHover(null), []);
  return { hover, onMove, onLeave };
}

const useSafeId = () => useId().replace(/:/g, '');

interface TooltipProps {
  x: number;
  y: number;
  containerWidth: number;
  isLight: boolean;
  children: React.ReactNode;
}

const ChartTooltip: React.FC<TooltipProps> = ({ x, y, containerWidth, isLight, children }) => {
  const flip = x > containerWidth * 0.6;
  return (
    <div
      className={`pointer-events-none absolute z-20 min-w-[150px] rounded-xl border px-3 py-2 text-[11px] font-mono shadow-2xl backdrop-blur-md transition-[left,top] duration-75 ${
        isLight
          ? 'bg-white/95 border-slate-200 text-slate-800'
          : 'bg-[#0f1219]/90 border-white/10 text-slate-100'
      }`}
      style={{
        left: flip ? undefined : x + 14,
        right: flip ? containerWidth - x + 14 : undefined,
        top: Math.max(4, y - 20),
      }}
    >
      {children}
    </div>
  );
};

const TooltipRow: React.FC<{ label: string; value: string; color?: string }> = ({
  label,
  value,
  color,
}) => (
  <div className="flex items-center justify-between gap-4 leading-5">
    <span className="flex items-center gap-1.5 opacity-70">
      {color && <span className="h-2 w-2 rounded-full" style={{ background: color }} />}
      {label}
    </span>
    <span className="font-bold" style={color ? { color } : undefined}>
      {value}
    </span>
  </div>
);

/* -------------------------------------------------------------------------- */
/*                             Equity curve chart                             */
/* -------------------------------------------------------------------------- */

interface EquityCurveChartProps {
  points: CurvePoint[];
  initialBalance: number;
  targetLine: number | null;
  floorLine: number | null;
  currency: ChartCurrency;
  isLight: boolean;
  height?: number;
}

export const EquityCurveChart: React.FC<EquityCurveChartProps> = ({
  points,
  initialBalance,
  targetLine,
  floorLine,
  currency,
  isLight,
  height = 280,
}) => {
  const uid = useSafeId();
  const [wrapRef, width] = useElementWidth<HTMLDivElement>(720);
  const pts = useMemo(
    () => points.filter((p) => isFiniteNum(p.equity) && isFiniteNum(p.balance)),
    [points]
  );
  const n = pts.length;

  const padL = 62;
  const padR = 58;
  const padT = 16;
  const padB = 40;
  const w = Math.max(240, width);
  const h = height;
  const innerW = Math.max(1, w - padL - padR);
  const innerH = Math.max(1, h - padT - padB);

  const base = isFiniteNum(initialBalance) ? initialBalance : pts[0]?.equity ?? 0;
  const values = [
    base,
    ...pts.map((p) => p.equity),
    ...pts.map((p) => p.balance),
    ...(targetLine !== null && isFiniteNum(targetLine) ? [targetLine] : []),
    ...(floorLine !== null && isFiniteNum(floorLine) ? [floorLine] : []),
  ];
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  const padV = (rawMax - rawMin) * 0.06;
  const axis = niceTicks(rawMin - padV, rawMax + padV, Math.max(3, Math.round(innerH / 48)));
  const span = Math.max(1e-9, axis.max - axis.min);

  const toY = (v: number) => padT + innerH - ((v - axis.min) / span) * innerH;
  const toX = (i: number) => (n <= 1 ? padL + innerW / 2 : padL + (i / (n - 1)) * innerW);

  const eqXY = pts.map((p, i) => ({ x: toX(i), y: toY(p.equity) }));
  const balXY = pts.map((p, i) => ({ x: toX(i), y: toY(p.balance) }));
  const eqPath = monotonePath(eqXY);
  const balPath = monotonePath(balXY);
  const bottomY = padT + innerH;
  const areaPath =
    n > 1 ? `${eqPath}L${eqXY[n - 1].x},${bottomY}L${eqXY[0].x},${bottomY}Z` : '';

  const last = pts[n - 1];
  const isUp = last ? last.equity >= base : true;
  const lineA = isUp ? '#22d3ee' : '#fb7185';
  const lineB = isUp ? '#3b82f6' : '#6366f1';
  const lineC = isUp ? '#818cf8' : '#a855f7';

  const { hover, onMove, onLeave } = useHoverIndex(n, padL, innerW);
  const hp = hover !== null ? pts[hover] : null;
  const xTicks = xTickIndices(n, Math.max(2, Math.floor(innerW / 80)));
  const gridColor = isLight ? 'rgba(15,23,42,0.07)' : 'rgba(148,163,184,0.08)';
  const axisText = isLight ? '#64748b' : '#7c8799';

  const refLines: { v: number; color: string; label: string; dash: string }[] = [
    { v: base, color: '#64748b', label: 'Start', dash: '3 4' },
  ];
  if (targetLine !== null && isFiniteNum(targetLine))
    refLines.push({ v: targetLine, color: '#10b981', label: 'Target', dash: '6 4' });
  if (floorLine !== null && isFiniteNum(floorLine))
    refLines.push({ v: floorLine, color: '#f43f5e', label: 'Floor', dash: '6 4' });

  return (
    <div ref={wrapRef} className="relative w-full select-none" style={{ height: h }}>
      <svg
        width={w}
        height={h}
        viewBox={`0 0 ${w} ${h}`}
        className="block overflow-visible"
        role="img"
        aria-label="Balance and equity curve"
      >
        <defs>
          <linearGradient id={`eqFill-${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={lineB} stopOpacity={0.38} />
            <stop offset="55%" stopColor={lineC} stopOpacity={0.12} />
            <stop offset="100%" stopColor={lineC} stopOpacity={0} />
          </linearGradient>
          <linearGradient id={`eqStroke-${uid}`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={lineC} />
            <stop offset="55%" stopColor={lineB} />
            <stop offset="100%" stopColor={lineA} />
          </linearGradient>
          <filter id={`eqGlow-${uid}`} x="-10%" y="-30%" width="120%" height="160%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Horizontal grid + Y labels */}
        {axis.ticks.map((t) => (
          <g key={`y-${t}`}>
            <line
              x1={padL}
              x2={w - padR}
              y1={toY(t)}
              y2={toY(t)}
              stroke={gridColor}
              strokeWidth={1}
            />
            <text
              x={padL - 10}
              y={toY(t)}
              textAnchor="end"
              dominantBaseline="middle"
              fontSize={10}
              fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
              fill={axisText}
            >
              {compactNumber(t, axis.step)}
            </text>
          </g>
        ))}

        {/* X labels */}
        {xTicks.map((i) => (
          <g key={`x-${i}`}>
            <line
              x1={toX(i)}
              x2={toX(i)}
              y1={padT}
              y2={bottomY}
              stroke={gridColor}
              strokeDasharray="2 4"
            />
            <text
              x={toX(i)}
              y={bottomY + 15}
              textAnchor="middle"
              fontSize={10}
              fontWeight={700}
              fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
              fill={axisText}
            >
              {xTickLabel(pts[i])}
            </text>
            <text
              x={toX(i)}
              y={bottomY + 28}
              textAnchor="middle"
              fontSize={9}
              fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
              fill={axisText}
              opacity={0.7}
            >
              {shortDate(pts[i].timestamp)}
            </text>
          </g>
        ))}

        {/* Reference lines (start / target / floor) */}
        {refLines.map((r) => (
          <g key={r.label}>
            <line
              x1={padL}
              x2={w - padR}
              y1={toY(r.v)}
              y2={toY(r.v)}
              stroke={r.color}
              strokeOpacity={0.75}
              strokeDasharray={r.dash}
              strokeWidth={1.25}
            />
            <rect
              x={w - padR + 4}
              y={toY(r.v) - 8}
              width={padR - 6}
              height={16}
              rx={5}
              fill={r.color}
              fillOpacity={0.16}
              stroke={r.color}
              strokeOpacity={0.4}
            />
            <text
              x={w - padR + 4 + (padR - 6) / 2}
              y={toY(r.v)}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={9}
              fontWeight={800}
              fill={r.color}
            >
              {r.label}
            </text>
          </g>
        ))}

        {n > 1 && (
          <>
            <path d={areaPath} fill={`url(#eqFill-${uid})`} />
            <path
              d={balPath}
              fill="none"
              stroke="#10b981"
              strokeOpacity={0.85}
              strokeWidth={1.75}
              strokeDasharray="5 4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d={eqPath}
              fill="none"
              stroke={`url(#eqStroke-${uid})`}
              strokeWidth={2.75}
              strokeLinecap="round"
              strokeLinejoin="round"
              filter={`url(#eqGlow-${uid})`}
            />
          </>
        )}

        {/* Last point marker */}
        {last && (
          <g>
            <circle cx={toX(n - 1)} cy={toY(last.equity)} r={7} fill={lineA} opacity={0.2}>
              <animate attributeName="r" values="5;10;5" dur="2.4s" repeatCount="indefinite" />
              <animate
                attributeName="opacity"
                values="0.35;0.05;0.35"
                dur="2.4s"
                repeatCount="indefinite"
              />
            </circle>
            <circle
              cx={toX(n - 1)}
              cy={toY(last.equity)}
              r={3.5}
              fill={lineA}
              stroke={isLight ? '#fff' : '#0d0f13'}
              strokeWidth={1.5}
            />
          </g>
        )}

        {/* Hover crosshair */}
        {hp && hover !== null && (
          <g pointerEvents="none">
            <line
              x1={toX(hover)}
              x2={toX(hover)}
              y1={padT}
              y2={bottomY}
              stroke={isLight ? '#94a3b8' : '#475569'}
              strokeDasharray="3 3"
            />
            <line
              x1={padL}
              x2={w - padR}
              y1={toY(hp.equity)}
              y2={toY(hp.equity)}
              stroke={isLight ? '#cbd5e1' : '#334155'}
              strokeDasharray="3 3"
            />
            <rect
              x={2}
              y={toY(hp.equity) - 9}
              width={padL - 6}
              height={18}
              rx={5}
              fill={lineB}
            />
            <text
              x={2 + (padL - 6) / 2}
              y={toY(hp.equity)}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={10}
              fontWeight={800}
              fill="#fff"
              fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
            >
              {compactNumber(hp.equity, axis.step / 10)}
            </text>
            <circle
              cx={toX(hover)}
              cy={toY(hp.balance)}
              r={3.5}
              fill="#10b981"
              stroke={isLight ? '#fff' : '#0d0f13'}
              strokeWidth={1.5}
            />
            <circle
              cx={toX(hover)}
              cy={toY(hp.equity)}
              r={5}
              fill={lineB}
              stroke="#fff"
              strokeWidth={2}
            />
          </g>
        )}

        {/* Interaction layer */}
        <rect
          x={padL}
          y={padT}
          width={innerW}
          height={innerH}
          fill="transparent"
          onMouseMove={onMove}
          onMouseLeave={onLeave}
          style={{ cursor: n > 0 ? 'crosshair' : 'default' }}
        />
      </svg>

      {n === 0 && (
        <div className="absolute inset-0 flex items-center justify-center text-xs opacity-60">
          No equity data yet
        </div>
      )}
      {n === 1 && (
        <div className="absolute left-1/2 top-3 -translate-x-1/2 rounded-full bg-blue-500/10 px-3 py-1 text-[10px] font-bold text-blue-400">
          Close a trade to start drawing the curve
        </div>
      )}

      {hp && hover !== null && (
        <ChartTooltip x={toX(hover)} y={toY(hp.equity)} containerWidth={w} isLight={isLight}>
          <div className="mb-1 flex items-center justify-between gap-3 border-b border-gray-500/20 pb-1">
            <span className="font-extrabold">{hp.label}</span>
            <span className="opacity-60">{shortDate(hp.timestamp)}</span>
          </div>
          <TooltipRow label="Equity" value={formatMoney(hp.equity, currency)} color={lineB} />
          <TooltipRow label="Balance" value={formatMoney(hp.balance, currency)} color="#10b981" />
          {hover > 0 && (
            <TooltipRow
              label="Trade P&L"
              value={formatMoney(hp.tradePnl, currency, true)}
              color={hp.tradePnl >= 0 ? '#34d399' : '#fb7185'}
            />
          )}
          <TooltipRow
            label="vs Start"
            value={formatMoney(hp.equity - base, currency, true)}
            color={hp.equity - base >= 0 ? '#34d399' : '#fb7185'}
          />
          <TooltipRow
            label="Drawdown"
            value={hp.drawdownPct > 0 ? `-${hp.drawdownPct.toFixed(2)}%` : '0.00%'}
            color={hp.drawdownPct > 0 ? '#fb7185' : undefined}
          />
        </ChartTooltip>
      )}
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/*                               Drawdown chart                               */
/* -------------------------------------------------------------------------- */

interface DrawdownChartProps {
  points: CurvePoint[];
  currency: ChartCurrency;
  isLight: boolean;
  height?: number;
  /** Optional max allowed drawdown (e.g. prop firm limit) drawn as a guide. */
  limitPct?: number | null;
}

export const DrawdownChart: React.FC<DrawdownChartProps> = ({
  points,
  currency,
  isLight,
  height = 210,
  limitPct = null,
}) => {
  const uid = useSafeId();
  const [wrapRef, width] = useElementWidth<HTMLDivElement>(360);
  const pts = useMemo(
    () =>
      points.map((p) => ({
        ...p,
        drawdownPct: isFiniteNum(p.drawdownPct) ? Math.max(0, p.drawdownPct) : 0,
        drawdownDollars: isFiniteNum(p.drawdownDollars) ? Math.max(0, p.drawdownDollars) : 0,
      })),
    [points]
  );
  const n = pts.length;

  const padL = 50;
  const padR = 14;
  const padT = 14;
  const padB = 30;
  const w = Math.max(200, width);
  const h = height;
  const innerW = Math.max(1, w - padL - padR);
  const innerH = Math.max(1, h - padT - padB);

  let maxIdx = -1;
  let maxDD = 0;
  pts.forEach((p, i) => {
    if (p.drawdownPct > maxDD) {
      maxDD = p.drawdownPct;
      maxIdx = i;
    }
  });
  const hasDD = maxDD > 0;
  const showLimit = limitPct !== null && isFiniteNum(limitPct) && limitPct > 0;
  const deepest = Math.max(
    hasDD ? maxDD * 1.15 : 1,
    showLimit && limitPct !== null && limitPct <= Math.max(maxDD * 2.5, 1) ? limitPct * 1.08 : 0
  );
  const axis = niceTicks(-deepest, 0, Math.max(3, Math.round(innerH / 40)));
  const axisMin = Math.min(axis.min, -1e-6);
  const span = Math.max(1e-9, 0 - axisMin);
  const decimals = decimalsForStep(axis.step);

  const toY = (dd: number) => padT + (dd / span) * innerH; // dd is positive magnitude
  const toX = (i: number) => (n <= 1 ? padL + innerW / 2 : padL + (i / (n - 1)) * innerW);
  const zeroY = toY(0);
  const bottomY = padT + innerH;

  const xy = pts.map((p, i) => ({ x: toX(i), y: toY(p.drawdownPct) }));
  const linePath = monotonePath(xy);
  const areaPath = n > 1 ? `${linePath}L${xy[n - 1].x},${zeroY}L${xy[0].x},${zeroY}Z` : '';

  const last = pts[n - 1];
  const currentDD = last?.drawdownPct ?? 0;
  const { hover, onMove, onLeave } = useHoverIndex(n, padL, innerW);
  const hp = hover !== null ? pts[hover] : null;
  const xTicks = xTickIndices(n, Math.max(2, Math.floor(innerW / 64)));
  const gridColor = isLight ? 'rgba(15,23,42,0.07)' : 'rgba(148,163,184,0.08)';
  const axisText = isLight ? '#64748b' : '#7c8799';
  const fmtPct = (v: number) => (v <= 0 ? '0%' : `-${v.toFixed(decimals)}%`);

  // Max DD label placement (keep inside the plot)
  const maxX = maxIdx >= 0 ? toX(maxIdx) : 0;
  const maxY = maxIdx >= 0 ? toY(maxDD) : 0;
  const labelW = 92;
  const labelH = 30;
  let labelX = maxX - labelW / 2;
  labelX = Math.max(padL + 2, Math.min(w - padR - labelW - 2, labelX));
  const labelBelow = maxY + 10 + labelH < bottomY;
  const labelY = labelBelow ? maxY + 10 : maxY - labelH - 10;

  return (
    <div ref={wrapRef} className="relative w-full select-none" style={{ height: h }}>
      <svg
        width={w}
        height={h}
        viewBox={`0 0 ${w} ${h}`}
        className="block overflow-visible"
        role="img"
        aria-label="Drawdown curve"
      >
        <defs>
          <linearGradient id={`ddFill-${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#fb7185" stopOpacity={0.05} />
            <stop offset="60%" stopColor="#f43f5e" stopOpacity={0.28} />
            <stop offset="100%" stopColor="#be123c" stopOpacity={0.55} />
          </linearGradient>
          <linearGradient
            id={`ddStroke-${uid}`}
            gradientUnits="userSpaceOnUse"
            x1="0"
            y1={zeroY}
            x2="0"
            y2={hasDD ? toY(maxDD) : bottomY}
          >
            <stop offset="0%" stopColor="#fda4af" />
            <stop offset="100%" stopColor="#e11d48" />
          </linearGradient>
          <filter id={`ddGlow-${uid}`} x="-10%" y="-30%" width="120%" height="160%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Grid + Y axis labels */}
        {axis.ticks
          .filter((t) => t <= 1e-9 && t >= axisMin - 1e-9)
          .map((t) => {
            const mag = Math.abs(t);
            return (
              <g key={`dy-${t}`}>
                <line
                  x1={padL}
                  x2={w - padR}
                  y1={toY(mag)}
                  y2={toY(mag)}
                  stroke={mag === 0 ? (isLight ? '#94a3b8' : '#475569') : gridColor}
                  strokeWidth={1}
                />
                <text
                  x={padL - 8}
                  y={toY(mag)}
                  textAnchor="end"
                  dominantBaseline="middle"
                  fontSize={10}
                  fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
                  fill={mag === 0 ? (isLight ? '#334155' : '#cbd5e1') : axisText}
                >
                  {fmtPct(mag)}
                </text>
              </g>
            );
          })}

        {/* X labels */}
        {xTicks.map((i) => (
          <text
            key={`dx-${i}`}
            x={toX(i)}
            y={bottomY + 17}
            textAnchor="middle"
            fontSize={10}
            fontWeight={700}
            fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
            fill={axisText}
          >
            {xTickLabel(pts[i])}
          </text>
        ))}

        {/* Prop-firm drawdown limit guide (only if within visible range) */}
        {showLimit && limitPct !== null && limitPct <= span && (
          <g>
            <line
              x1={padL}
              x2={w - padR}
              y1={toY(limitPct)}
              y2={toY(limitPct)}
              stroke="#f59e0b"
              strokeDasharray="6 4"
              strokeOpacity={0.8}
            />
            <text
              x={w - padR - 4}
              y={toY(limitPct) - 5}
              textAnchor="end"
              fontSize={9}
              fontWeight={800}
              fill="#f59e0b"
            >
              Limit -{limitPct}%
            </text>
          </g>
        )}

        {n > 1 && (
          <>
            <path d={areaPath} fill={`url(#ddFill-${uid})`} />
            <path
              d={linePath}
              fill="none"
              stroke={hasDD ? `url(#ddStroke-${uid})` : '#fb7185'}
              strokeWidth={2.25}
              strokeLinecap="round"
              strokeLinejoin="round"
              filter={`url(#ddGlow-${uid})`}
            />
          </>
        )}

        {/* Max drawdown marker */}
        {hasDD && maxIdx >= 0 && (
          <g pointerEvents="none">
            <line
              x1={maxX}
              x2={maxX}
              y1={zeroY}
              y2={maxY}
              stroke="#fb7185"
              strokeOpacity={0.45}
              strokeDasharray="2 3"
            />
            <circle cx={maxX} cy={maxY} r={8} fill="#f43f5e" opacity={0.18} />
            <circle
              cx={maxX}
              cy={maxY}
              r={4}
              fill="#f43f5e"
              stroke={isLight ? '#fff' : '#0d0f13'}
              strokeWidth={2}
            />
            {hover === null && (
              <g>
                <rect
                  x={labelX}
                  y={labelY}
                  width={labelW}
                  height={labelH}
                  rx={7}
                  fill={isLight ? '#fff1f2' : '#2a0f17'}
                  stroke="#f43f5e"
                  strokeOpacity={0.55}
                />
                <text
                  x={labelX + labelW / 2}
                  y={labelY + 12}
                  textAnchor="middle"
                  fontSize={10}
                  fontWeight={900}
                  fill="#fb7185"
                  fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
                >
                  MAX -{maxDD.toFixed(2)}%
                </text>
                <text
                  x={labelX + labelW / 2}
                  y={labelY + 23}
                  textAnchor="middle"
                  fontSize={9}
                  fill={isLight ? '#9f1239' : '#fda4af'}
                  opacity={0.85}
                  fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
                >
                  {formatMoney(-pts[maxIdx].drawdownDollars, currency)}
                </text>
              </g>
            )}
          </g>
        )}

        {/* Current drawdown marker */}
        {last && n > 1 && (
          <circle
            cx={toX(n - 1)}
            cy={toY(currentDD)}
            r={3.5}
            fill={currentDD > 0 ? '#fb7185' : '#34d399'}
            stroke={isLight ? '#fff' : '#0d0f13'}
            strokeWidth={1.5}
          />
        )}

        {/* Hover crosshair */}
        {hp && hover !== null && (
          <g pointerEvents="none">
            <line
              x1={toX(hover)}
              x2={toX(hover)}
              y1={padT}
              y2={bottomY}
              stroke={isLight ? '#94a3b8' : '#475569'}
              strokeDasharray="3 3"
            />
            <line
              x1={padL}
              x2={w - padR}
              y1={toY(hp.drawdownPct)}
              y2={toY(hp.drawdownPct)}
              stroke={isLight ? '#cbd5e1' : '#334155'}
              strokeDasharray="3 3"
            />
            <rect
              x={2}
              y={toY(hp.drawdownPct) - 9}
              width={padL - 6}
              height={18}
              rx={5}
              fill="#e11d48"
            />
            <text
              x={2 + (padL - 6) / 2}
              y={toY(hp.drawdownPct)}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={10}
              fontWeight={800}
              fill="#fff"
              fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
            >
              {hp.drawdownPct > 0 ? `-${hp.drawdownPct.toFixed(2)}` : '0.00'}
            </text>
            <circle
              cx={toX(hover)}
              cy={toY(hp.drawdownPct)}
              r={5}
              fill="#f43f5e"
              stroke="#fff"
              strokeWidth={2}
            />
          </g>
        )}

        <rect
          x={padL}
          y={padT}
          width={innerW}
          height={innerH}
          fill="transparent"
          onMouseMove={onMove}
          onMouseLeave={onLeave}
          style={{ cursor: n > 0 ? 'crosshair' : 'default' }}
        />
      </svg>

      {n <= 1 && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-[11px] opacity-60">
          {n === 0 ? 'No drawdown data yet' : 'Close a trade to track drawdown'}
        </div>
      )}
      {n > 1 && !hasDD && (
        <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-[10px] font-bold text-emerald-400">
          No drawdown — equity at peak
        </div>
      )}

      {hp && hover !== null && (
        <ChartTooltip
          x={toX(hover)}
          y={toY(hp.drawdownPct)}
          containerWidth={w}
          isLight={isLight}
        >
          <div className="mb-1 flex items-center justify-between gap-3 border-b border-gray-500/20 pb-1">
            <span className="font-extrabold">{hp.label}</span>
            <span className="opacity-60">{shortDate(hp.timestamp)}</span>
          </div>
          <TooltipRow
            label="Drawdown"
            value={hp.drawdownPct > 0 ? `-${hp.drawdownPct.toFixed(2)}%` : '0.00%'}
            color="#fb7185"
          />
          <TooltipRow
            label="From peak"
            value={formatMoney(-hp.drawdownDollars, currency)}
            color="#fda4af"
          />
          <TooltipRow label="Equity" value={formatMoney(hp.equity, currency)} />
        </ChartTooltip>
      )}
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/*                         Gradient horizontal bar row                        */
/* -------------------------------------------------------------------------- */

const BAR_GRADIENTS: Record<string, string> = {
  win: 'linear-gradient(90deg, #059669 0%, #10b981 55%, #6ee7b7 100%)',
  loss: 'linear-gradient(90deg, #be123c 0%, #f43f5e 55%, #fda4af 100%)',
  flat: 'linear-gradient(90deg, #4f46e5 0%, #3b82f6 55%, #93c5fd 100%)',
};

export const GradientBar: React.FC<{
  label: string;
  value: number;
  max: number;
  tone?: string;
  suffix?: string;
}> = ({ label, value, max, tone = 'flat', suffix }) => {
  const pct = max > 0 && isFiniteNum(value) ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  const gradient = BAR_GRADIENTS[tone] || BAR_GRADIENTS.flat;
  const glow =
    tone === 'win'
      ? 'rgba(16,185,129,0.45)'
      : tone === 'loss'
      ? 'rgba(244,63,94,0.45)'
      : 'rgba(59,130,246,0.45)';
  return (
    <div className="group flex items-center gap-2">
      <span className="w-28 truncate opacity-80 group-hover:opacity-100 transition">{label}</span>
      <div className="relative h-2.5 flex-1 overflow-hidden rounded-full bg-gray-500/15">
        <div
          className="h-full rounded-full transition-[width] duration-700 ease-out"
          style={{
            width: `${pct}%`,
            background: gradient,
            boxShadow: pct > 0 ? `0 0 10px ${glow}` : undefined,
          }}
        />
      </div>
      <span className="w-8 text-right font-bold tabular-nums">
        {value}
        {suffix}
      </span>
    </div>
  );
};
