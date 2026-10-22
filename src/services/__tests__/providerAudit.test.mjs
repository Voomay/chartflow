import {describe, expect, it} from 'vitest';
import {writeFileSync} from 'node:fs';
import {fetchRealYahooInstrumentCandles, getMarketFeedLabel, INSTRUMENTS, TIMEFRAME_CONFIG} from '../goldDataService';

const results = [];
describe.skipIf(process.env.FX_LIVE_AUDIT !== '1')('All instrument live chart audit',()=>{
 it.concurrent.each(INSTRUMENTS)('$symbol: 1m and 5m provider OHLC and UTC timestamps',async instrument=>{
  for (const tf of ['1m','5m']) {
   const bars=await fetchRealYahooInstrumentCandles(instrument.symbol,tf,120);
   const flat=bars?.filter(c=>c.open===c.high&&c.open===c.low&&c.open===c.close).length || 0;
   const row={symbol:instrument.symbol,timeframe:tf,source:getMarketFeedLabel(instrument.symbol,tf),bars:bars?.length||0,flatPercent:bars?.length?Math.round(flat/bars.length*100):null,lastBar:bars?.length?new Date(bars[bars.length-1].time*1000).toISOString():null,close:bars?.length?bars[bars.length-1].close:null};
   results.push(row);
   if(process.env.FX_AUDIT_PATH)writeFileSync(process.env.FX_AUDIT_PATH,JSON.stringify(results,null,2));
   console.log(JSON.stringify(row));
   expect(bars,`${instrument.symbol} ${tf}: provider unavailable`).not.toBeNull();
   expect(bars.length).toBeGreaterThan(5);
   for(let i=0;i<bars.length;i++) {
    const c=bars[i];
    expect(c.high).toBeGreaterThanOrEqual(Math.max(c.open,c.close));
    expect(c.low).toBeLessThanOrEqual(Math.min(c.open,c.close));
    expect(c.low).toBeGreaterThan(0);
    expect(c.time%TIMEFRAME_CONFIG[tf].seconds).toBe(0);
    if(i)expect(c.time).toBeGreaterThan(bars[i-1].time);
   }
  }
 },30000);
});
