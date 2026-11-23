#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ARCHIVE_DIR = path.resolve(SCRIPT_DIR, '../market-data/archive');

const YAHOO_MAP = {
  XAUUSD: 'GC=F',
  XAGUSD: 'SI=F',
  EURUSD: 'EURUSD=X',
  GBPUSD: 'GBPUSD=X',
  USDJPY: 'JPY=X',
  USDCHF: 'CHF=X',
  AUDUSD: 'AUDUSD=X',
  USDCAD: 'CAD=X',
  NZDUSD: 'NZDUSD=X',
  GBPJPY: 'GBPJPY=X',
  EURJPY: 'EURJPY=X',
  EURGBP: 'EURGBP=X',
  AUDJPY: 'AUDJPY=X',
  EURAUD: 'EURAUD=X',
  GBPAUD: 'GBPAUD=X',
  CADJPY: 'CADJPY=X',
  NAS100: '^NDX',
  SPX500: '^GSPC',
  US30: '^DJI',
  GER30: '^GDAXI',
  UK100: '^FTSE',
  USOIL: 'CL=F',
  UKOIL: 'BZ=F',
};

const FUTURES_BASIS_SYMBOLS = new Set(['XAUUSD', 'XAGUSD']);

function getDecimals(symbol) {
  if (symbol === 'XAUUSD' || symbol === 'US30' || symbol === 'NAS100' || symbol === 'SPX500' || symbol === 'GER30' || symbol === 'UK100') return 3;
  if (symbol === 'XAGUSD') return 4;
  if (symbol === 'USOIL' || symbol === 'UKOIL') return 3;
  if (symbol.endsWith('JPY')) return 3;
  return 5;
}

function readGz(filePath) {
  if (!fs.existsSync(filePath)) return [];
  return JSON.parse(zlib.gunzipSync(fs.readFileSync(filePath)).toString());
}

function writeGz(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tmp = filePath + '.tmp';
  fs.writeFileSync(tmp, zlib.gzipSync(JSON.stringify(data)));
  fs.renameSync(tmp, filePath);
}

