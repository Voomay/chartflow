import React, { useState } from 'react';
import {
  ArrowRight,
  BarChart3,
  CandlestickChart,
  CheckCircle2,
  Menu,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  Trophy,
  X,
  Zap,
} from 'lucide-react';

export type LandingLaunchAction =
  | 'default'
  | 'replay'
  | 'prop_firm'
  | 'new_backtest'
  | 'analytics'
  | 'dashboard';

interface LandingPageProps {
  onLaunchTerminal: (initialAction?: LandingLaunchAction) => void;
  onOpenLogin: (mode?: 'login' | 'signup') => void;
  currentUser: { name: string; email: string } | null;
}

const DEMO_CHART_CANDLES = [
  { o: 2636.4, h: 2639.2, l: 2635.1, c: 2638.5 },
  { o: 2638.5, h: 2641.8, l: 2637.6, c: 2640.9 },
  { o: 2640.9, h: 2641.5, l: 2637.2, c: 2638.1 },
  { o: 2638.1, h: 2642.4, l: 2637.8, c: 2641.7 },
  { o: 2641.7, h: 2645.0, l: 2640.9, c: 2644.2 },
  { o: 2644.2, h: 2644.8, l: 2641.0, c: 2642.0 },
  { o: 2642.0, h: 2646.9, l: 2641.5, c: 2646.1 },
  { o: 2646.1, h: 2649.4, l: 2645.2, c: 2648.6 },
  { o: 2648.6, h: 2649.2, l: 2645.4, c: 2646.2 },
  { o: 2646.2, h: 2651.8, l: 2645.8, c: 2651.2 },
  { o: 2651.2, h: 2654.6, l: 2650.1, c: 2653.8 },
  { o: 2653.8, h: 2654.2, l: 2650.9, c: 2652.1 },
  { o: 2652.1, h: 2656.8, l: 2651.7, c: 2656.0 },
  { o: 2656.0, h: 2659.5, l: 2655.1, c: 2658.7 },
  { o: 2658.7, h: 2662.4, l: 2657.8, c: 2661.5 },
  { o: 2661.5, h: 2662.1, l: 2658.9, c: 2660.2 },
  { o: 2660.2, h: 2665.8, l: 2659.8, c: 2664.9 },
  { o: 2664.9, h: 2668.9, l: 2664.1, c: 2668.1 },
  { o: 2668.1, h: 2671.6, l: 2667.2, c: 2670.8 },
];

const DEMO_EQUITY_POINTS = [
  100000, 100850, 100190, 101780, 102650, 101420, 100240, 103100, 104420,
  103390, 105680, 106950, 105890, 108120, 109860,
];

const FEATURES = [
  {
    icon: CandlestickChart,
    title: 'Bar-by-Bar Replay',
    desc: 'Step through deterministic 1-minute history with zero lookahead across synced 1m–1D timeframes.',
    accent: 'from-[#2962ff] to-sky-400',
  },
  {
    icon: Trophy,
    title: 'Prop Firm Simulator',
    desc: 'Practice FTMO-style evaluations with real daily loss, max drawdown and profit target rules.',
    accent: 'from-emerald-400 to-teal-400',
  },
  {
    icon: Target,
    title: 'Risk-Based Execution',
    desc: 'Draw R:R setups on the chart and fire Market, Limit or Stop orders auto-sized by risk %.',
    accent: 'from-amber-400 to-orange-400',
  },
  {
    icon: BarChart3,
    title: 'Deep Analytics & Journal',
    desc: 'Equity curves, P&L calendar, win rate, profit factor, R-multiples and CSV export for every trade.',
    accent: 'from-fuchsia-400 to-violet-500',
  },
];

const ANALYTICS_KPIS = [
  { label: 'Net P&L', value: '+$9,860', tone: 'text-emerald-400' },
  { label: 'Win Rate', value: '71.4%', tone: 'text-white' },
  { label: 'Profit Factor', value: '2.84', tone: 'text-sky-400' },
  { label: 'Max Drawdown', value: '2.35%', tone: 'text-rose-400' },
];

/* ---------- Small presentational helpers ---------- */

