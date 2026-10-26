import {afterEach,describe,expect,it,vi} from 'vitest';
import {
  deleteUserAccount,
  deleteUserSession,
  loadUserSessions,
  loadUserStrategies,
  loadUserStrategyNotes,
  purgeBrowserSensitiveStorage,
  saveUserSessions,
  saveUserStrategies,
  saveUserStrategyNotes,
} from '../storageAndAnalytics';
import {
  claimMotivation,
  motivationEnabled,
  resetMotivationVisit,
  setMotivationEnabled,
} from '../motivation';
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
   [`chartflow_chart_announcement_v1:${encodeURIComponent(email)}`,'seen'],
   [`chartflow_chart_announcement_v1:${encodeURIComponent(other)}`,'seen'],
   [`chart_flow_balance_hidden_v1:${other}`,'true'],
   [`chartflow_workspace_tour_v1:${encodeURIComponent(other)}`,'completed'],
  ]);
  vi.stubGlobal('localStorage',{getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>values.set(key,value),removeItem:(key:string)=>values.delete(key),key:(index:number)=>[...values.keys()][index]??null,get length(){return values.size;}});
  expect(deleteUserAccount(email)).toBe(true);
  expect(values.has('aurum_u_person_example_com_strategy_notes_v1')).toBe(false);
  expect(values.has(`chart_flow_balance_hidden_v1:${email}`)).toBe(false);
  expect(values.has(`chartflow_workspace_tour_v1:${encodeURIComponent(email)}`)).toBe(false);
  expect(values.has(`chartflow_chart_announcement_v1:${encodeURIComponent(email)}`)).toBe(false);
  expect(values.get(`chartflow_chart_announcement_v1:${encodeURIComponent(other)}`)).toBe('seen');
  expect(values.get(`chart_flow_balance_hidden_v1:${other}`)).toBe('true');
  expect(values.get(`chartflow_workspace_tour_v1:${encodeURIComponent(other)}`)).toBe('completed');
  expect(JSON.parse(values.get('aurum_replay_users_registry_v2')!)).toHaveLength(1);
 });

 it('remembers skip welcome messages across logins and storage purges',()=>{
  const values=new Map<string,string>();
  vi.stubGlobal('localStorage',{getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>values.set(key,value),removeItem:(key:string)=>values.delete(key),key:(index:number)=>[...values.keys()][index]??null,get length(){return values.size;}});
  const traderA='traderA@example.com';
  const traderB='traderB@example.com';

  resetMotivationVisit(traderA, false);
  expect(claimMotivation(traderA)).not.toBeNull();
  // Trader A toggles "Skip welcome messages"
  setMotivationEnabled(traderA, false);
  expect(motivationEnabled(traderA)).toBe(false);

  // Simulate subsequent login and storage sanitization
  purgeBrowserSensitiveStorage();
  resetMotivationVisit(traderA, true);
  expect(motivationEnabled(traderA)).toBe(false);
  expect(claimMotivation(traderA)).toBeNull();

  // Trader B is unaffected and still receives welcome messages
  resetMotivationVisit(traderB, false);
  expect(motivationEnabled(traderB)).toBe(true);
  expect(claimMotivation(traderB)).not.toBeNull();
 });

 it('isolates sessions, deleted sessions, strategies, notes, and journals per user',()=>{
  const values=new Map<string,string>();
  vi.stubGlobal('localStorage',{getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>values.set(key,value),removeItem:(key:string)=>values.delete(key),key:(index:number)=>[...values.keys()][index]??null,get length(){return values.size;}});
  const alice='alice@example.com';
  const bob='bob@example.com';

  // Notes isolation
  saveUserStrategyNotes(alice, 'Alice London Silver Bullet plan');
  saveUserStrategyNotes(bob, 'Bob Asian Range reversal notes');
  expect(loadUserStrategyNotes(alice).text).toBe('Alice London Silver Bullet plan');
  expect(loadUserStrategyNotes(bob).text).toBe('Bob Asian Range reversal notes');

  // Session deletion persists and does not resurrect deleted starter sessions
  const aliceInitial = loadUserSessions(alice);
  expect(aliceInitial).toHaveLength(2);
  const deletedId = aliceInitial[0].id;
  const afterFirstDelete = deleteUserSession(alice, deletedId);
  expect(afterFirstDelete).toHaveLength(1);
  expect(loadUserSessions(alice).map(s => s.id)).not.toContain(deletedId);

  // Deleting the last remaining session creates a fresh replacement session
  const lastId = afterFirstDelete[0].id;
  const afterSecondDelete = deleteUserSession(alice, lastId);
  expect(afterSecondDelete).toHaveLength(1);
  expect(afterSecondDelete[0].id).not.toBe(lastId);
  expect(afterSecondDelete[0].id).not.toBe(deletedId);

  // Journal & trade persistence on Alice's session does not leak to Bob
  const aliceSession = afterSecondDelete[0];
  aliceSession.mindsetNote = { text: 'My custom sticky plan', pinned: true, x: 20, y: 100, width: 280, height: 300 };
  aliceSession.journals = {
    'pos-1': {
      positionId: 'pos-1',
      sessionId: aliceSession.id,
      strategyTag: 'Alice Edge',
      setupTags: ['FVG'],
      entryReasoning: '15m sweep',
      exitReasoning: '2R target hit',
      notes: 'Clean execution',
      screenshots: [],
      emotionalState: 'Calm & Focused',
      checklist: [],
      lessonsLearned: 'Wait for candle close',
      rating: 5,
      updatedAt: new Date().toISOString(),
    },
  };
  saveUserSessions(alice, [aliceSession]);
  expect(loadUserSessions(alice)[0].journals?.['pos-1']?.entryReasoning).toBe('15m sweep');
  expect(loadUserSessions(alice)[0].mindsetNote?.text).toBe('My custom sticky plan');
  expect(loadUserSessions(bob)[0].journals).toBeUndefined();

  // Strategy deletion persists per user
  const aliceStrats = loadUserStrategies(alice);
  const removedStratId = aliceStrats[0].id;
  saveUserStrategies(alice, aliceStrats.slice(1));
  expect(loadUserStrategies(alice).map(s => s.id)).not.toContain(removedStratId);
  expect(loadUserStrategies(bob).map(s => s.id)).toContain(removedStratId);
 });
});
