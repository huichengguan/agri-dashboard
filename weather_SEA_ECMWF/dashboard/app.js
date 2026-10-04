// State management
let currentData = null;
let currentMetric = "rainfall"; // "rainfall", "topsoil", "subsoil"
let currentMode = "monthly"; // "daily", "weekly", "monthly", "state_matrix"

let currentGroup = "all";    // "all", "Peninsular Malaysia", "Sabah & Sarawak", "Sumatera", "Kalimantan", "Sulawesi", "Papua"
let currentYear = 2026;
let selectedStateId = null;
let matrixSelectedStates = []; // Array of selected state IDs for State Matrix mode
let multiStateViewMode = "combined"; // "combined" or "breakdown"
let matrixDensity = localStorage.getItem("matrix_density") || "compact"; // "compact", "dense", "standard"
let isStatePickerCollapsed = false;
let currentChart = null;
let modalChartType = "climograph"; // "climograph" or "trend"
let modalCurrentLoc = null;

// State Matrix Filters
let matrixSelectedYears = [2026, 2025, 2024, 2023, 2022, 2021, 2020, 2019, 2018, 2017, 2016, 2015, 2014, 2013, 2012, 2011, 2010];
let matrixSelectedMonths = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

// Color Grading Function according to User Specifications:
// 5.5 - 6.5 mm/day: Average / Neutral
// Below 5.5: Gets more and more red the less it gets
// Above 6.5: Gets more and more green the higher it gets
function getRainColor(val) {
    if (val === null || val === undefined || isNaN(val)) {
        return { bg: "#f1f5f9", text: "#94a3b8" };
    }
    
    // 5.5 to 6.5 is neutral
    if (val >= 5.5 && val <= 6.5) {
        return { bg: "#e2e8f0", text: "#1e293b" };
    }
    
    // Below 5.5: progressively red
    if (val < 5.5) {
        if (val >= 4.2) return { bg: "#fed7aa", text: "#7c2d12" };       // Light peach
        if (val >= 3.0) return { bg: "#fdba74", text: "#7c2d12" };       // Soft orange
        if (val >= 2.0) return { bg: "#fb923c", text: "#ffffff" };       // Orange
        if (val >= 1.0) return { bg: "#ef4444", text: "#ffffff" };       // Red
        return { bg: "#991b1b", text: "#ffffff" };                       // Deep dark red (<1.0)
    }
    
    // Above 6.5: progressively green
    if (val > 6.5) {
        if (val <= 8.0)  return { bg: "#bbf7d0", text: "#14532d" };      // Light green
        if (val <= 11.0) return { bg: "#86efac", text: "#14532d" };      // Soft green
        if (val <= 15.0) return { bg: "#4ade80", text: "#14532d" };      // Medium green
        if (val <= 20.0) return { bg: "#16a34a", text: "#ffffff" };      // Rich green
        return { bg: "#14532d", text: "#ffffff" };                       // Dark forest green (>20)
    }

    return { bg: "#e2e8f0", text: "#1e293b" };
}

// Load data

function setMetric(metric) {
    if (metric === "topsoil") metric = "rootzone";
    currentMetric = metric;
    document.querySelectorAll(".segmented-btn[data-metric]").forEach(b => {
        b.classList.toggle("active", b.dataset.metric === metric || (metric === "rootzone" && b.dataset.metric === "topsoil"));
    });

    const descTag = document.getElementById("metric-desc-tag");
    if (descTag) {
        if (metric === "rainfall") {
            descTag.innerText = "Daily Precipitation Sum (mm/day) • ECMWF ERA5 Continuous Reanalysis";
        } else if (metric === "temperature") {
            descTag.innerText = "Daily Mean Temperature (°C) & Thermal Stress Analysis • ECMWF ERA5 Continuous Reanalysis";
        } else if (metric === "rootzone") {
            descTag.innerText = "Upper Root Zone Volumetric Moisture (0–28 cm depth, m³/m³) • Weighted 25% L1 (0–7cm) + 75% L2 (7–28cm) • Primary Feeder Root Zone • ECMWF HTESSEL";
        } else if (metric === "subsoil") {
            descTag.innerText = "Subsoil Deep Root-Zone Volumetric Moisture (28–100 cm depth, m³/m³) • Calibrated for Clay vs Loam • ECMWF HTESSEL";
        }
    }

    updateLegend();
    renderTable();
}

function getActiveMetricContext() {
    if (currentMetric === "rainfall") {
        return {
            monthly: currentData.monthly_data || {},
            baseline: currentData.baseline_monthly || {},
            unit: "mm/day",
            subUnit: "mm",
            isSoil: false,
            isTemp: false,
            title: "Rainfall"
        };
    } else if (currentMetric === "temperature") {
        return {
            monthly: currentData.monthly_temperature || {},
            baseline: currentData.baseline_temperature || {},
            unit: "°C",
            subUnit: "°C",
            isSoil: false,
            isTemp: true,
            title: "Temperature"
        };
    } else if (currentMetric === "rootzone" || currentMetric === "topsoil") {
        return {
            monthly: currentData.monthly_0_28cm || currentData.monthly_topsoil || {},
            baseline: currentData.baseline_0_28cm || currentData.baseline_topsoil || {},
            unit: "m³/m³",
            subUnit: "m³/m³",
            isSoil: true,
            isTemp: false,
            title: "Upper Root Zone (0–28 cm)"
        };
    } else {
        return {
            monthly: currentData.monthly_subsoil || {},
            baseline: currentData.baseline_subsoil || {},
            unit: "m³/m³",
            subUnit: "m³/m³",
            isSoil: true,
            isTemp: false,
            title: "Subsoil (28–100 cm)"
        };
    }
}

function getTempColor(val) {
    if (val === null || val === undefined || isNaN(val)) {
        return { bg: "#f1f5f9", text: "#94a3b8", label: "No Data" };
    }
    if (val < 25.0) return { bg: "#93c5fd", text: "#1e3a8a", label: "<25°C Cool" };
    if (val < 26.2) return { bg: "#bae6fd", text: "#0369a1", label: "Cool / Mild" };
    if (val < 27.2) return { bg: "#e2e8f0", text: "#1e293b", label: "Normal Low" };
    if (val < 28.0) return { bg: "#dcfce7", text: "#14532d", label: "Tropical Mean" };
    if (val < 29.0) return { bg: "#fef08a", text: "#713f12", label: "Warm" };
    if (val < 30.0) return { bg: "#fdba74", text: "#7c2d12", label: "High Heat" };
    if (val < 31.0) return { bg: "#ef4444", text: "#ffffff", label: "Severe Heat" };
    return { bg: "#991b1b", text: "#ffffff", label: "Heatwave" };
}

function getSoilColor(val, locId) {
    if (val === null || val === undefined || isNaN(val)) {
        return { bg: "#f1f5f9", text: "#94a3b8", label: "No Data", badge: "No Data", fullLabel: "No Data" };
    }

    // Unified 6-Tier SE Asia Oil Palm Soil Moisture Scale (Calibrated for Ultisols, Inceptisols, Oxisols & Peat)
    // Saturated / Water Surplus: Poor root aeration if prolonged (>0.440)
    if (val >= 0.440) return { bg: "#104a29", text: "#ffffff", label: "Saturated", badge: "Saturated", fullLabel: "Saturated / Water Surplus (>0.440 m³/m³)" };
    // Optimal / Well-Watered: Ideal available moisture for transpiration & bunch formation (0.360–0.440)
    if (val >= 0.360) return { bg: "#2d7a2f", text: "#ffffff", label: "Optimal", badge: "Optimal", fullLabel: "Optimal / Well-Watered (0.360–0.440 m³/m³)" };
    // Mild Deficit: Early watch, slight stomatal resistance during afternoon peak VPD (0.300–0.360)
    if (val >= 0.300) return { bg: "#fed7aa", text: "#7c2d12", label: "Mild Deficit", badge: "Mild<br>Deficit", fullLabel: "Mild Deficit / Watch (0.300–0.360 m³/m³)" };
    // Moderate Deficit: Meaningful moisture stress; stomatal closure, bunch abortion risk (0.240–0.300)
    if (val >= 0.240) return { bg: "#fb923c", text: "#ffffff", label: "Moderate Deficit", badge: "Moderate<br>Deficit", fullLabel: "Moderate Deficit (0.240–0.300 m³/m³)" };
    // Severe Drought Stress: Frond desiccation, spear leaf accumulation, prolonged yield collapse (0.170–0.240)
    if (val >= 0.170) return { bg: "#ef4444", text: "#ffffff", label: "Severe Stress", badge: "Severe<br>Stress", fullLabel: "Severe Drought Stress (0.170–0.240 m³/m³)" };
    // Extreme Wilting Point: Deep root zone exhaustion, critical cavitation risk (<0.170)
    return { bg: "#991b1b", text: "#ffffff", label: "Extreme Wilting", badge: "Extreme<br>Wilting", fullLabel: "Extreme Wilting Point (<0.170 m³/m³)" };
}

