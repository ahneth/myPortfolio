/**
 * @file charts.js
 * @module PortfolioChartsModule
 * @version 2.1.0
 * @build 20261018_1158
 * @description Chart.js controllers for Monthly Historical Price/Portfolio Trends, Asset Allocation, Dividends, and P&L Breakdown.
 */

// ============================================================================
// 7. CHART.JS GRAPHICAL ANALYSIS (INCLUDING MONTHLY HISTORICAL TRENDS)
// ============================================================================
function renderCharts() {
  renderMonthlyHistoryChart();
  renderAllocationChart();
  renderDividendsChart();
  renderPnlBreakdownChart();
}

function renderMonthlyHistoryChart() {
  const ctx = document.getElementById('chart-monthly-history');
  const emptyOverlay = document.getElementById('chart-history-empty');
  const emptyText = document.getElementById('chart-history-empty-text');
  const subtitle = document.getElementById('historical-chart-subtitle');
  const target = document.getElementById('history-target-select')?.value || 'PORTFOLIO';

  if (charts.monthlyHistory) charts.monthlyHistory.destroy();

  const isDark = document.documentElement.classList.contains('dark');
  const isMobile = DeviceDetector.profile.effectiveMode === 'mobile';

  // CASE A: INDIVIDUAL STOCK MONTHLY HISTORICAL TREND
  if (target !== 'PORTFOLIO') {
    const series = state.historicalPrices[target] || [];
    if (series.length === 0) {
      emptyOverlay.classList.remove('hidden');
      emptyText.textContent = `No monthly historical data cached for ${target} yet. Click "Fetch Monthly API Data" above to download monthly closing prices.`;
      return;
    }
    emptyOverlay.classList.add('hidden');

    const sliced = series.slice(-historyRangeMonths);
    const labels = sliced.map(r => r.month);
    const closeData = sliced.map(r => r.close);

    const holding = portfolio.activeHoldings.find(h => h.ticker === target);
    const watched = state.watchlist.find(w => w.ticker === target);
    const refValue = holding ? holding.avgCost : (watched ? watched.targetBuyPrice : null);
    const refLabel = holding ? `Your Avg Cost (${Fin.currency(refValue)})` : (watched ? `Target Buy (${Fin.currency(refValue)})` : null);

    subtitle.textContent = `${target} — Monthly Historical Adjusted Closing Prices (${sliced.length} months shown)`;

    const datasets = [
      {
        label: `${target} Monthly Close`,
        data: closeData,
        borderColor: '#10b981',
        backgroundColor: 'rgba(16, 185, 129, 0.12)',
        fill: true,
        tension: 0.3,
        pointRadius: isMobile ? 2 : 3.5,
        pointBackgroundColor: '#10b981'
      }
    ];

    if (refValue) {
      datasets.push({
        label: refLabel,
        data: labels.map(() => refValue),
        borderColor: '#6366f1',
        borderDash: [6, 6],
        borderWidth: 2,
        pointRadius: 0,
        fill: false
      });
    }

    charts.monthlyHistory = new Chart(ctx, {
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
    return;
  }

  // CASE B: ENTIRE PORTFOLIO AGGREGATE MONTHLY TREND
  const heldTickers = portfolio.activeHoldings.map(h => h.ticker);
  if (heldTickers.length === 0) {
    // If no active holdings yet, automatically display 2800.HK (or first cached ticker) monthly trend so the chart is immediately useful
    const fallbackTicker = state.historicalPrices['2800.HK']?.length ? '2800.HK' : Object.keys(state.historicalPrices)[0];
    const sel = document.getElementById('history-target-select');
    if (fallbackTicker && sel) {
      sel.value = fallbackTicker;
      return renderMonthlyHistoryChart();
    }
    emptyOverlay.classList.remove('hidden');
    emptyText.textContent = 'Record your first stock trade and click "Fetch Monthly API Data" to view monthly historical portfolio trends.';
    return;
  }

  const monthSet = new Set();
  heldTickers.forEach(t => {
    (state.historicalPrices[t] || []).forEach(r => monthSet.add(r.month));
  });

  state.transactions.forEach(tx => {
    if (tx.date) monthSet.add(tx.date.slice(0, 7));
  });

  const allMonths = Array.from(monthSet).sort().slice(-historyRangeMonths);
  if (allMonths.length === 0) {
    emptyOverlay.classList.remove('hidden');
    emptyText.textContent = 'Click "Fetch Monthly API Data" to retrieve monthly historical prices for your holdings.';
    return;
  }
  emptyOverlay.classList.add('hidden');
  subtitle.textContent = `Aggregate Portfolio Historical Valuation across ${allMonths.length} months`;

  const portfolioMonthlyValues = [];
  const portfolioCostSeries = [];

  allMonths.forEach(monthStr => {
    let monthMarketVal = 0;
    portfolio.activeHoldings.forEach(h => {
      const hist = state.historicalPrices[h.ticker] || [];
      let priceForMonth = h.currentPrice;
      const exact = hist.find(item => item.month === monthStr);
      if (exact) {
        priceForMonth = exact.close;
      } else if (hist.length > 0) {
        const prior = hist.filter(item => item.month <= monthStr);
        priceForMonth = prior.length > 0 ? prior[prior.length - 1].close : hist[0].close;
      }
      monthMarketVal += h.shares * priceForMonth;
    });

    portfolioMonthlyValues.push(Fin.round(monthMarketVal, 2));
    portfolioCostSeries.push(Fin.round(portfolio.totalStockCostBasis, 2));
  });

  charts.monthlyHistory = new Chart(ctx, {
    type: 'line',
    data: {
      labels: allMonths,
      datasets: [
        {
          label: 'Portfolio Holdings Value ($)',
          data: portfolioMonthlyValues,
          borderColor: '#10b981',
          backgroundColor: 'rgba(16, 185, 129, 0.14)',
          fill: true,
          tension: 0.32,
          pointRadius: isMobile ? 2 : 3.5,
          pointBackgroundColor: '#10b981'
        },
        {
          label: 'Active Cost Basis ($)',
          data: portfolioCostSeries,
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
window.renderAllocationChart = renderAllocationChart;
window.renderDividendsChart = renderDividendsChart;
window.renderPnlBreakdownChart = renderPnlBreakdownChart;
