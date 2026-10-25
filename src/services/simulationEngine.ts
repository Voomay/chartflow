import {
  AccountCurrency,
  BacktestPosition,
  BreachEventRecord,
  Candle,
  ChallengeAttemptSummary,
  ChallengeCalculationBasis,
  ChallengeState,
  DailyResetSnapshot,
  DisplayTimezone,
  EquitySnapshot,
  FillRecord,
  FrozenSessionConfig,
  InstrumentConfig,
  InstrumentSpecOverride,
  InstrumentSymbol,
  OrderRecord,
  OrderSubType,
  PassedEventRecord,
  PropFirmRules,
  ReplayCheckpoint,
  TradeEventRecord,
  TradingSession,
  Timeframe,
} from '../types/trading';
import {
  fetchGoldCandles,
  getActiveSessionsAtTime,
  getCanonicalBucketTime,
  getTimeframeEndTime,
  getCachedRealCandles,
  getHistoricalCandles,
  hasHistoricalArchive,
  getProviderChartCandles,
  getInstrumentConfig,
  INITIAL_SESSIONS,
  INSTRUMENTS,
  isWeekendClosedTimestamp,
  setCachedRealCandles,
  TIMEFRAME_CONFIG,
} from './goldDataService';

/**
 * Documented exchange rates relative to 1 USD (1 USD = X AccountCurrency).
 * Used to convert USD-denominated instrument P&L and commissions into the session's account currency.
 */
export const ACCOUNT_CURRENCY_RATES: Record<AccountCurrency, number> = {
  USD: 1.0,
  EUR: 0.92,
  GBP: 0.78,
  AUD: 1.51,
  CAD: 1.39,
  JPY: 155.0,
};

export const CURRENCY_SYMBOLS: Record<AccountCurrency, string> = {
  USD: '$',
  EUR: '€',
  GBP: '£',
  AUD: 'A$',
  CAD: 'C$',
  JPY: '¥',
};

export function formatMoney(
  amount: number,
  currency: AccountCurrency = 'USD',
  includeSign = false
): string {
  const sym = CURRENCY_SYMBOLS[currency] || '$';
  const decimals = currency === 'JPY' ? 0 : 2;
  const absFormatted = Math.abs(amount).toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  if (amount < 0) return `-${sym}${absFormatted}`;
  if (includeSign && amount > 0) return `+${sym}${absFormatted}`;
  return `${sym}${absFormatted}`;
}

export function convertUsdToAccountCurrency(
  usdAmount: number,
  currency: AccountCurrency = 'USD'
): number {
  const rate = ACCOUNT_CURRENCY_RATES[currency] || 1.0;
  const decimals = currency === 'JPY' ? 0 : 2;
  return Number((usdAmount * rate).toFixed(decimals));
}

/**
 * Resolves the effective instrument specification for a session, merging defaults with any session-level overrides.
 */
export function getEffectiveInstrumentSpec(
  symbol: InstrumentSymbol,
  session?: TradingSession | null
): InstrumentSpecOverride & InstrumentConfig {
  const base = getInstrumentConfig(symbol);
  const override =
    session?.frozenConfig?.instrumentSpecs?.[symbol] ||
    session?.instrumentSpecs?.[symbol];

  return {
    ...base,
    contractSize: override?.contractSize ?? base.contractSize,
    decimals: override?.decimals ?? base.decimals,
    pipSize: override?.pipSize ?? base.pipSize,
    minQuantity: override?.minQuantity ?? base.minQuantity ?? 0.01,
    quantityIncrement: override?.quantityIncrement ?? base.quantityIncrement ?? 0.01,
    defaultSpread: override?.defaultSpread ?? base.defaultSpread,
  };
}

/**
 * Computes the effective price spread for a symbol in a session.
 */
export function getSessionSpreadPrice(
  symbol: InstrumentSymbol,
  session?: TradingSession | null
): number {
  const spec = getEffectiveInstrumentSpec(symbol, session);
  const opts = session?.frozenConfig?.moreOptions || session?.moreOptions;
  if (opts?.spreadMode === 'CUSTOM' && typeof opts.customSpreadPips === 'number') {
    return Number((Math.max(0, opts.customSpreadPips) * spec.pipSize).toFixed(spec.decimals));
  }
  return spec.defaultSpread;
}

/**
 * Computes Bid and Ask prices from a mid/spot price using the session's documented spread model.
 * Bid = Mid - Spread/2, Ask = Mid + Spread/2 (ensuring Ask - Bid = Spread).
 */
export function getBidAskFromMid(
  midPrice: number,
  symbol: InstrumentSymbol,
  session?: TradingSession | null
): { bid: number; ask: number; spread: number; spreadPips: number } {
  const spec = getEffectiveInstrumentSpec(symbol, session);
  const spread = getSessionSpreadPrice(symbol, session);
  const half = spread * 0.5;
  const bid = Number((midPrice - half).toFixed(spec.decimals));
  const ask = Number((midPrice + half).toFixed(spec.decimals));
  const spreadPips = Number((spread / Math.max(1e-9, spec.pipSize)).toFixed(2));
  return { bid, ask, spread, spreadPips };
}

/**
 * Computes P&L in the session's AccountCurrency for a given price move and lot size.
 * Respects instrument-specific contract size and currency conversion.
 */
export function calculatePositionPnl(
  side: 'LONG' | 'SHORT',
  entryPrice: number,
  exitPrice: number,
  lotSize: number,
  symbol: InstrumentSymbol,
  session?: TradingSession | null
): number {
  const spec = getEffectiveInstrumentSpec(symbol, session);
  const priceDiff = side === 'LONG' ? exitPrice - entryPrice : entryPrice - exitPrice;
  // In goldDataService, spec.contractSize is calibrated in USD PnL per 1.00 price move per 1.00 standard lot
  const usdPnl = priceDiff * (lotSize * spec.contractSize);
  const currency = session?.frozenConfig?.accountCurrency || session?.accountCurrency || 'USD';
  return convertUsdToAccountCurrency(usdPnl, currency);
}

/**
 * Formats a Unix timestamp (seconds) in the session's configured display timezone.
 */
export function formatTimestampInTimezone(
  timestampSec: number,
  timezone: DisplayTimezone = 'UTC',
  includeSeconds = false
): string {
  try {
    const d = new Date(timestampSec * 1000);
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: includeSeconds ? '2-digit' : undefined,
      hour12: false,
    });
    const parts = formatter.formatToParts(d);
    const get = (t: string) => parts.find((p) => p.type === t)?.value || '00';
    const hr = get('hour') === '24' ? '00' : get('hour');
    const base = `${get('year')}-${get('month')}-${get('day')} ${hr}:${get('minute')}`;
    return includeSeconds ? `${base}:${get('second')}` : base;
  } catch {
    return new Date(timestampSec * 1000).toISOString().replace('T', ' ').slice(0, 16);
  }
}

/**
 * Computes the current trading day key (`YYYY-MM-DD`) in the configured `dailyResetTimezone` and `dailyResetTime`.
 * Handles daylight-saving transitions accurately via `Intl.DateTimeFormat`.
 */
export function getTradingDayKeyAtTimestamp(
  timestampSec: number,
  resetTimezone: DisplayTimezone = 'UTC',
  resetTime = '00:00'
): string {
  try {
    const [resetHourStr, resetMinStr] = (resetTime || '00:00').split(':');
    const resetMinutesOffset =
      (parseInt(resetHourStr, 10) || 0) * 60 + (parseInt(resetMinStr, 10) || 0);
    // Shift timestamp backward by resetMinutesOffset so that the rollover occurs at exact resetTime in that timezone
    const shiftedDate = new Date((timestampSec - resetMinutesOffset * 60) * 1000);
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: resetTimezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const parts = formatter.formatToParts(shiftedDate);
    const get = (t: string) => parts.find((p) => p.type === t)?.value || '01';
    return `${get('year')}-${get('month')}-${get('day')}`;
  } catch {
    return new Date(timestampSec * 1000).toISOString().slice(0, 10);
  }
}

/**
 * Validates historical data availability and date range before creating a session.
 */
export interface HistoricalDataValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  startTimestamp: number;
  endTimestamp: number;
  initialReplayTimestamp: number;
  estimated1mBarsPerAsset: number;
  dataSourceLabel: string;
}

export function validateSessionHistoricalData(
  startDate: string,
  endDate: string,
  replayStartTime: string,
  assets: InstrumentSymbol[]
): HistoricalDataValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!startDate || !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
    errors.push('Historical Start Date is required and must be in YYYY-MM-DD format.');
  }
  if (!endDate || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
    errors.push('Historical End Date is required and must be in YYYY-MM-DD format.');
  }
  if (!assets || assets.length === 0) {
    errors.push('Select at least one trading instrument (e.g., XAUUSD).');
  }

  const timeStr = /^\d{2}:\d{2}$/.test(replayStartTime || '') ? replayStartTime : '08:00';
  const startTs = Math.floor(Date.parse(`${startDate}T00:00:00Z`) / 1000);
  const endTs = Math.floor(Date.parse(`${endDate}T23:59:00Z`) / 1000);
  const replayStartTs = Math.floor(Date.parse(`${startDate}T${timeStr}:00Z`) / 1000);

  const minSupportedTs = Math.floor(Date.parse('2010-01-01T00:00:00Z') / 1000);
  const maxSupportedTs = Math.floor(Date.now()/86400000)*86400+86399;

  if (Number.isNaN(startTs) || Number.isNaN(endTs)) {
    errors.push('Invalid calendar date provided.');
  } else {
    if (startTs >= endTs) {
      errors.push('Start Date must be earlier than End Date.');
    }
    if (startTs < minSupportedTs) {
      errors.push(
        `Choose a date from 2010 onward; original archive coverage is checked when the chart loads (requested ${startDate}).`
      );
    }
    if (endTs > maxSupportedTs) {
      errors.push(
        `End Date (${endDate}) is beyond the available historical dataset horizon.`
      );
    }
    const spanDays = (endTs - startTs) / 86400;
    if (spanDays < 0.5) {
      errors.push('Date range must span at least 1 trading day.');
    }
    if (replayStartTs < startTs || replayStartTs > endTs) {
      errors.push('Replay starting time must fall within the selected Start and End dates.');
    }
  }

  for (const sym of assets) {
    if (!INSTRUMENTS.some((i) => i.symbol === sym)) {
      errors.push(`Instrument "${sym}" is not supported by the historical data adapter.`);
    }
  }

  const dataSourceLabel = 'Original historical archive (coverage checked on load)';
  warnings.push('Replay requires original provider minute data. Missing dates and source gaps remain unavailable.');

  const spanMinutes = Math.max(0, Math.floor((endTs - startTs) / 60));

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    startTimestamp: Number.isNaN(startTs) ? 0 : startTs,
    endTimestamp: Number.isNaN(endTs) ? 0 : endTs,
    initialReplayTimestamp: Number.isNaN(replayStartTs) ? startTs : replayStartTs,
    estimated1mBarsPerAsset: spanMinutes,
    dataSourceLabel,
  };
}

/**
 * Hydrates and caches real market historical candles for a symbol across key timeframes (`1D`, `1W`, `1H`, `4H`, `15m`, `5m`, `1m`)
 * so that both the live chart and the replay engine use authoritative provider OHLC data.
 */
const activeHydrationPromises = new Map<string, Promise<boolean>>();

export async function hydrateRealMarketDataForSymbol(
  symbol: InstrumentSymbol,
  primaryTimeframe: Timeframe = '15m'
): Promise<boolean> {
  const key = `${symbol}_${primaryTimeframe}`;
  const inFlight = activeHydrationPromises.get(key);
  if (inFlight) return inFlight;

  const task = (async () => {
    try {
      const timeframesToHydrate = Array.from(
        new Set<Timeframe>([primaryTimeframe, '1D', '1W', '1H', '4H', '15m', '5m', '1m'])
      );
      const results = await Promise.all(
        timeframesToHydrate.map(async (tf) => {
          const existing = getCachedRealCandles(tf, symbol);
          if (existing && existing.length > 10) return true;
          const res = await fetchGoldCandles(tf, 2500, symbol);
          if (res.source === 'LIVE_SPOT_FEED' && res.candles.length > 0) {
            setCachedRealCandles(tf, symbol, res.candles);
            return true;
          }
          return false;
        })
      );
      // Clear cached synthetic day aggregations for this symbol so real provider data takes effect immediately
      for (const cacheKey of Array.from(completedDayTfCache.keys())) {
        if (cacheKey.startsWith(`${symbol}_`)) {
          completedDayTfCache.delete(cacheKey);
        }
      }
      for (const cacheKey of Array.from(day1mCandlesCache.keys())) {
        if (cacheKey.startsWith(`${symbol}_`)) {
          day1mCandlesCache.delete(cacheKey);
        }
      }
      return results.some(Boolean);
    } finally {
      activeHydrationPromises.delete(key);
    }
  })();

  activeHydrationPromises.set(key, task);
  return task;
}

export function hasRealMarketDataForSymbol(
  symbol: InstrumentSymbol,
  timeframe: Timeframe
): boolean {
  const direct = getCachedRealCandles(timeframe, symbol);
  if (direct && direct.length > 0) return true;
  const daily = getCachedRealCandles('1D', symbol);
  return Boolean(daily && daily.length > 0);
}

/**
 * Helper to look up a real provider Daily (`1D`) candle for `(symbol, utcDayIndex)` if loaded.
 */
function getRealDailyCandleForDay(symbol: InstrumentSymbol, utcDayIndex: number): Candle | null {
  const real1D = getCachedRealCandles('1D', symbol);
  if (!real1D || real1D.length === 0) return null;
  const dayStartSec = utcDayIndex * 86400;
  for (let i = real1D.length - 1; i >= 0; i--) {
    const cDay = Math.floor(real1D[i].time / 86400);
    if (cDay === utcDayIndex) return real1D[i];
    if (real1D[i].time < dayStartSec - 86400) break;
  }
  return null;
}

/**
 * Helper to look up real provider intraday (`1m`, `5m`, `15m`, `1H`) bars for `(symbol, utcDayIndex)`.
 */
function getRealIntradayBarsForDay(symbol: InstrumentSymbol, utcDayIndex: number): Candle[] | null {
  const dayStartSec = utcDayIndex * 86400;
  const dayEndSec = dayStartSec + 86400;
  const candidateTfs: Timeframe[] = ['1m', '5m', '15m', '1H'];
  for (const tf of candidateTfs) {
    const series = getCachedRealCandles(tf, symbol);
    if (!series || series.length === 0) continue;
    const inDay = series.filter((c) => c.time >= dayStartSec && c.time < dayEndSec);
    if (inDay.length > 0) return inDay;
  }
  return null;
}

/**
 * Continuous Multi-Year Day-Chunked 1-Minute (`1m`) Historical & Replay Engine.
 * - Prefers real provider intraday (`1m`/`5m`/`15m`/`1H`) and daily (`1D`) OHLC data whenever available in cache.
 * - Filters out weekend closed hours (`Fri 22:00 UTC` – `Sun 21:00 UTC`) on non-crypto markets.
 * - Never invents artificial impulses or alters authoritative provider OHLC boundaries.
 */
const EPOCH_DAY_2018 = Math.floor(Date.parse('2018-01-01T00:00:00Z') / 86400000);
const TOTAL_ANCHOR_DAYS = 5000; // Covers 2018-01-01 through 2031+
const symbolDailyAnchorCache = new Map<InstrumentSymbol, Float64Array>();
const day1mCandlesCache = new Map<string, Candle[]>();
const completedDayTfCache = new Map<string, Candle[]>();

function hashSymbolAndBucket(symbol: InstrumentSymbol, bucket: number): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < symbol.length; i++) {
    h ^= symbol.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  const bLow = bucket & 0xffff;
  const bHigh = (bucket >>> 16) & 0xffff;
  h ^= bLow;
  h = Math.imul(h, 16777619) >>> 0;
  h ^= bHigh;
  h = Math.imul(h, 16777619) >>> 0;
  return h >>> 0;
}

function getSymbolDailyAnchors(symbol: InstrumentSymbol): Float64Array {
  const existing = symbolDailyAnchorCache.get(symbol);
  if (existing) return existing;

  const cfg = getInstrumentConfig(symbol);
  const anchors = new Float64Array(TOTAL_ANCHOR_DAYS + 1);
  let seed = hashSymbolAndBucket(symbol, 777777);
  const nextRand = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const nextGaussian = () => {
    const u1 = Math.max(1e-7, nextRand());
    const u2 = nextRand();
    return Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
  };

  const dailyVol = cfg.volatility1m * Math.sqrt(1440) * 0.35;
  const minPrice = Math.max(cfg.minMove * 100, cfg.basePrice * 0.55);
  const maxPrice = cfg.basePrice * 1.45;

  let price = cfg.basePrice;
  let macroRegime = 0;
  anchors[0] = Number(price.toFixed(cfg.decimals));

  for (let d = 1; d <= TOTAL_ANCHOR_DAYS; d++) {
    if (d % 18 === 0) {
      const pullToCenter = (cfg.basePrice - price) * 0.08;
      macroRegime = nextGaussian() * dailyVol * 0.2 + pullToCenter / 18;
    }
    const meanReversion = (cfg.basePrice - price) * 0.015;
    const step = macroRegime + meanReversion + nextGaussian() * dailyVol;
    price = Math.max(minPrice, Math.min(maxPrice, price + step));
    anchors[d] = Number(price.toFixed(cfg.decimals));
  }

  symbolDailyAnchorCache.set(symbol, anchors);
  return anchors;
}

