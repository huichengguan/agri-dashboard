// =============================================================
// SOIL MOISTURE DASHBOARD - ROOT-ZONE & SUBSOIL MONITOR (2010–PRESENT)
// Calibrated for SE Asian Tropical Ultisols, Inceptisols, Oxisols & Peat
// =============================================================

let currentData = null;
let currentSoilDepth = "rootzone"; // 'rootzone' (0–28 cm) or 'subsoil' (28–100 cm)
let currentMode = "monthly"; // 'monthly', 'state_matrix'
let currentGroup = "all";
let currentYear = 2026;
let selectedStateId = "MY-09"; // default Perlis
let currentChart = null;
let modalCurrentLoc = null;

// State Matrix multi-selection state
let matrixSelectedStates = [];
let matrixSelectedYears = [2027, 2026, 2025, 2024, 2023, 2022, 2021, 2020, 2019, 2018, 2017, 2016, 2015, 2014, 2013, 2012, 2011, 2010];
let matrixSelectedMonths = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
let multiStateViewMode = "combined"; // 'combined' or 'breakdown'
let matrixDensity = "compact"; // 'compact', 'dense', 'standard'
let isStatePickerCollapsed = false;

// -------------------------------------------------------------
// Active Soil Layer Metric Context
// -------------------------------------------------------------
function getSoilContext() {
    if (currentSoilDepth === "subsoil") {
        return {
            depthKey: "subsoil",
            title: "Subsoil Deep Root Zone (28–100 cm, L3)",
            shortTitle: "Subsoil (28–100 cm)",
            unit: "m³/m³",
            monthly: (currentData && currentData.monthly_subsoil) || {},
            baseline: (currentData && currentData.baseline_subsoil) || {}
        };
    } else {
        return {
            depthKey: "rootzone",
            title: "Upper Root Zone (0–28 cm, 25% L1 + 75% L2)",
            shortTitle: "Upper Root Zone (0–28 cm)",
            unit: "m³/m³",
            monthly: (currentData && (currentData.monthly_0_28cm || currentData.monthly_topsoil)) || {},
            baseline: (currentData && (currentData.baseline_0_28cm || currentData.baseline_topsoil)) || {}
        };
    }
}

// -------------------------------------------------------------
// 6-Tier SE Asia Oil Palm Soil Moisture Scale
// -------------------------------------------------------------
function getSoilColor(val) {
    if (val === null || val === undefined || isNaN(val)) {
        return { bg: "#f1f5f9", text: "#94a3b8", label: "No Data", badge: "No Data", fullLabel: "No Data" };
    }

    // Saturated / Water Surplus: Poor root aeration if prolonged (> 0.440)
    if (val >= 0.440) return { bg: "#104a29", text: "#ffffff", label: "Saturated", badge: "Saturated", fullLabel: "Saturated / Water Surplus (> 0.440 m³/m³)" };
    // Optimal / Well-Watered: Ideal available moisture for transpiration & bunch formation (0.360–0.440)
    if (val >= 0.360) return { bg: "#2d7a2f", text: "#ffffff", label: "Optimal", badge: "Optimal", fullLabel: "Optimal / Well-Watered (0.360–0.440 m³/m³)" };
    // Mild Deficit: Early watch, slight stomatal resistance during afternoon peak VPD (0.300–0.360)
    if (val >= 0.300) return { bg: "#fed7aa", text: "#7c2d12", label: "Mild Deficit", badge: "Mild<br>Deficit", fullLabel: "Mild Deficit / Watch (0.300–0.360 m³/m³)" };
    // Moderate Deficit: Meaningful moisture stress; stomatal closure, bunch abortion risk (0.240–0.300)
    if (val >= 0.240) return { bg: "#fb923c", text: "#ffffff", label: "Moderate Deficit", badge: "Moderate<br>Deficit", fullLabel: "Moderate Deficit (0.240–0.300 m³/m³)" };
    // Severe Drought Stress: Frond desiccation, spear leaf accumulation, prolonged yield collapse (0.170–0.240)
    if (val >= 0.170) return { bg: "#ef4444", text: "#ffffff", label: "Severe Stress", badge: "Severe<br>Stress", fullLabel: "Severe Drought Stress (0.170–0.240 m³/m³)" };
    // Extreme Wilting Point: Deep root zone exhaustion, critical cavitation risk (< 0.170)
    return { bg: "#991b1b", text: "#ffffff", label: "Extreme Wilting", badge: "Extreme<br>Wilting", fullLabel: "Extreme Wilting Point (< 0.170 m³/m³)" };
}

// -------------------------------------------------------------
// Initialization
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

        // Parse query params and hash
        const urlParams = new URLSearchParams(window.location.search);
        let depthParam = urlParams.get("depth");
        let stateParam = urlParams.get("state");
        let modeParam = urlParams.get("mode");
        let viewParam = urlParams.get("view");
        let densityParam = urlParams.get("density");
        let collapseParam = urlParams.get("collapse");

        if (window.location.hash) {
            const hashParts = window.location.hash.substring(1).split("&");
            hashParts.forEach(p => {
                const [k, v] = p.split("=");
                if (k === "depth" && v) depthParam = v;
                if (k === "state" && v) stateParam = v;
                if (k === "mode" && v) modeParam = v;
                if (k === "view" && v) viewParam = v;
                if (k === "density" && v) densityParam = v;
                if (k === "collapse" && v) collapseParam = v;
            });
        }

        if (depthParam && (depthParam === "subsoil" || depthParam === "rootzone" || depthParam === "topsoil")) {
            currentSoilDepth = (depthParam === "subsoil") ? "subsoil" : "rootzone";
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

        updateDepthUI();
        renderHeaderKPIs();
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
        console.error("Failed to load soil moisture data:", e);
        document.getElementById("table-container").innerHTML = `
            <div style="padding: 40px; text-align: center; color: #ef4444;">
                <h3>Failed to load soil moisture data</h3>
                <p>Please ensure data_cache.json is available.</p>
            </div>
        `;
    }
}

