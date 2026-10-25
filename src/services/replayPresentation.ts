import type {Candle} from '../types/trading';

// Presentation only: ease between two already-revealed snapshots of the same bar.
// Never used by order fills, account metrics, the replay clock or saved history.
export function interpolateRevealedCandle(from:Candle,to:Candle,progress:number):Candle {
  const t=Math.max(0,Math.min(1,progress));
  if(t===1||from.time!==to.time)return {...to};
  const ease=t*t*(3-2*t);
  const mix=(a:number,b:number)=>a+(b-a)*ease;
  const close=mix(from.close,to.close),open=to.open;
  return {...to,open,close,high:Math.max(open,close,mix(from.high,to.high)),low:Math.min(open,close,mix(from.low,to.low)),volume:mix(from.volume,to.volume)};
}

export function revealedHistorySamplesMatch(previous:{length:number;firstClose:number;midClose:number},candles:Candle[]):boolean {
  const oldMiddle=Math.floor(previous.length/2);
  // Compare the old sample index, not a newly shifted midpoint after appending.
  // An active final candle is allowed to develop and is never a history sample.
  return (previous.length<2||previous.firstClose===candles[0]?.close)&&
    (oldMiddle>=previous.length-1||previous.midClose===candles[oldMiddle]?.close);
}
