/**
 * @file api.js
 * @module MarketAPIModule
 * @version 3.1.0
 * @build 20261031_1650
 * @description Compartmentalized Global Stock Market API Client (HKEX, US NYSE/NASDAQ, London LSE).
 *   - Tier 1: Parallel Yahoo Finance v8 Chart Proxy Race (Promise.any) with 15y history + events=div
 *   - Tier 2: Zero-CORS Browser script-tag JSONP Quote Fallback (qt.gtimg.cn) for HK & US equities
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

var MarketAPI = {
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
    const isHkEtfCode = /^(28|30|31|34|72|73|75|828|90|91)\d{2,3}\.HK$/.test(sym);
    return {
      name: sym,
      sector: isHkEtfCode ? 'Index ETF' : 'Equities',
      currency
    };
  },

  isEtfSector(sectorName, ticker = '', companyName = '') {
    const sec = String(sectorName || '').trim();
    if (/\betf\b|index fund|exchange traded|inverse product/i.test(sec)) return true;
    const sym = this.normalizeTicker(ticker);
    if (TICKER_STATIC_DIRECTORY[sym]?.sector === 'Index ETF') return true;
    if (/^(28|30|31|34|72|73|75|828|90|91)\d{2,3}\.HK$/.test(sym)) return true;
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
      if (Date.now() - cached.ts < 30000) {
        return cached.data;
      }
    }

    const urls = Array.isArray(yahooPaths) ? yahooPaths : [yahooPaths];
    const proxySpecs = [
      {
        name: 'AllOrigins-JSON',
        unwrapAllOrigins: true,
        build: (u) => `https://api.allorigins.win/get?url=${encodeURIComponent(u)}&_=${Date.now()}`
      },
      {
        name: 'AllOrigins-Raw',
        unwrapAllOrigins: false,
        build: (u) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`
      },
      {
        name: 'CorsProxy-IO',
        unwrapAllOrigins: false,
        build: (u) => `https://corsproxy.io/?url=${encodeURIComponent(u)}`
      },
      {
        name: 'CodeTabs',
        unwrapAllOrigins: false,
        build: (u) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(u)}`
      },
      {
        name: 'ThingProxy',
        unwrapAllOrigins: false,
        build: (u) => `https://thingproxy.freeboard.io/fetch/${u}`
      }
    ];

    if (this._proxyCircuitOpenUntil && Date.now() < this._proxyCircuitOpenUntil) {
      throw new Error('CORS proxy circuit breaker active; try again shortly.');
    }

    try {
      const tasks = [];
      for (const targetUrl of urls) {
        for (const spec of proxySpecs) {
          tasks.push(this._tryProxyFetch(targetUrl, spec, 2600));
        }
      }
      const winner = await Promise.any(tasks);
      if (winner) {
        this._proxyCircuitOpenUntil = 0;
        if (cacheKey) {
          this._chartCache[cacheKey] = { ts: Date.now(), data: winner };
        }
        return winner;
      }
    } catch (aggErr) {
      const errors = aggErr?.errors || [aggErr];
      const symbolErr = errors.find(e => e?.isYahooSymbolError);
      if (symbolErr) throw symbolErr;
      this._proxyCircuitOpenUntil = Date.now() + 45000;
    }

    throw new Error('Browser CORS proxies rate-limited or unreachable.');
  },

  async fetchTencentJsonpQuote(symbol) {
    if (this._jsonpCircuitOpenUntil && Date.now() < this._jsonpCircuitOpenUntil) {
      throw new Error('JSONP circuit breaker active');
    }
    return new Promise((resolve, reject) => {
      let qCode = null;
      const hkMatch = symbol.match(/^(\d+)\.HK$/);
      if (hkMatch) {
        qCode = `r_hk${hkMatch[1].padStart(5, '0')}`;
      } else if (/^[A-Z]+(-[A-Z]+)?$/.test(symbol)) {
        qCode = `us${symbol.replace('-', '.')}`;
      } else {
        return reject(new Error('JSONP fallback supports HK and US tickers'));
      }

      const script = document.createElement('script');
      const timer = setTimeout(() => {
        this._jsonpCircuitOpenUntil = Date.now() + 45000;
        if (script && script.remove) script.remove();
        reject(new Error('JSONP quote timeout'));
      }, 1200);

      script.src = `https://qt.gtimg.cn/q=${qCode}&_=${Date.now()}`;
      script.onload = () => {
        clearTimeout(timer);
        if (script && script.remove) script.remove();
        const raw = window[`v_${qCode}`];
        if (!raw || typeof raw !== 'string') {
          return reject(new Error('Empty JSONP quote payload'));
        }
        const parts = raw.split('~');
        if (parts.length < 35) {
          return reject(new Error('Malformed JSONP quote payload'));
        }
        const price = parseFloat(parts[3]);
        const prevPrice = parseFloat(parts[4]) || price;
        if (!price || isNaN(price)) {
          return reject(new Error('Invalid price in JSONP payload'));
        }
        const change = Fin.round(price - prevPrice, 3);
        const changePct = prevPrice > 0 ? Fin.round(((price - prevPrice) / prevPrice) * 100, 2) : 0;
        const high52w = parseFloat(parts[48]) > 0 ? Fin.round(parseFloat(parts[48]), 4) : null;
        const low52w = parseFloat(parts[49]) > 0 ? Fin.round(parseFloat(parts[49]), 4) : null;
        const currency = hkMatch ? 'HKD' : 'USD';
        const staticMeta = this.getStaticProfile(symbol);
        const name = state?.fundamentals?.[symbol]?.name || staticMeta.name || parts[1] || symbol;
        this.lastRouteUsed = 'Direct Browser JSONP (qt.gtimg.cn)';
        resolve({ price, prevPrice, change, changePct, high52w, low52w, currency, name, source: this.lastRouteUsed });
      };
      script.onerror = () => {
        clearTimeout(timer);
        if (script && script.remove) script.remove();
        reject(new Error('JSONP script load blocked'));
      };
      document.head.appendChild(script);
    });
  },

  async fetchQuote(ticker) {
    const symbol = this.normalizeTicker(ticker);
    const provider = this.getProvider();
    const staticMeta = this.getStaticProfile(symbol);

    if (provider === 'yahoo') {
      try {
        const q1 = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=5d&interval=1d&includePrePost=false`;
        const q2 = `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=5d&interval=1d&includePrePost=false`;

        const data = await this.fetchYahooJson([q1, q2], `quote_${symbol}`);
        const result = data?.chart?.result?.[0];
        if (result && result.meta) {
          const meta = result.meta;
          const closes = (result.indicators?.quote?.[0]?.close || []).filter(v => v !== null && v !== undefined && !isNaN(v));
          const price = parseFloat(meta.regularMarketPrice ?? closes[closes.length - 1]);
          if (price && !isNaN(price)) {
            // Priority: yesterday's daily close from 5d/1d bars or regularMarketPreviousClose (NEVER multi-year chartPreviousClose)
            let prevPrice = (closes.length >= 2 ? parseFloat(closes[closes.length - 2]) : NaN);
            if (!prevPrice || isNaN(prevPrice)) {
              prevPrice = parseFloat(meta.regularMarketPreviousClose ?? meta.previousClose);
            }
            if (!prevPrice || isNaN(prevPrice) || prevPrice <= 0) {
              prevPrice = price;
            }

            // Sanity guard: prevent multi-year inception prices (e.g. 1.118 vs 12.30 = +1000%) from polluting 1-day change %
            if (prevPrice > 0 && Math.abs((price - prevPrice) / prevPrice) > 0.40) {
              if (closes.length >= 2 && closes[closes.length - 2] > 0 && Math.abs((price - closes[closes.length - 2]) / closes[closes.length - 2]) <= 0.40) {
                prevPrice = parseFloat(closes[closes.length - 2]);
              } else {
                prevPrice = price;
              }
            }

            const change = Fin.round(price - prevPrice, 3);
            const changePct = prevPrice > 0 ? Fin.round(((price - prevPrice) / prevPrice) * 100, 2) : 0;
            const currency = meta.currency || staticMeta.currency;
            const longName = meta.longName || meta.shortName || state?.fundamentals?.[symbol]?.name || staticMeta.name || symbol;

            const existingFund = state.fundamentals[symbol] || {};
            const inferredSector = (meta.instrumentType === 'ETF' || this.isEtfSector(existingFund.sector, symbol, longName))
              ? 'Index ETF'
              : (existingFund.sector || staticMeta.sector || 'Equities');
            const high52w = meta.fiftyTwoWeekHigh ? Fin.round(parseFloat(meta.fiftyTwoWeekHigh), 4) : (existingFund.high52w || null);
            const low52w = meta.fiftyTwoWeekLow ? Fin.round(parseFloat(meta.fiftyTwoWeekLow), 4) : (existingFund.low52w || null);
            state.fundamentals[symbol] = {
              ...existingFund,
              name: existingFund.name && existingFund.name !== symbol ? existingFund.name : longName,
              sector: inferredSector,
              currency,
              high52w,
              low52w
            };

            return { price, prevPrice, change, changePct, high52w, low52w, currency, name: longName, source: this.lastRouteUsed };
          }
        }
      } catch (yahooErr) {
        try {
          const jsonpQuote = await this.fetchTencentJsonpQuote(symbol);
          if (jsonpQuote && jsonpQuote.price > 0) {
            const existingFund = state.fundamentals[symbol] || {};
            state.fundamentals[symbol] = {
              ...existingFund,
              name: existingFund.name || jsonpQuote.name || staticMeta.name || symbol,
              sector: existingFund.sector || staticMeta.sector || 'Equities',
              currency: jsonpQuote.currency,
              high52w: jsonpQuote.high52w || existingFund.high52w || null,
              low52w: jsonpQuote.low52w || existingFund.low52w || null
            };
            return jsonpQuote;
          }
        } catch (_) {}
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
   * Fetches monthly historical prices (up to 15 years of monthly closes + full 2018+ dividend events).
   */
  async fetchMonthlyHistory(ticker) {
    const symbol = this.normalizeTicker(ticker);
    const provider = this.getProvider();

    if (provider === 'yahoo') {
      const q1 = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=15y&interval=1mo&includeAdjustedClose=true&events=div`;
      const q2 = `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=15y&interval=1mo&includeAdjustedClose=true&events=div`;

      const data = await this.fetchYahooJson([q1, q2], `hist15y_${symbol}`);
      const result = data?.chart?.result?.[0];
      if (result && Array.isArray(result.timestamp) && result.timestamp.length > 0) {
        const timestamps = result.timestamp;
        const quote = result.indicators?.quote?.[0] || {};
        const adjCloses = result.indicators?.adjclose?.[0]?.adjclose || [];

        const byMonth = {};
        timestamps.forEach((ts, idx) => {
          const rawClose = quote.close?.[idx];
          const adjClose = adjCloses[idx] ?? rawClose;
          if (rawClose === null || rawClose === undefined || isNaN(rawClose)) return;

          const d = new Date(ts * 1000).toISOString().split('T')[0];
          const month = d.slice(0, 7);
          byMonth[month] = {
            month,
            date: d,
            close: Fin.round(parseFloat(adjClose || rawClose), 4),
            rawClose: Fin.round(parseFloat(rawClose), 4),
            high: Fin.round(parseFloat(quote.high?.[idx] ?? rawClose), 4),
            low: Fin.round(parseFloat(quote.low?.[idx] ?? rawClose), 4),
            volume: parseInt(quote.volume?.[idx] || 0, 10)
          };
        });

        const divEvents = result.events?.dividends;
        const refPrice = result.meta?.regularMarketPrice || state.prices[symbol]?.price || 0;
        const curr = result.meta?.currency || this.getStaticProfile(symbol).currency;

        if (divEvents && typeof divEvents === 'object' && typeof buildDividendScheduleForTicker === 'function') {
          const sched = buildDividendScheduleForTicker(symbol, divEvents, refPrice, curr);
          if (sched) {
            if (!state.dividendSchedules) state.dividendSchedules = {};
            state.dividendSchedules[symbol] = sched;
            const existingFund = state.fundamentals[symbol] || {};
            state.fundamentals[symbol] = {
              ...existingFund,
              divYield: sched.trailingYieldPct || existingFund.divYield || 0,
              forwardDivYield: sched.forwardYieldPct || 0,
              netDivYield: sched.netYieldPct || 0,
              nextExDate: sched.nextExDate || null,
              nextPayDate: sched.nextPayDate || null,
              divFrequency: sched.frequency || 'None'
            };
          }
        }

        const sorted = Object.values(byMonth).sort((a, b) => a.month.localeCompare(b.month));
        if (sorted.length > 0) {
          const trailing12 = sorted.slice(-12);
          const t12High = Math.max(...trailing12.map(r => Number(r.high || r.rawClose || r.close || 0)).filter(v => v > 0));
          const t12Low = Math.min(...trailing12.map(r => Number(r.low || r.rawClose || r.close || 0)).filter(v => v > 0));
          const existingFund = state.fundamentals[symbol] || {};
          const metaHigh52 = result.meta?.fiftyTwoWeekHigh ? Fin.round(parseFloat(result.meta.fiftyTwoWeekHigh), 4) : null;
          const metaLow52 = result.meta?.fiftyTwoWeekLow ? Fin.round(parseFloat(result.meta.fiftyTwoWeekLow), 4) : null;
          state.fundamentals[symbol] = {
            ...existingFund,
            high52w: metaHigh52 || existingFund.high52w || (isFinite(t12High) && t12High > 0 ? Fin.round(t12High, 4) : null),
            low52w: metaLow52 || existingFund.low52w || (isFinite(t12Low) && t12Low > 0 ? Fin.round(t12Low, 4) : null)
          };
          return sorted;
        }
      }
      throw new Error(`No monthly historical data returned by Yahoo Finance for ${symbol}.`);
    }

    const key = this.getKey();
    if (!key) throw new Error('API key is not configured.');

    if (provider === 'alphavantage') {
      const url = `https://www.alphavantage.co/query?function=TIME_SERIES_MONTHLY_ADJUSTED&symbol=${encodeURIComponent(symbol)}&apikey=${encodeURIComponent(key)}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data['Note'] || data['Information']) {
        throw new Error(data['Note'] || data['Information']);
      }
      const series = data['Monthly Adjusted Time Series'] || data['Monthly Time Series'];
      if (!series) {
        throw new Error(`No monthly time series returned for ${symbol}`);
      }

      const records = Object.keys(series).map(dateStr => {
        const item = series[dateStr];
        return {
          month: dateStr.slice(0, 7),
          date: dateStr,
          close: Fin.round(parseFloat(item['5. adjusted close'] || item['4. close']), 4),
          rawClose: Fin.round(parseFloat(item['4. close']), 4),
          high: Fin.round(parseFloat(item['2. high']), 4),
          low: Fin.round(parseFloat(item['3. low']), 4),
          volume: parseInt(item['6. volume'] || item['5. volume'] || '0', 10)
        };
      });

      const byMonth = {};
      records.forEach(r => { byMonth[r.month] = r; });
      return Object.values(byMonth).sort((a, b) => a.month.localeCompare(b.month));
    }

    if (provider === 'twelvedata') {
      const url = `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(symbol)}&interval=1month&outputsize=60&apikey=${encodeURIComponent(key)}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.status === 'error' || !Array.isArray(data.values)) {
        throw new Error(data.message || `No monthly series returned for ${symbol}`);
      }
      const records = data.values.map(item => ({
        month: item.datetime.slice(0, 7),
        date: item.datetime,
        close: Fin.round(parseFloat(item.close), 4),
        rawClose: Fin.round(parseFloat(item.close), 4),
        high: Fin.round(parseFloat(item.high), 4),
        low: Fin.round(parseFloat(item.low), 4),
        volume: parseInt(item.volume || '0', 10)
      }));
      return records.sort((a, b) => a.month.localeCompare(b.month));
    }

    if (provider === 'finnhub') {
      const toUnix = Math.floor(Date.now() / 1000);
      const fromUnix = toUnix - (5 * 365 * 24 * 60 * 60);
      const url = `https://finnhub.io/api/v1/stock/candle?symbol=${encodeURIComponent(symbol)}&resolution=M&from=${fromUnix}&to=${toUnix}&token=${encodeURIComponent(key)}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.s !== 'ok' || !Array.isArray(data.t)) {
        throw new Error(data.error || `Finnhub monthly candle unavailable for ${symbol}`);
      }
      const records = data.t.map((ts, idx) => {
        const d = new Date(ts * 1000).toISOString().split('T')[0];
        return {
          month: d.slice(0, 7),
          date: d,
          close: Fin.round(parseFloat(data.c[idx]), 4),
          rawClose: Fin.round(parseFloat(data.c[idx]), 4),
          high: Fin.round(parseFloat(data.h[idx]), 4),
          low: Fin.round(parseFloat(data.l[idx]), 4),
          volume: parseInt(data.v[idx] || 0, 10)
        };
      });
      return records.sort((a, b) => a.month.localeCompare(b.month));
    }
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
    const data = await this.fetchYahooJson([u1, u2], `news_${symbol}`);
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

