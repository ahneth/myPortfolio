/**
 * @file portfolio.js
 * @module PortfolioEngineAndExcelIO
 * @version 3.0.1
 * @build 20261031_1115
 * @description Application state persistence, startup ./historical_prices.json & ./company_news.json loaders,
 *   2018+ Dividend Ex-Date/Payout/Entitlement & Auto-Backfill Engine, 4-Pillar Technical & Qualitative Buy/Sell
 *   Signal Engine (0-100), 6-State Trend Regime & 12M Regression Analyzer, Nominal & Real (Inflation-Adjusted)
 *   XIRR Solver, Multi-Currency & GBp FX Normalizer, Configurable Quantitative Settings, and 8-Sheet SheetJS I/O.
 */

var STORAGE_KEY = 'MYPORTFOLIO_STATE_V1';

/**
 * Default customizable parameters exposed in the Settings Page for full manual customization.
 */
var DEFAULT_QUANT_SETTINGS = {
  currency: 'HKD',                // Base reporting currency ('HKD' | 'USD' | 'GBP')
  inflationRatePct: 2.2,          // Annual inflation rate (%) for Real XIRR (Fisher equation)
  riskFreeRatePct: 4.0,
  maxPositionWeightPct: 15.0,     // Max single-stock portfolio weight (%) before trim alert           // Risk-free rate (%) for Sharpe / Valuation comparison
  fxUsdHkd: 7.8453,               // USD -> HKD exchange rate
  fxGbpHkd: 10.4985,              // GBP -> HKD exchange rate (GBp pence auto-scaled by 0.01)
  fxGbpUsd: 1.3382,               // GBP -> USD exchange rate
  whtHkPct: 0.0,                  // HKEX (.HK) dividend withholding tax (%)
  whtUsPct: 30.0,                 // US (.US / NYSE / NASDAQ) dividend withholding tax (%)
  whtUkPct: 0.0,                  // London LSE (.L) dividend withholding tax (%)
  exDateAlertDays: 14,            // Days before Ex-Dividend date to highlight countdown alert
  autoDetectDividends: true,      // Auto-detect historical (2018+) & pending dividend entitlements
  rsiPeriod: 14,                  // Wilder RSI lookback period
  rsiOversold: 32,                // RSI oversold threshold (bullish trigger)
  rsiOverbought: 70,              // RSI overbought threshold (bearish/trim trigger)
  smaShortPeriod: 20,             // Short SMA period (days; or 2M on monthly fallback)
  smaMedPeriod: 50,               // Medium SMA period (days; or 3M on monthly fallback)
  smaLongPeriod: 200,             // Long SMA period (days; or 10M on monthly fallback)
  atrStopMultiplier: 2.0,         // ATR Stop-Loss distance multiplier (Price - k * ATR)
  signalStrongBuyMin: 78,         // Minimum score (0-100) for STRONG BUY badge
  signalBuyMin: 64,               // Minimum score (0-100) for ACCUMULATE badge
  signalHoldMin: 42,              // Minimum score (0-100) for HOLD badge
  weightMomentum: 30,             // Pillar 1 weight: Technical Momentum & Mean Reversion (%)
  weightTrend: 25,                // Pillar 2 weight: Trend & Moving Average Structure (%)
  weightValuation: 25,            // Pillar 3 weight: Valuation & Target Buy Margin (%)
  weightQuality: 20,              // Pillar 4 weight: Dividend Yield & Fundamental Quality (%)
  defaultDcfGrowthPct: 10.0,      // Default 5-Yr DCF growth rate (%)
  defaultDcfDiscountPct: 9.0,     // Default DCF discount rate / WACC (%)
  defaultDcfTerminalPct: 2.5,     // Default DCF terminal growth rate (%)
  benchmarkHk: '2800.HK',         // Primary HK benchmark ticker for 12M Alpha
  benchmarkUs: 'VOO',             // Primary US/Global benchmark ticker for 12M Alpha
  chartShowSma: true,             // Show SMA overlays on inline stock charts
  chartShowRegChannel: true,      // Show 12M linear regression channel on inline stock charts
  githubRepoSlug: '',             // Optional GitHub 'owner/repo' for 1-click workflow dispatch
  githubPat: ''                   // Optional GitHub PAT stored strictly in browser localStorage
};

/**
 * Verified 2018-2026 historical dividend ex-dates & per-share payouts for HKEX & US tickers.
 * Ensures portfolios starting in 2018 can immediately reconcile historical dividend entitlements
 * even offline, while merging seamlessly with live Yahoo Finance v8 events=div updates.
 */
var BASELINE_DIVIDEND_HISTORY_2018_2026 = {
  '2800.HK': [
    ['2018-05-02', 0.23], ['2018-10-31', 0.67],
    ['2019-05-02', 0.24], ['2019-10-31', 0.67],
    ['2020-05-04', 0.14], ['2020-10-30', 0.64],
    ['2021-05-03', 0.17], ['2021-10-29', 0.59],
    ['2022-05-03', 0.18], ['2022-10-31', 0.56],
    ['2023-05-02', 0.19], ['2023-10-31', 0.57],
    ['2024-05-02', 0.22], ['2024-10-31', 0.55],
    ['2025-05-02', 0.23], ['2025-10-30', 0.54],
    ['2026-05-04', 0.24], ['2026-10-29', 0.53]
  ],
  '0002.HK': [
    ['2024-03-05', 1.21], ['2024-06-04', 0.63], ['2024-09-03', 0.63], ['2024-12-03', 0.63],
    ['2025-03-04', 1.26], ['2025-06-03', 0.63], ['2025-09-02', 0.63], ['2025-12-02', 0.63],
    ['2026-03-03', 1.26], ['2026-06-02', 0.63], ['2026-09-01', 0.63]
  ],
  '0003.HK': [
    ['2024-06-06', 0.23], ['2024-09-05', 0.12],
    ['2025-06-05', 0.23], ['2025-09-04', 0.12],
    ['2026-06-04', 0.23], ['2026-09-03', 0.12]
  ],
  '0005.HK': [
    ['2024-05-09', 2.42], ['2024-08-08', 0.78], ['2024-11-07', 0.78],
    ['2025-03-06', 2.80], ['2025-05-08', 0.78], ['2025-08-07', 0.78], ['2025-11-06', 0.78],
    ['2026-03-05', 2.88], ['2026-05-07', 0.78], ['2026-08-06', 0.78]
  ],
  '0006.HK': [
    ['2025-05-28', 2.04], ['2025-09-03', 0.78],
    ['2026-05-27', 2.04], ['2026-09-02', 0.78]
  ],
  '0012.HK': [
    ['2025-06-05', 1.30], ['2025-09-09', 0.50],
    ['2026-06-04', 1.30], ['2026-09-08', 0.50]
  ],
  '0066.HK': [
    ['2025-05-22', 0.89], ['2025-09-04', 0.42],
    ['2026-05-21', 0.89], ['2026-09-03', 0.42]
  ],
  '0101.HK': [
    ['2025-05-08', 0.40], ['2025-09-04', 0.12],
    ['2026-05-07', 0.40], ['2026-09-03', 0.12]
  ],
  '0386.HK': [
    ['2025-06-11', 0.153], ['2025-09-10', 0.160],
    ['2026-06-10', 0.155], ['2026-09-09', 0.158]
  ],
  '0700.HK': [
    ['2024-05-16', 3.40], ['2025-05-15', 4.00], ['2026-05-14', 4.50]
  ],
  '0857.HK': [
    ['2025-06-17', 0.268], ['2025-09-16', 0.240],
    ['2026-06-16', 0.275], ['2026-09-15', 0.245]
  ],
  '0939.HK': [
    ['2025-07-10', 0.215], ['2026-01-15', 0.214], ['2026-07-09', 0.220]
  ],
  '1088.HK': [
    ['2025-06-25', 2.46], ['2026-06-24', 2.48]
  ],
  '1093.HK': [
    ['2025-06-12', 0.16], ['2025-09-18', 0.16],
    ['2026-06-11', 0.16], ['2026-09-17', 0.16]
  ],
  '1288.HK': [
    ['2025-07-08', 0.128], ['2026-01-12', 0.125], ['2026-07-07', 0.132]
  ],
  '1299.HK': [
    ['2025-05-29', 1.305], ['2025-09-08', 0.445],
    ['2026-05-28', 1.350], ['2026-09-07', 0.460]
  ],
  '1378.HK': [
    ['2025-06-05', 0.59], ['2025-09-12', 0.59],
    ['2026-06-04', 0.62], ['2026-09-11', 0.60]
  ],
  '1398.HK': [
    ['2025-07-11', 0.178], ['2026-01-16', 0.158], ['2026-07-10', 0.182]
  ],
  '2318.HK': [
    ['2025-06-10', 1.62], ['2025-09-19', 1.02],
    ['2026-06-09', 1.68], ['2026-09-18', 1.05]
  ],
  '2388.HK': [
    ['2025-05-20', 1.419], ['2025-09-11', 0.57],
    ['2026-05-19', 1.450], ['2026-09-10', 0.58]
  ],
  '3077.HK': [
    ['2026-01-05', 10.50], ['2026-04-06', 10.40], ['2026-07-06', 10.35], ['2026-10-05', 10.30]
  ],
  '3433.HK': [
    ['2025-12-18', 0.42]
  ],
  'VOO': [
    ['2018-03-26', 1.093], ['2018-06-28', 1.157], ['2018-09-26', 1.206], ['2018-12-18', 1.289],
    ['2019-03-22', 1.455], ['2019-06-27', 1.386], ['2019-09-26', 1.301], ['2019-12-23', 1.429],
    ['2020-03-10', 1.178], ['2020-06-29', 1.433], ['2020-09-28', 1.308], ['2020-12-22', 1.383],
    ['2021-03-26', 1.263], ['2021-06-28', 1.333], ['2021-09-27', 1.308], ['2021-12-21', 1.496],
    ['2022-03-24', 1.374], ['2022-06-28', 1.432], ['2022-09-27', 1.468], ['2022-12-20', 1.672],
    ['2023-03-24', 1.487], ['2023-06-29', 1.576], ['2023-09-27', 1.493], ['2023-12-20', 1.812],
    ['2024-03-22', 1.543], ['2024-06-28', 1.783], ['2024-09-27', 1.638], ['2024-12-20', 1.739],
    ['2025-03-27', 1.682], ['2025-06-27', 1.795], ['2025-09-26', 1.710], ['2025-12-22', 1.815],
    ['2026-03-26', 1.745], ['2026-06-26', 1.840], ['2026-09-25', 1.790]
  ]
};

