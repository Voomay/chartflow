import {capitalEnabled,capitalClient,INDEX_SYMBOLS} from './capital-indices.js';
import {loadBitfinexWindow} from './bitfinex-history.js';
import {readFile,stat} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {gunzip} from 'node:zlib';
import {promisify} from 'node:util';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const unzip=promisify(gunzip);
const moduleDir=path.dirname(fileURLToPath(import.meta.url));
const root=()=>{
 if(process.env.ARCHIVE_DATA_DIR)return process.env.ARCHIVE_DATA_DIR;
 const cwdPath=path.join(process.cwd(),'market-data','archive');
 if(existsSync(cwdPath))return cwdPath;
 return path.resolve(moduleDir,'..','market-data','archive');
};
const tfs=['1m','5m','15m','30m','1H','4H','1D','1W','1M'];
const cache=new Map();let bytes=0;const budget=96*1024*1024;
async function rowsFor(symbol,tf,part){
 const dir=root();
 let file=path.join(dir,symbol,tf,`${part}.json.gz`);
 if(tf==='1M'&&!existsSync(file))file=path.join(dir,symbol,'1m',`${part}.json.gz`);
 try{
  const m=(await stat(file)).mtimeMs;const old=cache.get(file);
  if(old?.mtime===m){cache.delete(file);cache.set(file,old);return old.rows;}
  if(old){bytes-=old.bytes;cache.delete(file);}
  const raw=await unzip(await readFile(file));const rows=JSON.parse(raw.toString());
  while(bytes+raw.length>budget&&cache.size){const key=cache.keys().next().value;bytes-=cache.get(key).bytes;cache.delete(key);}
  if(raw.length<=budget){cache.set(file,{mtime:m,rows,bytes:raw.length});bytes+=raw.length;}
  return rows;
 }catch(e){if(e.code==='ENOENT')return [];throw e;}
}
function getSymbolDecimals(symbol){
 if(symbol?.endsWith('JPY'))return 3;
 if(['EURUSD','GBPUSD','USDCHF','AUDUSD','USDCAD','NZDUSD','EURGBP','EURAUD','GBPAUD'].includes(symbol))return 5;
 if(symbol==='XAGUSD')return 4;
 return 3;
}
function hasBarInRange(sortedRows,startInclusive,endExclusive){
 if(!sortedRows||sortedRows.length===0)return false;
 let lo=0,hi=sortedRows.length-1;
 while(lo<=hi){
  const mid=(lo+hi)>>1;
  const t=sortedRows[mid][0];
  if(t<startInclusive)lo=mid+1;
  else if(t>=endExclusive)hi=mid-1;
  else return true;
 }
 return false;
}
export function subdivideBar(bar,K,stepSec,decimals=5){
 const [bTime,bOpen,bHigh,bLow,bClose,bVol]=bar;
 const R=bHigh-bLow;
 const volPerBar=bVol>0?Math.max(0,Math.round(bVol/K)):0;
 if(K<=1||R<=1e-9){
  const out=[];
  for(let m=0;m<K;m++)out.push([bTime+m*stepSec,bOpen,bHigh,bLow,bClose,m===K-1?Math.max(0,bVol-volPerBar*(K-1)):volPerBar]);
  return out;
 }
 let seed=(Math.imul(bTime,2654435761)^Math.imul(Math.round(bOpen*10000),1597334677)^Math.imul(K,374761393))>>>0;
 if(seed===0)seed=0x9e3779b9;
 const rand=()=>{
  seed^=seed<<13;
  seed^=seed>>>17;
  seed^=seed<<5;
  return (seed>>>0)/4294967296;
 };
 const clampP=(v)=>Math.max(bLow,Math.min(bHigh,Number(v.toFixed(decimals))));
 const bullish=bClose>=bOpen;
 const pTop=Math.max(bOpen,bClose);
 const pBot=Math.min(bOpen,bClose);
 const upperGap=bHigh-pTop;
 const lowerGap=pBot-bLow;
 const needHighDetour=upperGap>0.16*R;
 const needLowDetour=lowerGap>0.16*R;
 const highTarget=bHigh-(0.06+0.14*rand())*upperGap-0.03*R;
 const lowTarget=bLow+(0.06+0.14*rand())*lowerGap+0.03*R;
 const closes=new Array(K);
 closes[K-1]=bClose;
 if(K===2){
  if(needHighDetour&&(!needLowDetour||upperGap>=lowerGap)){
   closes[0]=clampP(pTop+(0.55+0.30*rand())*upperGap);
  }else if(needLowDetour){
   closes[0]=clampP(pBot-(0.55+0.30*rand())*lowerGap);
  }else{
   closes[0]=clampP(bOpen+(0.35+0.30*rand())*(bClose-bOpen)+(rand()-0.5)*0.12*R);
  }
 }else{
  const anchors=[{idx:-1,val:bOpen}];
  if(needHighDetour&&needLowDetour){
   const lowFirst=bullish?rand()<0.65:rand()<0.35;
   const idx1=K===3?0:(rand()<0.5?0:1);
   const idx2=K===3?1:Math.min(K-2,idx1+1+(rand()<0.5?1:0));
   anchors.push({idx:idx1,val:lowFirst?lowTarget:highTarget});
   if(idx2>idx1)anchors.push({idx:idx2,val:lowFirst?highTarget:lowTarget});
  }else if(needHighDetour){
   const peakIdx=K===3?(rand()<0.5?0:1):(1+Math.floor(rand()*(K-2)));
   if(peakIdx>0&&rand()<0.5)anchors.push({idx:0,val:clampP(bOpen-(0.08+0.12*rand())*R)});
   anchors.push({idx:peakIdx,val:highTarget});
  }else if(needLowDetour){
   const troughIdx=K===3?(rand()<0.5?0:1):(1+Math.floor(rand()*(K-2)));
   if(troughIdx>0&&rand()<0.5)anchors.push({idx:0,val:clampP(bOpen+(0.08+0.12*rand())*R)});
   anchors.push({idx:troughIdx,val:lowTarget});
  }else{
   const move=bClose-bOpen;
   if(K===3){
    if(rand()<0.65){
     const c0=bOpen+(0.55+0.20*rand())*move;
     const c1=c0-(0.20+0.18*rand())*move;
     anchors.push({idx:0,val:c0},{idx:1,val:c1});
    }else{
     const c0=bOpen+(0.25+0.15*rand())*move;
     const c1=bOpen+(0.85+0.18*rand())*move;
     anchors.push({idx:0,val:c0},{idx:1,val:c1});
    }
   }else{
    const p1=bOpen+(0.42+0.18*rand())*move;
    const p2=p1-(0.16+0.16*rand())*move;
    const p3=bOpen+(0.78+0.22*rand())*move;
    if(rand()<0.5){
     anchors.push({idx:1,val:p1},{idx:2,val:p2},{idx:Math.min(K-2,3),val:p3});
    }else{
     const p0=bOpen-(0.08+0.10*rand())*move;
     anchors.push({idx:0,val:p0},{idx:Math.min(K-2,2),val:p1+0.15*move},{idx:Math.min(K-2,3),val:p2+0.20*move});
    }
   }
  }
  anchors.push({idx:K-1,val:bClose});
  for(let s=0;s<anchors.length-1;s++){
   const a0=anchors[s],a1=anchors[s+1];
   const span=Math.max(1,a1.idx-a0.idx);
   for(let m=Math.max(0,a0.idx+1);m<=a1.idx;m++){
    if(m===K-1){closes[m]=bClose;continue;}
    const frac=(m-a0.idx)/span;
    const base=a0.val+(a1.val-a0.val)*frac;
    const jitter=m===a1.idx?0:(rand()-0.5)*(0.14/Math.sqrt(K))*R;
    closes[m]=clampP(base+jitter);
   }
  }
 }
 const rawBars=[];
 let prevC=bOpen;
 let bestHighIdx=0,bestHighTop=-Infinity;
 let bestLowIdx=0,bestLowBot=Infinity;
 const minBody=R/(K*3.5);
 for(let m=0;m<K;m++){
  const o=m===0?bOpen:prevC;
  let c=m===K-1?bClose:closes[m];
  if(m<K-1&&Math.abs(c-o)<minBody){
   const dir=(bHigh-o)>(o-bLow)?1:-1;
   c=clampP(o+dir*minBody*(1.0+0.5*rand()));
  }
  const top=Math.max(o,c);
  const bot=Math.min(o,c);
  if(top>bestHighTop){bestHighTop=top;bestHighIdx=m;}
  if(bot<bestLowBot){bestLowBot=bot;bestLowIdx=m;}
  rawBars.push({t:bTime+m*stepSec,o,c,top,bot});
  prevC=c;
 }
 const out=[];
 const avgScale=R/Math.sqrt(K);
 for(let m=0;m<K;m++){
  const {t,o,c,top,bot}=rawBars[m];
  const body=Math.max(top-bot,avgScale*0.20);
  let h;
  if(m===bestHighIdx){
   h=bHigh;
  }else{
   const desiredWick=K===2&&!needHighDetour?Math.max(body*(0.20+0.45*rand()),R*(0.10+0.16*rand())):body*(0.15+0.50*rand());
   const maxAllowed=top+(bHigh-top)*(0.25+0.48*rand());
   h=clampP(Math.min(top+desiredWick,maxAllowed));
  }
  let l;
  if(m===bestLowIdx){
   l=bLow;
  }else{
   const desiredWick=K===2&&!needLowDetour?Math.max(body*(0.20+0.45*rand()),R*(0.10+0.16*rand())):body*(0.15+0.50*rand());
   const minAllowed=bot-(bot-bLow)*(0.25+0.48*rand());
   l=clampP(Math.max(bot-desiredWick,minAllowed));
  }
  h=Math.min(bHigh,Math.max(h,top));
  l=Math.max(bLow,Math.min(l,bot));
  out.push([t,o,h,l,c,m===K-1?Math.max(0,bVol-volPerBar*(K-1)):volPerBar]);
 }
 return out;
}
export function deriveLowerBarsFromArchive(all,refClock,end,limit=45000,symbol=''){
 const winStart=refClock-35*86400;
 const decimals=getSymbolDecimals(symbol);
 if(all['1D']?.length){
  if(!all['1W']?.length){
   const weeks=new Map();
   for(const b of all['1D']){
    const utcWeekDay=(new Date(b[0]*1000).getUTCDay()+6)%7;
    const wk=(Math.floor(b[0]/86400)-utcWeekDay)*86400;
    const old=weeks.get(wk);
    if(old){old[2]=Math.max(old[2],b[2]);old[3]=Math.min(old[3],b[3]);old[4]=b[4];old[5]+=b[5];}
    else weeks.set(wk,[wk,b[1],b[2],b[3],b[4],b[5]]);
   }
   all['1W']=[...weeks.values()].sort((a,b)=>a[0]-b[0]);
  }
  if(!all['1M']?.length){
   const months=new Map();
   for(const b of all['1D']){
    const d=new Date(b[0]*1000);
    const mk=Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),1)/1000;
    const old=months.get(mk);
    if(old){old[2]=Math.max(old[2],b[2]);old[3]=Math.min(old[3],b[3]);old[4]=b[4];old[5]+=b[5];}
    else months.set(mk,[mk,b[1],b[2],b[3],b[4],b[5]]);
   }
   all['1M']=[...months.values()].sort((a,b)=>a[0]-b[0]);
  }
 }
 const hierarchy=[
  ['1D',86400,'4H',14400,6,5000],
  ['4H',14400,'1H',3600,4,5000],
  ['1H',3600,'30m',1800,2,6000],
  ['30m',1800,'15m',900,2,8000],
  ['15m',900,'5m',300,3,15000],
  ['5m',300,'1m',60,5,limit],
 ];
 for(const [parentTf,parentSec,childTf,childSec,K,maxRows] of hierarchy){
  const parentRows=(all[parentTf]||[]).filter(r=>r[0]>=winStart&&r[0]<=end);
  if(!parentRows.length)continue;
  const existingChild=all[childTf]||[];
  const generated=[];
  for(const bar of parentRows){
   if(hasBarInRange(existingChild,bar[0],bar[0]+parentSec))continue;
   const subBars=subdivideBar(bar,K,childSec,decimals);
   for(const sub of subBars){
    if(sub[0]<=end)generated.push(sub);
   }
  }
  if(generated.length>0){
   const merged=new Map(existingChild.map(r=>[r[0],r]));
   for(const r of generated){
    if(!merged.has(r[0]))merged.set(r[0],r);
   }
   all[childTf]=[...merged.values()].sort((a,b)=>a[0]-b[0]).slice(-maxRows);
  }
 }
}
let cachedManifest=null,cachedManifestDir='',cachedManifestAt=0;
async function getMergedManifest(dir){
 const now=Date.now();
 if(cachedManifest&&cachedManifestDir===dir&&now-cachedManifestAt<60000)return cachedManifest;
 const manifest=JSON.parse(await readFile(path.join(dir,'manifest.json'),'utf8'));
 for(const i of [0,1,2,3,'month'])try{
  const part=JSON.parse(await readFile(path.join(dir,`manifest-${i}.json`),'utf8'));
  for(const [sym,extra] of Object.entries(part.symbols||{})){
   const old=manifest.symbols[sym];
   manifest.symbols[sym]={...extra,years:{...old?.years,...extra.years}};
  }
 }catch{}
 for(const info of Object.values(manifest.symbols||{})){
  const values=Object.values(info.years||{});
  if(values.length>0){
   info.first=Math.min(...values.map(v=>v.first));
   info.last=Math.max(...values.map(v=>v.last));
   info.rows=values.reduce((sum,v)=>sum+v.rows,0);
  }
 }
 cachedManifest=manifest;cachedManifestDir=dir;cachedManifestAt=now;
 return manifest;
}
const windowCache=new Map();const inflightWindows=new Map();
export async function loadHistoricalWindow(symbol,clock,limit=65000){
 if(INDEX_SYMBOLS.has(symbol) && capitalEnabled())return capitalClient.history(symbol,clock);
 if(symbol==='BTCUSD'||symbol==='ETHUSD')return loadBitfinexWindow(root(),symbol,clock,deriveLowerBarsFromArchive);
 const dir=root();
 const windowKey=`${dir}:${symbol}:${Math.floor(clock/60)}:${limit}`;
 const hit=windowCache.get(windowKey);
 if(hit&&Date.now()-hit.at<30000){windowCache.delete(windowKey);windowCache.set(windowKey,hit);return hit.data;}
 if(inflightWindows.has(windowKey))return inflightWindows.get(windowKey);
 const work=(async()=>{
  const manifest=await getMergedManifest(dir);
  const info=manifest.symbols[symbol];if(!info)return null;
  const refClock=Math.min(Math.max(clock,info.first),info.last);
  const min1mTime=refClock-35*86400;
  const end=Math.max(clock,refClock)+21*86400;const year=new Date(refClock*1000).getUTCFullYear();
  const all={};
  for(const tf of tfs){
   let parts;
   if(tf==='1m'){
    const first=new Date(min1mTime*1000);first.setUTCDate(1);const last=new Date(end*1000);parts=[];
    for(let d=new Date(first);d<=last;d.setUTCMonth(d.getUTCMonth()+1))parts.push(d.toISOString().slice(0,7));
   }else parts=Object.keys(info.years).filter(y=>['1D','1W','1M'].includes(tf)||(+y>=year-1&&+y<=year+1)).sort();
   const merged=new Map();
   for(const part of parts)for(const row of await rowsFor(symbol,tf,part)){
    if(row[0]>end||(tf==='1m'&&row[0]<min1mTime))continue;
    const existing=merged.get(row[0]);
    // Files partition disjoint source minutes. A UTC day/week/month can cross a source-year boundary.
    if(existing)merged.set(row[0],[row[0],existing[1],Math.max(existing[2],row[2]),Math.min(existing[3],row[3]),row[4],existing[5]+row[5]]);
    else merged.set(row[0],row);
   }
   const maxForTf=tf==='1m'?limit:tf==='5m'?15000:tf==='15m'?8000:tf==='30m'?6000:5000;
   all[tf]=[...merged.values()].sort((a,b)=>a[0]-b[0]).slice(-maxForTf);
  }
  deriveLowerBarsFromArchive(all,refClock,end,limit,symbol);
  const data={symbol,provider:info.provider||manifest.provider,priceBasis:info.priceBasis,timezone:'UTC',coverage:{first:info.first,last:info.last,rows:info.rows,years:Object.keys(info.years).sort()},bars:all};
  while(windowCache.size>=24)windowCache.delete(windowCache.keys().next().value);
  windowCache.set(windowKey,{at:Date.now(),data});
  return data;
 })();
 inflightWindows.set(windowKey,work);
 try{return await work;}finally{inflightWindows.delete(windowKey);}
}
export default async function handler(req,res){
 res.setHeader('Content-Type','application/json');
 const q=new URL(req.url,'http://localhost').searchParams;const symbol=q.get('symbol');const clock=Number(q.get('clock'));
 const symbols=new Set(['XAUUSD','XAGUSD','EURUSD','GBPUSD','USDJPY','USDCHF','AUDUSD','USDCAD','NZDUSD','GBPJPY','EURJPY','EURGBP','AUDJPY','EURAUD','GBPAUD','CADJPY','NAS100','US30','SPX500','GER30','UK100','USOIL','UKOIL','BTCUSD','ETHUSD']);
 if(req.method!=='GET'||!symbols.has(symbol)||!Number.isFinite(clock)||clock<1262304000||clock>Date.now()/1000+86400){res.setHeader('Cache-Control','no-store');res.statusCode=400;res.end(JSON.stringify({error:'Unsupported archive request'}));return;}
 try{const data=await loadHistoricalWindow(symbol,Math.floor(clock));res.setHeader('Cache-Control',data?'public, max-age=60, s-maxage=300, stale-while-revalidate=600':'no-store');res.statusCode=data?200:404;res.end(JSON.stringify(data||{error:'No validated local archive for this instrument'}));}
 catch(e){res.setHeader('Cache-Control','no-store');res.statusCode=e.code==='ENOENT'?404:500;res.end(JSON.stringify({error:'Historical archive unavailable'}));}
}
