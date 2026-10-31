
// Automatically purge stale Service Worker caches from older builds so updated scripts & dividend schedules load immediately
if (typeof window !== 'undefined' && 'caches' in window) {
  caches.keys().then(keys => {
    keys.forEach(k => {
      if (k !== 'myportfolio-cache-v3.1.2-20261031_1955') {
        caches.delete(k).catch(() => {});
      }
    });
  }).catch(() => {});
}
if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(regs => {
    regs.forEach(reg => reg.update().catch(() => {}));
  }).catch(() => {});
}

/**
 * @file app.js
 * @module AppUIController
 * @version 3.1.2
 * @build 20261031_1955
 * @description Main UI controller, Holdings & Watchlist tables with 52W/MoM/QoQ/YoY + Dividend Ex-Date/Yield +
 *   Trend Regime + 0-100 Buy/Sell Signal badges, Auto-Detected 2018+ Dividend Backfill, News & Catalysts Tab,
 *   Smart Cash Deployment & Rebalancing Simulator, Nominal/Real XIRR KPIs, and Full Settings Parameter Customizer.
 */

var CURATED_BASELINE_NEWS = [
  {
    id: 'curated_2800_div',
    ticker: '2800.HK',
    companyName: 'Tracker Fund of Hong Kong',
    sector: 'Index ETF',
    title: 'Tracker Fund of Hong Kong (2800.HK) Confirms Semi-Annual Final Dividend Distribution and Strong ETF Liquidity',
    publisher: 'HKEXnews / Hang Seng Investment',
    publishedAt: '2026-10-29T09:30:00Z',
    url: 'https://www.hsvm.com/en/etf/2800',
    sourceType: 'HKEXnews',
    catalyst: 'DIVIDEND',
    sentimentScore: 0.65,
    sentimentLabel: 'BULLISH',
    summary: 'Semi-annual distribution declared for unitholders of record prior to late-October ex-dividend date.'
  },
  {
    id: 'curated_0002_div',
    ticker: '0002.HK',
    companyName: 'CLP Holdings Ltd',
    sector: 'Utilities',
    title: 'CLP Holdings (0002.HK) Declares Third Interim Dividend and Reports Resilient Hong Kong & Australia Operations',
    publisher: 'South China Morning Post',
    publishedAt: '2026-10-28T08:15:00Z',
    url: 'https://www.clpgroup.com/en/investors.html',
    sourceType: 'CorporateRelease',
    catalyst: 'DIVIDEND',
    sentimentScore: 0.72,
    sentimentLabel: 'BULLISH',
    summary: 'Quarterly dividend cadence maintained alongside clean energy grid investments in Hong Kong.'
  },
  {
    id: 'curated_2318_earn',
    ticker: '2318.HK',
    companyName: 'Ping An Insurance (Group) Co of China Ltd',
    sector: 'Financials',
    title: 'Ping An Insurance (2318.HK) Q3 Operating Profit Beats Consensus on Strong Life & Health New Business Value Growth',
    publisher: 'Reuters Financial',
    publishedAt: '2026-10-27T11:20:00Z',
    url: 'https://group.pingan.com/investor_relations.html',
    sourceType: 'Reuters',
    catalyst: 'EARNINGS',
    sentimentScore: 0.80,
    sentimentLabel: 'BULLISH',
    summary: 'Life & Health NBV surged double digits YoY while core solvency ratios remained well above regulatory floors.'
  },
  {
    id: 'curated_0857_buyback',
    ticker: '0857.HK',
    companyName: 'PetroChina Co Ltd',
    sector: 'Energy',
    title: 'PetroChina (0857.HK) Sustains High Free Cash Flow Generation and Semi-Annual Dividend Payout Ratio',
    publisher: 'AAStocks Financial News',
    publishedAt: '2026-10-26T06:45:00Z',
    url: 'http://www.petrochina.com.cn/ptr/investor/',
    sourceType: 'AAStocks',
    catalyst: 'DIVIDEND',
    sentimentScore: 0.55,
    sentimentLabel: 'BULLISH',
    summary: 'Natural gas segment growth offsets crude volatility, supporting attractive H-share dividend yield.'
  },
  {
    id: 'curated_1088_div',
    ticker: '1088.HK',
    companyName: 'China Shenhua Energy Co Ltd',
    sector: 'Energy',
    title: 'China Shenhua Energy (1088.HK) Reaffirms High-Payout Dividend Policy Backed by Integrated Coal-to-Power Cash Flows',
    publisher: 'HKEXnews',
    publishedAt: '2026-10-25T10:00:00Z',
    url: 'http://www.csec.com/shenhuaChinaEn/',
    sourceType: 'HKEXnews',
    catalyst: 'DIVIDEND',
    sentimentScore: 0.60,
    sentimentLabel: 'BULLISH',
    summary: 'Integrated coal, power, railway, and port model provides high earnings visibility for income investors.'
  },
  {
    id: 'curated_voo_macro',
    ticker: 'VOO',
    companyName: 'Vanguard S&P 500 ETF',
    sector: 'Index ETF',
    title: 'Vanguard S&P 500 ETF (VOO) Sees Continued Institutional Inflows as S&P 500 Earnings Expand',
    publisher: 'Yahoo Finance',
    publishedAt: '2026-10-24T16:10:00Z',
    url: 'https://investor.vanguard.com/investment-products/etfs/profile/voo',
    sourceType: 'YahooFinance',
    catalyst: 'MACRO / ETF',
    sentimentScore: 0.50,
    sentimentLabel: 'BULLISH',
    summary: 'Ultra-low 0.03% expense ratio and quarterly distributions keep VOO a core global equity anchor.'
  }
];

function renderAll() {
  try {
    if (!portfolio) recalculatePortfolio();
  } catch (err) {
    if (typeof AppLogger !== 'undefined') AppLogger.error('Portfolio', `recalculatePortfolio failed: ${err.message}`, err);
  }
  try { renderApiStatusUI(); } catch (err) { if (typeof AppLogger !== 'undefined') AppLogger.error('UI', `renderApiStatusUI failed: ${err.message}`, err); }
  try { renderQuantSettingsUI(); } catch (err) { if (typeof AppLogger !== 'undefined') AppLogger.error('UI', `renderQuantSettingsUI failed: ${err.message}`, err); }
  try { renderKPIs(); } catch (err) { if (typeof AppLogger !== 'undefined') AppLogger.error('UI', `renderKPIs failed: ${err.message}`, err); }
  try { populateHistorySelector(); } catch (err) { if (typeof AppLogger !== 'undefined') AppLogger.error('UI', `populateHistorySelector failed: ${err.message}`, err); }
  try { renderHoldingsTable(); } catch (err) { if (typeof AppLogger !== 'undefined') AppLogger.error('UI', `renderHoldingsTable failed: ${err.message}`, err); }
  try { renderTransactionsTable(); } catch (err) { if (typeof AppLogger !== 'undefined') AppLogger.error('UI', `renderTransactionsTable failed: ${err.message}`, err); }
  try { renderDividendsTable(); } catch (err) { if (typeof AppLogger !== 'undefined') AppLogger.error('UI', `renderDividendsTable failed: ${err.message}`, err); }
  try { renderWatchlistAndFundamentals(); } catch (err) { if (typeof AppLogger !== 'undefined') AppLogger.error('UI', `renderWatchlistAndFundamentals failed: ${err.message}`, err); }
  try { renderNewsTab(); } catch (err) { if (typeof AppLogger !== 'undefined') AppLogger.error('UI', `renderNewsTab failed: ${err.message}`, err); }
  try { renderCharts(); } catch (err) { if (typeof AppLogger !== 'undefined') AppLogger.error('Charts', `renderCharts failed: ${err.message}`, err); }
  try { updateTabCounters(); } catch (err) { if (typeof AppLogger !== 'undefined') AppLogger.error('UI', `updateTabCounters failed: ${err.message}`, err); }
  try { renderVersionRegistryUI(); } catch (err) { if (typeof AppLogger !== 'undefined') AppLogger.error('UI', `renderVersionRegistryUI failed: ${err.message}`, err); }
  try {
    if (typeof AppLogger !== 'undefined') {
      AppLogger.updateLogBadgesAndUI();
      AppLogger.renderHealthCheckPanel();
    }
  } catch (_) {}
}

function renderVersionRegistryUI() {
  if (typeof APP_VERSION_MANIFEST === 'undefined') return;
  const vBadge = document.getElementById('app-version-badge');
  if (vBadge) {
    vBadge.textContent = `v${APP_VERSION_MANIFEST.appVersion} (${APP_VERSION_MANIFEST.buildId})`;
  }
  const pill = document.getElementById('settings-version-pill');
  if (pill) {
    pill.textContent = `v${APP_VERSION_MANIFEST.appVersion} • Build ${APP_VERSION_MANIFEST.buildId}`;
  }
  const folderLbl = document.getElementById('settings-drive-folder-label');
  if (folderLbl) {
    folderLbl.textContent = APP_VERSION_MANIFEST.buildId;
  }
  const footerVer = document.getElementById('footer-version-text');
  if (footerVer) {
    footerVer.textContent = `v${APP_VERSION_MANIFEST.appVersion} (Build ${APP_VERSION_MANIFEST.buildId})`;
  }
  const modBody = document.getElementById('version-registry-tbody');
  if (modBody) {
    modBody.innerHTML = Object.entries(APP_VERSION_MANIFEST.modules).map(([file, meta]) => `
      <tr class="border-b border-slate-200/60 dark:border-slate-800 text-xs">
        <td class="py-2 px-3 font-mono font-bold text-brand-600 dark:text-brand-400">${file}</td>
        <td class="py-2 px-3 font-mono font-semibold text-slate-800 dark:text-slate-200">v${meta.version}</td>
        <td class="py-2 px-3 font-mono text-slate-500">${meta.updated}</td>
        <td class="py-2 px-3 text-slate-600 dark:text-slate-300">${meta.role}</td>
      </tr>
    `).join('');
  }
  const logList = document.getElementById('version-changelog-list');
  if (logList && Array.isArray(APP_VERSION_MANIFEST.changelog)) {
    logList.innerHTML = APP_VERSION_MANIFEST.changelog.map(item => `
      <div class="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <span class="font-mono font-bold text-purple-600 dark:text-purple-400">v${item.version}</span>
          <span class="font-mono text-[11px] text-slate-400 ml-1.5">[${item.buildId}]</span>
          <p class="text-slate-600 dark:text-slate-300 mt-0.5">${item.summary}</p>
        </div>
      </div>
    `).join('');
  }
}

