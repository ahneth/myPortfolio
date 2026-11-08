
// A5: Custom Chart.js HUD Vertical Crosshair Plugin
var hudCrosshairPlugin = {
  id: 'hudCrosshair',
  afterDraw: (chart) => {
    if (chart.tooltip?._active && chart.tooltip._active.length) {
      const activePoint = chart.tooltip._active[0];
      const ctx = chart.ctx;
      const x = activePoint.element.x;
      const topY = chart.chartArea.top;
      const bottomY = chart.chartArea.bottom;

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(x, topY);
      ctx.lineTo(x, bottomY);
      ctx.lineWidth = 1;
      const isDark = document.documentElement.classList.contains('dark');
      ctx.strokeStyle = isDark ? 'rgba(255, 255, 255, 0.22)' : 'rgba(15, 23, 42, 0.18)';
      ctx.setLineDash([3, 3]);
      ctx.stroke();
      ctx.restore();
    }
  }
};
if (typeof Chart !== 'undefined' && !Chart.registry?.plugins?.get('hudCrosshair')) {
  Chart.register(hudCrosshairPlugin);
}

/**
 * @file charts.js
 * @module PortfolioChartsModule
 * @version 3.1.0
 * @build 20261031_1650
 * @description Chart.js controllers for:
 *   1. Dashboard "Portfolio Historical Balance & Return" (FX-normalized to Base Currency)
 *   2. Holdings & Watchlist Inline Stock Charts with SMA Overlays & 12M Log-Linear Regression Trend Channel
 *   3. Asset Allocation (FX-normalized), Monthly Dividends & P&L Breakdown charts
 */

function renderCharts() {
  if (typeof Chart === 'undefined') {
    if (typeof AppLogger !== 'undefined') {
      AppLogger.warn('Charts', 'Chart.js library is not yet available; skipping chart rendering.');
    }
    return;
  }
  const dashPane = document.getElementById('tab-content-dashboard');
  const isDashVisible = !dashPane || !dashPane.classList.contains('hidden');
  if (isDashVisible) {
    try { renderMonthlyHistoryChart(); } catch (err) { if (typeof AppLogger !== 'undefined') AppLogger.error('Charts', `renderMonthlyHistoryChart failed: ${err.message}`, err); }
    try { renderAllocationChart(); } catch (err) { if (typeof AppLogger !== 'undefined') AppLogger.error('Charts', `renderAllocationChart failed: ${err.message}`, err); }
    try { renderDividendsChart(); } catch (err) { if (typeof AppLogger !== 'undefined') AppLogger.error('Charts', `renderDividendsChart failed: ${err.message}`, err); }
    try { renderPnlBreakdownChart(); } catch (err) { if (typeof AppLogger !== 'undefined') AppLogger.error('Charts', `renderPnlBreakdownChart failed: ${err.message}`, err); }
  } else if (typeof window.markTabDirty === 'function') {
    window.markTabDirty('dashboard');
  }
  try {
    const holdingsPane = document.getElementById('tab-content-holdings');
    if (holdingsPane && !holdingsPane.classList.contains('hidden')) {
      renderInlineStockChart('holdings');
    }
  } catch (err) { if (typeof AppLogger !== 'undefined') AppLogger.error('Charts', `renderInlineStockChart(holdings) failed: ${err.message}`, err); }
  try {
    const watchlistPane = document.getElementById('tab-content-watchlist');
    if (watchlistPane && !watchlistPane.classList.contains('hidden')) {
      renderInlineStockChart('watchlist');
    }
  } catch (err) { if (typeof AppLogger !== 'undefined') AppLogger.error('Charts', `renderInlineStockChart(watchlist) failed: ${err.message}`, err); }
}

