const symbols = new Set(['EURUSD','GBPUSD','USDJPY','USDCHF','AUDUSD','USDCAD','NZDUSD','GBPJPY','EURJPY','EURGBP','AUDJPY','EURAUD','GBPAUD','CADJPY','XAUUSD','XAGUSD']);
const intervals = new Set(['1m','5m','15m','30m','1h','4h','1d']);
const pending = new Map();
const cache = new Map();
async function getJson(path, ttl) {
  const cached = cache.get(path);
  if (cached && Date.now() - cached.time < ttl) return cached.data;
  if (pending.has(path)) return pending.get(path);
  const task = (async () => {
    const response = await fetch('https://biquote.io' + path, {signal: AbortSignal.timeout(6500), headers: {Accept: 'application/json'}});
    if (!response.ok) throw new Error('Spot provider HTTP ' + response.status);
    const data = await response.json();
    cache.set(path, {time: Date.now(), data});
    return data;
  })();
  pending.set(path, task);
  try { return await task; } finally { pending.delete(path); }
}
export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  const query = new URL(req.url, 'http://localhost').searchParams;
  const symbol = query.get('symbol');
  const interval = query.get('interval');
  const limit = Math.min(1000, Math.max(30, Number(query.get('limit')) || 1000));
  if (req.method !== 'GET' || !symbols.has(symbol) || !intervals.has(interval)) {
    res.statusCode = 400; res.end(JSON.stringify({error: 'Unsupported spot instrument, interval, or method'})); return;
  }
  try {
    const [series, quote] = await Promise.all([
      getJson(`/api/${symbol}/ohlc?interval=${interval}&limit=${limit}`, 4000),
      getJson(`/api/${symbol}`, 2000),
    ]);
    if (series.symbol !== symbol || series.interval !== interval || !Array.isArray(series.bars) || quote.symbol !== symbol) throw new Error('Unexpected spot provider response');
    res.statusCode = 200;
    res.end(JSON.stringify({...series, quote, provider: 'biquote', receivedAt: new Date().toISOString()}));
  } catch (error) {
    res.statusCode = 502;
    res.end(JSON.stringify({error: 'Spot feed unavailable', details: String(error)}));
  }
}
