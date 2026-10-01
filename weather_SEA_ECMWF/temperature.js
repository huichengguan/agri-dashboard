// =============================================================
// TEMPERATURE & CROP THERMAL STRESS DASHBOARD (2010–2027)
// ECMWF ERA5 Reanalysis & ECMWF SEAS5 51-Member Ensemble Mean
// =============================================================

let currentData = null;
let currentMetric = "temp_mean"; // 'temp_mean', 'temp_max', 'temp_min', 'min_max'
let currentMode = "monthly";     // 'monthly', 'state_matrix'
let currentGroup = "all";
let currentYear = 2026;
let selectedStateId = "MY-09";
let currentChart = null;
let modalCurrentLoc = null;

// State Matrix Multi-selection State
let matrixSelectedStates = [];
let matrixSelectedYears = [2026, 2025, 2024, 2023, 2022, 2021, 2020, 2019, 2018, 2017, 2016, 2015, 2014, 2013, 2012, 2011, 2010];
let matrixSelectedMonths = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
let multiStateViewMode = "combined"; // 'combined' or 'breakdown'
let matrixDensity = "compact";       // 'compact', 'dense', 'standard'
let isStatePickerCollapsed = false;

// -------------------------------------------------------------
// DYNAMIC COLOR SCALES BASED ON METRIC
// -------------------------------------------------------------
function getTempColor(val, metric = currentMetric, extraMax = null) {
    if (val === null || val === undefined || isNaN(val)) {
        return { bg: "#f1f5f9", text: "#94a3b8", label: "No Data" };
    }

    // 1. Mean Temperature Scale (Tropical macro-climate)
    if (metric === "temp_mean") {
        if (val < 25.0) return { bg: "#93c5fd", text: "#1e3a8a", label: "< 25.0°C Cool" };
        if (val < 26.2) return { bg: "#bae6fd", text: "#0369a1", label: "25.0 - 26.2°C Mild" };
        if (val < 27.2) return { bg: "#e2e8f0", text: "#1e293b", label: "26.2 - 27.2°C Normal Low" };
        if (val < 28.0) return { bg: "#dcfce7", text: "#14532d", label: "27.2 - 28.0°C Tropical Mean" };
        if (val < 29.0) return { bg: "#fef08a", text: "#713f12", label: "28.0 - 29.0°C Warm" };
        if (val < 30.0) return { bg: "#fdba74", text: "#7c2d12", label: "29.0 - 30.0°C High Heat" };
        if (val < 31.0) return { bg: "#ef4444", text: "#ffffff", label: "30.0 - 31.0°C Severe Heat" };
        return { bg: "#991b1b", text: "#ffffff", label: "> 31.0°C Heatwave" };
    }

    // 2. Max Temperature Scale (Crop Daytime Heat Stress & VPD Constriction)
    if (metric === "temp_max") {
        if (val < 30.0) return { bg: "#dcfce7", text: "#14532d", label: "< 30.0°C Optimal / Mild" };
        if (val < 32.0) return { bg: "#fef08a", text: "#713f12", label: "30.0 - 32.0°C Normal Day" };
        if (val < 33.5) return { bg: "#fdba74", text: "#7c2d12", label: "32.0 - 33.5°C Elevated Heat" };
        if (val < 35.0) return { bg: "#ef4444", text: "#ffffff", label: "33.5 - 35.0°C High VPD Stress" };
        return { bg: "#991b1b", text: "#ffffff", label: "≥ 35.0°C Critical Heatwave" };
    }

    // 3. Min Temperature Scale (Night Respiration Loss & Chilling)
    if (metric === "temp_min") {
        if (val < 21.0) return { bg: "#93c5fd", text: "#1e3a8a", label: "< 21.0°C Chilling / Slow" };
        if (val < 23.0) return { bg: "#bae6fd", text: "#0369a1", label: "21.0 - 23.0°C Cool Night (Conserves)" };
        if (val < 24.5) return { bg: "#dcfce7", text: "#14532d", label: "23.0 - 24.5°C Optimal Night" };
        if (val < 26.0) return { bg: "#fdba74", text: "#7c2d12", label: "24.5 - 26.0°C Warm Night" };
        return { bg: "#ef4444", text: "#ffffff", label: "≥ 26.0°C High Respiration Loss" };
    }

    // 4. Min / Max Dual View Scale (Based on peak thermal exposure)
    const tMax = extraMax !== null ? extraMax : val;
    if (tMax >= 35.0) return { bg: "#fee2e2", text: "#991b1b", label: "Extreme Heat (Tmax ≥ 35°C)" };
    if (tMax >= 33.5) return { bg: "#ffedd5", text: "#9a3412", label: "Elevated VPD (Tmax ≥ 33.5°C)" };
    if (val < 21.0) return { bg: "#e0f2fe", text: "#0369a1", label: "Cool Night (Tmin < 21°C)" };
    return { bg: "#f8fafc", text: "#0f172a", label: "Normal Range" };
}

