/**
 * @file api.js
 * @module MarketAPIModule
 * @version 3.4.5
 * @build 20261111_2110
 * @description Compartmentalized Global Stock Market API Client (HKEX, US NYSE/NASDAQ, London LSE).
 *   - Tier 1 (Primary): Dedicated Cloudflare Pages Yahoo Finance Worker (https://myportfolio-quotes.pages.dev)
 *   - Tier 2 (Secondary): Parallel Yahoo Finance v8 Chart CORS Proxy Race (Promise.any)
 *   - Tier 3 (Offline Fallback): Verified GitHub Python Snapshot (historical_prices.json)
 *   - Live Multi-Currency FX Rate Sync (USDHKD=X, GBPUSD=X, GBPHKD=X)
 *   - Live Company & Watchlist News Search (/v1/finance/search) with Catalyst & Sentiment Tagger
 *   - Optional keyed providers: Alpha Vantage, Twelve Data, Finnhub
 */

var TICKER_STATIC_DIRECTORY = {
  '2800.HK': { name: 'Tracker Fund of Hong Kong', sector: 'Index ETF', currency: 'HKD' },
  '2840.HK': { name: 'SPDR Gold Trust', sector: 'Index ETF', currency: 'HKD' },
  '3077.HK': { name: 'Premia US Treasury Floating Rate ETF', sector: 'Index ETF', currency: 'HKD' },
  '3195.HK': { name: 'Hang Seng S&P 500 Index ETF', sector: 'Index ETF', currency: 'HKD' },
  '3433.HK': { name: 'CSOP FTSE US Treasury 20+ Years Index ETF', sector: 'Index ETF', currency: 'HKD' },
  '3476.HK': { name: 'Hang Seng JPMorgan US Equity Premium Income Active ETF', sector: 'Index ETF', currency: 'HKD' },
  '0002.HK': { name: 'CLP Holdings Ltd', sector: 'Utilities', currency: 'HKD' },
  '0003.HK': { name: 'Hong Kong and China Gas Co Ltd', sector: 'Utilities', currency: 'HKD' },
  '0005.HK': { name: 'HSBC Holdings plc', sector: 'Financials', currency: 'HKD' },
  '0006.HK': { name: 'Power Assets Holdings Ltd', sector: 'Utilities', currency: 'HKD' },
  '0012.HK': { name: 'Henderson Land Development Co Ltd', sector: 'Real Estate', currency: 'HKD' },
  '0066.HK': { name: 'MTR Corporation Ltd', sector: 'Industrials', currency: 'HKD' },
  '0101.HK': { name: 'Hang Lung Properties Ltd', sector: 'Real Estate', currency: 'HKD' },
  '0386.HK': { name: 'China Petroleum & Chemical Corp (Sinopec)', sector: 'Energy', currency: 'HKD' },
  '0700.HK': { name: 'Tencent Holdings Ltd', sector: 'Technology', currency: 'HKD' },
  '0857.HK': { name: 'PetroChina Co Ltd', sector: 'Energy', currency: 'HKD' },
  '0939.HK': { name: 'China Construction Bank Corp', sector: 'Financials', currency: 'HKD' },
  '1088.HK': { name: 'China Shenhua Energy Co Ltd', sector: 'Energy', currency: 'HKD' },
  '1093.HK': { name: 'CSPC Pharmaceutical Group Ltd', sector: 'Healthcare', currency: 'HKD' },
  '1288.HK': { name: 'Agricultural Bank of China Ltd', sector: 'Financials', currency: 'HKD' },
  '1299.HK': { name: 'AIA Group Ltd', sector: 'Financials', currency: 'HKD' },
  '1378.HK': { name: 'China Hongqiao Group Ltd', sector: 'Industrials', currency: 'HKD' },
  '1398.HK': { name: 'Industrial and Commercial Bank of China Ltd', sector: 'Financials', currency: 'HKD' },
  '2318.HK': { name: 'Ping An Insurance (Group) Co of China Ltd', sector: 'Financials', currency: 'HKD' },
  '2388.HK': { name: 'BOC Hong Kong (Holdings) Ltd', sector: 'Financials', currency: 'HKD' },
  'VOO':     { name: 'Vanguard S&P 500 ETF', sector: 'Index ETF', currency: 'USD' },
  'SPY':     { name: 'SPDR S&P 500 ETF Trust', sector: 'Index ETF', currency: 'USD' },
  'QQQ':     { name: 'Invesco QQQ Trust', sector: 'Index ETF', currency: 'USD' },
  'VWRA.L':  { name: 'Vanguard FTSE All-World UCITS ETF', sector: 'Index ETF', currency: 'USD' },
  'SPYL.L':  { name: 'SPDR S&P 500 UCITS ETF (Acc)', sector: 'Index ETF', currency: 'USD' },
  'VUAG.L':  { name: 'Vanguard S&P 500 UCITS ETF', sector: 'Index ETF', currency: 'GBP' },
  'HSBA.L':  { name: 'HSBC Holdings plc (LSE)', sector: 'Financials', currency: 'GBp' },
  'AAPL':    { name: 'Apple Inc.', sector: 'Technology', currency: 'USD' },
  'NVDA':    { name: 'NVIDIA Corp.', sector: 'Technology', currency: 'USD' },
  'MSFT':    { name: 'Microsoft Corp.', sector: 'Technology', currency: 'USD' }
};


// Primary Cloudflare Pages Yahoo Finance Live Quote Worker endpoint
var CLOUDFLARE_WORKER_URL = 'https://myportfolio-quotes.pages.dev';