function getActiveColor(val, locId) {
    if (currentMetric === "rainfall") return getRainColor(val);
    if (currentMetric === "temperature") return getTempColor(val);
    return getSoilColor(val, locId);
}

function updateLegend() {
    const titleEl = document.querySelector(".legend-title");
    const scaleEl = document.querySelector(".legend-scale");
    if (!scaleEl) return;

    if (currentMetric === "rainfall") {
        if (titleEl) titleEl.innerText = "Average Rainfall (mm / day) Scale:";
        scaleEl.innerHTML = `
            <span class="legend-chip" style="background-color: #991b1b; color: #fff;">&lt; 1.0 (Extreme Dry)</span>
            <span class="legend-chip" style="background-color: #ef4444; color: #fff;">1.0 - 2.5</span>
            <span class="legend-chip" style="background-color: #fb923c; color: #fff;">2.5 - 4.0</span>
            <span class="legend-chip" style="background-color: #fed7aa; color: #7c2d12;">4.0 - 5.5</span>
            <span class="legend-chip" style="background-color: #e2e8f0; color: #1e293b; border: 2px solid #94a3b8;">5.5 - 6.5 Neutral / Average</span>
            <span class="legend-chip" style="background-color: #bbf7d0; color: #14532d;">6.5 - 8.0</span>
            <span class="legend-chip" style="background-color: #86efac; color: #14532d;">8.0 - 11.0</span>
            <span class="legend-chip" style="background-color: #4ade80; color: #14532d;">11.0 - 15.0</span>
            <span class="legend-chip" style="background-color: #16a34a; color: #fff;">15.0 - 20.0</span>
            <span class="legend-chip" style="background-color: #14532d; color: #fff;">&gt; 20.0 Extreme Wet</span>
        `;
    } else if (currentMetric === "temperature") {
        if (titleEl) titleEl.innerText = "Mean Temperature (°C) & Thermal Stress Scale:";
        scaleEl.innerHTML = `
            <span class="legend-chip" style="background-color: #93c5fd; color: #1e3a8a;">&lt; 25.0°C (Cool/Highland)</span>
            <span class="legend-chip" style="background-color: #bae6fd; color: #0369a1;">25.0 – 26.2°C (Mild)</span>
            <span class="legend-chip" style="background-color: #e2e8f0; color: #1e293b; border: 2px solid #94a3b8;">26.2 – 27.2°C (Normal Low)</span>
            <span class="legend-chip" style="background-color: #dcfce7; color: #14532d;">27.2 – 28.0°C (Tropical Mean)</span>
            <span class="legend-chip" style="background-color: #fef08a; color: #713f12;">28.0 – 29.0°C (Warm)</span>
            <span class="legend-chip" style="background-color: #fdba74; color: #7c2d12;">29.0 – 30.0°C (High Heat / VPD)</span>
            <span class="legend-chip" style="background-color: #ef4444; color: #fff;">30.0 – 31.0°C (Severe Heat Stress)</span>
            <span class="legend-chip" style="background-color: #991b1b; color: #fff;">&gt; 31.0°C (Extreme Heatwave)</span>
        `;
    } else if (currentMetric === "rootzone" || currentMetric === "topsoil") {
        if (titleEl) titleEl.innerText = "Upper Root Zone (0–28 cm, 25% L1 + 75% L2) Soil Moisture Scale (m³/m³):";
        scaleEl.innerHTML = `
            <span class="legend-chip" style="background-color: #991b1b; color: #fff;">&lt; 0.170 Extreme Wilting</span>
            <span class="legend-chip" style="background-color: #ef4444; color: #fff;">0.170 – 0.240 Severe Stress</span>
            <span class="legend-chip" style="background-color: #fb923c; color: #fff;">0.240 – 0.300 Moderate Deficit</span>
            <span class="legend-chip" style="background-color: #fed7aa; color: #7c2d12;">0.300 – 0.360 Mild Deficit / Watch</span>
            <span class="legend-chip" style="background-color: #2d7a2f; color: #fff;">0.360 – 0.440 Optimal / Well-Watered</span>
            <span class="legend-chip" style="background-color: #104a29; color: #fff;">&gt; 0.440 Saturated / Surplus</span>
        `;
    } else {
        if (titleEl) titleEl.innerText = "Subsoil Deep Root-Zone (28–100 cm) Volumetric Moisture Scale (m³/m³):";
        scaleEl.innerHTML = `
            <span class="legend-chip" style="background-color: #991b1b; color: #fff;">&lt; 0.170 Extreme Wilting</span>
            <span class="legend-chip" style="background-color: #ef4444; color: #fff;">0.170 – 0.240 Severe Stress</span>
            <span class="legend-chip" style="background-color: #fb923c; color: #fff;">0.240 – 0.300 Moderate Deficit</span>
            <span class="legend-chip" style="background-color: #fed7aa; color: #7c2d12;">0.300 – 0.360 Mild Deficit / Watch</span>
            <span class="legend-chip" style="background-color: #2d7a2f; color: #fff;">0.360 – 0.440 Optimal / Well-Watered</span>
            <span class="legend-chip" style="background-color: #104a29; color: #fff;">&gt; 0.440 Saturated / Surplus</span>
        `;
    }
}

async function initDashboard() {
    try {
        if (typeof window !== "undefined" && window.RAIN_DATA) {
            currentData = window.RAIN_DATA;
        } else if (typeof window !== "undefined" && window.PRECOMPUTED_DATA) {
            currentData = window.PRECOMPUTED_DATA;
        } else if (typeof PRECOMPUTED_DATA !== "undefined" && PRECOMPUTED_DATA) {
            currentData = PRECOMPUTED_DATA;
        } else if (typeof RAIN_DATA !== "undefined" && RAIN_DATA) {
            currentData = RAIN_DATA;
        } else {
            const resp = await fetch("data_cache.json");
            currentData = await resp.json();
        }
        
        if (currentData && currentData.locations && currentData.locations.length > 0) {
            selectedStateId = currentData.locations[0].id; // default to first state (Perlis)
            if (!matrixSelectedStates || matrixSelectedStates.length === 0) {
                matrixSelectedStates = [selectedStateId];
            }
        }

        const urlParams = new URLSearchParams(window.location.search);
        let stateParam = urlParams.get("state");
        let modeParam = urlParams.get("mode");
        let viewParam = urlParams.get("view");
        let densityParam = urlParams.get("density");
        let collapseParam = urlParams.get("collapse");
        let metricParam = urlParams.get("metric");

        if (window.location.hash) {
            const hashParts = window.location.hash.substring(1).split("&");
            hashParts.forEach(p => {
                const [k, v] = p.split("=");
                if (k === "state" && v) stateParam = v;
                if (k === "mode" && v) modeParam = v;
                if (k === "view" && v) viewParam = v;
                if (k === "density" && v) densityParam = v;
                if (k === "collapse" && v) collapseParam = v;
                if (k === "metric" && v) metricParam = v;
                if (!v && ["monthly", "daily", "state_matrix"].includes(k)) modeParam = k;
            });
        }

        if (metricParam && ["rainfall", "temperature", "rootzone", "topsoil", "subsoil"].includes(metricParam)) {
            if (metricParam === "topsoil") metricParam = "rootzone";
            currentMetric = metricParam;
            document.querySelectorAll(".segmented-btn[data-metric]").forEach(b => {
                b.classList.toggle("active", b.dataset.metric === metricParam);
            });
            updateLegend();
        }

        let modalParam = urlParams.get("modal") || (window.location.hash.includes("modal=") ? window.location.hash.split("modal=")[1].split("&")[0] : null);
        if (modalParam) setTimeout(() => openDrilldown(modalParam), 300);
        if (densityParam && ["compact", "dense", "standard"].includes(densityParam)) {
            matrixDensity = densityParam;
        }

        if (collapseParam === "true" || collapseParam === "1") {
            isStatePickerCollapsed = true;
        }

        if (viewParam === "breakdown" || viewParam === "combined") {
            multiStateViewMode = viewParam;
        }

        if (stateParam) {
            const pLocs = stateParam.split(",").map(s => s.trim().toLowerCase());
            const matched = currentData.locations.filter(l => pLocs.includes(l.id.toLowerCase()));
            if (matched.length > 0) {
                matrixSelectedStates = matched.map(m => m.id);
                selectedStateId = matrixSelectedStates[0];
            }
        }

        renderHeaderKPIs();
        populateYearSelect();
        populateStateSelect();
        initMatrixFilters();

        if (modeParam && ["monthly", "daily", "state_matrix"].includes(modeParam)) {
            setMode(modeParam);
        } else {
            renderTable();
        }
    } catch (e) {
        console.error("Failed to load rainfall data:", e);
        document.getElementById("table-container").innerHTML = `
            <div style="padding: 40px; text-align: center; color: #ef4444;">
                <h3>Failed to load rainfall data</h3>
                <p>Please ensure fetch_historicals.py or update_daily.py has generated data_cache.json.</p>
            </div>
        `;
    }
}

