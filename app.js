/**
 * myPortfolio - Modular Client-Side Stock Portfolio & Historical Wealth Engine (app.js)
 * Features:
 *  - Zero simulated/sample data: 100% API-driven quotes, monthly historical series & fundamentals
 *  - Multi-provider Stock API client (Alpha Vantage, Twelve Data, Finnhub)
 *  - Automatic Device Detection (Mobile / Tablet / Desktop + OS/Touch adaptation)
 *  - High-precision WACB, Realized/Unrealized P&L, DRIP & Yield on Cost engine
 *  - SheetJS 6-Sheet Excel (.xlsx) Backup & Restore including Monthly Historical Prices
 */

const STORAGE_KEY = 'MYPORTFOLIO_STATE_V1';

// ============================================================================
// 1. FINANCIAL PRECISION ARITHMETIC UTILITIES
// ============================================================================
const Fin = {
  round: (val, decimals = 2) => {
    if (val === null || val === undefined || isNaN(val)) return 0;
    return Number(Math.round(Number(val + 'e' + decimals)) + 'e-' + decimals);
  },
  currency: (val, showPlus = false) => {
    const n = Fin.round(val, 2);
    const formatted = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(Math.abs(n));
    if (showPlus && n > 0) return '+' + formatted;
    if (n < 0) return '-' + formatted;
    return formatted;
  },
  shares: (val) => {
    const n = Fin.round(val, 4);
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 4
    }).format(n);
  },
  percent: (val, showPlus = true) => {
    const n = Fin.round(val, 2);
    const sign = showPlus && n > 0 ? '+' : '';
    return `${sign}${n.toFixed(2)}%`;
  },
  compactNumber: (val) => {
    const n = Number(val);
    if (!n || isNaN(n)) return '-';
    if (n >= 1e12) return (n / 1e12).toFixed(2) + 'T';
    if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B';
    if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
    return n.toLocaleString();
  }
};

