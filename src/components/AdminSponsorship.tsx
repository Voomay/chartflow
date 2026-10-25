import React, { useEffect, useRef, useState } from 'react';
import {
  CheckCircle2,
  Database,
  Eye,
  Image as ImageIcon,
  Moon,
  RefreshCw,
  RotateCcw,
  Save,
  Sparkles,
  Sun,
  Upload,
} from 'lucide-react';
import {
  DEFAULT_SPONSORSHIP_CONFIG,
  getCachedSponsorshipConfig,
  isSafeLogoUrl,
  loadSponsorshipConfig,
  normalizeSponsorshipConfig,
  saveAdminSponsorshipConfig,
  SponsorshipConfig,
} from '../services/sponsorship';
import {
  ChartSponsorCardPreview,
  ChartSponsorLoader,
} from './ChartSponsorLoader';
import { ThemeMode } from '../types/trading';

const PRESET_COLORS = [
  { label: 'XM Red', value: '#e11d24' },
  { label: 'Emerald', value: '#10b981' },
  { label: 'Royal Blue', value: '#2962ff' },
  { label: 'Cyan', value: '#06b6d4' },
  { label: 'Amber Gold', value: '#f59e0b' },
  { label: 'Violet', value: '#8b5cf6' },
];

export function AdminSponsorship({
  preview,
  scope,
}: {
  preview: boolean;
  scope: 'supabase' | 'localhost';
}) {
  const [form, setForm] = useState<SponsorshipConfig>(() =>
    getCachedSponsorshipConfig()
  );
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const [previewTheme, setPreviewTheme] = useState<ThemeMode>('dark');
  const [fullscreenTestOpen, setFullscreenTestOpen] = useState(false);
  const [separateDarkLogo, setSeparateDarkLogo] = useState<boolean>(
    () =>
      form.logoDarkUrl !== form.logoLightUrl &&
      form.logoDarkUrl !== '/xm-logo-dark.png'
  );

  const primaryFileRef = useRef<HTMLInputElement>(null);
  const darkFileRef = useRef<HTMLInputElement>(null);

  const refreshFromServer = async () => {
    setLoading(true);
    setStatusMsg(null);
    try {
      const loaded = await loadSponsorshipConfig();
      setForm(loaded);
      setSeparateDarkLogo(
        loaded.logoDarkUrl !== loaded.logoLightUrl &&
          !(
            loaded.logoLightUrl === '/xm-logo-light.png' &&
            loaded.logoDarkUrl === '/xm-logo-dark.png'
          )
      );
    } catch {
      setStatusMsg({
        type: 'error',
        text: 'Could not load remote sponsorship settings.',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refreshFromServer();
  }, []);

  const handleFileUpload = (
    event: React.ChangeEvent<HTMLInputElement>,
    target: 'both' | 'light' | 'dark'
  ) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    if (!/^image\/(png|jpeg|jpg|webp|gif)$/i.test(file.type)) {
      setStatusMsg({
        type: 'error',
        text: 'Please upload a valid PNG, JPG, WebP, or GIF logo image.',
      });
      return;
    }

    if (file.size > 480 * 1024) {
      setStatusMsg({
        type: 'error',
        text: 'Logo file is too large (max 480 KB). Please use a smaller PNG or WebP logo.',
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      if (!isSafeLogoUrl(result)) {
        setStatusMsg({
          type: 'error',
          text: 'Could not read image safely. Please try another PNG or WebP file.',
        });
        return;
      }
      setForm((prev) => {
        if (target === 'both') {
          return {
            ...prev,
            logoLightUrl: result,
            logoDarkUrl: result,
          };
        }
        if (target === 'light') {
          return { ...prev, logoLightUrl: result };
        }
        return { ...prev, logoDarkUrl: result };
      });
      setStatusMsg({
        type: 'success',
        text: `Logo "${file.name}" loaded into preview. Click "Save Sponsorship to Supabase" to publish.`,
      });
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setStatusMsg(null);

    const payload: SponsorshipConfig = normalizeSponsorshipConfig({
      ...form,
      logoDarkUrl: separateDarkLogo ? form.logoDarkUrl : form.logoLightUrl,
    });

    const result = await saveAdminSponsorshipConfig(payload, { preview });
    setForm(result.sponsorship);
    setSaving(false);

    if (result.ok) {
      setStatusMsg({
        type: 'success',
        text:
          result.scope === 'supabase' || scope === 'supabase'
            ? 'Sponsorship logo and wording saved to Supabase database and live on charts!'
            : preview
            ? 'Sponsorship saved in preview mode and updated on live chart loader!'
            : 'Sponsorship logo and wording saved to server database and live on charts!',
      });
    } else {
      setStatusMsg({
        type: 'error',
        text: result.error || 'Unable to save sponsorship settings.',
      });
    }
  };

  const handleResetDefault = async () => {
    setForm({ ...DEFAULT_SPONSORSHIP_CONFIG });
    setSeparateDarkLogo(false);
    setStatusMsg({
      type: 'success',
      text: 'Reset to default XM sponsorship in editor. Click Save to apply.',
    });
  };

  const previewConfig = normalizeSponsorshipConfig({
    ...form,
    logoDarkUrl: separateDarkLogo ? form.logoDarkUrl : form.logoLightUrl,
  });

  return (
    <section className="mt-6 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="inline-flex items-center gap-1.5 text-xs text-emerald-300 font-medium">
            <Database size={14} />
            {preview
              ? 'Preview · Connected to live chart loader'
              : scope === 'supabase'
              ? 'Supabase database · platform_sponsorship'
              : 'Server & Supabase sponsorship storage'}
          </p>
          <h2 className="mt-2 text-2xl font-semibold">
            Chart Sponsorship &amp; Partner Branding
          </h2>
          <p className="mt-1.5 text-sm text-slate-400">
            Customize the sponsor logo, badge, and wording shown when traders
            open the chart workspace. Changes save directly to your Supabase
            database.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => setFullscreenTestOpen(true)}
            className="flex items-center gap-2 rounded-xl border border-cyan-400/30 bg-cyan-400/10 px-4 py-2.5 text-xs font-semibold text-cyan-200 hover:bg-cyan-400/20 transition"
          >
            <Eye size={15} />
            Test Fullscreen Loader
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() => void refreshFromServer()}
            className="flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2.5 text-xs text-slate-300 hover:bg-white/5 transition"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Reload
          </button>
        </div>
      </div>

      {statusMsg && (
        <div
          role="status"
          className={`flex items-center gap-2.5 rounded-xl border p-4 text-xs sm:text-sm ${
            statusMsg.type === 'success'
              ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200'
              : 'border-rose-400/30 bg-rose-500/10 text-rose-200'
          }`}
        >
          <CheckCircle2 size={16} className="shrink-0" />
          <span>{statusMsg.text}</span>
        </div>
      )}

      <div className="grid xl:grid-cols-[1.2fr_1fr] gap-6 items-start">
        {/* LEFT COLUMN: Form Controls */}
        <form
          onSubmit={handleSave}
          className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 sm:p-7 space-y-6"
        >
          {/* Enable / Disable Toggle */}
          <div className="flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-black/20 p-4">
            <div>
              <h3 className="text-sm font-semibold text-white">
                Show Sponsorship Loader Before Charts Open
              </h3>
              <p className="mt-1 text-xs text-slate-400">
                Displays the branded sponsor screen for 1.8 seconds when a
                trader opens or switches chart sessions.
              </p>
            </div>
            <label className="relative inline-flex cursor-pointer items-center">
              <input
                type="checkbox"
                aria-label="Enable chart sponsorship loader"
                checked={form.enabled}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, enabled: e.target.checked }))
                }
                className="peer sr-only"
              />
              <div className="h-6 w-11 rounded-full bg-slate-700 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all peer-checked:bg-emerald-500 peer-checked:after:translate-x-full" />
            </label>
          </div>

          {/* Logo Upload Section */}
          <div className="space-y-4 border-t border-white/10 pt-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <ImageIcon size={16} className="text-emerald-400" />
                  Sponsor Logo
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Upload a transparent PNG, WebP, or JPG logo, or paste an image
                  URL.
                </p>
              </div>
              <label className="inline-flex items-center gap-2 text-xs text-slate-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={separateDarkLogo}
                  onChange={(e) => setSeparateDarkLogo(e.target.checked)}
                  className="rounded border-white/20 accent-emerald-400"
                />
                <span>Use separate dark/light logos</span>
              </label>
            </div>

            <input
              ref={primaryFileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="hidden"
              onChange={(e) =>
                handleFileUpload(e, separateDarkLogo ? 'light' : 'both')
              }
            />
            <input
              ref={darkFileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="hidden"
              onChange={(e) => handleFileUpload(e, 'dark')}
            />

            <div className="grid sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => primaryFileRef.current?.click()}
                className="flex items-center justify-center gap-2.5 rounded-xl border border-dashed border-emerald-400/40 bg-emerald-400/[0.06] hover:bg-emerald-400/15 px-4 py-3.5 text-xs font-semibold text-emerald-200 transition"
              >
                <Upload size={15} />
                <span>
                  {separateDarkLogo
                    ? 'Upload Light-Mode Logo'
                    : 'Upload New Sponsor Logo'}
                </span>
              </button>

              {separateDarkLogo && (
                <button
                  type="button"
                  onClick={() => darkFileRef.current?.click()}
                  className="flex items-center justify-center gap-2.5 rounded-xl border border-dashed border-cyan-400/40 bg-cyan-400/[0.06] hover:bg-cyan-400/15 px-4 py-3.5 text-xs font-semibold text-cyan-200 transition"
                >
                  <Upload size={15} />
                  <span>Upload Dark-Mode Logo</span>
                </button>
              )}
            </div>

            <div>
              <label
                htmlFor="sponsor-logo-url"
                className="block text-xs text-slate-400 mb-1.5"
              >
                {separateDarkLogo
                  ? 'Light-Mode Logo URL or Data URI'
                  : 'Sponsor Logo URL or Uploaded Image'}
              </label>
              <input
                id="sponsor-logo-url"
                type="text"
                value={form.logoLightUrl}
                onChange={(e) => {
                  const val = e.target.value;
                  setForm((prev) => ({
                    ...prev,
                    logoLightUrl: val,
                    ...(separateDarkLogo ? {} : { logoDarkUrl: val }),
                  }));
                }}
                placeholder="/xm-logo-light.png or https://..."
                className="w-full rounded-xl border border-white/10 bg-black/25 px-3.5 py-2.5 text-xs text-slate-200 outline-none focus:border-emerald-400/60"
              />
            </div>

            {separateDarkLogo && (
              <div>
                <label
                  htmlFor="sponsor-dark-logo-url"
                  className="block text-xs text-slate-400 mb-1.5"
                >
                  Dark-Mode Logo URL or Data URI
                </label>
                <input
                  id="sponsor-dark-logo-url"
                  type="text"
                  value={form.logoDarkUrl}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      logoDarkUrl: e.target.value,
                    }))
                  }
                  placeholder="/xm-logo-dark.png or https://..."
                  className="w-full rounded-xl border border-white/10 bg-black/25 px-3.5 py-2.5 text-xs text-slate-200 outline-none focus:border-emerald-400/60"
                />
              </div>
            )}
          </div>

          {/* Wording & Copy Section */}
          <div className="space-y-4 border-t border-white/10 pt-5">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Sparkles size={16} className="text-cyan-300" />
              Sponsorship Wording &amp; Copy
            </h3>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="sponsor-name"
                  className="block text-xs text-slate-400 mb-1.5"
                >
                  Sponsor Name (highlighted)
                </label>
                <input
                  id="sponsor-name"
                  type="text"
                  required
                  maxLength={80}
                  value={form.sponsorName}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      sponsorName: e.target.value,
                    }))
                  }
                  placeholder="XM"
                  className="w-full rounded-xl border border-white/10 bg-black/25 px-3.5 py-2.5 text-sm text-white outline-none focus:border-emerald-400/60"
                />
              </div>

              <div>
                <label
                  htmlFor="sponsor-badge"
                  className="block text-xs text-slate-400 mb-1.5"
                >
                  Top Pill Badge Text
                </label>
                <input
                  id="sponsor-badge"
                  type="text"
                  required
                  maxLength={80}
                  value={form.badgeText}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      badgeText: e.target.value,
                    }))
                  }
                  placeholder="Official Session Partner"
                  className="w-full rounded-xl border border-white/10 bg-black/25 px-3.5 py-2.5 text-sm text-white outline-none focus:border-emerald-400/60"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="sponsor-headline"
                className="block text-xs text-slate-400 mb-1.5"
              >
                Main Headline Wording (shown before Sponsor Name)
              </label>
              <input
                id="sponsor-headline"
                type="text"
                required
                maxLength={140}
                value={form.headlinePrefix}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    headlinePrefix: e.target.value,
                  }))
                }
                placeholder="Today's session is sponsored by"
                className="w-full rounded-xl border border-white/10 bg-black/25 px-3.5 py-2.5 text-sm text-white outline-none focus:border-emerald-400/60"
              />
            </div>

            <div>
              <label
                htmlFor="sponsor-subtext"
                className="block text-xs text-slate-400 mb-1.5"
              >
                Workspace Subtext (shown before Symbol &amp; Timeframe)
              </label>
              <input
                id="sponsor-subtext"
                type="text"
                required
                maxLength={160}
                value={form.subtext}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    subtext: e.target.value,
                  }))
                }
                placeholder="Preparing your chart workspace for"
                className="w-full rounded-xl border border-white/10 bg-black/25 px-3.5 py-2.5 text-sm text-white outline-none focus:border-emerald-400/60"
              />
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="sponsor-footer-left"
                  className="block text-xs text-slate-400 mb-1.5"
                >
                  Loading Caption (Bottom Left)
                </label>
                <input
                  id="sponsor-footer-left"
                  type="text"
                  maxLength={100}
                  value={form.footerLeftText}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      footerLeftText: e.target.value,
                    }))
                  }
                  className="w-full rounded-xl border border-white/10 bg-black/25 px-3.5 py-2.5 text-xs text-slate-200 outline-none focus:border-emerald-400/60"
                />
              </div>

              <div>
                <label
                  htmlFor="sponsor-footer-right"
                  className="block text-xs text-slate-400 mb-1.5"
                >
                  Skip Hint (Bottom Right)
                </label>
                <input
                  id="sponsor-footer-right"
                  type="text"
                  maxLength={100}
                  value={form.footerRightText}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      footerRightText: e.target.value,
                    }))
                  }
                  className="w-full rounded-xl border border-white/10 bg-black/25 px-3.5 py-2.5 text-xs text-slate-200 outline-none focus:border-emerald-400/60"
                />
              </div>
            </div>

            {/* Brand Accent Color */}
            <div>
              <label className="block text-xs text-slate-400 mb-2">
                Sponsor Brand Accent Color
              </label>
              <div className="flex flex-wrap items-center gap-2.5">
                <input
                  type="color"
                  aria-label="Custom brand accent color"
                  value={form.accentColor}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      accentColor: e.target.value,
                    }))
                  }
                  className="h-9 w-12 cursor-pointer rounded-lg border border-white/15 bg-black/30 p-1"
                />
                {PRESET_COLORS.map((preset) => (
                  <button
                    key={preset.value}
                    type="button"
                    onClick={() =>
                      setForm((prev) => ({
                        ...prev,
                        accentColor: preset.value,
                      }))
                    }
                    className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs transition ${
                      form.accentColor.toLowerCase() === preset.value
                        ? 'border-white/40 bg-white/10 text-white font-semibold'
                        : 'border-white/10 bg-black/20 text-slate-400 hover:text-white'
                    }`}
                  >
                    <span
                      style={{ backgroundColor: preset.value }}
                      className="h-2.5 w-2.5 rounded-full"
                    />
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-5">
            <button
              type="button"
              onClick={() => void handleResetDefault()}
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-3 text-xs font-medium text-slate-300 hover:bg-white/5 transition"
            >
              <RotateCcw size={14} />
              Reset to Default (XM)
            </button>

            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-400 to-cyan-400 px-6 py-3 text-xs sm:text-sm font-bold text-slate-950 shadow-lg hover:brightness-105 disabled:opacity-50 transition"
            >
              <Save size={16} />
              {saving ? 'Saving to Supabase…' : 'Save Sponsorship to Supabase'}
            </button>
          </div>
        </form>

        {/* RIGHT COLUMN: Live Interactive Card Preview */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-white">
                Live Chart Loader Preview
              </h3>
              <p className="text-xs text-slate-400">
                Exactly how traders see the sponsorship before the chart opens
              </p>
            </div>

            <div className="inline-flex rounded-xl border border-white/10 bg-black/30 p-1 text-xs">
              <button
                type="button"
                onClick={() => setPreviewTheme('dark')}
                className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 transition ${
                  previewTheme === 'dark'
                    ? 'bg-white/10 text-white font-semibold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Moon size={13} />
                Dark
              </button>
              <button
                type="button"
                onClick={() => setPreviewTheme('light')}
                className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 transition ${
                  previewTheme === 'light'
                    ? 'bg-white/10 text-white font-semibold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Sun size={13} />
                Light
              </button>
            </div>
          </div>

          <div
            className={`relative flex min-h-[380px] items-center justify-center overflow-hidden rounded-2xl border p-6 transition-colors ${
              previewTheme === 'light'
                ? 'border-slate-200 bg-[#f8f9fd] text-[#131722]'
                : 'border-white/10 bg-[#090c10] text-white'
            }`}
          >
            <div
              aria-hidden="true"
              style={{
                backgroundColor: previewConfig.accentColor,
                opacity: previewTheme === 'light' ? 0.1 : 0.18,
              }}
              className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-[240px] w-[340px] rounded-full blur-[90px]"
            />
            <ChartSponsorCardPreview
              config={previewConfig}
              symbol="XAUUSD"
              timeframe="15m"
              sessionName="London Session"
              theme={previewTheme}
              animateProgress={false}
            />
          </div>

          {form.updatedAt && (
            <p className="text-[11px] text-slate-500 text-right">
              Last saved:{' '}
              {new Intl.DateTimeFormat('en-ZA', {
                dateStyle: 'medium',
                timeStyle: 'short',
                timeZone: 'Africa/Johannesburg',
              }).format(new Date(form.updatedAt))}{' '}
              SAST
            </p>
          )}
        </div>
      </div>

      <ChartSponsorLoader
        open={fullscreenTestOpen}
        symbol="XAUUSD"
        timeframe="15m"
        sessionName="London Session"
        theme={previewTheme}
        configOverride={previewConfig}
        onComplete={() => setFullscreenTestOpen(false)}
      />
    </section>
  );
}