function getDailyAnchorPrice(symbol: InstrumentSymbol, utcDayIndex: number): number {
  const realDay = getRealDailyCandleForDay(symbol, utcDayIndex);
  if (realDay) return realDay.open;
  const prevRealDay = getRealDailyCandleForDay(symbol, utcDayIndex - 1);
  if (prevRealDay) return prevRealDay.close;

  const anchors = getSymbolDailyAnchors(symbol);
  const idx = Math.max(0, Math.min(TOTAL_ANCHOR_DAYS, utcDayIndex - EPOCH_DAY_2018));
  return anchors[idx];
}

/**
 * Retrieves or constructs the 1-minute (`1m`) bars for a single UTC day `utcDayIndex`.
 * - Priority 1: If real `1m` provider bars exist for this day, returns them directly.
 * - Priority 2: If real `5m`/`15m`/`1H` provider bars exist for this day, subdivides each real bar into
 *   4–60 deterministic 1m steps that strictly respect `[bar.open, bar.high, bar.low, bar.close]` (never exceeding `bar.high` or `bar.low`).
 * - Priority 3: If a real `1D` provider candle exists for this day, constructs 1m bars bounded strictly within `[realDay.low, realDay.high]`
 *   starting at `realDay.open` and closing at `realDay.close`.
 * - Priority 4: On weekends (Saturday UTC) for non-crypto markets, returns `[]` (market closed).
 */
export function getDay1mCandles(symbol: InstrumentSymbol, utcDayIndex: number): Candle[] {
  if(hasHistoricalArchive(symbol)) return (getHistoricalCandles('1m',symbol)||[]).filter(c=>c.time>=utcDayIndex*86400 && c.time<(utcDayIndex+1)*86400);
  const dayStartSec = utcDayIndex * 86400;
  const cfg = getInstrumentConfig(symbol);
  const decimals = cfg.decimals;

  // Return empty on Saturday UTC for non-crypto instruments
  const dayOfWeek = new Date(dayStartSec * 1000).getUTCDay();
  if (cfg.category !== 'CRYPTO' && dayOfWeek === 6) {
    return [];
  }

  // Check if real 1m bars are directly cached for this day
  const real1m = getCachedRealCandles('1m', symbol);
  if (real1m && real1m.length > 0) {
    const dayEndSec = dayStartSec + 86400;
    const direct1m = real1m.filter((c) => c.time >= dayStartSec && c.time < dayEndSec);
    if (direct1m.length >= 30) {
      return direct1m;
    }
  }

  const cacheKey = `${symbol}_${utcDayIndex}`;
  const cached = day1mCandlesCache.get(cacheKey);
  if (cached) return cached;

  // Check if real intraday bars (5m, 15m, 1H) exist for this day; if so, expand each real bar into 1m bars bounded by [bar.low, bar.high]
  const realIntraday = getRealIntradayBarsForDay(symbol, utcDayIndex);
  if (realIntraday && realIntraday.length > 0) {
    const expanded: Candle[] = [];
    for (let bIdx = 0; bIdx < realIntraday.length; bIdx++) {
      const parent = realIntraday[bIdx];
      const nextTime =
        bIdx + 1 < realIntraday.length
          ? Math.min(parent.time + 3600, realIntraday[bIdx + 1].time)
          : parent.time + 900;
      const numMinutes = Math.max(1, Math.min(60, Math.floor((nextTime - parent.time) / 60)));
      if (numMinutes === 1) {
        expanded.push({ ...parent });
        continue;
      }
      const highMinuteIdx = Math.max(0, Math.min(numMinutes - 1, Math.floor(numMinutes * 0.35)));
      const lowMinuteIdx = Math.max(
        0,
        Math.min(numMinutes - 1, highMinuteIdx === Math.floor(numMinutes * 0.7) ? numMinutes - 1 : Math.floor(numMinutes * 0.7))
      );
      let prevC = parent.open;
      const volPerMin = Math.max(1, Math.round(parent.volume / numMinutes));
      for (let m = 0; m < numMinutes; m++) {
        const t = parent.time + m * 60;
        if (isWeekendClosedTimestamp(t, symbol)) continue;
        const frac = (m + 1) / numMinutes;
        let targetC = parent.open + (parent.close - parent.open) * frac;
        if (m === highMinuteIdx) targetC = (parent.high + targetC) * 0.5;
        if (m === lowMinuteIdx) targetC = (parent.low + targetC) * 0.5;
        if (m === numMinutes - 1) targetC = parent.close;
        const o = Number(prevC.toFixed(decimals));
        const c = Number(Math.max(parent.low, Math.min(parent.high, targetC)).toFixed(decimals));
        let h = Math.max(o, c);
        let l = Math.min(o, c);
        if (m === highMinuteIdx) h = parent.high;
        if (m === lowMinuteIdx) l = parent.low;
        expanded.push({
          time: t,
          open: o,
          high: Number(Math.min(parent.high, h).toFixed(decimals)),
          low: Number(Math.max(parent.low, l).toFixed(decimals)),
          close: c,
          volume: volPerMin,
        });
        prevC = c;
      }
    }
    if (expanded.length > 0) {
      day1mCandlesCache.set(cacheKey, expanded);
      return expanded;
    }
  }

  const realDay = getRealDailyCandleForDay(symbol, utcDayIndex);
  const startPrice = realDay ? realDay.open : getDailyAnchorPrice(symbol, utcDayIndex);
  const targetEndPrice = realDay ? realDay.close : getDailyAnchorPrice(symbol, utcDayIndex + 1);
  const hardHigh = realDay ? realDay.high : Number.POSITIVE_INFINITY;
  const hardLow = realDay
    ? realDay.low
    : Math.max(cfg.minMove * 50, cfg.basePrice * 0.4);

  let seed = hashSymbolAndBucket(symbol, utcDayIndex);
  const nextRand = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const nextGaussian = () => {
    const u1 = Math.max(1e-7, nextRand());
    const u2 = nextRand();
    return Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
  };

  const candles: Candle[] = [];
  let currentClose = startPrice;

  for (let i = 0; i < 1440; i++) {
    const t = dayStartSec + i * 60;
    if (isWeekendClosedTimestamp(t, symbol)) continue;

    const remainingBars = Math.max(1, 1440 - i);
    const bridgePull = (targetEndPrice - currentClose) / remainingBars;
    const volSigma = cfg.volatility1m * 0.65;

    const open = currentClose;
    let high = open;
    let low = open;
    let p = open;

    const subSigma = volSigma / 2;
    const subDrift = bridgePull * 0.25;
    for (let s = 0; s < 4; s++) {
      p = Math.max(hardLow, Math.min(hardHigh, p + subDrift + nextGaussian() * subSigma));
      if (p > high) high = p;
      if (p < low) low = p;
    }

    if (i === 1439) {
      p = targetEndPrice;
      if (p > high) high = p;
      if (p < low) low = p;
    }

    const close = Number(Math.max(hardLow, Math.min(hardHigh, p)).toFixed(decimals));
    const roundedOpen = Number(Math.max(hardLow, Math.min(hardHigh, open)).toFixed(decimals));
    const roundedHigh = Number(
      Math.min(hardHigh, Math.max(high, roundedOpen, close)).toFixed(decimals)
    );
    const roundedLow = Number(
      Math.max(hardLow, Math.min(low, roundedOpen, close)).toFixed(decimals)
    );

    const volume = Math.max(
      25,
      Math.round((Math.abs(close - roundedOpen) / Math.max(1e-9, cfg.minMove)) * 3 + 45)
    );

    candles.push({
      time: t,
      open: roundedOpen,
      high: roundedHigh,
      low: roundedLow,
      close,
      volume,
    });
    currentClose = close;
  }

  if (day1mCandlesCache.size > 1200) {
    const firstKey = day1mCandlesCache.keys().next().value;
    if (firstKey) day1mCandlesCache.delete(firstKey);
  }
  day1mCandlesCache.set(cacheKey, candles);
  return candles;
}

/**
 * Generates or retrieves 1-minute (`1m`) bars for `symbol` covering `[windowStartSec, windowEndSec]`.
 */
export function getDeterministic1mCandles(
  symbol: InstrumentSymbol,
  windowStartSec: number,
  windowEndSec: number
): Candle[] {
  const startDay = Math.floor(windowStartSec / 86400);
  const endDay = Math.floor(windowEndSec / 86400);
  const effectiveStartDay = Math.max(startDay, endDay - 35);
  const result: Candle[] = [];
  for (let d = effectiveStartDay; d <= endDay; d++) {
    const dayBars = getDay1mCandles(symbol, d);
    for (let i = 0; i < dayBars.length; i++) {
      result.push(dayBars[i]);
    }
  }
  return result;
}

function getCompletedDayAggregatedCandles(
  symbol: InstrumentSymbol,
  utcDayIndex: number,
  timeframe: Timeframe,
  decimals: number
): Candle[] {
  if (timeframe === '1D') {
    const realDay = getRealDailyCandleForDay(symbol, utcDayIndex);
    if (realDay) return [realDay];
  }

  if (timeframe === '1m') {
    return getDay1mCandles(symbol, utcDayIndex);
  }
  const cacheKey = `${symbol}_${timeframe}_${utcDayIndex}_${decimals}`;
  const cached = completedDayTfCache.get(cacheKey);
  if (cached) return cached;

  const tfSec = TIMEFRAME_CONFIG[timeframe].seconds;
  const day1m = getDay1mCandles(symbol, utcDayIndex);
  if (day1m.length === 0) return [];
  const aggregated: Candle[] = [];
  let currentBucketTime = -1;
  let currentBar: Candle | null = null;

  for (let i = 0; i < day1m.length; i++) {
    const m = day1m[i];
    const bucket = getCanonicalBucketTime(m.time, timeframe, symbol);
    if (bucket !== currentBucketTime || !currentBar) {
      if (currentBar) aggregated.push(currentBar);
      currentBucketTime = bucket;
      currentBar = {
        time: bucket,
        open: Number(m.open.toFixed(decimals)),
        high: Number(m.high.toFixed(decimals)),
        low: Number(m.low.toFixed(decimals)),
        close: Number(m.close.toFixed(decimals)),
        volume: m.volume,
      };
    } else {
      if (m.high > currentBar.high) currentBar.high = Number(m.high.toFixed(decimals));
      if (m.low < currentBar.low) currentBar.low = Number(m.low.toFixed(decimals));
      currentBar.close = Number(m.close.toFixed(decimals));
      currentBar.volume += m.volume;
    }
  }
  if (currentBar) aggregated.push(currentBar);

  if (completedDayTfCache.size > 4000) {
    const firstKey = completedDayTfCache.keys().next().value;
    if (firstKey) completedDayTfCache.delete(firstKey);
  }
  completedDayTfCache.set(cacheKey, aggregated);
  return aggregated;
}

/**
 * Returns standard Japanese candlesticks for `(symbol, timeframe)` strictly up to `replayTimestamp` (ZERO LOOKAHEAD).
 *
 * - Priority 1 (Real Provider Series): When real market data for `(symbol, timeframe)` is cached and covers `replayTimestamp`,
 *   all completed higher-timeframe bars strictly prior to the active bucket (`bar.time + tfSec <= replayTimestamp`)
 *   are taken directly from the authoritative provider series, and the active in-progress candle at the right edge
 *   is constructed strictly from real intrabar candles (`<= replayTimestamp`) so no future high/low/close is ever leaked.
 * - Priority 2 (Day-Chunked Replay Series): If `replayTimestamp` falls outside the provider's intraday window,
 *   aggregates from `getDay1mCandles` (which itself anchors to real `1D` candles where available) strictly `<= replayTimestamp`.
 */
export function getAggregatedCandlesUpToClock(
  symbol: InstrumentSymbol,
  timeframe: Timeframe,
  replayTimestamp: number,
  session?: TradingSession | null,
  maxBarsToReturn = 50000
): Candle[] {
  if(session?.marketMode !== 'LIVE_PAPER' && hasHistoricalArchive(symbol)) return getProviderChartCandles(symbol,timeframe,replayTimestamp).slice(-maxBarsToReturn);

  const tfSec = TIMEFRAME_CONFIG[timeframe].seconds;
  const spec = getEffectiveInstrumentSpec(symbol, session);
  const decimals = spec.decimals;

  // 1. Check if authoritative real provider candles are available for this symbol & timeframe
  const realTfSeries = getCachedRealCandles(timeframe, symbol);
  if (realTfSeries && realTfSeries.length > 0) {
    const firstRealTime = realTfSeries[0].time;
    if (replayTimestamp >= firstRealTime) {
      const currentBucketStart = getCanonicalBucketTime(replayTimestamp, timeframe, symbol);
      const completedRealBars = realTfSeries.filter((c) => c.time < currentBucketStart);

      // Build the active (in-progress) bar at `currentBucketStart` strictly from lower-timeframe bars <= replayTimestamp
      if (timeframe === '1m') {
        const upToClock = realTfSeries.filter((c) => c.time <= replayTimestamp);
        if (upToClock.length > 0) {
          return upToClock.slice(-maxBarsToReturn);
        }
      } else {
        const lowerCandidates: Timeframe[] =
          (timeframe === '1W' || timeframe === '1M')
            ? ['1D', '4H', '1H']
            : timeframe === '1D'
            ? ['1H', '15m', '5m', '1m']
            : timeframe === '4H'
            ? ['1H', '15m', '5m', '1m']
            : timeframe === '1H'
            ? ['15m', '5m', '1m']
            : ['5m', '1m'];

        let partialBar: Candle | null = null;
        for (const ltf of lowerCandidates) {
          const ltfSeries = getCachedRealCandles(ltf, symbol);
          if (!ltfSeries || ltfSeries.length === 0) continue;
          const sliceInBucket = ltfSeries.filter(
            (c) => c.time >= currentBucketStart && c.time <= replayTimestamp
          );
          if (sliceInBucket.length > 0) {
            partialBar = {
              time: currentBucketStart,
              open: Number(sliceInBucket[0].open.toFixed(decimals)),
              high: Number(
                Math.max(...sliceInBucket.map((x) => x.high)).toFixed(decimals)
              ),
              low: Number(
                Math.min(...sliceInBucket.map((x) => x.low)).toFixed(decimals)
              ),
              close: Number(
                sliceInBucket[sliceInBucket.length - 1].close.toFixed(decimals)
              ),
              volume: sliceInBucket.reduce((acc, x) => acc + x.volume, 0),
            };
            break;
          }
        }

        // If no lower-timeframe real bar covers the active bucket yet, check if the bucket itself is already completed in realTfSeries
        if (!partialBar) {
          const exactBar = realTfSeries.find((c) => c.time === currentBucketStart);
          if (exactBar && getTimeframeEndTime(currentBucketStart, timeframe) <= replayTimestamp + 60) {
            partialBar = { ...exactBar };
          } else if (exactBar) {
            // Only expose the open price at the exact start of the bucket—never leak future high/low/close
            partialBar = {
              time: currentBucketStart,
              open: exactBar.open,
              high: exactBar.open,
              low: exactBar.open,
              close: exactBar.open,
              volume: Math.max(1, Math.round(exactBar.volume * 0.1)),
            };
          }
        }

        const merged = partialBar
          ? [...completedRealBars, partialBar]
          : completedRealBars;
        if (merged.length > 0) {
          return merged.slice(-maxBarsToReturn);
        }
      }
    }
  }

  const replayDay = Math.floor(replayTimestamp / 86400);

  // Number of lookback days needed before replayTimestamp so every timeframe has a rich chart immediately
  const lookbackDaysByTf: Record<Timeframe, number> = {
    '1m': 3,
    '5m': 10,
    '15m': 24,
    '30m': 45,
    '1H': 85,
    '4H': 240,
    '1D': 380,
    '1W': 1100,
    '1M': 3653,
  };
  const lookbackDays = lookbackDaysByTf[timeframe] || 14;
  const anchorStartDay = session?.startTimestamp
    ? Math.min(replayDay, Math.floor(session.startTimestamp / 86400))
    : replayDay;
  const startDay = Math.max(
    anchorStartDay - lookbackDays,
    replayDay - lookbackDays * 4
  );

  // Special handling for 1W aggregation across days
  if (timeframe === '1W' || timeframe === '1M') {
    const dailyBars = getAggregatedCandlesUpToClock(
      symbol,
      '1D',
      replayTimestamp,
      session,
      maxBarsToReturn * (timeframe === '1M' ? 31 : 7)
    );
    const weeklyMap = new Map<number, Candle>();
    for (const dBar of dailyBars) {
      const wBucket = getCanonicalBucketTime(dBar.time, timeframe, symbol);
      const existing = weeklyMap.get(wBucket);
      if (!existing) {
        weeklyMap.set(wBucket, { ...dBar, time: wBucket });
      } else {
        existing.high = Number(Math.max(existing.high, dBar.high).toFixed(decimals));
        existing.low = Number(Math.min(existing.low, dBar.low).toFixed(decimals));
        existing.close = Number(dBar.close.toFixed(decimals));
        existing.volume += dBar.volume;
      }
    }
    return Array.from(weeklyMap.values())
      .sort((a, b) => a.time - b.time)
      .slice(-maxBarsToReturn);
  }

  const aggregated: Candle[] = [];

  // 1. Append cached completed days strictly prior to replayDay
  for (let d = startDay; d < replayDay; d++) {
    const dayBars = getCompletedDayAggregatedCandles(symbol, d, timeframe, decimals);
    for (let i = 0; i < dayBars.length; i++) {
      aggregated.push(dayBars[i]);
    }
  }

  // 2. For replayDay itself, aggregate strictly from 1m bars <= replayTimestamp (NO LOOKAHEAD EVER)
  const activeDay1m = getDay1mCandles(symbol, replayDay);
  if (timeframe === '1m') {
    for (let i = 0; i < activeDay1m.length; i++) {
      if (activeDay1m[i].time <= replayTimestamp) {
        aggregated.push(activeDay1m[i]);
      } else {
        break;
      }
    }
    return aggregated.slice(-maxBarsToReturn);
  }

  let currentBucketTime = -1;
  let currentBar: Candle | null = null;

  for (let i = 0; i < activeDay1m.length; i++) {
    const m = activeDay1m[i];
    if (m.time > replayTimestamp) break;
    const bucket = getCanonicalBucketTime(m.time, timeframe, symbol);
    if (bucket !== currentBucketTime || !currentBar) {
      if (currentBar) aggregated.push(currentBar);
      currentBucketTime = bucket;
      currentBar = {
        time: bucket,
        open: Number(m.open.toFixed(decimals)),
        high: Number(m.high.toFixed(decimals)),
        low: Number(m.low.toFixed(decimals)),
        close: Number(m.close.toFixed(decimals)),
        volume: m.volume,
      };
    } else {
      if (m.high > currentBar.high) currentBar.high = Number(m.high.toFixed(decimals));
      if (m.low < currentBar.low) currentBar.low = Number(m.low.toFixed(decimals));
      currentBar.close = Number(m.close.toFixed(decimals));
      currentBar.volume += m.volume;
    }
  }

  if (currentBar) {
    aggregated.push(currentBar);
  }

  return aggregated.slice(-maxBarsToReturn);
}

