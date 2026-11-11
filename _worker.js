/**
 * myPortfolio — Dedicated Yahoo Finance Live Quote Cloudflare Worker (_worker.js)
 * Compatible with Cloudflare Workers Direct Upload & Pages Functions
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Accept, Authorization',
  'Access-Control-Max-Age': '86400',
  'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0'
};

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
];

function getRandomUA() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

function round(val, decimals = 4) {
  const n = Number(val);
  if (!Number.isFinite(n)) return 0;
  return Number(Math.round(Number(n + 'e' + decimals)) + 'e-' + decimals);
}

async function fetchSingleYahooQuote(rawSymbol, range = '5d', interval = '1d') {
  const symbol = String(rawSymbol || '').trim().toUpperCase();
  if (!symbol) return null;

  const hosts = [
    'https://query1.finance.yahoo.com',
    'https://query2.finance.yahoo.com'
  ];

  let lastError = null;
  for (const host of hosts) {
    try {
      const targetUrl = `${host}/v8/finance/chart/${encodeURIComponent(symbol)}?range=${encodeURIComponent(range)}&interval=${encodeURIComponent(interval)}&includePrePost=false&_=${Date.now()}`;
      const res = await fetch(targetUrl, {
        headers: {
          'User-Agent': getRandomUA(),
          'Accept': 'application/json,text/plain,*/*',
          'Accept-Language': 'en-US,en;q=0.9',
          'Origin': 'https://finance.yahoo.com',
          'Referer': `https://finance.yahoo.com/quote/${encodeURIComponent(symbol)}/`
        },
        cf: { cacheTtl: 0, cacheEverything: false }
      });

      if (!res.ok) {
        lastError = `HTTP ${res.status} from ${host}`;
        continue;
      }

      const data = await res.json();
      const result = data?.chart?.result?.[0];
      if (!result || !result.meta) {
        lastError = data?.chart?.error?.description || 'Empty Yahoo chart result';
        continue;
      }

      const meta = result.meta;
      const rawCloses = result.indicators?.quote?.[0]?.close || [];
      const closes = rawCloses
        .map((v) => (v !== null && v !== undefined ? Number(v) : NaN))
        .filter((v) => Number.isFinite(v) && v > 0);

      const price = Number.isFinite(Number(meta.regularMarketPrice)) && Number(meta.regularMarketPrice) > 0
        ? Number(meta.regularMarketPrice)
        : (closes.length > 0 ? closes[closes.length - 1] : NaN);

      if (!Number.isFinite(price) || price <= 0) {
        lastError = 'No valid regularMarketPrice';
        continue;
      }

      let prevPrice = closes.length >= 2 ? closes[closes.length - 2] : NaN;
      const metaPrev = Number(meta.regularMarketPreviousClose ?? meta.previousClose);
      if (Number.isFinite(metaPrev) && metaPrev > 0) {
        if (!Number.isFinite(prevPrice) || Math.abs(price - closes[closes.length - 1]) > 1e-4) {
          prevPrice = metaPrev;
        } else if (Math.abs(closes[closes.length - 1] - price) <= 1e-4 && closes.length >= 2) {
          prevPrice = closes[closes.length - 2];
        }
      }
      if (!Number.isFinite(prevPrice) || prevPrice <= 0) {
        prevPrice = price;
      }

      if (prevPrice > 0 && Math.abs((price - prevPrice) / prevPrice) > 0.40) {
        if (closes.length >= 2 && Math.abs((price - closes[closes.length - 2]) / closes[closes.length - 2]) <= 0.40) {
          prevPrice = closes[closes.length - 2];
        } else {
          prevPrice = price;
        }
      }

      const change = round(price - prevPrice, 4);
      const changePct = prevPrice > 0 ? round(((price - prevPrice) / prevPrice) * 100, 2) : 0;

      return {
        symbol,
        ok: true,
        price: round(price, 4),
        prevPrice: round(prevPrice, 4),
        change,
        changePct,
        currency: meta.currency || (symbol.endsWith('.HK') ? 'HKD' : (symbol.endsWith('.L') ? 'USD' : 'USD')),
        name: meta.longName || meta.shortName || symbol,
        exchangeName: meta.exchangeName || meta.fullExchangeName || '',
        instrumentType: meta.instrumentType || '',
        high52w: Number(meta.fiftyTwoWeekHigh) > 0 ? round(meta.fiftyTwoWeekHigh, 4) : null,
        low52w: Number(meta.fiftyTwoWeekLow) > 0 ? round(meta.fiftyTwoWeekLow, 4) : null,
        marketTime: meta.regularMarketTime ? new Date(meta.regularMarketTime * 1000).toISOString() : new Date().toISOString(),
        source: `Cloudflare Worker -> ${host}`
      };
    } catch (err) {
      lastError = err.message || String(err);
    }
  }

  return {
    symbol,
    ok: false,
    error: lastError || 'Failed to fetch from Yahoo Finance'
  };
}

