import {createPortal} from 'react-dom';
import {BalanceBadge} from './BalanceBadge';
import React, { useState, useRef, useLayoutEffect } from 'react';
import { ChartReplayMark } from './ChartReplayLogo';
import {
  BarChart3,
  BookOpen,
  BrainCircuit,
  CandlestickChart,
  ChevronDown,
  Clock,
  Columns,
  Compass,
  LayoutDashboard,
  Maximize2,
  Minimize2,
  Moon,
  Radio,
  Scissors,
  Search,
  Settings,
  Sun,
  Trophy,
  User,
  LogOut,
  Wallet,
  X,
  Zap,
} from 'lucide-react';
import {
  CandleColorStyle,
  DisplayTimezone,
  CustomCandleColors,
  InstrumentCategory,
  InstrumentSymbol,
  SessionConfig,
  SessionId,
  ThemeMode,
  Timeframe,
  TradingSession,
} from '../types/trading';
import {
  getCachedRealCandles,
  getInstrumentConfig,
  INSTRUMENTS,
  TIMEFRAME_CONFIG,
} from '../services/goldDataService';
import {
  formatMoney,
  formatTimestampInTimezone,
} from '../services/simulationEngine';
import { ChartFlowUser } from './LoginPage';

interface TopNavigationProps {
  symbol: InstrumentSymbol;
  onSelectSymbol: (sym: InstrumentSymbol) => void;
  timeframe: Timeframe;
  onSelectTimeframe: (tf: Timeframe) => void;
  currentPrice: number;
  dailyChange: number;
  dailyChangePct: number;
  high24h: number;
  low24h: number;
  dataSource: 'LIVE_SPOT_FEED' | 'SYNTHETIC_FALLBACK';
  isLoading: boolean;
  onRefreshData: () => void;
  isReplayMode: boolean;
  onToggleReplayCutTool: () => void;
  isReplayCutActive: boolean;
  showRightWidget: boolean;
  onToggleRightWidget: () => void;
  isChartWideMode: boolean;
  onToggleChartWideMode: () => void;
  sessions: SessionConfig[];
  onToggleSessionEnabled: (id: SessionId) => void;
  currentTimestamp: number;
  candleRemainingText: string;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  theme: ThemeMode;
  onToggleTheme: () => void;
  candleStyle: CandleColorStyle;
  onSelectCandleStyle: (style: CandleColorStyle) => void;
  customCandleColors: CustomCandleColors;
  onChangeCustomCandleColors: (colors: CustomCandleColors) => void;
  onOpenLanding: () => void;
  onOpenLogin: () => void;
  currentUser: ChartFlowUser | null;
  activeSession?: TradingSession;
  liveBalance?: number;
  liveEquity?: number;
  onOpenCreateSession?: () => void;
  onOpenAnalyticsPage?: () => void;
  onOpenDashboard?: () => void;
  onOpenGuide?: () => void;
  onOpenSettings?: () => void;
  onStartTour?: () => void;
  onLogout?:()=>void;
  balanceHidden?:boolean;
  onToggleBalance?:()=>void;
  onChangeTimezone?:(timezone:DisplayTimezone)=>void;
}

const TIMEFRAMES: Timeframe[] = ['1m', '5m', '15m', '30m', '1H', '4H', '1D', '1W', '1M'];

export const CANDLE_PRESETS: {
  id: Exclude<CandleColorStyle, 'custom'>;
  name: string;
  up: string;
  down: string;
}[] = [
  { id: 'tv_blue_black', name: 'Blue / Black (TV)', up: '#2962ff', down: '#131722' },
  { id: 'classic_green_red', name: 'Green / Red (Classic)', up: '#089981', down: '#f23645' },
  { id: 'emerald_crimson', name: 'Emerald / Crimson', up: '#10b981', down: '#ef4444' },
  { id: 'cyan_magenta', name: 'Cyan / Pink Neon', up: '#06b6d4', down: '#ec4899' },
  { id: 'gold_charcoal', name: 'Gold / Slate', up: '#f59e0b', down: '#475569' },
];