function computeMonthlyPortfolioSeries(rangeMonths) {
  const baseCurr = portfolio?.baseCurrency || state?.settings?.currency || 'HKD';
  const heldTickers = portfolio.activeHoldings.map(h => h.ticker);
  const allTxTickers = Array.from(new Set(
    state.transactions.filter(t => t.ticker).map(t => t.ticker)
  ));
  const relevantTickers = Array.from(new Set([...heldTickers, ...allTxTickers]));

  if (relevantTickers.length === 0 && state.transactions.length === 0) {
    return null;
  }

  const monthSet = new Set();
  let hasRealHistoricalSeries = false;
  relevantTickers.forEach(t => {
    const series = state.historicalPrices[t];
    if (Array.isArray(series) && series.length > 0) {
      hasRealHistoricalSeries = true;
      series.forEach(r => {
        if (r && r.month) monthSet.add(r.month);
      });
    }
  });

  if (!hasRealHistoricalSeries || monthSet.size === 0) {
    return null;
  }

  let allMonths = Array.from(monthSet).sort();
  if (allMonths.length === 0) return null;

  const txMonths = state.transactions
    .filter(tx => tx.date)
    .map(tx => tx.date.slice(0, 7))
    .sort();
  const earliestTxMonth = txMonths.length > 0 ? txMonths[0] : null;

  const slicedMonths = allMonths.slice(-rangeMonths);

  const labels = [];
  const balanceSeries = [];
  const holdingsValueSeries = [];
  const costBasisSeries = [];
  const accumReturnDollarSeries = [];
  const accumReturnPctSeries = [];

  const sortedTx = [...state.transactions].sort((a, b) => new Date(a.date) - new Date(b.date));
  const sortedDiv = [...state.dividends].sort((a, b) => new Date(a.payDate) - new Date(b.payDate));

  // Pre-index monthly historical prices per ticker for O(1) lookup and monotonic cursor advancement
  const histByTicker = {};
  const histCursor = {};
  relevantTickers.forEach(t => {
    const arr = Array.isArray(state.historicalPrices[t]) ? state.historicalPrices[t] : [];
    const byMonth = new Map();
    arr.forEach(bar => {
      if (bar && bar.month) byMonth.set(bar.month, bar);
    });
    histByTicker[t] = { arr, byMonth };
    histCursor[t] = 0;
  });

  const resolveBarForMonth = (ticker, monthStr) => {
    const entry = histByTicker[ticker];
    if (!entry || entry.arr.length === 0) return null;
    if (entry.byMonth.has(monthStr)) return entry.byMonth.get(monthStr);
    const arr = entry.arr;
    let idx = histCursor[ticker] || 0;
    while (idx + 1 < arr.length && arr[idx + 1].month <= monthStr) {
      idx++;
    }
    while (idx > 0 && arr[idx].month > monthStr) {
      idx--;
    }
    histCursor[ticker] = idx;
    return arr[idx].month <= monthStr ? arr[idx] : arr[0];
  };

  // Single-pass incremental state across slicedMonths: O(M + T + D)
  let txPtr = 0;
  let divPtr = 0;
  let runningCash = Fin.round(state.initialCash || 0, 2);
  let runningRealized = 0;
  let runningDividends = 0;
  let runningDividendsNoTx = 0;
  let divNoTxPtr = 0;
  const posMap = {};

  slicedMonths.forEach(monthStr => {
    const hasTxUpToMonth = Boolean(earliestTxMonth && monthStr >= earliestTxMonth);

    let monthMarketVal = 0;
    let monthCostBasis = 0;
    let monthCash = 0;
    let cumRealized = 0;
    let cumDividends = 0;

    if (hasTxUpToMonth) {
      while (txPtr < sortedTx.length && (sortedTx[txPtr].date || '').slice(0, 7) <= monthStr) {
        const tx = sortedTx[txPtr++];
        const fees = Fin.round(tx.fees || 0, 2);
        const shares = Fin.round(tx.shares || 0, 4);
        const price = Fin.round(tx.price || 0, 4);
        const tCurr = state.prices[tx.ticker]?.currency || state.fundamentals[tx.ticker]?.currency || MarketAPI.getStaticProfile(tx.ticker).currency || baseCurr;

        if (tx.type === 'DEPOSIT') {
          runningCash = Fin.round(runningCash + (tx.amount || 0), 2);
        } else if (tx.type === 'WITHDRAW') {
          runningCash = Fin.round(runningCash - (tx.amount || 0), 2);
        } else if (tx.type === 'BUY') {
          const outlayNative = Fin.round(shares * price + fees, 2);
          const outlayBase = Fin.convertCurrency(outlayNative, tCurr, baseCurr);
          runningCash = Fin.round(runningCash - outlayBase, 2);
          if (!posMap[tx.ticker]) posMap[tx.ticker] = { shares: 0, costNative: 0, avgNative: 0, currency: tCurr };
          posMap[tx.ticker].shares = Fin.round(posMap[tx.ticker].shares + shares, 4);
          posMap[tx.ticker].costNative = Fin.round(posMap[tx.ticker].costNative + outlayNative, 2);
          posMap[tx.ticker].avgNative = posMap[tx.ticker].shares > 0 ? posMap[tx.ticker].costNative / posMap[tx.ticker].shares : 0;
        } else if (tx.type === 'DRIP') {
          const dripVal = Fin.round(shares * price, 2);
          if (!posMap[tx.ticker]) posMap[tx.ticker] = { shares: 0, costNative: 0, avgNative: 0, currency: tCurr };
          posMap[tx.ticker].shares = Fin.round(posMap[tx.ticker].shares + shares, 4);
          posMap[tx.ticker].costNative = Fin.round(posMap[tx.ticker].costNative + dripVal, 2);
          posMap[tx.ticker].avgNative = posMap[tx.ticker].shares > 0 ? posMap[tx.ticker].costNative / posMap[tx.ticker].shares : 0;
        } else if (tx.type === 'SELL') {
          const netProceedsNative = Fin.round(shares * price - fees, 2);
          const netProceedsBase = Fin.convertCurrency(netProceedsNative, tCurr, baseCurr);
          runningCash = Fin.round(runningCash + netProceedsBase, 2);
          if (!posMap[tx.ticker]) posMap[tx.ticker] = { shares: 0, costNative: 0, avgNative: 0, currency: tCurr };
          const soldCostNative = Fin.round(shares * posMap[tx.ticker].avgNative, 2);
          runningRealized = Fin.round(runningRealized + Fin.convertCurrency(netProceedsNative - soldCostNative, tCurr, baseCurr), 2);
          posMap[tx.ticker].shares = Fin.round(posMap[tx.ticker].shares - shares, 4);
          posMap[tx.ticker].costNative = Fin.round(posMap[tx.ticker].costNative - soldCostNative, 2);
          if (posMap[tx.ticker].shares <= 0.0001) {
            posMap[tx.ticker] = { shares: 0, costNative: 0, avgNative: 0, currency: tCurr };
          } else {
            posMap[tx.ticker].avgNative = posMap[tx.ticker].costNative / posMap[tx.ticker].shares;
          }
        }
      }

      while (divPtr < sortedDiv.length && (sortedDiv[divPtr].payDate || '').slice(0, 7) <= monthStr) {
        const d = sortedDiv[divPtr++];
        const dCurr = d.currency || state.prices[d.ticker]?.currency || MarketAPI.getStaticProfile(d.ticker).currency || baseCurr;
        const amtBase = Fin.convertCurrency(d.totalAmount || 0, dCurr, baseCurr);
        runningDividends = Fin.round(runningDividends + amtBase, 2);
        if (!d.isDrip) {
          runningCash = Fin.round(runningCash + amtBase, 2);
        }
      }

      monthCash = runningCash;
      cumRealized = runningRealized;
      cumDividends = runningDividends;

      Object.keys(posMap).forEach(ticker => {
        const p = posMap[ticker];
        if (p.shares > 0.0001) {
          let closePrice = state.prices[ticker]?.price || p.avgNative;
          const refBar = resolveBarForMonth(ticker, monthStr);
          if (refBar) {
            closePrice = Number(refBar.rawClose ?? refBar.close);
          }
          monthMarketVal += Fin.convertCurrency(p.shares * closePrice, p.currency, baseCurr);
          monthCostBasis += Fin.convertCurrency(p.costNative, p.currency, baseCurr);
        }
      });
    } else {
      monthCash = Math.max(0, portfolio.cashBalance);
      portfolio.activeHoldings.forEach(h => {
        let closePrice = h.currentPrice;
        const refBar = resolveBarForMonth(h.ticker, monthStr);
        if (refBar) {
          closePrice = refBar.close;
        }
        monthMarketVal += Fin.convertCurrency(h.shares * closePrice, h.currency, baseCurr);
        monthCostBasis += h.costBasisBase;
      });
      while (divNoTxPtr < sortedDiv.length && (sortedDiv[divNoTxPtr].payDate || '').slice(0, 7) <= monthStr) {
        const d = sortedDiv[divNoTxPtr++];
        const dCurr = d.currency || state.prices[d.ticker]?.currency || MarketAPI.getStaticProfile(d.ticker).currency || baseCurr;
        runningDividendsNoTx = Fin.round(runningDividendsNoTx + Fin.convertCurrency(d.totalAmount || 0, dCurr, baseCurr), 2);
      }
      cumDividends = runningDividendsNoTx;
      cumRealized = portfolio.totalRealizedPnL || 0;
    }

    const totalBalance = Fin.round(monthMarketVal + Math.max(0, monthCash), 2);
    const unrealized = Fin.round(monthMarketVal - monthCostBasis, 2);
    const accumReturnDollar = Fin.round(unrealized + cumRealized + cumDividends, 2);
    const accumReturnPct = monthCostBasis > 0 ? Fin.round((accumReturnDollar / monthCostBasis) * 100, 2) : 0;

    labels.push(monthStr);
    balanceSeries.push(totalBalance);
    holdingsValueSeries.push(Fin.round(monthMarketVal, 2));
    costBasisSeries.push(Fin.round(monthCostBasis + Math.max(0, monthCash), 2));
    accumReturnDollarSeries.push(accumReturnDollar);
    accumReturnPctSeries.push(accumReturnPct);
  });

  return {
    labels,
    balanceSeries,
    holdingsValueSeries,
    costBasisSeries,
    accumReturnDollarSeries,
    accumReturnPctSeries
  };
}

