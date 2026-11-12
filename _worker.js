/**
 * myPortfolio — Unified Cloudflare Pages / Worker Backend (_worker.js)
 * Version: 3.5.1 (Build 20261112_1325)
 * Endpoints on https://myportfolio-quotes.pages.dev:
 *   1. /?symbols=2800.HK,VWRA.L,SPYL.L,VOO  (or /?type=quotes&symbols=...) -> Live Yahoo Finance Quotes
 *   2. /?type=history&symbols=2800.HK,VOO   -> 15-Year Monthly OHLCV Bars + 2018+ Dividend Events
 *   3. /?type=dividends&symbols=2800.HK,VOO -> 15-Year Dividend Events + Quote Meta
 *   4. /?type=news&symbols=2800.HK,VOO      -> Live Company & ETF News with Catalyst & Sentiment Scoring
 *   5. /?url=https://query1.finance.yahoo.com/... -> Direct Yahoo Finance Proxy
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Accept, Authorization',
  'Access-Control-Max-Age': '86400'
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

function parseSymbolList(rawParam, maxCount = 40) {
  return Array.from(
    new Set(
      String(rawParam || '')
        .split(/[\s,]+/)
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean)
    )
  ).slice(0, maxCount);
}

function classifyHeadline(title, summary = '') {
  const text = `${title || ''} ${summary || ''}`.toLowerCase();
  let catalyst = 'CORPORATE';
  if (/\b(dividend|ex-dividend|payout|distribution|yield)\b/i.test(text)) catalyst = 'DIVIDEND';
  else if (/\b(buyback|repurchase|share cancellation)\b/i.test(text)) catalyst = 'BUYBACK';
  else if (/\b(earnings|quarterly results|interim results|annual results|operating profit|net profit|revenue)\b/i.test(text)) catalyst = 'EARNINGS';
  else if (/\b(target price|upgraded|downgraded|overweight|outperform|broker|rating)\b/i.test(text)) catalyst = 'ANALYST';
  else if (/\b(hang seng|fed|interest rate|treasury|gold|etf|inflows|pboc|stimulus|a50|s&p 500|ftse)\b/i.test(text)) catalyst = 'MACRO / ETF';

  const bullPatterns = [
    /\bbeats?\b/i, /\bsurge[sd]?\b/i, /\brecord\b.*\b(profit|inflows?|high|revenue|distribution)\b/i,
    /\bbuyback\b/i, /\brepurchase\b/i, /\b(raises?|declares?|approves?|maintains?|hikes?|increases?)\b.*\b(dividend|payout|distribution)\b/i,
    /\bspecial dividend\b/i, /\bupgrade[sd]?\b/i, /\boutperform\b/i, /\boverweight\b/i, /\bresilient\b/i,
    /\bnet profit up\b/i, /\bstrong\b.*\b(inflows?|growth|demand|value|earnings|results)\b/i, /\brally\b/i, /\bgains?\b/i
  ];
  const bearPatterns = [
    /\bmiss(es|ed)?\b/i, /\bprofit warning\b/i, /\b(cuts?|suspends?|omits?|reduces?)\b.*\b(dividend|payout)\b/i,
    /\bdowngrade[sd]?\b/i, /\bunderperform\b/i, /\bunderweight\b/i, /\bplunge[sd]?\b/i, /\bnet profit down\b/i,
    /\bprobe\b/i, /\blawsuit\b/i, /\boutflows?\b/i, /\bslump[sd]?\b/i, /\bdrop[sd]?\b/i
  ];

  let bullHits = 0;
  let bearHits = 0;
  bullPatterns.forEach((p) => { if (p.test(text)) bullHits++; });
  bearPatterns.forEach((p) => { if (p.test(text)) bearHits++; });

  const score = round(Math.max(-1.0, Math.min(1.0, bullHits * 0.45 - bearHits * 0.50)), 2);
  const label = score >= 0.25 ? 'BULLISH' : (score <= -0.25 ? 'BEARISH' : 'NEUTRAL');
  return { catalyst, sentimentScore: score, sentimentLabel: label };
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
      const targetUrl = `${host}/v8/finance/chart/${encodeURIComponent(symbol)}?range=${encodeURIComponent(range)}&interval=${encodeURIComponent(interval)}&includePrePost=false`;
      const res = await fetch(targetUrl, {
        headers: {
          'User-Agent': getRandomUA(),
          'Accept': 'application/json,text/plain,*/*',
          'Accept-Language': 'en-US,en;q=0.9',
          'Origin': 'https://finance.yahoo.com',
          'Referer': `https://finance.yahoo.com/quote/${encodeURIComponent(symbol)}/`
        },
        cf: { cacheTtl: 15, cacheEverything: true }
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
        currency: meta.currency || (symbol.endsWith('.HK') ? 'HKD' : 'USD'),
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

