-- =============================================================================
-- Chart Replay Platform — Supabase PostgreSQL Schema (No Supabase Auth)
-- Project ID: vkbrwjrenkmysqlwypoc
-- REST Endpoint: https://vkbrwjrenkmysqlwypoc.supabase.co/rest/v1/
--
-- Instructions:
-- 1. Open your Supabase Dashboard -> SQL Editor -> New Query
-- 2. Paste this entire file and click "Run"
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- -----------------------------------------------------------------------------
-- Automatic updated_at trigger helper
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- -----------------------------------------------------------------------------
-- 1. Platform Users (Custom / Non-Supabase Auth Accounts)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.platform_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL CHECK (char_length(trim(name)) BETWEEN 1 AND 80),
  email TEXT NOT NULL UNIQUE CHECK (char_length(trim(email)) BETWEEN 3 AND 254),
  password_hash TEXT NOT NULL DEFAULT '',
  auth_source TEXT NOT NULL DEFAULT 'server' CHECK (auth_source IN ('server', 'local', 'custom')),
  plan TEXT NOT NULL DEFAULT 'FREE_FOREVER',
  login_count INTEGER NOT NULL DEFAULT 1 CHECK (login_count >= 0),
  last_login_at TIMESTAMPTZ DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ DEFAULT NOW(),
  session_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_platform_users_email ON public.platform_users (lower(email));
CREATE INDEX IF NOT EXISTS idx_platform_users_joined_at ON public.platform_users (joined_at DESC);
CREATE INDEX IF NOT EXISTS idx_platform_users_last_seen_at ON public.platform_users (last_seen_at DESC);

DROP TRIGGER IF EXISTS trg_platform_users_updated_at ON public.platform_users;
CREATE TRIGGER trg_platform_users_updated_at
  BEFORE UPDATE ON public.platform_users
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 2. Launch Waitlist Entries
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.waitlist_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE CHECK (char_length(trim(email)) BETWEEN 3 AND 254),
  name TEXT NOT NULL CHECK (char_length(trim(name)) BETWEEN 1 AND 80),
  consent BOOLEAN NOT NULL DEFAULT TRUE,
  consent_version TEXT DEFAULT 'launch-updates-v1',
  source TEXT NOT NULL DEFAULT 'coming-soon',
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_waitlist_entries_joined_at ON public.waitlist_entries (joined_at DESC);

-- -----------------------------------------------------------------------------
-- 3. Online Visitor & Account Presence (Heartbeats)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.visitor_presence (
  visitor_id UUID PRIMARY KEY,
  user_id UUID REFERENCES public.platform_users(id) ON DELETE SET NULL,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_visitor_presence_last_seen_at ON public.visitor_presence (last_seen_at DESC);
CREATE INDEX IF NOT EXISTS idx_visitor_presence_user_id ON public.visitor_presence (user_id);

-- -----------------------------------------------------------------------------
-- 4. Trading Sessions (Backtesting, Prop Firm Challenges & Live Paper)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.trading_sessions (
  id TEXT NOT NULL,
  user_email TEXT NOT NULL,
  user_id UUID REFERENCES public.platform_users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  mode TEXT NOT NULL DEFAULT 'BACKTESTING' CHECK (mode IN ('BACKTESTING', 'PROP_FIRM', 'LIVE_PAPER')),
  active_asset TEXT NOT NULL DEFAULT 'XAUUSD',
  active_timeframe TEXT NOT NULL DEFAULT '15m',
  starting_balance NUMERIC(15, 2) NOT NULL DEFAULT 100000,
  account_currency TEXT NOT NULL DEFAULT 'USD',
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  realized_pnl NUMERIC(15, 2) NOT NULL DEFAULT 0,
  session_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_email, id)
);

CREATE INDEX IF NOT EXISTS idx_trading_sessions_user_email ON public.trading_sessions (lower(user_email));
CREATE INDEX IF NOT EXISTS idx_trading_sessions_user_id ON public.trading_sessions (user_id);
CREATE INDEX IF NOT EXISTS idx_trading_sessions_updated_at ON public.trading_sessions (updated_at DESC);

