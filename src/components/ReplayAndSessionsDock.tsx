import React, { useEffect, useState } from 'react';
import {
  BacktestPosition,
  Candle,
  DrawingTool,
  SessionBox,
  SessionConfig,
  SessionId,
  Timeframe,
} from '../types/trading';
import { getActiveSessionsAtTime } from '../services/goldDataService';
import {
  ChevronDown,
  ChevronUp,
  Clock,
  FastForward,
  Globe,
  History,
  Pause,
  Play,
  Radio,
  Rewind,
  Scissors,
  SkipBack,
  SkipForward,
  TrendingDown,
  TrendingUp,
  XCircle,
} from 'lucide-react';

interface ReplayAndSessionsDockProps {
  candles: Candle[];
  allCandlesCount: number;
  replayIndex: number;
  isReplayMode: boolean;
  isPlaying: boolean;
  playbackSpeedMs: number;
  onSetPlaybackSpeedMs: (ms: number) => void;
  onTogglePlay: () => void;
  onStepBar: (delta: number) => void;
  onScrubToIndex: (index: number) => void;
  onJumpToLive: () => void;
  activeTool: DrawingTool;
  onSetActiveTool: (tool: DrawingTool) => void;
  sessions: SessionConfig[];
  onToggleSessionEnabled: (id: SessionId) => void;
  sessionBoxes: SessionBox[];
  onFocusSessionTime: (timestamp: number) => void;
  positions: BacktestPosition[];
  onOpenMarketOrder: (
    side: 'LONG' | 'SHORT',
    lotSize: number,
    stopLossPrice: number,
    takeProfitPrice: number
  ) => void;
  onClosePosition: (id: string) => void;
  onResetBacktestAccount: () => void;
  realizedPnL: number;
  atr14: number;
  timeframe: Timeframe;
}