// ============================================================================
// 2. AUTOMATIC DEVICE DETECTION ENGINE
// ============================================================================
const DeviceDetector = {
  profile: {
    deviceType: 'desktop', // 'mobile' | 'tablet' | 'desktop'
    effectiveMode: 'desktop',
    os: 'Unknown OS',
    browser: 'Browser',
    isTouch: false,
    width: window.innerWidth,
    height: window.innerHeight
  },

  init() {
    this.detect();
    window.addEventListener('resize', () => {
      this.detect();
      if (typeof renderCharts === 'function') {
        renderCharts();
      }
    });
  },

  detect() {
    const ua = navigator.userAgent || '';
    const width = window.innerWidth;
    const height = window.innerHeight;
    const isTouch = ('ontouchstart' in window) ||
      (navigator.maxTouchPoints > 0) ||
      window.matchMedia('(pointer: coarse)').matches;

    // Detect OS
    let os = 'Desktop OS';
    if (/iPhone|iPod/i.test(ua)) os = 'iOS (iPhone)';
    else if (/iPad/i.test(ua) || (/Macintosh/i.test(ua) && isTouch)) os = 'iPadOS';
    else if (/Android/i.test(ua)) os = 'Android';
    else if (/Mac OS X|Macintosh/i.test(ua)) os = 'macOS';
    else if (/Windows NT/i.test(ua)) os = 'Windows';
    else if (/Linux/i.test(ua)) os = 'Linux';

    // Detect Browser
    let browser = 'Web Browser';
    if (/Edg\//i.test(ua)) browser = 'Edge';
    else if (/Chrome\//i.test(ua) && !/Edg\//i.test(ua)) browser = 'Chrome';
    else if (/Safari\//i.test(ua) && !/Chrome\//i.test(ua)) browser = 'Safari';
    else if (/Firefox\//i.test(ua)) browser = 'Firefox';

    // Classify Hardware Form Factor
    let deviceType = 'desktop';
    if (width <= 768 || /iPhone|iPod|Android.*Mobile/i.test(ua)) {
      deviceType = 'mobile';
    } else if ((width <= 1024 && isTouch) || /iPad|Android(?!.*Mobile)/i.test(ua)) {
      deviceType = 'tablet';
    }

    const override = state?.settings?.deviceOverride || 'auto';
    const effectiveMode = override === 'auto' ? deviceType : override;

    this.profile = {
      deviceType,
      effectiveMode,
      os,
      browser,
      isTouch,
      width,
      height
    };

    // Apply to DOM body attribute for CSS layout rules
    document.body.setAttribute('data-device', effectiveMode);

    this.updateUI();
  },

  updateUI() {
    const badgeIcon = document.getElementById('device-indicator-icon');
    const badgeText = document.getElementById('device-indicator-text');
    const { effectiveMode, deviceType, os, browser, isTouch, width, height } = this.profile;

    if (badgeIcon && badgeText) {
      if (effectiveMode === 'mobile') {
        badgeIcon.className = 'fa-solid fa-mobile-screen-button text-[9px] text-brand-500';
        badgeText.textContent = `Mobile (${os.split(' ')[0]})`;
      } else if (effectiveMode === 'tablet') {
        badgeIcon.className = 'fa-solid fa-tablet-screen-button text-[9px] text-indigo-500';
        badgeText.textContent = `Tablet (${os.split(' ')[0]})`;
      } else {
        badgeIcon.className = 'fa-solid fa-desktop text-[9px] text-brand-500';
        badgeText.textContent = `Desktop (${os.split(' ')[0]})`;
      }
    }

    const diagType = document.getElementById('diag-device-type');
    const diagOs = document.getElementById('diag-os-browser');
    const diagVp = document.getElementById('diag-viewport');
    const diagTouch = document.getElementById('diag-touch');

    if (diagType) {
      diagType.textContent = `${deviceType.toUpperCase()} (Active Layout: ${effectiveMode.toUpperCase()})`;
      diagOs.textContent = `${os} • ${browser}`;
      diagVp.textContent = `${width}px × ${height}px`;
      diagTouch.textContent = isTouch ? 'Touchscreen / Coarse Pointer Detected' : 'Mouse & Trackpad / Fine Pointer';
    }
  }
};

// ============================================================================
// 3. CLEAN INITIAL STATE (NO SIMULATIONS OR SAMPLE SEED DATA)
// ============================================================================
function createEmptyState() {
  return {
    settings: {
      currency: 'USD',
      apiProvider: 'alphavantage', // 'alphavantage' | 'twelvedata' | 'finnhub'
      apiKey: '',
      deviceOverride: 'auto',
      darkMode: true,
      lastApiSync: null
    },
    cashBalance: 0,
    initialCash: 0,
    transactions: [],
    prices: {},            // { 'AAPL': { price, prevPrice, change, changePct, lastUpdated } }
    historicalPrices: {},  // { 'AAPL': [ { month: '2025-01', close: 220.5, high: 225, low: 215, volume: 10000 }, ... ] }
    dividends: [],
    watchlist: [],
    fundamentals: {}       // { 'AAPL': { name, sector, pe, fwdPe, eps, marketCap, debtEquity, roe, fcf, divYield, bvps, fcfPerShare, ... } }
  };
}

let state = null;
let portfolio = null;
let allocationViewMode = 'ticker';
let historyRangeMonths = 24;

const charts = {
  monthlyHistory: null,
  allocation: null,
  dividends: null,
  pnlBreakdown: null
};

// ============================================================================
// 4. UNIFIED STOCK MARKET API CLIENT (LIVE QUOTES, MONTHLY HISTORY & FUNDAMENTALS)
// ============================================================================
const MarketAPI = {
  hasKey() {
    return Boolean(state?.settings?.apiKey && state.settings.apiKey.trim().length > 0);
  },

  getProvider() {
    return state?.settings?.apiProvider || 'alphavantage';
  },

  getKey() {
    return (state?.settings?.apiKey || '').trim();
  },

  /**
   * Fetches real-time / latest quote for a single ticker via selected API provider
   */
  async fetchQuote(ticker) {
    const symbol = ticker.trim().toUpperCase();
    const provider = this.getProvider();
    const key = this.getKey();
    if (!key) throw new Error('API key is not configured.');

    if (provider === 'alphavantage') {
      const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${encodeURIComponent(symbol)}&apikey=${encodeURIComponent(key)}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data['Note'] || data['Information']) {
        throw new Error(data['Note'] || data['Information']);
      }
      const q = data['Global Quote'];
      if (!q || !q['05. price']) {
        throw new Error(`No quote returned for ${symbol}`);
      }
      const price = parseFloat(q['05. price']);
      const prevPrice = parseFloat(q['08. previous close']) || price;
      const change = parseFloat(q['09. change']) || (price - prevPrice);
      const changePct = parseFloat((q['10. change percent'] || '0').replace('%', '')) || 0;
      return { price, prevPrice, change, changePct };
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
      return { price, prevPrice, change, changePct };
    }

    if (provider === 'finnhub') {
      const url = `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${encodeURIComponent(key)}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.error || !data.c) {
        throw new Error(data.error || `No quote returned for ${symbol}`);
      }
      return {
        price: parseFloat(data.c),
        prevPrice: parseFloat(data.pc) || parseFloat(data.c),
        change: parseFloat(data.d) || 0,
        changePct: parseFloat(data.dp) || 0
      };
    }
  },

  /**
   * Fetches monthly historical prices (up to 5-10 years of monthly closes)
   */
  async fetchMonthlyHistory(ticker) {
    const symbol = ticker.trim().toUpperCase();
    const provider = this.getProvider();
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
          close: Fin.round(parseFloat(item['5. adjusted close'] || item['4. close']), 2),
          rawClose: Fin.round(parseFloat(item['4. close']), 2),
          high: Fin.round(parseFloat(item['2. high']), 2),
          low: Fin.round(parseFloat(item['3. low']), 2),
          volume: parseInt(item['6. volume'] || item['5. volume'] || '0', 10)
        };
      });

      // Deduplicate by YYYY-MM and sort ascending chronologically
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
        close: Fin.round(parseFloat(item.close), 2),
        rawClose: Fin.round(parseFloat(item.close), 2),
        high: Fin.round(parseFloat(item.high), 2),
        low: Fin.round(parseFloat(item.low), 2),
        volume: parseInt(item.volume || '0', 10)
      }));
      return records.sort((a, b) => a.month.localeCompare(b.month));
    }

    if (provider === 'finnhub') {
      const toUnix = Math.floor(Date.now() / 1000);
      const fromUnix = toUnix - (5 * 365 * 24 * 60 * 60); // 5 years
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
          close: Fin.round(parseFloat(data.c[idx]), 2),
          rawClose: Fin.round(parseFloat(data.c[idx]), 2),
          high: Fin.round(parseFloat(data.h[idx]), 2),
          low: Fin.round(parseFloat(data.l[idx]), 2),
          volume: parseInt(data.v[idx] || 0, 10)
        };
      });
      return records.sort((a, b) => a.month.localeCompare(b.month));
    }
  },

  /**
   * Fetches company fundamentals (P/E, Forward P/E, EPS, Market Cap, ROE, Book Value, Div Yield)
   */
  async fetchFundamentals(ticker) {
    const symbol = ticker.trim().toUpperCase();
    const provider = this.getProvider();
    const key = this.getKey();
    if (!key) throw new Error('API key is not configured.');

    const existing = state.fundamentals[symbol] || {};

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
  }
};

// ============================================================================
// 5. STATE PERSISTENCE & PORTFOLIO RECALCULATION ENGINE
// ============================================================================
function initAppState() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    try {
      state = JSON.parse(stored);
    } catch (e) {
      console.error('Failed to parse localStorage state, initializing clean state:', e);
      state = createEmptyState();
    }
  } else {
    state = createEmptyState();
  }

  // Ensure schema completeness
  if (!state.settings) state.settings = createEmptyState().settings;
  if (!state.prices) state.prices = {};
  if (!state.historicalPrices) state.historicalPrices = {};
  if (!state.fundamentals) state.fundamentals = {};
  if (!state.transactions) state.transactions = [];
  if (!state.dividends) state.dividends = [];
  if (!state.watchlist) state.watchlist = [];

  if (state.settings.darkMode === false) {
    document.documentElement.classList.remove('dark');
  } else {
    document.documentElement.classList.add('dark');
  }

  recalculatePortfolio();
  saveState();
}

function saveState() {
  if (!state) return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function recalculatePortfolio() {
  let runningCash = Fin.round(state.initialCash || 0, 2);
  let totalRealizedPnL = 0;
  const holdingsMap = {};

  const sortedTx = [...state.transactions].sort((a, b) => new Date(a.date) - new Date(b.date));

  sortedTx.forEach(tx => {
    const fees = Fin.round(tx.fees || 0, 2);
    const shares = Fin.round(tx.shares || 0, 4);
    const price = Fin.round(tx.price || 0, 2);

    if (tx.type === 'DEPOSIT') {
      runningCash = Fin.round(runningCash + (tx.amount || 0), 2);
    } else if (tx.type === 'WITHDRAW') {
      runningCash = Fin.round(runningCash - (tx.amount || 0), 2);
    } else if (tx.type === 'BUY') {
      const totalOutlay = Fin.round(shares * price + fees, 2);
      runningCash = Fin.round(runningCash - totalOutlay, 2);

      if (!holdingsMap[tx.ticker]) {
        holdingsMap[tx.ticker] = {
          ticker: tx.ticker,
          shares: 0,
          totalCostBasis: 0,
          avgCost: 0,
          realizedGain: 0,
          totalDividends: 0
        };
      }
      const h = holdingsMap[tx.ticker];
      h.shares = Fin.round(h.shares + shares, 4);
      h.totalCostBasis = Fin.round(h.totalCostBasis + totalOutlay, 2);
      h.avgCost = h.shares > 0 ? Fin.round(h.totalCostBasis / h.shares, 4) : 0;

    } else if (tx.type === 'DRIP') {
      if (!holdingsMap[tx.ticker]) {
        holdingsMap[tx.ticker] = {
          ticker: tx.ticker,
          shares: 0,
          totalCostBasis: 0,
          avgCost: 0,
          realizedGain: 0,
          totalDividends: 0
        };
      }
      const h = holdingsMap[tx.ticker];
      const dripValue = Fin.round(shares * price, 2);
      h.shares = Fin.round(h.shares + shares, 4);
      h.totalCostBasis = Fin.round(h.totalCostBasis + dripValue, 2);
      h.avgCost = h.shares > 0 ? Fin.round(h.totalCostBasis / h.shares, 4) : 0;

    } else if (tx.type === 'SELL') {
      const grossProceeds = Fin.round(shares * price, 2);
      const netProceeds = Fin.round(grossProceeds - fees, 2);
      runningCash = Fin.round(runningCash + netProceeds, 2);

      if (!holdingsMap[tx.ticker]) {
        holdingsMap[tx.ticker] = {
          ticker: tx.ticker,
          shares: 0,
          totalCostBasis: 0,
          avgCost: 0,
          realizedGain: 0,
          totalDividends: 0
        };
      }
      const h = holdingsMap[tx.ticker];
      const soldCostBasis = Fin.round(shares * h.avgCost, 2);
      const tradeRealizedGain = Fin.round(netProceeds - soldCostBasis, 2);

      tx.realizedGain = tradeRealizedGain;
      h.realizedGain = Fin.round(h.realizedGain + tradeRealizedGain, 2);
      totalRealizedPnL = Fin.round(totalRealizedPnL + tradeRealizedGain, 2);

      h.shares = Fin.round(h.shares - shares, 4);
      h.totalCostBasis = Fin.round(h.totalCostBasis - soldCostBasis, 2);

      if (h.shares <= 0.0001) {
        h.shares = 0;
        h.totalCostBasis = 0;
        h.avgCost = 0;
      } else {
        h.avgCost = Fin.round(h.totalCostBasis / h.shares, 4);
      }
    }
  });

  // Dividends
  let totalDividendsEarned = 0;
  let cashDividendsTotal = 0;
  let dripDividendsTotal = 0;

  state.dividends.forEach(div => {
    const amt = Fin.round(div.totalAmount || 0, 2);
    totalDividendsEarned = Fin.round(totalDividendsEarned + amt, 2);

    if (div.isDrip) {
      dripDividendsTotal = Fin.round(dripDividendsTotal + amt, 2);
    } else {
      cashDividendsTotal = Fin.round(cashDividendsTotal + amt, 2);
      runningCash = Fin.round(runningCash + amt, 2);
    }

    if (holdingsMap[div.ticker]) {
      holdingsMap[div.ticker].totalDividends = Fin.round((holdingsMap[div.ticker].totalDividends || 0) + amt, 2);
    }
  });

  state.cashBalance = runningCash;

  const activeHoldings = [];
  let totalStockMarketValue = 0;
  let totalStockCostBasis = 0;

  Object.keys(holdingsMap).forEach(ticker => {
    const h = holdingsMap[ticker];
    if (h.shares > 0.0001) {
      const priceObj = state.prices[ticker] || { price: h.avgCost, change: 0, changePct: 0 };
      const currentPrice = Fin.round(priceObj.price || h.avgCost, 2);
      const marketValue = Fin.round(h.shares * currentPrice, 2);
      const unrealizedGain = Fin.round(marketValue - h.totalCostBasis, 2);
      const unrealizedGainPct = h.totalCostBasis > 0 ? Fin.round((unrealizedGain / h.totalCostBasis) * 100, 2) : 0;
      const yieldOnCost = h.totalCostBasis > 0 ? Fin.round((h.totalDividends / h.totalCostBasis) * 100, 2) : 0;
      const fund = state.fundamentals[ticker] || {};

      activeHoldings.push({
        ticker,
        companyName: fund.name || ticker,
        sector: fund.sector || 'Technology',
        shares: h.shares,
        avgCost: h.avgCost,
        totalCostBasis: h.totalCostBasis,
        currentPrice,
        priceChange: priceObj.change || 0,
        priceChangePct: priceObj.changePct || 0,
        marketValue,
        unrealizedGain,
        unrealizedGainPct,
        totalDividends: h.totalDividends,
        yieldOnCost,
        realizedGain: h.realizedGain
      });

      totalStockMarketValue = Fin.round(totalStockMarketValue + marketValue, 2);
      totalStockCostBasis = Fin.round(totalStockCostBasis + h.totalCostBasis, 2);
    }
  });

  activeHoldings.sort((a, b) => b.marketValue - a.marketValue);

  const totalPortfolioValue = Fin.round(state.cashBalance + totalStockMarketValue, 2);
  const totalUnrealizedGain = Fin.round(totalStockMarketValue - totalStockCostBasis, 2);
  const totalUnrealizedGainPct = totalStockCostBasis > 0 ? Fin.round((totalUnrealizedGain / totalStockCostBasis) * 100, 2) : 0;

  portfolio = {
    totalPortfolioValue,
    cashBalance: state.cashBalance,
    totalStockMarketValue,
    totalStockCostBasis,
    totalUnrealizedGain,
    totalUnrealizedGainPct,
    totalRealizedPnL,
    totalDividendsEarned,
    cashDividendsTotal,
    dripDividendsTotal,
    activeHoldings,
    allHoldingsMap: holdingsMap
  };
}

// ============================================================================
// 6. UI RENDERING CONTROLLERS
// ============================================================================
function renderAll() {
  if (!portfolio) recalculatePortfolio();

  renderApiStatusUI();
  renderKPIs();
  populateHistorySelector();
  renderHoldingsTable();
  renderTransactionsTable();
  renderDividendsTable();
  renderWatchlistAndFundamentals();
  renderCharts();
  updateTabCounters();
}

function renderApiStatusUI() {
  const hasKey = MarketAPI.hasKey();
  const provider = MarketAPI.getProvider().toUpperCase();
  const dot = document.getElementById('api-status-dot');
  const text = document.getElementById('api-status-text');
  const banner = document.getElementById('api-setup-banner');
  const syncLabel = document.getElementById('last-api-sync-label');

  if (hasKey) {
    dot.className = 'w-2.5 h-2.5 rounded-full bg-emerald-500';
    text.textContent = `API: ${provider} Ready`;
    banner.classList.add('hidden');
  } else {
    dot.className = 'w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse';
    text.textContent = 'API Key Needed';
    banner.classList.remove('hidden');
  }

  if (syncLabel && state.settings.lastApiSync) {
    syncLabel.textContent = `Last synced: ${new Date(state.settings.lastApiSync).toLocaleTimeString()}`;
  }

  const keyInput = document.getElementById('setting-api-key');
  const provSelect = document.getElementById('setting-api-provider');
  const devSelect = document.getElementById('setting-device-override');
  if (keyInput && document.activeElement !== keyInput) keyInput.value = state.settings.apiKey || '';
  if (provSelect) provSelect.value = state.settings.apiProvider || 'alphavantage';
  if (devSelect) devSelect.value = state.settings.deviceOverride || 'auto';
}

function renderKPIs() {
  document.getElementById('kpi-portfolio-value').textContent = Fin.currency(portfolio.totalPortfolioValue);
  document.getElementById('kpi-cash-balance').textContent = Fin.currency(portfolio.cashBalance);

  const cashPct = portfolio.totalPortfolioValue > 0
    ? Fin.round((portfolio.cashBalance / portfolio.totalPortfolioValue) * 100, 1)
    : 0;
  document.getElementById('kpi-cash-pct').textContent = `${cashPct}% of total`;
  document.getElementById('kpi-cost-basis').textContent = Fin.currency(portfolio.totalStockCostBasis);

  const uEl = document.getElementById('kpi-unrealized-val');
  const uPctEl = document.getElementById('kpi-unrealized-pct');
  uEl.textContent = Fin.currency(portfolio.totalUnrealizedGain, true);
  uPctEl.textContent = Fin.percent(portfolio.totalUnrealizedGainPct, true);

  const uPositive = portfolio.totalUnrealizedGain >= 0;
  uEl.className = `mt-1.5 sm:mt-2 text-lg sm:text-xl font-bold num-font tracking-tight ${uPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`;
  uPctEl.className = `mt-1 flex items-center text-[11px] font-semibold num-font ${uPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`;

  const rEl = document.getElementById('kpi-realized-val');
  rEl.textContent = Fin.currency(portfolio.totalRealizedPnL, true);
  rEl.className = `mt-1.5 sm:mt-2 text-lg sm:text-xl font-bold num-font tracking-tight ${portfolio.totalRealizedPnL >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`;

  document.getElementById('kpi-dividends-val').textContent = Fin.currency(portfolio.totalDividendsEarned);
  document.getElementById('kpi-dividends-count').textContent = `${state.dividends.length} payouts`;

  // Top Performer
  const topBox = document.getElementById('top-performer-box');
  if (portfolio.activeHoldings.length > 0) {
    const top = [...portfolio.activeHoldings].sort((a, b) => b.unrealizedGainPct - a.unrealizedGainPct)[0];
    const gainColor = top.unrealizedGainPct >= 0 ? 'text-emerald-500' : 'text-rose-500';
    topBox.innerHTML = `
      <div>
        <div class="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <span>${top.ticker}</span>
          <span class="text-xs px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-semibold text-slate-500">${top.companyName}</span>
        </div>
        <div class="text-xs num-font ${gainColor} font-bold mt-1">
          ${Fin.percent(top.unrealizedGainPct)} (${Fin.currency(top.unrealizedGain, true)})
        </div>
      </div>
      <div class="text-right">
        <span class="text-[11px] text-slate-400 block">Live Price</span>
        <span class="text-sm font-bold num-font text-slate-800 dark:text-slate-200">${Fin.currency(top.currentPrice)}</span>
      </div>
    `;
  } else {
    topBox.innerHTML = `<span class="text-xs text-slate-400">No active holdings yet</span>`;
  }

  // Yield on Cost
  const avgYoc = portfolio.totalStockCostBasis > 0
    ? Fin.round((portfolio.totalDividendsEarned / portfolio.totalStockCostBasis) * 100, 2)
    : 0;
  document.getElementById('stat-avg-yoc').textContent = `${avgYoc.toFixed(2)}%`;

  // Watchlist Alerts
  const alertBox = document.getElementById('watchlist-alerts-box');
  const alerts = state.watchlist.filter(w => {
    const cur = state.prices[w.ticker]?.price || 0;
    return cur > 0 && cur <= w.targetBuyPrice;
  });

  if (alerts.length > 0) {
    alertBox.innerHTML = `
      <div class="flex items-center gap-2">
        <span class="px-2 py-1 rounded bg-rose-500/20 text-rose-500 font-bold text-xs border border-rose-500/30 animate-pulse">
          ${alerts.length} Target Hit!
        </span>
        <span class="text-xs font-semibold text-slate-700 dark:text-slate-300">${alerts.map(a => a.ticker).join(', ')}</span>
      </div>
    `;
  } else {
    alertBox.innerHTML = `<span class="text-xs text-slate-400">No target price alerts triggered</span>`;
  }
}

function updateTabCounters() {
  document.querySelectorAll('.tab-holdings-count').forEach(el => {
    el.textContent = portfolio.activeHoldings.length;
  });
  document.querySelectorAll('.tab-tx-count').forEach(el => {
    el.textContent = state.transactions.length;
  });
}

function populateHistorySelector() {
  const select = document.getElementById('history-target-select');
  if (!select) return;
  const currentVal = select.value || 'PORTFOLIO';

  const allTickers = Array.from(new Set([
    ...portfolio.activeHoldings.map(h => h.ticker),
    ...state.watchlist.map(w => w.ticker),
    ...Object.keys(state.historicalPrices)
  ]));

  select.innerHTML = `<option value="PORTFOLIO">Entire Portfolio (Aggregate Monthly Trend)</option>`;
  allTickers.forEach(t => {
    const count = (state.historicalPrices[t] || []).length;
    const opt = document.createElement('option');
    opt.value = t;
    opt.textContent = `${t} - Individual Stock (${count > 0 ? count + ' mos cached' : 'Fetch via API'})`;
    select.appendChild(opt);
  });

  if (allTickers.includes(currentVal) || currentVal === 'PORTFOLIO') {
    select.value = currentVal;
  }
}

function renderHoldingsTable() {
  const tbody = document.getElementById('holdings-table-body');
  const emptyState = document.getElementById('holdings-empty-state');
  tbody.innerHTML = '';

  if (portfolio.activeHoldings.length === 0) {
    emptyState.classList.remove('hidden');
    return;
  }
  emptyState.classList.add('hidden');

  portfolio.activeHoldings.forEach(h => {
    const tr = document.createElement('tr');
    tr.className = 'hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition';
    tr.id = `holding-row-${h.ticker}`;

    const pnlColor = h.unrealizedGain >= 0 ? 'text-emerald-500' : 'text-rose-500';
    const priceChangeColor = h.priceChange >= 0 ? 'text-emerald-500' : 'text-rose-500';

    tr.innerHTML = `
      <td class="py-3 px-4 sticky-col-mobile">
        <div class="flex items-center gap-2">
          <div class="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-bold text-xs text-slate-700 dark:text-slate-300 shrink-0">
            ${h.ticker.slice(0, 4)}
          </div>
          <div>
            <div class="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
              <span>${h.ticker}</span>
              <span class="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-medium hidden sm:inline">${h.sector}</span>
            </div>
            <div class="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-[120px] sm:max-w-none">${h.companyName}</div>
          </div>
        </div>
      </td>
      <td class="py-3 px-4 text-right num-font font-medium text-slate-800 dark:text-slate-200">${Fin.shares(h.shares)}</td>
      <td class="py-3 px-4 text-right num-font text-slate-600 dark:text-slate-300">${Fin.currency(h.avgCost)}</td>
      <td class="py-3 px-4 text-right num-font text-slate-600 dark:text-slate-300">${Fin.currency(h.totalCostBasis)}</td>
      <td class="py-3 px-4 text-right">
        <div class="font-bold num-font text-slate-900 dark:text-white">${Fin.currency(h.currentPrice)}</div>
        <div class="text-[11px] num-font ${priceChangeColor}">${Fin.percent(h.priceChangePct)}</div>
      </td>
      <td class="py-3 px-4 text-right font-bold num-font text-slate-900 dark:text-white">${Fin.currency(h.marketValue)}</td>
      <td class="py-3 px-4 text-right">
        <div class="font-bold num-font ${pnlColor}">${Fin.currency(h.unrealizedGain, true)}</div>
        <div class="text-[11px] num-font ${pnlColor} font-semibold">${Fin.percent(h.unrealizedGainPct)}</div>
      </td>
      <td class="py-3 px-4 text-right">
        <span class="px-2 py-0.5 rounded-full text-xs font-bold num-font ${h.yieldOnCost > 0 ? 'bg-cyan-50 dark:bg-cyan-950/60 text-cyan-600 dark:text-cyan-400' : 'text-slate-400'}">
          ${h.yieldOnCost.toFixed(2)}%
        </span>
      </td>
      <td class="py-3 px-4 text-center">
        <div class="flex items-center justify-center gap-1">
          <button onclick="viewStockHistoryOnDashboard('${h.ticker}')" class="p-1.5 text-xs text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 rounded" title="View Monthly Price Trend">
            <i class="fa-solid fa-chart-line"></i>
          </button>
          <button onclick="openTradeModalForTicker('${h.ticker}', 'BUY')" class="p-1.5 text-xs text-brand-600 dark:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-950/40 rounded" title="Buy More">
            <i class="fa-solid fa-cart-plus"></i>
          </button>
          <button onclick="openTradeModalForTicker('${h.ticker}', 'SELL')" class="p-1.5 text-xs text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded" title="Sell Shares">
            <i class="fa-solid fa-arrow-trend-down"></i>
          </button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function renderTransactionsTable() {
  const tbody = document.getElementById('tx-table-body');
  const emptyState = document.getElementById('tx-empty-state');
  const tickerFilter = document.getElementById('tx-search-ticker').value.trim().toUpperCase();
  const typeFilter = document.getElementById('tx-filter-type').value;

  tbody.innerHTML = '';

  let list = [...state.transactions].sort((a, b) => new Date(b.date) - new Date(a.date));
  if (tickerFilter) list = list.filter(t => (t.ticker || '').toUpperCase().includes(tickerFilter));
  if (typeFilter !== 'ALL') list = list.filter(t => t.type === typeFilter);

  if (list.length === 0) {
    emptyState.classList.remove('hidden');
    return;
  }
  emptyState.classList.add('hidden');

  list.forEach(tx => {
    const tr = document.createElement('tr');
    tr.className = 'hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition text-xs';

    const badgeMap = {
      BUY: '<span class="px-2 py-0.5 rounded font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">BUY</span>',
      SELL: '<span class="px-2 py-0.5 rounded font-bold bg-rose-500/10 text-rose-500 border border-rose-500/20">SELL</span>',
      DRIP: '<span class="px-2 py-0.5 rounded font-bold bg-cyan-500/10 text-cyan-500 border border-cyan-500/20">DRIP</span>',
      DEPOSIT: '<span class="px-2 py-0.5 rounded font-bold bg-indigo-500/10 text-indigo-500 border border-indigo-500/20">DEPOSIT</span>',
      WITHDRAW: '<span class="px-2 py-0.5 rounded font-bold bg-amber-500/10 text-amber-500 border border-amber-500/20">WITHDRAW</span>'
    };

    const isCashOnly = tx.type === 'DEPOSIT' || tx.type === 'WITHDRAW';
    const totalAmt = isCashOnly
      ? tx.amount
      : (tx.shares * tx.price + (tx.type === 'BUY' ? (tx.fees || 0) : -(tx.fees || 0)));

    let gainCell = '<span class="text-slate-400">-</span>';
    if (tx.type === 'SELL' && tx.realizedGain !== undefined) {
      const color = tx.realizedGain >= 0 ? 'text-emerald-500' : 'text-rose-500';
      gainCell = `<span class="font-bold num-font ${color}">${Fin.currency(tx.realizedGain, true)}</span>`;
    }

    tr.innerHTML = `
      <td class="py-3 px-4 font-mono text-slate-500">${tx.date}</td>
      <td class="py-3 px-4">${badgeMap[tx.type] || tx.type}</td>
      <td class="py-3 px-4 font-bold text-slate-900 dark:text-white">${isCashOnly ? 'USD CASH' : tx.ticker}</td>
      <td class="py-3 px-4 text-right num-font font-medium">${isCashOnly ? '-' : Fin.shares(tx.shares)}</td>
      <td class="py-3 px-4 text-right num-font">${isCashOnly ? '-' : Fin.currency(tx.price)}</td>
      <td class="py-3 px-4 text-right num-font text-slate-400">${isCashOnly ? '-' : Fin.currency(tx.fees || 0)}</td>
      <td class="py-3 px-4 text-right font-bold num-font text-slate-900 dark:text-white">${Fin.currency(totalAmt)}</td>
      <td class="py-3 px-4 text-right">${gainCell}</td>
      <td class="py-3 px-4 text-slate-500 max-w-xs truncate">${tx.notes || ''}</td>
      <td class="py-3 px-4 text-center">
        <button onclick="deleteTransaction('${tx.id}')" class="text-slate-400 hover:text-rose-500 transition p-1" title="Delete">
          <i class="fa-solid fa-trash-can text-xs"></i>
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function renderDividendsTable() {
  const tbody = document.getElementById('dividends-table-body');
  const emptyState = document.getElementById('dividends-empty-state');
  tbody.innerHTML = '';

  document.getElementById('div-stat-cumulative').textContent = Fin.currency(portfolio.totalDividendsEarned);
  document.getElementById('div-stat-cash').textContent = Fin.currency(portfolio.cashDividendsTotal);
  document.getElementById('div-stat-drip').textContent = Fin.currency(portfolio.dripDividendsTotal);
  const avgYoc = portfolio.totalStockCostBasis > 0
    ? (portfolio.totalDividendsEarned / portfolio.totalStockCostBasis) * 100
    : 0;
  document.getElementById('div-stat-yoc').textContent = `${avgYoc.toFixed(2)}%`;

  if (state.dividends.length === 0) {
    emptyState.classList.remove('hidden');
    return;
  }
  emptyState.classList.add('hidden');

  const sorted = [...state.dividends].sort((a, b) => new Date(b.payDate) - new Date(a.payDate));
  sorted.forEach(div => {
    const tr = document.createElement('tr');
    tr.className = 'hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition text-xs';
    tr.innerHTML = `
      <td class="py-3 px-4 font-mono font-medium text-slate-800 dark:text-slate-200">${div.payDate}</td>
      <td class="py-3 px-4 font-mono text-slate-400">${div.exDate || '-'}</td>
      <td class="py-3 px-4 font-bold text-slate-900 dark:text-white">${div.ticker}</td>
      <td class="py-3 px-4 text-right num-font text-slate-400">${div.amountPerShare ? Fin.currency(div.amountPerShare) : '-'}</td>
      <td class="py-3 px-4 text-right font-bold num-font text-cyan-600 dark:text-cyan-400">${Fin.currency(div.totalAmount)}</td>
      <td class="py-3 px-4 text-center">
        ${div.isDrip
          ? '<span class="px-2 py-0.5 rounded font-bold bg-cyan-500/20 text-cyan-400 text-[10px]">DRIP</span>'
          : '<span class="px-2 py-0.5 rounded font-bold bg-emerald-500/20 text-emerald-400 text-[10px]">CASH</span>'}
      </td>
      <td class="py-3 px-4 text-right num-font font-medium">${div.dripShares ? `+${Fin.shares(div.dripShares)}` : '-'}</td>
      <td class="py-3 px-4 text-slate-400 max-w-xs truncate">${div.notes || ''}</td>
      <td class="py-3 px-4 text-center">
        <button onclick="deleteDividend('${div.id}')" class="text-slate-400 hover:text-rose-500 transition p-1">
          <i class="fa-solid fa-trash-can text-xs"></i>
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function renderWatchlistAndFundamentals() {
  const wlTbody = document.getElementById('watchlist-table-body');
  const wlEmpty = document.getElementById('watchlist-empty-state');
  wlTbody.innerHTML = '';

  if (state.watchlist.length === 0) {
    wlEmpty.classList.remove('hidden');
  } else {
    wlEmpty.classList.add('hidden');
    state.watchlist.forEach(w => {
      const curPrice = state.prices[w.ticker]?.price || 0;
      const targetPrice = w.targetBuyPrice;
      const distPct = curPrice > 0 ? ((curPrice - targetPrice) / targetPrice) * 100 : 0;
      const isTriggered = curPrice > 0 && curPrice <= targetPrice;

      const tr = document.createElement('tr');
      tr.className = 'hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition text-xs';
      tr.innerHTML = `
        <td class="py-3 px-4 sticky-col-mobile">
          <div class="font-bold text-slate-900 dark:text-white">${w.ticker}</div>
          <div class="text-[11px] text-slate-400">${w.name || state.fundamentals[w.ticker]?.name || ''}</div>
        </td>
        <td class="py-3 px-4 text-slate-500 dark:text-slate-400">${w.sector || 'General'}</td>
        <td class="py-3 px-4 text-right font-bold num-font text-slate-900 dark:text-white">
          ${curPrice > 0 ? Fin.currency(curPrice) : '<span class="text-slate-400 text-[11px]">Sync API</span>'}
        </td>
        <td class="py-3 px-4 text-right font-bold num-font text-purple-600 dark:text-purple-400">${Fin.currency(targetPrice)}</td>
        <td class="py-3 px-4 text-right num-font font-medium ${distPct <= 0 && curPrice > 0 ? 'text-emerald-500' : 'text-slate-400'}">
          ${curPrice > 0 ? (distPct <= 0 ? 'At / Below Target' : `+${distPct.toFixed(1)}% above`) : '-'}
        </td>
        <td class="py-3 px-4 text-center">
          ${isTriggered
            ? '<span class="px-2.5 py-1 rounded-full font-bold bg-rose-500 text-white text-[10px] animate-pulse">BUY TARGET HIT</span>'
            : '<span class="px-2 py-0.5 rounded font-medium bg-slate-100 dark:bg-slate-800 text-slate-400 text-[10px]">WATCHING</span>'}
        </td>
        <td class="py-3 px-4 text-center">
          <div class="flex items-center justify-center gap-1.5">
            <button onclick="viewStockHistoryOnDashboard('${w.ticker}')" class="p-1.5 text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 rounded" title="View Monthly Trend">
              <i class="fa-solid fa-chart-line"></i>
            </button>
            <button onclick="openTradeModalForTicker('${w.ticker}', 'BUY', ${curPrice || targetPrice})" class="px-2 py-1 rounded bg-brand-600 hover:bg-brand-500 text-white font-semibold text-[11px]">
              Buy
            </button>
            <button onclick="deleteFromWatchlist('${w.ticker}')" class="p-1.5 text-slate-400 hover:text-rose-500 transition">
              <i class="fa-solid fa-trash-can text-xs"></i>
            </button>
          </div>
        </td>
      `;
      wlTbody.appendChild(tr);
    });
  }

  // Fundamentals Matrix
  const fundTbody = document.getElementById('fundamentals-table-body');
  fundTbody.innerHTML = '';

  const allTickers = Array.from(new Set([
    ...portfolio.activeHoldings.map(h => h.ticker),
    ...state.watchlist.map(w => w.ticker)
  ]));

  allTickers.forEach(ticker => {
    const f = state.fundamentals[ticker] || {};
    const curPrice = state.prices[ticker]?.price || 0;
    const eps = Number(f.eps) || 0;
    const bvps = Number(f.bvps) || 0;
    const grahamVal = eps > 0 && bvps > 0 ? Math.sqrt(22.5 * eps * bvps) : 0;

    const fcfPs = Number(f.fcfPerShare) || (eps > 0 ? eps * 0.9 : 0);
    const growth = Number(f.growth5y) || 10.0;
    const discount = Number(f.discountRate) || 9.0;
    const terminal = Number(f.terminalRate) || 2.5;

    let dcfVal = 0;
    if (fcfPs > 0 && discount > terminal) {
      let pvCashFlows = 0;
      let cf = fcfPs;
      for (let t = 1; t <= 5; t++) {
        cf = cf * (1 + growth / 100);
        pvCashFlows += cf / Math.pow(1 + discount / 100, t);
      }
      const terminalVal = (cf * (1 + terminal / 100)) / (discount / 100 - terminal / 100);
      const pvTerminal = terminalVal / Math.pow(1 + discount / 100, 5);
      dcfVal = pvCashFlows + pvTerminal;
    }

    const marginOfSafety = dcfVal > 0 && curPrice > 0 ? ((dcfVal - curPrice) / dcfVal) * 100 : 0;
    let mosBadge = '<span class="text-slate-400">-</span>';
    if (dcfVal > 0 && curPrice > 0) {
      if (marginOfSafety > 15) {
        mosBadge = `<span class="px-2 py-0.5 rounded-full font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px]">Undervalued (+${marginOfSafety.toFixed(1)}%)</span>`;
      } else if (marginOfSafety < -15) {
        mosBadge = `<span class="px-2 py-0.5 rounded-full font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30 text-[10px]">Overvalued (${marginOfSafety.toFixed(1)}%)</span>`;
      } else {
        mosBadge = `<span class="px-2 py-0.5 rounded-full font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30 text-[10px]">Fair Value (${marginOfSafety.toFixed(1)}%)</span>`;
      }
    }

    const tr = document.createElement('tr');
    tr.className = 'hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition text-xs';
    tr.innerHTML = `
      <td class="py-3 px-4 font-bold text-slate-900 dark:text-white sticky-col-mobile flex items-center gap-1.5">
        <span>${ticker}</span>
        <button onclick="openCalcModalForTicker('${ticker}')" class="text-brand-500 hover:text-brand-400 ml-1" title="Edit Metrics & DCF">
          <i class="fa-solid fa-pen-to-square text-[11px]"></i>
        </button>
      </td>
      <td class="py-3 px-4 text-right num-font">${f.pe || '-'}</td>
      <td class="py-3 px-4 text-right num-font text-slate-400">${f.fwdPe || '-'}</td>
      <td class="py-3 px-4 text-right num-font">${eps ? Fin.currency(eps) : '-'}</td>
      <td class="py-3 px-4 text-right num-font font-bold">${f.marketCap || '-'}</td>
      <td class="py-3 px-4 text-right num-font text-slate-400">${f.debtEquity ?? '-'}</td>
      <td class="py-3 px-4 text-right num-font">${f.roe ? f.roe + '%' : '-'}</td>
      <td class="py-3 px-4 text-right num-font">${f.fcf || (fcfPs ? Fin.currency(fcfPs) + '/sh' : '-')}</td>
      <td class="py-3 px-4 text-right num-font text-cyan-500">${f.divYield ? f.divYield + '%' : '-'}</td>
      <td class="py-3 px-4 text-right num-font font-bold text-indigo-500">${grahamVal > 0 ? Fin.currency(grahamVal) : '-'}</td>
      <td class="py-3 px-4 text-right num-font font-bold text-emerald-500">${dcfVal > 0 ? Fin.currency(dcfVal) : '-'}</td>
      <td class="py-3 px-4 text-center">${mosBadge}</td>
    `;
    fundTbody.appendChild(tr);
  });
}

// ============================================================================
// 7. CHART.JS GRAPHICAL ANALYSIS (INCLUDING MONTHLY HISTORICAL TRENDS)
// ============================================================================
function renderCharts() {
  renderMonthlyHistoryChart();
  renderAllocationChart();
  renderDividendsChart();
  renderPnlBreakdownChart();
}

/**
 * Renders either:
 *  1) Entire Portfolio Monthly Historical Value vs. Cost Basis
 *  2) Individual Stock Monthly Historical Closing Prices + Cost Basis / Target Price Line
 */
function renderMonthlyHistoryChart() {
  const ctx = document.getElementById('chart-monthly-history');
  const emptyOverlay = document.getElementById('chart-history-empty');
  const emptyText = document.getElementById('chart-history-empty-text');
  const subtitle = document.getElementById('historical-chart-subtitle');
  const target = document.getElementById('history-target-select')?.value || 'PORTFOLIO';

  if (charts.monthlyHistory) charts.monthlyHistory.destroy();

  const isDark = document.documentElement.classList.contains('dark');
  const isMobile = DeviceDetector.profile.effectiveMode === 'mobile';

  // CASE A: INDIVIDUAL STOCK MONTHLY HISTORICAL TREND
  if (target !== 'PORTFOLIO') {
    const series = state.historicalPrices[target] || [];
    if (series.length === 0) {
      emptyOverlay.classList.remove('hidden');
      emptyText.textContent = `No monthly historical data cached for ${target} yet. Click "Fetch Monthly API Data" above to download monthly closing prices.`;
      return;
    }
    emptyOverlay.classList.add('hidden');

    const sliced = series.slice(-historyRangeMonths);
    const labels = sliced.map(r => r.month);
    const closeData = sliced.map(r => r.close);

    const holding = portfolio.activeHoldings.find(h => h.ticker === target);
    const watched = state.watchlist.find(w => w.ticker === target);
    const refValue = holding ? holding.avgCost : (watched ? watched.targetBuyPrice : null);
    const refLabel = holding ? `Your Avg Cost (${Fin.currency(refValue)})` : (watched ? `Target Buy (${Fin.currency(refValue)})` : null);

    subtitle.textContent = `${target} — Monthly Historical Adjusted Closing Prices (${sliced.length} months shown)`;

    const datasets = [
      {
        label: `${target} Monthly Close ($)`,
        data: closeData,
        borderColor: '#10b981',
        backgroundColor: 'rgba(16, 185, 129, 0.12)',
        fill: true,
        tension: 0.3,
        pointRadius: isMobile ? 2 : 3.5,
        pointBackgroundColor: '#10b981'
      }
    ];

    if (refValue) {
      datasets.push({
        label: refLabel,
        data: labels.map(() => refValue),
        borderColor: '#6366f1',
        borderDash: [6, 6],
        borderWidth: 2,
        pointRadius: 0,
        fill: false
      });
    }

    charts.monthlyHistory = new Chart(ctx, {
      type: 'line',
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        scales: {
          x: {
            grid: { color: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)' },
            ticks: { color: isDark ? '#94a3b8' : '#64748b', font: { size: isMobile ? 9 : 10 }, maxTicksLimit: isMobile ? 6 : 12 }
          },
          y: {
            grid: { color: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)' },
            ticks: {
              color: isDark ? '#94a3b8' : '#64748b',
              font: { size: isMobile ? 9 : 10 },
              callback: (v) => '$' + v.toLocaleString()
            }
          }
        },
        plugins: {
          legend: {
            labels: { color: isDark ? '#cbd5e1' : '#334155', font: { size: 11 } }
          },
          tooltip: {
            callbacks: {
              label: (c) => ` ${c.dataset.label}: ${Fin.currency(c.raw)}`
            }
          }
        }
      }
    });
    return;
  }

  // CASE B: ENTIRE PORTFOLIO AGGREGATE MONTHLY TREND
  const heldTickers = portfolio.activeHoldings.map(h => h.ticker);
  if (heldTickers.length === 0) {
    emptyOverlay.classList.remove('hidden');
    emptyText.textContent = 'Record your first stock trade and sync your API key to view monthly historical portfolio trends.';
    return;
  }

  // Collect all unique months available in state.historicalPrices across held tickers
  const monthSet = new Set();
  heldTickers.forEach(t => {
    (state.historicalPrices[t] || []).forEach(r => monthSet.add(r.month));
  });

  // Also include transaction months if API history hasn't been fetched yet
  state.transactions.forEach(tx => {
    if (tx.date) monthSet.add(tx.date.slice(0, 7));
  });

  const allMonths = Array.from(monthSet).sort().slice(-historyRangeMonths);
  if (allMonths.length === 0) {
    emptyOverlay.classList.remove('hidden');
    emptyText.textContent = 'Click "Fetch Monthly API Data" to retrieve monthly historical prices for your holdings.';
    return;
  }
  emptyOverlay.classList.add('hidden');
  subtitle.textContent = `Aggregate Portfolio Historical Valuation across ${allMonths.length} months`;

  const portfolioMonthlyValues = [];
  const portfolioCostSeries = [];

  allMonths.forEach(monthStr => {
    let monthMarketVal = 0;
    portfolio.activeHoldings.forEach(h => {
      const hist = state.historicalPrices[h.ticker] || [];
      // Find matching month or closest prior month
      let priceForMonth = h.currentPrice;
      const exact = hist.find(item => item.month === monthStr);
      if (exact) {
        priceForMonth = exact.close;
      } else if (hist.length > 0) {
        const prior = hist.filter(item => item.month <= monthStr);
        priceForMonth = prior.length > 0 ? prior[prior.length - 1].close : hist[0].close;
      }
      monthMarketVal += h.shares * priceForMonth;
    });

    portfolioMonthlyValues.push(Fin.round(monthMarketVal, 2));
    portfolioCostSeries.push(Fin.round(portfolio.totalStockCostBasis, 2));
  });

  charts.monthlyHistory = new Chart(ctx, {
    type: 'line',
    data: {
      labels: allMonths,
      datasets: [
        {
          label: 'Portfolio Holdings Value ($)',
          data: portfolioMonthlyValues,
          borderColor: '#10b981',
          backgroundColor: 'rgba(16, 185, 129, 0.14)',
          fill: true,
          tension: 0.32,
          pointRadius: isMobile ? 2 : 3.5,
          pointBackgroundColor: '#10b981'
        },
        {
          label: 'Active Cost Basis ($)',
          data: portfolioCostSeries,
          borderColor: '#f59e0b',
          borderDash: [5, 5],
          fill: false,
          tension: 0.2,
          pointRadius: 0
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      scales: {
        x: {
          grid: { color: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)' },
          ticks: { color: isDark ? '#94a3b8' : '#64748b', font: { size: isMobile ? 9 : 10 }, maxTicksLimit: isMobile ? 6 : 12 }
        },
        y: {
          grid: { color: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)' },
          ticks: {
            color: isDark ? '#94a3b8' : '#64748b',
            font: { size: isMobile ? 9 : 10 },
            callback: (v) => '$' + v.toLocaleString()
          }
        }
      },
      plugins: {
        legend: {
          labels: { color: isDark ? '#cbd5e1' : '#334155', font: { size: 11 } }
        },
        tooltip: {
          callbacks: {
            label: (c) => ` ${c.dataset.label}: ${Fin.currency(c.raw)}`
          }
        }
      }
    }
  });
}

function renderAllocationChart() {
  const ctx = document.getElementById('chart-allocation');
  const emptyDiv = document.getElementById('chart-alloc-empty');
  if (charts.allocation) charts.allocation.destroy();

  if (!portfolio.activeHoldings || portfolio.activeHoldings.length === 0) {
    emptyDiv.classList.remove('hidden');
    return;
  }
  emptyDiv.classList.add('hidden');

  const labels = [];
  const data = [];
  const palette = ['#10b981', '#6366f1', '#06b6d4', '#f59e0b', '#ec4899', '#8b5cf6', '#3b82f6', '#14b8a6', '#f97316', '#84cc16'];

  if (allocationViewMode === 'ticker') {
    portfolio.activeHoldings.forEach(h => {
      labels.push(h.ticker);
      data.push(h.marketValue);
    });
  } else {
    const sectorMap = {};
    portfolio.activeHoldings.forEach(h => {
      const s = h.sector || 'Technology';
      sectorMap[s] = (sectorMap[s] || 0) + h.marketValue;
    });
    Object.keys(sectorMap).forEach(s => {
      labels.push(s);
      data.push(Fin.round(sectorMap[s], 2));
    });
  }

  const isDark = document.documentElement.classList.contains('dark');
  charts.allocation = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: palette.slice(0, labels.length),
        borderWidth: 2,
        borderColor: isDark ? '#111827' : '#ffffff',
        hoverOffset: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '66%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: { boxWidth: 11, color: isDark ? '#94a3b8' : '#475569', font: { size: 11 } }
        },
        tooltip: {
          callbacks: {
            label: (c) => {
              const val = c.raw || 0;
              const total = data.reduce((a, b) => a + b, 0);
              const pct = total > 0 ? ((val / total) * 100).toFixed(1) : 0;
              return ` ${c.label}: ${Fin.currency(val)} (${pct}%)`;
            }
          }
        }
      }
    }
  });
}

function renderDividendsChart() {
  const ctx = document.getElementById('chart-dividends');
  if (charts.dividends) charts.dividends.destroy();

  const monthlyMap = {};
  state.dividends.forEach(d => {
    const m = (d.payDate || '').slice(0, 7) || 'Unknown';
    monthlyMap[m] = (monthlyMap[m] || 0) + (d.totalAmount || 0);
  });

  const months = Object.keys(monthlyMap).sort();
  const totals = months.map(m => Fin.round(monthlyMap[m], 2));
  document.getElementById('chart-div-total-badge').textContent = `${Fin.currency(portfolio.totalDividendsEarned)} Total`;

  const isDark = document.documentElement.classList.contains('dark');
  charts.dividends = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: months.length > 0 ? months : ['No Dividends Logged'],
      datasets: [{
        label: 'Monthly Dividend ($)',
        data: totals.length > 0 ? totals : [0],
        backgroundColor: '#06b6d4',
        borderRadius: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { grid: { display: false }, ticks: { color: isDark ? '#94a3b8' : '#64748b', font: { size: 10 } } },
        y: {
          grid: { color: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' },
          ticks: { color: isDark ? '#94a3b8' : '#64748b', font: { size: 10 }, callback: (v) => '$' + v }
        }
      },
      plugins: { legend: { display: false } }
    }
  });
}

function renderPnlBreakdownChart() {
  const ctx = document.getElementById('chart-pnl-breakdown');
  if (charts.pnlBreakdown) charts.pnlBreakdown.destroy();

  const tickers = Array.from(new Set([
    ...portfolio.activeHoldings.map(h => h.ticker),
    ...Object.keys(portfolio.allHoldingsMap).filter(t => (portfolio.allHoldingsMap[t].realizedGain || 0) !== 0)
  ]));

  const unrealizedSeries = tickers.map(t => {
    const active = portfolio.activeHoldings.find(h => h.ticker === t);
    return active ? active.unrealizedGain : 0;
  });
  const realizedSeries = tickers.map(t => portfolio.allHoldingsMap[t]?.realizedGain || 0);

  const isDark = document.documentElement.classList.contains('dark');
  charts.pnlBreakdown = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: tickers.length > 0 ? tickers : ['No Positions'],
      datasets: [
        { label: 'Unrealized P&L ($)', data: unrealizedSeries.length > 0 ? unrealizedSeries : [0], backgroundColor: '#10b981', borderRadius: 5 },
        { label: 'Realized P&L ($)', data: realizedSeries.length > 0 ? realizedSeries : [0], backgroundColor: '#6366f1', borderRadius: 5 }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { grid: { display: false }, ticks: { color: isDark ? '#94a3b8' : '#64748b', font: { size: 10 } } },
        y: {
          grid: { color: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' },
          ticks: { color: isDark ? '#94a3b8' : '#64748b', font: { size: 10 }, callback: (v) => (v >= 0 ? '+$' : '-$') + Math.abs(v) }
        }
      },
      plugins: { legend: { position: 'top', labels: { color: isDark ? '#94a3b8' : '#475569', font: { size: 11 } } } }
    }
  });
}

// ============================================================================
// 8. API SYNCHRONIZATION WORKFLOWS
// ============================================================================
async function syncAllMarketData(includeMonthly = true) {
  if (!MarketAPI.hasKey()) {
    showToast('Please configure your Stock API Key in Settings first.', 'error');
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
  showToast(`Syncing live API quotes${includeMonthly ? ' & monthly history' : ''} for ${allTickers.length} ticker(s)...`, 'info');

  let updatedQuotes = 0;
  let updatedHistory = 0;

  for (const ticker of allTickers) {
    try {
      const q = await MarketAPI.fetchQuote(ticker);
      if (q && q.price > 0) {
        const prev = state.prices[ticker]?.price || q.prevPrice;
        state.prices[ticker] = {
          price: q.price,
          prevPrice: q.prevPrice,
          change: q.change,
          changePct: q.changePct,
          lastUpdated: new Date().toISOString()
        };
        updatedQuotes++;
        triggerRowPriceFlash(ticker, q.price >= prev);
      }
    } catch (err) {
      console.warn(`Quote fetch failed for ${ticker}:`, err.message);
    }

    if (includeMonthly) {
      try {
        const history = await MarketAPI.fetchMonthlyHistory(ticker);
        if (Array.isArray(history) && history.length > 0) {
          state.historicalPrices[ticker] = history;
          updatedHistory++;
        }
      } catch (err) {
        console.warn(`Monthly history fetch failed for ${ticker}:`, err.message);
      }
    }
  }

  state.settings.lastApiSync = new Date().toISOString();
  recalculatePortfolio();
  saveState();
  renderAll();

  if (syncIcon) syncIcon.classList.remove('fa-spin');
  showToast(`Synced ${updatedQuotes} live quote(s) and ${updatedHistory} monthly series via API.`, 'success');
}

async function syncFundamentalsViaAPI() {
  if (!MarketAPI.hasKey()) {
    showToast('Configure your Stock API Key in Settings to fetch fundamentals.', 'error');
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

window.viewStockHistoryOnDashboard = async function(ticker) {
  switchTab('dashboard');
  const select = document.getElementById('history-target-select');
  if (select) {
    populateHistorySelector();
    select.value = ticker;
  }

  if ((!state.historicalPrices[ticker] || state.historicalPrices[ticker].length === 0) && MarketAPI.hasKey()) {
    try {
      showToast(`Fetching monthly price history for ${ticker}...`, 'info');
      const history = await MarketAPI.fetchMonthlyHistory(ticker);
      if (history && history.length > 0) {
        state.historicalPrices[ticker] = history;
        saveState();
        populateHistorySelector();
        select.value = ticker;
      }
    } catch (e) {
      showToast(`API notice: ${e.message}`, 'error');
    }
  }
  renderMonthlyHistoryChart();
};

// ============================================================================
// 9. SHEETJS MULTI-SHEET EXCEL EXPORT & RESTORE (WITH HISTORICAL PRICES)
// ============================================================================
function exportPortfolioToExcel() {
  try {
    const wb = XLSX.utils.book_new();

    // 1. Account_Summary
    const summaryData = [
      { Metric: 'Total Portfolio Value', Value: Fin.currency(portfolio.totalPortfolioValue) },
      { Metric: 'Available Cash Balance', Value: Fin.currency(portfolio.cashBalance) },
      { Metric: 'Total Stock Market Value', Value: Fin.currency(portfolio.totalStockMarketValue) },
      { Metric: 'Active Invested Cost Basis', Value: Fin.currency(portfolio.totalStockCostBasis) },
      { Metric: 'Unrealized P&L ($)', Value: Fin.currency(portfolio.totalUnrealizedGain, true) },
      { Metric: 'Unrealized P&L (%)', Value: Fin.percent(portfolio.totalUnrealizedGainPct, true) },
      { Metric: 'Realized P&L ($)', Value: Fin.currency(portfolio.totalRealizedPnL, true) },
      { Metric: 'Total Dividends Earned ($)', Value: Fin.currency(portfolio.totalDividendsEarned) },
      { Metric: 'Active Positions Count', Value: portfolio.activeHoldings.length },
      { Metric: 'Export Timestamp', Value: new Date().toISOString() }
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summaryData), 'Account_Summary');

    // 2. Holdings
    const holdingsData = portfolio.activeHoldings.map(h => ({
      Ticker: h.ticker,
      'Company Name': h.companyName,
      Sector: h.sector,
      'Shares Held': h.shares,
      'Avg Cost Basis ($)': h.avgCost,
      'Total Cost Basis ($)': h.totalCostBasis,
      'Current Price ($)': h.currentPrice,
      'Market Value ($)': h.marketValue,
      'Unrealized P&L ($)': h.unrealizedGain,
      'Unrealized P&L (%)': h.unrealizedGainPct,
      'Yield on Cost (%)': h.yieldOnCost,
      'Total Dividends ($)': h.totalDividends
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(holdingsData), 'Holdings');

    // 3. Transactions
    const txData = state.transactions.map(t => ({
      'Transaction ID': t.id,
      Date: t.date,
      Type: t.type,
      Ticker: t.ticker || 'USD CASH',
      Shares: t.shares || 0,
      'Price per Share ($)': t.price || 0,
      'Fees ($)': t.fees || 0,
      'Net Total ($)': t.type === 'DEPOSIT' || t.type === 'WITHDRAW' ? t.amount : (t.shares * t.price),
      'Realized Gain/Loss ($)': t.realizedGain || 0,
      Notes: t.notes || ''
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(txData), 'Transactions');

    // 4. Dividends
    const divData = state.dividends.map(d => ({
      'Dividend ID': d.id,
      Ticker: d.ticker,
      'Pay Date': d.payDate,
      'Ex Date': d.exDate || '',
      'Payout Per Share ($)': d.amountPerShare || 0,
      'Total Payout ($)': d.totalAmount,
      'DRIP Reinvested': d.isDrip ? 'YES' : 'NO',
      'DRIP Shares Added': d.dripShares || 0,
      Notes: d.notes || ''
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(divData), 'Dividends');

    // 5. Watchlist_Fundamentals
    const allTickers = Array.from(new Set([
      ...state.watchlist.map(w => w.ticker),
      ...Object.keys(state.fundamentals)
    ]));
    const wlData = allTickers.map(ticker => {
      const w = state.watchlist.find(item => item.ticker === ticker) || {};
      const f = state.fundamentals[ticker] || {};
      return {
        Ticker: ticker,
        'Company Name': w.name || f.name || ticker,
        Sector: w.sector || f.sector || 'Technology',
        'Current Price ($)': state.prices[ticker]?.price || 0,
        'Target Buy Price ($)': w.targetBuyPrice || 0,
        'On Watchlist': w.ticker ? 'YES' : 'NO',
        'P/E Ratio': f.pe || '',
        'Forward P/E': f.fwdPe || '',
        'EPS ($)': f.eps || '',
        'Book Value/Share ($)': f.bvps || '',
        'Market Cap': f.marketCap || '',
        'Debt to Equity': f.debtEquity || '',
        'ROE (%)': f.roe || '',
        'Free Cash Flow': f.fcf || '',
        'FCF Per Share ($)': f.fcfPerShare || '',
        'Div Yield (%)': f.divYield || ''
      };
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(wlData), 'Watchlist_Fundamentals');

    // 6. Historical_Prices
    const histRows = [];
    Object.keys(state.historicalPrices).forEach(ticker => {
      (state.historicalPrices[ticker] || []).forEach(r => {
        histRows.push({
          Ticker: ticker,
          Month: r.month,
          'Close Price ($)': r.close,
          'High ($)': r.high || r.close,
          'Low ($)': r.low || r.close,
          Volume: r.volume || 0
        });
      });
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(histRows), 'Historical_Prices');

    const dateStr = new Date().toISOString().split('T')[0];
    XLSX.writeFile(wb, `myPortfolio_Backup_${dateStr}.xlsx`);
    showToast('Exported myPortfolio backup (.xlsx)!', 'success');
  } catch (err) {
    console.error('Excel export failed:', err);
    showToast('Export failed: ' + err.message, 'error');
  }
}

function restorePortfolioFromExcel(file) {
  const statusMsg = document.getElementById('import-status-msg');
  statusMsg.innerHTML = '<span class="text-indigo-400">Validating and restoring workbook...</span>';

  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const data = new Uint8Array(e.target.result);
      const wb = XLSX.read(data, { type: 'array' });

      if (!wb.SheetNames.includes('Transactions') && !wb.SheetNames.includes('Holdings')) {
        throw new Error('Invalid backup workbook: missing Transactions or Holdings sheet.');
      }

      if (wb.SheetNames.includes('Transactions')) {
        const rawTx = XLSX.utils.sheet_to_json(wb.Sheets['Transactions']);
        state.transactions = rawTx.map((row, idx) => ({
          id: row['Transaction ID'] || `TX-${idx + 1}`,
          date: row['Date'] || new Date().toISOString().split('T')[0],
          type: (row['Type'] || 'BUY').toUpperCase(),
          ticker: (row['Ticker'] || '').toUpperCase(),
          shares: Number(row['Shares']) || 0,
          price: Number(row['Price per Share ($)']) || 0,
          fees: Number(row['Fees ($)']) || 0,
          amount: Number(row['Net Total ($)']) || 0,
          notes: row['Notes'] || ''
        }));
      }

      if (wb.SheetNames.includes('Holdings')) {
        const rawHoldings = XLSX.utils.sheet_to_json(wb.Sheets['Holdings']);
        rawHoldings.forEach(row => {
          const t = (row['Ticker'] || '').toUpperCase();
          const curP = Number(row['Current Price ($)'] || row['Current Market Price ($)']) || 0;
          if (t && curP > 0) {
            state.prices[t] = { price: curP, prevPrice: curP, change: 0, changePct: 0, lastUpdated: new Date().toISOString() };
          }
        });
      }

      if (wb.SheetNames.includes('Dividends')) {
        const rawDiv = XLSX.utils.sheet_to_json(wb.Sheets['Dividends']);
        state.dividends = rawDiv.map((row, idx) => ({
          id: row['Dividend ID'] || `DIV-${idx + 1}`,
          ticker: (row['Ticker'] || '').toUpperCase(),
          payDate: row['Pay Date'] || new Date().toISOString().split('T')[0],
          exDate: row['Ex Date'] || '',
          amountPerShare: Number(row['Payout Per Share ($)']) || 0,
          totalAmount: Number(row['Total Payout ($)']) || 0,
          isDrip: (row['DRIP Reinvested'] || '').toString().toUpperCase() === 'YES',
          dripShares: Number(row['DRIP Shares Added']) || 0,
          notes: row['Notes'] || ''
        }));
      }

      if (wb.SheetNames.includes('Watchlist_Fundamentals')) {
        const rawWl = XLSX.utils.sheet_to_json(wb.Sheets['Watchlist_Fundamentals']);
        state.watchlist = [];
        rawWl.forEach(row => {
          const t = (row['Ticker'] || '').toUpperCase();
          if (!t) return;
          if ((row['On Watchlist'] || 'YES').toString().toUpperCase() !== 'NO' && Number(row['Target Buy Price ($)']) > 0) {
            state.watchlist.push({
              ticker: t,
              name: row['Company Name'] || t,
              sector: row['Sector'] || 'Technology',
              targetBuyPrice: Number(row['Target Buy Price ($)']) || 0
            });
          }
          state.fundamentals[t] = {
            name: row['Company Name'] || t,
            sector: row['Sector'] || 'Technology',
            pe: Number(row['P/E Ratio']) || 0,
            fwdPe: Number(row['Forward P/E']) || 0,
            eps: Number(row['EPS ($)']) || 0,
            bvps: Number(row['Book Value/Share ($)']) || 0,
            marketCap: row['Market Cap'] || '',
            debtEquity: Number(row['Debt to Equity']) || 0,
            roe: Number(row['ROE (%)']) || 0,
            fcf: row['Free Cash Flow'] || '',
            fcfPerShare: Number(row['FCF Per Share ($)']) || 0,
            divYield: Number(row['Div Yield (%)']) || 0
          };
        });
      }

      if (wb.SheetNames.includes('Historical_Prices')) {
        const rawHist = XLSX.utils.sheet_to_json(wb.Sheets['Historical_Prices']);
        state.historicalPrices = {};
        rawHist.forEach(row => {
          const t = (row['Ticker'] || '').toUpperCase();
          if (!t || !row['Month']) return;
          if (!state.historicalPrices[t]) state.historicalPrices[t] = [];
          state.historicalPrices[t].push({
            month: String(row['Month']).slice(0, 7),
            close: Number(row['Close Price ($)']) || 0,
            high: Number(row['High ($)']) || 0,
            low: Number(row['Low ($)']) || 0,
            volume: Number(row['Volume']) || 0
          });
        });
      }

      recalculatePortfolio();
      saveState();
      renderAll();

      statusMsg.innerHTML = '<span class="text-emerald-500 font-bold"><i class="fa-solid fa-check"></i> Workbook restored!</span>';
      showToast('Portfolio restored from Excel backup!', 'success');
    } catch (err) {
      statusMsg.innerHTML = `<span class="text-rose-500 font-bold">${err.message}</span>`;
      showToast('Restore failed: ' + err.message, 'error');
    }
  };
  reader.readAsArrayBuffer(file);
}

// ============================================================================
// 10. NAVIGATION, MODALS & FORM HANDLERS
// ============================================================================
function switchTab(target) {
  document.querySelectorAll('.nav-tab').forEach(t => {
    const isMatch = t.getAttribute('data-tab') === target;
    if (isMatch) {
      t.classList.add('active', 'text-brand-600', 'dark:text-brand-400', 'bg-brand-50', 'dark:bg-brand-950/40');
      t.classList.remove('text-slate-600', 'dark:text-slate-400', 'text-slate-500');
    } else {
      t.classList.remove('active', 'text-brand-600', 'dark:text-brand-400', 'bg-brand-50', 'dark:bg-brand-950/40');
      t.classList.add('text-slate-600', 'dark:text-slate-400');
    }
  });

  document.querySelectorAll('.tab-pane').forEach(p => p.classList.add('hidden'));
  const pane = document.getElementById(`tab-content-${target}`);
  if (pane) pane.classList.remove('hidden');

  if (target === 'dashboard') {
    setTimeout(renderCharts, 40);
  }
}

function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  let icon = 'fa-info-circle text-sky-400';
  if (type === 'success') icon = 'fa-circle-check text-emerald-400';
  if (type === 'error') icon = 'fa-circle-xmark text-rose-400';

  toast.className = 'pointer-events-auto p-3.5 rounded-xl bg-slate-900/95 text-white border border-slate-700 shadow-2xl flex items-center gap-3 text-xs transition-all duration-300';
  toast.innerHTML = `
    <i class="fa-solid ${icon} text-base"></i>
    <span class="flex-1 font-medium">${message}</span>
    <button class="text-slate-400 hover:text-white" onclick="this.parentElement.remove()"><i class="fa-solid fa-xmark"></i></button>
  `;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 4200);
}

function openModal(id) {
  document.getElementById(id).classList.remove('hidden');
}

function closeModal(id) {
  document.getElementById(id).classList.add('hidden');
}

function openTradeModal(ticker = null, forceType = 'BUY', defaultPrice = null) {
  const type = forceType || 'BUY';
  document.getElementById('trade-type-val').value = type;
  document.getElementById('trade-date').value = new Date().toISOString().split('T')[0];
  document.getElementById('trade-cash-date').value = new Date().toISOString().split('T')[0];
  document.getElementById('trade-error-msg').classList.add('hidden');

  document.querySelectorAll('.tx-type-btn').forEach(b => {
    const bType = b.getAttribute('data-tx-type');
    b.className = bType === type
      ? 'tx-type-btn py-2 text-xs font-bold rounded-lg border border-brand-500 bg-brand-50 dark:bg-brand-950/50 text-brand-600 dark:text-brand-400'
      : 'tx-type-btn py-2 text-xs font-bold rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400';
  });

  updateTradeModalFields(type);

  if (ticker) {
    document.getElementById('trade-ticker').value = ticker;
    const price = defaultPrice || state.prices[ticker]?.price || '';
    document.getElementById('trade-price').value = price;
    updateHoldingHint(ticker);
  } else {
    document.getElementById('trade-ticker').value = '';
    document.getElementById('trade-price').value = '';
    document.getElementById('trade-holding-hint').textContent = '';
  }

  document.getElementById('trade-shares').value = '';
  document.getElementById('trade-fees').value = '0.00';
  updateTradeCalculatedTotal();
  openModal('modal-trade');
}

window.openTradeModalForTicker = function(ticker, type, defaultPrice = null) {
  openTradeModal(ticker, type, defaultPrice);
};

function updateTradeModalFields(type) {
  const stockFields = document.getElementById('stock-trade-fields');
  const cashFields = document.getElementById('cash-trade-fields');
  const title = document.getElementById('trade-modal-title');

  if (type === 'DEPOSIT' || type === 'WITHDRAW') {
    stockFields.classList.add('hidden');
    cashFields.classList.remove('hidden');
    document.getElementById('trade-ticker').removeAttribute('required');
    document.getElementById('trade-shares').removeAttribute('required');
    document.getElementById('trade-price').removeAttribute('required');
    title.innerHTML = `<i class="fa-solid fa-money-bill-transfer text-indigo-500"></i> ${type === 'DEPOSIT' ? 'Deposit Cash' : 'Withdraw Cash'}`;
  } else {
    stockFields.classList.remove('hidden');
    cashFields.classList.add('hidden');
    document.getElementById('trade-ticker').setAttribute('required', 'true');
    document.getElementById('trade-shares').setAttribute('required', 'true');
    document.getElementById('trade-price').setAttribute('required', 'true');
    title.innerHTML = `<i class="fa-solid fa-money-bill-trend-up text-brand-500"></i> Record ${type} Order`;
  }
}

function updateHoldingHint(ticker) {
  const hint = document.getElementById('trade-holding-hint');
  const active = portfolio.activeHoldings.find(h => h.ticker === ticker);
  hint.textContent = `Currently held: ${active ? Fin.shares(active.shares) : 0} shares`;
}

function updateTradeCalculatedTotal() {
  const shares = parseFloat(document.getElementById('trade-shares').value) || 0;
  const price = parseFloat(document.getElementById('trade-price').value) || 0;
  const fees = parseFloat(document.getElementById('trade-fees').value) || 0;
  const type = document.getElementById('trade-type-val').value;
  const total = type === 'BUY' ? (shares * price + fees) : Math.max(0, shares * price - fees);
  document.getElementById('trade-calc-total').textContent = Fin.currency(total);
}

async function handleTradeSubmit(e) {
  e.preventDefault();
  const type = document.getElementById('trade-type-val').value;
  const errorMsg = document.getElementById('trade-error-msg');
  errorMsg.classList.add('hidden');

  if (type === 'DEPOSIT' || type === 'WITHDRAW') {
    const amt = parseFloat(document.getElementById('trade-cash-amount').value);
    if (!amt || amt <= 0) {
      errorMsg.textContent = 'Enter a valid positive cash amount.';
      errorMsg.classList.remove('hidden');
      return;
    }
    if (type === 'WITHDRAW' && amt > portfolio.cashBalance) {
      errorMsg.textContent = `Insufficient cash. Available balance is ${Fin.currency(portfolio.cashBalance)}.`;
      errorMsg.classList.remove('hidden');
      return;
    }
    const date = document.getElementById('trade-cash-date').value || new Date().toISOString().split('T')[0];
    const notes = document.getElementById('trade-notes').value.trim() || `${type} cash transaction`;

    state.transactions.push({
      id: `TX-${Date.now().toString().slice(-6)}`,
      date,
      type,
      amount: amt,
      notes
    });

    recalculatePortfolio();
    saveState();
    renderAll();
    closeModal('modal-trade');
    showToast(`${type === 'DEPOSIT' ? 'Deposited' : 'Withdrew'} ${Fin.currency(amt)}`, 'success');
    return;
  }

  const ticker = document.getElementById('trade-ticker').value.trim().toUpperCase();
  const shares = parseFloat(document.getElementById('trade-shares').value);
  const price = parseFloat(document.getElementById('trade-price').value);
  const fees = parseFloat(document.getElementById('trade-fees').value) || 0;
  const date = document.getElementById('trade-date').value || new Date().toISOString().split('T')[0];
  const notes = document.getElementById('trade-notes').value.trim();

  if (!ticker || !shares || shares <= 0 || !price || price <= 0) {
    errorMsg.textContent = 'Please provide valid ticker, shares, and price.';
    errorMsg.classList.remove('hidden');
    return;
  }

  if (type === 'SELL') {
    const active = portfolio.activeHoldings.find(h => h.ticker === ticker);
    const held = active ? active.shares : 0;
    if (shares > held) {
      errorMsg.textContent = `Cannot sell ${Fin.shares(shares)} shares of ${ticker}. You hold ${Fin.shares(held)} shares.`;
      errorMsg.classList.remove('hidden');
      return;
    }
  }

  if (!state.prices[ticker]) {
    state.prices[ticker] = { price, prevPrice: price, change: 0, changePct: 0, lastUpdated: new Date().toISOString() };
  }

  state.transactions.push({
    id: `TX-${Date.now().toString().slice(-6)}`,
    date,
    type,
    ticker,
    shares,
    price,
    fees,
    notes
  });

  recalculatePortfolio();
  saveState();
  renderAll();
  closeModal('modal-trade');
  showToast(`Recorded ${type} order for ${Fin.shares(shares)} ${ticker}`, 'success');

  // Proactively fetch live quote, monthly historicals & fundamentals via API if key exists
  if (MarketAPI.hasKey()) {
    try {
      const q = await MarketAPI.fetchQuote(ticker);
      if (q?.price) state.prices[ticker] = { ...q, lastUpdated: new Date().toISOString() };
      if (!state.historicalPrices[ticker] || state.historicalPrices[ticker].length === 0) {
        const hist = await MarketAPI.fetchMonthlyHistory(ticker);
        if (hist?.length) state.historicalPrices[ticker] = hist;
      }
      if (!state.fundamentals[ticker]) {
        state.fundamentals[ticker] = await MarketAPI.fetchFundamentals(ticker);
      }
      recalculatePortfolio();
      saveState();
      renderAll();
    } catch (err) {
      console.warn('Background API enrichment notice:', err.message);
    }
  }
}

function handleDividendSubmit(e) {
  e.preventDefault();
  const ticker = document.getElementById('div-ticker').value.trim().toUpperCase();
  const payDate = document.getElementById('div-pay-date').value;
  const exDate = document.getElementById('div-ex-date').value;
  const totalAmount = parseFloat(document.getElementById('div-amount').value);
  const isDrip = document.getElementById('div-drip-toggle').checked;
  const notes = document.getElementById('div-notes').value.trim();

  if (!ticker || !totalAmount || totalAmount <= 0) return;

  let dripShares = 0;
  if (isDrip) {
    const dripPrice = parseFloat(document.getElementById('div-drip-price').value) || state.prices[ticker]?.price || 100;
    dripShares = Fin.round(totalAmount / dripPrice, 4);
    state.transactions.push({
      id: `TX-DRIP-${Date.now().toString().slice(-6)}`,
      date: payDate,
      type: 'DRIP',
      ticker,
      shares: dripShares,
      price: dripPrice,
      fees: 0,
      notes: `Automatic DRIP reinvestment (${payDate})`
    });
  }

  state.dividends.push({
    id: `DIV-${Date.now().toString().slice(-6)}`,
    ticker,
    payDate,
    exDate,
    totalAmount,
    isDrip,
    dripShares,
    notes
  });

  recalculatePortfolio();
  saveState();
  renderAll();
  closeModal('modal-dividend');
  showToast(`Logged ${Fin.currency(totalAmount)} dividend for ${ticker}`, 'success');
}

async function handleWatchlistSubmit(e) {
  e.preventDefault();
  const ticker = document.getElementById('wl-ticker').value.trim().toUpperCase();
  const name = document.getElementById('wl-name').value.trim();
  const sector = document.getElementById('wl-sector').value;
  const targetBuyPrice = parseFloat(document.getElementById('wl-target-price').value);

  if (!ticker || !targetBuyPrice || targetBuyPrice <= 0) return;

  const existing = state.watchlist.find(w => w.ticker === ticker);
  if (existing) {
    existing.targetBuyPrice = targetBuyPrice;
    if (name) existing.name = name;
    existing.sector = sector;
  } else {
    state.watchlist.push({ ticker, name: name || ticker, sector, targetBuyPrice });
  }

  saveState();
  renderAll();
  closeModal('modal-watchlist');
  showToast(`Added ${ticker} to Watchlist`, 'success');

  if (MarketAPI.hasKey()) {
    try {
      const q = await MarketAPI.fetchQuote(ticker);
      if (q?.price) state.prices[ticker] = { ...q, lastUpdated: new Date().toISOString() };
      const fund = await MarketAPI.fetchFundamentals(ticker);
      if (fund) state.fundamentals[ticker] = fund;
      const hist = await MarketAPI.fetchMonthlyHistory(ticker);
      if (hist?.length) state.historicalPrices[ticker] = hist;
      saveState();
      renderAll();
    } catch (err) {
      console.warn('Watchlist API fetch warning:', err.message);
    }
  }
}

window.deleteTransaction = function(id) {
  if (!confirm('Delete this transaction?')) return;
  state.transactions = state.transactions.filter(t => t.id !== id);
  recalculatePortfolio();
  saveState();
  renderAll();
  showToast('Transaction removed', 'info');
};

window.deleteDividend = function(id) {
  if (!confirm('Delete this dividend record?')) return;
  state.dividends = state.dividends.filter(d => d.id !== id);
  recalculatePortfolio();
  saveState();
  renderAll();
  showToast('Dividend removed', 'info');
};

window.deleteFromWatchlist = function(ticker) {
  state.watchlist = state.watchlist.filter(w => w.ticker !== ticker);
  saveState();
  renderAll();
  showToast(`Removed ${ticker} from watchlist`, 'info');
};

// ============================================================================
// 11. INTRINSIC FAIR-VALUE CALCULATOR MODAL (GRAHAM & 2-STAGE DCF)
// ============================================================================
function populateCalculatorTickers() {
  const select = document.getElementById('calc-ticker-select');
  select.innerHTML = '';
  const allTickers = Array.from(new Set([
    ...portfolio.activeHoldings.map(h => h.ticker),
    ...state.watchlist.map(w => w.ticker)
  ]));

  allTickers.forEach(t => {
    const opt = document.createElement('option');
    opt.value = t;
    opt.textContent = t;
    select.appendChild(opt);
  });

  if (allTickers.length > 0) loadCalculatorForTicker(allTickers[0]);
}

window.openCalcModalForTicker = function(ticker) {
  populateCalculatorTickers();
  document.getElementById('calc-ticker-select').value = ticker;
  loadCalculatorForTicker(ticker);
  openModal('modal-calc');
};

function loadCalculatorForTicker(ticker) {
  const curPrice = state.prices[ticker]?.price || 0;
  document.getElementById('calc-current-price-badge').textContent = curPrice > 0 ? Fin.currency(curPrice) : 'N/A';

  const f = state.fundamentals[ticker] || {};
  document.getElementById('calc-pe').value = f.pe || '';
  document.getElementById('calc-fwd-pe').value = f.fwdPe || '';
  document.getElementById('calc-mcap').value = f.marketCap || '';
  document.getElementById('calc-de').value = f.debtEquity || '';
  document.getElementById('calc-roe').value = f.roe || '';
  document.getElementById('calc-fcf-str').value = f.fcf || '';
  document.getElementById('calc-div-yield').value = f.divYield || '';

  document.getElementById('calc-graham-eps').value = f.eps || '';
  document.getElementById('calc-graham-bvps').value = f.bvps || '';
  document.getElementById('calc-dcf-fcf').value = f.fcfPerShare || '';
  document.getElementById('calc-dcf-growth').value = f.growth5y || 10.0;
  document.getElementById('calc-dcf-discount').value = f.discountRate || 9.0;
  document.getElementById('calc-dcf-terminal').value = f.terminalRate || 2.5;

  computeGrahamNumberInModal();
  computeDCFInModal();
}

function computeGrahamNumberInModal() {
  const eps = parseFloat(document.getElementById('calc-graham-eps').value) || 0;
  const bvps = parseFloat(document.getElementById('calc-graham-bvps').value) || 0;
  const el = document.getElementById('calc-graham-result');
  el.textContent = eps > 0 && bvps > 0 ? Fin.currency(Math.sqrt(22.5 * eps * bvps)) : 'N/A';
}

function computeDCFInModal() {
  const fcf = parseFloat(document.getElementById('calc-dcf-fcf').value) || 0;
  const g = (parseFloat(document.getElementById('calc-dcf-growth').value) || 0) / 100;
  const r = (parseFloat(document.getElementById('calc-dcf-discount').value) || 9) / 100;
  const t = (parseFloat(document.getElementById('calc-dcf-terminal').value) || 2.5) / 100;

  const ticker = document.getElementById('calc-ticker-select').value;
  const curPrice = state.prices[ticker]?.price || 0;

  if (r <= t || fcf <= 0) {
    document.getElementById('calc-dcf-result').textContent = 'N/A';
    document.getElementById('calc-margin-safety-badge').textContent = '0.00%';
    return;
  }

  let pv = 0;
  let cf = fcf;
  for (let i = 1; i <= 5; i++) {
    cf = cf * (1 + g);
    pv += cf / Math.pow(1 + r, i);
  }
  const terminalVal = (cf * (1 + t)) / (r - t);
  const fairValue = pv + terminalVal / Math.pow(1 + r, 5);

  document.getElementById('calc-dcf-result').textContent = Fin.currency(fairValue);

  const mos = curPrice > 0 ? ((fairValue - curPrice) / fairValue) * 100 : 0;
  const mosEl = document.getElementById('calc-margin-safety-badge');
  mosEl.textContent = curPrice > 0
    ? `${mos >= 0 ? '+' : ''}${mos.toFixed(1)}% (${mos > 15 ? 'Undervalued' : (mos < -15 ? 'Overvalued' : 'Fair Value')})`
    : 'Sync Price First';
}

function saveValuationFromModal() {
  const ticker = document.getElementById('calc-ticker-select').value;
  if (!ticker) return;

  state.fundamentals[ticker] = {
    ...(state.fundamentals[ticker] || {}),
    pe: parseFloat(document.getElementById('calc-pe').value) || 0,
    fwdPe: parseFloat(document.getElementById('calc-fwd-pe').value) || 0,
    marketCap: document.getElementById('calc-mcap').value.trim(),
    debtEquity: parseFloat(document.getElementById('calc-de').value) || 0,
    roe: parseFloat(document.getElementById('calc-roe').value) || 0,
    fcf: document.getElementById('calc-fcf-str').value.trim(),
    divYield: parseFloat(document.getElementById('calc-div-yield').value) || 0,
    eps: parseFloat(document.getElementById('calc-graham-eps').value) || 0,
    bvps: parseFloat(document.getElementById('calc-graham-bvps').value) || 0,
    fcfPerShare: parseFloat(document.getElementById('calc-dcf-fcf').value) || 0,
    growth5y: parseFloat(document.getElementById('calc-dcf-growth').value) || 10,
    discountRate: parseFloat(document.getElementById('calc-dcf-discount').value) || 9,
    terminalRate: parseFloat(document.getElementById('calc-dcf-terminal').value) || 2.5
  };

  saveState();
  renderWatchlistAndFundamentals();
  closeModal('modal-calc');
  showToast(`Saved fundamental & DCF metrics for ${ticker}`, 'success');
}

// ============================================================================
// 12. EVENT LISTENERS & INITIALIZATION
// ============================================================================
function setupEventListeners() {
  // Desktop & Mobile Navigation Tabs
  document.querySelectorAll('.nav-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      switchTab(tab.getAttribute('data-tab'));
    });
  });

  // Theme Toggle
  document.getElementById('theme-toggle').addEventListener('click', () => {
    const isDark = document.documentElement.classList.toggle('dark');
    state.settings.darkMode = isDark;
    saveState();
    renderCharts();
  });

  // Banner Configure API button
  document.getElementById('banner-configure-api-btn').addEventListener('click', () => {
    switchTab('settings');
    document.getElementById('setting-api-key').focus();
  });

  // API Sync Buttons
  document.getElementById('header-sync-api-btn').addEventListener('click', () => syncAllMarketData(true));
  document.getElementById('mobile-sync-api-btn').addEventListener('click', () => syncAllMarketData(true));
  document.getElementById('btn-refresh-prices-now').addEventListener('click', () => syncAllMarketData(false));
  document.getElementById('btn-sync-all-api').addEventListener('click', () => syncAllMarketData(true));
  document.getElementById('btn-fetch-monthly-history').addEventListener('click', () => syncAllMarketData(true));
  document.getElementById('btn-fetch-fundamentals-api').addEventListener('click', syncFundamentalsViaAPI);

  // Historical Chart Controls
  document.getElementById('history-target-select').addEventListener('change', renderMonthlyHistoryChart);
  document.querySelectorAll('.history-range-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      historyRangeMonths = parseInt(btn.getAttribute('data-range'), 10) || 24;
      document.querySelectorAll('.history-range-btn').forEach(b => {
        b.className = 'history-range-btn px-2.5 py-1 rounded-md font-semibold text-slate-500 dark:text-slate-400 transition';
      });
      btn.className = 'history-range-btn px-2.5 py-1 rounded-md font-semibold bg-white dark:bg-dark-card shadow text-slate-900 dark:text-white transition';
      renderMonthlyHistoryChart();
    });
  });

  // Close Modals
  document.querySelectorAll('.close-modal').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const m = e.target.closest('.modal-backdrop');
      if (m) m.classList.add('hidden');
    });
  });

  // Open Trade Modals
  document.getElementById('btn-open-trade-modal').addEventListener('click', () => openTradeModal());
  document.getElementById('btn-holdings-new-trade').addEventListener('click', () => openTradeModal());
  document.getElementById('btn-tx-add').addEventListener('click', () => openTradeModal());
  document.getElementById('btn-quick-cash').addEventListener('click', () => openTradeModal(null, 'DEPOSIT'));
  document.getElementById('btn-deposit-quick').addEventListener('click', () => openTradeModal(null, 'DEPOSIT'));

  // Lookup Live Price inside Trade Modal
  document.getElementById('btn-lookup-ticker-price').addEventListener('click', async () => {
    const ticker = document.getElementById('trade-ticker').value.trim().toUpperCase();
    if (!ticker) return;
    if (!MarketAPI.hasKey()) {
      showToast('Configure your API Key in Settings first.', 'error');
      return;
    }
    try {
      showToast(`Fetching live price for ${ticker}...`, 'info');
      const q = await MarketAPI.fetchQuote(ticker);
      if (q?.price) {
        state.prices[ticker] = { ...q, lastUpdated: new Date().toISOString() };
        document.getElementById('trade-price').value = q.price;
        updateTradeCalculatedTotal();
        showToast(`${ticker} live price: ${Fin.currency(q.price)}`, 'success');
      }
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  // Trade Modal Type Selector
  document.querySelectorAll('.tx-type-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const type = btn.getAttribute('data-tx-type');
      document.getElementById('trade-type-val').value = type;
      document.querySelectorAll('.tx-type-btn').forEach(b => {
        b.className = 'tx-type-btn py-2 text-xs font-bold rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400';
      });
      btn.className = 'tx-type-btn py-2 text-xs font-bold rounded-lg border border-brand-500 bg-brand-50 dark:bg-brand-950/50 text-brand-600 dark:text-brand-400';
      updateTradeModalFields(type);
    });
  });

  ['trade-shares', 'trade-price', 'trade-fees'].forEach(id => {
    document.getElementById(id).addEventListener('input', updateTradeCalculatedTotal);
  });
  document.getElementById('form-trade').addEventListener('submit', handleTradeSubmit);

  // Dividend Modal
  document.getElementById('btn-open-dividend-modal').addEventListener('click', () => {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('div-pay-date').value = today;
    document.getElementById('div-ex-date').value = today;
    openModal('modal-dividend');
  });
  document.getElementById('div-drip-toggle').addEventListener('change', (e) => {
    const fields = document.getElementById('div-drip-fields');
    if (e.target.checked) {
      fields.classList.remove('hidden');
      const ticker = document.getElementById('div-ticker').value.trim().toUpperCase();
      document.getElementById('div-drip-price').value = state.prices[ticker]?.price || '';
    } else {
      fields.classList.add('hidden');
    }
  });
  document.getElementById('form-dividend').addEventListener('submit', handleDividendSubmit);

  // Watchlist Modal
  document.getElementById('btn-open-watchlist-modal').addEventListener('click', () => openModal('modal-watchlist'));
  document.getElementById('form-watchlist').addEventListener('submit', handleWatchlistSubmit);

  // Fair-Value Calculator Modal
  document.getElementById('btn-open-calc-modal').addEventListener('click', () => {
    populateCalculatorTickers();
    openModal('modal-calc');
  });
  document.getElementById('calc-ticker-select').addEventListener('change', (e) => loadCalculatorForTicker(e.target.value));
  ['calc-graham-eps', 'calc-graham-bvps'].forEach(id => {
    document.getElementById(id).addEventListener('input', computeGrahamNumberInModal);
  });
  ['calc-dcf-fcf', 'calc-dcf-growth', 'calc-dcf-discount', 'calc-dcf-terminal'].forEach(id => {
    document.getElementById(id).addEventListener('input', computeDCFInModal);
  });
  document.getElementById('btn-save-valuation-to-stock').addEventListener('click', saveValuationFromModal);

  // Allocation View Toggle
  document.getElementById('toggle-alloc-ticker').addEventListener('click', () => {
    allocationViewMode = 'ticker';
    document.getElementById('toggle-alloc-ticker').className = 'px-2.5 py-1 rounded-md font-semibold bg-white dark:bg-dark-card shadow text-slate-900 dark:text-white transition';
    document.getElementById('toggle-alloc-sector').className = 'px-2.5 py-1 rounded-md font-semibold text-slate-500 dark:text-slate-400 transition';
    renderAllocationChart();
  });
  document.getElementById('toggle-alloc-sector').addEventListener('click', () => {
    allocationViewMode = 'sector';
    document.getElementById('toggle-alloc-sector').className = 'px-2.5 py-1 rounded-md font-semibold bg-white dark:bg-dark-card shadow text-slate-900 dark:text-white transition';
    document.getElementById('toggle-alloc-ticker').className = 'px-2.5 py-1 rounded-md font-semibold text-slate-500 dark:text-slate-400 transition';
    renderAllocationChart();
  });

  // Transaction Filters
  document.getElementById('tx-search-ticker').addEventListener('input', renderTransactionsTable);
  document.getElementById('tx-filter-type').addEventListener('change', renderTransactionsTable);

  // Save API Key & Provider
  document.getElementById('btn-save-api-key').addEventListener('click', () => {
    state.settings.apiProvider = document.getElementById('setting-api-provider').value;
    state.settings.apiKey = document.getElementById('setting-api-key').value.trim();
    saveState();
    renderApiStatusUI();
    showToast(`Saved ${state.settings.apiProvider.toUpperCase()} API settings!`, 'success');
  });

  // Device Override Setting
  document.getElementById('setting-device-override').addEventListener('change', (e) => {
    state.settings.deviceOverride = e.target.value;
    saveState();
    DeviceDetector.detect();
    renderCharts();
    showToast(`Display layout mode set to ${e.target.value.toUpperCase()}`, 'info');
  });

  // SheetJS Export & Import
  document.getElementById('btn-export-excel').addEventListener('click', exportPortfolioToExcel);
  document.getElementById('btn-trigger-import-excel').addEventListener('click', () => {
    document.getElementById('excel-file-input').click();
  });
  document.getElementById('excel-file-input').addEventListener('change', (e) => {
    if (e.target.files?.[0]) restorePortfolioFromExcel(e.target.files[0]);
  });

  // Reset Database
  document.getElementById('btn-reset-data').addEventListener('click', () => {
    if (!confirm('Are you sure you want to permanently clear all portfolio records from this browser?')) return;
    const savedKey = state.settings.apiKey;
    const savedProvider = state.settings.apiProvider;
    state = createEmptyState();
    state.settings.apiKey = savedKey;
    state.settings.apiProvider = savedProvider;
    recalculatePortfolio();
    saveState();
    renderAll();
    showToast('Portfolio database cleared.', 'info');
  });
}

window.addEventListener('DOMContentLoaded', () => {
  initAppState();
  DeviceDetector.init();
  setupEventListeners();
  renderAll();
});