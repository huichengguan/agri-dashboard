/**
 * Thailand Palm Oil Supply & Demand Institutional Dashboard (app.js)
 * 100% Official Thai Statistics (DIT / OAE / EPPO) • Jan 2023 – Jul 2026
 */

const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
let ALL_YEARS = [2023, 2024, 2025, 2026];

function fmtPeriodShort(period) {
  if (!period || !period.includes("-")) return period || "";
  const [y, m] = period.split("-").map(Number);
  return `${MONTH_SHORT[m - 1]} ${y}`;
}

const STATE = {
  master: null,
  selectedYears: new Set([2023, 2024, 2025, 2026]), // Default: All History
  lastClickedYear: 2026,
  activeTab: "tab-snd",

  // Tab 1: S&D state
  sndViewFormat: "table",   // "table" | "matrix"
  sndMetricMode: "volume",  // "volume" | "both" | "pct"
  sndUnit: "t",             // "t" | "kt" | "mnt"
  sndExpandedYears: new Set([2026]), // Expand 2026 by default
  sndChartFreq: "monthly",  // "monthly" | "annual"

  // Tab 2: Seasonality state
  seasonAttr: "production",
  seasonCalc: "monthly",    // "monthly" | "cum"
  seasonUnit: "t",          // "t" | "kt" | "mnt"
  seasonActiveYears: new Set([2023, 2024, 2025, 2026]),

  charts: {}
};

// ===========================================================================
// ROW DEFINITIONS FOR STACKED BALANCE SHEET TABLES
// ===========================================================================
const CPO_PRIMARY_ROWS = [
  { key: "starting_stock", label: "Beginning Stocks", isStock: true },
  { key: "production", label: "CPO Production", isHighlight: true },
  { key: "import", label: "↳ Imports", isIndent: true },
  { key: "total_supply", label: "Total Supply (Beginning Stocks + Production + Imports)", isSubtotal: true },
  { key: "total_demand", label: "Total Demand (Disappearance)", isSubtotal: true },
  { key: "export", label: "↳ Exports", isIndent: true },
  { key: "total_local_consumption", label: "↳ Total Domestic Consumption", isIndent: true },
  { key: "bd_consumption", label: "↳↳ Biodiesel (B100 / Methyl Ester)", isIndent: true, level: 2 },
  { key: "edible_consumption", label: "↳↳ Edible & Industrial Use", isIndent: true, level: 2 },
  { key: "balancing_figure", label: "Balancing Figure / Statistical Discrepancy", isMuted: true },
  { key: "ending_stock", label: "Ending Stocks", isHighlight: true, isStock: true },
  { key: "stocks_to_use", label: "Stocks-to-Use Ratio (%)", isRatio: true, isHighlight: true }
];

const DOMESTIC_ROWS = [
  { key: "total_local_consumption", label: "Total Domestic Consumption", isHighlight: true, isSubtotal: true },
  { key: "bd_consumption", label: "↳ Biodiesel (B100 / Methyl Ester)", isIndent: true },
  { key: "edible_consumption", label: "↳ Edible & Industrial Consumption", isIndent: true },
  { key: "bd_share_of_local", label: "Biodiesel Share of Domestic Use (%)", isRatio: true, isHighlight: true },
  { key: "mandate_note", label: "Biodiesel Blend Mandate", isText: true }
];

const TRADE_ROWS = [
  { key: "production", label: "CPO Production" },
  { key: "export", label: "Exports", isHighlight: true },
  { key: "import", label: "Imports" },
  { key: "net_export", label: "Net Exports (Exports − Imports)", isSubtotal: true, isHighlight: true },
  { key: "export_share_of_production", label: "Exports as % of Production (%)", isRatio: true, isHighlight: true }
];

// ===========================================================================
// UTILITY & FORMATTING FUNCTIONS
// ===========================================================================
function scaleVal(val, unit, isRatio = false) {
  if (val === null || val === undefined || isRatio) return val;
  const num = Number(val);
  if (isNaN(num)) return null;
  if (unit === "mnt") return num / 1000000.0;
  if (unit === "kt") return num / 1000.0;
  return num;
}

function fmtVal(val, unit = "t", isRatio = false, isStock = false) {
  if (val === null || val === undefined) return "--";
  const num = Number(val);
  if (isNaN(num)) return "--";
  if (isRatio) return `${num.toFixed(1)}%`;

  if (unit === "mnt") {
    return num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 3 });
  } else if (unit === "kt") {
    return num.toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  }
  return Math.round(num).toLocaleString("en-US");
}

function fmtPctCell(curr, prev) {
  if (curr === null || curr === undefined || prev === null || prev === undefined || prev === 0) {
    return `<span class="pct-val pct-flat">--</span>`;
  }
  const pct = ((curr - prev) / Math.abs(prev)) * 100.0;
  if (Math.abs(pct) < 0.05) {
    return `<span class="pct-val pct-flat">0.0%</span>`;
  }
  const cls = pct > 0 ? "pct-pos" : "pct-neg";
  const sign = pct > 0 ? "+" : "";
  return `<span class="pct-val ${cls}">${sign}${pct.toFixed(1)}%</span>`;
}

function destroyChart(name) {
  if (STATE.charts[name]) {
    try {
      STATE.charts[name].destroy();
    } catch (e) {
      console.warn("Error destroying chart", name, e);
    }
    delete STATE.charts[name];
  }
}

function getSortedSelectedYears() {
  return Array.from(STATE.selectedYears).sort((a, b) => a - b);
}

