import React, { useState } from 'react';
import {
  Star,
  X,
  Send,
  CheckCircle2,
  Handshake,
  MessageSquarePlus,
} from 'lucide-react';
import {
  submitTraderPlatformFeedback,
  OFFICIAL_CONTACT_EMAIL,
  PERSONAL_CONTACT_EMAIL,
} from '../services/platformAccounts';
import { ChartReplayLogo } from './ChartReplayLogo';

const EXPERIENCE_POPUP_STORAGE_KEY = 'chart_replay_once_experience_popup_v1';
const memorySeenPopupKeys = new Set<string>();

export function hasSeenExperiencePopup(userEmail?: string | null): boolean {
  if (memorySeenPopupKeys.has(EXPERIENCE_POPUP_STORAGE_KEY)) {
    return true;
  }
  const normalized = userEmail ? userEmail.trim().toLowerCase() : '';
  if (
    normalized &&
    memorySeenPopupKeys.has(`${EXPERIENCE_POPUP_STORAGE_KEY}:${normalized}`)
  ) {
    return true;
  }
  try {
    if (
      typeof localStorage !== 'undefined' &&
      localStorage.getItem(EXPERIENCE_POPUP_STORAGE_KEY) === '1'
    ) {
      return true;
    }
    if (
      normalized &&
      typeof localStorage !== 'undefined' &&
      localStorage.getItem(`${EXPERIENCE_POPUP_STORAGE_KEY}:${normalized}`) === '1'
    ) {
      return true;
    }
  } catch {
    // Ignore storage read errors
  }
  return false;
}

export function markExperiencePopupSeen(userEmail?: string | null): void {
  memorySeenPopupKeys.add(EXPERIENCE_POPUP_STORAGE_KEY);
  const normalized = userEmail ? userEmail.trim().toLowerCase() : '';
  if (normalized) {
    memorySeenPopupKeys.add(`${EXPERIENCE_POPUP_STORAGE_KEY}:${normalized}`);
  }
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(EXPERIENCE_POPUP_STORAGE_KEY, '1');
      if (normalized) {
        localStorage.setItem(`${EXPERIENCE_POPUP_STORAGE_KEY}:${normalized}`, '1');
      }
    }
  } catch {
    // Ignore storage write errors
  }
}

interface ExperienceReviewPopupProps {
  isOpen: boolean;
  triggerReason?: 'logout' | 'navigate';
  userName?: string;
  userEmail?: string;
  userId?: string | null;
  onDismissAndContinue: () => void;
  onOpenPartners: () => void;
  onOpenContactUs: () => void;
}

const RATING_LABELS: Record<number, string> = {
  1: 'Needs work',
  2: 'Fair',
  3: 'Good',
  4: 'Great',
  5: 'Excellent',
};