async function fetchSingleYahooHistoryAndDividends(rawSymbol, range = '15y', interval = '1mo') {
  const symbol = String(rawSymbol || '').trim().toUpperCase();
  if (!symbol) return null;

  const hosts = [
    'https://query1.finance.yahoo.com',
    'https://query2.finance.yahoo.com'
  ];

  let lastError = null;
  for (const host of hosts) {
    try {
      const targetUrl = `${host}/v8/finance/chart/${encodeURIComponent(symbol)}?range=${encodeURIComponent(range)}&interval=${encodeURIComponent(interval)}&events=div&includePrePost=false`;
      const res = await fetch(targetUrl, {
        headers: {
          'User-Agent': getRandomUA(),
          'Accept': 'application/json,text/plain,*/*',
          'Accept-Language': 'en-US,en;q=0.9',
          'Origin': 'https://finance.yahoo.com',
          'Referer': `https://finance.yahoo.com/quote/${encodeURIComponent(symbol)}/`
        },
        cf: { cacheTtl: 3600, cacheEverything: true }
      });

      if (!res.ok) {
        lastError = `HTTP ${res.status} from ${host}`;
        continue;
      }

      const data = await res.json();
      const result = data?.chart?.result?.[0];
      if (!result || !result.meta) {
        lastError = data?.chart?.error?.description || 'Empty Yahoo history result';
        continue;
      }

      const meta = result.meta;
      const timestamps = result.timestamp || [];
      const q = result.indicators?.quote?.[0] || {};
      const adj = result.indicators?.adjclose?.[0]?.adjclose || [];
      const closes = q.close || [];
      const highs = q.high || [];
      const lows = q.low || [];
      const volumes = q.volume || [];

      const byMonth = {};
      for (let i = 0; i < timestamps.length; i++) {
        const ts = Number(timestamps[i]);
        const c = closes[i];
        if (!ts || c === null || c === undefined || isNaN(c) || Number(c) <= 0) continue;

        const dObj = new Date(ts * 1000);
        let dateStr = dObj.toISOString().slice(0, 10);
        let monthStr = dateStr.slice(0, 7);

        // Normalize UTC-shifted month-end timestamps (e.g. 2026-09-30 23:00 UTC = 2026-10-01 BST/HKT)
        if (/^\d{4}-\d{2}-(28|29|30|31)$/.test(dateStr)) {
          const nextDay = new Date((ts + 12 * 3600) * 1000);
          if (nextDay.getUTCDate() === 1) {
            const ny = nextDay.getUTCFullYear();
            const nm = String(nextDay.getUTCMonth() + 1).padStart(2, '0');
            monthStr = `${ny}-${nm}`;
            dateStr = `${monthStr}-01`;
          }
        }

        const rawClose = round(Number(c), 4);
        const adjClose = (adj[i] !== null && adj[i] !== undefined && Number(adj[i]) > 0)
          ? round(Number(adj[i]), 4)
          : rawClose;
        const rawHigh = (highs[i] !== null && highs[i] !== undefined && Number(highs[i]) > 0)
          ? round(Math.max(Number(highs[i]), rawClose), 4)
          : rawClose;
        const rawLow = (lows[i] !== null && lows[i] !== undefined && Number(lows[i]) > 0)
          ? round(Math.min(Number(lows[i]), rawClose), 4)
          : rawClose;
        const vol = parseInt(volumes[i] || 0, 10);

        byMonth[monthStr] = {
          month: monthStr,
          date: dateStr,
          close: rawClose,
          rawClose,
          adjClose,
          high: rawHigh,
          low: rawLow,
          volume: isNaN(vol) ? 0 : vol
        };
      }

      const historyBars = Object.values(byMonth).sort((a, b) => a.month.localeCompare(b.month));
      const rawDivMap = result.events?.dividends || {};

      return {
        symbol,
        ok: true,
        currency: meta.currency || (symbol.endsWith('.HK') ? 'HKD' : 'USD'),
        name: meta.longName || meta.shortName || symbol,
        instrumentType: meta.instrumentType || '',
        price: Number(meta.regularMarketPrice) > 0 ? round(meta.regularMarketPrice, 4) : (historyBars.length > 0 ? historyBars[historyBars.length - 1].close : null),
        high52w: Number(meta.fiftyTwoWeekHigh) > 0 ? round(meta.fiftyTwoWeekHigh, 4) : null,
        low52w: Number(meta.fiftyTwoWeekLow) > 0 ? round(meta.fiftyTwoWeekLow, 4) : null,
        history: historyBars,
        dividends: rawDivMap
      };
    } catch (err) {
      lastError = err.message || String(err);
    }
  }

  return {
    symbol,
    ok: false,
    error: lastError || 'Failed to fetch history from Yahoo Finance'
  };
}

