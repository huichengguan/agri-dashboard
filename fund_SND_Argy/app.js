/**
 * Argentina Soybeans & Soy Products Supply & Demand Institutional Dashboard (app.js)
 * 100% Official SAGyP / Secretaría de Energía / Argus Media Data (Jan 2015 – Aug 2026)
 */

const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MY_MONTH_ORDER = [4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3]; // Apr .. Mar
const MY_MONTH_LABELS = ["Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan (+1)", "Feb (+1)", "Mar (+1)"];
let ALL_YEARS = Array.from({ length: 2026 - 2015 + 1 }, (_, i) => 2015 + i);

function fmtPeriodShort(period) {
  if (!period || !period.includes("-")) return period || "";
  const [y, m] = period.split("-").map(Number);
  return `${MONTH_SHORT[m - 1]} ${y}`;
}

const STATE = {
  master: null,
  selectedYears: new Set([2022, 2023, 2024, 2025, 2026]), // Default: Last 5 years
  lastClickedYear: 2026,
  activeTab: "tab-snd",

  // Tab 1: S&D state
  sndViewFormat: "table",   // "table" | "matrix"
  sndYearBasis: "my",       // "my" (Apr-Mar, default) | "cy" (Jan-Dec)
  sndMetricMode: "volume",  // "volume" | "both" | "pct"
  sndUnit: "t",             // "t" | "mnt"
  sndExpandedYears: new Set([2026]), // Expand 2026/27 by default so user immediately sees recent monthly S&D
  sndChartFreq: "monthly",  // "monthly" | "annual"

  // Tab 7: Seasonality state
  seasonAttr: "soybeans.crushed",
  seasonAxis: "my",         // "my" (Apr-Mar, default) | "cy" (Jan-Dec)
  seasonCalc: "monthly",    // "monthly" | "cum"
  seasonUnit: "t",          // "t" | "mnt"
  seasonActiveYears: new Set([2023, 2024, 2025, 2026]),

  charts: {}
};

// ===========================================================================
// S&D ROW DEFINITIONS FOR VERTICALLY STACKED TABLES
// ===========================================================================
const SOYBEANS_ROWS = [
  { key: "beginning_stocks", label: "Beginning Stocks (Off-Farm)", isStock: true },
  { key: "delivered_to_storage", label: "Delivered to Storage", isSubtotal: true },
  { key: "imports", label: "↳ Imports", isIndent: true },
  { key: "domestic_deliveries_to_storage", label: "↳ Domestic Deliveries to Storage", isIndent: true },
  { key: "total_demand", label: "Total Soybeans Demand", isSubtotal: true },
  { key: "crushed", label: "↳ Crushed", isIndent: true },
  { key: "exports", label: "↳ Exported", isIndent: true },
  { key: "other_milling_use", label: "↳ Other Milling Use", isIndent: true },
  { key: "ending_stocks", label: "Ending Stocks (Off-Farm)", isHighlight: true, isStock: true },
  { key: "stocks_to_use", label: "Stocks-to-Use Ratio (%)", isRatio: true, isHighlight: true },
  { key: "_divider_crush", label: "SOYBEAN CRUSHING SUB-LEDGER (CRUSHERS)", isDivider: true },
  { key: "crushers_beginning_stocks", label: "Beginning Stocks (Crushers)", isStock: true },
  { key: "delivered_to_crushers", label: "Delivered to Crushers", isSubtotal: true },
  { key: "domestic_delivered_to_crushers", label: "↳ Domestic Delivered to Crushers", isIndent: true },
  { key: "crushed", label: "Crushed (Processed into SBM & SBO)" },
  { key: "crushers_ending_stocks", label: "Ending Stocks (Crushers)", isHighlight: true, isStock: true },
  { key: "crushers_stocks_to_use", label: "Stocks-to-Crush Ratio (%)", isRatio: true }
];

const SBM_ROWS = [
  { key: "beginning_stocks", label: "Beginning Stocks (Crushers)", isStock: true },
  { key: "production", label: "Production (Soybean Meal)", isSubtotal: true },
  { key: "extraction_ratio", label: "↳ Extraction Ratio (% of Crush)", isRatio: true, isExtraction: true, isIndent: true },
  { key: "imports", label: "Imports" },
  { key: "total_demand", label: "Total SBM Demand", isSubtotal: true },
  { key: "domestic_use", label: "↳ Domestic Use", isIndent: true },
  { key: "exports", label: "↳ Exports", isIndent: true },
  { key: "ending_stocks", label: "Ending Stocks (Crushers)", isHighlight: true, isStock: true },
  { key: "stocks_to_use", label: "Stocks-to-Use Ratio (%)", isRatio: true, isHighlight: true }
];

const SBO_ROWS = [
  { key: "beginning_stocks", label: "Beginning Stocks (Crushers)", isStock: true },
  { key: "production", label: "Production (Soybean Oil)", isSubtotal: true },
  { key: "extraction_ratio", label: "↳ Extraction Ratio (% of Crush)", isRatio: true, isExtraction: true, isIndent: true },
  { key: "imports", label: "Imports" },
  { key: "total_demand", label: "Total SBO Demand", isSubtotal: true },
  { key: "domestic_use", label: "↳ Domestic Use: Total", isIndent: true },
  { key: "biofuel_use", label: "• Biofuel Use (Biodiesel Eq.)", isSubIndent: true },
  { key: "non_biofuel_use", label: "• Non-Biofuel Use", isSubIndent: true },
  { key: "exports", label: "↳ Exports", isIndent: true },
  { key: "ending_stocks", label: "Ending Stocks (Crushers)", isHighlight: true, isStock: true },
  { key: "stocks_to_use", label: "Stocks-to-Use Ratio (%)", isRatio: true, isHighlight: true }
];

const BIODIESEL_ROWS = [
  { key: "production", label: "Production (Biodiesel)", isSubtotal: true },
  { key: "sbo_feedstock_used", label: "↳ SBO Feedstock Used (Soybean Oil Eq.)", isIndent: true },
  { key: "sbo_share_of_domestic", label: "↳ Share of SBO Domestic Use (%)", isRatio: true, isIndent: true },
  { key: "total_demand", label: "Total Disappearance (Sales + Exports)", isSubtotal: true },
  { key: "domestic_sales", label: "↳ Domestic Blending Sales (Corte)", isIndent: true },
  { key: "exports", label: "↳ Exports", isIndent: true },
  { key: "export_share", label: "Export Share of Production (%)", isRatio: true, isHighlight: true }
];

const CORN_ROWS = [
  { key: "beginning_stocks", label: "Beginning Stocks (Off-Farm)", isStock: true },
  { key: "delivered_to_storage", label: "Delivered to Storage", isSubtotal: true },
  { key: "total_demand", label: "Total Corn Demand (Exports + Milling)", isSubtotal: true },
  { key: "exports", label: "↳ Exported (Corn Grain)", isIndent: true },
  { key: "total_milling", label: "↳ Domestic Milling & Industrial Use: Total", isIndent: true },
  { key: "feed_milling", label: "• Compound Animal Feed (Balanceado)", isSubIndent: true },
  { key: "wet_milling", label: "• Wet Milling — Starch / Fructose (Mol. Húmeda)", isSubIndent: true },
  { key: "dry_milling", label: "• Dry Milling — Grits / Flour (Mol. Seca)", isSubIndent: true },
  { key: "other_industrial", label: "• Other Industrial Milling (Otras Ind.)", isSubIndent: true },
  { key: "ending_stocks", label: "Ending Stocks (Off-Farm)", isHighlight: true, isStock: true },
  { key: "stocks_to_use", label: "Stocks-to-Use Ratio (%)", isRatio: true, isHighlight: true },
  { key: "_divider_eth", label: "CORN BIOETHANOL SUB-LEDGER (SECRETARÍA DE ENERGÍA / INDEC)", isDivider: true },
  { key: "bioethanol_corn_tonnes", label: "Corn Bioethanol Production (Tonnes Eq.)", isSubtotal: true },
  { key: "bioethanol_corn_feedstock_tonnes", label: "↳ Implied Corn Feedstock Used (Tonnes Eq.)", isIndent: true },
  { key: "bioethanol_corn_share", label: "↳ Corn Share of Total Bioethanol (%)", isRatio: true, isIndent: true }
];

// ===========================================================================
// FORMATTING HELPERS
// ===========================================================================
function scaleVal(val, unit = "t", isRatio = false) {
  if (val === null || val === undefined || Number.isNaN(Number(val))) return null;
  const n = Number(val);
  if (isRatio) return n;
  return unit === "mnt" ? n / 1e6 : n;
}

function fmtVal(val, unit = "t", isRatio = false, isExtraction = false, isEst = false, isConfidential = false) {
  if (val === null || val === undefined || Number.isNaN(Number(val))) {
    if (isConfidential) {
      return '<span class="text-muted" style="border-bottom:1px dotted #94a3b8;cursor:help;" title="INDEC Statistical Secrecy (\'s\'): Fewer than 3 companies exported biodiesel in this month">--</span>';
    }
    return '<span class="text-muted">--</span>';
  }
  const n = Number(val);
  let out = "";
  if (isRatio) {
    const dec = isExtraction ? 2 : 1;
    out = `${n.toFixed(dec)}%`;
  } else if (unit === "mnt") {
    out = (n / 1e6).toLocaleString("en-US", {
      minimumFractionDigits: 3,
      maximumFractionDigits: 3
    });
  } else {
    out = Math.round(n).toLocaleString("en-US");
  }
  if (isEst) {
    return `<span class="cell-indec-est" style="color:#d97706;font-weight:700;border-bottom:1px dotted #d97706;cursor:help;" title="INDEC Preliminary (Cuadro 6: Balanza Comercial de la Soja YoY Quantity %) — Pending final SAGyP confirmation">${out}</span>`;
  }
  return out;
}