DROP TRIGGER IF EXISTS trg_trading_sessions_updated_at ON public.trading_sessions;
CREATE TRIGGER trg_trading_sessions_updated_at
  BEFORE UPDATE ON public.trading_sessions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 5. User Trading Strategies
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_strategies (
  id TEXT NOT NULL,
  user_email TEXT NOT NULL,
  user_id UUID REFERENCES public.platform_users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  default_checklist JSONB NOT NULL DEFAULT '[]'::jsonb,
  setup_tags JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_email, id)
);

CREATE INDEX IF NOT EXISTS idx_user_strategies_user_email ON public.user_strategies (lower(user_email));

DROP TRIGGER IF EXISTS trg_user_strategies_updated_at ON public.user_strategies;
CREATE TRIGGER trg_user_strategies_updated_at
  BEFORE UPDATE ON public.user_strategies
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 6. User Strategy Notes (Workspace Notepad)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_strategy_notes (
  user_email TEXT PRIMARY KEY,
  user_id UUID REFERENCES public.platform_users(id) ON DELETE CASCADE,
  notes_text TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_user_strategy_notes_updated_at ON public.user_strategy_notes;
CREATE TRIGGER trg_user_strategy_notes_updated_at
  BEFORE UPDATE ON public.user_strategy_notes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 7. Custom Prop-Firm Rule Profiles
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.custom_rule_profiles (
  id TEXT NOT NULL,
  user_email TEXT NOT NULL,
  user_id UUID REFERENCES public.platform_users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  rules_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_email, id)
);

CREATE INDEX IF NOT EXISTS idx_custom_rule_profiles_user_email ON public.custom_rule_profiles (lower(user_email));

