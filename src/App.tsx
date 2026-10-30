import {TradingMindset} from './components/TradingMindset';
import {PartnerPage} from './components/PartnerPage';
import {SitemapPage} from './components/SitemapPage';
import {TradersInsightPage} from './components/TradersInsightPage';
import {applyPageSeo} from './services/seo';
import {usePlatformActivity} from './services/usePlatformActivity';
import {AnimatedOrderPanel} from './components/AnimatedOrderPanel';
import {AdminDashboard} from './components/AdminDashboard';
import {ComingSoonPage} from './components/ComingSoonPage';
import {BalanceBadge} from './components/BalanceBadge';
import {LegalPage} from './components/LegalPage';
import {LegalDocumentKey} from './components/LegalLinks';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { MotivationWelcome } from './components/MotivationWelcome';
import { ChartSponsorLoader } from './components/ChartSponsorLoader';
import { ConfettiCelebration } from './components/ConfettiCelebration';
import { getCachedSponsorshipConfig, loadSponsorshipConfig } from './services/sponsorship';
import { resetMotivationVisit, setMotivationEnabled } from './services/motivation';
import { getReplayWeekdayTarget, getHistoricalCandles, hasHistoricalArchive, getHistoricalReplayAvailability, getLoadedHistorical1mRangeForClock, isWeekendClosedTimestamp, isFixedMarketHolidayDate } from './services/goldDataService';
import { hydrateHistoricalArchive, hydrateLiveHistoricalArchive } from './services/historicalFeed';
import { shiftTimeframeClock } from './services/goldDataService';
import {getSpotQuote, getSpotFeedStatus, SPOT_SYMBOLS} from './services/spotFeed';
import {createLivePaperSession} from './services/livePaperTrading';
import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import {
  BacktestSessionMode,
  CandleColorStyle,
  ChartDrawing,
  ChartIndicatorConfigs,
  CustomCandleColors,
  CustomRuleProfile,
  DrawingTool,
  InstrumentSymbol,
  LineStyleType,
  SessionConfig,
  SessionId,
  StrategyRecord,
  ThemeMode,
  Timeframe,
  TradeJournalEntry,
  TradingSession,
} from './types/trading';
import {
  getCachedRealCandles,
  isQuoteOnlyChart,
  getProviderChartCandles,
  getMarketFeedLabel,
  refreshMarketCandles,
  computeSessionBoxes,
  getInstrumentConfig,
  INITIAL_SESSIONS,
  TIMEFRAME_CONFIG,
} from './services/goldDataService';
import {
  evaluateSessionAt1mTimestamp,
  advanceOrRewindSessionToTimestamp,
  closeOrCancelPosition,
  computeLiveSessionMetrics,
  convertSessionAccountCurrency,
  createPracticeBranchSession,
  formatMoney,
  getAggregatedCandlesUpToClock,
  getBidAskFromMid,
  getEffectiveInstrumentSpec,
  getInstrumentPipLabel,
  hasRealMarketDataForSymbol,
  hydrateRealMarketDataForSymbol,
  modifyPositionOrOrder,
  PlaceOrderInput,
  startNewChallengeAttempt,
  validateAndPlaceOrder,
} from './services/simulationEngine';
import {
  getActiveLoggedInUser,
  cacheUserStrategyNotesLocally,
  createFreshReplacementSessionForUser,
  getDeletedSessionIds,
  getDeletedStrategyIds,
  loadUserCustomRuleProfiles,
  loadUserSessions,
  loadUserStrategies,
  loadUserStrategyNotes,
  mergeRemoteDeletedSessionIds,
  mergeRemoteDeletedStrategyIds,
  purgeBrowserSensitiveStorage,
  saveUserCustomRuleProfiles,
  saveUserSessions,
  deleteUserSession,
  deleteUserAccount,
  saveUserStrategies,
  saveUserStrategyNotes,
  setActiveLoggedInUser,
} from './services/storageAndAnalytics';
import {
  loadSavedIndicatorConfigs,
  saveIndicatorConfigs,
} from './services/chartDrawingGeometry';
import {
  adminImpersonateUser,
  AdminImpersonationInfo,
  AdminUser,
  clearAdminImpersonationState,
  getAdminImpersonationState,
  platformRequest,
} from './services/platformAccounts';
import { PlatformFeedbackPage } from './components/PlatformFeedbackPage';
import {
  fetchCustomRuleProfilesFromSupabase,
  fetchUserPreferencesFromSupabase,
  fetchUserSessionsFromSupabase,
  fetchUserStrategiesFromSupabase,
  fetchUserStrategyNotesFromSupabase,
  isUntouchedStarterSession,
} from './services/supabaseClient';
import { TopNavigation, ChartIndicatorsState } from './components/TopNavigation';
import { LeftToolbar } from './components/LeftToolbar';
import { TradingChart } from './components/TradingChart';
import { RightOrderPanel } from './components/RightOrderPanel';
import { ReplayAndSessionsDock } from './components/ReplayAndSessionsDock';
import { LandingPage } from './components/LandingPage';
import { ChartFlowUser, LoginPage } from './components/LoginPage';
import { CreateSessionModal } from './components/CreateSessionModal';
import {
  GuidedTour,
  hasSeenTour,
  markTourSeen,
  TourCloseReason,
  TourStep,
} from './components/GuidedTour';
import {
  hasSeenChartAnnouncement,
  markChartAnnouncementSeen,
} from './components/ChartAnnouncement';
import {
  hasSeenWorkspaceTour,
  markWorkspaceTourSeen,
} from './components/WorkspaceTour';
import {
  AnalyticsDashboardPage,
  HubSidebarSection,
} from './components/AnalyticsDashboardPage';
import {
  BarChart3,
  RotateCcw,
  ShieldCheck,
  Trophy,
  X,
  XCircle,
} from 'lucide-react';

const DOCK_HINT_KEY = 'chart_replay_dock_hint_dismissed_v1';