function createEmptyState() {
  return {
    settings: {
      ...DEFAULT_QUANT_SETTINGS,
      apiProvider: 'yahoo',
      apiKey: '',
      deviceOverride: 'auto',
      darkMode: true,
      lastApiSync: null,
      yahooDefaultApplied: true,
      appVersion: '3.0.1',
      buildId: '20261031_1115',
      collapsedSectors: {}
    },
    cashBalance: 0,
    initialCash: 0,
    transactions: [],
    prices: {},
    historicalPrices: {},
    dividends: [],
    dividendSchedules: {},
    technicals: {},
    companyNews: [],
    watchlist: [],
    fundamentals: {}
  };
}

var state = null;
var portfolio = null;
var allocationViewMode = 'ticker';
var historyRangeMonths = 24;
var portfolioHistoryMode = 'balance';

var selectedHoldingsTicker = null;
var holdingsStockRangeMonths = 24;

var selectedWatchlistTicker = null;
var watchlistStockRangeMonths = 24;

var charts = {
  monthlyHistory: null,
  holdingsStockHistory: null,
  watchlistStockHistory: null,
  allocation: null,
  dividends: null,
  pnlBreakdown: null
};

function isLegacySyntheticHistory(series) {
  if (!Array.isArray(series) || series.length === 0) return true;
  if (series.length >= 6) {
    const vols = series.map(r => Number(r?.volume || 0)).filter(v => v > 0);
    if (vols.length >= 6 && new Set(vols).size === 1) {
      return true;
    }
    const day25Count = series.filter(r => String(r?.date || '').endsWith('-25')).length;
    if (day25Count >= Math.ceil(series.length * 0.85)) {
      return true;
    }
  }
  return false;
}

function compareHoldingsBySectorAndTicker(a, b) {
  const secA = String(a?.sector || 'Equities').trim();
  const secB = String(b?.sector || 'Equities').trim();
  const isEtfA = MarketAPI.isEtfSector(secA, a?.ticker, a?.companyName);
  const isEtfB = MarketAPI.isEtfSector(secB, b?.ticker, b?.companyName);

  if (isEtfA !== isEtfB) {
    return isEtfA ? -1 : 1;
  }
  const secCmp = secA.localeCompare(secB, undefined, { sensitivity: 'base' });
  if (secCmp !== 0) return secCmp;

  return String(a?.ticker || '').localeCompare(String(b?.ticker || ''), undefined, { sensitivity: 'base' });
}

/**
 * Builds or updates a ticker's complete dividend schedule (2018-present history + cadence + yields + next Ex-Date)
 */
function buildDividendScheduleForTicker(rawTicker, rawEventsMap = null, fallbackPrice = 0, fallbackCurrency = null) {
  const sym = MarketAPI.normalizeTicker(rawTicker);
  if (!sym) return null;
  const staticMeta = MarketAPI.getStaticProfile(sym);
  const currency = fallbackCurrency || state?.prices?.[sym]?.currency || state?.fundamentals?.[sym]?.currency || staticMeta.currency || 'HKD';
  const currentPrice = Number(fallbackPrice || state?.prices?.[sym]?.price || 0);
  const payLagDays = sym.endsWith('.HK') ? 25 : (sym.endsWith('.L') ? 28 : 5);

  const byExDate = {};

  // 1. Seed from verified 2018-2026 baseline history
  const baseList = BASELINE_DIVIDEND_HISTORY_2018_2026[sym] || [];
  baseList.forEach(([exStr, amt]) => {
    const exMs = new Date(exStr + 'T00:00:00Z').getTime();
    const payStr = new Date(exMs + payLagDays * 86400 * 1000).toISOString().split('T')[0];
    byExDate[exStr] = {
      exDate: exStr,
      payDate: payStr,
      payDateEstimated: true,
      amount: Fin.round(Number(amt), 4),
      currency
    };
  });

  // 2. Merge any existing schedule history
  const existingHist = state?.dividendSchedules?.[sym]?.history;
  if (Array.isArray(existingHist)) {
    existingHist.forEach(h => {
      if (h && h.exDate && Number(h.amount) > 0) {
        byExDate[h.exDate] = {
          exDate: h.exDate,
          payDate: h.payDate || h.exDate,
          payDateEstimated: h.payDateEstimated !== false,
          amount: Fin.round(Number(h.amount), 4),
          currency: h.currency || currency
        };
      }
    });
  }

  // 3. Merge live Yahoo v8 events.dividends map if passed
  if (rawEventsMap && typeof rawEventsMap === 'object') {
    Object.values(rawEventsMap).forEach(ev => {
      const ts = Number(ev?.date || 0);
      const amt = Number(ev?.amount || 0);
      if (ts > 0 && amt > 0) {
        const exStr = new Date(ts * 1000).toISOString().split('T')[0];
        const payStr = new Date((ts + payLagDays * 86400) * 1000).toISOString().split('T')[0];
        byExDate[exStr] = {
          exDate: exStr,
          payDate: payStr,
          payDateEstimated: true,
          amount: Fin.round(amt, 4),
          currency
        };
      }
    });
  }

  const history = Object.values(byExDate).sort((a, b) => a.exDate.localeCompare(b.exDate));
  const nowMs = Date.now();
  const todayStr = new Date(nowMs).toISOString().split('T')[0];
  const cutoffTtmStr = new Date(nowMs - 370 * 86400 * 1000).toISOString().split('T')[0];
  const cutoff3yStr = new Date(nowMs - (365 * 3 + 20) * 86400 * 1000).toISOString().split('T')[0];

  const events3y = history.filter(h => h.exDate >= cutoff3yStr);
  const avgEventsPerYear = events3y.length / 3.0;

  let frequency = 'None';
  let paymentsPerYear = 0;
  if (avgEventsPerYear >= 10) {
    frequency = 'Monthly';
    paymentsPerYear = 12;
  } else if (avgEventsPerYear >= 3.2) {
    frequency = 'Quarterly';
    paymentsPerYear = 4;
  } else if (avgEventsPerYear >= 1.4) {
    frequency = 'Semi-Annual';
    paymentsPerYear = 2;
  } else if (history.length > 0) {
    frequency = 'Annual';
    paymentsPerYear = 1;
  }

  let ttmEvents = history.filter(h => h.exDate >= cutoffTtmStr && h.exDate <= todayStr);
  if (paymentsPerYear > 0 && ttmEvents.length > paymentsPerYear) {
    ttmEvents = ttmEvents.slice(-paymentsPerYear);
  }
  const ttmDiv = Fin.round(ttmEvents.reduce((s, h) => s + Number(h.amount || 0), 0), 4);

  let fwdDiv = 0;
  if (history.length > 0 && paymentsPerYear > 0) {
    const recentN = history.slice(-paymentsPerYear);
    fwdDiv = Fin.round(recentN.reduce((s, h) => s + Number(h.amount || 0), 0), 4);
  }

  const effPrice = (currency === 'GBp' || currency === 'GBX') && fwdDiv < 20 ? currentPrice * 0.01 : currentPrice;
  const fallbackYield = Number(state?.fundamentals?.[sym]?.divYield || 0);
  const trailingYieldPct = (ttmDiv > 0 && effPrice > 0) ? Fin.round((ttmDiv / effPrice) * 100, 2) : fallbackYield;
  const forwardYieldPct = (fwdDiv > 0 && effPrice > 0) ? Fin.round((fwdDiv / effPrice) * 100, 2) : trailingYieldPct;

  const cfg = state?.settings || DEFAULT_QUANT_SETTINGS;
  let whtPct = Number(cfg.whtUsPct ?? 30.0);
  if (sym.endsWith('.HK')) whtPct = Number(cfg.whtHkPct ?? 0.0);
  else if (sym.endsWith('.L')) whtPct = Number(cfg.whtUkPct ?? 0.0);

  const netYieldPct = Fin.round(trailingYieldPct * (1 - whtPct / 100), 2);

  // 3Y Dividend CAGR
  const byYear = {};
  history.forEach(h => {
    const yr = parseInt(h.exDate.slice(0, 4), 10);
    byYear[yr] = (byYear[yr] || 0) + Number(h.amount || 0);
  });
  let divCagr3Y = null;
  const refYr = new Date().getFullYear() - 1;
  if (byYear[refYr - 3] > 0 && byYear[refYr] > 0) {
    divCagr3Y = Fin.round((Math.pow(byYear[refYr] / byYear[refYr - 3], 1 / 3) - 1) * 100, 2);
  }

  // Next Ex-Date Resolution (Confirmed or Seasonal Projection)
  let nextExDate = state?.dividendSchedules?.[sym]?.nextExDate || null;
  let nextPayDate = state?.dividendSchedules?.[sym]?.nextPayDate || null;
  let nextEstAmount = state?.dividendSchedules?.[sym]?.nextEstAmount || null;
  let nextStatus = state?.dividendSchedules?.[sym]?.nextStatus || 'NONE';

  if (!nextExDate || nextExDate < todayStr) {
    if (history.length > 0 && paymentsPerYear > 0) {
      const oneYearAgoStr = new Date(nowMs - 365 * 86400 * 1000).toISOString().split('T')[0];
      const candidates = history.filter(h => h.exDate > oneYearAgoStr);
      const tpl = candidates.length > 0 ? candidates[0] : history[history.length - 1];
      const tplDate = new Date(tpl.exDate + 'T00:00:00Z');
      let projDate = new Date(tplDate.getTime() + 365 * 86400 * 1000);
      if (projDate.toISOString().split('T')[0] <= todayStr) {
        const lastEvDate = new Date(history[history.length - 1].exDate + 'T00:00:00Z');
        projDate = new Date(lastEvDate.getTime() + Math.round(365 / Math.max(1, paymentsPerYear)) * 86400 * 1000);
      }
      nextExDate = projDate.toISOString().split('T')[0];
      nextPayDate = new Date(projDate.getTime() + payLagDays * 86400 * 1000).toISOString().split('T')[0];
      nextEstAmount = tpl.amount;
      nextStatus = 'PROJECTED_SEASONAL';
    }
  }

  let daysToExDate = null;
  if (nextExDate) {
    const diffMs = new Date(nextExDate + 'T00:00:00Z').getTime() - new Date(todayStr + 'T00:00:00Z').getTime();
    daysToExDate = Math.round(diffMs / (86400 * 1000));
  }

  return {
    currency,
    frequency,
    paymentsPerYear,
    ttmDivPerShare: ttmDiv,
    forwardDivPerShare: fwdDiv,
    trailingYieldPct,
    forwardYieldPct,
    withholdingTaxPct: whtPct,
    netYieldPct,
    divCagr3Y,
    nextExDate,
    nextPayDate,
    nextEstAmount,
    nextStatus,
    daysToExDate,
    history
  };
}
window.buildDividendScheduleForTicker = buildDividendScheduleForTicker;

/**
 * Loads ./historical_prices.json on startup and merges prices, quotes, fundamentals, FX rates,
 * 2018+ dividend histories, and daily technical indicators into state.
 */
