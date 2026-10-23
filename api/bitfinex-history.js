import {readFile,writeFile,mkdir} from 'node:fs/promises';
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
  const delay=Math.max(0,2100-(Date.now()-lastRequest));if(delay)await new Promise(resolve=>setTimeout(resolve,delay));
  lastRequest=Date.now();const response=await fetch(url,{signal:AbortSignal.timeout(12000)});
  if(!response.ok)throw Error(`Bitfinex archive HTTP ${response.status}`);
  return parseBitfinexRows(await response.json());
 });
 queue=task.catch(()=>{});return task;
}
export async function loadBitfinexWindow(root,symbol,clock){
 const first=Date.parse(symbol==='BTCUSD'?'2013-04-01':'2016-06-01')/1000;
 if(clock<first)return {symbol,provider:'Bitfinex',priceBasis:'USD exchange trades',timezone:'UTC',coverage:{first,last:Math.floor(Date.now()/1000),years:[],onDemand:true},bars:Object.fromEntries([...periods,'4H'].map(tf=>[tf==='1h'?'1H':tf,[]]))};
 const day=Math.floor(clock/86400);const end=Math.min((day+4)*86400,Date.now()/1000);
 const key=`${symbol}:${day}`;if(pending.has(key))return pending.get(key);
 const task=(async()=>{
  const bars={};
  for(const tf of periods){
   const file=path.join(root,'bitfinex-cache',symbol,tf,`${day}.json.gz`);
   let rows;
   try{rows=JSON.parse(gunzipSync(await readFile(file)).toString());}catch{
    rows=await scheduledFetch(`https://api-pub.bitfinex.com/v2/candles/trade:${tf}:t${symbol}/hist?end=${Math.floor(end*1000)}&limit=10000&sort=-1`);
    await mkdir(path.dirname(file),{recursive:true});await writeFile(file,gzipSync(JSON.stringify(rows)));
   }
   bars[tf==='1h'?'1H':tf]=rows;
  }
  const grouped=new Map();for(const b of bars['1H']){const bucket=Math.floor(b[0]/14400)*14400;const old=grouped.get(bucket);if(old){old[2]=Math.max(old[2],b[2]);old[3]=Math.min(old[3],b[3]);old[4]=b[4];old[5]+=b[5];}else grouped.set(bucket,[bucket,...b.slice(1)]);}
  bars['4H']=[...grouped.values()];
  const months=new Map(); for(const b of bars['1D']){const d=new Date(b[0]*1000);const k=Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),1)/1000;const old=months.get(k);if(old){old[2]=Math.max(old[2],b[2]);old[3]=Math.min(old[3],b[3]);old[4]=b[4];old[5]+=b[5];}else months.set(k,[k,...b.slice(1)]);} bars['1M']=[...months.values()];
  return {symbol,provider:'Bitfinex',priceBasis:'USD exchange trades',timezone:'UTC',coverage:{first,last:Math.floor(end),years:[],onDemand:true},bars};
 })();pending.set(key,task);try{return await task;}finally{pending.delete(key);}
}
