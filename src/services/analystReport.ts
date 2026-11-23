import { BacktestPosition, AccountCurrency } from '../types/trading';
import { ComputedAnalyticsReport } from './storageAndAnalytics';
import { formatMoney } from './simulationEngine';
import { coachName } from './coachMessages';

export type AnalystInsightSeverity = 'CRITICAL' | 'IMPROVE' | 'STRENGTH';

export interface AnalystInsight {
  id: string;
  category:
    | 'OVERTRADING'
    | 'REVENGE_TRADING'
    | 'RISK_REWARD'
    | 'DIRECTION'
    | 'INSTRUMENT'
    | 'STREAK';
  severity: AnalystInsightSeverity;
  title: string;
  summary: string;
  metricBadge: string;
}

export interface OneTradePerDayComparison {
  totalDays: number;
  multiTradeDays: number;
  firstTradeStats: {
    trades: number;
    wins: number;
    losses: number;
    breakevens: number;
    winRatePct: number | null;
    netPnl: number;
  };
  extraTradeStats: {
    trades: number;
    wins: number;
    losses: number;
    breakevens: number;
    winRatePct: number | null;
    netPnl: number;
  };
  actualStats: {
    trades: number;
    wins: number;
    losses: number;
    breakevens: number;
    winRatePct: number | null;
    netPnl: number;
  };
  wouldHaveMoreWinsThanLosses: boolean;
  wouldImprovePnl: boolean;
}

export interface AnalystReport {
  traderName: string;
  headline: string;
  subheadline: string;
  mood: 'win' | 'loss' | 'idle';
  oneTradePerDay: OneTradePerDayComparison;
  insights: AnalystInsight[];
}

function calcWinRate(wins: number, losses: number): number | null {
  const decided = wins + losses;
  return decided > 0 ? (wins / decided) * 100 : null;
}

function fmtPct(v: number | null): string {
  return v === null ? '—' : `${v.toFixed(0)}%`;
}

function getTradeDayKey(trade: BacktestPosition): string {
  const ts = trade.entryTime || trade.exitTime || 0;
  return new Date(ts * 1000).toISOString().slice(0, 10);
}

/**
 * Computes a deterministic, data-driven Analyst Report directly from closed-trade analytics.
 * No external AI/LLM is used — every pointer is derived from exact trade history.
 */