export const TopNavigation: React.FC<TopNavigationProps> = ({
  symbol,
  onSelectSymbol,
  timeframe,
  onSelectTimeframe,
  currentPrice,
  dataSource: _dataSource,
  isReplayMode,
  onToggleReplayCutTool,
  isReplayCutActive,
  showRightWidget,
  onToggleRightWidget,
  isChartWideMode,
  onToggleChartWideMode,
  currentTimestamp,
  isFullscreen,
  onToggleFullscreen,
  theme,
  onToggleTheme,
  candleStyle,
  onSelectCandleStyle,
  customCandleColors,
  onChangeCustomCandleColors,
  onOpenLanding,
  onOpenLogin,
  currentUser,
  activeSession,
  liveBalance,
  liveEquity,
  onOpenCreateSession,
  onOpenAnalyticsPage,
  onOpenDashboard,
  onOpenGuide,
  onOpenSettings,
  onStartTour,
  onLogout,
  balanceHidden=false,
  onToggleBalance=()=>{},
  onChangeTimezone,
}) => {
  const [isSymbolModalOpen, setIsSymbolModalOpen] = useState(false);
  const [isCandleMenuOpen, setIsCandleMenuOpen] = useState(false);
  const [isTimeframeMenuOpen, setIsTimeframeMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<InstrumentCategory>('ALL');

  const isLight = theme === 'light';
  const currentInst = getInstrumentConfig(symbol);

  const headerBg = isLight
    ? 'bg-white border-[#e0e3eb] text-[#131722]'
    : 'bg-[#12151b] border-[#242832] text-[#d1d4dc]';
  const cardBg = isLight
    ? 'bg-[#f8f9fd] hover:bg-[#f0f3fa] border-[#e0e3eb] text-[#131722]'
    : 'bg-[#181c24] hover:bg-[#202530] border-[#262a34] text-gray-200';
  const timeframeButtonRef = useRef<HTMLButtonElement>(null);
  const [timeframeMenuPosition, setTimeframeMenuPosition] = useState({left: 8, top: 48});
  useLayoutEffect(() => {
    if (!isTimeframeMenuOpen) return;
    const place = () => {
      const rect = timeframeButtonRef.current?.getBoundingClientRect();
      if (rect) setTimeframeMenuPosition({left: Math.max(8, Math.min(rect.left, window.innerWidth - 200)), top: rect.bottom + 6});
    };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') setIsTimeframeMenuOpen(false); };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    window.addEventListener('keydown', escape);
    return () => { window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true); window.removeEventListener('keydown', escape); };
  }, [isTimeframeMenuOpen]);

  const candleButtonRef=useRef<HTMLButtonElement>(null);
  const [candleMenuPosition,setCandleMenuPosition]=useState({left:8,top:48});
  useLayoutEffect(()=>{
    if(!isCandleMenuOpen)return;
    const place=()=>{const rect=candleButtonRef.current?.getBoundingClientRect();if(rect)setCandleMenuPosition({left:Math.max(8,Math.min(rect.left,window.innerWidth-280)),top:rect.bottom+8});};
    const escape=(event:KeyboardEvent)=>{if(event.key==='Escape')setIsCandleMenuOpen(false);};
    place();window.addEventListener('resize',place);window.addEventListener('scroll',place,true);window.addEventListener('keydown',escape);
    return()=>{window.removeEventListener('resize',place);window.removeEventListener('scroll',place,true);window.removeEventListener('keydown',escape);};
  },[isCandleMenuOpen]);
  const dividerBg = isLight ? 'bg-[#e0e3eb]' : 'bg-[#262a34]';

  const filteredInstruments = INSTRUMENTS.filter((inst) => {
    const matchesCat =
      selectedCategory === 'ALL' ||
      (selectedCategory === 'FOREX' &&
        (inst.category === 'FOREX_MAJORS' || inst.category === 'FOREX_CROSSES')) ||
      inst.category === selectedCategory;
    const q = searchQuery.trim().toLowerCase();
    const matchesSearch =
      !q ||
      inst.symbol.toLowerCase().includes(q) ||
      inst.displaySymbol.toLowerCase().includes(q) ||
      inst.name.toLowerCase().includes(q);
    return matchesCat && matchesSearch;
  });

  const activePreset = CANDLE_PRESETS.find((p) => p.id === candleStyle);
  const displayUpColor =
    candleStyle === 'custom'
      ? customCandleColors.upColor
      : activePreset?.up ?? '#2962ff';
  const displayDownColor =
    candleStyle === 'custom'
      ? customCandleColors.downColor
      : activePreset?.down ?? '#131722';

  const accountCurrency = activeSession?.accountCurrency || 'USD';
  const computedBalance =
    liveBalance !== undefined
      ? liveBalance
      : (activeSession?.startingBalance ?? 100000) + (activeSession?.realizedPnL ?? 0);
  const computedEquity =
    liveEquity !== undefined ? liveEquity : computedBalance;
  const floatingDiff = computedEquity - computedBalance;

  const displayTz = activeSession?.displayTimezone || 'UTC';
  const authoritativeClockTs = currentTimestamp;
  const formattedReplayClock = formatTimestampInTimezone(authoritativeClockTs, displayTz);
  const isPropChallenge = activeSession?.mode === 'PROP_FIRM';
  const sessionStatus = activeSession?.challengeState?.status || activeSession?.status || 'ACTIVE';
  const activePhase =
    activeSession?.frozenConfig?.propFirmRules?.challengePhase ||
    activeSession?.propFirmRules?.challengePhase ||
    'PHASE_1';
  const phaseShortLabel =
    activePhase === 'PHASE_2'
      ? 'PHASE 2'
      : activePhase === 'FUNDED'
      ? 'FUNDED'
      : 'PHASE 1';

  return (
    <>
      <header
        className={`relative h-11 border-b px-1.5 sm:px-2 flex items-center justify-between gap-1 select-none shrink-0 z-30 ${headerBg}`}
      >
        <div className="flex items-center gap-1 min-w-0 flex-1 overflow-x-auto no-scrollbar">
          {/* Left: Brand + Active Session Name + Symbol Selector + Timeframe Dropdown + Replay Clock */}
          <div className="flex items-center gap-1 shrink-0">
          {/* Brand Logo (Returns to Landing Page) */}
          <button
            onClick={onOpenLanding || onOpenDashboard}
            className={`flex items-center pr-1.5 border-r transition hover:opacity-85 whitespace-nowrap shrink-0 ${
              isLight ? 'border-[#d8dce6]' : 'border-[#262a34]'
            }`}
            title="Return to Landing Page"
          >
            <ChartReplayMark size={24} />
          </button>

          {/* Session Name & Mode Pill */}
          {activeSession && (
            <button
              data-tour="top-session"
              onClick={onOpenCreateSession}
              className={`flex items-center gap-1 px-1.5 py-1 rounded border transition whitespace-nowrap min-w-0 ${
                sessionStatus === 'FAILED'
                  ? 'bg-rose-500/15 border-rose-500/50 text-rose-400'
                  : sessionStatus === 'PASSED'
                  ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-400'
                  : isPropChallenge
                  ? isLight
                    ? 'bg-amber-50 border-amber-300 text-amber-800'
                    : 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                  : cardBg
              }`}
              title={`Session: ${activeSession.name} (${
                isPropChallenge
                  ? `Prop Firm Challenge · ${phaseShortLabel}`
                  : 'Normal Backtest'
              }) — Click to Switch or Create New Session`}
            >
              {isPropChallenge ? (
                <Trophy className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              ) : (
                <Zap className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              )}
              <span className="text-[11px] font-bold max-w-[90px] sm:max-w-[140px] xl:max-w-[180px] truncate">
                {activeSession.name}
              </span>
              <span
                className={`hidden sm:inline text-[9px] font-mono font-bold px-1 py-0.2 rounded uppercase shrink-0 ${
                  sessionStatus === 'FAILED'
                    ? 'bg-rose-500 text-white keep-white'
                    : sessionStatus === 'PASSED'
                    ? 'bg-emerald-500 text-white keep-white'
                    : isPropChallenge
                    ? 'bg-amber-500/20 text-amber-400'
                    : 'bg-[#262b36] text-[#cbd5e1] keep-white'
                }`}
              >
                {sessionStatus === 'ACTIVE'
                  ? isPropChallenge
                    ? phaseShortLabel
                    : activeSession?.marketMode === 'LIVE_PAPER' ? 'PAPER · LIVE' : 'BACKTEST'
                  : `${isPropChallenge ? `${phaseShortLabel} · ` : ''}${sessionStatus}`}
              </span>
            </button>
          )}

          {/* Instrument Selector Button */}
          <button
            onClick={() => setIsSymbolModalOpen(true)}
            className={`flex items-center gap-1 px-1.5 py-1 rounded border transition whitespace-nowrap shrink-0 ${cardBg}`}
            title="Switch Market / Instrument (Synchronized to Session Replay Clock)"
          >
            <span className="text-[11px] font-bold flex items-center gap-1">
              <span
                className={`text-[9px] font-mono px-1 py-0.2 rounded border ${
                  isLight
                    ? 'bg-amber-50 text-amber-800 border-amber-300'
                    : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                }`}
              >
                {currentInst.icon}
              </span>
              {currentInst.displaySymbol}
            </span>
            <ChevronDown className="w-3 h-3 opacity-60 shrink-0" />
          </button>

          {/* Compact Timeframe Selector (TF + Active Timeframe Dropdown) */}
          <div className="relative shrink-0">
            <button
              type="button"
              ref={timeframeButtonRef}
              aria-expanded={isTimeframeMenuOpen}
              onClick={() => setIsTimeframeMenuOpen((v) => !v)}
              className={`flex items-center gap-1.5 px-2 py-1 rounded border transition whitespace-nowrap ${cardBg}`}
              title={`Active Timeframe: ${timeframe} (${TIMEFRAME_CONFIG[timeframe].description}) — Click to switch timeframe`}
            >
              <span className="text-[10px] font-extrabold uppercase tracking-wider opacity-65">
                TF
              </span>
              <span className="px-1.5 py-0.2 rounded bg-emerald-600 text-white keep-white text-[11px] font-mono font-extrabold">
                {timeframe}
              </span>
              <ChevronDown className="w-3 h-3 opacity-60 shrink-0" />
            </button>
          </div>

          {/* Authoritative Replay Date/Time Badge */}
          <div
            className={`hidden md:flex items-center gap-1 px-1.5 py-1 rounded text-[10px] font-mono border whitespace-nowrap shrink-0 ${
              isLight
                ? 'bg-amber-50 border-amber-300 text-amber-900'
                : 'bg-[#181c24] border-[#2a2f3b] text-[#e2e8f0]'
            }`}
            title={`${isReplayMode ? 'Session replay clock' : 'Current market clock'} (${displayTz})`}
          >
            <Clock className="w-3 h-3 text-emerald-400 shrink-0" />
            <span className="font-bold">
              {formattedReplayClock} {displayTz}
            </span>
          </div>

          {onChangeTimezone && <label className={`inline-flex items-center gap-1 rounded border px-1.5 py-1 text-[10px] shrink-0 ${cardBg}`} title="Change chart time zone"><Clock className="w-3 h-3 text-emerald-500"/><select aria-label="Chart time zone" value={displayTz} onChange={event=>onChangeTimezone(event.target.value as DisplayTimezone)} className="bg-transparent outline-none max-w-[100px]">{([{value:'UTC',label:'UTC'},{value:'Europe/London',label:'London'},{value:'America/New_York',label:'New York'},{value:'Africa/Johannesburg',label:'South Africa'},{value:'Europe/Prague',label:'Prague'},{value:'Asia/Tokyo',label:'Tokyo'},{value:'Australia/Sydney',label:'Sydney'}] as const).map(zone=><option key={zone.value} value={zone.value} className={isLight?'bg-white text-slate-900':'bg-[#161920] text-slate-100'}>{zone.label}</option>)}</select></label>}

          {/* Candle Color Picker */}
          <div className="relative shrink-0">
            <button
              ref={candleButtonRef}
              aria-label="Customize candle colors"
              aria-expanded={isCandleMenuOpen}
              onClick={() => {setIsTimeframeMenuOpen(false);setIsCandleMenuOpen((v) => !v);}}
              className={`flex items-center gap-1 px-1.5 py-1 rounded text-[11px] font-medium border transition whitespace-nowrap ${cardBg}`}
              title="Customize Candle Colors"
            >
              <CandlestickChart className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span className="flex items-center gap-0.5">
                <span
                  className="w-2.5 h-2.5 rounded-full border border-black/20"
                  style={{ backgroundColor: displayUpColor }}
                />
                <span
                  className="w-2.5 h-2.5 rounded-full border border-black/20"
                  style={{ backgroundColor: displayDownColor }}
                />
              </span>
            </button>

            {isCandleMenuOpen && createPortal(<>
              <button type="button" aria-label="Dismiss candle color menu" className="fixed inset-0 z-[70] cursor-default" onClick={()=>setIsCandleMenuOpen(false)} />
              <div role="dialog" aria-label="Candle colors" style={{...candleMenuPosition,maxHeight:Math.max(180,window.innerHeight-candleMenuPosition.top-12)}}
                className={`fixed w-64 overflow-y-auto rounded-xl border p-3 z-[71] text-xs shadow-2xl space-y-2.5 ${
                  isLight
                    ? 'bg-white border-[#d8dce6] text-[#131722]'
                    : 'bg-[#161920] border-[#282c35] text-[#d1d4dc]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider opacity-70">
                    Candle Color Themes
                  </span>
                  <button
                    onClick={() => setIsCandleMenuOpen(false)}
                    className="p-0.5 rounded hover:bg-gray-500/20"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="space-y-1">
                  {CANDLE_PRESETS.map((preset) => {
                    const active = candleStyle === preset.id;
                    return (
                      <button
                        key={preset.id}
                        onClick={() => {
                          onSelectCandleStyle(preset.id);
                          onChangeCustomCandleColors({
                            upColor: preset.up,
                            downColor: preset.down,
                          });
                        }}
                        className={`w-full px-2.5 py-1.5 rounded-lg flex items-center justify-between text-left transition ${
                          active
                            ? 'bg-emerald-500/15 text-emerald-400 font-semibold border border-emerald-500/40'
                            : 'hover:bg-white/5 border border-transparent'
                        }`}
                      >
                        <span>{preset.name}</span>
                        <span className="flex items-center gap-1">
                          <span
                            className="w-3.5 h-3.5 rounded-sm border border-black/20"
                            style={{ backgroundColor: preset.up }}
                          />
                          <span
                            className="w-3.5 h-3.5 rounded-sm border border-black/20"
                            style={{ backgroundColor: preset.down }}
                          />
                        </span>
                      </button>
                    );
                  })}
                </div>
                <div className="border-t border-slate-500/20 pt-2 grid grid-cols-2 gap-2">{(['upColor','downColor'] as const).map(key=><label key={key} className="flex items-center justify-between gap-2 text-[10px]">{key==='upColor'?'Bullish':'Bearish'}<input aria-label={key==='upColor'?'Bullish candle color':'Bearish candle color'} type="color" value={customCandleColors[key]} onChange={event=>{onSelectCandleStyle('custom');onChangeCustomCandleColors({...customCandleColors,[key]:event.target.value});}} className="w-8 h-7 rounded bg-transparent cursor-pointer"/></label>)}</div>
              </div>
            </>,document.body)}
          </div>
        </div>

        {/* Center/Right: Account Balance & Equity + Data Status + Actions */}
        <div className="flex items-center gap-1 shrink-0">
          <BalanceBadge balance={computedBalance} equity={computedEquity} currency={accountCurrency} hidden={balanceHidden} onToggle={onToggleBalance} isLight={isLight} className="hidden sm:flex" />

          {/* View Analytics Action */}
          {onOpenAnalyticsPage && (
            <button
              data-tour="top-analytics"
              onClick={onOpenAnalyticsPage}
              className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] font-bold border transition whitespace-nowrap shrink-0 ${cardBg}`}
              title="View Session & Account Analytics"
            >
              <BarChart3 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span className="hidden md:inline">Analytics</span>
            </button>
          )}

          {/* Dashboard Route Button */}
          {onOpenDashboard && (
            <button
              onClick={onOpenDashboard}
              className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] font-bold border transition whitespace-nowrap shrink-0 ${cardBg}`}
              title="Open Sessions & Account Dashboard"
            >
              <LayoutDashboard className="w-3.5 h-3.5 text-[#a0a7b8] shrink-0" />
              <span className="hidden md:inline">Dashboard</span>
            </button>
          )}

          <button onClick={currentUser?onLogout:onOpenLogin} aria-label={currentUser?'Log out':'Sign in'} title={currentUser?'Log out and return to homepage':'Sign in'} className={`flex items-center gap-1 px-2 py-1 rounded border text-[11px] font-semibold whitespace-nowrap shrink-0 ${cardBg}`}><LogOut className="w-3.5 h-3.5"/><span className="hidden md:inline">{currentUser?'Log out':'Sign in'}</span></button>

          {/* Take the Tour (interactive spotlight walkthrough) */}
          {onStartTour && (
            <button
              data-tour="top-tour-button"
              onClick={onStartTour}
              className="flex items-center gap-1 px-2 py-1 rounded text-[11px] font-bold border transition whitespace-nowrap shrink-0 bg-emerald-500/10 border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/20"
              title="Take the tour — step-by-step walkthrough of placing your first trade"
            >
              <Compass className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden md:inline">Tour</span>
            </button>
          )}

          {/* Theme Toggle */}
          <button
            onClick={onToggleTheme}
            className={`p-1.5 rounded border transition shrink-0 ${cardBg}`}
            title={isLight ? 'Switch to Dark Theme' : 'Switch to Light Theme'}
          >
            {isLight ? (
              <Moon className="w-3.5 h-3.5 text-slate-600" />
            ) : (
              <Sun className="w-3.5 h-3.5 text-amber-400" />
            )}
          </button>

          {/* Wide Chart Mode */}
          <button
            onClick={onToggleChartWideMode}
            className={`p-1.5 rounded border transition shrink-0 ${
              isChartWideMode
                ? 'bg-[#252a34] text-white keep-white border-[#3a404f]'
                : cardBg
            }`}
            title="Wide Chart Mode"
          >
            <Columns className="w-3.5 h-3.5" />
          </button>

          {/* Browser Full Screen */}
          <button
            onClick={onToggleFullscreen}
            className={`p-1.5 rounded border transition shrink-0 ${
              isFullscreen
                ? 'bg-[#252a34] text-white keep-white border-[#3a404f]'
                : cardBg
            }`}
            title={isFullscreen ? 'Exit Full Screen' : 'Enter Full Screen'}
          >
            {isFullscreen ? (
              <Minimize2 className="w-3.5 h-3.5" />
            ) : (
              <Maximize2 className="w-3.5 h-3.5" />
            )}
          </button>


        </div>
        </div>
      </header>

      {/* Timeframe Dropdown Menu (Fixed overlay so horizontal scroll on mobile never clips it) */}
      {isTimeframeMenuOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsTimeframeMenuOpen(false)}
          />
          <div
            style={{left: timeframeMenuPosition.left, top: timeframeMenuPosition.top, maxHeight: 'calc(100dvh - 64px)'}}
            className={`fixed overflow-y-auto w-48 rounded-xl border p-1.5 z-50 text-xs shadow-2xl space-y-0.5 ${
              isLight
                ? 'bg-white border-[#d8dce6] text-[#131722]'
                : 'bg-[#161920] border-[#282c35] text-[#d1d4dc]'
            }`}
          >
            <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider opacity-60 border-b border-gray-500/15 mb-1">
              Select Timeframe
            </div>
            {TIMEFRAMES.map((tf) => {
              const active = tf === timeframe;
              return (
                <button
                  key={tf}
                  type="button"
                  onClick={() => {
                    onSelectTimeframe(tf);
                    setIsTimeframeMenuOpen(false);
                  }}
                  className={`w-full px-2.5 py-1.5 rounded-lg flex items-center justify-between text-left transition ${
                    active
                      ? 'bg-emerald-600 text-white keep-white font-bold'
                      : isLight
                      ? 'hover:bg-[#f0f3fa] text-[#131722]'
                      : 'hover:bg-white/5 text-[#d1d4dc]'
                  }`}
                >
                  <span className="font-mono font-bold text-xs">{tf}</span>
                  <span
                    className={`text-[10px] ${
                      active ? 'text-white/90 keep-white' : 'opacity-65'
                    }`}
                  >
                    {TIMEFRAME_CONFIG[tf].label}
                  </span>
                </button>
              );
            })}
          </div>
        </>
      )}

      {/* Instrument Selector Modal */}
      {isSymbolModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div
            className={`w-full max-w-xl border rounded-xl shadow-2xl overflow-hidden ${
              isLight
                ? 'bg-white border-[#e0e3eb] text-[#131722]'
                : 'bg-[#12151b] border-[#262a34] text-white'
            }`}
          >
            <div
              className={`px-4 py-3 border-b flex items-center justify-between ${
                isLight ? 'border-[#e0e3eb]' : 'border-[#262a34]'
              }`}
            >
              <div className="flex items-center gap-2">
                <Search className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-bold">
                  Select Instrument — Synchronized to Replay Clock ({formattedReplayClock})
                </h3>
              </div>
              <button
                onClick={() => setIsSymbolModalOpen(false)}
                className="p-1 rounded hover:bg-gray-500/20"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-3">
              {/* Search & Category Tabs */}
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 opacity-50 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search symbol (e.g. XAUUSD, NAS100, EURUSD, GBPJPY)..."
                    className={`w-full pl-8 pr-3 py-1.5 rounded-lg border text-xs outline-none ${
                      isLight
                        ? 'bg-[#f8f9fd] border-[#e0e3eb] text-[#131722]'
                        : 'bg-[#0d0f13] border-[#262a34] text-white'
                    }`}
                  />
                </div>
                <div className="flex items-center gap-1 text-[11px] font-semibold flex-wrap">
                  {(
                    [
                      ['ALL', 'All'],
                      ['FOREX', 'Forex'],
                      ['METALS', 'Metals'],
                      ['INDICES', 'Indices'],
                      ['ENERGIES', 'Energies'],
                      ['CRYPTO', 'Crypto'],
                    ] as [InstrumentCategory, string][]
                  ).map(([cat, label]) => (
                    <button
                      key={cat}
                      onClick={() => setSelectedCategory(cat)}
                      className={`px-2.5 py-1.5 rounded-lg border transition ${
                        selectedCategory === cat
                          ? 'bg-[#252a34] text-white border-[#3a404f]'
                          : isLight
                          ? 'bg-[#f8f9fd] border-[#e0e3eb] text-[#434651]'
                          : 'bg-[#181c24] border-[#262a34] text-gray-300'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {activeSession && activeSession.assets.length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap text-[11px]">
                  <span className="font-bold opacity-70">Session Watchlist:</span>
                  {activeSession.assets.map((sym: InstrumentSymbol) => (
                    <button
                      key={sym}
                      onClick={() => {
                        onSelectSymbol(sym);
                        setIsSymbolModalOpen(false);
                      }}
                      className={`px-2 py-0.5 rounded font-mono font-bold border transition ${
                        sym === symbol
                          ? 'bg-emerald-600 text-white border-emerald-500'
                          : 'bg-[#181c24] text-[#cbd5e1] border-[#2a2f3b] hover:bg-[#222732]'
                      }`}
                    >
                      {sym}
                    </button>
                  ))}
                </div>
              )}

              <div className="max-h-80 overflow-y-auto space-y-1.5 pr-1 custom-scrollbar">
                {filteredInstruments.map((inst) => {
                  const isActive = inst.symbol === symbol;
                  const inSession = activeSession?.assets.includes(inst.symbol);
                  const customSpec = activeSession?.instrumentSpecs?.[inst.symbol];
                  const contractSize = customSpec?.contractSize ?? inst.contractSize;
                  return (
                    <div
                      key={inst.symbol}
                      onClick={() => {
                        onSelectSymbol(inst.symbol);
                        setIsSymbolModalOpen(false);
                      }}
                      className={`flex items-center justify-between p-2.5 rounded-lg border cursor-pointer transition ${
                        isActive
                          ? 'bg-emerald-500/10 border-emerald-500/60'
                          : isLight
                          ? 'bg-[#f8f9fd] hover:bg-[#f0f3fa] border-[#e0e3eb]'
                          : 'bg-[#161920] hover:bg-[#1d212a] border-[#242832]'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="w-9 h-7 rounded bg-[#1e222a] border border-[#2e333d] flex items-center justify-center text-[10px] font-mono font-bold text-emerald-400">
                          {inst.icon}
                        </span>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs">{inst.displaySymbol}</span>
                            {isActive && (
                              <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-mono font-bold">
                                ACTIVE
                              </span>
                            )}
                            {inSession && !isActive && (
                              <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#252a34] text-[#cbd5e1] font-mono font-bold">
                                IN SESSION
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] opacity-75">
                            {inst.name} · Contract: {contractSize.toLocaleString()}{' '}
                            {inst.category === 'METALS'
                              ? 'oz'
                              : inst.category === 'INDICES'
                              ? 'contracts'
                              : 'units'}
                          </span>
                        </div>
                      </div>
                      <div className="text-right font-mono">
                        <div className="text-xs font-bold">
                          {isActive
                            ? (Number.isFinite(currentPrice) ? currentPrice.toFixed(inst.decimals) : '—')
                            : (getCachedRealCandles(timeframe, inst.symbol)?.filter(c => c.time <= currentTimestamp).slice(-1)[0]?.close.toFixed(inst.decimals) ?? '—')}
                        </div>
                        <div className="text-[10px] text-emerald-400 flex items-center gap-1 justify-end">
                          <Radio className="w-2.5 h-2.5" /> Provider candles
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
