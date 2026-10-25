import { Candle } from '../types/trading';

export type EngulfingDirection = 'UP' | 'DOWN';
export type EngulfingFilter = 'ALL' | 'UP' | 'DOWN';

export interface EngulfingCandleSignal {
  index: number;
  time: number;
  direction: EngulfingDirection;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  /** Relative volume compared to prior 20 bars (null if feed has no volume) */
  relativeVolume: number | null;
  /** Candle body size divided by prior 14-bar ATR */
  bodyAtrMultiple: number;
  /** Ratio of body size to full high-low candle range (0..1) */
  bodyToRangeRatio: number;
  /** True when candle also breaks beyond previous candle's high (UP) or low (DOWN) */
  sweepsPriorExtreme: boolean;
  /** True when relativeVolume >= minRelativeVolume */
  volumeSurge: boolean;
  /** True when bodyAtrMultiple >= minMomentumAtr */
  momentumSurge: boolean;
  /** 'STRONG' when both volume surge (or full range sweep) and high momentum align */
  strength: 'STRONG' | 'STANDARD';
}

export interface EngulfingStudyOptions {
  filter?: EngulfingFilter;
  minRelativeVolume?: number;
  minMomentumAtr?: number;
}

export interface EngulfingStudyResult {
  signals: EngulfingCandleSignal[];
  upCount: number;
  downCount: number;
  latestSignal: EngulfingCandleSignal | null;
}

/**
 * Detects Bullish (UP) and Bearish (DOWN) Engulfing Volume / Momentum candles.
 *
 * Rules:
 * 1. Price Engulfing:
 *    - Bullish (UP): current candle closes higher than it opens (`close > open`),
 *      prior candle is bearish (`prev.close < prev.open`) or smaller body,
 *      current body engulfs prior body (`open <= prevClose + 0.15*ATR` and `close >= prevOpen`)
 *      with `body > prevBody * 1.05`.
 *    - Bearish (DOWN): current candle closes lower than it opens (`close < open`),
 *      prior candle is bullish (`prev.close > prev.open`) or smaller body,
 *      current body engulfs prior body (`open >= prevClose - 0.15*ATR` and `close <= prevOpen`)
 *      with `body > prevBody * 1.05`.
 * 2. Volume / Momentum Confirmation:
 *    - Momentum Surge: `body >= minMomentumAtr * priorATR` (default 0.65x ATR) and `body / range >= 0.52`, OR
 *    - Volume Surge: `relativeVolume >= minRelativeVolume` (default 1.25x prior 20-bar avg volume) and `body >= 0.45 * priorATR` and `body / range >= 0.48`.
 */
export function computeEngulfingVolumeMomentum(
  candles: Candle[],
  options: EngulfingStudyOptions = {}
): EngulfingStudyResult {
  const filter = options.filter ?? 'ALL';
  const minRvol = options.minRelativeVolume ?? 1.25;
  const minMomAtr = options.minMomentumAtr ?? 0.65;

  const signals: EngulfingCandleSignal[] = [];
  if (candles.length < 3) {
    return { signals, upCount: 0, downCount: 0, latestSignal: null };
  }

  let atr = Math.max(candles[0].high - candles[0].low, 1e-8);
  const volWindow: number[] = [];
  let volSum = 0;

  for (let i = 0; i < candles.length; i++) {
    const c = candles[i];
    const prev = i > 0 ? candles[i - 1] : null;

    const tr = prev
      ? Math.max(
          c.high - c.low,
          Math.abs(c.high - prev.close),
          Math.abs(c.low - prev.close)
        )
      : c.high - c.low;

    const priorAtr = Math.max(atr, 1e-8);
    atr = i === 0 ? tr : (atr * 13 + tr) / 14;

    const avgVol = volWindow.length >= 5 ? volSum / volWindow.length : 0;
    const rvol =
      c.volume > 0 && Number.isFinite(c.volume) && avgVol > 0
        ? c.volume / avgVol
        : null;

    if (c.volume > 0 && Number.isFinite(c.volume)) {
      volWindow.push(c.volume);
      volSum += c.volume;
      if (volWindow.length > 20) {
        volSum -= volWindow.shift()!;
      }
    }

    if (!prev || i < 2) continue;

    const body = Math.abs(c.close - c.open);
    const range = Math.max(c.high - c.low, 1e-10);
    const bodyToRangeRatio = body / range;
    const bodyAtrMultiple = body / priorAtr;

    const prevBody = Math.abs(prev.close - prev.open);
    const prevTop = Math.max(prev.open, prev.close);
    const prevBottom = Math.min(prev.open, prev.close);
    const openTolerance = priorAtr * 0.15;

    const isBullish = c.close > c.open;
    const isBearish = c.close < c.open;

    // Bullish engulfing: engulfs prior bearish candle body, or powerful expansion engulfing prior smaller bar
    const prevWasBearishOrDoji = prev.close <= prev.open || prevBody <= priorAtr * 0.25;
    const bullEngulfsBody =
      isBullish &&
      prevWasBearishOrDoji &&
      c.open <= prevBottom + openTolerance &&
      c.close >= prevTop &&
      body > Math.max(prevBody * 1.08, priorAtr * 0.35);

    // Bearish engulfing: engulfs prior bullish candle body, or powerful expansion engulfing prior smaller bar
    const prevWasBullishOrDoji = prev.close >= prev.open || prevBody <= priorAtr * 0.25;
    const bearEngulfsBody =
      isBearish &&
      prevWasBullishOrDoji &&
      c.open >= prevTop - openTolerance &&
      c.close <= prevBottom &&
      body > Math.max(prevBody * 1.08, priorAtr * 0.35);

    if (!bullEngulfsBody && !bearEngulfsBody) continue;

    const direction: EngulfingDirection = bullEngulfsBody ? 'UP' : 'DOWN';
    const sweepsPriorExtreme =
      direction === 'UP' ? c.close > prev.high : c.close < prev.low;

    const volumeSurge = rvol !== null && rvol >= minRvol;
    const momentumSurge =
      bodyAtrMultiple >= minMomAtr && bodyToRangeRatio >= 0.52;

    const qualifiesByVolume =
      volumeSurge && bodyAtrMultiple >= 0.45 && bodyToRangeRatio >= 0.48;
    const qualifiesByMomentum = momentumSurge;

    if (!qualifiesByVolume && !qualifiesByMomentum) continue;

    const isStrong =
      (volumeSurge && momentumSurge) ||
      (sweepsPriorExtreme && bodyAtrMultiple >= 0.95 && bodyToRangeRatio >= 0.62) ||
      (rvol !== null && rvol >= 1.6 && bodyAtrMultiple >= 0.75);

    signals.push({
      index: i,
      time: c.time,
      direction,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
      volume: c.volume,
      relativeVolume: rvol,
      bodyAtrMultiple,
      bodyToRangeRatio,
      sweepsPriorExtreme,
      volumeSurge,
      momentumSurge,
      strength: isStrong ? 'STRONG' : 'STANDARD',
    });
  }

  const upCount = signals.filter((s) => s.direction === 'UP').length;
  const downCount = signals.filter((s) => s.direction === 'DOWN').length;
  const filtered =
    filter === 'ALL' ? signals : signals.filter((s) => s.direction === filter);

  return {
    signals: filtered,
    upCount,
    downCount,
    latestSignal: filtered.length > 0 ? filtered[filtered.length - 1] : null,
  };
}
