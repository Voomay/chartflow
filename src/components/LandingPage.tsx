import {FaqAssistant} from './FaqAssistant';
import {LegalLinks,LegalDocumentKey} from './LegalLinks';
import React, { useEffect, useState } from 'react';
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  BrainCircuit,
  CandlestickChart,
  CheckCircle2,
  CircleDollarSign,
  Clock,
  Layers,
  Menu,
  ShieldCheck,
  StickyNote,
  Target,
  TrendingDown,
  TrendingUp,
  Trophy,
  Wallet,
  X,
  Zap,
  Handshake,
} from 'lucide-react';
import { ChartReplayLogo } from './ChartReplayLogo';
import { ForexTicker } from './LandingExtras';
import { HomepageDemoVideo } from './HomepageDemoVideo';
import { monotonePath } from './analytics/charts';
import { TRADERS_INSIGHT_PREVIEWS as TRADERS_INSIGHT_ARTICLES } from '../services/tradersInsightPreviews';
import { applyPageSeo, buildHomeJsonLd, DEFAULT_DESCRIPTION, DEFAULT_KEYWORDS, DEFAULT_TITLE } from '../services/seo';

export type LandingLaunchAction =
  | 'default'
  | 'replay'
  | 'prop_firm'
  | 'new_backtest'
  | 'analytics'
  | 'dashboard';

interface LandingPageProps {
  onOpenComingSoon?:()=>void;
  onOpenTradersInsight?:(slug?:string|null)=>void;
  onOpenLegal?:(page:LegalDocumentKey)=>void;
  onOpenSitemap?:()=>void;
  onLaunchTerminal: (initialAction?: LandingLaunchAction) => void;
  onOpenLogin: (mode?: 'login' | 'signup') => void;
  currentUser: { name: string; email: string } | null;
}

const DEMO_EQUITY_POINTS = [
  100000, 100920, 100340, 102150, 103480, 102890, 104760, 106320, 105740,
  108190, 110240, 109680, 111850, 113490, 115420,
];

const DEMO_BALANCE_POINTS = [
  100000, 100850, 100280, 101980, 103310, 102750, 104590, 106150, 105610,
  107980, 110240, 109550, 111640, 113210, 115420,
];

const DEMO_DAILY_PNL = [
  { date: '10-14', pnl: 1420 },
  { date: '10-15', pnl: -580 },
  { date: '10-16', pnl: 2190 },
  { date: '10-17', pnl: 1680 },
  { date: '10-18', pnl: -490 },
  { date: '10-21', pnl: 2840 },
  { date: '10-22', pnl: 3180 },
  { date: '10-23', pnl: -660 },
  { date: '10-24', pnl: 2630 },
  { date: '10-25', pnl: 3210 },
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
  {
    icon: BrainCircuit,
    title: 'AI Psychologist Coach',
    desc: 'Real-time mindset check-ins on entries, wins and losses to keep emotions in check, curb FOMO and stop revenge trading.',
    accent: 'from-emerald-400 to-teal-500',
  },
  {
    icon: StickyNote,
    title: 'Sticky-Note Trading Plan',
    desc: 'Pin your trading plan as a movable sticky note right on your chart so you always trade with your trading plan and your rules.',
    accent: 'from-emerald-400 to-teal-500',
  },
];

