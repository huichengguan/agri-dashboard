/**
 * MPOB Palm Oil Intelligence Dashboard Application
 * Handles API integration, Chart.js visualizations, filtering, and data explorer.
 */

let masterData = [];
let filteredData = [];
let metadata = {};
let latestSnapshot = {};
let seasonalBenchmarks = [];
let isAnnualView = false;
let bsViewMode = 'horizontal_matrix';

// State and Export datasets
let stateData = null;
let exportProductsData = null;
let yieldCadence = 'monthly';
let yieldRegion = 'all';
let exportCadence = 'monthly';
let isExportAnnualView = false;

// Chart instances
let chartSD = null;
let chartStocks = null;
let chartStockUse = null;
let chartFFBYield = null;
let chartOER = null;
let chartPrice = null;
let chartSeasonality = null;
let chartStateProd = null;
let chartStateShare = null;
let chartStateYields = null;
let chartExportVol = null;
let chartExportPie = null;
let chartExportRev = null;

// Metric visibility state for main S&D chart
const metricVisibility = {
  cpo_production: true,
  palm_oil_export: true,
  palm_oil_stock: true,
  domestic_disappearance: true
};

document.addEventListener("DOMContentLoaded", async () => {
  await loadInitialData();
  setupYearSelectors();
  renderKPIs();
  renderAllCharts();
  renderHorizontalMatrix();
  renderYieldSummaryTable();
  renderHeatmap();
  renderExplorerTable();
  updateSensitivitySimulation();
  
  // Load async secondary datasets
  loadStateData();
  loadExportProductsData();

  if (window.lucide) lucide.createIcons();
});

async function loadInitialData() {
  try {
    const res = await fetch("/api/data?start_year=2005&end_year=2026").catch(() => null) || await fetch("api_data.json");
    const json = await res.json();
    masterData = json.data;
    filteredData = [...masterData];
    metadata = json.metadata;

    const sumRes = await fetch("/api/summary").catch(() => null) || await fetch("api_summary.json");
    const sumJson = await sumRes.json();
    latestSnapshot = sumJson.latest_snapshot;

    const seasRes = await fetch("/api/seasonality").catch(() => null) || await fetch("api_seasonality.json");
    const seasJson = await seasRes.json();
    seasonalBenchmarks = seasJson.seasonal_benchmarks;
  } catch (err) {
    console.error("Failed to load MPOB data:", err);
  }
}

function setupYearSelectors() {
  const startSelect = document.getElementById("start-year-select");
  const endSelect = document.getElementById("end-year-select");
  if (!startSelect || !endSelect) return;

  startSelect.innerHTML = "";
  endSelect.innerHTML = "";

  for (let y = 2005; y <= 2026; y++) {
    const optStart = document.createElement("option");
    optStart.value = y;
    optStart.textContent = y;
    if (y === 2005) optStart.selected = true;
    startSelect.appendChild(optStart);

    const optEnd = document.createElement("option");
    optEnd.value = y;
    optEnd.textContent = y;
    if (y === 2026) optEnd.selected = true;
    endSelect.appendChild(optEnd);
  }
}

function renderKPIs() {
  if (!latestSnapshot) return;

  const s = latestSnapshot;
  const pBadge = document.getElementById("latest-period-badge");
  if (pBadge) pBadge.textContent = `${s.month_name} ${s.year}`;

  const spanBadge = document.getElementById("hist-span-badge");
  if (spanBadge) spanBadge.textContent = `${masterData.length} Months (${masterData[0].period} – ${s.period})`;

  const setKPI = (id, val, formatFn = formatNumber) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val !== null && val !== undefined ? formatFn(val) : "--";
  };

  const setDelta = (id, pct, label) => {
    const el = document.getElementById(id);
    if (!el) return;
    if (pct === null || pct === undefined) {
      el.textContent = `${label}: --`;
      el.className = "text-slate-500 font-medium";
      return;
    }
    const isPos = pct >= 0;
    el.textContent = `${label}: ${isPos ? '+' : ''}${pct.toFixed(1)}%`;
    el.className = isPos ? "text-emerald-400 font-medium" : "text-rose-400 font-medium";
  };

  setKPI("kpi-cpo-prod", s.cpo_production);
  setDelta("kpi-cpo-prod-mom", s.cpo_prod_mom_pct, "MoM");
  setDelta("kpi-cpo-prod-yoy", s.cpo_prod_yoy_pct, "YoY");

  setKPI("kpi-po-stock", s.palm_oil_stock);
  setDelta("kpi-po-stock-mom", s.po_stock_mom_pct, "MoM");
  setDelta("kpi-po-stock-yoy", s.po_stock_yoy_pct, "YoY");

  setKPI("kpi-po-export", s.palm_oil_export);
  setDelta("kpi-po-export-mom", s.po_export_mom_pct, "MoM");
  setDelta("kpi-po-export-yoy", s.po_export_yoy_pct, "YoY");

  setKPI("kpi-ffb-yield", s.ffb_yield_malaysia, v => v.toFixed(2) + " T/Ha");
  setDelta("kpi-ffb-yield-mom", s.ffb_yield_mom_pct, "MoM");
  setDelta("kpi-ffb-yield-yoy", s.ffb_yield_yoy_pct, "YoY");

  setKPI("kpi-cpo-yield", s.cpo_yield_malaysia, v => v.toFixed(2) + " T/Ha");
  setKPI("kpi-oer-rate", s.oer_malaysia, v => v.toFixed(2) + "%");

  setKPI("kpi-dom-disapp", s.domestic_disappearance, v => formatNumber(v) + " T");
  setKPI("kpi-stock-use", s.stock_to_use_pct, v => v.toFixed(1) + "% (" + (s.days_of_supply || '--') + " days)");
  setKPI("kpi-po-import", s.palm_oil_import, v => formatNumber(v) + " T");
  setKPI("kpi-ffb-price", s.ffb_price_1pct_oer, v => "RM " + v.toFixed(2));
}

function onDateRangeChange() {
  const start = parseInt(document.getElementById("start-year-select").value);
  const end = parseInt(document.getElementById("end-year-select").value);
  if (start > end) return;

  filteredData = masterData.filter(r => r.year >= start && r.year <= end);
  updateAllVisualizations();
}

function setQuickRange(range) {
  const endYear = 2026;
  let startYear = 2005;

  if (range === 'all') {
    startYear = 2005;
  } else {
    startYear = Math.max(2005, endYear - parseInt(range) + 1);
  }

  document.getElementById("start-year-select").value = startYear;
  document.getElementById("end-year-select").value = endYear;

  document.querySelectorAll(".range-btn").forEach(b => {
    if (b.getAttribute("data-range") == range) {
      b.className = "range-btn px-2.5 py-1 rounded bg-emerald-600 font-semibold text-white transition";
    } else {
      b.className = "range-btn px-2.5 py-1 rounded hover:bg-slate-700 text-slate-300 transition";
    }
  });

  onDateRangeChange();
}

function switchTab(tabId) {
  document.querySelectorAll(".tab-content").forEach(el => el.classList.add("hidden"));
  document.querySelectorAll(".tab-btn").forEach(el => {
    el.classList.remove("active", "border-emerald-500", "border-amber-500", "text-white", "text-amber-300");
    el.classList.add("border-transparent", "text-slate-400");
  });

  const target = document.getElementById(`tab-${tabId}`);
  const btn = document.getElementById(`tab-btn-${tabId}`);
  if (target && btn) {
    target.classList.remove("hidden");
    if (tabId === 'projections') {
      btn.classList.add("active", "border-amber-500", "text-amber-300");
    } else {
      btn.classList.add("active", "border-emerald-500", "text-white");
    }
    btn.classList.remove("border-transparent", "text-slate-400");
  }

  // Trigger chart resize if needed
  if (tabId === 'yields') {
    if (chartFFBYield) chartFFBYield.resize();
    if (chartOER) chartOER.resize();
    if (chartPrice) chartPrice.resize();
    if (chartStateProd) chartStateProd.resize();
    if (chartStateShare) chartStateShare.resize();
    if (chartStateYields) chartStateYields.resize();
  }
  if (tabId === 'exports') {
    if (chartExportVol) chartExportVol.resize();
    if (chartExportPie) chartExportPie.resize();
    if (chartExportRev) chartExportRev.resize();
  }
  if (tabId === 'seasonality' && chartSeasonality) chartSeasonality.resize();
  if (window.lucide) lucide.createIcons();
}

// -------------------------------------------------------------
// Chart.js Visualizations
// -------------------------------------------------------------

function renderAllCharts() {
  renderSupplyDemandChart();
  renderStocksChart();
  renderStockUseChart();
  renderFFBYieldChart();
  renderOERChart();
  renderPriceChart();
  renderSeasonalityCurveChart();
}

function updateAllVisualizations() {
  renderAllCharts();
  renderHorizontalMatrix();
  renderFullGrid();
  renderBalanceSheetTable();
  renderYieldSummaryTable();
  renderExplorerTable();
  if (stateData) renderStateAnalytics();
  if (exportProductsData) {
    renderExportBreakdown();
    renderExportProductsTable();
  }
}