function renderHeaderKPIs() {
    if (!currentData || !currentData.kpis) return;
    const k = currentData.kpis;
    document.getElementById("kpi-date").innerText = `Latest: ${k.latest_date}`;
    document.getElementById("kpi-my-val").innerText = `${k.malaysia_avg.toFixed(1)} mm/d`;
    document.getElementById("kpi-id-val").innerText = `${k.indonesia_avg.toFixed(1)} mm/d`;
    
    if (k.driest_state && k.driest_state.name) {
        document.getElementById("kpi-dry-val").innerText = `${k.driest_state.name}`;
        document.getElementById("kpi-dry-sub").innerText = `${k.driest_state.precipitation_mm.toFixed(1)} mm • ${k.driest_state.major_group}`;
    }
    if (k.wettest_state && k.wettest_state.name) {
        document.getElementById("kpi-wet-val").innerText = `${k.wettest_state.name}`;
        document.getElementById("kpi-wet-sub").innerText = `${k.wettest_state.precipitation_mm.toFixed(1)} mm • ${k.wettest_state.major_group}`;
    }
}

function populateYearSelect() {
    const sel = document.getElementById("year-select");
    sel.innerHTML = "";
    for (let y = 2026; y >= 2010; y--) {
        const opt = document.createElement("option");
        opt.value = y;
        opt.innerText = y;
        if (y === currentYear) opt.selected = true;
        sel.appendChild(opt);
    }
    sel.addEventListener("change", (e) => {
        currentYear = parseInt(e.target.value);
        renderTable();
    });
}

function populateStateSelect() {
    const sel = document.getElementById("state-select");
    if (!sel || !currentData) return;
    sel.innerHTML = "";

    // Group locations by Major Group
    const groups = {};
    currentData.locations.forEach(loc => {
        const g = `${loc.country} - ${loc.major_group}`;
        groups[g] = groups[g] || [];
        groups[g].push(loc);
    });

    Object.keys(groups).forEach(gName => {
        const optgroup = document.createElement("optgroup");
        optgroup.label = gName;
        groups[gName].forEach(loc => {
            const opt = document.createElement("option");
            opt.value = loc.id;
            opt.innerText = loc.name;
            if (matrixSelectedStates.includes(loc.id)) opt.selected = true;
            optgroup.appendChild(opt);
        });
        sel.appendChild(optgroup);
    });

    sel.addEventListener("change", (e) => {
        matrixSelectedStates = [e.target.value];
        selectedStateId = e.target.value;
        renderStatePills();
        renderTable();
    });
}

function setMode(mode) {
    currentMode = mode;
    document.querySelectorAll(".segmented-btn[data-mode]").forEach(b => {
        b.classList.toggle("active", b.dataset.mode === mode);
    });
    
    // Toggle controls visibility based on mode
    document.getElementById("year-select-container").style.display = (mode === "monthly") ? "flex" : "none";
    document.getElementById("region-filter-container").style.display = (mode === "state_matrix") ? "none" : "inline-flex";
    document.getElementById("state-select-container").style.display = "none";
    document.getElementById("matrix-filter-bar").style.display = (mode === "state_matrix") ? "flex" : "none";
    
    if (mode === "state_matrix") {
        renderStatePills();
    }

    renderTable();
}

function setGroup(grp) {
    currentGroup = grp;
    document.querySelectorAll(".segmented-btn[data-group]").forEach(b => {
        b.classList.toggle("active", b.dataset.group === grp);
    });
    renderTable();
}

function getFilteredLocations() {
    if (!currentData) return [];
    let locs = currentData.locations;
    if (currentGroup !== "all") {
        locs = locs.filter(l => l.major_group === currentGroup);
    }
    return locs.sort((a, b) => a.sort_order - b.sort_order);
}

function renderTable() {
    if (!currentData) return;
    const locations = getFilteredLocations();

    if (currentMode === "monthly") {
        renderMonthlyTable(locations);
    } else if (currentMode === "daily") {
        renderDailyTable(locations);
    } else if (currentMode === "weekly") {
        renderWeeklyTable(locations);
    } else if (currentMode === "state_matrix") {
        renderStateYearByMonthMatrix(selectedStateId);
    }
}

// -------------------------------------------------------------
// 1. MONTHLY VIEW
// -------------------------------------------------------------
function renderMonthlyTable(locations) {
    const ctx = getActiveMetricContext();
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    let thead = `
        <tr>
            <th>Country</th>
            <th>Region / Island</th>
            <th>State / Province</th>
    `;
    monthNames.forEach(m => {
        thead += `<th style="text-align:center;">${m}</th>`;
    });
    thead += `<th style="text-align:center;">${ctx.isSoil || ctx.isTemp ? "Year Mean" : "Year Avg"}</th><th style="text-align:center;">Baseline</th></tr>`;

    let tbody = "";
    locations.forEach(loc => {
        const lid = loc.id;
        const locMonthly = (ctx.monthly && ctx.monthly[lid] && ctx.monthly[lid][currentYear]) || {};
        const baseline = (ctx.baseline && ctx.baseline[lid]) || {};

        let rowHtml = `
            <tr>
                <td><strong>${loc.country}</strong></td>
                <td><span class="group-badge">${loc.major_group}</span></td>
                <td class="col-state" onclick="viewStateInMatrix('${lid}')" title="Click to view full 2010-2026 Year x Month Matrix">${loc.name}</td>
        `;

        let yearSum = 0;
        let yearCount = 0;

        for (let m = 1; m <= 12; m++) {
            const mData = locMonthly[m];
            if (mData) {
                const avg = (ctx.isSoil || ctx.isTemp) ? mData.val : mData.avg_mm_day;
                if (ctx.isSoil || ctx.isTemp) {
                    yearSum += avg;
                    yearCount += 1;
                } else {
                    yearSum += mData.total_mm;
                    yearCount += mData.days;
                }
                const c = getActiveColor(avg, lid);
                const displayVal = ctx.isSoil ? avg.toFixed(3) : (ctx.isTemp ? avg.toFixed(1) : avg.toFixed(1));
                const tip = ctx.isSoil ? `${avg.toFixed(3)} m³/m³ (${c.label})` : (ctx.isTemp ? `${avg.toFixed(1)}°C (${c.label})` : `${mData.total_mm}mm total in ${mData.days} days`);
                rowHtml += `
                    <td class="rain-cell">
                        <span class="rain-badge" style="background-color: ${c.bg}; color: ${c.text}; ${ctx.isSoil ? 'font-size:11px;' : ''}" title="${tip}">
                            ${displayVal}
                        </span>
                    </td>
                `;
            } else {
                rowHtml += `<td class="rain-cell"><span style="color:#cbd5e1;">-</span></td>`;
            }
        }

        const yearAvg = yearCount > 0 ? (yearSum / yearCount) : null;
        if (yearAvg !== null) {
            const yc = getActiveColor(yearAvg, lid);
            const displayYAvg = ctx.isSoil ? yearAvg.toFixed(3) : yearAvg.toFixed(1);
            rowHtml += `
                <td class="rain-cell">
                    <span class="rain-badge" style="background-color: ${yc.bg}; color: ${yc.text}; font-weight:800; ${ctx.isSoil ? 'font-size:11px;' : ''}">
                        ${displayYAvg}
                    </span>
                </td>
            `;
        } else {
            rowHtml += `<td class="rain-cell">-</td>`;
        }

        const baseVals = Object.values(baseline);
        const baseAvg = baseVals.length > 0 ? (baseVals.reduce((a, b) => a + b, 0) / baseVals.length) : null;
        if (baseAvg !== null) {
            const bc = getActiveColor(baseAvg, lid);
            const displayBaseAvg = ctx.isSoil ? baseAvg.toFixed(3) : baseAvg.toFixed(1);
            rowHtml += `
                <td class="rain-cell">
                    <span class="rain-badge" style="background-color: ${bc.bg}; color: ${bc.text}; opacity: 0.85; ${ctx.isSoil ? 'font-size:11px;' : ''}">
                        ${displayBaseAvg}
                    </span>
                </td>
            `;
        } else {
            rowHtml += `<td class="rain-cell">-</td>`;
        }

        rowHtml += `</tr>`;
        tbody += rowHtml;
    });

    document.getElementById("table-container").innerHTML = `
        <table class="rainfall-table" id="exportable-table">
            <thead>${thead}</thead>
            <tbody>${tbody}</tbody>
        </table>
    `;
}

