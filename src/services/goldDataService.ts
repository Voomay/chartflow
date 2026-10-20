import { Candle, SessionBox, SessionConfig, SessionId, Timeframe } from '../types/trading';

export const TIMEFRAME_CONFIG: Record<
  Timeframe,
  { label: string; binanceInterval: string; seconds: number; description: string }
> = {
  '1m': { label: '1m', binanceInterval: '1m', seconds: 60, description: '1 Minute Scalping' },
  '5m': { label: '5m', binanceInterval: '5m', seconds: 300, description: '5 Minute Intraday' },
  '15m': { label: '15m', binanceInterval: '15m', seconds: 900, description: '15 Minute Session Structure' },
  '30m': { label: '30m', binanceInterval: '30m', seconds: 1800, description: '30 Minute Killzone' },
  '1H': { label: '1H', binanceInterval: '1h', seconds: 3600, description: '1 Hour Institutional Flow' },
  '4H': { label: '4H', binanceInterval: '4h', seconds: 14400, description: '4 Hour Swing Structure' },
  '1D': { label: '1D', binanceInterval: '1d', seconds: 86400, description: 'Daily Macro Trend' },
};

export const INITIAL_SESSIONS: SessionConfig[] = [
  {
    id: 'sydney',
    name: 'Australia (Sydney)',
    city: 'Sydney',
    region: 'Oceania / ASX',
    flag: '🇦🇺',
    startHourUTC: 22, // 22:00 UTC to 07:00 UTC
    endHourUTC: 7,
    color: '#06b6d4', // Cyan
    fillColor: 'rgba(6, 182, 212, 0.09)',
    borderColor: 'rgba(6, 182, 212, 0.55)',
    badgeClass: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30',
    volatilityLabel: 'Low–Moderate',
    goldBehavior: 'Establishes early Pacific liquidity range & initial gap fills after NY close.',
    enabled: true,
  },
  {
    id: 'tokyo',
    name: 'Asia (Tokyo / Shanghai)',
    city: 'Tokyo',
    region: 'Asia / SGE & TOCOM',
    flag: '🇯🇵',
    startHourUTC: 0, // 00:00 UTC to 09:00 UTC
    endHourUTC: 9,
    color: '#a855f7', // Purple
    fillColor: 'rgba(168, 85, 247, 0.09)',
    borderColor: 'rgba(168, 85, 247, 0.55)',
    badgeClass: 'text-purple-400 bg-purple-500/10 border-purple-500/30',
    volatilityLabel: 'Moderate (Physical Demand)',
    goldBehavior: 'Shanghai Gold Exchange (SGE) premium & Asian accumulation range; often sets high/low targets for London sweep.',
    enabled: true,
  },
  {
    id: 'london',
    name: 'London (LBMA)',
    city: 'London',
    region: 'Europe / LBMA Bullion',
    flag: '🇬🇧',
    startHourUTC: 8, // 08:00 UTC to 17:00 UTC
    endHourUTC: 17,
    color: '#3b82f6', // Blue
    fillColor: 'rgba(59, 130, 246, 0.10)',
    borderColor: 'rgba(59, 130, 246, 0.60)',
    badgeClass: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
    volatilityLabel: 'High (Breakout & Judas Swing)',
    goldBehavior: 'LBMA Gold Fix & European institutional liquidity. Frequently sweeps Asian High/Low before initiating the primary daily trend.',
    enabled: true,
  },
  {
    id: 'newyork',
    name: 'New York (COMEX)',
    city: 'New York',
    region: 'Americas / COMEX Futures',
    flag: '🇺🇸',
    startHourUTC: 13, // 13:00 UTC to 22:00 UTC
    endHourUTC: 22,
    color: '#f59e0b', // Amber/Gold
    fillColor: 'rgba(245, 158, 11, 0.11)',
    borderColor: 'rgba(245, 158, 11, 0.65)',
    badgeClass: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
    volatilityLabel: 'Extreme (COMEX Open + US Macro)',
    goldBehavior: 'Peak volume during London–NY Overlap (13:00–17:00 UTC). Driven by US Treasury yields, DXY, and macro releases at 12:30/13:30 UTC.',
    enabled: true,
  },
];

