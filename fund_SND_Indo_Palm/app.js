/**
 * Indonesia Palm Oil Supply & Demand Institutional Intelligence Dashboard
 * Pure client-side state management, Chart.js integrations, and interactive analytics
 */

(function () {
  'use strict';

  // Global Dashboard State
  const state = {
    data: window.INDO_DATA || null,
    activeTab: 'tab-indosnd',
    selectedYears: new Set([2021, 2022, 2023, 2024, 2025, 2026, 2027]),
    availableYears: [2020, 2021, 2022, 2023, 2024, 2025, 2026, 2027],
    sndGroup: 'palm',
    sndView: 'balance',
    gapkiMode: 'official',
    prodIsland: 'all',
    bpdpksSec: 'fund_balance',
    exportsView: 'countries',
    countrySearch: '',
    simPogo: 217.7,
    simLevy: 200,
    charts: {}
  };

  const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sept', 'Oct', 'Nov', 'Dec'];
  const MONTH_KEYS = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];

  const PALM_COLORS = [
    '#059669', '#2563eb', '#d97706', '#9333ea', '#dc2626', '#0891b2', '#4f46e5', '#ea580c'
  ];

  // ---------------------------------------------------------------------------
  // UTILITY HELPERS
  // ---------------------------------------------------------------------------
  function fmtNum(val, dec = 0) {
    if (val === null || val === undefined || isNaN(val) || val === '') return '&mdash;';
    const num = Number(val);
    return num.toLocaleString('en-US', {
      minimumFractionDigits: dec,
      maximumFractionDigits: dec
    });
  }

  function fmtUSD(val, dec = 1) {
    if (val === null || val === undefined || isNaN(val)) return '&mdash;';
    const num = Number(val);
    const sign = num < 0 ? '&minus;$' : '$';
    return `${sign}${Math.abs(num).toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec })}M`;
  }

  function fmtPct(val, dec = 1) {
    if (val === null || val === undefined || isNaN(val)) return '&mdash;';
    const num = Number(val) * (Math.abs(Number(val)) < 2 ? 100 : 1);
    return `${num.toFixed(dec)}%`;
  }

  function destroyChart(id) {
    if (state.charts[id]) {
      state.charts[id].destroy();
      delete state.charts[id];
    }
  }

  // ---------------------------------------------------------------------------
  // INITIALIZATION
  // ---------------------------------------------------------------------------
  document.addEventListener('DOMContentLoaded', () => {
    if (!state.data) {
      console.error('INDO_DATA not loaded!');
      return;
    }
    initYearSlicer();
    initNavigationTabs();
    initTabControls();
    initPogoCalculator();
    initExportButtons();
    renderAll();
  });

  // ---------------------------------------------------------------------------
  // YEAR SLICER
  // ---------------------------------------------------------------------------
  function initYearSlicer() {
    const container = document.getElementById('year-pills-container');
    container.innerHTML = '';

    state.availableYears.forEach(yr => {
      const pill = document.createElement('div');
      pill.className = `year-pill ${state.selectedYears.has(yr) ? 'active' : ''}`;
      pill.textContent = yr;
      pill.dataset.year = yr;
      pill.addEventListener('click', () => {
        if (state.selectedYears.has(yr)) {
          if (state.selectedYears.size > 1) state.selectedYears.delete(yr);
        } else {
          state.selectedYears.add(yr);
        }
        updateSlicerUI();
        renderActiveTab();
      });
      container.appendChild(pill);
    });

    document.querySelectorAll('.preset-btn[data-preset]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.preset-btn[data-preset]').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        const preset = e.target.dataset.preset;
        if (preset === 'all') {
          state.selectedYears = new Set([2021, 2022, 2023, 2024, 2025, 2026, 2027]);
        } else if (preset === 'last3') {
          state.selectedYears = new Set([2024, 2025, 2026]);
        } else if (preset === 'forecast') {
          state.selectedYears = new Set([2025, 2026, 2027]);
        } else if (preset === 'full_history') {
          state.selectedYears = new Set(state.availableYears);
        }
        updateSlicerUI();
        renderActiveTab();
      });
    });
  }

  function updateSlicerUI() {
    document.querySelectorAll('.year-pill').forEach(pill => {
      const yr = parseInt(pill.dataset.year);
      if (state.selectedYears.has(yr)) {
        pill.classList.add('active');
      } else {
        pill.classList.remove('active');
      }
    });
  }

  // ---------------------------------------------------------------------------
  // NAVIGATION TABS
  // ---------------------------------------------------------------------------
  function initNavigationTabs() {
    document.querySelectorAll('.main-tabs .tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.main-tabs .tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.activeTab = btn.dataset.tab;

        document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
        const activePanel = document.getElementById(state.activeTab);
        if (activePanel) activePanel.classList.add('active');

        renderActiveTab();
      });
    });
  }

  function initTabControls() {
    // Tab 1 controls
    document.querySelectorAll('#snd-group-toggle .seg-btn').forEach(b => {
      b.addEventListener('click', (e) => {
        document.querySelectorAll('#snd-group-toggle .seg-btn').forEach(x => x.classList.remove('active'));
        e.target.classList.add('active');
        state.sndGroup = e.target.dataset.group;
        renderSndTab();
      });
    });

    document.querySelectorAll('#snd-view-toggle .seg-btn').forEach(b => {
      b.addEventListener('click', (e) => {
        document.querySelectorAll('#snd-view-toggle .seg-btn').forEach(x => x.classList.remove('active'));
        e.target.classList.add('active');
        state.sndView = e.target.dataset.view;
        renderSndTab();
      });
    });

    // Tab 2 controls
    document.querySelectorAll('#gapki-view-toggle .seg-btn').forEach(b => {
      b.addEventListener('click', (e) => {
        document.querySelectorAll('#gapki-view-toggle .seg-btn').forEach(x => x.classList.remove('active'));
        e.target.classList.add('active');
        state.gapkiMode = e.target.dataset.mode;
        renderGapkiTab();
      });
    });

    // Tab 3 controls
    document.querySelectorAll('#prod-island-toggle .seg-btn').forEach(b => {
      b.addEventListener('click', (e) => {
        document.querySelectorAll('#prod-island-toggle .seg-btn').forEach(x => x.classList.remove('active'));
        e.target.classList.add('active');
        state.prodIsland = e.target.dataset.island;
        renderProductionTab();
      });
    });

    // Tab 4 controls
    document.querySelectorAll('#bpdpks-view-toggle .seg-btn').forEach(b => {
      b.addEventListener('click', (e) => {
        document.querySelectorAll('#bpdpks-view-toggle .seg-btn').forEach(x => x.classList.remove('active'));
        e.target.classList.add('active');
        state.bpdpksSec = e.target.dataset.sec;
        renderBpdpksTab();
      });
    });

    // Tab 6 controls
    document.querySelectorAll('#exports-view-toggle .seg-btn').forEach(b => {
      b.addEventListener('click', (e) => {
        document.querySelectorAll('#exports-view-toggle .seg-btn').forEach(x => x.classList.remove('active'));
        e.target.classList.add('active');
        state.exportsView = e.target.dataset.view;
        renderExportsTab();
      });
    });

    const searchInput = document.getElementById('input-country-search');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        state.countrySearch = e.target.value.toLowerCase().trim();
        renderExportsTab();
      });
    }
  }

  // ---------------------------------------------------------------------------
  // EXPORT BUTTONS
  // ---------------------------------------------------------------------------
  function initExportButtons() {
    const csvBtn = document.getElementById('btn-export-csv');
    if (csvBtn) {
      csvBtn.addEventListener('click', exportCsv);
    }
    const jsonBtn = document.getElementById('btn-download-json');
    if (jsonBtn) {
      jsonBtn.addEventListener('click', () => {
        const blob = new Blob([JSON.stringify(state.data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `indonesia_palm_oil_master_${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
      });
    }
  }

  function exportCsv() {
    if (!state.data) return;
    const seriesList = state.data.indosnd.series;
    const months = state.data.indosnd.months;
    const years = state.data.indosnd.years;

    let csv = ['Group,Attribute,SubAttribute,' + months.join(',') + ',' + years.map(y => `Total_${y}`).join(',')];

    seriesList.forEach(s => {
      const row = [
        `"${s.group}"`,
        `"${s.attribute}"`,
        `"${s.subattribute}"`,
        ...months.map(m => s.monthly[m] !== undefined && s.monthly[m] !== null ? s.monthly[m] : ''),
        ...years.map(y => s.annual[String(y)] !== undefined && s.annual[String(y)] !== null ? s.annual[String(y)] : '')
      ];
      csv.push(row.join(','));
    });

    const blob = new Blob([csv.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `indonesia_palm_oil_snd_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ---------------------------------------------------------------------------
  // MASTER RENDER DISPATCHER
  // ---------------------------------------------------------------------------
  function renderAll() {
    renderSndTab();
    renderGapkiTab();
    renderProductionTab();
    renderBpdpksTab();
    renderPogoTab();
    renderExportsTab();
    renderSeasonalityTab();
  }

  function renderActiveTab() {
    switch (state.activeTab) {
      case 'tab-indosnd': renderSndTab(); break;
      case 'tab-gapki': renderGapkiTab(); break;
      case 'tab-production': renderProductionTab(); break;
      case 'tab-bpdpks': renderBpdpksTab(); break;
      case 'tab-pogo': renderPogoTab(); break;
      case 'tab-exports': renderExportsTab(); break;
      case 'tab-seasonality': renderSeasonalityTab(); break;
    }
  }

  // ---------------------------------------------------------------------------
  // TAB 1: INDO SND
  // ---------------------------------------------------------------------------
  function renderSndTab() {
    const container = document.getElementById('snd-table-container');
    if (!container || !state.data) return;

    const allSeries = state.data.indosnd.series;
    const selYears = Array.from(state.selectedYears).sort();

    // Filter by group if requested
    let filteredSeries = allSeries;
    if (state.sndGroup === 'palm') {
      filteredSeries = allSeries.filter(s => s.group.toLowerCase().includes('palm'));
    } else if (state.sndGroup === 'lauric') {
      filteredSeries = allSeries.filter(s => s.group.toLowerCase().includes('lauric'));
    } else if (state.sndGroup === 'oleo') {
      filteredSeries = allSeries.filter(s => s.group.toLowerCase().includes('oleo') || s.group.toLowerCase().includes('glycerin') || s.group.toLowerCase().includes('meal'));
    }

    if (state.sndView === 'balance') {
      // Balance sheet view: Year -> Months & Total
      let html = '<table class="snd-matrix-table"><thead><tr>';
      html += '<th class="matrix-col-metric">Fundamental Metric</th>';

      selYears.forEach(yr => {
        MONTH_NAMES.forEach(m => {
          html += `<th class="matrix-col-month">${m} '${String(yr).slice(2)}</th>`;
        });
        html += `<th class="matrix-col-total">Total ${yr}</th>`;
      });
      html += '</tr></thead><tbody>';

      let currentGroup = '';
      filteredSeries.forEach(s => {
        if (s.group !== currentGroup) {
          currentGroup = s.group;
          const colSpan = 1 + selYears.length * 13;
          html += `<tr class="row-header-group"><td colspan="${colSpan}" style="text-align: left; padding: 6px 10px;">&bull; ${currentGroup.toUpperCase()}</td></tr>`;
        }

        const isHighlight = s.attribute.includes('Total') || s.attribute.includes('Stocks') || s.subattribute.includes('Total') || s.attribute.includes('Endstock');
        const rowClass = isHighlight ? 'row-total-accent' : '';

        html += `<tr class="${rowClass}">`;
        html += `<td class="matrix-col-metric" title="${s.group} / ${s.attribute} / ${s.subattribute}">${s.display_name}</td>`;

        selYears.forEach(yr => {
          MONTH_KEYS.forEach(mKey => {
            const dateKey = `${yr}-${mKey}`;
            const val = s.monthly[dateKey];
            const dec = s.id.includes('Stock_Use') ? 2 : 0;
            html += `<td class="matrix-col-month">${fmtNum(val, dec)}</td>`;
          });
          const tot = s.annual[String(yr)];
          const dec = s.id.includes('Stock_Use') ? 2 : 0;
          html += `<td class="matrix-col-total">${fmtNum(tot, dec)}</td>`;
        });

        html += '</tr>';
      });

      html += '</tbody></table>';
      container.innerHTML = html;
    } else {
      // Monthly Matrix view: Metric -> 2021..2027 by Month
      let html = '<table class="snd-matrix-table"><thead><tr>';
      html += '<th class="matrix-col-metric">Metric / Year</th>';
      selYears.forEach(yr => {
        html += `<th class="matrix-col-total" style="text-align:center;">${yr}</th>`;
      });
      html += '</tr></thead><tbody>';

      filteredSeries.forEach(s => {
        const isHighlight = s.attribute.includes('Total') || s.attribute.includes('Endstock');
        html += `<tr class="row-header-group"><td class="matrix-col-metric" colspan="${selYears.length + 1}" style="text-align:left;">&bull; ${s.display_name} (${s.group} &ndash; ${s.attribute})</td></tr>`;

        MONTH_NAMES.forEach((mName, mIdx) => {
          const mKey = MONTH_KEYS[mIdx];
          html += `<tr><td class="matrix-col-metric" style="padding-left: 20px;">${mName}</td>`;
          selYears.forEach(yr => {
            const dateKey = `${yr}-${mKey}`;
            const val = s.monthly[dateKey];
            const dec = s.id.includes('Stock_Use') ? 2 : 0;
            html += `<td class="matrix-col-total">${fmtNum(val, dec)}</td>`;
          });
          html += '</tr>';
        });

        // Annual Total row
        html += `<tr class="row-total-accent"><td class="matrix-col-metric" style="font-weight:700;">TOTAL / AVG</td>`;
        selYears.forEach(yr => {
          const tot = s.annual[String(yr)];
          const dec = s.id.includes('Stock_Use') ? 2 : 0;
          html += `<td class="matrix-col-total">${fmtNum(tot, dec)}</td>`;
        });
        html += '</tr>';
      });

      html += '</tbody></table>';
      container.innerHTML = html;
    }

    renderSndCharts();
  }

  function renderSndCharts() {
    if (!state.data) return;
    const seriesList = state.data.indosnd.series;
    const selYears = Array.from(state.selectedYears).sort();

    // Months across selected years
    const chartMonths = [];
    selYears.forEach(yr => {
      MONTH_KEYS.forEach(mk => chartMonths.push(`${yr}-${mk}`));
    });

    const prodSeries = seriesList.find(s => s.id === 'Palm_Production_CPO');
    const demandSeries = seriesList.find(s => s.id === 'Palm_Demand_Total_Demand');
    const endStockSeries = seriesList.find(s => s.id === 'Palm_Endstock_Total_End_Stocks');

    const foodSeries = seriesList.find(s => s.id === 'Palm_Consumption_OTHER_DISP.');
    const bioSeries = seriesList.find(s => s.id === 'Palm_Consumption_BIODIESEL');

    // Chart 1: Overview
    destroyChart('chart-snd-overview');
    const ctx1 = document.getElementById('chart-snd-overview');
    if (ctx1 && prodSeries && demandSeries && endStockSeries) {
      state.charts['chart-snd-overview'] = new Chart(ctx1, {
        type: 'line',
        data: {
          labels: chartMonths,
          datasets: [
            {
              label: 'CPO Production',
              data: chartMonths.map(m => prodSeries.monthly[m] || null),
              borderColor: '#059669',
              backgroundColor: 'rgba(5, 150, 105, 0.1)',
              borderWidth: 2,
              tension: 0.2,
              fill: false
            },
            {
              label: 'Total Demand',
              data: chartMonths.map(m => demandSeries.monthly[m] || null),
              borderColor: '#dc2626',
              borderWidth: 2,
              borderDash: [4, 4],
              tension: 0.2,
              fill: false
            },
            {
              label: 'Ending Stocks',
              data: chartMonths.map(m => endStockSeries.monthly[m] || null),
              borderColor: '#2563eb',
              backgroundColor: 'rgba(37, 99, 235, 0.15)',
              borderWidth: 2,
              fill: true,
              tension: 0.2,
              yAxisID: 'y'
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: 'index', intersect: false },
          plugins: {
            legend: { position: 'top', labels: { boxWidth: 12, font: { family: 'Inter', size: 11 } } },
            tooltip: {
              callbacks: {
                label: ctx => `${ctx.dataset.label}: ${fmtNum(ctx.parsed.y)} MT`
              }
            }
          },
          scales: {
            x: { grid: { display: false }, ticks: { maxTicksLimit: 14, font: { family: 'JetBrains Mono', size: 10 } } },
            y: {
              grid: { color: '#e2e8f0' },
              ticks: { callback: v => (v / 1e6).toFixed(1) + 'M MT', font: { family: 'JetBrains Mono', size: 10 } }
            }
          }
        }
      });
    }

    // Chart 2: Domestic Consumption
    destroyChart('chart-snd-consumption');
    const ctx2 = document.getElementById('chart-snd-consumption');
    if (ctx2 && bioSeries) {
      state.charts['chart-snd-consumption'] = new Chart(ctx2, {
        type: 'bar',
        data: {
          labels: chartMonths,
          datasets: [
            {
              label: 'Biodiesel Mandate Offtake',
              data: chartMonths.map(m => bioSeries.monthly[m] || null),
              backgroundColor: '#059669'
            },
            {
              label: 'Food & Other Disappearance',
              data: chartMonths.map(m => (foodSeries ? foodSeries.monthly[m] : 0) || null),
              backgroundColor: '#d97706'
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: 'top', labels: { boxWidth: 12, font: { family: 'Inter', size: 11 } } },
            tooltip: {
              callbacks: {
                label: ctx => `${ctx.dataset.label}: ${fmtNum(ctx.parsed.y)} MT`
              }
            }
          },
          scales: {
            x: { stacked: true, grid: { display: false }, ticks: { maxTicksLimit: 14, font: { family: 'JetBrains Mono', size: 10 } } },
            y: {
              stacked: true,
              grid: { color: '#e2e8f0' },
              ticks: { callback: v => (v / 1e6).toFixed(1) + 'M MT', font: { family: 'JetBrains Mono', size: 10 } }
            }
          }
        }
      });
    }
  }

  // ---------------------------------------------------------------------------
  // TAB 2: GAPKI S&D
  // ---------------------------------------------------------------------------
  function renderGapkiTab() {
    const container = document.getElementById('gapki-table-container');
    if (!container || !state.data) return;

    const items = state.data.gapki.items;
    const selYears = Array.from(state.selectedYears).sort();

    let html = '<table class="institutional-table"><thead><tr>';
    html += '<th class="matrix-col-metric">GAPKI Line Item</th>';
    selYears.forEach(yr => {
      MONTH_NAMES.forEach(m => {
        html += `<th class="matrix-col-month">${m} '${String(yr).slice(2)}</th>`;
      });
      html += `<th class="matrix-col-total">Total ${yr}</th>`;
    });
    html += '</tr></thead><tbody>';

    items.forEach(item => {
      const isTotal = item.name.includes('Total') || item.name.includes('Stocks');
      const rowClass = isTotal ? 'row-total-accent' : '';

      html += `<tr class="${rowClass}">`;
      html += `<td class="matrix-col-metric">${item.name}</td>`;

      selYears.forEach(yr => {
        MONTH_KEYS.forEach(mk => {
          const dateKey = `${yr}-${mk}`;
          let val = item.monthly[dateKey];
          html += `<td class="matrix-col-month">${fmtNum(val)}</td>`;
        });
        const tot = item.annual[String(yr)];
        html += `<td class="matrix-col-total">${fmtNum(tot)}</td>`;
      });

      html += '</tr>';
    });

    html += '</tbody></table>';
    container.innerHTML = html;

    renderGapkiCharts();
  }

  function renderGapkiCharts() {
    if (!state.data) return;
    const items = state.data.gapki.items;
    const months = state.data.gapki.months.filter(m => {
      const yr = parseInt(m.slice(0, 4));
      return state.selectedYears.has(yr);
    });

    const prod = items.find(i => i.name === 'Total Production');
    const stocks = items.find(i => i.name === 'Closing Stocks');
    const exportsItem = items.find(i => i.name === 'Total Exports');
    const cpoExp = items.find(i => i.name === 'Export - CPO');
    const ppoExp = items.find(i => i.name === 'Export - PPO');

    destroyChart('chart-gapki-trend');
    const ctx1 = document.getElementById('chart-gapki-trend');
    if (ctx1 && prod && stocks) {
      state.charts['chart-gapki-trend'] = new Chart(ctx1, {
        type: 'line',
        data: {
          labels: months,
          datasets: [
            {
              label: 'GAPKI Production',
              data: months.map(m => prod.monthly[m] || null),
              borderColor: '#059669',
              borderWidth: 2,
              tension: 0.2
            },
            {
              label: 'GAPKI Ending Stocks',
              data: months.map(m => stocks.monthly[m] || null),
              borderColor: '#2563eb',
              backgroundColor: 'rgba(37, 99, 235, 0.1)',
              fill: true,
              borderWidth: 2,
              tension: 0.2
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: 'top', labels: { boxWidth: 12 } }
          },
          scales: {
            x: { ticks: { maxTicksLimit: 12, font: { family: 'JetBrains Mono', size: 10 } } },
            y: { ticks: { callback: v => (v / 1e6).toFixed(1) + 'M MT', font: { family: 'JetBrains Mono', size: 10 } } }
          }
        }
      });
    }

    destroyChart('chart-gapki-exports');
    const ctx2 = document.getElementById('chart-gapki-exports');
    if (ctx2 && cpoExp && ppoExp) {
      state.charts['chart-gapki-exports'] = new Chart(ctx2, {
        type: 'bar',
        data: {
          labels: months,
          datasets: [
            {
              label: 'Processed Palm Oil (PPO)',
              data: months.map(m => ppoExp.monthly[m] || null),
              backgroundColor: '#059669'
            },
            {
              label: 'Crude Palm Oil (CPO)',
              data: months.map(m => cpoExp.monthly[m] || null),
              backgroundColor: '#d97706'
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            x: { stacked: true, ticks: { maxTicksLimit: 12, font: { family: 'JetBrains Mono', size: 10 } } },
            y: { stacked: true, ticks: { callback: v => (v / 1e6).toFixed(1) + 'M MT', font: { family: 'JetBrains Mono', size: 10 } } }
          }
        }
      });
    }
  }

  // ---------------------------------------------------------------------------
  // TAB 3: PRODUCTION & ISLAND FORECAST
  // ---------------------------------------------------------------------------
  function renderProductionTab() {
    const container = document.getElementById('prod-table-container');
    if (!container || !state.data) return;

    const regions = state.data.production.regions;
    const selYears = Array.from(state.selectedYears).sort();

    let displayRegions = regions;
    if (state.prodIsland !== 'all') {
      displayRegions = regions.filter(r => r.region.toLowerCase() === state.prodIsland.toLowerCase() || r.region === 'Grand Total');
    }

    let html = '<table class="institutional-table"><thead><tr>';
    html += '<th class="matrix-col-metric">Region / Month</th>';
    selYears.forEach(yr => {
      html += `<th class="matrix-col-total" style="text-align:right;">${yr}</th>`;
    });
    html += '</tr></thead><tbody>';

    displayRegions.forEach(reg => {
      const isGrand = reg.region === 'Grand Total';
      html += `<tr class="row-header-group"><td colspan="${selYears.length + 1}" style="text-align:left; font-weight:700;">&bull; ${reg.region.toUpperCase()}</td></tr>`;

      MONTH_NAMES.forEach(m => {
        html += `<tr><td class="matrix-col-metric" style="padding-left: 20px;">${m}</td>`;
        selYears.forEach(yr => {
          const val = reg.monthly[m] ? reg.monthly[m][String(yr)] : null;
          html += `<td class="matrix-col-month">${fmtNum(val)}</td>`;
        });
        html += '</tr>';
      });

      html += `<tr class="row-total-accent"><td class="matrix-col-metric" style="font-weight:700;">ANNUAL TOTAL</td>`;
      selYears.forEach(yr => {
        const tot = reg.annual_totals[String(yr)];
        html += `<td class="matrix-col-total" style="font-weight:700;">${fmtNum(tot)}</td>`;
      });
      html += '</tr>';
    });

    html += '</tbody></table>';
    container.innerHTML = html;

    renderProductionCharts();
  }

  function renderProductionCharts() {
    if (!state.data) return;
    const regions = state.data.production.regions.filter(r => r.region !== 'Grand Total');
    const selYears = Array.from(state.selectedYears).sort().map(String);

    destroyChart('chart-prod-stacked');
    const ctx1 = document.getElementById('chart-prod-stacked');
    if (ctx1) {
      state.charts['chart-prod-stacked'] = new Chart(ctx1, {
        type: 'bar',
        data: {
          labels: selYears,
          datasets: regions.map((reg, idx) => ({
            label: reg.region,
            data: selYears.map(yr => reg.annual_totals[yr] || 0),
            backgroundColor: PALM_COLORS[idx % PALM_COLORS.length]
          }))
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            x: { stacked: true },
            y: { stacked: true, ticks: { callback: v => (v / 1e6).toFixed(0) + 'M MT' } }
          }
        }
      });
    }

    destroyChart('chart-prod-seasonality');
    const ctx2 = document.getElementById('chart-prod-seasonality');
    const grand = state.data.production.regions.find(r => r.region === 'Grand Total');
    if (ctx2 && grand) {
      state.charts['chart-prod-seasonality'] = new Chart(ctx2, {
        type: 'line',
        data: {
          labels: MONTH_NAMES,
          datasets: selYears.map((yr, idx) => ({
            label: yr,
            data: MONTH_NAMES.map(m => grand.monthly[m][yr] || null),
            borderColor: PALM_COLORS[idx % PALM_COLORS.length],
            borderWidth: 2,
            tension: 0.2
          }))
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            y: { ticks: { callback: v => (v / 1e6).toFixed(1) + 'M MT' } }
          }
        }
      });
    }
  }

  // ---------------------------------------------------------------------------
  // TAB 4: BPDPKS FUND & LEVY
  // ---------------------------------------------------------------------------
  function renderBpdpksTab() {
    const container = document.getElementById('bpdpks-table-container');
    if (!container || !state.data) return;

    const bp = state.data.bpdpks;
    const selYears = Array.from(state.selectedYears).sort();

    let items = [];
    if (state.bpdpksSec === 'fund_balance') {
      items = bp.sections.balances.concat(bp.sections.costs.filter(c => c.name.includes('Debit')));
    } else if (state.bpdpksSec === 'costs') {
      items = bp.sections.costs;
    } else {
      items = bp.sections.levy_credits;
    }

    let html = '<table class="institutional-table"><thead><tr>';
    html += '<th class="matrix-col-metric">BPDPKS Item</th>';
    selYears.forEach(yr => {
      MONTH_NAMES.forEach(m => {
        html += `<th class="matrix-col-month">${m} '${String(yr).slice(2)}</th>`;
      });
    });
    html += '</tr></thead><tbody>';

    items.forEach(it => {
      const isTotal = it.name.includes('Balance') || it.name.includes('Total') || it.product === 'Total Credit (mil)';
      const rowClass = isTotal ? 'row-total-accent' : '';

      html += `<tr class="${rowClass}">`;
      html += `<td class="matrix-col-metric">${it.name || it.product}</td>`;

      selYears.forEach(yr => {
        MONTH_KEYS.forEach(mk => {
          const dateKey = `${yr}-${mk}`;
          const val = it.data[dateKey];
          const isUsd = (it.name && it.name.includes('mil')) || (it.product && it.product.includes('mil')) || (it.name && it.name.includes('Balance'));
          html += `<td class="matrix-col-month">${isUsd ? fmtUSD(val) : fmtNum(val)}</td>`;
        });
      });

      html += '</tr>';
    });

    html += '</tbody></table>';
    container.innerHTML = html;

    renderBpdpksCharts();
  }

  function renderBpdpksCharts() {
    if (!state.data) return;
    const bp = state.data.bpdpks;
    const months = bp.months.filter(m => state.selectedYears.has(parseInt(m.slice(0, 4))));

    const closingBal = bp.sections.balances.find(b => b.name === 'Closing Balance');
    const totalCredit = bp.sections.levy_credits.find(l => l.product.includes('Total Credit'));
    const totalDebit = bp.sections.costs.find(c => c.name.includes('Debit'));

    destroyChart('chart-bpdpks-balance');
    const ctx1 = document.getElementById('chart-bpdpks-balance');
    if (ctx1 && closingBal) {
      state.charts['chart-bpdpks-balance'] = new Chart(ctx1, {
        type: 'line',
        data: {
          labels: months,
          datasets: [{
            label: 'Fund Closing Balance (US$ Million)',
            data: months.map(m => closingBal.data[m] || null),
            borderColor: '#059669',
            backgroundColor: 'rgba(5, 150, 105, 0.15)',
            fill: true,
            borderWidth: 2,
            tension: 0.2
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            x: { ticks: { maxTicksLimit: 14 } },
            y: { ticks: { callback: v => '$' + v.toLocaleString() + 'M' } }
          }
        }
      });
    }

    destroyChart('chart-bpdpks-flows');
    const ctx2 = document.getElementById('chart-bpdpks-flows');
    if (ctx2 && totalCredit && totalDebit) {
      state.charts['chart-bpdpks-flows'] = new Chart(ctx2, {
        type: 'bar',
        data: {
          labels: months,
          datasets: [
            {
              label: 'Total Levy Credit (Inflow)',
              data: months.map(m => totalCredit.data[m] || null),
              backgroundColor: '#059669'
            },
            {
              label: 'Total Subsidy Debit (Outflow)',
              data: months.map(m => totalDebit.data[m] || null),
              backgroundColor: '#dc2626'
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            x: { ticks: { maxTicksLimit: 14 } },
            y: { ticks: { callback: v => '$' + v.toLocaleString() + 'M' } }
          }
        }
      });
    }
  }

  // ---------------------------------------------------------------------------
  // TAB 5: POGO SENSITIVITY & SOLVENCY
  // ---------------------------------------------------------------------------
  function initPogoCalculator() {
    const pogoSlider = document.getElementById('pogo-slider-val');
    const levySlider = document.getElementById('levy-slider-val');

    if (pogoSlider) {
      pogoSlider.addEventListener('input', (e) => {
        state.simPogo = parseFloat(e.target.value);
        document.getElementById('pogo-slider-badge').textContent = `${state.simPogo >= 0 ? '+' : ''}${state.simPogo} US$/MT`;
        updatePogoSimulation();
      });
    }

    if (levySlider) {
      levySlider.addEventListener('input', (e) => {
        state.simLevy = parseFloat(e.target.value);
        document.getElementById('levy-slider-badge').textContent = `${state.simLevy} US$ Mil/mo`;
        updatePogoSimulation();
      });
    }

    document.querySelectorAll('.pogo-preset-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.pogo-preset-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        state.simPogo = parseFloat(e.target.dataset.pogo);
        if (pogoSlider) {
          pogoSlider.value = state.simPogo;
          document.getElementById('pogo-slider-badge').textContent = `${state.simPogo >= 0 ? '+' : ''}${state.simPogo} US$/MT`;
        }
        updatePogoSimulation();
      });
    });
  }

  function updatePogoSimulation() {
    if (!state.data) return;
    const pogo = state.data.pogo_sens;
    const baseInputs = pogo.base_inputs;
    const months = pogo.base_months; // 17 months: Aug-26 to Dec-27

    let balance = pogo.assumptions.opening_balance_aug26 || 1400.9;
    let totalNetFlow = 0;

    months.forEach((m, idx) => {
      const psoVol = baseInputs.pso_vol[m] || 650000;
      const transportCost = pogo.assumptions.transport_usd_per_mt || 35;
      const replanting = pogo.assumptions.replanting_usd_mil_mth || 17;

      // POGO Diff subsidy per MT
      const pogoDiff = state.simPogo;
      const subsidyPerMT = Math.max(0, pogoDiff + transportCost);
      const psoDebitMil = (psoVol * subsidyPerMT) / 1e6;
      const totalDebitMil = psoDebitMil + replanting;

      const monthlyCredit = state.simLevy;
      const netFlow = monthlyCredit - totalDebitMil;

      balance += netFlow;
      totalNetFlow += netFlow;
    });

    const balElem = document.getElementById('sim-dec27-balance');
    const statusElem = document.getElementById('sim-solvency-status');
    const flowElem = document.getElementById('sim-17m-cashflow');

    if (balElem) {
      balElem.textContent = fmtUSD(balance);
      balElem.style.color = balance > 1000 ? 'var(--accent-primary)' : (balance > 0 ? '#b45309' : 'var(--accent-red)');
    }

    if (statusElem) {
      if (balance > 1500) {
        statusElem.textContent = 'HIGH SURPLUS (> $1.5B Solvency Buffer)';
        statusElem.style.color = 'var(--accent-primary)';
      } else if (balance > 500) {
        statusElem.textContent = 'SOLVENT ($500M - $1.5B Buffer)';
        statusElem.style.color = 'var(--accent-primary)';
      } else if (balance > 0) {
        statusElem.textContent = 'TIGHT BUFFER ($0 - $500M Reserve)';
        statusElem.style.color = '#b45309';
      } else {
        statusElem.textContent = 'DEFICIT / DEPLETION (Subsidies Exhaust Fund)';
        statusElem.style.color = 'var(--accent-red)';
      }
    }

    if (flowElem) {
      flowElem.innerHTML = fmtUSD(totalNetFlow);
      flowElem.style.color = totalNetFlow >= 0 ? 'var(--accent-primary)' : 'var(--accent-red)';
    }
  }

  function renderPogoTab() {
    if (!state.data) return;
    const pogo = state.data.pogo_sens;

    // 1. Render 17-Month Summary Table
    const summaryContainer = document.getElementById('pogo-summary-container');
    if (summaryContainer) {
      let html = '<table class="institutional-table"><thead><tr>';
      html += '<th class="matrix-col-metric">POGO Scenario</th>';
      html += '<th>POGO (US$/MT)</th>';
      html += '<th>Dec-27 Closing (US$ Mil)</th>';
      html += '<th>Change vs Base</th>';
      html += '<th>Min Balance in Period</th>';
      html += '<th>17-Mth Cumulative Net Flow</th>';
      html += '</tr></thead><tbody>';

      pogo.summary_17m.forEach(sc => {
        const isBase = sc.scenario.includes('Base');
        const rowClass = isBase ? 'row-total-accent' : '';
        const decClosing = sc.dec27_closing;
        const colorClass = decClosing > 1000 ? 'num-positive' : (decClosing < 0 ? 'num-negative' : '');

        html += `<tr class="${rowClass}">`;
        html += `<td class="matrix-col-metric" style="font-weight:600;">${sc.scenario}</td>`;
        html += `<td style="font-family:var(--font-mono); font-weight:600;">${sc.pogo_level >= 0 ? '+' : ''}${sc.pogo_level}</td>`;
        html += `<td class="${colorClass}" style="font-family:var(--font-mono); font-weight:700;">${fmtUSD(decClosing)}</td>`;
        html += `<td style="font-family:var(--font-mono);">${fmtUSD(sc.change_vs_base)}</td>`;
        html += `<td style="font-family:var(--font-mono);">${fmtUSD(sc.min_balance)}</td>`;
        html += `<td class="${sc.total_net_flow_17m >= 0 ? 'num-positive' : 'num-negative'}" style="font-family:var(--font-mono); font-weight:600;">${fmtUSD(sc.total_net_flow_17m)}</td>`;
        html += '</tr>';
      });

      html += '</tbody></table>';
      summaryContainer.innerHTML = html;
    }

    // 2. Render Two-Way Sensitivity Heatmap Table
    const twowayContainer = document.getElementById('pogo-twoway-container');
    if (twowayContainer) {
      const matrix = pogo.two_way_matrix;
      let html = '<table class="institutional-table"><thead><tr>';
      html += '<th class="matrix-col-metric">POGO Level \\ Monthly Levy</th>';
      matrix.levy_levels.forEach(lev => {
        html += `<th>$${lev}M / Month</th>`;
      });
      html += '</tr></thead><tbody>';

      matrix.rows.forEach(r => {
        html += `<tr><td class="matrix-col-metric">${r.pogo_scenario}</td>`;
        matrix.levy_levels.forEach(lev => {
          const val = r.values[String(lev)];
          let heatClass = 'heat-neutral';
          if (val > 2500) heatClass = 'heat-green';
          else if (val > 1000) heatClass = 'heat-light-green';
          else if (val > 0) heatClass = 'heat-yellow';
          else heatClass = 'heat-red';

          html += `<td class="heatmap-cell ${heatClass}">${fmtUSD(val)}</td>`;
        });
        html += '</tr>';
      });

      html += '</tbody></table>';
      twowayContainer.innerHTML = html;
    }

    renderPogoCharts();
    updatePogoSimulation();
  }

  function renderPogoCharts() {
    if (!state.data) return;
    const pogo = state.data.pogo_sens;
    const months = pogo.base_months;

    destroyChart('chart-pogo-trajectories');
    const ctx = document.getElementById('chart-pogo-trajectories');
    if (ctx) {
      const selectedScenarios = pogo.closing_balances.filter(c =>
        c.scenario.includes('Base') || c.scenario.includes('0') || c.scenario.includes('100') ||
        c.scenario.includes('250') || c.scenario.includes('350') || c.scenario.includes('500')
      );

      state.charts['chart-pogo-trajectories'] = new Chart(ctx, {
        type: 'line',
        data: {
          labels: months,
          datasets: selectedScenarios.map((sc, idx) => ({
            label: sc.scenario,
            data: months.map(m => sc.monthly[m] || null),
            borderColor: PALM_COLORS[idx % PALM_COLORS.length],
            borderWidth: sc.scenario.includes('Base') ? 3 : 2,
            borderDash: sc.scenario.includes('Base') ? [] : [4, 3],
            tension: 0.2
          }))
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: 'top', labels: { boxWidth: 12 } }
          },
          scales: {
            y: {
              grid: { color: '#e2e8f0' },
              ticks: { callback: v => '$' + v.toLocaleString() + 'M' }
            }
          }
        }
      });
    }
  }

  // ---------------------------------------------------------------------------
  // TAB 6: BPS EXPORTS
  // ---------------------------------------------------------------------------
  function renderExportsTab() {
    const container = document.getElementById('exports-table-container');
    if (!container || !state.data) return;

    const exportsData = state.data.exports;

    if (state.exportsView === 'countries') {
      document.getElementById('country-search-bar').style.display = 'flex';
      let list = exportsData.countries;
      if (state.countrySearch) {
        list = list.filter(c => c.country.toLowerCase().includes(state.countrySearch));
      }
      const displayList = list.slice(0, 30);
      document.getElementById('country-count-label').textContent = `Showing ${displayList.length} of ${list.length} countries`;

      let html = '<table class="institutional-table"><thead><tr>';
      html += '<th style="width:40px; text-align:center;">#</th>';
      html += '<th class="matrix-col-metric">Destination Country</th>';
      exportsData.years.forEach(yr => {
        html += `<th class="matrix-col-total">${yr} (MT)</th>`;
      });
      html += '<th>26/25 YoY Growth</th>';
      html += '</tr></thead><tbody>';

      displayList.forEach((c, idx) => {
        html += '<tr>';
        html += `<td style="text-align:center; color:var(--text-muted); font-family:var(--font-mono);">${idx + 1}</td>`;
        html += `<td class="matrix-col-metric">${c.country}</td>`;
        exportsData.years.forEach(yr => {
          html += `<td class="matrix-col-total">${fmtNum(c.annual[String(yr)])}</td>`;
        });
        const yoy = c.yoy_26_25;
        const color = yoy >= 1 ? 'num-positive' : 'num-negative';
        html += `<td class="${color}" style="font-family:var(--font-mono); font-weight:600;">${yoy ? (yoy >= 1 ? '+' : '') + fmtPct((yoy - 1) * 100) : '&mdash;'}</td>`;
        html += '</tr>';
      });

      // Grand total
      html += '<tr class="row-total-accent">';
      html += '<td></td><td class="matrix-col-metric" style="font-weight:700;">TOTAL EXPORTS</td>';
      exportsData.years.forEach(yr => {
        html += `<td class="matrix-col-total" style="font-weight:700;">${fmtNum(exportsData.grand_total[String(yr)])}</td>`;
      });
      html += '<td>&mdash;</td></tr>';

      html += '</tbody></table>';
      container.innerHTML = html;
    } else {
      document.getElementById('country-search-bar').style.display = 'none';
      let html = '<table class="institutional-table"><thead><tr>';
      html += '<th class="matrix-col-metric">Product Category</th>';
      exportsData.years.forEach(yr => {
        html += `<th class="matrix-col-total">${yr} (MT)</th>`;
      });
      html += '</tr></thead><tbody>';

      exportsData.products.forEach(p => {
        html += '<tr>';
        html += `<td class="matrix-col-metric">${p.product}</td>`;
        exportsData.years.forEach(yr => {
          html += `<td class="matrix-col-total">${fmtNum(p.annual[String(yr)])}</td>`;
        });
        html += '</tr>';
      });

      html += '</tbody></table>';
      container.innerHTML = html;
    }

    renderExportsCharts();
  }

  function renderExportsCharts() {
    if (!state.data) return;
    const exportsData = state.data.exports;

    // Top 10 Countries by 2025 volume
    destroyChart('chart-exports-top-countries');
    const ctx1 = document.getElementById('chart-exports-top-countries');
    if (ctx1) {
      const top10 = exportsData.countries.slice(0, 10);
      state.charts['chart-exports-top-countries'] = new Chart(ctx1, {
        type: 'bar',
        data: {
          labels: top10.map(c => c.country),
          datasets: [{
            label: '2025 Shipments (MT)',
            data: top10.map(c => c.annual['2025'] || 0),
            backgroundColor: '#059669'
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          indexAxis: 'y',
          plugins: { legend: { display: false } },
          scales: {
            x: { ticks: { callback: v => (v / 1e6).toFixed(1) + 'M MT' } }
          }
        }
      });
    }

    // Top 6 Products across 2022-2026
    destroyChart('chart-exports-products');
    const ctx2 = document.getElementById('chart-exports-products');
    if (ctx2) {
      const topProducts = exportsData.products.slice(0, 6);
      state.charts['chart-exports-products'] = new Chart(ctx2, {
        type: 'bar',
        data: {
          labels: exportsData.years.map(String),
          datasets: topProducts.map((p, idx) => ({
            label: p.product,
            data: exportsData.years.map(yr => p.annual[String(yr)] || 0),
            backgroundColor: PALM_COLORS[idx % PALM_COLORS.length]
          }))
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            x: { stacked: true },
            y: { stacked: true, ticks: { callback: v => (v / 1e6).toFixed(1) + 'M MT' } }
          }
        }
      });
    }
  }

  // ---------------------------------------------------------------------------
  // TAB 7: SEASONALITY & CHARTS
  // ---------------------------------------------------------------------------
  function renderSeasonalityTab() {
    if (!state.data) return;
    const seas = state.data.seasonality;
    const selYears = Array.from(state.selectedYears).sort().map(String);

    // 1. Biodiesel
    destroyChart('chart-season-biodiesel');
    const ctx1 = document.getElementById('chart-season-biodiesel');
    if (ctx1 && seas.biodiesel) {
      state.charts['chart-season-biodiesel'] = new Chart(ctx1, {
        type: 'line',
        data: {
          labels: MONTH_NAMES,
          datasets: selYears.map((yr, idx) => ({
            label: yr,
            data: MONTH_NAMES.map(m => (seas.biodiesel[m] ? seas.biodiesel[m][yr] : null)),
            borderColor: PALM_COLORS[idx % PALM_COLORS.length],
            borderWidth: 2,
            tension: 0.2
          }))
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: { y: { ticks: { callback: v => (v / 1e3).toFixed(0) + 'k MT' } } }
        }
      });
    }

    // 2. Ending Stocks
    destroyChart('chart-season-stocks');
    const ctx2 = document.getElementById('chart-season-stocks');
    if (ctx2 && seas.stocks) {
      state.charts['chart-season-stocks'] = new Chart(ctx2, {
        type: 'line',
        data: {
          labels: MONTH_NAMES,
          datasets: selYears.map((yr, idx) => ({
            label: yr,
            data: MONTH_NAMES.map(m => (seas.stocks[m] ? seas.stocks[m][yr] : null)),
            borderColor: PALM_COLORS[idx % PALM_COLORS.length],
            borderWidth: 2,
            tension: 0.2
          }))
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: { y: { ticks: { callback: v => (v / 1e6).toFixed(1) + 'M MT' } } }
        }
      });
    }

    // 3. Stock Use Ratio
    destroyChart('chart-season-stockuse');
    const ctx3 = document.getElementById('chart-season-stockuse');
    if (ctx3 && seas.stock_use) {
      state.charts['chart-season-stockuse'] = new Chart(ctx3, {
        type: 'line',
        data: {
          labels: MONTH_NAMES,
          datasets: selYears.map((yr, idx) => ({
            label: yr,
            data: MONTH_NAMES.map(m => (seas.stock_use[m] ? seas.stock_use[m][yr] : null)),
            borderColor: PALM_COLORS[idx % PALM_COLORS.length],
            borderWidth: 2,
            tension: 0.2
          }))
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: { y: { ticks: { callback: v => v.toFixed(1) + ' mo' } } }
        }
      });
    }

    // 4. CPO Production
    destroyChart('chart-season-production');
    const ctx4 = document.getElementById('chart-season-production');
    const grand = state.data.production.regions.find(r => r.region === 'Grand Total');
    if (ctx4 && grand) {
      state.charts['chart-season-production'] = new Chart(ctx4, {
        type: 'line',
        data: {
          labels: MONTH_NAMES,
          datasets: selYears.map((yr, idx) => ({
            label: yr,
            data: MONTH_NAMES.map(m => grand.monthly[m][yr] || null),
            borderColor: PALM_COLORS[idx % PALM_COLORS.length],
            borderWidth: 2,
            tension: 0.2
          }))
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: { y: { ticks: { callback: v => (v / 1e6).toFixed(1) + 'M MT' } } }
        }
      });
    }
  }

})();