// -------------------------------------------------------------
// 2. DAILY VIEW (Recent 14 Days Matrix + Averages)
// -------------------------------------------------------------
function renderDailyTable(locations) {
    const dates = currentData.recent_daily_dates.slice(-14);
    let thead = `
        <tr>
            <th>Country</th>
            <th>Region / Island</th>
            <th>State / Province</th>
    `;
    dates.forEach(d => {
        const shortDate = d.substring(5);
        thead += `<th style="text-align:center;">${shortDate}</th>`;
    });
    thead += `<th style="text-align:center;">7d Avg</th><th style="text-align:center;">14d Avg</th></tr>`;

    let tbody = "";
    locations.forEach(loc => {
        const lid = loc.id;
        const locDaily = currentData.recent_daily[lid] || {};

        let rowHtml = `
            <tr>
                <td><strong>${loc.country}</strong></td>
                <td><span class="group-badge">${loc.major_group}</span></td>
                <td class="col-state" onclick="viewStateInMatrix('${lid}')">${loc.name}</td>
        `;

        let sum14 = 0;
        let sum7 = 0;

        dates.forEach((d, idx) => {
            const val = locDaily[d] !== undefined ? locDaily[d] : null;
            if (val !== null) {
                sum14 += val;
                if (idx >= 7) sum7 += val;
                const c = getRainColor(val);
                rowHtml += `
                    <td class="rain-cell">
                        <span class="rain-badge" style="background-color: ${c.bg}; color: ${c.text};">
                            ${val.toFixed(1)}
                        </span>
                    </td>
                `;
            } else {
                rowHtml += `<td class="rain-cell">-</td>`;
            }
        });

        const avg7 = sum7 / 7;
        const avg14 = sum14 / 14;
        const c7 = getRainColor(avg7);
        const c14 = getRainColor(avg14);

        rowHtml += `
            <td class="rain-cell"><span class="rain-badge" style="background-color: ${c7.bg}; color: ${c7.text}; font-weight:800;">${avg7.toFixed(1)}</span></td>
            <td class="rain-cell"><span class="rain-badge" style="background-color: ${c14.bg}; color: ${c14.text}; font-weight:800;">${avg14.toFixed(1)}</span></td>
        </tr>`;

        tbody += rowHtml;
    });

    document.getElementById("table-container").innerHTML = `
        <table class="rainfall-table" id="exportable-table">
            <thead>${thead}</thead>
            <tbody>${tbody}</tbody>
        </table>
    `;
}

// -------------------------------------------------------------
// 3. WEEKLY VIEW
// -------------------------------------------------------------
function renderWeeklyTable(locations) {
    const allWeeks = new Set();
    locations.forEach(loc => {
        const wData = currentData.weekly_data[loc.id] || {};
        Object.keys(wData).forEach(w => allWeeks.add(w));
    });
    const sortedWeeks = Array.from(allWeeks).sort().slice(-12);

    let thead = `
        <tr>
            <th>Country</th>
            <th>Region / Island</th>
            <th>State / Province</th>
    `;
    sortedWeeks.forEach(w => {
        thead += `<th style="text-align:center;">${w}</th>`;
    });
    thead += `<th style="text-align:center;">Period Avg</th></tr>`;

    let tbody = "";
    locations.forEach(loc => {
        const lid = loc.id;
        const wData = currentData.weekly_data[lid] || {};

        let rowHtml = `
            <tr>
                <td><strong>${loc.country}</strong></td>
                <td><span class="group-badge">${loc.major_group}</span></td>
                <td class="col-state" onclick="viewStateInMatrix('${lid}')">${loc.name}</td>
        `;

        let totalAvg = 0;
        let count = 0;

        sortedWeeks.forEach(w => {
            const item = wData[w];
            if (item) {
                totalAvg += item.avg_mm_day;
                count++;
                const c = getRainColor(item.avg_mm_day);
                rowHtml += `
                    <td class="rain-cell">
                        <span class="rain-badge" style="background-color: ${c.bg}; color: ${c.text};" title="${item.total_mm}mm total">
                            ${item.avg_mm_day.toFixed(1)}
                        </span>
                    </td>
                `;
            } else {
                rowHtml += `<td class="rain-cell">-</td>`;
            }
        });

        const periodAvg = count > 0 ? (totalAvg / count) : 0;
        const pc = getRainColor(periodAvg);
        rowHtml += `
            <td class="rain-cell"><span class="rain-badge" style="background-color: ${pc.bg}; color: ${pc.text}; font-weight:800;">${periodAvg.toFixed(1)}</span></td>
        </tr>`;

        tbody += rowHtml;
    });

    document.getElementById("table-container").innerHTML = `
        <table class="rainfall-table" id="exportable-table">
            <thead>${thead}</thead>
            <tbody>${tbody}</tbody>
        </table>
    `;
}

// -------------------------------------------------------------
// 4. STATE MATRIX: YEAR BY MONTH IN SQUARES (MULTI-STATE SUPPORT)
// -------------------------------------------------------------
function initMatrixFilters() {
    renderStatePills();
    renderYearPills();
    renderMonthPills();
    updateYearPresetButtons();
    updateMonthPresetButtons();

    if (isStatePickerCollapsed) {
        const container = document.getElementById("matrix-state-pills-container");
        const btn = document.getElementById("toggle-state-picker-btn");
        if (container) container.style.display = "none";
        if (btn) {
            btn.innerText = "▼ Show State Picker";
            btn.style.background = "#f1f5f9";
            btn.style.color = "var(--text-secondary)";
            btn.style.borderColor = "var(--border-color)";
        }
    }
}

function renderStatePills() {
    const container = document.getElementById("matrix-state-pills-container");
    if (!container || !currentData) return;
    container.innerHTML = "";

    const regionGroups = [
        { key: "Peninsular Malaysia", label: "Peninsular" },
        { key: "Sabah & Sarawak", label: "Sabah & Sarawak" },
        { key: "Sumatera", label: "Sumatera" },
        { key: "Kalimantan", label: "Kalimantan" },
        { key: "Sulawesi", label: "Sulawesi" },
        { key: "Papua", label: "Papua" }
    ];

    regionGroups.forEach(rg => {
        const row = document.createElement("div");
        row.className = "state-region-row";

        const title = document.createElement("div");
        title.className = "state-region-title";
        title.innerText = rg.label;
        row.appendChild(title);

        const pills = document.createElement("div");
        pills.className = "state-region-pills";

        const locs = currentData.locations.filter(l => l.major_group === rg.key);
        locs.forEach(loc => {
            const pill = document.createElement("button");
            pill.type = "button";
            const isSelected = matrixSelectedStates.includes(loc.id);
            pill.className = `state-toggle-pill ${isSelected ? "active" : ""}`;
            pill.innerText = loc.name;
            pill.title = `Click to toggle ${loc.name}`;
            pill.onclick = () => toggleState(loc.id);
            pills.appendChild(pill);
        });

        row.appendChild(pills);
        container.appendChild(row);
    });

    updateSelectedStateBadge();
}

function toggleState(locId) {
    if (matrixSelectedStates.includes(locId)) {
        if (matrixSelectedStates.length === 1) {
            return; // Keep at least 1 state selected
        }
        matrixSelectedStates = matrixSelectedStates.filter(id => id !== locId);
    } else {
        matrixSelectedStates.push(locId);
    }
    selectedStateId = matrixSelectedStates[0];

    // Sync dropdown if exists
    const sel = document.getElementById("state-select");
    if (sel) sel.value = selectedStateId;

    renderStatePills();
    renderTable();
}

function selectRegionStates(regionName) {
    if (!currentData) return;
    const regionLocs = currentData.locations.filter(l => l.major_group === regionName).map(l => l.id);
    matrixSelectedStates = [...regionLocs];
    selectedStateId = matrixSelectedStates[0];
    renderStatePills();
    renderTable();
}

function selectAllStates() {
    if (!currentData) return;
    matrixSelectedStates = currentData.locations.map(l => l.id);
    selectedStateId = matrixSelectedStates[0];
    renderStatePills();
    renderTable();
}

function clearStateSelection() {
    if (!currentData) return;
    matrixSelectedStates = [currentData.locations[0].id];
    selectedStateId = matrixSelectedStates[0];
    renderStatePills();
    renderTable();
}

function setMultiStateView(viewMode) {
    multiStateViewMode = viewMode;
    const btnCombined = document.getElementById("btn-view-combined");
    const btnBreakdown = document.getElementById("btn-view-breakdown");
    if (btnCombined) btnCombined.classList.toggle("active", viewMode === "combined");
    if (btnBreakdown) btnBreakdown.classList.toggle("active", viewMode === "breakdown");
    renderTable();
}

function updateSelectedStateBadge() {
    const badge = document.getElementById("selected-state-count-badge");
    const options = document.getElementById("matrix-multi-state-options");
    if (!badge || !currentData) return;

    const count = matrixSelectedStates.length;
    if (count === 1) {
        const loc = currentData.locations.find(l => l.id === matrixSelectedStates[0]);
        badge.innerText = `1 State: ${loc ? loc.name : ""}`;
        if (options) options.style.display = "none";
    } else if (count === currentData.locations.length) {
        badge.innerText = `All ${count} States Selected`;
        if (options) options.style.display = "flex";
    } else {
        const names = matrixSelectedStates.map(id => {
            const l = currentData.locations.find(x => x.id === id);
            return l ? l.name : id;
        });
        badge.innerText = count <= 3 ? `${count} States: ${names.join(", ")}` : `${count} States Selected`;
        if (options) options.style.display = "flex";
    }

    const btnCombined = document.getElementById("btn-view-combined");
    const btnBreakdown = document.getElementById("btn-view-breakdown");
    if (btnCombined) btnCombined.classList.toggle("active", multiStateViewMode === "combined");
    if (btnBreakdown) btnBreakdown.classList.toggle("active", multiStateViewMode === "breakdown");
}

