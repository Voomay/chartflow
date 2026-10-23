import { Candle, InstrumentSymbol } from '../types/trading';
import { hasHistoricalArchive, extendHistoricalCandles, setLiveHistoricalCandles, setHistoricalCandles } from './goldDataService';

const pending=new Map<string,Promise<boolean>>();
const liveLoadedDays=new Set<string>();
export async function hydrateLiveHistoricalArchive(symbol:InstrumentSymbol,clock:number):Promise<boolean> {
  const key=`${symbol}:${Math.floor(clock/86400)}`;
  if(liveLoadedDays.has(key))return true;
  const loaded=await hydrateHistoricalArchive(symbol,clock,'live');
  if(loaded)liveLoadedDays.add(key);
  return loaded;
}
export async function hydrateHistoricalArchive(symbol: InstrumentSymbol, clock: number, mode: 'replay'|'live'|'extend' = 'replay'): Promise<boolean> {
  const key=`${mode}:${symbol}:${Math.floor(clock/86400)}`;
  if(pending.has(key))return pending.get(key)!;
  const task=(async()=>{
    try {
      const response=await fetch(`/api/historical-candles?symbol=${symbol}&clock=${Math.floor(clock)}`,{signal:AbortSignal.timeout(45000)});
      if(!response.ok)return false;
      const data=await response.json();
      if(data.symbol!==symbol||data.timezone!=='UTC'||!data.bars||!data.coverage)return false;
      const parsed:Record<string,Candle[]>={};
      for(const [tf,rows] of Object.entries(data.bars)){
        if(!Array.isArray(rows))throw Error('Invalid archive');
        parsed[tf]=rows.map((row:any)=>{
          if(!Array.isArray(row)||row.length!==6||!row.every(Number.isFinite)||row[0]%60||row.slice(1,5).some((v:number)=>v<=0)||row[2]<Math.max(row[1],row[4])||row[3]>Math.min(row[1],row[4])||row[2]<row[3]||row[5]<0)throw Error('Invalid archive candle');
          return {time:row[0],open:row[1],high:row[2],low:row[3],close:row[4],volume:row[5]};
        });
      }
      const label=`${data.provider} · ${data.priceBasis} archive · UTC`;
      if(mode==='live')setLiveHistoricalCandles(symbol,parsed,label);
      else if(mode==='extend' && hasHistoricalArchive(symbol))extendHistoricalCandles(symbol,parsed);
      else setHistoricalCandles(symbol,parsed,`${label} · source gaps retained`,data.coverage.first,data.coverage.last);
      return true;
    }catch{return false;}
  })();
  pending.set(key,task);try{return await task;}finally{pending.delete(key);}
}
