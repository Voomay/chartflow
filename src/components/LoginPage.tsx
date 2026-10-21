import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  KeyRound,
  Lock,
  Mail,
  TrendingUp,
  User,
  Zap,
} from 'lucide-react';
import {
  authenticateUserAccount,
  RegisteredUser,
  registerUserAccount,
  resetUserPassword,
} from '../services/storageAndAnalytics';

export interface ChartFlowUser {
  id?: string;
  name: string;
  email: string;
  plan: 'FREE_FOREVER';
  joinedAt: string;
}

interface LoginPageProps {
  initialMode?: 'login' | 'signup' | 'reset';
  currentUser: ChartFlowUser | null;
  onSuccessAuth: (user: ChartFlowUser) => void;
  onLogout: () => void;
  onBackToLanding: () => void;
  onSkipToTerminal: () => void;
}

const SHOWCASE_CANDLES = [
  { o: 32, h: 42, l: 26, c: 38, v: 28 },
  { o: 38, h: 46, l: 34, c: 44, v: 35 },
  { o: 44, h: 47, l: 33, c: 36, v: 24 },
  { o: 36, h: 41, l: 28, c: 31, v: 30 },
  { o: 31, h: 48, l: 29, c: 46, v: 52 },
  { o: 46, h: 56, l: 43, c: 53, v: 48 },
  { o: 53, h: 55, l: 44, c: 47, v: 29 },
  { o: 47, h: 62, l: 45, c: 59, v: 64 },
  { o: 59, h: 68, l: 55, c: 65, v: 58 },
  { o: 65, h: 67, l: 56, c: 58, v: 32 },
  { o: 58, h: 74, l: 57, c: 71, v: 70 },
  { o: 71, h: 79, l: 67, c: 76, v: 62 },
  { o: 76, h: 78, l: 69, c: 72, v: 38 },
  { o: 72, h: 86, l: 70, c: 84, v: 82 },
  { o: 84, h: 92, l: 80, c: 89, v: 76 },
];

