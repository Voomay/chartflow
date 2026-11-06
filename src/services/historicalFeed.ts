import { Candle, InstrumentSymbol } from '../types/trading';
import { hasHistoricalArchive, getLoadedHistorical1mRangeForClock, extendHistoricalCandles, setLiveHistoricalCandles, setHistoricalCandles } from './goldDataService';

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
  if ((mode === 'replay' || mode === 'extend') && hasHistoricalArchive(symbol)) {
    const existingRange = getLoadedHistorical1mRangeForClock(symbol, clock);
    if (existingRange && clock >= existingRange[0] + 7 * 86400 && clock <= existingRange[1] - 3 * 86400) {
      return true;
    }
  }
  const bucketKey = `${mode === 'extend' ? 'replay' : mode}:${symbol}:${Math.floor(clock/21600)}`;
  if(pending.has(bucketKey))return pending.get(bucketKey)!;
  const task=(async()=>{
    try {
      const response=await fetch(`/api/historical-candles?symbol=${symbol}&clock=${Math.floor(clock)}`,{signal:AbortSignal.timeout(45000)});
      if(!response.ok)return false;
      const data=await response.json();
      if(data.symbol!==symbol||data.timezone!=='UTC'||!data.bars||!data.coverage)return false;
      const parsed:Record<string,Candle[]>={};
      for(const [tf,rows] of Object.entries(data.bars)){
        if(!Array.isArray(rows))throw Error('Invalid archive');
        const len=rows.length;
        const out=new Array<Candle>(len);
        for(let i=0;i<len;i++){
          const row=rows[i] as any;
          if(!Array.isArray(row)||row.length!==6)throw Error('Invalid archive candle');
          const t=row[0],o=row[1],h=row[2],l=row[3],c=row[4],v=row[5];
          if(!Number.isFinite(t)||!Number.isFinite(o)||!Number.isFinite(h)||!Number.isFinite(l)||!Number.isFinite(c)||!Number.isFinite(v)||t%60||o<=0||h<=0||l<=0||c<=0||h<Math.max(o,c)||l>Math.min(o,c)||h<l||v<0)throw Error('Invalid archive candle');
          out[i]={time:t,open:o,high:h,low:l,close:c,volume:v};
        }
        parsed[tf]=out;
      }
      const label=`${data.provider} · ${data.priceBasis} archive · UTC`;
      if(mode==='live')setLiveHistoricalCandles(symbol,parsed,label);
      else if(mode==='extend' && hasHistoricalArchive(symbol))extendHistoricalCandles(symbol,parsed);
      else setHistoricalCandles(symbol,parsed,`${label} · source gaps retained`,data.coverage.first,data.coverage.last);
      return true;
    }catch{return false;}
  })();
  pending.set(bucketKey,task);try{return await task;}finally{pending.delete(bucketKey);}
}