// -------------------------------------------------------------
// Soil Depth Toggle Handler
// -------------------------------------------------------------
function setSoilDepth(depth) {
    if (depth !== "rootzone" && depth !== "subsoil") return;
    currentSoilDepth = depth;
    updateDepthUI();
    renderHeaderKPIs();
    renderTable();

    // If modal is currently open, refresh chart for new depth
    if (modalCurrentLoc) {
        const selYear = parseInt(document.getElementById("modal-year-select")?.value || 2026);
        renderDrilldownChart(modalCurrentLoc, selYear);
    }
}

function updateDepthUI() {
    const btnRoot = document.getElementById("btn-depth-rootzone");
    const btnSub = document.getElementById("btn-depth-subsoil");
    if (btnRoot && btnSub) {
        btnRoot.classList.toggle("active", currentSoilDepth === "rootzone");
        btnSub.classList.toggle("active", currentSoilDepth === "subsoil");
    }

    const legendTitle = document.getElementById("legend-title");
    const descTag = document.getElementById("depth-desc-tag");
    if (legendTitle) {
        legendTitle.innerText = (currentSoilDepth === "subsoil")
            ? "Subsoil Deep Root Zone (28–100 cm, L3) Volumetric Moisture Scale (m³/m³):"
            : "Upper Root Zone (0–28 cm, 25% L1 + 75% L2) Volumetric Moisture Scale (m³/m³):";
    }
    if (descTag) {
        descTag.innerText = (currentSoilDepth === "subsoil")
            ? "Calibrated for Deep Taproot & Subsoil Hydraulic Buffer (28–100 cm, L3)"
            : "Calibrated for Feeder Root Zone (0–28 cm, 25% L1 0–7cm + 75% L2 7–28cm)";
    }
}

// -------------------------------------------------------------
// Header KPIs
// -------------------------------------------------------------
function renderHeaderKPIs() {
    if (!currentData || !currentData.locations) return;
    const ctx = getSoilContext();
    const soilDict = ctx.monthly;

    let allMoistures = [];
    let driest = { name: "-", val: 999, group: "" };
    let criticalDeficitCount = 0;
    let optimalCount = 0;

    currentData.locations.forEach(loc => {
        const y26 = soilDict[loc.id] && soilDict[loc.id]["2026"];
        if (y26) {
            const months = Object.keys(y26).map(Number).sort((a, b) => b - a);
            if (months.length > 0) {
                const latestM = months[0];
                const info = y26[latestM];
                const val = (info && info.val !== undefined) ? info.val : (typeof info === "number" ? info : null);
                if (val !== null) {
                    allMoistures.push(val);
                    if (val < 0.240) criticalDeficitCount++;
                    if (val >= 0.360 && val <= 0.440) optimalCount++;
                    if (val < driest.val) {
                        driest = { name: loc.name, val: val, group: loc.major_group };
                    }
                }
            }
        }
    });

    const meanM = allMoistures.length > 0 ? (allMoistures.reduce((a, b) => a + b, 0) / allMoistures.length) : 0;
    const kpiMeanEl = document.getElementById("kpi-soil-mean");
    const kpiMeanSub = document.getElementById("kpi-soil-mean-sub");
    if (kpiMeanEl) kpiMeanEl.innerText = `${meanM.toFixed(3)} m³/m³`;
    if (kpiMeanSub) kpiMeanSub.innerText = `Across 39 regions • ${currentSoilDepth === 'subsoil' ? '28–100 cm Subsoil' : '0–28 cm Root Zone'}`;

    const kpiDeficitEl = document.getElementById("kpi-deficit-val");
    if (kpiDeficitEl) kpiDeficitEl.innerText = `${criticalDeficitCount} States`;

    const kpiOptimalEl = document.getElementById("kpi-optimal-val");
    if (kpiOptimalEl) kpiOptimalEl.innerText = `${optimalCount} States`;

    const kpiDriestVal = document.getElementById("kpi-driest-val");
    const kpiDriestSub = document.getElementById("kpi-driest-sub");
    if (kpiDriestVal && driest.name !== "-") {
        kpiDriestVal.innerText = `${driest.name}`;
        if (kpiDriestSub) kpiDriestSub.innerText = `${driest.val.toFixed(3)} m³/m³ (${getSoilColor(driest.val).label}) • ${driest.group}`;
    }
}

// -------------------------------------------------------------
// Filters & View Controls
// -------------------------------------------------------------
function populateYearSelect() {
    const sel = document.getElementById("year-select");
    if (!sel) return;
    sel.innerHTML = "";

    // 2027 Q1 Forecast option
    const opt27 = document.createElement("option");
    opt27.value = 2027;
    opt27.innerText = "2027 (Q1 Forecast)";
    if (currentYear === 2027) opt27.selected = true;
    sel.appendChild(opt27);

    for (let y = 2026; y >= 2010; y--) {
        const opt = document.createElement("option");
        opt.value = y;
        opt.innerText = (y === 2026) ? "2026 (Includes Q4 Forecast)" : y;
        if (y === currentYear) opt.selected = true;
        sel.appendChild(opt);
    }
    sel.addEventListener("change", (e) => {
        currentYear = parseInt(e.target.value);
        renderTable();
    });
}

