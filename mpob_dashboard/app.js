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
  sndExpandedYears: new Set([2025, 2026, 2027]),
  sndChartFreq: "monthly",
  sndCompareAttr: "production", // "production" | "export" | "import" | "local_disappearance" | "end_stock" | "stocks_to_use"

  // Tab 2: Area state
  areaViewMode: "regional", // "regional" | "states" | "category"
  areaEntities: new Set(["Malaysia"]),

  // Tab 3: Production state
  prodAttr: "cpo_production",
  prodState: "Malaysia",
  prodExpandedYears: new Set([2026, 2027]),

  // Tab 4: My Forecast state
  myFcstStateMetric: "cpo_production",

  // Tab 5: Imports state
  impExpandedYears: new Set([2025, 2026, 2027]),

  // Tab 6: Exports state
  expSplitMode: "both",     // "both" | "ports" | "products"
  expExpandedYears: new Set([2025, 2026]),

  // Tab 7: Stocks state
  stkExpandedYears: new Set([2025, 2026]),

  // Tab 8: Seasonality state
  seasonAttr: "snd.production",
  seasonFcstMode: "model",

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

    // Check localStorage for any saved custom user forecast when running standalone
    const localSaved = localStorage.getItem("my_forecast_malaysia_palm");
    if (localSaved) {
      try {
        STATE.userForecast = JSON.parse(localSaved);
      } catch (e) {
        STATE.userForecast = data.user_forecast || JSON.parse(JSON.stringify(data.user_forecast_defaults));
      }
    } else {
      STATE.userForecast = data.user_forecast || JSON.parse(JSON.stringify(data.user_forecast_defaults));
    }

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
  if (a26) document.getElementById("kpi-2026-prod").textContent = `${fmtNum(a26.production)} T [FCST]`;
  if (a27) document.getElementById("kpi-2027-prod").textContent = `${fmtNum(a27.production)} T [FCST]`;
}