async function selectStockForInlineChart(tabType, rawTicker, scrollIntoView = false) {
  const ticker = MarketAPI.normalizeTicker(rawTicker);
  if (!ticker) return;

  if (tabType === 'holdings') {
    window.__holdingsChartManuallyClosed = false;
    selectedHoldingsTicker = ticker;
    const heldItem = portfolio?.activeHoldings?.find(h => h.ticker === ticker);
    if (heldItem && state?.settings?.collapsedSectors) {
      const secKey = getCanonicalHoldingsSector(heldItem);
      state.settings.collapsedSectors[secKey] = false;
    }
    renderHoldingsTable();
    renderInlineStockChart('holdings');
  } else {
    window.__watchlistChartManuallyClosed = false;
    selectedWatchlistTicker = ticker;
    renderWatchlistAndFundamentals();
    renderInlineStockChart('watchlist');
  }

  const cardId = tabType === 'holdings' ? 'holdings-stock-chart-card' : 'watchlist-stock-chart-card';
  const cardEl = document.getElementById(cardId);
  if (scrollIntoView && cardEl) {
    setTimeout(() => {
      cardEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 50);
  }

  if ((!state.historicalPrices[ticker] || state.historicalPrices[ticker].length === 0) && MarketAPI.hasKey()) {
    try {
      showToast(`Fetching monthly price history & dividends for ${ticker}...`, 'info');
      const history = await MarketAPI.fetchMonthlyHistory(ticker);
      if (Array.isArray(history) && history.length > 0) {
        state.historicalPrices[ticker] = history;
        recalculatePortfolio();
        saveState();
        renderInlineStockChart(tabType);
      }
    } catch (e) {
      showToast(`API notice: ${e.message}`, 'error');
    }
  }
}
window.selectStockForInlineChart = selectStockForInlineChart;

function renderApiStatusUI() {
  const providerRaw = MarketAPI.getProvider();
  const providerNames = {
    yahoo: 'Yahoo Finance (Global)',
    alphavantage: 'Alpha Vantage',
    twelvedata: 'Twelve Data',
    finnhub: 'Finnhub'
  };
  const hasKey = MarketAPI.hasKey();
  const dot = document.getElementById('api-status-dot');
  const text = document.getElementById('api-status-text');
  const banner = document.getElementById('api-setup-banner');
  const syncLabel = document.getElementById('last-api-sync-label');
  const optBadge = document.getElementById('api-key-optional-badge');
  const keyInput = document.getElementById('setting-api-key');

  if (hasKey) {
    if (dot) dot.className = 'w-2.5 h-2.5 rounded-full bg-emerald-500';
    if (text) text.textContent = `API: ${providerNames[providerRaw] || providerRaw.toUpperCase()} Ready`;
    if (banner) banner.classList.add('hidden');
  } else {
    if (dot) dot.className = 'w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse';
    if (text) text.textContent = 'API Key Needed';
    if (banner) banner.classList.remove('hidden');
  }

  if (optBadge && keyInput) {
    if (providerRaw === 'yahoo') {
      optBadge.textContent = '(Not required for Yahoo Finance)';
      optBadge.className = 'text-[11px] font-normal text-emerald-500';
      keyInput.placeholder = 'No API key required for Yahoo Finance...';
    } else {
      optBadge.textContent = `(Required for ${providerNames[providerRaw]})`;
      optBadge.className = 'text-[11px] font-normal text-amber-500';
      keyInput.placeholder = `Paste your ${providerNames[providerRaw]} API Key...`;
    }
  }

  if (syncLabel && state.settings.lastApiSync) {
    syncLabel.textContent = `Last synced: ${new Date(state.settings.lastApiSync).toLocaleTimeString()}`;
  }

  const provSelect = document.getElementById('setting-api-provider');
  const devSelect = document.getElementById('setting-device-override');
  if (keyInput && document.activeElement !== keyInput) keyInput.value = state.settings.apiKey || '';
  if (provSelect) provSelect.value = state.settings.apiProvider || 'yahoo';
  if (devSelect) devSelect.value = state.settings.deviceOverride || 'auto';
}

function renderKPIs() {
  const baseCurr = portfolio.baseCurrency || state.settings.currency || 'HKD';
  document.getElementById('kpi-portfolio-value').textContent = Fin.currency(portfolio.totalPortfolioValue, false, baseCurr);
  document.getElementById('kpi-cash-balance').textContent = Fin.currency(portfolio.cashBalance, false, baseCurr);

  const cashPct = portfolio.totalPortfolioValue > 0
    ? Fin.round((Math.max(0, portfolio.cashBalance) / portfolio.totalPortfolioValue) * 100, 1)
    : 0;
  document.getElementById('kpi-cash-pct').textContent = `${cashPct}% of total`;
  document.getElementById('kpi-cost-basis').textContent = Fin.currency(portfolio.totalStockCostBasis, false, baseCurr);

  const uEl = document.getElementById('kpi-unrealized-val');
  const uPctEl = document.getElementById('kpi-unrealized-pct');
  uEl.textContent = Fin.currency(portfolio.totalUnrealizedGain, true, baseCurr);
  uPctEl.textContent = Fin.percent(portfolio.totalUnrealizedGainPct, true);

  const uPositive = portfolio.totalUnrealizedGain >= 0;
  uEl.className = `mt-1.5 sm:mt-2 text-lg sm:text-xl font-bold num-font tracking-tight ${uPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`;
  uPctEl.className = `mt-1 flex items-center text-[11px] font-semibold num-font ${uPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`;

  const rEl = document.getElementById('kpi-realized-val');
  rEl.textContent = Fin.currency(portfolio.totalRealizedPnL, true, baseCurr);
  rEl.className = `mt-1.5 sm:mt-2 text-lg sm:text-xl font-bold num-font tracking-tight ${portfolio.totalRealizedPnL >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`;

  document.getElementById('kpi-dividends-val').textContent = Fin.currency(portfolio.totalDividendsEarned, false, baseCurr);
  const detCount = portfolio.detectedDividends?.length || 0;
  document.getElementById('kpi-dividends-count').innerHTML = detCount > 0
    ? `${state.dividends.length} logged • <button onclick="switchTab('dividends')" class="text-amber-500 font-bold underline">${detCount} detected</button>`
    : `${state.dividends.length} payouts`;

  // XIRR & Real Inflation-Adjusted XIRR Display
  const nomXirrEl = document.getElementById('stat-xirr-nominal');
  const realXirrEl = document.getElementById('stat-xirr-real');
  const infBadgeEl = document.getElementById('stat-inflation-badge');
  if (nomXirrEl) {
    nomXirrEl.textContent = portfolio.nominalXirrPct !== null ? Fin.percent(portfolio.nominalXirrPct, true) : 'N/A';
    nomXirrEl.className = `text-xl font-bold num-font ${(portfolio.nominalXirrPct || 0) >= 0 ? 'text-emerald-500' : 'text-rose-500'}`;
  }
  if (realXirrEl) {
    realXirrEl.textContent = portfolio.realXirrPct !== null ? Fin.percent(portfolio.realXirrPct, true) : 'N/A';
    realXirrEl.className = `text-lg font-bold num-font ${(portfolio.realXirrPct || 0) >= 0 ? 'text-indigo-500' : 'text-rose-500'}`;
  }
  if (infBadgeEl) {
    infBadgeEl.textContent = `CPI ${portfolio.inflationRatePct}%`;
  }

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
          ${Fin.percent(top.unrealizedGainPct)} (${Fin.currency(top.unrealizedGain, true, top.currency)})
        </div>
      </div>
      <div class="text-right">
        <span class="text-[11px] text-slate-400 block">Signal (${top.signalScore}/100)</span>
        <span class="text-xs font-bold num-font text-brand-500">${top.signalLabel}</span>
      </div>
    `;
  } else {
    topBox.innerHTML = `<span class="text-xs text-slate-400">No active holdings yet</span>`;
  }

  // Yield on Cost & Forward Annual Dividend
  const avgYoc = portfolio.totalStockCostBasis > 0
    ? Fin.round((portfolio.totalDividendsEarned / portfolio.totalStockCostBasis) * 100, 2)
    : 0;
  const fwdYoc = portfolio.totalStockCostBasis > 0
    ? Fin.round((portfolio.estimatedAnnualForwardDivBase / portfolio.totalStockCostBasis) * 100, 2)
    : 0;
  const dispYoc = avgYoc > 0 ? avgYoc : fwdYoc;
  document.getElementById('stat-avg-yoc').textContent = `${dispYoc.toFixed(2)}%`;

  // Watchlist & Signal Alerts
  const alertBox = document.getElementById('watchlist-alerts-box');
  const targetHits = state.watchlist.filter(w => {
    const cur = state.prices[w.ticker]?.price || 0;
    return cur > 0 && cur <= w.targetBuyPrice;
  });
  const strongBuys = portfolio.activeHoldings.filter(h => h.signalScore >= Number(state.settings?.signalStrongBuyMin ?? 78));

  if (targetHits.length > 0 || strongBuys.length > 0) {
    alertBox.innerHTML = `
      <div class="space-y-1.5">
        ${targetHits.length > 0 ? `
          <div class="flex items-center gap-2">
            <span class="px-2 py-0.5 rounded bg-rose-500/20 text-rose-500 font-bold text-[11px] border border-rose-500/30 animate-pulse">
              ${targetHits.length} Target Hit
            </span>
            <span class="text-xs font-semibold text-slate-700 dark:text-slate-300">${targetHits.map(a => a.ticker).join(', ')}</span>
          </div>` : ''}
        ${strongBuys.length > 0 ? `
          <div class="flex items-center gap-2">
            <span class="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-500 font-bold text-[11px] border border-emerald-500/30">
              ${strongBuys.length} Strong Buy Signal
            </span>
            <span class="text-xs font-semibold text-slate-700 dark:text-slate-300">${strongBuys.map(s => s.ticker).join(', ')}</span>
          </div>` : ''}
      </div>
    `;
  } else {
    alertBox.innerHTML = `<span class="text-xs text-slate-400">No target price or strong buy alerts triggered</span>`;
  }
}

function updateTabCounters() {
  document.querySelectorAll('.tab-holdings-count').forEach(el => {
    el.textContent = portfolio.activeHoldings.length;
  });
  document.querySelectorAll('.tab-tx-count').forEach(el => {
    el.textContent = state.transactions.length;
  });
  const detBadge = document.getElementById('nav-div-detected-badge');
  if (detBadge) {
    const cnt = portfolio?.detectedDividends?.length || 0;
    detBadge.textContent = cnt;
    detBadge.classList.toggle('hidden', cnt === 0);
  }
}

function populateHistorySelector() {
  if (portfolio.activeHoldings.length > 0) {
    const stillHeld = portfolio.activeHoldings.some(h => h.ticker === selectedHoldingsTicker);
    if (!stillHeld && !window.__holdingsChartManuallyClosed) {
      selectedHoldingsTicker = portfolio.activeHoldings[0].ticker;
    }
  } else {
    selectedHoldingsTicker = null;
  }

  if (state.watchlist.length > 0) {
    const stillWatched = state.watchlist.some(w => w.ticker === selectedWatchlistTicker);
    if (!stillWatched && !window.__watchlistChartManuallyClosed) {
      selectedWatchlistTicker = state.watchlist[0].ticker;
    }
  } else {
    selectedWatchlistTicker = null;
  }
}

function getCanonicalHoldingsSector(holding) {
  const rawSector = String(holding?.sector || 'Equities').trim();
  if (MarketAPI.isEtfSector(rawSector, holding?.ticker, holding?.companyName)) {
    return 'Index ETF';
  }
  return rawSector || 'Equities';
}

function getSectorIconClass(sectorName, isEtf) {
  if (isEtf) return 'fa-layer-group text-brand-500';
  const s = sectorName.toLowerCase();
  if (s.includes('energy')) return 'fa-bolt-lightning text-amber-500';
  if (s.includes('financial')) return 'fa-building-columns text-indigo-500';
  if (s.includes('health')) return 'fa-notes-medical text-rose-500';
  if (s.includes('industrial')) return 'fa-industry text-sky-500';
  if (s.includes('real estate') || s.includes('property')) return 'fa-city text-purple-500';
  if (s.includes('utilit')) return 'fa-plug-circle-bolt text-cyan-500';
  if (s.includes('tech')) return 'fa-microchip text-emerald-500';
  if (s.includes('consumer')) return 'fa-bag-shopping text-pink-500';
  if (s.includes('comm')) return 'fa-tower-cell text-violet-500';
  return 'fa-folder-tree text-slate-500';
}

function toggleHoldingsSector(sectorName) {
  if (!state.settings.collapsedSectors) state.settings.collapsedSectors = {};
  state.settings.collapsedSectors[sectorName] = !state.settings.collapsedSectors[sectorName];
  saveState();
  renderHoldingsTable();
}
window.toggleHoldingsSector = toggleHoldingsSector;

function setAllHoldingsSectorsCollapsed(collapsed) {
  if (!state.settings.collapsedSectors) state.settings.collapsedSectors = {};
  (portfolio?.activeHoldings || []).forEach(h => {
    const sec = getCanonicalHoldingsSector(h);
    state.settings.collapsedSectors[sec] = Boolean(collapsed);
  });
  saveState();
  renderHoldingsTable();
}
window.setAllHoldingsSectorsCollapsed = setAllHoldingsSectorsCollapsed;

function format52wPositionCell(low52w, high52w, pos52wPct, currency) {
  if (pos52wPct === null || pos52wPct === undefined || isNaN(pos52wPct)) {
    return '<span class="text-slate-400 text-[11px]" title="Sync market data to calculate 52W range position">-</span>';
  }
  const pctClamped = Math.max(0, Math.min(100, Number(pos52wPct)));
  const lowTxt = low52w !== null ? Fin.currency(low52w, false, currency) : '-';
  const highTxt = high52w !== null ? Fin.currency(high52w, false, currency) : '-';
  const badgeTone = pctClamped >= 75
    ? 'text-emerald-600 dark:text-emerald-400'
    : (pctClamped <= 25 ? 'text-amber-600 dark:text-amber-400' : 'text-indigo-600 dark:text-indigo-400');

  return `
    <div class="inline-flex flex-col items-end gap-1 min-w-[74px]" title="Current price is at ${pctClamped.toFixed(1)}% between 52W Low (${lowTxt}) and 52W High (${highTxt})">
      <span class="text-xs font-bold num-font ${badgeTone}">${pctClamped.toFixed(1)}%</span>
      <div class="w-14 h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden relative">
        <div class="h-full rounded-full bg-gradient-to-r from-amber-500 via-indigo-500 to-emerald-500" style="width: ${pctClamped}%"></div>
      </div>
    </div>
  `;
}

function formatPeriodChangeCell(pctVal, periodLabel, refMonth = null) {
  if (pctVal === null || pctVal === undefined || isNaN(pctVal)) {
    return `<span class="text-slate-400 text-[11px]" title="Sync monthly historical data to compute ${periodLabel}">-</span>`;
  }
  const n = Number(pctVal);
  const colorCls = n > 0
    ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
    : (n < 0
        ? 'text-rose-600 dark:text-rose-400 bg-rose-500/10 border-rose-500/20'
        : 'text-slate-500 dark:text-slate-400 bg-slate-500/10 border-slate-500/20');
  const tip = refMonth
    ? `${periodLabel} stock price change vs ${refMonth}: ${Fin.percent(n, true)}`
    : `${periodLabel} stock price change: ${Fin.percent(n, true)}`;
  return `<span class="px-1.5 py-0.5 rounded text-[11px] font-bold num-font border ${colorCls}" title="${tip}">${Fin.percent(n, true)}</span>`;
}

function formatDividendExDateCell(divInfo) {
  if (!divInfo || (!divInfo.trailingYieldPct && !divInfo.nextExDate)) {
    return '<span class="text-slate-400 text-[11px]">-</span>';
  }
  const netYld = Number(divInfo.netYieldPct || divInfo.trailingYieldPct || 0);
  const exDate = divInfo.nextExDate || '-';
  const days = divInfo.daysToExDate;
  const alertWindow = Number(state?.settings?.exDateAlertDays ?? 14);
  const isSoon = days !== null && days >= 0 && days <= alertWindow;
  const exPillCls = isSoon
    ? 'bg-amber-500/20 text-amber-500 border-amber-500/30 animate-pulse'
    : 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20';
  const statusTag = divInfo.nextStatus === 'DECLARED' ? 'Confirmed' : 'Est.';

  return `
    <div class="flex flex-col items-end gap-0.5" title="Trailing Yield: ${divInfo.trailingYieldPct}% | Net Yield (after ${divInfo.withholdingTaxPct}% WHT): ${netYld}% | Cadence: ${divInfo.frequency} | Next Ex-Date: ${exDate} (${statusTag})">
      <span class="text-xs font-bold num-font text-cyan-600 dark:text-cyan-400">${netYld > 0 ? netYld.toFixed(2) + '% Net' : '-'}</span>
      ${exDate !== '-' ? `<span class="px-1.5 py-0.5 rounded text-[10px] font-mono border ${exPillCls}">Ex: ${exDate}${isSoon ? ` (${days}d)` : ''}</span>` : `<span class="text-[10px] text-slate-400">${divInfo.frequency || ''}</span>`}
    </div>
  `;
}

function formatTrendRegimeCell(m) {
  const regime = m?.regime || 'Range-Bound';
  let badgeCls = 'bg-slate-500/10 text-slate-600 dark:text-slate-300 border-slate-500/20';
  if (regime.includes('Strong Uptrend')) badgeCls = 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30';
  else if (regime.includes('Pullback')) badgeCls = 'bg-teal-500/15 text-teal-600 dark:text-teal-400 border-teal-500/30';
  else if (regime.includes('Inflection')) badgeCls = 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border-indigo-500/30';
  else if (regime.includes('Topping')) badgeCls = 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30';
  else if (regime.includes('Downtrend')) badgeCls = 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30';

  const rsiTxt = m?.rsi14 !== null && m?.rsi14 !== undefined ? `RSI ${m.rsi14}` : '';
  const alphaTxt = m?.alpha12mPct !== null && m?.alpha12mPct !== undefined ? ` • α ${Fin.percent(m.alpha12mPct, true)}` : '';

  return `
    <div class="flex flex-col items-end gap-0.5" title="Regime: ${regime} | RSI(14): ${m?.rsi14 ?? '-'} | 12M Regression R²: ${m?.regR2 ?? '-'} | Suggested Stop-Loss: ${m?.suggestedStopLoss ?? '-'}">
      <span class="px-1.5 py-0.5 rounded text-[10px] font-bold border ${badgeCls}">${regime}</span>
      <span class="text-[10px] font-mono text-slate-500 dark:text-slate-400">${rsiTxt}${alphaTxt}</span>
    </div>
  `;
}

function formatSignalBadgeCell(ticker, m) {
  const score = Number(m?.signalScore ?? 50);
  const label = m?.signalLabel || 'HOLD';
  let cls = 'bg-slate-500/15 text-slate-600 dark:text-slate-300 border-slate-500/30';
  if (label === 'STRONG BUY') cls = 'bg-emerald-500 text-white border-emerald-400 shadow-sm shadow-emerald-500/30';
  else if (label === 'ACCUMULATE') cls = 'bg-teal-500/15 text-teal-600 dark:text-teal-400 border-teal-500/30';
  else if (label.includes('TRIM')) cls = 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30';
  else if (label.includes('SELL')) cls = 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30';

  const reasonsTip = (m?.signalReasons || []).join(' • ');
  return `
    <button type="button" onclick="event.stopPropagation(); openSignalDetailModal('${ticker}')" class="px-2 py-1 rounded-lg text-[10px] font-mono font-bold border transition hover:scale-105 ${cls}" title="Click for full 4-Pillar Technical & Qualitative Breakdown: ${reasonsTip}">
      <div>${label}</div>
      <div class="text-[9px] opacity-85">${score}/100</div>
    </button>
  `;
}

window.openSignalDetailModal = function(rawTicker) {
  const ticker = MarketAPI.normalizeTicker(rawTicker);
  const curPrice = state.prices[ticker]?.price || 0;
  const m = computeStockPriceMetrics(ticker, curPrice);
  const f = state.fundamentals[ticker] || {};
  const staticMeta = MarketAPI.getStaticProfile(ticker);
  const curr = state.prices[ticker]?.currency || f.currency || staticMeta.currency || 'HKD';

  const titleEl = document.getElementById('signal-modal-title');
  const bodyEl = document.getElementById('signal-modal-body');
  if (!titleEl || !bodyEl) return;

  titleEl.innerHTML = `<i class="fa-solid fa-Satellite-dish text-brand-500"></i> <span>${ticker} — ${f.name || staticMeta.name} (${m.signalLabel} • ${m.signalScore}/100)</span>`;

  const pb = m.pillarBreakdown || { momentum: 0, trend: 0, valuation: 0, quality: 0 };
  bodyEl.innerHTML = `
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
      <div class="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
        <div class="text-[10px] uppercase text-slate-400 font-semibold">1. Momentum</div>
        <div class="text-base font-bold num-font text-brand-500 mt-0.5">${pb.momentum} pts</div>
        <div class="text-[10px] text-slate-500">RSI(${state.settings.rsiPeriod || 14}): <strong>${m.rsi14 ?? '-'}</strong></div>
      </div>
      <div class="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
        <div class="text-[10px] uppercase text-slate-400 font-semibold">2. Trend Structure</div>
        <div class="text-base font-bold num-font text-indigo-500 mt-0.5">${pb.trend} pts</div>
        <div class="text-[10px] text-slate-500">R²: <strong>${m.regR2 ?? '-'}</strong></div>
      </div>
      <div class="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
        <div class="text-[10px] uppercase text-slate-400 font-semibold">3. Valuation</div>
        <div class="text-base font-bold num-font text-purple-500 mt-0.5">${pb.valuation} pts</div>
        <div class="text-[10px] text-slate-500">P/E: <strong>${f.pe || '-'}</strong> | Fwd: <strong>${f.fwdPe || '-'}</strong></div>
      </div>
      <div class="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
        <div class="text-[10px] uppercase text-slate-400 font-semibold">4. Income &amp; Quality</div>
        <div class="text-base font-bold num-font text-cyan-500 mt-0.5">${pb.quality} pts</div>
        <div class="text-[10px] text-slate-500">Net Yield: <strong>${m.divInfo?.netYieldPct ?? 0}%</strong></div>
      </div>
    </div>

    <div class="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 space-y-2 text-xs">
      <div class="font-bold text-slate-900 dark:text-white flex items-center justify-between">
        <span>Active Buy / Sell Triggers &amp; Qualitative Catalysts</span>
        <span class="px-2 py-0.5 rounded bg-brand-500/15 text-brand-500 font-mono text-[11px]">${m.regime}</span>
      </div>
      <ul class="list-disc list-inside space-y-1 text-slate-600 dark:text-slate-300">
        ${(m.signalReasons || []).map(r => `<li>${r}</li>`).join('')}
      </ul>
    </div>

    <div class="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
      <div class="p-2.5 rounded-lg border border-slate-200 dark:border-slate-700">
        <span class="text-[10px] text-slate-400 block">SMA 20 / 50 / 200</span>
        <span class="font-mono font-semibold text-slate-800 dark:text-slate-200">${m.sma20 ?? '-'} / ${m.sma50 ?? '-'} / ${m.sma200 ?? '-'}</span>
      </div>
      <div class="p-2.5 rounded-lg border border-slate-200 dark:border-slate-700">
        <span class="text-[10px] text-slate-400 block">ATR(14) &amp; Stop-Loss (${state.settings.atrStopMultiplier || 2}x)</span>
        <span class="font-mono font-semibold text-rose-500">${m.suggestedStopLoss ? Fin.currency(m.suggestedStopLoss, false, curr) : '-'} (ATR ${m.atr14 ?? '-'})</span>
      </div>
      <div class="p-2.5 rounded-lg border border-slate-200 dark:border-slate-700">
        <span class="text-[10px] text-slate-400 block">Next Ex-Dividend Date</span>
        <span class="font-mono font-semibold text-cyan-500">${m.divInfo?.nextExDate || 'None'} (${m.divInfo?.frequency || '-'})</span>
      </div>
    </div>
  `;
  openModal('modal-signal-detail');
};

function renderHoldingsTable() {
  const tbody = document.getElementById('holdings-table-body');
  const emptyState = document.getElementById('holdings-empty-state');
  tbody.innerHTML = '';

  if (portfolio.activeHoldings.length === 0) {
    emptyState.classList.remove('hidden');
    const chartCard = document.getElementById('holdings-stock-chart-card');
    if (chartCard) chartCard.classList.add('hidden');
    return;
  }
  emptyState.classList.add('hidden');

  if (!state.settings.collapsedSectors) state.settings.collapsedSectors = {};

  const baseCurr = portfolio?.baseCurrency || state?.settings?.currency || 'HKD';
  const groupsMap = {};
  portfolio.activeHoldings.forEach(h => {
    const secName = getCanonicalHoldingsSector(h);
    const hCurr = h.currency || 'HKD';
    if (!groupsMap[secName]) {
      groupsMap[secName] = {
        sector: secName,
        isEtf: MarketAPI.isEtfSector(secName, h.ticker, h.companyName),
        items: [],
        totalCostBasis: 0,
        totalMarketValue: 0,
        totalMarketValueBase: 0,
        totalUnrealizedGain: 0,
        totalDividends: 0,
        currency: baseCurr
      };
    }
    const g = groupsMap[secName];
    g.items.push(h);
    g.totalCostBasis = Fin.round(g.totalCostBasis + Fin.convertCurrency(h.totalCostBasis, hCurr, baseCurr), 2);
    g.totalMarketValue = Fin.round(g.totalMarketValue + Fin.convertCurrency(h.marketValue, hCurr, baseCurr), 2);
    g.totalMarketValueBase = Fin.round(g.totalMarketValueBase + (h.marketValueBase || Fin.convertCurrency(h.marketValue, hCurr, baseCurr)), 2);
    g.totalUnrealizedGain = Fin.round(g.totalUnrealizedGain + Fin.convertCurrency(h.unrealizedGain, hCurr, baseCurr), 2);
    g.totalDividends = Fin.round(g.totalDividends + Fin.convertCurrency(h.totalDividends || 0, hCurr, baseCurr), 2);
  });

  const sortedGroups = Object.values(groupsMap).sort((a, b) => {
    if (a.isEtf !== b.isEtf) return a.isEtf ? -1 : 1;
    return a.sector.localeCompare(b.sector, undefined, { sensitivity: 'base' });
  });

  sortedGroups.forEach(group => {
    group.items.sort((a, b) => a.ticker.localeCompare(b.ticker, undefined, { sensitivity: 'base' }));

    const isCollapsed = Boolean(state.settings.collapsedSectors[group.sector]);
    const groupUnrealizedPct = group.totalCostBasis > 0
      ? Fin.round((group.totalUnrealizedGain / group.totalCostBasis) * 100, 2)
      : 0;
    const groupYoC = group.totalCostBasis > 0
      ? Fin.round((group.totalDividends / group.totalCostBasis) * 100, 2)
      : 0;
    const weightPct = portfolio.totalStockMarketValue > 0
      ? Fin.round((group.totalMarketValueBase / portfolio.totalStockMarketValue) * 100, 1)
      : 0;
    const groupPnlColor = group.totalUnrealizedGain >= 0 ? 'text-emerald-500' : 'text-rose-500';
    const iconCls = getSectorIconClass(group.sector, group.isEtf);

    const headerTr = document.createElement('tr');
    headerTr.className = `sector-group-header cursor-pointer select-none transition border-y border-slate-200 dark:border-slate-700/80 ${
      group.isEtf
        ? 'bg-emerald-50/70 dark:bg-emerald-950/25 hover:bg-emerald-100/70 dark:hover:bg-emerald-950/40'
        : 'bg-slate-100/85 dark:bg-slate-800/75 hover:bg-slate-200/70 dark:hover:bg-slate-800'
    }`;
    headerTr.setAttribute('data-sector-group', group.sector);
    headerTr.setAttribute('aria-expanded', String(!isCollapsed));
    headerTr.addEventListener('click', () => toggleHoldingsSector(group.sector));

    headerTr.innerHTML = `
      <td colspan="3" class="py-2.5 px-4 sticky-col-mobile ${
        group.isEtf ? 'bg-emerald-50/95 dark:bg-slate-900' : 'bg-slate-100/95 dark:bg-slate-800'
      }">
        <div class="flex items-center gap-2.5">
          <span class="w-5 h-5 rounded-md bg-white/80 dark:bg-slate-700/80 border border-slate-200 dark:border-slate-600 flex items-center justify-center text-[10px] text-slate-600 dark:text-slate-300">
            <i class="fa-solid ${isCollapsed ? 'fa-chevron-right' : 'fa-chevron-down'}"></i>
          </span>
          <i class="fa-solid ${iconCls} text-xs"></i>
          <span class="font-extrabold text-xs sm:text-sm tracking-tight text-slate-900 dark:text-white">${group.sector}</span>
          ${group.isEtf ? '<span class="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-brand-500/15 text-brand-600 dark:text-brand-400 border border-brand-500/30">TOP ETF GROUP</span>' : ''}
          <span class="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600">
            ${group.items.length} ${group.items.length === 1 ? 'ticker' : 'tickers'}
          </span>
          <span class="text-[10px] font-mono text-slate-500 dark:text-slate-400 hidden sm:inline">
            ${weightPct}% weight
          </span>
        </div>
      </td>
      <td class="py-2.5 px-3 text-right num-font text-xs font-bold text-slate-700 dark:text-slate-300">
        ${Fin.currency(group.totalCostBasis, false, group.currency)}
      </td>
      <td colspan="10" class="py-2.5 px-3 text-right text-[11px] text-slate-400 font-medium">
        Sector Subtotal
      </td>
      <td class="py-2.5 px-3 text-right num-font text-xs font-extrabold text-slate-900 dark:text-white">
        ${Fin.currency(group.totalMarketValue, false, group.currency)}
      </td>
      <td class="py-2.5 px-4 text-right num-font text-xs font-bold ${groupPnlColor}">
        <span>${Fin.currency(group.totalUnrealizedGain, true, group.currency)}</span>
        <span class="text-[10px] ml-1">(${Fin.percent(groupUnrealizedPct)})</span>
      </td>
      <td class="py-2.5 px-4 text-right num-font text-xs font-semibold text-slate-500 dark:text-slate-400">
        ${groupYoC.toFixed(2)}%
      </td>
      <td class="py-2.5 px-4 text-center text-[11px] font-semibold text-brand-600 dark:text-brand-400">
        <span>${isCollapsed ? 'Expand' : 'Collapse'}</span>
      </td>
    `;
    tbody.appendChild(headerTr);

    if (!isCollapsed) {
      group.items.forEach(h => {
        const isSelected = selectedHoldingsTicker === h.ticker;
        const tr = document.createElement('tr');
        tr.className = `cursor-pointer transition ${
          isSelected
            ? 'bg-brand-50/70 dark:bg-brand-950/30 border-l-4 border-l-brand-500'
            : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/40'
        }`;
        tr.id = `holding-row-${h.ticker}`;
        tr.setAttribute('data-sector-item', group.sector);
        tr.addEventListener('click', (e) => {
          if (e.target.closest('button')) return;
          selectStockForInlineChart('holdings', h.ticker, true);
        });

        const pnlColor = h.unrealizedGain >= 0 ? 'text-emerald-500' : 'text-rose-500';
        const priceChangeColor = h.priceChange >= 0 ? 'text-emerald-500' : 'text-rose-500';

        tr.innerHTML = `
          <td class="py-3 pl-7 pr-4 sticky-col-mobile">
            <div class="flex items-center gap-2">
              <div class="w-8 h-8 rounded-lg ${isSelected ? 'bg-brand-500 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'} flex items-center justify-center font-bold text-xs shrink-0">
                ${h.ticker.replace(/\..*$/, '').slice(0, 4)}
              </div>
              <div>
                <div class="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <span class="hover:text-brand-500 underline decoration-dotted underline-offset-2">${h.ticker}</span>
                  <span class="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-medium">${h.currency}</span>
                </div>
                <div class="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-[130px] sm:max-w-[180px]">${h.companyName}</div>
              </div>
            </div>
          </td>
          <td class="py-3 px-3 text-right num-font font-medium text-slate-800 dark:text-slate-200">${Fin.shares(h.shares)}</td>
          <td class="py-3 px-3 text-right num-font text-slate-600 dark:text-slate-300">${Fin.currency(h.avgCost, false, h.currency)}</td>
          <td class="py-3 px-3 text-right num-font text-slate-600 dark:text-slate-300">${Fin.currency(h.totalCostBasis, false, h.currency)}</td>
          <td class="py-3 px-3 text-right">
            <div class="font-bold num-font text-slate-900 dark:text-white">${Fin.currency(h.currentPrice, false, h.currency)}</div>
            <div class="text-[11px] num-font ${priceChangeColor}" title="1-Day market price change vs. previous trading close">
              <span class="text-[10px] opacity-75 font-semibold">1D</span> ${Fin.percent(Math.abs(h.priceChangePct) > 40 ? 0 : h.priceChangePct)}
            </div>
          </td>
          <td class="py-3 px-3 text-right num-font text-xs text-slate-600 dark:text-slate-300">
            ${h.low52w !== null && h.low52w !== undefined ? Fin.currency(h.low52w, false, h.currency) : '<span class="text-slate-400 text-[11px]">-</span>'}
          </td>
          <td class="py-3 px-3 text-right num-font text-xs text-slate-600 dark:text-slate-300">
            ${h.high52w !== null && h.high52w !== undefined ? Fin.currency(h.high52w, false, h.currency) : '<span class="text-slate-400 text-[11px]">-</span>'}
          </td>
          <td class="py-3 px-3 text-right">
            ${format52wPositionCell(h.low52w, h.high52w, h.pos52wPct, h.currency)}
          </td>
          <td class="py-3 px-3 text-right">
            ${formatPeriodChangeCell(h.momPct, 'MoM', h.momRefMonth)}
          </td>
          <td class="py-3 px-3 text-right">
            ${formatPeriodChangeCell(h.qoqPct, 'QoQ', h.qoqRefMonth)}
          </td>
          <td class="py-3 px-3 text-right">
            ${formatPeriodChangeCell(h.yoyPct, 'YoY', h.yoyRefMonth)}
          </td>
          <td class="py-3 px-3 text-right">
            ${formatDividendExDateCell(h.divInfo)}
          </td>
          <td class="py-3 px-3 text-right">
            ${formatTrendRegimeCell(h)}
          </td>
          <td class="py-3 px-3 text-center">
            ${formatSignalBadgeCell(h.ticker, h)}
          </td>
          <td class="py-3 px-3 text-right font-bold num-font text-slate-900 dark:text-white">${Fin.currency(h.marketValue, false, h.currency)}</td>
          <td class="py-3 px-3 text-right">
            <div class="font-bold num-font ${pnlColor}">${Fin.currency(h.unrealizedGain, true, h.currency)}</div>
            <div class="text-[11px] num-font ${pnlColor} font-semibold">${Fin.percent(h.unrealizedGainPct)}</div>
          </td>
          <td class="py-3 px-3 text-right">
            <span class="px-2 py-0.5 rounded-full text-xs font-bold num-font ${h.yieldOnCost > 0 ? 'bg-cyan-50 dark:bg-cyan-950/60 text-cyan-600 dark:text-cyan-400' : 'text-slate-400'}">
              ${h.yieldOnCost.toFixed(2)}%
            </span>
          </td>
          <td class="py-3 px-3 text-center">
            <div class="flex items-center justify-center gap-1">
              <button onclick="event.stopPropagation(); selectStockForInlineChart('holdings', '${h.ticker}', true)" class="p-1.5 text-xs ${isSelected ? 'bg-brand-500 text-white' : 'text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-950/40'} rounded" title="Show Price & Trend Chart Below">
                <i class="fa-solid fa-chart-line"></i>
              </button>
              <button onclick="event.stopPropagation(); openTradeModalForTicker('${h.ticker}', 'BUY')" class="p-1.5 text-xs text-brand-600 dark:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-950/40 rounded" title="Buy More">
                <i class="fa-solid fa-cart-plus"></i>
              </button>
              <button onclick="event.stopPropagation(); openTradeModalForTicker('${h.ticker}', 'SELL')" class="p-1.5 text-xs text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded" title="Sell Shares">
                <i class="fa-solid fa-arrow-trend-down"></i>
              </button>
            </div>
          </td>
        `;
        tbody.appendChild(tr);
      });
    }
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
    const tCurr = isCashOnly ? (state.settings.currency || 'HKD') : (state.prices[tx.ticker]?.currency || MarketAPI.getStaticProfile(tx.ticker).currency || 'HKD');
    const totalAmt = isCashOnly
      ? tx.amount
      : (tx.shares * tx.price + (tx.type === 'BUY' ? (tx.fees || 0) : -(tx.fees || 0)));

    let gainCell = '<span class="text-slate-400">-</span>';
    if (tx.type === 'SELL' && tx.realizedGain !== undefined) {
      const color = tx.realizedGain >= 0 ? 'text-emerald-500' : 'text-rose-500';
      gainCell = `<span class="font-bold num-font ${color}">${Fin.currency(tx.realizedGain, true, tCurr)}</span>`;
    }

    tr.innerHTML = `
      <td class="py-3 px-4 font-mono text-slate-500">${tx.date}</td>
      <td class="py-3 px-4">${badgeMap[tx.type] || tx.type}</td>
      <td class="py-3 px-4 font-bold text-slate-900 dark:text-white">${isCashOnly ? 'CASH' : tx.ticker}</td>
      <td class="py-3 px-4 text-right num-font font-medium">${isCashOnly ? '-' : Fin.shares(tx.shares)}</td>
      <td class="py-3 px-4 text-right num-font">${isCashOnly ? '-' : Fin.currency(tx.price, false, tCurr)}</td>
      <td class="py-3 px-4 text-right num-font text-slate-400">${isCashOnly ? '-' : Fin.currency(tx.fees || 0, false, tCurr)}</td>
      <td class="py-3 px-4 text-right font-bold num-font text-slate-900 dark:text-white">${Fin.currency(totalAmt, false, tCurr)}</td>
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
  const tickerFilterEl = document.getElementById('div-log-filter-ticker');
  const searchFilterEl = document.getElementById('div-log-search-text');
  const filterSumEl = document.getElementById('div-log-filter-summary');
  tbody.innerHTML = '';

  const baseCurr = portfolio?.baseCurrency || state.settings.currency || 'HKD';
  const statCum = document.getElementById('div-stat-cumulative');
  const statCash = document.getElementById('div-stat-cash');
  const statCount = document.getElementById('div-stat-count');
  const statDrip = document.getElementById('div-stat-drip');
  const statYoc = document.getElementById('div-stat-yoc');

  if (statCum) statCum.textContent = Fin.currency(portfolio.totalDividendsEarned, false, baseCurr);
  if (statCash) statCash.textContent = `${Fin.currency(portfolio.estimatedAnnualForwardDivBase || 0, false, baseCurr)}/yr`;
  if (statCount) statCount.textContent = `${state.dividends.length} Payouts`;
  if (statDrip) statDrip.textContent = `${state.dividends.length} Payouts`;
  const avgYoc = portfolio.totalStockCostBasis > 0
    ? (portfolio.totalDividendsEarned / portfolio.totalStockCostBasis) * 100
    : 0;
  if (statYoc) statYoc.textContent = `${avgYoc.toFixed(2)}%`;

  // Dynamically populate Filter by Ticker dropdown while preserving current selection
  if (tickerFilterEl) {
    const prevSelected = tickerFilterEl.value || 'ALL';
    const distinctTickers = Array.from(new Set(state.dividends.map(d => d.ticker).filter(Boolean))).sort();
    tickerFilterEl.innerHTML = `<option value="ALL">All Tickers (${state.dividends.length})</option>` +
      distinctTickers.map(t => {
        const cnt = state.dividends.filter(d => d.ticker === t).length;
        return `<option value="${t}" ${t === prevSelected ? 'selected' : ''}>${t} (${cnt})</option>`;
      }).join('');
    if (prevSelected !== 'ALL' && !distinctTickers.includes(prevSelected)) {
      tickerFilterEl.value = 'ALL';
    }
  }

  // Render Auto-Detected 2018-Present Dividend Entitlements Panel (100% Cash)
  const detCard = document.getElementById('detected-dividends-card');
  const detTbody = document.getElementById('detected-dividends-tbody');
  const detSumBadge = document.getElementById('detected-dividends-summary-badge');
  const detectedList = portfolio.detectedDividends || [];

  if (detCard && detTbody) {
    if (detectedList.length === 0) {
      detCard.classList.add('hidden');
      detTbody.innerHTML = '';
      if (detSumBadge) detSumBadge.textContent = '0 Detected';
    } else {
      detCard.classList.remove('hidden');
      const totalDetBase = detectedList.reduce((s, d) => s + Fin.convertCurrency(d.totalAmount, d.currency, baseCurr), 0);
      if (detSumBadge) {
        detSumBadge.textContent = `${detectedList.length} Payouts Detected (${Fin.currency(totalDetBase, false, baseCurr)})`;
      }
      detTbody.innerHTML = detectedList.map(d => `
        <tr class="hover:bg-amber-50/40 dark:hover:bg-amber-950/20 transition text-xs border-b border-slate-100 dark:border-slate-800">
          <td class="py-2.5 px-4 font-mono font-bold text-slate-900 dark:text-white">${d.ticker}</td>
          <td class="py-2.5 px-3 font-mono text-amber-600 dark:text-amber-400 font-semibold">${d.exDate}</td>
          <td class="py-2.5 px-3 font-mono text-slate-500">${d.payDate}</td>
          <td class="py-2.5 px-3 text-right num-font">${Fin.shares(d.eligibleShares)}</td>
          <td class="py-2.5 px-3 text-right num-font">${Fin.currency(d.amountPerShare, false, d.currency)}</td>
          <td class="py-2.5 px-3 text-right font-bold num-font text-emerald-600 dark:text-emerald-400">+${Fin.currency(d.totalAmount, false, d.currency)}</td>
          <td class="py-2.5 px-3 text-center">
            <button type="button" onclick="approveDetectedDividend('${d.id}')" class="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-[10px] shadow-sm transition">
              + Approve (Cash)
            </button>
          </td>
        </tr>
      `).join('');
    }
  }

  // Render Upcoming Ex-Dividend Calendar & Yield Tracker
  const calTbody = document.getElementById('dividend-calendar-tbody');
  if (calTbody) {
    const allSyms = Array.from(new Set([
      ...portfolio.activeHoldings.map(h => h.ticker),
      ...state.watchlist.map(w => w.ticker)
    ])).sort();
    calTbody.innerHTML = allSyms.map(sym => {
      const held = portfolio.activeHoldings.find(h => h.ticker === sym);
      const curP = state.prices[sym]?.price || held?.currentPrice || 0;
      const d = buildDividendScheduleForTicker(sym, null, curP) || {};
      const estCash = held && d.nextEstAmount ? Fin.round(held.shares * d.nextEstAmount * (1 - (d.withholdingTaxPct || 0) / 100), 2) : null;
      return `
        <tr class="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition text-xs border-b border-slate-100 dark:border-slate-800">
          <td class="py-2.5 px-4 font-bold text-slate-900 dark:text-white">
            ${sym}
            ${held ? '<span class="ml-1 text-[9px] px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-500 font-normal">HELD</span>' : ''}
          </td>
          <td class="py-2.5 px-3 text-slate-500">${d.frequency || 'None'}</td>
          <td class="py-2.5 px-3 text-right num-font">${d.ttmDivPerShare ? Fin.currency(d.ttmDivPerShare, false, d.currency) : '-'}</td>
          <td class="py-2.5 px-3 text-right num-font font-semibold text-cyan-500">${d.trailingYieldPct ? d.trailingYieldPct.toFixed(2) + '%' : '-'}</td>
          <td class="py-2.5 px-3 text-right num-font font-bold text-emerald-500">${d.netYieldPct ? d.netYieldPct.toFixed(2) + '%' : '-'}</td>
          <td class="py-2.5 px-3 text-right num-font">${d.divCagr3Y !== null && d.divCagr3Y !== undefined ? Fin.percent(d.divCagr3Y, true) : '-'}</td>
          <td class="py-2.5 px-3 font-mono text-center">${d.nextExDate || '-'}</td>
          <td class="py-2.5 px-3 font-mono text-center text-slate-400">${d.nextPayDate || '-'}</td>
          <td class="py-2.5 px-3 text-right num-font font-bold text-emerald-500">${estCash ? '+' + Fin.currency(estCash, false, d.currency) : '-'}</td>
        </tr>
      `;
    }).join('');
  }

  // Filter Logged Dividends by Ticker and Search Query
  const qTicker = (tickerFilterEl?.value || 'ALL').trim().toUpperCase();
  const qSearch = (searchFilterEl?.value || '').trim().toUpperCase();

  const filtered = state.dividends.filter(div => {
    if (qTicker !== 'ALL' && div.ticker !== qTicker) return false;
    if (qSearch) {
      const hay = `${div.ticker || ''} ${div.payDate || ''} ${div.exDate || ''} ${div.notes || ''}`.toUpperCase();
      if (!hay.includes(qSearch)) return false;
    }
    return true;
  });

  if (filterSumEl) {
    const filteredSumBase = filtered.reduce((s, div) => {
      const dCurr = div.currency || state.prices[div.ticker]?.currency || MarketAPI.getStaticProfile(div.ticker).currency || baseCurr;
      return s + Fin.convertCurrency(Number(div.totalAmount || 0), dCurr, baseCurr);
    }, 0);
    filterSumEl.textContent = filtered.length > 0
      ? `${filtered.length} ${filtered.length === 1 ? 'payout' : 'payouts'} (${Fin.currency(filteredSumBase, false, baseCurr)})`
      : '0 payouts';
  }

  if (filtered.length === 0) {
    emptyState.classList.remove('hidden');
    return;
  }
  emptyState.classList.add('hidden');

  const sorted = [...filtered].sort((a, b) => new Date(b.payDate || b.exDate) - new Date(a.payDate || a.exDate));
  sorted.forEach(div => {
    const dCurr = div.currency || state.prices[div.ticker]?.currency || MarketAPI.getStaticProfile(div.ticker).currency || 'HKD';
    const tr = document.createElement('tr');
    tr.className = 'hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition text-xs';
    tr.innerHTML = `
      <td class="py-3 px-4 font-mono font-medium text-slate-800 dark:text-slate-200">${div.payDate}</td>
      <td class="py-3 px-4 font-mono text-slate-400">${div.exDate || '-'}</td>
      <td class="py-3 px-4 font-bold text-slate-900 dark:text-white">${div.ticker}</td>
      <td class="py-3 px-4 text-right num-font text-slate-500 dark:text-slate-400">${div.amountPerShare ? Fin.currency(div.amountPerShare, false, dCurr) : '-'}</td>
      <td class="py-3 px-4 text-right font-bold num-font text-emerald-600 dark:text-emerald-400">+${Fin.currency(div.totalAmount, false, dCurr)}</td>
      <td class="py-3 px-4 text-slate-400 max-w-xs truncate">${div.notes || 'Cash Dividend'}</td>
      <td class="py-3 px-4 text-center">
        <button onclick="deleteDividend('${div.id}')" class="text-slate-400 hover:text-rose-500 transition p-1" title="Delete Dividend Record">
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
    const wlChartCard = document.getElementById('watchlist-stock-chart-card');
    if (wlChartCard) wlChartCard.classList.add('hidden');
  } else {
    wlEmpty.classList.add('hidden');
    state.watchlist.forEach(w => {
      const isSelected = selectedWatchlistTicker === w.ticker;
      const curPrice = state.prices[w.ticker]?.price || 0;
      const priceChangePct = state.prices[w.ticker]?.changePct || 0;
      const priceChangeColor = (state.prices[w.ticker]?.change || 0) >= 0 ? 'text-emerald-500' : 'text-rose-500';
      const wlCurrency = state.prices[w.ticker]?.currency || state.fundamentals[w.ticker]?.currency || (w.ticker.endsWith('.HK') ? 'HKD' : (w.ticker.endsWith('.L') ? 'GBp' : 'USD'));
      const targetPrice = w.targetBuyPrice;
      const distPct = curPrice > 0 ? ((curPrice - targetPrice) / targetPrice) * 100 : 0;
      const isTriggered = curPrice > 0 && curPrice <= targetPrice;
      const wm = computeStockPriceMetrics(w.ticker, curPrice);

      const tr = document.createElement('tr');
      tr.className = `cursor-pointer transition text-xs ${
        isSelected
          ? 'bg-purple-50/70 dark:bg-purple-950/30 border-l-4 border-l-purple-500'
          : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/40'
      }`;
      tr.addEventListener('click', (e) => {
        if (e.target.closest('button')) return;
        selectStockForInlineChart('watchlist', w.ticker, true);
      });

      tr.innerHTML = `
        <td class="py-3 px-4 sticky-col-mobile">
          <div class="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
            <span class="hover:text-purple-500 underline decoration-dotted underline-offset-2">${w.ticker}</span>
            <span class="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-medium">${wlCurrency}</span>
          </div>
          <div class="text-[11px] text-slate-400">${w.name || state.fundamentals[w.ticker]?.name || ''}</div>
        </td>
        <td class="py-3 px-3 text-slate-500 dark:text-slate-400">${w.sector || 'General'}</td>
        <td class="py-3 px-3 text-right">
          ${curPrice > 0
            ? `<div class="font-bold num-font text-slate-900 dark:text-white">${Fin.currency(curPrice, false, wlCurrency)}</div>
               <div class="text-[10px] num-font ${priceChangeColor}" title="1-Day market price change vs. previous trading close">
                 <span class="text-[9px] opacity-75 font-semibold">1D</span> ${Fin.percent(Math.abs(priceChangePct) > 40 ? 0 : priceChangePct)}
               </div>`
            : '<span class="text-slate-400 text-[11px]">Sync API</span>'}
        </td>
        <td class="py-3 px-3 text-right num-font text-slate-600 dark:text-slate-300">
          ${wm.low52w !== null && wm.low52w !== undefined ? Fin.currency(wm.low52w, false, wlCurrency) : '<span class="text-slate-400 text-[11px]">-</span>'}
        </td>
        <td class="py-3 px-3 text-right num-font text-slate-600 dark:text-slate-300">
          ${wm.high52w !== null && wm.high52w !== undefined ? Fin.currency(wm.high52w, false, wlCurrency) : '<span class="text-slate-400 text-[11px]">-</span>'}
        </td>
        <td class="py-3 px-3 text-right">
          ${format52wPositionCell(wm.low52w, wm.high52w, wm.pos52wPct, wlCurrency)}
        </td>
        <td class="py-3 px-3 text-right">
          ${formatPeriodChangeCell(wm.momPct, 'MoM', wm.momRefMonth)}
        </td>
        <td class="py-3 px-3 text-right">
          ${formatPeriodChangeCell(wm.qoqPct, 'QoQ', wm.qoqRefMonth)}
        </td>
        <td class="py-3 px-3 text-right">
          ${formatPeriodChangeCell(wm.yoyPct, 'YoY', wm.yoyRefMonth)}
        </td>
        <td class="py-3 px-3 text-right">
          ${formatDividendExDateCell(wm.divInfo)}
        </td>
        <td class="py-3 px-3 text-right">
          ${formatTrendRegimeCell(wm)}
        </td>
        <td class="py-3 px-3 text-center">
          ${formatSignalBadgeCell(w.ticker, wm)}
        </td>
        <td class="py-3 px-3 text-right font-bold num-font text-purple-600 dark:text-purple-400">${Fin.currency(targetPrice, false, wlCurrency)}</td>
        <td class="py-3 px-3 text-right num-font font-medium ${distPct <= 0 && curPrice > 0 ? 'text-emerald-500' : 'text-slate-400'}">
          ${curPrice > 0 ? (distPct <= 0 ? 'At / Below Target' : `+${distPct.toFixed(1)}% above`) : '-'}
        </td>
        <td class="py-3 px-3 text-center">
          ${isTriggered
            ? '<span class="px-2.5 py-1 rounded-full font-bold bg-rose-500 text-white text-[10px] animate-pulse">BUY TARGET HIT</span>'
            : '<span class="px-2 py-0.5 rounded font-medium bg-slate-100 dark:bg-slate-800 text-slate-400 text-[10px]">WATCHING</span>'}
        </td>
        <td class="py-3 px-3 text-center">
          <div class="flex items-center justify-center gap-1.5">
            <button onclick="event.stopPropagation(); selectStockForInlineChart('watchlist', '${w.ticker}', true)" class="p-1.5 ${isSelected ? 'bg-purple-600 text-white' : 'text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-950/40'} rounded" title="Show Monthly Price Chart Below">
              <i class="fa-solid fa-chart-line"></i>
            </button>
            <button onclick="event.stopPropagation(); openTradeModalForTicker('${w.ticker}', 'BUY', ${curPrice || targetPrice})" class="px-2 py-1 rounded bg-brand-600 hover:bg-brand-500 text-white font-semibold text-[11px]">
              Buy
            </button>
            <button onclick="event.stopPropagation(); deleteFromWatchlist('${w.ticker}')" class="p-1.5 text-slate-400 hover:text-rose-500 transition">
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

  const cfg = state.settings || DEFAULT_QUANT_SETTINGS;

  allTickers.forEach(ticker => {
    const f = state.fundamentals[ticker] || {};
    const curPrice = state.prices[ticker]?.price || 0;
    const tCurr = state.prices[ticker]?.currency || f.currency || MarketAPI.getStaticProfile(ticker).currency || 'HKD';
    const eps = Number(f.eps) || 0;
    const bvps = Number(f.bvps) || 0;
    const grahamVal = eps > 0 && bvps > 0 ? Math.sqrt(22.5 * eps * bvps) : 0;

    const fcfPs = Number(f.fcfPerShare) || (eps > 0 ? eps * 0.9 : 0);
    const growth = Number(f.growth5y || cfg.defaultDcfGrowthPct || 10.0);
    const discount = Number(f.discountRate || cfg.defaultDcfDiscountPct || 9.0);
    const terminal = Number(f.terminalRate || cfg.defaultDcfTerminalPct || 2.5);

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
      <td class="py-3 px-4 text-right num-font">${eps ? Fin.currency(eps, false, tCurr) : '-'}</td>
      <td class="py-3 px-4 text-right num-font font-bold">${f.marketCap || '-'}</td>
      <td class="py-3 px-4 text-right num-font text-slate-400">${f.debtEquity ?? '-'}</td>
      <td class="py-3 px-4 text-right num-font">${f.roe ? f.roe + '%' : '-'}</td>
      <td class="py-3 px-4 text-right num-font">${f.fcf || (fcfPs ? Fin.currency(fcfPs, false, tCurr) + '/sh' : '-')}</td>
      <td class="py-3 px-4 text-right num-font text-cyan-500">${f.divYield ? f.divYield + '%' : '-'}</td>
      <td class="py-3 px-4 text-right num-font font-bold text-indigo-500">${grahamVal > 0 ? Fin.currency(grahamVal, false, tCurr) : '-'}</td>
      <td class="py-3 px-4 text-right num-font font-bold text-emerald-500">${dcfVal > 0 ? Fin.currency(dcfVal, false, tCurr) : '-'}</td>
      <td class="py-3 px-4 text-center">${mosBadge}</td>
    `;
    fundTbody.appendChild(tr);
  });
}

// ============================================================================
// 10. MARKET INTELLIGENCE & COMPANY NEWS TAB RENDERER
// ============================================================================
function renderNewsTab() {
  const container = document.getElementById('news-articles-grid');
  const scopeFilterEl = document.getElementById('news-filter-scope');
  const tickerFilterEl = document.getElementById('news-filter-ticker');
  const catFilterEl = document.getElementById('news-filter-catalyst');
  const sentFilterEl = document.getElementById('news-filter-sentiment');
  const countBadge = document.getElementById('news-total-count-badge');
  if (!container) return;

  const rawList = (Array.isArray(state.companyNews) && state.companyNews.length > 0)
    ? [...state.companyNews, ...CURATED_BASELINE_NEWS]
    : [...CURATED_BASELINE_NEWS];

  const seenUrls = new Set();
  const deduped = [];
  rawList.forEach(rawArt => {
    const a = (typeof normalizeNewsArticleSchema === 'function') ? normalizeNewsArticleSchema(rawArt) : rawArt;
    if (a && a.url && !seenUrls.has(a.url)) {
      seenUrls.add(a.url);
      deduped.push(a);
    }
  });

  const heldSet = new Set((portfolio?.activeHoldings || []).map(h => h.ticker));
  const watchSet = new Set((state?.watchlist || []).map(w => w.ticker));

  const qScope = scopeFilterEl?.value || 'ALL';
  const qTicker = (tickerFilterEl?.value || '').trim().toUpperCase();
  const qCat = catFilterEl?.value || 'ALL';
  const qSent = sentFilterEl?.value || 'ALL';

  const filtered = deduped.filter(a => {
    if (qScope === 'HOLDINGS' && !heldSet.has(a.ticker)) return false;
    if (qScope === 'WATCHLIST' && !watchSet.has(a.ticker)) return false;
    if (qTicker && !String(a.ticker || '').toUpperCase().includes(qTicker) && !String(a.companyName || '').toUpperCase().includes(qTicker)) {
      return false;
    }
    if (qCat !== 'ALL' && a.catalyst !== qCat) return false;
    if (qSent !== 'ALL' && a.sentimentLabel !== qSent) return false;
    return true;
  });

  if (countBadge) {
    countBadge.textContent = `${filtered.length} Articles`;
  }

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="col-span-full p-10 text-center text-slate-400 text-xs bg-white dark:bg-dark-card rounded-2xl border border-slate-200 dark:border-dark-border">
        <i class="fa-solid fa-newspaper text-3xl mb-2 opacity-30"></i>
        <p class="font-medium">No news articles match your current filter</p>
      </div>
    `;
    return;
  }

  container.innerHTML = filtered.map(art => {
    const sentLabel = art.sentimentLabel || 'NEUTRAL';
    const sentCls = sentLabel === 'BULLISH'
      ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
      : (sentLabel === 'BEARISH'
          ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30'
          : 'bg-slate-500/15 text-slate-500 border-slate-500/30');
    const catCls = art.catalyst === 'DIVIDEND'
      ? 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border-cyan-500/30'
      : (art.catalyst === 'EARNINGS'
          ? 'bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30'
          : 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border-indigo-500/30');
    const dateStr = (art.publishedAt || '').slice(0, 10);
    const isHeld = heldSet.has(art.ticker);
    const isWatched = watchSet.has(art.ticker);
    const rolePill = isHeld
      ? '<span class="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">HOLDING</span>'
      : (isWatched ? '<span class="px-1.5 py-0.5 rounded text-[9px] font-bold bg-purple-500/10 text-purple-400 border border-purple-500/20">WATCHLIST</span>' : '');

    return `
      <div class="bg-white dark:bg-dark-card border border-slate-200 dark:border-dark-border p-4 rounded-2xl shadow-sm flex flex-col justify-between gap-3 hover:border-brand-500/40 transition">
        <div class="space-y-2">
          <div class="flex flex-wrap items-center justify-between gap-1.5">
            <div class="flex flex-wrap items-center gap-1.5">
              <span class="px-2 py-0.5 rounded font-mono font-bold text-xs bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white" title="${art.companyName || art.ticker}">${art.ticker}</span>
              ${rolePill}
              <span class="px-2 py-0.5 rounded text-[10px] font-bold border ${catCls}">${art.catalyst || 'CORPORATE'}</span>
              <span class="px-2 py-0.5 rounded text-[10px] font-bold border ${sentCls}">${sentLabel} (${art.sentimentScore >= 0 ? '+' : ''}${Number(art.sentimentScore || 0).toFixed(2)})</span>
            </div>
            <span class="text-[11px] font-mono text-slate-400">${dateStr}</span>
          </div>
          <a href="${art.url}" target="_blank" rel="noopener noreferrer" class="block font-bold text-sm text-slate-900 dark:text-white hover:text-brand-500 transition">
            ${art.title} <i class="fa-solid fa-arrow-up-right-from-square text-[10px] opacity-60 ml-1"></i>
          </a>
          <p class="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">${art.summary || art.title}</p>
        </div>
        <div class="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
          <span><i class="fa-regular fa-building mr-1"></i>${art.companyName || art.ticker} &bull; ${art.publisher || 'Financial News'}</span>
          <button type="button" onclick="openSignalDetailModal('${art.ticker}')" class="text-brand-500 hover:underline font-semibold">
            View Signal &rarr;
          </button>
        </div>
      </div>
    `;
  }).join('');
}
window.renderNewsTab = renderNewsTab;

// ============================================================================
// 11. SMART CASH DEPLOYMENT & REBALANCING SIMULATOR MODAL
// ============================================================================
window.stageRebalanceOrder = function(ticker, type, shares, price) {
  closeModal('modal-rebalance');
  openTradeModal(ticker, type, price);
  const shEl = document.getElementById('trade-shares');
  if (shEl && shares > 0) {
    shEl.value = Math.max(1, Math.round(shares));
    updateTradeCalculatedTotal();
  }
};

window.openRebalanceModal = function() {
  const inputEl = document.getElementById('rebalance-cash-input');
  const baseCurr = portfolio?.baseCurrency || state.settings.currency || 'HKD';
  const lblEl = document.getElementById('rebalance-currency-label');
  if (lblEl) lblEl.textContent = baseCurr;
  if (inputEl && (!inputEl.value || Number(inputEl.value) <= 0)) {
    const defaultCash = portfolio.cashBalance > 1000 ? Fin.round(portfolio.cashBalance, 0) : 50000;
    inputEl.value = defaultCash;
  }
  runRebalanceSimulation();
  openModal('modal-rebalance');
};

window.runRebalanceSimulation = function() {
  const cashToDeploy = parseFloat(document.getElementById('rebalance-cash-input')?.value) || 50000;
  const strategy = document.getElementById('rebalance-strategy-select')?.value || 'signal';
  const tbody = document.getElementById('rebalance-results-tbody');
  const trimBox = document.getElementById('rebalance-trim-alerts-box');
  if (!tbody) return;

  const baseCurr = portfolio?.baseCurrency || state.settings.currency || 'HKD';
  const maxWeightPct = Number(state?.settings?.maxPositionWeightPct || 15.0);

  // UX #4: Actionable Trim & Offload Alerts (Overweight > maxWeightPct OR Signal = TRIM / OFFLOAD / SELL)
  if (trimBox) {
    const totalPortStockVal = portfolio?.totalStockMarketValue || 0;
    const trimCandidates = (portfolio?.activeHoldings || []).filter(h => {
      const wPct = totalPortStockVal > 0 ? ((h.marketValueBase || h.marketValue) / totalPortStockVal) * 100 : 0;
      const isSignalOffload = (h.signalLabel || '').includes('TRIM') || (h.signalLabel || '').includes('SELL');
      return wPct > maxWeightPct || isSignalOffload;
    }).map(h => {
      const wPct = totalPortStockVal > 0 ? ((h.marketValueBase || h.marketValue) / totalPortStockVal) * 100 : 0;
      let trimShares = Math.max(100, Math.round((h.shares * 0.25) / 100) * 100);
      if (trimShares > h.shares) trimShares = Math.max(1, Math.floor(h.shares * 0.25));
      let reasonTag = `${h.signalLabel} (${h.signalScore}/100)`;
      if (wPct > maxWeightPct) {
        const targetValBase = totalPortStockVal * (maxWeightPct / 100);
        const excessBase = Math.max(0, (h.marketValueBase || h.marketValue) - targetValBase);
        const priceBase = Fin.convertCurrency(h.currentPrice, h.currency, baseCurr);
        if (priceBase > 0) trimShares = Math.max(1, Math.floor(excessBase / priceBase));
        reasonTag = `Overweight ${wPct.toFixed(1)}% (> ${maxWeightPct}%)`;
      }
      return { ...h, weightPct: Fin.round(wPct, 1), trimShares, reasonTag };
    });

    if (trimCandidates.length > 0) {
      trimBox.classList.remove('hidden');
      trimBox.innerHTML = `
        <div class="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs space-y-2">
          <div class="font-bold text-amber-600 dark:text-amber-400 flex items-center justify-between">
            <span><i class="fa-solid fa-scale-unbalanced mr-1.5"></i>Offload &amp; Concentration Trim Alerts (Signal / &gt;${maxWeightPct}% Weight)</span>
            <span class="font-mono text-[11px]">${trimCandidates.length} ${trimCandidates.length === 1 ? 'position' : 'positions'}</span>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
            ${trimCandidates.map(o => `
              <div class="flex items-center justify-between bg-white/80 dark:bg-slate-900/70 px-2.5 py-1.5 rounded-lg border border-amber-500/20">
                <div>
                  <span class="font-mono font-bold text-slate-900 dark:text-white">${o.ticker}</span>
                  <span class="text-[10px] text-amber-600 dark:text-amber-400 font-mono ml-1">${o.reasonTag}</span>
                  <div class="text-[10px] text-slate-500">Suggested trim: ~${Fin.shares(o.trimShares)} sh @ ${Fin.currency(o.currentPrice, false, o.currency)}</div>
                </div>
                <button type="button" onclick="stageRebalanceOrder('${o.ticker}', 'SELL', ${o.trimShares}, ${o.currentPrice})" class="px-2 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-600 dark:text-amber-300 font-bold text-[10px] transition shrink-0">
                  Stage Trim
                </button>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    } else {
      trimBox.classList.add('hidden');
      trimBox.innerHTML = '';
    }
  }

  const candidates = [];
  portfolio.activeHoldings.forEach(h => {
    candidates.push({
      ticker: h.ticker,
      name: h.companyName,
      currency: h.currency,
      price: h.currentPrice,
      signalScore: h.signalScore,
      signalLabel: h.signalLabel,
      netYieldPct: h.divInfo?.netYieldPct || 0
    });
  });

  state.watchlist.forEach(w => {
    if (!candidates.some(c => c.ticker === w.ticker)) {
      const p = state.prices[w.ticker]?.price || w.targetBuyPrice || 0;
      const m = computeStockPriceMetrics(w.ticker, p);
      const curr = state.prices[w.ticker]?.currency || MarketAPI.getStaticProfile(w.ticker).currency || 'HKD';
      if (p > 0) {
        candidates.push({
          ticker: w.ticker,
          name: w.name || w.ticker,
          currency: curr,
          price: p,
          signalScore: m.signalScore,
          signalLabel: m.signalLabel,
          netYieldPct: m.divInfo?.netYieldPct || 0
        });
      }
    }
  });

  let pool = candidates.filter(c => c.price > 0 && c.signalScore >= 50);
  if (pool.length === 0) pool = candidates.filter(c => c.price > 0);
  if (pool.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="py-4 text-center text-slate-400 text-xs">Add holdings or watchlist items first.</td></tr>';
    return;
  }

  if (strategy === 'signal') {
    pool.sort((a, b) => b.signalScore - a.signalScore);
  } else if (strategy === 'yield') {
    pool.sort((a, b) => b.netYieldPct - a.netYieldPct);
  }

  const topPicks = pool.slice(0, 6);
  const weightDenominators = topPicks.map(p => {
    if (strategy === 'signal') return Math.max(10, p.signalScore);
    if (strategy === 'yield') return Math.max(1, p.netYieldPct * 10);
    return 1;
  });
  const totalWeight = weightDenominators.reduce((a, b) => a + b, 0);

  tbody.innerHTML = topPicks.map((p, idx) => {
    const allocShare = weightDenominators[idx] / totalWeight;
    const allocBase = cashToDeploy * allocShare;
    const priceBase = Fin.convertCurrency(p.price, p.currency, baseCurr);
    const estShares = priceBase > 0 ? Math.floor(allocBase / priceBase) : 0;
    const estOutlayNative = Fin.round(estShares * p.price, 2);
    const estAnnualDiv = Fin.round(estOutlayNative * (p.netYieldPct / 100), 2);

    return `
      <tr class="border-b border-slate-100 dark:border-slate-800 text-xs">
        <td class="py-2.5 px-3 font-bold text-slate-900 dark:text-white">${p.ticker} <span class="text-[10px] text-slate-400 font-normal">(${(allocShare * 100).toFixed(0)}%)</span></td>
        <td class="py-2.5 px-3 text-center"><span class="px-1.5 py-0.5 rounded bg-brand-500/15 text-brand-500 font-mono font-bold text-[10px]">${p.signalLabel} (${p.signalScore})</span></td>
        <td class="py-2.5 px-3 text-right num-font">${Fin.currency(p.price, false, p.currency)}</td>
        <td class="py-2.5 px-3 text-right num-font font-bold text-emerald-500">+${Fin.shares(estShares)} sh</td>
        <td class="py-2.5 px-3 text-right num-font">${Fin.currency(estOutlayNative, false, p.currency)}</td>
        <td class="py-2.5 px-3 text-right num-font text-cyan-500">+${Fin.currency(estAnnualDiv, false, p.currency)}/yr</td>
        <td class="py-2.5 px-3 text-center">
          <button type="button" onclick="stageRebalanceOrder('${p.ticker}', 'BUY', ${estShares}, ${p.price})" class="px-2 py-1 rounded bg-brand-600 hover:bg-brand-500 text-white font-bold text-[10px] transition">
            Stage Buy
          </button>
        </td>
      </tr>
    `;
  }).join('');
};

// ============================================================================
// 12. SETTINGS PAGE MANUAL PARAMETER CUSTOMIZATION CONTROLLER
// ============================================================================
function renderQuantSettingsUI() {
  const cfg = state?.settings || DEFAULT_QUANT_SETTINGS;
  const setVal = (id, val) => {
    const el = document.getElementById(id);
    if (el && document.activeElement !== el) {
      if (el.type === 'checkbox') el.checked = Boolean(val);
      else el.value = val ?? '';
    }
  };

  setVal('setting-base-currency', cfg.currency || 'HKD');
  setVal('setting-inflation-rate', cfg.inflationRatePct ?? 2.2);
  setVal('setting-risk-free-rate', cfg.riskFreeRatePct ?? 4.0);
  setVal('setting-max-weight', cfg.maxPositionWeightPct ?? 15.0);
  setVal('setting-fx-usdhkd', cfg.fxUsdHkd ?? 7.8453);
  setVal('setting-fx-gbphkd', cfg.fxGbpHkd ?? 10.4985);
  setVal('setting-fx-gbpusd', cfg.fxGbpUsd ?? 1.3382);
  setVal('setting-wht-hk', cfg.whtHkPct ?? 0.0);
  setVal('setting-wht-us', cfg.whtUsPct ?? 30.0);
  setVal('setting-wht-uk', cfg.whtUkPct ?? 0.0);
  setVal('setting-exdate-alert-days', cfg.exDateAlertDays ?? 14);
  setVal('setting-auto-detect-div', cfg.autoDetectDividends !== false);
  setVal('setting-rsi-period', cfg.rsiPeriod ?? 14);
  setVal('setting-rsi-oversold', cfg.rsiOversold ?? 32);
  setVal('setting-rsi-overbought', cfg.rsiOverbought ?? 70);
  setVal('setting-sma-short', cfg.smaShortPeriod ?? 20);
  setVal('setting-sma-med', cfg.smaMedPeriod ?? 50);
  setVal('setting-sma-long', cfg.smaLongPeriod ?? 200);
  setVal('setting-atr-mult', cfg.atrStopMultiplier ?? 2.0);
  setVal('setting-sig-strong-buy', cfg.signalStrongBuyMin ?? 78);
  setVal('setting-sig-buy', cfg.signalBuyMin ?? 64);
  setVal('setting-sig-hold', cfg.signalHoldMin ?? 42);
  setVal('setting-w-momentum', cfg.weightMomentum ?? 30);
  setVal('setting-w-trend', cfg.weightTrend ?? 25);
  setVal('setting-w-valuation', cfg.weightValuation ?? 25);
  setVal('setting-w-quality', cfg.weightQuality ?? 20);
  setVal('setting-dcf-growth', cfg.defaultDcfGrowthPct ?? 10.0);
  setVal('setting-dcf-discount', cfg.defaultDcfDiscountPct ?? 9.0);
  setVal('setting-dcf-terminal', cfg.defaultDcfTerminalPct ?? 2.5);
  setVal('setting-bench-hk', cfg.benchmarkHk || '2800.HK');
  setVal('setting-bench-us', cfg.benchmarkUs || 'VOO');
  setVal('setting-chart-sma', cfg.chartShowSma !== false);
  setVal('setting-chart-reg', cfg.chartShowRegChannel !== false);
}

function saveQuantSettingsFromUI() {
  const num = (id, def) => {
    const v = parseFloat(document.getElementById(id)?.value);
    return isNaN(v) ? def : v;
  };
  const str = (id, def) => (document.getElementById(id)?.value || def).trim();
  const chk = (id, def) => {
    const el = document.getElementById(id);
    return el ? Boolean(el.checked) : def;
  };

  state.settings.currency = str('setting-base-currency', 'HKD');
  state.settings.inflationRatePct = num('setting-inflation-rate', 2.2);
  state.settings.riskFreeRatePct = num('setting-risk-free-rate', 4.0);
  state.settings.maxPositionWeightPct = num('setting-max-weight', 15.0);
  state.settings.fxUsdHkd = num('setting-fx-usdhkd', 7.8453);
  state.settings.fxGbpHkd = num('setting-fx-gbphkd', 10.4985);
  state.settings.fxGbpUsd = num('setting-fx-gbpusd', 1.3382);
  state.settings._userCustomFx = true;
  state.settings.whtHkPct = num('setting-wht-hk', 0.0);
  state.settings.whtUsPct = num('setting-wht-us', 30.0);
  state.settings.whtUkPct = num('setting-wht-uk', 0.0);
  state.settings.exDateAlertDays = num('setting-exdate-alert-days', 14);
  state.settings.autoDetectDividends = chk('setting-auto-detect-div', true);
  state.settings.rsiPeriod = num('setting-rsi-period', 14);
  state.settings.rsiOversold = num('setting-rsi-oversold', 32);
  state.settings.rsiOverbought = num('setting-rsi-overbought', 70);
  state.settings.smaShortPeriod = num('setting-sma-short', 20);
  state.settings.smaMedPeriod = num('setting-sma-med', 50);
  state.settings.smaLongPeriod = num('setting-sma-long', 200);
  state.settings.atrStopMultiplier = num('setting-atr-mult', 2.0);
  state.settings.signalStrongBuyMin = num('setting-sig-strong-buy', 78);
  state.settings.signalBuyMin = num('setting-sig-buy', 64);
  state.settings.signalHoldMin = num('setting-sig-hold', 42);
  state.settings.weightMomentum = num('setting-w-momentum', 30);
  state.settings.weightTrend = num('setting-w-trend', 25);
  state.settings.weightValuation = num('setting-w-valuation', 25);
  state.settings.weightQuality = num('setting-w-quality', 20);
  state.settings.defaultDcfGrowthPct = num('setting-dcf-growth', 10.0);
  state.settings.defaultDcfDiscountPct = num('setting-dcf-discount', 9.0);
  state.settings.defaultDcfTerminalPct = num('setting-dcf-terminal', 2.5);
  state.settings.benchmarkHk = MarketAPI.normalizeTicker(str('setting-bench-hk', '2800.HK'));
  state.settings.benchmarkUs = MarketAPI.normalizeTicker(str('setting-bench-us', 'VOO'));
  state.settings.chartShowSma = chk('setting-chart-sma', true);
  state.settings.chartShowRegChannel = chk('setting-chart-reg', true);

  recalculatePortfolio();
  saveState();
  renderAll();
  showToast(`Saved custom quantitative, XIRR (CPI ${state.settings.inflationRatePct}%), FX & signal settings!`, 'success');
}
window.saveQuantSettingsFromUI = saveQuantSettingsFromUI;

function resetQuantSettingsToDefault() {
  state.settings = {
    ...state.settings,
    ...DEFAULT_QUANT_SETTINGS,
    _userCustomFx: false
  };
  recalculatePortfolio();
  saveState();
  renderAll();
  showToast('Restored all quantitative, XIRR, FX, tax & signal parameters to recommended defaults.', 'info');
}
window.resetQuantSettingsToDefault = resetQuantSettingsToDefault;

function exportTickersManifestJson() {
  const allTickers = Array.from(new Set([
    ...DEFAULT_TICKERS_LIST_FALLBACK(),
    ...portfolio.activeHoldings.map(h => h.ticker),
    ...state.watchlist.map(w => w.ticker)
  ])).sort();
  const payload = {
    updatedAt: new Date().toISOString(),
    tickers: allTickers
  };
  const blob = new Blob([JSON.stringify(payload, null, 2) + '\n'], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'portfolio_tickers.json';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  showToast(`Exported portfolio_tickers.json (${allTickers.length} tickers) for GitHub Actions!`, 'success');
}
window.exportTickersManifestJson = exportTickersManifestJson;

function DEFAULT_TICKERS_LIST_FALLBACK() {
  return Object.keys(TICKER_STATIC_DIRECTORY || {});
}

// ============================================================================
// 13. NAVIGATION, MODALS & FORM HANDLERS
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
  } else if (target === 'holdings') {
    setTimeout(() => renderInlineStockChart('holdings'), 40);
  } else if (target === 'watchlist') {
    setTimeout(() => renderInlineStockChart('watchlist'), 40);
  } else if (target === 'news') {
    renderNewsTab();
  } else if (target === 'logs') {
    if (typeof AppLogger !== 'undefined') {
      AppLogger.renderHealthCheckPanel();
      AppLogger.renderLogTable();
    }
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
  setTimeout(() => toast.remove(), 4500);
}

function openModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('hidden');
}

function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add('hidden');
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
    const norm = MarketAPI.normalizeTicker(ticker);
    document.getElementById('trade-ticker').value = norm;
    const price = defaultPrice || state.prices[norm]?.price || '';
    document.getElementById('trade-price').value = price;
    updateHoldingHint(norm);
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
  const norm = MarketAPI.normalizeTicker(ticker);
  const active = portfolio.activeHoldings.find(h => h.ticker === norm);
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

  const rawTicker = document.getElementById('trade-ticker').value.trim();
  const ticker = MarketAPI.normalizeTicker(rawTicker);
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

  if (MarketAPI.hasKey()) {
    try {
      const q = await MarketAPI.fetchQuote(ticker);
      if (q?.price) state.prices[ticker] = { ...q, lastUpdated: new Date().toISOString() };
      if (!state.historicalPrices[ticker] || state.historicalPrices[ticker].length === 0) {
        const hist = await MarketAPI.fetchMonthlyHistory(ticker);
        if (hist?.length) state.historicalPrices[ticker] = hist;
      }
      if (!state.fundamentals[ticker] || !state.fundamentals[ticker].pe) {
        state.fundamentals[ticker] = await MarketAPI.fetchFundamentals(ticker);
      }
      state.settings.lastApiSync = new Date().toISOString();
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
  const ticker = MarketAPI.normalizeTicker(document.getElementById('div-ticker').value);
  const payDate = document.getElementById('div-pay-date').value;
  const exDate = document.getElementById('div-ex-date').value;
  const totalAmount = parseFloat(document.getElementById('div-amount').value);
  const notes = document.getElementById('div-notes').value.trim();

  if (!ticker || !totalAmount || totalAmount <= 0) return;

  const dCurr = state.prices[ticker]?.currency || MarketAPI.getStaticProfile(ticker).currency || 'HKD';
  const held = (portfolio?.activeHoldings || []).find(h => h.ticker === ticker);
  const amountPerShare = (held && held.shares > 0) ? Fin.round(totalAmount / held.shares, 4) : 0;

  state.dividends.push({
    id: `DIV-${Date.now().toString().slice(-6)}`,
    ticker,
    payDate,
    exDate,
    amountPerShare,
    totalAmount,
    currency: dCurr,
    isDrip: false,
    dripShares: 0,
    notes: notes || 'Cash Dividend'
  });

  recalculatePortfolio();
  saveState();
  renderAll();
  closeModal('modal-dividend');
  showToast(`Logged ${Fin.currency(totalAmount, false, dCurr)} cash dividend for ${ticker}`, 'success');
}

async function handleWatchlistSubmit(e) {
  e.preventDefault();
  const ticker = MarketAPI.normalizeTicker(document.getElementById('wl-ticker').value);
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
      if (q?.price) {
        state.prices[ticker] = { ...q, lastUpdated: new Date().toISOString() };
        const wlItem = state.watchlist.find(w => w.ticker === ticker);
        if (wlItem && (!wlItem.name || wlItem.name === ticker) && q.name) {
          wlItem.name = q.name;
        }
      }
      const fund = await MarketAPI.fetchFundamentals(ticker);
      if (fund) state.fundamentals[ticker] = fund;
      const hist = await MarketAPI.fetchMonthlyHistory(ticker);
      if (hist?.length) state.historicalPrices[ticker] = hist;
      recalculatePortfolio();
      saveState();
      renderAll();
    } catch (err) {
      console.warn('Watchlist API fetch warning:', err.message);
    }
  }
}

window.deleteTransaction = function(id) {
  state.transactions = state.transactions.filter(t => t.id !== id);
  recalculatePortfolio();
  saveState();
  renderAll();
  showToast('Transaction removed', 'info');
};

window.deleteDividend = function(id) {
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
// 14. INTRINSIC FAIR-VALUE CALCULATOR MODAL (GRAHAM & 2-STAGE DCF)
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
  const tCurr = state.prices[ticker]?.currency || MarketAPI.getStaticProfile(ticker).currency || 'HKD';
  document.getElementById('calc-current-price-badge').textContent = curPrice > 0 ? Fin.currency(curPrice, false, tCurr) : 'N/A';

  const f = state.fundamentals[ticker] || {};
  const cfg = state.settings || DEFAULT_QUANT_SETTINGS;
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
  document.getElementById('calc-dcf-growth').value = f.growth5y || cfg.defaultDcfGrowthPct || 10.0;
  document.getElementById('calc-dcf-discount').value = f.discountRate || cfg.defaultDcfDiscountPct || 9.0;
  document.getElementById('calc-dcf-terminal').value = f.terminalRate || cfg.defaultDcfTerminalPct || 2.5;

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

  recalculatePortfolio();
  saveState();
  renderAll();
  closeModal('modal-calc');
  showToast(`Saved fundamental & DCF metrics for ${ticker}`, 'success');
}

// ============================================================================
// 15. EVENT LISTENERS & INITIALIZATION
// ============================================================================
function copyTextWithFallback(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    return navigator.clipboard.writeText(text).catch(() => fallbackExecCopy(text));
  }
  return Promise.resolve(fallbackExecCopy(text));
}

function fallbackExecCopy(text) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.focus();
  ta.select();
  try {
    document.execCommand('copy');
  } catch (_) {}
  ta.remove();
}


