import {InstrumentSymbol, Timeframe, Candle} from '../types/trading';
import {parseSpotBars, setBrokerQuote, spotInterval} from './spotFeed';
export const INDEX_CFD_SYMBOLS = new Set<InstrumentSymbol>(['US30','NAS100','UK100','GER30']);
export async function fetchIndexCandles(symbol:InstrumentSymbol,timeframe:Timeframe,limit:number):Promise<{configured:boolean;bars:Candle[]|null}> {
  if (typeof window === 'undefined' || typeof window.document === 'undefined') return {configured:false,bars:null};
  try {
    const response=await fetch(`/api/index-candles?symbol=${symbol}&interval=${spotInterval(timeframe)}&limit=${Math.min(1000,limit)}`,{signal:AbortSignal.timeout(20000)});
    if(response.status===409)return {configured:false,bars:null};
    if(!response.ok)return {configured:true,bars:null};
    const data=await response.json();
    if(data.symbol!==symbol || data.interval!==spotInterval(timeframe) || data.provider!=='Capital.com demo' || data.priceBasis!=='bid' || data.quote?.symbol!==symbol) return {configured:true,bars:null};
    const quote=data.quote, time=Date.parse(quote.timestamp)/1000,now=Date.now()/1000;
    if(!Number.isFinite(time)||time>now+5||![quote.bid,quote.ask].every(v=>typeof v==='number'&&Number.isFinite(v)&&v>0)||quote.ask<quote.bid || (quote.marketState!=='closed'&&(now-time>60||quote.stale)))return {configured:true,bars:null};
    const bars=parseSpotBars(data.bars);if(!bars.length)return {configured:true,bars:null};
    setBrokerQuote(symbol,{price:quote.bid,time,receivedAt:now,source:'Capital.com demo · index CFD · bid',maxAgeSeconds:60,marketState:quote.marketState});
    return {configured:true,bars};
  } catch { return {configured:true,bars:null}; }
}
