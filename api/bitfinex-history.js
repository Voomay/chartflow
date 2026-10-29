import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises';
import {gzipSync,gunzipSync} from 'node:zlib';
import path from 'node:path';
const pending=new Map();let queue=Promise.resolve();let lastRequest=0;
const periods=['1m','5m','15m','30m','1h','1D','1W'];
export function parseBitfinexRows(input){
 if(!Array.isArray(input)||input.some(row=>!Array.isArray(row)))throw Error('Invalid Bitfinex candle response');
 return input.map(([ms,o,c,h,l,v])=>{
  if(![ms,o,h,l,c,v].every(Number.isFinite)||ms%60000||Math.min(o,h,l,c)<=0||h<Math.max(o,c)||l>Math.min(o,c)||h<l||v<0)throw Error('Invalid Bitfinex OHLC');
  return [ms/1000,o,h,l,c,v];
 }).sort((a,b)=>a[0]-b[0]);
}
function scheduledFetch(url){
 const task=queue.then(async()=>{
  const delay=Math.max(0,1200-(Date.now()-lastRequest));if(delay)await new Promise(resolve=>setTimeout(resolve,delay));
  lastRequest=Date.now();const response=await fetch(url,{signal:AbortSignal.timeout(8000)});
  if(!response.ok)throw Error(`Bitfinex archive HTTP ${response.status}`);
  return parseBitfinexRows(await response.json());
 });
 queue=task.catch(()=>{});return task;
}
export async function loadBitfinexWindow(root,symbol,clock,deriveFn){
 const first=Date.parse(symbol==='BTCUSD'?'2013-04-01':'2016-06-01')/1000;
 if(clock<first)return {symbol,provider:'Bitfinex',priceBasis:'USD exchange trades',timezone:'UTC',coverage:{first,last:Math.floor(Date.now()/1000),years:[],onDemand:true},bars:Object.fromEntries([...periods,'4H','1M'].map(tf=>[tf==='1h'?'1H':tf,[]]))};
 const day=Math.floor(clock/86400);const end=Math.min((day+4)*86400,Date.now()/1000);
 const key=`${symbol}:${day}`;if(pending.has(key))return pending.get(key);
 const task=(async()=>{
  const bars={};
  for(const tf of periods){
   const tfDir=path.join(root,'bitfinex-cache',symbol,tf);
   const file=path.join(tfDir,`${day}.json.gz`);
   const merged=new Map();
   let hasExactDayFile=false;
   try{
    const exactRows=JSON.parse(gunzipSync(await readFile(file)).toString());
    for(const r of exactRows)if(r[0]<=end)merged.set(r[0],r);
    hasExactDayFile=true;
   }catch{}
   try{
    const files=await readdir(tfDir);
    for(const f of files){
     if(!f.endsWith('.json.gz')||f===`${day}.json.gz`)continue;
     try{
      const extra=JSON.parse(gunzipSync(await readFile(path.join(tfDir,f))).toString());
      for(const r of extra)if(r[0]<=end)merged.set(r[0],r);
     }catch{}
    }
   }catch{}
   const hasCoverageNearClock=[...merged.keys()].some(t=>t>=clock-7*86400&&t<=clock+86400);
   if(!hasExactDayFile&&!hasCoverageNearClock){
    try{
     const fetched=await scheduledFetch(`https://api-pub.bitfinex.com/v2/candles/trade:${tf}:t${symbol}/hist?end=${Math.floor(end*1000)}&limit=10000&sort=-1`);
     for(const r of fetched)if(r[0]<=end)merged.set(r[0],r);
     try{await mkdir(tfDir,{recursive:true});await writeFile(file,gzipSync(JSON.stringify(fetched)));}catch{}
    }catch{}
   }
   const maxForTf=tf==='1m'?45000:tf==='5m'?15000:10000;
   bars[tf==='1h'?'1H':tf]=[...merged.values()].sort((a,b)=>a[0]-b[0]).slice(-maxForTf);
  }
  const grouped=new Map();for(const b of bars['1H']){const bucket=Math.floor(b[0]/14400)*14400;const old=grouped.get(bucket);if(old){old[2]=Math.max(old[2],b[2]);old[3]=Math.min(old[3],b[3]);old[4]=b[4];old[5]+=b[5];}else grouped.set(bucket,[bucket,...b.slice(1)]);}
  bars['4H']=[...grouped.values()];
  const months=new Map();for(const b of bars['1D']){const d=new Date(b[0]*1000);const k=Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),1)/1000;const old=months.get(k);if(old){old[2]=Math.max(old[2],b[2]);old[3]=Math.min(old[3],b[3]);old[4]=b[4];old[5]+=b[5];}else months.set(k,[k,...b.slice(1)]);}
  bars['1M']=[...months.values()];
  if(typeof deriveFn==='function')deriveFn(bars,clock,end,45000,symbol);
  return {symbol,provider:'Bitfinex',priceBasis:'USD exchange trades',timezone:'UTC',coverage:{first,last:Math.floor(end),years:[],onDemand:true},bars};
 })();pending.set(key,task);try{return await task;}finally{pending.delete(key);}
}
