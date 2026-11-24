import React, { useMemo, useState } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import { AccountCurrency, BacktestPosition } from '../../types/trading';
import { CURRENCY_SYMBOLS } from '../../services/simulationEngine';

export type PnlCalendarView = 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface DailyCell {
  dayNumber: number | null;
  dateKey: string;
  pnl: number;
  tradesCount: number;
  winsCount: number;
  lossesCount: number;
}

export interface WeekDayMini {
  dateKey: string;
  weekdayShort: string;
  inCurrentMonth: boolean;
  pnl: number;
  tradesCount: number;
}

export interface WeeklyRow {
  weekIndex: number;
  weekKey: string;
  rangeLabel: string;
  pnl: number;
  tradesCount: number;
  winsCount: number;
  lossesCount: number;
  days: WeekDayMini[];
}

export interface MonthlyCell {
  monthIndex: number;
  monthShort: string;
  monthLong: string;
  pnl: number;
  tradesCount: number;
  winsCount: number;
  lossesCount: number;
}

export interface YearlyCell {
  year: number;
  pnl: number;
  tradesCount: number;
  winsCount: number;
  lossesCount: number;
  activeMonths: number;
  monthsMini: {
    monthIndex: number;
    monthShort: string;
    pnl: number;
    tradesCount: number;
  }[];
}

interface DayBucket {
  pnl: number;
  tradesCount: number;
  winsCount: number;
  lossesCount: number;
}

const WEEKDAY_HEADERS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const WEEKDAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'] as const;
const MONTH_SHORTS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;
const MONTH_LONGS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

const CALENDAR_TABS: { id: PnlCalendarView; label: string }[] = [
  { id: 'daily', label: 'Daily' },
  { id: 'weekly', label: 'Weekly' },
  { id: 'monthly', label: 'Monthly' },
  { id: 'yearly', label: 'Yearly' },
];

function toUtcDateKey(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function buildTradesByDateMap(
  trades: Pick<BacktestPosition, 'entryTime' | 'exitTime' | 'pnl'>[]
): Map<string, DayBucket> {
  const map = new Map<string, DayBucket>();
  for (const tr of trades) {
    const ts = tr.exitTime || tr.entryTime;
    const dKey = new Date(ts * 1000).toISOString().slice(0, 10);
    const prev = map.get(dKey) || {
      pnl: 0,
      tradesCount: 0,
      winsCount: 0,
      lossesCount: 0,
    };
    prev.pnl = Number((prev.pnl + tr.pnl).toFixed(2));
    prev.tradesCount += 1;
    if (tr.pnl > 0.005) prev.winsCount += 1;
    else if (tr.pnl < -0.005) prev.lossesCount += 1;
    map.set(dKey, prev);
  }
  return map;
}

export function buildDailyCalendarData(
  referenceDate: Date,
  byDateMap: Map<string, DayBucket>
): {
  monthLabel: string;
  cells: DailyCell[];
  totalPnl: number;
  totalTrades: number;
  totalWins: number;
  totalLosses: number;
} {
  const year = referenceDate.getUTCFullYear();
  const month = referenceDate.getUTCMonth();
  const firstDay = new Date(Date.UTC(year, month, 1));
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const startWeekday = firstDay.getUTCDay();

  const cells: DailyCell[] = [];
  for (let i = 0; i < startWeekday; i++) {
    cells.push({
      dayNumber: null,
      dateKey: `empty-${i}`,
      pnl: 0,
      tradesCount: 0,
      winsCount: 0,
      lossesCount: 0,
    });
  }

  let totalPnl = 0;
  let totalTrades = 0;
  let totalWins = 0;
  let totalLosses = 0;

  for (let d = 1; d <= daysInMonth; d++) {
    const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const entry = byDateMap.get(dateKey);
    const pnl = entry?.pnl || 0;
    const tradesCount = entry?.tradesCount || 0;
    const winsCount = entry?.winsCount || 0;
    const lossesCount = entry?.lossesCount || 0;
    totalPnl = Number((totalPnl + pnl).toFixed(2));
    totalTrades += tradesCount;
    totalWins += winsCount;
    totalLosses += lossesCount;

    cells.push({
      dayNumber: d,
      dateKey,
      pnl,
      tradesCount,
      winsCount,
      lossesCount,
    });
  }

  return {
    monthLabel: firstDay.toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    }),
    cells,
    totalPnl,
    totalTrades,
    totalWins,
    totalLosses,
  };
}