function renderMonthlyHistoryChart() {
  const ctx = document.getElementById('chart-monthly-history');
  const emptyOverlay = document.getElementById('chart-history-empty');
  const emptyText = document.getElementById('chart-history-empty-text');
  const subtitle = document.getElementById('historical-chart-subtitle');
  const metricSummaryBadge = document.getElementById('portfolio-history-metric-badge');
  const baseCurr = portfolio?.baseCurrency || state?.settings?.currency || 'HKD';

  if (!ctx) return;
  if (charts.monthlyHistory) charts.monthlyHistory.destroy();

  const isDark = document.documentElement.classList.contains('dark');
  const isMobile = DeviceDetector.profile.effectiveMode === 'mobile';

  const seriesData = computeMonthlyPortfolioSeries(historyRangeMonths);
  if (!seriesData || seriesData.labels.length === 0 || (portfolio.activeHoldings.length === 0 && state.transactions.length === 0)) {
    if (emptyOverlay) emptyOverlay.classList.remove('hidden');
    if (emptyText) {
      if (portfolio.activeHoldings.length > 0 || state.transactions.length > 0) {
        emptyText.textContent = 'No historical monthly price data available yet. Click "Sync" to run the GitHub Python workflow and load historical_prices.json.';
      } else {
        emptyText.textContent = 'Record a stock trade and click "Sync" to load historical_prices.json and view your monthly portfolio balance and return.';
      }
    }
    if (metricSummaryBadge) metricSummaryBadge.textContent = 'No Historical Data';
    return;
  }

  if (emptyOverlay) emptyOverlay.classList.add('hidden');

  const {
    labels,
    balanceSeries,
    costBasisSeries,
    accumReturnDollarSeries,
    accumReturnPctSeries
  } = seriesData;

  const latestBalance = balanceSeries[balanceSeries.length - 1] || 0;
  const latestReturnDollar = accumReturnDollarSeries[accumReturnDollarSeries.length - 1] || 0;
  const latestReturnPct = accumReturnPctSeries[accumReturnPctSeries.length - 1] || 0;
  const hideMoney = Fin.isPrivacyMode();

  if (hideMoney) {
    if (subtitle) {
      subtitle.textContent = `Monthly Accumulative Total Return (%) including Unrealized Gains, Realized P&L & Dividends (${labels.length} months • Monetary Values Hidden)`;
    }
    if (metricSummaryBadge) {
      const signColor = latestReturnPct >= 0
        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
        : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30';
      metricSummaryBadge.className = `text-xs font-mono font-bold px-2.5 py-1 rounded-lg border ${signColor}`;
      metricSummaryBadge.textContent = `Total Return: ${Fin.percent(latestReturnPct, true)}`;
    }

    const isPositiveEnd = latestReturnPct >= 0;
    const lineColor = isPositiveEnd ? '#10b981' : '#f43f5e';
    const fillColor = isPositiveEnd ? 'rgba(16, 185, 129, 0.14)' : 'rgba(244, 63, 94, 0.14)';

    charts.monthlyHistory = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Accumulative Return (%)',
            data: accumReturnPctSeries,
            borderColor: lineColor,
            backgroundColor: fillColor,
            fill: true,
            tension: 0.32,
            pointRadius: isMobile ? 2 : 3.5,
            pointBackgroundColor: lineColor
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
            position: 'left',
            grid: { color: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)' },
            ticks: {
              color: isDark ? '#94a3b8' : '#64748b',
              font: { size: isMobile ? 9 : 10 },
              callback: (v) => (v >= 0 ? '+' : '') + Number(v).toFixed(1) + '%'
            }
          }
        },
        plugins: {
          legend: {
            labels: { color: isDark ? '#cbd5e1' : '#334155', font: { size: 11 } }
          },
          tooltip: {
            callbacks: {
              label: (c) => ` ${c.dataset.label}: ${Fin.percent(c.raw, true)}`
            }
          }
        }
      }
    });
    return;
  }

  if (portfolioHistoryMode === 'return') {
    if (subtitle) {
      subtitle.textContent = `Monthly Accumulative Total Return (${baseCurr} & %) including Unrealized Gains, Realized P&L & Dividends (${labels.length} months)`;
    }
    if (metricSummaryBadge) {
      const signColor = latestReturnDollar >= 0
        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
        : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30';
      metricSummaryBadge.className = `text-xs font-mono font-bold px-2.5 py-1 rounded-lg border ${signColor}`;
      metricSummaryBadge.textContent = `Total Return: ${Fin.currency(latestReturnDollar, true, baseCurr)} (${Fin.percent(latestReturnPct, true)})`;
    }

    const isPositiveEnd = latestReturnDollar >= 0;
    const lineColor = isPositiveEnd ? '#10b981' : '#f43f5e';
    const fillColor = isPositiveEnd ? 'rgba(16, 185, 129, 0.14)' : 'rgba(244, 63, 94, 0.14)';

    charts.monthlyHistory = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: `Accumulative Total Return (${baseCurr})`,
            data: accumReturnDollarSeries,
            borderColor: lineColor,
            backgroundColor: fillColor,
            fill: true,
            tension: 0.32,
            pointRadius: isMobile ? 2 : 3.5,
            pointBackgroundColor: lineColor,
            yAxisID: 'y'
          },
          {
            label: 'Accumulative Return (%)',
            data: accumReturnPctSeries,
            borderColor: '#6366f1',
            borderDash: [4, 4],
            fill: false,
            tension: 0.32,
            pointRadius: 0,
            yAxisID: 'y1'
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
            position: 'left',
            grid: { color: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)' },
            ticks: {
              color: isDark ? '#94a3b8' : '#64748b',
              font: { size: isMobile ? 9 : 10 },
              callback: (v) => Fin.currency(v, true, baseCurr)
            }
          },
          y1: {
            position: 'right',
            grid: { drawOnChartArea: false },
            ticks: {
              color: '#6366f1',
              font: { size: isMobile ? 9 : 10 },
              callback: (v) => (v >= 0 ? '+' : '') + v.toFixed(1) + '%'
            }
          }
        },
        plugins: {
          legend: {
            labels: { color: isDark ? '#cbd5e1' : '#334155', font: { size: 11 } }
          },
          tooltip: {
            callbacks: {
              label: (c) => {
                if (c.dataset.yAxisID === 'y1') {
                  return ` ${c.dataset.label}: ${Fin.percent(c.raw, true)}`;
                }
                return ` ${c.dataset.label}: ${Fin.currency(c.raw, true, baseCurr)}`;
              }
            }
          }
        }
      }
    });
    return;
  }

  if (subtitle) {
    subtitle.textContent = `Monthly Portfolio Balance vs. Invested Capital (${baseCurr}) across ${labels.length} months`;
  }
  if (metricSummaryBadge) {
    metricSummaryBadge.className = 'text-xs font-mono font-bold px-2.5 py-1 rounded-lg border bg-brand-500/10 text-brand-600 dark:text-brand-400 border-brand-500/30';
    metricSummaryBadge.textContent = `Balance: ${Fin.currency(latestBalance, false, baseCurr)}`;
  }

  charts.monthlyHistory = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: `Monthly Portfolio Balance (${baseCurr})`,
          data: balanceSeries,
          borderColor: '#10b981',
          backgroundColor: 'rgba(16, 185, 129, 0.14)',
          fill: true,
          tension: 0.32,
          pointRadius: isMobile ? 2 : 3.5,
          pointBackgroundColor: '#10b981'
        },
        {
          label: `Invested Capital & Cash Basis (${baseCurr})`,
          data: costBasisSeries,
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
            callback: (v) => Fin.currency(v, false, baseCurr)
          }
        }
      },
      plugins: {
        legend: {
          labels: { color: isDark ? '#cbd5e1' : '#334155', font: { size: 11 } }
        },
        tooltip: {
          callbacks: {
            label: (c) => ` ${c.dataset.label}: ${Fin.currency(c.raw, false, baseCurr)}`
          }
        }
      }
    }
  });
}

/**
 * Renders the inline historical monthly price chart below Holdings or Watchlist
 * with optional SMA and 12M Log-Linear Regression Trend Channel overlays.
 */
