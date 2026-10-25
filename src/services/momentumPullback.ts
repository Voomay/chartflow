import { Candle } from '../types/trading';

export type MomentumSession = 'all' | 'london' | 'newyork' | 'sa-morning' | 'sa-afternoon';
export interface MomentumOptions { session: MomentumSession; requireVolume: boolean; minRelativeVolume: number }
export interface MomentumSetup { time: number; side: 'LONG' | 'SHORT'; entry: number; stop: number; target: number; relativeVolume: number | null; volumeConfirmed: boolean }
export interface MomentumPoint { time: number; fast: number; slow: number; atr: number; relativeVolume: number | null }
export const MOMENTUM_DEFAULTS: MomentumOptions = { session: 'all', requireVolume: true, minRelativeVolume: 1.2 };
const clocks = new Map<string, Intl.DateTimeFormat>();
function hourAt(time: number, zone: string) {
  let clock = clocks.get(zone);
  if (!clock) { clock = new Intl.DateTimeFormat('en-GB', { timeZone: zone, hour: '2-digit', hourCycle: 'h23' }); clocks.set(zone, clock); }
  return Number(clock.format(new Date(time * 1000)));
}
export function inMomentumSession(time: number, session: MomentumSession) {
  if (session === 'all') return true;
  const zone = session === 'london' ? 'Europe/London' : session === 'newyork' ? 'America/New_York' : 'Africa/Johannesburg';
  const h = hourAt(time, zone);
  return session === 'london' || session === 'newyork' ? h >= 8 && h < 12 : session === 'sa-morning' ? h >= 9 && h < 11 : h >= 13 && h < 15;
}
/** Causal study. The final candle is always excluded: its close is not yet confirmed.
 * Zero/absent volume never confirms a setup. No synthetic volume is substituted.
 * Signals describe a close-price plan, not an executable historic fill. */
