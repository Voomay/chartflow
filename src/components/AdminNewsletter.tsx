import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CalendarClock,
  Check,
  CheckCircle2,
  Clock3,
  Edit3,
  Eye,
  FileText,
  Mail,
  MailCheck,
  MailOpen,
  MailX,
  MousePointerClick,
  Newspaper,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Send,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Trash2,
  UserCheck,
  UserMinus,
  Users,
  Monitor,
  X,
} from 'lucide-react';
import {
  AdminUser,
  NewsletterCadence,
  NewsletterDeliveryLogItem,
  NewsletterEditionItem,
  NewsletterTargetAudience,
  approveAdminNewsletter,
  deleteAdminNewsletter,
  extractClientNewsletterStepsAndIntro,
  formatPlatformDurationLabel,
  getLocalUnsubscribedEmails,
  getTraderDaysSinceActive,
  isTraderInactive2To3PlusDays,
  SuppressedEmailItem,
  loadAdminNewsletters,
  removeAdminEmailSuppression,
  personalizeClientNewsletterText,
  saveAdminNewsletter,
  scheduleAdminNewsletter,
  scheduleAdminNewsletterSeries,
  sendAdminNewsletterNow,
  stripClientLegacyDayPrefix,
  unscheduleAdminNewsletter,
  updateEmailSubscriptionStatus,
} from '../services/platformAccounts';

interface AdminNewsletterProps {
  users: AdminUser[];
  preview?: boolean;
}

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