function chartOptionsCommon(yLeftTitle, yRightTitle = null) {
  const scales = {
    x: {
      grid: { color: "rgba(226, 232, 240, 0.6)" },
      ticks: {
        font: { family: "'Inter', sans-serif", size: 11 },
        color: "#64748b",
        maxRotation: 0,
        autoSkip: true,
        maxTicksLimit: 16
      }
    },
    y: {
      position: "left",
      grid: { color: "rgba(226, 232, 240, 0.6)" },
      ticks: {
        font: { family: "'JetBrains Mono', monospace", size: 10 },
        color: "#64748b",
        callback: (v) => v.toLocaleString("en-US")
      },
      title: {
        display: !!yLeftTitle,
        text: yLeftTitle,
        font: { family: "'Inter', sans-serif", size: 11, weight: 600 },
        color: "#475569"
      }
    }
  };
  if (yRightTitle) {
    scales.y1 = {
      position: "right",
      grid: { drawOnChartArea: false },
      ticks: {
        font: { family: "'JetBrains Mono', monospace", size: 10 },
        color: "#d97706",
        callback: (v) => `${v}%`
      },
      title: {
        display: true,
        text: yRightTitle,
        font: { family: "'Inter', sans-serif", size: 11, weight: 600 },
        color: "#d97706"
      }
    };
  }
  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: "index", intersect: false },
    plugins: {
      legend: {
        position: "top",
        align: "end",
        labels: {
          boxWidth: 12,
          font: { family: "'Inter', sans-serif", size: 11, weight: 500 },
          color: "#334155"
        }
      },
      tooltip: {
        backgroundColor: "rgba(15, 23, 42, 0.92)",
        titleFont: { family: "'Inter', sans-serif", size: 12, weight: 600 },
        bodyFont: { family: "'JetBrains Mono', monospace", size: 11 },
        padding: 10,
        cornerRadius: 4
      }
    },
    scales
  };
}

// ===========================================================================
// INITIALIZATION
// ===========================================================================
document.addEventListener("DOMContentLoaded", () => {
  initDashboard();
});

function initDashboard() {
  if (!window.DASHBOARD_DATA) {
    console.error("DASHBOARD_DATA not loaded!");
    return;
  }
  STATE.master = window.DASHBOARD_DATA;
  ALL_YEARS = STATE.master.metadata.years || [2023, 2024, 2025, 2026];

  updateHeaderKpis();
  renderYearSlicer();
  initControls();
  renderActiveTab();
}

function updateHeaderKpis() {
  const meta = STATE.master.metadata;
  const monthly = STATE.master.monthly;
  const ann = STATE.master.annual_cy;

  if (meta.latest_actual_label) {
    document.getElementById("kpi-latest-month").textContent = meta.latest_actual_label;
  }
  const lp = meta.latest_actual_period;
  if (monthly[lp]) {
    const r = monthly[lp];
    document.getElementById("kpi-label-prod").textContent = `${fmtPeriodShort(lp)} CPO Production`;
    document.getElementById("kpi-val-prod").textContent = `${Math.round(r.production).toLocaleString("en-US")} t`;

    document.getElementById("kpi-label-stocks").textContent = `${fmtPeriodShort(lp)} Ending Stocks`;
    document.getElementById("kpi-val-stocks").textContent = `${Math.round(r.ending_stock).toLocaleString("en-US")} t`;

    document.getElementById("kpi-label-bd").textContent = `${fmtPeriodShort(lp)} Biodiesel Use`;
    document.getElementById("kpi-val-bd").textContent = `${Math.round(r.bd_consumption).toLocaleString("en-US")} t`;

    document.getElementById("kpi-label-edible").textContent = `${fmtPeriodShort(lp)} Edible Use`;
    document.getElementById("kpi-val-edible").textContent = `${Math.round(r.edible_consumption).toLocaleString("en-US")} t`;
  }
  if (ann["2026"]) {
    const r26 = ann["2026"];
    document.getElementById("kpi-val-ytd-prod").textContent = `${Math.round(r26.production).toLocaleString("en-US")} t`;
  }
}

// ===========================================================================
// YEAR SLICER & PRESETS
// ===========================================================================
function renderYearSlicer() {
  const container = document.getElementById("year-pills-container");
  container.innerHTML = "";

  ALL_YEARS.forEach((yr) => {
    const btn = document.createElement("button");
    btn.className = `year-pill ${STATE.selectedYears.has(yr) ? "active" : ""}`;
    btn.dataset.year = yr;
    btn.textContent = String(yr);

    btn.addEventListener("click", (e) => {
      if (e.ctrlKey || e.metaKey) {
        if (STATE.selectedYears.has(yr)) {
          if (STATE.selectedYears.size > 1) STATE.selectedYears.delete(yr);
        } else {
          STATE.selectedYears.add(yr);
        }
        STATE.lastClickedYear = yr;
      } else if (e.shiftKey && STATE.lastClickedYear !== null) {
        const start = Math.min(STATE.lastClickedYear, yr);
        const end = Math.max(STATE.lastClickedYear, yr);
        ALL_YEARS.forEach((y) => {
          if (y >= start && y <= end) STATE.selectedYears.add(y);
        });
      } else {
        STATE.selectedYears.clear();
        STATE.selectedYears.add(yr);
        STATE.lastClickedYear = yr;
      }
      syncYearPillsUI();
      renderActiveTab();
    });

    container.appendChild(btn);
  });
}

function syncYearPillsUI() {
  const pills = document.querySelectorAll("#year-pills-container .year-pill");
  pills.forEach((p) => {
    const y = Number(p.dataset.year);
    if (STATE.selectedYears.has(y)) {
      p.classList.add("active");
    } else {
      p.classList.remove("active");
    }
  });

  // Preset button highlights
  const selArr = Array.from(STATE.selectedYears).sort();
  const presets = document.querySelectorAll(".slicer-presets .preset-btn");
  presets.forEach((btn) => btn.classList.remove("active"));

  if (selArr.length === ALL_YEARS.length) {
    document.querySelector('.slicer-presets [data-preset="all"]')?.classList.add("active");
  } else if (selArr.length === 3 && selArr[0] === 2024 && selArr[2] === 2026) {
    document.querySelector('.slicer-presets [data-preset="last3"]')?.classList.add("active");
  } else if (selArr.length === 1 && selArr[0] === 2026) {
    document.querySelector('.slicer-presets [data-preset="latest"]')?.classList.add("active");
  }
}

