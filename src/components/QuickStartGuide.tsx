import React, { useState } from 'react';
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  BookOpen,
  CheckCircle2,
  Clock,
  Compass,
  FolderPlus,
  Layers,
  LayoutDashboard,
  MousePointerClick,
  Play,
  Plus,
  Scissors,
  ShieldCheck,
  Sliders,
  Sparkles,
  Target,
  Trophy,
  Zap,
  TrendingUp,
  Square,
  Crosshair,
  SlidersHorizontal,
  ChevronRight,
  HelpCircle,
  Lightbulb,
} from 'lucide-react';

interface QuickStartGuideProps {
  onActionClick?: (action: 'signup' | 'create_session' | 'open_chart') => void;
  isInsideApp?: boolean;
  isLight?: boolean;
}

export const QuickStartGuide: React.FC<QuickStartGuideProps> = ({
  onActionClick,
  isInsideApp = false,
  isLight = false,
}) => {
  const [activeGuideTab, setActiveGuideTab] = useState<
    'all' | 'what_is_where' | 'setup_session' | 'first_trade' | 'pro_tips'
  >('all');

  const showWhatIsWhere =
    activeGuideTab === 'all' || activeGuideTab === 'what_is_where';
  const showSetupSession =
    activeGuideTab === 'all' || activeGuideTab === 'setup_session';
  const showFirstTrade =
    activeGuideTab === 'all' || activeGuideTab === 'first_trade';
  const showProTips =
    activeGuideTab === 'all' || activeGuideTab === 'pro_tips';

  const sectionCls = isLight
    ? 'rounded-2xl border border-[#e0e3eb] bg-white p-5 sm:p-7 space-y-6 shadow-sm'
    : 'rounded-2xl border border-[#242832] bg-[#12151b] p-5 sm:p-7 space-y-6 shadow-xl';
  const sectionHeaderBorder = isLight ? 'border-[#e0e3eb]' : 'border-[#242832]';
  const subCardCls = isLight
    ? 'bg-[#f8f9fd] border border-[#e0e3eb]'
    : 'bg-[#161a22] border border-[#262b36]';
  const innerWellCls = isLight
    ? 'bg-white border border-[#e0e3eb]'
    : 'bg-[#0d0f13] border border-[#242832]';
  const headingText = isLight ? 'text-slate-900' : 'text-white';
  const bodyText = isLight ? 'text-slate-600' : 'text-[#9ca3af]';
  const listText = isLight ? 'text-slate-700' : 'text-[#cbd5e1]';

  return (
    <div className="space-y-8 text-left">
      {/* Guide Header & Navigation */}
      <div
        className={`flex flex-col md:flex-row md:items-end justify-between gap-4 border-b pb-5 ${
          isLight ? 'border-[#e0e3eb]' : 'border-white/[0.08]'
        }`}
      >
        <div>
          <div
            className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border text-[11px] font-mono font-bold mb-2.5 ${
              isLight
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>INTERACTIVE TRADER PLAYBOOK & GUIDE</span>
          </div>
          <h2 className={`text-2xl sm:text-3xl font-black tracking-tight ${headingText}`}>
            Master the Simulator: Interface, Session Setup & Execution
          </h2>
          <p className={`text-xs sm:text-sm mt-1 max-w-2xl leading-relaxed ${bodyText}`}>
            A crisp, practical walk-through of the trading terminal, prop challenge rules, and zero-lookahead backtesting workflow.
          </p>
        </div>

        {/* Filter Tabs */}
        <div
          className={`flex flex-wrap items-center gap-1.5 p-1.5 rounded-xl border shrink-0 ${
            isLight
              ? 'bg-white border-[#e0e3eb] shadow-sm'
              : 'bg-[#12151b] border-[#242832]'
          }`}
        >
          {(
            [
              { id: 'all', label: 'All Chapters' },
              { id: 'what_is_where', label: '1. Interface Map' },
              { id: 'setup_session', label: '2. Session Setup' },
              { id: 'first_trade', label: '3. Execution & R:R' },
              { id: 'pro_tips', label: '4. Pro Tips & Rules' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveGuideTab(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                activeGuideTab === tab.id
                  ? 'bg-[#2962ff] text-white shadow'
                  : isLight
                  ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  : 'text-[#9ca3af] hover:text-white hover:bg-white/5'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* =====================================================================
          PART 1: WHAT IS WHERE (INTERFACE MAP)
      ===================================================================== */}
      {showWhatIsWhere && (
        <section className={sectionCls}>
          <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b ${sectionHeaderBorder} pb-4`}>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#2962ff]/15 border border-[#2962ff]/35 text-[#2962ff] font-black text-sm flex items-center justify-center shrink-0">
                01
              </div>
              <div>
                <span className="text-[10px] font-mono uppercase tracking-wider text-[#2962ff] font-bold">
                  CHAPTER 1 · WORKSPACE TOUR
                </span>
                <h3 className={`text-lg sm:text-xl font-extrabold ${headingText}`}>
                  Terminal Layout & Control Zones
                </h3>
              </div>
            </div>
            <span
              className={`text-[11px] font-mono px-2.5 py-1 rounded-lg border font-semibold ${
                isLight
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-[#1a1e26] border-[#282d38] text-emerald-400'
              }`}
            >
              6 Core Workspace Panels
            </span>
          </div>

          {/* Interactive Visual Blueprint */}
          <div
            className={`rounded-xl border p-3 sm:p-4 space-y-2.5 font-mono text-xs ${
              isLight
                ? 'border-[#e0e3eb] bg-[#f8f9fd]'
                : 'border-[#282d38] bg-[#0b0e14]'
            }`}
          >
            <div className={`text-[10px] uppercase tracking-wider font-sans font-bold mb-1 flex items-center justify-between ${isLight ? 'text-slate-600' : 'text-gray-400'}`}>
              <span>VISUAL TERMINAL MAP</span>
              <span className="text-emerald-400">Deterministic · Zero Future Lookahead</span>
            </div>

            {/* Zone 1: Top Navigation Bar Blueprint */}
            <div
              className={`p-2.5 rounded-lg border border-blue-500/40 flex flex-wrap items-center justify-between gap-2 ${
                isLight ? 'bg-white shadow-xs' : 'bg-[#141821]'
              }`}
            >
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2 py-0.5 rounded bg-[#2962ff] text-white font-bold text-[10px]">
                  [1] TOP BAR
                </span>
                <span className={`font-bold ${headingText}`}>Session Selector</span>
                <span className="text-slate-400">·</span>
                <span className="text-amber-400 font-semibold">Symbol (XAU/USD, NAS100)</span>
                <span className="text-slate-400">·</span>
                <span className={isLight ? 'text-sky-700 font-semibold' : 'text-sky-400'}>Timeframes (1m – 1D)</span>
                <span className="text-slate-400">·</span>
                <span className="text-emerald-400 font-semibold">Replay Clock</span>
              </div>
              <div className="flex items-center gap-2 text-[11px] flex-wrap">
                <span
                  className={`px-2 py-0.5 rounded border font-semibold ${
                    isLight
                      ? 'bg-slate-100 border-slate-300 text-slate-800'
                      : 'bg-[#0d0f13] border-[#262a34] text-gray-200'
                  }`}
                >
                  Live Balance &amp; Equity
                </span>
                <span className={`px-2 py-0.5 rounded font-semibold ${isLight ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-emerald-500/15 text-emerald-400'}`}>
                  Analytics
                </span>
                <span className={`px-2 py-0.5 rounded font-semibold ${isLight ? 'bg-slate-100 text-slate-700 border border-slate-200' : 'bg-white/5 text-gray-300'}`}>
                  Dashboard
                </span>
                <span className={`px-2 py-0.5 rounded font-semibold ${isLight ? 'bg-amber-50 text-amber-800 border border-amber-200' : 'bg-amber-500/15 text-amber-400'}`}>
                  Cut Tool
                </span>
              </div>
            </div>

            {/* Middle Row: Left Toolbar + Center Chart + Right Order Ticket */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-2.5">
              {/* Zone 2: Left Drawing Toolbar */}
              <div
                className={`lg:col-span-3 p-3 rounded-lg border border-purple-500/40 flex flex-col justify-between space-y-2 ${
                  isLight ? 'bg-white' : 'bg-[#141821]'
                }`}
              >
                <div>
                  <span className="px-2 py-0.5 rounded bg-purple-600 text-white font-bold text-[10px] inline-block mb-1.5">
                    [2] LEFT TOOLBAR
                  </span>
                  <div className={`text-[11px] font-sans font-bold ${headingText}`}>
                    Drawings &amp; Risk Ratios
                  </div>
                </div>
                <div className={`space-y-1 text-[11px] font-sans ${isLight ? 'text-slate-700' : 'text-gray-300'}`}>
                  <div>• Crosshair &amp; Cursor selection</div>
                  <div>• Trendlines &amp; Horizontal Price Rays</div>
                  <div>• Rectangles (FVG / Supply &amp; Demand)</div>
                  <div className="text-emerald-400 font-bold">
                    • Long &amp; Short Position R:R Box
                  </div>
                  <div>• Price Range &amp; Measurement Ruler</div>
                </div>
              </div>

              {/* Zone 3: Center Candlestick Chart */}
              <div
                className={`lg:col-span-5 p-4 rounded-lg border border-emerald-500/40 flex flex-col justify-between min-h-[160px] relative overflow-hidden ${
                  isLight ? 'bg-white' : 'bg-[#0f131c]'
                }`}
              >
                <div className="flex items-center justify-between z-10">
                  <span className="px-2 py-0.5 rounded bg-emerald-600 text-white font-bold text-[10px]">
                    [3] CANDLESTICK CHART
                  </span>
                  <span className="text-[10px] text-emerald-400 font-semibold">
                    Drag SL / TP Directly on Chart
                  </span>
                </div>
                <div
                  className={`my-3 p-3 rounded-lg border z-10 space-y-1 font-sans ${
                    isLight
                      ? 'border-slate-200 bg-[#f8f9fd]'
                      : 'border-white/10 bg-[#141822]/90'
                  }`}
                >
                  <div className={`text-xs font-bold ${headingText}`}>
                    Interactive Historical Candles &amp; Fill Markers
                  </div>
                  <p className={`text-[11px] leading-relaxed ${bodyText}`}>
                    Zero future data leakage. Pan, zoom, draw zones, and adjust stop loss or take profit handles visually.
                  </p>
                </div>
                <div className={`flex items-center justify-between text-[10px] z-10 ${isLight ? 'text-slate-600 font-medium' : 'text-gray-400'}`}>
                  <span>Session Killzones (London, NY Open)</span>
                  <span>Right Axis: Real-Time Price Scale</span>
                </div>
              </div>

              {/* Zone 4: Right Order Ticket & Prop Rules */}
              <div
                className={`lg:col-span-4 p-3 rounded-lg border border-amber-500/40 flex flex-col justify-between space-y-2 ${
                  isLight ? 'bg-white' : 'bg-[#141821]'
                }`}
              >
                <div>
                  <span className="px-2 py-0.5 rounded bg-amber-500 text-slate-950 font-bold text-[10px] inline-block mb-1.5">
                    [4] RIGHT ORDER TICKET
                  </span>
                  <div className={`text-[11px] font-sans font-bold ${headingText}`}>
                    Execution &amp; Prop Firm Guardrails
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-1.5 text-[10px] font-bold text-center">
                  <div className={`py-1 rounded border ${isLight ? 'bg-emerald-50 text-emerald-800 border-emerald-300' : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'}`}>
                    LONG (BUY)
                  </div>
                  <div className={`py-1 rounded border ${isLight ? 'bg-rose-50 text-rose-800 border-rose-300' : 'bg-rose-500/20 text-rose-400 border-rose-500/40'}`}>
                    SHORT (SELL)
                  </div>
                </div>
                <div className={`text-[10px] font-sans space-y-0.5 ${isLight ? 'text-slate-700' : 'text-gray-300'}`}>
                  <div>• Market, Limit, or Stop order types</div>
                  <div>• Sizing via Lot Size or Auto Risk % calculation</div>
                  <div>• Live Risk-to-Reward (R:R) computation</div>
                  <div className={isLight ? 'text-amber-700 font-semibold' : 'text-amber-300 font-semibold'}>
                    • Dynamic Daily &amp; Max Loss drawdown gauges
                  </div>
                </div>
              </div>
            </div>

            {/* Zone 5: Bottom Dock */}
            <div
              className={`p-2.5 rounded-lg border border-sky-500/40 flex flex-wrap items-center justify-between gap-2 ${
                isLight ? 'bg-white' : 'bg-[#141821]'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-sky-500 text-slate-950 font-bold text-[10px]">
                  [5] BOTTOM DOCK
                </span>
                <span className={`font-bold ${headingText}`}>
                  Play / Pause · Step +1 Bar · Speed (1x–20x) · Killzone Quick Jump
                </span>
              </div>
              <div className={`text-[11px] font-sans font-semibold ${isLight ? 'text-sky-700' : 'text-sky-300'}`}>
                Tabs: Open Positions (Break-Even / 50% Partial / Close) · Pending Orders · Closed Audit · Trade Journal
              </div>
            </div>
          </div>

          {/* 6 Panel Summaries */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className={`p-4 rounded-xl space-y-2 ${subCardCls}`}>
              <div className={`flex items-center gap-2 text-xs font-extrabold ${headingText}`}>
                <span className="w-6 h-6 rounded-lg bg-[#2962ff]/15 text-[#2962ff] flex items-center justify-center font-mono">
                  1
                </span>
                <span>Top Bar &amp; Market Selector</span>
              </div>
              <p className={`text-xs leading-relaxed ${bodyText}`}>
                Switch sessions, select historical instruments (XAU/USD, NAS100, EUR/USD), change timeframes (1m to 1D), and monitor real-time replay clock time.
              </p>
            </div>

            <div className={`p-4 rounded-xl space-y-2 ${subCardCls}`}>
              <div className={`flex items-center gap-2 text-xs font-extrabold ${headingText}`}>
                <span className={`w-6 h-6 rounded-lg flex items-center justify-center font-mono ${isLight ? 'bg-purple-100 text-purple-700' : 'bg-purple-500/20 text-purple-400'}`}>
                  2
                </span>
                <span>Drawing &amp; Analysis Toolbar</span>
              </div>
              <p className={`text-xs leading-relaxed ${bodyText}`}>
                Draw support/resistance, market structure shifts, trendlines, and place visual Long/Short position boxes with direct chart execution handles.
              </p>
            </div>

            <div className={`p-4 rounded-xl space-y-2 ${subCardCls}`}>
              <div className={`flex items-center gap-2 text-xs font-extrabold ${headingText}`}>
                <span className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-mono">
                  3
                </span>
                <span>Candlestick Replay Engine</span>
              </div>
              <p className={`text-xs leading-relaxed ${bodyText}`}>
                Step bar-by-bar with zero future lookahead. Visual markers show exact trade entry, stop loss, and take profit price levels.
              </p>
            </div>

            <div className={`p-4 rounded-xl space-y-2 ${subCardCls}`}>
              <div className={`flex items-center gap-2 text-xs font-extrabold ${headingText}`}>
                <span className="w-6 h-6 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center font-mono">
                  4
                </span>
                <span>Order Ticket &amp; Prop Rules</span>
              </div>
              <p className={`text-xs leading-relaxed ${bodyText}`}>
                Execute Market or Pending orders, size via account percentage risk, and track daily drawdown, max drawdown, and profit target progress in real time.
              </p>
            </div>

            <div className={`p-4 rounded-xl space-y-2 ${subCardCls}`}>
              <div className={`flex items-center gap-2 text-xs font-extrabold ${headingText}`}>
                <span className={`w-6 h-6 rounded-lg flex items-center justify-center font-mono ${isLight ? 'bg-sky-100 text-sky-700' : 'bg-sky-500/20 text-sky-400'}`}>
                  5
                </span>
                <span>Replay Dock &amp; Management</span>
              </div>
              <p className={`text-xs leading-relaxed ${bodyText}`}>
                Step forward, control replay speed, jump directly to London/NY session opens, move stops to Break-Even (BE), or take 50% partial profits.
              </p>
            </div>

            <div className={`p-4 rounded-xl space-y-2 ${subCardCls}`}>
              <div className={`flex items-center gap-2 text-xs font-extrabold ${headingText}`}>
                <span className={`w-6 h-6 rounded-lg flex items-center justify-center font-mono ${isLight ? 'bg-pink-100 text-pink-700' : 'bg-pink-500/20 text-pink-400'}`}>
                  6
                </span>
                <span>Dashboard &amp; Performance Hub</span>
              </div>
              <p className={`text-xs leading-relaxed ${bodyText}`}>
                Full analytics hub: Equity &amp; Balance curves, Drawdown progression, Trade audit logs, Playbooks, and User Settings with complete data control.
              </p>
            </div>
          </div>
        </section>
      )}

      {/* =====================================================================
          PART 2: HOW TO SET UP A SESSION
      ===================================================================== */}
      {showSetupSession && (
        <section className={sectionCls}>
          <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b ${sectionHeaderBorder} pb-4`}>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 font-black text-sm flex items-center justify-center shrink-0">
                02
              </div>
              <div>
                <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-400 font-bold">
                  CHAPTER 2 · SESSION WORKFLOW
                </span>
                <h3 className={`text-lg sm:text-xl font-extrabold ${headingText}`}>
                  Creating a Backtest or Prop Challenge Session
                </h3>
              </div>
            </div>
            {onActionClick && (
              <button
                onClick={() =>
                  onActionClick(isInsideApp ? 'create_session' : 'signup')
                }
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold flex items-center gap-1.5 transition shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>
                  {isInsideApp ? 'Open Session Modal' : 'Create First Session'}
                </span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Step 1 */}
            <div className={`p-5 rounded-xl flex flex-col justify-between space-y-4 ${subCardCls}`}>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-1 rounded-md bg-emerald-500/15 text-emerald-400 font-mono font-bold text-xs">
                    STEP 1
                  </span>
                  <FolderPlus className="w-5 h-5 text-emerald-400" />
                </div>
                <h4 className={`text-base font-extrabold ${headingText}`}>
                  Choose Backtest Mode
                </h4>
                <p className={`text-xs leading-relaxed ${bodyText}`}>
                  Select <strong className={headingText}>Normal Backtesting</strong> for open practice with bar rewind, or <strong className="text-amber-400">Prop Firm Challenge</strong> to enforce strict daily loss, max drawdown, and profit target conditions.
                </p>
              </div>

              <div className={`p-3 rounded-xl space-y-2 text-[11px] ${innerWellCls}`}>
                <div className="grid grid-cols-2 gap-2">
                  <div className={`p-2 rounded-lg border font-bold text-xs ${isLight ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'}`}>
                    <Zap className="w-3.5 h-3.5 inline mr-1" /> Free Replay
                  </div>
                  <div className={`p-2 rounded-lg border font-bold text-xs ${isLight ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-amber-500/10 border-amber-500/30 text-amber-300'}`}>
                    <Trophy className="w-3.5 h-3.5 inline mr-1" /> Prop Challenge
                  </div>
                </div>
              </div>
            </div>

            {/* Step 2 */}
            <div className={`p-5 rounded-xl flex flex-col justify-between space-y-4 ${subCardCls}`}>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-1 rounded-md bg-[#2962ff]/15 text-blue-400 font-mono font-bold text-xs">
                    STEP 2
                  </span>
                  <Sliders className="w-5 h-5 text-blue-400" />
                </div>
                <h4 className={`text-base font-extrabold ${headingText}`}>
                  Balance, Instruments &amp; Strategy
                </h4>
                <p className={`text-xs leading-relaxed ${bodyText}`}>
                  Set starting capital ($10K, $50K, $100K or custom), pick your initial active symbol (e.g. XAU/USD, NAS100), and link a strategy playbook for tag tracking.
                </p>
              </div>

              <div className={`p-3 rounded-xl space-y-2 text-[11px] font-mono ${innerWellCls}`}>
                <div className="flex items-center justify-between text-gray-400">
                  <span>CAPITAL:</span>
                  <span className={`font-bold ${headingText}`}>$100,000 USD</span>
                </div>
                <div className="flex items-center justify-between text-gray-400">
                  <span>STRATEGY:</span>
                  <span className="text-emerald-400 font-bold">ICT Silver Bullet</span>
                </div>
              </div>
            </div>

            {/* Step 3 */}
            <div className={`p-5 rounded-xl flex flex-col justify-between space-y-4 ${subCardCls}`}>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-1 rounded-md bg-amber-500/20 text-amber-400 font-mono font-bold text-xs">
                    STEP 3
                  </span>
                  <Clock className="w-5 h-5 text-amber-400" />
                </div>
                <h4 className={`text-base font-extrabold ${headingText}`}>
                  Historical Start Date &amp; Launch
                </h4>
                <p className={`text-xs leading-relaxed ${bodyText}`}>
                  Pick a historical starting point and opening session hour (London 08:00 or NY 13:30 UTC), then click Launch to enter the zero-lookahead chart.
                </p>
              </div>

              <div className={`p-3 rounded-xl space-y-2 text-[11px] ${innerWellCls}`}>
                <div className="w-full py-2 rounded-lg bg-emerald-600 text-white font-extrabold text-center text-xs flex items-center justify-center gap-1.5 shadow">
                  <Play className="w-3.5 h-3.5 fill-current" /> Launch Simulator Session
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* =====================================================================
          PART 3: EXECUTING TRADES & SIZING
      ===================================================================== */}
      {showFirstTrade && (
        <section className={sectionCls}>
          <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b ${sectionHeaderBorder} pb-4`}>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-400 font-black text-sm flex items-center justify-center shrink-0">
                03
              </div>
              <div>
                <span className="text-[10px] font-mono uppercase tracking-wider text-amber-400 font-bold">
                  CHAPTER 3 · EXECUTION MODES
                </span>
                <h3 className={`text-lg sm:text-xl font-extrabold ${headingText}`}>
                  Executing Trades: Order Panel vs. On-Chart R:R Tool
                </h3>
              </div>
            </div>
            {onActionClick && (
              <button
                onClick={() =>
                  onActionClick(isInsideApp ? 'open_chart' : 'signup')
                }
                className="px-4 py-2 rounded-xl bg-[#2962ff] hover:bg-[#1e53e5] text-white text-xs font-extrabold flex items-center gap-1.5 transition shrink-0"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>{isInsideApp ? 'Open Chart Terminal' : 'Trade Now'}</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Method A */}
            <div className={`p-5 rounded-2xl space-y-4 flex flex-col justify-between ${subCardCls}`}>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-1 rounded-md bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-mono font-bold text-xs">
                    METHOD A · RIGHT ORDER TICKET
                  </span>
                  <span className="text-[11px] font-mono text-gray-400">
                    Precision Sizing
                  </span>
                </div>
                <h4 className={`text-base font-extrabold ${headingText}`}>
                  Execute Long / Short via Order Panel
                </h4>

                <ol className={`space-y-2.5 text-xs leading-relaxed ${listText}`}>
                  <li className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 font-mono font-bold text-[11px] flex items-center justify-center shrink-0 mt-0.5">
                      1
                    </span>
                    <span>
                      <strong>Direction:</strong> Click <strong className="text-emerald-400">LONG (Buy)</strong> for upward momentum or <strong className="text-rose-400">SHORT (Sell)</strong> for short setups.
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 font-mono font-bold text-[11px] flex items-center justify-center shrink-0 mt-0.5">
                      2
                    </span>
                    <span>
                      <strong>Order Type:</strong> Choose <strong className={headingText}>MARKET</strong> for immediate fill or <strong className={headingText}>LIMIT / STOP</strong> for structural breakouts.
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 font-mono font-bold text-[11px] flex items-center justify-center shrink-0 mt-0.5">
                      3
                    </span>
                    <span>
                      <strong>Risk Management:</strong> Select <strong className={headingText}>% Risk (e.g. 1.0%)</strong> to automatically calculate lot size from Stop Loss distance.
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 font-mono font-bold text-[11px] flex items-center justify-center shrink-0 mt-0.5">
                      4
                    </span>
                    <span>
                      <strong>Execute:</strong> Click <strong className="text-emerald-400">Execute Order</strong>. The position immediately appears on the chart and in the Bottom Dock.
                    </span>
                  </li>
                </ol>
              </div>

              <div className={`p-3.5 rounded-xl font-mono text-xs space-y-2.5 ${innerWellCls}`}>
                <div className="grid grid-cols-2 gap-2">
                  <div className="py-1.5 px-2 rounded-lg bg-emerald-600 text-white font-bold text-center flex items-center justify-center gap-1">
                    <ArrowUpRight className="w-3.5 h-3.5" /> BUY / LONG
                  </div>
                  <div className={`py-1.5 px-2 rounded-lg text-rose-400 border border-rose-500/30 font-bold text-center flex items-center justify-center gap-1 ${isLight ? 'bg-rose-50' : 'bg-[#1a1e26]'}`}>
                    <ArrowDownRight className="w-3.5 h-3.5" /> SELL / SHORT
                  </div>
                </div>
                <div className="py-2 rounded-lg bg-emerald-600 text-white font-sans font-extrabold text-center text-xs shadow">
                  Execute Market Buy · 1.50 Lots (1.0% Risk)
                </div>
              </div>
            </div>

            {/* Method B */}
            <div className={`p-5 rounded-2xl space-y-4 flex flex-col justify-between ${subCardCls}`}>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-1 rounded-md bg-[#2962ff]/15 border border-[#2962ff]/35 text-blue-400 font-mono font-bold text-xs">
                    METHOD B · VISUAL ON-CHART R:R BOX
                  </span>
                  <span className="text-[11px] font-mono text-gray-400">
                    Visual Trading
                  </span>
                </div>
                <h4 className={`text-base font-extrabold ${headingText}`}>
                  Place Setup on Chart &amp; Click Execute
                </h4>

                <ol className={`space-y-2.5 text-xs leading-relaxed ${listText}`}>
                  <li className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-[#2962ff]/15 text-blue-400 font-mono font-bold text-[11px] flex items-center justify-center shrink-0 mt-0.5">
                      1
                    </span>
                    <span>
                      <strong>Select Tool:</strong> From the left toolbar, click the <strong className="text-emerald-400">Long Position</strong> or <strong className="text-rose-400">Short Position</strong> tool.
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-[#2962ff]/15 text-blue-400 font-mono font-bold text-[11px] flex items-center justify-center shrink-0 mt-0.5">
                      2
                    </span>
                    <span>
                      <strong>Drop on Candle:</strong> Click the chart to anchor your entry. Drag the green Take Profit handle and red Stop Loss boundary.
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-[#2962ff]/15 text-blue-400 font-mono font-bold text-[11px] flex items-center justify-center shrink-0 mt-0.5">
                      3
                    </span>
                    <span>
                      <strong>One-Click Fill:</strong> Click <strong className="text-emerald-400">&ldquo;Execute Market&rdquo;</strong> right from the floating tool bubble.
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-[#2962ff]/15 text-blue-400 font-mono font-bold text-[11px] flex items-center justify-center shrink-0 mt-0.5">
                      4
                    </span>
                    <span>
                      <strong>Step Time:</strong> Press <strong className={headingText}>Step +1 Bar</strong> in the Bottom Dock to advance the simulation candle-by-candle.
                    </span>
                  </li>
                </ol>
              </div>

              <div className={`p-3.5 rounded-xl font-mono text-xs space-y-2 ${innerWellCls}`}>
                <div className={`rounded-lg overflow-hidden border ${isLight ? 'border-slate-200' : 'border-white/10'}`}>
                  <div className={`border-b px-3 py-1.5 flex items-center justify-between text-[11px] ${isLight ? 'bg-emerald-50 border-emerald-200' : 'bg-[#089981]/25 border-[#089981]/50'}`}>
                    <span className={isLight ? 'text-emerald-800 font-bold' : 'text-emerald-300 font-bold'}>TAKE PROFIT (TP)</span>
                    <span className={`font-bold ${headingText}`}>+3.0R Target</span>
                  </div>
                  <div className={`px-3 py-2 flex items-center justify-between text-[11px] border-b ${isLight ? 'bg-white border-slate-200' : 'bg-[#141822] border-white/10'}`}>
                    <span className={`font-bold ${headingText}`}>ENTRY LINE</span>
                    <span className="px-2 py-0.5 rounded bg-emerald-600 text-white text-[10px] font-bold">
                      Execute Market
                    </span>
                  </div>
                  <div className={`px-3 py-1.5 flex items-center justify-between text-[11px] ${isLight ? 'bg-rose-50' : 'bg-[#f23645]/20'}`}>
                    <span className={isLight ? 'text-rose-800 font-bold' : 'text-rose-300 font-bold'}>STOP LOSS (SL)</span>
                    <span className={isLight ? 'text-rose-800 font-bold' : 'text-rose-300 font-bold'}>-1.0R Risk</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* =====================================================================
          PART 4: PRO TIPS & DRAWDOWN RULES
      ===================================================================== */}
      {showProTips && (
        <section className={sectionCls}>
          <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b ${sectionHeaderBorder} pb-4`}>
            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-xl border font-black text-sm flex items-center justify-center shrink-0 ${isLight ? 'bg-purple-50 border-purple-200 text-purple-700' : 'bg-purple-500/20 border-purple-500/40 text-purple-400'}`}>
                04
              </div>
              <div>
                <span className={`text-[10px] font-mono uppercase tracking-wider font-bold ${isLight ? 'text-purple-700' : 'text-purple-400'}`}>
                  CHAPTER 4 · PRO RULES & BEST PRACTICES
                </span>
                <h3 className={`text-lg sm:text-xl font-extrabold ${headingText}`}>
                  Risk Management &amp; Evaluation Guardrails
                </h3>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className={`p-4 rounded-xl space-y-2 ${subCardCls}`}>
              <div className="flex items-center gap-2 text-xs font-bold text-amber-400">
                <ShieldCheck className="w-4 h-4" />
                <span>Daily Loss Calculation</span>
              </div>
              <p className={`text-xs leading-relaxed ${bodyText}`}>
                Daily drawdown is measured from either starting balance or midnight high-water equity. Keep each trade risk at 0.5%–1.0% to avoid tripping breach triggers.
              </p>
            </div>

            <div className={`p-4 rounded-xl space-y-2 ${subCardCls}`}>
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-400">
                <Target className="w-4 h-4" />
                <span>Partial Profits &amp; Break-Even</span>
              </div>
              <p className={`text-xs leading-relaxed ${bodyText}`}>
                Use the <strong className={headingText}>BE</strong> button in the bottom dock once price clears 1.5R, or click <strong className="text-amber-400">50%</strong> to bank partial profits and remove psychological friction.
              </p>
            </div>

            <div className={`p-4 rounded-xl space-y-2 ${subCardCls}`}>
              <div className={`flex items-center gap-2 text-xs font-bold ${isLight ? 'text-sky-700' : 'text-sky-400'}`}>
                <Lightbulb className="w-4 h-4" />
                <span>Session Journal &amp; Tags</span>
              </div>
              <p className={`text-xs leading-relaxed ${bodyText}`}>
                After closing a trade, add notes and setup tags. All session statistics roll automatically into the Analytics Dashboard and exportable CSV audit report.
              </p>
            </div>
          </div>
        </section>
      )}
    </div>
  );
};