function toggleStatePicker() {
    isStatePickerCollapsed = !isStatePickerCollapsed;
    const container = document.getElementById("matrix-state-pills-container");
    const btn = document.getElementById("toggle-state-picker-btn");
    if (!container || !btn) return;
    
    if (isStatePickerCollapsed) {
        container.style.display = "none";
        btn.innerText = "▼ Show State Picker";
        btn.style.background = "#f1f5f9";
        btn.style.color = "var(--text-secondary)";
        btn.style.borderColor = "var(--border-color)";
    } else {
        container.style.display = "flex";
        btn.innerText = "▲ Hide State Picker";
        btn.style.background = "#e0f2fe";
        btn.style.color = "#0369a1";
        btn.style.borderColor = "#bae6fd";
    }
}

function getDensitySelectorHtml() {
    return `
        <div class="density-selector-group" style="display: flex; align-items: center; gap: 4px; background: #f8fafc; padding: 2px 6px; border-radius: 6px; border: 1px solid var(--border-color);">
            <span style="font-size: 10.5px; font-weight: 700; color: var(--text-secondary); text-transform: uppercase; margin-right: 2px;">Cell Size:</span>
            <button class="pill-btn ${matrixDensity === 'compact' ? 'active' : ''}" id="density-compact-btn" type="button" onclick="setMatrixDensity('compact')" style="padding: 2px 7px; font-size: 11px;">Compact</button>
            <button class="pill-btn ${matrixDensity === 'dense' ? 'active' : ''}" id="density-dense-btn" type="button" onclick="setMatrixDensity('dense')" style="padding: 2px 7px; font-size: 11px;">Ultra-Dense</button>
            <button class="pill-btn ${matrixDensity === 'standard' ? 'active' : ''}" id="density-standard-btn" type="button" onclick="setMatrixDensity('standard')" style="padding: 2px 7px; font-size: 11px;">Large</button>
        </div>
    `;
}

function setMatrixDensity(density) {
    matrixDensity = density;
    localStorage.setItem("matrix_density", density);
    applyMatrixDensity();
}

function applyMatrixDensity() {
    const container = document.getElementById("table-container");
    if (!container) return;
    container.classList.remove("matrix-compact", "matrix-dense", "matrix-standard");
    container.classList.add(`matrix-${matrixDensity}`);

    document.querySelectorAll("[id^='density-']").forEach(btn => {
        btn.classList.toggle("active", btn.id === `density-${matrixDensity}-btn`);
    });
}

function renderYearPills() {
    const container = document.getElementById("year-pill-selector");
    if (!container) return;
    container.innerHTML = "";

    for (let y = 2026; y >= 2010; y--) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = `year-toggle-pill ${matrixSelectedYears.includes(y) ? "active" : ""}`;
        btn.innerText = y;
        btn.title = `Click to toggle ${y}`;
        btn.onclick = () => toggleYear(y);
        container.appendChild(btn);
    }
}

function toggleYear(y) {
    if (matrixSelectedYears.includes(y)) {
        if (matrixSelectedYears.length === 1) return; // keep at least 1 year
        matrixSelectedYears = matrixSelectedYears.filter(x => x !== y);
    } else {
        matrixSelectedYears.push(y);
        matrixSelectedYears.sort((a, b) => b - a); // descending
    }
    updateYearPresetButtons();
    renderYearPills();
    renderTable();
}

function setYearPreset(preset) {
    if (preset === "all") {
        matrixSelectedYears = [];
        for (let y = 2026; y >= 2010; y--) matrixSelectedYears.push(y);
    } else if (preset === "last5") {
        matrixSelectedYears = [2026, 2025, 2024, 2023, 2022];
    } else if (preset === "last10") {
        matrixSelectedYears = [2026, 2025, 2024, 2023, 2022, 2021, 2020, 2019, 2018, 2017];
    } else if (preset === "elnino") {
        matrixSelectedYears = [2026, 2016, 2015];
    }
    updateYearPresetButtons();
    renderYearPills();
    renderTable();
}

function updateYearPresetButtons() {
    document.querySelectorAll("[data-ypreset]").forEach(btn => {
        const p = btn.dataset.ypreset;
        let isActive = false;
        if (p === "all" && matrixSelectedYears.length === 17) isActive = true;
        else if (p === "last5" && JSON.stringify(matrixSelectedYears) === "[2026,2025,2024,2023,2022]") isActive = true;
        else if (p === "last10" && matrixSelectedYears.length === 10 && matrixSelectedYears[0] === 2026 && matrixSelectedYears[9] === 2017) isActive = true;
        else if (p === "elnino" && JSON.stringify(matrixSelectedYears) === "[2026,2016,2015]") isActive = true;
        btn.classList.toggle("active", isActive);
    });
}

function renderMonthPills() {
    const container = document.getElementById("month-pill-selector");
    if (!container) return;
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    container.innerHTML = "";

    for (let m = 1; m <= 12; m++) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = `month-toggle-pill ${matrixSelectedMonths.includes(m) ? "active" : ""}`;
        btn.innerText = monthNames[m - 1];
        btn.title = `Click to toggle ${monthNames[m - 1]}`;
        btn.onclick = () => toggleMonth(m);
        container.appendChild(btn);
    }
}

function toggleMonth(m) {
    if (matrixSelectedMonths.includes(m)) {
        if (matrixSelectedMonths.length === 1) return; // keep at least 1 month
        matrixSelectedMonths = matrixSelectedMonths.filter(x => x !== m);
    } else {
        matrixSelectedMonths.push(m);
        matrixSelectedMonths.sort((a, b) => a - b);
    }
    updateMonthPresetButtons();
    renderMonthPills();
    renderTable();
}

function setMonthPreset(preset) {
    if (preset === "all") {
        matrixSelectedMonths = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
    } else if (preset === "q1") {
        matrixSelectedMonths = [1, 2, 3];
    } else if (preset === "q2") {
        matrixSelectedMonths = [4, 5, 6];
    } else if (preset === "q3") {
        matrixSelectedMonths = [7, 8, 9];
    } else if (preset === "q4") {
        matrixSelectedMonths = [10, 11, 12];
    }
    updateMonthPresetButtons();
    renderMonthPills();
    renderTable();
}

function updateMonthPresetButtons() {
    document.querySelectorAll("[data-mpreset]").forEach(btn => {
        const p = btn.dataset.mpreset;
        let isActive = false;
        if (p === "all" && matrixSelectedMonths.length === 12) isActive = true;
        else if (p === "q1" && JSON.stringify(matrixSelectedMonths) === "[1,2,3]") isActive = true;
        else if (p === "q2" && JSON.stringify(matrixSelectedMonths) === "[4,5,6]") isActive = true;
        else if (p === "q3" && JSON.stringify(matrixSelectedMonths) === "[7,8,9]") isActive = true;
        else if (p === "q4" && JSON.stringify(matrixSelectedMonths) === "[10,11,12]") isActive = true;
        btn.classList.toggle("active", isActive);
    });
}

function viewStateInMatrix(locId) {
    matrixSelectedStates = [locId];
    selectedStateId = locId;
    const sel = document.getElementById("state-select");
    if (sel) sel.value = locId;
    renderStatePills();
    setMode("state_matrix");
}

