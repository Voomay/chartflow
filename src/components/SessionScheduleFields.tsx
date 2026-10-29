import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  Calendar,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Globe2,
  X,
} from 'lucide-react';
import { DisplayTimezone, InstrumentSymbol, ThemeMode } from '../types/trading';
import {
  getInstrumentConfig,
  getInstrumentHistoricalCoverage,
  isFixedMarketHolidayDate,
  snapToOpenTradingDate,
} from '../services/goldDataService';

interface Props {
  symbol?: InstrumentSymbol;
  start: string;
  end: string;
  time: string;
  timezone: DisplayTimezone;
  onStart: (value: string) => void;
  onEnd: (value: string) => void;
  onTime: (value: string) => void;
  onTimezone: (value: DisplayTimezone) => void;
  zones: { value: DisplayTimezone; label: string }[];
  scheduleNotice?: string | null;
  onScheduleNotice?: (notice: string | null) => void;
  theme?: ThemeMode;
}

const months = [
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
];

const iso = (date: Date) => date.toISOString().slice(0, 10);
const parse = (value: string) => new Date(value + 'T00:00:00Z');
const pretty = (value: string) =>
  new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(parse(value));

export function SessionScheduleFields({
  symbol = 'XAUUSD',
  start,
  end,
  time,
  timezone,
  onStart,
  onEnd,
  onTime,
  onTimezone,
  zones,
  scheduleNotice,
  onScheduleNotice,
  theme = 'dark',
}: Props) {
  const isLight = theme === 'light';
  const [open, setOpen] = useState<'start' | 'end' | 'time' | 'zone' | null>(null);
  const [month, setMonth] = useState(() => parse(start));
  const [view, setView] = useState<'days' | 'months' | 'years'>('days');
  const [hour, setHour] = useState('08');
  const [minute, setMinute] = useState('00');
  const [internalNotice, setInternalNotice] = useState<string | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);

  const coverage = getInstrumentHistoricalCoverage(symbol);
  const cfg = getInstrumentConfig(symbol);
  const today = new Date().toLocaleDateString('en-CA');
  const max = coverage.maxDate < today ? coverage.maxDate : today;
  const min = coverage.minDate;
  const selected = open === 'end' ? end : start;
  const activeNotice = scheduleNotice !== undefined ? scheduleNotice : internalNotice;

  const setNotice = (msg: string | null) => {
    setInternalNotice(msg);
    onScheduleNotice?.(msg);
  };

  const launch = (type: typeof open) => {
    setView('days');
    const targetDate = type === 'end' ? end : start;
    const clampedDate =
      targetDate < coverage.minDate
        ? coverage.minDate
        : targetDate > max
        ? max
        : targetDate;
    setMonth(parse(clampedDate));
    const [h, m] = time.split(':');
    setHour(h);
    setMinute(m);
    setOpen(type);
  };

  useEffect(() => {
    if (!open) return;
    const node = dialog.current;
    node?.showModal();
    return () => node?.close();
  }, [open]);

  const applySelectedDate = (value: string, closeAfter: boolean) => {
    const clamped = value < min ? min : value > max ? max : value;
    if (!coverage.isDateSupported(clamped)) {
      const snappedFallback = snapToOpenTradingDate(clamped, symbol, 'forward');
      if (!coverage.isDateSupported(snappedFallback.date)) return;
      value = snappedFallback.date;
    } else {
      value = clamped;
    }

    if (open === 'start') {
      const snapped = snapToOpenTradingDate(value, symbol, 'forward');
      onStart(snapped.date);
      if (end < snapped.date) {
        onEnd(max >= snapped.date ? max : snapped.date);
      }
      setNotice(snapped.adjusted && snapped.reason ? snapped.reason : null);
      setMonth(parse(snapped.date));
    } else if (open === 'end') {
      onEnd(value);
      if (value < start) {
        const endObj = parse(value);
        const priorMonth = new Date(
          Date.UTC(endObj.getUTCFullYear(), endObj.getUTCMonth() - 1, 1)
        );
        const priorLastDay = new Date(
          Date.UTC(priorMonth.getUTCFullYear(), priorMonth.getUTCMonth() + 1, 0)
        ).getUTCDate();
        priorMonth.setUTCDate(Math.min(endObj.getUTCDate(), priorLastDay));
        const rawStart = iso(priorMonth) < min ? min : iso(priorMonth);
        const snappedStart = snapToOpenTradingDate(rawStart, symbol, 'forward');
        const nextStart =
          snappedStart.date <= value
            ? snappedStart.date
            : snapToOpenTradingDate(value, symbol, 'backward').date;
        onStart(nextStart);
      }
      setMonth(parse(value));
    }
    if (closeAfter) {
      setOpen(null);
    }
  };

  const choose = (value: string) => {
    if (value < min || value > max || !coverage.isDateSupported(value)) return;
    applySelectedDate(value, true);
  };

  const applyYearAndMonthPreview = (targetYear: number, targetMonthIndex: number) => {
    const currentDay = parse(selected).getUTCDate() || 1;
    const lastDay = new Date(
      Date.UTC(targetYear, targetMonthIndex + 1, 0)
    ).getUTCDate();
    const candidate = iso(
      new Date(
        Date.UTC(targetYear, targetMonthIndex, Math.min(currentDay, lastDay))
      )
    );
    applySelectedDate(candidate, false);
  };

  const changeMonth = (delta: number) =>
    setMonth(
      new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + delta, 1))
    );
  const first = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth(), 1));
  const offset = (first.getUTCDay() + 6) % 7;
  const days = Array.from(
    { length: 42 },
    (_, index) =>
      new Date(
        Date.UTC(month.getUTCFullYear(), month.getUTCMonth(), index - offset + 1)
      )
  );
  const supportedYears = Array.from(
    { length: coverage.maxYear - coverage.minYear + 1 },
    (_, i) => coverage.minYear + i
  );

  const field = `group w-full rounded-xl border px-3 py-2 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400 ${
    isLight
      ? 'border-slate-200/90 bg-white hover:border-emerald-500/50 hover:bg-emerald-50/30 shadow-sm'
      : 'border-emerald-500/20 bg-[#0b131d]/90 hover:border-emerald-400/50 hover:bg-[#0f1b29]'
  }`;
  const label = `mb-1 block text-[9.5px] font-bold uppercase tracking-wider ${
    isLight ? 'text-slate-500' : 'text-slate-400'
  }`;
  const valueText = `flex items-center justify-between gap-1 text-xs font-bold ${
    isLight ? 'text-slate-900' : 'text-slate-100'
  }`;
  const iconTone = isLight
    ? 'text-teal-600 group-hover:text-emerald-600'
    : 'text-emerald-400/80 group-hover:text-emerald-300';
  const numberInput = `w-20 rounded-xl border py-2.5 text-center text-2xl font-bold tabular-nums focus:border-emerald-400 focus:outline-none ${
    isLight
      ? 'border-slate-200 bg-slate-50 text-slate-900'
      : 'border-emerald-500/25 bg-[#091019] text-white'
  }`;
  const title =
    open === 'start'
      ? 'Trade from'
      : open === 'end'
      ? 'Trade until'
      : open === 'time'
      ? 'Start time'
      : 'Chart timezone';

  return (
    <>
      <div
        className={`rounded-xl border p-2.5 sm:p-3 ${
          isLight
            ? 'border-emerald-500/20 bg-gradient-to-br from-emerald-50/50 via-slate-50/90 to-cyan-50/40'
            : 'border-emerald-500/20 bg-gradient-to-br from-emerald-500/[0.06] via-[#0c1520]/90 to-cyan-500/[0.05]'
        }`}
      >
        <div
          className={`mb-2 flex flex-wrap items-center justify-between gap-2 text-[10.5px] ${
            isLight ? 'text-slate-600' : 'text-slate-300'
          }`}
        >
          <span className="flex items-center gap-1.5 font-semibold">
            <Calendar
              className={`h-3.5 w-3.5 ${
                isLight ? 'text-teal-600' : 'text-emerald-400'
              }`}
            />
            Your practice schedule
          </span>
          <span
            className={`font-mono text-[10px] ${
              isLight ? 'text-slate-500' : 'text-slate-400'
            }`}
          >
            Available data: {coverage.minDate} → {coverage.maxDate}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <button
            type="button"
            aria-label={`Trade from: ${start}`}
            onClick={() => launch('start')}
            className={field}
          >
            <span className={label}>Trade from</span>
            <span className={valueText}>
              {pretty(start)}
              <Calendar className={`h-3.5 w-3.5 shrink-0 ${iconTone}`} />
            </span>
          </button>

          <button
            type="button"
            aria-label={`Trade until: ${end}`}
            onClick={() => launch('end')}
            className={field}
          >
            <span className={label}>Trade until</span>
            <span className={valueText}>
              {pretty(end)}
              <Calendar className={`h-3.5 w-3.5 shrink-0 ${iconTone}`} />
            </span>
          </button>

          <button
            type="button"
            aria-label={`Start time: ${time} UTC`}
            onClick={() => launch('time')}
            className={field}
          >
            <span className={label}>Start time · UTC</span>
            <span className={valueText}>
              {time}
              <Clock className={`h-3.5 w-3.5 shrink-0 ${iconTone}`} />
            </span>
          </button>

          <button
            type="button"
            aria-label="Chart timezone"
            onClick={() => launch('zone')}
            className={field}
          >
            <span className={label}>Chart timezone</span>
            <span className={valueText}>
              <span className="truncate">
                {zones.find((zone) => zone.value === timezone)?.label || timezone}
              </span>
              <ChevronDown className={`h-3.5 w-3.5 shrink-0 ${iconTone}`} />
            </span>
          </button>
        </div>

        {activeNotice && (
          <div
            role="status"
            className={`mt-2 flex items-center justify-between gap-2 rounded-xl border px-3 py-1.5 text-[11px] font-medium ${
              isLight
                ? 'border-amber-500/35 bg-amber-500/10 text-amber-900'
                : 'border-amber-400/30 bg-amber-500/10 text-amber-200'
            }`}
          >
            <span className="flex items-center gap-1.5">
              <AlertCircle
                className={`h-3.5 w-3.5 shrink-0 ${
                  isLight ? 'text-amber-600' : 'text-amber-400'
                }`}
              />
              <span>{activeNotice}</span>
            </span>
            <button
              type="button"
              onClick={() => setNotice(null)}
              className={`text-[10px] font-bold hover:underline ${
                isLight ? 'text-amber-800' : 'text-amber-300'
              }`}
            >
              Dismiss
            </button>
          </div>
        )}

        <p
          className={`mt-2 text-[10px] leading-relaxed ${
            isLight ? 'text-slate-500' : 'text-slate-400'
          }`}
        >
          Replay starts at the UTC time above ({coverage.minYear}–{coverage.maxYear}{' '}
          verified archive). Selecting a weekend or market holiday automatically jumps
          to the next open trading day.
        </p>
      </div>

      {open && (
        <dialog
          ref={dialog}
          aria-labelledby="schedule-picker-title"
          onCancel={(event) => {
            event.preventDefault();
            setOpen(null);
          }}
          className={`schedule-picker w-[340px] max-w-[calc(100vw-24px)] rounded-2xl border p-4 shadow-2xl ${
            isLight
              ? 'border-emerald-500/30 bg-white text-slate-900'
              : 'border-emerald-500/30 bg-[#0d1722] text-slate-100 shadow-[0_25px_70px_rgba(0,0,0,0.85)]'
          }`}
        >
          <div className="mb-3 flex items-center justify-between">
            <h3
              id="schedule-picker-title"
              className={`text-sm font-bold ${
                isLight ? 'text-slate-900' : 'text-white'
              }`}
            >
              {title}
            </h3>
            <button
              type="button"
              aria-label="Close date and time picker"
              onClick={() => setOpen(null)}
              className={`rounded-lg p-1.5 transition ${
                isLight
                  ? 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
                  : 'text-slate-400 hover:bg-white/10 hover:text-white'
              }`}
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {(open === 'start' || open === 'end') && (
            <>
              <div className="mb-2.5 flex items-center justify-between gap-1">
                <button
                  type="button"
                  aria-label="Previous month"
                  onClick={() => changeMonth(-1)}
                  disabled={iso(first).slice(0, 7) <= min.slice(0, 7)}
                  className={`rounded-lg p-1.5 transition disabled:opacity-20 ${
                    isLight ? 'hover:bg-slate-100' : 'hover:bg-white/10'
                  }`}
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => setView(view === 'months' ? 'days' : 'months')}
                    className={`rounded-lg px-2 py-1 text-xs font-bold transition ${
                      isLight ? 'hover:bg-slate-100' : 'hover:bg-white/10'
                    }`}
                  >
                    {months[month.getUTCMonth()]}
                  </button>
                  <button
                    type="button"
                    aria-label="Choose year"
                    onClick={() => setView(view === 'years' ? 'days' : 'years')}
                    className={`rounded-lg px-2 py-1 text-xs font-bold transition ${
                      isLight
                        ? 'text-teal-700 hover:bg-slate-100'
                        : 'text-emerald-400 hover:bg-white/10'
                    }`}
                  >
                    {month.getUTCFullYear()}
                  </button>
                </div>
                <button
                  type="button"
                  aria-label="Next month"
                  onClick={() => changeMonth(1)}
                  disabled={iso(first).slice(0, 7) >= max.slice(0, 7)}
                  className={`rounded-lg p-1.5 transition disabled:opacity-20 ${
                    isLight ? 'hover:bg-slate-100' : 'hover:bg-white/10'
                  }`}
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>

              {view === 'years' ? (
                <div className="space-y-2">
                  <div className="grid max-h-60 grid-cols-4 gap-1 overflow-y-auto custom-scrollbar">
                    {supportedYears.map((year) => {
                      const isDisabled =
                        year < parse(min).getUTCFullYear() ||
                        year > parse(max).getUTCFullYear() ||
                        !coverage.isYearSupported(year);
                      const isCurrent = year === month.getUTCFullYear();
                      return (
                        <button
                          type="button"
                          key={year}
                          disabled={isDisabled}
                          onClick={() => {
                            let targetMonth = month.getUTCMonth();
                            const ym = `${year}-${String(targetMonth + 1).padStart(
                              2,
                              '0'
                            )}`;
                            if (
                              !coverage.isMonthSupported(ym) ||
                              ym < min.slice(0, 7) ||
                              ym > max.slice(0, 7)
                            ) {
                              const firstValidMonth = Array.from(
                                { length: 12 },
                                (_, m) => m
                              ).find((m) => {
                                const candidateYm = `${year}-${String(m + 1).padStart(
                                  2,
                                  '0'
                                )}`;
                                return (
                                  coverage.isMonthSupported(candidateYm) &&
                                  candidateYm >= min.slice(0, 7) &&
                                  candidateYm <= max.slice(0, 7)
                                );
                              });
                              if (firstValidMonth !== undefined)
                                targetMonth = firstValidMonth;
                            }
                            setMonth(new Date(Date.UTC(year, targetMonth, 1)));
                            applyYearAndMonthPreview(year, targetMonth);
                            setView('months');
                          }}
                          className={`rounded-lg py-2 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-20 ${
                            isCurrent
                              ? 'bg-gradient-to-r from-emerald-400 to-teal-400 font-bold text-slate-950'
                              : isLight
                              ? 'hover:bg-teal-50 text-slate-700'
                              : 'hover:bg-emerald-500/15 text-slate-200'
                          }`}
                        >
                          {year}
                        </button>
                      );
                    })}
                  </div>
                  <p
                    className={`text-center text-[10px] ${
                      isLight ? 'text-slate-500' : 'text-slate-400'
                    }`}
                  >
                    Only years with verified {symbol} candle data ({coverage.minYear}–
                    {coverage.maxYear}) are enabled.
                  </p>
                </div>
              ) : view === 'months' ? (
                <div className="grid grid-cols-3 gap-1">
                  {months.map((name, index) => {
                    const ym = `${month.getUTCFullYear()}-${String(index + 1).padStart(
                      2,
                      '0'
                    )}`;
                    const isDisabled =
                      ym < min.slice(0, 7) ||
                      ym > max.slice(0, 7) ||
                      !coverage.isMonthSupported(ym);
                    return (
                      <button
                        type="button"
                        key={name}
                        disabled={isDisabled}
                        onClick={() => {
                          const targetYear = month.getUTCFullYear();
                          setMonth(new Date(Date.UTC(targetYear, index, 1)));
                          applyYearAndMonthPreview(targetYear, index);
                          setView('days');
                        }}
                        className={`rounded-lg py-2.5 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-20 ${
                          isLight
                            ? 'hover:bg-teal-50 text-slate-700'
                            : 'hover:bg-emerald-500/15 text-slate-200'
                        }`}
                      >
                        {name.slice(0, 3)}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <>
                  <div
                    className={`mb-1 grid grid-cols-7 text-center text-[10px] font-semibold ${
                      isLight ? 'text-slate-400' : 'text-slate-500'
                    }`}
                  >
                    {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map((day) => (
                      <span key={day} className="py-1">
                        {day}
                      </span>
                    ))}
                  </div>
                  <div className="grid grid-cols-7 gap-1">
                    {days.map((date) => {
                      const value = iso(date);
                      const dow = date.getUTCDay();
                      const isWeekend =
                        cfg.category !== 'CRYPTO' && (dow === 0 || dow === 6);
                      const holidayName = isFixedMarketHolidayDate(value, symbol);
                      const isClosedDay = isWeekend || Boolean(holidayName);
                      const isDisabled =
                        value < min || value > max || !coverage.isDateSupported(value);
                      return (
                        <button
                          type="button"
                          key={value}
                          aria-label={value}
                          aria-pressed={value === selected}
                          disabled={isDisabled}
                          title={
                            isDisabled
                              ? 'No historical archive data for this date'
                              : open === 'start' && isClosedDay
                              ? `${
                                  holidayName || 'Weekend closure'
                                } — clicking jumps to next open trading day`
                              : value
                          }
                          onClick={() => choose(value)}
                          className={`rounded-lg py-1.5 text-xs tabular-nums transition disabled:cursor-not-allowed disabled:opacity-15 ${
                            value === selected
                              ? 'bg-gradient-to-r from-emerald-400 to-teal-400 font-bold text-slate-950 shadow-sm'
                              : date.getUTCMonth() !== month.getUTCMonth()
                              ? isLight
                                ? 'text-slate-300 hover:bg-slate-100'
                                : 'text-slate-600 hover:bg-white/5'
                              : isClosedDay && open === 'start'
                              ? isLight
                                ? 'bg-amber-500/5 text-amber-700/75 hover:bg-amber-500/15'
                                : 'bg-amber-500/10 text-amber-300/80 hover:bg-amber-500/20'
                              : isLight
                              ? 'text-slate-800 hover:bg-teal-50'
                              : 'text-slate-200 hover:bg-emerald-500/15'
                          } ${
                            value === max && value !== selected
                              ? 'ring-1 ring-inset ring-emerald-500/60'
                              : ''
                          }`}
                        >
                          {date.getUTCDate()}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
              <div
                className={`mt-3 flex items-center justify-between border-t pt-2.5 text-[11px] ${
                  isLight ? 'border-slate-200' : 'border-white/10'
                }`}
              >
                <span className={`font-mono font-semibold ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
                  {selected}
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => choose(max)}
                    className={`rounded-lg px-2 py-1 font-semibold transition ${
                      isLight
                        ? 'text-teal-700 hover:bg-emerald-400/10'
                        : 'text-emerald-400 hover:bg-emerald-500/15'
                    }`}
                  >
                    Latest ({max})
                  </button>
                  <button
                    type="button"
                    onClick={() => setOpen(null)}
                    className="rounded-lg bg-gradient-to-r from-emerald-400 to-teal-400 px-3 py-1 font-bold text-slate-950 transition hover:brightness-105"
                  >
                    Done
                  </button>
                </div>
              </div>
            </>
          )}

          {open === 'time' && (
            <>
              <p
                className={`mb-3 text-xs ${
                  isLight ? 'text-slate-600' : 'text-slate-300'
                }`}
              >
                Choose an exact replay start time in UTC.
              </p>
              <div className="flex items-center justify-center gap-3">
                <label className="text-center">
                  <span
                    className={`mb-1.5 block text-[10px] ${
                      isLight ? 'text-slate-500' : 'text-slate-400'
                    }`}
                  >
                    Hour
                  </span>
                  <input
                    aria-label="Start hour"
                    inputMode="numeric"
                    maxLength={2}
                    value={hour}
                    onChange={(event) =>
                      setHour(event.target.value.replace(/[^0-9]/g, ''))
                    }
                    className={numberInput}
                  />
                </label>
                <span
                  className={`pt-4 text-2xl ${
                    isLight ? 'text-slate-400' : 'text-slate-500'
                  }`}
                >
                  :
                </span>
                <label className="text-center">
                  <span
                    className={`mb-1.5 block text-[10px] ${
                      isLight ? 'text-slate-500' : 'text-slate-400'
                    }`}
                  >
                    Minute
                  </span>
                  <input
                    aria-label="Start minute"
                    inputMode="numeric"
                    maxLength={2}
                    value={minute}
                    onChange={(event) =>
                      setMinute(event.target.value.replace(/[^0-9]/g, ''))
                    }
                    className={numberInput}
                  />
                </label>
              </div>
              <div className="mt-4 grid grid-cols-6 gap-1">
                {Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0')).map(
                  (value) => (
                    <button
                      type="button"
                      key={value}
                      aria-label={`Hour ${value}`}
                      onClick={() => setHour(value)}
                      className={`rounded-lg py-1.5 text-xs font-mono font-semibold transition ${
                        Number(hour) === Number(value)
                          ? 'bg-gradient-to-r from-emerald-400 to-teal-400 text-slate-950 font-bold'
                          : isLight
                          ? 'bg-slate-100 text-slate-600 hover:bg-teal-50'
                          : 'bg-white/5 text-slate-300 hover:bg-emerald-500/15'
                      }`}
                    >
                      {value}
                    </button>
                  )
                )}
              </div>
              <div className="mt-2.5 flex justify-center gap-2">
                {['00', '15', '30', '45'].map((value) => (
                  <button
                    type="button"
                    key={value}
                    aria-label={`Minute ${value}`}
                    onClick={() => setMinute(value)}
                    className={`rounded-lg px-3 py-1 text-xs font-mono font-semibold transition ${
                      Number(minute) === Number(value)
                        ? isLight
                          ? 'bg-emerald-500/15 text-teal-800 font-bold'
                          : 'bg-emerald-500/20 text-emerald-300 font-bold'
                        : isLight
                        ? 'text-slate-500 hover:bg-slate-100'
                        : 'text-slate-400 hover:bg-white/10'
                    }`}
                  >
                    :{value}
                  </button>
                ))}
              </div>
              <button
                type="button"
                disabled={
                  !hour || !minute || Number(hour) > 23 || Number(minute) > 59
                }
                onClick={() => {
                  onTime(`${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`);
                  setOpen(null);
                }}
                className="mt-4 w-full rounded-xl bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 py-2.5 text-xs font-bold text-slate-950 shadow-md disabled:opacity-30"
              >
                Use this time
              </button>
            </>
          )}

          {open === 'zone' && (
            <div className="space-y-1">
              {zones.map((zone) => (
                <button
                  type="button"
                  key={zone.value}
                  onClick={() => {
                    onTimezone(zone.value);
                    setOpen(null);
                  }}
                  className={`flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-xs font-semibold transition ${
                    timezone === zone.value
                      ? isLight
                        ? 'bg-emerald-500/15 text-teal-800'
                        : 'bg-emerald-500/20 text-emerald-300'
                      : isLight
                      ? 'text-slate-700 hover:bg-slate-100'
                      : 'text-slate-200 hover:bg-white/10'
                  }`}
                >
                  <Globe2 className="h-4 w-4 opacity-60" />
                  <span className="flex-1">{zone.label}</span>
                  {timezone === zone.value && <Check className="h-3.5 w-3.5" />}
                </button>
              ))}
            </div>
          )}
        </dialog>
      )}
    </>
  );
}
