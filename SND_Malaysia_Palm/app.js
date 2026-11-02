/**
 * Malaysia Palm Oil Supply & Demand Institutional Dashboard (app.js)
 * Clean, modular, single-source-of-truth frontend controller.
 */

const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const ALL_YEARS = Array.from({ length: 2027 - 1975 + 1 }, (_, i) => 1975 + i);

const STATE = {
  master: null,
  userForecast: null,
  selectedYears: new Set([2023, 2024, 2025, 2026, 2027]), // Default: Last 5 years
  lastClickedYear: 2027,
  activeTab: "tab-snd",

  // Tab 1: S&D state
  sndFcstMode: "model",     // "model" | "user" | "delta"
  sndViewFormat: "table",   // "table" | "matrix"
  sndExpandedYears: new Set(),
  sndChartFreq: "monthly",
  sndCompareAttr: "production", // "production" | "export" | "import" | "local_disappearance" | "end_stock" | "stocks_to_use"

  // Tab 2: Area state
  areaViewMode: "regional", // "regional" | "states" | "category"
  areaEntities: new Set(["Malaysia"]),

  // Tab 3: Production state
  prodAttr: "cpo_production",
  prodState: "Malaysia",
  prodExpandedYears: new Set(),

  // Tab 4: My Forecast state
  myFcstStateMetric: "cpo_production",

  // Tab 5: Imports state
  impExpandedYears: new Set(),

  // Tab 6: Exports state
  expSplitMode: "both",     // "both" | "ports" | "products"
  expPortUnit: "tonnes",    // "tonnes" | "share"
  expExpandedYears: new Set(),

  // Tab 7: Stocks state
  stkExpandedYears: new Set(),

  // Tab 8: Seasonality state
  seasonAttr: "snd.production",
  seasonFcstMode: "model",
  seasonRegions: new Set(["Malaysia"]),
  seasonActiveYears: new Set([2025, 2026, 2027]),

  // Tab 8: Survey state
  surveyCat: "exports",      // "exports" | "production" | "poll"
  surveyWindow: "Full Month", // "Full Month" | "1-25" | "1-20" | "1-15" | "1-10" | "all"
  surveySource: "overview",   // "overview" | "its" | "amspec" | "sgs"
  surveyPollAttr: "Production",

  charts: {}
};

// ---------------------------------------------------------------------------
// Formatting Helpers
// ---------------------------------------------------------------------------
function fmtNum(val, decimals = 0) {
  if (val === null || val === undefined || Number.isNaN(Number(val))) return '<span class="text-muted">N/A</span>';
  const n = Number(val);
  return n.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
}

function fmtDelta(val, decimals = 0) {
  if (val === null || val === undefined || Number.isNaN(Number(val))) return '<span class="text-muted">--</span>';
  const n = Number(val);
  const sign = n > 0 ? "+" : "";
  const cls = n > 0 ? "cell-pos" : n < 0 ? "cell-neg" : "";
  return `<span class="${cls}">${sign}${n.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  })}</span>`;
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

function getSortedSelectedYears(minYear = 1975, maxYear = 2027) {
  const arr = Array.from(STATE.selectedYears)
    .filter(y => y >= minYear && y <= maxYear)
    .sort((a, b) => a - b);
  if (arr.length === 0) {
    // Fallback if user selected only pre-2004 years on a monthly-only tab
    return [2023, 2024, 2025, 2026, 2027].filter(y => y >= minYear && y <= maxYear);
  }
  return arr;
}

// ---------------------------------------------------------------------------
// Recompute User S&D (Opening Stock, End Stock, Annual Totals) Dynamically
// ---------------------------------------------------------------------------
function getEffectiveSndData(mode = "model") {
  const modelMonthly = STATE.master.snd.monthly;
  const modelAnnual = STATE.master.snd.annual;
  if (mode === "model") {
    return { monthly: modelMonthly, annual: modelAnnual };
  }

  // Build User Monthly S&D by cloning actuals (2005-01..2026-09) and chaining Oct 2026..Dec 2027
  const userMonthly = {};
  for (const [p, rec] of Object.entries(modelMonthly)) {
    if (!rec.is_forecast) {
      userMonthly[p] = { ...rec };
    }
  }

  let prevEndStock = userMonthly["2026-09"] ? userMonthly["2026-09"].end_stock : 3510897;
  const fcstPeriods = STATE.master.metadata.forecast_periods || [];
  const uSndStore = (STATE.userForecast && STATE.userForecast.snd) ? STATE.userForecast.snd : {};

  for (const p of fcstPeriods) {
    const [yrStr, mStr] = p.split("-");
    const yr = Number(yrStr);
    const m = Number(mStr);
    const mRec = modelMonthly[p] || {};
    const uRec = uSndStore[p] || {};

    const openStk = Math.round(prevEndStock);
    const prod = Math.round(uRec.production ?? mRec.production ?? 0);
    const imp = Math.round(uRec.import ?? mRec.import ?? 0);
    const exp = Math.round(uRec.export ?? mRec.export ?? 0);
    const ld = Math.round(uRec.local_disappearance ?? mRec.local_disappearance ?? 0);
    // Formula: End Stock = Opening Stock + Production + Import - Export - Local Disappearance
    const endStk = Math.round(openStk + prod + imp - exp - ld);
    prevEndStock = endStk;

    userMonthly[p] = {
      period: p,
      year: yr,
      month: m,
      opening_stock: openStk,
      production: prod,
      import: imp,
      export: exp,
      local_disappearance: ld,
      end_stock: endStk,
      is_forecast: true,
      is_user_forecast: true
    };
  }

  // Build User Annual S&D
  const userAnnual = {};
  for (const [yrKey, aRec] of Object.entries(modelAnnual)) {
    const yr = Number(yrKey);
    if (yr < 2026) {
      userAnnual[yr] = { ...aRec };
    } else {
      const mList = [];
      for (let m = 1; m <= 12; m++) {
        const p = `${yr}-${String(m).padStart(2, "0")}`;
        if (userMonthly[p]) mList.push(userMonthly[p]);
      }
      userAnnual[yr] = {
        year: yr,
        has_monthly: true,
        is_forecast: true,
        is_user_forecast: true,
        opening_stock: mList[0].opening_stock,
        production: mList.reduce((s, r) => s + r.production, 0),
        import: mList.reduce((s, r) => s + r.import, 0),
        export: mList.reduce((s, r) => s + r.export, 0),
        local_disappearance: mList.reduce((s, r) => s + r.local_disappearance, 0),
        end_stock: mList[mList.length - 1].end_stock
      };
    }
  }

  if (mode === "user") {
    return { monthly: userMonthly, annual: userAnnual };
  }

  // Delta mode: User - Model
  const deltaMonthly = {};
  for (const [p, mRec] of Object.entries(modelMonthly)) {
    const uRec = userMonthly[p] || mRec;
    deltaMonthly[p] = {
      period: p,
      year: mRec.year,
      month: mRec.month,
      is_forecast: mRec.is_forecast,
      opening_stock: uRec.opening_stock - mRec.opening_stock,
      production: uRec.production - mRec.production,
      import: uRec.import - mRec.import,
      export: uRec.export - mRec.export,
      local_disappearance: uRec.local_disappearance - mRec.local_disappearance,
      end_stock: uRec.end_stock - mRec.end_stock
    };
  }
  const deltaAnnual = {};
  for (const [yrKey, mAnn] of Object.entries(modelAnnual)) {
    const yr = Number(yrKey);
    const uAnn = userAnnual[yr] || mAnn;
    deltaAnnual[yr] = {
      year: yr,
      has_monthly: mAnn.has_monthly,
      is_forecast: mAnn.is_forecast,
      opening_stock: (uAnn.opening_stock ?? 0) - (mAnn.opening_stock ?? 0),
      production: (uAnn.production ?? 0) - (mAnn.production ?? 0),
      import: (uAnn.import ?? 0) - (mAnn.import ?? 0),
      export: (uAnn.export ?? 0) - (mAnn.export ?? 0),
      local_disappearance: (uAnn.local_disappearance ?? 0) - (mAnn.local_disappearance ?? 0),
      end_stock: (uAnn.end_stock ?? 0) - (mAnn.end_stock ?? 0)
    };
  }
  return { monthly: deltaMonthly, annual: deltaAnnual, isDelta: true };
}

// ---------------------------------------------------------------------------
// Initialization & Global Slicer
// ---------------------------------------------------------------------------
async function initDashboard() {
  try {
    let data = window.DASHBOARD_DATA;
    if (!data) {
      const res = await fetch("/api/master");
      if (!res.ok) {
        throw new Error(`Failed to load data: HTTP ${res.status}`);
      }
      data = await res.json();
    }
    STATE.master = data;

    // Always source My Forecast directly from SND Malaysia.xlsx (embedded in data.user_forecast)
    try { localStorage.removeItem("my_forecast_malaysia_palm"); } catch (e) {}
    STATE.userForecast = data.user_forecast || JSON.parse(JSON.stringify(data.user_forecast_defaults));

    updateHeaderKpis();
    renderYearSlicer();
    initControls();
    renderActiveTab();
  } catch (err) {
    console.error("Dashboard initialization error:", err);
    const mainEl = document.querySelector(".main-content");
    if (mainEl) {
      mainEl.innerHTML = `<div style="padding:24px;background:#fee2e2;color:#991b1b;border-radius:8px;margin:20px;font-family:sans-serif;">
        <h3 style="margin-bottom:8px;">Dashboard Load Error</h3>
        <p>${err.message}</p>
        <p style="margin-top:8px;font-size:12px;">Please make sure dashboard_data.js is located in the same directory as index.html.</p>
      </div>`;
    }
  }
}

function updateHeaderKpis() {
  const sep26 = STATE.master.snd.monthly["2026-09"];
  if (sep26) {
    document.getElementById("kpi-sep-prod").textContent = `${fmtNum(sep26.production)} T`;
    document.getElementById("kpi-sep-stock").textContent = `${fmtNum(sep26.end_stock)} T`;
  }
  const a26 = STATE.master.snd.annual["2026"];
  const a27 = STATE.master.snd.annual["2027"];
  if (a26) document.getElementById("kpi-2026-prod").textContent = `${fmtNum(a26.production)} T 2026F`;
  if (a27) document.getElementById("kpi-2027-prod").textContent = `${fmtNum(a27.production)} T 2027F`;
}

function renderYearSlicer() {
  const container = document.getElementById("year-pills-container");
  container.innerHTML = "";
  ALL_YEARS.forEach(yr => {
    const pill = document.createElement("button");
    pill.className = "year-pill";
    if (STATE.selectedYears.has(yr)) pill.classList.add("selected");
    if (yr >= 2026) pill.classList.add("is-fcst-year");
    pill.textContent = yr === 2026 ? "2026F" : yr === 2027 ? "2027F" : String(yr);
    pill.title = yr >= 2026
      ? `${yr} (Includes Forecast Oct 2026–Dec 2027) — Click to select, Ctrl+Click to multi-select`
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
        // Click selects single year
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
  });
}

function initControls() {
  // Preset buttons
  document.querySelectorAll(".preset-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".preset-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      const preset = btn.dataset.preset;
      STATE.selectedYears.clear();
      if (preset === "last5") {
        [2023, 2024, 2025, 2026, 2027].forEach(y => STATE.selectedYears.add(y));
      } else if (preset === "actual5") {
        [2022, 2023, 2024, 2025, 2026].forEach(y => STATE.selectedYears.add(y));
      } else if (preset === "last10") {
        for (let y = 2018; y <= 2027; y++) STATE.selectedYears.add(y);
      } else if (preset === "last20") {
        for (let y = 2008; y <= 2027; y++) STATE.selectedYears.add(y);
      } else if (preset === "monthly_all") {
        for (let y = 2004; y <= 2027; y++) STATE.selectedYears.add(y);
      } else if (preset === "all") {
        ALL_YEARS.forEach(y => STATE.selectedYears.add(y));
      }
      syncYearPillsUI();
      renderActiveTab();
    });
  });

  // Main Tabs
  document.querySelectorAll("#main-tabs .tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("#main-tabs .tab-btn").forEach(b => b.classList.remove("active"));
      document.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("active"));
      btn.classList.add("active");
      STATE.activeTab = btn.dataset.tab;
      document.getElementById(STATE.activeTab).classList.add("active");
      renderActiveTab();
    });
  });

  // Tab 1: S&D Controls
  // Tab 1: S&D View Format toggle (Balance Sheet vs Monthly Matrix)
  document.querySelectorAll("#snd-view-format .seg-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("#snd-view-format .seg-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      STATE.sndViewFormat = btn.dataset.fmt;
      renderSndTab();
    });
  });

  // Tab 1: S&D Forecast Mode
  document.querySelectorAll("#snd-fcst-mode .seg-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("#snd-fcst-mode .seg-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      STATE.sndFcstMode = btn.dataset.mode;
      renderSndTab();
    });
  });
  document.querySelectorAll("#snd-layout-mode .seg-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("#snd-layout-mode .seg-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      STATE.sndLayout = btn.dataset.layout;
      renderSndTab();
    });
  });
  document.querySelectorAll("#snd-chart-freq .seg-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("#snd-chart-freq .seg-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      STATE.sndChartFreq = btn.dataset.freq;
      renderSndCharts();
    });
  });
  document.querySelectorAll("#snd-compare-attr-select .seg-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("#snd-compare-attr-select .seg-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      STATE.sndCompareAttr = btn.dataset.attr;
      renderSndCharts();
    });
  });
  document.getElementById("btn-snd-expand-all").addEventListener("click", () => {
    getSortedSelectedYears().forEach(y => {
      if (y >= 2005) STATE.sndExpandedYears.add(y);
    });
    renderSndTable();
  });
  document.getElementById("btn-snd-collapse-all").addEventListener("click", () => {
    STATE.sndExpandedYears.clear();
    renderSndTable();
  });
  document.getElementById("btn-snd-csv").addEventListener("click", exportSndCsv);

  // Tab 2: Area Controls
  document.querySelectorAll("#area-view-mode .seg-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("#area-view-mode .seg-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      STATE.areaViewMode = btn.dataset.view;
      renderAreaTab();
    });
  });

  // Tab 3: Production Controls
  const prodStateSelect = document.getElementById("prod-state-select");
  prodStateSelect.innerHTML = STATE.master.metadata.entities.map(e => `<option value="${e}" ${e === "Malaysia" ? "selected" : ""}>${e}</option>`).join("");
  prodStateSelect.addEventListener("change", () => {
    STATE.prodState = prodStateSelect.value;
    renderProdTab();
  });
  document.querySelectorAll("#prod-attr-select .seg-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("#prod-attr-select .seg-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      STATE.prodAttr = btn.dataset.attr;
      renderProdTab();
    });
  });
  document.getElementById("btn-prod-expand-all").addEventListener("click", () => {
    getSortedSelectedYears().forEach(y => { if (y >= 2005) STATE.prodExpandedYears.add(y); });
    renderProdTab();
  });
  document.getElementById("btn-prod-collapse-all").addEventListener("click", () => {
    STATE.prodExpandedYears.clear();
    renderProdTab();
  });



  // Tab 5: Imports Controls
  document.getElementById("btn-imp-expand-all").addEventListener("click", () => {
    getSortedSelectedYears(1985, 2027).forEach(y => { if (y >= 2005) STATE.impExpandedYears.add(y); });
    renderImportsTab();
  });
  document.getElementById("btn-imp-collapse-all").addEventListener("click", () => {
    STATE.impExpandedYears.clear();
    renderImportsTab();
  });

  // Tab 6: Exports Controls
  document.querySelectorAll("#exports-split-mode .seg-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("#exports-split-mode .seg-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      STATE.expSplitMode = btn.dataset.split;
      renderExportsTab();
    });
  });
  document.querySelectorAll("#exports-port-unit .seg-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("#exports-port-unit .seg-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      STATE.expPortUnit = btn.dataset.unit;
      renderExportsTab();
    });
  });
  document.getElementById("btn-exp-expand-all").addEventListener("click", () => {
    getSortedSelectedYears(1990, 2026).forEach(y => { if (y >= 2004) STATE.expExpandedYears.add(y); });
    renderExportsTab();
  });
  document.getElementById("btn-exp-collapse-all").addEventListener("click", () => {
    STATE.expExpandedYears.clear();
    renderExportsTab();
  });

  // Tab 7: Stocks Controls
  document.getElementById("btn-stk-expand-all").addEventListener("click", () => {
    getSortedSelectedYears(1986, 2026).forEach(y => { if (y >= 2004) STATE.stkExpandedYears.add(y); });
    renderStocksTab();
  });
  document.getElementById("btn-stk-collapse-all").addEventListener("click", () => {
    STATE.stkExpandedYears.clear();
    renderStocksTab();
  });

  // Tab 8: Seasonality Controls
  document.getElementById("season-attr-select").addEventListener("change", (e) => {
    STATE.seasonAttr = e.target.value;
    renderSeasonalityTab();
  });
  document.querySelectorAll("#season-fcst-mode .seg-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("#season-fcst-mode .seg-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      STATE.seasonFcstMode = btn.dataset.mode;
      renderSeasonalityTab();
    });
  });

  // Tab 8: Survey Controls
  document.querySelectorAll("#survey-cat-mode .seg-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("#survey-cat-mode .seg-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      STATE.surveyCat = btn.dataset.cat;
      renderSurveyTab();
    });
  });
  document.querySelectorAll("#survey-window-mode .seg-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("#survey-window-mode .seg-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      STATE.surveyWindow = btn.dataset.win;
      renderSurveyTab();
    });
  });
  document.querySelectorAll("#survey-source-mode .seg-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("#survey-source-mode .seg-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      STATE.surveySource = btn.dataset.src;
      renderSurveyTab();
    });
  });
  document.querySelectorAll("#survey-poll-attr .seg-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("#survey-poll-attr .seg-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      STATE.surveyPollAttr = btn.dataset.pattr;
      renderSurveyTab();
    });
  });
}

function renderActiveTab() {
  switch (STATE.activeTab) {
    case "tab-snd": renderSndTab(); break;
    case "tab-area": renderAreaTab(); break;
    case "tab-prod": renderProdTab(); break;
    case "tab-imports": renderImportsTab(); break;
    case "tab-exports": renderExportsTab(); break;
    case "tab-stocks": renderStocksTab(); break;
    case "tab-seasonality": renderSeasonalityTab(); break;
    case "tab-survey": renderSurveyTab(); break;
  }
}

// ===========================================================================
// TAB 1: SUPPLY & DEMAND (S&D)
// ===========================================================================
const SND_ROWS = [
  { key: "opening_stock", label: "Opening Stock", isCalc: false },
  { key: "production", label: "Production", isCalc: false },
  { key: "import", label: "Import", isCalc: false },
  { key: "export", label: "Export", isCalc: false },
  { key: "local_disappearance", label: "Local Disappearance [Formula]", isCalc: true },
  { key: "end_stock", label: "End Stock", isCalc: false },
  { key: "stocks_to_use", label: "Stocks-to-Use Ratio (%) [CALC]", isCalc: true, isRatio: true }
];

function renderSndTab() {
  const isMatrix = STATE.sndViewFormat === "matrix";
  const tableCard = document.getElementById("snd-table-card");
  const pctCard = document.getElementById("snd-pct-table-card");
  const matrixCard = document.getElementById("snd-matrix-card");
  const btnExpAll = document.getElementById("btn-snd-expand-all");
  const btnColAll = document.getElementById("btn-snd-collapse-all");
  const panelSub = document.getElementById("snd-panel-sub");

  if (tableCard) tableCard.style.display = isMatrix ? "none" : "block";
  if (pctCard) pctCard.style.display = isMatrix ? "none" : "block";
  if (matrixCard) matrixCard.style.display = isMatrix ? "block" : "none";
  if (btnExpAll) btnExpAll.style.display = isMatrix ? "none" : "inline-block";
  if (btnColAll) btnColAll.style.display = isMatrix ? "none" : "inline-block";

  if (panelSub) {
    panelSub.textContent = isMatrix
      ? "Calendar month progression matrix with Opening Stock, Supply, Disappearance, Ending Stock & SU (%). Units: Tonnes."
      : "Click any year header (`[+]`) to expand or collapse monthly breakdown (Jan–Dec). Units: Tonnes.";
  }

  if (isMatrix) {
    renderSndMatrixTable();
  } else {
    renderSndTable();
  }
  renderSndCharts();
}