function renderStateYearByMonthMatrix() {
    if (!currentData || !currentData.locations) return;

    // Ensure valid selection
    if (!matrixSelectedStates || matrixSelectedStates.length === 0) {
        matrixSelectedStates = [currentData.locations[0].id];
    }
    const selectedLocs = currentData.locations.filter(l => matrixSelectedStates.includes(l.id));
    if (selectedLocs.length === 0) {
        matrixSelectedStates = [currentData.locations[0].id];
        selectedLocs.push(currentData.locations[0]);
    }
    selectedStateId = matrixSelectedStates[0];
    updateSelectedStateBadge();

    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const yearsToShow = matrixSelectedYears.length > 0 ? [...matrixSelectedYears].sort((a, b) => b - a) : [2026];
    const activeMonths = matrixSelectedMonths.length > 0 ? [...matrixSelectedMonths].sort((a, b) => a - b) : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

    let yearSpanText = "";
    if (yearsToShow.length === 17) {
        yearSpanText = "2010 &ndash; 2026";
    } else if (yearsToShow.length <= 4) {
        yearSpanText = yearsToShow.join(", ");
    } else {
        yearSpanText = `${yearsToShow.length} Years Selected`;
    }

    const monthSpanText = activeMonths.length === 12 ? "All Months" : activeMonths.map(m => monthNames[m - 1]).join(", ");

    // 1. SINGLE STATE VIEW
    if (selectedLocs.length === 1) {
        const loc = selectedLocs[0];
        const { thead, tbody, grandDailyAvg } = buildMatrixTableForLocation(loc, yearsToShow, activeMonths, monthNames);

        let metricTitle = "Rainfall Matrix";
        let statLabel = "Filtered Daily Avg";
        let statVal = grandDailyAvg.toFixed(2) + " mm / day";
        if (currentMetric === "temperature") {
            metricTitle = "Mean Temperature Matrix (°C)";
            statLabel = "Filtered Mean Temp";
            statVal = grandDailyAvg.toFixed(1) + " °C";
        } else if (currentMetric === "rootzone" || currentMetric === "topsoil") {
            metricTitle = "Upper Root Zone Matrix (0–28 cm, 25% L1 + 75% L2)";
            statLabel = "Filtered Root Zone Mean";
            statVal = grandDailyAvg.toFixed(3) + " m³/m³";
        } else if (currentMetric === "subsoil") {
            metricTitle = "Subsoil Moisture Matrix (28–100 cm)";
            statLabel = "Filtered Subsoil Mean";
            statVal = grandDailyAvg.toFixed(3) + " m³/m³";
        }

        let headerHtml = `
            <div class="state-matrix-header">
                <div class="state-matrix-title">
                    <h2>${loc.name} &bull; ${metricTitle} &bull; ${yearSpanText}</h2>
                    <p>${loc.country} &bull; ${loc.major_group} &bull; Showing: ${monthSpanText}</p>
                </div>
                <div style="display: flex; gap: 16px; align-items: center; flex-wrap: wrap;">
                    ${getDensitySelectorHtml()}
                    <div style="text-align: right;">
                        <div style="font-size: 10px; color: var(--text-secondary); text-transform: uppercase; font-weight: 700;">${statLabel}</div>
                        <div style="font-size: 20px; font-weight: 800; color: var(--text-primary);">${statVal}</div>
                    </div>
                    <button class="btn btn-secondary" onclick="openDrilldown('${loc.id}')" style="background: #09444c; color: white;">
                        View Chart Trend &rarr;
                    </button>
                </div>
            </div>
        `;

        document.getElementById("table-container").innerHTML = `
            ${headerHtml}
            <div style="overflow-x: auto;">
                <table class="matrix-table" id="exportable-table">
                    ${thead}
                    ${tbody}
                </table>
            </div>
        `;
        applyMatrixDensity();
        return;
    }

    // 2. MULTIPLE STATES VIEW (COMBINED AVERAGE MATRIX)
    const { thead: combThead, tbody: combTbody, grandDailyAvg: combDailyAvg } = buildCombinedMatrixTable(selectedLocs, yearsToShow, activeMonths, monthNames);

    const stateNamesSummary = selectedLocs.length <= 5 
        ? selectedLocs.map(l => l.name).join(", ") 
        : `${selectedLocs.slice(0, 4).map(l => l.name).join(", ")} +${selectedLocs.length - 4} more`;

    let combMetricTitle = "Combined Average Rainfall Matrix";
    let combStatLabel = "Combined Daily Avg";
    let combStatVal = combDailyAvg.toFixed(2) + " mm / day";
    if (currentMetric === "temperature") {
        combMetricTitle = "Combined Mean Temperature Matrix (°C)";
        combStatLabel = "Combined Mean Temp";
        combStatVal = combDailyAvg.toFixed(1) + " °C";
    } else if (currentMetric === "rootzone" || currentMetric === "topsoil") {
        combMetricTitle = "Combined Upper Root Zone Matrix (0–28 cm)";
        combStatLabel = "Combined Root Zone Mean";
        combStatVal = combDailyAvg.toFixed(3) + " m³/m³";
    } else if (currentMetric === "subsoil") {
        combMetricTitle = "Combined Subsoil Moisture Matrix (28–100 cm)";
        combStatLabel = "Combined Subsoil Mean";
        combStatVal = combDailyAvg.toFixed(3) + " m³/m³";
    }

    let headerHtml = `
        <div class="state-matrix-header">
            <div class="state-matrix-title">
                <h2>${combMetricTitle} &bull; ${selectedLocs.length} States &bull; ${yearSpanText}</h2>
                <p>States: ${stateNamesSummary} &bull; Showing: ${monthSpanText}</p>
            </div>
            <div style="display: flex; gap: 16px; align-items: center; flex-wrap: wrap;">
                ${getDensitySelectorHtml()}
                <div style="text-align: right;">
                    <div style="font-size: 10px; color: var(--text-secondary); text-transform: uppercase; font-weight: 700;">${combStatLabel}</div>
                    <div style="font-size: 20px; font-weight: 800; color: var(--text-primary);">${combStatVal}</div>
                </div>
            </div>
        </div>
    `;

    let outputHtml = `${headerHtml}
        <div style="overflow-x: auto; margin-bottom: 24px;">
            <table class="matrix-table" id="exportable-table">
                ${combThead}
                ${combTbody}
            </table>
        </div>
    `;

    if (multiStateViewMode === "breakdown") {
        outputHtml += `
            <div style="margin-top: 24px; border-top: 2px dashed #cbd5e1; padding-top: 20px;">
                <h3 style="font-size: 16px; color: var(--text-primary); margin-bottom: 16px;">
                    Individual State Breakdowns (${selectedLocs.length} States)
                </h3>
        `;

        selectedLocs.forEach(loc => {
            const { thead: sThead, tbody: sTbody, grandDailyAvg: sDailyAvg } = buildMatrixTableForLocation(loc, yearsToShow, activeMonths, monthNames);
            const sVal = ctx.isSoil ? sDailyAvg.toFixed(3) + " m³/m³" : (ctx.isTemp ? sDailyAvg.toFixed(1) + " °C" : sDailyAvg.toFixed(2) + " mm/day");
            outputHtml += `
                <div style="margin-bottom: 24px; background: #fff; border: 1px solid var(--border-color); border-radius: 8px; padding: 14px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                        <div>
                            <strong style="font-size: 15px; color: var(--text-primary);">${loc.name}</strong>
                            <span style="font-size: 12px; color: var(--text-secondary); margin-left: 8px;">(${loc.major_group})</span>
                        </div>
                        <div style="display: flex; gap: 12px; align-items: center;">
                            <span style="font-size: 12px; font-weight: 700; color: var(--text-primary);">Avg: ${sVal}</span>
                            <button class="btn btn-secondary" onclick="openDrilldown('${loc.id}')" style="background: #09444c; color: white; padding: 4px 10px; font-size: 12px;">
                                Chart &rarr;
                            </button>
                        </div>
                    </div>
                    <div style="overflow-x: auto;">
                        <table class="matrix-table">
                            ${sThead}
                            ${sTbody}
                        </table>
                    </div>
                </div>
            `;
        });

        outputHtml += `</div>`;
    }

    document.getElementById("table-container").innerHTML = outputHtml;
    applyMatrixDensity();
}

