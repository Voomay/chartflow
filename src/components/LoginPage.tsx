import {platformRequest,serverAccountRequest,requestPasswordResetEmail,completePasswordResetWithToken} from '../services/platformAccounts';
import {hasSeenChartAnnouncement} from './ChartAnnouncement';
import {hasSeenWorkspaceTour} from './WorkspaceTour';
import {applyPageSeo,buildAuthJsonLd} from '../services/seo';
import React, { useEffect, useState } from 'react';
import { ChartReplayLogo } from './ChartReplayLogo';
import { LegalDocumentKey } from './LegalLinks';
import { PlatformPreview } from './LandingExtras';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  Mail,
  User,
} from 'lucide-react';
import {
  authenticateUserAccount,
  RegisteredUser,
  registerUserAccount,
  resetUserPassword,
  getRegisteredUsers,
} from '../services/storageAndAnalytics';

export interface ChartFlowUser {
  id?: string;
  name: string;
  email: string;
  plan: 'FREE_FOREVER';
  joinedAt: string;
  loginCount?: number;
  isReturningLogin?: boolean;
}

interface LoginPageProps {
  initialMode?: 'login' | 'signup' | 'reset';
  onModeChange?: (mode: 'login' | 'signup' | 'reset') => void;
  initialResetToken?: string | null;
  initialEmail?: string | null;
  onClearResetToken?: () => void;
  currentUser: ChartFlowUser | null;
  onSuccessAuth: (user: ChartFlowUser) => void;
  onLogout: () => void;
  onBackToLanding: () => void;
  onSkipToTerminal: () => void;
  onOpenLegal?: (page: LegalDocumentKey) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({
  initialMode = 'login',
  onModeChange,
  initialResetToken = null,
  initialEmail = null,
  onClearResetToken,
  onSuccessAuth,
  onBackToLanding,
  onOpenLegal,
}) => {
  const [submitting,setSubmitting]=useState(false);
  const [serverAccounts,setServerAccounts]=useState(false);
  useEffect(()=>{void platformRequest('status').then(result=>setServerAccounts(result.enabled===true)).catch(()=>{});},[]);
  const [mode, setMode] = useState<'login' | 'signup' | 'reset'>(
    initialResetToken ? 'reset' : initialMode
  );
  const [resetToken, setResetToken] = useState<string | null>(initialResetToken);
  const [name, setName] = useState('');
  const [email, setEmail] = useState(initialEmail || '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (initialResetToken) {
      setResetToken(initialResetToken);
      setMode('reset');
      if (initialEmail) setEmail(initialEmail);
      setErrorMsg(null);
      setSuccessMsg(null);
      return;
    }
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
  }, [initialMode, initialResetToken, initialEmail]);

  useEffect(() => {
    if (mode === 'signup') {
      applyPageSeo({
        title:
          'Sign Up Free – Create Your Forex & Prop Firm Backtesting Account | Chart Replay',
        description:
          'Create your 100% free Chart Replay account (chartreplay.co.za/signup). Practice Forex, Gold (XAUUSD), NAS100 & US30 with candle-by-candle bar replay, FTMO prop firm challenge rules, and R-multiple trade analytics. No credit card needed.',
        path: '/signup',
        type: 'website',
        keywords: [
          'Chart Replay sign up',
          'create Chart Replay account',
          'free FX Replay account',
          'forex backtesting sign up',
          'prop firm simulator register',
        ],
        jsonLd: buildAuthJsonLd('signup'),
      });
    } else if (mode === 'reset') {
      applyPageSeo({
        title: 'Reset Password – Account Recovery | Chart Replay',
        description:
          'Reset your Chart Replay account password to regain access to your client dashboard, backtesting sessions, and trading journal.',
        path: '/reset-password',
        type: 'website',
        jsonLd: buildAuthJsonLd('reset'),
      });
    } else {
      applyPageSeo({
        title:
          'Sign In – Client Login to Dashboard & Bar Replay Charts | Chart Replay',
        description:
          'Sign in to your Chart Replay account (chartreplay.co.za/login) to access your client dashboard, saved historical backtesting sessions, FTMO prop firm challenges, and trading journal.',
        path: '/login',
        type: 'website',
        keywords: [
          'Chart Replay login',
          'Chart Replay sign in',
          'chartreplay.co.za login',
          'forex replay client login',
        ],
        jsonLd: buildAuthJsonLd('login'),
      });
    }
  }, [mode]);

  const handleCompleteUser = (u: RegisteredUser, isReturning = mode === 'login') => {
    const returning =
      isReturning ||
      (typeof u.loginCount === 'number' && u.loginCount > 1) ||
      hasSeenChartAnnouncement(u.email) ||
      hasSeenWorkspaceTour(u.email);
    onSuccessAuth({
      id: u.id,
      name: u.name,
      email: u.email,
      plan: u.plan,
      joinedAt: u.joinedAt,
      loginCount: u.loginCount,
      isReturningLogin: returning,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if(submitting)return;
    if(mode==='login'||mode==='signup'){
      setSubmitting(true);
      try{
        const server=await serverAccountRequest(mode==='signup'?'register':'login',{name,email,password});
        if(server.available){
          if(server.ok&&server.user){handleCompleteUser(server.user);return;}
          const legacy=mode==='login'&&getRegisteredUsers().some(user=>user.email.toLowerCase()===email.trim().toLowerCase()&&user.authSource!=='server'&&Boolean(user.passwordHash));
          if(!legacy){setErrorMsg(server.error||'Unable to sign in.');return;}
        }
      }catch(reason){setErrorMsg(reason instanceof Error?reason.message:'Account service unavailable.');return;}
      finally{setSubmitting(false);}
    }

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
      // Case A: User opened the password reset link from their email (?reset_token=...)
      if (resetToken) {
        if (password.length < 4) {
          setErrorMsg('New password must be at least 4 characters long.');
          return;
        }
        if (confirmPassword && password !== confirmPassword) {
          setErrorMsg('Passwords do not match. Please verify your new password.');
          return;
        }
        setSubmitting(true);
        try {
          const res = await completePasswordResetWithToken(resetToken, password);
          if (!res.ok || !res.user) {
            setErrorMsg(res.error || 'Unable to reset password.');
            return;
          }
          setResetToken(null);
          onClearResetToken?.();
          setPassword('');
          setConfirmPassword('');
          setSuccessMsg(
            `Password for ${res.user.email} has been updated! You can now sign in.`
          );
          setMode('login');
          return;
        } catch (reason) {
          setErrorMsg(
            reason instanceof Error
              ? reason.message
              : 'Unable to update password right now.'
          );
          return;
        } finally {
          setSubmitting(false);
        }
      }

      // Case B: User clicked "Forgot password?" and is requesting a password reset link by email
      if (serverAccounts && !password) {
        if (!email.trim() || !email.includes('@')) {
          setErrorMsg('Please enter the email address for your account.');
          return;
        }
        setSubmitting(true);
        try {
          const reqRes = await requestPasswordResetEmail(email.trim());
          if (reqRes.available) {
            if (!reqRes.ok) {
              setErrorMsg(reqRes.error || 'Unable to send password reset email.');
              return;
            }
            setSuccessMsg(
              reqRes.message ||
                'Check your inbox! We have sent a password reset link to your email address.'
            );
            return;
          }
        } catch (reason) {
          setErrorMsg(
            reason instanceof Error
              ? reason.message
              : 'Could not send password reset email.'
          );
          return;
        } finally {
          setSubmitting(false);
        }
      }

      // Case C: Legacy browser-only profile reset fallback
      if (password.length < 4) {
        setErrorMsg('New password must be at least 4 characters long.');
        return;
      }
      if (confirmPassword && password !== confirmPassword) {
        setErrorMsg('Passwords do not match. Please verify your new password.');
        return;
      }
      if (serverAccounts) {
        setSubmitting(true);
        try {
          const reqRes = await requestPasswordResetEmail(email.trim());
          if (reqRes.available && reqRes.ok) {
            setSuccessMsg(
              reqRes.message ||
                'Check your inbox! We have sent a password reset link to your email address.'
            );
            return;
          }
        } catch {
          // fall through to local check
        } finally {
          setSubmitting(false);
        }
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
                : resetToken
                ? 'Set your new password'
                : serverAccounts
                ? 'Forgot your password?'
                : 'Reset your password'}
            </h1>
            <p className="text-xs sm:text-sm text-[#8b909a] mt-1.5">
              {mode === 'login'
                ? 'Enter your details below to enter the trading system.'
                : mode === 'signup'
                ? 'Start replaying historical charts and testing strategies.'
                : resetToken
                ? 'Enter and confirm your new password below.'
                : serverAccounts
                ? 'Enter your account email and we will send you a secure password reset link.'
                : 'Choose a new password for your trading account.'}
            </p>
          </div>

          {/* Clean Sign In / Sign Up Mode Switcher */}
          <div className="grid grid-cols-2 p-1 rounded-xl bg-[#0e121b]/90 border border-white/[0.08] mb-6 text-sm sm:text-xs font-bold">
            <a
              href="/login"
              onClick={(e) => {
                if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
                e.preventDefault();
                setMode('login');
                onModeChange?.('login');
                setResetToken(null);
                onClearResetToken?.();
                setErrorMsg(null);
                setSuccessMsg(null);
              }}
              className={`min-h-[44px] py-2.5 rounded-lg transition flex items-center justify-center ${
                mode === 'login'
                  ? 'bg-gradient-to-r from-emerald-500 to-[#2962ff] text-white shadow-md'
                  : 'text-[#8b909a] hover:text-white'
              }`}
            >
              Sign In
            </a>
            <a
              href="/signup"
              onClick={(e) => {
                if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
                e.preventDefault();
                setMode('signup');
                onModeChange?.('signup');
                setResetToken(null);
                onClearResetToken?.();
                setErrorMsg(null);
                setSuccessMsg(null);
                if (email === 'trader@chartflow.io') {
                  setEmail('');
                  setPassword('');
                }
              }}
              className={`min-h-[44px] py-2.5 rounded-lg transition flex items-center justify-center ${
                mode === 'signup'
                  ? 'bg-gradient-to-r from-emerald-500 to-[#2962ff] text-white shadow-md'
                  : 'text-[#8b909a] hover:text-white'
              }`}
            >
              Sign Up
            </a>
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
                  readOnly={Boolean(mode === 'reset' && resetToken && email)}
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full min-h-[48px] pl-10 pr-4 py-3 rounded-xl bg-[#0d111a]/90 border border-white/[0.09] hover:border-white/[0.16] focus:border-emerald-400/70 focus:ring-2 focus:ring-emerald-400/20 text-base sm:text-sm text-white placeholder:text-gray-500 outline-none transition"
                />
              </div>
            </div>

            {(mode !== 'reset' || Boolean(resetToken) || !serverAccounts) && (
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
                      onModeChange?.('reset');
                      setResetToken(null);
                      setPassword('');
                      setConfirmPassword('');
                      setErrorMsg(null);
                      setSuccessMsg(null);
                    }}
                    className="min-h-[44px] -my-3 px-1 text-xs sm:text-[11px] text-sky-400 hover:text-sky-300 hover:underline font-medium"
                  >
                    Forgot password?
                  </button>
                )}
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-[#787b86] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder={showPassword ? 'Enter your password' : '••••••••'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full min-h-[48px] pl-10 pr-11 py-3 rounded-xl bg-[#0d111a]/90 border border-white/[0.09] hover:border-white/[0.16] focus:border-emerald-400/70 focus:ring-2 focus:ring-emerald-400/20 text-base sm:text-sm text-white placeholder:text-gray-500 outline-none transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-pressed={showPassword}
                  title={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-[#787b86] hover:text-white hover:bg-white/[0.06] transition"
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
            )}

            {mode === 'reset' && (Boolean(resetToken) || !serverAccounts) && (
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                  Confirm New Password
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-[#787b86] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    required
                    placeholder={
                      showConfirmPassword ? 'Confirm new password' : '••••••••'
                    }
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full min-h-[48px] pl-10 pr-11 py-3 rounded-xl bg-[#0d111a]/90 border border-white/[0.09] hover:border-white/[0.16] focus:border-emerald-400/70 focus:ring-2 focus:ring-emerald-400/20 text-base sm:text-sm text-white placeholder:text-gray-500 outline-none transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((prev) => !prev)}
                    aria-label={
                      showConfirmPassword
                        ? 'Hide confirm password'
                        : 'Show confirm password'
                    }
                    aria-pressed={showConfirmPassword}
                    title={
                      showConfirmPassword
                        ? 'Hide confirm password'
                        : 'Show confirm password'
                    }
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-[#787b86] hover:text-white hover:bg-white/[0.06] transition"
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            )}

            {errorMsg && (
              <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-300 text-sm sm:text-xs break-words">
                {errorMsg}
              </div>
            )}

            <button
              type="submit" disabled={submitting}
              className="lp-btn-primary w-full py-3.5 min-h-[48px] text-base sm:text-sm"
            >
              <span>
                {submitting
                  ? 'Please wait…'
                  : mode === 'login'
                  ? 'Sign In'
                  : mode === 'signup'
                  ? 'Create Account'
                  : resetToken
                  ? 'Save New Password'
                  : serverAccounts
                  ? 'Send Reset Link'
                  : 'Update Password'}
              </span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-emerald-300/90 font-medium">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>100% Free · No credit card needed</span>
          </p>
          <p className="text-[11px] text-slate-400 leading-5 mt-3 text-center">
            Accounts, trading sessions, and journals are securely stored.
          </p>
          <p className="text-[11px] text-slate-500 leading-5 mt-2.5 text-center">
            By signing in or creating an account, you confirm that you are{' '}
            <span className="text-slate-400 font-medium">18 years or older</span> and agree to our{' '}
            <a
              href="/terms"
              onClick={(e) => {
                if (!onOpenLegal || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
                e.preventDefault();
                onOpenLegal('terms');
              }}
              className="text-slate-400 underline hover:text-emerald-400 transition-colors"
            >
              Terms &amp; Conditions
            </a>{' '}
            and{' '}
            <a
              href="/privacy"
              onClick={(e) => {
                if (!onOpenLegal || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
                e.preventDefault();
                onOpenLegal('privacy');
              }}
              className="text-slate-400 underline hover:text-emerald-400 transition-colors"
            >
              Privacy Policy
            </a>
            . Terms &amp; Conditions apply.
          </p>
          <p className="text-[10px] text-slate-500 leading-4 mt-3 text-center">
            Simulated trading platform for educational &amp; practice purposes only · No real money, deposits, or live brokerage execution · Not financial advice
          </p>
        </div>
      </div>
    </div>
  );
};
