import {describe,it,expect} from 'vitest';
import {coachName,nextCoachCopy,CoachMoment} from '../coachMessages';
describe('Personal coach messages',()=>{
 it('uses a profile first name without deriving names from email addresses',()=>{
  expect(coachName('  Ayanda Mokoena  ')).toBe('Ayanda');
  expect(coachName('person@example.com')).toBe('trader');
  expect(coachName('')).toBe('trader');
 });
 it('rotates phrases for every event and personalizes without gendered terms',()=>{
  for(const kind of ['entry','affirm','reset','win','loss','flat'] as CoachMoment[]){
   let previous:number|undefined;const copy=new Set<string>();
   for(let i=0;i<3;i++){
    const next=nextCoachCopy(kind,'Ayanda Mokoena',previous,0);previous=next.index;
    expect(next.title).toContain('Ayanda');expect(next.title+next.body).not.toMatch(/\b(bro|sir|madam|headspace)\b/i);
    copy.add(next.title);
   }
   expect(copy.size).toBe(3);
  }
 });
 it('makes the No response honest about the already open trade',()=>{
  const copy=nextCoachCopy('reset','Sam',undefined,0);
  expect(copy.body).toContain('already open');expect(copy.body).toContain('discipline');
 });
 it('encourages discipline without assuming a win proves plan adherence',()=>{
  const copy=nextCoachCopy('win','Sam',0);
  expect(copy.body).toContain('If you followed your plan');
 });
 it('encourages taking a break and trading the plan after a loss instead of saying reset',()=>{
  let previous:number|undefined;
  for(let i=0;i<6;i++){
   const copy=nextCoachCopy('loss','Sam',previous,0);previous=copy.index;
   expect(copy.title+copy.body).not.toMatch(/\breset\b/i);
   expect(copy.title+copy.body).toMatch(/break|pause|slow down/i);
   expect(copy.body).toMatch(/plan/i);
  }
 });
});