function setMode(mode) {
    currentMode = mode;
    document.querySelectorAll(".controls-bar .segmented-btn[data-mode]").forEach(b => {
        b.classList.toggle("active", b.dataset.mode === mode);
    });
    
    const yearSelect = document.getElementById("year-select-container");
    const regFilter = document.getElementById("region-filter-container");
    const matrixFilter = document.getElementById("matrix-filter-bar");
    
    if (yearSelect) yearSelect.style.display = (mode === "monthly") ? "flex" : "none";
    if (regFilter) regFilter.style.display = (mode === "state_matrix") ? "none" : "inline-flex";
    if (matrixFilter) matrixFilter.style.display = (mode === "state_matrix") ? "flex" : "none";
    
    if (mode === "state_matrix") {
        renderStatePills();
    }
    renderTable();
}

function setGroup(grp) {
    currentGroup = grp;
    document.querySelectorAll(".controls-bar .segmented-btn[data-group]").forEach(b => {
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
    } else if (currentMode === "state_matrix") {
        renderStateYearByMonthMatrix();
    }
}

// -------------------------------------------------------------
// 1. MONTHLY OVERVIEW TABLE
// -------------------------------------------------------------
function renderMonthlyTable(locations) {
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const ctx = getSoilContext();
    const soilDict = ctx.monthly;
    const baseDict = ctx.baseline;

    let thead = `
        <tr>
            <th>Country</th>
            <th>Region / Island</th>
            <th>State / Province</th>
    `;
    monthNames.forEach((m, idx) => {
        const monthNum = idx + 1;
        const isFcst = (currentYear === 2026 && monthNum >= 10) || (currentYear === 2027 && monthNum <= 3);
        const headerTitle = isFcst ? `ECMWF SEAS5 6-Month Seasonal Hydrologic Forecast` : `${m} Observed`;
        thead += `<th style="text-align:center;" title="${headerTitle}">${m}${isFcst ? ' 🔮' : ''}</th>`;
    });
    thead += `<th style="text-align:center;">Year Mean</th><th style="text-align:center;">Normal Baseline</th></tr>`;

    let tbody = "";
    locations.forEach(loc => {
        const lid = loc.id;
        const locMonthly = (soilDict[lid] && soilDict[lid][currentYear]) || {};
        const baseline = baseDict[lid] || {};

        let rowHtml = `
            <tr>
                <td><strong>${loc.country}</strong></td>
                <td><span class="group-badge">${loc.major_group}</span></td>
                <td class="col-state" onclick="viewStateInMatrix('${lid}')" title="Click to view full 2010-2027 Soil Moisture Matrix">${loc.name}</td>
        `;

        let yearSum = 0;
        let yearCount = 0;

        for (let m = 1; m <= 12; m++) {
            const mData = locMonthly[m];
            if (mData) {
                const avg = (mData.val !== undefined) ? mData.val : (typeof mData === "number" ? mData : null);
                if (avg !== null) {
                    yearSum += avg;
                    yearCount++;
                    const c = getSoilColor(avg);
                    const isFcst = (mData && mData.is_forecast) || (currentYear === 2026 && m >= 10) || (currentYear === 2027 && m <= 3);
                    const tip = isFcst 
                        ? `${monthNames[m-1]} ${currentYear} (ECMWF SEAS5 Forecast): ${avg.toFixed(3)} m³/m³ (${c.fullLabel})`
                        : `${monthNames[m-1]} ${currentYear}: ${avg.toFixed(3)} m³/m³ (${c.fullLabel})`;
                    const badgeClass = isFcst ? "rain-badge forecast-badge" : "rain-badge";
                    rowHtml += `
                        <td class="rain-cell">
                            <span class="${badgeClass}" style="background-color: ${c.bg}; color: ${c.text};" title="${tip}">
                                ${avg.toFixed(3)}
                            </span>
                        </td>
                    `;
                } else {
                    rowHtml += `<td class="rain-cell"><span style="color:#cbd5e1;">-</span></td>`;
                }
            } else {
                rowHtml += `<td class="rain-cell"><span style="color:#cbd5e1;">-</span></td>`;
            }
        }

        const yearAvg = yearCount > 0 ? (yearSum / yearCount) : null;
        if (yearAvg !== null) {
            const yc = getSoilColor(yearAvg);
            rowHtml += `
                <td class="rain-cell">
                    <span class="rain-badge" style="background-color: ${yc.bg}; color: ${yc.text}; font-weight:800;">
                        ${yearAvg.toFixed(3)}
                    </span>
                </td>
            `;
        } else {
            rowHtml += `<td class="rain-cell">-</td>`;
        }

        const baseVals = Object.values(baseline);
        const baseAvg = baseVals.length > 0 ? (baseVals.reduce((a, b) => a + b, 0) / baseVals.length) : null;
        if (baseAvg !== null) {
            const bc = getSoilColor(baseAvg);
            rowHtml += `
                <td class="rain-cell">
                    <span class="rain-badge" style="background-color: ${bc.bg}; color: ${bc.text}; opacity: 0.85;">
                        ${baseAvg.toFixed(3)}
                    </span>
                </td>
            `;
        } else {
            rowHtml += `<td class="rain-cell">-</td>`;
        }

        rowHtml += `</tr>`;
        tbody += rowHtml;
    });

    let forecastNotice = "";
    if (currentYear === 2026 || currentYear === 2027) {
        forecastNotice = `
            <div style="margin-bottom: 12px; padding: 8px 14px; background: #ecfdf5; border-left: 4px solid #10b981; border-radius: 4px; font-size: 12px; color: #065f46; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px;">
                <div>
                    <strong>Dashed Borders &amp; 🔮 FCST:</strong> ECMWF SEAS5 6-Month Seasonal Soil Moisture Forecast (Open-Meteo 51-Member Hydrologic Ensemble). Next 6 months: Oct, Nov, Dec 2026 and Jan, Feb, Mar 2027.
                </div>
            </div>
        `;
    }

    document.getElementById("table-container").innerHTML = `
        ${forecastNotice}
        <table class="rainfall-table" id="exportable-table">
            <thead>${thead}</thead>
            <tbody>${tbody}</tbody>
        </table>
    `;
}

// -------------------------------------------------------------
// 2. STATE MATRIX: YEAR BY MONTH (MULTI-STATE SUPPORT)
// -------------------------------------------------------------
function viewStateInMatrix(stateId) {
    matrixSelectedStates = [stateId];
    selectedStateId = stateId;
    setMode("state_matrix");
}

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
        { key: "Papua", label: "Papua" },
        { key: "South Thailand", label: "Thailand" },
        { key: "Mindanao (Copra)", label: "Philippines" }
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
        if (matrixSelectedStates.length === 1) return; // Keep at least 1
        matrixSelectedStates = matrixSelectedStates.filter(id => id !== locId);
    } else {
        matrixSelectedStates.push(locId);
    }
    selectedStateId = matrixSelectedStates[0];
    renderStatePills();
    renderTable();
}

