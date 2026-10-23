import {test} from 'node:test';
import assert from 'node:assert/strict';
import {capitalBars,createCapitalClient,utcTimestamp} from './capital-indices.js';
const row={snapshotTimeUTC:'2026-10-22T12:00:00',openPrice:{bid:100,ask:102},highPrice:{bid:110,ask:112},lowPrice:{bid:90,ask:92},closePrice:{bid:105,ask:107}};
test('preserves original bid OHLC, UTC and gaps without midpoint/futures conversion',()=>{
  const bars=capitalBars([row,{...row,snapshotTimeUTC:'2026-10-22T12:02:00'}]);
  assert.deepEqual(bars[0],{openTime:'2026-10-22T12:00:00.000Z',open:100,high:110,low:90,close:105,volume:0});
  assert.equal(bars.length,2);assert.equal(Date.parse(bars[1].openTime)-Date.parse(bars[0].openTime),120000);
});
test('rejects impossible candles, missing UTC timestamps and missing bid prices',()=>{
  assert.throws(()=>capitalBars([{...row,highPrice:{bid:95}}]));
  assert.throws(()=>capitalBars([{...row,snapshotTimeUTC:undefined}]));
  assert.throws(()=>capitalBars([{...row,openPrice:{ask:102}}]));
  assert.ok(Number.isNaN(utcTimestamp('12:00:00')));
});
test('missing credentials or explicit instrument mapping cannot trigger fallback or broker calls',async()=>{
  let requests=0;const client=createCapitalClient({},async()=>{requests++;throw Error('unexpected')});
  await assert.rejects(client.live('US30','1m',100),/mapping/);
  assert.equal(requests,0);
});
const env={CAPITAL_API_KEY:'fixture-key',CAPITAL_IDENTIFIER:'fixture-user',CAPITAL_API_PASSWORD:'fixture-password',CAPITAL_EPIC_US30:'DOW_FIXTURE'};
function fixture({wrong=false,stale=false,closed=false,fail=false,unauthorized=false}={}){
  const calls=[];let gets=0;
  return {calls,fetch:async(url,options)=>{
    calls.push({url,options});
    if(url.endsWith('/session'))return new Response('{}',{headers:{CST:'session-cst','X-SECURITY-TOKEN':'session-token'}});
    if(unauthorized && gets++===0)return new Response('{}',{status:401});
    if(fail)return new Response('{}',{status:503});
    if(url.includes('/markets/'))return Response.json({instrument:{epic:wrong?'OTHER':'DOW_FIXTURE',type:'INDICES'},snapshot:{bid:105,offer:106,updateTimeUTC:new Date(Date.now()-(stale?120000:1000)).toISOString().slice(0,-1),marketStatus:closed?'CLOSED':'TRADEABLE',delayTime:0}});
    return Response.json({prices:[row]});
  }};
}
test('normalizes broker data, keeps credentials server-side and caches repeated requests',async()=>{
  const f=fixture(),client=createCapitalClient(env,f.fetch);
  const result=await client.live('US30','1m',100);
  assert.equal(result.symbol,'US30');assert.equal(result.epic,'DOW_FIXTURE');assert.equal(result.priceBasis,'bid');assert.equal(result.bars[0].open,100);
  assert.equal(JSON.stringify(result).includes('fixture-password'),false);
  await client.live('US30','1m',100);assert.equal(f.calls.length,3);
  assert.equal(f.calls[1].options.headers.CST,'session-cst');
  assert.equal(f.calls.every(c=>!c.url.includes('/positions')&&!c.url.includes('/workingorders')),true);
});
test('rejects wrong instrument identity, stale open quotes and unavailable broker data',async()=>{
  for(const options of [{wrong:true},{stale:true},{fail:true}]){
    const f=fixture(options);await assert.rejects(createCapitalClient(env,f.fetch).live('US30','1m',100));
  }
});
test('closed-market quotes remain explicitly closed',async()=>{
  const f=fixture({closed:true,stale:true});const result=await createCapitalClient(env,f.fetch).live('US30','1m',100);
  assert.equal(result.quote.marketState,'closed');assert.equal(result.quote.stale,true);
});
test('expired authentication retries once and never returns a fabricated candle',async()=>{
  const f=fixture({unauthorized:true});const result=await createCapitalClient(env,f.fetch).live('US30','1m',100);
  assert.equal(result.bars.length,1);assert.equal(f.calls.filter(c=>c.url.endsWith('/session')).length,2);
});
test('replay uses explicit UTC windows and same-provider bid prices across intervals',async()=>{
  const f=fixture();const result=await createCapitalClient(env,f.fetch).history('US30',Date.parse('2026-10-22T12:00:00Z')/1000);
  assert.equal(result.provider,'Capital.com demo');assert.equal(result.priceBasis,'index CFD bid');assert.equal(result.bars['1m'][0][1],100);
  assert.equal(f.calls.filter(c=>c.url.includes('/prices/')).every(c=>c.url.includes('from=')&&c.url.includes('to=')),true);
  assert.equal(result.coverage.windowOnly,true);
});