export function buildWeeklyCalendarData(
  referenceDate: Date,
  byDateMap: Map<string, DayBucket>
): {
  monthLabel: string;
  weeks: WeeklyRow[];
  totalPnl: number;
  totalTrades: number;
  totalWins: number;
  totalLosses: number;
} {
  const year = referenceDate.getUTCFullYear();
  const month = referenceDate.getUTCMonth();
  const firstDay = new Date(Date.UTC(year, month, 1));
  const lastDay = new Date(Date.UTC(year, month + 1, 0));

  // Start on the Sunday on or before the 1st of the month
  const gridStart = new Date(firstDay);
  gridStart.setUTCDate(firstDay.getUTCDate() - firstDay.getUTCDay());

  // End on the Saturday on or after the last day of the month
  const gridEnd = new Date(lastDay);
  gridEnd.setUTCDate(lastDay.getUTCDate() + (6 - lastDay.getUTCDay()));

  const weeks: WeeklyRow[] = [];
  let totalPnl = 0;
  let totalTrades = 0;
  let totalWins = 0;
  let totalLosses = 0;

  let cursor = new Date(gridStart);
  let weekIndex = 1;

  while (cursor <= gridEnd) {
    const weekStart = new Date(cursor);
    const weekEnd = new Date(cursor);
    weekEnd.setUTCDate(weekStart.getUTCDate() + 6);

    let weekPnl = 0;
    let weekTrades = 0;
    let weekWins = 0;
    let weekLosses = 0;
    const days: WeekDayMini[] = [];

    for (let i = 0; i < 7; i++) {
      const dayDate = new Date(weekStart);
      dayDate.setUTCDate(weekStart.getUTCDate() + i);
      const dateKey = toUtcDateKey(dayDate);
      const entry = byDateMap.get(dateKey);
      const pnl = entry?.pnl || 0;
      const tradesCount = entry?.tradesCount || 0;
      const winsCount = entry?.winsCount || 0;
      const lossesCount = entry?.lossesCount || 0;

      weekPnl = Number((weekPnl + pnl).toFixed(2));
      weekTrades += tradesCount;
      weekWins += winsCount;
      weekLosses += lossesCount;

      days.push({
        dateKey,
        weekdayShort: WEEKDAY_LETTERS[i],
        inCurrentMonth: dayDate.getUTCMonth() === month,
        pnl,
        tradesCount,
      });
    }

    const startMonthShort = MONTH_SHORTS[weekStart.getUTCMonth()];
    const endMonthShort = MONTH_SHORTS[weekEnd.getUTCMonth()];
    const rangeLabel =
      weekStart.getUTCMonth() === weekEnd.getUTCMonth()
        ? `${startMonthShort} ${weekStart.getUTCDate()} – ${weekEnd.getUTCDate()}`
        : `${startMonthShort} ${weekStart.getUTCDate()} – ${endMonthShort} ${weekEnd.getUTCDate()}`;

    weeks.push({
      weekIndex,
      weekKey: `${toUtcDateKey(weekStart)}_${toUtcDateKey(weekEnd)}`,
      rangeLabel,
      pnl: weekPnl,
      tradesCount: weekTrades,
      winsCount: weekWins,
      lossesCount: weekLosses,
      days,
    });

    totalPnl = Number((totalPnl + weekPnl).toFixed(2));
    totalTrades += weekTrades;
    totalWins += weekWins;
    totalLosses += weekLosses;

    cursor.setUTCDate(cursor.getUTCDate() + 7);
    weekIndex += 1;
  }

  return {
    monthLabel: firstDay.toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    }),
    weeks,
    totalPnl,
    totalTrades,
    totalWins,
    totalLosses,
  };
}