function renderSndTable() {
  const container = document.getElementById("snd-table-container");
  const years = getSortedSelectedYears(1975, 2027);
  const { monthly, annual, isDelta } = getEffectiveSndData(STATE.sndFcstMode);
  const fmt = isDelta ? (v) => fmtDelta(v, 0) : (v) => fmtNum(v, 0);

  // Attributes x Years Matrix (Columns expand/collapse by year) with standardized widths
  let html = `<table class="data-table"><thead><tr><th style="min-width:220px;width:220px;">Attribute (Tonnes)</th>`;
  for (const yr of years) {
    const canExp = yr >= 2005;
    const isExp = canExp && STATE.sndExpandedYears.has(yr);
    const fcstTag = yr >= 2026 ? "F" : "";
    if (isExp) {
      for (let m = 1; m <= 12; m++) {
        const isF = (yr === 2026 && m >= 10) || yr === 2027;
        html += `<th class="${isF ? 'cell-fcst' : ''}">${MONTH_SHORT[m - 1]} ${String(yr).slice(2)}${isF ? 'F' : ''}</th>`;
      }
    }
    html += `<th class="col-year-header col-annual" data-year="${yr}" title="Click to ${isExp ? 'collapse' : 'expand'} ${yr}">
      ${canExp ? `<span class="expand-toggle">${isExp ? "&minus;" : "+"}</span>` : ''}${yr}${fcstTag}
    </th>`;
  }
  html += `</tr></thead><tbody>`;

  for (const rowDef of SND_ROWS) {
    const isRatio = rowDef.isRatio;
    const rCls = rowDef.key === "end_stock" ? "row-highlight" : isRatio ? "row-highlight" : rowDef.isCalc ? "row-subtotal" : "";
    const styleAttr = isRatio ? 'style="color:#059669;font-weight:700;"' : '';
    html += `<tr class="${rCls}"><td class="sticky-col" ${styleAttr}>${rowDef.label}</td>`;
    for (const yr of years) {
      const canExp = yr >= 2005;
      const isExp = canExp && STATE.sndExpandedYears.has(yr);
      if (isExp) {
        for (let m = 1; m <= 12; m++) {
          const p = `${yr}-${String(m).padStart(2, "0")}`;
          const mRec = monthly[p];
          const cCls = mRec && mRec.is_forecast ? "cell-fcst" : "";
          let valStr;
          if (isRatio) {
            const use = (mRec?.export || 0) + (mRec?.local_disappearance || 0);
            valStr = (use > 0 && mRec?.end_stock != null) ? (mRec.end_stock / use * 100).toFixed(1) + "%" : "--";
          } else {
            valStr = fmt(mRec ? mRec[rowDef.key] : null);
          }
          html += `<td class="num ${cCls}" ${styleAttr}>${valStr}</td>`;
        }
      }
      const aRec = annual[yr];
      let aValStr;
      if (isRatio) {
        const aUse = (aRec?.export || 0) + (aRec?.local_disappearance || 0);
        aValStr = (aUse > 0 && aRec?.end_stock != null) ? (aRec.end_stock / aUse * 100).toFixed(1) + "%" : "--";
      } else {
        aValStr = fmt(aRec ? aRec[rowDef.key] : null);
      }
      html += `<td class="num col-annual ${yr >= 2026 ? 'cell-fcst' : ''}" ${styleAttr}>${aValStr}</td>`;
    }
    html += `</tr>`;
  }
  html += `</tbody></table>`;
  container.innerHTML = html;

  // Render Synchronized MoM % / YoY % Change Table below main S&D Balance Sheet
  const pctContainer = document.getElementById("snd-pct-table-container");
  if (pctContainer) {
    const pctSourceMode = STATE.sndFcstMode === "delta" ? "user" : STATE.sndFcstMode;
    const { monthly: pctMonthly, annual: pctAnnual } = getEffectiveSndData(pctSourceMode);

    function fmtPctCell(val, dec = 1) {
      if (val === null || val === undefined || Number.isNaN(Number(val)) || !Number.isFinite(Number(val))) {
        return '<span class="text-muted">--</span>';
      }
      const n = Number(val);
      const sign = n > 0 ? "+" : "";
      const cls = n > 0 ? "cell-pos" : n < 0 ? "cell-neg" : "";
      return `<span class="${cls}">${sign}${n.toFixed(dec)}%</span>`;
    }

    function getRecMetric(rec, rDef) {
      if (!rec) return null;
      if (rDef.isRatio) {
        const u = (rec.export || 0) + (rec.local_disappearance || 0);
        return (u > 0 && rec.end_stock != null) ? (rec.end_stock / u * 100) : null;
      }
      const v = rec[rDef.key];
      return (v !== null && v !== undefined && !Number.isNaN(Number(v))) ? Number(v) : null;
    }

    let pctHtml = `<table class="data-table"><thead><tr><th style="min-width:220px;width:220px;">Attribute (MoM % / YoY %)</th>`;
    for (const yr of years) {
      const canExp = yr >= 2005;
      const isExp = canExp && STATE.sndExpandedYears.has(yr);
      const fcstTag = yr >= 2026 ? "F" : "";
      if (isExp) {
        for (let m = 1; m <= 12; m++) {
          const isF = (yr === 2026 && m >= 10) || yr === 2027;
          pctHtml += `<th class="${isF ? 'cell-fcst' : ''}">${MONTH_SHORT[m - 1]} ${String(yr).slice(2)}${isF ? 'F' : ''}</th>`;
        }
      }
      pctHtml += `<th class="col-year-header col-annual" data-year="${yr}" title="Click to ${isExp ? 'collapse' : 'expand'} ${yr}">
        ${canExp ? `<span class="expand-toggle">${isExp ? "&minus;" : "+"}</span>` : ''}${yr}${fcstTag} YoY%
      </th>`;
    }
    pctHtml += `</tr></thead><tbody>`;

    for (const rowDef of SND_ROWS) {
      const isRatio = rowDef.isRatio;
      const rCls = rowDef.key === "end_stock" ? "row-highlight" : isRatio ? "row-highlight" : rowDef.isCalc ? "row-subtotal" : "";
      pctHtml += `<tr class="${rCls}"><td class="sticky-col">${rowDef.label}</td>`;

      for (const yr of years) {
        const canExp = yr >= 2005;
        const isExp = canExp && STATE.sndExpandedYears.has(yr);
        if (isExp) {
          for (let m = 1; m <= 12; m++) {
            const p = `${yr}-${String(m).padStart(2, "0")}`;
            const prevP = m === 1 ? `${yr - 1}-12` : `${yr}-${String(m - 1).padStart(2, "0")}`;
            const mRec = pctMonthly[p];
            const prevRec = pctMonthly[prevP];
            const cCls = mRec && mRec.is_forecast ? "cell-fcst" : "";

            const currV = getRecMetric(mRec, rowDef);
            const prevV = getRecMetric(prevRec, rowDef);
            const momPct = (currV !== null && prevV !== null && prevV !== 0)
              ? ((currV - prevV) / Math.abs(prevV)) * 100
              : null;

            pctHtml += `<td class="num ${cCls}">${fmtPctCell(momPct, 1)}</td>`;
          }
        }
        const currA = getRecMetric(pctAnnual[yr], rowDef);
        const prevA = getRecMetric(pctAnnual[yr - 1], rowDef);
        const yoyPct = (currA !== null && prevA !== null && prevA !== 0)
          ? ((currA - prevA) / Math.abs(prevA)) * 100
          : null;

        pctHtml += `<td class="num col-annual ${yr >= 2026 ? 'cell-fcst' : ''}">${fmtPctCell(yoyPct, 1)}</td>`;
      }
      pctHtml += `</tr>`;
    }

    // Add 1H Production Ratio (%) and 2H Production Ratio (%) rows (1st 6M / Full Year & 2nd 6M / Full Year)
    [
      { half: 1, label: "1H Production Ratio (%)" },
      { half: 2, label: "2H Production Ratio (%)" }
    ].forEach(hDef => {
      pctHtml += `<tr class="row-subtotal"><td class="sticky-col">${hDef.label}</td>`;
      for (const yr of years) {
        const canExp = yr >= 2005;
        const isExp = canExp && STATE.sndExpandedYears.has(yr);
        let h1Sum = 0, h2Sum = 0, h1Cnt = 0, h2Cnt = 0;
        for (let m = 1; m <= 12; m++) {
          const r = pctMonthly[`${yr}-${String(m).padStart(2, "0")}`];
          if (r && r.production !== null && r.production !== undefined) {
            if (m <= 6) { h1Sum += Number(r.production); h1Cnt++; }
            else { h2Sum += Number(r.production); h2Cnt++; }
          }
        }
        const totProd = h1Sum + h2Sum;
        const hasFullYear = h1Cnt === 6 && h2Cnt === 6 && totProd > 0;

        if (isExp) {
          for (let m = 1; m <= 12; m++) {
            const p = `${yr}-${String(m).padStart(2, "0")}`;
            const mRec = pctMonthly[p];
            const cCls = mRec && mRec.is_forecast ? "cell-fcst" : "";
            pctHtml += `<td class="num ${cCls}"><span class="text-muted">--</span></td>`;
          }
        }

        const ratioVal = hasFullYear ? ((hDef.half === 1 ? h1Sum : h2Sum) / totProd) * 100 : null;
        const cellStr = ratioVal !== null ? `<span style="font-weight:700;color:#0f172a;">${ratioVal.toFixed(1)}%</span>` : '<span class="text-muted">--</span>';
        pctHtml += `<td class="num col-annual ${yr >= 2026 ? 'cell-fcst' : ''}">${cellStr}</td>`;
      }
      pctHtml += `</tr>`;
    });

    pctHtml += `</tbody></table>`;
    pctContainer.innerHTML = pctHtml;
  }

  // Bind expand/collapse click listeners on BOTH tables so they stay 100% synchronized
  document.querySelectorAll("#snd-table-container .col-year-header, #snd-pct-table-container .col-year-header").forEach(th => {
    th.addEventListener("click", () => {
      const yr = Number(th.dataset.year);
      if (yr < 2005) return;
      if (STATE.sndExpandedYears.has(yr)) STATE.sndExpandedYears.delete(yr);
      else STATE.sndExpandedYears.add(yr);
      renderSndTable();
    });
  });
}


function renderSndMatrixTable() {
  const container = document.getElementById("snd-matrix-container");
  if (!container) return;

  const years = getSortedSelectedYears(2005, 2027);
  const { monthly, annual, isDelta } = getEffectiveSndData(STATE.sndFcstMode);
  const fmt = isDelta ? (v) => fmtDelta(v, 0) : (v) => fmtNum(v, 0);

  // Helper for heatmap coloring
  const getHeatmapStyle = (val, minVal, maxVal) => {
    if (isDelta || val == null || minVal == null || maxVal == null || minVal === maxVal) return "";
    const t = Math.max(0, Math.min(1, (val - minVal) / (maxVal - minVal)));
    if (t < 0.5) {
      const k = t / 0.5;
      const r = Math.round(252 + (254 - 252) * k);
      const g = Math.round(165 + (240 - 165) * k);
      const b = Math.round(165 + (138 - 165) * k);
      return `style="background-color: rgba(${r}, ${g}, ${b}, 0.75); color: #0f172a; font-weight: 500;"`;
    } else {
      const k = (t - 0.5) / 0.5;
      const r = Math.round(254 + (134 - 254) * k);
      const g = Math.round(240 + (239 - 240) * k);
      const b = Math.round(138 + (172 - 138) * k);
      return `style="background-color: rgba(${r}, ${g}, ${b}, 0.75); color: #0f172a; font-weight: 500;"`;
    }
  };

  let html = `<table class="data-table snd-matrix-table">
    <thead>
      <tr>
        <th class="matrix-col-year">Year</th>
        <th class="matrix-col-metric">Metric</th>
        <th>Jan</th>
        <th>Feb</th>
        <th>Mar</th>
        <th>Apr</th>
        <th>May</th>
        <th>Jun</th>
        <th>Jul</th>
        <th>Aug</th>
        <th>Sept</th>
        <th>Oct</th>
        <th>Nov</th>
        <th>Dec</th>
        <th class="matrix-col-total">Total</th>
      </tr>
    </thead>
    <tbody>`;

  years.forEach(yr => {
    const aRec = annual[yr] || {};
    const mRecs = [];
    for (let m = 1; m <= 12; m++) {
      const p = `${yr}-${String(m).padStart(2, "0")}`;
      mRecs.push(monthly[p] || null);
    }

    // Min and max for production & export within this year for heatmap
    const prodVals = mRecs.map(r => r?.production).filter(v => v != null);
    const minProd = prodVals.length ? Math.min(...prodVals) : null;
    const maxProd = prodVals.length ? Math.max(...prodVals) : null;

    const expVals = mRecs.map(r => r?.export).filter(v => v != null);
    const minExp = expVals.length ? Math.min(...expVals) : null;
    const maxExp = expVals.length ? Math.max(...expVals) : null;

    // 1. Month Header Row
    html += `<tr class="matrix-row-month">
      <td class="matrix-col-year"><strong>${yr}</strong></td>
      <td class="matrix-col-metric"><strong>Month</strong></td>`;
    for (let m = 1; m <= 12; m++) {
      const isF = (yr === 2026 && m >= 10) || yr >= 2027;
      const mLabel = `${MONTH_SHORT[m - 1]}-${String(yr).slice(2)}`;
      html += `<td class="${isF ? 'is-fcst-month' : ''}"><strong>${mLabel}</strong></td>`;
    }
    html += `<td class="matrix-col-total"><strong>Total</strong></td></tr>`;

    // 2. Opening Stock Row
    html += `<tr>
      <td class="matrix-col-year"><strong>${yr}</strong></td>
      <td class="matrix-col-metric">Opening Stock</td>`;
    for (let m = 0; m < 12; m++) {
      html += `<td>${fmt(mRecs[m]?.opening_stock)}</td>`;
    }
    html += `<td class="matrix-col-total">${fmt(mRecs[0]?.opening_stock ?? aRec?.opening_stock)}</td></tr>`;

    // 3. Production Row
    html += `<tr>
      <td class="matrix-col-year"><strong>${yr}</strong></td>
      <td class="matrix-col-metric">Production</td>`;
    for (let m = 0; m < 12; m++) {
      const val = mRecs[m]?.production;
      html += `<td ${getHeatmapStyle(val, minProd, maxProd)}>${fmt(val)}</td>`;
    }
    html += `<td class="matrix-col-total">${fmt(aRec?.production)}</td></tr>`;

    // 4. Import Row
    html += `<tr>
      <td class="matrix-col-year"><strong>${yr}</strong></td>
      <td class="matrix-col-metric">Import</td>`;
    for (let m = 0; m < 12; m++) {
      html += `<td>${fmt(mRecs[m]?.import)}</td>`;
    }
    html += `<td class="matrix-col-total">${fmt(aRec?.import)}</td></tr>`;

    // 5. Export Row
    html += `<tr>
      <td class="matrix-col-year"><strong>${yr}</strong></td>
      <td class="matrix-col-metric">Export</td>`;
    for (let m = 0; m < 12; m++) {
      const val = mRecs[m]?.export;
      html += `<td ${getHeatmapStyle(val, minExp, maxExp)}>${fmt(val)}</td>`;
    }
    html += `<td class="matrix-col-total">${fmt(aRec?.export)}</td></tr>`;

    // 6. Local Disappearance Row
    html += `<tr>
      <td class="matrix-col-year"><strong>${yr}</strong></td>
      <td class="matrix-col-metric">Local Disappearance</td>`;
    for (let m = 0; m < 12; m++) {
      html += `<td>${fmt(mRecs[m]?.local_disappearance)}</td>`;
    }
    html += `<td class="matrix-col-total">${fmt(aRec?.local_disappearance)}</td></tr>`;

    // 7. End Stock Row
    html += `<tr>
      <td class="matrix-col-year"><strong>${yr}</strong></td>
      <td class="matrix-col-metric">End Stock</td>`;
    for (let m = 0; m < 12; m++) {
      html += `<td>${fmt(mRecs[m]?.end_stock)}</td>`;
    }
    html += `<td class="matrix-col-total">${fmt(mRecs[11]?.end_stock ?? aRec?.end_stock)}</td></tr>`;

    // 8. SU (Stocks-to-Use) Row
    html += `<tr class="matrix-row-su matrix-block-end">
      <td class="matrix-col-year"><strong>${yr}</strong></td>
      <td class="matrix-col-metric"><strong>SU</strong></td>`;
    for (let m = 0; m < 12; m++) {
      const rec = mRecs[m];
      const use = (rec?.export || 0) + (rec?.local_disappearance || 0);
      let suStr = '<span class="text-muted">-</span>';
      if (use > 0 && rec?.end_stock != null) {
        const su = (rec.end_stock / use) * 100;
        suStr = isDelta ? fmtDelta(su, 1) + "%" : Math.round(su) + "%";
      }
      html += `<td><strong>${suStr}</strong></td>`;
    }
    const aUse = (aRec?.export || 0) + (aRec?.local_disappearance || 0);
    const decStk = mRecs[11]?.end_stock ?? aRec?.end_stock;
    let aSuStr = '<span class="text-muted">-</span>';
    if (aUse > 0 && decStk != null) {
      const aSu = (decStk / aUse) * 100;
      aSuStr = isDelta ? fmtDelta(aSu, 1) + "%" : Math.round(aSu) + "%";
    }
    html += `<td class="matrix-col-total"><strong>${aSuStr}</strong></td></tr>`;
  });

  html += `</tbody></table>`;
  container.innerHTML = html;
}

function renderSndCharts() {
  destroyChart("sndMain");
  destroyChart("sndCompare");

  const { monthly, annual } = getEffectiveSndData(STATE.sndFcstMode === "delta" ? "user" : STATE.sndFcstMode);
  const years = getSortedSelectedYears(1975, 2027);

  // -------------------------------------------------------------------------
  // CHART 1: Palm Oil Stocks-to-Use Ratio (%) & Days of Supply Trajectory
  // -------------------------------------------------------------------------
  const labels1 = [];
  const stuRatioData = [];
  const daysSupplyData = [];

  if (STATE.sndChartFreq === "monthly") {
    const mYears = years.filter(y => y >= 2005);
    const useYears = mYears.length ? mYears : [2023, 2024, 2025, 2026, 2027];
    for (const yr of useYears) {
      for (let m = 1; m <= 12; m++) {
        const p = `${yr}-${String(m).padStart(2, "0")}`;
        const r = monthly[p];
        if (!r) continue;
        labels1.push(`${MONTH_SHORT[m - 1]} ${String(yr).slice(2)}${r.is_forecast ? 'F' : ''}`);
        const totalUse = (r.export || 0) + (r.local_disappearance || 0);
        const stu = (totalUse > 0 && r.end_stock != null) ? Number((r.end_stock / totalUse * 100).toFixed(2)) : null;
        const days = (totalUse > 0 && r.end_stock != null) ? Number((r.end_stock / (totalUse / 30.417)).toFixed(1)) : null;
        stuRatioData.push(stu);
        daysSupplyData.push(days);
      }
    }
  } else {
    for (const yr of years) {
      const r = annual[yr];
      if (!r) continue;
      labels1.push(`${yr}${r.is_forecast ? 'F' : ''}`);
      const totalUse = (r.export || 0) + (r.local_disappearance || 0);
      const stu = (totalUse > 0 && r.end_stock != null) ? Number((r.end_stock / totalUse * 100).toFixed(2)) : null;
      const days = (totalUse > 0 && r.end_stock != null) ? Number((r.end_stock / (totalUse / 365.25)).toFixed(1)) : null;
      stuRatioData.push(stu);
      daysSupplyData.push(days);
    }
  }

  const ctx1 = document.getElementById("chart-snd-main").getContext("2d");
  STATE.charts.sndMain = new Chart(ctx1, {
    type: "line",
    data: {
      labels: labels1,
      datasets: [
        {
          label: "Stocks-to-Use Ratio (%) - LHS",
          data: stuRatioData,
          borderColor: "#059669",
          backgroundColor: "rgba(5, 150, 105, 0.12)",
          borderWidth: 2.4,
          pointRadius: 2.5,
          tension: 0.25,
          fill: true,
          yAxisID: "y"
        },
        {
          label: "Days of Supply (Days) - RHS",
          data: daysSupplyData,
          borderColor: "#2563eb",
          backgroundColor: "rgba(37, 99, 235, 0.1)",
          borderWidth: 2,
          borderDash: [4, 4],
          pointRadius: 2,
          tension: 0.25,
          yAxisID: "y1"
        }
      ]
    },
    options: {
      ...chartOptionsCommon("Stocks-to-Use Ratio (%)"),
      scales: {
        x: { ticks: { color: "#64748b" }, grid: { color: "rgba(100,116,139,0.08)" } },
        y: {
          position: "left",
          title: { display: true, text: "Stocks-to-Use Ratio (%)", color: "#059669", font: { weight: "bold" } },
          ticks: { color: "#059669", callback: v => v + "%" },
          grid: { color: "rgba(100,116,139,0.08)" }
        },
        y1: {
          position: "right",
          title: { display: true, text: "Days of Supply (Days)", color: "#2563eb", font: { weight: "bold" } },
          ticks: { color: "#2563eb" },
          grid: { drawOnChartArea: false }
        }
      }
    }
  });

  // -------------------------------------------------------------------------
  // CHART 2: 2026-2027 Forecast Comparison: Model vs My Forecast (Single Selected Attribute)
  // -------------------------------------------------------------------------
  const compareAttr = STATE.sndCompareAttr || "production";
  const ATTR_META = {
    production: { label: "CPO Production", unit: "Tonnes", decimals: 0, isRatio: false },
    export: { label: "Exports", unit: "Tonnes", decimals: 0, isRatio: false },
    import: { label: "Imports", unit: "Tonnes", decimals: 0, isRatio: false },
    local_disappearance: { label: "Local Disappearance", unit: "Tonnes", decimals: 0, isRatio: false },
    end_stock: { label: "Closing End Stock", unit: "Tonnes", decimals: 0, isRatio: false },
    stocks_to_use: { label: "Stocks-to-Use Ratio", unit: "%", decimals: 1, isRatio: true }
  };
  const attrInfo = ATTR_META[compareAttr] || ATTR_META.production;

  const subEl = document.getElementById("snd-chart2-sub");
  if (subEl) subEl.textContent = `${attrInfo.label} (${attrInfo.unit}): 2026-2027 Actuals vs Model & User Forecast`;

  const modelSnd = getEffectiveSndData("model").monthly;
  const userSnd = getEffectiveSndData("user").monthly;

  const cLabels = [];
  const actualData = [];
  const modelFcstData = [];
  const userFcstData = [];

  const getAttrVal = (r) => {
    if (!r) return null;
    if (compareAttr === "stocks_to_use") {
      const u = (r.export || 0) + (r.local_disappearance || 0);
      return (u > 0 && r.end_stock != null) ? Number((r.end_stock / u * 100).toFixed(1)) : null;
    }
    return r[compareAttr] != null ? r[compareAttr] : null;
  };

  for (const yr of [2026, 2027]) {
    for (let m = 1; m <= 12; m++) {
      const p = `${yr}-${String(m).padStart(2, "0")}`;
      const mRec = modelSnd[p];
      const uRec = userSnd[p];
      if (!mRec) continue;

      const isActual = yr === 2026 && m <= 9;
      const isFcst = !isActual;
      cLabels.push(`${MONTH_SHORT[m - 1]} ${String(yr).slice(2)}${isFcst ? 'F' : ''}`);

      const vModel = getAttrVal(mRec);
      const vUser = getAttrVal(uRec);

      if (isActual) {
        actualData.push(vModel);
        modelFcstData.push(null);
        userFcstData.push(null);
      } else {
        actualData.push(null);
        modelFcstData.push(vModel);
        userFcstData.push(vUser);
      }
    }
  }

  // Connect forecast lines continuously from 2026-09 actual
  const sepIdx = 8; // 2026-09
  if (actualData[sepIdx] !== null) {
    modelFcstData[sepIdx] = actualData[sepIdx];
    userFcstData[sepIdx] = actualData[sepIdx];
  }

  const ctx2 = document.getElementById("chart-snd-compare").getContext("2d");
  STATE.charts.sndCompare = new Chart(ctx2, {
    type: "line",
    data: {
      labels: cLabels,
      datasets: [
        {
          label: `Official Actual (Jan - Sep 2026)`,
          data: actualData,
          borderColor: "#0f172a",
          backgroundColor: "#0f172a",
          borderWidth: 2.8,
          pointRadius: 4,
          pointBackgroundColor: "#0f172a",
          tension: 0.2
        },
        {
          label: `Model Forecast (Oct 2026 - Dec 2027)`,
          data: modelFcstData,
          borderColor: "#2563eb",
          backgroundColor: "rgba(37, 99, 235, 0.08)",
          borderWidth: 2.5,
          borderDash: [5, 4],
          pointRadius: 3.5,
          pointBackgroundColor: "#2563eb",
          tension: 0.25,
          fill: false
        },
        {
          label: `My Forecast (Oct 2026 - Dec 2027)`,
          data: userFcstData,
          borderColor: "#d97706",
          backgroundColor: "rgba(217, 119, 6, 0.08)",
          borderWidth: 2.5,
          borderDash: [2, 2],
          pointRadius: 3.5,
          pointBackgroundColor: "#d97706",
          tension: 0.25,
          fill: "-1" // Highlight difference between model and user
        }
      ]
    },
    options: {
      ...chartOptionsCommon(attrInfo.unit),
      plugins: {
        ...chartOptionsCommon(attrInfo.unit).plugins,
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const val = ctx.parsed.y;
              if (val == null) return null;
              return `${ctx.dataset.label}: ${attrInfo.isRatio ? val.toFixed(1) + '%' : fmtNum(val, 0) + ' ' + attrInfo.unit}`;
            }
          }
        }
      }
    }
  });
}