function fmtPctCell(val, dec = 1) {
  if (val === null || val === undefined || Number.isNaN(Number(val)) || !Number.isFinite(Number(val))) {
    return '<span class="text-muted">--</span>';
  }
  const n = Number(val);
  const sign = n > 0 ? "+" : "";
  const cls = n > 0 ? "cell-pos" : n < 0 ? "cell-neg" : "";
  return `<span class="${cls}">${sign}${n.toFixed(dec)}%</span>`;
}

function destroyChart(key) {
  if (typeof Chart === "undefined") return;
  if (STATE.charts[key]) {
    try {
      STATE.charts[key].destroy();
    } catch (e) {
      console.warn("Chart destroy error:", e);
    }
    delete STATE.charts[key];
  }
}

function getSortedSelectedYears() {
  const arr = Array.from(STATE.selectedYears).sort((a, b) => a - b);
  return arr.length ? arr : [2022, 2023, 2024, 2025, 2026];
}

function chartOptionsCommon(yTitle, unit = "t", isRatio = false) {
  const unitSuffix = isRatio ? "%" : unit === "mnt" ? " mn t" : " t";
  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: "index", intersect: false },
    plugins: {
      legend: {
        position: "top",
        labels: {
          color: "#334155",
          font: { family: "'Inter', sans-serif", size: 11, weight: "600" },
          boxWidth: 12,
          padding: 10
        }
      },
      tooltip: {
        backgroundColor: "rgba(15, 23, 42, 0.94)",
        titleFont: { family: "'Inter', sans-serif", size: 12, weight: "700" },
        bodyFont: { family: "'JetBrains Mono', monospace", size: 11 },
        padding: 10,
        callbacks: {
          label: (ctx) => {
            const raw = ctx.parsed.y;
            if (raw === null || raw === undefined) return null;
            const dsLabel = ctx.dataset.label || "";
            const isPctAxis = ctx.dataset.yAxisID === "y1" || dsLabel.includes("%") || isRatio;
            if (isPctAxis) {
              return `${dsLabel}: ${Number(raw).toFixed(2)}%`;
            }
            if (unit === "mnt") {
              return `${dsLabel}: ${Number(raw).toFixed(3)} mn t`;
            }
            return `${dsLabel}: ${Math.round(Number(raw)).toLocaleString("en-US")} t`;
          }
        }
      }
    },
    scales: {
      x: {
        ticks: { color: "#64748b", font: { size: 10.5 }, maxRotation: 45 },
        grid: { color: "rgba(100,116,139,0.08)" }
      },
      y: {
        position: "left",
        title: { display: Boolean(yTitle), text: yTitle, color: "#334155", font: { weight: "bold", size: 11 } },
        ticks: {
          color: "#475569",
          font: { family: "'JetBrains Mono', monospace", size: 10.5 },
          callback: (v) => isRatio ? `${v}%` : unit === "mnt" ? Number(v).toFixed(1) : Number(v).toLocaleString("en-US")
        },
        grid: { color: "rgba(100,116,139,0.08)" }
      }
    }
  };
}

// ===========================================================================
// INITIALIZATION & CONTROLS
// ===========================================================================
function initDashboard() {
  try {
    const data = window.DASHBOARD_DATA;
    if (!data) {
      throw new Error("window.DASHBOARD_DATA is missing. Run python etl/build_dashboard_data.py first.");
    }
    STATE.master = data;
    if (Array.isArray(data.metadata?.years) && data.metadata.years.length) {
      ALL_YEARS = data.metadata.years.slice().sort((a, b) => a - b);
      const maxYr = ALL_YEARS[ALL_YEARS.length - 1];
      STATE.selectedYears = new Set(ALL_YEARS.slice(-5));
      STATE.lastClickedYear = maxYr;
      STATE.sndExpandedYears = new Set([maxYr]);
      STATE.seasonActiveYears = new Set(ALL_YEARS.slice(-4));
    }

    updateHeaderKpis();
    renderYearSlicer();
    initControls();
    renderActiveTab();
  } catch (err) {
    console.error("Dashboard initialization error:", err);
    const mainEl = document.querySelector(".main-content");
    if (mainEl) {
      mainEl.innerHTML = `<div style="padding:24px;background:#fee2e2;color:#991b1b;border-radius:8px;margin:20px;">
        <h3>Dashboard Load Error</h3>
        <p>${err.message}</p>
      </div>`;
    }
  }
}

function updateHeaderKpis() {
  const meta = STATE.master.metadata || {};
  const latestCrushPeriod = meta.latest_actual_period || "2026-09";
  const latestStocksPeriod = meta.latest_stocks_period || latestCrushPeriod;
  const crushRec = STATE.master.monthly[latestCrushPeriod];
  const stockRec = STATE.master.monthly[latestStocksPeriod] || crushRec;
  const unit = STATE.sndUnit;

  const badge = document.getElementById("brand-badge");
  if (badge) {
    badge.textContent = `SAGyP / INDEC LIVE`;
  }

  const crushShort = fmtPeriodShort(latestCrushPeriod);
  const stockShort = fmtPeriodShort(latestStocksPeriod);

  const subEl = document.getElementById("header-subtitle");
  if (subEl) {
    subEl.innerHTML = `Official SAGyP (<code>magyp.gob.ar</code>), INDEC &amp; Secretar&iacute;a de Energ&iacute;a Monthly Statistics (Jan 2015&ndash;${stockShort}) &bull; Soybeans, Soybean Meal (SBM) &amp; Soybean Oil (SBO)`;
  }
  const badgeRange = document.getElementById("badge-actual-range");
  if (badgeRange) {
    badgeRange.textContent = `ACTUAL (Jan 2015–${stockShort})`;
  }

  const kpiLatest = document.getElementById("kpi-latest-month");
  if (kpiLatest) {
    kpiLatest.textContent = crushShort === stockShort ? crushShort : `${crushShort} (Stocks: ${stockShort})`;
  }

  const lblCrush = document.getElementById("kpi-label-crush");
  if (lblCrush) lblCrush.textContent = `${crushShort} Soybeans Crushed`;
  const lblStock = document.getElementById("kpi-label-sb-stock");
  if (lblStock) lblStock.textContent = `${stockShort} Soybeans End Stock`;
  const lblSbm = document.getElementById("kpi-label-sbm");
  if (lblSbm) lblSbm.textContent = `${crushShort} SBM Prod / Export`;
  const lblSbo = document.getElementById("kpi-label-sbo");
  if (lblSbo) lblSbo.textContent = `${crushShort} SBO Prod / Export`;

  const uSuffix = unit === "mnt" ? " mn t" : " t";
  if (crushRec) {
    const elCrush = document.getElementById("kpi-val-crush");
    if (elCrush) elCrush.innerHTML = `${fmtVal(crushRec.soybeans.crushed, unit)}${uSuffix}`;
    const elSbm = document.getElementById("kpi-val-sbm");
    if (elSbm) elSbm.innerHTML = `${fmtVal(crushRec.sbm.production, unit)} / ${fmtVal(crushRec.sbm.exports, unit)}${uSuffix}`;
    const elSbo = document.getElementById("kpi-val-sbo");
    if (elSbo) elSbo.innerHTML = `${fmtVal(crushRec.sbo.production, unit)} / ${fmtVal(crushRec.sbo.exports, unit)}${uSuffix}`;
  }
  if (stockRec) {
    const elStock = document.getElementById("kpi-val-sb-stock");
    if (elStock) elStock.innerHTML = `${fmtVal(stockRec.soybeans.ending_stocks, unit)}${uSuffix}`;
  }
}

function formatYearPillLabel(yr) {
  const isMY = (STATE.activeTab === "tab-snd" && STATE.sndYearBasis === "my") ||
               (STATE.activeTab === "tab-seasonality" && STATE.seasonAxis === "my");
  if (isMY) {
    const aRec = STATE.master?.annual_my?.[String(yr)];
    const next2 = String(yr + 1).slice(2);
    return aRec?.is_ytd ? `${yr}/${next2} MYTD` : `${yr}/${next2}`;
  }
  const cRec = STATE.master?.annual_cy?.[String(yr)];
  return cRec?.is_ytd ? `${yr} YTD` : String(yr);
}

