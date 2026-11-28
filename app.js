
// Automatically purge stale Service Worker caches from older builds so updated scripts & dividend schedules load immediately
if (typeof window !== 'undefined' && 'caches' in window) {
  caches.keys().then(keys => {
    keys.forEach(k => {
      if (k !== 'myportfolio-cache-v3.5.8-20261124_1220') {
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
 * @version 3.1.6
 * @build 20261101_1240
 * @description Main UI controller, Holdings & Watchlist tables with 52W/MoM/QoQ/YoY + Dividend Ex-Date/Yield +
 *   Trend Regime + 0-100 Buy/Sell Signal badges, Auto-Detected 2018+ Dividend Backfill, News & Catalysts Tab,
 *   Smart Cash Deployment & Rebalancing Simulator, Nominal/Real XIRR KPIs, and Full Settings Parameter Customizer.
 */

var CURATED_BASELINE_NEWS = [];

function updatePrivacyToggleUI() {
  const hide = Fin.isPrivacyMode();
  const btn = document.getElementById('privacy-toggle-btn');
  const icon = document.getElementById('privacy-toggle-icon');
  const lbl = document.getElementById('privacy-toggle-label');
  if (btn) {
    btn.className = hide
      ? 'h-7 sm:h-9 px-2 sm:px-3 rounded-lg border border-amber-500/40 bg-amber-500/15 text-amber-600 dark:text-amber-400 hover:bg-amber-500/25 flex items-center justify-center gap-1.5 text-[11px] sm:text-xs font-bold transition shadow-sm'
      : 'h-7 sm:h-9 px-2 sm:px-3 rounded-lg border border-slate-200 dark:border-dark-border bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center gap-1.5 text-[11px] sm:text-xs font-semibold transition';
    btn.setAttribute('aria-pressed', String(hide));
    btn.title = hide
      ? 'Monetary values, shares & avg cost are hidden (showing % & market prices only). Click to show all values.'
      : 'Click to hide all monetary values, number of shares, and average cost (show % & market prices only)';
  }
  if (icon) {
    icon.className = hide ? 'fa-solid fa-eye-slash text-amber-500' : 'fa-solid fa-eye text-brand-500';
  }
  if (lbl) {
    lbl.textContent = hide ? 'Show $' : 'Hide $';
  }
}
window.updatePrivacyToggleUI = updatePrivacyToggleUI;

function togglePrivacyMode() {
  const now = Date.now();
  if (now - (window._lastPrivacyToggleTs || 0) < 200) return;
  window._lastPrivacyToggleTs = now;

  if (!state.settings) state.settings = {};
  state.settings.hideMonetaryValues = !Boolean(state.settings.hideMonetaryValues);
  saveState();
  updatePrivacyToggleUI();
  renderAll();
  showToast(
    state.settings.hideMonetaryValues
      ? 'Privacy Mode On: Monetary values, shares & avg cost hidden (% and market prices shown)'
      : 'Privacy Mode Off: All monetary values, shares & avg cost visible',
    'info'
  );
}
window.togglePrivacyMode = togglePrivacyMode;
window._appTogglePrivacyMode = togglePrivacyMode;

function updateThemeUI(isDark) {
  if (typeof isDark === 'undefined') {
    isDark = document.documentElement.classList.contains('dark');
  }
  const badge = document.getElementById('settings-theme-badge');
  const btnIcon = document.getElementById('settings-theme-btn-icon');
  const btnLabel = document.getElementById('settings-theme-btn-label');
  const btnDark = document.getElementById('btn-set-dark-theme');
  const btnLight = document.getElementById('btn-set-light-theme');

  if (badge) {
    badge.innerHTML = isDark
      ? '<i class="fa-solid fa-moon mr-1 text-indigo-400"></i> Dark Mode Active'
      : '<i class="fa-solid fa-sun mr-1 text-amber-500"></i> Light Mode Active';
  }
  if (btnIcon) {
    btnIcon.className = isDark ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
  }
  if (btnLabel) {
    btnLabel.textContent = isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode';
  }
  if (btnDark && btnLight) {
    if (isDark) {
      btnDark.className = 'px-3 py-1.5 text-xs font-semibold rounded-lg border border-indigo-500 bg-indigo-500/20 text-indigo-400 flex items-center gap-1.5 transition';
      btnLight.className = 'px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-1.5 transition';
    } else {
      btnDark.className = 'px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-1.5 transition';
      btnLight.className = 'px-3 py-1.5 text-xs font-semibold rounded-lg border border-amber-500 bg-amber-500/20 text-amber-600 flex items-center gap-1.5 transition';
    }
  }
}
window.updateThemeUI = updateThemeUI;

function setTheme(isDark) {
  if (isDark) {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
  if (!state.settings) state.settings = {};
  state.settings.darkMode = isDark;
  saveState();
  updateThemeUI(isDark);
  try {
    if (typeof renderCharts === 'function') renderCharts();
  } catch (_) {}
  if (typeof AppLogger !== 'undefined') {
    AppLogger.action('UI', `Switched theme to ${isDark ? 'Dark' : 'Light'} mode.`);
  }
}
window.setTheme = setTheme;

var _dirtyTabs = new Set();
var _initialBootRenderCompleted = false;
var _allTabNames = ['dashboard', 'holdings', 'transactions', 'dividends', 'watchlist', 'news', 'settings', 'logs'];

function markTabDirty(tabName) {
  if (tabName) _dirtyTabs.add(tabName);
}
window.markTabDirty = markTabDirty;

function getActiveTabName() {
  for (let i = 0; i < _allTabNames.length; i++) {
    const t = _allTabNames[i];
    const el = document.getElementById(`tab-content-${t}`);
    if (el && !el.classList.contains('hidden')) return t;
  }
  return 'dashboard';
}
window.getActiveTabName = getActiveTabName;

function renderSingleTabContent(tabName) {
  switch (tabName) {
    case 'dashboard':
      try { renderKPIs(); } catch (err) { if (typeof AppLogger !== 'undefined') AppLogger.error('UI', `renderKPIs failed: ${err.message}`, err); }
      try { renderDashboardActionRadar(); } catch (err) { if (typeof AppLogger !== 'undefined') AppLogger.error('UI', `renderDashboardActionRadar failed: ${err.message}`, err); }
      try { populateHistorySelector(); } catch (err) { if (typeof AppLogger !== 'undefined') AppLogger.error('UI', `populateHistorySelector failed: ${err.message}`, err); }
      try { renderCharts(); } catch (err) { if (typeof AppLogger !== 'undefined') AppLogger.error('Charts', `renderCharts failed: ${err.message}`, err); }
      break;
    case 'holdings':
      try { populateHistorySelector(); } catch (err) { if (typeof AppLogger !== 'undefined') AppLogger.error('UI', `populateHistorySelector failed: ${err.message}`, err); }
      try { renderHoldingsTable(); } catch (err) { if (typeof AppLogger !== 'undefined') AppLogger.error('UI', `renderHoldingsTable failed: ${err.message}`, err); }
      try { renderInlineStockChart('holdings'); } catch (err) { if (typeof AppLogger !== 'undefined') AppLogger.error('Charts', `renderInlineStockChart(holdings) failed: ${err.message}`, err); }
      break;
    case 'transactions':
      try { renderTradeSimulationTable(); } catch (err) { if (typeof AppLogger !== 'undefined') AppLogger.error('UI', `renderTradeSimulationTable failed: ${err.message}`, err); }
      try { renderAnnualTradeScorecard(); } catch (err) { if (typeof AppLogger !== 'undefined') AppLogger.error('UI', `renderAnnualTradeScorecard failed: ${err.message}`, err); }
      try { renderMonthlyTradeMatrix(); } catch (err) { if (typeof AppLogger !== 'undefined') AppLogger.error('UI', `renderMonthlyTradeMatrix failed: ${err.message}`, err); }
      try { renderTransactionsTable(); } catch (err) { if (typeof AppLogger !== 'undefined') AppLogger.error('UI', `renderTransactionsTable failed: ${err.message}`, err); }
      try { if (typeof renderTradesBalanceCashflowChart === 'function') renderTradesBalanceCashflowChart(); } catch (err) { if (typeof AppLogger !== 'undefined') AppLogger.error('Charts', `renderTradesBalanceCashflowChart failed: ${err.message}`, err); }
      break;
    case 'dividends':
      try { renderDividendsTable(); } catch (err) { if (typeof AppLogger !== 'undefined') AppLogger.error('UI', `renderDividendsTable failed: ${err.message}`, err); }
      try { if (typeof renderProjectedDividendCalendarChart === 'function') renderProjectedDividendCalendarChart(); } catch (err) { if (typeof AppLogger !== 'undefined') AppLogger.error('Charts', `renderProjectedDividendCalendarChart failed: ${err.message}`, err); }
      break;
    case 'watchlist':
      try { renderWatchlistAndFundamentals(); } catch (err) { if (typeof AppLogger !== 'undefined') AppLogger.error('UI', `renderWatchlistAndFundamentals failed: ${err.message}`, err); }
      try { renderInlineStockChart('watchlist'); } catch (err) { if (typeof AppLogger !== 'undefined') AppLogger.error('Charts', `renderInlineStockChart(watchlist) failed: ${err.message}`, err); }
      break;
    case 'news':
      try { renderNewsTab(); } catch (err) { if (typeof AppLogger !== 'undefined') AppLogger.error('UI', `renderNewsTab failed: ${err.message}`, err); }
      break;
    case 'settings':
      try { renderQuantSettingsUI(); } catch (err) { if (typeof AppLogger !== 'undefined') AppLogger.error('UI', `renderQuantSettingsUI failed: ${err.message}`, err); }
      try { renderVersionRegistryUI(); } catch (err) { if (typeof AppLogger !== 'undefined') AppLogger.error('UI', `renderVersionRegistryUI failed: ${err.message}`, err); }
      break;
    case 'logs':
      try {
        if (typeof AppLogger !== 'undefined') {
          AppLogger.renderHealthCheckPanel();
          AppLogger.renderLogTable();
        }
      } catch (_) {}
      break;
  }
}

function renderAll(forceAll = false) {
  try {
    if (!portfolio) recalculatePortfolio();
  } catch (err) {
    if (typeof AppLogger !== 'undefined') AppLogger.error('Portfolio', `recalculatePortfolio failed: ${err.message}`, err);
  }
  try { updatePrivacyToggleUI(); } catch (_) {}
  try { updateThemeUI(); } catch (_) {}
  try { renderApiStatusUI(); } catch (err) { if (typeof AppLogger !== 'undefined') AppLogger.error('UI', `renderApiStatusUI failed: ${err.message}`, err); }
  try { updateTabCounters(); } catch (err) { if (typeof AppLogger !== 'undefined') AppLogger.error('UI', `updateTabCounters failed: ${err.message}`, err); }
  try { updateBackupAgeBadge(); } catch (_) {}
  try { if (typeof refreshSectorDatalist === 'function') refreshSectorDatalist(); } catch (_) {}
  try {
    if (typeof AppLogger !== 'undefined') {
      AppLogger.updateLogBadgesAndUI();
    }
  } catch (_) {}

  if (!_initialBootRenderCompleted || forceAll) {
    _allTabNames.forEach(t => renderSingleTabContent(t));
    _dirtyTabs.clear();
    _initialBootRenderCompleted = true;
    return;
  }

  // P1 Optimization: Mark background tabs dirty and immediately render only the active visible tab
  _allTabNames.forEach(t => _dirtyTabs.add(t));
  const activeTab = getActiveTabName();
  renderSingleTabContent(activeTab);
  _dirtyTabs.delete(activeTab);
}

function formatUpdateTimestamp(rawTs) {
  if (!rawTs) return 'Not synced yet';
  const d = new Date(rawTs);
  if (isNaN(d.getTime())) return String(rawTs);
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function renderFooterUpdateTimestamps() {
  const histEl = document.getElementById('footer-hist-prices-updated');
  const newsEl = document.getElementById('footer-news-analysis-updated');

  const histTs = state?.settings?.lastHistoricalPricesUpdate || null;
  let newsTs = state?.settings?.lastNewsAnalysisUpdate || null;
  if (!newsTs && Array.isArray(state?.companyNews) && state.companyNews.length > 0) {
    newsTs = state.companyNews[0]?.publishedAt || null;
  }

  if (histEl) {
    histEl.textContent = formatUpdateTimestamp(histTs);
  }
  if (newsEl) {
    newsEl.textContent = formatUpdateTimestamp(newsTs);
  }
}
window.renderFooterUpdateTimestamps = renderFooterUpdateTimestamps;

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
  renderFooterUpdateTimestamps();
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
    const heldItem = (portfolio?.allHoldings || portfolio?.activeHoldings || []).find(h => h.ticker === ticker);
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
      const tableId = tabType === 'holdings' ? 'holdings-main-table' : 'watchlist-main-table';
      const tableEl = document.getElementById(tableId);
      const scrollBox = tableEl ? tableEl.closest('.scrollable-portfolio-table-box') : null;
      const anchorEl = scrollBox || tableEl || cardEl;
      const topHeader = document.getElementById('app-top-header');
      const headerOffset = (topHeader ? topHeader.offsetHeight : 56) + 4;
      const rect = anchorEl.getBoundingClientRect();
      const targetScrollY = Math.max(0, window.scrollY + rect.top - headerOffset);
      window.scrollTo({ top: targetScrollY, behavior: 'smooth' });
    }, 40);
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

  const effectiveSyncTs = state?.settings?.lastApiSync
    || state?.settings?.lastHistoricalPricesUpdate
    || null;
  const formattedSyncDt = formatUpdateTimestamp(effectiveSyncTs);
  if (syncLabel) {
    syncLabel.textContent = effectiveSyncTs ? `Last synced: ${formattedSyncDt}` : 'Never synced';
  }
  const headerSyncLabel = document.getElementById('header-last-sync-label');
  if (headerSyncLabel) {
    headerSyncLabel.textContent = effectiveSyncTs ? `Last Sync: ${formattedSyncDt}` : 'Last Sync: Not synced yet';
  }
  const mobileSyncLabel = document.getElementById('mobile-last-sync-label');
  if (mobileSyncLabel) {
    mobileSyncLabel.textContent = effectiveSyncTs ? formattedSyncDt.slice(0, 16) : 'Not synced';
  }

  const provSelect = document.getElementById('setting-api-provider');
  const devSelect = document.getElementById('setting-device-override');
  const ghRepoInput = document.getElementById('setting-github-repo');
  const ghBranchInput = document.getElementById('setting-github-branch');
  const ghTokenInput = document.getElementById('setting-github-token');
  const ghStatusBadge = document.getElementById('github-token-status-badge');

  if (keyInput && document.activeElement !== keyInput) keyInput.value = state.settings.apiKey || '';
  if (provSelect) provSelect.value = state.settings.apiProvider || 'yahoo';
  if (devSelect) devSelect.value = state.settings.deviceOverride || 'auto';
  if (ghRepoInput && document.activeElement !== ghRepoInput) ghRepoInput.value = state.settings.githubRepo || 'ahneth/myPortfolio';
  if (ghBranchInput && document.activeElement !== ghBranchInput) ghBranchInput.value = state.settings.githubBranch || 'main';
  if (ghTokenInput && document.activeElement !== ghTokenInput) ghTokenInput.value = state.settings.githubToken || '';
  if (ghStatusBadge) {
    const hasPat = Boolean((state.settings.githubToken || '').trim());
    ghStatusBadge.textContent = hasPat ? '(Token Saved • Workflow Dispatch Enabled)' : '(Optional • Add PAT to trigger GitHub Actions runs)';
    ghStatusBadge.className = hasPat ? 'text-[11px] font-normal text-emerald-500' : 'text-[11px] font-normal text-amber-500';
  }
}

function renderKPIs() {
  const baseCurr = portfolio.baseCurrency || state.settings.currency || 'HKD';
  const hideMoney = Fin.isPrivacyMode();
  const cashPct = portfolio.totalPortfolioValue > 0
    ? Fin.round((Math.max(0, portfolio.cashBalance) / portfolio.totalPortfolioValue) * 100, 1)
    : 0;
  const investedPct = portfolio.totalPortfolioValue > 0
    ? Fin.round(Math.max(0, 100 - cashPct), 1)
    : 0;
  const totReturnBase = (portfolio.totalUnrealizedGain || 0) + (portfolio.totalRealizedPnL || 0) + (portfolio.totalDividendsEarned || 0);
  const kpiCumCostBase = (portfolio.totalCumulativeBuyCostBasis && portfolio.totalCumulativeBuyCostBasis > 0)
    ? portfolio.totalCumulativeBuyCostBasis
    : (portfolio.totalStockCostBasis || 0);
  const totReturnPct = kpiCumCostBase > 0
    ? Fin.round((totReturnBase / kpiCumCostBase) * 100, 2)
    : 0;
  const realizedPct = kpiCumCostBase > 0
    ? Fin.round(((portfolio.totalRealizedPnL || 0) / kpiCumCostBase) * 100, 2)
    : 0;
  const avgYocKpi = portfolio.totalStockCostBasis > 0
    ? Fin.round((portfolio.totalDividendsEarned / portfolio.totalStockCostBasis) * 100, 2)
    : 0;

  document.getElementById('kpi-portfolio-value').textContent = hideMoney
    ? Fin.percent(totReturnPct, true)
    : Fin.currency(portfolio.totalPortfolioValue, false, baseCurr);
  const portSubEl = document.getElementById('kpi-portfolio-sublabel');
  if (portSubEl) {
    portSubEl.textContent = hideMoney ? 'Total Return % (Dollar Amounts Hidden)' : 'Total Portfolio Net Worth';
  }

  // A2: Live 1D P&L Badge on Hero Card
  const dayValEl = document.getElementById('kpi-day-val');
  const dayPctEl = document.getElementById('kpi-day-pct');
  const dayBadgeEl = document.getElementById('kpi-day-badge');
  const dayPnL = Number(portfolio.totalDayPnL || 0);
  const dayPnLPct = Number(portfolio.totalDayPnLPct || 0);
  const dayIsPos = dayPnL >= 0;

  const formattedDayAmt = Fin.currency(dayPnL, true, baseCurr).replace(/-/g, '−');
  const formattedDayPct = Fin.percent(dayPnLPct, true).replace(/-/g, '−');
  if (dayValEl) {
    dayValEl.textContent = hideMoney ? '1D P&L:' : `1D: ${formattedDayAmt}`;
  }
  if (dayPctEl) {
    dayPctEl.textContent = `(${formattedDayPct})`;
  }
  if (dayBadgeEl) {
    dayBadgeEl.title = "Today's 1-Day Market Value Fluctuation vs. Previous Market Close";
    dayBadgeEl.className = `px-2 sm:px-2.5 py-0.5 rounded-full text-[10.5px] sm:text-[11px] font-bold num-font inline-flex items-center gap-1 whitespace-nowrap shrink-0 border ${
      dayIsPos
        ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
        : 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30'
    }`;
  }

  // A2: Micro Allocation Bar (Invested vs Cash)
  const heroBarInv = document.getElementById('hero-bar-invested');
  const heroBarCash = document.getElementById('hero-bar-cash');
  const heroTxtInv = document.getElementById('hero-invested-pct');
  const heroTxtCash = document.getElementById('hero-cash-pct');
  if (heroBarInv) heroBarInv.style.width = `${investedPct}%`;
  if (heroBarCash) heroBarCash.style.width = `${cashPct}%`;
  if (heroTxtInv) heroTxtInv.textContent = `${investedPct}%`;
  if (heroTxtCash) heroTxtCash.textContent = `${cashPct}%`;

  document.getElementById('kpi-cash-balance').textContent = hideMoney
    ? `${cashPct}%`
    : Fin.currency(portfolio.cashBalance, false, baseCurr);
  document.getElementById('kpi-cash-pct').textContent = hideMoney ? 'of total portfolio' : `${cashPct}% of total`;

  document.getElementById('kpi-cost-basis').textContent = hideMoney
    ? `${investedPct}%`
    : Fin.currency(portfolio.totalStockCostBasis, false, baseCurr);
  const costSubEl = document.getElementById('kpi-cost-basis')?.nextElementSibling;
  if (costSubEl) {
    costSubEl.innerHTML = hideMoney ? '<span>Invested Weight %</span>' : '<span>Active Cost Basis</span>';
  }

  const uEl = document.getElementById('kpi-unrealized-val');
  const uPctEl = document.getElementById('kpi-unrealized-pct');
  uEl.textContent = hideMoney
    ? Fin.percent(portfolio.totalUnrealizedGainPct, true)
    : Fin.currency(portfolio.totalUnrealizedGain, true, baseCurr);
  uPctEl.textContent = hideMoney
    ? 'Unrealized Return %'
    : Fin.percent(portfolio.totalUnrealizedGainPct, true);

  const uPositive = portfolio.totalUnrealizedGain >= 0;
  uEl.className = `mt-1.5 sm:mt-2 text-lg sm:text-xl font-bold num-font tracking-tight ${uPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`;
  uPctEl.className = `mt-1 flex items-center text-[11px] font-semibold num-font ${uPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`;

  const rEl = document.getElementById('kpi-realized-val');
  rEl.textContent = hideMoney
    ? Fin.percent(realizedPct, true)
    : Fin.currency(portfolio.totalRealizedPnL, true, baseCurr);
  rEl.className = `mt-1.5 sm:mt-2 text-lg sm:text-xl font-bold num-font tracking-tight ${portfolio.totalRealizedPnL >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`;

  document.getElementById('kpi-dividends-val').textContent = hideMoney
    ? `${avgYocKpi.toFixed(2)}% YoC`
    : Fin.currency(portfolio.totalDividendsEarned, false, baseCurr);
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
          ${hideMoney ? Fin.percent(top.unrealizedGainPct) : `${Fin.percent(top.unrealizedGainPct)} (${Fin.currency(top.unrealizedGain, true, top.currency)})`}
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
    const wm = cur > 0 ? computeStockPriceMetrics(w.ticker, cur) : null;
    const activeBuyTarget = Number(w.customBuyPrice || wm?.customBuyPrice || wm?.recommendedBuyPrice || 0);
    return cur > 0 && activeBuyTarget > 0 && cur <= activeBuyTarget * 1.005;
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
  const holdingsPool = (portfolio.allHoldings && portfolio.allHoldings.length > 0)
    ? portfolio.allHoldings
    : (portfolio.activeHoldings || []);
  if (holdingsPool.length > 0) {
    const stillInPool = holdingsPool.some(h => h.ticker === selectedHoldingsTicker);
    if (!stillInPool && !window.__holdingsChartManuallyClosed) {
      selectedHoldingsTicker = (portfolio.activeHoldings?.[0] || holdingsPool[0]).ticker;
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
  const ticker = holding?.ticker || '';
  const fund = state?.fundamentals?.[ticker] || {};
  const wlMatch = (Array.isArray(state?.watchlist) ? state.watchlist.find(w => w.ticker === ticker) : null);
  if (fund._userCustomSector && fund.sector) {
    return String(fund.sector).trim();
  }
  const rawSector = String(holding?.sector || wlMatch?.sector || fund.sector || '').trim();
  if (rawSector && rawSector !== 'Equities') {
    return rawSector;
  }
  const staticMeta = MarketAPI.getStaticProfile(ticker);
  if (staticMeta?.sector && staticMeta.sector !== 'Equities') {
    return staticMeta.sector;
  }
  if (MarketAPI.isEtfSector('', ticker, holding?.companyName || fund.name || staticMeta?.name)) {
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
  const isCollapsed = !state.settings.collapsedSectors[sectorName];
  state.settings.collapsedSectors[sectorName] = isCollapsed;
  saveState();

  const tbody = document.getElementById('holdings-table-body');
  if (tbody) {
    let headerFound = false;
    tbody.querySelectorAll('tr.sector-group-header').forEach(hdr => {
      if (hdr.getAttribute('data-sector-group') === sectorName) {
        headerFound = true;
        hdr.setAttribute('aria-expanded', String(!isCollapsed));
        const chev = hdr.querySelector('[data-sector-chevron], .fa-chevron-right, .fa-chevron-down');
        if (chev) {
          chev.classList.toggle('fa-chevron-right', isCollapsed);
          chev.classList.toggle('fa-chevron-down', !isCollapsed);
        }
        const lbl = hdr.querySelector('[data-sector-toggle-label]');
        if (lbl) lbl.textContent = isCollapsed ? 'Expand' : 'Collapse';
      }
    });
    if (headerFound) {
      tbody.querySelectorAll('tr[data-sector-item]').forEach(row => {
        if (row.getAttribute('data-sector-item') === sectorName) {
          row.classList.toggle('hidden', isCollapsed);
        }
      });
      return;
    }
  }
  renderHoldingsTable();
}
window.toggleHoldingsSector = toggleHoldingsSector;

function setAllHoldingsSectorsCollapsed(collapsed) {
  if (!state.settings.collapsedSectors) state.settings.collapsedSectors = {};
  const isCollapsed = Boolean(collapsed);
  (portfolio?.allHoldings || portfolio?.activeHoldings || []).forEach(h => {
    const sec = getCanonicalHoldingsSector(h);
    state.settings.collapsedSectors[sec] = isCollapsed;
  });
  saveState();

  const tbody = document.getElementById('holdings-table-body');
  if (tbody && tbody.querySelectorAll('tr.sector-group-header').length > 0) {
    tbody.querySelectorAll('tr.sector-group-header').forEach(hdr => {
      hdr.setAttribute('aria-expanded', String(!isCollapsed));
      const chev = hdr.querySelector('[data-sector-chevron], .fa-chevron-right, .fa-chevron-down');
      if (chev) {
        chev.classList.toggle('fa-chevron-right', isCollapsed);
        chev.classList.toggle('fa-chevron-down', !isCollapsed);
      }
      const lbl = hdr.querySelector('[data-sector-toggle-label]');
      if (lbl) lbl.textContent = isCollapsed ? 'Expand' : 'Collapse';
    });
    tbody.querySelectorAll('tr[data-sector-item]').forEach(row => {
      row.classList.toggle('hidden', isCollapsed);
    });
    return;
  }
  renderHoldingsTable();
}
window.setAllHoldingsSectorsCollapsed = setAllHoldingsSectorsCollapsed;

function getCanonicalWatchlistSector(w) {
  const ticker = w?.ticker || '';
  const fund = state?.fundamentals?.[ticker] || {};
  const staticMeta = MarketAPI.getStaticProfile(ticker);
  const userSec = String(w?.sector || '').trim();
  if (userSec) return userSec;
  if (fund._userCustomSector && fund.sector) return String(fund.sector).trim();
  const fundSec = String(fund.sector || '').trim();
  if (fundSec && fundSec !== 'Equities') return fundSec;
  const staticSec = String(staticMeta?.sector || '').trim();
  if (staticSec && staticSec !== 'Equities') return staticSec;
  const compName = w?.name || fund.name || staticMeta?.name || '';
  if (MarketAPI.isEtfSector('', ticker, compName)) return 'Index ETF';
  return 'Equities';
}

function refreshSectorDatalist() {
  const dl = document.getElementById('sector-suggestions-datalist');
  if (!dl) return;
  const defaults = [
    'Index ETF',
    'Technology',
    'Financials',
    'Healthcare',
    'Consumer Discretionary',
    'Consumer Staples',
    'Energy',
    'Industrials',
    'Real Estate',
    'Utilities',
    'Communications',
    'Equities'
  ];
  const customSet = new Set(defaults);
  (portfolio?.allHoldings || portfolio?.activeHoldings || []).forEach(h => {
    const s = getCanonicalHoldingsSector(h);
    if (s) customSet.add(s);
  });
  (state?.watchlist || []).forEach(w => {
    const s = getCanonicalWatchlistSector(w);
    if (s) customSet.add(s);
  });
  Object.values(state?.fundamentals || {}).forEach(f => {
    if (f?.sector) customSet.add(String(f.sector).trim());
  });
  const sorted = Array.from(customSet).filter(Boolean).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  dl.innerHTML = sorted.map(s => `<option value="${s.replace(/"/g, '&quot;')}"></option>`).join('');
}
window.refreshSectorDatalist = refreshSectorDatalist;

function toggleWatchlistSector(sectorName) {
  if (!state.settings.collapsedWatchlistSectors) state.settings.collapsedWatchlistSectors = {};
  const isCollapsed = !state.settings.collapsedWatchlistSectors[sectorName];
  state.settings.collapsedWatchlistSectors[sectorName] = isCollapsed;
  saveState();

  const wlTbody = document.getElementById('watchlist-table-body');
  if (wlTbody) {
    let headerFound = false;
    wlTbody.querySelectorAll('tr.sector-group-header').forEach(hdr => {
      if (hdr.getAttribute('data-wl-sector-group') === sectorName) {
        headerFound = true;
        hdr.setAttribute('aria-expanded', String(!isCollapsed));
        const chev = hdr.querySelector('[data-wl-sector-chevron], .fa-chevron-right, .fa-chevron-down');
        if (chev) {
          chev.classList.toggle('fa-chevron-right', isCollapsed);
          chev.classList.toggle('fa-chevron-down', !isCollapsed);
        }
        const lbl = hdr.querySelector('[data-wl-sector-toggle-label]');
        if (lbl) lbl.textContent = isCollapsed ? 'Expand' : 'Collapse';
      }
    });
    if (headerFound) {
      wlTbody.querySelectorAll('tr[data-wl-sector-item]').forEach(row => {
        if (row.getAttribute('data-wl-sector-item') === sectorName) {
          row.classList.toggle('hidden', isCollapsed);
        }
      });
      return;
    }
  }
  renderWatchlistAndFundamentals();
}
window.toggleWatchlistSector = toggleWatchlistSector;

function setAllWatchlistSectorsCollapsed(collapsed) {
  if (!state.settings.collapsedWatchlistSectors) state.settings.collapsedWatchlistSectors = {};
  const isCollapsed = Boolean(collapsed);
  (state?.watchlist || []).forEach(w => {
    const sec = getCanonicalWatchlistSector(w);
    state.settings.collapsedWatchlistSectors[sec] = isCollapsed;
  });
  saveState();

  const wlTbody = document.getElementById('watchlist-table-body');
  if (wlTbody && wlTbody.querySelectorAll('tr.sector-group-header').length > 0) {
    wlTbody.querySelectorAll('tr.sector-group-header').forEach(hdr => {
      hdr.setAttribute('aria-expanded', String(!isCollapsed));
      const chev = hdr.querySelector('[data-wl-sector-chevron], .fa-chevron-right, .fa-chevron-down');
      if (chev) {
        chev.classList.toggle('fa-chevron-right', isCollapsed);
        chev.classList.toggle('fa-chevron-down', !isCollapsed);
      }
      const lbl = hdr.querySelector('[data-wl-sector-toggle-label]');
      if (lbl) lbl.textContent = isCollapsed ? 'Expand' : 'Collapse';
    });
    wlTbody.querySelectorAll('tr[data-wl-sector-item]').forEach(row => {
      row.classList.toggle('hidden', isCollapsed);
    });
    return;
  }
  renderWatchlistAndFundamentals();
}
window.setAllWatchlistSectorsCollapsed = setAllWatchlistSectorsCollapsed;

var CANONICAL_SIGNAL_LABELS = [
  'STRONG BUY',
  'ACCUMULATE',
  'HOLD',
  'TRIM / OFFLOAD',
  'SELL / AVOID'
];

function populateSignalFilterDropdown(selectEl, signalLabelsList) {
  if (!selectEl) return 'ALL';
  const prevVal = selectEl.value || 'ALL';
  const counts = {};
  CANONICAL_SIGNAL_LABELS.forEach(lbl => { counts[lbl] = 0; });
  signalLabelsList.forEach(lbl => {
    const key = lbl || 'HOLD';
    counts[key] = (counts[key] || 0) + 1;
  });

  const total = signalLabelsList.length;
  const optionsHtml = [
    `<option value="ALL">All Signals (${total})</option>`,
    ...CANONICAL_SIGNAL_LABELS.map(lbl => {
      const cnt = counts[lbl] || 0;
      return `<option value="${lbl}" ${lbl === prevVal ? 'selected' : ''}>${lbl} (${cnt})</option>`;
    })
  ].join('');

  selectEl.innerHTML = optionsHtml;
  if (prevVal !== 'ALL' && !CANONICAL_SIGNAL_LABELS.includes(prevVal)) {
    selectEl.value = 'ALL';
    return 'ALL';
  }
  selectEl.value = prevVal;
  return prevVal;
}


function formatPctTo52wCell(targetVal, livePrice, mode = 'low') {
  const tVal = Number(targetVal);
  const pVal = Number(livePrice);
  if (!Number.isFinite(tVal) || tVal <= 0 || !Number.isFinite(pVal) || pVal <= 0) {
    return '<span class="text-slate-400 text-[11px]">-</span>';
  }
  const pct = Fin.round(((tVal / pVal) - 1) * 100, 1);
  if (mode === 'low') {
    // % to 52W Low = 52W Low / Live Price - 1 (<= 0%); bar grows right-to-left (-100% = full, 0% = empty)
    const barW = Math.min(100, Math.max(0, Math.abs(Math.min(0, pct))));
    return `
      <div class="relative overflow-hidden rounded px-2 py-0.5 min-w-[78px] text-left bg-slate-100/60 dark:bg-slate-800/50 border border-slate-200/50 dark:border-slate-700/50" title="% to 52W Low = (52W Low / Live Price) - 1 = ${Fin.percent(pct, true)}">
        <div class="absolute inset-y-0 right-0 bg-rose-500/25 dark:bg-rose-500/30 pointer-events-none transition-all" style="width:${barW.toFixed(1)}%"></div>
        <span class="relative z-10 font-mono font-bold text-[11px] ${pct < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-500 dark:text-slate-300'}">${Fin.percent(pct, true)}</span>
      </div>
    `;
  }
  // % to 52W High = 52W High / Live Price - 1 (>= 0%); bar grows left-to-right (0% = empty, 100% = full)
  const barW = Math.min(100, Math.max(0, pct));
  return `
    <div class="relative overflow-hidden rounded px-2 py-0.5 min-w-[74px] bg-slate-100/60 dark:bg-slate-800/50 border border-slate-200/50 dark:border-slate-700/50" title="% to 52W High = (52W High / Live Price) - 1 = ${Fin.percent(pct, true)}">
      <div class="absolute inset-y-0 left-0 bg-emerald-500/25 dark:bg-emerald-500/30 pointer-events-none transition-all" style="width:${barW.toFixed(1)}%"></div>
      <span class="relative z-10 font-mono font-bold text-[11px] ${pct > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-300'}">${Fin.percent(pct, true)}</span>
    </div>
  `;
}
window.formatPctTo52wCell = formatPctTo52wCell;

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

function formatTargetLevelCell(customVal, recVal, currentPrice, currency, colorClass, labelTitle = 'Target') {
  const cVal = (Number.isFinite(Number(customVal)) && Number(customVal) > 0) ? Number(customVal) : null;
  const rVal = (Number.isFinite(Number(recVal)) && Number(recVal) > 0) ? Number(recVal) : null;
  const activeVal = cVal || rVal;
  if (!activeVal) {
    return '<span class="text-slate-400 text-xs font-mono">-</span>';
  }
  const diffPct = (currentPrice > 0) ? Fin.round(((activeVal - currentPrice) / currentPrice) * 100, 1) : null;

  // U2: Target Buy / Sell / Stop-Loss Proximity Badges
  let proximityBadge = '';
  const isBuy = labelTitle.toLowerCase().includes('buy');
  const isSell = labelTitle.toLowerCase().includes('sell');
  const isStop = labelTitle.toLowerCase().includes('stop');

  if (currentPrice > 0 && activeVal > 0) {
    if (isBuy) {
      if (currentPrice <= activeVal * 1.002) {
        proximityBadge = '<span class="inline-block mt-0.5 px-1 py-0 rounded text-[8px] font-bold bg-sky-500/20 text-sky-600 dark:text-sky-300 border border-sky-500/40 leading-tight">BUY ZONE</span>';
      } else if (((currentPrice - activeVal) / activeVal) <= 0.025) {
        const away = (((currentPrice - activeVal) / activeVal) * 100).toFixed(1);
        proximityBadge = `<span class="inline-block mt-0.5 px-1 py-0 rounded text-[8px] font-semibold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 leading-tight">+${away}% away</span>`;
      }
    } else if (isSell) {
      if (currentPrice >= activeVal * 0.998) {
        proximityBadge = '<span class="inline-block mt-0.5 px-1 py-0 rounded text-[8px] font-bold bg-pink-500/20 text-pink-600 dark:text-pink-300 border border-pink-500/40 leading-tight">TARGET HIT</span>';
      } else if (((activeVal - currentPrice) / currentPrice) <= 0.025) {
        const away = (((activeVal - currentPrice) / currentPrice) * 100).toFixed(1);
        proximityBadge = `<span class="inline-block mt-0.5 px-1 py-0 rounded text-[8px] font-semibold bg-pink-500/10 text-pink-500 border border-pink-500/20 leading-tight">${away}% away</span>`;
      }
    } else if (isStop) {
      if (currentPrice <= activeVal * 1.001) {
        proximityBadge = '<span class="inline-block mt-0.5 px-1 py-0 rounded text-[8px] font-extrabold bg-red-600 text-white animate-pulse leading-tight">STOP BREACHED</span>';
      } else if (((currentPrice - activeVal) / currentPrice) <= 0.025) {
        proximityBadge = '<span class="inline-block mt-0.5 px-1 py-0 rounded text-[8px] font-bold bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/30 leading-tight">Near Stop</span>';
      }
    }
  }

  if (cVal) {
    const recSub = rVal ? `Rec: ${Fin.currency(rVal, false, currency)}` : (diffPct !== null ? Fin.percent(diffPct, true) : 'Custom');
    const driftPct = (cVal && rVal && rVal > 0) ? Fin.round(((cVal - rVal) / rVal) * 100, 1) : 0;
    const staleWarn = Math.abs(driftPct) > 15.0
      ? `<span class="inline-block ml-1 px-1 py-0 rounded text-[8px] font-bold bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/40" title="Stale Custom Pin: ${Fin.percent(driftPct, true)} vs Quant Recommended (${Fin.currency(rVal, false, currency)}). Click Edit to refresh.">⚠</span>`
      : '';
    return `
      <div class="font-bold num-font ${colorClass}" title="User Custom ${labelTitle}: ${Fin.currency(cVal, false, currency)}${diffPct !== null ? ` (${Fin.percent(diffPct, true)} vs current)` : ''}${rVal ? ` | Quant Recommended: ${Fin.currency(rVal, false, currency)}` : ''}">
        <i class="fa-solid fa-thumbtack text-[9px] mr-0.5 opacity-80"></i>${Fin.currency(cVal, false, currency)}${staleWarn}
      </div>
      <div class="text-[9.5px] font-mono text-slate-400">${recSub}</div>
      ${proximityBadge}
    `;
  }
  return `
    <div class="font-bold num-font ${colorClass}" title="Quant Recommended ${labelTitle}: ${Fin.currency(rVal, false, currency)}">
      ${Fin.currency(rVal, false, currency)}
    </div>
    <div class="text-[9.5px] font-mono text-slate-400">${diffPct !== null ? Fin.percent(diffPct, true) : 'Rec'}</div>
    ${proximityBadge}
  `;
}
window.formatTargetLevelCell = formatTargetLevelCell;

function getSignalBadgeColorClasses(signalLabel) {
  const label = String(signalLabel || 'HOLD').toUpperCase();
  if (label === 'STRONG BUY') return 'bg-emerald-500 text-white border-emerald-400 shadow-sm shadow-emerald-500/30';
  if (label === 'ACCUMULATE') return 'bg-teal-500/15 text-teal-600 dark:text-teal-400 border-teal-500/30';
  if (label.includes('TRIM')) return 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30';
  if (label.includes('SELL')) return 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30';
  return 'bg-slate-500/15 text-slate-600 dark:text-slate-300 border-slate-500/30';
}
window.getSignalBadgeColorClasses = getSignalBadgeColorClasses;

function formatSignalBadgeCell(ticker, m) {
  const score = Number(m?.signalScore ?? 50);
  const label = m?.signalLabel || 'HOLD';
  const cls = getSignalBadgeColorClasses(label);

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
      <div class="p-2.5 rounded-lg border border-sky-500/30 bg-sky-500/5">
        <span class="text-[10px] text-sky-600 dark:text-sky-400 font-semibold block">Recommended Buy Price</span>
        <span class="font-mono font-bold text-sky-600 dark:text-sky-400 text-sm">${m.recommendedBuyPrice ? Fin.currency(m.recommendedBuyPrice, false, curr) : '-'}</span>
        <span class="text-[10px] text-slate-400 block">Prev Trough: ${m.prevTrough ? Fin.currency(m.prevTrough, false, curr) : '-'}</span>
      </div>
      <div class="p-2.5 rounded-lg border border-pink-500/30 bg-pink-500/5">
        <span class="text-[10px] text-pink-600 dark:text-pink-400 font-semibold block">Recommended Sell Price</span>
        <span class="font-mono font-bold text-pink-600 dark:text-pink-400 text-sm">${m.recommendedSellPrice ? Fin.currency(m.recommendedSellPrice, false, curr) : '-'}</span>
        <span class="text-[10px] text-slate-400 block">Prev Peak: ${m.prevPeak ? Fin.currency(m.prevPeak, false, curr) : '-'}</span>
      </div>
      <div class="p-2.5 rounded-lg border border-red-700/30 bg-red-700/5">
        <span class="text-[10px] text-red-700 dark:text-red-400 font-semibold block">Recommended Stop Loss</span>
        <span class="font-mono font-bold text-red-700 dark:text-red-400 text-sm">${m.recommendedStopLoss ? Fin.currency(m.recommendedStopLoss, false, curr) : '-'}</span>
        <span class="text-[10px] text-slate-400 block">ATR(${state.settings.atrStopMultiplier || 2}x): ${m.atr14 ?? '-'}</span>
      </div>
      <div class="p-2.5 rounded-lg border border-slate-200 dark:border-slate-700">
        <span class="text-[10px] text-slate-400 block">SMA 20 / 50 / 200</span>
        <span class="font-mono font-semibold text-slate-800 dark:text-slate-200">${m.sma20 ?? '-'} / ${m.sma50 ?? '-'} / ${m.sma200 ?? '-'}</span>
      </div>
      <div class="p-2.5 rounded-lg border border-slate-200 dark:border-slate-700">
        <span class="text-[10px] text-slate-400 block">12M Reg Channel (-1&sigma; / +1&sigma;)</span>
        <span class="font-mono font-semibold text-purple-500">${m.regLowerNow ? Fin.currency(m.regLowerNow, false, curr) : '-'} &ndash; ${m.regUpperNow ? Fin.currency(m.regUpperNow, false, curr) : '-'}</span>
      </div>
      <div class="p-2.5 rounded-lg border border-slate-200 dark:border-slate-700">
        <span class="text-[10px] text-slate-400 block">Next Ex-Dividend Date</span>
        <span class="font-mono font-semibold text-cyan-500">${m.divInfo?.nextExDate || 'None'} (${m.divInfo?.frequency || '-'})</span>
      </div>
    </div>
  `;
  openModal('modal-signal-detail');
};


// ============================================================================
// U1, U3, U4, U6 UTILITY HANDLERS
// ============================================================================
function openDividendModalForTicker(rawTicker) {
  const norm = MarketAPI.normalizeTicker(rawTicker);
  const h = (portfolio?.activeHoldings || portfolio?.allHoldings || []).find(item => item.ticker === norm);
  const divTickerEl = document.getElementById('div-ticker');
  const divAmountEl = document.getElementById('div-amount');
  const divPayDateEl = document.getElementById('div-pay-date');
  const divExDateEl = document.getElementById('div-ex-date');
  const todayStr = new Date().toISOString().split('T')[0];

  if (divTickerEl) divTickerEl.value = norm;
  if (divPayDateEl) divPayDateEl.value = todayStr;
  if (divExDateEl) divExDateEl.value = todayStr;
  if (divAmountEl) {
    divAmountEl.value = '';
    divAmountEl.placeholder = (h && h.shares > 0) ? `Total payout for ${Fin.shares(h.shares)} sh...` : 'Total payout amount...';
  }
  openModal('modal-dividend');
  setTimeout(() => { if (divAmountEl) divAmountEl.focus(); }, 80);
}
window.openDividendModalForTicker = openDividendModalForTicker;

function setGhSyncStatus(active, message = 'Python Syncing...') {
  const pill = document.getElementById('gh-sync-live-pill');
  const txt = document.getElementById('gh-sync-live-text');
  if (pill) {
    pill.classList.toggle('hidden', !active);
    pill.classList.toggle('flex', Boolean(active));
  }
  if (txt && message) txt.textContent = message;
}
window.setGhSyncStatus = setGhSyncStatus;

function handleTableSortClick(tableType, col) {
  if (!state.settings) state.settings = {};
  const colKey = `${tableType}SortColumn`;
  const orderKey = `${tableType}SortOrder`;
  const currCol = state.settings[colKey];
  const currOrder = state.settings[orderKey] || 'asc';

  if (currCol === col) {
    state.settings[orderKey] = currOrder === 'asc' ? 'desc' : 'asc';
  } else {
    state.settings[colKey] = col;
    const descByDefault = ['price', 'dayPnL', 'marketValue', 'unrealizedGain', 'realizedGain', 'totalDividends', 'totalReturn', 'netYield', 'shares', 'avgCost', 'totalCost', 'xirr', 'yoc', '52wPos', 'mom', 'qoq', 'yoy', 'signalScore', 'divYield', 'dist'];
    state.settings[orderKey] = descByDefault.includes(col) ? 'desc' : 'asc';
  }
  saveState();
  if (tableType === 'holdings') renderHoldingsTable();
  else if (tableType === 'watchlist') renderWatchlistAndFundamentals();
}
window.handleTableSortClick = handleTableSortClick;

function updateHeaderSortIndicators(tableId, activeCol, activeOrder, attrName = 'data-sort-col') {
  const tbl = document.getElementById(tableId);
  if (!tbl) return;
  tbl.querySelectorAll(`th[${attrName}]`).forEach(th => {
    const col = th.getAttribute(attrName);
    const icon = th.querySelector('i.fa-solid');
    if (!icon) return;
    if (col === activeCol) {
      icon.className = activeOrder === 'desc'
        ? 'fa-solid fa-sort-down text-brand-500 ml-1 text-xs'
        : 'fa-solid fa-sort-up text-brand-500 ml-1 text-xs';
    } else {
      icon.className = 'fa-solid fa-sort text-[9px] opacity-30 ml-1';
    }
  });
}

function renderHoldingsTable() {
  const winScrollY = typeof window !== 'undefined' ? window.scrollY : 0;
  const tbody = document.getElementById('holdings-table-body');
  const scrollBox = tbody ? tbody.closest('.scrollable-portfolio-table-box') : null;
  const boxScrollTop = scrollBox ? scrollBox.scrollTop : 0;
  const boxScrollLeft = scrollBox ? scrollBox.scrollLeft : 0;
  const emptyState = document.getElementById('holdings-empty-state');
  const signalFilterEl = document.getElementById('holdings-filter-signal');
  const activeOnlyCheckbox = document.getElementById('holdings-filter-active-only');
  tbody.innerHTML = '';

  const activeOnly = Boolean(state?.settings?.holdingsActiveOnly);
  if (activeOnlyCheckbox) {
    activeOnlyCheckbox.checked = activeOnly;
  }

  const allHoldingsList = (portfolio?.allHoldings && portfolio.allHoldings.length > 0)
    ? portfolio.allHoldings
    : (portfolio?.activeHoldings || []);

  const poolForMode = activeOnly
    ? allHoldingsList.filter(h => h.isActive !== false && h.shares > 0.0001)
    : allHoldingsList;

  const selectedSignal = populateSignalFilterDropdown(
    signalFilterEl,
    poolForMode.map(h => h.signalLabel || 'HOLD')
  );

  if (allHoldingsList.length === 0) {
    emptyState.classList.remove('hidden');
    const chartCard = document.getElementById('holdings-stock-chart-card');
    if (chartCard) chartCard.classList.add('hidden');
    return;
  }
  emptyState.classList.add('hidden');

  // U1: Quick Search Filter
  const holdingsSearchQ = (document.getElementById('holdings-search-input')?.value || '').trim().toUpperCase();

  let filteredHoldings = selectedSignal === 'ALL'
    ? poolForMode
    : poolForMode.filter(h => (h.signalLabel || 'HOLD') === selectedSignal);

  if (holdingsSearchQ) {
    filteredHoldings = filteredHoldings.filter(h =>
      (h.ticker || '').toUpperCase().includes(holdingsSearchQ) ||
      (h.companyName || '').toUpperCase().includes(holdingsSearchQ) ||
      getCanonicalHoldingsSector(h).toUpperCase().includes(holdingsSearchQ)
    );
  }

  // U6: Compact View Toggle on table
  const isHoldingsCompact = Boolean(state?.settings?.holdingsCompactView);
  const tblHoldings = document.getElementById('holdings-main-table');
  if (tblHoldings) {
    const hPreset = state?.settings?.holdingsViewPreset || (isHoldingsCompact ? 'overview' : 'full');
    tblHoldings.classList.remove('compact-view-active', 'preset-overview-active', 'preset-pnl-active', 'preset-targets-active');
    if (hPreset === 'overview') tblHoldings.classList.add('preset-overview-active');
    else if (hPreset === 'pnl') tblHoldings.classList.add('preset-pnl-active');
    else if (hPreset === 'targets') tblHoldings.classList.add('preset-targets-active');
    document.querySelectorAll('.holdings-preset-btn').forEach(btn => {
      const active = btn.getAttribute('data-holdings-preset') === hPreset;
      btn.className = active
        ? 'holdings-preset-btn px-2 py-1 rounded-md font-semibold bg-white dark:bg-dark-card shadow text-slate-900 dark:text-white transition'
        : 'holdings-preset-btn px-2 py-1 rounded-md font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition';
    });
  }
  const btnCompactLbl = document.getElementById('holdings-compact-label');
  if (btnCompactLbl) {
    btnCompactLbl.textContent = isHoldingsCompact ? 'Full Quant View' : 'Compact View';
  }

  // U1: Header Sort Indicators
  const hSortCol = state?.settings?.holdingsSortColumn || 'ticker';
  const hSortOrder = state?.settings?.holdingsSortOrder || 'asc';
  updateHeaderSortIndicators('holdings-main-table', hSortCol, hSortOrder, 'data-sort-col');

  if (filteredHoldings.length === 0) {
    tbody.innerHTML = `
      <tr class="text-xs text-slate-400">
        <td colspan="22" class="py-8 px-4 text-center">
          No ${activeOnly ? 'active ' : ''}holdings match your current filter.
          <button type="button" onclick="if(state.settings) state.settings.holdingsActiveOnly=false; const sEl=document.getElementById('holdings-filter-signal'); if(sEl) sEl.value='ALL'; renderHoldingsTable();" class="ml-2 text-brand-500 hover:underline font-semibold">Reset Filters (${allHoldingsList.length})</button>
        </td>
      </tr>
    `;
    return;
  }

  if (!state.settings.collapsedSectors) state.settings.collapsedSectors = {};

  const baseCurr = portfolio?.baseCurrency || state?.settings?.currency || 'HKD';
  const infRate = Number(state.settings?.inflationRatePct ?? 2.2);

  // =========================================================================
  // TOP ROW: PORTFOLIO TOTAL / AGGREGATED VALUES ACROSS DISPLAYED HOLDINGS
  // =========================================================================
  let totDayPnLBase = 0;
  let totMarketValueBase = 0;
  let totUnrealizedBase = 0;
  let totCostBasisBase = 0;
  let totCumulativeBuyCostBase = 0;
  let totHistoricalCostBase = 0;
  let totAccumDivBase = 0;
  let totRealizedBase = 0;
  let totAnnualFwdDivBase = 0;
  let weightedSignalSum = 0;
  let signalCount = 0;
  let activeCount = 0;
  let closedCount = 0;
  const allXirrFlowsBase = [];

  filteredHoldings.forEach(h => {
    const hCurr = h.currency || 'HKD';
    const isAct = h.isActive !== false && h.shares > 0.0001;
    if (isAct) activeCount++;
    else closedCount++;

    totDayPnLBase = Fin.round(totDayPnLBase + (h.dayPnLBase ?? Fin.convertCurrency(h.dayPnL || 0, hCurr, baseCurr)), 2);
    totMarketValueBase = Fin.round(totMarketValueBase + (h.marketValueBase ?? Fin.convertCurrency(h.marketValue || 0, hCurr, baseCurr)), 2);
    totUnrealizedBase = Fin.round(totUnrealizedBase + Fin.convertCurrency(h.unrealizedGain || 0, hCurr, baseCurr), 2);
    totCostBasisBase = Fin.round(totCostBasisBase + (h.costBasisBase ?? Fin.convertCurrency(h.totalCostBasis || 0, hCurr, baseCurr)), 2);
    const hCumBuyCostBase = h.cumulativeBuyCostBasisBase ?? Fin.convertCurrency((h.cumulativeBuyCostBasis > 0 ? h.cumulativeBuyCostBasis : h.totalCostBasis) || 0, hCurr, baseCurr);
    totCumulativeBuyCostBase = Fin.round(totCumulativeBuyCostBase + hCumBuyCostBase, 2);
    totHistoricalCostBase = Fin.round(totHistoricalCostBase + (h.historicalCostBasisBase ?? Fin.convertCurrency(h.historicalCostBasis || h.totalCostBasis || 0, hCurr, baseCurr)), 2);
    totAccumDivBase = Fin.round(totAccumDivBase + (h.totalDividendsBase ?? Fin.convertCurrency(h.totalDividends || 0, hCurr, baseCurr)), 2);
    totRealizedBase = Fin.round(totRealizedBase + (h.realizedGainBase ?? Fin.convertCurrency(h.realizedGain || 0, hCurr, baseCurr)), 2);
    totAnnualFwdDivBase = Fin.round(totAnnualFwdDivBase + (h.annualForwardDivBase ?? 0), 2);

    if (Array.isArray(h.xirrFlowsBase)) {
      allXirrFlowsBase.push(...h.xirrFlowsBase);
    }
    if (Number.isFinite(Number(h.signalScore))) {
      weightedSignalSum += Number(h.signalScore);
      signalCount++;
    }
  });

  const prevTotMvBase = totMarketValueBase - totDayPnLBase;
  const totDayPnLPct = prevTotMvBase > 0 ? Fin.round((totDayPnLBase / prevTotMvBase) * 100, 2) : 0;
  const totUnrealizedPct = totCostBasisBase > 0 ? Fin.round((totUnrealizedBase / totCostBasisBase) * 100, 2) : 0;
  const totNetYieldPct = totMarketValueBase > 0 ? Fin.round((totAnnualFwdDivBase / totMarketValueBase) * 100, 2) : 0;
  const refTotCostForYoC = totCostBasisBase > 0 ? totCostBasisBase : totHistoricalCostBase;
  const totYoCPct = refTotCostForYoC > 0 ? Fin.round((totAccumDivBase / refTotCostForYoC) * 100, 2) : 0;
  const totXirrPct = (selectedSignal === 'ALL' && !activeOnly && portfolio.nominalXirrPct !== null)
    ? portfolio.nominalXirrPct
    : Fin.xirr(allXirrFlowsBase);
  const totRealXirrPct = totXirrPct !== null ? Fin.realReturn(totXirrPct, infRate) : null;
  const avgSignalScore = signalCount > 0 ? Math.round(weightedSignalSum / signalCount) : 50;

  const hideMoney = Fin.isPrivacyMode();
  const totTotalReturnBase = Fin.round(totUnrealizedBase + totRealizedBase + totAccumDivBase, 2);
  const refTotCostForReturn = totCumulativeBuyCostBase > 0 ? totCumulativeBuyCostBase : refTotCostForYoC;
  const totTotalReturnPct = refTotCostForReturn > 0 ? Fin.round((totTotalReturnBase / refTotCostForReturn) * 100, 2) : 0;
  const totRealizedPct = refTotCostForReturn > 0 ? Fin.round((totRealizedBase / refTotCostForReturn) * 100, 2) : 0;

  const totDayColor = totDayPnLBase >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400';
  const totUnrColor = totUnrealizedBase >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400';
  const totRealColor = totRealizedBase >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400';
  const totRetColor = totTotalReturnBase >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400';
  const totXirrColor = totXirrPct === null ? 'text-slate-400' : (totXirrPct >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400');

  const totalTr = document.createElement('tr');
  totalTr.className = 'portfolio-total-row bg-indigo-50/95 dark:bg-slate-900 border-b-2 border-indigo-500/40 font-bold text-xs';
  totalTr.innerHTML = `
    <td class="py-1.5 px-2.5 sm:px-3 sticky-col-mobile col-always max-w-[142px] sm:max-w-none bg-indigo-50 dark:bg-slate-900">
      <div class="flex items-center gap-1.5 min-w-0">
        <i class="fa-solid fa-layer-group text-indigo-500 text-xs shrink-0"></i>
        <div class="min-w-0">
          <div class="font-extrabold text-[11px] sm:text-xs tracking-tight text-slate-900 dark:text-white truncate">PORTFOLIO TOTAL</div>
          <div class="text-[9.5px] font-mono text-slate-500 dark:text-slate-400 truncate">${activeCount} active${closedCount > 0 ? ` · ${closedCount} closed` : ''} (${baseCurr})</div>
        </div>
      </div>
    </td>
    <td class="py-1.5 px-3 text-right font-mono text-[10px] text-slate-500 dark:text-slate-400 col-always">100.0% wt</td>
    <td class="py-1.5 px-3 text-right num-font ${totDayColor} col-g-overview col-g-pnl">
      ${hideMoney
        ? `<div class="font-extrabold">1D ${Fin.percent(totDayPnLPct, true)}</div>`
        : `<div class="font-extrabold">${Fin.currency(totDayPnLBase, true, baseCurr)}</div><div class="text-[10px] font-semibold">1D ${Fin.percent(totDayPnLPct, true)}</div>`}
    </td>
    <td class="py-1.5 px-3 text-right num-font font-extrabold text-slate-900 dark:text-white col-g-overview col-g-pnl col-g-targets">
      ${hideMoney ? '100.0% wt' : Fin.currency(totMarketValueBase, false, baseCurr)}
    </td>
    <td class="py-1.5 px-3 text-right text-[10px] font-mono text-slate-400 col-g-overview col-g-targets">-</td>
    <td class="py-1.5 px-3 text-center col-g-overview col-g-targets">
      <span class="px-2 py-0.5 rounded bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30 font-mono font-bold text-[10px]">Avg ${avgSignalScore}/100</span>
    </td>
    <td class="py-1.5 px-3 text-right num-font ${totRetColor} col-g-overview col-g-pnl" title="All-Time Total Return / Cumulative Buy Cost Basis (${hideMoney ? 'Hidden' : Fin.currency(refTotCostForReturn, false, baseCurr)})">
      ${hideMoney
        ? `<div class="font-extrabold">${Fin.percent(totTotalReturnPct, true)}</div>`
        : `<div class="font-extrabold">${Fin.currency(totTotalReturnBase, true, baseCurr)}</div><div class="text-[10px] font-semibold">${Fin.percent(totTotalReturnPct, true)}</div>`}
    </td>
    <td class="py-1.5 px-3 text-right num-font ${totUnrColor} col-g-pnl">
      ${hideMoney
        ? `<div class="font-extrabold">${Fin.percent(totUnrealizedPct, true)}</div>`
        : `<div class="font-extrabold">${Fin.currency(totUnrealizedBase, true, baseCurr)}</div><div class="text-[10px] font-semibold">${Fin.percent(totUnrealizedPct, true)}</div>`}
    </td>
    <td class="py-1.5 px-3 text-right num-font font-extrabold ${totRealColor} col-g-pnl">
      ${hideMoney ? Fin.percent(totRealizedPct, true) : Fin.currency(totRealizedBase, true, baseCurr)}
    </td>
    <td class="py-1.5 px-3 text-right num-font font-extrabold text-cyan-600 dark:text-cyan-400 col-g-pnl">
      ${hideMoney ? `${totYoCPct.toFixed(2)}% YoC` : ('+' + Fin.currency(totAccumDivBase, false, baseCurr))}
    </td>
    <td class="py-1.5 px-3 text-right num-font text-cyan-600 dark:text-cyan-400 col-g-overview col-g-pnl">
      <div class="font-bold">${totNetYieldPct > 0 ? totNetYieldPct.toFixed(2) + '% Net' : '-'}</div>
      ${hideMoney ? '' : `<div class="text-[9.5px] font-mono text-slate-400">${totAnnualFwdDivBase > 0 ? Fin.currency(totAnnualFwdDivBase, false, baseCurr) + '/yr' : ''}</div>`}
    </td>
    <td class="py-1.5 px-3 text-right text-slate-400 font-mono col-g-pnl">${hideMoney ? '••••' : '-'}</td>
    <td class="py-1.5 px-3 text-right text-slate-400 font-mono col-g-pnl col-g-targets">${hideMoney ? '••••••' : '-'}</td>
    <td class="py-1.5 px-3 text-right num-font font-extrabold text-slate-800 dark:text-slate-200 col-g-pnl">
      ${hideMoney ? '••••••' : Fin.currency(totCostBasisBase, false, baseCurr)}
    </td>
    <td colspan="4" class="py-1.5 px-3 text-center text-[10px] text-slate-400 font-mono col-g-targets">Quant Levels &amp; R:R</td>
    <td class="py-1.5 px-3 text-right num-font ${totXirrColor} col-g-pnl">
      <div class="font-extrabold">${totXirrPct !== null ? Fin.percent(totXirrPct, true) : '-'}</div>
      ${totRealXirrPct !== null ? `<div class="text-[9.5px] font-normal text-slate-400">Real ${Fin.percent(totRealXirrPct, true)}</div>` : ''}
    </td>
    <td class="py-1.5 px-3 text-right num-font font-extrabold text-cyan-600 dark:text-cyan-400 col-g-pnl">
      ${totYoCPct.toFixed(2)}%
    </td>
    <td colspan="8" class="py-1.5 px-3 text-right text-[10px] text-slate-400 font-medium col-quant-extra col-g-targets">
      All-Time Portfolio Aggregates (${baseCurr})
    </td>
    <td class="py-1.5 px-3 text-center text-slate-400 col-always">-</td>
  `;
  tbody.appendChild(totalTr);

  // =========================================================================
  // SECTOR GROUPS & INDIVIDUAL TICKER ROWS (ACTIVE + HISTORICAL CLOSED)
  // =========================================================================
  const groupsMap = {};
  filteredHoldings.forEach(h => {
    const secName = getCanonicalHoldingsSector(h);
    const hCurr = h.currency || 'HKD';
    if (!groupsMap[secName]) {
      groupsMap[secName] = {
        sector: secName,
        isEtf: MarketAPI.isEtfSector(secName, h.ticker, h.companyName),
        items: [],
        totalDayPnL: 0,
        totalCostBasis: 0,
        totalCumulativeBuyCostBasis: 0,
        totalHistoricalCostBasis: 0,
        totalMarketValue: 0,
        totalMarketValueBase: 0,
        totalUnrealizedGain: 0,
        totalDividends: 0,
        totalRealizedGain: 0,
        totalAnnualFwdDiv: 0,
        xirrFlowsBase: [],
        currency: baseCurr
      };
    }
    const g = groupsMap[secName];
    g.items.push(h);
    if (Array.isArray(h.xirrFlowsBase)) {
      g.xirrFlowsBase.push(...h.xirrFlowsBase);
    }
    g.totalDayPnL = Fin.round(g.totalDayPnL + (h.dayPnLBase ?? Fin.convertCurrency(h.dayPnL || 0, hCurr, baseCurr)), 2);
    g.totalCostBasis = Fin.round(g.totalCostBasis + Fin.convertCurrency(h.totalCostBasis || 0, hCurr, baseCurr), 2);
    const gCumCost = (h.cumulativeBuyCostBasis && h.cumulativeBuyCostBasis > 0) ? h.cumulativeBuyCostBasis : (h.totalCostBasis || 0);
    g.totalCumulativeBuyCostBasis = Fin.round(g.totalCumulativeBuyCostBasis + (h.cumulativeBuyCostBasisBase ?? Fin.convertCurrency(gCumCost, hCurr, baseCurr)), 2);
    g.totalHistoricalCostBasis = Fin.round(g.totalHistoricalCostBasis + Fin.convertCurrency(h.historicalCostBasis || h.totalCostBasis || 0, hCurr, baseCurr), 2);
    g.totalMarketValue = Fin.round(g.totalMarketValue + Fin.convertCurrency(h.marketValue || 0, hCurr, baseCurr), 2);
    g.totalMarketValueBase = Fin.round(g.totalMarketValueBase + (h.marketValueBase || Fin.convertCurrency(h.marketValue || 0, hCurr, baseCurr)), 2);
    g.totalUnrealizedGain = Fin.round(g.totalUnrealizedGain + Fin.convertCurrency(h.unrealizedGain || 0, hCurr, baseCurr), 2);
    g.totalDividends = Fin.round(g.totalDividends + Fin.convertCurrency(h.totalDividends || 0, hCurr, baseCurr), 2);
    g.totalRealizedGain = Fin.round(g.totalRealizedGain + Fin.convertCurrency(h.realizedGain || 0, hCurr, baseCurr), 2);
    g.totalAnnualFwdDiv = Fin.round(g.totalAnnualFwdDiv + (h.annualForwardDivBase || 0), 2);
  });

  const sortedGroups = Object.values(groupsMap).sort((a, b) => {
    if (a.isEtf !== b.isEtf) return a.isEtf ? -1 : 1;
    return a.sector.localeCompare(b.sector, undefined, { sensitivity: 'base' });
  });

  sortedGroups.forEach(group => {
    const getHoldingsSortVal = (h, col) => {
      const hCurr = h.currency || baseCurr;
      const toBase = (v) => (v !== null && v !== undefined && Number(v) !== 0) ? Fin.convertCurrency(Number(v), hCurr, baseCurr) : 0;
      switch (col) {
        case 'ticker': return h.ticker || '';
        case 'price': return toBase(h.currentPrice || 0);
        case 'dayPnL': return Number(h.dayPnLBase ?? toBase(h.dayPnL || 0));
        case 'marketValue': return Number(h.marketValueBase ?? toBase(h.marketValue || 0));
        case 'unrealizedGain': return toBase(h.unrealizedGain || 0);
        case 'realizedGain': return Number(h.realizedGainBase ?? toBase(h.realizedGain || 0));
        case 'totalDividends': return Number(h.totalDividendsBase ?? toBase(h.totalDividends || 0));
        case 'totalReturn': return Number(h.totalReturnBase ?? (toBase(h.unrealizedGain || 0) + toBase(h.realizedGain || 0) + toBase(h.totalDividends || 0)));
        case 'netYield': return Number(h.divInfo?.netYieldPct || h.divInfo?.trailingYieldPct || 0);
        case 'shares': return Number(h.shares || 0);
        case 'avgCost': return toBase(h.avgCost || 0);
        case 'totalCost': return Number(h.costBasisBase ?? toBase(h.totalCostBasis || 0));
        case 'buyTarget': return toBase(h.customBuyPrice || h.recommendedBuyPrice || 0);
        case 'sellTarget': return toBase(h.customSellPrice || h.recommendedSellPrice || 0);
        case 'stopLoss': return toBase(h.customStopLoss || h.recommendedStopLoss || 0);
        case 'riskReward': return Number(h.riskRewardRatio ?? -999);
        case 'xirr': return Number(h.xirrPct ?? -999);
        case 'yoc': return Number(h.yieldOnCost || 0);
        case 'pctTo52wLow': return (h.low52w > 0 && h.currentPrice > 0) ? ((h.low52w / h.currentPrice) - 1) * 100 : -999;
        case 'pctTo52wHigh': return (h.high52w > 0 && h.currentPrice > 0) ? ((h.high52w / h.currentPrice) - 1) * 100 : -999;
        case '52wPos': return Number(h.pos52wPct || 0);
        case 'mom': return Number(h.momPct || 0);
        case 'qoq': return Number(h.qoqPct || 0);
        case 'yoy': return Number(h.yoyPct || 0);
        case 'signalScore': return Number(h.signalScore ?? 50);
        default: return h.ticker || '';
      }
    };

    group.items.sort((a, b) => {
      const vA = getHoldingsSortVal(a, hSortCol);
      const vB = getHoldingsSortVal(b, hSortCol);
      let cmp = 0;
      if (typeof vA === 'string') {
        cmp = vA.localeCompare(vB, undefined, { sensitivity: 'base' });
      } else {
        cmp = vA < vB ? -1 : (vA > vB ? 1 : 0);
      }
      return hSortOrder === 'desc' ? -cmp : cmp;
    });

    const isCollapsed = Boolean(state.settings.collapsedSectors[group.sector]);
    const prevGroupMv = group.totalMarketValue - group.totalDayPnL;
    const groupDayPnlPct = prevGroupMv > 0 ? Fin.round((group.totalDayPnL / prevGroupMv) * 100, 2) : 0;
    const groupUnrealizedPct = group.totalCostBasis > 0
      ? Fin.round((group.totalUnrealizedGain / group.totalCostBasis) * 100, 2)
      : 0;
    const refGroupCostYoC = group.totalCostBasis > 0 ? group.totalCostBasis : group.totalHistoricalCostBasis;
    const refGroupCostForReturn = group.totalCumulativeBuyCostBasis > 0 ? group.totalCumulativeBuyCostBasis : refGroupCostYoC;
    const groupTotalReturn = Fin.round(group.totalUnrealizedGain + group.totalRealizedGain + group.totalDividends, 2);
    const groupTotalReturnPct = refGroupCostForReturn > 0 ? Fin.round((groupTotalReturn / refGroupCostForReturn) * 100, 2) : 0;
    const groupYoC = refGroupCostYoC > 0
      ? Fin.round((group.totalDividends / refGroupCostYoC) * 100, 2)
      : 0;
    const groupNetYieldPct = group.totalMarketValue > 0
      ? Fin.round((group.totalAnnualFwdDiv / group.totalMarketValue) * 100, 2)
      : 0;
    const weightPct = portfolio.totalStockMarketValue > 0
      ? Fin.round((group.totalMarketValueBase / portfolio.totalStockMarketValue) * 100, 1)
      : 0;
    const groupDayColor = group.totalDayPnL >= 0 ? 'text-emerald-500' : 'text-rose-500';
    const groupPnlColor = group.totalUnrealizedGain >= 0 ? 'text-emerald-500' : 'text-rose-500';
    const groupRealColor = group.totalRealizedGain >= 0 ? 'text-emerald-500' : 'text-rose-500';
    const groupRetColor = groupTotalReturn >= 0 ? 'text-emerald-500' : 'text-rose-500';
    const groupXirrPct = Fin.xirr(group.xirrFlowsBase || []);
    const groupRealXirrPct = groupXirrPct !== null ? Fin.realReturn(groupXirrPct, infRate) : null;
    const groupXirrColor = groupXirrPct === null ? 'text-slate-400' : (groupXirrPct >= 0 ? 'text-emerald-500' : 'text-rose-500');
    const iconCls = getSectorIconClass(group.sector, group.isEtf);

    const headerTr = document.createElement('tr');
    headerTr.className = `sector-group-header ${group.isEtf ? 'etf-sector-row' : ''} cursor-pointer select-none transition border-y border-slate-200 dark:border-slate-700/80 ${
      group.isEtf
        ? 'bg-emerald-50/70 dark:bg-emerald-950/25 hover:bg-emerald-100/70 dark:hover:bg-emerald-950/40'
        : 'bg-slate-100/85 dark:bg-slate-800/75 hover:bg-slate-200/70 dark:hover:bg-slate-800'
    }`;
    headerTr.setAttribute('data-sector-group', group.sector);
    headerTr.setAttribute('aria-expanded', String(!isCollapsed));
    headerTr.addEventListener('click', () => toggleHoldingsSector(group.sector));

    headerTr.innerHTML = `
      <td class="py-1 sm:py-1.5 px-2.5 sm:px-3 sticky-col-mobile max-w-[142px] sm:max-w-none ${
        group.isEtf ? 'bg-emerald-50 dark:bg-slate-900' : 'bg-slate-100 dark:bg-slate-800'
      }">
        <div class="flex items-center gap-1.5 sm:gap-2 min-w-0">
          <span class="w-4 h-4 sm:w-5 sm:h-5 rounded bg-white/80 dark:bg-slate-700/80 border border-slate-200 dark:border-slate-600 flex items-center justify-center text-[9px] sm:text-[10px] text-slate-600 dark:text-slate-300 shrink-0">
            <i class="fa-solid ${isCollapsed ? 'fa-chevron-right' : 'fa-chevron-down'}"></i>
          </span>
          <i class="fa-solid ${iconCls} text-[11px] sm:text-xs shrink-0"></i>
          <span class="font-extrabold text-[11px] sm:text-sm tracking-tight text-slate-900 dark:text-white truncate" title="${group.sector}">${group.sector}</span>
          <span class="text-[9px] sm:text-[10px] font-mono font-semibold px-1.5 py-0.2 rounded-full bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600 shrink-0">
            ${group.items.length}<span class="hidden sm:inline"> ${group.items.length === 1 ? 'ticker' : 'tickers'}</span>
          </span>
        </div>
      </td>
      <td class="py-1 sm:py-1.5 px-2 text-right text-[10px] font-mono text-slate-500 dark:text-slate-400 col-always">
        <span>${weightPct}% wt</span>
      </td>
      <td class="py-1 sm:py-1.5 px-3 text-right num-font text-xs font-bold ${groupDayColor} col-g-overview col-g-pnl">
        ${hideMoney
          ? `<div>1D ${Fin.percent(groupDayPnlPct, true)}</div>`
          : `<div>${Fin.currency(group.totalDayPnL, true, group.currency)}</div><div class="text-[10px] font-semibold">1D ${Fin.percent(groupDayPnlPct, true)}</div>`}
      </td>
      <td class="py-1 sm:py-1.5 px-3 text-right num-font text-xs font-extrabold text-slate-900 dark:text-white col-g-overview col-g-pnl col-g-targets">
        ${hideMoney ? `${weightPct}% wt` : Fin.currency(group.totalMarketValue, false, group.currency)}
      </td>
      <td class="py-1 sm:py-1.5 px-3 text-right text-[10px] font-mono text-slate-400 col-g-overview col-g-targets">-</td>
      <td class="py-1 sm:py-1.5 px-3 text-center col-g-overview col-g-targets">
        <span class="px-1.5 py-0.5 rounded bg-slate-200/70 dark:bg-slate-700/80 text-slate-600 dark:text-slate-300 font-mono font-semibold text-[10px]">Avg ${group.items.length > 0 ? Math.round(group.items.reduce((s, item) => s + Number(item.signalScore ?? 50), 0) / group.items.length) : 50}/100</span>
      </td>
      <td class="py-1 sm:py-1.5 px-3 text-right num-font text-xs font-bold ${groupRetColor} col-g-overview col-g-pnl" title="Sector Total Return / Cumulative Buy Cost Basis (${hideMoney ? 'Hidden' : Fin.currency(refGroupCostForReturn, false, group.currency)})">
        ${hideMoney
          ? `<div>${Fin.percent(groupTotalReturnPct, true)}</div>`
          : `<div>${Fin.currency(groupTotalReturn, true, group.currency)}</div><div class="text-[10px] font-semibold">${Fin.percent(groupTotalReturnPct, true)}</div>`}
      </td>
      <td class="py-1 sm:py-1.5 px-3 text-right num-font text-xs font-bold ${groupPnlColor} col-g-pnl">
        ${hideMoney
          ? `<div>${Fin.percent(groupUnrealizedPct)}</div>`
          : `<div>${Fin.currency(group.totalUnrealizedGain, true, group.currency)}</div><div class="text-[10px] font-semibold">${Fin.percent(groupUnrealizedPct)}</div>`}
      </td>
      <td class="py-1 sm:py-1.5 px-3 text-right num-font text-xs font-bold ${group.totalRealizedGain !== 0 ? groupRealColor : 'text-slate-400'} col-g-pnl">
        ${hideMoney
          ? (refGroupCostForReturn > 0 ? Fin.percent(Fin.round((group.totalRealizedGain / refGroupCostForReturn) * 100, 2), true) : '-')
          : (group.totalRealizedGain !== 0 ? Fin.currency(group.totalRealizedGain, true, group.currency) : Fin.currency(0, false, group.currency))}
      </td>
      <td class="py-1 sm:py-1.5 px-3 text-right num-font text-xs font-bold text-cyan-600 dark:text-cyan-400 col-g-pnl">
        ${hideMoney
          ? `${groupYoC.toFixed(2)}% YoC`
          : (group.totalDividends > 0 ? '+' + Fin.currency(group.totalDividends, false, group.currency) : Fin.currency(0, false, group.currency))}
      </td>
      <td class="py-1 sm:py-1.5 px-3 text-right num-font text-xs font-semibold text-cyan-600 dark:text-cyan-400 col-g-overview col-g-pnl">
        ${groupNetYieldPct > 0 ? groupNetYieldPct.toFixed(2) + '% Net' : '-'}
      </td>
      <td class="py-1 sm:py-1.5 px-3 text-right text-[10px] text-slate-400 font-mono col-g-pnl">${hideMoney ? '••••' : '-'}</td>
      <td class="py-1 sm:py-1.5 px-3 text-right text-[10px] text-slate-400 font-mono col-g-pnl col-g-targets">${hideMoney ? '••••••' : '-'}</td>
      <td class="py-1 sm:py-1.5 px-3 text-right num-font text-xs font-bold text-slate-700 dark:text-slate-300 col-g-pnl">
        ${hideMoney ? '••••••' : Fin.currency(group.totalCostBasis, false, group.currency)}
      </td>
      <td colspan="4" class="py-1 sm:py-1.5 px-3 text-center text-[10px] text-slate-400 font-mono col-g-targets">-</td>
      <td class="py-1 sm:py-1.5 px-3 text-right num-font text-xs font-bold ${groupXirrColor} col-g-pnl" title="${groupXirrPct !== null ? `Sector Money-Weighted Annualized XIRR: ${Fin.percent(groupXirrPct, true)} p.a. (Real Inflation-Adjusted: ${Fin.percent(groupRealXirrPct, true)} p.a.)` : 'Insufficient cash flow span'}">
        <div>${groupXirrPct !== null ? Fin.percent(groupXirrPct, true) : '-'}</div>
        ${groupRealXirrPct !== null ? `<div class="text-[9.5px] font-normal text-slate-400">Real ${Fin.percent(groupRealXirrPct, true)}</div>` : ''}
      </td>
      <td class="py-1 sm:py-1.5 px-3 text-right num-font text-xs font-semibold text-cyan-600 dark:text-cyan-400 col-g-pnl">
        ${groupYoC.toFixed(2)}%
      </td>
      <td colspan="8" class="py-1 sm:py-1.5 px-3 text-right text-[11px] text-slate-400 font-medium col-quant-extra col-g-targets">
        Sector Subtotal (${group.items.length} ${group.items.length === 1 ? 'holding' : 'holdings'})
      </td>
      <td class="py-1 sm:py-1.5 px-3 text-center text-[11px] font-semibold text-brand-600 dark:text-brand-400 col-always">
        <span data-sector-toggle-label>${isCollapsed ? 'Expand' : 'Collapse'}</span>
      </td>
    `;
    tbody.appendChild(headerTr);

    {
      group.items.forEach(h => {
        const isSelected = selectedHoldingsTicker === h.ticker;
        const isAct = h.isActive !== false && h.shares > 0.0001;
        const tr = document.createElement('tr');
        tr.className = `cursor-pointer transition ${isCollapsed ? 'hidden ' : ''}${
          isSelected
            ? 'selected-table-row bg-slate-300/80 dark:bg-slate-800 border-l-4 border-l-brand-500'
            : (isAct ? 'hover:bg-slate-50/80 dark:hover:bg-slate-800/40' : 'opacity-80 bg-slate-50/40 dark:bg-slate-900/30 hover:bg-slate-100/60 dark:hover:bg-slate-800/40')
        }`;
        tr.id = `holding-row-${h.ticker}`;
        tr.setAttribute('data-sector-item', group.sector);
        tr.addEventListener('click', (e) => {
          if (e.target.closest('button')) return;
          selectStockForInlineChart('holdings', h.ticker, true);
        });

        const hCurr = h.currency || baseCurr;
        const toBase = (v) => (v !== null && v !== undefined && Number(v) !== 0) ? Fin.convertCurrency(Number(v), hCurr, baseCurr) : 0;
        const toBaseNullable = (v) => (v !== null && v !== undefined && Number(v) > 0) ? Fin.convertCurrency(Number(v), hCurr, baseCurr) : null;

        const curPriceBase = h.currentPrice > 0 ? toBase(h.currentPrice) : 0;
        const avgCostBase = h.avgCost > 0 ? toBase(h.avgCost) : 0;
        const totalCostBase = Number(h.costBasisBase ?? toBase(h.totalCostBasis || 0));
        const marketValBase = Number(h.marketValueBase ?? toBase(h.marketValue || 0));
        const dayPnlValBase = Number(h.dayPnLBase ?? toBase(h.dayPnL || 0));
        const unrealizedValBase = Fin.round(toBase(h.unrealizedGain || 0), 2);
        const realPnlValBase = Number(h.realizedGainBase ?? toBase(h.realizedGain || 0));
        const totalDivValBase = Number(h.totalDividendsBase ?? toBase(h.totalDividends || 0));
        const totalRetValBase = Number(h.totalReturnBase ?? Fin.round(unrealizedValBase + realPnlValBase + totalDivValBase, 2));

        const dayPnlColor = dayPnlValBase >= 0 ? 'text-emerald-500' : 'text-rose-500';
        const pnlColor = unrealizedValBase >= 0 ? 'text-emerald-500' : 'text-rose-500';
        const realPnlColor = realPnlValBase >= 0 ? 'text-emerald-500' : 'text-rose-500';
        const cumBuyCostNative = (h.cumulativeBuyCostBasis && h.cumulativeBuyCostBasis > 0)
          ? h.cumulativeBuyCostBasis
          : (h.totalCostBasis || h.historicalCostBasis || 0);
        const cumBuyCostBase = Number(h.cumulativeBuyCostBasisBase ?? toBase(cumBuyCostNative));
        const totalRetPct = cumBuyCostNative > 0
          ? Fin.round((((h.unrealizedGain || 0) + Number(h.realizedGain || 0) + Number(h.totalDividends || 0)) / cumBuyCostNative) * 100, 2)
          : 0;
        const totalRetColor = totalRetValBase >= 0 ? 'text-emerald-500' : 'text-rose-500';
        const prevCloseNative = Number(state.prices[h.ticker]?.prevPrice || h.currentPrice || 0);
        const rawDeltaNative = (h.currentPrice > 0 && prevCloseNative > 0)
          ? Fin.round(h.currentPrice - prevCloseNative, 4)
          : Number(h.priceChange || 0);
        const priceDeltaNative = Math.abs(h.priceChangePct) > 40 ? 0 : rawDeltaNative;
        const priceChangeColor = priceDeltaNative >= 0 ? 'text-emerald-500' : 'text-rose-500';

        const recBuyNative = (h.recommendedBuyPrice && Number(h.recommendedBuyPrice) > 0) ? Number(h.recommendedBuyPrice) : null;
        const recSellNative = (h.recommendedSellPrice && Number(h.recommendedSellPrice) > 0) ? Number(h.recommendedSellPrice) : null;
        const recStopNative = ((h.recommendedStopLoss || h.suggestedStopLoss) && Number(h.recommendedStopLoss || h.suggestedStopLoss) > 0) ? Number(h.recommendedStopLoss || h.suggestedStopLoss) : null;
        const custBuyNative = ((h.customBuyPrice || state.fundamentals?.[h.ticker]?.customBuyPrice) && Number(h.customBuyPrice || state.fundamentals?.[h.ticker]?.customBuyPrice) > 0) ? Number(h.customBuyPrice || state.fundamentals?.[h.ticker]?.customBuyPrice) : null;
        const custSellNative = ((h.customSellPrice || state.fundamentals?.[h.ticker]?.customSellPrice) && Number(h.customSellPrice || state.fundamentals?.[h.ticker]?.customSellPrice) > 0) ? Number(h.customSellPrice || state.fundamentals?.[h.ticker]?.customSellPrice) : null;
        const custStopNative = ((h.customStopLoss || state.fundamentals?.[h.ticker]?.customStopLoss) && Number(h.customStopLoss || state.fundamentals?.[h.ticker]?.customStopLoss) > 0) ? Number(h.customStopLoss || state.fundamentals?.[h.ticker]?.customStopLoss) : null;
        const low52wNative = (h.low52w && Number(h.low52w) > 0) ? Number(h.low52w) : null;
        const high52wNative = (h.high52w && Number(h.high52w) > 0) ? Number(h.high52w) : null;

        tr.innerHTML = `
          <td class="py-1 pl-2.5 pr-2 sm:py-1.5 sm:pl-6 sm:pr-3 sticky-col-mobile max-w-[142px] sm:max-w-none">
            <div class="flex items-center gap-1.5 sm:gap-2 min-w-0">
              <div class="w-5 h-5 sm:w-6 sm:h-6 rounded-md ${isSelected ? 'bg-brand-500 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'} flex items-center justify-center font-bold text-[9px] sm:text-[10px] shrink-0">
                ${h.ticker.replace(/\..*$/, '').slice(0, 4)}
              </div>
              <div class="min-w-0">
                <div class="font-bold text-slate-900 dark:text-white flex items-center gap-1">
                  <span class="hover:text-brand-500 underline decoration-dotted underline-offset-2 truncate">${h.ticker}</span>
                  <span class="text-[9px] sm:text-[10px] px-1 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-medium shrink-0" title="Ticker price &amp; avg cost in ${hCurr}; Market Value, P&amp;L, Div, Total Cost &amp; Total Return in ${baseCurr}">${hCurr}</span>
                  ${!isAct ? '<span class="text-[8.5px] px-1 py-0 rounded bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 font-bold shrink-0">0 SH</span>' : ''}
                </div>
                <div class="text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-[96px] sm:max-w-[180px]">${h.companyName}</div>
              </div>
            </div>
          </td>
          <td class="py-1 sm:py-1.5 px-3 text-right col-always">
            <div class="font-bold num-font text-slate-900 dark:text-white" title="${hCurr !== baseCurr && curPriceBase > 0 ? `Equivalent in ${baseCurr}: ${Fin.currency(curPriceBase, false, baseCurr)}` : ''}">${h.currentPrice > 0 ? Fin.currency(h.currentPrice, false, hCurr) : '-'}</div>
            <div class="text-[10px] num-font ${priceChangeColor}" title="1-Day price delta vs. previous close (${Fin.currency(prevCloseNative, false, hCurr)} · ${Fin.percent(Math.abs(h.priceChangePct) > 40 ? 0 : h.priceChangePct, true)})">
              <span class="text-[9px] opacity-75 font-semibold">1D</span> ${h.currentPrice > 0 ? Fin.currency(priceDeltaNative, true, hCurr) : '-'}
            </div>
          </td>
          <td class="py-1 sm:py-1.5 px-3 text-right col-g-overview col-g-pnl">
            ${isAct
              ? (hideMoney
                  ? `<div class="font-bold num-font ${dayPnlColor}">${Fin.percent(Math.abs(h.priceChangePct) > 40 ? 0 : h.priceChangePct, true)}</div>`
                  : `<div class="font-bold num-font ${dayPnlColor}">${Fin.currency(dayPnlValBase, true, baseCurr)}</div>
                     <div class="text-[10px] num-font ${dayPnlColor} font-semibold">${Fin.percent(Math.abs(h.priceChangePct) > 40 ? 0 : h.priceChangePct, true)}</div>`)
              : '<span class="text-slate-400 text-xs font-mono">-</span>'}
          </td>
          <td class="py-1 sm:py-1.5 px-3 text-right font-bold num-font text-slate-900 dark:text-white col-g-overview col-g-pnl col-g-targets">
            ${isAct
              ? (hideMoney
                  ? `<span class="text-[11px] font-mono text-slate-500 dark:text-slate-400">${portfolio.totalStockMarketValue > 0 ? Fin.round((marketValBase / portfolio.totalStockMarketValue) * 100, 1) + '% wt' : '••••••'}</span>`
                  : Fin.currency(marketValBase, false, baseCurr))
              : '<span class="text-slate-400 font-normal">-</span>'}
          </td>
          <td class="py-1 sm:py-1.5 px-3 text-right col-g-overview col-g-targets">
            ${formatTrendRegimeCell(h)}
          </td>
          <td class="py-1 sm:py-1.5 px-3 text-center col-g-overview col-g-targets">
            ${formatSignalBadgeCell(h.ticker, h)}
          </td>
          <td class="py-1 sm:py-1.5 px-3 text-right col-g-overview col-g-pnl" title="Total Return (Unrealized + Realized + Dividends) / Cumulative Buy Cost Basis (${hideMoney ? 'Hidden' : Fin.currency(cumBuyCostBase, false, baseCurr)})">
            ${hideMoney
              ? `<div class="font-bold num-font ${totalRetValBase !== 0 ? totalRetColor : 'text-slate-400'}">${Fin.percent(totalRetPct, true)}</div>`
              : `<div class="font-bold num-font ${totalRetValBase !== 0 ? totalRetColor : 'text-slate-400'}">${Fin.currency(totalRetValBase, true, baseCurr)}</div>
                 <div class="text-[10px] num-font ${totalRetValBase !== 0 ? totalRetColor : 'text-slate-400'} font-semibold">${Fin.percent(totalRetPct, true)}</div>`}
          </td>
          <td class="py-1 sm:py-1.5 px-3 text-right col-g-pnl">
            ${isAct
              ? (hideMoney
                  ? `<div class="font-bold num-font ${pnlColor}">${Fin.percent(h.unrealizedGainPct)}</div>`
                  : `<div class="font-bold num-font ${pnlColor}">${Fin.currency(unrealizedValBase, true, baseCurr)}</div>
                     <div class="text-[10px] num-font ${pnlColor} font-semibold">${Fin.percent(h.unrealizedGainPct)}</div>`)
              : '<span class="text-slate-400 text-xs font-mono">-</span>'}
          </td>
          <td class="py-1 sm:py-1.5 px-3 text-right num-font font-bold ${realPnlValBase !== 0 ? realPnlColor : 'text-slate-400'} col-g-pnl">
            ${hideMoney
              ? (cumBuyCostBase > 0 ? Fin.percent(Fin.round((realPnlValBase / cumBuyCostBase) * 100, 2), true) : '-')
              : (realPnlValBase !== 0 ? Fin.currency(realPnlValBase, true, baseCurr) : Fin.currency(0, false, baseCurr))}
          </td>
          <td class="py-1 sm:py-1.5 px-3 text-right num-font font-bold ${totalDivValBase > 0 ? 'text-cyan-600 dark:text-cyan-400' : 'text-slate-400'} col-g-pnl">
            ${hideMoney
              ? `${h.yieldOnCost.toFixed(2)}% YoC`
              : (totalDivValBase > 0 ? '+' + Fin.currency(totalDivValBase, false, baseCurr) : Fin.currency(0, false, baseCurr))}
          </td>
          <td class="py-1 sm:py-1.5 px-3 text-right col-g-overview col-g-pnl">
            ${formatDividendExDateCell(h.divInfo)}
          </td>
          <td class="py-1 sm:py-1.5 px-3 text-right num-font font-medium ${isAct ? 'text-slate-800 dark:text-slate-200' : 'text-slate-400'} col-g-pnl">${hideMoney ? '••••' : Fin.shares(h.shares)}</td>
          <td class="py-1 sm:py-1.5 px-3 text-right num-font text-slate-600 dark:text-slate-300 col-g-pnl col-g-targets" title="${hCurr !== baseCurr && avgCostBase > 0 ? `Equivalent in ${baseCurr}: ${Fin.currency(avgCostBase, false, baseCurr)}` : ''}">${isAct ? (hideMoney ? '••••••' : Fin.currency(h.avgCost, false, hCurr)) : '<span class="text-slate-400">-</span>'}</td>
          <td class="py-1 sm:py-1.5 px-3 text-right num-font text-slate-600 dark:text-slate-300 col-g-pnl">${isAct ? (hideMoney ? '••••••' : Fin.currency(totalCostBase, false, baseCurr)) : `<span class="text-slate-400 text-[10px]">-</span>`}</td>
          <td class="py-1 sm:py-1.5 px-3 text-right num-font col-g-targets">
            ${formatTargetLevelCell(custBuyNative, recBuyNative, h.currentPrice, hCurr, 'text-sky-500', 'Buy Target')}
          </td>
          <td class="py-1 sm:py-1.5 px-3 text-right num-font col-g-targets">
            ${formatTargetLevelCell(custSellNative, recSellNative, h.currentPrice, hCurr, 'text-pink-500', 'Sell Target')}
          </td>
          <td class="py-1 sm:py-1.5 px-3 text-right num-font col-g-targets">
            ${formatTargetLevelCell(custStopNative, recStopNative, h.currentPrice, hCurr, 'text-red-700 dark:text-red-500', 'Stop Loss')}
          </td>
          <td class="py-1 sm:py-1.5 px-3 text-center num-font col-g-targets" title="Implied Risk/Reward = (Active Sell - Current) / (Current - Active Stop)">
            ${h.riskRewardRatio !== null && h.riskRewardRatio !== undefined
              ? `<span class="px-1.5 py-0.5 rounded text-[11px] font-bold border ${h.riskRewardRatio >= 2.0 ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30' : (h.riskRewardRatio >= 1.0 ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30' : 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30')}">${h.riskRewardRatio.toFixed(1)}x</span>`
              : '<span class="text-slate-400 text-xs">-</span>'}
          </td>
          <td class="py-1 sm:py-1.5 px-3 text-right num-font col-g-pnl" title="${h.xirrPct !== null && h.xirrPct !== undefined ? `Annualized Money-Weighted Return (XIRR): ${Fin.percent(h.xirrPct, true)} p.a. | Real Inflation-Adjusted: ${Fin.percent(h.realXirrPct, true)} p.a. (includes all BUY/SELL cash flows & dividends)` : 'Insufficient cash flow span'}">
            <div class="font-bold text-xs ${h.xirrPct === null || h.xirrPct !== undefined && h.xirrPct === null ? 'text-slate-400' : (h.xirrPct >= 0 ? 'text-emerald-500' : 'text-rose-500')}">
              ${h.xirrPct !== null && h.xirrPct !== undefined ? Fin.percent(h.xirrPct, true) : '-'}
            </div>
            ${h.realXirrPct !== null && h.realXirrPct !== undefined ? `<div class="text-[9.5px] text-slate-400">Real ${Fin.percent(h.realXirrPct, true)}</div>` : ''}
          </td>
          <td class="py-1 sm:py-1.5 px-3 text-right col-g-pnl">
            <span class="px-2 py-0.5 rounded-full text-xs font-bold num-font ${h.yieldOnCost > 0 ? 'bg-cyan-50 dark:bg-cyan-950/60 text-cyan-600 dark:text-cyan-400' : 'text-slate-400'}" title="${isAct ? 'Cumulative Dividends / Active Cost Basis' : 'Historical Cumulative Dividends / Historical Purchase Cost Basis'}">
              ${h.yieldOnCost.toFixed(2)}%
            </span>
          </td>
          <td class="py-1 sm:py-1.5 px-3 text-right num-font text-xs text-slate-600 dark:text-slate-300 col-quant-extra col-g-targets">
            ${low52wNative !== null ? Fin.currency(low52wNative, false, hCurr) : '<span class="text-slate-400 text-[11px]">-</span>'}
          </td>
          <td class="py-1 sm:py-1.5 px-3 text-right num-font text-xs text-slate-600 dark:text-slate-300 col-quant-extra col-g-targets">
            ${high52wNative !== null ? Fin.currency(high52wNative, false, hCurr) : '<span class="text-slate-400 text-[11px]">-</span>'}
          </td>
          <td class="py-1 sm:py-1.5 px-2 text-right col-quant-extra col-g-targets">
            ${formatPctTo52wCell(low52wNative, h.currentPrice, 'low')}
          </td>
          <td class="py-1 sm:py-1.5 px-2 text-right col-quant-extra col-g-targets">
            ${formatPctTo52wCell(high52wNative, h.currentPrice, 'high')}
          </td>
          <td class="py-1 sm:py-1.5 px-3 text-right col-quant-extra col-g-targets">
            ${format52wPositionCell(low52wNative, high52wNative, h.pos52wPct, hCurr)}
          </td>
          <td class="py-1 sm:py-1.5 px-3 text-right col-quant-extra col-g-targets">
            ${formatPeriodChangeCell(h.momPct, 'MoM', h.momRefMonth)}
          </td>
          <td class="py-1 sm:py-1.5 px-3 text-right col-quant-extra col-g-targets">
            ${formatPeriodChangeCell(h.qoqPct, 'QoQ', h.qoqRefMonth)}
          </td>
          <td class="py-1 sm:py-1.5 px-3 text-right col-quant-extra col-g-targets">
            ${formatPeriodChangeCell(h.yoyPct, 'YoY', h.yoyRefMonth)}
          </td>
          <td class="py-1 sm:py-1.5 px-3 text-center col-always">
            <div class="table-action-capsule">
              <button onclick="event.stopPropagation(); selectStockForInlineChart('holdings', '${h.ticker}', true)" class="p-1.5 text-xs ${isSelected ? 'bg-brand-500 text-white' : 'text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-950/40'} rounded" title="Show Price & Trend Chart Below">
                <i class="fa-solid fa-chart-line"></i>
              </button>
              <button onclick="event.stopPropagation(); openEditHoldingModal('${h.ticker}')" class="p-1.5 text-xs text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40 rounded" title="Edit Holding Info (Ticker, Name, Sector, Shares & Cost)">
                <i class="fa-solid fa-pen-to-square"></i>
              </button>
              <button onclick="event.stopPropagation(); openDividendModalForTicker('${h.ticker}')" class="p-1.5 text-xs text-cyan-600 dark:text-cyan-400 hover:bg-cyan-50 dark:hover:bg-cyan-950/40 rounded transition" title="Log Cash Dividend for ${h.ticker}">
                <i class="fa-solid fa-hand-holding-dollar"></i>
              </button>
              <button onclick="event.stopPropagation(); openTradeModalForTicker('${h.ticker}', 'BUY')" class="p-1.5 text-xs text-brand-600 dark:text-brand-400 hover:bg-slate-200 dark:hover:bg-slate-700 rounded" title="Buy Shares">
                <i class="fa-solid fa-cart-plus"></i>
              </button>
              ${isAct ? `<button onclick="event.stopPropagation(); openTradeModalForTicker('${h.ticker}', 'SELL')" class="p-1.5 text-xs text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded" title="Sell Shares">
                <i class="fa-solid fa-arrow-trend-down"></i>
              </button>` : ''}
            </div>
          </td>
        `;
        tbody.appendChild(tr);
      });
    }
  });
  if (scrollBox) {
    scrollBox.scrollTop = boxScrollTop;
    scrollBox.scrollLeft = boxScrollLeft;
  }
  if (typeof window !== 'undefined' && Math.abs(window.scrollY - winScrollY) > 2) {
    window.scrollTo(window.scrollX, winScrollY);
  }
}

var PAGINATION_PAGE_SIZE = 20;
var tablePageState = {
  tx: 1,
  divLog: 1,
  divCal: 1,
  divDet: 1
};

function ensurePaginationBarContainer(barId, tableBodyEl) {
  let barEl = document.getElementById(barId);
  if (!barEl && tableBodyEl) {
    const wrapper = tableBodyEl.closest('.table-responsive-wrapper') || tableBodyEl.parentElement;
    if (wrapper && wrapper.parentElement) {
      barEl = document.createElement('div');
      barEl.id = barId;
      wrapper.insertAdjacentElement('afterend', barEl);
    }
  }
  return barEl;
}

function renderTablePaginationControls(barId, pageKey, totalItems, onPageChange, unitLabel = 'records') {
  const tbodyMap = {
    tx: 'tx-table-body',
    divLog: 'dividends-table-body',
    divCal: 'dividend-calendar-tbody',
    divDet: 'detected-dividends-tbody'
  };
  const tbodyEl = document.getElementById(tbodyMap[pageKey]);
  const barEl = ensurePaginationBarContainer(barId, tbodyEl);
  if (!barEl) return { startIdx: 0, endIdx: Math.min(totalItems, PAGINATION_PAGE_SIZE), currentPage: 1, totalPages: 1 };

  if (totalItems === 0) {
    barEl.className = 'hidden';
    barEl.innerHTML = '';
    tablePageState[pageKey] = 1;
    return { startIdx: 0, endIdx: 0, currentPage: 1, totalPages: 1 };
  }

  const totalPages = Math.max(1, Math.ceil(totalItems / PAGINATION_PAGE_SIZE));
  let currentPage = parseInt(tablePageState[pageKey], 10) || 1;
  if (currentPage > totalPages) currentPage = totalPages;
  if (currentPage < 1) currentPage = 1;
  tablePageState[pageKey] = currentPage;

  const startIdx = (currentPage - 1) * PAGINATION_PAGE_SIZE;
  const endIdx = Math.min(totalItems, startIdx + PAGINATION_PAGE_SIZE);

  barEl.className = 'px-3 py-1.5 sm:px-4 sm:py-2 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex flex-wrap items-center justify-between gap-2 text-[11px] sm:text-xs';
  const prevDisabled = currentPage <= 1;
  const nextDisabled = currentPage >= totalPages;

  barEl.innerHTML = `
    <div class="text-slate-500 dark:text-slate-400 font-medium">
      Showing <span class="font-mono font-bold text-slate-800 dark:text-slate-200">${startIdx + 1}&ndash;${endIdx}</span> of <span class="font-mono font-bold text-slate-800 dark:text-slate-200">${totalItems}</span> ${unitLabel}
      <span class="mx-1.5 text-slate-300 dark:text-slate-600">&bull;</span>
      <span>Page <strong class="font-mono text-slate-800 dark:text-slate-200">${currentPage}</strong> of <strong class="font-mono text-slate-800 dark:text-slate-200">${totalPages}</strong></span>
    </div>
    <div class="flex items-center gap-1.5">
      <button type="button" data-page-action="prev" ${prevDisabled ? 'disabled' : ''} class="px-2.5 py-1 rounded-md font-semibold border transition flex items-center gap-1 ${
        prevDisabled
          ? 'bg-slate-100 dark:bg-slate-800/40 text-slate-400 dark:text-slate-600 border-slate-200 dark:border-slate-800 cursor-not-allowed'
          : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 shadow-sm'
      }">
        <i class="fa-solid fa-chevron-left text-[9px]"></i> Prev 20
      </button>
      <button type="button" data-page-action="next" ${nextDisabled ? 'disabled' : ''} class="px-2.5 py-1 rounded-md font-semibold border transition flex items-center gap-1 ${
        nextDisabled
          ? 'bg-slate-100 dark:bg-slate-800/40 text-slate-400 dark:text-slate-600 border-slate-200 dark:border-slate-800 cursor-not-allowed'
          : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 shadow-sm'
      }">
        Next 20 <i class="fa-solid fa-chevron-right text-[9px]"></i>
      </button>
    </div>
  `;

  const prevBtn = barEl.querySelector('[data-page-action="prev"]');
  const nextBtn = barEl.querySelector('[data-page-action="next"]');
  if (prevBtn && !prevDisabled) {
    prevBtn.addEventListener('click', () => {
      tablePageState[pageKey] = Math.max(1, currentPage - 1);
      onPageChange();
    });
  }
  if (nextBtn && !nextDisabled) {
    nextBtn.addEventListener('click', () => {
      tablePageState[pageKey] = Math.min(totalPages, currentPage + 1);
      onPageChange();
    });
  }

  return { startIdx, endIdx, currentPage, totalPages };
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
    renderTablePaginationControls('tx-pagination-bar', 'tx', 0, renderTransactionsTable, 'records');
    return;
  }
  emptyState.classList.add('hidden');

  const { startIdx, endIdx } = renderTablePaginationControls('tx-pagination-bar', 'tx', list.length, renderTransactionsTable, 'records');
  const pagedList = list.slice(startIdx, endIdx);

  pagedList.forEach(tx => {
    const tr = document.createElement('tr');
    tr.className = 'hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition text-xs';

    const badgeMap = {
      BUY: '<span class="px-1.5 py-0 rounded font-bold text-[10px] leading-tight bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">BUY</span>',
      SELL: '<span class="px-1.5 py-0 rounded font-bold text-[10px] leading-tight bg-rose-500/10 text-rose-500 border border-rose-500/20">SELL</span>',
      DRIP: '<span class="px-1.5 py-0 rounded font-bold text-[10px] leading-tight bg-cyan-500/10 text-cyan-500 border border-cyan-500/20">DRIP</span>',
      DEPOSIT: '<span class="px-1.5 py-0 rounded font-bold text-[10px] leading-tight bg-indigo-500/10 text-indigo-500 border border-indigo-500/20">DEPOSIT</span>',
      WITHDRAW: '<span class="px-1.5 py-0 rounded font-bold text-[10px] leading-tight bg-amber-500/10 text-amber-500 border border-amber-500/20">WITHDRAW</span>'
    };

    const isCashOnly = tx.type === 'DEPOSIT' || tx.type === 'WITHDRAW';
    const tCurr = isCashOnly ? (state.settings.currency || 'HKD') : (state.prices[tx.ticker]?.currency || MarketAPI.getStaticProfile(tx.ticker).currency || 'HKD');
    const totalAmt = isCashOnly
      ? tx.amount
      : (tx.shares * tx.price + (tx.type === 'BUY' ? (tx.fees || 0) : -(tx.fees || 0)));

    const hideMoney = Fin.isPrivacyMode();
    let gainCell = '<span class="text-slate-400">-</span>';
    if (tx.type === 'SELL' && tx.realizedGain !== undefined) {
      const color = tx.realizedGain >= 0 ? 'text-emerald-500' : 'text-rose-500';
      gainCell = `<span class="font-bold num-font ${color}">${hideMoney ? '••••••' : Fin.currency(tx.realizedGain, true, tCurr)}</span>`;
    }

    tr.innerHTML = `
      <td class="py-1 sm:py-1.5 px-2.5 sm:px-3 font-mono text-slate-500">${tx.date}</td>
      <td class="py-1 sm:py-1.5 px-2.5 sm:px-3">${badgeMap[tx.type] || tx.type}</td>
      <td class="py-1 sm:py-1.5 px-2.5 sm:px-3 font-bold text-slate-900 dark:text-white">${isCashOnly ? 'CASH' : tx.ticker}</td>
      <td class="py-1 sm:py-1.5 px-2.5 sm:px-3 text-right num-font font-medium">${isCashOnly ? '-' : (hideMoney ? '••••' : Fin.shares(tx.shares))}</td>
      <td class="py-1 sm:py-1.5 px-2.5 sm:px-3 text-right num-font">${isCashOnly ? '-' : Fin.currency(tx.price, false, tCurr)}</td>
      <td class="py-1 sm:py-1.5 px-2.5 sm:px-3 text-right num-font text-slate-400">${isCashOnly ? '-' : (hideMoney ? '••••••' : Fin.currency(tx.fees || 0, false, tCurr))}</td>
      <td class="py-1 sm:py-1.5 px-2.5 sm:px-3 text-right font-bold num-font text-slate-900 dark:text-white">${hideMoney ? '••••••' : Fin.currency(totalAmt, false, tCurr)}</td>
      <td class="py-1 sm:py-1.5 px-2.5 sm:px-3 text-right">${gainCell}</td>
      <td class="py-1 sm:py-1.5 px-2.5 sm:px-3 text-slate-500 max-w-xs truncate">${tx.notes || ''}</td>
      <td class="py-1 sm:py-1.5 px-2 sm:px-3 text-center">
        <div class="inline-flex items-center justify-center gap-1.5">
          <button onclick="openEditTransactionModal('${tx.id}')" class="text-slate-400 hover:text-amber-500 transition p-0.5 leading-none" title="Edit Transaction">
            <i class="fa-solid fa-pen-to-square text-[11px]"></i>
          </button>
          <button onclick="deleteTransaction('${tx.id}')" class="text-slate-400 hover:text-rose-500 transition p-0.5 leading-none" title="Delete Transaction">
            <i class="fa-solid fa-trash-can text-[11px]"></i>
          </button>
        </div>
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

  const hideMoney = Fin.isPrivacyMode();
  if (statCum) statCum.textContent = hideMoney ? '••••••' : Fin.currency(portfolio.totalDividendsEarned, false, baseCurr);
  if (statCash) statCash.textContent = hideMoney ? '••••••/yr' : `${Fin.currency(portfolio.estimatedAnnualForwardDivBase || 0, false, baseCurr)}/yr`;
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

  // Render Auto-Detected 2018-Present Dividend Entitlements Panel (100% Cash, Paginated 20 rows max)
  const detCard = document.getElementById('detected-dividends-card');
  const detTbody = document.getElementById('detected-dividends-tbody');
  const detSumBadge = document.getElementById('detected-dividends-summary-badge');
  const detectedList = portfolio.detectedDividends || [];

  if (detCard && detTbody) {
    if (detectedList.length === 0) {
      detCard.classList.add('hidden');
      detTbody.innerHTML = '';
      if (detSumBadge) detSumBadge.textContent = '0 Detected';
      renderTablePaginationControls('detected-dividends-pagination-bar', 'divDet', 0, renderDividendsTable, 'records');
    } else {
      detCard.classList.remove('hidden');
      const totalDetBase = detectedList.reduce((s, d) => s + Fin.convertCurrency(d.totalAmount, d.currency, baseCurr), 0);
      if (detSumBadge) {
        detSumBadge.textContent = hideMoney
          ? `${detectedList.length} Payouts Detected`
          : `${detectedList.length} Payouts Detected (${Fin.currency(totalDetBase, false, baseCurr)})`;
      }
      const { startIdx: detStart, endIdx: detEnd } = renderTablePaginationControls('detected-dividends-pagination-bar', 'divDet', detectedList.length, renderDividendsTable, 'records');
      const pagedDetected = detectedList.slice(detStart, detEnd);
      detTbody.innerHTML = pagedDetected.map(d => `
        <tr class="hover:bg-amber-50/40 dark:hover:bg-amber-950/20 transition text-xs border-b border-slate-100 dark:border-slate-800">
          <td class="py-2.5 px-4 font-mono font-bold text-slate-900 dark:text-white">${d.ticker}</td>
          <td class="py-2.5 px-3 font-mono text-amber-600 dark:text-amber-400 font-semibold">${d.exDate}</td>
          <td class="py-2.5 px-3 font-mono text-slate-500">${d.payDate}</td>
          <td class="py-2.5 px-3 text-right num-font">${hideMoney ? '••••' : Fin.shares(d.eligibleShares)}</td>
          <td class="py-2.5 px-3 text-right num-font">${Fin.currency(d.amountPerShare, false, d.currency)}</td>
          <td class="py-2.5 px-3 text-right font-bold num-font text-emerald-600 dark:text-emerald-400">${hideMoney ? '••••••' : ('+' + Fin.currency(d.totalAmount, false, d.currency))}</td>
          <td class="py-2.5 px-3 text-center">
            <button type="button" onclick="approveDetectedDividend('${d.id}')" class="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-[10px] shadow-sm transition">
              + Approve (Cash)
            </button>
          </td>
        </tr>
      `).join('');
    }
  }

  // Render Upcoming Ex-Dividend Calendar & Yield Tracker (Paginated 20 rows max)
  const calTbody = document.getElementById('dividend-calendar-tbody');
  if (calTbody) {
    const allSyms = Array.from(new Set([
      ...portfolio.activeHoldings.map(h => h.ticker),
      ...state.watchlist.map(w => w.ticker)
    ])).sort();
    const { startIdx: calStart, endIdx: calEnd } = renderTablePaginationControls('dividend-calendar-pagination-bar', 'divCal', allSyms.length, renderDividendsTable, 'records');
    const pagedSyms = allSyms.slice(calStart, calEnd);
    calTbody.innerHTML = pagedSyms.map(sym => {
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
          <td class="py-2.5 px-3 text-right num-font font-bold text-amber-500 dark:text-amber-400 unpaid-dividend-amount" title="Estimated upcoming dividend (not yet paid)">${estCash ? (hideMoney ? '••••••' : ('+' + Fin.currency(estCash, false, d.currency))) : '-'}</td>
        </tr>
      `;
    }).join('');
  }

  // Filter Logged Dividends by Ticker and Search Query (Paginated 20 rows max)
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
      ? (hideMoney
          ? `${filtered.length} ${filtered.length === 1 ? 'payout' : 'payouts'}`
          : `${filtered.length} ${filtered.length === 1 ? 'payout' : 'payouts'} (${Fin.currency(filteredSumBase, false, baseCurr)})`)
      : '0 payouts';
  }

  if (filtered.length === 0) {
    emptyState.classList.remove('hidden');
    renderTablePaginationControls('dividends-pagination-bar', 'divLog', 0, renderDividendsTable, 'records');
    return;
  }
  emptyState.classList.add('hidden');

  const todayIso = new Date().toISOString().slice(0, 10);
  const sorted = [...filtered].sort((a, b) => new Date(b.payDate || b.exDate) - new Date(a.payDate || a.exDate));
  const { startIdx: divStart, endIdx: divEnd } = renderTablePaginationControls('dividends-pagination-bar', 'divLog', sorted.length, renderDividendsTable, 'records');
  const pagedDividends = sorted.slice(divStart, divEnd);

  pagedDividends.forEach(div => {
    const dCurr = div.currency || state.prices[div.ticker]?.currency || MarketAPI.getStaticProfile(div.ticker).currency || 'HKD';
    const isUnpaid = Boolean((div.payDate && div.payDate > todayIso) || div.isPending);
    const amountColorCls = isUnpaid
      ? 'text-amber-500 dark:text-amber-400 unpaid-dividend-amount'
      : 'text-emerald-600 dark:text-emerald-400 paid-dividend-amount';
    const payDateBadge = isUnpaid
      ? `<span class="ml-1.5 inline-flex items-center px-1.5 py-0.2 rounded text-[9px] font-sans font-bold uppercase tracking-wider bg-amber-500/15 text-amber-500 dark:text-amber-400 border border-amber-500/30">Unpaid</span>`
      : '';
    const tr = document.createElement('tr');
    tr.className = isUnpaid
      ? 'bg-amber-500/[0.03] hover:bg-amber-500/[0.08] transition text-xs'
      : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition text-xs';
    tr.innerHTML = `
      <td class="py-1 sm:py-1.5 px-2 sm:px-3 font-mono font-medium ${isUnpaid ? 'text-amber-600 dark:text-amber-300' : 'text-slate-800 dark:text-slate-200'} whitespace-nowrap">${div.payDate}${payDateBadge}</td>
      <td class="py-1 sm:py-1.5 px-2 sm:px-3 font-mono text-slate-400 whitespace-nowrap">${div.exDate || '-'}</td>
      <td class="py-1 sm:py-1.5 px-2 sm:px-3 font-bold text-slate-900 dark:text-white whitespace-nowrap">${div.ticker}</td>
      <td class="py-1 sm:py-1.5 px-2 sm:px-3 text-right num-font text-slate-500 dark:text-slate-400 whitespace-nowrap">${div.amountPerShare ? Fin.currency(div.amountPerShare, false, dCurr) : '-'}</td>
      <td class="py-1 sm:py-1.5 px-2 sm:px-3 text-right font-bold num-font ${amountColorCls} whitespace-nowrap" title="${isUnpaid ? 'Dividend declared (Ex-Date passed) but not yet paid until ' + div.payDate : 'Paid cash dividend'}">${hideMoney ? '••••••' : ('+' + Fin.currency(div.totalAmount, false, dCurr))}</td>
      <td class="py-1 sm:py-1.5 px-2 sm:px-3 ${isUnpaid ? 'text-amber-600/80 dark:text-amber-300/80' : 'text-slate-400'} max-w-xs truncate">${div.notes || 'Cash Dividend'}</td>
      <td class="py-1 sm:py-1.5 px-2 sm:px-3 text-center">
        <button onclick="deleteDividend('${div.id}')" class="text-slate-400 hover:text-rose-500 transition p-0.5 leading-none" title="Delete Dividend Record">
          <i class="fa-solid fa-trash-can text-[11px]"></i>
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function renderWatchlistAndFundamentals() {
  const wlTbody = document.getElementById('watchlist-table-body');
  const wlEmpty = document.getElementById('watchlist-empty-state');
  const signalFilterEl = document.getElementById('watchlist-filter-signal');
  wlTbody.innerHTML = '';

  const enrichedWatchlist = (state.watchlist || []).map(w => {
    const curPrice = state.prices[w.ticker]?.price || 0;
    const wm = computeStockPriceMetrics(w.ticker, curPrice);
    const secName = getCanonicalWatchlistSector(w);
    const compName = w.name || state.fundamentals[w.ticker]?.name || MarketAPI.getStaticProfile(w.ticker)?.name || w.ticker;
    return {
      w,
      curPrice,
      wm,
      secName,
      compName,
      signalLabel: wm?.signalLabel || 'HOLD',
      signalScore: Number(wm?.signalScore ?? 50)
    };
  });

  const selectedSignal = populateSignalFilterDropdown(
    signalFilterEl,
    enrichedWatchlist.map(item => item.signalLabel)
  );

  if (state.watchlist.length === 0) {
    wlEmpty.classList.remove('hidden');
    const wlChartCard = document.getElementById('watchlist-stock-chart-card');
    if (wlChartCard) wlChartCard.classList.add('hidden');
  } else {
    wlEmpty.classList.add('hidden');

    // U1: Watchlist Search Filter
    const wlSearchQ = (document.getElementById('watchlist-search-input')?.value || '').trim().toUpperCase();

    let filteredWatchlist = selectedSignal === 'ALL'
      ? enrichedWatchlist
      : enrichedWatchlist.filter(item => item.signalLabel === selectedSignal);

    if (wlSearchQ) {
      filteredWatchlist = filteredWatchlist.filter(item =>
        (item.w.ticker || '').toUpperCase().includes(wlSearchQ) ||
        (item.compName || '').toUpperCase().includes(wlSearchQ) ||
        (item.secName || '').toUpperCase().includes(wlSearchQ)
      );
    }

    // U6: Compact View Toggle on Watchlist table
    const isWlCompact = Boolean(state?.settings?.watchlistCompactView);
    const tblWl = document.getElementById('watchlist-main-table');
    if (tblWl) {
      tblWl.classList.toggle('compact-view-active', isWlCompact);
    }
    const btnWlCompactLbl = document.getElementById('watchlist-compact-label');
    if (btnWlCompactLbl) {
      btnWlCompactLbl.textContent = isWlCompact ? 'Full Quant View' : 'Compact View';
    }

    // U1: Watchlist Header Sort Indicators
    const wlSortCol = state?.settings?.watchlistSortColumn || 'ticker';
    const wlSortOrder = state?.settings?.watchlistSortOrder || 'asc';
    updateHeaderSortIndicators('watchlist-main-table', wlSortCol, wlSortOrder, 'data-wl-sort-col');

    if (filteredWatchlist.length === 0) {
      wlTbody.innerHTML = `
        <tr class="text-xs text-slate-400">
          <td colspan="19" class="py-8 px-4 text-center">
            No watchlist tickers currently match signal <strong class="text-slate-700 dark:text-slate-200 font-mono">${selectedSignal}</strong>.
            <button type="button" onclick="const el=document.getElementById('watchlist-filter-signal'); if(el){el.value='ALL'; renderWatchlistAndFundamentals();}" class="ml-2 text-purple-500 hover:underline font-semibold">Show All (${state.watchlist.length})</button>
          </td>
        </tr>
      `;
    } else {
      if (!state.settings.collapsedWatchlistSectors) state.settings.collapsedWatchlistSectors = {};

      const groupsMap = {};
      filteredWatchlist.forEach(item => {
        const sec = item.secName;
        if (!groupsMap[sec]) {
          groupsMap[sec] = {
            sector: sec,
            isEtf: MarketAPI.isEtfSector(sec, item.w.ticker, item.compName),
            items: [],
            triggeredCount: 0,
            scoreSum: 0
          };
        }
        const g = groupsMap[sec];
        g.items.push(item);
        g.scoreSum += item.signalScore;
        const activeBuyVal = Number(item.w?.customBuyPrice || item.wm?.customBuyPrice || item.wm?.recommendedBuyPrice || 0);
        if (item.curPrice > 0 && activeBuyVal > 0 && item.curPrice <= activeBuyVal * 1.005) {
          g.triggeredCount += 1;
        }
      });

      const sortedGroups = Object.values(groupsMap).sort((a, b) => {
        if (a.isEtf !== b.isEtf) return a.isEtf ? -1 : 1;
        return a.sector.localeCompare(b.sector, undefined, { sensitivity: 'base' });
      });

      sortedGroups.forEach(group => {
        const getWatchlistSortVal = (item, col) => {
          const w = item.w;
          const wm = item.wm;
          const curP = Number(item.curPrice || 0);
          switch (col) {
            case 'ticker': return w.ticker || '';
            case 'price': return curP;
            case 'sector': return item.secName || '';
            case 'pctTo52wLow': return (wm?.low52w > 0 && curP > 0) ? ((wm.low52w / curP) - 1) * 100 : -999;
            case 'pctTo52wHigh': return (wm?.high52w > 0 && curP > 0) ? ((wm.high52w / curP) - 1) * 100 : -999;
            case '52wPos': return Number(wm?.pos52wPct || 0);
            case 'mom': return Number(wm?.momPct || 0);
            case 'qoq': return Number(wm?.qoqPct || 0);
            case 'yoy': return Number(wm?.yoyPct || 0);
            case 'divYield': return Number(wm?.divInfo?.netYieldPct || wm?.divInfo?.trailingYieldPct || 0);
            case 'buyTarget': return Number(w.customBuyPrice || wm?.customBuyPrice || wm?.recommendedBuyPrice || 0);
            case 'sellTarget': return Number(w.customSellPrice || wm?.customSellPrice || wm?.recommendedSellPrice || 0);
            case 'stopLoss': return Number(w.customStopLoss || wm?.customStopLoss || wm?.recommendedStopLoss || 0);
            case 'riskReward': return Number(wm?.riskRewardRatio ?? -999);
            case 'dist': {
              const activeBuy = Number(w.customBuyPrice || wm?.customBuyPrice || wm?.recommendedBuyPrice || 0);
              return (curP > 0 && activeBuy > 0) ? ((curP - activeBuy) / activeBuy) * 100 : 999;
            }
            case 'signalScore': return Number(item.signalScore ?? 50);
            default: return w.ticker || '';
          }
        };

        group.items.sort((a, b) => {
          const vA = getWatchlistSortVal(a, wlSortCol);
          const vB = getWatchlistSortVal(b, wlSortCol);
          let cmp = 0;
          if (typeof vA === 'string') {
            cmp = vA.localeCompare(vB, undefined, { sensitivity: 'base' });
          } else {
            cmp = vA < vB ? -1 : (vA > vB ? 1 : 0);
          }
          return wlSortOrder === 'desc' ? -cmp : cmp;
        });

        const isCollapsed = Boolean(state.settings.collapsedWatchlistSectors[group.sector]);
        const avgScore = group.items.length > 0 ? Math.round(group.scoreSum / group.items.length) : 50;
        const iconCls = getSectorIconClass(group.sector, group.isEtf);

        const headerTr = document.createElement('tr');
        headerTr.className = `sector-group-header ${group.isEtf ? 'etf-sector-row' : ''} cursor-pointer select-none transition border-y border-slate-200 dark:border-slate-700/80 ${
          group.isEtf
            ? 'bg-emerald-50/70 dark:bg-emerald-950/25 hover:bg-emerald-100/70 dark:hover:bg-emerald-950/40'
            : 'bg-slate-100/85 dark:bg-slate-800/75 hover:bg-slate-200/70 dark:hover:bg-slate-800'
        }`;
        headerTr.setAttribute('data-wl-sector-group', group.sector);
        headerTr.setAttribute('aria-expanded', String(!isCollapsed));
        headerTr.addEventListener('click', () => toggleWatchlistSector(group.sector));

        headerTr.innerHTML = `
          <td class="py-1 sm:py-1.5 px-2.5 sm:px-3 sticky-col-mobile max-w-[142px] sm:max-w-none ${
            group.isEtf ? 'bg-emerald-50 dark:bg-slate-900' : 'bg-slate-100 dark:bg-slate-800'
          }">
            <div class="flex items-center gap-1.5 sm:gap-2 min-w-0">
              <span class="w-4 h-4 sm:w-5 sm:h-5 rounded bg-white/80 dark:bg-slate-700/80 border border-slate-200 dark:border-slate-600 flex items-center justify-center text-[9px] sm:text-[10px] text-slate-600 dark:text-slate-300 shrink-0">
                <i class="fa-solid ${isCollapsed ? 'fa-chevron-right' : 'fa-chevron-down'}"></i>
              </span>
              <i class="fa-solid ${iconCls} text-[11px] sm:text-xs shrink-0"></i>
              <span class="font-extrabold text-[11px] sm:text-sm tracking-tight text-slate-900 dark:text-white truncate" title="${group.sector}">${group.sector}</span>
              <span class="text-[9px] sm:text-[10px] font-mono font-semibold px-1.5 py-0.2 rounded-full bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600 shrink-0">
                ${group.items.length}<span class="hidden sm:inline"> ${group.items.length === 1 ? 'ticker' : 'tickers'}</span>
              </span>
            </div>
          </td>
          <td colspan="2" class="py-1 sm:py-1.5 px-2 text-left text-[10px] font-mono text-slate-500 dark:text-slate-400">
            <span>Avg Signal: <strong class="text-slate-700 dark:text-slate-200">${avgScore}/100</strong></span>
          </td>
          <td colspan="12" class="py-1 sm:py-1.5 px-3 text-right text-[11px] text-slate-400 font-medium">
            Watchlist Sector Group (${group.items.length} ${group.items.length === 1 ? 'ticker' : 'tickers'})
          </td>
          <td colspan="3" class="py-1 sm:py-1.5 px-3 text-center">
            ${group.triggeredCount > 0
              ? `<span class="px-2 py-0.5 rounded-full font-bold bg-emerald-500 text-white text-[10px]">${group.triggeredCount} IN BUY ZONE</span>`
              : `<span class="text-[11px] text-slate-400 font-mono">Monitoring quant levels</span>`}
          </td>
          <td class="py-1 sm:py-1.5 px-3 text-center text-[11px] font-semibold text-purple-600 dark:text-purple-400">
            <span data-wl-sector-toggle-label>${isCollapsed ? 'Expand' : 'Collapse'}</span>
          </td>
        `;
        wlTbody.appendChild(headerTr);

        {
          group.items.forEach(({ w, curPrice, wm, secName, compName }) => {
            const isSelected = selectedWatchlistTicker === w.ticker;
            const priceChangePct = state.prices[w.ticker]?.changePct || 0;
            const wlCurrency = state.prices[w.ticker]?.currency || state.fundamentals[w.ticker]?.currency || (w.ticker.endsWith('.HK') ? 'HKD' : (w.ticker.endsWith('.L') ? 'GBp' : 'USD'));
            const wlPrevClose = Number(state.prices[w.ticker]?.prevPrice || curPrice || 0);
            const rawWlDelta = (curPrice > 0 && wlPrevClose > 0)
              ? Fin.round(curPrice - wlPrevClose, 4)
              : Number(state.prices[w.ticker]?.change || 0);
            const wlPriceDelta = Math.abs(priceChangePct) > 40 ? 0 : rawWlDelta;
            const priceChangeColor = wlPriceDelta >= 0 ? 'text-emerald-500' : 'text-rose-500';
            const recBuy = wm?.recommendedBuyPrice || 0;
            const recSell = wm?.recommendedSellPrice || 0;
            const recStop = wm?.recommendedStopLoss || 0;
            const custBuy = Number(w.customBuyPrice || wm?.customBuyPrice || 0) || null;
            const custSell = Number(w.customSellPrice || wm?.customSellPrice || 0) || null;
            const custStop = Number(w.customStopLoss || wm?.customStopLoss || 0) || null;
            const activeBuy = custBuy || recBuy;
            const distPct = (curPrice > 0 && activeBuy > 0) ? ((curPrice - activeBuy) / activeBuy) * 100 : 0;
            const isTriggered = curPrice > 0 && activeBuy > 0 && curPrice <= activeBuy * 1.005;

            const tr = document.createElement('tr');
            tr.className = `cursor-pointer transition text-xs ${isCollapsed ? 'hidden ' : ''}${
              isSelected
                ? 'selected-table-row bg-slate-300/80 dark:bg-slate-800 border-l-4 border-l-purple-500'
                : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/40'
            }`;
            tr.setAttribute('data-wl-sector-item', group.sector);
            tr.addEventListener('click', (e) => {
              if (e.target.closest('button')) return;
              selectStockForInlineChart('watchlist', w.ticker, true);
            });

            tr.innerHTML = `
              <td class="py-1 pl-2.5 pr-2 sm:py-1.5 sm:pl-6 sm:pr-3 sticky-col-mobile max-w-[142px] sm:max-w-none">
                <div class="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <span class="hover:text-purple-500 underline decoration-dotted underline-offset-2 truncate">${w.ticker}</span>
                  <span class="text-[9px] sm:text-[10px] px-1 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-medium shrink-0">${wlCurrency}</span>
                </div>
                <div class="text-[10px] sm:text-[11px] text-slate-400 truncate max-w-[105px] sm:max-w-[180px]">${compName}</div>
              </td>
              <td class="py-1 sm:py-1.5 px-3 text-right">
                ${curPrice > 0
                  ? `<div class="font-bold num-font text-slate-900 dark:text-white">${Fin.currency(curPrice, false, wlCurrency)}</div>
                     <div class="text-[10px] num-font ${priceChangeColor}" title="1-Day price delta vs. previous close (${Fin.currency(wlPrevClose, false, wlCurrency)} · ${Fin.percent(Math.abs(priceChangePct) > 40 ? 0 : priceChangePct, true)})">
                       <span class="text-[9px] opacity-75 font-semibold">1D</span> ${Fin.currency(wlPriceDelta, true, wlCurrency)}
                     </div>`
                  : '<span class="text-slate-400 text-[11px]">Sync API</span>'}
              </td>
              <td class="py-1.5 px-3 text-right">
                ${formatTrendRegimeCell(wm)}
              </td>
              <td class="py-1.5 px-3 text-center">
                ${formatSignalBadgeCell(w.ticker, wm)}
              </td>
              <td class="py-1.5 px-3 text-right">
                ${formatDividendExDateCell(wm.divInfo)}
              </td>
              <td class="py-1.5 px-3 text-right num-font">
                ${formatTargetLevelCell(custBuy, recBuy, curPrice, wlCurrency, 'text-sky-500', 'Buy Target')}
              </td>
              <td class="py-1.5 px-3 text-right num-font font-medium ${distPct <= 0.5 && curPrice > 0 ? 'text-emerald-500 font-bold' : 'text-slate-400'}">
                ${curPrice > 0 && activeBuy > 0 ? (distPct <= 0.5 ? 'In Buy Zone' : `+${distPct.toFixed(1)}% above`) : '-'}
              </td>
              <td class="py-1.5 px-3 text-right num-font">
                ${formatTargetLevelCell(custSell, recSell, curPrice, wlCurrency, 'text-pink-500', 'Sell Target')}
              </td>
              <td class="py-1.5 px-3 text-right num-font">
                ${formatTargetLevelCell(custStop, recStop, curPrice, wlCurrency, 'text-red-700 dark:text-red-500', 'Stop Loss')}
              </td>
              <td class="py-1.5 px-3 text-center num-font" title="Implied Risk/Reward = (Active Sell - Current) / (Current - Active Stop)">
                ${wm?.riskRewardRatio !== null && wm?.riskRewardRatio !== undefined
                  ? `<span class="px-1.5 py-0.5 rounded text-[11px] font-bold border ${wm.riskRewardRatio >= 2.0 ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30' : (wm.riskRewardRatio >= 1.0 ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30' : 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30')}">${wm.riskRewardRatio.toFixed(1)}x</span>`
                  : '<span class="text-slate-400 text-xs">-</span>'}
              </td>
              <td class="py-1.5 px-3 text-right num-font text-slate-600 dark:text-slate-300 col-quant-extra">
                ${wm.low52w !== null && wm.low52w !== undefined ? Fin.currency(wm.low52w, false, wlCurrency) : '<span class="text-slate-400 text-[11px]">-</span>'}
              </td>
              <td class="py-1.5 px-3 text-right num-font text-slate-600 dark:text-slate-300 col-quant-extra">
                ${wm.high52w !== null && wm.high52w !== undefined ? Fin.currency(wm.high52w, false, wlCurrency) : '<span class="text-slate-400 text-[11px]">-</span>'}
              </td>
              <td class="py-1.5 px-2 text-right col-quant-extra">
                ${formatPctTo52wCell(wm.low52w, curPrice, 'low')}
              </td>
              <td class="py-1.5 px-2 text-right col-quant-extra">
                ${formatPctTo52wCell(wm.high52w, curPrice, 'high')}
              </td>
              <td class="py-1.5 px-3 text-right col-quant-extra">
                ${format52wPositionCell(wm.low52w, wm.high52w, wm.pos52wPct, wlCurrency)}
              </td>
              <td class="py-1.5 px-3 text-right col-quant-extra">
                ${formatPeriodChangeCell(wm.momPct, 'MoM', wm.momRefMonth)}
              </td>
              <td class="py-1.5 px-3 text-right col-quant-extra">
                ${formatPeriodChangeCell(wm.qoqPct, 'QoQ', wm.qoqRefMonth)}
              </td>
              <td class="py-1.5 px-3 text-right col-quant-extra">
                ${formatPeriodChangeCell(wm.yoyPct, 'YoY', wm.yoyRefMonth)}
              </td>
              <td class="py-3 px-3 text-center">
                <div class="table-action-capsule">
                  <button onclick="event.stopPropagation(); selectStockForInlineChart('watchlist', '${w.ticker}', true)" class="p-1.5 ${isSelected ? 'bg-purple-600 text-white' : 'text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-950/40'} rounded" title="Show Monthly Price Chart Below">
                    <i class="fa-solid fa-chart-line"></i>
                  </button>
                  <button onclick="event.stopPropagation(); openEditWatchlistModal('${w.ticker}')" class="p-1.5 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40 rounded transition" title="Edit Watchlist Ticker (Symbol, Name, Sector)">
                    <i class="fa-solid fa-pen-to-square text-xs"></i>
                  </button>
                  <button onclick="event.stopPropagation(); openTradeModalForTicker('${w.ticker}', 'BUY', ${curPrice || recBuy})" class="px-2 py-1 rounded bg-brand-600 hover:bg-brand-500 text-white font-semibold text-[11px]">
                    Buy
                  </button>
                  <button onclick="event.stopPropagation(); deleteFromWatchlist('${w.ticker}')" class="p-1.5 text-slate-400 hover:text-rose-500 transition" title="Remove from Watchlist">
                    <i class="fa-solid fa-trash-can text-xs"></i>
                  </button>
                </div>
              </td>
            `;
            wlTbody.appendChild(tr);
          });
        }
      });
    }
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
    const within3M = (typeof isNewsWithinThreeMonths === 'function') ? isNewsWithinThreeMonths(a?.publishedAt) : true;
    if (a && a.url && within3M && !seenUrls.has(a.url)) {
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
                  <div class="text-[10px] text-slate-500">Suggested trim: ~${Fin.privateShares(o.trimShares)} sh @ ${Fin.currency(o.currentPrice, false, o.currency)}</div>
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
        <td class="py-2.5 px-3 text-right num-font font-bold text-emerald-500">+${Fin.privateShares(estShares)} sh</td>
        <td class="py-2.5 px-3 text-right num-font">${Fin.privateCurrency(estOutlayNative, false, p.currency)}</td>
        <td class="py-2.5 px-3 text-right num-font text-cyan-500">${Fin.isPrivacyMode() ? '••••••/yr' : ('+' + Fin.currency(estAnnualDiv, false, p.currency) + '/yr')}</td>
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
  setVal('setting-stop-floor-pct', cfg.stopLossFloorPct ?? 8.0);
  setVal('setting-peak-trough-months', cfg.peakTroughLookbackMonths ?? 12);
  setVal('setting-rec-buy-pullback', cfg.recBuyPullbackPct ?? 6.0);
  setVal('setting-rec-buy-trough-wt', cfg.recBuyTroughWeightPct ?? 40.0);
  setVal('setting-rec-sell-gain', cfg.recSellTargetGainPct ?? 18.0);
  setVal('setting-rec-sell-peak-wt', cfg.recSellPeakWeightPct ?? 45.0);
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
  state.settings.stopLossFloorPct = num('setting-stop-floor-pct', 8.0);
  state.settings.peakTroughLookbackMonths = num('setting-peak-trough-months', 12);
  state.settings.recBuyPullbackPct = num('setting-rec-buy-pullback', 6.0);
  state.settings.recBuyTroughWeightPct = num('setting-rec-buy-trough-wt', 40.0);
  state.settings.recSellTargetGainPct = num('setting-rec-sell-gain', 18.0);
  state.settings.recSellPeakWeightPct = num('setting-rec-sell-peak-wt', 45.0);
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
      t.classList.add('active', 'text-brand-600', 'dark:text-brand-400', 'bg-slate-200/80', 'dark:bg-slate-800');
      t.classList.remove('text-slate-600', 'dark:text-slate-400', 'text-slate-500');
    } else {
      t.classList.remove('active', 'text-brand-600', 'dark:text-brand-400', 'bg-brand-50', 'dark:bg-brand-950/40', 'bg-slate-200/80', 'dark:bg-slate-800');
      t.classList.add('text-slate-600', 'dark:text-slate-400');
    }
  });

  document.querySelectorAll('.tab-pane').forEach(p => p.classList.add('hidden'));
  const pane = document.getElementById(`tab-content-${target}`);
  if (pane) pane.classList.remove('hidden');
  const kpiSec = document.getElementById('kpi-summary-section');
  if (kpiSec) kpiSec.classList.toggle('hidden', target !== 'dashboard');

  if (_dirtyTabs.has(target)) {
    renderSingleTabContent(target);
    _dirtyTabs.delete(target);
  }

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
  if (el) {
    el.classList.remove('hidden');
    setTimeout(() => {
      const firstInp = el.querySelector('input:not([type="hidden"]):not([disabled]), select:not([disabled])');
      if (firstInp) firstInp.focus();
    }, 60);
  }
}

function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add('hidden');
}

var editingTransactionId = null;
var editingWatchlistOriginalTicker = null;
var editingHoldingOriginalTicker = null;

function migrateTickerAcrossState(oldSym, newSym) {
  const fromSym = MarketAPI.normalizeTicker(oldSym);
  const toSym = MarketAPI.normalizeTicker(newSym);
  if (!fromSym || !toSym || fromSym === toSym) return toSym;

  (state.transactions || []).forEach(tx => {
    if (MarketAPI.normalizeTicker(tx.ticker) === fromSym) {
      tx.ticker = toSym;
    }
  });
  (state.dividends || []).forEach(div => {
    if (MarketAPI.normalizeTicker(div.ticker) === fromSym) {
      div.ticker = toSym;
    }
  });
  (state.watchlist || []).forEach(w => {
    if (MarketAPI.normalizeTicker(w.ticker) === fromSym) {
      w.ticker = toSym;
    }
  });

  ['prices', 'historicalPrices', 'fundamentals', 'dividendSchedules', 'technicals'].forEach(mapKey => {
    if (state[mapKey] && state[mapKey][fromSym]) {
      if (!state[mapKey][toSym]) {
        state[mapKey][toSym] = state[mapKey][fromSym];
      }
      delete state[mapKey][fromSym];
    }
  });

  if (selectedHoldingsTicker === fromSym) selectedHoldingsTicker = toSym;
  if (selectedWatchlistTicker === fromSym) selectedWatchlistTicker = toSym;
  return toSym;
}

function prefillTradeTickerMetadata(rawTicker) {
  const norm = MarketAPI.normalizeTicker(rawTicker);
  const nameEl = document.getElementById('trade-company-name');
  const secEl = document.getElementById('trade-sector');
  if (!norm) {
    if (nameEl) nameEl.value = '';
    if (secEl) secEl.value = '';
    return;
  }
  const held = (portfolio?.allHoldings || portfolio?.activeHoldings || []).find(h => h.ticker === norm);
  const wl = (state?.watchlist || []).find(w => w.ticker === norm);
  const fund = state?.fundamentals?.[norm] || {};
  const staticMeta = MarketAPI.getStaticProfile(norm);

  const existingName = (fund._userCustomName && fund.name)
    ? fund.name
    : (held?.companyName || wl?.name || fund.name || (staticMeta?.name !== norm ? staticMeta?.name : '') || '');
  const existingSector = (fund._userCustomSector && fund.sector)
    ? fund.sector
    : (wl?.sector || (held ? getCanonicalHoldingsSector(held) : '') || (fund.sector && fund.sector !== 'Equities' ? fund.sector : '') || (staticMeta?.sector && staticMeta.sector !== 'Equities' ? staticMeta.sector : ''));

  if (nameEl) nameEl.value = existingName;
  if (secEl) secEl.value = existingSector;
}

function openTradeModal(ticker = null, forceType = 'BUY', defaultPrice = null, editTxId = null) {
  if (typeof refreshSectorDatalist === 'function') refreshSectorDatalist();
  editingTransactionId = editTxId || null;
  const editTx = editingTransactionId ? (state.transactions || []).find(t => t.id === editingTransactionId) : null;

  const type = editTx ? editTx.type : (forceType || 'BUY');
  document.getElementById('trade-type-val').value = type;
  const todayStr = new Date().toISOString().split('T')[0];
  document.getElementById('trade-date').value = editTx?.date || todayStr;
  document.getElementById('trade-cash-date').value = editTx?.date || todayStr;
  document.getElementById('trade-error-msg').classList.add('hidden');

  document.querySelectorAll('.tx-type-btn').forEach(b => {
    const bType = b.getAttribute('data-tx-type');
    b.className = bType === type
      ? 'tx-type-btn py-2 text-xs font-bold rounded-lg border border-brand-500 bg-slate-200 dark:bg-slate-800 text-brand-600 dark:text-brand-400'
      : 'tx-type-btn py-2 text-xs font-bold rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400';
  });

  updateTradeModalFields(type, Boolean(editTx));

  const submitBtn = document.getElementById('trade-modal-submit-btn');
  if (submitBtn) {
    submitBtn.textContent = editTx ? 'Save Changes' : 'Save Transaction';
  }

  if (editTx) {
    if (type === 'DEPOSIT' || type === 'WITHDRAW') {
      document.getElementById('trade-cash-amount').value = editTx.amount ?? '';
      document.getElementById('trade-cash-date').value = editTx.date || todayStr;
    } else {
      const norm = MarketAPI.normalizeTicker(editTx.ticker);
      document.getElementById('trade-ticker').value = norm;
      document.getElementById('trade-shares').value = editTx.shares ?? '';
      document.getElementById('trade-price').value = editTx.price ?? '';
      document.getElementById('trade-fees').value = editTx.fees ?? '0.00';
      prefillTradeTickerMetadata(norm);
      if (editTx.sector && document.getElementById('trade-sector')) {
        document.getElementById('trade-sector').value = editTx.sector;
      }
      updateHoldingHint(norm);
    }
    document.getElementById('trade-notes').value = editTx.notes || '';
  } else {
    if (ticker) {
      const norm = MarketAPI.normalizeTicker(ticker);
      document.getElementById('trade-ticker').value = norm;
      const price = defaultPrice || state.prices[norm]?.price || '';
      document.getElementById('trade-price').value = price;
      prefillTradeTickerMetadata(norm);
      updateHoldingHint(norm);
    } else {
      document.getElementById('trade-ticker').value = '';
      document.getElementById('trade-price').value = '';
      document.getElementById('trade-holding-hint').textContent = '';
      prefillTradeTickerMetadata('');
    }
    document.getElementById('trade-shares').value = '';
    document.getElementById('trade-fees').value = '0.00';
    if (document.getElementById('trade-cash-amount')) document.getElementById('trade-cash-amount').value = '';
    document.getElementById('trade-notes').value = '';
  }

  updateTradeCalculatedTotal();
  openModal('modal-trade');
}

window.openTradeModalForTicker = function(ticker, type, defaultPrice = null) {
  openTradeModal(ticker, type, defaultPrice, null);
};

window.openEditTransactionModal = function(txId) {
  const tx = (state.transactions || []).find(t => t.id === txId);
  if (!tx) return;
  openTradeModal(tx.ticker || null, tx.type, tx.price || null, tx.id);
};

function updateTradeModalFields(type, isEdit = false) {
  const stockFields = document.getElementById('stock-trade-fields');
  const cashFields = document.getElementById('cash-trade-fields');
  const title = document.getElementById('trade-modal-title');
  const actionVerb = isEdit ? 'Edit' : 'Record';

  if (type === 'DEPOSIT' || type === 'WITHDRAW') {
    stockFields.classList.add('hidden');
    cashFields.classList.remove('hidden');
    document.getElementById('trade-ticker').removeAttribute('required');
    document.getElementById('trade-shares').removeAttribute('required');
    document.getElementById('trade-price').removeAttribute('required');
    title.innerHTML = `<i class="fa-solid fa-money-bill-transfer text-indigo-500"></i> ${isEdit ? `Edit ${type} Cash Transaction` : (type === 'DEPOSIT' ? 'Deposit Cash' : 'Withdraw Cash')}`;
  } else {
    stockFields.classList.remove('hidden');
    cashFields.classList.add('hidden');
    document.getElementById('trade-ticker').setAttribute('required', 'true');
    document.getElementById('trade-shares').setAttribute('required', 'true');
    document.getElementById('trade-price').setAttribute('required', 'true');
    title.innerHTML = `<i class="fa-solid fa-money-bill-trend-up text-brand-500"></i> ${actionVerb} ${type} Order`;
  }
}

function updateHoldingHint(ticker) {
  const hint = document.getElementById('trade-holding-hint');
  const norm = MarketAPI.normalizeTicker(ticker);
  const active = portfolio.activeHoldings.find(h => h.ticker === norm);
  hint.textContent = `Currently held: ${active ? Fin.shares(active.shares) : 0} shares`;
}

function getTradeTickerCurrency(rawTicker) {
  const norm = MarketAPI.normalizeTicker(rawTicker || '');
  if (!norm) return state?.settings?.currency || 'HKD';
  const fund = state?.fundamentals?.[norm];
  if (fund?._userCustomCurrency && fund.currency) return fund.currency;
  if (state?.prices?.[norm]?.currency) return state.prices[norm].currency;
  if (fund?.currency) return fund.currency;
  const staticMeta = MarketAPI.getStaticProfile(norm);
  if (staticMeta?.currency) return staticMeta.currency;
  if (norm.endsWith('.HK')) return 'HKD';
  if (norm.endsWith('.L')) return 'GBp';
  return 'USD';
}

function updateTradeCalculatedTotal() {
  const rawTicker = (document.getElementById('trade-ticker')?.value || '').trim();
  const tradeCurr = getTradeTickerCurrency(rawTicker);
  const shares = parseFloat(document.getElementById('trade-shares').value) || 0;
  const price = parseFloat(document.getElementById('trade-price').value) || 0;
  const fees = parseFloat(document.getElementById('trade-fees').value) || 0;
  const type = document.getElementById('trade-type-val').value;
  const total = type === 'BUY' ? (shares * price + fees) : Math.max(0, shares * price - fees);
  const formatted = Fin.currency(total, false, tradeCurr);
  document.getElementById('trade-calc-total').textContent = rawTicker ? `${formatted} (${tradeCurr})` : formatted;
}

async function handleTradeSubmit(e) {
  e.preventDefault();
  const type = document.getElementById('trade-type-val').value;
  const errorMsg = document.getElementById('trade-error-msg');
  errorMsg.classList.add('hidden');
  const existingTxIdx = editingTransactionId
    ? (state.transactions || []).findIndex(t => t.id === editingTransactionId)
    : -1;
  const existingTx = existingTxIdx >= 0 ? state.transactions[existingTxIdx] : null;

  if (type === 'DEPOSIT' || type === 'WITHDRAW') {
    const amt = parseFloat(document.getElementById('trade-cash-amount').value);
    if (!amt || amt <= 0) {
      errorMsg.textContent = 'Enter a valid positive cash amount.';
      errorMsg.classList.remove('hidden');
      return;
    }
    const availableCash = portfolio.cashBalance
      + (existingTx && existingTx.type === 'WITHDRAW' ? Number(existingTx.amount || 0) : 0)
      - (existingTx && existingTx.type === 'DEPOSIT' ? Number(existingTx.amount || 0) : 0);
    if (type === 'WITHDRAW' && amt > availableCash) {
      errorMsg.textContent = `Insufficient cash. Available balance is ${Fin.currency(availableCash)}.`;
      errorMsg.classList.remove('hidden');
      return;
    }
    const date = document.getElementById('trade-cash-date').value || new Date().toISOString().split('T')[0];
    const notes = document.getElementById('trade-notes').value.trim() || `${type} cash transaction`;

    if (existingTxIdx >= 0) {
      state.transactions[existingTxIdx] = {
        ...existingTx,
        date,
        type,
        amount: amt,
        notes
      };
    } else {
      state.transactions.push({
        id: `TX-${Date.now().toString().slice(-6)}`,
        date,
        type,
        amount: amt,
        notes
      });
    }

    editingTransactionId = null;
    recalculatePortfolio();
    saveState();
    renderAll();
    closeModal('modal-trade');
    showToast(existingTx ? `Updated ${type} transaction` : `${type === 'DEPOSIT' ? 'Deposited' : 'Withdrew'} ${Fin.currency(amt)}`, 'success');
    return;
  }

  const rawTicker = document.getElementById('trade-ticker').value.trim();
  const ticker = MarketAPI.normalizeTicker(rawTicker);
  const customCompanyName = (document.getElementById('trade-company-name')?.value || '').trim();
  const customSector = (document.getElementById('trade-sector')?.value || '').trim();
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
    let held = active ? active.shares : 0;
    if (existingTx && MarketAPI.normalizeTicker(existingTx.ticker) === ticker) {
      if (existingTx.type === 'SELL') held += Number(existingTx.shares || 0);
      else if (existingTx.type === 'BUY') held -= Number(existingTx.shares || 0);
    }
    if (shares > held + 1e-6) {
      errorMsg.textContent = `Cannot sell ${Fin.shares(shares)} shares of ${ticker}. Available held shares: ${Fin.shares(Math.max(0, held))}.`;
      errorMsg.classList.remove('hidden');
      return;
    }
  }

  if (!state.prices[ticker]) {
    state.prices[ticker] = { price, prevPrice: price, change: 0, changePct: 0, lastUpdated: new Date().toISOString() };
  }

  // Save custom company name and personalized sector into state.fundamentals and matching watchlist item
  const prevFund = state.fundamentals[ticker] || {};
  const staticMeta = MarketAPI.getStaticProfile(ticker);
  state.fundamentals[ticker] = {
    ...prevFund,
    name: customCompanyName || prevFund.name || staticMeta.name || ticker,
    sector: customSector || prevFund.sector || staticMeta.sector || 'Equities',
    _userCustomName: Boolean(customCompanyName) || Boolean(prevFund._userCustomName),
    _userCustomSector: Boolean(customSector) || Boolean(prevFund._userCustomSector),
    currency: prevFund.currency || staticMeta.currency
  };
  if (customSector) {
    const wlMatch = (state.watchlist || []).find(w => w.ticker === ticker);
    if (wlMatch) wlMatch.sector = customSector;
  }

  if (existingTxIdx >= 0) {
    state.transactions[existingTxIdx] = {
      ...existingTx,
      date,
      type,
      ticker,
      shares,
      price,
      fees,
      sector: customSector || existingTx.sector || state.fundamentals[ticker].sector,
      notes
    };
  } else {
    state.transactions.push({
      id: `TX-${Date.now().toString().slice(-6)}`,
      date,
      type,
      ticker,
      shares,
      price,
      fees,
      sector: customSector || state.fundamentals[ticker].sector,
      notes
    });
  }

  editingTransactionId = null;
  recalculatePortfolio();
  saveState();
  renderAll();
  closeModal('modal-trade');
  showToast(existingTx ? `Updated ${type} transaction for ${ticker}` : `Recorded ${type} order for ${Fin.shares(shares)} ${ticker}`, 'success');

  if (MarketAPI.hasKey()) {
    try {
      const q = await MarketAPI.fetchQuote(ticker);
      if (q?.price) state.prices[ticker] = { ...q, lastUpdated: new Date().toISOString() };
      if (!state.historicalPrices[ticker] || state.historicalPrices[ticker].length === 0) {
        if (typeof syncHistoricalPricesFromCloudflare === 'function') {
          await syncHistoricalPricesFromCloudflare(false, [ticker]);
        } else {
          const hist = await MarketAPI.fetchMonthlyHistory(ticker);
          if (hist?.length) state.historicalPrices[ticker] = hist;
        }
      }
      if (!existingTx && typeof syncCompanyNewsLive === 'function') {
        syncCompanyNewsLive(false, [ticker]).catch(() => {});
      }
      if (!state.fundamentals[ticker] || !state.fundamentals[ticker].pe) {
        const fetchedFund = await MarketAPI.fetchFundamentals(ticker);
        if (fetchedFund) {
          state.fundamentals[ticker] = {
            ...fetchedFund,
            name: customCompanyName || (state.fundamentals[ticker]?._userCustomName ? state.fundamentals[ticker].name : fetchedFund.name),
            sector: customSector || (state.fundamentals[ticker]?._userCustomSector ? state.fundamentals[ticker].sector : fetchedFund.sector),
            _userCustomName: Boolean(customCompanyName) || Boolean(state.fundamentals[ticker]?._userCustomName),
            _userCustomSector: Boolean(customSector) || Boolean(state.fundamentals[ticker]?._userCustomSector)
          };
        }
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

function updateWatchlistModalRecPreview(rawTicker) {
  const sym = MarketAPI.normalizeTicker(rawTicker);
  const previewEl = document.getElementById('wl-rec-levels-preview');
  if (!previewEl) return;
  if (!sym) {
    previewEl.innerHTML = 'Enter a ticker symbol above to preview calculated Recommended Buy, Sell &amp; Stop-Loss levels.';
    return;
  }
  const curP = state?.prices?.[sym]?.price || 0;
  const curr = state?.prices?.[sym]?.currency || state?.fundamentals?.[sym]?.currency || MarketAPI.getStaticProfile(sym).currency || 'HKD';
  const pm = computeStockPriceMetrics(sym, curP);
  if (!pm || (!pm.recommendedBuyPrice && !pm.recommendedSellPrice && !pm.recommendedStopLoss)) {
    previewEl.innerHTML = `<span class="text-slate-400">Live price / history will be fetched on save to compute Recommended levels for <strong>${sym}</strong>.</span>`;
    return;
  }
  previewEl.innerHTML = `
    <span>Quant Recommended (${curr}):</span>
    <strong class="text-sky-500 ml-1">Buy ${pm.recommendedBuyPrice ? Fin.currency(pm.recommendedBuyPrice, false, curr) : '-'}</strong> &bull;
    <strong class="text-pink-500">Sell ${pm.recommendedSellPrice ? Fin.currency(pm.recommendedSellPrice, false, curr) : '-'}</strong> &bull;
    <strong class="text-red-700 dark:text-red-500">Stop ${pm.recommendedStopLoss ? Fin.currency(pm.recommendedStopLoss, false, curr) : '-'}</strong>
  `;
}

window.copyRecommendedToCustomInModal = function(mode) {
  if (mode === 'holding') {
    const sym = MarketAPI.normalizeTicker(document.getElementById('edit-holding-ticker')?.value || editingHoldingOriginalTicker || '');
    if (!sym) return;
    const h = (portfolio?.allHoldings || portfolio?.activeHoldings || []).find(item => item.ticker === sym);
    const curP = state?.prices?.[sym]?.price || h?.currentPrice || 0;
    const avgC = parseFloat(document.getElementById('edit-holding-avg-cost')?.value) || h?.avgCost || null;
    const pm = computeStockPriceMetrics(sym, curP, null, avgC);
    if (pm?.recommendedBuyPrice) document.getElementById('edit-holding-custom-buy').value = pm.recommendedBuyPrice;
    if (pm?.recommendedSellPrice) document.getElementById('edit-holding-custom-sell').value = pm.recommendedSellPrice;
    if (pm?.recommendedStopLoss) document.getElementById('edit-holding-custom-stop').value = pm.recommendedStopLoss;
    showToast(`Copied today's Recommended levels into Custom inputs for ${sym}`, 'info');
  } else if (mode === 'watchlist') {
    const sym = MarketAPI.normalizeTicker(document.getElementById('wl-ticker')?.value || editingWatchlistOriginalTicker || '');
    if (!sym) return;
    const curP = state?.prices?.[sym]?.price || 0;
    const pm = computeStockPriceMetrics(sym, curP);
    if (pm?.recommendedBuyPrice) document.getElementById('wl-custom-buy').value = pm.recommendedBuyPrice;
    if (pm?.recommendedSellPrice) document.getElementById('wl-custom-sell').value = pm.recommendedSellPrice;
    if (pm?.recommendedStopLoss) document.getElementById('wl-custom-stop').value = pm.recommendedStopLoss;
    showToast(`Copied today's Recommended levels into Custom inputs for ${sym}`, 'info');
  }
};

window.clearCustomTargetsInModal = function(mode) {
  if (mode === 'holding') {
    if (document.getElementById('edit-holding-custom-buy')) document.getElementById('edit-holding-custom-buy').value = '';
    if (document.getElementById('edit-holding-custom-sell')) document.getElementById('edit-holding-custom-sell').value = '';
    if (document.getElementById('edit-holding-custom-stop')) document.getElementById('edit-holding-custom-stop').value = '';
  } else if (mode === 'watchlist') {
    if (document.getElementById('wl-custom-buy')) document.getElementById('wl-custom-buy').value = '';
    if (document.getElementById('wl-custom-sell')) document.getElementById('wl-custom-sell').value = '';
    if (document.getElementById('wl-custom-stop')) document.getElementById('wl-custom-stop').value = '';
  }
};

function openWatchlistModal(editTicker = null) {
  if (typeof refreshSectorDatalist === 'function') refreshSectorDatalist();
  const norm = editTicker ? MarketAPI.normalizeTicker(editTicker) : null;
  const existing = norm ? (state.watchlist || []).find(w => w.ticker === norm) : null;
  editingWatchlistOriginalTicker = existing ? existing.ticker : null;

  const titleEl = document.getElementById('watchlist-modal-title');
  const submitBtn = document.getElementById('watchlist-modal-submit-btn');
  const tickerInput = document.getElementById('wl-ticker');
  const nameInput = document.getElementById('wl-name');
  const sectorInput = document.getElementById('wl-sector');
  const custBuyEl = document.getElementById('wl-custom-buy');
  const custSellEl = document.getElementById('wl-custom-sell');
  const custStopEl = document.getElementById('wl-custom-stop');

  if (existing) {
    const fund = state.fundamentals?.[existing.ticker] || {};
    if (titleEl) titleEl.innerHTML = `<i class="fa-solid fa-pen-to-square text-purple-500"></i> Edit Watchlist Ticker (${existing.ticker})`;
    if (submitBtn) submitBtn.textContent = 'Save Changes';
    if (tickerInput) tickerInput.value = existing.ticker;
    const compName = existing.name || fund.name || MarketAPI.getStaticProfile(existing.ticker)?.name || '';
    if (nameInput) nameInput.value = compName === existing.ticker ? '' : compName;
    if (sectorInput) sectorInput.value = getCanonicalWatchlistSector(existing);
    if (custBuyEl) custBuyEl.value = (existing.customBuyPrice ?? fund.customBuyPrice) || '';
    if (custSellEl) custSellEl.value = (existing.customSellPrice ?? fund.customSellPrice) || '';
    if (custStopEl) custStopEl.value = (existing.customStopLoss ?? fund.customStopLoss) || '';
    updateWatchlistModalRecPreview(existing.ticker);
  } else {
    if (titleEl) titleEl.innerHTML = `<i class="fa-solid fa-binoculars text-purple-500"></i> Add Ticker to Watchlist`;
    if (submitBtn) submitBtn.textContent = 'Add & Fetch API Data';
    if (tickerInput) tickerInput.value = '';
    if (nameInput) nameInput.value = '';
    if (sectorInput) sectorInput.value = '';
    if (custBuyEl) custBuyEl.value = '';
    if (custSellEl) custSellEl.value = '';
    if (custStopEl) custStopEl.value = '';
    updateWatchlistModalRecPreview('');
  }

  openModal('modal-watchlist');
}
window.openWatchlistModal = openWatchlistModal;

window.openEditWatchlistModal = function(ticker) {
  openWatchlistModal(ticker);
};

async function handleWatchlistSubmit(e) {
  e.preventDefault();
  const ticker = MarketAPI.normalizeTicker(document.getElementById('wl-ticker').value);
  const name = document.getElementById('wl-name').value.trim();
  const sector = (document.getElementById('wl-sector').value || '').trim() || 'Equities';
  const rawCustBuy = parseFloat(document.getElementById('wl-custom-buy')?.value);
  const rawCustSell = parseFloat(document.getElementById('wl-custom-sell')?.value);
  const rawCustStop = parseFloat(document.getElementById('wl-custom-stop')?.value);
  const customBuyPrice = (Number.isFinite(rawCustBuy) && rawCustBuy > 0) ? Fin.round(rawCustBuy, 4) : null;
  const customSellPrice = (Number.isFinite(rawCustSell) && rawCustSell > 0) ? Fin.round(rawCustSell, 4) : null;
  const customStopLoss = (Number.isFinite(rawCustStop) && rawCustStop > 0) ? Fin.round(rawCustStop, 4) : null;

  if (!ticker) return;

  const isEditing = Boolean(editingWatchlistOriginalTicker);
  if (isEditing && editingWatchlistOriginalTicker !== ticker) {
    const origIdx = state.watchlist.findIndex(w => w.ticker === editingWatchlistOriginalTicker);
    const duplicateIdx = state.watchlist.findIndex(w => w.ticker === ticker);
    if (origIdx >= 0) {
      if (duplicateIdx >= 0 && duplicateIdx !== origIdx) {
        state.watchlist.splice(origIdx, 1);
      } else {
        state.watchlist[origIdx].ticker = ticker;
      }
    }
  }

  const autoMetrics = computeStockPriceMetrics(ticker, state.prices[ticker]?.price || 0);
  const autoRecBuy = autoMetrics?.recommendedBuyPrice || 0;

  const existing = state.watchlist.find(w => w.ticker === ticker);
  if (existing) {
    existing.targetBuyPrice = customBuyPrice || autoRecBuy;
    existing.customBuyPrice = customBuyPrice;
    existing.customSellPrice = customSellPrice;
    existing.customStopLoss = customStopLoss;
    if (name) existing.name = name;
    existing.sector = sector;
  } else {
    state.watchlist.push({
      ticker,
      name: name || ticker,
      sector,
      targetBuyPrice: customBuyPrice || autoRecBuy,
      customBuyPrice,
      customSellPrice,
      customStopLoss
    });
  }

  // Persist user's chosen sector, name & custom levels in state.fundamentals so API/JSON syncs never overwrite them
  const prevFund = state.fundamentals[ticker] || {};
  const staticMeta = MarketAPI.getStaticProfile(ticker);
  state.fundamentals[ticker] = {
    ...prevFund,
    name: name || (prevFund._userCustomName ? prevFund.name : (prevFund.name || staticMeta.name || ticker)),
    sector,
    customBuyPrice,
    customSellPrice,
    customStopLoss,
    _userCustomSector: true,
    _userCustomName: Boolean(name) || Boolean(prevFund._userCustomName),
    currency: prevFund.currency || staticMeta.currency
  };

  editingWatchlistOriginalTicker = null;
  recalculatePortfolio();
  saveState();
  renderAll();
  closeModal('modal-watchlist');
  showToast(isEditing ? `Updated ${ticker} in Watchlist (${sector})` : `Added ${ticker} to Watchlist (${sector})`, 'success');

  if (MarketAPI.hasKey()) {
    try {
      const q = await MarketAPI.fetchQuote(ticker);
      if (q?.price) {
        state.prices[ticker] = { ...q, lastUpdated: new Date().toISOString() };
        const wlItem = state.watchlist.find(w => w.ticker === ticker);
        if (wlItem && (!wlItem.name || wlItem.name === ticker) && q.name && !name) {
          wlItem.name = q.name;
        }
      }
      const fund = await MarketAPI.fetchFundamentals(ticker);
      if (fund) {
        state.fundamentals[ticker] = {
          ...fund,
          name: name || (state.fundamentals[ticker]?._userCustomName ? state.fundamentals[ticker].name : (fund.name || ticker)),
          sector,
          customBuyPrice,
          customSellPrice,
          customStopLoss,
          _userCustomSector: true,
          _userCustomName: Boolean(name) || Boolean(state.fundamentals[ticker]?._userCustomName)
        };
      }
      if (typeof syncHistoricalPricesFromCloudflare === 'function') {
        await syncHistoricalPricesFromCloudflare(false, [ticker]);
      } else {
        const hist = await MarketAPI.fetchMonthlyHistory(ticker);
        if (hist?.length) state.historicalPrices[ticker] = hist;
      }
      if (!isEditing && typeof syncCompanyNewsLive === 'function') {
        syncCompanyNewsLive(false, [ticker]).catch(() => {});
      }
      recalculatePortfolio();
      saveState();
      renderAll();
    } catch (err) {
      console.warn('Watchlist API fetch warning:', err.message);
    }
  }
}

window.openEditHoldingModal = function(rawTicker) {
  if (typeof refreshSectorDatalist === 'function') refreshSectorDatalist();
  const ticker = MarketAPI.normalizeTicker(rawTicker);
  if (!ticker) return;
  const h = (portfolio?.allHoldings || portfolio?.activeHoldings || []).find(item => item.ticker === ticker);
  const fund = state.fundamentals[ticker] || {};
  const wlMatch = (state.watchlist || []).find(w => w.ticker === ticker);
  const staticMeta = MarketAPI.getStaticProfile(ticker);
  const curr = h?.currency || fund.currency || staticMeta.currency || 'HKD';

  editingHoldingOriginalTicker = ticker;
  const titleEl = document.getElementById('edit-holding-modal-title');
  if (titleEl) {
    titleEl.innerHTML = `<i class="fa-solid fa-pen-to-square text-amber-500"></i> Edit Holding (${ticker})`;
  }
  document.getElementById('edit-holding-ticker').value = ticker;
  document.getElementById('edit-holding-name').value = h?.companyName || fund.name || staticMeta.name || ticker;
  document.getElementById('edit-holding-sector').value = h ? getCanonicalHoldingsSector(h) : (fund.sector || staticMeta.sector || 'Equities');
  document.getElementById('edit-holding-currency').value = curr;
  const profEl = document.getElementById('edit-holding-profile');
  if (profEl) profEl.value = fund.assetProfile || wlMatch?.assetProfile || 'auto';
  document.getElementById('edit-holding-shares').value = h ? h.shares : 0;
  document.getElementById('edit-holding-avg-cost').value = (h && h.avgCost > 0) ? h.avgCost : (state.prices[ticker]?.price || '');

  const custBuyEl = document.getElementById('edit-holding-custom-buy');
  const custSellEl = document.getElementById('edit-holding-custom-sell');
  const custStopEl = document.getElementById('edit-holding-custom-stop');
  if (custBuyEl) custBuyEl.value = (fund.customBuyPrice ?? wlMatch?.customBuyPrice ?? h?.customBuyPrice) || '';
  if (custSellEl) custSellEl.value = (fund.customSellPrice ?? wlMatch?.customSellPrice ?? h?.customSellPrice) || '';
  if (custStopEl) custStopEl.value = (fund.customStopLoss ?? wlMatch?.customStopLoss ?? h?.customStopLoss) || '';

  const recPreviewEl = document.getElementById('edit-holding-rec-levels-preview');
  if (recPreviewEl) {
    const pm = computeStockPriceMetrics(ticker, h?.currentPrice || state.prices[ticker]?.price || 0, null, h?.avgCost || null);
    recPreviewEl.innerHTML = `
      <span>Quant Recommended (${curr}):</span>
      <strong class="text-sky-500 ml-1">Buy ${pm?.recommendedBuyPrice ? Fin.currency(pm.recommendedBuyPrice, false, curr) : '-'}</strong> &bull;
      <strong class="text-pink-500">Sell ${pm?.recommendedSellPrice ? Fin.currency(pm.recommendedSellPrice, false, curr) : '-'}</strong> &bull;
      <strong class="text-red-700 dark:text-red-500">Stop ${pm?.recommendedStopLoss ? Fin.currency(pm.recommendedStopLoss, false, curr) : '-'}</strong>
    `;
  }

  const errEl = document.getElementById('edit-holding-error-msg');
  if (errEl) errEl.classList.add('hidden');

  openModal('modal-edit-holding');
};

function handleEditHoldingSubmit(e) {
  e.preventDefault();
  const origTicker = editingHoldingOriginalTicker;
  if (!origTicker) return;

  const newTicker = MarketAPI.normalizeTicker(document.getElementById('edit-holding-ticker').value);
  const newName = (document.getElementById('edit-holding-name').value || '').trim();
  const newSector = (document.getElementById('edit-holding-sector').value || '').trim() || 'Equities';
  const newCurrency = (document.getElementById('edit-holding-currency').value || 'HKD').trim();
  const newShares = parseFloat(document.getElementById('edit-holding-shares').value);
  const newAvgCost = parseFloat(document.getElementById('edit-holding-avg-cost').value);
  const rawCustBuy = parseFloat(document.getElementById('edit-holding-custom-buy')?.value);
  const rawCustSell = parseFloat(document.getElementById('edit-holding-custom-sell')?.value);
  const rawCustStop = parseFloat(document.getElementById('edit-holding-custom-stop')?.value);
  const customBuyPrice = (Number.isFinite(rawCustBuy) && rawCustBuy > 0) ? Fin.round(rawCustBuy, 4) : null;
  const customSellPrice = (Number.isFinite(rawCustSell) && rawCustSell > 0) ? Fin.round(rawCustSell, 4) : null;
  const customStopLoss = (Number.isFinite(rawCustStop) && rawCustStop > 0) ? Fin.round(rawCustStop, 4) : null;

  const errEl = document.getElementById('edit-holding-error-msg');
  if (errEl) errEl.classList.add('hidden');

  if (!newTicker) {
    if (errEl) {
      errEl.textContent = 'Ticker symbol cannot be empty.';
      errEl.classList.remove('hidden');
    }
    return;
  }

  const targetSym = (newTicker !== origTicker) ? migrateTickerAcrossState(origTicker, newTicker) : origTicker;

  // Update fundamentals & custom flags
  const prevFund = state.fundamentals[targetSym] || {};
  state.fundamentals[targetSym] = {
    ...prevFund,
    name: newName || prevFund.name || targetSym,
    sector: newSector,
    currency: newCurrency,
    assetProfile: (document.getElementById('edit-holding-profile')?.value || 'auto'),
    customBuyPrice,
    customSellPrice,
    customStopLoss,
    _userCustomName: true,
    _userCustomSector: true,
    _userCustomCurrency: true
  };
  if (state.prices[targetSym]) {
    state.prices[targetSym].currency = newCurrency;
  }

  // Sync sector, name & custom levels to any matching Watchlist entry and transactions for this ticker
  const wlMatch = (state.watchlist || []).find(w => w.ticker === targetSym);
  if (wlMatch) {
    wlMatch.sector = newSector;
    wlMatch.assetProfile = (document.getElementById('edit-holding-profile')?.value || 'auto');
    wlMatch.customBuyPrice = customBuyPrice;
    wlMatch.customSellPrice = customSellPrice;
    wlMatch.customStopLoss = customStopLoss;
    if (customBuyPrice) wlMatch.targetBuyPrice = customBuyPrice;
    if (newName) wlMatch.name = newName;
  }
  (state.transactions || []).forEach(tx => {
    if (MarketAPI.normalizeTicker(tx.ticker) === targetSym) {
      tx.sector = newSector;
    }
  });

  // Check if user modified active Shares or Average Cost Basis
  const currentHolding = (portfolio?.allHoldings || portfolio?.activeHoldings || []).find(item => item.ticker === targetSym);
  const origShares = currentHolding ? Number(currentHolding.shares || 0) : 0;
  const origAvgCost = currentHolding ? Number(currentHolding.avgCost || 0) : 0;
  const sharesChanged = Number.isFinite(newShares) && newShares >= 0 && Math.abs(newShares - origShares) > 1e-4;
  const costChanged = Number.isFinite(newAvgCost) && newAvgCost > 0 && Math.abs(newAvgCost - origAvgCost) > 1e-4;

  if (sharesChanged || (costChanged && newShares > 0)) {
    const tickerTxs = (state.transactions || []).filter(tx => MarketAPI.normalizeTicker(tx.ticker) === targetSym);
    const buyTxs = tickerTxs.filter(tx => tx.type === 'BUY');
    const sellTxs = tickerTxs.filter(tx => tx.type === 'SELL');

    if (buyTxs.length === 1 && sellTxs.length === 0 && newShares > 0) {
      buyTxs[0].shares = newShares;
      if (Number.isFinite(newAvgCost) && newAvgCost > 0) {
        buyTxs[0].price = newAvgCost;
        buyTxs[0].fees = 0;
      }
    } else if (newShares > origShares) {
      const diffShares = Fin.round(newShares - origShares, 4);
      const effectivePrice = (Number.isFinite(newAvgCost) && newAvgCost > 0) ? newAvgCost : (origAvgCost || state.prices[targetSym]?.price || 1);
      state.transactions.push({
        id: `TX-${Date.now().toString().slice(-6)}`,
        date: new Date().toISOString().split('T')[0],
        type: 'BUY',
        ticker: targetSym,
        shares: diffShares,
        price: effectivePrice,
        fees: 0,
        sector: newSector,
        notes: 'Holding adjustment via Edit Holding'
      });
    } else if (newShares < origShares && newShares >= 0) {
      const diffShares = Fin.round(origShares - newShares, 4);
      const effectivePrice = state.prices[targetSym]?.price || origAvgCost || 1;
      state.transactions.push({
        id: `TX-${Date.now().toString().slice(-6)}`,
        date: new Date().toISOString().split('T')[0],
        type: 'SELL',
        ticker: targetSym,
        shares: diffShares,
        price: effectivePrice,
        fees: 0,
        sector: newSector,
        notes: 'Holding share reduction via Edit Holding'
      });
    } else if (costChanged && buyTxs.length > 0 && origAvgCost > 0) {
      const scaleRatio = newAvgCost / origAvgCost;
      buyTxs.forEach(btx => {
        btx.price = Fin.round(Number(btx.price || 0) * scaleRatio, 4);
        btx.fees = Fin.round(Number(btx.fees || 0) * scaleRatio, 2);
      });
    }
  }

  editingHoldingOriginalTicker = null;
  recalculatePortfolio();
  saveState();
  renderAll();
  closeModal('modal-edit-holding');
  showToast(`Updated holding ${targetSym} (${newSector})`, 'success');
}

window.viewTransactionsForHoldingModal = function() {
  const sym = MarketAPI.normalizeTicker(document.getElementById('edit-holding-ticker')?.value || editingHoldingOriginalTicker || '');
  closeModal('modal-edit-holding');
  switchTab('transactions');
  const searchEl = document.getElementById('tx-search-ticker');
  if (searchEl && sym) {
    searchEl.value = sym;
    tablePageState.tx = 1;
    renderTransactionsTable();
  }
};

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
  } else if (kind === 'cushion') {
    state.settings.chartShowCushion = !(state.settings.chartShowCushion !== false);
  } else if (kind === 'div') {
    state.settings.chartShowDivMarkers = !(state.settings.chartShowDivMarkers !== false);
  }
  saveState();
  renderQuantSettingsUI();
  document.querySelectorAll('.btn-toggle-chart-cushion').forEach(b => {
    const onC = state.settings.chartShowCushion !== false;
    b.className = onC
      ? 'btn-toggle-chart-cushion px-2.5 py-1 rounded-lg text-[11px] font-semibold border bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/40 transition'
      : 'btn-toggle-chart-cushion px-2.5 py-1 rounded-lg text-[11px] font-semibold border bg-slate-100 dark:bg-slate-800 text-slate-400 border-slate-300 dark:border-slate-700 transition';
  });
  document.querySelectorAll('.btn-toggle-chart-div').forEach(b => {
    const onD = state.settings.chartShowDivMarkers !== false;
    b.className = onD
      ? 'btn-toggle-chart-div px-2.5 py-1 rounded-lg text-[11px] font-semibold border bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border-cyan-500/40 transition'
      : 'btn-toggle-chart-div px-2.5 py-1 rounded-lg text-[11px] font-semibold border bg-slate-100 dark:bg-slate-800 text-slate-400 border-slate-300 dark:border-slate-700 transition';
  });
  renderInlineStockChart(tabType || 'holdings');
};

function setupEventListeners() {
  const on = (id, evt, fn) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener(evt, fn);
  };

  // U5: Modal Backdrop Click & Escape Key Ergonomics
  document.querySelectorAll('.modal-backdrop').forEach(modalEl => {
    modalEl.addEventListener('click', (e) => {
      if (e.target === modalEl) closeModal(modalEl.id);
    });
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-backdrop:not(.hidden)').forEach(m => closeModal(m.id));
    }
    // Press '/' to jump to table search
    if (e.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) {
      const activeTab = (typeof getActiveTabName === 'function') ? getActiveTabName() : 'dashboard';
      let targetInput = null;
      if (activeTab === 'holdings') targetInput = document.getElementById('holdings-search-input');
      else if (activeTab === 'watchlist') targetInput = document.getElementById('watchlist-search-input');
      else if (activeTab === 'transactions') targetInput = document.getElementById('tx-search-ticker');
      else if (activeTab === 'dividends') targetInput = document.getElementById('div-log-search-text');
      else if (activeTab === 'news') targetInput = document.getElementById('news-filter-ticker');

      if (targetInput) {
        e.preventDefault();
        targetInput.focus();
        targetInput.select();
      }
    }
  });

  // U1: Header sorting click handlers
  document.querySelectorAll('th[data-sort-col]').forEach(th => {
    th.addEventListener('click', () => {
      const col = th.getAttribute('data-sort-col');
      if (col) handleTableSortClick('holdings', col);
    });
  });
  document.querySelectorAll('th[data-wl-sort-col]').forEach(th => {
    th.addEventListener('click', () => {
      const col = th.getAttribute('data-wl-sort-col');
      if (col) handleTableSortClick('watchlist', col);
    });
  });

  // U1: Quick search real-time listeners
  const hSearch = document.getElementById('holdings-search-input');
  if (hSearch) {
    hSearch.addEventListener('input', () => renderHoldingsTable());
  }
  const wSearch = document.getElementById('watchlist-search-input');
  if (wSearch) {
    wSearch.addEventListener('input', () => renderWatchlistAndFundamentals());
  }

  // U6: Compact View Toggle button listeners
  on('btn-toggle-holdings-compact', 'click', () => {
    if (!state.settings) state.settings = {};
    state.settings.holdingsCompactView = !Boolean(state.settings.holdingsCompactView);
    saveState();
    renderHoldingsTable();
  });
  on('btn-toggle-watchlist-compact', 'click', () => {
    if (!state.settings) state.settings = {};
    state.settings.watchlistCompactView = !Boolean(state.settings.watchlistCompactView);
    saveState();
    renderWatchlistAndFundamentals();
  });

  // A1: Mobile More Drawer Trigger
  on('btn-mobile-more', 'click', () => {
    openModal('mobile-more-drawer');
  });
  on('btn-close-mobile-more', 'click', () => {
    closeModal('mobile-more-drawer');
  });

  document.querySelectorAll('.nav-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      switchTab(tab.getAttribute('data-tab'));
    });
  });

  const handleThemeToggle = () => {
    const isDark = !document.documentElement.classList.contains('dark');
    setTheme(isDark);
  };
  on('settings-theme-toggle', 'click', handleThemeToggle);
  on('theme-toggle', 'click', handleThemeToggle);
  on('btn-set-dark-theme', 'click', () => setTheme(true));
  on('btn-set-light-theme', 'click', () => setTheme(false));
  on('privacy-toggle-btn', 'click', () => togglePrivacyMode());

  on('banner-configure-api-btn', 'click', () => {
    switchTab('settings');
    const provEl = document.getElementById('setting-api-provider');
    if (provEl) provEl.focus();
  });

  on('header-sync-api-btn', 'click', () => syncAllMarketData(false));
  on('header-test-api-btn', 'click', () => {
    switchTab('settings');
    runAndRenderApiDiagnostics();
  });
  on('btn-run-api-diagnostic', 'click', () => runAndRenderApiDiagnostics());
  on('mobile-sync-api-btn', 'click', () => syncAllMarketData(false));
  on('btn-refresh-prices-now', 'click', () => syncAllMarketData(false));
  on('btn-sync-watchlist-api', 'click', () => syncAllMarketData(false));
  on('btn-sync-all-api', 'click', () => syncAllMarketData(false));
  on('btn-fetch-monthly-history', 'click', () => syncHistoricalPricesFromCloudflare(true));
  on('btn-fetch-fundamentals-api', 'click', syncFundamentalsViaAPI);

  // Cloudflare Worker Manual Sync Controls (Settings, Dividends & News)
  on('btn-trigger-gh-prices', 'click', () => syncHistoricalPricesFromCloudflare(true));
  on('btn-settings-sync-dividends', 'click', () => syncDividendsFromCloudflare(true));
  on('btn-trigger-gh-news', 'click', () => syncCompanyNewsLive(true));
  on('btn-sync-dividends-live', 'click', () => syncDividendsFromCloudflare(true));
  on('btn-sync-dividends-cal', 'click', () => syncDividendsFromCloudflare(true));

  // News Tab Controls
  on('btn-sync-news-live', 'click', () => syncCompanyNewsLive(true));
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
  on('div-log-filter-ticker', 'change', () => { tablePageState.divLog = 1; renderDividendsTable(); });
  on('div-log-search-text', 'input', () => { tablePageState.divLog = 1; renderDividendsTable(); });

  // Quantitative Settings Customization Controls
  on('btn-save-quant-settings', 'click', () => saveQuantSettingsFromUI());
  on('btn-reset-quant-settings', 'click', () => resetQuantSettingsToDefault());
  on('btn-export-tickers-json', 'click', () => exportTickersManifestJson());

  document.querySelectorAll('.port-history-mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      portfolioHistoryMode = btn.getAttribute('data-port-mode') || 'return';
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

  document.querySelectorAll('.trades-cashflow-range-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      tradesCashflowRangeMonths = parseInt(btn.getAttribute('data-trades-range'), 10) || 120;
      document.querySelectorAll('.trades-cashflow-range-btn').forEach(b => {
        b.className = 'trades-cashflow-range-btn px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-md font-semibold text-slate-500 dark:text-slate-400 transition';
      });
      btn.className = 'trades-cashflow-range-btn px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-md font-semibold bg-white dark:bg-dark-card shadow text-slate-900 dark:text-white transition';
      if (typeof renderTradesBalanceCashflowChart === 'function') {
        renderTradesBalanceCashflowChart();
      }
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
  on('btn-tx-add', 'click', () => openTradeModal('', 'BUY'));
  on('btn-trade-sim-add', 'click', () => {
    const inp = document.getElementById('trade-sim-add-input');
    if (inp && inp.value.trim()) {
      addTradeSimTicker(inp.value.trim());
      inp.value = '';
    }
  });
  const simAddInp = document.getElementById('trade-sim-add-input');
  if (simAddInp) {
    simAddInp.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (simAddInp.value.trim()) {
          addTradeSimTicker(simAddInp.value.trim());
          simAddInp.value = '';
        }
      }
    });
  }
  // v3.8.0 Multi-Ticker Compare Add & Cross-Device Sync Code Listeners
  on('btn-multi-compare-add', 'click', () => {
    const inp = document.getElementById('multi-compare-add-input');
    if (inp && inp.value.trim() && typeof addMultiCompareTicker === 'function') {
      addMultiCompareTicker(inp.value.trim());
      inp.value = '';
    }
  });
  const cmpInp = document.getElementById('multi-compare-add-input');
  if (cmpInp) {
    cmpInp.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (cmpInp.value.trim() && typeof addMultiCompareTicker === 'function') {
          addMultiCompareTicker(cmpInp.value.trim());
          cmpInp.value = '';
        }
      }
    });
  }
  on('btn-generate-sync-code', 'click', () => {
    const prevEl = document.getElementById('sync-code-export-preview');
    const msgEl = document.getElementById('sync-code-status-msg');
    try {
      const code = generateCrossDeviceSyncCode();
      if (prevEl) prevEl.value = code;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(code).catch(() => {});
      }
      const kb = (code.length / 1024).toFixed(1);
      if (msgEl) msgEl.innerHTML = `<span class="text-emerald-500"><i class="fa-solid fa-circle-check mr-1"></i>Sync Code generated &amp; copied to clipboard (${kb} KB). Paste it on your other device to sync.</span>`;
      if (typeof showToast === 'function') showToast(`Sync Code copied (${kb} KB)!`, 'success');
    } catch (err) {
      if (msgEl) msgEl.innerHTML = `<span class="text-rose-500">Failed to generate Sync Code: ${err.message}</span>`;
    }
  });
  on('btn-restore-sync-code', 'click', () => {
    const inpEl = document.getElementById('sync-code-restore-input');
    const msgEl = document.getElementById('sync-code-status-msg');
    const raw = inpEl ? inpEl.value.trim() : '';
    if (!raw) {
      if (msgEl) msgEl.innerHTML = '<span class="text-amber-500">Please paste a Sync Code (MP38:...) first.</span>';
      return;
    }
    try {
      const res = restoreFromCrossDeviceSyncCode(raw);
      if (inpEl) inpEl.value = '';
      if (msgEl) msgEl.innerHTML = `<span class="text-emerald-500"><i class="fa-solid fa-circle-check mr-1"></i>Restored ${res.txCount} transactions, ${res.divCount} dividends, ${res.wlCount} watchlist tickers &amp; ${res.simCount} simulated trades! Syncing live market data...</span>`;
      if (typeof showToast === 'function') showToast('Portfolio restored from Sync Code!', 'success');
    } catch (err) {
      if (msgEl) msgEl.innerHTML = `<span class="text-rose-500"><i class="fa-solid fa-triangle-exclamation mr-1"></i>${err.message}</span>`;
    }
  });

  on('btn-trade-sim-clear', 'click', () => {
    if (!state) return;
    state.tradeSimRows = [];
    if (typeof saveTradeSimLocal === 'function') saveTradeSimLocal([]);
    saveState(true);
    renderTradeSimulationTable();
  });
  on('btn-holdings-new-trade', 'click', () => openTradeModal());
  on('holdings-filter-signal', 'change', () => renderHoldingsTable());
  on('holdings-filter-active-only', 'change', (e) => {
    state.settings.holdingsActiveOnly = Boolean(e.target.checked);
    saveState();
    renderHoldingsTable();
  });
  on('watchlist-filter-signal', 'change', () => renderWatchlistAndFundamentals());
  on('btn-expand-all-sectors', 'click', () => setAllHoldingsSectorsCollapsed(false));
  on('btn-collapse-all-sectors', 'click', () => setAllHoldingsSectorsCollapsed(true));
  on('btn-wl-expand-all-sectors', 'click', () => setAllWatchlistSectorsCollapsed(false));
  on('btn-wl-collapse-all-sectors', 'click', () => setAllWatchlistSectorsCollapsed(true));
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
      btn.className = 'tx-type-btn py-2 text-xs font-bold rounded-lg border border-brand-500 bg-slate-200 dark:bg-slate-800 text-brand-600 dark:text-brand-400';
      updateTradeModalFields(type);
      updateTradeCalculatedTotal();
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

  on('btn-open-watchlist-modal', 'click', () => openWatchlistModal(null));
  on('form-watchlist', 'submit', handleWatchlistSubmit);
  on('form-edit-holding', 'submit', handleEditHoldingSubmit);
  on('trade-ticker', 'input', () => {
    updateTradeCalculatedTotal();
  });
  on('trade-ticker', 'change', (e) => {
    const val = MarketAPI.normalizeTicker(e.target.value);
    if (val) {
      e.target.value = val;
      updateHoldingHint(val);
      const secEl = document.getElementById('trade-sector');
      const nameEl = document.getElementById('trade-company-name');
      if ((!secEl || !secEl.value.trim()) && (!nameEl || !nameEl.value.trim())) {
        prefillTradeTickerMetadata(val);
      }
    }
    updateTradeCalculatedTotal();
  });
  on('wl-ticker', 'change', (e) => {
    const val = MarketAPI.normalizeTicker(e.target.value);
    if (val) {
      e.target.value = val;
      updateWatchlistModalRecPreview(val);
      if (!editingWatchlistOriginalTicker) {
        const nameEl = document.getElementById('wl-name');
        const secEl = document.getElementById('wl-sector');
        const fund = state?.fundamentals?.[val] || {};
        const staticMeta = MarketAPI.getStaticProfile(val);
        if (nameEl && !nameEl.value.trim() && (fund.name || (staticMeta.name && staticMeta.name !== val))) {
          nameEl.value = fund.name || staticMeta.name;
        }
        if (secEl && !secEl.value.trim()) {
          const defaultSec = (fund.sector && fund.sector !== 'Equities') ? fund.sector : (staticMeta.sector || '');
          if (defaultSec) secEl.value = defaultSec;
        }
      }
    }
  });

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

  const setAllocBtnState = (mode) => {
    const activeCls = 'px-2 py-1 rounded-md font-semibold bg-white dark:bg-dark-card shadow text-slate-900 dark:text-white transition';
    const idleCls = 'px-2 py-1 rounded-md font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition';
    const bT = document.getElementById('toggle-alloc-ticker');
    const bS = document.getElementById('toggle-alloc-sector');
    const bC = document.getElementById('toggle-alloc-currency');
    if (bT) bT.className = mode === 'ticker' ? activeCls : idleCls;
    if (bS) bS.className = mode === 'sector' ? activeCls : idleCls;
    if (bC) bC.className = mode === 'currency' ? activeCls : idleCls;
  };
  on('toggle-alloc-ticker', 'click', () => { allocationViewMode = 'ticker'; setAllocBtnState('ticker'); renderAllocationChart(); });
  on('toggle-alloc-sector', 'click', () => { allocationViewMode = 'sector'; setAllocBtnState('sector'); renderAllocationChart(); });
  on('toggle-alloc-currency', 'click', () => { allocationViewMode = 'currency'; setAllocBtnState('currency'); renderAllocationChart(); });

  // v3.6.0 Benchmark Comparison Overlay buttons
  document.querySelectorAll('.port-benchmark-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const sym = btn.getAttribute('data-benchmark') || 'NONE';
      document.querySelectorAll('.port-benchmark-btn').forEach(b => {
        const isActB = b.getAttribute('data-benchmark') === sym;
        b.className = isActB
          ? 'port-benchmark-btn px-2 py-1 rounded-md font-semibold bg-white dark:bg-dark-card shadow text-slate-900 dark:text-white transition'
          : 'port-benchmark-btn px-2 py-1 rounded-md font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition';
      });
      if (typeof setPortfolioBenchmarkTicker === 'function') setPortfolioBenchmarkTicker(sym);
    });
  });

  // v3.6.0 Holdings Column View Preset buttons
  document.querySelectorAll('.holdings-preset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const preset = btn.getAttribute('data-holdings-preset') || 'full';
      if (!state.settings) state.settings = {};
      state.settings.holdingsViewPreset = preset;
      state.settings.holdingsCompactView = (preset !== 'full');
      saveState();
      renderHoldingsTable();
    });
  });

  // v3.6.0 Projected 12M Dividend Calendar mode toggle
  on('btn-proj-div-stacked', 'click', () => {
    const b1 = document.getElementById('btn-proj-div-stacked');
    const b2 = document.getElementById('btn-proj-div-total');
    if (b1) b1.className = 'px-2.5 py-1 rounded-md font-semibold bg-white dark:bg-dark-card shadow text-slate-900 dark:text-white transition';
    if (b2) b2.className = 'px-2.5 py-1 rounded-md font-semibold text-slate-500 dark:text-slate-400 transition';
    if (typeof setProjectedDivMode === 'function') setProjectedDivMode('stacked');
  });
  on('btn-proj-div-total', 'click', () => {
    const b1 = document.getElementById('btn-proj-div-stacked');
    const b2 = document.getElementById('btn-proj-div-total');
    if (b2) b2.className = 'px-2.5 py-1 rounded-md font-semibold bg-white dark:bg-dark-card shadow text-slate-900 dark:text-white transition';
    if (b1) b1.className = 'px-2.5 py-1 rounded-md font-semibold text-slate-500 dark:text-slate-400 transition';
    if (typeof setProjectedDivMode === 'function') setProjectedDivMode('total');
  });

  on('tx-search-ticker', 'input', () => { tablePageState.tx = 1; renderTransactionsTable(); });
  on('tx-filter-type', 'change', () => { tablePageState.tx = 1; renderTransactionsTable(); });

  on('setting-api-provider', 'change', (e) => {
    state.settings.apiProvider = e.target.value;
    saveState();
    renderApiStatusUI();
  });

  on('btn-save-api-key', 'click', () => {
    state.settings.apiProvider = document.getElementById('setting-api-provider').value;
    state.settings.apiKey = document.getElementById('setting-api-key').value.trim();
    const repoEl = document.getElementById('setting-github-repo');
    const branchEl = document.getElementById('setting-github-branch');
    const tokEl = document.getElementById('setting-github-token');
    if (repoEl && repoEl.value.trim()) state.settings.githubRepo = repoEl.value.trim();
    if (branchEl && branchEl.value.trim()) state.settings.githubBranch = branchEl.value.trim();
    if (tokEl) state.settings.githubToken = tokEl.value.trim();
    saveState();
    renderApiStatusUI();
    if (typeof AppLogger !== 'undefined') {
      AppLogger.action('Settings', `Saved Live Quote API provider (${state.settings.apiProvider.toUpperCase()}) & GitHub settings.`);
    }
    showToast(`Active Live Price API: ${state.settings.apiProvider.toUpperCase()}`, 'success');
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
    AppLogger.info('Boot', 'Starting myPortfolio bootstrap sequence (v3.2.9 • Build 20261107_1750)...');
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

  const AUTO_LIVE_SYNC_INTERVAL_MS = 30000;

  const triggerActivePageAutoSync = () => {
    if (document.visibilityState !== 'visible') return;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
    if (window.__LIVE_PRICE_SYNC_IN_FLIGHT__) return;
    if (typeof syncAllMarketData === 'function') {
      syncAllMarketData(false, { isAutoStartup: true, isAutoTimer: true }).catch(() => {});
    }
  };

  if (window.__AUTO_LIVE_SYNC_TIMER_ID__) {
    clearInterval(window.__AUTO_LIVE_SYNC_TIMER_ID__);
  }
  window.__AUTO_LIVE_SYNC_TIMER_ID__ = setInterval(triggerActivePageAutoSync, AUTO_LIVE_SYNC_INTERVAL_MS);

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      if (typeof checkAndRunDailyCloudflareSync === 'function') {
        checkAndRunDailyCloudflareSync(false);
      }
      if (Date.now() - (window.__LAST_LIVE_SYNC_TS__ || 0) >= AUTO_LIVE_SYNC_INTERVAL_MS) {
        triggerActivePageAutoSync();
      }
    }
  });

  setTimeout(() => {
    if (typeof AppLogger !== 'undefined') {
      AppLogger.runHealthCheck();
      AppLogger.info('Boot', 'myPortfolio v3.5.8 boot sequence complete — triggering initial live price sync, Option 1 daily Cloudflare sync (15Y monthly prices, dividends & news), and 30s active-page auto-sync timer.');
    }
    if (!window.__INITIAL_LIVE_PRICES_SYNCED_ONCE__ && typeof syncAllMarketData === 'function') {
      window.__INITIAL_LIVE_PRICES_SYNCED_ONCE__ = true;
      syncAllMarketData(false, { isAutoStartup: true }).catch(err => {
        if (typeof AppLogger !== 'undefined') {
          AppLogger.warn('Boot', `Initial live price API fetch notice: ${err.message}`);
        }
      });
    }
    if (typeof checkAndRunDailyCloudflareSync === 'function') {
      checkAndRunDailyCloudflareSync(false);
    }
  }, 150);
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

