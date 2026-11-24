import { BacktestPosition } from '../types/trading';

export type TradeLedgerSortOption =
  | 'LATEST'
  | 'OLDEST'
  | 'MOST_PROFITABLE'
  | 'BIGGEST_LOSS'
  | 'HIGHEST_R'
  | 'LOWEST_R'
  | 'LARGEST_LOTS'
  | 'HIGHEST_COSTS';

export type TradeLedgerOutcomeFilter =
  | 'ALL'
  | 'WINNERS'
  | 'LOSERS'
  | 'BREAKEVEN';

export type TradeLedgerSideFilter = 'ALL' | 'LONG' | 'SHORT';

export interface TradeLedgerFilterOptions {
  outcome: TradeLedgerOutcomeFilter;
  side: TradeLedgerSideFilter;
  symbol: string;
  sortBy: TradeLedgerSortOption;
}

export const TRADE_LEDGER_SORT_OPTIONS: ReadonlyArray<{
  value: TradeLedgerSortOption;
  label: string;
}> = [
  { value: 'LATEST', label: 'Latest Trades (Newest)' },
  { value: 'OLDEST', label: 'Oldest Trades (Chronological)' },
  { value: 'MOST_PROFITABLE', label: 'Most Profitable (Net P&L ↓)' },
  { value: 'BIGGEST_LOSS', label: 'Biggest Loss (Net P&L ↑)' },
  { value: 'HIGHEST_R', label: 'Highest Realised R (↓)' },
  { value: 'LOWEST_R', label: 'Lowest Realised R (↑)' },
  { value: 'LARGEST_LOTS', label: 'Largest Lot Size (↓)' },
  { value: 'HIGHEST_COSTS', label: 'Highest Execution Costs (↓)' },
];

export function getTradeTotalCost(trade: BacktestPosition): number {
  return (
    (trade.commissionPaid || 0) +
    (trade.spreadCost || 0) +
    (trade.slippageCost || 0)
  );
}

function getTradeSortTimestamp(trade: BacktestPosition): number {
  return trade.exitTime || trade.entryTime || 0;
}

export function filterAndSortClosedTradeLedger(
  trades: readonly BacktestPosition[],
  options: TradeLedgerFilterOptions,
  resolveSymbol?: (trade: BacktestPosition) => string
): BacktestPosition[] {
  const filtered = trades.filter((trade) => {
    if (options.outcome === 'WINNERS' && !(trade.pnl > 0.005)) return false;
    if (options.outcome === 'LOSERS' && !(trade.pnl < -0.005)) return false;
    if (options.outcome === 'BREAKEVEN' && Math.abs(trade.pnl) > 0.005) {
      return false;
    }

    if (options.side !== 'ALL' && trade.side !== options.side) {
      return false;
    }

    if (options.symbol !== 'ALL') {
      const sym = resolveSymbol
        ? resolveSymbol(trade)
        : trade.symbol || 'XAUUSD';
      if (sym !== options.symbol) return false;
    }

    return true;
  });

  const sorted = [...filtered];
  sorted.sort((a, b) => {
    const timeDiffDesc = getTradeSortTimestamp(b) - getTradeSortTimestamp(a);

    switch (options.sortBy) {
      case 'LATEST':
        return timeDiffDesc;

      case 'OLDEST':
        return getTradeSortTimestamp(a) - getTradeSortTimestamp(b);

      case 'MOST_PROFITABLE': {
        const diff = b.pnl - a.pnl;
        return diff !== 0 ? diff : timeDiffDesc;
      }

      case 'BIGGEST_LOSS': {
        const diff = a.pnl - b.pnl;
        return diff !== 0 ? diff : timeDiffDesc;
      }

      case 'HIGHEST_R': {
        const aHasR =
          a.rMultiple !== null &&
          a.rMultiple !== undefined &&
          Number.isFinite(a.rMultiple);
        const bHasR =
          b.rMultiple !== null &&
          b.rMultiple !== undefined &&
          Number.isFinite(b.rMultiple);
        if (aHasR && !bHasR) return -1;
        if (!aHasR && bHasR) return 1;
        if (!aHasR && !bHasR) return timeDiffDesc;
        const diff = (b.rMultiple as number) - (a.rMultiple as number);
        return diff !== 0 ? diff : timeDiffDesc;
      }

      case 'LOWEST_R': {
        const aHasR =
          a.rMultiple !== null &&
          a.rMultiple !== undefined &&
          Number.isFinite(a.rMultiple);
        const bHasR =
          b.rMultiple !== null &&
          b.rMultiple !== undefined &&
          Number.isFinite(b.rMultiple);
        if (aHasR && !bHasR) return -1;
        if (!aHasR && bHasR) return 1;
        if (!aHasR && !bHasR) return timeDiffDesc;
        const diff = (a.rMultiple as number) - (b.rMultiple as number);
        return diff !== 0 ? diff : timeDiffDesc;
      }

      case 'LARGEST_LOTS': {
        const diff = b.lotSize - a.lotSize;
        return diff !== 0 ? diff : timeDiffDesc;
      }

      case 'HIGHEST_COSTS': {
        const diff = getTradeTotalCost(b) - getTradeTotalCost(a);
        return diff !== 0 ? diff : timeDiffDesc;
      }

      default:
        return timeDiffDesc;
    }
  });

  return sorted;
}