const toLocalDatetimeInputValue = (iso?: string | null) => {
  const base =
    iso && Number.isFinite(Date.parse(iso))
      ? new Date(Date.parse(iso))
      : new Date(Date.now() + 86400000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${base.getFullYear()}-${pad(base.getMonth() + 1)}-${pad(
    base.getDate()
  )}T${pad(base.getHours())}:${pad(base.getMinutes())}`;
};

export const AdminNewsletter: React.FC<AdminNewsletterProps> = ({
  users,
  preview = false,
}) => {
  const [newsletters, setNewsletters] = useState<NewsletterEditionItem[]>([]);
  const [logs, setLogs] = useState<NewsletterDeliveryLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string>('newsletter-day-1');
  const [previewUserEmail, setPreviewUserEmail] = useState<string>('');
  const [layoutMode, setLayoutMode] = useState<'desktop' | 'mobile' | 'text'>(
    'desktop'
  );
  const [editingCopy, setEditingCopy] = useState(false);

  // Editable draft fields for the currently selected newsletter
  const [draftSubject, setDraftSubject] = useState('');
  const [draftBadge, setDraftBadge] = useState('');
  const [draftCategory, setDraftCategory] = useState('');
  const [draftHeadline, setDraftHeadline] = useState('');
  const [draftBody, setDraftBody] = useState('');
  const [draftActionTip, setDraftActionTip] = useState('');
  const [draftCtaText, setDraftCtaText] = useState('');
  const [draftDayNumber, setDraftDayNumber] = useState(1);
  const [draftCadence, setDraftCadence] = useState<NewsletterCadence>('daily');

  // Schedule, Bulk & Audience controls
  const [scheduleCadence, setScheduleCadence] = useState<NewsletterCadence>(
    'daily_then_every_second_day'
  );
  const [scheduleDateTime, setScheduleDateTime] = useState<string>(() =>
    toLocalDatetimeInputValue(new Date(Date.now() + 3600000 * 12).toISOString())
  );
  const [targetAudience, setTargetAudience] =
    useState<NewsletterTargetAudience>('all');
  const [selectedEmails, setSelectedEmails] = useState<Set<string>>(new Set());
  const [unsubscribedSet, setUnsubscribedSet] = useState<Set<string>>(() =>
    getLocalUnsubscribedEmails()
  );
  const [customRecipients, setCustomRecipients] = useState<AdminUser[]>([]);
  const [customEmailInput, setCustomEmailInput] = useState('');
  const [customNameInput, setCustomNameInput] = useState('');
  const [userSearch, setUserSearch] = useState('');
  const [userFilterMode, setUserFilterMode] = useState<
    'all' | 'subscribed' | 'unsubscribed' | 'inactive_2_3_days'
  >('all');
  const [openFilterMode, setOpenFilterMode] = useState<
    'all' | 'opened' | 'unopened' | 'clicked' | 'issue'
  >('all');
  const [openLogSearch, setOpenLogSearch] = useState('');
  const [suppressedRecipients, setSuppressedRecipients] = useState<SuppressedEmailItem[]>([]);
  const [unblockingEmail, setUnblockingEmail] = useState<string | null>(null);
  const [statusBanner, setStatusBanner] = useState<{
    tone: 'success' | 'info' | 'error';
    text: string;
  } | null>(null);

  const refreshNewsletters = useCallback(async () => {
    setLoading(true);
    try {
      const res = await loadAdminNewsletters(preview);
      setNewsletters(res.newsletters);
      setLogs(res.logs);
      setSuppressedRecipients(res.suppressedRecipients || []);
      const localUnsub = getLocalUnsubscribedEmails();
      if (Array.isArray(res.unsubscribedEmails)) {
        for (const em of res.unsubscribedEmails) {
          if (em) localUnsub.add(em.toLowerCase());
        }
      }
      for (const u of users) {
        if (u.emailUnsubscribed && u.email) {
          localUnsub.add(u.email.toLowerCase());
        }
      }
      setUnsubscribedSet(new Set(localUnsub));
      if (
        res.newsletters.length > 0 &&
        !res.newsletters.some((n) => n.id === selectedId)
      ) {
        setSelectedId(res.newsletters[0].id);
      }
    } finally {
      setLoading(false);
    }
  }, [preview, selectedId, users]);

  useEffect(() => {
    void refreshNewsletters();
  }, [refreshNewsletters]);

  // Automatic background due-check polling while admin is viewing newsletters
  useEffect(() => {
    const timer = window.setInterval(() => {
      void loadAdminNewsletters(preview).then((res) => {
        if (res.ok) {
          setNewsletters(res.newsletters);
          setLogs(res.logs);
          setSuppressedRecipients(res.suppressedRecipients || []);
        }
      });
    }, 45000);
    return () => window.clearInterval(timer);
  }, [preview]);

  const allCombinedUsers = useMemo(() => {
    const known = new Set(users.map((u) => u.email.toLowerCase()));
    return [
      ...users,
      ...customRecipients.filter((c) => !known.has(c.email.toLowerCase())),
    ];
  }, [users, customRecipients]);

  const isUserUnsubscribed = useCallback(
    (u: AdminUser) => {
      const clean = String(u.email || '').trim().toLowerCase();
      return Boolean(u.emailUnsubscribed || unsubscribedSet.has(clean));
    },
    [unsubscribedSet]
  );

  const subscribedUsers = useMemo(
    () => allCombinedUsers.filter((u) => !isUserUnsubscribed(u)),
    [allCombinedUsers, isUserUnsubscribed]
  );

  const unsubscribedUsersCount = useMemo(
    () => allCombinedUsers.filter((u) => isUserUnsubscribed(u)).length,
    [allCombinedUsers, isUserUnsubscribed]
  );

  useEffect(() => {
    if (!previewUserEmail && allCombinedUsers.length > 0) {
      setPreviewUserEmail(allCombinedUsers[0].email);
    }
  }, [allCombinedUsers, previewUserEmail]);

  const activeNewsletter = useMemo(() => {
    return (
      newsletters.find((n) => n.id === selectedId) || newsletters[0] || null
    );
  }, [newsletters, selectedId]);

  useEffect(() => {
    if (!activeNewsletter) return;
    setDraftSubject(activeNewsletter.subject);
    setDraftBadge(stripClientLegacyDayPrefix(activeNewsletter.badgeText));
    setDraftCategory(
      activeNewsletter.category ||
        stripClientLegacyDayPrefix(activeNewsletter.phaseLabel || activeNewsletter.badgeText)
    );
    setDraftHeadline(activeNewsletter.headline);
    const normalizedBody = String(activeNewsletter.bodyText || '')
      .replace(/([.!?"]\s*)((?:Step\s*)?1[.):]\s+[A-Z])/g, '$1\n\n$2')
      .replace(/([.!?"]\s*)((?:Step\s*)?[2-9][.):]\s+[A-Z])/g, '$1\n$2');
    setDraftBody(normalizedBody);
    setDraftActionTip(activeNewsletter.actionTip);
    setDraftCtaText(activeNewsletter.ctaText);
    setDraftDayNumber(activeNewsletter.dayNumber);
    setDraftCadence(activeNewsletter.cadence);
    if (activeNewsletter.targetAudience) {
      setTargetAudience(activeNewsletter.targetAudience);
    }
    if (activeNewsletter.scheduledFor) {
      setScheduleDateTime(
        toLocalDatetimeInputValue(activeNewsletter.scheduledFor)
      );
    }
  }, [activeNewsletter]);

  const previewRecipient = useMemo<AdminUser>(() => {
    const found = allCombinedUsers.find(
      (u) => u.email.toLowerCase() === previewUserEmail.toLowerCase()
    );
    if (found) return found;
    if (allCombinedUsers[0]) return allCombinedUsers[0];
    return {
      id: 'sample-trader',
      name: 'Lerato Mokoena',
      email: 'lerato@chartreplay.co.za',
      joinedAt: new Date(Date.now() - 5 * 86400000).toISOString(),
      loginCount: 6,
      lastLoginAt: new Date(Date.now() - 1800000).toISOString(),
      sessionCount: 5,
      tradeCount: 9,
      hasTradingPlan: true,
      tradingPlanName: 'ICT Silver Bullet Plan',
      totalTimeOnPlatformSeconds: 7800,
      currentSessionSeconds: 1800,
      source: 'server',
    };
  }, [allCombinedUsers, previewUserEmail]);

  const personalizedPreview = useMemo(() => {
    const src = {
      subject: draftSubject,
      badgeText: stripClientLegacyDayPrefix(draftBadge),
      headline: draftHeadline,
      bodyText: draftBody,
      actionTip: draftActionTip,
      ctaText: draftCtaText,
    };
    const subject = personalizeClientNewsletterText(
      src.subject,
      previewRecipient
    );
    const badgeText = personalizeClientNewsletterText(
      src.badgeText,
      previewRecipient
    );
    const headline = personalizeClientNewsletterText(
      src.headline,
      previewRecipient
    );
    const bodyText = personalizeClientNewsletterText(
      src.bodyText,
      previewRecipient
    );
    const actionTip = personalizeClientNewsletterText(
      src.actionTip,
      previewRecipient
    );
    const ctaText = personalizeClientNewsletterText(
      src.ctaText,
      previewRecipient
    );
    const { introParagraphs, steps } = extractClientNewsletterStepsAndIntro(
      bodyText,
      activeNewsletter?.steps
    );

    return {
      subject,
      badgeText,
      headline,
      bodyText,
      actionTip,
      ctaText,
      introParagraphs,
      steps: steps.map((s) =>
        personalizeClientNewsletterText(s, previewRecipient)
      ),
    };
  }, [
    draftSubject,
    draftBadge,
    draftHeadline,
    draftBody,
    draftActionTip,
    draftCtaText,
    previewRecipient,
    activeNewsletter,
  ]);

  const inactiveTraders = useMemo(() => {
    return subscribedUsers.filter((u) => isTraderInactive2To3PlusDays(u));
  }, [subscribedUsers]);

  const filteredUsers = useMemo(() => {
    const q = userSearch.trim().toLowerCase();
    return allCombinedUsers.filter((u) => {
      const unsub = isUserUnsubscribed(u);
      if (userFilterMode === 'subscribed' && unsub) return false;
      if (userFilterMode === 'unsubscribed' && !unsub) return false;
      if (
        userFilterMode === 'inactive_2_3_days' &&
        (unsub || !isTraderInactive2To3PlusDays(u))
      ) {
        return false;
      }
      return !q || `${u.name} ${u.email}`.toLowerCase().includes(q);
    });
  }, [allCombinedUsers, userSearch, userFilterMode, isUserUnsubscribed]);

  const recipientUsersForTarget = useMemo(() => {
    if (targetAudience === 'selected') {
      return subscribedUsers.filter((u) =>
        selectedEmails.has(u.email.toLowerCase())
      );
    }
    if (targetAudience === 'inactive_2_3_days') {
      return inactiveTraders;
    }
    if (targetAudience === 'active') {
      return subscribedUsers.filter(
        (u) => Number(u.sessionCount ?? 0) > 0 || Number(u.tradeCount ?? 0) > 0
      );
    }
    if (targetAudience === 'new_starters') {
      const now = Date.now();
      return subscribedUsers.filter((u) => {
        const joinedMs = u.joinedAt ? Date.parse(u.joinedAt) : NaN;
        if (!Number.isFinite(joinedMs)) return true;
        return now - joinedMs <= 7 * 86400000;
      });
    }
    return subscribedUsers;
  }, [targetAudience, selectedEmails, subscribedUsers, inactiveTraders]);

  const scheduledNewsletters = useMemo(
    () => newsletters.filter((n) => n.status === 'scheduled'),
    [newsletters]
  );

  const metrics = useMemo(() => {
    const approvedCount = newsletters.filter((n) => n.approved).length;
    const scheduledCount = scheduledNewsletters.length;
    const sentEditions = newsletters.filter((n) => n.status === 'sent').length;
    const totalDeliveries =
      logs.length ||
      newsletters.reduce((sum, n) => sum + (n.sentCount || 0), 0);
    const openedLogsCount = logs.filter((l) => l.opened).length;
    const clickedLogsCount = logs.filter((l) => l.clicked).length;
    const issueLogsCount = logs.filter((l) =>
      ['suppressed', 'bounced', 'failed', 'complained'].includes(
        String(l.deliveryStatus || '').toLowerCase()
      )
    ).length;
    const openRate =
      logs.length > 0 ? Math.round((openedLogsCount / logs.length) * 100) : 0;

    return {
      totalEmails: subscribedUsers.length,
      unsubscribedCount: unsubscribedUsersCount,
      inactiveCount: inactiveTraders.length,
      approvedCount,
      scheduledCount,
      sentEditions,
      totalDeliveries,
      openedLogsCount,
      clickedLogsCount,
      issueLogsCount,
      openRate,
    };
  }, [
    newsletters,
    scheduledNewsletters.length,
    logs,
    subscribedUsers.length,
    unsubscribedUsersCount,
    inactiveTraders.length,
  ]);

  const suppressedByEmail = useMemo(() => {
    const map = new Map<string, SuppressedEmailItem>();
    for (const item of suppressedRecipients) {
      const key = String(item?.email || '').trim().toLowerCase();
      if (key) map.set(key, item);
    }
    return map;
  }, [suppressedRecipients]);

  const handleRemoveSuppression = async (email: string) => {
    const clean = email.trim().toLowerCase();
    setUnblockingEmail(clean);
    try {
      const res = await removeAdminEmailSuppression(clean, preview);
      if (!res.ok) {
        setStatusBanner({
          tone: 'error',
          text: res.error || `Could not unblock ${clean} on Resend.`,
        });
        return;
      }
      setSuppressedRecipients(res.suppressedRecipients || []);
      setStatusBanner({
        tone: 'success',
        text: `Removed ${clean} from Resend's suppression list! Emails to ${clean} can now be delivered.`,
      });
      await refreshNewsletters();
    } finally {
      setUnblockingEmail(null);
    }
  };

  const perUserOpenStats = useMemo(() => {
    const map = new Map<
      string,
      { sent: number; opened: number; lastOpenedAt: string | null }
    >();
    for (const log of logs) {
      const email = String(log.userEmail || '').toLowerCase();
      if (!email) continue;
      const existing = map.get(email) || {
        sent: 0,
        opened: 0,
        lastOpenedAt: null,
      };
      existing.sent += 1;
      if (log.opened) {
        existing.opened += 1;
        if (
          log.openedAt &&
          (!existing.lastOpenedAt || log.openedAt > existing.lastOpenedAt)
        ) {
          existing.lastOpenedAt = log.openedAt;
        }
      }
      map.set(email, existing);
    }
    return map;
  }, [logs]);

  const filteredLogs = useMemo(() => {
    const q = openLogSearch.trim().toLowerCase();
    return logs.filter((l) => {
      if (openFilterMode === 'opened' && !l.opened) return false;
      if (openFilterMode === 'unopened' && l.opened) return false;
      if (openFilterMode === 'clicked' && !l.clicked) return false;
      if (
        openFilterMode === 'issue' &&
        !['suppressed', 'bounced', 'failed', 'complained', 'delivery_delayed'].includes(
          String(l.deliveryStatus || '').toLowerCase()
        )
      )
        return false;
      if (!q) return true;
      return `${l.userName} ${l.userEmail} ${l.subject} ${l.badgeText || ''}`
        .toLowerCase()
        .includes(q);
    });
  }, [logs, openFilterMode, openLogSearch]);

  const toggleSelectEmail = (email: string) => {
    const clean = email.toLowerCase();
    setSelectedEmails((prev) => {
      const next = new Set(prev);
      if (next.has(clean)) next.delete(clean);
      else next.add(clean);
      return next;
    });
    setTargetAudience('selected');
  };

  const handleSelectAllFiltered = () => {
    const allFiltered = filteredUsers
      .filter((u) => !isUserUnsubscribed(u))
      .map((u) => u.email.toLowerCase());
    const allChecked =
      allFiltered.length > 0 &&
      allFiltered.every((e) => selectedEmails.has(e));
    if (allChecked) {
      setSelectedEmails(new Set());
    } else {
      setSelectedEmails(new Set(allFiltered));
      setTargetAudience('selected');
    }
  };

  const handleAddCustomRecipient = () => {
    const clean = customEmailInput.trim().toLowerCase();
    if (!clean || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) {
      setStatusBanner({
        tone: 'error',
        text: 'Please enter a valid email address to add as a recipient.',
      });
      return;
    }
    const name = customNameInput.trim() || clean.split('@')[0] || 'Trader';
    if (!allCombinedUsers.some((u) => u.email.toLowerCase() === clean)) {
      setCustomRecipients((prev) => [
        {
          id: `custom-${Date.now()}`,
          name,
          email: clean,
          joinedAt: new Date().toISOString(),
          loginCount: 1,
          lastLoginAt: new Date().toISOString(),
          sessionCount: 0,
          tradeCount: 0,
          source: 'server',
        },
        ...prev,
      ]);
    }
    setSelectedEmails((prev) => new Set([...prev, clean]));
    setTargetAudience('selected');
    setCustomEmailInput('');
    setCustomNameInput('');
    setStatusBanner({
      tone: 'info',
      text: `Added ${name} (${clean}) to your selected individual recipients.`,
    });
  };

  const handleToggleUserSubscription = async (
    user: AdminUser,
    makeUnsubscribed: boolean
  ) => {
    const clean = user.email.trim().toLowerCase();
    setBusyAction(`sub-${clean}`);
    setStatusBanner(null);
    try {
      const res = await updateEmailSubscriptionStatus(
        clean,
        makeUnsubscribed,
        preview
      );
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
            ? `${user.name} (${clean}) has been unsubscribed from emails.`
            : `${user.name} (${clean}) has been re-subscribed to emails.`,
        });
      }
    } finally {
      setBusyAction(null);
    }
  };

  const handleSaveCopy = async () => {
    if (!activeNewsletter) return;
    setBusyAction('save');
    setStatusBanner(null);
    try {
      const { steps: parsedSteps } = extractClientNewsletterStepsAndIntro(draftBody);
      const cleanBadge = stripClientLegacyDayPrefix(draftBadge);
      const res = await saveAdminNewsletter(
        {
          id: activeNewsletter.id,
          dayNumber: draftDayNumber,
          cadence: draftCadence,
          category: draftCategory || cleanBadge,
          phaseLabel: cleanBadge,
          badgeText: cleanBadge,
          subject: draftSubject,
          headline: draftHeadline,
          bodyText: draftBody,
          steps: parsedSteps,
          actionTip: draftActionTip,
          ctaText: draftCtaText,
          targetAudience,
        },
        preview
      );
      if (!res.ok) {
        setStatusBanner({
          tone: 'error',
          text: res.error || 'Could not save newsletter changes.',
        });
        return;
      }
      if (res.newsletters) setNewsletters(res.newsletters);
      setEditingCopy(false);
      setStatusBanner({
        tone: 'success',
        text: 'Email layout and personalized copy saved.',
      });
    } finally {
      setBusyAction(null);
    }
  };

  const handleCreateNewLetter = async () => {
    const maxDay = newsletters.reduce(
      (max, n) => Math.max(max, n.dayNumber || 1),
      0
    );
    const nextOrder = maxDay + 1;
    const newId = `newsletter-letter-${nextOrder}-${Date.now().toString(36)}`;
    setBusyAction('create-letter');
    try {
      const res = await saveAdminNewsletter(
        {
          id: newId,
          dayNumber: nextOrder,
          cadence: 'daily',
          category: 'letter',
          phaseLabel: 'Personal Letter · Chart Replay',
          badgeText: 'Personal Letter · Chart Replay',
          subject:
            'Hi {{firstName}} — A Personal Note from Cheslin at Chart Replay',
          headline:
            'Hi {{firstName}}, thank you for practicing and building your edge with us.',
          bodyText:
            'I wanted to send you a quick personal letter to check in on your trading journey.\n\nConsistent profitability comes from deliberate, stress-free repetition on the charts. Whether you are testing a Normal Strategy Backtest or preparing for a Prop Firm Evaluation, every 15-minute replay session sharpens your eye for high-probability setups.\n\nKeep {{tradingPlanName}} pinned on your chart, trust your stop-loss math, and let me know if there is any feature we can build to make your practice even smoother.',
          steps: [],
          actionTip:
            'Open Chart Replay for a focused 15-minute session today and execute 2 to 3 clean setups strictly following your plan.',
          ctaText: 'Open Your Chart Replay Workspace →',
          status: 'pending_approval',
          targetAudience,
          approved: true,
        },
        preview
      );
      if (res.ok && res.newsletters) {
        setNewsletters(res.newsletters);
        setSelectedId(newId);
        setEditingCopy(true);
        setStatusBanner({
          tone: 'info',
          text: 'Created new Personal Letter! Customize your letter below, then choose All or Individuals to Send Now or Schedule.',
        });
      }
    } finally {
      setBusyAction(null);
    }
  };

  const handleCreateNewEdition = async () => {
    const maxDay = newsletters.reduce(
      (max, n) => Math.max(max, n.dayNumber || 1),
      0
    );
    const nextOrder = maxDay + 1;
    const newId = `newsletter-playbook-${nextOrder}-${Date.now().toString(36)}`;
    setBusyAction('create');
    try {
      const res = await saveAdminNewsletter(
        {
          id: newId,
          dayNumber: nextOrder,
          cadence: 'daily',
          category: 'Bulk Broadcast Playbook',
          phaseLabel: 'Trader Playbook · 5 Steps',
          badgeText: 'Trader Playbook · 5 Steps',
          subject:
            'Hi {{firstName}} — 5 Steps to Sharpen Your Chart Replay Execution This Week',
          headline:
            '5 simple steps to trade with institutional discipline today, {{firstName}}.',
          bodyText:
            'Success in trading comes from repeating a clear, step-by-step process without emotion.\n\n1. Mark Your Session Liquidity First: Identify the previous day high/low and London/New York session levels before pressing Play.\n2. Pin Your Trading Plan on Screen: Keep {{tradingPlanName}} open right on your chart so every entry is objective.\n3. Wait for Liquidity Sweep + Confirmation: Skip choppy consolidation bars until price sweeps a key level and confirms structure.\n4. Size Strictly at 0.5% to 1% Risk: Use the Order Ticket calculator so no single stop-out ever causes stress.\n5. Journal One Sentence Per Trade: Record whether you followed your rules 100% regardless of win or loss.',
          steps: [
            'Mark Your Session Liquidity First: Identify the previous day high/low and London/New York session levels before pressing Play.',
            'Pin Your Trading Plan on Screen: Keep {{tradingPlanName}} open right on your chart so every entry is objective.',
            'Wait for Liquidity Sweep + Confirmation: Skip choppy consolidation bars until price sweeps a key level and confirms structure.',
            'Size Strictly at 0.5% to 1% Risk: Use the Order Ticket calculator so no single stop-out ever causes stress.',
            'Journal One Sentence Per Trade: Record whether you followed your rules 100% regardless of win or loss.',
          ],
          actionTip:
            'Complete 1 focused 15-minute replay session today and follow all 5 steps on your checklist.',
          ctaText: 'Open Your Trading Workspace →',
          status: 'pending_approval',
          targetAudience: 'all',
          approved: false,
        },
        preview
      );
      if (res.ok && res.newsletters) {
        setNewsletters(res.newsletters);
        setSelectedId(newId);
        setEditingCopy(true);
        setStatusBanner({
          tone: 'info',
          text: 'Created new 5-step playbook email draft. Customize the steps if needed, then Approve or Send Bulk Email.',
        });
      }
    } finally {
      setBusyAction(null);
    }
  };

  const handleToggleApproval = async (approve: boolean) => {
    if (!activeNewsletter) return;
    setBusyAction('approve');
    setStatusBanner(null);
    try {
      const { steps: parsedSteps } = extractClientNewsletterStepsAndIntro(draftBody);
      const cleanBadge = stripClientLegacyDayPrefix(draftBadge);
      await saveAdminNewsletter(
        {
          id: activeNewsletter.id,
          dayNumber: draftDayNumber,
          cadence: draftCadence,
          category: draftCategory || cleanBadge,
          phaseLabel: cleanBadge,
          badgeText: cleanBadge,
          subject: draftSubject,
          headline: draftHeadline,
          bodyText: draftBody,
          steps: parsedSteps,
          actionTip: draftActionTip,
          ctaText: draftCtaText,
          targetAudience,
        },
        preview
      );
      const res = await approveAdminNewsletter(
        activeNewsletter.id,
        approve,
        preview
      );
      if (!res.ok) {
        setStatusBanner({
          tone: 'error',
          text: res.error || 'Could not update approval status.',
        });
        return;
      }
      if (res.newsletters) setNewsletters(res.newsletters);
      setStatusBanner({
        tone: approve ? 'success' : 'info',
        text: approve
          ? `Approved "${draftSubject}"! Ready for bulk broadcast or scheduled delivery.`
          : 'Email returned to Pending Approval status.',
      });
    } finally {
      setBusyAction(null);
    }
  };

  const handleScheduleSelected = async () => {
    if (!activeNewsletter) return;
    if (targetAudience === 'selected' && selectedEmails.size === 0) {
      setStatusBanner({
        tone: 'error',
        text: 'Please check at least one individual recipient below before scheduling for Selected Individuals.',
      });
      return;
    }
    setBusyAction('schedule');
    setStatusBanner(null);
    try {
      const { steps: parsedSteps } = extractClientNewsletterStepsAndIntro(draftBody);
      const cleanBadge = stripClientLegacyDayPrefix(draftBadge);
      await saveAdminNewsletter(
        {
          id: activeNewsletter.id,
          dayNumber: draftDayNumber,
          cadence: draftCadence,
          category: draftCategory || cleanBadge,
          phaseLabel: cleanBadge,
          badgeText: cleanBadge,
          subject: draftSubject,
          headline: draftHeadline,
          bodyText: draftBody,
          steps: parsedSteps,
          actionTip: draftActionTip,
          ctaText: draftCtaText,
          targetAudience,
          selectedRecipients: Array.from(selectedEmails),
        },
        preview
      );
      const scheduledIso = new Date(scheduleDateTime).toISOString();
      const res = await scheduleAdminNewsletter(
        {
          id: activeNewsletter.id,
          scheduledFor: scheduledIso,
          cadence: draftCadence,
          targetAudience,
          selectedRecipients: Array.from(selectedEmails),
          approveAndSchedule: true,
        },
        preview
      );
      if (!res.ok) {
        setStatusBanner({
          tone: 'error',
          text: res.error || 'Could not schedule newsletter.',
        });
        return;
      }
      if (res.newsletters) setNewsletters(res.newsletters);
      setStatusBanner({
        tone: 'success',
        text: `Approved & scheduled "${cleanBadge}" for ${formatSaDateTime(
          scheduledIso
        )} SAST (${
          targetAudience === 'selected'
            ? `${selectedEmails.size} selected individual(s)`
            : `${recipientUsersForTarget.length} subscribed recipients`
        }).`,
      });
    } finally {
      setBusyAction(null);
    }
  };

  const handleCancelScheduledEdition = async (id: string) => {
    setBusyAction(`unschedule-${id}`);
    setStatusBanner(null);
    try {
      const res = await unscheduleAdminNewsletter(id, preview);
      if (res.ok && res.newsletters) {
        setNewsletters(res.newsletters);
        setStatusBanner({
          tone: 'info',
          text: 'Scheduled delivery cancelled.',
        });
      }
    } finally {
      setBusyAction(null);
    }
  };

  const handleDeleteEdition = async (id: string) => {
    setBusyAction(`delete-${id}`);
    setStatusBanner(null);
    try {
      const res = await deleteAdminNewsletter(id, preview);
      if (res.ok && res.newsletters) {
        setNewsletters(res.newsletters);
        if (selectedId === id && res.newsletters[0]) {
          setSelectedId(res.newsletters[0].id);
        }
        setStatusBanner({
          tone: 'info',
          text: 'Email template removed.',
        });
      }
    } finally {
      setBusyAction(null);
    }
  };

  const handleAutoScheduleFullSeries = async () => {
    setBusyAction('series');
    setStatusBanner(null);
    try {
      const startIso = new Date(scheduleDateTime).toISOString();
      const res = await scheduleAdminNewsletterSeries(
        {
          cadence: scheduleCadence,
          dailyDaysCount: 5,
          startAt: startIso,
          targetAudience,
          selectedRecipients: Array.from(selectedEmails),
          approveAll: true,
        },
        preview
      );
      if (!res.ok) {
        setStatusBanner({
          tone: 'error',
          text: res.error || 'Could not schedule series.',
        });
        return;
      }
      if (res.newsletters) setNewsletters(res.newsletters);
      setStatusBanner({
        tone: 'success',
        text: `All playbook emails approved and scheduled starting ${formatSaDateTime(
          startIso
        )} SAST!`,
      });
    } finally {
      setBusyAction(null);
    }
  };

  const handleSendNow = async (
    overrideAudience?: NewsletterTargetAudience,
    singleRecipient?: AdminUser
  ) => {
    if (!activeNewsletter) return;
    const effectiveAudience = singleRecipient
      ? 'selected'
      : overrideAudience || targetAudience;
    if (
      !singleRecipient &&
      effectiveAudience === 'selected' &&
      selectedEmails.size === 0
    ) {
      setStatusBanner({
        tone: 'error',
        text: 'Please select at least one individual recipient (or switch to All Subscribed Traders) before sending.',
      });
      return;
    }
    setBusyAction(
      singleRecipient
        ? `send-single-${singleRecipient.email}`
        : overrideAudience === 'inactive_2_3_days'
        ? 'send-inactive'
        : 'send'
    );
    setStatusBanner(null);
    try {
      const { steps: parsedSteps } = extractClientNewsletterStepsAndIntro(draftBody);
      const cleanBadge = stripClientLegacyDayPrefix(draftBadge);
      await saveAdminNewsletter(
        {
          id: activeNewsletter.id,
          dayNumber: draftDayNumber,
          cadence: draftCadence,
          category: draftCategory || cleanBadge,
          phaseLabel: cleanBadge,
          badgeText: cleanBadge,
          subject: draftSubject,
          headline: draftHeadline,
          bodyText: draftBody,
          steps: parsedSteps,
          actionTip: draftActionTip,
          ctaText: draftCtaText,
          targetAudience: effectiveAudience,
          selectedRecipients: singleRecipient
            ? [singleRecipient.email.toLowerCase()]
            : Array.from(selectedEmails),
        },
        preview
      );

      let targetUsers = recipientUsersForTarget;
      if (singleRecipient) {
        targetUsers = [singleRecipient];
      } else if (effectiveAudience === 'inactive_2_3_days') {
        targetUsers =
          inactiveTraders.length > 0 ? inactiveTraders : subscribedUsers;
      } else if (effectiveAudience === 'all') {
        targetUsers = subscribedUsers;
      }

      const recipients = targetUsers
        .filter((u) => !isUserUnsubscribed(u))
        .map((u) => ({
          email: u.email,
          name: u.name,
        }));
      if (recipients.length === 0) {
        setStatusBanner({
          tone: 'error',
          text: 'No subscribed recipients matched your selection (unsubscribed users are automatically excluded).',
        });
        return;
      }
      const res = await sendAdminNewsletterNow(
        {
          id: activeNewsletter.id,
          recipients,
          targetAudience: effectiveAudience,
          isBulk: recipients.length > 1,
          approveAndSend: true,
        },
        preview
      );
      if (!res.ok) {
        setStatusBanner({
          tone: 'error',
          text: res.error || 'Could not send newsletter.',
        });
        return;
      }
      if (res.newsletters) setNewsletters(res.newsletters);
      if (res.logs) setLogs(res.logs);
      const suppressedMatches = recipients
        .map((r) => r.email.trim().toLowerCase())
        .filter((em) => suppressedByEmail.has(em));
      setStatusBanner({
        tone: suppressedMatches.length > 0 ? 'info' : 'success',
        text:
          suppressedMatches.length > 0
            ? `Dispatched "${cleanBadge}", but ${suppressedMatches.join(
                ', '
              )} is currently on Resend's suppression list and will not receive emails until unblocked below.`
            : singleRecipient
            ? `Email "${cleanBadge}" sent individually to ${singleRecipient.name} (${singleRecipient.email})!`
            : effectiveAudience === 'inactive_2_3_days'
            ? `Sent Comeback Motivation playbook to ${
                res.results?.length || recipients.length
              } trader(s) who were away 2–3+ days! Open tracking is active.`
            : `Sent "${cleanBadge}" from Cheslin from Chart Replay to ${
                res.results?.length || recipients.length
              } subscribed trader(s)! Open tracking & Unsubscribe link active.`,
      });
    } finally {
      setBusyAction(null);
    }
  };

  const handleSelectComebackPlaybook = () => {
    const comeback = newsletters.find(
      (n) =>
        n.id === 'newsletter-day-3' ||
        n.targetAudience === 'inactive_2_3_days' ||
        /missed you|comeback/i.test(n.subject)
    );
    if (comeback) {
      setSelectedId(comeback.id);
    }
    setTargetAudience('inactive_2_3_days');
    setUserFilterMode('inactive_2_3_days');
    setStatusBanner({
      tone: 'info',
      text: `Selected the 3-Step Comeback Playbook targeting ${inactiveTraders.length} trader(s) inactive for 2–3+ days.`,
    });
  };

  const card =
    'rounded-2xl border border-white/[0.08] bg-gradient-to-br from-white/[0.035] to-white/[0.01]';

  return (
    <div className="mt-6 space-y-6">
      {/* Top Metrics Row */}
      <div className="grid grid-cols-2 xl:grid-cols-5 gap-3 sm:gap-4">
        <section className={`${card} from-emerald-500/15 p-4 sm:p-5`}>
          <div className="flex items-center justify-between text-emerald-300 mb-3">
            <Users size={18} />
            <span className="text-[9px] uppercase tracking-wider opacity-70">
              Subscribed List
            </span>
          </div>
          <p className="text-[11px] text-slate-400">
            Subscribed Trader Emails
          </p>
          <div className="mt-1 flex items-baseline gap-2">
            <p className="text-2xl sm:text-3xl font-bold text-emerald-300">
              {metrics.totalEmails}
            </p>
            {metrics.unsubscribedCount > 0 && (
              <span className="text-[11px] font-semibold text-rose-300">
                · {metrics.unsubscribedCount} unsubscribed
              </span>
            )}
          </div>
        </section>

        <section className={`${card} from-amber-500/15 p-4 sm:p-5`}>
          <div className="flex items-center justify-between text-amber-300 mb-3">
            <Clock3 size={18} />
            <span className="text-[9px] uppercase tracking-wider opacity-70">
              Away 2–3+ Days
            </span>
          </div>
          <p className="text-[11px] text-slate-400">
            Ready for Comeback Email
          </p>
          <p className="mt-1 text-2xl sm:text-3xl font-bold text-amber-300">
            {metrics.inactiveCount}
          </p>
        </section>

        <section className={`${card} from-cyan-500/15 p-4 sm:p-5`}>
          <div className="flex items-center justify-between text-cyan-300 mb-3">
            <ShieldCheck size={18} />
            <span className="text-[9px] uppercase tracking-wider opacity-70">
              Letters &amp; Playbooks
            </span>
          </div>
          <p className="text-[11px] text-slate-400">Approved &amp; Scheduled</p>
          <div className="mt-1 flex items-baseline gap-2">
            <p className="text-2xl sm:text-3xl font-bold text-cyan-300">
              {metrics.approvedCount} / {newsletters.length}
            </p>
            {metrics.scheduledCount > 0 && (
              <span className="text-[11px] font-semibold text-emerald-300">
                · {metrics.scheduledCount} scheduled
              </span>
            )}
          </div>
        </section>

        <section className={`${card} from-violet-500/15 p-4 sm:p-5`}>
          <div className="flex items-center justify-between text-violet-300 mb-3">
            <Send size={18} />
            <span className="text-[9px] uppercase tracking-wider opacity-70">
              Bulk &amp; Direct Sends
            </span>
          </div>
          <p className="text-[11px] text-slate-400">Total Emails Dispatched</p>
          <p className="mt-1 text-2xl sm:text-3xl font-bold text-violet-300">
            {metrics.totalDeliveries}
          </p>
        </section>

        <section className={`${card} from-sky-500/15 p-4 sm:p-5 col-span-2 xl:col-span-1`}>
          <div className="flex items-center justify-between text-sky-300 mb-3">
            <MailOpen size={18} />
            <span className="text-[9px] uppercase tracking-wider opacity-70">
              Open Tracking
            </span>
          </div>
          <p className="text-[11px] text-slate-400">
            Opened Emails ({metrics.openRate}% Rate)
          </p>
          <div className="mt-1 flex items-baseline gap-2">
            <p className="text-2xl sm:text-3xl font-bold text-sky-300">
              {metrics.openedLogsCount} / {logs.length}
            </p>
            {metrics.clickedLogsCount > 0 && (
              <span className="text-[11px] font-semibold text-emerald-300">
                · {metrics.clickedLogsCount} clicked
              </span>
            )}
          </div>
        </section>
      </div>

      {/* Bulk Broadcast, Letters, Recipient Selection & Scheduler Banner */}
      <section className={`${card} p-5 sm:p-6`}>
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-white/5 pb-5">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-emerald-400/10 border border-emerald-400/30 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-300">
              <Newspaper size={12} />
              Cheslin from Chart Replay · Personal Letters, Step Playbooks, Scheduler &amp; Bulk Emails
            </div>
            <h2 className="mt-2.5 text-lg sm:text-xl font-semibold text-white">
              Send Bulk Emails or Personal Letters — To All Subscribed or Selected Individuals — Now or Scheduled
            </h2>
            <p className="mt-1 text-xs text-slate-400 max-w-3xl leading-relaxed">
              Every email is sent from{' '}
              <strong className="text-emerald-300">
                Cheslin from Chart Replay &lt;noreply@chartreplay.co.za&gt;
              </strong>{' '}
              with a built-in{' '}
              <strong className="text-slate-200">1-click Unsubscribe link</strong>{' '}
              and{' '}
              <strong className="text-sky-300">real-time open &amp; click tracking</strong>. Compose a clean{' '}
              <strong className="text-cyan-300">Personal Letter</strong> or a{' '}
              <strong className="text-emerald-300">3-to-5-Step Playbook</strong>, choose whether to send to{' '}
              <strong className="text-white">All Subscribed</strong> or{' '}
              <strong className="text-white">Individuals</strong>, and send immediately or schedule for any Date &amp; Time.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void handleCreateNewLetter()}
              disabled={busyAction !== null}
              className="inline-flex items-center gap-1.5 rounded-xl border border-cyan-400/40 bg-cyan-400/15 px-3.5 py-2 text-xs font-bold text-cyan-200 hover:bg-cyan-400/25 transition"
            >
              <FileText size={14} />
              + New Personal Letter
            </button>
            <button
              type="button"
              onClick={() => void handleCreateNewEdition()}
              disabled={busyAction !== null}
              className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-3.5 py-2 text-xs font-semibold text-emerald-200 hover:bg-emerald-400/20 transition"
            >
              <Plus size={14} />
              + New Step-by-Step Playbook
            </button>
            <button
              type="button"
              onClick={handleSelectComebackPlaybook}
              className="inline-flex items-center gap-1.5 rounded-xl border border-amber-400/35 bg-amber-400/10 px-3.5 py-2 text-xs font-semibold text-amber-200 hover:bg-amber-400/20 transition"
            >
              <Clock3 size={14} />
              2–3+ Days Inactive ({metrics.inactiveCount})
            </button>
            <button
              type="button"
              onClick={() => void refreshNewsletters()}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 px-3.5 py-2 text-xs text-slate-300 hover:bg-white/5 transition"
            >
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
              Refresh Opens
            </button>
          </div>
        </div>

        {suppressedRecipients.length > 0 && (
          <div className="mt-4 rounded-2xl border border-amber-400/35 bg-amber-500/10 p-4 text-xs text-amber-100">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-amber-200">
                  Delivery Alert: {suppressedRecipients.length} address
                  {suppressedRecipients.length === 1 ? ' is' : 'es are'} currently blocked on Resend&apos;s Suppression List
                </p>
                <p className="mt-1 text-[11px] text-amber-100/80">
                  Resend silently suppresses emails to addresses that previously bounced. Unblock verified customer addresses after confirming their inbox accepts mail:
                </p>
                <div className="mt-2.5 flex flex-wrap gap-2">
                  {suppressedRecipients.map((item) => (
                    <div
                      key={item.email}
                      className="inline-flex items-center gap-2 rounded-xl border border-amber-400/30 bg-black/30 px-3 py-1.5 text-[11px]"
                    >
                      <span className="font-mono text-white">{item.email}</span>
                      <span className="text-[10px] uppercase text-amber-300">
                        ({item.origin || 'bounce'})
                      </span>
                      <button
                        type="button"
                        disabled={unblockingEmail === item.email}
                        onClick={() => void handleRemoveSuppression(item.email)}
                        className="rounded-lg bg-emerald-500/20 border border-emerald-400/40 px-2 py-0.5 text-[10px] font-bold text-emerald-200 hover:bg-emerald-500/30 disabled:opacity-50"
                      >
                        {unblockingEmail === item.email ? 'Unblocking…' : 'Unblock'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Visual Mode Cards: Send to All Subscribed vs Send to Selected Individuals */}
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <button
            type="button"
            onClick={() => setTargetAudience('all')}
            className={`flex items-start gap-3 rounded-2xl border p-3.5 text-left transition ${
              targetAudience === 'all'
                ? 'border-emerald-400/50 bg-emerald-400/10 shadow-md'
                : 'border-white/10 bg-black/20 hover:bg-white/[0.03]'
            }`}
          >
            <div className="mt-0.5 rounded-xl bg-emerald-400/15 p-2 text-emerald-300">
              <Users size={16} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-1">
                <span className="text-xs font-bold text-white">
                  Send to All (Bulk)
                </span>
                <span className="rounded-full bg-emerald-400/20 px-2 py-0.5 text-[10px] font-bold text-emerald-200">
                  {subscribedUsers.length}
                </span>
              </div>
              <p className="mt-1 text-[11px] text-slate-400">
                All subscribed traders (excludes {unsubscribedUsersCount} unsubscribed)
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setTargetAudience('selected')}
            className={`flex items-start gap-3 rounded-2xl border p-3.5 text-left transition ${
              targetAudience === 'selected'
                ? 'border-cyan-400/50 bg-cyan-400/10 shadow-md'
                : 'border-white/10 bg-black/20 hover:bg-white/[0.03]'
            }`}
          >
            <div className="mt-0.5 rounded-xl bg-cyan-400/15 p-2 text-cyan-300">
              <UserCheck size={16} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-1">
                <span className="text-xs font-bold text-white">
                  Select Individuals
                </span>
                <span className="rounded-full bg-cyan-400/20 px-2 py-0.5 text-[10px] font-bold text-cyan-200">
                  {selectedEmails.size} selected
                </span>
              </div>
              <p className="mt-1 text-[11px] text-slate-400">
                Hand-pick 1 or more individual recipients below
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setTargetAudience('inactive_2_3_days')}
            className={`flex items-start gap-3 rounded-2xl border p-3.5 text-left transition ${
              targetAudience === 'inactive_2_3_days'
                ? 'border-amber-400/50 bg-amber-400/10 shadow-md'
                : 'border-white/10 bg-black/20 hover:bg-white/[0.03]'
            }`}
          >
            <div className="mt-0.5 rounded-xl bg-amber-400/15 p-2 text-amber-300">
              <Clock3 size={16} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-1">
                <span className="text-xs font-bold text-white">
                  Inactive 2–3+ Days
                </span>
                <span className="rounded-full bg-amber-400/20 px-2 py-0.5 text-[10px] font-bold text-amber-200">
                  {inactiveTraders.length}
                </span>
              </div>
              <p className="mt-1 text-[11px] text-slate-400">
                Traders away 2–3+ days ready for a comeback nudge
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setTargetAudience('active')}
            className={`flex items-start gap-3 rounded-2xl border p-3.5 text-left transition ${
              targetAudience === 'active'
                ? 'border-violet-400/50 bg-violet-400/10 shadow-md'
                : 'border-white/10 bg-black/20 hover:bg-white/[0.03]'
            }`}
          >
            <div className="mt-0.5 rounded-xl bg-violet-400/15 p-2 text-violet-300">
              <Sparkles size={16} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-1">
                <span className="text-xs font-bold text-white">
                  Active Traders
                </span>
                <span className="rounded-full bg-violet-400/20 px-2 py-0.5 text-[10px] font-bold text-violet-200">
                  Segment
                </span>
              </div>
              <p className="mt-1 text-[11px] text-slate-400">
                Traders actively running sessions &amp; trades
              </p>
            </div>
          </button>
        </div>

        {/* Inline Add Individual Email Bar */}
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3.5 py-2.5">
          <span className="text-[11px] font-semibold text-slate-300">
            Quick Add Individual Email:
          </span>
          <input
            type="text"
            value={customNameInput}
            onChange={(e) => setCustomNameInput(e.target.value)}
            placeholder="Recipient Name (e.g. Cheslin)"
            className="w-40 sm:w-48 rounded-lg border border-white/10 bg-[#0b1320] px-3 py-1.5 text-xs text-white outline-none"
          />
          <input
            type="email"
            value={customEmailInput}
            onChange={(e) => setCustomEmailInput(e.target.value)}
            placeholder="recipient@example.com"
            className="w-48 sm:w-60 rounded-lg border border-white/10 bg-[#0b1320] px-3 py-1.5 text-xs text-white outline-none"
          />
          <button
            type="button"
            onClick={handleAddCustomRecipient}
            className="rounded-lg border border-cyan-400/40 bg-cyan-400/15 px-3 py-1.5 text-xs font-bold text-cyan-200 hover:bg-cyan-400/25 transition"
          >
            + Add &amp; Select Individual
          </button>
          {selectedEmails.size > 0 && (
            <span className="ml-auto flex items-center gap-2 text-[11px] text-cyan-200">
              <span>{selectedEmails.size} individual(s) selected</span>
              <button
                type="button"
                onClick={() => setSelectedEmails(new Set())}
                className="text-slate-400 hover:text-white underline"
              >
                Clear selection
              </button>
            </span>
          )}
        </div>

        {/* Bulk Broadcast & Scheduler Control Bar */}
        <div className="mt-4 grid gap-4 lg:grid-cols-[1.15fr_1fr_auto] items-end rounded-2xl border border-cyan-400/20 bg-[#070e19] p-4">
          <div>
            <label
              htmlFor="newsletter-audience-select"
              className="block text-[10px] font-bold uppercase tracking-wider text-emerald-300 mb-1.5"
            >
              Recipient Mode (All or Individuals)
            </label>
            <select
              id="newsletter-audience-select"
              value={targetAudience}
              onChange={(e) =>
                setTargetAudience(e.target.value as NewsletterTargetAudience)
              }
              className="w-full rounded-xl border border-white/10 bg-[#0f1928] px-3.5 py-2.5 text-xs text-white outline-none focus:border-emerald-400/50"
            >
              <option value="all">
                All Subscribed Traders — Bulk Broadcast ({subscribedUsers.length} subscribed)
              </option>
              <option value="selected">
                Selected Individual Recipients ({selectedEmails.size} selected)
              </option>
              <option value="inactive_2_3_days">
                Inactive 2–3+ Days — Comeback Motivation ({inactiveTraders.length} traders)
              </option>
              <option value="active">
                Active Traders with Practice Sessions
              </option>
              <option value="new_starters">
                New Traders (Joined in Last 7 Days)
              </option>
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="newsletter-schedule-dt"
                className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5"
              >
                Schedule Date &amp; Time (SAST)
              </label>
              <input
                id="newsletter-schedule-dt"
                type="datetime-local"
                value={scheduleDateTime}
                onChange={(e) => setScheduleDateTime(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-[#0f1928] px-3 py-2 text-xs text-white outline-none focus:border-emerald-400/50"
              />
            </div>
            <div>
              <label
                htmlFor="newsletter-cadence-mode"
                className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5"
              >
                Automated Queue Frequency
              </label>
              <select
                id="newsletter-cadence-mode"
                value={scheduleCadence}
                onChange={(e) =>
                  setScheduleCadence(e.target.value as NewsletterCadence)
                }
                className="w-full rounded-xl border border-white/10 bg-[#0f1928] px-3 py-2.5 text-xs text-white outline-none focus:border-emerald-400/50"
              >
                <option value="daily_then_every_second_day">
                  Regular Playbook Rotation (Recommended)
                </option>
                <option value="daily">Every Day</option>
                <option value="every_second_day">Every Few Days (48h)</option>
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={busyAction !== null}
              onClick={() => void handleSendNow()}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-400 to-cyan-400 px-4 py-2.5 text-xs font-extrabold text-slate-950 shadow-lg hover:opacity-95 disabled:opacity-50 transition whitespace-nowrap"
            >
              <Send size={14} />
              {busyAction === 'send'
                ? 'Sending Email…'
                : targetAudience === 'selected'
                ? `Send to ${selectedEmails.size} Selected Now`
                : `Send Bulk Email Now (${recipientUsersForTarget.length})`}
            </button>
            <button
              type="button"
              disabled={busyAction !== null}
              onClick={() => void handleScheduleSelected()}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-cyan-400/40 bg-cyan-400/15 px-3.5 py-2.5 text-xs font-bold text-cyan-200 hover:bg-cyan-400/25 disabled:opacity-50 transition whitespace-nowrap"
            >
              <CalendarClock size={14} />
              {busyAction === 'schedule'
                ? 'Scheduling…'
                : targetAudience === 'selected'
                ? `Schedule for ${selectedEmails.size} Selected`
                : 'Schedule Selected Email'}
            </button>
            <button
              type="button"
              disabled={busyAction !== null}
              onClick={() => void handleAutoScheduleFullSeries()}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 text-xs font-semibold text-slate-200 hover:bg-white/10 disabled:opacity-50 transition whitespace-nowrap"
            >
              <CalendarClock size={14} />
              {busyAction === 'series' ? 'Scheduling…' : 'Schedule Series'}
            </button>
          </div>
        </div>

        {/* Active Scheduled Queue */}
        {scheduledNewsletters.length > 0 && (
          <div className="mt-4 rounded-2xl border border-cyan-400/25 bg-cyan-400/[0.04] p-4 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-cyan-200">
                <CalendarClock size={14} />
                Scheduled Delivery Queue ({scheduledNewsletters.length})
              </span>
              <span className="text-[11px] text-slate-400">
                Scheduled emails dispatch automatically when due (SAST)
              </span>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {scheduledNewsletters.map((sched) => (
                <div
                  key={sched.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-[#070f1d] px-3.5 py-2.5 text-xs"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-white truncate">
                      {sched.subject}
                    </p>
                    <p className="text-[11px] text-cyan-300 mt-0.5">
                      {formatSaDateTime(sched.scheduledFor)} SAST ·{' '}
                      {sched.targetAudience === 'selected'
                        ? `${sched.selectedRecipients?.length || 1} Individual(s)`
                        : sched.targetAudience === 'inactive_2_3_days'
                        ? 'Inactive 2–3+ Days'
                        : 'All Subscribed'}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      disabled={busyAction !== null}
                      onClick={() => {
                        setSelectedId(sched.id);
                        void handleSendNow(sched.targetAudience);
                      }}
                      className="rounded-lg border border-emerald-400/35 bg-emerald-400/15 px-2.5 py-1 text-[11px] font-bold text-emerald-200 hover:bg-emerald-400/25 transition"
                    >
                      Send Now
                    </button>
                    <button
                      type="button"
                      disabled={busyAction === `unschedule-${sched.id}`}
                      onClick={() => void handleCancelScheduledEdition(sched.id)}
                      className="rounded-lg border border-rose-400/30 bg-rose-400/10 px-2 py-1 text-[11px] font-semibold text-rose-200 hover:bg-rose-400/20 transition"
                      title="Cancel scheduled delivery"
                    >
                      <X size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {statusBanner && (
          <div
            role="status"
            className={`mt-4 flex items-center justify-between gap-3 rounded-2xl border p-4 text-xs ${
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
      </section>

      {/* Main Split Workspace: All Letters & Step-by-Step Playbooks (Left) + Visual Email Layout & Approval Controls (Right) */}
      <div className="grid gap-6 xl:grid-cols-[380px_1fr]">
        {/* Left Column: All Letters & Step-by-Step Playbooks */}
        <section className={`${card} p-4 sm:p-5 flex flex-col`}>
          <div className="flex items-center justify-between border-b border-white/5 pb-3.5">
            <div>
              <h3 className="text-sm font-semibold text-white">
                Letters &amp; Email Playbooks ({newsletters.length})
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Select any personal letter or 3-to-5-step playbook to customize, schedule, or send
              </p>
            </div>
            <span className="rounded-full bg-emerald-400/10 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-300">
              {metrics.approvedCount} Approved
            </span>
          </div>

          <div className="mt-3 space-y-2.5 overflow-y-auto max-h-[760px] pr-1">
            {newsletters.map((item) => {
              const isSelected = item.id === activeNewsletter?.id;
              const cleanBadge = stripClientLegacyDayPrefix(item.badgeText);
              const { steps: itemSteps } = extractClientNewsletterStepsAndIntro(
                item.bodyText,
                item.steps
              );
              const isLetter =
                item.category === 'letter' ||
                /letter/i.test(cleanBadge) ||
                itemSteps.length === 0;
              const statusBadge =
                item.status === 'sent'
                  ? {
                      label: `Sent (${item.sentCount || 1})`,
                      cls: 'bg-indigo-500/20 text-indigo-200 border-indigo-400/30',
                    }
                  : item.status === 'scheduled' && item.approved
                  ? {
                      label: 'Scheduled',
                      cls: 'bg-cyan-500/20 text-cyan-200 border-cyan-400/30',
                    }
                  : item.approved
                  ? {
                      label: 'Approved ✓',
                      cls: 'bg-emerald-500/20 text-emerald-200 border-emerald-400/30',
                    }
                  : {
                      label: 'Needs Approval',
                      cls: 'bg-amber-500/20 text-amber-200 border-amber-400/30',
                    };

              return (
                <div
                  key={item.id}
                  onClick={() => {
                    setSelectedId(item.id);
                    setEditingCopy(false);
                  }}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setSelectedId(item.id);
                      setEditingCopy(false);
                    }
                  }}
                  className={`w-full cursor-pointer text-left rounded-2xl border p-3.5 transition ${
                    isSelected
                      ? 'border-emerald-400/50 bg-emerald-400/[0.09] shadow-lg'
                      : 'border-white/[0.06] bg-black/20 hover:bg-white/[0.04]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-300">
                      {cleanBadge}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[9px] font-bold ${statusBadge.cls}`}
                      >
                        {statusBadge.label}
                      </span>
                      {item.id.startsWith('newsletter-letter-') ||
                      item.id.startsWith('newsletter-playbook-') ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            void handleDeleteEdition(item.id);
                          }}
                          title="Delete custom template"
                          className="p-1 rounded-lg text-slate-500 hover:text-rose-300 hover:bg-rose-500/10"
                        >
                          <Trash2 size={12} />
                        </button>
                      ) : null}
                    </div>
                  </div>
                  <p className="mt-1.5 text-xs font-semibold text-white line-clamp-2">
                    {personalizeClientNewsletterText(
                      item.subject,
                      previewRecipient
                    )}
                  </p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    {isLetter ? (
                      <span className="rounded-md bg-cyan-400/15 border border-cyan-400/30 px-2 py-0.5 text-[10px] font-semibold text-cyan-200">
                        Personal Letter Format
                      </span>
                    ) : (
                      <span className="rounded-md bg-white/[0.06] px-2 py-0.5 text-[10px] font-medium text-sky-300">
                        {itemSteps.length} Structured Steps
                      </span>
                    )}
                    {item.targetAudience === 'selected' && (
                      <span className="rounded-md bg-cyan-400/15 border border-cyan-400/30 px-2 py-0.5 text-[10px] font-semibold text-cyan-200">
                        Individuals ({item.selectedRecipients?.length || selectedEmails.size})
                      </span>
                    )}
                    {item.targetAudience === 'inactive_2_3_days' && (
                      <span className="rounded-md bg-amber-400/15 border border-amber-400/30 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
                        2–3+ Days Inactive Comeback
                      </span>
                    )}
                  </div>
                  {item.scheduledFor && item.status === 'scheduled' && (
                    <p className="mt-2 flex items-center gap-1 text-[10px] text-cyan-300">
                      <Clock3 size={11} />
                      Scheduled: {formatSaDateTime(item.scheduledFor)} SAST
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* Right Column: Approval & Bulk Send Bar + Live Visual Email Layout Preview */}
        {activeNewsletter && (
          <section className={`${card} p-5 sm:p-6 space-y-5`}>
            {/* Administrator Approval & Bulk Dispatch Action Bar */}
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/10 bg-[#0a1322] p-4">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-emerald-400/15 border border-emerald-400/30 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-300">
                    {stripClientLegacyDayPrefix(draftBadge)}
                  </span>
                  {personalizedPreview.steps.length > 0 ? (
                    <span className="rounded-full bg-sky-500/15 border border-sky-400/30 px-2.5 py-0.5 text-[10px] font-bold text-sky-300">
                      {personalizedPreview.steps.length}-Step Breakdown
                    </span>
                  ) : (
                    <span className="rounded-full bg-cyan-500/15 border border-cyan-400/30 px-2.5 py-0.5 text-[10px] font-bold text-cyan-200">
                      Personal Letter Format
                    </span>
                  )}
                  {activeNewsletter.approved ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 border border-emerald-400/40 px-3 py-0.5 text-[11px] font-bold text-emerald-200">
                      <Check size={12} /> Approved by Administrator
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/20 border border-amber-400/40 px-3 py-0.5 text-[11px] font-bold text-amber-200">
                      Awaiting Your Approval
                    </span>
                  )}
                  {activeNewsletter.status === 'scheduled' &&
                    activeNewsletter.scheduledFor && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-cyan-500/20 border border-cyan-400/40 px-3 py-0.5 text-[11px] font-bold text-cyan-200">
                        <CalendarClock size={12} /> Scheduled for{' '}
                        {formatSaDateTime(activeNewsletter.scheduledFor)}
                      </span>
                    )}
                </div>
                <p className="mt-1.5 text-xs text-slate-400">
                  Review your letter or playbook below · Choose All Subscribed or Selected Individuals · Send Now or Schedule
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEditingCopy((prev) => !prev)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-white/10 transition"
                >
                  <Edit3 size={13} />
                  {editingCopy ? 'Close Editor' : 'Edit Letter / Steps'}
                </button>

                {!activeNewsletter.approved ? (
                  <button
                    type="button"
                    disabled={busyAction !== null}
                    onClick={() => void handleToggleApproval(true)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-400/50 bg-emerald-400/20 px-4 py-2 text-xs font-extrabold text-emerald-200 hover:bg-emerald-400/30 transition"
                  >
                    <Check size={14} />
                    {busyAction === 'approve'
                      ? 'Approving…'
                      : '1. Approve Email'}
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={busyAction !== null}
                    onClick={() => void handleToggleApproval(false)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-amber-400/35 bg-amber-400/10 px-3 py-2 text-xs font-semibold text-amber-200 hover:bg-amber-400/20 transition"
                  >
                    Approved ✓ (Unapprove)
                  </button>
                )}

                <button
                  type="button"
                  disabled={busyAction !== null}
                  onClick={() => void handleScheduleSelected()}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-cyan-400/40 bg-cyan-400/15 px-3.5 py-2 text-xs font-bold text-cyan-200 hover:bg-cyan-400/25 transition"
                >
                  <CalendarClock size={14} />
                  {busyAction === 'schedule'
                    ? 'Scheduling…'
                    : targetAudience === 'selected'
                    ? `2. Schedule for ${selectedEmails.size} Selected`
                    : '2. Approve & Schedule'}
                </button>

                <button
                  type="button"
                  disabled={busyAction !== null}
                  onClick={() => void handleSendNow('inactive_2_3_days')}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-amber-400/40 bg-amber-400/15 px-3.5 py-2 text-xs font-bold text-amber-200 hover:bg-amber-400/25 transition"
                  title="Send to traders who haven't been on the platform for 2–3+ days"
                >
                  <Clock3 size={13} />
                  {busyAction === 'send-inactive'
                    ? 'Sending…'
                    : `Send to Inactive (${inactiveTraders.length})`}
                </button>

                <button
                  type="button"
                  disabled={busyAction !== null}
                  onClick={() => void handleSendNow()}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-400 to-cyan-400 px-4 py-2 text-xs font-extrabold text-slate-950 shadow-md hover:opacity-95 disabled:opacity-40 transition"
                >
                  <Send size={13} />
                  {busyAction === 'send'
                    ? 'Sending…'
                    : targetAudience === 'selected'
                    ? `3. Send to ${selectedEmails.size} Individual(s)`
                    : `3. Send Bulk Email (${recipientUsersForTarget.length})`}
                </button>
              </div>
            </div>

            {/* Optional Copy & Step-by-Step Editor */}
            {editingCopy && (
              <div className="rounded-2xl border border-emerald-400/25 bg-[#070d18] p-4 sm:p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-300">
                      Customize Playbook Steps &amp; Personalization Tags
                    </h4>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Write numbered lines (<code className="text-emerald-300">1. Step Title: Description</code>) to render them as structured step cards. Tags:{' '}
                      <code className="text-cyan-300">{'{{firstName}}'}</code>,{' '}
                      <code className="text-cyan-300">{'{{name}}'}</code>,{' '}
                      <code className="text-cyan-300">
                        {'{{tradingPlanName}}'}
                      </code>
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={busyAction === 'save'}
                    onClick={() => void handleSaveCopy()}
                    className="rounded-xl bg-emerald-400 px-3.5 py-2 text-xs font-bold text-slate-950 hover:bg-emerald-300 transition"
                  >
                    {busyAction === 'save' ? 'Saving…' : 'Save Playbook Changes'}
                  </button>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">
                      Playbook Category / Top Pill Badge
                    </label>
                    <input
                      type="text"
                      value={draftBadge}
                      onChange={(e) => setDraftBadge(e.target.value)}
                      placeholder="e.g. Prop Firm Playbook · 5 Steps"
                      className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-xs text-white outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">
                      Default Target Audience
                    </label>
                    <select
                      value={targetAudience}
                      onChange={(e) =>
                        setTargetAudience(
                          e.target.value as NewsletterTargetAudience
                        )
                      }
                      className="w-full rounded-xl border border-white/10 bg-[#101a29] px-3 py-2 text-xs text-white outline-none"
                    >
                      <option value="all">All Registered Traders (Bulk)</option>
                      <option value="inactive_2_3_days">
                        Traders Inactive 2–3+ Days (Comeback Motivation)
                      </option>
                      <option value="active">Active Traders</option>
                      <option value="new_starters">New Starters (First 7 Days)</option>
                      <option value="selected">Selected Trader Emails</option>
                    </select>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">
                      Email Subject Line
                    </label>
                    <input
                      type="text"
                      value={draftSubject}
                      onChange={(e) => setDraftSubject(e.target.value)}
                      className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-xs text-white outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">
                      Main Headline Greeting
                    </label>
                    <input
                      type="text"
                      value={draftHeadline}
                      onChange={(e) => setDraftHeadline(e.target.value)}
                      className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-xs text-white outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">
                    Intro &amp; Numbered 3-to-5 Steps (Start each step with 1., 2., 3., etc.)
                  </label>
                  <textarea
                    rows={6}
                    value={draftBody}
                    onChange={(e) => setDraftBody(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-black/30 p-3 text-xs text-white outline-none leading-relaxed"
                  />
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">
                      Today&rsquo;s Professional Habit Action Tip
                    </label>
                    <input
                      type="text"
                      value={draftActionTip}
                      onChange={(e) => setDraftActionTip(e.target.value)}
                      className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-xs text-white outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">
                      CTA Button Text
                    </label>
                    <input
                      type="text"
                      value={draftCtaText}
                      onChange={(e) => setDraftCtaText(e.target.value)}
                      className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-xs text-white outline-none"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Personalization Preview Selector & Layout Mode Toggle */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/5 pb-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-300">
                  <Eye size={14} />
                  Preview Personalized Email As:
                </span>
                <select
                  aria-label="Preview email personalization for trader"
                  value={previewRecipient.email}
                  onChange={(e) => setPreviewUserEmail(e.target.value)}
                  className="rounded-xl border border-white/15 bg-[#0f1928] px-3 py-1.5 text-xs text-white outline-none"
                >
                  {users.map((u) => (
                    <option key={u.source + u.id} value={u.email}>
                      {u.name} ({u.email})
                    </option>
                  ))}
                  {users.length === 0 && (
                    <option value={previewRecipient.email}>
                      {previewRecipient.name} ({previewRecipient.email})
                    </option>
                  )}
                </select>
              </div>

              <div className="inline-flex items-center rounded-xl border border-white/10 bg-black/30 p-1 text-xs">
                <button
                  type="button"
                  onClick={() => setLayoutMode('desktop')}
                  className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 transition ${
                    layoutMode === 'desktop'
                      ? 'bg-emerald-400/20 text-emerald-200 font-semibold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Monitor size={12} /> Desktop Layout
                </button>
                <button
                  type="button"
                  onClick={() => setLayoutMode('mobile')}
                  className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 transition ${
                    layoutMode === 'mobile'
                      ? 'bg-emerald-400/20 text-emerald-200 font-semibold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Smartphone size={12} /> Mobile Layout
                </button>
                <button
                  type="button"
                  onClick={() => setLayoutMode('text')}
                  className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 transition ${
                    layoutMode === 'text'
                      ? 'bg-emerald-400/20 text-emerald-200 font-semibold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Plain Text
                </button>
              </div>
            </div>

            {/* Email Envelope Header */}
            <div className="rounded-2xl border border-white/10 bg-[#060b14] p-4 text-xs space-y-1.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-slate-400">
                  <strong className="text-slate-300">From:</strong>{' '}
                  <span className="text-white font-semibold">
                    Cheslin from Chart Replay
                  </span>{' '}
                  &lt;noreply@chartreplay.co.za&gt;
                </span>
                <span className="text-slate-400">
                  <strong className="text-slate-300">To:</strong>{' '}
                  <span className="text-emerald-300 font-semibold">
                    {previewRecipient.name} &lt;{previewRecipient.email}&gt;
                  </span>
                </span>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm font-bold text-white">
                  <span className="text-slate-400 font-normal text-xs mr-2">
                    Subject:
                  </span>
                  {personalizedPreview.subject}
                </div>
                <span className="inline-flex items-center gap-1 rounded-full bg-sky-500/15 border border-sky-400/30 px-2.5 py-0.5 text-[10px] font-semibold text-sky-300">
                  <MailOpen size={11} /> Open &amp; Click Tracking Active
                </span>
              </div>
            </div>

            {/* Visual Email Layout Frame */}
            {layoutMode === 'text' ? (
              <pre className="rounded-2xl border border-white/10 bg-[#050811] p-5 text-xs text-slate-200 font-mono whitespace-pre-wrap leading-relaxed">
                {[
                  `From: Cheslin from Chart Replay <noreply@chartreplay.co.za>`,
                  `Subject: ${personalizedPreview.subject}`,
                  `To: ${previewRecipient.name} <${previewRecipient.email}>`,
                  '',
                  personalizedPreview.headline,
                  '',
                  ...personalizedPreview.introParagraphs,
                  '',
                  ...(personalizedPreview.steps.length > 0
                    ? [
                        `--- Your ${personalizedPreview.steps.length}-Step Execution Breakdown ---`,
                        ...personalizedPreview.steps.map(
                          (step, idx) => `${idx + 1}. ${step}`
                        ),
                        '',
                      ]
                    : []),
                  `✓ Today's Professional Habit Focus:`,
                  personalizedPreview.actionTip,
                  '',
                  `[${personalizedPreview.ctaText}] -> https://chartreplay.co.za`,
                  '',
                  `— Cheslin from Chart Replay`,
                ].join('\n')}
              </pre>
            ) : (
              <div className="rounded-2xl border border-slate-200/80 bg-[#f1f5f9] p-4 sm:p-7 flex justify-center">
                <div
                  className={`w-full ${
                    layoutMode === 'mobile' ? 'max-w-[375px]' : 'max-w-[600px]'
                  } rounded-[22px] border border-slate-200 bg-white overflow-hidden shadow-xl transition-all`}
                >
                  {/* Top Brand Banner */}
                  <div className="bg-white border-b border-slate-200 relative">
                    <img
                      src="/email-welcome-banner.png"
                      alt="Chart Replay — Replay. Practice. Perfect Your Edge."
                      className="w-full h-auto block"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  </div>

                  {/* Greeting & Formatted Intro Paragraphs */}
                  <div className="p-6 sm:p-8 bg-white">
                    <span className="inline-block rounded-full bg-emerald-50 border border-emerald-200 px-3.5 py-1 text-[11px] font-bold uppercase tracking-widest text-emerald-700">
                      {personalizedPreview.badgeText}
                    </span>

                    <h3 className="mt-4 text-xl sm:text-2xl font-extrabold text-slate-900 leading-snug">
                      {personalizedPreview.headline}
                    </h3>

                    <div className="mt-4 space-y-4 text-[15px] leading-[1.75] text-slate-700">
                      {personalizedPreview.introParagraphs.map((para, i) => (
                        <p key={i} className="leading-[1.75]">
                          {para}
                        </p>
                      ))}
                    </div>
                  </div>

                  {/* Structured 3-to-5-Step Playbook Card */}
                  {personalizedPreview.steps.length > 0 && (
                    <div className="px-6 sm:px-8 pb-6 bg-white">
                      <div className="text-[11px] font-extrabold uppercase tracking-widest text-sky-700 mb-3">
                        {personalizedPreview.steps.length}-Step Trader Playbook
                      </div>
                      <div className="rounded-2xl border border-slate-200 bg-slate-50/90 divide-y divide-slate-200 overflow-hidden">
                        {personalizedPreview.steps.map((rawStep, idx) => {
                          const sepMatch = rawStep.match(
                            /^([^—–:]+?)\s*(?:—|–|:)\s*(.+)$/
                          );
                          const hasLead = Boolean(
                            sepMatch && sepMatch[1].trim().length < 75
                          );
                          const stepTitle = hasLead
                            ? sepMatch![1].trim()
                            : `Step ${idx + 1}`;
                          const stepDesc = hasLead
                            ? sepMatch![2].trim()
                            : rawStep.trim();

                          const badgeColors = [
                            'bg-emerald-50 border-emerald-200 text-emerald-700',
                            'bg-sky-50 border-sky-200 text-sky-700',
                            'bg-violet-50 border-violet-200 text-violet-700',
                            'bg-amber-50 border-amber-200 text-amber-700',
                            'bg-rose-50 border-rose-200 text-rose-700',
                          ];

                          return (
                            <div
                              key={idx}
                              className="p-4 sm:px-5 flex items-start gap-3.5"
                            >
                              <span
                                className={`mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border text-xs font-extrabold ${
                                  badgeColors[idx % badgeColors.length]
                                }`}
                              >
                                {idx + 1}
                              </span>
                              <div className="min-w-0 flex-1">
                                <div className="text-sm font-bold text-slate-900 mb-1">
                                  {stepTitle}
                                </div>
                                <p className="text-[13.5px] leading-relaxed text-slate-600">
                                  {stepDesc}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Today's Pro-Trader Action Box */}
                  <div className="px-6 sm:px-8 pb-6 bg-white">
                    <div className="rounded-2xl border border-emerald-300 bg-emerald-50 p-4 sm:p-5">
                      <div className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-800 mb-1.5">
                        ✓ Pro-Trader Action Focus
                      </div>
                      <p className="text-xs sm:text-sm leading-relaxed text-emerald-950 font-medium">
                        {personalizedPreview.actionTip}
                      </p>
                    </div>
                  </div>

                  {/* Primary CTA Button */}
                  <div className="px-6 sm:px-8 pb-7 bg-white">
                    <div className="w-full rounded-2xl bg-gradient-to-r from-emerald-600 to-sky-600 py-4 px-6 text-center text-sm font-extrabold text-white shadow-md">
                      {personalizedPreview.ctaText}
                    </div>
                  </div>

                  {/* Email Footer */}
                  <div className="px-6 py-5 bg-slate-50 border-t border-slate-200 text-center text-[11px] leading-relaxed text-slate-500">
                    <strong className="text-slate-900">
                      Cheslin from Chart Replay
                    </strong>{' '}
                    · Personalized for{' '}
                    <span className="text-slate-700 font-semibold">
                      {previewRecipient.name} ({previewRecipient.email})
                    </span>
                    <br />
                    Built in South Africa for deliberate trader development ·{' '}
                    <span className="text-sky-600 font-semibold">
                      chartreplay.co.za
                    </span>
                    <br />
                    <span className="text-[10px] text-slate-400">
                      Don&apos;t want to receive these trader emails?{' '}
                      <span className="underline text-slate-500">
                        Unsubscribe from email listing
                      </span>
                    </span>
                  </div>
                </div>
              </div>
            )}
          </section>
        )}
      </div>

      {/* Who Opened Your Emails — Real-Time Email Open & Click Tracker */}
      <section className={`${card} p-5 sm:p-6`}>
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/5 pb-4">
          <div>
            <div className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-sky-300">
              <MailOpen size={14} />
              Email Open &amp; Engagement Analytics
            </div>
            <h3 className="mt-1 text-base font-semibold text-white">
              Who Opened Up Your Emails ({metrics.openedLogsCount} Opened of{' '}
              {logs.length} Sent · {metrics.openRate}% Open Rate)
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Live tracking shows every trader who opened your email, how many times they opened it, when they opened it, and whether they clicked back into Chart Replay.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-xl border border-white/10 bg-black/30 p-1 text-xs">
              <button
                type="button"
                onClick={() => setOpenFilterMode('all')}
                className={`rounded-lg px-2.5 py-1 transition ${
                  openFilterMode === 'all'
                    ? 'bg-sky-400/20 text-sky-200 font-semibold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                All Sent ({logs.length})
              </button>
              <button
                type="button"
                onClick={() => setOpenFilterMode('opened')}
                className={`rounded-lg px-2.5 py-1 transition ${
                  openFilterMode === 'opened'
                    ? 'bg-emerald-400/20 text-emerald-200 font-semibold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Opened ✓ ({metrics.openedLogsCount})
              </button>
              <button
                type="button"
                onClick={() => setOpenFilterMode('unopened')}
                className={`rounded-lg px-2.5 py-1 transition ${
                  openFilterMode === 'unopened'
                    ? 'bg-amber-400/20 text-amber-200 font-semibold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Not Opened ({Math.max(0, logs.length - metrics.openedLogsCount)})
              </button>
              <button
                type="button"
                onClick={() => setOpenFilterMode('clicked')}
                className={`rounded-lg px-2.5 py-1 transition ${
                  openFilterMode === 'clicked'
                    ? 'bg-cyan-400/20 text-cyan-200 font-semibold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Clicked CTA ({metrics.clickedLogsCount})
              </button>
              {metrics.issueLogsCount > 0 && (
                <button
                  type="button"
                  onClick={() => setOpenFilterMode('issue')}
                  className={`rounded-lg px-2.5 py-1 transition ${
                    openFilterMode === 'issue'
                      ? 'bg-rose-400/20 text-rose-200 font-semibold'
                      : 'text-rose-300 hover:text-rose-200'
                  }`}
                >
                  Bounced / Blocked ({metrics.issueLogsCount})
                </button>
              )}
            </div>

            <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-1.5">
              <Search size={13} className="text-slate-500" />
              <input
                type="text"
                value={openLogSearch}
                onChange={(e) => setOpenLogSearch(e.target.value)}
                placeholder="Filter by trader or subject…"
                className="w-40 sm:w-48 bg-transparent text-xs text-white outline-none placeholder:text-slate-600"
              />
            </label>
          </div>
        </div>

        {filteredLogs.length === 0 ? (
          <div className="mt-4 rounded-xl border border-white/5 bg-black/20 p-6 text-center text-xs text-slate-400">
            No email deliveries match this filter yet. Send a bulk or comeback email above to track opens in real time.
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-xl border border-white/5">
            <table className="w-full min-w-[780px] text-left text-xs">
              <thead className="bg-white/[0.02] text-[10px] uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Trader</th>
                  <th className="px-4 py-3 font-medium">Email Subject &amp; Playbook</th>
                  <th className="px-4 py-3 font-medium">Open Status</th>
                  <th className="px-4 py-3 font-medium">Opened At (SAST)</th>
                  <th className="px-4 py-3 font-medium">Sent At (SAST)</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.slice(0, 30).map((log) => (
                  <tr
                    key={log.id}
                    className="border-t border-white/5 hover:bg-white/[0.02]"
                  >
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-200">
                        {log.userName}
                      </p>
                      <p className="text-slate-400 font-mono text-[11px]">
                        {log.userEmail}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-white line-clamp-1">
                        {log.subject}
                      </p>
                      <p className="text-[10px] text-emerald-300 mt-0.5">
                        {stripClientLegacyDayPrefix(
                          log.badgeText || log.category || 'Trader Playbook'
                        )}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {(() => {
                          const dStatus = String(log.deliveryStatus || 'sent').toLowerCase();
                          if (log.opened) {
                            return (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 border border-emerald-400/40 px-2.5 py-0.5 text-[11px] font-bold text-emerald-200">
                                <MailOpen size={12} />
                                Opened ✓
                                {Number(log.openCount || 1) > 1
                                  ? ` (${log.openCount}x)`
                                  : ''}
                              </span>
                            );
                          }
                          if (dStatus === 'suppressed') {
                            return (
                              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/20 border border-amber-400/40 px-2.5 py-0.5 text-[11px] font-semibold text-amber-200">
                                <UserMinus size={11} />
                                Suppressed (Blocked)
                              </span>
                            );
                          }
                          if (
                            dStatus === 'bounced' ||
                            dStatus === 'failed' ||
                            dStatus === 'complained'
                          ) {
                            return (
                              <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/20 border border-rose-400/40 px-2.5 py-0.5 text-[11px] font-semibold text-rose-200">
                                <Mail size={11} />
                                {dStatus === 'bounced'
                                  ? 'Bounced (Rejected)'
                                  : dStatus === 'complained'
                                  ? 'Spam Complaint'
                                  : 'Send Failed'}
                              </span>
                            );
                          }
                          if (dStatus === 'delivery_delayed') {
                            return (
                              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 border border-amber-400/30 px-2.5 py-0.5 text-[11px] text-amber-200">
                                <Clock3 size={11} />
                                Delivery Delayed
                              </span>
                            );
                          }
                          return (
                            <span className="inline-flex items-center gap-1 rounded-full bg-white/[0.06] border border-white/10 px-2.5 py-0.5 text-[11px] text-slate-400">
                              <Mail size={11} />
                              {dStatus === 'delivered'
                                ? 'Delivered · Not opened yet'
                                : 'Sent · Awaiting status'}
                            </span>
                          );
                        })()}
                        {log.clicked && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-sky-500/20 border border-sky-400/40 px-2 py-0.5 text-[10px] font-bold text-sky-200">
                            <MousePointerClick size={11} />
                            Clicked CTA
                          </span>
                        )}
                      </div>
                      {log.deliveryError && (
                        <p className="mt-1 text-[10px] text-rose-300/90 line-clamp-2" title={log.deliveryError}>
                          {log.deliveryError}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-300">
                      {log.opened && log.openedAt ? (
                        <div>
                          <span className="text-emerald-300 font-semibold">
                            {formatSaDateTime(log.openedAt)}
                          </span>
                          {log.clickedAt && (
                            <p className="text-[10px] text-sky-300">
                              Clicked: {formatSaDateTime(log.clickedAt)}
                            </p>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-500">Awaiting open…</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-400">
                      {formatSaDateTime(log.sentAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* All Registered Trader Emails Table & Individual Personalization Selector */}
      <section className={`${card} p-5 sm:p-6`}>
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/5 pb-4">
          <div>
            <h3 className="text-base font-semibold text-white">
              Registered Trader Recipients &amp; Subscription Controls ({filteredUsers.length})
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Select specific traders for bulk/individual sends, send a 1-click personal email, or manage their subscription status.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex flex-wrap rounded-xl border border-white/10 bg-black/30 p-1 text-xs">
              <button
                type="button"
                onClick={() => setUserFilterMode('all')}
                className={`rounded-lg px-2.5 py-1 transition ${
                  userFilterMode === 'all'
                    ? 'bg-emerald-400/20 text-emerald-200 font-semibold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                All ({users.length})
              </button>
              <button
                type="button"
                onClick={() => setUserFilterMode('subscribed')}
                className={`rounded-lg px-2.5 py-1 transition ${
                  userFilterMode === 'subscribed'
                    ? 'bg-sky-400/20 text-sky-200 font-semibold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Subscribed ({subscribedUsers.length})
              </button>
              <button
                type="button"
                onClick={() => setUserFilterMode('unsubscribed')}
                className={`rounded-lg px-2.5 py-1 transition ${
                  userFilterMode === 'unsubscribed'
                    ? 'bg-rose-400/20 text-rose-200 font-semibold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Unsubscribed ({unsubscribedUsersCount})
              </button>
              <button
                type="button"
                onClick={() => setUserFilterMode('inactive_2_3_days')}
                className={`rounded-lg px-2.5 py-1 transition ${
                  userFilterMode === 'inactive_2_3_days'
                    ? 'bg-amber-400/20 text-amber-200 font-semibold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Inactive 2–3+ Days ({inactiveTraders.length})
              </button>
            </div>

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
                : 'Select Filtered Emails'}
            </button>
          </div>
        </div>

        <div className="mt-4 overflow-x-auto rounded-xl border border-white/5">
          <table className="w-full min-w-[920px] text-left text-xs">
            <thead className="bg-white/[0.02] text-[10px] uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Select</th>
                <th className="px-4 py-3 font-medium">Trader Name &amp; Email</th>
                <th className="px-4 py-3 font-medium">Email Subscription</th>
                <th className="px-4 py-3 font-medium">Platform Activity Status</th>
                <th className="px-4 py-3 font-medium">Emails Opened</th>
                <th className="px-4 py-3 font-medium text-right">
                  Individual Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.slice(0, 40).map((user) => {
                const emailKey = user.email.toLowerCase();
                const isSelected = selectedEmails.has(emailKey);
                const isUnsubscribed = isUserUnsubscribed(user);
                const isPreviewing =
                  previewRecipient.email.toLowerCase() === emailKey;
                const inactive = isTraderInactive2To3PlusDays(user);
                const daysAway = getTraderDaysSinceActive(user);
                const openStats = perUserOpenStats.get(emailKey);

                return (
                  <tr
                    key={user.source + user.id}
                    className={`border-t border-white/5 hover:bg-white/[0.02] ${
                      isPreviewing ? 'bg-emerald-400/[0.05]' : ''
                    } ${isUnsubscribed ? 'opacity-65' : ''}`}
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        aria-label={`Select ${user.email}`}
                        disabled={isUnsubscribed}
                        checked={isSelected && !isUnsubscribed}
                        onChange={() => toggleSelectEmail(user.email)}
                        className="h-4 w-4 rounded border-white/20 accent-emerald-400 disabled:opacity-40"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-200">{user.name}</p>
                      <p className="text-slate-400 font-mono text-[11px]">
                        {user.email}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {isUnsubscribed ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/15 border border-rose-400/35 px-2.5 py-0.5 text-[11px] font-semibold text-rose-200">
                            <UserMinus size={11} />
                            Unsubscribed
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 border border-emerald-400/35 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-200">
                            <CheckCircle2 size={11} />
                            Subscribed
                          </span>
                        )}
                        {suppressedByEmail.has(emailKey) && (
                          <button
                            type="button"
                            disabled={unblockingEmail === emailKey}
                            onClick={() => void handleRemoveSuppression(emailKey)}
                            title="This address is suppressed on Resend (previous bounce). Click to unblock."
                            className="inline-flex items-center gap-1 rounded-full bg-amber-500/20 border border-amber-400/40 px-2.5 py-0.5 text-[10px] font-bold text-amber-200 hover:bg-amber-500/30 disabled:opacity-50"
                          >
                            {unblockingEmail === emailKey
                              ? 'Unblocking…'
                              : 'Suppressed · Click to Unblock'}
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {inactive ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 border border-amber-400/35 px-2.5 py-0.5 text-[11px] font-semibold text-amber-200">
                          <Clock3 size={11} />
                          Away {daysAway}d · Comeback Ready
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 border border-emerald-400/35 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-200">
                          <UserCheck size={11} />
                          Active ({daysAway === 0 ? 'Today' : `${daysAway}d ago`})
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {openStats ? (
                        openStats.opened > 0 ? (
                          <span className="inline-flex items-center gap-1 text-emerald-300 font-semibold">
                            <MailCheck size={13} />
                            Opened {openStats.opened}/{openStats.sent}
                          </span>
                        ) : (
                          <span className="text-slate-400">
                            0/{openStats.sent} opened
                          </span>
                        )
                      ) : (
                        <span className="text-slate-500">No emails sent yet</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex flex-wrap items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => setPreviewUserEmail(user.email)}
                          className={`inline-flex items-center gap-1 rounded-xl border px-2.5 py-1.5 text-[11px] font-semibold transition ${
                            isPreviewing
                              ? 'border-emerald-400/50 bg-emerald-400/20 text-emerald-200'
                              : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
                          }`}
                        >
                          <Sparkles size={11} />
                          {isPreviewing ? 'Previewing' : 'Preview'}
                        </button>
                        {!isUnsubscribed && (
                          <button
                            type="button"
                            disabled={busyAction !== null}
                            onClick={() => void handleSendNow(undefined, user)}
                            className="inline-flex items-center gap-1 rounded-xl border border-sky-400/30 bg-sky-400/10 px-2.5 py-1.5 text-[11px] font-semibold text-sky-200 hover:bg-sky-400/20 transition disabled:opacity-50"
                            title={`Send current email/letter directly to ${user.email}`}
                          >
                            <Send size={11} />
                            Send 1-to-1
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => void handleToggleUserSubscription(user, !isUnsubscribed)}
                          className={`inline-flex items-center gap-1 rounded-xl border px-2.5 py-1.5 text-[11px] font-semibold transition ${
                            isUnsubscribed
                              ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200 hover:bg-emerald-400/20'
                              : 'border-rose-400/25 bg-rose-400/10 text-rose-200 hover:bg-rose-400/20'
                          }`}
                        >
                          {isUnsubscribed ? (
                            <>
                              <RotateCcw size={11} />
                              Resubscribe
                            </>
                          ) : (
                            <>
                              <UserMinus size={11} />
                              Unsubscribe
                            </>
                          )}
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
    </div>
  );
};