// ===========================================================================
// CONTROLS & EVENT LISTENERS
// ===========================================================================
function initControls() {
  // Slicer presets
  document.querySelectorAll(".slicer-presets .preset-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const preset = btn.dataset.preset;
      STATE.selectedYears.clear();
      if (preset === "all") {
        ALL_YEARS.forEach((y) => STATE.selectedYears.add(y));
      } else if (preset === "last3") {
        [2024, 2025, 2026].forEach((y) => STATE.selectedYears.add(y));
      } else if (preset === "latest") {
        STATE.selectedYears.add(2026);
      }
      STATE.lastClickedYear = 2026;
      syncYearPillsUI();
      renderActiveTab();
    });
  });

  // Main Tabs
  document.querySelectorAll(".main-tabs .tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".main-tabs .tab-btn").forEach((b) => b.classList.remove("active"));
      document.querySelectorAll(".main-content .tab-panel").forEach((p) => p.classList.remove("active"));
      btn.classList.add("active");
      const targetId = btn.dataset.tab;
      document.getElementById(targetId)?.classList.add("active");
      STATE.activeTab = targetId;
      renderActiveTab();
    });
  });

  // Tab 1: S&D View Format (Table vs Matrix)
  document.querySelectorAll("#snd-view-format .seg-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("#snd-view-format .seg-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      STATE.sndViewFormat = btn.dataset.fmt;
      renderSndTab();
    });
  });

  // Tab 1: S&D Metric Mode
  document.querySelectorAll("#snd-metric-mode .seg-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("#snd-metric-mode .seg-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      STATE.sndMetricMode = btn.dataset.metric;
      renderSndTab();
    });
  });

  // Tab 1: S&D Unit Mode
  document.querySelectorAll("#snd-unit-mode .seg-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("#snd-unit-mode .seg-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      STATE.sndUnit = btn.dataset.unit;
      renderSndTab();
    });
  });

  // Tab 1: S&D Chart Frequency (Monthly vs Annual)
  document.querySelectorAll("#snd-chart-freq .seg-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("#snd-chart-freq .seg-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      STATE.sndChartFreq = btn.dataset.freq;
      renderSndCharts();
    });
  });

  // Expand / Collapse all
  document.getElementById("btn-snd-expand-all")?.addEventListener("click", () => {
    STATE.selectedYears.forEach((y) => STATE.sndExpandedYears.add(y));
    renderSndTab();
  });
  document.getElementById("btn-snd-collapse-all")?.addEventListener("click", () => {
    STATE.sndExpandedYears.clear();
    renderSndTab();
  });
  document.getElementById("btn-snd-csv")?.addEventListener("click", exportSndCsv);

  // Tab 2: Seasonality controls
  document.getElementById("season-attr-select")?.addEventListener("change", (e) => {
    STATE.seasonAttr = e.target.value;
    renderSeasonalityTab();
  });
  document.querySelectorAll("#season-calc-mode .seg-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("#season-calc-mode .seg-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      STATE.seasonCalc = btn.dataset.calc;
      renderSeasonalityTab();
    });
  });
  document.querySelectorAll("#season-unit-mode .seg-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("#season-unit-mode .seg-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      STATE.seasonUnit = btn.dataset.unit;
      renderSeasonalityTab();
    });
  });
}

function renderActiveTab() {
  if (STATE.activeTab === "tab-snd") {
    renderSndTab();
  } else if (STATE.activeTab === "tab-seasonality") {
    renderSeasonalityTab();
  }
}

// ===========================================================================
// TAB 1: SUPPLY & DEMAND (S&D)
// ===========================================================================
function renderSndTab() {
  const isTable = STATE.sndViewFormat === "table";
  const stackedWrapper = document.getElementById("snd-stacked-tables-wrapper");
  const matrixWrapper = document.getElementById("snd-matrix-wrapper");

  if (isTable) {
    stackedWrapper.style.display = "block";
    matrixWrapper.style.display = "none";
    renderStackedSndTables();
  } else {
    stackedWrapper.style.display = "none";
    matrixWrapper.style.display = "block";
    renderSndMatrixAll();
  }

  renderSndCharts();
}

function getYearMonthsList(year) {
  const res = [];
  for (let m = 1; m <= 12; m++) {
    res.push({
      period: `${year}-${String(m).padStart(2, "0")}`,
      label: `${MONTH_SHORT[m - 1]} ${year}`
    });
  }
  return res;
}

function getPreviousPeriod(period) {
  const [y, m] = period.split("-").map(Number);
  if (m === 1) {
    return `${y - 1}-12`;
  }
  return `${y}-${String(m - 1).padStart(2, "0")}`;
}

