import React, { useState } from 'react';
import {
  ArrowRight,
  BarChart3,
  CandlestickChart,
  CheckCircle2,
  Menu,
  ShieldCheck,
  Target,
  TrendingUp,
  Trophy,
  X,
  Zap,
  Handshake,
} from 'lucide-react';
import { ChartReplayLogo } from './ChartReplayLogo';
import { ForexTicker, PlatformPreview } from './LandingExtras';

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

const DEMO_EQUITY_POINTS = [
  100000, 100850, 100190, 101780, 102650, 101420, 100240, 103100, 104420,
  103390, 105680, 106950, 105890, 108120, 109860,
];

const FEATURES = [
  {
    icon: CandlestickChart,
    title: 'Bar-by-Bar Replay',
    desc: 'Step through deterministic 1-minute history with zero lookahead across synced 1m-1D timeframes.',
    accent: 'from-emerald-400 to-teal-500',
  },
  {
    icon: Trophy,
    title: 'Prop Firm Simulator',
    desc: 'Practice FTMO-style evaluations with real daily loss, max drawdown and profit target rules.',
    accent: 'from-emerald-400 to-teal-500',
  },
  {
    icon: Target,
    title: 'Risk-Based Execution',
    desc: 'Draw R:R setups on the chart and fire Market, Limit or Stop orders auto-sized by risk %.',
    accent: 'from-emerald-400 to-teal-500',
  },
  {
    icon: BarChart3,
    title: 'Deep Analytics & Journal',
    desc: 'Equity curves, P&L calendar, win rate, profit factor, R-multiples and CSV export for every trade.',
    accent: 'from-emerald-400 to-teal-500',
  },
];

const ANALYTICS_KPIS = [
  { label: 'Net P&L', value: '+$9,860', tone: 'text-emerald-400' },
  { label: 'Win Rate', value: '71.4%', tone: 'text-white' },
  { label: 'Profit Factor', value: '2.84', tone: 'text-sky-400' },
  { label: 'Max Drawdown', value: '2.35%', tone: 'text-rose-400' },
];

/* ---------- Small presentational helpers ---------- */

const PARTNER_EMAIL = 'info@voomay.co.za';
const PARTNER_SUBJECT = 'Partnership Enquiry — Chart Replay';
const PARTNER_BODY =
  "Hi Chart Replay team,\n\nI'm interested in partnering with Chart Replay.\n\nName:\nCompany / Brand:\nWebsite / Socials:\nPartnership idea (affiliate, prop firm, education, sponsorship, other):\n\nLooking forward to hearing from you.\n\nKind regards,";
export const PARTNER_MAILTO = `mailto:${PARTNER_EMAIL}?subject=${encodeURIComponent(PARTNER_SUBJECT)}&body=${encodeURIComponent(PARTNER_BODY)}`;

/** Inline South African flag (flag emoji don't render on Windows). */
const SAFlag: React.FC<{ className?: string }> = ({ className = 'w-5 h-[14px]' }) => (
  <svg viewBox="0 0 90 60" className={`shrink-0 rounded-[2px] ring-1 ring-white/20 ${className}`} role="img" aria-label="South African flag">
    <rect width="90" height="30" fill="#E03C31" />
    <rect y="30" width="90" height="30" fill="#001489" />
    <path d="M0 0 L45 30 H90 M0 60 L45 30" fill="none" stroke="#fff" strokeWidth="20" />
    <path d="M0 0 L45 30 H90 M0 60 L45 30" fill="none" stroke="#007749" strokeWidth="12" />
    <path d="M0 9 L31 30 L0 51 Z" fill="#FFB81C" />
    <path d="M0 15 L22 30 L0 45 Z" fill="#000" />
  </svg>
);

