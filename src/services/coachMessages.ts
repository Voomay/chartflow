import {MindsetMoment} from './mindsetEvents';
export type CoachMoment=MindsetMoment|'affirm'|'reset';
const phrases:Record<CoachMoment,{title:string;body:string}[]>={
 entry:[
  {title:'You’ve got this, {name}.',body:'Quick check: does this trade follow your plan?'},
  {title:'Your plan comes first, {name}.',body:'Is this the setup you were waiting for?'},
  {title:'A little check-in, {name}.',body:'Are your entry, risk and exit all in your plan?'},
  {title:'Ready and focused, {name}?',body:'Are you choosing your setup, rather than chasing the move?'},
  {title:'Let’s stay intentional, {name}.',body:'Does this trade match your rules today?'},
  {title:'One trade at a time, {name}.',body:'Feeling ready — and following your plan?'},
 ],
 reset:[
  {title:'Thanks for being honest, {name}.',body:'This trade is already open. Review your risk and exit rules. Next time, skip an entry outside your plan — a possible win is not the same as discipline.'},
  {title:'Your discipline matters, {name}.',body:'I’d pause before taking an off-plan entry. A win wouldn’t make it a disciplined decision. Since this trade is open, review your rules before your next move.'},
  {title:'Let’s come back to your rules, {name}.',body:'An off-plan trade can win and still break your process. Review your open trade against your risk and exit rules. Give your next setup time to meet your plan.'},
 ],
 affirm:[
  {title:'That’s the mindset, {name}!',body:'You’ve checked your plan. Keep your focus on the process.'},
  {title:'Love that focus, {name}.',body:'Your rules, your pace. Give the trade room to play out.'},
  {title:'You’ve got this, {name}!',body:'Keep backing your plan and respecting your risk.'},
  {title:'A good moment of discipline, {name}.',body:'Keep making thoughtful decisions, one setup at a time.'},
 ],
 win:[
  {title:'Awesome, {name}!',body:'Enjoy the win. Keep your risk steady and your plan close.'},
  {title:'Nice work, {name}!',body:'If you followed your plan, celebrate that discipline too.'},
  {title:'A win to smile about, {name}.',body:'Take the lesson with you. Let the next setup come to you.'},
  {title:'You’ve got this, {name}!',body:'Keep showing up with patience. Consistency is worth celebrating.'},
  {title:'Enjoy this moment, {name}.',body:'Stay grounded. Your next decision deserves the same care.'},
  {title:'Keep that focus, {name}!',body:'A nice result. Keep following your rules, one trade at a time.'},
 ],
 loss:[
  {title:'Take a break, {name}.',body:'You took a loss — take a break and don’t jump into another trade now. Look for your plan, trade your plan.'},
  {title:'One trade doesn’t define you, {name}.',body:'You took a loss, so take a break before your next entry. If you followed your rules, credit your discipline and trade your plan.'},
  {title:'Don’t rush the next trade, {name}.',body:'Take a break after that loss. Don’t jump into another trade now — look for your plan and trade your plan.'},
  {title:'A pause can help, {name}.',body:'There’s no need to win it back now. Take a break, look for your plan, and let your next setup come to you.'},
  {title:'Keep your perspective, {name}.',body:'A loss is a reminder to slow down, not jump into another trade. Look for your plan and trade your plan.'},
  {title:'Take a breather, {name}.',body:'You took a loss — take a break before your next decision. Check your rules, look for your plan, and trade your plan.'},
 ],
 flat:[
  {title:'A fresh moment, {name}.',body:'What did this trade teach you? Take that lesson into your next setup.'},
  {title:'Back to your plan, {name}.',body:'Keep your patience. Every decision is a chance to practise your process.'},
  {title:'Pause and refocus, {name}.',body:'Take a short break, review your rules, and look for your plan before your next trade.'},
 ],
};
export function coachName(displayName?:string){
 const name=displayName?.trim().split(/\s+/)[0];
 return !name||name.includes('@')?'trader':name.slice(0,32);
}
export function nextCoachCopy(kind:CoachMoment,displayName:string|undefined,previous?:number,random=Math.random()){
 const options=phrases[kind];
 const index=previous===undefined?Math.min(options.length-1,Math.max(0,Math.floor(random*options.length))):(previous+1)%options.length;
 const name=coachName(displayName);
 return {index,title:options[index].title.replace('{name}',name),body:options[index].body};
}