async function syncAllMarketData(includeMonthly = true) {
  if (!MarketAPI.hasKey()) {
    showToast('Please select Yahoo Finance (Keyless) or configure your API Key in Settings.', 'error');
    switchTab('settings');
    return;
  }

  const allTickers = Array.from(new Set([
    ...portfolio.activeHoldings.map(h => h.ticker),
    ...state.watchlist.map(w => w.ticker)
  ]));

  if (allTickers.length === 0) {
    showToast('Add a stock transaction or watchlist ticker first.', 'info');
    return;
  }

  const syncIcon = document.getElementById('header-sync-icon');
  if (syncIcon) syncIcon.classList.add('fa-spin');
  showToast(`Syncing live quotes, FX${includeMonthly ? ', 15y history & dividends' : ''} for ${allTickers.length} ticker(s)...`, 'info');

  let updatedQuotes = 0;
  let updatedHistory = 0;
  const errors = [];

  try {
    await MarketAPI.fetchLiveFxRates();
  } catch (_) {}

  for (const rawTicker of allTickers) {
    const ticker = MarketAPI.normalizeTicker(rawTicker);
    try {
      const q = await MarketAPI.fetchQuote(ticker);
      if (q && q.price > 0) {
        const prev = state.prices[ticker]?.price || q.prevPrice;
        state.prices[ticker] = {
          price: q.price,
          prevPrice: q.prevPrice,
          change: q.change,
          changePct: q.changePct,
          high52w: q.high52w || state.fundamentals[ticker]?.high52w || null,
          low52w: q.low52w || state.fundamentals[ticker]?.low52w || null,
          currency: q.currency || 'USD',
          lastUpdated: new Date().toISOString()
        };
        updatedQuotes++;
        triggerRowPriceFlash(ticker, q.price >= prev);
      }
    } catch (err) {
      if (typeof AppLogger !== 'undefined') AppLogger.warn('MarketAPI', `Quote fetch failed for ${ticker}: ${err.message}`);
      errors.push(`${ticker}: ${err.message}`);
    }

    const needsMonthlyHistory = !state.historicalPrices[ticker] || state.historicalPrices[ticker].length === 0;
    if (includeMonthly || needsMonthlyHistory) {
      try {
        const history = await MarketAPI.fetchMonthlyHistory(ticker);
        if (Array.isArray(history) && history.length > 0) {
          state.historicalPrices[ticker] = history;
          updatedHistory++;
        }
      } catch (err) {
        if (typeof AppLogger !== 'undefined') AppLogger.warn('MarketAPI', `Monthly history fetch failed for ${ticker}: ${err.message}`);
      }
    }
  }

  state.settings.lastApiSync = new Date().toISOString();
  recalculatePortfolio();
  saveState();
  renderAll();

  if (syncIcon) syncIcon.classList.remove('fa-spin');
  if (errors.length > 0 && updatedQuotes === 0) {
    showToast(`Sync error — ${errors[0]}`, 'error');
  } else {
    showToast(`Synced ${updatedQuotes} live quote(s) and ${updatedHistory} historical/dividend series.`, 'success');
  }
}

