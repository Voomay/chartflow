import { describe, expect, it } from 'vitest';
import { BacktestPosition } from '../../types/trading';
import { getClosedTradeMood, getNewlyClosedTrade, getOpenTradeReaction, markReactionPositions } from '../tradeReactions';

const trade = (values: Partial<BacktestPosition> = {}) => ({ id: 'a', status: 'OPEN', pnl: 0, initialRiskDollars: 100, riskDollars: 100, ...values } as BacktestPosition);
describe('Trade reaction states', () => {
  it('updates stale stored P&L from the displayed bid with banked partials and costs', () => {
    const position=trade({symbol:'EURUSD',side:'LONG',entryPrice:1.06974,lotSize:1,pnl:-193.5,commissionPaid:3.5,slippageCost:0});
    expect(markReactionPositions([position],1.06904,'EURUSD')[0].pnl).toBe(-77.5);
    expect(markReactionPositions([{...position,bankedPartialPnl:20}],1.06904,'EURUSD')[0].pnl).toBe(-57.5);
    expect(position.pnl).toBe(-193.5);
  });
  it('preserves closed outcomes and other instruments while valuing a short at ask', () => {
    const position=trade({symbol:'EURUSD',side:'SHORT',entryPrice:1.07,lotSize:1,commissionPaid:0});
    expect(markReactionPositions([position],1.06904,'EURUSD')[0].pnl).toBe(92);
    const closed=trade({status:'CLOSED_SL',pnl:-50});
    expect(markReactionPositions([closed],1.06904,'EURUSD')[0]).toBe(closed);
    expect(markReactionPositions([position],undefined,'EURUSD')[0]).toBe(position);
  });
  it('uses only executed open trades, with profit and panic relative to initial risk', () => {
    expect(getOpenTradeReaction([trade({ status: 'PENDING', pnl: 500 })]).mood).toBe('waiting');
    expect(getOpenTradeReaction([trade({ pnl: 10 })]).mood).toBe('profit');
    expect(getOpenTradeReaction([trade({ pnl: 100, riskDollars: 0 })]).mood).toBe('money');
    expect(getOpenTradeReaction([trade({ pnl: -49 })]).mood).toBe('loss');
    expect(getOpenTradeReaction([trade({ pnl: -50 })]).mood).toBe('panic');
    expect(getOpenTradeReaction([trade()]).mood).toBe('steady');
  });
  it('sums actual account-currency net P&L including mixed positions', () => {
    expect(getOpenTradeReaction([trade({ pnl: 120 }), trade({ id: 'b', pnl: -30 }), trade({ status: 'CLOSED_TP', pnl: 400 })])).toMatchObject({ count: 2, pnl: 90, mood: 'profit' });
  });
  it('does not replay historical or cancelled trades and chooses the latest new close', () => {
    const stopped = trade({ status: 'CLOSED_SL', exitTime: 20 });
    expect(getNewlyClosedTrade(new Map(), [stopped])).toBeUndefined();
    expect(getNewlyClosedTrade(new Map([['a', 'CLOSED_SL']]), [stopped])).toBeUndefined();
    expect(getNewlyClosedTrade(new Map([['a', 'OPEN']]), [trade({ status: 'CANCELLED' })])).toBeUndefined();
    expect(getNewlyClosedTrade(new Map([['a', 'OPEN'], ['b', 'OPEN']]), [stopped, trade({ id: 'b', status: 'CLOSED_TP', exitTime: 21 })])?.id).toBe('b');
  });
  it('uses execution reason for stop-loss and take-profit reactions', () => {
    expect(getClosedTradeMood(trade({ status: 'CLOSED_SL', pnl: 5 }))).toBe('stopped');
    expect(getClosedTradeMood(trade({ status: 'CLOSED_TP' }))).toBe('won');
    expect(getClosedTradeMood(trade({ status: 'CLOSED_MANUAL', pnl: -1 }))).toBe('loss');
  });
});