function ingestHistoricalPricesData(data) {
  if (!data || typeof data !== 'object') return 0;
  window.EXTERNAL_HISTORICAL_PRICES = data;
  let loadedSeriesCount = 0;

  if (data.fxRates && typeof data.fxRates === 'object') {
    if (Number(data.fxRates.USDHKD) > 0 && !state.settings._userCustomFx) {
      state.settings.fxUsdHkd = Fin.round(Number(data.fxRates.USDHKD), 4);
    }
    if (Number(data.fxRates.GBPUSD) > 0 && !state.settings._userCustomFx) {
      state.settings.fxGbpUsd = Fin.round(Number(data.fxRates.GBPUSD), 4);
    }
    if (Number(data.fxRates.GBPHKD) > 0 && !state.settings._userCustomFx) {
      state.settings.fxGbpHkd = Fin.round(Number(data.fxRates.GBPHKD), 4);
    }
  }

  const ingestHistorySeries = (rawSym, rawList) => {
    const sym = MarketAPI.normalizeTicker(rawSym);
    if (!sym || !Array.isArray(rawList) || rawList.length === 0) return;
    if (isLegacySyntheticHistory(rawList)) return;

    const cleaned = rawList
      .filter(r => r && r.month && Number(r.close) > 0)
      .map(r => ({
        month: String(r.month).slice(0, 7),
        date: r.date || `${String(r.month).slice(0, 7)}-01`,
        close: Fin.round(Number(r.close), 4),
        rawClose: Fin.round(Number(r.rawClose ?? r.close), 4),
        high: Fin.round(Number(r.high ?? r.close), 4),
        low: Fin.round(Number(r.low ?? r.close), 4),
        volume: parseInt(r.volume || 0, 10)
      }))
      .sort((a, b) => a.month.localeCompare(b.month));

    if (cleaned.length > 0) {
      state.historicalPrices[sym] = cleaned;
      loadedSeriesCount++;
    }
  };

  [data.prices, data.historicalPrices, data.history]
    .filter(m => m && typeof m === 'object' && !Array.isArray(m))
    .forEach(mapObj => {
      Object.entries(mapObj).forEach(([k, v]) => ingestHistorySeries(k, v));
    });

  if (data.quotes && typeof data.quotes === 'object') {
    Object.entries(data.quotes).forEach(([k, q]) => {
      const sym = MarketAPI.normalizeTicker(k);
      if (sym && q && Number(q.price) > 0) {
        state.prices[sym] = {
          ...(state.prices[sym] || {}),
          ...q,
          lastUpdated: q.lastUpdated || data._meta?.generatedAt || new Date().toISOString()
        };
      }
    });
  }

  if (data.fundamentals && typeof data.fundamentals === 'object') {
    Object.entries(data.fundamentals).forEach(([k, f]) => {
      const sym = MarketAPI.normalizeTicker(k);
      if (sym && f && typeof f === 'object') {
        state.fundamentals[sym] = { ...(state.fundamentals[sym] || {}), ...f };
      }
    });
  }

  if (data.dividends && typeof data.dividends === 'object') {
    if (!state.dividendSchedules) state.dividendSchedules = {};
    Object.entries(data.dividends).forEach(([k, dObj]) => {
      const sym = MarketAPI.normalizeTicker(k);
      if (sym && dObj && typeof dObj === 'object') {
        state.dividendSchedules[sym] = { ...(state.dividendSchedules[sym] || {}), ...dObj };
      }
    });
  }

  if (data.technicals && typeof data.technicals === 'object') {
    if (!state.technicals) state.technicals = {};
    Object.entries(data.technicals).forEach(([k, tObj]) => {
      const sym = MarketAPI.normalizeTicker(k);
      if (sym && tObj && typeof tObj === 'object') {
        state.technicals[sym] = { ...(state.technicals[sym] || {}), ...tObj };
      }
    });
  }

  return loadedSeriesCount;
}

function normalizeNewsArticleSchema(art) {
  if (!art || typeof art !== 'object') return null;
  const ticker = MarketAPI.normalizeTicker(art.ticker || '');
  const staticProf = MarketAPI.getStaticProfile(ticker);
  const rawCat = String(art.catalyst || 'CORPORATE').toUpperCase();
  let canonicalCat = 'CORPORATE';
  if (rawCat.includes('DIVIDEND') || rawCat.includes('CAPITAL') || rawCat.includes('YIELD')) canonicalCat = 'DIVIDEND';
  else if (rawCat.includes('BUYBACK') || rawCat.includes('REPURCHASE')) canonicalCat = 'BUYBACK';
  else if (rawCat.includes('EARNING') || rawCat.includes('GUIDANCE') || rawCat.includes('PROFIT')) canonicalCat = 'EARNINGS';
  else if (rawCat.includes('ANALYST') || rawCat.includes('VALUATION') || rawCat.includes('RATING')) canonicalCat = 'ANALYST';
  else if (rawCat.includes('MACRO') || rawCat.includes('ETF') || rawCat.includes('REGULAT')) canonicalCat = 'MACRO / ETF';
  else if (['DIVIDEND', 'BUYBACK', 'EARNINGS', 'ANALYST', 'MACRO / ETF', 'CORPORATE'].includes(rawCat)) canonicalCat = rawCat;

  const rawSent = String(art.sentimentLabel || art.sentiment || '').toUpperCase();
  const score = Number(art.sentimentScore ?? 0);
  let sentimentLabel = 'NEUTRAL';
  if (rawSent.includes('BULL') || score >= 0.18) sentimentLabel = 'BULLISH';
  else if (rawSent.includes('BEAR') || score <= -0.18) sentimentLabel = 'BEARISH';

  return {
    ...art,
    ticker,
    companyName: art.companyName || art.entityName || staticProf.name || ticker,
    entityName: art.entityName || art.companyName || staticProf.name || ticker,
    catalyst: canonicalCat,
    sentimentLabel,
    sentiment: sentimentLabel.charAt(0) + sentimentLabel.slice(1).toLowerCase(),
    sentimentScore: Fin.round(score, 2)
  };
}

function ingestCompanyNewsData(data) {
  if (!data || !Array.isArray(data.articles)) return 0;
  if (!Array.isArray(state.companyNews)) state.companyNews = [];
  const existingUrls = new Set(state.companyNews.map(a => a?.url).filter(Boolean));
  let added = 0;
  data.articles.forEach(rawArt => {
    const art = normalizeNewsArticleSchema(rawArt);
    if (art && art.url && !existingUrls.has(art.url)) {
      existingUrls.add(art.url);
      state.companyNews.push(art);
      added++;
    }
  });
  state.companyNews = state.companyNews.map(a => normalizeNewsArticleSchema(a)).filter(Boolean);
  state.companyNews.sort((a, b) => String(b.publishedAt || '').localeCompare(String(a.publishedAt || '')));
  return added;
}

async function loadHistoricalPricesFromJson(silent = true) {
  try {
    let data = null;
    try {
      const res = await fetch(`./historical_prices.json?_=${Date.now()}`, { cache: 'no-store' });
      if (res.ok) {
        data = await res.json();
      }
    } catch (_) {}

    if ((!data || typeof data !== 'object') && typeof window.EMBEDDED_HISTORICAL_PRICES === 'object') {
      data = window.EMBEDDED_HISTORICAL_PRICES;
    }

    if (!data || typeof data !== 'object') {
      window.__HISTORICAL_PRICES_JSON_LOADED__ = false;
      return false;
    }

    const loadedSeriesCount = ingestHistoricalPricesData(data);
    window.__HISTORICAL_PRICES_JSON_LOADED__ = true;
    recalculatePortfolio();
    saveState();
    if (typeof renderAll === 'function') {
      renderAll();
    }
    return loadedSeriesCount > 0;
  } catch (err) {
    window.__HISTORICAL_PRICES_JSON_LOADED__ = false;
    return false;
  }
}

async function loadCompanyNewsFromJson() {
  try {
    let data = null;
    try {
      const res = await fetch(`./company_news.json?_=${Date.now()}`, { cache: 'no-store' });
      if (res.ok) {
        data = await res.json();
      }
    } catch (_) {}

    if ((!data || !Array.isArray(data.articles)) && typeof window.EMBEDDED_COMPANY_NEWS === 'object') {
      data = window.EMBEDDED_COMPANY_NEWS;
    }

    if (data && Array.isArray(data.articles) && data.articles.length > 0) {
      ingestCompanyNewsData(data);
      if (typeof renderNewsTab === 'function') renderNewsTab();
      return true;
    }
  } catch (_) {}
  return false;
}

function initAppState() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      state = JSON.parse(stored);
    } else {
      state = createEmptyState();
    }
  } catch (e) {
    console.error('Failed to parse localStorage state, initializing clean state:', e);
    state = createEmptyState();
  }

  state.settings = {
    ...DEFAULT_QUANT_SETTINGS,
    ...(state.settings || {})
  };
  if (!state.settings.collapsedSectors) state.settings.collapsedSectors = {};
  if (!state.prices) state.prices = {};
  if (!state.historicalPrices) state.historicalPrices = {};
  if (!state.fundamentals) state.fundamentals = {};
  if (!state.dividendSchedules) state.dividendSchedules = {};
  if (!state.technicals) state.technicals = {};
  if (!Array.isArray(state.companyNews)) state.companyNews = [];
  if (!state.transactions) state.transactions = [];
  if (!state.dividends) state.dividends = [];
  if (!state.watchlist) state.watchlist = [];

  if (!state.settings.yahooDefaultApplied) {
    state.settings.apiProvider = 'yahoo';
    state.settings.yahooDefaultApplied = true;
  }

  state.transactions.forEach(tx => {
    if (tx.ticker && tx.type !== 'DEPOSIT' && tx.type !== 'WITHDRAW') {
      tx.ticker = MarketAPI.normalizeTicker(tx.ticker);
    }
  });
  state.dividends.forEach(div => {
    if (div.ticker) div.ticker = MarketAPI.normalizeTicker(div.ticker);
  });
  state.watchlist.forEach(w => {
    if (w.ticker) w.ticker = MarketAPI.normalizeTicker(w.ticker);
  });

  ['prices', 'historicalPrices', 'fundamentals', 'dividendSchedules', 'technicals'].forEach(mapKey => {
    const mapObj = state[mapKey] || {};
    const normalizedMap = {};
    Object.keys(mapObj).forEach(k => {
      const normKey = MarketAPI.normalizeTicker(k);
      normalizedMap[normKey] = mapObj[k];
    });
    state[mapKey] = normalizedMap;
  });

  Object.keys(state.historicalPrices).forEach(sym => {
    if (isLegacySyntheticHistory(state.historicalPrices[sym])) {
      delete state.historicalPrices[sym];
    }
  });

  // Ensure baseline 2018-2026 dividend schedules are initialized for all active/watched/known tickers
  const allKnownTickers = Array.from(new Set([
    ...Object.keys(BASELINE_DIVIDEND_HISTORY_2018_2026),
    ...state.transactions.map(t => t.ticker).filter(Boolean),
    ...state.watchlist.map(w => w.ticker).filter(Boolean)
  ]));
  allKnownTickers.forEach(sym => {
    const staticProfile = MarketAPI.getStaticProfile(sym);
    const existingFund = state.fundamentals[sym] || {};
    state.fundamentals[sym] = {
      ...existingFund,
      name: (existingFund.name && existingFund.name !== sym) ? existingFund.name : staticProfile.name,
      sector: (existingFund.sector && existingFund.sector !== 'Equities') ? existingFund.sector : staticProfile.sector,
      currency: existingFund.currency || staticProfile.currency
    };
    const sched = buildDividendScheduleForTicker(sym);
    if (sched) {
      state.dividendSchedules[sym] = sched;
    }
  });

  state.settings.appVersion = (typeof APP_VERSION_MANIFEST !== 'undefined') ? APP_VERSION_MANIFEST.appVersion : '3.0.0';
  state.settings.buildId = (typeof APP_VERSION_MANIFEST !== 'undefined') ? APP_VERSION_MANIFEST.buildId : '20261030_2330';

  if (state.settings.darkMode === false) {
    document.documentElement.classList.remove('dark');
  } else {
    document.documentElement.classList.add('dark');
  }

  if (typeof window.EMBEDDED_HISTORICAL_PRICES === 'object' && Object.keys(state.historicalPrices || {}).length === 0) {
    ingestHistoricalPricesData(window.EMBEDDED_HISTORICAL_PRICES);
  }
  if (typeof window.EMBEDDED_COMPANY_NEWS === 'object') {
    ingestCompanyNewsData(window.EMBEDDED_COMPANY_NEWS);
  }

  recalculatePortfolio();
  saveState();

  loadHistoricalPricesFromJson(true);
  loadCompanyNewsFromJson();
}

