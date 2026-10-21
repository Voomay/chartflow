export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const symbol = req.query?.symbol || 'EURUSD=X';
  const interval = req.query?.interval || '15m';
  const range = req.query?.range || '1mo';

  const hosts = [
    'https://query1.finance.yahoo.com',
    'https://query2.finance.yahoo.com',
  ];

  let lastError = null;
  for (const host of hosts) {
    try {
      const url = `${host}/v8/finance/chart/${encodeURIComponent(
        symbol
      )}?interval=${encodeURIComponent(interval)}&range=${encodeURIComponent(
        range
      )}&includePrePost=true`;

      const response = await fetch(url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          Accept: 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        res.setHeader(
          'Cache-Control',
          range === '1d'
            ? 'public, s-maxage=2, stale-while-revalidate=5'
            : 'public, s-maxage=8, stale-while-revalidate=20'
        );
        return res.status(200).json(data);
      }
      lastError = `HTTP ${response.status}`;
    } catch (err) {
      lastError = String(err);
    }
  }

  return res.status(502).json({
    error: 'Upstream Yahoo Finance feed unavailable',
    details: lastError,
  });
}
