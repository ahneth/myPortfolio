/**
 * @file charts.js
 * @module PortfolioChartsModule
 * @version 2.3.0
 * @build 20261018_1431
 * @description Chart.js controllers for:
 *   1. Dashboard "Portfolio Historical Balance & Return" (Monthly Balance vs. Monthly Accumulative Total Return)
 *   2. Holdings Tab inline clickable stock monthly price chart (1-Y, 2-Y, 3-Y, 5-Y, ALL)
 *   3. Watchlist Tab inline clickable stock monthly price chart (1-Y, 2-Y, 3-Y, 5-Y, ALL)
 *   4. Asset Allocation, Monthly Dividends & P&L Breakdown charts
 */

function renderCharts() {
  if (typeof Chart === 'undefined') {
    if (typeof AppLogger !== 'undefined') {
      AppLogger.warn('Charts', 'Chart.js library is not yet available; skipping chart rendering.');
    }
    return;
  }
  try { renderMonthlyHistoryChart(); } catch (err) { if (typeof AppLogger !== 'undefined') AppLogger.error('Charts', `renderMonthlyHistoryChart failed: ${err.message}`, err); }
  try { renderAllocationChart(); } catch (err) { if (typeof AppLogger !== 'undefined') AppLogger.error('Charts', `renderAllocationChart failed: ${err.message}`, err); }
  try { renderDividendsChart(); } catch (err) { if (typeof AppLogger !== 'undefined') AppLogger.error('Charts', `renderDividendsChart failed: ${err.message}`, err); }
  try { renderPnlBreakdownChart(); } catch (err) { if (typeof AppLogger !== 'undefined') AppLogger.error('Charts', `renderPnlBreakdownChart failed: ${err.message}`, err); }
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

/**
 * Computes month-by-month portfolio series across all historical months:
 *  - balanceSeries: Monthly Portfolio Balance (Holdings Market Value + Cash Balance)
 *  - costBasisSeries: Invested Capital & Cash Basis
 *  - accumReturnDollarSeries: Monthly Accumulative Total Return ($) = Unrealized Gain + Cumulative Realized P&L + Cumulative Dividends
 *  - accumReturnPctSeries: Monthly Accumulative Total Return (%) relative to Invested Capital
 */
function computeMonthlyPortfolioSeries(rangeMonths) {
  const heldTickers = portfolio.activeHoldings.map(h => h.ticker);
  const allTxTickers = Array.from(new Set(
    state.transactions.filter(t => t.ticker).map(t => t.ticker)
  ));
  const relevantTickers = Array.from(new Set([...heldTickers, ...allTxTickers]));

  if (relevantTickers.length === 0 && state.transactions.length === 0) {
    return null;
  }

  const monthSet = new Set();
  relevantTickers.forEach(t => {
    (state.historicalPrices[t] || []).forEach(r => monthSet.add(r.month));
  });
  state.transactions.forEach(tx => {
    if (tx.date) monthSet.add(tx.date.slice(0, 7));
  });
  state.dividends.forEach(div => {
    if (div.payDate) monthSet.add(div.payDate.slice(0, 7));
  });

  if (monthSet.size === 0) {
    (state.historicalPrices['2800.HK'] || state.historicalPrices['VOO'] || []).forEach(r => monthSet.add(r.month));
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

  slicedMonths.forEach(monthStr => {
    const txUpToMonth = earliestTxMonth && monthStr >= earliestTxMonth
      ? sortedTx.filter(tx => (tx.date || '').slice(0, 7) <= monthStr)
      : [];

    let monthMarketVal = 0;
    let monthCostBasis = 0;
    let monthCash = Fin.round(state.initialCash || 0, 2);
    let cumRealized = 0;
    let cumDividends = 0;

    if (txUpToMonth.length > 0) {
      const posMap = {};
      txUpToMonth.forEach(tx => {
        const fees = Fin.round(tx.fees || 0, 2);
        const shares = Fin.round(tx.shares || 0, 4);
        const price = Fin.round(tx.price || 0, 4);
        if (tx.type === 'DEPOSIT') {
          monthCash = Fin.round(monthCash + (tx.amount || 0), 2);
        } else if (tx.type === 'WITHDRAW') {
          monthCash = Fin.round(monthCash - (tx.amount || 0), 2);
        } else if (tx.type === 'BUY') {
          const outlay = Fin.round(shares * price + fees, 2);
          monthCash = Fin.round(monthCash - outlay, 2);
          if (!posMap[tx.ticker]) posMap[tx.ticker] = { shares: 0, cost: 0, avg: 0 };
          posMap[tx.ticker].shares = Fin.round(posMap[tx.ticker].shares + shares, 4);
          posMap[tx.ticker].cost = Fin.round(posMap[tx.ticker].cost + outlay, 2);
          posMap[tx.ticker].avg = posMap[tx.ticker].shares > 0 ? posMap[tx.ticker].cost / posMap[tx.ticker].shares : 0;
        } else if (tx.type === 'DRIP') {
          const dripVal = Fin.round(shares * price, 2);
          if (!posMap[tx.ticker]) posMap[tx.ticker] = { shares: 0, cost: 0, avg: 0 };
          posMap[tx.ticker].shares = Fin.round(posMap[tx.ticker].shares + shares, 4);
          posMap[tx.ticker].cost = Fin.round(posMap[tx.ticker].cost + dripVal, 2);
          posMap[tx.ticker].avg = posMap[tx.ticker].shares > 0 ? posMap[tx.ticker].cost / posMap[tx.ticker].shares : 0;
        } else if (tx.type === 'SELL') {
          const netProceeds = Fin.round(shares * price - fees, 2);
          monthCash = Fin.round(monthCash + netProceeds, 2);
          if (!posMap[tx.ticker]) posMap[tx.ticker] = { shares: 0, cost: 0, avg: 0 };
          const soldCost = Fin.round(shares * posMap[tx.ticker].avg, 2);
          cumRealized = Fin.round(cumRealized + (netProceeds - soldCost), 2);
          posMap[tx.ticker].shares = Fin.round(posMap[tx.ticker].shares - shares, 4);
          posMap[tx.ticker].cost = Fin.round(posMap[tx.ticker].cost - soldCost, 2);
          if (posMap[tx.ticker].shares <= 0.0001) {
            posMap[tx.ticker] = { shares: 0, cost: 0, avg: 0 };
          } else {
            posMap[tx.ticker].avg = posMap[tx.ticker].cost / posMap[tx.ticker].shares;
          }
        }
      });

      sortedDiv.filter(d => (d.payDate || '').slice(0, 7) <= monthStr).forEach(d => {
        const amt = Fin.round(d.totalAmount || 0, 2);
        cumDividends = Fin.round(cumDividends + amt, 2);
        if (!d.isDrip) {
          monthCash = Fin.round(monthCash + amt, 2);
        }
      });

      Object.keys(posMap).forEach(ticker => {
        const p = posMap[ticker];
        if (p.shares > 0.0001) {
          const hist = state.historicalPrices[ticker] || [];
          let closePrice = state.prices[ticker]?.price || p.avg;
          const exact = hist.find(item => item.month === monthStr);
          if (exact) {
            closePrice = exact.close;
          } else if (hist.length > 0) {
            const prior = hist.filter(item => item.month <= monthStr);
            closePrice = prior.length > 0 ? prior[prior.length - 1].close : hist[0].close;
          }
          monthMarketVal += p.shares * closePrice;
          monthCostBasis += p.cost;
        }
      });
    } else {
      monthCash = Math.max(0, portfolio.cashBalance);
      portfolio.activeHoldings.forEach(h => {
        const hist = state.historicalPrices[h.ticker] || [];
        let closePrice = h.currentPrice;
        const exact = hist.find(item => item.month === monthStr);
        if (exact) {
          closePrice = exact.close;
        } else if (hist.length > 0) {
          const prior = hist.filter(item => item.month <= monthStr);
          closePrice = prior.length > 0 ? prior[prior.length - 1].close : hist[0].close;
        }
        monthMarketVal += h.shares * closePrice;
        monthCostBasis += h.totalCostBasis;
      });
      sortedDiv.filter(d => (d.payDate || '').slice(0, 7) <= monthStr).forEach(d => {
        cumDividends = Fin.round(cumDividends + (d.totalAmount || 0), 2);
      });
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

/**
 * Dashboard Chart: "Portfolio Historical Balance & Return"
 * Exclusively displays portfolio-level monthly balance OR monthly accumulative total return.
 */
function renderMonthlyHistoryChart() {
  const ctx = document.getElementById('chart-monthly-history');
  const emptyOverlay = document.getElementById('chart-history-empty');
  const emptyText = document.getElementById('chart-history-empty-text');
  const subtitle = document.getElementById('historical-chart-subtitle');
  const metricSummaryBadge = document.getElementById('portfolio-history-metric-badge');

  if (!ctx) return;
  if (charts.monthlyHistory) charts.monthlyHistory.destroy();

  const isDark = document.documentElement.classList.contains('dark');
  const isMobile = DeviceDetector.profile.effectiveMode === 'mobile';

  const seriesData = computeMonthlyPortfolioSeries(historyRangeMonths);
  if (!seriesData || seriesData.labels.length === 0 || (portfolio.activeHoldings.length === 0 && state.transactions.length === 0)) {
    if (emptyOverlay) emptyOverlay.classList.remove('hidden');
    if (emptyText) {
      emptyText.textContent = 'Record a stock trade (e.g. 2800.HK or VOO) to view your monthly portfolio balance and accumulative total return.';
    }
    if (metricSummaryBadge) metricSummaryBadge.textContent = 'Balance: $0.00';
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

  if (portfolioHistoryMode === 'return') {
    if (subtitle) {
      subtitle.textContent = `Monthly Accumulative Total Return ($ & %) including Unrealized Gains, Realized P&L & Dividends (${labels.length} months)`;
    }
    if (metricSummaryBadge) {
      const signColor = latestReturnDollar >= 0
        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
        : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30';
      metricSummaryBadge.className = `text-xs font-mono font-bold px-2.5 py-1 rounded-lg border ${signColor}`;
      metricSummaryBadge.textContent = `Total Return: ${Fin.currency(latestReturnDollar, true)} (${Fin.percent(latestReturnPct, true)})`;
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
            label: 'Accumulative Total Return ($)',
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
              callback: (v) => (v >= 0 ? '+$' : '-$') + Math.abs(v).toLocaleString()
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
                return ` ${c.dataset.label}: ${Fin.currency(c.raw, true)}`;
              }
            }
          }
        }
      }
    });
    return;
  }

  // DEFAULT MODE: MONTHLY PORTFOLIO BALANCE
  if (subtitle) {
    subtitle.textContent = `Monthly Portfolio Balance vs. Invested Capital across ${labels.length} months`;
  }
  if (metricSummaryBadge) {
    metricSummaryBadge.className = 'text-xs font-mono font-bold px-2.5 py-1 rounded-lg border bg-brand-500/10 text-brand-600 dark:text-brand-400 border-brand-500/30';
    metricSummaryBadge.textContent = `Balance: ${Fin.currency(latestBalance)}`;
  }

  charts.monthlyHistory = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Monthly Portfolio Balance ($)',
          data: balanceSeries,
          borderColor: '#10b981',
          backgroundColor: 'rgba(16, 185, 129, 0.14)',
          fill: true,
          tension: 0.32,
          pointRadius: isMobile ? 2 : 3.5,
          pointBackgroundColor: '#10b981'
        },
        {
          label: 'Invested Capital & Cash Basis ($)',
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

/**
 * Renders the inline historical monthly price chart below the Holdings table or Watchlist table
 * when a stock row is clicked.
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

  if (!cardEl || !canvasEl) return;

  const chartKey = isHoldings ? 'holdingsStockHistory' : 'watchlistStockHistory';
  if (charts[chartKey]) {
    charts[chartKey].destroy();
    charts[chartKey] = null;
  }

  if (!ticker) {
    cardEl.classList.add('hidden');
    return;
  }

  cardEl.classList.remove('hidden');

  const series = state.historicalPrices[ticker] || [];
  const fund = state.fundamentals[ticker] || {};
  const priceObj = state.prices[ticker] || {};
  const currency = priceObj.currency || fund.currency || (ticker.endsWith('.HK') ? 'HKD' : (ticker.endsWith('.L') ? 'GBp' : 'USD'));
  const companyName = fund.name || ticker;

  if (titleEl) {
    titleEl.innerHTML = `<span class="font-mono text-brand-600 dark:text-brand-400">${ticker}</span> <span class="text-slate-400 font-normal">&mdash;</span> <span>${companyName}</span>`;
  }

  if (series.length === 0) {
    if (emptyEl) emptyEl.classList.remove('hidden');
    if (subEl) subEl.textContent = `Fetching monthly historical closing prices for ${ticker}...`;
    if (statsEl) statsEl.innerHTML = '';
    return;
  }
  if (emptyEl) emptyEl.classList.add('hidden');

  const sliced = series.slice(-rangeMonths);
  const labels = sliced.map(r => r.month);
  const closeData = sliced.map(r => r.close);

  const firstClose = closeData[0] || 0;
  const lastClose = closeData[closeData.length - 1] || 0;
  const periodChange = Fin.round(lastClose - firstClose, 2);
  const periodChangePct = firstClose > 0 ? Fin.round(((lastClose - firstClose) / firstClose) * 100, 2) : 0;
  const periodHigh = Math.max(...closeData);
  const periodLow = Math.min(...closeData);

  const periodLabelMap = { 12: '1-Y', 24: '2-Y', 36: '3-Y', 60: '5-Y', 120: 'ALL' };
  const periodTag = periodLabelMap[rangeMonths] || `${sliced.length}M`;

  if (subEl) {
    subEl.textContent = `Monthly Historical Adjusted Closing Prices (${sliced.length} months shown • ${labels[0]} to ${labels[labels.length - 1]} • ${currency})`;
  }

  if (statsEl) {
    const chgClass = periodChange >= 0 ? 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20' : 'text-rose-500 bg-rose-500/10 border-rose-500/20';
    statsEl.innerHTML = `
      <span class="px-2.5 py-1 rounded-lg text-xs font-mono font-bold border ${chgClass}">
        ${periodTag} Change: ${Fin.percent(periodChangePct, true)} (${Fin.currency(periodChange, true, currency)})
      </span>
      <span class="px-2.5 py-1 rounded-lg text-xs font-mono bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
        High: <strong>${Fin.currency(periodHigh, false, currency)}</strong> &bull; Low: <strong>${Fin.currency(periodLow, false, currency)}</strong>
      </span>
    `;
  }

  const holding = portfolio.activeHoldings.find(h => h.ticker === ticker);
  const watched = state.watchlist.find(w => w.ticker === ticker);
  const refValue = isHoldings
    ? (holding ? holding.avgCost : null)
    : (watched ? watched.targetBuyPrice : (holding ? holding.avgCost : null));
  const refLabel = isHoldings
    ? (holding ? `Your Avg Cost (${Fin.currency(refValue, false, currency)})` : null)
    : (watched ? `Target Buy Price (${Fin.currency(refValue, false, currency)})` : null);

  const isDark = document.documentElement.classList.contains('dark');
  const isMobile = DeviceDetector.profile.effectiveMode === 'mobile';
  const mainColor = isHoldings ? '#10b981' : '#8b5cf6';
  const mainFill = isHoldings ? 'rgba(16, 185, 129, 0.14)' : 'rgba(139, 92, 246, 0.14)';

  const datasets = [
    {
      label: `${ticker} Monthly Close (${currency})`,
      data: closeData,
      borderColor: mainColor,
      backgroundColor: mainFill,
      fill: true,
      tension: 0.3,
      pointRadius: isMobile ? 2 : 3.5,
      pointBackgroundColor: mainColor
    }
  ];

  if (refValue && refValue > 0) {
    datasets.push({
      label: refLabel,
      data: labels.map(() => refValue),
      borderColor: isHoldings ? '#f59e0b' : '#ec4899',
      borderDash: [6, 6],
      borderWidth: 2,
      pointRadius: 0,
      fill: false
    });
  }

  charts[chartKey] = new Chart(canvasEl, {
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
            callback: (v) => Fin.currency(v, false, currency)
          }
        }
      },
      plugins: {
        legend: {
          labels: { color: isDark ? '#cbd5e1' : '#334155', font: { size: 11 } }
        },
        tooltip: {
          callbacks: {
            label: (c) => ` ${c.dataset.label}: ${Fin.currency(c.raw, false, currency)}`
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
      const s = h.sector || 'Equities';
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

window.renderCharts = renderCharts;
window.renderMonthlyHistoryChart = renderMonthlyHistoryChart;
window.renderInlineStockChart = renderInlineStockChart;
window.renderAllocationChart = renderAllocationChart;
window.renderDividendsChart = renderDividendsChart;
window.renderPnlBreakdownChart = renderPnlBreakdownChart;