function updateSelectedStateBadge() {
    const badge = document.getElementById("selected-state-count-badge");
    const multiOpt = document.getElementById("matrix-multi-state-options");
    const count = matrixSelectedStates.length;
    if (badge) {
        badge.innerText = count === 1 ? "1 State Selected" : `${count} States Selected`;
    }
    if (multiOpt) {
        multiOpt.style.display = count > 1 ? "flex" : "none";
    }
}

function selectRegionStates(regionName) {
    if (!currentData) return;
    const regionLocs = currentData.locations.filter(l => l.major_group === regionName);
    const regionIds = regionLocs.map(l => l.id);
    const allSelected = regionIds.every(id => matrixSelectedStates.includes(id));
    if (allSelected) {
        matrixSelectedStates = matrixSelectedStates.filter(id => !regionIds.includes(id));
        if (matrixSelectedStates.length === 0) {
            matrixSelectedStates = [regionIds[0]];
        }
    } else {
        regionIds.forEach(id => {
            if (!matrixSelectedStates.includes(id)) matrixSelectedStates.push(id);
        });
    }
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
    if (!currentData || !currentData.locations) return;
    matrixSelectedStates = [currentData.locations[0].id];
    selectedStateId = currentData.locations[0].id;
    renderStatePills();
    renderTable();
}

function setMultiStateView(viewMode) {
    multiStateViewMode = viewMode;
    const btnComb = document.getElementById("btn-view-combined");
    const btnBrk = document.getElementById("btn-view-breakdown");
    if (btnComb) btnComb.classList.toggle("active", viewMode === "combined");
    if (btnBrk) btnBrk.classList.toggle("active", viewMode === "breakdown");
    renderTable();
}

function toggleStatePicker() {
    const container = document.getElementById("matrix-state-pills-container");
    const btn = document.getElementById("toggle-state-picker-btn");
    if (!container || !btn) return;
    isStatePickerCollapsed = !isStatePickerCollapsed;
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

    for (let y = 2027; y >= 2010; y--) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = `year-toggle-pill ${matrixSelectedYears.includes(y) ? "active" : ""}`;
        btn.innerText = y;
        btn.title = (y === 2027) ? "2027 Q1 Seasonal Forecast" : (y === 2026) ? "2026 Includes Q4 Forecast" : `Click to toggle ${y}`;
        btn.onclick = () => toggleYear(y);
        container.appendChild(btn);
    }
}

function toggleYear(y) {
    if (matrixSelectedYears.includes(y)) {
        if (matrixSelectedYears.length === 1) return;
        matrixSelectedYears = matrixSelectedYears.filter(x => x !== y);
    } else {
        matrixSelectedYears.push(y);
        matrixSelectedYears.sort((a, b) => b - a);
    }
    updateYearPresetButtons();
    renderYearPills();
    renderTable();
}

function setYearPreset(preset) {
    if (preset === "all") {
        matrixSelectedYears = [];
        for (let y = 2027; y >= 2010; y--) matrixSelectedYears.push(y);
    } else if (preset === "last5") {
        matrixSelectedYears = [2027, 2026, 2025, 2024, 2023];
    } else if (preset === "last10") {
        matrixSelectedYears = [2027, 2026, 2025, 2024, 2023, 2022, 2021, 2020, 2019, 2018];
    } else if (preset === "elnino") {
        matrixSelectedYears = [2027, 2026, 2016, 2015];
    }
    updateYearPresetButtons();
    renderYearPills();
    renderTable();
}