function renderSupplyDemandChart() {
  const ctx = document.getElementById("chart-supply-demand");
  if (!ctx) return;

  const labels = filteredData.map(r => r.period);
  const prod = filteredData.map(r => r.cpo_production);
  const exp = filteredData.map(r => r.palm_oil_export);
  const stock = filteredData.map(r => r.palm_oil_stock);
  const dom = filteredData.map(r => r.domestic_disappearance);

  if (chartSD) chartSD.destroy();

  chartSD = new Chart(ctx, {
    type: "line",
    data: {
      labels: labels,
      datasets: [
        {
          label: "CPO Production",
          data: prod,
          borderColor: "#22c55e", // brand emerald
          backgroundColor: "rgba(34, 197, 94, 0.08)",
          borderWidth: 2,
          fill: true,
          tension: 0.2,
          hidden: !metricVisibility.cpo_production,
          pointRadius: filteredData.length > 60 ? 0 : 2
        },
        {
          label: "Palm Oil Exports",
          data: exp,
          borderColor: "#3b82f6", // blue
          borderWidth: 2,
          tension: 0.2,
          hidden: !metricVisibility.palm_oil_export,
          pointRadius: filteredData.length > 60 ? 0 : 2
        },
        {
          label: "Ending Stocks",
          data: stock,
          borderColor: "#f59e0b", // amber
          borderWidth: 2,
          borderDash: [4, 4],
          tension: 0.2,
          hidden: !metricVisibility.palm_oil_stock,
          pointRadius: filteredData.length > 60 ? 0 : 2
        },
        {
          label: "Domestic Disappearance",
          data: dom,
          borderColor: "#c084fc", // purple
          borderWidth: 1.5,
          tension: 0.2,
          hidden: !metricVisibility.domestic_disappearance,
          pointRadius: filteredData.length > 60 ? 0 : 2
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: {
          labels: { color: "#94a3b8", boxWidth: 12, font: { size: 11 } }
        },
        tooltip: {
          backgroundColor: "rgba(15, 23, 42, 0.95)",
          borderColor: "#334155",
          borderWidth: 1,
          titleColor: "#f8fafc",
          bodyColor: "#cbd5e1",
          callbacks: {
            label: (ctx) => `${ctx.dataset.label}: ${formatNumber(ctx.parsed.y)} Tonnes`
          }
        }
      },
      scales: {
        x: {
          grid: { color: "rgba(51, 65, 85, 0.2)" },
          ticks: { color: "#64748b", maxTicksLimit: 14, font: { size: 10 } }
        },
        y: {
          grid: { color: "rgba(51, 65, 85, 0.2)" },
          ticks: {
            color: "#64748b",
            font: { size: 10 },
            callback: (v) => (v / 1000000).toFixed(1) + "M"
          }
        }
      }
    }
  });
}

function toggleChartMetric(metric) {
  metricVisibility[metric] = !metricVisibility[metric];
  renderSupplyDemandChart();
}

function renderStocksChart() {
  const ctx = document.getElementById("chart-stocks");
  if (!ctx) return;

  const labels = filteredData.map(r => r.period);
  const stocks = filteredData.map(r => r.palm_oil_stock);

  if (chartStocks) chartStocks.destroy();

  chartStocks = new Chart(ctx, {
    type: "line",
    data: {
      labels: labels,
      datasets: [
        {
          label: "Palm Oil Stocks",
          data: stocks,
          borderColor: "#f59e0b",
          backgroundColor: "rgba(245, 158, 11, 0.1)",
          borderWidth: 2,
          fill: true,
          tension: 0.25,
          pointRadius: filteredData.length > 60 ? 0 : 2
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => `Stocks: ${formatNumber(ctx.parsed.y)} Tonnes`
          }
        }
      },
      scales: {
        x: { ticks: { color: "#64748b", maxTicksLimit: 8, font: { size: 10 } }, grid: { color: "rgba(51,65,85,0.15)" } },
        y: { ticks: { color: "#64748b", font: { size: 10 }, callback: v => (v / 1000000).toFixed(1) + "M" }, grid: { color: "rgba(51,65,85,0.15)" } }
      }
    }
  });
}