function renderYearSlicer() {
  const container = document.getElementById("year-pills-container");
  container.innerHTML = "";
  ALL_YEARS.forEach(yr => {
    const pill = document.createElement("button");
    pill.className = "year-pill";
    if (STATE.selectedYears.has(yr)) pill.classList.add("selected");
    if (yr >= 2026) pill.classList.add("is-fcst-year");
    pill.textContent = yr === 2026 ? "2026*" : yr === 2027 ? "2027F" : String(yr);
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

  // Tab 4: My Forecast Controls
  const trackerPeriodSel = document.getElementById("tracker-target-period");
  const fcstPeriods = STATE.master.metadata.forecast_periods || [];
  trackerPeriodSel.innerHTML = fcstPeriods.map(p => `<option value="${p}">${p}</option>`).join("");

  document.getElementById("btn-apply-prod-tracker").addEventListener("click", applyFrontMonthProdTracker);
  document.getElementById("btn-apply-exp-tracker").addEventListener("click", applyFrontMonthExpTracker);
  document.getElementById("btn-save-user-fcst").addEventListener("click", saveUserForecastToServer);
  document.getElementById("btn-copy-model-to-user").addEventListener("click", () => resetUserForecast("model"));
  document.getElementById("btn-reset-excel-fcst").addEventListener("click", () => resetUserForecast("excel"));
  document.getElementById("btn-sync-states-to-snd").addEventListener("click", syncUserStatesToNationalSnd);

  document.querySelectorAll("#my-fcst-state-metric .seg-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("#my-fcst-state-metric .seg-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      STATE.myFcstStateMetric = btn.dataset.metric;
      renderMyForecastStatesTable();
    });
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
}

function renderActiveTab() {
  switch (STATE.activeTab) {
    case "tab-snd": renderSndTab(); break;
    case "tab-area": renderAreaTab(); break;
    case "tab-prod": renderProdTab(); break;
    case "tab-my-fcst": renderMyForecastTab(); break;
    case "tab-imports": renderImportsTab(); break;
    case "tab-exports": renderExportsTab(); break;
    case "tab-stocks": renderStocksTab(); break;
    case "tab-seasonality": renderSeasonalityTab(); break;
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
  renderSndTable();
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
    const fcstTag = yr >= 2026 ? " [FCST]" : "";
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

  container.querySelectorAll(".col-year-header").forEach(th => {
    th.addEventListener("click", () => {
      const yr = Number(th.dataset.year);
      if (yr < 2005) return;
      if (STATE.sndExpandedYears.has(yr)) STATE.sndExpandedYears.delete(yr);
      else STATE.sndExpandedYears.add(yr);
      renderSndTable();
    });
  });
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
          // Normal click toggles, or sets single if clicked another
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
    const years = getSortedSelectedYears(minYr, 2025);

    const labels = years.map(y => String(y));
    const matTotalByYear = [];
    const immTotalByYear = [];
    const ffbYieldByYear = [];

    years.forEach(yr => {
      const yrStr = String(yr);
      let yMat = 0, yImm = 0;
      let ffbSum = 0, ffbHa = 0;

      selectedEnts.forEach(ent => {
        const obj = (yr >= 2011 && stArea[yrStr] && stArea[yrStr][ent])
          ? stArea[yrStr][ent]
          : (regArea[yrStr] ? regArea[yrStr][ent] : null);
        if (obj) {
          yMat += obj.mature_ha || 0;
          yImm += obj.immature_ha || 0;
        }
        const aProd = ffbStateHist[yr]?.entities?.[ent];
        if (aProd?.ffb_yield && obj?.mature_ha) {
          ffbSum += aProd.ffb_yield * obj.mature_ha;
          ffbHa += obj.mature_ha;
        }
      });
      matTotalByYear.push(yMat);
      immTotalByYear.push(yImm);
      ffbYieldByYear.push(ffbHa > 0 ? Number((ffbSum / ffbHa).toFixed(2)) : (ffbStateHist[yr]?.entities?.[selectedEnts[0]]?.ffb_yield ?? null));
    });

    const entTitle = selectedEnts.length === 1 ? selectedEnts[0] : `${selectedEnts.length} Selected Regions (${selectedEnts.slice(0, 3).join(", ")}${selectedEnts.length > 3 ? "..." : ""})`;
    document.getElementById("area-chart1-title").textContent = `${entTitle}: Mature vs Immature Planted Area (Ha) & FFB Yield (T/Ha)`;

    const ctx1 = document.getElementById("chart-area-stacked").getContext("2d");
    STATE.charts.areaStacked = new Chart(ctx1, {
      type: "bar",
      data: {
        labels,
        datasets: [
          {
            type: "line",
            label: "Annual FFB Yield (Tonnes/Ha) - RHS",
            data: ffbYieldByYear,
            borderColor: "#2563eb",
            backgroundColor: "#2563eb",
            borderWidth: 2.6,
            pointRadius: 3,
            tension: 0.25,
            yAxisID: "y1"
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
            title: { display: true, text: "Planted Area (Ha)", color: "#059669", font: { weight: "bold" } },
            ticks: { color: "#64748b" },
            grid: { color: "rgba(100,116,139,0.08)" }
          },
          y1: {
            position: "right",
            title: { display: true, text: "FFB Yield (Tonnes/Ha)", color: "#2563eb", font: { weight: "bold" } },
            ticks: { color: "#2563eb", font: { family: "'JetBrains Mono', monospace" } },
            grid: { drawOnChartArea: false }
          }
        }
      }
    });

    // Multi-Region Table (standardized column widths)
    let html = `<table class="data-table"><thead><tr>
      <th style="min-width:220px;width:220px;">Region / State</th>
      <th class="col-metric">Metric</th>
      ${years.map(y => `<th class="col-annual">${y}</th>`).join("")}
    </tr></thead><tbody>`;

    selectedEnts.forEach(ent => {
      const isReg = ent.includes("Malaysia") || ent.includes("Sabah & Sarawak");
      const rCls = isReg ? "row-subtotal" : "";

      // 1. Mature Area row
      html += `<tr class="${rCls}"><td class="sticky-col" rowspan="5" style="vertical-align:top;font-weight:700;">${ent}</td>
        <td class="col-metric">Mature Area (Ha)</td>`;
      years.forEach(yr => {
        const obj = (yr >= 2011 && stArea[String(yr)]?.[ent]) ? stArea[String(yr)][ent] : regArea[String(yr)]?.[ent];
        html += `<td class="num col-annual">${fmtNum(obj?.mature_ha, 0)}</td>`;
      });
      html += `</tr>`;

      // 2. Immature Area row
      html += `<tr class="${rCls}"><td class="col-metric">Immature Area (Ha)</td>`;
      years.forEach(yr => {
        const obj = (yr >= 2011 && stArea[String(yr)]?.[ent]) ? stArea[String(yr)][ent] : regArea[String(yr)]?.[ent];
        html += `<td class="num col-annual">${fmtNum(obj?.immature_ha, 0)}</td>`;
      });
      html += `</tr>`;

      // 3. Total Area (Ha)
      html += `<tr class="${rCls}"><td class="col-metric" style="font-weight:700;">Total Area (Ha)</td>`;
      years.forEach(yr => {
        const obj = (yr >= 2011 && stArea[String(yr)]?.[ent]) ? stArea[String(yr)][ent] : regArea[String(yr)]?.[ent];
        html += `<td class="num col-annual" style="font-weight:700;">${fmtNum(obj?.total_ha, 0)}</td>`;
      });
      html += `</tr>`;

      // 4. % Mature row
      html += `<tr class="${rCls}"><td class="col-metric" style="color:#059669;font-weight:600;">% Mature</td>`;
      years.forEach(yr => {
        const obj = (yr >= 2011 && stArea[String(yr)]?.[ent]) ? stArea[String(yr)][ent] : regArea[String(yr)]?.[ent];
        const pct = obj?.mature_pct ?? (obj?.total_ha && obj?.mature_ha ? Number((obj.mature_ha / obj.total_ha * 100).toFixed(1)) : null);
        html += `<td class="num col-annual" style="color:#059669;font-weight:600;">${pct !== null && pct !== undefined ? pct.toFixed(1) + '%' : '--'}</td>`;
      });
      html += `</tr>`;

      // 5. Annual FFB Yield row (RHS metric)
      html += `<tr class="${rCls}" style="border-bottom:2px solid var(--border-strong);">
        <td class="col-metric" style="color:#2563eb;font-weight:600;">FFB Yield (T/Ha)</td>`;
      years.forEach(yr => {
        const yld = ffbStateHist[yr]?.entities?.[ent]?.ffb_yield;
        html += `<td class="num col-annual" style="color:#2563eb;font-weight:700;">${fmtNum(yld, 2)}</td>`;
      });
      html += `</tr>`;
    });

    html += `</tbody></table>`;
    container.innerHTML = html;

  } else if (STATE.areaViewMode === "states") {
    // All 13 States Matrix (2011 - 2025)
    const stYears = getSortedSelectedYears(2011, 2025);
    const allEnts = [...STATE.master.metadata.states, "Peninsular Malaysia", "Sabah & Sarawak", "Malaysia"];
    let html = `<table class="data-table"><thead><tr><th style="min-width:200px;width:200px;">State / Region</th>`;
    stYears.forEach(yr => {
      html += `<th colspan="3" style="text-align:center;">${yr}</th>`;
    });
    html += `</tr><tr><th></th>`;
    stYears.forEach(() => {
      html += `<th>Mature</th><th>Immature</th><th>Total Ha</th>`;
    });
    html += `</tr></thead><tbody>`;

    allEnts.forEach(s => {
      const isReg = s.includes("Malaysia") || s.includes("Sabah & Sarawak");
      html += `<tr class="${isReg ? 'row-subtotal' : ''}"><td class="sticky-col">${s}</td>`;
      stYears.forEach(yr => {
        const d = stArea[String(yr)]?.[s] || {};
        html += `<td class="num">${fmtNum(d.mature_ha)}</td>
                 <td class="num">${fmtNum(d.immature_ha)}</td>
                 <td class="num"><strong>${fmtNum(d.total_ha)}</strong></td>`;
      });
      html += `</tr>`;
    });
    html += `</tbody></table>`;
    container.innerHTML = html;

  } else {
    // Producer Category View (2015-2025)
    const cYears = Object.keys(catArea).sort();
    const cats = ["Independent Smallholders", "Organised Smallholders", "Private Estates", "Govt/State Agencies"];
    const colors = ["#d97706", "#2563eb", "#059669", "#9333ea"];

    const ctx1 = document.getElementById("chart-area-stacked").getContext("2d");
    STATE.charts.areaStacked = new Chart(ctx1, {
      type: "bar",
      data: {
        labels: cYears,
        datasets: cats.map((c, idx) => ({
          label: c,
          data: cYears.map(y => catArea[y][c]?.hectares ?? null),
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

    let html = `<table class="data-table"><thead><tr><th style="min-width:220px;width:220px;">Category</th>`;
    cYears.forEach(y => { html += `<th>${y} (Ha)</th><th>${y} (%)</th>`; });
    html += `</tr></thead><tbody>`;
    [...cats, "Total"].forEach(c => {
      html += `<tr class="${c === 'Total' ? 'row-highlight' : ''}"><td class="sticky-col">${c}</td>`;
      cYears.forEach(y => {
        const d = catArea[y][c] || {};
        html += `<td class="num">${fmtNum(d.hectares)}</td><td class="num">${d.pct ?? '--'}%</td>`;
      });
      html += `</tr>`;
    });
    html += `</tbody></table>`;
    container.innerHTML = html;
  }
}

// ===========================================================================
// TAB 3: PRODUCTION BREAKDOWN BY STATE & MODEL FORECAST
// ===========================================================================
const PROD_ATTR_META = {
  cpo_production: { label: "CPO Production (Tonnes)", decimals: 0 },
  ffb_yield: { label: "FFB Yield (Tonnes/Ha)", decimals: 2 },
  cpo_yield: { label: "CPO Yield (Tonnes/Ha)", decimals: 3 },
  oer: { label: "Oil Extraction Rate - OER (%)", decimals: 2 },
  derived_hectarage: { label: "Derived Producing Hectarage [CALC: Production / CPO Yield] (Ha)", decimals: 0 }
};

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
      ${canExp ? `<span class="expand-toggle">${isExp ? "&minus;" : "+"}</span>` : ''}${yr}${yr >= 2026 ? ' [FCST]' : ''}
    </th>`;
    if (attr === "derived_hectarage") {
      html += `<th class="col-derived-ha">${yr} Official Mature Ha</th>`;
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

  document.getElementById("prod-chart1-title").textContent = `${st}: Monthly CPO Production & Derived Hectarage [CALC] vs Official Mature Area`;
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
          label: "Derived Hectarage [Prod / CPO Yield] (Ha)",
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
    <th>10-12m Lag Soil Moisture Anom (%)</th>
    <th>22-24m Lag Soil Moisture Anom (%)</th>
    <th>Weather Yield Multiplier</th>
    <th>${st} Model Production [FCST] (T)</th>
    <th>Derived Hectarage [CALC] (Ha)</th>
  </tr></thead><tbody>`;

  fcstPeriods.forEach(p => {
    const ed = prodMon[p]?.entities?.[st] || {};
    wHtml += `<tr>
      <td class="sticky-col">${p} <span class="badge badge-fcst">[FCST]</span></td>
      <td class="num cell-fcst">${fmtNum(ed.ffb_yield, 2)}</td>
      <td class="num cell-fcst">${fmtNum(ed.oer, 2)}%</td>
      <td class="num cell-fcst">${fmtNum(ed.cpo_yield, 4)}</td>
      <td class="num">${fmtDelta(ed.lag12m_sm_anom_pct, 1)}%</td>
      <td class="num">${fmtDelta(ed.lag24m_sm_anom_pct, 1)}%</td>
      <td class="num"><strong>${ed.weather_multiplier ? ed.weather_multiplier.toFixed(4) + 'x' : '--'}</strong></td>
      <td class="num cell-fcst"><strong>${fmtNum(ed.cpo_production, 0)}</strong></td>
      <td class="num cell-calc">${fmtNum(ed.derived_hectarage, 0)}</td>
    </tr>`;
  });
  wHtml += `</tbody></table>`;
  document.getElementById("prod-weather-table-container").innerHTML = wHtml;
}

// ===========================================================================
// TAB 4: MY PRODUCTION & S&D FORECAST (DUPLICATE INTERACTIVE FORECAST TAB)
// ===========================================================================
function renderMyForecastTab() {
  renderMyForecastSndTable();
  renderMyForecastStatesTable();
  renderMyForecastCharts();
}

function renderMyForecastSndTable() {
  const fcstPeriods = STATE.master.metadata.forecast_periods || [];
  const modelData = getEffectiveSndData("model").monthly;
  const userData = getEffectiveSndData("user").monthly;

  // Include Sep 2026 actual anchor + 15 forecast months (Oct 2026 - Dec 2027)
  const cols = ["2026-09", ...fcstPeriods];

  let html = `<table class="data-table"><thead><tr>
    <th style="min-width:240px">S&amp;D Attribute (Tonnes)</th>
    ${cols.map(p => `<th class="${p === '2026-09' ? '' : 'cell-user-fcst'}">${p}${p === '2026-09' ? ' (Actual)' : ' [FCST]'}</th>`).join("")}
    <th>2026 Full Year</th>
    <th>2027 Full Year</th>
  </tr></thead><tbody>`;

  const uAnn = getEffectiveSndData("user").annual;
  const mAnn = getEffectiveSndData("model").annual;

  const editableKeys = new Set(["production", "import", "export", "local_disappearance"]);

  SND_ROWS.forEach(rowDef => {
    const isEditable = editableKeys.has(rowDef.key);
    const isStock = rowDef.key === "opening_stock" || rowDef.key === "end_stock";
    html += `<tr class="${rowDef.key === 'end_stock' ? 'row-highlight' : ''}">
      <td class="sticky-col">
        <strong>My ${rowDef.label}</strong>
        ${isStock ? ' <span class="badge badge-calc">[Auto Formula]</span>' : ' <span class="badge badge-user">[Editable]</span>'}
      </td>`;

    cols.forEach(p => {
      const uRec = userData[p];
      if (p === "2026-09" || !isEditable) {
        html += `<td class="num ${p !== '2026-09' ? 'cell-calc' : ''}"><strong>${fmtNum(uRec[rowDef.key], 0)}</strong></td>`;
      } else {
        html += `<td class="num cell-user-fcst">
          <input type="number" step="1000" class="cell-edit-input snd-user-input"
                 data-period="${p}" data-key="${rowDef.key}" value="${Math.round(uRec[rowDef.key])}" />
        </td>`;
      }
    });
    html += `<td class="num" style="font-weight:700">${fmtNum(uAnn[2026][rowDef.key], 0)}</td>
             <td class="num" style="font-weight:700">${fmtNum(uAnn[2027][rowDef.key], 0)}</td></tr>`;

    // Model reference sub-row
    html += `<tr style="color:#94a3b8;font-size:11px;">
      <td class="sticky-col" style="padding-left:22px;color:#94a3b8;">&#8627; Model ${rowDef.label} (&Delta;)</td>`;
    cols.forEach(p => {
      const mVal = modelData[p][rowDef.key];
      const diff = userData[p][rowDef.key] - mVal;
      html += `<td class="num">${fmtNum(mVal, 0)} ${p !== '2026-09' ? `(${fmtDelta(diff, 0)})` : ''}</td>`;
    });
    html += `<td class="num">${fmtNum(mAnn[2026][rowDef.key], 0)} (${fmtDelta(uAnn[2026][rowDef.key] - mAnn[2026][rowDef.key], 0)})</td>
             <td class="num">${fmtNum(mAnn[2027][rowDef.key], 0)} (${fmtDelta(uAnn[2027][rowDef.key] - mAnn[2027][rowDef.key], 0)})</td></tr>`;
  });

  html += `</tbody></table>`;
  const container = document.getElementById("my-fcst-snd-container");
  container.innerHTML = html;

  container.querySelectorAll(".snd-user-input").forEach(inp => {
    inp.addEventListener("change", () => {
      const p = inp.dataset.period;
      const k = inp.dataset.key;
      const val = Number(inp.value) || 0;
      if (!STATE.userForecast.snd[p]) STATE.userForecast.snd[p] = { period: p };
      STATE.userForecast.snd[p][k] = val;
      renderMyForecastTab();
    });
  });
}

function renderMyForecastStatesTable() {
  const fcstPeriods = STATE.master.metadata.forecast_periods || [];
  const metric = STATE.myFcstStateMetric;
  const states = STATE.master.metadata.states;
  const uStatesStore = STATE.userForecast.production_states || {};

  let html = `<table class="data-table"><thead><tr>
    <th style="min-width:170px">State (${metric})</th>
    ${fcstPeriods.map(p => `<th class="cell-user-fcst">${p}</th>`).join("")}
  </tr></thead><tbody>`;

  states.forEach(st => {
    html += `<tr><td class="sticky-col">${st}</td>`;
    fcstPeriods.forEach(p => {
      const stObj = uStatesStore[p]?.[st] || {};
      const val = stObj[metric];
      if (st === "Perlis" && metric !== "ffb_yield") {
        html += `<td class="num text-muted">N/A</td>`;
      } else {
        const step = metric === "cpo_production" ? "500" : "0.01";
        html += `<td class="num">
          <input type="number" step="${step}" class="cell-edit-input state-user-input"
                 data-period="${p}" data-state="${st}" data-metric="${metric}"
                 value="${val ?? 0}" />
        </td>`;
      }
    });
    html += `</tr>`;
  });

  // Bottom row: Sum of 13 States CPO Production
  html += `<tr class="row-highlight"><td class="sticky-col">Sum of 13 States Prod (T)</td>`;
  fcstPeriods.forEach(p => {
    let sumP = 0;
    states.forEach(st => {
      sumP += Number(uStatesStore[p]?.[st]?.cpo_production || 0);
    });
    html += `<td class="num"><strong>${fmtNum(sumP, 0)}</strong></td>`;
  });
  html += `</tr></tbody></table>`;

  const container = document.getElementById("my-fcst-states-container");
  container.innerHTML = html;

  container.querySelectorAll(".state-user-input").forEach(inp => {
    inp.addEventListener("change", () => {
      const p = inp.dataset.period;
      const st = inp.dataset.state;
      const m = inp.dataset.metric;
      const v = Number(inp.value) || 0;
      if (!STATE.userForecast.production_states[p]) STATE.userForecast.production_states[p] = {};
      if (!STATE.userForecast.production_states[p][st]) STATE.userForecast.production_states[p][st] = {};
      const stRec = STATE.userForecast.production_states[p][st];
      stRec[m] = v;

      // If user edited ffb_yield or oer, recompute cpo_yield and scale cpo_production using derived hectarage
      if (m === "ffb_yield" || m === "oer") {
        const modelEd = STATE.master.production.monthly[p]?.entities?.[st] || {};
        const effHa = modelEd.derived_hectarage || modelEd.official_mature_ha || 0;
        const fy = Number(stRec.ffb_yield || 0);
        const oer = Number(stRec.oer || 0);
        stRec.cpo_yield = Number((fy * oer / 100.0).toFixed(4));
        if (effHa > 0) {
          stRec.cpo_production = Math.round(effHa * stRec.cpo_yield);
        }
      }
      renderMyForecastStatesTable();
    });
  });
}

function syncUserStatesToNationalSnd() {
  const fcstPeriods = STATE.master.metadata.forecast_periods || [];
  const states = STATE.master.metadata.states;
  fcstPeriods.forEach(p => {
    let sumP = 0;
    states.forEach(st => {
      sumP += Number(STATE.userForecast.production_states?.[p]?.[st]?.cpo_production || 0);
    });
    if (sumP > 0) {
      STATE.userForecast.snd[p].production = Math.round(sumP);
    }
  });
  renderMyForecastTab();
}

function applyFrontMonthProdTracker() {
  const targetP = document.getElementById("tracker-target-period").value;
  const mpoa = parseFloat(document.getElementById("input-mpoa-mom").value);
  const sppoma = parseFloat(document.getElementById("input-sppoma-mom").value);
  const valid = [mpoa, sppoma].filter(x => !Number.isNaN(x));
  if (valid.length === 0) return;

  // Give MPOA 70% weight and SPPOMA 30% weight if both entered
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

  STATE.userForecast.snd[targetP].production = newProd;
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

  STATE.userForecast.snd[targetP].export = newExp;
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
  if (window.location.protocol.startsWith("http")) {
    try {
      await fetch("/api/user-forecast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reset", mode })
      });
    } catch (e) {}
  }
  renderMyForecastTab();
  setTimeout(() => { statusEl.textContent = ""; }, 3500);
}

function renderMyForecastCharts() {
  destroyChart("myVsModelStock");
  destroyChart("myVsModelProd");

  const modelSnd = getEffectiveSndData("model").monthly;
  const userSnd = getEffectiveSndData("user").monthly;
  const periods = Object.keys(modelSnd).filter(p => p >= "2026-01").sort();

  const labels = periods.map(p => `${p}${modelSnd[p].is_forecast ? 'F' : ''}`);
  const mStk = periods.map(p => modelSnd[p].end_stock);
  const uStk = periods.map(p => userSnd[p].end_stock);
  const mProd = periods.map(p => modelSnd[p].production);
  const uProd = periods.map(p => userSnd[p].production);

  const ctx1 = document.getElementById("chart-my-vs-model-stock").getContext("2d");
  STATE.charts.myVsModelStock = new Chart(ctx1, {
    type: "line",
    data: {
      labels,
      datasets: [
        { label: "Model Forecast End Stock (T)", data: mStk, borderColor: "#10b981", borderWidth: 2.4, tension: 0.25 },
        { label: "My Forecast End Stock (T)", data: uStk, borderColor: "#a855f7", borderDash: [5, 4], borderWidth: 2.4, tension: 0.25 }
      ]
    },
    options: chartOptionsCommon("Tonnes")
  });

  const ctx2 = document.getElementById("chart-my-vs-model-prod").getContext("2d");
  STATE.charts.myVsModelProd = new Chart(ctx2, {
    type: "bar",
    data: {
      labels,
      datasets: [
        { label: "Model Production (T)", data: mProd, backgroundColor: "rgba(16, 185, 129, 0.75)" },
        { label: "My Forecast Production (T)", data: uProd, backgroundColor: "rgba(168, 85, 247, 0.75)" }
      ]
    },
    options: chartOptionsCommon("Tonnes")
  });
}

// ===========================================================================
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
      ${canExp ? `<span class="expand-toggle">${isExp ? "&minus;" : "+"}</span>` : ''}${yr}${yr >= 2026 ? ' [FCST]' : ''}
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
        { label: "Total Palm Oil Imports (T)", data: poD, borderColor: "#10b981", borderWidth: 2, tension: 0.25 },
        { label: "Total Palm Kernel Oil Imports (T)", data: pkoD, borderColor: "#a855f7", borderWidth: 2, tension: 0.25 }
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
    renderExportsTab
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

  STATE.charts.stkMain = new Chart(document.getElementById("chart-stocks-main").getContext("2d"), {
    type: "bar",
    data: {
      labels,
      datasets: [
        { label: "CPO Peninsular", data: penD, backgroundColor: "#10b981", stack: "s" },
        { label: "CPO Sabah", data: sabD, backgroundColor: "#f59e0b", stack: "s" },
        { label: "CPO Sarawak", data: sarD, backgroundColor: "#a855f7", stack: "s" },
        { label: "Processed Palm Oil (PPO)", data: ppoD, backgroundColor: "#3b82f6", stack: "s" }
      ]
    },
    options: {
      ...chartOptionsCommon("Tonnes"),
      scales: { x: { stacked: true, ticks: { color: "#94a3b8", maxTicksLimit: 18 } }, y: { stacked: true, ticks: { color: "#94a3b8" } } }
    }
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
function renderExpandableMatrixTable(containerId, firstColTitle, rowDefs, years, minMonthlyYear, expandedSet, annMap, monMap, onToggle) {
  let html = `<table class="data-table"><thead><tr><th style="min-width:220px;width:220px;">${firstColTitle}</th>`;
  for (const yr of years) {
    const canExp = yr >= minMonthlyYear;
    const isExp = canExp && expandedSet.has(yr);
    if (isExp) {
      for (let m = 1; m <= 12; m++) {
        const p = `${yr}-${String(m).padStart(2, "0")}`;
        if (!monMap[p]) continue;
        html += `<th>${MONTH_SHORT[m - 1]} ${String(yr).slice(2)}</th>`;
      }
    }
    const ytdTag = annMap[yr]?.is_ytd ? " (YTD)" : "";
    html += `<th class="col-year-header col-annual" data-year="${yr}">
      ${canExp ? `<span class="expand-toggle">${isExp ? "&minus;" : "+"}</span>` : ''}${yr}${ytdTag}
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
          html += `<td class="num">${fmtNum(monMap[p][rDef.key], 0)}</td>`;
        }
      }
      const aRec = annMap[yr];
      html += `<td class="num col-annual">${fmtNum(aRec ? aRec[rDef.key] : null, 0)}</td>`;
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
function getSeasonalityValue(period, attrPath) {
  const [group, field] = attrPath.split(".");
  if (group === "snd") {
    const snd = getEffectiveSndData(STATE.seasonFcstMode).monthly;
    return snd[period] ? snd[period][field] : null;
  }
  if (group === "prod") {
    return STATE.master.production.monthly[period]?.entities?.["Malaysia"]?.[field] ?? null;
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
  const isDecimal = attrPath.includes("yield") || attrPath.includes("oer");
  const decimals = attrPath.includes("cpo_yield") ? 3 : isDecimal ? 2 : 0;

  document.getElementById("season-chart-title").textContent = `Seasonality Curve (Jan – Dec): ${attrLabel}`;
  document.getElementById("season-table-title").textContent = `Monthly Seasonality Matrix & Heatmap: ${attrLabel}`;

  const years = getSortedSelectedYears(2004, 2027);

  // Compute 5Y (2021-2025) and 10Y (2016-2025) monthly averages
  const avg5Y = [];
  const avg10Y = [];
  for (let m = 1; m <= 12; m++) {
    const v5 = [], v10 = [];
    for (let y = 2016; y <= 2025; y++) {
      const v = getSeasonalityValue(`${y}-${String(m).padStart(2, "0")}`, attrPath);
      if (v !== null && v !== undefined) {
        v10.push(v);
        if (y >= 2021) v5.push(v);
      }
    }
    avg5Y.push(v5.length ? Number((v5.reduce((a, b) => a + b, 0) / v5.length).toFixed(decimals)) : null);
    avg10Y.push(v10.length ? Number((v10.reduce((a, b) => a + b, 0) / v10.length).toFixed(decimals)) : null);
  }

  const palette = ["#3b82f6", "#06b6d4", "#a855f7", "#ec4899", "#eab308", "#10b981", "#f97316", "#6366f1", "#14b8a6"];
  const datasets = [
    {
      label: "5Y Average (2021–2025)",
      data: avg5Y,
      borderColor: "#94a3b8",
      backgroundColor: "rgba(148, 163, 184, 0.12)",
      borderWidth: 2.5,
      borderDash: [6, 4],
      pointRadius: 2,
      fill: true,
      tension: 0.25
    }
  ];

  years.forEach((yr, idx) => {
    const mVals = [];
    for (let m = 1; m <= 12; m++) {
      mVals.push(getSeasonalityValue(`${yr}-${String(m).padStart(2, "0")}`, attrPath));
    }
    if (mVals.every(v => v === null)) return;
    const isCurrent = yr === 2026;
    const isFcst = yr === 2027;
    datasets.push({
      label: yr === 2026 ? "2026 (Actual + Q4 FCST)" : yr === 2027 ? "2027 (Forecast)" : String(yr),
      data: mVals,
      borderColor: isCurrent ? "#10b981" : isFcst ? "#f59e0b" : palette[idx % palette.length],
      borderWidth: isCurrent || isFcst ? 3.2 : 1.9,
      borderDash: isFcst ? [4, 3] : [],
      pointRadius: isCurrent || isFcst ? 4 : 2.5,
      tension: 0.25
    });
  });

  const ctx = document.getElementById("chart-seasonality").getContext("2d");
  STATE.charts.seasonality = new Chart(ctx, {
    type: "line",
    data: { labels: MONTH_SHORT, datasets },
    options: chartOptionsCommon(attrLabel)
  });

  // Render Seasonality Heatmap Table
  const allVals = [];
  years.forEach(yr => {
    for (let m = 1; m <= 12; m++) {
      const v = getSeasonalityValue(`${yr}-${String(m).padStart(2, "0")}`, attrPath);
      if (v !== null) allVals.push(v);
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
  [
    { name: "5Y Avg (2021–2025)", arr: avg5Y },
    { name: "10Y Avg (2016–2025)", arr: avg10Y }
  ].forEach(bRow => {
    const valid = bRow.arr.filter(x => x !== null);
    const agg = valid.length
      ? (isDecimal || attrPath.includes("stock")
          ? valid.reduce((a, b) => a + b, 0) / valid.length
          : valid.reduce((a, b) => a + b, 0))
      : null;
    html += `<tr class="row-subtotal"><td class="sticky-col">${bRow.name}</td>`;
    bRow.arr.forEach(v => { html += `<td class="num">${fmtNum(v, decimals)}</td>`; });
    html += `<td class="num"><strong>${fmtNum(agg, decimals)}</strong></td></tr>`;
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
      ? (isDecimal || attrPath.includes("stock")
          ? valid.reduce((a, b) => a + b, 0) / valid.length
          : valid.reduce((a, b) => a + b, 0))
      : null;

    html += `<tr><td class="sticky-col">${yr}${yr >= 2026 ? ' <span class="badge badge-fcst">[FCST]</span>' : ''}</td>`;
    rowVals.forEach((v, mIdx) => {
      const isF = (yr === 2026 && mIdx >= 9) || yr === 2027;
      html += `<td class="num ${isF ? 'cell-fcst' : ''}" style="${heatBg(v, isF)}">${fmtNum(v, decimals)}</td>`;
    });
    html += `<td class="num" style="font-weight:700">${fmtNum(agg, decimals)}</td></tr>`;
  });

  html += `</tbody></table>`;
  document.getElementById("seasonality-table-container").innerHTML = html;
}

// ---------------------------------------------------------------------------
// Chart.js Shared Options
// ---------------------------------------------------------------------------
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
        title: { display: Boolean(yTitle), text: yTitle, color: "#475569", font: { size: 11, weight: 'bold' } },
        ticks: { color: "#64748b", font: { family: "'JetBrains Mono', monospace", size: 11 } },
        grid: { color: "rgba(100, 116, 139, 0.1)" }
      }
    }
  };
}

document.addEventListener("DOMContentLoaded", initDashboard);
