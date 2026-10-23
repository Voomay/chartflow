import { defineConfig, loadEnv, Plugin } from 'vite';
import capitalHandler from './api/capital-indices.js';
// Private broker configuration remains in the Node server, never VITE_* client variables.
const privateEnv = loadEnv(process.env.NODE_ENV || 'development', process.cwd(), 'CAPITAL_');
for (const [key,value] of Object.entries(privateEnv)) if (process.env[key] === undefined) process.env[key] = value;
import react from '@vitejs/plugin-react';
import spotHandler from './api/spot-candles.js';
import historicalHandler from './api/historical-candles.js';
function spotPlugin(): Plugin {
  const use = (server: any) => { server.middlewares.use('/api/index-candles', capitalHandler); server.middlewares.use('/api/spot-candles', spotHandler); server.middlewares.use('/api/historical-candles', historicalHandler); };
  return {name: 'spot-market-feed', configureServer: use, configurePreviewServer: use};
}

interface CacheEntry {
  timestamp: number;
  body: string;
}

const yahooResponseCache = new Map<string, CacheEntry>();

function yahooFinanceApiPlugin(): Plugin {
  const middleware = async (req: any, res: any, next: any) => {
    if (!req.url || !req.url.startsWith('/api/yahoo-chart')) {
      return next();
    }

    try {
      const urlObj = new URL(req.url, 'http://localhost');
      const symbol = urlObj.searchParams.get('symbol') || 'EURUSD=X';
      const interval = urlObj.searchParams.get('interval') || '15m';
      const range = urlObj.searchParams.get('range') || '1mo';
      const period1 = urlObj.searchParams.get('period1');
      const period2 = urlObj.searchParams.get('period2');
      const includePrePost =
        urlObj.searchParams.get('includePrePost') === 'true' ? 'true' : 'false';

      const cacheKey = `${symbol}_${interval}_${
        period1 && period2 ? `${period1}_${period2}` : range
      }_${includePrePost}`;
      const now = Date.now();
      const ttlMs = range === '1d' ? 2500 : 8000;
      const cached = yahooResponseCache.get(cacheKey);

      if (cached && now - cached.timestamp < ttlMs) {
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.end(cached.body);
        return;
      }

      const hosts = [
        'https://query1.finance.yahoo.com',
        'https://query2.finance.yahoo.com',
      ];

      let lastErr: any = null;
      for (const host of hosts) {
        try {
          const rangeOrPeriodQuery =
            period1 && period2
              ? `period1=${encodeURIComponent(period1)}&period2=${encodeURIComponent(period2)}`
              : `range=${encodeURIComponent(range)}`;
          const targetUrl = `${host}/v8/finance/chart/${encodeURIComponent(
            symbol
          )}?interval=${encodeURIComponent(
            interval
          )}&${rangeOrPeriodQuery}&includePrePost=${includePrePost}`;

          const upstream = await fetch(targetUrl, {
            headers: {
              'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
              Accept: 'application/json',
            },
          });

          if (upstream.ok) {
            const body = await upstream.text();
            yahooResponseCache.set(cacheKey, { timestamp: now, body });
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.end(body);
            return;
          }
          lastErr = new Error(`Upstream HTTP ${upstream.status}`);
        } catch (err) {
          lastErr = err;
        }
      }

      res.statusCode = 502;
      res.setHeader('Content-Type', 'application/json');
      res.end(
        JSON.stringify({
          error: 'Failed to fetch Yahoo Finance chart data',
          details: String(lastErr),
        })
      );
    } catch (err) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: String(err) }));
    }
  };

  return {
    name: 'yahoo-finance-api-proxy',
    configureServer(server) {
      server.middlewares.use(middleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware);
    },
  };
}

export default defineConfig({
  plugins: [react(), yahooFinanceApiPlugin(), spotPlugin()],
  cacheDir: 'd:/fx/.vite-cache',
  server: {
    port: 3005,
    strictPort: true,
    host: true,
  },
  preview: {
    port: 3005,
    strictPort: true,
    host: true,
  },
});