export function buildMonthlyCalendarData(
  year: number,
  byDateMap: Map<string, DayBucket>
): {
  yearLabel: string;
  months: MonthlyCell[];
  totalPnl: number;
  totalTrades: number;
  totalWins: number;
  totalLosses: number;
} {
  const months: MonthlyCell[] = Array.from({ length: 12 }, (_, idx) => ({
    monthIndex: idx,
    monthShort: MONTH_SHORTS[idx],
    monthLong: MONTH_LONGS[idx],
    pnl: 0,
    tradesCount: 0,
    winsCount: 0,
    lossesCount: 0,
  }));

  let totalPnl = 0;
  let totalTrades = 0;
  let totalWins = 0;
  let totalLosses = 0;

  for (const [dateKey, bucket] of byDateMap.entries()) {
    const y = Number(dateKey.slice(0, 4));
    if (y !== year) continue;
    const m = Number(dateKey.slice(5, 7)) - 1;
    if (m < 0 || m > 11) continue;

    const target = months[m];
    target.pnl = Number((target.pnl + bucket.pnl).toFixed(2));
    target.tradesCount += bucket.tradesCount;
    target.winsCount += bucket.winsCount;
    target.lossesCount += bucket.lossesCount;

    totalPnl = Number((totalPnl + bucket.pnl).toFixed(2));
    totalTrades += bucket.tradesCount;
    totalWins += bucket.winsCount;
    totalLosses += bucket.lossesCount;
  }

  return {
    yearLabel: String(year),
    months,
    totalPnl,
    totalTrades,
    totalWins,
    totalLosses,
  };
}

export function buildYearlyCalendarData(
  fallbackYear: number,
  byDateMap: Map<string, DayBucket>
): {
  rangeLabel: string;
  years: YearlyCell[];
  totalPnl: number;
  totalTrades: number;
  totalWins: number;
  totalLosses: number;
} {
  const byYear = new Map<
    number,
    {
      pnl: number;
      tradesCount: number;
      winsCount: number;
      lossesCount: number;
      monthTotals: { pnl: number; tradesCount: number }[];
    }
  >();

  for (const [dateKey, bucket] of byDateMap.entries()) {
    const y = Number(dateKey.slice(0, 4));
    const m = Number(dateKey.slice(5, 7)) - 1;
    if (!Number.isFinite(y) || m < 0 || m > 11) continue;

    let entry = byYear.get(y);
    if (!entry) {
      entry = {
        pnl: 0,
        tradesCount: 0,
        winsCount: 0,
        lossesCount: 0,
        monthTotals: Array.from({ length: 12 }, () => ({ pnl: 0, tradesCount: 0 })),
      };
      byYear.set(y, entry);
    }

    entry.pnl = Number((entry.pnl + bucket.pnl).toFixed(2));
    entry.tradesCount += bucket.tradesCount;
    entry.winsCount += bucket.winsCount;
    entry.lossesCount += bucket.lossesCount;
    entry.monthTotals[m].pnl = Number((entry.monthTotals[m].pnl + bucket.pnl).toFixed(2));
    entry.monthTotals[m].tradesCount += bucket.tradesCount;
  }

  if (byYear.size === 0) {
    byYear.set(fallbackYear, {
      pnl: 0,
      tradesCount: 0,
      winsCount: 0,
      lossesCount: 0,
      monthTotals: Array.from({ length: 12 }, () => ({ pnl: 0, tradesCount: 0 })),
    });
  }

  const sortedYears = Array.from(byYear.keys()).sort((a, b) => a - b);
  let totalPnl = 0;
  let totalTrades = 0;
  let totalWins = 0;
  let totalLosses = 0;

  const years: YearlyCell[] = sortedYears.map((y) => {
    const entry = byYear.get(y)!;
    totalPnl = Number((totalPnl + entry.pnl).toFixed(2));
    totalTrades += entry.tradesCount;
    totalWins += entry.winsCount;
    totalLosses += entry.lossesCount;

    return {
      year: y,
      pnl: entry.pnl,
      tradesCount: entry.tradesCount,
      winsCount: entry.winsCount,
      lossesCount: entry.lossesCount,
      activeMonths: entry.monthTotals.filter((m) => m.tradesCount > 0).length,
      monthsMini: entry.monthTotals.map((m, idx) => ({
        monthIndex: idx,
        monthShort: MONTH_SHORTS[idx],
        pnl: m.pnl,
        tradesCount: m.tradesCount,
      })),
    };
  });

  const rangeLabel =
    sortedYears.length === 1
      ? String(sortedYears[0])
      : `${sortedYears[0]} – ${sortedYears[sortedYears.length - 1]}`;

  return {
    rangeLabel,
    years,
    totalPnl,
    totalTrades,
    totalWins,
    totalLosses,
  };
}