function saveState() {
  if (!state) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.warn('Could not save state to localStorage:', e);
  }
}

/**
 * Computes 52-week range, MoM/QoQ/YoY, Technical Indicators (SMA, RSI, MACD, Bollinger, ATR),
 * 6-State Trend Regime, 12M Log-Linear Regression (Slope & R^2), Benchmark Alpha,
 * Dividend Schedule Metrics, and 4-Pillar Composite Buy/Sell Signal Score (0-100) using
 * the user's customizable parameters in state.settings.
 */
function computeStockPriceMetrics(rawTicker, fallbackCurrentPrice = 0) {
  const ticker = MarketAPI.normalizeTicker(rawTicker);
  const cfg = state?.settings || DEFAULT_QUANT_SETTINGS;
  const priceObj = state?.prices?.[ticker] || {};
  const fundObj = state?.fundamentals?.[ticker] || {};
  const rawHist = state?.historicalPrices?.[ticker];
  const hist = Array.isArray(rawHist) ? rawHist : [];
  const preTech = state?.technicals?.[ticker] || {};

  const getBarRawPrice = (bar) => {
    if (!bar) return 0;
    const p = Number(bar.rawClose ?? bar.close ?? 0);
    return (!isNaN(p) && p > 0) ? p : 0;
  };

  const latestBar = hist.length > 0 ? hist[hist.length - 1] : null;
  const currentPrice = Number(priceObj.price || fallbackCurrentPrice || getBarRawPrice(latestBar) || 0);

  let low52w = Number(priceObj.low52w || fundObj.low52w || 0);
  let high52w = Number(priceObj.high52w || fundObj.high52w || 0);

  if (hist.length > 0) {
    const trailing12 = hist.slice(-12);
    const lows = trailing12.map(r => Number(r.low ?? r.rawClose ?? r.close ?? 0)).filter(v => !isNaN(v) && v > 0);
    const highs = trailing12.map(r => Number(r.high ?? r.rawClose ?? r.close ?? 0)).filter(v => !isNaN(v) && v > 0);
    if ((!low52w || low52w <= 0) && lows.length > 0) low52w = Math.min(...lows);
    if ((!high52w || high52w <= 0) && highs.length > 0) high52w = Math.max(...highs);
  }

  if (low52w > 0 && currentPrice > 0 && currentPrice < low52w) low52w = currentPrice;
  if (high52w > 0 && currentPrice > 0 && currentPrice > high52w) high52w = currentPrice;

  low52w = low52w > 0 ? Fin.round(low52w, 4) : null;
  high52w = high52w > 0 ? Fin.round(high52w, 4) : null;

  let pos52wPct = null;
  if (low52w !== null && high52w !== null && currentPrice > 0) {
    if (high52w > low52w) {
      pos52wPct = Fin.round(Math.max(0, Math.min(100, ((currentPrice - low52w) / (high52w - low52w)) * 100)), 1);
    } else if (high52w === low52w) {
      pos52wPct = 50.0;
    }
  }

  let momPct = null;
  let qoqPct = null;
  let yoyPct = null;
  let momRefMonth = null;
  let qoqRefMonth = null;
  let yoyRefMonth = null;

  const n = hist.length;
  const refCurrent = currentPrice > 0 ? currentPrice : getBarRawPrice(latestBar);

  if (n >= 2 && refCurrent > 0) {
    const momBar = hist[n - 2];
    const momBase = getBarRawPrice(momBar);
    if (momBase > 0) {
      momPct = Fin.round(((refCurrent - momBase) / momBase) * 100, 2);
      momRefMonth = momBar.month;
    }
  } else if (fundObj.momPct !== undefined && fundObj.momPct !== null && !isNaN(Number(fundObj.momPct))) {
    momPct = Fin.round(Number(fundObj.momPct), 2);
  }

  if (n >= 4 && refCurrent > 0) {
    const qoqBar = hist[n - 4];
    const qoqBase = getBarRawPrice(qoqBar);
    if (qoqBase > 0) {
      qoqPct = Fin.round(((refCurrent - qoqBase) / qoqBase) * 100, 2);
      qoqRefMonth = qoqBar.month;
    }
  } else if (fundObj.qoqPct !== undefined && fundObj.qoqPct !== null && !isNaN(Number(fundObj.qoqPct))) {
    qoqPct = Fin.round(Number(fundObj.qoqPct), 2);
  }

  if (n >= 12 && refCurrent > 0) {
    const yoyBar = n >= 13 ? hist[n - 13] : hist[0];
    const yoyBase = getBarRawPrice(yoyBar);
    if (yoyBase > 0) {
      yoyPct = Fin.round(((refCurrent - yoyBase) / yoyBase) * 100, 2);
      yoyRefMonth = yoyBar.month;
    }
  } else if (fundObj.yoyPct !== undefined && fundObj.yoyPct !== null && !isNaN(Number(fundObj.yoyPct))) {
    yoyPct = Fin.round(Number(fundObj.yoyPct), 2);
  }

  // Dividend Schedule & Yield Metrics
  const divInfo = buildDividendScheduleForTicker(ticker, null, refCurrent);

  // Technicals & Trend Regimes (from precomputed daily technicals in historical_prices.json OR computed from monthly series)
  let sma20 = preTech.sma20 || null;
  let sma50 = preTech.sma50 || null;
  let sma200 = preTech.sma200 || null;
  let rsi14 = preTech.rsi14 ?? null;
  let atr14 = preTech.atr14 || (refCurrent > 0 ? Fin.round(refCurrent * 0.022, 4) : 0);
  let macdHist = preTech.macd?.histogram ?? 0;
  let bbPctB = preTech.bollinger?.pctB ?? (pos52wPct !== null ? Fin.round(pos52wPct / 100, 2) : 0.5);
  let regTrendAnnualPct = preTech.regTrendAnnualPct ?? yoyPct ?? 0;
  let regR2 = preTech.regR2 ?? null;

  if (hist.length >= 3) {
    const closes = hist.map(b => getBarRawPrice(b)).filter(v => v > 0);
    if (!sma20 && closes.length >= 2) sma20 = Fin.round(closes.slice(-2).reduce((a, b) => a + b, 0) / 2, 4);
    if (!sma50 && closes.length >= 4) sma50 = Fin.round(closes.slice(-4).reduce((a, b) => a + b, 0) / 4, 4);
    if (!sma200 && closes.length >= 10) sma200 = Fin.round(closes.slice(-10).reduce((a, b) => a + b, 0) / Math.min(10, closes.length), 4);

    if (rsi14 === null && closes.length >= 5) {
      let gains = 0;
      let losses = 0;
      const win = closes.slice(-Math.min(14, closes.length));
      for (let i = 1; i < win.length; i++) {
        const d = win[i] - win[i - 1];
        if (d > 0) gains += d;
        else losses -= d;
      }
      rsi14 = losses === 0 ? 75.0 : Fin.round(100 - 100 / (1 + gains / losses), 1);
    }

    if (regR2 === null && closes.length >= 6) {
      const m12 = closes.slice(-12);
      const nm = m12.length;
      const xs = m12.map((_, idx) => idx);
      const ys = m12.map(p => Math.log(p));
      const xm = xs.reduce((a, b) => a + b, 0) / nm;
      const ym = ys.reduce((a, b) => a + b, 0) / nm;
      let cov = 0, vx = 0, vy = 0;
      for (let i = 0; i < nm; i++) {
        cov += (xs[i] - xm) * (ys[i] - ym);
        vx += (xs[i] - xm) ** 2;
        vy += (ys[i] - ym) ** 2;
      }
      const slope = vx > 0 ? cov / vx : 0;
      regR2 = (vx > 0 && vy > 0) ? Fin.round((cov * cov) / (vx * vy), 2) : 0;
      regTrendAnnualPct = Fin.round((Math.exp(slope * 12) - 1) * 100, 2);
    }
  } else if (rsi14 === null && pos52wPct !== null) {
    // Estimate oscillator position from 52W range when daily/monthly history has not been synced yet
    rsi14 = Fin.round(28 + (pos52wPct * 0.44), 1);
  }

  // Benchmark 12M Alpha (Bug #5 Fix: 0.00% against self; identical YoY horizon for benchmark)
  const benchSym = MarketAPI.normalizeTicker(ticker.endsWith('.HK') ? (cfg.benchmarkHk || '2800.HK') : (cfg.benchmarkUs || 'VOO'));
  let alpha12mPct = null;
  if (ticker === benchSym) {
    alpha12mPct = 0.0;
  } else if (yoyPct !== null) {
    const benchHist = state?.historicalPrices?.[benchSym] || [];
    const benchPriceObj = state?.prices?.[benchSym] || {};
    let benchYoy = null;
    if (benchHist.length >= 12) {
      const bCur = Number(benchPriceObj.price || getBarRawPrice(benchHist[benchHist.length - 1]) || 0);
      const bOldBar = benchHist.length >= 13 ? benchHist[benchHist.length - 13] : benchHist[0];
      const bOld = getBarRawPrice(bOldBar);
      if (bCur > 0 && bOld > 0) {
        benchYoy = ((bCur - bOld) / bOld) * 100;
      }
    }
    if (benchYoy !== null) {
      alpha12mPct = Fin.round(yoyPct - benchYoy, 2);
    } else if (preTech.alpha12mPct !== undefined && preTech.alpha12mPct !== null) {
      alpha12mPct = Fin.round(Number(preTech.alpha12mPct), 2);
    }
  }

  // 6-State Market Regime Classification (UX #3 Fix: Golden Cross with shallow SMA20 consolidation stays Stage 2)
  let regime = preTech.regime || 'Range-Bound Consolidation';
  if (refCurrent > 0 && sma20 && sma50 && sma200) {
    if (refCurrent >= sma20 && sma20 >= sma50 * 0.985 && sma50 > sma200) {
      regime = 'Stage 2 Strong Uptrend';
    } else if (refCurrent >= sma50 && sma50 > sma200) {
      regime = 'Stage 2 Uptrend (Consolidating)';
    } else if (sma50 > sma200 && (refCurrent < sma20 || (rsi14 !== null && rsi14 <= 45))) {
      regime = 'Bullish Pullback (Buy-the-Dip)';
    } else if (refCurrent > sma50 && sma50 <= sma200 && (momPct || 0) > 0) {
      regime = 'Stage 1 Bullish Inflection';
    } else if (refCurrent < sma50 && sma50 > sma200) {
      regime = 'Stage 3 Topping / Distribution';
    } else if (refCurrent < sma50 && sma50 < sma200) {
      regime = 'Stage 4 Confirmed Downtrend';
    }
  } else if (pos52wPct !== null) {
    if (pos52wPct >= 70 && (yoyPct === null || yoyPct > 0)) regime = 'Stage 2 Strong Uptrend';
    else if (pos52wPct <= 35) regime = 'Bullish Pullback (Buy-the-Dip)';
    else regime = 'Range-Bound Consolidation';
  }

  // 4-Pillar Composite Buy/Sell Signal Score (0 - 100) using user-configured weights & thresholds
  const wMom = Number(cfg.weightMomentum ?? 30);
  const wTrend = Number(cfg.weightTrend ?? 25);
  const wVal = Number(cfg.weightValuation ?? 25);
  const wQual = Number(cfg.weightQuality ?? 20);
  const wSum = Math.max(1, wMom + wTrend + wVal + wQual);

  const rsiLow = Number(cfg.rsiOversold ?? 32);
  const rsiHigh = Number(cfg.rsiOverbought ?? 70);
  const reasons = [];

  // Pillar 1: Momentum & Mean Reversion (normalized 0..1)
  let p1Norm = 0.50;
  if (rsi14 !== null) {
    if (rsi14 <= rsiLow) {
      p1Norm += 0.40;
      reasons.push(`RSI(${cfg.rsiPeriod || 14}) oversold at ${rsi14} (<= ${rsiLow})`);
    } else if (rsi14 <= rsiLow + 10) {
      p1Norm += 0.22;
      reasons.push(`RSI(${cfg.rsiPeriod || 14}) in accumulation zone (${rsi14})`);
    } else if (rsi14 >= rsiHigh) {
      p1Norm -= 0.35;
      reasons.push(`RSI(${cfg.rsiPeriod || 14}) overbought at ${rsi14} (>= ${rsiHigh})`);
    }
  }
  if (pos52wPct !== null) {
    if (pos52wPct <= 22) {
      p1Norm += 0.15;
      reasons.push(`Trading near 52W Low (${pos52wPct}% of 52W range)`);
    } else if (pos52wPct >= 92) {
      p1Norm -= 0.12;
    }
  }
  p1Norm = Math.max(0, Math.min(1, p1Norm));

  // Pillar 2: Trend Structure (normalized 0..1)
  let p2Norm = 0.50;
  if (sma50 && sma200 && refCurrent > 0) {
    if (refCurrent > sma50 && sma50 > sma200) {
      p2Norm += 0.32;
      reasons.push('Golden Cross trend intact (Price > SMA50 > SMA200)');
    } else if (refCurrent > sma200) {
      p2Norm += 0.16;
    } else {
      p2Norm -= 0.22;
    }
  }
  if ((momPct || 0) > 0 && (qoqPct || 0) > 0) {
    p2Norm += 0.16;
    reasons.push(`Positive MoM (${Fin.percent(momPct)}) & QoQ (${Fin.percent(qoqPct)}) momentum`);
  } else if (macdHist > 0) {
    p2Norm += 0.12;
  }
  p2Norm = Math.max(0, Math.min(1, p2Norm));

  // Pillar 3: Valuation & Target Buy Margin (normalized 0..1)
  let p3Norm = 0.50;
  const wlItem = (state?.watchlist || []).find(w => w.ticker === ticker);
  const targetBuy = Number(wlItem?.targetBuyPrice || 0);
  if (targetBuy > 0 && refCurrent > 0) {
    if (refCurrent <= targetBuy) {
      p3Norm += 0.40;
      reasons.push(`Price at/below Target Buy (${Fin.currency(refCurrent, false, priceObj.currency)} <= ${Fin.currency(targetBuy, false, priceObj.currency)})`);
    } else if (((refCurrent - targetBuy) / targetBuy) <= 0.06) {
      p3Norm += 0.20;
      reasons.push(`Within 6% of Target Buy (${Fin.currency(targetBuy, false, priceObj.currency)})`);
    } else if (((refCurrent - targetBuy) / targetBuy) >= 0.25) {
      p3Norm -= 0.20;
    }
  }
  const pe = Number(fundObj.pe || 0);
  const fwdPe = Number(fundObj.fwdPe || 0);
  if (fwdPe > 0 && fwdPe <= 12.5) {
    p3Norm += 0.18;
    reasons.push(`Attractive Forward P/E (${fwdPe}x)`);
  } else if (pe > 0 && pe <= 11.0) {
    p3Norm += 0.15;
  }
  p3Norm = Math.max(0, Math.min(1, p3Norm));

  // Pillar 4: Dividend Yield & Fundamental Quality (normalized 0..1)
  let p4Norm = 0.50;
  const netYield = Number(divInfo?.netYieldPct || fundObj.divYield || 0);
  const roe = Number(fundObj.roe || 0);
  if (netYield >= 5.0) {
    p4Norm += 0.32;
    reasons.push(`High Net Dividend Yield (${netYield.toFixed(2)}%)`);
  } else if (netYield >= 3.2) {
    p4Norm += 0.18;
    reasons.push(`Solid Net Dividend Yield (${netYield.toFixed(2)}%)`);
  }
  if (roe >= 12.0) {
    p4Norm += 0.18;
    reasons.push(`Strong Return on Equity (ROE ${roe}%)`);
  }
  // Incorporate 7-day news sentiment if available
  const tickerArticles = (state?.companyNews || []).filter(a => a.ticker === ticker);
  if (tickerArticles.length > 0) {
    const avgSent = tickerArticles.reduce((s, a) => s + Number(a.sentimentScore || 0), 0) / tickerArticles.length;
    if (avgSent >= 0.25) {
      p4Norm += 0.10;
      reasons.push('Bullish recent news & catalyst sentiment');
    } else if (avgSent <= -0.25) {
      p4Norm -= 0.12;
    }
  }
  p4Norm = Math.max(0, Math.min(1, p4Norm));

  const scoreMom = Fin.round((p1Norm * wMom / wSum) * 100, 1);
  const scoreTrend = Fin.round((p2Norm * wTrend / wSum) * 100, 1);
  const scoreVal = Fin.round((p3Norm * wVal / wSum) * 100, 1);
  const scoreQual = Fin.round((p4Norm * wQual / wSum) * 100, 1);
  const signalScore = Math.max(0, Math.min(100, Math.round(scoreMom + scoreTrend + scoreVal + scoreQual)));

  let signalLabel = 'HOLD';
  if (signalScore >= Number(cfg.signalStrongBuyMin ?? 78)) signalLabel = 'STRONG BUY';
  else if (signalScore >= Number(cfg.signalBuyMin ?? 64)) signalLabel = 'ACCUMULATE';
  else if (signalScore >= Number(cfg.signalHoldMin ?? 42)) signalLabel = 'HOLD';
  else if (signalScore >= 28) signalLabel = 'TRIM / OVERBOUGHT';
  else signalLabel = 'SELL / AVOID';

  const stopMult = Number(cfg.atrStopMultiplier ?? 2.0);
  const suggestedStopLoss = (refCurrent > 0 && atr14 > 0) ? Fin.round(Math.max(0, refCurrent - stopMult * atr14), 3) : null;

  return {
    low52w,
    high52w,
    pos52wPct,
    momPct,
    qoqPct,
    yoyPct,
    momRefMonth,
    qoqRefMonth,
    yoyRefMonth,
    divInfo,
    sma20,
    sma50,
    sma200,
    rsi14,
    atr14,
    suggestedStopLoss,
    bbPctB,
    regime,
    regTrendAnnualPct,
    regR2,
    alpha12mPct,
    benchSym,
    signalScore,
    signalLabel,
    pillarBreakdown: {
      momentum: scoreMom,
      trend: scoreTrend,
      valuation: scoreVal,
      quality: scoreQual
    },
    signalReasons: reasons.length > 0 ? reasons.slice(0, 4) : ['Balanced technical and valuation profile']
  };
}

