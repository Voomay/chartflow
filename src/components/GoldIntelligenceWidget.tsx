import React, { useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  BrainCircuit,
  CheckCircle2,
  Compass,
  Flame,
  Globe2,
  Newspaper,
  PlusCircle,
  ShieldAlert,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  Zap,
} from 'lucide-react';
import {
  GoldIndicatorReport,
  GoldNewsItem,
  InstrumentSymbol,
  MacroEnvironment,
} from '../types/trading';
import { getInstrumentConfig } from '../services/goldDataService';

interface GoldIntelligenceWidgetProps {
  symbol?: InstrumentSymbol;
  report: GoldIndicatorReport;
  currentPrice: number;
  newsItems: GoldNewsItem[];
  onAddCustomNews: (headline: string) => void;
  macro: MacroEnvironment;
  onSelectMacroPreset: (preset: 'BASELINE' | 'DOVISH_FED' | 'HAWKISH_CPI' | 'GEO_ESCALATION') => void;
  activeMacroPreset: 'BASELINE' | 'DOVISH_FED' | 'HAWKISH_CPI' | 'GEO_ESCALATION';
  onExecuteRecommendedTrade: (
    side: 'LONG' | 'SHORT',
    stopLoss: number,
    takeProfit: number
  ) => void;
  isReplayMode: boolean;
}