function formatCompactPnl(pnl: number, currency: AccountCurrency): string {
  const symbol = CURRENCY_SYMBOLS[currency] || '$';
  const sign = pnl >= 0 ? '+' : '-';
  return `${sign}${symbol}${Math.round(Math.abs(pnl)).toLocaleString('en-US')}`;
}

export function formatReturnPct(
  pnl: number,
  startingBalance?: number,
  compact = false
): string | null {
  if (!startingBalance || startingBalance <= 0) return null;
  const pct = (pnl / startingBalance) * 100;
  const sign = pct >= 0 ? '+' : '-';
  const abs = Math.abs(pct);
  const decimals = compact ? (abs >= 10 ? 1 : 2) : 2;
  return `${sign}${abs.toFixed(decimals)}%`;
}

function getToneClasses(
  hasTrades: boolean,
  pnl: number,
  isLight: boolean,
  subCardBg: string
): string {
  if (!hasTrades) return subCardBg;
  if (pnl > 0.005) {
    return isLight
      ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-800'
      : 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300';
  }
  if (pnl < -0.005) {
    return isLight
      ? 'bg-rose-500/15 border-rose-500/40 text-rose-800'
      : 'bg-rose-500/15 border-rose-500/40 text-rose-300';
  }
  return 'bg-blue-500/15 border-blue-500/30';
}

export interface PnlCalendarProps {
  trades: BacktestPosition[];
  accountCurrency: AccountCurrency;
  startingBalance?: number;
  calendarMonthDate: Date;
  onChangeCalendarMonthDate: React.Dispatch<React.SetStateAction<Date>>;
  isLight: boolean;
  cardBg: string;
  subCardBg: string;
}