const SWITCH_POINTS = [
  {
    icon: Zap,
    title: 'Free, not $30+/month',
    desc: 'Full bar replay, prop firm rules and analytics without a subscription paywall.',
  },
  {
    icon: Trophy,
    title: 'Built for prop-firm challenges',
    desc: 'Daily loss, max drawdown and profit targets enforced exactly like real evaluations.',
  },
  {
    icon: Handshake,
    title: 'Made locally in South Africa',
    desc: 'Proudly South African, with local support from a team that trades the same sessions you do.',
  },
];

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

// Competitor pricing as publicly listed (monthly billing). Verify periodically — competitor prices change.
const COMPARE_PRICING = [
  {
    name: 'Chart Replay',
    highlight: true,
    price: '$0',
    period: '/ month',
    tiers: 'All features included',
    note: 'No credit card. No session caps.',
  },
  {
    name: 'FX Replay',
    highlight: false,
    price: '$17.99 – $35',
    period: '/ month',
    tiers: 'Free (limited) · Intermediate · Pro',
    note: 'Unlimited sessions & prop simulator on Pro.',
  },
  {
    name: 'TradeZella',
    highlight: false,
    price: '$35 – $99',
    period: '/ month',
    tiers: 'Essential · Pro · Ultra',
    note: 'Journal-first; replay is an add-on feature.',
  },
];

type CompareCell = boolean | 'partial' | string;
const COMPARE_ROWS: { feature: string; us: CompareCell; fx: CompareCell; tz: CompareCell }[] = [
  { feature: 'Monthly price', us: 'Free', fx: '$17.99–$35', tz: '$35–$99' },
  { feature: 'Candle-by-candle bar replay', us: true, fx: true, tz: true },
  { feature: 'Unlimited backtest sessions', us: true, fx: 'Pro only', tz: true },
  { feature: 'Prop firm challenge simulator (Phase 1 / 2 / Funded)', us: true, fx: 'Pro only', tz: 'partial' },
  { feature: 'Drag-to-adjust Long / Short position tool', us: true, fx: true, tz: 'partial' },
  { feature: 'Built-in trade journal & screenshots', us: true, fx: 'partial', tz: true },
  { feature: 'Analytics: equity curve, P&L calendar, R-multiples', us: true, fx: true, tz: true },
  { feature: 'Session boxes (Asia / London / New York)', us: true, fx: 'partial', tz: false },
  { feature: 'Momentum Forecaster overlay', us: true, fx: false, tz: false },
  { feature: 'Mobile-friendly replay & order ticket', us: true, fx: 'partial', tz: 'partial' },
  { feature: 'No credit card to start', us: true, fx: true, tz: false },
  { feature: 'Proudly South African 🇿🇦', us: true, fx: false, tz: false },
];