const HeroChart: React.FC = () => {
  const W = 380;
  const H = 200;
  const min = 2634;
  const max = 2673;
  const y = (v: number) => H - 14 - ((v - min) / (max - min)) * (H - 28);
  const step = (W - 40) / DEMO_CHART_CANDLES.length;
  const entryY = y(2651.2);
  const tpY = y(2670.8);
  const slY = y(2645.8);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto block" role="img" aria-label="Replay chart preview">
      <defs>
        <linearGradient id="lp-tp" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#10b981" stopOpacity="0.28" />
          <stop offset="100%" stopColor="#10b981" stopOpacity="0.04" />
        </linearGradient>
        <linearGradient id="lp-sl" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f23645" stopOpacity="0.05" />
          <stop offset="100%" stopColor="#f23645" stopOpacity="0.25" />
        </linearGradient>
        <linearGradient id="lp-ema" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#2962ff" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#34d399" />
        </linearGradient>
      </defs>

      {[40, 80, 120, 160].map((gy) => (
        <line key={gy} x1="0" y1={gy} x2={W - 40} y2={gy} stroke="#1c2433" strokeDasharray="3 4" />
      ))}

      {/* R:R position box */}
      <rect x={step * 9 + 4} y={tpY} width={W - 40 - step * 9 - 4} height={entryY - tpY} fill="url(#lp-tp)" stroke="#10b981" strokeOpacity="0.45" rx="3" />
      <rect x={step * 9 + 4} y={entryY} width={W - 40 - step * 9 - 4} height={slY - entryY} fill="url(#lp-sl)" stroke="#f23645" strokeOpacity="0.45" rx="3" />
      <line x1={step * 9 + 4} y1={entryY} x2={W - 40} y2={entryY} stroke="#38bdf8" strokeWidth="1.2" />

      <path
        d={`M 8 ${y(2637)} Q 90 ${y(2640)}, 150 ${y(2645)} T 260 ${y(2655)} T ${W - 44} ${y(2667)}`}
        fill="none"
        stroke="url(#lp-ema)"
        strokeWidth="2"
      />

      {DEMO_CHART_CANDLES.map((c, i) => {
        const cx = 10 + i * step + step / 2 - 4;
        const bull = c.c >= c.o;
        const color = bull ? '#10b981' : '#f23645';
        const top = y(Math.max(c.o, c.c));
        const h = Math.max(2, Math.abs(y(c.o) - y(c.c)));
        return (
          <g key={i}>
            <line x1={cx} y1={y(c.h)} x2={cx} y2={y(c.l)} stroke={color} strokeWidth="1.2" />
            <rect x={cx - 4} y={top} width="8" height={h} rx="1.5" fill={color} />
          </g>
        );
      })}

      <line x1="0" y1={tpY} x2={W - 40} y2={tpY} stroke="#10b981" strokeDasharray="3 3" strokeOpacity="0.7" />
      <rect x={W - 38} y={tpY - 8} width="36" height="16" rx="3" fill="#10b981" />
      <text x={W - 34} y={tpY + 3.5} fill="#fff" fontSize="9" fontWeight="bold" fontFamily="monospace">
        2670.8
      </text>
      <rect x={step * 9 + 10} y={tpY + 6} width="78" height="16" rx="3" fill="#064e3b" fillOpacity="0.9" />
      <text x={step * 9 + 15} y={tpY + 17.5} fill="#6ee7b7" fontSize="9" fontWeight="bold" fontFamily="monospace">
        TP · +3.4R
      </text>
    </svg>
  );
};

const EquityCurve: React.FC = () => {
  const W = 320;
  const H = 120;
  const min = Math.min(...DEMO_EQUITY_POINTS) - 400;
  const max = Math.max(...DEMO_EQUITY_POINTS) + 400;
  const pts = DEMO_EQUITY_POINTS.map((v, i) => {
    const x = (i / (DEMO_EQUITY_POINTS.length - 1)) * W;
    const yy = H - ((v - min) / (max - min)) * H;
    return [x, yy] as const;
  });
  const line = pts.map(([x, yy], i) => `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${yy.toFixed(1)}`).join(' ');
  const area = `${line} L ${W} ${H} L 0 ${H} Z`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="w-full h-32 sm:h-40 block" aria-hidden="true">
      <defs>
        <linearGradient id="lp-eq-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#10b981" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="lp-eq-line" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#38bdf8" />
          <stop offset="100%" stopColor="#34d399" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#lp-eq-fill)" />
      <path d={line} fill="none" stroke="url(#lp-eq-line)" strokeWidth="2.5" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
};

/* ---------- Page ---------- */

