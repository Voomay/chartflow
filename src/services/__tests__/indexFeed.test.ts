import {afterEach,describe,expect,it,vi} from 'vitest';
import {fetchIndexCandles} from '../indexFeed';
import {clearSpotQuotes,getSpotQuote} from '../spotFeed';
afterEach(()=>{vi.unstubAllGlobals();clearSpotQuotes();});
describe('Configured broker index feed',()=>{
 it.each(['US30','NAS100','UK100','GER30'] as const)('accepts only same-symbol bid candles for %s',async symbol=>{
   vi.stubGlobal('window',{document:{}});
   const time=Math.floor(Date.now()/60000)*60000;
   vi.stubGlobal('fetch',vi.fn(async()=>({ok:true,status:200,json:async()=>({symbol,interval:'1m',provider:'Capital.com demo',priceBasis:'bid',quote:{symbol,bid:100,ask:101,timestamp:new Date().toISOString(),marketState:'open'},bars:[{openTime:new Date(time).toISOString(),open:99,high:102,low:98,close:100}]})})));
   const result=await fetchIndexCandles(symbol,'1m',100);
   expect(result.configured).toBe(true);expect(result.bars?.[0].open).toBe(99);expect(getSpotQuote(symbol)?.price).toBe(100);
 });
 it('an unavailable configured broker never authorizes a cash-index fallback',async()=>{
   vi.stubGlobal('window',{document:{}});vi.stubGlobal('fetch',vi.fn(async()=>({ok:false,status:503})));
   expect(await fetchIndexCandles('US30','1m',100)).toEqual({configured:true,bars:null});
 });
 it('an explicit not-configured response retains the existing separately labeled feed',async()=>{
   vi.stubGlobal('window',{document:{}});vi.stubGlobal('fetch',vi.fn(async()=>({ok:false,status:409})));
   expect(await fetchIndexCandles('US30','1m',100)).toEqual({configured:false,bars:null});
 });
});
