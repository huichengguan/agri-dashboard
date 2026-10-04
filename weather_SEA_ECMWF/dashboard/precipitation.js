// =============================================================
// PRECIPITATION DASHBOARD - ECMWF ERA5 & DAILY OPERATIONAL (2010–PRESENT)
// =============================================================

let currentData = null;
let currentMode = "monthly"; // 'monthly', 'daily', 'state_matrix', 'forecast_6mo'
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
let currentDailySubView = "all"; // 'all' (28 days: 14D Obs + 14D Fcst), 'obs' (past 14 days), 'fcst' (next 14 days)

function setDailySubView(subView) {
    currentDailySubView = subView;
    if (currentMode === "daily") {
        renderTable();
    }
}

function formatShortDate(dStr) {
    if (!dStr) return "";
    const parts = dStr.split("-");
    if (parts.length < 3) return dStr;
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const mIdx = parseInt(parts[1], 10) - 1;
    const dNum = parseInt(parts[2], 10);
    return `${dNum} ${months[mIdx] || parts[1]}`;
}

// 10-Tier Rainfall Scale (< 1.0 Extreme Dry to > 20.0 Extreme Wet)
function getRainColor(val) {
    if (val === null || val === undefined || isNaN(val)) return { bg: "#f1f5f9", text: "#94a3b8", label: "No Data" };
    if (val < 1.0) return { bg: "#991b1b", text: "#ffffff", label: "< 1.0 Extreme Dry" };
    if (val < 2.5) return { bg: "#ef4444", text: "#ffffff", label: "1.0 - 2.5" };
    if (val < 4.0) return { bg: "#fb923c", text: "#ffffff", label: "2.5 - 4.0" };
    if (val < 5.5) return { bg: "#fed7aa", text: "#7c2d12", label: "4.0 - 5.5" };
    if (val <= 6.5) return { bg: "#e2e8f0", text: "#1e293b", label: "5.5 - 6.5 Neutral" };
    if (val < 8.0) return { bg: "#bbf7d0", text: "#14532d", label: "6.5 - 8.0" };
    if (val < 11.0) return { bg: "#86efac", text: "#14532d", label: "8.0 - 11.0" };
    if (val < 15.0) return { bg: "#4ade80", text: "#14532d", label: "11.0 - 15.0" };
    if (val < 20.0) return { bg: "#16a34a", text: "#ffffff", label: "15.0 - 20.0" };
    return { bg: "#14532d", text: "#ffffff", label: "> 20.0 Extreme Wet" };
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
            selectedStateId = currentData.locations[0].id;
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

        if (window.location.hash) {
            const hashParts = window.location.hash.substring(1).split("&");
            hashParts.forEach(p => {
                const [k, v] = p.split("=");
                if (k === "state" && v) stateParam = v;
                if (k === "mode" && v) modeParam = v;
                if (k === "view" && v) viewParam = v;
                if (k === "density" && v) densityParam = v;
                if (k === "collapse" && v) collapseParam = v;
            });
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
        let dailyViewParam = urlParams.get("daily_view") || urlParams.get("daily_subview");
        if (dailyViewParam && ["all", "obs", "fcst"].includes(dailyViewParam)) {
            currentDailySubView = dailyViewParam;
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

        let modalParam = urlParams.get("modal") || (window.location.hash.includes("modal=") ? window.location.hash.split("modal=")[1].split("&")[0] : null);
        if (modalParam) setTimeout(() => openDrilldown(modalParam), 300);

        if (modeParam && ["monthly", "daily", "state_matrix", "forecast_6mo"].includes(modeParam)) {
            setMode(modeParam);
        } else {
            renderTable();
        }
    } catch (e) {
        console.error("Failed to load rainfall data:", e);
        document.getElementById("table-container").innerHTML = `
            <div style="padding: 40px; text-align: center; color: #ef4444;">
                <h3>Failed to load precipitation data</h3>
                <p>Please ensure data_cache.json is available.</p>
            </div>
        `;
    }
}

function renderHeaderKPIs() {
    if (!currentData || !currentData.kpis) return;
    const k = currentData.kpis;
    document.getElementById("kpi-date").innerText = `Latest Day: ${k.latest_date}`;
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
    if (!sel) return;
    sel.innerHTML = "";
    
    // 2027 Q1 Forecast
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

function populateStateSelect() {
    const sel = document.getElementById("state-select");
    if (!sel || !currentData) return;
    sel.innerHTML = "";
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
    document.querySelectorAll(".controls-bar .segmented-btn[data-mode]").forEach(b => {
        b.classList.toggle("active", b.dataset.mode === mode);
    });
    
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
    } else if (currentMode === "forecast_6mo") {
        render6MonthForecastTable(locations);
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
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    let thead = `
        <tr>
            <th>Country</th>
            <th>Region / Island</th>
            <th>State / Province</th>
    `;
    monthNames.forEach((m, idx) => {
        const monthNum = idx + 1;
        const isFcst = (currentYear === 2026 && monthNum >= 10) || (currentYear === 2027 && monthNum <= 3);
        const headerTitle = isFcst ? `ECMWF SEAS5 6-Month Seasonal Forecast` : `${m} Observed`;
        const headerLabel = isFcst ? `${m}<span class="fcst-tag" title="${headerTitle}">FCST</span>` : m;
        thead += `<th style="text-align:center;">${headerLabel}</th>`;
    });
    thead += `<th style="text-align:center;">${currentYear === 2026 ? 'Projected Yr Avg' : 'Year Avg'}</th><th style="text-align:center;">Baseline</th></tr>`;

    let tbody = "";
    locations.forEach(loc => {
        const lid = loc.id;
        const locMonthly = (currentData.monthly_data && currentData.monthly_data[lid] && currentData.monthly_data[lid][currentYear]) || {};
        const baseline = (currentData.baseline_monthly && currentData.baseline_monthly[lid]) || {};

        let rowHtml = `
            <tr>
                <td><strong>${loc.country}</strong></td>
                <td><span class="group-badge">${loc.major_group}</span></td>
                <td class="col-state" onclick="viewStateInMatrix('${lid}')" title="Click to view full 2010-2026 Year x Month Matrix">${loc.name}</td>
        `;

        let yearSum = 0;
        let yearDays = 0;

        for (let m = 1; m <= 12; m++) {
            const mData = locMonthly[m];
            if (mData) {
                const avg = mData.avg_mm_day;
                yearSum += mData.total_mm;
                yearDays += mData.days;
                const c = getRainColor(avg);
                const isFcst = mData.is_forecast || (currentYear === 2026 && m >= 10) || (currentYear === 2027 && m <= 3);
                const tip = isFcst 
                    ? `${monthNames[m-1]} ${currentYear} (ECMWF SEAS5 Forecast): ${avg.toFixed(1)} mm/day (${Math.round(mData.total_mm)}mm in ${mData.days} days)`
                    : `${monthNames[m-1]} ${currentYear}: ${avg.toFixed(1)} mm/day (${Math.round(mData.total_mm)}mm in ${mData.days} days)`;
                const badgeClass = isFcst ? "rain-badge forecast-badge" : "rain-badge";
                rowHtml += `
                    <td class="rain-cell">
                        <span class="${badgeClass}" style="background-color: ${c.bg}; color: ${c.text};" title="${tip}">
                            ${avg.toFixed(1)}
                        </span>
                    </td>
                `;
            } else {
                rowHtml += `<td class="rain-cell"><span style="color:#cbd5e1;">-</span></td>`;
            }
        }

        const yearAvg = yearDays > 0 ? (yearSum / yearDays) : null;
        if (yearAvg !== null) {
            const yc = getRainColor(yearAvg);
            rowHtml += `
                <td class="rain-cell">
                    <span class="rain-badge" style="background-color: ${yc.bg}; color: ${yc.text}; font-weight:800;">
                        ${yearAvg.toFixed(1)}
                    </span>
                </td>
            `;
        } else {
            rowHtml += `<td class="rain-cell">-</td>`;
        }

        const baseVals = Object.values(baseline);
        const baseAvg = baseVals.length > 0 ? (baseVals.reduce((a, b) => a + b, 0) / baseVals.length) : null;
        if (baseAvg !== null) {
            const bc = getRainColor(baseAvg);
            rowHtml += `
                <td class="rain-cell">
                    <span class="rain-badge" style="background-color: ${bc.bg}; color: ${bc.text}; opacity: 0.85;">
                        ${baseAvg.toFixed(1)}
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
            <div style="margin-top: 10px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; font-size: 11.5px; color: var(--text-secondary); background: #f8fafc; padding: 8px 12px; border-radius: 6px; border: 1px solid var(--border-color);">
                <div>
                    <span style="display: inline-block; width: 12px; height: 12px; border: 1.5px dashed #0284c7; background: #e0f2fe; vertical-align: middle; margin-right: 5px; border-radius: 2px;"></span>
                    <strong>Dashed Borders &amp; FCST:</strong> ECMWF SEAS5 6-Month Seasonal Forecast (Open-Meteo). Next 6 months filled in: Oct, Nov, Dec 2026 and Jan, Feb, Mar 2027.
                </div>
                <button class="pill-btn" onclick="setMode('forecast_6mo')" style="font-weight: 700; background: #09444c; color: #fff; padding: 4px 12px;">
                    View Continuous 6-Month Forecast Table &rarr;
                </button>
            </div>
        `;
    }

    document.getElementById("table-container").innerHTML = `
        <table class="rainfall-table" id="exportable-table">
            <thead>${thead}</thead>
            <tbody>${tbody}</tbody>
        </table>
        ${forecastNotice}
    `;
}

// -------------------------------------------------------------
// 1B. DEDICATED 6-MONTH SEASONAL FORECAST TABLE (OCT '26 – MAR '27)
// -------------------------------------------------------------
function render6MonthForecastTable(locations) {
    const fcMeta = (currentData.forecast_6month && currentData.forecast_6month.months) || [
        { key: "2026-10", name: "Oct 2026", month: 10 },
        { key: "2026-11", name: "Nov 2026", month: 11 },
        { key: "2026-12", name: "Dec 2026", month: 12 },
        { key: "2027-01", name: "Jan 2027", month: 1 },
        { key: "2027-02", name: "Feb 2027", month: 2 },
        { key: "2027-03", name: "Mar 2027", month: 3 }
    ];

    let thead = `
        <tr>
            <th>Country</th>
            <th>Region / Island</th>
            <th>State / Province</th>
    `;
    fcMeta.forEach(fm => {
        thead += `<th style="text-align:center;">${fm.name}<span class="fcst-tag">FCST</span></th>`;
    });
    thead += `
            <th style="text-align:center;">6-Mo Mean</th>
            <th style="text-align:center;">6-Mo Baseline</th>
            <th style="text-align:center;">Anomaly</th>
            <th style="text-align:center;">Total Rain</th>
        </tr>
    `;

    let tbody = "";
    locations.forEach(loc => {
        const lid = loc.id;
        const locFc = (currentData.forecast_6month && currentData.forecast_6month.data && currentData.forecast_6month.data[lid]) || {};
        const baseline = (currentData.baseline_monthly && currentData.baseline_monthly[lid]) || {};

        let rowHtml = `
            <tr>
                <td><strong>${loc.country}</strong></td>
                <td><span class="group-badge">${loc.major_group}</span></td>
                <td class="col-state" onclick="viewStateInMatrix('${lid}')" title="Click to view full 2010-2026 Matrix">${loc.name}</td>
        `;

        let sumAvg = 0;
        let sumBase = 0;
        let count = 0;
        let totalRain = 0;

        fcMeta.forEach(fm => {
            const mInfo = locFc[fm.key];
            if (mInfo) {
                const avg = mInfo.avg_mm_day;
                sumAvg += avg;
                sumBase += (mInfo.baseline_mm_day || 0);
                totalRain += (mInfo.total_mm || 0);
                count++;
                const c = getRainColor(avg);
                const tip = `${fm.name}: ${avg.toFixed(1)} mm/day (${Math.round(mInfo.total_mm)} mm) • Normal: ${mInfo.baseline_mm_day} mm/d (Diff: ${mInfo.rain_anomaly_mm_day > 0 ? '+' : ''}${mInfo.rain_anomaly_mm_day} mm/d)`;
                rowHtml += `
                    <td class="rain-cell">
                        <span class="rain-badge forecast-badge" style="background-color: ${c.bg}; color: ${c.text};" title="${tip}">
                            ${avg.toFixed(1)}
                        </span>
                    </td>
                `;
            } else {
                rowHtml += `<td class="rain-cell"><span style="color:#cbd5e1;">-</span></td>`;
            }
        });

        const mean6Mo = count > 0 ? (sumAvg / count) : 0;
        const base6Mo = count > 0 ? (sumBase / count) : 0;
        const diff = mean6Mo - base6Mo;

        const meanC = getRainColor(mean6Mo);
        const baseC = getRainColor(base6Mo);

        let anomalyHtml = "";
        if (diff > 0.5) {
            anomalyHtml = `<span class="anomaly-pill anomaly-surplus">+${diff.toFixed(1)} mm/d</span>`;
        } else if (diff < -0.5) {
            anomalyHtml = `<span class="anomaly-pill anomaly-deficit">${diff.toFixed(1)} mm/d</span>`;
        } else {
            anomalyHtml = `<span class="anomaly-pill anomaly-neutral">${diff >= 0 ? '+' : ''}${diff.toFixed(1)} mm/d</span>`;
        }

        rowHtml += `
            <td class="rain-cell">
                <span class="rain-badge" style="background-color: ${meanC.bg}; color: ${meanC.text}; font-weight:800;">
                    ${mean6Mo.toFixed(1)}
                </span>
            </td>
            <td class="rain-cell">
                <span class="rain-badge" style="background-color: ${baseC.bg}; color: ${baseC.text}; opacity: 0.85;">
                    ${base6Mo.toFixed(1)}
                </span>
            </td>
            <td class="rain-cell">${anomalyHtml}</td>
            <td class="rain-cell" style="font-weight:700; color:var(--text-primary);">${Math.round(totalRain)} mm</td>
        </tr>`;

        tbody += rowHtml;
    });

    document.getElementById("table-container").innerHTML = `
        <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; padding: 10px 14px; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
            <div>
                <strong style="color: #166534; font-size: 13px;">🔮 ECMWF SEAS5 6-Month Seasonal Precipitation Forecast (Oct 2026 – Mar 2027)</strong>
                <p style="font-size: 11.5px; color: #15803d; margin-top: 2px;">
                    Ensemble seasonal projection in mm/day across 39 oil palm producing states. Includes Northeast Monsoon progression and early 2027 recovery outlook.
                </p>
            </div>
            <div style="display: flex; gap: 8px;">
                <button class="pill-btn" onclick="setMode('monthly')" style="font-weight: 700; background: #ffffff; color: var(--text-primary); border-color: var(--border-color);">
                    &larr; Back to Calendar Overview
                </button>
            </div>
        </div>
        <table class="rainfall-table" id="exportable-table">
            <thead>${thead}</thead>
            <tbody>${tbody}</tbody>
        </table>
    `;
}

// -------------------------------------------------------------
// 2. DAILY MATRIX VIEW (OBSERVED 14 DAYS + 14-DAY FORECAST)
// -------------------------------------------------------------
function renderDailyTable(locations) {
    const dates = currentData.recent_daily_dates || [];
    const last14ObsDates = dates.slice(-14);
    const forecastDates = currentData.forecast_daily_dates || [];
    const hasForecast = forecastDates.length > 0;
    const subView = hasForecast ? currentDailySubView : 'obs';

    const obsRangeStr = last14ObsDates.length > 0 
        ? `${formatShortDate(last14ObsDates[0])} – ${formatShortDate(last14ObsDates[last14ObsDates.length - 1])} 2026` 
        : "Past 14 Days";
    const fcstRangeStr = forecastDates.length > 0 
        ? `${formatShortDate(forecastDates[0])} – ${formatShortDate(forecastDates[forecastDates.length - 1])} 2026` 
        : "Next 14 Days";

    // Build Toolbar
    let toolbarHtml = `
        <div class="daily-matrix-toolbar" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; margin-bottom:12px; background:linear-gradient(180deg, #ffffff 0%, #f8fafc 100%); border:1px solid #e2e8f0; border-radius:8px; padding:8px 14px; box-shadow:0 1px 2px rgba(0,0,0,0.02);">
            <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                <span style="font-size:11.5px; font-weight:700; color:#475569; text-transform:uppercase; letter-spacing:0.5px;">Matrix Scope:</span>
                <button class="pill-btn ${subView === 'all' ? 'active' : ''}" onclick="setDailySubView('all')" style="${subView === 'all' ? 'background:#0f172a; color:#fff; font-weight:700; border-color:#0f172a;' : 'background:#fff; color:#334155; border-color:#cbd5e1; font-weight:600;'}">
                    📅 All 28 Days (14D Obs + 14D Forecast)
                </button>
                <button class="pill-btn ${subView === 'obs' ? 'active' : ''}" onclick="setDailySubView('obs')" style="${subView === 'obs' ? 'background:#0f172a; color:#fff; font-weight:700; border-color:#0f172a;' : 'background:#fff; color:#334155; border-color:#cbd5e1; font-weight:600;'}">
                    🌧️ Observed (Past 14 Days)
                </button>
                <button class="pill-btn ${subView === 'fcst' ? 'active' : ''}" onclick="setDailySubView('fcst')" style="${subView === 'fcst' ? 'background:#1e1b4b; color:#38bdf8; font-weight:700; border-color:#6366f1;' : 'background:#fff; color:#334155; border-color:#cbd5e1; font-weight:600;'}">
                    🔮 Forecast (Next 14 Days ECMWF)
                </button>
            </div>
            <div style="display:flex; align-items:center; gap:10px; font-size:11.5px; flex-wrap:wrap;">
                <span style="background:#f1f5f9; padding:4px 8px; border-radius:4px; border:1px solid #e2e8f0; color:#334155; font-weight:600;">
                    Observed: <strong>${obsRangeStr}</strong>
                </span>
                ${hasForecast ? `
                <span style="background:#eff6ff; padding:4px 8px; border-radius:4px; border:1px solid #bfdbfe; color:#1d4ed8; font-weight:600;">
                    Forecast: <strong>${fcstRangeStr} (ECMWF)</strong>
                </span>` : ''}
            </div>
        </div>
    `;

    // Build Table Header
    let thead = "";
    if (subView === "all") {
        thead = `
            <tr>
                <th rowspan="2" style="background:#f8fafc; border-bottom:2px solid var(--border-color); vertical-align:middle; min-width:65px;">Country</th>
                <th rowspan="2" style="background:#f8fafc; border-bottom:2px solid var(--border-color); vertical-align:middle; min-width:95px;">Region / Island</th>
                <th rowspan="2" style="background:#f8fafc; border-bottom:2px solid var(--border-color); vertical-align:middle; min-width:120px; border-right:2px solid #cbd5e1;">State / Province</th>
                <th colspan="${last14ObsDates.length + 1}" style="text-align:center; background:#0f172a; color:#f8fafc; font-size:10.5px; font-weight:700; letter-spacing:0.5px; border-right:3px solid #0284c7; padding:5px 3px;">
                    🌧️ PAST 14 DAYS (OBSERVED ECMWF IFS/ERA5)
                </th>
                <th colspan="${forecastDates.length + 1}" style="text-align:center; background:#1e1b4b; color:#38bdf8; font-size:10.5px; font-weight:700; letter-spacing:0.5px; padding:5px 3px;">
                    🔮 NEXT 14 DAYS (ECMWF OPERATIONAL FORECAST)
                </th>
            </tr>
            <tr>
        `;
        last14ObsDates.forEach(d => {
            const parts = d.split("-");
            thead += `<th style="text-align:center; font-size:9.5px; padding:2px 1px; min-width:33px;" title="Observed: ${d}">${parts[2]}/${parts[1]}</th>`;
        });
        thead += `<th style="text-align:center; font-size:10px; font-weight:800; background:#f1f5f9; color:#0f172a; border-right:3px solid #0284c7; min-width:48px;" title="14-Day Observed Daily Average (mm/day)">14D Obs Avg</th>`;

        forecastDates.forEach(d => {
            const parts = d.split("-");
            thead += `
                <th style="text-align:center; font-size:9.5px; padding:2px 1px; min-width:33px; background:#f0fdf4;" title="ECMWF Forecast: ${d}">
                    <div style="font-weight:700; color:#0f172a; line-height:1.1;">${parts[2]}/${parts[1]}</div>
                    <div style="font-size:7.5px; color:#0284c7; font-weight:800; line-height:1; letter-spacing:0.2px;">FCST</div>
                </th>
            `;
        });
        thead += `<th style="text-align:center; font-size:10px; font-weight:800; background:#e0f2fe; color:#0369a1; min-width:48px;" title="14-Day ECMWF Forecast Daily Average (mm/day)">14D Fcst Avg</th>`;
        thead += `</tr>`;

    } else if (subView === "obs") {
        thead = `
            <tr>
                <th style="min-width:80px;">Country</th>
                <th style="min-width:105px;">Region / Island</th>
                <th style="min-width:140px;">State / Province</th>
        `;
        last14ObsDates.forEach(d => {
            const parts = d.split("-");
            thead += `<th style="text-align:center; font-size:10.5px; padding:5px 3px; min-width:40px;" title="Observed: ${d}">${parts[2]}/${parts[1]}</th>`;
        });
        thead += `
            <th style="text-align:center; font-size:11px; font-weight:800; background:#f1f5f9; min-width:65px;">14D Obs Avg</th>
            <th style="text-align:center; font-size:11px; font-weight:800; background:#e2e8f0; min-width:65px;">14D Total</th>
        </tr>`;

    } else if (subView === "fcst") {
        thead = `
            <tr>
                <th style="min-width:80px;">Country</th>
                <th style="min-width:105px;">Region / Island</th>
                <th style="min-width:140px;">State / Province</th>
        `;
        forecastDates.forEach(d => {
            const parts = d.split("-");
            thead += `
                <th style="text-align:center; font-size:10px; padding:4px 3px; min-width:42px; background:#f0fdf4;" title="ECMWF Forecast: ${d}">
                    <div style="font-weight:700; color:#0f172a;">${parts[2]}/${parts[1]}</div>
                    <div style="font-size:8px; color:#0284c7; font-weight:800;">FCST</div>
                </th>
            `;
        });
        thead += `
            <th style="text-align:center; font-size:11px; font-weight:800; background:#e0f2fe; color:#0369a1; min-width:65px;" title="14-Day Forecast Daily Average (mm/day)">14D Fcst Avg</th>
            <th style="text-align:center; font-size:11px; font-weight:800; background:#bae6fd; color:#0369a1; min-width:65px;" title="14-Day Cumulative Forecast Total (mm)">14D Total</th>
            <th style="text-align:center; font-size:11px; font-weight:800; background:#f8fafc; color:#475569; min-width:65px;" title="Max Single Day Rainfall (mm)">Max Day</th>
            <th style="text-align:center; font-size:11px; font-weight:800; background:#f1f5f9; color:#475569; min-width:85px;" title="Dry (<1mm) / Wet (>=10mm) Days">Dry / Wet Days</th>
        </tr>`;
    }

    // Build Table Body
    let tbody = "";
    locations.forEach(loc => {
        const lid = loc.id;
        const dailyDict = (currentData.recent_daily && currentData.recent_daily[lid]) || {};
        const forecastDict = (currentData.forecast_daily && currentData.forecast_daily[lid]) || {};
        const fcstSummary = (currentData.forecast_14d_summary && currentData.forecast_14d_summary[lid]) || null;

        let rowHtml = `
            <tr>
                <td><strong>${loc.country}</strong></td>
                <td><span class="group-badge">${loc.major_group}</span></td>
                <td class="col-state" onclick="viewStateInMatrix('${lid}')" title="Click to view full 2010-2026 Year x Month Matrix" style="${subView === 'all' ? 'border-right:2px solid #cbd5e1;' : ''}">${loc.name}</td>
        `;

        if (subView === "all") {
            // 1. Observed cells
            let sumObs = 0;
            let countObs = 0;
            last14ObsDates.forEach(d => {
                const val = dailyDict[d];
                if (val !== undefined && val !== null) {
                    sumObs += val;
                    countObs++;
                    const c = getRainColor(val);
                    rowHtml += `
                        <td class="rain-cell">
                            <span class="rain-badge" style="background-color: ${c.bg}; color: ${c.text};" title="Observed ${d}: ${val.toFixed(1)} mm">
                                ${val.toFixed(1)}
                            </span>
                        </td>
                    `;
                } else {
                    rowHtml += `<td class="rain-cell"><span style="color:#cbd5e1;">-</span></td>`;
                }
            });

            // 2. Observed Avg
            const avgObs = countObs > 0 ? (sumObs / countObs) : null;
            if (avgObs !== null) {
                const ac = getRainColor(avgObs);
                rowHtml += `
                    <td class="rain-cell" style="border-right:3px solid #0284c7; background:#f8fafc;">
                        <span class="rain-badge" style="background-color: ${ac.bg}; color: ${ac.text}; font-weight:800;" title="14D Observed Total: ${sumObs.toFixed(1)} mm | Avg: ${avgObs.toFixed(1)} mm/day">
                            ${avgObs.toFixed(1)}
                        </span>
                    </td>
                `;
            } else {
                rowHtml += `<td class="rain-cell" style="border-right:3px solid #0284c7;">-</td>`;
            }

            // 3. Forecast cells
            let sumFcst = 0;
            let countFcst = 0;
            forecastDates.forEach(d => {
                const fval = forecastDict[d];
                if (fval !== undefined && fval !== null) {
                    sumFcst += fval;
                    countFcst++;
                    const c = getRainColor(fval);
                    rowHtml += `
                        <td class="rain-cell">
                            <span class="rain-badge forecast-badge" style="background-color: ${c.bg}; color: ${c.text};" title="🔮 Forecast ${d}: ${fval.toFixed(1)} mm">
                                ${fval.toFixed(1)}
                            </span>
                        </td>
                    `;
                } else {
                    rowHtml += `<td class="rain-cell"><span style="color:#cbd5e1;">-</span></td>`;
                }
            });

            // 4. Forecast Avg
            const avgFcst = fcstSummary ? fcstSummary.avg_mm_day : (countFcst > 0 ? (sumFcst / countFcst) : null);
            const totFcst = fcstSummary ? fcstSummary.total_mm : sumFcst;
            if (avgFcst !== null) {
                const afc = getRainColor(avgFcst);
                rowHtml += `
                    <td class="rain-cell" style="background:#eff6ff;">
                        <span class="rain-badge" style="background-color: ${afc.bg}; color: ${afc.text}; font-weight:800;" title="14D Forecast Total: ${totFcst.toFixed(1)} mm | Avg: ${avgFcst.toFixed(1)} mm/day">
                            ${avgFcst.toFixed(1)}
                        </span>
                    </td>
                `;
            } else {
                rowHtml += `<td class="rain-cell">-</td>`;
            }

        } else if (subView === "obs") {
            let sumObs = 0;
            let countObs = 0;
            last14ObsDates.forEach(d => {
                const val = dailyDict[d];
                if (val !== undefined && val !== null) {
                    sumObs += val;
                    countObs++;
                    const c = getRainColor(val);
                    rowHtml += `
                        <td class="rain-cell">
                            <span class="rain-badge" style="background-color: ${c.bg}; color: ${c.text};" title="Observed ${d}: ${val.toFixed(1)} mm">
                                ${val.toFixed(1)}
                            </span>
                        </td>
                    `;
                } else {
                    rowHtml += `<td class="rain-cell"><span style="color:#cbd5e1;">-</span></td>`;
                }
            });
            const avgObs = countObs > 0 ? (sumObs / countObs) : null;
            if (avgObs !== null) {
                const ac = getRainColor(avgObs);
                rowHtml += `
                    <td class="rain-cell">
                        <span class="rain-badge" style="background-color: ${ac.bg}; color: ${ac.text}; font-weight:800;">
                            ${avgObs.toFixed(1)}
                        </span>
                    </td>
                    <td class="rain-cell" style="font-weight:700; color:#334155;">${sumObs.toFixed(1)}</td>
                `;
            } else {
                rowHtml += `<td class="rain-cell">-</td><td class="rain-cell">-</td>`;
            }

        } else if (subView === "fcst") {
            let sumFcst = 0;
            let countFcst = 0;
            forecastDates.forEach(d => {
                const fval = forecastDict[d];
                if (fval !== undefined && fval !== null) {
                    sumFcst += fval;
                    countFcst++;
                    const c = getRainColor(fval);
                    rowHtml += `
                        <td class="rain-cell">
                            <span class="rain-badge forecast-badge" style="background-color: ${c.bg}; color: ${c.text};" title="🔮 Forecast ${d}: ${fval.toFixed(1)} mm">
                                ${fval.toFixed(1)}
                            </span>
                        </td>
                    `;
                } else {
                    rowHtml += `<td class="rain-cell"><span style="color:#cbd5e1;">-</span></td>`;
                }
            });

            const avgFcst = fcstSummary ? fcstSummary.avg_mm_day : (countFcst > 0 ? (sumFcst / countFcst) : null);
            const totFcst = fcstSummary ? fcstSummary.total_mm : sumFcst;
            const maxDay = fcstSummary ? fcstSummary.max_daily_mm : 0;
            const dryDays = fcstSummary ? fcstSummary.dry_days : 0;
            const wetDays = fcstSummary ? fcstSummary.wet_days : 0;

            if (avgFcst !== null) {
                const afc = getRainColor(avgFcst);
                rowHtml += `
                    <td class="rain-cell">
                        <span class="rain-badge" style="background-color: ${afc.bg}; color: ${afc.text}; font-weight:800;">
                            ${avgFcst.toFixed(1)}
                        </span>
                    </td>
                    <td class="rain-cell" style="font-weight:700; color:#0369a1;">${totFcst.toFixed(1)}</td>
                    <td class="rain-cell" style="font-weight:600; color:#475569;">${maxDay.toFixed(1)}</td>
                    <td class="rain-cell" style="font-size:11px; color:#475569;">
                        <span style="color:${dryDays >= 5 ? '#ef4444' : '#64748b'}; font-weight:600;">${dryDays}d dry</span> / 
                        <span style="color:${wetDays >= 3 ? '#16a34a' : '#64748b'}; font-weight:600;">${wetDays}d wet</span>
                    </td>
                `;
            } else {
                rowHtml += `<td class="rain-cell">-</td><td class="rain-cell">-</td><td class="rain-cell">-</td><td class="rain-cell">-</td>`;
            }
        }

        rowHtml += `</tr>`;
        tbody += rowHtml;
    });

    document.getElementById("table-container").innerHTML = `
        <div style="padding: 10px 14px 2px 14px;">
            ${toolbarHtml}
        </div>
        <table class="rainfall-table daily-matrix-table" id="exportable-table">
            <thead>${thead}</thead>
            <tbody>${tbody}</tbody>
        </table>
    `;
}

// -------------------------------------------------------------
// 3. WEEKLY VIEW (LAST 8 WEEKS)
// -------------------------------------------------------------
function renderWeeklyTable(locations) {
    const weeklyLabels = currentData.recent_weekly_labels || [];
    const last8Weeks = weeklyLabels.slice(-8);

    let thead = `
        <tr>
            <th>Country</th>
            <th>Region / Island</th>
            <th>State / Province</th>
    `;
    last8Weeks.forEach(w => {
        thead += `<th style="text-align:center;">${w}</th>`;
    });
    thead += `<th style="text-align:center;">8-Wk Avg</th></tr>`;

    let tbody = "";
    locations.forEach(loc => {
        const lid = loc.id;
        const weeklyDict = (currentData.recent_weekly && currentData.recent_weekly[lid]) || {};
        let rowHtml = `
            <tr>
                <td><strong>${loc.country}</strong></td>
                <td><span class="group-badge">${loc.major_group}</span></td>
                <td class="col-state" onclick="viewStateInMatrix('${lid}')" title="Click to view full 2010-2026 Year x Month Matrix">${loc.name}</td>
        `;

        let sum8 = 0;
        let count8 = 0;

        last8Weeks.forEach(w => {
            const wData = weeklyDict[w];
            if (wData) {
                const avg = wData.avg_mm_day;
                sum8 += avg;
                count8++;
                const c = getRainColor(avg);
                rowHtml += `
                    <td class="rain-cell">
                        <span class="rain-badge" style="background-color: ${c.bg}; color: ${c.text};" title="${w}: ${avg.toFixed(1)} mm/day (${wData.total_mm}mm total)">
                            ${avg.toFixed(1)}
                        </span>
                    </td>
                `;
            } else {
                rowHtml += `<td class="rain-cell"><span style="color:#cbd5e1;">-</span></td>`;
            }
        });

        const avg8 = count8 > 0 ? (sum8 / count8) : null;
        if (avg8 !== null) {
            const ac = getRainColor(avg8);
            rowHtml += `
                <td class="rain-cell">
                    <span class="rain-badge" style="background-color: ${ac.bg}; color: ${ac.text}; font-weight:800;">
                        ${avg8.toFixed(1)}
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
// 4. STATE MATRIX: YEAR X MONTH
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
    for (let y = 2027; y >= 2010; y--) {
        const pill = document.createElement("span");
        pill.className = "year-toggle-pill" + (matrixSelectedYears.includes(y) ? " active" : "");
        pill.innerText = (y === 2027) ? "2027 (F)" : y;
        pill.title = (y === 2027) ? "2027 Q1 Seasonal Forecast" : y;
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
        matrixSelectedYears.sort((a, b) => b - a);
    }
    renderYearPills();
    renderTable();
}

function setYearPreset(preset) {
    document.querySelectorAll(".preset-group button[data-ypreset]").forEach(b => {
        b.classList.toggle("active", b.dataset.ypreset === preset);
    });
    if (preset === "all") {
        matrixSelectedYears = [2027, 2026, 2025, 2024, 2023, 2022, 2021, 2020, 2019, 2018, 2017, 2016, 2015, 2014, 2013, 2012, 2011, 2010];
    } else if (preset === "last5") {
        matrixSelectedYears = [2027, 2026, 2025, 2024, 2023];
    } else if (preset === "last10") {
        matrixSelectedYears = [2027, 2026, 2025, 2024, 2023, 2022, 2021, 2020, 2019, 2018];
    } else if (preset === "elnino") {
        matrixSelectedYears = [2027, 2026, 2023, 2019, 2016, 2015];
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

    const regionOrder = ["Peninsular Malaysia", "Sabah & Sarawak", "Sumatera", "Kalimantan", "Sulawesi", "Papua", "South Thailand", "Mindanao (Copra)"];
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
    if (!currentData) return;
    const regionLocs = currentData.locations.filter(l => l.major_group === regionName);
    matrixSelectedStates = regionLocs.map(l => l.id);
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

function toggleStatePicker() {
    isStatePickerCollapsed = !isStatePickerCollapsed;
    const container = document.getElementById("matrix-state-pills-container");
    const optRow = document.getElementById("matrix-multi-state-options");
    const btn = document.getElementById("toggle-state-picker-btn");
    if (!container || !btn) return;
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

    // 1. SINGLE STATE VIEW
    if (selectedLocs.length === 1) {
        const loc = selectedLocs[0];
        const { thead, tbody, grandDailyAvg } = buildMatrixTableForLocation(loc, yearsToShow, activeMonths, monthNames);

        let headerHtml = `
            <div class="state-matrix-header">
                <div class="state-matrix-title">
                    <h2>${loc.name} • Rainfall Matrix • ${yearSpanText}</h2>
                    <p>${loc.country} • ${loc.major_group} • Showing: ${monthSpanText}</p>
                </div>
                <div style="display: flex; gap: 14px; align-items: center; flex-wrap: wrap;">
                    ${getDensitySelectorHtml()}
                    <div style="text-align: right;">
                        <div style="font-size: 10px; color: var(--text-secondary); text-transform: uppercase; font-weight: 700;">Filtered Daily Avg</div>
                        <div style="font-size: 20px; font-weight: 800; color: var(--text-primary);">${grandDailyAvg.toFixed(2)} mm / day</div>
                    </div>
                    <button class="btn btn-secondary" onclick="openDrilldown('${loc.id}')" style="background: #09444c; color: white;">
                        View Trend Line &rarr;
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
                <h2>Combined Average Rainfall Matrix • ${selectedLocs.length} States • ${yearSpanText}</h2>
                <p>States: ${stateNamesSummary} • Showing: ${monthSpanText}</p>
            </div>
            <div style="display: flex; gap: 14px; align-items: center; flex-wrap: wrap;">
                ${getDensitySelectorHtml()}
                <div style="text-align: right;">
                    <div style="font-size: 10px; color: var(--text-secondary); text-transform: uppercase; font-weight: 700;">Combined Daily Avg</div>
                    <div style="font-size: 20px; font-weight: 800; color: var(--text-primary);">${combDailyAvg.toFixed(2)} mm / day</div>
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
                    Individual State Breakdowns (${selectedLocs.length} States)
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
                            <span style="font-size: 11.5px; font-weight: 700; color: var(--text-primary);">Avg: ${sDailyAvg.toFixed(2)} mm/day</span>
                            <button class="btn btn-secondary" onclick="openDrilldown('${loc.id}')" style="background: #09444c; color: white; padding: 3px 8px; font-size: 11px;">
                                Trend &rarr;
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
    const locMonthly = (currentData.monthly_data && currentData.monthly_data[loc.id]) || {};
    const baseline = (currentData.baseline_monthly && currentData.baseline_monthly[loc.id]) || {};

    let grandSum = 0;
    let grandDays = 0;
    yearsToShow.forEach(y => {
        if (locMonthly[y]) {
            activeMonths.forEach(m => {
                if (locMonthly[y][m]) {
                    grandSum += locMonthly[y][m].total_mm;
                    grandDays += locMonthly[y][m].days;
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
                const avg = mInfo.avg_mm_day;
                rowSum += mInfo.total_mm;
                rowDays += mInfo.days;
                const c = getRainColor(avg);
                const displayVal = avg.toFixed(1);
                const isFcst = mInfo.is_forecast || (y === 2026 && m >= 10) || (y === 2027 && m <= 3);
                const subLabel = isFcst ? "Forecast" : `${Math.round(mInfo.total_mm)}mm`;
                const squareClass = isFcst ? "matrix-square-cell forecast-square" : "matrix-square-cell";
                const tooltip = isFcst
                    ? `${monthNames[m-1]} ${y} (ECMWF SEAS5 Forecast): ${avg.toFixed(1)} mm/day (${Math.round(mInfo.total_mm)} mm in ${mInfo.days} days)`
                    : `${monthNames[m-1]} ${y}: ${avg.toFixed(1)} mm/day (${mInfo.total_mm} mm in ${mInfo.days} days)`;

                rowHtml += `
                    <td>
                        <div class="${squareClass}" style="background-color: ${c.bg}; color: ${c.text};" title="${tooltip}">
                            <span>${displayVal}</span>
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
            const yc = getRainColor(yAvg);
            const displayYAvg = yAvg.toFixed(1);
            rowHtml += `
                <td>
                    <div class="matrix-square-cell" style="background-color: ${yc.bg}; color: ${yc.text}; border: 2px solid rgba(0,0,0,0.15);" title="${y} Filtered Months: ${displayYAvg} mm/day (${Math.round(rowSum)}mm)">
                        <span style="font-weight: 900;">${displayYAvg}</span>
                        <span class="matrix-square-total">${Math.round(rowSum)}mm</span>
                    </div>
                </td>
            `;
        } else {
            rowHtml += `<td><div class="matrix-square-cell" style="background: #f8fafc; color: #cbd5e1;">-</div></td>`;
        }

        rowHtml += `</tr>`;
        tbody += rowHtml;
    });

    // Add Baseline Normal Row
    let baseCells = `<tr class="matrix-baseline-row">
        <td class="matrix-year-cell" style="background: #0284c7; color: white; font-weight: 800;">Normal</td>`;
    let baselineSum = 0;
    let baseCount = 0;

    activeMonths.forEach(m => {
        const bVal = baseline[m];
        if (bVal !== undefined && bVal !== null) {
            baselineSum += bVal;
            baseCount++;
            const bc = getRainColor(bVal);
            baseCells += `
                <td>
                    <div class="matrix-square-cell" style="background-color: ${bc.bg}; color: ${bc.text}; outline: 2px solid #0284c7; outline-offset: -2px;" title="Historical Normal ${monthNames[m-1]}: ${bVal.toFixed(1)} mm/day">
                        <span>${bVal.toFixed(1)}</span>
                        <span class="matrix-square-total">Normal</span>
                    </div>
                </td>
            `;
        } else {
            baseCells += `<td>-</td>`;
        }
    });

    const fullBaseAvg = baseCount > 0 ? (baselineSum / baseCount) : 0;
    const fbc = getRainColor(fullBaseAvg);
    baseCells += `
        <td>
            <div class="matrix-square-cell" style="background-color: ${fbc.bg}; color: ${fbc.text}; outline: 2px solid #0284c7; font-weight: 900;" title="Historical Normal Filtered Months: ${fullBaseAvg.toFixed(1)} mm/day">
                <span>${fullBaseAvg.toFixed(1)}</span>
                <span class="matrix-square-total">Normal</span>
            </div>
        </td>
    </tr>`;

    tbody += baseCells + "</tbody>";
    return { thead, tbody, grandDailyAvg };
}

function buildCombinedMatrixTable(selectedLocs, yearsToShow, activeMonths, monthNames) {
    let grandSum = 0;
    let grandDays = 0;

    yearsToShow.forEach(y => {
        activeMonths.forEach(m => {
            selectedLocs.forEach(loc => {
                const locM = (currentData.monthly_data && currentData.monthly_data[loc.id]) || {};
                const mData = locM[y] && locM[y][m];
                if (mData) {
                    grandSum += mData.total_mm;
                    grandDays += mData.days;
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
                const locM = (currentData.monthly_data && currentData.monthly_data[loc.id]) || {};
                const mData = locM[y] && locM[y][m];
                if (mData) {
                    mSum += mData.avg_mm_day;
                    mCount++;
                }
            });

            if (mCount > 0) {
                const avg = mSum / mCount;
                ySum += avg;
                yCount++;
                const c = getRainColor(avg);
                const displayVal = avg.toFixed(1);

                const isFcst = (y === 2026 && m >= 10) || (y === 2027 && m <= 3);
                const squareClass = isFcst ? "matrix-square-cell forecast-square" : "matrix-square-cell";
                const subLabel = isFcst ? "Forecast" : "Comb";
                const tooltip = isFcst
                    ? `${monthNames[m-1]} ${y} (ECMWF SEAS5 Forecast): Combined ${displayVal} mm/day (${selectedLocs.length} states)`
                    : `${monthNames[m-1]} ${y}: ${displayVal} mm/day (${selectedLocs.length} states combined)`;

                rowHtml += `
                    <td>
                        <div class="${squareClass}" style="background-color: ${c.bg}; color: ${c.text};" title="${tooltip}">
                            <span>${displayVal}</span>
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
            const yc = getRainColor(yAvg);
            const displayYAvg = yAvg.toFixed(1);
            rowHtml += `
                <td>
                    <div class="matrix-square-cell" style="background-color: ${yc.bg}; color: ${yc.text}; border: 2px solid rgba(0,0,0,0.15);" title="${y} Combined: ${displayYAvg} mm/day">
                        <span style="font-weight: 900;">${displayYAvg}</span>
                        <span class="matrix-square-total">Comb</span>
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

function renderDrilldownChart(loc) {
    const canvas = document.getElementById("drilldown-chart");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (currentChart) currentChart.destroy();

    const monthLabels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const locMonthly = (currentData.monthly_data && currentData.monthly_data[loc.id]) || {};
    const baseline = (currentData.baseline_monthly && currentData.baseline_monthly[loc.id]) || {};

    const d2026Obs = [];
    const d2026Fcst = [];
    const d2025 = [];
    const d2024 = [];
    const dBase = [];

    for (let m = 1; m <= 12; m++) {
        const mObj = locMonthly[2026] && locMonthly[2026][m];
        const val26 = mObj ? mObj.avg_mm_day : null;
        if (m <= 8) {
            d2026Obs.push(val26);
            d2026Fcst.push(null);
        } else if (m === 9) {
            d2026Obs.push(val26);
            d2026Fcst.push(val26); // connect line smoothly
        } else {
            d2026Obs.push(null);
            d2026Fcst.push(val26);
        }
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
                    label: "2026 Observed (Jan–Sep)",
                    data: d2026Obs,
                    borderColor: "#0284c7",
                    backgroundColor: "rgba(2, 132, 199, 0.1)",
                    borderWidth: 3,
                    fill: false,
                    tension: 0.2
                },
                {
                    label: "2026 Forecast (Oct–Dec, ECMWF SEAS5)",
                    data: d2026Fcst,
                    borderColor: "#0284c7",
                    borderWidth: 2.5,
                    borderDash: [5, 4],
                    pointStyle: "rectRot",
                    pointRadius: 5,
                    fill: false,
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
    link.setAttribute("download", `precipitation_data_${new Date().toISOString().slice(0,10)}.csv`);
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
