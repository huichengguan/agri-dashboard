/**
 * Brazil Soybeans, Biodiesel, Corn, Corn Ethanol & Sugarcane S&D Institutional Dashboard (app.js)
 * 100% Official CONAB, ANP, ABIOVE/SECEX, IBGE SIDRA & USDA PSD Data
 *   - 21 Years of Complete Annual S&D Balance Sheets (2006/07 – 2026/27)
 *   - 249 Months of High-Frequency Monthly Series (Jan 2006 – Sep 2026)
 *   - 50 Years of CONAB Crop & State Production History (1976/77 – 2026/27)
 */

const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
let ALL_YEARS = Array.from({ length: 2026 - 2006 + 1 }, (_, i) => 2006 + i); // 21 Years: 2006..2026

function fmtPeriodShort(period) {
  if (!period || !period.includes("-")) return period || "";
  const [y, m] = period.split("-").map(Number);
  return `${MONTH_SHORT[m - 1]} ${y}`;
}

const STATE = {
  master: null,
  // Default to latest 3 years (2024, 2025, 2026 / 2024/25 .. 2026/27)
  selectedYears: new Set([2024, 2025, 2026]),
  lastClickedYear: 2026,
  activeTab: "tab-snd",

  // Tab 1: S&D state
  sndViewFormat: "table",   // "table" | "matrix"
  sndYearBasis: "my",       // "my" (Safra 2006/07..2026/27) | "cy" (2006..2026)
  sndMetricMode: "volume",  // "volume" | "both" | "pct"
  sndUnit: "kmt",           // "kmt" (1,000 t / 1,000 m3) | "mmt" (Million t / Billion L)
  sndExpandedYears: new Set([2026]), // Expand 2026 by default so monthly columns are immediately visible
  sndChartFreq: "annual",   // "annual" | "monthly"

  // Tab 2: Seasonality state
  seasonAttr: "sugarcane.ethanol_total_kl",
  seasonCalc: "monthly",    // "monthly" | "cum"
  seasonUnit: "kmt",        // "kmt" | "mmt"
  seasonActiveYears: new Set([2024, 2025, 2026]),

  // Tab 3: 50-Year Historical Series state
  hist50Crop: "soybeans",
  hist50State: "BRASIL",

  // Dedicated Biofuel S&D state
  bioExpandedYears: new Set(), // Default: all years collapsed
  bioFreqMode: "annual",    // "annual" (expandable) | "matrix"
  bioSubView: "all",        // "all" | "biodiesel" | "ethanol"
  bioUnit: "m3",            // "m3" (1,000 m³) | "mt" (1,000 MT mass)

  charts: {}
};

// ===========================================================================
// S&D ROW DEFINITIONS FOR 6 VERTICALLY STACKED TABLES
// ===========================================================================
const SOYBEANS_ROWS = [
  { key: "area_harvested", label: "Area Harvested (1,000 ha / IBGE Monthly)", isNoScale: true },
  { key: "yield_kgha", label: "Yield (kg/ha)", isNoScale: true },
  { key: "beginning_stocks", label: "Beginning Stocks", isStock: true },
  { key: "production", label: "Production: Harvest Flow (Colheita Mensal)", isSubtotal: true },
  { key: "ibge_lspa_crop_forecast_kmt", label: "↳ IBGE LSPA Annual Crop Survey (Monthly Revision)", isIndent: true, isNoScale: true },
  { key: "imports", label: "Imports (SECEX Official)" },
  { key: "total_supply", label: "Total Soybeans Supply", isSubtotal: true },
  { key: "total_demand", label: "Total Soybeans Demand", isSubtotal: true },
  { key: "crush", label: "↳ Crushed (ABIOVE / CONAB)", isIndent: true },
  { key: "exports", label: "↳ Exports (SECEX / CONAB)", isIndent: true },
  { key: "seed_residual", label: "↳ Seed, Feed & Residual", isIndent: true },
  { key: "ending_stocks", label: "Ending Stocks (ABIOVE / CONAB)", isHighlight: true, isStock: true },
  { key: "stocks_to_use", label: "Stocks-to-Use Ratio (%)", isRatio: true, isHighlight: true },
  { key: "_div_exp", label: "SECEX / ABIOVE EXPORT VALUE & PRICE SUB-LEDGER (MONTHLY & ANNUAL)", isDivider: true },
  { key: "export_fob_musd", label: "Exports FOB Value (US$ Million)", isNoScale: true },
  { key: "export_price_usdt", label: "Average Export Price (US$/t)", isNoScale: true, isPrice: true }
];

const SBM_ROWS = [
  { key: "beginning_stocks", label: "Beginning Stocks (ABIOVE Official)", isStock: true },
  { key: "production", label: "Production (Soybean Meal / Farelo)", isSubtotal: true },
  { key: "extraction_ratio", label: "↳ Extraction Yield (% of Soy Crush)", isRatio: true, isExtraction: true, isIndent: true },
  { key: "imports", label: "Imports (SECEX Official)" },
  { key: "total_supply", label: "Total SBM Supply", isSubtotal: true },
  { key: "total_demand", label: "Total SBM Demand", isSubtotal: true },
  { key: "domestic_use", label: "↳ Domestic Feed Consumption (ABIOVE)", isIndent: true },
  { key: "exports", label: "↳ Exports (SECEX / CONAB)", isIndent: true },
  { key: "ending_stocks", label: "Ending Stocks (ABIOVE Official)", isHighlight: true, isStock: true },
  { key: "stocks_to_use", label: "Stocks-to-Use Ratio (%)", isRatio: true, isHighlight: true },
  { key: "export_fob_musd", label: "Exports FOB Value (US$ Million)", isNoScale: true },
  { key: "export_price_usdt", label: "Average Export Price (US$/t)", isNoScale: true, isPrice: true }
];

const SBO_ROWS = [
  { key: "beginning_stocks", label: "Beginning Stocks (ABIOVE Official)", isStock: true },
  { key: "production", label: "Production (Soybean Oil / Óleo)", isSubtotal: true },
  { key: "extraction_ratio", label: "↳ Extraction Yield (% of Soy Crush)", isRatio: true, isExtraction: true, isIndent: true },
  { key: "imports", label: "Imports (SECEX Official)" },
  { key: "total_supply", label: "Total SBO Supply", isSubtotal: true },
  { key: "total_demand", label: "Total SBO Demand", isSubtotal: true },
  { key: "domestic_use", label: "↳ Domestic Consumption: Total (ABIOVE)", isIndent: true },
  { key: "biofuel_use", label: "• Biofuel Use (ANP / ABIOVE Biodiesel)", isSubIndent: true },
  { key: "non_biofuel_use", label: "• Food & Non-Biofuel Domestic Use", isSubIndent: true },
  { key: "exports", label: "↳ Exports (SECEX / CONAB)", isIndent: true },
  { key: "ending_stocks", label: "Ending Stocks (ABIOVE Official)", isHighlight: true, isStock: true },
  { key: "stocks_to_use", label: "Stocks-to-Use Ratio (%)", isRatio: true, isHighlight: true },
  { key: "export_fob_musd", label: "Exports FOB Value (US$ Million)", isNoScale: true },
  { key: "export_price_usdt", label: "Average Export Price (US$/t)", isNoScale: true, isPrice: true }
];

const BIODIESEL_ROWS = [
  { key: "production", label: "Biodiesel Production (1,000 m³ / M Liters)", isSubtotal: true },
  { key: "deliveries", label: "Domestic Deliveries / Sales (1,000 m³)", isSubtotal: true },
  { key: "_div_feed", label: "BIODIESEL FEEDSTOCK SUB-LEDGER (ANP / ABIOVE MATÉRIA-PRIMA)", isDivider: true },
  { key: "sbo_feedstock_m3", label: "↳ Soybean Oil (Óleo de Soja) Used (1,000 m³)", isIndent: true },
  { key: "tallow_feedstock_m3", label: "↳ Animal Tallow (Gordura Animal) Used (1,000 m³)", isIndent: true },
  { key: "other_feedstock_m3", label: "↳ Cottonseed, UCO & Other Oils Used (1,000 m³)", isIndent: true },
  { key: "sbo_share_pct", label: "Soybean Oil Share of Feedstock (%)", isRatio: true, isHighlight: true },
  { key: "_div_diesel", label: "DIESEL B & FOSSIL DIESEL A SUB-LEDGER (ANP / ABIOVE)", isDivider: true },
  { key: "diesel_b_sales_m3", label: "Diesel B Sales by Distributors (1,000 m³)" },
  { key: "diesel_a_imports_m3", label: "↳ Diesel A Imports (1,000 m³)", isIndent: true },
  { key: "effective_blend_pct", label: "Effective Biodiesel Blend Rate in Diesel B (%)", isRatio: true, isHighlight: true }
];

const CORN_ROWS = [
  { key: "area_harvested", label: "Total Corn Area Harvested (1,000 ha)", isNoScale: true },
  { key: "yield_kgha", label: "Average Yield (kg/ha)", isNoScale: true },
  { key: "beginning_stocks", label: "Beginning Stocks", isStock: true },
  { key: "production", label: "Total Corn Production (1ª + 2ª + 3ª Safra)", isSubtotal: true },
  { key: "prod_1st_crop", label: "↳ 1st Crop (1ª Safra Verão / Summer)", isIndent: true },
  { key: "prod_2nd_crop", label: "↳ 2nd Crop (2ª Safra Safrinha / Winter)", isIndent: true },
  { key: "prod_3rd_crop", label: "↳ 3rd Crop (3ª Safra)", isIndent: true },
  { key: "imports", label: "Imports" },
  { key: "total_supply", label: "Total Corn Supply", isSubtotal: true },
  { key: "total_demand", label: "Total Corn Demand", isSubtotal: true },
  { key: "domestic_use", label: "↳ Domestic Consumption: Total", isIndent: true },
  { key: "corn_ethanol_grind", label: "• Corn Processed for Bioethanol [EST]", isSubIndent: true },
  { key: "feed_and_other_use", label: "• Animal Feed, Starch & Seed Use [EST]", isSubIndent: true },
  { key: "exports", label: "↳ Corn Exports (CONAB Annual / SECEX Monthly)", isIndent: true },
  { key: "ending_stocks", label: "Ending Stocks", isHighlight: true, isStock: true },
  { key: "stocks_to_use", label: "Stocks-to-Use Ratio (%)", isRatio: true, isHighlight: true },
  { key: "_div_ceth", label: "CORN BIOETHANOL SUB-LEDGER (CONAB ANNUAL / ANP MONTHLY MT & CO)", isDivider: true },
  { key: "corn_ethanol_total_kl", label: "Corn Ethanol Production (1,000 m³ / M Liters)", isSubtotal: true },
  { key: "corn_ethanol_anhydrous_kl", label: "↳ Anhydrous Corn Ethanol (Etanol Anidro)", isIndent: true },
  { key: "corn_ethanol_hydrous_kl", label: "↳ Hydrous Corn Ethanol (Etanol Hidratado)", isIndent: true },
  { key: "anp_co_ethanol_kl", label: "↳ Center-West Total Ethanol (ANP MT+MS+GO)", isIndent: true },
  { key: "ddgs_production_kmt", label: "↳ DDGS High-Protein Feed Output (1,000 t) [EST]", isIndent: true },
  { key: "corn_oil_production_kmt", label: "↳ Distillers Corn Oil Output (1,000 t) [EST]", isIndent: true },
  { key: "corn_share_of_ethanol_pct", label: "Corn Share of Total Brazil Ethanol (%)", isRatio: true, isHighlight: true },
  { key: "export_fob_musd", label: "Corn Exports FOB Value (US$ Million)", isNoScale: true },
  { key: "export_price_usdt", label: "Average Corn Export Price (US$/t)", isNoScale: true, isPrice: true }
];

