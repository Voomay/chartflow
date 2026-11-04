import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CalendarClock,
  Check,
  CheckCircle2,
  Clock3,
  FileText,
  Mail,
  MailCheck,
  MailX,
  RefreshCw,
  Search,
  Send,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import {
  NewsletterEditionItem,
  NewsletterTargetAudience,
  getLocalUnsubscribedEmails,
  loadAdminNewsletters,
  platformRequest,
  saveAdminNewsletter,
  scheduleAdminNewsletter,
  sendAdminNewsletterNow,
  unscheduleAdminNewsletter,
  updateEmailSubscriptionStatus,
} from '../services/platformAccounts';
import { pageOf } from '../services/adminReporting';
import { AdminPagination } from './AdminPagination';

export interface WaitlistEntry {
  name: string;
  email: string;
  joinedAt: string;
  consent: boolean;
  consentVersion?: string;
  unsubscribed?: boolean;
}

const toLocalDatetimeInputValue = (iso?: string | null) => {
  const base =
    iso && Number.isFinite(Date.parse(iso))
      ? new Date(Date.parse(iso))
      : new Date(Date.now() + 3600000 * 4);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${base.getFullYear()}-${pad(base.getMonth() + 1)}-${pad(
    base.getDate()
  )}T${pad(base.getHours())}:${pad(base.getMinutes())}`;
};

const formatSaDateTime = (value: string | null | undefined) => {
  if (!value) return 'Not scheduled';
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

const LETTER_TEMPLATES = [
  {
    id: 'letter-personal-update',
    label: 'Personal Letter from Cheslin',
    badge: 'Personal Letter · Chart Replay',
    subject: 'Hi {{firstName}} — A quick personal note from Cheslin at Chart Replay',
    headline: 'Hi {{firstName}}, thank you for being part of Chart Replay.',
    body: `I wanted to write to you personally to thank you for being part of the Chart Replay trading community.\n\nWe built Chart Replay so you can practice your strategy bar-by-bar on real historical Gold (XAU/USD), NAS100, and Forex charts without risking live capital until your execution is second nature.\n\nWhether you are preparing for a prop firm evaluation or refining your daily session playbook, your workspace is ready whenever you want to put in 15 minutes of focused chart time.`,
    actionTip:
      'Log in for a quick 15-minute replay session today and focus 100% on following your written entry rules.',
    cta: 'Open Your Chart Replay Workspace →',
  },
  {
    id: 'letter-prop-firm-invite',
    label: 'Prop Firm & Backtesting Letter',
    badge: 'Trader Letter · Prop Firm & Backtesting',
    subject: 'Hi {{firstName}} — Test your strategy or Prop Firm rules in 10 seconds',
    headline: 'Hi {{firstName}}, ready to test your edge on the charts?',
    body: `Most traders fail prop firm challenges not because their strategy is bad, but because they haven't stress-tested their daily drawdown and risk rules across enough historical market sessions.\n\nOn Chart Replay, you can launch a Normal Strategy Backtest or a Prop Firm Evaluation (FTMO, FundedNext, The 5%ers, Topstep, or your own custom rules) in under 10 seconds and practice bar-by-bar.`,
    actionTip:
      'Create a new Backtesting or Prop Firm session today and track your win rate and drawdown compliance.',
    cta: 'Start a 10-Second Backtest Session →',
  },
  {
    id: 'letter-weekend-prep',
    label: 'Weekend Review & Market Prep Letter',
    badge: 'Weekly Letter · Chart Replay',
    subject: 'Hi {{firstName}} — Sharpen your eye before the new trading week opens',
    headline: 'Hi {{firstName}}, 20 minutes of replay practice sets up your whole week.',
    body: `Before live markets open, the sharpest traders warm up their pattern recognition by stepping through historical London and New York sessions.\n\nTake 20 minutes on Chart Replay to mark higher-timeframe liquidity, pin your sticky trading plan on screen, and execute 3 to 5 clean setups with zero impulse trades.`,
    actionTip:
      'Review your trading plan checklist and complete 3 disciplined replay trades before trading live.',
    cta: 'Warm Up on Chart Replay →',
  },
];

