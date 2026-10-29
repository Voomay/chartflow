import { createHmac } from 'node:crypto';
import dns from 'node:dns';

try {
  dns.setDefaultResultOrder('ipv4first');
} catch {
  // ignore
}

export function resolveSupabaseConfig(env = process.env) {
  if (env.SUPABASE_ENABLED === 'false') return null;
  const rawRestUrl =
    env.SUPABASE_REST_URL ||
    env.VITE_SUPABASE_REST_URL ||
    (env.SUPABASE_URL ? `${env.SUPABASE_URL.replace(/\/+$/, '')}/rest/v1/` : '') ||
    (env.VITE_SUPABASE_URL ? `${env.VITE_SUPABASE_URL.replace(/\/+$/, '')}/rest/v1/` : '');
  const apiKey =
    env.SUPABASE_SERVICE_ROLE_KEY ||
    env.SUPABASE_ANON_KEY ||
    env.VITE_SUPABASE_ANON_KEY ||
    '';
  if (!rawRestUrl || !apiKey) return null;
  try {
    const parsed = new URL(rawRestUrl.endsWith('/') ? rawRestUrl : `${rawRestUrl}/`);
    if (parsed.protocol !== 'https:') return null;
    return {
      restUrl: parsed.toString(),
      apiKey,
      projectId: env.SUPABASE_PROJECT_ID || parsed.hostname.split('.')[0] || '',
    };
  } catch {
    return null;
  }
}

export function isSupabaseConfigured(env = process.env) {
  return Boolean(resolveSupabaseConfig(env));
}

export async function supabaseRestRequest(
  pathAndQuery,
  { method = 'GET', body, prefer, env = process.env, request = fetch } = {}
) {
  const cfg = resolveSupabaseConfig(env);
  if (!cfg) {
    const err = new Error('Supabase is not configured');
    err.code = 'SUPABASE_NOT_CONFIGURED';
    throw err;
  }
  const targetUrl = new URL(pathAndQuery.replace(/^\/+/, ''), cfg.restUrl);
  const headers = {
    apikey: cfg.apiKey,
    Authorization: `Bearer ${cfg.apiKey}`,
    Accept: 'application/json',
  };
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  if (prefer) {
    headers['Prefer'] = prefer;
  }

  const response = await request(targetUrl.toString(), {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15000),
  });

  const text = await response.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!response.ok) {
    const err = new Error(
      (data && typeof data === 'object' && data.message) ||
        `Supabase HTTP ${response.status}`
    );
    err.status = response.status;
    err.code = data && typeof data === 'object' ? data.code : undefined;
    throw err;
  }

  return data;
}

function rowToUser(row) {
  return {
    id: row.id,
    name: row.name,
    email: String(row.email || '').toLowerCase(),
    passwordHash: row.password_hash || '',
    authSource: row.auth_source || 'server',
    plan: row.plan || 'FREE_FOREVER',
    joinedAt: row.joined_at || new Date().toISOString(),
    loginCount: Number(row.login_count ?? 1),
    lastLoginAt: row.last_login_at || null,
    lastSeenAt: row.last_seen_at || null,
    sessionIds: Array.isArray(row.session_ids) ? row.session_ids : [],
  };
}

function userToRow(user) {
  return {
    id: user.id,
    name: user.name,
    email: String(user.email || '').toLowerCase(),
    password_hash: user.passwordHash || '',
    auth_source: user.authSource || 'server',
    plan: user.plan || 'FREE_FOREVER',
    joined_at: user.joinedAt || new Date().toISOString(),
    login_count: Number(user.loginCount ?? 1),
    last_login_at: user.lastLoginAt || null,
    last_seen_at: user.lastSeenAt || null,
    session_ids: Array.isArray(user.sessionIds) ? user.sessionIds : [],
  };
}