window.toggleChartOverlay = function(kind, tabType) {
  if (kind === 'sma') {
    state.settings.chartShowSma = !(state.settings.chartShowSma !== false);
  } else if (kind === 'reg') {
    state.settings.chartShowRegChannel = !(state.settings.chartShowRegChannel !== false);
  }
  saveState();
  renderQuantSettingsUI();
  renderInlineStockChart(tabType || 'holdings');
};

function setupEventListeners() {
  const on = (id, evt, fn) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener(evt, fn);
  };

  document.querySelectorAll('.nav-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      switchTab(tab.getAttribute('data-tab'));
    });
  });

  on('theme-toggle', 'click', () => {
    const isDark = document.documentElement.classList.toggle('dark');
    state.settings.darkMode = isDark;
    saveState();
    renderCharts();
    if (typeof AppLogger !== 'undefined') AppLogger.action('UI', `Switched theme to ${isDark ? 'Dark' : 'Light'} mode.`);
  });

  on('banner-configure-api-btn', 'click', () => {
    switchTab('settings');
    const provEl = document.getElementById('setting-api-provider');
    if (provEl) provEl.focus();
  });

  on('header-sync-api-btn', 'click', () => syncAllMarketData(true));
  on('header-test-api-btn', 'click', () => {
    switchTab('settings');
    runAndRenderApiDiagnostics();
  });
  on('btn-run-api-diagnostic', 'click', () => runAndRenderApiDiagnostics());
  on('mobile-sync-api-btn', 'click', () => syncAllMarketData(true));
  on('btn-refresh-prices-now', 'click', () => syncAllMarketData(true));
  on('btn-sync-watchlist-api', 'click', () => syncAllMarketData(true));
  on('btn-sync-all-api', 'click', () => syncAllMarketData(true));
  on('btn-fetch-monthly-history', 'click', () => syncAllMarketData(true));
  on('btn-fetch-fundamentals-api', 'click', syncFundamentalsViaAPI);

  // News Tab Controls
  on('btn-sync-news-live', 'click', () => syncCompanyNewsLive());
  on('news-filter-scope', 'change', renderNewsTab);
  on('news-filter-ticker', 'input', renderNewsTab);
  on('news-filter-catalyst', 'change', renderNewsTab);
  on('news-filter-sentiment', 'change', renderNewsTab);

  // Rebalance Modal Controls
  on('btn-open-rebalance-modal', 'click', () => openRebalanceModal());
  on('rebalance-cash-input', 'input', () => runRebalanceSimulation());
  on('rebalance-strategy-select', 'change', () => runRebalanceSimulation());

  // Dividend Auto-Backfill & Ledger Filter Controls
  on('btn-approve-all-div-cash', 'click', () => approveAllDetectedDividends());
  on('div-log-filter-ticker', 'change', renderDividendsTable);
  on('div-log-search-text', 'input', renderDividendsTable);

  // Quantitative Settings Customization Controls
  on('btn-save-quant-settings', 'click', () => saveQuantSettingsFromUI());
  on('btn-reset-quant-settings', 'click', () => resetQuantSettingsToDefault());
  on('btn-export-tickers-json', 'click', () => exportTickersManifestJson());

  document.querySelectorAll('.port-history-mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      portfolioHistoryMode = btn.getAttribute('data-port-mode') || 'balance';
      document.querySelectorAll('.port-history-mode-btn').forEach(b => {
        b.className = 'port-history-mode-btn px-2.5 py-1 rounded-md font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition';
      });
      btn.className = 'port-history-mode-btn px-2.5 py-1 rounded-md font-semibold bg-white dark:bg-dark-card shadow text-slate-900 dark:text-white transition';
      renderMonthlyHistoryChart();
    });
  });

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

  document.querySelectorAll('.holdings-stock-range-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      holdingsStockRangeMonths = parseInt(btn.getAttribute('data-stock-range'), 10) || 24;
      document.querySelectorAll('.holdings-stock-range-btn').forEach(b => {
        b.className = 'holdings-stock-range-btn px-2.5 py-1 rounded-md font-semibold text-slate-500 dark:text-slate-400 transition';
      });
      btn.className = 'holdings-stock-range-btn px-2.5 py-1 rounded-md font-semibold bg-white dark:bg-dark-card shadow text-slate-900 dark:text-white transition';
      renderInlineStockChart('holdings');
    });
  });

  on('btn-close-holdings-chart', 'click', () => {
    window.__holdingsChartManuallyClosed = true;
    selectedHoldingsTicker = null;
    renderHoldingsTable();
    renderInlineStockChart('holdings');
  });

  document.querySelectorAll('.watchlist-stock-range-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      watchlistStockRangeMonths = parseInt(btn.getAttribute('data-stock-range'), 10) || 24;
      document.querySelectorAll('.watchlist-stock-range-btn').forEach(b => {
        b.className = 'watchlist-stock-range-btn px-2.5 py-1 rounded-md font-semibold text-slate-500 dark:text-slate-400 transition';
      });
      btn.className = 'watchlist-stock-range-btn px-2.5 py-1 rounded-md font-semibold bg-white dark:bg-dark-card shadow text-slate-900 dark:text-white transition';
      renderInlineStockChart('watchlist');
    });
  });

  on('btn-close-watchlist-chart', 'click', () => {
    window.__watchlistChartManuallyClosed = true;
    selectedWatchlistTicker = null;
    renderWatchlistAndFundamentals();
    renderInlineStockChart('watchlist');
  });

  document.querySelectorAll('.close-modal').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const m = e.target.closest('.modal-backdrop');
      if (m) m.classList.add('hidden');
    });
  });

  on('btn-open-trade-modal', 'click', () => openTradeModal());
  on('btn-holdings-new-trade', 'click', () => openTradeModal());
  on('btn-expand-all-sectors', 'click', () => setAllHoldingsSectorsCollapsed(false));
  on('btn-collapse-all-sectors', 'click', () => setAllHoldingsSectorsCollapsed(true));
  on('btn-tx-add', 'click', () => openTradeModal());
  on('btn-quick-cash', 'click', () => openTradeModal(null, 'DEPOSIT'));
  on('btn-deposit-quick', 'click', () => openTradeModal(null, 'DEPOSIT'));

  on('btn-lookup-ticker-price', 'click', async () => {
    const rawInput = document.getElementById('trade-ticker')?.value.trim();
    if (!rawInput) return;
    const ticker = MarketAPI.normalizeTicker(rawInput);
    document.getElementById('trade-ticker').value = ticker;

    if (!MarketAPI.hasKey()) {
      showToast('Select Yahoo Finance (Keyless) or configure your API Key in Settings.', 'error');
      return;
    }
    try {
      showToast(`Fetching live price for ${ticker}...`, 'info');
      const q = await MarketAPI.fetchQuote(ticker);
      if (q?.price) {
        state.prices[ticker] = { ...q, lastUpdated: new Date().toISOString() };
        document.getElementById('trade-price').value = q.price;
        updateTradeCalculatedTotal();
        showToast(`${ticker} (${q.name || ticker}): ${Fin.currency(q.price, false, q.currency)}`, 'success');
      }
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

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
    on(id, 'input', updateTradeCalculatedTotal);
  });
  on('form-trade', 'submit', handleTradeSubmit);

  on('btn-open-dividend-modal', 'click', () => {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('div-pay-date').value = today;
    document.getElementById('div-ex-date').value = today;
    openModal('modal-dividend');
  });

  on('form-dividend', 'submit', handleDividendSubmit);

  on('btn-open-watchlist-modal', 'click', () => openModal('modal-watchlist'));
  on('form-watchlist', 'submit', handleWatchlistSubmit);

  on('btn-open-calc-modal', 'click', () => {
    populateCalculatorTickers();
    openModal('modal-calc');
  });
  on('calc-ticker-select', 'change', (e) => loadCalculatorForTicker(e.target.value));
  ['calc-graham-eps', 'calc-graham-bvps'].forEach(id => {
    on(id, 'input', computeGrahamNumberInModal);
  });
  ['calc-dcf-fcf', 'calc-dcf-growth', 'calc-dcf-discount', 'calc-dcf-terminal'].forEach(id => {
    on(id, 'input', computeDCFInModal);
  });
  on('btn-save-valuation-to-stock', 'click', saveValuationFromModal);

  on('toggle-alloc-ticker', 'click', () => {
    allocationViewMode = 'ticker';
    document.getElementById('toggle-alloc-ticker').className = 'px-2.5 py-1 rounded-md font-semibold bg-white dark:bg-dark-card shadow text-slate-900 dark:text-white transition';
    document.getElementById('toggle-alloc-sector').className = 'px-2.5 py-1 rounded-md font-semibold text-slate-500 dark:text-slate-400 transition';
    renderAllocationChart();
  });
  on('toggle-alloc-sector', 'click', () => {
    allocationViewMode = 'sector';
    document.getElementById('toggle-alloc-sector').className = 'px-2.5 py-1 rounded-md font-semibold bg-white dark:bg-dark-card shadow text-slate-900 dark:text-white transition';
    document.getElementById('toggle-alloc-ticker').className = 'px-2.5 py-1 rounded-md font-semibold text-slate-500 dark:text-slate-400 transition';
    renderAllocationChart();
  });

  on('tx-search-ticker', 'input', renderTransactionsTable);
  on('tx-filter-type', 'change', renderTransactionsTable);

  on('setting-api-provider', 'change', (e) => {
    state.settings.apiProvider = e.target.value;
    saveState();
    renderApiStatusUI();
  });

  on('btn-save-api-key', 'click', () => {
    state.settings.apiProvider = document.getElementById('setting-api-provider').value;
    state.settings.apiKey = document.getElementById('setting-api-key').value.trim();
    saveState();
    renderApiStatusUI();
    showToast(`Active API Provider: ${state.settings.apiProvider.toUpperCase()}`, 'success');
  });

  on('setting-device-override', 'change', (e) => {
    state.settings.deviceOverride = e.target.value;
    saveState();
    DeviceDetector.detect();
    renderCharts();
    showToast(`Display layout mode set to ${e.target.value.toUpperCase()}`, 'info');
  });

  on('btn-export-excel', 'click', exportPortfolioToExcel);
  on('btn-trigger-import-excel', 'click', () => {
    const fileInput = document.getElementById('excel-file-input');
    if (fileInput) fileInput.click();
  });
  on('excel-file-input', 'change', (e) => {
    if (e.target.files?.[0]) restorePortfolioFromExcel(e.target.files[0]);
  });

  on('btn-reset-data', 'click', () => {
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

  document.querySelectorAll('.log-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const level = btn.getAttribute('data-log-level') || 'ALL';
      document.querySelectorAll('.log-filter-btn').forEach(b => {
        b.className = 'log-filter-btn px-2.5 py-1 rounded-md font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition';
      });
      btn.className = 'log-filter-btn px-2.5 py-1 rounded-md font-semibold bg-white dark:bg-dark-card shadow text-slate-900 dark:text-white transition';
      if (typeof AppLogger !== 'undefined') AppLogger.setLevelFilter(level);
    });
  });

  on('log-filter-module', 'change', (e) => {
    if (typeof AppLogger !== 'undefined') AppLogger.setModuleFilter(e.target.value);
  });

  on('log-search-input', 'input', (e) => {
    if (typeof AppLogger !== 'undefined') AppLogger.setSearchQuery(e.target.value);
  });

  on('btn-run-health-check', 'click', () => {
    if (typeof AppLogger !== 'undefined') {
      const report = AppLogger.runHealthCheck();
      const fails = report.filter(r => r.status === 'FAIL').length;
      showToast(fails === 0 ? 'All 8 Page & Runtime Health Checks passed!' : `${fails} health check(s) reported issues.`, fails === 0 ? 'success' : 'error');
    }
  });

  on('btn-log-test-entry', 'click', () => {
    if (typeof AppLogger !== 'undefined') {
      AppLogger.info('DiagnosticTest', `Manual diagnostic probe triggered by user — Portfolio Value: ${Fin.currency(portfolio?.totalPortfolioValue || 0)}, Active Holdings: ${portfolio?.activeHoldings?.length || 0}`, {
        userAgent: navigator.userAgent,
        deviceProfile: DeviceDetector?.profile,
        activeHoldingsCount: portfolio?.activeHoldings?.length || 0,
        watchlistCount: state?.watchlist?.length || 0
      });
      showToast('Recorded diagnostic test entry in Log stream.', 'success');
    }
  });

  on('btn-copy-logs', 'click', async () => {
    if (typeof AppLogger !== 'undefined') {
      const text = AppLogger.exportText();
      await copyTextWithFallback(text || 'No logs recorded.');
      showToast('Copied runtime logs to clipboard!', 'success');
    }
  });

  on('btn-download-logs', 'click', () => {
    if (typeof AppLogger !== 'undefined') {
      const text = AppLogger.exportText() || 'No logs recorded.';
      const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const dateStr = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      a.href = url;
      a.download = `myPortfolio_Runtime_Logs_${dateStr}.log`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      showToast('Downloaded runtime log file (.log)', 'success');
    }
  });

  on('btn-clear-logs', 'click', () => {
    if (typeof AppLogger !== 'undefined') {
      AppLogger.clear();
      showToast('Cleared runtime log stream.', 'info');
    }
  });
}