// -------------------------------------------------------------
// DYNAMIC LEGEND RENDERING
// -------------------------------------------------------------
function renderLegend() {
    const titleEl = document.getElementById("legend-title");
    const container = document.getElementById("legend-scale-container");
    if (!titleEl || !container) return;

    if (currentMetric === "temp_mean") {
        titleEl.innerText = "Mean Temperature (°C) Scale:";
        container.innerHTML = `
            <span class="legend-chip" style="background-color: #93c5fd; color: #1e3a8a;">&lt; 25.0°C (Cool)</span>
            <span class="legend-chip" style="background-color: #bae6fd; color: #0369a1;">25.0 – 26.2°C (Mild)</span>
            <span class="legend-chip" style="background-color: #e2e8f0; color: #1e293b; border: 2px solid #94a3b8;">26.2 – 27.2°C (Normal Low)</span>
            <span class="legend-chip" style="background-color: #dcfce7; color: #14532d;">27.2 – 28.0°C (Tropical Mean)</span>
            <span class="legend-chip" style="background-color: #fef08a; color: #713f12;">28.0 – 29.0°C (Warm)</span>
            <span class="legend-chip" style="background-color: #fdba74; color: #7c2d12;">29.0 – 30.0°C (High Heat)</span>
            <span class="legend-chip" style="background-color: #ef4444; color: #fff;">30.0 – 31.0°C (Severe Heat)</span>
            <span class="legend-chip" style="background-color: #991b1b; color: #fff;">&gt; 31.0°C (Heatwave)</span>
        `;
    } else if (currentMetric === "temp_max") {
        titleEl.innerText = "Maximum Temperature (Tmax) & Crop Heat Stress Scale:";
        container.innerHTML = `
            <span class="legend-chip" style="background-color: #dcfce7; color: #14532d;">&lt; 30.0°C (Optimal / Mild)</span>
            <span class="legend-chip" style="background-color: #fef08a; color: #713f12;">30.0 – 32.0°C (Normal Tropical Day)</span>
            <span class="legend-chip" style="background-color: #fdba74; color: #7c2d12;">32.0 – 33.5°C (Elevated Thermal Load)</span>
            <span class="legend-chip" style="background-color: #ef4444; color: #fff;">33.5 – 35.0°C (High VPD / Stomatal Closure)</span>
            <span class="legend-chip" style="background-color: #991b1b; color: #fff;">&ge; 35.0°C (Critical Heatwave & Abortion Risk)</span>
        `;
    } else if (currentMetric === "temp_min") {
        titleEl.innerText = "Minimum Temperature (Tmin) & Night Respiration Scale:";
        container.innerHTML = `
            <span class="legend-chip" style="background-color: #93c5fd; color: #1e3a8a;">&lt; 21.0°C (Nocturnal Chilling)</span>
            <span class="legend-chip" style="background-color: #bae6fd; color: #0369a1;">21.0 – 23.0°C (Cool Night • Conserves Dry Matter)</span>
            <span class="legend-chip" style="background-color: #dcfce7; color: #14532d;">23.0 – 24.5°C (Optimal Tropical Night)</span>
            <span class="legend-chip" style="background-color: #fdba74; color: #7c2d12;">24.5 – 26.0°C (Warm Night • Elevated Respiration)</span>
            <span class="legend-chip" style="background-color: #ef4444; color: #fff;">&ge; 26.0°C (High Carbohydrate Respiration Loss)</span>
        `;
    } else if (currentMetric === "min_max") {
        titleEl.innerText = "Crop Diurnal Thermal Monitor (Tmin / Tmax):";
        container.innerHTML = `
            <span class="legend-chip" style="background-color: #f8fafc; color: #0f172a; border: 1px solid #cbd5e1;"><span style="color:#0369a1; font-weight:700;">Tmin</span> / <span style="color:#b91c1c; font-weight:700;">Tmax</span> Normal Range</span>
            <span class="legend-chip" style="background-color: #ffedd5; color: #9a3412;"><span class="t-stress-badge"></span> Orange Dot = Tmax &ge; 33.5°C (High VPD Stress)</span>
            <span class="legend-chip" style="background-color: #fee2e2; color: #991b1b;"><span class="t-extreme-badge"></span> Red Dot = Tmax &ge; 35.0°C (Critical Heat Stress)</span>
            <span class="legend-chip" style="background-color: #e0f2fe; color: #0369a1;">Blue Tint = Tmin &lt; 21.0°C (Cool Night)</span>
        `;
    }
}

// -------------------------------------------------------------
// INITIALIZATION
// -------------------------------------------------------------
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
            selectedStateId = currentData.locations[0].id;
            if (!matrixSelectedStates || matrixSelectedStates.length === 0) {
                matrixSelectedStates = [selectedStateId];
            }
        }

        const urlParams = new URLSearchParams(window.location.search);
        let metricParam = urlParams.get("metric");
        let stateParam = urlParams.get("state");
        let modeParam = urlParams.get("mode");
        let viewParam = urlParams.get("view");
        let densityParam = urlParams.get("density");
        let collapseParam = urlParams.get("collapse");

        if (window.location.hash) {
            const hashParts = window.location.hash.substring(1).split("&");
            hashParts.forEach(p => {
                const [k, v] = p.split("=");
                if (k === "metric" && v) metricParam = v;
                if (k === "state" && v) stateParam = v;
                if (k === "mode" && v) modeParam = v;
                if (k === "view" && v) viewParam = v;
                if (k === "density" && v) densityParam = v;
                if (k === "collapse" && v) collapseParam = v;
            });
        }

        if (metricParam && ["temp_mean", "temp_max", "temp_min", "min_max"].includes(metricParam)) {
            currentMetric = metricParam;
        }
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

        // Update active UI buttons
        document.querySelectorAll("#metric-selector-container button[data-metric]").forEach(b => {
            b.classList.toggle("active", b.dataset.metric === currentMetric);
        });

        renderHeaderKPIs();
        renderLegend();
        populateYearSelect();
        initMatrixFilters();

        let modalParam = urlParams.get("modal") || (window.location.hash.includes("modal=") ? window.location.hash.split("modal=")[1].split("&")[0] : null);
        if (modalParam) setTimeout(() => openDrilldown(modalParam), 300);

        if (modeParam && ["monthly", "state_matrix"].includes(modeParam)) {
            setMode(modeParam);
        } else {
            renderTable();
        }
    } catch (e) {
        console.error("Failed to load temperature data:", e);
        document.getElementById("table-container").innerHTML = `
            <div style="padding: 40px; text-align: center; color: #ef4444;">
                <h3>Failed to load temperature data</h3>
                <p>Please ensure data_cache.json is available.</p>
            </div>
        `;
    }
}

// -------------------------------------------------------------
// METRIC TOGGLE: MEAN / MAX / MIN / MIN-MAX DUAL
// -------------------------------------------------------------
function setMetric(metric) {
    currentMetric = metric;
    document.querySelectorAll("#metric-selector-container button[data-metric]").forEach(b => {
        b.classList.toggle("active", b.dataset.metric === metric);
    });
    renderLegend();
    renderHeaderKPIs();
    renderTable();
}

