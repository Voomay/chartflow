import React, { useEffect, useState } from 'react';
import { ChartReplayLogo } from './ChartReplayLogo';
import { PlatformPreview } from './LandingExtras';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  KeyRound,
  Lock,
  Mail,
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

export const LoginPage: React.FC<LoginPageProps> = ({
  initialMode = 'login',
  onSuccessAuth,
  onBackToLanding,
}) => {
  const [mode, setMode] = useState<'login' | 'signup' | 'reset'>(initialMode);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
      setEmail((prev) => prev);
      setPassword((prev) => prev);
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
            <ChartReplayLogo size={36} />
          </button>

          <span className="text-[11px] font-mono px-3 py-1 rounded-full bg-white/[0.04] border border-white/[0.08] text-gray-300">
            XAU/USD · NAS100 · EUR/USD
          </span>
        </div>

        {/* Center: same platform mockup as the landing hero */}
        <div className="relative z-10 my-8 lg:my-auto w-full max-w-[720px] mx-auto min-w-0">
          <div className="absolute -inset-6 rounded-[2rem] bg-gradient-to-tr from-[#2962ff]/20 via-transparent to-emerald-400/20 blur-2xl pointer-events-none" aria-hidden="true" />
          <div className="relative">
            <PlatformPreview />
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
            <ChartReplayLogo size={32} />
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
            <span>Sign in as Guest</span>
          </button>
        </div>
      </div>
    </div>
  );
};