export function AdminWaitlist({ preview }: { preview: boolean }) {
  const [rows, setRows] = useState<WaitlistEntry[]>([]);
  const [unsubscribedSet, setUnsubscribedSet] = useState<Set<string>>(() =>
    getLocalUnsubscribedEmails()
  );
  const [busy, setBusy] = useState(false);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [statusBanner, setStatusBanner] = useState<{
    tone: 'success' | 'info' | 'error';
    text: string;
  } | null>(null);
  const [query, setQuery] = useState('');
  const [subFilter, setSubFilter] = useState<'all' | 'subscribed' | 'unsubscribed'>('all');
  const [page, setPage] = useState(1);
  const [source, setSource] = useState('');

  // Recipient selection: 'all' vs 'selected' (individuals)
  const [sendMode, setSendMode] = useState<'all' | 'selected'>('all');
  const [selectedEmails, setSelectedEmails] = useState<Set<string>>(new Set());
  const [customRecipientEmail, setCustomRecipientEmail] = useState('');
  const [customRecipientName, setCustomRecipientName] = useState('');

  // Letter composer state
  const [letterBadge, setLetterBadge] = useState(LETTER_TEMPLATES[0].badge);
  const [letterSubject, setLetterSubject] = useState(LETTER_TEMPLATES[0].subject);
  const [letterHeadline, setLetterHeadline] = useState(LETTER_TEMPLATES[0].headline);
  const [letterBody, setLetterBody] = useState(LETTER_TEMPLATES[0].body);
  const [letterActionTip, setLetterActionTip] = useState(LETTER_TEMPLATES[0].actionTip);
  const [letterCta, setLetterCta] = useState(LETTER_TEMPLATES[0].cta);

  // Scheduler state
  const [scheduleDateTime, setScheduleDateTime] = useState<string>(() =>
    toLocalDatetimeInputValue(new Date(Date.now() + 3600000 * 4).toISOString())
  );
  const [scheduledItems, setScheduledItems] = useState<NewsletterEditionItem[]>([]);

  const refresh = useCallback(async () => {
    const localUnsub = getLocalUnsubscribedEmails();
    if (preview) {
      setRows(
        Array.from({ length: 27 }, (_, index) => ({
          name: `Example trader ${index + 1}`,
          email: `waitlist${index + 1}@example.invalid`,
          joinedAt: new Date(Date.now() - index * 86400000).toISOString(),
          consent: true,
        }))
      );
      setUnsubscribedSet(localUnsub);
      setSource('Preview · Sample data');
      const nlRes = await loadAdminNewsletters(true);
      setScheduledItems(
        nlRes.newsletters.filter((n) => n.status === 'scheduled')
      );
      return;
    }
    setBusy(true);
    setError('');
    try {
      const [result, nlRes] = await Promise.all([
        platformRequest('waitlist'),
        loadAdminNewsletters(false),
      ]);
      if (nlRes.unsubscribedEmails) {
        const merged = new Set([
          ...localUnsub,
          ...nlRes.unsubscribedEmails.map((e) => e.toLowerCase()),
        ]);
        setUnsubscribedSet(merged);
      } else {
        setUnsubscribedSet(localUnsub);
      }
      setScheduledItems(
        nlRes.newsletters.filter((n) => n.status === 'scheduled')
      );
      if (!result.ok) {
        throw Error(result.error || 'Could not load the waiting list.');
      }
      setRows(result.entries || []);
      setSource(
        result.source === 'supabase'
          ? 'Connected Supabase email listing'
          : result.source === 'redis'
          ? 'Connected launch email listing'
          : 'Local launch email listing'
      );
    } catch (reason) {
      setRows([]);
      setError(
        reason instanceof Error ? reason.message : 'Waiting list unavailable.'
      );
    } finally {
      setBusy(false);
    }
  }, [preview]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const isEmailUnsubscribed = useCallback(
    (email: string, rowConsent = true) => {
      const clean = String(email || '').trim().toLowerCase();
      return !rowConsent || unsubscribedSet.has(clean);
    },
    [unsubscribedSet]
  );

  const subscribedRows = useMemo(
    () => rows.filter((r) => !isEmailUnsubscribed(r.email, r.consent)),
    [rows, isEmailUnsubscribed]
  );

  const unsubscribedCount = useMemo(
    () => rows.filter((r) => isEmailUnsubscribed(r.email, r.consent)).length,
    [rows, isEmailUnsubscribed]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows
      .filter((row) => {
        const unsub = isEmailUnsubscribed(row.email, row.consent);
        if (subFilter === 'subscribed' && unsub) return false;
        if (subFilter === 'unsubscribed' && !unsub) return false;
        return !q || `${row.name} ${row.email}`.toLowerCase().includes(q);
      })
      .sort((a, b) => Date.parse(b.joinedAt) - Date.parse(a.joinedAt));
  }, [rows, query, subFilter, isEmailUnsubscribed]);

  const result = pageOf(filtered, page);

  const handleToggleSubscription = async (email: string, makeUnsubscribed: boolean) => {
    const clean = email.trim().toLowerCase();
    setBusyAction(`sub-${clean}`);
    setStatusBanner(null);
    try {
      const res = await updateEmailSubscriptionStatus(clean, makeUnsubscribed, preview);
      if (res.ok) {
        setUnsubscribedSet((prev) => {
          const next = new Set(prev);
          if (makeUnsubscribed) next.add(clean);
          else next.delete(clean);
          return next;
        });
        if (makeUnsubscribed) {
          setSelectedEmails((prev) => {
            const next = new Set(prev);
            next.delete(clean);
            return next;
          });
        }
        setStatusBanner({
          tone: 'info',
          text: makeUnsubscribed
            ? `${clean} has been unsubscribed and will not receive bulk emails.`
            : `${clean} has been re-subscribed to the email listing.`,
        });
      }
    } finally {
      setBusyAction(null);
    }
  };

  const toggleSelectEmail = (email: string) => {
    const clean = email.trim().toLowerCase();
    setSelectedEmails((prev) => {
      const next = new Set(prev);
      if (next.has(clean)) next.delete(clean);
      else next.add(clean);
      return next;
    });
    setSendMode('selected');
  };

  const handleSelectAllSubscribed = () => {
    const subEmails = filtered
      .filter((r) => !isEmailUnsubscribed(r.email, r.consent))
      .map((r) => r.email.toLowerCase());
    const allChecked =
      subEmails.length > 0 && subEmails.every((e) => selectedEmails.has(e));
    if (allChecked) {
      setSelectedEmails(new Set());
    } else {
      setSelectedEmails(new Set(subEmails));
      setSendMode('selected');
    }
  };

  const handleAddCustomRecipient = () => {
    const clean = customRecipientEmail.trim().toLowerCase();
    if (!clean || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) {
      setStatusBanner({
        tone: 'error',
        text: 'Please enter a valid email address to add.',
      });
      return;
    }
    if (!rows.some((r) => r.email.toLowerCase() === clean)) {
      setRows((prev) => [
        {
          name: customRecipientName.trim() || clean.split('@')[0] || 'Trader',
          email: clean,
          joinedAt: new Date().toISOString(),
          consent: true,
        },
        ...prev,
      ]);
    }
    setSelectedEmails((prev) => new Set([...prev, clean]));
    setSendMode('selected');
    setCustomRecipientEmail('');
    setCustomRecipientName('');
    setStatusBanner({
      tone: 'info',
      text: `Added ${clean} to selected recipients.`,
    });
  };

  const resolveTargetRecipients = (explicitSingle?: WaitlistEntry) => {
    if (explicitSingle) {
      return [{ email: explicitSingle.email, name: explicitSingle.name || 'Trader' }];
    }
    if (sendMode === 'selected') {
      const byEmail = new Map(rows.map((r) => [r.email.toLowerCase(), r]));
      return Array.from(selectedEmails)
        .filter((em) => !unsubscribedSet.has(em))
        .map((em) => {
          const found = byEmail.get(em);
          return {
            email: em,
            name: found?.name || em.split('@')[0] || 'Trader',
          };
        });
    }
    return subscribedRows.map((r) => ({
      email: r.email,
      name: r.name || 'Trader',
    }));
  };

  const handleSendLetterNow = async (singleEntry?: WaitlistEntry) => {
    const recipients = resolveTargetRecipients(singleEntry);
    if (recipients.length === 0) {
      setStatusBanner({
        tone: 'error',
        text:
          sendMode === 'selected'
            ? 'Please select at least one subscribed individual recipient first.'
            : 'No subscribed recipients available to send to.',
      });
      return;
    }
    setBusyAction(singleEntry ? `send-${singleEntry.email}` : 'send-letter');
    setStatusBanner(null);
    try {
      const letterId = `letter-${Date.now().toString(36)}`;
      const audience: NewsletterTargetAudience =
        singleEntry || sendMode === 'selected' ? 'selected' : 'all';
      await saveAdminNewsletter(
        {
          id: letterId,
          dayNumber: 90,
          cadence: 'daily',
          category: 'letter',
          phaseLabel: letterBadge || 'Personal Letter · Chart Replay',
          badgeText: letterBadge || 'Personal Letter · Chart Replay',
          subject: letterSubject,
          headline: letterHeadline,
          bodyText: letterBody,
          steps: [],
          actionTip: letterActionTip,
          ctaText: letterCta,
          targetAudience: audience,
          selectedRecipients: recipients.map((r) => r.email),
          approved: true,
        },
        preview
      );
      const sendRes = await sendAdminNewsletterNow(
        {
          id: letterId,
          recipients,
          targetAudience: audience,
          isBulk: recipients.length > 1,
          approveAndSend: true,
        },
        preview
      );
      if (!sendRes.ok) {
        setStatusBanner({
          tone: 'error',
          text: sendRes.error || 'Could not send letter.',
        });
        return;
      }
      setStatusBanner({
        tone: 'success',
        text: singleEntry
          ? `Personal letter sent to ${singleEntry.name || singleEntry.email}!`
          : `Sent "${letterSubject}" to ${recipients.length} ${
              recipients.length === 1 ? 'recipient' : 'recipients'
            } (Unsubscribe link included automatically).`,
      });
    } finally {
      setBusyAction(null);
    }
  };

  const handleScheduleLetter = async () => {
    const recipients = resolveTargetRecipients();
    if (recipients.length === 0) {
      setStatusBanner({
        tone: 'error',
        text:
          sendMode === 'selected'
            ? 'Please select at least one subscribed recipient to schedule for.'
            : 'No subscribed recipients available to schedule for.',
      });
      return;
    }
    setBusyAction('schedule-letter');
    setStatusBanner(null);
    try {
      const letterId = `letter-sched-${Date.now().toString(36)}`;
      const scheduledIso = new Date(scheduleDateTime).toISOString();
      const audience: NewsletterTargetAudience =
        sendMode === 'selected' ? 'selected' : 'all';
      await saveAdminNewsletter(
        {
          id: letterId,
          dayNumber: 91,
          cadence: 'daily',
          category: 'letter',
          phaseLabel: letterBadge || 'Personal Letter · Chart Replay',
          badgeText: letterBadge || 'Personal Letter · Chart Replay',
          subject: letterSubject,
          headline: letterHeadline,
          bodyText: letterBody,
          steps: [],
          actionTip: letterActionTip,
          ctaText: letterCta,
          targetAudience: audience,
          selectedRecipients: recipients.map((r) => r.email),
          approved: true,
        },
        preview
      );
      const schedRes = await scheduleAdminNewsletter(
        {
          id: letterId,
          scheduledFor: scheduledIso,
          cadence: 'daily',
          targetAudience: audience,
          selectedRecipients: recipients.map((r) => r.email),
          approveAndSchedule: true,
        },
        preview
      );
      if (!schedRes.ok) {
        setStatusBanner({
          tone: 'error',
          text: schedRes.error || 'Could not schedule letter.',
        });
        return;
      }
      if (schedRes.newsletters) {
        setScheduledItems(
          schedRes.newsletters.filter((n) => n.status === 'scheduled')
        );
      }
      setStatusBanner({
        tone: 'success',
        text: `Scheduled letter "${letterSubject}" for ${formatSaDateTime(
          scheduledIso
        )} SAST to ${
          sendMode === 'selected'
            ? `${recipients.length} selected individual(s)`
            : `All Subscribed (${recipients.length})`
        }!`,
      });
    } finally {
      setBusyAction(null);
    }
  };

  const handleCancelSchedule = async (id: string) => {
    setBusyAction(`cancel-${id}`);
    try {
      const res = await unscheduleAdminNewsletter(id, preview);
      if (res.ok && res.newsletters) {
        setScheduledItems(
          res.newsletters.filter((n) => n.status === 'scheduled')
        );
        setStatusBanner({
          tone: 'info',
          text: 'Scheduled email cancelled.',
        });
      }
    } finally {
      setBusyAction(null);
    }
  };

  return (
    <section className="mt-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs text-cyan-300">{source}</p>
          <h2 className="mt-2 text-2xl font-semibold">
            Email Listing, Unsubscribe Controls &amp; Bulk Letter Studio
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            Manage subscriber status (Subscribed / Unsubscribed), compose personal letters, and send or schedule to all or selected individuals.
          </p>
        </div>
        <button
          disabled={busy}
          onClick={() => void refresh()}
          className="flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2.5 text-xs text-slate-300 hover:bg-white/5 transition"
        >
          <RefreshCw size={15} className={busy ? 'animate-spin' : ''} />
          Refresh email list
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid sm:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/5 p-5">
          <div className="flex items-center justify-between text-emerald-300">
            <MailCheck size={20} />
            <span className="text-[10px] font-bold uppercase tracking-wider">
              Active Subscribers
            </span>
          </div>
          <p className="mt-3 text-xs text-slate-400">Subscribed to Email List</p>
          <p className="mt-1 text-3xl font-semibold text-emerald-200">
            {subscribedRows.length}
          </p>
        </div>

        <div className="rounded-2xl border border-rose-400/20 bg-rose-400/5 p-5">
          <div className="flex items-center justify-between text-rose-300">
            <MailX size={20} />
            <span className="text-[10px] font-bold uppercase tracking-wider">
              Opted Out
            </span>
          </div>
          <p className="mt-3 text-xs text-slate-400">
            Unsubscribed (Excluded from Bulk Sends)
          </p>
          <p className="mt-1 text-3xl font-semibold text-rose-200">
            {unsubscribedCount}
          </p>
        </div>

        <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/5 p-5">
          <div className="flex items-center justify-between text-cyan-300">
            <CalendarClock size={20} />
            <span className="text-[10px] font-bold uppercase tracking-wider">
              Scheduler Queue
            </span>
          </div>
          <p className="mt-3 text-xs text-slate-400">Scheduled Letters &amp; Emails</p>
          <p className="mt-1 text-3xl font-semibold text-cyan-200">
            {scheduledItems.length}
          </p>
        </div>
      </div>

      {error && (
        <p role="alert" className="rounded-xl bg-rose-400/10 p-4 text-sm text-rose-300">
          {error}
        </p>
      )}

      {statusBanner && (
        <div
          role="status"
          className={`flex items-center justify-between gap-3 rounded-2xl border p-4 text-xs ${
            statusBanner.tone === 'success'
              ? 'border-emerald-400/35 bg-emerald-400/10 text-emerald-200'
              : statusBanner.tone === 'error'
              ? 'border-rose-400/35 bg-rose-400/10 text-rose-200'
              : 'border-cyan-400/35 bg-cyan-400/10 text-cyan-200'
          }`}
        >
          <div className="flex items-center gap-2 font-semibold">
            <CheckCircle2 size={16} />
            <span>{statusBanner.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setStatusBanner(null)}
            className="text-slate-400 hover:text-white"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Compose Bulk / Individual Letter & Scheduler Panel */}
      <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.035] to-white/[0.01] p-5 sm:p-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/5 pb-4">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-400/10 border border-emerald-400/30 px-3 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-300">
              <FileText size={12} />
              Letters, Bulk Email &amp; Scheduler
            </div>
            <h3 className="mt-2 text-base sm:text-lg font-semibold text-white">
              Send or Schedule a Letter (To All Subscribed or Selected Individuals)
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Every email automatically includes a one-click Unsubscribe link in the footer and respects unsubscribed users.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {LETTER_TEMPLATES.map((tpl) => (
              <button
                key={tpl.id}
                type="button"
                onClick={() => {
                  setLetterBadge(tpl.badge);
                  setLetterSubject(tpl.subject);
                  setLetterHeadline(tpl.headline);
                  setLetterBody(tpl.body);
                  setLetterActionTip(tpl.actionTip);
                  setLetterCta(tpl.cta);
                }}
                className="rounded-xl border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] px-3 py-1.5 text-xs font-medium text-slate-200 transition"
              >
                {tpl.label}
              </button>
            ))}
          </div>
        </div>

        {/* Step 1: Select Who to Send To (All or Individually) */}
        <div className="grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setSendMode('all')}
            className={`flex items-start gap-3 rounded-2xl border p-4 text-left transition ${
              sendMode === 'all'
                ? 'border-emerald-400/50 bg-emerald-400/10 shadow-lg'
                : 'border-white/10 bg-black/20 hover:bg-white/[0.03]'
            }`}
          >
            <div className="mt-0.5 rounded-xl bg-emerald-400/15 p-2 text-emerald-300">
              <Users size={18} />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white">
                  Send to All Subscribed (Bulk Email)
                </span>
                {sendMode === 'all' && (
                  <span className="rounded-full bg-emerald-400/20 px-2 py-0.5 text-[10px] font-bold text-emerald-200">
                    Active
                  </span>
                )}
              </div>
              <p className="mt-1 text-[11px] text-slate-400">
                Broadcasts to all {subscribedRows.length} subscribed emails ({unsubscribedCount} unsubscribed automatically excluded).
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setSendMode('selected')}
            className={`flex items-start gap-3 rounded-2xl border p-4 text-left transition ${
              sendMode === 'selected'
                ? 'border-cyan-400/50 bg-cyan-400/10 shadow-lg'
                : 'border-white/10 bg-black/20 hover:bg-white/[0.03]'
            }`}
          >
            <div className="mt-0.5 rounded-xl bg-cyan-400/15 p-2 text-cyan-300">
              <UserCheck size={18} />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white">
                  Send Individually / Hand-Picked ({selectedEmails.size} selected)
                </span>
                {sendMode === 'selected' && (
                  <span className="rounded-full bg-cyan-400/20 px-2 py-0.5 text-[10px] font-bold text-cyan-200">
                    Active
                  </span>
                )}
              </div>
              <p className="mt-1 text-[11px] text-slate-400">
                Check 1 or more individuals in the table below (or add a custom email) to send or schedule only to them.
              </p>
            </div>
          </button>
        </div>

        {/* Add Custom Individual Email Row */}
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-black/20 p-3">
          <span className="text-[11px] font-semibold text-slate-300 mr-1">
            Add Individual Recipient:
          </span>
          <input
            type="text"
            value={customRecipientName}
            onChange={(e) => setCustomRecipientName(e.target.value)}
            placeholder="Name (e.g. Cheslin)"
            className="w-36 sm:w-44 rounded-lg border border-white/10 bg-[#0b1320] px-3 py-1.5 text-xs text-white outline-none"
          />
          <input
            type="email"
            value={customRecipientEmail}
            onChange={(e) => setCustomRecipientEmail(e.target.value)}
            placeholder="email@example.com"
            className="w-48 sm:w-60 rounded-lg border border-white/10 bg-[#0b1320] px-3 py-1.5 text-xs text-white outline-none"
          />
          <button
            type="button"
            onClick={handleAddCustomRecipient}
            className="rounded-lg bg-cyan-400/20 border border-cyan-400/40 px-3 py-1.5 text-xs font-bold text-cyan-200 hover:bg-cyan-400/30 transition"
          >
            + Add &amp; Select Individual
          </button>
          {selectedEmails.size > 0 && (
            <button
              type="button"
              onClick={() => setSelectedEmails(new Set())}
              className="ml-auto text-[11px] text-slate-400 hover:text-white underline"
            >
              Clear {selectedEmails.size} selected
            </button>
          )}
        </div>

        {/* Letter Fields */}
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="block text-[11px] text-slate-400 mb-1">
              Email Subject Line (Supports {'{{firstName}}'} &amp; {'{{name}}'})
            </label>
            <input
              type="text"
              value={letterSubject}
              onChange={(e) => setLetterSubject(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-black/30 px-3.5 py-2 text-xs text-white outline-none focus:border-emerald-400/50"
            />
          </div>
          <div>
            <label className="block text-[11px] text-slate-400 mb-1">
              Letter Greeting / Headline
            </label>
            <input
              type="text"
              value={letterHeadline}
              onChange={(e) => setLetterHeadline(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-black/30 px-3.5 py-2 text-xs text-white outline-none focus:border-emerald-400/50"
            />
          </div>
        </div>

        <div>
          <label className="block text-[11px] text-slate-400 mb-1">
            Personal Letter Body
          </label>
          <textarea
            rows={5}
            value={letterBody}
            onChange={(e) => setLetterBody(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-black/30 p-3.5 text-xs text-white outline-none leading-relaxed focus:border-emerald-400/50"
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="block text-[11px] text-slate-400 mb-1">
              Key Takeaway / Action Note
            </label>
            <input
              type="text"
              value={letterActionTip}
              onChange={(e) => setLetterActionTip(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-black/30 px-3.5 py-2 text-xs text-white outline-none"
            />
          </div>
          <div>
            <label className="block text-[11px] text-slate-400 mb-1">
              Button Text
            </label>
            <input
              type="text"
              value={letterCta}
              onChange={(e) => setLetterCta(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-black/30 px-3.5 py-2 text-xs text-white outline-none"
            />
          </div>
        </div>

        {/* Send Now or Schedule Bar */}
        <div className="flex flex-wrap items-end justify-between gap-4 rounded-2xl border border-cyan-400/20 bg-[#070e19] p-4">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label
                htmlFor="waitlist-schedule-dt"
                className="block text-[10px] font-bold uppercase tracking-wider text-cyan-300 mb-1.5"
              >
                Schedule Delivery Date &amp; Time (SAST)
              </label>
              <input
                id="waitlist-schedule-dt"
                type="datetime-local"
                value={scheduleDateTime}
                onChange={(e) => setScheduleDateTime(e.target.value)}
                className="rounded-xl border border-white/10 bg-[#0f1928] px-3.5 py-2 text-xs text-white outline-none focus:border-cyan-400/50"
              />
            </div>
            <button
              type="button"
              disabled={busyAction !== null}
              onClick={() => void handleScheduleLetter()}
              className="inline-flex items-center gap-2 rounded-xl border border-cyan-400/40 bg-cyan-400/15 px-4 py-2.5 text-xs font-bold text-cyan-200 hover:bg-cyan-400/25 disabled:opacity-50 transition"
            >
              <CalendarClock size={14} />
              {busyAction === 'schedule-letter'
                ? 'Scheduling…'
                : sendMode === 'selected'
                ? `Schedule for ${selectedEmails.size} Selected`
                : `Schedule Bulk Letter (${subscribedRows.length})`}
            </button>
          </div>

          <button
            type="button"
            disabled={busyAction !== null}
            onClick={() => void handleSendLetterNow()}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-400 to-cyan-400 px-5 py-2.5 text-xs font-extrabold text-slate-950 shadow-lg hover:opacity-95 disabled:opacity-50 transition"
          >
            <Send size={14} />
            {busyAction === 'send-letter'
              ? 'Sending Letter…'
              : sendMode === 'selected'
              ? `Send Now to ${selectedEmails.size} Selected`
              : `Send Bulk Letter to All (${subscribedRows.length})`}
          </button>
        </div>

        {/* Scheduled Queue */}
        {scheduledItems.length > 0 && (
          <div className="rounded-xl border border-cyan-400/25 bg-cyan-400/[0.04] p-4 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-cyan-200">
                <Clock3 size={14} />
                Scheduled Email Queue ({scheduledItems.length})
              </span>
              <span className="text-[11px] text-slate-400">
                Dispatches automatically at scheduled SAST time
              </span>
            </div>
            <div className="space-y-2">
              {scheduledItems.map((item) => (
                <div
                  key={item.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-[#08111e] px-3.5 py-2.5 text-xs"
                >
                  <div>
                    <p className="font-semibold text-white">{item.subject}</p>
                    <p className="text-[11px] text-cyan-300 mt-0.5">
                      Scheduled for {formatSaDateTime(item.scheduledFor)} SAST ·{' '}
                      {item.targetAudience === 'selected'
                        ? `${item.selectedRecipients?.length || 1} selected individual(s)`
                        : 'All Subscribed'}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={busyAction === `cancel-${item.id}`}
                    onClick={() => void handleCancelSchedule(item.id)}
                    className="inline-flex items-center gap-1 rounded-lg border border-rose-400/30 bg-rose-400/10 px-2.5 py-1 text-[11px] font-semibold text-rose-200 hover:bg-rose-400/20 transition"
                  >
                    <X size={12} />
                    Cancel Schedule
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Email Listing Table with Unsubscribe / Resubscribe & Individual Send */}
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02]">
        <div className="flex flex-wrap justify-between items-center gap-3 p-5 border-b border-white/5">
          <div>
            <h3 className="font-semibold text-white">
              Subscriber Email Listing ({filtered.length})
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Select individuals with checkboxes, send a 1-to-1 letter, or toggle Unsubscribe / Resubscribe for any email address.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-xl border border-white/10 bg-black/30 p-1 text-xs">
              <button
                type="button"
                onClick={() => {
                  setSubFilter('all');
                  setPage(1);
                }}
                className={`rounded-lg px-2.5 py-1 transition ${
                  subFilter === 'all'
                    ? 'bg-emerald-400/20 text-emerald-200 font-semibold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                All ({rows.length})
              </button>
              <button
                type="button"
                onClick={() => {
                  setSubFilter('subscribed');
                  setPage(1);
                }}
                className={`rounded-lg px-2.5 py-1 transition ${
                  subFilter === 'subscribed'
                    ? 'bg-emerald-400/20 text-emerald-200 font-semibold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Subscribed ({subscribedRows.length})
              </button>
              <button
                type="button"
                onClick={() => {
                  setSubFilter('unsubscribed');
                  setPage(1);
                }}
                className={`rounded-lg px-2.5 py-1 transition ${
                  subFilter === 'unsubscribed'
                    ? 'bg-rose-400/20 text-rose-200 font-semibold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Unsubscribed ({unsubscribedCount})
              </button>
            </div>

            <label className="flex gap-2 items-center rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-slate-400">
              <Search size={14} />
              <input
                aria-label="Search waiting list"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setPage(1);
                }}
                placeholder="Search name or email"
                className="w-44 bg-transparent text-xs text-white outline-none"
              />
            </label>

            <button
              type="button"
              onClick={handleSelectAllSubscribed}
              className="rounded-xl border border-white/10 px-3 py-2 text-xs text-slate-300 hover:bg-white/5 transition"
            >
              Select Subscribed
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-[780px] w-full text-left text-xs">
            <thead className="bg-white/[0.02] text-slate-500 text-[10px] uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3.5 font-medium">Select</th>
                <th className="px-4 py-3.5 font-medium">Name</th>
                <th className="px-4 py-3.5 font-medium">Email address</th>
                <th className="px-4 py-3.5 font-medium">Joined · SAST</th>
                <th className="px-4 py-3.5 font-medium">Subscription Status</th>
                <th className="px-4 py-3.5 font-medium text-right">
                  Individual Send &amp; Unsubscribe
                </th>
              </tr>
            </thead>
            <tbody>
              {result.rows.map((row) => {
                const cleanEmail = row.email.toLowerCase();
                const isUnsub = isEmailUnsubscribed(row.email, row.consent);
                const isChecked = selectedEmails.has(cleanEmail);
                return (
                  <tr
                    key={row.email}
                    className="border-t border-white/5 hover:bg-white/[0.02]"
                  >
                    <td className="px-4 py-3.5">
                      <input
                        type="checkbox"
                        disabled={isUnsub}
                        checked={isChecked}
                        onChange={() => toggleSelectEmail(row.email)}
                        aria-label={`Select ${row.email}`}
                        className="h-4 w-4 rounded border-white/20 accent-emerald-400 disabled:opacity-30"
                      />
                    </td>
                    <td className="px-4 py-3.5 font-medium text-slate-200">
                      {row.name || 'Not provided'}
                    </td>
                    <td className="px-4 py-3.5 font-mono text-slate-400">
                      {row.email}
                    </td>
                    <td className="px-4 py-3.5 text-slate-400">
                      {new Intl.DateTimeFormat('en-ZA', {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                        timeZone: 'Africa/Johannesburg',
                      }).format(new Date(row.joinedAt))}
                    </td>
                    <td className="px-4 py-3.5">
                      {isUnsub ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/15 border border-rose-400/35 px-3 py-1 text-[11px] font-semibold text-rose-200">
                          <MailX size={12} />
                          Unsubscribed
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-400/10 border border-emerald-400/30 px-3 py-1 text-[11px] font-semibold text-emerald-200">
                          <Check size={12} />
                          Subscribed
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <div className="inline-flex items-center justify-end gap-2">
                        {!isUnsub && (
                          <button
                            type="button"
                            disabled={busyAction !== null}
                            onClick={() => void handleSendLetterNow(row)}
                            className="inline-flex items-center gap-1 rounded-xl border border-emerald-400/35 bg-emerald-400/15 px-2.5 py-1.5 text-[11px] font-bold text-emerald-200 hover:bg-emerald-400/25 transition"
                            title={`Send current letter directly to ${row.email}`}
                          >
                            <Mail size={12} />
                            {busyAction === `send-${row.email}`
                              ? 'Sending…'
                              : 'Send Letter'}
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={busyAction === `sub-${cleanEmail}`}
                          onClick={() =>
                            void handleToggleSubscription(row.email, !isUnsub)
                          }
                          className={`inline-flex items-center gap-1 rounded-xl border px-2.5 py-1.5 text-[11px] font-semibold transition ${
                            isUnsub
                              ? 'border-cyan-400/35 bg-cyan-400/10 text-cyan-200 hover:bg-cyan-400/20'
                              : 'border-rose-400/30 bg-rose-400/10 text-rose-200 hover:bg-rose-400/20'
                          }`}
                        >
                          {isUnsub ? 'Resubscribe' : 'Unsubscribe'}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!result.total && (
          <p className="p-8 text-sm text-slate-500">
            {busy
              ? 'Loading subscribers…'
              : query
              ? 'No subscribers match your search.'
              : 'No waiting-list signups yet.'}
          </p>
        )}
        <AdminPagination {...result} onPage={setPage} />
      </div>
    </section>
  );
}