/**
 * Checks if a given UTC hour (0-23) is inside a session's [startHourUTC, endHourUTC) window.
 */
export function isHourInSession(hourUTC: number, startHourUTC: number, endHourUTC: number): boolean {
  if (startHourUTC < endHourUTC) {
    return hourUTC >= startHourUTC && hourUTC < endHourUTC;
  }
  // Wraps around midnight (e.g. Sydney 22:00 -> 07:00 UTC)
  return hourUTC >= startHourUTC || hourUTC < endHourUTC;
}

/**
 * Returns all active sessions at a given unix timestamp (seconds).
 */
export function getActiveSessionsAtTime(
  timestampSec: number,
  sessions: SessionConfig[] = INITIAL_SESSIONS
): { active: SessionConfig[]; isLondonNYOverlap: boolean } {
  const date = new Date(timestampSec * 1000);
  const hourUTC = date.getUTCHours();
  const active = sessions.filter((s) => isHourInSession(hourUTC, s.startHourUTC, s.endHourUTC));
  const isLondonNYOverlap = hourUTC >= 13 && hourUTC < 17;
  return { active, isLondonNYOverlap };
}

/**
 * Normalizes OHLC candles to match TradingView OANDA/Spot Gold (XAU/USD) continuous quote rendering:
 * 1. Eliminates intraday open-to-close gaps (sets candle[i].open = candle[i-1].close for contiguous bars)
 *    while preserving true high/low wicks.
 * 2. Prevents flat zero-range (O=H=L=C) horizontal dash artifacts on low-tick 1m bars.
 */
export function normalizeSpotGoldCandles(candles: Candle[], timeframe: Timeframe): Candle[] {
  if (candles.length === 0) return [];
  const stepSec = TIMEFRAME_CONFIG[timeframe].seconds;
  const minWick = timeframe === '1m' ? 0.12 : timeframe === '5m' ? 0.22 : 0.35;

  const result: Candle[] = candles.map((c) => ({ ...c }));

  for (let i = 0; i < result.length; i++) {
    const curr = result[i];

    if (i > 0) {
      const prev = result[i - 1];
      const timeDiff = curr.time - prev.time;
      // If contiguous bar (not a weekend market close), stitch open to previous close exactly like TradingView XAUUSD
      if (timeDiff > 0 && timeDiff <= stepSec * 2) {
        curr.open = prev.close;
      }
    }

    // Ensure High and Low always encompass both Open and Close
    curr.high = Number(Math.max(curr.high, curr.open, curr.close).toFixed(2));
    curr.low = Number(Math.min(curr.low, curr.open, curr.close).toFixed(2));

    // Prevent dead flat O=H=L=C horizontal dashes if a bar has zero range
    if (curr.high - curr.low < 0.04) {
      curr.high = Number((Math.max(curr.open, curr.close) + minWick).toFixed(2));
      curr.low = Number((Math.min(curr.open, curr.close) - minWick).toFixed(2));
    }
  }

  return result;
}

/**
 * Generates realistic synthetic XAU/USD candles if network is unavailable.
 */
export function generateSyntheticGoldCandles(timeframe: Timeframe, count = 800): Candle[] {
  const stepSec = TIMEFRAME_CONFIG[timeframe].seconds;
  const nowSec = Math.floor(Date.now() / 1000 / stepSec) * stepSec;
  const candles: Candle[] = [];

  let price = 4130.0;
  // Deterministic PRNG seed based on timeframe
  let seed = timeframe.charCodeAt(0) * 1337 + (timeframe.charCodeAt(1) || 7) * 997;
  const nextRand = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };

  const baseVol = Math.sqrt(stepSec / 60) * 1.15;

  for (let i = count - 1; i >= 0; i--) {
    const time = nowSec - i * stepSec;
    const date = new Date(time * 1000);
    const hourUTC = date.getUTCHours();

    // Session volatility multiplier (London & NY Overlap have 1.8x-2.4x higher volatility in Gold)
    let sessionMult = 0.75;
    if (hourUTC >= 13 && hourUTC < 17) sessionMult = 2.1; // London-NY Overlap
    else if (hourUTC >= 8 && hourUTC < 13) sessionMult = 1.55; // London Open
    else if (hourUTC >= 17 && hourUTC < 21) sessionMult = 1.25; // NY Afternoon
    else if (hourUTC >= 0 && hourUTC < 6) sessionMult = 0.95; // Asian session

    // Cyclical wave + mild upward drift for XAU/USD
    const wave = Math.sin((count - i) / 28) * 0.14 + Math.cos((count - i) / 9) * 0.08;
    const delta = (nextRand() - 0.488 + wave * 0.12) * baseVol * sessionMult * 2.4;

    const open = Number(price.toFixed(2));
    const close = Number(Math.max(2500, open + delta).toFixed(2));
    const wickUp = (0.15 + nextRand()) * baseVol * sessionMult * 1.25;
    const wickDown = (0.15 + nextRand()) * baseVol * sessionMult * 1.25;
    const high = Number((Math.max(open, close) + wickUp).toFixed(2));
    const low = Number((Math.min(open, close) - wickDown).toFixed(2));
    const volume = Math.round((40 + nextRand() * 180) * sessionMult * Math.sqrt(stepSec / 60));

    candles.push({ time, open, high, low, close, volume });
    price = close;
  }

  return normalizeSpotGoldCandles(candles, timeframe);
}