export function generateAnalystReport(
  report: ComputedAnalyticsReport,
  displayName?: string
): AnalystReport {
  const name = coachName(displayName);
  const currency: AccountCurrency = report.accountCurrency;
  const trades = [...report.filteredClosedTrades].sort(
    (a, b) => (a.entryTime || a.exitTime || 0) - (b.entryTime || b.exitTime || 0)
  );

  // 1. Group by trading day for 1-Trade-a-Day counterfactual
  const byDay = new Map<string, BacktestPosition[]>();
  for (const t of trades) {
    const key = getTradeDayKey(t);
    const list = byDay.get(key) || [];
    list.push(t);
    byDay.set(key, list);
  }

  let firstWins = 0;
  let firstLosses = 0;
  let firstBE = 0;
  let firstPnl = 0;
  let extraWins = 0;
  let extraLosses = 0;
  let extraBE = 0;
  let extraPnl = 0;
  let multiTradeDays = 0;

  for (const dayTrades of byDay.values()) {
    if (dayTrades.length > 1) multiTradeDays += 1;
    dayTrades.forEach((t, idx) => {
      const pnl = t.pnl;
      if (idx === 0) {
        firstPnl += pnl;
        if (pnl > 0.005) firstWins += 1;
        else if (pnl < -0.005) firstLosses += 1;
        else firstBE += 1;
      } else {
        extraPnl += pnl;
        if (pnl > 0.005) extraWins += 1;
        else if (pnl < -0.005) extraLosses += 1;
        else extraBE += 1;
      }
    });
  }

  const firstCount = firstWins + firstLosses + firstBE;
  const extraCount = extraWins + extraLosses + extraBE;
  const firstWinRate = calcWinRate(firstWins, firstLosses);
  const extraWinRate = calcWinRate(extraWins, extraLosses);

  const oneTradePerDay: OneTradePerDayComparison = {
    totalDays: byDay.size,
    multiTradeDays,
    firstTradeStats: {
      trades: firstCount,
      wins: firstWins,
      losses: firstLosses,
      breakevens: firstBE,
      winRatePct: firstWinRate,
      netPnl: firstPnl,
    },
    extraTradeStats: {
      trades: extraCount,
      wins: extraWins,
      losses: extraLosses,
      breakevens: extraBE,
      winRatePct: extraWinRate,
      netPnl: extraPnl,
    },
    actualStats: {
      trades: report.totalClosedTrades,
      wins: report.winsCount,
      losses: report.lossesCount,
      breakevens: report.breakevensCount,
      winRatePct: report.winRatePct,
      netPnl: report.netPnl,
    },
    wouldHaveMoreWinsThanLosses: firstWins > firstLosses && report.winsCount <= report.lossesCount,
    wouldImprovePnl: extraCount > 0 && firstPnl > report.netPnl,
  };

  if (trades.length === 0) {
    return {
      traderName: name,
      headline: `${name}, no closed trades yet to analyze.`,
      subheadline: 'Close a few trades in your session and I will break down your daily discipline, risk-reward, and execution patterns.',
      mood: 'idle',
      oneTradePerDay,
      insights: [],
    };
  }

  const insights: AnalystInsight[] = [];

  // Insight 1: 1-Trade-a-Day / Overtrading
  if (extraCount > 0) {
    if (oneTradePerDay.wouldHaveMoreWinsThanLosses || oneTradePerDay.wouldImprovePnl) {
      const severity: AnalystInsightSeverity =
        oneTradePerDay.wouldHaveMoreWinsThanLosses || extraPnl < 0 ? 'CRITICAL' : 'IMPROVE';
      const winFlipNote = oneTradePerDay.wouldHaveMoreWinsThanLosses
        ? ` If you had taken only 1 trade a day, your wins (${firstWins}W–${firstLosses}L) would beat your losses instead of sitting at ${report.winsCount}W–${report.lossesCount}L.`
        : '';
      insights.push({
        id: 'overtrading-1-trade-day',
        category: 'OVERTRADING',
        severity,
        title: 'Stop after 1 trade per day',
        summary:
          `On ${multiTradeDays} of ${byDay.size} trading days you took 2+ trades. ` +
          `Your 1st trade of the day went ${firstWins}W–${firstLosses}L (${fmtPct(firstWinRate)}, ${formatMoney(firstPnl, currency, true)}), ` +
          `while extra trades (2nd+) went ${extraWins}W–${extraLosses}L (${fmtPct(extraWinRate)}, ${formatMoney(extraPnl, currency, true)}).` +
          winFlipNote,
        metricBadge: `1st Trade: ${formatMoney(firstPnl, currency, true)} vs Extra: ${formatMoney(extraPnl, currency, true)}`,
      });
    } else if (extraPnl > 0 && (extraWinRate ?? 0) >= 50) {
      insights.push({
        id: 'multi-trade-strength',
        category: 'OVERTRADING',
        severity: 'STRENGTH',
        title: 'Follow-up trades are adding edge',
        summary: `Your 2nd+ trades of the day went ${extraWins}W–${extraLosses}L (${fmtPct(extraWinRate)}) and added ${formatMoney(extraPnl, currency, true)} to your account.`,
        metricBadge: `Extra trades: ${formatMoney(extraPnl, currency, true)}`,
      });
    }
  }

  // Insight 2: Revenge trading (re-entering within 60 minutes after a loss on the same day)
  let quickPostLossCount = 0;
  let quickPostLossWins = 0;
  let quickPostLossLosses = 0;
  let quickPostLossPnl = 0;
  for (let i = 1; i < trades.length; i++) {
    const prev = trades[i - 1];
    const curr = trades[i];
    if (prev.pnl < -0.005 && getTradeDayKey(prev) === getTradeDayKey(curr)) {
      const prevExit = prev.exitTime || prev.entryTime;
      const gapSec = (curr.entryTime || 0) - prevExit;
      if (gapSec >= 0 && gapSec <= 3600) {
        quickPostLossCount += 1;
        quickPostLossPnl += curr.pnl;
        if (curr.pnl > 0.005) quickPostLossWins += 1;
        else if (curr.pnl < -0.005) quickPostLossLosses += 1;
      }
    }
  }
  if (quickPostLossCount >= 2 && quickPostLossPnl < 0) {
    insights.push({
      id: 'revenge-trading-cooldown',
      category: 'REVENGE_TRADING',
      severity: 'CRITICAL',
      title: 'Pause after a losing trade',
      summary: `You entered ${quickPostLossCount} trades within 60 minutes of a loss on the same day, going ${quickPostLossWins}W–${quickPostLossLosses}L (${formatMoney(quickPostLossPnl, currency, true)}). Adding a mandatory cooldown after a loss protects your daily P&L.`,
      metricBadge: `${quickPostLossCount} quick re-entries · ${formatMoney(quickPostLossPnl, currency, true)}`,
    });
  }

  // Insight 3: Risk-Reward (Avg Win vs Avg Loss)
  if (report.avgWin !== null && report.avgLoss !== null && report.avgLoss > 0) {
    const rrRatio = report.avgWin / report.avgLoss;
    if (rrRatio < 1 && (report.winRatePct ?? 0) < 58) {
      insights.push({
        id: 'risk-reward-imbalance',
        category: 'RISK_REWARD',
        severity: 'IMPROVE',
        title: 'Average loss is larger than average win',
        summary: `Your average win is ${formatMoney(report.avgWin, currency)} while your average loss is ${formatMoney(-report.avgLoss, currency)} (${rrRatio.toFixed(2)}:1 R:R). Tightening stops or letting winners run further will lift expectancy.`,
        metricBadge: `R:R ${rrRatio.toFixed(2)} : 1`,
      });
    } else if (rrRatio >= 1.5) {
      insights.push({
        id: 'risk-reward-strength',
        category: 'RISK_REWARD',
        severity: 'STRENGTH',
        title: 'Strong reward-to-risk discipline',
        summary: `Your average winner (${formatMoney(report.avgWin, currency)}) is ${rrRatio.toFixed(2)}× your average loser (${formatMoney(-report.avgLoss, currency)}), giving you positive asymmetry.`,
        metricBadge: `R:R ${rrRatio.toFixed(2)} : 1`,
      });
    }
  }

  // Insight 4: Direction edge (LONG vs SHORT)
  const longs = trades.filter((t) => t.side === 'LONG');
  const shorts = trades.filter((t) => t.side === 'SHORT');
  if (longs.length >= 3 && shorts.length >= 3) {
    const longPnl = longs.reduce((s, t) => s + t.pnl, 0);
    const shortPnl = shorts.reduce((s, t) => s + t.pnl, 0);
    const longWR = calcWinRate(
      longs.filter((t) => t.pnl > 0.005).length,
      longs.filter((t) => t.pnl < -0.005).length
    );
    const shortWR = calcWinRate(
      shorts.filter((t) => t.pnl > 0.005).length,
      shorts.filter((t) => t.pnl < -0.005).length
    );
    if (longPnl > 0 && shortPnl < 0) {
      insights.push({
        id: 'direction-short-drag',
        category: 'DIRECTION',
        severity: 'IMPROVE',
        title: 'Longs are profitable; Shorts are dragging P&L',
        summary: `Longs earned ${formatMoney(longPnl, currency, true)} (${fmtPct(longWR)} WR across ${longs.length} trades), whereas Shorts lost ${formatMoney(shortPnl, currency, true)} (${fmtPct(shortWR)} WR across ${shorts.length} trades).`,
        metricBadge: `Long ${formatMoney(longPnl, currency, true)} · Short ${formatMoney(shortPnl, currency, true)}`,
      });
    } else if (shortPnl > 0 && longPnl < 0) {
      insights.push({
        id: 'direction-long-drag',
        category: 'DIRECTION',
        severity: 'IMPROVE',
        title: 'Shorts are profitable; Longs are dragging P&L',
        summary: `Shorts earned ${formatMoney(shortPnl, currency, true)} (${fmtPct(shortWR)} WR across ${shorts.length} trades), whereas Longs lost ${formatMoney(longPnl, currency, true)} (${fmtPct(longWR)} WR across ${longs.length} trades).`,
        metricBadge: `Short ${formatMoney(shortPnl, currency, true)} · Long ${formatMoney(longPnl, currency, true)}`,
      });
    }
  }

  // Insight 5: Losing streak alert
  if (report.longestLossStreak >= 3) {
    insights.push({
      id: 'losing-streak-risk',
      category: 'STREAK',
      severity: report.currentLossStreak >= 2 ? 'CRITICAL' : 'IMPROVE',
      title: `Longest losing streak reached ${report.longestLossStreak} trades`,
      summary:
        report.currentLossStreak >= 2
          ? `You are currently on a ${report.currentLossStreak}-trade losing streak (longest: ${report.longestLossStreak}). Consider stepping back or halving position size until you log a clean A+ setup.`
          : `You recorded ${report.losingStreakCount} losing streak(s) of 2+ trades (longest: ${report.longestLossStreak}). A daily max-loss stop prevents streaks from compounding.`,
      metricBadge: `Max streak: ${report.longestLossStreak}L`,
    });
  }

  // Sort CRITICAL first, then IMPROVE, then STRENGTH
  const order: Record<AnalystInsightSeverity, number> = {
    CRITICAL: 0,
    IMPROVE: 1,
    STRENGTH: 2,
  };
  insights.sort((a, b) => order[a.severity] - order[b.severity]);

  const hasImprovements = insights.some((i) => i.severity !== 'STRENGTH');
  const headline = hasImprovements
    ? `${name}, after looking at your analytics, here’s what I think we need to improve:`
    : `${name}, after looking at your analytics, your execution looks solid — keep it up!`;

  const top = insights[0];
  const subheadline = top
    ? top.title
    : `${report.winsCount}W–${report.lossesCount}L across ${report.totalClosedTrades} closed trades (${formatMoney(report.netPnl, currency, true)}).`;

  return {
    traderName: name,
    headline,
    subheadline,
    mood: hasImprovements ? 'loss' : 'win',
    oneTradePerDay,
    insights,
  };
}