function buildMatrixTableForLocation(loc, yearsToShow, activeMonths, monthNames) {
    const ctx = getActiveMetricContext();
    const locMonthly = ctx.monthly[loc.id] || {};
    const baseline = ctx.baseline[loc.id] || {};

    let grandSum = 0;
    let grandDays = 0;
    yearsToShow.forEach(y => {
        if (locMonthly[y]) {
            activeMonths.forEach(m => {
                if (locMonthly[y][m]) {
                    if (ctx.isSoil || ctx.isTemp) {
                        grandSum += locMonthly[y][m].val;
                        grandDays += 1;
                    } else {
                        grandSum += locMonthly[y][m].total_mm;
                        grandDays += locMonthly[y][m].days;
                    }
                }
            });
        }
    });
    const grandDailyAvg = grandDays > 0 ? (grandSum / grandDays) : 0;

    let thead = `
        <thead>
            <tr>
                <th style="width: 80px; text-align: right; padding-right: 14px;">Year</th>
    `;
    activeMonths.forEach(m => {
        thead += `<th>${monthNames[m - 1]}</th>`;
    });
    thead += `<th style="text-align: center;">Filtered Avg</th></tr></thead>`;

    let tbody = "<tbody>";
    yearsToShow.forEach(y => {
        const yData = locMonthly[y] || {};
        let rowSum = 0;
        let rowDays = 0;

        let rowHtml = `
            <tr>
                <td class="matrix-year-cell">${y}</td>
        `;

        activeMonths.forEach(m => {
            const mInfo = yData[m];
            if (mInfo) {
                const avg = (ctx.isSoil || ctx.isTemp) ? mInfo.val : mInfo.avg_mm_day;
                if (ctx.isSoil || ctx.isTemp) {
                    rowSum += avg;
                    rowDays += 1;
                } else {
                    rowSum += mInfo.total_mm;
                    rowDays += mInfo.days;
                }
                const c = getActiveColor(avg, loc.id);
                const displayVal = ctx.isSoil ? avg.toFixed(3) : (ctx.isTemp ? avg.toFixed(1) + "°" : avg.toFixed(1));
                const subLabel = ctx.isSoil 
                    ? (c.badge || c.label || "m³/m³") 
                    : (ctx.isTemp ? (mInfo.val_max ? `Max ${mInfo.val_max.toFixed(0)}°` : "Mean") : `${Math.round(mInfo.total_mm)}mm`);
                const tooltip = ctx.isSoil 
                    ? `${monthNames[m-1]} ${y}: ${avg.toFixed(3)} m³/m³ (${c.fullLabel || c.label})`
                    : (ctx.isTemp ? `${monthNames[m-1]} ${y}: Mean ${avg.toFixed(1)}°C, Max ${mInfo.val_max ? mInfo.val_max.toFixed(1) + '°C' : '-'}` : `${monthNames[m-1]} ${y}: ${avg.toFixed(1)} mm/day (${mInfo.total_mm} mm in ${mInfo.days} days)`);

                rowHtml += `
                    <td>
                        <div class="matrix-square-cell" style="background-color: ${c.bg}; color: ${c.text};" title="${tooltip}">
                            <span style="${ctx.isSoil ? 'font-size:10.5px;' : ''}">${displayVal}</span>
                            <span class="matrix-square-total">${subLabel}</span>
                        </div>
                    </td>
                `;
            } else {
                rowHtml += `
                    <td>
                        <div class="matrix-square-cell" style="background-color: #f8fafc; color: #cbd5e1; border: 1px dashed #e2e8f0;">
                            <span>-</span>
                        </div>
                    </td>
                `;
            }
        });

        const yAvg = rowDays > 0 ? (rowSum / rowDays) : null;
        if (yAvg !== null) {
            const yc = getActiveColor(yAvg, loc.id);
            const displayYAvg = ctx.isSoil ? yAvg.toFixed(3) : (ctx.isTemp ? yAvg.toFixed(1) + "°" : yAvg.toFixed(1));
            const subYLabel = ctx.isSoil ? "Year Mean" : (ctx.isTemp ? "Annual" : `${Math.round(rowSum)}mm`);
            rowHtml += `
                <td>
                    <div class="matrix-square-cell" style="background-color: ${yc.bg}; color: ${yc.text}; border: 2px solid rgba(0,0,0,0.15);" title="Selected Months ${y}: ${displayYAvg} ${ctx.unit}">
                        <span style="font-weight: 900; ${ctx.isSoil ? 'font-size:10.5px;' : ''}">${displayYAvg}</span>
                        <span class="matrix-square-total">${subYLabel}</span>
                    </div>
                </td>
            `;
        } else {
            rowHtml += `<td><div class="matrix-square-cell" style="background: #f8fafc; color: #cbd5e1;">-</div></td>`;
        }

        rowHtml += `</tr>`;
        tbody += rowHtml;
    });

    // Add Climatological Baseline Row
    let baseCells = `<tr class="matrix-baseline-row">
        <td class="matrix-year-cell" style="background: #0284c7; color: white; font-weight: 800;">Normal</td>`;
    let baselineSum = 0;
    let baseCount = 0;

    activeMonths.forEach(m => {
        const bVal = baseline[m];
        if (bVal !== undefined && bVal !== null) {
            baselineSum += bVal;
            baseCount++;
            const bc = getActiveColor(bVal, loc.id);
            const displayBVal = ctx.isSoil ? bVal.toFixed(3) : (ctx.isTemp ? bVal.toFixed(1) + "°" : bVal.toFixed(1));
            baseCells += `
                <td>
                    <div class="matrix-square-cell" style="background-color: ${bc.bg}; color: ${bc.text}; outline: 2px solid #0284c7; outline-offset: -2px;" title="Historical Normal ${monthNames[m-1]}: ${displayBVal} ${ctx.unit}">
                        <span style="${ctx.isSoil ? 'font-size:10.5px;' : ''}">${displayBVal}</span>
                        <span class="matrix-square-total">Normal</span>
                    </div>
                </td>
            `;
        } else {
            baseCells += `<td>-</td>`;
        }
    });

    const fullBaseAvg = baseCount > 0 ? (baselineSum / baseCount) : 0;
    const fbc = getActiveColor(fullBaseAvg, loc.id);
    const displayFBase = ctx.isSoil ? fullBaseAvg.toFixed(3) : (ctx.isTemp ? fullBaseAvg.toFixed(1) + "°" : fullBaseAvg.toFixed(1));
    baseCells += `
        <td>
            <div class="matrix-square-cell" style="background-color: ${fbc.bg}; color: ${fbc.text}; outline: 2px solid #0284c7; font-weight: 900;" title="Historical Normal Filtered Months: ${displayFBase} ${ctx.unit}">
                <span style="${ctx.isSoil ? 'font-size:10.5px;' : ''}">${displayFBase}</span>
                <span class="matrix-square-total">Normal</span>
            </div>
        </td>
    </tr>`;

    tbody += baseCells + "</tbody>";
    return { thead, tbody, grandDailyAvg };
}

function buildCombinedMatrixTable(selectedLocs, yearsToShow, activeMonths, monthNames) {
    const ctx = getActiveMetricContext();
    const getLocMonthly = (lid) => {
        return ctx.monthly[lid] || {};
    };

    let grandSum = 0;
    let grandDays = 0;

    yearsToShow.forEach(y => {
        activeMonths.forEach(m => {
            selectedLocs.forEach(loc => {
                const locM = getLocMonthly(loc.id);
                const mData = locM[y] && locM[y][m];
                if (mData) {
                    if (ctx.isSoil || ctx.isTemp) {
                        grandSum += mData.val;
                        grandDays += 1;
                    } else {
                        grandSum += mData.total_mm;
                        grandDays += mData.days;
                    }
                }
            });
        });
    });

    const grandDailyAvg = grandDays > 0 ? (grandSum / grandDays) : 0;

    let thead = `
        <thead>
            <tr>
                <th style="width: 80px; text-align: right; padding-right: 14px;">Year</th>
    `;
    activeMonths.forEach(m => {
        thead += `<th>${monthNames[m - 1]}</th>`;
    });
    thead += `<th style="text-align: center;">Filtered Avg</th></tr></thead>`;

    let tbody = "<tbody>";
    yearsToShow.forEach(y => {
        let rowHtml = `
            <tr>
                <td class="matrix-year-cell">${y}</td>
        `;

        let ySum = 0;
        let yCount = 0;

        activeMonths.forEach(m => {
            let mSum = 0;
            let mCount = 0;

            selectedLocs.forEach(loc => {
                const locM = getLocMonthly(loc.id);
                const mData = locM[y] && locM[y][m];
                if (mData) {
                    const v = (ctx.isSoil || ctx.isTemp) ? mData.val : mData.avg_mm_day;
                    mSum += v;
                    mCount++;
                }
            });

            if (mCount > 0) {
                const avg = mSum / mCount;
                ySum += avg;
                yCount++;

                const primaryLocId = selectedLocs[0] ? selectedLocs[0].id : null;
                const c = getActiveColor(avg, primaryLocId);
                const displayVal = ctx.isSoil ? avg.toFixed(3) : (ctx.isTemp ? avg.toFixed(1) + "°" : avg.toFixed(1));
                const subLabel = ctx.isSoil ? (c.badge || c.label || "m³/m³") : (ctx.isTemp ? "Mean" : "Comb");

                rowHtml += `
                    <td>
                        <div class="matrix-square-cell" style="background-color: ${c.bg}; color: ${c.text};" title="${monthNames[m-1]} ${y}: ${displayVal} ${ctx.unit} (${c.fullLabel || c.label} - ${selectedLocs.length} states combined)">
                            <span style="${ctx.isSoil ? 'font-size:10.5px;' : ''}">${displayVal}</span>
                            <span class="matrix-square-total">${subLabel}</span>
                        </div>
                    </td>
                `;
            } else {
                rowHtml += `<td><div class="matrix-square-cell" style="background: #f8fafc; color: #cbd5e1;">-</div></td>`;
            }
        });

        const yAvg = yCount > 0 ? (ySum / yCount) : null;
        if (yAvg !== null) {
            const primaryLocId = selectedLocs[0] ? selectedLocs[0].id : null;
            const yc = getActiveColor(yAvg, primaryLocId);
            const displayYAvg = ctx.isSoil ? yAvg.toFixed(3) : (ctx.isTemp ? yAvg.toFixed(1) + "°" : yAvg.toFixed(1));
            const subYLabel = ctx.isSoil ? "Year Mean" : (ctx.isTemp ? "Annual" : "Comb");
            rowHtml += `
                <td>
                    <div class="matrix-square-cell" style="background-color: ${yc.bg}; color: ${yc.text}; border: 2px solid rgba(0,0,0,0.15);" title="${y} Combined: ${displayYAvg} ${ctx.unit}">
                        <span style="font-weight: 900; ${ctx.isSoil ? 'font-size:10.5px;' : ''}">${displayYAvg}</span>
                        <span class="matrix-square-total">${subYLabel}</span>
                    </div>
                </td>
            `;
        } else {
            rowHtml += `<td><div class="matrix-square-cell" style="background: #f8fafc; color: #cbd5e1;">-</div></td>`;
        }

        rowHtml += `</tr>`;
        tbody += rowHtml;
    });

    tbody += "</tbody>";
    return { thead, tbody, grandDailyAvg };
}

