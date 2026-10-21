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
} from 'lucide-react';

interface QuickStartGuideProps {
  onActionClick?: (action: 'signup' | 'create_session' | 'open_chart') => void;
  isInsideApp?: boolean;
}

export const QuickStartGuide: React.FC<QuickStartGuideProps> = ({
  onActionClick,
  isInsideApp = false,
}) => {
  const [activeGuideTab, setActiveGuideTab] = useState<
    'all' | 'what_is_where' | 'setup_session' | 'first_trade'
  >('all');

  const showWhatIsWhere =
    activeGuideTab === 'all' || activeGuideTab === 'what_is_where';
  const showSetupSession =
    activeGuideTab === 'all' || activeGuideTab === 'setup_session';
  const showFirstTrade =
    activeGuideTab === 'all' || activeGuideTab === 'first_trade';

  return (
    <div className="space-y-10 text-left">
      {/* Guide Header & Quick Filter Pills */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-[#242832] pb-5">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[11px] font-mono font-bold mb-2.5">
            <BookOpen className="w-3.5 h-3.5" />
            <span>STEP-BY-STEP INTERACTIVE PLATFORM GUIDE</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            How It Works: What Is Where, Session Setup &amp; Your First Trade
          </h2>
          <p className="text-xs sm:text-sm text-[#9ca3af] mt-1 max-w-2xl">
            Everything you need to know to navigate the workspace, configure a historical backtest or Prop Firm evaluation, and execute your first Buy or Sell order.
          </p>
        </div>

        {/* Filter Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 bg-[#12151b] p-1.5 rounded-xl border border-[#242832] shrink-0">
          {(
            [
              { id: 'all', label: 'All Steps (Full Guide)' },
              { id: 'what_is_where', label: '1. What Is Where' },
              { id: 'setup_session', label: '2. Set Up Session' },
              { id: 'first_trade', label: '3. First Buy / Sell' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveGuideTab(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                activeGuideTab === tab.id
                  ? 'bg-[#2962ff] text-white shadow'
                  : 'text-[#9ca3af] hover:text-white hover:bg-white/5'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* =====================================================================
          PART 1: WHAT IS WHERE (WORKSPACE & INTERFACE MAP)
      ===================================================================== */}
      {showWhatIsWhere && (
        <div className="rounded-2xl border border-[#242832] bg-[#12151b] p-5 sm:p-7 space-y-6 shadow-2xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#242832] pb-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#2962ff]/20 border border-[#2962ff]/40 text-[#2962ff] font-black text-sm flex items-center justify-center shrink-0">
                01
              </div>
              <div>
                <span className="text-[10px] font-mono uppercase tracking-wider text-[#2962ff] font-bold">
                  PART 1 · WORKSPACE TOUR
                </span>
                <h3 className="text-lg sm:text-xl font-extrabold text-white">
                  What Is Where — Your Complete Interface Map
                </h3>
              </div>
            </div>
            <span className="text-[11px] font-mono px-2.5 py-1 rounded-lg bg-[#1a1e26] border border-[#282d38] text-emerald-400">
              6 Key Workspace Zones
            </span>
          </div>

          {/* Interactive Visual Blueprint of the Terminal Layout */}
          <div className="rounded-xl border border-[#282d38] bg-[#0b0e14] p-3 sm:p-4 space-y-2.5 font-mono text-xs">
            <div className="text-[10px] uppercase tracking-wider text-gray-400 font-sans font-bold mb-1 flex items-center justify-between">
              <span>VISUAL TERMINAL LAYOUT BLUEPRINT</span>
              <span className="text-emerald-400">Hover or read numbered zones below</span>
            </div>

            {/* Zone 1: Top Navigation Bar Blueprint */}
            <div className="p-2.5 rounded-lg bg-[#141821] border border-blue-500/40 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-[#2962ff] text-white font-bold text-[10px]">
                  [1] TOP BAR
                </span>
                <span className="text-white font-bold">Session Pill</span>
                <span className="text-gray-500">·</span>
                <span className="text-amber-400">Instrument (XAU/USD, NAS100)</span>
                <span className="text-gray-500">·</span>
                <span className="text-sky-400">Timeframes (1m – 1D)</span>
                <span className="text-gray-500">·</span>
                <span className="text-emerald-400">Replay Clock</span>
              </div>
              <div className="flex items-center gap-2 text-[11px]">
                <span className="px-2 py-0.5 rounded bg-[#0d0f13] border border-[#262a34] text-gray-200">
                  Bal / Equity
                </span>
                <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400">
                  Analytics
                </span>
                <span className="px-2 py-0.5 rounded bg-white/5 text-gray-300">
                  Dashboard
                </span>
                <span className="px-2 py-0.5 rounded bg-amber-500/15 text-amber-400">
                  Cut Tool
                </span>
              </div>
            </div>

            {/* Middle Row: Left Toolbar + Center Chart + Right Order Ticket */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-2.5">
              {/* Zone 2: Left Drawing Toolbar */}
              <div className="lg:col-span-2 p-3 rounded-lg bg-[#141821] border border-purple-500/40 flex flex-col justify-between space-y-2">
                <div>
                  <span className="px-2 py-0.5 rounded bg-purple-600 text-white font-bold text-[10px] inline-block mb-1.5">
                    [2] LEFT TOOLBAR
                  </span>
                  <div className="text-[11px] font-sans font-bold text-white">
                    Drawing &amp; R:R Tools
                  </div>
                </div>
                <div className="space-y-1 text-[10px] text-gray-300 font-sans">
                  <div>+ Crosshair / Cursor</div>
                  <div>╱ Trend &amp; Horiz Lines</div>
                  <div>▭ Rectangles / Zones</div>
                  <div className="text-emerald-400 font-bold">
                    ⇅ Long / Short Position R:R
                  </div>
                  <div>📏 Ruler &amp; 🧲 Magnet</div>
                </div>
              </div>

              {/* Zone 3: Center Candlestick Chart */}
              <div className="lg:col-span-6 p-4 rounded-lg bg-[#0f131c] border border-emerald-500/40 flex flex-col justify-between min-h-[160px] relative overflow-hidden">
                <div className="flex items-center justify-between z-10">
                  <span className="px-2 py-0.5 rounded bg-emerald-600 text-white font-bold text-[10px]">
                    [3] CENTER CHART CANVAS
                  </span>
                  <span className="text-[10px] text-emerald-400">
                    Zero Future Lookahead · Drag SL/TP on Chart
                  </span>
                </div>
                <div className="my-3 p-3 rounded-lg border border-white/10 bg-[#141822]/90 z-10 space-y-1 font-sans">
                  <div className="text-xs font-bold text-white">
                    Interactive Historical Candlesticks &amp; Visual Trade Execution
                  </div>
                  <p className="text-[11px] text-gray-400 leading-relaxed">
                    Pan &amp; zoom freely, draw Supply/Demand zones, drop a{' '}
                    <strong className="text-emerald-400">Long or Short Position R:R box</strong>, and drag your Entry, Stop Loss, and Take Profit handles directly on the candles.
                  </p>
                </div>
                <div className="flex items-center justify-between text-[10px] text-gray-400 z-10">
                  <span>Session Killzone Boxes (Asia / London / NY)</span>
                  <span>Right Axis: Live Price Scale</span>
                </div>
              </div>

              {/* Zone 4: Right Order Ticket & Prop Rules */}
              <div className="lg:col-span-4 p-3 rounded-lg bg-[#141821] border border-amber-500/40 flex flex-col justify-between space-y-2">
                <div>
                  <span className="px-2 py-0.5 rounded bg-amber-500 text-slate-950 font-bold text-[10px] inline-block mb-1.5">
                    [4] RIGHT ORDER TICKET
                  </span>
                  <div className="text-[11px] font-sans font-bold text-white">
                    Order Execution &amp; Live Prop Rules
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-1.5 text-[10px] font-bold text-center">
                  <div className="py-1 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                    LONG / BUY
                  </div>
                  <div className="py-1 rounded bg-rose-500/20 text-rose-400 border border-rose-500/40">
                    SHORT / SELL
                  </div>
                </div>
                <div className="text-[10px] text-gray-300 font-sans space-y-0.5">
                  <div>• Order Type: Market, Limit, or Stop</div>
                  <div>• Position Size: Lots or auto Risk %</div>
                  <div>• Stop Loss, Take Profit &amp; Live R:R</div>
                  <div className="text-amber-300 font-semibold">
                    • Live Prop Firm Drawdown &amp; Target Bars
                  </div>
                </div>
              </div>
            </div>

            {/* Zone 5: Bottom Replay & Positions Dock */}
            <div className="p-2.5 rounded-lg bg-[#141821] border border-sky-500/40 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-sky-500 text-slate-950 font-bold text-[10px]">
                  [5] BOTTOM DOCK
                </span>
                <span className="text-white font-bold">
                  Play / Pause · Step +1 Bar · Speed (1x–20x) · Session Jump (London / NY Open)
                </span>
              </div>
              <div className="text-[11px] text-sky-300 font-sans font-semibold">
                Tabs: Open Positions (BE / 50% / Close) · Pending · Closed · Trade Journal
              </div>
            </div>
          </div>

          {/* 6 Detailed Zone Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-[#161a22] border border-[#262b36] space-y-2">
              <div className="flex items-center gap-2 text-xs font-extrabold text-white">
                <span className="w-6 h-6 rounded-lg bg-[#2962ff]/20 text-[#2962ff] flex items-center justify-center font-mono">
                  1
                </span>
                <span>Top Bar (Navigation &amp; Market Sync)</span>
              </div>
              <p className="text-xs text-[#9ca3af] leading-relaxed">
                Click the <strong className="text-white">Session Pill</strong> to switch or create sessions, click the <strong className="text-amber-400">Symbol Selector</strong> (e.g. XAU/USD, NAS100, EUR/USD) to change markets, or click <strong className="text-white">1m – 1D</strong> to switch timeframes without losing your replay timestamp.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-[#161a22] border border-[#262b36] space-y-2">
              <div className="flex items-center gap-2 text-xs font-extrabold text-white">
                <span className="w-6 h-6 rounded-lg bg-purple-500/20 text-purple-400 flex items-center justify-center font-mono">
                  2
                </span>
                <span>Left Toolbar (Drawings &amp; R:R Box)</span>
              </div>
              <p className="text-xs text-[#9ca3af] leading-relaxed">
                Contains your technical drawing tools: <strong className="text-white">Trendlines</strong>, <strong className="text-white">Horizontal Rays</strong>, <strong className="text-white">Rectangles</strong> (for FVG / Supply &amp; Demand), and the interactive <strong className="text-emerald-400">Long &amp; Short Position R:R Tool</strong>.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-[#161a22] border border-[#262b36] space-y-2">
              <div className="flex items-center gap-2 text-xs font-extrabold text-white">
                <span className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-mono">
                  3
                </span>
                <span>Center Chart (Visual Execution)</span>
              </div>
              <p className="text-xs text-[#9ca3af] leading-relaxed">
                Displays historical candles strictly up to the replay clock. When you place a position or R:R drawing, you can <strong className="text-white">drag Entry, SL, and TP lines directly on the chart</strong>.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-[#161a22] border border-[#262b36] space-y-2">
              <div className="flex items-center gap-2 text-xs font-extrabold text-white">
                <span className="w-6 h-6 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center font-mono">
                  4
                </span>
                <span>Right Order Ticket &amp; Prop Rules</span>
              </div>
              <p className="text-xs text-[#9ca3af] leading-relaxed">
                Your execution panel for <strong className="text-emerald-400">LONG (Buy)</strong> and <strong className="text-rose-400">SHORT (Sell)</strong> orders. Toggle between <strong className="text-white">Lots</strong> and <strong className="text-white">Risk %</strong> calculator, and monitor live Prop Firm drawdown limits underneath.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-[#161a22] border border-[#262b36] space-y-2">
              <div className="flex items-center gap-2 text-xs font-extrabold text-white">
                <span className="w-6 h-6 rounded-lg bg-sky-500/20 text-sky-400 flex items-center justify-center font-mono">
                  5
                </span>
                <span>Bottom Replay &amp; Positions Dock</span>
              </div>
              <p className="text-xs text-[#9ca3af] leading-relaxed">
                Control time with <strong className="text-white">Play/Pause</strong>, <strong className="text-white">Step +1 Bar</strong>, or jump to <strong className="text-white">London / NY Open</strong>. Below the controls, manage open trades (<strong className="text-emerald-400">Break-Even</strong>, <strong className="text-amber-400">50% Close</strong>) and log your <strong className="text-white">Trade Journal</strong>.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-[#161a22] border border-[#262b36] space-y-2">
              <div className="flex items-center gap-2 text-xs font-extrabold text-white">
                <span className="w-6 h-6 rounded-lg bg-pink-500/20 text-pink-400 flex items-center justify-center font-mono">
                  6
                </span>
                <span>Dashboard &amp; Analytics Hub</span>
              </div>
              <p className="text-xs text-[#9ca3af] leading-relaxed">
                Click <strong className="text-white">Dashboard</strong> or <strong className="text-emerald-400">Analytics</strong> in the top-right bar to manage all your sessions, view your <strong className="text-white">Balance &amp; Equity Curve</strong>, <strong className="text-white">Daily P&amp;L Calendar</strong>, and 13 performance KPIs.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          PART 2: HOW TO SET UP YOUR FIRST SESSION
      ===================================================================== */}
      {showSetupSession && (
        <div className="rounded-2xl border border-[#242832] bg-[#12151b] p-5 sm:p-7 space-y-6 shadow-2xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#242832] pb-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 font-black text-sm flex items-center justify-center shrink-0">
                02
              </div>
              <div>
                <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-400 font-bold">
                  PART 2 · SESSION CONFIGURATION
                </span>
                <h3 className="text-lg sm:text-xl font-extrabold text-white">
                  How to Set Up Your First Backtest or Prop Firm Session
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
                  {isInsideApp
                    ? 'Open Create Session Modal'
                    : 'Create Your First Session Free'}
                </span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Step 1 */}
            <div className="p-5 rounded-xl bg-[#161a22] border border-[#262b36] flex flex-col justify-between space-y-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-1 rounded-md bg-emerald-500/15 text-emerald-400 font-mono font-bold text-xs">
                    STEP 1 OF 3
                  </span>
                  <FolderPlus className="w-5 h-5 text-emerald-400" />
                </div>
                <h4 className="text-base font-extrabold text-white">
                  Click &ldquo;Create New Session&rdquo; &amp; Pick Your Mode
                </h4>
                <p className="text-xs text-[#9ca3af] leading-relaxed">
                  From the <strong className="text-white">Dashboard left sidebar</strong>, click the green <strong className="text-emerald-400">+ Create New Session</strong> button (or click the active session pill in the top-left of the chart).
                </p>
              </div>

              {/* Visual Mini UI Mock */}
              <div className="p-3 rounded-xl bg-[#0d0f13] border border-[#242832] space-y-2 text-[11px]">
                <div className="text-[10px] font-mono uppercase text-gray-400">
                  Choose Session Mode:
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2 rounded-lg bg-emerald-500/15 border border-emerald-500/50 text-emerald-300 font-bold">
                    <div className="flex items-center gap-1">
                      <Zap className="w-3.5 h-3.5" /> Normal Backtest
                    </div>
                    <div className="text-[9px] text-gray-300 font-normal mt-0.5">
                      Rewind &amp; practice freely
                    </div>
                  </div>
                  <div className="p-2 rounded-lg bg-amber-500/15 border border-amber-500/50 text-amber-300 font-bold">
                    <div className="flex items-center gap-1">
                      <Trophy className="w-3.5 h-3.5" /> Prop Challenge
                    </div>
                    <div className="text-[9px] text-gray-300 font-normal mt-0.5">
                      FTMO, Topstep, 5%ers rules
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Step 2 */}
            <div className="p-5 rounded-xl bg-[#161a22] border border-[#262b36] flex flex-col justify-between space-y-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-1 rounded-md bg-[#2962ff]/20 text-blue-400 font-mono font-bold text-xs">
                    STEP 2 OF 3
                  </span>
                  <Sliders className="w-5 h-5 text-blue-400" />
                </div>
                <h4 className="text-base font-extrabold text-white">
                  Set Starting Balance, Markets &amp; Strategy
                </h4>
                <p className="text-xs text-[#9ca3af] leading-relaxed">
                  Select your account size (<strong className="text-white">$5K up to $200K</strong> or custom), choose the instruments you want in your watchlist (<strong className="text-white">XAUUSD, NAS100, EURUSD, GBPJPY</strong>), and tag your strategy playbook.
                </p>
              </div>

              {/* Visual Mini UI Mock */}
              <div className="p-3 rounded-xl bg-[#0d0f13] border border-[#242832] space-y-2 text-[11px] font-mono">
                <div className="flex items-center justify-between">
                  <span className="text-gray-400 text-[10px]">BALANCE:</span>
                  <div className="flex gap-1">
                    <span className="px-1.5 py-0.5 rounded bg-[#1a1e26] text-gray-400 text-[10px]">
                      $25K
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-[#1a1e26] text-gray-400 text-[10px]">
                      $50K
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-emerald-600 text-white font-bold text-[10px]">
                      $100K
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400 text-[10px]">WATCHLIST:</span>
                  <div className="flex gap-1">
                    <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold text-[10px]">
                      XAUUSD ✓
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold text-[10px]">
                      NAS100 ✓
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Step 3 */}
            <div className="p-5 rounded-xl bg-[#161a22] border border-[#262b36] flex flex-col justify-between space-y-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-1 rounded-md bg-amber-500/20 text-amber-400 font-mono font-bold text-xs">
                    STEP 3 OF 3
                  </span>
                  <Clock className="w-5 h-5 text-amber-400" />
                </div>
                <h4 className="text-base font-extrabold text-white">
                  Pick Historical Start Date &amp; Launch Session
                </h4>
                <p className="text-xs text-[#9ca3af] leading-relaxed">
                  Choose a historical date preset (<strong className="text-white">1 Year Ago, 6 Months, 1 Month</strong>) and session open time (<strong className="text-white">08:00 London</strong> or <strong className="text-white">13:00 NY Open</strong>), then click <strong className="text-emerald-400">Create &amp; Launch Session</strong>.
                </p>
              </div>

              {/* Visual Mini UI Mock */}
              <div className="p-3 rounded-xl bg-[#0d0f13] border border-[#242832] space-y-2 text-[11px]">
                <div className="flex items-center justify-between font-mono text-[10px]">
                  <span className="text-gray-400">START CLOCK:</span>
                  <span className="text-amber-400 font-bold">13:00 NY Open (UTC)</span>
                </div>
                <div className="w-full py-1.5 rounded-lg bg-emerald-600 text-white font-extrabold text-center text-xs flex items-center justify-center gap-1.5">
                  <Play className="w-3 h-3 fill-current" /> Create &amp; Launch Session
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          PART 3: HOW TO ADD YOUR FIRST BUY OR SELL TRADE
      ===================================================================== */}
      {showFirstTrade && (
        <div className="rounded-2xl border border-[#242832] bg-[#12151b] p-5 sm:p-7 space-y-6 shadow-2xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#242832] pb-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-400 font-black text-sm flex items-center justify-center shrink-0">
                03
              </div>
              <div>
                <span className="text-[10px] font-mono uppercase tracking-wider text-amber-400 font-bold">
                  PART 3 · EXECUTING &amp; MANAGING TRADES
                </span>
                <h3 className="text-lg sm:text-xl font-extrabold text-white">
                  How to Place Your First Buy or Sell Order (2 Easy Ways)
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
                <span>
                  {isInsideApp
                    ? 'Go to Chart & Place a Trade'
                    : 'Start Trading Free Now'}
                </span>
              </button>
            )}
          </div>

          {/* Two Execution Methods Side-by-Side */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Method A: Right Order Ticket */}
            <div className="p-5 rounded-2xl bg-[#161a22] border border-[#262b36] space-y-4 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-1 rounded-md bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-mono font-bold text-xs">
                    METHOD A · RIGHT ORDER TICKET
                  </span>
                  <span className="text-[11px] font-mono text-gray-400">
                    Fastest Execution
                  </span>
                </div>
                <h4 className="text-base font-extrabold text-white">
                  Place a Buy (Long) or Sell (Short) from the Right Order Panel
                </h4>

                <ol className="space-y-2.5 text-xs text-[#cbd5e1] leading-relaxed">
                  <li className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 font-mono font-bold text-[11px] flex items-center justify-center shrink-0 mt-0.5">
                      1
                    </span>
                    <span>
                      <strong>Select Direction:</strong> Click{' '}
                      <strong className="text-emerald-400">LONG / Buy</strong> (if you expect price to rise) or{' '}
                      <strong className="text-rose-400">SHORT / Sell</strong> (if you expect price to fall) at the top of the Right Order Ticket.
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 font-mono font-bold text-[11px] flex items-center justify-center shrink-0 mt-0.5">
                      2
                    </span>
                    <span>
                      <strong>Choose Order Type:</strong> Pick{' '}
                      <strong className="text-white">MARKET</strong> for an immediate fill at the current replay candle, or{' '}
                      <strong className="text-white">LIMIT / STOP</strong> to set a pending entry price.
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 font-mono font-bold text-[11px] flex items-center justify-center shrink-0 mt-0.5">
                      3
                    </span>
                    <span>
                      <strong>Size Your Risk &amp; Set SL / TP:</strong> Choose{' '}
                      <strong className="text-white">Risk %</strong> (e.g. <code>1.0%</code> — automatically calculates exact lots based on your Stop Loss distance) or enter{' '}
                      <strong className="text-white">Lots</strong> manually. Set your{' '}
                      <strong className="text-rose-400">Stop Loss</strong> and{' '}
                      <strong className="text-emerald-400">Take Profit</strong>.
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 font-mono font-bold text-[11px] flex items-center justify-center shrink-0 mt-0.5">
                      4
                    </span>
                    <span>
                      <strong>Click Execute:</strong> Press the{' '}
                      <strong className="text-emerald-400">Execute Market Buy</strong> (or Sell) button. Your trade immediately appears on the chart with draggable SL/TP lines!
                    </span>
                  </li>
                </ol>
              </div>

              {/* Mini Visual Order Ticket Preview */}
              <div className="p-3.5 rounded-xl bg-[#0d0f13] border border-[#242832] font-mono text-xs space-y-2.5">
                <div className="grid grid-cols-2 gap-2">
                  <div className="py-1.5 px-2 rounded-lg bg-emerald-600 text-white font-bold text-center flex items-center justify-center gap-1">
                    <ArrowUpRight className="w-3.5 h-3.5" /> LONG / Buy
                  </div>
                  <div className="py-1.5 px-2 rounded-lg bg-[#1a1e26] text-rose-400 border border-rose-500/30 font-bold text-center flex items-center justify-center gap-1">
                    <ArrowDownRight className="w-3.5 h-3.5" /> SHORT / Sell
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-1.5 text-[10px]">
                  <div className="p-1.5 rounded bg-[#161a22] border border-[#262b36]">
                    <div className="text-gray-400">RISK (1.0%)</div>
                    <div className="text-white font-bold">1.85 Lots</div>
                  </div>
                  <div className="p-1.5 rounded bg-[#161a22] border border-rose-500/30">
                    <div className="text-rose-400">STOP LOSS</div>
                    <div className="text-white font-bold">2,645.80</div>
                  </div>
                  <div className="p-1.5 rounded bg-[#161a22] border border-emerald-500/30">
                    <div className="text-emerald-400">TAKE PROFIT</div>
                    <div className="text-white font-bold">2,668.40</div>
                  </div>
                </div>
                <div className="py-2 rounded-lg bg-emerald-600 text-white font-sans font-extrabold text-center text-xs shadow-lg">
                  Execute Market Buy · 1.85 Lots (R:R 1 : 3.20)
                </div>
              </div>
            </div>

            {/* Method B: On-Chart Visual Position Tool + Replay Stepping */}
            <div className="p-5 rounded-2xl bg-[#161a22] border border-[#262b36] space-y-4 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-1 rounded-md bg-[#2962ff]/20 border border-[#2962ff]/40 text-blue-400 font-mono font-bold text-xs">
                    METHOD B · ON-CHART R:R POSITION TOOL
                  </span>
                  <span className="text-[11px] font-mono text-gray-400">
                    TradingView-Style Visual Box
                  </span>
                </div>
                <h4 className="text-base font-extrabold text-white">
                  Draw Your Setup on the Candles &amp; Click Execute on Chart
                </h4>

                <ol className="space-y-2.5 text-xs text-[#cbd5e1] leading-relaxed">
                  <li className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-[#2962ff]/20 text-blue-400 font-mono font-bold text-[11px] flex items-center justify-center shrink-0 mt-0.5">
                      1
                    </span>
                    <span>
                      <strong>Select Long or Short Tool:</strong> On the{' '}
                      <strong className="text-white">Left Toolbar</strong> (5th icon down), select{' '}
                      <strong className="text-emerald-400">Long Position (Buy R:R)</strong> or{' '}
                      <strong className="text-rose-400">Short Position (Sell R:R)</strong>.
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-[#2962ff]/20 text-blue-400 font-mono font-bold text-[11px] flex items-center justify-center shrink-0 mt-0.5">
                      2
                    </span>
                    <span>
                      <strong>Click on the Chart &amp; Drag Handles:</strong> Click on your entry candle. Drag the{' '}
                      <strong className="text-emerald-400">Green Take Profit box</strong> and{' '}
                      <strong className="text-rose-400">Red Stop Loss box</strong> to your key structure levels — the Right Order Ticket syncs automatically!
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-[#2962ff]/20 text-blue-400 font-mono font-bold text-[11px] flex items-center justify-center shrink-0 mt-0.5">
                      3
                    </span>
                    <span>
                      <strong>One-Click Chart Execution:</strong> Click{' '}
                      <strong className="text-emerald-400">&ldquo;Execute Market&rdquo;</strong> or{' '}
                      <strong className="text-blue-400">&ldquo;Place Limit&rdquo;</strong> right on the floating pill attached to your R:R drawing.
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-[#2962ff]/20 text-blue-400 font-mono font-bold text-[11px] flex items-center justify-center shrink-0 mt-0.5">
                      4
                    </span>
                    <span>
                      <strong>Step Forward &amp; Manage:</strong> Press{' '}
                      <strong className="text-white">Play</strong> or <strong className="text-white">Step +1 Bar</strong> in the Bottom Dock. Use <strong className="text-blue-400">BE</strong> to move Stop Loss to Break-Even or <strong className="text-amber-400">50%</strong> to take partial profits!
                    </span>
                  </li>
                </ol>
              </div>

              {/* Mini Visual On-Chart R:R Box Preview */}
              <div className="p-3.5 rounded-xl bg-[#0d0f13] border border-[#242832] font-mono text-xs space-y-2">
                <div className="rounded-lg overflow-hidden border border-white/10">
                  <div className="bg-[#089981]/25 border-b border-[#089981]/50 px-3 py-1.5 flex items-center justify-between text-[11px]">
                    <span className="text-emerald-300 font-bold">
                      TAKE PROFIT · 2,668.40
                    </span>
                    <span className="text-white font-bold">+3.20R (+$3,200)</span>
                  </div>
                  <div className="bg-[#141822] px-3 py-2 flex items-center justify-between text-[11px] border-b border-white/10">
                    <span className="text-white font-bold">
                      ENTRY · LONG XAU/USD @ 2,651.20
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span className="px-2 py-0.5 rounded bg-emerald-600 text-white text-[10px] font-bold">
                        Execute Market
                      </span>
                      <span className="px-2 py-0.5 rounded bg-[#2962ff] text-white text-[10px] font-bold">
                        Place Limit
                      </span>
                    </div>
                  </div>
                  <div className="bg-[#f23645]/20 px-3 py-1.5 flex items-center justify-between text-[11px]">
                    <span className="text-rose-300 font-bold">
                      STOP LOSS · 2,645.80
                    </span>
                    <span className="text-rose-300 font-bold">-1.00R (-$1,000)</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