/**
 * Reconciles user's dated transaction ledger (2018-present) against historical dividend ex-dates.
 * Returns all unlogged dividend entitlements where shares held strictly before exDate > 0.
 */
function detectUnloggedDividendEntitlements() {
  if (!state || state.settings?.autoDetectDividends === false) return [];
  const existingKeys = new Set(
    (state.dividends || []).map(d => `${MarketAPI.normalizeTicker(d.ticker)}_${d.exDate || d.payDate}`)
  );

  const txByTicker = {};
  (state.transactions || []).forEach(tx => {
    const sym = MarketAPI.normalizeTicker(tx.ticker);
    if (!sym || tx.type === 'DEPOSIT' || tx.type === 'WITHDRAW') return;
    if (!txByTicker[sym]) txByTicker[sym] = [];
    txByTicker[sym].push(tx);
  });

  const todayStr = new Date().toISOString().split('T')[0];
  const detected = [];

  Object.keys(txByTicker).sort().forEach(sym => {
    const txs = txByTicker[sym].sort((a, b) => new Date(a.date) - new Date(b.date));
    const sched = state.dividendSchedules?.[sym] || buildDividendScheduleForTicker(sym);
    if (!sched || !Array.isArray(sched.history)) return;

    sched.history.forEach(ev => {
      const exDate = ev.exDate;
      if (!exDate || exDate > todayStr) return;
      const key = `${sym}_${exDate}`;
      if (existingKeys.has(key)) return;

      let eligibleShares = 0;
      txs.forEach(tx => {
        if (tx.date < exDate) {
          if (tx.type === 'BUY' || tx.type === 'DRIP') eligibleShares += Number(tx.shares || 0);
          else if (tx.type === 'SELL') eligibleShares -= Number(tx.shares || 0);
        }
      });

      eligibleShares = Fin.round(Math.max(0, eligibleShares), 4);
      if (eligibleShares > 0) {
        const grossAmt = Fin.round(eligibleShares * Number(ev.amount || 0), 2);
        const whtPct = Number(sched.withholdingTaxPct || 0);
        const netAmt = Fin.round(grossAmt * (1 - whtPct / 100), 2);
        detected.push({
          id: `AUTO-DIV-${sym}-${exDate}`,
          ticker: sym,
          exDate,
          payDate: ev.payDate || exDate,
          eligibleShares,
          amountPerShare: Fin.round(Number(ev.amount || 0), 4),
          grossAmount: grossAmt,
          withholdingTaxPct: whtPct,
          totalAmount: netAmt,
          currency: sched.currency || 'HKD'
        });
      }
    });
  });

  return detected.sort((a, b) => b.exDate.localeCompare(a.exDate));
}
window.detectUnloggedDividendEntitlements = detectUnloggedDividendEntitlements;