export function App() {
  // 1. User Account State
  const [currentUser, setCurrentUser] = useState<ChartFlowUser | null>(() => {
    const saved = getActiveLoggedInUser();
    if (saved) {
      return {
        id: saved.id,
        name: saved.name,
        email: saved.email,
        plan: saved.plan,
        joinedAt: saved.joinedAt,
        loginCount: saved.loginCount,
        isReturningLogin:
          (saved.loginCount ?? 1) > 1 ||
          hasSeenChartAnnouncement(saved.email) ||
          hasSeenWorkspaceTour(saved.email),
      };
    }
    return null;
  });

  const userEmail = currentUser?.email || 'trader@chartflow.io';
  const normalizePath = () =>
    window.location.pathname.replace(/\/+$/, '').toLowerCase() || '/';
  const readLegalPage = (): LegalDocumentKey | null => {
    const p = normalizePath();
    if (p === '/terms' || p === '/privacy' || p === '/popia') {
      return p.slice(1) as LegalDocumentKey;
    }
    const page = new URLSearchParams(window.location.search).get('legal');
    return page === 'terms' || page === 'privacy' || page === 'popia'
      ? page
      : null;
  };
  const readInsightRoute=():{active:boolean;slug:string|null}=>{
    const p=window.location.pathname.replace(/\/+$/,'');
    if(p==='/traders-insight')return {active:true,slug:null};
    if(p.startsWith('/traders-insight/')){
      const slug=decodeURIComponent(p.slice('/traders-insight/'.length));
      return {active:true,slug:slug||null};
    }
    return {active:false,slug:null};
  };
  const readFeedbackRoute = (): {
    active: boolean;
    name: string | null;
    email: string | null;
  } => {
    try {
      const p = normalizePath();
      const sp = new URLSearchParams(window.location.search);
      const isFeedback = p === '/feedback' || sp.get('feedback') === '1';
      return {
        active: isFeedback,
        name: sp.get('name'),
        email: sp.get('email'),
      };
    } catch {
      return { active: false, name: null, email: null };
    }
  };
  const [partnerPage,setPartnerPage]=useState(()=>normalizePath()==='/partners'||normalizePath()==='/partner');
  const [sitemapPage,setSitemapPage]=useState(()=>normalizePath()==='/sitemap');
  const [adminPage,setAdminPage]=useState(()=>normalizePath()==='/admin');
  const [comingSoon,setComingSoon]=useState(()=>normalizePath()==='/coming-soon');
  const [feedbackRoute,setFeedbackRoute]=useState<{active:boolean;name:string|null;email:string|null}>(readFeedbackRoute);
  const [adminImpersonation,setAdminImpersonation]=useState<AdminImpersonationInfo|null>(getAdminImpersonationState);
  const [insightRoute,setInsightRoute]=useState<{active:boolean;slug:string|null}>(readInsightRoute);
  const [legalPage,setLegalPage]=useState<LegalDocumentKey|null>(readLegalPage);
  const [balanceHidden,setBalanceHidden]=useState(false);
  const toggleBalance=()=>setBalanceHidden(previous=>!previous);


  // 2. View Navigation State
  const [urlResetParams, setUrlResetParams] = useState<{
    token: string | null;
    email: string | null;
  }>(() => {
    try {
      const sp = new URLSearchParams(window.location.search);
      return {
        token: sp.get('reset_token'),
        email: sp.get('email'),
      };
    } catch {
      return { token: null, email: null };
    }
  });

  const clearUrlResetParams = useCallback(() => {
    setUrlResetParams({ token: null, email: null });
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete('reset_token');
      url.searchParams.delete('email');
      window.history.replaceState({}, '', url);
    } catch {
      // ignore
    }
  }, []);

  const [activeView, setActiveView] = useState<
    'terminal' | 'dashboard' | 'analytics_page' | 'login' | 'landing'
  >(() => {
    purgeBrowserSensitiveStorage();
    try {
      const p = normalizePath();
      if (
        new URLSearchParams(window.location.search).get('reset_token') ||
        p === '/reset-password' ||
        p === '/signup' ||
        p === '/sign-up' ||
        p === '/register' ||
        p === '/login' ||
        p === '/signin' ||
        p === '/sign-in'
      ) {
        return 'login';
      }
      if (p === '/chart' || p === '/charts' || p === '/terminal') {
        return 'terminal';
      }
      if (p === '/analytics') {
        return 'analytics_page';
      }
      if (
        p === '/dashboard' ||
        p === '/desktop' ||
        p === '/sessions' ||
        p === '/strategies' ||
        p === '/notes' ||
        p === '/guide' ||
        p === '/settings'
      ) {
        return 'dashboard';
      }
    } catch {
      // ignore
    }
    const savedUser = getActiveLoggedInUser();
    if (savedUser) {
      return 'dashboard';
    }
    return 'landing';
  });

  useEffect(() => {
    purgeBrowserSensitiveStorage();
    if (activeView === 'login') return;
    let cancelled = false;
    void platformRequest('status')
      .then((res) => {
        if (cancelled || !res?.user) return;
        const u = res.user;
        setActiveLoggedInUser({
          ...u,
          authSource: 'server',
          passwordHash: '',
        });
        setCurrentUser({
          id: u.id,
          name: u.name,
          email: u.email,
          plan: u.plan || 'FREE_FOREVER',
          joinedAt: u.joinedAt,
          loginCount: u.loginCount,
          isReturningLogin:
            (u.loginCount ?? 1) > 1 ||
            hasSeenChartAnnouncement(u.email) ||
            hasSeenWorkspaceTour(u.email),
        });
        setActiveView((prev) => (prev === 'landing' ? 'dashboard' : prev));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const [hubInitialSection, setHubInitialSection] =
    useState<HubSidebarSection>(() => {
      try {
        const p = normalizePath();
        if (p === '/analytics') return 'analytics';
        if (p === '/dashboard' || p === '/desktop') return 'dashboard';
        if (
          p === '/sessions' ||
          p === '/strategies' ||
          p === '/notes' ||
          p === '/guide' ||
          p === '/settings'
        ) {
          return p.slice(1) as HubSidebarSection;
        }
      } catch {
        // ignore
      }
      return 'dashboard';
    });
  const [loginInitialMode, setLoginInitialMode] = useState<
    'login' | 'signup' | 'reset'
  >(() => {
    const p = normalizePath();
    if (
      p === '/signup' ||
      p === '/sign-up' ||
      p === '/register'
    ) {
      return 'signup';
    }
    if (
      p === '/reset-password' ||
      new URLSearchParams(window.location.search).get('reset_token')
    ) {
      return 'reset';
    }
    return 'login';
  });

  useEffect(() => {
    const handlePopState = () => {
      const p = normalizePath();
      setPartnerPage(p === '/partners' || p === '/partner');
      setSitemapPage(p === '/sitemap');
      setLegalPage(readLegalPage());
      setComingSoon(p === '/coming-soon');
      setAdminPage(p === '/admin');
      setFeedbackRoute(readFeedbackRoute());
      setInsightRoute(readInsightRoute());

      if (p === '/signup' || p === '/sign-up' || p === '/register') {
        setLoginInitialMode('signup');
        setActiveView('login');
      } else if (p === '/login' || p === '/signin' || p === '/sign-in') {
        setLoginInitialMode('login');
        setActiveView('login');
      } else if (p === '/reset-password') {
        setLoginInitialMode('reset');
        setActiveView('login');
      } else if (p === '/chart' || p === '/charts' || p === '/terminal') {
        setActiveView('terminal');
      } else if (p === '/analytics') {
        setHubInitialSection('analytics');
        setActiveView('analytics_page');
      } else if (p === '/dashboard' || p === '/desktop') {
        setHubInitialSection('dashboard');
        setActiveView('dashboard');
      } else if (
        p === '/sessions' ||
        p === '/strategies' ||
        p === '/notes' ||
        p === '/guide' ||
        p === '/settings'
      ) {
        setHubInitialSection(p.slice(1) as HubSidebarSection);
        setActiveView('dashboard');
      } else if (p === '/') {
        setActiveView('landing');
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // 3. Per-User Persistent Sessions, Strategies & Custom Prop Profiles
  const [tradingSessions, setTradingSessions] = useState<TradingSession[]>(() => {
    const loaded = loadUserSessions(userEmail).filter(
      (s) => !isUntouchedStarterSession(s)
    );
    return loaded.map((s) =>
      !s.displayTimezone || s.displayTimezone === 'UTC'
        ? { ...s, displayTimezone: 'Africa/Johannesburg' as const }
        : s
    );
  });
  usePlatformActivity(currentUser?.email,tradingSessions.map(session=>session.id).join('|'),adminPage);
  const [strategies, setStrategies] = useState<StrategyRecord[]>(() =>
    loadUserStrategies(userEmail)
  );
  const [customRuleProfiles, setCustomRuleProfiles] = useState<
    CustomRuleProfile[]
  >(() => loadUserCustomRuleProfiles(userEmail));

  const hasHydratedSessionsRef = useRef<string | null>(null);

  useEffect(() => {
    if (!currentUser) return;
    hasHydratedSessionsRef.current = null;
    const loadedSessions: TradingSession[] = loadUserSessions(currentUser.email)
      .filter((s) => !isUntouchedStarterSession(s))
      .map((s) =>
        !s.displayTimezone || s.displayTimezone === 'UTC'
          ? { ...s, displayTimezone: 'Africa/Johannesburg' as const }
          : s
      );
    setTradingSessions(loadedSessions);
    setStrategies(loadUserStrategies(currentUser.email));
    setCustomRuleProfiles(loadUserCustomRuleProfiles(currentUser.email));

    let cancelled = false;
    const email = currentUser.email;
    void fetchUserPreferencesFromSupabase(email).then((remotePrefs) => {
      if (cancelled || !remotePrefs) return;
      if (typeof remotePrefs.skipWelcome === 'boolean' && remotePrefs.skipWelcome) {
        setMotivationEnabled(email, false, false);
      }
      if (remotePrefs.deletedSessionIds?.length) {
        mergeRemoteDeletedSessionIds(email, remotePrefs.deletedSessionIds);
        const delSet = getDeletedSessionIds(email);
        setTradingSessions((prev) => prev.filter((s) => !delSet.has(s.id)));
      }
      if (remotePrefs.deletedStrategyIds?.length) {
        mergeRemoteDeletedStrategyIds(email, remotePrefs.deletedStrategyIds);
        const delStrats = getDeletedStrategyIds(email);
        setStrategies((prev) => prev.filter((s) => !delStrats.has(s.id)));
      }
    });
    void fetchUserStrategyNotesFromSupabase(email).then((remoteNotes) => {
      if (cancelled || !remoteNotes) return;
      const existing = loadUserStrategyNotes(email);
      if (!existing.text) {
        cacheUserStrategyNotesLocally(email, remoteNotes);
      }
    });
    void fetchUserSessionsFromSupabase(email)
      .then((remoteSessions) => {
        if (cancelled) return;
        hasHydratedSessionsRef.current = email;
        if (!remoteSessions || remoteSessions.length === 0) return;
        const deletedIds = getDeletedSessionIds(email);
        const activeRemoteSessions = remoteSessions.filter(
          (r) => !deletedIds.has(r.id) && !isUntouchedStarterSession(r)
        );
        if (activeRemoteSessions.length === 0) return;
        setTradingSessions((prev) => {
          const nonStarterPrev = prev.filter(
            (s) => !deletedIds.has(s.id) && !isUntouchedStarterSession(s)
          );
          const byId = new Map(nonStarterPrev.map((s) => [s.id, s]));
          for (const r of activeRemoteSessions) {
            if (
              isUntouchedStarterSession(r) &&
              activeRemoteSessions.some((x) => !isUntouchedStarterSession(x))
            ) {
              continue;
            }
            const existing = byId.get(r.id);
            if (
              !existing ||
              (Date.parse(r.updatedAt || '') || 0) >=
                (Date.parse(existing.updatedAt || '') || 0)
            ) {
              byId.set(r.id, r);
            }
          }
          const merged = Array.from(byId.values());
          return merged.length > 0 ? merged : activeRemoteSessions;
        });
        const preferredSession =
          activeRemoteSessions.find((r) => (r.positions ?? []).length > 0) ||
          activeRemoteSessions.find((r) => !isUntouchedStarterSession(r)) ||
          activeRemoteSessions[0];
        setActiveSessionId((prevId) => {
          const prevSession = activeRemoteSessions.find((r) => r.id === prevId);
          if (prevSession && !isUntouchedStarterSession(prevSession)) {
            return prevId;
          }
          // Preserve a locally created session ID if the user created a session before remote hydration completed
          if (
            prevId &&
            !prevId.startsWith('session-default') &&
            !prevId.startsWith('session-normal-') &&
            !prevId.startsWith('session-prop-') &&
            !prevId.startsWith('session-empty-')
          ) {
            return prevId;
          }
          return preferredSession.id;
        });
      })
      .catch(() => {
        if (!cancelled) {
          hasHydratedSessionsRef.current = email;
        }
      });
    void fetchUserStrategiesFromSupabase(email).then((remoteStrats) => {
      if (cancelled || !remoteStrats || remoteStrats.length === 0) return;
      const deletedStratIds = getDeletedStrategyIds(email);
      setStrategies((prev) => {
        const byId = new Map(
          prev.filter((s) => !deletedStratIds.has(s.id)).map((s) => [s.id, s])
        );
        for (const r of remoteStrats) {
          if (!deletedStratIds.has(r.id)) {
            byId.set(r.id, r);
          }
        }
        return Array.from(byId.values());
      });
    });
    void fetchCustomRuleProfilesFromSupabase(email).then((remoteProfiles) => {
      if (cancelled || !remoteProfiles || remoteProfiles.length === 0) return;
      setCustomRuleProfiles((prev) => {
        const byId = new Map(prev.map((p) => [p.id, p]));
        for (const r of remoteProfiles) byId.set(r.id, r);
        return Array.from(byId.values());
      });
    });
    return () => {
      cancelled = true;
    };
  }, [currentUser?.email]);

  const [activeSessionId, setActiveSessionId] = useState<string>(() => {
    return tradingSessions[0]?.id || 'session-default';
  });

  const fallbackSession = useMemo<TradingSession>(() => {
    const base = createFreshReplacementSessionForUser(userEmail);
    return {
      ...base,
      id: `session-empty-${userEmail}`,
      name: 'New Session',
      displayTimezone: 'Africa/Johannesburg',
    };
  }, [userEmail]);

  const activeSession = useMemo(
    () =>
      tradingSessions.find((s) => s.id === activeSessionId) ||
      tradingSessions[0] ||
      fallbackSession,
    [tradingSessions, activeSessionId, fallbackSession]
  );

  useEffect(() => {
    if (!currentUser?.email || tradingSessions.length === 0) return;
    const hasNonStarter = tradingSessions.some((s) => !isUntouchedStarterSession(s));
    if (hasHydratedSessionsRef.current === currentUser.email || hasNonStarter) {
      saveUserSessions(currentUser.email, tradingSessions);
    }
  }, [currentUser?.email, tradingSessions]);

  useEffect(() => {
    purgeBrowserSensitiveStorage();
  }, [activeView, currentUser, activeSession?.id]);

  const updateActiveSession = useCallback(
    (updater: (prev: TradingSession) => TradingSession) => {
      setTradingSessions((prevList) =>
        prevList.map((s) => (s.id === activeSession.id ? updater(s) : s))
      );
    },
    [activeSession.id]
  );

  const handleDeleteSession = useCallback(
    (sessId: string) => {
      const ownerEmail = currentUser?.email || 'guest';
      deleteUserSession(ownerEmail, sessId);
      setTradingSessions((prev) => {
        const remaining = prev.filter((s) => s.id !== sessId);
        if (
          remaining.length > 0 &&
          (activeSessionId === sessId ||
            activeSession?.id === sessId ||
            !remaining.some((s) => s.id === activeSessionId))
        ) {
          setActiveSessionId(remaining[0].id);
        }
        return remaining;
      });
    },
    [activeSessionId, activeSession?.id, currentUser?.email]
  );

  // 4. Active Symbol & Timeframe (Synced with activeSession)
  const [symbol, setSymbol] = useState<InstrumentSymbol>(
    () => activeSession?.activeAsset || 'XAUUSD'
  );
  const [timeframe, setTimeframe] = useState<Timeframe>(
    () => activeSession?.activeTimeframe || '15m'
  );
  const [secondaryTimeframe, setSecondaryTimeframe] =
    useState<Timeframe>('1H');

  useEffect(() => {
    if (activeSession) {
      const nextTf = activeSession.activeTimeframe || '15m';
      setSymbol(activeSession.activeAsset || 'XAUUSD');
      setTimeframe(nextTf);
      setReplayStepTimeframe('5m');
    }
  }, [activeSession?.id]);

  const handleSelectSymbol = useCallback(
    (nextSym: InstrumentSymbol) => {
      setSymbol(nextSym);
      updateActiveSession((s) => ({
        ...s,
        activeAsset: nextSym,
        updatedAt: new Date().toISOString(),
      }));
    },
    [updateActiveSession]
  );

  const handleSelectTimeframe = useCallback(
    (nextTf: Timeframe) => {
      setTimeframe(nextTf);
      setReplayStepTimeframe((prevStep) => {
        const nextSec = TIMEFRAME_CONFIG[nextTf]?.seconds || 900;
        const prevSec = TIMEFRAME_CONFIG[prevStep]?.seconds || 300;
        return prevSec > nextSec ? nextTf : prevStep;
      });
      updateActiveSession((s) => ({
        ...s,
        activeTimeframe: nextTf,
        updatedAt: new Date().toISOString(),
      }));
    },
    [updateActiveSession]
  );

  const [isPresentTime, setIsPresentTime] = useState(activeSession.marketMode === 'LIVE_PAPER');
  const [presentClockTs, setPresentClockTs] = useState(() => Math.floor(Date.now() / 1000));
  useEffect(() => { setIsPresentTime(activeSession.marketMode === 'LIVE_PAPER'); }, [activeSession.id]);
  const authoritativeClockTs = isPresentTime ? presentClockTs : (activeSession.replayTimestamp || activeSession.startTimestamp || Math.floor(Date.now() / 1000));

  // Hydrate real provider market data (Yahoo Finance / Kraken / Binance Spot) for the active symbol & timeframe
  const [marketDataVersion, setMarketDataVersion] = useState<number>(0);
  const [viewportFocusVersion, setViewportFocusVersion] = useState<number>(0);
  const [isMarketDataLoading, setIsMarketDataLoading] = useState<boolean>(false);
  const marketDataRequestKey = `${symbol}:${isPresentTime ? 'present' : Math.floor(authoritativeClockTs / 86400)}`;
  const [loadedMarketDataKey, setLoadedMarketDataKey] = useState<string | null>(null);
  const loaded1mRangeForClock = !isPresentTime && hasHistoricalArchive(symbol) ? getLoadedHistorical1mRangeForClock(symbol, authoritativeClockTs) : null;
  const isCurrentArchiveWindowLoaded = Boolean(
    loadedMarketDataKey === marketDataRequestKey || loaded1mRangeForClock !== null
  );
  const historicalAvailability =
    !isPresentTime && !isMarketDataLoading && isCurrentArchiveWindowLoaded
      ? getHistoricalReplayAvailability(symbol, authoritativeClockTs)
      : undefined;

  useEffect(() => {
    let cancelled = false;
    if (!isPresentTime && hasHistoricalArchive(symbol)) {
      const currentRange = getLoadedHistorical1mRangeForClock(symbol, authoritativeClockTs);
      if (currentRange) {
        setLoadedMarketDataKey(marketDataRequestKey);
        setIsMarketDataLoading(false);
        if (
          authoritativeClockTs < currentRange[0] + 7 * 86400 ||
          authoritativeClockTs + 7 * 86400 > currentRange[1]
        ) {
          void hydrateHistoricalArchive(symbol, authoritativeClockTs, 'extend').then((loaded) => {
            if (loaded && !cancelled) setMarketDataVersion((v) => v + 1);
          });
        }
        return () => {
          cancelled = true;
        };
      }
    }
    setIsMarketDataLoading(true);
    if(isPresentTime)void hydrateLiveHistoricalArchive(symbol,authoritativeClockTs).then(loaded=>{
      if(loaded && !cancelled)setMarketDataVersion(value=>value+1);
    });
    const archiveMode = !isPresentTime && hasHistoricalArchive(symbol) ? 'extend' : 'replay';
    (isPresentTime ? hydrateRealMarketDataForSymbol(symbol,timeframe) : hydrateHistoricalArchive(symbol,authoritativeClockTs,archiveMode).then(found=>found || hydrateRealMarketDataForSymbol(symbol,timeframe)))
      .then((loaded) => {
        if (!cancelled) {
          setIsMarketDataLoading(false);
          if (loaded) {
            setLoadedMarketDataKey(marketDataRequestKey);
            setMarketDataVersion((v) => v + 1);
          }
        }
      })
      .catch(() => {
        if (!cancelled) setIsMarketDataLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [symbol, timeframe, isPresentTime, Math.floor(authoritativeClockTs / 86400)]);

  useEffect(() => {
    if (!isPresentTime) return;
    let cancelled = false;
    let refreshing = false;
    const refresh = async () => {
      if (refreshing) return;
      refreshing = true;
      try {
        await Promise.all(Array.from(new Set(activeSession.chartLayout === 'SPLIT_2' ? [timeframe, secondaryTimeframe] : [timeframe])).map(tf => refreshMarketCandles(symbol, tf)));
        if (!cancelled) setMarketDataVersion(v => v + 1);
      } finally {
        refreshing = false;
      }
    };
    setPresentClockTs(Math.floor(Date.now() / 1000));
    void refresh();
    const clockTimer = setInterval(() => setPresentClockTs(Math.floor(Date.now() / 1000)), 1000);
    const dataTimer = setInterval(() => void refresh(), 5000);
    return () => { cancelled = true; clearInterval(clockTimer); clearInterval(dataTimer); };
  }, [isPresentTime, symbol, timeframe, secondaryTimeframe, activeSession.chartLayout]);

  const visibleCandles = useMemo(() => getProviderChartCandles(symbol, timeframe, authoritativeClockTs, isPresentTime),
    [symbol, timeframe, authoritativeClockTs, isPresentTime, marketDataVersion]);
  const secondaryVisibleCandles = useMemo(() => activeSession.chartLayout === 'SPLIT_2'
    ? getProviderChartCandles(symbol, secondaryTimeframe, authoritativeClockTs, isPresentTime) : [],
    [symbol, secondaryTimeframe, authoritativeClockTs, isPresentTime, marketDataVersion, activeSession.chartLayout]);
  const olderHistoryAttempts = useRef(new Set<string>());
  const loadOlderChartHistory = useCallback(async (tf:Timeframe,before:number):Promise<boolean> => {
    const key=`${symbol}:${tf}:${before}:${isPresentTime?'live':'replay'}`;
    if(olderHistoryAttempts.current.has(key))return false;
    olderHistoryAttempts.current.add(key);
    const loaded=await hydrateHistoricalArchive(symbol,before-1,isPresentTime?'live':'extend');
    if(!loaded)return false;
    const older=getProviderChartCandles(symbol,tf,authoritativeClockTs,isPresentTime)[0]?.time;
    setMarketDataVersion(value=>value+1);
    return older!==undefined && older<before;
  },[symbol,isPresentTime,authoritativeClockTs]);
  const handleGoToPresent = () => {
    setIsPlaying(false);
    const existing = tradingSessions.find(s => s.marketMode === 'LIVE_PAPER');
    const paper = existing ? {...existing, activeAsset: symbol, activeTimeframe: timeframe,
      paperOriginSessionId: activeSession.marketMode === 'LIVE_PAPER' ? existing.paperOriginSessionId : activeSession.id} : createLivePaperSession(activeSession);
    setTradingSessions(list => existing ? list.map(s => s.id === paper.id ? paper : s) : [...list, paper]);
    setActiveSessionId(paper.id);
    setPresentClockTs(Math.floor(Date.now() / 1000));
    setIsPresentTime(true);
  };
  const handleReturnToReplay = () => {
    setIsPlaying(false);
    const origin = tradingSessions.find(s => s.id === activeSession.paperOriginSessionId && s.marketMode !== 'LIVE_PAPER') || tradingSessions.find(s => s.marketMode !== 'LIVE_PAPER');
    if (origin) { setActiveSessionId(origin.id); setIsPresentTime(false); }
  };

  const paperAccount = tradingSessions.find(s => s.marketMode === 'LIVE_PAPER');
  const paperSymbols = Array.from(new Set([paperAccount?.activeAsset, ...(paperAccount?.positions || []).filter(p => p.status === 'OPEN' || p.status === 'PENDING').map(p => p.symbol || paperAccount?.activeAsset)].filter(Boolean))).sort().join(',');
  useEffect(() => {
    if (!paperAccount) return;
    const accountId = paperAccount.id;
    let cancelled = false;
    let busy = false;
    const refresh = async () => {
      if (busy) return;
      busy = true;
      try {
        const updates = await Promise.all(paperSymbols.split(',').filter(Boolean).map(async value => {
          const sym = value as InstrumentSymbol;
          const loaded = await refreshMarketCandles(sym, '1m');
          const bars = loaded ? getCachedRealCandles('1m', sym) : null;
          const bar = bars?.[bars.length - 1];
          return loaded && getSpotQuote(sym) ? {sym,quote:getSpotQuote(sym)!} : bar ? {sym, quote: {price: bar.close, time: bar.time, receivedAt: Math.floor(Date.now() / 1000)}} : null;
        }));
        if (cancelled) return;
        const now = Math.floor(Date.now() / 1000);
        setTradingSessions(list => list.map(s => {
          if (s.id !== accountId) return s;
          const liveQuotes = {...s.liveQuotes};
          for (const update of updates) if (update) liveQuotes[update.sym] = update.quote;
          return evaluateSessionAt1mTimestamp({...s, liveQuotes}, now).session;
        }));
        setMarketDataVersion(v => v + 1);
      } finally { busy = false; }
    };
    void refresh();
    const timer = setInterval(() => void refresh(), 5000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [paperAccount?.id, paperSymbols]);

  const atr14 = useMemo(() => {
    if (visibleCandles.length < 2) {
      return getInstrumentConfig(symbol).volatility1m * 4;
    }
    const slice = visibleCandles.slice(-15);
    let sum = 0;
    for (let i = 1; i < slice.length; i++) {
      const c = slice[i];
      const p = slice[i - 1];
      const tr = Math.max(
        c.high - c.low,
        Math.abs(c.high - p.close),
        Math.abs(c.low - p.close)
      );
      sum += tr;
    }
    return sum / Math.max(1, slice.length - 1);
  }, [visibleCandles, symbol]);

  // 6. Theme & Visual Preferences
  const [theme, setTheme] = useState<ThemeMode>('dark');

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  const [candleStyle, setCandleStyle] =
    useState<CandleColorStyle>('classic_green_red');
  const [customCandleColors, setCustomCandleColors] =
    useState<CustomCandleColors>({
      upColor: '#089981',
      downColor: '#f23645',
    });

  // 7. Replay Playback State
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [replayStepTimeframe, setReplayStepTimeframe] =
    useState<Timeframe>('5m');
  const [playbackSpeedMs, setPlaybackSpeedMs] = useState<number>(400);

  const isSessionLocked =
    activeSession.status === 'FAILED' ||
    activeSession.status === 'PASSED' ||
    activeSession.challengeState?.status === 'FAILED' ||
    activeSession.challengeState?.status === 'PASSED';

  useEffect(() => {
    if (isSessionLocked && isPlaying) {
      setIsPlaying(false);
    }
  }, [isSessionLocked, isPlaying]);

  // 8. Modals & Notifications
  const [isCreateSessionModalOpen, setIsCreateSessionModalOpen] =
    useState<boolean>(false);
  const [createSessionModalMode, setCreateSessionModalMode] =
    useState<BacktestSessionMode>('BACKTESTING');
  const [toastMessage, setToastMessage] = useState<{
    text: string;
    tone: 'up' | 'down' | 'info';
  } | null>(null);
  const [challengeAlertModal, setChallengeAlertModal] = useState<{
    status: 'FAILED' | 'PASSED';
    title: string;
    explanation: string;
    advancedToPhase2?: boolean;
  } | null>(null);
  const [confettiBurstKey, setConfettiBurstKey] = useState<number>(0);
  const triggerConfetti = useCallback(() => {
    setConfettiBurstKey((k) => k + 1);
  }, []);

  useEffect(() => {
    if (challengeAlertModal?.status === 'PASSED') {
      setConfettiBurstKey((k) => k + 1);
    }
  }, [challengeAlertModal]);

  const showToast = useCallback(
    (text: string, tone: 'up' | 'down' | 'info' = 'info') => {
      setToastMessage({ text, tone });
    },
    []
  );

  useEffect(() => {
    if (!toastMessage) return;
    const t = setTimeout(() => setToastMessage(null), 3500);
    return () => clearTimeout(t);
  }, [toastMessage]);

  // 9. Chart Drawings & Left Toolbar State
  const [activeTool, setActiveTool] = useState<DrawingTool>('cursor');
  const [drawingColor, setDrawingColor] = useState<string>('#2962ff');
  const [drawingLineWidth, setDrawingLineWidth] = useState<number>(2);
  const [drawingLineStyle, setDrawingLineStyle] =
    useState<LineStyleType>('solid');
  const [stayInDrawingMode, setStayInDrawingMode] = useState<boolean>(false);
  const [lockDrawings, setLockDrawings] = useState<boolean>(false);
  const [hideDrawings, setHideDrawings] = useState<boolean>(false);
  const [magnetMode, setMagnetMode] = useState<boolean>(false);
  const [isChartWideMode, setIsChartWideMode] = useState<boolean>(false);
  const MOBILE_QUERY = '(max-width: 767px), (pointer: coarse) and (max-width: 1024px)';
  const detectMobile = () =>
    typeof window !== 'undefined' &&
    (window.matchMedia(MOBILE_QUERY).matches ||
      Math.min(window.screen.width, window.screen.height) < 600);
  const [isMobile, setIsMobile] = useState<boolean>(detectMobile);
  useEffect(() => {
    const onResize = () => setIsMobile(detectMobile());
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
    };
  }, []);
  useEffect(() => {
    if (isMobile) setShowRightWidget(false);
  }, [isMobile]);
  const [showMobileTools, setShowMobileTools] = useState<boolean>(false);
  const [showRightWidget, setShowRightWidget] = useState<boolean>(() => !detectMobile());
  const [activeOrderSide, setActiveOrderSide] = useState<'LONG' | 'SHORT'>('LONG');
  const [requestedOrderSide, setRequestedOrderSide] = useState<{
    side: 'LONG' | 'SHORT';
    seq: number;
  } | null>(null);
  const handleToggleRightWidget = useCallback(() => {
    if (isChartWideMode) {
      // Panel is hidden by wide mode: leave wide mode and show the panel instead of silently flipping state
      setIsChartWideMode(false);
      setShowRightWidget(true);
      return;
    }
    setShowRightWidget((v) => !v);
  }, [isChartWideMode]);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // Guided product tour (spotlight coach-marks)
  const [isTourOpen, setIsTourOpen] = useState<boolean>(false);
  const [motivationOpen, setMotivationOpen] = useState(false);
  const [chartSponsorLoading, setChartSponsorLoading] = useState<boolean>(
    () => activeView === 'terminal' && getCachedSponsorshipConfig().enabled
  );
  useEffect(() => {
    void loadSponsorshipConfig().then((cfg) => {
      if (!cfg.enabled) {
        setChartSponsorLoading(false);
      }
    });
  }, []);
  const prevActiveViewRef = useRef(activeView);
  useEffect(() => {
    if (prevActiveViewRef.current !== 'terminal' && activeView === 'terminal') {
      setChartSponsorLoading(getCachedSponsorshipConfig().enabled);
    } else if (activeView !== 'terminal') {
      setChartSponsorLoading(false);
    }
    prevActiveViewRef.current = activeView;
  }, [activeView]);
  const [mindsetOpen,setMindsetOpen]=useState(false);
  const [planToggleCount, setPlanToggleCount] = useState(0);
  const [isPlanPinned, setIsPlanPinned] = useState(false);
  const [chartIndicators, setChartIndicators] = useState<ChartIndicatorsState>(() => ({
    showEMA20: false,
    showEMA50: false,
    showEMA200: false,
    showSMA20: false,
    showVWAP: false,
    showBOLL: false,
    showVOL: false,
    showMACD: false,
    showRSI: false,
    showMomentum: false,
    showForecast: false,
    showEngulfing: false,
    showOrderFlow: false,
  }));
  const resetChartIndicatorsOff = useCallback(() => {
    setChartIndicators({
      showEMA20: false,
      showEMA50: false,
      showEMA200: false,
      showSMA20: false,
      showVWAP: false,
      showBOLL: false,
      showVOL: false,
      showMACD: false,
      showRSI: false,
      showMomentum: false,
      showForecast: false,
      showEngulfing: false,
      showOrderFlow: false,
    });
    setIndicatorConfigs((prev) => {
      if (!prev.customMAs?.some((ma) => ma.enabled)) return prev;
      const next = {
        ...prev,
        customMAs: prev.customMAs.map((ma) => ({ ...ma, enabled: false })),
      };
      saveIndicatorConfigs(next);
      return next;
    });
  }, []);
  const handleToggleIndicator = useCallback((key: keyof ChartIndicatorsState) => {
    setChartIndicators((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);
  const [indicatorConfigs, setIndicatorConfigs] = useState<ChartIndicatorConfigs>(() =>
    loadSavedIndicatorConfigs()
  );
  const handleUpdateIndicatorConfigs = useCallback(
    (updater: (prev: ChartIndicatorConfigs) => ChartIndicatorConfigs) => {
      setIndicatorConfigs((prev) => {
        const next = updater(prev);
        saveIndicatorConfigs(next);
        return next;
      });
    },
    []
  );
  const [activeIndicatorSettingsId, setActiveIndicatorSettingsId] = useState<string | null>(null);
  const takeScreenshotRef = useRef<(() => void) | null>(null);

  const handleStartTour = useCallback(() => {
    if (!detectMobile()) setShowRightWidget(true);
    setIsChartWideMode(false);
    setIsTourOpen(true);
  }, []);

  const handleCloseTour = useCallback((reason: TourCloseReason) => {
    markTourSeen(reason, currentUser?.email);
    setIsTourOpen(false);
  }, [currentUser?.email]);

  const handleTourStepChange = useCallback((step: TourStep) => {
    const t = step.target || '';
    if (t.startsWith('order-') && !detectMobile()) setShowRightWidget(true);
    if (t.startsWith('order-') || t.startsWith('left-') || t.startsWith('replay-')) {
      setIsChartWideMode(false);
    }
  }, []);

  // Auto-start the tour once, the first time the trading workspace is opened.
  useEffect(() => {
    if (activeView !== 'terminal' || !currentUser) return;
    if (currentUser.isReturningLogin || (currentUser.loginCount ?? 1) > 1) {
      markTourSeen('completed', currentUser.email);
      return;
    }
    if (isTourOpen || motivationOpen || isCreateSessionModalOpen || challengeAlertModal || chartSponsorLoading) return;
    if (hasSeenTour(currentUser.email) || detectMobile()) return;
    const t = setTimeout(() => {
      markTourSeen('completed', currentUser.email);
      handleStartTour();
    }, 900);
    return () => clearTimeout(t);
  }, [
    activeView,
    currentUser,
    isTourOpen,
    motivationOpen,
    isCreateSessionModalOpen,
    challengeAlertModal,
    chartSponsorLoading,
    handleStartTour,
  ]);

  // Close the tour if the user navigates away from the workspace.
  useEffect(() => {
    if (activeView !== 'terminal' && isTourOpen) setIsTourOpen(false);
  }, [activeView, isTourOpen]);

  const [sessionsConfig, setSessionsConfig] =
    useState<SessionConfig[]>(INITIAL_SESSIONS);
  const [showSessionBoxes, setShowSessionBoxes] = useState<boolean>(false);
  const [showSRLevels, setShowSRLevels] = useState<boolean>(false);
  const [focusedSessionTime, setFocusedSessionTime] = useState<number | null>(
    null
  );

  const currentSymbolDrawings = useMemo(
    () => activeSession.drawingsBySymbol?.[symbol] || [],
    [activeSession.drawingsBySymbol, symbol]
  );

  const activePositionDrawing = useMemo(
    () =>
      [...currentSymbolDrawings]
        .reverse()
        .find(
          (d) => d.type === 'long_position' || d.type === 'short_position'
        ) || null,
    [currentSymbolDrawings]
  );

  const handleAddOrUpdatePositionDrawingFromTicket = useCallback(
    (
      side: 'LONG' | 'SHORT',
      entry: number,
      sl: number,
      tp: number,
      lot: number
    ) => {
      const stepSec = TIMEFRAME_CONFIG[timeframe]?.seconds || 900;
      const lastCandle = visibleCandles[visibleCandles.length - 1];
      const baseTime = lastCandle?.time || Math.floor(Date.now() / 1000);
      const isLong = side === 'LONG';
      const toolType = isLong ? 'long_position' : 'short_position';

      updateActiveSession((s) => {
        const list = s.drawingsBySymbol?.[symbol] || [];
        const existing = list.find(
          (d) => d.type === 'long_position' || d.type === 'short_position'
        );

        if (existing) {
          const updated: ChartDrawing = {
            ...existing,
            type: toolType,
            price1: entry,
            stopLoss: sl,
            takeProfit: tp,
            lotSize: lot,
            label: isLong ? 'LONG SETUP' : 'SHORT SETUP',
            color: isLong ? '#089981' : '#f23645',
          };
          return {
            ...s,
            drawingsBySymbol: {
              ...(s.drawingsBySymbol || {}),
              [symbol]: list.map((d) => (d.id === existing.id ? updated : d)),
            },
            updatedAt: new Date().toISOString(),
          };
        }

        const newPosTool: ChartDrawing = {
          id: `${toolType}-${Date.now()}`,
          type: toolType,
          time1: baseTime,
          price1: entry,
          time2: baseTime + stepSec * 18,
          price2: entry,
          stopLoss: sl,
          takeProfit: tp,
          lotSize: lot,
          label: isLong ? 'LONG SETUP' : 'SHORT SETUP',
          color: isLong ? '#089981' : '#f23645',
        };

        return {
          ...s,
          drawingsBySymbol: {
            ...(s.drawingsBySymbol || {}),
            [symbol]: [...list, newPosTool],
          },
          updatedAt: new Date().toISOString(),
        };
      });
    },
    [timeframe, visibleCandles, symbol, updateActiveSession]
  );

  const handleAddDrawing = useCallback(
    (drawing: ChartDrawing) => {
      updateActiveSession((s) => {
        const list = s.drawingsBySymbol?.[symbol] || [];
        const isPosTool =
          drawing.type === 'long_position' || drawing.type === 'short_position';
        const filteredList = isPosTool
          ? list.filter(
              (d) => d.type !== 'long_position' && d.type !== 'short_position'
            )
          : list;
        return {
          ...s,
          drawingsBySymbol: {
            ...(s.drawingsBySymbol || {}),
            [symbol]: [...filteredList, drawing],
          },
          updatedAt: new Date().toISOString(),
        };
      });
    },
    [symbol, updateActiveSession]
  );

  const handleUpdateDrawing = useCallback(
    (drawing: ChartDrawing) => {
      updateActiveSession((s) => {
        const list = s.drawingsBySymbol?.[symbol] || [];
        return {
          ...s,
          drawingsBySymbol: {
            ...(s.drawingsBySymbol || {}),
            [symbol]: list.map((d) => (d.id === drawing.id ? drawing : d)),
          },
          updatedAt: new Date().toISOString(),
        };
      });
    },
    [symbol, updateActiveSession]
  );

  const handleDeleteDrawing = useCallback(
    (id: string) => {
      updateActiveSession((s) => {
        const list = s.drawingsBySymbol?.[symbol] || [];
        return {
          ...s,
          drawingsBySymbol: {
            ...(s.drawingsBySymbol || {}),
            [symbol]: list.filter((d) => d.id !== id),
          },
          updatedAt: new Date().toISOString(),
        };
      });
    },
    [symbol, updateActiveSession]
  );

  const handleClearDrawings = useCallback(() => {
    updateActiveSession((s) => ({
      ...s,
      drawingsBySymbol: {
        ...(s.drawingsBySymbol || {}),
        [symbol]: [],
      },
      updatedAt: new Date().toISOString(),
    }));
  }, [symbol, updateActiveSession]);

  const replayStepBusy = useRef(false);
  const replayStepContext = useRef('');
  replayStepContext.current = `${activeSession.id}:${authoritativeClockTs}`;

  // 10. Replay Step & Skip Engine Handlers
  const handleAdvanceOrRewindToTimestamp = useCallback(
    (targetTs: number): { ok: boolean; error?: string } => {
      const currTs = activeSession.replayTimestamp || activeSession.startTimestamp || authoritativeClockTs;
      const stepSec = TIMEFRAME_CONFIG[replayStepTimeframe]?.seconds || 900;

      const outcome = advanceOrRewindSessionToTimestamp(activeSession, targetTs);
      if (outcome.rewindBlockedReason) {
        if (outcome.rewindBlockedReason.includes('Original minute data')) {
          void hydrateHistoricalArchive(symbol, targetTs, 'extend').then((loaded) => {
            if (loaded) {
              setMarketDataVersion((v) => v + 1);
              const retryOutcome = advanceOrRewindSessionToTimestamp(activeSession, targetTs);
              if (!retryOutcome.rewindBlockedReason) {
                setTradingSessions((prevList) =>
                  prevList.map((s) => (s.id === activeSession.id ? retryOutcome.session : s))
                );
                setViewportFocusVersion((v) => v + 1);
              } else {
                showToast(retryOutcome.rewindBlockedReason, 'down');
              }
            } else {
              showToast(outcome.rewindBlockedReason!, 'down');
            }
          });
          return { ok: true };
        }
        showToast(outcome.rewindBlockedReason, 'down');
        return { ok: false, error: outcome.rewindBlockedReason };
      }

      let nextSessionState = outcome.session;
      const alignedTarget = Math.floor(targetTs / 60) * 60;
      if (alignedTarget < currTs) {
        const undonePositions = (activeSession.positions || []).filter(
          (p) => p.entryTime > alignedTarget
        );
        if (undonePositions.length > 0) {
          const nextDrawingsBySymbol = { ...(nextSessionState.drawingsBySymbol || {}) };
          for (const p of undonePositions) {
            const posSym = p.symbol || activeSession.activeAsset || symbol;
            const currentDrawings = [...(nextDrawingsBySymbol[posSym] || [])];
            const hasPositionDrawing = currentDrawings.some(
              (d) => d.type === 'long_position' || d.type === 'short_position'
            );
            if (!hasPositionDrawing) {
              currentDrawings.push({
                id: `draw-pos-restored-${p.id}`,
                type: p.side === 'LONG' ? 'long_position' : 'short_position',
                time1: alignedTarget,
                price1: p.entryPrice,
                time2:
                  p.endTime && p.endTime > alignedTarget
                    ? p.endTime
                    : alignedTarget + stepSec * 12,
                price2: p.initialTakeProfit || p.takeProfit || p.entryPrice,
                stopLoss: p.initialStopLoss ?? p.stopLoss,
                takeProfit: p.initialTakeProfit ?? p.takeProfit,
                lotSize: p.initialLotSize ?? p.lotSize,
                color: p.side === 'LONG' ? '#089981' : '#f23645',
                label: p.side === 'LONG' ? 'LONG POS' : 'SHORT POS',
              });
              nextDrawingsBySymbol[posSym] = currentDrawings;
            }
          }
          nextSessionState = {
            ...nextSessionState,
            drawingsBySymbol: nextDrawingsBySymbol,
          };
        }
      }

      setTradingSessions((prevList) =>
        prevList.map((s) => (s.id === activeSession.id ? nextSessionState : s))
      );

      if (outcome.closedTrades.length > 0) {
        const lastClosed =
          outcome.closedTrades[outcome.closedTrades.length - 1].position;
        showToast(
          `${lastClosed.symbol} ${lastClosed.side} closed (${lastClosed.status.replace(
            'CLOSED_',
            ''
          )}): ${formatMoney(
            lastClosed.pnl,
            outcome.session.accountCurrency,
            true
          )}`,
          lastClosed.pnl >= 0 ? 'up' : 'down'
        );
      }

      if (outcome.breachedNow) {
        setIsPlaying(false);
        const breachedPhase =
          outcome.session.frozenConfig?.propFirmRules?.challengePhase ||
          outcome.session.propFirmRules?.challengePhase ||
          'PHASE_1';
        setChallengeAlertModal({
          status: 'FAILED',
          title:
            breachedPhase === 'PHASE_2'
              ? 'Phase 2 (Challenge 2) Failed — Would You Like to Redo?'
              : 'Phase 1 (Challenge 1) Failed — Would You Like to Redo?',
          explanation: outcome.breachedNow.explanation,
        });
      } else if (outcome.passedNow) {
        setIsPlaying(false);
        setChallengeAlertModal({
          status: 'PASSED',
          title: outcome.passedNow.advancedToPhase2
            ? 'Phase 1 Passed! Ready to Start Phase 2'
            : 'Congratulations! Prop Firm Challenge Passed!',
          explanation: outcome.passedNow.explanation,
          advancedToPhase2: outcome.passedNow.advancedToPhase2,
        });
      }

      return { ok: true };
    },
    [activeSession, authoritativeClockTs, replayStepTimeframe, showToast, symbol]
  );

  const handleStepBar = useCallback(
    async (deltaBars: number) => {
      if (replayStepBusy.current || isMarketDataLoading) return;
      const replayClock = activeSession.replayTimestamp || activeSession.startTimestamp || authoritativeClockTs;
      const baseClock = isPresentTime ? replayClock : authoritativeClockTs;
      const chartSec = TIMEFRAME_CONFIG[timeframe]?.seconds || 900;
      const rawStepSec = TIMEFRAME_CONFIG[replayStepTimeframe]?.seconds || 300;
      // During automatic playback, never step by a larger interval than the visible chart timeframe
      // so every single candlestick plays out smoothly one-by-one without jumping multiple candles at once.
      const effectiveStepTf =
        isPlaying && !isPresentTime && rawStepSec > chartSec ? timeframe : replayStepTimeframe;
      const stepSec = TIMEFRAME_CONFIG[effectiveStepTf]?.seconds || 300;
      const requested =
        deltaBars > 0 && !isPresentTime && stepSec >= 300 && baseClock % stepSec !== 0
          ? Math.floor(baseClock / stepSec) * stepSec + deltaBars * stepSec
          : shiftTimeframeClock(baseClock, effectiveStepTf, deltaBars);
      const isArchive = !isPresentTime && hasHistoricalArchive(symbol);
      const weekday = deltaBars > 0 && !isPresentTime && !isArchive ? getReplayWeekdayTarget(symbol, requested) : requested;
      const loadedRangeForRequested =
        deltaBars > 0 && isArchive
          ? getLoadedHistorical1mRangeForClock(symbol, requested)
          : null;
      const isWithinLoadedArchiveWindow = loadedRangeForRequested !== null;
      const availability =
        deltaBars > 0 && isArchive && isWithinLoadedArchiveWindow
          ? getHistoricalReplayAvailability(symbol, requested)
          : undefined;
      if (
        weekday === requested &&
        (isPresentTime ||
          deltaBars <= 0 ||
          (!isArchive && getReplayWeekdayTarget(symbol, requested) === requested) ||
          availability?.kind === 'READY')
      ) {
        handleAdvanceOrRewindToTimestamp(requested);
        return;
      }
      replayStepBusy.current = true;
      const context = replayStepContext.current;
      try {
        const targetMinTime =
          availability?.nextTime !== undefined && availability.nextTime > weekday
            ? availability.nextTime
            : weekday;
        const findNext = () =>
          isArchive
            ? getHistoricalCandles('1m', symbol)?.find(
                (c) => c.time >= targetMinTime && !isWeekendClosedTimestamp(c.time, symbol)
              )?.time
            : getCachedRealCandles('1m', symbol)?.find(
                (c) => c.time >= targetMinTime && getReplayWeekdayTarget(symbol, c.time) === c.time
              )?.time;
        let next = isWithinLoadedArchiveWindow ? findNext() : undefined;
        if (next === undefined) {
          setIsMarketDataLoading(true);
          await hydrateHistoricalArchive(
            symbol,
            targetMinTime,
            hasHistoricalArchive(symbol) ? 'extend' : 'replay'
          );
          if (replayStepContext.current !== context) return;
          setMarketDataVersion((value) => value + 1);
          next = findNext();
        }
        if (next === undefined || (activeSession.endTimestamp && next > activeSession.endTimestamp)) {
          setIsPlaying(false);
          showToast(
            'Market closed at this time and no later quote is available within the session date range. Extend the end date or choose another date.',
            'info'
          );
          return;
        }
        const outcome = handleAdvanceOrRewindToTimestamp(next);
        if (outcome.ok) {
          const isWeekendSkip =
            weekday !== requested ||
            isWeekendClosedTimestamp(requested, symbol) ||
            getReplayWeekdayTarget(symbol, requested) !== requested ||
            availability?.kind === 'WEEKEND';
          const skippedSeconds = next - requested;
          if (isWeekendSkip || skippedSeconds >= 4 * 3600) {
            const skipLabel = isWeekendSkip
              ? 'Weekend closed'
              : 'Market holiday / break';
            showToast(
              `${skipLabel} — skipped to ${new Date(next * 1000).toISOString().slice(0, 16).replace('T', ' ')} UTC.`,
              'info'
            );
          }
        } else {
          setIsPlaying(false);
        }
      } finally {
        replayStepBusy.current = false;
        if (replayStepContext.current === context) setIsMarketDataLoading(false);
      }
    },
    [
      activeSession,
      isPresentTime,
      isPlaying,
      isMarketDataLoading,
      authoritativeClockTs,
      timeframe,
      replayStepTimeframe,
      symbol,
      handleAdvanceOrRewindToTimestamp,
      showToast,
    ]
  );

  // Auto-advance initial replay clock once if a session starts on a market holiday / weekend break with no open trades
  const initialSessionSnapRef = useRef<string | null>(null);
  useEffect(() => {
    if (
      isPresentTime ||
      isPlaying ||
      isMarketDataLoading ||
      !isCurrentArchiveWindowLoaded ||
      !hasHistoricalArchive(symbol)
    )
      return;
    const initialTs = activeSession.startTimestamp;
    if (!initialTs || authoritativeClockTs !== initialTs) return;
    const snapKey = `${activeSession.id}:${initialTs}`;
    if (initialSessionSnapRef.current === snapKey) return;
    const hasOpenOrPending = (activeSession.positions || []).some(
      (p) => p.status === 'OPEN' || p.status === 'PENDING'
    );
    if (hasOpenOrPending) return;
    const availability = getHistoricalReplayAvailability(symbol, authoritativeClockTs);
    if (!availability) return;
    initialSessionSnapRef.current = snapKey;
    if (
      availability.kind !== 'READY' &&
      availability.nextTime !== undefined &&
      availability.nextTime > authoritativeClockTs &&
      availability.nextTime - authoritativeClockTs <= 7 * 86400 &&
      (!activeSession.endTimestamp || availability.nextTime <= activeSession.endTimestamp)
    ) {
      const outcome = handleAdvanceOrRewindToTimestamp(availability.nextTime);
      if (outcome.ok) {
        showToast(
          `Market closed at selected start time — jumped to first open bar (${new Date(
            availability.nextTime * 1000
          )
            .toISOString()
            .slice(0, 16)
            .replace('T', ' ')} UTC).`,
          'info'
        );
      }
    }
  }, [
    isPresentTime,
    isPlaying,
    isMarketDataLoading,
    isCurrentArchiveWindowLoaded,
    marketDataVersion,
    symbol,
    authoritativeClockTs,
    activeSession.id,
    activeSession.startTimestamp,
    activeSession.endTimestamp,
    activeSession.positions,
    handleAdvanceOrRewindToTimestamp,
    showToast,
  ]);

  const playbackSpeedMsRef = useRef(playbackSpeedMs);
  playbackSpeedMsRef.current = playbackSpeedMs;
  const handleStepBarRef = useRef(handleStepBar);
  handleStepBarRef.current = handleStepBar;

  useEffect(() => {
    if (!isPlaying) return;
    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout>;
    let lastTick = performance.now();

    const loop = () => {
      if (cancelled) return;
      const now = performance.now();
      const targetInterval = Math.max(40, playbackSpeedMsRef.current);
      const elapsed = now - lastTick;
      if (elapsed >= targetInterval) {
        lastTick = now;
        void handleStepBarRef.current(1);
        timeoutId = setTimeout(loop, Math.min(25, Math.max(10, Math.floor(targetInterval / 3))));
      } else {
        timeoutId = setTimeout(
          loop,
          Math.min(25, Math.max(8, Math.floor(targetInterval - elapsed)))
        );
      }
    };

    timeoutId = setTimeout(loop, Math.min(25, Math.max(10, Math.floor(playbackSpeedMsRef.current / 3))));
    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [isPlaying]);

  const handleGoToSessionOpen = useCallback(
    (
      target:
        | 'LONDON'
        | 'NEW_YORK'
        | 'TOKYO'
        | 'SYDNEY'
        | 'NEXT_DAY'
        | 'TRADE_EXIT'
    ) => {
      const currTs = authoritativeClockTs;
      if (target === 'TRADE_EXIT') {
        const openCount = (activeSession.positions || []).filter(
          (p) => p.status === 'OPEN'
        ).length;
        if (openCount === 0) {
          showToast('No open positions to fast-forward to exit.', 'info');
          return;
        }
        let simSession = activeSession;
        const maxEnd = simSession.endTimestamp || currTs + 86400 * 5;
        for (let i = 0; i < 1440; i++) {
          const nextTs = (simSession.replayTimestamp || currTs) + 60;
          if (nextTs > maxEnd) break;
          const stepRes = advanceOrRewindSessionToTimestamp(simSession, nextTs);
          simSession = stepRes.session;
          if (
            stepRes.closedTrades.length > 0 ||
            stepRes.breachedNow ||
            stepRes.passedNow
          ) {
            break;
          }
        }
        setTradingSessions((prevList) =>
          prevList.map((s) => (s.id === activeSession.id ? simSession : s))
        );
        return;
      }

      const d = new Date(currTs * 1000);
      const nextDate = new Date(
        Date.UTC(
          d.getUTCFullYear(),
          d.getUTCMonth(),
          d.getUTCDate(),
          d.getUTCHours(),
          0,
          0
        )
      );
      // London: 08:00 UTC, New York: 13:00 UTC, Tokyo/Asia: 00:00 UTC, Sydney/Australia: 21:00 UTC
      const targetHourUTC =
        target === 'LONDON'
          ? 8
          : target === 'NEW_YORK'
          ? 13
          : target === 'TOKYO'
          ? 0
          : target === 'SYDNEY'
          ? 21
          : 0;

      if (target === 'NEXT_DAY') {
        nextDate.setUTCDate(nextDate.getUTCDate() + 1);
        nextDate.setUTCHours(0, 0, 0, 0);
      } else {
        nextDate.setUTCHours(targetHourUTC, 0, 0, 0);
        if (Math.floor(nextDate.getTime() / 1000) <= currTs) {
          nextDate.setUTCDate(nextDate.getUTCDate() + 1);
        }
      }

      let skippedClosureReason: string | null = null;
      if (getInstrumentConfig(symbol).category !== 'CRYPTO') {
        for (let i = 0; i < 10; i++) {
          const dow = nextDate.getUTCDay();
          const isoDate = nextDate.toISOString().slice(0, 10);
          const holiday = isFixedMarketHolidayDate(isoDate, symbol);
          const isWeekendClosed =
            target === 'SYDNEY'
              ? dow === 5 || dow === 6
              : dow === 6 || dow === 0;
          if (!isWeekendClosed && !holiday) break;
          if (!skippedClosureReason) {
            skippedClosureReason = holiday || 'Weekend closure';
          }
          nextDate.setUTCDate(nextDate.getUTCDate() + 1);
        }
      }

      const maxEnd = activeSession.endTimestamp || currTs + 86400 * 30;
      const nextTs = Math.min(maxEnd, Math.floor(nextDate.getTime() / 1000));
      const res = handleAdvanceOrRewindToTimestamp(nextTs);
      if (res.ok && skippedClosureReason) {
        const formatted = new Date(nextTs * 1000)
          .toISOString()
          .slice(0, 16)
          .replace('T', ' ');
        showToast(
          `${skippedClosureReason} skipped — jumped to next open session (${formatted} UTC).`,
          'info'
        );
      }
    },
    [activeSession, authoritativeClockTs, symbol, handleAdvanceOrRewindToTimestamp, showToast]
  );

  // 11. Order Execution, Modification, Partial/Full Closure & Break-Even Handlers
  const handleExecuteOrder = useCallback(
    (req: PlaceOrderInput): { ok: boolean; error?: string } => {
      if (!visibleCandles.length) {
        const error = 'Provider history is unavailable at this chart time.';
        showToast(error, 'info');
        return {ok: false, error};
      }
      const symForQuote = req.symbol || activeSession.activeAsset;
      const quote = getSpotQuote(symForQuote);
      const executionSession = activeSession.marketMode === 'LIVE_PAPER' && quote ? {...activeSession,liveQuotes:{...activeSession.liveQuotes,[symForQuote]:quote}} : activeSession;
      const res = validateAndPlaceOrder(executionSession, req);
      if (!res.ok) {
        showToast(res.error || 'Order rejected.', 'down');
        return { ok: false, error: res.error };
      }
      const sym = req.symbol || activeSession.activeAsset;
      const existingDrawings = res.session.drawingsBySymbol?.[sym] || [];
      const cleanedDrawings = existingDrawings.filter(
        (d) => d.type !== 'long_position' && d.type !== 'short_position'
      );
      const nextSession: TradingSession = {
        ...res.session,
        drawingsBySymbol: {
          ...(res.session.drawingsBySymbol || {}),
          [sym]: cleanedDrawings,
        },
      };
      setTradingSessions((prevList) =>
        prevList.map((s) => (s.id === activeSession.id ? nextSession : s))
      );
      showToast(
        `${req.orderSubType === 'MARKET' ? 'Executed' : 'Placed'} ${req.side} ${
          req.lotSize
        }L ${req.symbol}`,
        req.side === 'LONG' ? 'up' : 'down'
      );
      if (res.breachedNow) {
        setIsPlaying(false);
        const breachedPhase =
          nextSession.frozenConfig?.propFirmRules?.challengePhase ||
          nextSession.propFirmRules?.challengePhase ||
          'PHASE_1';
        setChallengeAlertModal({
          status: 'FAILED',
          title:
            breachedPhase === 'PHASE_2'
              ? 'Phase 2 (Challenge 2) Failed — Would You Like to Redo?'
              : 'Phase 1 (Challenge 1) Failed — Would You Like to Redo?',
          explanation: res.breachedNow.explanation,
        });
      } else if (res.passedNow) {
        setIsPlaying(false);
        setChallengeAlertModal({
          status: 'PASSED',
          title: res.passedNow.advancedToPhase2
            ? 'Phase 1 Passed! Ready to Start Phase 2'
            : 'Congratulations! Prop Firm Challenge Passed!',
          explanation: res.passedNow.explanation,
          advancedToPhase2: res.passedNow.advancedToPhase2,
        });
      }
      return { ok: true };
    },
    [activeSession, showToast, isPresentTime, visibleCandles.length]
  );

  const handleModifyPositionOrOrder = useCallback(
    (
      positionId: string,
      updates: {
        stopLoss?: number;
        takeProfit?: number;
        entryPrice?: number;
        lotSize?: number;
        endTime?: number;
      }
    ): { ok: boolean; error?: string } => {
      const target = activeSession.positions?.find(p => p.id === positionId);
      const symForQuote = target?.symbol || activeSession.activeAsset;
      const quote = getSpotQuote(symForQuote);
      const executionSession = activeSession.marketMode === 'LIVE_PAPER' && quote ? {...activeSession,liveQuotes:{...activeSession.liveQuotes,[symForQuote]:quote}} : activeSession;
      const res = modifyPositionOrOrder(executionSession, positionId, {
        newStopLoss: updates.stopLoss,
        newTakeProfit: updates.takeProfit,
        newEntryPrice: updates.entryPrice,
        newLotSize: updates.lotSize,
        newEndTime: updates.endTime,
      });
      if (!res.ok) {
        showToast(res.error || 'Could not modify order.', 'down');
        return { ok: false, error: res.error };
      }
      setTradingSessions((prevList) =>
        prevList.map((s) => (s.id === activeSession.id ? res.session : s))
      );
      return { ok: true };
    },
    [activeSession, showToast]
  );

  const handleClosePosition = useCallback(
    (positionId: string, fraction: number = 1) => {
      const target = activeSession.positions?.find(p => p.id === positionId);
      const symForQuote = target?.symbol || activeSession.activeAsset;
      const quote = getSpotQuote(symForQuote);
      const executionSession = activeSession.marketMode === 'LIVE_PAPER' && quote ? {...activeSession,liveQuotes:{...activeSession.liveQuotes,[symForQuote]:quote}} : activeSession;
      const res = closeOrCancelPosition(executionSession, positionId, fraction);
      if (!res.ok) {
        showToast(res.error || 'Could not close position.', 'down');
        return;
      }
      setTradingSessions((prevList) =>
        prevList.map((s) => (s.id === activeSession.id ? res.session : s))
      );
      showToast(
        fraction < 1
          ? `Closed ${Math.round(fraction * 100)}% of position.`
          : 'Position / Order closed.',
        'info'
      );
      if (res.breachedNow) {
        setIsPlaying(false);
        const breachedPhase =
          res.session.frozenConfig?.propFirmRules?.challengePhase ||
          res.session.propFirmRules?.challengePhase ||
          'PHASE_1';
        setChallengeAlertModal({
          status: 'FAILED',
          title:
            breachedPhase === 'PHASE_2'
              ? 'Phase 2 (Challenge 2) Failed — Would You Like to Redo?'
              : 'Phase 1 (Challenge 1) Failed — Would You Like to Redo?',
          explanation: res.breachedNow.explanation,
        });
      } else if (res.passedNow) {
        setIsPlaying(false);
        setChallengeAlertModal({
          status: 'PASSED',
          title: res.passedNow.advancedToPhase2
            ? 'Phase 1 Passed! Ready to Start Phase 2'
            : 'Congratulations! Prop Firm Challenge Passed!',
          explanation: res.passedNow.explanation,
          advancedToPhase2: res.passedNow.advancedToPhase2,
        });
      }
    },
    [activeSession, showToast]
  );

  const handleMoveToBreakEven = useCallback(
    (positionId: string) => {
      const target = (activeSession.positions || []).find(
        (p) => p.id === positionId
      );
      if (!target || target.status !== 'OPEN') return;
      handleModifyPositionOrOrder(positionId, {
        stopLoss: target.entryPrice,
        takeProfit: target.takeProfit,
      });
      showToast(
        `Moved ${target.symbol} Stop Loss to Break-Even (${target.entryPrice})`,
        'info'
      );
    },
    [activeSession.positions, handleModifyPositionOrOrder, showToast]
  );

  const handleSaveJournalEntry = useCallback(
    (tradeId: string, entry: TradeJournalEntry, targetSessionId?: string) => {
      const sessId = targetSessionId || activeSession.id;
      setTradingSessions((prevList) =>
        prevList.map((s) => {
          if (s.id !== sessId) return s;
          const updatedPositions = (s.positions || []).map((p) =>
            p.id === tradeId
              ? {
                  ...p,
                  journalTags: entry.setupTags,
                  journalNotes: entry.notes,
                  journalRating: entry.rating,
                  journalEntryReasoning: entry.entryReasoning,
                  journalExitReasoning: entry.exitReasoning,
                  journalEmotionalState: entry.emotionalState,
                  journalLessonsLearned: entry.lessonsLearned,
                  journalChecklist: entry.checklist,
                  journalScreenshots: entry.screenshots,
                  journalUpdatedAt: entry.updatedAt,
                }
              : p
          );
          return {
            ...s,
            positions: updatedPositions,
            journals: {
              ...(s.journals || {}),
              [tradeId]: entry,
            },
            updatedAt: new Date().toISOString(),
          };
        })
      );
    },
    [activeSession.id]
  );

  const handleStartNewChallengeAttempt = useCallback(
    (targetSessionId?: string, targetPhase?: 'PHASE_1' | 'PHASE_2') => {
      const sessId = targetSessionId || activeSession.id;
      setTradingSessions((prevList) =>
        prevList.map((s) =>
          s.id === sessId ? startNewChallengeAttempt(s, targetPhase) : s
        )
      );
      setChallengeAlertModal(null);
      const phaseText =
        targetPhase === 'PHASE_2'
          ? 'Phase 2'
          : targetPhase === 'PHASE_1'
          ? 'Phase 1'
          : 'Challenge';
      showToast(
        `Started new ${phaseText} Attempt! Previous attempt results preserved.`,
        'up'
      );
    },
    [activeSession.id, showToast]
  );

  const lastCreatedSessionRef = useRef<{ id: string; signature: string; at: number } | null>(null);

  const handleCreateNewSession = useCallback(
    (newSession: TradingSession, openTerminalView: boolean) => {
      const now = Date.now();
      const signature = `${newSession.mode}:${newSession.activeAsset}:${newSession.startDate}:${newSession.endDate}:${newSession.replayStartTime}:${newSession.startingBalance}`;
      if (
        lastCreatedSessionRef.current &&
        (lastCreatedSessionRef.current.id === newSession.id ||
          (lastCreatedSessionRef.current.signature === signature &&
            now - lastCreatedSessionRef.current.at < 1500))
      ) {
        setIsCreateSessionModalOpen(false);
        if (openTerminalView) setActiveView('terminal');
        return;
      }
      lastCreatedSessionRef.current = { id: newSession.id, signature, at: now };
      setIsPlaying(false);
      replayStepBusy.current = false;
      resetChartIndicatorsOff();
      setTradingSessions((prev) => [
        newSession,
        ...prev.filter((s) => s.id !== newSession.id),
      ]);
      setActiveSessionId(newSession.id);
      setSymbol(newSession.activeAsset);
      const nextTf = newSession.activeTimeframe || '15m';
      setTimeframe(nextTf);
      setReplayStepTimeframe('5m');
      setViewportFocusVersion((v) => v + 1);
      setIsCreateSessionModalOpen(false);
      if (openTerminalView) {
        setActiveView('terminal');
      } else {
        setChartSponsorLoading(getCachedSponsorshipConfig().enabled);
      }
    },
    [resetChartIndicatorsOff]
  );

  const handleBranchSession = useCallback(() => {
    const branched = createPracticeBranchSession(activeSession);
    setTradingSessions((prev) => [branched, ...prev]);
    setActiveSessionId(branched.id);
    showToast(`Created Practice Branch: "${branched.name}"`, 'up');
  }, [activeSession, showToast]);

  const liveMetrics = useMemo(
    () => computeLiveSessionMetrics(activeSession),
    [activeSession]
  );

  const currentCandle = visibleCandles[visibleCandles.length - 1];
  const currentMidPrice =
    (isPresentTime ? getSpotQuote(symbol)?.price ?? activeSession.liveQuotes?.[symbol]?.price : undefined) || currentCandle?.close || getInstrumentConfig(symbol).basePrice;

  const sessionBoxes = useMemo(
    () =>
      computeSessionBoxes(
        visibleCandles,
        sessionsConfig,
        timeframe,
        getInstrumentConfig(symbol).decimals
      ),
    [visibleCandles, sessionsConfig, timeframe, symbol]
  );

  const allStrategyNames = useMemo(() => {
    const set = new Set<string>(strategies.map((s) => s.name));
    if (activeSession.strategyName) set.add(activeSession.strategyName);
    return Array.from(set);
  }, [strategies, activeSession.strategyName]);

  const handleToggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.().catch(() => {});
      setIsFullscreen(false);
    }
  }, []);

  const openLegal=(page:LegalDocumentKey)=>{window.history.pushState({},'',`/${page}`);setSitemapPage(false);setLegalPage(page);};
  const closeLegal=()=>{const target=currentUser?'/dashboard':'/';window.history.pushState({},'',target);setLegalPage(null);};
  const openSitemap=()=>{window.history.pushState({},'','/sitemap');setLegalPage(null);setSitemapPage(true);};
  const closeSitemap=()=>{const target=currentUser?'/dashboard':'/';window.history.pushState({},'',target);setSitemapPage(false);setActiveView(currentUser?'dashboard':'landing');};
  const navigateFromSitemap=(path:string)=>{
    setSitemapPage(false);
    setLegalPage(null);
    setPartnerPage(false);
    setComingSoon(false);
    setAdminPage(false);
    setInsightRoute({active:false,slug:null});
    if(path==='/partners'){
      window.history.pushState({},'','/partners');
      setPartnerPage(true);
      return;
    }
    if(path==='/traders-insight'||path.startsWith('/traders-insight/')){
      const slug=path.startsWith('/traders-insight/')?path.slice('/traders-insight/'.length):null;
      openTradersInsight(slug||null);
      return;
    }
    if(path==='/signup'){
      setLoginInitialMode('signup');
      setActiveView('login');
      return;
    }
    if(path==='/login'){
      setLoginInitialMode('login');
      setActiveView('login');
      return;
    }
    if(path==='/dashboard'){
      setHubInitialSection('dashboard');
      setActiveView('dashboard');
      return;
    }
    if(path==='/analytics'){
      setHubInitialSection('analytics');
      setActiveView('analytics_page');
      return;
    }
    if(path==='/chart'){
      setActiveView('terminal');
      return;
    }
    setActiveView('landing');
  };
  const signOut=()=>{clearAdminImpersonationState();setAdminImpersonation(null);purgeBrowserSensitiveStorage();setActiveLoggedInUser(null);setCurrentUser(null);setIsTourOpen(false);setIsPlaying(false);setActiveView('landing');};
  const handleAdminLoginAsUser=useCallback(async(targetUser:AdminUser,previewMode=false)=>{
    const res=await adminImpersonateUser({id:targetUser.id,email:targetUser.email,name:targetUser.name},previewMode);
    if(!res.ok||!res.user){
      throw new Error(res.error||'Only the signed-in administrator can log into a user account.');
    }
    markChartAnnouncementSeen(res.user.email);
    markWorkspaceTourSeen(res.user.email);
    markTourSeen('completed',res.user.email);
    setMotivationEnabled(res.user.email,false,false);
    setAdminImpersonation(res.impersonation||null);
    setCurrentUser({
      id:res.user.id,
      name:res.user.name,
      email:res.user.email,
      plan:res.user.plan||'FREE_FOREVER',
      joinedAt:res.user.joinedAt,
      loginCount:res.user.loginCount??1,
      isReturningLogin:true,
    });
    setAdminPage(false);
    setHubInitialSection('dashboard');
    setActiveView('dashboard');
    window.history.pushState({},'','/dashboard');
  },[]);
  const handleExitAdminImpersonation=useCallback(()=>{
    const wasPreview=adminImpersonation?.adminEmail==='Dashboard preview';
    clearAdminImpersonationState();
    setAdminImpersonation(null);
    setActiveLoggedInUser(null);
    setCurrentUser(null);
    setIsPlaying(false);
    const adminPath=wasPreview?'/admin?preview=1':'/admin';
    window.history.pushState({},'',adminPath);
    setAdminPage(true);
  },[adminImpersonation?.adminEmail]);
  const closeFeedbackPage=()=>{
    setFeedbackRoute({active:false,name:null,email:null});
    const target=currentUser?'/dashboard':'/';
    window.history.pushState({},'',target);
    setActiveView(currentUser?'dashboard':'landing');
  };
  const openComingSoon=()=>{window.history.pushState({},'','/coming-soon');setComingSoon(true);};
  const closeComingSoon=()=>{window.history.pushState({},'',currentUser?'/dashboard':'/');setComingSoon(false);setActiveView(currentUser?'dashboard':'landing');};
  const openTradersInsight=(slug:string|null=null)=>{
    const path=slug?`/traders-insight/${slug}`:'/traders-insight';
    window.history.pushState({},'',path);
    setInsightRoute({active:true,slug});
  };
  const closeTradersInsight=()=>{
    window.history.pushState({},'',currentUser?'/dashboard':'/');
    setInsightRoute({active:false,slug:null});
    setActiveView(currentUser?'dashboard':'landing');
  };

  useEffect(() => {
    if (
      legalPage ||
      sitemapPage ||
      insightRoute.active ||
      partnerPage ||
      adminPage ||
      comingSoon ||
      feedbackRoute.active
    ) {
      return;
    }
    let targetPath = '/';
    if (activeView === 'landing') {
      targetPath = '/';
    } else if (activeView === 'login' || !currentUser) {
      if (urlResetParams.token || loginInitialMode === 'reset') {
        targetPath = '/reset-password';
      } else if (loginInitialMode === 'signup') {
        targetPath = '/signup';
      } else {
        targetPath = '/login';
      }
    } else if (activeView === 'analytics_page') {
      targetPath = '/analytics';
    } else if (activeView === 'dashboard') {
      targetPath = hubInitialSection === 'analytics' ? '/analytics' : '/dashboard';
    } else if (activeView === 'terminal') {
      targetPath = '/chart';
    }

    try {
      const currentPath =
        window.location.pathname.replace(/\/+$/, '') || '/';
      if (currentPath !== targetPath) {
        const search =
          targetPath === '/reset-password' ? window.location.search : '';
        window.history.pushState({}, '', `${targetPath}${search}`);
      }
    } catch {
      // ignore
    }

    if (activeView === 'terminal' && currentUser) {
      applyPageSeo({
        title: `${symbol} (${timeframe}) – Historical Bar Replay Chart | Chart Replay`,
        description: `Interactive ${symbol} (${timeframe}) historical candlestick bar replay and prop firm simulator workspace on Chart Replay.`,
        path: '/chart',
        type: 'website',
      });
    }
  }, [
    activeView,
    currentUser,
    loginInitialMode,
    hubInitialSection,
    urlResetParams.token,
    legalPage,
    sitemapPage,
    insightRoute.active,
    partnerPage,
    adminPage,
    comingSoon,
    feedbackRoute.active,
    symbol,
    timeframe,
  ]);

  if(legalPage)return <LegalPage page={legalPage} onNavigate={openLegal} onOpenSitemap={openSitemap} onBack={closeLegal}/>;
  if(sitemapPage)return <SitemapPage onBack={closeSitemap} onNavigateRoute={navigateFromSitemap} onOpenLegal={openLegal}/>;
  if(feedbackRoute.active)return (
    <PlatformFeedbackPage
      initialName={feedbackRoute.name||currentUser?.name||null}
      initialEmail={feedbackRoute.email||currentUser?.email||null}
      userId={currentUser?.id||null}
      onBack={closeFeedbackPage}
    />
  );

  if(insightRoute.active)return (
    <TradersInsightPage
      activeSlug={insightRoute.slug}
      onSelectArticle={(slug)=>openTradersInsight(slug)}
      onBackToHome={closeTradersInsight}
      onOpenLegal={openLegal}
      onOpenSitemap={openSitemap}
      onLaunchSimulator={(action)=>{
        window.history.pushState({},'','/');
        setInsightRoute({active:false,slug:null});
        if(action==='prop_firm'){
          setCreateSessionModalMode('PROP_FIRM');
          setIsCreateSessionModalOpen(true);
          setActiveView('terminal');
          return;
        }
        if(action==='new_backtest'){
          setCreateSessionModalMode('BACKTESTING');
          setIsCreateSessionModalOpen(true);
          setActiveView('terminal');
          return;
        }
        if(action==='analytics'){
          setHubInitialSection('analytics');
          setActiveView('analytics_page');
          return;
        }
        setActiveView('terminal');
      }}
    />
  );
  if(partnerPage)return <PartnerPage onBack={()=>{window.history.pushState({},'','/');setPartnerPage(false);setActiveView('landing');}} onOpenLegal={openLegal} onOpenSitemap={openSitemap}/>;
  if(adminPage)return <AdminDashboard onBack={()=>{window.history.pushState({},'','/');setAdminPage(false);setActiveView('landing');}} onLoginAsUser={handleAdminLoginAsUser}/>;
  if(comingSoon)return <ComingSoonPage onBack={closeComingSoon} onOpenLegal={openLegal} onOpenSitemap={openSitemap}/>;

  // VIEW 1: LANDING PAGE (HOMEPAGE)
  if (activeView === 'landing') {
    return (
      <LandingPage onOpenComingSoon={openComingSoon} onOpenTradersInsight={openTradersInsight} onOpenLegal={openLegal} onOpenSitemap={openSitemap}
        onLaunchTerminal={(action) => {
          if (action === 'prop_firm') {
            setCreateSessionModalMode('PROP_FIRM');
            setIsCreateSessionModalOpen(true);
            setActiveView('terminal');
            return;
          }
          if (action === 'new_backtest') {
            setCreateSessionModalMode('BACKTESTING');
            setIsCreateSessionModalOpen(true);
            setActiveView('terminal');
            return;
          }
          if (action === 'analytics') {
            setHubInitialSection('analytics');
            setActiveView('analytics_page');
            return;
          }
          if (action === 'dashboard') {
            setHubInitialSection('dashboard');
            setActiveView('dashboard');
            return;
          }
          setActiveView('terminal');
        }}
        onOpenLogin={(mode) => {
          setLoginInitialMode(mode || 'login');
          setActiveView('login');
        }}
        currentUser={currentUser}
      />
    );
  }

  // VIEW 2: LOGIN / REGISTRATION / PASSWORD RESET
  if (activeView === 'login' || !currentUser) {
    return (
      <LoginPage
        initialMode={urlResetParams.token ? 'reset' : loginInitialMode}
        onModeChange={(nextMode) => setLoginInitialMode(nextMode)}
        initialResetToken={urlResetParams.token}
        initialEmail={urlResetParams.email}
        onClearResetToken={clearUrlResetParams}
        onSuccessAuth={(user: ChartFlowUser) => {
          if (user.isReturningLogin || (user.loginCount ?? 1) > 1) {
            markChartAnnouncementSeen(user.email);
            markWorkspaceTourSeen(user.email);
            markTourSeen('completed', user.email);
          }
          resetMotivationVisit(user.email, user.isReturningLogin ?? true);
          resetChartIndicatorsOff();
          const existingSaved = getActiveLoggedInUser();
          if (
            !existingSaved ||
            existingSaved.email.toLowerCase() !== user.email.toLowerCase()
          ) {
            setActiveLoggedInUser({
              id: user.id || `user-${Date.now()}`,
              name: user.name,
              email: user.email,
              passwordHash: '',
              plan: user.plan || 'FREE_FOREVER',
              joinedAt: user.joinedAt || new Date().toISOString(),
              loginCount: user.loginCount ?? 1,
            });
          }
          setCurrentUser(user);
          purgeBrowserSensitiveStorage();
          setActiveView('dashboard');
        }}
        onLogout={() => {
          purgeBrowserSensitiveStorage();
          setActiveLoggedInUser(null);
          setCurrentUser(null);
          setActiveView('landing');
        }}
        currentUser={currentUser}
        onBackToLanding={() => setActiveView('landing')}
        onSkipToTerminal={() => setActiveView('dashboard')}
        onOpenLegal={openLegal}
      />
    );
  }

  const adminImpersonationBanner =
    adminImpersonation &&
    currentUser &&
    adminImpersonation.userEmail.toLowerCase() ===
      currentUser.email.toLowerCase() ? (
      <div
        role="region"
        aria-label="Administrator account inspection mode"
        className="z-50 flex flex-wrap items-center justify-between gap-2 border-b border-cyan-400/35 bg-gradient-to-r from-[#071a26] via-[#0c2636] to-[#071a26] px-4 py-2 text-xs text-cyan-100 shadow-lg"
      >
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-cyan-400/20 border border-cyan-400/40 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-cyan-200">
            <ShieldCheck size={12} />
            Admin Inspection Mode
          </span>
          <span>
            Logged into user account:{' '}
            <strong className="text-white">{currentUser.name}</strong> (
            <span className="text-cyan-300">{currentUser.email}</span>) ·{' '}
            <span className="text-emerald-300">
              {tradingSessions.length}{' '}
              {tradingSessions.length === 1 ? 'session' : 'sessions'}
            </span>
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setHubInitialSection('dashboard');
              setActiveView('dashboard');
            }}
            className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition ${
              activeView === 'dashboard' && hubInitialSection === 'dashboard'
                ? 'bg-cyan-400/25 text-white'
                : 'bg-white/5 text-slate-300 hover:bg-white/10'
            }`}
          >
            User Dashboard
          </button>
          <button
            type="button"
            onClick={() => {
              setHubInitialSection('analytics');
              setActiveView('analytics_page');
            }}
            className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition ${
              activeView === 'analytics_page'
                ? 'bg-cyan-400/25 text-white'
                : 'bg-white/5 text-slate-300 hover:bg-white/10'
            }`}
          >
            Analytics
          </button>
          <button
            type="button"
            onClick={() => setActiveView('terminal')}
            className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition ${
              activeView === 'terminal'
                ? 'bg-cyan-400/25 text-white'
                : 'bg-white/5 text-slate-300 hover:bg-white/10'
            }`}
          >
            Chart Workspace
          </button>
          <button
            type="button"
            onClick={handleExitAdminImpersonation}
            className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-emerald-400 to-cyan-400 px-3 py-1 text-[11px] font-extrabold text-slate-950 hover:brightness-110 transition"
          >
            ← Return to Admin Backend
          </button>
        </div>
      </div>
    ) : null;

  // VIEW 3: ACCOUNT DASHBOARD, SESSIONS, ANALYTICS, STRATEGIES & SETTINGS HUB
  if (activeView === 'dashboard' || activeView === 'analytics_page') {
    return (
      <>
        {adminImpersonationBanner}
        <AnalyticsDashboardPage
          activeSession={activeSession}
          sessions={tradingSessions}
          onSelectSessionAndResume={(sessId) => {
            setActiveSessionId(sessId);
            setActiveView('terminal');
          }}
          onSelectSessionForAnalytics={(sessId) => {
            setActiveSessionId(sessId);
            setHubInitialSection('analytics');
            setActiveView('analytics_page');
          }}
          onDeleteSession={handleDeleteSession}
          onUpdateSessionSettings={(sessId, updates) => {
            setTradingSessions((prev) =>
              prev.map((s) => {
                if (s.id !== sessId) return s;
                const converted = updates.accountCurrency
                  ? convertSessionAccountCurrency(s, updates.accountCurrency)
                  : s;
                return {
                  ...converted,
                  name: updates.name ?? converted.name,
                  strategyName: updates.strategy ?? converted.strategyName,
                  description: updates.description ?? converted.description,
                  updatedAt: new Date().toISOString(),
                };
              })
            );
          }}
          onStartNewChallengeAttempt={(sessId, targetPhase) =>
            handleStartNewChallengeAttempt(sessId, targetPhase)
          }
          isSessionSetupOpen={isCreateSessionModalOpen}
          onCloseSessionSetup={()=>setIsCreateSessionModalOpen(false)}
          onOpenCreateSessionModal={(mode) => {
            setCreateSessionModalMode(mode || 'BACKTESTING');
            setIsCreateSessionModalOpen(true);
          }}
          onSaveJournalEntry={(sessId, tradeId, entry) =>
            handleSaveJournalEntry(tradeId, entry, sessId)
          }
          strategies={strategies}
          onSaveStrategies={(nextStrategies) => {
            setStrategies(nextStrategies);
            saveUserStrategies(currentUser.email, nextStrategies);
          }}
          customRuleProfiles={customRuleProfiles}
          currentUser={currentUser}
          onDeleteUser={(emailToDelete) => {
            deleteUserAccount(emailToDelete);
            setActiveLoggedInUser(null);
            setCurrentUser(null);
            setActiveView('login');
            showToast('This browser’s account and practice data were deleted. For server registration records, contact info@chartreplay.co.za.', 'info');
          }}
          onLogout={signOut}
          theme={theme}
          onToggleTheme={() =>
            setTheme((t) => (t === 'light' ? 'dark' : 'light'))
          }
          initialSection={
            activeView === 'analytics_page' ? 'analytics' : hubInitialSection
          }
          onSectionChange={(nextSection) => {
            setHubInitialSection(nextSection);
            if (nextSection === 'analytics') {
              setActiveView('analytics_page');
            } else if (activeView === 'analytics_page') {
              setActiveView('dashboard');
            }
          }}
          onReturnToChart={() => {
            if (tradingSessions.length === 0) {
              setCreateSessionModalMode('BACKTESTING');
              setIsCreateSessionModalOpen(true);
              return;
            }
            setActiveView('terminal');
          }}
          onOpenLanding={() => setActiveView('landing')}
          onOpenTradersInsight={() => openTradersInsight()}
        />

        <CreateSessionModal
          isOpen={isCreateSessionModalOpen}
          initialMode={createSessionModalMode}
          onClose={() => setIsCreateSessionModalOpen(false)}
          sessions={tradingSessions}
          activeSessionId={activeSession.id}
          theme={theme}
          onCreateSession={(newSession) => handleCreateNewSession(newSession, true)}
          onSelectSession={(sessId) => {
            setIsPlaying(false);
            setActiveSessionId(sessId);
            setViewportFocusVersion((v) => v + 1);
            setIsCreateSessionModalOpen(false);
            setActiveView('terminal');
          }}
          onDeleteSession={handleDeleteSession}
          savedStrategies={allStrategyNames}
          onAddStrategy={(newStratName: string) => {
            if (!allStrategyNames.includes(newStratName)) {
              const next: StrategyRecord[] = [
                ...strategies,
                {
                  id: `strat-${Date.now()}`,
                  name: newStratName,
                  description: 'Created during session setup',
                  defaultChecklist: ['HTF aligned', 'Risk within plan'],
                  setupTags: ['Standard'],
                  createdAt: new Date().toISOString().slice(0, 10),
                },
              ];
              setStrategies(next);
              saveUserStrategies(currentUser.email, next);
            }
          }}
          customRuleProfiles={customRuleProfiles}
          onSaveCustomRuleProfile={(profile) => {
            const next = [...customRuleProfiles, profile];
            setCustomRuleProfiles(next);
            saveUserCustomRuleProfiles(currentUser.email, next);
          }}
        />

        <MotivationWelcome
          userKey={currentUser.email}
          name={currentUser.name}
          eligible={!isCreateSessionModalOpen && !isTourOpen && !challengeAlertModal && !chartSponsorLoading}
          chartStatus="Your workspace is ready"
          loading={false}
          isLight={theme === 'light'}
          onOpen={() => { setMotivationOpen(true); setIsPlaying(false); }}
          onDismiss={() => setMotivationOpen(false)}
        />
      </>
    );
  }

  // VIEW 4: TRADING CHART WORKSPACE ('terminal')
  const firstClose = visibleCandles[0]?.close || currentMidPrice;
  const dailyChange = currentMidPrice - firstClose;
  const dailyChangePct = firstClose > 0 ? (dailyChange / firstClose) * 100 : 0;

  return (
    <div
      className={`h-[100dvh] w-full max-w-full flex flex-col overflow-hidden select-none ${
        theme === 'light'
          ? 'bg-[#f8f9fd] text-[#131722]'
          : 'bg-[#0d0f13] text-[#d1d4dc]'
      }`}
    >
      {adminImpersonationBanner}
      {/* Top Toolbar */}
      <TopNavigation
        symbol={symbol}
        onSelectSymbol={handleSelectSymbol}
        timeframe={timeframe}
        onSelectTimeframe={handleSelectTimeframe}
        currentPrice={visibleCandles.length ? currentMidPrice : NaN}
        dailyChange={dailyChange}
        dailyChangePct={dailyChangePct}
        high24h={currentCandle?.high || currentMidPrice}
        low24h={currentCandle?.low || currentMidPrice}
        dataSource={
          hasRealMarketDataForSymbol(symbol, timeframe)
            ? 'LIVE_SPOT_FEED'
            : 'SYNTHETIC_FALLBACK'
        }
        isLoading={isMarketDataLoading}
        onRefreshData={() => {
          setIsMarketDataLoading(true);
          refreshMarketCandles(symbol, timeframe).then((loaded) => {
            setIsMarketDataLoading(false);
            setMarketDataVersion((v) => v + 1);
            showToast(
              loaded ? `Market data refreshed for ${symbol} (${timeframe}).` : `Provider unavailable; retaining the last received bars for ${symbol}.`,
              'info'
            );
          });
        }}
        isReplayMode={!isPresentTime}
        onToggleReplayCutTool={() => {
          if (activeSession.mode === 'PROP_FIRM') {
            showToast(
              'Rewind / Cut tool is disabled in Prop Firm Challenge mode.',
              'down'
            );
            return;
          }
          setActiveTool((t) => (t === 'replay_cut' ? 'cursor' : 'replay_cut'));
        }}
        isReplayCutActive={activeTool === 'replay_cut'}
        showRightWidget={showRightWidget}
        onToggleRightWidget={handleToggleRightWidget}
        isChartWideMode={isChartWideMode}
        onToggleChartWideMode={() => setIsChartWideMode((v) => !v)}
        sessions={sessionsConfig}
        onToggleSessionEnabled={(id: SessionId) =>
          setSessionsConfig((prev) =>
            prev.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s))
          )
        }
        currentTimestamp={authoritativeClockTs}
        candleRemainingText={isPresentTime ? 'CURRENT MARKET' : 'REPLAY'}
        isFullscreen={isFullscreen}
        onToggleFullscreen={handleToggleFullscreen}
        theme={theme}
        onToggleTheme={() =>
          setTheme((t) => (t === 'light' ? 'dark' : 'light'))
        }
        candleStyle={candleStyle}
        onSelectCandleStyle={setCandleStyle}
        customCandleColors={customCandleColors}
        onChangeCustomCandleColors={setCustomCandleColors}
        onOpenLanding={() => setActiveView('landing')}
        onOpenLogin={() => setActiveView('login')}
        currentUser={currentUser}
        activeSession={activeSession}
        balanceHidden={balanceHidden}
        onToggleBalance={toggleBalance}
        onChangeTimezone={timezone=>updateActiveSession(session=>({...session,displayTimezone:timezone}))}
        onChangeCurrency={nextCurrency=>updateActiveSession(session=>convertSessionAccountCurrency(session,nextCurrency))}
        onLogout={signOut}
        liveBalance={liveMetrics.currentBalance}
        liveEquity={liveMetrics.currentEquity}
        onOpenCreateSession={() => setIsCreateSessionModalOpen(true)}
        onOpenAnalyticsPage={() => {
          setHubInitialSection('analytics');
          setActiveView('analytics_page');
        }}
        onOpenDashboard={() => {
          setHubInitialSection('dashboard');
          setActiveView('dashboard');
        }}
        onOpenGuide={() => {
          setHubInitialSection('guide');
          setActiveView('dashboard');
        }}
        onOpenSettings={() => {
          setHubInitialSection('settings');
          setActiveView('dashboard');
        }}
        onOpenMindset={()=>setMindsetOpen(true)}
        onOpenPlan={()=>setPlanToggleCount(c=>c+1)}
        isPlanPinned={isPlanPinned}
        indicators={chartIndicators}
        onToggleIndicator={handleToggleIndicator}
        indicatorConfigs={indicatorConfigs}
        onUpdateIndicatorConfigs={handleUpdateIndicatorConfigs}
        onOpenIndicatorSettings={setActiveIndicatorSettingsId}
        onTakeScreenshot={() => takeScreenshotRef.current?.()}
        onStartTour={handleStartTour}
      />

      <TradingMindset key={`${currentUser?.email || "guest"}:${activeSession.id}`} session={activeSession} userKey={currentUser?.email || "guest"} displayName={currentUser?.name} onOpen={()=>setMindsetOpen(true)} open={mindsetOpen} onClose={()=>setMindsetOpen(false)} rightPanelOpen={!isChartWideMode && !isMobile && showRightWidget} welcomeBlocking={motivationOpen || isCreateSessionModalOpen || isTourOpen || chartSponsorLoading} planToggleCount={planToggleCount} onPlanPinnedChange={setIsPlanPinned} onUpdatePlanNote={(nextNote)=>{if(currentUser?.email&&nextNote.text&&!nextNote.text.startsWith('MY TRADING PLAN\n\n• Wait for my setup.')&&!nextNote.text.startsWith('MY TRADING PLAN\n\nYou can write your trading plan here')&&!loadUserStrategyNotes(currentUser.email).text)saveUserStrategyNotes(currentUser.email,nextNote.text);updateActiveSession(s=>{if(JSON.stringify(s.mindsetNote)===JSON.stringify(nextNote))return s;return {...s,mindsetNote:nextNote,updatedAt:new Date().toISOString()};});}}/>

      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`fixed top-14 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl border shadow-2xl text-xs font-bold flex items-center gap-2 max-w-lg ${
            theme === 'light'
              ? 'bg-white border-emerald-500/50 text-[#131722]'
              : 'bg-[#161920] border-[#2e333d] text-white'
          }`}
        >
          <span
            className={`w-2 h-2 rounded-full shrink-0 ${
              toastMessage.tone === 'up'
                ? 'bg-emerald-500'
                : toastMessage.tone === 'down'
                ? 'bg-rose-500'
                : 'bg-blue-500'
            }`}
          />
          <span className="truncate">{toastMessage.text}</span>
        </div>
      )}

      {/* Centre Workspace */}
      <div className="flex-1 flex min-h-0 overflow-hidden relative">
        {!isChartWideMode && (!isMobile || showMobileTools) && (
          <div className={isMobile ? 'fixed left-0 top-11 z-40 shadow-2xl overflow-visible' : 'contents'}>
          <LeftToolbar
            activeTool={activeTool}
            onSelectTool={(t) => {
              setActiveTool(t);
              if (isMobile) setShowMobileTools(false);
            }}
            drawingColor={drawingColor}
            onSelectDrawingColor={setDrawingColor}
            drawingLineWidth={drawingLineWidth}
            onSelectDrawingLineWidth={setDrawingLineWidth}
            drawingLineStyle={drawingLineStyle}
            onSelectDrawingLineStyle={setDrawingLineStyle}
            onUndoDrawing={() => {
              updateActiveSession((s) => ({
                ...s,
                drawingsBySymbol: {
                  ...(s.drawingsBySymbol || {}),
                  [symbol]: ((s.drawingsBySymbol || {})[symbol] || []).slice(
                    0,
                    -1
                  ),
                },
                updatedAt: new Date().toISOString(),
              }));
            }}
            onClearDrawings={handleClearDrawings}
            drawingsCount={currentSymbolDrawings.length}
            isFullscreen={isFullscreen}
            onToggleFullscreen={handleToggleFullscreen}
            showSessionBoxes={showSessionBoxes}
            onToggleSessionBoxes={() => setShowSessionBoxes((v) => !v)}
            showSRLevels={showSRLevels}
            onToggleSRLevels={() => setShowSRLevels((v) => !v)}
            stayInDrawingMode={stayInDrawingMode}
            onToggleStayInDrawingMode={() => setStayInDrawingMode((v) => !v)}
            lockDrawings={lockDrawings}
            onToggleLockDrawings={() => setLockDrawings((v) => !v)}
            hideDrawings={hideDrawings}
            onToggleHideDrawings={() => setHideDrawings((v) => !v)}
            magnetMode={magnetMode}
            onToggleMagnetMode={() => setMagnetMode((v) => !v)}
            theme={theme}
          />
          </div>
        )}

        {/* Interactive Candlestick Chart Area */}
        <div className="flex-1 flex min-w-0 min-h-0 relative">
          <div className="flex-1 min-w-0 min-h-0 flex" data-tour="chart-area">
            <TradingChart
              accountCurrency={activeSession.accountCurrency}
              reactionScope={activeSession.id}
              reactionSession={activeSession}
              onLoadOlderHistory={loadOlderChartHistory}
              symbol={symbol}
              marketPrice={isPresentTime ? currentMidPrice : undefined}
              onGoToPresent={handleGoToPresent}
              onReturnToReplay={handleReturnToReplay}
              feedLabel={getMarketFeedLabel(symbol, timeframe, !isPresentTime)}
              feedStatus={isPresentTime && (SPOT_SYMBOLS.has(symbol) || getSpotQuote(symbol)?.source.startsWith('Capital.com')) ? getSpotFeedStatus(symbol, presentClockTs) : undefined}
              dataMessage={isMarketDataLoading ? undefined : historicalAvailability?.message || (!visibleCandles.length ? (isQuoteOnlyChart(symbol, timeframe) ? 'This feed supplies quote-only bars here; genuine candle OHLC is unavailable. Try the five-minute chart.' : 'No provider history for this date and timeframe. Select Present Time or choose a date within the available history.') : undefined)}
              onGoToNextAvailableBar={historicalAvailability?.nextTime && (!activeSession.endTimestamp || historicalAvailability.nextTime <= activeSession.endTimestamp) ? () => { setIsPlaying(false); handleAdvanceOrRewindToTimestamp(historicalAvailability.nextTime!); } : undefined}
              candles={visibleCandles}
              totalCandlesCount={visibleCandles.length}
              timeframe={timeframe}
              sessions={sessionsConfig}
              showSessionBoxes={showSessionBoxes}
              onToggleSessionBoxes={() => setShowSessionBoxes((v) => !v)}
              showSRLevels={showSRLevels}
              onToggleSRLevels={() => setShowSRLevels((v) => !v)}
              keySupport={[]}
              keyResistance={[]}
              positions={(activeSession.positions || []).filter(
                (p) => (p.symbol || activeSession.activeAsset) === symbol
              )}
              onUpdatePositionSLTP={(
                id,
                newSL,
                newTP,
                newEntryPrice,
                newEndTime
              ) => {
                handleModifyPositionOrOrder(id, {
                  stopLoss: newSL,
                  takeProfit: newTP,
                  entryPrice: newEntryPrice,
                  endTime: newEndTime,
                });
              }}
              onTogglePositionBox={(id,hidden)=>updateActiveSession(session=>({...session,positions:(session.positions||[]).map(position=>position.id===id?{...position,hideOnChart:hidden}:position)}))}
              onClosePosition={(id) => handleClosePosition(id, 1)}
              onQuickBuySell={(side) => {
                const spec = getEffectiveInstrumentSpec(symbol, activeSession);
                const dist = Math.max(spec.pipSize * 20, atr14 * 1.5);
                const sl =
                  side === 'LONG'
                    ? Number((currentMidPrice - dist).toFixed(spec.decimals))
                    : Number((currentMidPrice + dist).toFixed(spec.decimals));
                const tp =
                  side === 'LONG'
                    ? Number((currentMidPrice + dist * 2).toFixed(spec.decimals))
                    : Number((currentMidPrice - dist * 2).toFixed(spec.decimals));
                handleExecuteOrder({
                  symbol,
                  side,
                  orderSubType: 'MARKET',
                  lotSize: 1.0,
                  stopLoss: sl,
                  takeProfit: tp,
                });
              }}
              onPlaceOrderFromDrawing={(drawing, orderType) => {
                const isLong = drawing.type === 'long_position';
                const side = isLong ? 'LONG' : 'SHORT';
                const spec = getEffectiveInstrumentSpec(symbol, activeSession);
                const { bid, ask } = getBidAskFromMid(
                  currentMidPrice,
                  symbol,
                  activeSession
                );
                let entry = Number(drawing.price1.toFixed(spec.decimals));
                const rawSl = Number(
                  (drawing.stopLoss ?? entry).toFixed(spec.decimals)
                );
                const rawTp = Number(
                  (drawing.takeProfit ?? entry).toFixed(spec.decimals)
                );
                const slDist = Math.max(
                  spec.minMove * 10,
                  Math.abs(entry - rawSl)
                );
                const tpDist = Math.max(
                  spec.minMove * 15,
                  Math.abs(rawTp - entry)
                );

                if (orderType === 'MARKET') {
                  const mktEntry = isLong ? ask : bid;
                  const slValid = isLong
                    ? rawSl > 0 && rawSl < mktEntry
                    : rawSl > mktEntry;
                  const tpValid = isLong
                    ? rawTp > mktEntry
                    : rawTp > 0 && rawTp < mktEntry;
                  const sl = slValid
                    ? rawSl
                    : Number(
                        (isLong ? mktEntry - slDist : mktEntry + slDist).toFixed(
                          spec.decimals
                        )
                      );
                  const tp = tpValid
                    ? rawTp
                    : Number(
                        (isLong ? mktEntry + tpDist : mktEntry - tpDist).toFixed(
                          spec.decimals
                        )
                      );
                  handleExecuteOrder({
                    symbol,
                    side,
                    orderSubType: 'MARKET',
                    lotSize: drawing.lotSize ?? 1.0,
                    stopLoss: sl,
                    takeProfit: tp,
                    endTime: drawing.time2,
                  });
                  return;
                }

                if (isLong && Math.abs(entry - ask) < spec.minMove) {
                  entry = Number((ask - spec.minMove * 2).toFixed(spec.decimals));
                } else if (!isLong && Math.abs(entry - bid) < spec.minMove) {
                  entry = Number((bid + spec.minMove * 2).toFixed(spec.decimals));
                }

                const subType = isLong
                  ? entry < ask
                    ? 'BUY_LIMIT'
                    : 'BUY_STOP'
                  : entry > bid
                  ? 'SELL_LIMIT'
                  : 'SELL_STOP';

                const sl =
                  isLong && rawSl < entry
                    ? rawSl
                    : !isLong && rawSl > entry
                    ? rawSl
                    : Number(
                        (isLong ? entry - slDist : entry + slDist).toFixed(
                          spec.decimals
                        )
                      );
                const tp =
                  isLong && rawTp > entry
                    ? rawTp
                    : !isLong && rawTp > 0 && rawTp < entry
                    ? rawTp
                    : Number(
                        (isLong ? entry + tpDist : entry - tpDist).toFixed(
                          spec.decimals
                        )
                      );

                handleExecuteOrder({
                  symbol,
                  side,
                  orderSubType: subType,
                  lotSize: drawing.lotSize ?? 1.0,
                  entryPrice: entry,
                  stopLoss: sl,
                  takeProfit: tp,
                  endTime: drawing.time2,
                });
              }}
              activeTool={activeTool}
              onSelectTool={setActiveTool}
              drawingColor={drawingColor}
              onSelectDrawingColor={setDrawingColor}
              drawingLineWidth={drawingLineWidth}
              onSelectDrawingLineWidth={setDrawingLineWidth}
              drawingLineStyle={drawingLineStyle}
              onSelectDrawingLineStyle={setDrawingLineStyle}
              onSelectReplayTimestamp={(_idx, clickedTimestamp) => {
                handleAdvanceOrRewindToTimestamp(clickedTimestamp);
                setActiveTool('cursor');
              }}
              isReplayMode={!isPresentTime}
              replayIndex={Math.max(0, visibleCandles.length - 1)}
              drawings={currentSymbolDrawings}
              onAddDrawing={handleAddDrawing}
              onUpdateDrawing={handleUpdateDrawing}
              onDeleteDrawing={handleDeleteDrawing}
              onClearDrawings={handleClearDrawings}
              focusedSessionTime={focusedSessionTime}
              candleRemainingText={isPresentTime ? 'CURRENT MARKET' : 'REPLAY'}
              isChartFullscreen={isChartWideMode}
              onToggleChartFullscreen={() => setIsChartWideMode((v) => !v)}
              theme={theme}
              replayAnimationMs={isPlaying&&!isPresentTime?Math.min(450,playbackSpeedMs*0.8):0}
              displayTimezone={activeSession.displayTimezone||'Africa/Johannesburg'}
              indicators={chartIndicators}
              onToggleIndicator={handleToggleIndicator}
              indicatorConfigs={indicatorConfigs}
              onUpdateIndicatorConfigs={handleUpdateIndicatorConfigs}
              activeIndicatorSettingsId={activeIndicatorSettingsId}
              onChangeActiveIndicatorSettingsId={setActiveIndicatorSettingsId}
              onTakeScreenshotRef={takeScreenshotRef}
              candleStyle={candleStyle}
              onSelectCandleStyle={setCandleStyle}
              customCandleColors={customCandleColors}
              onChangeCustomCandleColors={setCustomCandleColors}
              stayInDrawingMode={stayInDrawingMode}
              lockDrawings={lockDrawings}
              hideDrawings={hideDrawings}
              magnetMode={magnetMode}
              atr14={atr14}
              viewportFocusVersion={viewportFocusVersion}
              mobileTradeControls={isMobile && !showRightWidget ? (<div role="toolbar" aria-label="Mobile trading actions" className="flex flex-col items-center gap-2">
            <button
              onClick={() => setShowMobileTools((v) => !v)}
              className={`w-12 h-12 shrink-0 rounded-full text-white text-[10px] font-bold shadow-lg transition ${
                showMobileTools ? 'bg-amber-500 text-slate-950 ring-2 ring-white' : 'bg-[#2962ff]'
              }`}
            >
              Tools
            </button>
            {(['LONG', 'SHORT'] as const).map((side) => (
              <button
                key={side}
                onClick={() => {
                  const spec = getEffectiveInstrumentSpec(symbol, activeSession);
                  const dist = Math.max(spec.pipSize * 20, atr14 * 1.5);
                  const entry = Number(currentMidPrice.toFixed(spec.decimals));
                  const isLong = side === 'LONG';
                  const sl = Number((isLong ? entry - dist : entry + dist).toFixed(spec.decimals));
                  const tp = Number((isLong ? entry + dist * 2 : entry - dist * 2).toFixed(spec.decimals));
                  setActiveTool('cursor');
                  setShowMobileTools(false);
                  handleAddOrUpdatePositionDrawingFromTicket(side, entry, sl, tp, 1.0);
                  showToast(
                    `${isLong ? 'BUY' : 'SELL'} position tool added — drag to adjust, then tap Place Order`,
                    isLong ? 'up' : 'down'
                  );
                }}
                className={`w-12 h-12 shrink-0 rounded-full text-white text-[11px] font-extrabold shadow-lg flex items-center justify-center active:scale-95 transition ${
                  side === 'LONG' ? 'bg-emerald-600' : 'bg-rose-600'
                }`}
              >
                {side === 'LONG' ? 'BUY' : 'SELL'}
              </button>
            ))}
            <button
              onClick={() => setShowRightWidget(true)}
              className="w-12 h-12 shrink-0 rounded-full bg-[#161920] border-2 border-emerald-500/70 text-white text-[9px] font-extrabold leading-tight shadow-lg flex flex-col items-center justify-center active:scale-95 transition"
            >
              <span>Place</span><span>Order</span>
            </button>
          </div>) : undefined}
              mobileAccountSummary={isMobile?<BalanceBadge balance={liveMetrics.currentBalance} equity={liveMetrics.currentEquity} currency={activeSession.accountCurrency||'USD'} hidden={balanceHidden} onToggle={toggleBalance} onChangeCurrency={nextCurrency=>updateActiveSession(session=>convertSessionAccountCurrency(session,nextCurrency))} isLight={theme==='light'} className="inline-flex"/>:undefined}

            />
          </div>

          {activeSession.chartLayout === 'SPLIT_2' && (
            <div className="flex-1 min-w-0 min-h-0 border-l border-[#24272f] flex flex-col">
              <div className="h-7 px-2 border-b border-[#24272f] flex items-center justify-between text-[10px] font-mono bg-[#13151a]">
                <span className="font-bold text-emerald-400">
                  HTF Sync Chart ({symbol} · {secondaryTimeframe})
                </span>
                <div className="flex items-center gap-1">
                  {(['15m', '1H', '4H', '1D', '1W', '1M'] as Timeframe[]).map((tf) => (
                    <button
                      key={tf}
                      onClick={() => setSecondaryTimeframe(tf)}
                      className={`px-1.5 py-0.5 rounded ${
                        secondaryTimeframe === tf
                          ? 'bg-[#262b36] text-white font-bold'
                          : 'opacity-60 hover:opacity-100'
                      }`}
                    >
                      {tf}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex-1 min-h-0 flex">
                <TradingChart
                  accountCurrency={activeSession.accountCurrency}
                  reactionScope={activeSession.id}
              reactionSession={activeSession}
              onLoadOlderHistory={loadOlderChartHistory}
                  symbol={symbol}
                  marketPrice={isPresentTime ? currentMidPrice : undefined}
              onGoToPresent={handleGoToPresent}
              onReturnToReplay={handleReturnToReplay}
                  feedLabel={getMarketFeedLabel(symbol, secondaryTimeframe, !isPresentTime)}
                  feedStatus={isPresentTime && (SPOT_SYMBOLS.has(symbol) || getSpotQuote(symbol)?.source.startsWith('Capital.com')) ? getSpotFeedStatus(symbol, presentClockTs) : undefined}
                  dataMessage={isMarketDataLoading ? undefined : historicalAvailability?.message || (!secondaryVisibleCandles.length ? 'No provider history for this date and timeframe.' : undefined)}
                  onGoToNextAvailableBar={historicalAvailability?.nextTime && (!activeSession.endTimestamp || historicalAvailability.nextTime <= activeSession.endTimestamp) ? () => { setIsPlaying(false); handleAdvanceOrRewindToTimestamp(historicalAvailability.nextTime!); } : undefined}
                  candles={secondaryVisibleCandles}
                  totalCandlesCount={secondaryVisibleCandles.length}
                  timeframe={secondaryTimeframe}
                  sessions={sessionsConfig}
                  showSessionBoxes={showSessionBoxes}
                  onToggleSessionBoxes={() => setShowSessionBoxes((v) => !v)}
                  showSRLevels={showSRLevels}
                  onToggleSRLevels={() => setShowSRLevels((v) => !v)}
                  keySupport={[]}
                  keyResistance={[]}
                  positions={(activeSession.positions || []).filter(
                    (p) => (p.symbol || activeSession.activeAsset) === symbol
                  )}
                  onUpdatePositionSLTP={(
                    id,
                    newSL,
                    newTP,
                    newEntryPrice,
                    newEndTime
                  ) => {
                    handleModifyPositionOrOrder(id, {
                      stopLoss: newSL,
                      takeProfit: newTP,
                      entryPrice: newEntryPrice,
                      endTime: newEndTime,
                    });
                  }}
                  onTogglePositionBox={(id,hidden)=>updateActiveSession(session=>({...session,positions:(session.positions||[]).map(position=>position.id===id?{...position,hideOnChart:hidden}:position)}))}
              onClosePosition={(id) => handleClosePosition(id, 1)}
                  onQuickBuySell={() => {}}
                  activeTool={activeTool}
                  onSelectTool={setActiveTool}
                  drawingColor={drawingColor}
                  onSelectDrawingColor={setDrawingColor}
                  drawingLineWidth={drawingLineWidth}
                  onSelectDrawingLineWidth={setDrawingLineWidth}
                  drawingLineStyle={drawingLineStyle}
                  onSelectDrawingLineStyle={setDrawingLineStyle}
                  onSelectReplayTimestamp={(_idx, ts) =>
                    handleAdvanceOrRewindToTimestamp(ts)
                  }
                  isReplayMode={!isPresentTime}
                  replayIndex={Math.max(0, secondaryVisibleCandles.length - 1)}
                  drawings={currentSymbolDrawings}
                  onAddDrawing={handleAddDrawing}
                  onUpdateDrawing={handleUpdateDrawing}
                  onDeleteDrawing={handleDeleteDrawing}
                  onClearDrawings={handleClearDrawings}
                  focusedSessionTime={focusedSessionTime}
                  candleRemainingText={isPresentTime ? 'CURRENT MARKET' : 'REPLAY'}
                  isChartFullscreen={false}
                  onToggleChartFullscreen={() => {}}
                  theme={theme}
                  replayAnimationMs={isPlaying&&!isPresentTime?Math.min(450,playbackSpeedMs*0.8):0}
              displayTimezone={activeSession.displayTimezone||'Africa/Johannesburg'}
              indicators={chartIndicators}
              onToggleIndicator={handleToggleIndicator}
              indicatorConfigs={indicatorConfigs}
              onUpdateIndicatorConfigs={handleUpdateIndicatorConfigs}
              onChangeActiveIndicatorSettingsId={setActiveIndicatorSettingsId}
              candleStyle={candleStyle}
                  onSelectCandleStyle={setCandleStyle}
                  customCandleColors={customCandleColors}
                  onChangeCustomCandleColors={setCustomCandleColors}
                  stayInDrawingMode={stayInDrawingMode}
                  lockDrawings={lockDrawings}
                  hideDrawings={hideDrawings}
                  magnetMode={magnetMode}
                  atr14={atr14}
                  viewportFocusVersion={viewportFocusVersion}
                />
              </div>
            </div>
          )}
        </div>

        {!isChartWideMode && !isMobile && <button
          type="button"
          aria-label={showRightWidget ? 'Collapse order panel' : 'Expand order panel'}
          aria-expanded={showRightWidget}
          aria-controls="chart-order-panel"
          onClick={() => setShowRightWidget(value => !value)}
          title={showRightWidget ? 'Collapse order panel' : 'Expand order panel'}
          style={{right: showRightWidget && !isMobile ? 320 : 58}}
          className={`absolute top-1/2 z-40 -translate-y-1/2 rounded-l-xl border border-r-0 px-1 py-3.5 shadow-lg order-panel-toggle ${theme === 'light' ? 'border-emerald-500/30 bg-white text-teal-700 hover:bg-emerald-50' : 'border-emerald-500/25 bg-[#0d1722] text-emerald-300 hover:text-white hover:bg-[#132232] shadow-[0_0_16px_-4px_rgba(16,185,129,0.3)]'}`}
        >{showRightWidget ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}</button>}

        {/* Right Panel */}
        {!isChartWideMode && (
          <AnimatedOrderPanel
            open={showRightWidget}
            mobile={isMobile}
            onClose={() => setShowRightWidget(false)}
            onOpen={() => setShowRightWidget(true)}
            onSelectSideAndOpen={(side) => {
              setActiveOrderSide(side);
              setRequestedOrderSide({ side, seq: Date.now() });
              setShowRightWidget(true);
            }}
            activeSide={activeOrderSide}
            spreadPips={getBidAskFromMid(currentMidPrice, symbol, activeSession).spreadPips}
            unitLabel={getInstrumentPipLabel(symbol)}
            isPropMode={activeSession.mode === 'PROP_FIRM'}
            theme={theme}
          >
          <RightOrderPanel
            key={activeSession.id}
            session={activeSession}
            pricingContext={`${getMarketFeedLabel(symbol,timeframe,!isPresentTime)}:${marketDataRequestKey}`}
            pricingReady={!isMarketDataLoading && loadedMarketDataKey === marketDataRequestKey}
            symbol={symbol}
            currentMidPrice={currentMidPrice}
            atr14={atr14}
            theme={theme}
            onExecuteOrder={handleExecuteOrder}
            onStartNewChallengeAttempt={(targetPhase) =>
              handleStartNewChallengeAttempt(undefined, targetPhase)
            }
            onOpenAnalytics={() => {
              setHubInitialSection('analytics');
              setActiveView('analytics_page');
            }}
            availableStrategies={allStrategyNames}
            activePositionDrawing={activePositionDrawing}
            onAddOrUpdatePositionDrawing={handleAddOrUpdatePositionDrawingFromTicket}
            onCollapse={() => setShowRightWidget(false)}
            requestedSide={requestedOrderSide}
            onSideChange={setActiveOrderSide}
          />
          </AnimatedOrderPanel>
        )}


      </div>

      {/* Bottom Panel (Always visible on mobile so Play/Pause/Speed/Skip controls are never hidden) */}
      {(!isChartWideMode || isMobile) && (
        <ReplayAndSessionsDock
          session={activeSession}
          symbol={symbol}
          candles={visibleCandles}
          allCandlesCount={visibleCandles.length}
          replayIndex={Math.max(0, visibleCandles.length - 1)}
          isReplayMode={!isPresentTime}
          isPlaying={isPlaying}
          replayStepTimeframe={replayStepTimeframe}
          onSetReplayStepTimeframe={setReplayStepTimeframe}
          playbackSpeedMs={playbackSpeedMs}
          onSetPlaybackSpeedMs={setPlaybackSpeedMs}
          onTogglePlay={() => { if (isPresentTime) return; setIsPlaying((v) => !v); }}
          onStepBar={handleStepBar}
          onSkipToTimestamp={handleAdvanceOrRewindToTimestamp}
          onBranchSession={handleBranchSession}
          activeTool={activeTool}
          onSetActiveTool={setActiveTool}
          sessions={sessionsConfig}
          onToggleSessionEnabled={(id) =>
            setSessionsConfig((prev) =>
              prev.map((s) =>
                s.id === id ? { ...s, enabled: !s.enabled } : s
              )
            )
          }
          sessionBoxes={sessionBoxes}
          onFocusSessionTime={(ts) => setFocusedSessionTime(ts)}
          positions={activeSession.positions || []}
          onModifyPositionOrOrder={handleModifyPositionOrOrder}
          onClosePosition={handleClosePosition}
          onMoveToBreakEven={handleMoveToBreakEven}
          onGoToSessionOpen={handleGoToSessionOpen}
          onSaveJournalEntry={(tradeId, entry) =>
            handleSaveJournalEntry(tradeId, entry)
          }
          onOpenAnalyticsPage={() => {
            setHubInitialSection('analytics');
            setActiveView('analytics_page');
          }}
          onStartNewChallengeAttempt={(targetPhase) =>
            handleStartNewChallengeAttempt(undefined, targetPhase)
          }
          timeframe={timeframe}
          theme={theme}
        />
      )}

      {/* Create Session Modal */}
      <CreateSessionModal
        isOpen={isCreateSessionModalOpen}
        initialMode={createSessionModalMode}
        onClose={() => setIsCreateSessionModalOpen(false)}
        sessions={tradingSessions}
        activeSessionId={activeSession.id}
        theme={theme}
        onCreateSession={(newSession) => handleCreateNewSession(newSession, false)}
        onSelectSession={(sessId) => {
          setIsPlaying(false);
          setActiveSessionId(sessId);
          setViewportFocusVersion((v) => v + 1);
          setIsCreateSessionModalOpen(false);
          setChartSponsorLoading(getCachedSponsorshipConfig().enabled);
        }}
        onDeleteSession={handleDeleteSession}
        savedStrategies={allStrategyNames}
        onAddStrategy={(newStratName: string) => {
          if (!allStrategyNames.includes(newStratName)) {
            const next: StrategyRecord[] = [
              ...strategies,
              {
                id: `strat-${Date.now()}`,
                name: newStratName,
                description: 'Created during session setup',
                defaultChecklist: ['HTF aligned', 'Risk within plan'],
                setupTags: ['Standard'],
                createdAt: new Date().toISOString().slice(0, 10),
              },
            ];
            setStrategies(next);
            saveUserStrategies(currentUser.email, next);
          }
        }}
        customRuleProfiles={customRuleProfiles}
        onSaveCustomRuleProfile={(profile) => {
          const next = [...customRuleProfiles, profile];
          setCustomRuleProfiles(next);
          saveUserCustomRuleProfiles(currentUser.email, next);
        }}
      />

      <ChartSponsorLoader
        open={chartSponsorLoading && !isCreateSessionModalOpen}
        symbol={symbol}
        timeframe={timeframe}
        sessionName={activeSession?.name}
        theme={theme}
        onComplete={() => setChartSponsorLoading(false)}
      />

      <MotivationWelcome
        userKey={currentUser.email}
        name={currentUser.name}
        eligible={!isCreateSessionModalOpen && !isTourOpen && !challengeAlertModal && !chartSponsorLoading}
        chartStatus={isMarketDataLoading ? 'Preparing your chart…' : visibleCandles.length ? 'Your chart is ready' : 'Your workspace is ready'}
        loading={isMarketDataLoading}
        isLight={theme === 'light'}
        onOpen={() => { setMotivationOpen(true); setIsPlaying(false); }}
        onDismiss={() => setMotivationOpen(false)}
      />

      {/* Guided Product Tour (first trade walkthrough) */}
      <GuidedTour
        isOpen={isTourOpen}
        onClose={handleCloseTour}
        onStepChange={handleTourStepChange}
      />

      {/* Celebratory Confetti Overlay */}
      <ConfettiCelebration burstKey={confettiBurstKey} />

      {/* Challenge Breach / Pass Alert Modal */}
      {challengeAlertModal && (
        <div className="dark-modal fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-2xl border p-6 space-y-4 bg-[#14171c] border-[#262a34] text-white shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                {challengeAlertModal.status === 'FAILED' ? (
                  <XCircle className="w-6 h-6 text-rose-500" />
                ) : (
                  <Trophy className="w-6 h-6 text-amber-400" />
                )}
                <h3 className="text-base font-extrabold">
                  {challengeAlertModal.title}
                </h3>
              </div>
              <button
                onClick={() => setChallengeAlertModal(null)}
                className="p-1 rounded hover:bg-gray-500/20"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs leading-relaxed opacity-90 bg-black/30 p-3.5 rounded-xl border border-gray-500/20 font-mono">
              {challengeAlertModal.explanation}
            </p>

            {challengeAlertModal.advancedToPhase2 ? (
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-200 space-y-1">
                <div className="font-extrabold text-emerald-400">
                  🎉 Congratulations! Challenge 1 (Phase 1) Completed &amp; Saved to Analytics
                </div>
                <p className="text-[11px] opacity-90">
                  Your Phase 1 trades and target results are recorded under Challenge 1 in Performance Analytics. Click <strong>Congratulations — Go to Phase 2</strong> below to shoot confetti and begin your Phase 2 verification.
                </p>
              </div>
            ) : challengeAlertModal.status === 'PASSED' ? (
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-200 space-y-1">
                <div className="font-extrabold text-emerald-400">
                  🎉 Congratulations! Prop Firm Challenge Successfully Passed!
                </div>
                <p className="text-[11px] opacity-90">
                  You hit the profit target while respecting all daily and maximum drawdown rules. Both Challenge 1 and Challenge 2 results are saved in Performance Analytics.
                </p>
              </div>
            ) : challengeAlertModal.status === 'FAILED' ? (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-200 space-y-1">
                <div className="font-extrabold text-rose-400">
                  Would you like to redo this challenge phase?
                </div>
                <p className="text-[11px] opacity-90">
                  You can immediately redo your current phase with a fresh balance and drawdown allowance while keeping your earlier attempt history intact.
                </p>
              </div>
            ) : null}

            <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
              <button
                onClick={() => {
                  if (challengeAlertModal.status === 'PASSED') {
                    triggerConfetti();
                  }
                  setChallengeAlertModal(null);
                  setHubInitialSection('analytics');
                  setActiveView('analytics_page');
                }}
                className="px-3.5 py-2 rounded-xl bg-[#22262f] hover:bg-[#2c313d] border border-[#323744] text-white text-xs font-extrabold flex items-center gap-1.5"
              >
                <BarChart3 className="w-4 h-4" />
                <span>View Analytics</span>
              </button>

              {challengeAlertModal.advancedToPhase2 ? (
                <button
                  onClick={() => {
                    triggerConfetti();
                    setChallengeAlertModal(null);
                    showToast(
                      '🎉 Congratulations on passing Phase 1! Phase 2 (Challenge 2) is now active!',
                      'up'
                    );
                  }}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white text-xs font-extrabold flex items-center gap-1.5 shadow-lg"
                >
                  <Trophy className="w-4 h-4 text-amber-300" />
                  <span>🎉 Congratulations — Go to Phase 2</span>
                </button>
              ) : challengeAlertModal.status === 'PASSED' ? (
                <button
                  onClick={() => {
                    triggerConfetti();
                    setChallengeAlertModal(null);
                    showToast(
                      '🎉 Congratulations! Prop Firm Challenge Passed & Saved to Analytics!',
                      'up'
                    );
                  }}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white text-xs font-extrabold flex items-center gap-1.5 shadow-lg"
                >
                  <Trophy className="w-4 h-4 text-amber-300" />
                  <span>🎉 Congratulations! Celebrate &amp; Continue</span>
                </button>
              ) : (activeSession.frozenConfig?.propFirmRules?.challengePhase ||
                  activeSession.propFirmRules?.challengePhase) === 'PHASE_2' ? (
                <>
                  <button
                    onClick={() =>
                      handleStartNewChallengeAttempt(undefined, 'PHASE_1')
                    }
                    className="px-3.5 py-2 rounded-xl bg-[#22262f] hover:bg-[#2c313d] border border-[#323744] text-white text-xs font-extrabold flex items-center gap-1.5"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>Restart Phase 1</span>
                  </button>
                  <button
                    onClick={() =>
                      handleStartNewChallengeAttempt(undefined, 'PHASE_2')
                    }
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold flex items-center gap-1.5 shadow-lg"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>Redo Phase 2</span>
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() =>
                      handleStartNewChallengeAttempt(undefined, 'PHASE_1')
                    }
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold flex items-center gap-1.5 shadow-lg"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>Redo Phase 1</span>
                  </button>
                  <button
                    onClick={() =>
                      handleStartNewChallengeAttempt(undefined, 'PHASE_2')
                    }
                    className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-extrabold flex items-center gap-1.5"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>Go to Phase 2</span>
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