function renderYearSlicer() {
  const container = document.getElementById("year-pills-container");
  if (!container) return;
  container.innerHTML = "";

  ALL_YEARS.forEach(yr => {
    const pill = document.createElement("button");
    pill.className = "year-pill";
    if (STATE.selectedYears.has(yr)) pill.classList.add("selected");
    if (yr === 2026) pill.classList.add("is-ytd-year");
    pill.textContent = formatYearPillLabel(yr);
    pill.title = yr === 2026
      ? "2026 (Complete monthly S&D through Aug 2026) — Click to select, Ctrl+Click to multi-select"
      : `${yr} — Click to select single year, Ctrl+Click to multi-select, Shift+Click for range`;

    pill.addEventListener("click", (e) => {
      document.querySelectorAll(".preset-btn").forEach(b => b.classList.remove("active"));
      if (e.shiftKey && STATE.lastClickedYear !== null) {
        const start = Math.min(STATE.lastClickedYear, yr);
        const end = Math.max(STATE.lastClickedYear, yr);
        if (!e.ctrlKey && !e.metaKey) STATE.selectedYears.clear();
        for (let y = start; y <= end; y++) STATE.selectedYears.add(y);
      } else if (e.ctrlKey || e.metaKey) {
        if (STATE.selectedYears.has(yr)) {
          if (STATE.selectedYears.size > 1) STATE.selectedYears.delete(yr);
        } else {
          STATE.selectedYears.add(yr);
        }
        STATE.lastClickedYear = yr;
      } else {
        STATE.selectedYears.clear();
        STATE.selectedYears.add(yr);
        STATE.lastClickedYear = yr;
      }
      syncYearPillsUI();
      renderActiveTab();
    });
    container.appendChild(pill);
  });
}

function syncYearPillsUI() {
  const pills = document.querySelectorAll(".year-pill");
  pills.forEach((pill, idx) => {
    const yr = ALL_YEARS[idx];
    pill.classList.toggle("selected", STATE.selectedYears.has(yr));
    pill.textContent = formatYearPillLabel(yr);
  });
}

