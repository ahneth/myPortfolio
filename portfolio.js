/**
 * @file portfolio.js
 * @module PortfolioEngineAndExcelIO
 * @version 2.3.2
 * @build 20261018_2130
 * @description Application state persistence, WACB & P&L accounting engine, and SheetJS 6-worksheet Excel backup/restore.
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
      yahooDefaultApplied: true
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

  // Ensure schema completeness
  if (!state.settings) state.settings = createEmptyState().settings;
  if (!state.prices) state.prices = {};
  if (!state.historicalPrices) state.historicalPrices = {};
  if (!state.fundamentals) state.fundamentals = {};
  if (!state.transactions) state.transactions = [];
  if (!state.dividends) state.dividends = [];
  if (!state.watchlist) state.watchlist = [];

  // Automatically enable Yahoo Finance global provider if not yet migrated
  if (!state.settings.yahooDefaultApplied) {
    state.settings.apiProvider = 'yahoo';
    state.settings.yahooDefaultApplied = true;
    state.settings.buildId = (typeof APP_VERSION_MANIFEST !== 'undefined' ? APP_VERSION_MANIFEST.buildId : '20261018_2130');
  }

  // Auto-normalize any legacy tickers in transactions, dividends, watchlist & caches (e.g. 2800.HKG -> 2800.HK)
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

  if (state.settings.darkMode === false) {
    document.documentElement.classList.remove('dark');
  } else {
    document.documentElement.classList.add('dark');
  }

  // Ensure 2800.HK, VOO, and any held/watched tickers in VERIFIED_MARKET_DATA have quotes, history & fundamentals ready
  const seedTickers = Array.from(new Set([
    '2800.HK', 'VOO',
    ...state.transactions.map(t => t.ticker).filter(Boolean),
    ...state.watchlist.map(w => w.ticker).filter(Boolean)
  ]));
  const targetBuildId = (typeof APP_VERSION_MANIFEST !== 'undefined') ? APP_VERSION_MANIFEST.buildId : '20261018_2130';
  const buildChanged = state.settings.buildId !== targetBuildId;
  seedTickers.forEach(sym => {
    const vd = (typeof VERIFIED_MARKET_DATA !== 'undefined') ? VERIFIED_MARKET_DATA[sym] : null;
    if (vd) {
      if (!state.prices[sym] || !state.prices[sym].price) {
        state.prices[sym] = { ...vd.quote, lastUpdated: new Date().toISOString() };
      }
      const existingHist = state.historicalPrices[sym] || [];
      const vdFirst = (vd.history && vd.history[0]) ? vd.history[0] : null;
      const existingFirstMatch = (vdFirst && existingHist.length > 0)
        ? existingHist.find(r => r.month === vdFirst.month)
        : null;
      const hasDiscrepancy = Boolean(
        vdFirst && existingFirstMatch && Math.abs(Number(existingFirstMatch.close) - Number(vdFirst.close)) > 0.5
      );
      if (existingHist.length < 6 || buildChanged || hasDiscrepancy) {
        state.historicalPrices[sym] = [...(vd.history || [])];
      }
      if (!state.fundamentals[sym] || !state.fundamentals[sym].name) {
        state.fundamentals[sym] = { ...vd.fundamentals, ...(state.fundamentals[sym] || {}) };
      }
    }
  });
  state.settings.buildId = targetBuildId;
  if (typeof AppLogger !== 'undefined') {
    AppLogger.info('Portfolio', `State initialized (${state.transactions.length} transactions, ${state.watchlist.length} watchlist items, ${Object.keys(state.historicalPrices).length} historical series).`);
  }

  if (state.watchlist.length === 0 && state.transactions.length === 0) {
    state.watchlist = [
      { ticker: '2800.HK', name: 'Tracker Fund of Hong Kong', sector: 'Index ETF', targetBuyPrice: 23.50 },
      { ticker: 'VOO', name: 'Vanguard S&P 500 ETF', sector: 'Index ETF', targetBuyPrice: 680.00 }
    ];
  }

  recalculatePortfolio();
  saveState();
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
      const priceObj = state.prices[ticker] || { price: h.avgCost, change: 0, changePct: 0 };
      const currentPrice = Fin.round(priceObj.price || h.avgCost, 4);
      const marketValue = Fin.round(h.shares * currentPrice, 2);
      const unrealizedGain = Fin.round(marketValue - h.totalCostBasis, 2);
      const unrealizedGainPct = h.totalCostBasis > 0 ? Fin.round((unrealizedGain / h.totalCostBasis) * 100, 2) : 0;
      const yieldOnCost = h.totalCostBasis > 0 ? Fin.round((h.totalDividends / h.totalCostBasis) * 100, 2) : 0;
      const fund = state.fundamentals[ticker] || {};
      const currency = priceObj.currency || fund.currency || (ticker.endsWith('.HK') ? 'HKD' : (ticker.endsWith('.L') ? 'GBp' : 'USD'));

      activeHoldings.push({
        ticker,
        companyName: fund.name || ticker,
        sector: fund.sector || (ticker === '2800.HK' ? 'Index ETF' : 'Equities'),
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
          if ((row['On Watchlist'] || 'YES').toString().toUpperCase() !== 'NO' && Number(row['Target Buy Price ($)']) > 0) {
            state.watchlist.push({
              ticker: t,
              name: row['Company Name'] || t,
              sector: row['Sector'] || 'Equities',
              targetBuyPrice: Number(row['Target Buy Price ($)']) || 0
            });
          }
          state.fundamentals[t] = {
            name: row['Company Name'] || t,
            sector: row['Sector'] || 'Equities',
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
          const t = MarketAPI.normalizeTicker(row['Ticker'] || '');
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

      // Reconcile against VERIFIED_MARKET_DATA so stale synthetic prices in older .xlsx files (e.g. 1378.HK at $20.34 in 2023-11) are automatically corrected
      if (typeof VERIFIED_MARKET_DATA !== 'undefined') {
        Object.keys(VERIFIED_MARKET_DATA).forEach(sym => {
          const vd = VERIFIED_MARKET_DATA[sym];
          if (!vd || !Array.isArray(vd.history) || vd.history.length === 0) return;
          const imported = state.historicalPrices[sym] || [];
          const vdFirst = vd.history[0];
          const impMatch = imported.find(r => r.month === vdFirst.month);
          if (imported.length < 6 || (impMatch && Math.abs(Number(impMatch.close) - Number(vdFirst.close)) > 0.5)) {
            state.historicalPrices[sym] = [...vd.history];
          }
        });
      }

      recalculatePortfolio();
      saveState();
      renderAll();

      if (typeof AppLogger !== 'undefined') {
        AppLogger.action('Excel-IO', `Restored workbook: ${state.transactions.length} transactions, ${portfolio.activeHoldings.length} active holdings, ${state.watchlist.length} watchlist items, ${Object.keys(state.historicalPrices).length} historical series.`);
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
window.initAppState = initAppState;
window.saveState = saveState;
window.recalculatePortfolio = recalculatePortfolio;
window.exportPortfolioToExcel = exportPortfolioToExcel;
window.restorePortfolioFromExcel = restorePortfolioFromExcel;
