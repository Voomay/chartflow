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

function parseCsvFile(filePath, stepSeconds) {
  const bytes = fs.readFileSync(filePath);
  const lines = bytes.toString('utf8').trim().split(/\r?\n/);
  const unique = new Map();
  let invalid = 0;
  let duplicates = 0;

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
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
      stamp % stepSeconds ||
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
    throw new Error(`US30 CSV validation failed (${path.basename(filePath)}): rows=${unique.size}, invalid=${invalid}`);
  }

  return {
    bars: [...unique.values()].sort((a, b) => a[0] - b[0]),
    invalid,
    duplicates,
    sha256: crypto.createHash('sha256').update(bytes).digest('hex'),
  };
}

const tfSources = [
  ['1m', 'USA30IDXUSD_M1.csv', 60],
  ['5m', 'USA30IDXUSD_M5.csv', 300],
  ['15m', 'USA30IDXUSD_M15.csv', 900],
  ['30m', 'USA30IDXUSD_M30.csv', 1800],
  ['1H', 'USA30IDXUSD_H1.csv', 3600],
  ['4H', 'USA30IDXUSD_H4.csv', 14400],
  ['1D', 'USA30IDXUSD_D1.csv', 86400],
];

const parsedByTf = {};
for (const [tf, fileName, stepSec] of tfSources) {
  parsedByTf[tf] = parseCsvFile(path.join(rawDir, fileName), stepSec);
}

const m1Bars = parsedByTf['1m'].bars;
const months = new Map();
for (const b of m1Bars) {
  const month = new Date(b[0] * 1000).toISOString().slice(0, 7);
  if (!months.has(month)) months.set(month, []);
  months.get(month).push(b);
}
for (const [month, rows] of months) {
  save(path.join(storeDir, symbol, '1m', `${month}.json.gz`), rows);
}
save(path.join(storeDir, symbol, '1m', '2026.json.gz'), m1Bars);

// Build 1W and 1M from 1D bars (which cover 2013-2026)
const weeklyMap = new Map();
const monthlyMap = new Map();
for (const b of parsedByTf['1D'].bars) {
  const t = b[0];
  const date = new Date(t * 1000);
  const wBucket = (Math.floor(t / 86400) - ((date.getUTCDay() + 6) % 7)) * 86400;
  const mBucket = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1) / 1000;

  const oldW = weeklyMap.get(wBucket);
  if (oldW) {
    oldW[2] = Math.max(oldW[2], b[2]);
    oldW[3] = Math.min(oldW[3], b[3]);
    oldW[4] = b[4];
    oldW[5] += b[5];
  } else {
    weeklyMap.set(wBucket, [wBucket, ...b.slice(1)]);
  }

  const oldM = monthlyMap.get(mBucket);
  if (oldM) {
    oldM[2] = Math.max(oldM[2], b[2]);
    oldM[3] = Math.min(oldM[3], b[3]);
    oldM[4] = b[4];
    oldM[5] += b[5];
  } else {
    monthlyMap.set(mBucket, [mBucket, ...b.slice(1)]);
  }
}

const allTfBars = {
  '5m': parsedByTf['5m'].bars,
  '15m': parsedByTf['15m'].bars,
  '30m': parsedByTf['30m'].bars,
  '1H': parsedByTf['1H'].bars,
  '4H': parsedByTf['4H'].bars,
  '1D': parsedByTf['1D'].bars,
  '1W': [...weeklyMap.values()].sort((a, b) => a[0] - b[0]),
  '1M': [...monthlyMap.values()].sort((a, b) => a[0] - b[0]),
};

for (const [tf, tfBars] of Object.entries(allTfBars)) {
  const byYear = new Map();
  for (const b of tfBars) {
    const yr = String(new Date(b[0] * 1000).getUTCFullYear());
    if (!byYear.has(yr)) byYear.set(yr, []);
    byYear.get(yr).push(b);
  }
  for (const [yr, rows] of byYear) {
    save(path.join(storeDir, symbol, tf, `${yr}.json.gz`), rows);
  }
}

// Compute per-year manifest metadata across all available timeframes (2013-2026)
const yearsMeta = {};
const finestByYear = new Map();
for (const [tf, fileName] of tfSources) {
  for (const b of parsedByTf[tf].bars) {
    const yr = String(new Date(b[0] * 1000).getUTCFullYear());
    if (!finestByYear.has(yr)) {
      finestByYear.set(yr, { tf, fileName, sha256: parsedByTf[tf].sha256, bars: [] });
    }
  }
}
// Populate each year using the finest timeframe that has coverage in that year
for (const [yr, info] of [...finestByYear.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
  // Choose finest timeframe with bars in this year
  let chosenTf = '1D';
  let chosenFile = 'USA30IDXUSD_D1.csv';
  let chosenBars = [];
  for (const [tf, fileName] of tfSources) {
    const yrBars = parsedByTf[tf].bars.filter(b => String(new Date(b[0] * 1000).getUTCFullYear()) === yr);
    if (yrBars.length > chosenBars.length) {
      chosenTf = tf;
      chosenFile = fileName;
      chosenBars = yrBars;
    }
  }
  let first = Infinity;
  let last = -Infinity;
  for (const [tf] of tfSources) {
    for (const b of parsedByTf[tf].bars) {
      if (String(new Date(b[0] * 1000).getUTCFullYear()) === yr) {
        if (b[0] < first) first = b[0];
        if (b[0] > last) last = b[0];
      }
    }
  }
  yearsMeta[yr] = {
    rows: chosenBars.length,
    first,
    last,
    finestTimeframe: chosenTf,
    invalidRows: 0,
    duplicates: 0,
    sourceSha256: parsedByTf[chosenTf].sha256,
    sourceUrl: `https://evtradelabs.com/data (${chosenFile})`,
  };
}

const allFirst = Math.min(...Object.values(yearsMeta).map(y => y.first));
const allLast = Math.max(...Object.values(yearsMeta).map(y => y.last));
const totalRows = Object.values(yearsMeta).reduce((s, y) => s + y.rows, 0);

const manifestPath = path.join(storeDir, 'manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

manifest.symbols[symbol] = {
  sourceSymbol,
  provider: 'EV Trading Labs (Dukascopy)',
  priceBasis: 'bid',
  first: allFirst,
  last: allLast,
  rows: totalRows,
  years: yearsMeta,
};

fs.writeFileSync(manifestPath + '.tmp', JSON.stringify(manifest));
fs.renameSync(manifestPath + '.tmp', manifestPath);

console.log(
  JSON.stringify({
    symbol,
    totalRows,
    years: Object.keys(yearsMeta),
    months1m: [...months.keys()],
    first: new Date(allFirst * 1000).toISOString(),
    last: new Date(allLast * 1000).toISOString(),
  }, null, 2)
);
