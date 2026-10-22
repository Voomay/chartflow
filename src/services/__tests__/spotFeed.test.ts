import {getProviderChartCandles,setCachedRealCandles,clearRealCandleCache} from '../goldDataService';
import {describe,it,expect,vi,afterEach} from 'vitest';
import {parseSpotBars,fetchSpotCandles,getSpotQuote,getSpotFeedStatus,clearSpotQuotes,spotInterval} from '../spotFeed';
const t=Date.parse('2026-10-22T12:00:00Z');
const raw=(openTime='2026-10-22T11:59:00Z')=>({openTime,open:.701,high:.702,low:.700,close:.7015,tickVolume:123,volume:0});
afterEach(()=>{vi.unstubAllGlobals();vi.restoreAllMocks();clearSpotQuotes();clearRealCandleCache()});
describe('Spot feed validation',()=>{
 it('keeps real Japanese OHLC and original UTC timestamps unchanged',()=>{
  expect(parseSpotBars([raw()],t)).toEqual([{time:(t-60000)/1000,open:.701,high:.702,low:.700,close:.7015,volume:123}]);
 });
 it('rejects malformed, impossible, future, and ambiguous-time bars instead of inventing wicks',()=>{
  expect(parseSpotBars([{...raw(),high:.69},{...raw(),open:NaN},{...raw(),low:0},raw('2026-10-22T13:00:00Z'),raw('2026-10-22T11:59:00')],t)).toEqual([]);
 });
 it('sorts and replaces duplicate snapshots without double-counting tick volume',()=>{
  const bars=parseSpotBars([raw(),raw('2026-10-22T11:58:00Z'),{...raw(),close:.7017,tickVolume:150}],t);
  expect(bars).toHaveLength(2);expect(bars[1].close).toBe(.7017);expect(bars[1].volume).toBe(150);
 });
 it('preserves legitimate dojis and interbar gaps',()=>{
  const bars=parseSpotBars([raw(),{...raw('2026-10-22T12:00:00Z'),open:.705,high:.705,low:.705,close:.705}],t);
  expect(bars[1].open).toBe(.705);expect(bars[1].high).toBe(.705);
 });
 it('maps weekly requests to daily history without crossing providers',()=>{
  expect(spotInterval('1W')).toBe('1d');expect(spotInterval('4H')).toBe('4h');expect(spotInterval('5m')).toBe('5m');
 });
 it('accepts fresh quotes and reports their actual source timestamp',async()=>{
  vi.spyOn(Date,'now').mockReturnValue(t);
  vi.stubGlobal('fetch',vi.fn(async(url:string)=>({ok:true,json:async()=>url.includes('/ohlc?')?{symbol:'AUDUSD',interval:'1m',bars:[raw()]}:{symbol:'AUDUSD',bid:.701,ask:.7011,timestamp:new Date(t-3000).toISOString(),marketState:'open'}})));
  expect(await fetchSpotCandles('AUDUSD','1m',120)).toHaveLength(1);
  expect(getSpotQuote('AUDUSD')!.time).toBe((t-3000)/1000);
  expect(getSpotFeedStatus('AUDUSD',t/1000)).toContain('Quote 3s ago');
  expect(getSpotFeedStatus('AUDUSD',t/1000+61)).toContain('STALE');
 });
 it('updates only the current candle with a fresh observed quote and leaves native history unchanged',async()=>{
  vi.spyOn(Date,'now').mockReturnValue(t);
  vi.stubGlobal('fetch',vi.fn(async(url:string)=>({ok:true,json:async()=>url.includes('/ohlc?')?{symbol:'AUDUSD',interval:'1m',bars:[raw()]}:{symbol:'AUDUSD',bid:.7017,ask:.7019,timestamp:new Date(t-3000).toISOString(),marketState:'open'}})));
  const native=await fetchSpotCandles('AUDUSD','1m',120);
  setCachedRealCandles('1m','AUDUSD',native!);
  const current=getProviderChartCandles('AUDUSD','1m',t/1000,true);
  expect(current[0].close).toBe(.7018);
  expect(current[0].open).toBe(.701);
  expect(current[0].high).toBe(.702);
  expect(native![0].close).toBe(.7015);
 });
 it('rejects stale open-market quotes and wrong-symbol responses',async()=>{
  vi.spyOn(Date,'now').mockReturnValue(t);
  vi.stubGlobal('fetch',vi.fn(async(url:string)=>({ok:true,json:async()=>url.includes('/ohlc?')?{symbol:'AUDUSD',interval:'1m',bars:[raw()]}:{symbol:'AUDUSD',bid:.701,ask:.7011,timestamp:new Date(t-61000).toISOString(),marketState:'open'}})));
  expect(await fetchSpotCandles('AUDUSD','1m',120)).toBeNull();expect(getSpotQuote('AUDUSD')).toBeUndefined();
 });
 it('keeps closed-market history available without calling it live',async()=>{
  vi.spyOn(Date,'now').mockReturnValue(t);
  vi.stubGlobal('fetch',vi.fn(async(url:string)=>({ok:true,json:async()=>url.includes('/ohlc?')?{symbol:'AUDUSD',interval:'1m',bars:[raw()]}:{symbol:'AUDUSD',bid:.701,ask:.7011,timestamp:new Date(t-86400000).toISOString(),marketState:'closed',stale:true}})));
  expect(await fetchSpotCandles('AUDUSD','1m',120)).toHaveLength(1);expect(getSpotFeedStatus('AUDUSD',t/1000)).toContain('Market closed');
 });
});
