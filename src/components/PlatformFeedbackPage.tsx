import React, { FormEvent, useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  MessageSquareHeart,
  Send,
  Sparkles,
  Star,
} from 'lucide-react';
import { ChartReplayLogo } from './ChartReplayLogo';
import { submitTraderPlatformFeedback } from '../services/platformAccounts';

const STAR_LABELS: Record<number, { label: string; color: string }> = {
  1: { label: '1 / 5 · Needs work', color: 'text-rose-400' },
  2: { label: '2 / 5 · Fair', color: 'text-amber-400' },
  3: { label: '3 / 5 · Good', color: 'text-yellow-300' },
  4: { label: '4 / 5 · Great', color: 'text-cyan-300' },
  5: { label: '5 / 5 · Best!', color: 'text-emerald-300' },
};

interface StarRatingRowProps {
  title: string;
  subtitle: string;
  value: number;
  onChange: (next: number) => void;
}

function StarRatingRow({
  title,
  subtitle,
  value,
  onChange,
}: StarRatingRowProps) {
  const [hovered, setHovered] = useState<number | null>(null);
  const activeScore = hovered ?? value;
  const meta = STAR_LABELS[activeScore] || STAR_LABELS[5];

  return (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-4 sm:p-5 transition hover:border-emerald-400/25">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm sm:text-base font-bold text-white">{title}</h3>
          <p className="mt-0.5 text-xs text-slate-400">{subtitle}</p>
        </div>
        <span
          className={`inline-flex items-center gap-1 rounded-full bg-white/[0.05] px-3 py-1 text-xs font-bold ${meta.color}`}
        >
          {meta.label}
        </span>
      </div>

      <div
        className="mt-4 flex items-center gap-2 sm:gap-3"
        onMouseLeave={() => setHovered(null)}
      >
        {[1, 2, 3, 4, 5].map((star) => {
          const filled = star <= activeScore;
          return (
            <button
              key={star}
              type="button"
              onMouseEnter={() => setHovered(star)}
              onClick={() => onChange(star)}
              aria-label={`Rate ${title} ${star} out of 5 stars`}
              className={`group flex flex-1 flex-col items-center justify-center gap-1 rounded-xl border py-2.5 px-2 transition ${
                filled
                  ? 'border-amber-400/40 bg-amber-400/10 text-amber-300 shadow-[0_0_20px_-6px_rgba(251,191,36,0.4)]'
                  : 'border-white/10 bg-black/20 text-slate-600 hover:border-white/20 hover:text-slate-400'
              }`}
            >
              <Star
                size={22}
                className={`transition-transform group-hover:scale-110 ${
                  filled ? 'fill-amber-400 text-amber-400' : 'text-slate-600'
                }`}
              />
              <span className="text-[10px] font-bold tracking-wide">
                {star} {star === 5 ? '(Best)' : star === 1 ? '(Low)' : ''}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export interface PlatformFeedbackPageProps {
  initialName?: string | null;
  initialEmail?: string | null;
  userId?: string | null;
  onBack: () => void;
}

export const PlatformFeedbackPage: React.FC<PlatformFeedbackPageProps> = ({
  initialName,
  initialEmail,
  userId,
  onBack,
}) => {
  const [name, setName] = useState(() => (initialName || '').trim() || '');
  const [email, setEmail] = useState(() => (initialEmail || '').trim() || '');
  const [ratingUserFriendliness, setRatingUserFriendliness] = useState(5);
  const [ratingCharts, setRatingCharts] = useState(5);
  const [ratingSmoothness, setRatingSmoothness] = useState(5);
  const [improvementsText, setImprovementsText] = useState('');
  const [favoriteText, setFavoriteText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const overallAverage = (
    (ratingUserFriendliness + ratingCharts + ratingSmoothness) /
    3
  ).toFixed(1);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const result = await submitTraderPlatformFeedback({
        name: name.trim() || 'Trader',
        email: email.trim() || 'trader@chartreplay.co.za',
        userId: userId || null,
        ratingUserFriendliness,
        ratingCharts,
        ratingSmoothness,
        improvementsText,
        favoriteText,
        source: 'email_link',
      });
      if (!result.ok) {
        setError(
          result.error || 'Could not submit feedback right now. Please try again.'
        );
        return;
      }
      setSubmitted(true);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Could not submit feedback right now. Please try again.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-[100dvh] overflow-y-auto bg-[#070d17] text-slate-200 bg-[radial-gradient(ellipse_at_top,rgba(16,185,129,0.15),transparent_55%)]">
      <div className="mx-auto max-w-3xl px-5 py-8 sm:py-12">
        <div className="flex items-center justify-between gap-4">
          <ChartReplayLogo size={36} />
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2 text-xs font-semibold text-slate-300 hover:bg-white/[0.08] transition"
          >
            <ArrowLeft size={14} />
            Back to platform
          </button>
        </div>

        {submitted ? (
          <section className="mt-10 rounded-3xl border border-emerald-400/30 bg-gradient-to-br from-emerald-500/10 via-[#0c1524] to-[#09101c] p-8 sm:p-10 text-center shadow-2xl">
            <div className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-2xl bg-emerald-400/15 text-emerald-300 border border-emerald-400/30">
              <CheckCircle2 size={34} />
            </div>
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-300">
              Feedback Saved to Supabase
            </p>
            <h1 className="mt-2 text-2xl sm:text-3xl font-extrabold text-white">
              Thank you{name.trim() ? `, ${name.trim()}` : ''}!
            </h1>
            <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-slate-300">
              Your star ratings ({overallAverage} / 5.0 ★) and feedback have been
              sent directly to our administrator dashboard so we can keep making
              Chart Replay better for you.
            </p>
            <div className="mt-6 inline-flex flex-wrap justify-center gap-3 rounded-2xl border border-white/10 bg-black/30 px-5 py-3 text-xs">
              <span className="text-slate-300">
                User Friendliness:{' '}
                <strong className="text-amber-300">
                  {ratingUserFriendliness}★
                </strong>
              </span>
              <span className="text-slate-600">•</span>
              <span className="text-slate-300">
                Charts:{' '}
                <strong className="text-amber-300">{ratingCharts}★</strong>
              </span>
              <span className="text-slate-600">•</span>
              <span className="text-slate-300">
                Smoothness:{' '}
                <strong className="text-amber-300">{ratingSmoothness}★</strong>
              </span>
            </div>
            <div className="mt-8">
              <button
                type="button"
                onClick={onBack}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-400 to-cyan-400 px-6 py-3 text-sm font-extrabold text-slate-950 shadow-lg hover:brightness-110 transition"
              >
                Return to Trading Platform →
              </button>
            </div>
          </section>
        ) : (
          <section className="mt-8 rounded-3xl border border-white/[0.08] bg-gradient-to-b from-[#0d1626] to-[#09101b] p-6 sm:p-9 shadow-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3.5 py-1 text-[11px] font-bold uppercase tracking-wider text-emerald-300">
              <MessageSquareHeart size={14} />
              Trader Platform Feedback
            </div>

            <h1 className="mt-4 text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              Hi {name.trim() || 'Trader'}, we saw you placed your first trade!
            </h1>
            <p className="mt-3 text-sm sm:text-base leading-relaxed text-slate-300">
              How did you find our platform? Is it user-friendly? Let us know if
              we can improve it and where we can improve it.{' '}
              <span className="font-semibold text-emerald-300">
                Your feedback is valuable.
              </span>
            </p>

            <form onSubmit={handleSubmit} className="mt-7 space-y-6">
              {/* Name & Email row */}
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="fb-trader-name"
                    className="block text-xs font-semibold text-slate-400 mb-1.5"
                  >
                    Your Name
                  </label>
                  <input
                    id="fb-trader-name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Alex Mercer"
                    maxLength={80}
                    className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-2.5 text-sm text-white outline-none focus:border-emerald-400/50"
                  />
                </div>
                <div>
                  <label
                    htmlFor="fb-trader-email"
                    className="block text-xs font-semibold text-slate-400 mb-1.5"
                  >
                    Your Account Email
                  </label>
                  <input
                    id="fb-trader-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    maxLength={254}
                    className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-2.5 text-sm text-white outline-none focus:border-emerald-400/50"
                  />
                </div>
              </div>

              {/* 3 Star Rating Categories */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold uppercase tracking-wider text-cyan-300">
                    Rate Your Experience (1 to 5 Stars · 5 is Best)
                  </p>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-xs font-extrabold text-amber-300">
                    <Sparkles size={13} />
                    Overall: {overallAverage} / 5.0 ★
                  </span>
                </div>

                <StarRatingRow
                  title="1. User Friendliness"
                  subtitle="How easy was it to set up your account, create a session, and find your tools?"
                  value={ratingUserFriendliness}
                  onChange={setRatingUserFriendliness}
                />

                <StarRatingRow
                  title="2. Charts & Replay Tools"
                  subtitle="How do you rate the candlestick charts, drawing tools, indicators, and bar-by-bar replay?"
                  value={ratingCharts}
                  onChange={setRatingCharts}
                />

                <StarRatingRow
                  title="3. Smoothness & Execution"
                  subtitle="How smooth and responsive is candle playback, order placement, and SL/TP dragging?"
                  value={ratingSmoothness}
                  onChange={setRatingSmoothness}
                />
              </div>

              {/* Written Feedback */}
              <div>
                <label
                  htmlFor="fb-improvements"
                  className="block text-sm font-bold text-white mb-1.5"
                >
                  How can we improve the platform, and where can we improve it?
                </label>
                <p className="text-xs text-slate-400 mb-2.5">
                  Tell us anything that felt confusing, any feature you wish we
                  had, or what would make your trading practice even better.
                </p>
                <textarea
                  id="fb-improvements"
                  rows={4}
                  value={improvementsText}
                  onChange={(e) => setImprovementsText(e.target.value)}
                  placeholder="Share your honest thoughts, ideas, or areas where we can improve…"
                  maxLength={2000}
                  className="w-full rounded-2xl border border-white/10 bg-black/30 p-4 text-sm text-white outline-none focus:border-emerald-400/50 placeholder:text-slate-600"
                />
              </div>

              {error && (
                <p
                  role="alert"
                  className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs text-rose-200"
                >
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 py-3.5 px-6 text-sm font-extrabold text-slate-950 shadow-lg hover:brightness-110 disabled:opacity-50 transition"
              >
                <Send size={16} />
                {submitting
                  ? 'Saving Your Feedback…'
                  : 'Submit Feedback & Star Ratings'}
              </button>
            </form>
          </section>
        )}
      </div>
    </main>
  );
};
