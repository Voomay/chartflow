import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  LogIn,
  Mail,
  MessageSquareHeart,
  RefreshCw,
  Search,
  Send,
  Sparkles,
  Star,
} from 'lucide-react';
import {
  AdminUser,
  loadAdminFeedbackData,
  sendAdminFeedbackEmails,
} from '../services/platformAccounts';
import {
  FeedbackEmailLogItem,
  PlatformFeedbackItem,
} from '../services/supabaseClient';

interface AdminFeedbackProps {
  users: AdminUser[];
  preview?: boolean;
  onImpersonateUser: (user: AdminUser) => void;
}

const formatSaDate = (value: string | null | undefined) => {
  if (!value) return 'Not recorded';
  try {
    return new Intl.DateTimeFormat('en-ZA', {
      timeZone: 'Africa/Johannesburg',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).format(new Date(value));
  } catch {
    return value;
  }
};

function StarsBadge({ score, label }: { score: number; label: string }) {
  const rounded = Math.round(score);
  return (
    <div className="flex items-center justify-between gap-2 rounded-xl border border-white/[0.07] bg-black/25 px-3 py-2">
      <span className="text-[11px] text-slate-400">{label}</span>
      <div className="flex items-center gap-1.5">
        <div className="flex items-center">
          {[1, 2, 3, 4, 5].map((n) => (
            <Star
              key={n}
              size={12}
              className={
                n <= rounded
                  ? 'fill-amber-400 text-amber-400'
                  : 'text-slate-700'
              }
            />
          ))}
        </div>
        <span className="font-mono text-xs font-bold text-amber-300">
          {score}/5
        </span>
      </div>
    </div>
  );
}

export const AdminFeedback: React.FC<AdminFeedbackProps> = ({
  users,
  preview = false,
  onImpersonateUser,
}) => {
  const [feedbackList, setFeedbackList] = useState<PlatformFeedbackItem[]>([]);
  const [emailLogs, setEmailLogs] = useState<FeedbackEmailLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const [recipientFilter, setRecipientFilter] = useState<
    'first_trade' | 'all' | 'unsent'
  >('all');
  const [selectedEmails, setSelectedEmails] = useState<Set<string>>(new Set());
  const [statusBanner, setStatusBanner] = useState<{
    tone: 'success' | 'info' | 'error';
    text: string;
    links?: Array<{ name: string; email: string; url: string }>;
  } | null>(null);
  const [copiedEmail, setCopiedEmail] = useState<string | null>(null);

  const refreshFeedback = useCallback(async () => {
    setLoading(true);
    try {
      const res = await loadAdminFeedbackData(preview);
      setFeedbackList(res.feedback);
      setEmailLogs(res.emailLogs);
    } finally {
      setLoading(false);
    }
  }, [preview]);

  useEffect(() => {
    void refreshFeedback();
  }, [refreshFeedback]);

  const sentByEmail = useMemo(() => {
    const map = new Map<string, FeedbackEmailLogItem>();
    for (const log of emailLogs) {
      const key = log.userEmail.toLowerCase();
      if (!map.has(key)) map.set(key, log);
    }
    return map;
  }, [emailLogs]);

  const feedbackByEmail = useMemo(() => {
    const map = new Map<string, PlatformFeedbackItem>();
    for (const item of feedbackList) {
      const key = item.userEmail.toLowerCase();
      if (!map.has(key)) map.set(key, item);
    }
    return map;
  }, [feedbackList]);

  const summary = useMemo(() => {
    if (feedbackList.length === 0) {
      return {
        count: 0,
        overall: 0,
        userFriendliness: 0,
        charts: 0,
        smoothness: 0,
      };
    }
    const count = feedbackList.length;
    const uf =
      feedbackList.reduce((s, i) => s + i.ratingUserFriendliness, 0) / count;
    const ch = feedbackList.reduce((s, i) => s + i.ratingCharts, 0) / count;
    const sm = feedbackList.reduce((s, i) => s + i.ratingSmoothness, 0) / count;
    const ov = (uf + ch + sm) / 3;
    return {
      count,
      overall: Number(ov.toFixed(2)),
      userFriendliness: Number(uf.toFixed(2)),
      charts: Number(ch.toFixed(2)),
      smoothness: Number(sm.toFixed(2)),
    };
  }, [feedbackList]);

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const q = userSearch.trim().toLowerCase();
      if (
        q &&
        !`${u.name} ${u.email}`.toLowerCase().includes(q)
      ) {
        return false;
      }
      if (recipientFilter === 'first_trade') {
        return (u.tradeCount || 0) > 0 || (u.sessionCount || 0) > 0;
      }
      if (recipientFilter === 'unsent') {
        return !sentByEmail.has(u.email.toLowerCase());
      }
      return true;
    });
  }, [users, userSearch, recipientFilter, sentByEmail]);

  const toggleSelectUser = (email: string) => {
    const clean = email.toLowerCase();
    setSelectedEmails((prev) => {
      const next = new Set(prev);
      if (next.has(clean)) next.delete(clean);
      else next.add(clean);
      return next;
    });
  };

  const handleSelectAllFiltered = () => {
    const allFilteredEmails = filteredUsers.map((u) => u.email.toLowerCase());
    const allSelected =
      allFilteredEmails.length > 0 &&
      allFilteredEmails.every((e) => selectedEmails.has(e));
    if (allSelected) {
      setSelectedEmails(new Set());
    } else {
      setSelectedEmails(new Set(allFilteredEmails));
    }
  };

  const handleSendToRecipients = async (
    recipients: Array<{ email: string; name: string }>
  ) => {
    if (recipients.length === 0) return;
    setSending(true);
    setStatusBanner(null);
    try {
      const res = await sendAdminFeedbackEmails(recipients, preview);
      if (!res.ok) {
        setStatusBanner({
          tone: 'error',
          text: res.error || 'Could not send feedback email.',
        });
        return;
      }
      const results = res.results || [];
      const sentCount = results.filter((r) => r.sent).length;
      const links = results.map((r) => ({
        name: r.name,
        email: r.email,
        url: r.feedbackUrl,
      }));
      if (sentCount > 0) {
        setStatusBanner({
          tone: 'success',
          text: `Feedback email sent to ${sentCount} ${
            sentCount === 1 ? 'trader' : 'traders'
          } and logged in Supabase!`,
          links,
        });
      } else {
        setStatusBanner({
          tone: 'info',
          text: `Recorded feedback invitation for ${recipients.length} ${
            recipients.length === 1 ? 'trader' : 'traders'
          } in Supabase. Direct feedback link is ready below (configure RESEND_API_KEY on server for automatic email delivery):`,
          links,
        });
      }
      setSelectedEmails(new Set());
      await refreshFeedback();
    } finally {
      setSending(false);
    }
  };

  const copyFeedbackLink = (user: { name: string; email: string }) => {
    const url = `${window.location.origin}/?feedback=1&email=${encodeURIComponent(
      user.email.toLowerCase()
    )}&name=${encodeURIComponent(user.name)}`;
    void navigator.clipboard?.writeText(url);
    setCopiedEmail(user.email.toLowerCase());
    setTimeout(() => setCopiedEmail(null), 2200);
  };

  const card =
    'rounded-2xl border border-white/[0.08] bg-gradient-to-br from-white/[0.035] to-white/[0.01]';

  return (
    <div className="mt-6 space-y-6">
      {/* Top Summary Metrics */}
      <div className="grid grid-cols-2 xl:grid-cols-5 gap-3 sm:gap-4">
        <section className={`${card} from-amber-500/15 p-4 sm:p-5`}>
          <div className="flex items-center justify-between text-amber-300 mb-3">
            <Star size={18} className="fill-amber-400 text-amber-400" />
            <span className="text-[9px] uppercase tracking-wider opacity-70">
              Supabase Synced
            </span>
          </div>
          <p className="text-[11px] text-slate-400">Overall Rating</p>
          <p className="mt-1 text-2xl sm:text-3xl font-bold text-amber-300">
            {summary.count > 0 ? `${summary.overall} ★` : '—'}
          </p>
        </section>

        <section className={`${card} from-emerald-500/15 p-4 sm:p-5`}>
          <div className="flex items-center justify-between text-emerald-300 mb-3">
            <Sparkles size={18} />
            <span className="text-[9px] uppercase tracking-wider opacity-70">
              1–5 Stars
            </span>
          </div>
          <p className="text-[11px] text-slate-400">User Friendliness</p>
          <p className="mt-1 text-2xl sm:text-3xl font-bold text-emerald-300">
            {summary.count > 0 ? `${summary.userFriendliness} ★` : '—'}
          </p>
        </section>

        <section className={`${card} from-cyan-500/15 p-4 sm:p-5`}>
          <div className="flex items-center justify-between text-cyan-300 mb-3">
            <Star size={18} />
            <span className="text-[9px] uppercase tracking-wider opacity-70">
              1–5 Stars
            </span>
          </div>
          <p className="text-[11px] text-slate-400">Charts &amp; Tools</p>
          <p className="mt-1 text-2xl sm:text-3xl font-bold text-cyan-300">
            {summary.count > 0 ? `${summary.charts} ★` : '—'}
          </p>
        </section>

        <section className={`${card} from-violet-500/15 p-4 sm:p-5`}>
          <div className="flex items-center justify-between text-violet-300 mb-3">
            <Star size={18} />
            <span className="text-[9px] uppercase tracking-wider opacity-70">
              1–5 Stars
            </span>
          </div>
          <p className="text-[11px] text-slate-400">Smoothness</p>
          <p className="mt-1 text-2xl sm:text-3xl font-bold text-violet-300">
            {summary.count > 0 ? `${summary.smoothness} ★` : '—'}
          </p>
        </section>

        <section className={`${card} from-indigo-500/15 p-4 sm:p-5`}>
          <div className="flex items-center justify-between text-indigo-300 mb-3">
            <MessageSquareHeart size={18} />
            <span className="text-[9px] uppercase tracking-wider opacity-70">
              Responses
            </span>
          </div>
          <p className="text-[11px] text-slate-400">Total Feedback</p>
          <p className="mt-1 text-2xl sm:text-3xl font-bold text-indigo-300">
            {summary.count}
          </p>
        </section>
      </div>

      {/* Email Template Preview & Bulk Sender */}
      <section className={`${card} p-5 sm:p-6`}>
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-white/5 pb-5">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-emerald-400/10 border border-emerald-400/30 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-300">
              <Mail size={12} />
              First-Trade Feedback Email
            </div>
            <h2 className="mt-2.5 text-lg font-semibold text-white">
              Send &ldquo;First Trade&rdquo; Feedback Email to Certain Users
            </h2>
            <p className="mt-1 text-xs text-slate-400 max-w-2xl">
              Select specific users below to send them the platform feedback
              email. When they click the button in the email, they rate{' '}
              <strong className="text-slate-200">
                User Friendliness, Charts, and Smoothness (1 to 5 stars)
              </strong>{' '}
              and submit their improvement suggestions directly to this
              dashboard and Supabase.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <a
              href="/?feedback=1"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-xl border border-cyan-400/30 bg-cyan-400/10 px-3.5 py-2 text-xs font-semibold text-cyan-200 hover:bg-cyan-400/20 transition"
            >
              Preview Feedback Form <ExternalLink size={13} />
            </a>
            <button
              type="button"
              onClick={() => void refreshFeedback()}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 px-3.5 py-2 text-xs text-slate-300 hover:bg-white/5 transition"
            >
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>
        </div>

        {/* Message Preview Box */}
        <div className="mt-5 rounded-2xl border border-emerald-400/20 bg-[#070d17] p-4 sm:p-5">
          <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">
            Email Content Sent to Selected Traders
          </p>
          <p className="mt-2 text-xs sm:text-sm leading-relaxed text-slate-200">
            &ldquo;Hi <strong>[Trader Name]</strong>, we saw you placed your
            first trade! How did you find our platform? Is it user-friendly? Let
            us know if we can improve it and where we can improve it. Your
            feedback is valuable.&rdquo;
          </p>
          <div className="mt-3 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 border border-emerald-400/30 px-3.5 py-1.5 text-xs font-bold text-emerald-200">
            CTA Button: &ldquo;Click Here to Give Us Feedback →&rdquo; (Rates
            User Friendliness, Charts &amp; Smoothness 1–5★)
          </div>
        </div>

        {statusBanner && (
          <div
            role="status"
            className={`mt-4 rounded-2xl border p-4 text-xs ${
              statusBanner.tone === 'success'
                ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200'
                : statusBanner.tone === 'error'
                ? 'border-rose-400/30 bg-rose-400/10 text-rose-200'
                : 'border-cyan-400/30 bg-cyan-400/10 text-cyan-200'
            }`}
          >
            <div className="flex items-center gap-2 font-semibold">
              <CheckCircle2 size={15} />
              <span>{statusBanner.text}</span>
            </div>
            {statusBanner.links && statusBanner.links.length > 0 && (
              <div className="mt-2.5 space-y-1.5">
                {statusBanner.links.slice(0, 5).map((item) => (
                  <div
                    key={item.email}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-black/30 px-3 py-2 text-[11px]"
                  >
                    <span className="font-semibold text-white">
                      {item.name} ({item.email})
                    </span>
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-cyan-300 underline break-all"
                    >
                      {item.url}
                    </a>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Filter & Selection Toolbar */}
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2">
              <Search size={14} className="text-slate-500" />
              <input
                type="text"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                placeholder="Search trader name or email…"
                className="w-44 sm:w-56 bg-transparent text-xs text-white outline-none placeholder:text-slate-600"
              />
            </label>
            <select
              aria-label="Filter recipients"
              value={recipientFilter}
              onChange={(e) =>
                setRecipientFilter(
                  e.target.value as 'first_trade' | 'all' | 'unsent'
                )
              }
              className="rounded-xl border border-white/10 bg-[#111b29] px-3 py-2 text-xs text-slate-300"
            >
              <option value="all">All Registered Users ({users.length})</option>
              <option value="first_trade">
                Traders with Sessions / First Trade
              </option>
              <option value="unsent">Not Yet Emailed</option>
            </select>
            <button
              type="button"
              onClick={handleSelectAllFiltered}
              className="rounded-xl border border-white/10 px-3 py-2 text-xs text-slate-300 hover:bg-white/5 transition"
            >
              {filteredUsers.length > 0 &&
              filteredUsers.every((u) =>
                selectedEmails.has(u.email.toLowerCase())
              )
                ? 'Deselect All'
                : 'Select Filtered'}
            </button>
          </div>

          <button
            type="button"
            disabled={sending || selectedEmails.size === 0}
            onClick={() => {
              const list = users
                .filter((u) => selectedEmails.has(u.email.toLowerCase()))
                .map((u) => ({ email: u.email, name: u.name }));
              void handleSendToRecipients(list);
            }}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-400 to-cyan-400 px-4 py-2.5 text-xs font-extrabold text-slate-950 shadow-md disabled:opacity-40 transition"
          >
            <Send size={14} />
            {sending
              ? 'Sending…'
              : `Send Feedback Email to Selected (${selectedEmails.size})`}
          </button>
        </div>

        {/* Users Table for Email Sending & Quick Account Inspection */}
        <div className="mt-4 overflow-x-auto rounded-xl border border-white/5">
          <table className="w-full min-w-[780px] text-left text-xs">
            <thead className="bg-white/[0.02] text-[10px] uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Select</th>
                <th className="px-4 py-3 font-medium">Trader</th>
                <th className="px-4 py-3 font-medium">Trades / Sessions</th>
                <th className="px-4 py-3 font-medium">Email Status</th>
                <th className="px-4 py-3 font-medium">Rating Submitted</th>
                <th className="px-4 py-3 font-medium text-right">
                  Admin Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.slice(0, 15).map((user) => {
                const emailKey = user.email.toLowerCase();
                const isSelected = selectedEmails.has(emailKey);
                const sentLog = sentByEmail.get(emailKey);
                const submittedFb = feedbackByEmail.get(emailKey);

                return (
                  <tr
                    key={user.source + user.id}
                    className="border-t border-white/5 hover:bg-white/[0.02]"
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        aria-label={`Select ${user.name}`}
                        checked={isSelected}
                        onChange={() => toggleSelectUser(user.email)}
                        className="h-4 w-4 rounded border-white/20 accent-emerald-400"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-200">
                        {user.name}
                      </p>
                      <p className="text-slate-500">{user.email}</p>
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-300">
                      <span>{user.tradeCount ?? 0} trades</span>
                      <span className="text-slate-600 mx-1.5">·</span>
                      <span className="text-slate-400">
                        {user.sessionCount ?? 0} sessions
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {sentLog ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-400/15 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-300">
                          <Check size={11} /> Sent{' '}
                          {formatSaDate(sentLog.sentAt)}
                        </span>
                      ) : (
                        <span className="text-slate-600">Not sent yet</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {submittedFb ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-400/15 px-2.5 py-0.5 text-[10px] font-bold text-amber-300">
                          <Star
                            size={11}
                            className="fill-amber-400 text-amber-400"
                          />
                          {submittedFb.overallRating} / 5.0
                        </span>
                      ) : (
                        <span className="text-slate-600">Awaiting rating</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex flex-wrap items-center justify-end gap-1.5">
                        <button
                          type="button"
                          disabled={sending}
                          onClick={() =>
                            void handleSendToRecipients([
                              { email: user.email, name: user.name },
                            ])
                          }
                          className="inline-flex items-center gap-1 rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-1.5 text-[11px] font-semibold text-emerald-300 hover:bg-emerald-400/20 transition"
                        >
                          <Mail size={12} />
                          Send Email
                        </button>
                        <button
                          type="button"
                          onClick={() => copyFeedbackLink(user)}
                          title="Copy personalized feedback link"
                          className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-[11px] text-slate-300 hover:bg-white/10 transition"
                        >
                          <Copy size={12} />
                          {copiedEmail === emailKey ? 'Copied!' : 'Link'}
                        </button>
                        <button
                          type="button"
                          onClick={() => onImpersonateUser(user)}
                          title="Log into this user's dashboard as Administrator"
                          className="inline-flex items-center gap-1 rounded-lg border border-cyan-400/30 bg-cyan-400/10 px-2.5 py-1.5 text-[11px] font-semibold text-cyan-200 hover:bg-cyan-400/20 transition"
                        >
                          <LogIn size={12} />
                          Log In As User
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Submitted Trader Feedback List */}
      <section className={`${card} p-5 sm:p-6`}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/5 pb-4">
          <div>
            <h2 className="text-lg font-semibold text-white">
              Submitted Trader Feedback &amp; Star Ratings ({feedbackList.length})
            </h2>
            <p className="mt-0.5 text-xs text-slate-400">
              All ratings and improvement suggestions submitted by traders are
              stored in Supabase and displayed below.
            </p>
          </div>
        </div>

        {feedbackList.length === 0 ? (
          <div className="py-12 text-center">
            <MessageSquareHeart
              size={30}
              className="mx-auto text-slate-600 mb-3"
            />
            <p className="text-sm font-semibold text-slate-300">
              No trader feedback submitted yet.
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Send a feedback email above or click &ldquo;Preview Feedback
              Form&rdquo; to submit a test rating.
            </p>
          </div>
        ) : (
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {feedbackList.map((item) => {
              const matchedUser = users.find(
                (u) => u.email.toLowerCase() === item.userEmail.toLowerCase()
              );
              return (
                <article
                  key={item.id}
                  className="rounded-2xl border border-white/[0.08] bg-[#0a121e] p-5 flex flex-col justify-between gap-4"
                >
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-bold text-white text-sm">
                          {item.userName}
                        </h3>
                        <p className="text-xs text-slate-400">
                          {item.userEmail}
                        </p>
                        <p className="mt-0.5 text-[10px] text-slate-500">
                          Submitted {formatSaDate(item.createdAt)}
                        </p>
                      </div>
                      <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/30 bg-amber-400/15 px-3 py-1 text-xs font-extrabold text-amber-300">
                        <Star
                          size={13}
                          className="fill-amber-400 text-amber-400"
                        />
                        {item.overallRating} / 5.0
                      </span>
                    </div>

                    <div className="mt-4 grid gap-2 sm:grid-cols-3">
                      <StarsBadge
                        score={item.ratingUserFriendliness}
                        label="User Friendly"
                      />
                      <StarsBadge score={item.ratingCharts} label="Charts" />
                      <StarsBadge
                        score={item.ratingSmoothness}
                        label="Smoothness"
                      />
                    </div>

                    <div className="mt-4 rounded-xl border border-white/5 bg-black/30 p-3.5">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                        Where We Can Improve / Trader Feedback
                      </p>
                      <p className="text-xs leading-relaxed text-slate-200 whitespace-pre-wrap">
                        {item.improvementsText
                          ? item.improvementsText
                          : 'No written comments provided — rated via stars.'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-end pt-2 border-t border-white/5">
                    <button
                      type="button"
                      onClick={() =>
                        onImpersonateUser(
                          matchedUser || {
                            id: item.userId || `fb-${item.id}`,
                            name: item.userName,
                            email: item.userEmail,
                            joinedAt: item.createdAt,
                            loginCount: 1,
                            lastLoginAt: item.createdAt,
                            source: 'server',
                          }
                        )
                      }
                      className="inline-flex items-center gap-1.5 rounded-xl border border-cyan-400/30 bg-cyan-400/10 px-3 py-1.5 text-xs font-semibold text-cyan-200 hover:bg-cyan-400/20 transition"
                    >
                      <LogIn size={13} />
                      Log into {item.userName.split(' ')[0]}&apos;s Account
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};