export const ReplayAndSessionsDock: React.FC<ReplayAndSessionsDockProps> = ({
  candles,
  allCandlesCount,
  replayIndex,
  isReplayMode,
  isPlaying,
  playbackSpeedMs,
  onSetPlaybackSpeedMs,
  onTogglePlay,
  onStepBar,
  onScrubToIndex,
  onJumpToLive,
  activeTool,
  onSetActiveTool,
  sessions,
  onToggleSessionEnabled,
  sessionBoxes,
  onFocusSessionTime,
  positions,
  onOpenMarketOrder,
  onClosePosition,
  onResetBacktestAccount,
  realizedPnL,
  atr14,
  timeframe,
}) => {
  const [dockTab, setDockTab] = useState<'sessions' | 'backtest'>('backtest');
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Order Ticket State: Lot Size (1.00 Lot = 100 oz), SL ($ distance), TP ($ distance), or Exact Prices
  const [lotSize, setLotSize] = useState<number>(1.0);
  const [slDistance, setSlDistance] = useState<number>(6.0);
  const [tpDistance, setTpDistance] = useState<number>(15.0);
  const [useExactPrices, setUseExactPrices] = useState<boolean>(false);
  const [customSlPrice, setCustomSlPrice] = useState<string>('');
  const [customTpPrice, setCustomTpPrice] = useState<string>('');

  const lastCandle = candles[candles.length - 1];
  const currentPrice = lastCandle?.close ?? 4140;
  const currentTimestamp = lastCandle?.time ?? Math.floor(Date.now() / 1000);

  // Sync default exact prices when switching to exact mode
  useEffect(() => {
    if (useExactPrices && !customSlPrice && !customTpPrice) {
      setCustomSlPrice((currentPrice - slDistance).toFixed(2));
      setCustomTpPrice((currentPrice + tpDistance).toFixed(2));
    }
  }, [useExactPrices, currentPrice, slDistance, tpDistance, customSlPrice, customTpPrice]);

  const { active: activeSessions, isLondonNYOverlap } = getActiveSessionsAtTime(
    currentTimestamp,
    sessions
  );
  const activeSessionIds = new Set(activeSessions.map((s) => s.id));

  const openPositions = positions.filter((p) => p.status === 'OPEN');
  const closedPositions = positions.filter((p) => p.status !== 'OPEN');
  const unrealizedPnL = openPositions.reduce((sum, p) => sum + p.pnl, 0);
  const totalEquity = 100000 + realizedPnL + unrealizedPnL;
  const winningTrades = closedPositions.filter((p) => p.pnl > 0).length;
  const winRate =
    closedPositions.length > 0
      ? Math.round((winningTrades / closedPositions.length) * 100)
      : 0;

  // Calculate projected Risk & Profit in USD (1.00 Lot = 100 oz)
  const sizeOz = Math.max(1, lotSize * 100);
  const effectiveSlDist = useExactPrices
    ? Math.max(0.5, Math.abs(currentPrice - (parseFloat(customSlPrice) || currentPrice - slDistance)))
    : Math.max(0.5, slDistance);
  const effectiveTpDist = useExactPrices
    ? Math.max(0.5, Math.abs((parseFloat(customTpPrice) || currentPrice + tpDistance) - currentPrice))
    : Math.max(0.5, tpDistance);

  const projectedRiskUsd = Number((effectiveSlDist * sizeOz).toFixed(2));
  const projectedProfitUsd = Number((effectiveTpDist * sizeOz).toFixed(2));
  const projectedRR = Number((effectiveTpDist / Math.max(0.1, effectiveSlDist)).toFixed(2));

  const handleExecuteOrder = (side: 'LONG' | 'SHORT') => {
    let slPrice: number;
    let tpPrice: number;

    if (useExactPrices) {
      const parsedSl = parseFloat(customSlPrice);
      const parsedTp = parseFloat(customTpPrice);
      if (side === 'LONG') {
        slPrice =
          !isNaN(parsedSl) && parsedSl < currentPrice
            ? parsedSl
            : Number((currentPrice - slDistance).toFixed(2));
        tpPrice =
          !isNaN(parsedTp) && parsedTp > currentPrice
            ? parsedTp
            : Number((currentPrice + tpDistance).toFixed(2));
      } else {
        slPrice =
          !isNaN(parsedSl) && parsedSl > currentPrice
            ? parsedSl
            : Number((currentPrice + slDistance).toFixed(2));
        tpPrice =
          !isNaN(parsedTp) && parsedTp < currentPrice
            ? parsedTp
            : Number((currentPrice - tpDistance).toFixed(2));
      }
    } else {
      slPrice =
        side === 'LONG'
          ? Number((currentPrice - slDistance).toFixed(2))
          : Number((currentPrice + slDistance).toFixed(2));
      tpPrice =
        side === 'LONG'
          ? Number((currentPrice + tpDistance).toFixed(2))
          : Number((currentPrice - tpDistance).toFixed(2));
    }

    onOpenMarketOrder(side, lotSize, slPrice, tpPrice);
    setDockTab('backtest');
  };

  const formattedBarTime = new Date(currentTimestamp * 1000)
    .toISOString()
    .replace('T', ' ')
    .slice(0, 16);

  return (
    <div className="w-full bg-[#131722] border-t border-[#2a2e39] flex flex-col select-none shrink-0 z-20">
      {/* Row 1: Bar Replay Transport & Interactive Lot / SL / TP Order Execution Bar */}
      <div className="px-3 py-2 bg-[#171b26] border-b border-[#2a2e39] flex flex-wrap items-center justify-between gap-2">
        {/* Left: Rewind / Bar Replay Controls */}
        <div className="flex flex-wrap items-center gap-1.5">
          {/* Cut / Select Bar Tool */}
          <button
            onClick={() =>
              onSetActiveTool(activeTool === 'replay_cut' ? 'cursor' : 'replay_cut')
            }
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-bold border transition ${
              activeTool === 'replay_cut'
                ? 'bg-amber-500 text-[#0b0e14] border-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.5)]'
                : 'bg-[#1e222d] hover:bg-[#262b38] text-amber-400 border-amber-500/40'
            }`}
            title="Click any bar on the chart to rewind time to that candle"
          >
            <Scissors className="w-3.5 h-3.5" />
            <span>Rewind to Bar</span>
          </button>

          {/* Step Back 25 */}
          <button
            onClick={() => onStepBar(-25)}
            className="p-1.5 rounded bg-[#1e222d] hover:bg-[#262b38] border border-[#2a2e39] text-gray-300 hover:text-white transition"
            title="Rewind 25 Candles"
          >
            <Rewind className="w-3.5 h-3.5" />
          </button>

          {/* Step Back 1 */}
          <button
            onClick={() => onStepBar(-1)}
            className="p-1.5 rounded bg-[#1e222d] hover:bg-[#262b38] border border-[#2a2e39] text-gray-300 hover:text-white transition"
            title="Rewind 1 Candle"
          >
            <SkipBack className="w-3.5 h-3.5" />
          </button>

          {/* Play / Pause Replay */}
          <button
            onClick={onTogglePlay}
            className={`flex items-center gap-1 px-3 py-1.5 rounded text-xs font-bold border transition ${
              isPlaying
                ? 'bg-amber-500 text-[#0b0e14] border-amber-400'
                : 'bg-[#2962ff] hover:bg-[#1e53e5] text-white border-blue-500'
            }`}
            title={isPlaying ? 'Pause Replay' : 'Play Bar-by-Bar Replay'}
          >
            {isPlaying ? (
              <>
                <Pause className="w-3.5 h-3.5 fill-current" />
                <span>Pause</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>{isReplayMode ? 'Play' : 'Rewind & Play'}</span>
              </>
            )}
          </button>

          {/* Step Forward 1 */}
          <button
            onClick={() => onStepBar(1)}
            disabled={!isReplayMode}
            className={`flex items-center gap-1 px-2 py-1.5 rounded text-xs font-semibold border transition ${
              isReplayMode
                ? 'bg-[#1e222d] hover:bg-[#262b38] border-[#2a2e39] text-white'
                : 'bg-[#131722] border-[#2a2e39]/50 text-[#787b86] cursor-not-allowed'
            }`}
            title="Step Forward 1 Candle"
          >
            <SkipForward className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">+1</span>
          </button>

          {/* Step Forward 10 */}
          <button
            onClick={() => onStepBar(10)}
            disabled={!isReplayMode}
            className={`p-1.5 rounded border transition ${
              isReplayMode
                ? 'bg-[#1e222d] hover:bg-[#262b38] border-[#2a2e39] text-gray-300'
                : 'bg-[#131722] border-[#2a2e39]/50 text-[#787b86] cursor-not-allowed'
            }`}
            title="Fast Forward 10 Candles"
          >
            <FastForward className="w-3.5 h-3.5" />
          </button>

          {/* Speed Selector */}
          <select
            value={playbackSpeedMs}
            onChange={(e) => onSetPlaybackSpeedMs(Number(e.target.value))}
            className="bg-[#1e222d] border border-[#2a2e39] rounded px-2 py-1 text-xs font-mono text-gray-200 outline-none"
            title="Replay Speed"
          >
            <option value={1200}>0.5x</option>
            <option value={650}>1x</option>
            <option value={320}>2x</option>
            <option value={140}>5x</option>
            <option value={60}>10x</option>
          </select>

          {/* Timeline Scrubber */}
          <div className="hidden 2xl:flex items-center gap-2 pl-2 border-l border-[#2a2e39]">
            <input
              type="range"
              min={50}
              max={Math.max(50, allCandlesCount - 1)}
              value={replayIndex}
              onChange={(e) => onScrubToIndex(Number(e.target.value))}
              className="w-28 accent-amber-400 cursor-pointer h-1.5 bg-[#2a2e39] rounded-lg"
            />
            <span className="text-[11px] font-mono text-amber-300">
              {formattedBarTime}
            </span>
          </div>

          {isReplayMode && (
            <button
              onClick={onJumpToLive}
              className="flex items-center gap-1 px-2.5 py-1 rounded bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 text-emerald-300 text-xs font-semibold transition"
              title="Exit Replay and Return to Live Real-Time Candle"
            >
              <Radio className="w-3 h-3 animate-pulse" />
              Live
            </button>
          )}
        </div>

        {/* Right: Complete Lot Size + SL + TP Order Ticket */}
        <div className="flex flex-wrap items-center gap-1.5">
          {/* Lot Size Input */}
          <div className="flex items-center gap-1 bg-[#131722] px-2 py-1 rounded border border-[#2a2e39] font-mono text-xs">
            <span className="text-[10px] text-[#787b86]">LOT:</span>
            <input
              type="number"
              step="0.05"
              min="0.01"
              max="100"
              value={lotSize}
              onChange={(e) => setLotSize(Math.max(0.01, parseFloat(e.target.value) || 0.01))}
              className="w-14 bg-[#1e222d] text-amber-300 font-bold px-1.5 py-0.5 rounded border border-[#2a2e39] focus:border-amber-400 outline-none text-center"
              title="Standard Gold Lot Size (1.00 Lot = 100 oz = $100 per $1 move)"
            />
          </div>

          {/* Toggle Distance ($) vs Exact Price */}
          <button
            onClick={() => {
              if (!useExactPrices) {
                setCustomSlPrice((currentPrice - slDistance).toFixed(2));
                setCustomTpPrice((currentPrice + tpDistance).toFixed(2));
              }
              setUseExactPrices((v) => !v);
            }}
            className="px-2 py-1 rounded bg-[#1e222d] hover:bg-[#262b38] border border-[#2a2e39] text-[10px] font-mono text-amber-300 transition"
            title="Switch between setting SL/TP by Dollar Distance ($) or Exact Price ($4,1xx.xx)"
          >
            {useExactPrices ? 'Mode: Exact $' : 'Mode: ±Offset $'}
          </button>

          {!useExactPrices ? (
            <>
              {/* Stop Loss Offset ($) */}
              <div className="flex items-center gap-1 bg-[#131722] px-2 py-1 rounded border border-[#f23645]/40 font-mono text-xs">
                <span className="text-[10px] text-[#f23645] font-bold">SL -$</span>
                <input
                  type="number"
                  step="0.5"
                  min="0.5"
                  value={slDistance}
                  onChange={(e) => setSlDistance(Math.max(0.5, parseFloat(e.target.value) || 1))}
                  className="w-14 bg-[#1e222d] text-[#f87171] font-bold px-1.5 py-0.5 rounded border border-[#2a2e39] outline-none text-center"
                  title="Stop Loss distance in $/oz from Entry Price"
                />
                <span className="text-[10px] text-rose-400/90 hidden sm:inline">
                  (-${projectedRiskUsd.toFixed(0)})
                </span>
              </div>

              {/* Take Profit Offset ($) */}
              <div className="flex items-center gap-1 bg-[#131722] px-2 py-1 rounded border border-[#089981]/40 font-mono text-xs">
                <span className="text-[10px] text-[#089981] font-bold">TP +$</span>
                <input
                  type="number"
                  step="0.5"
                  min="0.5"
                  value={tpDistance}
                  onChange={(e) => setTpDistance(Math.max(0.5, parseFloat(e.target.value) || 1))}
                  className="w-14 bg-[#1e222d] text-[#34d399] font-bold px-1.5 py-0.5 rounded border border-[#2a2e39] outline-none text-center"
                  title="Take Profit distance in $/oz from Entry Price"
                />
                <span className="text-[10px] text-emerald-400/90 hidden sm:inline">
                  (+${projectedProfitUsd.toFixed(0)} · {projectedRR}R)
                </span>
              </div>
            </>
          ) : (
            <>
              {/* Exact SL Price */}
              <div className="flex items-center gap-1 bg-[#131722] px-2 py-1 rounded border border-[#f23645]/40 font-mono text-xs">
                <span className="text-[10px] text-[#f23645] font-bold">SL @</span>
                <input
                  type="number"
                  step="0.5"
                  value={customSlPrice}
                  onChange={(e) => setCustomSlPrice(e.target.value)}
                  className="w-20 bg-[#1e222d] text-[#f87171] font-bold px-1.5 py-0.5 rounded border border-[#2a2e39] outline-none text-center"
                />
              </div>

              {/* Exact TP Price */}
              <div className="flex items-center gap-1 bg-[#131722] px-2 py-1 rounded border border-[#089981]/40 font-mono text-xs">
                <span className="text-[10px] text-[#089981] font-bold">TP @</span>
                <input
                  type="number"
                  step="0.5"
                  value={customTpPrice}
                  onChange={(e) => setCustomTpPrice(e.target.value)}
                  className="w-20 bg-[#1e222d] text-[#34d399] font-bold px-1.5 py-0.5 rounded border border-[#2a2e39] outline-none text-center"
                />
              </div>
            </>
          )}

          {/* BUY / LONG Button */}
          <button
            onClick={() => handleExecuteOrder('LONG')}
            className="flex items-center gap-1 px-3 py-1.5 rounded bg-[#089981] hover:bg-[#07856f] text-white font-bold text-xs shadow-md transition"
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Buy / Long</span>
          </button>

          {/* SELL / SHORT Button */}
          <button
            onClick={() => handleExecuteOrder('SHORT')}
            className="flex items-center gap-1 px-3 py-1.5 rounded bg-[#f23645] hover:bg-[#d92b3a] text-white font-bold text-xs shadow-md transition"
          >
            <TrendingDown className="w-3.5 h-3.5" />
            <span>Sell / Short</span>
          </button>
        </div>
      </div>

      {/* Row 2: Dock Sub-Header Tabs (Backtest Journal vs Trading Sessions) */}
      <div className="px-3 py-1.5 bg-[#131722] border-b border-[#2a2e39] flex items-center justify-between text-xs">
        <div className="flex items-center gap-4">
          <button
            onClick={() => {
              setDockTab('backtest');
              setIsCollapsed(false);
            }}
            className={`flex items-center gap-1.5 py-1 font-semibold border-b-2 transition ${
              dockTab === 'backtest' && !isCollapsed
                ? 'border-amber-400 text-amber-400'
                : 'border-transparent text-[#787b86] hover:text-gray-200'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>
              Backtest Positions & P&L ({openPositions.length} Open · {closedPositions.length}{' '}
              Settled)
            </span>
            <span
              className={`font-mono text-[11px] px-1.5 py-0.2 rounded font-bold ${
                realizedPnL + unrealizedPnL >= 0
                  ? 'bg-[#089981]/20 text-[#089981]'
                  : 'bg-[#f23645]/20 text-[#f23645]'
              }`}
            >
              Total P&L: {realizedPnL + unrealizedPnL >= 0 ? '+' : ''}$
              {(realizedPnL + unrealizedPnL).toFixed(2)}
            </span>
          </button>

          <button
            onClick={() => {
              setDockTab('sessions');
              setIsCollapsed(false);
            }}
            className={`flex items-center gap-1.5 py-1 font-semibold border-b-2 transition ${
              dockTab === 'sessions' && !isCollapsed
                ? 'border-amber-400 text-amber-400'
                : 'border-transparent text-[#787b86] hover:text-gray-200'
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            <span>Global Trading Sessions (Australia · Asia · London · New York)</span>
            {isLondonNYOverlap && (
              <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 text-[10px] font-mono">
                OVERLAP LIVE
              </span>
            )}
          </button>
        </div>

        <button
          onClick={() => setIsCollapsed((v) => !v)}
          className="flex items-center gap-1 text-[11px] text-[#787b86] hover:text-white transition"
        >
          {isCollapsed ? (
            <>
              <span>Expand Panel</span>
              <ChevronUp className="w-3.5 h-3.5" />
            </>
          ) : (
            <>
              <span>Minimize</span>
              <ChevronDown className="w-3.5 h-3.5" />
            </>
          )}
        </button>
      </div>

      {/* Row 3: Collapsible Body */}
      {!isCollapsed && (
        <div className="p-3 bg-[#0f131d] max-h-[195px] overflow-y-auto custom-scrollbar">
          {dockTab === 'backtest' ? (
            <div className="space-y-2.5">
              {/* Account Summary Metrics */}
              <div className="flex flex-wrap items-center justify-between gap-2 bg-[#131722] p-2.5 rounded-lg border border-[#2a2e39] font-mono text-xs">
                <div className="flex flex-wrap items-center gap-5">
                  <div>
                    <span className="text-[10px] text-[#787b86] block">ACCOUNT EQUITY</span>
                    <span className="text-white font-bold text-sm">
                      $
                      {totalEquity.toLocaleString('en-US', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-[#787b86] block">OPEN FLOATING P&L</span>
                    <span
                      className={`font-bold text-sm ${
                        unrealizedPnL >= 0 ? 'text-[#089981]' : 'text-[#f23645]'
                      }`}
                    >
                      {unrealizedPnL >= 0 ? '+' : ''}${unrealizedPnL.toFixed(2)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-[#787b86] block">BANKED / REALIZED P&L</span>
                    <span
                      className={`font-bold text-sm ${
                        realizedPnL >= 0 ? 'text-[#089981]' : 'text-[#f23645]'
                      }`}
                    >
                      {realizedPnL >= 0 ? '+' : ''}${realizedPnL.toFixed(2)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-[#787b86] block">WIN RATE</span>
                    <span className="text-amber-400 font-bold text-sm">
                      {winRate}% ({winningTrades}W / {closedPositions.length - winningTrades}L)
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {/* Quick R:R Presets */}
                  <div className="hidden lg:flex items-center gap-1 text-[10px]">
                    <span className="text-[#787b86] mr-1">Quick R:R:</span>
                    {[1, 2, 3, 5].map((rr) => (
                      <button
                        key={rr}
                        onClick={() => {
                          setUseExactPrices(false);
                          setTpDistance(Number((slDistance * rr).toFixed(2)));
                        }}
                        className="px-2 py-0.5 rounded bg-[#1e222d] hover:bg-[#262b38] border border-[#2a2e39] text-amber-300"
                      >
                        1:{rr}
                      </button>
                    ))}
                  </div>

                  <button
                    onClick={onResetBacktestAccount}
                    className="px-2.5 py-1 rounded bg-[#1e222d] hover:bg-[#262b38] border border-[#2a2e39] text-[11px] text-gray-300 transition"
                  >
                    Reset $100k Account
                  </button>
                </div>
              </div>

              {/* Positions Table */}
              {positions.length === 0 ? (
                <div className="text-center py-3.5 text-xs text-[#787b86]">
                  Set your <strong className="text-amber-300">Lot Size</strong>,{' '}
                  <strong className="text-[#f23645]">Stop Loss (SL)</strong>, and{' '}
                  <strong className="text-[#089981]">Take Profit (TP)</strong> above, click{' '}
                  <strong className="text-[#089981]">Buy / Long</strong> or{' '}
                  <strong className="text-[#f23645]">Sell / Short</strong>, then press{' '}
                  <strong className="text-blue-400">Play</strong> to watch the candles play out and
                  see if it hits your TP or SL!
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left font-mono text-xs border-collapse">
                    <thead>
                      <tr className="text-[10px] text-[#787b86] border-b border-[#2a2e39]">
                        <th className="py-1.5 px-2">SIDE</th>
                        <th className="py-1.5 px-2">LOT SIZE</th>
                        <th className="py-1.5 px-2">ENTRY PRICE</th>
                        <th className="py-1.5 px-2">STOP LOSS (RISK)</th>
                        <th className="py-1.5 px-2">TAKE PROFIT (TARGET)</th>
                        <th className="py-1.5 px-2">OUTCOME / STATUS</th>
                        <th className="py-1.5 px-2">AMOUNT MADE / LOST</th>
                        <th className="py-1.5 px-2 text-right">ACTION</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#2a2e39]/60">
                      {positions.map((pos) => (
                        <tr key={pos.id} className="hover:bg-[#1e222d]/60">
                          <td className="py-1.5 px-2">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                pos.side === 'LONG'
                                  ? 'bg-[#089981]/20 text-[#089981]'
                                  : 'bg-[#f23645]/20 text-[#f23645]'
                              }`}
                            >
                              {pos.side}
                            </span>
                          </td>
                          <td className="py-1.5 px-2 text-amber-300 font-bold">
                            {pos.lotSize.toFixed(2)} Lot ({pos.sizeOz}oz)
                          </td>
                          <td className="py-1.5 px-2 text-white">${pos.entryPrice.toFixed(2)}</td>
                          <td className="py-1.5 px-2 text-[#f23645]">
                            ${pos.stopLoss.toFixed(2)}{' '}
                            <span className="text-[10px] opacity-75">
                              (-${pos.riskDollars.toFixed(0)})
                            </span>
                          </td>
                          <td className="py-1.5 px-2 text-[#089981]">
                            ${pos.takeProfit.toFixed(2)}{' '}
                            <span className="text-[10px] opacity-75">
                              (+${pos.rewardDollars.toFixed(0)})
                            </span>
                          </td>
                          <td className="py-1.5 px-2">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                pos.status === 'OPEN'
                                  ? 'bg-blue-500/20 text-blue-300 animate-pulse'
                                  : pos.status === 'CLOSED_TP'
                                  ? 'bg-[#089981]/25 text-[#34d399] border border-[#089981]/50'
                                  : pos.status === 'CLOSED_SL'
                                  ? 'bg-[#f23645]/25 text-[#fb7185] border border-[#f23645]/50'
                                  : 'bg-gray-600/30 text-gray-300'
                              }`}
                            >
                              {pos.status === 'OPEN'
                                ? '● ACTIVE IN PLAY'
                                : pos.status === 'CLOSED_TP'
                                ? '🎯 HIT TAKE PROFIT!'
                                : pos.status === 'CLOSED_SL'
                                ? '🛡️ HIT STOP LOSS'
                                : 'CLOSED MANUAL'}
                            </span>
                          </td>
                          <td
                            className={`py-1.5 px-2 font-extrabold text-xs ${
                              pos.pnl >= 0 ? 'text-[#089981]' : 'text-[#f23645]'
                            }`}
                          >
                            {pos.pnl >= 0 ? `+$${pos.pnl.toFixed(2)}` : `-$${Math.abs(pos.pnl).toFixed(2)}`}{' '}
                            <span className="text-[10px] font-normal">
                              ({pos.rMultiple >= 0 ? '+' : ''}
                              {pos.rMultiple.toFixed(2)}R)
                            </span>
                          </td>
                          <td className="py-1.5 px-2 text-right">
                            {pos.status === 'OPEN' ? (
                              <button
                                onClick={() => onClosePosition(pos.id)}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 text-[10px] font-semibold transition"
                              >
                                <XCircle className="w-3 h-3" />
                                Close Trade
                              </button>
                            ) : (
                              <span className="text-[10px] text-[#787b86]">
                                Exit @ ${pos.exitPrice?.toFixed(2)}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
              {sessions.map((session) => {
                const isOpenNow = activeSessionIds.has(session.id);
                const latestBox = [...sessionBoxes]
                  .reverse()
                  .find((b) => b.session === session.id);

                return (
                  <div
                    key={session.id}
                    className={`rounded-lg p-2.5 border transition flex flex-col justify-between ${
                      isOpenNow
                        ? 'bg-[#1a2030] border-amber-500/50 shadow-[0_0_15px_rgba(245,158,11,0.08)]'
                        : 'bg-[#131722] border-[#2a2e39]'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-base">{session.flag}</span>
                          <div>
                            <div className="text-xs font-bold text-white flex items-center gap-1.5">
                              {session.name}
                            </div>
                            <div className="text-[10px] font-mono text-[#787b86] flex items-center gap-1">
                              <Clock className="w-2.5 h-2.5" />
                              {String(session.startHourUTC).padStart(2, '0')}:00 –{' '}
                              {String(session.endHourUTC).padStart(2, '0')}:00 UTC
                            </div>
                          </div>
                        </div>

                        <span
                          className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                            isOpenNow
                              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 animate-pulse'
                              : 'bg-gray-800/70 text-[#787b86] border-gray-700'
                          }`}
                        >
                          {isOpenNow ? '● ACTIVE' : 'CLOSED'}
                        </span>
                      </div>

                      {latestBox && timeframe !== '1D' ? (
                        <div className="grid grid-cols-3 gap-1 my-1.5 bg-[#0b0e14]/80 p-1.5 rounded border border-[#2a2e39] font-mono text-[10px]">
                          <div>
                            <span className="text-[#787b86] block">HIGH</span>
                            <span className="text-[#089981] font-semibold">
                              ${latestBox.high.toFixed(2)}
                            </span>
                          </div>
                          <div>
                            <span className="text-[#787b86] block">LOW</span>
                            <span className="text-[#f23645] font-semibold">
                              ${latestBox.low.toFixed(2)}
                            </span>
                          </div>
                          <div>
                            <span className="text-[#787b86] block">RANGE</span>
                            <span className="text-amber-300 font-semibold">
                              ${latestBox.rangeDollars.toFixed(2)}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <p className="text-[10px] text-gray-400 my-1.5 line-clamp-2">
                          {session.goldBehavior}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center justify-between gap-1.5 pt-1.5 border-t border-[#2a2e39]/80 text-[11px]">
                      <label className="flex items-center gap-1.5 cursor-pointer text-gray-300 hover:text-white">
                        <input
                          type="checkbox"
                          checked={session.enabled}
                          onChange={() => onToggleSessionEnabled(session.id)}
                          className="accent-amber-400 rounded cursor-pointer"
                        />
                        <span>Highlight Box</span>
                      </label>

                      {latestBox && (
                        <button
                          onClick={() => onFocusSessionTime(latestBox.startTime)}
                          className="px-2 py-0.5 rounded bg-[#1e222d] hover:bg-[#262b38] border border-[#2a2e39] text-amber-300 font-mono text-[10px] transition"
                        >
                          Focus Session →
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
