import {beforeEach, afterEach, describe, expect, it, vi} from 'vitest';
import {createLivePaperSession} from '../livePaperTrading';
import {createDefaultSessionsForUser, saveUserSessions, loadUserSessions} from '../storageAndAnalytics';
import {advanceOrRewindSessionToTimestamp, validateAndPlaceOrder, closeOrCancelPosition, evaluateSessionAt1mTimestamp, getBidAskFromMid, getLatest1mCandleAtClock, computeLiveSessionMetrics} from '../simulationEngine';
import {TradingSession} from '../../types/trading';
const now=Date.parse('2026-10-22T10:00:00Z')/1000;
const input={symbol:'EURUSD' as const,side:'LONG' as const,orderSubType:'MARKET' as const,lotSize:0.01,stopLoss:1.09,takeProfit:1.12};
function account():TradingSession {
 const session=createLivePaperSession(createDefaultSessionsForUser('test')[0],now);
 session.activeAsset='EURUSD';session.assets=['EURUSD','GBPUSD'];
 session.liveQuotes={EURUSD:{price:1.1,time:now,receivedAt:now}};
 return session;
}
beforeEach(()=>vi.spyOn(Date,'now').mockReturnValue(now*1000));
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllGlobals()});
describe('Live paper trading',()=>{
 it('creates a separate persisted account without historical positions or challenge restrictions',()=>{
  const origin=createDefaultSessionsForUser('test')[1];const original=JSON.stringify(origin);
  const paper=createLivePaperSession(origin,now);
  expect(paper.id).not.toBe(origin.id);expect(paper.marketMode).toBe('LIVE_PAPER');
  expect(paper.mode).toBe('BACKTESTING');expect(paper.frozenConfig).toBeUndefined();
  expect(paper.positions).toEqual([]);expect(paper.realizedPnL).toBe(0);
  expect(JSON.stringify(origin)).toBe(original);
  const data=new Map<string,string>();
  vi.stubGlobal('localStorage',{getItem:(k:string)=>data.get(k)||null,setItem:(k:string,v:string)=>data.set(k,v)});
  saveUserSessions('test',[origin,paper]);
  expect(loadUserSessions('test')[1]).toEqual(JSON.parse(JSON.stringify(paper)));
 });
 it('buys at the current provider ask and uses wall time rather than the replay clock',()=>{
  const paper=account();paper.replayTimestamp=now-86400*20;
  const result=validateAndPlaceOrder(paper,input);
  expect(result.ok,result.error).toBe(true);
  expect(result.position!.entryPrice).toBe(getBidAskFromMid(1.1,'EURUSD',paper).ask);
  expect(result.position!.entryTime).toBe(now);
  expect(result.session.positions).toHaveLength(1);
 });
 it('sells at the current provider bid',()=>{
  const paper=account();
  const result=validateAndPlaceOrder(paper,{...input,side:'SHORT',stopLoss:1.12,takeProfit:1.09});
  expect(result.ok,result.error).toBe(true);
  expect(result.position!.entryPrice).toBe(getBidAskFromMid(1.1,'EURUSD',paper).bid);
 });
 it('rejects missing, stale, future, and invalid quotes without synthetic execution',()=>{
  const quotes=[undefined,{price:1.1,time:now,receivedAt:now-91},{price:1.1,time:now-1201,receivedAt:now},{price:1.1,time:now+61,receivedAt:now},{price:NaN,time:now,receivedAt:now}];
  for(const quote of quotes){const paper=account();paper.liveQuotes={EURUSD:quote};
   expect(getLatest1mCandleAtClock('EURUSD',now,paper)).toBeNull();
   expect(validateAndPlaceOrder(paper,input).ok).toBe(false);
   expect(paper.positions).toEqual([]);
  }
 });
 it('marks floating P&L using fresh quote snapshots',()=>{
  const opened=validateAndPlaceOrder(account(),input);expect(opened.ok).toBe(true);
  const session={...opened.session,liveQuotes:{EURUSD:{price:1.105,time:now+15,receivedAt:now+15}}};
  const tick=evaluateSessionAt1mTimestamp(session,now+15);
  expect(tick.session.positions![0].openFloatingPnl).toBeGreaterThan(0);
  expect(computeLiveSessionMetrics(tick.session).currentEquity).toBeGreaterThan(tick.session.startingBalance);
 });
 it('closes manually at the new provider bid and books simulated P&L',()=>{
  const opened=validateAndPlaceOrder(account(),input);
  const session={...opened.session,liveQuotes:{EURUSD:{price:1.105,time:now,receivedAt:now}}};
  const closed=closeOrCancelPosition(session,opened.position!.id);
  expect(closed.ok,closed.error).toBe(true);
  expect(closed.session.positions![0].status).toBe('CLOSED_MANUAL');
  expect(closed.session.positions![0].exitPrice).toBe(getBidAskFromMid(1.105,'EURUSD',session).bid);
  expect(closed.session.realizedPnL).toBeGreaterThan(0);
 });
 it.each([{price:1.13,status:'CLOSED_TP'},{price:1.08,status:'CLOSED_SL'}])('evaluates $status only after a new quote',({price,status})=>{
  const opened=validateAndPlaceOrder(account(),input);
  const before=evaluateSessionAt1mTimestamp(opened.session,now);
  expect(before.session.positions![0].status).toBe('OPEN');
  const after=evaluateSessionAt1mTimestamp({...before.session,liveQuotes:{EURUSD:{price,time:now+15,receivedAt:now+15}}},now+15);
  expect(after.session.positions![0].status).toBe(status);
 });
 it('triggers a pending buy limit when a new quote reaches it',()=>{
  const opened=validateAndPlaceOrder(account(),{...input,orderSubType:'BUY_LIMIT',entryPrice:1.095,stopLoss:1.08});
  expect(opened.ok,opened.error).toBe(true);expect(opened.position!.status).toBe('PENDING');
  const after=evaluateSessionAt1mTimestamp({...opened.session,liveQuotes:{EURUSD:{price:1.094,time:now+15,receivedAt:now+15}}},now+15);
  expect(after.session.positions![0].status).toBe('OPEN');
  expect(after.triggeredOrders).toHaveLength(1);
 });
 it('can cancel a pending order even while quotes are unavailable',()=>{
  const opened=validateAndPlaceOrder(account(),{...input,orderSubType:'BUY_LIMIT',entryPrice:1.095,stopLoss:1.08});
  const cancelled=closeOrCancelPosition({...opened.session,liveQuotes:{}},opened.position!.id);
  expect(cancelled.ok).toBe(true);expect(cancelled.session.positions).toEqual([]);
 });
 it('blocks manual closes without fresh quotes and blocks historical rewinds',()=>{
  const opened=validateAndPlaceOrder(account(),input);
  expect(closeOrCancelPosition({...opened.session,liveQuotes:{}},opened.position!.id).ok).toBe(false);
  const outcome=advanceOrRewindSessionToTimestamp(opened.session,now-3600);
  expect(outcome.rewindBlockedReason).toContain('Live paper');
  expect(outcome.session).toEqual(opened.session);
 });
});