async function fetchSingleYahooNews(rawSymbol, maxArticles = 6) {
  const symbol = String(rawSymbol || '').trim().toUpperCase();
  if (!symbol) return [];

  const hosts = [
    'https://query1.finance.yahoo.com',
    'https://query2.finance.yahoo.com'
  ];

  const cutoffMs = Date.now() - 92 * 86400 * 1000;

  for (const host of hosts) {
    try {
      const targetUrl = `${host}/v1/finance/search?q=${encodeURIComponent(symbol)}&quotesCount=1&newsCount=${maxArticles}`;
      const res = await fetch(targetUrl, {
        headers: {
          'User-Agent': getRandomUA(),
          'Accept': 'application/json,text/plain,*/*',
          'Accept-Language': 'en-US,en;q=0.9',
          'Origin': 'https://finance.yahoo.com',
          'Referer': 'https://finance.yahoo.com/'
        },
        cf: { cacheTtl: 900, cacheEverything: true }
      });

      if (!res.ok) continue;
      const data = await res.json();
      const quoteMeta = data?.quotes?.[0] || {};
      const companyName = quoteMeta.longname || quoteMeta.shortname || symbol;
      const newsList = Array.isArray(data?.news) ? data.news : [];
      const articles = [];

      for (const item of newsList) {
        const title = String(item?.title || '').trim();
        const link = String(item?.link || '').trim();
        if (!title || !link) continue;
        const ts = Number(item.providerPublishTime || 0);
        const pubMs = ts > 0 ? ts * 1000 : Date.now();
        if (pubMs < cutoffMs) continue;
        const pubIso = new Date(pubMs).toISOString();
        const cls = classifyHeadline(title);
        articles.push({
          id: `cf_${symbol}_${ts || Date.now()}`,
          ticker: symbol,
          companyName,
          title,
          publisher: item.publisher || 'Yahoo Finance',
          publishedAt: pubIso,
          url: link,
          sourceType: 'CloudflareYahooNews',
          catalyst: cls.catalyst,
          sentimentScore: cls.sentimentScore,
          sentimentLabel: cls.sentimentLabel,
          summary: title
        });
      }
      return articles;
    } catch (_) {}
  }
  return [];
}

