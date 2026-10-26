import {describe,it,expect} from 'vitest';
import {createMindsetTracker,nextMindsetMoment,fitMindsetNote} from '../mindsetEvents';
import {BacktestPosition} from '../../types/trading';
const p=(id:string,status:BacktestPosition['status'],pnl=0,exitTime=0)=>({id,status,pnl,exitTime});
describe('Optional mindset lifecycle',()=>{
  it('celebrates a win even with entry reminders off',()=>{
    const state=createMindsetTracker([p('a','OPEN')],10);
    expect(nextMindsetMoment(state,[p('a','CLOSED_TP',100)],11,{enabled:false,celebrate:true},100)).toBe('win');
  });
  it('checks each entry without swallowing a quick winning close',()=>{
    const state=createMindsetTracker([],10),prefs={enabled:true,celebrate:true};
    expect(nextMindsetMoment(state,[p('a','OPEN')],11,prefs,100)).toBe('entry');
    expect(nextMindsetMoment(state,[p('a','CLOSED_MANUAL',50)],12,prefs,200)).toBe('win');
    expect(nextMindsetMoment(state,[p('a','CLOSED_MANUAL',50),p('b','OPEN')],13,prefs,300)).toBe('entry');
  });
  it('triggers entry check-in when placing a pending limit or stop order',()=>{
    const state=createMindsetTracker([],10),prefs={enabled:true,celebrate:true};
    expect(nextMindsetMoment(state,[p('limit-1','PENDING')],11,prefs,100)).toBe('entry');
    expect(nextMindsetMoment(state,[p('limit-1','OPEN')],12,prefs,200)).toBeNull();
    expect(nextMindsetMoment(state,[p('limit-1','OPEN'),p('stop-1','PENDING')],13,prefs,300)).toBe('entry');
  });
  it('respects disabled celebrations and loss reminders',()=>{
    const state=createMindsetTracker([p('a','OPEN'),p('b','OPEN')],10);
    expect(nextMindsetMoment(state,[p('a','CLOSED_TP',100),p('b','CLOSED_SL',-100)],11,{enabled:false,celebrate:false},100)).toBeNull();
  });
  it('does not replay old results on load, rewind or repeated updates',()=>{
    const state=createMindsetTracker([p('a','CLOSED_TP',100)],20),prefs={enabled:true,celebrate:true};
    expect(nextMindsetMoment(state,[p('a','CLOSED_TP',100)],20,prefs,100)).toBeNull();
    expect(nextMindsetMoment(state,[p('a','OPEN')],10,prefs,200)).toBeNull();
    expect(nextMindsetMoment(state,[p('a','CLOSED_TP',100)],20,prefs,300)).toBeNull();
  });
  it('coalesces multiple closes into one latest outcome',()=>{
    const state=createMindsetTracker([p('a','OPEN'),p('b','OPEN')],10);
    expect(nextMindsetMoment(state,[p('a','CLOSED_SL',-10,12),p('b','CLOSED_TP',10,15)],15,{enabled:true,celebrate:true},100)).toBe('win');
  });
  it('ignores hydrated history but celebrates pending orders that fill and close between updates',()=>{
    const state=createMindsetTracker([p('a','PENDING')],10),prefs={enabled:true,celebrate:true};
    expect(nextMindsetMoment(state,[p('a','PENDING'),p('old','CLOSED_TP',100,2)],11,prefs,100)).toBeNull();
    expect(nextMindsetMoment(state,[p('a','CLOSED_TP',20,12),p('old','CLOSED_TP',100,2)],12,prefs,200)).toBe('win');
  });
  it('keeps resized notes inside desktop and phone viewports',()=>{
    expect(fitMindsetNote({x:1200,y:800,width:500,height:400},{width:1280,height:900})).toEqual({x:772,y:460,width:500,height:400});
    expect(fitMindsetNote({x:500,y:900,width:900,height:900},{width:390,height:844})).toEqual({x:8,y:52,width:374,height:752});
  });
});