function initControls() {
  // Global Year Slicer Presets
  document.querySelectorAll(".preset-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".preset-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      const preset = btn.dataset.preset;
      STATE.selectedYears.clear();
      if (preset === "last5") {
        ALL_YEARS.slice(-5).forEach(y => STATE.selectedYears.add(y));
      } else if (preset === "last8") {
        ALL_YEARS.slice(-8).forEach(y => STATE.selectedYears.add(y));
      } else {
        ALL_YEARS.forEach(y => STATE.selectedYears.add(y));
      }
      syncYearPillsUI();
      renderActiveTab();
    });
  });

  // Main Navigation Tabs
  document.querySelectorAll("#main-tabs .tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("#main-tabs .tab-btn").forEach(b => b.classList.remove("active"));
      document.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("active"));
      btn.classList.add("active");
      STATE.activeTab = btn.dataset.tab;
      document.getElementById(STATE.activeTab).classList.add("active");
      syncYearPillsUI();
      renderActiveTab();
    });
  });

  // Tab 1: View Format (Balance Sheet vs Monthly Matrix)
  document.querySelectorAll("#snd-view-format .seg-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("#snd-view-format .seg-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      STATE.sndViewFormat = btn.dataset.fmt;
      renderSndTab();
    });
  });

  // Tab 1: Year Basis (Calendar Year vs Marketing Year Apr-Mar)
  document.querySelectorAll("#snd-year-basis .seg-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("#snd-year-basis .seg-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      STATE.sndYearBasis = btn.dataset.basis;
      syncYearPillsUI();
      renderSndTab();
    });
  });

  // Tab 1: Metric Mode (Volume | Volume + % Change | MoM % / YoY %)
  document.querySelectorAll("#snd-metric-mode .seg-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("#snd-metric-mode .seg-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      STATE.sndMetricMode = btn.dataset.metric;
      renderSndTab();
    });
  });

  // Tab 1: Units (Tonnes vs Million Tonnes)
  document.querySelectorAll("#snd-unit-mode .seg-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("#snd-unit-mode .seg-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      STATE.sndUnit = btn.dataset.unit;
      // Also sync seasonality unit button
      STATE.seasonUnit = STATE.sndUnit;
      document.querySelectorAll("#season-unit-mode .seg-btn").forEach(b => {
        b.classList.toggle("active", b.dataset.unit === STATE.sndUnit);
      });
      updateHeaderKpis();
      renderSndTab();
    });
  });

  // Tab 1: Expand All / Collapse All / CSV
  document.getElementById("btn-snd-expand-all").addEventListener("click", () => {
    getSortedSelectedYears().forEach(y => STATE.sndExpandedYears.add(y));
    renderSndTab();
  });
  document.getElementById("btn-snd-collapse-all").addEventListener("click", () => {
    STATE.sndExpandedYears.clear();
    renderSndTab();
  });
  document.getElementById("btn-snd-csv").addEventListener("click", exportSndCsv);

  // Tab 1: Chart Frequency
  document.querySelectorAll("#snd-chart-freq .seg-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("#snd-chart-freq .seg-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      STATE.sndChartFreq = btn.dataset.freq;
      renderSndCharts();
    });
  });

  // Tab 7: Seasonality Controls
  document.getElementById("season-attr-select").addEventListener("change", (e) => {
    STATE.seasonAttr = e.target.value;
    renderSeasonalityTab();
  });
  document.querySelectorAll("#season-axis-mode .seg-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("#season-axis-mode .seg-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      STATE.seasonAxis = btn.dataset.axis;
      syncYearPillsUI();
      renderSeasonalityTab();
    });
  });
  document.querySelectorAll("#season-calc-mode .seg-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("#season-calc-mode .seg-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      STATE.seasonCalc = btn.dataset.calc;
      renderSeasonalityTab();
    });
  });
  document.querySelectorAll("#season-unit-mode .seg-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("#season-unit-mode .seg-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      STATE.seasonUnit = btn.dataset.unit;
      STATE.sndUnit = STATE.seasonUnit;
      document.querySelectorAll("#snd-unit-mode .seg-btn").forEach(b => {
        b.classList.toggle("active", b.dataset.unit === STATE.seasonUnit);
      });
      updateHeaderKpis();
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
// TAB 1: VERTICALLY STACKED S&D TABLES (SOYBEANS -> SBM -> SBO) & CHARTS
// ===========================================================================
function getYearMonthsList(yr, basis = "cy") {
  if (basis === "my") {
    const out = [];
    for (let m = 4; m <= 12; m++) {
      out.push({ period: `${yr}-${String(m).padStart(2, "0")}`, label: `${MONTH_SHORT[m - 1]} ${String(yr).slice(2)}` });
    }
    for (let m = 1; m <= 3; m++) {
      out.push({ period: `${yr + 1}-${String(m).padStart(2, "0")}`, label: `${MONTH_SHORT[m - 1]} ${String(yr + 1).slice(2)}` });
    }
    return out;
  }
  const out = [];
  for (let m = 1; m <= 12; m++) {
    out.push({ period: `${yr}-${String(m).padStart(2, "0")}`, label: `${MONTH_SHORT[m - 1]} ${String(yr).slice(2)}` });
  }
  return out;
}

function getPreviousPeriod(period) {
  const [yStr, mStr] = period.split("-");
  let y = Number(yStr);
  let m = Number(mStr) - 1;
  if (m === 0) {
    m = 12;
    y -= 1;
  }
  return `${y}-${String(m).padStart(2, "0")}`;
}

function renderSndTab() {
  const isMatrix = STATE.sndViewFormat === "matrix";
  const stackedWrapper = document.getElementById("snd-stacked-tables-wrapper");
  const matrixWrapper = document.getElementById("snd-matrix-wrapper");
  const metricGroup = document.getElementById("snd-metric-group");
  const tableActions = document.getElementById("snd-table-actions");

  if (stackedWrapper) stackedWrapper.style.display = isMatrix ? "none" : "block";
  if (matrixWrapper) matrixWrapper.style.display = isMatrix ? "block" : "none";
  if (metricGroup) metricGroup.style.display = isMatrix ? "none" : "flex";
  if (tableActions) tableActions.style.display = isMatrix ? "none" : "flex";

  if (isMatrix) {
    renderSndMatrixAll();
  } else {
    renderStackedSndTables();
  }
  renderSndCharts();
}

function buildSingleSndTableHtml(sectionKey, rowDefs, years, basis, unit, metricMode) {
  const monthly = STATE.master.monthly;
  const annMap = basis === "my" ? STATE.master.annual_my : STATE.master.annual_cy;
  const unitTitle = unit === "mnt" ? "Million Tonnes (mn t)" : "Tonnes (t)";

  // Count total columns for divider rows
  let totalCols = 1;
  for (const yr of years) {
    const isExp = STATE.sndExpandedYears.has(yr);
    if (isExp) {
      const mList = getYearMonthsList(yr, basis).filter(item => monthly[item.period] !== undefined);
      totalCols += mList.length;
    }
    totalCols += 1;
  }

  let html = `<table class="data-table"><thead><tr><th class="col-attr">Attribute (${unitTitle})</th>`;
  for (const yr of years) {
    const isExp = STATE.sndExpandedYears.has(yr);
    const aRec = annMap[String(yr)];
    const yrHeaderLabel = basis === "my"
      ? (aRec?.my_label || `${yr}/${String(yr + 1).slice(2)}`)
      : (aRec?.is_ytd ? `${yr} YTD` : String(yr));

    if (isExp) {
      const mList = getYearMonthsList(yr, basis).filter(item => monthly[item.period] !== undefined);
      for (const item of mList) {
        html += `<th class="col-month">${item.label}</th>`;
      }
    }
    html += `<th class="col-year-header col-annual ${aRec?.is_ytd ? 'cell-ytd' : ''}" data-year="${yr}" title="Click to ${isExp ? 'collapse' : 'expand'} monthly columns across Soybeans, SBM & SBO">
      <span class="expand-toggle">${isExp ? "&minus;" : "+"}</span>${yrHeaderLabel}
    </th>`;
  }
  html += `</tr></thead><tbody>`;

  for (const rDef of rowDefs) {
    if (rDef.isDivider) {
      html += `<tr class="row-section-divider"><td class="sticky-col">${rDef.label}</td><td colspan="${totalCols - 1}"></td></tr>`;
      continue;
    }

    const rClsList = [];
    if (rDef.isHighlight) rClsList.push("row-highlight");
    else if (rDef.isSubtotal) rClsList.push("row-subtotal");
    if (rDef.isIndent) rClsList.push("row-indent");
    if (rDef.isSubIndent) rClsList.push("row-sub-indent");
    const rCls = rClsList.join(" ");
    const ratioStyle = rDef.isRatio ? 'style="color:#047857;font-weight:700;"' : "";

    // 1. Volume / Level Row (shown when metricMode is "volume" or "both")
    const cleanAttrTitle = rDef.label.replace(/^↳\s*/, "").replace(/^•\s*/, "").replace(/&minus;/g, "-");
    if (metricMode === "volume" || metricMode === "both") {
      html += `<tr class="${rCls}"><td class="sticky-col col-attr" ${ratioStyle} title="${cleanAttrTitle}">${rDef.label}</td>`;
      for (const yr of years) {
        const isExp = STATE.sndExpandedYears.has(yr);
        const aRec = annMap[String(yr)];
        if (isExp) {
          const mList = getYearMonthsList(yr, basis).filter(item => monthly[item.period] !== undefined);
          for (const item of mList) {
            const fullRec = monthly[item.period];
            const mRec = fullRec?.[sectionKey];
            const val = mRec ? mRec[rDef.key] : null;
            const isEst = Array.isArray(fullRec?.estimated_fields) && fullRec.estimated_fields.includes(`${sectionKey}.${rDef.key}`);
            const isConf = sectionKey === "biodiesel" && (rDef.key === "exports" || rDef.key === "total_demand" || rDef.key === "export_share") && Boolean(mRec?.exports_confidential);
            html += `<td class="num col-month" ${ratioStyle}>${fmtVal(val, unit, rDef.isRatio, rDef.isExtraction, isEst, isConf)}</td>`;
          }
        }
        const aSec = aRec ? aRec[sectionKey] : null;
        const aVal = aSec ? aSec[rDef.key] : null;
        html += `<td class="num col-annual ${aRec?.is_ytd ? 'cell-ytd' : ''}" ${ratioStyle}>${fmtVal(aVal, unit, rDef.isRatio, rDef.isExtraction)}</td>`;
      }
      html += `</tr>`;
    }

    // 2. MoM % / YoY % Row (shown when metricMode is "pct" or "both")
    if (metricMode === "pct" || metricMode === "both") {
      const pctRowLabel = metricMode === "both" ? `  ↳ % Change (MoM / YoY)` : `${rDef.label} (% Chg)`;
      const pctRowCls = metricMode === "both" ? "row-sub-indent" : rCls;
      html += `<tr class="${pctRowCls}"><td class="sticky-col col-attr" style="font-size:10.5px;color:#64748b;" title="${cleanAttrTitle} — Percentage Change (MoM / YoY)">${pctRowLabel}</td>`;
      for (const yr of years) {
        const isExp = STATE.sndExpandedYears.has(yr);
        const aRec = annMap[String(yr)];
        const prevARec = annMap[String(yr - 1)];

        if (isExp) {
          const mList = getYearMonthsList(yr, basis).filter(item => monthly[item.period] !== undefined);
          for (const item of mList) {
            const currVal = monthly[item.period]?.[sectionKey]?.[rDef.key];
            const prevP = getPreviousPeriod(item.period);
            const prevVal = monthly[prevP]?.[sectionKey]?.[rDef.key];
            const mom = (currVal != null && prevVal != null && prevVal !== 0)
              ? ((currVal - prevVal) / Math.abs(prevVal)) * 100.0
              : null;
            html += `<td class="num col-month">${fmtPctCell(mom, 1)}</td>`;
          }
        }
        // For YTD 2026, compare against same months of 2025 so YoY % is apples-to-apples!
        let yoy = null;
        if (aRec && prevARec) {
          if (aRec.is_ytd && !rDef.isStock && !rDef.isRatio) {
            const currMonths = getYearMonthsList(yr, basis).filter(item => monthly[item.period] !== undefined);
            const prevSameMonths = getYearMonthsList(yr - 1, basis).slice(0, currMonths.length);
            const cSum = currMonths.reduce((s, it) => s + (monthly[it.period]?.[sectionKey]?.[rDef.key] || 0), 0);
            const pSum = prevSameMonths.reduce((s, it) => s + (monthly[it.period]?.[sectionKey]?.[rDef.key] || 0), 0);
            yoy = pSum !== 0 ? ((cSum - pSum) / Math.abs(pSum)) * 100.0 : null;
          } else {
            const cVal = aRec[sectionKey]?.[rDef.key];
            const pVal = prevARec[sectionKey]?.[rDef.key];
            yoy = (cVal != null && pVal != null && pVal !== 0) ? ((cVal - pVal) / Math.abs(pVal)) * 100.0 : null;
          }
        }
        html += `<td class="num col-annual ${aRec?.is_ytd ? 'cell-ytd' : ''}">${fmtPctCell(yoy, 1)}</td>`;
      }
      html += `</tr>`;
    }
  }

  html += `</tbody></table>`;
  return html;
}

function renderStackedSndTables() {
  const soyCont = document.getElementById("snd-soy-table-container");
  const sbmCont = document.getElementById("snd-sbm-table-container");
  const sboCont = document.getElementById("snd-sbo-table-container");
  const bioCont = document.getElementById("snd-bio-table-container");
  const cornCont = document.getElementById("snd-corn-table-container");
  const prevScroll = soyCont ? soyCont.scrollLeft : 0;

  const years = getSortedSelectedYears();
  const basis = STATE.sndYearBasis;
  const unit = STATE.sndUnit;
  const metric = STATE.sndMetricMode;

  soyCont.innerHTML = buildSingleSndTableHtml("soybeans", SOYBEANS_ROWS, years, basis, unit, metric);
  sbmCont.innerHTML = buildSingleSndTableHtml("sbm", SBM_ROWS, years, basis, unit, metric);
  sboCont.innerHTML = buildSingleSndTableHtml("sbo", SBO_ROWS, years, basis, unit, metric);
  if (bioCont) {
    bioCont.innerHTML = buildSingleSndTableHtml("biodiesel", BIODIESEL_ROWS, years, basis, unit, metric);
  }
  if (cornCont) {
    cornCont.innerHTML = buildSingleSndTableHtml("corn", CORN_ROWS, years, basis, unit, metric);
  }

  // Bind expand/collapse click listeners across ALL 5 stacked tables simultaneously
  document.querySelectorAll("#snd-stacked-tables-wrapper .col-year-header").forEach(th => {
    th.addEventListener("click", () => {
      const yr = Number(th.dataset.year);
      if (STATE.sndExpandedYears.has(yr)) STATE.sndExpandedYears.delete(yr);
      else STATE.sndExpandedYears.add(yr);
      renderStackedSndTables();
    });
  });

  // Synchronize horizontal scrolling across Soybeans, SBM, and SBO tables
  const scrollEls = Array.from(document.querySelectorAll(".sync-scroll-snd"));
  scrollEls.forEach(el => { el.scrollLeft = prevScroll; });

  let isSyncing = false;
  scrollEls.forEach(sourceEl => {
    sourceEl.onscroll = () => {
      if (!isSyncing) {
        isSyncing = true;
        const left = sourceEl.scrollLeft;
        scrollEls.forEach(targetEl => {
          if (targetEl !== sourceEl) targetEl.scrollLeft = left;
        });
        requestAnimationFrame(() => { isSyncing = false; });
      }
    };
  });
}

// ===========================================================================
// MONTHLY MATRIX (BY YEAR) VIEW FOR SOYBEANS, SBM, AND SBO
// ===========================================================================
function buildMatrixHtmlForSection(sectionKey, matrixRows, heatKey1, heatKey2) {
  const years = getSortedSelectedYears();
  const basis = STATE.sndYearBasis;
  const unit = STATE.sndUnit;
  const monthly = STATE.master.monthly;
  const annMap = basis === "my" ? STATE.master.annual_my : STATE.master.annual_cy;

  const getHeatmapStyle = (val, minVal, maxVal) => {
    if (val == null || minVal == null || maxVal == null || minVal === maxVal) return "";
    const t = Math.max(0, Math.min(1, (val - minVal) / (maxVal - minVal)));
    if (t < 0.5) {
      const k = t / 0.5;
      const r = Math.round(252 + (254 - 252) * k);
      const g = Math.round(165 + (240 - 165) * k);
      const b = Math.round(165 + (138 - 165) * k);
      return `style="background-color: rgba(${r}, ${g}, ${b}, 0.72); color: #0f172a; font-weight: 500;"`;
    } else {
      const k = (t - 0.5) / 0.5;
      const r = Math.round(254 + (134 - 254) * k);
      const g = Math.round(240 + (239 - 240) * k);
      const b = Math.round(138 + (172 - 138) * k);
      return `style="background-color: rgba(${r}, ${g}, ${b}, 0.72); color: #0f172a; font-weight: 500;"`;
    }
  };

  let html = `<table class="snd-matrix-table"><tbody>`;

  years.forEach(yr => {
    const aRec = annMap[String(yr)]?.[sectionKey] || {};
    const mItems = getYearMonthsList(yr, basis);
    const mRecs = mItems.map(it => monthly[it.period]?.[sectionKey] || null);

    const v1 = mRecs.map(r => r?.[heatKey1]).filter(v => v != null);
    const min1 = v1.length ? Math.min(...v1) : null;
    const max1 = v1.length ? Math.max(...v1) : null;

    const v2 = mRecs.map(r => r?.[heatKey2]).filter(v => v != null);
    const min2 = v2.length ? Math.min(...v2) : null;
    const max2 = v2.length ? Math.max(...v2) : null;

    // 1. Month Header Row
    const yrTitle = basis === "my" ? `MY ${yr}/${String(yr + 1).slice(2)}` : `CY ${yr}`;
    html += `<tr class="matrix-row-month"><td class="matrix-col-metric"><strong>${yrTitle}</strong></td>`;
    mItems.forEach(it => {
      html += `<td class="matrix-col-month"><strong>${it.label}</strong></td>`;
    });
    html += `<td class="matrix-col-total"><strong>Total / End</strong></td></tr>`;

    // 2. Metric Rows
    matrixRows.forEach((rDef, idx) => {
      const isLast = idx === matrixRows.length - 1;
      const trCls = `${rDef.isRatio ? "matrix-row-su" : ""} ${isLast ? "matrix-block-end" : ""}`.trim();
      const cleanTitle = rDef.label.replace(/^↳\s*/, "").replace(/^•\s*/, "");
      html += `<tr class="${trCls}"><td class="matrix-col-metric" title="${cleanTitle}">${rDef.label}</td>`;
      for (let m = 0; m < 12; m++) {
        const val = mRecs[m]?.[rDef.key];
        const fullRec = monthly[mItems[m]?.period];
        const isEst = Array.isArray(fullRec?.estimated_fields) && fullRec.estimated_fields.includes(`${sectionKey}.${rDef.key}`);
        let style = "";
        if (rDef.key === heatKey1) style = getHeatmapStyle(val, min1, max1);
        else if (rDef.key === heatKey2) style = getHeatmapStyle(val, min2, max2);
        html += `<td class="matrix-col-month" ${style}>${fmtVal(val, unit, rDef.isRatio, rDef.isExtraction, isEst)}</td>`;
      }
      const aVal = aRec[rDef.key];
      html += `<td class="matrix-col-total">${fmtVal(aVal, unit, rDef.isRatio, rDef.isExtraction)}</td></tr>`;
    });
  });

  html += `</tbody></table>`;
  return html;
}

function renderSndMatrixAll() {
  document.getElementById("snd-matrix-soy-container").innerHTML = buildMatrixHtmlForSection(
    "soybeans",
    [
      { key: "beginning_stocks", label: "Beginning Stocks (Off-Farm)" },
      { key: "delivered_to_storage", label: "Delivered to Storage" },
      { key: "imports", label: "↳ Imports" },
      { key: "total_demand", label: "Total Demand" },
      { key: "crushed", label: "↳ Soybeans Crushed" },
      { key: "exports", label: "↳ Soybeans Exports" },
      { key: "ending_stocks", label: "Ending Stocks (Off-Farm)" },
      { key: "stocks_to_use", label: "SU Ratio (%)", isRatio: true }
    ],
    "crushed",
    "exports"
  );

  document.getElementById("snd-matrix-sbm-container").innerHTML = buildMatrixHtmlForSection(
    "sbm",
    [
      { key: "beginning_stocks", label: "Beginning Stocks (Crushers)" },
      { key: "production", label: "SBM Production" },
      { key: "extraction_ratio", label: "Extraction Ratio (%)", isRatio: true, isExtraction: true },
      { key: "imports", label: "Imports" },
      { key: "domestic_use", label: "Domestic Use" },
      { key: "exports", label: "SBM Exports" },
      { key: "ending_stocks", label: "Ending Stocks (Crushers)" },
      { key: "stocks_to_use", label: "SU Ratio (%)", isRatio: true }
    ],
    "production",
    "exports"
  );

  document.getElementById("snd-matrix-sbo-container").innerHTML = buildMatrixHtmlForSection(
    "sbo",
    [
      { key: "beginning_stocks", label: "Beginning Stocks (Crushers)" },
      { key: "production", label: "SBO Production" },
      { key: "extraction_ratio", label: "Extraction Ratio (%)", isRatio: true, isExtraction: true },
      { key: "domestic_use", label: "Domestic Use (Total)" },
      { key: "biofuel_use", label: "↳ Biofuel Use" },
      { key: "non_biofuel_use", label: "↳ Non-Biofuel Use" },
      { key: "exports", label: "SBO Exports" },
      { key: "ending_stocks", label: "Ending Stocks (Crushers)" },
      { key: "stocks_to_use", label: "SU Ratio (%)", isRatio: true }
    ],
    "production",
    "exports"
  );

  const bioMatEl = document.getElementById("snd-matrix-bio-container");
  if (bioMatEl) {
    bioMatEl.innerHTML = buildMatrixHtmlForSection(
      "biodiesel",
      [
        { key: "production", label: "Biodiesel Production" },
        { key: "sbo_feedstock_used", label: "↳ SBO Feedstock Used" },
        { key: "sbo_share_of_domestic", label: "↳ Share of SBO Dom Use (%)", isRatio: true },
        { key: "total_demand", label: "Total Disappearance" },
        { key: "domestic_sales", label: "↳ Domestic Blending Sales" },
        { key: "exports", label: "↳ Biodiesel Exports" },
        { key: "export_share", label: "Export Share of Prod (%)", isRatio: true }
      ],
      "production",
      "domestic_sales"
    );
  }

  const cornMatEl = document.getElementById("snd-matrix-corn-container");
  if (cornMatEl) {
    cornMatEl.innerHTML = buildMatrixHtmlForSection(
      "corn",
      [
        { key: "beginning_stocks", label: "Beginning Stocks (Off-Farm)" },
        { key: "delivered_to_storage", label: "Delivered to Storage" },
        { key: "total_demand", label: "Total Corn Demand" },
        { key: "exports", label: "↳ Corn Exports" },
        { key: "total_milling", label: "↳ Total Domestic Milling" },
        { key: "feed_milling", label: "• Compound Feed (Balanceado)" },
        { key: "wet_milling", label: "• Wet Milling (Mol. Húmeda)" },
        { key: "dry_milling", label: "• Dry Milling (Mol. Seca)" },
        { key: "ending_stocks", label: "Ending Stocks (Off-Farm)" },
        { key: "stocks_to_use", label: "SU Ratio (%)", isRatio: true },
        { key: "bioethanol_corn_tonnes", label: "Corn Bioethanol Prod (t)" },
        { key: "bioethanol_corn_feedstock_tonnes", label: "↳ Corn Feedstock Used (t)" }
      ],
      "exports",
      "total_milling"
    );
  }
}

// ===========================================================================
// TAB 1: 6 INSTITUTIONAL S&D CHARTS (SOYBEANS, CRUSHING, SBM, SBO, BIODIESEL, CORN)
// ===========================================================================
function renderSndCharts() {
  destroyChart("sndSoy");
  destroyChart("sndCrush");
  destroyChart("sndSbm");
  destroyChart("sndSbo");
  destroyChart("sndBio");
  destroyChart("sndCorn");

  const years = getSortedSelectedYears();
  const basis = STATE.sndYearBasis;
  const unit = STATE.sndUnit;
  const freq = STATE.sndChartFreq;
  const uLabel = unit === "mnt" ? "Million Tonnes (mn t)" : "Tonnes (t)";
  const monthly = STATE.master.monthly;
  const annMap = basis === "my" ? STATE.master.annual_my : STATE.master.annual_cy;

  const labels = [];
  const recs = [];

  if (freq === "monthly") {
    for (const yr of years) {
      const mList = getYearMonthsList(yr, basis);
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
      const lbl = basis === "my" ? r.my_label : r.ytd_label;
      labels.push(lbl);
      recs.push(r);
    }
  }

  // -------------------------------------------------------------------------
  // CHART 1: Soybeans — Crush, Exports, Ending Stocks & STU (%)
  // -------------------------------------------------------------------------
  const ctxSoy = document.getElementById("chart-snd-soy").getContext("2d");
  STATE.charts.sndSoy = new Chart(ctxSoy, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          type: "bar",
          label: "Soybeans Crushed",
          data: recs.map(r => scaleVal(r.soybeans.crushed, unit)),
          backgroundColor: "rgba(5, 150, 105, 0.78)",
          stack: "dem",
          yAxisID: "y",
          order: 3
        },
        {
          type: "bar",
          label: "Soybeans Exported",
          data: recs.map(r => scaleVal(r.soybeans.exports, unit)),
          backgroundColor: "rgba(217, 119, 6, 0.82)",
          stack: "dem",
          yAxisID: "y",
          order: 3
        },
        {
          type: "line",
          label: "Off-Farm Ending Stocks",
          data: recs.map(r => scaleVal(r.soybeans.ending_stocks, unit)),
          borderColor: "#0f172a",
          backgroundColor: "rgba(15, 23, 42, 0.08)",
          borderWidth: 2.3,
          pointRadius: freq === "monthly" ? 1.8 : 3.5,
          tension: 0.25,
          yAxisID: "y",
          order: 1
        },
        {
          type: "line",
          label: "Stocks-to-Use Ratio (%) [RHS]",
          data: recs.map(r => r.soybeans.stocks_to_use != null ? Number(r.soybeans.stocks_to_use.toFixed(1)) : null),
          borderColor: "#2563eb",
          borderWidth: 2,
          borderDash: [4, 3],
          pointRadius: freq === "monthly" ? 1.5 : 3,
          tension: 0.25,
          yAxisID: "y1",
          order: 0
        }
      ]
    },
    options: {
      ...chartOptionsCommon(uLabel, unit),
      scales: {
        x: { stacked: true, ticks: { color: "#64748b", maxRotation: 45 }, grid: { color: "rgba(100,116,139,0.08)" } },
        y: {
          stacked: true,
          position: "left",
          title: { display: true, text: uLabel, color: "#0f172a", font: { weight: "bold" } },
          ticks: {
            color: "#334155",
            callback: v => unit === "mnt" ? Number(v).toFixed(1) : Number(v).toLocaleString("en-US")
          },
          grid: { color: "rgba(100,116,139,0.08)" }
        },
        y1: {
          position: "right",
          title: { display: true, text: "Stocks-to-Use (%)", color: "#2563eb", font: { weight: "bold" } },
          ticks: { color: "#2563eb", callback: v => v + "%" },
          grid: { drawOnChartArea: false }
        }
      }
    }
  });

  // -------------------------------------------------------------------------
  // CHART 2: Crushing Sub-Ledger & Extraction Ratios (SBM % & SBO %)
  // -------------------------------------------------------------------------
  const ctxCrush = document.getElementById("chart-snd-crush").getContext("2d");
  STATE.charts.sndCrush = new Chart(ctxCrush, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          type: "bar",
          label: "Delivered to Crushers",
          data: recs.map(r => scaleVal(r.soybeans.delivered_to_crushers, unit)),
          backgroundColor: "rgba(16, 185, 129, 0.55)",
          yAxisID: "y",
          order: 3
        },
        {
          type: "line",
          label: "Ending Stocks (Crushers)",
          data: recs.map(r => scaleVal(r.soybeans.crushers_ending_stocks, unit)),
          borderColor: "#047857",
          borderWidth: 2.3,
          pointRadius: freq === "monthly" ? 1.8 : 3.5,
          tension: 0.25,
          yAxisID: "y",
          order: 2
        },
        {
          type: "line",
          label: "SBM Extraction Ratio (%) [RHS]",
          data: recs.map(r => r.sbm.extraction_ratio != null ? Number(r.sbm.extraction_ratio.toFixed(2)) : null),
          borderColor: "#d97706",
          borderWidth: 2.2,
          pointRadius: freq === "monthly" ? 1.5 : 3,
          tension: 0.25,
          yAxisID: "y1",
          order: 1
        },
        {
          type: "line",
          label: "SBO Extraction Ratio (%) [RHS]",
          data: recs.map(r => r.sbo.extraction_ratio != null ? Number(r.sbo.extraction_ratio.toFixed(2)) : null),
          borderColor: "#2563eb",
          borderWidth: 2.2,
          borderDash: [4, 3],
          pointRadius: freq === "monthly" ? 1.5 : 3,
          tension: 0.25,
          yAxisID: "y1",
          order: 0
        }
      ]
    },
    options: {
      ...chartOptionsCommon(uLabel, unit),
      scales: {
        x: { ticks: { color: "#64748b", maxRotation: 45 }, grid: { color: "rgba(100,116,139,0.08)" } },
        y: {
          position: "left",
          title: { display: true, text: uLabel, color: "#047857", font: { weight: "bold" } },
          ticks: {
            color: "#047857",
            callback: v => unit === "mnt" ? Number(v).toFixed(1) : Number(v).toLocaleString("en-US")
          },
          grid: { color: "rgba(100,116,139,0.08)" }
        },
        y1: {
          position: "right",
          title: { display: true, text: "Extraction Ratio (%)", color: "#d97706", font: { weight: "bold" } },
          ticks: { color: "#d97706", callback: v => v + "%" },
          grid: { drawOnChartArea: false }
        }
      }
    }
  });

  // -------------------------------------------------------------------------
  // CHART 3: Soybean Meal (SBM) — Production, Exports, Domestic Use & STU (%)
  // -------------------------------------------------------------------------
  const ctxSbm = document.getElementById("chart-snd-sbm").getContext("2d");
  STATE.charts.sndSbm = new Chart(ctxSbm, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          type: "bar",
          label: "SBM Exports",
          data: recs.map(r => scaleVal(r.sbm.exports, unit)),
          backgroundColor: "rgba(217, 119, 6, 0.78)",
          stack: "sbm_use",
          yAxisID: "y",
          order: 3
        },
        {
          type: "bar",
          label: "SBM Domestic Use",
          data: recs.map(r => scaleVal(r.sbm.domestic_use, unit)),
          backgroundColor: "rgba(147, 51, 234, 0.75)",
          stack: "sbm_use",
          yAxisID: "y",
          order: 3
        },
        {
          type: "line",
          label: "SBM Production",
          data: recs.map(r => scaleVal(r.sbm.production, unit)),
          borderColor: "#0f172a",
          borderWidth: 2.3,
          pointRadius: freq === "monthly" ? 1.8 : 3.5,
          tension: 0.25,
          yAxisID: "y",
          order: 1
        },
        {
          type: "line",
          label: "SBM Stocks-to-Use (%) [RHS]",
          data: recs.map(r => r.sbm.stocks_to_use != null ? Number(r.sbm.stocks_to_use.toFixed(1)) : null),
          borderColor: "#059669",
          borderWidth: 2,
          borderDash: [4, 3],
          pointRadius: freq === "monthly" ? 1.5 : 3,
          tension: 0.25,
          yAxisID: "y1",
          order: 0
        }
      ]
    },
    options: {
      ...chartOptionsCommon(uLabel, unit),
      scales: {
        x: { stacked: true, ticks: { color: "#64748b", maxRotation: 45 }, grid: { color: "rgba(100,116,139,0.08)" } },
        y: {
          stacked: true,
          position: "left",
          title: { display: true, text: uLabel, color: "#92400e", font: { weight: "bold" } },
          ticks: {
            color: "#334155",
            callback: v => unit === "mnt" ? Number(v).toFixed(2) : Number(v).toLocaleString("en-US")
          },
          grid: { color: "rgba(100,116,139,0.08)" }
        },
        y1: {
          position: "right",
          title: { display: true, text: "SBM STU (%)", color: "#059669", font: { weight: "bold" } },
          ticks: { color: "#059669", callback: v => v + "%" },
          grid: { drawOnChartArea: false }
        }
      }
    }
  });

  // -------------------------------------------------------------------------
  // CHART 4: Soybean Oil (SBO) — Exports, Biofuel vs Non-Biofuel, Prod & STU (%)
  // -------------------------------------------------------------------------
  const ctxSbo = document.getElementById("chart-snd-sbo").getContext("2d");
  STATE.charts.sndSbo = new Chart(ctxSbo, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          type: "bar",
          label: "SBO Exports",
          data: recs.map(r => scaleVal(r.sbo.exports, unit)),
          backgroundColor: "rgba(37, 99, 235, 0.78)",
          stack: "sbo_use",
          yAxisID: "y",
          order: 3
        },
        {
          type: "bar",
          label: "SBO Biofuel Use (Biodiesel)",
          data: recs.map(r => scaleVal(r.sbo.biofuel_use, unit)),
          backgroundColor: "rgba(5, 150, 105, 0.82)",
          stack: "sbo_use",
          yAxisID: "y",
          order: 3
        },
        {
          type: "bar",
          label: "SBO Non-Biofuel Domestic Use",
          data: recs.map(r => scaleVal(r.sbo.non_biofuel_use, unit)),
          backgroundColor: "rgba(245, 158, 11, 0.82)",
          stack: "sbo_use",
          yAxisID: "y",
          order: 3
        },
        {
          type: "line",
          label: "SBO Production",
          data: recs.map(r => scaleVal(r.sbo.production, unit)),
          borderColor: "#0f172a",
          borderWidth: 2.3,
          pointRadius: freq === "monthly" ? 1.8 : 3.5,
          tension: 0.25,
          yAxisID: "y",
          order: 1
        },
        {
          type: "line",
          label: "SBO Stocks-to-Use (%) [RHS]",
          data: recs.map(r => r.sbo.stocks_to_use != null ? Number(r.sbo.stocks_to_use.toFixed(1)) : null),
          borderColor: "#dc2626",
          borderWidth: 2,
          borderDash: [4, 3],
          pointRadius: freq === "monthly" ? 1.5 : 3,
          tension: 0.25,
          yAxisID: "y1",
          order: 0
        }
      ]
    },
    options: {
      ...chartOptionsCommon(uLabel, unit),
      scales: {
        x: { stacked: true, ticks: { color: "#64748b", maxRotation: 45 }, grid: { color: "rgba(100,116,139,0.08)" } },
        y: {
          stacked: true,
          position: "left",
          title: { display: true, text: uLabel, color: "#1e40af", font: { weight: "bold" } },
          ticks: {
            color: "#334155",
            callback: v => unit === "mnt" ? Number(v).toFixed(2) : Number(v).toLocaleString("en-US")
          },
          grid: { color: "rgba(100,116,139,0.08)" }
        },
        y1: {
          position: "right",
          title: { display: true, text: "SBO STU (%)", color: "#dc2626", font: { weight: "bold" } },
          ticks: { color: "#dc2626", callback: v => v + "%" },
          grid: { drawOnChartArea: false }
        }
      }
    }
  });

  // -------------------------------------------------------------------------
  // CHART 5: Biodiesel — Production, Domestic Blending Sales, Exports & SBO Share (%)
  // -------------------------------------------------------------------------
  const bioCanvas = document.getElementById("chart-snd-bio");
  if (bioCanvas) {
    const ctxBio = bioCanvas.getContext("2d");
    STATE.charts.sndBio = new Chart(ctxBio, {
      type: "bar",
      data: {
        labels,
        datasets: [
          {
            type: "bar",
            label: "Domestic Blending Sales (Corte)",
            data: recs.map(r => scaleVal(r.biodiesel?.domestic_sales, unit)),
            backgroundColor: "rgba(15, 118, 110, 0.82)",
            stack: "bio_use",
            yAxisID: "y",
            order: 3
          },
          {
            type: "bar",
            label: "Biodiesel Exports",
            data: recs.map(r => scaleVal(r.biodiesel?.exports, unit)),
            backgroundColor: "rgba(217, 119, 6, 0.82)",
            stack: "bio_use",
            yAxisID: "y",
            order: 3
          },
          {
            type: "line",
            label: "Biodiesel Production",
            data: recs.map(r => scaleVal(r.biodiesel?.production, unit)),
            borderColor: "#0f172a",
            borderWidth: 2.3,
            pointRadius: freq === "monthly" ? 1.8 : 3.5,
            tension: 0.25,
            yAxisID: "y",
            order: 1
          },
          {
            type: "line",
            label: "Share of SBO Domestic Use (%) [RHS]",
            data: recs.map(r => r.biodiesel?.sbo_share_of_domestic != null ? Number(r.biodiesel.sbo_share_of_domestic.toFixed(1)) : null),
            borderColor: "#0284c7",
            borderWidth: 2,
            borderDash: [4, 3],
            pointRadius: freq === "monthly" ? 1.5 : 3,
            tension: 0.25,
            yAxisID: "y1",
            order: 0
          }
        ]
      },
      options: {
        ...chartOptionsCommon(uLabel, unit),
        scales: {
          x: { stacked: true, ticks: { color: "#64748b", maxRotation: 45 }, grid: { color: "rgba(100,116,139,0.08)" } },
          y: {
            stacked: true,
            position: "left",
            title: { display: true, text: uLabel, color: "#0f766e", font: { weight: "bold" } },
            ticks: {
              color: "#334155",
              callback: v => unit === "mnt" ? Number(v).toFixed(2) : Number(v).toLocaleString("en-US")
            },
            grid: { color: "rgba(100,116,139,0.08)" }
          },
          y1: {
            position: "right",
            title: { display: true, text: "SBO Biofuel Share (%)", color: "#0284c7", font: { weight: "bold" } },
            ticks: { color: "#0284c7", callback: v => v + "%" },
            grid: { drawOnChartArea: false }
          }
        }
      }
    });
  }

  // -------------------------------------------------------------------------
  // CHART 6: Corn (Maíz) — Exports, Domestic Milling, Ending Stocks & STU (%)
  // -------------------------------------------------------------------------
  const cornCanvas = document.getElementById("chart-snd-corn");
  if (cornCanvas) {
    const ctxCorn = cornCanvas.getContext("2d");
    STATE.charts.sndCorn = new Chart(ctxCorn, {
      type: "bar",
      data: {
        labels,
        datasets: [
          {
            type: "bar",
            label: "Corn Exports",
            data: recs.map(r => scaleVal(r.corn?.exports, unit)),
            backgroundColor: "rgba(202, 138, 4, 0.82)",
            stack: "corn_use",
            yAxisID: "y",
            order: 3
          },
          {
            type: "bar",
            label: "Domestic Corn Milling (Feed + Wet + Dry)",
            data: recs.map(r => scaleVal(r.corn?.total_milling, unit)),
            backgroundColor: "rgba(5, 150, 105, 0.78)",
            stack: "corn_use",
            yAxisID: "y",
            order: 3
          },
          {
            type: "line",
            label: "Off-Farm Ending Stocks",
            data: recs.map(r => scaleVal(r.corn?.ending_stocks, unit)),
            borderColor: "#0f172a",
            borderWidth: 2.3,
            pointRadius: freq === "monthly" ? 1.8 : 3.5,
            tension: 0.25,
            yAxisID: "y",
            order: 1
          },
          {
            type: "line",
            label: "Corn Stocks-to-Use (%) [RHS]",
            data: recs.map(r => r.corn?.stocks_to_use != null ? Number(r.corn.stocks_to_use.toFixed(1)) : null),
            borderColor: "#dc2626",
            borderWidth: 2,
            borderDash: [4, 3],
            pointRadius: freq === "monthly" ? 1.5 : 3,
            tension: 0.25,
            yAxisID: "y1",
            order: 0
          }
        ]
      },
      options: {
        ...chartOptionsCommon(uLabel, unit),
        scales: {
          x: { stacked: true, ticks: { color: "#64748b", maxRotation: 45 }, grid: { color: "rgba(100,116,139,0.08)" } },
          y: {
            stacked: true,
            position: "left",
            title: { display: true, text: uLabel, color: "#a16207", font: { weight: "bold" } },
            ticks: {
              color: "#334155",
              callback: v => unit === "mnt" ? Number(v).toFixed(1) : Number(v).toLocaleString("en-US")
            },
            grid: { color: "rgba(100,116,139,0.08)" }
          },
          y1: {
            position: "right",
            title: { display: true, text: "Corn STU (%)", color: "#dc2626", font: { weight: "bold" } },
            ticks: { color: "#dc2626", callback: v => v + "%" },
            grid: { drawOnChartArea: false }
          }
        }
      }
    });
  }
}

