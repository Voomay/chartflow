import React from 'react';
import {
  Activity,
  ArrowRight,
  BarChart3,
  BrainCircuit,
  CheckCircle2,
  Compass,
  Globe,
  Layers,
  LineChart,
  LockOpen,
  Play,
  Scissors,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  Zap,
} from 'lucide-react';

interface LandingPageProps {
  onLaunchTerminal: (initialAction?: 'default' | 'replay' | 'analytics') => void;
  onOpenLogin: (mode?: 'login' | 'signup') => void;
  currentUser: { name: string; email: string } | null;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  onLaunchTerminal,
  onOpenLogin,
  currentUser,
}) => {
  return (
    <div className="h-screen w-screen bg-[#0b0e14] text-[#d1d4dc] font-sans overflow-y-auto custom-scrollbar selection:bg-blue-500/30 selection:text-blue-200">
      {/* Top Navbar */}
      <nav className="sticky top-0 z-50 backdrop-blur-xl bg-[#0b0e14]/85 border-b border-[#2a2e39]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Brand Logo */}
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#2962ff] via-indigo-500 to-emerald-400 flex items-center justify-center text-white font-black text-sm shadow-[0_0_20px_rgba(41,98,255,0.45)]">
              CF
            </div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-lg tracking-tight text-white">
                CHART <span className="text-[#2962ff]">FLOW</span>
              </span>
              <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                100% FREE
              </span>
            </div>
          </div>

          {/* Center Nav Links */}
          <div className="hidden md:flex items-center gap-7 text-xs font-semibold text-[#787b86]">
            <a href="#features" className="hover:text-white transition">
              Free Backtesting
            </a>
            <a href="#strategy" className="hover:text-white transition">
              Strategy Tester
            </a>
            <a href="#analytics" className="hover:text-white transition">
              Free Analytics
            </a>
            <a href="#tools" className="hover:text-white transition">
              Chart Analysis Tools
            </a>
            <a href="#compare" className="hover:text-white transition">
              Why 100% Free?
            </a>
          </div>

          {/* Right CTAs */}
          <div className="flex items-center gap-2.5">
            {currentUser ? (
              <button
                onClick={() => onOpenLogin('login')}
                className="px-3.5 py-2 rounded-lg text-xs font-semibold bg-[#1e222d] hover:bg-[#262b38] text-gray-200 border border-[#2a2e39] transition"
              >
                {currentUser.name}
              </button>
            ) : (
              <>
                <button
                  onClick={() => onOpenLogin('login')}
                  className="px-3.5 py-2 rounded-lg text-xs font-semibold text-gray-300 hover:text-white hover:bg-[#1e222d] transition"
                >
                  Log In
                </button>
                <button
                  onClick={() => onOpenLogin('signup')}
                  className="hidden sm:inline-flex px-3.5 py-2 rounded-lg text-xs font-semibold bg-[#1e222d] hover:bg-[#262b38] text-white border border-[#2a2e39] transition"
                >
                  Free Sign Up
                </button>
              </>
            )}

            <button
              onClick={() => onLaunchTerminal('default')}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold bg-[#2962ff] hover:bg-[#1e53e5] text-white shadow-[0_0_20px_rgba(41,98,255,0.4)] transition"
            >
              <span>Launch Terminal</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-14 pb-20 overflow-hidden">
        {/* Ambient Glows */}
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[850px] h-[420px] bg-[#2962ff]/15 blur-[130px] rounded-full pointer-events-none" />
        <div className="absolute top-40 right-10 w-[360px] h-[360px] bg-emerald-500/10 blur-[120px] rounded-full pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center max-w-4xl mx-auto">
            {/* Top Pill */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#131722] border border-[#2a2e39] text-xs font-medium text-gray-300 mb-6 shadow-lg">
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              <span>
                Everything is <strong className="text-emerald-400">100% Free Forever</strong> — No
                Paywalls, No Trial Limits, No Credit Card
              </span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight text-white leading-[1.12] mb-6">
              Free Backtesting, Strategy Testing &{' '}
              <span className="bg-gradient-to-r from-[#2962ff] via-sky-400 to-emerald-400 bg-clip-text text-transparent">
                Chart Analysis Tools.
              </span>
            </h1>

            <p className="text-base sm:text-lg text-[#9ca3af] max-w-2xl mx-auto leading-relaxed mb-8">
              Welcome to <strong className="text-white">Chart Flow</strong>. Rewind any market to
              any candle, test your strategy with interactive Long/Short position boxes, track deep
              performance analytics, and use institutional chart analysis tools — all completely
              free.
            </p>

            {/* Primary Hero CTAs */}
            <div className="flex flex-wrap items-center justify-center gap-3.5 mb-10">
              <button
                onClick={() => onLaunchTerminal('default')}
                className="flex items-center gap-2 px-7 py-3.5 rounded-xl text-sm font-bold bg-[#2962ff] hover:bg-[#1e53e5] text-white shadow-[0_0_30px_rgba(41,98,255,0.45)] transition transform hover:-translate-y-0.5"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>Start Free Backtesting Now</span>
              </button>

              <button
                onClick={() => onOpenLogin('signup')}
                className="flex items-center gap-2 px-6 py-3.5 rounded-xl text-sm font-bold bg-[#131722] hover:bg-[#1e222d] text-white border border-[#2a2e39] transition"
              >
                <LockOpen className="w-4 h-4 text-emerald-400" />
                <span>{currentUser ? 'Account & Settings' : 'Log In / Free Account'}</span>
              </button>
            </div>

            {/* 4 Quick Guarantee Badges */}
            <div className="flex flex-wrap items-center justify-center gap-6 text-xs text-gray-400 font-medium">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Free Unlimited Bar Replay</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Free Strategy Tester ($100k Sim)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Free Performance Analytics</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Free Institutional Drawing Tools</span>
              </div>
            </div>
          </div>

          {/* Interactive Terminal Preview Card */}
          <div className="mt-12 rounded-2xl border border-[#2a2e39] bg-[#131722] shadow-[0_25px_70px_rgba(0,0,0,0.65)] overflow-hidden">
            {/* Mock Terminal Header */}
            <div className="h-11 px-4 bg-[#171b26] border-b border-[#2a2e39] flex items-center justify-between text-xs">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500/80" />
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80" />
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
                </div>
                <span className="font-mono font-bold text-white">
                  CHART FLOW TERMINAL · XAU/USD · NAS100 · EUR/USD · GBP/USD
                </span>
                <span className="hidden sm:inline-block px-2 py-0.5 rounded bg-[#2962ff]/20 text-[#2962ff] font-mono text-[10px] font-bold">
                  1m · 5m · 15m · 1H · 4H · 1D
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 font-mono text-[10px] font-bold">
                  $0.00 / FREE FOREVER
                </span>
              </div>
            </div>

            {/* Mock Terminal Visual Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 bg-[#0b0e14]">
              {/* Simulated Chart & Position Box Area */}
              <div className="lg:col-span-8 p-6 border-b lg:border-b-0 lg:border-r border-[#2a2e39] flex flex-col justify-between relative overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-6">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-extrabold text-white">
                        Interactive Strategy Backtesting
                      </span>
                      <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30">
                        BAR REPLAY ACTIVE
                      </span>
                    </div>
                    <p className="text-xs text-[#787b86] mt-0.5">
                      Draw Long/Short projections, drag TP/SL handles, execute Pending or Market
                      orders, and step forward candle-by-candle.
                    </p>
                  </div>

                  <button
                    onClick={() => onLaunchTerminal('replay')}
                    className="px-3.5 py-1.5 rounded-lg bg-[#2962ff] hover:bg-[#1e53e5] text-white text-xs font-bold transition"
                  >
                    Try Bar Replay Free →
                  </button>
                </div>

                {/* Visual Candlestick + Position R:R Graphic */}
                <div className="relative h-64 rounded-xl bg-[#131722] border border-[#2a2e39] p-4 flex items-center justify-between overflow-hidden">
                  {/* Grid Lines */}
                  <div
                    className="absolute inset-0 opacity-20"
                    style={{
                      backgroundImage:
                        'linear-gradient(to right, #2a2e39 1px, transparent 1px), linear-gradient(to bottom, #2a2e39 1px, transparent 1px)',
                      backgroundSize: '48px 40px',
                    }}
                  />

                  {/* Simulated Candlesticks */}
                  <div className="relative z-10 flex items-end gap-2.5 h-44 pl-2">
                    {[
                      { h: 55, bull: true, y: 10 },
                      { h: 40, bull: false, y: 15 },
                      { h: 70, bull: true, y: 24 },
                      { h: 50, bull: true, y: 42 },
                      { h: 38, bull: false, y: 34 },
                      { h: 64, bull: true, y: 52 },
                      { h: 78, bull: true, y: 74 },
                      { h: 45, bull: false, y: 66 },
                      { h: 86, bull: true, y: 88 },
                      { h: 95, bull: true, y: 108 },
                    ].map((bar, i) => (
                      <div
                        key={i}
                        className="flex flex-col items-center"
                        style={{ marginBottom: `${bar.y * 0.45}px` }}
                      >
                        <div
                          className={`w-0.5 h-3 ${
                            bar.bull ? 'bg-[#2962ff]' : 'bg-[#f23645]'
                          }`}
                        />
                        <div
                          className={`w-3.5 rounded-sm ${
                            bar.bull
                              ? 'bg-[#2962ff] shadow-[0_0_8px_rgba(41,98,255,0.4)]'
                              : 'bg-[#f23645]'
                          }`}
                          style={{ height: `${bar.h * 0.7}px` }}
                        />
                        <div
                          className={`w-0.5 h-3 ${
                            bar.bull ? 'bg-[#2962ff]' : 'bg-[#f23645]'
                          }`}
                        />
                      </div>
                    ))}
                  </div>

                  {/* Simulated TradingView Long Position Box Overlay */}
                  <div className="relative z-10 flex-1 max-w-sm ml-6 rounded-lg overflow-hidden border border-[#2a2e39] shadow-2xl font-mono">
                    <div className="bg-[#089981]/25 border-b border-[#089981] px-3 py-2 flex items-center justify-between text-[11px]">
                      <span className="text-emerald-300 font-bold">
                        TARGET PROFIT (+3.20R)
                      </span>
                      <span className="text-white font-bold">+$3,200.00</span>
                    </div>
                    <div className="bg-[#2962ff]/20 px-3 py-2 flex items-center justify-between text-xs border-b border-[#2962ff]">
                      <span className="text-blue-300 font-bold">
                        ENTRY · 1.00 LOT LONG
                      </span>
                      <span className="text-emerald-400 font-extrabold">
                        Open PnL: +$2,140.00
                      </span>
                    </div>
                    <div className="bg-[#f23645]/20 px-3 py-1.5 flex items-center justify-between text-[11px]">
                      <span className="text-rose-300 font-bold">STOP LOSS (-1.00R)</span>
                      <span className="text-rose-300 font-bold">-$1,000.00</span>
                    </div>
                  </div>
                </div>

                {/* Bottom Transport Preview */}
                <div className="mt-4 flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-[#2a2e39] text-xs font-mono">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded bg-amber-500 text-[#0b0e14] font-bold flex items-center gap-1">
                      <Scissors className="w-3.5 h-3.5" /> Rewind to Bar
                    </span>
                    <span className="px-2.5 py-1 rounded bg-[#1e222d] text-gray-300 border border-[#2a2e39]">
                      -1 Bar
                    </span>
                    <span className="px-2.5 py-1 rounded bg-[#2962ff] text-white font-bold">
                      Play (1x – 10x)
                    </span>
                    <span className="px-2.5 py-1 rounded bg-[#1e222d] text-gray-300 border border-[#2a2e39]">
                      +1 Bar
                    </span>
                  </div>
                  <span className="text-emerald-400 font-bold">
                    Market & Pending Orders Included Free
                  </span>
                </div>
              </div>

              {/* Right Column: Live Analytics & Free Tools Summary */}
              <div className="lg:col-span-4 p-6 flex flex-col justify-between bg-[#131722]">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 font-mono">
                      Free Strategy Analytics
                    </span>
                    <span className="text-[11px] font-mono text-[#787b86]">
                      REAL-TIME METRICS
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mb-4 font-mono">
                    <div className="p-3 rounded-xl bg-[#1e222d] border border-[#2a2e39]">
                      <span className="text-[10px] text-[#787b86] block">WIN RATE</span>
                      <span className="text-lg font-black text-emerald-400">68.4%</span>
                      <span className="text-[10px] text-gray-400 block">26W / 12L</span>
                    </div>
                    <div className="p-3 rounded-xl bg-[#1e222d] border border-[#2a2e39]">
                      <span className="text-[10px] text-[#787b86] block">PROFIT FACTOR</span>
                      <span className="text-lg font-black text-[#2962ff]">2.84</span>
                      <span className="text-[10px] text-gray-400 block">Avg +2.4R Win</span>
                    </div>
                    <div className="p-3 rounded-xl bg-[#1e222d] border border-[#2a2e39]">
                      <span className="text-[10px] text-[#787b86] block">SIM EQUITY</span>
                      <span className="text-lg font-black text-white">$114,820</span>
                      <span className="text-[10px] text-emerald-400 block">+14.82% Gain</span>
                    </div>
                    <div className="p-3 rounded-xl bg-[#1e222d] border border-[#2a2e39]">
                      <span className="text-[10px] text-[#787b86] block">BEST SESSION</span>
                      <span className="text-lg font-black text-amber-400">London/NY</span>
                      <span className="text-[10px] text-gray-400 block">74% Win Rate</span>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-[#171b26] border border-[#2a2e39] space-y-2 text-xs">
                    <div className="font-bold text-white flex items-center gap-1.5">
                      <BrainCircuit className="w-4 h-4 text-amber-400" />
                      <span>AI Market Confluence & Session Boxes</span>
                    </div>
                    <p className="text-[#9ca3af] text-[11px] leading-relaxed">
                      Automatic Sydney, Tokyo, London & New York session boxes, institutional
                      support/resistance levels, EMA 20/50, VWAP, and macro sentiment scoring.
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => onLaunchTerminal('analytics')}
                  className="mt-5 w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-[#0b0e14] font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-lg transition"
                >
                  <BarChart3 className="w-4 h-4" />
                  <span>Open Free Analytics & Strategy Tester</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4 Core Pillars Section */}
      <section id="features" className="py-16 border-t border-[#2a2e39] bg-[#0f131d]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <span className="text-xs font-mono uppercase tracking-widest text-[#2962ff] font-bold">
              BUILT FOR TRADERS WHO WANT ZERO PAYWALLS
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-white mt-2">
              Everything You Need to Build Your Edge. Everything is Free.
            </h2>
            <p className="text-sm text-[#9ca3af] mt-3">
              Other platforms charge $35 to $60 every month just to rewind candles or place
              backtest trades. On Chart Flow, every single feature is unlocked from day one.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Pillar 1 */}
            <div
              id="strategy"
              className="p-6 rounded-2xl bg-[#131722] border border-[#2a2e39] hover:border-[#2962ff]/60 transition flex flex-col justify-between"
            >
              <div>
                <div className="w-11 h-11 rounded-xl bg-[#2962ff]/15 border border-[#2962ff]/40 flex items-center justify-center text-[#2962ff] mb-4">
                  <Scissors className="w-5 h-5" />
                </div>
                <div className="inline-block text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 mb-2">
                  100% FREE BACKTESTING
                </div>
                <h3 className="text-lg font-bold text-white mb-2">
                  Bar-by-Bar Historical Replay
                </h3>
                <p className="text-xs text-[#9ca3af] leading-relaxed">
                  Click any historical bar with the Scissor tool to rewind time. Step forward 1
                  candle at a time or auto-play from 0.5x to 10x speed across 1m, 5m, 15m, 30m, 1H,
                  4H, and 1D timeframes.
                </p>
              </div>
              <button
                onClick={() => onLaunchTerminal('replay')}
                className="mt-5 text-xs font-bold text-[#2962ff] hover:text-blue-400 flex items-center gap-1"
              >
                Launch Bar Replay <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Pillar 2 */}
            <div className="p-6 rounded-2xl bg-[#131722] border border-[#2a2e39] hover:border-emerald-500/60 transition flex flex-col justify-between">
              <div>
                <div className="w-11 h-11 rounded-xl bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center text-emerald-400 mb-4">
                  <Target className="w-5 h-5" />
                </div>
                <div className="inline-block text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 mb-2">
                  100% FREE STRATEGY TESTER
                </div>
                <h3 className="text-lg font-bold text-white mb-2">
                  Test Your Strategy Live & Historical
                </h3>
                <p className="text-xs text-[#9ca3af] leading-relaxed">
                  Practice with a resettable $100,000 simulator. Place Market or Pending orders directly
                  from Long/Short R:R projection boxes on the chart and drag Stop Loss & Take Profit
                  lines dynamically.
                </p>
              </div>
              <button
                onClick={() => onLaunchTerminal('default')}
                className="mt-5 text-xs font-bold text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
              >
                Test a Strategy Now <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Pillar 3 */}
            <div
              id="analytics"
              className="p-6 rounded-2xl bg-[#131722] border border-[#2a2e39] hover:border-amber-500/60 transition flex flex-col justify-between"
            >
              <div>
                <div className="w-11 h-11 rounded-xl bg-amber-500/15 border border-amber-500/40 flex items-center justify-center text-amber-400 mb-4">
                  <BarChart3 className="w-5 h-5" />
                </div>
                <div className="inline-block text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 mb-2">
                  100% FREE ANALYTICS
                </div>
                <h3 className="text-lg font-bold text-white mb-2">
                  Deep Performance & Session Analytics
                </h3>
                <p className="text-xs text-[#9ca3af] leading-relaxed">
                  Automatically calculates your Win Rate, Profit Factor, Expectancy, R-Multiple
                  distribution, Equity Curve, Long vs. Short accuracy, and which global session pays
                  you the most.
                </p>
              </div>
              <button
                onClick={() => onLaunchTerminal('analytics')}
                className="mt-5 text-xs font-bold text-amber-400 hover:text-amber-300 flex items-center gap-1"
              >
                View Analytics Suite <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Pillar 4 */}
            <div
              id="tools"
              className="p-6 rounded-2xl bg-[#131722] border border-[#2a2e39] hover:border-purple-500/60 transition flex flex-col justify-between"
            >
              <div>
                <div className="w-11 h-11 rounded-xl bg-purple-500/15 border border-purple-500/40 flex items-center justify-center text-purple-400 mb-4">
                  <Compass className="w-5 h-5" />
                </div>
                <div className="inline-block text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 mb-2">
                  100% FREE CHART ANALYSIS
                </div>
                <h3 className="text-lg font-bold text-white mb-2">
                  Pro Drawing Tools & AI Confluence
                </h3>
                <p className="text-xs text-[#9ca3af] leading-relaxed">
                  Full drawing toolkit (Fibonacci, Orderblocks, Trendlines, Rays, Brush, Price
                  Ruler, Magnet Snap), Killzone Session Boxes (Sydney, Tokyo, London, NY), and AI
                  Sentiment analysis.
                </p>
              </div>
              <button
                onClick={() => onLaunchTerminal('default')}
                className="mt-5 text-xs font-bold text-purple-400 hover:text-purple-300 flex items-center gap-1"
              >
                Open Charting Tools <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Comparison Section: Why Chart Flow */}
      <section id="compare" className="py-16 border-t border-[#2a2e39] bg-[#0b0e14]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <h2 className="text-2xl sm:text-3xl font-black text-white">
              Stop Paying Monthly Subscriptions to Backtest
            </h2>
            <p className="text-xs sm:text-sm text-[#9ca3af] mt-2">
              Chart Flow gives every trader institutional-grade replay, execution, and analytics for
              $0.
            </p>
          </div>

          <div className="rounded-2xl border border-[#2a2e39] bg-[#131722] overflow-hidden shadow-xl">
            <table className="w-full text-left border-collapse text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-[#2a2e39] bg-[#171b26] font-mono">
                  <th className="py-4 px-4 sm:px-6 text-[#787b86]">FEATURE</th>
                  <th className="py-4 px-4 sm:px-6 text-emerald-400 font-black">
                    CHART FLOW (FREE)
                  </th>
                  <th className="py-4 px-4 sm:px-6 text-[#787b86]">TYPICAL PAID PLATFORMS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2a2e39]">
                {[
                  [
                    'Intraday Bar Replay (1m, 5m, 15m, 1H)',
                    '100% Free Unlimited',
                    '$35 – $60 / month',
                  ],
                  [
                    'On-Chart Long/Short Order Execution & Pending Orders',
                    '100% Free Unlimited',
                    'Paid Tier Only',
                  ],
                  [
                    'Strategy Analytics (Win Rate, Profit Factor, R-Multiple)',
                    '100% Free Unlimited',
                    'Paid Add-on',
                  ],
                  [
                    'Global Session Killzone Boxes (Asia, London, NY)',
                    '100% Free Built-In',
                    'Custom Scripts / Paid',
                  ],
                  [
                    'Multi-Asset Pairs (XAU/USD, NAS100, GER30, Majors)',
                    '100% Free Included',
                    'Extra Data Fees',
                  ],
                ].map(([feat, us, them], i) => (
                  <tr key={i} className="hover:bg-[#1e222d]/50">
                    <td className="py-3.5 px-4 sm:px-6 font-medium text-white">{feat}</td>
                    <td className="py-3.5 px-4 sm:px-6 font-mono font-bold text-emerald-400">
                      ✓ {us}
                    </td>
                    <td className="py-3.5 px-4 sm:px-6 font-mono text-[#787b86]">{them}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Bottom CTA Banner */}
          <div className="mt-12 p-8 rounded-2xl bg-gradient-to-r from-[#131722] via-[#1a233a] to-[#131722] border border-[#2962ff]/40 text-center">
            <h3 className="text-2xl font-black text-white mb-2">
              Ready to Test Your Strategy on Chart Flow?
            </h3>
            <p className="text-xs sm:text-sm text-gray-300 mb-6 max-w-xl mx-auto">
              Jump straight into the terminal without signing up, or log in to save your custom
              workspace and strategy journal locally.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <button
                onClick={() => onLaunchTerminal('default')}
                className="px-6 py-3 rounded-xl bg-[#2962ff] hover:bg-[#1e53e5] text-white font-bold text-xs sm:text-sm shadow-lg transition"
              >
                Launch Free Terminal Now →
              </button>
              <button
                onClick={() => onOpenLogin('login')}
                className="px-6 py-3 rounded-xl bg-[#1e222d] hover:bg-[#262b38] text-white border border-[#2a2e39] font-bold text-xs sm:text-sm transition"
              >
                Go to Login Page
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t border-[#2a2e39] bg-[#0b0e14] text-center text-xs text-[#787b86]">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-[#2962ff] flex items-center justify-center text-white font-black text-[10px]">
              CF
            </div>
            <span className="font-bold text-white">Chart Flow</span>
            <span>— 100% Free Backtesting, Strategy Testing & Chart Analysis Platform</span>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => onLaunchTerminal('default')}
              className="hover:text-white transition"
            >
              Terminal
            </button>
            <button
              onClick={() => onOpenLogin('login')}
              className="hover:text-white transition"
            >
              Login
            </button>
            <button
              onClick={() => onOpenLogin('signup')}
              className="hover:text-white transition"
            >
              Free Account
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
};
