#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

const GOLD_DATA_PATH = path.resolve('src/services/goldDataService.ts');

const SPOT_SYMBOLS = new Set([
  'EURUSD', 'GBPUSD', 'USDJPY', 'USDCHF', 'AUDUSD', 'USDCAD', 'NZDUSD',
  'GBPJPY', 'EURJPY', 'EURGBP', 'AUDJPY', 'EURAUD', 'GBPAUD', 'CADJPY',
  'XAUUSD', 'XAGUSD',
]);

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
  BTCUSD: 'BTC-USD',
  ETHUSD: 'ETH-USD',
};

async function fetchLatestPrice(symbol, decimals) {
  if (SPOT_SYMBOLS.has(symbol)) {
    try {
      const r = await fetch(`https://biquote.io/api/${symbol}`, {
        signal: AbortSignal.timeout(5000),
        headers: { Accept: 'application/json' },
      });
      if (r.ok) {
        const j = await r.json();
        const mid = (Number(j.bid) + Number(j.ask)) / 2;
        if (Number.isFinite(mid) && mid > 0) {
          return { price: Number(mid.toFixed(decimals)), source: 'biquote' };
        }
      }
    } catch {
      // fall through to Yahoo
    }
  }

  const ySym = YAHOO_MAP[symbol];
  if (ySym) {
    try {
      const r = await fetch(
        `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ySym)}?interval=15m&range=1d`,
        {
          headers: { 'User-Agent': 'Mozilla/5.0' },
          signal: AbortSignal.timeout(5000),
        }
      );
      if (r.ok) {
        const j = await r.json();
        const p = Number(j?.chart?.result?.[0]?.meta?.regularMarketPrice);
        if (Number.isFinite(p) && p > 0) {
          return { price: Number(p.toFixed(decimals)), source: `yahoo:${ySym}` };
        }
      }
    } catch {
      // ignore
    }
  }
  return null;
}

async function main() {
  let content = fs.readFileSync(GOLD_DATA_PATH, 'utf8');
  const blockRegex = /(\{\s*symbol:\s*'([A-Z0-9]+)'[\s\S]*?decimals:\s*(\d+)[\s\S]*?basePrice:\s*)([0-9.]+)/g;

  const matches = [...content.matchAll(blockRegex)];
  console.log(`Found ${matches.length} instruments in ${GOLD_DATA_PATH}`);

  const updates = new Map();
  for (const m of matches) {
    const symbol = m[2];
    const decimals = Number(m[3]);
    const oldPrice = Number(m[4]);
    const res = await fetchLatestPrice(symbol, decimals);
    if (res) {
      updates.set(symbol, { oldPrice, newPrice: res.price, source: res.source });
      console.log(
        `${symbol.padEnd(8)} ${String(oldPrice).padEnd(10)} -> ${String(res.price).padEnd(10)} (${res.source})`
      );
    } else {
      console.warn(`${symbol.padEnd(8)} FAILED (keeping ${oldPrice})`);
    }
  }

  content = content.replace(blockRegex, (full, prefix, symbol, _decimals, oldVal) => {
    const upd = updates.get(symbol);
    return upd ? `${prefix}${upd.newPrice}` : full;
  });

  fs.writeFileSync(GOLD_DATA_PATH, content, 'utf8');
  console.log(`Updated ${updates.size}/${matches.length} instrument basePrices.`);
}

main();