function renderInlineStockChart(tabType) {
  const isHoldings = tabType === 'holdings';
  const ticker = isHoldings ? selectedHoldingsTicker : selectedWatchlistTicker;
  const rangeMonths = isHoldings ? holdingsStockRangeMonths : watchlistStockRangeMonths;

  const cardEl = document.getElementById(isHoldings ? 'holdings-stock-chart-card' : 'watchlist-stock-chart-card');
  const canvasEl = document.getElementById(isHoldings ? 'chart-holdings-stock-history' : 'chart-watchlist-stock-history');
  const titleEl = document.getElementById(isHoldings ? 'holdings-chart-stock-title' : 'watchlist-chart-stock-title');
  const subEl = document.getElementById(isHoldings ? 'holdings-chart-stock-subtitle' : 'watchlist-chart-stock-subtitle');
  const statsEl = document.getElementById(isHoldings ? 'holdings-chart-period-stats' : 'watchlist-chart-period-stats');
  const emptyEl = document.getElementById(isHoldings ? 'holdings-chart-empty' : 'watchlist-chart-empty');
  const legendId = isHoldings ? 'holdings-chart-legend' : 'watchlist-chart-legend';
  let legendEl = document.getElementById(legendId);
  if (!legendEl && cardEl) {
    legendEl = document.createElement('div');
    legendEl.id = legendId;
    legendEl.className = 'mt-3 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs';
    cardEl.appendChild(legendEl);
  }

  if (!cardEl || !canvasEl) return;

  const chartKey = isHoldings ? 'holdingsStockHistory' : 'watchlistStockHistory';
  if (charts[chartKey]) {
    charts[chartKey].destroy();
    charts[chartKey] = null;
  }

  if (!ticker) {
    cardEl.classList.add('hidden');
    if (legendEl) legendEl.innerHTML = '';
    return;
  }

  cardEl.classList.remove('hidden');
  const showSma = state?.settings?.chartShowSma !== false;
  const showReg = state?.settings?.chartShowRegChannel !== false;
  document.querySelectorAll('.btn-toggle-chart-sma').forEach(btn => {
    btn.className = `btn-toggle-chart-sma px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition ${
      showSma
        ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/40'
        : 'bg-slate-100 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700'
    }`;
  });
  document.querySelectorAll('.btn-toggle-chart-reg').forEach(btn => {
    btn.className = `btn-toggle-chart-reg px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition ${
      showReg
        ? 'bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/40'
        : 'bg-slate-100 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700'
    }`;
  });

  const series = state.historicalPrices[ticker] || [];
  const fund = state.fundamentals[ticker] || {};
  const priceObj = state.prices[ticker] || {};
  const currency = priceObj.currency || fund.currency || (ticker.endsWith('.HK') ? 'HKD' : (ticker.endsWith('.L') ? 'GBp' : 'USD'));
  const companyName = fund.name || ticker;
  const holdingForCalc = (portfolio?.allHoldings || portfolio?.activeHoldings || []).find(h => h.ticker === ticker);
  const pm = typeof computeStockPriceMetrics === 'function'
    ? computeStockPriceMetrics(ticker, priceObj.price || 0, null, (holdingForCalc && holdingForCalc.isActive !== false && holdingForCalc.avgCost > 0) ? holdingForCalc.avgCost : null)
    : null;

  const sigColorCls = (typeof getSignalBadgeColorClasses === 'function')
    ? getSignalBadgeColorClasses(pm?.signalLabel)
    : (() => {
        const lbl = String(pm?.signalLabel || 'HOLD').toUpperCase();
        if (lbl === 'STRONG BUY') return 'bg-emerald-500 text-white border-emerald-400 shadow-sm shadow-emerald-500/30';
        if (lbl === 'ACCUMULATE') return 'bg-teal-500/15 text-teal-600 dark:text-teal-400 border-teal-500/30';
        if (lbl.includes('TRIM')) return 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30';
        if (lbl.includes('SELL')) return 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30';
        return 'bg-slate-500/15 text-slate-600 dark:text-slate-300 border-slate-500/30';
      })();

  const sigPill = pm
    ? `<button type="button" onclick="openSignalDetailModal('${ticker}')" class="px-2.5 py-1 rounded-lg text-xs font-mono font-bold border transition hover:scale-105 ${sigColorCls}" title="Click for full 4-Pillar Technical & Qualitative Signal Breakdown">${pm.signalLabel} (${pm.signalScore}/100)</button>`
    : '';

  if (titleEl) {
    titleEl.innerHTML = `<span class="font-mono text-brand-600 dark:text-brand-400">${ticker}</span> <span class="text-slate-400 font-normal">&mdash;</span> <span>${companyName}</span>`;
  }

  if (series.length === 0) {
    if (emptyEl) {
      emptyEl.classList.remove('hidden');
      emptyEl.innerHTML = `
        <i class="fa-solid fa-chart-line text-3xl mb-2 opacity-35"></i>
        <span class="font-medium text-slate-500 dark:text-slate-300">No historical monthly price data available for ${ticker}</span>
        <span class="text-xs text-slate-400 mt-1">Click "Sync Market Data" at the top (with GitHub Token in Settings) or run <code>update_historical_prices.py --tickers ${ticker}</code> to populate <code>historical_prices.json</code>.</span>
      `;
    }
    if (subEl) subEl.textContent = `Regime: ${pm?.regime || 'Awaiting History'} • RSI(14): ${pm?.rsi14 ?? '-'} • Next Ex-Date: ${pm?.divInfo?.nextExDate || '-'}`;
    if (statsEl) statsEl.innerHTML = sigPill;
    if (legendEl) legendEl.innerHTML = '';
    return;
  }
  if (emptyEl) emptyEl.classList.add('hidden');

  const sliced = series.slice(-rangeMonths);
  const labels = sliced.map(r => r.month);
  // Always use unadjusted rawClose so Monthly Close is on the exact same price scale as Monthly High, Monthly Low, and Avg Cost
  const closeData = sliced.map(r => {
    const rc = Number(r.rawClose);
    const c = Number(r.close);
    return (Number.isFinite(rc) && rc > 0) ? rc : c;
  });
  const highData = sliced.map((r, i) => {
    const c = closeData[i];
    const h = Number(r.high);
    return (Number.isFinite(h) && h > 0) ? Math.max(h, c) : c;
  });
  const lowData = sliced.map((r, i) => {
    const c = closeData[i];
    const l = Number(r.low);
    return (Number.isFinite(l) && l > 0) ? Math.min(l, c) : c;
  });

  const firstClose = closeData[0] || 0;
  const lastClose = closeData[closeData.length - 1] || 0;
  const periodChange = Fin.round(lastClose - firstClose, 2);
  const periodChangePct = firstClose > 0 ? Fin.round(((lastClose - firstClose) / firstClose) * 100, 2) : 0;
  const periodHigh = Math.max(...highData, ...closeData);
  const periodLow = Math.min(...lowData, ...closeData);

  const periodLabelMap = { 12: '1-Y', 24: '2-Y', 36: '3-Y', 60: '5-Y', 120: 'ALL' };
  const periodTag = periodLabelMap[rangeMonths] || `${sliced.length}M`;

  if (subEl) {
    subEl.textContent = `${pm?.regime || 'Trend Analysis'} • RSI: ${pm?.rsi14 ?? '-'} • 12M Reg R²: ${pm?.regR2 ?? '-'} • (${sliced.length} months shown • ${currency})`;
  }

  if (statsEl) {
    const chgColor = periodChange >= 0 ? 'text-emerald-500' : 'text-rose-500';
    const cBuy = pm?.customBuyPrice || null;
    const cSell = pm?.customSellPrice || null;
    const cStop = pm?.customStopLoss || null;
    const rBuy = pm?.recommendedBuyPrice || null;
    const rSell = pm?.recommendedSellPrice || null;
    const rStop = pm?.recommendedStopLoss || null;

    const fmtPair = (cVal, rVal, colorCls) => {
      if (cVal && rVal && Math.abs(cVal - rVal) >= 0.005) {
        return `<strong class="${colorCls}" title="Custom Pinned Target"><i class="fa-solid fa-thumbtack text-[9px] mr-0.5"></i>${Fin.currency(cVal, false, currency)}</strong> <span class="text-[10px] text-slate-400">(Rec ${Fin.currency(rVal, false, currency)})</span>`;
      }
      if (cVal) {
        return `<strong class="${colorCls}" title="Custom & Recommended Target"><i class="fa-solid fa-thumbtack text-[9px] mr-0.5"></i>${Fin.currency(cVal, false, currency)}</strong>`;
      }
      return `<strong class="${colorCls}">${rVal ? Fin.currency(rVal, false, currency) : '-'}</strong>`;
    };

    statsEl.className = 'mt-2 pt-2 border-t border-slate-100 dark:border-slate-800/80 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-1.5 text-[11px] font-mono';
    statsEl.innerHTML = `
      <div class="col-span-2 sm:col-span-3 lg:col-span-2 flex flex-wrap items-center justify-between gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80">
        <div class="flex items-center gap-1.5">${sigPill}</div>
        <div class="font-bold ${chgColor} whitespace-nowrap">${periodTag}: ${Fin.percent(periodChangePct, true)} (${Fin.currency(periodChange, true, currency)})</div>
      </div>
      <div class="col-span-2 sm:col-span-3 lg:col-span-2 flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5 px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 text-slate-600 dark:text-slate-300">
        <span class="whitespace-nowrap">Buy: ${fmtPair(cBuy, rBuy, 'text-sky-500')}</span>
        <span class="whitespace-nowrap">Sell: ${fmtPair(cSell, rSell, 'text-pink-500')}</span>
        <span class="whitespace-nowrap">Stop: ${fmtPair(cStop, rStop, 'text-rose-500')}</span>
      </div>
      <div class="col-span-1 sm:col-span-1 lg:col-span-1 flex flex-col justify-center px-2 py-1 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 text-slate-600 dark:text-slate-300 text-[10px]">
        <div class="truncate"><span class="text-slate-400">${periodTag} H/L:</span> <strong>${Fin.currency(periodHigh, false, currency)}</strong> / <strong>${Fin.currency(periodLow, false, currency)}</strong></div>
        ${(pm && pm.low52w !== null && pm.high52w !== null) ? `<div class="truncate"><span class="text-slate-400">52W:</span> <strong>${Fin.currency(pm.low52w, false, currency)}</strong>&ndash;<strong>${Fin.currency(pm.high52w, false, currency)}</strong> (${pm.pos52wPct !== null ? `<strong class="text-brand-500">${pm.pos52wPct.toFixed(0)}%</strong>` : '-'})</div>` : ''}
      </div>
      <div class="col-span-1 sm:col-span-2 lg:col-span-1 flex flex-col justify-center px-2 py-1 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 text-slate-600 dark:text-slate-300 text-[10px]">
        <div class="flex items-center justify-between gap-1"><span>MoM: <strong class="${(pm?.momPct || 0) >= 0 ? 'text-emerald-500' : 'text-rose-500'}">${pm?.momPct !== null && pm?.momPct !== undefined ? Fin.percent(pm.momPct, true) : '-'}</strong></span><span>QoQ: <strong class="${(pm?.qoqPct || 0) >= 0 ? 'text-emerald-500' : 'text-rose-500'}">${pm?.qoqPct !== null && pm?.qoqPct !== undefined ? Fin.percent(pm.qoqPct, true) : '-'}</strong></span></div>
        <div>YoY: <strong class="${(pm?.yoyPct || 0) >= 0 ? 'text-emerald-500' : 'text-rose-500'}">${pm?.yoyPct !== null && pm?.yoyPct !== undefined ? Fin.percent(pm.yoyPct, true) : '-'}</strong></div>
      </div>
    `;
  }

  const holding = (portfolio.allHoldings || portfolio.activeHoldings || []).find(h => h.ticker === ticker);
  const hideMoney = Fin.isPrivacyMode();
  const avgCostValue = (!hideMoney && isHoldings && holding && holding.isActive !== false && holding.avgCost > 0) ? holding.avgCost : null;
  const customBuyVal = pm?.customBuyPrice || holding?.customBuyPrice || null;
  const customSellVal = pm?.customSellPrice || holding?.customSellPrice || null;
  const customStopVal = pm?.customStopLoss || holding?.customStopLoss || null;
  const recBuyVal = pm?.recommendedBuyPrice || holding?.recommendedBuyPrice || null;
  const recSellVal = pm?.recommendedSellPrice || holding?.recommendedSellPrice || null;
  const recStopVal = pm?.recommendedStopLoss || holding?.recommendedStopLoss || null;

  // Clear any previously clicked trade marker detail banner when re-rendering chart
  const tradeMarkerBoxEl = document.getElementById(isHoldings ? 'holdings-chart-trade-marker-box' : 'watchlist-chart-trade-marker-box');
  if (tradeMarkerBoxEl) {
    tradeMarkerBoxEl.classList.add('hidden');
    tradeMarkerBoxEl.innerHTML = '';
  }

  // Compute Monthly BUY (Blue X) and SELL (Red X) average price markers for this ticker
  const buyByMonth = {};
  const sellByMonth = {};
  (state.transactions || []).forEach(tx => {
    if (MarketAPI.normalizeTicker(tx.ticker) !== ticker || !tx.date) return;
    const ym = String(tx.date).slice(0, 7);
    const sh = Number(tx.shares || 0);
    const pr = Number(tx.price || 0);
    const fe = Number(tx.fees || 0);
    if (sh <= 0 || pr <= 0) return;

    if (tx.type === 'BUY') {
      if (!buyByMonth[ym]) buyByMonth[ym] = { shares: 0, gross: 0, amount: 0, fees: 0, trades: [] };
      buyByMonth[ym].shares = Fin.round(buyByMonth[ym].shares + sh, 4);
      buyByMonth[ym].gross = Fin.round(buyByMonth[ym].gross + sh * pr, 2);
      buyByMonth[ym].amount = Fin.round(buyByMonth[ym].amount + (sh * pr + fe), 2);
      buyByMonth[ym].fees = Fin.round(buyByMonth[ym].fees + fe, 2);
      buyByMonth[ym].trades.push(tx);
    } else if (tx.type === 'SELL') {
      if (!sellByMonth[ym]) sellByMonth[ym] = { shares: 0, gross: 0, amount: 0, fees: 0, trades: [] };
      sellByMonth[ym].shares = Fin.round(sellByMonth[ym].shares + sh, 4);
      sellByMonth[ym].gross = Fin.round(sellByMonth[ym].gross + sh * pr, 2);
      sellByMonth[ym].amount = Fin.round(sellByMonth[ym].amount + Math.max(0, sh * pr - fe), 2);
      sellByMonth[ym].fees = Fin.round(sellByMonth[ym].fees + fe, 2);
      sellByMonth[ym].trades.push(tx);
    }
  });

  const buyMarkerData = labels.map(ym => {
    const b = buyByMonth[ym];
    return (b && b.shares > 0) ? Fin.round(b.gross / b.shares, 4) : null;
  });
  const buyMetaByIndex = labels.map(ym => {
    const b = buyByMonth[ym];
    if (!b || b.shares <= 0) return null;
    return {
      month: ym,
      type: 'BUY',
      avgPrice: Fin.round(b.gross / b.shares, 4),
      shares: b.shares,
      amount: b.amount,
      gross: b.gross,
      fees: b.fees,
      trades: b.trades
    };
  });

  const sellMarkerData = labels.map(ym => {
    const s = sellByMonth[ym];
    return (s && s.shares > 0) ? Fin.round(s.gross / s.shares, 4) : null;
  });
  const sellMetaByIndex = labels.map(ym => {
    const s = sellByMonth[ym];
    if (!s || s.shares <= 0) return null;
    return {
      month: ym,
      type: 'SELL',
      avgPrice: Fin.round(s.gross / s.shares, 4),
      shares: s.shares,
      amount: s.amount,
      gross: s.gross,
      fees: s.fees,
      trades: s.trades
    };
  });

  const isDark = document.documentElement.classList.contains('dark');
  const isMobile = DeviceDetector.profile.effectiveMode === 'mobile';
  const mainColor = '#10b981';
  const bandFillColor = isDark ? 'rgba(16, 185, 129, 0.22)' : 'rgba(16, 185, 129, 0.18)';
  const bandBorderColor = isDark ? 'rgba(52, 211, 153, 0.45)' : 'rgba(16, 185, 129, 0.40)';

  const datasets = [
    {
      label: 'Monthly High–Low Band',
      data: highData,
      borderColor: bandBorderColor,
      backgroundColor: bandFillColor,
      borderWidth: 1,
      pointRadius: 0,
      pointHoverRadius: 2,
      tension: 0.3,
      fill: '+1',
      order: 4,
      _legendStyle: 'band',
      _pairedLowDatasetIndex: 1
    },
    {
      label: 'Monthly Low',
      data: lowData,
      borderColor: bandBorderColor,
      backgroundColor: 'transparent',
      borderWidth: 1,
      pointRadius: 0,
      pointHoverRadius: 2,
      tension: 0.3,
      fill: false,
      order: 4,
      _hideFromExternalLegend: true
    },
    {
      label: `Close (${currency})`,
      data: closeData,
      borderColor: mainColor,
      backgroundColor: mainColor,
      borderWidth: 2.6,
      fill: false,
      tension: 0.3,
      pointRadius: isMobile ? 2.5 : 3.5,
      pointBackgroundColor: mainColor,
      order: 1,
      _legendStyle: 'solid'
    }
  ];

  // Overlay 1: Rolling Moving Average (3M on monthly chart) when enabled in Settings
  if (state?.settings?.chartShowSma !== false && closeData.length >= 4) {
    const smaShortSeries = closeData.map((_, idx) => {
      const sub = closeData.slice(Math.max(0, idx - 2), idx + 1);
      return Fin.round(sub.reduce((a, b) => a + b, 0) / sub.length, 3);
    });
    datasets.push({
      label: '3M SMA',
      data: smaShortSeries,
      borderColor: '#38bdf8',
      borderWidth: 1.9,
      borderDash: [4, 3],
      pointRadius: 0,
      fill: false,
      tension: 0.3,
      order: 2,
      _legendStyle: 'dashed'
    });
  }

  // Overlay 2: High-Visibility Log-Linear Regression Trend Channel (+1σ / -1σ)
  if (state?.settings?.chartShowRegChannel !== false && closeData.length >= 6) {
    const nPts = closeData.length;
    const xs = closeData.map((_, i) => i);
    const ys = closeData.map(p => Math.log(Math.max(0.0001, p)));
    const xm = xs.reduce((a, b) => a + b, 0) / nPts;
    const ym = ys.reduce((a, b) => a + b, 0) / nPts;
    let cov = 0, vx = 0;
    for (let i = 0; i < nPts; i++) {
      cov += (xs[i] - xm) * (ys[i] - ym);
      vx += (xs[i] - xm) ** 2;
    }
    const slope = vx > 0 ? cov / vx : 0;
    const intercept = ym - slope * xm;
    const residuals = ys.map((y, i) => y - (intercept + slope * i));
    const stdRes = Math.sqrt(residuals.reduce((s, r) => s + r * r, 0) / nPts);

    const regUpper = xs.map(i => Fin.round(Math.exp(intercept + slope * i + stdRes), 3));
    const regLower = xs.map(i => Fin.round(Math.exp(intercept + slope * i - stdRes), 3));
    const regColor = isDark ? '#c084fc' : '#9333ea';

    datasets.push({
      label: 'Reg Upper (+1σ)',
      data: regUpper,
      borderColor: regColor,
      borderDash: [6, 4],
      borderWidth: 2.2,
      pointRadius: 0,
      fill: false,
      order: 3,
      _legendStyle: 'dashed'
    });
    datasets.push({
      label: 'Reg Lower (-1σ)',
      data: regLower,
      borderColor: regColor,
      borderDash: [6, 4],
      borderWidth: 2.2,
      pointRadius: 0,
      fill: false,
      order: 3,
      _legendStyle: 'dashed'
    });
  }

  if (avgCostValue && avgCostValue > 0) {
    datasets.push({
      label: `Avg Cost (${Fin.currency(avgCostValue, false, currency)})`,
      data: labels.map(() => avgCostValue),
      borderColor: '#f59e0b',
      borderDash: [6, 4],
      borderWidth: 2.0,
      pointRadius: 0,
      fill: false,
      order: 2,
      _legendStyle: 'dashed'
    });
  }

  // Option 2 Layout:
  // - Full-width horizontal dotted line for Custom level (or Recommended if no Custom level is set for that target)
  // - Short 2-month right-edge tick + endpoint pin marker at the right edge of the chart for Recommended levels!
  const buildRightEdgeTickSeries = (val) => {
    const nL = labels.length;
    return labels.map((_, idx) => (idx >= Math.max(0, nL - 2) ? val : null));
  };
  const buildRightEdgePointRadii = (r) => {
    const nL = labels.length;
    return labels.map((_, idx) => (idx === nL - 1 ? r : 0));
  };

  // 1. BUY LEVEL(S) — Light Blue (#38bdf8)
  const fullBuyLineVal = customBuyVal || recBuyVal;
  const fullBuyIsCustom = Boolean(customBuyVal);
  if (fullBuyLineVal && fullBuyLineVal > 0) {
    datasets.push({
      label: `${fullBuyIsCustom ? 'Custom Buy Target' : 'Target Buy Price'} (${Fin.currency(fullBuyLineVal, false, currency)})`,
      data: labels.map(() => fullBuyLineVal),
      borderColor: '#38bdf8',
      borderDash: [3, 3],
      borderWidth: 2.2,
      pointRadius: 0,
      fill: false,
      order: 2,
      _legendStyle: 'dashed'
    });
  }
  if (recBuyVal && recBuyVal > 0 && (fullBuyIsCustom || labels.length >= 2)) {
    datasets.push({
      label: `Rec. Buy Pin (${Fin.currency(recBuyVal, false, currency)})`,
      data: buildRightEdgeTickSeries(recBuyVal),
      borderColor: '#0284c7',
      backgroundColor: '#38bdf8',
      borderDash: [2, 2],
      borderWidth: 2.4,
      pointStyle: 'triangle',
      pointRadius: buildRightEdgePointRadii(isMobile ? 5.5 : 6.5),
      pointHoverRadius: isMobile ? 7 : 8,
      pointBackgroundColor: '#38bdf8',
      pointBorderColor: '#0284c7',
      pointBorderWidth: 1.8,
      spanGaps: false,
      fill: false,
      order: 1,
      _legendStyle: 'dashed',
      _hideFromExternalLegend: !fullBuyIsCustom || Math.abs((customBuyVal || 0) - (recBuyVal || 0)) < 0.005
    });
  }

  // 2. SELL LEVEL(S) — Pink (#f472b6)
  const fullSellLineVal = customSellVal || recSellVal;
  const fullSellIsCustom = Boolean(customSellVal);
  if (fullSellLineVal && fullSellLineVal > 0) {
    datasets.push({
      label: `${fullSellIsCustom ? 'Custom Sell Target' : 'Target Sell Price'} (${Fin.currency(fullSellLineVal, false, currency)})`,
      data: labels.map(() => fullSellLineVal),
      borderColor: '#f472b6',
      borderDash: [3, 3],
      borderWidth: 2.2,
      pointRadius: 0,
      fill: false,
      order: 2,
      _legendStyle: 'dashed'
    });
  }
  if (recSellVal && recSellVal > 0 && (fullSellIsCustom || labels.length >= 2)) {
    datasets.push({
      label: `Rec. Sell Pin (${Fin.currency(recSellVal, false, currency)})`,
      data: buildRightEdgeTickSeries(recSellVal),
      borderColor: '#db2777',
      backgroundColor: '#f472b6',
      borderDash: [2, 2],
      borderWidth: 2.4,
      pointStyle: 'rectRot',
      pointRadius: buildRightEdgePointRadii(isMobile ? 5.5 : 6.5),
      pointHoverRadius: isMobile ? 7 : 8,
      pointBackgroundColor: '#f472b6',
      pointBorderColor: '#db2777',
      pointBorderWidth: 1.8,
      spanGaps: false,
      fill: false,
      order: 1,
      _legendStyle: 'dashed',
      _hideFromExternalLegend: !fullSellIsCustom || Math.abs((customSellVal || 0) - (recSellVal || 0)) < 0.005
    });
  }

  // 3. STOP-LOSS LEVEL(S) — Dark Red (#b91c1c)
  const fullStopLineVal = customStopVal || recStopVal;
  const fullStopIsCustom = Boolean(customStopVal);
  if (fullStopLineVal && fullStopLineVal > 0) {
    datasets.push({
      label: `${fullStopIsCustom ? 'Custom Stop Loss' : 'Stop Loss'} (${Fin.currency(fullStopLineVal, false, currency)})`,
      data: labels.map(() => fullStopLineVal),
      borderColor: '#b91c1c',
      borderDash: [3, 3],
      borderWidth: 2.2,
      pointRadius: 0,
      fill: false,
      order: 2,
      _legendStyle: 'dashed'
    });
  }
  if (recStopVal && recStopVal > 0 && (fullStopIsCustom || labels.length >= 2)) {
    datasets.push({
      label: `Rec. Stop Pin (${Fin.currency(recStopVal, false, currency)})`,
      data: buildRightEdgeTickSeries(recStopVal),
      borderColor: '#991b1b',
      backgroundColor: '#b91c1c',
      borderDash: [2, 2],
      borderWidth: 2.4,
      pointStyle: 'circle',
      pointRadius: buildRightEdgePointRadii(isMobile ? 5 : 6),
      pointHoverRadius: isMobile ? 7 : 8,
      pointBackgroundColor: '#b91c1c',
      pointBorderColor: '#7f1d1d',
      pointBorderWidth: 1.8,
      spanGaps: false,
      fill: false,
      order: 1,
      _legendStyle: 'dashed',
      _hideFromExternalLegend: !fullStopIsCustom || Math.abs((customStopVal || 0) - (recStopVal || 0)) < 0.005
    });
  }

  // Add Monthly Buy Avg Price (Blue X) and Monthly Sell Avg Price (Red X) markers on the Holdings chart (hidden in Privacy Mode)
  if (isHoldings && !hideMoney) {
    if (buyMarkerData.some(v => v !== null)) {
      datasets.push({
        label: 'Buy Avg Price (Blue X)',
        data: buyMarkerData,
        borderColor: '#2563eb',
        backgroundColor: '#3b82f6',
        pointBorderColor: '#2563eb',
        pointBackgroundColor: '#3b82f6',
        pointStyle: 'crossRot',
        pointBorderWidth: 3.2,
        pointRadius: isMobile ? 7.5 : 9,
        pointHoverRadius: isMobile ? 9.5 : 11.5,
        pointHitRadius: 16,
        showLine: false,
        fill: false,
        order: 0,
        _legendStyle: 'cross-blue',
        _tradeMeta: buyMetaByIndex
      });
    }
    if (sellMarkerData.some(v => v !== null)) {
      datasets.push({
        label: 'Sell Avg Price (Red X)',
        data: sellMarkerData,
        borderColor: '#ef4444',
        backgroundColor: '#ef4444',
        pointBorderColor: '#ef4444',
        pointBackgroundColor: '#ef4444',
        pointStyle: 'crossRot',
        pointBorderWidth: 3.2,
        pointRadius: isMobile ? 7.5 : 9,
        pointHoverRadius: isMobile ? 9.5 : 11.5,
        pointHitRadius: 16,
        showLine: false,
        fill: false,
        order: 0,
        _legendStyle: 'cross-red',
        _tradeMeta: sellMetaByIndex
      });
    }
  }

  const renderClickedTradeMarkerDetail = (metaList) => {
    if (!tradeMarkerBoxEl || !Array.isArray(metaList) || metaList.length === 0) return;
    tradeMarkerBoxEl.classList.remove('hidden');
    tradeMarkerBoxEl.innerHTML = metaList.map(meta => {
      const isBuy = meta.type === 'BUY';
      const toneCls = isBuy
        ? 'bg-blue-500/10 border-blue-500/40 text-blue-600 dark:text-blue-400'
        : 'bg-rose-500/10 border-rose-500/40 text-rose-600 dark:text-rose-400';
      const badgeCls = isBuy
        ? 'bg-blue-600 text-white'
        : 'bg-rose-600 text-white';
      return `
        <div class="p-2.5 sm:p-3 rounded-xl border ${toneCls} flex flex-wrap items-center justify-between gap-3 text-xs">
          <div class="flex flex-wrap items-center gap-2 sm:gap-4">
            <span class="px-2 py-0.5 rounded font-mono font-bold text-[11px] ${badgeCls}">
              ${isBuy ? '✕ BUY' : '✕ SELL'} (${meta.month})
            </span>
            <span>Average Price: <strong class="num-font text-slate-900 dark:text-white">${Fin.currency(meta.avgPrice, false, currency)}</strong></span>
            <span>Shares: <strong class="num-font text-slate-900 dark:text-white">${Fin.shares(meta.shares)}</strong></span>
            <span>${isBuy ? 'Buy' : 'Sell'} Amount: <strong class="num-font text-slate-900 dark:text-white">${Fin.currency(meta.amount, false, currency)}</strong></span>
            ${meta.trades.length > 1 ? `<span class="text-[10px] text-slate-500">(${meta.trades.length} orders in ${meta.month})</span>` : ''}
          </div>
          <button type="button" onclick="this.closest('#holdings-chart-trade-marker-box, #watchlist-chart-trade-marker-box').classList.add('hidden')" class="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 px-1.5" title="Dismiss">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>
      `;
    }).join('');
  };

  const chartInstance = new Chart(canvasEl, {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      onClick: (evt, activeElements, chart) => {
        if (!isHoldings) return;
        const pts = chart.getElementsAtEventForMode(evt, 'nearest', { intersect: true }, false);
        const matchedMetas = [];
        pts.forEach(pt => {
          const ds = chart.data.datasets[pt.datasetIndex];
          const meta = ds && ds._tradeMeta ? ds._tradeMeta[pt.index] : null;
          if (meta) matchedMetas.push(meta);
        });
        // If user clicked anywhere along a month column that has a Buy or Sell marker, also surface it
        if (matchedMetas.length === 0 && activeElements && activeElements.length > 0) {
          const idx = activeElements[0].index;
          if (buyMetaByIndex[idx]) matchedMetas.push(buyMetaByIndex[idx]);
          if (sellMetaByIndex[idx]) matchedMetas.push(sellMetaByIndex[idx]);
        }
        if (matchedMetas.length > 0) {
          renderClickedTradeMarkerDetail(matchedMetas);
        }
      },
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
            callback: (v) => Fin.currency(v, false, currency)
          }
        }
      },
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          callbacks: {
            label: (c) => {
              const ds = c.dataset;
              if (ds && ds._tradeMeta && ds._tradeMeta[c.dataIndex]) {
                const tm = ds._tradeMeta[c.dataIndex];
                return [
                  ` ${tm.type} Marker (${tm.month}): Avg Price ${Fin.currency(tm.avgPrice, false, currency)}`,
                  `   • Action: ${tm.type} | Shares: ${Fin.shares(tm.shares)} | ${tm.type === 'BUY' ? 'Buy' : 'Sell'} Amount: ${Fin.currency(tm.amount, false, currency)}`
                ];
              }
              if (c.datasetIndex === 0) {
                return ` Monthly High: ${Fin.currency(c.raw, false, currency)}`;
              }
              if (c.datasetIndex === 1) {
                return ` Monthly Low: ${Fin.currency(c.raw, false, currency)}`;
              }
              return ` ${c.dataset.label}: ${Fin.currency(c.raw, false, currency)}`;
            }
          }
        }
      }
    }
  });
  charts[chartKey] = chartInstance;

  // Render external HTML legend below the chart in a tidy multi-column grid
  if (legendEl) {
    legendEl.className = 'mt-2 pt-2 border-t border-slate-100 dark:border-slate-800/80 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-1.5 text-[10.5px]';
    const buildExternalLegend = () => {
      legendEl.innerHTML = '';
      datasets.forEach((ds, idx) => {
        if (ds._hideFromExternalLegend) return;
        const isVisible = chartInstance.isDatasetVisible(idx);
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `inline-flex items-center justify-start gap-1.5 px-2 py-1 rounded-md border text-[10.5px] font-medium transition truncate ${
          isVisible
            ? 'bg-slate-50/80 dark:bg-slate-800/70 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/80'
            : 'bg-slate-100/40 dark:bg-slate-900/40 border-slate-200/50 dark:border-slate-800 text-slate-400 dark:text-slate-500 line-through opacity-60'
        }`;

        let swatchHtml = '';
        if (ds._legendStyle === 'band') {
          swatchHtml = `<span class="inline-block w-3.5 h-2 rounded-sm border shrink-0" style="background: rgba(16, 185, 129, 0.28); border-color: rgba(52, 211, 153, 0.75);"></span>`;
        } else if (ds._legendStyle === 'cross-blue') {
          swatchHtml = `<span class="inline-flex items-center justify-center font-extrabold text-xs leading-none shrink-0" style="color: #2563eb;">✕</span>`;
        } else if (ds._legendStyle === 'cross-red') {
          swatchHtml = `<span class="inline-flex items-center justify-center font-extrabold text-xs leading-none shrink-0" style="color: #ef4444;">✕</span>`;
        } else if (ds._legendStyle === 'dashed') {
          swatchHtml = `<span class="inline-block w-3.5 h-0 border-t-2 border-dashed shrink-0" style="border-color: ${ds.borderColor};"></span>`;
        } else {
          swatchHtml = `<span class="inline-block w-3.5 h-0.5 rounded-full shrink-0" style="background-color: ${ds.borderColor}; height: 2.5px;"></span>`;
        }

        btn.innerHTML = `${swatchHtml}<span class="truncate">${ds.label}</span>`;
        btn.addEventListener('click', () => {
          const nextVis = !chartInstance.isDatasetVisible(idx);
          chartInstance.setDatasetVisibility(idx, nextVis);
          if (typeof ds._pairedLowDatasetIndex === 'number') {
            chartInstance.setDatasetVisibility(ds._pairedLowDatasetIndex, nextVis);
          }
          chartInstance.update();
          buildExternalLegend();
        });
        legendEl.appendChild(btn);
      });
    };
    buildExternalLegend();
  }
}