function bootstrapPortfolioApp() {
  if (window.__MYPORTFOLIO_BOOTSTRAPPED__) {
    return;
  }
  window.__MYPORTFOLIO_BOOTSTRAPPED__ = true;

  if (typeof AppLogger !== 'undefined') {
    AppLogger.info('Boot', 'Starting myPortfolio bootstrap sequence (v3.1.0 • Build 20261031_1650)...');
  }

  try {
    initAppState();
  } catch (err) {
    if (typeof AppLogger !== 'undefined') AppLogger.error('Boot', `initAppState failed: ${err.message}`, err);
  }

  try {
    DeviceDetector.init();
  } catch (err) {
    if (typeof AppLogger !== 'undefined') AppLogger.error('Boot', `DeviceDetector.init failed: ${err.message}`, err);
  }

  try {
    setupEventListeners();
  } catch (err) {
    if (typeof AppLogger !== 'undefined') AppLogger.error('Boot', `setupEventListeners failed: ${err.message}`, err);
  }

  try {
    renderAll();
  } catch (err) {
    if (typeof AppLogger !== 'undefined') AppLogger.error('Boot', `renderAll failed: ${err.message}`, err);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      loadHistoricalPricesFromJson(true);
      loadCompanyNewsFromJson();
    }
  });

  setTimeout(() => {
    if (typeof AppLogger !== 'undefined') {
      AppLogger.runHealthCheck();
      AppLogger.info('Boot', 'myPortfolio v3.1.0 boot sequence complete.');
    }
  }, 120);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrapPortfolioApp);
} else {
  bootstrapPortfolioApp();
}

window.renderAll = renderAll;
window.renderKPIs = renderKPIs;
window.renderHoldingsTable = renderHoldingsTable;
window.renderTransactionsTable = renderTransactionsTable;
window.renderDividendsTable = renderDividendsTable;
window.renderWatchlistAndFundamentals = renderWatchlistAndFundamentals;
window.renderQuantSettingsUI = renderQuantSettingsUI;
window.switchTab = switchTab;
window.showToast = showToast;
window.openModal = openModal;
window.closeModal = closeModal;
window.openTradeModal = openTradeModal;
window.bootstrapPortfolioApp = bootstrapPortfolioApp;
