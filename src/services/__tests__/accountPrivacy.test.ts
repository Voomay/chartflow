import {afterEach,describe,expect,it,vi} from 'vitest';
import {deleteUserAccount} from '../storageAndAnalytics';
afterEach(()=>vi.unstubAllGlobals());
describe('Account-scoped privacy controls',()=>{
 it('removes local notes, balance masking and tour metadata without removing another account’s preferences',()=>{
  const email='person@example.com',other='other@example.com';
  const values=new Map<string,string>([
   ['aurum_replay_users_registry_v2',JSON.stringify([{id:'a',email,name:'Person'},{id:'b',email:other,name:'Other'}])],
   ['aurum_replay_active_user_v2',JSON.stringify({email})],
   ['aurum_u_person_example_com_strategy_notes_v1','private notes'],
   [`chart_flow_balance_hidden_v1:${email}`,'true'],
   [`chartflow_workspace_tour_v1:${encodeURIComponent(email)}`,'completed'],
   [`chart_flow_balance_hidden_v1:${other}`,'true'],
   [`chartflow_workspace_tour_v1:${encodeURIComponent(other)}`,'completed'],
  ]);
  vi.stubGlobal('localStorage',{getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>values.set(key,value),removeItem:(key:string)=>values.delete(key),key:(index:number)=>[...values.keys()][index]??null,get length(){return values.size;}});
  expect(deleteUserAccount(email)).toBe(true);
  expect(values.has('aurum_u_person_example_com_strategy_notes_v1')).toBe(false);
  expect(values.has(`chart_flow_balance_hidden_v1:${email}`)).toBe(false);
  expect(values.has(`chartflow_workspace_tour_v1:${encodeURIComponent(email)}`)).toBe(false);
  expect(values.get(`chart_flow_balance_hidden_v1:${other}`)).toBe('true');
  expect(values.get(`chartflow_workspace_tour_v1:${encodeURIComponent(other)}`)).toBe('completed');
  expect(JSON.parse(values.get('aurum_replay_users_registry_v2')!)).toHaveLength(1);
 });
});