// -------------------------------------------------------------
// HEADER KPIS
// -------------------------------------------------------------
function renderHeaderKPIs() {
    if (!currentData || !currentData.locations) return;
    const tempDict = (currentData.monthly_temperature || currentData.monthly_temp) || {};

    let allMeans = [];
    let hottest = { name: "-", val: -99, group: "", mean: 0 };
    let coolest = { name: "-", val: 99, group: "", mean: 0 };
    let heatAlertCount = 0;

    currentData.locations.forEach(loc => {
        const y26 = tempDict[loc.id] && tempDict[loc.id]["2026"];
        if (y26) {
            // Find latest available or forecast month
            const months = Object.keys(y26).map(Number).sort((a,b) => b - a);
            if (months.length > 0) {
                // Focus on October 2026 forecast or latest month
                const targetM = y26["10"] ? "10" : months[0];
                const info = y26[targetM];
                if (info && info.val !== undefined) {
                    allMeans.push(info.val);
                    const tx = info.val_max !== undefined ? info.val_max : (info.val + 4.0);
                    const tn = info.val_min !== undefined ? info.val_min : (info.val - 4.0);

                    if (tx >= 33.0) {
                        heatAlertCount++;
                    }
                    if (tx > hottest.val) {
                        hottest = { name: loc.name, val: tx, group: loc.major_group, mean: info.val, m: targetM };
                    }
                    if (tn < coolest.val) {
                        coolest = { name: loc.name, val: tn, group: loc.major_group, mean: info.val, m: targetM };
                    }
                }
            }
        }
    });

    const meanT = allMeans.length > 0 ? (allMeans.reduce((a, b) => a + b, 0) / allMeans.length) : 27.6;
    document.getElementById("kpi-temp-mean").innerText = `${meanT.toFixed(1)} °C`;
    
    if (hottest.name !== "-") {
        document.getElementById("kpi-hot-val").innerText = `${hottest.name} (${hottest.val.toFixed(1)}°C)`;
        document.getElementById("kpi-hot-sub").innerText = `Oct Forecast Peak • Mean ${hottest.mean.toFixed(1)}°C • ${hottest.group}`;
    }
    if (coolest.name !== "-") {
        document.getElementById("kpi-cool-val").innerText = `${coolest.name} (${coolest.val.toFixed(1)}°C)`;
        document.getElementById("kpi-cool-sub").innerText = `Oct Forecast Night Minimum • ${coolest.group}`;
    }

    const alertValEl = document.getElementById("kpi-alert-val");
    if (alertValEl) {
        alertValEl.innerText = `${heatAlertCount} Territories`;
        document.getElementById("kpi-alert-sub").innerText = `Tmax ≥ 33.0°C (High VPD Stomatal Risk)`;
    }
}

// -------------------------------------------------------------
// NAVIGATION CONTROLS
// -------------------------------------------------------------
function setMode(mode) {
    currentMode = mode;
    document.querySelectorAll(".controls-bar .segmented-control button[data-mode]").forEach(b => {
        b.classList.toggle("active", b.dataset.mode === mode);
    });

    const yearSelectContainer = document.getElementById("year-select-container");
    const matrixFilterBar = document.getElementById("matrix-filter-bar");
    const regionFilterContainer = document.getElementById("region-filter-container");

    if (mode === "monthly") {
        if (yearSelectContainer) yearSelectContainer.style.display = "flex";
        if (matrixFilterBar) matrixFilterBar.style.display = "none";
        if (regionFilterContainer) regionFilterContainer.style.display = "inline-flex";
    } else {
        if (yearSelectContainer) yearSelectContainer.style.display = "none";
        if (matrixFilterBar) matrixFilterBar.style.display = "block";
        if (regionFilterContainer) regionFilterContainer.style.display = "none";
    }

    renderTable();
}

function setGroup(group) {
    currentGroup = group;
    document.querySelectorAll("#region-filter-container button[data-group]").forEach(b => {
        b.classList.toggle("active", b.dataset.group === group);
    });
    renderTable();
}

function populateYearSelect() {
    const select = document.getElementById("year-select");
    if (!select) return;
    select.innerHTML = "";
    for (let y = 2026; y >= 2010; y--) {
        const opt = document.createElement("option");
        opt.value = y;
        opt.innerText = y === 2026 ? "2026 (Historical + Forecast)" : y;
        if (y === currentYear) opt.selected = true;
        select.appendChild(opt);
    }
    select.onchange = (e) => {
        currentYear = parseInt(e.target.value);
        renderTable();
    };
}

function getFilteredLocations() {
    if (!currentData || !currentData.locations) return [];
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
    } else if (currentMode === "state_matrix") {
        renderStateYearByMonthMatrix(selectedStateId);
    }
}

