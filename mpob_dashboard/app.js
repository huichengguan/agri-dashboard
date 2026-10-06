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
  loadWorkdayData();
  loadSppomaData();

  if (window.lucide) lucide.createIcons();
});

// Universal Fetch Helper (Works seamlessly on GitHub Pages, file://, and local API servers)
async function fetchJsonData(apiPath, staticFile) {
  const isStaticHost = window.location.protocol === "file:" ||
                       window.location.hostname.endsWith("github.io") ||
                       (window.location.hostname === "localhost" && window.location.pathname.includes("/dashboard/"));
  if (isStaticHost) {
    try {
      const staticRes = await fetch(staticFile, { cache: "no-cache" });
      if (staticRes.ok) return await staticRes.json();
    } catch (e) {
      console.warn("Static fetch fallback:", e);
    }
  }

  try {
    const res = await fetch(apiPath);
    if (res.ok) {
      const ct = res.headers.get("content-type") || "";
      if (ct.includes("application/json")) {
        return await res.json();
      }
    }
  } catch (e) {}

  const fallbackRes = await fetch(staticFile);
  if (!fallbackRes.ok) throw new Error(`Failed to load ${staticFile} (HTTP ${fallbackRes.status})`);
  return await fallbackRes.json();
}

async function loadInitialData() {
  try {
    const json = await fetchJsonData("/api/data?start_year=2005&end_year=2026", "api_data.json");
    masterData = json.data;
    filteredData = [...masterData];
    metadata = json.metadata;

    const sumJson = await fetchJsonData("/api/summary", "api_summary.json");
    latestSnapshot = sumJson.latest_snapshot;

    const seasJson = await fetchJsonData("/api/seasonality", "api_seasonality.json");
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
    el.classList.remove("active", "border-emerald-500", "border-amber-500", "border-cyan-500", "border-indigo-500", "text-white", "text-amber-300", "text-cyan-300", "text-indigo-300");
    el.classList.add("border-transparent", "text-slate-400");
  });

  const target = document.getElementById(`tab-${tabId}`);
  const btn = document.getElementById(`tab-btn-${tabId}`);
  if (target && btn) {
    target.classList.remove("hidden");
    if (tabId === 'projections') {
      btn.classList.add("active", "border-amber-500", "text-amber-300");
    } else if (tabId === 'workdays') {
      btn.classList.add("active", "border-cyan-500", "text-cyan-300");
    } else if (tabId === 'sppoma') {
      btn.classList.add("active", "border-indigo-500", "text-indigo-300");
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
  if (tabId === 'workdays') {
    if (!workdayData) {
      loadWorkdayData();
    } else {
      if (chartWorkdayRunRate) chartWorkdayRunRate.resize();
    }
  }
  if (tabId === 'sppoma') {
    if (!sppomaData) {
      loadSppomaData();
    } else {
      if (chartSppomaProgression) chartSppomaProgression.resize();
      if (chartSppomaMultiYear) chartSppomaMultiYear.resize();
    }
  }
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
    stateData = await fetchJsonData("/api/state-data?start_year=2005&end_year=2026", "api_state_data.json");
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
    exportProductsData = await fetchJsonData("/api/export-products?start_year=2005&end_year=2026", "api_export_products.json");
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
  baseProdPct: 6.50,
  baseExpTonnes: 1105000,
  baseDomTonnes: 355000,
  baseImpTonnes: 45000
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

// -------------------------------------------------------------
// Workday Analytics & Labor Calendar Implementation
// -------------------------------------------------------------

let workdayData = null;
let chartWorkdayRunRate = null;

async function loadWorkdayData() {
  try {
    const json = await fetchJsonData("/api/workdays?start_year=2010&end_year=2027", "api_workdays.json");
    workdayData = json.data;
    setupWorkdaySelectors();
    renderWorkdayMonthDetail(2026, 9); // default to September 2026
    renderWorkdayRunRateChart();
    renderWorkdayHeatmap();
    renderWorkdayTable();
    if (window.lucide) lucide.createIcons();
  } catch (err) {
    console.error("Failed to load workday analytics:", err);
  }
}

function setupWorkdaySelectors() {
  const ySelect = document.getElementById("workday-year-select");
  const mSelect = document.getElementById("workday-month-select");
  if (!ySelect || !mSelect) return;

  ySelect.innerHTML = "";
  mSelect.innerHTML = "";

  for (let y = 2010; y <= 2027; y++) {
    const opt = document.createElement("option");
    opt.value = y;
    opt.textContent = y;
    if (y === 2026) opt.selected = true;
    ySelect.appendChild(opt);
  }

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  monthNames.forEach((name, idx) => {
    const opt = document.createElement("option");
    opt.value = idx + 1;
    opt.textContent = `${idx + 1} - ${name}`;
    if (idx + 1 === 9) opt.selected = true; // September default
    mSelect.appendChild(opt);
  });
}

function onWorkdayMonthChange() {
  const ySelect = document.getElementById("workday-year-select");
  const mSelect = document.getElementById("workday-month-select");
  if (!ySelect || !mSelect) return;
  const y = parseInt(ySelect.value);
  const m = parseInt(mSelect.value);
  renderWorkdayMonthDetail(y, m);
}

function renderWorkdayMonthDetail(year, month) {
  if (!workdayData) return;
  const rec = workdayData.find(r => r.year === year && r.month === month);
  if (!rec) return;

  const cardsContainer = document.getElementById("workday-month-cards");
  if (cardsContainer) {
    cardsContainer.innerHTML = `
      <div class="bg-slate-950/70 p-3 rounded-lg border border-slate-800">
        <span class="text-slate-400 block text-[11px]">Calendar Days</span>
        <span class="text-lg font-bold text-white font-mono mt-0.5">${rec.calendar_days}</span>
        <span class="text-[10px] text-slate-500 block">Total month days</span>
      </div>
      <div class="bg-slate-950/70 p-3 rounded-lg border border-slate-800">
        <span class="text-slate-400 block text-[11px]">Sundays (Rest)</span>
        <span class="text-lg font-bold text-slate-300 font-mono mt-0.5">${rec.sundays_count}</span>
        <span class="text-[10px] text-slate-500 block">Statutory rest</span>
      </div>
      <div class="bg-slate-950/70 p-3 rounded-lg border border-slate-800">
        <span class="text-slate-400 block text-[11px]">Public Holidays</span>
        <span class="text-lg font-bold text-rose-400 font-mono mt-0.5">${rec.national_holidays_count}</span>
        <span class="text-[10px] text-slate-500 block">Gazetted (Mon-Sat)</span>
      </div>
      <div class="bg-cyan-950/30 p-3 rounded-lg border border-cyan-500/30">
        <span class="text-cyan-300 block text-[11px] font-semibold">National Workdays</span>
        <span class="text-xl font-black text-cyan-300 font-mono mt-0.5">${rec.workdays_national}</span>
        <span class="text-[10px] text-cyan-400/80 block">${rec.workdays_mom_diff ? (rec.workdays_mom_diff >= 0 ? '+' : '') + rec.workdays_mom_diff + ' vs Prev Month' : '--'}</span>
      </div>
      <div class="bg-slate-950/70 p-3 rounded-lg border border-slate-800">
        <span class="text-slate-400 block text-[11px]">CPO Production</span>
        <span class="text-lg font-bold text-emerald-400 font-mono mt-0.5">${rec.cpo_production ? formatNumber(rec.cpo_production) + ' T' : (rec.is_projected ? 'Projected' : '--')}</span>
        <span class="text-[10px] text-slate-500 block">${rec.cpo_prod_mom_pct !== null && rec.cpo_prod_mom_pct !== undefined ? (rec.cpo_prod_mom_pct >= 0 ? '+' : '') + rec.cpo_prod_mom_pct.toFixed(1) + '% MoM' : '--'}</span>
      </div>
      <div class="bg-slate-950/70 p-3 rounded-lg border border-slate-800">
        <span class="text-slate-400 block text-[11px]">CPO / Workday</span>
        <span class="text-lg font-bold text-amber-300 font-mono mt-0.5">${rec.cpo_per_workday ? formatNumber(rec.cpo_per_workday) + ' T/D' : '--'}</span>
        <span class="text-[10px] text-slate-500 block">${rec.run_rate_mom_pct !== null && rec.run_rate_mom_pct !== undefined ? (rec.run_rate_mom_pct >= 0 ? '+' : '') + rec.run_rate_mom_pct.toFixed(1) + '% Run Rate' : '--'}</span>
      </div>
    `;
  }

  // Non-working schedule
  const summaryEl = document.getElementById("workday-nonworking-summary");
  if (summaryEl) {
    const totalOff = rec.sundays_count + rec.national_holidays_count;
    summaryEl.textContent = `${totalOff} Total Non-Working Days (${rec.workdays_national} Effective Harvesting Days)`;
  }

  const listEl = document.getElementById("workday-nonworking-list");
  if (listEl) {
    if (!rec.non_working_days_detail || rec.non_working_days_detail.length === 0) {
      listEl.innerHTML = `<div class="text-slate-500 text-xs py-2">No non-working days recorded for this month.</div>`;
    } else {
      listEl.innerHTML = rec.non_working_days_detail.map(item => {
        const isSun = item.type === 'rest_day';
        const badgeClass = isSun 
          ? "bg-slate-800 text-slate-300 border-slate-700" 
          : (item.type === 'regional_holiday' ? "bg-blue-950/60 text-blue-300 border-blue-800/50" : "bg-rose-950/60 text-rose-300 border-rose-800/50");
        return `
          <div class="flex items-center justify-between p-2.5 rounded-lg bg-slate-900/60 border border-slate-800/80 text-xs">
            <div class="flex items-center space-x-2">
              <span class="font-mono font-bold text-white w-6 text-center">${item.day}</span>
              <div>
                <span class="font-medium text-slate-200 block">${item.reason}</span>
                <span class="text-[10px] text-slate-400">${item.day_of_week} &bull; ${item.scope}</span>
              </div>
            </div>
            <span class="px-2 py-0.5 rounded text-[10px] border font-mono font-semibold ${badgeClass}">
              ${isSun ? 'Sunday' : 'Holiday'}
            </span>
          </div>
        `;
      }).join("");
    }
  }
}

function renderWorkdayRunRateChart() {
  const ctx = document.getElementById("chartWorkdayRunRate");
  if (!ctx || !workdayData) return;

  const dataSlice = workdayData.filter(r => r.year <= 2026 && r.cpo_production);
  const labels = dataSlice.map(r => r.period);
  const cpoProd = dataSlice.map(r => r.cpo_production);
  const runRate = dataSlice.map(r => r.cpo_per_workday);
  const workdays = dataSlice.map(r => r.workdays_national);

  if (chartWorkdayRunRate) {
    chartWorkdayRunRate.destroy();
  }

  chartWorkdayRunRate = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [
        {
          type: 'bar',
          label: 'Monthly CPO Production (Tonnes)',
          data: cpoProd,
          backgroundColor: 'rgba(16, 185, 129, 0.4)',
          borderColor: '#10b981',
          borderWidth: 1,
          yAxisID: 'y'
        },
        {
          type: 'line',
          label: 'Daily CPO Run-Rate (Tonnes / Workday)',
          data: runRate,
          borderColor: '#06b6d4',
          backgroundColor: '#06b6d4',
          borderWidth: 2,
          pointRadius: 0,
          pointHoverRadius: 4,
          tension: 0.2,
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
          grid: { color: 'rgba(51, 65, 85, 0.2)' },
          ticks: { color: '#94a3b8', font: { size: 10 }, maxTicksLimit: 24 }
        },
        y: {
          type: 'linear',
          display: true,
          position: 'left',
          grid: { color: 'rgba(51, 65, 85, 0.3)' },
          ticks: {
            color: '#10b981',
            font: { size: 10 },
            callback: v => (v / 1e6).toFixed(1) + 'M'
          },
          title: { display: true, text: 'Monthly Production (Tonnes)', color: '#10b981', font: { size: 11 } }
        },
        y1: {
          type: 'linear',
          display: true,
          position: 'right',
          grid: { drawOnChartArea: false },
          ticks: {
            color: '#06b6d4',
            font: { size: 10 },
            callback: v => (v / 1000).toFixed(0) + 'k'
          },
          title: { display: true, text: 'Daily Output / Workday (Tonnes)', color: '#06b6d4', font: { size: 11 } }
        }
      },
      plugins: {
        legend: {
          labels: { color: '#e2e8f0', font: { size: 11 } }
        },
        tooltip: {
          backgroundColor: '#0f172a',
          borderColor: '#334155',
          borderWidth: 1,
          callbacks: {
            afterBody: function(items) {
              const idx = items[0].dataIndex;
              const w = workdays[idx];
              return `Harvesting Workdays: ${w} Days`;
            }
          }
        }
      }
    }
  });
}