async function fetchYahoo1mChunk(ySym, p1, p2) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ySym)}?interval=1m&period1=${p1}&period2=${p2}&includePrePost=false`;
  const r = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
    signal: AbortSignal.timeout(15000),
  });
  if (!r.ok) throw new Error(`Yahoo ${ySym} HTTP ${r.status}`);
  const j = await r.json();
  const res = j?.chart?.result?.[0];
  if (!res) return [];
  const ts = res.timestamp || [];
  const q = res.indicators?.quote?.[0] || {};
  const opens = q.open || [];
  const highs = q.high || [];
  const lows = q.low || [];
  const closes = q.close || [];
  const vols = q.volume || [];
  const out = [];
  for (let i = 0; i < ts.length; i++) {
    const t = ts[i];
    const o = opens[i];
    const h = highs[i];
    const l = lows[i];
    const c = closes[i];
    const v = vols[i] ?? 0;
    if (!Number.isFinite(t) || ![o, h, l, c].every(x => typeof x === 'number' && Number.isFinite(x) && x > 0)) continue;
    out.push([t, o, h, l, c, Number.isFinite(v) && v >= 0 ? Math.round(v) : 0]);
  }
  return out;
}

async function fetchYahooRange(ySym, startSec, endSec) {
  const chunkSec = 6 * 86400; // stay safely under Yahoo's 7-day 1m limit
  const merged = new Map();
  for (let p1 = startSec; p1 < endSec; p1 += chunkSec) {
    const p2 = Math.min(endSec, p1 + chunkSec);
    const rows = await fetchYahoo1mChunk(ySym, p1, p2);
    for (const r of rows) merged.set(r[0], r);
  }
  return [...merged.values()].sort((a, b) => a[0] - b[0]);
}

const TF_STEPS = {
  '5m': 300,
  '15m': 900,
  '30m': 1800,
  '1H': 3600,
  '4H': 14400,
  '1D': 86400,
};

function bucketFor(t, tf) {
  if (TF_STEPS[tf]) return Math.floor(t / TF_STEPS[tf]) * TF_STEPS[tf];
  const d = new Date(t * 1000);
  if (tf === '1W') return (Math.floor(t / 86400) - ((d.getUTCDay() + 6) % 7)) * 86400;
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1) / 1000;
}

function mergeBarsIntoTf(existingRows, new1mRows, tf) {
  const map = new Map();
  for (const r of existingRows) {
    map.set(r[0], [...r]);
  }
  for (const b of new1mRows) {
    const bucket = bucketFor(b[0], tf);
    const old = map.get(bucket);
    if (old) {
      old[2] = Math.max(old[2], b[2]);
      old[3] = Math.min(old[3], b[3]);
      old[4] = b[4];
      old[5] = (old[5] || 0) + (b[5] || 0);
    } else {
      map.set(bucket, [bucket, b[1], b[2], b[3], b[4], b[5] || 0]);
    }
  }
  return [...map.values()].sort((a, b) => a[0] - b[0]);
}

async function extendNonCrypto() {
  const nowSec = Math.floor(Date.now() / 1000);
  const baseManifest = JSON.parse(fs.readFileSync(path.join(ARCHIVE_DIR, 'manifest.json'), 'utf8'));
  const monthManifestPath = path.join(ARCHIVE_DIR, 'manifest-month.json');
  const monthManifest = JSON.parse(fs.readFileSync(monthManifestPath, 'utf8'));

  for (const [symbol, ySym] of Object.entries(YAHOO_MAP)) {
    const file1m = path.join(ARCHIVE_DIR, symbol, '1m', '2026-11.json.gz');
    const existing1m = readGz(file1m);
    if (existing1m.length === 0) {
      console.warn(`${symbol}: missing 2026-11.json.gz, skipping`);
      continue;
    }
    const lastBar = existing1m[existing1m.length - 1];
    const lastTs = lastBar[0];
    const decimals = getDecimals(symbol);
    const rawYahoo = await fetchYahooRange(ySym, lastTs - 600, nowSec);

    let basisOffset = 0;
    if (FUTURES_BASIS_SYMBOLS.has(symbol)) {
      const match = rawYahoo.find(r => r[0] === lastTs) || rawYahoo.find(r => Math.abs(r[0] - lastTs) <= 300);
      if (match) {
        basisOffset = lastBar[4] - match[4];
      }
    }

    const round = (v) => Number(v.toFixed(decimals));
    const added = [];
    for (const r of rawYahoo) {
      if (r[0] <= lastTs) continue;
      const o = round(r[1] + basisOffset);
      const c = round(r[4] + basisOffset);
      const h = Math.max(o, c, round(r[2] + basisOffset));
      const l = Math.min(o, c, round(r[3] + basisOffset));
      if (Math.min(o, h, l, c) <= 0) continue;
      added.push([r[0], o, h, l, c, r[5]]);
    }

    if (added.length === 0) {
      console.log(`${symbol.padEnd(8)} no new bars after ${new Date(lastTs * 1000).toISOString().slice(0, 16)}`);
      continue;
    }

    const merged1m = [...existing1m, ...added];
    writeGz(file1m, merged1m);

    for (const tf of ['5m', '15m', '30m', '1H', '4H', '1D', '1W', '1M']) {
      const tfFile = path.join(ARCHIVE_DIR, symbol, tf, '2026.json.gz');
      const existingTf = readGz(tfFile);
      const updatedTf = mergeBarsIntoTf(existingTf, added, tf);
      writeGz(tfFile, updatedTf);
    }

    // Update manifest-month.json
    const prevInfo = monthManifest.symbols[symbol] || baseManifest.symbols[symbol] || { years: {} };
    const prev2026 = prevInfo.years?.['2026'] || baseManifest.symbols[symbol]?.years?.['2026'] || {};
    const newLast = added[added.length - 1][0];
    const new2026Rows = (prev2026.rows || 0) + added.length;
    const updatedYears = {
      ...prevInfo.years,
      '2026': {
        ...prev2026,
        first: prev2026.first || merged1m[0][0],
        last: newLast,
        rows: new2026Rows,
      },
    };
    const yearVals = Object.values(updatedYears);
    monthManifest.symbols[symbol] = {
      ...prevInfo,
      years: updatedYears,
      first: Math.min(...yearVals.map(v => v.first)),
      last: Math.max(...yearVals.map(v => v.last)),
      rows: yearVals.reduce((s, v) => s + (v.rows || 0), 0),
    };

    console.log(
      `${symbol.padEnd(8)} +${String(added.length).padEnd(6)} bars -> ${new Date(newLast * 1000).toISOString().slice(0, 16)}` +
      (basisOffset ? ` (basis ${basisOffset.toFixed(decimals)})` : '')
    );
  }

  fs.writeFileSync(monthManifestPath + '.tmp', JSON.stringify(monthManifest));
  fs.renameSync(monthManifestPath + '.tmp', monthManifestPath);
}

async function fetchBitfinex(symbol, tf, endMs, limit = 10000) {
  const url = `https://api-pub.bitfinex.com/v2/candles/trade:${tf}:t${symbol}/hist?end=${endMs}&limit=${limit}&sort=-1`;
  const r = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!r.ok) throw new Error(`Bitfinex ${symbol} ${tf} HTTP ${r.status}`);
  const raw = await r.json();
  return raw
    .map(([ms, o, c, h, l, v]) => [ms / 1000, o, h, l, c, v])
    .sort((a, b) => a[0] - b[0]);
}

async function extendCrypto() {
  const nowMs = Date.now();
  const todayDay = Math.floor(nowMs / 86400000);
  const tfs = ['1m', '5m', '15m', '30m', '1h', '1D', '1W'];

  for (const symbol of ['BTCUSD', 'ETHUSD']) {
    for (const tf of tfs) {
      const tfDir = path.join(ARCHIVE_DIR, 'bitfinex-cache', symbol, tf);
      let rows = await fetchBitfinex(symbol, tf, nowMs, 10000);
      if (tf === '1m' && rows.length > 0) {
        // Fetch one more 10,000-bar page backwards so Nov 12..Nov 23 is 100% covered
        const earliestMs = rows[0][0] * 1000 - 60000;
        await new Promise(res => setTimeout(res, 1200));
        const older = await fetchBitfinex(symbol, tf, earliestMs, 10000);
        const map = new Map();
        for (const r of [...older, ...rows]) map.set(r[0], r);
        rows = [...map.values()].sort((a, b) => a[0] - b[0]);
      } else {
        await new Promise(res => setTimeout(res, 1200));
      }

      if (rows.length > 0) {
        // Write to today's day file (and a mid-range day file for 1m)
        writeGz(path.join(tfDir, `${todayDay}.json.gz`), rows);
        const lastTs = rows[rows.length - 1][0];
        if (tf === '1m') {
          console.log(`${symbol.padEnd(8)} 1m cached ${rows.length} bars -> ${new Date(lastTs * 1000).toISOString().slice(0, 16)} (day ${todayDay})`);
        }
      }
    }
  }
}

(async () => {
  await extendNonCrypto();
  await extendCrypto();
  console.log('Done extending archive to latest.');
})();
