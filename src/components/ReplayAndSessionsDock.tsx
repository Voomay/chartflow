import React, { useEffect, useMemo, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  BacktestPosition,
  Candle,
  DrawingTool,
  EmotionalStateTag,
  InstrumentSymbol,
  SessionBox,
  SessionConfig,
  SessionId,
  ThemeMode,
  Timeframe,
  TradeJournalEntry,
  TradingSession,
} from '../types/trading';
import {
  getHistoricalReplayAvailability,
  getInstrumentConfig,
  getInstrumentHistoricalCoverage,
  getReplayWeekdayTarget,
  hasHistoricalArchive,
  isFixedMarketHolidayDate,
  isWeekendClosedTimestamp,
  snapToOpenTradingDate,
  TIMEFRAME_CONFIG,
} from '../services/goldDataService';
import {
  calculatePositionPnl,
  computeLiveSessionMetrics,
  formatMoney,
  formatTimestampInTimezone,
  getBidAskFromMid,
  getEffectiveInstrumentSpec,
} from '../services/simulationEngine';
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  BookOpen,
  Calendar,
  Camera,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Clock,
  Edit3,
  FastForward,
  GitBranch,
  Globe2,
  Layers,
  ListChecks,
  Lock,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Scissors,
  SkipBack,
  SkipForward,
  Sparkles,
  Star,
  Trophy,
  X,
} from 'lucide-react';

interface ReplayAndSessionsDockProps {
  session: TradingSession;
  symbol: InstrumentSymbol;
  candles: Candle[];
  allCandlesCount: number;
  replayIndex: number;
  isReplayMode: boolean;
  isPlaying: boolean;
  replayStepTimeframe:Timeframe;
  onSetReplayStepTimeframe:(timeframe:Timeframe)=>void;
  playbackSpeedMs: number;
  onSetPlaybackSpeedMs: (ms: number) => void;
  onTogglePlay: () => void;
  onStepBar: (delta: number) => void;
  onSkipToTimestamp: (targetTimestampSec: number) => { ok: boolean; error?: string };
  onBranchSession?: () => void;
  activeTool: DrawingTool;
  onSetActiveTool: (tool: DrawingTool) => void;
  sessions: SessionConfig[];
  onToggleSessionEnabled: (id: SessionId) => void;
  sessionBoxes: SessionBox[];
  onFocusSessionTime: (timestamp: number) => void;
  positions: BacktestPosition[];
  onModifyPositionOrOrder: (
    positionId: string,
    updates: {
      stopLoss?: number;
      takeProfit?: number;
      entryPrice?: number;
      lotSize?: number;
    }
  ) => { ok: boolean; error?: string };
  onClosePosition: (id: string, fraction?: number) => void;
  onMoveToBreakEven: (id: string) => void;
  onGoToSessionOpen?: (
    target: 'LONDON' | 'NEW_YORK' | 'TOKYO' | 'SYDNEY' | 'NEXT_DAY' | 'TRADE_EXIT'
  ) => void;
  onSaveJournalEntry: (tradeId: string, entry: TradeJournalEntry) => void;
  onOpenAnalyticsPage?: () => void;
  onStartNewChallengeAttempt?: (targetPhase?: 'PHASE_1' | 'PHASE_2') => void;
  timeframe: Timeframe;
  theme?: ThemeMode;
  requestedTab?:
    | 'open_positions'
    | 'pending_orders'
    | 'closed_trades'
    | 'journal'
    | 'challenge_objectives'
    | null;
  requestedJournalTradeId?: string | null;
}

const EMOTIONAL_STATES: { id: EmotionalStateTag; label: string; color: string }[] = [
  {
    id: 'Calm & Focused',
    label: 'Calm & Focused',
    color: 'text-emerald-400 border-emerald-500/40 bg-emerald-500/10',
  },
  {
    id: 'Confident',
    label: 'Confident',
    color: 'text-blue-400 border-blue-500/40 bg-blue-500/10',
  },
  {
    id: 'Hesitant',
    label: 'Hesitant',
    color: 'text-amber-400 border-amber-500/40 bg-amber-500/10',
  },
  {
    id: 'Anxious',
    label: 'Anxious',
    color: 'text-orange-400 border-orange-500/40 bg-orange-500/10',
  },
  {
    id: 'FOMO / Chasing',
    label: 'FOMO / Chasing',
    color: 'text-rose-400 border-rose-500/40 bg-rose-500/10',
  },
  {
    id: 'Revenge Trading',
    label: 'Revenge Trading',
    color: 'text-red-500 border-red-500/40 bg-red-500/15',
  },
  {
    id: 'Overconfident',
    label: 'Overconfident',
    color: 'text-purple-400 border-purple-500/40 bg-purple-500/10',
  },
];

const DEFAULT_CHECKLIST = [
  { id: 'chk-htf', label: 'Higher-timeframe bias & structure aligned', checked: false },
  { id: 'chk-liq', label: 'Key session liquidity / level swept or respected', checked: false },
  { id: 'chk-rr', label: 'Stop Loss placed at invalidation with >= 1.5R target', checked: false },
  { id: 'chk-risk', label: 'Position size within daily & overall risk rules', checked: false },
];

const MONTH_NAMES = [
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

const SKIP_TIMEZONE_OPTIONS = [
  {
    value: 'Africa/Johannesburg',
    flag: 'ZA' as const,
    code: 'SAST',
    offset: 'UTC+2',
    label: 'South Africa (SAST / UTC+2)',
  },
  {
    value: 'America/New_York',
    flag: 'US' as const,
    code: 'ET',
    offset: 'UTC-4',
    label: 'New York (ET / UTC-4)',
  },
  {
    value: 'Europe/London',
    flag: 'GB' as const,
    code: 'GMT',
    offset: 'BST/GMT',
    label: 'London (BST / GMT)',
  },
  {
    value: 'UTC',
    flag: 'UTC' as const,
    code: 'UTC',
    offset: 'UTC+0',
    label: 'Universal Time (UTC)',
  },
  {
    value: 'Asia/Tokyo',
    flag: 'JP' as const,
    code: 'JST',
    offset: 'UTC+9',
    label: 'Tokyo (JST / UTC+9)',
  },
  {
    value: 'Australia/Sydney',
    flag: 'AU' as const,
    code: 'AEST',
    offset: 'UTC+10',
    label: 'Sydney (AEST / UTC+10)',
  },
];

const SESSION_SKIP_CARDS = [
  {
    id: 'LONDON' as const,
    flag: 'GB' as const,
    code: 'LDN',
    name: 'London',
    utcTime: '08:00 UTC',
    sastTime: '10:00 SAST',
    hourUtc: 8,
    accentDark:
      'border-emerald-400/25 bg-gradient-to-br from-emerald-500/[0.10] via-teal-500/[0.04] to-transparent hover:border-emerald-400/60 hover:from-emerald-500/[0.18]',
    accentLight:
      'border-emerald-200/90 bg-gradient-to-br from-emerald-50/90 via-teal-50/40 to-white hover:border-emerald-400 hover:shadow-md',
    badgeDark: 'bg-emerald-400/15 text-emerald-300 border-emerald-400/30',
    badgeLight: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  },
  {
    id: 'NEW_YORK' as const,
    flag: 'US' as const,
    code: 'NYC',
    name: 'New York',
    utcTime: '13:00 UTC',
    sastTime: '15:00 SAST',
    hourUtc: 13,
    accentDark:
      'border-sky-400/25 bg-gradient-to-br from-sky-500/[0.10] via-blue-500/[0.04] to-transparent hover:border-sky-400/60 hover:from-sky-500/[0.18]',
    accentLight:
      'border-sky-200/90 bg-gradient-to-br from-sky-50/90 via-blue-50/40 to-white hover:border-sky-400 hover:shadow-md',
    badgeDark: 'bg-sky-400/15 text-sky-300 border-sky-400/30',
    badgeLight: 'bg-sky-100 text-sky-800 border-sky-300',
  },
  {
    id: 'TOKYO' as const,
    flag: 'JP' as const,
    code: 'TYO',
    name: 'Asia (Tokyo)',
    utcTime: '00:00 UTC',
    sastTime: '02:00 SAST',
    hourUtc: 0,
    accentDark:
      'border-violet-400/25 bg-gradient-to-br from-violet-500/[0.10] via-indigo-500/[0.04] to-transparent hover:border-violet-400/60 hover:from-violet-500/[0.18]',
    accentLight:
      'border-violet-200/90 bg-gradient-to-br from-violet-50/90 via-indigo-50/40 to-white hover:border-violet-400 hover:shadow-md',
    badgeDark: 'bg-violet-400/15 text-violet-300 border-violet-400/30',
    badgeLight: 'bg-violet-100 text-violet-800 border-violet-300',
  },
  {
    id: 'SYDNEY' as const,
    flag: 'AU' as const,
    code: 'SYD',
    name: 'Sydney (AU)',
    utcTime: '21:00 UTC',
    sastTime: '23:00 SAST',
    hourUtc: 21,
    accentDark:
      'border-cyan-400/25 bg-gradient-to-br from-cyan-500/[0.10] via-teal-500/[0.04] to-transparent hover:border-cyan-400/60 hover:from-cyan-500/[0.18]',
    accentLight:
      'border-cyan-200/90 bg-gradient-to-br from-cyan-50/90 via-teal-50/40 to-white hover:border-cyan-400 hover:shadow-md',
    badgeDark: 'bg-cyan-400/15 text-cyan-300 border-cyan-400/30',
    badgeLight: 'bg-cyan-100 text-cyan-800 border-cyan-300',
  },
];

function RegionFlagIcon({ code }: { code: 'GB' | 'US' | 'JP' | 'AU' | 'ZA' | 'UTC' }) {
  if (code === 'GB') {
    return (
      <svg viewBox="0 0 20 14" aria-hidden="true" className="w-4 h-3 rounded-[2px] shrink-0 shadow-sm">
        <rect width="20" height="14" fill="#012169" />
        <path d="M0,0 L20,14 M20,0 L0,14" stroke="#fff" strokeWidth="2.6" />
        <path d="M0,0 L20,14 M20,0 L0,14" stroke="#C8102E" strokeWidth="1.2" />
        <path d="M10,0 V14 M0,7 H20" stroke="#fff" strokeWidth="4.2" />
        <path d="M10,0 V14 M0,7 H20" stroke="#C8102E" strokeWidth="2.4" />
      </svg>
    );
  }
  if (code === 'US') {
    return (
      <svg viewBox="0 0 20 14" aria-hidden="true" className="w-4 h-3 rounded-[2px] shrink-0 shadow-sm">
        <rect width="20" height="14" fill="#B22234" />
        <path d="M0,2 H20 M0,4 H20 M0,6 H20 M0,8 H20 M0,10 H20 M0,12 H20" stroke="#fff" strokeWidth="1" />
        <rect width="9" height="7.5" fill="#3C3B6E" />
        <circle cx="2.5" cy="2.2" r="0.65" fill="#fff" />
        <circle cx="4.5" cy="3.8" r="0.65" fill="#fff" />
        <circle cx="6.5" cy="2.2" r="0.65" fill="#fff" />
        <circle cx="2.5" cy="5.3" r="0.65" fill="#fff" />
        <circle cx="6.5" cy="5.3" r="0.65" fill="#fff" />
      </svg>
    );
  }
  if (code === 'JP') {
    return (
      <svg viewBox="0 0 20 14" aria-hidden="true" className="w-4 h-3 rounded-[2px] shrink-0 shadow-sm border border-black/10">
        <rect width="20" height="14" fill="#ffffff" />
        <circle cx="10" cy="7" r="4" fill="#BC002D" />
      </svg>
    );
  }
  if (code === 'AU') {
    return (
      <svg viewBox="0 0 20 14" aria-hidden="true" className="w-4 h-3 rounded-[2px] shrink-0 shadow-sm">
        <rect width="20" height="14" fill="#00008B" />
        <path d="M0,0 L10,7 M10,0 L0,7" stroke="#fff" strokeWidth="1.5" />
        <path d="M5,0 V7 M0,3.5 H10" stroke="#fff" strokeWidth="2.2" />
        <path d="M5,0 V7 M0,3.5 H10" stroke="#C8102E" strokeWidth="1.2" />
        <circle cx="5" cy="10.5" r="1.1" fill="#fff" />
        <circle cx="15" cy="3.5" r="0.8" fill="#fff" />
        <circle cx="13" cy="6.5" r="0.8" fill="#fff" />
        <circle cx="16.8" cy="6.2" r="0.8" fill="#fff" />
        <circle cx="15" cy="10.2" r="0.9" fill="#fff" />
      </svg>
    );
  }
  if (code === 'ZA') {
    return (
      <svg viewBox="0 0 20 14" aria-hidden="true" className="w-4 h-3 rounded-[2px] shrink-0 shadow-sm">
        <rect width="20" height="7" fill="#E03C31" />
        <rect y="7" width="20" height="7" fill="#001489" />
        <path d="M0,0 L9,7 L0,14 M9,7 H20" stroke="#fff" strokeWidth="4.4" fill="none" />
        <path d="M0,0 L8.5,7 L0,14 M8.2,7 H20" stroke="#007749" strokeWidth="2.8" fill="none" />
        <polygon points="0,2 6,7 0,12" fill="#000" stroke="#FFB81C" strokeWidth="1" />
      </svg>
    );
  }
  return <Globe2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />;
}

function getTzOffsetMs(tsSec: number, tz: string): number {
  const p = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hourCycle: 'h23',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
  }).formatToParts(new Date(tsSec * 1000));
  const g = (t: string) => Number(p.find((x) => x.type === t)?.value);
  return Date.UTC(g('year'), g('month') - 1, g('day'), g('hour'), g('minute'), g('second')) - tsSec * 1000;
}

function formatTsToDateAndTimeInTz(tsSec: number, tz: string): { dateStr: string; timeStr: string } {
  const localMs = tsSec * 1000 + getTzOffsetMs(tsSec, tz);
  const iso = new Date(localMs).toISOString();
  return {
    dateStr: iso.slice(0, 10),
    timeStr: iso.slice(11, 16),
  };
}

function dateAndTimeInTzToTimestampSec(dateStr: string, timeStr: string, tz: string): number {
  const [y, m, d] = dateStr.split('-').map(Number);
  const [hh, mm] = timeStr.split(':').map(Number);
  const guessSec = Date.UTC(y, (m || 1) - 1, d || 1, hh || 0, mm || 0, 0) / 1000;
  return Math.floor(guessSec - getTzOffsetMs(guessSec, tz) / 1000);
}

