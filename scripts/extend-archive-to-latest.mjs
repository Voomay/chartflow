#!/usr/bin/env node
/**
 * Rebuild November 2026 (2026-11-01 00:00 UTC through 2026-11-19 23:59 UTC)
 * for all 25 instruments using institutional 24-hour bid feeds:
 *   - 23 FX / Metals / Indices / Energy symbols: Dukascopy Bank SA (freeserv.dukascopy.com)
 *     (the exact same upstream bid feed as HistData and EV Trading Labs)
 *   - BTCUSD & ETHUSD: Bitfinex exchange trade candles
 *
 * Rebuilds 1m, 5m, 15m, 30m, 1H, 4H, 1D, 1W, and 1M cleanly with zero Yahoo
 * cash-only gaps, zero flat-bar corruption, and zero synthetic subdivision.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ARCHIVE_DIR = path.resolve(SCRIPT_DIR, '../market-data/archive');

const NOV_START_SEC = Date.UTC(2026, 10, 1, 0, 0, 0) / 1000; // 2026-11-01T00:00:00Z
const END_SEC = Date.UTC(2026, 10, 19, 23, 59, 0) / 1000;    // 2026-11-19T23:59:00Z
const END_MS = END_SEC * 1000;

const DUKA_MAP = {
  XAUUSD: 'XAU/USD',
  XAGUSD: 'XAG/USD',
  EURUSD: 'EUR/USD',
  GBPUSD: 'GBP/USD',
  USDJPY: 'USD/JPY',
  USDCHF: 'USD/CHF',
  AUDUSD: 'AUD/USD',
  USDCAD: 'USD/CAD',
  NZDUSD: 'NZD/USD',
  GBPJPY: 'GBP/JPY',
  EURJPY: 'EUR/JPY',
  EURGBP: 'EUR/GBP',
  AUDJPY: 'AUD/JPY',
  EURAUD: 'EUR/AUD',
  GBPAUD: 'GBP/AUD',
  CADJPY: 'CAD/JPY',
  US30: 'USA30.IDX/USD',
  NAS100: 'USATECH.IDX/USD',
  SPX500: 'USA500.IDX/USD',
  GER30: 'DEU.IDX/EUR',
  UK100: 'GBR.IDX/GBP',
  USOIL: 'LIGHT.CMD/USD',
  UKOIL: 'BRENT.CMD/USD',
};

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

async function fetchDukaPage(dukaSym, endMs, limit = 5000) {
  const url =
    `https://freeserv.dukascopy.com/2.0/?path=chart/json3` +
    `&instrument=${encodeURIComponent(dukaSym)}` +
    `&offer_side=B&interval=1MIN&splits=true&stocks=true` +
    `&time_direction=P&timestamp=${endMs}&limit=${limit}&jsonp=cb`;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const r = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          Referer: 'https://freeserv.dukascopy.com/',
        },
        signal: AbortSignal.timeout(20000),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const text = await r.text();
      const m = text.match(/cb\((.*)\)/s);
      if (!m) throw new Error(`Invalid JSONP response: ${text.slice(0, 80)}`);
      const arr = JSON.parse(m[1]);
      if (!Array.isArray(arr)) throw new Error('Non-array Dukascopy payload');
      return arr;
    } catch (err) {
      if (attempt === 4) throw err;
      await new Promise((res) => setTimeout(res, 1000 * attempt));
    }
  }
  return [];
}

async function fetchDukaNov1m(symbol, dukaSym) {
  const merged = new Map();
  let cursorMs = END_MS + 60000; // inclusive of 2026-11-19T23:59:00Z
  let safety = 0;

  while (cursorMs >= NOV_START_SEC * 1000 && safety < 15) {
    safety++;
    const page = await fetchDukaPage(dukaSym, cursorMs, 5000);
    if (page.length === 0) break;

    let earliestMs = Infinity;
    for (const row of page) {
      const [ms, o, h, l, c, v] = row;
      if (!Number.isFinite(ms)) continue;
      if (ms < earliestMs) earliestMs = ms;
      const t = Math.round(ms / 1000);
      if (t < NOV_START_SEC || t > END_SEC) continue;
      if (t % 60 !== 0) continue;
      if (![o, h, l, c].every((x) => typeof x === 'number' && Number.isFinite(x) && x > 0)) continue;
      if (h < Math.max(o, c) || l > Math.min(o, c) || h < l) continue;
      const vol = typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Number(v.toFixed(6)) : 0;
      merged.set(t, [t, o, h, l, c, vol]);
    }

    if (!Number.isFinite(earliestMs) || earliestMs <= NOV_START_SEC * 1000) break;
    if (earliestMs >= cursorMs) break;
    cursorMs = earliestMs - 60000;
    await new Promise((res) => setTimeout(res, 150));
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

function aggregateFrom1m(rows1m, stepSec) {
  const map = new Map();
  for (const b of rows1m) {
    const bucket = Math.floor(b[0] / stepSec) * stepSec;
    const old = map.get(bucket);
    if (old) {
      old[2] = Math.max(old[2], b[2]);
      old[3] = Math.min(old[3], b[3]);
      old[4] = b[4];
      old[5] = Number(((old[5] || 0) + (b[5] || 0)).toFixed(6));
    } else {
      map.set(bucket, [bucket, b[1], b[2], b[3], b[4], b[5] || 0]);
    }
  }
  return [...map.values()].sort((a, b) => a[0] - b[0]);
}

function aggregateHigherFrom1D(rows1D, tf) {
  const map = new Map();
  for (const b of rows1D) {
    const t = b[0];
    const d = new Date(t * 1000);
    const bucket =
      tf === '1W'
        ? (Math.floor(t / 86400) - ((d.getUTCDay() + 6) % 7)) * 86400
        : Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1) / 1000;
    const old = map.get(bucket);
    if (old) {
      old[2] = Math.max(old[2], b[2]);
      old[3] = Math.min(old[3], b[3]);
      old[4] = b[4];
      old[5] = Number(((old[5] || 0) + (b[5] || 0)).toFixed(6));
    } else {
      map.set(bucket, [bucket, b[1], b[2], b[3], b[4], b[5] || 0]);
    }
  }
  return [...map.values()].sort((a, b) => a[0] - b[0]);
}

function count2026Rows1m(symbol) {
  const dir1m = path.join(ARCHIVE_DIR, symbol, '1m');
  if (!fs.existsSync(dir1m)) return { rows: 0, first: Infinity, last: -Infinity };
  const files = fs.readdirSync(dir1m).filter((f) => /^2026-\d\d\.json\.gz$/.test(f)).sort();
  let rows = 0;
  let first = Infinity;
  let last = -Infinity;
  for (const f of files) {
    const arr = readGz(path.join(dir1m, f));
    if (!arr.length) continue;
    rows += arr.length;
    if (arr[0][0] < first) first = arr[0][0];
    if (arr[arr.length - 1][0] > last) last = arr[arr.length - 1][0];
  }
  return { rows, first, last };
}

async function rebuildNonCrypto() {
  const baseManifestPath = path.join(ARCHIVE_DIR, 'manifest.json');
  const baseManifest = JSON.parse(fs.readFileSync(baseManifestPath, 'utf8'));
  const monthManifestPath = path.join(ARCHIVE_DIR, 'manifest-month.json');
  const monthManifest = JSON.parse(fs.readFileSync(monthManifestPath, 'utf8'));

  for (const [symbol, dukaSym] of Object.entries(DUKA_MAP)) {
    const nov1m = await fetchDukaNov1m(symbol, dukaSym);
    if (nov1m.length < 1000) {
      throw new Error(`${symbol}: unexpectedly low Nov 1m bar count (${nov1m.length})`);
    }

    // Write 1m/2026-11.json.gz
    const file1m = path.join(ARCHIVE_DIR, symbol, '1m', '2026-11.json.gz');
    writeGz(file1m, nov1m);

    // Rebuild 5m, 15m, 30m, 1H, 4H, 1D for 2026: keep verified bars < 2026-11-01, append rebuilt Nov 1..19
    let full2026_1D = [];
    for (const [tf, stepSec] of Object.entries(TF_STEPS)) {
      const tfFile = path.join(ARCHIVE_DIR, symbol, tf, '2026.json.gz');
      const preNov = readGz(tfFile).filter((b) => b[0] < NOV_START_SEC);
      const novAgg = aggregateFrom1m(nov1m, stepSec);
      const merged = [...preNov, ...novAgg].sort((a, b) => a[0] - b[0]);
      writeGz(tfFile, merged);
      if (tf === '1D') full2026_1D = merged;
    }

    // Rebuild 1W and 1M for 2026 directly from full 2026 1D bars (guarantees Oct 26-Nov 1 week & Nov month are exact)
    const weekly2026 = aggregateHigherFrom1D(full2026_1D, '1W');
    writeGz(path.join(ARCHIVE_DIR, symbol, '1W', '2026.json.gz'), weekly2026);

    const monthly2026 = aggregateHigherFrom1D(full2026_1D, '1M');
    // Note: on Windows, '1M' and '1m' share the directory, so 1M/2026.json.gz is 1m/2026.json.gz
    const dir1M = fs.existsSync(path.join(ARCHIVE_DIR, symbol, '1M'))
      ? path.join(ARCHIVE_DIR, symbol, '1M')
      : path.join(ARCHIVE_DIR, symbol, '1m');
    writeGz(path.join(dir1M, '2026.json.gz'), monthly2026);

    // Compute exact 2026 coverage from disk
    const stats2026 = count2026Rows1m(symbol);
    const flatCount = nov1m.filter((b) => b[2] === b[3]).length;
    const flatPct = ((100 * flatCount) / nov1m.length).toFixed(1);

    // Update manifest-month.json (and manifest.json for US30)
    const prevInfo = monthManifest.symbols[symbol] || baseManifest.symbols[symbol] || { years: {} };
    const prev2026 = prevInfo.years?.['2026'] || baseManifest.symbols[symbol]?.years?.['2026'] || {};
    const updated2026 = {
      ...prev2026,
      first: Number.isFinite(stats2026.first) ? Math.min(prev2026.first || Infinity, stats2026.first) : prev2026.first,
      last: stats2026.last,
      rows: stats2026.rows,
    };
    const updatedYears = {
      ...prevInfo.years,
      '2026': updated2026,
    };
    const yearVals = Object.values(updatedYears);
    monthManifest.symbols[symbol] = {
      ...prevInfo,
      years: updatedYears,
      first: Math.min(...yearVals.map((v) => v.first)),
      last: Math.max(...yearVals.map((v) => v.last)),
      rows: yearVals.reduce((s, v) => s + (v.rows || 0), 0),
    };

    if (symbol === 'US30' && baseManifest.symbols.US30) {
      baseManifest.symbols.US30.years['2026'] = updated2026;
      const uVals = Object.values(baseManifest.symbols.US30.years);
      baseManifest.symbols.US30.first = Math.min(...uVals.map((v) => v.first));
      baseManifest.symbols.US30.last = Math.max(...uVals.map((v) => v.last));
      baseManifest.symbols.US30.rows = uVals.reduce((s, v) => s + (v.rows || 0), 0);
    }

    console.log(
      `${symbol.padEnd(7)} Nov 1m: ${String(nov1m.length).padStart(6)} bars | ` +
        `${new Date(nov1m[0][0] * 1000).toISOString().slice(0, 16)} -> ${new Date(nov1m.at(-1)[0] * 1000).toISOString().slice(0, 16)} | ` +
        `flat: ${flatPct.padStart(4)}% | 1M: ${monthly2026.length}`
    );
  }

  fs.writeFileSync(monthManifestPath + '.tmp', JSON.stringify(monthManifest));
  fs.renameSync(monthManifestPath + '.tmp', monthManifestPath);
  fs.writeFileSync(baseManifestPath + '.tmp', JSON.stringify(baseManifest));
  fs.renameSync(baseManifestPath + '.tmp', baseManifestPath);
}

async function fetchBitfinex(symbol, tf, endMs, limit = 10000) {
  const url = `https://api-pub.bitfinex.com/v2/candles/trade:${tf}:t${symbol}/hist?end=${endMs}&limit=${limit}&sort=-1`;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(20000) });
      if (!r.ok) throw new Error(`Bitfinex ${symbol} ${tf} HTTP ${r.status}`);
      const raw = await r.json();
      return raw
        .map(([ms, o, c, h, l, v]) => [ms / 1000, o, h, l, c, v])
        .filter((b) => b[0] <= END_SEC)
        .sort((a, b) => a[0] - b[0]);
    } catch (err) {
      if (attempt === 4) throw err;
      await new Promise((res) => setTimeout(res, 2000 * attempt));
    }
  }
  return [];
}

async function rebuildCrypto() {
  const cutoffDay = Math.floor(END_SEC / 86400); // 20776 = 2026-11-19
  const tfs = ['1m', '5m', '15m', '30m', '1h', '1D', '1W'];

  for (const symbol of ['BTCUSD', 'ETHUSD']) {
    for (const tf of tfs) {
      const tfDir = path.join(ARCHIVE_DIR, 'bitfinex-cache', symbol, tf);
      if (fs.existsSync(tfDir)) {
        // Remove any cached day files after 2026-11-19 (e.g. 20780.json.gz)
        for (const f of fs.readdirSync(tfDir)) {
          const dayNum = Number(f.replace('.json.gz', ''));
          if (Number.isFinite(dayNum) && dayNum > cutoffDay) {
            fs.unlinkSync(path.join(tfDir, f));
          }
        }
      }

      let rows = await fetchBitfinex(symbol, tf, END_MS, 10000);
      if (tf === '1m' && rows.length > 0) {
        // Fetch 2 more 10,000-bar pages backwards so Nov 1..Nov 19 (27,360 mins) is 100% covered
        const map = new Map(rows.map((r) => [r[0], r]));
        let earliestMs = rows[0][0] * 1000 - 60000;
        for (let p = 0; p < 2; p++) {
          await new Promise((res) => setTimeout(res, 1500));
          const older = await fetchBitfinex(symbol, tf, earliestMs, 10000);
          if (!older.length) break;
          for (const r of older) map.set(r[0], r);
          earliestMs = older[0][0] * 1000 - 60000;
        }
        rows = [...map.values()].sort((a, b) => a[0] - b[0]);
      } else {
        await new Promise((res) => setTimeout(res, 1500));
      }

      if (rows.length > 0) {
        writeGz(path.join(tfDir, `${cutoffDay}.json.gz`), rows);
        if (tf === '1m') {
          console.log(
            `${symbol.padEnd(7)} Bitfinex 1m: ${rows.length} bars | ` +
              `${new Date(rows[0][0] * 1000).toISOString().slice(0, 16)} -> ${new Date(rows.at(-1)[0] * 1000).toISOString().slice(0, 16)} (day ${cutoffDay})`
          );
        }
      }
    }
  }
}

(async () => {
  console.log(`Rebuilding archive through 2026-11-19T23:59:00Z...`);
  await rebuildNonCrypto();
  await rebuildCrypto();
  console.log('All 25 instruments rebuilt cleanly through 2026-11-19.');
})();
