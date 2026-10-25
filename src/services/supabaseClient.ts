import {
  AccountCurrency,
  BacktestSessionMode,
  CustomRuleProfile,
  InstrumentSymbol,
  StrategyRecord,
  Timeframe,
  TradingSession,
} from '../types/trading';
import { computeAuthoritativeRealizedPnl } from './simulationEngine';
import { RegisteredUser } from './storageAndAnalytics';
import type { SponsorshipConfig } from './sponsorship';

export const SUPABASE_PROJECT_ID = 'vkbrwjrenkmysqlwypoc';
export const DEFAULT_SUPABASE_URL = `https://${SUPABASE_PROJECT_ID}.supabase.co`;
export const DEFAULT_SUPABASE_REST_URL = `${DEFAULT_SUPABASE_URL}/rest/v1/`;
export const DEFAULT_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZrYnJ3anJlbmtteXNxbHd5cG9jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI5MzIxNjMsImV4cCI6MjEwODUwODE2M30.j3kVGWh5efEGQS5_PJC8_Uy5mnfqEFk5eWVx7wz27mk';

export function getSupabaseClientConfig() {
  const env = (import.meta as { env?: Record<string, string | undefined> }).env || {};
  const restUrl =
    env.VITE_SUPABASE_REST_URL ||
    (env.VITE_SUPABASE_URL
      ? `${env.VITE_SUPABASE_URL.replace(/\/+$/, '')}/rest/v1/`
      : DEFAULT_SUPABASE_REST_URL);
  const anonKey = env.VITE_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY;
  const isTestEnv = env.MODE === 'test' || Boolean(env.VITEST);
  return {
    restUrl: restUrl.endsWith('/') ? restUrl : `${restUrl}/`,
    anonKey,
    enabled: Boolean(restUrl && anonKey) && !isTestEnv,
  };
}

