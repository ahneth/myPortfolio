/**
 * @file logger.js
 * @module RuntimeLoggerAndDiagnostics
 * @version 2.4.1
 * @build 20261019_1950
 * @description Real-time runtime log & error interceptor, global exception handler,
 *   console wrapper, and 8-point Page & DOM Health Check suite for the Log Tab.
 */

var LOG_STORAGE_KEY = 'MYPORTFOLIO_RUNTIME_LOGS_V1';

var AppLogger = (function() {
  if (window.AppLogger && window.AppLogger._initialized) {
    return window.AppLogger;
  }

  const bootStartPerf = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
  const maxEntries = 500;
  let entries = [];
  let seqId = 1;
  let activeLevelFilter = 'ALL';
  let activeModuleFilter = 'ALL';
  let searchQuery = '';
  let lastHealthReport = null;

  // Load any persisted logs from previous session crash if present
  try {
    const rawSaved = localStorage.getItem(LOG_STORAGE_KEY);
    if (rawSaved) {
      const parsed = JSON.parse(rawSaved);
      if (Array.isArray(parsed)) {
        entries = parsed.slice(-150).map(item => ({
          ...item,
          id: seqId++,
          session: 'prev'
        }));
      }
    }
  } catch (_) {}

  function formatTimestamp(d) {
    const pad = (n, w = 2) => String(n).padStart(w, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}`;
  }

  function elapsedMs() {
    const now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    return Math.max(0, Math.round(now - bootStartPerf));
  }

  function safeSerialize(val) {
    if (val === undefined || val === null) return '';
    if (typeof val === 'string') return val;
    if (val instanceof Error) {
      return `${val.name || 'Error'}: ${val.message || ''}${val.stack ? '\n' + val.stack : ''}`;
    }
    try {
      return JSON.stringify(val, null, 2);
    } catch (_) {
      return String(val);
    }
  }

  function persistLogs() {
    try {
      localStorage.setItem(LOG_STORAGE_KEY, JSON.stringify(entries.slice(-200)));
    } catch (_) {}
  }

  function addEntry(level, moduleName, message, details = null) {
    const now = new Date();
    const entry = {
      id: seqId++,
      timestamp: formatTimestamp(now),
      iso: now.toISOString(),
      elapsed: elapsedMs(),
      level: String(level || 'INFO').toUpperCase(),
      module: String(moduleName || 'App'),
      message: typeof message === 'string' ? message : safeSerialize(message),
      details: details ? safeSerialize(details) : '',
      session: 'current'
    };

    entries.push(entry);
    if (entries.length > maxEntries) {
      entries = entries.slice(-maxEntries);
    }
    persistLogs();
    updateLogBadgesAndUI();
    return entry;
  }

  function getCounts() {
    let total = entries.length;
    let errors = 0;
    let warnings = 0;
    let apiCalls = 0;
    let currentErrors = 0;

    for (let i = 0; i < entries.length; i++) {
      const e = entries[i];
      if (e.level === 'ERROR') {
        errors++;
        if (e.session === 'current') currentErrors++;
      } else if (e.level === 'WARN') {
        warnings++;
      } else if (e.level === 'API') {
        apiCalls++;
      }
    }
    return { total, errors, warnings, apiCalls, currentErrors };
  }

  function updateLogBadgesAndUI() {
    if (typeof document === 'undefined') return;
    const counts = getCounts();

    const navBadge = document.getElementById('nav-log-badge');
    const mobileBadge = document.getElementById('mobile-log-badge');

    [navBadge, mobileBadge].forEach(badge => {
      if (!badge) return;
      if (counts.errors > 0) {
        badge.textContent = `${counts.errors} ERR`;
        badge.className = 'text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-full bg-rose-500 text-white animate-pulse';
      } else if (counts.warnings > 0) {
        badge.textContent = `${counts.warnings} WARN`;
        badge.className = 'text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30';
      } else {
        badge.textContent = String(counts.total);
        badge.className = 'text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30';
      }
    });

    const totalEl = document.getElementById('log-stat-total');
    const errEl = document.getElementById('log-stat-errors');
    const warnEl = document.getElementById('log-stat-warnings');
    const statusEl = document.getElementById('log-stat-status');
    const subStatusEl = document.getElementById('log-stat-substatus');

    if (totalEl) totalEl.textContent = String(counts.total);
    if (errEl) errEl.textContent = String(counts.errors);
    if (warnEl) warnEl.textContent = String(counts.warnings);

    if (statusEl) {
      if (counts.currentErrors > 0) {
        statusEl.textContent = `${counts.currentErrors} Runtime Error(s)`;
        statusEl.className = 'text-lg sm:text-xl font-bold num-font text-rose-600 dark:text-rose-400 mt-1';
      } else {
        statusEl.textContent = 'Healthy (0 Errors)';
        statusEl.className = 'text-lg sm:text-xl font-bold num-font text-emerald-600 dark:text-emerald-400 mt-1';
      }
    }
    if (subStatusEl) {
      subStatusEl.textContent = `Session active • ${counts.apiCalls} API events logged`;
    }

    const logPane = document.getElementById('tab-content-logs');
    if (logPane && !logPane.classList.contains('hidden')) {
      renderLogTable();
    }
  }

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function renderLogTable() {
    const tbody = document.getElementById('log-table-body');
    const emptyState = document.getElementById('log-empty-state');
    if (!tbody) return;

    const q = (searchQuery || '').trim().toLowerCase();
    const filtered = entries.filter(item => {
      if (activeLevelFilter !== 'ALL' && item.level !== activeLevelFilter) return false;
      if (activeModuleFilter !== 'ALL' && item.module.toLowerCase() !== activeModuleFilter.toLowerCase()) return false;
      if (q) {
        const hay = `${item.level} ${item.module} ${item.message} ${item.details}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    }).slice().reverse();

    if (filtered.length === 0) {
      tbody.innerHTML = '';
      if (emptyState) emptyState.classList.remove('hidden');
      return;
    }
    if (emptyState) emptyState.classList.add('hidden');

    const levelBadgeMap = {
      ERROR: '<span class="px-2 py-0.5 rounded font-mono font-bold bg-rose-500/15 text-rose-500 border border-rose-500/30 text-[10px]">ERROR</span>',
      WARN: '<span class="px-2 py-0.5 rounded font-mono font-bold bg-amber-500/15 text-amber-500 border border-amber-500/30 text-[10px]">WARN</span>',
      API: '<span class="px-2 py-0.5 rounded font-mono font-bold bg-indigo-500/15 text-indigo-500 border border-indigo-500/30 text-[10px]">API</span>',
      ACTION: '<span class="px-2 py-0.5 rounded font-mono font-bold bg-cyan-500/15 text-cyan-500 border border-cyan-500/30 text-[10px]">ACTION</span>',
      INFO: '<span class="px-2 py-0.5 rounded font-mono font-bold bg-emerald-500/15 text-emerald-500 border border-emerald-500/30 text-[10px]">INFO</span>'
    };

    tbody.innerHTML = filtered.map(item => {
      const badge = levelBadgeMap[item.level] || levelBadgeMap.INFO;
      const rowBg = item.level === 'ERROR'
        ? 'bg-rose-500/5 hover:bg-rose-500/10'
        : (item.level === 'WARN' ? 'bg-amber-500/5 hover:bg-amber-500/10' : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/40');
      const sessionTag = item.session === 'prev'
        ? '<span class="ml-1 px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-300 text-[9px]">PREV SESSION</span>'
        : `<span class="ml-1 text-[10px] text-slate-400">+${item.elapsed}ms</span>`;
      const detailsHtml = item.details
        ? `<details class="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400">
             <summary class="cursor-pointer font-semibold text-brand-600 dark:text-brand-400 hover:underline select-none">Inspect Details / Stack Trace</summary>
             <pre class="mt-1 p-2.5 rounded-lg bg-slate-900 text-slate-200 font-mono text-[10px] overflow-x-auto whitespace-pre-wrap">${escapeHtml(item.details)}</pre>
           </details>`
        : '';

      return `
        <tr class="${rowBg} transition text-xs align-top">
          <td class="py-2.5 px-3 font-mono text-[11px] text-slate-500 dark:text-slate-400 whitespace-nowrap">
            <div>#${item.id} • ${escapeHtml(item.timestamp.split(' ')[1] || item.timestamp)}</div>
            <div>${sessionTag}</div>
          </td>
          <td class="py-2.5 px-3 whitespace-nowrap">${badge}</td>
          <td class="py-2.5 px-3 whitespace-nowrap">
            <span class="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-mono font-semibold text-slate-700 dark:text-slate-300 text-[11px]">[${escapeHtml(item.module)}]</span>
          </td>
          <td class="py-2.5 px-3 text-slate-800 dark:text-slate-200 font-mono text-[11px] break-words min-w-[280px]">
            <div class="font-medium">${escapeHtml(item.message)}</div>
            ${detailsHtml}
          </td>
        </tr>
      `;
    }).join('');
  }

  function runHealthCheck() {
    addEntry('ACTION', 'HealthCheck', 'Starting 8-point Page & Runtime Diagnostics check...');
    const checks = [];

    // 1. DOM Core Mount Check
    const requiredIds = [
      'tab-content-dashboard', 'tab-content-holdings', 'tab-content-transactions',
      'tab-content-dividends', 'tab-content-watchlist', 'tab-content-settings', 'tab-content-logs',
      'kpi-portfolio-value', 'chart-monthly-history', 'holdings-table-body', 'watchlist-table-body'
    ];
    const missingIds = requiredIds.filter(id => !document.getElementById(id));
    checks.push({
      name: 'DOM Structure & Containers',
      status: missingIds.length === 0 ? 'PASS' : 'FAIL',
      detail: missingIds.length === 0
        ? `All ${requiredIds.length} core layout & tab containers mounted`
        : `Missing DOM IDs: ${missingIds.join(', ')}`
    });

    // 2. External CDN Libraries Check
    const chartLoaded = typeof window.Chart !== 'undefined';
    const xlsxLoaded = typeof window.XLSX !== 'undefined';
    checks.push({
      name: 'CDN Libraries (Chart.js & SheetJS)',
      status: (chartLoaded && xlsxLoaded) ? 'PASS' : 'WARN',
      detail: `Chart.js: ${chartLoaded ? 'Loaded' : 'Unavailable'} • SheetJS (XLSX): ${xlsxLoaded ? 'Loaded' : 'Unavailable'}`
    });

    // 3. Compartmentalized Modules Check
    const modsReady = Boolean(
      typeof APP_VERSION_MANIFEST !== 'undefined' &&
      typeof Fin !== 'undefined' &&
      typeof DeviceDetector !== 'undefined' &&
      typeof MarketAPI !== 'undefined' &&
      typeof recalculatePortfolio === 'function' &&
      typeof renderCharts === 'function' &&
      typeof renderAll === 'function'
    );
    checks.push({
      name: 'Compartmentalized JS Modules (7/7)',
      status: modsReady ? 'PASS' : 'FAIL',
      detail: modsReady
        ? `v${APP_VERSION_MANIFEST.appVersion} (${APP_VERSION_MANIFEST.buildId}) — All 7 modules active`
        : 'One or more core global modules failed to initialize'
    });

    // 4. LocalStorage Read/Write & State Integrity
    let lsOk = false;
    let lsDetail = '';
    try {
      const testKey = '__MYPORTFOLIO_DIAG_TEST__';
      localStorage.setItem(testKey, 'ok');
      lsOk = localStorage.getItem(testKey) === 'ok';
      localStorage.removeItem(testKey);
      const txCount = state?.transactions?.length || 0;
      const wlCount = state?.watchlist?.length || 0;
      lsDetail = `Read/Write OK • ${txCount} tx, ${wlCount} watchlist items in state`;
    } catch (err) {
      lsDetail = `LocalStorage restricted: ${err.message}`;
    }
    checks.push({
      name: 'LocalStorage & State Schema',
      status: lsOk ? 'PASS' : 'WARN',
      detail: lsDetail
    });

    // 5. Portfolio Accounting Engine Check
    const portOk = Boolean(portfolio && typeof portfolio.totalPortfolioValue === 'number' && !isNaN(portfolio.totalPortfolioValue));
    checks.push({
      name: 'Portfolio Accounting Engine',
      status: portOk ? 'PASS' : 'FAIL',
      detail: portOk
        ? `${portfolio.activeHoldings.length} active holdings • Net Worth: ${Fin.currency(portfolio.totalPortfolioValue)} • Cost: ${Fin.currency(portfolio.totalStockCostBasis)}`
        : 'Portfolio calculation returned invalid numeric state'
    });

    // 6. MarketAPI & Historical Price Cache Check
    const histCachedCount = state?.historicalPrices
      ? Object.keys(state.historicalPrices).filter(k => Array.isArray(state.historicalPrices[k]) && state.historicalPrices[k].length > 0).length
      : 0;
    const jsonStatus = window.__HISTORICAL_PRICES_JSON_LOADED__
      ? 'historical_prices.json loaded'
      : 'no preloaded history (charts stay empty until real data is loaded)';
    checks.push({
      name: 'MarketAPI & Historical Price Cache',
      status: MarketAPI.hasKey() ? 'PASS' : 'WARN',
      detail: `Provider: ${MarketAPI.getProvider().toUpperCase()} • ${histCachedCount} real historical series • ${jsonStatus}`
    });

    // 7. Chart.js Canvas Rendering Check
    const allocCanvas = document.getElementById('chart-allocation');
    const histCanvas = document.getElementById('chart-monthly-history');
    const chartsOk = Boolean(allocCanvas && histCanvas);
    checks.push({
      name: 'Chart Canvases & Contexts',
      status: chartsOk ? 'PASS' : 'FAIL',
      detail: chartsOk
        ? `Dashboard canvases ready (Portfolio HistoryMode: ${typeof portfolioHistoryMode !== 'undefined' ? portfolioHistoryMode : 'balance'})`
        : 'Missing chart canvas elements'
    });

    // 8. Device Detector Profile
    const dp = DeviceDetector?.profile || {};
    checks.push({
      name: 'Adaptive Device Profile',
      status: dp.effectiveMode ? 'PASS' : 'WARN',
      detail: `${(dp.effectiveMode || 'desktop').toUpperCase()} layout • ${dp.os || 'OS'} • ${dp.width || 0}×${dp.height || 0}px`
    });

    lastHealthReport = checks;
    const failCount = checks.filter(c => c.status === 'FAIL').length;
    const warnCount = checks.filter(c => c.status === 'WARN').length;

    if (failCount > 0) {
      addEntry('ERROR', 'HealthCheck', `Health check completed with ${failCount} failure(s) and ${warnCount} warning(s).`, checks);
    } else {
      addEntry('INFO', 'HealthCheck', `All ${checks.length} diagnostic checks passed (${warnCount} warnings).`, checks);
    }

    renderHealthCheckPanel();
    renderLogTable();
    return checks;
  }

  function renderHealthCheckPanel() {
    const box = document.getElementById('log-health-check-panel');
    if (!box || !lastHealthReport) return;

    box.innerHTML = lastHealthReport.map(item => {
      const badge = item.status === 'PASS'
        ? '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-500 border border-emerald-500/30">PASS</span>'
        : (item.status === 'WARN'
            ? '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-500 border border-amber-500/30">WARN</span>'
            : '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/15 text-rose-500 border border-rose-500/30">FAIL</span>');
      return `
        <div class="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 flex items-start justify-between gap-2">
          <div>
            <div class="text-xs font-bold text-slate-900 dark:text-white">${escapeHtml(item.name)}</div>
            <div class="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">${escapeHtml(item.detail)}</div>
          </div>
          <div class="shrink-0">${badge}</div>
        </div>
      `;
    }).join('');
  }

  // Hook global window error & unhandledrejection
  if (typeof window !== 'undefined' && window.addEventListener) {
    window.addEventListener('error', function(event) {
      // Check if it's a resource load failure (e.g. external script/stylesheet/img)
      if (event && event.target && event.target !== window && (event.target.tagName === 'SCRIPT' || event.target.tagName === 'LINK' || event.target.tagName === 'IMG')) {
        const url = event.target.src || event.target.href || 'unknown resource';
        addEntry('ERROR', 'ResourceLoader', `Failed to load external <${event.target.tagName.toLowerCase()}> resource: ${url}`, {
          tag: event.target.tagName,
          url
        });
        return;
      }
      const msg = event?.message || 'Uncaught runtime script error';
      const loc = event?.filename ? `${event.filename}:${event.lineno || 0}:${event.colno || 0}` : 'inline-script';
      const stack = event?.error?.stack || `${msg} at ${loc}`;
      addEntry('ERROR', 'GlobalError', `${msg} (${loc})`, stack);
    }, true);

    window.addEventListener('unhandledrejection', function(event) {
      const reason = event?.reason;
      const msg = reason?.message || String(reason || 'Unhandled Promise Rejection');
      addEntry('ERROR', 'PromiseRejection', `Unhandled Promise Rejection: ${msg}`, reason?.stack || reason);
    });
  }

  // Intercept console.warn and console.error so library/runtime warnings appear in Log tab
  if (typeof console !== 'undefined') {
    const origWarn = console.warn ? console.warn.bind(console) : () => {};
    const origError = console.error ? console.error.bind(console) : () => {};

    console.warn = function(...args) {
      origWarn(...args);
      const msg = args.map(a => (typeof a === 'string' ? a : safeSerialize(a))).join(' ');
      addEntry('WARN', 'Console', msg);
    };

    console.error = function(...args) {
      origError(...args);
      const msg = args.map(a => (typeof a === 'string' ? a : safeSerialize(a))).join(' ');
      addEntry('ERROR', 'Console', msg);
    };
  }

  const api = {
    _initialized: true,
    info: (mod, msg, details) => addEntry('INFO', mod, msg, details),
    warn: (mod, msg, details) => addEntry('WARN', mod, msg, details),
    error: (mod, msg, details) => addEntry('ERROR', mod, msg, details),
    api: (mod, msg, details) => addEntry('API', mod, msg, details),
    action: (mod, msg, details) => addEntry('ACTION', mod, msg, details),
    getLogs: () => [...entries],
    getCounts,
    setLevelFilter: (lvl) => { activeLevelFilter = lvl || 'ALL'; renderLogTable(); },
    setModuleFilter: (mod) => { activeModuleFilter = mod || 'ALL'; renderLogTable(); },
    setSearchQuery: (q) => { searchQuery = q || ''; renderLogTable(); },
    clear: () => {
      entries = [];
      try { localStorage.removeItem(LOG_STORAGE_KEY); } catch (_) {}
      addEntry('INFO', 'Logger', 'Runtime log buffer cleared by user.');
      renderLogTable();
    },
    exportText: () => {
      return entries.map(e => `[${e.timestamp}] [+${e.elapsed}ms] [${e.level}] [${e.module}] ${e.message}${e.details ? '\n  Details: ' + e.details : ''}`).join('\n');
    },
    renderLogTable,
    renderHealthCheckPanel,
    updateLogBadgesAndUI,
    runHealthCheck
  };

  addEntry('INFO', 'Boot', 'Runtime Logger & Global Error Interceptor initialized (v2.4.1 • Build 20261019_1950).');
  return api;
})();

window.AppLogger = AppLogger;