export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    const reqUrl = new URL(request.url);
    const reqType = (reqUrl.searchParams.get('type') || '').trim().toLowerCase();
    const symbolsParam = reqUrl.searchParams.get('symbols') || reqUrl.searchParams.get('symbol') || '';
    const targetUrlParam = reqUrl.searchParams.get('url') || '';

    // 1. 15-Year Monthly History + Dividends Mode (?type=history&symbols=...) or Dividends Mode (?type=dividends&symbols=...)
    if ((reqType === 'history' || reqType === 'dividends') && symbolsParam.trim()) {
      const range = reqUrl.searchParams.get('range') || '15y';
      const interval = reqUrl.searchParams.get('interval') || '1mo';
      const symbols = parseSymbolList(symbolsParam, 35);
      const t0 = Date.now();

      const results = await Promise.all(
        symbols.map((sym) => fetchSingleYahooHistoryAndDividends(sym, range, interval))
      );

      const history = {};
      const dividends = {};
      const quotes = {};
      const errors = {};

      for (const r of results) {
        if (!r) continue;
        if (r.ok) {
          if (reqType === 'history') {
            history[r.symbol] = r.history;
          }
          dividends[r.symbol] = r.dividends;
          quotes[r.symbol] = {
            symbol: r.symbol,
            price: r.price,
            currency: r.currency,
            name: r.name,
            instrumentType: r.instrumentType,
            high52w: r.high52w,
            low52w: r.low52w
          };
        } else {
          errors[r.symbol] = r.error;
        }
      }

      const payload = {
        ok: true,
        type: reqType,
        count: Object.keys(dividends).length,
        requested: symbols.length,
        elapsedMs: Date.now() - t0,
        timestamp: new Date().toISOString(),
        history: reqType === 'history' ? history : undefined,
        dividends,
        quotes,
        errors: Object.keys(errors).length > 0 ? errors : undefined
      };

      return new Response(JSON.stringify(payload), {
        status: 200,
        headers: {
          ...CORS_HEADERS,
          'Cache-Control': 'public, max-age=300',
          'Content-Type': 'application/json; charset=utf-8'
        }
      });
    }

    // 2. Live Company & ETF News Mode (?type=news&symbols=...)
    if (reqType === 'news' && symbolsParam.trim()) {
      const maxPerTicker = Math.min(10, Math.max(2, parseInt(reqUrl.searchParams.get('limit') || '6', 10) || 6));
      const symbols = parseSymbolList(symbolsParam, 30);
      const t0 = Date.now();

      const lists = await Promise.all(symbols.map((sym) => fetchSingleYahooNews(sym, maxPerTicker)));
      const seenUrls = new Set();
      const articles = [];
      const byTicker = {};

      lists.forEach((arr, idx) => {
        const sym = symbols[idx];
        byTicker[sym] = [];
        for (const art of arr) {
          byTicker[sym].push(art);
          if (!seenUrls.has(art.url)) {
            seenUrls.add(art.url);
            articles.push(art);
          }
        }
      });

      articles.sort((a, b) => String(b.publishedAt || '').localeCompare(String(a.publishedAt || '')));

      const payload = {
        ok: true,
        type: 'news',
        articleCount: articles.length,
        tickerCount: symbols.length,
        elapsedMs: Date.now() - t0,
        generatedAt: new Date().toISOString(),
        articles,
        byTicker
      };

      return new Response(JSON.stringify(payload), {
        status: 200,
        headers: {
          ...CORS_HEADERS,
          'Cache-Control': 'public, max-age=300',
          'Content-Type': 'application/json; charset=utf-8'
        }
      });
    }

    // 3. Default Live Quotes Mode (?symbols=... or ?type=quotes&symbols=...)
    if (symbolsParam.trim()) {
      const range = reqUrl.searchParams.get('range') || '5d';
      const interval = reqUrl.searchParams.get('interval') || '1d';
      const symbols = parseSymbolList(symbolsParam, 60);

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
        type: 'quotes',
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
          'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
          'Content-Type': 'application/json; charset=utf-8'
        }
      });
    }

    // 4. Direct Yahoo Finance Proxy Mode (?url=https://query1.finance.yahoo.com/...)
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
          cf: { cacheTtl: 60, cacheEverything: true }
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
          service: 'myPortfolio Yahoo Finance Unified Worker (Quotes, 15Y History, Dividends & News)',
          version: '3.5.1',
          status: 'ready',
          endpoints: {
            liveQuotes: `${reqUrl.origin}/?symbols=2800.HK,VWRA.L,SPYL.L,VOO`,
            monthlyHistory15Y: `${reqUrl.origin}/?type=history&symbols=2800.HK,VWRA.L,SPYL.L,VOO`,
            dividends: `${reqUrl.origin}/?type=dividends&symbols=2800.HK,VOO`,
            companyNews: `${reqUrl.origin}/?type=news&symbols=2800.HK,VWRA.L,SPYL.L,VOO`,
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