export function createSupabaseAccountStore({
  env = process.env,
  request = fetch,
  fallbackStore = null,
} = {}) {
  const readFromSupabase = async () => {
    const rows = await supabaseRestRequest(
      'platform_users?select=*&order=joined_at.desc',
      { method: 'GET', env, request }
    );
    return Array.isArray(rows) ? rows.map(rowToUser) : [];
  };

  const enrichUsersWithSupabaseActivity = async (users) => {
    if (!Array.isArray(users) || users.length === 0) return users;
    const [sessionsRes, strategiesRes, notesRes] = await Promise.allSettled([
      supabaseRestRequest(
        'trading_sessions?select=id,user_email,name,mode,realized_pnl,session_data',
        { method: 'GET', env, request }
      ),
      supabaseRestRequest(
        'user_strategies?select=id,user_email,name,description',
        { method: 'GET', env, request }
      ),
      supabaseRestRequest(
        'user_strategy_notes?select=user_email,notes_text,updated_at',
        { method: 'GET', env, request }
      ),
    ]);
    const sessionRows =
      sessionsRes.status === 'fulfilled' && Array.isArray(sessionsRes.value)
        ? sessionsRes.value
        : [];
    const strategyRows =
      strategiesRes.status === 'fulfilled' && Array.isArray(strategiesRes.value)
        ? strategiesRes.value
        : [];
    const noteRows =
      notesRes.status === 'fulfilled' && Array.isArray(notesRes.value)
        ? notesRes.value
        : [];

    const isStarterSessionId = (id, email) => {
      const sId = String(id || '').trim();
      if (!sId) return true;
      if (/^session-empty-/i.test(sId)) return true;
      if (!/^session-(normal|prop)-/i.test(sId)) return false;
      const slug =
        (String(email || '').split('@')[0] || '')
          .toLowerCase()
          .replace(/[^a-z0-9]/g, '')
          .slice(0, 12) || 'trader';
      if (sId === 'session-normal-trader' || sId === 'session-prop-trader') {
        return true;
      }
      if (
        sId === `session-normal-${slug}` ||
        sId === `session-prop-${slug}`
      ) {
        return true;
      }
      return true;
    };

    const isDefaultMindsetText = (text) => {
      const trimmed = typeof text === 'string' ? text.trim() : '';
      if (!trimmed) return true;
      return (
        trimmed.startsWith('MY TRADING PLAN\n\n• Wait for my setup.') ||
        trimmed.startsWith('MY TRADING PLAN\n\nYou can write your trading plan here')
      );
    };

    return users.map((user) => {
      const email = String(user.email || '').toLowerCase();
      const rawUserSessions = sessionRows.filter(
        (r) => String(r?.user_email || '').toLowerCase() === email
      );
      const userSessions = rawUserSessions.filter(
        (s) => !isStarterSessionId(s?.id, email)
      );
      const userStrategies = strategyRows.filter(
        (r) => String(r?.user_email || '').toLowerCase() === email
      );
      const customStrategies = userStrategies.filter(
        (r) => !/^strat-[1-6]$/.test(String(r?.id || ''))
      );
      const userNote = noteRows.find(
        (r) => String(r?.user_email || '').toLowerCase() === email
      );
      const rawNoteText =
        typeof userNote?.notes_text === 'string' ? userNote.notes_text.trim() : '';
      const noteText = isDefaultMindsetText(rawNoteText) ? '' : rawNoteText;

      const nonStarterSessionIds = new Set([
        ...(Array.isArray(user.sessionIds) ? user.sessionIds : []).filter(
          (id) => !isStarterSessionId(id, email)
        ),
        ...userSessions.map((s) => String(s.id)),
      ]);

      const tradeCount = userSessions.reduce(
        (sum, s) =>
          sum +
          (Array.isArray(s?.session_data?.positions)
            ? s.session_data.positions.length
            : 0),
        0
      );

      const customStrategyName = customStrategies[0]?.name || '';
      const sessionMindsetText =
        userSessions
          .map((s) => s?.session_data?.mindsetNote?.text || '')
          .find((t) => !isDefaultMindsetText(t)) || '';
      const firstNoteLine =
        (noteText || sessionMindsetText)
          .split(/\r?\n/)
          .map((l) => l.replace(/^[#•*\-\s]+/, '').trim())
          .find(Boolean) || '';
      const sessionStrategyName =
        userSessions.find(
          (s) =>
            typeof s?.session_data?.strategyName === 'string' &&
            s.session_data.strategyName.trim().length > 0
        )?.session_data?.strategyName || '';

      const hasTradingPlan = Boolean(
        customStrategies.length > 0 ||
          noteText.length > 0 ||
          sessionMindsetText.length > 0 ||
          sessionStrategyName.length > 0
      );
      const tradingPlanName =
        customStrategyName || firstNoteLine || sessionStrategyName || null;
      const tradingPlanCount =
        customStrategies.length + (noteText || sessionMindsetText ? 1 : 0) ||
        (hasTradingPlan ? 1 : 0);

      return {
        ...user,
        sessionIds: Array.from(nonStarterSessionIds),
        sessionCount: nonStarterSessionIds.size,
        tradeCount,
        hasTradingPlan,
        tradingPlanName,
        tradingPlanCount,
      };
    });
  };

  const userByIdCache = new Map();
  const presenceWriteTs = new Map();
  const activityWriteTs = new Map();
  let cachedAdminUsers = null;
  let cachedAdminUsersAt = 0;
  let inflightAdminRead = null;
  let cachedSponsorship = null;
  let cachedSponsorshipAt = 0;

  return {
    get remote() {
      return isSupabaseConfigured(env);
    },
    get scope() {
      return isSupabaseConfigured(env) ? 'supabase' : 'localhost';
    },
    async findById(userId) {
      if (!userId) return null;
      if (!isSupabaseConfigured(env)) {
        if (!fallbackStore) return null;
        if (typeof fallbackStore.findById === 'function') return fallbackStore.findById(userId);
        const all = await fallbackStore.read();
        return all.find((u) => u.id === userId) || null;
      }
      const nowMs = Date.now();
      const cached = userByIdCache.get(userId);
      if (cached && nowMs - cached.at < 15000) {
        return cached.user;
      }
      try {
        const rows = await supabaseRestRequest(
          `platform_users?id=eq.${encodeURIComponent(userId)}&select=*&limit=1`,
          { method: 'GET', env, request }
        );
        const found = Array.isArray(rows) && rows[0] ? rowToUser(rows[0]) : null;
        if (found) userByIdCache.set(userId, { user: found, at: nowMs });
        return found;
      } catch (err) {
        if (fallbackStore && (err.code === 'PGRST205' || err.status === 404)) {
          const all = await fallbackStore.read();
          return all.find((u) => u.id === userId) || null;
        }
        throw err;
      }
    },
    async findByEmail(email) {
      const cleanEmail = String(email || '').trim().toLowerCase();
      if (!cleanEmail) return null;
      if (!isSupabaseConfigured(env)) {
        if (!fallbackStore) return null;
        if (typeof fallbackStore.findByEmail === 'function') return fallbackStore.findByEmail(cleanEmail);
        const all = await fallbackStore.read();
        return all.find((u) => String(u.email || '').toLowerCase() === cleanEmail) || null;
      }
      try {
        const rows = await supabaseRestRequest(
          `platform_users?email=eq.${encodeURIComponent(cleanEmail)}&select=*&limit=1`,
          { method: 'GET', env, request }
        );
        const found = Array.isArray(rows) && rows[0] ? rowToUser(rows[0]) : null;
        if (found) userByIdCache.set(found.id, { user: found, at: Date.now() });
        return found;
      } catch (err) {
        if (fallbackStore && (err.code === 'PGRST205' || err.status === 404)) {
          const all = await fallbackStore.read();
          return all.find((u) => String(u.email || '').toLowerCase() === cleanEmail) || null;
        }
        throw err;
      }
    },
    async createUser(newUser) {
      if (!isSupabaseConfigured(env)) {
        if (!fallbackStore) throw new Error('Account store is not configured');
        return fallbackStore.change((users) => {
          if (users.some((u) => String(u.email || '').toLowerCase() === String(newUser.email || '').toLowerCase())) {
            return null;
          }
          users.push(newUser);
          return newUser;
        });
      }
      try {
        const existing = await this.findByEmail(newUser.email);
        if (existing) return null;
        const row = userToRow(newUser);
        await supabaseRestRequest('platform_users?on_conflict=email', {
          method: 'POST',
          prefer: 'resolution=merge-duplicates,return=minimal',
          body: [row],
          env,
          request,
        });
        userByIdCache.set(newUser.id, { user: newUser, at: Date.now() });
        cachedAdminUsers = null;
        return newUser;
      } catch (err) {
        if (fallbackStore && (err.code === 'PGRST205' || err.status === 404)) {
          return fallbackStore.change((users) => {
            if (users.some((u) => String(u.email || '').toLowerCase() === String(newUser.email || '').toLowerCase())) {
              return null;
            }
            users.push(newUser);
            return newUser;
          });
        }
        throw err;
      }
    },
    async recordLogin(user, nowIso) {
      if (!isSupabaseConfigured(env)) {
        if (!fallbackStore) throw new Error('Account store is not configured');
        return fallbackStore.change((users) => {
          const current = users.find((item) => item.id === user.id);
          if (!current) return null;
          current.loginCount = (current.loginCount || 0) + 1;
          current.lastLoginAt = nowIso;
          current.lastSeenAt = nowIso;
          return current;
        });
      }
      try {
        const updated = {
          ...user,
          loginCount: (user.loginCount || 0) + 1,
          lastLoginAt: nowIso,
          lastSeenAt: nowIso,
        };
        await supabaseRestRequest(
          `platform_users?id=eq.${encodeURIComponent(user.id)}`,
          {
            method: 'PATCH',
            prefer: 'return=minimal',
            body: {
              login_count: updated.loginCount,
              last_login_at: nowIso,
              last_seen_at: nowIso,
            },
            env,
            request,
          }
        );
        userByIdCache.set( user.id, { user: updated, at: Date.now() });
        cachedAdminUsers = null;
        return updated;
      } catch (err) {
        if (fallbackStore && (err.code === 'PGRST205' || err.status === 404)) {
          return fallbackStore.change((users) => {
            const current = users.find((item) => item.id === user.id);
            if (!current) return null;
            current.loginCount = (current.loginCount || 0) + 1;
            current.lastLoginAt = nowIso;
            current.lastSeenAt = nowIso;
            return current;
          });
        }
        throw err;
      }
    },
    async updatePassword(userId, passwordHash, nowIso = new Date().toISOString()) {
      if (!userId || !passwordHash) return null;
      if (!isSupabaseConfigured(env)) {
        if (!fallbackStore) throw new Error('Account store is not configured');
        return fallbackStore.change((users) => {
          const current = users.find((item) => item.id === userId);
          if (!current) return null;
          current.passwordHash = passwordHash;
          current.lastSeenAt = nowIso;
          return current;
        });
      }
      try {
        const existing = await this.findById(userId);
        if (!existing) return null;
        const updated = {
          ...existing,
          passwordHash,
          authSource: 'server',
          lastSeenAt: nowIso,
        };
        await supabaseRestRequest(
          `platform_users?id=eq.${encodeURIComponent(userId)}`,
          {
            method: 'PATCH',
            prefer: 'return=minimal',
            body: {
              password_hash: passwordHash,
              auth_source: 'server',
              last_seen_at: nowIso,
            },
            env,
            request,
          }
        );
        userByIdCache.set(userId, { user: updated, at: Date.now() });
        cachedAdminUsers = null;
        return updated;
      } catch (err) {
        if (fallbackStore && (err.code === 'PGRST205' || err.status === 404)) {
          return fallbackStore.change((users) => {
            const current = users.find((item) => item.id === userId);
            if (!current) return null;
            current.passwordHash = passwordHash;
            current.lastSeenAt = nowIso;
            return current;
          });
        }
        throw err;
      }
    },
    async touchUserActivity(accountId, sessionIds = [], nowMs = Date.now()) {
      if (!accountId) return;
      const nonStarterIds = (Array.isArray(sessionIds) ? sessionIds : [])
        .filter((id) => !/^session-(normal|prop)-/.test(String(id)))
        .slice(0, 10000);
      const sig = nonStarterIds.join('|');
      const prev = activityWriteTs.get(accountId);
      if (prev && nowMs - prev.at < 45000 && prev.sig === sig) {
        return;
      }
      activityWriteTs.set(accountId, { at: nowMs, sig });
      const nowIso = new Date(nowMs).toISOString();
      if (!isSupabaseConfigured(env)) {
        if (!fallbackStore) return;
        await fallbackStore.change((users) => {
          const user = users.find((u) => u.id === accountId);
          if (user) {
            user.lastSeenAt = nowIso;
            user.sessionIds = [...new Set([...(user.sessionIds || []), ...nonStarterIds])].slice(0, 10000);
          }
        });
        return;
      }
      try {
        const patchBody = { last_seen_at: nowIso };
        if (nonStarterIds.length > 0) {
          const cached = userByIdCache.get(accountId)?.user;
          patchBody.session_ids = [
            ...new Set([...(cached?.sessionIds || []), ...nonStarterIds]),
          ].slice(0, 10000);
        }
        await supabaseRestRequest(
          `platform_users?id=eq.${encodeURIComponent(accountId)}`,
          {
            method: 'PATCH',
            prefer: 'return=minimal',
            body: patchBody,
            env,
            request,
          }
        );
      } catch {
        // ignore transient activity heartbeat errors
      }
    },
    async read() {
      if (!isSupabaseConfigured(env)) {
        return fallbackStore ? fallbackStore.read() : [];
      }
      const nowMs = Date.now();
      if (cachedAdminUsers && nowMs - cachedAdminUsersAt < 5000) {
        return cachedAdminUsers;
      }
      if (inflightAdminRead) {
        return inflightAdminRead;
      }
      inflightAdminRead = (async () => {
        try {
          const users = await readFromSupabase();
          const enriched = await enrichUsersWithSupabaseActivity(users);
          cachedAdminUsers = enriched;
          cachedAdminUsersAt = Date.now();
          return enriched;
        } catch (err) {
          if (fallbackStore && (err.code === 'PGRST205' || err.status === 404)) {
            return fallbackStore.read();
          }
          throw err;
        } finally {
          inflightAdminRead = null;
        }
      })();
      return inflightAdminRead;
    },
    async change(operation) {
      if (!isSupabaseConfigured(env)) {
        if (!fallbackStore) throw new Error('Account store is not configured');
        return fallbackStore.change(operation);
      }
      try {
        const users = await readFromSupabase();
        const beforeSnapshot = new Map(
          users.map((u) => [u.email, JSON.stringify(userToRow(u))])
        );
        const result = await operation(users);
        const changedRows = users
          .filter((u) => beforeSnapshot.get(u.email) !== JSON.stringify(userToRow(u)))
          .map(userToRow);

        if (changedRows.length > 0) {
          await supabaseRestRequest('platform_users?on_conflict=email', {
            method: 'POST',
            prefer: 'resolution=merge-duplicates,return=minimal',
            body: changedRows,
            env,
            request,
          });
          cachedAdminUsers = null;
          userByIdCache.clear();
        }
        return result;
      } catch (err) {
        if (fallbackStore && (err.code === 'PGRST205' || err.status === 404)) {
          return fallbackStore.change(operation);
        }
        throw err;
      }
    },
    async recordPresence(visitorId, userId, nowMs = Date.now()) {
      if (!isSupabaseConfigured(env)) return false;
      const cacheKey = `${visitorId}:${userId || ''}`;
      const lastWrite = presenceWriteTs.get(cacheKey) || 0;
      if (nowMs - lastWrite < 45000) return true;
      presenceWriteTs.set(cacheKey, nowMs);
      if (presenceWriteTs.size > 10000) {
        const cutoff = nowMs - 180000;
        for (const [k, t] of presenceWriteTs) {
          if (t < cutoff) presenceWriteTs.delete(k);
        }
      }
      try {
        await supabaseRestRequest('visitor_presence?on_conflict=visitor_id', {
          method: 'POST',
          prefer: 'resolution=merge-duplicates,return=minimal',
          body: {
            visitor_id: visitorId,
            user_id: userId || null,
            last_seen_at: new Date(nowMs).toISOString(),
          },
          env,
          request,
        });
        return true;
      } catch {
        return false;
      }
    },
    async config() {
      let localCfg = null;
      if (fallbackStore) {
        try {
          localCfg = await fallbackStore.config();
        } catch {
          localCfg = null;
        }
      }
      if (localCfg?.email && localCfg?.passwordHash && localCfg?.sessionSecret) {
        return localCfg;
      }
      const cfg = resolveSupabaseConfig(env);
      if (!cfg) {
        throw new Error('Administrator configuration not found');
      }
      const derivedSecret =
        env.ADMIN_SESSION_SECRET ||
        createHmac('sha256', cfg.apiKey)
          .update(`chart-replay-session:${cfg.projectId}`)
          .digest('hex');
      return {
        email: env.ADMIN_EMAIL || localCfg?.email || '',
        passwordHash: env.ADMIN_PASSWORD_HASH || localCfg?.passwordHash || '',
        sessionSecret: derivedSecret,
        userAuthEnabled: true,
      };
    },
    async readSponsorship() {
      const nowMs = Date.now();
      if (cachedSponsorship && nowMs - cachedSponsorshipAt < 15000) {
        return cachedSponsorship;
      }
      if (isSupabaseConfigured(env)) {
        try {
          const remote = await readSupabaseSponsorship({ env, request });
          if (remote) {
            cachedSponsorship = remote;
            cachedSponsorshipAt = nowMs;
            return remote;
          }
        } catch {
          // Fall back to local store if remote table is not yet initialized
        }
      }
      if (fallbackStore && typeof fallbackStore.readSponsorship === 'function') {
        const fallback = await fallbackStore.readSponsorship();
        if (fallback) {
          cachedSponsorship = fallback;
          cachedSponsorshipAt = nowMs;
        }
        return fallback;
      }
      return null;
    },
    async saveSponsorship(sponsorship) {
      let savedRemote = null;
      if (isSupabaseConfigured(env)) {
        try {
          savedRemote = await saveSupabaseSponsorship(sponsorship, {
            env,
            request,
          });
        } catch (err) {
          if (
            !fallbackStore ||
            typeof fallbackStore.saveSponsorship !== 'function'
          ) {
            throw err;
          }
        }
      }
      if (fallbackStore && typeof fallbackStore.saveSponsorship === 'function') {
        try {
          await fallbackStore.saveSponsorship(sponsorship);
        } catch {
          // ignore local fallback write error when remote succeeded
        }
      }
      const finalSaved = savedRemote || sponsorship;
      cachedSponsorship = finalSaved;
      cachedSponsorshipAt = Date.now();
      return finalSaved;
    },
  };
}

const SPONSORSHIP_FALLBACK_PROFILE_ID = '__platform_sponsorship_v1__';
const SPONSORSHIP_FALLBACK_EMAIL = 'admin@chartreplay.co.za';

function mapSponsorshipRow(row) {
  if (!row || typeof row !== 'object') return null;
  const enabledVal =
    typeof row.enabled === 'boolean'
      ? row.enabled
      : typeof row.rules_data?.enabled === 'boolean'
      ? row.rules_data.enabled
      : true;
  const src = row.rules_data && typeof row.rules_data === 'object' ? row.rules_data : row;
  return {
    enabled: enabledVal,
    sponsorName: src.sponsorName || src.sponsor_name || 'XM',
    badgeText: src.badgeText || src.badge_text || 'Official Session Partner',
    headlinePrefix:
      src.headlinePrefix ||
      src.headline_prefix ||
      "Today's session is sponsored by",
    subtext: src.subtext || 'Preparing your chart workspace for',
    footerLeftText:
      src.footerLeftText ||
      src.footer_left_text ||
      'Loading candles & analysis tools…',
    footerRightText:
      src.footerRightText ||
      src.footer_right_text ||
      'Click anywhere to skip',
    accentColor: src.accentColor || src.accent_color || '#e11d24',
    logoLightUrl: src.logoLightUrl || src.logo_light_url || '/xm-logo-light.png',
    logoDarkUrl: src.logoDarkUrl || src.logo_dark_url || '/xm-logo-dark.png',
    updatedBy: src.updatedBy || src.updated_by || 'admin',
    updatedAt: src.updatedAt || src.updated_at || row.updated_at || new Date().toISOString(),
  };
}

export async function readSupabaseSponsorship({
  env = process.env,
  request = fetch,
} = {}) {
  try {
    const rows = await supabaseRestRequest(
      'platform_sponsorship?id=eq.active&select=*&limit=1',
      { method: 'GET', env, request }
    );
    if (Array.isArray(rows) && rows.length > 0 && rows[0]) {
      return mapSponsorshipRow(rows[0]);
    }
  } catch (err) {
    if (err.code !== 'PGRST205' && err.status !== 404) {
      throw err;
    }
  }

  // Fallback to custom_rule_profiles when platform_sponsorship table is not yet created in Supabase
  try {
    const fallbackRows = await supabaseRestRequest(
      `custom_rule_profiles?user_email=eq.${encodeURIComponent(
        SPONSORSHIP_FALLBACK_EMAIL
      )}&id=eq.${SPONSORSHIP_FALLBACK_PROFILE_ID}&select=rules_data,updated_at&limit=1`,
      { method: 'GET', env, request }
    );
    if (Array.isArray(fallbackRows) && fallbackRows.length > 0 && fallbackRows[0]?.rules_data) {
      return mapSponsorshipRow(fallbackRows[0]);
    }
  } catch {
    // ignore
  }
  return null;
}

export async function saveSupabaseSponsorship(
  sponsorship,
  { env = process.env, request = fetch } = {}
) {
  const updatedAt = sponsorship.updatedAt || new Date().toISOString();
  const normalized = {
    ...sponsorship,
    enabled: sponsorship.enabled !== false,
    updatedAt,
  };
  let savedPrimary = false;
  try {
    await supabaseRestRequest('platform_sponsorship?on_conflict=id', {
      method: 'POST',
      prefer: 'resolution=merge-duplicates,return=minimal',
      body: {
        id: 'active',
        enabled: normalized.enabled,
        sponsor_name: normalized.sponsorName,
        badge_text: normalized.badgeText,
        headline_prefix: normalized.headlinePrefix,
        subtext: normalized.subtext,
        footer_left_text: normalized.footerLeftText,
        footer_right_text: normalized.footerRightText,
        accent_color: normalized.accentColor,
        logo_light_url: normalized.logoLightUrl,
        logo_dark_url: normalized.logoDarkUrl,
        updated_by: normalized.updatedBy || 'admin',
        updated_at: updatedAt,
      },
      env,
      request,
    });
    savedPrimary = true;
  } catch (err) {
    if (err.code !== 'PGRST205' && err.status !== 404) {
      throw err;
    }
  }

  // Also persist to custom_rule_profiles fallback so Supabase cloud persistence works even if platform_sponsorship migration hasn't run
  try {
    await supabaseRestRequest('custom_rule_profiles?on_conflict=user_email,id', {
      method: 'POST',
      prefer: 'resolution=merge-duplicates,return=minimal',
      body: {
        id: SPONSORSHIP_FALLBACK_PROFILE_ID,
        user_email: SPONSORSHIP_FALLBACK_EMAIL,
        name: SPONSORSHIP_FALLBACK_PROFILE_ID,
        description: 'Platform chart sponsorship configuration',
        rules_data: normalized,
        created_at: updatedAt,
      },
      env,
      request,
    });
  } catch (fallbackErr) {
    if (!savedPrimary) throw fallbackErr;
  }

  return normalized;
}

export async function saveSupabaseWaitlist(
  entry,
  { env = process.env, request = fetch } = {}
) {
  await supabaseRestRequest('waitlist_entries?on_conflict=email', {
    method: 'POST',
    prefer: 'resolution=ignore-duplicates,return=minimal',
    body: {
      email: entry.email,
      name: entry.name,
      consent: entry.consent === true,
      consent_version: entry.consentVersion || 'launch-updates-v1',
      source: entry.source || 'coming-soon',
      joined_at: entry.joinedAt || new Date().toISOString(),
    },
    env,
    request,
  });
}

export async function readSupabaseWaitlist({
  env = process.env,
  request = fetch,
} = {}) {
  const rows = await supabaseRestRequest(
    'waitlist_entries?select=name,email,joined_at,consent,consent_version,source&order=joined_at.desc',
    { method: 'GET', env, request }
  );
  if (!Array.isArray(rows)) return [];
  return rows
    .filter(
      (row) =>
        row &&
        typeof row.email === 'string' &&
        Number.isFinite(Date.parse(row.joined_at))
    )
    .map((row) => ({
      name: typeof row.name === 'string' ? row.name : '',
      email: row.email,
      joinedAt: row.joined_at,
      consent: row.consent === true,
      consentVersion: row.consent_version || null,
    }));
}