export const LandingPage: React.FC<LandingPageProps> = ({ onOpenLogin }) => {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const scrollToSection = (id: string) => {
    setMobileNavOpen(false);
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const openAuth = (mode: 'login' | 'signup') => {
    setMobileNavOpen(false);
    onOpenLogin(mode);
  };

  const navLinks = [
    { id: 'features', label: 'Features' },
    { id: 'analytics', label: 'Analytics' },
    { id: 'get-started', label: 'Get Started' },
  ];

  return (
    <div className="h-[100dvh] w-full bg-[#06080d] text-[#d1d4dc] font-sans overflow-y-auto overflow-x-hidden custom-scrollbar selection:bg-emerald-500/30 selection:text-emerald-100 dark-modal relative scroll-smooth">
      {/* Ambient gradient background */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden="true">
        <div className="lp-grid absolute inset-0 opacity-[0.05]" />
        <div className="lp-blob absolute -top-40 left-1/2 -translate-x-1/2 w-[min(900px,140vw)] h-[480px] rounded-full bg-[radial-gradient(closest-side,rgba(41,98,255,0.35),transparent)]" />
        <div className="lp-blob lp-blob-delay absolute top-1/3 -left-40 w-[520px] h-[520px] rounded-full bg-[radial-gradient(closest-side,rgba(16,185,129,0.22),transparent)]" />
        <div className="lp-blob absolute bottom-[-10%] -right-40 w-[560px] h-[560px] rounded-full bg-[radial-gradient(closest-side,rgba(20,184,166,0.2),transparent)]" />
      </div>

      {/* Navigation */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-[#06080d]/75 border-b border-white/[0.06]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          <button
            onClick={() => scrollToSection('top')}
            className="flex items-center gap-2.5 min-h-[44px] min-w-0"
            aria-label="Chart Replay home"
          >
            <div className="w-9 h-9 shrink-0 rounded-xl bg-gradient-to-br from-[#2962ff] via-sky-500 to-emerald-400 flex items-center justify-center text-white font-black text-xs shadow-[0_0_24px_rgba(41,98,255,0.45)] ring-1 ring-white/20">
              CR
            </div>
            <span className="font-extrabold text-sm sm:text-base tracking-tight text-white truncate">
              CHART{' '}
              <span className="bg-gradient-to-r from-sky-400 to-emerald-400 bg-clip-text text-transparent">REPLAY</span>
            </span>
          </button>

          <nav className="hidden md:flex items-center gap-1 text-sm font-semibold text-gray-300">
            {navLinks.map((l) => (
              <button
                key={l.id}
                onClick={() => scrollToSection(l.id)}
                className="px-3 py-2 rounded-lg hover:text-white hover:bg-white/[0.05] transition"
              >
                {l.label}
              </button>
            ))}
          </nav>

          <div className="hidden md:flex items-center gap-2">
            <button
              onClick={() => openAuth('login')}
              className="px-4 py-2.5 rounded-xl text-sm font-semibold text-gray-300 hover:text-white hover:bg-white/[0.06] transition"
            >
              Sign In
            </button>
            <button onClick={() => openAuth('signup')} className="lp-btn-primary px-4 py-2.5 text-sm">
              <span>Sign Up Free</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={() => setMobileNavOpen((o) => !o)}
            className="md:hidden inline-flex items-center justify-center w-11 h-11 rounded-xl border border-white/10 bg-white/[0.04] text-white hover:bg-white/[0.08] transition"
            aria-label={mobileNavOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileNavOpen}
          >
            {mobileNavOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {mobileNavOpen && (
          <div className="md:hidden border-t border-white/[0.06] bg-[#080b12]/95 backdrop-blur-xl lp-fade-in">
            <div className="px-4 py-3 flex flex-col gap-1">
              {navLinks.map((l) => (
                <button
                  key={l.id}
                  onClick={() => scrollToSection(l.id)}
                  className="text-left px-3 min-h-[44px] rounded-xl text-base font-semibold text-gray-200 hover:bg-white/[0.06] transition"
                >
                  {l.label}
                </button>
              ))}
              <div className="grid grid-cols-2 gap-2 pt-2 pb-1">
                <button
                  onClick={() => openAuth('login')}
                  className="min-h-[44px] rounded-xl text-sm font-semibold text-white border border-white/15 bg-white/[0.04] hover:bg-white/[0.08] transition"
                >
                  Sign In
                </button>
                <button onClick={() => openAuth('signup')} className="lp-btn-primary min-h-[44px] text-sm">
                  Sign Up Free
                </button>
              </div>
            </div>
          </div>
        )}
      </header>

      <main id="top" className="relative z-10 px-4 sm:px-6">
        {/* HERO */}
        <section className="max-w-6xl mx-auto pt-12 sm:pt-20 pb-16 sm:pb-24 grid lg:grid-cols-[1.05fr_1fr] gap-12 lg:gap-10 items-center">
          <div className="text-center lg:text-left">
            <div className="lp-fade-up inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/[0.04] border border-white/[0.09] text-[11px] sm:text-xs font-mono font-semibold text-emerald-300 mb-6">
              <Sparkles className="w-3.5 h-3.5 shrink-0" />
              <span>BAR REPLAY · PROP FIRM SIMULATOR</span>
            </div>

            <h1 className="lp-fade-up lp-d1 text-[2.4rem] leading-[1.05] sm:text-6xl lg:text-7xl font-black tracking-tight text-white mb-6">
              Replay the Markets.
              <span className="block mt-2 bg-gradient-to-r from-[#5b8cff] via-sky-400 to-emerald-400 bg-clip-text text-transparent lp-gradient-text">
                Master Your Edge.
              </span>
            </h1>

            <p className="lp-fade-up lp-d2 text-base sm:text-lg text-[#9ca3af] max-w-xl mx-auto lg:mx-0 leading-relaxed mb-8">
              Backtest candle-by-candle on real historical data, simulate prop firm drawdown rules and audit every trade —{' '}
              <strong className="text-emerald-400 font-bold">100% free, forever.</strong>
            </p>

            <div className="lp-fade-up lp-d3 flex flex-col sm:flex-row items-stretch sm:items-center justify-center lg:justify-start gap-3 mb-8">
              <button onClick={() => openAuth('signup')} className="lp-btn-primary group px-7 py-4 text-base">
                <span>Get Started Free</span>
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </button>
              <button
                onClick={() => openAuth('login')}
                className="inline-flex items-center justify-center gap-2 px-7 py-4 min-h-[44px] rounded-xl text-base font-bold text-white bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.12] hover:border-white/25 transition"
              >
                Sign In
              </button>
            </div>

            <ul className="lp-fade-up lp-d4 flex flex-wrap items-center justify-center lg:justify-start gap-x-5 gap-y-2 text-xs sm:text-sm text-gray-400">
              {['No credit card', 'Unlimited sessions', 'Full analytics'].map((t) => (
                <li key={t} className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Hero visual */}
          <div className="lp-fade-up lp-d2 relative w-full max-w-xl mx-auto lg:max-w-none">
            <div className="absolute -inset-6 rounded-[2rem] bg-gradient-to-tr from-[#2962ff]/25 via-transparent to-emerald-400/25 blur-2xl" aria-hidden="true" />
            <div className="lp-gradient-border relative rounded-2xl">
              <div className="rounded-2xl bg-[#0a0e17]/95 overflow-hidden">
                <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-white/[0.06] bg-white/[0.02]">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="hidden sm:flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-rose-500/80" />
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80" />
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
                    </span>
                    <span className="text-xs font-mono font-bold text-white">XAU/USD</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#2962ff]/20 text-blue-300 font-bold">15m</span>
                  </div>
                  <span className="text-xs font-mono font-bold text-emerald-400 whitespace-nowrap">+1.29%</span>
                </div>
                <div className="p-3 sm:p-4">
                  <HeroChart />
                </div>
              </div>
            </div>

            {/* Floating chips */}
            <div className="lp-float absolute -bottom-5 left-2 sm:-left-4 flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-[#0d131f]/95 border border-emerald-400/30 shadow-[0_10px_40px_rgba(0,0,0,0.6)] backdrop-blur">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-slate-950" />
              </div>
              <div>
                <div className="text-[10px] font-mono uppercase text-gray-400 leading-none">Equity</div>
                <div className="text-sm font-black font-mono text-white">$109,860</div>
              </div>
            </div>
            <div className="lp-float lp-float-delay absolute -top-4 right-2 sm:-right-4 flex items-center gap-2 px-3 py-2 rounded-xl bg-[#0d131f]/95 border border-sky-400/30 shadow-[0_10px_40px_rgba(0,0,0,0.6)] backdrop-blur">
              <ShieldCheck className="w-4 h-4 text-sky-400" />
              <span className="text-xs font-bold text-white whitespace-nowrap">Phase 1 Passed</span>
            </div>
          </div>
        </section>

        {/* FEATURES */}
        <section id="features" className="max-w-6xl mx-auto py-16 sm:py-20 scroll-mt-20">
          <div className="text-center max-w-2xl mx-auto mb-10 sm:mb-14">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-white">
              Everything you need to{' '}
              <span className="bg-gradient-to-r from-sky-400 to-emerald-400 bg-clip-text text-transparent">prove your edge</span>
            </h2>
            <p className="mt-4 text-base sm:text-lg text-[#9ca3af]">
              A professional replay terminal, prop firm rules engine and analytics suite — in one place.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
            {FEATURES.map((f) => (
              <div key={f.title} className="lp-card group">
                <div className="lp-card-inner h-full p-6">
                  <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${f.accent} flex items-center justify-center mb-5 shadow-lg transition-transform group-hover:scale-110`}>
                    <f.icon className="w-5 h-5 text-slate-950" />
                  </div>
                  <h3 className="text-lg font-bold text-white mb-2">{f.title}</h3>
                  <p className="text-sm text-[#9ca3af] leading-relaxed">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ANALYTICS PREVIEW */}
        <section id="analytics" className="max-w-6xl mx-auto py-16 sm:py-20 scroll-mt-20 grid lg:grid-cols-2 gap-10 lg:gap-14 items-center">
          <div className="order-2 lg:order-1 lp-gradient-border rounded-2xl">
            <div className="rounded-2xl bg-[#0a0e17]/95 p-5 sm:p-6">
              <div className="flex items-start justify-between gap-3 mb-4">
                <div className="min-w-0">
                  <div className="text-[11px] font-mono uppercase tracking-wider text-gray-400">FTMO $100K · Phase 1</div>
                  <div className="text-2xl sm:text-3xl font-black font-mono text-white mt-1">$109,860</div>
                </div>
                <span className="shrink-0 px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-400/40 text-emerald-300 text-xs font-bold">
                  +9.86%
                </span>
              </div>
              <EquityCurve />
              <div className="grid grid-cols-2 gap-3 mt-5">
                {ANALYTICS_KPIS.map((k) => (
                  <div key={k.label} className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-3">
                    <div className="text-[11px] text-gray-400">{k.label}</div>
                    <div className={`text-lg font-black font-mono ${k.tone}`}>{k.value}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="order-1 lg:order-2 text-center lg:text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-400/25 text-emerald-300 text-xs font-mono font-bold mb-4">
              <BarChart3 className="w-3.5 h-3.5" />
              <span>ANALYTICS DASHBOARD</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-white">
              Know exactly{' '}
              <span className="bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">why you win</span>
            </h2>
            <p className="mt-4 text-base sm:text-lg text-[#9ca3af] leading-relaxed">
              Every replayed trade flows into a rich dashboard so you can spot leaks, refine setups and pass evaluations with confidence.
            </p>
            <ul className="mt-6 space-y-3 text-left max-w-md mx-auto lg:mx-0">
              {[
                'Balance & equity curves with drawdown tracking',
                'P&L calendar, R-multiples and strategy breakdowns',
                'Trade journal with one-click CSV export',
              ].map((t) => (
                <li key={t} className="flex items-start gap-3 text-sm sm:text-base text-gray-300">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* CTA */}
        <section id="get-started" className="max-w-5xl mx-auto py-16 sm:py-24 scroll-mt-20">
          <div className="lp-gradient-border rounded-3xl">
            <div className="relative overflow-hidden rounded-3xl bg-[#0a0e17] px-6 py-12 sm:px-12 sm:py-16 text-center">
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(16,185,129,0.18),transparent_60%),radial-gradient(ellipse_at_bottom,rgba(41,98,255,0.18),transparent_60%)]" aria-hidden="true" />
              <div className="relative">
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-gradient-to-r from-emerald-400 to-teal-400 text-slate-950 font-mono font-black text-[11px] sm:text-xs uppercase tracking-wider mb-5">
                  <Zap className="w-3.5 h-3.5" />
                  100% Free Forever
                </div>
                <h2 className="text-3xl sm:text-5xl font-black tracking-tight text-white">
                  Ready to master your edge?
                </h2>
                <p className="mt-4 text-base sm:text-lg text-gray-300 max-w-xl mx-auto">
                  Create your free account in seconds and place your first replay trade right away.
                </p>
                <div className="mt-8 flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3">
                  <button onClick={() => openAuth('signup')} className="lp-btn-primary group px-8 py-4 text-base">
                    <span>Create Free Account</span>
                    <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                  </button>
                  <button
                    onClick={() => openAuth('login')}
                    className="inline-flex items-center justify-center px-7 py-4 min-h-[44px] rounded-xl text-base font-bold text-white bg-white/[0.05] hover:bg-white/[0.1] border border-white/15 transition"
                  >
                    Sign In
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/[0.06] py-6 px-4 sm:px-6 text-sm text-[#787b86]">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-center">
          <span>© Chart Replay · Historical Trading Simulator</span>
          <div className="flex items-center gap-2 font-semibold">
            <button onClick={() => openAuth('login')} className="px-3 min-h-[44px] hover:text-white transition">
              Sign In
            </button>
            <button onClick={() => openAuth('signup')} className="px-3 min-h-[44px] text-emerald-400 hover:text-emerald-300 transition">
              Sign Up Free
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
};
