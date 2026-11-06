import {readFile,writeFile,mkdir,readdir,stat} from 'node:fs/promises';
import {gzipSync,gunzipSync,gunzip} from 'node:zlib';
import {promisify} from 'node:util';
import path from 'node:path';
const unzipAsync=promisify(gunzip);
const pending=new Map();const windowCache=new Map();const fileCache=new Map();const dirListCache=new Map();
let queue=Promise.resolve();let lastRequest=0;
const periods=['1m','5m','15m','30m','1h','1D','1W'];
async function readCachedGzRows(filePath){
 try{
  const st=await stat(filePath);
  const old=fileCache.get(filePath);
  if(old&&old.mtime===st.mtimeMs)return old.rows;
  const raw=await unzipAsync(await readFile(filePath));
  const rows=JSON.parse(raw.toString());
  if(fileCache.size>=600)fileCache.delete(fileCache.keys().next().value);
  fileCache.set(filePath,{mtime:st.mtimeMs,rows});
  return rows;
 }catch{return null;}
}
async function listCachedDir(tfDir){
 const now=Date.now();
 const hit=dirListCache.get(tfDir);
 if(hit&&now-hit.at<60000)return hit.files;
 try{
  const files=(await readdir(tfDir)).filter(f=>f.endsWith('.json.gz'));
  dirListCache.set(tfDir,{at:now,files});
  return files;
 }catch{return [];}
}
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
 const key=`${root}:${symbol}:${day}`;
 const cachedWin=windowCache.get(key);
 if(cachedWin&&Date.now()-cachedWin.at<600000)return cachedWin.data;
 if(pending.has(key))return pending.get(key);
 const task=(async()=>{
  const bars={};
  const maxDaySpanByTf={'1m':45,'5m':75,'15m':140,'30m':250,'1h':450,'1D':10000,'1W':10000};
  await Promise.all(periods.map(async(tf)=>{
   const tfDir=path.join(root,'bitfinex-cache',symbol,tf);
   const file=path.join(tfDir,`${day}.json.gz`);
   const merged=new Map();
   let hasExactDayFile=false;
   const exactRows=await readCachedGzRows(file);
   if(exactRows){
    for(const r of exactRows)if(r[0]<=end)merged.set(r[0],r);
    hasExactDayFile=true;
   }
   const allFiles=await listCachedDir(tfDir);
   const span=maxDaySpanByTf[tf]||120;
   const candidateFiles=allFiles.filter(f=>{
    if(f===`${day}.json.gz`)return false;
    const fDay=Number(f.replace('.json.gz',''));
    if(!Number.isFinite(fDay))return true;
    return fDay>=day-span&&fDay<=day+span;
   });
   const filesToRead=candidateFiles.length>0?candidateFiles:allFiles.slice(-4);
   const extraBatches=await Promise.all(filesToRead.map(f=>readCachedGzRows(path.join(tfDir,f))));
   for(const extra of extraBatches){
    if(!extra)continue;
    for(const r of extra)if(r[0]<=end)merged.set(r[0],r);
   }
   let hasCoverageNearClock=false;
   for(const t of merged.keys()){
    if(t>=clock-14*86400&&t<=clock+7*86400){hasCoverageNearClock=true;break;}
   }
   if(!hasExactDayFile&&!hasCoverageNearClock&&allFiles.length===0){
    try{
     const fetched=await scheduledFetch(`https://api-pub.bitfinex.com/v2/candles/trade:${tf}:t${symbol}/hist?end=${Math.floor(end*1000)}&limit=10000&sort=-1`);
     for(const r of fetched)if(r[0]<=end)merged.set(r[0],r);
     try{
      await mkdir(tfDir,{recursive:true});
      await writeFile(file,gzipSync(JSON.stringify(fetched)));
      dirListCache.delete(tfDir);
     }catch{}
    }catch{}
   }
   const maxForTf=tf==='1m'?45000:tf==='5m'?15000:10000;
   bars[tf==='1h'?'1H':tf]=[...merged.values()].sort((a,b)=>a[0]-b[0]).slice(-maxForTf);
  }));
  const grouped=new Map();for(const b of bars['1H']){const bucket=Math.floor(b[0]/14400)*14400;const old=grouped.get(bucket);if(old){old[2]=Math.max(old[2],b[2]);old[3]=Math.min(old[3],b[3]);old[4]=b[4];old[5]+=b[5];}else grouped.set(bucket,[bucket,...b.slice(1)]);}
  bars['4H']=[...grouped.values()];
  const months=new Map();for(const b of bars['1D']){const d=new Date(b[0]*1000);const k=Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),1)/1000;const old=months.get(k);if(old){old[2]=Math.max(old[2],b[2]);old[3]=Math.min(old[3],b[3]);old[4]=b[4];old[5]+=b[5];}else months.set(k,[k,...b.slice(1)]);}
  bars['1M']=[...months.values()];
  if(typeof deriveFn==='function')deriveFn(bars,clock,end,45000,symbol);
  const data={symbol,provider:'Bitfinex',priceBasis:'USD exchange trades',timezone:'UTC',coverage:{first,last:Math.floor(end),years:[],onDemand:true},bars};
  if(windowCache.size>=32)windowCache.delete(windowCache.keys().next().value);
  windowCache.set(key,{at:Date.now(),data});
  return data;
 })();pending.set(key,task);try{return await task;}finally{pending.delete(key);}
}