// -------------------------------------------------------------
// 5. DRILLDOWN MODAL & HISTORICAL CHART (2010 - 2026)
// -------------------------------------------------------------
function openDrilldown(locId) {
    const loc = currentData.locations.find(l => l.id === locId);
    if (!loc) return;
    modalCurrentLoc = loc;

    document.getElementById("modal-title").innerText = `${loc.name} • ${loc.major_group}`;
    document.getElementById("modal-subtitle").innerText = `${loc.country} • Coordinates: ${loc.lat.toFixed(4)}, ${loc.lon.toFixed(4)}`;
    
    document.getElementById("drilldown-modal").classList.add("active");

    renderDrilldownChart(loc);
}

function closeModal() {
    document.getElementById("drilldown-modal").classList.remove("active");
    if (currentChart) {
        currentChart.destroy();
        currentChart = null;
    }
}

function setModalChartType(type) {
    modalChartType = type;
    const btnClimo = document.getElementById("btn-chart-climograph");
    const btnTrend = document.getElementById("btn-chart-trend");
    if (btnClimo) btnClimo.classList.toggle("active", type === "climograph");
    if (btnTrend) btnTrend.classList.toggle("active", type === "trend");
    if (modalCurrentLoc) renderDrilldownChart(modalCurrentLoc);
}

function updateDrilldownChart() {
    if (modalCurrentLoc) renderDrilldownChart(modalCurrentLoc);
}

function renderDrilldownChart(loc) {
    const canvas = document.getElementById("drilldown-chart");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (currentChart) {
        currentChart.destroy();
        currentChart = null;
    }

    const monthLabels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    if (modalChartType === "climograph") {
        const yearSelect = document.getElementById("modal-year-select");
        const selYear = yearSelect ? parseInt(yearSelect.value) : 2016;

        const locMonthlyRain = (currentData.monthly_data && currentData.monthly_data[loc.id]) || {};
        const locMonthlyTemp = (currentData.monthly_temperature && currentData.monthly_temperature[loc.id]) || {};
        const baseRain = (currentData.baseline_monthly && currentData.baseline_monthly[loc.id]) || {};
        const baseTemp = (currentData.baseline_temperature && currentData.baseline_temperature[loc.id]) || {};

        const rainVals = [];
        const rainBaseVals = [];
        const tempMeanVals = [];
        const tempMaxVals = [];

        for (let m = 1; m <= 12; m++) {
            const rData = locMonthlyRain[selYear] && locMonthlyRain[selYear][m];
            rainVals.push(rData ? rData.avg_mm_day : null);
            rainBaseVals.push(baseRain[m] !== undefined ? baseRain[m] : null);

            const tData = locMonthlyTemp[selYear] && locMonthlyTemp[selYear][m];
            tempMeanVals.push(tData ? tData.val : null);
            tempMaxVals.push(tData && tData.val_max ? tData.val_max : null);
        }

        currentChart = new Chart(ctx, {
            data: {
                labels: monthLabels,
                datasets: [
                    {
                        type: "bar",
                        label: `Rainfall ${selYear} (mm/day)`,
                        data: rainVals,
                        backgroundColor: "rgba(2, 132, 199, 0.65)",
                        borderColor: "#0284c7",
                        borderWidth: 1,
                        yAxisID: "yRain",
                        order: 3
                    },
                    {
                        type: "line",
                        label: "Normal Rain (2010–2025)",
                        data: rainBaseVals,
                        borderColor: "#64748b",
                        borderWidth: 2,
                        borderDash: [4, 4],
                        fill: false,
                        tension: 0.2,
                        yAxisID: "yRain",
                        order: 4
                    },
                    {
                        type: "line",
                        label: `Mean Temp ${selYear} (°C)`,
                        data: tempMeanVals,
                        borderColor: "#ef4444",
                        backgroundColor: "#ef4444",
                        borderWidth: 3,
                        pointRadius: 4,
                        fill: false,
                        tension: 0.2,
                        yAxisID: "yTemp",
                        order: 1
                    },
                    {
                        type: "line",
                        label: `Daily Max Temp ${selYear} (°C)`,
                        data: tempMaxVals,
                        borderColor: "#991b1b",
                        backgroundColor: "#991b1b",
                        borderWidth: 2,
                        borderDash: [3, 3],
                        pointRadius: 3,
                        fill: false,
                        tension: 0.2,
                        yAxisID: "yTemp",
                        order: 2
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: "index", intersect: false },
                plugins: {
                    legend: { position: "top" },
                    title: {
                        display: true,
                        text: `Climograph: Temperature & Thermal Stress vs. Precipitation (${loc.name}, ${selYear})`
                    },
                    tooltip: {
                        callbacks: {
                            label: function(c) {
                                if (c.dataset.yAxisID === "yRain") {
                                    return `${c.dataset.label}: ${c.raw !== null ? c.raw.toFixed(1) + ' mm/day' : 'N/A'}`;
                                } else {
                                    return `${c.dataset.label}: ${c.raw !== null ? c.raw.toFixed(1) + ' °C' : 'N/A'}`;
                                }
                            }
                        }
                    }
                },
                scales: {
                    yRain: {
                        type: "linear",
                        position: "left",
                        beginAtZero: true,
                        title: { display: true, text: "Precipitation (mm/day)" },
                        grid: { color: "#f1f5f9" }
                    },
                    yTemp: {
                        type: "linear",
                        position: "right",
                        suggestedMin: 23,
                        suggestedMax: 38,
                        title: { display: true, text: "Temperature (°C)" },
                        grid: { drawOnChartArea: false }
                    }
                }
            }
        });
    } else {
        // Multi-Year Rainfall Trend
        const locMonthly = (currentData.monthly_data && currentData.monthly_data[loc.id]) || {};
        const baseline = (currentData.baseline_monthly && currentData.baseline_monthly[loc.id]) || {};

        const d2026 = [];
        const d2025 = [];
        const d2024 = [];
        const dBase = [];

        for (let m = 1; m <= 12; m++) {
            d2026.push(locMonthly[2026] && locMonthly[2026][m] ? locMonthly[2026][m].avg_mm_day : null);
            d2025.push(locMonthly[2025] && locMonthly[2025][m] ? locMonthly[2025][m].avg_mm_day : null);
            d2024.push(locMonthly[2024] && locMonthly[2024][m] ? locMonthly[2024][m].avg_mm_day : null);
            dBase.push(baseline[m] !== undefined ? baseline[m] : null);
        }

        currentChart = new Chart(ctx, {
            type: "line",
            data: {
                labels: monthLabels,
                datasets: [
                    {
                        label: "2026 Daily Avg (mm/day)",
                        data: d2026,
                        borderColor: "#0284c7",
                        backgroundColor: "rgba(2, 132, 199, 0.1)",
                        borderWidth: 3,
                        fill: true,
                        tension: 0.2
                    },
                    {
                        label: "2025 Daily Avg (mm/day)",
                        data: d2025,
                        borderColor: "#64748b",
                        borderWidth: 2,
                        borderDash: [4, 4],
                        fill: false,
                        tension: 0.2
                    },
                    {
                        label: "2024 Daily Avg (mm/day)",
                        data: d2024,
                        borderColor: "#cbd5e1",
                        borderWidth: 1.5,
                        fill: false,
                        tension: 0.2
                    },
                    {
                        label: "Historical Normal (2010-2025 Avg)",
                        data: dBase,
                        borderColor: "#10b981",
                        borderWidth: 2,
                        fill: false,
                        tension: 0.2
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: "top" },
                    tooltip: {
                        callbacks: {
                            label: function(c) {
                                return `${c.dataset.label}: ${c.raw !== null ? c.raw.toFixed(1) + ' mm/day' : 'N/A'}`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        title: { display: true, text: "Average Rainfall (mm / day)" },
                        grid: { color: "#f1f5f9" }
                    },
                    x: {
                        grid: { color: "#f1f5f9" }
                    }
                }
            }
        });
    }
}

// -------------------------------------------------------------
// 6. CSV EXPORT
// -------------------------------------------------------------
function exportTableToCSV() {
    const table = document.getElementById("exportable-table");
    if (!table) return;

    let csv = [];
    const rows = table.querySelectorAll("tr");
    for (let r of rows) {
        let cols = [];
        for (let c of r.querySelectorAll("th, td")) {
            let txt = c.innerText.replace(/(\r\n|\n|\r)/gm, " ").trim();
            txt = txt.replace(/"/g, '""');
            cols.push(`"${txt}"`);
        }
        csv.push(cols.join(","));
    }

    const csvStr = csv.join("\n");
    const blob = new Blob([csvStr], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Rainfall_Export_${currentMode}_${selectedStateId || currentGroup}_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
}

// Initialize on DOM load or immediately if already loaded
if (document.readyState === "loading") {
    window.addEventListener("DOMContentLoaded", initDashboard);
} else {
    initDashboard();
}