// ===========================================================================
// TAB 7: SEASONALITY (CHART & HEATMAP TABLE)
// ===========================================================================
function isStockOrRatioAttr(attrPath) {
  return attrPath.includes("stocks") || attrPath.includes("ratio") || attrPath.includes("share");
}

function getSeasonYearSeries(yr, attrPath, axis = "cy", calcMode = "monthly", unit = "t") {
  const [sec, field] = attrPath.split(".");
  const isRatio = field.includes("stocks_to_use") || field.includes("extraction_ratio") || field.includes("share");
  const isStock = field.includes("stocks") && !isRatio;
  const mOrder = axis === "my" ? MY_MONTH_ORDER : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

  const rawVals = mOrder.map(m => {
    const actualYr = (axis === "my" && m <= 3) ? yr + 1 : yr;
    const p = `${actualYr}-${String(m).padStart(2, "0")}`;
    const v = STATE.master.monthly[p]?.[sec]?.[field];
    return v !== undefined && v !== null ? Number(v) : null;
  });

  // If cumulative mode is selected AND attribute is a flow (not a stock or ratio), compute running sum
  const useCum = calcMode === "cum" && !isRatio && !isStock;
  let running = 0;
  return rawVals.map(v => {
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
  const attrPath = STATE.seasonAttr;
  const axis = STATE.seasonAxis;
  const calcMode = STATE.seasonCalc;
  const unit = STATE.seasonUnit;

  const isRatio = attrPath.includes("stocks_to_use") || attrPath.includes("extraction_ratio") || attrPath.includes("share");
  const isExtraction = attrPath.includes("extraction_ratio");
  const isStock = attrPath.includes("stocks") && !isRatio;
  const effectiveCum = calcMode === "cum" && !isRatio && !isStock;

  const xLabels = axis === "my" ? MY_MONTH_LABELS : MONTH_SHORT;
  const uText = isRatio ? "%" : unit === "mnt" ? "Million Tonnes (mn t)" : "Tonnes (t)";
  const modeLabel = effectiveCum
    ? (axis === "my" ? "Cumulative MYTD (Apr–Mar)" : "Cumulative YTD (Jan–Dec)")
    : (axis === "my" ? "Monthly Seasonality (MY Apr–Mar)" : "Monthly Seasonality (CY Jan–Dec)");

  document.getElementById("season-chart-title").textContent = `${attrLabel} — ${modeLabel}`;
  document.getElementById("season-chart-sub").textContent =
    `Units: ${uText} • Min–Max Historical Band • 5Y Benchmark Average (2021–2025) • Selected Years`;
  document.getElementById("season-table-title").textContent =
    `Seasonality Matrix & Heatmap: ${attrLabel} (${modeLabel} • ${uText})`;

  const years = getSortedSelectedYears();
  if (!years.some(y => STATE.seasonActiveYears.has(y))) {
    years.forEach(y => STATE.seasonActiveYears.add(y));
  }

  // Compute 5Y (2021-2025) and 10Y (2016-2025) monthly averages & Min-Max across selected range
  const avg5Y = [];
  const avg10Y = [];
  const minBand = [];
  const maxBand = [];

  const seriesByYear = {};
  ALL_YEARS.forEach(y => {
    seriesByYear[y] = getSeasonYearSeries(y, attrPath, axis, calcMode, unit);
  });

  const maxCompleteBenchYr = ALL_YEARS[ALL_YEARS.length - 1] - 1;
  for (let idx = 0; idx < 12; idx++) {
    const v5 = [], v10 = [], vRange = [];
    for (let y = maxCompleteBenchYr - 9; y <= maxCompleteBenchYr; y++) {
      if (!seriesByYear[y]) continue;
      const v = seriesByYear[y][idx];
      if (v !== null && !Number.isNaN(v)) {
        v10.push(v);
        if (y >= maxCompleteBenchYr - 4) v5.push(v);
      }
    }
    for (const y of years) {
      const v = seriesByYear[y][idx];
      if (v !== null && !Number.isNaN(v)) vRange.push(v);
    }
    avg5Y.push(v5.length ? v5.reduce((a, b) => a + b, 0) / v5.length : null);
    avg10Y.push(v10.length ? v10.reduce((a, b) => a + b, 0) / v10.length : null);
    minBand.push(vRange.length ? Math.min(...vRange) : null);
    maxBand.push(vRange.length ? Math.max(...vRange) : null);
  }

  const rangeLabel = years.length === 1
    ? `Min–Max Range (${formatYearPillLabel(years[0])})`
    : `Min–Max Range (${formatYearPillLabel(years[0])}–${formatYearPillLabel(years[years.length - 1])})`;

  const datasets = [
    {
      label: "Historical Range (Min)",
      data: minBand,
      borderColor: "transparent",
      pointRadius: 0,
      fill: false,
      tension: 0.25
    },
    {
      label: rangeLabel,
      data: maxBand,
      borderColor: "transparent",
      backgroundColor: "rgba(148, 163, 184, 0.22)",
      pointRadius: 0,
      fill: "-1",
      tension: 0.25
    },
    {
      label: "5Y Average (2021–2025)",
      data: avg5Y,
      borderColor: "#64748b",
      borderWidth: 2.2,
      borderDash: [5, 4],
      pointRadius: 0,
      fill: false,
      tension: 0.25
    }
  ];

  renderSeasonYearPills(years);

  const palette = ["#9333ea", "#0d9488", "#e11d48", "#6366f1", "#ca8a04", "#0284c7", "#2563eb"];
  let colorIdx = 0;

  years.forEach(yr => {
    if (!STATE.seasonActiveYears.has(yr)) return;
    const mVals = seriesByYear[yr];
    if (mVals.every(v => v === null)) return;

    const isCurrent = yr === 2026;
    const isPrev = yr === 2025;
    let color = palette[colorIdx % palette.length];
    if (isPrev) color = "#2563eb";
    if (isCurrent) color = "#059669";
    colorIdx++;

    datasets.push({
      label: formatYearPillLabel(yr),
      data: mVals,
      borderColor: color,
      borderWidth: isCurrent ? 3.3 : isPrev ? 2.5 : 2.0,
      pointRadius: isCurrent ? 4.2 : 2.5,
      tension: 0.25,
      fill: false
    });
  });

  const ctx = document.getElementById("chart-seasonality").getContext("2d");
  const commonOpts = chartOptionsCommon(`${attrLabel} (${uText})`, unit, isRatio);
  STATE.charts.seasonality = new Chart(ctx, {
    type: "line",
    data: { labels: xLabels, datasets },
    options: {
      ...commonOpts,
      plugins: {
        ...commonOpts.plugins,
        legend: {
          ...commonOpts.plugins.legend,
          labels: {
            ...commonOpts.plugins.legend.labels,
            filter: (item) => item.text !== "Historical Range (Min)"
          }
        }
      }
    }
  });

  // Render Seasonality Heatmap Table
  const allVals = [];
  years.forEach(yr => {
    seriesByYear[yr].forEach(v => {
      if (v !== null && !Number.isNaN(v)) allVals.push(v);
    });
  });
  const minV = allVals.length ? Math.min(...allVals) : 0;
  const maxV = allVals.length ? Math.max(...allVals) : 1;

  function heatBg(val) {
    if (val === null || val === undefined || maxV <= minV) return "";
    const ratio = (val - minV) / (maxV - minV);
    return `background: rgba(16, 185, 129, ${(0.05 + ratio * 0.28).toFixed(2)});`;
  }

  function fmtSeasonCell(v) {
    if (v === null || v === undefined || Number.isNaN(Number(v))) {
      return '<span class="text-muted">--</span>';
    }
    if (isRatio) {
      return `${Number(v).toFixed(isExtraction ? 2 : 1)}%`;
    }
    if (unit === "mnt") {
      return Number(v).toLocaleString("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 });
    }
    return Math.round(Number(v)).toLocaleString("en-US");
  }

  function summarizeRow(arr) {
    const valid = arr.filter(x => x !== null && x !== undefined);
    if (!valid.length) return null;
    if (effectiveCum) return valid[valid.length - 1];
    if (isRatio || isStock) return valid.reduce((a, b) => a + b, 0) / valid.length;
    return valid.reduce((a, b) => a + b, 0);
  }

  const summaryHeader = effectiveCum
    ? "Cumulative End"
    : (isRatio || isStock) ? "Annual Average" : "Annual Total";

  let html = `<table class="data-table"><thead><tr>
    <th class="col-attr">Year / Benchmark</th>
    ${xLabels.map(m => `<th class="col-month">${m}</th>`).join("")}
    <th class="col-annual">${summaryHeader}</th>
  </tr></thead><tbody>`;

  [
    { name: "5Y Avg (2021–2025)", arr: avg5Y },
    { name: "10Y Avg (2016–2025)", arr: avg10Y }
  ].forEach(bRow => {
    const agg = summarizeRow(bRow.arr);
    html += `<tr class="row-subtotal"><td class="sticky-col col-attr">${bRow.name}</td>`;
    bRow.arr.forEach(v => {
      html += `<td class="num col-month">${fmtSeasonCell(v)}</td>`;
    });
    html += `<td class="num col-annual"><strong>${fmtSeasonCell(agg)}</strong></td></tr>`;
  });

  years.forEach(yr => {
    const rowVals = seriesByYear[yr];
    if (rowVals.every(v => v === null)) return;
    const agg = summarizeRow(rowVals);
    const isYtd = yr === 2026;
    const yrLabel = formatYearPillLabel(yr);
    html += `<tr><td class="sticky-col col-attr" title="${yrLabel}">${yrLabel}</td>`;
    rowVals.forEach(v => {
      html += `<td class="num col-month" style="${heatBg(v)}">${fmtSeasonCell(v)}</td>`;
    });
    html += `<td class="num col-annual ${isYtd ? 'cell-ytd' : ''}"><strong>${fmtSeasonCell(agg)}</strong></td></tr>`;
  });

  html += `</tbody></table>`;
  document.getElementById("seasonality-table-container").innerHTML = html;
}

function renderSeasonYearPills(years) {
  const container = document.getElementById("season-year-pills");
  if (!container) return;

  let html = "";
  years.forEach(y => {
    const isActive = STATE.seasonActiveYears.has(y);
    const isYtd = y === 2026;
    const cls = isActive ? (isYtd ? "season-pill active-ytd" : "season-pill active") : "season-pill";
    html += `<button class="${cls}" data-year="${y}">${formatYearPillLabel(y)}</button>`;
  });
  container.innerHTML = html;

  container.querySelectorAll(".season-pill").forEach(btn => {
    btn.addEventListener("click", () => {
      const yr = Number(btn.dataset.year);
      if (STATE.seasonActiveYears.has(yr)) {
        if (STATE.seasonActiveYears.size > 1) STATE.seasonActiveYears.delete(yr);
      } else {
        STATE.seasonActiveYears.add(yr);
      }
      renderSeasonalityTab();
    });
  });
}

// ===========================================================================
// EXPORT STACKED S&D TABLES TO CSV
// ===========================================================================
function exportSndCsv() {
  const years = getSortedSelectedYears();
  const basis = STATE.sndYearBasis;
  const monthly = STATE.master.monthly;
  const annMap = basis === "my" ? STATE.master.annual_my : STATE.master.annual_cy;

  const headers = ["Commodity_Section", "Attribute"];
  for (const yr of years) {
    if (STATE.sndExpandedYears.has(yr)) {
      const mList = getYearMonthsList(yr, basis).filter(it => monthly[it.period] !== undefined);
      mList.forEach(it => headers.push(it.label));
    }
    headers.push(formatYearPillLabel(yr));
  }

  const lines = [headers.join(",")];
  const sections = [
    { name: "1. Soybeans & Crushing", key: "soybeans", rows: SOYBEANS_ROWS },
    { name: "2. Soybean Meal (SBM)", key: "sbm", rows: SBM_ROWS },
    { name: "3. Soybean Oil (SBO)", key: "sbo", rows: SBO_ROWS },
    { name: "4. Biodiesel", key: "biodiesel", rows: BIODIESEL_ROWS },
    { name: "5. Corn (Maíz) & Bioethanol", key: "corn", rows: CORN_ROWS }
  ];

  sections.forEach(sec => {
    sec.rows.forEach(rDef => {
      if (rDef.isDivider) return;
      const row = [`"${sec.name}"`, `"${rDef.label}"`];
      for (const yr of years) {
        if (STATE.sndExpandedYears.has(yr)) {
          const mList = getYearMonthsList(yr, basis).filter(it => monthly[it.period] !== undefined);
          mList.forEach(it => {
            const v = monthly[it.period]?.[sec.key]?.[rDef.key];
            row.push(v != null ? v : "");
          });
        }
        const aVal = annMap[String(yr)]?.[sec.key]?.[rDef.key];
        row.push(aVal != null ? aVal : "");
      }
      lines.push(row.join(","));
    });
  });

  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Argentina_Soy_Complex_SND_${basis.toUpperCase()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

window.addEventListener("DOMContentLoaded", initDashboard);