function renderStackedSndTables() {
  const years = getSortedSelectedYears();
  const unit = STATE.sndUnit;
  const metricMode = STATE.sndMetricMode;

  const htmlCpo = buildSingleSndTableHtml("cpo", CPO_PRIMARY_ROWS, years, unit, metricMode);
  const htmlBio = buildSingleSndTableHtml("bio", DOMESTIC_ROWS, years, unit, metricMode);
  const htmlTrade = buildSingleSndTableHtml("trade", TRADE_ROWS, years, unit, metricMode);

  document.getElementById("snd-cpo-table-container").innerHTML = htmlCpo;
  document.getElementById("snd-bio-table-container").innerHTML = htmlBio;
  document.getElementById("snd-trade-table-container").innerHTML = htmlTrade;

  // Add click events on col-year-header to expand/collapse
  document.querySelectorAll(".col-year-header").forEach((th) => {
    th.addEventListener("click", () => {
      const yr = Number(th.dataset.year);
      if (STATE.sndExpandedYears.has(yr)) {
        STATE.sndExpandedYears.delete(yr);
      } else {
        STATE.sndExpandedYears.add(yr);
      }
      renderStackedSndTables();
    });
  });

  // Synchronize horizontal scrolling
  const scrollContainers = document.querySelectorAll(".sync-scroll-snd");
  scrollContainers.forEach((sc) => {
    sc.onscroll = function () {
      scrollContainers.forEach((other) => {
        if (other !== sc) other.scrollLeft = sc.scrollLeft;
      });
    };
  });
}

function buildSingleSndTableHtml(tableKey, rowDefs, years, unit, metricMode) {
  const monthly = STATE.master.monthly;
  const annMap = STATE.master.annual_cy;
  const unitTitle = unit === "mnt" ? "Million Tonnes (mn t)" : unit === "kt" ? "Thousand Tonnes (kt)" : "Tonnes (t)";

  let html = `<table class="data-table"><thead><tr><th class="col-attr">Attribute (${unitTitle})</th>`;
  for (const yr of years) {
    const isExp = STATE.sndExpandedYears.has(yr);
    const aRec = annMap[String(yr)];
    const yrHeaderLabel = aRec?.is_ytd ? `${yr} YTD` : String(yr);

    if (isExp) {
      const mList = getYearMonthsList(yr).filter((item) => monthly[item.period] !== undefined);
      for (const item of mList) {
        html += `<th class="col-month">${item.label}</th>`;
      }
    }
    html += `<th class="col-year-header col-annual ${aRec?.is_ytd ? "cell-ytd" : ""}" data-year="${yr}" title="Click to ${isExp ? "collapse" : "expand"} monthly columns">
      <span class="expand-toggle">${isExp ? "&minus;" : "+"}</span>${yrHeaderLabel}
    </th>`;
  }
  html += `</tr></thead><tbody>`;

  for (const rDef of rowDefs) {
    const rClsList = [];
    if (rDef.isHighlight) rClsList.push("highlight-row");
    if (rDef.isSubtotal) rClsList.push("subtotal-row");
    if (rDef.isRatio) rClsList.push("ratio-row");
    if (rDef.isIndent) rClsList.push(rDef.level === 2 ? "indent-row-2" : "indent-row");
    if (rDef.isMuted) rClsList.push("muted-row");

    const rCls = rClsList.join(" ");
    html += `<tr class="${rCls}"><td class="sticky-col">${rDef.label}</td>`;

    for (const yr of years) {
      const isExp = STATE.sndExpandedYears.has(yr);
      const aRec = annMap[String(yr)];

      // Monthly cells if expanded
      if (isExp) {
        const mList = getYearMonthsList(yr).filter((item) => monthly[item.period] !== undefined);
        for (const item of mList) {
          const rec = monthly[item.period];
          const rawVal = rec ? rec[rDef.key] : null;

          if (rDef.isText) {
            html += `<td class="cell-text" style="font-size:10px;text-align:center;color:#64748b;">${rawVal || "--"}</td>`;
            continue;
          }

          const val = scaleVal(rawVal, unit, rDef.isRatio);
          const formattedVal = fmtVal(val, unit, rDef.isRatio, rDef.isStock);

          if (metricMode === "volume") {
            html += `<td class="cell-num">${formattedVal}</td>`;
          } else if (metricMode === "pct") {
            const prevP = getPreviousPeriod(item.period);
            const prevRaw = monthly[prevP]?.[rDef.key];
            const prevVal = scaleVal(prevRaw, unit, rDef.isRatio);
            html += `<td class="cell-num">${fmtPctCell(val, prevVal)}</td>`;
          } else {
            // "both"
            const prevP = getPreviousPeriod(item.period);
            const prevRaw = monthly[prevP]?.[rDef.key];
            const prevVal = scaleVal(prevRaw, unit, rDef.isRatio);
            html += `<td class="cell-num"><div class="dual-cell"><span class="main-val">${formattedVal}</span>${fmtPctCell(val, prevVal)}</div></td>`;
          }
        }
      }

      // Annual summary cell
      const rawAnnVal = aRec ? aRec[rDef.key] : null;
      if (rDef.isText) {
        html += `<td class="col-annual cell-text" style="font-size:10.5px;text-align:center;font-weight:600;color:#0f766e;">${aRec ? (yr === 2026 ? "B5/B7" : yr === 2025 ? "B5" : "B7") : "--"}</td>`;
        continue;
      }

      const annVal = scaleVal(rawAnnVal, unit, rDef.isRatio);
      const formattedAnnVal = fmtVal(annVal, unit, rDef.isRatio, rDef.isStock);

      if (metricMode === "volume") {
        html += `<td class="col-annual cell-num">${formattedAnnVal}</td>`;
      } else if (metricMode === "pct") {
        const prevYrRec = annMap[String(yr - 1)];
        const prevAnnVal = scaleVal(prevYrRec?.[rDef.key], unit, rDef.isRatio);
        html += `<td class="col-annual cell-num">${fmtPctCell(annVal, prevAnnVal)}</td>`;
      } else {
        const prevYrRec = annMap[String(yr - 1)];
        const prevAnnVal = scaleVal(prevYrRec?.[rDef.key], unit, rDef.isRatio);
        html += `<td class="col-annual cell-num"><div class="dual-cell"><span class="main-val">${formattedAnnVal}</span>${fmtPctCell(annVal, prevAnnVal)}</div></td>`;
      }
    }

    html += `</tr>`;
  }
  html += `</tbody></table>`;
  return html;
}

