const fs = require('node:fs');
const path = require('node:path');
const z = require('node:zlib');
const crypto = require('node:crypto');

const downloadsDir = process.argv[2] || 'C:/Users/Cheslin Gabriels/Downloads';
const marketDataRoot = process.argv[3] || 'd:/fx/market-data';
const rawDir = path.join(marketDataRoot, 'raw', 'evtradelabs');
const storeDir = path.join(marketDataRoot, 'archive');
const symbol = 'US30';
const sourceSymbol = 'USA30IDXUSD';

fs.mkdirSync(rawDir, { recursive: true });
fs.mkdirSync(storeDir, { recursive: true });

const sourceFiles = [
  'USA30IDXUSD_M1.csv',
  'USA30IDXUSD_M5.csv',
  'USA30IDXUSD_M15.csv',
  'USA30IDXUSD_M30.csv',
  'USA30IDXUSD_H1.csv',
  'USA30IDXUSD_H4.csv',
  'USA30IDXUSD_D1.csv',
];

for (const name of sourceFiles) {
  const srcPath = path.join(downloadsDir, name);
  const dstPath = path.join(rawDir, name);
  if (fs.existsSync(srcPath) && !fs.existsSync(dstPath)) {
    fs.copyFileSync(srcPath, dstPath);
    const bytes = fs.readFileSync(dstPath);
    fs.writeFileSync(
      dstPath + '.source.json',
      JSON.stringify(
        {
          provider: 'EV Trading Labs (Dukascopy feed)',
          symbol: 'US30',
          sourceSymbol,
          file: name,
          sha256: crypto.createHash('sha256').update(bytes).digest('hex'),
          bytes: bytes.length,
          timezone: 'UTC',
          priceBasis: 'bid',
          importedAt: new Date().toISOString(),
        },
        null,
        2
      )
    );
  }
}

function save(file, rows) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, z.gzipSync(JSON.stringify(rows), { level: 1 }));
}

const m1Path = path.join(rawDir, 'USA30IDXUSD_M1.csv');
const m1Bytes = fs.readFileSync(m1Path);
const m1Lines = m1Bytes.toString('utf8').trim().split(/\r?\n/);

const unique = new Map();
let invalid = 0;
let duplicates = 0;

for (let i = 1; i < m1Lines.length; i++) {
  const line = m1Lines[i].trim();
  if (!line) continue;
  const parts = line.split('\t');
  const stamp = Date.parse(parts[0].replace(' ', 'T') + 'Z') / 1000;
  const o = Number(parts[1]);
  const h = Number(parts[2]);
  const l = Number(parts[3]);
  const c = Number(parts[4]);
  const v = Number(parts[5]);
  if (
    !Number.isFinite(stamp) ||
    stamp % 60 ||
    ![o, h, l, c, v].every(Number.isFinite) ||
    Math.min(o, h, l, c) <= 0 ||
    h < Math.max(o, c) ||
    l > Math.min(o, c) ||
    h < l ||
    v < 0
  ) {
    invalid++;
    continue;
  }
  if (unique.has(stamp)) duplicates++;
  unique.set(stamp, [stamp, o, h, l, c, v]);
}

if (!unique.size || invalid > 0) {
  throw new Error(`US30 M1 validation failed: rows=${unique.size}, invalid=${invalid}`);
}

const bars = [...unique.values()].sort((a, b) => a[0] - b[0]);
const steps = { '5m': 300, '15m': 900, '30m': 1800, '1H': 3600, '4H': 14400, '1D': 86400 };
const months = new Map();
const maps = Object.fromEntries([...Object.keys(steps), '1W', '1M'].map(tf => [tf, new Map()]));
const gaps = [];

for (let i = 0; i < bars.length; i++) {
  const b = bars[i];
  const t = b[0];
  const date = new Date(t * 1000);
  const month = date.toISOString().slice(0, 7);
  if (!months.has(month)) months.set(month, []);
  months.get(month).push(b);

  if (i && t - bars[i - 1][0] > 60) {
    gaps.push([bars[i - 1][0], t, t - bars[i - 1][0]]);
  }

  for (const [tf, map] of Object.entries(maps)) {
    const bucket = steps[tf]
      ? Math.floor(t / steps[tf]) * steps[tf]
      : tf === '1W'
      ? (Math.floor(t / 86400) - ((date.getUTCDay() + 6) % 7)) * 86400
      : Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1) / 1000;
    const old = map.get(bucket);
    if (old) {
      old[2] = Math.max(old[2], b[2]);
      old[3] = Math.min(old[3], b[3]);
      old[4] = b[4];
      old[5] += b[5];
    } else {
      map.set(bucket, [bucket, ...b.slice(1)]);
    }
  }
}

for (const [month, rows] of months) {
  save(path.join(storeDir, symbol, '1m', `${month}.json.gz`), rows);
}
save(path.join(storeDir, symbol, '1m', '2026.json.gz'), bars);

for (const [tf, map] of Object.entries(maps)) {
  save(path.join(storeDir, symbol, tf, '2026.json.gz'), [...map.values()]);
}

const manifestPath = path.join(storeDir, 'manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const yearItem = {
  rows: bars.length,
  first: bars[0][0],
  last: bars.at(-1)[0],
  invalidRows: invalid,
  duplicates,
  gapsOverOneMinute: gaps.length,
  largestGapSeconds: Math.max(0, ...gaps.map(g => g[2])),
  largestGaps: gaps.sort((a, b) => b[2] - a[2]).slice(0, 10),
  sourceSha256: crypto.createHash('sha256').update(m1Bytes).digest('hex'),
  sourceUrl: 'https://evtradelabs.com/data (USA30IDXUSD_M1.csv)',
};

manifest.symbols[symbol] = {
  sourceSymbol,
  provider: 'EV Trading Labs',
  priceBasis: 'bid',
  first: bars[0][0],
  last: bars.at(-1)[0],
  rows: bars.length,
  years: {
    '2026': yearItem,
  },
};

fs.writeFileSync(manifestPath + '.tmp', JSON.stringify(manifest));
fs.renameSync(manifestPath + '.tmp', manifestPath);

console.log(
  JSON.stringify({
    symbol,
    rows: bars.length,
    months: [...months.keys()],
    first: new Date(bars[0][0] * 1000).toISOString(),
    last: new Date(bars.at(-1)[0] * 1000).toISOString(),
  })
);
