import {createDefaultSessionsForUser} from '../storageAndAnalytics';
import {beforeEach,describe,expect,it} from 'vitest';
import {aggregateCandlesToTimeframe,getReplayWeekdayTarget,getHistoricalReplayAvailability,clearRealCandleCache,setHistoricalCandles,getProviderChartCandles,setCachedRealCandles,getMarketFeedLabel,getInstrumentHistoricalCoverage,snapToOpenTradingDate,findExactCandleByTime,findFirstCandleAfterTime} from '../goldDataService';
import {advanceOrRewindSessionToTimestamp,closeOrCancelPosition,modifyPositionOrOrder,validateAndPlaceOrder,evaluateSessionAt1mTimestamp,validateSessionHistoricalData,getLatest1mCandleAtClock,get1mExecutionSlice,getDay1mCandles,getAggregatedCandlesUpToClock} from '../simulationEngine';
import {Candle} from '../../types/trading';
const t=Date.parse('2015-01-05T08:00:00Z')/1000;
const bar=(time:number,open=1200):Candle=>({time,open,high:open+2,low:open-1,close:open+1,volume:0});
beforeEach(clearRealCandleCache);
describe('Original historical replay archives',()=>{
 it('develops a 15-minute candle at each one-minute replay clock without exposing later wicks',()=>{
  const minutes=Array.from({length:31},(_,i)=>bar(t+i*60,1200+i));
  const higher=aggregateCandlesToTimeframe(minutes,'15m','XAUUSD');
  setHistoricalCandles('XAUUSD',{'1m':minutes,'15m':higher},'Archive',t);
  for(let minute=1;minute<15;minute++){
   const visible=getProviderChartCandles('XAUUSD','15m',t+minute*60);
   expect(visible).toHaveLength(1);expect(visible[0].time).toBe(t);
   expect(visible[0].open).toBe(1200);expect(visible[0].close).toBe(1200+minute);
   expect(visible[0].high).toBe(1201+minute);
  }
  const boundary=getProviderChartCandles('XAUUSD','15m',t+15*60);
  expect(boundary).toHaveLength(2);expect(boundary[0]).toEqual(higher[0]);
  expect(boundary[1]).toMatchObject({time:t+900,open:1215,high:1215,low:1215,close:1215});
 });

 it('skips closed weekends to Monday while respecting New York summer and winter closes',()=>{
  const seconds=(value:string)=>Date.parse(value)/1000;
  const monday=seconds('2023-01-09T00:00:00Z');
  expect(getReplayWeekdayTarget('EURUSD',seconds('2023-01-06T21:59:00Z'))).toBe(seconds('2023-01-06T21:59:00Z'));
  for(const time of ['2023-01-06T22:00:00Z','2023-01-07T08:00:00Z','2023-01-08T22:30:00Z'])expect(getReplayWeekdayTarget('EURUSD',seconds(time))).toBe(monday);
  expect(getReplayWeekdayTarget('XAUUSD',seconds('2023-07-07T21:00:00Z'))).toBe(seconds('2023-07-10T00:00:00Z'));
  expect(getReplayWeekdayTarget('XAUUSD',seconds('2023-07-07T20:59:00Z'))).toBe(seconds('2023-07-07T20:59:00Z'));
  expect(getReplayWeekdayTarget('BTCUSD',seconds('2023-01-07T08:00:00Z'))).toBe(seconds('2023-01-07T08:00:00Z'));
 });

 it('identifies Sunday January 1 2023 as a closure and provides the next original bar',()=>{
  const friday=Date.parse('2022-12-30T21:58:00Z')/1000;
  const sunday=Date.parse('2023-01-01T08:00:00Z')/1000;
  const next=Date.parse('2023-01-02T00:00:00Z')/1000;
  setHistoricalCandles('EURUSD',{'1m':[bar(friday,1.07),bar(next,1.07)]},'Archive',friday,next+86400);
  const state=getHistoricalReplayAvailability('EURUSD',sunday)!;
  expect(state.kind).toBe('WEEKEND');
  expect(state.nextTime).toBe(next);
  expect(state.message).toContain('2023-01-02 00:00 UTC');
  expect(getHistoricalReplayAvailability('EURUSD',state.nextTime!)!.kind).toBe('READY');
 });
 it('distinguishes an intraday missing quote from a weekend without inventing a price',()=>{
  setHistoricalCandles('XAUUSD',{'1m':[bar(t),bar(t+120)]},'Archive',t,t+120);
  expect(getHistoricalReplayAvailability('XAUUSD',t+60)).toMatchObject({kind:'GAP',nextTime:t+120});
  expect(getLatest1mCandleAtClock('XAUUSD',t+60)).toBeNull();
 });
 it('reports actual archive boundaries even when a requested date falls on a weekend',()=>{
  setHistoricalCandles('EURUSD',{'1m':[bar(t,1.1)]},'Archive',t,t+60);
  expect(getHistoricalReplayAvailability('EURUSD',t-3*86400)).toMatchObject({kind:'BEFORE',nextTime:t});
  expect(getHistoricalReplayAvailability('EURUSD',t+6*86400)!.kind).toBe('AFTER');
  expect(getHistoricalReplayAvailability('EURUSD',t+6*86400)!.message).toContain('2015-01-05 08:01 UTC');
 });
 it('does not label crypto missing quotes as a weekend closure',()=>{
  const sunday=Date.parse('2023-01-01T08:00:00Z')/1000;
  setHistoricalCandles('BTCUSD',{'1m':[bar(sunday-60),bar(sunday+60)]},'Archive',sunday-60,sunday+60);
  expect(getHistoricalReplayAvailability('BTCUSD',sunday)!.kind).toBe('GAP');
 });
 it('does not report a gap before an archive has loaded and clears old coverage on reset',()=>{
  expect(getHistoricalReplayAvailability('EURUSD',t)).toBeUndefined();
  setHistoricalCandles('EURUSD',{'1m':[bar(t,1.1)]},'Archive',t,t);
  clearRealCandleCache();
  setHistoricalCandles('EURUSD',{'1m':[bar(t+120,1.1)]},'Archive');
  expect(getHistoricalReplayAvailability('EURUSD',t+180)!.kind).toBe('GAP');
 });

 it('keeps higher-timeframe replay prices aligned with the known current minute open',()=>{
  setHistoricalCandles('XAUUSD',{'5m':[{...bar(t),high:9000}],'1m':[bar(t),{...bar(t+60,1203),high:8000}]},'Archive',t);
  const minute=getProviderChartCandles('XAUUSD','1m',t+60).slice(-1)[0]!;
  const five=getProviderChartCandles('XAUUSD','5m',t+60).slice(-1)[0]!;
  expect(five.close).toBe(minute.close);
  expect(five.close).toBe(1203);
  expect(five.high).toBe(1203);
 });
 it('builds the first archived month from its first actual trading minute without leaking future OHLC',()=>{
  const month=Date.parse('2015-01-01T00:00:00Z')/1000,first=month+23*3600+60;
  setHistoricalCandles('XAUUSD',{'1M':[{...bar(month),high:9000}],'1m':[bar(first),{...bar(first+60),high:8000}]},'Archive',first);
  expect(getProviderChartCandles('XAUUSD','1M',first+60)[0]).toEqual({...bar(first),time:month,close:1200});
 });
 it('accepts 2015 session dates without claiming synthetic historical coverage',()=>{
  expect(validateSessionHistoricalData('2015-01-05','2015-01-31','08:00',['XAUUSD']).valid).toBe(true);
 });
 it('executes from the known open, evaluates TP only after the minute closes, and rejects a missing minute',()=>{
  setHistoricalCandles('XAUUSD',{'1m':[bar(t)]},'Archive');
  const original=createDefaultSessionsForUser('archive-execution-test')[0];
  const session={...original,status:'ACTIVE' as const,mode:'BACKTESTING' as const,frozenConfig:undefined,positions:[],realizedPnL:0,replayTimestamp:t,startTimestamp:t,endTimestamp:t+86400,activeAsset:'XAUUSD' as const,assets:['XAUUSD' as const]};
  const input={symbol:'XAUUSD' as const,side:'LONG' as const,orderSubType:'MARKET' as const,lotSize:0.01,stopLoss:1190,takeProfit:1201.5};
  const placed=validateAndPlaceOrder(session,input);
  expect(placed.ok,placed.error).toBe(true);
  expect(placed.position!.entryPrice).toBeLessThan(1201);
  expect(advanceOrRewindSessionToTimestamp(placed.session,t+3600).rewindBlockedReason).toContain('whole jump');
  const gapSession={...placed.session,replayTimestamp:t+60};
  expect(closeOrCancelPosition(gapSession,placed.position!.id).ok).toBe(false);
  expect(modifyPositionOrOrder(gapSession,placed.position!.id,{newStopLoss:1191}).ok).toBe(false);
  expect(evaluateSessionAt1mTimestamp(placed.session,t).session.positions![0].status).toBe('OPEN');
  expect(evaluateSessionAt1mTimestamp(placed.session,t+60).session.positions![0].status).toBe('CLOSED_TP');
  const missing=validateAndPlaceOrder({...session,id:'missing-archive-minute',replayTimestamp:t+60},{...input,lotSize:0.02});
  expect(missing.ok).toBe(false);
  expect(missing.error).toContain('No original minute bar');
 });
 it('uses the known open for orders and waits until a minute closes before evaluating its wicks',()=>{
  setHistoricalCandles('XAUUSD',{'1m':[bar(t)]},'Archive');
  expect(getLatest1mCandleAtClock('XAUUSD',t)?.close).toBe(1200);
  expect(getLatest1mCandleAtClock('XAUUSD',t+60)).toBeNull();
  expect(getLatest1mCandleAtClock('XAUUSD',t+60,undefined,true)).toEqual(bar(t));
  expect(get1mExecutionSlice('XAUUSD',t-1,t)).toEqual([]);
  expect(get1mExecutionSlice('XAUUSD',t,t+60)).toEqual([{...bar(t),time:t+60}]);
 });
 it('continues to use live quote snapshots when a historical archive for the same symbol is cached',()=>{
  setHistoricalCandles('XAUUSD',{'1m':[bar(t)]},'Archive');
  const paper={marketMode:'LIVE_PAPER',liveQuotes:{XAUUSD:{price:4000,time:t,receivedAt:t}}} as any;
  expect(getLatest1mCandleAtClock('XAUUSD',t,paper)?.close).toBe(4000);
 });
 it('keeps historical prices separate from live prices for the same instrument',()=>{
  const historical=[bar(t),bar(t+60)];setHistoricalCandles('XAUUSD',{'1m':historical},'HistData · bid archive');
  const live=[bar(t+86400*4000,4000)];setCachedRealCandles('1m','XAUUSD',live);
  expect(getProviderChartCandles('XAUUSD','1m',t+120)).toEqual(historical);
  expect(getProviderChartCandles('XAUUSD','1m',live[0].time,true)).toEqual(live);
  expect(getMarketFeedLabel('XAUUSD','1m',true)).toBe('HistData · bid archive');
 });
 it('never creates missing minute candles or expands higher bars into invented minute paths',()=>{
  setHistoricalCandles('XAUUSD',{'1m':[bar(t),bar(t+120)],'1D':[bar(Math.floor(t/86400)*86400)]},'HistData');
  expect(getDay1mCandles('XAUUSD',Math.floor(t/86400))).toHaveLength(2);
  expect(getDay1mCandles('XAUUSD',Math.floor(t/86400)-1)).toEqual([]);
 });
 it('does not reveal the unfinished historical minute close in the chart or aggregated replay view',()=>{
  setHistoricalCandles('XAUUSD',{'1m':[bar(t)]},'HistData');
  const expected={time:t,open:1200,high:1200,low:1200,close:1200,volume:0};
  expect(getProviderChartCandles('XAUUSD','1m',t)[0]).toEqual(expected);
  expect(getAggregatedCandlesUpToClock('XAUUSD','1m',t)[0]).toEqual(expected);
 });
 it('uses UTC weeks without shifting Sunday evenings into the next historical week',()=>{
  const monday=Date.parse('2015-01-05T00:00:00Z')/1000,sunday=monday+6*86400+22*3600;
  setHistoricalCandles('EURUSD',{'1W':[bar(monday,1.1)],'1D':[bar(monday-86400,1.09),...Array.from({length:7},(_,i)=>bar(monday+i*86400,1.1+i*.01))]},'Archive');
  expect(getProviderChartCandles('EURUSD','1W',sunday)[0].time).toBe(monday);
 });
 it('enforces per-instrument archive year and date coverage and rejects unsupported years like 2010',()=>{
  const usdjpyCov=getInstrumentHistoricalCoverage('USDJPY');
  expect(usdjpyCov.minYear).toBe(2015);
  expect(usdjpyCov.maxYear).toBe(2026);
  expect(usdjpyCov.isYearSupported(2010)).toBe(false);
  expect(usdjpyCov.isYearSupported(2014)).toBe(false);
  expect(usdjpyCov.isYearSupported(2018)).toBe(true);
  expect(validateSessionHistoricalData('2010-09-15','2010-10-15','08:00',['USDJPY']).valid).toBe(false);

  const ethCov=getInstrumentHistoricalCoverage('ETHUSD');
  expect(ethCov.minDate).toBe('2016-06-01');
  expect(ethCov.isMonthSupported('2016-05')).toBe(false);
  expect(ethCov.isMonthSupported('2016-06')).toBe(true);

  const oilCov=getInstrumentHistoricalCoverage('USOIL');
  expect(oilCov.isYearSupported(2024)).toBe(false);
  expect(oilCov.isYearSupported(2025)).toBe(false);
  expect(oilCov.isDateSupported('2026-06-15')).toBe(true);
 });
 it('jumps weekends and fixed holidays like 2018-01-01 to the next open trading day on USDJPY',()=>{
  const jan1=snapToOpenTradingDate('2018-01-01','USDJPY','forward');
  expect(jan1.adjusted).toBe(true);
  expect(jan1.date).toBe('2018-01-02');
  expect(jan1.reason).toContain("New Year's Day");

  const saturday=snapToOpenTradingDate('2018-01-06','USDJPY','forward');
  expect(saturday.adjusted).toBe(true);
  expect(saturday.date).toBe('2018-01-08');
  expect(saturday.reason).toContain('Monday 2018-01-08');

  const validated=validateSessionHistoricalData('2018-01-01','2018-01-31','08:00',['USDJPY']);
  expect(validated.valid).toBe(true);
  expect(validated.initialReplayTimestamp).toBe(Date.parse('2018-01-02T08:00:00Z')/1000);
 });
 it('fast-forwards from Friday 10:00 directly to Monday 10:00 in O(log N) using binary search without freezing',()=>{
  const fri10=Date.parse('2024-03-01T08:00:00Z')/1000; // Friday 10:00 SAST (08:00 UTC)
  const friClose=Date.parse('2024-03-01T21:59:00Z')/1000;
  const monOpen=Date.parse('2024-03-04T00:00:00Z')/1000;
  const mon10=Date.parse('2024-03-04T08:00:00Z')/1000; // Monday 10:00 SAST (08:00 UTC)
  const bars:Candle[]=[];
  for(let ts=fri10;ts<=friClose;ts+=60)bars.push(bar(ts,2040));
  for(let ts=monOpen;ts<=mon10+3600;ts+=60)bars.push(bar(ts,2055));
  setHistoricalCandles('XAUUSD',{'1m':bars},'HistData',fri10,mon10+3600);

  expect(findExactCandleByTime(bars,fri10)?.time).toBe(fri10);
  expect(findExactCandleByTime(bars,friClose+60)).toBeUndefined();
  expect(findFirstCandleAfterTime(bars,friClose)?.time).toBe(monOpen);

  const original=createDefaultSessionsForUser('friday-skip-test')[0];
  const session={...original,status:'ACTIVE' as const,mode:'BACKTESTING' as const,positions:[],realizedPnL:0,replayTimestamp:fri10,startTimestamp:fri10,endTimestamp:mon10+86400,activeAsset:'XAUUSD' as const,assets:['XAUUSD' as const]};
  const startMs=performance.now();
  const outcome=advanceOrRewindSessionToTimestamp(session,mon10);
  const elapsedMs=performance.now()-startMs;
  expect(outcome.rewindBlockedReason).toBeUndefined();
  expect(outcome.session.replayTimestamp).toBe(mon10);
  expect(elapsedMs).toBeLessThan(250);
 });
 it('derives realistic 30m, 15m, 5m, and 1m candlesticks from 1H and fills missing 1m lookback before partial month starts',async()=>{
  // @ts-ignore
  const {deriveLowerBarsFromArchive}=await import('../../../api/historical-candles.js');
  const jan6=Date.parse('2025-01-06T08:00:00Z')/1000;
  const h1Rows:number[][]=[
   [jan6,21367.65,21427.59,21367.52,21421.07,1200],
   [jan6+3600,21420.84,21473.40,21419.37,21472.11,1500],
  ];
  const all:Record<string,number[][]>={'1m':[],'5m':[],'15m':[],'30m':[],'1H':h1Rows,'4H':[],'1D':[],'1W':[],'1M':[]};
  deriveLowerBarsFromArchive(all,jan6+3600,jan6+7200,45000,'NAS100');
  expect(all['30m']).toHaveLength(4);
  expect(all['15m']).toHaveLength(8);
  expect(all['5m']).toHaveLength(24);
  expect(all['1m']).toHaveLength(120);
  for(const tf of ['30m','15m','5m','1m']){
   for(const r of all[tf]){
    expect(r[2]).toBeGreaterThanOrEqual(Math.max(r[1],r[4]));
    expect(r[3]).toBeLessThanOrEqual(Math.min(r[1],r[4]));
    expect(r[2]).toBeGreaterThan(r[3]);
   }
  }
  // Also test partial 1m coverage (e.g. 2026-09-01 05:00 UTC where earlier 5m bars exist)
  const sep1=Date.parse('2026-09-01T05:00:00Z')/1000;
  const partialAll:Record<string,number[][]>={
   '5m':[
    [sep1-600,4430.0,4435.5,4428.2,4433.8,100],
    [sep1-300,4433.8,4438.0,4431.5,4436.57,120],
    [sep1,4436.57,4440.2,4435.0,4439.1,110],
   ],
   '1m':[[sep1,4436.57,4437.8,4436.1,4437.2,25]],
  };
  deriveLowerBarsFromArchive(partialAll,sep1,sep1+3600,45000,'XAUUSD');
  expect(partialAll['1m'].filter(r=>r[0]<sep1)).toHaveLength(10);
  expect(partialAll['1m'].find(r=>r[0]===sep1)?.[4]).toBe(4437.2);
 });
});