// ===========================================================================
// S&D MONTHLY MATRIX VIEW
// ===========================================================================
function renderSndMatrixAll() {
  const years = getSortedSelectedYears();
  const unit = STATE.sndUnit;

  document.getElementById("snd-matrix-prod-container").innerHTML = buildMatrixHtmlForSection("production", "CPO Production", years, unit);
  document.getElementById("snd-matrix-exp-container").innerHTML = buildMatrixHtmlForSection("export", "Palm Oil Exports", years, unit);
  document.getElementById("snd-matrix-loc-container").innerHTML = buildMatrixHtmlForSection("total_local_consumption", "Total Domestic Consumption", years, unit);
  document.getElementById("snd-matrix-bd-container").innerHTML = buildMatrixHtmlForSection("bd_consumption", "Biodiesel Consumption", years, unit);
  document.getElementById("snd-matrix-edible-container").innerHTML = buildMatrixHtmlForSection("edible_consumption", "Edible Consumption", years, unit);
  document.getElementById("snd-matrix-stocks-container").innerHTML = buildMatrixHtmlForSection("ending_stock", "Ending Stocks", years, unit);
}

function buildMatrixHtmlForSection(fieldKey, title, years, unit) {
  const monthly = STATE.master.monthly;
  const annMap = STATE.master.annual_cy;
  const unitTitle = unit === "mnt" ? "mn t" : unit === "kt" ? "kt" : "t";

  // Gather values for min/max heatmap calculation
  const allVals = [];
  years.forEach((yr) => {
    for (let m = 1; m <= 12; m++) {
      const p = `${yr}-${String(m).padStart(2, "0")}`;
      const rec = monthly[p];
      if (rec && rec[fieldKey] !== undefined && rec[fieldKey] !== null) {
        allVals.push(rec[fieldKey]);
      }
    }
  });

  const minVal = allVals.length ? Math.min(...allVals) : 0;
  const maxVal = allVals.length ? Math.max(...allVals) : 1;

  let html = `<table class="data-table"><thead><tr><th class="col-attr">Year</th>`;
  for (let m = 0; m < 12; m++) {
    html += `<th class="col-month">${MONTH_SHORT[m]}</th>`;
  }
  html += `<th class="col-annual">Total / End (${unitTitle})</th><th class="col-annual">YoY %</th></tr></thead><tbody>`;

  years.forEach((yr) => {
    const aRec = annMap[String(yr)];
    const isStock = fieldKey.includes("stock");
    const yrLabel = aRec?.is_ytd ? `${yr} YTD` : String(yr);

    html += `<tr><td class="sticky-col font-bold">${yrLabel}</td>`;
    for (let m = 1; m <= 12; m++) {
      const p = `${yr}-${String(m).padStart(2, "0")}`;
      const rec = monthly[p];
      if (rec && rec[fieldKey] !== undefined && rec[fieldKey] !== null) {
        const raw = rec[fieldKey];
        const scaled = scaleVal(raw, unit);
        const bg = heatBg(raw, minVal, maxVal);
        html += `<td class="cell-num" style="background:${bg}">${fmtVal(scaled, unit, false, isStock)}</td>`;
      } else {
        html += `<td class="cell-num text-muted">--</td>`;
      }
    }

    // Annual summary
    const annRaw = aRec ? aRec[fieldKey] : null;
    const annScaled = scaleVal(annRaw, unit);
    const prevYrRec = annMap[String(yr - 1)];
    const prevAnnRaw = prevYrRec ? prevYrRec[fieldKey] : null;

    html += `<td class="col-annual cell-num font-bold">${fmtVal(annScaled, unit, false, isStock)}</td>`;
    html += `<td class="col-annual cell-num font-bold">${fmtPctCell(annRaw, prevAnnRaw)}</td>`;
    html += `</tr>`;
  });

  html += `</tbody></table>`;
  return html;
}

function heatBg(val, min, max) {
  if (val === null || val === undefined || max <= min) return "transparent";
  const ratio = Math.max(0, Math.min(1, (val - min) / (max - min)));
  return `rgba(5, 150, 105, ${(ratio * 0.28).toFixed(3)})`;
}

