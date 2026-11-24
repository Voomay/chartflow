import { describe, expect, it } from 'vitest';
import {
  buildDailyCalendarData,
  buildMonthlyCalendarData,
  buildTradesByDateMap,
  buildWeeklyCalendarData,
  buildYearlyCalendarData,
  formatReturnPct,
} from './PnlCalendar';

function utcTs(isoDate: string): number {
  return Math.floor(Date.parse(`${isoDate}T12:00:00Z`) / 1000);
}

describe('PnlCalendar data builders', () => {
  const sampleTrades = [
    { entryTime: utcTs('2025-12-31'), exitTime: utcTs('2025-12-31'), pnl: 150 },
    { entryTime: utcTs('2026-01-02'), exitTime: utcTs('2026-01-02'), pnl: 200 },
    { entryTime: utcTs('2026-01-02'), exitTime: utcTs('2026-01-02'), pnl: -50 },
    { entryTime: utcTs('2026-01-10'), exitTime: utcTs('2026-01-10'), pnl: -80 },
    { entryTime: utcTs('2026-03-15'), exitTime: utcTs('2026-03-15'), pnl: 420.5 },
  ];

  const byDateMap = buildTradesByDateMap(sampleTrades);

  it('aggregates daily cells for a month', () => {
    const daily = buildDailyCalendarData(new Date(Date.UTC(2026, 0, 1)), byDateMap);
    expect(daily.monthLabel).toBe('January 2026');
    expect(daily.totalTrades).toBe(3);
    expect(daily.totalPnl).toBe(70);
    expect(daily.totalWins).toBe(1);
    expect(daily.totalLosses).toBe(2);

    const jan2 = daily.cells.find((c) => c.dateKey === '2026-01-02');
    expect(jan2).toMatchObject({
      dayNumber: 2,
      pnl: 150,
      tradesCount: 2,
      winsCount: 1,
      lossesCount: 1,
    });
  });

  it('aggregates weekly rows spanning full Sun–Sat weeks overlapping the month', () => {
    const weekly = buildWeeklyCalendarData(new Date(Date.UTC(2026, 0, 1)), byDateMap);
    expect(weekly.monthLabel).toBe('January 2026');
    expect(weekly.weeks.length).toBe(5);
    // Week 1 is Dec 28, 2025 – Jan 3, 2026, so it includes Dec 31 (+150) and Jan 2 (+150)
    expect(weekly.weeks[0].rangeLabel).toBe('Dec 28 – Jan 3');
    expect(weekly.weeks[0].pnl).toBe(300);
    expect(weekly.weeks[0].tradesCount).toBe(3);
    expect(weekly.weeks[0].days).toHaveLength(7);

    // Week 2 is Jan 4 – Jan 10, includes Jan 10 (-80)
    expect(weekly.weeks[1].rangeLabel).toBe('Jan 4 – 10');
    expect(weekly.weeks[1].pnl).toBe(-80);
    expect(weekly.weeks[1].tradesCount).toBe(1);
  });

  it('aggregates monthly cells for a year', () => {
    const monthly = buildMonthlyCalendarData(2026, byDateMap);
    expect(monthly.yearLabel).toBe('2026');
    expect(monthly.months).toHaveLength(12);
    expect(monthly.totalTrades).toBe(4);
    expect(monthly.totalPnl).toBe(490.5);
    expect(monthly.months[0]).toMatchObject({
      monthShort: 'Jan',
      pnl: 70,
      tradesCount: 3,
    });
    expect(monthly.months[2]).toMatchObject({
      monthShort: 'Mar',
      pnl: 420.5,
      tradesCount: 1,
    });
  });

  it('aggregates yearly cells across all years with trades', () => {
    const yearly = buildYearlyCalendarData(2026, byDateMap);
    expect(yearly.rangeLabel).toBe('2025 – 2026');
    expect(yearly.years).toHaveLength(2);
    expect(yearly.years[0]).toMatchObject({
      year: 2025,
      pnl: 150,
      tradesCount: 1,
      activeMonths: 1,
    });
    expect(yearly.years[1]).toMatchObject({
      year: 2026,
      pnl: 490.5,
      tradesCount: 4,
      activeMonths: 2,
    });
    expect(yearly.totalPnl).toBe(640.5);
  });

  it('falls back to showing the reference year when there are no trades', () => {
    const emptyYearly = buildYearlyCalendarData(2026, new Map());
    expect(emptyYearly.rangeLabel).toBe('2026');
    expect(emptyYearly.years).toHaveLength(1);
    expect(emptyYearly.years[0]).toMatchObject({
      year: 2026,
      pnl: 0,
      tradesCount: 0,
      activeMonths: 0,
    });
  });

  it('formats return percentages from starting balance', () => {
    expect(formatReturnPct(24610, 100000)).toBe('+24.61%');
    expect(formatReturnPct(24610, 100000, true)).toBe('+24.6%');
    expect(formatReturnPct(-1250, 100000)).toBe('-1.25%');
    expect(formatReturnPct(500, 0)).toBeNull();
    expect(formatReturnPct(500, undefined)).toBeNull();
  });
});