function approveDetectedDividend(detId, asDrip = false) {
  const list = portfolio?.detectedDividends || detectUnloggedDividendEntitlements();
  const item = list.find(d => d.id === detId);
  if (!item) return;

  let dripShares = 0;
  if (asDrip) {
    const refPrice = state.prices[item.ticker]?.price || 25;
    dripShares = Fin.round(item.totalAmount / refPrice, 4);
    state.transactions.push({
      id: `TX-DRIP-${item.ticker}-${item.exDate}`,
      date: item.payDate,
      type: 'DRIP',
      ticker: item.ticker,
      shares: dripShares,
      price: refPrice,
      fees: 0,
      notes: `Auto-reinvested DRIP (Ex-Date ${item.exDate})`
    });
  }

  state.dividends.push({
    id: `DIV-${item.ticker}-${item.exDate}`,
    ticker: item.ticker,
    payDate: item.payDate,
    exDate: item.exDate,
    amountPerShare: item.amountPerShare,
    totalAmount: item.totalAmount,
    currency: item.currency,
    isDrip: Boolean(asDrip),
    dripShares,
    notes: `Auto-verified entitlement (${Fin.shares(item.eligibleShares)} sh held prior to Ex-Date ${item.exDate})`
  });

  recalculatePortfolio();
  saveState();
  renderAll();
  showToast(`Posted ${Fin.currency(item.totalAmount, false, item.currency)} dividend for ${item.ticker} (${item.exDate})`, 'success');
}
window.approveDetectedDividend = approveDetectedDividend;

function approveAllDetectedDividends(asDrip = false) {
  const list = portfolio?.detectedDividends || detectUnloggedDividendEntitlements();
  if (!list || list.length === 0) {
    showToast('No pending unlogged dividends to backfill.', 'info');
    return;
  }

  let totalAdded = 0;
  list.forEach(item => {
    let dripShares = 0;
    if (asDrip) {
      const refPrice = state.prices[item.ticker]?.price || 25;
      dripShares = Fin.round(item.totalAmount / refPrice, 4);
      state.transactions.push({
        id: `TX-DRIP-${item.ticker}-${item.exDate}`,
        date: item.payDate,
        type: 'DRIP',
        ticker: item.ticker,
        shares: dripShares,
        price: refPrice,
        fees: 0,
        notes: `Auto-reinvested DRIP (Ex-Date ${item.exDate})`
      });
    }
    state.dividends.push({
      id: `DIV-${item.ticker}-${item.exDate}`,
      ticker: item.ticker,
      payDate: item.payDate,
      exDate: item.exDate,
      amountPerShare: item.amountPerShare,
      totalAmount: item.totalAmount,
      currency: item.currency,
      isDrip: Boolean(asDrip),
      dripShares,
      notes: `Auto-verified entitlement (${Fin.shares(item.eligibleShares)} sh held prior to Ex-Date ${item.exDate})`
    });
    totalAdded++;
  });

  recalculatePortfolio();
  saveState();
  renderAll();
  showToast(`Backfilled ${totalAdded} historical dividend payouts (2018–Present) into ledger!`, 'success');
}
window.approveAllDetectedDividends = approveAllDetectedDividends;