var MarketAPI = {
  cloudflareWorkerUrl: CLOUDFLARE_WORKER_URL,
  _chartCache: {},
  lastRouteUsed: 'Yahoo Finance v8 Chart',

  normalizeTicker(raw) {
    if (!raw) return '';
    let s = String(raw).trim().toUpperCase();

    if (s.includes(':')) {
      const [prefix, code] = s.split(':');
      if (['HKG', 'HKEX', 'HK', 'SEHK'].includes(prefix)) {
        s = `${code}.HK`;
      } else if (['LON', 'LSE', 'XLON'].includes(prefix)) {
        s = `${code}.L`;
      } else if (['NYSE', 'NASDAQ', 'AMEX', 'ARCA', 'NYSEARCA', 'BATS'].includes(prefix)) {
        s = code;
      }
    }

    s = s.replace(/\.(HKG|HKEX|SEHK)$/i, '.HK');
    s = s.replace(/\.(LON|LSE|XLON)$/i, '.L');

    // Auto-append .L for known London Stock Exchange UCITS ETFs & UK stocks if entered without .L suffix
    const lseKnownBare = ['VWRA', 'SPYL', 'VUAG', 'VUSA', 'VWRL', 'CSPX', 'HSBA', 'ISAC', 'EQQQ', 'IUIT', 'IWDA', 'EIMI', 'VWRP', 'SWDA'];
    if (lseKnownBare.includes(s)) {
      s = `${s}.L`;
    }

    if (/^\d{1,5}$/.test(s)) {
      s = `${s}.HK`;
    }

    const hkMatch = s.match(/^(\d+)\.HK$/);
    if (hkMatch) {
      let digits = hkMatch[1];
      if (digits.length === 5 && digits.startsWith('0')) {
        digits = digits.slice(1);
      }
      if (digits.length < 4) {
        digits = digits.padStart(4, '0');
      }
      s = `${digits}.HK`;
    }

    return s;
  },

  getStaticProfile(rawTicker) {
    const sym = this.normalizeTicker(rawTicker);
    if (TICKER_STATIC_DIRECTORY[sym]) {
      return { ...TICKER_STATIC_DIRECTORY[sym] };
    }
    const currency = sym.endsWith('.HK') ? 'HKD' : (sym.endsWith('.L') ? 'GBp' : 'USD');
    const isHkEtfCode = /^(0?(28[0-4]\d|30\d\d|31\d\d|34\d\d|7[235]\d\d|9[01]\d\d)|828\d\d)\.HK$/.test(sym);
    return {
      name: sym,
      sector: isHkEtfCode ? 'Index ETF' : 'Equities',
      currency
    };
  },

  isEtfSector(sectorName, ticker = '', companyName = '') {
    const sec = String(sectorName || '').trim();
    // If a non-default sector name is explicitly provided, respect it and only classify as ETF if the sector name itself says ETF / Index Fund
    if (sec && sec.toLowerCase() !== 'equities') {
      return /\betf\b|index fund|exchange traded/i.test(sec);
    }
    const sym = this.normalizeTicker(ticker);
    if (TICKER_STATIC_DIRECTORY[sym]?.sector === 'Index ETF') return true;
    if (/^(0?(28[0-4]\d|30\d\d|31\d\d|34\d\d|7[235]\d\d|9[01]\d\d)|828\d\d)\.HK$/.test(sym)) return true;
    if (/\betf\b|tracker fund|spdr gold|vanguard|ishares|csop|premia/i.test(String(companyName || ''))) return true;
    return false;
  },

  hasKey() {
    if (this.getProvider() === 'yahoo') return true;
    return Boolean(state?.settings?.apiKey && state.settings.apiKey.trim().length > 0);
  },

  getProvider() {
    return state?.settings?.apiProvider || 'yahoo';
  },

  getKey() {
    return (state?.settings?.apiKey || '').trim();
  },

  async _tryProxyFetch(targetUrl, proxySpec, timeoutMs = 3200) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const proxyUrl = proxySpec.build(targetUrl);
      const res = await fetch(proxyUrl, {
        signal: controller.signal,
        cache: 'no-store'
      });
      clearTimeout(timer);

      if (!res.ok) {
        throw new Error(`${proxySpec.name} HTTP ${res.status}`);
      }

      const text = await res.text();
      if (!text || text.trim().startsWith('<')) {
        throw new Error(`${proxySpec.name} returned non-JSON HTML`);
      }

      let data = JSON.parse(text);
      if (proxySpec.unwrapAllOrigins && data && typeof data.contents === 'string') {
        if (data.status && data.status.http_code && data.status.http_code >= 400) {
          throw new Error(`Yahoo HTTP ${data.status.http_code} via ${proxySpec.name}`);
        }
        data = JSON.parse(data.contents);
      }

      if (data?.chart?.error) {
        const desc = data.chart.error.description || 'Yahoo chart error';
        const err = new Error(desc);
        err.isYahooSymbolError = /delisted|no data found/i.test(desc);
        throw err;
      }

      if (data?.chart?.result?.[0] || data?.quoteSummary?.result?.[0] || Array.isArray(data?.news)) {
        this.lastRouteUsed = `Yahoo Finance (${proxySpec.name})`;
        return data;
      }
      throw new Error(`${proxySpec.name} returned empty Yahoo payload`);
    } catch (err) {
      clearTimeout(timer);
      throw err;
    }
  },

  async fetchYahooJson(yahooPaths, cacheKey = null) {
    if (cacheKey && this._chartCache[cacheKey]) {
      const cached = this._chartCache[cacheKey];
      if (Date.now() - cached.ts < 60000) {
        return cached.data;
      }
    }

    const urls = Array.isArray(yahooPaths) ? yahooPaths : [yahooPaths];
    const primaryUrl = urls[0];
    const backupUrl = urls[1] || urls[0];
    const proxySpecs = [
      {
        name: 'CorsProxy-IO',
        unwrapAllOrigins: false,
        build: (u) => `https://corsproxy.io/?url=${encodeURIComponent(u)}`
      },
      {
        name: 'AllOrigins-Raw',
        unwrapAllOrigins: false,
        build: (u) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}&_=${Date.now()}`
      },
      {
        name: 'CodeTabs',
        unwrapAllOrigins: false,
        build: (u) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(u)}`
      },
      {
        name: 'AllOrigins-JSON',
        unwrapAllOrigins: true,
        build: (u) => `https://api.allorigins.win/get?url=${encodeURIComponent(u)}&_=${Date.now()}`
      },
      {
        name: 'CorsProxy-Org',
        unwrapAllOrigins: false,
        build: (u) => `https://corsproxy.org/?${encodeURIComponent(u)}`
      },
      {
        name: 'ThingProxy',
        unwrapAllOrigins: false,
        build: (u) => `https://thingproxy.freeboard.io/fetch/${u}`
      }
    ];

    // Stage 1: Fast 3-way parallel race with 4000ms timeout (crucial for LSE .L tickers like VWRA.L & SPYL.L)
    try {
      const stage1 = [
        this._tryProxyFetch(primaryUrl, proxySpecs[0], 4000),
        this._tryProxyFetch(backupUrl, proxySpecs[1], 4000),
        this._tryProxyFetch(primaryUrl, proxySpecs[2], 4000)
      ];
      const winner1 = await Promise.any(stage1);
      if (winner1) {
        if (cacheKey) this._chartCache[cacheKey] = { ts: Date.now(), data: winner1 };
        return winner1;
      }
    } catch (err1) {
      const errors1 = err1?.errors || [err1];
      const symErr1 = errors1.find(e => e?.isYahooSymbolError);
      if (symErr1) throw symErr1;
    }

    // Stage 2: Backup 3-way parallel race with 4500ms timeout
    try {
      const stage2 = [
        this._tryProxyFetch(primaryUrl, proxySpecs[3], 4500),
        this._tryProxyFetch(backupUrl, proxySpecs[4], 4500),
        this._tryProxyFetch(primaryUrl, proxySpecs[5], 4500)
      ];
      const winner2 = await Promise.any(stage2);
      if (winner2) {
        if (cacheKey) this._chartCache[cacheKey] = { ts: Date.now(), data: winner2 };
        return winner2;
      }
    } catch (err2) {
      const errors2 = err2?.errors || [err2];
      const symErr2 = errors2.find(e => e?.isYahooSymbolError);
      if (symErr2) throw symErr2;
    }

    throw new Error('Browser CORS proxies rate-limited or unreachable.');
  },

  _applyQuoteToFundamentals(symbol, quoteData) {
    if (!symbol || !quoteData || typeof state === 'undefined' || !state.fundamentals) return;
    const staticMeta = this.getStaticProfile(symbol);
    const existingFund = state.fundamentals[symbol] || {};
    const wlEntry = Array.isArray(state?.watchlist)
      ? state.watchlist.find(w => w.ticker === symbol)
      : null;
    const longName = quoteData.name || existingFund.name || staticMeta.name || symbol;
    const userSector = (existingFund._userCustomSector && existingFund.sector)
      ? existingFund.sector
      : (wlEntry?.sector || (existingFund.sector && existingFund.sector !== 'Equities' ? existingFund.sector : ''));
    const inferredSector = userSector
      || ((quoteData.instrumentType === 'ETF' || this.isEtfSector('', symbol, longName)) ? 'Index ETF' : (staticMeta.sector || 'Equities'));
    const resolvedName = (existingFund._userCustomName && existingFund.name)
      ? existingFund.name
      : (existingFund.name && existingFund.name !== symbol ? existingFund.name : longName);
    const high52w = Number(quoteData.high52w) > 0 ? Fin.round(Number(quoteData.high52w), 4) : (existingFund.high52w || null);
    const low52w = Number(quoteData.low52w) > 0 ? Fin.round(Number(quoteData.low52w), 4) : (existingFund.low52w || null);
    const currency = (existingFund._userCustomCurrency && existingFund.currency)
      ? existingFund.currency
      : (quoteData.currency || existingFund.currency || staticMeta.currency);

    state.fundamentals[symbol] = {
      ...existingFund,
      name: resolvedName,
      sector: inferredSector,
      currency,
      high52w,
      low52w
    };
  },

  _extractExactQuoteFromYahooChart(symbol, result, rangeHint = '5d') {
    if (!result || !result.meta) return null;
    const staticMeta = this.getStaticProfile(symbol);
    const meta = result.meta;
    const timestamps = Array.isArray(result.timestamp) ? result.timestamp : [];
    const rawCloses = result.indicators?.quote?.[0]?.close || [];
    const gmtOffsetSec = Number(meta.gmtoffset) || 0;
    const toLocalDay = (tsSec) => {
      const ms = (Number(tsSec) + gmtOffsetSec) * 1000;
      return Number.isFinite(ms) && ms > 0 ? new Date(ms).toISOString().slice(0, 10) : '';
    };

    const datedBars = [];
    const closes = [];
    for (let i = 0; i < rawCloses.length; i++) {
      const c = rawCloses[i] !== null && rawCloses[i] !== undefined ? Number(rawCloses[i]) : NaN;
      if (!Number.isFinite(c) || c <= 0) continue;
      closes.push(c);
      const ts = Number(timestamps[i]);
      const day = ts > 0 ? toLocalDay(ts) : '';
      if (day) {
        if (datedBars.length > 0 && datedBars[datedBars.length - 1].day === day) {
          datedBars[datedBars.length - 1].close = c;
        } else {
          datedBars.push({ ts, day, close: c });
        }
      }
    }

    const price = Number.isFinite(Number(meta.regularMarketPrice)) && Number(meta.regularMarketPrice) > 0
      ? Number(meta.regularMarketPrice)
      : (closes.length > 0 ? closes[closes.length - 1] : NaN);
    if (!Number.isFinite(price) || price <= 0) return null;

    const quoteDay = Number(meta.regularMarketTime) > 0
      ? toLocalDay(meta.regularMarketTime)
      : (datedBars.length > 0 ? datedBars[datedBars.length - 1].day : '');
    const priorDayBars = quoteDay ? datedBars.filter(b => b.day < quoteDay) : [];

    let prevPrice = NaN;
    const metaPrev = Number(
      meta.regularMarketPreviousClose ??
      meta.previousClose ??
      (rangeHint === '1d' ? meta.chartPreviousClose : NaN)
    );

    if (rangeHint === '1d' && Number.isFinite(metaPrev) && metaPrev > 0) {
      prevPrice = metaPrev;
    } else if (priorDayBars.length > 0) {
      prevPrice = priorDayBars[priorDayBars.length - 1].close;
    } else if (Number.isFinite(metaPrev) && metaPrev > 0) {
      prevPrice = metaPrev;
    } else if (closes.length >= 1) {
      const lastBarClose = closes[closes.length - 1];
      if (Math.abs(lastBarClose - price) > 1e-4) {
        prevPrice = lastBarClose;
      } else if (closes.length >= 2) {
        prevPrice = closes[closes.length - 2];
      }
    }

    if (!Number.isFinite(prevPrice) || prevPrice <= 0) {
      prevPrice = price;
    }
    if (prevPrice > 0 && Math.abs((price - prevPrice) / prevPrice) > 0.40) {
      if (priorDayBars.length > 0 && Math.abs((price - priorDayBars[priorDayBars.length - 1].close) / priorDayBars[priorDayBars.length - 1].close) <= 0.40) {
        prevPrice = priorDayBars[priorDayBars.length - 1].close;
      } else {
        prevPrice = price;
      }
    }

    const change = Fin.round(price - prevPrice, 4);
    const changePct = prevPrice > 0 ? Fin.round(((price - prevPrice) / prevPrice) * 100, 2) : 0;
    const currency = meta.currency || staticMeta.currency || (symbol.endsWith('.HK') ? 'HKD' : 'USD');
    const longName = meta.longName || meta.shortName || state?.fundamentals?.[symbol]?.name || staticMeta.name || symbol;
    const high52w = Number(meta.fiftyTwoWeekHigh) > 0 ? Fin.round(Number(meta.fiftyTwoWeekHigh), 4) : (state?.fundamentals?.[symbol]?.high52w || null);
    const low52w = Number(meta.fiftyTwoWeekLow) > 0 ? Fin.round(Number(meta.fiftyTwoWeekLow), 4) : (state?.fundamentals?.[symbol]?.low52w || null);

    return {
      price: Fin.round(price, 4),
      prevPrice: Fin.round(prevPrice, 4),
      change,
      changePct,
      high52w,
      low52w,
      currency,
      name: longName,
      instrumentType: meta.instrumentType || ''
    };
  },

  async fetchCloudflareBatchQuotes(tickers = [], timeoutMs = 8000) {
    const syms = Array.from(new Set(
      (tickers || []).map(t => this.normalizeTicker(t)).filter(Boolean)
    ));
    if (syms.length === 0) return {};

    const workerBase = String(this.cloudflareWorkerUrl || CLOUDFLARE_WORKER_URL || '').replace(/\/+$/, '');
    if (!workerBase) return {};

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      // Request range=1d&interval=1d so even a legacy v3.4.5 _worker.js (where closes.length <= 1)
      // avoids picking closes[closes.length - 2] (2 days ago), and if workerVersion < 3.5.2,
      // also verify via ?url= raw 5d/1d chart so 1D prevPrice is 100% exact before & after worker update.
      const url = `${workerBase}/?symbols=${encodeURIComponent(syms.join(','))}&range=1d&interval=15m&_=${Date.now()}`;
      const res = await fetch(url, {
        signal: controller.signal,
        cache: 'no-store'
      });
      clearTimeout(timer);
      if (!res.ok) {
        throw new Error(`Cloudflare Worker HTTP ${res.status}`);
      }
      const data = await res.json();
      const isUpgradedWorker = Boolean(data?.workerVersion && String(data.workerVersion) >= '3.5.3');
      const rawQuotes = data?.quotes || {};
      const out = {};

      if (isUpgradedWorker) {
        syms.forEach(sym => {
          const q = rawQuotes[sym];
          if (!q || !q.ok || !(Number(q.price) > 0)) return;
          const staticMeta = this.getStaticProfile(sym);
          const price = Fin.round(Number(q.price), 4);
          const prevPrice = Fin.round(Number(q.prevPrice || q.price), 4);
          const change = Fin.round(price - prevPrice, 4);
          const changePct = prevPrice > 0 ? Fin.round(((price - prevPrice) / prevPrice) * 100, 2) : 0;
          const currency = q.currency || staticMeta.currency || (sym.endsWith('.HK') ? 'HKD' : 'USD');
          const name = q.name || state?.fundamentals?.[sym]?.name || staticMeta.name || sym;
          const high52w = Number(q.high52w) > 0 ? Fin.round(Number(q.high52w), 4) : (state?.fundamentals?.[sym]?.high52w || null);
          const low52w = Number(q.low52w) > 0 ? Fin.round(Number(q.low52w), 4) : (state?.fundamentals?.[sym]?.low52w || null);
          const quoteObj = {
            price,
            prevPrice,
            change,
            changePct,
            high52w,
            low52w,
            currency,
            name,
            instrumentType: q.instrumentType || '',
            source: 'Cloudflare Worker (myportfolio-quotes.pages.dev)'
          };
          this._applyQuoteToFundamentals(sym, quoteObj);
          out[sym] = quoteObj;
        });
      } else {
        // Legacy worker fallback: use ?url= pass-through on myportfolio-quotes.pages.dev to parse exact exchange-dated prevPrice
        await Promise.allSettled(syms.map(async (sym) => {
          try {
            const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?range=1d&interval=15m&includePrePost=false`;
            const pCtrl = new AbortController();
            const pTimer = setTimeout(() => pCtrl.abort(), 6500);
            const pRes = await fetch(`${workerBase}/?url=${encodeURIComponent(yahooUrl)}&_=${Date.now()}`, {
              signal: pCtrl.signal,
              cache: 'no-store'
            });
            clearTimeout(pTimer);
            if (pRes.ok) {
              const pData = await pRes.json();
              const parsedQ = this._extractExactQuoteFromYahooChart(sym, pData?.chart?.result?.[0], '1d');
              if (parsedQ && parsedQ.price > 0) {
                const quoteObj = {
                  ...parsedQ,
                  source: 'Cloudflare Worker (myportfolio-quotes.pages.dev)'
                };
                this._applyQuoteToFundamentals(sym, quoteObj);
                out[sym] = quoteObj;
                return;
              }
            }
          } catch (_) {}
        }));
      }

      if (Object.keys(out).length > 0) {
        this.lastRouteUsed = 'Cloudflare Worker (myportfolio-quotes.pages.dev)';
      }
      return out;
    } catch (err) {
      clearTimeout(timer);
      throw err;
    }
  },

  getEmbeddedOrCachedQuote(symbol) {
    const staticMeta = this.getStaticProfile(symbol);
    const histSeries = state?.historicalPrices?.[symbol] || [];
    const lastBar = Array.isArray(histSeries) && histSeries.length > 0 ? histSeries[histSeries.length - 1] : null;
    const prevBar = Array.isArray(histSeries) && histSeries.length > 1 ? histSeries[histSeries.length - 2] : lastBar;

    let sq = state?.prices?.[symbol];
    if ((!sq || !(Number(sq.price) > 0)) && lastBar && Number(lastBar.rawClose || lastBar.close) > 0) {
      const c = Number(lastBar.rawClose || lastBar.close);
      sq = {
        price: c,
        prevPrice: c,
        change: 0,
        changePct: 0,
        currency: staticMeta.currency
      };
    }
    if (sq && Number(sq.price) > 0) {
      const price = Fin.round(Number(sq.price), 4);
      const prevPrice = Fin.round(Number(sq.prevClose || sq.prevPrice || price), 4);
      const change = sq.change !== undefined ? Fin.round(Number(sq.change), 3) : Fin.round(price - prevPrice, 3);
      const changePct = sq.changePct !== undefined
        ? Fin.round(Number(sq.changePct), 2)
        : (prevPrice > 0 ? Fin.round(((price - prevPrice) / prevPrice) * 100, 2) : 0);
      this.lastRouteUsed = 'Cached Portfolio Quote (localStorage)';
      return {
        price,
        prevPrice,
        change,
        changePct,
        high52w: sq.high52w || state?.fundamentals?.[symbol]?.high52w || null,
        low52w: sq.low52w || state?.fundamentals?.[symbol]?.low52w || null,
        currency: sq.currency || staticMeta.currency,
        name: sq.name || state?.fundamentals?.[symbol]?.name || staticMeta.name || symbol,
        source: this.lastRouteUsed
      };
    }
    return null;
  },

  getEmbeddedOrCachedHistory(symbol) {
    if (Array.isArray(state?.historicalPrices?.[symbol]) && state.historicalPrices[symbol].length > 0) {
      this.lastRouteUsed = 'Cached 15Y History (localStorage)';
      return state.historicalPrices[symbol];
    }
    return null;
  },

  _parseRawYahooChartHistoryAndDivs(symbol, result) {
    if (!result || !result.meta) return null;
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

      if (/^\d{4}-\d{2}-(28|29|30|31)$/.test(dateStr)) {
        const nextDay = new Date((ts + 12 * 3600) * 1000);
        if (nextDay.getUTCDate() === 1) {
          const ny = nextDay.getUTCFullYear();
          const nm = String(nextDay.getUTCMonth() + 1).padStart(2, '0');
          monthStr = `${ny}-${nm}`;
          dateStr = `${monthStr}-01`;
        }
      }

      const rawClose = Fin.round(Number(c), 4);
      const adjClose = (adj[i] !== null && adj[i] !== undefined && Number(adj[i]) > 0)
        ? Fin.round(Number(adj[i]), 4)
        : rawClose;
      const rawHigh = (highs[i] !== null && highs[i] !== undefined && Number(highs[i]) > 0)
        ? Fin.round(Math.max(Number(highs[i]), rawClose), 4)
        : rawClose;
      const rawLow = (lows[i] !== null && lows[i] !== undefined && Number(lows[i]) > 0)
        ? Fin.round(Math.min(Number(lows[i]), rawClose), 4)
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

    const history = Object.values(byMonth).sort((a, b) => a.month.localeCompare(b.month));
    const dividends = result.events?.dividends || {};
    return {
      symbol,
      currency: meta.currency || (symbol.endsWith('.HK') ? 'HKD' : 'USD'),
      name: meta.longName || meta.shortName || symbol,
      instrumentType: meta.instrumentType || '',
      price: Number(meta.regularMarketPrice) > 0 ? Fin.round(Number(meta.regularMarketPrice), 4) : (history.length > 0 ? history[history.length - 1].close : null),
      high52w: Number(meta.fiftyTwoWeekHigh) > 0 ? Fin.round(Number(meta.fiftyTwoWeekHigh), 4) : null,
      low52w: Number(meta.fiftyTwoWeekLow) > 0 ? Fin.round(Number(meta.fiftyTwoWeekLow), 4) : null,
      history,
      dividends
    };
  },

  async _fetchSingleHistoryViaWorkerUrlOrCors(symbol) {
    const sym = this.normalizeTicker(symbol);
    if (!sym) return null;
    const workerBase = String(this.cloudflareWorkerUrl || CLOUDFLARE_WORKER_URL || '').replace(/\/+$/, '');
    const yahooUrl1 = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?range=15y&interval=1mo&events=div&includePrePost=false`;
    const yahooUrl2 = `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?range=15y&interval=1mo&events=div&includePrePost=false`;

    // Tier 1B: Cloudflare Worker ?url= proxy
    if (workerBase) {
      try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 9000);
        const res = await fetch(`${workerBase}/?url=${encodeURIComponent(yahooUrl1)}&_=${Date.now()}`, {
          signal: ctrl.signal,
          cache: 'no-store'
        });
        clearTimeout(timer);
        if (res.ok) {
          const data = await res.json();
          const parsed = this._parseRawYahooChartHistoryAndDivs(sym, data?.chart?.result?.[0]);
          if (parsed && parsed.history.length > 0) {
            this.lastRouteUsed = 'Cloudflare Worker Proxy (myportfolio-quotes.pages.dev)';
            return parsed;
          }
        }
      } catch (_) {}
    }

    // Tier 2: Yahoo CORS proxy pool fallback
    const data = await this.fetchYahooJson([yahooUrl1, yahooUrl2], `hist15y_${sym}`);
    return this._parseRawYahooChartHistoryAndDivs(sym, data?.chart?.result?.[0]);
  },

  async fetchCloudflareHistoryAndDividends(tickers = [], mode = 'history') {
    const syms = Array.from(new Set(
      (tickers || []).map(t => this.normalizeTicker(t)).filter(Boolean)
    ));
    if (syms.length === 0) return { historyCount: 0, dividendCount: 0 };

    const workerBase = String(this.cloudflareWorkerUrl || CLOUDFLARE_WORKER_URL || '').replace(/\/+$/, '');
    const chunkSize = 15;
    let historyCount = 0;
    let dividendCount = 0;

    const applyTickerPayload = (sym, histBars, divEventsMap, quoteMeta) => {
      if (quoteMeta && typeof quoteMeta === 'object') {
        this._applyQuoteToFundamentals(sym, quoteMeta);
      }
      if (mode === 'history' && Array.isArray(histBars) && histBars.length > 0) {
        state.historicalPrices[sym] = histBars;
        historyCount++;
      }
      if (divEventsMap && typeof divEventsMap === 'object' && typeof buildDividendScheduleForTicker === 'function') {
        const refPx = Number(quoteMeta?.price || state?.prices?.[sym]?.price || 0);
        const refCurr = quoteMeta?.currency || state?.prices?.[sym]?.currency || null;
        const sched = buildDividendScheduleForTicker(sym, divEventsMap, refPx, refCurr);
        if (sched) {
          if (!state.dividendSchedules) state.dividendSchedules = {};
          state.dividendSchedules[sym] = sched;
          dividendCount++;
        }
      }
    };

    for (let i = 0; i < syms.length; i += chunkSize) {
      const chunk = syms.slice(i, i + chunkSize);
      let handledByBatchEndpoint = false;

      if (workerBase) {
        try {
          const ctrl = new AbortController();
          const timer = setTimeout(() => ctrl.abort(), 12000);
          const url = `${workerBase}/?type=${encodeURIComponent(mode)}&symbols=${encodeURIComponent(chunk.join(','))}&range=15y&interval=1mo&_=${Date.now()}`;
          const res = await fetch(url, { signal: ctrl.signal, cache: 'no-store' });
          clearTimeout(timer);
          if (res.ok) {
            const data = await res.json();
            if (data && (data.type === 'history' || data.type === 'dividends') && data.dividends) {
              handledByBatchEndpoint = true;
              this.lastRouteUsed = `Cloudflare Worker ${mode} (myportfolio-quotes.pages.dev)`;
              chunk.forEach(sym => {
                const hBars = data.history ? data.history[sym] : null;
                const dMap = data.dividends ? data.dividends[sym] : null;
                const qMeta = data.quotes ? data.quotes[sym] : null;
                applyTickerPayload(sym, hBars, dMap, qMeta);
              });
            }
          }
        } catch (_) {}
      }

      if (!handledByBatchEndpoint) {
        await Promise.allSettled(chunk.map(async (sym) => {
          try {
            const parsed = await this._fetchSingleHistoryViaWorkerUrlOrCors(sym);
            if (parsed) {
              applyTickerPayload(sym, parsed.history, parsed.dividends, parsed);
            }
          } catch (_) {}
        }));
      }
    }

    if (typeof invalidateStockMetricsCache === 'function') {
      invalidateStockMetricsCache();
    }
    return { historyCount, dividendCount };
  },

  async fetchCloudflareNewsBatch(tickers = [], maxPerTicker = 6) {
    const syms = Array.from(new Set(
      (tickers || []).map(t => this.normalizeTicker(t)).filter(Boolean)
    ));
    if (syms.length === 0) return [];

    const workerBase = String(this.cloudflareWorkerUrl || CLOUDFLARE_WORKER_URL || '').replace(/\/+$/, '');
    const chunkSize = 15;
    const allArticles = [];

    for (let i = 0; i < syms.length; i += chunkSize) {
      const chunk = syms.slice(i, i + chunkSize);
      let handledByBatchEndpoint = false;

      if (workerBase) {
        try {
          const ctrl = new AbortController();
          const timer = setTimeout(() => ctrl.abort(), 10000);
          const url = `${workerBase}/?type=news&symbols=${encodeURIComponent(chunk.join(','))}&limit=${maxPerTicker}&_=${Date.now()}`;
          const res = await fetch(url, { signal: ctrl.signal, cache: 'no-store' });
          clearTimeout(timer);
          if (res.ok) {
            const data = await res.json();
            if (data && data.type === 'news' && Array.isArray(data.articles)) {
              handledByBatchEndpoint = true;
              this.lastRouteUsed = 'Cloudflare Worker news (myportfolio-quotes.pages.dev)';
              data.articles.forEach(art => {
                const sym = this.normalizeTicker(art.ticker);
                const staticMeta = this.getStaticProfile(sym);
                allArticles.push({
                  ...art,
                  ticker: sym,
                  companyName: state?.fundamentals?.[sym]?.name || art.companyName || staticMeta.name || sym,
                  sector: state?.fundamentals?.[sym]?.sector || staticMeta.sector || 'Equities'
                });
              });
            }
          }
        } catch (_) {}
      }

      if (!handledByBatchEndpoint) {
        await Promise.allSettled(chunk.map(async (sym) => {
          try {
            const arts = await this.fetchTickerNewsLive(sym, maxPerTicker);
            if (Array.isArray(arts)) allArticles.push(...arts);
          } catch (_) {}
        }));
      }
    }

    return allArticles;
  },

  async fetchQuote(ticker) {
    const symbol = this.normalizeTicker(ticker);
    const provider = this.getProvider();
    const staticMeta = this.getStaticProfile(symbol);

    if (provider === 'yahoo') {
      // 1. Primary Route: Dedicated Cloudflare Pages Yahoo Finance Worker (https://myportfolio-quotes.pages.dev)
      try {
        const cfBatch = await this.fetchCloudflareBatchQuotes([symbol], 6500);
        if (cfBatch && cfBatch[symbol] && cfBatch[symbol].price > 0) {
          this.lastRouteUsed = 'Cloudflare Worker (myportfolio-quotes.pages.dev)';
          return cfBatch[symbol];
        }
      } catch (_) {}

      // 2. Secondary Route: Yahoo Finance v8 5d/1d quote via Browser CORS Proxy Pool
      try {
        const cb = Date.now();
        const q1 = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1d&interval=15m&includePrePost=false&_=${cb}`;
        const q2 = `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1d&interval=15m&includePrePost=false&_=${cb}`;

        const data = await this.fetchYahooJson([q1, q2], null);
        const parsedQ = this._extractExactQuoteFromYahooChart(symbol, data?.chart?.result?.[0], '1d');
        if (parsedQ && parsedQ.price > 0) {
          const quoteObj = {
            ...parsedQ,
            source: this.lastRouteUsed
          };
          this._applyQuoteToFundamentals(symbol, quoteObj);
          return quoteObj;
        }
      } catch (yahooErr) {
        const cachedQuote = this.getEmbeddedOrCachedQuote(symbol);
        if (cachedQuote) {
          return cachedQuote;
        }
        throw yahooErr;
      }
    }

    const key = this.getKey();
    if (!key) throw new Error('API key is not configured. Select Yahoo Finance (Keyless) or enter an API key in Settings.');

    if (provider === 'alphavantage') {
      const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${encodeURIComponent(symbol)}&apikey=${encodeURIComponent(key)}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data['Note'] || data['Information']) {
        throw new Error(data['Note'] || data['Information']);
      }
      const q = data['Global Quote'];
      if (!q || !q['05. price']) {
        throw new Error(`No quote returned for ${symbol} on Alpha Vantage (try switching provider to Yahoo Finance for HK/London stocks).`);
      }
      const price = parseFloat(q['05. price']);
      const prevPrice = parseFloat(q['08. previous close']) || price;
      const change = parseFloat(q['09. change']) || (price - prevPrice);
      const changePct = parseFloat((q['10. change percent'] || '0').replace('%', '')) || 0;
      this.lastRouteUsed = 'Alpha Vantage REST API';
      return { price, prevPrice, change, changePct, currency: 'USD', source: this.lastRouteUsed };
    }

    if (provider === 'twelvedata') {
      const url = `https://api.twelvedata.com/quote?symbol=${encodeURIComponent(symbol)}&apikey=${encodeURIComponent(key)}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.status === 'error' || !data.close) {
        throw new Error(data.message || `No quote returned for ${symbol}`);
      }
      const price = parseFloat(data.close);
      const prevPrice = parseFloat(data.previous_close) || price;
      const change = parseFloat(data.change) || (price - prevPrice);
      const changePct = parseFloat(data.percent_change) || 0;
      if (data.name && (!state.fundamentals[symbol] || !state.fundamentals[symbol].name)) {
        state.fundamentals[symbol] = { ...(state.fundamentals[symbol] || {}), name: data.name };
      }
      this.lastRouteUsed = 'Twelve Data REST API';
      return { price, prevPrice, change, changePct, currency: data.currency || 'USD', source: this.lastRouteUsed };
    }

    if (provider === 'finnhub') {
      const url = `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${encodeURIComponent(key)}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.error || !data.c) {
        throw new Error(data.error || `No quote returned for ${symbol} on Finnhub (free tier is US-only; switch to Yahoo Finance for HK/UK).`);
      }
      this.lastRouteUsed = 'Finnhub REST API';
      return {
        price: parseFloat(data.c),
        prevPrice: parseFloat(data.pc) || parseFloat(data.c),
        change: parseFloat(data.d) || 0,
        changePct: parseFloat(data.dp) || 0,
        currency: 'USD',
        source: this.lastRouteUsed
      };
    }
  },

  /**
   * Fetches 15-year monthly historical prices + dividend events via Cloudflare Worker
   */
  async fetchMonthlyHistory(ticker, forceRefresh = false) {
    const symbol = this.normalizeTicker(ticker);
    if (!forceRefresh) {
      const cachedHist = this.getEmbeddedOrCachedHistory(symbol);
      if (Array.isArray(cachedHist) && cachedHist.length > 0) {
        return cachedHist;
      }
    }
    await this.fetchCloudflareHistoryAndDividends([symbol], 'history');
    return this.getEmbeddedOrCachedHistory(symbol) || [];
  },

  async fetchFundamentals(ticker) {
    const symbol = this.normalizeTicker(ticker);
    const provider = this.getProvider();
    const staticMeta = this.getStaticProfile(symbol);
    const existing = {
      name: staticMeta.name,
      sector: staticMeta.sector,
      currency: staticMeta.currency,
      ...(state.fundamentals[symbol] || {})
    };

    if (provider === 'yahoo') {
      try {
        const q = await this.fetchQuote(symbol);
        if (q?.name) existing.name = q.name;
        if (q?.currency) existing.currency = q.currency;
      } catch (_) {}

      try {
        if (!state.historicalPrices[symbol] || state.historicalPrices[symbol].length === 0) {
          const hist = await this.fetchMonthlyHistory(symbol);
          if (hist?.length) state.historicalPrices[symbol] = hist;
        }
      } catch (_) {}

      state.fundamentals[symbol] = {
        ...existing,
        ...(state.fundamentals[symbol] || {})
      };
      return state.fundamentals[symbol];
    }

    const key = this.getKey();
    if (!key) throw new Error('API key is not configured.');

    if (provider === 'alphavantage') {
      const url = `https://www.alphavantage.co/query?function=OVERVIEW&symbol=${encodeURIComponent(symbol)}&apikey=${encodeURIComponent(key)}`;
      const res = await fetch(url);
      const d = await res.json();
      if (!d || !d.Symbol) return existing;

      const eps = parseFloat(d.EPS) || existing.eps || 0;
      const bvps = parseFloat(d.BookValue) || existing.bvps || 0;
      const divYield = parseFloat(d.DividendYield) ? Fin.round(parseFloat(d.DividendYield) * 100, 2) : (existing.divYield || 0);
      const roe = parseFloat(d.ReturnOnEquityTTM) ? Fin.round(parseFloat(d.ReturnOnEquityTTM) * 100, 2) : (existing.roe || 0);

      return {
        ...existing,
        name: d.Name || existing.name || symbol,
        sector: d.Sector || existing.sector || 'Technology',
        pe: parseFloat(d.PERatio) || existing.pe || 0,
        fwdPe: parseFloat(d.ForwardPE) || existing.fwdPe || 0,
        eps,
        bvps,
        marketCap: Fin.compactNumber(d.MarketCapitalization) || existing.marketCap || '-',
        roe,
        divYield,
        fcfPerShare: existing.fcfPerShare || Fin.round(eps * 0.9, 2)
      };
    }

    if (provider === 'finnhub') {
      const metricUrl = `https://finnhub.io/api/v1/stock/metric?symbol=${encodeURIComponent(symbol)}&metric=all&token=${encodeURIComponent(key)}`;
      const res = await fetch(metricUrl);
      const d = await res.json();
      const m = d?.metric || {};

      const eps = parseFloat(m.epsNormalizedAnnual || m.epsBasicExclExtraItemsTTM) || existing.eps || 0;
      const bvps = parseFloat(m.bookValuePerShareAnnual || m.bookValuePerShareQuarterly) || existing.bvps || 0;

      return {
        ...existing,
        pe: Fin.round(parseFloat(m.peNormalizedAnnual || m.peBasicExclExtraTTM) || existing.pe || 0, 2),
        fwdPe: existing.fwdPe || 0,
        eps: Fin.round(eps, 2),
        bvps: Fin.round(bvps, 2),
        marketCap: m.marketCapitalization ? Fin.compactNumber(m.marketCapitalization * 1e6) : (existing.marketCap || '-'),
        debtEquity: Fin.round(parseFloat(m['totalDebt/totalEquityAnnual']) || existing.debtEquity || 0, 2),
        roe: Fin.round(parseFloat(m.roeTTM || m.roeRfy) || existing.roe || 0, 2),
        divYield: Fin.round(parseFloat(m.dividendYieldIndicatedAnnual) || existing.divYield || 0, 2),
        fcfPerShare: Fin.round(parseFloat(m.pfcfShareTTM ? (state.prices[symbol]?.price || 100) / m.pfcfShareTTM : eps * 0.9), 2)
      };
    }

    return existing;
  },

  /**
   * Classifies a news headline into Catalyst Tag & Financial Sentiment Score (-1.0 to +1.0)
   */
  classifyHeadline(title, summary = '') {
    const text = `${title || ''} ${summary || ''}`.toLowerCase();
    let catalyst = 'CORPORATE';
    if (/\b(dividend|ex-dividend|payout|distribution|yield)\b/i.test(text)) catalyst = 'DIVIDEND';
    else if (/\b(buyback|repurchase|share cancellation)\b/i.test(text)) catalyst = 'BUYBACK';
    else if (/\b(earnings|quarterly results|interim results|annual results|operating profit|net profit|revenue)\b/i.test(text)) catalyst = 'EARNINGS';
    else if (/\b(target price|upgraded|downgraded|overweight|outperform|broker|rating)\b/i.test(text)) catalyst = 'ANALYST';
    else if (/\b(hang seng|fed|interest rate|treasury|gold|etf|inflows|pboc|stimulus|a50)\b/i.test(text)) catalyst = 'MACRO / ETF';

    const bullPatterns = [
      /\bbeats?\b/i, /\bsurge[sd]?\b/i, /\brecord\b.*\b(profit|inflows?|high|revenue|distribution)\b/i,
      /\bbuyback\b/i, /\brepurchase\b/i, /\b(raises?|declares?|approves?|maintains?|hikes?|increases?)\b.*\b(dividend|payout|distribution)\b/i,
      /\bspecial dividend\b/i, /\bupgrade[sd]?\b/i, /\boutperform\b/i, /\boverweight\b/i, /\bresilient\b/i,
      /\bnet profit up\b/i, /\bstrong\b.*\b(inflows?|growth|demand|value|earnings|results)\b/i, /\brally\b/i
    ];
    const bearPatterns = [
      /\bmiss(es|ed)?\b/i, /\bprofit warning\b/i, /\b(cuts?|suspends?|omits?|reduces?)\b.*\b(dividend|payout)\b/i,
      /\bdowngrade[sd]?\b/i, /\bunderperform\b/i, /\bunderweight\b/i, /\bplunge[sd]?\b/i, /\bnet profit down\b/i,
      /\bprobe\b/i, /\blawsuit\b/i, /\boutflows?\b/i, /\bslump[sd]?\b/i
    ];

    let bullHits = 0;
    let bearHits = 0;
    bullPatterns.forEach(p => { if (p.test(text)) bullHits++; });
    bearPatterns.forEach(p => { if (p.test(text)) bearHits++; });

    const score = Fin.round(Math.max(-1.0, Math.min(1.0, bullHits * 0.45 - bearHits * 0.50)), 2);
    const label = score >= 0.25 ? 'BULLISH' : (score <= -0.25 ? 'BEARISH' : 'NEUTRAL');
    return { catalyst, sentimentScore: score, sentimentLabel: label };
  },

  /**
   * Fetches live news for a ticker via Yahoo Finance Search API through CORS proxy
   */
  async fetchTickerNewsLive(rawTicker, maxArticles = 5) {
    const symbol = this.normalizeTicker(rawTicker);
    const staticMeta = this.getStaticProfile(symbol);
    const companyName = state?.fundamentals?.[symbol]?.name || staticMeta.name || symbol;
    const sector = state?.fundamentals?.[symbol]?.sector || staticMeta.sector || 'Equities';

    const u1 = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(symbol)}&quotesCount=1&newsCount=${maxArticles}`;
    const u2 = `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(symbol)}&quotesCount=1&newsCount=${maxArticles}`;
    let data = null;
    const workerBase = String(this.cloudflareWorkerUrl || CLOUDFLARE_WORKER_URL || '').replace(/\/+$/, '');
    if (workerBase) {
      try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 7000);
        const res = await fetch(`${workerBase}/?url=${encodeURIComponent(u1)}&_=${Date.now()}`, { signal: ctrl.signal, cache: 'no-store' });
        clearTimeout(timer);
        if (res.ok) {
          data = await res.json();
          this.lastRouteUsed = 'Cloudflare Worker News Proxy (myportfolio-quotes.pages.dev)';
        }
      } catch (_) {}
    }
    if (!data || !Array.isArray(data.news)) {
      data = await this.fetchYahooJson([u1, u2], `news_${symbol}`);
    }
    const newsList = data?.news || [];
    const articles = [];

    newsList.forEach(item => {
      const title = String(item.title || '').trim();
      const link = String(item.link || '').trim();
      if (!title || !link) return;
      const ts = Number(item.providerPublishTime || 0);
      const pubIso = ts > 0 ? new Date(ts * 1000).toISOString() : new Date().toISOString();
      const cls = this.classifyHeadline(title);
      articles.push({
        id: `live_${symbol}_${ts || Date.now()}`,
        ticker: symbol,
        companyName,
        sector,
        title,
        publisher: item.publisher || 'Yahoo Finance',
        publishedAt: pubIso,
        url: link,
        sourceType: 'YahooSearchLive',
        catalyst: cls.catalyst,
        sentimentScore: cls.sentimentScore,
        sentimentLabel: cls.sentimentLabel,
        summary: title
      });
    });
    return articles;
  },

  async fetchLiveFxRates() {
    const pairs = [
      { key: 'fxUsdHkd', sym: 'USDHKD=X' },
      { key: 'fxGbpUsd', sym: 'GBPUSD=X' },
      { key: 'fxGbpHkd', sym: 'GBPHKD=X' }
    ];
    let updated = 0;
    for (const p of pairs) {
      try {
        const q = await this.fetchQuote(p.sym);
        if (q && q.price > 0) {
          state.settings[p.key] = Fin.round(q.price, 4);
          updated++;
        }
      } catch (_) {}
    }
    return updated;
  },

  async runDiagnosticTest(tickers = ['2800.HK', 'VOO']) {
    const results = [];
    for (const raw of tickers) {
      const t0 = performance.now();
      const normalized = this.normalizeTicker(raw);
      const itemResult = {
        input: raw,
        symbol: normalized,
        quoteOk: false,
        historyOk: false,
        fundamentalsOk: false,
        price: null,
        prevPrice: null,
        change: null,
        changePct: null,
        currency: null,
        name: null,
        monthsCount: 0,
        firstMonth: null,
        lastMonth: null,
        pe: null,
        divYield: null,
        marketCap: null,
        route: null,
        latencyMs: 0,
        error: null
      };

      try {
        const q = await this.fetchQuote(normalized);
        if (q && q.price > 0) {
          itemResult.quoteOk = true;
          itemResult.price = q.price;
          itemResult.prevPrice = q.prevPrice;
          itemResult.change = q.change;
          itemResult.changePct = q.changePct;
          itemResult.currency = q.currency || (normalized.endsWith('.HK') ? 'HKD' : 'USD');
          itemResult.name = q.name || normalized;
          itemResult.route = q.source || this.lastRouteUsed;

          state.prices[normalized] = {
            price: q.price,
            prevPrice: q.prevPrice,
            change: q.change,
            changePct: q.changePct,
            currency: itemResult.currency,
            lastUpdated: new Date().toISOString()
          };
        }

        const hist = await this.fetchMonthlyHistory(normalized);
        if (Array.isArray(hist) && hist.length > 0) {
          itemResult.historyOk = true;
          itemResult.monthsCount = hist.length;
          itemResult.firstMonth = hist[0].month;
          itemResult.lastMonth = hist[hist.length - 1].month;
          state.historicalPrices[normalized] = hist;
        }

        const fund = await this.fetchFundamentals(normalized);
        if (fund) {
          itemResult.fundamentalsOk = true;
          itemResult.pe = fund.pe || '-';
          itemResult.divYield = fund.divYield ?? '-';
          itemResult.marketCap = fund.marketCap || '-';
          state.fundamentals[normalized] = fund;
        }

        const isHeld = portfolio?.activeHoldings?.some(h => h.ticker === normalized);
        const isWatched = state.watchlist.some(w => w.ticker === normalized);
        if (!isHeld && !isWatched && itemResult.price > 0) {
          state.watchlist.push({
            ticker: normalized,
            name: itemResult.name || normalized,
            sector: state.fundamentals[normalized]?.sector || 'Index ETF',
            targetBuyPrice: Fin.round(itemResult.price * 0.95, 2)
          });
        }
      } catch (err) {
        itemResult.error = err.message || String(err);
      }

      itemResult.latencyMs = Math.round(performance.now() - t0);
      results.push(itemResult);
    }

    state.settings.lastApiSync = new Date().toISOString();
    recalculatePortfolio();
    saveState();
    renderAll();
    return results;
  }
};

function getLocalTodayDateString() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
window.getLocalTodayDateString = getLocalTodayDateString;

function getAllPortfolioAndWatchlistTickers() {
  return Array.from(new Set([
    ...((portfolio?.allHoldings && portfolio.allHoldings.length > 0) ? portfolio.allHoldings : (portfolio?.activeHoldings || [])).map(h => h.ticker),
    ...(state?.transactions || []).map(t => t.ticker),
    ...(state?.watchlist || []).map(w => w.ticker)
  ])).map(t => MarketAPI.normalizeTicker(t)).filter(Boolean);
}
window.getAllPortfolioAndWatchlistTickers = getAllPortfolioAndWatchlistTickers;

async function syncHistoricalPricesFromCloudflare(manual = true, customTickers = null) {
  if (window.__CF_HISTORY_SYNC_IN_FLIGHT__ && !manual) return false;
  window.__CF_HISTORY_SYNC_IN_FLIGHT__ = true;
  const tStart = performance.now();
  const targetTickers = Array.isArray(customTickers) && customTickers.length > 0
    ? Array.from(new Set(customTickers.map(t => MarketAPI.normalizeTicker(t)).filter(Boolean)))
    : getAllPortfolioAndWatchlistTickers();

  if (targetTickers.length === 0) {
    window.__CF_HISTORY_SYNC_IN_FLIGHT__ = false;
    return false;
  }

  const icons = [
    document.getElementById('btn-fetch-monthly-icon'),
    document.querySelector('#btn-trigger-gh-prices i')
  ].filter(Boolean);
  icons.forEach(ic => ic.classList.add('fa-spin'));

  if (manual && typeof showToast === 'function') {
    showToast(`Fetching 15Y monthly prices & dividends for ${targetTickers.length} tickers via Cloudflare Worker...`, 'info');
  }

  try {
    const { historyCount, dividendCount } = await MarketAPI.fetchCloudflareHistoryAndDividends(targetTickers, 'history');
    const nowIso = new Date().toISOString();
    if (state && state.settings) {
      state.settings.lastHistoricalPricesUpdate = nowIso;
      state.settings.lastDividendsUpdate = nowIso;
    }
    recalculatePortfolio();
    saveState();
    renderAll();
    if (typeof renderFooterUpdateTimestamps === 'function') renderFooterUpdateTimestamps();

    const elapsed = Math.round(performance.now() - tStart);
    if (typeof AppLogger !== 'undefined') {
      AppLogger.info('CloudflareHistory', `Synced 15Y monthly history (${historyCount} series) & dividends (${dividendCount} schedules) in ${elapsed}ms.`);
      if (typeof renderLogsTab === 'function') renderLogsTab();
    }
    if (manual && typeof showToast === 'function') {
      showToast(`Refreshed 15Y monthly history (${historyCount}/${targetTickers.length}) & dividends in ${elapsed}ms!`, 'success');
    }
    return historyCount > 0;
  } catch (err) {
    if (manual && typeof showToast === 'function') {
      showToast(`History sync notice: ${err.message}`, 'error');
    }
    return false;
  } finally {
    window.__CF_HISTORY_SYNC_IN_FLIGHT__ = false;
    icons.forEach(ic => ic.classList.remove('fa-spin'));
  }
}
window.syncHistoricalPricesFromCloudflare = syncHistoricalPricesFromCloudflare;
window.loadHistoricalPricesFromJson = (silent = true) => syncHistoricalPricesFromCloudflare(!silent);

async function syncDividendsFromCloudflare(manual = true, customTickers = null) {
  const tStart = performance.now();
  const targetTickers = Array.isArray(customTickers) && customTickers.length > 0
    ? Array.from(new Set(customTickers.map(t => MarketAPI.normalizeTicker(t)).filter(Boolean)))
    : getAllPortfolioAndWatchlistTickers();

  if (targetTickers.length === 0) {
    if (manual && typeof showToast === 'function') {
      showToast('Add a stock holding or watchlist ticker first.', 'info');
    }
    return false;
  }

  const divIcons = [
    document.querySelector('#btn-sync-dividends-live i'),
    document.querySelector('#btn-sync-dividends-cal i'),
    document.querySelector('#btn-settings-sync-dividends i')
  ].filter(Boolean);
  divIcons.forEach(ic => ic.classList.add('fa-spin'));

  if (manual && typeof showToast === 'function') {
    showToast(`Refreshing dividend history, yields & ex-dates for ${targetTickers.length} tickers via Cloudflare Worker...`, 'info');
  }

  try {
    const { dividendCount } = await MarketAPI.fetchCloudflareHistoryAndDividends(targetTickers, 'dividends');
    if (state && state.settings) {
      state.settings.lastDividendsUpdate = new Date().toISOString();
    }
    recalculatePortfolio();
    saveState();
    renderAll();
    if (typeof renderFooterUpdateTimestamps === 'function') renderFooterUpdateTimestamps();

    const elapsed = Math.round(performance.now() - tStart);
    if (typeof AppLogger !== 'undefined') {
      AppLogger.info('CloudflareDividends', `Refreshed ${dividendCount}/${targetTickers.length} dividend schedules in ${elapsed}ms.`);
      if (typeof renderLogsTab === 'function') renderLogsTab();
    }
    if (manual && typeof showToast === 'function') {
      showToast(`Refreshed dividend schedules & ex-dates for ${dividendCount}/${targetTickers.length} tickers (${elapsed}ms)!`, 'success');
    }
    return dividendCount > 0;
  } catch (err) {
    if (manual && typeof showToast === 'function') {
      showToast(`Dividend refresh notice: ${err.message}`, 'error');
    }
    return false;
  } finally {
    divIcons.forEach(ic => ic.classList.remove('fa-spin'));
  }
}
window.syncDividendsFromCloudflare = syncDividendsFromCloudflare;

async function syncCompanyNewsLive(manual = true, customTickers = null) {
  if (window.__CF_NEWS_SYNC_IN_FLIGHT__ && !manual) return false;
  window.__CF_NEWS_SYNC_IN_FLIGHT__ = true;
  const tStart = performance.now();
  const targetTickers = Array.isArray(customTickers) && customTickers.length > 0
    ? Array.from(new Set(customTickers.map(t => MarketAPI.normalizeTicker(t)).filter(Boolean)))
    : getAllPortfolioAndWatchlistTickers();

  const newsIcons = [
    document.querySelector('#btn-sync-news-live i'),
    document.querySelector('#btn-trigger-gh-news i')
  ].filter(Boolean);
  newsIcons.forEach(ic => ic.classList.add('fa-spin'));

  if (manual && typeof showToast === 'function') {
    showToast(`Fetching latest company & ETF news for ${targetTickers.length} tickers via Cloudflare Worker...`, 'info');
  }

  try {
    const articles = await MarketAPI.fetchCloudflareNewsBatch(targetTickers, 6);
    if (typeof ingestCompanyNewsData === 'function') {
      ingestCompanyNewsData({
        generatedAt: new Date().toISOString(),
        articles
      });
    }
    saveState();
    if (typeof renderNewsTab === 'function') renderNewsTab();
    if (typeof renderFooterUpdateTimestamps === 'function') renderFooterUpdateTimestamps();

    const count = Array.isArray(state?.companyNews) ? state.companyNews.length : 0;
    const elapsed = Math.round(performance.now() - tStart);
    if (typeof AppLogger !== 'undefined') {
      AppLogger.info('CloudflareNews', `News refresh completed in ${elapsed}ms: ${count} total articles cached (${articles.length} fetched).`);
      if (typeof renderLogsTab === 'function') renderLogsTab();
    }
    if (manual && typeof showToast === 'function') {
      showToast(`Refreshed ${count} company & ETF news articles via Cloudflare Worker (${elapsed}ms)!`, 'success');
    }
    return articles.length > 0;
  } catch (err) {
    if (manual && typeof showToast === 'function') {
      showToast(`News refresh notice: ${err.message}`, 'error');
    }
    return false;
  } finally {
    window.__CF_NEWS_SYNC_IN_FLIGHT__ = false;
    newsIcons.forEach(ic => ic.classList.remove('fa-spin'));
  }
}
window.syncCompanyNewsLive = syncCompanyNewsLive;
window.loadCompanyNewsFromJson = (silent = true) => syncCompanyNewsLive(!silent);

/**
 * Option 1 Daily Date-Stamp Auto-Refresh:
 * Checks if today's local date (YYYY-MM-DD) differs from state.settings.lastDailySyncDate,
 * or if any active/watchlist ticker is missing 15Y monthly history in localStorage.
 * Triggered on initial page load, on every 30s active-page timer tick, and on tab visibility restore.
 */
async function checkAndRunDailyCloudflareSync(forceAll = false) {
  if (!state || !state.settings) return;
  const allTickers = getAllPortfolioAndWatchlistTickers();
  if (allTickers.length === 0) return;

  const todayStr = getLocalTodayDateString();
  const isNewCalendarDay = (state.settings.lastDailySyncDate !== todayStr);
  const missingHistoryTickers = allTickers.filter(sym => !Array.isArray(state.historicalPrices?.[sym]) || state.historicalPrices[sym].length === 0);
  const hasEmptyNews = !Array.isArray(state.companyNews) || state.companyNews.length === 0;

  if (forceAll || isNewCalendarDay) {
    state.settings.lastDailySyncDate = todayStr;
    saveState();
    if (typeof AppLogger !== 'undefined') {
      AppLogger.info('DailyAutoSync', `First active session of ${todayStr} — auto-fetching 15Y monthly prices, dividends & news via Cloudflare Worker.`);
    }
    await Promise.allSettled([
      syncHistoricalPricesFromCloudflare(false, allTickers),
      syncCompanyNewsLive(false, allTickers)
    ]);
  } else {
    if (missingHistoryTickers.length > 0) {
      await syncHistoricalPricesFromCloudflare(false, missingHistoryTickers);
    }
    if (hasEmptyNews) {
      await syncCompanyNewsLive(false, allTickers);
    }
  }
}
window.checkAndRunDailyCloudflareSync = checkAndRunDailyCloudflareSync;

async function syncAllMarketData(refreshHistoryAndDivs = false, options = {}) {
  const isAutoTimer = Boolean(options && options.isAutoTimer);
  const isAutoStartup = Boolean((options && options.isAutoStartup) || isAutoTimer);
  if (window.__LIVE_PRICE_SYNC_IN_FLIGHT__ && isAutoStartup && !refreshHistoryAndDivs) {
    return;
  }
  window.__LIVE_PRICE_SYNC_IN_FLIGHT__ = true;
  const tStart = performance.now();
  if (typeof AppLogger !== 'undefined') {
    const syncLabel = isAutoTimer
      ? 'Auto 30s active-page live price sync'
      : (isAutoStartup ? 'Initial page-load auto live price sync' : (refreshHistoryAndDivs ? 'Manual 15Y History + Live Price Sync' : 'Live Price Sync button pressed'));
    AppLogger.action('Sync', `${syncLabel} (provider=${MarketAPI.getProvider()})`);
  }

  if (!MarketAPI.hasKey()) {
    window.__LIVE_PRICE_SYNC_IN_FLIGHT__ = false;
    if (!isAutoStartup) {
      showToast('Please select Yahoo Finance (Keyless) or configure your API Key in Settings.', 'error');
      switchTab('settings');
    }
    return;
  }

  const allTickers = getAllPortfolioAndWatchlistTickers();
  if (allTickers.length === 0) {
    window.__LIVE_PRICE_SYNC_IN_FLIGHT__ = false;
    if (!isAutoStartup) {
      showToast('Add a stock transaction or watchlist ticker first.', 'info');
    }
    return;
  }

  const syncIcons = [
    document.getElementById('header-sync-icon'),
    document.getElementById('mobile-sync-icon'),
    document.getElementById('btn-fetch-monthly-icon'),
    document.getElementById('btn-refresh-prices-icon')
  ].filter(Boolean);
  syncIcons.forEach(ic => ic.classList.add('fa-spin'));

  if (!isAutoStartup) {
    showToast(
      refreshHistoryAndDivs
        ? `Refreshing 15Y monthly history, dividends & live quotes (${allTickers.length} tickers)...`
        : `Syncing live market prices for ${allTickers.length} tickers...`,
      'info'
    );
  }

  if (refreshHistoryAndDivs) {
    await syncHistoricalPricesFromCloudflare(false, allTickers);
  } else {
    // Check Option 1 daily date-stamp rollover (runs once per calendar day or if any ticker lacks history)
    checkAndRunDailyCloudflareSync(false).catch(() => {});
  }

  let updatedQuotes = 0;
  let cfWorkerCount = 0;
  let corsFallbackCount = 0;
  let snapshotQuoteCount = 0;
  const errors = [];
  const stagedPrices = {};
  const flashDirections = {};

  let batchQuotes = {};
  if (MarketAPI.getProvider() === 'yahoo') {
    try {
      batchQuotes = await MarketAPI.fetchCloudflareBatchQuotes(allTickers, 8000);
      cfWorkerCount = Object.keys(batchQuotes).length;
    } catch (_) {}
  }

  await Promise.allSettled(allTickers.map(async (ticker) => {
    try {
      const batchCandidate = batchQuotes[ticker];
      let q = (batchCandidate && batchCandidate.price > 0) ? batchCandidate : null;
      let isLive = Boolean(q);
      if (!q) {
        try {
          q = await MarketAPI.fetchQuote(ticker);
          isLive = Boolean(q && (!q.source || !q.source.includes('Cached')));
        } catch (fetchErr) {
          if (state.prices[ticker] && Number(state.prices[ticker].price) > 0) {
            return;
          }
          q = MarketAPI.getEmbeddedOrCachedQuote(ticker);
          isLive = false;
        }
      }
      if (q && q.price > 0) {
        const prevDisplayed = state.prices[ticker]?.price || q.prevPrice;
        stagedPrices[ticker] = {
          price: q.price,
          prevPrice: q.prevPrice,
          change: q.change,
          changePct: q.changePct,
          high52w: q.high52w || state.fundamentals[ticker]?.high52w || null,
          low52w: q.low52w || state.fundamentals[ticker]?.low52w || null,
          currency: q.currency || 'HKD',
          lastUpdated: new Date().toISOString(),
          _isLiveQuote: isLive
        };
        if (Math.abs(q.price - prevDisplayed) > 1e-5) {
          flashDirections[ticker] = q.price >= prevDisplayed;
        }
        updatedQuotes++;
        if (q.source && q.source.includes('Cached')) snapshotQuoteCount++;
        else if (!batchCandidate && q.source && !q.source.includes('Cloudflare')) corsFallbackCount++;
      }
    } catch (err) {
      errors.push(`${ticker}: ${err.message}`);
    }
  }));

  Object.entries(stagedPrices).forEach(([ticker, quoteObj]) => {
    state.prices[ticker] = quoteObj;
  });

  window.__LAST_LIVE_SYNC_TS__ = Date.now();
  window.__LIVE_PRICE_SYNC_IN_FLIGHT__ = false;
  state.settings.lastApiSync = new Date().toISOString();
  recalculatePortfolio();
  saveState();

  const prevWinScrollY = typeof window !== 'undefined' ? window.scrollY : 0;
  if (isAutoTimer) {
    try { if (typeof renderApiStatusUI === 'function') renderApiStatusUI(); } catch (_) {}
    try { if (typeof renderKPIs === 'function') renderKPIs(); } catch (_) {}
    try {
      const activeTab = typeof getActiveTabName === 'function' ? getActiveTabName() : 'dashboard';
      if (activeTab === 'dashboard' && typeof renderCharts === 'function') {
        renderCharts();
      } else if (activeTab === 'holdings') {
        if (typeof renderHoldingsTable === 'function') renderHoldingsTable();
        if (typeof renderInlineStockChart === 'function') renderInlineStockChart('holdings');
      } else if (activeTab === 'watchlist') {
        if (typeof renderWatchlistAndFundamentals === 'function') renderWatchlistAndFundamentals();
        if (typeof renderInlineStockChart === 'function') renderInlineStockChart('watchlist');
      } else if (activeTab === 'transactions' && typeof renderTradesBalanceCashflowChart === 'function') {
        renderTradesBalanceCashflowChart();
      }
      if (typeof _allTabNames !== 'undefined' && typeof markTabDirty === 'function') {
        _allTabNames.forEach(t => { if (t !== activeTab) markTabDirty(t); });
      }
    } catch (_) {}
    if (typeof window !== 'undefined' && Math.abs(window.scrollY - prevWinScrollY) > 2) {
      window.scrollTo(window.scrollX, prevWinScrollY);
    }
  } else {
    renderAll();
  }

  Object.entries(flashDirections).forEach(([ticker, isUp]) => {
    triggerRowPriceFlash(ticker, isUp);
  });

  syncIcons.forEach(ic => ic.classList.remove('fa-spin'));
  const elapsed = Math.round(performance.now() - tStart);

  if (typeof AppLogger !== 'undefined') {
    AppLogger.info(
      'Sync',
      `Sync completed in ${elapsed}ms: ${updatedQuotes}/${allTickers.length} quotes updated (${cfWorkerCount} Cloudflare Worker, ${corsFallbackCount} Yahoo CORS secondary).`
    );
    if (typeof renderLogsTab === 'function') renderLogsTab();
  }

  if (errors.length > 0 && updatedQuotes === 0) {
    if (!isAutoStartup) showToast(`Live price sync error — ${errors[0]}`, 'error');
  } else if (!isAutoStartup) {
    showToast(`Synced ${updatedQuotes}/${allTickers.length} live market prices (${elapsed}ms).`, 'success');
  }
}

async function runAndRenderApiDiagnostics(customTickers = null) {
  const inputEl = document.getElementById('diag-test-tickers-input');
  const rawStr = customTickers || (inputEl && inputEl.value.trim()) || '2800.HK, VOO';
  const tickerList = rawStr.split(/[\s,]+/).map(s => s.trim()).filter(Boolean);
  if (tickerList.length === 0) return;

  const box = document.getElementById('api-diagnostic-results-box');
  if (box) {
    box.classList.remove('hidden');
    box.innerHTML = `<div class="p-4 text-xs text-slate-500 flex items-center gap-2"><i class="fa-solid fa-circle-notch fa-spin text-brand-500"></i> Running live API diagnostic test on <strong>${tickerList.join(', ')}</strong>...</div>`;
  }
  showToast(`Testing Yahoo Finance API for ${tickerList.join(', ')}...`, 'info');

  const results = await MarketAPI.runDiagnosticTest(tickerList);

  if (box) {
    const rowsHtml = results.map(r => {
      const allPass = r.quoteOk && r.historyOk;
      const badge = allPass
        ? `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-500 border border-emerald-500/30">PASS (${r.latencyMs}ms)</span>`
        : `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-500 border border-rose-500/30">FAIL</span>`;
      const chgColor = (r.change || 0) >= 0 ? 'text-emerald-500' : 'text-rose-500';
      return `
        <tr class="border-b border-slate-200/60 dark:border-slate-800">
          <td class="py-2.5 px-3 font-bold text-slate-900 dark:text-white">
            <div>${r.symbol}</div>
            <div class="text-[10px] font-normal text-slate-400">${r.name || ''}</div>
          </td>
          <td class="py-2.5 px-3 text-center">${badge}</td>
          <td class="py-2.5 px-3 text-right num-font font-bold text-slate-900 dark:text-white">
            ${r.price ? Fin.currency(r.price, false, r.currency) : '-'}
            <div class="text-[10px] ${chgColor}">${r.changePct !== null ? Fin.percent(r.changePct) : ''}</div>
          </td>
          <td class="py-2.5 px-3 text-right num-font text-slate-700 dark:text-slate-300">
            ${r.monthsCount > 0 ? `<strong>${r.monthsCount} mos</strong> <span class="text-[10px] text-slate-400">(${r.firstMonth} &rarr; ${r.lastMonth})</span>` : '0 mos'}
          </td>
          <td class="py-2.5 px-3 text-right num-font text-slate-600 dark:text-slate-300">
            P/E: <strong>${r.pe}</strong> &bull; Yield: <strong>${r.divYield !== '-' ? r.divYield + '%' : '-'}</strong>
          </td>
          <td class="py-2.5 px-3 text-[11px] text-slate-500 dark:text-slate-400">${r.route || r.error || '-'}</td>
          <td class="py-2.5 px-3 text-center">
            <button onclick="viewStockHistoryOnDashboard('${r.symbol}')" class="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-semibold transition">
              View Chart
            </button>
          </td>
        </tr>
      `;
    }).join('');

    box.innerHTML = `
      <div class="p-3.5 bg-slate-100/80 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-2">
        <div class="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <i class="fa-solid fa-vial-circle-check text-emerald-500"></i>
          <span>API Diagnostic Report (${new Date().toLocaleTimeString()})</span>
        </div>
        <span class="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">Live API Route Verification</span>
      </div>
      <div class="table-responsive-wrapper">
        <table class="w-full text-left text-xs whitespace-nowrap">
          <thead class="bg-slate-50 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400 text-[10px] uppercase font-semibold border-b border-slate-200 dark:border-slate-800">
            <tr>
              <th class="py-2 px-3">Ticker</th>
              <th class="py-2 px-3 text-center">Status</th>
              <th class="py-2 px-3 text-right">Live Quote</th>
              <th class="py-2 px-3 text-right">Monthly Series</th>
              <th class="py-2 px-3 text-right">Fundamentals</th>
              <th class="py-2 px-3">Data Route</th>
              <th class="py-2 px-3 text-center">Action</th>
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      </div>
    `;
  }

  const passCount = results.filter(r => r.quoteOk && r.historyOk).length;
  showToast(
    `API Test Complete: ${passCount}/${results.length} passed`,
    passCount === results.length ? 'success' : 'error'
  );
  return results;
}
window.runAndRenderApiDiagnostics = runAndRenderApiDiagnostics;