function exportSndCsv() {
  const { monthly } = getEffectiveSndData(STATE.sndFcstMode);
  const rows = [["Period", "Year", "Month", "Opening Stock", "Production", "Import", "Export", "Local Disappearance", "End Stock", "Status"]];
  Object.keys(monthly).sort().forEach(p => {
    const r = monthly[p];
    if (!STATE.selectedYears.has(r.year)) return;
    rows.push([
      r.period, r.year, r.month,
      r.opening_stock, r.production, r.import, r.export, r.local_disappearance, r.end_stock,
      r.is_forecast ? "Forecast" : "Actual"
    ]);
  });
  const csv = rows.map(r => r.join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `Malaysia_Palm_SND_${STATE.sndFcstMode}.csv`;
  a.click();
}

// ===========================================================================
// TAB 2: AREA (MATURE VS IMMATURE)
// ===========================================================================
// Grouped geographically North-to-South
const AREA_REGION_GROUPS = [
  { group: "National & Belts", entities: ["Malaysia", "Peninsular Malaysia", "Sabah & Sarawak"] },
  { group: "Northern Peninsular", entities: ["Kedah", "Pulau Pinang", "Perak"] },
  { group: "Central & Southern", entities: ["Selangor", "Negeri Sembilan", "Melaka", "Johor"] },
  { group: "Eastern Peninsular", entities: ["Kelantan", "Terengganu", "Pahang"] },
  { group: "East Malaysia (Borneo)", entities: ["Sabah", "Sarawak"] }
];

function renderAreaTab() {
  destroyChart("areaStacked");

  const regArea = STATE.master.area.regional_1975_2025;
  const stArea = STATE.master.area.state_2011_2025;
  const catArea = STATE.master.area.category_summary;
  const ffbStateHist = STATE.master.production.annual;

  // Render Region Slicer Grouped North-to-South
  const slicerCard = document.getElementById("area-region-slicer-card");
  const slicerContainer = document.getElementById("area-region-slicer-container");
  if (STATE.areaViewMode === "regional") {
    slicerCard.style.display = "block";
    let sHtml = "";
    AREA_REGION_GROUPS.forEach(grp => {
      sHtml += `<div class="region-slicer-group">
        <span class="region-group-label">${grp.group}:</span>`;
      grp.entities.forEach(ent => {
        const isSel = STATE.areaEntities.has(ent);
        sHtml += `<button class="region-pill ${isSel ? 'selected' : ''}" data-entity="${ent}">${ent}</button>`;
      });
      sHtml += `</div>`;
    });
    slicerContainer.innerHTML = sHtml;

    slicerContainer.querySelectorAll(".region-pill").forEach(pill => {
      pill.addEventListener("click", (e) => {
        const ent = pill.dataset.entity;
        if (e.ctrlKey || e.metaKey || e.shiftKey) {
          if (STATE.areaEntities.has(ent)) {
            if (STATE.areaEntities.size > 1) STATE.areaEntities.delete(ent);
          } else {
            STATE.areaEntities.add(ent);
          }
        } else {
          if (STATE.areaEntities.has(ent) && STATE.areaEntities.size > 1) {
            STATE.areaEntities.delete(ent);
          } else {
            STATE.areaEntities.clear();
            STATE.areaEntities.add(ent);
          }
        }
        renderAreaTab();
      });
    });
  } else {
    slicerCard.style.display = "none";
  }

  const container = document.getElementById("area-table-container");

  if (STATE.areaViewMode === "regional") {
    const selectedEnts = Array.from(STATE.areaEntities);
    const minYr = selectedEnts.some(e => !["Malaysia", "Peninsular Malaysia", "Sabah & Sarawak", "Sabah", "Sarawak"].includes(e)) ? 2011 : 1975;
    // Allow through 2027 to show yield, OER, and mature area forecasts
    const years = getSortedSelectedYears(minYr, 2027);

    const labels = years.map(y => y >= 2026 ? `${y}F` : String(y));
    const matTotalByYear = [];
    const immTotalByYear = [];
    const ffbYieldByYear = [];
    const oerByYear = [];

    years.forEach(yr => {
      const yrStr = String(yr);
      let yMat = 0, yImm = 0;
      let ffbSum = 0, ffbHa = 0;
      let oerSum = 0, oerHa = 0;

      selectedEnts.forEach(ent => {
        const obj = (yr >= 2011 && stArea[yrStr] && stArea[yrStr][ent])
          ? stArea[yrStr][ent]
          : (regArea[yrStr] ? regArea[yrStr][ent] : null);
        if (obj) {
          yMat += obj.mature_ha || 0;
          yImm += obj.immature_ha || 0;
        }
        const aProd = ffbStateHist[yrStr]?.entities?.[ent] || ffbStateHist[yr]?.entities?.[ent];
        if (aProd?.ffb_yield && obj?.mature_ha) {
          ffbSum += aProd.ffb_yield * obj.mature_ha;
          ffbHa += obj.mature_ha;
        }
        if (aProd?.oer && obj?.mature_ha) {
          oerSum += aProd.oer * obj.mature_ha;
          oerHa += obj.mature_ha;
        }
      });
      matTotalByYear.push(yMat);
      immTotalByYear.push(yImm);
      ffbYieldByYear.push(ffbHa > 0 ? Number((ffbSum / ffbHa).toFixed(2)) : (ffbStateHist[yrStr]?.entities?.[selectedEnts[0]]?.ffb_yield ?? null));
      oerByYear.push(oerHa > 0 ? Number((oerSum / oerHa).toFixed(2)) : (ffbStateHist[yrStr]?.entities?.[selectedEnts[0]]?.oer ?? null));
    });

    const entTitle = selectedEnts.length === 1 ? selectedEnts[0] : `${selectedEnts.length} Selected Regions (${selectedEnts.slice(0, 3).join(", ")}${selectedEnts.length > 3 ? "..." : ""})`;
    document.getElementById("area-chart1-title").textContent = `${entTitle}: Mature vs Immature Planted Area (Ha), FFB Yield (T/Ha) & OER (%)`;

    // Compute dynamic min/max bounds for FFB Yield and OER to make variations clearly pronounced
    const validYlds = ffbYieldByYear.filter(v => v != null && !isNaN(v));
    const minYld = validYlds.length ? Math.min(...validYlds) : 14;
    const maxYld = validYlds.length ? Math.max(...validYlds) : 22;
    const yldPad = Math.max((maxYld - minYld) * 0.25, 0.8);
    const yldMin = Math.max(0, Math.floor((minYld - yldPad) * 2) / 2);
    const yldMax = Math.ceil((maxYld + yldPad) * 2) / 2;

    const validOers = oerByYear.filter(v => v != null && !isNaN(v));
    const minOer = validOers.length ? Math.min(...validOers) : 18;
    const maxOer = validOers.length ? Math.max(...validOers) : 22;
    const oerPad = Math.max((maxOer - minOer) * 0.25, 0.5);
    const oerMin = Math.max(0, Math.floor((minOer - oerPad) * 2) / 2);
    const oerMax = Math.ceil((maxOer + oerPad) * 2) / 2;

    // Zoom the planted-area axis to the filtered years: floor just under the smallest mature area (so the
    // mature segment stays visible), ceiling just over the largest mature + immature total
    const validMat = matTotalByYear.filter(v => v > 0);
    const validTot = matTotalByYear.map((v, i) => v + immTotalByYear[i]).filter(v => v > 0);
    let areaMin, areaMax;
    if (validMat.length && validTot.length) {
      const lo = Math.min(...validMat), hi = Math.max(...validTot);
      const pad = Math.max((hi - lo) * 0.08, hi * 0.01);
      const step = Math.pow(10, Math.floor(Math.log10(Math.max(hi - lo, 1)))) / 2;
      areaMin = Math.max(0, Math.floor((lo - pad) / step) * step);
      areaMax = Math.ceil((hi + pad) / step) * step;
    }

    const ctx1 = document.getElementById("chart-area-stacked").getContext("2d");
    STATE.charts.areaStacked = new Chart(ctx1, {
      type: "bar",
      data: {
        labels,
        datasets: [
          {
            type: "line",
            label: "FFB Yield (Tonnes/Ha) - RHS 1",
            data: ffbYieldByYear,
            borderColor: "#2563eb",
            backgroundColor: "#2563eb",
            borderWidth: 2.8,
            pointRadius: 4,
            tension: 0.25,
            yAxisID: "y1"
          },
          {
            type: "line",
            label: "Oil Extraction Rate (OER %) - RHS 2",
            data: oerByYear,
            borderColor: "#9333ea",
            backgroundColor: "#9333ea",
            borderWidth: 2.4,
            borderDash: [4, 4],
            pointRadius: 4,
            tension: 0.25,
            yAxisID: "y2"
          },
          {
            type: "bar",
            label: "Mature Area (Ha) - LHS",
            data: matTotalByYear,
            backgroundColor: "rgba(5, 150, 105, 0.82)",
            stack: "area",
            yAxisID: "y"
          },
          {
            type: "bar",
            label: "Immature Area (Ha) - LHS",
            data: immTotalByYear,
            backgroundColor: "rgba(217, 119, 6, 0.82)",
            stack: "area",
            yAxisID: "y"
          }
        ]
      },
      options: {
        ...chartOptionsCommon("Hectares (Ha)"),
        scales: {
          x: { stacked: true, ticks: { color: "#64748b" }, grid: { color: "rgba(100,116,139,0.08)" } },
          y: {
            position: "left",
            stacked: true,
            min: areaMin,
            max: areaMax,
            title: { display: true, text: areaMin > 0 ? "Planted Area (Ha) - zoomed, not from zero" : "Planted Area (Ha)", color: "#059669", font: { weight: "bold" } },
            ticks: { color: "#64748b" },
            grid: { color: "rgba(100,116,139,0.08)" }
          },
          y1: {
            position: "right",
            min: yldMin,
            max: yldMax,
            title: { display: true, text: "FFB Yield (Tonnes/Ha)", color: "#2563eb", font: { weight: "bold" } },
            ticks: { color: "#2563eb", font: { family: "'JetBrains Mono', monospace" } },
            grid: { drawOnChartArea: false }
          },
          y2: {
            position: "right",
            min: oerMin,
            max: oerMax,
            title: { display: true, text: "OER (%)", color: "#9333ea", font: { weight: "bold" } },
            ticks: { color: "#9333ea", font: { family: "'JetBrains Mono', monospace" }, callback: v => v + "%" },
            grid: { drawOnChartArea: false }
          }
        }
      }
    });

    // Multi-Region Table (fine-tuned column widths: ent=140px, metric=155px, annual=95px)
    let html = `<table class="data-table"><thead><tr>
      <th class="col-area-ent">Region / State</th>
      <th class="col-area-metric">Metric</th>
      ${years.map(y => `<th class="col-annual ${y >= 2026 ? 'cell-fcst' : ''}">${y}${y >= 2026 ? 'F' : ''}</th>`).join("")}
    </tr></thead><tbody>`;

    selectedEnts.forEach(ent => {
      const isReg = ent.includes("Malaysia") || ent.includes("Sabah & Sarawak");
      const rCls = isReg ? "row-subtotal" : "";

      // 0. Production Total row (above Mature Area, table-only as requested)
      html += `<tr class="${rCls}"><td class="sticky-col col-area-ent" rowspan="7" style="vertical-align:top;font-weight:700;">${ent}</td>
        <td class="col-area-metric" style="font-weight:700;color:#0f172a;">Production Total (T)</td>`;
      years.forEach(yr => {
        const yrStr = String(yr);
        const aProd = ffbStateHist[yrStr]?.entities?.[ent] || ffbStateHist[yr]?.entities?.[ent];
        const prodVal = aProd?.cpo_production;
        const isF = yr >= 2026;
        html += `<td class="num col-annual ${isF ? 'cell-fcst' : ''}" style="font-weight:700;color:#0f172a;">${fmtNum(prodVal, 0)}</td>`;
      });
      html += `</tr>`;

      // 1. Mature Area row
      html += `<tr class="${rCls}">
        <td class="col-area-metric">Mature Area (Ha)</td>`;
      years.forEach(yr => {
        const yrStr = String(yr);
        const obj = (yr >= 2011 && stArea[yrStr]?.[ent]) ? stArea[yrStr][ent] : regArea[yrStr]?.[ent];
        const isF = yr >= 2026;
        html += `<td class="num col-annual ${isF ? 'cell-fcst' : ''}">${fmtNum(obj?.mature_ha, 0)}</td>`;
      });
      html += `</tr>`;

      // 2. Immature Area row
      html += `<tr class="${rCls}"><td class="col-area-metric">Immature Area (Ha)</td>`;
      years.forEach(yr => {
        const yrStr = String(yr);
        const obj = (yr >= 2011 && stArea[yrStr]?.[ent]) ? stArea[yrStr][ent] : regArea[yrStr]?.[ent];
        const isF = yr >= 2026;
        html += `<td class="num col-annual ${isF ? 'cell-fcst' : ''}">${fmtNum(obj?.immature_ha, 0)}</td>`;
      });
      html += `</tr>`;

      // 3. Total Area (Ha)
      html += `<tr class="${rCls}"><td class="col-area-metric" style="font-weight:700;">Total Area (Ha)</td>`;
      years.forEach(yr => {
        const yrStr = String(yr);
        const obj = (yr >= 2011 && stArea[yrStr]?.[ent]) ? stArea[yrStr][ent] : regArea[yrStr]?.[ent];
        const isF = yr >= 2026;
        html += `<td class="num col-annual ${isF ? 'cell-fcst' : ''}" style="font-weight:700;">${fmtNum(obj?.total_ha, 0)}</td>`;
      });
      html += `</tr>`;

      // 4. % Mature row
      html += `<tr class="${rCls}"><td class="col-area-metric" style="color:#059669;font-weight:600;">% Mature</td>`;
      years.forEach(yr => {
        const yrStr = String(yr);
        const obj = (yr >= 2011 && stArea[yrStr]?.[ent]) ? stArea[yrStr][ent] : regArea[yrStr]?.[ent];
        const pct = obj?.mature_pct ?? (obj?.total_ha && obj?.mature_ha ? Number((obj.mature_ha / obj.total_ha * 100).toFixed(1)) : null);
        const isF = yr >= 2026;
        html += `<td class="num col-annual ${isF ? 'cell-fcst' : ''}" style="color:#059669;font-weight:600;">${pct !== null && pct !== undefined ? pct.toFixed(1) + '%' : '--'}</td>`;
      });
      html += `</tr>`;

      // 5. Annual FFB Yield row (RHS 1 metric)
      html += `<tr class="${rCls}"><td class="col-area-metric" style="color:#2563eb;font-weight:600;">FFB Yield (T/Ha)</td>`;
      years.forEach(yr => {
        const yrStr = String(yr);
        const aProd = ffbStateHist[yrStr]?.entities?.[ent] || ffbStateHist[yr]?.entities?.[ent];
        const yld = aProd?.ffb_yield;
        const isF = yr >= 2026;
        html += `<td class="num col-annual ${isF ? 'cell-fcst' : ''}" style="color:#2563eb;font-weight:700;">${fmtNum(yld, 2)}</td>`;
      });
      html += `</tr>`;

      // 6. Annual OER row (RHS 2 metric)
      html += `<tr class="${rCls}" style="border-bottom:2px solid var(--border-strong);"><td class="col-area-metric" style="color:#9333ea;font-weight:600;">OER (%)</td>`;
      years.forEach(yr => {
        const yrStr = String(yr);
        const aProd = ffbStateHist[yrStr]?.entities?.[ent] || ffbStateHist[yr]?.entities?.[ent];
        const oerVal = aProd?.oer;
        const isF = yr >= 2026;
        html += `<td class="num col-annual ${isF ? 'cell-fcst' : ''}" style="color:#9333ea;font-weight:700;">${oerVal !== null && oerVal !== undefined ? oerVal.toFixed(2) + '%' : '--'}</td>`;
      });
      html += `</tr>`;
    });

    html += `</tbody></table>`;
    container.innerHTML = html;

  } else if (STATE.areaViewMode === "states") {
    // All 12 States Matrix (2011 - 2027)
    const stYears = getSortedSelectedYears(2011, 2027);
    const allEnts = [...STATE.master.metadata.states, "Peninsular Malaysia", "Sabah & Sarawak", "Malaysia"];
    let html = `<table class="data-table"><thead><tr><th class="col-area-ent">State / Region</th>`;
    stYears.forEach(yr => {
      const isF = yr >= 2026;
      html += `<th colspan="3" style="text-align:center;" class="${isF ? 'cell-fcst' : ''}">${yr}${isF ? 'F' : ''}</th>`;
    });
    html += `</tr><tr><th class="col-area-ent"></th>`;
    stYears.forEach(yr => {
      const isF = yr >= 2026;
      html += `<th class="col-annual ${isF ? 'cell-fcst' : ''}">Mature</th><th class="col-annual ${isF ? 'cell-fcst' : ''}">Immature</th><th class="col-annual ${isF ? 'cell-fcst' : ''}">Total Ha</th>`;
    });
    html += `</tr></thead><tbody>`;

    allEnts.forEach(s => {
      const isReg = s.includes("Malaysia") || s.includes("Sabah & Sarawak");
      html += `<tr class="${isReg ? 'row-subtotal' : ''}"><td class="sticky-col col-area-ent">${s}</td>`;
      stYears.forEach(yr => {
        const yrStr = String(yr);
        const d = stArea[yrStr]?.[s] || {};
        const isF = yr >= 2026;
        html += `<td class="num col-annual ${isF ? 'cell-fcst' : ''}">${fmtNum(d.mature_ha)}</td>
                 <td class="num col-annual ${isF ? 'cell-fcst' : ''}">${fmtNum(d.immature_ha)}</td>
                 <td class="num col-annual ${isF ? 'cell-fcst' : ''}"><strong>${fmtNum(d.total_ha)}</strong></td>`;
      });
      html += `</tr>`;
    });
    html += `</tbody></table>`;
    container.innerHTML = html;

  } else {
    // Producer Category View (MOPS 2025 Table 1.4 & Table 1.5 + BEPI Area Summaries)
    const byYear = catArea.by_year || catArea;
    const byState2025 = catArea.by_state_2025 || [];
    const cYears = Object.keys(byYear).sort();
    const cats = ["Independent Smallholders", "Organised Smallholders", "Private & Govt Agency Estates"];
    const colors = ["#d97706", "#2563eb", "#059669"];

    document.getElementById("area-chart1-title").textContent = "2025 Oil Palm Planted Area by State & Producer Category (Hectares)";
    document.getElementById("area-table-title").textContent = "Distribution of Oil Palm Planted Area by Producer Category (Hectares & % Share)";

    const stateOnlyRows = byState2025.filter(r => !r.is_subtotal && !r.is_total);
    const ctx1 = document.getElementById("chart-area-stacked").getContext("2d");
    STATE.charts.areaStacked = new Chart(ctx1, {
      type: "bar",
      data: {
        labels: stateOnlyRows.length ? stateOnlyRows.map(r => r.entity) : cYears,
        datasets: stateOnlyRows.length
          ? [
              { label: "Independent Smallholders", data: stateOnlyRows.map(r => r.indep_ha), backgroundColor: "#d97706", stack: "cat" },
              { label: "Organised Smallholders", data: stateOnlyRows.map(r => r.org_ha), backgroundColor: "#2563eb", stack: "cat" },
              { label: "Private & Govt Agency Estates", data: stateOnlyRows.map(r => r.estates_ha), backgroundColor: "#059669", stack: "cat" }
            ]
          : cats.map((c, idx) => ({
              label: c,
              data: cYears.map(y => byYear[y]?.[c]?.hectares ?? byYear[y]?.[c]?.ha ?? null),
              backgroundColor: colors[idx],
              stack: "cat"
            }))
      },
      options: {
        ...chartOptionsCommon("Hectares"),
        scales: {
          x: { stacked: true, ticks: { color: "#64748b" } },
          y: { stacked: true, ticks: { color: "#64748b" } }
        }
      }
    });

    // Table 1: National Category Breakdown Across Available Census Years
    let html = `<div style="margin-bottom:16px;"><div style="font-weight:700;font-size:12px;color:#334155;padding:8px 12px;background:#f8fafc;border-bottom:1px solid #e2e8f0;">1. National Planted Area by Producer Category (MOPS Table 1.4 &amp; BEPI Area Summaries)</div>
    <table class="data-table"><thead><tr><th style="min-width:230px;width:230px;">Producer Category</th>`;
    cYears.forEach(y => { html += `<th class="col-annual">${y} (Ha)</th><th class="col-annual">${y} (%)</th>`; });
    html += `</tr></thead><tbody>`;
    [...cats, "Total"].forEach(c => {
      html += `<tr class="${c === 'Total' ? 'row-highlight' : ''}"><td class="sticky-col">${c}</td>`;
      cYears.forEach(y => {
        const d = byYear[y]?.[c] || {};
        const haVal = d.hectares ?? d.ha;
        const pctVal = d.share_pct ?? d.pct;
        html += `<td class="num col-annual">${fmtNum(haVal)}</td><td class="num col-annual">${pctVal != null ? Number(pctVal).toFixed(1) + '%' : '--'}</td>`;
      });
      html += `</tr>`;
    });
    html += `</tbody></table></div>`;

    // Table 2: 2025 State-by-State Distribution by Producer Category (MOPS 2025 Table 1.5)
    if (byState2025.length) {
      html += `<div><div style="font-weight:700;font-size:12px;color:#334155;padding:8px 12px;background:#f8fafc;border-top:1px solid #e2e8f0;border-bottom:1px solid #e2e8f0;">2. State-by-State Distribution by Producer Category — 2025 (MOPS Table 1.5)</div>
      <table class="data-table"><thead><tr>
        <th style="min-width:210px;width:210px;">State / Region</th>
        <th class="col-annual">Independent Smallholders (Ha)</th>
        <th class="col-annual">Indep. (%)</th>
        <th class="col-annual">Organised Smallholders (Ha)</th>
        <th class="col-annual">Organised (%)</th>
        <th class="col-annual">Private &amp; Govt Estates (Ha)</th>
        <th class="col-annual">Estates (%)</th>
        <th class="col-annual">Total Planted Area (Ha)</th>
      </tr></thead><tbody>`;
      byState2025.forEach(r => {
        const cls = r.is_total ? "row-highlight" : r.is_subtotal ? "row-subtotal" : "";
        const tot = r.total_ha || 1;
        const pInd = ((r.indep_ha / tot) * 100).toFixed(1) + "%";
        const pOrg = ((r.org_ha / tot) * 100).toFixed(1) + "%";
        const pEst = ((r.estates_ha / tot) * 100).toFixed(1) + "%";
        html += `<tr class="${cls}">
          <td class="sticky-col">${r.entity}</td>
          <td class="num col-annual">${fmtNum(r.indep_ha)}</td>
          <td class="num col-annual">${pInd}</td>
          <td class="num col-annual">${fmtNum(r.org_ha)}</td>
          <td class="num col-annual">${pOrg}</td>
          <td class="num col-annual">${fmtNum(r.estates_ha)}</td>
          <td class="num col-annual">${pEst}</td>
          <td class="num col-annual"><strong>${fmtNum(r.total_ha)}</strong></td>
        </tr>`;
      });
      html += `</tbody></table></div>`;
    }

    container.innerHTML = html;
  }
}

const PROD_ATTR_META = {
  cpo_production: { label: "CPO Production", unit: "(Tonnes)", decimals: 0 },
  ffb_yield: { label: "FFB Yield", unit: "(T/Ha)", decimals: 2 },
  cpo_yield: { label: "CPO Yield", unit: "(T/Ha)", decimals: 4 },
  oer: { label: "Oil Extraction Rate", unit: "(%)", decimals: 2 },
  derived_hectarage: { label: "Implied Area [Prod ÷ Yield]", unit: "(Ha)", decimals: 0 }
};

// Implied area / official mature area. Near 1.0 = production and yield cover the same land (Sabah, Sarawak);
// far from 1.0 = mill catchment differs from planted area (cross-state FFB flows, yield coverage).
function fmtAreaRatio(ent) {
  if (!ent?.derived_hectarage || !ent?.official_mature_ha) return '<span class="text-muted">N/A</span>';
  const r = ent.derived_hectarage / ent.official_mature_ha;
  const off = Math.abs(r - 1) > 0.1;
  return `<span style="${off ? 'color:#d97706;font-weight:700;' : ''}">${r.toFixed(2)}×</span>`;
}

function renderProdTab() {
  const attr = STATE.prodAttr;
  const meta = PROD_ATTR_META[attr];
  document.getElementById("prod-matrix-title").textContent = `State Breakdown Matrix: ${meta.label}`;

  const years = getSortedSelectedYears(1975, 2027);
  const prodAnn = STATE.master.production.annual;
  const prodMon = STATE.master.production.monthly;
  const entities = STATE.master.metadata.entities;

  // Build State x Year Expandable Matrix
  let html = `<table class="data-table"><thead><tr><th style="min-width:200px;width:200px;">State / Region</th>`;
  for (const yr of years) {
    const canExp = yr >= 2005;
    const isExp = canExp && STATE.prodExpandedYears.has(yr);
    if (isExp) {
      for (let m = 1; m <= 12; m++) {
        const isF = (yr === 2026 && m >= 10) || yr === 2027;
        html += `<th class="${isF ? 'cell-fcst' : ''}">${MONTH_SHORT[m - 1]} ${String(yr).slice(2)}${isF ? 'F' : ''}</th>`;
      }
    }
    html += `<th class="col-year-header col-annual" data-year="${yr}">
      ${canExp ? `<span class="expand-toggle">${isExp ? "&minus;" : "+"}</span>` : ''}${yr}${yr >= 2026 ? 'F' : ''}
    </th>`;
    if (attr === "derived_hectarage") {
      html += `<th class="col-derived-ha">${yr} Official Mature Ha</th>`;
      html += `<th class="col-derived-ha" title="Implied area ÷ official mature area. Amber = more than 10% away from 1.0">${yr} Implied ÷ Official</th>`;
    }
  }
  html += `</tr></thead><tbody>`;

  for (const ent of entities) {
    const isReg = ent === "Peninsular Malaysia" || ent === "Sabah & Sarawak" || ent === "Malaysia";
    const rCls = ent === "Malaysia" ? "row-highlight" : isReg ? "row-subtotal" : "";
    html += `<tr class="${rCls}"><td class="sticky-col">${ent}</td>`;

    for (const yr of years) {
      const canExp = yr >= 2005;
      const isExp = canExp && STATE.prodExpandedYears.has(yr);
      if (isExp) {
        for (let m = 1; m <= 12; m++) {
          const p = `${yr}-${String(m).padStart(2, "0")}`;
          const mEnt = prodMon[p]?.entities?.[ent];
          const val = mEnt ? mEnt[attr] : null;
          const isF = prodMon[p]?.is_forecast;
          html += `<td class="num ${isF ? 'cell-fcst' : ''}">${fmtNum(val, meta.decimals)}</td>`;
        }
      }
      const aEnt = prodAnn[yr]?.entities?.[ent];
      const aVal = aEnt ? aEnt[attr] : null;
      html += `<td class="num col-annual ${yr >= 2026 ? 'cell-fcst' : ''}">${fmtNum(aVal, meta.decimals)}</td>`;
      if (attr === "derived_hectarage") {
        html += `<td class="num col-derived-ha" style="color:#059669;font-weight:700;">${fmtNum(aEnt?.official_mature_ha, 0)}</td>`;
        html += `<td class="num col-derived-ha">${fmtAreaRatio(aEnt)}</td>`;
      }
    }
    html += `</tr>`;
  }
  html += `</tbody></table>`;

  const container = document.getElementById("prod-matrix-container");
  container.innerHTML = html;
  container.querySelectorAll(".col-year-header").forEach(th => {
    th.addEventListener("click", () => {
      const yr = Number(th.dataset.year);
      if (yr < 2005) return;
      if (STATE.prodExpandedYears.has(yr)) STATE.prodExpandedYears.delete(yr);
      else STATE.prodExpandedYears.add(yr);
      renderProdTab();
    });
  });

  renderProdChartsAndWeather();
}

function renderProdChartsAndWeather() {
  destroyChart("prodState");
  destroyChart("prodWeather");

  const st = STATE.prodState;
  const mYears = getSortedSelectedYears(2005, 2027);
  const useYears = mYears.length ? mYears : [2023, 2024, 2025, 2026, 2027];
  const prodMon = STATE.master.production.monthly;
  const wMon = STATE.master.weather.monthly;

  const labels = [];
  const cpoData = [];
  const derHaData = [];
  const offHaData = [];
  const ffbYieldData = [];
  const rainData = [];
  const smData = [];

  for (const yr of useYears) {
    for (let m = 1; m <= 12; m++) {
      const p = `${yr}-${String(m).padStart(2, "0")}`;
      const ed = prodMon[p]?.entities?.[st];
      if (!ed) continue;
      labels.push(`${MONTH_SHORT[m - 1]} ${String(yr).slice(2)}${prodMon[p].is_forecast ? 'F' : ''}`);
      cpoData.push(ed.cpo_production);
      derHaData.push(ed.derived_hectarage);
      offHaData.push(ed.official_mature_ha);
      ffbYieldData.push(ed.ffb_yield);

      const wd = wMon[p]?.states?.[st] || {};
      rainData.push(wd.rainfall_mm ?? null);
      smData.push(wd.soil_moisture_m3m3 ? Number((wd.soil_moisture_m3m3 * 100).toFixed(1)) : null);
    }
  }

  document.getElementById("prod-chart1-title").textContent = `${st}: Monthly CPO Production & Implied Area [Prod ÷ Yield] vs Official Mature Area`;
  const ctx1 = document.getElementById("chart-prod-state").getContext("2d");
  STATE.charts.prodState = new Chart(ctx1, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          type: "bar",
          label: "CPO Production (T)",
          data: cpoData,
          backgroundColor: "rgba(16, 185, 129, 0.72)",
          yAxisID: "y"
        },
        {
          type: "line",
          label: "Implied Area [Prod ÷ CPO Yield, actual months only] (Ha)",
          data: derHaData,
          borderColor: "#60a5fa",
          borderWidth: 2,
          pointRadius: 1.5,
          tension: 0.25,
          yAxisID: "y1"
        },
        {
          type: "line",
          label: "Official MPOB Mature Area (Ha)",
          data: offHaData,
          borderColor: "#f59e0b",
          borderDash: [5, 4],
          borderWidth: 2,
          pointRadius: 0,
          yAxisID: "y1"
        }
      ]
    },
    options: {
      ...chartOptionsCommon("Tonnes"),
      scales: {
        x: { ticks: { color: "#94a3b8", maxTicksLimit: 18 }, grid: { color: "rgba(148,163,184,0.08)" } },
        y: { position: "left", title: { display: true, text: "Production (T)", color: "#10b981" }, ticks: { color: "#94a3b8" } },
        y1: { position: "right", title: { display: true, text: "Hectares (Ha)", color: "#60a5fa" }, ticks: { color: "#94a3b8" }, grid: { drawOnChartArea: false } }
      }
    }
  });

  document.getElementById("prod-chart2-title").textContent = `${st}: FFB Yield vs ECMWF Monthly Rainfall & Soil Moisture`;
  const ctx2 = document.getElementById("chart-prod-weather").getContext("2d");
  STATE.charts.prodWeather = new Chart(ctx2, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          type: "line",
          label: "FFB Yield (T/Ha)",
          data: ffbYieldData,
          borderColor: "#10b981",
          borderWidth: 2.3,
          pointRadius: 2,
          tension: 0.25,
          yAxisID: "y"
        },
        {
          type: "line",
          label: "Soil Moisture (0-28cm %)",
          data: smData,
          borderColor: "#a855f7",
          borderWidth: 1.8,
          pointRadius: 0,
          tension: 0.3,
          yAxisID: "y1"
        },
        {
          type: "bar",
          label: "ECMWF Monthly Rainfall (mm)",
          data: rainData,
          backgroundColor: "rgba(59, 130, 246, 0.45)",
          yAxisID: "y1"
        }
      ]
    },
    options: {
      ...chartOptionsCommon("FFB Yield (T/Ha)"),
      scales: {
        x: { ticks: { color: "#94a3b8", maxTicksLimit: 18 } },
        y: { position: "left", title: { display: true, text: "FFB Yield (T/Ha)", color: "#10b981" }, ticks: { color: "#94a3b8" } },
        y1: { position: "right", title: { display: true, text: "Rainfall (mm) / Soil Moisture", color: "#60a5fa" }, ticks: { color: "#94a3b8" }, grid: { drawOnChartArea: false } }
      }
    }
  });

  // Weather & Model Drivers Table for Forecast Horizon
  const fcstPeriods = STATE.master.metadata.forecast_periods || [];
  let wHtml = `<table class="data-table table-weather"><thead><tr>
    <th>Forecast Month</th>
    <th>${st} Model FFB Yield (T/Ha)</th>
    <th>${st} Model OER (%)</th>
    <th>${st} Model CPO Yield (T/Ha)</th>
    <th>Dry-Month Anom, 6-12m Lag (pp)</th>
    <th>El Niño Factor (8-11m Lag RONI)</th>
    <th>Weather Yield Multiplier</th>
    <th>${st} Model Production F (T)</th>
    <th>Mature Area, Official 2025 + Trend (Ha)</th>
  </tr></thead><tbody>`;

  fcstPeriods.forEach(p => {
    const ed = prodMon[p]?.entities?.[st] || {};
    wHtml += `<tr>
      <td class="sticky-col">${p} <span class="badge badge-fcst">F</span></td>
      <td class="num cell-fcst">${fmtNum(ed.ffb_yield, 2)}</td>
      <td class="num cell-fcst">${fmtNum(ed.oer, 2)}%</td>
      <td class="num cell-fcst">${fmtNum(ed.cpo_yield, 4)}</td>
      <td class="num">${fmtDelta(ed.dry_6_12_anom_pp, 1)}</td>
      <td class="num">${ed.enso_factor ? ed.enso_factor.toFixed(3) + 'x' : '--'}</td>
      <td class="num"><strong>${ed.weather_multiplier ? ed.weather_multiplier.toFixed(4) + 'x' : '--'}</strong></td>
      <td class="num cell-fcst"><strong>${fmtNum(ed.cpo_production, 0)}</strong></td>
      <td class="num cell-calc">${fmtNum(ed.official_mature_ha, 0)}</td>
    </tr>`;
  });
  wHtml += `</tbody></table>`;
  document.getElementById("prod-weather-table-container").innerHTML = wHtml;
}