export const ExperienceReviewPopup: React.FC<ExperienceReviewPopupProps> = ({
  isOpen,
  triggerReason = 'navigate',
  userName = '',
  userEmail = '',
  userId = null,
  onDismissAndContinue,
  onOpenPartners,
  onOpenContactUs,
}) => {
  const [rating, setRating] = useState<number>(5);
  const [hoveredStar, setHoveredStar] = useState<number | null>(null);
  const [improvementNote, setImprovementNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  if (!isOpen) return null;

  const displayStar = hoveredStar ?? rating;

  const handleQuickSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await submitTraderPlatformFeedback({
        name: userName.trim() || 'Trader',
        email: userEmail.trim() || 'anonymous@chartreplay.co.za',
        userId,
        ratingUserFriendliness: rating,
        ratingCharts: rating,
        ratingSmoothness: rating,
        improvementsText:
          improvementNote.trim() ||
          `Quick ${rating}/5 star experience review submitted via one-time popup.`,
        source: 'once_popup',
      });
    } catch {
      // Non-blocking so user is never stuck
    } finally {
      setSubmitting(false);
      setSubmitted(true);
      setTimeout(() => {
        onDismissAndContinue();
      }, 900);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[9998] flex items-center justify-center bg-[#040810]/80 backdrop-blur-md p-4 animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="once-experience-popup-title"
    >
      <div className="relative w-full max-w-md rounded-3xl border border-white/[0.08] bg-gradient-to-b from-[#0d1626] to-[#09101b] text-slate-200 shadow-2xl overflow-hidden">
        <div className="h-1 w-full bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400" />

        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-6 pt-5 pb-2">
          <div className="flex items-center gap-2.5">
            <ChartReplayLogo size={24} />
            <h2
              id="once-experience-popup-title"
              className="text-lg font-extrabold tracking-tight text-white"
            >
              Rate your experience
            </h2>
          </div>
          <button
            type="button"
            onClick={onDismissAndContinue}
            title="Close"
            className="rounded-xl border border-white/10 bg-white/[0.03] p-1.5 text-slate-400 hover:bg-white/[0.08] hover:text-white transition shrink-0"
          >
            <X size={16} />
          </button>
        </div>

        {submitted ? (
          <div className="px-6 py-8 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-400/20 text-emerald-300">
              <CheckCircle2 size={24} />
            </div>
            <h3 className="text-base font-extrabold text-white">Thanks!</h3>
          </div>
        ) : (
          <form onSubmit={handleQuickSubmit} className="px-6 pb-5 pt-2 space-y-3.5">
            {/* Stars */}
            <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-3.5">
              <div className="flex items-center justify-between mb-2.5">
                <span className="text-xs font-semibold text-slate-400">Your rating</span>
                <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-2.5 py-0.5 text-[11px] font-bold text-amber-300">
                  {displayStar}/5 · {RATING_LABELS[displayStar]}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {[1, 2, 3, 4, 5].map((star) => {
                  const active = star <= displayStar;
                  return (
                    <button
                      key={star}
                      type="button"
                      onMouseEnter={() => setHoveredStar(star)}
                      onMouseLeave={() => setHoveredStar(null)}
                      onClick={() => setRating(star)}
                      className={`group flex flex-1 items-center justify-center gap-1 rounded-xl border py-2.5 text-xs font-bold transition-all ${
                        active
                          ? 'border-amber-400/40 bg-amber-400/10 text-amber-300 shadow-[0_0_20px_-6px_rgba(251,191,36,0.4)]'
                          : 'border-white/[0.07] bg-white/[0.02] text-slate-500 hover:border-white/15 hover:text-slate-300'
                      }`}
                    >
                      <Star
                        size={16}
                        className={`transition-transform group-hover:scale-110 ${
                          active
                            ? 'fill-amber-400 text-amber-400'
                            : 'fill-transparent text-slate-600'
                        }`}
                      />
                      <span>{star}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Optional quick note */}
            <textarea
              rows={2}
              value={improvementNote}
              onChange={(e) => setImprovementNote(e.target.value)}
              placeholder="Any feedback or ideas? (optional)"
              className="w-full rounded-xl border border-white/10 bg-black/30 px-3.5 py-2.5 text-xs sm:text-sm text-white placeholder-slate-500 outline-none transition focus:border-emerald-400/50 resize-none"
            />

            {/* Actions */}
            <div className="flex items-center gap-2">
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-400 to-cyan-400 px-4 py-2.5 text-xs sm:text-sm font-extrabold text-slate-950 shadow-lg transition hover:brightness-110 disabled:opacity-60"
              >
                <Send size={14} />
                {submitting ? 'Sending...' : 'Submit'}
              </button>
              <button
                type="button"
                onClick={onDismissAndContinue}
                className="rounded-xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.07] px-4 py-2.5 text-xs sm:text-sm font-semibold text-slate-300 hover:text-white transition"
              >
                {triggerReason === 'logout' ? 'Log Out' : 'Skip'}
              </button>
            </div>

            {/* Minimal footer */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.07] pt-3 text-[11px] text-slate-400">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onOpenPartners}
                  className="inline-flex items-center gap-1 rounded-lg border border-emerald-400/25 bg-emerald-400/10 hover:bg-emerald-400/15 px-2.5 py-1 font-semibold text-emerald-300 transition"
                >
                  <Handshake size={12} />
                  Partner
                </button>
                <button
                  type="button"
                  onClick={onOpenContactUs}
                  className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.03] hover:bg-white/[0.07] px-2.5 py-1 font-semibold text-slate-300 hover:text-white transition"
                >
                  <MessageSquarePlus size={12} />
                  Contact
                </button>
              </div>
              <div className="flex items-center gap-2 font-mono">
                <a
                  href={`mailto:${OFFICIAL_CONTACT_EMAIL}`}
                  className="text-emerald-300 hover:underline"
                >
                  {OFFICIAL_CONTACT_EMAIL}
                </a>
                <span className="text-slate-600">·</span>
                <a
                  href={`mailto:${PERSONAL_CONTACT_EMAIL}`}
                  className="text-cyan-300 hover:underline"
                >
                  {PERSONAL_CONTACT_EMAIL}
                </a>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