async function syncFundamentalsViaAPI() {
  if (!MarketAPI.hasKey()) {
    showToast('Configure your API settings first.', 'error');
    switchTab('settings');
    return;
  }

  const allTickers = Array.from(new Set([
    ...portfolio.activeHoldings.map(h => h.ticker),
    ...state.watchlist.map(w => w.ticker)
  ]));

  if (allTickers.length === 0) {
    showToast('No tickers in Holdings or Watchlist to fetch.', 'info');
    return;
  }

  showToast(`Fetching company fundamentals for ${allTickers.length} ticker(s)...`, 'info');
  let count = 0;
  for (const t of allTickers) {
    try {
      const fund = await MarketAPI.fetchFundamentals(t);
      if (fund) {
        state.fundamentals[t] = fund;
        count++;
      }
    } catch (e) {
      console.warn(`Fundamentals fetch failed for ${t}:`, e.message);
    }
  }

  recalculatePortfolio();
  saveState();
  renderAll();
  showToast(`Updated fundamental metrics for ${count} ticker(s)!`, 'success');
}

function triggerRowPriceFlash(ticker, isUp) {
  const row = document.getElementById(`holding-row-${ticker}`);
  if (row) {
    row.classList.remove('flash-up', 'flash-down');
    void row.offsetWidth;
    row.classList.add(isUp ? 'flash-up' : 'flash-down');
  }
}

window.viewStockHistoryOnDashboard = async function(rawTicker) {
  const ticker = MarketAPI.normalizeTicker(rawTicker);
  const isHeld = portfolio?.activeHoldings?.some(h => h.ticker === ticker);
  if (isHeld) {
    switchTab('holdings');
    if (typeof selectStockForInlineChart === 'function') {
      await selectStockForInlineChart('holdings', ticker, true);
    }
  } else {
    switchTab('watchlist');
    if (typeof selectStockForInlineChart === 'function') {
      await selectStockForInlineChart('watchlist', ticker, true);
    }
  }
};

window.TICKER_STATIC_DIRECTORY = TICKER_STATIC_DIRECTORY;
window.MarketAPI = MarketAPI;
window.syncAllMarketData = syncAllMarketData;
window.syncFundamentalsViaAPI = syncFundamentalsViaAPI;
window.triggerRowPriceFlash = triggerRowPriceFlash;
