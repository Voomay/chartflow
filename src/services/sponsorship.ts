import { platformRequest } from './platformAccounts';
import {
  fetchSponsorshipFromSupabase,
  syncSponsorshipToSupabase,
} from './supabaseClient';

export interface SponsorshipConfig {
  enabled: boolean;
  sponsorName: string;
  badgeText: string;
  headlinePrefix: string;
  subtext: string;
  footerLeftText: string;
  footerRightText: string;
  accentColor: string;
  logoLightUrl: string;
  logoDarkUrl: string;
  updatedAt?: string;
  updatedBy?: string;
}

export const DEFAULT_SPONSORSHIP_CONFIG: SponsorshipConfig = {
  enabled: true,
  sponsorName: 'XM',
  badgeText: 'Official Session Partner',
  headlinePrefix: "Today's session is sponsored by",
  subtext: 'Preparing your chart workspace for',
  footerLeftText: 'Loading candles & analysis tools…',
  footerRightText: 'Click anywhere to skip',
  accentColor: '#e11d24',
  logoLightUrl: '/xm-logo-light.png',
  logoDarkUrl: '/xm-logo-dark.png',
};

const SPONSORSHIP_CACHE_KEY = 'chart_replay_sponsorship_v1';
let memorySponsorship: SponsorshipConfig | null = null;
const listeners = new Set<(config: SponsorshipConfig) => void>();

const SAFE_DATA_IMAGE_RE =
  /^data:image\/(?:png|jpeg|jpg|webp|gif);base64,[A-Za-z0-9+/=\s]+$/i;