export const PnlCalendar: React.FC<PnlCalendarProps> = ({
  trades,
  accountCurrency,
  startingBalance,
  calendarMonthDate,
  onChangeCalendarMonthDate,
  isLight,
  cardBg,
  subCardBg,
}) => {
  const [view, setView] = useState<PnlCalendarView>('daily');

  const byDateMap = useMemo(() => buildTradesByDateMap(trades), [trades]);

  const dailyData = useMemo(
    () => buildDailyCalendarData(calendarMonthDate, byDateMap),
    [calendarMonthDate, byDateMap]
  );

  const weeklyData = useMemo(
    () => buildWeeklyCalendarData(calendarMonthDate, byDateMap),
    [calendarMonthDate, byDateMap]
  );

  const selectedYear = calendarMonthDate.getUTCFullYear();

  const monthlyData = useMemo(
    () => buildMonthlyCalendarData(selectedYear, byDateMap),
    [selectedYear, byDateMap]
  );

  const yearlyData = useMemo(
    () => buildYearlyCalendarData(selectedYear, byDateMap),
    [selectedYear, byDateMap]
  );

  const headerInfo = useMemo(() => {
    switch (view) {
      case 'daily':
        return {
          periodLabel: dailyData.monthLabel,
          totalPnl: dailyData.totalPnl,
          totalTrades: dailyData.totalTrades,
          totalWins: dailyData.totalWins,
          totalLosses: dailyData.totalLosses,
          canNavigate: true,
        };
      case 'weekly':
        return {
          periodLabel: weeklyData.monthLabel,
          totalPnl: weeklyData.totalPnl,
          totalTrades: weeklyData.totalTrades,
          totalWins: weeklyData.totalWins,
          totalLosses: weeklyData.totalLosses,
          canNavigate: true,
        };
      case 'monthly':
        return {
          periodLabel: monthlyData.yearLabel,
          totalPnl: monthlyData.totalPnl,
          totalTrades: monthlyData.totalTrades,
          totalWins: monthlyData.totalWins,
          totalLosses: monthlyData.totalLosses,
          canNavigate: true,
        };
      case 'yearly':
        return {
          periodLabel: yearlyData.rangeLabel,
          totalPnl: yearlyData.totalPnl,
          totalTrades: yearlyData.totalTrades,
          totalWins: yearlyData.totalWins,
          totalLosses: yearlyData.totalLosses,
          canNavigate: false,
        };
    }
  }, [view, dailyData, weeklyData, monthlyData, yearlyData]);

  const periodPct = formatReturnPct(headerInfo.totalPnl, startingBalance);

  const handlePrev = () => {
    if (view === 'monthly') {
      onChangeCalendarMonthDate(
        (d) => new Date(Date.UTC(d.getUTCFullYear() - 1, d.getUTCMonth(), 1))
      );
      return;
    }
    onChangeCalendarMonthDate(
      (d) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, 1))
    );
  };

  const handleNext = () => {
    if (view === 'monthly') {
      onChangeCalendarMonthDate(
        (d) => new Date(Date.UTC(d.getUTCFullYear() + 1, d.getUTCMonth(), 1))
      );
      return;
    }
    onChangeCalendarMonthDate(
      (d) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1))
    );
  };

  return (
    <div className={`lg:col-span-6 min-w-0 overflow-hidden p-4 rounded-2xl border space-y-3 ${cardBg}`}>
      {/* Top Row: Fixed Title (left) & Fixed Tabs pinned in top-right corner */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <CalendarIcon className="w-4 h-4 text-[#2962ff] shrink-0" />
          <h3 className="text-xs font-extrabold uppercase tracking-wider truncate">
            P&amp;L Calendar
          </h3>
        </div>

        {/* Fixed top-right tab bar — never shifts regardless of active view */}
        <div
          role="tablist"
          aria-label="P&L calendar timeframe"
          className={`inline-flex shrink-0 items-center rounded-lg border p-0.5 text-[10px] font-mono font-bold ${
            isLight
              ? 'bg-[#f4f6fb] border-[#e0e3eb]'
              : 'bg-[#0e131b] border-white/[0.08]'
          }`}
        >
          {CALENDAR_TABS.map((tab) => {
            const active = view === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setView(tab.id)}
                className={`px-2 py-1 rounded-md transition ${
                  active
                    ? 'bg-[#2962ff] text-white shadow-sm'
                    : isLight
                    ? 'text-[#4b5563] hover:text-[#111827]'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Sub-header Row: Period navigation (left) & Period Net + Return % (right) */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono">
        <div className="flex items-center gap-1.5">
          {headerInfo.canNavigate && (
            <button
              type="button"
              onClick={handlePrev}
              aria-label={view === 'monthly' ? 'Previous year' : 'Previous month'}
              className={`p-1 rounded border transition hover:opacity-100 opacity-85 ${subCardBg}`}
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
          )}
          <span className="font-extrabold uppercase tracking-wide text-[11px] min-w-[96px] text-center">
            {headerInfo.periodLabel}
          </span>
          {headerInfo.canNavigate && (
            <button
              type="button"
              onClick={handleNext}
              aria-label={view === 'monthly' ? 'Next year' : 'Next month'}
              className={`p-1 rounded border transition hover:opacity-100 opacity-85 ${subCardBg}`}
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 text-[10px]">
          <span className="opacity-75">
            {headerInfo.totalTrades > 0
              ? `${headerInfo.totalTrades}T · ${headerInfo.totalWins}W/${headerInfo.totalLosses}L`
              : 'No closed trades'}
          </span>
          {headerInfo.totalTrades > 0 && (
            <span
              className={`font-extrabold ${
                headerInfo.totalPnl > 0.005
                  ? isLight
                    ? 'text-emerald-700'
                    : 'text-emerald-400'
                  : headerInfo.totalPnl < -0.005
                  ? isLight
                    ? 'text-rose-700'
                    : 'text-rose-400'
                  : 'text-blue-400'
              }`}
            >
              {formatCompactPnl(headerInfo.totalPnl, accountCurrency)}
              {periodPct ? ` (${periodPct})` : ''}
            </span>
          )}
        </div>
      </div>

      {/* DAILY VIEW */}
      {view === 'daily' && (
        <div className="grid grid-cols-7 gap-1.5 text-center text-[10px] font-mono">
          {WEEKDAY_HEADERS.map((d) => (
            <div key={d} className="opacity-60 font-bold py-1">
              {d}
            </div>
          ))}
          {dailyData.cells.map((cell) => {
            if (cell.dayNumber === null) {
              return (
                <div
                  key={cell.dateKey}
                  className="h-16 rounded-lg bg-transparent"
                />
              );
            }
            const hasTrades = cell.tradesCount > 0;
            const dayPct = hasTrades
              ? formatReturnPct(cell.pnl, startingBalance, true)
              : null;
            return (
              <div
                key={cell.dateKey}
                className={`h-16 p-1.5 rounded-lg border flex flex-col justify-between text-left ${getToneClasses(
                  hasTrades,
                  cell.pnl,
                  isLight,
                  subCardBg
                )}`}
              >
                <div className="flex justify-between items-center text-[9px]">
                  <span className="font-bold">{cell.dayNumber}</span>
                  {hasTrades && <span>{cell.tradesCount}T</span>}
                </div>
                {hasTrades && (
                  <div className="leading-tight">
                    <div className="text-[10px] font-extrabold truncate">
                      {formatCompactPnl(cell.pnl, accountCurrency)}
                    </div>
                    {dayPct && (
                      <div className="text-[9px] font-bold opacity-80 truncate">
                        {dayPct}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* WEEKLY VIEW */}
      {view === 'weekly' && (
        <div className="space-y-2 font-mono">
          {weeklyData.weeks.map((week) => {
            const hasTrades = week.tradesCount > 0;
            const winRate = hasTrades
              ? Math.round((week.winsCount / week.tradesCount) * 100)
              : 0;
            const weekPct = hasTrades
              ? formatReturnPct(week.pnl, startingBalance)
              : null;
            return (
              <button
                key={week.weekKey}
                type="button"
                onClick={() => setView('daily')}
                title="Click to inspect daily breakdown"
                className={`w-full p-2.5 rounded-xl border flex flex-wrap sm:flex-nowrap items-center justify-between gap-2 text-left transition hover:brightness-105 ${getToneClasses(
                  hasTrades,
                  week.pnl,
                  isLight,
                  subCardBg
                )}`}
              >
                <div className="min-w-[118px]">
                  <div className="text-[11px] font-extrabold">
                    Week {week.weekIndex}
                  </div>
                  <div className="text-[10px] opacity-75">{week.rangeLabel}</div>
                </div>

                {/* 7-day mini activity strip */}
                <div className="flex items-center gap-1">
                  {week.days.map((day) => {
                    const dayHasTrades = day.tradesCount > 0;
                    const dayPct = dayHasTrades
                      ? formatReturnPct(day.pnl, startingBalance)
                      : null;
                    const pillClass = !dayHasTrades
                      ? isLight
                        ? 'bg-black/[0.05] text-black/40'
                        : 'bg-white/[0.05] text-white/35'
                      : day.pnl > 0.005
                      ? 'bg-emerald-500/30 text-emerald-300 border border-emerald-500/40'
                      : day.pnl < -0.005
                      ? 'bg-rose-500/30 text-rose-300 border border-rose-500/40'
                      : 'bg-blue-500/30 text-blue-300 border border-blue-500/40';
                    return (
                      <span
                        key={day.dateKey}
                        title={
                          dayHasTrades
                            ? `${day.dateKey}: ${formatCompactPnl(day.pnl, accountCurrency)}${dayPct ? ` (${dayPct})` : ''} · ${day.tradesCount}T`
                            : `${day.dateKey}: No trades`
                        }
                        className={`w-5 h-5 rounded flex items-center justify-center text-[9px] font-bold ${
                          !day.inCurrentMonth ? 'opacity-45' : ''
                        } ${
                          isLight && dayHasTrades
                            ? day.pnl > 0.005
                              ? 'bg-emerald-500/25 text-emerald-800 border border-emerald-500/40'
                              : day.pnl < -0.005
                              ? 'bg-rose-500/25 text-rose-800 border border-rose-500/40'
                              : 'bg-blue-500/25 text-blue-800 border border-blue-500/40'
                            : pillClass
                        }`}
                      >
                        {day.weekdayShort}
                      </span>
                    );
                  })}
                </div>

                <div className="text-right min-w-[120px]">
                  <div className="text-xs font-extrabold">
                    {hasTrades ? formatCompactPnl(week.pnl, accountCurrency) : '—'}
                    {weekPct && (
                      <span className="ml-1 text-[10px] font-bold opacity-85">
                        ({weekPct})
                      </span>
                    )}
                  </div>
                  <div className="text-[9px] opacity-75">
                    {hasTrades
                      ? `${week.tradesCount}T · ${week.winsCount}W/${week.lossesCount}L (${winRate}%)`
                      : '0 trades'}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* MONTHLY VIEW */}
      {view === 'monthly' && (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 font-mono">
          {monthlyData.months.map((m) => {
            const hasTrades = m.tradesCount > 0;
            const winRate = hasTrades
              ? Math.round((m.winsCount / m.tradesCount) * 100)
              : 0;
            const monthPct = hasTrades
              ? formatReturnPct(m.pnl, startingBalance)
              : null;
            return (
              <button
                key={m.monthIndex}
                type="button"
                onClick={() => {
                  onChangeCalendarMonthDate(new Date(Date.UTC(selectedYear, m.monthIndex, 1)));
                  setView('daily');
                }}
                title={`Open ${m.monthLong} ${selectedYear} daily calendar`}
                className={`h-[86px] p-2 rounded-xl border flex flex-col justify-between text-left transition hover:brightness-105 ${getToneClasses(
                  hasTrades,
                  m.pnl,
                  isLight,
                  subCardBg
                )}`}
              >
                <div className="flex items-center justify-between text-[10px]">
                  <span className="font-extrabold uppercase">{m.monthShort}</span>
                  {hasTrades && <span className="opacity-80">{m.tradesCount}T</span>}
                </div>
                <div className="leading-tight">
                  <div className="text-xs font-extrabold truncate">
                    {hasTrades ? formatCompactPnl(m.pnl, accountCurrency) : '—'}
                  </div>
                  {monthPct && (
                    <div className="text-[10px] font-bold opacity-85 truncate">
                      {monthPct}
                    </div>
                  )}
                </div>
                <div className="text-[9px] opacity-75 truncate">
                  {hasTrades ? `${m.winsCount}W/${m.lossesCount}L · ${winRate}%` : 'No trades'}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* YEARLY VIEW */}
      {view === 'yearly' && (
        <div
          className={`grid gap-3 font-mono ${
            yearlyData.years.length === 1
              ? 'grid-cols-1'
              : 'grid-cols-1 sm:grid-cols-2'
          }`}
        >
          {yearlyData.years.map((y) => {
            const hasTrades = y.tradesCount > 0;
            const winRate = hasTrades
              ? Math.round((y.winsCount / y.tradesCount) * 100)
              : 0;
            const yearPct = hasTrades
              ? formatReturnPct(y.pnl, startingBalance)
              : null;
            const isSingleYear = yearlyData.years.length === 1;

            return (
              <div
                key={y.year}
                className={`p-4 rounded-xl border flex flex-col gap-3 text-left ${getToneClasses(
                  hasTrades,
                  y.pnl,
                  isLight,
                  subCardBg
                )}`}
              >
                {/* Year card top header (click to open Monthly view for this year) */}
                <button
                  type="button"
                  onClick={() => {
                    onChangeCalendarMonthDate(new Date(Date.UTC(y.year, 0, 1)));
                    setView('monthly');
                  }}
                  title={`Open ${y.year} monthly calendar`}
                  className="w-full text-left flex flex-wrap items-baseline justify-between gap-2 group"
                >
                  <div className="flex items-baseline gap-2.5">
                    <span className={`${isSingleYear ? 'text-lg' : 'text-sm'} font-extrabold group-hover:underline`}>
                      {y.year}
                    </span>
                    <span className="text-[10px] opacity-75">
                      {hasTrades
                        ? `${y.tradesCount} trade${y.tradesCount === 1 ? '' : 's'} · ${y.activeMonths} active mo`
                        : 'No trades'}
                    </span>
                  </div>
                  {hasTrades && (
                    <span className="text-[10px] font-bold opacity-80">
                      {y.winsCount}W / {y.lossesCount}L · {winRate}% WR
                    </span>
                  )}
                </button>

                {/* Primary Annual P&L + Return % */}
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div className="flex items-baseline gap-2.5">
                    <span className={`${isSingleYear ? 'text-2xl' : 'text-base'} font-extrabold`}>
                      {hasTrades ? formatCompactPnl(y.pnl, accountCurrency) : '—'}
                    </span>
                    {yearPct && (
                      <span
                        className={`px-2 py-0.5 rounded-md font-extrabold ${
                          isSingleYear ? 'text-xs' : 'text-[10px]'
                        } ${
                          y.pnl > 0.005
                            ? isLight
                              ? 'bg-emerald-500/20 text-emerald-800'
                              : 'bg-emerald-500/20 text-emerald-300'
                            : y.pnl < -0.005
                            ? isLight
                              ? 'bg-rose-500/20 text-rose-800'
                              : 'bg-rose-500/20 text-rose-300'
                            : 'bg-blue-500/20 text-blue-300'
                        }`}
                      >
                        {yearPct}
                      </span>
                    )}
                  </div>
                </div>

                {/* 12-month breakdown strip — spacious tiles when single year, compact bar strip when multi-year */}
                {isSingleYear ? (
                  <div className="grid grid-cols-4 sm:grid-cols-6 gap-1.5 pt-1">
                    {y.monthsMini.map((mm) => {
                      const mHas = mm.tradesCount > 0;
                      const mPct = mHas
                        ? formatReturnPct(mm.pnl, startingBalance, true)
                        : null;
                      return (
                        <button
                          key={mm.monthIndex}
                          type="button"
                          onClick={() => {
                            onChangeCalendarMonthDate(
                              new Date(Date.UTC(y.year, mm.monthIndex, 1))
                            );
                            setView('daily');
                          }}
                          title={
                            mHas
                              ? `${mm.monthShort} ${y.year}: ${formatCompactPnl(mm.pnl, accountCurrency)}${mPct ? ` (${mPct})` : ''} · ${mm.tradesCount}T`
                              : `${mm.monthShort} ${y.year}: No trades`
                          }
                          className={`p-2 rounded-lg border text-left transition hover:brightness-105 ${
                            !mHas
                              ? isLight
                                ? 'bg-white/60 border-black/10 text-black/50'
                                : 'bg-black/20 border-white/10 text-white/40'
                              : mm.pnl > 0.005
                              ? isLight
                                ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-900'
                                : 'bg-emerald-500/20 border-emerald-500/40 text-emerald-200'
                              : mm.pnl < -0.005
                              ? isLight
                                ? 'bg-rose-500/20 border-rose-500/40 text-rose-900'
                                : 'bg-rose-500/20 border-rose-500/40 text-rose-200'
                              : 'bg-blue-500/20 border-blue-500/40'
                          }`}
                        >
                          <div className="flex items-center justify-between text-[9px] font-bold uppercase">
                            <span>{mm.monthShort}</span>
                            {mHas && <span className="opacity-75">{mm.tradesCount}T</span>}
                          </div>
                          <div className="text-[10px] font-extrabold truncate mt-1">
                            {mHas ? (mPct || formatCompactPnl(mm.pnl, accountCurrency)) : '—'}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="grid grid-cols-12 gap-1 pt-0.5">
                    {y.monthsMini.map((mm) => {
                      const mHas = mm.tradesCount > 0;
                      const mPct = mHas
                        ? formatReturnPct(mm.pnl, startingBalance)
                        : null;
                      const barColor = !mHas
                        ? isLight
                          ? 'bg-black/10'
                          : 'bg-white/10'
                        : mm.pnl > 0.005
                        ? 'bg-emerald-500'
                        : mm.pnl < -0.005
                        ? 'bg-rose-500'
                        : 'bg-blue-400';
                      return (
                        <button
                          key={mm.monthIndex}
                          type="button"
                          onClick={() => {
                            onChangeCalendarMonthDate(
                              new Date(Date.UTC(y.year, mm.monthIndex, 1))
                            );
                            setView('daily');
                          }}
                          title={
                            mHas
                              ? `${mm.monthShort} ${y.year}: ${formatCompactPnl(mm.pnl, accountCurrency)}${mPct ? ` (${mPct})` : ''} (${mm.tradesCount}T)`
                              : `${mm.monthShort} ${y.year}: No trades`
                          }
                          className="flex flex-col items-center gap-0.5"
                        >
                          <div className={`w-full h-1.5 rounded-full ${barColor}`} />
                          <span className="text-[8px] opacity-60">
                            {mm.monthShort[0]}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