// ===========================================================================
// S&D CHARTS (CHART.JS)
// ===========================================================================
function renderSndCharts() {
  destroyChart("sndCpo");
  destroyChart("sndDomestic");
  destroyChart("sndTrade");
  destroyChart("sndStocks");

  const years = getSortedSelectedYears();
  const unit = STATE.sndUnit;
  const freq = STATE.sndChartFreq;
  const uLabel = unit === "mnt" ? "Million Tonnes (mn t)" : unit === "kt" ? "Thousand Tonnes (kt)" : "Tonnes (t)";
  const monthly = STATE.master.monthly;
  const annMap = STATE.master.annual_cy;

  const labels = [];
  const recs = [];

  if (freq === "monthly") {
    for (const yr of years) {
      const mList = getYearMonthsList(yr);
      for (const item of mList) {
        const r = monthly[item.period];
        if (!r) continue;
        labels.push(item.label);
        recs.push(r);
      }
    }
  } else {
    for (const yr of years) {
      const r = annMap[String(yr)];
      if (!r) continue;
      labels.push(r.label);
      recs.push(r);
    }
  }

  // 1. CPO Supply & Demand Balance
  const ctxCpo = document.getElementById("chart-snd-cpo")?.getContext("2d");
  if (ctxCpo) {
    STATE.charts.sndCpo = new Chart(ctxCpo, {
      type: "bar",
      data: {
        labels,
        datasets: [
          {
            type: "bar",
            label: "CPO Production",
            data: recs.map((r) => scaleVal(r.production, unit)),
            backgroundColor: "rgba(5, 150, 105, 0.8)",
            order: 3
          },
          {
            type: "bar",
            label: "Total Demand (Disappearance)",
            data: recs.map((r) => scaleVal(r.total_demand, unit)),
            backgroundColor: "rgba(217, 119, 6, 0.82)",
            order: 3
          },
          {
            type: "line",
            label: "Ending Stocks (LHS)",
            data: recs.map((r) => scaleVal(r.ending_stock, unit)),
            borderColor: "#0f766e",
            backgroundColor: "#0f766e",
            borderWidth: 2.2,
            pointRadius: 2.5,
            fill: false,
            order: 2
          },
          {
            type: "line",
            label: "Stocks-to-Use % (RHS)",
            data: recs.map((r) => r.stocks_to_use),
            borderColor: "#dc2626",
            backgroundColor: "#dc2626",
            borderWidth: 2,
            borderDash: [4, 4],
            pointRadius: 2.5,
            fill: false,
            yAxisID: "y1",
            order: 1
          }
        ]
      },
      options: chartOptionsCommon(`Volume (${uLabel})`, "STU (%)")
    });
  }

  // 2. Domestic Consumption Breakdown
  const ctxDom = document.getElementById("chart-snd-domestic")?.getContext("2d");
  if (ctxDom) {
    STATE.charts.sndDomestic = new Chart(ctxDom, {
      type: "bar",
      data: {
        labels,
        datasets: [
          {
            type: "bar",
            label: "Biodiesel (BD) Consumption",
            data: recs.map((r) => scaleVal(r.bd_consumption, unit)),
            backgroundColor: "rgba(15, 118, 110, 0.85)",
            stack: "dom",
            order: 3
          },
          {
            type: "bar",
            label: "Edible & Industrial Consumption",
            data: recs.map((r) => scaleVal(r.edible_consumption, unit)),
            backgroundColor: "rgba(245, 158, 11, 0.85)",
            stack: "dom",
            order: 3
          },
          {
            type: "line",
            label: "Biodiesel Share % (RHS)",
            data: recs.map((r) => r.bd_share_of_local),
            borderColor: "#9333ea",
            backgroundColor: "#9333ea",
            borderWidth: 2.2,
            pointRadius: 2.5,
            fill: false,
            yAxisID: "y1",
            order: 1
          }
        ]
      },
      options: chartOptionsCommon(`Volume (${uLabel})`, "BD Share (%)")
    });
  }

  // 3. Trade Flows
  const ctxTrade = document.getElementById("chart-snd-trade")?.getContext("2d");
  if (ctxTrade) {
    STATE.charts.sndTrade = new Chart(ctxTrade, {
      type: "bar",
      data: {
        labels,
        datasets: [
          {
            type: "bar",
            label: "Palm Exports",
            data: recs.map((r) => scaleVal(r.export, unit)),
            backgroundColor: "rgba(37, 99, 235, 0.82)",
            order: 3
          },
          {
            type: "bar",
            label: "Palm Imports",
            data: recs.map((r) => scaleVal(r.import, unit)),
            backgroundColor: "rgba(239, 68, 68, 0.75)",
            order: 3
          },
          {
            type: "line",
            label: "Net Exports (Exports − Imports)",
            data: recs.map((r) => scaleVal(r.net_export, unit)),
            borderColor: "#059669",
            backgroundColor: "#059669",
            borderWidth: 2.2,
            pointRadius: 2.5,
            fill: false,
            order: 1
          }
        ]
      },
      options: chartOptionsCommon(`Volume (${uLabel})`)
    });
  }

  // 4. Ending Stocks & STU Trajectory
  const ctxStocks = document.getElementById("chart-snd-stocks")?.getContext("2d");
  if (ctxStocks) {
    STATE.charts.sndStocks = new Chart(ctxStocks, {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: "Ending Stocks (LHS)",
            data: recs.map((r) => scaleVal(r.ending_stock, unit)),
            borderColor: "#047857",
            backgroundColor: "rgba(5, 150, 105, 0.15)",
            borderWidth: 2.4,
            pointRadius: 3,
            fill: true,
            yAxisID: "y"
          },
          {
            label: "Stocks-to-Use Ratio % (RHS)",
            data: recs.map((r) => r.stocks_to_use),
            borderColor: "#d97706",
            backgroundColor: "#d97706",
            borderWidth: 2.2,
            pointRadius: 3,
            fill: false,
            yAxisID: "y1"
          }
        ]
      },
      options: chartOptionsCommon(`Commercial Stocks (${uLabel})`, "STU (%)")
    });
  }
}

// ===========================================================================
// TAB 2: SEASONALITY
// ===========================================================================
function getSeasonYearSeries(yr, attrKey, calcMode = "monthly", unit = "t") {
  const isRatio = attrKey.includes("stocks_to_use") || attrKey.includes("share");
  const isStock = attrKey.includes("stock") && !isRatio;

  const rawVals = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => {
    const p = `${yr}-${String(m).padStart(2, "0")}`;
    const v = STATE.master.monthly[p]?.[attrKey];
    return v !== undefined && v !== null ? Number(v) : null;
  });

  const useCum = calcMode === "cum" && !isRatio && !isStock;
  let running = 0;
  return rawVals.map((v) => {
    if (v === null) return null;
    if (useCum) {
      running += v;
      return scaleVal(running, unit, isRatio);
    }
    return scaleVal(v, unit, isRatio);
  });
}