export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    const reqUrl = new URL(request.url);
    const symbolsParam = reqUrl.searchParams.get('symbols') || reqUrl.searchParams.get('symbol') || '';
    const targetUrlParam = reqUrl.searchParams.get('url') || '';

    if (symbolsParam.trim()) {
      const range = reqUrl.searchParams.get('range') || '5d';
      const interval = reqUrl.searchParams.get('interval') || '1d';
      const symbols = Array.from(
        new Set(
          symbolsParam
            .split(/[\s,]+/)
            .map((s) => s.trim().toUpperCase())
            .filter(Boolean)
        )
      ).slice(0, 60);

      const t0 = Date.now();
      const results = await Promise.all(symbols.map((sym) => fetchSingleYahooQuote(sym, range, interval)));
      const quotes = {};
      const errors = {};

      for (const r of results) {
        if (!r) continue;
        if (r.ok) {
          quotes[r.symbol] = r;
        } else {
          errors[r.symbol] = r.error;
        }
      }

      const payload = {
        ok: true,
        count: Object.keys(quotes).length,
        requested: symbols.length,
        elapsedMs: Date.now() - t0,
        timestamp: new Date().toISOString(),
        quotes,
        errors: Object.keys(errors).length > 0 ? errors : undefined
      };

      return new Response(JSON.stringify(payload, null, 2), {
        status: 200,
        headers: {
          ...CORS_HEADERS,
          'Content-Type': 'application/json; charset=utf-8'
        }
      });
    }

    if (targetUrlParam.trim()) {
      let parsedTarget;
      try {
        parsedTarget = new URL(targetUrlParam);
      } catch (_) {
        return new Response(JSON.stringify({ ok: false, error: 'Invalid target URL' }), {
          status: 400,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json; charset=utf-8' }
        });
      }

      if (!parsedTarget.hostname.endsWith('.yahoo.com')) {
        return new Response(JSON.stringify({ ok: false, error: 'Only *.yahoo.com URLs are permitted' }), {
          status: 403,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json; charset=utf-8' }
        });
      }

      try {
        const upstreamRes = await fetch(parsedTarget.toString(), {
          headers: {
            'User-Agent': getRandomUA(),
            'Accept': 'application/json,text/plain,*/*',
            'Accept-Language': 'en-US,en;q=0.9',
            'Origin': 'https://finance.yahoo.com',
            'Referer': 'https://finance.yahoo.com/'
          },
          cf: { cacheTtl: 0, cacheEverything: false }
        });

        const bodyText = await upstreamRes.text();
        return new Response(bodyText, {
          status: upstreamRes.status,
          headers: {
            ...CORS_HEADERS,
            'Content-Type': upstreamRes.headers.get('Content-Type') || 'application/json; charset=utf-8'
          }
        });
      } catch (err) {
        return new Response(JSON.stringify({ ok: false, error: err.message || String(err) }), {
          status: 502,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json; charset=utf-8' }
        });
      }
    }

    return new Response(
      JSON.stringify(
        {
          service: 'myPortfolio Yahoo Finance Live Quote Worker',
          status: 'ready',
          endpoints: {
            batchQuotes: `${reqUrl.origin}/?symbols=2800.HK,VWRA.L,SPYL.L,VOO`,
            rawYahooProxy: `${reqUrl.origin}/?url=https://query1.finance.yahoo.com/v8/finance/chart/2800.HK?range=5d&interval=1d`
          }
        },
        null,
        2
      ),
      {
        status: 200,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json; charset=utf-8' }
      }
    );
  }
};