/**
 * Returns the exact 1-minute (`1m`) candle at or immediately preceding `timestampSec` for a given `symbol`.
 */
export function getLatest1mCandleAtClock(
  symbol: InstrumentSymbol,
  timestampSec: number,
  _session?: TradingSession | null,
  completedArchiveBar = false
): Candle | null {
  if (_session?.marketMode === 'LIVE_PAPER') {
    const quote = _session.liveQuotes?.[symbol];
    if (!quote || quote.marketState === 'closed' || !Number.isFinite(quote.price) || quote.price <= 0 ||
      !Number.isFinite(quote.receivedAt) || !Number.isFinite(quote.time) ||
      quote.receivedAt > timestampSec + 5 || timestampSec - quote.receivedAt > 90 ||
      quote.time > timestampSec + 60 || timestampSec - quote.time > (quote.maxAgeSeconds ?? 20 * 60)) return null;
    // Evaluate only observed quote snapshots, never a candle's pre-entry wicks.
    return {time: timestampSec, open: quote.price, high: quote.price, low: quote.price, close: quote.price, volume: 0};
  }
  if(hasHistoricalArchive(symbol)) {
    const wanted=Math.floor(timestampSec/60)*60-(completedArchiveBar?60:0);
    const exact=(getHistoricalCandles('1m',symbol)||[]).find(c=>c.time===wanted);
    if(!exact)return null;
    return completedArchiveBar?exact:{...exact,high:exact.open,low:exact.open,close:exact.open,volume:0};
  }
  const startDay = Math.floor(timestampSec / 86400);
  for (let d = startDay; d >= startDay - 4; d--) {
    const dayBars = getDay1mCandles(symbol, d);
    if (dayBars.length === 0) continue;
    for (let i = dayBars.length - 1; i >= 0; i--) {
      if (dayBars[i].time <= timestampSec) {
        return dayBars[i];
      }
    }
    if (d === startDay && dayBars.length > 0) {
      return dayBars[0];
    }
  }
  return null;
}

/**
 * Returns all 1-minute (`1m`) execution candles in `(fromTimestampExclusive, toTimestampInclusive]` for `symbol`.
 */
export function get1mExecutionSlice(
  symbol: InstrumentSymbol,
  fromTimestampExclusive: number,
  toTimestampInclusive: number,
  _session?: TradingSession | null
): Candle[] {
  if (toTimestampInclusive <= fromTimestampExclusive) return [];
  if(_session?.marketMode !== 'LIVE_PAPER' && hasHistoricalArchive(symbol)) {
    return (getHistoricalCandles('1m',symbol)||[]).filter(c=>c.time+60>fromTimestampExclusive && c.time+60<=toTimestampInclusive).map(c=>({...c,time:c.time+60}));
  }

  const startDay = Math.floor(fromTimestampExclusive / 86400);
  const endDay = Math.floor(toTimestampInclusive / 86400);
  const slice: Candle[] = [];
  for (let d = startDay; d <= endDay; d++) {
    const dayBars = getDay1mCandles(symbol, d);
    for (let i = 0; i < dayBars.length; i++) {
      const bar = dayBars[i];
      if (bar.time > fromTimestampExclusive && bar.time <= toTimestampInclusive) {
        slice.push(bar);
      }
    }
  }
  return slice;
}

/**
 * Returns a read-only historical chart context slice around a closed/open trade `[entryTime, exitTime]`
 * without modifying any session's active `replayTimestamp`.
 * Note: For active sessions, caps at `session.replayTimestamp` so reviewing an open trade never leaks future prices.
 */
export function getTradeContextCandles(
  trade: BacktestPosition,
  timeframe: Timeframe,
  session: TradingSession
): Candle[] {
  const sym = trade.symbol || session.activeAsset || 'XAUUSD';
  const tfSec = TIMEFRAME_CONFIG[timeframe].seconds;
  const maxAllowedClock = session.replayTimestamp || (trade.exitTime ?? trade.entryTime) + tfSec * 20;
  const endRef = Math.min(
    maxAllowedClock,
    (trade.exitTime || trade.entryTime) + tfSec * 18
  );
  const startRef = trade.entryTime - tfSec * 30;
  const allUpToRef = getAggregatedCandlesUpToClock(sym, timeframe, endRef, session, 600);
  return allUpToRef.filter((c) => c.time >= startRef && c.time <= endRef);
}

/**
 * Initializes a brand-new `ChallengeState` for a session.
 */
export function createInitialChallengeState(
  startingBalance: number,
  startTimestamp: number,
  rules: PropFirmRules
): ChallengeState {
  const tz = rules.dailyResetTimezone || 'UTC';
  const resetTime = rules.dailyResetTime || '00:00';
  const dayKey = getTradingDayKeyAtTimestamp(startTimestamp, tz, resetTime);
  const dailyLossLimit = startingBalance * (rules.maxDailyDrawdownPct / 100);

  return {
    status: 'ACTIVE',
    highWaterMarkBalance: startingBalance,
    highWaterMarkEquity: startingBalance,
    currentDayKey: dayKey,
    dailyResetBalance: startingBalance,
    dailyResetEquity: startingBalance,
    dailyBaseline: startingBalance,
    dailySnapshots: [
      {
        dayKey,
        resetTimestamp: startTimestamp,
        balanceAtReset: startingBalance,
        equityAtReset: startingBalance,
        dailyBaseline: startingBalance,
        dailyLossThreshold: Number((startingBalance - dailyLossLimit).toFixed(2)),
      },
    ],
    tradedDays: [],
    maxDailyLossUsed: 0,
    maxOverallLossUsed: 0,
  };
}

/**
 * Computes current live session metrics (Balance, Floating Equity, Unrealized P&L, Margin, and Live Challenge Objectives)
 * at the session's current `replayTimestamp`.
 */
export interface LiveSessionMetrics {
  startingBalance: number;
  currentBalance: number;
  unrealizedPnl: number;
  currentEquity: number;
  netPnl: number;
  returnPct: number;
  usedMargin: number;
  freeMargin: number;
  marginLevelPct: number | null;
  // Challenge Tracker Metrics
  profitTargetAmount: number;
  profitProgressAmount: number;
  profitRemainingAmount: number;
  profitProgressPct: number;
  dailyBaseline: number;
  dailyLossThreshold: number;
  dailyLossLimitAmount: number;
  dailyLossUsedAmount: number;
  dailyLossRemainingAmount: number;
  dailyLossUsedPct: number;
  overallBaseline: number;
  overallLossThreshold: number;
  overallLossLimitAmount: number;
  overallLossUsedAmount: number;
  overallLossRemainingAmount: number;
  overallLossUsedPct: number;
  tradingDaysCompleted: number;
  minTradingDaysRequired: number;
  elapsedCalendarDays: number;
  maxDurationDays: number | null;
  calculationBasis: ChallengeCalculationBasis;
  drawdownType: 'STATIC' | 'TRAILING';
}

export function computeAuthoritativeRealizedPnl(session: TradingSession): number {
  const positions = session.positions ?? [];
  if (positions.length === 0) {
    return Number((session.realizedPnL ?? 0).toFixed(2));
  }
  let total = 0;
  for (const p of positions) {
    if (
      p.status === 'CLOSED_TP' ||
      p.status === 'CLOSED_SL' ||
      p.status === 'CLOSED_MANUAL' ||
      p.status === 'CLOSED_BREACH' ||
      p.status.startsWith('CLOSED_')
    ) {
      total += p.pnl ?? 0;
    } else if (p.status === 'OPEN') {
      total += (p.bankedPartialPnl ?? 0) - (p.commissionPaid ?? 0);
    }
  }
  return Number(total.toFixed(2));
}

export function computeLiveSessionMetrics(session: TradingSession): LiveSessionMetrics {
  const startingBalance = session.frozenConfig?.startingBalance ?? session.startingBalance;
  const realizedPnL = computeAuthoritativeRealizedPnl(session);
  const currentBalance = Number((startingBalance + realizedPnL).toFixed(2));
  const positions = session.positions ?? [];
  const openPositions = positions.filter((p) => p.status === 'OPEN');

  const unrealizedPnl = Number(
    openPositions.reduce((sum, p) => sum + (p.openFloatingPnl ?? p.pnl ?? 0), 0).toFixed(2)
  );
  const currentEquity = Number((currentBalance + unrealizedPnl).toFixed(2));
  const netPnl = Number((currentEquity - startingBalance).toFixed(2));
  const returnPct = startingBalance > 0 ? Number(((netPnl / startingBalance) * 100).toFixed(2)) : 0;

  // Margin calculation
  const leverage = session.frozenConfig?.moreOptions?.leverage || session.moreOptions?.leverage || 100;
  const currency = session.frozenConfig?.accountCurrency || session.accountCurrency || 'USD';
  const usedMargin = Number(
    openPositions
      .reduce((sum, p) => {
        const sym = p.symbol || session.activeAsset || 'XAUUSD';
        const spec = getEffectiveInstrumentSpec(sym, session);
        const notionalUsd = p.lotSize * spec.contractSize * p.entryPrice;
        return sum + convertUsdToAccountCurrency(notionalUsd / leverage, currency);
      }, 0)
      .toFixed(2)
  );
  const freeMargin = Number((currentEquity - usedMargin).toFixed(2));
  const marginLevelPct =
    usedMargin > 0 ? Number(((currentEquity / usedMargin) * 100).toFixed(1)) : null;

  const rules = session.frozenConfig?.propFirmRules || session.propFirmRules;
  const calculationBasis: ChallengeCalculationBasis = rules.calculationBasis || 'EQUITY';
  const drawdownType = rules.drawdownType || 'STATIC';
  const cs = session.challengeState;

  const measuredAccountValue =
    calculationBasis === 'EQUITY' ? currentEquity : currentBalance;

  const profitTargetAmount = Number(
    (startingBalance * (rules.profitTargetPct / 100)).toFixed(2)
  );
  const currentProfitForTarget = Number((measuredAccountValue - startingBalance).toFixed(2));
  const profitProgressAmount = Math.max(0, currentProfitForTarget);
  const profitRemainingAmount = Math.max(
    0,
    Number((profitTargetAmount - currentProfitForTarget).toFixed(2))
  );
  const profitProgressPct =
    profitTargetAmount > 0
      ? Math.min(100, Math.max(0, Number(((currentProfitForTarget / profitTargetAmount) * 100).toFixed(1))))
      : 100;

  // Daily Loss Calculation
  const dailyBaseline = cs?.dailyBaseline ?? startingBalance;
  const dailyLossLimitAmount = Number(
    (startingBalance * (rules.maxDailyDrawdownPct / 100)).toFixed(2)
  );
  const dailyLossThreshold = Number((dailyBaseline - dailyLossLimitAmount).toFixed(2));
  const dailyLossUsedAmount = Math.max(
    0,
    Number((dailyBaseline - measuredAccountValue).toFixed(2))
  );
  const dailyLossRemainingAmount = Math.max(
    0,
    Number((dailyLossLimitAmount - dailyLossUsedAmount).toFixed(2))
  );
  const dailyLossUsedPct =
    dailyLossLimitAmount > 0
      ? Math.min(100, Math.max(0, Number(((dailyLossUsedAmount / dailyLossLimitAmount) * 100).toFixed(1))))
      : 0;

  // Overall Loss Calculation (STATIC from startingBalance vs TRAILING from High-Water Mark)
  const hwm =
    calculationBasis === 'EQUITY'
      ? Math.max(startingBalance, cs?.highWaterMarkEquity ?? startingBalance)
      : Math.max(startingBalance, cs?.highWaterMarkBalance ?? startingBalance);
  const overallBaseline = drawdownType === 'TRAILING' ? hwm : startingBalance;
  const overallLossLimitAmount = Number(
    (startingBalance * (rules.maxTotalDrawdownPct / 100)).toFixed(2)
  );
  const overallLossThreshold = Number((overallBaseline - overallLossLimitAmount).toFixed(2));
  const overallLossUsedAmount = Math.max(
    0,
    Number((overallBaseline - measuredAccountValue).toFixed(2))
  );
  const overallLossRemainingAmount = Math.max(
    0,
    Number((overallLossLimitAmount - overallLossUsedAmount).toFixed(2))
  );
  const overallLossUsedPct =
    overallLossLimitAmount > 0
      ? Math.min(
          100,
          Math.max(0, Number(((overallLossUsedAmount / overallLossLimitAmount) * 100).toFixed(1)))
        )
      : 0;

  const tradingDaysCompleted = cs?.tradedDays?.length ?? 0;
  const minTradingDaysRequired =
    rules.minTradingDaysEnabled !== false ? rules.minTradingDays : 0;

  const startTs =
    session.startTimestamp || Math.floor(Date.parse(`${session.startDate}T00:00:00Z`) / 1000);
  const replayTs = session.replayTimestamp || startTs;
  const elapsedCalendarDays = Math.max(0, Math.floor((replayTs - startTs) / 86400));
  const maxDurationDays =
    rules.maxDurationEnabled && rules.maxDurationDays ? rules.maxDurationDays : null;

  return {
    startingBalance,
    currentBalance,
    unrealizedPnl,
    currentEquity,
    netPnl,
    returnPct,
    usedMargin,
    freeMargin,
    marginLevelPct,
    profitTargetAmount,
    profitProgressAmount,
    profitRemainingAmount,
    profitProgressPct,
    dailyBaseline,
    dailyLossThreshold,
    dailyLossLimitAmount,
    dailyLossUsedAmount,
    dailyLossRemainingAmount,
    dailyLossUsedPct,
    overallBaseline,
    overallLossThreshold,
    overallLossLimitAmount,
    overallLossUsedAmount,
    overallLossRemainingAmount,
    overallLossUsedPct,
    tradingDaysCompleted,
    minTradingDaysRequired,
    elapsedCalendarDays,
    maxDurationDays,
    calculationBasis,
    drawdownType,
  };
}

/**
 * Evaluates Prop Firm Challenge Rules at a specific timestamp & account state.
 * Strictly evaluates BREACHES BEFORE PASSING CONDITIONS.
 */