const CompareMark: React.FC<{ v: CompareCell; strong?: boolean }> = ({ v, strong }) => {
  if (v === true) return <CheckCircle2 className={`mx-auto ${strong ? 'w-6 h-6 text-emerald-300 drop-shadow-[0_0_6px_rgba(52,211,153,0.8)]' : 'w-5 h-5 text-emerald-500/70'}`} />;
  if (v === false) return <X className="w-5 h-5 mx-auto text-rose-500/70" />;
  if (v === 'partial') return <span className="text-xs font-semibold text-amber-400">Limited</span>;
  return <span className={`font-bold ${strong ? 'text-sm sm:text-base font-black text-emerald-300' : 'text-xs sm:text-sm text-[#cbd5e1]'}`}>{v}</span>;
};

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
    { id: 'compare', label: 'Compare' },
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
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          <button
            onClick={() => scrollToSection('top')}
            className="flex items-center gap-2.5 min-h-[44px] min-w-0"
            aria-label="Chart Replay home"
          >
            <ChartReplayLogo size={36} />
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
            <a href={PARTNER_MAILTO} className="px-3 py-2 rounded-lg hover:text-white hover:bg-white/[0.05] transition inline-flex items-center gap-1.5">
              <Handshake className="w-4 h-4 text-emerald-400" />
              Partner with Us
            </a>
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
              <a href={PARTNER_MAILTO} onClick={() => setMobileNavOpen(false)} className="flex items-center gap-2 px-3 min-h-[44px] rounded-xl text-base font-semibold text-gray-200 hover:bg-white/[0.06] transition">
                <Handshake className="w-4 h-4 text-emerald-400" />
                Partner with Us
              </a>
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
        <section className="max-w-[1400px] mx-auto pt-12 sm:pt-20 pb-16 sm:pb-24 grid lg:grid-cols-[1.1fr_1fr] gap-12 lg:gap-12 items-center">
          <div className="text-center lg:text-left">
            <div className="lp-fade-up flex justify-center lg:justify-start mb-5">
              <span className="inline-flex flex-wrap items-center justify-center gap-x-2 gap-y-1 px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-400/25 text-[11px] sm:text-xs font-semibold text-emerald-200 max-w-full">
                <span className="inline-flex items-center gap-1.5"><SAFlag className="w-4 h-[11px]" />Proudly South African</span>
                <span className="text-emerald-400/60" aria-hidden="true">·</span>
                <span>The #1 FX Replay alternative</span>
              </span>
            </div>

            <h1 className="lp-fade-up lp-d1 text-[2.4rem] leading-[1.12] sm:text-6xl lg:text-[4.1rem] xl:text-7xl font-black tracking-tight text-white mb-6">
              <span className="block lg:whitespace-nowrap">Replay the Markets.</span>
              <span className="block mt-1 pb-[0.12em] lg:whitespace-nowrap bg-gradient-to-r from-[#5b8cff] via-sky-400 to-emerald-400 bg-clip-text text-transparent lp-gradient-text">
                Master Your Trades.
              </span>
            </h1>

            <p className="lp-fade-up lp-d2 text-base sm:text-lg text-[#9ca3af] max-w-xl mx-auto lg:mx-0 leading-relaxed mb-8">
              Backtest candle-by-candle on real historical data, simulate prop firm drawdown rules and audit every trade —{' '}
              <strong className="text-emerald-400 font-bold">100% free.</strong>{' '}The best alternative to FX Replay — proudly made in South Africa.
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

          </div>

          {/* Hero visual */}
          <div className="lp-fade-up lp-d2 relative w-full max-w-2xl mx-auto lg:max-w-none min-w-0">
            <div className="absolute -inset-6 rounded-[2rem] bg-gradient-to-tr from-[#2962ff]/25 via-transparent to-emerald-400/25 blur-2xl" aria-hidden="true" />
            <div className="relative">
              <PlatformPreview />
            </div>

          </div>
        </section>

        <div className="-mx-4 sm:-mx-6">
          <ForexTicker />
        </div>


        {/* FEATURES */}
        <section id="features" className="max-w-[1400px] mx-auto py-16 sm:py-20 scroll-mt-20">
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
                  <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${f.accent} flex items-center justify-center mb-5 shadow-[0_8px_24px_rgba(16,185,129,0.3)] ring-1 ring-white/20 transition-transform group-hover:scale-110`}>
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
        <section id="analytics" className="max-w-[1400px] mx-auto py-16 sm:py-20 scroll-mt-20 grid lg:grid-cols-2 gap-10 lg:gap-14 items-center">
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

        {/* WHY SWITCH */}
        <section id="why-switch" className="max-w-[1400px] mx-auto py-16 sm:py-20 scroll-mt-20">
          <div className="text-center max-w-2xl mx-auto mb-10 sm:mb-14">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-400/25 text-emerald-300 text-xs font-mono font-bold mb-4">
              <SAFlag className="w-4 h-[11px]" />
              <span>PROUDLY SOUTH AFRICAN</span>
            </div>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-white">
              Why traders switch from{' '}
              <span className="bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">FX Replay</span>
            </h2>
            <p className="mt-4 text-base sm:text-lg text-[#9ca3af]">
              The best alternative to FX Replay — everything you need to backtest and pass evaluations, without the price tag.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5">
            {SWITCH_POINTS.map((p) => (
              <div key={p.title} className="lp-card group">
                <div className="lp-card-inner h-full p-6">
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center mb-5 shadow-[0_8px_24px_rgba(16,185,129,0.3)] ring-1 ring-white/20 transition-transform group-hover:scale-110">
                    <p.icon className="w-5 h-5 text-slate-950" />
                  </div>
                  <h3 className="text-lg font-bold text-white mb-2">{p.title}</h3>
                  <p className="text-sm text-[#9ca3af] leading-relaxed">{p.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* COMPARISON */}
        <section id="compare" className="max-w-[1400px] mx-auto py-16 sm:py-20 scroll-mt-20">
          <div className="text-center max-w-2xl mx-auto mb-10 sm:mb-14">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-400/25 text-blue-300 text-xs font-mono font-bold mb-4">
              <span>HONEST COMPARISON</span>
            </div>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-white">
              Chart Replay vs{' '}
              <span className="bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">FX Replay</span>{' '}
              vs{' '}
              <span className="bg-gradient-to-r from-sky-400 to-blue-400 bg-clip-text text-transparent">TradeZella</span>
            </h2>
            <p className="mt-4 text-base sm:text-lg text-[#9ca3af]">
              Same core replay and prop-firm workflow — without the monthly bill.
            </p>
          </div>

          {/* Pricing cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5 mb-10">
            {COMPARE_PRICING.map((p) => (
              <div
                key={p.name}
                className={`rounded-2xl p-6 border ${
                  p.highlight
                    ? 'border-emerald-400/60 bg-gradient-to-b from-emerald-500/15 to-[#0a0e17] shadow-[0_0_40px_rgba(16,185,129,0.15)]'
                    : 'border-white/10 bg-[#0d1220]'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-bold text-white">{p.name}</h3>
                  {p.highlight && (
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-500 text-slate-950">
                      BEST VALUE
                    </span>
                  )}
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className={`text-3xl font-black ${p.highlight ? 'text-emerald-300' : 'text-white'}`}>{p.price}</span>
                  <span className="text-sm text-[#9ca3af]">{p.period}</span>
                </div>
                <p className="mt-3 text-xs font-mono text-[#94a3b8]">{p.tiers}</p>
                <p className="mt-1 text-sm text-[#9ca3af]">{p.note}</p>
              </div>
            ))}
          </div>

          {/* Feature table */}
          {/* Mobile: stacked feature cards */}
          <div className="md:hidden space-y-2.5">
            <div className="text-center mb-1">
              <span className="inline-block text-lg font-black text-white tracking-tight">Feature Comparison</span>
              <p className="text-xs text-[#94a3b8]">What you get with each platform</p>
            </div>
            <div className="sticky top-14 z-10 grid grid-cols-3 gap-1.5 p-1.5 rounded-xl bg-[#0a0e17]/95 backdrop-blur border border-white/10 text-[10px] font-extrabold uppercase tracking-wider text-center">
              <span className="py-2 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 shadow-[0_0_16px_rgba(16,185,129,0.45)]">★ Chart Replay</span>
              <span className="py-2 text-[#94a3b8]">FX Replay</span>
              <span className="py-2 text-[#94a3b8]">TradeZella</span>
            </div>
            {COMPARE_ROWS.map((r) => (
              <div key={r.feature} className="rounded-xl border border-white/10 bg-[#0b101b] p-3">
                <p className="text-sm font-semibold text-[#e2e8f0] mb-2.5">{r.feature}</p>
                <div className="grid grid-cols-3 gap-1 text-center">
                  <div className="rounded-lg py-2 bg-gradient-to-b from-emerald-500/30 to-emerald-500/10 ring-1 ring-emerald-400/70 shadow-[0_0_14px_rgba(16,185,129,0.35)]"><CompareMark v={r.us} strong /></div>
                  <div className="rounded-lg bg-white/[0.03] py-2 opacity-75"><CompareMark v={r.fx} /></div>
                  <div className="rounded-lg bg-white/[0.03] py-2 opacity-75"><CompareMark v={r.tz} /></div>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop: full table */}
          <div className="hidden md:block rounded-2xl border border-white/10 bg-[#0b101b] overflow-x-auto">
            <table className="w-full min-w-[640px] text-left">
              <thead>
                <tr className="border-b border-white/10 text-xs uppercase tracking-wider text-[#94a3b8]">
                  <th className="px-4 sm:px-6 py-4 font-bold">Feature</th>
                  <th className="px-3 py-4 text-center font-bold text-emerald-300 bg-emerald-500/10">Chart Replay</th>
                  <th className="px-3 py-4 text-center font-bold">FX Replay</th>
                  <th className="px-3 py-4 text-center font-bold">TradeZella</th>
                </tr>
              </thead>
              <tbody>
                {COMPARE_ROWS.map((r) => (
                  <tr key={r.feature} className="border-b border-white/5 last:border-0 hover:bg-white/[0.02]">
                    <td className="px-4 sm:px-6 py-3 text-sm text-[#e2e8f0]">{r.feature}</td>
                    <td className="px-3 py-3 text-center bg-emerald-500/[0.06]"><CompareMark v={r.us} strong /></td>
                    <td className="px-3 py-3 text-center"><CompareMark v={r.fx} /></td>
                    <td className="px-3 py-3 text-center"><CompareMark v={r.tz} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-[11px] text-[#64748b] text-center">
            Competitor pricing based on publicly listed monthly plans at time of writing; features and prices may change. FX Replay and TradeZella are trademarks of their respective owners.
          </p>

          {/* Why choose us */}
          <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5">
            {[
              { t: 'Save $200–$1,200 a year', d: 'Everything the paid tools charge for — replay, prop simulator, journal and analytics — at zero cost.' },
              { t: 'Built for prop firm traders', d: 'Phase 1, Phase 2 and Funded rules with daily drawdown, max loss and no-rewind enforcement.' },
              { t: 'Practice anywhere', d: 'Fully usable on your phone: replay, speed controls, Buy/Sell position tool and order ticket.' },
            ].map((w) => (
              <div key={w.t} className="rounded-2xl p-6 border border-white/10 bg-[#0d1220]">
                <CheckCircle2 className="w-6 h-6 text-emerald-400 mb-3" />
                <h3 className="text-lg font-bold text-white mb-1.5">{w.t}</h3>
                <p className="text-sm text-[#9ca3af] leading-relaxed">{w.d}</p>
              </div>
            ))}
          </div>
          <div className="mt-8 text-center">
            <button onClick={() => openAuth('signup')} className="lp-btn-primary px-6 w-full sm:w-auto">
              <span>Start Free — No Card Needed</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </section>

        {/* CTA */}
        <section id="get-started" className="max-w-[1400px] mx-auto py-16 sm:py-24 scroll-mt-20">
          <div className="lp-gradient-border rounded-3xl">
            <div className="relative overflow-hidden rounded-3xl bg-[#0a0e17] px-6 py-12 sm:px-12 sm:py-16 text-center">
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(16,185,129,0.18),transparent_60%),radial-gradient(ellipse_at_bottom,rgba(41,98,255,0.18),transparent_60%)]" aria-hidden="true" />
              <div className="relative">
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-gradient-to-r from-emerald-400 to-teal-400 text-slate-950 font-mono font-black text-[11px] sm:text-xs uppercase tracking-wider mb-5">
                  <Zap className="w-3.5 h-3.5" />
                  100% Free
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
        <div className="max-w-[1400px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-center">
          <span className="flex items-center gap-3"><ChartReplayLogo size={28} /><span className="hidden sm:inline">© Historical Trading Simulator</span></span>
          <span className="inline-flex items-center gap-2 font-semibold text-gray-400"><SAFlag className="w-5 h-[14px]" />Proudly made in South Africa</span>
          <div className="flex flex-wrap items-center justify-center gap-2 font-semibold">
            <a href={PARTNER_MAILTO} className="px-3 min-h-[44px] inline-flex items-center hover:text-white transition">Partner with Us</a>
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
