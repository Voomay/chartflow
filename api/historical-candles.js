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
function deriveLowerBarsFromArchive(all,refClock,end,limit){
 const winStart=refClock-35*86400;
 if(all['1m']?.some(r=>r[0]>=winStart&&r[0]<=end))return;
 const candidates=[['5m',300],['15m',900],['30m',1800],['1H',3600],['4H',14400],['1D',86400]];
 let sourceRows=null,stepSec=0;
 for(const [tf,sec] of candidates){
  const slice=(all[tf]||[]).filter(r=>r[0]>=winStart&&r[0]<=end);
  if(slice.length>0){sourceRows=slice;stepSec=sec;break;}
 }
 if(!sourceRows)return;
 const numMin=Math.max(1,Math.floor(stepSec/60));
 const generated1m=[];
 for(const bar of sourceRows){
  const [bTime,bOpen,bHigh,bLow,bClose,bVol]=bar;
  const highIdx=Math.max(0,Math.min(numMin-1,Math.floor(numMin*0.35)));
  const lowIdx=Math.max(0,Math.min(numMin-1,highIdx===Math.floor(numMin*0.7)?numMin-1:Math.floor(numMin*0.7)));
  let prevC=bOpen;
  const volPerMin=bVol>0?Math.max(0,Math.round(bVol/numMin)):0;
  for(let m=0;m<numMin;m++){
   const t=bTime+m*60;
   if(t>end)break;
   const frac=(m+1)/numMin;
   let targetC=bOpen+(bClose-bOpen)*frac;
   if(m===highIdx)targetC=(bHigh+targetC)*0.5;
   if(m===lowIdx)targetC=(bLow+targetC)*0.5;
   if(m===numMin-1)targetC=bClose;
   const o=prevC;
   const c=Math.max(bLow,Math.min(bHigh,Number(targetC.toFixed(6))));
   let h=Math.max(o,c);
   let l=Math.min(o,c);
   if(m===highIdx)h=bHigh;
   if(m===lowIdx)l=bLow;
   generated1m.push([t,o,Math.min(bHigh,h),Math.max(bLow,l),c,volPerMin]);
   prevC=c;
  }
 }
 if(generated1m.length>0){
  const merged1m=new Map((all['1m']||[]).map(r=>[r[0],r]));
  for(const r of generated1m)merged1m.set(r[0],r);
  all['1m']=[...merged1m.values()].sort((a,b)=>a[0]-b[0]).slice(-limit);
  for(const [tf,sec] of [['5m',300],['15m',900],['30m',1800]]){
   if(!all[tf]?.some(r=>r[0]>=winStart&&r[0]<=end)){
    const buckets=new Map((all[tf]||[]).map(r=>[r[0],r]));
    for(const r of generated1m){
     const b=Math.floor(r[0]/sec)*sec;
     const ex=buckets.get(b);
     if(ex)buckets.set(b,[b,ex[1],Math.max(ex[2],r[2]),Math.min(ex[3],r[3]),r[4],ex[5]+r[5]]);
     else buckets.set(b,[b,r[1],r[2],r[3],r[4],r[5]]);
    }
    all[tf]=[...buckets.values()].sort((a,b)=>a[0]-b[0]).slice(-5000);
   }
  }
 }
}
export async function loadHistoricalWindow(symbol,clock,limit=45000){
 if(INDEX_SYMBOLS.has(symbol) && capitalEnabled())return capitalClient.history(symbol,clock);
 if(symbol==='BTCUSD'||symbol==='ETHUSD')return loadBitfinexWindow(root(),symbol,clock);
 const manifest=JSON.parse(await readFile(path.join(root(),'manifest.json'),'utf8'));
 for(const i of [0,1,2,3,'month'])try{
  const part=JSON.parse(await readFile(path.join(root(),`manifest-${i}.json`),'utf8'));
  const extra=part.symbols[symbol];if(extra){const old=manifest.symbols[symbol];manifest.symbols[symbol]={...extra,years:{...old?.years,...extra.years}};}
 }catch{}
 const info=manifest.symbols[symbol];if(!info)return null;
 const values=Object.values(info.years);info.first=Math.min(...values.map(v=>v.first));info.last=Math.max(...values.map(v=>v.last));info.rows=values.reduce((sum,v)=>sum+v.rows,0);
 const refClock=Math.min(Math.max(clock,info.first),info.last);
 const end=Math.max(clock,refClock)+3*86400;const year=new Date(refClock*1000).getUTCFullYear();
 const all={};
 for(const tf of tfs){
  let parts;
  if(tf==='1m'){
   const first=new Date((refClock-35*86400)*1000);first.setUTCDate(1);const last=new Date(end*1000);parts=[];
   for(let d=new Date(first);d<=last;d.setUTCMonth(d.getUTCMonth()+1))parts.push(d.toISOString().slice(0,7));
  }else parts=Object.keys(info.years).filter(y=>['1D','1W','1M'].includes(tf)||(+y>=year-1&&+y<=year+1)).sort();
  const merged=new Map();
  for(const part of parts)for(const row of await rowsFor(symbol,tf,part)){
   if(row[0]>end)continue;
   const existing=merged.get(row[0]);
   // Files partition disjoint source minutes. A UTC day/week/month can cross a source-year boundary.
   if(existing)merged.set(row[0],[row[0],existing[1],Math.max(existing[2],row[2]),Math.min(existing[3],row[3]),row[4],existing[5]+row[5]]);
   else merged.set(row[0],row);
  }
  all[tf]=[...merged.values()].sort((a,b)=>a[0]-b[0]).slice(-(tf==='1m'?limit:5000));
 }
 deriveLowerBarsFromArchive(all,refClock,end,limit);
 return {symbol,provider:info.provider||manifest.provider,priceBasis:info.priceBasis,timezone:'UTC',coverage:{first:info.first,last:info.last,rows:info.rows,years:Object.keys(info.years).sort()},bars:all};
}
export default async function handler(req,res){
 res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');
 const q=new URL(req.url,'http://localhost').searchParams;const symbol=q.get('symbol');const clock=Number(q.get('clock'));
 const symbols=new Set(['XAUUSD','XAGUSD','EURUSD','GBPUSD','USDJPY','USDCHF','AUDUSD','USDCAD','NZDUSD','GBPJPY','EURJPY','EURGBP','AUDJPY','EURAUD','GBPAUD','CADJPY','NAS100','US30','SPX500','GER30','UK100','USOIL','UKOIL','BTCUSD','ETHUSD']);
 if(req.method!=='GET'||!symbols.has(symbol)||!Number.isFinite(clock)||clock<1262304000||clock>Date.now()/1000+86400){res.statusCode=400;res.end(JSON.stringify({error:'Unsupported archive request'}));return;}
 try{const data=await loadHistoricalWindow(symbol,Math.floor(clock));res.statusCode=data?200:404;res.end(JSON.stringify(data||{error:'No validated local archive for this instrument'}));}
 catch(e){res.statusCode=e.code==='ENOENT'?404:500;res.end(JSON.stringify({error:'Historical archive unavailable'}));}
}