function renderSeasonalityTab() {
  destroyChart("seasonality");

  const attrSel = document.getElementById("season-attr-select");
  const attrLabel = attrSel.options[attrSel.selectedIndex].text;
  const attrKey = STATE.seasonAttr;
  const calcMode = STATE.seasonCalc;
  const unit = STATE.seasonUnit;

  const isRatio = attrKey.includes("stocks_to_use") || attrKey.includes("share");
  const isStock = attrKey.includes("stock") && !isRatio;
  const effectiveCum = calcMode === "cum" && !isRatio && !isStock;

  const uText = isRatio ? "%" : unit === "mnt" ? "mn t" : unit === "kt" ? "kt" : "Tonnes (t)";
  const modeLabel = effectiveCum ? "Cumulative YTD (Jan–Dec)" : "Monthly Seasonality (Jan–Dec)";

  document.getElementById("season-chart-title").textContent = `${attrLabel} — ${modeLabel}`;
  document.getElementById("season-chart-sub").textContent =
    `Units: ${uText} • Min–Max Historical Band • 3Y Benchmark Average (2023–2025) • Year Curves`;
  document.getElementById("season-table-title").textContent =
    `Seasonality Matrix & Heatmap: ${attrLabel} (${modeLabel} • ${uText})`;

  const years = getSortedSelectedYears();
  renderSeasonYearPills(years);

  // Compute 3-Year Benchmark Average (2023-2025) & Min/Max across historical baseline
  const seriesByYear = {};
  ALL_YEARS.forEach((y) => {
    seriesByYear[y] = getSeasonYearSeries(y, attrKey, calcMode, unit);
  });

  const benchYears = [2023, 2024, 2025];
  const avg3Y = [];
  const minBand = [];
  const maxBand = [];

  for (let idx = 0; idx < 12; idx++) {
    const vBench = [];
    const vAll = [];

    benchYears.forEach((y) => {
      const v = seriesByYear[y]?.[idx];
      if (v !== null && !isNaN(v)) vBench.push(v);
    });

    ALL_YEARS.forEach((y) => {
      const v = seriesByYear[y]?.[idx];
      if (v !== null && !isNaN(v)) vAll.push(v);
    });

    avg3Y.push(vBench.length ? vBench.reduce((a, b) => a + b, 0) / vBench.length : null);
    minBand.push(vAll.length ? Math.min(...vAll) : null);
    maxBand.push(vAll.length ? Math.max(...vAll) : null);
  }

  // Chart datasets
  const datasets = [];

  // Historical Min-Max Band
  datasets.push({
    label: "Min–Max Band (Upper)",
    data: maxBand,
    borderColor: "rgba(148, 163, 184, 0.35)",
    backgroundColor: "transparent",
    borderWidth: 1,
    pointRadius: 0,
    fill: false
  });
  datasets.push({
    label: "Historical Min–Max Range",
    data: minBand,
    borderColor: "rgba(148, 163, 184, 0.35)",
    backgroundColor: "rgba(226, 232, 240, 0.45)",
    borderWidth: 1,
    pointRadius: 0,
    fill: "-1"
  });

  // 3Y Benchmark Average
  datasets.push({
    label: "3Y Benchmark Avg (2023–2025)",
    data: avg3Y,
    borderColor: "#0f172a",
    backgroundColor: "transparent",
    borderWidth: 2.4,
    borderDash: [5, 4],
    pointRadius: 3,
    pointBackgroundColor: "#0f172a",
    fill: false
  });

  // Year curve colors
  const yearColors = {
    2023: { border: "#64748b", bg: "#64748b" },
    2024: { border: "#2563eb", bg: "#2563eb" },
    2025: { border: "#d97706", bg: "#d97706" },
    2026: { border: "#059669", bg: "#059669" }
  };

  years.forEach((yr) => {
    if (!STATE.seasonActiveYears.has(yr)) return;
    const c = yearColors[yr] || { border: "#059669", bg: "#059669" };
    const isCurrent = yr === 2026;
    datasets.push({
      label: isCurrent ? `${yr} (Current Year)` : String(yr),
      data: seriesByYear[yr],
      borderColor: c.border,
      backgroundColor: c.bg,
      borderWidth: isCurrent ? 3.0 : 2.0,
      pointRadius: isCurrent ? 4.5 : 3,
      pointHoverRadius: 6,
      fill: false
    });
  });

  const ctx = document.getElementById("chart-seasonality")?.getContext("2d");
  if (ctx) {
    STATE.charts.seasonality = new Chart(ctx, {
      type: "line",
      data: { labels: MONTH_SHORT, datasets },
      options: chartOptionsCommon(uText)
    });
  }

  // Render Seasonality Table
  renderSeasonalityTable(years, seriesByYear, avg3Y, minBand, maxBand, unit, isRatio, isStock);
}

function renderSeasonYearPills(years) {
  const container = document.getElementById("season-year-pills");
  if (!container) return;
  container.innerHTML = "";

  years.forEach((yr) => {
    const btn = document.createElement("button");
    btn.className = `pill-sm ${STATE.seasonActiveYears.has(yr) ? "active" : ""}`;
    btn.textContent = String(yr);
    btn.addEventListener("click", () => {
      if (STATE.seasonActiveYears.has(yr)) {
        if (STATE.seasonActiveYears.size > 1) STATE.seasonActiveYears.delete(yr);
      } else {
        STATE.seasonActiveYears.add(yr);
      }
      renderSeasonalityTab();
    });
    container.appendChild(btn);
  });
}