// =========================================================================
// v3.6.0: DASHBOARD ACTION RADAR & CLICK-TO-JUMP CHART NAVIGATION
// =========================================================================
window.jumpToTickerChart = function(tabType, ticker) {
  const targetTab = tabType === 'watchlist' ? 'watchlist' : 'holdings';
  if (typeof switchTab === 'function') switchTab(targetTab);
  setTimeout(() => {
    if (typeof selectStockForInlineChart === 'function') {
      selectStockForInlineChart(targetTab, ticker, true);
    }
    const cardId = targetTab === 'watchlist' ? 'watchlist-stock-chart-card' : 'holdings-stock-chart-card';
    const el = document.getElementById(cardId);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, 80);
};

function renderDashboardActionRadar() {
  const box = document.getElementById('dashboard-action-radar-chips');
  const badge = document.getElementById('action-radar-count-badge');
  if (!box) return;

  const alerts = [];
  const seen = new Set();

  const inspectItem = (sym, curPrice, curr, buyVal, sellVal, stopVal, divInfo, stalePins, tabType) => {
    if (!sym) return;
    if (curPrice > 0 && stopVal > 0 && curPrice <= stopVal * 1.005) {
      alerts.push({ prio: 1, tabType, sym, tag: 'STOP BREACHED', detail: `${Fin.currency(curPrice, false, curr)} <= ${Fin.currency(stopVal, false, curr)}`, cls: 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/35 hover:bg-rose-500/25' });
    }
    if (curPrice > 0 && sellVal > 0 && curPrice >= sellVal * 0.995) {
      alerts.push({ prio: 2, tabType, sym, tag: 'TARGET HIT', detail: `${Fin.currency(curPrice, false, curr)} >= ${Fin.currency(sellVal, false, curr)}`, cls: 'bg-pink-500/15 text-pink-600 dark:text-pink-400 border-pink-500/35 hover:bg-pink-500/25' });
    }
    if (curPrice > 0 && buyVal > 0 && curPrice <= buyVal * 1.015) {
      alerts.push({ prio: 3, tabType, sym, tag: 'BUY ZONE', detail: `${Fin.currency(curPrice, false, curr)} vs ${Fin.currency(buyVal, false, curr)}`, cls: 'bg-sky-500/15 text-sky-600 dark:text-sky-400 border-sky-500/35 hover:bg-sky-500/25' });
    }
    if (divInfo && divInfo.daysUntilEx !== null && divInfo.daysUntilEx >= 0 && divInfo.daysUntilEx <= 14) {
      alerts.push({ prio: 4, tabType, sym, tag: `EX-DIV ${divInfo.daysUntilEx}d`, detail: divInfo.nextExDate || '', cls: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/35 hover:bg-amber-500/25' });
    }
    if (Array.isArray(stalePins) && stalePins.length > 0) {
      const p0 = stalePins[0];
      alerts.push({ prio: 5, tabType, sym, tag: `STALE ${p0.type} PIN`, detail: `${Fin.percent(p0.driftPct, true)} vs Rec`, cls: 'bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/35 hover:bg-purple-500/25' });
    }
  };

  (portfolio?.activeHoldings || []).forEach(h => {
    seen.add(h.ticker);
    const activeBuy = h.customBuyPrice || h.recommendedBuyPrice;
    const activeSell = h.customSellPrice || h.recommendedSellPrice;
    const activeStop = h.customStopLoss || h.recommendedStopLoss;
    inspectItem(h.ticker, h.currentPrice, h.currency || 'HKD', activeBuy, activeSell, activeStop, h.divInfo, h.staleCustomPins, 'holdings');
  });

  (state?.watchlist || []).forEach(w => {
    if (seen.has(w.ticker)) return;
    const curP = Number(state.prices?.[w.ticker]?.price || 0);
    const curr = state.prices?.[w.ticker]?.currency || MarketAPI.getStaticProfile(w.ticker).currency || 'HKD';
    const pm = typeof computeStockPriceMetrics === 'function' ? computeStockPriceMetrics(w.ticker, curP) : null;
    if (!pm) return;
    const activeBuy = w.customBuyPrice || pm.customBuyPrice || pm.recommendedBuyPrice;
    const activeSell = w.customSellPrice || pm.customSellPrice || pm.recommendedSellPrice;
    const activeStop = w.customStopLoss || pm.customStopLoss || pm.recommendedStopLoss;
    inspectItem(w.ticker, curP, curr, activeBuy, activeSell, activeStop, pm.divInfo, pm.staleCustomPins, 'watchlist');
  });

  alerts.sort((a, b) => a.prio - b.prio || a.sym.localeCompare(b.sym));
  if (badge) {
    badge.textContent = `${alerts.length} active ${alerts.length === 1 ? 'alert' : 'alerts'}`;
    badge.className = alerts.length > 0
      ? 'text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30'
      : 'text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30';
  }

  if (alerts.length === 0) {
    box.innerHTML = '<span class="text-xs text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1.5"><i class="fa-solid fa-circle-check"></i> All holdings &amp; watchlist levels are comfortably inside normal range.</span>';
    return;
  }

  box.innerHTML = alerts.slice(0, 14).map(a => `
    <button type="button" onclick="jumpToTickerChart('${a.tabType}', '${a.sym}')" class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-semibold transition cursor-pointer ${a.cls}" title="Jump to ${a.sym} chart (${a.detail})">
      <span class="font-bold">${a.sym}</span>
      <span class="text-[9.5px] font-mono opacity-90">${a.tag}</span>
      ${a.detail ? `<span class="text-[9.5px] opacity-75 hidden sm:inline">· ${a.detail}</span>` : ''}
    </button>
  `).join('');
}
window.renderDashboardActionRadar = renderDashboardActionRadar;

// =========================================================================
// v3.7.0: INLINE TRADE SIMULATION TABLE (TOP OF TRADES PAGE)
// =========================================================================
function computeTradeSimRowMetrics(row) {
  const baseCurr = portfolio?.baseCurrency || state?.settings?.currency || 'HKD';
  const sym = MarketAPI.normalizeTicker(row.ticker);
  const held = (portfolio?.activeHoldings || []).find(h => h.ticker === sym)
    || (portfolio?.allHoldings || []).find(h => h.ticker === sym);
  const priceObj = state?.prices?.[sym] || {};
  const fundObj = state?.fundamentals?.[sym] || {};
  const staticMeta = MarketAPI.getStaticProfile(sym);
  const curr = held?.currency || priceObj.currency || fundObj.currency || staticMeta.currency || (sym.endsWith('.HK') ? 'HKD' : (sym.endsWith('.L') ? 'GBp' : 'USD'));
  const curPrice = Number(priceObj.price || held?.currentPrice || 0);
  const side = (String(row.side || 'BUY').toUpperCase() === 'SELL') ? 'SELL' : 'BUY';
  const simShares = Math.max(0, Number(row.shares) || 0);

  const beforeShares = held && held.shares > 0.0001 ? Number(held.shares) : 0;
  const beforeAvgCost = beforeShares > 0 ? Number(held.avgCost || 0) : 0;
  const beforeMvNative = beforeShares * curPrice;
  const beforeMvBase = Fin.convertCurrency(beforeMvNative, curr, baseCurr);

  const effectiveSimShares = side === 'SELL' ? Math.min(simShares, beforeShares) : simShares;
  const tradeAmountNative = effectiveSimShares * curPrice;
  const tradeAmountBase = Fin.convertCurrency(tradeAmountNative, curr, baseCurr);
  const signedCostNative = side === 'BUY' ? tradeAmountNative : -tradeAmountNative;
  const signedCostBase = side === 'BUY' ? tradeAmountBase : -tradeAmountBase;

  const afterShares = side === 'BUY'
    ? Fin.round(beforeShares + effectiveSimShares, 4)
    : Fin.round(Math.max(0, beforeShares - effectiveSimShares), 4);
  const afterMvNative = afterShares * curPrice;
  const afterMvBase = Fin.convertCurrency(afterMvNative, curr, baseCurr);

  let afterAvgCost = 0;
  if (afterShares > 0.0001) {
    if (side === 'BUY') {
      afterAvgCost = Fin.round(((beforeShares * beforeAvgCost) + (effectiveSimShares * curPrice)) / afterShares, 4);
    } else {
      afterAvgCost = beforeAvgCost;
    }
  }

  return {
    sym, curr, baseCurr, curPrice, side, simShares, effectiveSimShares,
    beforeShares, afterShares,
    beforeMvBase: Fin.round(beforeMvBase, 2),
    afterMvBase: Fin.round(afterMvBase, 2),
    beforeAvgCost: Fin.round(beforeAvgCost, 4),
    afterAvgCost: Fin.round(afterAvgCost, 4),
    tradeAmountNative: Fin.round(tradeAmountNative, 2),
    tradeAmountBase: Fin.round(tradeAmountBase, 2),
    signedCostNative: Fin.round(signedCostNative, 2),
    signedCostBase: Fin.round(signedCostBase, 2),
    held, priceObj, fundObj, staticMeta
  };
}
window.computeTradeSimRowMetrics = computeTradeSimRowMetrics;

function updateTradeSimTotalsUI() {
  const tfoot = document.getElementById('trade-sim-table-foot');
  const badge = document.getElementById('trade-sim-summary-badge');
  const baseCurr = portfolio?.baseCurrency || state?.settings?.currency || 'HKD';
  const hideMoney = Fin.isPrivacyMode();
  const rows = Array.isArray(state?.tradeSimRows) ? state.tradeSimRows : [];

  let totalBuyBase = 0;
  let totalSellBase = 0;
  let totalBeforeMvBase = 0;
  let totalAfterMvBase = 0;
  rows.forEach(r => {
    const m = computeTradeSimRowMetrics(r);
    if (m.side === 'BUY') totalBuyBase += m.tradeAmountBase;
    else totalSellBase += m.tradeAmountBase;
    totalBeforeMvBase += m.beforeMvBase;
    totalAfterMvBase += m.afterMvBase;
  });
  const netCostBase = Fin.round(totalBuyBase - totalSellBase, 2);
  const estCashAfter = Fin.round((portfolio?.cashBalance || 0) - netCostBase, 2);

  if (badge) {
    if (hideMoney) {
      badge.textContent = `${rows.length} simulated`;
    } else {
      badge.textContent = `Total Cost: ${Fin.currency(netCostBase, true, baseCurr)}`;
      badge.className = netCostBase > 0
        ? 'text-[11px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30'
        : (netCostBase < 0
            ? 'text-[11px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
            : 'text-[11px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-brand-500/10 text-brand-600 dark:text-brand-400 border border-brand-500/30');
    }
  }

  if (!tfoot) return;
  if (rows.length === 0) {
    tfoot.innerHTML = '';
    return;
  }

  const netCls = netCostBase > 0 ? 'text-amber-600 dark:text-amber-400' : (netCostBase < 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-700 dark:text-slate-200');
  tfoot.innerHTML = `
    <tr>
      <td class="py-2 px-3 sticky-col-mobile bg-indigo-50 dark:bg-slate-900 font-extrabold text-slate-900 dark:text-white">
        TOTAL COST (${rows.length})
      </td>
      <td colspan="2" class="py-2 px-2 text-right font-mono text-[10.5px] text-slate-500 dark:text-slate-400">
        ${hideMoney ? '••••' : `Buy ${Fin.currency(totalBuyBase, false, baseCurr)} · Sell ${Fin.currency(totalSellBase, false, baseCurr)}`}
      </td>
      <td class="py-2 px-3 text-right num-font font-extrabold ${netCls}">
        ${hideMoney ? '••••••' : Fin.currency(netCostBase, true, baseCurr)}
      </td>
      <td class="py-2 px-3 text-right text-[10px] font-mono text-slate-400">Net (${baseCurr})</td>
      <td class="py-2 px-3 text-right text-[10px] font-mono text-slate-400">-</td>
      <td class="py-2 px-3 text-right num-font text-[11px] text-slate-800 dark:text-slate-200">
        ${hideMoney ? '••••••' : `${Fin.currency(totalBeforeMvBase, false, baseCurr)} &rarr; <span class="text-brand-600 dark:text-brand-400">${Fin.currency(totalAfterMvBase, false, baseCurr)}</span>`}
      </td>
      <td colspan="18" class="py-2 px-3 text-left text-[11px] font-mono text-slate-500 dark:text-slate-400">
        ${hideMoney ? '' : `Est. Cash After Sim: <strong class="${estCashAfter >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'}">${Fin.currency(estCashAfter, false, baseCurr)}</strong>`}
      </td>
    </tr>
  `;
}

window.onTradeSimInputChange = function(rowId, field, value) {
  if (!Array.isArray(state?.tradeSimRows)) return;
  const row = state.tradeSimRows.find(r => r.id === rowId);
  if (!row) return;
  if (field === 'side') {
    row.side = (String(value).toUpperCase() === 'SELL') ? 'SELL' : 'BUY';
  } else if (field === 'shares') {
    row.shares = Math.max(0, parseFloat(value) || 0);
  }
  if (typeof saveTradeSimLocal === 'function') saveTradeSimLocal(state.tradeSimRows);
  saveState(true);

  const tr = document.querySelector(`tr[data-sim-row-id="${rowId}"]`);
  if (!tr) {
    renderTradeSimulationTable();
    return;
  }
  const m = computeTradeSimRowMetrics(row);
  const hideMoney = Fin.isPrivacyMode();

  const selEl = tr.querySelector('select[data-sim-side]');
  if (selEl) {
    selEl.className = m.side === 'BUY'
      ? 'px-2 py-1 rounded-md text-[11px] font-bold border bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/35 cursor-pointer'
      : 'px-2 py-1 rounded-md text-[11px] font-bold border bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/35 cursor-pointer';
  }

  const costCell = tr.querySelector('[data-sim-cost]');
  if (costCell) {
    if (hideMoney) {
      costCell.innerHTML = '<span class="text-slate-400 font-mono">••••</span>';
    } else if (m.tradeAmountNative > 0) {
      const signCls = m.side === 'BUY' ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400';
      const subBase = (m.curr !== m.baseCurr) ? `<div class="text-[9.5px] font-mono text-slate-400">${Fin.currency(m.signedCostBase, true, m.baseCurr)}</div>` : '';
      costCell.innerHTML = `<div class="font-bold num-font ${signCls}">${Fin.currency(m.signedCostNative, true, m.curr)}</div>${subBase}`;
    } else {
      costCell.innerHTML = '<span class="text-slate-400 font-mono">-</span>';
    }
  }

  const shCell = tr.querySelector('[data-sim-shares-ba]');
  if (shCell) {
    shCell.innerHTML = hideMoney
      ? '<span class="text-slate-400 font-mono">••••</span>'
      : `<span class="text-slate-400">${Fin.shares(m.beforeShares)}</span> <span class="text-slate-400 mx-0.5">&rarr;</span> <strong class="text-slate-900 dark:text-white">${Fin.shares(m.afterShares)}</strong>`;
  }

  const mvCell = tr.querySelector('[data-sim-mv-ba]');
  if (mvCell) {
    mvCell.innerHTML = hideMoney
      ? '<span class="text-slate-400 font-mono">••••••</span>'
      : `<span class="text-slate-400">${Fin.currency(m.beforeMvBase, false, m.baseCurr)}</span> <span class="text-slate-400 mx-0.5">&rarr;</span> <strong class="text-slate-900 dark:text-white">${Fin.currency(m.afterMvBase, false, m.baseCurr)}</strong>`;
  }

  const avgCell = tr.querySelector('[data-sim-avg-ba]');
  if (avgCell) {
    const bTxt = m.beforeAvgCost > 0 ? Fin.currency(m.beforeAvgCost, false, m.curr) : '-';
    const aTxt = m.afterAvgCost > 0 ? Fin.currency(m.afterAvgCost, false, m.curr) : '-';
    avgCell.innerHTML = hideMoney
      ? '<span class="text-slate-400 font-mono">••••</span>'
      : `<span class="text-slate-400">${bTxt}</span> <span class="text-slate-400 mx-0.5">&rarr;</span> <strong class="text-slate-900 dark:text-white">${aTxt}</strong>`;
  }

  updateTradeSimTotalsUI();
};

window.addTradeSimTicker = async function(rawTicker) {
  const sym = MarketAPI.normalizeTicker(rawTicker);
  if (!sym) return;
  if (!Array.isArray(state.tradeSimRows)) state.tradeSimRows = [];
  if (state.tradeSimRows.some(r => r.ticker === sym)) {
    if (typeof showToast === 'function') showToast(`${sym} is already in Trade Simulation.`, 'info');
    return;
  }
  const row = { id: 'sim_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6), ticker: sym, side: 'BUY', shares: 0 };
  state.tradeSimRows.push(row);
  if (typeof saveTradeSimLocal === 'function') saveTradeSimLocal(state.tradeSimRows);
  saveState(true);
  renderTradeSimulationTable();

  if (!state.prices?.[sym]?.price && typeof MarketAPI !== 'undefined' && typeof MarketAPI.fetchQuote === 'function') {
    try {
      const q = await MarketAPI.fetchQuote(sym);
      if (q && q.price > 0) {
        state.prices[sym] = { ...(state.prices[sym] || {}), ...q, lastUpdated: new Date().toISOString() };
        saveState();
        renderTradeSimulationTable();
      }
    } catch (_) {}
  }
};

window.removeTradeSimRow = function(rowId) {
  if (!Array.isArray(state?.tradeSimRows)) return;
  state.tradeSimRows = state.tradeSimRows.filter(r => r.id !== rowId);
  if (typeof saveTradeSimLocal === 'function') saveTradeSimLocal(state.tradeSimRows);
  saveState(true);
  renderTradeSimulationTable();
};

window.commitTradeSimRow = function(rowId) {
  const row = (state?.tradeSimRows || []).find(r => r.id === rowId);
  if (!row) return;
  if (typeof openTradeModalForTicker === 'function') {
    openTradeModalForTicker(row.ticker, row.side || 'BUY');
    setTimeout(() => {
      const shEl = document.getElementById('trade-shares');
      if (shEl && row.shares > 0) {
        shEl.value = row.shares;
        shEl.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }, 60);
  }
};

function renderTradeSimulationTable() {
  const tbody = document.getElementById('trade-sim-table-body');
  const dl = document.getElementById('trade-sim-ticker-datalist');
  if (!tbody) return;

  // Populate autocomplete datalist with all holdings & watchlist tickers
  if (dl) {
    const known = new Set();
    (portfolio?.allHoldings || []).forEach(h => known.add(h.ticker));
    (state?.watchlist || []).forEach(w => known.add(w.ticker));
    dl.innerHTML = Array.from(known).sort().map(t => `<option value="${t}"></option>`).join('');
  }

  const rows = Array.isArray(state?.tradeSimRows) ? state.tradeSimRows : [];
  if (rows.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="25" class="py-6 px-4 text-center text-xs text-slate-400">
          Add any ticker above to simulate Buy/Sell orders inline and preview Before &rarr; After Shares, Market Value, Avg Cost &amp; Total Cost.
        </td>
      </tr>
    `;
    updateTradeSimTotalsUI();
    return;
  }

  const hideMoney = Fin.isPrivacyMode();
  tbody.innerHTML = '';
  rows.forEach(row => {
    const m = computeTradeSimRowMetrics(row);
    const wm = typeof computeStockPriceMetrics === 'function'
      ? computeStockPriceMetrics(m.sym, m.curPrice, null, m.beforeAvgCost > 0 ? m.beforeAvgCost : null)
      : {};
    const compName = m.held?.companyName || m.fundObj.name || m.staticMeta.name || m.sym;
    const priceChangePct = m.priceObj.changePct || 0;
    const prevClose = Number(m.priceObj.prevPrice || m.curPrice || 0);
    const rawDelta = (m.curPrice > 0 && prevClose > 0) ? Fin.round(m.curPrice - prevClose, 4) : Number(m.priceObj.change || 0);
    const priceDelta = Math.abs(priceChangePct) > 40 ? 0 : rawDelta;
    const priceChgCls = priceDelta >= 0 ? 'text-emerald-500' : 'text-rose-500';

    const wlEntry = (state?.watchlist || []).find(w => w.ticker === m.sym);
    const recBuy = wm?.recommendedBuyPrice || 0;
    const recSell = wm?.recommendedSellPrice || 0;
    const recStop = wm?.recommendedStopLoss || 0;
    const custBuy = Number(wlEntry?.customBuyPrice || wm?.customBuyPrice || 0) || null;
    const custSell = Number(wlEntry?.customSellPrice || wm?.customSellPrice || 0) || null;
    const custStop = Number(wlEntry?.customStopLoss || wm?.customStopLoss || 0) || null;
    const activeBuy = custBuy || recBuy;
    const distPct = (m.curPrice > 0 && activeBuy > 0) ? ((m.curPrice - activeBuy) / activeBuy) * 100 : 0;

    const sideCls = m.side === 'BUY'
      ? 'px-2 py-1 rounded-md text-[11px] font-bold border bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/35 cursor-pointer'
      : 'px-2 py-1 rounded-md text-[11px] font-bold border bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/35 cursor-pointer';

    const costHtml = hideMoney
      ? '<span class="text-slate-400 font-mono">••••</span>'
      : (m.tradeAmountNative > 0
          ? `<div class="font-bold num-font ${m.side === 'BUY' ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}">${Fin.currency(m.signedCostNative, true, m.curr)}</div>${m.curr !== m.baseCurr ? `<div class="text-[9.5px] font-mono text-slate-400">${Fin.currency(m.signedCostBase, true, m.baseCurr)}</div>` : ''}`
          : '<span class="text-slate-400 font-mono">-</span>');

    const bAvgTxt = m.beforeAvgCost > 0 ? Fin.currency(m.beforeAvgCost, false, m.curr) : '-';
    const aAvgTxt = m.afterAvgCost > 0 ? Fin.currency(m.afterAvgCost, false, m.curr) : '-';

    const tr = document.createElement('tr');
    tr.className = 'hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition';
    tr.setAttribute('data-sim-row-id', row.id);
    tr.innerHTML = `
      <td class="py-1.5 px-3 sticky-col-mobile max-w-[148px] sm:max-w-none bg-white dark:bg-dark-card">
        <div class="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
          <span class="truncate">${m.sym}</span>
          <span class="text-[9px] px-1 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-medium shrink-0">${m.curr}</span>
        </div>
        <div class="text-[10px] text-slate-400 truncate max-w-[115px] sm:max-w-[165px]">${compName}</div>
      </td>
      <td class="py-1.5 px-2 text-center">
        <select data-sim-side onchange="onTradeSimInputChange('${row.id}', 'side', this.value)" class="${sideCls}">
          <option value="BUY" ${m.side === 'BUY' ? 'selected' : ''}>BUY</option>
          <option value="SELL" ${m.side === 'SELL' ? 'selected' : ''}>SELL</option>
        </select>
      </td>
      <td class="py-1.5 px-2 text-right">
        <input type="number" step="any" min="0" value="${row.shares || ''}" placeholder="0" oninput="onTradeSimInputChange('${row.id}', 'shares', this.value)" class="w-20 sm:w-24 px-2 py-1 text-right text-xs font-bold num-font bg-slate-50 dark:bg-dark-input border border-slate-300 dark:border-slate-700 rounded-md text-slate-900 dark:text-white">
      </td>
      <td class="py-1.5 px-3 text-right" data-sim-cost>
        ${costHtml}
      </td>
      <td class="py-1.5 px-3 text-right">
        ${m.curPrice > 0
          ? `<div class="font-bold num-font text-slate-900 dark:text-white">${Fin.currency(m.curPrice, false, m.curr)}</div>
             <div class="text-[10px] num-font ${priceChgCls}"><span class="text-[9px] opacity-75 font-semibold">1D</span> ${Fin.currency(priceDelta, true, m.curr)}</div>`
          : '<span class="text-slate-400 text-[11px]">No Quote</span>'}
      </td>
      <td class="py-1.5 px-3 text-right num-font" data-sim-shares-ba>
        ${hideMoney ? '<span class="text-slate-400 font-mono">••••</span>' : `<span class="text-slate-400">${Fin.shares(m.beforeShares)}</span> <span class="text-slate-400 mx-0.5">&rarr;</span> <strong class="text-slate-900 dark:text-white">${Fin.shares(m.afterShares)}</strong>`}
      </td>
      <td class="py-1.5 px-3 text-right num-font" data-sim-mv-ba>
        ${hideMoney ? '<span class="text-slate-400 font-mono">••••••</span>' : `<span class="text-slate-400">${Fin.currency(m.beforeMvBase, false, m.baseCurr)}</span> <span class="text-slate-400 mx-0.5">&rarr;</span> <strong class="text-slate-900 dark:text-white">${Fin.currency(m.afterMvBase, false, m.baseCurr)}</strong>`}
      </td>
      <td class="py-1.5 px-3 text-right num-font" data-sim-avg-ba>
        ${hideMoney ? '<span class="text-slate-400 font-mono">••••</span>' : `<span class="text-slate-400">${bAvgTxt}</span> <span class="text-slate-400 mx-0.5">&rarr;</span> <strong class="text-slate-900 dark:text-white">${aAvgTxt}</strong>`}
      </td>
      <td class="py-1.5 px-3 text-right">${formatTrendRegimeCell(wm)}</td>
      <td class="py-1.5 px-3 text-center">${formatSignalBadgeCell(m.sym, wm)}</td>
      <td class="py-1.5 px-3 text-right">${formatDividendExDateCell(wm.divInfo)}</td>
      <td class="py-1.5 px-3 text-right num-font">${formatTargetLevelCell(custBuy, recBuy, m.curPrice, m.curr, 'text-sky-500', 'Buy Target')}</td>
      <td class="py-1.5 px-3 text-right num-font font-medium ${distPct <= 0.5 && m.curPrice > 0 ? 'text-emerald-500 font-bold' : 'text-slate-400'}">
        ${m.curPrice > 0 && activeBuy > 0 ? (distPct <= 0.5 ? 'In Buy Zone' : `+${distPct.toFixed(1)}% above`) : '-'}
      </td>
      <td class="py-1.5 px-3 text-right num-font">${formatTargetLevelCell(custSell, recSell, m.curPrice, m.curr, 'text-pink-500', 'Sell Target')}</td>
      <td class="py-1.5 px-3 text-right num-font">${formatTargetLevelCell(custStop, recStop, m.curPrice, m.curr, 'text-red-700 dark:text-red-500', 'Stop Loss')}</td>
      <td class="py-1.5 px-3 text-center num-font">
        ${wm?.riskRewardRatio !== null && wm?.riskRewardRatio !== undefined
          ? `<span class="px-1.5 py-0.5 rounded text-[11px] font-bold border ${wm.riskRewardRatio >= 2.0 ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30' : (wm.riskRewardRatio >= 1.0 ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30' : 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30')}">${wm.riskRewardRatio.toFixed(1)}x</span>`
          : '<span class="text-slate-400 text-xs">-</span>'}
      </td>
      <td class="py-1.5 px-3 text-right num-font text-slate-600 dark:text-slate-300">
        ${wm.low52w !== null && wm.low52w !== undefined ? Fin.currency(wm.low52w, false, m.curr) : '<span class="text-slate-400 text-[11px]">-</span>'}
      </td>
      <td class="py-1.5 px-3 text-right num-font text-slate-600 dark:text-slate-300">
        ${wm.high52w !== null && wm.high52w !== undefined ? Fin.currency(wm.high52w, false, m.curr) : '<span class="text-slate-400 text-[11px]">-</span>'}
      </td>
      <td class="py-1.5 px-2 text-right">${formatPctTo52wCell(wm.low52w, m.curPrice, 'low')}</td>
      <td class="py-1.5 px-2 text-right">${formatPctTo52wCell(wm.high52w, m.curPrice, 'high')}</td>
      <td class="py-1.5 px-3 text-right">${format52wPositionCell(wm.low52w, wm.high52w, wm.pos52wPct, m.curr)}</td>
      <td class="py-1.5 px-3 text-right">${formatPeriodChangeCell(wm.momPct, 'MoM', wm.momRefMonth)}</td>
      <td class="py-1.5 px-3 text-right">${formatPeriodChangeCell(wm.qoqPct, 'QoQ', wm.qoqRefMonth)}</td>
      <td class="py-1.5 px-3 text-right">${formatPeriodChangeCell(wm.yoyPct, 'YoY', wm.yoyRefMonth)}</td>
      <td class="py-1.5 px-3 text-center">
        <div class="inline-flex items-center gap-1">
          <button type="button" onclick="commitTradeSimRow('${row.id}')" class="p-1.5 text-xs text-brand-600 dark:text-brand-400 hover:bg-brand-500/15 rounded transition" title="Record this simulated trade in ledger">
            <i class="fa-solid fa-check"></i>
          </button>
          <button type="button" onclick="removeTradeSimRow('${row.id}')" class="p-1.5 text-xs text-rose-500 hover:bg-rose-500/15 rounded transition" title="Remove row">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });

  updateTradeSimTotalsUI();
}
window.renderTradeSimulationTable = renderTradeSimulationTable;

// =========================================================================
// v3.8.0: INLINE CHART QUICK-PIN BAR, ANNUAL SCORECARD & BACKUP AGE PILL
// =========================================================================
window.populateInlineQuickPinBar = function(tabType, ticker, pm) {
  const prefix = tabType === 'watchlist' ? 'watchlist' : 'holdings';
  const bEl = document.getElementById(`${prefix}-qpin-buy`);
  const sEl = document.getElementById(`${prefix}-qpin-sell`);
  const stEl = document.getElementById(`${prefix}-qpin-stop`);
  if (!bEl || !sEl || !stEl) return;
  const fund = state?.fundamentals?.[ticker] || {};
  const wl = (state?.watchlist || []).find(w => w.ticker === ticker);
  bEl.value = (fund.customBuyPrice ?? wl?.customBuyPrice ?? '') || '';
  sEl.value = (fund.customSellPrice ?? wl?.customSellPrice ?? '') || '';
  stEl.value = (fund.customStopLoss ?? wl?.customStopLoss ?? '') || '';
  bEl.placeholder = pm?.recommendedBuyPrice ? `Rec ${pm.recommendedBuyPrice}` : 'Auto';
  sEl.placeholder = pm?.recommendedSellPrice ? `Rec ${pm.recommendedSellPrice}` : 'Auto';
  stEl.placeholder = pm?.recommendedStopLoss ? `Rec ${pm.recommendedStopLoss}` : 'Auto';
};

window.saveInlineQuickPins = function(tabType) {
  const isWl = tabType === 'watchlist';
  const ticker = isWl ? selectedWatchlistTicker : selectedHoldingsTicker;
  if (!ticker) return;
  const prefix = isWl ? 'watchlist' : 'holdings';
  const rawB = parseFloat(document.getElementById(`${prefix}-qpin-buy`)?.value);
  const rawS = parseFloat(document.getElementById(`${prefix}-qpin-sell`)?.value);
  const rawSt = parseFloat(document.getElementById(`${prefix}-qpin-stop`)?.value);
  const cBuy = (Number.isFinite(rawB) && rawB > 0) ? Fin.round(rawB, 4) : null;
  const cSell = (Number.isFinite(rawS) && rawS > 0) ? Fin.round(rawS, 4) : null;
  const cStop = (Number.isFinite(rawSt) && rawSt > 0) ? Fin.round(rawSt, 4) : null;

  if (!state.fundamentals) state.fundamentals = {};
  state.fundamentals[ticker] = {
    ...(state.fundamentals[ticker] || {}),
    customBuyPrice: cBuy,
    customSellPrice: cSell,
    customStopLoss: cStop
  };
  const wl = (state.watchlist || []).find(w => w.ticker === ticker);
  if (wl) {
    wl.customBuyPrice = cBuy;
    wl.customSellPrice = cSell;
    wl.customStopLoss = cStop;
    if (cBuy) wl.targetBuyPrice = cBuy;
  }
  if (typeof invalidateStockMetricsCache === 'function') invalidateStockMetricsCache();
  recalculatePortfolio();
  saveState(true);
  renderAll(true);
  if (typeof showToast === 'function') showToast(`Saved custom pins for ${ticker}`, 'success');
};

window.snapInlineQuickPinsToRec = function(tabType) {
  const isWl = tabType === 'watchlist';
  const ticker = isWl ? selectedWatchlistTicker : selectedHoldingsTicker;
  if (!ticker) return;
  const prefix = isWl ? 'watchlist' : 'holdings';
  const h = (portfolio?.activeHoldings || []).find(x => x.ticker === ticker);
  const curP = Number(state?.prices?.[ticker]?.price || h?.currentPrice || 0);
  const pm = typeof computeStockPriceMetrics === 'function' ? computeStockPriceMetrics(ticker, curP, null, h?.avgCost || null) : null;
  if (!pm) return;
  const bEl = document.getElementById(`${prefix}-qpin-buy`);
  const sEl = document.getElementById(`${prefix}-qpin-sell`);
  const stEl = document.getElementById(`${prefix}-qpin-stop`);
  if (bEl && pm.recommendedBuyPrice) bEl.value = pm.recommendedBuyPrice;
  if (sEl && pm.recommendedSellPrice) sEl.value = pm.recommendedSellPrice;
  if (stEl && pm.recommendedStopLoss) stEl.value = pm.recommendedStopLoss;
  saveInlineQuickPins(tabType);
};

window.clearInlineQuickPins = function(tabType) {
  const prefix = tabType === 'watchlist' ? 'watchlist' : 'holdings';
  ['buy', 'sell', 'stop'].forEach(k => {
    const el = document.getElementById(`${prefix}-qpin-${k}`);
    if (el) el.value = '';
  });
  saveInlineQuickPins(tabType);
};

var scorecardGranularity = 'yearly';
window.setScorecardGranularity = function(mode) {
  scorecardGranularity = ['monthly', 'quarterly', 'yearly'].includes(mode) ? mode : 'yearly';
  document.querySelectorAll('.scorecard-mode-btn').forEach(b => {
    const act = b.getAttribute('data-scorecard-mode') === scorecardGranularity;
    b.className = act
      ? 'scorecard-mode-btn px-2.5 py-1 rounded-md font-semibold bg-white dark:bg-dark-card shadow text-slate-900 dark:text-white transition'
      : 'scorecard-mode-btn px-2.5 py-1 rounded-md font-semibold text-slate-500 dark:text-slate-400 transition';
  });
  renderAnnualTradeScorecard();
};

function renderAnnualTradeScorecard() {
  const tbody = document.getElementById('annual-scorecard-tbody');
  const tfoot = document.getElementById('annual-scorecard-tfoot');
  const badge = document.getElementById('annual-scorecard-summary-badge');
  const hdrEl = document.getElementById('scorecard-period-col-hdr');
  if (!tbody || typeof computePeriodicTradeScorecard !== 'function') return;

  const { mode, baseCurr, rows, totals } = computePeriodicTradeScorecard(scorecardGranularity);
  const hideMoney = Fin.isPrivacyMode();

  if (hdrEl) {
    hdrEl.textContent = mode === 'monthly' ? 'Month' : (mode === 'quarterly' ? 'Quarter' : 'Year');
  }
  if (badge) {
    badge.textContent = hideMoney
      ? `${totals.buys + totals.sells} Trades · ${totals.winRatePct !== null ? totals.winRatePct + '% Win' : '—'}`
      : `All-Time Realized + Div: ${Fin.currency(totals.totalCashGainBase, true, baseCurr)}`;
  }

  if (rows.length === 0) {
    tbody.innerHTML = '<tr><td colspan="10" class="py-6 px-4 text-center text-slate-400">Record buy/sell trades or dividends to see your periodic scorecard.</td></tr>';
    if (tfoot) tfoot.innerHTML = '';
    return;
  }

  tbody.innerHTML = rows.map(r => {
    const uCls = r.unrealizedPnlBase >= 0 ? 'text-emerald-500' : 'text-rose-500';
    const rCls = r.realizedPnlBase >= 0 ? 'text-emerald-500' : 'text-rose-500';
    const totCls = r.totalCashGainBase >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500';
    const wrCls = r.winRatePct === null ? 'text-slate-400' : (r.winRatePct >= 60 ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30' : (r.winRatePct >= 40 ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30' : 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30'));
    return `
      <tr class="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition">
        <td class="py-1.5 px-3 sticky-col-mobile bg-white dark:bg-dark-card font-mono font-bold text-slate-900 dark:text-white">${r.period}</td>
        <td class="py-1.5 px-3 text-center font-mono text-slate-600 dark:text-slate-300">
          <span class="text-emerald-500 font-semibold">${r.buys}B</span> / <span class="text-rose-500 font-semibold">${r.sells}S</span>
        </td>
        <td class="py-1.5 px-3 text-right num-font font-semibold ${r.buyAmountBase > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}">
          ${hideMoney ? '••••' : (r.buyAmountBase > 0 ? Fin.currency(r.buyAmountBase, false, baseCurr) : '-')}
        </td>
        <td class="py-1.5 px-3 text-right num-font font-semibold ${r.sellAmountBase > 0 ? 'text-rose-500' : 'text-slate-400'}">
          ${hideMoney ? '••••' : (r.sellAmountBase > 0 ? Fin.currency(r.sellAmountBase, false, baseCurr) : '-')}
        </td>
        <td class="py-1.5 px-3 text-right num-font font-bold ${Math.abs(r.unrealizedPnlBase) >= 0.005 ? uCls : 'text-slate-400'}" title="Unrealized P&amp;L change in ${r.period} (Closing balance: ${hideMoney ? 'Hidden' : Fin.currency(r.closingUnrealizedBase || 0, true, baseCurr)})">
          ${hideMoney ? '••••••' : (Math.abs(r.unrealizedPnlBase) >= 0.005 ? Fin.currency(r.unrealizedPnlBase, true, baseCurr) : '-')}
        </td>
        <td class="py-1.5 px-3 text-right num-font font-bold ${Math.abs(r.realizedPnlBase) >= 0.005 ? rCls : 'text-slate-400'}">
          ${hideMoney ? '••••••' : (Math.abs(r.realizedPnlBase) >= 0.005 ? Fin.currency(r.realizedPnlBase, true, baseCurr) : '-')}
        </td>
        <td class="py-1.5 px-3 text-right num-font font-bold ${r.dividendsBase >= 0.005 ? 'text-cyan-600 dark:text-cyan-400' : 'text-slate-400'}">
          ${hideMoney ? '••••••' : (r.dividendsBase >= 0.005 ? '+' + Fin.currency(r.dividendsBase, false, baseCurr) : '-')}
        </td>
        <td class="py-1.5 px-3 text-right num-font font-extrabold ${Math.abs(r.totalCashGainBase) >= 0.005 ? totCls : 'text-slate-400'}">
          ${hideMoney ? '••••••' : (Math.abs(r.totalCashGainBase) >= 0.005 ? Fin.currency(r.totalCashGainBase, true, baseCurr) : '-')}
        </td>
        <td class="py-1.5 px-3 text-right num-font text-slate-500 dark:text-slate-400">
          ${hideMoney ? '••••' : (r.feesBase >= 0.005 ? Fin.currency(r.feesBase, false, baseCurr) : '-')}
        </td>
        <td class="py-1.5 px-3 text-center">
          ${r.winRatePct !== null
            ? `<span class="px-2 py-0.5 rounded text-[10.5px] font-mono font-bold border ${wrCls}" title="${r.wins} profitable / ${r.wins + r.losses} closed sells">${r.winRatePct.toFixed(0)}% (${r.wins}/${r.wins + r.losses})</span>`
            : '<span class="text-slate-400">-</span>'}
        </td>
      </tr>
    `;
  }).join('');

  if (tfoot) {
    const totUCls = totals.unrealizedPnlBase >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500';
    const totRCls = totals.realizedPnlBase >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500';
    const totGCls = totals.totalCashGainBase >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500';
    tfoot.innerHTML = `
      <tr>
        <td class="py-2 px-3 sticky-col-mobile bg-indigo-50 dark:bg-slate-900 font-extrabold text-slate-900 dark:text-white">ALL-TIME</td>
        <td class="py-2 px-3 text-center font-mono">${totals.buys}B / ${totals.sells}S</td>
        <td class="py-2 px-3 text-right num-font text-emerald-600 dark:text-emerald-400">${hideMoney ? '••••' : (totals.buyAmountBase >= 0.005 ? Fin.currency(totals.buyAmountBase, false, baseCurr) : '-')}</td>
        <td class="py-2 px-3 text-right num-font text-rose-500">${hideMoney ? '••••' : (totals.sellAmountBase >= 0.005 ? Fin.currency(totals.sellAmountBase, false, baseCurr) : '-')}</td>
        <td class="py-2 px-3 text-right num-font ${Math.abs(totals.unrealizedPnlBase) >= 0.005 ? totUCls : 'text-slate-400'}" title="Current live Unrealized P&amp;L">${hideMoney ? '••••••' : (Math.abs(totals.unrealizedPnlBase) >= 0.005 ? Fin.currency(totals.unrealizedPnlBase, true, baseCurr) : '-')}</td>
        <td class="py-2 px-3 text-right num-font ${Math.abs(totals.realizedPnlBase) >= 0.005 ? totRCls : 'text-slate-400'}">${hideMoney ? '••••••' : (Math.abs(totals.realizedPnlBase) >= 0.005 ? Fin.currency(totals.realizedPnlBase, true, baseCurr) : '-')}</td>
        <td class="py-2 px-3 text-right num-font text-cyan-600 dark:text-cyan-400">${hideMoney ? '••••••' : (totals.dividendsBase >= 0.005 ? '+' + Fin.currency(totals.dividendsBase, false, baseCurr) : '-')}</td>
        <td class="py-2 px-3 text-right num-font font-extrabold ${Math.abs(totals.totalCashGainBase) >= 0.005 ? totGCls : 'text-slate-400'}">${hideMoney ? '••••••' : (Math.abs(totals.totalCashGainBase) >= 0.005 ? Fin.currency(totals.totalCashGainBase, true, baseCurr) : '-')}</td>
        <td class="py-2 px-3 text-right num-font text-slate-500 dark:text-slate-400">${hideMoney ? '••••' : (totals.feesBase >= 0.005 ? Fin.currency(totals.feesBase, false, baseCurr) : '-')}</td>
        <td class="py-2 px-3 text-center font-mono">${totals.winRatePct !== null ? `${totals.winRatePct.toFixed(0)}% (${totals.wins}/${totals.wins + totals.losses})` : '-'}</td>
      </tr>
    `;
  }
}
window.renderAnnualTradeScorecard = renderAnnualTradeScorecard;

// =========================================================================
// v3.9.0: MONTHLY BUY & SELL ACTIVITY MATRIX (BY TICKER / BY SECTOR)
// =========================================================================
var tradeMatrixGroup = 'ticker';
var tradeMatrixMonths = 12;

window.setTradeMatrixGroup = function(grp) {
  tradeMatrixGroup = (grp === 'sector') ? 'sector' : 'ticker';
  document.querySelectorAll('.matrix-group-btn').forEach(b => {
    const act = b.getAttribute('data-matrix-group') === tradeMatrixGroup;
    b.className = act
      ? 'matrix-group-btn px-2.5 py-1 rounded-md font-semibold bg-white dark:bg-dark-card shadow text-slate-900 dark:text-white transition'
      : 'matrix-group-btn px-2.5 py-1 rounded-md font-semibold text-slate-500 dark:text-slate-400 transition';
  });
  renderMonthlyTradeMatrix();
};

window.setTradeMatrixMonths = function(mos) {
  tradeMatrixMonths = Number(mos) || 12;
  document.querySelectorAll('.matrix-range-btn').forEach(b => {
    const act = Number(b.getAttribute('data-matrix-range')) === tradeMatrixMonths;
    b.className = act
      ? 'matrix-range-btn px-2.5 py-1 rounded-md font-semibold bg-white dark:bg-dark-card shadow text-slate-900 dark:text-white transition'
      : 'matrix-range-btn px-2.5 py-1 rounded-md font-semibold text-slate-500 dark:text-slate-400 transition';
  });
  renderMonthlyTradeMatrix();
};

function renderMonthlyTradeMatrix() {
  const box = document.getElementById('monthly-trade-matrix-box');
  if (!box) return;

  const baseCurr = portfolio?.baseCurrency || state?.settings?.currency || 'HKD';
  const hideMoney = Fin.isPrivacyMode();

  // Build trailing N calendar months in antichronological order (latest month on the left)
  const months = [];
  const now = new Date();
  for (let i = 0; i < tradeMatrixMonths; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  const monthSet = new Set(months);

  const rowMap = {};
  const monthTotals = {};
  months.forEach(m => { monthTotals[m] = { buy: 0, sell: 0, buyCnt: 0, sellCnt: 0 }; });

  const resolveSectorForTicker = (sym) => {
    const h = (portfolio?.allHoldings || []).find(x => x.ticker === sym);
    if (h && typeof getCanonicalHoldingsSector === 'function') return getCanonicalHoldingsSector(h);
    return state?.fundamentals?.[sym]?.sector || MarketAPI.getStaticProfile(sym).sector || 'Equities';
  };

  (state?.transactions || []).forEach(tx => {
    const type = String(tx.type || '').toUpperCase();
    if (type !== 'BUY' && type !== 'SELL') return;
    const ym = String(tx.date || '').slice(0, 7);
    if (!monthSet.has(ym)) return;
    const sym = MarketAPI.normalizeTicker(tx.ticker);
    if (!sym) return;

    const curr = tx.currency || state?.prices?.[sym]?.currency || state?.fundamentals?.[sym]?.currency || MarketAPI.getStaticProfile(sym).currency || baseCurr;
    const shares = Number(tx.shares || 0);
    const price = Number(tx.price || 0);
    const fees = Number(tx.fees || 0);
    const amtNative = type === 'BUY' ? (shares * price + fees) : Math.max(0, shares * price - fees);
    const amtBase = Fin.round(Fin.convertCurrency(amtNative, curr, baseCurr), 2);
    const key = tradeMatrixGroup === 'sector' ? resolveSectorForTicker(sym) : sym;

    if (!rowMap[key]) {
      rowMap[key] = { key, totalBuy: 0, totalSell: 0, totalVol: 0, cells: {} };
    }
    if (!rowMap[key].cells[ym]) {
      rowMap[key].cells[ym] = { buy: 0, sell: 0, buyCnt: 0, sellCnt: 0, buySh: 0, sellSh: 0 };
    }
    const cell = rowMap[key].cells[ym];
    if (type === 'BUY') {
      cell.buy = Fin.round(cell.buy + amtBase, 2);
      cell.buyCnt++;
      cell.buySh = Fin.round(cell.buySh + shares, 4);
      rowMap[key].totalBuy = Fin.round(rowMap[key].totalBuy + amtBase, 2);
      monthTotals[ym].buy = Fin.round(monthTotals[ym].buy + amtBase, 2);
      monthTotals[ym].buyCnt++;
    } else {
      cell.sell = Fin.round(cell.sell + amtBase, 2);
      cell.sellCnt++;
      cell.sellSh = Fin.round(cell.sellSh + shares, 4);
      rowMap[key].totalSell = Fin.round(rowMap[key].totalSell + amtBase, 2);
      monthTotals[ym].sell = Fin.round(monthTotals[ym].sell + amtBase, 2);
      monthTotals[ym].sellCnt++;
    }
    rowMap[key].totalVol = Fin.round(rowMap[key].totalBuy + rowMap[key].totalSell, 2);
  });

  const rows = Object.values(rowMap).sort((a, b) => b.totalVol - a.totalVol);
  if (rows.length === 0) {
    box.innerHTML = `<div class="py-8 px-4 text-center text-xs text-slate-400">No Buy or Sell transactions found in the last ${tradeMatrixMonths / 12} year(s).</div>`;
    return;
  }

  const fmtCompact = (val) => {
    const abs = Math.abs(val);
    if (abs >= 1000000) return `${(abs / 1000000).toFixed(2)}M`;
    if (abs >= 1000) return `${(abs / 1000).toFixed(1)}k`;
    return abs.toFixed(0);
  };

  let htmlStr = `<table class="w-full text-left text-[11px] whitespace-nowrap compact-log-table border-collapse">
    <thead class="sticky top-0 z-10 bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-[10px] uppercase font-semibold border-b border-slate-200 dark:border-dark-border">
      <tr>
        <th class="py-1.5 px-3 sticky left-0 z-20 bg-slate-50 dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700">${tradeMatrixGroup === 'sector' ? 'Sector' : 'Ticker'}</th>`;
  months.forEach(m => {
    htmlStr += `<th class="py-1.5 px-2 text-center font-mono">${m.slice(2)}</th>`;
  });
  htmlStr += `<th class="py-1.5 px-3 text-right font-mono border-l border-slate-200 dark:border-slate-700">Period Total</th></tr></thead><tbody class="divide-y divide-slate-100 dark:divide-slate-800/80">`;

  rows.forEach(r => {
    htmlStr += `<tr class="hover:bg-slate-50/70 dark:hover:bg-slate-800/35">
      <td class="py-1.5 px-3 sticky left-0 z-10 bg-white dark:bg-dark-card font-bold text-slate-900 dark:text-white border-r border-slate-100 dark:border-slate-800">${r.key}</td>`;
    months.forEach(m => {
      const c = r.cells[m];
      if (!c) {
        htmlStr += `<td class="py-1.5 px-2 text-center text-slate-300 dark:text-slate-700">·</td>`;
      } else {
        const parts = [];
        if (c.buy > 0) {
          const lbl = hideMoney ? `${c.buyCnt}B` : `+${fmtCompact(c.buy)}`;
          parts.push(`<div class="px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 font-mono font-bold text-[10px]" title="BUY ${r.key} (${m}): ${hideMoney ? c.buyCnt + ' order(s)' : Fin.currency(c.buy, false, baseCurr) + ' · ' + Fin.shares(c.buySh) + ' sh'}">${lbl}</div>`);
        }
        if (c.sell > 0) {
          const lbl = hideMoney ? `${c.sellCnt}S` : `-${fmtCompact(c.sell)}`;
          parts.push(`<div class="px-1.5 py-0.5 rounded bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30 font-mono font-bold text-[10px]" title="SELL ${r.key} (${m}): ${hideMoney ? c.sellCnt + ' order(s)' : Fin.currency(c.sell, false, baseCurr) + ' · ' + Fin.shares(c.sellSh) + ' sh'}">${lbl}</div>`);
        }
        htmlStr += `<td class="py-1 px-1.5 text-center"><div class="flex flex-col gap-0.5 items-center">${parts.join('')}</div></td>`;
      }
    });
    const totParts = [];
    if (r.totalBuy > 0) totParts.push(`<div class="text-emerald-600 dark:text-emerald-400 font-bold">${hideMoney ? 'BUY' : '+' + Fin.currency(r.totalBuy, false, baseCurr)}</div>`);
    if (r.totalSell > 0) totParts.push(`<div class="text-rose-500 font-bold">${hideMoney ? 'SELL' : '-' + Fin.currency(r.totalSell, false, baseCurr)}</div>`);
    htmlStr += `<td class="py-1.5 px-3 text-right font-mono text-[10.5px] border-l border-slate-100 dark:border-slate-800">${totParts.join('')}</td></tr>`;
  });

  // Footer monthly totals
  let grandBuy = 0, grandSell = 0;
  htmlStr += `</tbody><tfoot class="sticky bottom-0 z-10 bg-indigo-50/95 dark:bg-slate-900/95 border-t-2 border-indigo-500/30 font-mono text-[10px] font-bold">
    <tr><td class="py-2 px-3 sticky left-0 z-20 bg-indigo-50 dark:bg-slate-900 text-slate-900 dark:text-white border-r border-slate-200 dark:border-slate-700">MONTHLY TOTAL</td>`;
  months.forEach(m => {
    const mt = monthTotals[m];
    grandBuy = Fin.round(grandBuy + mt.buy, 2);
    grandSell = Fin.round(grandSell + mt.sell, 2);
    const parts = [];
    if (mt.buy > 0) parts.push(`<div class="text-emerald-600 dark:text-emerald-400">${hideMoney ? mt.buyCnt + 'B' : '+' + fmtCompact(mt.buy)}</div>`);
    if (mt.sell > 0) parts.push(`<div class="text-rose-500">${hideMoney ? mt.sellCnt + 'S' : '-' + fmtCompact(mt.sell)}</div>`);
    htmlStr += `<td class="py-1.5 px-1.5 text-center">${parts.length > 0 ? parts.join('') : '<span class="text-slate-400">-</span>'}</td>`;
  });
  htmlStr += `<td class="py-1.5 px-3 text-right border-l border-slate-200 dark:border-slate-700">
    ${grandBuy > 0 ? `<div class="text-emerald-600 dark:text-emerald-400">${hideMoney ? '••••' : '+' + Fin.currency(grandBuy, false, baseCurr)}</div>` : ''}
    ${grandSell > 0 ? `<div class="text-rose-500">${hideMoney ? '••••' : '-' + Fin.currency(grandSell, false, baseCurr)}</div>` : ''}
  </td></tr></tfoot></table>`;

  box.innerHTML = htmlStr;
}
window.renderMonthlyTradeMatrix = renderMonthlyTradeMatrix;

function updateBackupAgeBadge() {
  const pill = document.getElementById('backup-age-pill');
  const txt = document.getElementById('backup-age-text');
  const icon = document.getElementById('backup-age-icon');
  const settingsBadge = document.getElementById('settings-last-backup-badge');
  const iso = state?.settings?.lastBackupAt || null;

  let label = 'No Backup';
  let fullLabel = 'Last Backup: Never';
  let stale = true;
  if (iso) {
    const dt = new Date(iso);
    if (!isNaN(dt.getTime())) {
      const days = Math.max(0, Math.floor((Date.now() - dt.getTime()) / 86400000));
      stale = days > 14;
      label = days === 0 ? 'Backed up' : `Backup ${days}d`;
      fullLabel = `Last Backup: ${dt.toLocaleDateString()} (${days === 0 ? 'Today' : days + 'd ago'})`;
    }
  }

  if (txt) txt.textContent = label;
  if (icon) icon.className = stale ? 'fa-solid fa-cloud-arrow-up text-amber-500' : 'fa-solid fa-circle-check text-emerald-500';
  if (pill) {
    pill.className = stale
      ? 'hidden sm:inline-flex items-center gap-1.5 h-7 sm:h-9 px-2.5 rounded-lg border border-amber-500/35 bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 text-[11px] font-semibold transition whitespace-nowrap'
      : 'hidden sm:inline-flex items-center gap-1.5 h-7 sm:h-9 px-2.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 text-[11px] font-semibold transition whitespace-nowrap';
  }
  if (settingsBadge) {
    settingsBadge.textContent = fullLabel;
    settingsBadge.className = stale
      ? 'text-xs font-mono font-bold px-3 py-1 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 self-start sm:self-auto whitespace-nowrap'
      : 'text-xs font-mono font-bold px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 self-start sm:self-auto whitespace-nowrap';
  }
}
window.updateBackupAgeBadge = updateBackupAgeBadge;