DROP TRIGGER IF EXISTS trg_custom_rule_profiles_updated_at ON public.custom_rule_profiles;
CREATE TRIGGER trg_custom_rule_profiles_updated_at
  BEFORE UPDATE ON public.custom_rule_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 8. Platform Chart Sponsorship Settings (Managed in Administrator Dashboard)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.platform_sponsorship (
  id TEXT PRIMARY KEY DEFAULT 'active' CHECK (id = 'active'),
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  sponsor_name TEXT NOT NULL DEFAULT 'XM' CHECK (char_length(trim(sponsor_name)) BETWEEN 1 AND 80),
  badge_text TEXT NOT NULL DEFAULT 'Official Session Partner' CHECK (char_length(trim(badge_text)) BETWEEN 1 AND 80),
  headline_prefix TEXT NOT NULL DEFAULT 'Today''s session is sponsored by' CHECK (char_length(trim(headline_prefix)) BETWEEN 1 AND 140),
  subtext TEXT NOT NULL DEFAULT 'Preparing your chart workspace for' CHECK (char_length(trim(subtext)) BETWEEN 1 AND 160),
  footer_left_text TEXT NOT NULL DEFAULT 'Loading candles & analysis tools…' CHECK (char_length(trim(footer_left_text)) BETWEEN 1 AND 100),
  footer_right_text TEXT NOT NULL DEFAULT 'Click anywhere to skip' CHECK (char_length(trim(footer_right_text)) BETWEEN 1 AND 100),
  accent_color TEXT NOT NULL DEFAULT '#e11d24' CHECK (accent_color ~ '^#[0-9a-fA-F]{6}$'),
  logo_light_url TEXT NOT NULL DEFAULT '/xm-logo-light.png',
  logo_dark_url TEXT NOT NULL DEFAULT '/xm-logo-dark.png',
  updated_by TEXT NOT NULL DEFAULT 'admin',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.platform_sponsorship (
  id, enabled, sponsor_name, badge_text, headline_prefix, subtext,
  footer_left_text, footer_right_text, accent_color, logo_light_url, logo_dark_url
) VALUES (
  'active', TRUE, 'XM', 'Official Session Partner',
  'Today''s session is sponsored by', 'Preparing your chart workspace for',
  'Loading candles & analysis tools…', 'Click anywhere to skip',
  '#e11d24', '/xm-logo-light.png', '/xm-logo-dark.png'
) ON CONFLICT (id) DO NOTHING;

DROP TRIGGER IF EXISTS trg_platform_sponsorship_updated_at ON public.platform_sponsorship;
CREATE TRIGGER trg_platform_sponsorship_updated_at
  BEFORE UPDATE ON public.platform_sponsorship
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 9. Trader Platform Feedback & Star Ratings (Saved from Feedback Link)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.platform_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.platform_users(id) ON DELETE SET NULL,
  user_email TEXT NOT NULL,
  user_name TEXT NOT NULL DEFAULT 'Trader',
  rating_user_friendliness INTEGER NOT NULL CHECK (rating_user_friendliness BETWEEN 1 AND 5),
  rating_charts INTEGER NOT NULL CHECK (rating_charts BETWEEN 1 AND 5),
  rating_smoothness INTEGER NOT NULL CHECK (rating_smoothness BETWEEN 1 AND 5),
  overall_rating NUMERIC(3, 2) NOT NULL DEFAULT 5.00,
  improvements_text TEXT NOT NULL DEFAULT '',
  favorite_text TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL DEFAULT 'email_link',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_platform_feedback_user_email ON public.platform_feedback (lower(user_email));
CREATE INDEX IF NOT EXISTS idx_platform_feedback_created_at ON public.platform_feedback (created_at DESC);

-- -----------------------------------------------------------------------------
-- 10. Administrator First-Trade Feedback Email Logs
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.feedback_email_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email TEXT NOT NULL,
  user_name TEXT NOT NULL DEFAULT 'Trader',
  sent_by TEXT NOT NULL DEFAULT 'admin',
  delivery_status TEXT NOT NULL DEFAULT 'sent',
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_feedback_email_logs_user_email ON public.feedback_email_logs (lower(user_email));
CREATE INDEX IF NOT EXISTS idx_feedback_email_logs_sent_at ON public.feedback_email_logs (sent_at DESC);

-- -----------------------------------------------------------------------------
-- Row Level Security (RLS) & Table Grants (Configured for Custom Auth / Anon Key)
-- -----------------------------------------------------------------------------
ALTER TABLE public.platform_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.waitlist_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visitor_presence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trading_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_strategies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_strategy_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_rule_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_sponsorship ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedback_email_logs ENABLE ROW LEVEL SECURITY;

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;

-- Policies allowing REST API operations using the project's anon/service key
-- while Supabase Auth is disabled in favor of custom platform authentication.
DROP POLICY IF EXISTS "platform_users_api_access" ON public.platform_users;
CREATE POLICY "platform_users_api_access"
  ON public.platform_users
  FOR ALL
  TO anon, authenticated, service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "waitlist_entries_api_access" ON public.waitlist_entries;
CREATE POLICY "waitlist_entries_api_access"
  ON public.waitlist_entries
  FOR ALL
  TO anon, authenticated, service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "visitor_presence_api_access" ON public.visitor_presence;
CREATE POLICY "visitor_presence_api_access"
  ON public.visitor_presence
  FOR ALL
  TO anon, authenticated, service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "trading_sessions_api_access" ON public.trading_sessions;
CREATE POLICY "trading_sessions_api_access"
  ON public.trading_sessions
  FOR ALL
  TO anon, authenticated, service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "user_strategies_api_access" ON public.user_strategies;
CREATE POLICY "user_strategies_api_access"
  ON public.user_strategies
  FOR ALL
  TO anon, authenticated, service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "user_strategy_notes_api_access" ON public.user_strategy_notes;
CREATE POLICY "user_strategy_notes_api_access"
  ON public.user_strategy_notes
  FOR ALL
  TO anon, authenticated, service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "custom_rule_profiles_api_access" ON public.custom_rule_profiles;
CREATE POLICY "custom_rule_profiles_api_access"
  ON public.custom_rule_profiles
  FOR ALL
  TO anon, authenticated, service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "platform_sponsorship_api_access" ON public.platform_sponsorship;
CREATE POLICY "platform_sponsorship_api_access"
  ON public.platform_sponsorship
  FOR ALL
  TO anon, authenticated, service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "platform_feedback_api_access" ON public.platform_feedback;
CREATE POLICY "platform_feedback_api_access"
  ON public.platform_feedback
  FOR ALL
  TO anon, authenticated, service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "feedback_email_logs_api_access" ON public.feedback_email_logs;
CREATE POLICY "feedback_email_logs_api_access"
  ON public.feedback_email_logs
  FOR ALL
  TO anon, authenticated, service_role
  USING (true)
  WITH CHECK (true);

-- Refresh PostgREST schema cache immediately
NOTIFY pgrst, 'reload schema';
