import {Candle, InstrumentSymbol, Timeframe} from '../types/trading';

export interface SpotQuote { price: number; time: number; receivedAt: number; source: string; maxAgeSeconds: number; marketState: string; }
const quotes = new Map<InstrumentSymbol, SpotQuote>();
export function getSpotQuote(symbol: InstrumentSymbol): SpotQuote | undefined { return quotes.get(symbol); }
export function setBrokerQuote(symbol:InstrumentSymbol, quote:SpotQuote):void { quotes.set(symbol,quote); }
export function clearSpotQuotes(): void { quotes.clear(); }
export const SPOT_SYMBOLS = new Set<InstrumentSymbol>(['EURUSD','GBPUSD','USDJPY','USDCHF','AUDUSD','USDCAD','NZDUSD','GBPJPY','EURJPY','EURGBP','AUDJPY','EURAUD','GBPAUD','CADJPY','XAUUSD','XAGUSD']);
export function spotInterval(timeframe: Timeframe): string { return ({'1H':'1h','4H':'4h','1D':'1d','1W':'1d','1M':'1d'} as Partial<Record<Timeframe,string>>)[timeframe] || timeframe; }

// Reject invalid source OHLC instead of drawing repaired or manufactured wicks.
export function parseSpotBars(rows: unknown, now = Date.now()): Candle[] {
  if (!Array.isArray(rows)) return [];
  const byTime = new Map<number,Candle>();
  for (const row of rows) {
    if (typeof row?.openTime !== 'string' || !row.openTime.endsWith('Z')) continue;
    const time = Date.parse(row.openTime) / 1000;
    const {open,high,low,close} = row;
    if (!Number.isFinite(time) || time * 1000 > now + 60000 || ![open,high,low,close].every(v=>typeof v === 'number' && Number.isFinite(v) && v > 0) || high < Math.max(open,close) || low > Math.min(open,close)) continue;
    const rawVolume = Number(row.volume) > 0 ? Number(row.volume) : Number(row.tickVolume);
    const volume = Number.isFinite(rawVolume) && rawVolume >= 0 ? rawVolume : 0;
    byTime.set(time, {time,open,high,low,close,volume});
  }
  return [...byTime.values()].sort((a,b)=>a.time-b.time);
}

export async function fetchSpotCandles(symbol: InstrumentSymbol, timeframe: Timeframe, limit: number): Promise<Candle[] | null> {
  const interval = spotInterval(timeframe);
  try {
    let data: any;
    const isBrowser = typeof window !== 'undefined' && typeof window.document !== 'undefined';
    const opts = {signal: AbortSignal.timeout(9000)};
    if (isBrowser) {
      const response = await fetch(`/api/spot-candles?symbol=${symbol}&interval=${interval}&limit=${Math.min(1000,limit)}`, opts);
      if (!response.ok) return null;
      data = await response.json();
    } else {
      const [series, quote] = await Promise.all([
        fetch(`https://biquote.io/api/${symbol}/ohlc?interval=${interval}&limit=${Math.min(1000,limit)}`,opts),
        fetch(`https://biquote.io/api/${symbol}`,opts),
      ]);
      if (!series.ok || !quote.ok) return null;
      data = {...await series.json(), quote: await quote.json()};
    }
    if (data.symbol !== symbol || data.interval !== interval || data.quote?.symbol !== symbol) return null;
    const rawQuote = data.quote;
    const time = Date.parse(rawQuote.timestamp) / 1000;
    const now = Date.now() / 1000;
    const price = (Number(rawQuote.bid) + Number(rawQuote.ask)) / 2;
    if (!Number.isFinite(time) || time > now + 5 || !Number.isFinite(price) || price <= 0 || Number(rawQuote.bid) <= 0 || Number(rawQuote.ask) < Number(rawQuote.bid)) return null;
    const bars = parseSpotBars(data.bars);
    if (!bars.length) return null;
    // Never label an old quote as live. Keep the prior series intact on an outage.
    if (rawQuote.marketState !== 'closed' && (now - time > 60 || rawQuote.stale === true)) return null;
    if (!quotes.get(symbol) || time >= quotes.get(symbol)!.time) quotes.set(symbol,{price,time,receivedAt:now,source:'biquote · MT5 broker spot (provisional)',maxAgeSeconds:60,marketState:rawQuote.marketState || 'unknown'});
    return bars;
  } catch { return null; }
}

export function getSpotFeedStatus(symbol: InstrumentSymbol, now = Date.now() / 1000): string {
  const quote = quotes.get(symbol);
  if (!quote) return 'Connecting to spot feed';
  const age = Math.max(0,Math.floor(now-quote.time));
  if (quote.marketState === 'closed') return `Market closed · last quote ${age}s ago`;
  return age > 60 ? `STALE · quote ${age}s ago · paper orders paused` : `Quote ${age}s ago · refresh 5s · tick volume`;
}