function updateYearPresetButtons() {
    document.querySelectorAll("[data-ypreset]").forEach(btn => {
        const p = btn.dataset.ypreset;
        let isActive = false;
        if (p === "all" && matrixSelectedYears.length === 18) isActive = true;
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
        if (matrixSelectedMonths.length === 1) return;
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

// -------------------------------------------------------------
// Build State Matrix (Single and Multi-State)
// -------------------------------------------------------------
function renderStateYearByMonthMatrix() {
    if (!currentData || !currentData.locations) return;

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
    const ctx = getSoilContext();

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
        const { thead, tbody, grandSoilAvg } = buildMatrixTableForLocation(loc, yearsToShow, activeMonths, monthNames, ctx);

        let headerHtml = `
            <div class="state-matrix-header">
                <div class="state-matrix-title">
                    <h2>${loc.name} • ${ctx.title} • ${yearSpanText}</h2>
                    <p>${loc.country} • ${loc.major_group} • Showing: ${monthSpanText}</p>
                </div>
                <div style="display: flex; gap: 16px; align-items: center; flex-wrap: wrap;">
                    ${getDensitySelectorHtml()}
                    <div style="text-align: right;">
                        <div style="font-size: 10px; color: var(--text-secondary); text-transform: uppercase; font-weight: 700;">Filtered Root-Zone Mean</div>
                        <div style="font-size: 20px; font-weight: 800; color: var(--text-primary);">${grandSoilAvg.toFixed(3)} m³/m³</div>
                    </div>
                    <button class="btn btn-secondary" onclick="openDrilldown('${loc.id}')" style="background: #09444c; color: white;">
                        View Trajectory Chart &rarr;
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
    const { thead: combThead, tbody: combTbody, grandSoilAvg: combSoilAvg } = buildCombinedMatrixTable(selectedLocs, yearsToShow, activeMonths, monthNames, ctx);

    const stateNamesSummary = selectedLocs.length <= 5 
        ? selectedLocs.map(l => l.name).join(", ") 
        : `${selectedLocs.slice(0, 4).map(l => l.name).join(", ")} +${selectedLocs.length - 4} more`;

    let combHeaderHtml = `
        <div class="state-matrix-header">
            <div class="state-matrix-title">
                <h2>Combined Average (${selectedLocs.length} States) • ${ctx.title}</h2>
                <p><strong>Included:</strong> ${stateNamesSummary} • <strong>Years:</strong> ${yearSpanText} • <strong>Months:</strong> ${monthSpanText}</p>
            </div>
            <div style="display: flex; gap: 16px; align-items: center; flex-wrap: wrap;">
                ${getDensitySelectorHtml()}
                <div style="text-align: right;">
                    <div style="font-size: 10px; color: var(--text-secondary); text-transform: uppercase; font-weight: 700;">Combined Root-Zone Mean</div>
                    <div style="font-size: 20px; font-weight: 800; color: var(--text-primary);">${combSoilAvg.toFixed(3)} m³/m³</div>
                </div>
            </div>
        </div>
    `;

    let outputHtml = `
        ${combHeaderHtml}
        <div style="overflow-x: auto; margin-bottom: 24px;">
            <table class="matrix-table" id="exportable-table">
                ${combThead}
                ${combTbody}
            </table>
        </div>
    `;

    // If breakdown view is selected, render individual matrices below
    if (multiStateViewMode === "breakdown") {
        outputHtml += `
            <div style="margin-top: 30px; border-top: 2px dashed var(--border-color); padding-top: 20px;">
                <h3 style="font-size: 15px; font-weight: 800; color: var(--text-primary); margin-bottom: 16px;">
                    Individual State Breakdown (${selectedLocs.length} States) • ${ctx.shortTitle}
                </h3>
        `;

        selectedLocs.forEach(loc => {
            const { thead: sThead, tbody: sTbody, grandSoilAvg: sSoilAvg } = buildMatrixTableForLocation(loc, yearsToShow, activeMonths, monthNames, ctx);
            outputHtml += `
                <div style="margin-bottom: 24px; background: #fff; border: 1px solid var(--border-color); border-radius: 8px; padding: 14px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                        <div>
                            <strong style="font-size: 15px; color: var(--text-primary);">${loc.name}</strong>
                            <span style="font-size: 12px; color: var(--text-secondary); margin-left: 8px;">(${loc.major_group})</span>
                        </div>
                        <div style="display: flex; gap: 12px; align-items: center;">
                            <span style="font-size: 12px; font-weight: 700; color: var(--text-primary);">Mean: ${sSoilAvg.toFixed(3)} m³/m³</span>
                            <button class="btn btn-secondary" onclick="openDrilldown('${loc.id}')" style="background: #09444c; color: white; padding: 4px 10px; font-size: 12px;">
                                Trajectory &rarr;
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

function buildMatrixTableForLocation(loc, yearsToShow, activeMonths, monthNames, ctx) {
    const locMonthly = ctx.monthly[loc.id] || {};
    const baseline = ctx.baseline[loc.id] || {};

    let grandSum = 0;
    let grandCount = 0;
    yearsToShow.forEach(y => {
        if (locMonthly[y]) {
            activeMonths.forEach(m => {
                const info = locMonthly[y][m];
                const val = (info && info.val !== undefined) ? info.val : (typeof info === "number" ? info : null);
                if (val !== null) {
                    grandSum += val;
                    grandCount += 1;
                }
            });
        }
    });
    const grandSoilAvg = grandCount > 0 ? (grandSum / grandCount) : 0;

    let thead = `
        <thead>
            <tr>
                <th style="width: 80px; text-align: right; padding-right: 14px;">Year</th>
    `;
    activeMonths.forEach(m => {
        thead += `<th>${monthNames[m - 1]}</th>`;
    });
    thead += `<th style="text-align: center;">Filtered Mean</th></tr></thead>`;

    let tbody = "<tbody>";
    yearsToShow.forEach(y => {
        const yData = locMonthly[y] || {};
        let rowSum = 0;
        let rowCount = 0;

        let rowHtml = `
            <tr>
                <td class="matrix-year-cell">${y}</td>
        `;

        activeMonths.forEach(m => {
            const mInfo = yData[m];
            const avg = (mInfo && mInfo.val !== undefined) ? mInfo.val : (typeof mInfo === "number" ? mInfo : null);
            if (avg !== null) {
                rowSum += avg;
                rowCount += 1;
                const c = getSoilColor(avg);
                const displayVal = avg.toFixed(3);
                const isFcst = (mInfo && mInfo.is_forecast) || (y === 2026 && m >= 10) || (y === 2027 && m <= 3);
                const subLabel = isFcst ? "Forecast" : (c.badge || c.label || "m³/m³");
                const squareClass = isFcst ? "matrix-square-cell forecast-square" : "matrix-square-cell";
                const tooltip = isFcst
                    ? `${monthNames[m-1]} ${y} (ECMWF SEAS5 Forecast): ${avg.toFixed(3)} m³/m³ (${c.fullLabel})`
                    : `${monthNames[m-1]} ${y}: ${avg.toFixed(3)} m³/m³ (${c.fullLabel})`;

                rowHtml += `
                    <td>
                        <div class="${squareClass}" style="background-color: ${c.bg}; color: ${c.text};" title="${tooltip}">
                            <span style="font-size:10.5px; text-align: center !important; display: block; width: 100%;">${displayVal}</span>
                            <span class="matrix-square-total" style="text-align: center !important; width: 100% !important; display: block !important;">${subLabel}</span>
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

        const yAvg = rowCount > 0 ? (rowSum / rowCount) : null;
        if (yAvg !== null) {
            const yc = getSoilColor(yAvg);
            const displayYAvg = yAvg.toFixed(3);
            const subYLabel = yc.badge || yc.label || "Year Mean";
            rowHtml += `
                <td>
                    <div class="matrix-square-cell" style="background-color: ${yc.bg}; color: ${yc.text}; border: 2px solid rgba(0,0,0,0.15);" title="Selected Months ${y}: ${displayYAvg} m³/m³">
                        <span style="font-weight: 900; font-size:10.5px; text-align: center !important; display: block; width: 100%;">${displayYAvg}</span>
                        <span class="matrix-square-total" style="text-align: center !important; width: 100% !important; display: block !important;">${subYLabel}</span>
                    </div>
                </td>
            `;
        } else {
            rowHtml += `<td><div class="matrix-square-cell" style="background: #f8fafc; color: #cbd5e1;">-</div></td>`;
        }

        rowHtml += `</tr>`;
        tbody += rowHtml;
    });

    // Baseline Normal Row
    let baseCells = `<tr class="matrix-baseline-row">
        <td class="matrix-year-cell" style="background: #0284c7; color: white; font-weight: 800;">Normal</td>`;
    let baseSum = 0;
    let baseCount = 0;
    activeMonths.forEach(m => {
        const bVal = baseline[m];
        if (bVal !== undefined && bVal !== null) {
            baseSum += bVal;
            baseCount += 1;
            const bc = getSoilColor(bVal);
            const subLabel = bc.badge || bc.label || "Normal";
            baseCells += `
                <td>
                    <div class="matrix-square-cell" style="background-color: ${bc.bg}; color: ${bc.text}; opacity: 0.9;" title="Climatological Normal ${monthNames[m-1]}: ${bVal.toFixed(3)} m³/m³">
                        <span style="font-size:10.5px; text-align: center !important; display: block; width: 100%;">${bVal.toFixed(3)}</span>
                        <span class="matrix-square-total" style="text-align: center !important; width: 100% !important; display: block !important;">${subLabel}</span>
                    </div>
                </td>
            `;
        } else {
            baseCells += `<td><div class="matrix-square-cell" style="background: #f8fafc; color: #cbd5e1;">-</div></td>`;
        }
    });

    const grandBaseAvg = baseCount > 0 ? (baseSum / baseCount) : null;
    if (grandBaseAvg !== null) {
        const gbc = getSoilColor(grandBaseAvg);
        const subGLabel = gbc.badge || gbc.label || "Normal";
        baseCells += `
            <td>
                <div class="matrix-square-cell" style="background-color: ${gbc.bg}; color: ${gbc.text}; border: 2px solid #0284c7;" title="Selected Months Baseline: ${grandBaseAvg.toFixed(3)} m³/m³">
                    <span style="font-weight: 900; font-size:10.5px; text-align: center !important; display: block; width: 100%;">${grandBaseAvg.toFixed(3)}</span>
                    <span class="matrix-square-total" style="text-align: center !important; width: 100% !important; display: block !important;">${subGLabel}</span>
                </div>
            </td>
        `;
    } else {
        baseCells += `<td><div class="matrix-square-cell" style="background: #f8fafc; color: #cbd5e1;">-</div></td>`;
    }
    baseCells += `</tr>`;

    tbody += baseCells + "</tbody>";
    return { thead, tbody, grandSoilAvg };
}

function buildCombinedMatrixTable(selectedLocs, yearsToShow, activeMonths, monthNames, ctx) {
    let thead = `
        <thead>
            <tr>
                <th style="width: 80px; text-align: right; padding-right: 14px;">Year</th>
    `;
    activeMonths.forEach(m => {
        thead += `<th>${monthNames[m - 1]}</th>`;
    });
    thead += `<th style="text-align: center;">Filtered Mean</th></tr></thead>`;

    let grandSum = 0;
    let grandCount = 0;

    let tbody = "<tbody>";
    yearsToShow.forEach(y => {
        let rowHtml = `
            <tr>
                <td class="matrix-year-cell">${y}</td>
        `;

        let rowMonthlyAvgs = [];

        activeMonths.forEach(m => {
            let mSum = 0;
            let mCount = 0;

            selectedLocs.forEach(loc => {
                const locData = ctx.monthly[loc.id] && ctx.monthly[loc.id][y];
                if (locData && locData[m]) {
                    const val = (locData[m].val !== undefined) ? locData[m].val : (typeof locData[m] === "number" ? locData[m] : null);
                    if (val !== null) {
                        mSum += val;
                        mCount += 1;
                    }
                }
            });

            if (mCount > 0) {
                const combAvg = mSum / mCount;
                rowMonthlyAvgs.push(combAvg);
                grandSum += combAvg;
                grandCount += 1;

                const c = getSoilColor(combAvg);
                const displayVal = combAvg.toFixed(3);
                const isFcst = (y === 2026 && m >= 10) || (y === 2027 && m <= 3);
                const subLabel = isFcst ? "Forecast" : (c.badge || c.label || "m³/m³");
                const squareClass = isFcst ? "matrix-square-cell forecast-square" : "matrix-square-cell";
                const tooltip = isFcst
                    ? `${monthNames[m-1]} ${y} (ECMWF SEAS5 Forecast): Combined Mean ${displayVal} m³/m³ across ${mCount} states (${c.fullLabel})`
                    : `${monthNames[m-1]} ${y}: Combined Mean ${displayVal} m³/m³ across ${mCount} states (${c.fullLabel})`;

                rowHtml += `
                    <td>
                        <div class="${squareClass}" style="background-color: ${c.bg}; color: ${c.text};" title="${tooltip}">
                            <span style="font-size:10.5px; text-align: center !important; display: block; width: 100%;">${displayVal}</span>
                            <span class="matrix-square-total" style="text-align: center !important; width: 100% !important; display: block !important;">${subLabel}</span>
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

        const yAvg = rowMonthlyAvgs.length > 0 ? (rowMonthlyAvgs.reduce((a, b) => a + b, 0) / rowMonthlyAvgs.length) : null;
        if (yAvg !== null) {
            const yc = getSoilColor(yAvg);
            const displayYAvg = yAvg.toFixed(3);
            const subYLabel = yc.badge || yc.label || "Year Mean";
            rowHtml += `
                <td>
                    <div class="matrix-square-cell" style="background-color: ${yc.bg}; color: ${yc.text}; border: 2px solid rgba(0,0,0,0.15);" title="Selected Months ${y}: Combined Mean ${displayYAvg} m³/m³">
                        <span style="font-weight: 900; font-size:10.5px; text-align: center !important; display: block; width: 100%;">${displayYAvg}</span>
                        <span class="matrix-square-total" style="text-align: center !important; width: 100% !important; display: block !important;">${subYLabel}</span>
                    </div>
                </td>
            `;
        } else {
            rowHtml += `<td><div class="matrix-square-cell" style="background: #f8fafc; color: #cbd5e1;">-</div></td>`;
        }

        rowHtml += `</tr>`;
        tbody += rowHtml;
    });

    // Baseline Normal Row for Combined Selection
    let baseCells = `<tr class="matrix-baseline-row">
        <td class="matrix-year-cell" style="background: #0284c7; color: white; font-weight: 800;">Normal</td>`;
    let baseMonthlyAvgs = [];

    activeMonths.forEach(m => {
        let bSum = 0;
        let bCount = 0;

        selectedLocs.forEach(loc => {
            const bDict = ctx.baseline[loc.id] || {};
            if (bDict[m] !== undefined && bDict[m] !== null) {
                bSum += bDict[m];
                bCount += 1;
            }
        });

        if (bCount > 0) {
            const combBaseAvg = bSum / bCount;
            baseMonthlyAvgs.push(combBaseAvg);
            const bc = getSoilColor(combBaseAvg);
            const subLabel = bc.badge || bc.label || "Normal";
            baseCells += `
                <td>
                    <div class="matrix-square-cell" style="background-color: ${bc.bg}; color: ${bc.text}; opacity: 0.9;" title="Climatological Normal ${monthNames[m-1]}: Combined ${combBaseAvg.toFixed(3)} m³/m³">
                        <span style="font-size:10.5px; text-align: center !important; display: block; width: 100%;">${combBaseAvg.toFixed(3)}</span>
                        <span class="matrix-square-total" style="text-align: center !important; width: 100% !important; display: block !important;">${subLabel}</span>
                    </div>
                </td>
            `;
        } else {
            baseCells += `<td><div class="matrix-square-cell" style="background: #f8fafc; color: #cbd5e1;">-</div></td>`;
        }
    });

    const grandBaseAvg = baseMonthlyAvgs.length > 0 ? (baseMonthlyAvgs.reduce((a, b) => a + b, 0) / baseMonthlyAvgs.length) : null;
    if (grandBaseAvg !== null) {
        const gbc = getSoilColor(grandBaseAvg);
        const subGLabel = gbc.badge || gbc.label || "Normal";
        baseCells += `
            <td>
                <div class="matrix-square-cell" style="background-color: ${gbc.bg}; color: ${gbc.text}; border: 2px solid #0284c7;" title="Selected Months Normal: ${grandBaseAvg.toFixed(3)} m³/m³">
                    <span style="font-weight: 900; font-size:10.5px; text-align: center !important; display: block; width: 100%;">${grandBaseAvg.toFixed(3)}</span>
                    <span class="matrix-square-total" style="text-align: center !important; width: 100% !important; display: block !important;">${subGLabel}</span>
                </div>
            </td>
        `;
    } else {
        baseCells += `<td><div class="matrix-square-cell" style="background: #f8fafc; color: #cbd5e1;">-</div></td>`;
    }
    baseCells += `</tr>`;

    tbody += baseCells + "</tbody>";
    const grandSoilAvg = grandCount > 0 ? (grandSum / grandCount) : 0;
    return { thead, tbody, grandSoilAvg };
}

// -------------------------------------------------------------
// 3. DRILLDOWN HISTORICAL MODAL & TRAJECTORY CHART
// -------------------------------------------------------------
function openDrilldown(locId) {
    if (!currentData) return;
    const loc = currentData.locations.find(l => l.id === locId);
    if (!loc) return;

    modalCurrentLoc = loc;
    const modal = document.getElementById("drilldown-modal");
    if (!modal) return;

    const ctx = getSoilContext();
    document.getElementById("modal-title").innerText = `${loc.name} • Soil Moisture Trajectory`;
    document.getElementById("modal-subtitle").innerText = `${loc.country} • ${loc.major_group} • ${ctx.title}`;

    let yearSelectHtml = `
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; flex-wrap: wrap; gap: 10px;">
            <div style="display: flex; align-items: center; gap: 8px;">
                <label for="modal-year-select" style="font-size: 12px; font-weight: 700; color: var(--text-secondary);">Primary Year:</label>
                <select id="modal-year-select" class="select-control" style="padding: 4px 8px; font-size: 12px;">
    `;
    for (let y = 2026; y >= 2010; y--) {
        yearSelectHtml += `<option value="${y}" ${y === 2026 ? "selected" : ""}>${y}</option>`;
    }
    yearSelectHtml += `
                </select>
            </div>
            <div style="font-size: 11.5px; color: var(--text-secondary);">
                Compares selected year vs 2015/2016 Super El Niño and the 30-Year Normal Baseline.
            </div>
        </div>
    `;

    const existingSelect = document.getElementById("modal-year-select-container");
    if (!existingSelect) {
        const selectDiv = document.createElement("div");
        selectDiv.id = "modal-year-select-container";
        selectDiv.innerHTML = yearSelectHtml;
        const chartBox = document.querySelector(".chart-box");
        chartBox.parentNode.insertBefore(selectDiv, chartBox);

        document.getElementById("modal-year-select").addEventListener("change", (e) => {
            if (modalCurrentLoc) {
                renderDrilldownChart(modalCurrentLoc, parseInt(e.target.value));
            }
        });
    } else {
        const yearSel = document.getElementById("modal-year-select");
        if (yearSel) yearSel.value = "2026";
    }

    renderDrilldownChart(loc, 2026);
    modal.classList.add("active");
}

function closeModal() {
    const modal = document.getElementById("drilldown-modal");
    if (modal) modal.classList.remove("active");
    modalCurrentLoc = null;
    if (currentChart) {
        currentChart.destroy();
        currentChart = null;
    }
}

function renderDrilldownChart(loc, selYear) {
    const chartCanvas = document.getElementById("drilldown-chart");
    if (!chartCanvas) return;
    const chartCtx = chartCanvas.getContext("2d");
    if (currentChart) currentChart.destroy();

    const monthLabels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const ctx = getSoilContext();
    const locMonthly = ctx.monthly[loc.id] || {};
    const baseline = ctx.baseline[loc.id] || {};

    const selYearVals = [];
    const y2025Vals = [];
    const y2016Vals = [];
    const y2015Vals = [];
    const baseVals = [];

    for (let m = 1; m <= 12; m++) {
        // Selected Year
        const dSel = locMonthly[selYear] && locMonthly[selYear][m];
        selYearVals.push(dSel ? ((dSel.val !== undefined) ? dSel.val : dSel) : null);

        // 2025 Prior Year
        const d25 = locMonthly[2025] && locMonthly[2025][m];
        y2025Vals.push(d25 ? ((d25.val !== undefined) ? d25.val : d25) : null);

        // 2016 Super El Niño
        const d16 = locMonthly[2016] && locMonthly[2016][m];
        y2016Vals.push(d16 ? ((d16.val !== undefined) ? d16.val : d16) : null);

        // 2015 Super El Niño onset
        const d15 = locMonthly[2015] && locMonthly[2015][m];
        y2015Vals.push(d15 ? ((d15.val !== undefined) ? d15.val : d15) : null);

        // Climatological Normal
        baseVals.push(baseline[m] !== undefined ? baseline[m] : null);
    }

    currentChart = new Chart(chartCtx, {
        type: "line",
        data: {
            labels: monthLabels,
            datasets: [
                {
                    label: `${selYear} (Active Selection)`,
                    data: selYearVals,
                    borderColor: "#0284c7",
                    backgroundColor: "#0284c7",
                    borderWidth: 3.5,
                    pointRadius: 5,
                    pointHoverRadius: 7,
                    tension: 0.25,
                    fill: false
                },
                {
                    label: "2025 (Prior Year)",
                    data: y2025Vals,
                    borderColor: "#10b981",
                    backgroundColor: "#10b981",
                    borderWidth: 2,
                    pointRadius: 3,
                    tension: 0.25,
                    fill: false
                },
                {
                    label: "2016 (Super El Niño)",
                    data: y2016Vals,
                    borderColor: "#ef4444",
                    backgroundColor: "#ef4444",
                    borderWidth: 2,
                    borderDash: [5, 4],
                    pointRadius: 3,
                    tension: 0.25,
                    fill: false
                },
                {
                    label: "2015 (El Niño Onset)",
                    data: y2015Vals,
                    borderColor: "#f97316",
                    backgroundColor: "#f97316",
                    borderWidth: 1.5,
                    borderDash: [3, 3],
                    pointRadius: 2,
                    tension: 0.25,
                    fill: false
                },
                {
                    label: "Climatological Normal Baseline",
                    data: baseVals,
                    borderColor: "#64748b",
                    backgroundColor: "#64748b",
                    borderWidth: 2.5,
                    borderDash: [6, 4],
                    pointRadius: 3,
                    tension: 0.25,
                    fill: false
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
                    text: `${loc.name} • ${ctx.title} (m³/m³)`
                },
                tooltip: {
                    callbacks: {
                        label: function(c) {
                            if (c.raw === null || c.raw === undefined) return `${c.dataset.label}: N/A`;
                            const sc = getSoilColor(c.raw);
                            return `${c.dataset.label}: ${c.raw.toFixed(3)} m³/m³ (${sc.label})`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    type: "linear",
                    suggestedMin: 0.15,
                    suggestedMax: 0.48,
                    title: { display: true, text: "Volumetric Soil Moisture (m³/m³)" },
                    grid: { color: "#f1f5f9" }
                },
                x: {
                    grid: { color: "#f8fafc" }
                }
            }
        }
    });
}

// -------------------------------------------------------------
// CSV Export
// -------------------------------------------------------------
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
    link.setAttribute("download", `soil_moisture_${currentSoilDepth}_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

// -------------------------------------------------------------
// DOM Ready
// -------------------------------------------------------------
if (document.readyState === "loading") {
    window.addEventListener("DOMContentLoaded", initDashboard);
} else {
    initDashboard();
}