export function computeMomentumPullback(candles: Candle[], stepSeconds: number, options: MomentumOptions = MOMENTUM_DEFAULTS) {
  const points: MomentumPoint[] = [], setups: MomentumSetup[] = [];
  let fast = 0, slow = 0, atr = 0, volumeSum = 0, volumeCount = 0;
  let pending: { side: 'LONG' | 'SHORT'; index: number; extreme: number; touched: boolean; impulseVolume: boolean } | null = null;
  const bars = candles.slice(0, -1);
  for (let i = 0; i < bars.length; i++) {
    const b = bars[i], prev = bars[i - 1];
    const previousFast = fast;
    const tr = prev ? Math.max(b.high - b.low, Math.abs(b.high - prev.close), Math.abs(b.low - prev.close)) : b.high - b.low;
    fast = i ? fast + (b.close - fast) * 2 / 21 : b.close;
    slow = i ? slow + (b.close - slow) * 2 / 51 : b.close;
    const priorATR = atr;
    atr = i ? (atr * 13 + tr) / 14 : tr;
    const rv = b.volume > 0 && volumeCount === 20 && volumeSum > 0 ? b.volume / (volumeSum / 20) : null;
    points.push({ time: b.time, fast, slow, atr, relativeVolume: rv });
    // Compare against the PRIOR 20 bars, never the current bar or future bars.
    if (b.volume > 0 && Number.isFinite(b.volume)) { volumeSum += b.volume; volumeCount++; }
    if (i >= 20 && bars[i - 20].volume > 0 && Number.isFinite(bars[i - 20].volume)) { volumeSum -= bars[i - 20].volume; volumeCount--; }
    if (i < 55 || !prev || priorATR <= 0) continue;
    if (b.time - prev.time > Math.max(stepSeconds, 60) * 3) { pending = null; continue; }
    const direction = fast > slow && b.close > slow ? 'LONG' : fast < slow && b.close < slow ? 'SHORT' : null;
    const volumePass = rv !== null && rv >= options.minRelativeVolume;
    if (pending) {
      if (i - pending.index > 10 || direction !== pending.side) pending = null;
      else {
        const isLong = pending.side === 'LONG';
        const hadTouch = pending.touched;
        pending.extreme = isLong ? Math.min(pending.extreme, b.low) : Math.max(pending.extreme, b.high);
        // Previous-bar EMA zone prevents using a future pivot or repainting swing point.
        if (isLong ? b.low <= previousFast + 0.25 * priorATR : b.high >= previousFast - 0.25 * priorATR) pending.touched = true;
        const continuation = hadTouch && (isLong ? b.close > prev.high && b.close > b.open : b.close < prev.low && b.close < b.open) && Math.abs(b.close - b.open) >= 0.45 * priorATR;
        if (continuation && inMomentumSession(b.time, options.session) && (!options.requireVolume || (volumePass && pending.impulseVolume))) {
          const stop = pending.extreme + (isLong ? -0.15 : 0.15) * priorATR;
          const risk = Math.abs(b.close - stop);
          if (risk >= 0.4 * priorATR && risk <= 4 * priorATR) {
            setups.push({ time: b.time, side: pending.side, entry: b.close, stop, target: b.close + (isLong ? 2 : -2) * risk, relativeVolume: rv, volumeConfirmed: volumePass && pending.impulseVolume });
            pending = null;
            continue;
          }
        }
      }
    }
    const impulse = direction && (direction === 'LONG' ? b.close > b.open && b.close > prev.high : b.close < b.open && b.close < prev.low) && Math.abs(b.close - b.open) >= 0.8 * priorATR && Math.abs(b.close - b.open) / Math.max(b.high - b.low, 1e-10) >= 0.6;
    if (!pending && impulse && (!options.requireVolume || volumePass)) pending = { side: direction!, index: i, extreme: b.close, touched: false, impulseVolume: volumePass };
  }
  const last = points[points.length - 1];
  return { points, setups, trend: last ? last.fast > last.slow ? 'Uptrend' : 'Downtrend' : 'Warming up', phase: pending ? pending.touched ? 'Watching continuation' : 'Waiting for pullback' : 'Waiting for impulse', volumeCoverage: bars.length ? bars.filter(b => b.volume > 0).length / bars.length : 0, confirmedBars: bars.length };
}

/** Descriptive hourly movement only, not profitability or a forward-looking signal. */
export function momentumHourProfile(candles: Candle[], stepSeconds: number) {
  if (stepSeconds > 900) return [];
  const buckets = Array.from({ length: 24 }, () => ({ ranges: [] as number[], directional: 0, days: new Set<string>() }));
  const byHour = new Map<number, Candle[]>();
  for (const b of candles.slice(0, -1)) { const key = Math.floor(b.time / 3600); const rows = byHour.get(key) || []; rows.push(b); byHour.set(key, rows); }
  for (const rows of byHour.values()) {
    if (rows.length !== 3600 / stepSeconds || rows[0].time % 3600 !== 0 || rows.some((b, i) => i > 0 && b.time - rows[i - 1].time !== stepSeconds)) continue;
    const first = rows[0], last = rows[rows.length - 1];
    const high = Math.max(...rows.map(b => b.high)), low = Math.min(...rows.map(b => b.low));
    const range = high - low;
    const bucket = buckets[hourAt(first.time, 'Africa/Johannesburg')];
    bucket.ranges.push(100 * range / first.open);
    if (range > 0 && Math.abs(last.close - first.open) / range >= 0.6) bucket.directional++;
    bucket.days.add(new Date((first.time + 7200) * 1000).toISOString().slice(0, 10));
  }
  return buckets.map((b, hour) => { const sorted = b.ranges.sort((a, c) => a - c); const n = sorted.length; return { hour, samples: n, days: b.days.size, medianRangePct: n ? (sorted[Math.floor((n - 1) / 2)] + sorted[Math.floor(n / 2)]) / 2 : 0, directionalPct: n ? 100 * b.directional / n : 0 }; }).filter(b => b.samples >= 5).sort((a, b) => b.medianRangePct - a.medianRangePct);
}