function formatPrettyCalendarDate(dateStr: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${dateStr}T00:00:00Z`));
}

export const ReplayAndSessionsDock: React.FC<ReplayAndSessionsDockProps> = ({
  session,
  symbol,
  candles,
  isReplayMode,
  isPlaying,
  replayStepTimeframe,
  onSetReplayStepTimeframe,
  playbackSpeedMs,
  onSetPlaybackSpeedMs,
  onTogglePlay,
  onStepBar,
  onSkipToTimestamp,
  onBranchSession,
  activeTool,
  onSetActiveTool,
  positions,
  onModifyPositionOrOrder,
  onClosePosition,
  onMoveToBreakEven,
  onGoToSessionOpen,
  onSaveJournalEntry,
  onOpenAnalyticsPage,
  onStartNewChallengeAttempt,
  timeframe,
  theme = 'dark',
  requestedTab,
  requestedJournalTradeId,
}) => {
  const isLight = theme === 'light';
  // Bottom content starts collapsed (control bar stays visible); expand chevron nudges until first click
  const [isCollapsed, setIsCollapsed] = useState(true);
  const dockBodyRef=useRef<HTMLDivElement>(null);
  useEffect(()=>{if(dockBodyRef.current)dockBodyRef.current.inert=isCollapsed;},[isCollapsed]);
  const [dockHintActive, setDockHintActive] = useState<boolean>(() => {
    try {
      return localStorage.getItem('chart_replay_dock_hint_dismissed_v1') !== '1';
    } catch {
      return true;
    }
  });
  const dismissDockHint = () => {
    setDockHintActive(false);
    try {
      localStorage.setItem('chart_replay_dock_hint_dismissed_v1', '1');
    } catch {
      // ignore
    }
  };
  const [activeTab, setActiveTab] = useState<
    'open_positions' | 'pending_orders' | 'closed_trades' | 'journal' | 'challenge_objectives'
  >('open_positions');

  const [isSkipModalOpen, setIsSkipModalOpen] = useState(false);
  const [replayFeedback, setReplayFeedback] = useState<string | null>(null);
  const [customSkipTime, setCustomSkipTime] = useState<string>(
    () => localStorage.getItem('fx_customSkipTime') || '10:00'
  );
  const [customSkipTz, setCustomSkipTz] = useState<string>(
    () => localStorage.getItem('fx_customSkipTz') || 'Africa/Johannesburg'
  );
  const [quickSkipTarget, setQuickSkipTarget] = useState<
    'DAILY_TIME' | 'LONDON' | 'NEW_YORK' | 'TOKYO' | 'SYDNEY'
  >(() => {
    const saved = localStorage.getItem('fx_quickSkipTarget');
    return saved === 'LONDON' ||
      saved === 'NEW_YORK' ||
      saved === 'TOKYO' ||
      saved === 'SYDNEY' ||
      saved === 'DAILY_TIME'
      ? saved
      : 'DAILY_TIME';
  });
  const [isFloatingWidgetOpen, setIsFloatingWidgetOpen] = useState<boolean>(() => {
    try {
      return localStorage.getItem('fx_replayFloatingWidgetOpen') !== '0';
    } catch {
      return true;
    }
  });
  const [floatingWidgetOffset, setFloatingWidgetOffset] = useState<{ x: number; y: number }>({
    x: 0,
    y: 0,
  });
  const widgetDragRef = useRef<{
    startX: number;
    startY: number;
    origX: number;
    origY: number;
  } | null>(null);

  useEffect(() => {
    localStorage.setItem('fx_customSkipTime', customSkipTime);
    localStorage.setItem('fx_customSkipTz', customSkipTz);
  }, [customSkipTime, customSkipTz]);

  useEffect(() => {
    try {
      localStorage.setItem('fx_quickSkipTarget', quickSkipTarget);
    } catch {
      // ignore
    }
  }, [quickSkipTarget]);

  const toggleFloatingWidget = (nextOpen: boolean) => {
    setIsFloatingWidgetOpen(nextOpen);
    try {
      localStorage.setItem('fx_replayFloatingWidgetOpen', nextOpen ? '1' : '0');
    } catch {
      // ignore
    }
  };

  const handleWidgetDragStart = (e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button, select, input, label')) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    widgetDragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      origX: floatingWidgetOffset.x,
      origY: floatingWidgetOffset.y,
    };
  };

  const handleWidgetDragMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!widgetDragRef.current) return;
    const dx = e.clientX - widgetDragRef.current.startX;
    const dy = e.clientY - widgetDragRef.current.startY;
    setFloatingWidgetOffset({
      x: widgetDragRef.current.origX + dx,
      y: widgetDragRef.current.origY + dy,
    });
  };

  const handleWidgetDragEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!widgetDragRef.current) return;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
    widgetDragRef.current = null;
  };

  const speedMultiplier = useMemo(() => {
    const raw = 850 / Math.max(40, Math.min(1000, playbackSpeedMs));
    return Math.max(1, Math.min(20, Number(raw.toFixed(1))));
  }, [playbackSpeedMs]);

  const handleSpeedSliderChange = (sliderVal: number) => {
    const mult = Math.max(1, Math.min(20, sliderVal / 10));
    const nextMs = Math.max(40, Math.min(850, Math.round(850 / mult)));
    onSetPlaybackSpeedMs(nextMs);
  };

  // Custom pickers & inline notice inside Skip Replay To modal
  const [activeSkipPicker, setActiveSkipPicker] = useState<
    null | 'daily_time' | 'daily_tz' | 'exact_date' | 'exact_time'
  >(null);
  const [skipModalNotice, setSkipModalNotice] = useState<{
    text: string;
    tone: 'warning' | 'error' | 'info';
  } | null>(null);
  const [weekendSkipPopup, setWeekendSkipPopup] = useState<{
    title: string;
    message: string;
    targetDatePretty: string;
    targetTimeLabel: string;
  } | null>(null);
  useEffect(() => {
    if (!weekendSkipPopup) return;
    const timer = setTimeout(() => setWeekendSkipPopup(null), 5500);
    return () => clearTimeout(timer);
  }, [weekendSkipPopup]);
  const [exactSkipTz, setExactSkipTz] = useState<'Africa/Johannesburg' | 'UTC'>(
    'Africa/Johannesburg'
  );
  const [exactSkipDate, setExactSkipDate] = useState<string>('2015-01-19');
  const [exactSkipTime, setExactSkipTime] = useState<string>('11:35');
  const [pickerMonth, setPickerMonth] = useState<Date>(() => new Date(Date.UTC(2015, 0, 1)));
  const [pickerCalendarView, setPickerCalendarView] = useState<'days' | 'months' | 'years'>('days');
  const [pickerHour, setPickerHour] = useState<string>('10');
  const [pickerMinute, setPickerMinute] = useState<string>('00');

  // Inline editing states for Open Positions & Pending Orders
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [editEntryInput, setEditEntryInput] = useState<string>('');
  const [editSLInput, setEditSLInput] = useState<string>('');
  const [editTPInput, setEditTPInput] = useState<string>('');
  const [editLotsInput, setEditLotsInput] = useState<string>('');

  // Trade Journal state
  const [selectedJournalTradeId, setSelectedJournalTradeId] = useState<string>('');
  const [journalSaveStatus, setJournalSaveStatus] = useState<string>('Saved automatically ✓');
  const [newChecklistText, setNewChecklistText] = useState<string>('');

  const replayTs =
    session.replayTimestamp || session.startTimestamp || Math.floor(Date.now() / 1000);
  const startTs = session.startTimestamp || replayTs - 86400;
  const endTs = session.endTimestamp || replayTs + 86400;
  const rules = session.frozenConfig?.propFirmRules || session.propFirmRules;
  const currency =
    session.frozenConfig?.accountCurrency || session.accountCurrency || 'USD';
  const isLocked =
    session.status === 'FAILED' ||
    session.status === 'PASSED' ||
    session.challengeState?.status === 'FAILED' ||
    session.challengeState?.status === 'PASSED';

  useEffect(() => {
    if (requestedTab) {
      setActiveTab(requestedTab);
      setIsCollapsed(false);
    }
  }, [requestedTab]);

  useEffect(() => {
    if (requestedJournalTradeId) {
      setSelectedJournalTradeId(requestedJournalTradeId);
      setActiveTab('journal');
      setIsCollapsed(false);
    }
  }, [requestedJournalTradeId]);

  useEffect(() => {
    const parts = formatTsToDateAndTimeInTz(replayTs, exactSkipTz);
    setExactSkipDate(parts.dateStr);
    setExactSkipTime(parts.timeStr);
    const [y, m] = parts.dateStr.split('-').map(Number);
    if (Number.isFinite(y) && Number.isFinite(m)) {
      setPickerMonth(new Date(Date.UTC(y, m - 1, 1)));
    }
  }, [replayTs, exactSkipTz]);

  useEffect(() => {
    if (!isSkipModalOpen) {
      setActiveSkipPicker(null);
      return;
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (activeSkipPicker) {
          e.stopPropagation();
          setActiveSkipPicker(null);
        } else {
          setIsSkipModalOpen(false);
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isSkipModalOpen, activeSkipPicker]);

  const openPositions = useMemo(
    () => positions.filter((p) => p.status === 'OPEN'),
    [positions]
  );
  const pendingOrders = useMemo(
    () => positions.filter((p) => p.status === 'PENDING'),
    [positions]
  );
  const closedTrades = useMemo(
    () =>
      positions
        .filter((p) => p.status.startsWith('CLOSED_'))
        .slice()
        .sort((a, b) => (b.exitTime || b.entryTime) - (a.exitTime || a.entryTime)),
    [positions]
  );

  useEffect(() => {
    if (
      positions.length > 0 &&
      (!selectedJournalTradeId || !positions.some((p) => p.id === selectedJournalTradeId))
    ) {
      setSelectedJournalTradeId(positions[positions.length - 1].id);
    }
  }, [positions, selectedJournalTradeId]);

  const liveMetrics = useMemo(() => computeLiveSessionMetrics(session), [session]);
  const isPropChallenge = session.mode === 'PROP_FIRM';
  const currentCandle = candles[candles.length - 1];
  const currentMidPrice = currentCandle?.close || getInstrumentConfig(symbol).basePrice;

  const startEditingRow = (pos: BacktestPosition) => {
    const posSym = pos.symbol || session.activeAsset || 'XAUUSD';
    const posSpec = getEffectiveInstrumentSpec(posSym, session);
    setEditingRowId(pos.id);
    setEditEntryInput(pos.entryPrice.toFixed(posSpec.decimals));
    setEditSLInput(pos.stopLoss > 0 ? pos.stopLoss.toFixed(posSpec.decimals) : '0');
    setEditTPInput(pos.takeProfit > 0 ? pos.takeProfit.toFixed(posSpec.decimals) : '0');
    setEditLotsInput(pos.lotSize.toFixed(2));
  };

  const commitRowEdit = (pos: BacktestPosition) => {
    const res = onModifyPositionOrOrder(pos.id, {
      entryPrice: pos.status === 'PENDING' ? Number(editEntryInput) : undefined,
      stopLoss: Number(editSLInput) || 0,
      takeProfit: Number(editTPInput) || 0,
      lotSize: pos.status === 'PENDING' ? Number(editLotsInput) : undefined,
    });
    if (!res.ok && res.error) {
      setReplayFeedback(res.error);
      setTimeout(() => setReplayFeedback(null), 4000);
    } else {
      setEditingRowId(null);
    }
  };

  const coverage = useMemo(() => getInstrumentHistoricalCoverage(symbol), [symbol]);
  const instrumentCfg = useMemo(() => getInstrumentConfig(symbol), [symbol]);

  const handleChooseExactDate = (rawIsoDate: string) => {
    const snapped = snapToOpenTradingDate(rawIsoDate, symbol, 'forward');
    setExactSkipDate(snapped.date);
    const [y, m] = snapped.date.split('-').map(Number);
    if (Number.isFinite(y) && Number.isFinite(m)) {
      setPickerMonth(new Date(Date.UTC(y, m - 1, 1)));
    }
    if (snapped.adjusted && snapped.reason) {
      setSkipModalNotice({ text: snapped.reason, tone: 'warning' });
    } else {
      setSkipModalNotice(null);
    }
    setActiveSkipPicker(null);
  };

  const handleSkipToCustomTime = () => {
    const [hh, mm] = customSkipTime.split(':').map(Number);
    if (!Number.isFinite(hh) || !Number.isFinite(mm)) return;
    const localNow = new Date(replayTs * 1000 + getTzOffsetMs(replayTs, customSkipTz));
    const startLocalDow = localNow.getUTCDay();
    let skippedClosureLabel: string | null = null;

    for (let i = 0; i <= 10; i++) {
      const guess =
        Date.UTC(
          localNow.getUTCFullYear(),
          localNow.getUTCMonth(),
          localNow.getUTCDate() + i,
          hh,
          mm
        ) / 1000;
      let target = Math.floor(guess - getTzOffsetMs(guess, customSkipTz) / 1000);
      if (target <= replayTs) continue;

      if (instrumentCfg.category !== 'CRYPTO') {
        const candidateLocal = formatTsToDateAndTimeInTz(target, customSkipTz);
        const localDow = new Date(`${candidateLocal.dateStr}T00:00:00Z`).getUTCDay();
        const utcIsoDate = new Date(target * 1000).toISOString().slice(0, 10);
        const holiday =
          isFixedMarketHolidayDate(candidateLocal.dateStr, symbol) ||
          isFixedMarketHolidayDate(utcIsoDate, symbol);
        const isLocalWeekend = localDow === 6 || localDow === 0;
        const isMarketClosedWeekend =
          isWeekendClosedTimestamp(target, symbol) ||
          (localDow !== 1 && getReplayWeekdayTarget(symbol, target) !== target);
        if (isLocalWeekend || isMarketClosedWeekend || holiday) {
          if (!skippedClosureLabel) {
            skippedClosureLabel = holiday || 'Weekend closure';
          }
          continue;
        }
        if (hasHistoricalArchive(symbol)) {
          const avail = getHistoricalReplayAvailability(symbol, target);
          if (avail && avail.kind === 'WEEKEND') {
            if (!skippedClosureLabel) {
              skippedClosureLabel = 'Weekend closure';
            }
            continue;
          }
          if (avail && avail.kind === 'GAP' && avail.nextTime !== undefined) {
            target = avail.nextTime;
          }
        }
      }

      if (session.endTimestamp && target > session.endTimestamp) {
        setSkipModalNotice({
          text: 'Next daily skip time exceeds this session end date. Extend the session or pick an earlier time.',
          tone: 'error',
        });
        return;
      }

      const res = onSkipToTimestamp(target);
      if (!res.ok && res.error) {
        setSkipModalNotice({ text: res.error, tone: 'error' });
        setReplayFeedback(res.error);
        setTimeout(() => setReplayFeedback(null), 4000);
      } else {
        setSkipModalNotice(null);
        const targetLocal = formatTsToDateAndTimeInTz(target, customSkipTz);
        const targetLocalDow = new Date(`${targetLocal.dateStr}T00:00:00Z`).getUTCDay();
        const crossedWeekendFromFriday =
          instrumentCfg.category !== 'CRYPTO' &&
          (skippedClosureLabel !== null ||
            ((startLocalDow === 5 || startLocalDow === 6 || startLocalDow === 0) &&
              targetLocalDow === 1));
        if (crossedWeekendFromFriday) {
          const nextDatePretty = formatPrettyCalendarDate(targetLocal.dateStr);
          const tzObj =
            SKIP_TIMEZONE_OPTIONS.find((t) => t.value === customSkipTz) ||
            SKIP_TIMEZONE_OPTIONS[0];
          const isHoliday =
            skippedClosureLabel !== null && skippedClosureLabel !== 'Weekend closure';
          setReplayFeedback(
            `${skippedClosureLabel || 'Weekend closure'} skipped → ${nextDatePretty} (${targetLocal.timeStr} ${tzObj.code})`
          );
          setTimeout(() => setReplayFeedback(null), 5000);
          setWeekendSkipPopup({
            title: isHoliday
              ? `Skipping Market Holiday (${skippedClosureLabel})`
              : 'Skipping Over to Monday',
            message: isHoliday
              ? `We're skipping over ${skippedClosureLabel} because the markets are closed, jumping directly to the next open trading day.`
              : "We're skipping over to Monday because the markets are closed on the weekend.",
            targetDatePretty: nextDatePretty,
            targetTimeLabel: `${targetLocal.timeStr} ${tzObj.code}`,
          });
        } else {
          setReplayFeedback(null);
        }
        setIsSkipModalOpen(false);
      }
      return;
    }
  };

  const handleExecuteSessionSkip = (
    cardId: 'LONDON' | 'NEW_YORK' | 'TOKYO' | 'SYDNEY'
  ) => {
    setQuickSkipTarget(cardId);
    const card = SESSION_SKIP_CARDS.find((c) => c.id === cardId);
    if (card && instrumentCfg.category !== 'CRYPTO') {
      const d = new Date(replayTs * 1000);
      const nextDate = new Date(
        Date.UTC(
          d.getUTCFullYear(),
          d.getUTCMonth(),
          d.getUTCDate(),
          card.hourUtc,
          0,
          0
        )
      );
      if (Math.floor(nextDate.getTime() / 1000) <= replayTs) {
        nextDate.setUTCDate(nextDate.getUTCDate() + 1);
      }
      let crossedWeekend = false;
      for (let i = 0; i < 10; i++) {
        const dow = nextDate.getUTCDay();
        const isoDate = nextDate.toISOString().slice(0, 10);
        const holiday = isFixedMarketHolidayDate(isoDate, symbol);
        const isWeekendClosed =
          card.id === 'SYDNEY' ? dow === 5 || dow === 6 : dow === 6 || dow === 0;
        if (!isWeekendClosed && !holiday) break;
        crossedWeekend = true;
        nextDate.setUTCDate(nextDate.getUTCDate() + 1);
      }
      if (crossedWeekend) {
        const targetSec = Math.floor(nextDate.getTime() / 1000);
        const targetLocal = formatTsToDateAndTimeInTz(
          targetSec,
          'Africa/Johannesburg'
        );
        setWeekendSkipPopup({
          title: 'Skipping Over to Monday',
          message:
            "We're skipping over to Monday because the markets are closed on the weekend.",
          targetDatePretty: formatPrettyCalendarDate(targetLocal.dateStr),
          targetTimeLabel: `${card.name} (${card.sastTime})`,
        });
      }
    }
    onGoToSessionOpen?.(cardId);
    setIsSkipModalOpen(false);
  };

  const handleQuickSkip = () => {
    if (isLocked) return;
    if (quickSkipTarget === 'DAILY_TIME') {
      handleSkipToCustomTime();
    } else {
      handleExecuteSessionSkip(quickSkipTarget);
    }
  };

  const quickSkipTzCode = useMemo(() => {
    const found = SKIP_TIMEZONE_OPTIONS.find((t) => t.value === customSkipTz);
    return found ? found.code : 'SAST';
  }, [customSkipTz]);

  const quickSkipButtonLabel = useMemo(() => {
    if (quickSkipTarget === 'DAILY_TIME') {
      return `${customSkipTime} ${quickSkipTzCode}`;
    }
    const card = SESSION_SKIP_CARDS.find((c) => c.id === quickSkipTarget);
    return card ? card.name : quickSkipTarget;
  }, [quickSkipTarget, customSkipTime, quickSkipTzCode]);

  const handleSkipToDateTime = () => {
    if (!exactSkipDate || !exactSkipTime) return;
    const snapped = snapToOpenTradingDate(exactSkipDate, symbol, 'forward');
    const effectiveDate = snapped.date;
    let noticeMsg = snapped.adjusted && snapped.reason ? snapped.reason : null;

    if (snapped.adjusted) {
      setExactSkipDate(effectiveDate);
    }

    let targetSec = dateAndTimeInTzToTimestampSec(effectiveDate, exactSkipTime, exactSkipTz);
    if (!Number.isFinite(targetSec)) return;

    // Also advance if Friday evening after market close or weekend in UTC
    if (instrumentCfg.category !== 'CRYPTO') {
      const weekdayTarget = getReplayWeekdayTarget(symbol, targetSec);
      if (weekdayTarget !== targetSec || isWeekendClosedTimestamp(targetSec, symbol)) {
        const baseTarget = weekdayTarget !== targetSec ? weekdayTarget : targetSec + 2 * 86400;
        const nextOpenIso = new Date(baseTarget * 1000).toISOString().slice(0, 10);
        const snappedNext = snapToOpenTradingDate(nextOpenIso, symbol, 'forward');
        targetSec = dateAndTimeInTzToTimestampSec(snappedNext.date, exactSkipTime, exactSkipTz);
        setExactSkipDate(snappedNext.date);
        noticeMsg = `Market closed at selected weekend time — jumped to ${formatPrettyCalendarDate(
          snappedNext.date
        )} (${exactSkipTime}).`;
      }
      if (hasHistoricalArchive(symbol)) {
        const avail = getHistoricalReplayAvailability(symbol, targetSec);
        if (avail && avail.kind !== 'READY' && avail.nextTime !== undefined) {
          targetSec = avail.nextTime;
        }
      }
    }

    if (isPropChallenge && targetSec < replayTs) {
      setSkipModalNotice({
        text: 'Rewind and backward date changes are disabled in Prop Firm Challenge mode. Choose a time after the current replay clock.',
        tone: 'error',
      });
      return;
    }

    if (session.startTimestamp && targetSec < session.startTimestamp) {
      setSkipModalNotice({
        text: `Selected time is before session start (${formatPrettyCalendarDate(
          new Date(session.startTimestamp * 1000).toISOString().slice(0, 10)
        )}).`,
        tone: 'warning',
      });
      targetSec = session.startTimestamp;
    } else if (session.endTimestamp && targetSec > session.endTimestamp) {
      setSkipModalNotice({
        text: `Selected time is after session end (${formatPrettyCalendarDate(
          new Date(session.endTimestamp * 1000).toISOString().slice(0, 10)
        )}).`,
        tone: 'error',
      });
      return;
    }

    const res = onSkipToTimestamp(targetSec);
    if (!res.ok && res.error) {
      setSkipModalNotice({ text: res.error, tone: 'error' });
      setReplayFeedback(res.error);
      setTimeout(() => setReplayFeedback(null), 4000);
    } else {
      setSkipModalNotice(null);
      if (noticeMsg) {
        setReplayFeedback(noticeMsg);
        setTimeout(() => setReplayFeedback(null), 4500);
        const targetLocal = formatTsToDateAndTimeInTz(targetSec, exactSkipTz);
        const exactTzLabel = exactSkipTz === 'Africa/Johannesburg' ? 'SAST' : 'UTC';
        setWeekendSkipPopup({
          title: 'Skipping Over to Monday',
          message: "We're skipping over to Monday because the markets are closed on the weekend.",
          targetDatePretty: formatPrettyCalendarDate(targetLocal.dateStr),
          targetTimeLabel: `${targetLocal.timeStr} ${exactTzLabel}`,
        });
      } else {
        setReplayFeedback(null);
      }
      setIsSkipModalOpen(false);
    }
  };

  // Current trade selected in Journal
  const activeJournalTrade = useMemo(
    () => positions.find((p) => p.id === selectedJournalTradeId) || null,
    [positions, selectedJournalTradeId]
  );

  const currentJournalEntry: TradeJournalEntry = useMemo(() => {
    if (!activeJournalTrade) {
      return {
        positionId: '',
        sessionId: session.id,
        strategyTag: session.strategyName || 'Price Action',
        setupTags: ['London Breakout'],
        entryReasoning: '',
        exitReasoning: '',
        notes: '',
        screenshots: [],
        emotionalState: 'Calm & Focused',
        checklist: DEFAULT_CHECKLIST,
        lessonsLearned: '',
        rating: 5,
        updatedAt: new Date().toISOString(),
      };
    }
    const existing = session.journals?.[activeJournalTrade.id];
    if (existing) return existing;
    return {
      positionId: activeJournalTrade.id,
      sessionId: session.id,
      strategyTag: session.strategyName || 'Price Action',
      setupTags: activeJournalTrade.journalTags || ['Breakout'],
      entryReasoning: activeJournalTrade.journalEntryReasoning || '',
      exitReasoning: activeJournalTrade.journalExitReasoning || '',
      notes: activeJournalTrade.journalNotes || '',
      screenshots: activeJournalTrade.journalScreenshots || [],
      emotionalState: activeJournalTrade.journalEmotionalState || 'Calm & Focused',
      checklist:
        activeJournalTrade.journalChecklist ||
        DEFAULT_CHECKLIST.map((item) => ({ ...item })),
      lessonsLearned: activeJournalTrade.journalLessonsLearned || '',
      rating: activeJournalTrade.journalRating || 4,
      updatedAt: new Date().toISOString(),
    };
  }, [activeJournalTrade, session.journals, session.id, session.strategyName]);

  const updateActiveJournal = (patch: Partial<TradeJournalEntry>) => {
    if (!activeJournalTrade) return;
    setJournalSaveStatus('Saving...');
    const updated: TradeJournalEntry = {
      ...currentJournalEntry,
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    onSaveJournalEntry(activeJournalTrade.id, updated);
    const nowStr = new Date().toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    setTimeout(() => {
      setJournalSaveStatus(`Saved automatically ✓ (${nowStr})`);
    }, 180);
  };

  const handleCaptureChartSnapshot = () => {
    if (!activeJournalTrade) return;
    const canvases = document.querySelectorAll('canvas');
    let snapshotDataUrl = '';
    for (let i = 0; i < canvases.length; i++) {
      const c = canvases[i];
      if (c.width > 300 && c.height > 200) {
        try {
          snapshotDataUrl = c.toDataURL('image/png');
          break;
        } catch {
          // ignore
        }
      }
    }
    if (!snapshotDataUrl) {
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="320" viewBox="0 0 600 320"><rect width="600" height="320" fill="#0b0e14"/><text x="30" y="60" fill="#2962ff" font-family="monospace" font-size="20" font-weight="bold">AURUM REPLAY CHART SNAPSHOT</text><text x="30" y="110" fill="#e2e8f0" font-family="monospace" font-size="16">${activeJournalTrade.symbol} ${activeJournalTrade.side} @ ${activeJournalTrade.entryPrice}</text><text x="30" y="150" fill="#94a3b8" font-family="monospace" font-size="14">Replay Clock: ${formatTimestampInTimezone(replayTs, session.displayTimezone)}</text></svg>`;
      snapshotDataUrl = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
    }
    updateActiveJournal({
      screenshots: [...currentJournalEntry.screenshots, snapshotDataUrl],
    });
  };

  const dockBg = isLight
    ? 'bg-white border-[#e0e3eb] text-[#131722]'
    : 'bg-[#12151b] border-[#242832] text-[#d1d4dc]';
  const subBarBg = isLight
    ? 'bg-[#f8f9fd] border-[#e0e3eb]'
    : 'bg-[#0d0f13] border-[#242832]';
  const cardBg = isLight
    ? 'bg-[#f8f9fd] border-[#e0e3eb]'
    : 'bg-[#161920] border-[#262a34]';

  const progressRatio = Math.max(
    0,
    Math.min(100, ((replayTs - startTs) / Math.max(1, endTs - startTs)) * 100)
  );

  return (
    <div
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      className={`border-t flex flex-col select-none shrink-0 z-20 ${dockBg}`}
    >
      {/* TOP BAR: Authoritative Replay Controls & Bottom Panel Tabs */}
      <div className={`h-11 border-b flex items-center gap-2 pr-3 ${subBarBg}`}>
      <div
        className={`flex-1 min-w-0 h-full pl-3 flex items-center justify-between gap-2 overflow-x-auto no-scrollbar`}
      >
        {!isReplayMode && <span className="shrink-0 text-[10px] font-bold text-emerald-400 px-2">LIVE PAPER · Simulated money · Quotes 5s</span>}
        {/* Left: Replay Transport Controls */}
        <div className={isReplayMode ? "flex items-center gap-1.5 shrink-0" : "hidden"} data-tour="replay-controls">
          {!isPropChallenge ? (
            <button
              onClick={() =>
                onSetActiveTool(activeTool === 'replay_cut' ? 'cursor' : 'replay_cut')
              }
              className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] font-bold border transition ${
                activeTool === 'replay_cut'
                  ? 'bg-amber-500 text-slate-950 border-amber-400'
                  : cardBg
              }`}
              title="Click any bar on chart to jump/rewind (Normal Mode)"
            >
              <Scissors className="w-3.5 h-3.5 text-amber-500" />
              <span className="hidden xl:inline">Cut</span>
            </button>
          ) : (
            <span
              className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-mono font-bold bg-amber-500/10 border border-amber-500/30 text-amber-400"
              title="Rewind and backward date changes are strictly disabled in Prop Firm Challenge mode"
            >
              <Lock className="w-3 h-3" /> NO REWIND
            </span>
          )}

          {/* Rewind -1 Bar (Disabled in Prop Firm mode) */}
          <button
            disabled={isPropChallenge}
            onClick={() => onStepBar(-1)}
            className={`p-1.5 rounded border transition ${
              isPropChallenge
                ? 'opacity-30 cursor-not-allowed border-transparent'
                : `${cardBg} hover:border-emerald-500/60`
            }`}
            title={
              isPropChallenge
                ? 'Rewind disabled in Prop Firm Challenge'
                : `Rewind by ${replayStepTimeframe} (Restores checkpoint state)`
            }
          >
            <SkipBack className="w-3.5 h-3.5" />
          </button>

          {/* Play / Pause Button */}
          <button
            disabled={isLocked}
            onClick={onTogglePlay}
            className={`flex items-center gap-1 px-2.5 sm:px-3 py-1 rounded-lg text-xs font-extrabold transition shadow ${
              isPlaying
                ? 'bg-amber-500 text-slate-950'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white'
            }`}
            title={isPlaying ? 'Pause Historical Replay' : 'Play Historical Replay'}
          >
            {isPlaying ? (
              <>
                <Pause className="w-3.5 h-3.5 fill-current" />
                <span>Pause</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Play</span>
              </>
            )}
          </button>

          {/* Step Forward +1 Bar */}
          <button
            disabled={isLocked}
            onClick={() => onStepBar(1)}
            className={`flex items-center gap-1 px-2 py-1 rounded border text-[11px] font-mono font-bold transition ${cardBg} hover:border-emerald-500/60`}
            title={`Advance by ${replayStepTimeframe}`}
          >
            <SkipForward className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden sm:inline">+{replayStepTimeframe}</span>
          </button>

          <label className={`flex items-center gap-1 rounded border px-2 py-1 text-[11px] ${cardBg}`} title="Replay step size per tick"><span className="opacity-60">Step</span><select aria-label="Replay step" value={replayStepTimeframe} disabled={isLocked||!isReplayMode} onChange={event=>onSetReplayStepTimeframe(event.target.value as Timeframe)} className="min-w-0 bg-transparent font-mono font-bold outline-none">{(['1m','5m','15m','30m','1H','4H','1D'] as Timeframe[]).map(step=><option key={step} value={step} className={isLight?'bg-white text-slate-900':'bg-[#131722] text-slate-200'}>{TIMEFRAME_CONFIG[step].label}</option>)}</select></label>

          {/* Smooth Replay Speed Slider */}
          <div
            className={`flex items-center gap-1.5 px-2 py-1 rounded border text-[11px] font-mono font-bold ${cardBg}`}
            title={`Smooth Replay Speed (${speedMultiplier.toFixed(1)}x)`}
          >
            <span className="text-[10px] opacity-65 hidden md:inline">Speed</span>
            <input
              type="range"
              aria-label="Replay speed slider"
              min={10}
              max={200}
              step={1}
              value={Math.round(speedMultiplier * 10)}
              onChange={(e) => handleSpeedSliderChange(Number(e.target.value))}
              className="w-16 sm:w-20 h-1.5 accent-emerald-500 cursor-pointer"
            />
            <span className="min-w-[34px] text-right text-emerald-400 tabular-nums">
              {speedMultiplier >= 10
                ? `${Math.round(speedMultiplier)}x`
                : `${speedMultiplier.toFixed(1)}x`}
            </span>
          </div>

          {/* 1-Click Quick Skip + Skip To Modal Button + Floating Widget Toggle */}
          <div className="flex shrink-0 items-center gap-1 pl-1 border-l border-gray-500/20">
            <button
              type="button"
              disabled={isLocked}
              onClick={handleQuickSkip}
              className={`px-2.5 py-1 rounded-lg border text-[11px] font-extrabold flex items-center gap-1 transition shadow-sm ${
                isLight
                  ? 'bg-emerald-600 hover:bg-emerald-500 border-emerald-600 text-white'
                  : 'bg-emerald-500/20 hover:bg-emerald-500/30 border-emerald-400/50 text-emerald-200'
              }`}
              title={`1-Click Quick Skip directly to next ${quickSkipButtonLabel} (change target in Skip To)`}
            >
              <FastForward className="w-3.5 h-3.5 text-emerald-300" />
              <span>Skip → {quickSkipButtonLabel}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setSkipModalNotice(null);
                setActiveSkipPicker(null);
                setIsSkipModalOpen(true);
              }}
              className={`px-2 py-1 rounded-lg border text-[11px] font-bold flex items-center gap-1 transition ${
                isLight
                  ? 'bg-emerald-50/80 hover:bg-emerald-100/80 border-emerald-300/80 text-emerald-950 shadow-sm'
                  : 'bg-emerald-500/10 hover:bg-emerald-500/20 border-emerald-400/30 text-emerald-100 shadow-sm'
              }`}
              title="Configure Skip To session or daily time"
            >
              <Clock className="w-3 h-3 text-emerald-400" />
              <span className="hidden sm:inline">Skip To</span>
            </button>

            {!isFloatingWidgetOpen && (
              <button
                type="button"
                onClick={() => toggleFloatingWidget(true)}
                className={`px-2 py-1 rounded-lg border text-[10px] font-bold flex items-center gap-1 transition ${cardBg} hover:border-emerald-500/60`}
                title="Show floating replay control widget on chart"
              >
                <Sparkles className="w-3 h-3 text-emerald-400" />
                <span className="hidden lg:inline">Chart Bar</span>
              </button>
            )}
          </div>
        </div>

        {/* Right: Bottom Workspace Tabs */}
        <div className="flex items-center gap-1 shrink-0">
          {replayFeedback && (
            <span className="text-[10px] font-bold text-rose-400 bg-rose-500/15 border border-rose-500/30 px-2 py-0.5 rounded mr-1">
              {replayFeedback}
            </span>
          )}

          {(
            [
              {
                id: 'open_positions',
                label: 'Positions',
                count: openPositions.length,
              },
              {
                id: 'pending_orders',
                label: 'Pending',
                count: pendingOrders.length,
              },
              {
                id: 'closed_trades',
                label: 'Closed Trades',
                count: closedTrades.length,
              },
              {
                id: 'journal',
                label: 'Trade Journal',
                count: Object.keys(session.journals || {}).length,
              },
              {
                id: 'challenge_objectives',
                label: isPropChallenge ? 'Challenge Objectives' : 'Session Rules',
              },
            ] as const
          ).map((tab) => {
            const active = activeTab === tab.id && !isCollapsed;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  setIsCollapsed(false);
                  dismissDockHint();
                }}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1.5 border transition ${
                  active
                    ? 'bg-emerald-600 text-white border-emerald-500 shadow-sm'
                    : `${cardBg} opacity-80 hover:opacity-100`
                }`}
              >
                <span>{tab.label}</span>
                {'count' in tab && tab.count !== undefined && (
                  <span
                    className={`text-[9px] font-mono px-1 rounded ${
                      active ? 'bg-white/25 text-white' : 'bg-gray-500/20'
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

        {/* Pinned collapse/expand chevron (outside the horizontal scroll area) */}
        <button
          onClick={() => {
            dismissDockHint();
            setIsCollapsed((v) => !v);
          }}
          className={`relative shrink-0 p-1.5 rounded border ${
            dockHintActive && isCollapsed
              ? 'panel-hint-bounce bg-emerald-600 text-white keep-white border-emerald-500'
              : cardBg
          }`}
          title={
            isCollapsed
              ? 'Expand Bottom Workspace Panel'
              : 'Collapse Bottom Workspace Panel'
          }
          aria-expanded={!isCollapsed}
          aria-controls="replay-workspace-content"
          aria-label={isCollapsed ? 'Expand bottom workspace panel' : 'Collapse bottom workspace panel'}
        >
          {dockHintActive && isCollapsed && (
            <span className="panel-hint-ring" aria-hidden="true" />
          )}
          {isCollapsed ? (
            <ChevronUp className="w-3.5 h-3.5 relative" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5 relative" />
          )}
        </button>
      </div>

      {/* Progress Bar across Session Date Range */}
      <div className="w-full h-1 bg-gray-500/15 overflow-hidden">
        <div
          className="h-full bg-emerald-500 transition-all duration-200"
          style={{ width: `${progressRatio}%` }}
        />
      </div>

      {/* BOTTOM PANEL CONTENT */}
      <div ref={dockBodyRef} id="replay-workspace-content" className="workspace-panel-collapse" data-open={!isCollapsed} aria-hidden={isCollapsed}><div className="min-h-0 overflow-hidden">
        <div className="h-44 sm:h-56 overflow-y-auto p-2 sm:p-3 custom-scrollbar text-xs">
          {/* TAB 1: OPEN POSITIONS */}
          {activeTab === 'open_positions' && (
            <div className="space-y-2">
              {openPositions.length === 0 ? (
                <div className="h-44 flex flex-col items-center justify-center opacity-60 text-center">
                  <Layers className="w-7 h-7 mb-1.5 text-emerald-400" />
                  <p className="font-bold">No Open Positions</p>
                  <p className="text-[11px]">
                    Use the Right Order Ticket or Chart Drawing Tools to execute a market or pending trade.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-[11px]">
                    <thead>
                      <tr className="border-b border-gray-500/20 text-[10px] uppercase opacity-70 font-mono">
                        <th className="py-1.5 px-2">Symbol</th>
                        <th className="py-1.5 px-2">Side</th>
                        <th className="py-1.5 px-2">Lots</th>
                        <th className="py-1.5 px-2">Entry</th>
                        <th className="py-1.5 px-2">Stop Loss</th>
                        <th className="py-1.5 px-2">Take Profit</th>
                        <th className="py-1.5 px-2">Floating P&L</th>
                        <th className="py-1.5 px-2 text-right">
                          Position Actions (Partial / Close / Journal)
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-500/15 font-mono">
                      {openPositions.map((pos) => {
                        const posSym = pos.symbol || session.activeAsset || 'XAUUSD';
                        const posSpec = getEffectiveInstrumentSpec(posSym, session);
                        const mid =
                          session.marketMode === 'LIVE_PAPER' ? session.liveQuotes?.[posSym]?.price ?? pos.entryPrice : posSym === symbol ? currentMidPrice : pos.entryPrice;
                        const { bid, ask } = getBidAskFromMid(mid, posSym, session);
                        const markPrice = pos.side === 'LONG' ? bid : ask;
                        const grossPnl = calculatePositionPnl(
                          pos.side,
                          pos.entryPrice,
                          markPrice,
                          pos.lotSize,
                          posSym,
                          session
                        );
                        const netFloating = Number(
                          (
                            grossPnl -
                            (pos.commissionPaid || 0) -
                            (pos.slippageCost || 0)
                          ).toFixed(2)
                        );
                        const isEditing = editingRowId === pos.id;

                        return (
                          <tr key={pos.id} className="hover:bg-blue-500/5">
                            <td className="py-2 px-2 font-bold">{posSym}</td>
                            <td className="py-2 px-2">
                              <span
                                className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                  pos.side === 'LONG'
                                    ? 'bg-emerald-500/15 text-emerald-400'
                                    : 'bg-rose-500/15 text-rose-400'
                                }`}
                              >
                                {pos.side}
                              </span>
                            </td>
                            <td className="py-2 px-2 font-bold">
                              {pos.lotSize.toFixed(2)}
                            </td>
                            <td className="py-2 px-2">
                              {pos.entryPrice.toFixed(posSpec.decimals)}
                            </td>
                            <td className="py-2 px-2 text-rose-400">
                              {isEditing ? (
                                <input
                                  type="number"
                                  step={posSpec.minMove}
                                  value={editSLInput}
                                  onChange={(e) => setEditSLInput(e.target.value)}
                                  className="w-24 px-1.5 py-0.5 rounded bg-black/40 border border-rose-500/40 text-rose-300"
                                />
                              ) : pos.stopLoss > 0 ? (
                                (() => {
                                  const isBe =
                                    Math.abs(pos.stopLoss - pos.entryPrice) <=
                                    (posSpec.minMove || 1e-5) * 0.5;
                                  const isProfitSl =
                                    !isBe &&
                                    ((pos.side === 'LONG' && pos.stopLoss > pos.entryPrice) ||
                                      (pos.side === 'SHORT' && pos.stopLoss < pos.entryPrice));
                                  return (
                                    <span
                                      className={
                                        isProfitSl
                                          ? 'text-emerald-400 font-bold'
                                          : isBe
                                          ? 'text-sky-400 font-bold'
                                          : 'text-rose-400'
                                      }
                                    >
                                      {pos.stopLoss.toFixed(posSpec.decimals)}
                                      {isProfitSl ? ' (+SL)' : isBe ? ' (BE)' : ''}
                                    </span>
                                  );
                                })()
                              ) : (
                                'None'
                              )}
                            </td>
                            <td className="py-2 px-2 text-emerald-400">
                              {isEditing ? (
                                <input
                                  type="number"
                                  step={posSpec.minMove}
                                  value={editTPInput}
                                  onChange={(e) => setEditTPInput(e.target.value)}
                                  className="w-24 px-1.5 py-0.5 rounded bg-black/40 border border-emerald-500/40 text-emerald-300"
                                />
                              ) : pos.takeProfit > 0 ? (
                                pos.takeProfit.toFixed(posSpec.decimals)
                              ) : (
                                'Open'
                              )}
                            </td>
                            <td
                              className={`py-2 px-2 font-extrabold ${
                                netFloating >= 0 ? 'text-emerald-400' : 'text-rose-400'
                              }`}
                            >
                              {formatMoney(netFloating, currency, true)}
                            </td>
                            <td className="py-2 px-2 text-right">
                              <div className="flex items-center justify-end gap-1 font-sans">
                                {isEditing ? (
                                  <>
                                    <button
                                      onClick={() => commitRowEdit(pos)}
                                      className="px-2 py-0.5 rounded bg-emerald-600 text-white text-[10px] font-bold"
                                    >
                                      Save SL/TP
                                    </button>
                                    <button
                                      onClick={() => setEditingRowId(null)}
                                      className="px-2 py-0.5 rounded bg-gray-600/40 text-[10px]"
                                    >
                                      Cancel
                                    </button>
                                  </>
                                ) : (
                                  <>
                                    <button
                                      onClick={() => startEditingRow(pos)}
                                      className="px-1.5 py-0.5 rounded border border-gray-500/30 hover:border-blue-400 text-[10px] font-semibold flex items-center gap-0.5"
                                      title="Move Stop Loss / Take Profit"
                                    >
                                      <Edit3 className="w-2.5 h-2.5" /> SL/TP
                                    </button>
                                    <button
                                      onClick={() => onMoveToBreakEven(pos.id)}
                                      className="px-1.5 py-0.5 rounded bg-blue-500/15 hover:bg-blue-500/25 text-blue-400 border border-blue-500/30 text-[10px] font-bold"
                                      title="Move Stop Loss to Entry Price (Break-Even)"
                                    >
                                      BE
                                    </button>
                                    {((pos.side === 'LONG' &&
                                      markPrice > pos.entryPrice + posSpec.minMove * 2) ||
                                      (pos.side === 'SHORT' &&
                                        markPrice < pos.entryPrice - posSpec.minMove * 2)) && (
                                      <button
                                        onClick={() => {
                                          const lockPrice = Number(
                                            (
                                              pos.entryPrice +
                                              (markPrice - pos.entryPrice) * 0.5
                                            ).toFixed(posSpec.decimals)
                                          );
                                          onModifyPositionOrOrder(pos.id, {
                                            stopLoss: lockPrice,
                                            takeProfit: pos.takeProfit,
                                          });
                                        }}
                                        className="px-1.5 py-0.5 rounded bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold"
                                        title="Move Stop Loss beyond Entry to lock in 50% of current floating profit"
                                      >
                                        +50% SL
                                      </button>
                                    )}
                                    {[0.25, 0.5, 0.75].map((pct) => (
                                      <button
                                        key={pct}
                                        onClick={() => onClosePosition(pos.id, pct)}
                                        className="px-1.5 py-0.5 rounded bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 text-[10px] font-mono font-bold"
                                        title={`Partial close ${pct * 100}% of position`}
                                      >
                                        {pct * 100}%
                                      </button>
                                    ))}
                                    <button
                                      onClick={() => {
                                        setSelectedJournalTradeId(pos.id);
                                        setActiveTab('journal');
                                      }}
                                      className="px-1.5 py-0.5 rounded bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-300 border border-indigo-500/30 text-[10px] font-bold"
                                    >
                                      Journal
                                    </button>
                                    <button
                                      onClick={() => onClosePosition(pos.id, 1)}
                                      className="px-2 py-0.5 rounded bg-rose-600 hover:bg-rose-500 text-white text-[10px] font-bold"
                                    >
                                      Close
                                    </button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: PENDING ORDERS */}
          {activeTab === 'pending_orders' && (
            <div className="space-y-2">
              {pendingOrders.length === 0 ? (
                <div className="h-44 flex flex-col items-center justify-center opacity-60 text-center">
                  <Clock className="w-7 h-7 mb-1.5 text-amber-400" />
                  <p className="font-bold">No Pending Limit or Stop Orders</p>
                  <p className="text-[11px]">
                    Switch the Order Ticket to Limit or Stop to place pending orders.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-[11px]">
                    <thead>
                      <tr className="border-b border-gray-500/20 text-[10px] uppercase opacity-70 font-mono">
                        <th className="py-1.5 px-2">Symbol</th>
                        <th className="py-1.5 px-2">Order Type</th>
                        <th className="py-1.5 px-2">Lots</th>
                        <th className="py-1.5 px-2">Trigger Price</th>
                        <th className="py-1.5 px-2">Stop Loss</th>
                        <th className="py-1.5 px-2">Take Profit</th>
                        <th className="py-1.5 px-2 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-500/15 font-mono">
                      {pendingOrders.map((pos) => {
                        const posSym = pos.symbol || session.activeAsset || 'XAUUSD';
                        const posSpec = getEffectiveInstrumentSpec(posSym, session);
                        const isEditing = editingRowId === pos.id;
                        return (
                          <tr key={pos.id} className="hover:bg-blue-500/5">
                            <td className="py-2 px-2 font-bold">{posSym}</td>
                            <td className="py-2 px-2">
                              <span className="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 text-[10px] font-bold">
                                {pos.orderSubType || `${pos.side}_LIMIT`}
                              </span>
                            </td>
                            <td className="py-2 px-2">
                              {isEditing ? (
                                <input
                                  type="number"
                                  step={posSpec.quantityIncrement}
                                  value={editLotsInput}
                                  onChange={(e) => setEditLotsInput(e.target.value)}
                                  className="w-16 px-1.5 py-0.5 rounded bg-black/40 border border-blue-500/40"
                                />
                              ) : (
                                pos.lotSize.toFixed(2)
                              )}
                            </td>
                            <td className="py-2 px-2 font-bold">
                              {isEditing ? (
                                <input
                                  type="number"
                                  step={posSpec.minMove}
                                  value={editEntryInput}
                                  onChange={(e) => setEditEntryInput(e.target.value)}
                                  className="w-24 px-1.5 py-0.5 rounded bg-black/40 border border-blue-500/40"
                                />
                              ) : (
                                pos.entryPrice.toFixed(posSpec.decimals)
                              )}
                            </td>
                            <td className="py-2 px-2 text-rose-400">
                              {isEditing ? (
                                <input
                                  type="number"
                                  step={posSpec.minMove}
                                  value={editSLInput}
                                  onChange={(e) => setEditSLInput(e.target.value)}
                                  className="w-24 px-1.5 py-0.5 rounded bg-black/40 border border-rose-500/40"
                                />
                              ) : pos.stopLoss > 0 ? (
                                pos.stopLoss.toFixed(posSpec.decimals)
                              ) : (
                                'None'
                              )}
                            </td>
                            <td className="py-2 px-2 text-emerald-400">
                              {isEditing ? (
                                <input
                                  type="number"
                                  step={posSpec.minMove}
                                  value={editTPInput}
                                  onChange={(e) => setEditTPInput(e.target.value)}
                                  className="w-24 px-1.5 py-0.5 rounded bg-black/40 border border-emerald-500/40"
                                />
                              ) : pos.takeProfit > 0 ? (
                                pos.takeProfit.toFixed(posSpec.decimals)
                              ) : (
                                'Open'
                              )}
                            </td>
                            <td className="py-2 px-2 text-right font-sans">
                              <div className="flex items-center justify-end gap-1.5">
                                {isEditing ? (
                                  <>
                                    <button
                                      onClick={() => commitRowEdit(pos)}
                                      className="px-2 py-0.5 rounded bg-emerald-600 text-white text-[10px] font-bold"
                                    >
                                      Save
                                    </button>
                                    <button
                                      onClick={() => setEditingRowId(null)}
                                      className="px-2 py-0.5 rounded bg-gray-600/40 text-[10px]"
                                    >
                                      Cancel
                                    </button>
                                  </>
                                ) : (
                                  <>
                                    <button
                                      onClick={() => startEditingRow(pos)}
                                      className="px-2 py-0.5 rounded border border-gray-500/30 hover:border-blue-400 text-[10px] font-semibold"
                                    >
                                      Edit Order
                                    </button>
                                    <button
                                      onClick={() => onClosePosition(pos.id)}
                                      className="px-2 py-0.5 rounded bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 text-[10px] font-bold"
                                    >
                                      Cancel Order
                                    </button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: CLOSED TRADES */}
          {activeTab === 'closed_trades' && (
            <div className="space-y-2">
              {closedTrades.length === 0 ? (
                <div className="h-44 flex flex-col items-center justify-center opacity-60 text-center">
                  <BarChart3 className="w-7 h-7 mb-1.5 text-emerald-400" />
                  <p className="font-bold">No Closed Trades Yet</p>
                  <p className="text-[11px]">
                    Completed trades will appear here with Net P&L, Realised R, Costs, and Ambiguity flags.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-[11px]">
                    <thead>
                      <tr className="border-b border-gray-500/20 text-[10px] uppercase opacity-70 font-mono">
                        <th className="py-1.5 px-2">Exit Time</th>
                        <th className="py-1.5 px-2">Symbol</th>
                        <th className="py-1.5 px-2">Side</th>
                        <th className="py-1.5 px-2">Lots</th>
                        <th className="py-1.5 px-2">Entry → Exit</th>
                        <th className="py-1.5 px-2">Costs</th>
                        <th className="py-1.5 px-2">Realised R</th>
                        <th className="py-1.5 px-2">Net P&L</th>
                        <th className="py-1.5 px-2">Status / Policy</th>
                        <th className="py-1.5 px-2 text-right">Journal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-500/15 font-mono">
                      {closedTrades.map((pos) => {
                        const posSym = pos.symbol || session.activeAsset || 'XAUUSD';
                        const posSpec = getEffectiveInstrumentSpec(posSym, session);
                        const totalCost =
                          (pos.commissionPaid || 0) +
                          (pos.spreadCost || 0) +
                          (pos.slippageCost || 0);
                        return (
                          <tr key={pos.id} className="hover:bg-blue-500/5">
                            <td className="py-2 px-2 text-[10px] opacity-80">
                              {formatTimestampInTimezone(
                                pos.exitTime || pos.entryTime,
                                session.displayTimezone
                              )}
                            </td>
                            <td className="py-2 px-2 font-bold">{posSym}</td>
                            <td className="py-2 px-2">
                              <span
                                className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                  pos.side === 'LONG'
                                    ? 'bg-emerald-500/15 text-emerald-400'
                                    : 'bg-rose-500/15 text-rose-400'
                                }`}
                              >
                                {pos.side}
                              </span>
                            </td>
                            <td className="py-2 px-2">{pos.lotSize.toFixed(2)}</td>
                            <td className="py-2 px-2">
                              {pos.entryPrice.toFixed(posSpec.decimals)} →{' '}
                              {(pos.exitPrice || pos.entryPrice).toFixed(posSpec.decimals)}
                            </td>
                            <td className="py-2 px-2 text-amber-400">
                              {formatMoney(totalCost, currency)}
                            </td>
                            <td className="py-2 px-2 font-bold">
                              {pos.rMultiple !== null && pos.rMultiple !== undefined ? (
                                <span
                                  className={
                                    pos.rMultiple >= 0 ? 'text-emerald-400' : 'text-rose-400'
                                  }
                                >
                                  {pos.rMultiple >= 0 ? '+' : ''}
                                  {pos.rMultiple.toFixed(2)}R
                                </span>
                              ) : (
                                <span
                                  className="opacity-50"
                                  title="Initial Stop Loss was not defined"
                                >
                                  N/A
                                </span>
                              )}
                            </td>
                            <td
                              className={`py-2 px-2 font-extrabold ${
                                pos.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'
                              }`}
                            >
                              {formatMoney(pos.pnl, currency, true)}
                            </td>
                            <td className="py-2 px-2 font-sans">
                              <div className="flex items-center gap-1">
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-500/20 font-mono">
                                  {pos.status.replace('CLOSED_', '')}
                                </span>
                                {pos.isAmbiguous && (
                                  <span
                                    className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/20 border border-amber-500/40 text-amber-300 font-bold flex items-center gap-0.5"
                                    title={
                                      pos.ambiguityNote ||
                                      '1m bar touched both SL and TP; conservative SL-first policy applied.'
                                    }
                                  >
                                    <AlertTriangle className="w-2.5 h-2.5" /> Ambiguous (SL-First)
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="py-2 px-2 text-right font-sans">
                              <button
                                onClick={() => {
                                  setSelectedJournalTradeId(pos.id);
                                  setActiveTab('journal');
                                }}
                                className="px-2 py-0.5 rounded bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-300 border border-indigo-500/30 text-[10px] font-bold"
                              >
                                Open Journal
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: TRADE JOURNAL */}
          {activeTab === 'journal' && (
            <div className="space-y-3">
              {positions.length === 0 ? (
                <div className="h-44 flex flex-col items-center justify-center opacity-60 text-center">
                  <BookOpen className="w-7 h-7 mb-1.5 text-indigo-400" />
                  <p className="font-bold">No Trades in Session Yet</p>
                  <p className="text-[11px]">
                    Execute a trade first to log entry/exit reasoning, emotional state, checklists, and chart screenshots.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
                  {/* Left column: Trade Selector + Tags + Emotional State + Save Status */}
                  <div className={`lg:col-span-4 p-2.5 rounded-xl border space-y-2.5 ${cardBg}`}>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-400 flex items-center gap-1">
                        <BookOpen className="w-3.5 h-3.5" /> Linked Trade Entry
                      </span>
                      <span className="text-[10px] font-mono text-emerald-400 font-semibold">
                        {journalSaveStatus}
                      </span>
                    </div>

                    <select
                      value={selectedJournalTradeId}
                      onChange={(e) => setSelectedJournalTradeId(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-gray-500/30 bg-black/20 text-xs font-mono font-bold outline-none"
                    >
                      {positions.map((p) => (
                        <option key={p.id} value={p.id} className="bg-[#131722] text-white">
                          {p.symbol} {p.side} {p.lotSize}L @ {p.entryPrice} ({p.status})
                        </option>
                      ))}
                    </select>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] font-bold opacity-70 mb-0.5">
                          Strategy Tag
                        </label>
                        <input
                          type="text"
                          value={currentJournalEntry.strategyTag}
                          onChange={(e) =>
                            updateActiveJournal({ strategyTag: e.target.value })
                          }
                          className="w-full px-2 py-1 rounded border border-gray-500/30 bg-black/20 text-[11px]"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold opacity-70 mb-0.5">
                          Setup Tags (comma)
                        </label>
                        <input
                          type="text"
                          value={currentJournalEntry.setupTags.join(', ')}
                          onChange={(e) =>
                            updateActiveJournal({
                              setupTags: e.target.value
                                .split(',')
                                .map((t) => t.trim())
                                .filter(Boolean),
                            })
                          }
                          className="w-full px-2 py-1 rounded border border-gray-500/30 bg-black/20 text-[11px]"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold opacity-70 mb-1">
                        Emotional State
                      </label>
                      <div className="flex flex-wrap gap-1">
                        {EMOTIONAL_STATES.map((em) => (
                          <button
                            key={em.id}
                            type="button"
                            onClick={() => updateActiveJournal({ emotionalState: em.id })}
                            className={`px-2 py-0.5 rounded border text-[10px] font-bold transition ${
                              currentJournalEntry.emotionalState === em.id
                                ? em.color
                                : 'border-gray-500/25 opacity-60 hover:opacity-100'
                            }`}
                          >
                            {em.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[10px] font-bold opacity-70">Execution Rating:</span>
                      <div className="flex items-center gap-1">
                        {[1, 2, 3, 4, 5].map((st) => (
                          <button
                            key={st}
                            type="button"
                            onClick={() => updateActiveJournal({ rating: st })}
                            className="p-0.5"
                          >
                            <Star
                              className={`w-3.5 h-3.5 ${
                                st <= currentJournalEntry.rating
                                  ? 'text-amber-400 fill-amber-400'
                                  : 'opacity-30'
                              }`}
                            />
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Middle column: Entry/Exit Reasoning, Notes & Lessons Learned */}
                  <div className={`lg:col-span-5 p-2.5 rounded-xl border space-y-2 ${cardBg}`}>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] font-bold opacity-75 mb-0.5">
                          Entry Reasoning
                        </label>
                        <textarea
                          rows={2}
                          value={currentJournalEntry.entryReasoning}
                          onChange={(e) =>
                            updateActiveJournal({ entryReasoning: e.target.value })
                          }
                          placeholder="Why did you enter? HTF confluence, sweep..."
                          className="w-full p-1.5 rounded border border-gray-500/30 bg-black/20 text-[11px] outline-none resize-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold opacity-75 mb-0.5">
                          Exit Reasoning
                        </label>
                        <textarea
                          rows={2}
                          value={currentJournalEntry.exitReasoning}
                          onChange={(e) =>
                            updateActiveJournal({ exitReasoning: e.target.value })
                          }
                          placeholder="How was the trade managed & exited?"
                          className="w-full p-1.5 rounded border border-gray-500/30 bg-black/20 text-[11px] outline-none resize-none"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] font-bold opacity-75 mb-0.5">
                          General Trade Notes
                        </label>
                        <textarea
                          rows={2}
                          value={currentJournalEntry.notes}
                          onChange={(e) => updateActiveJournal({ notes: e.target.value })}
                          placeholder="Session execution observations..."
                          className="w-full p-1.5 rounded border border-gray-500/30 bg-black/20 text-[11px] outline-none resize-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold opacity-75 mb-0.5">
                          Lessons Learned
                        </label>
                        <textarea
                          rows={2}
                          value={currentJournalEntry.lessonsLearned}
                          onChange={(e) =>
                            updateActiveJournal({ lessonsLearned: e.target.value })
                          }
                          placeholder="Key takeaway to repeat or avoid..."
                          className="w-full p-1.5 rounded border border-gray-500/30 bg-black/20 text-[11px] outline-none resize-none"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Right column: Checklist Completion & Chart Screenshots */}
                  <div className={`lg:col-span-3 p-2.5 rounded-xl border space-y-2 ${cardBg}`}>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                        <ListChecks className="w-3.5 h-3.5 text-emerald-400" /> Plan Checklist
                      </span>
                      <span className="text-[10px] font-mono font-bold text-emerald-400">
                        {currentJournalEntry.checklist.filter((c) => c.checked).length}/
                        {currentJournalEntry.checklist.length}
                      </span>
                    </div>

                    <div className="space-y-1 max-h-20 overflow-y-auto pr-1">
                      {currentJournalEntry.checklist.map((item) => (
                        <label
                          key={item.id}
                          className="flex items-center gap-1.5 text-[10px] cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={item.checked}
                            onChange={(e) => {
                              const nextList = currentJournalEntry.checklist.map((c) =>
                                c.id === item.id ? { ...c, checked: e.target.checked } : c
                              );
                              updateActiveJournal({ checklist: nextList });
                            }}
                            className="rounded accent-[#2962ff]"
                          />
                          <span className={item.checked ? 'line-through opacity-60' : ''}>
                            {item.label}
                          </span>
                        </label>
                      ))}
                    </div>

                    <div className="flex items-center gap-1">
                      <input
                        type="text"
                        value={newChecklistText}
                        onChange={(e) => setNewChecklistText(e.target.value)}
                        placeholder="Add checklist rule..."
                        className="flex-1 px-2 py-0.5 rounded border border-gray-500/30 bg-black/20 text-[10px]"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (!newChecklistText.trim()) return;
                          updateActiveJournal({
                            checklist: [
                              ...currentJournalEntry.checklist,
                              {
                                id: `chk-${Date.now()}`,
                                label: newChecklistText.trim(),
                                checked: true,
                              },
                            ],
                          });
                          setNewChecklistText('');
                        }}
                        className="p-1 rounded bg-[#2962ff] text-white"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>

                    <div className="pt-1 border-t border-gray-500/20 flex items-center justify-between">
                      <button
                        type="button"
                        onClick={handleCaptureChartSnapshot}
                        className="px-2 py-1 rounded bg-blue-500/15 hover:bg-blue-500/25 border border-blue-500/30 text-blue-400 text-[10px] font-bold flex items-center gap-1"
                      >
                        <Camera className="w-3 h-3" /> Capture Screenshot (
                        {currentJournalEntry.screenshots.length})
                      </button>
                      {currentJournalEntry.screenshots.length > 0 && (
                        <button
                          type="button"
                          onClick={() => updateActiveJournal({ screenshots: [] })}
                          className="text-[10px] text-rose-400 hover:underline"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 5: CHALLENGE OBJECTIVES & DAILY RESET AUDIT */}
          {activeTab === 'challenge_objectives' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
              <div className={`lg:col-span-7 p-2.5 rounded-xl border space-y-2 ${cardBg}`}>
                <div className="flex items-center justify-between flex-wrap gap-1.5">
                  <div className="flex items-center gap-2">
                    <Trophy className="w-4 h-4 text-amber-400" />
                    <span className="font-extrabold text-xs uppercase">
                      {isPropChallenge
                        ? `${rules.firmName} — ${rules.challengePhase.replace('_', ' ')} Rules`
                        : 'Normal Backtesting Session Configuration'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {onOpenAnalyticsPage && (
                      <button
                        onClick={onOpenAnalyticsPage}
                        className="px-2 py-1 rounded bg-[#2962ff] text-white keep-white text-[10px] font-bold flex items-center gap-1"
                      >
                        <BarChart3 className="w-3 h-3" /> View Analytics
                      </button>
                    )}
                    {isPropChallenge && onStartNewChallengeAttempt && (
                      <>
                        <button
                          onClick={() => onStartNewChallengeAttempt('PHASE_1')}
                          className="px-2 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white keep-white text-[10px] font-extrabold flex items-center gap-1"
                        >
                          <RotateCcw className="w-3 h-3" /> Redo Phase 1
                        </button>
                        <button
                          onClick={() => onStartNewChallengeAttempt('PHASE_2')}
                          className="px-2 py-1 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 text-[10px] font-extrabold flex items-center gap-1"
                        >
                          <RotateCcw className="w-3 h-3" /> Redo Phase 2
                        </button>
                      </>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] font-mono">
                  <div className="p-2 rounded bg-black/20 border border-gray-500/20">
                    <div className="text-[9px] uppercase opacity-60">Profit Target</div>
                    <div className="font-bold text-emerald-400">
                      {formatMoney(liveMetrics.profitTargetAmount, currency)} (
                      {rules.profitTargetPct}%)
                    </div>
                  </div>
                  <div className="p-2 rounded bg-black/20 border border-gray-500/20">
                    <div className="text-[9px] uppercase opacity-60">
                      Daily Loss ({liveMetrics.calculationBasis})
                    </div>
                    <div className="font-bold text-amber-400">
                      {formatMoney(liveMetrics.dailyLossLimitAmount, currency)} (
                      {rules.maxDailyDrawdownPct}%)
                    </div>
                  </div>
                  <div className="p-2 rounded bg-black/20 border border-gray-500/20">
                    <div className="text-[9px] uppercase opacity-60">
                      Max Loss ({liveMetrics.drawdownType})
                    </div>
                    <div className="font-bold text-rose-400">
                      {formatMoney(liveMetrics.overallLossLimitAmount, currency)} (
                      {rules.maxTotalDrawdownPct}%)
                    </div>
                  </div>
                  <div className="p-2 rounded bg-black/20 border border-gray-500/20">
                    <div className="text-[9px] uppercase opacity-60">Daily Reset TZ</div>
                    <div className="font-bold text-blue-400">
                      {rules.dailyResetTime || '00:00'}{' '}
                      {rules.dailyResetTimezone || 'UTC'}
                    </div>
                  </div>
                </div>
              </div>

              <div className={`lg:col-span-5 p-2.5 rounded-xl border space-y-1.5 ${cardBg}`}>
                <div className="text-[10px] font-extrabold uppercase tracking-wider opacity-75">
                  Daily Reset Snapshots ({rules.dailyResetTimezone || 'UTC'})
                </div>
                <div className="max-h-28 overflow-y-auto text-[10px] font-mono space-y-1 pr-1">
                  {(session.challengeState?.dailySnapshots || []).map((snap) => (
                    <div
                      key={snap.dayKey}
                      className="flex items-center justify-between px-2 py-1 rounded bg-black/20 border border-gray-500/15"
                    >
                      <span className="font-bold">{snap.dayKey}</span>
                      <span>
                        Baseline: {formatMoney(snap.dailyBaseline, currency)}
                      </span>
                      <span className="text-amber-400">
                        Floor: {formatMoney(snap.dailyLossThreshold, currency)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div></div>

      {/* Skip To Modal Popup (Portaled above all chart overlays, compact & scrollbar-free) */}
      {isSkipModalOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          (() => {
            const selectedTzObj =
              SKIP_TIMEZONE_OPTIONS.find((t) => t.value === customSkipTz) ||
              SKIP_TIMEZONE_OPTIONS[0];
            const exactTzLabel = exactSkipTz === 'Africa/Johannesburg' ? 'SAST' : 'UTC';
            const exactPreviewTs = dateAndTimeInTzToTimestampSec(
              exactSkipDate,
              exactSkipTime,
              exactSkipTz
            );
            const exactUtcPreview = Number.isFinite(exactPreviewTs)
              ? formatTimestampInTimezone(exactPreviewTs, 'UTC')
              : '';
            const exactSastPreview = Number.isFinite(exactPreviewTs)
              ? formatTimestampInTimezone(exactPreviewTs, 'Africa/Johannesburg')
              : '';

            const sessionMinDate = session.startTimestamp
              ? new Date(session.startTimestamp * 1000).toISOString().slice(0, 10)
              : coverage.minDate;
            const sessionMaxDate = session.endTimestamp
              ? new Date(session.endTimestamp * 1000).toISOString().slice(0, 10)
              : coverage.maxDate;
            const minSelectableDate =
              sessionMinDate > coverage.minDate ? sessionMinDate : coverage.minDate;
            const maxSelectableDate =
              sessionMaxDate < coverage.maxDate ? sessionMaxDate : coverage.maxDate;
            const currentReplayIsoDate = formatTsToDateAndTimeInTz(
              replayTs,
              exactSkipTz
            ).dateStr;

            const firstOfMonth = new Date(
              Date.UTC(pickerMonth.getUTCFullYear(), pickerMonth.getUTCMonth(), 1)
            );
            const monthOffset = (firstOfMonth.getUTCDay() + 6) % 7;
            const calendarDays = Array.from({ length: 42 }, (_, idx) =>
              new Date(
                Date.UTC(
                  pickerMonth.getUTCFullYear(),
                  pickerMonth.getUTCMonth(),
                  idx - monthOffset + 1
                )
              )
            );
            const supportedYears = Array.from(
              { length: coverage.maxYear - coverage.minYear + 1 },
              (_, i) => coverage.minYear + i
            );

            const openTimePicker = (target: 'daily_time' | 'exact_time') => {
              if (activeSkipPicker === target) {
                setActiveSkipPicker(null);
                return;
              }
              const src = target === 'daily_time' ? customSkipTime : exactSkipTime;
              const [h, m] = src.split(':');
              setPickerHour(h || '10');
              setPickerMinute(m || '00');
              setActiveSkipPicker(target);
            };

            const applyPickedTime = (target: 'daily_time' | 'exact_time') => {
              const hh = String(
                Math.min(23, Math.max(0, Number(pickerHour) || 0))
              ).padStart(2, '0');
              const mm = String(
                Math.min(59, Math.max(0, Number(pickerMinute) || 0))
              ).padStart(2, '0');
              if (target === 'daily_time') {
                setCustomSkipTime(`${hh}:${mm}`);
              } else {
                setExactSkipTime(`${hh}:${mm}`);
              }
              setActiveSkipPicker(null);
            };

            return (
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="skip-replay-modal-title"
                className={`fixed inset-0 z-[95] flex items-center justify-center p-3 backdrop-blur-md animate-in fade-in duration-150 select-none ${
                  isLight
                    ? 'bg-slate-900/45'
                    : 'bg-[radial-gradient(circle_at_50%_40%,rgba(6,38,35,0.55),rgba(3,8,12,0.82))]'
                }`}
                onClick={() => setIsSkipModalOpen(false)}
              >
                <div
                  className={`relative w-full max-w-[468px] rounded-2xl border overflow-hidden transition-all ${
                    isLight
                      ? 'bg-white/95 border-emerald-200/90 text-slate-900 shadow-[0_24px_60px_-12px_rgba(15,23,42,0.25),0_0_0_1px_rgba(16,185,129,0.18)]'
                      : 'bg-[#0b1418]/95 border-emerald-400/25 text-slate-100 shadow-[0_24px_70px_-12px_rgba(0,0,0,0.85),0_0_0_1px_rgba(16,185,129,0.14),inset_0_1px_0_0_rgba(255,255,255,0.08)]'
                  }`}
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Ambient Aurora & Grid Glow */}
                  <div
                    aria-hidden="true"
                    className={`motivation-aurora motivation-aurora-1 ${
                      isLight ? 'opacity-25' : 'opacity-45'
                    }`}
                  />
                  <div
                    aria-hidden="true"
                    className={`motivation-aurora motivation-aurora-2 ${
                      isLight ? 'opacity-20' : 'opacity-40'
                    }`}
                  />
                  <div aria-hidden="true" className="motivation-grid-glow" />

                  {/* Compact Modal Header */}
                  <div
                    className={`relative z-10 flex items-center justify-between gap-2.5 px-4 py-3 border-b ${
                      isLight
                        ? 'border-emerald-100 bg-gradient-to-r from-emerald-50/80 via-sky-50/50 to-violet-50/40'
                        : 'border-white/10 bg-gradient-to-r from-emerald-500/[0.08] via-teal-500/[0.04] to-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border ${
                          isLight
                            ? 'border-emerald-300/80 bg-gradient-to-br from-emerald-100 to-teal-50 text-emerald-700'
                            : 'border-emerald-400/30 bg-gradient-to-br from-emerald-500/20 to-cyan-500/10 text-emerald-300'
                        }`}
                      >
                        <FastForward className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <h3
                            id="skip-replay-modal-title"
                            className="font-extrabold text-sm tracking-tight"
                          >
                            Skip Replay To
                          </h3>
                          <span
                            className={`inline-flex items-center rounded-full border px-1.5 py-0.2 text-[9px] font-bold uppercase tracking-wider ${
                              isLight
                                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                : 'border-emerald-400/25 bg-emerald-400/10 text-emerald-300'
                            }`}
                          >
                            {symbol}
                          </span>
                        </div>
                        <p
                          className={`text-[10px] truncate ${
                            isLight ? 'text-slate-500' : 'text-slate-400'
                          }`}
                        >
                          Jump to next session open, daily candle, or exact bar
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      aria-label="Close Skip Replay modal"
                      onClick={() => setIsSkipModalOpen(false)}
                      className={`group flex h-7 w-7 shrink-0 items-center justify-center rounded-full border transition-all duration-200 ${
                        isLight
                          ? 'border-slate-200 bg-white/80 text-slate-500 hover:border-slate-300 hover:bg-slate-100 hover:text-slate-900'
                          : 'border-white/10 bg-white/5 text-slate-400 hover:border-emerald-400/35 hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      <X className="w-3.5 h-3.5 transition-transform duration-200 group-hover:rotate-90" />
                    </button>
                  </div>

                  {/* Compact Modal Body (Zero Scrollbar) */}
                  <div className="relative z-10 px-4 py-3.5 space-y-3">
                    {/* Single-Line Current Replay Clock Bar */}
                    <div
                      className={`flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3 py-2 ${
                        isLight
                          ? 'border-sky-200/90 bg-gradient-to-r from-sky-50/90 via-emerald-50/50 to-indigo-50/50'
                          : 'border-emerald-400/20 bg-gradient-to-r from-emerald-500/[0.09] via-sky-500/[0.08] to-indigo-500/[0.06]'
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="relative flex h-2 w-2">
                          <span className="motivation-status-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                        </span>
                        <span
                          className={`text-[10px] font-extrabold uppercase tracking-wider ${
                            isLight ? 'text-slate-600' : 'text-slate-300'
                          }`}
                        >
                          Current Clock
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 font-mono text-[11px] font-extrabold">
                        <span
                          className={`rounded-md border px-1.5 py-0.5 ${
                            isLight
                              ? 'border-sky-200 bg-white text-sky-800'
                              : 'border-sky-400/30 bg-sky-500/15 text-sky-300'
                          }`}
                        >
                          {formatTimestampInTimezone(replayTs, 'UTC')} UTC
                        </span>
                        <span className="opacity-40">·</span>
                        <span
                          className={`rounded-md border px-1.5 py-0.5 ${
                            isLight
                              ? 'border-emerald-200 bg-white text-emerald-800'
                              : 'border-emerald-400/30 bg-emerald-500/15 text-emerald-300'
                          }`}
                        >
                          {formatTimestampInTimezone(replayTs, 'Africa/Johannesburg').slice(11)}{' '}
                          SAST
                        </span>
                      </div>
                    </div>

                    {/* Inline Auto-Snap / Validation Notice Banner */}
                    {skipModalNotice && (
                      <div
                        role="status"
                        className={`flex items-center justify-between gap-2 rounded-xl border px-3 py-2 text-[11px] font-medium animate-in fade-in duration-150 ${
                          skipModalNotice.tone === 'error'
                            ? isLight
                              ? 'border-rose-300 bg-rose-50 text-rose-800'
                              : 'border-rose-500/35 bg-rose-500/15 text-rose-200'
                            : skipModalNotice.tone === 'warning'
                            ? isLight
                              ? 'border-amber-300 bg-amber-50 text-amber-900'
                              : 'border-amber-400/35 bg-amber-500/15 text-amber-200'
                            : isLight
                            ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
                            : 'border-emerald-400/35 bg-emerald-500/15 text-emerald-200'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 min-w-0">
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-400" />
                          <span className="truncate">{skipModalNotice.text}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setSkipModalNotice(null)}
                          className="shrink-0 text-[10px] font-bold uppercase opacity-75 hover:opacity-100 hover:underline"
                        >
                          Dismiss
                        </button>
                      </div>
                    )}

                    {/* Section 1: Major Trading Sessions */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label
                          className={`text-[10px] font-extrabold uppercase tracking-wider ${
                            isLight ? 'text-slate-600' : 'text-slate-300'
                          }`}
                        >
                          Skip to Trading Sessions (Next Session Open)
                        </label>
                        <span
                          className={`text-[9px] ${
                            isLight ? 'text-slate-400' : 'text-slate-500'
                          }`}
                        >
                          1-click jump
                        </span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {SESSION_SKIP_CARDS.map((card) => {
                          const isQuickActive = quickSkipTarget === card.id;
                          return (
                            <button
                              type="button"
                              key={card.id}
                              onClick={() => handleExecuteSessionSkip(card.id)}
                              className={`group relative rounded-xl border p-2.5 text-left transition-all duration-150 hover:-translate-y-0.5 flex flex-col justify-between gap-1.5 ${
                                isLight ? card.accentLight : card.accentDark
                              } ${
                                isQuickActive
                                  ? 'ring-2 ring-emerald-400/80'
                                  : ''
                              }`}
                            >
                              <div className="flex items-center justify-between gap-1">
                                <span
                                  className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[9px] font-extrabold tracking-wider ${
                                    isLight ? card.badgeLight : card.badgeDark
                                  }`}
                                >
                                  <RegionFlagIcon code={card.flag} />
                                  <span>{card.code}</span>
                                </span>
                                {isQuickActive ? (
                                  <span className="text-[8px] font-extrabold uppercase px-1 py-0.5 rounded bg-emerald-500/20 text-emerald-400">
                                    Pinned
                                  </span>
                                ) : (
                                  <FastForward className="w-3 h-3 opacity-40 transition-transform duration-150 group-hover:translate-x-0.5 group-hover:opacity-90 text-emerald-400" />
                                )}
                              </div>

                              <div>
                                <div
                                  className={`text-[11px] font-extrabold truncate ${
                                    isLight ? 'text-slate-900' : 'text-white'
                                  }`}
                                >
                                  {card.name}
                                </div>
                                <div
                                  className={`mt-0.5 text-[9.5px] font-mono leading-tight ${
                                    isLight ? 'text-slate-500' : 'text-slate-400'
                                  }`}
                                >
                                  <div>{card.utcTime}</div>
                                  <div
                                    className={
                                      isLight
                                        ? 'text-emerald-700 font-semibold'
                                        : 'text-emerald-300/90'
                                    }
                                  >
                                    {card.sastTime}
                                  </div>
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Section 2: Compact Custom Daily Time Skip */}
                    <div
                      className={`rounded-xl border p-3 transition ${
                        isLight
                          ? 'border-slate-200/90 bg-slate-50/70'
                          : 'border-white/10 bg-white/[0.03]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <label
                          className={`text-[10px] font-extrabold uppercase tracking-wider flex items-center gap-1.5 ${
                            isLight ? 'text-slate-700' : 'text-slate-200'
                          }`}
                        >
                          <Clock className="w-3 h-3 text-emerald-400" />
                          <span>Custom Daily Time Skip</span>
                        </label>
                        <span
                          className={`text-[9px] font-mono px-1.5 py-0.5 rounded-full border ${
                            isLight
                              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                              : 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300'
                          }`}
                        >
                          Recurring daily jump
                        </span>
                      </div>

                      <p
                        className={`text-[10.5px] mb-2 leading-snug ${
                          isLight ? 'text-slate-500' : 'text-slate-400'
                        }`}
                      >
                        Pick an hour &amp; timezone to jump directly to that candle on the next open
                        trading day.
                      </p>

                      <div className="grid grid-cols-12 gap-1.5">
                        {/* Time Trigger */}
                        <button
                          type="button"
                          onClick={() => openTimePicker('daily_time')}
                          className={`col-span-4 flex items-center justify-between gap-1.5 rounded-xl border px-2.5 py-2 text-left transition ${
                            isLight
                              ? 'border-slate-200 bg-white hover:border-emerald-300'
                              : 'border-white/15 bg-[#0f1a20] hover:border-emerald-400/40'
                          }`}
                        >
                          <span className="flex items-center gap-1.5 font-mono text-xs font-extrabold">
                            <Clock className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                            <span>{customSkipTime}</span>
                          </span>
                          <ChevronDown className="w-3.5 h-3.5 opacity-60 shrink-0" />
                        </button>

                        {/* Timezone Trigger */}
                        <button
                          type="button"
                          onClick={() => setActiveSkipPicker('daily_tz')}
                          className={`col-span-8 flex items-center justify-between gap-1.5 rounded-xl border px-2.5 py-2 text-left transition ${
                            isLight
                              ? 'border-slate-200 bg-white hover:border-emerald-300'
                              : 'border-white/15 bg-[#0f1a20] hover:border-emerald-400/40'
                          }`}
                        >
                          <span className="flex items-center gap-1.5 text-xs font-extrabold truncate min-w-0">
                            <RegionFlagIcon code={selectedTzObj.flag} />
                            <span className="truncate">{selectedTzObj.label}</span>
                          </span>
                          <ChevronDown className="w-3.5 h-3.5 shrink-0 opacity-60" />
                        </button>
                      </div>

                      <div className="mt-2 flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setQuickSkipTarget('DAILY_TIME');
                            handleSkipToCustomTime();
                          }}
                          className="motivation-cta-btn group relative flex flex-1 items-center justify-center gap-1.5 overflow-hidden rounded-xl px-3.5 py-2 text-xs font-extrabold text-slate-950 transition-all"
                        >
                          <span aria-hidden="true" className="motivation-cta-shimmer" />
                          <FastForward className="relative z-10 w-3.5 h-3.5" />
                          <span className="relative z-10">
                            Skip &amp; Save ({customSkipTime} {selectedTzObj.code})
                          </span>
                          <ArrowRight className="relative z-10 w-3.5 h-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setQuickSkipTarget('DAILY_TIME');
                            setIsSkipModalOpen(false);
                          }}
                          className={`rounded-xl border px-3 py-2 text-[11px] font-extrabold transition ${
                            quickSkipTarget === 'DAILY_TIME'
                              ? 'border-emerald-500/60 bg-emerald-500/15 text-emerald-400'
                              : isLight
                              ? 'border-slate-200 bg-white text-slate-700 hover:border-emerald-300'
                              : 'border-white/15 bg-white/5 text-slate-200 hover:border-emerald-400/40'
                          }`}
                          title="Save this daily time as your 1-click Quick Skip button without skipping right now"
                        >
                          Save Only
                        </button>
                      </div>
                    </div>

                    {/* Section 3: Compact Exact Date & Time Picker */}
                    <div
                      className={`rounded-xl border p-3 transition ${
                        isLight
                          ? 'border-slate-200/90 bg-slate-50/70'
                          : 'border-white/10 bg-white/[0.03]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <label
                            className={`text-[10px] font-extrabold uppercase tracking-wider flex items-center gap-1.5 shrink-0 ${
                              isLight ? 'text-slate-700' : 'text-slate-200'
                            }`}
                          >
                            <Calendar className="w-3 h-3 text-emerald-400" />
                            <span>Exact Date &amp; Time</span>
                          </label>
                          {exactUtcPreview && (
                            <span
                              className={`hidden sm:inline text-[9.5px] font-mono truncate ${
                                isLight ? 'text-slate-400' : 'text-slate-400'
                              }`}
                            >
                              ({exactUtcPreview.slice(11)} UTC · {exactSastPreview.slice(11)} SAST)
                            </span>
                          )}
                        </div>

                        {/* Timezone Toggle Pill (SAST vs UTC) */}
                        <div
                          className={`inline-flex items-center rounded-lg border p-0.5 text-[9.5px] font-bold shrink-0 ${
                            isLight
                              ? 'border-slate-200 bg-white'
                              : 'border-white/10 bg-[#0b1418]'
                          }`}
                        >
                          {(
                            [
                              { id: 'Africa/Johannesburg', label: 'SAST' },
                              { id: 'UTC', label: 'UTC' },
                            ] as const
                          ).map((tzOpt) => {
                            const active = exactSkipTz === tzOpt.id;
                            return (
                              <button
                                type="button"
                                key={tzOpt.id}
                                onClick={() => setExactSkipTz(tzOpt.id)}
                                className={`rounded-md px-2 py-0.5 transition ${
                                  active
                                    ? 'bg-emerald-400 text-slate-950 font-extrabold shadow-sm'
                                    : isLight
                                    ? 'text-slate-500 hover:text-slate-800'
                                    : 'text-slate-400 hover:text-white'
                                }`}
                              >
                                {tzOpt.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div className="grid grid-cols-12 gap-1.5">
                        {/* Date Trigger */}
                        <button
                          type="button"
                          onClick={() => {
                            const [y, m] = exactSkipDate.split('-').map(Number);
                            if (Number.isFinite(y) && Number.isFinite(m)) {
                              setPickerMonth(new Date(Date.UTC(y, m - 1, 1)));
                            }
                            setPickerCalendarView('days');
                            setActiveSkipPicker('exact_date');
                          }}
                          className={`col-span-5 flex items-center justify-between gap-1.5 rounded-xl border px-2.5 py-2 text-left transition ${
                            isLight
                              ? 'border-slate-200 bg-white hover:border-emerald-300'
                              : 'border-white/15 bg-[#0f1a20] hover:border-emerald-400/40'
                          }`}
                        >
                          <span className="flex items-center gap-1.5 text-xs font-extrabold truncate min-w-0">
                            <Calendar className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
                            <span className="truncate">
                              {formatPrettyCalendarDate(exactSkipDate)}
                            </span>
                          </span>
                          <ChevronDown className="w-3.5 h-3.5 shrink-0 opacity-60" />
                        </button>

                        {/* Exact Time Trigger */}
                        <button
                          type="button"
                          onClick={() => openTimePicker('exact_time')}
                          className={`col-span-4 flex items-center justify-between gap-1.5 rounded-xl border px-2.5 py-2 text-left transition ${
                            isLight
                              ? 'border-slate-200 bg-white hover:border-emerald-300'
                              : 'border-white/15 bg-[#0f1a20] hover:border-emerald-400/40'
                          }`}
                        >
                          <span className="flex items-center gap-1.5 font-mono text-xs font-extrabold">
                            <Clock className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                            <span>
                              {exactSkipTime} {exactTzLabel}
                            </span>
                          </span>
                          <ChevronDown className="w-3.5 h-3.5 opacity-60 shrink-0" />
                        </button>

                        {/* Jump Action Button */}
                        <button
                          type="button"
                          onClick={handleSkipToDateTime}
                          className={`col-span-3 flex items-center justify-center gap-1 rounded-xl border px-3 py-2 text-xs font-extrabold transition ${
                            isLight
                              ? 'border-emerald-500/40 bg-slate-900 text-white hover:bg-slate-800 shadow-sm'
                              : 'border-emerald-400/35 bg-gradient-to-r from-emerald-500/20 to-teal-500/20 text-emerald-200 hover:border-emerald-400/60 hover:from-emerald-500/30 hover:to-teal-500/30 hover:text-white'
                          }`}
                        >
                          <span>Jump</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* FLOATING OVERLAY PICKERS (Covers modal body cleanly without adding height or scrollbars) */}
                  {activeSkipPicker && (
                    <div
                      className={`absolute inset-x-3 bottom-3 top-[58px] z-30 flex flex-col justify-between rounded-2xl border p-3.5 animate-in fade-in duration-150 ${
                        isLight
                          ? 'border-emerald-200 bg-white/98 text-slate-900 shadow-2xl backdrop-blur-xl'
                          : 'border-emerald-400/30 bg-[#0b151a]/98 text-slate-100 shadow-2xl backdrop-blur-xl'
                      }`}
                    >
                      {/* TIME PICKER OVERLAY (for daily_time or exact_time) */}
                      {(activeSkipPicker === 'daily_time' ||
                        activeSkipPicker === 'exact_time') && (
                        <>
                          <div>
                            <div className="flex items-center justify-between pb-2.5 mb-3 border-b border-white/10">
                              <span className="text-xs font-extrabold text-emerald-400 flex items-center gap-1.5">
                                <Clock className="w-3.5 h-3.5" />
                                <span>
                                  {activeSkipPicker === 'daily_time'
                                    ? `Select Daily Target Time (${selectedTzObj.code})`
                                    : `Select Exact Jump Time (${exactTzLabel})`}
                                </span>
                              </span>
                              <button
                                type="button"
                                onClick={() => setActiveSkipPicker(null)}
                                className="rounded-lg px-2 py-0.5 text-[11px] font-bold opacity-70 hover:opacity-100"
                              >
                                Back
                              </button>
                            </div>

                            <div className="flex items-center justify-center gap-3 mb-3">
                              <label className="text-center">
                                <span className="block text-[9px] uppercase opacity-60 mb-1">
                                  Hour (00–23)
                                </span>
                                <input
                                  aria-label="Skip hour"
                                  inputMode="numeric"
                                  maxLength={2}
                                  value={pickerHour}
                                  onChange={(e) =>
                                    setPickerHour(e.target.value.replace(/[^0-9]/g, ''))
                                  }
                                  className={`w-16 rounded-xl border py-1.5 text-center font-mono text-lg font-extrabold outline-none ${
                                    isLight
                                      ? 'border-slate-200 bg-slate-50 text-slate-900 focus:border-emerald-500'
                                      : 'border-white/15 bg-black/30 text-white focus:border-emerald-400'
                                  }`}
                                />
                              </label>
                              <span className="pt-4 text-xl font-bold opacity-50">:</span>
                              <label className="text-center">
                                <span className="block text-[9px] uppercase opacity-60 mb-1">
                                  Minute (00–59)
                                </span>
                                <input
                                  aria-label="Skip minute"
                                  inputMode="numeric"
                                  maxLength={2}
                                  value={pickerMinute}
                                  onChange={(e) =>
                                    setPickerMinute(e.target.value.replace(/[^0-9]/g, ''))
                                  }
                                  className={`w-16 rounded-xl border py-1.5 text-center font-mono text-lg font-extrabold outline-none ${
                                    isLight
                                      ? 'border-slate-200 bg-slate-50 text-slate-900 focus:border-emerald-500'
                                      : 'border-white/15 bg-black/30 text-white focus:border-emerald-400'
                                  }`}
                                />
                              </label>
                            </div>

                            <div className="grid grid-cols-6 gap-1.5">
                              {Array.from({ length: 24 }, (_, i) =>
                                String(i).padStart(2, '0')
                              ).map((hVal) => {
                                const selected = Number(pickerHour) === Number(hVal);
                                return (
                                  <button
                                    type="button"
                                    key={hVal}
                                    onClick={() => setPickerHour(hVal)}
                                    className={`rounded-lg py-1.5 font-mono text-xs font-bold transition ${
                                      selected
                                        ? 'bg-emerald-400 text-slate-950 shadow-sm'
                                        : isLight
                                        ? 'bg-slate-100 text-slate-700 hover:bg-emerald-50'
                                        : 'bg-white/5 text-slate-300 hover:bg-emerald-500/20'
                                    }`}
                                  >
                                    {hVal}
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          <div className="flex items-center justify-between gap-2 pt-3 border-t border-white/10">
                            <div className="flex items-center gap-1.5">
                              {['00', '15', '30', '45'].map((mVal) => {
                                const selected = Number(pickerMinute) === Number(mVal);
                                return (
                                  <button
                                    type="button"
                                    key={mVal}
                                    onClick={() => setPickerMinute(mVal)}
                                    className={`rounded-lg px-2.5 py-1.5 font-mono text-xs font-bold transition ${
                                      selected
                                        ? 'bg-emerald-400/20 text-emerald-400 border border-emerald-400/40'
                                        : isLight
                                        ? 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                        : 'bg-white/5 text-slate-400 hover:bg-white/10'
                                    }`}
                                  >
                                    :{mVal}
                                  </button>
                                );
                              })}
                            </div>

                            <button
                              type="button"
                              onClick={() => applyPickedTime(activeSkipPicker)}
                              className="motivation-cta-btn rounded-xl px-4 py-2 text-xs font-extrabold text-slate-950"
                            >
                              Use {pickerHour.padStart(2, '0')}:
                              {pickerMinute.padStart(2, '0')}
                            </button>
                          </div>
                        </>
                      )}

                      {/* TIMEZONE PICKER OVERLAY */}
                      {activeSkipPicker === 'daily_tz' && (
                        <>
                          <div>
                            <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-white/10">
                              <span className="text-xs font-extrabold text-emerald-400 flex items-center gap-1.5">
                                <Globe2 className="w-3.5 h-3.5" />
                                <span>Choose Daily Skip Timezone</span>
                              </span>
                              <button
                                type="button"
                                onClick={() => setActiveSkipPicker(null)}
                                className="rounded-lg px-2 py-0.5 text-[11px] font-bold opacity-70 hover:opacity-100"
                              >
                                Back
                              </button>
                            </div>

                            <div className="space-y-1.5">
                              {SKIP_TIMEZONE_OPTIONS.map((tz) => {
                                const isSelected = tz.value === customSkipTz;
                                return (
                                  <button
                                    type="button"
                                    key={tz.value}
                                    onClick={() => {
                                      setCustomSkipTz(tz.value);
                                      setActiveSkipPicker(null);
                                    }}
                                    className={`flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-left text-xs font-bold transition ${
                                      isSelected
                                        ? isLight
                                          ? 'bg-emerald-50 text-emerald-900 border border-emerald-200'
                                          : 'bg-emerald-500/15 text-emerald-300 border border-emerald-400/30'
                                        : isLight
                                        ? 'text-slate-700 hover:bg-slate-100 border border-transparent'
                                        : 'text-slate-300 hover:bg-white/5 border border-transparent'
                                    }`}
                                  >
                                    <span className="flex items-center gap-2.5 min-w-0">
                                      <RegionFlagIcon code={tz.flag} />
                                      <span className="truncate">{tz.label}</span>
                                    </span>
                                    <span className="flex items-center gap-2 shrink-0">
                                      <span className="font-mono text-[10px] opacity-65">
                                        {tz.offset}
                                      </span>
                                      {isSelected && (
                                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                                      )}
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          <div className="flex justify-end pt-2 border-t border-white/10">
                            <button
                              type="button"
                              onClick={() => setActiveSkipPicker(null)}
                              className="rounded-lg px-3 py-1 text-xs font-bold opacity-70 hover:opacity-100"
                            >
                              Done
                            </button>
                          </div>
                        </>
                      )}

                      {/* CALENDAR PICKER OVERLAY */}
                      {activeSkipPicker === 'exact_date' && (
                        <>
                          <div>
                            {/* Calendar Month/Year Header */}
                            <div className="mb-2 flex items-center justify-between gap-1">
                              <button
                                type="button"
                                aria-label="Previous month"
                                disabled={
                                  firstOfMonth.toISOString().slice(0, 7) <=
                                  minSelectableDate.slice(0, 7)
                                }
                                onClick={() =>
                                  setPickerMonth(
                                    new Date(
                                      Date.UTC(
                                        pickerMonth.getUTCFullYear(),
                                        pickerMonth.getUTCMonth() - 1,
                                        1
                                      )
                                    )
                                  )
                                }
                                className={`rounded-lg p-1.5 transition disabled:opacity-20 ${
                                  isLight ? 'hover:bg-slate-100' : 'hover:bg-white/10'
                                }`}
                              >
                                <ChevronLeft className="w-4 h-4" />
                              </button>

                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setPickerCalendarView(
                                      pickerCalendarView === 'months' ? 'days' : 'months'
                                    )
                                  }
                                  className={`rounded-lg px-2.5 py-1 text-xs font-extrabold transition ${
                                    isLight ? 'hover:bg-slate-100' : 'hover:bg-white/10'
                                  }`}
                                >
                                  {MONTH_NAMES[pickerMonth.getUTCMonth()]}
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setPickerCalendarView(
                                      pickerCalendarView === 'years' ? 'days' : 'years'
                                    )
                                  }
                                  className={`rounded-lg px-2.5 py-1 font-mono text-xs font-extrabold text-emerald-400 transition ${
                                    isLight
                                      ? 'hover:bg-emerald-50'
                                      : 'hover:bg-emerald-500/15'
                                  }`}
                                >
                                  {pickerMonth.getUTCFullYear()}
                                </button>
                              </div>

                              <button
                                type="button"
                                aria-label="Next month"
                                disabled={
                                  firstOfMonth.toISOString().slice(0, 7) >=
                                  maxSelectableDate.slice(0, 7)
                                }
                                onClick={() =>
                                  setPickerMonth(
                                    new Date(
                                      Date.UTC(
                                        pickerMonth.getUTCFullYear(),
                                        pickerMonth.getUTCMonth() + 1,
                                        1
                                      )
                                    )
                                  )
                                }
                                className={`rounded-lg p-1.5 transition disabled:opacity-20 ${
                                  isLight ? 'hover:bg-slate-100' : 'hover:bg-white/10'
                                }`}
                              >
                                <ChevronRight className="w-4 h-4" />
                              </button>
                            </div>

                            {pickerCalendarView === 'years' ? (
                              <div className="grid grid-cols-4 gap-1.5 pt-1">
                                {supportedYears.map((yr) => {
                                  const minY = Number(minSelectableDate.slice(0, 4));
                                  const maxY = Number(maxSelectableDate.slice(0, 4));
                                  const disabled =
                                    yr < minY || yr > maxY || !coverage.isYearSupported(yr);
                                  const active = yr === pickerMonth.getUTCFullYear();
                                  return (
                                    <button
                                      type="button"
                                      key={yr}
                                      disabled={disabled}
                                      onClick={() => {
                                        setPickerMonth(
                                          new Date(
                                            Date.UTC(yr, pickerMonth.getUTCMonth(), 1)
                                          )
                                        );
                                        setPickerCalendarView('months');
                                      }}
                                      className={`rounded-lg py-2 font-mono text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-20 ${
                                        active
                                          ? 'bg-emerald-400 text-slate-950'
                                          : isLight
                                          ? 'hover:bg-emerald-50 text-slate-700'
                                          : 'hover:bg-white/10 text-slate-200'
                                      }`}
                                    >
                                      {yr}
                                    </button>
                                  );
                                })}
                              </div>
                            ) : pickerCalendarView === 'months' ? (
                              <div className="grid grid-cols-3 gap-1.5 pt-1">
                                {MONTH_NAMES.map((mName, idx) => {
                                  const ym = `${pickerMonth.getUTCFullYear()}-${String(
                                    idx + 1
                                  ).padStart(2, '0')}`;
                                  const disabled =
                                    ym < minSelectableDate.slice(0, 7) ||
                                    ym > maxSelectableDate.slice(0, 7) ||
                                    !coverage.isMonthSupported(ym);
                                  const active = idx === pickerMonth.getUTCMonth();
                                  return (
                                    <button
                                      type="button"
                                      key={mName}
                                      disabled={disabled}
                                      onClick={() => {
                                        setPickerMonth(
                                          new Date(
                                            Date.UTC(pickerMonth.getUTCFullYear(), idx, 1)
                                          )
                                        );
                                        setPickerCalendarView('days');
                                      }}
                                      className={`rounded-lg py-2.5 text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-20 ${
                                        active
                                          ? 'bg-emerald-400 text-slate-950'
                                          : isLight
                                          ? 'hover:bg-emerald-50 text-slate-700'
                                          : 'hover:bg-white/10 text-slate-200'
                                      }`}
                                    >
                                      {mName.slice(0, 3)}
                                    </button>
                                  );
                                })}
                              </div>
                            ) : (
                              <>
                                <div className="mb-1 grid grid-cols-7 text-center text-[10px] font-bold opacity-50">
                                  {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map((dName) => (
                                    <span key={dName} className="py-0.5">
                                      {dName}
                                    </span>
                                  ))}
                                </div>
                                <div className="grid grid-cols-7 gap-1">
                                  {calendarDays.map((dObj) => {
                                    const isoVal = dObj.toISOString().slice(0, 10);
                                    const dow = dObj.getUTCDay();
                                    const isWeekend =
                                      instrumentCfg.category !== 'CRYPTO' &&
                                      (dow === 0 || dow === 6);
                                    const holidayName = isFixedMarketHolidayDate(
                                      isoVal,
                                      symbol
                                    );
                                    const isClosedDay = isWeekend || Boolean(holidayName);
                                    const isBeforePropClock =
                                      isPropChallenge && isoVal < currentReplayIsoDate;
                                    const isDisabled =
                                      isoVal < minSelectableDate ||
                                      isoVal > maxSelectableDate ||
                                      !coverage.isDateSupported(isoVal) ||
                                      isBeforePropClock;
                                    const isSelected = isoVal === exactSkipDate;
                                    const isCurrentClockDay = isoVal === currentReplayIsoDate;
                                    const inCurrentMonth =
                                      dObj.getUTCMonth() === pickerMonth.getUTCMonth();

                                    return (
                                      <button
                                        type="button"
                                        key={isoVal}
                                        disabled={isDisabled}
                                        onClick={() => handleChooseExactDate(isoVal)}
                                        title={
                                          isBeforePropClock
                                            ? 'Rewind disabled in Prop Firm Challenge mode'
                                            : isDisabled
                                            ? 'Outside session or historical archive range'
                                            : isClosedDay
                                            ? `${
                                                holidayName || 'Weekend closure'
                                              } — clicking jumps to next open trading day`
                                            : isoVal
                                        }
                                        className={`relative rounded-lg py-1 font-mono text-xs tabular-nums transition disabled:cursor-not-allowed disabled:opacity-15 ${
                                          isSelected
                                            ? 'bg-emerald-400 font-extrabold text-slate-950 shadow-sm'
                                            : !inCurrentMonth
                                            ? isLight
                                              ? 'text-slate-300 hover:bg-slate-100'
                                              : 'text-slate-600 hover:bg-white/5'
                                            : isClosedDay
                                            ? isLight
                                              ? 'bg-amber-50 text-amber-800 hover:bg-amber-100'
                                              : 'bg-amber-500/10 text-amber-300/90 hover:bg-amber-500/20'
                                            : isLight
                                            ? 'text-slate-800 hover:bg-emerald-50'
                                            : 'text-slate-200 hover:bg-emerald-500/15'
                                        } ${
                                          isCurrentClockDay && !isSelected
                                            ? 'ring-1 ring-inset ring-emerald-400/70 font-bold'
                                            : ''
                                        }`}
                                      >
                                        {dObj.getUTCDate()}
                                      </button>
                                    );
                                  })}
                                </div>
                              </>
                            )}
                          </div>

                          {/* Calendar Quick-Jump Footer */}
                          <div
                            className={`pt-2 border-t flex flex-wrap items-center justify-between gap-1.5 text-[10px] ${
                              isLight ? 'border-slate-200' : 'border-white/10'
                            }`}
                          >
                            <div className="flex items-center gap-1">
                              {!isPropChallenge && (
                                <button
                                  type="button"
                                  onClick={() => handleChooseExactDate(minSelectableDate)}
                                  className={`rounded-lg px-2 py-1 font-bold transition ${
                                    isLight
                                      ? 'bg-slate-100 text-slate-700 hover:bg-emerald-50'
                                      : 'bg-white/5 text-slate-300 hover:bg-white/10'
                                  }`}
                                >
                                  Session Start
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => handleChooseExactDate(currentReplayIsoDate)}
                                className={`rounded-lg px-2 py-1 font-bold transition ${
                                  isLight
                                    ? 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                                    : 'bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25'
                                }`}
                              >
                                Current ({currentReplayIsoDate})
                              </button>
                              <button
                                type="button"
                                onClick={() => handleChooseExactDate(maxSelectableDate)}
                                className={`rounded-lg px-2 py-1 font-bold transition ${
                                  isLight
                                    ? 'bg-slate-100 text-slate-700 hover:bg-emerald-50'
                                    : 'bg-white/5 text-slate-300 hover:bg-white/10'
                                }`}
                              >
                                Session End
                              </button>
                            </div>
                            <button
                              type="button"
                              onClick={() => setActiveSkipPicker(null)}
                              className="font-bold opacity-70 hover:opacity-100 px-1.5 py-0.5"
                            >
                              Back
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })(),
          document.body
        )}

      {/* Weekend / Market Closure Skip Popup Notification */}
      {weekendSkipPopup &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="weekend-skip-popup-title"
            className={`fixed inset-0 z-[130] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-150 ${
              isLight ? 'bg-slate-900/35' : 'bg-black/60'
            }`}
            onClick={() => setWeekendSkipPopup(null)}
          >
            <div
              className={`relative w-full max-w-md rounded-2xl border p-5 overflow-hidden transition-all ${
                isLight
                  ? 'bg-white border-emerald-200 text-slate-900 shadow-[0_24px_60px_-12px_rgba(15,23,42,0.28)]'
                  : 'bg-[#0b1418] border-emerald-400/30 text-slate-100 shadow-[0_24px_70px_-12px_rgba(0,0,0,0.85),0_0_0_1px_rgba(16,185,129,0.18)]'
              }`}
              onClick={(e) => e.stopPropagation()}
            >
              <div
                aria-hidden="true"
                className={`motivation-aurora motivation-aurora-1 ${
                  isLight ? 'opacity-25' : 'opacity-45'
                }`}
              />
              <div className="relative z-10 flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${
                      isLight
                        ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                        : 'border-emerald-400/35 bg-emerald-500/15 text-emerald-300'
                    }`}
                  >
                    <Calendar className="w-5 h-5" />
                  </div>
                  <div>
                    <span
                      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider ${
                        isLight
                          ? 'border-amber-200 bg-amber-50 text-amber-800'
                          : 'border-amber-400/30 bg-amber-500/15 text-amber-300'
                      }`}
                    >
                      Weekend Market Closure · {symbol}
                    </span>
                    <h3
                      id="weekend-skip-popup-title"
                      className="mt-1 text-base font-extrabold tracking-tight"
                    >
                      {weekendSkipPopup.title}
                    </h3>
                  </div>
                </div>
                <button
                  type="button"
                  aria-label="Close weekend skip notification"
                  onClick={() => setWeekendSkipPopup(null)}
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border transition ${
                    isLight
                      ? 'border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100 hover:text-slate-900'
                      : 'border-white/10 bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <p
                className={`relative z-10 mt-3 text-xs leading-relaxed ${
                  isLight ? 'text-slate-600' : 'text-slate-300'
                }`}
              >
                {weekendSkipPopup.message}
              </p>

              <div
                className={`relative z-10 mt-3.5 flex items-center justify-between gap-2 rounded-xl border px-3.5 py-2.5 font-mono text-xs ${
                  isLight
                    ? 'border-emerald-200 bg-emerald-50/70 text-emerald-950'
                    : 'border-emerald-400/25 bg-emerald-500/10 text-emerald-200'
                }`}
              >
                <span className="flex items-center gap-1.5 font-bold">
                  <FastForward className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>{weekendSkipPopup.targetDatePretty}</span>
                </span>
                <span
                  className={`rounded-lg border px-2 py-0.5 text-[11px] font-extrabold ${
                    isLight
                      ? 'border-emerald-300 bg-white text-emerald-800'
                      : 'border-emerald-400/30 bg-black/30 text-emerald-300'
                  }`}
                >
                  {weekendSkipPopup.targetTimeLabel}
                </span>
              </div>

              <div className="relative z-10 mt-4 flex items-center justify-end">
                <button
                  type="button"
                  onClick={() => setWeekendSkipPopup(null)}
                  className="motivation-cta-btn rounded-xl px-4 py-2 text-xs font-extrabold text-slate-950 flex items-center gap-1.5"
                >
                  <span>Got it</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* Floating On-Chart Replay Widget (Desktop & Mobile/Phone, Draggable & Closable) */}
      {isReplayMode &&
        isFloatingWidgetOpen &&
        createPortal(
          <div
            onPointerDown={handleWidgetDragStart}
            onPointerMove={handleWidgetDragMove}
            onPointerUp={handleWidgetDragEnd}
            onPointerCancel={handleWidgetDragEnd}
            style={{
              transform: `translate(calc(-50% + ${floatingWidgetOffset.x}px), ${floatingWidgetOffset.y}px)`,
              touchAction: 'none',
            }}
            className={`fixed bottom-16 left-1/2 z-[45] max-w-[calc(100vw-12px)] flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-xl border shadow-2xl backdrop-blur-md cursor-grab active:cursor-grabbing select-none ${
              isLight
                ? 'bg-white/95 border-slate-200/90 text-slate-900 shadow-slate-900/15'
                : 'bg-[#12161f]/95 border-emerald-500/25 text-slate-100 shadow-black/70'
            }`}
            data-testid="floating-replay-widget"
          >
            {/* Drag grip dots */}
            <div
              className="flex flex-col gap-0.5 px-0.5 opacity-40 hover:opacity-80 cursor-grab"
              title="Drag to move replay widget"
            >
              <span className="w-1 h-1 rounded-full bg-current" />
              <span className="w-1 h-1 rounded-full bg-current" />
              <span className="w-1 h-1 rounded-full bg-current" />
            </div>

            {!isPropChallenge && (
              <button
                type="button"
                onClick={() =>
                  onSetActiveTool(activeTool === 'replay_cut' ? 'cursor' : 'replay_cut')
                }
                className={`p-1 sm:px-1.5 sm:py-1 rounded-lg text-[10px] font-bold border transition ${
                  activeTool === 'replay_cut'
                    ? 'bg-amber-500 text-slate-950 border-amber-400'
                    : cardBg
                }`}
                title="Cut / Jump to any bar"
              >
                <Scissors className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-500" />
              </button>
            )}

            {/* Rewind -1 */}
            <button
              type="button"
              disabled={isPropChallenge}
              onClick={() => onStepBar(-1)}
              className={`p-1 sm:p-1.5 rounded-lg border transition ${
                isPropChallenge
                  ? 'opacity-30 cursor-not-allowed border-transparent'
                  : `${cardBg} hover:border-emerald-500/60`
              }`}
              title={
                isPropChallenge
                  ? 'Rewind disabled in Prop Firm Challenge'
                  : `Rewind by ${replayStepTimeframe}`
              }
            >
              <SkipBack className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            </button>

            {/* Play / Pause */}
            <button
              type="button"
              disabled={isLocked}
              onClick={onTogglePlay}
              className={`flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-lg text-[10px] sm:text-[11px] font-extrabold transition shadow ${
                isPlaying
                  ? 'bg-amber-500 text-slate-950'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white'
              }`}
              title={isPlaying ? 'Pause Replay' : 'Play Replay'}
            >
              {isPlaying ? (
                <Pause className="w-3 h-3 sm:w-3.5 sm:h-3.5 fill-current" />
              ) : (
                <Play className="w-3 h-3 sm:w-3.5 sm:h-3.5 fill-current" />
              )}
              <span className="hidden xs:inline sm:inline">
                {isPlaying ? 'Pause' : 'Play'}
              </span>
            </button>

            {/* Advance +1 */}
            <button
              type="button"
              disabled={isLocked}
              onClick={() => onStepBar(1)}
              className={`flex items-center gap-0.5 px-1.5 sm:px-2 py-1 rounded-lg border text-[10px] sm:text-[11px] font-mono font-bold transition ${cardBg} hover:border-emerald-500/60`}
              title={`Advance by ${replayStepTimeframe}`}
            >
              <SkipForward className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-emerald-400" />
              <span>+{replayStepTimeframe}</span>
            </button>

            {/* Step Size per Tick */}
            <select
              aria-label="Widget replay step"
              value={replayStepTimeframe}
              disabled={isLocked}
              onChange={(e) => onSetReplayStepTimeframe(e.target.value as Timeframe)}
              className={`px-1 sm:px-1.5 py-1 rounded-lg border text-[10px] sm:text-[11px] font-mono font-bold outline-none ${cardBg}`}
              title="Replay step size per tick"
            >
              {(['1m', '5m', '15m', '30m', '1H', '4H', '1D'] as Timeframe[]).map(
                (step) => (
                  <option
                    key={step}
                    value={step}
                    className={
                      isLight ? 'bg-white text-slate-900' : 'bg-[#131722] text-slate-200'
                    }
                  >
                    {TIMEFRAME_CONFIG[step].label}
                  </option>
                )
              )}
            </select>

            {/* Smooth Speed Slider */}
            <div
              className={`flex items-center gap-1 px-1.5 sm:px-2 py-1 rounded-lg border text-[10px] font-mono font-bold ${cardBg}`}
              title={`Smooth Replay Speed (${speedMultiplier.toFixed(1)}x)`}
            >
              <input
                type="range"
                aria-label="Floating widget replay speed slider"
                min={10}
                max={200}
                step={1}
                value={Math.round(speedMultiplier * 10)}
                onChange={(e) => handleSpeedSliderChange(Number(e.target.value))}
                className="w-12 sm:w-16 h-1.5 accent-emerald-500 cursor-pointer"
              />
              <span className="min-w-[28px] text-right text-emerald-400 tabular-nums">
                {speedMultiplier >= 10
                  ? `${Math.round(speedMultiplier)}x`
                  : `${speedMultiplier.toFixed(1)}x`}
              </span>
            </div>

            {/* 1-Click Quick Skip Button */}
            <button
              type="button"
              disabled={isLocked}
              onClick={handleQuickSkip}
              className={`px-1.5 sm:px-2 py-1 rounded-lg border text-[10px] font-extrabold flex items-center gap-1 transition ${
                isLight
                  ? 'bg-emerald-600 hover:bg-emerald-500 border-emerald-600 text-white'
                  : 'bg-emerald-500/20 hover:bg-emerald-500/30 border-emerald-400/50 text-emerald-200'
              }`}
              title={`1-Click Quick Skip to ${quickSkipButtonLabel}`}
            >
              <FastForward className="w-3 h-3 text-emerald-300 shrink-0" />
              <span className="truncate max-w-[68px] sm:max-w-none">
                {quickSkipButtonLabel}
              </span>
            </button>

            {/* Open Skip To Modal */}
            <button
              type="button"
              onClick={() => {
                setSkipModalNotice(null);
                setActiveSkipPicker(null);
                setIsSkipModalOpen(true);
              }}
              className={`p-1 sm:px-1.5 sm:py-1 rounded-lg border text-[10px] font-bold flex items-center gap-0.5 transition ${cardBg} hover:border-emerald-500/60`}
              title="Open Skip To settings modal"
            >
              <Clock className="w-3 h-3 text-emerald-400" />
              <span className="hidden md:inline">Skip To</span>
            </button>

            {/* Close Widget Button */}
            <button
              type="button"
              aria-label="Close floating replay widget"
              title="Close floating replay widget (re-open from bottom bar)"
              onClick={() => toggleFloatingWidget(false)}
              className="p-1 rounded-lg opacity-60 hover:opacity-100 hover:bg-rose-500/20 hover:text-rose-400 transition"
            >
              <X className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            </button>
          </div>,
          document.body
        )}
    </div>
  );
};