function renderWorkdayHeatmap() {
  const container = document.getElementById("workday-heatmap-grid");
  if (!container || !workdayData) return;

  const years = Array.from(new Set(workdayData.map(r => r.year))).sort((a,b) => b - a);
  const months = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  const monthHeaders = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  let html = `
    <table class="w-full text-xs font-mono border-collapse">
      <thead>
        <tr class="bg-slate-950 text-slate-400">
          <th class="py-2 px-2 text-left font-sans">Year</th>
          ${monthHeaders.map(m => `<th class="py-2 px-1 text-center font-sans">${m}</th>`).join('')}
          <th class="py-2 px-2 text-right font-sans text-white">Annual Total</th>
        </tr>
      </thead>
      <tbody class="divide-y divide-slate-800/60">
  `;

  years.forEach(y => {
    const yearRecords = workdayData.filter(r => r.year === y);
    const totalYearWorkdays = yearRecords.reduce((sum, r) => sum + r.workdays_national, 0).toFixed(1);

    html += `<tr>`;
    html += `<td class="py-1.5 px-2 font-bold text-white font-sans bg-slate-900/60">${y}</td>`;

    months.forEach(m => {
      const rec = yearRecords.find(r => r.month === m);
      if (!rec) {
        html += `<td class="py-1.5 px-1 text-center text-slate-600">--</td>`;
      } else {
        const w = rec.workdays_national;
        let colorClass = "bg-slate-900 text-slate-300";
        if (w < 18) colorClass = "bg-rose-950/70 text-rose-300 font-bold border border-rose-800/40";
        else if (w <= 20) colorClass = "bg-amber-950/70 text-amber-300 border border-amber-800/40";
        else if (w <= 22) colorClass = "bg-emerald-950/70 text-emerald-300 border border-emerald-800/40";
        else colorClass = "bg-cyan-950/70 text-cyan-300 font-black border border-cyan-800/50";

        html += `
          <td class="py-1.5 px-1 text-center">
            <span class="inline-block w-8 py-0.5 rounded text-[11px] ${colorClass} cursor-pointer" 
                  title="${y}-${m < 10 ? '0' + m : m}: ${w} Workdays, Sundays: ${rec.sundays_count}, Hols: ${rec.national_holidays_count}"
                  onclick="selectWorkdayCalendar(${y}, ${m})">
              ${w}
            </span>
          </td>
        `;
      }
    });

    html += `<td class="py-1.5 px-2 text-right font-bold text-cyan-400 font-mono bg-slate-900/60">${totalYearWorkdays}d</td>`;
    html += `</tr>`;
  });

  html += `</tbody></table>`;
  container.innerHTML = html;
}

function selectWorkdayCalendar(y, m) {
  const ySelect = document.getElementById("workday-year-select");
  const mSelect = document.getElementById("workday-month-select");
  if (ySelect) ySelect.value = y;
  if (mSelect) mSelect.value = m;
  renderWorkdayMonthDetail(y, m);
}

let workdayTableSortOrder = 'desc'; // default 'desc' for most recent first

function toggleWorkdayTableSort() {
  workdayTableSortOrder = workdayTableSortOrder === 'desc' ? 'asc' : 'desc';
  const icon = document.getElementById("workday-sort-icon");
  if (icon) icon.textContent = workdayTableSortOrder === 'desc' ? '▼' : '▲';
  filterWorkdayTable();
}

