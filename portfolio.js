/**
 * @file portfolio.js
 * @module PortfolioEngineAndExcelIO
 * @version 2.4.1
 * @build 20261019_1950
 * @description Application state persistence, automatic startup loading of ./historical_prices.json,
 *   WACB & P&L accounting engine, and SheetJS 6-worksheet Excel backup/restore.
 */

var STORAGE_KEY = 'MYPORTFOLIO_STATE_V1';

// ============================================================================
// 3. CLEAN INITIAL STATE (DEFAULTING TO KEYLESS YAHOO FINANCE)
// ============================================================================
function createEmptyState() {
  return {
    settings: {
      currency: 'USD',
      apiProvider: 'yahoo', // 'yahoo' | 'alphavantage' | 'twelvedata' | 'finnhub'
      apiKey: '',
      deviceOverride: 'auto',
      darkMode: true,
      lastApiSync: null,
      yahooDefaultApplied: true,
      appVersion: '2.4.1',
      buildId: '20261019_1950',
      collapsedSectors: {}
    },
    cashBalance: 0,
    initialCash: 0,
    transactions: [],
    prices: {},            // { '2800.HK': { price, prevPrice, change, changePct, currency, lastUpdated } }
    historicalPrices: {},  // { '2800.HK': [ { month: '2025-01', close: 21.15, high: 21.5, low: 19.8, volume: 10000 }, ... ] }
    dividends: [],
    watchlist: [],
    fundamentals: {}       // { '2800.HK': { name, sector, pe, fwdPe, eps, marketCap, debtEquity, roe, fcf, divYield, bvps, fcfPerShare, ... } }
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

/**
 * Detects legacy synthetic/hardcoded hardcoded market snapshot data series from pre-v2.4.1 builds
 * (e.g. series where all monthly bars had a constant dummy volume like 1500000 or 395201089
 * or uniform -25 dates) so they are purged from localStorage and Excel imports.
 */
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

/**
 * Comparator that sorts sectors with ETFs at the top, then alphabetical sector (A-Z),
 * and alphabetical ticker (A-Z) within each sector.
 */
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
 * Loads ./historical_prices.json on startup (populated by update_historical_prices.py / GitHub Actions)
 * and merges real monthly historical price series into state.historicalPrices.
 */
async function loadHistoricalPricesFromJson(silent = true) {
  try {
    const res = await fetch(`./historical_prices.json?_=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) {
      window.__HISTORICAL_PRICES_JSON_LOADED__ = false;
      if (typeof AppLogger !== 'undefined') {
        AppLogger.info('Portfolio', `./historical_prices.json HTTP ${res.status} — charts will stay empty until real data is synced.`);
      }
      return false;
    }

    const data = await res.json();
    if (!data || typeof data !== 'object') {
      window.__HISTORICAL_PRICES_JSON_LOADED__ = false;
      return false;
    }

    window.EXTERNAL_HISTORICAL_PRICES = data;
    let loadedSeriesCount = 0;
    let loadedQuotesCount = 0;

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

    // 1. Check structured maps: prices / historicalPrices / history
    [data.prices, data.historicalPrices, data.history]
      .filter(m => m && typeof m === 'object' && !Array.isArray(m))
      .forEach(mapObj => {
        Object.entries(mapObj).forEach(([k, v]) => ingestHistorySeries(k, v));
      });

    // 2. Check structured tickers map: { tickers: { '2800.HK': { history: [...], quote: {...}, fundamentals: {...} } } }
    if (data.tickers && typeof data.tickers === 'object' && !Array.isArray(data.tickers)) {
      Object.entries(data.tickers).forEach(([k, v]) => {
        const sym = MarketAPI.normalizeTicker(k);
        if (Array.isArray(v)) {
          ingestHistorySeries(sym, v);
        } else if (v && typeof v === 'object') {
          if (Array.isArray(v.history)) ingestHistorySeries(sym, v.history);
          if (Array.isArray(v.prices)) ingestHistorySeries(sym, v.prices);
          if (v.quote && Number(v.quote.price) > 0) {
            state.prices[sym] = {
              ...(state.prices[sym] || {}),
              ...v.quote,
              lastUpdated: v.quote.lastUpdated || data._meta?.generatedAt || new Date().toISOString()
            };
            loadedQuotesCount++;
          }
          if (v.fundamentals && typeof v.fundamentals === 'object') {
            state.fundamentals[sym] = { ...(state.fundamentals[sym] || {}), ...v.fundamentals };
          }
        }
      });
    }

    // 3. Check top-level quotes & fundamentals maps
    if (data.quotes && typeof data.quotes === 'object') {
      Object.entries(data.quotes).forEach(([k, q]) => {
        const sym = MarketAPI.normalizeTicker(k);
        if (sym && q && Number(q.price) > 0) {
          state.prices[sym] = {
            ...(state.prices[sym] || {}),
            ...q,
            lastUpdated: q.lastUpdated || data._meta?.generatedAt || new Date().toISOString()
          };
          loadedQuotesCount++;
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

    // 4. Check flat ticker keys at root: { '2800.HK': [ ... ], '0002.HK': [ ... ] }
    const reservedKeys = new Set(['_meta', 'meta', 'prices', 'historicalPrices', 'history', 'quotes', 'fundamentals', 'tickers']);
    Object.entries(data).forEach(([k, v]) => {
      if (reservedKeys.has(k)) return;
      if (Array.isArray(v)) {
        ingestHistorySeries(k, v);
      } else if (v && typeof v === 'object' && Array.isArray(v.history)) {
        ingestHistorySeries(k, v.history);
      }
    });

    window.__HISTORICAL_PRICES_JSON_LOADED__ = true;
    recalculatePortfolio();
    saveState();
    if (typeof renderAll === 'function') {
      renderAll();
    }

    if (typeof AppLogger !== 'undefined') {
      AppLogger.info(
        'Portfolio',
        `Loaded ./historical_prices.json (${loadedSeriesCount} real historical series, ${loadedQuotesCount} quotes).`
      );
    }
    if (!silent && typeof showToast === 'function') {
      showToast(
        loadedSeriesCount > 0
          ? `Loaded ${loadedSeriesCount} historical price series from historical_prices.json`
          : 'historical_prices.json loaded (0 series populated yet; run update_historical_prices.py)',
        loadedSeriesCount > 0 ? 'success' : 'info'
      );
    }
    return loadedSeriesCount > 0;
  } catch (err) {
    window.__HISTORICAL_PRICES_JSON_LOADED__ = false;
    if (typeof AppLogger !== 'undefined') {
      AppLogger.info('Portfolio', `Could not load ./historical_prices.json (${err.message}); charts will remain empty until real data is available.`);
    }
    return false;
  }
}

// ============================================================================
// 5. STATE PERSISTENCE, TICKER MIGRATION & PORTFOLIO RECALCULATION ENGINE
// ============================================================================
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

  if (!state.settings) state.settings = createEmptyState().settings;
  if (!state.settings.collapsedSectors) state.settings.collapsedSectors = {};
  if (!state.prices) state.prices = {};
  if (!state.historicalPrices) state.historicalPrices = {};
  if (!state.fundamentals) state.fundamentals = {};
  if (!state.transactions) state.transactions = [];
  if (!state.dividends) state.dividends = [];
  if (!state.watchlist) state.watchlist = [];

  if (!state.settings.yahooDefaultApplied) {
    state.settings.apiProvider = 'yahoo';
    state.settings.yahooDefaultApplied = true;
  }

  // Auto-normalize any legacy tickers in transactions, dividends, watchlist & caches
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

  ['prices', 'historicalPrices', 'fundamentals'].forEach(mapKey => {
    const mapObj = state[mapKey] || {};
    const normalizedMap = {};
    Object.keys(mapObj).forEach(k => {
      const normKey = MarketAPI.normalizeTicker(k);
      normalizedMap[normKey] = mapObj[k];
    });
    state[mapKey] = normalizedMap;
  });

  // Purge any legacy synthetic/hardcoded hardcoded market snapshot data series from localStorage
  Object.keys(state.historicalPrices).forEach(sym => {
    if (isLegacySyntheticHistory(state.historicalPrices[sym])) {
      delete state.historicalPrices[sym];
    }
  });

  // Ensure static name & sector classification is present for any held or watched tickers (no fake prices/history)
  const activeSymbols = Array.from(new Set([
    ...state.transactions.map(t => t.ticker).filter(Boolean),
    ...state.watchlist.map(w => w.ticker).filter(Boolean)
  ]));
  activeSymbols.forEach(sym => {
    const staticProfile = MarketAPI.getStaticProfile(sym);
    const existingFund = state.fundamentals[sym] || {};
    state.fundamentals[sym] = {
      ...existingFund,
      name: (existingFund.name && existingFund.name !== sym) ? existingFund.name : staticProfile.name,
      sector: (existingFund.sector && existingFund.sector !== 'Equities') ? existingFund.sector : staticProfile.sector,
      currency: existingFund.currency || staticProfile.currency
    };
  });

  state.settings.appVersion = (typeof APP_VERSION_MANIFEST !== 'undefined') ? APP_VERSION_MANIFEST.appVersion : '2.4.1';
  state.settings.buildId = (typeof APP_VERSION_MANIFEST !== 'undefined') ? APP_VERSION_MANIFEST.buildId : '20261019_1950';

  if (state.settings.darkMode === false) {
    document.documentElement.classList.remove('dark');
  } else {
    document.documentElement.classList.add('dark');
  }

  if (typeof AppLogger !== 'undefined') {
    AppLogger.info('Portfolio', `State initialized (${state.transactions.length} transactions, ${state.watchlist.length} watchlist items, ${Object.keys(state.historicalPrices).length} cached historical series).`);
  }

  recalculatePortfolio();
  saveState();

  // Asynchronously load ./historical_prices.json on startup
  loadHistoricalPricesFromJson(true);
}

function saveState() {
  if (!state) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.warn('Could not save state to localStorage:', e);
  }
}

function recalculatePortfolio() {
  let runningCash = Fin.round(state.initialCash || 0, 2);
  let totalRealizedPnL = 0;
  const holdingsMap = {};

  const sortedTx = [...state.transactions].sort((a, b) => new Date(a.date) - new Date(b.date));

  sortedTx.forEach(tx => {
    const fees = Fin.round(tx.fees || 0, 2);
    const shares = Fin.round(tx.shares || 0, 4);
    const price = Fin.round(tx.price || 0, 4);

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
      const staticProfile = MarketAPI.getStaticProfile(ticker);
      const priceObj = state.prices[ticker] || { price: h.avgCost, change: 0, changePct: 0 };
      const currentPrice = Fin.round(priceObj.price || h.avgCost, 4);
      const marketValue = Fin.round(h.shares * currentPrice, 2);
      const unrealizedGain = Fin.round(marketValue - h.totalCostBasis, 2);
      const unrealizedGainPct = h.totalCostBasis > 0 ? Fin.round((unrealizedGain / h.totalCostBasis) * 100, 2) : 0;
      const yieldOnCost = h.totalCostBasis > 0 ? Fin.round((h.totalDividends / h.totalCostBasis) * 100, 2) : 0;
      const fund = state.fundamentals[ticker] || {};
      const currency = priceObj.currency || fund.currency || staticProfile.currency;
      const companyName = (fund.name && fund.name !== ticker) ? fund.name : staticProfile.name;
      const rawSector = (fund.sector && fund.sector !== 'Equities') ? fund.sector : staticProfile.sector;
      const sector = MarketAPI.isEtfSector(rawSector, ticker, companyName) ? 'Index ETF' : (rawSector || 'Equities');

      activeHoldings.push({
        ticker,
        companyName,
        sector,
        currency,
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

  // Sort active holdings with ETFs at the top, then alphabetical sector (A-Z), then alphabetical ticker (A-Z)
  activeHoldings.sort(compareHoldingsBySectorAndTicker);

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
      Currency: h.currency || 'USD',
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
      Ticker: t.ticker || 'CASH',
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
        Sector: w.sector || f.sector || 'Equities',
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
          state.fundamentals[t] = {
            ...(state.fundamentals[t] || {}),
            name: row['Company Name'] || state.fundamentals[t]?.name || staticProfile.name,
            sector: row['Sector'] || state.fundamentals[t]?.sector || staticProfile.sector,
            currency
          };
        });
      }

      if (wb.SheetNames.includes('Dividends')) {
        const rawDiv = XLSX.utils.sheet_to_json(wb.Sheets['Dividends']);
        state.dividends = rawDiv.map((row, idx) => ({
          id: row['Dividend ID'] || `DIV-${idx + 1}`,
          ticker: MarketAPI.normalizeTicker(row['Ticker'] || ''),
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
        state.historicalPrices = {};
        Object.entries(importedHist).forEach(([sym, series]) => {
          if (!isLegacySyntheticHistory(series)) {
            state.historicalPrices[sym] = series.sort((a, b) => a.month.localeCompare(b.month));
          }
        });
      }

      recalculatePortfolio();
      saveState();
      renderAll();

      // Reload ./historical_prices.json so any real fetched series in historical_prices.json are merged
      loadHistoricalPricesFromJson(true);

      if (typeof AppLogger !== 'undefined') {
        AppLogger.action('Excel-IO', `Restored workbook: ${state.transactions.length} transactions, ${portfolio.activeHoldings.length} active holdings, ${state.watchlist.length} watchlist items, ${Object.keys(state.historicalPrices).length} real historical series.`);
      }
      if (statusMsg) statusMsg.innerHTML = '<span class="text-emerald-500 font-bold"><i class="fa-solid fa-check"></i> Workbook restored!</span>';
      showToast('Portfolio restored from Excel backup!', 'success');
    } catch (err) {
      if (typeof AppLogger !== 'undefined') AppLogger.error('Excel-IO', `Excel restore error: ${err.message}`, err);
      if (statusMsg) statusMsg.innerHTML = `<span class="text-rose-500 font-bold">${err.message}</span>`;
      showToast('Restore failed: ' + err.message, 'error');
    }
  };
  reader.readAsArrayBuffer(file);
}

window.STORAGE_KEY = STORAGE_KEY;
window.createEmptyState = createEmptyState;
window.isLegacySyntheticHistory = isLegacySyntheticHistory;
window.compareHoldingsBySectorAndTicker = compareHoldingsBySectorAndTicker;
window.loadHistoricalPricesFromJson = loadHistoricalPricesFromJson;
window.initAppState = initAppState;
window.saveState = saveState;
window.recalculatePortfolio = recalculatePortfolio;
window.exportPortfolioToExcel = exportPortfolioToExcel;
window.restorePortfolioFromExcel = restorePortfolioFromExcel;
