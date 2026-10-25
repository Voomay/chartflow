// Reproducible descriptive study of the local archive; no network or order execution.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import ts from 'typescript';
const root = path.resolve(process.argv[2] || 'market-data/archive/XAUUSD/5m');
const destination = process.argv[3] || 'docs/gold-hour-study.json';
const source = fs.readFileSync(new URL('../src/services/momentumPullback.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ES2020, target: ts.ScriptTarget.ES2020 } }).outputText;
const { computeMomentumPullback, MOMENTUM_DEFAULTS } = await import('data:text/javascript;base64,' + Buffer.from(compiled).toString('base64'));
const groups = Object.fromEntries(['2015-2020', '2021-2025', '2025'].map(k => [k, Array.from({ length: 24 }, () => [])]));
let bars = 0, volumeBars = 0, first = Infinity, last = 0, setups2025 = null;
for (const filename of fs.readdirSync(root).filter(n => /^20[0-9]{2}\.json\.gz$/.test(n)).sort()) {
  const year = Number(filename.slice(0, 4)); if (year < 2015 || year > 2025) continue;
  const rows = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(root, filename))));
  bars += rows.length; volumeBars += rows.filter(b => b[5] > 0).length;
  first = Math.min(first, rows[0][0]); last = Math.max(last, rows[rows.length - 1][0]);
  const hours = new Map(); for (const b of rows) { const key = Math.floor(b[0] / 3600); const group = hours.get(key) || []; group.push(b); hours.set(key, group); }
  for (const [stamp, hour] of hours) {
    if (hour.length !== 12 || hour[0][0] % 3600 || hour.some((b, i) => i && b[0] - hour[i - 1][0] !== 300)) continue;
    const span = Math.max(...hour.map(b => b[2])) - Math.min(...hour.map(b => b[3]));
    const observation = { rangePct: 100 * span / hour[0][1], directional: span > 0 && Math.abs(hour[11][4] - hour[0][1]) / span >= .6 };
    const keys = [year <= 2020 ? '2015-2020' : '2021-2025', ...(year === 2025 ? ['2025'] : [])];
    for (const key of keys) groups[key][(stamp + 2) % 24].push(observation);
  }
  if (year === 2025) {
    const candles = rows.map(([time, open, high, low, close, volume]) => ({ time, open, high, low, close, volume }));
    setups2025 = { priceOnlyAllSessions: computeMomentumPullback(candles, 300, { ...MOMENTUM_DEFAULTS, requireVolume: false }).setups.length, priceOnlyNewYork: computeMomentumPullback(candles, 300, { ...MOMENTUM_DEFAULTS, requireVolume: false, session: 'newyork' }).setups.length, volumeRequired: computeMomentumPullback(candles, 300).setups.length, note: 'Counts only. Not a profitability backtest. No volume in this source. Final developing bar excluded.' };
  }
}
const periods = Object.fromEntries(Object.entries(groups).map(([key, hours]) => [key, hours.map((values, hour) => { const ranges = values.map(b => b.rangePct).sort((a, b) => a - b), n = ranges.length; return { hour, hours: n, medianRangePct: n ? Number(((ranges[Math.floor((n - 1) / 2)] + ranges[Math.floor(n / 2)]) / 2).toFixed(4)) : 0, directionalPct: n ? Number((100 * values.filter(b => b.directional).length / n).toFixed(1)) : 0 }; }).filter(b => b.hours).sort((a, b) => b.medianRangePct - a.medianRangePct)]));
const result = { source: 'Local HistData XAUUSD bid archive; UTC-normalized; volume not supplied', timeZone: 'Africa/Johannesburg (UTC+02:00)', method: 'Complete contiguous 12x5m hours only. Median hourly high-low/open (%). Directional hour: abs(close-open)/(high-low)>=0.60. Descriptive; no strategy returns, spread or fees.', counts: { bars, volumeBars }, first, last, periods, setups2025 };
fs.writeFileSync(destination, JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ bars, topHours: Object.fromEntries(Object.entries(periods).map(([k, v]) => [k, v.slice(0, 5)])), setups2025 }, null, 2));
