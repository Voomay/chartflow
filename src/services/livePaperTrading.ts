import {TradingSession} from '../types/trading';
import {createInitialChallengeState} from './simulationEngine';

export function createLivePaperSession(origin: TradingSession, now = Math.floor(Date.now() / 1000)): TradingSession {
  const date = new Date(now * 1000).toISOString();
  return {
    ...JSON.parse(JSON.stringify(origin)),
    id: 'live-paper-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8),
    name: 'Live Paper Trading', marketMode: 'LIVE_PAPER', paperOriginSessionId: origin.id,
    mode: 'BACKTESTING', status: 'ACTIVE', startingBalance: origin.startingBalance,
    startDate: date.slice(0, 10), endDate: new Date((now + 366 * 86400) * 1000).toISOString().slice(0,10),
    startTimestamp: now, endTimestamp: now + 366 * 86400, replayTimestamp: now,
    autoUpdateEndDate: true, frozenConfig: undefined, createdAt: date, updatedAt: date,
    realizedPnL: 0, positions: [], orders: [], fills: [], tradeEvents: [], liveQuotes: {},
    journals: {}, equitySnapshots: [], replayCheckpoints: [], drawingsBySymbol: {},
    challengeState: createInitialChallengeState(origin.startingBalance, now, origin.propFirmRules),
    previousAttempts: [], parentChallengeId: undefined, attemptNumber: 1, failReason: undefined, passedAt: undefined,
  };
}