const HomepageAnalyticsShowcase: React.FC = () => {
  const [currency, setCurrency] = useState<'USD' | 'ZAR'>('USD');
  const rate = currency === 'ZAR' ? 18.5 : 1;
  const sym = currency === 'ZAR' ? 'R' : '$';
  const fmtMoney = (usdVal: number, signed = false) => {
    const val = Math.round(usdVal * rate);
    const absStr = Math.abs(val).toLocaleString('en-US');
    if (signed) return `${val >= 0 ? '+' : '-'}${sym}${absStr}`;
    return `${sym}${absStr}`;
  };

  // Equity curve geometry matching src/components/analytics/charts.tsx
  const W = 440;
  const H = 168;
  const padL = 48;
  const padR = 14;
  const padT = 12;
  const padB = 22;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const minVal = 99000;
  const maxVal = 116500;
  const toX = (i: number) => padL + (i / (DEMO_EQUITY_POINTS.length - 1)) * innerW;
  const toY = (v: number) => padT + innerH - ((v - minVal) / (maxVal - minVal)) * innerH;

  const eqXY = DEMO_EQUITY_POINTS.map((v, i) => ({ x: toX(i), y: toY(v) }));
  const balXY = DEMO_BALANCE_POINTS.map((v, i) => ({ x: toX(i), y: toY(v) }));
  const eqPath = monotonePath(eqXY);
  const balPath = monotonePath(balXY);
  const bottomY = padT + innerH;
  const areaPath = `${eqPath}L${eqXY[eqXY.length - 1].x},${bottomY}L${eqXY[0].x},${bottomY}Z`;
  const lastPt = eqXY[eqXY.length - 1];
  const yTicks = [100000, 105000, 110000, 115000];

  // Donut chart geometry matching src/components/PerformanceOverview.tsx
  const totalTrades = 28;
  const outcomes = [
    { label: 'Wins', count: 20, color: '#00dfad' },
    { label: 'Losses', count: 7, color: '#fb7185' },
    { label: 'Break-even', count: 1, color: '#64748b' },
  ];
  const rDonut = 48;
  const circ = 2 * Math.PI * rDonut;

  const kpis = [
    {
      label: 'Account balance',
      value: fmtMoney(100000),
      detail: `Current: ${fmtMoney(115420)}`,
      icon: Wallet,
      tone: 'blue',
    },
    {
      label: 'Net P&L',
      value: fmtMoney(15420, true),
      detail: '+15.42% return',
      icon: CircleDollarSign,
      tone: 'teal',
    },
    {
      label: 'Win rate',
      value: '71.4%',
      detail: '20W · 7L · 1BE',
      icon: Target,
      tone: 'cyan',
    },
    {
      label: 'Profit factor',
      value: '2.84',
      detail: '28 closed · +2.15R avg',
      icon: BarChart3,
      tone: 'violet',
    },
  ] as const;

  return (
    <div
      className="hub-modern rounded-2xl border border-[#7db4d7]/20 bg-[#0b121b] p-3.5 sm:p-5 shadow-[0_24px_70px_-20px_rgba(0,0,0,0.85),0_0_40px_rgba(16,185,129,0.1)] text-left"
      data-hub-theme="dark"
    >
      {/* Top workspace header bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 mb-3.5 border-b border-[#7db4d7]/15">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="w-8 h-8 rounded-xl bg-emerald-500/15 border border-emerald-400/30 flex items-center justify-center text-emerald-300 shrink-0">
            <BarChart3 className="w-4 h-4" />
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs sm:text-sm font-bold text-white tracking-tight truncate">
                FTMO {fmtMoney(100000)} · 2-Step Evaluation
              </span>
              <span className="px-2 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-400/35 text-[10px] font-mono font-extrabold text-emerald-300 uppercase">
                Funded Ready
              </span>
            </div>
            <p className="text-[10px] sm:text-[11px] text-slate-400 font-mono truncate">
              XAU/USD · US30 · GER30 · All Phases Combined
            </p>
          </div>
        </div>

        <div className="inline-flex items-center rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-0.5 text-[11px] font-mono font-bold shrink-0">
          <button
            type="button"
            onClick={() => setCurrency('USD')}
            className={`px-2.5 py-1 rounded-lg transition ${
              currency === 'USD' ? 'bg-emerald-500 text-slate-950 shadow' : 'text-slate-300 hover:text-white'
            }`}
          >
            USD ($)
          </button>
          <button
            type="button"
            onClick={() => setCurrency('ZAR')}
            className={`px-2.5 py-1 rounded-lg transition ${
              currency === 'ZAR' ? 'bg-emerald-500 text-slate-950 shadow' : 'text-slate-300 hover:text-white'
            }`}
          >
            ZAR (R)
          </button>
        </div>
      </div>

      {/* 1. Real Hub Metric KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-2.5 mb-3.5">
        {kpis.map(({ label, value, detail, icon: Icon, tone }) => (
          <div key={label} className={`hub-metric hub-tone-${tone} !p-2.5 sm:!p-3`}>
            <span className="hub-metric-icon !w-8 !h-8 !rounded-lg">
              <Icon className="w-4 h-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] opacity-70 mb-0.5 truncate">{label}</p>
              <strong className="!text-xs sm:!text-sm font-bold tracking-tight tabular-nums block truncate">
                {value}
              </strong>
              <span className="text-[9px] sm:text-[10px] opacity-65 font-mono block mt-0.5 truncate">
                {detail}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* 2. 2-Step Prop Firm Evaluation Progression */}
      <div className="hub-surface rounded-xl p-3 sm:p-3.5 mb-3.5">
        <div className="flex items-center justify-between gap-2 mb-2.5">
          <div className="inline-flex items-center gap-1.5 text-[10px] font-mono font-bold uppercase tracking-wider text-amber-400">
            <Trophy className="w-3.5 h-3.5" />
            <span>2-Step Prop Firm Evaluation Progression</span>
          </div>
          <span className="text-[10px] font-mono text-emerald-300 font-semibold">
            Max DD: 2.35% / 10%
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {[
            {
              title: 'Challenge 1 (Phase 1)',
              targetPct: '10%',
              targetAmt: fmtMoney(10000),
              pnl: fmtMoney(10240, true),
              ret: '+10.24%',
              trades: '16T · 75.0% WR',
              days: '5/4 Days',
            },
            {
              title: 'Challenge 2 (Phase 2)',
              targetPct: '5%',
              targetAmt: fmtMoney(5000),
              pnl: fmtMoney(5180, true),
              ret: '+5.18%',
              trades: '12T · 66.7% WR',
              days: '4/4 Days',
            },
          ].map((ph) => (
            <div
              key={ph.title}
              className="rounded-xl border border-emerald-500/35 bg-[#0c1622]/90 p-2.5 space-y-2"
            >
              <div className="flex items-center justify-between gap-1.5">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-[11px] font-extrabold text-white truncate">{ph.title}</span>
                  <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 shrink-0">
                    {ph.targetPct} ({ph.targetAmt})
                  </span>
                </div>
                <span className="text-[9px] font-mono font-extrabold px-1.5 py-0.5 rounded bg-emerald-500 text-slate-950 uppercase shrink-0">
                  PASSED
                </span>
              </div>
              <div className="flex items-center justify-between text-[10px] font-mono">
                <span className="text-emerald-400 font-bold">
                  {ph.pnl} ({ph.ret})
                </span>
                <span className="text-slate-300">{ph.trades}</span>
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[9px] font-mono text-slate-400">
                  <span>Target Progress (100%)</span>
                  <span>{ph.days}</span>
                </div>
                <div className="h-1.5 rounded-full bg-slate-700/50 overflow-hidden">
                  <div className="h-full w-full rounded-full bg-emerald-500" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 3. Equity Curve + Trade Outcomes Donut */}
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 mb-3.5">
        {/* Equity Curve Surface */}
        <div className="sm:col-span-7 hub-surface rounded-xl p-3 sm:p-3.5 flex flex-col justify-between">
          <div className="flex items-start justify-between gap-2 mb-2">
            <div>
              <h3 className="text-xs sm:text-sm font-bold text-white tracking-tight">Equity curve</h3>
              <p className="text-[10px] text-slate-400 font-mono">
                Start: <strong className="text-slate-200">{fmtMoney(100000)}</strong> · Current:{' '}
                <strong className="text-emerald-300">{fmtMoney(115420)}</strong>
              </p>
            </div>
            <div className="flex items-center gap-2.5 text-[9px] font-mono text-slate-300">
              <span className="inline-flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-cyan-400" />
                Equity
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="w-2 h-0.5 bg-indigo-400" />
                Balance
              </span>
            </div>
          </div>

          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="w-full h-36 sm:h-40 block overflow-visible"
            role="img"
            aria-label="Smooth equity and balance curve across 28 closed replay trades"
          >
            <defs>
              <linearGradient id="lp-hub-eq-area" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.32" />
                <stop offset="55%" stopColor="#3b82f6" stopOpacity="0.12" />
                <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
              </linearGradient>
              <linearGradient id="lp-hub-eq-stroke" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#22d3ee" />
                <stop offset="55%" stopColor="#3b82f6" />
                <stop offset="100%" stopColor="#10b981" />
              </linearGradient>
            </defs>

            {yTicks.map((tick) => {
              const yy = toY(tick);
              const isStart = tick === 100000;
              return (
                <g key={tick}>
                  <line
                    x1={padL}
                    x2={W - padR}
                    y1={yy}
                    y2={yy}
                    stroke={isStart ? '#38bdf8' : '#94a3b8'}
                    strokeOpacity={isStart ? 0.35 : 0.14}
                    strokeDasharray={isStart ? '4 3' : '2 3'}
                  />
                  <text
                    x={padL - 6}
                    y={yy + 3}
                    textAnchor="end"
                    fill="#94a3b8"
                    fontSize="9"
                    fontFamily="ui-monospace, monospace"
                  >
                    {currency === 'ZAR' ? `R${Math.round((tick * rate) / 1000)}k` : `$${tick / 1000}k`}
                  </text>
                </g>
              );
            })}

            <path d={areaPath} fill="url(#lp-hub-eq-area)" />
            <path
              d={balPath}
              fill="none"
              stroke="#818cf8"
              strokeOpacity="0.65"
              strokeWidth="1.5"
              strokeDasharray="4 3"
            />
            <path
              d={eqPath}
              fill="none"
              stroke="url(#lp-hub-eq-stroke)"
              strokeWidth="2.5"
              strokeLinecap="round"
            />

            <circle cx={lastPt.x} cy={lastPt.y} r="6" fill="#10b981" fillOpacity="0.25" />
            <circle cx={lastPt.x} cy={lastPt.y} r="3.2" fill="#10b981" stroke="#0b121b" strokeWidth="1.5" />

            {[
              { idx: 0, label: 'Start' },
              { idx: 4, label: '#8' },
              { idx: 9, label: '#18' },
              { idx: 14, label: '#28' },
            ].map((t) => (
              <text
                key={t.label}
                x={toX(t.idx)}
                y={H - 4}
                textAnchor="middle"
                fill="#64748b"
                fontSize="9"
                fontFamily="ui-monospace, monospace"
              >
                {t.label}
              </text>
            ))}
          </svg>
        </div>

        {/* Trade Outcomes Donut + Streaks */}
        <div className="sm:col-span-5 hub-surface rounded-xl p-3 sm:p-3.5 flex flex-col justify-between">
          <div>
            <h3 className="text-xs sm:text-sm font-bold text-white tracking-tight">Trade outcomes</h3>
            <div className="flex items-center gap-3 mt-2.5">
              <svg
                viewBox="0 0 124 124"
                className="w-24 h-24 shrink-0"
                role="img"
                aria-label="71.4% win rate: 20 wins, 7 losses, 1 break-even"
              >
                <circle cx="62" cy="62" r={rDonut} fill="none" stroke="#263342" strokeWidth="15" />
                {outcomes.map((outcome, index) => {
                  const offset = outcomes.slice(0, index).reduce((sum, item) => sum + item.count, 0);
                  return (
                    <circle
                      key={outcome.label}
                      cx="62"
                      cy="62"
                      r={rDonut}
                      fill="none"
                      stroke={outcome.color}
                      strokeWidth="15"
                      strokeDasharray={`${(outcome.count / totalTrades) * circ} ${circ}`}
                      strokeDashoffset={(-offset / totalTrades) * circ}
                      transform="rotate(-90 62 62)"
                    />
                  );
                })}
                <text
                  x="62"
                  y="58"
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill="#ffffff"
                  fontSize="15"
                  fontWeight="800"
                >
                  71.4%
                </text>
                <text x="62" y="74" textAnchor="middle" fill="#94a3b8" fontSize="8.5" fontWeight="600">
                  Win rate
                </text>
              </svg>

              <div className="space-y-2 flex-1 min-w-0">
                {outcomes.map((outcome) => (
                  <div key={outcome.label} className="flex items-center justify-between gap-2 text-[11px]">
                    <span className="flex items-center gap-1.5 text-slate-300 truncate">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: outcome.color }} />
                      {outcome.label}
                    </span>
                    <strong className="font-mono font-bold text-white">{outcome.count}</strong>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-2.5 mt-2.5 border-t border-slate-500/15">
            <div className="rounded-lg bg-emerald-500/10 border border-emerald-400/25 px-2.5 py-1.5">
              <div className="text-[9px] text-slate-400 uppercase font-mono">Win Streak</div>
              <div className="text-xs font-mono font-extrabold text-emerald-300">7 consecutive</div>
            </div>
            <div className="rounded-lg bg-cyan-500/10 border border-cyan-400/25 px-2.5 py-1.5">
              <div className="text-[9px] text-slate-400 uppercase font-mono">Expectancy</div>
              <div className="text-xs font-mono font-extrabold text-cyan-300">{fmtMoney(551, true)}/trade</div>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Compact Daily P&L Bar Strip */}
      <div className="hub-surface rounded-xl p-3 sm:p-3.5">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-bold text-white">Daily P&amp;L</h3>
            <span className="text-[10px] font-mono text-slate-400">UTC · 10 trading days</span>
          </div>
          <span className="text-[10px] font-mono text-emerald-300 font-semibold">
            8 green · 2 red days
          </span>
        </div>
        <div className="grid grid-cols-10 gap-1.5 items-end h-12 pt-1">
          {DEMO_DAILY_PNL.map((d) => {
            const pct = Math.max(18, Math.round((Math.abs(d.pnl) / 3300) * 100));
            const isWin = d.pnl >= 0;
            return (
              <div key={d.date} className="flex flex-col items-center gap-1 h-full justify-end">
                <div
                  className={`w-full rounded-sm ${
                    isWin
                      ? 'bg-gradient-to-t from-cyan-500/70 to-emerald-400'
                      : 'bg-gradient-to-t from-rose-600/70 to-rose-400'
                  }`}
                  style={{ height: `${pct}%` }}
                  title={`${d.date}: ${fmtMoney(d.pnl, true)}`}
                />
                <span className="text-[8px] font-mono text-slate-400">{d.date.slice(3)}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

/* ---------- Small presentational helpers ---------- */

const PARTNER_EMAIL = 'info@chartreplay.co.za';
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
  { feature: 'AI psychologist coach & mindset check-ins', us: true, fx: false, tz: false },
  { feature: 'Sticky-note trading plan & rules on chart', us: true, fx: false, tz: false },
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

export const LandingPage: React.FC<LandingPageProps> = ({ onOpenLogin,onOpenLegal,onOpenSitemap,onOpenComingSoon,onOpenTradersInsight }) => {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    applyPageSeo({
      title: DEFAULT_TITLE,
      description: DEFAULT_DESCRIPTION,
      path: '/',
      type: 'website',
      keywords: DEFAULT_KEYWORDS,
      jsonLd: buildHomeJsonLd(),
    });
  }, []);

  const handleInsightClick = (e: React.MouseEvent<HTMLAnchorElement>, slug: string | null = null) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    e.preventDefault();
    setMobileNavOpen(false);
    if (onOpenTradersInsight) {
      onOpenTradersInsight(slug);
    } else {
      window.location.href = slug ? `/traders-insight/${slug}` : '/traders-insight';
    }
  };

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
            <a
              href="/traders-insight"
              onClick={(e) => handleInsightClick(e, null)}
              className="px-3 py-2 rounded-lg text-emerald-300 hover:text-white hover:bg-white/[0.05] transition inline-flex items-center gap-1.5 font-semibold"
            >
              <BookOpen className="w-4 h-4 text-emerald-400" />
              <span>Trader&apos;s Insight</span>
            </a>
            <a href="/partners" className="px-3 py-2 rounded-lg hover:text-white hover:bg-white/[0.05] transition inline-flex items-center gap-1.5">
              <Handshake className="w-4 h-4 text-emerald-400" />
              Partner with Us
            </a>
          </nav>

          <div className="hidden md:flex items-center gap-2">
            <a
              href="/login"
              onClick={(e) => {
                if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
                e.preventDefault();
                openAuth('login');
              }}
              className="px-4 py-2.5 rounded-xl text-sm font-semibold text-gray-300 hover:text-white hover:bg-white/[0.06] transition"
            >
              Sign In
            </a>
            <a
              href="/signup"
              onClick={(e) => {
                if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
                e.preventDefault();
                openAuth('signup');
              }}
              className="lp-btn-primary px-4 py-2.5 text-sm"
            >
              <span>Sign Up Free</span>
              <ArrowRight className="w-4 h-4" />
            </a>
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
              <a
                href="/traders-insight"
                onClick={(e) => handleInsightClick(e, null)}
                className="flex items-center gap-2 px-3 min-h-[44px] rounded-xl text-base font-semibold text-emerald-300 hover:bg-white/[0.06] transition"
              >
                <BookOpen className="w-4 h-4 text-emerald-400" />
                <span>Trader&apos;s Insight (10 Blogs)</span>
              </a>
              <a href="/partners" onClick={() => setMobileNavOpen(false)} className="flex items-center gap-2 px-3 min-h-[44px] rounded-xl text-base font-semibold text-gray-200 hover:bg-white/[0.06] transition">
                <Handshake className="w-4 h-4 text-emerald-400" />
                Partner with Us
              </a>
              <div className="grid grid-cols-2 gap-2 pt-2 pb-1">
                <a
                  href="/login"
                  onClick={(e) => {
                    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
                    e.preventDefault();
                    openAuth('login');
                  }}
                  className="min-h-[44px] rounded-xl text-sm font-semibold text-white border border-white/15 bg-white/[0.04] hover:bg-white/[0.08] transition flex items-center justify-center"
                >
                  Sign In
                </a>
                <a
                  href="/signup"
                  onClick={(e) => {
                    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
                    e.preventDefault();
                    openAuth('signup');
                  }}
                  className="lp-btn-primary min-h-[44px] text-sm"
                >
                  Sign Up Free
                </a>
              </div>
            </div>
          </div>
        )}
      </header>

      <main id="top" className="relative z-10 px-4 sm:px-6">
        {/* HERO */}
        <section className="max-w-[1400px] mx-auto pt-12 sm:pt-16 pb-16 sm:pb-24 flex flex-col items-center gap-8 sm:gap-12">
          <div className="text-center w-full max-w-4xl mx-auto">
            <div className="lp-fade-up flex justify-center mb-5">
              <span className="inline-flex flex-wrap items-center justify-center gap-x-2 gap-y-1 px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-400/25 text-[11px] sm:text-xs font-semibold text-emerald-200 max-w-full">
                <span className="inline-flex items-center gap-1.5"><SAFlag className="w-4 h-[11px]" />Proudly South African</span>
                <span className="text-emerald-400/60" aria-hidden="true">·</span>
                <span>The #1 FX Replay alternative</span>
              </span>
            </div>

            <h1 className="lp-fade-up lp-d1 text-[clamp(2.6rem,11.5vw,3.5rem)] leading-[1.08] sm:text-6xl lg:text-[4.1rem] xl:text-7xl font-black tracking-tight text-white mb-6">
              <span className="block"><span className="whitespace-nowrap">Replay the</span>{' '}<br className="sm:hidden"/>Markets.</span>
              <span className="block mt-1 pb-[0.12em] lg:whitespace-nowrap bg-gradient-to-r from-[#5b8cff] via-sky-400 to-emerald-400 bg-clip-text text-transparent lp-gradient-text">
                <span className="whitespace-nowrap">Master Your</span>{' '}<br className="sm:hidden"/>Trades.
              </span>
            </h1>

            <p className="lp-fade-up lp-d2 text-base sm:text-lg text-[#9ca3af] max-w-2xl mx-auto leading-relaxed mb-7">
              Backtest candle-by-candle on real historical data, simulate prop firm drawdown rules, stay disciplined with an{' '}
              <strong className="text-white font-semibold">AI psychologist coach</strong> and an{' '}
              <strong className="text-white font-semibold">on-chart sticky note for your trading plan &amp; rules</strong>, and audit every trade —{' '}
              <strong className="text-emerald-400 font-bold">100% free.</strong>{' '}The best alternative to FX Replay — proudly made in South Africa.
            </p>

            <div className="lp-fade-up lp-d3 flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3">
              <button onClick={() => openAuth('signup')} className="lp-btn-primary group px-7 py-4 text-base">
                <span>Start Practicing Free</span>
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </button>
              <button
                onClick={() => openAuth('login')}
                className="inline-flex items-center justify-center gap-2 px-7 py-4 min-h-[44px] rounded-xl text-base font-bold text-white bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.12] hover:border-white/25 transition"
              >
                Sign In
              </button>
            </div>
            <p className="lp-fade-up lp-d3 mt-3.5 inline-flex items-center justify-center gap-1.5 text-xs sm:text-sm text-emerald-300/90 font-medium">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>100% Free · No credit card needed</span>
            </p>

          </div>

          {/* Hero visual */}
          <div className="lp-fade-up lp-d2 relative w-full max-w-[1240px] mx-auto min-w-0">
            <div className="pointer-events-none absolute -inset-6 rounded-[2rem] bg-[radial-gradient(ellipse_at_center,rgba(41,98,255,0.22),rgba(16,185,129,0.16)_55%,transparent_75%)]" aria-hidden="true" />
            <div className="relative">
              <HomepageDemoVideo />
            </div>

          </div>
        </section>

        <div className="-mx-4 sm:-mx-6">
          <ForexTicker />
        </div>


        {/* FEATURES */}
        <section id="features" className="lp-section-cv max-w-[1400px] mx-auto py-16 sm:py-20 scroll-mt-20">
          <div className="text-center max-w-2xl mx-auto mb-10 sm:mb-14">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-white">
              Everything you need to{' '}
              <span className="bg-gradient-to-r from-sky-400 to-emerald-400 bg-clip-text text-transparent">prove your edge</span>
            </h2>
            <p className="mt-4 text-base sm:text-lg text-[#9ca3af]">
              A professional replay terminal, prop firm rules engine, AI psychologist coach, sticky-note trading plan and analytics suite — in one place.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
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
        <section id="analytics" className="lp-section-cv max-w-[1400px] mx-auto py-16 sm:py-20 scroll-mt-20 grid lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          <div className="order-2 lg:order-1 lg:col-span-7 min-w-0">
            <HomepageAnalyticsShowcase />
          </div>

          <div className="order-1 lg:order-2 lg:col-span-5 text-center lg:text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-400/25 text-emerald-300 text-xs font-mono font-bold mb-4">
              <BarChart3 className="w-3.5 h-3.5" />
              <span>ANALYTICS DASHBOARD</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-white">
              Know exactly{' '}
              <span className="bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">why you win</span>
            </h2>
            <p className="mt-4 text-base sm:text-lg text-[#9ca3af] leading-relaxed">
              Every replayed trade flows into our full performance hub — built with the exact metrics prop-firm and funded traders rely on.
            </p>
            <ul className="mt-6 space-y-3 text-left max-w-md mx-auto lg:mx-0">
              {[
                '2-Step Prop Firm Challenge progression (Phase 1 & Phase 2 targets)',
                'Smooth equity & balance curves with live USD ($) / ZAR (R) toggle',
                'Trade outcomes donut, Daily P&L bars, streaks & R-multiple expectancy',
                'Full trade journal with setup tags & one-click CSV export',
              ].map((t) => (
                <li key={t} className="flex items-start gap-3 text-sm sm:text-base text-gray-300">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                  <span>{t}</span>
                </li>
              ))}
            </ul>
            <div className="mt-7 flex justify-center lg:justify-start">
              <button onClick={() => openAuth('signup')} className="lp-btn-primary group px-6 py-3.5 text-sm sm:text-base">
                <span>Start Practicing Now</span>
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </button>
            </div>
          </div>
        </section>

        {/* WHY SWITCH */}
        <section id="why-switch" className="lp-section-cv max-w-[1400px] mx-auto py-16 sm:py-20 scroll-mt-20">
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
        <section id="compare" className="lp-section-cv max-w-[1400px] mx-auto py-16 sm:py-20 scroll-mt-20">
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

        {/* TRADER'S INSIGHT PREVIEW SECTION */}
        <section id="traders-insight" className="lp-section-cv max-w-[1400px] mx-auto py-16 sm:py-20 scroll-mt-20">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-10">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-400/25 text-emerald-300 text-xs font-mono font-bold mb-3">
                <BookOpen className="w-3.5 h-3.5" />
                <span>TRADER&apos;S INSIGHT · FOREX &amp; PROP FIRM RESEARCH</span>
              </div>
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-white">
                Learn what{' '}
                <span className="bg-gradient-to-r from-emerald-400 to-sky-400 bg-clip-text text-transparent">
                  funded traders
                </span>{' '}
                search &amp; test
              </h2>
              <p className="mt-3 text-sm sm:text-base text-[#9ca3af] max-w-2xl">
                Explore {TRADERS_INSIGHT_ARTICLES.length} comprehensive, ~1,150-word guides covering FTMO drawdown rules, free FX Replay alternatives in South Africa &amp; Nigeria, XAUUSD Gold liquidity sweeps, ICT Silver Bullet backtesting, R-multiple math, and African (SAST / WAT / EAT / GMT) session hours.
              </p>
            </div>
            <a
              href="/traders-insight"
              onClick={(e) => handleInsightClick(e, null)}
              className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl border border-emerald-400/40 bg-emerald-500/10 hover:bg-emerald-500/20 text-sm font-bold text-emerald-300 transition shrink-0"
            >
              <span>View All {TRADERS_INSIGHT_ARTICLES.length} Guides</span>
              <ArrowRight className="w-4 h-4" />
            </a>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5">
            {TRADERS_INSIGHT_ARTICLES.slice(0, 3).map((article) => (
              <a
                key={article.slug}
                href={`/traders-insight/${article.slug}`}
                onClick={(e) => handleInsightClick(e, article.slug)}
                className="lp-card group flex flex-col justify-between text-left overflow-hidden"
              >
                <div className="lp-card-inner h-full flex flex-col justify-between overflow-hidden">
                  <div>
                    <img
                      src={article.image}
                      alt={article.imageAlt}
                      loading="lazy"
                      decoding="async"
                      width={1200}
                      height={630}
                      className="w-full h-44 object-cover border-b border-white/10"
                    />
                    <div className="p-5 space-y-2.5">
                      <div className="flex items-center justify-between text-[11px] font-mono text-emerald-400">
                        <span>{article.category}</span>
                        <span className="inline-flex items-center gap-1 text-slate-400">
                          <Clock className="w-3 h-3" />
                          {article.readingTimeMinutes}m read
                        </span>
                      </div>
                      <h3 className="text-base sm:text-lg font-bold text-white group-hover:text-emerald-300 transition leading-snug">
                        {article.title}
                      </h3>
                      <p className="text-xs sm:text-sm text-[#9ca3af] line-clamp-3 leading-relaxed">
                        {article.excerpt}
                      </p>
                    </div>
                  </div>
                  <div className="px-5 pb-5 pt-2 flex items-center justify-between text-xs font-bold text-emerald-400">
                    <span>Read Full Article Page</span>
                    <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                  </div>
                </div>
              </a>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section id="get-started" className="lp-section-cv max-w-[1400px] mx-auto py-16 sm:py-24 scroll-mt-20">
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
                  Start practicing on real historical charts in seconds and place your first replay trade right away.
                </p>
                <div className="mt-8 flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3">
                  <a
                    href="/signup"
                    onClick={(e) => {
                      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
                      e.preventDefault();
                      openAuth('signup');
                    }}
                    className="lp-btn-primary group px-8 py-4 text-base"
                  >
                    <span>Start Practicing Now</span>
                    <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                  </a>
                  <a
                    href="/login"
                    onClick={(e) => {
                      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
                      e.preventDefault();
                      openAuth('login');
                    }}
                    className="inline-flex items-center justify-center px-7 py-4 min-h-[44px] rounded-xl text-base font-bold text-white bg-white/[0.05] hover:bg-white/[0.1] border border-white/15 transition"
                  >
                    Sign In
                  </a>
                </div>
                <p className="mt-3.5 inline-flex items-center justify-center gap-1.5 text-xs sm:text-sm text-emerald-300/90 font-medium">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>100% Free · No credit card needed</span>
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <FaqAssistant/>
      {/* Footer */}
      <footer className="relative z-10 border-t border-white/[0.06] py-6 px-4 sm:px-6 text-sm text-[#787b86]">
        <div className="max-w-[1400px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-center">
          <span className="flex items-center gap-3"><ChartReplayLogo size={28} /><span className="hidden sm:inline">© Historical Trading Simulator</span></span>
          <span className="inline-flex items-center gap-2 font-semibold text-gray-400"><SAFlag className="w-5 h-[14px]" />Proudly made in South Africa</span>
          <div className="flex flex-wrap items-center justify-center gap-2 font-semibold">
            <a href="/partners" className="px-3 min-h-[44px] inline-flex items-center hover:text-white transition">Partner with Us</a>
            <a
              href="/login"
              onClick={(e) => {
                if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
                e.preventDefault();
                openAuth('login');
              }}
              className="px-3 min-h-[44px] inline-flex items-center hover:text-white transition"
            >
              Sign In
            </a>
            <a
              href="/signup"
              onClick={(e) => {
                if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
                e.preventDefault();
                openAuth('signup');
              }}
              className="px-3 min-h-[44px] inline-flex items-center text-emerald-400 hover:text-emerald-300 transition"
            >
              Sign Up Free
            </a>
          </div>
        </div>
        <div className="max-w-[1400px] mx-auto pt-4 flex flex-col sm:flex-row items-center justify-between gap-3"><p className="text-[11px] opacity-65">Technology for trader development · Simulated money only · Not a financial institution</p><div className="flex flex-wrap items-center justify-center gap-4"><LegalLinks onOpen={onOpenLegal} onOpenSitemap={onOpenSitemap}/></div></div>
      </footer>
    </div>
  );
};