// -------------------------------------------------------------
// 1. MONTHLY VIEW
// -------------------------------------------------------------
function renderMonthlyTable(locations) {
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const tempDict = (currentData.monthly_temperature || currentData.monthly_temp) || {};
    const baseDict = (currentData.baseline_temperature || currentData.baseline_temp) || {};
    const baseMaxDict = currentData.baseline_temp_max || {};
    const baseMinDict = currentData.baseline_temp_min || {};

    let metricLabel = "Mean";
    if (currentMetric === "temp_max") metricLabel = "Day Max (Tmax)";
    else if (currentMetric === "temp_min") metricLabel = "Night Min (Tmin)";
    else if (currentMetric === "min_max") metricLabel = "Tmin / Tmax";

    let thead = `
        <tr>
            <th>Country</th>
            <th>Region / Island</th>
            <th>State / Province (${metricLabel})</th>
    `;
    monthNames.forEach((m, idx) => {
        const isFc = (currentYear === 2026 && idx >= 9);
        const fcBadge = isFc ? `<br><span style="font-size:9px; color:#4338ca; font-weight:700;">FC</span>` : '';
        thead += `<th style="text-align:center; min-width:${currentMetric === 'min_max' ? '74px' : '52px'};">${m}${fcBadge}</th>`;
    });
    thead += `<th style="text-align:center;">Year Avg</th><th style="text-align:center;">Normal Baseline</th></tr>`;

    let tbody = "";
    locations.forEach(loc => {
        const lid = loc.id;
        const locMonthly = (tempDict[lid] && tempDict[lid][currentYear]) || {};
        const baseline = baseDict[lid] || {};

        let rowHtml = `
            <tr>
                <td><strong>${loc.country}</strong></td>
                <td><span class="group-badge">${loc.major_group}</span></td>
                <td class="col-state" onclick="viewStateInMatrix('${lid}')" title="Click to view full Thermal Matrix">${loc.name}</td>
        `;

        let yearSum = 0;
        let yearCount = 0;

        for (let m = 1; m <= 12; m++) {
            const mData = locMonthly[m];
            if (mData) {
                const valMean = mData.val;
                const valMax = mData.val_max !== undefined ? mData.val_max : (valMean + 4.2);
                const valMin = mData.val_min !== undefined ? mData.val_min : (valMean - 4.2);

                let displayVal = valMean;
                if (currentMetric === "temp_max") displayVal = valMax;
                else if (currentMetric === "temp_min") displayVal = valMin;

                yearSum += displayVal;
                yearCount++;

                const c = getTempColor(displayVal, currentMetric, valMax);
                const isForecast = mData.is_forecast;

                let cellContent = "";
                if (currentMetric === "min_max") {
                    let alertDot = "";
                    if (valMax >= 35.0) alertDot = `<span class="t-extreme-badge" title="Critical Heatwave Tmax ≥ 35°C"></span>`;
                    else if (valMax >= 33.5) alertDot = `<span class="t-stress-badge" title="High VPD Stress Tmax ≥ 33.5°C"></span>`;

                    cellContent = `
                        <div class="cell-dual-temp">
                            <span class="t-val-min">${valMin.toFixed(1)}°</span>
                            <span class="t-sep">/</span>
                            <span class="t-val-max">${valMax.toFixed(1)}°</span>
                            ${alertDot}
                        </div>
                    `;
                } else {
                    cellContent = `${displayVal.toFixed(1)}°`;
                }

                const fcTag = isForecast ? `<span class="forecast-badge-temp">ECMWF</span>` : '';
                const tip = `${monthNames[m-1]} ${currentYear} (${loc.name}): Min ${valMin.toFixed(1)}°C | Mean ${valMean.toFixed(1)}°C | Max ${valMax.toFixed(1)}°C${isForecast ? ' [ECMWF 51-Member Ensemble]' : ''}`;

                rowHtml += `
                    <td class="rain-cell" style="background-color: ${currentMetric === 'min_max' ? c.bg : 'transparent'};">
                        ${currentMetric === 'min_max' 
                            ? `<div style="text-align:center;" title="${tip}">${cellContent}${fcTag}</div>`
                            : `<span class="rain-badge" style="background-color: ${c.bg}; color: ${c.text};" title="${tip}">
                                ${cellContent}
                               </span>${fcTag}`
                        }
                    </td>
                `;
            } else {
                rowHtml += `<td class="rain-cell"><span style="color:#cbd5e1;">-</span></td>`;
            }
        }

        // Year Average
        const yearAvg = yearCount > 0 ? (yearSum / yearCount) : null;
        if (yearAvg !== null) {
            const yc = getTempColor(yearAvg, currentMetric);
            rowHtml += `
                <td class="rain-cell">
                    <span class="rain-badge" style="background-color: ${yc.bg}; color: ${yc.text}; font-weight:800;">
                        ${yearAvg.toFixed(1)}°
                    </span>
                </td>
            `;
        } else {
            rowHtml += `<td class="rain-cell">-</td>`;
        }

        // Normal Baseline
        let targetBase = baseline;
        if (currentMetric === "temp_max" && baseMaxDict[lid]) targetBase = baseMaxDict[lid];
        else if (currentMetric === "temp_min" && baseMinDict[lid]) targetBase = baseMinDict[lid];

        const baseVals = Object.values(targetBase);
        const baseAvg = baseVals.length > 0 ? (baseVals.reduce((a, b) => a + b, 0) / baseVals.length) : null;
        if (baseAvg !== null) {
            const bc = getTempColor(baseAvg, currentMetric);
            rowHtml += `
                <td class="rain-cell">
                    <span class="rain-badge" style="background-color: ${bc.bg}; color: ${bc.text}; opacity: 0.85;">
                        ${baseAvg.toFixed(1)}°
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
// 2. STATE MATRIX: YEAR X MONTH
// -------------------------------------------------------------
function viewStateInMatrix(stateId) {
    matrixSelectedStates = [stateId];
    selectedStateId = stateId;
    setMode("state_matrix");
}

function initMatrixFilters() {
    renderYearPills();
    renderMonthPills();
    renderStatePills();
}

function renderYearPills() {
    const container = document.getElementById("year-pill-selector");
    if (!container) return;
    container.innerHTML = "";
    for (let y = 2026; y >= 2010; y--) {
        const pill = document.createElement("span");
        pill.className = "year-toggle-pill" + (matrixSelectedYears.includes(y) ? " active" : "");
        pill.innerText = y;
        pill.onclick = () => toggleYear(y);
        container.appendChild(pill);
    }
}

function toggleYear(year) {
    if (matrixSelectedYears.includes(year)) {
        if (matrixSelectedYears.length === 1) return;
        matrixSelectedYears = matrixSelectedYears.filter(y => y !== year);
    } else {
        matrixSelectedYears.push(year);
    }
    renderYearPills();
    renderTable();
}

function setYearPreset(preset) {
    document.querySelectorAll(".preset-group button[data-ypreset]").forEach(b => {
        b.classList.toggle("active", b.dataset.ypreset === preset);
    });
    if (preset === "all") {
        matrixSelectedYears = [2026, 2025, 2024, 2023, 2022, 2021, 2020, 2019, 2018, 2017, 2016, 2015, 2014, 2013, 2012, 2011, 2010];
    } else if (preset === "last5") {
        matrixSelectedYears = [2026, 2025, 2024, 2023, 2022];
    } else if (preset === "last10") {
        matrixSelectedYears = [2026, 2025, 2024, 2023, 2022, 2021, 2020, 2019, 2018, 2017];
    } else if (preset === "elnino") {
        matrixSelectedYears = [2026, 2023, 2019, 2016, 2015];
    }
    renderYearPills();
    renderTable();
}

function renderMonthPills() {
    const container = document.getElementById("month-pill-selector");
    if (!container) return;
    container.innerHTML = "";
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    for (let m = 1; m <= 12; m++) {
        const pill = document.createElement("span");
        pill.className = "month-toggle-pill" + (matrixSelectedMonths.includes(m) ? " active" : "");
        pill.innerText = monthNames[m - 1];
        pill.onclick = () => toggleMonth(m);
        container.appendChild(pill);
    }
}

function toggleMonth(month) {
    if (matrixSelectedMonths.includes(month)) {
        if (matrixSelectedMonths.length === 1) return;
        matrixSelectedMonths = matrixSelectedMonths.filter(m => m !== month);
    } else {
        matrixSelectedMonths.push(month);
    }
    renderMonthPills();
    renderTable();
}

function setMonthPreset(preset) {
    document.querySelectorAll(".preset-group button[data-mpreset]").forEach(b => {
        b.classList.toggle("active", b.dataset.mpreset === preset);
    });
    if (preset === "all") matrixSelectedMonths = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
    else if (preset === "q1") matrixSelectedMonths = [1, 2, 3];
    else if (preset === "q2") matrixSelectedMonths = [4, 5, 6];
    else if (preset === "q3") matrixSelectedMonths = [7, 8, 9];
    else if (preset === "q4") matrixSelectedMonths = [10, 11, 12];
    renderMonthPills();
    renderTable();
}

function renderStatePills() {
    const container = document.getElementById("matrix-state-pills-container");
    if (!container || !currentData) return;
    container.innerHTML = "";

    const regionOrder = [
        "Peninsular Malaysia",
        "Sabah & Sarawak",
        "Sumatera",
        "Kalimantan",
        "Sulawesi",
        "Papua",
        "South Thailand",
        "Mindanao (Copra)"
    ];

    const groups = {};
    regionOrder.forEach(r => groups[r] = []);
    currentData.locations.forEach(loc => {
        const grp = loc.major_group;
        if (!groups[grp]) groups[grp] = [];
        groups[grp].push(loc);
    });

    regionOrder.forEach(rName => {
        const locs = groups[rName];
        if (!locs || locs.length === 0) return;
        const row = document.createElement("div");
        row.className = "state-region-row";
        const title = document.createElement("span");
        title.className = "state-region-title";
        title.innerText = rName;
        row.appendChild(title);

        const pillsWrap = document.createElement("div");
        pillsWrap.className = "state-region-pills";

        locs.forEach(loc => {
            const pill = document.createElement("span");
            pill.className = "state-toggle-pill" + (matrixSelectedStates.includes(loc.id) ? " active" : "");
            pill.innerText = loc.name;
            pill.onclick = () => toggleStateSelection(loc.id);
            pillsWrap.appendChild(pill);
        });

        row.appendChild(pillsWrap);
        container.appendChild(row);
    });

    updateSelectedStateBadge();
}

function toggleStateSelection(locId) {
    if (matrixSelectedStates.includes(locId)) {
        if (matrixSelectedStates.length === 1) return;
        matrixSelectedStates = matrixSelectedStates.filter(id => id !== locId);
    } else {
        matrixSelectedStates.push(locId);
    }
    selectedStateId = matrixSelectedStates[0];
    renderStatePills();
    renderTable();
}

function selectRegionStates(regionName) {
    const matched = currentData.locations.filter(l => l.major_group === regionName).map(l => l.id);
    if (matched.length > 0) {
        matrixSelectedStates = matched;
        selectedStateId = matched[0];
        renderStatePills();
        renderTable();
    }
}

function selectAllStates() {
    matrixSelectedStates = currentData.locations.map(l => l.id);
    selectedStateId = matrixSelectedStates[0];
    renderStatePills();
    renderTable();
}

function clearStateSelection() {
    matrixSelectedStates = [currentData.locations[0].id];
    selectedStateId = currentData.locations[0].id;
    renderStatePills();
    renderTable();
}

function toggleStatePicker() {
    const container = document.getElementById("matrix-state-pills-container");
    const optRow = document.getElementById("matrix-multi-state-options");
    const btn = document.getElementById("toggle-state-picker-btn");
    isStatePickerCollapsed = !isStatePickerCollapsed;

    if (isStatePickerCollapsed) {
        container.style.display = "none";
        if (optRow) optRow.style.display = "none";
        btn.innerHTML = "▼ Show State Picker";
        btn.style.background = "#f1f5f9";
        btn.style.color = "#475569";
    } else {
        container.style.display = "flex";
        if (optRow && matrixSelectedStates.length > 1) optRow.style.display = "flex";
        btn.innerHTML = "▲ Hide State Picker";
        btn.style.background = "#e0f2fe";
        btn.style.color = "#0369a1";
    }
}

function updateSelectedStateBadge() {
    const badge = document.getElementById("selected-state-count-badge");
    const optRow = document.getElementById("matrix-multi-state-options");
    if (!badge) return;
    const count = matrixSelectedStates.length;
    if (count === 1) {
        const loc = currentData.locations.find(l => l.id === matrixSelectedStates[0]);
        badge.innerText = `1 State: ${loc ? loc.name : ''}`;
        badge.style.background = "#0e7490";
        if (optRow) optRow.style.display = "none";
    } else {
        badge.innerText = `${count} States Selected`;
        badge.style.background = "#0284c7";
        if (optRow && !isStatePickerCollapsed) optRow.style.display = "flex";
    }
}

function setMultiStateView(viewMode) {
    multiStateViewMode = viewMode;
    const bComb = document.getElementById("btn-view-combined");
    const bBreak = document.getElementById("btn-view-breakdown");
    if (bComb) bComb.classList.toggle("active", viewMode === "combined");
    if (bBreak) bBreak.classList.toggle("active", viewMode === "breakdown");
    renderTable();
}

function setMatrixDensity(density) {
    matrixDensity = density;
    applyMatrixDensity();
}

function applyMatrixDensity() {
    const wrap = document.getElementById("table-container");
    if (!wrap) return;
    wrap.classList.remove("matrix-compact", "matrix-dense", "matrix-standard");
    if (matrixDensity === "dense") wrap.classList.add("matrix-dense");
    else if (matrixDensity === "standard") wrap.classList.add("matrix-standard");
    else wrap.classList.add("matrix-compact");

    document.querySelectorAll(".density-btn").forEach(b => {
        b.classList.toggle("active", b.dataset.density === matrixDensity);
    });
}

function getDensitySelectorHtml() {
    return `
        <div style="display: inline-flex; align-items: center; gap: 4px;">
            <span style="font-size: 10.5px; font-weight: 700; color: var(--text-secondary); text-transform: uppercase;">Cell Size:</span>
            <div class="segmented-control" style="background: #e2e8f0;">
                <button class="segmented-btn density-btn ${matrixDensity === 'compact' ? 'active' : ''}" data-density="compact" onclick="setMatrixDensity('compact')">Compact</button>
                <button class="segmented-btn density-btn ${matrixDensity === 'dense' ? 'active' : ''}" data-density="dense" onclick="setMatrixDensity('dense')">Ultra-Dense</button>
                <button class="segmented-btn density-btn ${matrixDensity === 'standard' ? 'active' : ''}" data-density="standard" onclick="setMatrixDensity('standard')">Large</button>
            </div>
        </div>
    `;
}

function renderStateYearByMonthMatrix(stateId) {
    if (!currentData) return;
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

    let yearSpanText = yearsToShow.length === 17 ? "2010 &ndash; 2026" : (yearsToShow.length <= 4 ? yearsToShow.join(", ") : `${yearsToShow.length} Years Selected`);
    const monthSpanText = activeMonths.length === 12 ? "All Months" : activeMonths.map(m => monthNames[m - 1]).join(", ");

    let metricTitle = "Mean Temperature";
    if (currentMetric === "temp_max") metricTitle = "Maximum Temperature (Tmax)";
    else if (currentMetric === "temp_min") metricTitle = "Minimum Temperature (Tmin)";
    else if (currentMetric === "min_max") metricTitle = "Dual Tmin / Tmax Range";

    // 1. SINGLE STATE VIEW
    if (selectedLocs.length === 1) {
        const loc = selectedLocs[0];
        const { thead, tbody, grandDailyAvg } = buildMatrixTableForLocation(loc, yearsToShow, activeMonths, monthNames);

        let headerHtml = `
            <div class="state-matrix-header">
                <div class="state-matrix-title">
                    <h2>${loc.name} • ${metricTitle} Matrix (°C) • ${yearSpanText}</h2>
                    <p>${loc.country} • ${loc.major_group} • Showing: ${monthSpanText}</p>
                </div>
                <div style="display: flex; gap: 14px; align-items: center; flex-wrap: wrap;">
                    ${getDensitySelectorHtml()}
                    <div style="text-align: right;">
                        <div style="font-size: 10px; color: var(--text-secondary); text-transform: uppercase; font-weight: 700;">Filtered Mean</div>
                        <div style="font-size: 20px; font-weight: 800; color: var(--text-primary);">${grandDailyAvg.toFixed(1)} °C</div>
                    </div>
                    <button class="btn btn-secondary" onclick="openDrilldown('${loc.id}')" style="background: #09444c; color: white;">
                        View Thermal Climograph &rarr;
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

    // 2. MULTI-STATE COMBINED VIEW
    const { thead: combThead, tbody: combTbody, grandDailyAvg: combDailyAvg } = buildCombinedMatrixTable(selectedLocs, yearsToShow, activeMonths, monthNames);
    const stateNamesSummary = selectedLocs.length <= 5 
        ? selectedLocs.map(l => l.name).join(", ") 
        : `${selectedLocs.slice(0, 4).map(l => l.name).join(", ")} +${selectedLocs.length - 4} more`;

    let headerHtml = `
        <div class="state-matrix-header">
            <div class="state-matrix-title">
                <h2>Combined ${metricTitle} Matrix • ${selectedLocs.length} States • ${yearSpanText}</h2>
                <p>States: ${stateNamesSummary} • Showing: ${monthSpanText}</p>
            </div>
            <div style="display: flex; gap: 14px; align-items: center; flex-wrap: wrap;">
                ${getDensitySelectorHtml()}
                <div style="text-align: right;">
                    <div style="font-size: 10px; color: var(--text-secondary); text-transform: uppercase; font-weight: 700;">Combined Mean</div>
                    <div style="font-size: 20px; font-weight: 800; color: var(--text-primary);">${combDailyAvg.toFixed(1)} °C</div>
                </div>
            </div>
        </div>
    `;

    let outputHtml = `${headerHtml}
        <div style="overflow-x: auto; margin-bottom: 20px;">
            <table class="matrix-table" id="exportable-table">
                ${combThead}
                ${combTbody}
            </table>
        </div>
    `;

    if (multiStateViewMode === "breakdown") {
        outputHtml += `
            <div style="margin-top: 20px; border-top: 2px dashed #cbd5e1; padding-top: 16px;">
                <h3 style="font-size: 15px; color: var(--text-primary); margin-bottom: 14px;">
                    Individual State Thermal Breakdowns (${selectedLocs.length} States)
                </h3>
        `;

        selectedLocs.forEach(loc => {
            const { thead: sThead, tbody: sTbody, grandDailyAvg: sDailyAvg } = buildMatrixTableForLocation(loc, yearsToShow, activeMonths, monthNames);
            outputHtml += `
                <div style="margin-bottom: 20px; background: #fff; border: 1px solid var(--border-color); border-radius: 6px; padding: 12px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                        <div>
                            <strong style="font-size: 14px; color: var(--text-primary);">${loc.name}</strong>
                            <span style="font-size: 11px; color: var(--text-secondary); margin-left: 6px;">(${loc.major_group})</span>
                        </div>
                        <div style="display: flex; gap: 10px; align-items: center;">
                            <span style="font-size: 11.5px; font-weight: 700; color: var(--text-primary);">Mean: ${sDailyAvg.toFixed(1)} °C</span>
                            <button class="btn btn-secondary" onclick="openDrilldown('${loc.id}')" style="background: #09444c; color: white; padding: 3px 8px; font-size: 11px;">
                                Climograph &rarr;
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
    const tempDict = (currentData.monthly_temperature || currentData.monthly_temp) || {};
    const baseDict = (currentData.baseline_temperature || currentData.baseline_temp) || {};
    const baseMaxDict = currentData.baseline_temp_max || {};
    const baseMinDict = currentData.baseline_temp_min || {};
    const locMonthly = tempDict[loc.id] || {};
    const baseline = baseDict[loc.id] || {};

    let grandSum = 0;
    let grandCount = 0;

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
            const mData = locMonthly[y] && locMonthly[y][m];
            if (mData) {
                const valMean = mData.val;
                const valMax = mData.val_max !== undefined ? mData.val_max : (valMean + 4.2);
                const valMin = mData.val_min !== undefined ? mData.val_min : (valMean - 4.2);

                let val = valMean;
                if (currentMetric === "temp_max") val = valMax;
                else if (currentMetric === "temp_min") val = valMin;

                ySum += val;
                yCount++;
                grandSum += val;
                grandCount++;

                const c = getTempColor(val, currentMetric, valMax);
                const tip = `${monthNames[m-1]} ${y} (${loc.name}): Min ${valMin.toFixed(1)}°C | Mean ${valMean.toFixed(1)}°C | Max ${valMax.toFixed(1)}°C`;

                let innerCell = "";
                if (currentMetric === "min_max") {
                    innerCell = `
                        <span>${valMin.toFixed(0)}/${valMax.toFixed(0)}°</span>
                        <span class="matrix-square-total">${valMax >= 33.5 ? 'HEAT' : 'RANGE'}</span>
                    `;
                } else {
                    innerCell = `
                        <span>${val.toFixed(1)}°</span>
                        <span class="matrix-square-total">${currentMetric === 'temp_max' ? 'MAX' : (currentMetric === 'temp_min' ? 'MIN' : 'MEAN')}</span>
                    `;
                }

                rowHtml += `
                    <td>
                        <div class="matrix-square-cell" style="background-color: ${c.bg}; color: ${c.text};" title="${tip}">
                            ${innerCell}
                        </div>
                    </td>
                `;
            } else {
                rowHtml += `<td><div class="matrix-square-cell" style="background: #f8fafc; color: #cbd5e1;">-</div></td>`;
            }
        });

        const yAvg = yCount > 0 ? (ySum / yCount) : null;
        if (yAvg !== null) {
            const yc = getTempColor(yAvg, currentMetric);
            const displayYAvg = yAvg.toFixed(1) + "°";
            rowHtml += `
                <td>
                    <div class="matrix-square-cell" style="background-color: ${yc.bg}; color: ${yc.text}; border: 2px solid rgba(0,0,0,0.15);" title="${y} Annual Avg: ${displayYAvg}">
                        <span style="font-weight: 900;">${displayYAvg}</span>
                        <span class="matrix-square-total">Annual</span>
                    </div>
                </td>
            `;
        } else {
            rowHtml += `<td><div class="matrix-square-cell" style="background: #f8fafc; color: #cbd5e1;">-</div></td>`;
        }

        rowHtml += `</tr>`;
        tbody += rowHtml;
    });

    const grandDailyAvg = grandCount > 0 ? (grandSum / grandCount) : 0;

    // Baseline Normal Row
    let targetBase = baseline;
    if (currentMetric === "temp_max" && baseMaxDict[loc.id]) targetBase = baseMaxDict[loc.id];
    else if (currentMetric === "temp_min" && baseMinDict[loc.id]) targetBase = baseMinDict[loc.id];

    let baseCells = `<tr class="matrix-baseline-row"><td class="matrix-year-cell" style="color: #0284c7; font-weight: 800;">Normal</td>`;
    let baselineSum = 0;
    let baseCount = 0;

    activeMonths.forEach(m => {
        const bVal = targetBase[m];
        if (bVal !== undefined) {
            baselineSum += bVal;
            baseCount++;
            const bc = getTempColor(bVal, currentMetric);
            baseCells += `
                <td>
                    <div class="matrix-square-cell" style="background-color: ${bc.bg}; color: ${bc.text}; opacity: 0.9;" title="Historical Normal (2010-2025): ${bVal.toFixed(1)} °C">
                        <span style="font-weight: 700;">${bVal.toFixed(1)}°</span>
                        <span class="matrix-square-total">Normal</span>
                    </div>
                </td>
            `;
        } else {
            baseCells += `<td>-</td>`;
        }
    });

    const fullBaseAvg = baseCount > 0 ? (baselineSum / baseCount) : 0;
    const fbc = getTempColor(fullBaseAvg, currentMetric);
    baseCells += `
        <td>
            <div class="matrix-square-cell" style="background-color: ${fbc.bg}; color: ${fbc.text}; outline: 2px solid #0284c7; font-weight: 900;" title="Historical Normal Filtered Months: ${fullBaseAvg.toFixed(1)} °C">
                <span>${fullBaseAvg.toFixed(1)}°</span>
                <span class="matrix-square-total">Normal</span>
            </div>
        </td>
    </tr>`;

    tbody += baseCells + "</tbody>";
    return { thead, tbody, grandDailyAvg };
}

function buildCombinedMatrixTable(selectedLocs, yearsToShow, activeMonths, monthNames) {
    const tempDict = (currentData.monthly_temperature || currentData.monthly_temp) || {};
    let grandSum = 0;
    let grandCount = 0;

    yearsToShow.forEach(y => {
        activeMonths.forEach(m => {
            selectedLocs.forEach(loc => {
                const locM = tempDict[loc.id] || {};
                const mData = locM[y] && locM[y][m];
                if (mData) {
                    let val = mData.val;
                    if (currentMetric === "temp_max") val = mData.val_max !== undefined ? mData.val_max : val + 4.2;
                    else if (currentMetric === "temp_min") val = mData.val_min !== undefined ? mData.val_min : val - 4.2;
                    grandSum += val;
                    grandCount++;
                }
            });
        });
    });

    const grandDailyAvg = grandCount > 0 ? (grandSum / grandCount) : 0;

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
                const locM = tempDict[loc.id] || {};
                const mData = locM[y] && locM[y][m];
                if (mData) {
                    let val = mData.val;
                    if (currentMetric === "temp_max") val = mData.val_max !== undefined ? mData.val_max : val + 4.2;
                    else if (currentMetric === "temp_min") val = mData.val_min !== undefined ? mData.val_min : val - 4.2;
                    mSum += val;
                    mCount++;
                }
            });

            if (mCount > 0) {
                const avg = mSum / mCount;
                ySum += avg;
                yCount++;
                const c = getTempColor(avg, currentMetric);
                const displayVal = avg.toFixed(1) + "°";

                rowHtml += `
                    <td>
                        <div class="matrix-square-cell" style="background-color: ${c.bg}; color: ${c.text};" title="${monthNames[m-1]} ${y}: ${displayVal} (${selectedLocs.length} states combined)">
                            <span>${displayVal}</span>
                            <span class="matrix-square-total">${currentMetric === 'temp_max' ? 'MAX' : (currentMetric === 'temp_min' ? 'MIN' : 'MEAN')}</span>
                        </div>
                    </td>
                `;
            } else {
                rowHtml += `<td><div class="matrix-square-cell" style="background: #f8fafc; color: #cbd5e1;">-</div></td>`;
            }
        });

        const yAvg = yCount > 0 ? (ySum / yCount) : null;
        if (yAvg !== null) {
            const yc = getTempColor(yAvg, currentMetric);
            const displayYAvg = yAvg.toFixed(1) + "°";
            rowHtml += `
                <td>
                    <div class="matrix-square-cell" style="background-color: ${yc.bg}; color: ${yc.text}; border: 2px solid rgba(0,0,0,0.15);" title="${y} Combined Avg: ${displayYAvg}">
                        <span style="font-weight: 900;">${displayYAvg}</span>
                        <span class="matrix-square-total">Annual</span>
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
// 3. DRILLDOWN MODAL & CROP THERMAL PROFILE
// -------------------------------------------------------------
function openDrilldown(locId) {
    const loc = currentData.locations.find(l => l.id === locId);
    if (!loc) return;
    modalCurrentLoc = loc;

    document.getElementById("modal-title").innerText = `${loc.name} • Crop Thermal Stress Profile`;
    document.getElementById("modal-subtitle").innerText = `${loc.country} • Plantation Centroid (${loc.lat.toFixed(4)}°N, ${loc.lon.toFixed(4)}°E)`;
    document.getElementById("drilldown-modal").classList.add("active");
    updateDrilldownChart();
}

function closeModal() {
    document.getElementById("drilldown-modal").classList.remove("active");
    if (currentChart) {
        currentChart.destroy();
        currentChart = null;
    }
}

function updateDrilldownChart() {
    if (!modalCurrentLoc) return;
    const selYear = document.getElementById("modal-year-select").value;
    renderClimograph(modalCurrentLoc, selYear);
}

function renderClimograph(loc, selYear) {
    const canvas = document.getElementById("drilldown-chart");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (currentChart) currentChart.destroy();

    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const locMonthlyRain = (currentData.monthly_data && currentData.monthly_data[loc.id]) || {};
    const locMonthlyTemp = (currentData.monthly_temperature || currentData.monthly_temp || {})[loc.id] || {};

    const rainVals = [];
    const tempMeanVals = [];
    const tempMaxVals = [];
    const tempMinVals = [];

    let highestMax = -99;
    let lowestMin = 99;

    for (let m = 1; m <= 12; m++) {
        const rData = locMonthlyRain[selYear] && locMonthlyRain[selYear][m];
        rainVals.push(rData ? rData.avg_mm_day : null);

        const tData = locMonthlyTemp[selYear] && locMonthlyTemp[selYear][m];
        if (tData) {
            const vMean = tData.val;
            const vMax = tData.val_max !== undefined ? tData.val_max : (vMean + 4.2);
            const vMin = tData.val_min !== undefined ? tData.val_min : (vMean - 4.2);

            tempMeanVals.push(vMean);
            tempMaxVals.push(vMax);
            tempMinVals.push(vMin);

            if (vMax > highestMax) highestMax = vMax;
            if (vMin < lowestMin) lowestMin = vMin;
        } else {
            tempMeanVals.push(null);
            tempMaxVals.push(null);
            tempMinVals.push(null);
        }
    }

    currentChart = new Chart(ctx, {
        data: {
            labels: monthNames,
            datasets: [
                {
                    type: "bar",
                    label: `Precipitation ${selYear} (mm/day)`,
                    data: rainVals,
                    backgroundColor: "rgba(2, 132, 199, 0.4)",
                    borderColor: "#0284c7",
                    borderWidth: 1,
                    yAxisID: "yRain",
                    order: 5
                },
                {
                    type: "line",
                    label: `Day Max (Tmax) - Heat Stress`,
                    data: tempMaxVals,
                    borderColor: "#dc2626",
                    backgroundColor: "rgba(239, 68, 68, 0.15)",
                    borderWidth: 2.5,
                    pointRadius: 4,
                    pointBackgroundColor: "#dc2626",
                    fill: "+2", // fill down to Tmin for thermal envelope
                    tension: 0.2,
                    yAxisID: "yTemp",
                    order: 1
                },
                {
                    type: "line",
                    label: `Mean Temp (Tmean)`,
                    data: tempMeanVals,
                    borderColor: "#f59e0b",
                    backgroundColor: "transparent",
                    borderWidth: 2,
                    borderDash: [4, 4],
                    pointRadius: 3,
                    pointBackgroundColor: "#f59e0b",
                    fill: false,
                    tension: 0.2,
                    yAxisID: "yTemp",
                    order: 2
                },
                {
                    type: "line",
                    label: `Night Min (Tmin) - Respiration`,
                    data: tempMinVals,
                    borderColor: "#0284c7",
                    backgroundColor: "transparent",
                    borderWidth: 2.5,
                    pointRadius: 4,
                    pointBackgroundColor: "#0284c7",
                    fill: false,
                    tension: 0.2,
                    yAxisID: "yTemp",
                    order: 3
                },
                {
                    type: "line",
                    label: "Critical Heat Stress Limit (35°C)",
                    data: Array(12).fill(35.0),
                    borderColor: "rgba(153, 27, 27, 0.8)",
                    borderWidth: 1.5,
                    borderDash: [5, 5],
                    pointRadius: 0,
                    fill: false,
                    yAxisID: "yTemp",
                    order: 4
                },
                {
                    type: "line",
                    label: "VPD Stomatal Closure Risk (33°C)",
                    data: Array(12).fill(33.0),
                    borderColor: "rgba(234, 88, 12, 0.8)",
                    borderWidth: 1.5,
                    borderDash: [3, 3],
                    pointRadius: 0,
                    fill: false,
                    yAxisID: "yTemp",
                    order: 4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: "index", intersect: false },
            plugins: {
                legend: { position: "top", labels: { boxWidth: 12, font: { size: 10.5 } } },
                title: {
                    display: true,
                    text: `Crop Thermal Stress Profile: Tmax, Tmean, Tmin & Rainfall (${loc.name}, ${selYear})`
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
                    suggestedMax: 18,
                    title: { display: true, text: "Precipitation (mm/day)" },
                    grid: { color: "#f1f5f9" }
                },
                yTemp: {
                    type: "linear",
                    position: "right",
                    suggestedMin: 18,
                    suggestedMax: 38,
                    title: { display: true, text: "Temperature (°C)" },
                    grid: { drawOnChartArea: false }
                }
            }
        }
    });
}

function exportTableToCSV() {
    const table = document.getElementById("exportable-table");
    if (!table) return;
    let csv = [];
    for (let i = 0; i < table.rows.length; i++) {
        let row = [];
        for (let j = 0; j < table.rows[i].cells.length; j++) {
            let text = table.rows[i].cells[j].innerText.replace(/(\r\n|\n|\r)/gm, " ").trim();
            row.push(`"${text.replace(/"/g, '""')}"`);
        }
        csv.push(row.join(","));
    }
    const csvFile = new Blob([csv.join("\n")], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(csvFile);
    link.setAttribute("href", url);
    link.setAttribute("download", `temperature_${currentMetric}_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

if (document.readyState === "loading") {
    window.addEventListener("DOMContentLoaded", initDashboard);
} else {
    initDashboard();
}