function renderWorkdayTable(filterQuery = "") {
  const tbody = document.getElementById("workday-table-body");
  if (!tbody || !workdayData) return;

  const q = filterQuery.toLowerCase().trim();
  let filtered = workdayData.filter(r => {
    if (!q) return true;
    return r.period.includes(q) || r.month_name.toLowerCase().includes(q) || String(r.year).includes(q);
  });

  filtered.sort((a, b) => {
    return workdayTableSortOrder === 'desc'
      ? b.period.localeCompare(a.period)
      : a.period.localeCompare(b.period);
  });

  tbody.innerHTML = filtered.map(r => {
    const diff = r.workdays_mom_diff;
    const diffStr = diff !== null && diff !== undefined 
      ? `<span class="${diff >= 0 ? 'text-emerald-400' : 'text-rose-400'}">${diff >= 0 ? '+' : ''}${diff}</span>` 
      : '--';
    
    const cpoStr = r.cpo_production ? formatNumber(r.cpo_production) : (r.is_projected ? '<span class="text-amber-400">Proj</span>' : '--');
    const rateStr = r.cpo_per_workday ? formatNumber(r.cpo_per_workday) : '--';
    const rateMom = r.run_rate_mom_pct !== null && r.run_rate_mom_pct !== undefined 
      ? `<span class="${r.run_rate_mom_pct >= 0 ? 'text-emerald-400' : 'text-rose-400'}">${r.run_rate_mom_pct >= 0 ? '+' : ''}${r.run_rate_mom_pct.toFixed(1)}%</span>`
      : '--';

    return `
      <tr class="hover:bg-slate-800/40 transition">
        <td class="py-2 px-3 font-sans font-medium text-white">${r.period}</td>
        <td class="py-2 px-3 text-right">${r.calendar_days}</td>
        <td class="py-2 px-3 text-right text-slate-400">${r.sundays_count}</td>
        <td class="py-2 px-3 text-right text-rose-400 font-bold">${r.national_holidays_count}</td>
        <td class="py-2 px-3 text-right font-black text-cyan-300 bg-slate-900/50">${r.workdays_national}</td>
        <td class="py-2 px-3 text-right text-slate-400">${r.workdays_sabah}</td>
        <td class="py-2 px-3 text-right text-slate-400">${r.workdays_sarawak}</td>
        <td class="py-2 px-3 text-right">${diffStr}</td>
        <td class="py-2 px-3 text-right text-emerald-400 font-bold">${cpoStr}</td>
        <td class="py-2 px-3 text-right text-amber-300 font-black bg-slate-900/50">${rateStr}</td>
        <td class="py-2 px-3 text-right">${rateMom}</td>
      </tr>
    `;
  }).join("");
}

function filterWorkdayTable() {
  const input = document.getElementById("workday-table-search");
  if (input) {
    renderWorkdayTable(input.value);
  }
}

// -------------------------------------------------------------
// TAB 8: SPPOMA & MPOA Intra-Month Survey Tracker
// -------------------------------------------------------------

let sppomaData = null;
let sppomaMetadata = null;
let chartSppomaProgression = null;
let chartSppomaMultiYear = null;

async function loadSppomaData() {
  try {
    const json = await fetchJsonData("/api/sppoma-mpoa?start_year=2010&end_year=2026", "api_sppoma_mpoa.json");
    sppomaData = json.data;
    sppomaMetadata = json.metadata;

    setupSppomaSelectors();
    renderSppomaProgression(2026, 9);
    renderSppomaHistoryChart();
    renderSppomaTable();
    renderMpoaTable();
  } catch (err) {
    console.error("Failed to load SPPOMA & MPOA data:", err);
  }
}

function setupSppomaSelectors() {
  const ySelect = document.getElementById("sppoma-prog-year");
  const mSelect = document.getElementById("sppoma-prog-month");
  if (!ySelect || !mSelect || !sppomaData) return;

  ySelect.innerHTML = "";
  mSelect.innerHTML = "";

  const years = Array.from(new Set(sppomaData.map(r => r.year))).sort((a,b) => b - a);
  years.forEach(y => {
    const opt = document.createElement("option");
    opt.value = y;
    opt.textContent = y;
    if (y === 2026) opt.selected = true;
    ySelect.appendChild(opt);
  });

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  monthNames.forEach((name, idx) => {
    const opt = document.createElement("option");
    opt.value = idx + 1;
    opt.textContent = `${idx + 1} - ${name}`;
    if (idx + 1 === 9) opt.selected = true; // September default
    mSelect.appendChild(opt);
  });
}

function onSppomaProgressionChange() {
  const ySelect = document.getElementById("sppoma-prog-year");
  const mSelect = document.getElementById("sppoma-prog-month");
  if (!ySelect || !mSelect) return;
  const y = parseInt(ySelect.value);
  const m = parseInt(mSelect.value);
  renderSppomaProgression(y, m);
}

