import {InstrumentSymbol} from '../types/trading';

// All 25 instruments now have validated local historical replay archives installed.
export const isInstrumentComingSoon=(_symbol:InstrumentSymbol)=>false;
const names:Partial<Record<InstrumentSymbol,string>>={NAS100:'Nasdaq 100',SPX500:'S&P 500',US30:'Dow Jones 30',GER30:'Germany 40 / DAX',UK100:'FTSE 100',USOIL:'WTI Crude Oil',UKOIL:'Brent Crude Oil'};
export const instrumentDisplayName=(symbol:InstrumentSymbol,fallback:string)=>names[symbol]||fallback.replace(/\s*\([^)]*\)/g,'').trim();
export function compactChartClock(timestamp:number,timezone:string){
 const parts=new Intl.DateTimeFormat('en-GB',{timeZone:timezone,day:'2-digit',month:'short',year:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(timestamp*1000));
 const part=(type:string)=>parts.find(value=>value.type===type)?.value||'';
 return `${part('day')} ${part('month')} ${part('year')} · ${part('hour')}:${part('minute')}`;
}