const SUGARCANE_ROWS = [
  { key: "cane_area_kha", label: "Sugarcane Harvested Area (1,000 ha)", isNoScale: true },
  { key: "cane_yield_kgha", label: "Sugarcane Agricultural Yield (kg/ha)", isNoScale: true },
  { key: "cane_crushed_kmt", label: "Sugarcane Harvested / Crushed (Moagem)", isSubtotal: true },
  { key: "atr_avg_kgt", label: "Average Recoverable Sugar — ATR (kg/t cane)", isNoScale: true, isPrice: true },
  { key: "atr_total_kmt", label: "Total Recoverable Sugar — ATR Produced", isSubtotal: true },
  { key: "atr_sugar_mix_pct", label: "↳ ATR Allocation to Sugar (%)", isRatio: true, isIndent: true },
  { key: "atr_ethanol_mix_pct", label: "↳ ATR Allocation to Ethanol (%)", isRatio: true, isIndent: true },
  { key: "_div_sug", label: "SUGAR (AÇÚCAR) SUPPLY & DEMAND SUB-LEDGER (CONAB / USDA PSD)", isDivider: true },
  { key: "sugar_beginning_stocks", label: "Sugar Beginning Stocks", isStock: true },
  { key: "sugar_production", label: "Sugar Production (CONAB Açúcar)", isSubtotal: true },
  { key: "sugar_domestic_use", label: "↳ Domestic Human Consumption", isIndent: true },
  { key: "sugar_exports", label: "↳ Sugar Exports (Raw + Refined)", isIndent: true },
  { key: "sugar_ending_stocks", label: "Sugar Ending Stocks", isHighlight: true, isStock: true },
  { key: "sugar_stocks_to_use", label: "Sugar Stocks-to-Use Ratio (%)", isRatio: true, isHighlight: true },
  { key: "_div_eth", label: "BRAZIL TOTAL ETHANOL (CANA + MILHO) SUB-LEDGER (CONAB ANNUAL / ANP MONTHLY)", isDivider: true },
  { key: "ethanol_total_kl", label: "Total Ethanol Production (1,000 m³ / M Liters)", isSubtotal: true },
  { key: "ethanol_anhydrous_kl", label: "↳ Anhydrous Ethanol (Etanol Anidro)", isIndent: true },
  { key: "ethanol_hydrous_kl", label: "↳ Hydrous Ethanol (Etanol Hidratado)", isIndent: true },
  { key: "ethanol_cane_kl", label: "• Sugarcane Ethanol (Etanol de Cana)", isSubIndent: true },
  { key: "ethanol_corn_kl", label: "• Corn Ethanol (Etanol de Milho / MT)", isSubIndent: true },
  { key: "ethanol_sp_kl", label: "↳ São Paulo Ethanol Production (ANP Monthly)", isIndent: true },
  { key: "hydrous_share_pct", label: "Hydrous Share of Total Ethanol (%)", isRatio: true, isHighlight: true }
];

// ===========================================================================
// FORMATTING HELPERS
// ===========================================================================
function scaleVal(val, unit = "kmt", isRatio = false, isNoScale = false) {
  if (val === null || val === undefined || Number.isNaN(Number(val))) return null;
  const n = Number(val);
  if (isRatio || isNoScale) return n;
  return unit === "mmt" ? n / 1000.0 : n;
}