function renderSppomaProgression(year, month) {
  if (!sppomaData) return;
  const rec = sppomaData.find(r => r.year === year && r.month === month);
  if (!rec) return;

  const sp = rec.sppoma;
  const mp = rec.mpoa;
  const act = rec.mpob_actual;

  // 1. Populate the 7 Progression Flow Cards
  const cardsContainer = document.getElementById("sppoma-progression-cards");
  if (cardsContainer) {
    const fmtPct = (val) => {
      if (val === null || val === undefined) return '--';
      const cls = val >= 0 ? 'text-emerald-400' : 'text-rose-400';
      return `<span class="${cls} font-mono font-bold">${val >= 0 ? '+' : ''}${val.toFixed(2)}%</span>`;
    };

    cardsContainer.innerHTML = `
      <!-- Step 1: Day 1-5 -->
      <div class="bg-slate-950/70 p-3 rounded-xl border border-slate-800 space-y-1">
        <div class="flex items-center justify-between text-[11px] text-slate-400">
          <span class="font-bold text-white">Day 1–5</span>
          <span class="text-[9px] uppercase px-1 rounded bg-indigo-950/80 text-indigo-300 border border-indigo-800/40">SPPOMA</span>
        </div>
        <div class="text-base font-black">${fmtPct(sp['1-5'].cpo_prod_mom_pct)}</div>
        <div class="text-[10px] text-slate-400 leading-tight">
          FFB: ${sp['1-5'].ffb_yield_mom_pct >= 0 ? '+' : ''}${sp['1-5'].ffb_yield_mom_pct}%<br>
          OER: ${sp['1-5'].oer_diff_pts >= 0 ? '+' : ''}${sp['1-5'].oer_diff_pts}%
        </div>
      </div>

      <!-- Step 2: Day 1-10 -->
      <div class="bg-slate-950/70 p-3 rounded-xl border border-slate-800 space-y-1">
        <div class="flex items-center justify-between text-[11px] text-slate-400">
          <span class="font-bold text-white">Day 1–10</span>
          <span class="text-[9px] uppercase px-1 rounded bg-indigo-950/80 text-indigo-300 border border-indigo-800/40">SPPOMA</span>
        </div>
        <div class="text-base font-black">${fmtPct(sp['1-10'].cpo_prod_mom_pct)}</div>
        <div class="text-[10px] text-slate-400 leading-tight">
          FFB: ${sp['1-10'].ffb_yield_mom_pct >= 0 ? '+' : ''}${sp['1-10'].ffb_yield_mom_pct}%<br>
          OER: ${sp['1-10'].oer_diff_pts >= 0 ? '+' : ''}${sp['1-10'].oer_diff_pts}%
        </div>
      </div>

      <!-- Step 3: Day 1-15 -->
      <div class="bg-slate-950/70 p-3 rounded-xl border border-slate-800 space-y-1">
        <div class="flex items-center justify-between text-[11px] text-slate-400">
          <span class="font-bold text-white">Day 1–15</span>
          <span class="text-[9px] uppercase px-1 rounded bg-indigo-950/80 text-indigo-300 border border-indigo-800/40">SPPOMA</span>
        </div>
        <div class="text-base font-black">${fmtPct(sp['1-15'].cpo_prod_mom_pct)}</div>
        <div class="text-[10px] text-slate-400 leading-tight">
          FFB: ${sp['1-15'].ffb_yield_mom_pct >= 0 ? '+' : ''}${sp['1-15'].ffb_yield_mom_pct}%<br>
          OER: ${sp['1-15'].oer_diff_pts >= 0 ? '+' : ''}${sp['1-15'].oer_diff_pts}%
        </div>
      </div>

      <!-- Step 4: Day 1-20 (SPPOMA & MPOA) -->
      <div class="bg-indigo-950/30 p-3 rounded-xl border border-indigo-500/40 space-y-1">
        <div class="flex items-center justify-between text-[11px] text-slate-400">
          <span class="font-bold text-indigo-200">Day 1–20</span>
          <span class="text-[9px] uppercase px-1 rounded bg-cyan-950/80 text-cyan-300 border border-cyan-800/40">Anchor</span>
        </div>
        <div class="text-base font-black">
          ${fmtPct(sp['1-20'].cpo_prod_mom_pct)} <span class="text-[10px] font-normal text-indigo-300 font-sans">SPP</span>
          <span class="text-slate-600 mx-1">|</span>
          <span class="text-cyan-300 font-mono font-bold">${fmtPct(mp['1-20'].total_malaysia_mom_pct)}</span> <span class="text-[10px] font-normal text-cyan-400 font-sans">MPOA</span>
        </div>
        <div class="text-[10px] text-slate-300 leading-tight">
          Pen: <span class="font-mono text-white">+${mp['1-20'].peninsular_mom_pct}%</span> &bull; Sab: <span class="font-mono text-white">+${mp['1-20'].sabah_mom_pct}%</span><br>
          Sar: <span class="font-mono text-white">+${mp['1-20'].sarawak_mom_pct}%</span> &bull; Borneo: <span class="font-mono text-cyan-300 font-semibold">+${mp['1-20'].east_malaysia_mom_pct}%</span>
        </div>
      </div>

      <!-- Step 5: Day 1-25 -->
      <div class="bg-slate-950/70 p-3 rounded-xl border border-slate-800 space-y-1">
        <div class="flex items-center justify-between text-[11px] text-slate-400">
          <span class="font-bold text-white">Day 1–25</span>
          <span class="text-[9px] uppercase px-1 rounded bg-indigo-950/80 text-indigo-300 border border-indigo-800/40">SPPOMA</span>
        </div>
        <div class="text-base font-black">${fmtPct(sp['1-25'].cpo_prod_mom_pct)}</div>
        <div class="text-[10px] text-slate-400 leading-tight">
          FFB: ${sp['1-25'].ffb_yield_mom_pct >= 0 ? '+' : ''}${sp['1-25'].ffb_yield_mom_pct}%<br>
          OER: ${sp['1-25'].oer_diff_pts >= 0 ? '+' : ''}${sp['1-25'].oer_diff_pts}%
        </div>
      </div>

      <!-- Step 6: Full Month Surveys -->
      <div class="${mp['full_month'].total_malaysia_mom_pct !== null ? 'bg-cyan-950/30 border-cyan-500/50' : 'bg-slate-950/70 border-slate-800'} p-3 rounded-xl border space-y-1">
        <div class="flex items-center justify-between text-[11px] text-slate-400">
          <span class="font-bold text-white">Full Month Surveys</span>
          <span class="text-[9px] uppercase px-1 rounded ${mp['full_month'].total_malaysia_mom_pct !== null ? 'bg-cyan-950/80 text-cyan-300 border border-cyan-800/40' : 'bg-amber-950/80 text-amber-300 border border-amber-800/40'}">${mp['full_month'].total_malaysia_mom_pct !== null ? 'Both Released' : 'SPPOMA Only'}</span>
        </div>
        <div class="text-base font-black">
          ${fmtPct(sp['full_month'].cpo_prod_mom_pct)} <span class="text-[10px] font-normal text-indigo-300 font-sans">SPP</span>
          <span class="text-slate-600 mx-1">|</span>
          <span class="text-cyan-300 font-mono font-bold">${fmtPct(mp['full_month'].total_malaysia_mom_pct)}</span> <span class="text-[10px] font-normal text-cyan-400 font-sans">MPOA</span>
        </div>
        <div class="text-[10px] text-slate-300 leading-tight">
          ${mp['full_month'].total_malaysia_mom_pct !== null && mp['full_month'].total_malaysia_mom_pct !== undefined
            ? `Pen: <span class="font-mono text-white">+${mp['full_month'].peninsular_mom_pct}%</span> &bull; Sab: <span class="font-mono text-white">+${mp['full_month'].sabah_mom_pct}%</span><br>Sar: <span class="font-mono text-white">+${mp['full_month'].sarawak_mom_pct}%</span> &bull; Borneo: <span class="font-mono text-cyan-300 font-semibold">+${mp['full_month'].east_malaysia_mom_pct}%</span>`
            : `MPOA Full: <span class="text-amber-400 font-semibold font-mono text-[10px]">Pending Release</span><br><span class="text-slate-500 text-[9px]">Awaiting Final Returns</span>`
          }
        </div>
      </div>

      <!-- Step 7: Official MPOB Actual -->
      <div class="${act.cpo_mom_pct !== null ? 'bg-emerald-950/30 border-emerald-500/40' : 'bg-slate-950/70 border-slate-800'} p-3 rounded-xl border space-y-1">
        <div class="flex items-center justify-between text-[11px] text-slate-400">
          <span class="font-bold ${act.cpo_mom_pct !== null ? 'text-emerald-300' : 'text-slate-300'}">Official MPOB</span>
          <span class="text-[9px] uppercase px-1 rounded ${act.cpo_mom_pct !== null ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'}">${act.cpo_mom_pct !== null ? 'Final' : 'Pending'}</span>
        </div>
        <div class="text-base font-black ${act.cpo_mom_pct === null ? 'text-amber-400' : ''}">
          ${act.cpo_mom_pct !== null ? fmtPct(act.cpo_mom_pct) : '<span class="text-xs font-mono font-bold tracking-tight">Pending Release</span>'}
        </div>
        <div class="text-[10px] text-slate-300 leading-tight">
          ${act.cpo_production_tonnes ? formatNumber(act.cpo_production_tonnes) + ' T' : '<span class="text-slate-400">Due Oct 10, 2026</span>'}<br>
          <span class="text-[9px] text-slate-400">${act.status}</span>
        </div>
      </div>
    `;
  }

  // 2. Plot Progression Line Chart
  const ctx = document.getElementById("chartSppomaProgression");
  if (!ctx) return;

  const labels = ['Day 1–5', 'Day 1–10', 'Day 1–15', 'Day 1–20', 'Day 1–25', 'Full Month', 'Official MPOB'];
  const sppomaVals = [
    sp['1-5'].cpo_prod_mom_pct,
    sp['1-10'].cpo_prod_mom_pct,
    sp['1-15'].cpo_prod_mom_pct,
    sp['1-20'].cpo_prod_mom_pct,
    sp['1-25'].cpo_prod_mom_pct,
    sp['full_month'].cpo_prod_mom_pct,
    null
  ];
  const mpoaVals = [
    null, null, null,
    mp['1-20'].total_malaysia_mom_pct,
    null,
    mp['full_month'].total_malaysia_mom_pct,
    null
  ];
  const mpobVal = act.cpo_mom_pct;

  if (chartSppomaProgression) {
    chartSppomaProgression.destroy();
  }

  chartSppomaProgression = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'SPPOMA CPO MoM % (Southern Peninsular)',
          data: sppomaVals,
          borderColor: '#818cf8',
          backgroundColor: '#818cf8',
          borderWidth: 2.5,
          pointRadius: 5,
          pointHoverRadius: 7,
          tension: 0.15,
          spanGaps: true
        },
        {
          label: 'MPOA Total Malaysia MoM % (National Estates)',
          data: mpoaVals,
          borderColor: '#06b6d4',
          backgroundColor: '#06b6d4',
          borderWidth: 2.5,
          pointRadius: 6,
          pointHoverRadius: 8,
          pointStyle: 'rectRot',
          tension: 0.15,
          spanGaps: true
        },
        {
          label: `Official MPOB Final Outcome: ${mpobVal !== null ? (mpobVal >= 0 ? '+' : '') + mpobVal + '%' : 'Pending (Due Oct 10, 2026)'}`,
          data: mpobVal !== null ? [mpobVal, mpobVal, mpobVal, mpobVal, mpobVal, mpobVal, mpobVal] : [null, null, null, null, null, null, null],
          borderColor: '#10b981',
          backgroundColor: 'transparent',
          borderWidth: 2,
          borderDash: [6, 4],
          pointRadius: mpobVal !== null ? [0, 0, 0, 0, 0, 0, 7] : [0, 0, 0, 0, 0, 0, 0],
          pointBackgroundColor: '#10b981',
          pointHoverRadius: 9
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: { color: '#e2e8f0', font: { size: 11 } }
        },
        tooltip: {
          backgroundColor: '#0f172a',
          borderColor: '#334155',
          borderWidth: 1,
          callbacks: {
            label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.y !== null ? ctx.parsed.y.toFixed(2) + '%' : '--'}`
          }
        }
      },
      scales: {
        x: {
          ticks: { color: '#94a3b8', font: { size: 11 } },
          grid: { color: 'rgba(51, 65, 85, 0.2)' }
        },
        y: {
          ticks: {
            color: '#cbd5e1',
            font: { size: 11 },
            callback: v => (v >= 0 ? '+' : '') + v + '%'
          },
          grid: { color: 'rgba(51, 65, 85, 0.3)' },
          title: { display: true, text: 'Production MoM Rate of Change (%)', color: '#94a3b8', font: { size: 11 } }
        }
      }
    }
  });
}

let sppomaChartMode = 'deviation'; // 'deviation' or 'absolute'
let sppomaTableSortOrder = 'desc'; // default 'desc' for most recent first

function setSppomaChartMode(mode) {
  sppomaChartMode = mode;
  const btnDev = document.getElementById("btn-sppoma-mode-dev");
  const btnAbs = document.getElementById("btn-sppoma-mode-abs");
  if (btnDev && btnAbs) {
    if (mode === 'deviation') {
      btnDev.className = "px-2.5 py-1 rounded bg-indigo-600 font-semibold text-white transition";
      btnAbs.className = "px-2.5 py-1 rounded hover:bg-slate-800 text-slate-400 transition";
    } else {
      btnDev.className = "px-2.5 py-1 rounded hover:bg-slate-800 text-slate-400 transition";
      btnAbs.className = "px-2.5 py-1 rounded bg-indigo-600 font-semibold text-white transition";
    }
  }

  const titleEl = document.getElementById("sppoma-multiyear-title");
  const subEl = document.getElementById("sppoma-multiyear-subtitle");
  if (titleEl && subEl) {
    if (mode === 'deviation') {
      titleEl.textContent = "Multi-Year Survey Deviation vs MPOB Actual Benchmark (2010 – 2026)";
      subEl.textContent = "Tracking deviation (% points): SPPOMA & MPOA Survey Estimates minus Official MPOB Final Outcome (0.00% = Exact Match)";
    } else {
      titleEl.textContent = "Multi-Year Intra-Month Estimate vs MPOB Final Benchmark (2010 – 2026)";
      subEl.textContent = "Compare historical SPPOMA and MPOA monthly rate of change against final official MPOB outcome";
    }
  }

  renderSppomaHistoryChart();
}

function renderSppomaHistoryChart(interval = 'full_month') {
  const ctx = document.getElementById("chartSppomaMultiYear");
  if (!ctx || !sppomaData) return;

  const sel = document.getElementById("sppoma-chart-interval");
  if (sel) {
    interval = sel.value;
  }

  const slice = sppomaData.filter(r => r.year >= 2010);
  const labels = slice.map(r => r.period);

  if (sppomaChartMode === 'deviation') {
    // -------------------------------------------------------------
    // Deviation Mode: (Survey Estimate - MPOB Actual) in % points
    // -------------------------------------------------------------
    const sppomaDevVals = slice.map(r => {
      const sp = r.sppoma[interval];
      const act = r.mpob_actual ? r.mpob_actual.cpo_mom_pct : null;
      if (sp && sp.cpo_prod_mom_pct !== null && act !== null) {
        return Number((sp.cpo_prod_mom_pct - act).toFixed(2));
      }
      return null;
    });

    const mpoaDevVals = slice.map(r => {
      const act = r.mpob_actual ? r.mpob_actual.cpo_mom_pct : null;
      if (act === null) return null;
      let mVal = null;
      if (interval === '1-20' && r.mpoa['1-20']) {
        mVal = r.mpoa['1-20'].total_malaysia_mom_pct;
      } else if (interval === 'full_month' && r.mpoa['full_month']) {
        mVal = r.mpoa['full_month'].total_malaysia_mom_pct;
      } else {
        mVal = null; // MPOA only provides 1-20 and full month
      }
      if (mVal !== null) {
        return Number((mVal - act).toFixed(2));
      }
      return null;
    });

    const baselineVals = slice.map(() => 0.0);

    // Dynamic stats computation across realized historical periods
    const validSppDev = sppomaDevVals.filter(v => v !== null);
    const validMpoaDev = mpoaDevVals.filter(v => v !== null);

    const sppMAE = validSppDev.length ? (validSppDev.reduce((a, b) => a + Math.abs(b), 0) / validSppDev.length).toFixed(2) : '--';
    const mpoaMAE = validMpoaDev.length ? (validMpoaDev.reduce((a, b) => a + Math.abs(b), 0) / validMpoaDev.length).toFixed(2) : '--';
    const sppBias = validSppDev.length ? (validSppDev.reduce((a, b) => a + b, 0) / validSppDev.length).toFixed(2) : '--';
    const mpoaWithin2 = validMpoaDev.length ? ((validMpoaDev.filter(v => Math.abs(v) <= 2.0).length / validMpoaDev.length) * 100).toFixed(1) : '--';
    const sppWithin2 = validSppDev.length ? ((validSppDev.filter(v => Math.abs(v) <= 2.0).length / validSppDev.length) * 100).toFixed(1) : '--';

    const statsBar = document.getElementById("sppoma-dev-stats-bar");
    if (statsBar) {
      statsBar.style.display = 'grid';
      statsBar.innerHTML = `
        <div class="bg-slate-950/70 p-2.5 rounded-lg border border-slate-800 space-y-0.5">
          <div class="text-[11px] text-slate-400 font-medium">SPPOMA MAE (${interval.toUpperCase()})</div>
          <div class="text-base font-bold text-indigo-400 font-mono">&plusmn;${sppMAE}% pts</div>
          <div class="text-[10px] text-slate-400">Mean Abs Deviation vs MPOB</div>
        </div>
        <div class="bg-slate-950/70 p-2.5 rounded-lg border border-slate-800 space-y-0.5">
          <div class="text-[11px] text-slate-400 font-medium">MPOA MAE (${interval === '1-20' ? '1-20' : 'Full Month'})</div>
          <div class="text-base font-bold text-cyan-400 font-mono">${validMpoaDev.length ? `&plusmn;${mpoaMAE}% pts` : 'N/A for Interval'}</div>
          <div class="text-[10px] text-slate-400">${validMpoaDev.length ? 'National estate error margin' : 'MPOA only reports 1-20 & Full'}</div>
        </div>
        <div class="bg-slate-950/70 p-2.5 rounded-lg border border-slate-800 space-y-0.5">
          <div class="text-[11px] text-slate-400 font-medium">Within &plusmn;2.0% Tolerance</div>
          <div class="text-base font-bold text-emerald-400 font-mono">SPP: ${sppWithin2}% &bull; MPOA: ${mpoaWithin2}%</div>
          <div class="text-[10px] text-slate-400">Low tracking error rate</div>
        </div>
        <div class="bg-slate-950/70 p-2.5 rounded-lg border border-slate-800 space-y-0.5">
          <div class="text-[11px] text-slate-400 font-medium">SPPOMA Net Bias</div>
          <div class="text-base font-bold text-amber-400 font-mono">${Number(sppBias) >= 0 ? '+' : ''}${sppBias}% pts</div>
          <div class="text-[10px] text-slate-400">${Number(sppBias) >= 0 ? 'Slight Southern Overestimation' : 'Underestimating'}</div>
        </div>
      `;
    }

    if (chartSppomaMultiYear) {
      chartSppomaMultiYear.destroy();
    }

    const datasets = [
      {
        label: `SPPOMA (${interval === 'full_month' ? 'Final %' : interval.toUpperCase()}) − MPOB % Change (% pts)`,
        data: sppomaDevVals,
        borderColor: '#818cf8',
        backgroundColor: 'rgba(129, 140, 248, 0.08)',
        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 5,
        tension: 0.15,
        fill: false
      }
    ];

    if (validMpoaDev.length > 0) {
      datasets.push({
        label: `MPOA (${interval === 'full_month' ? 'Final %' : 'Day 1-20'}) − MPOB % Change (% pts)`,
        data: mpoaDevVals,
        borderColor: '#06b6d4',
        backgroundColor: 'rgba(6, 182, 212, 0.08)',
        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 5,
        tension: 0.15,
        fill: false
      });
    }

    chartSppomaMultiYear = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: datasets
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: {
            labels: { color: '#e2e8f0', font: { size: 11 } }
          },
          tooltip: {
            backgroundColor: '#0f172a',
            borderColor: '#334155',
            borderWidth: 1,
            callbacks: {
              label: (ctx) => {
                const idx = ctx.dataIndex;
                const rec = slice[idx];
                const act = rec.mpob_actual ? rec.mpob_actual.cpo_mom_pct : null;
                const val = ctx.parsed.y;
                if (val === null || val === undefined) return `${ctx.dataset.label}: --`;
                const sign = val >= 0 ? '+' : '';
                if (ctx.dataset.label.includes('SPPOMA')) {
                  const spVal = rec.sppoma[interval] ? rec.sppoma[interval].cpo_prod_mom_pct : null;
                  return `SPPOMA Deviation: ${sign}${val.toFixed(2)}% pts (SPP: ${spVal !== null ? (spVal >= 0 ? '+' : '') + spVal + '%' : '--'}, MPOB: ${act !== null ? (act >= 0 ? '+' : '') + act + '%' : '--'})`;
                } else if (ctx.dataset.label.includes('MPOA')) {
                  const mpVal = interval === '1-20' ? (rec.mpoa['1-20'] ? rec.mpoa['1-20'].total_malaysia_mom_pct : null) : (rec.mpoa['full_month'] ? rec.mpoa['full_month'].total_malaysia_mom_pct : null);
                  return `MPOA Deviation: ${sign}${val.toFixed(2)}% pts (MPOA: ${mpVal !== null ? (mpVal >= 0 ? '+' : '') + mpVal + '%' : '--'}, MPOB: ${act !== null ? (act >= 0 ? '+' : '') + act + '%' : '--'})`;
                }
                return `${ctx.dataset.label}: ${sign}${val.toFixed(2)}% pts`;
              }
            }
          }
        },
        scales: {
          x: {
            ticks: { color: '#94a3b8', font: { size: 10 }, maxTicksLimit: 20 },
            grid: { color: 'rgba(51, 65, 85, 0.2)' }
          },
          y: {
            ticks: {
              color: '#cbd5e1',
              font: { size: 10 },
              callback: v => (v > 0 ? '+' : '') + v.toFixed(1) + '% pts'
            },
            grid: {
              color: (context) => (context.tick && context.tick.value === 0 ? 'rgba(16, 185, 129, 0.5)' : 'rgba(51, 65, 85, 0.25)'),
              lineWidth: (context) => (context.tick && context.tick.value === 0 ? 2 : 1)
            },
            title: { display: true, text: 'Tracking Deviation vs MPOB Actual (% points)', color: '#94a3b8', font: { size: 11 } }
          }
        }
      }
    });

  } else {
    // -------------------------------------------------------------
    // Absolute Mode: Raw MoM % Comparison
    // -------------------------------------------------------------
    const statsBar = document.getElementById("sppoma-dev-stats-bar");
    if (statsBar) statsBar.style.display = 'none';

    const sppomaVals = slice.map(r => {
      const sp = r.sppoma[interval];
      return sp ? sp.cpo_prod_mom_pct : null;
    });

    const mpoaVals = slice.map(r => {
      if (interval === '1-20') return r.mpoa['1-20'].total_malaysia_mom_pct;
      return r.mpoa['full_month'] ? r.mpoa['full_month'].total_malaysia_mom_pct : null;
    });

    const mpobVals = slice.map(r => r.mpob_actual ? r.mpob_actual.cpo_mom_pct : null);

    if (chartSppomaMultiYear) {
      chartSppomaMultiYear.destroy();
    }

    chartSppomaMultiYear = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          {
            label: `SPPOMA (${interval.toUpperCase()}) CPO MoM %`,
            data: sppomaVals,
            borderColor: '#818cf8',
            borderWidth: 1.8,
            pointRadius: 0,
            pointHoverRadius: 4,
            tension: 0.1
          },
          {
            label: `MPOA (${interval === '1-20' ? '1-20' : 'Full Month'}) Total MoM %`,
            data: mpoaVals,
            borderColor: '#06b6d4',
            borderWidth: 1.8,
            pointRadius: 0,
            pointHoverRadius: 4,
            tension: 0.1
          },
          {
            label: 'Official MPOB Final MoM %',
            data: mpobVals,
            borderColor: '#10b981',
            borderWidth: 2.2,
            pointRadius: 0,
            pointHoverRadius: 5,
            tension: 0.1
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: {
            labels: { color: '#e2e8f0', font: { size: 11 } }
          },
          tooltip: {
            backgroundColor: '#0f172a',
            borderColor: '#334155',
            borderWidth: 1,
            callbacks: {
              label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.y !== null ? (ctx.parsed.y >= 0 ? '+' : '') + ctx.parsed.y.toFixed(2) + '%' : '--'}`
            }
          }
        },
        scales: {
          x: {
            ticks: { color: '#94a3b8', font: { size: 10 }, maxTicksLimit: 20 },
            grid: { color: 'rgba(51, 65, 85, 0.2)' }
          },
          y: {
            ticks: {
              color: '#cbd5e1',
              font: { size: 10 },
              callback: v => (v >= 0 ? '+' : '') + v + '%'
            },
            grid: { color: 'rgba(51, 65, 85, 0.25)' },
            title: { display: true, text: 'MoM % Change', color: '#94a3b8', font: { size: 11 } }
          }
        }
      }
    });
  }
}

