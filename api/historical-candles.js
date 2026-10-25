import {capitalEnabled,capitalClient,INDEX_SYMBOLS} from './capital-indices.js';
import {loadBitfinexWindow} from './bitfinex-history.js';
import {readFile,stat} from 'node:fs/promises';
import {gunzip} from 'node:zlib';
import {promisify} from 'node:util';
import path from 'node:path';
const unzip=promisify(gunzip);
const root=()=>process.env.ARCHIVE_DATA_DIR || path.join(process.cwd(),'market-data','archive');
const tfs=['1m','5m','15m','30m','1H','4H','1D','1W','1M'];
const cache=new Map();let bytes=0;const budget=96*1024*1024;
async function rowsFor(symbol,tf,part){
 const file=path.join(root(),symbol,tf,`${part}.json.gz`);
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