// ===========================================================================
// TAB 4: MY PRODUCTION & S&D FORECAST (INTERACTIVE FORECAST WORKSPACE)
// ===========================================================================
function renderMyForecastTab() {
  renderMyForecastSndTable();
  renderMyForecastCharts();
  renderMyForecastPathTables();
}

function renderMyForecastSndTable() {
  const fcstPeriods = STATE.master.metadata.forecast_periods || [];
  const modelData = getEffectiveSndData("model").monthly;
  const userData = getEffectiveSndData("user").monthly;
  const uAnn = getEffectiveSndData("user").annual;
  const mAnn = getEffectiveSndData("model").annual;

  // Split into 2026 forecast months (Oct-Dec) and 2027 forecast months (Jan-Dec)
  const m26 = ["2026-10", "2026-11", "2026-12"];
  const m27 = fcstPeriods.filter(p => p.startsWith("2027-"));

  let html = `<table class="data-table" id="my-fcst-main-table"><thead><tr>
    <th style="min-width:200px;width:200px;">S&amp;D Attribute (Tonnes)</th>
    ${m26.map(p => `<th class="cell-user-fcst">${MONTH_SHORT[Number(p.slice(5)) - 1]} 26F</th>`).join("")}
    <th class="col-annual">2026F My Total</th>
    <th class="col-annual">2026F Model</th>
    <th class="col-annual col-delta">2026F Delta</th>
    ${m27.map(p => `<th class="cell-user-fcst">${MONTH_SHORT[Number(p.slice(5)) - 1]} 27F</th>`).join("")}
    <th class="col-annual">2027F My Total</th>
    <th class="col-annual">2027F Model</th>
    <th class="col-annual col-delta">2027F Delta</th>
  </tr></thead><tbody>`;

  const editableKeys = new Set(["production", "import", "export", "local_disappearance"]);

  SND_ROWS.forEach(rowDef => {
    const isEditable = editableKeys.has(rowDef.key);
    const isStock = rowDef.key === "opening_stock" || rowDef.key === "end_stock";
    const rCls = rowDef.key === 'end_stock' ? 'row-highlight' : '';

    html += `<tr class="${rCls}">
      <td class="sticky-col">
        <strong>${rowDef.label}</strong>
        ${isStock ? ' <span class="badge badge-calc">[Formula]</span>' : ' <span class="badge badge-user">[Editable]</span>'}
      </td>`;

    // 2026 Forecast Months (Oct, Nov, Dec)
    m26.forEach(p => {
      const uRec = userData[p];
      if (!isEditable) {
        html += `<td class="num cell-calc" data-cell="mon" data-period="${p}" data-key="${rowDef.key}"><strong>${fmtNum(uRec[rowDef.key], 0)}</strong></td>`;
      } else {
        html += `<td class="num cell-user-fcst">
          <input type="number" step="1000" class="cell-edit-input snd-user-input"
                 data-period="${p}" data-key="${rowDef.key}" value="${Math.round(uRec[rowDef.key])}" />
        </td>`;
      }
    });

    // 2026 Full Year Columns (My Total, Model, Delta)
    const myVal26 = uAnn[2026][rowDef.key];
    const modVal26 = mAnn[2026][rowDef.key];
    const diff26 = myVal26 - modVal26;
    html += `<td class="num" style="font-weight:700" data-cell="ann-my-26" data-key="${rowDef.key}">${fmtNum(myVal26, 0)}</td>
             <td class="num" data-cell="ann-mod-26" data-key="${rowDef.key}">${fmtNum(modVal26, 0)}</td>
             <td class="num col-delta" data-cell="ann-delta-26" data-key="${rowDef.key}">${fmtDelta(diff26, 0)}</td>`;

    // 2027 Forecast Months (Jan..Dec)
    m27.forEach(p => {
      const uRec = userData[p];
      if (!isEditable) {
        html += `<td class="num cell-calc" data-cell="mon" data-period="${p}" data-key="${rowDef.key}"><strong>${fmtNum(uRec[rowDef.key], 0)}</strong></td>`;
      } else {
        html += `<td class="num cell-user-fcst">
          <input type="number" step="1000" class="cell-edit-input snd-user-input"
                 data-period="${p}" data-key="${rowDef.key}" value="${Math.round(uRec[rowDef.key])}" />
        </td>`;
      }
    });

    // 2027 Full Year Columns (My Total, Model, Delta)
    const myVal27 = uAnn[2027][rowDef.key];
    const modVal27 = mAnn[2027][rowDef.key];
    const diff27 = myVal27 - modVal27;
    html += `<td class="num" style="font-weight:700" data-cell="ann-my-27" data-key="${rowDef.key}">${fmtNum(myVal27, 0)}</td>
             <td class="num" data-cell="ann-mod-27" data-key="${rowDef.key}">${fmtNum(modVal27, 0)}</td>
             <td class="num col-delta" data-cell="ann-delta-27" data-key="${rowDef.key}">${fmtDelta(diff27, 0)}</td></tr>`;
  });

  // Add Stocks-to-Use Ratio (%) row
  const uRatio26 = (uAnn[2026].end_stock / (uAnn[2026].export + uAnn[2026].local_disappearance)) * 100;
  const mRatio26 = (mAnn[2026].end_stock / (mAnn[2026].export + mAnn[2026].local_disappearance)) * 100;
  const uRatio27 = (uAnn[2027].end_stock / (uAnn[2027].export + uAnn[2027].local_disappearance)) * 100;
  const mRatio27 = (mAnn[2027].end_stock / (mAnn[2027].export + mAnn[2027].local_disappearance)) * 100;

  html += `<tr class="row-subtotal">
    <td class="sticky-col"><strong>Stocks-to-Use Ratio (%)</strong> <span class="badge badge-calc">[Calc]</span></td>`;
  m26.forEach(p => {
    const r = (userData[p].end_stock / (userData[p].export + userData[p].local_disappearance)) * 100;
    html += `<td class="num" data-cell="mon-ratio" data-period="${p}"><strong>${r.toFixed(1)}%</strong></td>`;
  });
  html += `<td class="num" style="font-weight:700" data-cell="ann-my-ratio-26">${uRatio26.toFixed(1)}%</td>
           <td class="num" data-cell="ann-mod-ratio-26">${mRatio26.toFixed(1)}%</td>
           <td class="num col-delta" data-cell="ann-delta-ratio-26">${fmtDelta(uRatio26 - mRatio26, 1)}%</td>`;
  m27.forEach(p => {
    const r = (userData[p].end_stock / (userData[p].export + userData[p].local_disappearance)) * 100;
    html += `<td class="num" data-cell="mon-ratio" data-period="${p}"><strong>${r.toFixed(1)}%</strong></td>`;
  });
  html += `<td class="num" style="font-weight:700" data-cell="ann-my-ratio-27">${uRatio27.toFixed(1)}%</td>
           <td class="num" data-cell="ann-mod-ratio-27">${mRatio27.toFixed(1)}%</td>
           <td class="num col-delta" data-cell="ann-delta-ratio-27">${fmtDelta(uRatio27 - mRatio27, 1)}%</td></tr>`;

  html += `</tbody></table>`;
  const container = document.getElementById("my-fcst-snd-container");
  container.innerHTML = html;

  // Real-time live calculation on input and change
  container.querySelectorAll(".snd-user-input").forEach(inp => {
    const updateHandler = () => {
      const p = inp.dataset.period;
      const k = inp.dataset.key;
      const val = Number(inp.value) || 0;
      if (!STATE.userForecast.snd) STATE.userForecast.snd = {};
      if (!STATE.userForecast.snd[p]) STATE.userForecast.snd[p] = { period: p };
      STATE.userForecast.snd[p][k] = val;
      localStorage.setItem("my_forecast_malaysia_palm", JSON.stringify(STATE.userForecast));
      
      // Update DOM cells in place so cursor focus is never lost
      updateMyForecastDomInPlace();
      renderMyForecastCharts();
      renderMyForecastPathTables();
    };

    inp.addEventListener("input", updateHandler);
    inp.addEventListener("change", updateHandler);
  });
}

function updateMyForecastDomInPlace() {
  const userData = getEffectiveSndData("user").monthly;
  const uAnn = getEffectiveSndData("user").annual;
  const mAnn = getEffectiveSndData("model").annual;

  // Update formula monthly cells (opening stock, end stock)
  document.querySelectorAll('#my-fcst-main-table [data-cell="mon"]').forEach(td => {
    const p = td.dataset.period;
    const k = td.dataset.key;
    if (userData[p] && userData[p][k] !== undefined) {
      td.innerHTML = `<strong>${fmtNum(userData[p][k], 0)}</strong>`;
    }
  });

  // Update monthly stocks-to-use ratio cells
  document.querySelectorAll('#my-fcst-main-table [data-cell="mon-ratio"]').forEach(td => {
    const p = td.dataset.period;
    if (userData[p]) {
      const r = (userData[p].end_stock / (userData[p].export + userData[p].local_disappearance)) * 100;
      td.innerHTML = `<strong>${r.toFixed(1)}%</strong>`;
    }
  });

  // Update annual cells
  ["production", "import", "export", "local_disappearance", "opening_stock", "end_stock"].forEach(k => {
    const tdMy26 = document.querySelector(`#my-fcst-main-table [data-cell="ann-my-26"][data-key="${k}"]`);
    if (tdMy26) tdMy26.textContent = fmtNum(uAnn[2026][k], 0);

    const tdDelta26 = document.querySelector(`#my-fcst-main-table [data-cell="ann-delta-26"][data-key="${k}"]`);
    if (tdDelta26) tdDelta26.innerHTML = fmtDelta(uAnn[2026][k] - mAnn[2026][k], 0);

    const tdMy27 = document.querySelector(`#my-fcst-main-table [data-cell="ann-my-27"][data-key="${k}"]`);
    if (tdMy27) tdMy27.textContent = fmtNum(uAnn[2027][k], 0);

    const tdDelta27 = document.querySelector(`#my-fcst-main-table [data-cell="ann-delta-27"][data-key="${k}"]`);
    if (tdDelta27) tdDelta27.innerHTML = fmtDelta(uAnn[2027][k] - mAnn[2027][k], 0);
  });

  // Update annual ratios
  const uRatio26 = (uAnn[2026].end_stock / (uAnn[2026].export + uAnn[2026].local_disappearance)) * 100;
  const mRatio26 = (mAnn[2026].end_stock / (mAnn[2026].export + mAnn[2026].local_disappearance)) * 100;
  const uRatio27 = (uAnn[2027].end_stock / (uAnn[2027].export + uAnn[2027].local_disappearance)) * 100;
  const mRatio27 = (mAnn[2027].end_stock / (mAnn[2027].export + mAnn[2027].local_disappearance)) * 100;

  const tdMyR26 = document.querySelector('#my-fcst-main-table [data-cell="ann-my-ratio-26"]');
  if (tdMyR26) tdMyR26.textContent = uRatio26.toFixed(1) + "%";
  const tdDelR26 = document.querySelector('#my-fcst-main-table [data-cell="ann-delta-ratio-26"]');
  if (tdDelR26) tdDelR26.innerHTML = fmtDelta(uRatio26 - mRatio26, 1) + "%";

  const tdMyR27 = document.querySelector('#my-fcst-main-table [data-cell="ann-my-ratio-27"]');
  if (tdMyR27) tdMyR27.textContent = uRatio27.toFixed(1) + "%";
  const tdDelR27 = document.querySelector('#my-fcst-main-table [data-cell="ann-delta-ratio-27"]');
  if (tdDelR27) tdDelR27.innerHTML = fmtDelta(uRatio27 - mRatio27, 1) + "%";
}

function renderMyForecastPathTables() {
  const container = document.getElementById("my-fcst-path-tables-container");
  if (!container) return;

  const fcstPeriods = STATE.master.metadata.forecast_periods || [];
  const modelData = getEffectiveSndData("model").monthly;
  const userData = getEffectiveSndData("user").monthly;
  const uAnn = getEffectiveSndData("user").annual;
  const mAnn = getEffectiveSndData("model").annual;

  const m26 = ["2026-10", "2026-11", "2026-12"];
  const m27 = fcstPeriods.filter(p => p.startsWith("2027-"));

  const pathDefs = [
    { key: "production", title: "1. CPO Production Path (Tonnes)" },
    { key: "import", title: "2. Palm Oil Imports Path (Tonnes)" },
    { key: "export", title: "3. Palm Oil Exports Path (Tonnes)" },
    { key: "local_disappearance", title: "4. Local Disappearance Path (Tonnes)" },
    { key: "end_stock", title: "5. End Stock Path (Tonnes)", isStock: true },
    { key: "stocks_to_use", title: "6. Stocks-to-Use Ratio Path (%)", isRatio: true }
  ];

  let html = "";
  pathDefs.forEach(pDef => {
    html += `<div class="path-card">
      <div class="path-card-title">
        <span>${pDef.title}</span>
      </div>
      <div class="table-scroll">
        <table class="data-table">
          <thead>
            <tr>
              <th style="min-width:180px;width:180px;">Series</th>
              ${m26.map(p => `<th>${MONTH_SHORT[Number(p.slice(5)) - 1]} 26F</th>`).join("")}
              <th class="col-annual">2026F Full Year</th>
              ${m27.map(p => `<th>${MONTH_SHORT[Number(p.slice(5)) - 1]} 27F</th>`).join("")}
              <th class="col-annual">2027F Full Year</th>
            </tr>
          </thead>
          <tbody>`;

    if (pDef.isRatio) {
      const uR26 = (uAnn[2026].end_stock / (uAnn[2026].export + uAnn[2026].local_disappearance)) * 100;
      const mR26 = (mAnn[2026].end_stock / (mAnn[2026].export + mAnn[2026].local_disappearance)) * 100;
      const uR27 = (uAnn[2027].end_stock / (uAnn[2027].export + uAnn[2027].local_disappearance)) * 100;
      const mR27 = (mAnn[2027].end_stock / (mAnn[2027].export + mAnn[2027].local_disappearance)) * 100;

      // Row 1: My Forecast
      html += `<tr><td class="sticky-col" style="color:#7e22ce;font-weight:700;">My Forecast</td>`;
      m26.forEach(p => {
        const r = (userData[p].end_stock / (userData[p].export + userData[p].local_disappearance)) * 100;
        html += `<td class="num"><strong>${r.toFixed(1)}%</strong></td>`;
      });
      html += `<td class="num col-annual"><strong>${uR26.toFixed(1)}%</strong></td>`;
      m27.forEach(p => {
        const r = (userData[p].end_stock / (userData[p].export + userData[p].local_disappearance)) * 100;
        html += `<td class="num"><strong>${r.toFixed(1)}%</strong></td>`;
      });
      html += `<td class="num col-annual"><strong>${uR27.toFixed(1)}%</strong></td></tr>`;

      // Row 2: Model Forecast
      html += `<tr><td class="sticky-col" style="color:#059669;font-weight:600;">Model Forecast</td>`;
      m26.forEach(p => {
        const r = (modelData[p].end_stock / (modelData[p].export + modelData[p].local_disappearance)) * 100;
        html += `<td class="num">${r.toFixed(1)}%</td>`;
      });
      html += `<td class="num col-annual">${mR26.toFixed(1)}%</td>`;
      m27.forEach(p => {
        const r = (modelData[p].end_stock / (modelData[p].export + modelData[p].local_disappearance)) * 100;
        html += `<td class="num">${r.toFixed(1)}%</td>`;
      });
      html += `<td class="num col-annual">${mR27.toFixed(1)}%</td></tr>`;

      // Row 3: Delta
      html += `<tr class="row-subtotal"><td class="sticky-col"><strong>&Delta; (My &minus; Model)</strong></td>`;
      m26.forEach(p => {
        const ur = (userData[p].end_stock / (userData[p].export + userData[p].local_disappearance)) * 100;
        const mr = (modelData[p].end_stock / (modelData[p].export + modelData[p].local_disappearance)) * 100;
        html += `<td class="num col-delta">${fmtDelta(ur - mr, 1)}%</td>`;
      });
      html += `<td class="num col-annual col-delta">${fmtDelta(uR26 - mR26, 1)}%</td>`;
      m27.forEach(p => {
        const ur = (userData[p].end_stock / (userData[p].export + userData[p].local_disappearance)) * 100;
        const mr = (modelData[p].end_stock / (modelData[p].export + modelData[p].local_disappearance)) * 100;
        html += `<td class="num col-delta">${fmtDelta(ur - mr, 1)}%</td>`;
      });
      html += `<td class="num col-annual col-delta">${fmtDelta(uR27 - mR27, 1)}%</td></tr>`;

    } else {
      const k = pDef.key;
      // Row 1: My Forecast
      html += `<tr><td class="sticky-col" style="color:#7e22ce;font-weight:700;">My Forecast</td>`;
      m26.forEach(p => {
        html += `<td class="num"><strong>${fmtNum(userData[p][k], 0)}</strong></td>`;
      });
      html += `<td class="num col-annual"><strong>${fmtNum(uAnn[2026][k], 0)}</strong></td>`;
      m27.forEach(p => {
        html += `<td class="num"><strong>${fmtNum(userData[p][k], 0)}</strong></td>`;
      });
      html += `<td class="num col-annual"><strong>${fmtNum(uAnn[2027][k], 0)}</strong></td></tr>`;

      // Row 2: Model Forecast
      html += `<tr><td class="sticky-col" style="color:#059669;font-weight:600;">Model Forecast</td>`;
      m26.forEach(p => {
        html += `<td class="num">${fmtNum(modelData[p][k], 0)}</td>`;
      });
      html += `<td class="num col-annual">${fmtNum(mAnn[2026][k], 0)}</td>`;
      m27.forEach(p => {
        html += `<td class="num">${fmtNum(modelData[p][k], 0)}</td>`;
      });
      html += `<td class="num col-annual">${fmtNum(mAnn[2027][k], 0)}</td></tr>`;

      // Row 3: Delta (My - Model)
      html += `<tr class="row-subtotal"><td class="sticky-col"><strong>&Delta; (My &minus; Model)</strong></td>`;
      m26.forEach(p => {
        const diff = userData[p][k] - modelData[p][k];
        html += `<td class="num col-delta">${fmtDelta(diff, 0)}</td>`;
      });
      html += `<td class="num col-annual col-delta">${fmtDelta(uAnn[2026][k] - mAnn[2026][k], 0)}</td>`;
      m27.forEach(p => {
        const diff = userData[p][k] - modelData[p][k];
        html += `<td class="num col-delta">${fmtDelta(diff, 0)}</td>`;
      });
      html += `<td class="num col-annual col-delta">${fmtDelta(uAnn[2027][k] - mAnn[2027][k], 0)}</td></tr>`;
    }

    html += `</tbody></table></div></div>`;
  });

  container.innerHTML = html;
}