async function syncCompanyNewsLive() {
  const allTickers = Array.from(new Set([
    ...(portfolio?.activeHoldings || []).map(h => h.ticker),
    ...(state?.watchlist || []).map(w => w.ticker)
  ]));
  const targetList = allTickers.length > 0 ? allTickers.slice(0, 12) : ['2800.HK', '0002.HK', '2318.HK', 'VOO'];
  showToast(`Fetching live news headlines for ${targetList.length} ticker(s)...`, 'info');

  let added = 0;
  if (!Array.isArray(state.companyNews)) state.companyNews = [];
  const existingUrls = new Set(state.companyNews.map(a => a.url));

  for (const sym of targetList) {
    try {
      const fetched = await MarketAPI.fetchTickerNewsLive(sym, 4);
      fetched.forEach(art => {
        if (!existingUrls.has(art.url)) {
          existingUrls.add(art.url);
          state.companyNews.unshift(art);
          added++;
        }
      });
    } catch (_) {}
  }

  state.companyNews.sort((a, b) => String(b.publishedAt || '').localeCompare(String(a.publishedAt || '')));
  state.companyNews = state.companyNews.slice(0, 200);
  saveState();
  if (typeof renderNewsTab === 'function') renderNewsTab();
  showToast(
    added > 0 ? `Fetched ${added} new live company news article(s)!` : 'News feed is up to date (run update_company_news.py for full RSS aggregation).',
    added > 0 ? 'success' : 'info'
  );
}
window.syncCompanyNewsLive = syncCompanyNewsLive;

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
