import {CoachMoment} from './coachMessages';
export type CoachBubble={kind:CoachMoment;preview:boolean;id:number;title:string;body:string};
export type CoachFlow={current:CoachBubble|null;queued:CoachBubble|null};
export type CoachAction={type:'show'|'answer'|'preview';bubble:CoachBubble}|{type:'dismiss'}|{type:'disable'};
export function coachFlow(state:CoachFlow,action:CoachAction):CoachFlow{
 if(action.type==='disable')return {current:null,queued:null};
 if(action.type==='dismiss')return {current:state.queued,queued:null};
 if(action.type==='preview')return {current:action.bubble,queued:null};
 if(action.type==='answer')return {...state,current:action.bubble};
 // Keep the entry question until a deliberate response, even if replay closes the trade.
 if(action.bubble.kind==='entry')return {...state,current:action.bubble};
 if(state.current && ['entry','reset','affirm'].includes(state.current.kind))return {...state,queued:action.bubble};
 return {...state,current:action.bubble};
}
export function coachDismissDelay(kind:CoachMoment):number|null{
 return kind==='entry'||kind==='reset'?null:kind==='affirm'?5000:9500;
}