export const LoginPage: React.FC<LoginPageProps> = ({
  initialMode = 'login',
  onSuccessAuth,
  onBackToLanding,
}) => {
  const [mode, setMode] = useState<'login' | 'signup' | 'reset'>(initialMode);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('trader@chartflow.io');
  const [password, setPassword] = useState('demo1234');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    setMode(initialMode);
    setErrorMsg(null);
    setSuccessMsg(null);
    if (initialMode === 'signup') {
      setEmail('');
      setPassword('');
    } else if (initialMode === 'login') {
      setEmail((prev) => prev || 'trader@chartflow.io');
      setPassword((prev) => prev || 'demo1234');
    }
  }, [initialMode]);

  const handleCompleteUser = (u: RegisteredUser) => {
    onSuccessAuth({
      id: u.id,
      name: u.name,
      email: u.email,
      plan: u.plan,
      joinedAt: u.joinedAt,
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (mode === 'login') {
      const res = authenticateUserAccount(email, password);
      if (!res.ok || !res.user) {
        setErrorMsg(res.error || 'Unable to sign in.');
        return;
      }
      handleCompleteUser(res.user);
      return;
    }

    if (mode === 'signup') {
      const res = registerUserAccount(name, email, password);
      if (!res.ok || !res.user) {
        setErrorMsg(res.error || 'Unable to register account.');
        return;
      }
      handleCompleteUser(res.user);
      return;
    }

    if (mode === 'reset') {
      if (password.length < 4) {
        setErrorMsg('New password must be at least 4 characters long.');
        return;
      }
      if (confirmPassword && password !== confirmPassword) {
        setErrorMsg('Passwords do not match. Please verify your new password.');
        return;
      }
      const res = resetUserPassword(email, password);
      if (!res.ok || !res.user) {
        setErrorMsg(res.error || 'Unable to reset password.');
        return;
      }
      setSuccessMsg(
        `Password for ${res.user.email} has been reset! You can now sign in.`
      );
      setMode('login');
    }
  };

  const handleQuickDemoLogin = () => {
    const res = authenticateUserAccount('trader@chartflow.io', 'demo1234');
    if (res.ok && res.user) {
      handleCompleteUser(res.user);
    } else {
      onSuccessAuth({
        id: 'user-demo-trader',
        name: 'Alex Mercer',
        email: 'trader@chartflow.io',
        plan: 'FREE_FOREVER',
        joinedAt: new Date().toISOString().slice(0, 10),
      });
    }
  };

  return (
    <div className="h-[100dvh] w-full bg-[#06080d] text-[#d1d4dc] flex flex-col lg:flex-row overflow-y-auto overflow-x-hidden lg:overflow-hidden custom-scrollbar selection:bg-emerald-500/30 dark-modal">
      {/* LEFT SIDE: Visual Charts Showcase (desktop only — hidden on small screens to keep the form front and center) */}
      <div className="hidden lg:flex lg:w-[54%] relative bg-gradient-to-br from-[#0a1020] via-[#090d16] to-[#06120f] border-r border-white/[0.07] p-12 flex-col justify-between overflow-hidden">
        {/* Ambient Glows & Grid */}
        <div
          className="absolute inset-0 opacity-[0.06] pointer-events-none"
          style={{
            backgroundImage:
              'linear-gradient(to right, #3b82f6 1px, transparent 1px), linear-gradient(to bottom, #3b82f6 1px, transparent 1px)',
            backgroundSize: '48px 48px',
          }}
        />
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-[#2962ff]/20 blur-[130px] rounded-full pointer-events-none" />
        <div className="absolute -bottom-24 right-10 w-96 h-96 bg-emerald-500/15 blur-[130px] rounded-full pointer-events-none" />

        {/* Top Bar on Chart Side */}
        <div className="relative z-10 flex items-center justify-between">
          <button
            onClick={onBackToLanding}
            className="flex items-center gap-2.5 group text-left"
          >
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#2962ff] to-emerald-400 flex items-center justify-center text-white font-black text-xs shadow-[0_0_20px_rgba(41,98,255,0.45)] border border-white/15">
              CR
            </div>
            <span className="font-extrabold text-base tracking-tight text-white">
              CHART <span className="text-[#2962ff]">REPLAY</span>
            </span>
          </button>

          <span className="text-[11px] font-mono px-3 py-1 rounded-full bg-white/[0.04] border border-white/[0.08] text-gray-300">
            XAU/USD · NAS100 · EUR/USD
          </span>
        </div>

        {/* Center Multi-Chart Artwork Showcase */}
        <div className="relative z-10 my-8 lg:my-auto">
          {/* Primary Candlestick Chart Frame */}
          <div className="rounded-2xl border border-white/[0.1] bg-[#0c111d]/95 shadow-[0_25px_80px_rgba(0,0,0,0.8)] overflow-hidden">
            {/* Chart Top Header */}
            <div className="px-4 py-3 bg-[#101624] border-b border-white/[0.07] flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500/80" />
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80" />
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
                </div>
                <span className="ml-1 text-xs font-mono font-bold text-white">
                  XAU/USD
                </span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#2962ff]/20 text-blue-300 font-bold">
                  15m
                </span>
                <span className="text-xs font-mono font-bold text-emerald-400">
                  2,671.40 (+1.42%)
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-[10px] font-mono">
                <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-bold">
                  +3.40R TARGET HIT
                </span>
              </div>
            </div>

            {/* SVG High-Detail Trading Chart Illustration */}
            <div className="relative p-4 sm:p-5 bg-gradient-to-b from-[#0c111d] to-[#090d16]">
              <svg
                viewBox="0 0 600 280"
                className="w-full h-56 sm:h-64 overflow-visible"
              >
                <defs>
                  <linearGradient id="tpZoneGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#089981" stopOpacity="0.28" />
                    <stop offset="100%" stopColor="#089981" stopOpacity="0.06" />
                  </linearGradient>
                  <linearGradient id="slZoneGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f23645" stopOpacity="0.08" />
                    <stop offset="100%" stopColor="#f23645" stopOpacity="0.26" />
                  </linearGradient>
                  <linearGradient id="emaGlow" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#2962ff" stopOpacity="0.4" />
                    <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.95" />
                  </linearGradient>
                </defs>

                {/* Horizontal Grid Lines */}
                {[40, 90, 140, 190, 240].map((y) => (
                  <line
                    key={y}
                    x1="0"
                    y1={y}
                    x2="545"
                    y2={y}
                    stroke="#1e2638"
                    strokeDasharray="3 3"
                    strokeWidth="1"
                  />
                ))}

                {/* Vertical Grid Lines */}
                {[90, 190, 290, 390, 490].map((x) => (
                  <line
                    key={x}
                    x1={x}
                    y1="10"
                    x2={x}
                    y2="255"
                    stroke="#1e2638"
                    strokeDasharray="3 3"
                    strokeWidth="1"
                  />
                ))}

                {/* Price Axis Labels on Right */}
                <text x="554" y="44" fill="#64748b" fontSize="10" fontFamily="monospace">
                  2675.0
                </text>
                <text x="554" y="94" fill="#64748b" fontSize="10" fontFamily="monospace">
                  2665.0
                </text>
                <text x="554" y="144" fill="#64748b" fontSize="10" fontFamily="monospace">
                  2655.0
                </text>
                <text x="554" y="194" fill="#64748b" fontSize="10" fontFamily="monospace">
                  2645.0
                </text>
                <text x="554" y="244" fill="#64748b" fontSize="10" fontFamily="monospace">
                  2635.0
                </text>

                {/* Long R:R Position Projection Box (From candle 7 to candle 15) */}
                {/* Take Profit Zone */}
                <rect
                  x="245"
                  y="34"
                  width="285"
                  height="112"
                  rx="4"
                  fill="url(#tpZoneGrad)"
                  stroke="#089981"
                  strokeOpacity="0.5"
                  strokeWidth="1"
                />
                {/* Stop Loss Zone */}
                <rect
                  x="245"
                  y="146"
                  width="285"
                  height="46"
                  rx="4"
                  fill="url(#slZoneGrad)"
                  stroke="#f23645"
                  strokeOpacity="0.5"
                  strokeWidth="1"
                />
                {/* Entry Line */}
                <line
                  x1="245"
                  y1="146"
                  x2="530"
                  y2="146"
                  stroke="#38bdf8"
                  strokeWidth="1.5"
                />

                {/* Smooth EMA Curve */}
                <path
                  d="M 25 205 Q 95 190, 160 182 T 290 142 T 420 96 T 525 52"
                  fill="none"
                  stroke="url(#emaGlow)"
                  strokeWidth="2.2"
                />

                {/* Volume Histogram Bars at Bottom */}
                {SHOWCASE_CANDLES.map((c, i) => {
                  const x = 22 + i * 35;
                  const isBull = c.c >= c.o;
                  const vHeight = (c.v / 100) * 42;
                  return (
                    <rect
                      key={`vol-${i}`}
                      x={x - 6}
                      y={268 - vHeight}
                      width="12"
                      height={vHeight}
                      rx="1.5"
                      fill={isBull ? '#089981' : '#f23645'}
                      fillOpacity="0.22"
                    />
                  );
                })}

                {/* Candlesticks */}
                {SHOWCASE_CANDLES.map((c, i) => {
                  const x = 22 + i * 35;
                  const isBull = c.c >= c.o;
                  const scaleY = (val: number) => 255 - (val / 100) * 230;
                  const highY = scaleY(c.h);
                  const lowY = scaleY(c.l);
                  const openY = scaleY(c.o);
                  const closeY = scaleY(c.c);
                  const bodyTop = Math.min(openY, closeY);
                  const bodyHeight = Math.max(5, Math.abs(closeY - openY));

                  return (
                    <g key={`candle-${i}`}>
                      <line
                        x1={x}
                        y1={highY}
                        x2={x}
                        y2={lowY}
                        stroke={isBull ? '#089981' : '#f23645'}
                        strokeWidth="1.6"
                      />
                      <rect
                        x={x - 7}
                        y={bodyTop}
                        width="14"
                        height={bodyHeight}
                        rx="2"
                        fill={isBull ? '#089981' : '#f23645'}
                      />
                    </g>
                  );
                })}

                {/* Live Price Dashed Line & Tag */}
                <line
                  x1="0"
                  y1="50"
                  x2="545"
                  y2="50"
                  stroke="#089981"
                  strokeDasharray="4 4"
                  strokeWidth="1"
                />
                <rect x="546" y="40" width="52" height="19" rx="4" fill="#089981" />
                <text
                  x="552"
                  y="53"
                  fill="#ffffff"
                  fontSize="10"
                  fontWeight="bold"
                  fontFamily="monospace"
                >
                  2671.4
                </text>

                {/* R:R Overlay Labels */}
                <rect
                  x="255"
                  y="42"
                  width="128"
                  height="20"
                  rx="4"
                  fill="#064e3b"
                  fillOpacity="0.9"
                />
                <text
                  x="263"
                  y="55"
                  fill="#6ee7b7"
                  fontSize="10"
                  fontWeight="bold"
                  fontFamily="monospace"
                >
                  TP · +3.4R (+$3,400)
                </text>
              </svg>
            </div>
          </div>

          {/* Secondary Floating Equity Curve Card */}
          <div className="mt-4 sm:mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="p-4 rounded-xl border border-white/[0.08] bg-[#0e1422]/90 backdrop-blur-md flex items-center justify-between">
              <div>
                <div className="text-[10px] font-mono uppercase text-gray-400">
                  SIMULATED EQUITY CURVE
                </div>
                <div className="text-lg font-black text-white font-mono mt-0.5">
                  $112,480.00
                </div>
                <div className="text-[11px] font-mono text-emerald-400 font-semibold flex items-center gap-1 mt-0.5">
                  <TrendingUp className="w-3.5 h-3.5" />
                  <span>+12.48% · Prop Target Passed</span>
                </div>
              </div>
              <svg viewBox="0 0 110 46" className="w-24 h-11 shrink-0">
                <path
                  d="M 2 40 L 20 34 L 36 37 L 54 24 L 70 26 L 88 12 L 108 4"
                  fill="none"
                  stroke="#10b981"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
              </svg>
            </div>

            <div className="p-4 rounded-xl border border-white/[0.08] bg-[#0e1422]/90 backdrop-blur-md flex flex-col justify-center">
              <div className="text-[10px] font-mono uppercase text-gray-400">
                SESSION ANALYTICS
              </div>
              <div className="flex items-baseline gap-3 mt-1">
                <span className="text-lg font-black text-white font-mono">
                  74.2% Win Rate
                </span>
                <span className="text-xs font-mono text-[#2962ff] font-bold">
                  2.84 Profit Factor
                </span>
              </div>
              <div className="text-[11px] text-gray-400 mt-0.5">
                Zero-lookahead 1m–1D synchronized replay
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Caption */}
        <div className="relative z-10 flex items-center justify-between text-xs text-[#8b909a] pt-2">
          <span>Replay historical charts, test prop rules, and track every trade.</span>
          <span className="font-mono text-emerald-400 font-semibold">100% Free</span>
        </div>
      </div>

      {/* RIGHT SIDE: Login / Sign Up Form */}
      <div className="flex-1 lg:flex-none lg:w-[46%] flex flex-col justify-between px-5 py-5 sm:p-10 lg:p-14 bg-[#06080d] relative overflow-hidden lg:overflow-y-auto custom-scrollbar">
        {/* Ambient gradient glows */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
          <div className="absolute -top-32 -right-24 w-80 h-80 rounded-full bg-[radial-gradient(closest-side,rgba(41,98,255,0.28),transparent)]" />
          <div className="absolute -bottom-32 -left-24 w-80 h-80 rounded-full bg-[radial-gradient(closest-side,rgba(16,185,129,0.22),transparent)]" />
        </div>

        {/* Top Bar: back button + compact brand on mobile */}
        <div className="relative flex items-center justify-between gap-3">
          <button
            onClick={onBackToLanding}
            className="inline-flex items-center gap-2 min-h-[44px] -ml-1 px-1 text-sm sm:text-xs font-semibold text-gray-400 hover:text-white transition"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>
              Back<span className="hidden sm:inline"> to Homepage</span>
            </span>
          </button>
          <button
            onClick={onBackToLanding}
            className="lg:hidden flex items-center gap-2 min-h-[44px]"
            aria-label="Chart Replay home"
          >
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#2962ff] via-sky-500 to-emerald-400 flex items-center justify-center text-white font-black text-[10px] ring-1 ring-white/20">
              CR
            </div>
            <span className="font-extrabold text-sm tracking-tight text-white">
              CHART{' '}
              <span className="bg-gradient-to-r from-sky-400 to-emerald-400 bg-clip-text text-transparent">REPLAY</span>
            </span>
          </button>
        </div>

        {/* Center Auth Form Container */}
        <div className="relative w-full max-w-md mx-auto my-6 sm:my-8 lg:my-auto lp-fade-up">
          <div className="mb-6">
            <h1 className="text-[1.75rem] leading-tight sm:text-3xl font-black text-white tracking-tight">
              {mode === 'login'
                ? 'Sign in to your account'
                : mode === 'signup'
                ? 'Create your account'
                : 'Reset your password'}
            </h1>
            <p className="text-xs sm:text-sm text-[#8b909a] mt-1.5">
              {mode === 'login'
                ? 'Enter your details below to enter the trading system.'
                : mode === 'signup'
                ? 'Start replaying historical charts and testing strategies.'
                : 'Choose a new password for your trading account.'}
            </p>
          </div>

          {/* Clean Sign In / Sign Up Mode Switcher */}
          <div className="grid grid-cols-2 p-1 rounded-xl bg-[#0e121b]/90 border border-white/[0.08] mb-6 text-sm sm:text-xs font-bold">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setErrorMsg(null);
                setSuccessMsg(null);
              }}
              className={`min-h-[44px] py-2.5 rounded-lg transition ${
                mode === 'login'
                  ? 'bg-gradient-to-r from-emerald-500 to-[#2962ff] text-white shadow-md'
                  : 'text-[#8b909a] hover:text-white'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('signup');
                setErrorMsg(null);
                setSuccessMsg(null);
                if (email === 'trader@chartflow.io') {
                  setEmail('');
                  setPassword('');
                }
              }}
              className={`min-h-[44px] py-2.5 rounded-lg transition ${
                mode === 'signup'
                  ? 'bg-gradient-to-r from-emerald-500 to-[#2962ff] text-white shadow-md'
                  : 'text-[#8b909a] hover:text-white'
              }`}
            >
              Sign Up
            </button>
          </div>

          {successMsg && (
            <div className="mb-4 p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-sm sm:text-xs flex items-center gap-2 break-words">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                  Full Name
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-[#787b86] absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    placeholder="Alex Mercer"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full min-h-[48px] pl-10 pr-4 py-3 rounded-xl bg-[#0d111a]/90 border border-white/[0.09] hover:border-white/[0.16] focus:border-emerald-400/70 focus:ring-2 focus:ring-emerald-400/20 text-base sm:text-sm text-white placeholder:text-gray-500 outline-none transition"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-[#787b86] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full min-h-[48px] pl-10 pr-4 py-3 rounded-xl bg-[#0d111a]/90 border border-white/[0.09] hover:border-white/[0.16] focus:border-emerald-400/70 focus:ring-2 focus:ring-emerald-400/20 text-base sm:text-sm text-white placeholder:text-gray-500 outline-none transition"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-gray-300">
                  {mode === 'reset' ? 'New Password' : 'Password'}
                </label>
                {mode === 'login' && (
                  <button
                    type="button"
                    onClick={() => {
                      setMode('reset');
                      setPassword('');
                      setErrorMsg(null);
                    }}
                    className="min-h-[44px] -my-3 px-1 text-xs sm:text-[11px] text-sky-400 hover:text-sky-300 hover:underline font-medium"
                  >
                    Forgot password?
                  </button>
                )}
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-[#787b86] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full min-h-[48px] pl-10 pr-4 py-3 rounded-xl bg-[#0d111a]/90 border border-white/[0.09] hover:border-white/[0.16] focus:border-emerald-400/70 focus:ring-2 focus:ring-emerald-400/20 text-base sm:text-sm text-white placeholder:text-gray-500 outline-none transition"
                />
              </div>
            </div>

            {mode === 'reset' && (
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                  Confirm New Password
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-[#787b86] absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full min-h-[48px] pl-10 pr-4 py-3 rounded-xl bg-[#0d111a]/90 border border-white/[0.09] hover:border-white/[0.16] focus:border-emerald-400/70 focus:ring-2 focus:ring-emerald-400/20 text-base sm:text-sm text-white placeholder:text-gray-500 outline-none transition"
                  />
                </div>
              </div>
            )}

            {errorMsg && (
              <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-300 text-sm sm:text-xs break-words">
                {errorMsg}
              </div>
            )}

            <button
              type="submit"
              className="lp-btn-primary w-full py-3.5 min-h-[48px] text-base sm:text-sm"
            >
              <span>
                {mode === 'login'
                  ? 'Sign In'
                  : mode === 'signup'
                  ? 'Create Account'
                  : 'Update Password'}
              </span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Quick Demo Access */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/[0.08]" />
            </div>
            <div className="relative flex justify-center text-[11px] uppercase">
              <span className="bg-[#06080d] px-3 text-[#787b86] font-mono">
                Or Instant Access
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleQuickDemoLogin}
            className="w-full min-h-[48px] py-3 px-4 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.1] hover:border-emerald-400/40 text-gray-200 font-semibold text-sm sm:text-xs flex items-center justify-center gap-2 transition"
          >
            <Zap className="w-3.5 h-3.5 text-emerald-400" />
            <span>Continue with Demo Account</span>
          </button>
        </div>

        {/* Bottom Note */}
        <div className="relative text-center text-xs sm:text-[11px] text-[#787b86] break-words">
          Demo credentials pre-filled: <span className="font-mono text-gray-400">trader@chartflow.io</span> / <span className="font-mono text-gray-400">demo1234</span>
        </div>
      </div>
    </div>
  );
};