export function evaluateChallengeRulesAtStep(
  session: TradingSession,
  timestampSec: number,
  worstCaseIntrabarEquity?: number,
  triggeringTradeId?: string
): {
  updatedSession: TradingSession;
  breachedNow: BreachEventRecord | null;
  passedNow: PassedEventRecord | null;
} {
  if (session.mode !== 'PROP_FIRM') {
    return { updatedSession: session, breachedNow: null, passedNow: null };
  }

  const rules = session.frozenConfig?.propFirmRules || session.propFirmRules;
  const cs: ChallengeState = session.challengeState
    ? {
        ...session.challengeState,
        dailySnapshots: [...session.challengeState.dailySnapshots],
        tradedDays: [...session.challengeState.tradedDays],
      }
    : createInitialChallengeState(
        session.startingBalance,
        session.startTimestamp || timestampSec,
        rules
      );

  // If already terminal, do not re-trigger
  if (session.status === 'FAILED' || session.status === 'PASSED' || cs.status !== 'ACTIVE') {
    return { updatedSession: session, breachedNow: null, passedNow: null };
  }

  const startingBalance = session.frozenConfig?.startingBalance ?? session.startingBalance;
  const realizedPnL = computeAuthoritativeRealizedPnl(session);
  const currentBalance = Number((startingBalance + realizedPnL).toFixed(2));
  const positions = session.positions ?? [];
  const openPositions = positions.filter((p) => p.status === 'OPEN');
  const unrealizedPnl = Number(
    openPositions.reduce((sum, p) => sum + (p.openFloatingPnl ?? p.pnl ?? 0), 0).toFixed(2)
  );
  const currentEquity = Number((currentBalance + unrealizedPnl).toFixed(2));

  const calculationBasis: ChallengeCalculationBasis = rules.calculationBasis || 'EQUITY';
  const drawdownType = rules.drawdownType || 'STATIC';
  const tz = rules.dailyResetTimezone || 'UTC';
  const resetTime = rules.dailyResetTime || '00:00';
  const currency = session.frozenConfig?.accountCurrency || session.accountCurrency || 'USD';

  // 1. Check Daily Reset Rollover in configured timezone
  const dayKey = getTradingDayKeyAtTimestamp(timestampSec, tz, resetTime);
  if (dayKey !== cs.currentDayKey) {
    cs.currentDayKey = dayKey;
    cs.dailyResetBalance = currentBalance;
    cs.dailyResetEquity = currentEquity;
    cs.dailyBaseline =
      calculationBasis === 'EQUITY'
        ? Math.max(currentBalance, currentEquity)
        : currentBalance;
    const dailyLimit = startingBalance * (rules.maxDailyDrawdownPct / 100);
    cs.dailySnapshots.push({
      dayKey,
      resetTimestamp: timestampSec,
      balanceAtReset: currentBalance,
      equityAtReset: currentEquity,
      dailyBaseline: cs.dailyBaseline,
      dailyLossThreshold: Number((cs.dailyBaseline - dailyLimit).toFixed(2)),
    });
  }

  // Update High-Water Marks
  if (currentBalance > cs.highWaterMarkBalance) {
    cs.highWaterMarkBalance = currentBalance;
  }
  if (currentEquity > cs.highWaterMarkEquity) {
    cs.highWaterMarkEquity = currentEquity;
  }

  // Value used to test loss limits (if EQUITY-based, use the lower of currentEquity and worstCaseIntrabarEquity)
  const effectiveEquityForLoss =
    worstCaseIntrabarEquity !== undefined
      ? Math.min(currentEquity, worstCaseIntrabarEquity)
      : currentEquity;
  const measuredForLoss =
    calculationBasis === 'EQUITY' ? effectiveEquityForLoss : currentBalance;

  const dailyLossLimitAmount = Number(
    (startingBalance * (rules.maxDailyDrawdownPct / 100)).toFixed(2)
  );
  const dailyLossThreshold = Number((cs.dailyBaseline - dailyLossLimitAmount).toFixed(2));
  const dailyLossUsed = Math.max(0, Number((cs.dailyBaseline - measuredForLoss).toFixed(2)));
  if (dailyLossUsed > cs.maxDailyLossUsed) {
    cs.maxDailyLossUsed = dailyLossUsed;
  }

  const overallBaseline =
    drawdownType === 'TRAILING'
      ? calculationBasis === 'EQUITY'
        ? cs.highWaterMarkEquity
        : cs.highWaterMarkBalance
      : startingBalance;
  const overallLossLimitAmount = Number(
    (startingBalance * (rules.maxTotalDrawdownPct / 100)).toFixed(2)
  );
  const overallLossThreshold = Number(
    (overallBaseline - overallLossLimitAmount).toFixed(2)
  );
  const overallLossUsed = Math.max(
    0,
    Number((overallBaseline - measuredForLoss).toFixed(2))
  );
  if (overallLossUsed > cs.maxOverallLossUsed) {
    cs.maxOverallLossUsed = overallLossUsed;
  }

  // STEP A: EVALUATE LOSS & DURATION BREACHES FIRST
  let breach: BreachEventRecord | null = null;

  if (measuredForLoss <= dailyLossThreshold || dailyLossUsed >= dailyLossLimitAmount) {
    breach = {
      rule: 'MAX_DAILY_LOSS',
      ruleLabel: `Maximum Daily Loss (${rules.maxDailyDrawdownPct}%)`,
      timestamp: timestampSec,
      threshold: dailyLossThreshold,
      measuredValue: measuredForLoss,
      lossAmount: dailyLossUsed,
      lossLimitAmount: dailyLossLimitAmount,
      calculationBasis,
      drawdownType,
      explanation: `Daily ${calculationBasis.toLowerCase()} dropped to ${formatMoney(
        measuredForLoss,
        currency
      )}, breaching the daily minimum threshold of ${formatMoney(
        dailyLossThreshold,
        currency
      )} (Daily Baseline ${formatMoney(cs.dailyBaseline, currency)} - Max Daily Loss ${formatMoney(
        dailyLossLimitAmount,
        currency
      )}).`,
      triggeringTradeId,
    };
  } else if (
    measuredForLoss <= overallLossThreshold ||
    overallLossUsed >= overallLossLimitAmount
  ) {
    breach = {
      rule: 'MAX_OVERALL_LOSS',
      ruleLabel: `Maximum Overall ${drawdownType === 'TRAILING' ? 'Trailing ' : ''}Loss (${
        rules.maxTotalDrawdownPct
      }%)`,
      timestamp: timestampSec,
      threshold: overallLossThreshold,
      measuredValue: measuredForLoss,
      lossAmount: overallLossUsed,
      lossLimitAmount: overallLossLimitAmount,
      calculationBasis,
      drawdownType,
      explanation: `Account ${calculationBasis.toLowerCase()} fell to ${formatMoney(
        measuredForLoss,
        currency
      )}, breaching the ${drawdownType.toLowerCase()} overall drawdown floor of ${formatMoney(
        overallLossThreshold,
        currency
      )} (${
        drawdownType === 'TRAILING' ? 'High-Water Mark' : 'Starting Balance'
      } ${formatMoney(overallBaseline, currency)} - Max Overall Loss ${formatMoney(
        overallLossLimitAmount,
        currency
      )}).`,
      triggeringTradeId,
    };
  } else if (rules.maxDurationEnabled && rules.maxDurationDays && rules.maxDurationDays > 0) {
    const startTs =
      session.startTimestamp || Math.floor(Date.parse(`${session.startDate}T00:00:00Z`) / 1000);
    const elapsedDays = (timestampSec - startTs) / 86400;
    if (elapsedDays > rules.maxDurationDays) {
      breach = {
        rule: 'MAX_DURATION_EXPIRED',
        ruleLabel: `Maximum Challenge Duration (${rules.maxDurationDays} Days)`,
        timestamp: timestampSec,
        threshold: rules.maxDurationDays,
        measuredValue: Number(elapsedDays.toFixed(1)),
        lossAmount: 0,
        lossLimitAmount: 0,
        calculationBasis,
        drawdownType,
        explanation: `Challenge duration exceeded the maximum allowed ${rules.maxDurationDays} calendar days without completing all objectives.`,
      };
    }
  }

  if (breach) {
    cs.status = 'FAILED';
    cs.breachEvent = breach;

    // Apply Terminal Position-Handling Policy (default: CLOSE_ALL)
    const policy = rules.terminalPositionPolicy || 'CLOSE_ALL';
    let nextPositions = [...positions];
    let nextRealizedPnL = realizedPnL;
    const nextTradeEvents = [...(session.tradeEvents ?? [])];

    if (policy === 'CLOSE_ALL') {
      nextPositions = nextPositions.map((pos) => {
        if (pos.status === 'PENDING') {
          nextTradeEvents.push({
            id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            sessionId: session.id,
            positionId: pos.id,
            symbol: pos.symbol || session.activeAsset,
            timestamp: timestampSec,
            type: 'ORDER_CANCELLED',
            description: `Pending order cancelled automatically due to challenge breach (${breach!.ruleLabel}).`,
          });
          return { ...pos, status: 'CANCELLED' as const };
        }
        if (pos.status === 'OPEN') {
          const sym = pos.symbol || session.activeAsset;
          const candle = getLatest1mCandleAtClock(sym, timestampSec, session);
          const { bid, ask } = getBidAskFromMid(
            candle?.close ?? pos.entryPrice,
            sym,
            session
          );
          const exitPrice = pos.side === 'LONG' ? bid : ask;
          const openLot = pos.lotSize;
          const closeLegPnl = calculatePositionPnl(
            pos.side,
            pos.entryPrice,
            exitPrice,
            openLot,
            sym,
            session
          );
          const totalNetPositionPnl = Number(
            ((pos.bankedPartialPnl ?? 0) + closeLegPnl - (pos.commissionPaid ?? 0)).toFixed(2)
          );
          nextRealizedPnL = Number((nextRealizedPnL + closeLegPnl).toFixed(2));
          const rMult =
            pos.initialRiskDollars && pos.initialRiskDollars > 0
              ? Number((totalNetPositionPnl / pos.initialRiskDollars).toFixed(2))
              : null;

          nextTradeEvents.push({
            id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            sessionId: session.id,
            positionId: pos.id,
            symbol: sym,
            timestamp: timestampSec,
            type: 'POSITION_CLOSED_BREACH',
            description: `Position force-closed at ${exitPrice} due to ${breach!.ruleLabel} breach.`,
            price: exitPrice,
            lotSize: openLot,
            pnlDelta: closeLegPnl,
          });

          return {
            ...pos,
            status: 'CLOSED_BREACH' as const,
            exitPrice,
            exitTime: timestampSec,
            openFloatingPnl: 0,
            pnl: totalNetPositionPnl,
            rMultiple: rMult,
          };
        }
        return pos;
      });
    }

    const updatedSession: TradingSession = {
      ...session,
      status: 'FAILED',
      failReason: breach.explanation,
      realizedPnL: computeAuthoritativeRealizedPnl({
        ...session,
        positions: nextPositions,
        realizedPnL: nextRealizedPnL,
      }),
      positions: nextPositions,
      tradeEvents: nextTradeEvents,
      challengeState: cs,
      updatedAt: new Date().toISOString(),
    };

    return { updatedSession, breachedNow: breach, passedNow: null };
  }

  // STEP B: EVALUATE PASSING CONDITIONS (Only if no breach occurred!)
  const measuredForTarget =
    calculationBasis === 'EQUITY' ? currentEquity : currentBalance;
  const profitTargetAmount = Number(
    (startingBalance * (rules.profitTargetPct / 100)).toFixed(2)
  );
  const netProfitForTarget = Number((measuredForTarget - startingBalance).toFixed(2));
  const minDaysRequired =
    rules.minTradingDaysEnabled !== false ? rules.minTradingDays : 0;
  const tradingDaysCompleted = cs.tradedDays.length;

  if (
    profitTargetAmount > 0 &&
    netProfitForTarget >= profitTargetAmount &&
    tradingDaysCompleted >= minDaysRequired
  ) {
    const startTs =
      session.startTimestamp || Math.floor(Date.parse(`${session.startDate}T00:00:00Z`) / 1000);
    const elapsedDays = Math.max(1, Math.ceil((timestampSec - startTs) / 86400));
    const returnPct = Number(((netProfitForTarget / startingBalance) * 100).toFixed(2));
    const currentPhase = rules.challengePhase || 'PHASE_1';

    if (currentPhase === 'PHASE_1') {
      const nextPhaseTargetPct =
        rules.phase2ProfitTargetPct ||
        rules.phases?.find((p) => p.phaseId === 'PHASE_2')?.profitTargetPct ||
        Math.max(1, Number((rules.profitTargetPct * 0.5).toFixed(1)));
      const nextPhaseTargetAmount = Number(
        (startingBalance * (nextPhaseTargetPct / 100)).toFixed(2)
      );

      const passed: PassedEventRecord = {
        timestamp: timestampSec,
        finalBalance: currentBalance,
        finalEquity: currentEquity,
        netPnl: netProfitForTarget,
        returnPct,
        tradingDaysCompleted,
        minTradingDaysRequired: minDaysRequired,
        elapsedDays,
        phaseId: 'PHASE_1',
        advancedToPhase2: true,
        nextPhaseTargetPct,
        explanation: `Phase 1 Passed! Reached ${formatMoney(
          netProfitForTarget,
          currency,
          true
        )} (+${returnPct}%), meeting the Phase 1 ${rules.profitTargetPct}% profit target (${formatMoney(
          profitTargetAmount,
          currency
        )}) and ${tradingDaysCompleted}/${minDaysRequired} minimum trading days. Your account has automatically advanced to Phase 2 (${nextPhaseTargetPct}% target / ${formatMoney(
          nextPhaseTargetAmount,
          currency
        )}) with a fresh ${formatMoney(startingBalance, currency)} starting balance!`,
      };

      const closedTrades = (session.positions ?? []).filter((p) =>
        p.status.startsWith('CLOSED_')
      );
      const wins = closedTrades.filter((t) => t.pnl > 0);
      const winRatePct =
        closedTrades.length > 0
          ? Number(((wins.length / closedTrades.length) * 100).toFixed(1))
          : 0;

      const archivedPhase1Attempt: ChallengeAttemptSummary = {
        attemptNumber: session.attemptNumber || 1,
        sessionId: session.id,
        phaseId: 'PHASE_1',
        startedAt: session.createdAt,
        endedAt: new Date(timestampSec * 1000).toISOString(),
        status: 'PASSED',
        finalBalance: currentBalance,
        finalEquity: currentEquity,
        netPnl: netProfitForTarget,
        returnPct,
        tradesCount: closedTrades.length,
        winRatePct,
        tradingDaysCompleted,
        passedEvent: passed,
        positionsSnapshot: JSON.parse(JSON.stringify(session.positions ?? [])),
      };

      const nextRules: PropFirmRules = {
        ...rules,
        challengePhase: 'PHASE_2',
        phase1ProfitTargetPct: rules.phase1ProfitTargetPct ?? rules.profitTargetPct,
        phase2ProfitTargetPct: nextPhaseTargetPct,
        profitTargetPct: nextPhaseTargetPct,
      };

      const freshPhase2State = createInitialChallengeState(
        startingBalance,
        timestampSec,
        nextRules
      );

      const nextName = session.name.includes('Phase 1')
        ? session.name.replace('Phase 1', 'Phase 2')
        : session.name.includes('Phase 2')
        ? session.name
        : `${session.name} (Phase 2)`;

      const updatedSession: TradingSession = {
        ...session,
        name: nextName,
        status: 'ACTIVE',
        failReason: undefined,
        passedAt: undefined,
        attemptNumber: (session.attemptNumber || 1) + 1,
        previousAttempts: [
          archivedPhase1Attempt,
          ...(session.previousAttempts ?? []),
        ],
        realizedPnL: 0,
        positions: [],
        orders: [],
        propFirmRules: nextRules,
        frozenConfig: session.frozenConfig
          ? {
              ...session.frozenConfig,
              propFirmRules: nextRules,
            }
          : session.frozenConfig,
        challengeState: freshPhase2State,
        updatedAt: new Date().toISOString(),
      };

      return { updatedSession, breachedNow: null, passedNow: passed };
    }

    const passed: PassedEventRecord = {
      timestamp: timestampSec,
      finalBalance: currentBalance,
      finalEquity: currentEquity,
      netPnl: netProfitForTarget,
      returnPct,
      tradingDaysCompleted,
      minTradingDaysRequired: minDaysRequired,
      elapsedDays,
      phaseId: currentPhase,
      advancedToPhase2: false,
      explanation: `Congratulations! Passed ${
        currentPhase === 'PHASE_2' ? 'Phase 2 Verification' : 'Prop Firm Evaluation'
      }! Reached ${formatMoney(
        netProfitForTarget,
        currency,
        true
      )} (+${returnPct}%), meeting the ${rules.profitTargetPct}% profit target (${formatMoney(
        profitTargetAmount,
        currency
      )}) and ${tradingDaysCompleted}/${minDaysRequired} minimum trading days without breaching any drawdown limit.`,
    };

    cs.status = 'PASSED';
    cs.passedEvent = passed;

    const updatedSession: TradingSession = {
      ...session,
      status: 'PASSED',
      passedAt: new Date(timestampSec * 1000).toISOString(),
      challengeState: cs,
      updatedAt: new Date().toISOString(),
    };

    return { updatedSession, breachedNow: null, passedNow: passed };
  }

  return {
    updatedSession: {
      ...session,
      challengeState: cs,
    },
    breachedNow: null,
    passedNow: null,
  };
}

/**
 * Evaluates a single 1-minute (`1m`) candle across all open and pending positions in `session`.
 * - Uses Bid/Ask prices derived from the session's spread model.
 * - Applies the documented conservative SL-first policy if a single 1m bar touches both SL and TP,
 *   and flags the trade with `isAmbiguous: true`.
 * - Evaluates Prop Firm Challenge rules on every 1m step (including intrabar worst-case floating equity).
 */
export interface StepEvaluationOutcome {
  session: TradingSession;
  triggeredOrders: BacktestPosition[];
  closedTrades: {
    position: BacktestPosition;
    reason: 'TP' | 'SL' | 'BREACH';
    isAmbiguous?: boolean;
  }[];
  breachedNow: BreachEventRecord | null;
  passedNow: PassedEventRecord | null;
}

