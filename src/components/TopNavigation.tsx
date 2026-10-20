import React, { useState } from 'react';
import {
  BrainCircuit,
  CandlestickChart,
  ChevronDown,
  Clock,
  Columns,
  Home,
  Maximize2,
  Minimize2,
  Moon,
  Radio,
  RefreshCw,
  Scissors,
  Search,
  Sparkles,
  Sun,
  User,
  X,
} from 'lucide-react';
import {
  CandleColorStyle,
  InstrumentCategory,
  InstrumentSymbol,
  SessionConfig,
  SessionId,
  ThemeMode,
  Timeframe,
} from '../types/trading';
import {
  getActiveSessionsAtTime,
  getInstrumentConfig,
  INSTRUMENTS,
  TIMEFRAME_CONFIG,
} from '../services/goldDataService';
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
  onToggleCandleStyle: () => void;
  onOpenLanding: () => void;
  onOpenLogin: () => void;
  currentUser: ChartFlowUser | null;
}

const TIMEFRAMES: Timeframe[] = ['1m', '5m', '15m', '30m', '1H', '4H', '1D'];

export const TopNavigation: React.FC<TopNavigationProps> = ({
  symbol,
  onSelectSymbol,
  timeframe,
  onSelectTimeframe,
  currentPrice,
  dataSource,
  isLoading,
  onRefreshData,
  isReplayMode,
  onToggleReplayCutTool,
  isReplayCutActive,
  showRightWidget,
  onToggleRightWidget,
  isChartWideMode,
  onToggleChartWideMode,
  sessions,
  onToggleSessionEnabled,
  currentTimestamp,
  candleRemainingText,
  isFullscreen,
  onToggleFullscreen,
  theme,
  onToggleTheme,
  candleStyle,
  onToggleCandleStyle,
  onOpenLanding,
  onOpenLogin,
  currentUser,
}) => {
  const [isSymbolModalOpen, setIsSymbolModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<InstrumentCategory>('ALL');

  const isLight = theme === 'light';
  const currentInst = getInstrumentConfig(symbol);
  const { active: activeSessions } = getActiveSessionsAtTime(currentTimestamp, sessions);
  const activeIds = new Set(activeSessions.map((s) => s.id));

  const headerBg = isLight
    ? 'bg-white border-[#e0e3eb] text-[#131722]'
    : 'bg-[#131722] border-[#2a2e39] text-[#d1d4dc]';
  const cardBg = isLight
    ? 'bg-[#f8f9fd] hover:bg-[#f0f3fa] border-[#e0e3eb] text-[#131722]'
    : 'bg-[#1e222d] hover:bg-[#262b38] border-[#2a2e39] text-gray-200';
  const dividerBg = isLight ? 'bg-[#e0e3eb]' : 'bg-[#2a2e39]';

  const filteredInstruments = INSTRUMENTS.filter((inst) => {
    const matchesCat = selectedCategory === 'ALL' || inst.category === selectedCategory;
    const q = searchQuery.trim().toLowerCase();
    const matchesSearch =
      !q ||
      inst.symbol.toLowerCase().includes(q) ||
      inst.displaySymbol.toLowerCase().includes(q) ||
      inst.name.toLowerCase().includes(q);
    return matchesCat && matchesSearch;
  });

  return (
    <>
      <header
        className={`h-12 border-b px-3 flex items-center justify-between gap-2 select-none shrink-0 z-30 ${headerBg}`}
      >
        {/* Left: Chart Flow Brand + Instrument Selector + Timeframes */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
          {/* Chart Flow Brand Logo (Clicks back to Landing Page) */}
          <button
            onClick={onOpenLanding}
            className={`flex items-center gap-1.5 pr-2.5 border-r transition hover:opacity-85 ${
              isLight ? 'border-[#e0e3eb]' : 'border-[#2a2e39]'
            }`}
            title="Chart Flow — View Landing Page & Free Features"
          >
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#2962ff] via-indigo-500 to-emerald-400 flex items-center justify-center text-white font-black text-xs shadow">
              CF
            </div>
            <div className="hidden sm:flex items-center gap-1.5">
              <span className="font-extrabold text-xs tracking-tight">
                CHART <span className="text-[#2962ff]">FLOW</span>
              </span>
              <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded bg-emerald-500/15 text-emerald-500 border border-emerald-500/30">
                FREE
              </span>
            </div>
          </button>

          {/* Instrument Selector Button */}
          <button
            onClick={() => setIsSymbolModalOpen(true)}
            className={`flex items-center gap-2 px-2.5 py-1 rounded border transition ${cardBg}`}
            title="Switch Market / Instrument (100% Free Multi-Asset Feed)"
          >
            <span className="text-xs font-bold flex items-center gap-1.5">
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-500 border border-amber-500/30">
                {currentInst.icon}
              </span>
              {currentInst.displaySymbol}
            </span>
            <span className="hidden md:inline text-[10px] px-1.5 py-0.2 rounded bg-[#2962ff]/15 text-[#2962ff] font-mono font-semibold">
              {currentInst.exchange.split('·')[0].trim()}
            </span>
            <ChevronDown className="w-3.5 h-3.5 opacity-60" />
          </button>

          <div className={`h-5 w-px ${dividerBg}`} />

          {/* Timeframe Buttons (1m up to 1D) */}
          <div
            className={`flex items-center gap-0.5 p-0.5 rounded border ${
              isLight ? 'bg-[#f0f3fa] border-[#e0e3eb]' : 'bg-[#0b0e14] border-[#2a2e39]'
            }`}
          >
            {TIMEFRAMES.map((tf) => {
              const active = tf === timeframe;
              return (
                <button
                  key={tf}
                  onClick={() => onSelectTimeframe(tf)}
                  className={`px-2 py-1 rounded text-xs font-mono font-semibold transition ${
                    active
                      ? 'bg-[#2962ff] text-white shadow'
                      : isLight
                      ? 'text-[#434651] hover:text-[#131722] hover:bg-white'
                      : 'text-[#787b86] hover:text-white hover:bg-[#1e222d]'
                  }`}
                  title={TIMEFRAME_CONFIG[tf].description}
                >
                  {tf}
                </button>
              );
            })}
          </div>

          {/* Candle Color Style Switcher (Blue/Black vs Green/Red) */}
          <button
            onClick={onToggleCandleStyle}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium border transition ${cardBg}`}
            title="Switch Candle Color Palette (TradingView Blue/Black vs Classic Green/Red)"
          >
            <CandlestickChart className="w-3.5 h-3.5 text-[#2962ff]" />
            <span className="hidden xl:inline text-[11px]">
              {candleStyle === 'tv_blue_black' ? 'Blue/Black' : 'Green/Red'}
            </span>
          </button>

          {/* Live Candle Countdown Pill */}
          <div
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-mono border ${
              isReplayMode
                ? 'bg-amber-500/15 border-amber-500/40 text-amber-600 dark:text-amber-300'
                : 'bg-emerald-500/15 border-emerald-500/35 text-emerald-700 dark:text-emerald-300'
            }`}
            title={
              isReplayMode
                ? 'Currently in Historical Bar Replay Mode'
                : `Live ${timeframe} Candle — Time remaining until next candle closes`
            }
          >
            {isReplayMode ? (
              <>
                <Clock className="w-3.5 h-3.5 text-amber-500" />
                <span className="font-bold">REPLAY</span>
              </>
            ) : (
              <>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                <span className="text-[10px] uppercase font-sans font-bold">
                  LIVE
                </span>
                <span className="font-bold">{candleRemainingText}</span>
              </>
            )}
          </div>

          <div className={`hidden 2xl:block h-5 w-px ${dividerBg}`} />

          {/* Quick Session Toggle Pills (Australia, Asia, London, New York) */}
          <div className="hidden 2xl:flex items-center gap-1">
            {sessions.map((s) => {
              const isOpen = activeIds.has(s.id);
              return (
                <button
                  key={s.id}
                  onClick={() => onToggleSessionEnabled(s.id)}
                  className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium border transition ${
                    s.enabled ? cardBg : 'border-transparent opacity-50'
                  }`}
                  title={`${s.name} (${String(s.startHourUTC).padStart(2, '0')}:00–${String(
                    s.endHourUTC
                  ).padStart(2, '0')}:00 UTC)`}
                >
                  <span className="text-[10px] font-mono opacity-60">{s.flag}</span>
                  <span>{s.city}</span>
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      isOpen ? 'bg-emerald-500 shadow-[0_0_6px_#10b981]' : 'bg-gray-400'
                    }`}
                  />
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: Replay + Theme + Wide Chart + Fullscreen + AI + Landing/Login */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Bar Replay Cut Button */}
          <button
            onClick={onToggleReplayCutTool}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-bold border transition ${
              isReplayCutActive || isReplayMode
                ? 'bg-amber-500 text-[#0b0e14] border-amber-500'
                : cardBg
            }`}
            title="Free Bar Replay & Rewind Mode"
          >
            <Scissors className="w-3.5 h-3.5 text-amber-500" />
            <span className="hidden sm:inline">Replay</span>
          </button>

          {/* White Mode / Black Mode Toggle */}
          <button
            onClick={onToggleTheme}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-bold border transition ${cardBg}`}
            title={
              isLight
                ? 'Switch to Black Mode (Dark Theme)'
                : 'Switch to White Mode (Light Theme)'
            }
          >
            {isLight ? (
              <>
                <Moon className="w-3.5 h-3.5 text-indigo-600" />
                <span className="hidden lg:inline">Dark</span>
              </>
            ) : (
              <>
                <Sun className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden lg:inline">Light</span>
              </>
            )}
          </button>

          {/* Wide Chart Only Mode */}
          <button
            onClick={onToggleChartWideMode}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-bold border transition ${
              isChartWideMode
                ? 'bg-[#2962ff] text-white border-[#2962ff]'
                : cardBg
            }`}
            title="Wide Chart Mode — Make the chart section wide/full window"
          >
            <Columns className="w-3.5 h-3.5" />
            <span className="hidden xl:inline">
              {isChartWideMode ? 'Restore Panels' : 'Wide Chart'}
            </span>
          </button>

          {/* Browser Full Screen Button */}
          <button
            onClick={onToggleFullscreen}
            className={`p-1.5 rounded border transition ${
              isFullscreen
                ? 'bg-[#2962ff] text-white border-[#2962ff]'
                : cardBg
            }`}
            title={isFullscreen ? 'Exit Full Screen (Esc)' : 'Enter Full Screen Mode'}
          >
            {isFullscreen ? (
              <Minimize2 className="w-3.5 h-3.5" />
            ) : (
              <Maximize2 className="w-3.5 h-3.5" />
            )}
          </button>

          {/* Refresh Data */}
          <button
            onClick={onRefreshData}
            className={`p-1.5 rounded border transition ${cardBg}`}
            title={`Data Feed: ${dataSource} — Click to resync candles`}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-amber-500' : ''}`} />
          </button>

          {/* Toggle Market AI Intelligence Side Widget */}
          <button
            onClick={onToggleRightWidget}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-bold border transition ${
              showRightWidget && !isChartWideMode
                ? 'bg-gradient-to-r from-[#2962ff] to-indigo-600 text-white border-blue-400 shadow'
                : cardBg
            }`}
            title="Toggle Free AI Momentum, News & Sentiment Widget"
          >
            <BrainCircuit className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Flow AI</span>
          </button>

          {/* Landing Page Button */}
          <button
            onClick={onOpenLanding}
            className={`p-1.5 rounded border transition ${cardBg}`}
            title="Open Chart Flow Landing Page"
          >
            <Home className="w-3.5 h-3.5" />
          </button>

          {/* Login / User Account Button */}
          <button
            onClick={onOpenLogin}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-bold border transition ${
              currentUser
                ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-600 dark:text-emerald-300'
                : cardBg
            }`}
            title={
              currentUser
                ? `Logged in as ${currentUser.name} (100% Free Forever)`
                : 'Log In or Create Free Chart Flow Account'
            }
          >
            <User className="w-3.5 h-3.5" />
            <span className="hidden md:inline">
              {currentUser ? currentUser.name.split(' ')[0] : 'Log In'}
            </span>
          </button>
        </div>
      </header>

      {/* Instrument Selector Modal (All 12 Instruments 100% Free & Unlocked) */}
      {isSymbolModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div
            className={`w-full max-w-xl border rounded-xl shadow-2xl overflow-hidden ${
              isLight
                ? 'bg-white border-[#e0e3eb] text-[#131722]'
                : 'bg-[#131722] border-[#2a2e39] text-white'
            }`}
          >
            <div
              className={`px-4 py-3 border-b flex items-center justify-between ${
                isLight ? 'border-[#e0e3eb]' : 'border-[#2a2e39]'
              }`}
            >
              <div className="flex items-center gap-2">
                <Search className="w-4 h-4 text-[#2962ff]" />
                <h3 className="text-sm font-bold">
                  Chart Flow Market Selector — All Markets 100% Free
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
                        : 'bg-[#0b0e14] border-[#2a2e39] text-white'
                    }`}
                  />
                </div>
                <div className="flex items-center gap-1 text-[11px] font-semibold">
                  {(
                    [
                      ['ALL', 'All'],
                      ['METALS', 'Metals'],
                      ['INDICES', 'Indices'],
                      ['FOREX_MAJORS', 'Forex'],
                    ] as [InstrumentCategory, string][]
                  ).map(([cat, label]) => (
                    <button
                      key={cat}
                      onClick={() => setSelectedCategory(cat)}
                      className={`px-2.5 py-1.5 rounded-lg border transition ${
                        selectedCategory === cat
                          ? 'bg-[#2962ff] text-white border-[#2962ff]'
                          : isLight
                          ? 'bg-[#f8f9fd] border-[#e0e3eb] text-[#434651]'
                          : 'bg-[#1e222d] border-[#2a2e39] text-gray-300'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="text-xs bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-2.5 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>
                  <strong>Everything is Free on Chart Flow:</strong> Switch between Gold, Indices,
                  and Forex pairs with full Bar Replay, Strategy Testing, and Analytics.
                </span>
              </div>

              <div className="max-h-80 overflow-y-auto space-y-1.5 pr-1 custom-scrollbar">
                {filteredInstruments.map((inst) => {
                  const isActive = inst.symbol === symbol;
                  return (
                    <div
                      key={inst.symbol}
                      onClick={() => {
                        onSelectSymbol(inst.symbol);
                        setIsSymbolModalOpen(false);
                      }}
                      className={`flex items-center justify-between p-2.5 rounded-lg border cursor-pointer transition ${
                        isActive
                          ? 'bg-[#2962ff]/15 border-[#2962ff]'
                          : isLight
                          ? 'bg-[#f8f9fd] hover:bg-[#f0f3fa] border-[#e0e3eb]'
                          : 'bg-[#1e222d]/70 hover:bg-[#262b38] border-[#2a2e39]'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="w-9 h-7 rounded bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-[10px] font-mono font-bold text-[#2962ff]">
                          {inst.icon}
                        </span>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs">{inst.displaySymbol}</span>
                            {isActive ? (
                              <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-mono font-bold">
                                ACTIVE
                              </span>
                            ) : (
                              <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-400 font-mono">
                                FREE REPLAY
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] opacity-75">
                            {inst.name} · {inst.exchange}
                          </span>
                        </div>
                      </div>
                      <div className="text-right font-mono">
                        <div className="text-xs font-bold">
                          {isActive
                            ? currentPrice.toFixed(inst.decimals)
                            : inst.basePrice.toFixed(inst.decimals)}
                        </div>
                        <div className="text-[10px] text-emerald-400 flex items-center gap-1 justify-end">
                          <Radio className="w-2.5 h-2.5" /> 1m – 1D Free
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