export async function supabaseFetch<T = unknown>(
  pathAndQuery: string,
  options: {
    method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
    body?: unknown;
    prefer?: string;
    forceEnable?: boolean;
  } = {}
): Promise<T | null> {
  const cfg = getSupabaseClientConfig();
  if (!cfg.enabled && !options.forceEnable) return null;
  if (typeof fetch !== 'function') return null;

  const url = `${cfg.restUrl}${pathAndQuery.replace(/^\/+/, '')}`;
  const headers: Record<string, string> = {
    apikey: cfg.anonKey,
    Authorization: `Bearer ${cfg.anonKey}`,
    Accept: 'application/json',
  };
  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  if (options.prefer) {
    headers['Prefer'] = options.prefer;
  }

  try {
    const res = await fetch(url, {
      method: options.method || 'GET',
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return null;
    const text = await res.text();
    if (!text) return null;
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

function isValidUuid(id?: string): boolean {
  return Boolean(
    id &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        id
      )
  );
}

export async function syncUserAccountToSupabase(
  user: RegisteredUser
): Promise<void> {
  const cleanEmail = user.email.trim().toLowerCase();
  if (!cleanEmail || cleanEmail === 'trader@chartflow.io') return;

  // Never send password verifiers from browser clients; server-side scrypt manages password_hash.
  const payload: Record<string, unknown> = {
    name: user.name,
    email: cleanEmail,
    auth_source: user.authSource || 'local',
    plan: user.plan || 'FREE_FOREVER',
    login_count: user.loginCount ?? 1,
    last_login_at: user.lastLoginAt || new Date().toISOString(),
    last_seen_at: new Date().toISOString(),
    joined_at: user.joinedAt || new Date().toISOString(),
  };
  if (isValidUuid(user.id)) {
    payload.id = user.id;
  }

  await supabaseFetch('platform_users?on_conflict=email', {
    method: 'POST',
    prefer: 'resolution=merge-duplicates,return=minimal',
    body: payload,
  });
}

export function isUntouchedStarterSession(s: TradingSession): boolean {
  const hasPositions = Array.isArray(s.positions) && s.positions.length > 0;
  const hasOrders = Array.isArray(s.orders) && s.orders.length > 0;
  const hasFills = Array.isArray(s.fills) && s.fills.length > 0;
  const hasRealized = Math.abs(s.realizedPnL ?? 0) > 0.005;
  if (hasPositions || hasOrders || hasFills || hasRealized) return false;
  return /^session-(normal|prop)-/.test(s.id);
}

export async function syncUserSessionsToSupabase(
  userEmail: string,
  sessions: TradingSession[]
): Promise<void> {
  const cleanEmail = userEmail.trim().toLowerCase();
  if (!cleanEmail || cleanEmail === 'trader@chartflow.io' || sessions.length === 0) {
    return;
  }

  const sessionsToSync = sessions.filter((s) => !isUntouchedStarterSession(s));
  if (sessionsToSync.length === 0) {
    return;
  }

  const nowIso = new Date().toISOString();
  const rows = sessionsToSync.map((s) => {
    const startingBalance = Number(
      s.frozenConfig?.startingBalance ?? s.startingBalance ?? 100000
    );
    const accountCurrency: AccountCurrency =
      s.frozenConfig?.accountCurrency || s.accountCurrency || 'USD';
    const realizedPnl = computeAuthoritativeRealizedPnl(s);
    const sanitizedSessionData: TradingSession = {
      ...s,
      startingBalance,
      accountCurrency,
      realizedPnL: realizedPnl,
      replayCheckpoints: [],
    };
    return {
      id: s.id,
      user_email: cleanEmail,
      name: s.name || 'Trading Session',
      mode: s.mode || 'BACKTESTING',
      active_asset: s.activeAsset || 'XAUUSD',
      active_timeframe: s.activeTimeframe || '15m',
      starting_balance: startingBalance,
      account_currency: accountCurrency,
      status: s.status || 'ACTIVE',
      realized_pnl: realizedPnl,
      session_data: sanitizedSessionData,
      created_at: s.createdAt || nowIso,
      updated_at: s.updatedAt || nowIso,
    };
  });

  await supabaseFetch('trading_sessions?on_conflict=user_email,id', {
    method: 'POST',
    prefer: 'resolution=merge-duplicates,return=minimal',
    body: rows,
  });

  await supabaseFetch(
    `platform_users?email=eq.${encodeURIComponent(cleanEmail)}`,
    {
      method: 'PATCH',
      prefer: 'return=minimal',
      body: {
        session_ids: sessionsToSync.map((s) => s.id),
        last_seen_at: nowIso,
      },
    }
  );
}

export async function fetchUserSessionsFromSupabase(
  userEmail: string
): Promise<TradingSession[] | null> {
  const cleanEmail = userEmail.trim().toLowerCase();
  if (!cleanEmail || cleanEmail === 'trader@chartflow.io') return null;

  const rows = await supabaseFetch<
    Array<{
      id: string;
      name?: string;
      mode?: BacktestSessionMode;
      active_asset?: InstrumentSymbol;
      active_timeframe?: Timeframe;
      starting_balance?: number;
      account_currency?: AccountCurrency;
      status?: TradingSession['status'];
      realized_pnl?: number;
      created_at?: string;
      updated_at?: string;
      session_data: TradingSession;
    }>
  >(
    `trading_sessions?user_email=eq.${encodeURIComponent(
      cleanEmail
    )}&select=id,name,mode,active_asset,active_timeframe,starting_balance,account_currency,status,realized_pnl,created_at,updated_at,session_data&order=updated_at.desc`
  );
  if (!Array.isArray(rows) || rows.length === 0) return null;
  const parsed = rows
    .map((r) => {
      const raw = r.session_data;
      if (!raw || typeof raw.id !== 'string') return null;
      const startingBalance = Number(
        raw.frozenConfig?.startingBalance ??
          raw.startingBalance ??
          r.starting_balance ??
          100000
      );
      const accountCurrency: AccountCurrency =
        raw.frozenConfig?.accountCurrency ||
        raw.accountCurrency ||
        r.account_currency ||
        'USD';
      const normalized: TradingSession = {
        ...raw,
        name: raw.name || r.name || 'Trading Session',
        mode: raw.mode || r.mode || 'BACKTESTING',
        activeAsset: raw.activeAsset || r.active_asset || 'XAUUSD',
        activeTimeframe: raw.activeTimeframe || r.active_timeframe || '15m',
        startingBalance,
        accountCurrency,
        status: raw.status || r.status || 'ACTIVE',
        createdAt: raw.createdAt || r.created_at || new Date().toISOString(),
        updatedAt: raw.updatedAt || r.updated_at || new Date().toISOString(),
      };
      normalized.realizedPnL = computeAuthoritativeRealizedPnl(normalized);
      return normalized;
    })
    .filter((s): s is TradingSession => Boolean(s));

  if (parsed.length === 0) return null;
  const nonStarter = parsed.filter((s) => !isUntouchedStarterSession(s));
  const effective = nonStarter.length > 0 ? nonStarter : parsed;
  effective.sort((a, b) => {
    const aTrades = (a.positions ?? []).length;
    const bTrades = (b.positions ?? []).length;
    if ((aTrades > 0) !== (bTrades > 0)) return bTrades > 0 ? 1 : -1;
    return (Date.parse(b.updatedAt || '') || 0) - (Date.parse(a.updatedAt || '') || 0);
  });
  return effective;
}

export async function deleteUserSessionFromSupabase(
  userEmail: string,
  sessionId: string
): Promise<void> {
  const cleanEmail = userEmail.trim().toLowerCase();
  if (!cleanEmail || !sessionId) return;
  await supabaseFetch(
    `trading_sessions?user_email=eq.${encodeURIComponent(
      cleanEmail
    )}&id=eq.${encodeURIComponent(sessionId)}`,
    { method: 'DELETE' }
  );
}

export async function syncUserStrategiesToSupabase(
  userEmail: string,
  strategies: StrategyRecord[]
): Promise<void> {
  const cleanEmail = userEmail.trim().toLowerCase();
  if (!cleanEmail || cleanEmail === 'trader@chartflow.io' || strategies.length === 0) {
    return;
  }

  const rows = strategies.map((st) => ({
    id: st.id,
    user_email: cleanEmail,
    name: st.name,
    description: st.description || '',
    default_checklist: st.defaultChecklist || [],
    setup_tags: st.setupTags || [],
    created_at: st.createdAt
      ? new Date(st.createdAt).toISOString()
      : new Date().toISOString(),
  }));

  await supabaseFetch('user_strategies?on_conflict=user_email,id', {
    method: 'POST',
    prefer: 'resolution=merge-duplicates,return=minimal',
    body: rows,
  });
}

export async function fetchUserStrategiesFromSupabase(
  userEmail: string
): Promise<StrategyRecord[] | null> {
  const cleanEmail = userEmail.trim().toLowerCase();
  if (!cleanEmail || cleanEmail === 'trader@chartflow.io') return null;

  const rows = await supabaseFetch<
    Array<{
      id: string;
      user_email: string;
      name: string;
      description: string;
      default_checklist: string[];
      setup_tags: string[];
      created_at: string;
    }>
  >(
    `user_strategies?user_email=eq.${encodeURIComponent(
      cleanEmail
    )}&select=*&order=created_at.asc`
  );
  if (!Array.isArray(rows) || rows.length === 0) return null;
  return rows.map((r) => ({
    id: r.id,
    userId: r.user_email,
    name: r.name,
    description: r.description || '',
    defaultChecklist: Array.isArray(r.default_checklist) ? r.default_checklist : [],
    setupTags: Array.isArray(r.setup_tags) ? r.setup_tags : [],
    createdAt: r.created_at,
  }));
}

export async function syncUserStrategyNotesToSupabase(
  userEmail: string,
  notesText: string
): Promise<void> {
  const cleanEmail = userEmail.trim().toLowerCase();
  if (!cleanEmail || cleanEmail === 'trader@chartflow.io') return;

  await supabaseFetch('user_strategy_notes?on_conflict=user_email', {
    method: 'POST',
    prefer: 'resolution=merge-duplicates,return=minimal',
    body: {
      user_email: cleanEmail,
      notes_text: notesText,
      updated_at: new Date().toISOString(),
    },
  });
}

export async function fetchUserStrategyNotesFromSupabase(
  userEmail: string
): Promise<string | null> {
  const cleanEmail = userEmail.trim().toLowerCase();
  if (!cleanEmail || cleanEmail === 'trader@chartflow.io') return null;

  const rows = await supabaseFetch<Array<{ notes_text: string }>>(
    `user_strategy_notes?user_email=eq.${encodeURIComponent(
      cleanEmail
    )}&select=notes_text&limit=1`
  );
  if (!Array.isArray(rows) || rows.length === 0) return null;
  return typeof rows[0].notes_text === 'string' ? rows[0].notes_text : null;
}

export async function syncCustomRuleProfilesToSupabase(
  userEmail: string,
  profiles: CustomRuleProfile[]
): Promise<void> {
  const cleanEmail = userEmail.trim().toLowerCase();
  if (!cleanEmail || cleanEmail === 'trader@chartflow.io' || profiles.length === 0) {
    return;
  }

  const rows = profiles.map((p) => ({
    id: p.id,
    user_email: cleanEmail,
    name: p.name,
    description: p.rules?.firmName || '',
    rules_data: p,
    created_at: p.createdAt || new Date().toISOString(),
  }));

  await supabaseFetch('custom_rule_profiles?on_conflict=user_email,id', {
    method: 'POST',
    prefer: 'resolution=merge-duplicates,return=minimal',
    body: rows,
  });
}

export async function fetchCustomRuleProfilesFromSupabase(
  userEmail: string
): Promise<CustomRuleProfile[] | null> {
  const cleanEmail = userEmail.trim().toLowerCase();
  if (!cleanEmail || cleanEmail === 'trader@chartflow.io') return null;

  const rows = await supabaseFetch<Array<{ rules_data: CustomRuleProfile }>>(
    `custom_rule_profiles?user_email=eq.${encodeURIComponent(
      cleanEmail
    )}&select=rules_data&order=created_at.asc`
  );
  if (!Array.isArray(rows) || rows.length === 0) return null;
  return rows
    .map((r) => r.rules_data)
    .filter((p): p is CustomRuleProfile => Boolean(p && typeof p.id === 'string'));
}

export async function deleteAllUserSupabaseData(
  userEmail: string
): Promise<void> {
  const cleanEmail = userEmail.trim().toLowerCase();
  if (!cleanEmail || cleanEmail === 'trader@chartflow.io') return;
  const encoded = encodeURIComponent(cleanEmail);
  await Promise.allSettled([
    supabaseFetch(`trading_sessions?user_email=eq.${encoded}`, { method: 'DELETE' }),
    supabaseFetch(`user_strategies?user_email=eq.${encoded}`, { method: 'DELETE' }),
    supabaseFetch(`user_strategy_notes?user_email=eq.${encoded}`, { method: 'DELETE' }),
    supabaseFetch(`custom_rule_profiles?user_email=eq.${encoded}`, { method: 'DELETE' }),
  ]);
}

export async function fetchSponsorshipFromSupabase(): Promise<Partial<SponsorshipConfig> | null> {
  const rows = await supabaseFetch<
    Array<{
      id: string;
      enabled: boolean;
      sponsor_name: string;
      badge_text: string;
      headline_prefix: string;
      subtext: string;
      footer_left_text: string;
      footer_right_text: string;
      accent_color: string;
      logo_light_url: string;
      logo_dark_url: string;
      updated_by?: string;
      updated_at?: string;
    }>
  >('platform_sponsorship?id=eq.active&select=*&limit=1');
  if (!Array.isArray(rows) || rows.length === 0) return null;
  const row = rows[0];
  return {
    enabled: typeof row.enabled === 'boolean' ? row.enabled : true,
    sponsorName: row.sponsor_name,
    badgeText: row.badge_text,
    headlinePrefix: row.headline_prefix,
    subtext: row.subtext,
    footerLeftText: row.footer_left_text,
    footerRightText: row.footer_right_text,
    accentColor: row.accent_color,
    logoLightUrl: row.logo_light_url,
    logoDarkUrl: row.logo_dark_url,
    updatedBy: row.updated_by || undefined,
    updatedAt: row.updated_at || undefined,
  };
}

export async function syncSponsorshipToSupabase(
  config: SponsorshipConfig
): Promise<boolean> {
  const cfg = getSupabaseClientConfig();
  if (!cfg.enabled) return false;

  const url = `${cfg.restUrl}platform_sponsorship?on_conflict=id`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        apikey: cfg.anonKey,
        Authorization: `Bearer ${cfg.anonKey}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify({
        id: 'active',
        enabled: config.enabled,
        sponsor_name: config.sponsorName,
        badge_text: config.badgeText,
        headline_prefix: config.headlinePrefix,
        subtext: config.subtext,
        footer_left_text: config.footerLeftText,
        footer_right_text: config.footerRightText,
        accent_color: config.accentColor,
        logo_light_url: config.logoLightUrl,
        logo_dark_url: config.logoDarkUrl,
        updated_by: config.updatedBy || 'admin',
        updated_at: config.updatedAt || new Date().toISOString(),
      }),
      signal: AbortSignal.timeout(15000),
    });
    return res.ok;
  } catch {
    return false;
  }
}
