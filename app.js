/**
 * @file app.js
 * @module AppUIController
 * @version 2.4.1
 * @build 20261019_1950
 * @description Main UI controller, table renderers, modal handlers, intrinsic valuation calculators, and event listeners.
 */

// ============================================================================
// 6. UI RENDERING CONTROLLERS
// ============================================================================
function renderAll() {
  try {
    if (!portfolio) recalculatePortfolio();
  } catch (err) {
    if (typeof AppLogger !== 'undefined') AppLogger.error('Portfolio', `recalculatePortfolio failed: ${err.message}`, err);
  }
  try { renderApiStatusUI(); } catch (err) { if (typeof AppLogger !== 'undefined') AppLogger.error('UI', `renderApiStatusUI failed: ${err.message}`, err); }
  try { renderKPIs(); } catch (err) { if (typeof AppLogger !== 'undefined') AppLogger.error('UI', `renderKPIs failed: ${err.message}`, err); }
  try { populateHistorySelector(); } catch (err) { if (typeof AppLogger !== 'undefined') AppLogger.error('UI', `populateHistorySelector failed: ${err.message}`, err); }
  try { renderHoldingsTable(); } catch (err) { if (typeof AppLogger !== 'undefined') AppLogger.error('UI', `renderHoldingsTable failed: ${err.message}`, err); }
  try { renderTransactionsTable(); } catch (err) { if (typeof AppLogger !== 'undefined') AppLogger.error('UI', `renderTransactionsTable failed: ${err.message}`, err); }
  try { renderDividendsTable(); } catch (err) { if (typeof AppLogger !== 'undefined') AppLogger.error('UI', `renderDividendsTable failed: ${err.message}`, err); }
  try { renderWatchlistAndFundamentals(); } catch (err) { if (typeof AppLogger !== 'undefined') AppLogger.error('UI', `renderWatchlistAndFundamentals failed: ${err.message}`, err); }
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
      showToast(`Fetching monthly price history for ${ticker}...`, 'info');
      const history = await MarketAPI.fetchMonthlyHistory(ticker);
      if (Array.isArray(history) && history.length > 0) {
        state.historicalPrices[ticker] = history;
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
    dot.className = 'w-2.5 h-2.5 rounded-full bg-emerald-500';
    text.textContent = `API: ${providerNames[providerRaw] || providerRaw.toUpperCase()} Ready`;
    banner.classList.add('hidden');
  } else {
    dot.className = 'w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse';
    text.textContent = 'API Key Needed';
    banner.classList.remove('hidden');
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
        <span class="text-[11px] text-slate-400 block">Live Price (${top.currency})</span>
        <span class="text-sm font-bold num-font text-slate-800 dark:text-slate-200">${Fin.currency(top.currentPrice, false, top.currency)}</span>
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
  // Dashboard chart is dedicated to Portfolio Historical Balance & Return.
  // Keep Holdings & Watchlist selected tickers synchronized with active items.
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

  // 1. Group active holdings by canonical sector
  const groupsMap = {};
  portfolio.activeHoldings.forEach(h => {
    const secName = getCanonicalHoldingsSector(h);
    if (!groupsMap[secName]) {
      groupsMap[secName] = {
        sector: secName,
        isEtf: MarketAPI.isEtfSector(secName, h.ticker, h.companyName),
        items: [],
        totalCostBasis: 0,
        totalMarketValue: 0,
        totalUnrealizedGain: 0,
        totalDividends: 0,
        currency: h.currency || 'HKD'
      };
    }
    const g = groupsMap[secName];
    g.items.push(h);
    g.totalCostBasis = Fin.round(g.totalCostBasis + h.totalCostBasis, 2);
    g.totalMarketValue = Fin.round(g.totalMarketValue + h.marketValue, 2);
    g.totalUnrealizedGain = Fin.round(g.totalUnrealizedGain + h.unrealizedGain, 2);
    g.totalDividends = Fin.round(g.totalDividends + (h.totalDividends || 0), 2);
  });

  // 2. Sort sector groups: ETFs at the top, then alphabetical by sector name (A-Z)
  const sortedGroups = Object.values(groupsMap).sort((a, b) => {
    if (a.isEtf !== b.isEtf) return a.isEtf ? -1 : 1;
    return a.sector.localeCompare(b.sector, undefined, { sensitivity: 'base' });
  });

  // 3. Sort holdings within each sector alphabetically by ticker (A-Z) and render collapsible groups
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
      ? Fin.round((group.totalMarketValue / portfolio.totalStockMarketValue) * 100, 1)
      : 0;
    const groupPnlColor = group.totalUnrealizedGain >= 0 ? 'text-emerald-500' : 'text-rose-500';
    const iconCls = getSectorIconClass(group.sector, group.isEtf);
    const escapedSector = group.sector.replace(/'/g, "\'");

    // Collapsible Sector Header Row
    const headerTr = document.createElement('tr');
    headerTr.className = `sector-group-header cursor-pointer select-none transition border-y border-slate-200 dark:border-slate-700/80 ${
      group.isEtf
        ? 'bg-emerald-50/70 dark:bg-emerald-950/25 hover:bg-emerald-100/70 dark:hover:bg-emerald-950/40'
        : 'bg-slate-100/85 dark:bg-slate-800/75 hover:bg-slate-200/70 dark:hover:bg-slate-800'
    }`;
    headerTr.setAttribute('data-sector-group', group.sector);
    headerTr.setAttribute('aria-expanded', String(!isCollapsed));
    headerTr.title = `Click to ${isCollapsed ? 'expand' : 'collapse'} ${group.sector} (${group.items.length} holding${group.items.length === 1 ? '' : 's'})`;
    headerTr.addEventListener('click', () => toggleHoldingsSector(group.sector));

    headerTr.innerHTML = `
      <td colspan="3" class="py-2.5 px-4 sticky-col-mobile ${
        group.isEtf ? 'bg-emerald-50/95 dark:bg-slate-900' : 'bg-slate-100/95 dark:bg-slate-800'
      }">
        <div class="flex items-center gap-2.5">
          <span class="w-5 h-5 rounded-md bg-white/80 dark:bg-slate-700/80 border border-slate-200 dark:border-slate-600 flex items-center justify-center text-[10px] text-slate-600 dark:text-slate-300 transition-transform duration-200">
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
      <td class="py-2.5 px-4 text-right num-font text-xs font-bold text-slate-700 dark:text-slate-300">
        ${Fin.currency(group.totalCostBasis, false, group.currency)}
      </td>
      <td class="py-2.5 px-4 text-right text-[11px] text-slate-400 font-medium">
        Subtotal
      </td>
      <td class="py-2.5 px-4 text-right num-font text-xs font-extrabold text-slate-900 dark:text-white">
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
        <span class="inline-flex items-center gap-1">
          <span>${isCollapsed ? 'Expand' : 'Collapse'}</span>
        </span>
      </td>
    `;
    tbody.appendChild(headerTr);

    // Child Stock Rows (hidden when sector is collapsed)
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
        tr.title = `Click to view ${h.ticker} historical monthly price chart below`;
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
                  <span class="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-medium hidden sm:inline">${group.sector}</span>
                </div>
                <div class="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-[120px] sm:max-w-none">${h.companyName}</div>
              </div>
            </div>
          </td>
          <td class="py-3 px-4 text-right num-font font-medium text-slate-800 dark:text-slate-200">${Fin.shares(h.shares)}</td>
          <td class="py-3 px-4 text-right num-font text-slate-600 dark:text-slate-300">${Fin.currency(h.avgCost, false, h.currency)}</td>
          <td class="py-3 px-4 text-right num-font text-slate-600 dark:text-slate-300">${Fin.currency(h.totalCostBasis, false, h.currency)}</td>
          <td class="py-3 px-4 text-right">
            <div class="font-bold num-font text-slate-900 dark:text-white">${Fin.currency(h.currentPrice, false, h.currency)}</div>
            <div class="text-[11px] num-font ${priceChangeColor}">${Fin.percent(h.priceChangePct)}</div>
          </td>
          <td class="py-3 px-4 text-right font-bold num-font text-slate-900 dark:text-white">${Fin.currency(h.marketValue, false, h.currency)}</td>
          <td class="py-3 px-4 text-right">
            <div class="font-bold num-font ${pnlColor}">${Fin.currency(h.unrealizedGain, true, h.currency)}</div>
            <div class="text-[11px] num-font ${pnlColor} font-semibold">${Fin.percent(h.unrealizedGainPct)}</div>
          </td>
          <td class="py-3 px-4 text-right">
            <span class="px-2 py-0.5 rounded-full text-xs font-bold num-font ${h.yieldOnCost > 0 ? 'bg-cyan-50 dark:bg-cyan-950/60 text-cyan-600 dark:text-cyan-400' : 'text-slate-400'}">
              ${h.yieldOnCost.toFixed(2)}%
            </span>
          </td>
          <td class="py-3 px-4 text-center">
            <div class="flex items-center justify-center gap-1">
              <button onclick="event.stopPropagation(); selectStockForInlineChart('holdings', '${h.ticker}', true)" class="p-1.5 text-xs ${isSelected ? 'bg-brand-500 text-white' : 'text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-950/40'} rounded" title="Show Monthly Price Chart Below">
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
      <td class="py-3 px-4 font-bold text-slate-900 dark:text-white">${isCashOnly ? 'CASH' : tx.ticker}</td>
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
    const wlChartCard = document.getElementById('watchlist-stock-chart-card');
    if (wlChartCard) wlChartCard.classList.add('hidden');
  } else {
    wlEmpty.classList.add('hidden');
    state.watchlist.forEach(w => {
      const isSelected = selectedWatchlistTicker === w.ticker;
      const curPrice = state.prices[w.ticker]?.price || 0;
      const wlCurrency = state.prices[w.ticker]?.currency || state.fundamentals[w.ticker]?.currency || (w.ticker.endsWith('.HK') ? 'HKD' : (w.ticker.endsWith('.L') ? 'GBp' : 'USD'));
      const targetPrice = w.targetBuyPrice;
      const distPct = curPrice > 0 ? ((curPrice - targetPrice) / targetPrice) * 100 : 0;
      const isTriggered = curPrice > 0 && curPrice <= targetPrice;

      const tr = document.createElement('tr');
      tr.className = `cursor-pointer transition text-xs ${
        isSelected
          ? 'bg-purple-50/70 dark:bg-purple-950/30 border-l-4 border-l-purple-500'
          : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/40'
      }`;
      tr.title = `Click to view ${w.ticker} historical monthly price chart below`;
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
        <td class="py-3 px-4 text-slate-500 dark:text-slate-400">${w.sector || 'General'}</td>
        <td class="py-3 px-4 text-right font-bold num-font text-slate-900 dark:text-white">
          ${curPrice > 0 ? Fin.currency(curPrice, false, wlCurrency) : '<span class="text-slate-400 text-[11px]">Sync API</span>'}
        </td>
        <td class="py-3 px-4 text-right font-bold num-font text-purple-600 dark:text-purple-400">${Fin.currency(targetPrice, false, wlCurrency)}</td>
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
  } else if (target === 'holdings') {
    setTimeout(() => renderInlineStockChart('holdings'), 40);
  } else if (target === 'watchlist') {
    setTimeout(() => renderInlineStockChart('watchlist'), 40);
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

  // Proactively fetch live quote, monthly historicals & fundamentals via API
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

function setupEventListeners() {
  const on = (id, evt, fn) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener(evt, fn);
  };

  // Desktop & Mobile Navigation Tabs
  document.querySelectorAll('.nav-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      switchTab(tab.getAttribute('data-tab'));
    });
  });

  // Theme Toggle
  on('theme-toggle', 'click', () => {
    const isDark = document.documentElement.classList.toggle('dark');
    state.settings.darkMode = isDark;
    saveState();
    renderCharts();
    if (typeof AppLogger !== 'undefined') AppLogger.action('UI', `Switched theme to ${isDark ? 'Dark' : 'Light'} mode.`);
  });

  // Banner Configure API button
  on('banner-configure-api-btn', 'click', () => {
    switchTab('settings');
    const provEl = document.getElementById('setting-api-provider');
    if (provEl) provEl.focus();
  });

  // API Sync & Diagnostic Test Buttons
  on('header-sync-api-btn', 'click', () => syncAllMarketData(true));
  on('header-test-api-btn', 'click', () => {
    switchTab('settings');
    runAndRenderApiDiagnostics();
  });
  on('btn-run-api-diagnostic', 'click', () => runAndRenderApiDiagnostics());
  on('mobile-sync-api-btn', 'click', () => syncAllMarketData(true));
  on('btn-refresh-prices-now', 'click', () => syncAllMarketData(false));
  on('btn-sync-all-api', 'click', () => syncAllMarketData(true));
  on('btn-fetch-monthly-history', 'click', () => syncAllMarketData(true));
  on('btn-fetch-fundamentals-api', 'click', syncFundamentalsViaAPI);

  // Dashboard "Portfolio Historical Balance & Return" Chart Controls
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

  // Holdings Tab Inline Stock Historical Price Chart Period Buttons (1-Y, 2-Y, 3-Y, 5-Y, ALL)
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

  // Watchlist Tab Inline Stock Historical Price Chart Period Buttons (1-Y, 2-Y, 3-Y, 5-Y, ALL)
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

  // Close Modals
  document.querySelectorAll('.close-modal').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const m = e.target.closest('.modal-backdrop');
      if (m) m.classList.add('hidden');
    });
  });

  // Open Trade Modals
  on('btn-open-trade-modal', 'click', () => openTradeModal());
  on('btn-holdings-new-trade', 'click', () => openTradeModal());
  on('btn-expand-all-sectors', 'click', () => setAllHoldingsSectorsCollapsed(false));
  on('btn-collapse-all-sectors', 'click', () => setAllHoldingsSectorsCollapsed(true));
  on('btn-tx-add', 'click', () => openTradeModal());
  on('btn-quick-cash', 'click', () => openTradeModal(null, 'DEPOSIT'));
  on('btn-deposit-quick', 'click', () => openTradeModal(null, 'DEPOSIT'));

  // Lookup Live Price inside Trade Modal
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
    on(id, 'input', updateTradeCalculatedTotal);
  });
  on('form-trade', 'submit', handleTradeSubmit);

  // Dividend Modal
  on('btn-open-dividend-modal', 'click', () => {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('div-pay-date').value = today;
    document.getElementById('div-ex-date').value = today;
    openModal('modal-dividend');
  });
  on('div-drip-toggle', 'change', (e) => {
    const fields = document.getElementById('div-drip-fields');
    if (e.target.checked) {
      fields.classList.remove('hidden');
      const ticker = MarketAPI.normalizeTicker(document.getElementById('div-ticker').value);
      document.getElementById('div-drip-price').value = state.prices[ticker]?.price || '';
    } else {
      fields.classList.add('hidden');
    }
  });
  on('form-dividend', 'submit', handleDividendSubmit);

  // Watchlist Modal
  on('btn-open-watchlist-modal', 'click', () => openModal('modal-watchlist'));
  on('form-watchlist', 'submit', handleWatchlistSubmit);

  // Fair-Value Calculator Modal
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

  // Allocation View Toggle
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

  // Transaction Filters
  on('tx-search-ticker', 'input', renderTransactionsTable);
  on('tx-filter-type', 'change', renderTransactionsTable);

  // Provider Select Change & Save API Settings
  on('setting-api-provider', 'change', (e) => {
    state.settings.apiProvider = e.target.value;
    saveState();
    renderApiStatusUI();
    if (typeof AppLogger !== 'undefined') AppLogger.action('Settings', `Selected API provider: ${e.target.value.toUpperCase()}`);
  });

  on('btn-save-api-key', 'click', () => {
    state.settings.apiProvider = document.getElementById('setting-api-provider').value;
    state.settings.apiKey = document.getElementById('setting-api-key').value.trim();
    saveState();
    renderApiStatusUI();
    showToast(`Active API Provider: ${state.settings.apiProvider.toUpperCase()}`, 'success');
  });

  // Device Override Setting
  on('setting-device-override', 'change', (e) => {
    state.settings.deviceOverride = e.target.value;
    saveState();
    DeviceDetector.detect();
    renderCharts();
    showToast(`Display layout mode set to ${e.target.value.toUpperCase()}`, 'info');
  });

  // SheetJS Export & Import
  on('btn-export-excel', 'click', exportPortfolioToExcel);
  on('btn-trigger-import-excel', 'click', () => {
    const fileInput = document.getElementById('excel-file-input');
    if (fileInput) fileInput.click();
  });
  on('excel-file-input', 'change', (e) => {
    if (e.target.files?.[0]) restorePortfolioFromExcel(e.target.files[0]);
  });

  // Reset Database
  on('btn-reset-data', 'click', () => {
    const savedKey = state.settings.apiKey;
    const savedProvider = state.settings.apiProvider;
    state = createEmptyState();
    state.settings.apiKey = savedKey;
    state.settings.apiProvider = savedProvider;
    recalculatePortfolio();
    saveState();
    renderAll();
    if (typeof AppLogger !== 'undefined') AppLogger.warn('Portfolio', 'Local portfolio database reset by user.');
    showToast('Portfolio database cleared.', 'info');
  });

  // ==================== LOG TAB EVENT LISTENERS ====================
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
    if (typeof AppLogger !== 'undefined') {
      AppLogger.info('Boot', 'Duplicate bootstrapPortfolioApp() call skipped safely (idempotent guard).');
    }
    return;
  }
  window.__MYPORTFOLIO_BOOTSTRAPPED__ = true;

  if (typeof AppLogger !== 'undefined') {
    AppLogger.info('Boot', 'Starting myPortfolio bootstrap sequence (v2.4.1 • Build 20261019_1950)...');
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
    if (typeof AppLogger !== 'undefined') AppLogger.info('Boot', 'DOM event listeners bound across all 7 tabs & modals.');
  } catch (err) {
    if (typeof AppLogger !== 'undefined') AppLogger.error('Boot', `setupEventListeners failed: ${err.message}`, err);
  }

  try {
    renderAll();
    if (typeof AppLogger !== 'undefined') AppLogger.info('Boot', 'Initial UI & Dashboard charts rendered cleanly.');
  } catch (err) {
    if (typeof AppLogger !== 'undefined') AppLogger.error('Boot', `renderAll failed: ${err.message}`, err);
  }

  try {
    if (typeof AppLogger !== 'undefined') {
      AppLogger.runHealthCheck();
    }
  } catch (err) {
    if (typeof AppLogger !== 'undefined') AppLogger.error('Boot', `runHealthCheck failed: ${err.message}`, err);
  }
}

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', bootstrapPortfolioApp);
} else {
  bootstrapPortfolioApp();
}
