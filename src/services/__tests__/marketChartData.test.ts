import {beforeEach, describe, expect, it, vi, afterEach} from 'vitest';
import {clearRealCandleCache, setCachedRealCandles, getProviderChartCandles, fetchRealYahooInstrumentCandles, refreshMarketCandles, getCachedRealCandles, INSTRUMENTS, TIMEFRAME_CONFIG, sanitizeAndValidateCandles} from '../goldDataService';
import {Candle, Timeframe} from '../../types/trading';
const t = Date.parse('2026-10-22T08:00:00Z') / 1000;
const bar = (time: number, open = 1.1): Candle => ({time, open, high: open+.002, low: open-.001, close: open+.001, volume: 12});
beforeEach(() => clearRealCandleCache());
afterEach(() => vi.unstubAllGlobals());
describe('Visible provider candles', () => {
 it('does not present a quote-only feed as full OHLC candles', () => {
  const quotes=Array.from({length:120},(_,i)=>({time:t+i*60,open:1.1,high:1.1,low:1.1,close:1.1,volume:0}));
  setCachedRealCandles('1m','NZDUSD',quotes);
  expect(getProviderChartCandles('NZDUSD','1m',t+7200,true)).toEqual([]);
 });
 it('preserves an isolated genuine doji alongside normal candles', () => {
  const source=[bar(t),{time:t+60,open:1.1,high:1.1,low:1.1,close:1.1,volume:0}];
  setCachedRealCandles('1m','EURUSD',source);
  expect(getProviderChartCandles('EURUSD','1m',t+120,true)).toEqual(source);
 });
 it('never substitutes generated data when the date or timeframe is unavailable', () => {
  expect(getProviderChartCandles('EURUSD','1m',t)).toEqual([]);
  setCachedRealCandles('1m','EURUSD',[bar(t)]);
  expect(getProviderChartCandles('EURUSD','1m',t-60)).toEqual([]);
  expect(getProviderChartCandles('EURUSD','5m',t)).toEqual([]);
 });
 it('preserves genuine one-minute and five-minute OHLC in current-market view', () => {
  for (const tf of ['1m','5m'] as Timeframe[]) {
   const source=[bar(t),bar(t+TIMEFRAME_CONFIG[tf].seconds,1.12)];
   setCachedRealCandles(tf,'EURUSD',source);
   expect(getProviderChartCandles('EURUSD',tf,t+400,true)).toEqual(source);
  }
 });
 it('does not leak the current five-minute bar or a future one-minute wick into replay', () => {
  setCachedRealCandles('5m','EURUSD',[bar(t-300), {...bar(t),high:9}]);
  setCachedRealCandles('1m','EURUSD',[bar(t),bar(t+60,1.11),{...bar(t+120),high:8}]);
  const bars=getProviderChartCandles('EURUSD','5m',t+120);
  expect(bars).toHaveLength(2);
  expect(bars[1]).toEqual({time:t,open:1.1,high:1.112,low:1.099,close:1.111,volume:24});
 });
 it('does not expose future one-minute close at the opening instant', () => {
  setCachedRealCandles('1m','EURUSD',[bar(t)]);
  expect(getProviderChartCandles('EURUSD','1m',t)[0]).toEqual({time:t,open:1.1,high:1.1,low:1.1,close:1.1,volume:0});
 });
 it('keeps all instrument prices and UTC bucket spacing independent', () => {
  for (const instrument of INSTRUMENTS) {
   for (const tf of ['1m','5m'] as Timeframe[]) {
    const step=TIMEFRAME_CONFIG[tf].seconds;
    const source=sanitizeAndValidateCandles([bar(t,instrument.basePrice),bar(t+step,instrument.basePrice)],tf,instrument.symbol);
    setCachedRealCandles(tf,instrument.symbol,source);
    const actual=getProviderChartCandles(instrument.symbol,tf,t+2*step,true);
    expect(actual).toEqual(source);
    expect(actual[1].time-actual[0].time).toBe(step);
   }
  }
 });
 it('requests matching native spot intervals for one-minute and five-minute FX', async () => {
  const fetchMock=vi.fn(async (url: string) => ({ok:true,json:async()=>url.includes('/ohlc?')
    ? {symbol:'EURUSD',interval:url.includes('interval=5m')?'5m':'1m',bars:Array.from({length:12},(_,i)=>({openTime:new Date((t+i*60)*1000).toISOString(),open:1.1,high:1.12,low:1.09,close:1.11,tickVolume:12}))}
    : {symbol:'EURUSD',bid:1.1,ask:1.11,timestamp:new Date().toISOString(),marketState:'open'}}));
  vi.stubGlobal('fetch',fetchMock);
  await fetchRealYahooInstrumentCandles('EURUSD','1m');
  await fetchRealYahooInstrumentCandles('EURUSD','5m');
  const urls=fetchMock.mock.calls.map(c=>c[0]).filter(u=>u.includes('/ohlc?'));
  expect(urls[0]).toContain('interval=1m');
  expect(urls[1]).toContain('interval=5m');
 });
 it('refresh replaces current OHLC and volume instead of freezing the cache or doubling volume', async () => {
  setCachedRealCandles('1m','USDJPY',[bar(t,150)]);
  vi.stubGlobal('fetch',vi.fn(async (url: string)=>({ok:true,json:async()=>url.includes('/ohlc?')
    ? {symbol:'USDJPY',interval:'1m',bars:[{openTime:new Date(t*1000).toISOString(),open:150,high:151,low:149,close:150.5,tickVolume:100}]}
    : {symbol:'USDJPY',bid:150.4,ask:150.6,timestamp:new Date().toISOString(),marketState:'open'}})));
  expect(await refreshMarketCandles('USDJPY','1m')).toBe(true);
  expect(getCachedRealCandles('1m','USDJPY')![0].close).toBe(150.5);
  await refreshMarketCandles('USDJPY','1m');
  expect(getCachedRealCandles('1m','USDJPY')![0].volume).toBe(100);
 });
 it('keeps the last received series when refresh fails', async()=>{
  const source=[bar(t,150)];
  setCachedRealCandles('1m','USDJPY',source);
  vi.stubGlobal('fetch',vi.fn(async()=>{throw Error('offline')}));
  expect(await refreshMarketCandles('USDJPY','1m')).toBe(false);
  expect(getCachedRealCandles('1m','USDJPY')).toEqual(source);
 });
});
