import { BacktestPosition, InstrumentSymbol, TradingSession } from '../types/trading';
import {calculatePositionPnl, getBidAskFromMid} from './simulationEngine';

export type TradeMood = 'waiting' | 'steady' | 'profit' | 'money' | 'loss' | 'panic' | 'stopped' | 'won' | 'closed';

export function getOpenTradeReaction(positions: BacktestPosition[]) {
  const open = positions.filter(p => p.status === 'OPEN');
  const pnl = open.reduce((sum, p) => sum + p.pnl, 0);
  const risk = open.reduce((sum, p) => sum + Math.max(0, p.initialRiskDollars ?? p.riskDollars), 0);
  const r = risk > 0 ? pnl / risk : 0;
  const mood: TradeMood = !open.length ? 'waiting' : pnl < -0.005 ? (r <= -0.5 ? 'panic' : 'loss') : pnl > 0.005 ? (r >= 1 ? 'money' : 'profit') : 'steady';
  return { count: open.length, pnl, mood };
}

// Only react to a transition observed in this mounted account/symbol view.
// Loading historical closed trades must never replay a celebration or loss.
export function getNewlyClosedTrade(previous: Map<string, string>, positions: BacktestPosition[]) {
  return positions.filter(p =>
    previous.get(p.id) === 'OPEN' && p.status.startsWith('CLOSED_')
  ).sort((a, b) => (b.exitTime ?? 0) - (a.exitTime ?? 0))[0];
}

export function getClosedTradeMood(position: BacktestPosition): TradeMood {
  return position.status === 'CLOSED_SL' ? 'stopped' : position.status === 'CLOSED_TP' ? 'won' : position.pnl < 0 ? 'loss' : 'closed';
}

// Mark the badge from the same currently displayed quote as the order ticket.
// Stored replay P&L may still refer to the previous completed minute.
export function markReactionPositions(positions: BacktestPosition[], midPrice: number | undefined, symbol: InstrumentSymbol, session?: TradingSession): BacktestPosition[] {
  if (!midPrice || !Number.isFinite(midPrice) || midPrice <= 0) return positions;
  const {bid, ask} = getBidAskFromMid(midPrice, symbol, session);
  return positions.map(position => {
    if (position.status !== 'OPEN' || (position.symbol && position.symbol !== symbol)) return position;
    const gross = calculatePositionPnl(position.side, position.entryPrice, position.side === 'LONG' ? bid : ask, position.lotSize, symbol, session);
    return {...position, pnl: Number(((position.bankedPartialPnl || 0) + gross - (position.commissionPaid || 0) - (position.slippageCost || 0)).toFixed(2))};
  });
}