function applyFrontMonthProdTracker() {
  const targetP = document.getElementById("tracker-target-period").value;
  const mpoa = parseFloat(document.getElementById("input-mpoa-mom").value);
  const sppoma = parseFloat(document.getElementById("input-sppoma-mom").value);
  const valid = [mpoa, sppoma].filter(x => !Number.isNaN(x));
  if (valid.length === 0) return;

  const momPct = (!Number.isNaN(mpoa) && !Number.isNaN(sppoma))
    ? (0.7 * mpoa + 0.3 * sppoma)
    : valid[0];

  const userSnd = getEffectiveSndData("user").monthly;
  const allPeriods = Object.keys(userSnd).sort();
  const idx = allPeriods.indexOf(targetP);
  if (idx <= 0) return;
  const prevP = allPeriods[idx - 1];
  const prevProd = userSnd[prevP].production;
  const newProd = Math.round(prevProd * (1 + momPct / 100.0));

  if (!STATE.userForecast.snd) STATE.userForecast.snd = {};
  if (!STATE.userForecast.snd[targetP]) STATE.userForecast.snd[targetP] = { period: targetP };
  STATE.userForecast.snd[targetP].production = newProd;
  localStorage.setItem("my_forecast_malaysia_palm", JSON.stringify(STATE.userForecast));
  document.getElementById("fcst-save-status").textContent = `Applied ${momPct.toFixed(2)}% MoM to ${targetP} Production (${fmtNum(newProd)} T)`;
  renderMyForecastTab();
}

function applyFrontMonthExpTracker() {
  const targetP = document.getElementById("tracker-target-period").value;
  const its = parseFloat(document.getElementById("input-its-mom").value);
  const amspec = parseFloat(document.getElementById("input-amspec-mom").value);
  const sgs = parseFloat(document.getElementById("input-sgs-mom").value);
  const valid = [its, amspec, sgs].filter(x => !Number.isNaN(x));
  if (valid.length === 0) return;

  const avgMom = valid.reduce((a, b) => a + b, 0) / valid.length;
  const userSnd = getEffectiveSndData("user").monthly;
  const allPeriods = Object.keys(userSnd).sort();
  const idx = allPeriods.indexOf(targetP);
  if (idx <= 0) return;
  const prevP = allPeriods[idx - 1];
  const prevExp = userSnd[prevP].export;
  const newExp = Math.round(prevExp * (1 + avgMom / 100.0));

  if (!STATE.userForecast.snd) STATE.userForecast.snd = {};
  if (!STATE.userForecast.snd[targetP]) STATE.userForecast.snd[targetP] = { period: targetP };
  STATE.userForecast.snd[targetP].export = newExp;
  localStorage.setItem("my_forecast_malaysia_palm", JSON.stringify(STATE.userForecast));
  document.getElementById("fcst-save-status").textContent = `Applied Cargo Surveyor Avg (${avgMom.toFixed(2)}% MoM) to ${targetP} Export (${fmtNum(newExp)} T)`;
  renderMyForecastTab();
}

async function saveUserForecastToServer() {
  const statusEl = document.getElementById("fcst-save-status");
  statusEl.textContent = "Saving...";
  try {
    localStorage.setItem("my_forecast_malaysia_palm", JSON.stringify(STATE.userForecast));
    if (window.location.protocol.startsWith("http")) {
      await fetch("/api/user-forecast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_forecast: STATE.userForecast })
      });
    }
    statusEl.textContent = "Saved to your browser!";
    setTimeout(() => { statusEl.textContent = ""; }, 3500);
  } catch (e) {
    statusEl.textContent = "Saved locally!";
    setTimeout(() => { statusEl.textContent = ""; }, 3500);
  }
}

async function resetUserForecast(mode) {
  const statusEl = document.getElementById("fcst-save-status");
  const defaults = STATE.master.user_forecast_defaults || {};

  if (mode === "model") {
    const modelCopy = JSON.parse(JSON.stringify(defaults));
    for (const [p, m_sd] of Object.entries(STATE.master.snd.monthly)) {
      if (m_sd.is_forecast && modelCopy.snd && modelCopy.snd[p]) {
        modelCopy.snd[p].production = m_sd.production;
        modelCopy.snd[p].import = m_sd.import;
        modelCopy.snd[p].export = m_sd.export;
        modelCopy.snd[p].local_disappearance = m_sd.local_disappearance;
      }
    }
    STATE.userForecast = modelCopy;
    statusEl.textContent = "Copied Model Forecast into My Forecast!";
  } else {
    STATE.userForecast = JSON.parse(JSON.stringify(defaults));
    statusEl.textContent = "Reset to Malaysia SND.xlsx Forecast Baseline!";
  }

  localStorage.setItem("my_forecast_malaysia_palm", JSON.stringify(STATE.userForecast));
  renderMyForecastTab();
  setTimeout(() => { statusEl.textContent = ""; }, 3500);
}

function renderMyForecastCharts() {
  destroyChart("myVsModelStock");

  const modelSnd = getEffectiveSndData("model").monthly;
  const userSnd = getEffectiveSndData("user").monthly;
  const periods = Object.keys(modelSnd).filter(p => p >= "2026-01").sort();

  const labels = periods.map(p => `${p}${modelSnd[p].is_forecast ? 'F' : ''}`);
  const mStk = periods.map(p => modelSnd[p].end_stock);
  const uStk = periods.map(p => userSnd[p].end_stock);

  const canvas = document.getElementById("chart-my-vs-model-stock");
  if (!canvas) return;
  const ctx1 = canvas.getContext("2d");
  STATE.charts.myVsModelStock = new Chart(ctx1, {
    type: "line",
    data: {
      labels,
      datasets: [
        { label: "Model Forecast End Stock (T)", data: mStk, borderColor: "#10b981", borderWidth: 2.6, tension: 0.25 },
        { label: "My Forecast End Stock (T)", data: uStk, borderColor: "#a855f7", borderDash: [5, 4], borderWidth: 2.6, tension: 0.25 }
      ]
    },
    options: chartOptionsCommon("Tonnes")
  });
}

// TAB 5: IMPORTS
// ===========================================================================
const IMPORT_ROWS = [
  { key: "cpo_import", label: "Crude Palm Oil (CPO)" },
  { key: "ppo_import", label: "Processed Palm Oil (PPO)" },
  { key: "palm_oil_import", label: "Total Palm Oil (CPO + PPO)", highlight: true },
  { key: "pko_import", label: "Total Palm Kernel Oil (PKO)" }
];

function renderImportsTab() {
  const years = getSortedSelectedYears(1985, 2027);
  const impAnn = STATE.master.imports.annual;
  const impMon = STATE.master.imports.monthly;

  let html = `<table class="data-table"><thead><tr><th style="min-width:220px;width:220px;">Import Product (Tonnes)</th>`;
  for (const yr of years) {
    const canExp = yr >= 2005;
    const isExp = canExp && STATE.impExpandedYears.has(yr);
    if (isExp) {
      for (let m = 1; m <= 12; m++) {
        const isF = (yr === 2026 && m >= 10) || yr === 2027;
        html += `<th class="${isF ? 'cell-fcst' : ''}">${MONTH_SHORT[m - 1]} ${String(yr).slice(2)}${isF ? 'F' : ''}</th>`;
      }
    }
    html += `<th class="col-year-header col-annual" data-year="${yr}">
      ${canExp ? `<span class="expand-toggle">${isExp ? "&minus;" : "+"}</span>` : ''}${yr}${yr >= 2026 ? 'F' : ''}
    </th>`;
  }
  html += `</tr></thead><tbody>`;

  for (const rowDef of IMPORT_ROWS) {
    html += `<tr class="${rowDef.highlight ? 'row-highlight' : ''}"><td class="sticky-col">${rowDef.label}</td>`;
    for (const yr of years) {
      const canExp = yr >= 2005;
      const isExp = canExp && STATE.impExpandedYears.has(yr);
      if (isExp) {
        for (let m = 1; m <= 12; m++) {
          const p = `${yr}-${String(m).padStart(2, "0")}`;
          const mRec = impMon[p];
          html += `<td class="num ${mRec?.is_forecast ? 'cell-fcst' : ''}">${fmtNum(mRec ? mRec[rowDef.key] : null, 0)}</td>`;
        }
      }
      const aRec = impAnn[yr];
      html += `<td class="num col-annual ${yr >= 2026 ? 'cell-fcst' : ''}">${fmtNum(aRec ? aRec[rowDef.key] : null, 0)}</td>`;
    }
    html += `</tr>`;
  }
  html += `</tbody></table>`;

  const container = document.getElementById("imports-table-container");
  container.innerHTML = html;
  container.querySelectorAll(".col-year-header").forEach(th => {
    th.addEventListener("click", () => {
      const yr = Number(th.dataset.year);
      if (yr < 2005) return;
      if (STATE.impExpandedYears.has(yr)) STATE.impExpandedYears.delete(yr);
      else STATE.impExpandedYears.add(yr);
      renderImportsTab();
    });
  });

  // Charts
  destroyChart("impPo");
  destroyChart("impPko");
  const mYears = years.filter(y => y >= 2008);
  const useYears = mYears.length ? mYears : [2022, 2023, 2024, 2025, 2026];
  const labels = [], cpoD = [], ppoD = [], poD = [], pkoD = [];
  useYears.forEach(yr => {
    for (let m = 1; m <= 12; m++) {
      const p = `${yr}-${String(m).padStart(2, "0")}`;
      const r = impMon[p];
      if (!r) continue;
      labels.push(`${MONTH_SHORT[m - 1]} ${String(yr).slice(2)}${r.is_forecast ? 'F' : ''}`);
      cpoD.push(r.cpo_import);
      ppoD.push(r.ppo_import);
      poD.push(r.palm_oil_import);
      pkoD.push(r.pko_import);
    }
  });

  STATE.charts.impPo = new Chart(document.getElementById("chart-imports-po").getContext("2d"), {
    type: "bar",
    data: {
      labels,
      datasets: [
        { label: "Crude Palm Oil (CPO)", data: cpoD, backgroundColor: "#f59e0b", stack: "po" },
        { label: "Processed Palm Oil (PPO)", data: ppoD, backgroundColor: "#3b82f6", stack: "po" }
      ]
    },
    options: {
      ...chartOptionsCommon("Tonnes"),
      scales: { x: { stacked: true, ticks: { color: "#94a3b8" } }, y: { stacked: true, ticks: { color: "#94a3b8" } } }
    }
  });

  STATE.charts.impPko = new Chart(document.getElementById("chart-imports-pko").getContext("2d"), {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Total Palm Kernel Oil (PKO) Imports (T)",
          data: pkoD,
          borderColor: "#9333ea",
          backgroundColor: "rgba(147, 51, 234, 0.12)",
          fill: true,
          borderWidth: 2.4,
          tension: 0.25
        }
      ]
    },
    options: chartOptionsCommon("Tonnes")
  });
}

// ===========================================================================
// TAB 6: EXPORTS (SPLIT BY PORTS & SPLIT BY PRODUCTS)
// ===========================================================================
const EXPORT_PORT_ROWS = [
  { key: "butterworth", label: "Butterworth" },
  { key: "port_klang", label: "Port Klang" },
  { key: "pasir_gudang", label: "Pasir Gudang" },
  { key: "others_peninsular", label: "Others (Peninsular)" },
  { key: "peninsular_total", label: "Peninsular Malaysia Total", subtotal: true },
  { key: "lahad_datu", label: "Lahad Datu" },
  { key: "sandakan", label: "Sandakan" },
  { key: "others_sabah_sarawak", label: "Others (Sabah & Sarawak)" },
  { key: "sabah_sarawak_total", label: "Sabah & Sarawak Total", subtotal: true },
  { key: "malaysia_total", label: "Malaysia Total Palm Oil Exports", highlight: true }
];

const EXPORT_PROD_ROWS = [
  { key: "cpo", label: "Crude Palm Oil (CPO)" },
  { key: "ppo", label: "Processed Palm Oil (PPO)" },
  { key: "palm_oil_total", label: "Total Palm Oil (CPO + PPO)", subtotal: true },
  { key: "cpko", label: "Crude Palm Kernel Oil (CPKO)" },
  { key: "ppko", label: "Processed Palm Kernel Oil (PPKO)" },
  { key: "pko_total", label: "Total Palm Kernel Oil (PKO)", subtotal: true },
  { key: "palm_kernel_cake", label: "Palm Kernel Cake (PKC)" },
  { key: "oleochemicals", label: "Oleochemicals" },
  { key: "biodiesel", label: "Biodiesel" },
  { key: "finished_products", label: "Finished Products" },
  { key: "others", label: "Other Oil Palm Products" },
  { key: "total_all_products", label: "Total Oil Palm Products", highlight: true }
];

function renderExportsTab() {
  const portsSec = document.getElementById("exports-ports-section");
  const prodsSec = document.getElementById("exports-products-section");
  portsSec.style.display = (STATE.expSplitMode === "both" || STATE.expSplitMode === "ports") ? "block" : "none";
  prodsSec.style.display = (STATE.expSplitMode === "both" || STATE.expSplitMode === "products") ? "block" : "none";

  // 1. Render Ports Table (2004 - 2026)
  const portYears = getSortedSelectedYears(2004, 2026);
  const portsAnn = STATE.master.exports.by_port.annual;
  const portsMon = STATE.master.exports.by_port.monthly;
  renderExpandableMatrixTable(
    "exports-ports-table-container",
    "Port / Region (Tonnes)",
    EXPORT_PORT_ROWS,
    portYears,
    2004,
    STATE.expExpandedYears,
    portsAnn,
    portsMon,
    renderExportsTab,
    true
  );

  // 2. Render Products Table (1990 - 2026)
  const prodYears = getSortedSelectedYears(1990, 2026);
  const prodAnn = STATE.master.exports.by_product.annual;
  const prodMon = STATE.master.exports.by_product.monthly;
  renderExpandableMatrixTable(
    "exports-products-table-container",
    "Product Category (Tonnes)",
    EXPORT_PROD_ROWS,
    prodYears,
    2004,
    STATE.expExpandedYears,
    prodAnn,
    prodMon,
    renderExportsTab
  );

  // Charts
  destroyChart("expPorts");
  destroyChart("expProds");

  const pLabels = portYears.map(y => y === 2026 ? "2026 YTD" : String(y));
  STATE.charts.expPorts = new Chart(document.getElementById("chart-exports-ports").getContext("2d"), {
    type: "bar",
    data: {
      labels: pLabels,
      datasets: [
        { label: "Pasir Gudang", data: portYears.map(y => portsAnn[y]?.pasir_gudang), backgroundColor: "#10b981", stack: "p" },
        { label: "Port Klang", data: portYears.map(y => portsAnn[y]?.port_klang), backgroundColor: "#3b82f6", stack: "p" },
        { label: "Butterworth", data: portYears.map(y => portsAnn[y]?.butterworth), backgroundColor: "#60a5fa", stack: "p" },
        { label: "Lahad Datu", data: portYears.map(y => portsAnn[y]?.lahad_datu), backgroundColor: "#f59e0b", stack: "p" },
        { label: "Sandakan", data: portYears.map(y => portsAnn[y]?.sandakan), backgroundColor: "#a855f7", stack: "p" },
        { label: "Other Ports", data: portYears.map(y => (portsAnn[y]?.others_peninsular || 0) + (portsAnn[y]?.others_sabah_sarawak || 0)), backgroundColor: "#64748b", stack: "p" }
      ]
    },
    options: {
      ...chartOptionsCommon("Tonnes"),
      scales: { x: { stacked: true, ticks: { color: "#94a3b8" } }, y: { stacked: true, ticks: { color: "#94a3b8" } } }
    }
  });

  const prLabels = prodYears.map(y => y === 2026 ? "2026 YTD" : String(y));
  STATE.charts.expProds = new Chart(document.getElementById("chart-exports-products").getContext("2d"), {
    type: "bar",
    data: {
      labels: prLabels,
      datasets: [
        { label: "Processed Palm Oil (PPO)", data: prodYears.map(y => prodAnn[y]?.ppo), backgroundColor: "#10b981", stack: "pr" },
        { label: "Crude Palm Oil (CPO)", data: prodYears.map(y => prodAnn[y]?.cpo), backgroundColor: "#f59e0b", stack: "pr" },
        { label: "Oleochemicals", data: prodYears.map(y => prodAnn[y]?.oleochemicals), backgroundColor: "#3b82f6", stack: "pr" },
        { label: "Palm Kernel Cake (PKC)", data: prodYears.map(y => prodAnn[y]?.palm_kernel_cake), backgroundColor: "#a855f7", stack: "pr" },
        { label: "Total PKO", data: prodYears.map(y => prodAnn[y]?.pko_total), backgroundColor: "#ec4899", stack: "pr" },
        { label: "Biodiesel & Finished", data: prodYears.map(y => (prodAnn[y]?.biodiesel || 0) + (prodAnn[y]?.finished_products || 0)), backgroundColor: "#06b6d4", stack: "pr" }
      ]
    },
    options: {
      ...chartOptionsCommon("Tonnes"),
      scales: { x: { stacked: true, ticks: { color: "#94a3b8" } }, y: { stacked: true, ticks: { color: "#94a3b8" } } }
    }
  });
}

// ===========================================================================
// TAB 7: STOCKS BY PRODUCTS
// ===========================================================================
const STOCK_ROWS = [
  { key: "cpo_peninsular", label: "CPO - Peninsular Malaysia" },
  { key: "cpo_sabah", label: "CPO - Sabah" },
  { key: "cpo_sarawak", label: "CPO - Sarawak" },
  { key: "cpo_total", label: "Total Crude Palm Oil (CPO)", subtotal: true },
  { key: "ppo_total", label: "Total Processed Palm Oil (PPO)", subtotal: true },
  { key: "palm_oil_total", label: "Total Palm Oil (CPO + PPO)", highlight: true },
  { key: "cp_stearin", label: "↳ Refinery: Crude Palm Stearin" },
  { key: "cp_olein", label: "↳ Refinery: Crude Palm Olein" },
  { key: "rbd_palm_oil", label: "↳ Refinery: RBD Palm Oil" },
  { key: "rbd_palm_olein", label: "↳ Refinery: RBD Palm Olein" },
  { key: "rbd_palm_stearin", label: "↳ Refinery: RBD Palm Stearin" },
  { key: "pfad", label: "↳ Refinery: PFAD" },
  { key: "cooking_oil", label: "↳ Refinery: Cooking Oil" },
  { key: "palm_kernel", label: "Palm Kernel (PK)" },
  { key: "cpko", label: "Crude Palm Kernel Oil (CPKO)" },
  { key: "ppko", label: "Processed Palm Kernel Oil (PPKO)" },
  { key: "pko_total", label: "Total Palm Kernel Oil (PKO)", subtotal: true },
  { key: "palm_kernel_cake", label: "Palm Kernel Cake (PKC)" }
];

function renderStocksTab() {
  const stkYears = getSortedSelectedYears(1986, 2026);
  const stkAnn = STATE.master.stocks.annual;
  const stkMon = STATE.master.stocks.monthly;

  renderExpandableMatrixTable(
    "stocks-table-container",
    "Stock Category / Product (Tonnes)",
    STOCK_ROWS,
    stkYears,
    2004,
    STATE.stkExpandedYears,
    stkAnn,
    stkMon,
    renderStocksTab
  );

  destroyChart("stkMain");
  destroyChart("stkRef");

  const mYears = stkYears.filter(y => y >= 2004);
  const useYears = mYears.length ? mYears : [2022, 2023, 2024, 2025, 2026];
  const labels = [], penD = [], sabD = [], sarD = [], ppoD = [];
  const rbdOlein = [], rbdPo = [], rbdStearin = [], pfad = [], cook = [];

  useYears.forEach(yr => {
    for (let m = 1; m <= 12; m++) {
      const p = `${yr}-${String(m).padStart(2, "0")}`;
      const r = stkMon[p];
      if (!r || r.palm_oil_total == null) continue;
      labels.push(`${MONTH_SHORT[m - 1]} ${String(yr).slice(2)}`);
      penD.push(r.cpo_peninsular);
      sabD.push(r.cpo_sabah);
      sarD.push(r.cpo_sarawak);
      ppoD.push(r.ppo_total);

      rbdOlein.push(r.rbd_palm_olein);
      rbdPo.push(r.rbd_palm_oil);
      rbdStearin.push(r.rbd_palm_stearin);
      pfad.push(r.pfad);
      cook.push(r.cooking_oil);
    }
  });

  const totPoStk = [];
  useYears.forEach(yr => {
    for (let m = 1; m <= 12; m++) {
      const p = `${yr}-${String(m).padStart(2, "0")}`;
      const r = stkMon[p];
      if (!r || r.palm_oil_total == null) continue;
      totPoStk.push(r.palm_oil_total);
    }
  });

  STATE.charts.stkMain = new Chart(document.getElementById("chart-stocks-main").getContext("2d"), {
    type: "line",
    data: {
      labels,
      datasets: [
        { label: "CPO - Peninsular Malaysia", data: penD, borderColor: "#2563eb", borderWidth: 2.2, tension: 0.25, pointRadius: 0 },
        { label: "CPO - Sabah", data: sabD, borderColor: "#d97706", borderWidth: 2.2, tension: 0.25, pointRadius: 0 },
        { label: "CPO - Sarawak", data: sarD, borderColor: "#9333ea", borderWidth: 2.2, tension: 0.25, pointRadius: 0 },
        { label: "Processed Palm Oil (PPO) Total", data: ppoD, borderColor: "#0d9488", borderWidth: 2.4, tension: 0.25, pointRadius: 0 },
        { label: "Total Palm Oil Stocks (Malaysia)", data: totPoStk, borderColor: "#059669", borderWidth: 3.2, tension: 0.25, pointRadius: 0 }
      ]
    },
    options: chartOptionsCommon("Tonnes")
  });

  STATE.charts.stkRef = new Chart(document.getElementById("chart-stocks-refinery").getContext("2d"), {
    type: "line",
    data: {
      labels,
      datasets: [
        { label: "RBD Palm Olein", data: rbdOlein, borderColor: "#10b981", borderWidth: 2, pointRadius: 0 },
        { label: "RBD Palm Oil", data: rbdPo, borderColor: "#3b82f6", borderWidth: 2, pointRadius: 0 },
        { label: "RBD Palm Stearin", data: rbdStearin, borderColor: "#f59e0b", borderWidth: 2, pointRadius: 0 },
        { label: "PFAD", data: pfad, borderColor: "#a855f7", borderWidth: 1.8, pointRadius: 0 },
        { label: "Cooking Oil", data: cook, borderColor: "#ec4899", borderWidth: 1.8, pointRadius: 0 }
      ]
    },
    options: chartOptionsCommon("Tonnes")
  });
}

