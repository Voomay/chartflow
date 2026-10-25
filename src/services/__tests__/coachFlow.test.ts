import {describe,it,expect} from 'vitest';
import {coachFlow,coachDismissDelay,CoachBubble} from '../coachFlow';
const bubble=(kind:CoachBubble['kind']):CoachBubble=>({kind,preview:false,id:1,title:'Coach',body:'Message'});
describe('Coach reflection flow',()=>{
 it('keeps a question open without a timer and queues an intervening outcome',()=>{
  const state={current:bubble('entry'),queued:null};
  const next=coachFlow(state,{type:'show',bubble:bubble('win')});
  expect(next.current?.kind).toBe('entry');expect(next.queued?.kind).toBe('win');
  expect(coachDismissDelay('entry')).toBeNull();
 });
 it('shows the No response until acknowledged, then reveals the queued result',()=>{
  const state={current:bubble('entry'),queued:bubble('loss')};
  const next=coachFlow(state,{type:'answer',bubble:bubble('reset')});
  expect(next.current?.kind).toBe('reset');expect(coachDismissDelay('reset')).toBeNull();
  expect(coachFlow(next,{type:'dismiss'}).current?.kind).toBe('loss');
 });
 it('confirms Yes before showing a queued win and disables both bubbles',()=>{
  const next=coachFlow({current:bubble('entry'),queued:bubble('win')},{type:'answer',bubble:bubble('affirm')});
  expect(next.current?.kind).toBe('affirm');expect(coachDismissDelay('affirm')).toBe(5000);
  expect(coachFlow(next,{type:'dismiss'}).current?.kind).toBe('win');
  expect(coachFlow(next,{type:'disable'})).toEqual({current:null,queued:null});
 });
 it('does not interrupt the No response when a later close arrives',()=>{
  const next=coachFlow({current:bubble('reset'),queued:null},{type:'show',bubble:bubble('loss')});
  expect(next.current?.kind).toBe('reset');expect(next.queued?.kind).toBe('loss');
 });
});
