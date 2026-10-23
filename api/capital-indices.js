// Server-only, read-only Capital.com demo data adapter. Never submits broker orders.
export const INDEX_SYMBOLS = new Set(['US30', 'NAS100', 'UK100', 'GER30']);
const resolutions = {'1m':'MINUTE','5m':'MINUTE_5','15m':'MINUTE_15','30m':'MINUTE_30','1h':'HOUR','4h':'HOUR_4','1d':'DAY'};
export function capitalEnabled(env = process.env) { return env.CAPITAL_INDEX_DATA === 'true'; }
export function utcTimestamp(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z?$/.test(value)) return NaN;
  return Date.parse(value.endsWith('Z') ? value : value + 'Z') / 1000;
}
export function capitalBars(prices) {
  if (!Array.isArray(prices)) throw Error('Invalid broker candle response');
  const bars = new Map();
  for (const row of prices) {
    const time = utcTimestamp(row.snapshotTimeUTC);
    const [open,high,low,close] = ['openPrice','highPrice','lowPrice','closePrice'].map(key => row[key]?.bid);
    if (!Number.isFinite(time) || time % 60 || ![open,high,low,close].every(v=>typeof v==='number' && Number.isFinite(v) && v>0) || high<Math.max(open,close) || low>Math.min(open,close) || high<low) throw Error('Invalid broker OHLC');
    bars.set(time,{openTime:new Date(time*1000).toISOString(),open,high,low,close,volume:0});
  }
  return [...bars.values()].sort((a,b)=>Date.parse(a.openTime)-Date.parse(b.openTime));
}
export function createCapitalClient(env = process.env, fetcher = (...args)=>fetch(...args)) {
  const base = 'https://demo-api-capital.backend-capital.com/api/v1';
  let session, connecting;
  const cache = new Map(), pending = new Map();
  async function connect() {
    if (session && Date.now()-session.used<8*60000) return session;
    if (connecting) return connecting;
    connecting = (async()=>{
      if (![env.CAPITAL_API_KEY,env.CAPITAL_IDENTIFIER,env.CAPITAL_API_PASSWORD].every(Boolean)) throw Error('Capital.com demo credentials are not configured');
      const response = await fetcher(base+'/session',{method:'POST',signal:AbortSignal.timeout(8000),headers:{'Content-Type':'application/json','X-CAP-API-KEY':env.CAPITAL_API_KEY},body:JSON.stringify({identifier:env.CAPITAL_IDENTIFIER,password:env.CAPITAL_API_PASSWORD,encryptedPassword:false})});
      if (!response.ok) throw Error('Broker authentication failed');
      const cst=response.headers.get('CST'), token=response.headers.get('X-SECURITY-TOKEN');
      if (!cst || !token) throw Error('Missing broker session tokens');
      session={cst,token,used:Date.now()}; return session;
    })();
    try { return await connecting; } finally { connecting=undefined; }
  }
  async function get(path, ttl=4000) {
    const cached=cache.get(path);if(cached && Date.now()-cached.time<ttl)return cached.data;
    if(pending.has(path))return pending.get(path);
    const task=(async()=>{
      for(let attempt=0;attempt<2;attempt++) {
        const auth=await connect();
        const response=await fetcher(base+path,{signal:AbortSignal.timeout(8000),headers:{CST:auth.cst,'X-SECURITY-TOKEN':auth.token}});
        if(response.status===401 && attempt===0){session=undefined;continue;}
        if(!response.ok)throw Error('Broker market data unavailable');
        auth.used=Date.now();const data=await response.json();
        if(cache.size>=100)cache.delete(cache.keys().next().value);
        cache.set(path,{time:Date.now(),data});return data;
      }
    })();
    pending.set(path,task);try{return await task;}finally{pending.delete(path);}
  }
  function epicFor(symbol) {
    const epic=env['CAPITAL_EPIC_'+symbol];
    if(!INDEX_SYMBOLS.has(symbol) || !epic || !/^[A-Za-z0-9_.-]{1,80}$/.test(epic))throw Error('Broker instrument mapping is not configured');
    return epic;
  }
  async function series(symbol,interval,limit=1000,clock) {
    const epic=epicFor(symbol);if(!resolutions[interval])throw Error('Unsupported broker interval');
    const q=new URLSearchParams({resolution:resolutions[interval],max:String(Math.min(1000,Math.max(1,limit)))});
    if(clock!==undefined){
      // An explicit window avoids silently substituting today's bars for missing replay history.
      const seconds={'1m':60,'5m':300,'15m':900,'30m':1800,'1h':3600,'4h':14400,'1d':86400}[interval];
      q.set('from',new Date((clock-500*seconds)*1000).toISOString().slice(0,19));
      q.set('to',new Date(Math.min(Date.now(),(clock+100*seconds)*1000)).toISOString().slice(0,19));
    }
    const result=await get('/prices/'+encodeURIComponent(epic)+'?'+q,clock===undefined?4000:60000);
    const bars=capitalBars(result.prices);
    return {symbol,interval,bars,provider:'Capital.com demo',priceBasis:'bid',epic};
  }
  async function live(symbol,interval,limit) {
    const epic=epicFor(symbol);
    const market=await get('/markets/'+encodeURIComponent(epic));
    if(market.instrument?.epic!==epic || market.instrument?.type!=='INDICES')throw Error('Broker instrument identity mismatch');
    const snapshot=market.snapshot;
    const time=utcTimestamp(snapshot?.updateTimeUTC), bid=snapshot?.bid, ask=snapshot?.offer;
    if(!Number.isFinite(time)||time>Date.now()/1000+5||!Number.isFinite(bid)||!Number.isFinite(ask)||bid<=0||ask<bid)throw Error('Invalid broker quote');
    const closed=snapshot.marketStatus!=='TRADEABLE';
    const age=Math.max(0,Date.now()/1000-time);
    if(!closed && (age>60 || Number(snapshot.delayTime)>0))throw Error('Broker quote is stale or delayed');
    return {...await series(symbol,interval,limit),quote:{symbol,bid,ask,timestamp:new Date(time*1000).toISOString(),marketState:closed?'closed':'open',stale:age>60},sourceLabel:'Capital.com demo · index CFD · bid · UTC'};
  }
  async function history(symbol,clock) {
    const bars={};
    for(const [tf,interval] of Object.entries({'1m':'1m','5m':'5m','15m':'15m','30m':'30m','1H':'1h','4H':'4h','1D':'1d'})) {
      const data=await series(symbol,interval,1000,clock);
      bars[tf]=data.bars.map(b=>[Date.parse(b.openTime)/1000,b.open,b.high,b.low,b.close,0]);
    }
    // Aggregate calendar weeks/months from this broker's daily bars only.
    for(const tf of ['1W','1M']){
      const groups=new Map();
      for(const row of bars['1D']){
        const d=new Date(row[0]*1000);d.setUTCHours(0,0,0,0);
        if(tf==='1M')d.setUTCDate(1);else d.setUTCDate(d.getUTCDate()-(d.getUTCDay()+6)%7);
        const key=d.getTime()/1000, previous=groups.get(key);
        if(previous){previous[2]=Math.max(previous[2],row[2]);previous[3]=Math.min(previous[3],row[3]);previous[4]=row[4];}
        else groups.set(key,[key,...row.slice(1)]);
      }
      bars[tf]=[...groups.values()].filter(row=>row[0]>=bars['1D'][0]?.[0]);
    }
    const minute=bars['1m'];if(!minute.length)throw Error('No broker minute history for this replay date');
    return {symbol,provider:'Capital.com demo',priceBasis:'index CFD bid',timezone:'UTC',coverage:{first:minute[0][0],last:minute.at(-1)[0],rows:minute.length,years:[],windowOnly:true},bars};
  }
  return {live,history};
}
export const capitalClient=createCapitalClient();
export default async function handler(req,res){
  res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');
  const q=new URL(req.url,'http://localhost').searchParams,symbol=q.get('symbol'),interval=q.get('interval');
  if(req.method!=='GET'||!INDEX_SYMBOLS.has(symbol)||!resolutions[interval]){res.statusCode=400;res.end(JSON.stringify({error:'Unsupported index request'}));return;}
  if(!capitalEnabled()){res.statusCode=409;res.end(JSON.stringify({configured:false,error:'Capital.com demo data is not connected'}));return;}
  try{res.statusCode=200;res.end(JSON.stringify(await capitalClient.live(symbol,interval,Number(q.get('limit'))||1000)));}
  catch{res.statusCode=503;res.end(JSON.stringify({configured:true,error:'Capital.com demo data unavailable. Check server credentials, instrument mappings, market status and connection.'}));}
}