function fmtVal(val, unit = "kmt", rDef = {}, isEst = false) {
  if (val === null || val === undefined || Number.isNaN(Number(val))) {
    return '<span class="text-muted">--</span>';
  }
  const n = Number(val);
  let out = "";
  if (rDef.isRatio) {
    const dec = rDef.isExtraction ? 2 : 1;
    out = `${n.toFixed(dec)}%`;
  } else if (rDef.isPrice) {
    out = n.toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  } else if (rDef.isNoScale) {
    out = Math.round(n).toLocaleString("en-US");
  } else if (unit === "mmt") {
    out = (n / 1000.0).toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  } else {
    out = n.toLocaleString("en-US", {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1
    });
  }
  if (isEst) {
    return `<span class="cell-indec-est" style="color:#d97706;font-weight:700;border-bottom:1px dotted #d97706;cursor:help;" title="[EST] Derived using official CONAB/UNEM/ABIOVE technical feedstock conversion factors">${out}</span>`;
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
  return arr.length ? arr : ALL_YEARS.slice(-3);
}

function chartOptionsCommon(yTitle, unit = "kmt", isRatio = false) {
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
            if (unit === "mmt") {
              return `${dsLabel}: ${Number(raw).toFixed(2)} MMT / Bn L`;
            }
            return `${dsLabel}: ${Number(raw).toLocaleString("en-US", { maximumFractionDigits: 1 })} kMT / k m³`;
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
          callback: (v) => isRatio ? `${v}%` : unit === "mmt" ? Number(v).toFixed(1) : Number(v).toLocaleString("en-US")
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
    const data = window.DASHBOARD_DATA || window.MASTER_SND_DATA || window.BRAZIL_SND_DATA;
    if (!data) {
      throw new Error("window.DASHBOARD_DATA is missing. Run python etl/build_dashboard_data.py first.");
    }
    STATE.master = data;
    if (Array.isArray(data.metadata?.years) && data.metadata.years.length) {
      ALL_YEARS = data.metadata.years.slice().sort((a, b) => a - b);
      const maxYr = ALL_YEARS[ALL_YEARS.length - 1];
      STATE.selectedYears = new Set(ALL_YEARS.slice(-3)); // Latest 3 Years Default (2024..2026)
      STATE.lastClickedYear = maxYr;
      STATE.sndExpandedYears = new Set([maxYr]);
      STATE.seasonActiveYears = new Set(ALL_YEARS.slice(-5));
    }

    // Ensure preset UI buttons reflect Last 3Y as active
    document.querySelectorAll(".preset-btn").forEach(b => {
      b.classList.toggle("active", b.dataset.preset === "last3");
    });

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

function formatYearPillLabel(yr) {
  const isMY = STATE.activeTab === "tab-snd" && STATE.sndYearBasis === "my";
  if (isMY) {
    const aRec = STATE.master?.annual_my?.[String(yr)];
    const next2 = String(yr + 1).slice(2);
    return aRec?.is_ytd ? `${yr}/${next2} PROJ` : `${yr}/${next2}`;
  }
  return yr === 2026 ? "2026 YTD" : String(yr);
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
    pill.title = `${yr}/${String(yr + 1).slice(2)} — Click to select single year, Ctrl+Click to multi-select, Shift+Click for range`;

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
      if (preset === "last3") {
        ALL_YEARS.slice(-3).forEach(y => STATE.selectedYears.add(y));
      } else if (preset === "last5") {
        ALL_YEARS.slice(-5).forEach(y => STATE.selectedYears.add(y));
      } else if (preset === "last10") {
        ALL_YEARS.slice(-10).forEach(y => STATE.selectedYears.add(y));
      } else if (preset === "last16") {
        ALL_YEARS.slice(-16).forEach(y => STATE.selectedYears.add(y));
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

  // Tab 1: Year Basis (Safra MY vs CY)
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

  // Tab 1: Units (kmt vs mmt)
  document.querySelectorAll("#snd-unit-mode .seg-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("#snd-unit-mode .seg-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      STATE.sndUnit = btn.dataset.unit;
      STATE.seasonUnit = STATE.sndUnit;
      document.querySelectorAll("#season-unit-mode .seg-btn").forEach(b => {
        b.classList.toggle("active", b.dataset.unit === STATE.sndUnit);
      });
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

  // Tab 2: Seasonality Controls
  document.getElementById("season-attr-select").addEventListener("change", (e) => {
    STATE.seasonAttr = e.target.value;
    renderSeasonalityTab();
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
      renderSeasonalityTab();
    });
  });

  // Tab 3: 50-Year Historical Series Controls
  document.getElementById("hist50-crop-select").addEventListener("change", (e) => {
    STATE.hist50Crop = e.target.value;
    renderHist50Tab();
  });
  document.getElementById("hist50-state-select").addEventListener("change", (e) => {
    STATE.hist50State = e.target.value;
    renderHist50Tab();
  });
}

function renderActiveTab() {
  if (STATE.activeTab === "tab-snd") {
    renderSndTab();
  } else if (STATE.activeTab === "tab-seasonality") {
    renderSeasonalityTab();
  } else if (STATE.activeTab === "tab-hist50") {
    renderHist50Tab();
  } else if (STATE.activeTab === "tab-biofuel") {
    renderBiofuelTab();
  }
}

// ===========================================================================
// TAB 1: 6 VERTICALLY STACKED S&D TABLES & EXPANDABLE MONTHLY COLUMNS
// ===========================================================================
function getYearMonthsList(yr, basis = (STATE.sndYearBasis || "my"), section = "soybeans") {
  const out = [];
  if (section === "biodiesel" || basis === "cy") {
    // Calendar Year (CY) & Biodiesel: January yr to December yr (100% Calendar basis)
    for (let m = 1; m <= 12; m++) {
      out.push({ period: `${yr}-${String(m).padStart(2, "0")}`, label: `${MONTH_SHORT[m - 1]} ${String(yr).slice(2)}` });
    }
    return out;
  }
  if (basis === "my") {
    if (section === "sugarcane") {
      // Sugarcane Safra: April yr to March yr+1
      for (let m = 4; m <= 12; m++) {
        out.push({ period: `${yr}-${String(m).padStart(2, "0")}`, label: `${MONTH_SHORT[m - 1]} ${String(yr).slice(2)}` });
      }
      for (let m = 1; m <= 3; m++) {
        out.push({ period: `${yr + 1}-${String(m).padStart(2, "0")}`, label: `${MONTH_SHORT[m - 1]} ${String(yr + 1).slice(2)}` });
      }
    } else {
      // Grains / Oilseeds Safra: February yr to January yr+1
      for (let m = 2; m <= 12; m++) {
        out.push({ period: `${yr}-${String(m).padStart(2, "0")}`, label: `${MONTH_SHORT[m - 1]} ${String(yr).slice(2)}` });
      }
      out.push({ period: `${yr + 1}-01`, label: `Jan ${String(yr + 1).slice(2)}` });
    }
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
  const unitTitle = unit === "mmt" ? "MMT / Bn L" : "1,000 t / 1,000 m³";

  let totalCols = 1;
  for (const yr of years) {
    const isExp = STATE.sndExpandedYears.has(yr);
    if (isExp) {
      const mList = getYearMonthsList(yr, basis, sectionKey).filter(item => monthly[item.period] !== undefined);
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
      : (aRec?.ytd_label || String(yr));

    if (isExp) {
      const mList = getYearMonthsList(yr, basis, sectionKey).filter(item => monthly[item.period] !== undefined);
      for (const item of mList) {
        html += `<th class="col-month">${item.label}</th>`;
      }
    }
    html += `<th class="col-year-header col-annual ${aRec?.is_ytd ? 'cell-ytd' : ''}" data-year="${yr}" title="Click to ${isExp ? 'collapse' : 'expand'} monthly columns across all 6 stacked tables">
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
    const cleanAttrTitle = rDef.label.replace(/^↳\s*/, "").replace(/^•\s*/, "");

    if (metricMode === "volume" || metricMode === "both") {
      html += `<tr class="${rCls}"><td class="sticky-col col-attr" ${ratioStyle} title="${cleanAttrTitle}">${rDef.label}</td>`;
      for (const yr of years) {
        const isExp = STATE.sndExpandedYears.has(yr);
        const aRec = annMap[String(yr)];
        if (isExp) {
          const mList = getYearMonthsList(yr, basis, sectionKey).filter(item => monthly[item.period] !== undefined);
          for (const item of mList) {
            const fullRec = monthly[item.period];
            const mRec = fullRec?.[sectionKey];
            const val = mRec ? mRec[rDef.key] : null;
            const isEst = Array.isArray(fullRec?.estimated_fields) && fullRec.estimated_fields.includes(`${sectionKey}.${rDef.key}`);
            html += `<td class="num col-month" ${ratioStyle}>${fmtVal(val, unit, rDef, isEst)}</td>`;
          }
        }
        const aSec = aRec ? aRec[sectionKey] : null;
        const aVal = aSec ? aSec[rDef.key] : null;
        const aEst = Array.isArray(aRec?.estimated_fields) && aRec.estimated_fields.includes(`${sectionKey}.${rDef.key}`);
        html += `<td class="num col-annual ${aRec?.is_ytd ? 'cell-ytd' : ''}" ${ratioStyle}>${fmtVal(aVal, unit, rDef, aEst)}</td>`;
      }
      html += `</tr>`;
    }

    if (metricMode === "pct" || metricMode === "both") {
      const pctRowLabel = metricMode === "both" ? `  ↳ % Change (MoM / YoY)` : `${rDef.label} (% Chg)`;
      const pctRowCls = metricMode === "both" ? "row-sub-indent" : rCls;
      html += `<tr class="${pctRowCls}"><td class="sticky-col col-attr" style="font-size:10.5px;color:#64748b;" title="${cleanAttrTitle} — Percentage Change (MoM / YoY)">${pctRowLabel}</td>`;
      for (const yr of years) {
        const isExp = STATE.sndExpandedYears.has(yr);
        const aRec = annMap[String(yr)];
        const prevARec = annMap[String(yr - 1)];

        if (isExp) {
          const mList = getYearMonthsList(yr, basis, sectionKey).filter(item => monthly[item.period] !== undefined);
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
        const cVal = aRec?.[sectionKey]?.[rDef.key];
        const pVal = prevARec?.[sectionKey]?.[rDef.key];
        const yoy = (cVal != null && pVal != null && pVal !== 0) ? ((cVal - pVal) / Math.abs(pVal)) * 100.0 : null;
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
  const caneCont = document.getElementById("snd-cane-table-container");
  const prevScroll = soyCont ? soyCont.scrollLeft : 0;

  const years = getSortedSelectedYears();
  const basis = STATE.sndYearBasis;
  const unit = STATE.sndUnit;
  const metric = STATE.sndMetricMode;

  soyCont.innerHTML = buildSingleSndTableHtml("soybeans", SOYBEANS_ROWS, years, basis, unit, metric);
  sbmCont.innerHTML = buildSingleSndTableHtml("sbm", SBM_ROWS, years, basis, unit, metric);
  sboCont.innerHTML = buildSingleSndTableHtml("sbo", SBO_ROWS, years, basis, unit, metric);
  bioCont.innerHTML = buildSingleSndTableHtml("biodiesel", BIODIESEL_ROWS, years, basis, unit, metric);
  cornCont.innerHTML = buildSingleSndTableHtml("corn", CORN_ROWS, years, basis, unit, metric);
  caneCont.innerHTML = buildSingleSndTableHtml("sugarcane", SUGARCANE_ROWS, years, basis, unit, metric);

  document.querySelectorAll("#snd-stacked-tables-wrapper .col-year-header").forEach(th => {
    th.addEventListener("click", () => {
      const yr = Number(th.dataset.year);
      if (STATE.sndExpandedYears.has(yr)) STATE.sndExpandedYears.delete(yr);
      else STATE.sndExpandedYears.add(yr);
      renderStackedSndTables();
    });
  });

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
// MONTHLY MATRIX (BY YEAR) VIEW FOR ALL 6 COMMODITY COMPLEXES
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
    const mItems = getYearMonthsList(yr, basis, sectionKey);
    const mRecs = mItems.map(it => monthly[it.period]?.[sectionKey] || null);

    const v1 = mRecs.map(r => r?.[heatKey1]).filter(v => v != null);
    const min1 = v1.length ? Math.min(...v1) : null;
    const max1 = v1.length ? Math.max(...v1) : null;

    const v2 = mRecs.map(r => r?.[heatKey2]).filter(v => v != null);
    const min2 = v2.length ? Math.min(...v2) : null;
    const max2 = v2.length ? Math.max(...v2) : null;

    const yrTitle = basis === "my" ? `Safra ${yr}/${String(yr + 1).slice(2)} (${yr})` : `CY ${yr}`;
    html += `<tr class="matrix-row-month"><td class="matrix-col-metric"><strong>${yrTitle}</strong></td>`;
    mItems.forEach(it => {
      html += `<td class="matrix-col-month"><strong>${it.label}</strong></td>`;
    });
    html += `<td class="matrix-col-total"><strong>Safra / Annual</strong></td></tr>`;

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
        html += `<td class="matrix-col-month" ${style}>${fmtVal(val, unit, rDef, isEst)}</td>`;
      }
      const aVal = aRec[rDef.key];
      html += `<td class="matrix-col-total">${fmtVal(aVal, unit, rDef)}</td></tr>`;
    });
  });

  html += `</tbody></table>`;
  return html;
}

function renderSndMatrixAll() {
  document.getElementById("snd-matrix-soy-container").innerHTML = buildMatrixHtmlForSection(
    "soybeans",
    [
      { key: "exports", label: "Soybeans Exports (SECEX/CONAB)" },
      { key: "export_fob_musd", label: "↳ Exports FOB Value (US$ M)", isNoScale: true },
      { key: "export_price_usdt", label: "↳ Avg Export Price (US$/t)", isNoScale: true, isPrice: true },
      { key: "production", label: "IBGE LSPA / CONAB Production" },
      { key: "area_harvested", label: "IBGE LSPA / CONAB Area (1,000 ha)", isNoScale: true },
      { key: "crush", label: "Soybeans Crushed (Annual)" },
      { key: "ending_stocks", label: "Ending Stocks (Annual)" },
      { key: "stocks_to_use", label: "Stocks-to-Use (%)", isRatio: true }
    ],
    "exports",
    "production"
  );

  document.getElementById("snd-matrix-sbm-container").innerHTML = buildMatrixHtmlForSection(
    "sbm",
    [
      { key: "exports", label: "SBM Exports (SECEX/CONAB)" },
      { key: "export_fob_musd", label: "↳ Exports FOB Value (US$ M)", isNoScale: true },
      { key: "export_price_usdt", label: "↳ Avg Export Price (US$/t)", isNoScale: true, isPrice: true },
      { key: "production", label: "SBM Production (Annual)" },
      { key: "domestic_use", label: "Domestic Use (Annual)" },
      { key: "ending_stocks", label: "Ending Stocks (Annual)" },
      { key: "stocks_to_use", label: "Stocks-to-Use (%)", isRatio: true }
    ],
    "exports",
    "export_price_usdt"
  );

  document.getElementById("snd-matrix-sbo-container").innerHTML = buildMatrixHtmlForSection(
    "sbo",
    [
      { key: "biofuel_use", label: "SBO Biofuel Use (Biodiesel Eq.)" },
      { key: "exports", label: "SBO Exports (SECEX/CONAB)" },
      { key: "export_fob_musd", label: "↳ Exports FOB Value (US$ M)", isNoScale: true },
      { key: "export_price_usdt", label: "↳ Avg Export Price (US$/t)", isNoScale: true, isPrice: true },
      { key: "production", label: "SBO Production (Annual)" },
      { key: "domestic_use", label: "Total Domestic Use (Annual)" },
      { key: "stocks_to_use", label: "Stocks-to-Use (%)", isRatio: true }
    ],
    "biofuel_use",
    "exports"
  );

  document.getElementById("snd-matrix-bio-container").innerHTML = buildMatrixHtmlForSection(
    "biodiesel",
    [
      { key: "production", label: "Biodiesel Production (1,000 m³)" },
      { key: "deliveries", label: "Biodiesel Deliveries (1,000 m³)" },
      { key: "sbo_feedstock_kmt", label: "↳ SBO Feedstock Used (1,000 t)" },
      { key: "diesel_b_sales_m3", label: "Diesel B Distributor Sales (1,000 m³)" },
      { key: "diesel_a_imports_m3", label: "↳ Diesel A Imports (1,000 m³)" },
      { key: "effective_blend_pct", label: "Effective Blend Rate (%)", isRatio: true }
    ],
    "production",
    "deliveries"
  );

  document.getElementById("snd-matrix-corn-container").innerHTML = buildMatrixHtmlForSection(
    "corn",
    [
      { key: "exports", label: "Corn Exports (SECEX/CONAB)" },
      { key: "export_fob_musd", label: "↳ Corn Exports FOB (US$ M)", isNoScale: true },
      { key: "export_price_usdt", label: "↳ Avg Export Price (US$/t)", isNoScale: true, isPrice: true },
      { key: "anp_mt_ethanol_kl", label: "Mato Grosso Ethanol (ANP 1,000 m³)" },
      { key: "anp_co_ethanol_kl", label: "Center-West Ethanol (ANP 1,000 m³)" },
      { key: "prod_2nd_crop", label: "2nd Crop Safrinha (IBGE/CONAB)" },
      { key: "production", label: "Total Corn Production (IBGE/CONAB)" },
      { key: "stocks_to_use", label: "Stocks-to-Use (%)", isRatio: true }
    ],
    "exports",
    "anp_mt_ethanol_kl"
  );

  document.getElementById("snd-matrix-cane-container").innerHTML = buildMatrixHtmlForSection(
    "sugarcane",
    [
      { key: "ethanol_total_kl", label: "Total Ethanol Prod (1,000 m³)" },
      { key: "ethanol_hydrous_kl", label: "↳ Hydrous Ethanol (Hidratado)" },
      { key: "ethanol_anhydrous_kl", label: "↳ Anhydrous Ethanol (Anidro)" },
      { key: "ethanol_sp_kl", label: "↳ São Paulo Ethanol (ANP)" },
      { key: "ethanol_corn_kl", label: "↳ Corn / MT Ethanol" },
      { key: "hydrous_share_pct", label: "Hydrous Share (%)", isRatio: true },
      { key: "cane_crushed_kmt", label: "Sugarcane Harvest (CONAB/IBGE)" },
      { key: "sugar_production", label: "Sugar Production (Annual)" }
    ],
    "ethanol_total_kl",
    "ethanol_hydrous_kl"
  );
}

// ===========================================================================
// TAB 1: 6 INSTITUTIONAL S&D CHARTS (ANNUAL 21Y OR MONTHLY HIGH-FREQUENCY)
// ===========================================================================
function renderSndCharts() {
  destroyChart("sndSoy");
  destroyChart("sndSbm");
  destroyChart("sndSbo");
  destroyChart("sndBio");
  destroyChart("sndCorn");
  destroyChart("sndCane");

  const years = getSortedSelectedYears();
  const basis = STATE.sndYearBasis;
  const unit = STATE.sndUnit;
  const freq = STATE.sndChartFreq;
  const uLabel = unit === "mmt" ? "MMT / Bn L" : "1,000 t / 1,000 m³";
  const monthly = STATE.master.monthly;
  const annMap = basis === "my" ? STATE.master.annual_my : STATE.master.annual_cy;

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
      labels.push(basis === "my" ? r.my_label : r.ytd_label);
      recs.push(r);
    }
  }

  // 1. SOYBEANS CHART
  const ctxSoy = document.getElementById("chart-snd-soy").getContext("2d");
  STATE.charts.sndSoy = new Chart(ctxSoy, {
    type: "bar",
    data: {
      labels,
      datasets: freq === "annual" ? [
        {
          type: "bar",
          label: "Soybeans Crushed",
          data: recs.map(r => scaleVal(r.soybeans.crush, unit)),
          backgroundColor: "rgba(5, 150, 105, 0.80)",
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
          label: "Soybeans Production",
          data: recs.map(r => scaleVal(r.soybeans.production, unit)),
          borderColor: "#0f172a",
          borderWidth: 2.3,
          pointRadius: 3,
          tension: 0.25,
          yAxisID: "y",
          order: 1
        },
        {
          type: "line",
          label: "Stocks-to-Use (%) [RHS]",
          data: recs.map(r => r.soybeans.stocks_to_use),
          borderColor: "#2563eb",
          borderWidth: 2,
          borderDash: [4, 3],
          pointRadius: 2.5,
          tension: 0.25,
          yAxisID: "y1",
          order: 0
        }
      ] : [
        {
          type: "bar",
          label: "Monthly Soybean Exports (SECEX)",
          data: recs.map(r => scaleVal(r.soybeans.exports, unit)),
          backgroundColor: "rgba(217, 119, 6, 0.85)",
          yAxisID: "y",
          order: 2
        },
        {
          type: "line",
          label: "IBGE LSPA Monthly Soybean Production Estimate",
          data: recs.map(r => scaleVal(r.soybeans.production, unit)),
          borderColor: "#059669",
          borderWidth: 2.2,
          pointRadius: 1.5,
          tension: 0.25,
          yAxisID: "y",
          order: 1
        }
      ]
    },
    options: {
      ...chartOptionsCommon(uLabel, unit),
      scales: {
        x: { stacked: freq === "annual", ticks: { color: "#64748b", maxRotation: 45 }, grid: { color: "rgba(100,116,139,0.08)" } },
        y: { stacked: freq === "annual", position: "left", title: { display: true, text: uLabel, color: "#0f172a", font: { weight: "bold" } } },
        ...(freq === "annual" ? {
          y1: { position: "right", title: { display: true, text: "STU (%)", color: "#2563eb", font: { weight: "bold" } }, grid: { drawOnChartArea: false } }
        } : {})
      }
    }
  });

  // 2. SBM CHART
  const ctxSbm = document.getElementById("chart-snd-sbm").getContext("2d");
  STATE.charts.sndSbm = new Chart(ctxSbm, {
    type: "bar",
    data: {
      labels,
      datasets: freq === "annual" ? [
        {
          type: "bar",
          label: "SBM Exports",
          data: recs.map(r => scaleVal(r.sbm.exports, unit)),
          backgroundColor: "rgba(217, 119, 6, 0.80)",
          stack: "sbm",
          yAxisID: "y",
          order: 3
        },
        {
          type: "bar",
          label: "SBM Domestic Feed Use",
          data: recs.map(r => scaleVal(r.sbm.domestic_use, unit)),
          backgroundColor: "rgba(147, 51, 234, 0.75)",
          stack: "sbm",
          yAxisID: "y",
          order: 3
        },
        {
          type: "line",
          label: "SBM Production",
          data: recs.map(r => scaleVal(r.sbm.production, unit)),
          borderColor: "#0f172a",
          borderWidth: 2.3,
          pointRadius: 3,
          tension: 0.25,
          yAxisID: "y",
          order: 1
        },
        {
          type: "line",
          label: "SBM STU (%) [RHS]",
          data: recs.map(r => r.sbm.stocks_to_use),
          borderColor: "#059669",
          borderWidth: 2,
          borderDash: [4, 3],
          pointRadius: 2.5,
          tension: 0.25,
          yAxisID: "y1",
          order: 0
        }
      ] : [
        {
          type: "bar",
          label: "Monthly SBM Exports (SECEX)",
          data: recs.map(r => scaleVal(r.sbm.exports, unit)),
          backgroundColor: "rgba(217, 119, 6, 0.85)",
          yAxisID: "y",
          order: 2
        },
        {
          type: "line",
          label: "Avg SBM Export Price (US$/t) [RHS]",
          data: recs.map(r => r.sbm.export_price_usdt),
          borderColor: "#0f172a",
          borderWidth: 2,
          pointRadius: 2,
          tension: 0.25,
          yAxisID: "y1",
          order: 1
        }
      ]
    },
    options: {
      ...chartOptionsCommon(uLabel, unit),
      scales: {
        x: { stacked: freq === "annual", ticks: { color: "#64748b", maxRotation: 45 }, grid: { color: "rgba(100,116,139,0.08)" } },
        y: { stacked: freq === "annual", position: "left", title: { display: true, text: uLabel, color: "#92400e", font: { weight: "bold" } } },
        y1: { position: "right", title: { display: true, text: freq === "annual" ? "STU (%)" : "US$/t", color: "#059669", font: { weight: "bold" } }, grid: { drawOnChartArea: false } }
      }
    }
  });

  // 3. SBO CHART
  const ctxSbo = document.getElementById("chart-snd-sbo").getContext("2d");
  STATE.charts.sndSbo = new Chart(ctxSbo, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          type: "bar",
          label: "SBO Biofuel Use (Biodiesel Feedstock)",
          data: recs.map(r => scaleVal(r.sbo.biofuel_use, unit)),
          backgroundColor: "rgba(5, 150, 105, 0.82)",
          stack: "sbo",
          yAxisID: "y",
          order: 3
        },
        {
          type: "bar",
          label: "SBO Food & Other Domestic Use",
          data: recs.map(r => scaleVal(r.sbo.non_biofuel_use, unit)),
          backgroundColor: "rgba(245, 158, 11, 0.82)",
          stack: "sbo",
          yAxisID: "y",
          order: 3
        },
        {
          type: "bar",
          label: "SBO Exports",
          data: recs.map(r => scaleVal(r.sbo.exports, unit)),
          backgroundColor: "rgba(37, 99, 235, 0.78)",
          stack: "sbo",
          yAxisID: "y",
          order: 3
        },
        ...(freq === "annual" ? [
          {
            type: "line",
            label: "SBO Production",
            data: recs.map(r => scaleVal(r.sbo.production, unit)),
            borderColor: "#0f172a",
            borderWidth: 2.3,
            pointRadius: 3,
            tension: 0.25,
            yAxisID: "y",
            order: 1
          },
          {
            type: "line",
            label: "SBO STU (%) [RHS]",
            data: recs.map(r => r.sbo.stocks_to_use),
            borderColor: "#dc2626",
            borderWidth: 2,
            borderDash: [4, 3],
            pointRadius: 2.5,
            tension: 0.25,
            yAxisID: "y1",
            order: 0
          }
        ] : [])
      ]
    },
    options: {
      ...chartOptionsCommon(uLabel, unit),
      scales: {
        x: { stacked: true, ticks: { color: "#64748b", maxRotation: 45 }, grid: { color: "rgba(100,116,139,0.08)" } },
        y: { stacked: true, position: "left", title: { display: true, text: uLabel, color: "#1e40af", font: { weight: "bold" } } },
        ...(freq === "annual" ? {
          y1: { position: "right", title: { display: true, text: "STU (%)", color: "#dc2626", font: { weight: "bold" } }, grid: { drawOnChartArea: false } }
        } : {})
      }
    }
  });

  // 4. BIODIESEL & DIESEL B CHART (Works across ALL 21 Years both Annual & Monthly!)
  const ctxBio = document.getElementById("chart-snd-bio").getContext("2d");
  STATE.charts.sndBio = new Chart(ctxBio, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          type: "bar",
          label: "Biodiesel Production (ANP)",
          data: recs.map(r => scaleVal(r.biodiesel.production, unit)),
          backgroundColor: "rgba(15, 118, 110, 0.80)",
          yAxisID: "y",
          order: 3
        },
        {
          type: "line",
          label: "Soybean Oil (SBO) Feedstock Used (t Eq.)",
          data: recs.map(r => scaleVal(r.biodiesel.sbo_feedstock_kmt, unit)),
          borderColor: "#0f172a",
          borderWidth: 2.2,
          pointRadius: freq === "monthly" ? 1.2 : 3,
          tension: 0.25,
          yAxisID: "y",
          order: 1
        },
        {
          type: "line",
          label: "Effective Biodiesel Blend Rate in Diesel B (%) [RHS]",
          data: recs.map(r => r.biodiesel.effective_blend_pct),
          borderColor: "#d97706",
          borderWidth: 2.2,
          borderDash: [4, 3],
          pointRadius: freq === "monthly" ? 1.2 : 3,
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
        y: { position: "left", title: { display: true, text: uLabel, color: "#0f766e", font: { weight: "bold" } } },
        y1: { position: "right", title: { display: true, text: "Blend Rate (%)", color: "#d97706", font: { weight: "bold" } }, grid: { drawOnChartArea: false } }
      }
    }
  });

  // 5. CORN & CORN BIOETHANOL CHART
  const ctxCorn = document.getElementById("chart-snd-corn").getContext("2d");
  STATE.charts.sndCorn = new Chart(ctxCorn, {
    type: "bar",
    data: {
      labels,
      datasets: freq === "annual" ? [
        {
          type: "bar",
          label: "Corn Processed for Bioethanol [EST]",
          data: recs.map(r => scaleVal(r.corn.corn_ethanol_grind, unit)),
          backgroundColor: "rgba(124, 58, 237, 0.85)",
          stack: "corn_use",
          yAxisID: "y",
          order: 3
        },
        {
          type: "bar",
          label: "Animal Feed, Starch & Seed Use",
          data: recs.map(r => scaleVal(r.corn.feed_and_other_use, unit)),
          backgroundColor: "rgba(5, 150, 105, 0.78)",
          stack: "corn_use",
          yAxisID: "y",
          order: 3
        },
        {
          type: "bar",
          label: "Corn Exports",
          data: recs.map(r => scaleVal(r.corn.exports, unit)),
          backgroundColor: "rgba(202, 138, 4, 0.85)",
          stack: "corn_use",
          yAxisID: "y",
          order: 3
        },
        {
          type: "line",
          label: "Total Corn Production (1ª + 2ª + 3ª Safra)",
          data: recs.map(r => scaleVal(r.corn.production, unit)),
          borderColor: "#0f172a",
          borderWidth: 2.4,
          pointRadius: 3,
          tension: 0.25,
          yAxisID: "y",
          order: 1
        },
        {
          type: "line",
          label: "2nd Crop (Safrinha) Production",
          data: recs.map(r => scaleVal(r.corn.prod_2nd_crop, unit)),
          borderColor: "#dc2626",
          borderWidth: 2,
          borderDash: [4, 3],
          pointRadius: 2.5,
          tension: 0.25,
          yAxisID: "y",
          order: 0
        }
      ] : [
        {
          type: "bar",
          label: "Monthly Corn Exports (SECEX)",
          data: recs.map(r => scaleVal(r.corn.exports, unit)),
          backgroundColor: "rgba(202, 138, 4, 0.85)",
          yAxisID: "y",
          order: 3
        },
        {
          type: "line",
          label: "Mato Grosso Monthly Ethanol Output (ANP)",
          data: recs.map(r => scaleVal(r.corn.anp_mt_ethanol_kl, unit)),
          borderColor: "#7c3aed",
          borderWidth: 2.3,
          pointRadius: 1.5,
          tension: 0.25,
          yAxisID: "y",
          order: 1
        },
        {
          type: "line",
          label: "Center-West (MT+MS+GO) Monthly Ethanol (ANP)",
          data: recs.map(r => scaleVal(r.corn.anp_co_ethanol_kl, unit)),
          borderColor: "#059669",
          borderWidth: 2,
          pointRadius: 1.5,
          tension: 0.25,
          yAxisID: "y",
          order: 2
        }
      ]
    },
    options: {
      ...chartOptionsCommon(uLabel, unit),
      scales: {
        x: { stacked: freq === "annual", ticks: { color: "#64748b", maxRotation: 45 }, grid: { color: "rgba(100,116,139,0.08)" } },
        y: { stacked: freq === "annual", position: "left", title: { display: true, text: uLabel, color: "#a16207", font: { weight: "bold" } } }
      }
    }
  });

  // 6. SUGARCANE, SUGAR & ETHANOL CHART
  const ctxCane = document.getElementById("chart-snd-cane").getContext("2d");
  STATE.charts.sndCane = new Chart(ctxCane, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          type: "bar",
          label: "Hydrous Ethanol (Etanol Hidratado)",
          data: recs.map(r => scaleVal(r.sugarcane.ethanol_hydrous_kl, unit)),
          backgroundColor: "rgba(37, 99, 235, 0.80)",
          stack: "eth",
          yAxisID: "y",
          order: 3
        },
        {
          type: "bar",
          label: "Anhydrous Ethanol (Etanol Anidro)",
          data: recs.map(r => scaleVal(r.sugarcane.ethanol_anhydrous_kl, unit)),
          backgroundColor: "rgba(5, 150, 105, 0.80)",
          stack: "eth",
          yAxisID: "y",
          order: 3
        },
        ...(freq === "annual" ? [
          {
            type: "line",
            label: "Sugar Production (CONAB Açúcar)",
            data: recs.map(r => scaleVal(r.sugarcane.sugar_production, unit)),
            borderColor: "#0f172a",
            borderWidth: 2.4,
            pointRadius: 3,
            tension: 0.25,
            yAxisID: "y",
            order: 1
          },
          {
            type: "line",
            label: "ATR Allocation to Sugar (%) [RHS]",
            data: recs.map(r => r.sugarcane.atr_sugar_mix_pct),
            borderColor: "#d97706",
            borderWidth: 2,
            borderDash: [4, 3],
            pointRadius: 2.5,
            tension: 0.25,
            yAxisID: "y1",
            order: 0
          }
        ] : [
          {
            type: "line",
            label: "Hydrous Share of Total Ethanol (%) [RHS]",
            data: recs.map(r => r.sugarcane.hydrous_share_pct),
            borderColor: "#d97706",
            borderWidth: 2,
            borderDash: [4, 3],
            pointRadius: 1.2,
            tension: 0.25,
            yAxisID: "y1",
            order: 0
          }
        ])
      ]
    },
    options: {
      ...chartOptionsCommon(uLabel, unit),
      scales: {
        x: { stacked: true, ticks: { color: "#64748b", maxRotation: 45 }, grid: { color: "rgba(100,116,139,0.08)" } },
        y: { stacked: true, position: "left", title: { display: true, text: uLabel, color: "#7c3aed", font: { weight: "bold" } } },
        y1: { position: "right", title: { display: true, text: "% Share", color: "#d97706", font: { weight: "bold" } }, grid: { drawOnChartArea: false } }
      }
    }
  });
}

// ===========================================================================
// TAB 2: MONTHLY SEASONALITY EXPLORER (CHART & HEATMAP TABLE)
// ===========================================================================
function getSeasonYearSeries(yr, attrPath, calcMode = "monthly", unit = "kmt") {
  const [sec, field] = attrPath.split(".");
  const isRatio = field.includes("pct") || field.includes("ratio") || field.includes("share");
  const isNoScale = field.includes("price") || field.includes("fob") || field.includes("area");
  const isSurveyLevel = field === "production" || field === "area_harvested" || field === "prod_1st_crop" || field === "prod_2nd_crop" || field === "cane_crushed_kmt";

  const rawVals = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(m => {
    const p = `${yr}-${String(m).padStart(2, "0")}`;
    let v = STATE.master.monthly[p]?.[sec]?.[field];
    if ((v === undefined || v === null) && STATE.master.biofuel_snd?.monthly?.[p]) {
      v = STATE.master.biofuel_snd.monthly[p][field];
    }
    return v !== undefined && v !== null ? Number(v) : null;
  });

  const useCum = calcMode === "cum" && !isRatio && !isNoScale && !isSurveyLevel;
  let running = 0;
  return rawVals.map(v => {
    if (v === null) return null;
    if (useCum) {
      running += v;
      return scaleVal(running, unit, isRatio, isNoScale);
    }
    return scaleVal(v, unit, isRatio, isNoScale);
  });
}

function renderSeasonalityTab() {
  destroyChart("seasonality");

  const attrSel = document.getElementById("season-attr-select");
  const attrLabel = attrSel.options[attrSel.selectedIndex].text;
  const attrPath = STATE.seasonAttr;
  const calcMode = STATE.seasonCalc;
  const unit = STATE.seasonUnit;

  const isRatio = attrPath.includes("pct") || attrPath.includes("ratio") || attrPath.includes("share");
  const isNoScale = attrPath.includes("price") || attrPath.includes("fob") || attrPath.includes("area");
  const isSurveyLevel = attrPath.endsWith(".production") || attrPath.includes("area_harvested") || attrPath.includes("prod_1st_crop") || attrPath.includes("prod_2nd_crop") || attrPath.includes("cane_crushed_kmt");
  const effectiveCum = calcMode === "cum" && !isRatio && !isNoScale && !isSurveyLevel;

  const xLabels = MONTH_SHORT;
  const uText = isRatio ? "%" : isNoScale ? "US$ / ha" : unit === "mmt" ? "MMT / Bn L" : "1,000 t / 1,000 m³";
  const modeLabel = effectiveCum ? "Cumulative YTD (Jan–Dec)" : "Monthly Seasonality (Jan–Dec)";

  document.getElementById("season-chart-title").textContent = `${attrLabel} — ${modeLabel}`;
  document.getElementById("season-chart-sub").textContent =
    `Units: ${uText} • Min–Max Historical Band • 5Y Benchmark Average • Selected Years`;
  document.getElementById("season-table-title").textContent =
    `Monthly Seasonality Matrix & Heatmap: ${attrLabel} (${modeLabel} • ${uText})`;

  const years = getSortedSelectedYears();
  const seriesByYear = {};
  ALL_YEARS.forEach(y => {
    seriesByYear[y] = getSeasonYearSeries(y, attrPath, calcMode, unit);
  });

  // Ensure active years include years that actually have non-null monthly data
  const yearsWithData = years.filter(y => seriesByYear[y].some(v => v !== null));
  if (!yearsWithData.some(y => STATE.seasonActiveYears.has(y))) {
    yearsWithData.slice(-5).forEach(y => STATE.seasonActiveYears.add(y));
  }

  const avg5Y = [];
  const avg10Y = [];
  const minBand = [];
  const maxBand = [];

  for (let idx = 0; idx < 12; idx++) {
    const v5 = [], v10 = [], vRange = [];
    for (let y = 2016; y <= 2025; y++) {
      const v = seriesByYear[y]?.[idx];
      if (v !== null && v !== undefined && !Number.isNaN(v)) {
        v10.push(v);
        if (y >= 2021) v5.push(v);
      }
    }
    for (const y of yearsWithData) {
      const v = seriesByYear[y][idx];
      if (v !== null && !Number.isNaN(v)) vRange.push(v);
    }
    avg5Y.push(v5.length ? v5.reduce((a, b) => a + b, 0) / v5.length : null);
    avg10Y.push(v10.length ? v10.reduce((a, b) => a + b, 0) / v10.length : null);
    minBand.push(vRange.length ? Math.min(...vRange) : null);
    maxBand.push(vRange.length ? Math.max(...vRange) : null);
  }

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
      label: "Min–Max Historical Range",
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

  renderSeasonYearPills(yearsWithData);

  const palette = ["#9333ea", "#0d9488", "#e11d48", "#6366f1", "#ca8a04", "#0284c7", "#2563eb"];
  let colorIdx = 0;

  yearsWithData.forEach(yr => {
    if (!STATE.seasonActiveYears.has(yr)) return;
    const mVals = seriesByYear[yr];
    const isCurrent = yr === 2026;
    const isPrev = yr === 2025;
    let color = palette[colorIdx % palette.length];
    if (isPrev) color = "#2563eb";
    if (isCurrent) color = "#059669";
    colorIdx++;

    datasets.push({
      label: String(yr),
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
  yearsWithData.forEach(yr => {
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
    if (isRatio) return `${Number(v).toFixed(1)}%`;
    if (unit === "mmt" && !isNoScale) {
      return Number(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    return Number(v).toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  }

  function summarizeRow(arr) {
    const valid = arr.filter(x => x !== null && x !== undefined);
    if (!valid.length) return null;
    if (effectiveCum || isSurveyLevel) return valid[valid.length - 1];
    if (isRatio || isNoScale) return valid.reduce((a, b) => a + b, 0) / valid.length;
    return valid.reduce((a, b) => a + b, 0);
  }

  const summaryHeader = (effectiveCum || isSurveyLevel)
    ? "Latest / End"
    : (isRatio || isNoScale) ? "Annual Avg" : "Annual Total";

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

  yearsWithData.forEach(yr => {
    const rowVals = seriesByYear[yr];
    const agg = summarizeRow(rowVals);
    const isYtd = yr === 2026;
    html += `<tr><td class="sticky-col col-attr">${yr}</td>`;
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
    html += `<button class="${cls}" data-year="${y}">${y}</button>`;
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
// TAB 3: 50-YEAR HISTORICAL SERIES (CONAB 1976/77 – 2026/27 BY STATE)
// ===========================================================================
function renderHist50Tab() {
  destroyChart("hist50");
  const h50 = STATE.master.historical_series_50y?.[STATE.hist50Crop];
  if (!h50) return;

  const st = STATE.hist50State;
  const years = h50.years || [];
  const prodMap = h50.prod_kmt?.[st] || {};
  const areaMap = h50.area_kha?.[st] || {};
  const yieldMap = h50.yield_kgha?.[st] || {};

  const cropSel = document.getElementById("hist50-crop-select");
  const cropName = cropSel.options[cropSel.selectedIndex].text;
  document.getElementById("hist50-chart-title").textContent = `${st} — ${cropName}`;
  document.getElementById("hist50-table-title").textContent = `CONAB 50-Year State & Regional Production Matrix: ${cropName} (1,000 Tonnes)`;

  const ctx = document.getElementById("chart-hist50").getContext("2d");
  STATE.charts.hist50 = new Chart(ctx, {
    type: "bar",
    data: {
      labels: years,
      datasets: [
        {
          type: "bar",
          label: `${st} Production (1,000 t)`,
          data: years.map(y => prodMap[y] ?? null),
          backgroundColor: "rgba(5, 150, 105, 0.78)",
          yAxisID: "y",
          order: 3
        },
        {
          type: "bar",
          label: `${st} Planted Area (1,000 ha)`,
          data: years.map(y => areaMap[y] ?? null),
          backgroundColor: "rgba(37, 99, 235, 0.65)",
          yAxisID: "y",
          order: 2
        },
        {
          type: "line",
          label: `${st} Yield (kg/ha) [RHS]`,
          data: years.map(y => yieldMap[y] ?? null),
          borderColor: "#d97706",
          borderWidth: 2.3,
          pointRadius: 2,
          tension: 0.25,
          yAxisID: "y1",
          order: 1
        }
      ]
    },
    options: {
      ...chartOptionsCommon("1,000 t / 1,000 ha", "kmt"),
      scales: {
        x: { ticks: { color: "#64748b", maxRotation: 45 } },
        y: { position: "left", title: { display: true, text: "1,000 Tonnes / 1,000 Hectares", font: { weight: "bold" } } },
        y1: { position: "right", title: { display: true, text: "Yield (kg/ha)", color: "#d97706", font: { weight: "bold" } }, grid: { drawOnChartArea: false } }
      }
    }
  });

  // Render 50-Year State Production Table
  const stateKeys = Object.keys(h50.prod_kmt || {});
  let html = `<table class="data-table"><thead><tr><th class="col-attr">Region / State (1,000 t)</th>`;
  years.forEach(y => {
    html += `<th class="col-month">${y}</th>`;
  });
  html += `</tr></thead><tbody>`;

  stateKeys.forEach(sKey => {
    const isBrasil = sKey === "BRASIL";
    const sProd = h50.prod_kmt[sKey] || {};
    html += `<tr class="${isBrasil ? 'row-highlight' : ''}"><td class="sticky-col col-attr">${sKey}</td>`;
    years.forEach(y => {
      const v = sProd[y];
      html += `<td class="num col-month">${v != null ? v.toLocaleString("en-US", { maximumFractionDigits: 1 }) : '<span class="text-muted">--</span>'}</td>`;
    });
    html += `</tr>`;
  });
  html += `</tbody></table>`;
  document.getElementById("hist50-table-container").innerHTML = html;
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
      const mList = getYearMonthsList(yr, basis, "soybeans").filter(it => monthly[it.period] !== undefined);
      mList.forEach(it => headers.push(it.label));
    }
    headers.push(formatYearPillLabel(yr));
  }

  const lines = [headers.join(",")];
  const sections = [
    { name: "1. Soybeans", key: "soybeans", rows: SOYBEANS_ROWS },
    { name: "2. Soybean Meal (SBM)", key: "sbm", rows: SBM_ROWS },
    { name: "3. Soybean Oil (SBO)", key: "sbo", rows: SBO_ROWS },
    { name: "4. Biodiesel & Diesel B", key: "biodiesel", rows: BIODIESEL_ROWS },
    { name: "5. Corn & Corn Bioethanol", key: "corn", rows: CORN_ROWS },
    { name: "6. Sugarcane, Sugar & Ethanol", key: "sugarcane", rows: SUGARCANE_ROWS }
  ];

  sections.forEach(sec => {
    sec.rows.forEach(rDef => {
      if (rDef.isDivider) return;
      const row = [`"${sec.name}"`, `"${rDef.label}"`];
      for (const yr of years) {
        if (STATE.sndExpandedYears.has(yr)) {
          const mList = getYearMonthsList(yr, basis, sec.key).filter(it => monthly[it.period] !== undefined);
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
  a.download = `Brazil_Multi_Complex_SND_21Y_${basis.toUpperCase()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

window.addEventListener("DOMContentLoaded", initDashboard);


// ===========================================================================
// TAB: DEDICATED BRAZIL BIOFUEL S&D (ETHANOL & BIODIESEL INTELLIGENCE)
// ===========================================================================
const BIOFUEL_BIODIESEL_ROWS = [
  { key: "biodiesel_mandate", mKey: "biodiesel_mandate", label: "Statutory Mandate (Blend Target)", isNoScale: true, isText: true },
  { key: "biodiesel_production_k_m3", mKey: "biodiesel_production_k_m3", label: "Biodiesel Production (1,000 m³ / M Liters)", isSubtotal: true },
  { key: "biodiesel_deliveries_k_m3", mKey: "biodiesel_deliveries_k_m3", label: "Domestic Deliveries / Sales (1,000 m³)", isSubtotal: true },
  { key: "diesel_b_sales_k_m3", mKey: "diesel_b_sales_k_m3", label: "Diesel B Sales by Distributors (1,000 m³)" },
  { key: "diesel_a_imports_k_m3", mKey: "diesel_a_imports_k_m3", label: "↳ Diesel A (Fossil) Imports (1,000 m³)", isIndent: true },
  { key: "effective_blend_pct", mKey: "effective_blend_pct", label: "Effective Blend Rate in Diesel B (%)", isRatio: true, isHighlight: true },
  { key: "_div_feed", label: "FEEDSTOCK CONSUMPTION SUB-LEDGER (ANP / ABIOVE MATÉRIA-PRIMA)", isDivider: true },
  { key: "feedstock_sbo_k_m3", mKey: "feedstock_sbo_k_m3", label: "↳ Soybean Oil (Óleo de Soja) Used (1,000 m³)", isIndent: true },
  { key: "feedstock_tallow_k_m3", mKey: "feedstock_tallow_k_m3", label: "↳ Animal Tallow (Gorduras Animais) Used (1,000 m³)", isIndent: true },
  { key: "feedstock_cotton_k_m3", mKey: "feedstock_cotton_k_m3", label: "↳ Cottonseed Oil (Óleo de Algodão) Used (1,000 m³)", isIndent: true },
  { key: "feedstock_uco_k_m3", mKey: "feedstock_uco_k_m3", label: "↳ Used Cooking Oil / UCO (1,000 m³)", isIndent: true },
  { key: "feedstock_other_k_m3", mKey: "feedstock_other_k_m3", label: "↳ Other Fats & Diverse Raw Materials (1,000 m³)", isIndent: true },
  { key: "feedstock_total_k_m3", mKey: "feedstock_total_k_m3", label: "Total Feedstock Input (1,000 m³)", isSubtotal: true },
  { key: "_div_sh", label: "FEEDSTOCK SHARE OF BLEND (%)", isDivider: true },
  { key: "feedstock_sbo_share_pct", mKey: "feedstock_sbo_share_pct", label: "Soybean Oil Share of Feedstock (%)", isRatio: true, isHighlight: true },
  { key: "feedstock_tallow_share_pct", mKey: "feedstock_tallow_share_pct", label: "Animal Tallow Share (%)", isRatio: true },
  { key: "feedstock_uco_share_pct", mKey: "feedstock_uco_share_pct", label: "Used Cooking Oil Share (%)", isRatio: true },
  { key: "feedstock_cotton_share_pct", mKey: "feedstock_cotton_share_pct", label: "Cottonseed Oil Share (%)", isRatio: true }
];

const BIOFUEL_ETHANOL_ROWS = [
  { key: "ethanol_mandate", mKey: "ethanol_mandate", label: "Statutory Mandate (Gasoline C Blend Target)", isNoScale: true, isText: true },
  { key: "ethanol_total_prod_k_m3", mKey: "ethanol_total_prod_k_m3", label: "Total Ethanol Production (1,000 m³ / M Liters)", isSubtotal: true },
  { key: "_div_type", label: "ETHANOL PRODUCTION BY TYPE (HYDROUS VS ANHYDROUS)", isDivider: true },
  { key: "ethanol_anhydrous_prod_k_m3", mKey: "ethanol_anhydrous_prod_k_m3", label: "↳ Anhydrous Ethanol (Etanol Anidro — Gasoline Blend)", isIndent: true },
  { key: "ethanol_hydrous_prod_k_m3", mKey: "ethanol_hydrous_prod_k_m3", label: "↳ Hydrous Ethanol (Etanol Hidratado — Flex Fuel E100)", isIndent: true },
  { key: "ethanol_hydrous_share_pct", mKey: "ethanol_hydrous_share_pct", label: "Hydrous Share of Total Ethanol Output (%)", isRatio: true, isHighlight: true },
  { key: "_div_fuel_sales", label: "GASOLINE C & ETHANOL FUEL SALES SUB-LEDGER (ANP DISTRIBUTORS)", isDivider: true },
  { key: "gasoline_c_sales_k_m3", mKey: "gasoline_c_sales_k_m3", label: "Gasoline C Sales by Distributors (1,000 m³)" },
  { key: "anhydrous_blended_k_m3", mKey: "anhydrous_blended_k_m3", label: "↳ Anhydrous Ethanol Blended into Gasoline C (1,000 m³)", isIndent: true },
  { key: "fossil_gasoline_a_k_m3", mKey: "fossil_gasoline_a_k_m3", label: "↳ Fossil Gasoline A Base in Gasoline C (1,000 m³)", isIndent: true },
  { key: "ethanol_effective_blend_pct", mKey: "ethanol_effective_blend_pct", label: "Effective Anhydrous Blend Rate in Gasoline C (%)", isRatio: true, isHighlight: true },
  { key: "hydrous_sales_k_m3", mKey: "hydrous_sales_k_m3", label: "Hydrous Ethanol (E100) Retail Pump Sales (1,000 m³)", isSubtotal: true },
  { key: "total_otto_fuel_sales_k_m3", mKey: "total_otto_fuel_sales_k_m3", label: "Total Otto-Cycle Fuel Pool (Gasoline C + Hydrous E100)", isSubtotal: true, isHighlight: true },
  { key: "ethanol_share_otto_pct", mKey: "ethanol_share_otto_pct", label: "Total Ethanol Share of Otto Fuel Pool (%)", isRatio: true, isHighlight: true },
  { key: "_div_orig", label: "ETHANOL PRODUCTION BY FEEDSTOCK ORIGIN & REGION", isDivider: true },
  { key: "ethanol_sugarcane_prod_k_m3", mKey: "ethanol_sugarcane_prod_k_m3", label: "↳ Sugarcane Ethanol (Etanol de Cana-de-Açúcar)", isIndent: true },
  { key: "ethanol_corn_prod_k_m3", mKey: "ethanol_corn_prod_k_m3", label: "↳ Corn Ethanol (Etanol de Milho — Center-West & South)", isIndent: true, isHighlight: true },
  { key: "ethanol_corn_share_pct", mKey: "ethanol_corn_share_pct", label: "Corn Share of Total Brazil Ethanol (%)", isRatio: true, isHighlight: true },
  { key: "ethanol_sp_k_m3", mKey: "ethanol_sp_k_m3", label: "↳ São Paulo State Ethanol Output (1,000 m³)", isIndent: true },
  { key: "ethanol_co_k_m3", mKey: "ethanol_co_k_m3", label: "↳ Center-West (MT+MS+GO) Total Ethanol (1,000 m³)", isIndent: true },
  { key: "_div_grain", label: "CORN ETHANOL GRAIN USE & CO-PRODUCTS SUB-LEDGER", isDivider: true },
  { key: "corn_processed_for_ethanol_kmt", mKey: "corn_processed_for_ethanol_kmt", label: "Corn Processed for Bioethanol (1,000 t) [EST]", isIndent: true },
  { key: "ddgs_output_kmt", mKey: "ddgs_output_kmt", label: "DDGS Animal Feed Output (1,000 t) [EST]", isIndent: true }
];

let chartBioFeedstocks = null;
let chartBioEthanol = null;

function getBioUnitFactor(key, unit = (STATE.bioUnit || "m3")) {
  if (unit === "m3") return 1.0;
  // Official physical conversion factors to Metric Tonnes (1,000 m³ -> 1,000 MT):
  // Biodiesel B100: ANP/ABIOVE standard = 0.880 t/m³
  if (key.includes("biodiesel_production") || key.includes("biodiesel_deliveries") || key === "production" || key === "deliveries") return 0.880;
  // Diesel B and Diesel A (Fossil): ANP standard = 0.840 t/m³
  if (key.includes("diesel_b") || key.includes("diesel_a")) return 0.840;
  // Feedstocks:
  if (key.includes("sbo")) return 0.880;      // Soybean oil: 0.880 t/m³ (1 m³ B100 = 0.880 t SBO)
  if (key.includes("tallow")) return 0.890;   // Animal tallow: 0.890 t/m³ (774.05 k m³ * 0.89 = 688.9 kMT)
  if (key.includes("cotton")) return 0.900;   // Cottonseed oil: 0.900 t/m³
  if (key.includes("uco")) return 0.890;      // UCO: 0.890 t/m³
  if (key.includes("other_feedstock") || key.includes("feedstock_other")) return 0.890;
  if (key.includes("feedstock_total") || key === "total_feedstock_m3") return 0.884;
  // Ethanol:
  if (key.includes("anhydrous")) return 0.791; // Anhydrous ethanol: 0.791 t/m³
  if (key.includes("hydrous")) return 0.809;   // Hydrous ethanol: 0.809 t/m³
  if (key.includes("ethanol")) return 0.800;   // Ethanol average: 0.800 t/m³
  // Grain and DDGS are already in 1,000 tonnes:
  if (key.includes("corn_processed") || key.includes("ddgs")) return 1.0;
  return 1.0;
}

function formatBioLabel(label, unit = (STATE.bioUnit || "m3")) {
  if (unit === "mt") {
    return label
      .replace(/1,000\s*m³\s*\/\s*M\s*Liters/gi, "1,000 MT")
      .replace(/1,000\s*m³/gi, "1,000 MT");
  }
  return label;
}

function buildBiofuelTableHtml(tableKey, rowDefs, years) {
  const bioAnnual = STATE.master.biofuel_snd?.annual || {};
  const bioMonthly = STATE.master.biofuel_snd?.monthly || {};
  const bioBasis = "cy"; // 100% Calendar View across all Biofuel ledgers (Jan–Dec)
  const bioSec = "biodiesel";
  const unit = STATE.bioUnit || "m3";
  const unitTitle = unit === "mt" ? "1,000 MT" : "1,000 m³";

  let totalCols = 1;
  for (const yr of years) {
    if (STATE.bioExpandedYears.has(yr)) {
      const mList = getYearMonthsList(yr, bioBasis, bioSec).filter(it => bioMonthly[it.period] !== undefined);
      totalCols += mList.length;
    }
    totalCols += 1;
  }

  let html = `<table class="data-table"><thead><tr><th class="col-attr">Attribute (${unitTitle} / Metric)</th>`;
  for (const yr of years) {
    const isExp = STATE.bioExpandedYears.has(yr);
    const yrHeaderLabel = String(yr);
    if (isExp) {
      const mList = getYearMonthsList(yr, bioBasis, bioSec).filter(it => bioMonthly[it.period] !== undefined);
      for (const item of mList) {
        html += `<th class="col-month">${item.label}</th>`;
      }
    }
    html += `<th class="col-year-header col-annual" data-year="${yr}" title="Click to ${isExp ? 'collapse' : 'expand'} monthly columns">
      <span class="expand-toggle">${isExp ? "&minus;" : "+"}</span>${yrHeaderLabel}
    </th>`;
  }
  html += `</tr></thead><tbody>`;

  rowDefs.forEach(rDef => {
    if (rDef.isDivider) {
      html += `<tr class="row-section-divider"><td class="sticky-col">${rDef.label}</td><td colspan="${totalCols - 1}"></td></tr>`;
      return;
    }
    const rClsList = [];
    if (rDef.isHighlight) rClsList.push("row-highlight");
    if (rDef.isSubtotal) rClsList.push("row-subtotal");
    if (rDef.isIndent) rClsList.push("row-indent");
    const rCls = rClsList.join(" ");

    const displayLabel = formatBioLabel(rDef.label, unit);
    const factor = (rDef.isRatio || rDef.isText || rDef.isNoScale) ? 1.0 : getBioUnitFactor(rDef.key, unit);

    html += `<tr class="${rCls}"><td class="sticky-col col-attr">${displayLabel}</td>`;
    years.forEach(yr => {
      const isExp = STATE.bioExpandedYears.has(yr);
      let aVal = bioAnnual[String(yr)]?.[rDef.key];
      if (aVal != null && typeof aVal === "number" && !rDef.isRatio && !rDef.isText) {
        aVal = aVal * factor;
      }
      if (isExp) {
        const mList = getYearMonthsList(yr, bioBasis, bioSec).filter(it => bioMonthly[it.period] !== undefined);
        mList.forEach(it => {
          const mRec = bioMonthly[it.period] || {};
          let mVal = rDef.mKey ? mRec[rDef.mKey] : null;
          if (mVal != null && typeof mVal === "number" && !rDef.isRatio && !rDef.isText) {
            mVal = mVal * factor;
          }
          if (rDef.isText) {
            html += `<td class="num col-month" style="color:#64748b;">${mVal || "--"}</td>`;
          } else if (rDef.isRatio) {
            html += `<td class="num col-month" style="color:#047857;font-weight:700;">${mVal != null ? mVal.toFixed(1) + "%" : "--"}</td>`;
          } else {
            html += `<td class="num col-month">${mVal != null ? Number(mVal).toLocaleString("en-US", { maximumFractionDigits: 1 }) : "--"}</td>`;
          }
        });
      }
      if (rDef.isText) {
        html += `<td class="num col-annual" style="font-weight:600;color:#0284c7;">${aVal || "--"}</td>`;
      } else if (rDef.isRatio) {
        html += `<td class="num col-annual" style="color:#047857;font-weight:700;">${aVal != null ? aVal.toFixed(1) + "%" : "--"}</td>`;
      } else {
        html += `<td class="num col-annual">${aVal != null ? Number(aVal).toLocaleString("en-US", { maximumFractionDigits: 1 }) : "--"}</td>`;
      }
    });
    html += `</tr>`;
  });
  html += `</tbody></table>`;
  return html;
}

function buildBiofuelMatrixTableHtml(matrixRows, years, isEthanol = false) {
  const bioAnnual = STATE.master.biofuel_snd?.annual || {};
  const bioMonthly = STATE.master.biofuel_snd?.monthly || {};
  const bioBasis = "cy"; // 100% Calendar View across all Biofuel matrices (Jan–Dec)
  const bioSec = "biodiesel";
  const unit = STATE.bioUnit || "m3";
  const unitTitle = unit === "mt" ? "1,000 MT" : "1,000 m³";

  let html = `<table class="snd-matrix-table"><tbody>`;
  years.forEach(yr => {
    const aRec = bioAnnual[String(yr)] || {};
    const mItems = getYearMonthsList(yr, bioBasis, bioSec);
    const mRecs = mItems.map(it => bioMonthly[it.period] || null);

    const yrTitle = `Year ${yr}`;
    html += `<tr class="matrix-row-month"><td class="matrix-col-metric"><strong>${yrTitle} (${unitTitle})</strong></td>`;
    mItems.forEach(it => {
      html += `<td class="matrix-col-month"><strong>${it.label}</strong></td>`;
    });
    html += `<td class="matrix-col-total"><strong>Annual Total</strong></td></tr>`;

    matrixRows.forEach((rDef, idx) => {
      const isLast = idx === matrixRows.length - 1;
      const trCls = `${rDef.isRatio ? "matrix-row-su" : ""} ${isLast ? "matrix-block-end" : ""}`.trim();
      const displayLabel = formatBioLabel(rDef.label, unit);
      const factor = (rDef.isRatio || rDef.isText || rDef.isNoScale) ? 1.0 : getBioUnitFactor(rDef.key, unit);

      html += `<tr class="${trCls}"><td class="matrix-col-metric">${displayLabel}</td>`;
      for (let m = 0; m < 12; m++) {
        let val = mRecs[m]?.[rDef.mKey || rDef.key];
        if (val != null && typeof val === "number" && !rDef.isRatio) {
          val = val * factor;
        }
        if (rDef.isRatio) {
          html += `<td class="matrix-col-month" style="color:#047857;font-weight:700;">${val != null ? val.toFixed(1) + "%" : "--"}</td>`;
        } else {
          html += `<td class="matrix-col-month">${val != null ? Number(val).toLocaleString("en-US", { maximumFractionDigits: 1 }) : "--"}</td>`;
        }
      }
      let aVal = aRec[rDef.key];
      if (aVal != null && typeof aVal === "number" && !rDef.isRatio) {
        aVal = aVal * factor;
      }
      if (rDef.isRatio) {
        html += `<td class="matrix-col-total" style="color:#047857;font-weight:700;">${aVal != null ? aVal.toFixed(1) + "%" : "--"}</td></tr>`;
      } else {
        html += `<td class="matrix-col-total">${aVal != null ? Number(aVal).toLocaleString("en-US", { maximumFractionDigits: 1 }) : "--"}</td></tr>`;
      }
    });
  });
  html += `</tbody></table>`;
  return html;
}

function renderBiofuelTab() {
  const years = getSortedSelectedYears();
  const bioAnnual = STATE.master.biofuel_snd?.annual || {};

  // Visibility based on freq selector
  const tablesCont = document.getElementById("biofuel-tables-container");
  const matricesCont = document.getElementById("biofuel-matrices-container");
  if (tablesCont && matricesCont) {
    if (STATE.bioFreqMode === "matrix") {
      tablesCont.style.display = "none";
      matricesCont.style.display = "flex";
    } else {
      tablesCont.style.display = "flex";
      matricesCont.style.display = "none";
    }
  }

  // 1. Render Expandable Balance Sheets
  const bioTableCont = document.getElementById("biofuel-biodiesel-table-wrapper");
  if (bioTableCont) {
    bioTableCont.innerHTML = buildBiofuelTableHtml("biodiesel", BIOFUEL_BIODIESEL_ROWS, years);
  }

  const ethTableCont = document.getElementById("biofuel-ethanol-table-wrapper");
  if (ethTableCont) {
    ethTableCont.innerHTML = buildBiofuelTableHtml("ethanol", BIOFUEL_ETHANOL_ROWS, years);
  }

  // Add click-to-expand listeners for year headers
  document.querySelectorAll("#biofuel-tables-container .col-year-header").forEach(th => {
    th.onclick = () => {
      const yr = Number(th.dataset.year);
      if (STATE.bioExpandedYears.has(yr)) STATE.bioExpandedYears.delete(yr);
      else STATE.bioExpandedYears.add(yr);
      renderBiofuelTab();
    };
  });

  // 2. Render Monthly Matrices
  const bioMatCont = document.getElementById("biofuel-biodiesel-matrix-wrapper");
  if (bioMatCont) {
    bioMatCont.innerHTML = buildBiofuelMatrixTableHtml([
      { key: "biodiesel_production_k_m3", mKey: "biodiesel_production_k_m3", label: "Biodiesel Production (1,000 m³)" },
      { key: "biodiesel_deliveries_k_m3", mKey: "biodiesel_deliveries_k_m3", label: "Domestic Deliveries (1,000 m³)" },
      { key: "diesel_b_sales_k_m3", mKey: "diesel_b_sales_k_m3", label: "Diesel B Sales (1,000 m³)" },
      { key: "diesel_a_imports_k_m3", mKey: "diesel_a_imports_k_m3", label: "↳ Diesel A Imports (1,000 m³)" },
      { key: "feedstock_sbo_k_m3", mKey: "feedstock_sbo_k_m3", label: "↳ SBO Feedstock Used (1,000 m³)" },
      { key: "feedstock_tallow_k_m3", mKey: "feedstock_tallow_k_m3", label: "↳ Animal Tallow Used (1,000 m³)" },
      { key: "feedstock_cotton_k_m3", mKey: "feedstock_cotton_k_m3", label: "↳ Cottonseed Oil Used (1,000 m³)" },
      { key: "feedstock_uco_k_m3", mKey: "feedstock_uco_k_m3", label: "↳ Used Cooking Oil / UCO (1,000 m³)" },
      { key: "feedstock_total_k_m3", mKey: "feedstock_total_k_m3", label: "Total Feedstock Input (1,000 m³)" },
      { key: "effective_blend_pct", mKey: "effective_blend_pct", label: "Effective Blend Rate (%)", isRatio: true },
      { key: "feedstock_sbo_share_pct", mKey: "feedstock_sbo_share_pct", label: "Soybean Oil Share of Feedstock (%)", isRatio: true },
      { key: "feedstock_tallow_share_pct", mKey: "feedstock_tallow_share_pct", label: "Animal Tallow Share (%)", isRatio: true },
      { key: "feedstock_uco_share_pct", mKey: "feedstock_uco_share_pct", label: "Used Cooking Oil Share (%)", isRatio: true },
      { key: "feedstock_cotton_share_pct", mKey: "feedstock_cotton_share_pct", label: "Cottonseed Oil Share (%)", isRatio: true }
    ], years, false);
  }

  const ethMatCont = document.getElementById("biofuel-ethanol-matrix-wrapper");
  if (ethMatCont) {
    ethMatCont.innerHTML = buildBiofuelMatrixTableHtml([
      { key: "ethanol_total_prod_k_m3", mKey: "ethanol_total_prod_k_m3", label: "Total Ethanol Production (1,000 m³)" },
      { key: "ethanol_anhydrous_prod_k_m3", mKey: "ethanol_anhydrous_prod_k_m3", label: "↳ Anhydrous Ethanol (1,000 m³)" },
      { key: "ethanol_hydrous_prod_k_m3", mKey: "ethanol_hydrous_prod_k_m3", label: "↳ Hydrous Ethanol (1,000 m³)" },
      { key: "ethanol_sugarcane_prod_k_m3", mKey: "ethanol_sugarcane_prod_k_m3", label: "↳ Sugarcane Origin (1,000 m³)" },
      { key: "ethanol_corn_prod_k_m3", mKey: "ethanol_corn_prod_k_m3", label: "↳ Corn Origin (Center-West/MT) (1,000 m³)" },
      { key: "ethanol_sp_k_m3", mKey: "ethanol_sp_k_m3", label: "↳ São Paulo State Output (1,000 m³)" },
      { key: "ethanol_co_k_m3", mKey: "ethanol_co_k_m3", label: "↳ Center-West (MT+MS+GO) Output (1,000 m³)" },
      { key: "ethanol_hydrous_share_pct", mKey: "ethanol_hydrous_share_pct", label: "Hydrous Share (%)", isRatio: true },
      { key: "ethanol_corn_share_pct", mKey: "ethanol_corn_share_pct", label: "Corn Share of Total Ethanol (%)", isRatio: true },
      { key: "corn_processed_for_ethanol_kmt", mKey: "corn_processed_for_ethanol_kmt", label: "Corn Processed for Bioethanol (1,000 t) [EST]" },
      { key: "ddgs_output_kmt", mKey: "ddgs_output_kmt", label: "DDGS Animal Feed Output (1,000 t) [EST]" }
    ], years, true);
  }

  // 3. Unit selector (1,000 m³ vs 1,000 MT)
  const curUnit = STATE.bioUnit || "m3";
  document.querySelectorAll("#bio-unit-selector .seg-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.unit === curUnit);
    btn.onclick = () => {
      document.querySelectorAll("#bio-unit-selector .seg-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      STATE.bioUnit = btn.dataset.unit;
      renderBiofuelTab();
    };
  });

  // 4. Sub-view selector (all vs biodiesel vs ethanol)
  document.querySelectorAll("#bio-view-selector .seg-btn").forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll("#bio-view-selector .seg-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      STATE.bioSubView = btn.dataset.sub;
      applyBioSubView();
    };
  });
  applyBioSubView();

  // 5. Frequency selector (annual vs matrix)
  document.querySelectorAll("#bio-freq-selector .seg-btn").forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll("#bio-freq-selector .seg-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      STATE.bioFreqMode = btn.dataset.freq;
      renderBiofuelTab();
    };
  });

  // 6. CSV Export for Biofuel S&D
  const btnExpBio = document.getElementById("btn-export-biofuel-csv");
  if (btnExpBio) {
    btnExpBio.onclick = exportBiofuelCsv;
  }
}

function applyBioSubView() {
  const sub = STATE.bioSubView || "all";
  const bBlock = document.getElementById("biofuel-biodiesel-block");
  const eBlock = document.getElementById("biofuel-ethanol-block");
  const bMat = document.getElementById("biofuel-biodiesel-matrix-block");
  const eMat = document.getElementById("biofuel-ethanol-matrix-block");

  if (bBlock) bBlock.style.display = (sub === "all" || sub === "biodiesel") ? "block" : "none";
  if (eBlock) eBlock.style.display = (sub === "all" || sub === "ethanol") ? "block" : "none";
  if (bMat) bMat.style.display = (sub === "all" || sub === "biodiesel") ? "block" : "none";
  if (eMat) eMat.style.display = (sub === "all" || sub === "ethanol") ? "block" : "none";
}

function exportBiofuelCsv() {
  const years = getSortedSelectedYears();
  const bioAnnual = STATE.master.biofuel_snd?.annual || {};
  const bioMonthly = STATE.master.biofuel_snd?.monthly || {};
  const unit = STATE.bioUnit || "m3";
  const unitTitle = unit === "mt" ? "1,000 MT" : "1,000 m³";

  const headers = ["Section", `Attribute (${unitTitle})`];
  for (const yr of years) {
    if (STATE.bioExpandedYears.has(yr)) {
      const mList = getYearMonthsList(yr, "cy", "biodiesel").filter(it => bioMonthly[it.period] !== undefined);
      mList.forEach(it => headers.push(it.label));
    }
    headers.push(`Annual ${yr} (${unitTitle})`);
  }

  const lines = [headers.join(",")];
  const tables = [
    { name: "Biodiesel Ledger", rows: BIOFUEL_BIODIESEL_ROWS },
    { name: "Ethanol Ledger", rows: BIOFUEL_ETHANOL_ROWS }
  ];

  tables.forEach(sec => {
    sec.rows.forEach(rDef => {
      if (rDef.isDivider) return;
      const displayLabel = formatBioLabel(rDef.label, unit);
      const factor = (rDef.isRatio || rDef.isText || rDef.isNoScale) ? 1.0 : getBioUnitFactor(rDef.key, unit);
      const row = [`"${sec.name}"`, `"${displayLabel}"`];
      for (const yr of years) {
        if (STATE.bioExpandedYears.has(yr)) {
          const mList = getYearMonthsList(yr, "cy", "biodiesel").filter(it => bioMonthly[it.period] !== undefined);
          mList.forEach(it => {
            let mVal = rDef.mKey ? bioMonthly[it.period]?.[rDef.mKey] : "";
            if (mVal != null && typeof mVal === "number" && !rDef.isRatio && !rDef.isText) {
              mVal = (mVal * factor).toFixed(2);
            }
            row.push(mVal != null ? mVal : "");
          });
        }
        let aVal = bioAnnual[String(yr)]?.[rDef.key];
        if (aVal != null && typeof aVal === "number" && !rDef.isRatio && !rDef.isText) {
          aVal = (aVal * factor).toFixed(2);
        }
        row.push(aVal != null ? aVal : "");
      }
      lines.push(row.join(","));
    });
  });

  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `brazil_biofuel_snd_${unit.toUpperCase()}_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