export const GoldIntelligenceWidget: React.FC<GoldIntelligenceWidgetProps> = ({
  symbol = 'XAUUSD',
  report,
  currentPrice,
  newsItems,
  onAddCustomNews,
  macro,
  onSelectMacroPreset,
  activeMacroPreset,
  onExecuteRecommendedTrade,
  isReplayMode,
}) => {
  const [activeTab, setActiveTab] = useState<'approach' | 'momentum' | 'news'>('approach');
  const [customHeadline, setCustomHeadline] = useState('');
  const instCfg = getInstrumentConfig(symbol);
  const dec = instCfg.decimals;

  const isBullish = report.overallScore >= 12;
  const isBearish = report.overallScore <= -12;

  // Map score (-100..+100) to percentage (0..100%)
  const gaugePercent = Math.max(2, Math.min(98, Math.round((report.overallScore + 100) / 2)));

  const handleNewsSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customHeadline.trim()) return;
    onAddCustomNews(customHeadline);
    setCustomHeadline('');
  };

  return (
    <aside className="w-full lg:w-[370px] xl:w-[400px] h-full bg-[#131722] border-l border-[#2a2e39] flex flex-col shrink-0 select-none overflow-hidden">
      {/* Widget Header */}
      <div className="px-3.5 py-2.5 border-b border-[#2a2e39] bg-gradient-to-r from-[#131722] via-[#1c2230] to-[#131722] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-amber-500/15 border border-amber-500/40 flex items-center justify-center text-amber-400 shadow-inner">
            <BrainCircuit className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h2 className="text-xs font-bold tracking-wide text-white uppercase">
                Chart Flow AI Engine
              </h2>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-mono font-semibold">
                FREE
              </span>
            </div>
            <p className="text-[10px] text-[#787b86]">
              {isReplayMode
                ? 'Synced to Historical Replay Candle'
                : 'Free Real-Time Momentum, News & Sentiment'}
            </p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-[10px] text-[#787b86] font-mono">CONFIDENCE</div>
          <div className="text-xs font-bold font-mono text-amber-400">
            {report.confidencePct}%
          </div>
        </div>
      </div>

      {/* Master Bullish / Bearish Sentiment Gauge Card */}
      <div className="p-3.5 border-b border-[#2a2e39] bg-[#171b26]">
        <div className="flex items-center justify-between mb-2">
          <div>
            <span className="text-[10px] uppercase tracking-wider text-[#787b86] font-semibold block">
              Composite Gold Sentiment
            </span>
            <div className="flex items-center gap-2 mt-0.5">
              {isBullish ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-extrabold bg-[#089981]/20 text-[#089981] border border-[#089981]/40">
                  <TrendingUp className="w-3.5 h-3.5" />
                  {report.verdict}
                </span>
              ) : isBearish ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-extrabold bg-[#f23645]/20 text-[#f23645] border border-[#f23645]/40">
                  <TrendingDown className="w-3.5 h-3.5" />
                  {report.verdict}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-extrabold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                  <Activity className="w-3.5 h-3.5" />
                  {report.verdict}
                </span>
              )}
            </div>
          </div>

          <div className="text-right font-mono">
            <span className="text-[10px] text-[#787b86] block">INDEX SCORE</span>
            <span
              className={`text-lg font-extrabold ${
                isBullish
                  ? 'text-[#089981]'
                  : isBearish
                  ? 'text-[#f23645]'
                  : 'text-amber-400'
              }`}
            >
              {report.overallScore > 0 ? `+${report.overallScore}` : report.overallScore}
              <span className="text-xs text-[#787b86] font-normal"> / 100</span>
            </span>
          </div>
        </div>

        {/* Gradient Sentiment Bar */}
        <div className="relative h-2.5 w-full rounded-full bg-gradient-to-r from-[#f23645] via-amber-400 to-[#089981] p-0.5 shadow-inner my-2">
          <div
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-white border-2 border-[#0b0e14] shadow-[0_0_10px_rgba(255,255,255,0.9)] transition-all duration-300"
            style={{ left: `${gaugePercent}%` }}
          />
        </div>
        <div className="flex justify-between text-[10px] font-mono text-[#787b86] mb-2.5">
          <span className="text-[#f23645]">STRONG BEAR (-100)</span>
          <span>NEUTRAL (0)</span>
          <span className="text-[#089981]">STRONG BULL (+100)</span>
        </div>

        {/* 4 Factor Sub-Scores */}
        <div className="grid grid-cols-4 gap-1.5 pt-1 border-t border-[#2a2e39]/80 text-center">
          <div className="bg-[#1e222d] px-1.5 py-1 rounded border border-[#2a2e39]">
            <div className="text-[9px] text-[#787b86] uppercase">Trend</div>
            <div
              className={`text-[11px] font-mono font-bold ${
                report.technicalScore >= 0 ? 'text-[#089981]' : 'text-[#f23645]'
              }`}
            >
              {report.technicalScore > 0 ? `+${report.technicalScore}` : report.technicalScore}
            </div>
          </div>
          <div className="bg-[#1e222d] px-1.5 py-1 rounded border border-[#2a2e39]">
            <div className="text-[9px] text-[#787b86] uppercase">Momentum</div>
            <div
              className={`text-[11px] font-mono font-bold ${
                report.momentumScore >= 0 ? 'text-[#089981]' : 'text-[#f23645]'
              }`}
            >
              {report.momentumScore > 0 ? `+${report.momentumScore}` : report.momentumScore}
            </div>
          </div>
          <div className="bg-[#1e222d] px-1.5 py-1 rounded border border-[#2a2e39]">
            <div className="text-[9px] text-[#787b86] uppercase">News/Macro</div>
            <div
              className={`text-[11px] font-mono font-bold ${
                report.newsScore >= 0 ? 'text-[#089981]' : 'text-[#f23645]'
              }`}
            >
              {report.newsScore > 0 ? `+${report.newsScore}` : report.newsScore}
            </div>
          </div>
          <div className="bg-[#1e222d] px-1.5 py-1 rounded border border-[#2a2e39]">
            <div className="text-[9px] text-[#787b86] uppercase">Session</div>
            <div
              className={`text-[11px] font-mono font-bold ${
                report.sessionScore >= 0 ? 'text-[#089981]' : 'text-[#f23645]'
              }`}
            >
              {report.sessionScore > 0 ? `+${report.sessionScore}` : report.sessionScore}
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="grid grid-cols-3 border-b border-[#2a2e39] bg-[#131722] text-xs font-semibold">
        <button
          onClick={() => setActiveTab('approach')}
          className={`flex items-center justify-center gap-1.5 py-2.5 border-b-2 transition ${
            activeTab === 'approach'
              ? 'border-amber-400 text-amber-400 bg-amber-500/5'
              : 'border-transparent text-[#787b86] hover:text-gray-300'
          }`}
        >
          <Compass className="w-3.5 h-3.5" />
          Best Approach
        </button>
        <button
          onClick={() => setActiveTab('momentum')}
          className={`flex items-center justify-center gap-1.5 py-2.5 border-b-2 transition ${
            activeTab === 'momentum'
              ? 'border-amber-400 text-amber-400 bg-amber-500/5'
              : 'border-transparent text-[#787b86] hover:text-gray-300'
          }`}
        >
          <BarChart3 className="w-3.5 h-3.5" />
          Momentum
        </button>
        <button
          onClick={() => setActiveTab('news')}
          className={`flex items-center justify-center gap-1.5 py-2.5 border-b-2 transition ${
            activeTab === 'news'
              ? 'border-amber-400 text-amber-400 bg-amber-500/5'
              : 'border-transparent text-[#787b86] hover:text-gray-300'
          }`}
        >
          <Newspaper className="w-3.5 h-3.5" />
          Gold News ({newsItems.length})
        </button>
      </div>

      {/* Scrollable Tab Body */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-3.5 custom-scrollbar">
        {activeTab === 'approach' && (
          <>
            {/* Recommended Approach Verdict Card */}
            <div
              className={`rounded-lg p-3 border ${
                report.bestApproach.bias === 'BULLISH'
                  ? 'bg-[#089981]/10 border-[#089981]/40'
                  : report.bestApproach.bias === 'BEARISH'
                  ? 'bg-[#f23645]/10 border-[#f23645]/40'
                  : 'bg-amber-500/10 border-amber-500/40'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded bg-black/40 text-amber-300 font-semibold">
                  {report.bestApproach.strategyName}
                </span>
                <span className="text-xs font-mono font-bold text-white">
                  R:R 1 : {report.bestApproach.riskReward}
                </span>
              </div>

              <h3 className="text-xs sm:text-sm font-bold text-white leading-snug mb-2.5">
                {report.bestApproach.headline}
              </h3>

              {/* Trade Setup Parameters Grid */}
              <div className="grid grid-cols-2 gap-2 font-mono text-xs mb-3">
                <div className="bg-[#131722]/90 p-2 rounded border border-[#2a2e39]">
                  <span className="text-[10px] text-[#787b86] block">IDEAL ENTRY ZONE</span>
                  <span className="text-white font-semibold">
                    {report.bestApproach.entryZone[0].toFixed(dec)} –{' '}
                    {report.bestApproach.entryZone[1].toFixed(dec)}
                  </span>
                </div>
                <div className="bg-[#131722]/90 p-2 rounded border border-[#f23645]/30">
                  <span className="text-[10px] text-[#f23645] block">INVALIDATION (SL)</span>
                  <span className="text-[#f23645] font-bold">
                    {report.bestApproach.stopLoss.toFixed(dec)}
                  </span>
                </div>
                <div className="bg-[#131722]/90 p-2 rounded border border-[#089981]/30">
                  <span className="text-[10px] text-[#089981] block">TARGET 1 (1.5R)</span>
                  <span className="text-[#089981] font-bold">
                    {report.bestApproach.target1.toFixed(dec)}
                  </span>
                </div>
                <div className="bg-[#131722]/90 p-2 rounded border border-[#089981]/50">
                  <span className="text-[10px] text-emerald-300 block">TARGET 2 (RUNNER)</span>
                  <span className="text-emerald-300 font-bold">
                    {report.bestApproach.target2.toFixed(dec)}
                  </span>
                </div>
              </div>

              {/* Execute Recommended Setup Button */}
              <button
                onClick={() =>
                  onExecuteRecommendedTrade(
                    report.bestApproach.bias === 'BEARISH' ? 'SHORT' : 'LONG',
                    report.bestApproach.stopLoss,
                    report.bestApproach.target1
                  )
                }
                className={`w-full py-2 px-3 rounded-md font-bold text-xs flex items-center justify-center gap-1.5 shadow-md transition ${
                  report.bestApproach.bias === 'BEARISH'
                    ? 'bg-[#f23645] hover:bg-[#e12d3c] text-white'
                    : 'bg-[#089981] hover:bg-[#07856f] text-white'
                }`}
              >
                <Zap className="w-3.5 h-3.5" />
                Deploy {report.bestApproach.bias === 'BEARISH' ? 'SHORT' : 'LONG'} Setup on Chart (@{' '}
                {currentPrice.toFixed(dec)})
              </button>
            </div>

            {/* Session Liquidity Context */}
            <div className="bg-[#1e222d] border border-[#2a2e39] rounded-lg p-3">
              <div className="flex items-center gap-1.5 text-xs font-bold text-amber-400 mb-1">
                <Globe2 className="w-3.5 h-3.5" />
                Active Session Liquidity Note
              </div>
              <p className="text-xs text-gray-300 leading-relaxed">
                {report.bestApproach.sessionNote}
              </p>
            </div>

            {/* Quantitative Rationale Checklist */}
            <div className="bg-[#1e222d] border border-[#2a2e39] rounded-lg p-3 space-y-2">
              <div className="text-xs font-bold text-white flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                Why This Approach? (Confluence Factors)
              </div>
              <ul className="space-y-2">
                {report.bestApproach.rationale.map((item, index) => (
                  <li key={index} className="flex items-start gap-2 text-xs text-gray-300 leading-relaxed">
                    <CheckCircle2 className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Quick Key Levels Matrix */}
            <div className="bg-[#1e222d] border border-[#2a2e39] rounded-lg p-3">
              <div className="text-xs font-bold text-white mb-2 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Target className="w-3.5 h-3.5 text-amber-400" />
                  Institutional Orderblock & S/R Levels
                </span>
                <span className="text-[10px] font-mono text-[#787b86]">
                  ATR(14): {report.atr14.toFixed(dec)}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 font-mono text-xs">
                <div className="space-y-1">
                  <div className="text-[10px] text-[#f23645] uppercase font-semibold">
                    Supply / Resistance
                  </div>
                  {report.keyResistance.map((r, i) => (
                    <div
                      key={i}
                      className="flex justify-between bg-[#131722] px-2 py-1 rounded border border-[#f23645]/25"
                    >
                      <span className="text-[#787b86]">R{i + 1}</span>
                      <span className="text-[#f87171] font-semibold">{r.toFixed(dec)}</span>
                    </div>
                  ))}
                </div>
                <div className="space-y-1">
                  <div className="text-[10px] text-[#089981] uppercase font-semibold">
                    Demand / Support
                  </div>
                  {report.keySupport.map((s, i) => (
                    <div
                      key={i}
                      className="flex justify-between bg-[#131722] px-2 py-1 rounded border border-[#089981]/25"
                    >
                      <span className="text-[#787b86]">S{i + 1}</span>
                      <span className="text-[#34d399] font-semibold">{s.toFixed(dec)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}

        {activeTab === 'momentum' && (
          <>
            {/* Market Structure & EMA Alignment */}
            <div className="bg-[#1e222d] border border-[#2a2e39] rounded-lg p-3 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white">Trend & EMA Structure</span>
                <span
                  className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                    report.emaAlignment === 'BULLISH STACK'
                      ? 'bg-[#089981]/20 text-[#089981]'
                      : report.emaAlignment === 'BEARISH STACK'
                      ? 'bg-[#f23645]/20 text-[#f23645]'
                      : 'bg-amber-500/20 text-amber-300'
                  }`}
                >
                  {report.emaAlignment}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 font-mono text-xs">
                <div className="bg-[#131722] p-2 rounded border border-[#2a2e39] flex justify-between">
                  <span className="text-cyan-400">EMA 20</span>
                  <span className="text-white">{report.ema20.toFixed(dec)}</span>
                </div>
                <div className="bg-[#131722] p-2 rounded border border-[#2a2e39] flex justify-between">
                  <span className="text-amber-400">EMA 50</span>
                  <span className="text-white">{report.ema50.toFixed(dec)}</span>
                </div>
                <div className="bg-[#131722] p-2 rounded border border-[#2a2e39] flex justify-between">
                  <span className="text-purple-400">EMA 200</span>
                  <span className="text-white">{report.ema200.toFixed(dec)}</span>
                </div>
                <div className="bg-[#131722] p-2 rounded border border-[#2a2e39] flex justify-between">
                  <span className="text-blue-400">VWAP</span>
                  <span className="text-white">{report.vwap.toFixed(dec)}</span>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs pt-1 border-t border-[#2a2e39]">
                <span className="text-[#787b86]">Price Structure</span>
                <span className="font-mono font-semibold text-amber-300 text-[11px]">
                  {report.marketStructure}
                </span>
              </div>
            </div>

            {/* RSI (14) & Stochastic Oscillator */}
            <div className="bg-[#1e222d] border border-[#2a2e39] rounded-lg p-3 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white">RSI (14) Momentum</span>
                <span className="font-mono text-xs font-bold text-amber-400">
                  {report.rsi14} · {report.rsiState}
                </span>
              </div>
              <div className="relative h-2 w-full bg-[#131722] rounded-full overflow-hidden border border-[#2a2e39]">
                {/* 30 and 70 markers */}
                <div className="absolute left-[30%] top-0 bottom-0 w-px bg-gray-600" />
                <div className="absolute left-[70%] top-0 bottom-0 w-px bg-gray-600" />
                <div
                  className={`h-full transition-all duration-300 ${
                    report.rsi14 >= 70
                      ? 'bg-amber-400'
                      : report.rsi14 >= 50
                      ? 'bg-[#089981]'
                      : 'bg-[#f23645]'
                  }`}
                  style={{ width: `${Math.min(100, Math.max(0, report.rsi14))}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] font-mono text-[#787b86]">
                <span>Oversold (&lt;30)</span>
                <span>Neutral (50)</span>
                <span>Overbought (&gt;70)</span>
              </div>
            </div>

            {/* MACD (12, 26, 9) */}
            <div className="bg-[#1e222d] border border-[#2a2e39] rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white">MACD (12, 26, 9)</span>
                <span
                  className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                    report.macd.histogram >= 0
                      ? 'bg-[#089981]/20 text-[#089981]'
                      : 'bg-[#f23645]/20 text-[#f23645]'
                  }`}
                >
                  {report.macd.state}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 font-mono text-xs text-center">
                <div className="bg-[#131722] p-2 rounded border border-[#2a2e39]">
                  <span className="text-[10px] text-[#787b86] block">MACD</span>
                  <span className="text-white">{report.macd.macdLine}</span>
                </div>
                <div className="bg-[#131722] p-2 rounded border border-[#2a2e39]">
                  <span className="text-[10px] text-[#787b86] block">SIGNAL</span>
                  <span className="text-white">{report.macd.signalLine}</span>
                </div>
                <div className="bg-[#131722] p-2 rounded border border-[#2a2e39]">
                  <span className="text-[10px] text-[#787b86] block">HIST</span>
                  <span
                    className={
                      report.macd.histogram >= 0 ? 'text-[#089981] font-bold' : 'text-[#f23645] font-bold'
                    }
                  >
                    {report.macd.histogram > 0 ? `+${report.macd.histogram}` : report.macd.histogram}
                  </span>
                </div>
              </div>
            </div>

            {/* Volume Orderflow Tug-of-War */}
            <div className="bg-[#1e222d] border border-[#2a2e39] rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white">20-Bar Volume Orderflow</span>
                <span className="text-[10px] font-mono text-amber-300">
                  {report.volumePressure.deltaBias}
                </span>
              </div>
              <div className="h-3 w-full rounded-full overflow-hidden flex bg-[#f23645]">
                <div
                  className="h-full bg-[#089981] transition-all duration-300"
                  style={{ width: `${report.volumePressure.buyVolumePct}%` }}
                />
              </div>
              <div className="flex justify-between font-mono text-xs">
                <span className="text-[#089981] font-semibold">
                  Buyers {report.volumePressure.buyVolumePct}%
                </span>
                <span className="text-[#f23645] font-semibold">
                  Sellers {report.volumePressure.sellVolumePct}%
                </span>
              </div>
            </div>

            {/* Volatility & Bollinger Bands */}
            <div className="bg-[#1e222d] border border-[#2a2e39] rounded-lg p-3 space-y-1.5 font-mono text-xs">
              <div className="text-xs font-sans font-bold text-white mb-1">
                Volatility & Bollinger (20, 2)
              </div>
              <div className="flex justify-between">
                <span className="text-[#787b86]">ATR (14) Range:</span>
                <span className="text-amber-400 font-bold">{report.atr14.toFixed(dec)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#787b86]">Upper Band:</span>
                <span className="text-gray-200">{report.bollinger.upper.toFixed(dec)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#787b86]">Lower Band:</span>
                <span className="text-gray-200">{report.bollinger.lower.toFixed(dec)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#787b86]">Band Width:</span>
                <span className="text-cyan-300">{report.bollinger.bandwidthPct}%</span>
              </div>
            </div>
          </>
        )}

        {activeTab === 'news' && (
          <>
            {/* Macro Regime Simulator & Live Correlations */}
            <div className="bg-[#1e222d] border border-[#2a2e39] rounded-lg p-3 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Flame className="w-3.5 h-3.5 text-amber-400" />
                  Gold Macro Drivers (DXY & Yields)
                </span>
                <span className="text-[10px] font-mono text-[#787b86]">INVERSE CORR</span>
              </div>

              <div className="grid grid-cols-3 gap-1.5 font-mono text-xs text-center">
                <div className="bg-[#131722] p-1.5 rounded border border-[#2a2e39]">
                  <span className="text-[9px] text-[#787b86] block">DXY INDEX</span>
                  <span className="text-white font-bold">{macro.dxyValue.toFixed(2)}</span>
                  <span
                    className={`block text-[10px] ${
                      macro.dxyChangePct <= 0 ? 'text-[#089981]' : 'text-[#f23645]'
                    }`}
                  >
                    {macro.dxyChangePct > 0 ? `+${macro.dxyChangePct}%` : `${macro.dxyChangePct}%`}
                  </span>
                </div>
                <div className="bg-[#131722] p-1.5 rounded border border-[#2a2e39]">
                  <span className="text-[9px] text-[#787b86] block">US 10Y YIELD</span>
                  <span className="text-white font-bold">{macro.us10yYield.toFixed(2)}%</span>
                  <span
                    className={`block text-[10px] ${
                      macro.us10yChangeBps <= 0 ? 'text-[#089981]' : 'text-[#f23645]'
                    }`}
                  >
                    {macro.us10yChangeBps > 0
                      ? `+${macro.us10yChangeBps} bps`
                      : `${macro.us10yChangeBps} bps`}
                  </span>
                </div>
                <div className="bg-[#131722] p-1.5 rounded border border-[#2a2e39]">
                  <span className="text-[9px] text-[#787b86] block">FED CUT ODDS</span>
                  <span className="text-amber-400 font-bold">{macro.fedCutProbPct}%</span>
                  <span className="block text-[10px] text-gray-400">Next FOMC</span>
                </div>
              </div>

              {/* Scenario Presets */}
              <div>
                <span className="text-[10px] text-[#787b86] block mb-1">
                  Simulate Macro Regime Impact on Gold:
                </span>
                <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                  <button
                    onClick={() => onSelectMacroPreset('BASELINE')}
                    className={`px-2 py-1 rounded border text-left transition ${
                      activeMacroPreset === 'BASELINE'
                        ? 'bg-amber-500/20 border-amber-500 text-amber-300 font-semibold'
                        : 'bg-[#131722] border-[#2a2e39] text-gray-400 hover:text-white'
                    }`}
                  >
                    Live Baseline
                  </button>
                  <button
                    onClick={() => onSelectMacroPreset('DOVISH_FED')}
                    className={`px-2 py-1 rounded border text-left transition ${
                      activeMacroPreset === 'DOVISH_FED'
                        ? 'bg-[#089981]/20 border-[#089981] text-[#089981] font-semibold'
                        : 'bg-[#131722] border-[#2a2e39] text-gray-400 hover:text-white'
                    }`}
                  >
                    Dovish Fed / DXY Drop
                  </button>
                  <button
                    onClick={() => onSelectMacroPreset('HAWKISH_CPI')}
                    className={`px-2 py-1 rounded border text-left transition ${
                      activeMacroPreset === 'HAWKISH_CPI'
                        ? 'bg-[#f23645]/20 border-[#f23645] text-[#f23645] font-semibold'
                        : 'bg-[#131722] border-[#2a2e39] text-gray-400 hover:text-white'
                    }`}
                  >
                    Hot CPI / Yield Surge
                  </button>
                  <button
                    onClick={() => onSelectMacroPreset('GEO_ESCALATION')}
                    className={`px-2 py-1 rounded border text-left transition ${
                      activeMacroPreset === 'GEO_ESCALATION'
                        ? 'bg-amber-500/20 border-amber-400 text-amber-300 font-semibold'
                        : 'bg-[#131722] border-[#2a2e39] text-gray-400 hover:text-white'
                    }`}
                  >
                    Safe-Haven Rush
                  </button>
                </div>
              </div>
            </div>

            {/* Interactive Breaking News Headline Analyzer */}
            <form
              onSubmit={handleNewsSubmit}
              className="bg-[#1e222d] border border-[#2a2e39] rounded-lg p-2.5 space-y-2"
            >
              <label className="text-[11px] font-semibold text-gray-200 flex items-center gap-1.5">
                <PlusCircle className="w-3.5 h-3.5 text-amber-400" />
                Test Breaking News Headline on Gold Sentiment
              </label>
              <div className="flex gap-1.5">
                <input
                  type="text"
                  value={customHeadline}
                  onChange={(e) => setCustomHeadline(e.target.value)}
                  placeholder="e.g. Fed signals surprise rate cut as DXY falls..."
                  className="flex-1 bg-[#131722] border border-[#2a2e39] focus:border-amber-400 rounded px-2.5 py-1.5 text-xs text-white placeholder-[#787b86] outline-none"
                />
                <button
                  type="submit"
                  className="px-3 py-1.5 rounded bg-amber-500 hover:bg-amber-400 text-[#0b0e14] font-bold text-xs transition shrink-0"
                >
                  Analyze
                </button>
              </div>
            </form>

            {/* News Feed List */}
            <div className="space-y-2.5">
              {newsItems.map((item) => (
                <div
                  key={item.id}
                  className={`bg-[#1e222d] border rounded-lg p-3 transition ${
                    item.isCustom ? 'border-amber-500/60' : 'border-[#2a2e39]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-[10px] font-mono text-[#787b86]">
                      {item.source} · {item.timestamp}
                    </span>
                    <div className="flex items-center gap-1">
                      <span
                        className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded ${
                          item.impact === 'HIGH'
                            ? 'bg-amber-500/20 text-amber-300'
                            : 'bg-gray-700/50 text-gray-300'
                        }`}
                      >
                        {item.impact} IMPACT
                      </span>
                      <span
                        className={`inline-flex items-center gap-0.5 text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                          item.goldBias === 'BULLISH'
                            ? 'bg-[#089981]/20 text-[#089981]'
                            : item.goldBias === 'BEARISH'
                            ? 'bg-[#f23645]/20 text-[#f23645]'
                            : 'bg-gray-500/20 text-gray-300'
                        }`}
                      >
                        {item.goldBias === 'BULLISH' ? (
                          <ArrowUpRight className="w-3 h-3" />
                        ) : (
                          <ArrowDownRight className="w-3 h-3" />
                        )}
                        {item.goldBias} ({item.sentimentScore > 0 ? `+${item.sentimentScore}` : item.sentimentScore})
                      </span>
                    </div>
                  </div>

                  <h4 className="text-xs font-bold text-white leading-snug mb-1.5">
                    {item.title}
                  </h4>
                  <p className="text-[11px] text-gray-400 leading-relaxed mb-2">
                    {item.summary}
                  </p>
                  <div className="text-[10px] font-mono text-amber-300/90 bg-[#131722] px-2 py-1 rounded border border-[#2a2e39]">
                    Takeaway: {item.keyTakeaway}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </aside>
  );
};