function renderAllocationChart() {
  const ctx = document.getElementById('chart-allocation');
  const emptyDiv = document.getElementById('chart-alloc-empty');
  const baseCurr = portfolio?.baseCurrency || state?.settings?.currency || 'HKD';
  if (charts.allocation) charts.allocation.destroy();

  if (!portfolio.activeHoldings || portfolio.activeHoldings.length === 0) {
    emptyDiv.classList.remove('hidden');
    return;
  }
  emptyDiv.classList.add('hidden');

  const labels = [];
  const data = [];
  const palette = ['#10b981', '#6366f1', '#06b6d4', '#f59e0b', '#ec4899', '#8b5cf6', '#3b82f6', '#14b8a6', '#f97316', '#84cc16', '#ef4444', '#a855f7'];

  if (allocationViewMode === 'ticker') {
    portfolio.activeHoldings.forEach(h => {
      labels.push(h.ticker);
      data.push(h.marketValueBase || h.marketValue);
    });
  } else {
    const sectorMap = {};
    portfolio.activeHoldings.forEach(h => {
      const s = h.sector || 'Equities';
      sectorMap[s] = (sectorMap[s] || 0) + (h.marketValueBase || h.marketValue);
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
        backgroundColor: labels.map((_, idx) => palette[idx % palette.length]),
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
              if (Fin.isPrivacyMode()) {
                return ` ${c.label}: ${pct}%`;
              }
              return ` ${c.label}: ${Fin.currency(val, false, baseCurr)} (${pct}%)`;
            }
          }
        }
      }
    }
  });
}