// Generic reusable builder for Expandable Year Columns Matrix (used in Exports & Stocks)
function renderExpandableMatrixTable(containerId, firstColTitle, rowDefs, years, minMonthlyYear, expandedSet, annMap, monMap, onToggle, isPortTable = false) {
  const isShareMode = isPortTable && STATE.expPortUnit === "share";
  const displayTitle = isShareMode ? firstColTitle.replace("Tonnes", "% Share of Total") : firstColTitle;

  let html = `<table class="data-table"><thead><tr><th style="min-width:220px;width:220px;">${displayTitle}</th>`;
  for (const yr of years) {
    const canExp = yr >= minMonthlyYear;
    const isExp = canExp && expandedSet.has(yr);
    if (isExp) {
      for (let m = 1; m <= 12; m++) {
        const p = `${yr}-${String(m).padStart(2, "0")}`;
        if (!monMap[p]) continue;
        const isF = (yr === 2026 && m >= 10) || yr === 2027;
        html += `<th class="${isF ? 'cell-fcst' : ''}">${MONTH_SHORT[m - 1]} ${String(yr).slice(2)}${isF ? 'F' : ''}</th>`;
      }
    }
    const ytdTag = annMap[yr]?.is_ytd ? " (YTD)" : "";
    html += `<th class="col-year-header col-annual" data-year="${yr}">
      ${canExp ? `<span class="expand-toggle">${isExp ? "&minus;" : "+"}</span>` : ''}${yr}${yr >= 2026 ? 'F' : ytdTag}
    </th>`;
  }
  html += `</tr></thead><tbody>`;

  for (const rDef of rowDefs) {
    const rCls = rDef.highlight ? "row-highlight" : rDef.subtotal ? "row-subtotal" : "";
    html += `<tr class="${rCls}"><td class="sticky-col">${rDef.label}</td>`;
    for (const yr of years) {
      const canExp = yr >= minMonthlyYear;
      const isExp = canExp && expandedSet.has(yr);
      if (isExp) {
        for (let m = 1; m <= 12; m++) {
          const p = `${yr}-${String(m).padStart(2, "0")}`;
          if (!monMap[p]) continue;
          const val = monMap[p][rDef.key];
          if (isShareMode) {
            const tot = monMap[p]["malaysia_total"];
            let cellStr = "--";
            if (rDef.key === "malaysia_total") cellStr = "100.0%";
            else if (tot > 0 && val != null) cellStr = ((val / tot) * 100).toFixed(1) + "%";
            html += `<td class="num">${cellStr}</td>`;
          } else {
            html += `<td class="num">${fmtNum(val, 0)}</td>`;
          }
        }
      }
      const aRec = annMap[yr];
      const aVal = aRec ? aRec[rDef.key] : null;
      if (isShareMode) {
        const aTot = aRec ? aRec["malaysia_total"] : null;
        let cellStr = "--";
        if (rDef.key === "malaysia_total") cellStr = "100.0%";
        else if (aTot > 0 && aVal != null) cellStr = ((aVal / aTot) * 100).toFixed(1) + "%";
        html += `<td class="num col-annual">${cellStr}</td>`;
      } else {
        html += `<td class="num col-annual">${fmtNum(aVal, 0)}</td>`;
      }
    }
    html += `</tr>`;
  }
  html += `</tbody></table>`;
  const container = document.getElementById(containerId);
  container.innerHTML = html;
  container.querySelectorAll(".col-year-header").forEach(th => {
    th.addEventListener("click", () => {
      const yr = Number(th.dataset.year);
      if (yr < minMonthlyYear) return;
      if (expandedSet.has(yr)) expandedSet.delete(yr);
      else expandedSet.add(yr);
      onToggle();
    });
  });
}

// ===========================================================================
// TAB 8: SEASONALITY (CHART & TABLE)
// ===========================================================================
const SEASON_ENTITIES_NORTH_TO_SOUTH = [
  "Malaysia",
  "Peninsular Malaysia",
  "Kedah",
  "Pulau Pinang",
  "Perak",
  "Selangor",
  "Negeri Sembilan",
  "Melaka",
  "Johor",
  "Pahang",
  "Terengganu",
  "Kelantan",
  "Sabah & Sarawak",
  "Sabah",
  "Sarawak"
];

function getSeasonalityValue(period, attrPath) {
  const [group, field] = attrPath.split(".");

  if (group === "snd") {
    const snd = getEffectiveSndData(STATE.seasonFcstMode).monthly;
    if (field === "stocks_to_use") {
      const rec = snd[period];
      if (!rec) return null;
      const disp = (rec.export || 0) + (rec.local_disappearance || 0);
      return disp > 0 ? Number(((rec.end_stock / disp) * 100).toFixed(2)) : null;
    }
    if (field === "production" && !STATE.seasonRegions.has("Malaysia")) {
      // Aggregate production across selected regions
      let sum = 0;
      let hasData = false;
      STATE.seasonRegions.forEach(ent => {
        const val = STATE.master.production.monthly[period]?.entities?.[ent]?.cpo_production;
        if (val !== undefined && val !== null) {
          sum += val;
          hasData = true;
        }
      });
      return hasData ? sum : null;
    }
    return snd[period] ? snd[period][field] : null;
  }

  if (group === "prod") {
    if (STATE.seasonRegions.has("Malaysia") || STATE.seasonRegions.size === 0) {
      return STATE.master.production.monthly[period]?.entities?.["Malaysia"]?.[field] ?? null;
    }
    if (field === "cpo_production") {
      let sum = 0;
      let hasData = false;
      STATE.seasonRegions.forEach(ent => {
        const val = STATE.master.production.monthly[period]?.entities?.[ent]?.cpo_production;
        if (val !== undefined && val !== null) {
          sum += val;
          hasData = true;
        }
      });
      return hasData ? sum : null;
    }
    // Yields & OER: weighted average by mature hectares
    let wSum = 0;
    let wHa = 0;
    STATE.seasonRegions.forEach(ent => {
      const ed = STATE.master.production.monthly[period]?.entities?.[ent];
      if (ed && ed[field] != null && ed.official_mature_ha) {
        wSum += ed[field] * ed.official_mature_ha;
        wHa += ed.official_mature_ha;
      }
    });
    return wHa > 0 ? Number((wSum / wHa).toFixed(4)) : null;
  }

  if (group === "prod_pen") {
    return STATE.master.production.monthly[period]?.entities?.["Peninsular Malaysia"]?.[field] ?? null;
  }
  if (group === "prod_ss") {
    return STATE.master.production.monthly[period]?.entities?.["Sabah & Sarawak"]?.[field] ?? null;
  }
  if (group === "prod_sabah") {
    return STATE.master.production.monthly[period]?.entities?.["Sabah"]?.[field] ?? null;
  }
  if (group === "prod_sarawak") {
    return STATE.master.production.monthly[period]?.entities?.["Sarawak"]?.[field] ?? null;
  }
  if (group === "imp") {
    return STATE.master.imports.monthly[period]?.[field] ?? null;
  }
  if (group === "exp_prod") {
    return STATE.master.exports.by_product.monthly[period]?.[field] ?? null;
  }
  if (group === "exp_port") {
    return STATE.master.exports.by_port.monthly[period]?.[field] ?? null;
  }
  if (group === "stk") {
    return STATE.master.stocks.monthly[period]?.[field] ?? null;
  }
  return null;
}