function toggleSppomaTableSort() {
  sppomaTableSortOrder = sppomaTableSortOrder === 'desc' ? 'asc' : 'desc';
  const icon = document.getElementById("sppoma-sort-icon");
  if (icon) icon.textContent = sppomaTableSortOrder === 'desc' ? '▼' : '▲';
  filterSppomaTable();
}

function renderSppomaTable(filterQuery = "") {
  const tbody = document.getElementById("sppoma-table-body");
  if (!tbody || !sppomaData) return;

  const q = filterQuery.toLowerCase().trim();
  let filtered = sppomaData.filter(r => {
    if (!q) return true;
    return r.period.includes(q) || r.month_name.toLowerCase().includes(q) || String(r.year).includes(q);
  });

  // Sort by period: default 'desc' (most recent dates at the top)
  filtered.sort((a, b) => {
    return sppomaTableSortOrder === 'desc'
      ? b.period.localeCompare(a.period)
      : a.period.localeCompare(b.period);
  });

  const fmt = (v) => {
    if (v === null || v === undefined) return '--';
    const cls = v >= 0 ? 'text-emerald-400' : 'text-rose-400';
    return `<span class="${cls}">${v >= 0 ? '+' : ''}${v.toFixed(2)}%</span>`;
  };

  tbody.innerHTML = filtered.map(r => {
    const sp = r.sppoma;
    const mp = r.mpoa;
    const act = r.mpob_actual;
    const an = r.analytics;

    const err = an.sppoma_full_month_error_pct;
    const errStr = err !== null && err !== undefined
      ? `<span class="${Math.abs(err) <= 2.0 ? 'text-slate-300' : 'text-amber-400'} font-mono">${err >= 0 ? '+' : ''}${err.toFixed(2)}%</span>`
      : '<span class="text-slate-500 italic text-[11px]">-- (Pending)</span>';

    const cpoTonnes = act.cpo_production_tonnes ? formatNumber(act.cpo_production_tonnes) : '<span class="text-slate-500 italic text-[11px]">Pending</span>';
    const mpoaFullStr = mp['full_month'].total_malaysia_mom_pct !== null && mp['full_month'].total_malaysia_mom_pct !== undefined
      ? fmt(mp['full_month'].total_malaysia_mom_pct)
      : '<span class="text-amber-400/80 text-[11px] font-sans italic">Pending (~Oct 7)</span>';
    const mpobMomStr = act.cpo_mom_pct !== null && act.cpo_mom_pct !== undefined
      ? fmt(act.cpo_mom_pct)
      : '<span class="text-amber-400/80 text-[11px] font-sans italic">Pending (Oct 10)</span>';

    return `
      <tr class="hover:bg-slate-800/40 transition">
        <td class="py-2 px-3 font-sans font-medium text-white whitespace-nowrap">${r.period}</td>
        <td class="py-2 px-2 text-right font-mono">${fmt(sp['1-5'].cpo_prod_mom_pct)}</td>
        <td class="py-2 px-2 text-right font-mono">${fmt(sp['1-10'].cpo_prod_mom_pct)}</td>
        <td class="py-2 px-2 text-right font-mono">${fmt(sp['1-15'].cpo_prod_mom_pct)}</td>
        <td class="py-2 px-2 text-right font-mono font-bold">${fmt(sp['1-20'].cpo_prod_mom_pct)}</td>
        <td class="py-2 px-2 text-right font-mono">${fmt(sp['1-25'].cpo_prod_mom_pct)}</td>
        <td class="py-2 px-2 text-right font-mono font-bold bg-slate-900/60">${fmt(sp['full_month'].cpo_prod_mom_pct)}</td>
        <td class="py-2 px-2 text-right font-mono text-slate-400">${sp['full_month'].oer_diff_pts !== null ? (sp['full_month'].oer_diff_pts >= 0 ? '+' : '') + sp['full_month'].oer_diff_pts.toFixed(2) : '--'}</td>
        <td class="py-2 px-2 text-right font-mono font-bold">${fmt(mp['1-20'].total_malaysia_mom_pct)}</td>
        <td class="py-2 px-2 text-right font-mono font-bold bg-slate-900/60">${mpoaFullStr}</td>
        <td class="py-2 px-2 text-right font-mono font-bold">${mpobMomStr}</td>
        <td class="py-2 px-3 text-right font-mono text-slate-200">${cpoTonnes}</td>
        <td class="py-2 px-2 text-right font-mono">${errStr}</td>
      </tr>
    `;
  }).join("");
}