function renderStockUseChart() {
  const ctx = document.getElementById("chart-stock-use");
  if (!ctx) return;

  const labels = filteredData.map(r => r.period);
  const stockUse = filteredData.map(r => r.stock_to_use_pct);
  const daysSupply = filteredData.map(r => r.days_of_supply);

  if (chartStockUse) chartStockUse.destroy();

  chartStockUse = new Chart(ctx, {
    type: "line",
    data: {
      labels: labels,
      datasets: [
        {
          label: "Stock-to-Use (%)",
          data: stockUse,
          borderColor: "#a855f7",
          backgroundColor: "rgba(168, 85, 247, 0.08)",
          borderWidth: 2,
          fill: true,
          tension: 0.2,
          yAxisID: "y",
          pointRadius: filteredData.length > 60 ? 0 : 2
        },
        {
          label: "Days of Supply",
          data: daysSupply,
          borderColor: "#06b6d4",
          borderWidth: 1.5,
          borderDash: [3, 3],
          tension: 0.2,
          yAxisID: "y1",
          pointRadius: 0
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { labels: { color: "#94a3b8", boxWidth: 10, font: { size: 10 } } }
      },
      scales: {
        x: { ticks: { color: "#64748b", maxTicksLimit: 8, font: { size: 10 } }, grid: { color: "rgba(51,65,85,0.15)" } },
        y: {
          type: "linear",
          position: "left",
          ticks: { color: "#a855f7", font: { size: 10 }, callback: v => v + "%" },
          grid: { color: "rgba(51,65,85,0.15)" }
        },
        y1: {
          type: "linear",
          position: "right",
          ticks: { color: "#06b6d4", font: { size: 10 }, callback: v => v + "d" },
          grid: { drawOnChartArea: false }
        }
      }
    }
  });
}

function renderFFBYieldChart() {
  const ctx = document.getElementById("chart-ffb-yield");
  if (!ctx) return;

  let labels = [];
  let ffbMy = [], ffbPen = [], ffbSS = [], cpoYield = [];

  if (yieldCadence === 'annual') {
    const years = [...new Set(filteredData.map(r => r.year))].sort((a, b) => a - b);
    labels = years.map(y => `${y}${y === 2026 ? ' (YTD)' : ''}`);
    
    years.forEach(y => {
      const yRecs = filteredData.filter(r => r.year === y);
      const sum = (field) => {
        const vals = yRecs.map(r => r[field]).filter(v => v !== null && v !== undefined);
        return vals.length ? vals.reduce((a, b) => a + b, 0) : null;
      };
      const mySum = sum("ffb_yield_malaysia");
      const penSum = sum("ffb_yield_peninsular");
      const ssSum = sum("ffb_yield_sabah_sarawak");
      const cpoSum = sum("cpo_yield_malaysia");

      ffbMy.push(mySum ? Number(mySum.toFixed(2)) : null);
      ffbPen.push(penSum ? Number(penSum.toFixed(2)) : null);
      ffbSS.push(ssSum ? Number(ssSum.toFixed(2)) : null);
      cpoYield.push(cpoSum ? Number(cpoSum.toFixed(2)) : null);
    });

    const titleEl = document.getElementById("yield-chart-title");
    if (titleEl) titleEl.textContent = "Annual Cumulative FFB & CPO Yields (Tonnes / Hectare)";
    const subEl = document.getElementById("yield-chart-subtitle");
    if (subEl) subEl.textContent = "Sum of monthly yields across calendar year (2026 is Year-to-Date through July)";
  } else {
    labels = filteredData.map(r => r.period);
    ffbMy = filteredData.map(r => r.ffb_yield_malaysia);
    ffbPen = filteredData.map(r => r.ffb_yield_peninsular);
    ffbSS = filteredData.map(r => r.ffb_yield_sabah_sarawak);
    cpoYield = filteredData.map(r => r.cpo_yield_malaysia);

    const titleEl = document.getElementById("yield-chart-title");
    if (titleEl) titleEl.textContent = "Monthly FFB Yield & Derived CPO Yield Evolution (2005 – 2026)";
    const subEl = document.getElementById("yield-chart-subtitle");
    if (subEl) subEl.textContent = "Monthly Fresh Fruit Bunches (FFB) and Crude Palm Oil (CPO) yield in Tonnes / Hectare";
  }

  const allDatasets = [
    {
      id: "national",
      label: "FFB Yield (Malaysia)",
      data: ffbMy,
      borderColor: "#22c55e",
      borderWidth: 2.5,
      tension: 0.2,
      pointRadius: labels.length > 60 ? 0 : 2
    },
    {
      id: "peninsular",
      label: "FFB Peninsular",
      data: ffbPen,
      borderColor: "#3b82f6",
      borderWidth: 1.5,
      borderDash: [2, 2],
      tension: 0.2,
      pointRadius: 0
    },
    {
      id: "sabah_sarawak",
      label: "FFB Sabah & Sarawak",
      data: ffbSS,
      borderColor: "#a855f7",
      borderWidth: 1.5,
      borderDash: [2, 2],
      tension: 0.2,
      pointRadius: 0
    },
    {
      id: "cpo_yield",
      label: "Derived CPO Yield (Malaysia)",
      data: cpoYield,
      borderColor: "#eab308",
      backgroundColor: "rgba(234, 179, 8, 0.12)",
      borderWidth: 2,
      fill: true,
      tension: 0.2,
      pointRadius: labels.length > 60 ? 0 : 2
    }
  ];

  let visibleDatasets = allDatasets;
  if (yieldRegion === 'national') {
    visibleDatasets = [allDatasets[0], allDatasets[3]];
  } else if (yieldRegion === 'peninsular') {
    visibleDatasets = [allDatasets[1], allDatasets[3]];
  } else if (yieldRegion === 'sabah' || yieldRegion === 'sarawak') {
    visibleDatasets = [allDatasets[2], allDatasets[3]];
  }

  if (chartFFBYield) chartFFBYield.destroy();

  chartFFBYield = new Chart(ctx, {
    type: "line",
    data: {
      labels: labels,
      datasets: visibleDatasets
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { labels: { color: "#94a3b8", boxWidth: 12, font: { size: 11 } } },
        tooltip: {
          callbacks: {
            label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.y ? ctx.parsed.y.toFixed(2) : '--'} T/Ha`
          }
        }
      },
      scales: {
        x: { ticks: { color: "#64748b", maxTicksLimit: 14, font: { size: 10 } }, grid: { color: "rgba(51,65,85,0.15)" } },
        y: { ticks: { color: "#64748b", font: { size: 10 }, callback: v => v.toFixed(2) + " T/Ha" }, grid: { color: "rgba(51,65,85,0.15)" } }
      }
    }
  });
}

function renderOERChart() {
  const ctx = document.getElementById("chart-oer");
  if (!ctx) return;

  let labels = [];
  let oerMy = [], oerPen = [], oerSabah = [], oerSarawak = [];

  if (yieldCadence === 'annual') {
    const years = [...new Set(filteredData.map(r => r.year))].sort((a, b) => a - b);
    labels = years.map(y => `${y}${y === 2026 ? ' (YTD)' : ''}`);

    years.forEach(y => {
      const yRecs = filteredData.filter(r => r.year === y);
      const avg = (field) => {
        const vals = yRecs.map(r => r[field]).filter(v => v !== null && v !== undefined);
        return vals.length ? (vals.reduce((a, b) => a + b, 0) / vals.length) : null;
      };
      oerMy.push(avg("oer_malaysia") ? Number(avg("oer_malaysia").toFixed(2)) : null);
      oerPen.push(avg("oer_peninsular") ? Number(avg("oer_peninsular").toFixed(2)) : null);
      oerSabah.push(avg("oer_sabah") ? Number(avg("oer_sabah").toFixed(2)) : null);
      oerSarawak.push(avg("oer_sarawak") ? Number(avg("oer_sarawak").toFixed(2)) : null);
    });
  } else {
    labels = filteredData.map(r => r.period);
    oerMy = filteredData.map(r => r.oer_malaysia);
    oerPen = filteredData.map(r => r.oer_peninsular);
    oerSabah = filteredData.map(r => r.oer_sabah);
    oerSarawak = filteredData.map(r => r.oer_sarawak);
  }

  if (chartOER) chartOER.destroy();

  chartOER = new Chart(ctx, {
    type: "line",
    data: {
      labels: labels,
      datasets: [
        { label: "OER Malaysia", data: oerMy, borderColor: "#eab308", borderWidth: 2, tension: 0.2, pointRadius: labels.length > 60 ? 0 : 2 },
        { label: "Peninsular", data: oerPen, borderColor: "#3b82f6", borderWidth: 1.2, tension: 0.2, pointRadius: 0 },
        { label: "Sabah", data: oerSabah, borderColor: "#22c55e", borderWidth: 1.2, tension: 0.2, pointRadius: 0 },
        { label: "Sarawak", data: oerSarawak, borderColor: "#f97316", borderWidth: 1.2, tension: 0.2, pointRadius: 0 }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { labels: { color: "#94a3b8", boxWidth: 10, font: { size: 10 } } },
        tooltip: {
          callbacks: { label: ctx => `${ctx.dataset.label}: ${ctx.parsed.y ? ctx.parsed.y.toFixed(2) : '--'}%` }
        }
      },
      scales: {
        x: { ticks: { color: "#64748b", maxTicksLimit: 8, font: { size: 10 } }, grid: { color: "rgba(51,65,85,0.15)" } },
        y: { ticks: { color: "#64748b", font: { size: 10 }, callback: v => v + "%" }, grid: { color: "rgba(51,65,85,0.15)" } }
      }
    }
  });
}

function renderPriceChart() {
  const ctx = document.getElementById("chart-price");
  if (!ctx) return;

  const validPriceData = filteredData.filter(r => r.ffb_price_1pct_oer !== null);
  const labels = validPriceData.map(r => r.period);
  const prices = validPriceData.map(r => r.ffb_price_1pct_oer);

  if (chartPrice) chartPrice.destroy();

  chartPrice = new Chart(ctx, {
    type: "line",
    data: {
      labels: labels,
      datasets: [
        {
          label: "FFB Price (1% OER)",
          data: prices,
          borderColor: "#10b981",
          backgroundColor: "rgba(16, 185, 129, 0.1)",
          borderWidth: 2,
          fill: true,
          tension: 0.2,
          pointRadius: validPriceData.length > 60 ? 0 : 2
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: { label: ctx => `FFB Ref Price: RM ${ctx.parsed.y.toFixed(2)}` }
        }
      },
      scales: {
        x: { ticks: { color: "#64748b", maxTicksLimit: 8, font: { size: 10 } }, grid: { color: "rgba(51,65,85,0.15)" } },
        y: { ticks: { color: "#64748b", font: { size: 10 }, callback: v => "RM " + v }, grid: { color: "rgba(51,65,85,0.15)" } }
      }
    }
  });
}

function renderSeasonalityCurveChart() {
  const ctx = document.getElementById("chart-seasonality-curve");
  if (!ctx || !seasonalBenchmarks.length) return;

  const months = seasonalBenchmarks.map(s => s.month_name.slice(0, 3));
  const avgProd = seasonalBenchmarks.map(s => s.cpo_production_avg);
  const avgStock = seasonalBenchmarks.map(s => s.palm_oil_stock_avg);

  // 2026 data for overlay
  const recs2026 = masterData.filter(r => r.year === 2026);
  const curProd = months.map((m, idx) => {
    const r = recs2026.find(x => x.month === idx + 1);
    return r ? r.cpo_production : null;
  });

  if (chartSeasonality) chartSeasonality.destroy();

  chartSeasonality = new Chart(ctx, {
    type: "line",
    data: {
      labels: months,
      datasets: [
        {
          label: "Historical Average Production (2005-2025)",
          data: avgProd,
          borderColor: "#64748b",
          borderWidth: 2,
          borderDash: [4, 4],
          tension: 0.3,
          pointRadius: 3
        },
        {
          label: "Current 2026 Production",
          data: curProd,
          borderColor: "#22c55e",
          backgroundColor: "rgba(34, 197, 94, 0.15)",
          borderWidth: 3,
          fill: true,
          tension: 0.3,
          pointRadius: 5
        },
        {
          label: "Historical Average Stocks",
          data: avgStock,
          borderColor: "#f59e0b",
          borderWidth: 1.5,
          tension: 0.3,
          pointRadius: 2
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { labels: { color: "#94a3b8", boxWidth: 12, font: { size: 11 } } },
        tooltip: {
          callbacks: {
            label: (ctx) => `${ctx.dataset.label}: ${formatNumber(ctx.parsed.y)} Tonnes`
          }
        }
      },
      scales: {
        x: { ticks: { color: "#94a3b8", font: { size: 11 } }, grid: { color: "rgba(51,65,85,0.2)" } },
        y: { ticks: { color: "#64748b", font: { size: 10 }, callback: v => (v / 1000000).toFixed(2) + "M" }, grid: { color: "rgba(51,65,85,0.2)" } }
      }
    }
  });
}

// -------------------------------------------------------------
// Tables & Heatmaps
// -------------------------------------------------------------

// -------------------------------------------------------------
// Balance Sheet Multi-View (Horizontal Matrix & Multi-Year Grid)
// -------------------------------------------------------------

function setBalanceSheetViewMode(mode) {
  bsViewMode = mode;
  
  const modes = ['horizontal_matrix', 'full_grid', 'vertical_table'];
  modes.forEach(m => {
    const btn = document.getElementById(m === 'horizontal_matrix' ? 'btn-mode-matrix' : (m === 'full_grid' ? 'btn-mode-grid' : 'btn-mode-table'));
    const container = document.getElementById(m === 'horizontal_matrix' ? 'container-horizontal-matrix' : (m === 'full_grid' ? 'container-full-grid' : 'container-vertical-table'));
    
    if (m === mode) {
      if (btn) {
        btn.className = "px-2.5 py-1 rounded bg-emerald-600 font-semibold text-white transition flex items-center space-x-1.5";
      }
      if (container) container.classList.remove("hidden");
    } else {
      if (btn) {
        btn.className = "px-2.5 py-1 rounded hover:bg-slate-700 text-slate-300 transition flex items-center space-x-1.5";
      }
      if (container) container.classList.add("hidden");
    }
  });

  if (mode === 'horizontal_matrix') renderHorizontalMatrix();
  else if (mode === 'full_grid') renderFullGrid();
  else if (mode === 'vertical_table') renderBalanceSheetTable();
  if (window.lucide) lucide.createIcons();
}

function renderHorizontalMatrix() {
  const thead = document.getElementById("matrix-thead");
  const tbody = document.getElementById("matrix-tbody");
  if (!thead || !tbody) return;

  const metric = document.getElementById("matrix-metric-select") ? document.getElementById("matrix-metric-select").value : "cpo_production";
  const years = [...new Set(masterData.map(r => r.year))].sort((a, b) => b - a); // 2026 .. 2005

  // Table Headers
  let headHtml = `<tr>
    <th class="py-2.5 px-3 whitespace-nowrap bg-slate-900/95 sticky left-0 z-20">Month</th>`;
  years.forEach(y => {
    headHtml += `<th class="py-2.5 px-3 text-right whitespace-nowrap ${y === 2026 ? 'text-emerald-400 font-bold' : ''}">${y}${y === 2026 ? ' (YTD)' : ''}</th>`;
  });
  headHtml += `<th class="py-2.5 px-3 text-right text-blue-400 font-bold bg-slate-900/90 whitespace-nowrap">5-Yr Avg</th>`;
  headHtml += `<th class="py-2.5 px-3 text-right text-purple-400 font-bold bg-slate-900/90 whitespace-nowrap">10-Yr Avg</th>`;
  headHtml += `<th class="py-2.5 px-3 text-right text-amber-400 font-bold bg-slate-900/90 whitespace-nowrap">20-Yr Avg</th>`;
  headHtml += `</tr>`;
  thead.innerHTML = headHtml;

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  // Lookup map: (year, month) -> record
  const map = {};
  masterData.forEach(r => {
    map[`${r.year}-${r.month}`] = r;
  });

  let bodyHtml = "";
  const isPercent = metric === "stock_to_use_pct";
  const isStock = metric === "palm_oil_stock" || metric === "beginning_stock";

  // 12 month rows
  for (let m = 1; m <= 12; m++) {
    const mName = monthNames[m - 1];
    bodyHtml += `<tr class="hover:bg-slate-800/40 transition">
      <td class="py-2 px-3 font-semibold text-white whitespace-nowrap bg-slate-900/80 sticky left-0 z-10">${mName}</td>`;

    const valsForAverages = [];
    years.forEach(y => {
      const rec = map[`${y}-${m}`];
      let val = null;
      if (rec && rec[metric] !== undefined && rec[metric] !== null) {
        val = rec[metric];
        valsForAverages.push({ year: y, val });
      }

      const formatted = val !== null ? (isPercent ? val.toFixed(1) + '%' : formatNumber(val)) : '<span class="text-slate-600">--</span>';
      bodyHtml += `<td class="py-2 px-3 text-right whitespace-nowrap ${y === 2026 ? 'text-emerald-300 font-semibold' : 'text-slate-300'}">${formatted}</td>`;
    });

    // 5-Yr Avg (2021-2025 completed years)
    const v5 = valsForAverages.filter(x => x.year >= 2021 && x.year <= 2025).map(x => x.val);
    const avg5 = v5.length ? v5.reduce((a, b) => a + b, 0) / v5.length : null;

    // 10-Yr Avg (2016-2025)
    const v10 = valsForAverages.filter(x => x.year >= 2016 && x.year <= 2025).map(x => x.val);
    const avg10 = v10.length ? v10.reduce((a, b) => a + b, 0) / v10.length : null;

    // 20-Yr Avg (2005-2025)
    const v20 = valsForAverages.filter(x => x.year >= 2005 && x.year <= 2025).map(x => x.val);
    const avg20 = v20.length ? v20.reduce((a, b) => a + b, 0) / v20.length : null;

    bodyHtml += `<td class="py-2 px-3 text-right text-blue-300 bg-slate-900/40 font-semibold whitespace-nowrap">${avg5 !== null ? (isPercent ? avg5.toFixed(1) + '%' : formatNumber(avg5)) : '--'}</td>`;
    bodyHtml += `<td class="py-2 px-3 text-right text-purple-300 bg-slate-900/40 font-semibold whitespace-nowrap">${avg10 !== null ? (isPercent ? avg10.toFixed(1) + '%' : formatNumber(avg10)) : '--'}</td>`;
    bodyHtml += `<td class="py-2 px-3 text-right text-amber-300 bg-slate-900/40 font-semibold whitespace-nowrap">${avg20 !== null ? (isPercent ? avg20.toFixed(1) + '%' : formatNumber(avg20)) : '--'}</td>`;
    bodyHtml += `</tr>`;
  }

  // Summary Row (Total / Annual Avg)
  bodyHtml += `<tr class="bg-slate-900/90 font-bold border-t-2 border-slate-700">
    <td class="py-2.5 px-3 text-emerald-400 whitespace-nowrap sticky left-0 z-10 bg-slate-900">${isStock ? 'Year-End Stock' : (isPercent ? 'Annual Average' : 'Annual Total')}</td>`;

  const annualTotalsForBenchmark = [];
  years.forEach(y => {
    const yRecs = masterData.filter(r => r.year === y);
    let summaryVal = null;
    if (yRecs.length > 0) {
      if (isStock) {
        // Last available month of the year
        summaryVal = yRecs[yRecs.length - 1][metric];
      } else if (isPercent) {
        const pVals = yRecs.map(r => r[metric]).filter(v => v !== null && v !== undefined);
        summaryVal = pVals.length ? pVals.reduce((a, b) => a + b, 0) / pVals.length : null;
      } else {
        summaryVal = yRecs.reduce((sum, r) => sum + (r[metric] || 0), 0);
      }
    }
    if (summaryVal !== null) annualTotalsForBenchmark.push({ year: y, val: summaryVal });

    const formatted = summaryVal !== null ? (isPercent ? summaryVal.toFixed(1) + '%' : formatNumber(summaryVal)) : '--';
    bodyHtml += `<td class="py-2.5 px-3 text-right text-emerald-400 whitespace-nowrap">${formatted}</td>`;
  });

  const a5 = annualTotalsForBenchmark.filter(x => x.year >= 2021 && x.year <= 2025).map(x => x.val);
  const sum5 = a5.length ? a5.reduce((a, b) => a + b, 0) / a5.length : null;

  const a10 = annualTotalsForBenchmark.filter(x => x.year >= 2016 && x.year <= 2025).map(x => x.val);
  const sum10 = a10.length ? a10.reduce((a, b) => a + b, 0) / a10.length : null;

  const a20 = annualTotalsForBenchmark.filter(x => x.year >= 2005 && x.year <= 2025).map(x => x.val);
  const sum20 = a20.length ? a20.reduce((a, b) => a + b, 0) / a20.length : null;

  bodyHtml += `<td class="py-2.5 px-3 text-right text-blue-400 font-bold whitespace-nowrap">${sum5 !== null ? (isPercent ? sum5.toFixed(1) + '%' : formatNumber(sum5)) : '--'}</td>`;
  bodyHtml += `<td class="py-2.5 px-3 text-right text-purple-400 font-bold whitespace-nowrap">${sum10 !== null ? (isPercent ? sum10.toFixed(1) + '%' : formatNumber(sum10)) : '--'}</td>`;
  bodyHtml += `<td class="py-2.5 px-3 text-right text-amber-400 font-bold whitespace-nowrap">${sum20 !== null ? (isPercent ? sum20.toFixed(1) + '%' : formatNumber(sum20)) : '--'}</td>`;
  bodyHtml += `</tr>`;

  tbody.innerHTML = bodyHtml;
}

function renderFullGrid() {
  const thead = document.getElementById("full-grid-thead");
  const tbody = document.getElementById("full-grid-tbody");
  if (!thead || !tbody) return;

  const periodSelect = document.getElementById("grid-period-select") ? document.getElementById("grid-period-select").value : "annual";
  const years = [...new Set(masterData.map(r => r.year))].sort((a, b) => b - a); // 2026 .. 2005

  let headHtml = `<tr>
    <th class="py-2.5 px-3 whitespace-nowrap bg-slate-900/95 sticky left-0 z-20">Balance Sheet Item (Tonnes)</th>`;
  years.forEach(y => {
    headHtml += `<th class="py-2.5 px-3 text-right whitespace-nowrap ${y === 2026 ? 'text-emerald-400 font-bold' : ''}">${y}${y === 2026 ? ' (YTD)' : ''}</th>`;
  });
  headHtml += `<th class="py-2.5 px-3 text-right text-blue-400 font-bold whitespace-nowrap">5-Yr Avg</th>`;
  headHtml += `<th class="py-2.5 px-3 text-right text-purple-400 font-bold whitespace-nowrap">10-Yr Avg</th>`;
  headHtml += `</tr>`;
  thead.innerHTML = headHtml;

  const balanceSheetRows = [
    { key: "beginning_stock", label: "Beginning Stocks", type: "stock", color: "text-slate-300" },
    { key: "cpo_production", label: "(+) CPO Production", type: "flow", color: "text-emerald-400 font-semibold" },
    { key: "palm_oil_import", label: "(+) Palm Oil Imports", type: "flow", color: "text-slate-300" },
    { key: "total_supply", label: "(=) Total Supply", type: "calc_supply", color: "text-white font-bold bg-slate-900/50" },
    { key: "palm_oil_export", label: "(-) Palm Oil Exports", type: "flow", color: "text-blue-400 font-medium" },
    { key: "domestic_disappearance", label: "(-) Domestic Disappearance", type: "flow", color: "text-purple-400" },
    { key: "total_use", label: "(=) Total Disappearance / Use", type: "calc_use", color: "text-white font-bold bg-slate-900/50" },
    { key: "palm_oil_stock", label: "(=) Ending Stocks", type: "stock", color: "text-amber-400 font-bold" },
    { key: "stock_to_use_pct", label: "Stock-to-Use Ratio (%)", type: "pct", color: "text-amber-300" },
    { key: "days_of_supply", label: "Days of Supply (Days)", type: "num", color: "text-cyan-300" }
  ];

  let bodyHtml = "";

  balanceSheetRows.forEach(row => {
    bodyHtml += `<tr class="hover:bg-slate-800/40 transition">
      <td class="py-2 px-3 font-semibold ${row.color} whitespace-nowrap bg-slate-900/80 sticky left-0 z-10">${row.label}</td>`;

    const yearVals = [];
    years.forEach(y => {
      let val = null;
      if (periodSelect === "annual") {
        const yRecs = masterData.filter(r => r.year === y);
        if (yRecs.length > 0) {
          if (row.key === "beginning_stock") {
            val = yRecs[0].beginning_stock;
          } else if (row.key === "palm_oil_stock") {
            val = yRecs[yRecs.length - 1].palm_oil_stock;
          } else if (row.key === "cpo_production" || row.key === "palm_oil_import" || row.key === "palm_oil_export" || row.key === "domestic_disappearance") {
            val = yRecs.reduce((sum, r) => sum + (r[row.key] || 0), 0);
          } else if (row.key === "total_supply") {
            const b = yRecs[0].beginning_stock || 0;
            const p = yRecs.reduce((sum, r) => sum + (r.cpo_production || 0), 0);
            const imp = yRecs.reduce((sum, r) => sum + (r.palm_oil_import || 0), 0);
            val = b + p + imp;
          } else if (row.key === "total_use") {
            const exp = yRecs.reduce((sum, r) => sum + (r.palm_oil_export || 0), 0);
            const dom = yRecs.reduce((sum, r) => sum + (r.domestic_disappearance || 0), 0);
            val = exp + dom;
          } else if (row.key === "stock_to_use_pct") {
            const exp = yRecs.reduce((sum, r) => sum + (r.palm_oil_export || 0), 0);
            const dom = yRecs.reduce((sum, r) => sum + (r.domestic_disappearance || 0), 0);
            const endS = yRecs[yRecs.length - 1].palm_oil_stock || 0;
            const use = exp + dom;
            val = use > 0 ? (endS / use) * 100 : 0;
          } else if (row.key === "days_of_supply") {
            const exp = yRecs.reduce((sum, r) => sum + (r.palm_oil_export || 0), 0);
            const dom = yRecs.reduce((sum, r) => sum + (r.domestic_disappearance || 0), 0);
            const endS = yRecs[yRecs.length - 1].palm_oil_stock || 0;
            const use = exp + dom;
            const daysInY = yRecs.length * 30.4;
            val = use > 0 ? (endS / (use / daysInY)) : 0;
          }
        }
      } else {
        // Specific Month
        const mNum = parseInt(periodSelect);
        const rec = masterData.find(r => r.year === y && r.month === mNum);
        if (rec) {
          if (row.key === "total_supply") {
            val = (rec.beginning_stock || 0) + (rec.cpo_production || 0) + (rec.palm_oil_import || 0);
          } else if (row.key === "total_use") {
            val = (rec.palm_oil_export || 0) + (rec.domestic_disappearance || 0);
          } else {
            val = rec[row.key];
          }
        }
      }

      if (val !== null && val !== undefined) yearVals.push({ year: y, val });

      let formatted = '<span class="text-slate-600">--</span>';
      if (val !== null && val !== undefined) {
        if (row.type === "pct") formatted = val.toFixed(1) + "%";
        else if (row.type === "num") formatted = val.toFixed(1);
        else formatted = formatNumber(val);
      }

      bodyHtml += `<td class="py-2 px-3 text-right whitespace-nowrap ${row.color}">${formatted}</td>`;
    });

    const v5 = yearVals.filter(x => x.year >= 2021 && x.year <= 2025).map(x => x.val);
    const avg5 = v5.length ? v5.reduce((a, b) => a + b, 0) / v5.length : null;

    const v10 = yearVals.filter(x => x.year >= 2016 && x.year <= 2025).map(x => x.val);
    const avg10 = v10.length ? v10.reduce((a, b) => a + b, 0) / v10.length : null;

    let f5 = '--', f10 = '--';
    if (avg5 !== null) {
      if (row.type === "pct") f5 = avg5.toFixed(1) + "%";
      else if (row.type === "num") f5 = avg5.toFixed(1);
      else f5 = formatNumber(avg5);
    }
    if (avg10 !== null) {
      if (row.type === "pct") f10 = avg10.toFixed(1) + "%";
      else if (row.type === "num") f10 = avg10.toFixed(1);
      else f10 = formatNumber(avg10);
    }

    bodyHtml += `<td class="py-2 px-3 text-right text-blue-300 font-semibold bg-slate-900/40 whitespace-nowrap">${f5}</td>`;
    bodyHtml += `<td class="py-2 px-3 text-right text-purple-300 font-semibold bg-slate-900/40 whitespace-nowrap">${f10}</td>`;
    bodyHtml += `</tr>`;
  });

  tbody.innerHTML = bodyHtml;
}

function renderBalanceSheetTable() {
  const tbody = document.getElementById("balance-sheet-tbody");
  if (!tbody) return;
  tbody.innerHTML = "";

  let records = [];

  if (isAnnualView) {
    const byYear = {};
    filteredData.forEach(r => {
      if (!byYear[r.year]) {
        byYear[r.year] = {
          year: r.year,
          beg_stock: r.beginning_stock,
          cpo_production: 0,
          palm_oil_import: 0,
          total_supply: 0,
          palm_oil_export: 0,
          domestic_disappearance: 0,
          total_use: 0,
          palm_oil_stock: r.palm_oil_stock,
          stock_to_use_pct: 0,
          months_count: 0
        };
      }
      const y = byYear[r.year];
      y.cpo_production += (r.cpo_production || 0);
      y.palm_oil_import += (r.palm_oil_import || 0);
      y.palm_oil_export += (r.palm_oil_export || 0);
      y.domestic_disappearance += (r.domestic_disappearance || 0);
      y.palm_oil_stock = r.palm_oil_stock;
      y.months_count++;
    });

    Object.values(byYear).forEach(y => {
      y.total_supply = (y.beg_stock || 0) + y.cpo_production + y.palm_oil_import;
      y.total_use = y.palm_oil_export + y.domestic_disappearance;
      y.stock_to_use_pct = y.total_use > 0 ? (y.palm_oil_stock / y.total_use * 100) : 0;
      records.push({
        period: `${y.year} (Annual${y.months_count < 12 ? ' YTD' : ''})`,
        ...y
      });
    });
  } else {
    records = [...filteredData].reverse();
  }

  records.forEach(r => {
    const tr = document.createElement("tr");
    tr.className = "hover:bg-slate-800/40 transition";
    tr.innerHTML = `
      <td class="py-2 px-3 font-semibold text-white whitespace-nowrap">${r.period}</td>
      <td class="py-2 px-3 text-right text-slate-400">${formatNumber(r.beginning_stock)}</td>
      <td class="py-2 px-3 text-right text-emerald-400 font-semibold">${formatNumber(r.cpo_production)}</td>
      <td class="py-2 px-3 text-right text-slate-400">${formatNumber(r.palm_oil_import)}</td>
      <td class="py-2 px-3 text-right font-bold text-slate-200">${formatNumber(r.total_supply)}</td>
      <td class="py-2 px-3 text-right text-blue-400 font-medium">${formatNumber(r.palm_oil_export)}</td>
      <td class="py-2 px-3 text-right text-purple-400">${formatNumber(r.domestic_disappearance)}</td>
      <td class="py-2 px-3 text-right font-bold text-slate-200">${formatNumber(r.total_use)}</td>
      <td class="py-2 px-3 text-right text-amber-400 font-bold">${formatNumber(r.palm_oil_stock)}</td>
      <td class="py-2 px-3 text-right text-slate-300">${r.stock_to_use_pct ? r.stock_to_use_pct.toFixed(1) + '%' : '--'}</td>
      <td class="py-2 px-3 text-center">
        <span class="px-1.5 py-0.5 rounded text-[10px] bg-emerald-950 text-emerald-400 border border-emerald-800">Balanced</span>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function toggleAnnualView() {
  isAnnualView = !isAnnualView;
  const btn = document.getElementById("btn-toggle-annual");
  if (btn) btn.textContent = isAnnualView ? "Switch to Monthly Breakdown" : "Switch to Annual Totals";
  renderBalanceSheetTable();
}

function setYieldCadence(cadence) {
  yieldCadence = cadence;
  const btnM = document.getElementById("btn-yield-monthly");
  const btnA = document.getElementById("btn-yield-annual");
  if (btnM && btnA) {
    if (cadence === 'monthly') {
      btnM.className = "px-2.5 py-1 rounded bg-emerald-600 font-semibold text-white transition";
      btnA.className = "px-2.5 py-1 rounded hover:bg-slate-700 text-slate-300 transition";
    } else {
      btnA.className = "px-2.5 py-1 rounded bg-emerald-600 font-semibold text-white transition";
      btnM.className = "px-2.5 py-1 rounded hover:bg-slate-700 text-slate-300 transition";
    }
  }
  renderFFBYieldChart();
  renderOERChart();
}

function onYieldRegionChange() {
  const el = document.getElementById("yield-region-select");
  if (el) yieldRegion = el.value;
  renderFFBYieldChart();
  renderOERChart();
}

// -------------------------------------------------------------
// State-by-State Production & Yield Analytics
// -------------------------------------------------------------

async function loadStateData() {
  try {
    const res = await fetch("/api/state-data?start_year=2005&end_year=2026").catch(() => null) || await fetch("api_state_data.json");
    stateData = await res.json();
    populateStateYearSelect();
    renderStateAnalytics();
  } catch (err) {
    console.error("Failed to load state data:", err);
  }
}

function populateStateYearSelect() {
  const select = document.getElementById("state-year-select");
  if (!select) return;
  select.innerHTML = "";

  const years = (stateData && stateData.annual) ? stateData.annual.map(a => a.year).sort((a, b) => b - a) : [];
  if (!years.length) {
    for (let y = 2026; y >= 2005; y--) years.push(y);
  }

  years.forEach(y => {
    const opt = document.createElement("option");
    opt.value = y;
    opt.textContent = `${y}${y === 2026 ? ' (YTD)' : ''}`;
    if (y === 2025 || (y === 2026 && !years.includes(2025))) opt.selected = true;
    select.appendChild(opt);
  });
}

function renderStateAnalytics() {
  if (!stateData) return;

  const select = document.getElementById("state-year-select");
  const targetYear = select ? parseInt(select.value) : 2025;

  // Find annual record for target year
  let annualRec = stateData.annual ? stateData.annual.find(a => a.year === targetYear) : null;
  let statesObj = annualRec ? annualRec.states : {};

  // If not found in annual (e.g. newly fetched monthly), compute on fly from monthly
  if (!annualRec && stateData.monthly) {
    const mRecs = stateData.monthly.filter(m => m.year === targetYear);
    statesObj = {};
    mRecs.forEach(m => {
      Object.entries(m.states || {}).forEach(([sName, sVal]) => {
        if (!statesObj[sName]) {
          statesObj[sName] = {
            state_name: sName,
            state_code: sVal.state_code,
            annual_cpo_production: 0,
            annual_ffb_processed: 0,
            ffb_vals: [],
            oer_vals: []
          };
        }
        const st = statesObj[sName];
        st.annual_cpo_production += (sVal.cpo_production || 0);
        st.annual_ffb_processed += (sVal.ffb_processed || 0);
        if (sVal.ffb_yield) st.ffb_vals.push(sVal.ffb_yield);
        if (sVal.oer) st.oer_vals.push(sVal.oer);
      });
    });

    Object.values(statesObj).forEach(st => {
      st.annual_ffb_yield = st.ffb_vals.length ? Number(st.ffb_vals.reduce((a, b) => a + b, 0).toFixed(2)) : null;
      st.annual_avg_oer = st.oer_vals.length ? Number((st.oer_vals.reduce((a, b) => a + b, 0) / st.oer_vals.length).toFixed(2)) : null;
      st.annual_cpo_yield = st.annual_ffb_yield && st.annual_avg_oer ? Number((st.annual_ffb_yield * st.annual_avg_oer / 100).toFixed(2)) : null;
    });
  }

  // Convert to array and calculate total CPO production
  const statesArr = Object.values(statesObj);
  const totalCPO = statesArr.reduce((sum, s) => sum + (s.annual_cpo_production || 0), 0);

  // Sort descending by CPO Production
  statesArr.sort((a, b) => (b.annual_cpo_production || 0) - (a.annual_cpo_production || 0));

  // 1. Chart: State CPO Production Bar Chart
  const ctxProd = document.getElementById("chart-state-production");
  if (ctxProd) {
    if (chartStateProd) chartStateProd.destroy();
    chartStateProd = new Chart(ctxProd, {
      type: "bar",
      data: {
        labels: statesArr.map(s => s.state_name),
        datasets: [{
          label: "CPO Production (Tonnes)",
          data: statesArr.map(s => s.annual_cpo_production || 0),
          backgroundColor: statesArr.map(s => {
            if (s.state_name === "Sabah") return "#22c55e";
            if (s.state_name === "Sarawak") return "#10b981";
            if (s.state_name === "Pahang") return "#3b82f6";
            if (s.state_name === "Johor") return "#6366f1";
            if (s.state_name === "Perak") return "#a855f7";
            return "#64748b";
          }),
          borderRadius: 4
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: ctx => `CPO: ${formatNumber(ctx.parsed.x)} Tonnes (${totalCPO > 0 ? (ctx.parsed.x / totalCPO * 100).toFixed(1) : 0}%)`
            }
          }
        },
        scales: {
          x: { ticks: { color: "#64748b", font: { size: 10 }, callback: v => (v / 1000000).toFixed(2) + "M" }, grid: { color: "rgba(51,65,85,0.15)" } },
          y: { ticks: { color: "#cbd5e1", font: { size: 11, weight: '500' } }, grid: { display: false } }
        }
      }
    });
  }

  // 2. Chart: State Market Share Donut
  const ctxShare = document.getElementById("chart-state-share");
  if (ctxShare) {
    if (chartStateShare) chartStateShare.destroy();
    
    // Top 5 states + Others
    const top5 = statesArr.slice(0, 5);
    const othersVol = statesArr.slice(5).reduce((sum, s) => sum + (s.annual_cpo_production || 0), 0);
    const shareLabels = [...top5.map(s => s.state_name), "Others"];
    const shareData = [...top5.map(s => s.annual_cpo_production || 0), othersVol];

    chartStateShare = new Chart(ctxShare, {
      type: "doughnut",
      data: {
        labels: shareLabels,
        datasets: [{
          data: shareData,
          backgroundColor: ["#22c55e", "#10b981", "#3b82f6", "#6366f1", "#a855f7", "#475569"],
          borderWidth: 1,
          borderColor: "#0f172a"
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: "60%",
        plugins: {
          legend: { position: "right", labels: { color: "#94a3b8", boxWidth: 10, font: { size: 10 } } },
          tooltip: {
            callbacks: {
              label: ctx => `${ctx.label}: ${totalCPO > 0 ? (ctx.parsed / totalCPO * 100).toFixed(1) : 0}% (${formatNumber(ctx.parsed)} T)`
            }
          }
        }
      }
    });
  }

  // 3. Chart: State FFB Yield & OER Grouped Bar Chart
  const ctxYields = document.getElementById("chart-state-yields");
  if (ctxYields) {
    if (chartStateYields) chartStateYields.destroy();
    
    // Filter states that have valid yields
    const validYieldStates = statesArr.filter(s => s.annual_ffb_yield !== null && s.annual_ffb_yield > 0);

    chartStateYields = new Chart(ctxYields, {
      type: "bar",
      data: {
        labels: validYieldStates.map(s => s.state_name),
        datasets: [
          {
            label: "FFB Yield (T/Ha)",
            data: validYieldStates.map(s => s.annual_ffb_yield),
            backgroundColor: "#3b82f6",
            yAxisID: "y",
            borderRadius: 4
          },
          {
            label: "Mill OER (%)",
            data: validYieldStates.map(s => s.annual_avg_oer),
            backgroundColor: "#eab308",
            yAxisID: "y1",
            borderRadius: 4
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: "#94a3b8", boxWidth: 10, font: { size: 10 } } },
          tooltip: {
            callbacks: {
              label: ctx => `${ctx.dataset.label}: ${ctx.parsed.y} ${ctx.dataset.label.includes('%') ? '%' : 'T/Ha'}`
            }
          }
        },
        scales: {
          x: { ticks: { color: "#94a3b8", font: { size: 10 } }, grid: { color: "rgba(51,65,85,0.15)" } },
          y: {
            type: "linear",
            position: "left",
            ticks: { color: "#3b82f6", font: { size: 10 }, callback: v => v + " T" },
            grid: { color: "rgba(51,65,85,0.15)" }
          },
          y1: {
            type: "linear",
            position: "right",
            ticks: { color: "#eab308", font: { size: 10 }, callback: v => v + "%" },
            grid: { drawOnChartArea: false }
          }
        }
      }
    });
  }

  // 4. Populate State Ranking Table
  const tbody = document.getElementById("state-ranking-tbody");
  if (!tbody) return;
  tbody.innerHTML = "";

  const regionLookup = {
    "Johor": "Peninsular (South)",
    "Kedah": "Peninsular (North)",
    "Kelantan": "Peninsular (East)",
    "Melaka": "Peninsular (Central)",
    "Negeri Sembilan": "Peninsular (Central)",
    "Pahang": "Peninsular (East)",
    "Perak": "Peninsular (North)",
    "Perlis": "Peninsular (North)",
    "Pulau Pinang": "Peninsular (North)",
    "Selangor": "Peninsular (Central)",
    "Terengganu": "Peninsular (East)",
    "Sabah": "Sabah",
    "Sarawak": "Sarawak"
  };

  statesArr.forEach((s, idx) => {
    const share = totalCPO > 0 ? (s.annual_cpo_production / totalCPO * 100) : 0;
    const region = regionLookup[s.state_name] || "Peninsular";
    const tr = document.createElement("tr");
    tr.className = "hover:bg-slate-800/40 transition";
    tr.innerHTML = `
      <td class="py-2 px-3 text-center font-bold ${idx < 3 ? 'text-amber-400' : 'text-slate-400'}">#${idx + 1}</td>
      <td class="py-2 px-3 font-semibold text-white whitespace-nowrap">${s.state_name}</td>
      <td class="py-2 px-3 text-slate-400 whitespace-nowrap">${region}</td>
      <td class="py-2 px-3 text-right font-bold text-emerald-400 font-mono">${formatNumber(s.annual_cpo_production)}</td>
      <td class="py-2 px-3 text-right font-semibold text-slate-200 font-mono">${share > 0 ? share.toFixed(2) + '%' : '--'}</td>
      <td class="py-2 px-3 text-right text-slate-400 font-mono">${formatNumber(s.annual_ffb_processed)}</td>
      <td class="py-2 px-3 text-right text-blue-400 font-medium font-mono">${s.annual_ffb_yield ? s.annual_ffb_yield.toFixed(2) : '--'}</td>
      <td class="py-2 px-3 text-right text-amber-400 font-bold font-mono">${s.annual_avg_oer ? s.annual_avg_oer.toFixed(2) + '%' : '--'}</td>
      <td class="py-2 px-3 text-right text-purple-400 font-bold font-mono">${s.annual_cpo_yield ? s.annual_cpo_yield.toFixed(2) : '--'}</td>
    `;
    tbody.appendChild(tr);
  });
}

// -------------------------------------------------------------
// Product Export Breakdown (Report 34)
// -------------------------------------------------------------

async function loadExportProductsData() {
  try {
    const res = await fetch("/api/export-products?start_year=2005&end_year=2026").catch(() => null) || await fetch("api_export_products.json");
    exportProductsData = await res.json();
    renderExportBreakdown();
    renderExportProductsTable();
  } catch (err) {
    console.error("Failed to load export products data:", err);
  }
}

function renderExportBreakdown() {
  if (!exportProductsData || !exportProductsData.data || !exportProductsData.data.length) return;

  const data = exportProductsData.data;
  const latest = data[data.length - 1];

  // 1. KPI Cards
  const elTotVol = document.getElementById("exp-kpi-total-vol");
  if (elTotVol) elTotVol.textContent = formatNumber(latest.palm_oil_total_tonnes) + " T";
  
  const elTotVolSub = document.getElementById("exp-kpi-total-vol-sub");
  if (elTotVolSub) elTotVolSub.textContent = `All Products: ${formatNumber(latest.total_all_products_tonnes)} T`;

  const elTotRm = document.getElementById("exp-kpi-total-rm");
  if (elTotRm) elTotRm.textContent = "RM " + formatNumber(latest.total_all_products_rm_mil) + " Mil";

  const elTotRmSub = document.getElementById("exp-kpi-total-rm-sub");
  if (elTotRmSub) elTotRmSub.textContent = `Palm Oil Only: RM ${formatNumber(latest.palm_oil_total_rm_mil)} Mil`;

  const elAvgPrice = document.getElementById("exp-kpi-avg-price");
  if (elAvgPrice) elAvgPrice.textContent = "RM " + formatNumber(latest.total_all_products_unit_price_rm_tonne);

  const elDownShare = document.getElementById("exp-kpi-downstream-share");
  if (elDownShare) {
    const ppo = latest.ppo_tonnes || 0;
    const oleo = latest.oleochemicals_tonnes || 0;
    const bio = latest.biodiesel_tonnes || 0;
    const fin = latest.finished_products_tonnes || 0;
    const tot = latest.total_all_products_tonnes || 1;
    const pct = ((ppo + oleo + bio + fin) / tot) * 100;
    elDownShare.textContent = pct.toFixed(1) + "%";
  }

  // 2. Chart: Export Volume Breakdown (Stacked)
  const ctxVol = document.getElementById("chart-export-volume");
  if (ctxVol) {
    if (chartExportVol) chartExportVol.destroy();

    let labels = [];
    let cpo = [], ppo = [], oleo = [], bio = [], pko = [], pkc = [];

    if (exportCadence === 'annual') {
      const years = [...new Set(data.map(r => r.year))].sort((a, b) => a - b);
      labels = years.map(y => `${y}${y === 2026 ? ' (YTD)' : ''}`);

      years.forEach(y => {
        const yRecs = data.filter(r => r.year === y);
        const sum = field => yRecs.reduce((s, r) => s + (r[field] || 0), 0);
        cpo.push(sum("cpo_tonnes"));
        ppo.push(sum("ppo_tonnes"));
        oleo.push(sum("oleochemicals_tonnes"));
        bio.push(sum("biodiesel_tonnes"));
        pko.push(sum("pko_total_tonnes"));
        pkc.push(sum("palm_kernel_cake_tonnes"));
      });
    } else {
      labels = data.map(r => r.period);
      cpo = data.map(r => r.cpo_tonnes);
      ppo = data.map(r => r.ppo_tonnes);
      oleo = data.map(r => r.oleochemicals_tonnes);
      bio = data.map(r => r.biodiesel_tonnes);
      pko = data.map(r => r.pko_total_tonnes);
      pkc = data.map(r => r.palm_kernel_cake_tonnes);
    }

    chartExportVol = new Chart(ctxVol, {
      type: "bar",
      data: {
        labels: labels,
        datasets: [
          { label: "Processed Palm Oil (PPO)", data: ppo, backgroundColor: "#10b981", stack: "export" },
          { label: "Crude Palm Oil (CPO)", data: cpo, backgroundColor: "#3b82f6", stack: "export" },
          { label: "Oleochemicals", data: oleo, backgroundColor: "#a855f7", stack: "export" },
          { label: "Palm Kernel Cake (PKC)", data: pkc, backgroundColor: "#f97316", stack: "export" },
          { label: "Palm Kernel Oil (PKO)", data: pko, backgroundColor: "#eab308", stack: "export" },
          { label: "Biodiesel", data: bio, backgroundColor: "#06b6d4", stack: "export" }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: "#94a3b8", boxWidth: 10, font: { size: 10 } } },
          tooltip: {
            callbacks: {
              label: ctx => `${ctx.dataset.label}: ${formatNumber(ctx.parsed.y)} Tonnes`
            }
          }
        },
        scales: {
          x: { stacked: true, ticks: { color: "#64748b", maxTicksLimit: 14, font: { size: 10 } }, grid: { color: "rgba(51,65,85,0.15)" } },
          y: { stacked: true, ticks: { color: "#64748b", font: { size: 10 }, callback: v => (v / 1000000).toFixed(1) + "M" }, grid: { color: "rgba(51,65,85,0.15)" } }
        }
      }
    });
  }

  // 3. Chart: Product Mix Donut
  const ctxPie = document.getElementById("chart-export-pie");
  if (ctxPie) {
    if (chartExportPie) chartExportPie.destroy();

    const pieLabels = ["PPO", "CPO", "Oleochemicals", "PKC", "PKO", "Biodiesel", "Others"];
    const pieData = [
      latest.ppo_tonnes || 0,
      latest.cpo_tonnes || 0,
      latest.oleochemicals_tonnes || 0,
      latest.palm_kernel_cake_tonnes || 0,
      latest.pko_total_tonnes || 0,
      latest.biodiesel_tonnes || 0,
      latest.others_tonnes || 0
    ];

    chartExportPie = new Chart(ctxPie, {
      type: "doughnut",
      data: {
        labels: pieLabels,
        datasets: [{
          data: pieData,
          backgroundColor: ["#10b981", "#3b82f6", "#a855f7", "#f97316", "#eab308", "#06b6d4", "#64748b"],
          borderWidth: 1,
          borderColor: "#0f172a"
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: "60%",
        plugins: {
          legend: { position: "right", labels: { color: "#94a3b8", boxWidth: 10, font: { size: 10 } } },
          tooltip: {
            callbacks: {
              label: ctx => {
                const tot = latest.total_all_products_tonnes || 1;
                return `${ctx.label}: ${(ctx.parsed / tot * 100).toFixed(1)}% (${formatNumber(ctx.parsed)} T)`;
              }
            }
          }
        }
      }
    });
  }

  // 4. Chart: Revenue & Realized Unit Price
  const ctxRev = document.getElementById("chart-export-revenue");
  if (ctxRev) {
    if (chartExportRev) chartExportRev.destroy();

    const labels = data.map(r => r.period);
    const revenue = data.map(r => r.total_all_products_rm_mil);
    const unitPrice = data.map(r => r.total_all_products_unit_price_rm_tonne);

    chartExportRev = new Chart(ctxRev, {
      type: "line",
      data: {
        labels: labels,
        datasets: [
          {
            type: "bar",
            label: "Export Revenue (RM Mil)",
            data: revenue,
            backgroundColor: "rgba(16, 185, 129, 0.3)",
            borderColor: "#10b981",
            borderWidth: 1,
            yAxisID: "y",
            borderRadius: 2
          },
          {
            type: "line",
            label: "Average Export Realization (RM / Tonne)",
            data: unitPrice,
            borderColor: "#f59e0b",
            borderWidth: 2,
            tension: 0.2,
            pointRadius: labels.length > 60 ? 0 : 2,
            yAxisID: "y1"
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        plugins: {
          legend: { labels: { color: "#94a3b8", boxWidth: 10, font: { size: 10 } } },
          tooltip: {
            callbacks: {
              label: ctx => ctx.dataset.label.includes('RM Mil') ? `Revenue: RM ${formatNumber(ctx.parsed.y)} Mil` : `Realization: RM ${formatNumber(ctx.parsed.y)} / Tonne`
            }
          }
        },
        scales: {
          x: { ticks: { color: "#64748b", maxTicksLimit: 14, font: { size: 10 } }, grid: { color: "rgba(51,65,85,0.15)" } },
          y: {
            type: "linear",
            position: "left",
            ticks: { color: "#10b981", font: { size: 10 }, callback: v => "RM " + (v / 1000).toFixed(1) + "B" },
            grid: { color: "rgba(51,65,85,0.15)" }
          },
          y1: {
            type: "linear",
            position: "right",
            ticks: { color: "#f59e0b", font: { size: 10 }, callback: v => "RM " + v },
            grid: { drawOnChartArea: false }
          }
        }
      }
    });
  }
}

function toggleExportCadence(cadence) {
  exportCadence = cadence;
  const btnM = document.getElementById("btn-exp-monthly");
  const btnA = document.getElementById("btn-exp-annual");
  if (btnM && btnA) {
    if (cadence === 'monthly') {
      btnM.className = "px-2.5 py-1 rounded bg-emerald-600 font-semibold text-white transition";
      btnA.className = "px-2.5 py-1 rounded hover:bg-slate-700 text-slate-300 transition";
    } else {
      btnA.className = "px-2.5 py-1 rounded bg-emerald-600 font-semibold text-white transition";
      btnM.className = "px-2.5 py-1 rounded hover:bg-slate-700 text-slate-300 transition";
    }
  }
  renderExportBreakdown();
}

function toggleExportTableView() {
  isExportAnnualView = !isExportAnnualView;
  const btn = document.getElementById("btn-toggle-exp-view");
  if (btn) btn.textContent = isExportAnnualView ? "Switch to Monthly Detailed" : "Switch to Annual Totals";
  renderExportProductsTable();
}

function filterExportTable() {
  renderExportProductsTable();
}

function renderExportProductsTable() {
  const tbody = document.getElementById("export-products-tbody");
  if (!tbody || !exportProductsData || !exportProductsData.data) return;
  tbody.innerHTML = "";

  const query = document.getElementById("export-search-input") ? document.getElementById("export-search-input").value.toLowerCase().trim() : "";
  let records = [];

  if (isExportAnnualView) {
    const byYear = {};
    exportProductsData.data.forEach(r => {
      if (!byYear[r.year]) {
        byYear[r.year] = {
          year: r.year,
          months_count: 0,
          total_all_products_tonnes: 0,
          total_all_products_rm_mil: 0,
          cpo_tonnes: 0,
          ppo_tonnes: 0,
          oleochemicals_tonnes: 0,
          biodiesel_tonnes: 0,
          pko_total_tonnes: 0,
          palm_kernel_cake_tonnes: 0,
          finished_products_tonnes: 0
        };
      }
      const y = byYear[r.year];
      y.months_count++;
      y.total_all_products_tonnes += (r.total_all_products_tonnes || 0);
      y.total_all_products_rm_mil += (r.total_all_products_rm_mil || 0);
      y.cpo_tonnes += (r.cpo_tonnes || 0);
      y.ppo_tonnes += (r.ppo_tonnes || 0);
      y.oleochemicals_tonnes += (r.oleochemicals_tonnes || 0);
      y.biodiesel_tonnes += (r.biodiesel_tonnes || 0);
      y.pko_total_tonnes += (r.pko_total_tonnes || 0);
      y.palm_kernel_cake_tonnes += (r.palm_kernel_cake_tonnes || 0);
      y.finished_products_tonnes += (r.finished_products_tonnes || 0);
    });

    Object.values(byYear).forEach(y => {
      const avgPrice = y.total_all_products_tonnes > 0 ? (y.total_all_products_rm_mil * 1000000 / y.total_all_products_tonnes) : 0;
      records.push({
        period: `${y.year} (Annual${y.months_count < 12 ? ' YTD' : ''})`,
        ...y,
        total_all_products_unit_price_rm_tonne: avgPrice
      });
    });
    records.sort((a, b) => b.year - a.year);
  } else {
    records = [...exportProductsData.data].reverse();
  }

  const filtered = records.filter(r => !query || r.period.toLowerCase().includes(query));

  filtered.slice(0, 100).forEach(r => {
    const tr = document.createElement("tr");
    tr.className = "hover:bg-slate-800/40 transition";
    tr.innerHTML = `
      <td class="py-2 px-3 font-semibold text-white whitespace-nowrap">${r.period}</td>
      <td class="py-2 px-3 text-right text-emerald-400 font-bold">${formatNumber(r.total_all_products_tonnes)}</td>
      <td class="py-2 px-3 text-right text-emerald-300 font-bold">${r.total_all_products_rm_mil ? r.total_all_products_rm_mil.toFixed(2) : '--'}</td>
      <td class="py-2 px-3 text-right text-amber-400 font-medium">RM ${formatNumber(r.total_all_products_unit_price_rm_tonne)}</td>
      <td class="py-2 px-3 text-right text-blue-400">${formatNumber(r.cpo_tonnes)}</td>
      <td class="py-2 px-3 text-right text-blue-300">${formatNumber(r.ppo_tonnes)}</td>
      <td class="py-2 px-3 text-right text-purple-400 font-medium">${formatNumber(r.oleochemicals_tonnes)}</td>
      <td class="py-2 px-3 text-right text-cyan-400">${formatNumber(r.biodiesel_tonnes)}</td>
      <td class="py-2 px-3 text-right text-yellow-400">${formatNumber(r.pko_total_tonnes)}</td>
      <td class="py-2 px-3 text-right text-orange-400">${formatNumber(r.palm_kernel_cake_tonnes)}</td>
      <td class="py-2 px-3 text-right text-pink-400">${formatNumber(r.finished_products_tonnes)}</td>
    `;
    tbody.appendChild(tr);
  });
}


function renderYieldSummaryTable() {
  const tbody = document.getElementById("yield-summary-tbody");
  if (!tbody) return;
  tbody.innerHTML = "";

  // Group by year to show annual averages
  const years = [...new Set(filteredData.map(r => r.year))].sort((a, b) => b - a);

  years.forEach(y => {
    const yRecs = filteredData.filter(r => r.year === y);
    const avg = (field) => {
      const vals = yRecs.map(r => r[field]).filter(v => v !== null && v !== undefined);
      return vals.length ? (vals.reduce((a, b) => a + b, 0) / vals.length) : null;
    };
    const sum = (field) => {
      const vals = yRecs.map(r => r[field]).filter(v => v !== null && v !== undefined);
      return vals.length ? vals.reduce((a, b) => a + b, 0) : null;
    };

    const ffbMy = avg("ffb_yield_malaysia");
    const ffbPen = avg("ffb_yield_peninsular");
    const ffbSS = avg("ffb_yield_sabah_sarawak");
    const oer = avg("oer_malaysia");
    const cpoYield = avg("cpo_yield_malaysia");
    const totProd = sum("cpo_production");

    const tr = document.createElement("tr");
    tr.className = "hover:bg-slate-800/40 transition";
    tr.innerHTML = `
      <td class="py-2.5 px-4 font-bold text-white">${y}</td>
      <td class="py-2.5 px-4 text-right text-emerald-400">${ffbMy ? ffbMy.toFixed(2) : '--'}</td>
      <td class="py-2.5 px-4 text-right text-slate-300">${ffbPen ? ffbPen.toFixed(2) : '--'}</td>
      <td class="py-2.5 px-4 text-right text-slate-300">${ffbSS ? ffbSS.toFixed(2) : '--'}</td>
      <td class="py-2.5 px-4 text-right text-amber-400 font-bold">${oer ? oer.toFixed(2) + '%' : '--'}</td>
      <td class="py-2.5 px-4 text-right text-emerald-300 font-bold">${cpoYield ? cpoYield.toFixed(2) : '--'}</td>
      <td class="py-2.5 px-4 text-right text-blue-400 font-medium">${formatNumber(totProd)}</td>
    `;
    tbody.appendChild(tr);
  });
}

function renderHeatmap() {
  const container = document.getElementById("heatmap-container");
  if (!container) return;

  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const years = [...new Set(masterData.map(r => r.year))].sort((a, b) => b - a);

  let html = `<div class="heatmap-grid pb-2 border-b border-slate-800 mb-1">
    <div class="heatmap-header text-left">Year</div>
    ${months.map(m => `<div class="heatmap-header">${m}</div>`).join('')}
    <div class="heatmap-header text-right">Total</div>
  </div>`;

  years.forEach(y => {
    const yRecs = masterData.filter(r => r.year === y);
    const yTotal = yRecs.reduce((sum, r) => sum + (r.cpo_production || 0), 0);

    html += `<div class="heatmap-grid items-center py-0.5">
      <div class="font-bold text-slate-300 text-xs">${y}</div>`;

    for (let m = 1; m <= 12; m++) {
      const rec = yRecs.find(r => r.month === m);
      const prod = rec ? rec.cpo_production : null;
      let bg = "background: rgba(30, 41, 59, 0.3); color: #475569;";
      let title = "No data";

      if (prod !== null && prod !== undefined) {
        title = `${months[m-1]} ${y}: ${formatNumber(prod)} Tonnes`;
        // Normalize between 1.0M and 2.1M tonnes
        const ratio = Math.max(0, Math.min(1, (prod - 1000000) / 1100000));
        if (ratio < 0.25) {
          bg = "background: rgba(6, 78, 59, 0.4); color: #a7f3d0;";
        } else if (ratio < 0.5) {
          bg = "background: rgba(6, 95, 70, 0.7); color: #d1fae5;";
        } else if (ratio < 0.75) {
          bg = "background: rgba(16, 185, 129, 0.85); color: #022c22; font-weight: bold;";
        } else {
          bg = "background: rgba(52, 211, 153, 1); color: #022c22; font-weight: bold;";
        }
      }

      html += `<div class="heatmap-cell" style="${bg}" title="${title}">
        ${prod ? (prod / 1000000).toFixed(2) : '-'}
      </div>`;
    }

    html += `<div class="text-right font-semibold text-xs text-emerald-400">${(yTotal / 1000000).toFixed(2)}M</div>
    </div>`;
  });

  container.innerHTML = html;
}

function renderExplorerTable(filterText = "") {
  const tbody = document.getElementById("explorer-tbody");
  if (!tbody) return;
  tbody.innerHTML = "";

  const q = filterText.toLowerCase().trim();
  const matched = filteredData.filter(r => {
    if (!q) return true;
    return r.period.toLowerCase().includes(q) || r.month_name.toLowerCase().includes(q);
  });

  matched.slice(0, 100).forEach(r => {
    const tr = document.createElement("tr");
    tr.className = "hover:bg-slate-800/40 transition";
    tr.innerHTML = `
      <td class="py-2 px-3 font-semibold text-white whitespace-nowrap">${r.period}</td>
      <td class="py-2 px-3 text-right text-emerald-400 font-medium">${formatNumber(r.cpo_production)}</td>
      <td class="py-2 px-3 text-right text-amber-400">${formatNumber(r.palm_oil_stock)}</td>
      <td class="py-2 px-3 text-right text-blue-400">${formatNumber(r.palm_oil_export)}</td>
      <td class="py-2 px-3 text-right text-slate-400">${formatNumber(r.palm_oil_import)}</td>
      <td class="py-2 px-3 text-right text-purple-400">${formatNumber(r.domestic_disappearance)}</td>
      <td class="py-2 px-3 text-right text-emerald-300">${r.ffb_yield_malaysia ? r.ffb_yield_malaysia.toFixed(3) : '--'}</td>
      <td class="py-2 px-3 text-right text-amber-300">${r.oer_malaysia ? r.oer_malaysia.toFixed(2) + '%' : '--'}</td>
      <td class="py-2 px-3 text-right text-emerald-400 font-bold">${r.cpo_yield_malaysia ? r.cpo_yield_malaysia.toFixed(3) : '--'}</td>
      <td class="py-2 px-3 text-right text-slate-200">${r.ffb_price_1pct_oer ? 'RM ' + r.ffb_price_1pct_oer.toFixed(2) : '--'}</td>
      <td class="py-2 px-3 text-right text-slate-400">${formatNumber(r.palm_kernel_production)}</td>
      <td class="py-2 px-3 text-right text-slate-400">${formatNumber(r.palm_kernel_oil_production)}</td>
    `;
    tbody.appendChild(tr);
  });
}

function filterExplorerTable() {
  const query = document.getElementById("explorer-search").value;
  renderExplorerTable(query);
}

function formatNumber(num) {
  if (num === null || num === undefined) return "--";
  return Number(num).toLocaleString("en-US", { maximumFractionDigits: 0 });
}

// -------------------------------------------------------------
// Forward Projections & Interactive Simulator (September 2026 Forward)
// -------------------------------------------------------------

const PROJ_BASE = {
  begStock: 2824488,
  augProd: 1817499,
  augExp: 1294664,
  baseProdPct: 1.51,
  baseExpTonnes: 1420000,
  baseDomTonnes: 365000,
  baseImpTonnes: 50000
};

function updateSensitivitySimulation() {
  const prodPctInput = document.getElementById("slider-prod-pct");
  const expInput = document.getElementById("slider-exp");
  const domInput = document.getElementById("slider-dom");
  if (!prodPctInput || !expInput || !domInput) return;

  const prodPct = parseFloat(prodPctInput.value);
  const expTonnes = parseFloat(expInput.value);
  const domTonnes = parseFloat(domInput.value);
  const impTonnes = PROJ_BASE.baseImpTonnes;

  // Calculate implied values for September 2026
  const prodTonnes = Math.round(PROJ_BASE.augProd * (1 + prodPct / 100));
  const expMoMPct = ((expTonnes - PROJ_BASE.augExp) / PROJ_BASE.augExp) * 100;

  // Ending Stock = Beg Stock + Prod + Imp - Exp - Dom
  const endingStock = PROJ_BASE.begStock + prodTonnes + impTonnes - expTonnes - domTonnes;
  const buildTonnes = endingStock - PROJ_BASE.begStock;
  const buildPct = (buildTonnes / PROJ_BASE.begStock) * 100;

  const totalUse = expTonnes + domTonnes;
  const stockToUse = totalUse > 0 ? (endingStock / totalUse) * 100 : 0;
  const daysSupply = totalUse > 0 ? (endingStock / (totalUse / 30.5)).toFixed(1) : "--";

  // Update DOM elements
  const elProdPct = document.getElementById("slider-prod-pct-val");
  if (elProdPct) elProdPct.textContent = (prodPct >= 0 ? "+" : "") + prodPct.toFixed(2) + "%";

  const elSimProdT = document.getElementById("sim-prod-tonnes");
  if (elSimProdT) elSimProdT.textContent = formatNumber(prodTonnes);

  const elExpVal = document.getElementById("slider-exp-val");
  if (elExpVal) elExpVal.textContent = formatNumber(expTonnes) + " T";

  const elSimExpPct = document.getElementById("sim-exp-pct");
  if (elSimExpPct) elSimExpPct.textContent = (expMoMPct >= 0 ? "+" : "") + expMoMPct.toFixed(2) + "%";

  const elDomVal = document.getElementById("slider-dom-val");
  if (elDomVal) elDomVal.textContent = formatNumber(domTonnes) + " T";

  const elSimStock = document.getElementById("sim-result-stock");
  if (elSimStock) elSimStock.textContent = formatNumber(endingStock) + " Tonnes";

  const elSimBuild = document.getElementById("sim-result-build");
  if (elSimBuild) {
    const isBuild = buildTonnes >= 0;
    elSimBuild.textContent = `${isBuild ? "+" : ""}${formatNumber(buildTonnes)} T (${isBuild ? "+" : ""}${buildPct.toFixed(2)}% MoM)`;
    elSimBuild.className = isBuild ? "font-bold text-amber-400 font-mono" : "font-bold text-emerald-400 font-mono";
  }

  const elSimStu = document.getElementById("sim-result-stu");
  if (elSimStu) elSimStu.textContent = stockToUse.toFixed(1) + "%";

  const elSimDays = document.getElementById("sim-result-days");
  if (elSimDays) elSimDays.textContent = daysSupply + " Days";
}

function resetSensitivitySimulator() {
  const prodPctInput = document.getElementById("slider-prod-pct");
  const expInput = document.getElementById("slider-exp");
  const domInput = document.getElementById("slider-dom");
  if (prodPctInput) prodPctInput.value = PROJ_BASE.baseProdPct;
  if (expInput) expInput.value = PROJ_BASE.baseExpTonnes;
  if (domInput) domInput.value = PROJ_BASE.baseDomTonnes;
  updateSensitivitySimulation();
}