function renderSeasonalityTab() {
  destroyChart("seasonality");

  const attrSel = document.getElementById("season-attr-select");
  const attrLabel = attrSel.options[attrSel.selectedIndex].text;
  const attrPath = STATE.seasonAttr;
  const isRatio = attrPath === "snd.stocks_to_use";
  const isDecimal = attrPath.includes("yield") || attrPath.includes("oer") || isRatio;
  const decimals = attrPath.includes("cpo_yield") ? 3 : isRatio ? 1 : isDecimal ? 2 : 0;

  // Manage Region Slicer visibility
  const regGroup = document.getElementById("season-region-group");
  const isProdAttr = attrPath.startsWith("snd.production") || attrPath.startsWith("prod.");
  if (regGroup) {
    regGroup.style.display = isProdAttr ? "flex" : "none";
    if (isProdAttr) renderSeasonRegionSlicer();
  }

  // Set Chart Title
  const regDesc = STATE.seasonRegions.has("Malaysia")
    ? "Malaysia Total"
    : Array.from(STATE.seasonRegions).slice(0, 3).join(", ") + (STATE.seasonRegions.size > 3 ? "..." : "");
  document.getElementById("season-chart-title").textContent = "Seasonality Curve";
  const subEl = document.getElementById("season-chart-sub");
  if (subEl) subEl.textContent = `${attrLabel} [${regDesc}] • Min–Max Historical Band • 5Y Benchmark Average • Selected Years`;
  document.getElementById("season-table-title").textContent = `Monthly Seasonality Matrix & Heatmap: ${attrLabel} [${regDesc}]`;

  const years = getSortedSelectedYears(2004, 2027);

  // Ensure at least one year in `years` is active on the chart when user changes global Year Slicer
  if (!years.some(y => STATE.seasonActiveYears.has(y))) {
    years.forEach(y => STATE.seasonActiveYears.add(y));
  }

  // Compute 5Y (2021-2025) and 10Y (2016-2025) monthly averages,
  // and compute Min–Max Range dynamically across the user's selected years (`years`)
  const avg5Y = [];
  const avg10Y = [];
  const minHistorical = [];
  const maxHistorical = [];
  const rangeYears = years.length ? years : [2023, 2024, 2025, 2026, 2027];

  for (let m = 1; m <= 12; m++) {
    const v5 = [], v10 = [], vRange = [];
    for (let y = 2016; y <= 2025; y++) {
      const v = getSeasonalityValue(`${y}-${String(m).padStart(2, "0")}`, attrPath);
      if (v !== null && v !== undefined && !isNaN(v)) {
        v10.push(v);
        if (y >= 2021) v5.push(v);
      }
    }
    for (const y of rangeYears) {
      const v = getSeasonalityValue(`${y}-${String(m).padStart(2, "0")}`, attrPath);
      if (v !== null && v !== undefined && !isNaN(v)) {
        vRange.push(v);
      }
    }
    avg5Y.push(v5.length ? Number((v5.reduce((a, b) => a + b, 0) / v5.length).toFixed(decimals)) : null);
    avg10Y.push(v10.length ? Number((v10.reduce((a, b) => a + b, 0) / v10.length).toFixed(decimals)) : null);
    minHistorical.push(vRange.length ? Math.min(...vRange) : null);
    maxHistorical.push(vRange.length ? Math.max(...vRange) : null);
  }

  const rangeLabel = rangeYears.length === 1
    ? `Min–Max Range (${rangeYears[0]})`
    : `Min–Max Range (${rangeYears[0]}–${rangeYears[rangeYears.length - 1]})`;

  // Build Datasets
  const datasets = [
    // 1. Min bound of selected years band (invisible line)
    {
      label: "Historical Range (Min)",
      data: minHistorical,
      borderColor: "transparent",
      pointRadius: 0,
      fill: false,
      tension: 0.25
    },
    // 2. Max bound of selected years band (fills to previous dataset, forming shaded zone)
    {
      label: rangeLabel,
      data: maxHistorical,
      borderColor: "transparent",
      backgroundColor: "rgba(148, 163, 184, 0.22)",
      pointRadius: 0,
      fill: "-1",
      tension: 0.25
    },
    // 3. 5Y Average line (NO bottom fill as user requested!)
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

  // Render Year Slicer Pills
  renderSeasonYearPills(years);

  // Add lines for years active in STATE.seasonActiveYears
  const palette = ["#0284c7", "#2563eb", "#7c3aed", "#d97706", "#dc2626", "#0d9488", "#e11d48"];
  let colorIdx = 0;

  years.forEach(yr => {
    if (!STATE.seasonActiveYears.has(yr)) return;

    const mVals = [];
    for (let m = 1; m <= 12; m++) {
      mVals.push(getSeasonalityValue(`${yr}-${String(m).padStart(2, "0")}`, attrPath));
    }
    if (mVals.every(v => v === null)) return;

    const isCurrent = yr === 2026;
    const isFcst = yr === 2027;
    const isLatestActual = yr === 2025;

    let lineLabel = String(yr);
    if (yr === 2026) lineLabel = "2026 (Actual + Q4 F)";
    else if (yr === 2027) lineLabel = "2027F";

    let color = palette[colorIdx % palette.length];
    if (isLatestActual) color = "#0284c7";
    if (isCurrent) color = "#059669";
    if (isFcst) color = "#d97706";
    colorIdx++;

    datasets.push({
      label: lineLabel,
      data: mVals,
      borderColor: color,
      borderWidth: isCurrent || isFcst ? 3.2 : 2.2,
      borderDash: isFcst ? [4, 3] : [],
      pointRadius: isCurrent || isFcst ? 4 : 2.5,
      tension: 0.25,
      fill: false
    });
  });

  const ctx = document.getElementById("chart-seasonality").getContext("2d");
  const commonOpts = chartOptionsCommon(attrLabel);
  if (isRatio || attrPath.includes("oer")) {
    commonOpts.scales.y.ticks = {
      ...commonOpts.scales.y.ticks,
      callback: v => v + "%"
    };
  }
  STATE.charts.seasonality = new Chart(ctx, {
    type: "line",
    data: { labels: MONTH_SHORT, datasets },
    options: {
      ...commonOpts,
      plugins: {
        ...commonOpts.plugins,
        legend: {
          labels: {
            filter: (legendItem) => legendItem.text !== "Historical Range (Min)"
          }
        }
      }
    }
  });

  // Render Seasonality Heatmap Table
  const allVals = [];
  years.forEach(yr => {
    for (let m = 1; m <= 12; m++) {
      const v = getSeasonalityValue(`${yr}-${String(m).padStart(2, "0")}`, attrPath);
      if (v !== null && !isNaN(v)) allVals.push(v);
    }
  });
  const minV = allVals.length ? Math.min(...allVals) : 0;
  const maxV = allVals.length ? Math.max(...allVals) : 1;

  function heatBg(val, isFcstCell) {
    if (val === null || val === undefined || maxV <= minV) return "";
    const ratio = (val - minV) / (maxV - minV);
    if (isFcstCell) {
      return `background: rgba(245, 158, 11, ${(0.08 + ratio * 0.25).toFixed(2)});`;
    }
    return `background: rgba(16, 185, 129, ${(0.05 + ratio * 0.28).toFixed(2)});`;
  }

  let html = `<table class="data-table"><thead><tr>
    <th style="min-width:150px">Year / Benchmark</th>
    ${MONTH_SHORT.map(m => `<th>${m}</th>`).join("")}
    <th>Annual Total / Avg</th>
  </tr></thead><tbody>`;

  // 5Y and 10Y benchmark rows
  const suffix = isRatio || attrPath.includes("oer") ? "%" : "";
  [
    { name: "5Y Avg (2021–2025)", arr: avg5Y },
    { name: "10Y Avg (2016–2025)", arr: avg10Y }
  ].forEach(bRow => {
    const valid = bRow.arr.filter(x => x !== null);
    const agg = valid.length
      ? (isRatio || isDecimal || attrPath.includes("stock")
          ? valid.reduce((a, b) => a + b, 0) / valid.length
          : valid.reduce((a, b) => a + b, 0))
      : null;
    html += `<tr class="row-subtotal"><td class="sticky-col">${bRow.name}</td>`;
    bRow.arr.forEach(v => {
      const cellStr = v !== null ? `${fmtNum(v, decimals)}${suffix}` : '<span class="text-muted">--</span>';
      html += `<td class="num">${cellStr}</td>`;
    });
    const aggStr = agg !== null ? `${fmtNum(agg, decimals)}${suffix}` : '<span class="text-muted">--</span>';
    html += `<td class="num"><strong>${aggStr}</strong></td></tr>`;
  });

  // Year rows
  years.forEach(yr => {
    const rowVals = [];
    for (let m = 1; m <= 12; m++) {
      rowVals.push(getSeasonalityValue(`${yr}-${String(m).padStart(2, "0")}`, attrPath));
    }
    if (rowVals.every(v => v === null)) return;
    const valid = rowVals.filter(x => x !== null);
    const agg = valid.length
      ? (isRatio || isDecimal || attrPath.includes("stock")
          ? valid.reduce((a, b) => a + b, 0) / valid.length
          : valid.reduce((a, b) => a + b, 0))
      : null;

    const isFYear = yr >= 2026;
    html += `<tr><td class="sticky-col">${yr}${isFYear ? ' <span class="badge badge-fcst">F</span>' : ''}</td>`;
    rowVals.forEach((v, idx) => {
      const isFCell = (yr === 2026 && idx >= 9) || yr === 2027;
      const cellStr = v !== null ? `${fmtNum(v, decimals)}${suffix}` : '<span class="text-muted">--</span>';
      html += `<td class="num ${isFCell ? 'cell-fcst' : ''}" style="${heatBg(v, isFCell)}">${cellStr}</td>`;
    });
    const aggStr = agg !== null ? `${fmtNum(agg, decimals)}${suffix}` : '<span class="text-muted">--</span>';
    html += `<td class="num col-annual ${isFYear ? 'cell-fcst' : ''}"><strong>${aggStr}</strong></td></tr>`;
  });

  html += `</tbody></table>`;
  document.getElementById("seasonality-table-container").innerHTML = html;
}

function renderSeasonYearPills(years) {
  const container = document.getElementById("season-year-pills");
  if (!container) return;

  const displayYears = years;
  let html = "";
  displayYears.forEach(y => {
    const isActive = STATE.seasonActiveYears.has(y);
    const isFcst = y >= 2026;
    const cls = isActive ? (isFcst ? "season-pill active-fcst" : "season-pill active") : "season-pill";
    const label = y === 2026 ? "2026F" : y === 2027 ? "2027F" : String(y);
    html += `<button class="${cls}" data-year="${y}">${label}</button>`;
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

function renderSeasonRegionSlicer() {
  const container = document.getElementById("season-region-slicer");
  if (!container) return;

  let html = "";
  SEASON_ENTITIES_NORTH_TO_SOUTH.forEach(ent => {
    const isSelected = STATE.seasonRegions.has(ent);
    const cls = isSelected ? "season-pill active" : "season-pill";
    html += `<button class="${cls}" data-ent="${ent}">${ent}</button>`;
  });
  container.innerHTML = html;

  container.querySelectorAll(".season-pill").forEach(btn => {
    btn.addEventListener("click", (e) => {
      const ent = btn.dataset.ent;
      if (e.ctrlKey || e.metaKey) {
        if (STATE.seasonRegions.has(ent)) {
          if (STATE.seasonRegions.size > 1) STATE.seasonRegions.delete(ent);
        } else {
          STATE.seasonRegions.add(ent);
        }
      } else {
        STATE.seasonRegions.clear();
        STATE.seasonRegions.add(ent);
      }
      renderSeasonalityTab();
    });
  });
}

// ---------------------------------------------------------------------------


// ===========================================================================
// TAB 8: SURVEY (ITS / AMSPEC / SGS / MPOA / SPPOMA / REUTERS POLL)
// ===========================================================================
function renderSurveyTab() {
  destroyChart("surveyMain");
  destroyChart("surveySub");

  const cat = STATE.surveyCat;
  const winGroup = document.getElementById("survey-exp-window-group");
  const srcGroup = document.getElementById("survey-exp-source-group");
  const pollGroup = document.getElementById("survey-poll-attr-group");
  const prodGroup = document.getElementById("survey-prod-desc-group");
  const t2Card = document.getElementById("survey-table2-card");

  if (winGroup) winGroup.style.display = cat === "exports" ? "flex" : "none";
  if (srcGroup) srcGroup.style.display = cat === "exports" ? "flex" : "none";
  if (pollGroup) pollGroup.style.display = cat === "poll" ? "flex" : "none";
  if (prodGroup) prodGroup.style.display = cat === "production" ? "flex" : "none";
  if (t2Card) t2Card.style.display = "none";

  if (cat === "exports") {
    renderSurveyExports();
  } else if (cat === "production") {
    renderSurveyProduction();
  } else {
    renderSurveyPoll();
  }
}

function getSurveySelectedYearsSet(minY = 2010, maxY = 2026) {
  const arr = getSortedSelectedYears(minY, maxY);
  return new Set(arr);
}

function fmtPctSigned(val, decimals = 1) {
  if (val === null || val === undefined || Number.isNaN(Number(val))) return '<span class="text-muted">-</span>';
  const n = Number(val);
  const sign = n > 0 ? "+" : "";
  const cls = n > 0 ? "cell-pos" : n < 0 ? "cell-neg" : "";
  return `<span class="${cls}">${sign}${n.toFixed(decimals)}%</span>`;
}

function renderSurveyExports() {
  const surv = STATE.master.lseg_surveyors || {};
  const itsList = surv.its_exports || [];
  const amspecList = surv.amspec_exports || [];
  const amspecHeadlines = surv.amspec_headlines || [];
  const sgsProdList = surv.sgs_exports_products || [];
  const sgsDestList = surv.sgs_exports_destinations || [];
  const sndMonthly = STATE.master.snd?.monthly || {};

  const selYears = getSurveySelectedYearsSet(2010, 2026);
  const winFilter = STATE.surveyWindow;
  const srcMode = STATE.surveySource;

  const filterRow = (r) => {
    const yr = Number(String(r.YearMonth || r.Date || "").slice(0, 4));
    if (!selYears.has(yr)) return false;
    if (winFilter !== "all" && r.Window !== winFilter) return false;
    return true;
  };

  if (srcMode === "overview") {
    // Index by YearMonth + Window
    const mergedMap = new Map();
    const keyOf = (ym, w) => `${ym}|${w}`;

    itsList.forEach(r => {
      if (!filterRow(r)) return;
      const k = keyOf(r.YearMonth, r.Window);
      if (!mergedMap.has(k)) mergedMap.set(k, { YearMonth: r.YearMonth, Window: r.Window, Date: r.Date });
      const obj = mergedMap.get(k);
      obj.Date = r.Date;
      obj.its_total = r.Total_Accumulated_Export_MT ?? (r.Window === "Full Month" ? r.Full_Month_Total_Export_MT : null) ?? r.Selected_6_Products_Sum_MT;
      obj.its_6prod = r.Selected_6_Products_Sum_MT;
    });

    amspecList.forEach(r => {
      if (!filterRow(r)) return;
      const k = keyOf(r.YearMonth, r.Window);
      if (!mergedMap.has(k)) mergedMap.set(k, { YearMonth: r.YearMonth, Window: r.Window, Date: r.Date });
      const obj = mergedMap.get(k);
      if (!obj.Date || r.Date > obj.Date) obj.Date = r.Date;
      obj.amspec_headline = r.Headline_All_Products_Total_MT;
      obj.amspec_6prod = r.Selected_6_Products_Total_MT;
      obj.amspec_best = r.Headline_All_Products_Total_MT ?? r.Selected_6_Products_Total_MT;
    });

    sgsProdList.forEach(r => {
      if (!filterRow(r)) return;
      const k = keyOf(r.YearMonth, r.Window);
      if (!mergedMap.has(k)) mergedMap.set(k, { YearMonth: r.YearMonth, Window: r.Window, Date: r.Date });
      const obj = mergedMap.get(k);
      if (!obj.Date || r.Date > obj.Date) obj.Date = r.Date;
      obj.sgs_total = r.Total_Palm_And_Oleo_Export_MT;
      obj.sgs_palm_sub = r.SubTotal_Palm_Oil_Products_MT;
    });

    const winRank = { "1-10": 1, "1-15": 2, "1-20": 3, "1-25": 4, "Full Month": 5 };
    const rows = Array.from(mergedMap.values()).sort((a, b) => {
      if (a.YearMonth !== b.YearMonth) return a.YearMonth.localeCompare(b.YearMonth);
      return (winRank[a.Window] || 9) - (winRank[b.Window] || 9);
    });

    // Compute MoM % vs previous month same window
    const byYmWin = new Map();
    // Build full lookup across ALL years for accurate MoM calculation
    const allLookup = new Map();
    itsList.forEach(r => {
      const k = keyOf(r.YearMonth, r.Window);
      if (!allLookup.has(k)) allLookup.set(k, {});
      allLookup.get(k).its = r.Total_Accumulated_Export_MT ?? (r.Window === "Full Month" ? r.Full_Month_Total_Export_MT : null) ?? r.Selected_6_Products_Sum_MT;
    });
    amspecList.forEach(r => {
      const k = keyOf(r.YearMonth, r.Window);
      if (!allLookup.has(k)) allLookup.set(k, {});
      allLookup.get(k).amspec = r.Headline_All_Products_Total_MT ?? r.Selected_6_Products_Total_MT;
    });
    sgsProdList.forEach(r => {
      const k = keyOf(r.YearMonth, r.Window);
      if (!allLookup.has(k)) allLookup.set(k, {});
      allLookup.get(k).sgs = r.Total_Palm_And_Oleo_Export_MT;
    });

    const getPrevYm = (ym) => {
      const [y, m] = ym.split("-").map(Number);
      return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
    };

    rows.forEach(r => {
      const prevYm = getPrevYm(r.YearMonth);
      const prevK = keyOf(prevYm, r.Window);
      const prev = allLookup.get(prevK) || {};
      r.its_mom = (r.its_total != null && prev.its > 0) ? ((r.its_total - prev.its) / prev.its) * 100 : null;
      r.amspec_mom = (r.amspec_best != null && prev.amspec > 0) ? ((r.amspec_best - prev.amspec) / prev.amspec) * 100 : null;
      r.sgs_mom = (r.sgs_total != null && prev.sgs > 0) ? ((r.sgs_total - prev.sgs) / prev.sgs) * 100 : null;
      r.mpob_export = r.Window === "Full Month" ? (sndMonthly[r.YearMonth]?.export ?? null) : null;
      const prevMpobExport = sndMonthly[prevYm]?.export;
      r.mpob_export_mom = (r.Window === "Full Month" && r.mpob_export != null && prevMpobExport > 0)
        ? ((r.mpob_export - prevMpobExport) / prevMpobExport) * 100
        : null;
    });

    // Chart 1: Comparison across selected periods
    const winTitle = winFilter === "all" ? "All Windows" : winFilter;
    document.getElementById("survey-chart1-title").textContent = `Cargo Surveyors vs. Official MPOB Exports (${winTitle}) — Tonnes`;
    document.getElementById("survey-chart1-sub").textContent = `ITS (Intertek) • AmSpec Agri • SGS • Official MPOB Monthly Export`;

    const cLabels = rows.map(r => winFilter === "all" ? `${r.YearMonth} (${r.Window})` : r.YearMonth);
    const cDatasets = [
      {
        label: "ITS Total (MT)",
        data: rows.map(r => r.its_total ?? null),
        borderColor: "#0284c7",
        backgroundColor: "rgba(2, 132, 199, 0.1)",
        borderWidth: 2.3,
        pointRadius: 2.5,
        tension: 0.2
      },
      {
        label: "AmSpec Total (MT)",
        data: rows.map(r => r.amspec_best ?? null),
        borderColor: "#d97706",
        backgroundColor: "rgba(217, 119, 6, 0.1)",
        borderWidth: 2.3,
        pointRadius: 2.5,
        tension: 0.2
      },
      {
        label: "SGS Total Palm & Oleo (MT)",
        data: rows.map(r => r.sgs_total ?? null),
        borderColor: "#7c3aed",
        backgroundColor: "rgba(124, 58, 237, 0.1)",
        borderWidth: 2.2,
        pointRadius: 2.5,
        tension: 0.2
      }
    ];
    if (winFilter === "Full Month") {
      cDatasets.push({
        label: "Official MPOB Export (MT)",
        data: rows.map(r => r.mpob_export ?? null),
        borderColor: "#059669",
        borderWidth: 2.8,
        borderDash: [5, 3],
        pointRadius: 3,
        tension: 0.2
      });
    }

    STATE.charts.surveyMain = new Chart(
      document.getElementById("chart-survey-main").getContext("2d"),
      {
        type: "line",
        data: { labels: cLabels, datasets: cDatasets },
        options: chartOptionsCommon("Tonnes (MT)")
      }
    );

    // Chart 2: Intra-Month Cumulative Progression (1-10 -> 1-15 -> 1-20 -> 1-25 -> Full Month) for recent months
    document.getElementById("survey-chart2-title").textContent = "Intra-Month Export Progression Curve (1–10 → Full Month)";
    document.getElementById("survey-chart2-sub").textContent = "Recent months cumulative export trajectory across ITS, AmSpec, and SGS (Tonnes)";
    const windowsOrder = ["1-10", "1-15", "1-20", "1-25", "Full Month"];
    const recentYms = ["2026-10", "2026-09", "2026-08"];
    const progDatasets = [];
    const progColors = { "2026-10": "#059669", "2026-09": "#0284c7", "2026-08": "#94a3b8" };

    recentYms.forEach(ym => {
      progDatasets.push({
        label: `${ym} ITS`,
        data: windowsOrder.map(w => allLookup.get(keyOf(ym, w))?.its ?? null),
        borderColor: progColors[ym],
        borderWidth: ym === "2026-10" ? 3 : 2,
        pointRadius: 3.5,
        tension: 0.2
      });
      progDatasets.push({
        label: `${ym} AmSpec`,
        data: windowsOrder.map(w => allLookup.get(keyOf(ym, w))?.amspec ?? null),
        borderColor: progColors[ym],
        borderDash: [5, 3],
        borderWidth: ym === "2026-10" ? 2.5 : 1.8,
        pointRadius: 3,
        tension: 0.2
      });
      progDatasets.push({
        label: `${ym} SGS`,
        data: windowsOrder.map(w => allLookup.get(keyOf(ym, w))?.sgs ?? null),
        borderColor: progColors[ym],
        borderDash: [2, 2],
        borderWidth: 1.8,
        pointRadius: 2.5,
        tension: 0.2
      });
    });

    STATE.charts.surveySub = new Chart(
      document.getElementById("chart-survey-sub").getContext("2d"),
      {
        type: "line",
        data: { labels: ["Days 1–10", "Days 1–15", "Days 1–20", "Days 1–25", "Full Month"], datasets: progDatasets },
        options: chartOptionsCommon("Cumulative Tonnes (MT)")
      }
    );

    // Table 1: Historical Comparison Table (newest first for quick inspection)
    document.getElementById("survey-table1-title").textContent = `Cargo Surveyors Historical Comparison (${winTitle}) — Tonnes & MoM %`;
    const revRows = [...rows].reverse();
    let html = `<table class="data-table"><thead>
      <tr>
        <th rowspan="2" class="th-group-period border-right-thick-period" style="vertical-align:middle; text-align:center;">Period</th>
        <th rowspan="2" style="vertical-align:middle; text-align:center;">Window</th>
        <th rowspan="2" class="border-right-thick-period" style="vertical-align:middle; text-align:center;">Release Date</th>
        <th colspan="2" class="th-group-mpoa border-right-thick-mpoa" style="text-align:center;">ITS (Intertek)</th>
        <th colspan="3" class="th-group-sppoma border-right-thick-sppoma" style="text-align:center;">AmSpec Agri</th>
        <th colspan="3" class="th-group-error border-right-thick-error" style="text-align:center;">SGS</th>
        <th colspan="2" class="th-group-mpob border-right-thick-mpob" style="text-align:center;">Official MPOB</th>
      </tr>
      <tr>
        <!-- ITS sub-columns -->
        <th>Total (MT)</th>
        <th class="border-right-thick-mpoa">MoM (%)</th>
        <!-- AmSpec sub-columns -->
        <th>Total (MT)</th>
        <th>6-Prod (MT)</th>
        <th class="border-right-thick-sppoma">MoM (%)</th>
        <!-- SGS sub-columns -->
        <th>Total Palm &amp; Oleo</th>
        <th>Palm Sub-Total</th>
        <th class="border-right-thick-error">MoM (%)</th>
        <!-- MPOB sub-columns -->
        <th>Export (MT)</th>
        <th class="border-right-thick-mpob">MoM (%)</th>
      </tr>
    </thead><tbody>`;

    revRows.forEach(r => {
      html += `<tr>
        <td class="sticky-col border-right-thick-period"><strong>${r.YearMonth}</strong></td>
        <td><span class="badge badge-calc">${r.Window}</span></td>
        <td class="num border-right-thick-period">${r.Date || '<span class="text-muted">-</span>'}</td>
        <!-- ITS -->
        <td class="num"><strong>${fmtNum(r.its_total)}</strong></td>
        <td class="num border-right-thick-mpoa">${fmtPctSigned(r.its_mom)}</td>
        <!-- AmSpec -->
        <td class="num"><strong>${fmtNum(r.amspec_best)}</strong></td>
        <td class="num">${fmtNum(r.amspec_6prod)}</td>
        <td class="num border-right-thick-sppoma">${fmtPctSigned(r.amspec_mom)}</td>
        <!-- SGS -->
        <td class="num"><strong>${fmtNum(r.sgs_total)}</strong></td>
        <td class="num">${fmtNum(r.sgs_palm_sub)}</td>
        <td class="num border-right-thick-error">${fmtPctSigned(r.sgs_mom)}</td>
        <!-- Official MPOB -->
        <td class="num">${r.mpob_export != null ? `<strong>${fmtNum(r.mpob_export)}</strong>` : '<span class="text-muted">-</span>'}</td>
        <td class="num border-right-thick-mpob">${r.mpob_export_mom != null ? `<strong>${fmtPctSigned(r.mpob_export_mom, 2)}</strong>` : '<span class="text-muted">-</span>'}</td>
      </tr>`;
    });
    html += `</tbody></table>`;
    document.getElementById("survey-table1-container").innerHTML = html;
    return;
  }

  if (srcMode === "its") {
    const rows = itsList.filter(filterRow);
    const labels = rows.map(r => winFilter === "all" ? `${r.YearMonth} (${r.Window})` : r.YearMonth);

    document.getElementById("survey-chart1-title").textContent = `ITS Exports by Product (${winFilter}) — Tonnes`;
    document.getElementById("survey-chart1-sub").textContent = "LSEG Chain 0#ITSPALM1: CPO, RBD Palm Olein, RBD Palm Oil, RBD Stearin, CPKO, PFAD";

    STATE.charts.surveyMain = new Chart(
      document.getElementById("chart-survey-main").getContext("2d"),
      {
        type: "line",
        data: {
          labels,
          datasets: [
            { label: "Crude Palm Oil", data: rows.map(r => r.Crude_Palm_Oil_MT), borderColor: "#059669", borderWidth: 2.2, pointRadius: 2, tension: 0.2 },
            { label: "RBD Palm Olein", data: rows.map(r => r.RBD_Palm_Olein_MT), borderColor: "#0284c7", borderWidth: 2.2, pointRadius: 2, tension: 0.2 },
            { label: "RBD Palm Oil", data: rows.map(r => r.RBD_Palm_Oil_MT), borderColor: "#d97706", borderWidth: 2, pointRadius: 2, tension: 0.2 },
            { label: "RBD Palm Stearin", data: rows.map(r => r.RBD_Palm_Stearin_MT), borderColor: "#7c3aed", borderWidth: 2, pointRadius: 2, tension: 0.2 },
            { label: "PFAD", data: rows.map(r => r.PFAD_MT), borderColor: "#dc2626", borderWidth: 1.8, pointRadius: 1.5, tension: 0.2 },
            { label: "Crude PKO", data: rows.map(r => r.Crude_Palm_Kernel_Oil_MT), borderColor: "#64748b", borderWidth: 1.8, pointRadius: 1.5, tension: 0.2 }
          ]
        },
        options: chartOptionsCommon("Tonnes (MT)")
      }
    );

    document.getElementById("survey-chart2-title").textContent = `ITS Exports by Major Destination (${winFilter}) — Tonnes`;
    document.getElementById("survey-chart2-sub").textContent = "LSEG Chain 0#ITSPALM2: India & Subcontinent, European Union, China";

    STATE.charts.surveySub = new Chart(
      document.getElementById("chart-survey-sub").getContext("2d"),
      {
        type: "line",
        data: {
          labels,
          datasets: [
            { label: "India & Subcontinent", data: rows.map(r => r.Dest_India_Subcontinent_MT), borderColor: "#d97706", borderWidth: 2.4, pointRadius: 2.5, tension: 0.2 },
            { label: "European Union", data: rows.map(r => r.Dest_EU_MT), borderColor: "#2563eb", borderWidth: 2.2, pointRadius: 2.5, tension: 0.2 },
            { label: "China", data: rows.map(r => r.Dest_China_MT), borderColor: "#dc2626", borderWidth: 2.2, pointRadius: 2.5, tension: 0.2 }
          ]
        },
        options: chartOptionsCommon("Tonnes (MT)")
      }
    );

    document.getElementById("survey-table1-title").textContent = `ITS (Intertek Testing Services) Historical Breakdown (${winFilter}) — Tonnes`;
    const revRows = [...rows].reverse();
    let html = `<table class="data-table"><thead><tr>
      <th>Date</th>
      <th>Period</th>
      <th>Window</th>
      <th>Accumulated Total (MT)</th>
      <th>Full Month Total (MT)</th>
      <th>6-Products Sum (MT)</th>
      <th>Crude Palm Oil</th>
      <th>RBD Palm Oil</th>
      <th>RBD Palm Olein</th>
      <th>RBD Stearin</th>
      <th>Crude PKO</th>
      <th>PFAD</th>
      <th>Dest: EU</th>
      <th>Dest: China</th>
      <th>Dest: India &amp; Subc.</th>
    </tr></thead><tbody>`;
    revRows.forEach(r => {
      html += `<tr>
        <td class="sticky-col"><strong>${r.Date}</strong></td>
        <td>${r.YearMonth}</td>
        <td><span class="badge badge-calc">${r.Window}</span></td>
        <td class="num"><strong>${fmtNum(r.Total_Accumulated_Export_MT)}</strong></td>
        <td class="num">${fmtNum(r.Full_Month_Total_Export_MT)}</td>
        <td class="num">${fmtNum(r.Selected_6_Products_Sum_MT)}</td>
        <td class="num">${fmtNum(r.Crude_Palm_Oil_MT)}</td>
        <td class="num">${fmtNum(r.RBD_Palm_Oil_MT)}</td>
        <td class="num">${fmtNum(r.RBD_Palm_Olein_MT)}</td>
        <td class="num">${fmtNum(r.RBD_Palm_Stearin_MT)}</td>
        <td class="num">${fmtNum(r.Crude_Palm_Kernel_Oil_MT)}</td>
        <td class="num">${fmtNum(r.PFAD_MT)}</td>
        <td class="num">${fmtNum(r.Dest_EU_MT)}</td>
        <td class="num">${fmtNum(r.Dest_China_MT)}</td>
        <td class="num">${fmtNum(r.Dest_India_Subcontinent_MT)}</td>
      </tr>`;
    });
    html += `</tbody></table>`;
    document.getElementById("survey-table1-container").innerHTML = html;
    return;
  }

  if (srcMode === "amspec") {
    const rows = amspecList.filter(filterRow);
    const labels = rows.map(r => winFilter === "all" ? `${r.YearMonth} (${r.Window})` : r.YearMonth);

    document.getElementById("survey-chart1-title").textContent = `AmSpec Agri Malaysia Exports by Product (${winFilter}) — Tonnes`;
    document.getElementById("survey-chart1-sub").textContent = "LSEG Chain 0#REU-MYPALMEXP: CPO, RBD Palm Olein, RBD Palm Oil, RBD Stearin, CPKO, PFAD";

    STATE.charts.surveyMain = new Chart(
      document.getElementById("chart-survey-main").getContext("2d"),
      {
        type: "line",
        data: {
          labels,
          datasets: [
            { label: "Crude Palm Oil", data: rows.map(r => r.Crude_Palm_Oil_MT), borderColor: "#059669", borderWidth: 2.2, pointRadius: 2, tension: 0.2 },
            { label: "RBD Palm Olein", data: rows.map(r => r.RBD_Palm_Olein_MT), borderColor: "#0284c7", borderWidth: 2.2, pointRadius: 2, tension: 0.2 },
            { label: "RBD Palm Oil", data: rows.map(r => r.RBD_Palm_Oil_MT), borderColor: "#d97706", borderWidth: 2, pointRadius: 2, tension: 0.2 },
            { label: "RBD Stearin", data: rows.map(r => r.RBD_Palm_Stearin_MT), borderColor: "#7c3aed", borderWidth: 2, pointRadius: 2, tension: 0.2 },
            { label: "PFAD", data: rows.map(r => r.PFAD_MT), borderColor: "#dc2626", borderWidth: 1.8, pointRadius: 1.5, tension: 0.2 },
            { label: "Crude PKO", data: rows.map(r => r.Crude_Palm_Kernel_Oil_MT), borderColor: "#64748b", borderWidth: 1.8, pointRadius: 1.5, tension: 0.2 }
          ]
        },
        options: chartOptionsCommon("Tonnes (MT)")
      }
    );

    document.getElementById("survey-chart2-title").textContent = `AmSpec All-Products Headline Total vs. 6-Products RIC Total (${winFilter})`;
    document.getElementById("survey-chart2-sub").textContent = "Reuters TABLE release total (all products) vs. sum of 6 LSEG product RICs";

    STATE.charts.surveySub = new Chart(
      document.getElementById("chart-survey-sub").getContext("2d"),
      {
        type: "line",
        data: {
          labels,
          datasets: [
            { label: "Headline All-Products Total (MT)", data: rows.map(r => r.Headline_All_Products_Total_MT), borderColor: "#d97706", borderWidth: 2.5, pointRadius: 3, tension: 0.2 },
            { label: "6-Products RIC Total (REUMYPALMEXPTOT)", data: rows.map(r => r.Selected_6_Products_Total_MT), borderColor: "#0284c7", borderWidth: 2.2, borderDash: [4, 3], pointRadius: 2.5, tension: 0.2 }
          ]
        },
        options: chartOptionsCommon("Tonnes (MT)")
      }
    );

    document.getElementById("survey-table1-title").textContent = `AmSpec Agri Malaysia Product Breakdown (${winFilter}) — Tonnes`;
    const revRows = [...rows].reverse();
    let html = `<table class="data-table"><thead><tr>
      <th>Date</th>
      <th>Period</th>
      <th>Window</th>
      <th>Headline All-Products Total (MT)</th>
      <th>6-Products RIC Total (MT)</th>
      <th>Crude Palm Oil</th>
      <th>RBD Palm Oil</th>
      <th>RBD Palm Olein</th>
      <th>RBD Stearin</th>
      <th>Crude PKO</th>
      <th>PFAD</th>
    </tr></thead><tbody>`;
    revRows.forEach(r => {
      html += `<tr>
        <td class="sticky-col"><strong>${r.Date}</strong></td>
        <td>${r.YearMonth}</td>
        <td><span class="badge badge-calc">${r.Window}</span></td>
        <td class="num"><strong>${fmtNum(r.Headline_All_Products_Total_MT)}</strong></td>
        <td class="num"><strong>${fmtNum(r.Selected_6_Products_Total_MT)}</strong></td>
        <td class="num">${fmtNum(r.Crude_Palm_Oil_MT)}</td>
        <td class="num">${fmtNum(r.RBD_Palm_Oil_MT)}</td>
        <td class="num">${fmtNum(r.RBD_Palm_Olein_MT)}</td>
        <td class="num">${fmtNum(r.RBD_Palm_Stearin_MT)}</td>
        <td class="num">${fmtNum(r.Crude_Palm_Kernel_Oil_MT)}</td>
        <td class="num">${fmtNum(r.PFAD_MT)}</td>
      </tr>`;
    });
    html += `</tbody></table>`;
    document.getElementById("survey-table1-container").innerHTML = html;

    // Show Table 2: AmSpec Reuters Headlines Log
    const t2Card = document.getElementById("survey-table2-card");
    t2Card.style.display = "block";
    document.getElementById("survey-table2-title").textContent = "AmSpec Reuters News Release Flashes & Tables Log";
    const hRows = [...amspecHeadlines].filter(r => {
      const yr = Number(String(r.Date || "").slice(0, 4));
      return selYears.has(yr) && (winFilter === "all" || r.Window === winFilter);
    }).reverse();
    let hHtml = `<table class="data-table"><thead><tr>
      <th>Release Date</th>
      <th>Window</th>
      <th>Export Volume (MT)</th>
      <th>Prior Month Same Window (MT)</th>
      <th>Reuters Headline</th>
    </tr></thead><tbody>`;
    hRows.forEach(r => {
      hHtml += `<tr>
        <td class="sticky-col"><strong>${r.Date}</strong></td>
        <td><span class="badge badge-calc">${r.Window}</span></td>
        <td class="num"><strong>${fmtNum(r.All_Products_Export_MT)}</strong></td>
        <td class="num">${fmtNum(r.Prev_Month_Same_Window_MT)}</td>
        <td style="text-align:left;font-size:12px;">${r.Headline}</td>
      </tr>`;
    });
    hHtml += `</tbody></table>`;
    document.getElementById("survey-table2-container").innerHTML = hHtml;
    return;
  }

  if (srcMode === "sgs") {
    const pRows = sgsProdList.filter(filterRow);
    const dRows = sgsDestList.filter(filterRow);
    const labels = pRows.map(r => winFilter === "all" ? `${r.YearMonth} (${r.Window})` : r.YearMonth);

    document.getElementById("survey-chart1-title").textContent = `SGS Exports by Product (${winFilter}, 2010–2026) — Tonnes`;
    document.getElementById("survey-chart1-sub").textContent = "LSEG Chain 0#PALMEX-ST: CPO, RBD Palm Olein, RBD Palm Oil, RBD Stearin, Oleochemicals, Acids";

    STATE.charts.surveyMain = new Chart(
      document.getElementById("chart-survey-main").getContext("2d"),
      {
        type: "line",
        data: {
          labels,
          datasets: [
            { label: "Total Palm & Oleo (PALMTOT-MY)", data: pRows.map(r => r.Total_Palm_And_Oleo_Export_MT), borderColor: "#0f172a", borderWidth: 2.5, pointRadius: 2, tension: 0.2 },
            { label: "Sub-Total Palm Oil (PALMSTOT-MY)", data: pRows.map(r => r.SubTotal_Palm_Oil_Products_MT), borderColor: "#059669", borderWidth: 2.2, pointRadius: 2, tension: 0.2 },
            { label: "RBD Palm Olein", data: pRows.map(r => r.RBD_Palm_Olein_MT), borderColor: "#0284c7", borderWidth: 2, pointRadius: 1.5, tension: 0.2 },
            { label: "Crude Palm Oil", data: pRows.map(r => r.Crude_Palm_Oil_MT), borderColor: "#d97706", borderWidth: 2, pointRadius: 1.5, tension: 0.2 },
            { label: "RBD Palm Oil", data: pRows.map(r => r.RBD_Palm_Oil_MT), borderColor: "#7c3aed", borderWidth: 1.8, pointRadius: 1.5, tension: 0.2 },
            { label: "Sub-Total Other & Oleo", data: pRows.map(r => r.SubTotal_Other_Oils_And_Chem_MT), borderColor: "#64748b", borderWidth: 1.8, borderDash: [4, 3], pointRadius: 1.5, tension: 0.2 }
          ]
        },
        options: chartOptionsCommon("Tonnes (MT)")
      }
    );

    const dLabels = dRows.map(r => winFilter === "all" ? `${r.YearMonth} (${r.Window})` : r.YearMonth);
    document.getElementById("survey-chart2-title").textContent = `SGS Exports by Top Destinations (${winFilter}, 2010–2026) — Tonnes`;
    document.getElementById("survey-chart2-sub").textContent = "LSEG Chain 0#PALMEX-ST2: India, China, Europe, Pakistan, Kenya, Japan, Singapore, USA";

    STATE.charts.surveySub = new Chart(
      document.getElementById("chart-survey-sub").getContext("2d"),
      {
        type: "line",
        data: {
          labels: dLabels,
          datasets: [
            { label: "India", data: dRows.map(r => r.India_MT), borderColor: "#d97706", borderWidth: 2.3, pointRadius: 2, tension: 0.2 },
            { label: "China", data: dRows.map(r => r.China_MT), borderColor: "#dc2626", borderWidth: 2.3, pointRadius: 2, tension: 0.2 },
            { label: "Europe", data: dRows.map(r => r.Europe_MT), borderColor: "#2563eb", borderWidth: 2, pointRadius: 1.5, tension: 0.2 },
            { label: "Pakistan", data: dRows.map(r => r.Pakistan_MT), borderColor: "#059669", borderWidth: 1.8, pointRadius: 1.5, tension: 0.2 },
            { label: "Kenya", data: dRows.map(r => r.Kenya_MT), borderColor: "#7c3aed", borderWidth: 1.8, pointRadius: 1.5, tension: 0.2 },
            { label: "Japan", data: dRows.map(r => r.Japan_MT), borderColor: "#0d9488", borderWidth: 1.8, pointRadius: 1.5, tension: 0.2 }
          ]
        },
        options: chartOptionsCommon("Tonnes (MT)")
      }
    );

    // Table 1: SGS Products
    document.getElementById("survey-table1-title").textContent = `SGS Exports by Product (0#PALMEX-ST, ${winFilter}) — Tonnes`;
    const revP = [...pRows].reverse();
    let html1 = `<table class="data-table"><thead><tr>
      <th>Date</th>
      <th>Period</th>
      <th>Window</th>
      <th>Total Palm &amp; Oleo</th>
      <th>Sub-Total Palm Oil</th>
      <th>Crude Palm Oil</th>
      <th>RBD Palm Oil</th>
      <th>RBD Palm Olein</th>
      <th>RBD Stearin</th>
      <th>Sub-Total Other &amp; Chem</th>
      <th>Proc PKO</th>
      <th>Oleochemicals</th>
      <th>Acids</th>
      <th>Fatty Acids</th>
      <th>Other Products</th>
    </tr></thead><tbody>`;
    revP.forEach(r => {
      html1 += `<tr>
        <td class="sticky-col"><strong>${r.Date}</strong></td>
        <td>${r.YearMonth}</td>
        <td><span class="badge badge-calc">${r.Window}</span></td>
        <td class="num"><strong>${fmtNum(r.Total_Palm_And_Oleo_Export_MT)}</strong></td>
        <td class="num"><strong>${fmtNum(r.SubTotal_Palm_Oil_Products_MT)}</strong></td>
        <td class="num">${fmtNum(r.Crude_Palm_Oil_MT)}</td>
        <td class="num">${fmtNum(r.RBD_Palm_Oil_MT)}</td>
        <td class="num">${fmtNum(r.RBD_Palm_Olein_MT)}</td>
        <td class="num">${fmtNum(r.RBD_Palm_Stearin_MT)}</td>
        <td class="num"><strong>${fmtNum(r.SubTotal_Other_Oils_And_Chem_MT)}</strong></td>
        <td class="num">${fmtNum(r.Processed_PKO_MT)}</td>
        <td class="num">${fmtNum(r.Oleochemicals_MT)}</td>
        <td class="num">${fmtNum(r.Acids_MT)}</td>
        <td class="num">${fmtNum(r.Fatty_Acids_MT)}</td>
        <td class="num">${fmtNum(r.Other_Products_MT)}</td>
      </tr>`;
    });
    html1 += `</tbody></table>`;
    document.getElementById("survey-table1-container").innerHTML = html1;

    // Table 2: SGS Destinations
    const t2Card = document.getElementById("survey-table2-card");
    t2Card.style.display = "block";
    document.getElementById("survey-table2-title").textContent = `SGS Exports by Destination Country (0#PALMEX-ST2, ${winFilter}) — Tonnes`;
    const revD = [...dRows].reverse();
    let html2 = `<table class="data-table"><thead><tr>
      <th>Date</th>
      <th>Period</th>
      <th>Window</th>
      <th>India</th>
      <th>China</th>
      <th>Europe</th>
      <th>Pakistan</th>
      <th>USA</th>
      <th>Singapore</th>
      <th>Japan</th>
      <th>Korea</th>
      <th>Taiwan</th>
      <th>Bangladesh</th>
      <th>Saudi Arabia</th>
      <th>Turkey</th>
      <th>Kenya</th>
      <th>Egypt</th>
      <th>South Africa</th>
      <th>Iran</th>
    </tr></thead><tbody>`;
    revD.forEach(r => {
      html2 += `<tr>
        <td class="sticky-col"><strong>${r.Date}</strong></td>
        <td>${r.YearMonth}</td>
        <td><span class="badge badge-calc">${r.Window}</span></td>
        <td class="num"><strong>${fmtNum(r.India_MT)}</strong></td>
        <td class="num"><strong>${fmtNum(r.China_MT)}</strong></td>
        <td class="num">${fmtNum(r.Europe_MT)}</td>
        <td class="num">${fmtNum(r.Pakistan_MT)}</td>
        <td class="num">${fmtNum(r.USA_MT)}</td>
        <td class="num">${fmtNum(r.Singapore_MT)}</td>
        <td class="num">${fmtNum(r.Japan_MT)}</td>
        <td class="num">${fmtNum(r.Korea_MT)}</td>
        <td class="num">${fmtNum(r.Taiwan_MT)}</td>
        <td class="num">${fmtNum(r.Bangladesh_MT)}</td>
        <td class="num">${fmtNum(r.Saudi_Arabia_MT)}</td>
        <td class="num">${fmtNum(r.Turkey_MT)}</td>
        <td class="num">${fmtNum(r.Kenya_MT)}</td>
        <td class="num">${fmtNum(r.Egypt_MT)}</td>
        <td class="num">${fmtNum(r.South_Africa_MT)}</td>
        <td class="num">${fmtNum(r.Iran_MT)}</td>
      </tr>`;
    });
    html2 += `</tbody></table>`;
    document.getElementById("survey-table2-container").innerHTML = html2;
  }
}

function renderSurveyProduction() {
  const spList = STATE.master.trackers?.sppoma_mpoa || [];
  const flashes = STATE.master.lseg_surveyors?.mpoa_sppoma_flashes || [];
  const sndMonthly = STATE.master.snd?.monthly || {};

  // Build LSEG Wire Flashes index by YYYY-MM
  const flashByPeriod = {};
  flashes.forEach(f => {
    const ym = (f.Reference_Period || "").slice(0, 7);
    if (!ym) return;
    if (!flashByPeriod[ym]) flashByPeriod[ym] = [];
    flashByPeriod[ym].push(f);
  });

  // Selected years: default to 2020-2026 if default Last 5Y (2023-2027) is active,
  // or follow user's specific slicer selection
  const rawSelYears = getSurveySelectedYearsSet(2010, 2026);
  let selYears = rawSelYears;
  const isDefaultLast5 = rawSelYears.size <= 4 && [2023, 2024, 2025, 2026].every(y => rawSelYears.has(y));
  if (isDefaultLast5) {
    selYears = new Set([2020, 2021, 2022, 2023, 2024, 2025, 2026]);
  }

  // Filter rows for selected years - include EVERY MONTH (no survey print filtering)
  const displayRows = spList.filter(r => {
    const yr = Number(String(r.period || "").slice(0, 4));
    return selYears.has(yr);
  });

  // Chart 1: SPPOMA & MPOA vs Official MPOB CPO MoM (%)
  document.getElementById("survey-chart1-title").textContent = "Production Surveys (MPOA & SPPOMA) vs. Official MPOB CPO MoM (%)";
  document.getElementById("survey-chart1-sub").textContent = "Verified bulletin prints & wire captures vs. Official MPOB Monthly Production MoM (%)";

  const labels = displayRows.map(r => r.period);
  STATE.charts.surveyMain = new Chart(
    document.getElementById("chart-survey-main").getContext("2d"),
    {
      type: "bar",
      data: {
        labels,
        datasets: [
          {
            label: "SPPOMA (Full Month / Latest CPO MoM %)",
            data: displayRows.map(r => {
              const sp = r.sppoma || {};
              return sp.full_month?.cpo_prod_mom_pct ?? sp["1-25"]?.cpo_prod_mom_pct ?? sp["1-20"]?.cpo_prod_mom_pct ?? sp["1-15"]?.cpo_prod_mom_pct ?? sp["1-10"]?.cpo_prod_mom_pct ?? sp["1-5"]?.cpo_prod_mom_pct ?? null;
            }),
            backgroundColor: "rgba(217, 119, 6, 0.78)",
            borderColor: "#d97706",
            borderWidth: 1
          },
          {
            label: "MPOA Full Month Total MoM (%)",
            data: displayRows.map(r => r.mpoa?.full_month?.total_malaysia_mom_pct ?? r.mpoa?.["1-20"]?.total_malaysia_mom_pct ?? null),
            backgroundColor: "rgba(2, 132, 199, 0.82)",
            borderColor: "#0284c7",
            borderWidth: 1
          },
          {
            label: "Official MPOB CPO MoM (%)",
            data: displayRows.map(r => r.mpob_actual?.cpo_mom_pct ?? null),
            backgroundColor: "rgba(5, 150, 105, 0.85)",
            borderColor: "#059669",
            borderWidth: 1
          }
        ]
      },
      options: chartOptionsCommon("MoM Change (%)")
    }
  );

  // Chart 2: Intra-Month SPPOMA & MPOA Convergence for Jul, Aug, Sep 2026
  document.getElementById("survey-chart2-title").textContent = "Intra-Month Production Survey Convergence (1–5 → Full Month → MPOB Actual)";
  document.getElementById("survey-chart2-sub").textContent = "SPPOMA 5-day intervals, MPOA (1–20 & Full Month), and Official MPOB MoM (%)";

  const convLabels = ["SPPOMA 1–5", "SPPOMA 1–10", "SPPOMA 1–15", "SPPOMA 1–20", "MPOA 1–20", "SPPOMA 1–25", "SPPOMA Full", "MPOA Full", "MPOB Official"];
  const getConvData = (ym) => {
    const r = spList.find(x => x.period === ym);
    if (!r) return [];
    return [
      r.sppoma?.["1-5"]?.cpo_prod_mom_pct ?? null,
      r.sppoma?.["1-10"]?.cpo_prod_mom_pct ?? null,
      r.sppoma?.["1-15"]?.cpo_prod_mom_pct ?? null,
      r.sppoma?.["1-20"]?.cpo_prod_mom_pct ?? null,
      r.mpoa?.["1-20"]?.total_malaysia_mom_pct ?? null,
      r.sppoma?.["1-25"]?.cpo_prod_mom_pct ?? null,
      r.sppoma?.full_month?.cpo_prod_mom_pct ?? null,
      r.mpoa?.full_month?.total_malaysia_mom_pct ?? null,
      r.mpob_actual?.cpo_mom_pct ?? null
    ];
  };

  STATE.charts.surveySub = new Chart(
    document.getElementById("chart-survey-sub").getContext("2d"),
    {
      type: "line",
      data: {
        labels: convLabels,
        datasets: [
          { label: "Sep 2026", data: getConvData("2026-09"), borderColor: "#059669", borderWidth: 2.8, pointRadius: 4, tension: 0.2, spanGaps: true },
          { label: "Aug 2026", data: getConvData("2026-08"), borderColor: "#0284c7", borderWidth: 2.4, pointRadius: 3.5, tension: 0.2, spanGaps: true },
          { label: "Jul 2026", data: getConvData("2026-07"), borderColor: "#d97706", borderWidth: 2.2, pointRadius: 3.5, tension: 0.2, spanGaps: true }
        ]
      },
      options: chartOptionsCommon("MoM Change (%)")
    }
  );

  // Table 1: Renamed to "Survey" with categorized headers and thicker vertical borders
  document.getElementById("survey-table1-title").textContent = "Survey";

  // Reverse chronological order for the table (latest month first)
  const revRows = [...displayRows].reverse();

  let html = `<table class="data-table">
    <thead>
      <tr>
        <th rowspan="2" class="th-group-period border-right-thick-period" style="vertical-align:middle; text-align:center;">Period</th>
        <th colspan="6" class="th-group-sppoma border-right-thick-sppoma" style="text-align:center;">SPPOMA (MoM %)</th>
        <th colspan="5" class="th-group-mpoa border-right-thick-mpoa" style="text-align:center;">MPOA (MoM %)</th>
        <th colspan="2" class="th-group-mpob border-right-thick-mpob" style="text-align:center;">Official MPOB Actuals</th>
        <th colspan="2" class="th-group-error border-right-thick-error" style="text-align:center;">Tracking Error vs MPOB (pp)</th>
        <th rowspan="2" class="th-group-note" style="vertical-align:middle; text-align:left;">Survey Notes &amp; LSEG Wire Captures</th>
      </tr>
      <tr>
        <!-- SPPOMA sub-columns -->
        <th>1–5</th>
        <th>1–10</th>
        <th>1–15</th>
        <th>1–20</th>
        <th>1–25</th>
        <th class="border-right-thick-sppoma">Full Month</th>
        <!-- MPOA sub-columns -->
        <th>1–20 Total</th>
        <th>Full Total</th>
        <th>Penin.</th>
        <th>Sabah</th>
        <th class="border-right-thick-mpoa">Sarawak</th>
        <!-- MPOB sub-columns -->
        <th>Production (MT)</th>
        <th class="border-right-thick-mpob">MoM (%)</th>
        <!-- Error sub-columns -->
        <th>MPOA Diff</th>
        <th class="border-right-thick-error">SPPOMA Diff</th>
      </tr>
    </thead>
    <tbody>`;

  revRows.forEach(r => {
    const sp = r.sppoma || {};
    const mp = r.mpoa || {};
    const act = r.mpob_actual || {};
    const an = r.analytics || {};
    const flList = flashByPeriod[r.period] || [];

    // Synthesize notes and wire captures
    const notes = [];
    if (flList.length > 0) {
      flList.forEach(f => {
        notes.push(`<span class="wire-badge">⚡ ${f.Association} Wire</span> <strong>${f.Window}</strong> ${fmtPctSigned(f.Production_MoM_Pct, 2)} <span class="text-muted">(${f.Date})</span>`);
      });
    }
    if (r.period === "2021-01") {
      notes.push(`<span class="text-muted">⚠️ MCO: MPOA did not release full month Jan 2021</span>`);
    }
    const notesHtml = notes.length > 0 ? notes.join(" &bull; ") : '<span class="text-muted">-</span>';

    // Cell wire indicators for direct wire flashes
    const hasSpWire15 = r.period === "2026-03";
    const hasMpWire20 = r.period === "2026-07";
    const hasMpWireFull = r.period === "2026-09";

    const sp15Val = sp["1-15"]?.cpo_prod_mom_pct;
    const mp20Val = mp["1-20"]?.total_malaysia_mom_pct;
    const mpFullVal = mp.full_month?.total_malaysia_mom_pct;

    // Production tonnes & MoM from mpob_actual or sndMonthly
    const sndEntry = sndMonthly[r.period] || {};
    const prodTonnes = act.cpo_production_tonnes ?? sndEntry.production ?? null;
    const prodMom = act.cpo_mom_pct ?? null;

    // Error calculations
    let mpoaErr = an.mpoa_full_month_error_pct;
    if (mpoaErr == null && mpFullVal != null && prodMom != null) {
      mpoaErr = Math.round((mpFullVal - prodMom) * 100) / 100;
    }
    let sppomaErr = an.sppoma_full_month_error_pct;
    if (sppomaErr == null && sp.full_month?.cpo_prod_mom_pct != null && prodMom != null) {
      sppomaErr = Math.round((sp.full_month.cpo_prod_mom_pct - prodMom) * 100) / 100;
    }

    html += `<tr>
      <td class="sticky-col border-right-thick-period"><strong>${r.period}</strong></td>
      <!-- SPPOMA -->
      <td class="num">${fmtPctSigned(sp["1-5"]?.cpo_prod_mom_pct, 2)}</td>
      <td class="num">${fmtPctSigned(sp["1-10"]?.cpo_prod_mom_pct, 2)}</td>
      <td class="num">${fmtPctSigned(sp15Val, 2)}${hasSpWire15 ? '<span class="wire-cell-indicator" title="Captured from LSEG News Wire">⚡</span>' : ''}</td>
      <td class="num">${fmtPctSigned(sp["1-20"]?.cpo_prod_mom_pct, 2)}</td>
      <td class="num">${fmtPctSigned(sp["1-25"]?.cpo_prod_mom_pct, 2)}</td>
      <td class="num border-right-thick-sppoma"><strong>${fmtPctSigned(sp.full_month?.cpo_prod_mom_pct, 2)}</strong></td>
      <!-- MPOA -->
      <td class="num"><strong>${fmtPctSigned(mp20Val, 2)}</strong>${hasMpWire20 ? '<span class="wire-cell-indicator" title="Captured from LSEG News Wire">⚡</span>' : ''}</td>
      <td class="num"><strong>${fmtPctSigned(mpFullVal, 2)}</strong>${hasMpWireFull ? '<span class="wire-cell-indicator" title="Captured from LSEG News Wire">⚡</span>' : ''}</td>
      <td class="num">${fmtPctSigned(mp.full_month?.peninsular_mom_pct ?? mp["1-20"]?.peninsular_mom_pct, 2)}</td>
      <td class="num">${fmtPctSigned(mp.full_month?.sabah_mom_pct ?? mp["1-20"]?.sabah_mom_pct, 2)}</td>
      <td class="num border-right-thick-mpoa">${fmtPctSigned(mp.full_month?.sarawak_mom_pct ?? mp["1-20"]?.sarawak_mom_pct, 2)}</td>
      <!-- Official MPOB -->
      <td class="num"><strong>${prodTonnes != null ? fmtNum(prodTonnes) : '<span class="text-muted">-</span>'}</strong></td>
      <td class="num border-right-thick-mpob"><strong>${fmtPctSigned(prodMom, 2)}</strong></td>
      <!-- Tracking Error -->
      <td class="num">${fmtDelta(mpoaErr, 2)}</td>
      <td class="num border-right-thick-error">${fmtDelta(sppomaErr, 2)}</td>
      <!-- Notes & Wire Captures -->
      <td style="text-align:left; font-size:11px;">${notesHtml}</td>
    </tr>`;
  });

  html += `</tbody></table>`;
  document.getElementById("survey-table1-container").innerHTML = html;

  // Pull LSEG Wire Flashes into the main table above -> Hide redundant Table 2
  const t2Card = document.getElementById("survey-table2-card");
  if (t2Card) t2Card.style.display = "none";
}

function renderSurveyPoll() {
  const pollList = STATE.master.lseg_surveyors?.reuters_mpob_poll || [];
  const sndMonthly = STATE.master.snd?.monthly || {};
  const selYears = getSurveySelectedYearsSet(2015, 2026);
  const attr = STATE.surveyPollAttr; // "Production" | "Export" | "Import" | "Closing_Stocks"

  const sndKeyMap = {
    Production: "production",
    Export: "export",
    Import: "import",
    Closing_Stocks: "end_stock"
  };
  const sndField = sndKeyMap[attr] || "production";

  const rows = pollList.filter(r => {
    const yr = Number(String(r.YearMonth || "").slice(0, 4));
    return selYears.has(yr);
  });

  const labels = rows.map(r => r.YearMonth);
  const medVals = rows.map(r => r[`${attr}_Poll_Median_MT`] ?? null);
  const lowVals = rows.map(r => r[`${attr}_Poll_Low_MT`] ?? null);
  const highVals = rows.map(r => r[`${attr}_Poll_High_MT`] ?? null);
  const actVals = rows.map(r => sndMonthly[r.YearMonth]?.[sndField] ?? null);
  const diffVals = rows.map((r, i) => (actVals[i] != null && medVals[i] != null) ? (actVals[i] - medVals[i]) : null);

  const attrDisplay = attr.replace("_", " ");
  document.getElementById("survey-chart1-title").textContent = `Reuters Pre-MPOB Poll vs. Official MPOB Actual: ${attrDisplay} (Tonnes)`;
  document.getElementById("survey-chart1-sub").textContent = "LSEG Chain 0#REU-PALMOILSTK: Poll Median, Poll High–Low Range, and Official MPOB Actual";

  STATE.charts.surveyMain = new Chart(
    document.getElementById("chart-survey-main").getContext("2d"),
    {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: "Poll Low",
            data: lowVals,
            borderColor: "transparent",
            pointRadius: 0,
            fill: false,
            tension: 0.2
          },
          {
            label: "Poll Low–High Range",
            data: highVals,
            borderColor: "transparent",
            backgroundColor: "rgba(148, 163, 184, 0.25)",
            pointRadius: 0,
            fill: "-1",
            tension: 0.2
          },
          {
            label: `Reuters Poll Median (${attrDisplay})`,
            data: medVals,
            borderColor: "#d97706",
            borderWidth: 2.3,
            borderDash: [4, 3],
            pointRadius: 2.5,
            fill: false,
            tension: 0.2
          },
          {
            label: `Official MPOB Actual (${attrDisplay})`,
            data: actVals,
            borderColor: "#059669",
            borderWidth: 2.6,
            pointRadius: 2.8,
            fill: false,
            tension: 0.2
          }
        ]
      },
      options: {
        ...chartOptionsCommon("Tonnes (MT)"),
        plugins: {
          ...chartOptionsCommon("Tonnes (MT)").plugins,
          legend: {
            labels: { filter: item => item.text !== "Poll Low" }
          }
        }
      }
    }
  );

  document.getElementById("survey-chart2-title").textContent = `Actual vs. Reuters Poll Surprise: ${attrDisplay} (Official Actual − Poll Median)`;
  document.getElementById("survey-chart2-sub").textContent = "Positive = Official MPOB higher than Poll Consensus; Negative = lower than Poll Consensus";

  STATE.charts.surveySub = new Chart(
    document.getElementById("chart-survey-sub").getContext("2d"),
    {
      type: "bar",
      data: {
        labels,
        datasets: [
          {
            label: `${attrDisplay} Surprise vs Poll (MT)`,
            data: diffVals,
            backgroundColor: diffVals.map(v => v == null ? "transparent" : v >= 0 ? "rgba(5, 150, 105, 0.75)" : "rgba(220, 38, 38, 0.75)"),
            borderColor: diffVals.map(v => v == null ? "transparent" : v >= 0 ? "#059669" : "#dc2626"),
            borderWidth: 1
          }
        ]
      },
      options: chartOptionsCommon("Surprise (Tonnes)")
    }
  );

  // Table 1: Full Poll vs Official MPOB Table
  document.getElementById("survey-table1-title").textContent = "Reuters Monthly Pre-MPOB Poll Consensus vs. Official MPOB Actuals (2015–2026, Tonnes)";
  const revRows = [...rows].reverse();
  let html = `<table class="data-table"><thead><tr>
    <th>Period</th>
    <th>Prod Poll Median</th>
    <th>Prod Poll Range (Low–High)</th>
    <th>Prod MPOB Actual</th>
    <th>Prod Surprise</th>
    <th>Export Poll Median</th>
    <th>Export MPOB Actual</th>
    <th>Export Surprise</th>
    <th>Stock Poll Median</th>
    <th>Stock Poll Range (Low–High)</th>
    <th>Stock MPOB Actual</th>
    <th>Stock Surprise</th>
  </tr></thead><tbody>`;

  revRows.forEach(r => {
    const ym = r.YearMonth;
    const act = sndMonthly[ym] || {};
    const pMed = r.Production_Poll_Median_MT;
    const pAct = act.production;
    const pDiff = (pAct != null && pMed != null) ? (pAct - pMed) : null;

    const eMed = r.Export_Poll_Median_MT;
    const eAct = act.export;
    const eDiff = (eAct != null && eMed != null) ? (eAct - eMed) : null;

    const sMed = r.Closing_Stocks_Poll_Median_MT;
    const sAct = act.end_stock;
    const sDiff = (sAct != null && sMed != null) ? (sAct - sMed) : null;

    html += `<tr>
      <td class="sticky-col"><strong>${ym}</strong></td>
      <td class="num">${fmtNum(pMed)}</td>
      <td class="num" style="font-size:11px;color:var(--text-muted);">${fmtNum(r.Production_Poll_Low_MT)} – ${fmtNum(r.Production_Poll_High_MT)}</td>
      <td class="num"><strong>${fmtNum(pAct)}</strong></td>
      <td class="num">${fmtDelta(pDiff)}</td>
      <td class="num">${fmtNum(eMed)}</td>
      <td class="num"><strong>${fmtNum(eAct)}</strong></td>
      <td class="num">${fmtDelta(eDiff)}</td>
      <td class="num">${fmtNum(sMed)}</td>
      <td class="num" style="font-size:11px;color:var(--text-muted);">${fmtNum(r.Closing_Stocks_Poll_Low_MT)} – ${fmtNum(r.Closing_Stocks_Poll_High_MT)}</td>
      <td class="num"><strong>${fmtNum(sAct)}</strong></td>
      <td class="num">${fmtDelta(sDiff)}</td>
    </tr>`;
  });
  html += `</tbody></table>`;
  document.getElementById("survey-table1-container").innerHTML = html;
}

function chartOptionsCommon(yTitle) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: "index", intersect: false },
    plugins: {
      legend: {
        labels: { color: "#334155", font: { family: "'Inter', sans-serif", size: 11.5 } }
      },
      tooltip: {
        backgroundColor: "rgba(255, 255, 255, 0.96)",
        titleColor: "#0f172a",
        bodyColor: "#334155",
        borderColor: "#cbd5e1",
        borderWidth: 1
      }
    },
    scales: {
      x: {
        ticks: { color: "#64748b", maxTicksLimit: 20, font: { size: 11 } },
        grid: { color: "rgba(100, 116, 139, 0.1)" }
      },
      y: {
        title: { display: Boolean(yTitle), text: yTitle, color: "#475569", font: { size: 11, weight: "bold" } },
        ticks: { color: "#64748b", font: { family: "'JetBrains Mono', monospace", size: 11 } },
        grid: { color: "rgba(100, 116, 139, 0.1)" }
      }
    }
  };
}

// APPLICATION INITIALIZATION ENTRY POINT
// ---------------------------------------------------------------------------
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initDashboard);
} else {
  initDashboard();
}