function filterSppomaTable() {
  const input = document.getElementById("sppoma-table-search");
  if (input) {
    renderSppomaTable(input.value);
  }
}

// =========================================================================
// TAB 8: Dedicated MPOA Regional Production Survey Ledger (Peninsular, Sabah, Sarawak & Borneo)
// =========================================================================

let mpoaTableInterval = 'full_month'; // 'full_month', '1-20', or 'combined'
let mpoaTableSortOrder = 'desc'; // default 'desc' for most recent first

function setMpoaTableInterval(interval) {
  mpoaTableInterval = interval;
  const btnFull = document.getElementById("btn-mpoa-tbl-full");
  const btn20 = document.getElementById("btn-mpoa-tbl-20");
  const btnComb = document.getElementById("btn-mpoa-tbl-comb");
  [btnFull, btn20, btnComb].forEach(btn => {
    if (btn) btn.className = "px-2.5 py-1 rounded hover:bg-slate-800 text-slate-400 transition";
  });
  if (interval === 'full_month' && btnFull) {
    btnFull.className = "px-2.5 py-1 rounded bg-cyan-600 font-semibold text-white transition";
  } else if (interval === '1-20' && btn20) {
    btn20.className = "px-2.5 py-1 rounded bg-cyan-600 font-semibold text-white transition";
  } else if (interval === 'combined' && btnComb) {
    btnComb.className = "px-2.5 py-1 rounded bg-cyan-600 font-semibold text-white transition";
  }
  filterMpoaTable();
}