function recalculatePortfolio() {
  const baseCurr = state?.settings?.currency || 'HKD';
  let runningCash = Fin.round(state.initialCash || 0, 2);
  let totalRealizedPnL = 0;
  const holdingsMap = {};

  const sortedTx = [...state.transactions].sort((a, b) => new Date(a.date) - new Date(b.date));

  sortedTx.forEach(tx => {
    const fees = Fin.round(tx.fees || 0, 2);
    const shares = Fin.round(tx.shares || 0, 4);
    const price = Fin.round(tx.price || 0, 4);
    const tCurr = state.prices[tx.ticker]?.currency || state.fundamentals[tx.ticker]?.currency || MarketAPI.getStaticProfile(tx.ticker).currency || baseCurr;

    if (tx.type === 'DEPOSIT') {
      runningCash = Fin.round(runningCash + (tx.amount || 0), 2);
    } else if (tx.type === 'WITHDRAW') {
      runningCash = Fin.round(runningCash - (tx.amount || 0), 2);
    } else if (tx.type === 'BUY') {
      const totalOutlayNative = Fin.round(shares * price + fees, 2);
      const totalOutlayBase = Fin.convertCurrency(totalOutlayNative, tCurr, baseCurr);
      runningCash = Fin.round(runningCash - totalOutlayBase, 2);

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
      h.totalCostBasis = Fin.round(h.totalCostBasis + totalOutlayNative, 2);
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
      const netProceedsNative = Fin.round(grossProceeds - fees, 2);
      const netProceedsBase = Fin.convertCurrency(netProceedsNative, tCurr, baseCurr);
      runningCash = Fin.round(runningCash + netProceedsBase, 2);

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
      const tradeRealizedGainNative = Fin.round(netProceedsNative - soldCostBasis, 2);

      tx.realizedGain = tradeRealizedGainNative;
      h.realizedGain = Fin.round(h.realizedGain + tradeRealizedGainNative, 2);
      totalRealizedPnL = Fin.round(totalRealizedPnL + Fin.convertCurrency(tradeRealizedGainNative, tCurr, baseCurr), 2);

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
    const amtNative = Fin.round(div.totalAmount || 0, 2);
    const dCurr = div.currency || state.prices[div.ticker]?.currency || MarketAPI.getStaticProfile(div.ticker).currency || baseCurr;
    const amtBase = Fin.convertCurrency(amtNative, dCurr, baseCurr);
    totalDividendsEarned = Fin.round(totalDividendsEarned + amtBase, 2);

    if (div.isDrip) {
      dripDividendsTotal = Fin.round(dripDividendsTotal + amtBase, 2);
    } else {
      cashDividendsTotal = Fin.round(cashDividendsTotal + amtBase, 2);
      runningCash = Fin.round(runningCash + amtBase, 2);
    }

    if (holdingsMap[div.ticker]) {
      holdingsMap[div.ticker].totalDividends = Fin.round((holdingsMap[div.ticker].totalDividends || 0) + amtNative, 2);
    }
  });

  state.cashBalance = runningCash;

  const activeHoldings = [];
  let totalStockMarketValue = 0;
  let totalStockCostBasis = 0;
  let estimatedAnnualForwardDivBase = 0;

  Object.keys(holdingsMap).forEach(ticker => {
    const h = holdingsMap[ticker];
    if (h.shares > 0.0001) {
      const staticProfile = MarketAPI.getStaticProfile(ticker);
      const priceObj = state.prices[ticker] || { price: h.avgCost, change: 0, changePct: 0 };
      const currentPrice = Fin.round(priceObj.price || h.avgCost, 4);
      const marketValue = Fin.round(h.shares * currentPrice, 2);
      const unrealizedGain = Fin.round(marketValue - h.totalCostBasis, 2);
      const unrealizedGainPct = h.totalCostBasis > 0 ? Fin.round((unrealizedGain / h.totalCostBasis) * 100, 2) : 0;
      const fund = state.fundamentals[ticker] || {};
      const currency = priceObj.currency || fund.currency || staticProfile.currency;
      const companyName = (fund.name && fund.name !== ticker) ? fund.name : staticProfile.name;
      const rawSector = (fund.sector && fund.sector !== 'Equities') ? fund.sector : staticProfile.sector;
      const sector = MarketAPI.isEtfSector(rawSector, ticker, companyName) ? 'Index ETF' : (rawSector || 'Equities');
      const priceMetrics = computeStockPriceMetrics(ticker, currentPrice);
      const divInfo = priceMetrics.divInfo || {};

      // Annualized Forward Yield on Cost (or cumulative YoC if higher)
      const annualDivNative = Number(divInfo.forwardDivPerShare || divInfo.ttmDivPerShare || 0) * h.shares;
      const forwardYoC = h.totalCostBasis > 0 && annualDivNative > 0
        ? Fin.round((annualDivNative / h.totalCostBasis) * 100, 2)
        : 0;
      const cumYoC = h.totalCostBasis > 0 ? Fin.round((h.totalDividends / h.totalCostBasis) * 100, 2) : 0;
      const yieldOnCost = cumYoC > 0 ? cumYoC : forwardYoC;

      const marketValueBase = Fin.convertCurrency(marketValue, currency, baseCurr);
      const costBasisBase = Fin.convertCurrency(h.totalCostBasis, currency, baseCurr);
      const annualDivBase = Fin.convertCurrency(annualDivNative, currency, baseCurr);

      activeHoldings.push({
        ticker,
        companyName,
        sector,
        currency,
        shares: h.shares,
        avgCost: h.avgCost,
        totalCostBasis: h.totalCostBasis,
        costBasisBase,
        currentPrice,
        priceChange: priceObj.change || 0,
        priceChangePct: priceObj.changePct || 0,
        low52w: priceMetrics.low52w,
        high52w: priceMetrics.high52w,
        pos52wPct: priceMetrics.pos52wPct,
        momPct: priceMetrics.momPct,
        qoqPct: priceMetrics.qoqPct,
        yoyPct: priceMetrics.yoyPct,
        momRefMonth: priceMetrics.momRefMonth,
        qoqRefMonth: priceMetrics.qoqRefMonth,
        yoyRefMonth: priceMetrics.yoyRefMonth,
        divInfo,
        sma20: priceMetrics.sma20,
        sma50: priceMetrics.sma50,
        sma200: priceMetrics.sma200,
        rsi14: priceMetrics.rsi14,
        atr14: priceMetrics.atr14,
        suggestedStopLoss: priceMetrics.suggestedStopLoss,
        regime: priceMetrics.regime,
        regTrendAnnualPct: priceMetrics.regTrendAnnualPct,
        regR2: priceMetrics.regR2,
        alpha12mPct: priceMetrics.alpha12mPct,
        benchSym: priceMetrics.benchSym,
        signalScore: priceMetrics.signalScore,
        signalLabel: priceMetrics.signalLabel,
        pillarBreakdown: priceMetrics.pillarBreakdown,
        signalReasons: priceMetrics.signalReasons,
        marketValue,
        marketValueBase,
        unrealizedGain,
        unrealizedGainPct,
        totalDividends: h.totalDividends,
        yieldOnCost,
        forwardYoC,
        annualForwardDivNative: Fin.round(annualDivNative, 2),
        annualForwardDivBase: Fin.round(annualDivBase, 2),
        realizedGain: h.realizedGain
      });

      totalStockMarketValue = Fin.round(totalStockMarketValue + marketValueBase, 2);
      totalStockCostBasis = Fin.round(totalStockCostBasis + costBasisBase, 2);
      estimatedAnnualForwardDivBase = Fin.round(estimatedAnnualForwardDivBase + annualDivBase, 2);
    }
  });

  activeHoldings.sort(compareHoldingsBySectorAndTicker);

  const totalPortfolioValue = Fin.round(Math.max(0, state.cashBalance) + totalStockMarketValue, 2);
  const totalUnrealizedGain = Fin.round(totalStockMarketValue - totalStockCostBasis, 2);
  const totalUnrealizedGainPct = totalStockCostBasis > 0 ? Fin.round((totalUnrealizedGain / totalStockCostBasis) * 100, 2) : 0;

  // Compute Portfolio Nominal XIRR & Real (Inflation-Adjusted) XIRR over exact dated cash flows
  const xirrFlows = [];
  sortedTx.forEach(tx => {
    if (!tx.date) return;
    const tCurr = state.prices[tx.ticker]?.currency || state.fundamentals[tx.ticker]?.currency || MarketAPI.getStaticProfile(tx.ticker).currency || baseCurr;
    if (tx.type === 'BUY') {
      const outlayBase = Fin.convertCurrency((tx.shares || 0) * (tx.price || 0) + (tx.fees || 0), tCurr, baseCurr);
      if (outlayBase > 0) xirrFlows.push({ date: tx.date, amount: -outlayBase });
    } else if (tx.type === 'SELL') {
      const procBase = Fin.convertCurrency((tx.shares || 0) * (tx.price || 0) - (tx.fees || 0), tCurr, baseCurr);
      if (procBase > 0) xirrFlows.push({ date: tx.date, amount: procBase });
    }
  });

  state.dividends.forEach(div => {
    if (!div.payDate || div.isDrip) return;
    const dCurr = div.currency || state.prices[div.ticker]?.currency || MarketAPI.getStaticProfile(div.ticker).currency || baseCurr;
    const amtBase = Fin.convertCurrency(div.totalAmount || 0, dCurr, baseCurr);
    if (amtBase > 0) xirrFlows.push({ date: div.payDate, amount: amtBase });
  });

  if (totalStockMarketValue > 0) {
    xirrFlows.push({ date: new Date().toISOString().split('T')[0], amount: totalStockMarketValue });
  }

  const nominalXirrPct = Fin.xirr(xirrFlows);
  const inflationRatePct = Number(state.settings?.inflationRatePct ?? 2.2);
  const realXirrPct = nominalXirrPct !== null ? Fin.realReturn(nominalXirrPct, inflationRatePct) : null;

  const detectedDividends = detectUnloggedDividendEntitlements();

  portfolio = {
    baseCurrency: baseCurr,
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
    estimatedAnnualForwardDivBase,
    nominalXirrPct,
    realXirrPct,
    inflationRatePct,
    detectedDividends,
    activeHoldings,
    allHoldingsMap: holdingsMap
  };
}

// ============================================================================
// 9. SHEETJS 8-SHEET EXCEL EXPORT & RESTORE
// ============================================================================
function exportPortfolioToExcel() {
  try {
    const wb = XLSX.utils.book_new();
    const baseCurr = portfolio.baseCurrency || 'HKD';

    // 1. Account_Summary
    const summaryData = [
      { Metric: `Total Portfolio Value (${baseCurr})`, Value: Fin.currency(portfolio.totalPortfolioValue, false, baseCurr) },
      { Metric: `Available Cash Balance (${baseCurr})`, Value: Fin.currency(portfolio.cashBalance, false, baseCurr) },
      { Metric: `Total Stock Market Value (${baseCurr})`, Value: Fin.currency(portfolio.totalStockMarketValue, false, baseCurr) },
      { Metric: `Active Invested Cost Basis (${baseCurr})`, Value: Fin.currency(portfolio.totalStockCostBasis, false, baseCurr) },
      { Metric: `Unrealized P&L (${baseCurr})`, Value: Fin.currency(portfolio.totalUnrealizedGain, true, baseCurr) },
      { Metric: 'Unrealized P&L (%)', Value: Fin.percent(portfolio.totalUnrealizedGainPct, true) },
      { Metric: `Realized P&L (${baseCurr})`, Value: Fin.currency(portfolio.totalRealizedPnL, true, baseCurr) },
      { Metric: `Total Dividends Earned (${baseCurr})`, Value: Fin.currency(portfolio.totalDividendsEarned, false, baseCurr) },
      { Metric: 'Nominal XIRR (Annualized %)', Value: portfolio.nominalXirrPct !== null ? Fin.percent(portfolio.nominalXirrPct, true) : 'N/A' },
      { Metric: `Real XIRR (Inflation-Adjusted @ ${portfolio.inflationRatePct}%)`, Value: portfolio.realXirrPct !== null ? Fin.percent(portfolio.realXirrPct, true) : 'N/A' },
      { Metric: 'Active Positions Count', Value: portfolio.activeHoldings.length },
      { Metric: 'Export Timestamp', Value: new Date().toISOString() }
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summaryData), 'Account_Summary');

    // 2. Holdings
    const holdingsData = portfolio.activeHoldings.map(h => ({
      Ticker: h.ticker,
      'Company Name': h.companyName,
      Sector: h.sector,
      Currency: h.currency || 'HKD',
      'Shares Held': h.shares,
      'Avg Cost Basis ($)': h.avgCost,
      'Total Cost Basis ($)': h.totalCostBasis,
      'Current Price ($)': h.currentPrice,
      '52W Low ($)': h.low52w ?? '',
      '52W High ($)': h.high52w ?? '',
      '52W Position (%)': h.pos52wPct ?? '',
      'MoM (%)': h.momPct ?? '',
      'QoQ (%)': h.qoqPct ?? '',
      'YoY (%)': h.yoyPct ?? '',
      'Net Div Yield (%)': h.divInfo?.netYieldPct ?? '',
      'Next Ex-Date': h.divInfo?.nextExDate ?? '',
      'Trend Regime': h.regime ?? '',
      'RSI (14)': h.rsi14 ?? '',
      'Signal Score (0-100)': h.signalScore ?? '',
      'Signal Action': h.signalLabel ?? '',
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
      Ticker: t.ticker || 'CASH',
      Shares: t.shares || 0,
      'Price per Share ($)': t.price || 0,
      'Fees ($)': t.fees || 0,
      'Net Total ($)': t.type === 'DEPOSIT' || t.type === 'WITHDRAW' ? t.amount : (t.type === 'BUY' ? Fin.round(t.shares * t.price + (t.fees || 0), 2) : Fin.round(Math.max(0, t.shares * t.price - (t.fees || 0)), 2)),
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
      const curP = state.prices[ticker]?.price || 0;
      const m = computeStockPriceMetrics(ticker, curP);
      return {
        Ticker: ticker,
        'Company Name': w.name || f.name || ticker,
        Sector: w.sector || f.sector || 'Equities',
        'Current Price ($)': curP,
        '52W Low ($)': m.low52w ?? '',
        '52W High ($)': m.high52w ?? '',
        '52W Position (%)': m.pos52wPct ?? '',
        'MoM (%)': m.momPct ?? '',
        'QoQ (%)': m.qoqPct ?? '',
        'YoY (%)': m.yoyPct ?? '',
        'Target Buy Price ($)': w.targetBuyPrice || 0,
        'On Watchlist': w.ticker ? 'YES' : 'NO',
        'Signal Score (0-100)': m.signalScore ?? '',
        'Signal Action': m.signalLabel ?? '',
        'Trend Regime': m.regime ?? '',
        'Next Ex-Date': m.divInfo?.nextExDate ?? '',
        'P/E Ratio': f.pe || '',
        'Forward P/E': f.fwdPe || '',
        'EPS ($)': f.eps || '',
        'Book Value/Share ($)': f.bvps || '',
        'Market Cap': f.marketCap || '',
        'Debt to Equity': f.debtEquity || '',
        'ROE (%)': f.roe || '',
        'Free Cash Flow': f.fcf || '',
        'FCF Per Share ($)': f.fcfPerShare || '',
        'Div Yield (%)': m.divInfo?.trailingYieldPct || f.divYield || ''
      };
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(wlData), 'Watchlist_Fundamentals');

    // 6. Historical_Prices
    const histRows = [];
    Object.keys(state.historicalPrices).forEach(ticker => {
      const series = state.historicalPrices[ticker] || [];
      if (isLegacySyntheticHistory(series)) return;
      series.forEach(r => {
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

    // 7. Technical_Signals
    const sigRows = allTickers.map(ticker => {
      const curP = state.prices[ticker]?.price || 0;
      const m = computeStockPriceMetrics(ticker, curP);
      return {
        Ticker: ticker,
        'Price ($)': curP,
        'Signal Score': m.signalScore,
        'Signal Label': m.signalLabel,
        'Trend Regime': m.regime,
        'RSI (14)': m.rsi14 ?? '',
        'SMA 20': m.sma20 ?? '',
        'SMA 50': m.sma50 ?? '',
        'SMA 200': m.sma200 ?? '',
        'ATR (14)': m.atr14 ?? '',
        'Suggested Stop-Loss': m.suggestedStopLoss ?? '',
        '12M Reg Trend (%)': m.regTrendAnnualPct ?? '',
        '12M Reg R2': m.regR2 ?? '',
        '12M Benchmark Alpha (%)': m.alpha12mPct ?? '',
        'Top Triggers': (m.signalReasons || []).join(' | ')
      };
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sigRows), 'Technical_Signals');

    // 8. Dividend_Calendar
    const divCalRows = allTickers.map(ticker => {
      const curP = state.prices[ticker]?.price || 0;
      const d = buildDividendScheduleForTicker(ticker, null, curP) || {};
      return {
        Ticker: ticker,
        Currency: d.currency || '',
        Frequency: d.frequency || 'None',
        'TTM Div / Share': d.ttmDivPerShare || 0,
        'Forward Div / Share': d.forwardDivPerShare || 0,
        'Trailing Yield (%)': d.trailingYieldPct || 0,
        'Withholding Tax (%)': d.withholdingTaxPct || 0,
        'Net Yield (%)': d.netYieldPct || 0,
        '3Y Div CAGR (%)': d.divCagr3Y ?? '',
        'Next Ex-Date': d.nextExDate || '',
        'Next Pay Date': d.nextPayDate || '',
        'Est Next Payout / Sh': d.nextEstAmount || '',
        'Schedule Status': d.nextStatus || ''
      };
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(divCalRows), 'Dividend_Calendar');

    // 9. Quant_Settings (Bug #6 Fix: lossless round-trip of all customizable settings)
    const quantKeys = Object.keys(DEFAULT_QUANT_SETTINGS).filter(k => k !== 'githubPat');
    const quantRows = quantKeys.map(k => ({
      Parameter: k,
      Value: state.settings[k] !== undefined ? state.settings[k] : DEFAULT_QUANT_SETTINGS[k]
    }));
    if (state.settings._userCustomFx) {
      quantRows.push({ Parameter: '_userCustomFx', Value: 'true' });
    }
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(quantRows), 'Quant_Settings');

    const dateStr = new Date().toISOString().split('T')[0];
    XLSX.writeFile(wb, `myPortfolio_Backup_${dateStr}.xlsx`);
    showToast('Exported 9-sheet myPortfolio v3.0.1 backup (.xlsx)!', 'success');
  } catch (err) {
    console.error('Excel export failed:', err);
    showToast('Export failed: ' + err.message, 'error');
  }
}

function restorePortfolioFromExcel(file) {
  const statusMsg = document.getElementById('import-status-msg');
  if (statusMsg) statusMsg.innerHTML = '<span class="text-indigo-400">Validating and restoring workbook...</span>';

  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const data = new Uint8Array(e.target.result);
      const wb = XLSX.read(data, { type: 'array' });

      if (!wb.SheetNames.includes('Transactions') && !wb.SheetNames.includes('Holdings')) {
        throw new Error('Invalid backup workbook: missing Transactions or Holdings sheet.');
      }

      const normalizeExcelDate = (val) => {
        if (!val) return new Date().toISOString().split('T')[0];
        if (typeof val === 'number' && val > 20000 && val < 90000) {
          const utcDays = Math.floor(val - 25569);
          return new Date(utcDays * 86400 * 1000).toISOString().split('T')[0];
        }
        return String(val).trim().slice(0, 10);
      };

      if (wb.SheetNames.includes('Transactions')) {
        const rawTx = XLSX.utils.sheet_to_json(wb.Sheets['Transactions']);
        state.transactions = rawTx
          .filter(row => row && (row['Type'] || row['Transaction ID']) && !String(row['Transaction ID'] || '').toUpperCase().includes('TOTAL'))
          .map((row, idx) => {
            const type = String(row['Type'] || 'BUY').trim().toUpperCase();
            const rawTicker = String(row['Ticker'] || '').trim().toUpperCase();
            return {
              id: row['Transaction ID'] || `TX-${idx + 1}`,
              date: normalizeExcelDate(row['Date']),
              type,
              ticker: (type === 'DEPOSIT' || type === 'WITHDRAW' || rawTicker === 'CASH') ? '' : MarketAPI.normalizeTicker(rawTicker),
              shares: Number(row['Shares']) || 0,
              price: Number(row['Price per Share ($)']) || 0,
              fees: Number(row['Fees ($)']) || 0,
              amount: Number(row['Net Total ($)']) || 0,
              notes: row['Notes'] || ''
            };
          });

        // Bug #2 Fix: If a DEPOSIT row has amount === 0 because its Excel 'Net Total ($)' cell was an
        // un-cached formula (=SUM(H3:H80)), automatically compute the funded capital from total BUY cost basis.
        const zeroDeposits = state.transactions.filter(t => t.type === 'DEPOSIT' && (!t.amount || t.amount <= 0));
        if (zeroDeposits.length > 0) {
          const totalBuyOutlay = state.transactions
            .filter(t => t.type === 'BUY')
            .reduce((sum, t) => sum + Fin.round((t.shares || 0) * (t.price || 0) + (t.fees || 0), 2), 0);
          if (totalBuyOutlay > 0) {
            zeroDeposits[0].amount = Fin.round(totalBuyOutlay, 2);
          }
        }
      }

      if (wb.SheetNames.includes('Holdings')) {
        const rawHoldings = XLSX.utils.sheet_to_json(wb.Sheets['Holdings']);
        rawHoldings.forEach(row => {
          const t = MarketAPI.normalizeTicker(row['Ticker'] || '');
          if (!t) return;
          const curP = Number(row['Current Price ($)'] || row['Current Market Price ($)']) || 0;
          const currency = row['Currency'] || MarketAPI.getStaticProfile(t).currency;
          if (curP > 0) {
            state.prices[t] = { price: curP, prevPrice: curP, change: 0, changePct: 0, currency, lastUpdated: new Date().toISOString() };
          }
          const staticProfile = MarketAPI.getStaticProfile(t);
          const low52 = Number(row['52W Low ($)']) > 0 ? Number(row['52W Low ($)']) : (state.fundamentals[t]?.low52w || null);
          const high52 = Number(row['52W High ($)']) > 0 ? Number(row['52W High ($)']) : (state.fundamentals[t]?.high52w || null);
          state.fundamentals[t] = {
            ...(state.fundamentals[t] || {}),
            name: row['Company Name'] || state.fundamentals[t]?.name || staticProfile.name,
            sector: row['Sector'] || state.fundamentals[t]?.sector || staticProfile.sector,
            currency,
            low52w: low52,
            high52w: high52
          };
        });
      }

      if (wb.SheetNames.includes('Dividends')) {
        const rawDiv = XLSX.utils.sheet_to_json(wb.Sheets['Dividends']);
        state.dividends = rawDiv.map((row, idx) => ({
          id: row['Dividend ID'] || `DIV-${idx + 1}`,
          ticker: MarketAPI.normalizeTicker(row['Ticker'] || ''),
          payDate: normalizeExcelDate(row['Pay Date']),
          exDate: row['Ex Date'] ? normalizeExcelDate(row['Ex Date']) : '',
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
          const t = MarketAPI.normalizeTicker(row['Ticker'] || '');
          if (!t) return;
          const staticProfile = MarketAPI.getStaticProfile(t);
          if ((row['On Watchlist'] || 'YES').toString().toUpperCase() !== 'NO' && Number(row['Target Buy Price ($)']) > 0) {
            state.watchlist.push({
              ticker: t,
              name: row['Company Name'] || staticProfile.name || t,
              sector: row['Sector'] || staticProfile.sector || 'Equities',
              targetBuyPrice: Number(row['Target Buy Price ($)']) || 0
            });
          }
          state.fundamentals[t] = {
            ...(state.fundamentals[t] || {}),
            name: row['Company Name'] || state.fundamentals[t]?.name || staticProfile.name || t,
            sector: row['Sector'] || state.fundamentals[t]?.sector || staticProfile.sector || 'Equities',
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
        const importedHist = {};
        rawHist.forEach(row => {
          const t = MarketAPI.normalizeTicker(row['Ticker'] || '');
          if (!t || !row['Month']) return;
          if (!importedHist[t]) importedHist[t] = [];
          importedHist[t].push({
            month: String(row['Month']).slice(0, 7),
            close: Number(row['Close Price ($)']) || 0,
            high: Number(row['High ($)']) || 0,
            low: Number(row['Low ($)']) || 0,
            volume: Number(row['Volume']) || 0
          });
        });
        Object.entries(importedHist).forEach(([sym, series]) => {
          if (!isLegacySyntheticHistory(series) && series.length > 0) {
            state.historicalPrices[sym] = series.sort((a, b) => a.month.localeCompare(b.month));
          }
        });
      }

      if (wb.SheetNames.includes('Quant_Settings')) {
        const rawQs = XLSX.utils.sheet_to_json(wb.Sheets['Quant_Settings']);
        rawQs.forEach(row => {
          const k = String(row['Parameter'] || '').trim();
          const v = row['Value'];
          if (!k || v === undefined || v === null || v === '') return;
          if (k === '_userCustomFx') {
            state.settings._userCustomFx = (String(v).toLowerCase() === 'true' || v === true);
            return;
          }
          if (Object.prototype.hasOwnProperty.call(DEFAULT_QUANT_SETTINGS, k)) {
            const defVal = DEFAULT_QUANT_SETTINGS[k];
            if (typeof defVal === 'boolean') {
              state.settings[k] = (String(v).toLowerCase() === 'true' || v === true);
            } else if (typeof defVal === 'number') {
              const numVal = parseFloat(v);
              if (!isNaN(numVal)) state.settings[k] = numVal;
            } else {
              state.settings[k] = String(v).trim();
            }
          }
        });
      }

      recalculatePortfolio();
      saveState();
      renderAll();
      loadHistoricalPricesFromJson(true);

      const detectedCount = portfolio?.detectedDividends?.length || 0;
      if (statusMsg) {
        statusMsg.innerHTML = `<span class="text-emerald-500 font-bold"><i class="fa-solid fa-check"></i> Workbook restored (${detectedCount} historical dividends auto-detected)!</span>`;
      }
      showToast(`Portfolio restored! ${detectedCount > 0 ? `${detectedCount} historical dividends (2018+) ready for 1-click backfill in Dividends tab.` : ''}`, 'success');
    } catch (err) {
      if (typeof AppLogger !== 'undefined') AppLogger.error('Excel-IO', `Excel restore error: ${err.message}`, err);
      if (statusMsg) statusMsg.innerHTML = `<span class="text-rose-500 font-bold">${err.message}</span>`;
      showToast('Restore failed: ' + err.message, 'error');
    }
  };
  reader.readAsArrayBuffer(file);
}

window.STORAGE_KEY = STORAGE_KEY;
window.DEFAULT_QUANT_SETTINGS = DEFAULT_QUANT_SETTINGS;
window.BASELINE_DIVIDEND_HISTORY_2018_2026 = BASELINE_DIVIDEND_HISTORY_2018_2026;
window.createEmptyState = createEmptyState;
window.isLegacySyntheticHistory = isLegacySyntheticHistory;
window.compareHoldingsBySectorAndTicker = compareHoldingsBySectorAndTicker;
window.loadHistoricalPricesFromJson = loadHistoricalPricesFromJson;
window.loadCompanyNewsFromJson = loadCompanyNewsFromJson;
window.initAppState = initAppState;
window.saveState = saveState;
window.computeStockPriceMetrics = computeStockPriceMetrics;
window.recalculatePortfolio = recalculatePortfolio;
window.exportPortfolioToExcel = exportPortfolioToExcel;
window.restorePortfolioFromExcel = restorePortfolioFromExcel;

window.ingestHistoricalPricesData = ingestHistoricalPricesData;
window.ingestCompanyNewsData = ingestCompanyNewsData;
window.normalizeNewsArticleSchema = normalizeNewsArticleSchema;