export function evaluateSessionAt1mTimestamp(
  session: TradingSession,
  timestampSec: number
): StepEvaluationOutcome {
  const triggeredOrders: BacktestPosition[] = [];
  const closedTrades: StepEvaluationOutcome['closedTrades'] = [];

  if (session.status === 'FAILED' || session.status === 'PASSED') {
    return {
      session: { ...session, replayTimestamp: timestampSec },
      triggeredOrders,
      closedTrades,
      breachedNow: null,
      passedNow: null,
    };
  }

  const rules = session.frozenConfig?.propFirmRules || session.propFirmRules;
  const tz = rules.dailyResetTimezone || 'UTC';
  const resetTime = rules.dailyResetTime || '00:00';
  const currency = session.frozenConfig?.accountCurrency || session.accountCurrency || 'USD';
  const commPerLotUsd =
    session.frozenConfig?.moreOptions?.commissionPerLotUsd ??
    session.moreOptions?.commissionPerLotUsd ??
    0;

  let nextRealizedPnL = session.realizedPnL ?? 0;
  const nextFills = [...(session.fills ?? [])];
  const nextTradeEvents = [...(session.tradeEvents ?? [])];
  const nextTradedDays = new Set<string>(session.challengeState?.tradedDays ?? []);

  // Track worst-case intrabar unrealized PnL across all open positions during this 1m bar
  let worstIntrabarUnrealizedPnl = 0;

  const updatedPositions = (session.positions ?? []).map((pos) => {
    const sym = pos.symbol || session.activeAsset || 'XAUUSD';
    const spec = getEffectiveInstrumentSpec(sym, session);
    const dec = spec.decimals;
    const candle = getLatest1mCandleAtClock(sym, timestampSec, session, true);
    if (!candle) return pos;

    const spread = getSessionSpreadPrice(sym, session);
    const halfSpread = spread * 0.5;

    const bidOpen = Number((candle.open - halfSpread).toFixed(dec));
    const bidHigh = Number((candle.high - halfSpread).toFixed(dec));
    const bidLow = Number((candle.low - halfSpread).toFixed(dec));
    const bidClose = Number((candle.close - halfSpread).toFixed(dec));

    const askOpen = Number((candle.open + halfSpread).toFixed(dec));
    const askHigh = Number((candle.high + halfSpread).toFixed(dec));
    const askLow = Number((candle.low + halfSpread).toFixed(dec));
    const askClose = Number((candle.close + halfSpread).toFixed(dec));

    let activePos = { ...pos };

    // 1. Check if PENDING order is triggered by this 1m bar's Bid/Ask range
    if (activePos.status === 'PENDING') {
      const subType: OrderSubType =
        activePos.orderSubType ||
        (activePos.side === 'LONG' ? 'BUY_LIMIT' : 'SELL_LIMIT');

      let touched = false;
      if (subType === 'BUY_LIMIT') {
        touched = askLow <= activePos.entryPrice;
      } else if (subType === 'BUY_STOP') {
        touched = askHigh >= activePos.entryPrice;
      } else if (subType === 'SELL_LIMIT') {
        touched = bidHigh >= activePos.entryPrice;
      } else if (subType === 'SELL_STOP') {
        touched = bidLow <= activePos.entryPrice;
      } else {
        touched = candle.low <= activePos.entryPrice && candle.high >= activePos.entryPrice;
      }

      if (!touched) {
        return activePos;
      }

      const commAcc = convertUsdToAccountCurrency(commPerLotUsd * activePos.lotSize, currency);
      const spreadCostAcc = convertUsdToAccountCurrency(
        spread * activePos.lotSize * spec.contractSize,
        currency
      );
      nextRealizedPnL = Number((nextRealizedPnL - commAcc).toFixed(2));

      const dayKey = getTradingDayKeyAtTimestamp(timestampSec, tz, resetTime);
      nextTradedDays.add(dayKey);

      activePos = {
        ...activePos,
        status: 'OPEN',
        triggeredTime: timestampSec,
        commissionPaid: commAcc,
        spreadCost: spreadCostAcc,
        openFloatingPnl: 0,
        pnl: -commAcc,
      };

      triggeredOrders.push(activePos);

      nextFills.push({
        id: `fill-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        orderId: activePos.id,
        positionId: activePos.id,
        sessionId: session.id,
        symbol: sym,
        side: activePos.side,
        fillType: 'ENTRY',
        price: activePos.entryPrice,
        bidPrice: bidClose,
        askPrice: askClose,
        lotSize: activePos.lotSize,
        timestamp: timestampSec,
        commission: commAcc,
        spreadCost: spreadCostAcc,
        slippageCost: 0,
        realizedPnl: -commAcc,
      });

      nextTradeEvents.push({
        id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        sessionId: session.id,
        positionId: activePos.id,
        symbol: sym,
        timestamp: timestampSec,
        type: 'ORDER_FILLED',
        description: `Pending ${subType.replace('_', ' ')} (${activePos.lotSize.toFixed(
          2
        )} Lot) filled @ ${activePos.entryPrice.toFixed(dec)}.`,
        price: activePos.entryPrice,
        lotSize: activePos.lotSize,
      });
    }

    if (activePos.status !== 'OPEN') return activePos;

    const initialSl = activePos.initialStopLoss ?? activePos.stopLoss;
    const hasDefinedInitialRisk =
      (activePos.initialRiskDollars !== undefined && activePos.initialRiskDollars > 0) ||
      (initialSl > 0 && Math.abs(activePos.entryPrice - initialSl) >= spec.minMove);
    const initialRiskDollars = hasDefinedInitialRisk
      ? activePos.initialRiskDollars && activePos.initialRiskDollars > 0
        ? activePos.initialRiskDollars
        : Math.abs(
            calculatePositionPnl(
              activePos.side,
              activePos.entryPrice,
              initialSl,
              activePos.initialLotSize ?? activePos.lotSize,
              sym,
              session
            )
          )
      : 0;

    // 2. Evaluate LONG Position against BID prices
    if (activePos.side === 'LONG') {
      const hasSL = activePos.stopLoss > 0;
      const hasTP = activePos.takeProfit > 0;
      const touchedSL = hasSL && bidLow <= activePos.stopLoss;
      const touchedTP = hasTP && bidHigh >= activePos.takeProfit;
      const isAmbiguous = touchedSL && touchedTP;

      // Worst-case intrabar floating P&L (at bidLow or stopLoss if capped)
      const effectiveWorstPrice = hasSL ? Math.max(bidLow, activePos.stopLoss) : bidLow;
      const worstFloating = calculatePositionPnl(
        'LONG',
        activePos.entryPrice,
        effectiveWorstPrice,
        activePos.lotSize,
        sym,
        session
      );
      worstIntrabarUnrealizedPnl += worstFloating;

      // Conservative policy: if both SL and TP are touched on the same 1m bar, evaluate SL first and flag as ambiguous
      if (touchedSL) {
        const exitPrice = activePos.stopLoss;
        const closeLegPnl = calculatePositionPnl(
          'LONG',
          activePos.entryPrice,
          exitPrice,
          activePos.lotSize,
          sym,
          session
        );
        nextRealizedPnL = Number((nextRealizedPnL + closeLegPnl).toFixed(2));
        const totalNetPnl = Number(
          ((activePos.bankedPartialPnl ?? 0) + closeLegPnl - (activePos.commissionPaid ?? 0)).toFixed(2)
        );
        const rMult =
          initialRiskDollars > 0
            ? Number((totalNetPnl / initialRiskDollars).toFixed(2))
            : null;
        const ambiguityNote = isAmbiguous
          ? 'Candle touched both SL and TP within the same 1m execution bar; conservative SL-first policy applied.'
          : undefined;

        const closedPos: BacktestPosition = {
          ...activePos,
          status: 'CLOSED_SL',
          exitPrice,
          exitTime: timestampSec,
          openFloatingPnl: 0,
          grossPnl: Number(((activePos.bankedPartialPnl ?? 0) + closeLegPnl).toFixed(2)),
          pnl: totalNetPnl,
          rMultiple: rMult,
          isAmbiguous: isAmbiguous || activePos.isAmbiguous,
          ambiguityNote: ambiguityNote || activePos.ambiguityNote,
        };

        closedTrades.push({ position: closedPos, reason: 'SL', isAmbiguous });
        if (isAmbiguous) {
          nextTradeEvents.push({
            id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            sessionId: session.id,
            positionId: activePos.id,
            symbol: sym,
            timestamp: timestampSec,
            type: 'AMBIGUOUS_CANDLE_FLAGGED',
            description: ambiguityNote!,
            price: exitPrice,
          });
        }
        nextTradeEvents.push({
          id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          sessionId: session.id,
          positionId: activePos.id,
          symbol: sym,
          timestamp: timestampSec,
          type: 'POSITION_CLOSED_SL',
          description: `${
            closeLegPnl > 0
              ? 'Profit-Locked Stop Loss'
              : Math.abs(exitPrice - activePos.entryPrice) <= (spec.minMove || 1e-5) * 0.5
              ? 'Break-Even Stop Loss'
              : 'Stop Loss'
          } triggered @ ${exitPrice.toFixed(dec)} (${formatMoney(
            totalNetPnl,
            currency,
            true
          )}).`,
          price: exitPrice,
          lotSize: activePos.lotSize,
          pnlDelta: closeLegPnl,
        });
        return closedPos;
      }

      if (touchedTP) {
        const exitPrice = activePos.takeProfit;
        const closeLegPnl = calculatePositionPnl(
          'LONG',
          activePos.entryPrice,
          exitPrice,
          activePos.lotSize,
          sym,
          session
        );
        nextRealizedPnL = Number((nextRealizedPnL + closeLegPnl).toFixed(2));
        const totalNetPnl = Number(
          ((activePos.bankedPartialPnl ?? 0) + closeLegPnl - (activePos.commissionPaid ?? 0)).toFixed(2)
        );
        const rMult =
          initialRiskDollars > 0
            ? Number((totalNetPnl / initialRiskDollars).toFixed(2))
            : null;

        const closedPos: BacktestPosition = {
          ...activePos,
          status: 'CLOSED_TP',
          exitPrice,
          exitTime: timestampSec,
          openFloatingPnl: 0,
          grossPnl: Number(((activePos.bankedPartialPnl ?? 0) + closeLegPnl).toFixed(2)),
          pnl: totalNetPnl,
          rMultiple: rMult,
        };

        closedTrades.push({ position: closedPos, reason: 'TP' });
        nextTradeEvents.push({
          id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          sessionId: session.id,
          positionId: activePos.id,
          symbol: sym,
          timestamp: timestampSec,
          type: 'POSITION_CLOSED_TP',
          description: `Take Profit target hit @ ${exitPrice.toFixed(dec)} (${formatMoney(
            totalNetPnl,
            currency,
            true
          )}).`,
          price: exitPrice,
          lotSize: activePos.lotSize,
          pnlDelta: closeLegPnl,
        });
        return closedPos;
      }

      // Mark-to-market open LONG position at bidClose
      const openFloatingPnl = calculatePositionPnl(
        'LONG',
        activePos.entryPrice,
        bidClose,
        activePos.lotSize,
        sym,
        session
      );
      const totalCurrentPnl = Number(
        ((activePos.bankedPartialPnl ?? 0) + openFloatingPnl - (activePos.commissionPaid ?? 0)).toFixed(2)
      );
      const floatingR =
        initialRiskDollars > 0
          ? Number((totalCurrentPnl / initialRiskDollars).toFixed(2))
          : null;

      const shouldAutoBE =
        activePos.autoBreakEvenR &&
        activePos.autoBreakEvenR > 0 &&
        !activePos.isBreakEvenMoved &&
        floatingR !== null &&
        floatingR >= activePos.autoBreakEvenR;

      return {
        ...activePos,
        stopLoss: shouldAutoBE ? activePos.entryPrice : activePos.stopLoss,
        isBreakEvenMoved: shouldAutoBE ? true : activePos.isBreakEvenMoved,
        openFloatingPnl,
        pnl: totalCurrentPnl,
        rMultiple: floatingR,
      };
    } else {
      // 3. Evaluate SHORT Position against ASK prices
      const hasSL = activePos.stopLoss > 0;
      const hasTP = activePos.takeProfit > 0;
      const touchedSL = hasSL && askHigh >= activePos.stopLoss;
      const touchedTP = hasTP && askLow <= activePos.takeProfit;
      const isAmbiguous = touchedSL && touchedTP;

      const effectiveWorstPrice = hasSL ? Math.min(askHigh, activePos.stopLoss) : askHigh;
      const worstFloating = calculatePositionPnl(
        'SHORT',
        activePos.entryPrice,
        effectiveWorstPrice,
        activePos.lotSize,
        sym,
        session
      );
      worstIntrabarUnrealizedPnl += worstFloating;

      if (touchedSL) {
        const exitPrice = activePos.stopLoss;
        const closeLegPnl = calculatePositionPnl(
          'SHORT',
          activePos.entryPrice,
          exitPrice,
          activePos.lotSize,
          sym,
          session
        );
        nextRealizedPnL = Number((nextRealizedPnL + closeLegPnl).toFixed(2));
        const totalNetPnl = Number(
          ((activePos.bankedPartialPnl ?? 0) + closeLegPnl - (activePos.commissionPaid ?? 0)).toFixed(2)
        );
        const rMult =
          initialRiskDollars > 0
            ? Number((totalNetPnl / initialRiskDollars).toFixed(2))
            : null;
        const ambiguityNote = isAmbiguous
          ? 'Candle touched both SL and TP within the same 1m execution bar; conservative SL-first policy applied.'
          : undefined;

        const closedPos: BacktestPosition = {
          ...activePos,
          status: 'CLOSED_SL',
          exitPrice,
          exitTime: timestampSec,
          openFloatingPnl: 0,
          grossPnl: Number(((activePos.bankedPartialPnl ?? 0) + closeLegPnl).toFixed(2)),
          pnl: totalNetPnl,
          rMultiple: rMult,
          isAmbiguous: isAmbiguous || activePos.isAmbiguous,
          ambiguityNote: ambiguityNote || activePos.ambiguityNote,
        };

        closedTrades.push({ position: closedPos, reason: 'SL', isAmbiguous });
        if (isAmbiguous) {
          nextTradeEvents.push({
            id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            sessionId: session.id,
            positionId: activePos.id,
            symbol: sym,
            timestamp: timestampSec,
            type: 'AMBIGUOUS_CANDLE_FLAGGED',
            description: ambiguityNote!,
            price: exitPrice,
          });
        }
        nextTradeEvents.push({
          id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          sessionId: session.id,
          positionId: activePos.id,
          symbol: sym,
          timestamp: timestampSec,
          type: 'POSITION_CLOSED_SL',
          description: `${
            closeLegPnl > 0
              ? 'Profit-Locked Stop Loss'
              : Math.abs(exitPrice - activePos.entryPrice) <= (spec.minMove || 1e-5) * 0.5
              ? 'Break-Even Stop Loss'
              : 'Stop Loss'
          } triggered @ ${exitPrice.toFixed(dec)} (${formatMoney(
            totalNetPnl,
            currency,
            true
          )}).`,
          price: exitPrice,
          lotSize: activePos.lotSize,
          pnlDelta: closeLegPnl,
        });
        return closedPos;
      }

      if (touchedTP) {
        const exitPrice = activePos.takeProfit;
        const closeLegPnl = calculatePositionPnl(
          'SHORT',
          activePos.entryPrice,
          exitPrice,
          activePos.lotSize,
          sym,
          session
        );
        nextRealizedPnL = Number((nextRealizedPnL + closeLegPnl).toFixed(2));
        const totalNetPnl = Number(
          ((activePos.bankedPartialPnl ?? 0) + closeLegPnl - (activePos.commissionPaid ?? 0)).toFixed(2)
        );
        const rMult =
          initialRiskDollars > 0
            ? Number((totalNetPnl / initialRiskDollars).toFixed(2))
            : null;

        const closedPos: BacktestPosition = {
          ...activePos,
          status: 'CLOSED_TP',
          exitPrice,
          exitTime: timestampSec,
          openFloatingPnl: 0,
          grossPnl: Number(((activePos.bankedPartialPnl ?? 0) + closeLegPnl).toFixed(2)),
          pnl: totalNetPnl,
          rMultiple: rMult,
        };

        closedTrades.push({ position: closedPos, reason: 'TP' });
        nextTradeEvents.push({
          id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          sessionId: session.id,
          positionId: activePos.id,
          symbol: sym,
          timestamp: timestampSec,
          type: 'POSITION_CLOSED_TP',
          description: `Take Profit target hit @ ${exitPrice.toFixed(dec)} (${formatMoney(
            totalNetPnl,
            currency,
            true
          )}).`,
          price: exitPrice,
          lotSize: activePos.lotSize,
          pnlDelta: closeLegPnl,
        });
        return closedPos;
      }

      const openFloatingPnl = calculatePositionPnl(
        'SHORT',
        activePos.entryPrice,
        askClose,
        activePos.lotSize,
        sym,
        session
      );
      const totalCurrentPnl = Number(
        ((activePos.bankedPartialPnl ?? 0) + openFloatingPnl - (activePos.commissionPaid ?? 0)).toFixed(2)
      );
      const floatingR =
        initialRiskDollars > 0
          ? Number((totalCurrentPnl / initialRiskDollars).toFixed(2))
          : null;

      const shouldAutoBE =
        activePos.autoBreakEvenR &&
        activePos.autoBreakEvenR > 0 &&
        !activePos.isBreakEvenMoved &&
        floatingR !== null &&
        floatingR >= activePos.autoBreakEvenR;

      return {
        ...activePos,
        stopLoss: shouldAutoBE ? activePos.entryPrice : activePos.stopLoss,
        isBreakEvenMoved: shouldAutoBE ? true : activePos.isBreakEvenMoved,
        openFloatingPnl,
        pnl: totalCurrentPnl,
        rMultiple: floatingR,
      };
    }
  });

  const authoritativeRealizedAfterBar = computeAuthoritativeRealizedPnl({
    ...session,
    positions: updatedPositions,
    realizedPnL: nextRealizedPnL,
  });
  const effectiveStartingBalance =
    session.frozenConfig?.startingBalance ?? session.startingBalance;
  const currentBalanceAfterBar = Number(
    (effectiveStartingBalance + authoritativeRealizedAfterBar).toFixed(2)
  );
  const worstCaseIntrabarEquity = Number(
    (currentBalanceAfterBar + worstIntrabarUnrealizedPnl).toFixed(2)
  );

  let nextSession: TradingSession = {
    ...session,
    replayTimestamp: timestampSec,
    realizedPnL: authoritativeRealizedAfterBar,
    positions: updatedPositions,
    fills: nextFills,
    tradeEvents: nextTradeEvents,
    challengeState: session.challengeState
      ? {
          ...session.challengeState,
          tradedDays: Array.from(nextTradedDays),
        }
      : undefined,
    ...(triggeredOrders.length > 0 || closedTrades.length > 0
      ? { updatedAt: new Date().toISOString() }
      : {}),
  };

  // Evaluate Prop Firm Challenge Rules at this step
  const lastClosedId =
    closedTrades.length > 0 ? closedTrades[closedTrades.length - 1].position.id : undefined;
  const { updatedSession, breachedNow, passedNow } = evaluateChallengeRulesAtStep(
    nextSession,
    timestampSec,
    worstCaseIntrabarEquity,
    lastClosedId
  );
  nextSession = updatedSession;

  return {
    session: nextSession,
    triggeredOrders,
    closedTrades,
    breachedNow,
    passedNow,
  };
}

/**
 * Advances or rewinds the session's authoritative simulated clock (`replayTimestamp`) to `targetTimestamp`.
 * - In `PROP_FIRM` mode, strictly rejects any backward time change (`targetTimestamp < currentTimestamp`).
 * - When advancing forward (`targetTimestamp > currentTimestamp`), steps chronologically through the underlying 1-minute (`1m`)
 *   execution candles so pending orders, SL/TP, and equity-based challenge breaches are evaluated with 1m precision.
 * - When rewinding in `BACKTESTING` mode (`targetTimestamp < currentTimestamp`), restores state from the nearest checkpoint
 *   at or prior to `targetTimestamp` and replays forward to `targetTimestamp`.
 */
export function advanceOrRewindSessionToTimestamp(
  session: TradingSession,
  targetTimestamp: number
): StepEvaluationOutcome & { rewindBlockedReason?: string } {
  if (session.marketMode === 'LIVE_PAPER') return {session, triggeredOrders: [], closedTrades: [], breachedNow: null, passedNow: null, rewindBlockedReason: 'Live paper trading follows provider quotes. Return to Replay to use historical controls.'};
  const currentTs = session.replayTimestamp || session.startTimestamp || targetTimestamp;
  const alignedTarget = Math.floor(targetTimestamp / 60) * 60;

  // Never simulate an open trade through minutes outside the loaded source window.
  if (alignedTarget > currentTs) {
    for (const position of session.positions ?? []) {
      if (position.status !== 'OPEN' && position.status !== 'PENDING') continue;
      const symbol = position.symbol || session.activeAsset || 'XAUUSD';
      if (!hasHistoricalArchive(symbol)) continue;
      const minutes = getHistoricalCandles('1m', symbol) || [];
      if (!minutes.length || currentTs < minutes[0].time || alignedTarget > minutes[minutes.length - 1].time + 60) {
        return {session, triggeredOrders: [], closedTrades: [], breachedNow: null, passedNow: null,
          rewindBlockedReason: 'Original minute data for this whole jump is not loaded. Use shorter replay steps while trades are open.'};
      }
    }
  }


  // Enforce Prop Firm No-Rewind Rule in the engine!
  if (session.mode === 'PROP_FIRM' && alignedTarget < currentTs) {
    return {
      session,
      triggeredOrders: [],
      closedTrades: [],
      breachedNow: null,
      passedNow: null,
      rewindBlockedReason:
        'Rewind and backward date changes are strictly disabled in Prop Firm Challenge mode.',
    };
  }

  // Handle Rewind in Normal Backtesting Mode
  if (alignedTarget < currentTs) {
    const checkpoints = session.replayCheckpoints ?? [];
    // Find latest checkpoint <= alignedTarget
    const validCheckpoints = checkpoints
      .filter((cp) => cp.timestamp <= alignedTarget)
      .sort((a, b) => b.timestamp - a.timestamp);

    let baseSession: TradingSession;
    if (validCheckpoints.length > 0) {
      const cp = validCheckpoints[0];
      baseSession = {
        ...session,
        status: 'ACTIVE',
        replayTimestamp: cp.timestamp,
        realizedPnL: cp.realizedPnL,
        positions: JSON.parse(JSON.stringify(cp.positions)),
        orders: JSON.parse(JSON.stringify(cp.orders)),
        fills: JSON.parse(JSON.stringify(cp.fills)),
        tradeEvents: JSON.parse(JSON.stringify(cp.tradeEvents)),
        equitySnapshots: JSON.parse(JSON.stringify(cp.equitySnapshots)),
        replayCheckpoints: checkpoints.filter((c) => c.timestamp <= alignedTarget),
      };
    } else {
      // Filter positions/orders created on or before alignedTarget and replay from earliest position entry
      const survivingPositions = (session.positions ?? [])
        .filter((p) => p.entryTime <= alignedTarget)
        .map((p) => {
          if (p.exitTime && p.exitTime > alignedTarget) {
            return {
              ...p,
              status:
                p.triggeredTime && p.triggeredTime <= alignedTarget
                  ? ('OPEN' as const)
                  : ('PENDING' as const),
              exitPrice: undefined,
              exitTime: undefined,
            };
          }
          return p;
        });
      const survivingRealized = survivingPositions
        .filter(
          (p) =>
            p.status === 'CLOSED_TP' ||
            p.status === 'CLOSED_SL' ||
            p.status === 'CLOSED_MANUAL'
        )
        .reduce((s, p) => s + p.pnl, 0);

      baseSession = {
        ...session,
        status: 'ACTIVE',
        replayTimestamp: alignedTarget,
        realizedPnL: Number(survivingRealized.toFixed(2)),
        positions: survivingPositions,
        tradeEvents: (session.tradeEvents ?? []).filter((e) => e.timestamp <= alignedTarget),
        fills: (session.fills ?? []).filter((f) => f.timestamp <= alignedTarget),
        equitySnapshots: (session.equitySnapshots ?? []).filter(
          (s) => s.timestamp <= alignedTarget
        ),
        replayCheckpoints: checkpoints.filter((c) => c.timestamp <= alignedTarget),
      };
      return evaluateSessionAt1mTimestamp(baseSession, alignedTarget);
    }

    if (baseSession.replayTimestamp === alignedTarget) {
      return evaluateSessionAt1mTimestamp(baseSession, alignedTarget);
    }
    return advanceOrRewindSessionToTimestamp(baseSession, alignedTarget);
  }

  // Advancing Forward: evaluate 1m steps chronologically
  const allTriggered: BacktestPosition[] = [];
  const allClosed: StepEvaluationOutcome['closedTrades'] = [];
  let workingSession = { ...session };
  let finalBreach: BreachEventRecord | null = null;
  let finalPass: PassedEventRecord | null = null;

  const totalMinutes = Math.floor((alignedTarget - currentTs) / 60);
  // If no open or pending positions exist, we can jump in 15m/60m increments and evaluate final target bar
  const hasActiveOrPending = (workingSession.positions ?? []).some(
    (p) => p.status === 'OPEN' || p.status === 'PENDING'
  );

  const stepMinutes = !hasActiveOrPending && totalMinutes > 60 ? 60 : totalMinutes > 720 ? 5 : 1;

  for (let m = stepMinutes; m <= totalMinutes; m += stepMinutes) {
    const stepTs = currentTs + m * 60;
    const outcome = evaluateSessionAt1mTimestamp(workingSession, stepTs);
    workingSession = outcome.session;
    if (outcome.triggeredOrders.length > 0) allTriggered.push(...outcome.triggeredOrders);
    if (outcome.closedTrades.length > 0) allClosed.push(...outcome.closedTrades);
    if (outcome.breachedNow) {
      finalBreach = outcome.breachedNow;
      break;
    }
    if (outcome.passedNow) {
      finalPass = outcome.passedNow;
      break;
    }
  }

  if (
    !finalBreach &&
    !finalPass &&
    workingSession.replayTimestamp !== alignedTarget
  ) {
    const finalOutcome = evaluateSessionAt1mTimestamp(workingSession, alignedTarget);
    workingSession = finalOutcome.session;
    if (finalOutcome.triggeredOrders.length > 0)
      allTriggered.push(...finalOutcome.triggeredOrders);
    if (finalOutcome.closedTrades.length > 0) allClosed.push(...finalOutcome.closedTrades);
    if (finalOutcome.breachedNow) finalBreach = finalOutcome.breachedNow;
    if (finalOutcome.passedNow) finalPass = finalOutcome.passedNow;
  }

  // Save a periodic replay checkpoint in Normal Backtesting mode (keep up to 40 checkpoints)
  if (workingSession.mode === 'BACKTESTING') {
    const existingCps = workingSession.replayCheckpoints ?? [];
    const lastCpTs =
      existingCps.length > 0 ? existingCps[existingCps.length - 1].timestamp : 0;
    if (
      alignedTarget - lastCpTs >= 900 ||
      allTriggered.length > 0 ||
      allClosed.length > 0
    ) {
      const cp: ReplayCheckpoint = {
        timestamp: workingSession.replayTimestamp || alignedTarget,
        realizedPnL: workingSession.realizedPnL ?? 0,
        positions: JSON.parse(JSON.stringify(workingSession.positions ?? [])),
        orders: JSON.parse(JSON.stringify(workingSession.orders ?? [])),
        fills: JSON.parse(JSON.stringify(workingSession.fills ?? [])),
        tradeEvents: JSON.parse(JSON.stringify(workingSession.tradeEvents ?? [])),
        equitySnapshots: JSON.parse(JSON.stringify(workingSession.equitySnapshots ?? [])),
      };
      workingSession.replayCheckpoints = [...existingCps.slice(-39), cp];
    }
  }

  workingSession = {
    ...workingSession,
    updatedAt: new Date().toISOString(),
  };

  return {
    session: workingSession,
    triggeredOrders: allTriggered,
    closedTrades: allClosed,
    breachedNow: finalBreach,
    passedNow: finalPass,
  };
}

/**
 * Validates and executes a new Market or Pending Order (`MARKET`, `BUY_LIMIT`, `SELL_LIMIT`, `BUY_STOP`, `SELL_STOP`).
 * Prevents duplicate orders and rejects invalid orders with useful messages.
 */
let lastOrderIdempotencyKey = '';
let lastOrderIdempotencyTime = 0;

export interface PlaceOrderInput {
  symbol: InstrumentSymbol;
  side: 'LONG' | 'SHORT';
  orderSubType: OrderSubType;
  lotSize: number;
  entryPrice?: number; // Required for LIMIT / STOP orders
  stopLoss: number; // 0 if no SL
  takeProfit: number; // 0 if no TP
  autoBreakEvenR?: number;
  endTime?: number;
}

export interface PlaceOrderResult {
  ok: boolean;
  error?: string;
  session: TradingSession;
  position?: BacktestPosition;
  breachedNow?: BreachEventRecord | null;
  passedNow?: PassedEventRecord | null;
}

export function validateAndPlaceOrder(
  session: TradingSession,
  input: PlaceOrderInput
): PlaceOrderResult {
  // 1. Check Session Status Lock
  if (session.status === 'FAILED') {
    return {
      ok: false,
      error: `Trading is locked: Challenge failed (${
        session.challengeState?.breachEvent?.ruleLabel || session.failReason || 'Rule Breached'
      }). Start a new attempt to trade.`,
      session,
    };
  }
  if (session.status === 'PASSED') {
    return {
      ok: false,
      error:
        'Trading is locked: Challenge Passed! View your analytics or start a new phase/attempt.',
      session,
    };
  }

  const sym = input.symbol || session.activeAsset || 'XAUUSD';
  const spec = getEffectiveInstrumentSpec(sym, session);
  const dec = spec.decimals;
  const rules = session.frozenConfig?.propFirmRules || session.propFirmRules;
  const opts = session.frozenConfig?.moreOptions || session.moreOptions;
  const currency = session.frozenConfig?.accountCurrency || session.accountCurrency || 'USD';

  // 2. Duplicate Order Prevention (idempotency check within 500ms)
  const idemKey = `${session.id}_${sym}_${input.side}_${input.orderSubType}_${input.lotSize}_${input.stopLoss}_${input.takeProfit}`;
  const nowMs = Date.now();
  if (idemKey === lastOrderIdempotencyKey && nowMs - lastOrderIdempotencyTime < 500) {
    return {
      ok: false,
      error: 'Duplicate order prevented — please wait a moment before submitting an identical order.',
      session,
    };
  }

  // 3. Validate Lot Size against instrument minimum quantity and increment
  const minQty = spec.minQuantity || 0.01;
  const qtyInc = spec.quantityIncrement || 0.01;
  if (!Number.isFinite(input.lotSize) || input.lotSize < minQty - 1e-6) {
    return {
      ok: false,
      error: `Invalid position size (${input.lotSize} lots). Minimum quantity for ${spec.displaySymbol} is ${minQty} lots.`,
      session,
    };
  }
  const rem = Math.abs(Math.round(input.lotSize / qtyInc) * qtyInc - input.lotSize);
  if (rem > 1e-4) {
    return {
      ok: false,
      error: `Invalid quantity increment (${input.lotSize} lots). ${spec.displaySymbol} requires increments of ${qtyInc} lots.`,
      session,
    };
  }
  const normalizedLots = Number((Math.round(input.lotSize / qtyInc) * qtyInc).toFixed(2));

  // 4. Mandatory Stop Loss Check in Prop Firm Mode
  if (session.mode === 'PROP_FIRM' && rules.mandatoryStopLoss) {
    if (!input.stopLoss || input.stopLoss <= 0) {
      return {
        ok: false,
        error:
          'Order rejected: Mandatory Stop Loss is enabled in this Prop Firm Challenge. Please specify a valid Stop Loss price.',
        session,
      };
    }
  }

  // 5. Hedging Rule Check
  if (opts && !opts.allowHedging) {
    const hasOpposite = (session.positions ?? []).some(
      (p) =>
        (p.status === 'OPEN' || p.status === 'PENDING') &&
        (p.symbol || session.activeAsset) === sym &&
        p.side !== input.side
    );
    if (hasOpposite) {
      return {
        ok: false,
        error: `Order rejected: Hedging is disabled in "${session.name}". Close or cancel your opposing ${
          input.side === 'LONG' ? 'SHORT' : 'LONG'
        } position on ${spec.displaySymbol} first.`,
        session,
      };
    }
  }

  // 6. Resolve Current Bid & Ask Price at Session Clock
  const clockTs = session.marketMode === 'LIVE_PAPER' ? Math.floor(Date.now() / 1000) :
    session.replayTimestamp || session.startTimestamp || Math.floor(Date.now() / 1000);
  const candle = getLatest1mCandleAtClock(sym, clockTs, session);
  if(session.marketMode !== 'LIVE_PAPER' && hasHistoricalArchive(sym) && !candle) return {ok:false,error:'No original minute bar at this replay time. Trading is paused across archive gaps.',session};
  if (session.marketMode === 'LIVE_PAPER' && !candle) return {ok: false, error: 'A fresh provider quote is required for this simulated live order. The market may be closed or the feed unavailable.', session};
  const midPrice = candle?.close ?? spec.basePrice;
  const { bid, ask, spread } = getBidAskFromMid(midPrice, sym, session);

  const isMarket = input.orderSubType === 'MARKET';
  const slippagePips = isMarket ? opts?.slippagePips ?? 0 : 0;
  const slippagePrice = slippagePips * spec.pipSize;

  let effectiveEntry: number;
  if (isMarket) {
    effectiveEntry =
      input.side === 'LONG'
        ? Number((ask + slippagePrice).toFixed(dec))
        : Number((bid - slippagePrice).toFixed(dec));
  } else {
    if (!input.entryPrice || input.entryPrice <= 0) {
      return {
        ok: false,
        error: `Please enter a valid target entry price for your ${input.orderSubType.replace(
          '_',
          ' '
        )} order.`,
        session,
      };
    }
    effectiveEntry = Number(input.entryPrice.toFixed(dec));

    // Validate Pending Order Price vs Current Bid/Ask
    if (input.orderSubType === 'BUY_LIMIT' && effectiveEntry >= ask) {
      return {
        ok: false,
        error: `Invalid Buy Limit price (${effectiveEntry.toFixed(
          dec
        )}): Buy Limit must be placed below current Ask price (${ask.toFixed(dec)}).`,
        session,
      };
    }
    if (input.orderSubType === 'BUY_STOP' && effectiveEntry <= ask) {
      return {
        ok: false,
        error: `Invalid Buy Stop price (${effectiveEntry.toFixed(
          dec
        )}): Buy Stop must be placed above current Ask price (${ask.toFixed(dec)}).`,
        session,
      };
    }
    if (input.orderSubType === 'SELL_LIMIT' && effectiveEntry <= bid) {
      return {
        ok: false,
        error: `Invalid Sell Limit price (${effectiveEntry.toFixed(
          dec
        )}): Sell Limit must be placed above current Bid price (${bid.toFixed(dec)}).`,
        session,
      };
    }
    if (input.orderSubType === 'SELL_STOP' && effectiveEntry >= bid) {
      return {
        ok: false,
        error: `Invalid Sell Stop price (${effectiveEntry.toFixed(
          dec
        )}): Sell Stop must be placed below current Bid price (${bid.toFixed(dec)}).`,
        session,
      };
    }
  }

  // 7. Validate Stop Loss & Take Profit Sides relative to Entry Price
  const sl = input.stopLoss > 0 ? Number(input.stopLoss.toFixed(dec)) : 0;
  const tp = input.takeProfit > 0 ? Number(input.takeProfit.toFixed(dec)) : 0;

  if (sl > 0) {
    if (input.side === 'LONG' && sl >= effectiveEntry) {
      return {
        ok: false,
        error: `Invalid Stop Loss (${sl.toFixed(
          dec
        )}): For a LONG order, Stop Loss must be strictly below Entry Price (${effectiveEntry.toFixed(
          dec
        )}).`,
        session,
      };
    }
    if (input.side === 'SHORT' && sl <= effectiveEntry) {
      return {
        ok: false,
        error: `Invalid Stop Loss (${sl.toFixed(
          dec
        )}): For a SHORT order, Stop Loss must be strictly above Entry Price (${effectiveEntry.toFixed(
          dec
        )}).`,
        session,
      };
    }
  }

  if (tp > 0) {
    if (input.side === 'LONG' && tp <= effectiveEntry) {
      return {
        ok: false,
        error: `Invalid Take Profit (${tp.toFixed(
          dec
        )}): For a LONG order, Take Profit must be strictly above Entry Price (${effectiveEntry.toFixed(
          dec
        )}).`,
        session,
      };
    }
    if (input.side === 'SHORT' && tp >= effectiveEntry) {
      return {
        ok: false,
        error: `Invalid Take Profit (${tp.toFixed(
          dec
        )}): For a SHORT order, Take Profit must be strictly below Entry Price (${effectiveEntry.toFixed(
          dec
        )}).`,
        session,
      };
    }
  }

  // 8. Validate Free Margin
  const metrics = computeLiveSessionMetrics(session);
  const leverage = opts?.leverage || 100;
  const requiredMarginUsd =
    (normalizedLots * spec.contractSize * effectiveEntry) / leverage;
  const requiredMarginAcc = convertUsdToAccountCurrency(requiredMarginUsd, currency);
  if (requiredMarginAcc > metrics.freeMargin) {
    return {
      ok: false,
      error: `Insufficient Free Margin: Order requires ${formatMoney(
        requiredMarginAcc,
        currency
      )} margin at 1:${leverage} leverage, but Free Margin is ${formatMoney(
        metrics.freeMargin,
        currency
      )}.`,
      session,
    };
  }

  lastOrderIdempotencyKey = idemKey;
  lastOrderIdempotencyTime = nowMs;

  // 9. Compute Costs, Risk & Reward in Account Currency
  const commPerLotUsd = opts?.commissionPerLotUsd ?? 0;
  const commAcc = convertUsdToAccountCurrency(commPerLotUsd * normalizedLots, currency);
  const spreadCostAcc = convertUsdToAccountCurrency(
    spread * normalizedLots * spec.contractSize,
    currency
  );
  const slippageCostAcc = convertUsdToAccountCurrency(
    slippagePrice * normalizedLots * spec.contractSize,
    currency
  );

  const riskDollars =
    sl > 0
      ? Math.abs(
          calculatePositionPnl(input.side, effectiveEntry, sl, normalizedLots, sym, session)
        )
      : 0;
  const rewardDollars =
    tp > 0
      ? Math.abs(
          calculatePositionPnl(input.side, effectiveEntry, tp, normalizedLots, sym, session)
        )
      : 0;

  // Immediate mark-to-market on Market Order (since Long buys at Ask and marks at Bid, initial floating PnL is -(spread + slippage))
  const immediateFloatingPnl = isMarket
    ? calculatePositionPnl(
        input.side,
        effectiveEntry,
        input.side === 'LONG' ? bid : ask,
        normalizedLots,
        sym,
        session
      )
    : 0;

  const { active } = getActiveSessionsAtTime(clockTs, INITIAL_SESSIONS);
  const sessionLabel = active.map((s) => s.city).join('/') || 'Rollover';
  const posId = `pos-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

  const newPos: BacktestPosition = {
    id: posId,
    sessionId: session.id,
    symbol: sym,
    side: input.side,
    orderType: isMarket ? 'MARKET' : 'PENDING',
    orderSubType: input.orderSubType,
    entryPrice: effectiveEntry,
    entryBidPrice: bid,
    entryAskPrice: ask,
    entryTime: clockTs,
    endTime: input.endTime,
    triggeredTime: isMarket ? clockTs : undefined,
    stopLoss: sl,
    initialStopLoss: sl,
    takeProfit: tp,
    initialTakeProfit: tp,
    lotSize: normalizedLots,
    initialLotSize: normalizedLots,
    sizeOz: normalizedLots * spec.contractSize,
    status: isMarket ? 'OPEN' : 'PENDING',
    openFloatingPnl: isMarket ? immediateFloatingPnl : 0,
    pnl: isMarket ? Number((immediateFloatingPnl - commAcc).toFixed(2)) : 0,
    rMultiple:
      isMarket && riskDollars > 0
        ? Number(((immediateFloatingPnl - commAcc) / riskDollars).toFixed(2))
        : null,
    initialRiskDollars: riskDollars,
    riskDollars,
    rewardDollars,
    sessionAtEntry: sessionLabel,
    commissionPaid: isMarket ? commAcc : 0,
    spreadCost: isMarket ? spreadCostAcc : 0,
    slippageCost: isMarket ? slippageCostAcc : 0,
    autoBreakEvenR: input.autoBreakEvenR ?? 0,
    journalTags: [session.strategyName || sessionLabel],
  };

  const newOrder: OrderRecord = {
    id: `ord-${posId}`,
    sessionId: session.id,
    symbol: sym,
    side: input.side,
    orderType: newPos.orderType,
    orderSubType: input.orderSubType,
    requestedPrice: effectiveEntry,
    stopLoss: sl,
    takeProfit: tp,
    lotSize: normalizedLots,
    status: isMarket ? 'FILLED' : 'PENDING',
    createdAtTimestamp: clockTs,
    filledAtTimestamp: isMarket ? clockTs : undefined,
  };

  const nextFills = [...(session.fills ?? [])];
  if (isMarket) {
    nextFills.push({
      id: `fill-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      orderId: newOrder.id,
      positionId: posId,
      sessionId: session.id,
      symbol: sym,
      side: input.side,
      fillType: 'ENTRY',
      price: effectiveEntry,
      bidPrice: bid,
      askPrice: ask,
      lotSize: normalizedLots,
      timestamp: clockTs,
      commission: commAcc,
      spreadCost: spreadCostAcc,
      slippageCost: slippageCostAcc,
      realizedPnl: -commAcc,
    });
  }

  const nextTradeEvents = [
    ...(session.tradeEvents ?? []),
    {
      id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      sessionId: session.id,
      positionId: posId,
      symbol: sym,
      timestamp: clockTs,
      type: isMarket ? ('ORDER_FILLED' as const) : ('ORDER_PLACED' as const),
      description: isMarket
        ? `Executed Market ${input.side} ${normalizedLots.toFixed(2)} Lot on ${
            spec.displaySymbol
          } @ ${effectiveEntry.toFixed(dec)} (Comm: ${formatMoney(commAcc, currency)}).`
        : `Placed Pending ${input.orderSubType.replace('_', ' ')} ${normalizedLots.toFixed(
            2
          )} Lot on ${spec.displaySymbol} @ ${effectiveEntry.toFixed(dec)}.`,
      price: effectiveEntry,
      lotSize: normalizedLots,
    },
  ];

  const tz = rules.dailyResetTimezone || 'UTC';
  const resetTime = rules.dailyResetTime || '00:00';
  const nextTradedDays = new Set<string>(session.challengeState?.tradedDays ?? []);
  if (isMarket) {
    nextTradedDays.add(getTradingDayKeyAtTimestamp(clockTs, tz, resetTime));
  }

  const nextPositions = [newPos, ...(session.positions ?? [])];
  let nextSession: TradingSession = {
    ...session,
    realizedPnL: computeAuthoritativeRealizedPnl({
      ...session,
      positions: nextPositions,
      realizedPnL: isMarket
        ? Number(((session.realizedPnL ?? 0) - commAcc).toFixed(2))
        : session.realizedPnL ?? 0,
    }),
    positions: nextPositions,
    orders: [newOrder, ...(session.orders ?? [])],
    fills: nextFills,
    tradeEvents: nextTradeEvents,
    challengeState: session.challengeState
      ? {
          ...session.challengeState,
          tradedDays: Array.from(nextTradedDays),
        }
      : undefined,
    updatedAt: new Date().toISOString(),
  };

  const { updatedSession, breachedNow, passedNow } = evaluateChallengeRulesAtStep(
    nextSession,
    clockTs,
    undefined,
    posId
  );

  return {
    ok: true,
    session: updatedSession,
    position: newPos,
    breachedNow,
    passedNow,
  };
}

/**
 * Updates Stop Loss, Take Profit, or Pending Entry Price / Lot Size on an existing Open or Pending position.
 */
export function modifyPositionOrOrder(
  session: TradingSession,
  positionId: string,
  updates: {
    newStopLoss?: number;
    newTakeProfit?: number;
    newEntryPrice?: number;
    newLotSize?: number;
    newEndTime?: number;
  }
): { ok: boolean; error?: string; session: TradingSession } {
  const target = (session.positions ?? []).find((p) => p.id === positionId);
  if (!target) {
    return { ok: false, error: 'Position or order not found.', session };
  }
  if (target.status !== 'OPEN' && target.status !== 'PENDING') {
    return { ok: false, error: 'Cannot modify a closed or cancelled trade.', session };
  }

  const sym = target.symbol || session.activeAsset || 'XAUUSD';
  const spec = getEffectiveInstrumentSpec(sym, session);
  const dec = spec.decimals;
  const rules = session.frozenConfig?.propFirmRules || session.propFirmRules;
  const clockTs = session.marketMode === 'LIVE_PAPER' ? Math.floor(Date.now() / 1000) :
    session.replayTimestamp || session.startTimestamp || Math.floor(Date.now() / 1000);
  const candle = getLatest1mCandleAtClock(sym, clockTs, session);
  if (session.marketMode === 'LIVE_PAPER' && !candle) return {ok: false, error: 'Wait for a fresh provider quote before modifying this live paper order.', session};
  if (session.marketMode !== 'LIVE_PAPER' && hasHistoricalArchive(sym) && !candle) return {ok: false, error: 'No original minute bar at this replay time. Modification is paused across archive gaps.', session};
  const { bid, ask } = getBidAskFromMid(candle?.close ?? target.entryPrice, sym, session);

  const entry =
    target.status === 'PENDING' && updates.newEntryPrice !== undefined
      ? Number(updates.newEntryPrice.toFixed(dec))
      : target.entryPrice;
  const sl =
    updates.newStopLoss !== undefined
      ? updates.newStopLoss > 0
        ? Number(updates.newStopLoss.toFixed(dec))
        : 0
      : target.stopLoss;
  const tp =
    updates.newTakeProfit !== undefined
      ? updates.newTakeProfit > 0
        ? Number(updates.newTakeProfit.toFixed(dec))
        : 0
      : target.takeProfit;
  const lotSize =
    target.status === 'PENDING' && updates.newLotSize !== undefined
      ? Math.max(spec.minQuantity || 0.01, Number(updates.newLotSize.toFixed(2)))
      : target.lotSize;

  if (session.mode === 'PROP_FIRM' && rules.mandatoryStopLoss && sl <= 0) {
    return {
      ok: false,
      error: 'Mandatory Stop Loss rule is active: Stop Loss cannot be removed.',
      session,
    };
  }

  if (sl > 0) {
    if (target.status === 'PENDING') {
      if (target.side === 'LONG' && sl >= entry) {
        return {
          ok: false,
          error: `Invalid Stop Loss (${sl.toFixed(dec)}): Must be below Entry (${entry.toFixed(
            dec
          )}) for pending LONG order.`,
          session,
        };
      }
      if (target.side === 'SHORT' && sl <= entry) {
        return {
          ok: false,
          error: `Invalid Stop Loss (${sl.toFixed(dec)}): Must be above Entry (${entry.toFixed(
            dec
          )}) for pending SHORT order.`,
          session,
        };
      }
    } else {
      // OPEN position: allow Stop Loss at Break-Even (entry) or into profit up to current market price (Bid for LONG, Ask for SHORT)
      const maxLongSl = Math.max(entry, bid);
      const minShortSl = Math.min(entry, ask);
      if (target.side === 'LONG' && sl > maxLongSl) {
        return {
          ok: false,
          error: `Invalid Stop Loss (${sl.toFixed(dec)}): Cannot be set above current Bid (${bid.toFixed(
            dec
          )}) for an open LONG trade.`,
          session,
        };
      }
      if (target.side === 'SHORT' && sl < minShortSl) {
        return {
          ok: false,
          error: `Invalid Stop Loss (${sl.toFixed(dec)}): Cannot be set below current Ask (${ask.toFixed(
            dec
          )}) for an open SHORT trade.`,
          session,
        };
      }
      if (tp > 0) {
        if (target.side === 'LONG' && sl >= tp) {
          return {
            ok: false,
            error: `Invalid Stop Loss (${sl.toFixed(dec)}): Must be below Take Profit (${tp.toFixed(
              dec
            )}) for LONG.`,
            session,
          };
        }
        if (target.side === 'SHORT' && sl <= tp) {
          return {
            ok: false,
            error: `Invalid Stop Loss (${sl.toFixed(dec)}): Must be above Take Profit (${tp.toFixed(
              dec
            )}) for SHORT.`,
            session,
          };
        }
      }
    }
  }

  if (tp > 0) {
    if (target.side === 'LONG' && tp <= entry) {
      return {
        ok: false,
        error: `Invalid Take Profit (${tp.toFixed(dec)}): Must be above Entry (${entry.toFixed(
          dec
        )}) for LONG.`,
        session,
      };
    }
    if (target.side === 'SHORT' && tp >= entry) {
      return {
        ok: false,
        error: `Invalid Take Profit (${tp.toFixed(dec)}): Must be below Entry (${entry.toFixed(
          dec
        )}) for SHORT.`,
        session,
      };
    }
  }

  if (target.status === 'PENDING' && updates.newEntryPrice !== undefined) {
    const subType = target.orderSubType || (target.side === 'LONG' ? 'BUY_LIMIT' : 'SELL_LIMIT');
    if (subType === 'BUY_LIMIT' && entry >= ask) {
      return {
        ok: false,
        error: `Buy Limit entry (${entry.toFixed(dec)}) must be below current Ask (${ask.toFixed(
          dec
        )}).`,
        session,
      };
    }
    if (subType === 'BUY_STOP' && entry <= ask) {
      return {
        ok: false,
        error: `Buy Stop entry (${entry.toFixed(dec)}) must be above current Ask (${ask.toFixed(
          dec
        )}).`,
        session,
      };
    }
    if (subType === 'SELL_LIMIT' && entry <= bid) {
      return {
        ok: false,
        error: `Sell Limit entry (${entry.toFixed(dec)}) must be above current Bid (${bid.toFixed(
          dec
        )}).`,
        session,
      };
    }
    if (subType === 'SELL_STOP' && entry >= bid) {
      return {
        ok: false,
        error: `Sell Stop entry (${entry.toFixed(dec)}) must be below current Bid (${bid.toFixed(
          dec
        )}).`,
        session,
      };
    }
  }

  const signedSlPnl =
    sl > 0
      ? calculatePositionPnl(target.side, entry, sl, lotSize, sym, session)
      : 0;
  const riskDollars =
    sl > 0
      ? signedSlPnl < 0
        ? Math.abs(signedSlPnl)
        : 0
      : 0;
  const rewardDollars =
    tp > 0
      ? Math.abs(calculatePositionPnl(target.side, entry, tp, lotSize, sym, session))
      : 0;

  const initialRiskDollars =
    target.initialRiskDollars && target.initialRiskDollars > 0
      ? target.initialRiskDollars
      : riskDollars;

  const openFloatingPnl =
    target.status === 'OPEN'
      ? calculatePositionPnl(
          target.side,
          entry,
          target.side === 'LONG' ? bid : ask,
          lotSize,
          sym,
          session
        )
      : 0;
  const totalPnl =
    target.status === 'OPEN'
      ? Number(
          ((target.bankedPartialPnl ?? 0) + openFloatingPnl - (target.commissionPaid ?? 0)).toFixed(
            2
          )
        )
      : 0;
  const rMultiple =
    target.status === 'OPEN' && initialRiskDollars > 0
      ? Number((totalPnl / initialRiskDollars).toFixed(2))
      : null;

  const nextPositions = (session.positions ?? []).map((p) =>
    p.id === positionId
      ? {
          ...p,
          entryPrice: entry,
          stopLoss: sl,
          initialStopLoss: p.initialStopLoss && p.initialStopLoss > 0 ? p.initialStopLoss : sl,
          isBreakEvenMoved:
            target.status === 'OPEN' && sl > 0 && signedSlPnl >= 0
              ? true
              : p.isBreakEvenMoved,
          takeProfit: tp,
          lotSize,
          sizeOz: lotSize * spec.contractSize,
          endTime: updates.newEndTime !== undefined ? updates.newEndTime : p.endTime,
          initialRiskDollars,
          riskDollars,
          rewardDollars,
          openFloatingPnl,
          pnl: totalPnl,
          rMultiple,
        }
      : p
  );

  const nextTradeEvents: TradeEventRecord[] = [
    ...(session.tradeEvents ?? []),
    {
      id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      sessionId: session.id,
      positionId,
      symbol: sym,
      timestamp: clockTs,
      type: target.status === 'PENDING' ? 'ORDER_EDITED' : 'SL_TP_MODIFIED',
      description: `Updated ${target.side} ${
        target.status === 'PENDING' ? 'pending order' : 'position'
      }: Entry ${entry.toFixed(dec)}, SL ${sl > 0 ? sl.toFixed(dec) : 'None'}, TP ${
        tp > 0 ? tp.toFixed(dec) : 'None'
      }.`,
      price: entry,
      lotSize,
    },
  ];

  return {
    ok: true,
    session: {
      ...session,
      positions: nextPositions,
      tradeEvents: nextTradeEvents,
      updatedAt: new Date().toISOString(),
    },
  };
}

/**
 * Closes an open position (full or partial) or cancels a pending order at the current simulated Bid/Ask price.
 */
export function closeOrCancelPosition(
  session: TradingSession,
  positionId: string,
  fraction = 1.0
): {
  ok: boolean;
  error?: string;
  session: TradingSession;
  closedPnlDelta: number;
  breachedNow?: BreachEventRecord | null;
  passedNow?: PassedEventRecord | null;
} {
  const target = (session.positions ?? []).find((p) => p.id === positionId);
  if (!target) {
    return { ok: false, error: 'Position not found.', session, closedPnlDelta: 0 };
  }

  const sym = target.symbol || session.activeAsset || 'XAUUSD';
  const spec = getEffectiveInstrumentSpec(sym, session);
  const dec = spec.decimals;
  const clockTs = session.marketMode === 'LIVE_PAPER' ? Math.floor(Date.now() / 1000) :
    session.replayTimestamp || session.startTimestamp || Math.floor(Date.now() / 1000);
  const candle = getLatest1mCandleAtClock(sym, clockTs, session);
  if (session.marketMode === 'LIVE_PAPER' && !candle && target.status !== 'PENDING') return {ok: false, error: 'Wait for a fresh provider quote before closing this live paper position.', session, closedPnlDelta: 0};
  if (session.marketMode !== 'LIVE_PAPER' && hasHistoricalArchive(sym) && !candle && target.status !== 'PENDING') return {ok: false, error: 'No original minute bar at this replay time. Closing is paused across archive gaps.', session, closedPnlDelta: 0};
  const { bid, ask } = getBidAskFromMid(candle?.close ?? target.entryPrice, sym, session);
  const currency = session.frozenConfig?.accountCurrency || session.accountCurrency || 'USD';

  // Cancel Pending Order
  if (target.status === 'PENDING') {
    const nextPositions = (session.positions ?? []).filter((p) => p.id !== positionId);
    const nextOrders = (session.orders ?? []).map((o) =>
      o.id === `ord-${positionId}`
        ? { ...o, status: 'CANCELLED' as const, cancelledAtTimestamp: clockTs }
        : o
    );
    const nextTradeEvents: TradeEventRecord[] = [
      ...(session.tradeEvents ?? []),
      {
        id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        sessionId: session.id,
        positionId,
        symbol: sym,
        timestamp: clockTs,
        type: 'ORDER_CANCELLED',
        description: `Cancelled Pending ${target.orderSubType || target.side} order @ ${target.entryPrice.toFixed(
          dec
        )}.`,
        price: target.entryPrice,
        lotSize: target.lotSize,
      },
    ];
    return {
      ok: true,
      session: {
        ...session,
        positions: nextPositions,
        orders: nextOrders,
        tradeEvents: nextTradeEvents,
        updatedAt: new Date().toISOString(),
      },
      closedPnlDelta: 0,
    };
  }

  if (target.status !== 'OPEN') {
    return { ok: false, error: 'Position is already closed.', session, closedPnlDelta: 0 };
  }

  const exitPrice = target.side === 'LONG' ? bid : ask;
  const minQty = spec.minQuantity || 0.01;
  const qtyInc = spec.quantityIncrement || 0.01;

  // Partial Close
  if (fraction < 0.999 && target.lotSize >= minQty * 2) {
    const rawClosedLot = Math.max(minQty, target.lotSize * fraction);
    const closedLot = Math.min(
      Number((target.lotSize - minQty).toFixed(2)),
      Number((Math.round(rawClosedLot / qtyInc) * qtyInc).toFixed(2))
    );
    const remainingLot = Number((target.lotSize - closedLot).toFixed(2));

    const partialPnl = calculatePositionPnl(
      target.side,
      target.entryPrice,
      exitPrice,
      closedLot,
      sym,
      session
    );
    const remainingFloatingPnl = calculatePositionPnl(
      target.side,
      target.entryPrice,
      exitPrice,
      remainingLot,
      sym,
      session
    );
    const newBankedPartial = Number(((target.bankedPartialPnl ?? 0) + partialPnl).toFixed(2));
    const totalPnl = Number(
      (newBankedPartial + remainingFloatingPnl - (target.commissionPaid ?? 0)).toFixed(2)
    );
    const initialRisk = target.initialRiskDollars ?? target.riskDollars ?? 0;
    const rMult = initialRisk > 0 ? Number((totalPnl / initialRisk).toFixed(2)) : null;

    const nextPositions = (session.positions ?? []).map((p) =>
      p.id === positionId
        ? {
            ...p,
            lotSize: remainingLot,
            sizeOz: remainingLot * spec.contractSize,
            openFloatingPnl: remainingFloatingPnl,
            pnl: totalPnl,
            rMultiple: rMult,
            partialsCount: (p.partialsCount ?? 0) + 1,
            bankedPartialPnl: newBankedPartial,
          }
        : p
    );

    const nextFills: FillRecord[] = [
      ...(session.fills ?? []),
      {
        id: `fill-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        orderId: `ord-${positionId}`,
        positionId,
        sessionId: session.id,
        symbol: sym,
        side: target.side,
        fillType: 'PARTIAL_EXIT',
        price: exitPrice,
        bidPrice: bid,
        askPrice: ask,
        lotSize: closedLot,
        timestamp: clockTs,
        commission: 0,
        spreadCost: 0,
        slippageCost: 0,
        realizedPnl: partialPnl,
      },
    ];

    const nextTradeEvents: TradeEventRecord[] = [
      ...(session.tradeEvents ?? []),
      {
        id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        sessionId: session.id,
        positionId,
        symbol: sym,
        timestamp: clockTs,
        type: 'PARTIAL_CLOSED',
        description: `Closed ${Math.round(fraction * 100)}% partial (${closedLot.toFixed(
          2
        )} Lot) @ ${exitPrice.toFixed(dec)} for ${formatMoney(
          partialPnl,
          currency,
          true
        )} (${remainingLot.toFixed(2)} Lot remaining).`,
        price: exitPrice,
        lotSize: closedLot,
        pnlDelta: partialPnl,
      },
    ];

    const nextSession: TradingSession = {
      ...session,
      realizedPnL: computeAuthoritativeRealizedPnl({
        ...session,
        positions: nextPositions,
        realizedPnL: Number(((session.realizedPnL ?? 0) + partialPnl).toFixed(2)),
      }),
      positions: nextPositions,
      fills: nextFills,
      tradeEvents: nextTradeEvents,
      updatedAt: new Date().toISOString(),
    };

    const { updatedSession, breachedNow, passedNow } = evaluateChallengeRulesAtStep(
      nextSession,
      clockTs,
      undefined,
      positionId
    );

    return {
      ok: true,
      session: updatedSession,
      closedPnlDelta: partialPnl,
      breachedNow,
      passedNow,
    };
  }

  // Full Close
  const closeLegPnl = calculatePositionPnl(
    target.side,
    target.entryPrice,
    exitPrice,
    target.lotSize,
    sym,
    session
  );
  const totalNetPnl = Number(
    ((target.bankedPartialPnl ?? 0) + closeLegPnl - (target.commissionPaid ?? 0)).toFixed(2)
  );
  const initialRisk = target.initialRiskDollars ?? target.riskDollars ?? 0;
  const rMult = initialRisk > 0 ? Number((totalNetPnl / initialRisk).toFixed(2)) : null;

  const nextPositions = (session.positions ?? []).map((p) =>
    p.id === positionId
      ? {
          ...p,
          status: 'CLOSED_MANUAL' as const,
          exitPrice,
          exitTime: clockTs,
          openFloatingPnl: 0,
          grossPnl: Number(((p.bankedPartialPnl ?? 0) + closeLegPnl).toFixed(2)),
          pnl: totalNetPnl,
          rMultiple: rMult,
        }
      : p
  );

  const nextFills: FillRecord[] = [
    ...(session.fills ?? []),
    {
      id: `fill-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      orderId: `ord-${positionId}`,
      positionId,
      sessionId: session.id,
      symbol: sym,
      side: target.side,
      fillType: 'FULL_EXIT_MANUAL',
      price: exitPrice,
      bidPrice: bid,
      askPrice: ask,
      lotSize: target.lotSize,
      timestamp: clockTs,
      commission: 0,
      spreadCost: 0,
      slippageCost: 0,
      realizedPnl: closeLegPnl,
    },
  ];

  const nextTradeEvents: TradeEventRecord[] = [
    ...(session.tradeEvents ?? []),
    {
      id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      sessionId: session.id,
      positionId,
      symbol: sym,
      timestamp: clockTs,
      type: 'POSITION_CLOSED_MANUAL',
      description: `Closed ${target.side} ${target.lotSize.toFixed(
        2
      )} Lot @ ${exitPrice.toFixed(dec)} (${formatMoney(totalNetPnl, currency, true)}).`,
      price: exitPrice,
      lotSize: target.lotSize,
      pnlDelta: closeLegPnl,
    },
  ];

  const nextSession: TradingSession = {
    ...session,
    realizedPnL: computeAuthoritativeRealizedPnl({
      ...session,
      positions: nextPositions,
      realizedPnL: Number(((session.realizedPnL ?? 0) + closeLegPnl).toFixed(2)),
    }),
    positions: nextPositions,
    fills: nextFills,
    tradeEvents: nextTradeEvents,
    updatedAt: new Date().toISOString(),
  };

  const { updatedSession, breachedNow, passedNow } = evaluateChallengeRulesAtStep(
    nextSession,
    clockTs,
    undefined,
    positionId
  );

  return {
    ok: true,
    session: updatedSession,
    closedPnlDelta: totalNetPnl,
    breachedNow,
    passedNow,
  };
}

/**
 * Starts a New Challenge Attempt on a Prop Firm Challenge session while preserving all previous attempt results and frozen rules.
 * Optionally allows the user to choose whether to redo Phase 1 or Phase 2.
 */
export function startNewChallengeAttempt(
  session: TradingSession,
  targetPhase?: 'PHASE_1' | 'PHASE_2' | 'FUNDED'
): TradingSession {
  const currentAttemptNum = session.attemptNumber || 1;
  const metrics = computeLiveSessionMetrics(session);
  const closedTrades = (session.positions ?? []).filter(
    (p) =>
      p.status === 'CLOSED_TP' ||
      p.status === 'CLOSED_SL' ||
      p.status === 'CLOSED_MANUAL' ||
      p.status === 'CLOSED_BREACH'
  );
  const wins = closedTrades.filter((t) => t.pnl > 0);
  const winRatePct =
    closedTrades.length > 0 ? Number(((wins.length / closedTrades.length) * 100).toFixed(1)) : 0;

  const frozen = session.frozenConfig;
  const baseRules = frozen?.propFirmRules || session.propFirmRules;
  const prevPhase = baseRules.challengePhase || 'PHASE_1';

  const archivedAttempt: ChallengeAttemptSummary = {
    attemptNumber: currentAttemptNum,
    sessionId: session.id,
    phaseId: prevPhase,
    startedAt: session.createdAt,
    endedAt: new Date().toISOString(),
    status:
      session.status === 'PASSED'
        ? 'PASSED'
        : session.status === 'FAILED'
        ? 'FAILED'
        : 'ABANDONED',
    finalBalance: metrics.currentBalance,
    finalEquity: metrics.currentEquity,
    netPnl: metrics.netPnl,
    returnPct: metrics.returnPct,
    tradesCount: closedTrades.length,
    winRatePct,
    tradingDaysCompleted: metrics.tradingDaysCompleted,
    breachEvent: session.challengeState?.breachEvent,
    passedEvent: session.challengeState?.passedEvent,
    positionsSnapshot: JSON.parse(JSON.stringify(session.positions ?? [])),
  };

  const startDate = frozen?.startDate || session.startDate;
  const replayStartTime = frozen?.replayStartTime || session.replayStartTime || '08:00';
  const startTs =
    session.startTimestamp ||
    Math.floor(Date.parse(`${startDate}T${replayStartTime}:00Z`) / 1000);
  const startingBalance = frozen?.startingBalance || session.startingBalance;

  const nextPhase = targetPhase || prevPhase;
  const storedP1Target =
    baseRules.phase1ProfitTargetPct ??
    (prevPhase === 'PHASE_1'
      ? baseRules.profitTargetPct
      : Math.min(20, Number((baseRules.profitTargetPct * 2).toFixed(1))));
  const storedP2Target =
    baseRules.phase2ProfitTargetPct ??
    (prevPhase === 'PHASE_2'
      ? baseRules.profitTargetPct
      : Math.max(1, Number((storedP1Target * 0.5).toFixed(1))));

  const nextProfitTargetPct =
    nextPhase === 'PHASE_1'
      ? storedP1Target
      : nextPhase === 'PHASE_2'
      ? storedP2Target
      : baseRules.profitTargetPct;

  const nextRules: PropFirmRules = {
    ...baseRules,
    challengePhase: nextPhase,
    phase1ProfitTargetPct: storedP1Target,
    phase2ProfitTargetPct: storedP2Target,
    profitTargetPct: nextProfitTargetPct,
  };

  let nextName = session.name;
  if (nextPhase === 'PHASE_1' && nextName.includes('Phase 2')) {
    nextName = nextName.replace('Phase 2', 'Phase 1');
  } else if (nextPhase === 'PHASE_2' && nextName.includes('Phase 1')) {
    nextName = nextName.replace('Phase 1', 'Phase 2');
  }

  return {
    ...session,
    name: nextName,
    status: 'ACTIVE',
    failReason: undefined,
    passedAt: undefined,
    attemptNumber: currentAttemptNum + 1,
    previousAttempts: [archivedAttempt, ...(session.previousAttempts ?? [])],
    replayTimestamp: startTs,
    realizedPnL: 0,
    positions: [],
    orders: [],
    fills: [],
    tradeEvents: [],
    equitySnapshots: [],
    replayCheckpoints: [],
    propFirmRules: nextRules,
    frozenConfig: frozen
      ? {
          ...frozen,
          propFirmRules: nextRules,
        }
      : frozen,
    challengeState: createInitialChallengeState(startingBalance, startTs, nextRules),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Creates a separate Practice Branch session from an existing session at its current replay clock & state.
 */
export function createPracticeBranchSession(session: TradingSession): TradingSession {
  const copy: TradingSession = JSON.parse(JSON.stringify(session));
  const baseName = session.name.replace(/\s*\(Branch @ [^)]+\)/g, '').trim();
  copy.id = `session-branch-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  copy.name = `${baseName} (Branch @ ${formatTimestampInTimezone(
    session.replayTimestamp || Math.floor(Date.now() / 1000),
    session.displayTimezone || 'UTC'
  )})`;
  copy.mode = 'BACKTESTING';
  copy.status = 'ACTIVE';
  copy.createdAt = new Date().toISOString();
  copy.updatedAt = new Date().toISOString();
  return copy;
}