function toggleMpoaTableSort() {
  mpoaTableSortOrder = mpoaTableSortOrder === 'desc' ? 'asc' : 'desc';
  const icon = document.getElementById("mpoa-sort-icon");
  if (icon) icon.textContent = mpoaTableSortOrder === 'desc' ? '▼' : '▲';
  filterMpoaTable();
}

function filterMpoaTable() {
  const input = document.getElementById("mpoa-table-search");
  renderMpoaTable(input ? input.value : "");
}

function renderMpoaTable(filterQuery = "") {
  const thead = document.getElementById("mpoa-table-head");
  const tbody = document.getElementById("mpoa-table-body");
  if (!thead || !tbody || !sppomaData) return;

  const q = filterQuery.toLowerCase().trim();
  let filtered = sppomaData.filter(r => {
    if (!q) return true;
    return r.period.includes(q) || r.month_name.toLowerCase().includes(q) || String(r.year).includes(q);
  });

  filtered.sort((a, b) => {
    return mpoaTableSortOrder === 'desc'
      ? b.period.localeCompare(a.period)
      : a.period.localeCompare(b.period);
  });

  const fmt = (v) => {
    if (v === null || v === undefined) return '<span class="text-slate-500 italic">--</span>';
    const cls = v >= 0 ? 'text-emerald-400' : 'text-rose-400';
    return `<span class="${cls} font-mono font-semibold">${v >= 0 ? '+' : ''}${Number(v).toFixed(2)}%</span>`;
  };

  const badge = (status, isBulletin) => {
    if (isBulletin) {
      return '<span class="px-1.5 py-0.5 rounded text-[10px] bg-cyan-950/80 text-cyan-300 border border-cyan-800/60 font-sans font-medium whitespace-nowrap">Official Bulletin</span>';
    }
    if (status && status.includes('Pending')) {
      return '<span class="px-1.5 py-0.5 rounded text-[10px] bg-amber-950/80 text-amber-300 border border-amber-800/60 font-sans whitespace-nowrap">Pending Release</span>';
    }
    return '<span class="px-1.5 py-0.5 rounded text-[10px] bg-slate-800/80 text-slate-400 font-sans whitespace-nowrap">Derived</span>';
  };

  const sortIcon = `<span id="mpoa-sort-icon" class="text-xs text-cyan-400 font-mono font-bold">${mpoaTableSortOrder === 'desc' ? '▼' : '▲'}</span>`;

  if (mpoaTableInterval === 'full_month') {
    thead.innerHTML = `
      <tr>
        <th class="py-2.5 px-3 text-left cursor-pointer hover:text-white transition select-none" onclick="toggleMpoaTableSort()" title="Click to toggle sort order">
          <span class="inline-flex items-center space-x-1">
            <span>Period</span>
            ${sortIcon}
          </span>
        </th>
        <th class="py-2.5 px-2 text-right text-cyan-300 font-mono">Peninsular MoM</th>
        <th class="py-2.5 px-2 text-right text-cyan-300 font-mono">Sabah MoM</th>
        <th class="py-2.5 px-2 text-right text-cyan-300 font-mono">Sarawak MoM</th>
        <th class="py-2.5 px-2 text-right text-cyan-400 font-mono font-bold bg-slate-900/60">Borneo State (East)</th>
        <th class="py-2.5 px-2 text-right text-white font-mono font-bold bg-slate-900/90">Overall Malaysia</th>
        <th class="py-2.5 px-2 text-right text-amber-300 font-mono font-bold">MPOB Actual</th>
        <th class="py-2.5 px-2 text-center text-slate-400">Bulletin Verification</th>
      </tr>
    `;

    tbody.innerHTML = filtered.map(r => {
      const mp = r.mpoa.full_month;
      const act = r.mpob_actual;
      const mpobStr = act.cpo_mom_pct !== null && act.cpo_mom_pct !== undefined
        ? fmt(act.cpo_mom_pct)
        : '<span class="text-amber-400/80 text-[11px] font-sans italic">Pending (Oct 10)</span>';

      return `
        <tr class="hover:bg-slate-800/40 transition">
          <td class="py-2 px-3 font-sans font-medium text-white whitespace-nowrap">${r.period}</td>
          <td class="py-2 px-2 text-right font-mono">${fmt(mp.peninsular_mom_pct)}</td>
          <td class="py-2 px-2 text-right font-mono">${fmt(mp.sabah_mom_pct)}</td>
          <td class="py-2 px-2 text-right font-mono">${fmt(mp.sarawak_mom_pct)}</td>
          <td class="py-2 px-2 text-right font-mono font-bold bg-slate-900/50 text-cyan-300">${fmt(mp.east_malaysia_mom_pct)}</td>
          <td class="py-2 px-2 text-right font-mono font-bold bg-slate-900/80 text-white">${fmt(mp.total_malaysia_mom_pct)}</td>
          <td class="py-2 px-2 text-right font-mono font-bold">${mpobStr}</td>
          <td class="py-2 px-2 text-center">${badge(mp.status, mp.is_verified_bulletin)}</td>
        </tr>
      `;
    }).join("");

  } else if (mpoaTableInterval === '1-20') {
    thead.innerHTML = `
      <tr>
        <th class="py-2.5 px-3 text-left cursor-pointer hover:text-white transition select-none" onclick="toggleMpoaTableSort()" title="Click to toggle sort order">
          <span class="inline-flex items-center space-x-1">
            <span>Period</span>
            ${sortIcon}
          </span>
        </th>
        <th class="py-2.5 px-2 text-right text-cyan-300 font-mono">Peninsular (1-20)</th>
        <th class="py-2.5 px-2 text-right text-cyan-300 font-mono">Sabah (1-20)</th>
        <th class="py-2.5 px-2 text-right text-cyan-300 font-mono">Sarawak (1-20)</th>
        <th class="py-2.5 px-2 text-right text-cyan-400 font-mono font-bold bg-slate-900/60">Borneo State (1-20)</th>
        <th class="py-2.5 px-2 text-right text-white font-mono font-bold bg-slate-900/90">Overall Malaysia (1-20)</th>
        <th class="py-2.5 px-2 text-center text-slate-400">Bulletin Verification</th>
      </tr>
    `;

    tbody.innerHTML = filtered.map(r => {
      const mp = r.mpoa['1-20'];
      return `
        <tr class="hover:bg-slate-800/40 transition">
          <td class="py-2 px-3 font-sans font-medium text-white whitespace-nowrap">${r.period}</td>
          <td class="py-2 px-2 text-right font-mono">${fmt(mp.peninsular_mom_pct)}</td>
          <td class="py-2 px-2 text-right font-mono">${fmt(mp.sabah_mom_pct)}</td>
          <td class="py-2 px-2 text-right font-mono">${fmt(mp.sarawak_mom_pct)}</td>
          <td class="py-2 px-2 text-right font-mono font-bold bg-slate-900/50 text-cyan-300">${fmt(mp.east_malaysia_mom_pct)}</td>
          <td class="py-2 px-2 text-right font-mono font-bold bg-slate-900/80 text-white">${fmt(mp.total_malaysia_mom_pct)}</td>
          <td class="py-2 px-2 text-center">${badge(mp.status, mp.is_verified_bulletin)}</td>
        </tr>
      `;
    }).join("");

  } else {
    // Combined / Side-by-Side view
    thead.innerHTML = `
      <tr>
        <th rowspan="2" class="py-2.5 px-3 text-left cursor-pointer hover:text-white transition select-none" onclick="toggleMpoaTableSort()" title="Click to toggle sort order">
          <span class="inline-flex items-center space-x-1">
            <span>Period</span>
            ${sortIcon}
          </span>
        </th>
        <th colspan="2" class="py-1 px-2 text-center text-cyan-300 border-b border-slate-800">Peninsular</th>
        <th colspan="2" class="py-1 px-2 text-center text-cyan-300 border-b border-slate-800">Sabah</th>
        <th colspan="2" class="py-1 px-2 text-center text-cyan-300 border-b border-slate-800">Sarawak</th>
        <th colspan="2" class="py-1 px-2 text-center text-cyan-400 font-bold bg-slate-900/60 border-b border-slate-800">Borneo State</th>
        <th colspan="2" class="py-1 px-2 text-center text-white font-bold bg-slate-900/90 border-b border-slate-800">Overall Malaysia</th>
        <th rowspan="2" class="py-2.5 px-2 text-right text-amber-300 font-mono font-bold">MPOB Actual</th>
      </tr>
      <tr>
        <th class="py-1.5 px-1.5 text-right text-slate-400 font-mono text-[10px]">1-20</th>
        <th class="py-1.5 px-1.5 text-right text-cyan-300 font-mono text-[10px] font-bold">Full</th>
        <th class="py-1.5 px-1.5 text-right text-slate-400 font-mono text-[10px]">1-20</th>
        <th class="py-1.5 px-1.5 text-right text-cyan-300 font-mono text-[10px] font-bold">Full</th>
        <th class="py-1.5 px-1.5 text-right text-slate-400 font-mono text-[10px]">1-20</th>
        <th class="py-1.5 px-1.5 text-right text-cyan-300 font-mono text-[10px] font-bold">Full</th>
        <th class="py-1.5 px-1.5 text-right text-slate-400 font-mono text-[10px] bg-slate-900/60">1-20</th>
        <th class="py-1.5 px-1.5 text-right text-cyan-400 font-mono text-[10px] font-bold bg-slate-900/60">Full</th>
        <th class="py-1.5 px-1.5 text-right text-slate-400 font-mono text-[10px] bg-slate-900/90">1-20</th>
        <th class="py-1.5 px-1.5 text-right text-emerald-400 font-mono text-[10px] font-bold bg-slate-900/90">Full</th>
      </tr>
    `;

    tbody.innerHTML = filtered.map(r => {
      const m20 = r.mpoa['1-20'];
      const mFull = r.mpoa.full_month;
      const act = r.mpob_actual;
      const mpobStr = act.cpo_mom_pct !== null && act.cpo_mom_pct !== undefined
        ? fmt(act.cpo_mom_pct)
        : '<span class="text-amber-400/80 text-[10px] font-sans italic">Pending (Oct 10)</span>';

      return `
        <tr class="hover:bg-slate-800/40 transition">
          <td class="py-2 px-3 font-sans font-medium text-white whitespace-nowrap">${r.period}</td>
          <td class="py-2 px-1.5 text-right font-mono text-slate-400 text-xs">${fmt(m20.peninsular_mom_pct)}</td>
          <td class="py-2 px-1.5 text-right font-mono font-bold text-xs">${fmt(mFull.peninsular_mom_pct)}</td>
          <td class="py-2 px-1.5 text-right font-mono text-slate-400 text-xs">${fmt(m20.sabah_mom_pct)}</td>
          <td class="py-2 px-1.5 text-right font-mono font-bold text-xs">${fmt(mFull.sabah_mom_pct)}</td>
          <td class="py-2 px-1.5 text-right font-mono text-slate-400 text-xs">${fmt(m20.sarawak_mom_pct)}</td>
          <td class="py-2 px-1.5 text-right font-mono font-bold text-xs">${fmt(mFull.sarawak_mom_pct)}</td>
          <td class="py-2 px-1.5 text-right font-mono text-slate-400 text-xs bg-slate-900/50">${fmt(m20.east_malaysia_mom_pct)}</td>
          <td class="py-2 px-1.5 text-right font-mono font-bold text-xs bg-slate-900/50 text-cyan-300">${fmt(mFull.east_malaysia_mom_pct)}</td>
          <td class="py-2 px-1.5 text-right font-mono text-slate-400 text-xs bg-slate-900/80">${fmt(m20.total_malaysia_mom_pct)}</td>
          <td class="py-2 px-1.5 text-right font-mono font-bold text-xs bg-slate-900/80 text-white">${fmt(mFull.total_malaysia_mom_pct)}</td>
          <td class="py-2 px-2 text-right font-mono font-bold">${mpobStr}</td>
        </tr>
      `;
    }).join("");
  }
}



