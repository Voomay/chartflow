import {describe,it,expect} from 'vitest';
import {interpolateRevealedCandle,revealedHistorySamplesMatch} from '../replayPresentation';
import {shiftTimeframeClock} from '../goldDataService';
import type {Candle} from '../../types/trading';
describe('replay presentation',()=>{
 const from:Candle={time:1000,open:100,high:104,low:98,close:102,volume:10};
 const to:Candle={time:1000,open:100,high:108,low:95,close:96,volume:20};
 it('eases only within already-revealed candle bounds',()=>{for(let n=0;n<=20;n++){const bar=interpolateRevealedCandle(from,to,n/20);expect(bar.open).toBe(to.open);expect(bar.high).toBeGreaterThanOrEqual(Math.max(bar.open,bar.close));expect(bar.low).toBeLessThanOrEqual(Math.min(bar.open,bar.close));expect(bar.high).toBeLessThanOrEqual(to.high);expect(bar.low).toBeGreaterThanOrEqual(to.low);}});
 it('finishes at the exact source OHLC without mutating it',()=>{expect(interpolateRevealedCandle(from,to,1)).toEqual(to);expect(from.close).toBe(102);expect(to.close).toBe(96);});
 it('does not blend different historical buckets',()=>{expect(interpolateRevealedCandle(from,{...to,time:2000},.2)).toEqual({...to,time:2000});});
 it('clamps progress',()=>{expect(interpolateRevealedCandle(from,to,-1).close).toBe(from.close);expect(interpolateRevealedCandle(from,to,2)).toEqual(to);});
 it('advances a selected one-minute replay step independently of a 15-minute view',()=>{const clock=Date.UTC(2026,9,19,8)/1000;expect(shiftTimeframeClock(clock,'1m',1)).toBe(clock+60);expect(shiftTimeframeClock(clock,'5m',1)).toBe(clock+300);expect(shiftTimeframeClock(clock,'15m',1)).toBe(clock+900);});
});

describe('incremental chart history samples',()=>{
 const bars:Candle[]=Array.from({length:6},(_,i)=>({time:1000+i*60,open:i+100,high:i+102,low:i+99,close:i+101,volume:1}));
 it('does not reset the chart when an append shifts the array midpoint',()=>{expect(revealedHistorySamplesMatch({length:5,firstClose:101,midClose:103},bars)).toBe(true);});
 it('detects a changed closed candle sample',()=>{expect(revealedHistorySamplesMatch({length:5,firstClose:101,midClose:103},bars.map((bar,index)=>index===2?{...bar,close:1000}:bar))).toBe(false);});
 it('allows the only active candle to develop without resetting',()=>{expect(revealedHistorySamplesMatch({length:1,firstClose:100,midClose:100},bars.slice(0,1))).toBe(true);});
});