/**
 * Fetches real historical XAU/USD candles from institutional high-frequency XAUUSDT feed
 * (500-6,000+ trades per bar, matching TradingView XAUUSD without PAXG spot illiquidity gaps).
 */
export async function fetchGoldCandles(
  timeframe: Timeframe,
  limit = 1000
): Promise<{ candles: Candle[]; source: 'LIVE_SPOT_FEED' | 'SYNTHETIC_FALLBACK' }> {
  const cfg = TIMEFRAME_CONFIG[timeframe];

  // 1. Primary High-Liquidity Institutional XAUUSDT Perpetual Feed (matches TradingView XAUUSD)
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6500);
    const url = `https://fapi.binance.com/fapi/v1/klines?symbol=XAUUSDT&interval=${cfg.binanceInterval}&limit=${limit}`;
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    const raw: any[][] = await res.json();
    if (!Array.isArray(raw) || raw.length === 0) {
      throw new Error('Empty XAUUSDT kline array');
    }

    const rawCandles: Candle[] = raw.map((row) => ({
      time: Math.floor(Number(row[0]) / 1000),
      open: Number(parseFloat(row[1]).toFixed(2)),
      high: Number(parseFloat(row[2]).toFixed(2)),
      low: Number(parseFloat(row[3]).toFixed(2)),
      close: Number(parseFloat(row[4]).toFixed(2)),
      volume: Number(parseFloat(row[5]).toFixed(2)),
    }));

    return {
      candles: normalizeSpotGoldCandles(rawCandles, timeframe),
      source: 'LIVE_SPOT_FEED',
    };
  } catch (primaryErr) {
    // 2. Secondary Fallback: Bybit XAUUSDT Linear Klines
    try {
      const bybitIntervalMap: Record<Timeframe, string> = {
        '1m': '1',
        '5m': '5',
        '15m': '15',
        '30m': '30',
        '1H': '60',
        '4H': '240',
        '1D': 'D',
      };
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5500);
      const bybitUrl = `https://api.bybit.com/v5/market/kline?category=linear&symbol=XAUUSDT&interval=${bybitIntervalMap[timeframe]}&limit=${Math.min(limit, 1000)}`;
      const res = await fetch(bybitUrl, { signal: controller.signal });
      clearTimeout(timeout);

      if (res.ok) {
        const json = await res.json();
        const list: any[][] = json?.result?.list;
        if (Array.isArray(list) && list.length > 0) {
          const ordered = [...list].reverse();
          const rawCandles: Candle[] = ordered.map((row) => ({
            time: Math.floor(Number(row[0]) / 1000),
            open: Number(parseFloat(row[1]).toFixed(2)),
            high: Number(parseFloat(row[2]).toFixed(2)),
            low: Number(parseFloat(row[3]).toFixed(2)),
            close: Number(parseFloat(row[4]).toFixed(2)),
            volume: Number(parseFloat(row[5]).toFixed(2)),
          }));
          return {
            candles: normalizeSpotGoldCandles(rawCandles, timeframe),
            source: 'LIVE_SPOT_FEED',
          };
        }
      }
    } catch {
      // Proceed to synthetic fallback
    }

    console.warn('Falling back to synthetic XAU/USD feed:', primaryErr);
    return {
      candles: generateSyntheticGoldCandles(timeframe, limit),
      source: 'SYNTHETIC_FALLBACK',
    };
  }
}

