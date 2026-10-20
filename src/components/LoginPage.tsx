import React, { useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Compass,
  Lock,
  LogOut,
  Mail,
  Scissors,
  Sparkles,
  Target,
  User,
  Zap,
} from 'lucide-react';

export interface ChartFlowUser {
  name: string;
  email: string;
  plan: 'FREE_FOREVER';
  joinedAt: string;
}

interface LoginPageProps {
  initialMode?: 'login' | 'signup';
  currentUser: ChartFlowUser | null;
  onSuccessAuth: (user: ChartFlowUser) => void;
  onLogout: () => void;
  onBackToLanding: () => void;
  onSkipToTerminal: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({
  initialMode = 'login',
  currentUser,
  onSuccessAuth,
  onLogout,
  onBackToLanding,
  onSkipToTerminal,
}) => {
  const [mode, setMode] = useState<'login' | 'signup'>(initialMode);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !trimmedEmail.includes('@')) {
      setErrorMsg('Please enter a valid email address.');
      return;
    }
    if (password.length < 4) {
      setErrorMsg('Please enter a password (at least 4 characters).');
      return;
    }

    const derivedName =
      mode === 'signup' && name.trim()
        ? name.trim()
        : trimmedEmail.split('@')[0].replace(/[._-]/g, ' ');

    const formattedName =
      derivedName.charAt(0).toUpperCase() + derivedName.slice(1);

