import {BacktestPosition} from '../types/trading';
export type MindsetMoment = 'entry' | 'win' | 'loss' | 'flat';
type Position = Pick<BacktestPosition,'id'|'status'|'pnl'|'exitTime'>;
export type MindsetPreferences = {enabled:boolean;celebrate:boolean};
export function createMindsetTracker(positions:Position[], clock:number) {
  return {clock, previous:new Map(positions.map(p=>[p.id,p.status])), seen:new Set(positions.map(p=>`${p.id}:${p.status}`)), lastEntry:-Infinity};
}
// One bubble per update; entry check-ins never suppress a subsequent close.
export function nextMindsetMoment(state:ReturnType<typeof createMindsetTracker>,positions:Position[],clock:number,prefs:MindsetPreferences,now:number):MindsetMoment|null {
  const rewound=clock<state.clock;
  let entered=false;
  const closes:Position[]=[];
  for(const p of positions) {
    const key=`${p.id}:${p.status}`;
    if(state.previous.get(p.id)!==p.status && !state.seen.has(key)) {
      state.seen.add(key);
      if(p.status.startsWith('CLOSED_') && state.previous.has(p.id))closes.push(p);
      if((p.status==='OPEN' && !state.seen.has(`${p.id}:PENDING`)) || p.status==='PENDING')entered=true;
    }
  }
  state.previous=new Map(positions.map(p=>[p.id,p.status]));state.clock=clock;
  if(rewound)return null;
  const closed=closes.sort((a,b)=>(b.exitTime||0)-(a.exitTime||0)).find(p=>p.pnl>0?prefs.celebrate:prefs.enabled);
  if(closed)return closed.pnl>0?'win':closed.pnl<0?'loss':'flat';
  if(entered && prefs.enabled){state.lastEntry=now;return 'entry';}
  return null;
}
export type NoteBounds={x:number;y:number;width:number;height:number};
export function fitMindsetNote(note:NoteBounds,viewport:{width:number;height:number}):NoteBounds {
  const width=Math.max(Math.min(200,viewport.width-16),Math.min(note.width,viewport.width-16));
  const height=Math.max(Math.min(150,viewport.height-92),Math.min(note.height,viewport.height-92));
  return {width,height,x:Math.max(8,Math.min(note.x,viewport.width-width-8)),y:Math.max(52,Math.min(note.y,viewport.height-height-40))};
}