/**
 * Fetches the latest 2-3 live XAUUSDT candles for seamless gap-free real-time chart updates.
 */
export async function fetchLatestGoldCandles(
  timeframe: Timeframe,
  limit = 3
): Promise<Candle[] | null> {
  const cfg = TIMEFRAME_CONFIG[timeframe];
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);
    const url = `https://fapi.binance.com/fapi/v1/klines?symbol=XAUUSDT&interval=${cfg.binanceInterval}&limit=${limit}`;
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) return null;
    const raw: any[][] = await res.json();
    if (!Array.isArray(raw) || raw.length === 0) return null;

    return raw.map((row) => ({
      time: Math.floor(Number(row[0]) / 1000),
      open: Number(parseFloat(row[1]).toFixed(2)),
      high: Number(parseFloat(row[2]).toFixed(2)),
      low: Number(parseFloat(row[3]).toFixed(2)),
      close: Number(parseFloat(row[4]).toFixed(2)),
      volume: Number(parseFloat(row[5]).toFixed(2)),
    }));
  } catch {
    return null;
  }
}

/**
 * Computes contiguous Trading Session Boxes (Sydney, Tokyo, London, New York) from intraday candles.
 * Note: For 1D (Daily) timeframe, intraday sessions occur inside a single daily bar, so session boxes apply to 1m..4H.
 */
export function computeSessionBoxes(
  candles: Candle[],
  sessions: SessionConfig[],
  timeframe: Timeframe
): SessionBox[] {
  if (timeframe === '1D' || candles.length === 0) {
    return [];
  }

  const enabledSessions = sessions.filter((s) => s.enabled);
  if (enabledSessions.length === 0) return [];

  const boxes: SessionBox[] = [];

  for (const sessionCfg of enabledSessions) {
    let currentBox: SessionBox | null = null;

    for (let i = 0; i < candles.length; i++) {
      const c = candles[i];
      const date = new Date(c.time * 1000);
      const hourUTC = date.getUTCHours();
      const inSession = isHourInSession(hourUTC, sessionCfg.startHourUTC, sessionCfg.endHourUTC);

      if (inSession) {
        if (!currentBox) {
          currentBox = {
            id: `${sessionCfg.id}-${c.time}`,
            session: sessionCfg.id,
            name: sessionCfg.city,
            startTime: c.time,
            endTime: c.time,
            high: c.high,
            low: c.low,
            open: c.open,
            close: c.close,
            rangeDollars: Number((c.high - c.low).toFixed(2)),
            isCurrent: i === candles.length - 1,
          };
        } else {
          currentBox.endTime = c.time;
          if (c.high > currentBox.high) currentBox.high = c.high;
          if (c.low < currentBox.low) currentBox.low = c.low;
          currentBox.close = c.close;
          currentBox.rangeDollars = Number((currentBox.high - currentBox.low).toFixed(2));
          if (i === candles.length - 1) currentBox.isCurrent = true;
        }
      } else {
        if (currentBox) {
          boxes.push(currentBox);
          currentBox = null;
        }
      }
    }

    if (currentBox) {
      boxes.push(currentBox);
    }
  }

  // Sort boxes chronologically by startTime
  boxes.sort((a, b) => a.startTime - b.startTime);

  // Detect Liquidity Sweeps (e.g. did this session sweep the previous session's High or Low?)
  for (let i = 1; i < boxes.length; i++) {
    const curr = boxes[i];
    const prev = boxes[i - 1];
    if (curr.high > prev.high && curr.low < prev.low) {
      curr.sweptHighOf = `${prev.name} H & L`;
    } else if (curr.high > prev.high) {
      curr.sweptHighOf = `${prev.name} High`;
    } else if (curr.low < prev.low) {
      curr.sweptLowOf = `${prev.name} Low`;
    }
  }

  // Keep the most recent 28 session boxes for fast canvas rendering
  return boxes.slice(-28);
}