export function isSafeLogoUrl(url: unknown): boolean {
  if (typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (!trimmed || trimmed.length > 750_000) return false;
  if (trimmed.startsWith('/')) {
    return !trimmed.startsWith('//') && !/[\x00-\x1f"<>\s]/.test(trimmed);
  }
  if (SAFE_DATA_IMAGE_RE.test(trimmed)) {
    return true;
  }
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

export function sanitizeText(
  value: unknown,
  fallback: string,
  maxLength = 120
): string {
  if (typeof value !== 'string') return fallback;
  const cleaned = value.replace(/[\x00-\x1f\x7f]/g, '').trim();
  if (!cleaned) return fallback;
  return cleaned.slice(0, maxLength);
}

export function sanitizeAccentColor(value: unknown, fallback = '#e11d24'): string {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  return /^#[0-9a-fA-F]{6}$/.test(trimmed) ? trimmed.toLowerCase() : fallback;
}

export function normalizeSponsorshipConfig(
  raw?: Partial<SponsorshipConfig> | null
): SponsorshipConfig {
  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_SPONSORSHIP_CONFIG };
  }
  const logoLight = isSafeLogoUrl(raw.logoLightUrl)
    ? raw.logoLightUrl!.trim()
    : DEFAULT_SPONSORSHIP_CONFIG.logoLightUrl;
  const logoDark = isSafeLogoUrl(raw.logoDarkUrl)
    ? raw.logoDarkUrl!.trim()
    : isSafeLogoUrl(raw.logoLightUrl)
    ? raw.logoLightUrl!.trim()
    : DEFAULT_SPONSORSHIP_CONFIG.logoDarkUrl;

  return {
    enabled: typeof raw.enabled === 'boolean' ? raw.enabled : true,
    sponsorName: sanitizeText(
      raw.sponsorName,
      DEFAULT_SPONSORSHIP_CONFIG.sponsorName,
      80
    ),
    badgeText: sanitizeText(
      raw.badgeText,
      DEFAULT_SPONSORSHIP_CONFIG.badgeText,
      80
    ),
    headlinePrefix: sanitizeText(
      raw.headlinePrefix,
      DEFAULT_SPONSORSHIP_CONFIG.headlinePrefix,
      140
    ),
    subtext: sanitizeText(
      raw.subtext,
      DEFAULT_SPONSORSHIP_CONFIG.subtext,
      160
    ),
    footerLeftText: sanitizeText(
      raw.footerLeftText,
      DEFAULT_SPONSORSHIP_CONFIG.footerLeftText,
      100
    ),
    footerRightText: sanitizeText(
      raw.footerRightText,
      DEFAULT_SPONSORSHIP_CONFIG.footerRightText,
      100
    ),
    accentColor: sanitizeAccentColor(
      raw.accentColor,
      DEFAULT_SPONSORSHIP_CONFIG.accentColor
    ),
    logoLightUrl: logoLight,
    logoDarkUrl: logoDark,
    updatedAt:
      typeof raw.updatedAt === 'string' && raw.updatedAt
        ? raw.updatedAt
        : undefined,
    updatedBy:
      typeof raw.updatedBy === 'string' && raw.updatedBy
        ? raw.updatedBy.slice(0, 120)
        : undefined,
  };
}

export function getCachedSponsorshipConfig(): SponsorshipConfig {
  if (memorySponsorship) return memorySponsorship;
  return { ...DEFAULT_SPONSORSHIP_CONFIG };
}

export function setCachedSponsorshipConfig(
  config: Partial<SponsorshipConfig>
): SponsorshipConfig {
  const normalized = normalizeSponsorshipConfig(config);
  memorySponsorship = normalized;
  listeners.forEach((listener) => listener(normalized));
  return normalized;
}

export function subscribeSponsorshipConfig(
  listener: (config: SponsorshipConfig) => void
): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export async function loadSponsorshipConfig(): Promise<SponsorshipConfig> {
  try {
    const res = await platformRequest('sponsorship');
    if (res?.ok && res.sponsorship) {
      return setCachedSponsorshipConfig(res.sponsorship);
    }
  } catch {
    // fallback to direct Supabase fetch or cached config
  }

  try {
    const remote = await fetchSponsorshipFromSupabase();
    if (remote) {
      return setCachedSponsorshipConfig(remote);
    }
  } catch {
    // ignore
  }

  return getCachedSponsorshipConfig();
}

export async function saveAdminSponsorshipConfig(
  config: Partial<SponsorshipConfig>,
  options: { preview?: boolean } = {}
): Promise<{
  ok: boolean;
  sponsorship: SponsorshipConfig;
  scope?: 'supabase' | 'localhost' | 'preview';
  error?: string;
}> {
  const normalized = normalizeSponsorshipConfig({
    ...config,
    updatedAt: new Date().toISOString(),
  });

  if (options.preview) {
    const saved = setCachedSponsorshipConfig(normalized);
    return { ok: true, sponsorship: saved, scope: 'preview' };
  }

  let serverOk = false;
  let serverScope: 'supabase' | 'localhost' | undefined;
  let serverError: string | undefined;
  let finalConfig = normalized;

  try {
    const result = await platformRequest('sponsorship', {
      sponsorship: normalized,
    });
    if (result.ok && result.sponsorship) {
      serverOk = true;
      serverScope = result.scope === 'supabase' ? 'supabase' : 'localhost';
      finalConfig = normalizeSponsorshipConfig(result.sponsorship);
    } else if (!result.ok) {
      serverError = result.error || 'Unable to save sponsorship settings.';
    }
  } catch (err) {
    serverError =
      err instanceof Error ? err.message : 'Unable to reach platform server.';
  }

  // Also sync directly to Supabase PostgREST if configured on client
  const supabaseSaved = await syncSponsorshipToSupabase(finalConfig);
  if (supabaseSaved) {
    serverScope = 'supabase';
  }

  const cached = setCachedSponsorshipConfig(finalConfig);

  if (serverOk || supabaseSaved) {
    return {
      ok: true,
      sponsorship: cached,
      scope: serverScope || 'localhost',
    };
  }

  return {
    ok: false,
    sponsorship: cached,
    error: serverError || 'Unable to save sponsorship to database.',
  };
}
