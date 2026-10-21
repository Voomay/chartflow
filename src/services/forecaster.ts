/**
 * Forecaster: deterministic momentum analysis on the last N revealed candles,
 * producing two "skeleton" swing paths projected forward on the chart time scale.
 *
 * IMPORTANT: callers must pass only candles revealed up to the current replay point.
 * The function never looks beyond the last candle it is given.
 */

export interface ForecastCandle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface ForecastPoint {
  time: number;
  price: number;
}

export interface ForecastScenario {
  id: 'A' | 'B';
  name: string;
  probability: number; // 0..100
  direction: 'up' | 'down';
  points: ForecastPoint[]; // starts at the last candle close
}

export interface ForecastMetrics {
  slope: number; // linear regression slope per bar (price units)
  slopeAtr: number; // slope normalised by ATR
  roc: number; // % rate of change over lookback
  atr: number;
  emaSlopeAtr: number;
  rsi: number;
  strength: number; // -1..1 combined momentum score
}

export interface ForecastResult {
  metrics: ForecastMetrics;
  scenarios: [ForecastScenario, ForecastScenario];
}

const ema = (values: number[], period: number): number[] => {
  const k = 2 / (period + 1);
  const out: number[] = [];
  let prev = values[0];
  for (let i = 0; i < values.length; i++) {
    prev = i === 0 ? values[0] : values[i] * k + prev * (1 - k);
    out.push(prev);
  }
  return out;
};

const computeRSI = (closes: number[], period = 14): number => {
  if (closes.length < 2) return 50;
  let gain = 0;
  let loss = 0;
  const start = Math.max(1, closes.length - period);
  for (let i = start; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    if (d > 0) gain += d;
    else loss -= d;
  }
  if (gain + loss === 0) return 50;
  return (100 * gain) / (gain + loss);
};

const computeATR = (c: ForecastCandle[], period = 14): number => {
  if (c.length < 2) return c.length ? c[0].high - c[0].low : 0;
  const trs: number[] = [];
  for (let i = 1; i < c.length; i++) {
    const pc = c[i - 1].close;
    trs.push(Math.max(c[i].high - c[i].low, Math.abs(c[i].high - pc), Math.abs(c[i].low - pc)));
  }
  const slice = trs.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / slice.length;
};

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/**
 * Build a zig-zag path of swing pivots.
 * @param bias drift per bar in ATR units (signed)
 * @param legs alternating leg plan: [barCount, moveInAtr] (signed)
 */
const buildPath = (
  startTime: number,
  startPrice: number,
  stepSec: number,
  atr: number,
  legs: Array<[number, number]>
): ForecastPoint[] => {
  const pts: ForecastPoint[] = [{ time: startTime, price: startPrice }];
  let t = startTime;
  let p = startPrice;
  for (const [bars, move] of legs) {
    t += bars * stepSec;
    p += move * atr;
    pts.push({ time: t, price: p });
  }
  return pts;
};

export function computeForecast(
  candles: ForecastCandle[],
  stepSec: number,
  opts: { lookback?: number; horizon?: number; decimals?: number } = {}
): ForecastResult | null {
  const lookback = opts.lookback ?? 50;
  const horizon = opts.horizon ?? 24;
  if (candles.length < 20 || !stepSec) return null;

  const data = candles.slice(-lookback);
  const closes = data.map((c) => c.close);
  const n = closes.length;
  const last = data[n - 1];

  // Linear regression slope
  const xMean = (n - 1) / 2;
  const yMean = closes.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (i - xMean) * (closes[i] - yMean);
    den += (i - xMean) ** 2;
  }
  const slope = den ? num / den : 0;

  const atr = computeATR(data) || Math.abs(last.close) * 0.001 || 1;
  const roc = closes[0] ? ((last.close - closes[0]) / closes[0]) * 100 : 0;
  const e = ema(closes, 20);
  const emaSlope = (e[n - 1] - e[Math.max(0, n - 6)]) / 5;
  const rsi = computeRSI(closes);

  const slopeAtr = slope / atr;
  const emaSlopeAtr = emaSlope / atr;
  const rocAtr = (last.close - closes[0]) / atr / n;

  // Combined momentum strength in -1..1
  const raw =
    0.4 * Math.tanh(slopeAtr * 4) +
    0.3 * Math.tanh(emaSlopeAtr * 4) +
    0.15 * Math.tanh(rocAtr * 4) +
    0.15 * ((rsi - 50) / 50);
  const strength = clamp(raw, -1, 1);

  const dirSign = strength >= 0 ? 1 : -1;
  // Overextension (RSI extremes) lowers continuation odds
  const overext = dirSign > 0 ? Math.max(0, rsi - 70) / 30 : Math.max(0, 30 - rsi) / 30;
  const probA = Math.round(clamp(50 + Math.abs(strength) * 35 - overext * 15, 35, 85));
  const probB = 100 - probA;

  const mag = 0.6 + Math.abs(strength) * 1.4; // swing size in ATR units
  // Split horizon into 5 legs deterministically
  const legBars = [5, 4, 6, 4, horizon - 19].map((b) => Math.max(2, b));
  const d = dirSign;

  // Scenario A: continuation impulse / pullback / impulse ...
  const legsA: Array<[number, number]> = [
    [legBars[0], d * mag * 1.6],
    [legBars[1], -d * mag * 0.7],
    [legBars[2], d * mag * 1.8],
    [legBars[3], -d * mag * 0.8],
    [legBars[4], d * mag * 1.4],
  ];
  // Scenario B: mean reversion toward the EMA, then a weaker counter-trend
  const legsB: Array<[number, number]> = [
    [legBars[0], d * mag * 0.5],
    [legBars[1], -d * mag * 1.5],
    [legBars[2], d * mag * 0.6],
    [legBars[3], -d * mag * 1.6],
    [legBars[4], d * mag * 0.5],
  ];

  const round = (v: number) =>
    opts.decimals !== undefined ? Number(v.toFixed(opts.decimals)) : v;

  const mk = (legs: Array<[number, number]>) =>
    buildPath(last.time, last.close, stepSec, atr, legs).map((p) => ({
      time: p.time,
      price: round(p.price),
    }));

  return {
    metrics: { slope, slopeAtr, roc, atr, emaSlopeAtr, rsi, strength },
    scenarios: [
      {
        id: 'A',
        name: 'Continuation',
        probability: probA,
        direction: d > 0 ? 'up' : 'down',
        points: mk(legsA),
      },
      {
        id: 'B',
        name: 'Pullback',
        probability: probB,
        direction: d > 0 ? 'down' : 'up',
        points: mk(legsB),
      },
    ],
  };
}
