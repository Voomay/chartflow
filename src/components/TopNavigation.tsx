import React, { useState } from 'react';
import {
  BrainCircuit,
  CandlestickChart,
  ChevronDown,
  Clock,
  Columns,
  Lock,
  Maximize2,
  Minimize2,
  Moon,
  Radio,
  RefreshCw,
  Scissors,
  Search,
  Sparkles,
  Sun,
  X,
} from 'lucide-react';
import {
  CandleColorStyle,
  SessionConfig,
  SessionId,
  ThemeMode,
  Timeframe,
} from '../types/trading';
import { getActiveSessionsAtTime, TIMEFRAME_CONFIG } from '../services/goldDataService';

interface TopNavigationProps {
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
}

const TIMEFRAMES: Timeframe[] = ['1m', '5m', '15m', '30m', '1H', '4H', '1D'];

export const TopNavigation: React.FC<TopNavigationProps> = ({
  timeframe,
  onSelectTimeframe,
  currentPrice,
  dailyChange,
  dailyChangePct,
  displayHigh,
  displayLow,
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
}: TopNavigationProps & { displayHigh?: number; displayLow?: number }) => {
  const [isSymbolModalOpen, setIsSymbolModalOpen] = useState(false);

  const isLight = theme === 'light';
  const isUp = dailyChange >= 0;
  const { active: activeSessions } = getActiveSessionsAtTime(currentTimestamp, sessions);
  const activeIds = new Set(activeSessions.map((s) => s.id));

  const headerBg = isLight
    ? 'bg-white border-[#e0e3eb] text-[#131722]'
    : 'bg-[#131722] border-[#2a2e39] text-[#d1d4dc]';
  const cardBg = isLight
    ? 'bg-[#f8f9fd] hover:bg-[#f0f3fa] border-[#e0e3eb] text-[#131722]'
    : 'bg-[#1e222d] hover:bg-[#262b38] border-[#2a2e39] text-gray-200';
  const dividerBg = isLight ? 'bg-[#e0e3eb]' : 'bg-[#2a2e39]';

  return (
    <>
      <header
        className={`h-12 border-b px-3 flex items-center justify-between gap-2 select-none shrink-0 z-30 ${headerBg}`}
      >
        {/* Left: Brand + Instrument Selector + Timeframes */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
          {/* Logo Badge */}
          <div className={`flex items-center gap-1.5 pr-2 border-r ${isLight ? 'border-[#e0e3eb]' : 'border-[#2a2e39]'}`}>
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-[#0b0e14] font-black text-xs shadow">
              Au
            </div>
            <span className="hidden sm:inline font-extrabold text-xs tracking-tight">
              AURUM<span className="text-amber-500">VIEW</span>
            </span>
          </div>

          {/* Instrument Selector Button */}
          <button
            onClick={() => setIsSymbolModalOpen(true)}
            className={`flex items-center gap-2 px-2.5 py-1 rounded border transition ${cardBg}`}
            title="Switch / Inspect Instruments (Gold XAU/USD Focus)"
          >
            <span className="text-xs font-bold flex items-center gap-1.5">
              <span className="text-amber-500">🪙</span>
              XAUUSD
            </span>
            <span className="hidden md:inline text-[10px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-600 dark:text-amber-300 font-mono font-semibold">
              OANDA / SPOT
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
                    s.enabled
                      ? cardBg
                      : 'border-transparent opacity-50'
                  }`}
                  title={`${s.name} (${String(s.startHourUTC).padStart(2, '0')}:00–${String(
                    s.endHourUTC
                  ).padStart(2, '0')}:00 UTC)`}
                >
                  <span>{s.flag}</span>
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

        {/* Right: Theme Mode + Wide Chart Mode + Bar Replay + Fullscreen + Gold Indicator */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Bar Replay Cut Button */}
          <button
            onClick={onToggleReplayCutTool}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-bold border transition ${
              isReplayCutActive || isReplayMode
                ? 'bg-amber-500 text-[#0b0e14] border-amber-500'
                : cardBg
            }`}
            title="Bar Replay & Rewind Mode"
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
                <span className="hidden md:inline">Black Mode</span>
              </>
            ) : (
              <>
                <Sun className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden md:inline">White Mode</span>
              </>
            )}
          </button>

          {/* Wide Chart Only Mode (Hides Bottom & Side Panels so Chart fills entire screen) */}
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
            <span className="hidden md:inline">
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

          {/* Toggle Gold Intelligence Side Widget */}
          <button
            onClick={onToggleRightWidget}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-bold border transition ${
              showRightWidget && !isChartWideMode
                ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-[#0b0e14] border-amber-400 shadow'
                : cardBg
            }`}
            title="Toggle Gold Momentum, News & Sentiment Widget"
          >
            <BrainCircuit className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Gold AI</span>
          </button>
        </div>
      </header>

      {/* Instrument Selector Modal */}
      {isSymbolModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div
            className={`w-full max-w-lg border rounded-xl shadow-2xl overflow-hidden ${
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
                <Search className="w-4 h-4 text-amber-500" />
                <h3 className="text-sm font-bold">Instrument & Market Selector</h3>
              </div>
              <button
                onClick={() => setIsSymbolModalOpen(false)}
                className="p-1 rounded hover:bg-gray-500/20"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-3">
              <div className="text-xs bg-amber-500/15 border border-amber-500/30 rounded-lg p-2.5 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
                <span>
                  <strong>Gold Focus Mode Active:</strong> Dedicated to{' '}
                  <strong>XAU/USD (Gold Spot / US Dollar)</strong> with full multi-timeframe
                  backtesting, session boxes, and Gold News AI sentiment.
                </span>
              </div>

              <div className="space-y-1.5">
                <div
                  onClick={() => setIsSymbolModalOpen(false)}
                  className="flex items-center justify-between p-3 rounded-lg bg-amber-500/15 border border-amber-500/50 cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl">🪙</span>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm">XAU/USD</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-500 font-mono font-bold">
                          ACTIVE
                        </span>
                      </div>
                      <span className="text-xs opacity-75">
                        Gold Spot / U.S. Dollar · OANDA / COMEX
                      </span>
                    </div>
                  </div>
                  <div className="text-right font-mono">
                    <div className="text-sm font-bold">${currentPrice.toFixed(2)}</div>
                    <div className="text-[11px] text-amber-500 flex items-center gap-1 justify-end">
                      <Radio className="w-3 h-3" /> 1m – 1D Live
                    </div>
                  </div>
                </div>

                {[
                  {
                    symbol: 'DXY',
                    name: 'US Dollar Index (Macro Correlation Tracked)',
                    price: '103.42',
                    tag: 'TRACKED IN WIDGET',
                  },
                  {
                    symbol: 'US10Y',
                    name: 'US 10-Year Treasury Yield (Tracked in Gold AI)',
                    price: '4.08%',
                    tag: 'TRACKED IN WIDGET',
                  },
                  {
                    symbol: 'XAG/USD',
                    name: 'Silver Spot / US Dollar',
                    price: '$34.18',
                    tag: 'GOLD FOCUS ONLY',
                  },
                ].map((inst) => (
                  <div
                    key={inst.symbol}
                    className={`flex items-center justify-between p-2.5 rounded-lg border opacity-60 ${
                      isLight
                        ? 'bg-[#f8f9fd] border-[#e0e3eb]'
                        : 'bg-[#1e222d]/60 border-[#2a2e39]'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Lock className="w-4 h-4 opacity-60" />
                      <div>
                        <span className="font-bold text-xs">{inst.symbol}</span>
                        <span className="block text-[11px] opacity-70">{inst.name}</span>
                      </div>
                    </div>
                    <div className="text-right font-mono">
                      <span className="text-xs block">{inst.price}</span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-gray-500/20">
                        {inst.tag}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