function renderDividendsChart() {
  const ctx = document.getElementById('chart-dividends');
  const baseCurr = portfolio?.baseCurrency || state?.settings?.currency || 'HKD';
  if (charts.dividends) charts.dividends.destroy();

  const monthlyMap = {};
  state.dividends.forEach(d => {
    const m = (d.payDate || '').slice(0, 7) || 'Unknown';
    const dCurr = d.currency || state.prices[d.ticker]?.currency || MarketAPI.getStaticProfile(d.ticker).currency || baseCurr;
    const amtBase = Fin.convertCurrency(d.totalAmount || 0, dCurr, baseCurr);
    monthlyMap[m] = (monthlyMap[m] || 0) + amtBase;
  });

  const hideMoney = Fin.isPrivacyMode();
  const months = Object.keys(monthlyMap).sort();
  const totals = months.map(m => Fin.round(monthlyMap[m], 2));
  const avgYoc = portfolio.totalStockCostBasis > 0
    ? Fin.round((portfolio.totalDividendsEarned / portfolio.totalStockCostBasis) * 100, 2)
    : 0;
  document.getElementById('chart-div-total-badge').textContent = hideMoney
    ? `YoC ${avgYoc.toFixed(2)}%`
    : `${Fin.currency(portfolio.totalDividendsEarned, false, baseCurr)} Total`;

  const isDark = document.documentElement.classList.contains('dark');
  charts.dividends = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: months.length > 0 ? months : ['No Dividends Logged'],
      datasets: [{
        label: hideMoney ? 'Monthly Dividend (Hidden)' : `Monthly Dividend (${baseCurr})`,
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
          ticks: {
            color: isDark ? '#94a3b8' : '#64748b',
            font: { size: 10 },
            callback: (v) => hideMoney ? '••••' : Fin.currency(v, false, baseCurr)
          }
        }
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (c) => hideMoney
              ? ' Monthly Dividend: ••••••'
              : ` ${c.dataset.label}: ${Fin.currency(c.raw, false, baseCurr)}`
          }
        }
      }
    }
  });
}