    onSuccessAuth({
      name: formattedName,
      email: trimmedEmail,
      plan: 'FREE_FOREVER',
      joinedAt: new Date().toISOString().slice(0, 10),
    });
  };

  const handleQuickDemoLogin = () => {
    onSuccessAuth({
      name: 'Alex Mercer (Free Trader)',
      email: 'trader@chartflow.io',
      plan: 'FREE_FOREVER',
      joinedAt: new Date().toISOString().slice(0, 10),
    });
  };

  return (
    <div className="h-screen w-screen bg-[#0b0e14] text-[#d1d4dc] flex flex-col justify-between relative overflow-y-auto custom-scrollbar selection:bg-blue-500/30">
      {/* Ambient Background Glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-[#2962ff]/15 blur-[130px] rounded-full pointer-events-none" />

      {/* Top Bar */}
      <header className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between relative z-10">
        <button
          onClick={onBackToLanding}
          className="flex items-center gap-2 text-xs font-semibold text-gray-300 hover:text-white transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Chart Flow Home</span>
        </button>

        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#2962ff] to-emerald-400 flex items-center justify-center text-white font-black text-xs">
            CF
          </div>
          <span className="font-extrabold text-sm tracking-tight text-white">
            CHART <span className="text-[#2962ff]">FLOW</span>
          </span>
        </div>

        <button
          onClick={onSkipToTerminal}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#1e222d] hover:bg-[#262b38] border border-[#2a2e39] text-xs font-bold text-emerald-400 transition"
        >
          <span>Open Terminal Directly</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 relative z-10">
        <div className="w-full max-w-4xl grid grid-cols-1 lg:grid-cols-12 rounded-2xl border border-[#2a2e39] bg-[#131722] shadow-[0_25px_70px_rgba(0,0,0,0.65)] overflow-hidden">
          {/* Left Side: Value Proposition */}
          <div className="lg:col-span-5 p-6 sm:p-8 bg-gradient-to-b from-[#171b26] to-[#131722] border-b lg:border-b-0 lg:border-r border-[#2a2e39] flex flex-col justify-between">
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[10px] font-mono font-bold mb-4">
                <Sparkles className="w-3 h-3" />
                EVERYTHING IS 100% FREE
              </div>

              <h2 className="text-2xl font-black text-white leading-snug mb-2">
                Welcome to Chart Flow.
              </h2>
              <p className="text-xs text-[#9ca3af] leading-relaxed mb-6">
                No credit cards, no locked indicators, and no monthly subscriptions. Log in or
                create a free account to sync your strategy backtests, drawings, and analytics.
              </p>

              <div className="space-y-3.5 text-xs">
                <div className="flex items-start gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-[#2962ff]/15 text-[#2962ff] flex items-center justify-center shrink-0 mt-0.5">
                    <Scissors className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-bold text-white">Free Bar-by-Bar Backtesting</div>
                    <div className="text-[#787b86] text-[11px]">
                      Rewind any timeframe (1m–1D) and replay historical price action at your own
                      speed.
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-emerald-500/15 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                    <Target className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-bold text-white">Test Your Strategy ($100k Sim)</div>
                    <div className="text-[#787b86] text-[11px]">
                      Execute Market & Pending orders from interactive Long/Short boxes on the
                      chart.
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-amber-500/15 text-amber-400 flex items-center justify-center shrink-0 mt-0.5">
                    <BarChart3 className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-bold text-white">Free Performance Analytics</div>
                    <div className="text-[#787b86] text-[11px]">
                      Instant Win Rate, Profit Factor, R-Multiple expectancy & Session breakdown.
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-purple-500/15 text-purple-400 flex items-center justify-center shrink-0 mt-0.5">
                    <Compass className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-bold text-white">Free Chart Analysis Tools</div>
                    <div className="text-[#787b86] text-[11px]">
                      Fibonacci, Orderblocks, Session Killzones, S/R levels & AI sentiment engine.
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-[#2a2e39] flex items-center justify-between text-[11px] font-mono text-[#787b86]">
              <span>PLAN COST</span>
              <span className="text-emerald-400 font-bold">$0.00 / FOREVER FREE</span>
            </div>
          </div>

          {/* Right Side: Login / Sign Up Form */}
          <div className="lg:col-span-7 p-6 sm:p-8 flex flex-col justify-center">
            {currentUser ? (
              <div className="space-y-5">
                <div className="flex items-center gap-3 p-4 rounded-xl bg-[#1e222d] border border-emerald-500/40">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#2962ff] to-emerald-400 flex items-center justify-center text-white font-black text-lg">
                    {currentUser.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold text-white">{currentUser.name}</h3>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold">
                        FREE FOREVER UNLOCKED
                      </span>
                    </div>
                    <p className="text-xs text-[#787b86] font-mono">{currentUser.email}</p>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-[#171b26] border border-[#2a2e39] space-y-2 text-xs">
                  <div className="font-bold text-white">Your Active Free Entitlements:</div>
                  <div className="grid grid-cols-2 gap-2 text-gray-300">
                    <div className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Unlimited Bar Replay</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      <span>$100k Strategy Tester</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Full Analytics Suite</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      <span>All 12+ Markets & Tools</span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    onClick={onSkipToTerminal}
                    className="flex-1 py-3 px-4 rounded-xl bg-[#2962ff] hover:bg-[#1e53e5] text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg transition"
                  >
                    <span>Return to Chart Flow Terminal</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                  <button
                    onClick={onLogout}
                    className="py-3 px-4 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 font-bold text-xs flex items-center gap-1.5 transition"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* Mode Switcher Tabs */}
                <div className="grid grid-cols-2 p-1 rounded-xl bg-[#0b0e14] border border-[#2a2e39] mb-6 text-xs font-bold">
                  <button
                    type="button"
                    onClick={() => {
                      setMode('login');
                      setErrorMsg(null);
                    }}
                    className={`py-2.5 rounded-lg transition ${
                      mode === 'login'
                        ? 'bg-[#2962ff] text-white shadow'
                        : 'text-[#787b86] hover:text-white'
                    }`}
                  >
                    Sign In
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMode('signup');
                      setErrorMsg(null);
                    }}
                    className={`py-2.5 rounded-lg transition ${
                      mode === 'signup'
                        ? 'bg-[#2962ff] text-white shadow'
                        : 'text-[#787b86] hover:text-white'
                    }`}
                  >
                    Create Free Account ($0)
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  {mode === 'signup' && (
                    <div>
                      <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                        Your Trader Name
                      </label>
                      <div className="relative">
                        <User className="w-4 h-4 text-[#787b86] absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          placeholder="e.g. Jordan Belfort"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#0b0e14] border border-[#2a2e39] focus:border-[#2962ff] text-sm text-white outline-none transition"
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
                        placeholder="you@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#0b0e14] border border-[#2a2e39] focus:border-[#2962ff] text-sm text-white outline-none transition"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                      Password
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-[#787b86] absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="password"
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#0b0e14] border border-[#2a2e39] focus:border-[#2962ff] text-sm text-white outline-none transition"
                      />
                    </div>
                  </div>

                  {errorMsg && (
                    <div className="p-2.5 rounded-lg bg-rose-500/15 border border-rose-500/40 text-rose-300 text-xs">
                      {errorMsg}
                    </div>
                  )}

                  <button
                    type="submit"
                    className="w-full py-3 rounded-xl bg-[#2962ff] hover:bg-[#1e53e5] text-white font-bold text-xs sm:text-sm shadow-[0_0_25px_rgba(41,98,255,0.4)] transition flex items-center justify-center gap-2"
                  >
                    <span>
                      {mode === 'login'
                        ? 'Sign In & Launch Free Terminal'
                        : 'Create 100% Free Account & Launch'}
                    </span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </form>

                {/* Divider */}
                <div className="relative my-5">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-[#2a2e39]" />
                  </div>
                  <div className="relative flex justify-center text-[11px] uppercase">
                    <span className="bg-[#131722] px-3 text-[#787b86] font-mono">
                      Or Instant 1-Click Access
                    </span>
                  </div>
                </div>

                {/* Instant Access Buttons */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={handleQuickDemoLogin}
                    className="py-2.5 px-3 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 text-emerald-300 font-bold text-xs flex items-center justify-center gap-1.5 transition"
                  >
                    <Zap className="w-3.5 h-3.5" />
                    <span>1-Click Free Trader Login</span>
                  </button>

                  <button
                    type="button"
                    onClick={onSkipToTerminal}
                    className="py-2.5 px-3 rounded-xl bg-[#1e222d] hover:bg-[#262b38] border border-[#2a2e39] text-gray-200 font-bold text-xs flex items-center justify-center gap-1.5 transition"
                  >
                    <span>Continue as Guest (Free)</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </main>

      {/* Footer Note */}
      <footer className="py-4 text-center text-[11px] text-[#787b86] relative z-10">
        Chart Flow Platform · Free Backtesting, Strategy Testing, Analytics & Chart Analysis Tools
      </footer>
    </div>
  );
};