function renderSeasonalityTable(years, seriesByYear, avg3Y, minBand, maxBand, unit, isRatio, isStock) {
  const container = document.getElementById("seasonality-table-container");
  if (!container) return;

  const uText = isRatio ? "%" : unit === "mnt" ? "mn t" : unit === "kt" ? "kt" : "t";

  // Compute table min/max for heat coloring
  const matrixVals = [];
  years.forEach((y) => {
    (seriesByYear[y] || []).forEach((v) => {
      if (v !== null && !isNaN(v)) matrixVals.push(v);
    });
  });
  const tMin = matrixVals.length ? Math.min(...matrixVals) : 0;
  const tMax = matrixVals.length ? Math.max(...matrixVals) : 1;

  let html = `<table class="data-table"><thead><tr><th class="col-attr">Series / Year (${uText})</th>`;
  for (let m = 0; m < 12; m++) {
    html += `<th class="col-month">${MONTH_SHORT[m]}</th>`;
  }
  html += `<th class="col-annual">Total / Avg</th><th class="col-annual">YoY %</th></tr></thead><tbody>`;

  // 1. Benchmark Row (3Y Avg)
  html += `<tr class="highlight-row font-bold"><td class="sticky-col">3Y Benchmark Avg (2023–2025)</td>`;
  avg3Y.forEach((v) => {
    html += `<td class="cell-num font-mono">${v !== null ? fmtVal(v, unit, isRatio, isStock) : "--"}</td>`;
  });
  const benchSum = avg3Y.filter((v) => v !== null);
  const benchTot = isStock || isRatio ? (benchSum.length ? benchSum.reduce((a, b) => a + b, 0) / benchSum.length : null) : benchSum.reduce((a, b) => a + b, 0);
  html += `<td class="col-annual cell-num font-bold">${benchTot !== null ? fmtVal(benchTot, unit, isRatio, isStock) : "--"}</td><td class="col-annual cell-num">--</td></tr>`;

  // 2. Year Rows
  years.forEach((yr) => {
    const s = seriesByYear[yr] || [];
    const prevSeries = seriesByYear[yr - 1] || [];
    const isCurrent = yr === 2026;

    html += `<tr class="${isCurrent ? 'font-bold' : ''}"><td class="sticky-col">${yr}${isCurrent ? ' (Current Year)' : ''}</td>`;
    for (let m = 0; m < 12; m++) {
      const v = s[m];
      if (v !== null && !isNaN(v)) {
        const bg = heatBg(v, tMin, tMax);
        html += `<td class="cell-num" style="background:${bg}">${fmtVal(v, unit, isRatio, isStock)}</td>`;
      } else {
        html += `<td class="cell-num text-muted">--</td>`;
      }
    }

    const validVals = s.filter((v) => v !== null && !isNaN(v));
    const yrSummary = isStock || isRatio ? (validVals.length ? validVals[validVals.length - 1] : null) : validVals.reduce((a, b) => a + b, 0);

    const prevValid = prevSeries.filter((v) => v !== null && !isNaN(v));
    const prevSummary = isStock || isRatio ? (prevValid.length ? prevValid[prevValid.length - 1] : null) : prevValid.reduce((a, b) => a + b, 0);

    html += `<td class="col-annual cell-num font-bold">${yrSummary !== null ? fmtVal(yrSummary, unit, isRatio, isStock) : "--"}</td>`;
    html += `<td class="col-annual cell-num font-bold">${fmtPctCell(yrSummary, prevSummary)}</td>`;
    html += `</tr>`;
  });

  // 3. Historical Min & Max rows
  html += `<tr class="muted-row"><td class="sticky-col font-bold">Historical Min Band</td>`;
  minBand.forEach((v) => {
    html += `<td class="cell-num">${v !== null ? fmtVal(v, unit, isRatio, isStock) : "--"}</td>`;
  });
  html += `<td class="col-annual cell-num">--</td><td class="col-annual cell-num">--</td></tr>`;

  html += `<tr class="muted-row"><td class="sticky-col font-bold">Historical Max Band</td>`;
  maxBand.forEach((v) => {
    html += `<td class="cell-num">${v !== null ? fmtVal(v, unit, isRatio, isStock) : "--"}</td>`;
  });
  html += `<td class="col-annual cell-num">--</td><td class="col-annual cell-num">--</td></tr>`;

  html += `</tbody></table>`;
  container.innerHTML = html;
}

// ===========================================================================
// CSV EXPORT
// ===========================================================================
function exportSndCsv() {
  const years = getSortedSelectedYears();
  const monthly = STATE.master.monthly;
  const annMap = STATE.master.annual_cy;

  const rows = [];
  const headers = [
    "Period", "Year", "Month",
    "Starting Stocks (t)", "CPO Production (t)", "Imports (t)", "Total Supply (t)",
    "Exports (t)", "Total Domestic Consumption (t)", "Biodiesel Consumption (t)", "Edible Consumption (t)",
    "Total Demand (t)", "Balancing Figure (t)", "Ending Stocks (t)", "Stocks-to-Use (%)", "Biodiesel Share (%)", "Mandate"
  ];
  rows.push(headers.join(","));

  years.forEach((yr) => {
    for (let m = 1; m <= 12; m++) {
      const p = `${yr}-${String(m).padStart(2, "0")}`;
      const r = monthly[p];
      if (!r) continue;
      rows.push([
        p, yr, m,
        r.starting_stock, r.production, r.import, r.total_supply,
        r.export, r.total_local_consumption, r.bd_consumption, r.edible_consumption,
        r.total_demand, r.balancing_figure, r.ending_stock, r.stocks_to_use, r.bd_share_of_local, `"${r.mandate_note || ""}"`
      ].join(","));
    }

    const a = annMap[String(yr)];
    if (a) {
      rows.push([
        `${yr} TOTAL`, yr, "ANNUAL",
        a.starting_stock, a.production, a.import, a.total_supply,
        a.export, a.total_local_consumption, a.bd_consumption, a.edible_consumption,
        a.total_demand, a.balancing_figure, a.ending_stock, a.stocks_to_use, a.bd_share_of_local, "ANNUAL"
      ].join(","));
    }
  });

  const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Thailand_Palm_Oil_SND_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