function renderPnlBreakdownChart() {
  const ctx = document.getElementById('chart-pnl-breakdown');
  const baseCurr = portfolio?.baseCurrency || state?.settings?.currency || 'HKD';
  if (charts.pnlBreakdown) charts.pnlBreakdown.destroy();

  const hideMoney = Fin.isPrivacyMode();
  const tickers = Array.from(new Set([
    ...portfolio.activeHoldings.map(h => h.ticker),
    ...Object.keys(portfolio.allHoldingsMap).filter(t => (portfolio.allHoldingsMap[t].realizedGain || 0) !== 0)
  ]));

  const unrealizedSeries = tickers.map(t => {
    const active = portfolio.activeHoldings.find(h => h.ticker === t);
    if (!active) return 0;
    if (hideMoney) return Fin.round(active.unrealizedGainPct || 0, 2);
    return Fin.convertCurrency(active.unrealizedGain, active.currency, baseCurr);
  });
  const realizedSeries = tickers.map(t => {
    const pos = portfolio.allHoldingsMap[t];
    const rg = pos?.realizedGain || 0;
    if (hideMoney) {
      const refCost = (pos?.totalCostBasis > 0 ? pos.totalCostBasis : (pos?.historicalCostBasis || pos?.cumulativeBuyCostBasis || 0));
      return refCost > 0 ? Fin.round((rg / refCost) * 100, 2) : 0;
    }
    const tCurr = state.prices[t]?.currency || MarketAPI.getStaticProfile(t).currency || baseCurr;
    return Fin.convertCurrency(rg, tCurr, baseCurr);
  });

  const isDark = document.documentElement.classList.contains('dark');
  charts.pnlBreakdown = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: tickers.length > 0 ? tickers : ['No Positions'],
      datasets: [
        { label: hideMoney ? 'Unrealized Return (%)' : `Unrealized P&L (${baseCurr})`, data: unrealizedSeries.length > 0 ? unrealizedSeries : [0], backgroundColor: '#10b981', borderRadius: 5 },
        { label: hideMoney ? 'Realized Return (%)' : `Realized P&L (${baseCurr})`, data: realizedSeries.length > 0 ? realizedSeries : [0], backgroundColor: '#6366f1', borderRadius: 5 }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { grid: { display: false }, ticks: { color: isDark ? '#94a3b8' : '#64748b', font: { size: 10 } } },
        y: {
          grid: { color: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' },
          ticks: {
            color: isDark ? '#94a3b8' : '#64748b',
            font: { size: 10 },
            callback: (v) => hideMoney ? Fin.percent(v, true) : Fin.currency(v, true, baseCurr)
          }
        }
      },
      plugins: {
        legend: { position: 'top', labels: { color: isDark ? '#94a3b8' : '#475569', font: { size: 11 } } },
        tooltip: {
          callbacks: {
            label: (c) => hideMoney
              ? ` ${c.dataset.label}: ${Fin.percent(c.raw, true)}`
              : ` ${c.dataset.label}: ${Fin.currency(c.raw, true, baseCurr)}`
          }
        }
      }
    }
  });
}

window.renderCharts = renderCharts;
window.renderMonthlyHistoryChart = renderMonthlyHistoryChart;
window.renderInlineStockChart = renderInlineStockChart;
window.renderAllocationChart = renderAllocationChart;
window.renderDividendsChart = renderDividendsChart;
window.renderPnlBreakdownChart = renderPnlBreakdownChart;
