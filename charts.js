/**
 * @file charts.js
 * @module PortfolioChartsModule
 * @version 3.0.1
 * @build 20261031_1115
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
        const tCurr = state.prices[tx.ticker]?.currency || state.fundamentals[tx.ticker]?.currency || MarketAPI.getStaticProfile(tx.ticker).currency || baseCurr;

        if (tx.type === 'DEPOSIT') {
          monthCash = Fin.round(monthCash + (tx.amount || 0), 2);
        } else if (tx.type === 'WITHDRAW') {
          monthCash = Fin.round(monthCash - (tx.amount || 0), 2);
        } else if (tx.type === 'BUY') {
          const outlayNative = Fin.round(shares * price + fees, 2);
          const outlayBase = Fin.convertCurrency(outlayNative, tCurr, baseCurr);
          monthCash = Fin.round(monthCash - outlayBase, 2);
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
          monthCash = Fin.round(monthCash + netProceedsBase, 2);
          if (!posMap[tx.ticker]) posMap[tx.ticker] = { shares: 0, costNative: 0, avgNative: 0, currency: tCurr };
          const soldCostNative = Fin.round(shares * posMap[tx.ticker].avgNative, 2);
          cumRealized = Fin.round(cumRealized + Fin.convertCurrency(netProceedsNative - soldCostNative, tCurr, baseCurr), 2);
          posMap[tx.ticker].shares = Fin.round(posMap[tx.ticker].shares - shares, 4);
          posMap[tx.ticker].costNative = Fin.round(posMap[tx.ticker].costNative - soldCostNative, 2);
          if (posMap[tx.ticker].shares <= 0.0001) {
            posMap[tx.ticker] = { shares: 0, costNative: 0, avgNative: 0, currency: tCurr };
          } else {
            posMap[tx.ticker].avgNative = posMap[tx.ticker].costNative / posMap[tx.ticker].shares;
          }
        }
      });

      sortedDiv.filter(d => (d.payDate || '').slice(0, 7) <= monthStr).forEach(d => {
        const dCurr = d.currency || state.prices[d.ticker]?.currency || MarketAPI.getStaticProfile(d.ticker).currency || baseCurr;
        const amtBase = Fin.convertCurrency(d.totalAmount || 0, dCurr, baseCurr);
        cumDividends = Fin.round(cumDividends + amtBase, 2);
        if (!d.isDrip) {
          monthCash = Fin.round(monthCash + amtBase, 2);
        }
      });

      Object.keys(posMap).forEach(ticker => {
        const p = posMap[ticker];
        if (p.shares > 0.0001) {
          const hist = state.historicalPrices[ticker] || [];
          let closePrice = state.prices[ticker]?.price || p.avgNative;
          const exact = hist.find(item => item.month === monthStr);
          if (exact) {
            closePrice = exact.close;
          } else if (hist.length > 0) {
            const prior = hist.filter(item => item.month <= monthStr);
            closePrice = prior.length > 0 ? prior[prior.length - 1].close : hist[0].close;
          }
          monthMarketVal += Fin.convertCurrency(p.shares * closePrice, p.currency, baseCurr);
          monthCostBasis += Fin.convertCurrency(p.costNative, p.currency, baseCurr);
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
        monthMarketVal += Fin.convertCurrency(h.shares * closePrice, h.currency, baseCurr);
        monthCostBasis += h.costBasisBase;
      });
      sortedDiv.filter(d => (d.payDate || '').slice(0, 7) <= monthStr).forEach(d => {
        const dCurr = d.currency || state.prices[d.ticker]?.currency || MarketAPI.getStaticProfile(d.ticker).currency || baseCurr;
        cumDividends = Fin.round(cumDividends + Fin.convertCurrency(d.totalAmount || 0, dCurr, baseCurr), 2);
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
        emptyText.textContent = 'No real historical monthly price data available yet. Populate historical_prices.json (via update_historical_prices.py or GitHub Actions) or click "Sync Monthly API Data".';
      } else {
        emptyText.textContent = 'Record a stock trade and sync real historical prices (or load historical_prices.json) to view your monthly portfolio balance and return.';
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
  const pm = typeof computeStockPriceMetrics === 'function' ? computeStockPriceMetrics(ticker, priceObj.price || 0) : null;

  if (titleEl) {
    const sigPill = pm
      ? `<button type="button" onclick="openSignalDetailModal('${ticker}')" class="ml-2 px-2 py-0.5 rounded-full text-[11px] font-mono font-bold border ${
          pm.signalScore >= 78 ? 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30' :
          pm.signalScore >= 64 ? 'bg-teal-500/15 text-teal-500 border-teal-500/30' :
          pm.signalScore >= 42 ? 'bg-slate-500/15 text-slate-500 border-slate-500/30' :
          'bg-amber-500/15 text-amber-500 border-amber-500/30'
        }">${pm.signalLabel} (${pm.signalScore}/100)</button>`
      : '';
    titleEl.innerHTML = `<span class="font-mono text-brand-600 dark:text-brand-400">${ticker}</span> <span class="text-slate-400 font-normal">&mdash;</span> <span>${companyName}</span>${sigPill}`;
  }

  if (series.length === 0) {
    if (emptyEl) {
      emptyEl.classList.remove('hidden');
      emptyEl.innerHTML = `
        <i class="fa-solid fa-chart-line text-3xl mb-2 opacity-35"></i>
        <span class="font-medium text-slate-500 dark:text-slate-300">No historical monthly price data available for ${ticker}</span>
        <span class="text-xs text-slate-400 mt-1">Run <code>update_historical_prices.py</code> / GitHub Action to populate <code>historical_prices.json</code> or click "Sync API Quotes".</span>
      `;
    }
    if (subEl) subEl.textContent = `Regime: ${pm?.regime || 'Awaiting History'} • RSI(14): ${pm?.rsi14 ?? '-'} • Next Ex-Date: ${pm?.divInfo?.nextExDate || '-'}`;
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
    subEl.textContent = `${pm?.regime || 'Trend Analysis'} • RSI: ${pm?.rsi14 ?? '-'} • 12M Reg R²: ${pm?.regR2 ?? '-'} • (${sliced.length} months shown • ${currency})`;
  }

  if (statsEl) {
    const chgClass = periodChange >= 0 ? 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20' : 'text-rose-500 bg-rose-500/10 border-rose-500/20';
    const range52Badge = (pm && pm.low52w !== null && pm.high52w !== null)
      ? `<span class="px-2.5 py-1 rounded-lg text-xs font-mono bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
           52W: <strong>${Fin.currency(pm.low52w, false, currency)}</strong> &ndash; <strong>${Fin.currency(pm.high52w, false, currency)}</strong>${pm.pos52wPct !== null ? ` (<strong class="text-brand-500">${pm.pos52wPct.toFixed(1)}%</strong>)` : ''}
         </span>`
      : '';
    const deltasBadge = (pm && (pm.momPct !== null || pm.qoqPct !== null || pm.yoyPct !== null))
      ? `<span class="px-2.5 py-1 rounded-lg text-xs font-mono bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
           MoM: <strong class="${(pm.momPct || 0) >= 0 ? 'text-emerald-500' : 'text-rose-500'}">${pm.momPct !== null ? Fin.percent(pm.momPct, true) : '-'}</strong> &bull;
           QoQ: <strong class="${(pm.qoqPct || 0) >= 0 ? 'text-emerald-500' : 'text-rose-500'}">${pm.qoqPct !== null ? Fin.percent(pm.qoqPct, true) : '-'}</strong> &bull;
           YoY: <strong class="${(pm.yoyPct || 0) >= 0 ? 'text-emerald-500' : 'text-rose-500'}">${pm.yoyPct !== null ? Fin.percent(pm.yoyPct, true) : '-'}</strong>
         </span>`
      : '';
    statsEl.innerHTML = `
      <span class="px-2.5 py-1 rounded-lg text-xs font-mono font-bold border ${chgClass}">
        ${periodTag} Change: ${Fin.percent(periodChangePct, true)} (${Fin.currency(periodChange, true, currency)})
      </span>
      <span class="px-2.5 py-1 rounded-lg text-xs font-mono bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
        ${periodTag} High: <strong>${Fin.currency(periodHigh, false, currency)}</strong> &bull; Low: <strong>${Fin.currency(periodLow, false, currency)}</strong>
      </span>
      ${range52Badge}
      ${deltasBadge}
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

  // Overlay 1: Rolling Moving Average (3M & 10M on monthly chart) when enabled in Settings
  if (state?.settings?.chartShowSma !== false && closeData.length >= 4) {
    const smaShortSeries = closeData.map((_, idx) => {
      const sub = closeData.slice(Math.max(0, idx - 2), idx + 1);
      return Fin.round(sub.reduce((a, b) => a + b, 0) / sub.length, 3);
    });
    datasets.push({
      label: '3M Moving Avg (Short Trend)',
      data: smaShortSeries,
      borderColor: '#38bdf8',
      borderWidth: 1.5,
      borderDash: [3, 3],
      pointRadius: 0,
      fill: false,
      tension: 0.3
    });
  }

  // Overlay 2: Log-Linear Regression Trend Channel (+1σ / -1σ) when enabled in Settings
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

    datasets.push({
      label: 'Reg Trend Upper (+1σ)',
      data: regUpper,
      borderColor: 'rgba(99, 102, 241, 0.45)',
      borderDash: [4, 4],
      borderWidth: 1.2,
      pointRadius: 0,
      fill: false
    });
    datasets.push({
      label: 'Reg Trend Lower (-1σ)',
      data: regLower,
      borderColor: 'rgba(99, 102, 241, 0.45)',
      borderDash: [4, 4],
      borderWidth: 1.2,
      pointRadius: 0,
      fill: false
    });
  }

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

  const months = Object.keys(monthlyMap).sort();
  const totals = months.map(m => Fin.round(monthlyMap[m], 2));
  document.getElementById('chart-div-total-badge').textContent = `${Fin.currency(portfolio.totalDividendsEarned, false, baseCurr)} Total`;

  const isDark = document.documentElement.classList.contains('dark');
  charts.dividends = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: months.length > 0 ? months : ['No Dividends Logged'],
      datasets: [{
        label: `Monthly Dividend (${baseCurr})`,
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
          ticks: { color: isDark ? '#94a3b8' : '#64748b', font: { size: 10 }, callback: (v) => Fin.currency(v, false, baseCurr) }
        }
      },
      plugins: { legend: { display: false } }
    }
  });
}

function renderPnlBreakdownChart() {
  const ctx = document.getElementById('chart-pnl-breakdown');
  const baseCurr = portfolio?.baseCurrency || state?.settings?.currency || 'HKD';
  if (charts.pnlBreakdown) charts.pnlBreakdown.destroy();

  const tickers = Array.from(new Set([
    ...portfolio.activeHoldings.map(h => h.ticker),
    ...Object.keys(portfolio.allHoldingsMap).filter(t => (portfolio.allHoldingsMap[t].realizedGain || 0) !== 0)
  ]));

  const unrealizedSeries = tickers.map(t => {
    const active = portfolio.activeHoldings.find(h => h.ticker === t);
    return active ? Fin.convertCurrency(active.unrealizedGain, active.currency, baseCurr) : 0;
  });
  const realizedSeries = tickers.map(t => {
    const rg = portfolio.allHoldingsMap[t]?.realizedGain || 0;
    const tCurr = state.prices[t]?.currency || MarketAPI.getStaticProfile(t).currency || baseCurr;
    return Fin.convertCurrency(rg, tCurr, baseCurr);
  });

  const isDark = document.documentElement.classList.contains('dark');
  charts.pnlBreakdown = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: tickers.length > 0 ? tickers : ['No Positions'],
      datasets: [
        { label: `Unrealized P&L (${baseCurr})`, data: unrealizedSeries.length > 0 ? unrealizedSeries : [0], backgroundColor: '#10b981', borderRadius: 5 },
        { label: `Realized P&L (${baseCurr})`, data: realizedSeries.length > 0 ? realizedSeries : [0], backgroundColor: '#6366f1', borderRadius: 5 }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { grid: { display: false }, ticks: { color: isDark ? '#94a3b8' : '#64748b', font: { size: 10 } } },
        y: {
          grid: { color: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' },
          ticks: { color: isDark ? '#94a3b8' : '#64748b', font: { size: 10 }, callback: (v) => Fin.currency(v, true, baseCurr) }
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
