// =============================================================
// PRECIPITATION DASHBOARD - ECMWF ERA5 & DAILY OPERATIONAL (2010–PRESENT)
// =============================================================

let currentData = null;
let currentMode = "monthly"; // 'monthly', 'daily', 'state_matrix', 'forecast_6mo'
let currentFcstMetric = "absolute"; // 'absolute' or 'anomaly'
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
let currentDailySubView = "all"; // 'all' (28-day sliding window), 'fcst28' (next 28 days forward forecast), 'obs' (past 14 days), 'fcst' (next 14 days)
let dailyTimelineStartIndex = null;

function shiftDailyWindowTo(idx) {
    if (!currentData) return;
    const obsDates = currentData.recent_daily_dates || [];
    const fcDates = currentData.forecast_daily_dates || [];
    const allDates = [...obsDates, ...fcDates];
    const totalDays = allDates.length;
    if (totalDays < 28) return;
    
    idx = parseInt(idx, 10);
    const maxIdx = totalDays - 28;
    if (isNaN(idx)) idx = Math.max(0, obsDates.length - 14);
    idx = Math.max(0, Math.min(maxIdx, idx));
    dailyTimelineStartIndex = idx;
    
    if (currentMode === "daily") {
        renderDailyTable(getFilteredLocations());
    }
}

function shiftDailyWindowDays(days) {
    if (!currentData) return;
    const obsDates = currentData.recent_daily_dates || [];
    const fcDates = currentData.forecast_daily_dates || [];
    const allDates = [...obsDates, ...fcDates];
    const totalDays = allDates.length;
    const maxIdx = totalDays - 28;
    
    if (dailyTimelineStartIndex === null) {
        dailyTimelineStartIndex = Math.max(0, obsDates.length - 14);
    }
    shiftDailyWindowTo(dailyTimelineStartIndex + days);
}

function onDailySliderChange(val) {
    shiftDailyWindowTo(val);
}

function onDailyPresetSelect(val) {
    shiftDailyWindowTo(val);
}

function setDailySubView(subView) {
    currentDailySubView = subView;
    if (!currentData) return;
    const obsDates = currentData.recent_daily_dates || [];
    const fcDates = currentData.forecast_daily_dates || [];
    const allDates = [...obsDates, ...fcDates];
    
    if (subView === "fcst28") {
        dailyTimelineStartIndex = Math.max(0, allDates.length - 28);
    } else if (subView === "all") {
        dailyTimelineStartIndex = Math.max(0, obsDates.length - 14);
    }
    
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
    const fcstToggle = document.getElementById("forecast-metric-toggle");
    if (fcstToggle) fcstToggle.style.display = (mode === "forecast_6mo" || mode === "state_matrix") ? "inline-flex" : "none";
    
    if (mode === "state_matrix") {
        renderStatePills();
    }
    renderTable();
}

function setFcstMetric(metric) {
    currentFcstMetric = metric;
    document.querySelectorAll("#forecast-metric-toggle .segmented-btn").forEach(b => {
        b.classList.toggle("active", b.dataset.fcstMetric === metric);
    });
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
                const tip = `${monthNames[m-1]} ${currentYear}: ${avg.toFixed(1)} mm/day (${Math.round(mData.total_mm)} mm in ${mData.days} days)`;
                rowHtml += `
                    <td class="rain-cell">
                        <span class="rain-badge" style="background-color: ${c.bg}; color: ${c.text};" title="${tip}">
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
                const tip = `${fm.name}: ${avg.toFixed(1)} mm/day (${Math.round(mInfo.total_mm)} mm) \u2014 Normal: ${mInfo.baseline_mm_day} mm/d (Diff: ${mInfo.rain_anomaly_mm_day > 0 ? "+" : ""}${mInfo.rain_anomaly_mm_day} mm/d)`;
                
                let displayVal = avg.toFixed(1);
                let badgeClass = "rain-badge forecast-badge";
                let style = `background-color: ${c.bg}; color: ${c.text};`;

                if (currentFcstMetric === "anomaly") {
                    const anom = mInfo.rain_anomaly_mm_day || 0;
                    displayVal = (anom > 0 ? '+' : '') + anom.toFixed(1);
                    if (anom > 0.5) {
                        badgeClass = "anomaly-pill anomaly-surplus";
                        style = "";
                    } else if (anom < -0.5) {
                        badgeClass = "anomaly-pill anomaly-deficit";
                        style = "";
                    } else {
                        badgeClass = "anomaly-pill anomaly-normal";
                        style = "";
                    }
                }

                rowHtml += `
                    <td class="rain-cell">
                        <span class="${badgeClass}" style="${style}" title="${tip}">
                            ${displayVal}
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
// 2. DAILY MATRIX VIEW (28-DAY TIMELINE SLIDER + EXTENDED ECMWF FORECAST)
// -------------------------------------------------------------
function renderDailyTable(locations) {
    const obsDates = (currentData && currentData.recent_daily_dates) || [];
    const fcDates = (currentData && currentData.forecast_daily_dates) || [];
    const allDates = [...obsDates, ...fcDates];
    const totalDays = allDates.length;
    
    if (totalDays === 0) {
        document.getElementById("table-container").innerHTML = `<div style="padding:20px; text-align:center;">No daily rainfall data available.</div>`;
        return;
    }

    const todayDate = obsDates.length > 0 ? obsDates[obsDates.length - 1] : "";
    const todayIdx = allDates.indexOf(todayDate);
    const forecastStartDate = fcDates.length > 0 ? fcDates[0] : "";
    
    const defaultLiveIndex = Math.max(0, obsDates.length - 14);
    const maxForwardIndex = Math.max(0, totalDays - 28);

    if (dailyTimelineStartIndex === null) {
        dailyTimelineStartIndex = defaultLiveIndex;
    }
    dailyTimelineStartIndex = Math.max(0, Math.min(maxForwardIndex, dailyTimelineStartIndex));

    const subView = currentDailySubView;
    const isTimelineView = (subView === "all" || subView === "fcst28" || subView === "slider");

    // Compute active 28 days for the sliding window
    const activeDates = allDates.slice(dailyTimelineStartIndex, dailyTimelineStartIndex + 28);
    const dateStart = activeDates[0] || "";
    const dateMid = activeDates[13] || "";
    const dateSeg2Start = activeDates[14] || "";
    const dateEnd = activeDates[27] || "";

    const windowStartFormatted = formatShortDate(dateStart);
    const windowEndFormatted = formatShortDate(dateEnd);

    const isCurrentLive = (dailyTimelineStartIndex === defaultLiveIndex);
    const isFullForward = (dailyTimelineStartIndex === maxForwardIndex);

    // Determine window description tag
    let windowTypeLabel = "28 Days • Observed + ECMWF Forecast";
    if (dateStart >= forecastStartDate) {
        windowTypeLabel = "28 Days • Forward ECMWF Forecast (Days 1–28)";
    } else if (dateEnd < forecastStartDate) {
        windowTypeLabel = "28 Days • Observed Ag-Reanalysis";
    }

    // Presets list for dropdown (matching GFS North America Dashboard standard)
    const presets = [
        { label: `🔮 Next 28 Days Forward Forecast (${formatShortDate(fcDates[0])} – ${formatShortDate(fcDates[27] || fcDates[fcDates.length - 1])})`, value: maxForwardIndex },
        { label: `⚡ Current Live Window (14D Obs + 14D ECMWF) (${formatShortDate(allDates[defaultLiveIndex])} – ${formatShortDate(allDates[defaultLiveIndex + 27])})`, value: defaultLiveIndex },
        { label: `🌧️ Trailing 28 Days Observed Actuals (${formatShortDate(allDates[Math.max(0, obsDates.length - 28)])} – ${formatShortDate(todayDate)})`, value: Math.max(0, obsDates.length - 28) }
    ];
    if (obsDates.length >= 40) {
        presets.push({ label: `📅 September 2026 Window (Aug 27 – Sep 23)`, value: Math.max(0, obsDates.length - 42) });
    }
    if (obsDates.length >= 70) {
        presets.push({ label: `📅 August 2026 Window (Jul 28 – Aug 24)`, value: Math.max(0, obsDates.length - 72) });
    }
    if (obsDates.length >= 100) {
        presets.push({ label: `📅 July 2026 Window (Jun 28 – Jul 25)`, value: Math.max(0, obsDates.length - 102) });
    }
    presets.push({ label: `⏮ Season Start (June 2026)`, value: 0 });

    // 1. Interactive Season Timeline Navigation Bar (Reference: GFS North America Dashboard)
    let navBarHtml = `
        <div class="timeline-nav-bar">
            <div class="timeline-nav-left">
                <span class="timeline-title">⏱️ Season Timeline:</span>
                <button class="time-btn" onclick="shiftDailyWindowTo(0)" title="Jump to Season Onset (June 2026)">⏮ Jun (Onset)</button>
                <button class="time-btn" onclick="shiftDailyWindowDays(-14)" title="Step back 14 days">◀◀ -14D</button>
                <button class="time-btn" onclick="shiftDailyWindowDays(-7)" title="Step back 7 days">◀ -7D</button>
                
                <div class="timeline-slider-wrap">
                    <input type="range" id="daily-timeline-slider" min="0" max="${maxForwardIndex}" step="1" value="${dailyTimelineStartIndex}" oninput="onDailySliderChange(this.value)">
                    <div class="slider-ticks">
                        <span>Jun</span>
                        <span>Jul</span>
                        <span>Aug</span>
                        <span>Sep</span>
                        <span style="color:#38bdf8; font-weight:800;">Oct (Today)</span>
                        <span style="color:#a78bfa; font-weight:800;">Nov (28D Fcst)</span>
                    </div>
                </div>
                
                <button class="time-btn" onclick="shiftDailyWindowDays(7)" title="Step forward 7 days">+7D ▶</button>
                <button class="time-btn" onclick="shiftDailyWindowDays(14)" title="Step forward 14 days">+14D ▶▶</button>
                <button class="time-btn ${isCurrentLive ? 'active' : ''}" onclick="shiftDailyWindowTo(${defaultLiveIndex})" title="Jump to current window (14D Obs + 14D ECMWF Forecast)">⚡ Current (14D+14D)</button>
                <button class="time-btn ${isFullForward ? 'active' : ''}" onclick="shiftDailyWindowTo(${maxForwardIndex})" style="${isFullForward ? 'background:#6366f1; border-color:#818cf8; color:#fff;' : 'background:#1e1b4b; border-color:#4338ca; color:#a5b4fc;'}" title="Jump forward up to full 28-day ECMWF forecast">🔮 Forward 28D Fcst</button>
            </div>
            
            <div class="timeline-nav-right">
                <span class="window-badge" id="active-window-badge">
                    ${windowStartFormatted} – ${windowEndFormatted}, 2026 (${windowTypeLabel})
                </span>
                <select class="preset-select" id="daily-preset-select" onchange="onDailyPresetSelect(this.value)">
    `;
    presets.forEach(p => {
        const isSel = (p.value === dailyTimelineStartIndex);
        navBarHtml += `<option value="${p.value}" ${isSel ? 'selected' : ''}>${p.label}</option>`;
    });
    navBarHtml += `
                </select>
            </div>
        </div>
    `;

    // 2. Sub-scope Pills Toolbar
    let scopeToolbarHtml = `
        <div class="daily-matrix-toolbar" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; margin-bottom:12px; background:#ffffff; border:1px solid #e2e8f0; border-radius:8px; padding:8px 14px; box-shadow:0 1px 3px rgba(0,0,0,0.03);">
            <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                <span style="font-size:11px; font-weight:700; color:#475569; text-transform:uppercase; letter-spacing:0.5px;">Matrix View:</span>
                <button class="pill-btn ${isTimelineView && !isFullForward ? 'active' : ''}" onclick="setDailySubView('all')" style="${isTimelineView && !isFullForward ? 'background:#0f172a; color:#fff; font-weight:700; border-color:#0f172a;' : 'background:#fff; color:#334155; border-color:#cbd5e1; font-weight:600;'}">
                    📅 28-Day Sliding Window
                </button>
                <button class="pill-btn ${subView === 'fcst28' || (isTimelineView && isFullForward) ? 'active' : ''}" onclick="setDailySubView('fcst28')" style="${subView === 'fcst28' || (isTimelineView && isFullForward) ? 'background:#4338ca; color:#fff; font-weight:700; border-color:#4338ca;' : 'background:#f5f3ff; color:#6366f1; border-color:#c4b5fd; font-weight:600;'}">
                    🔮 Full 28-Day Forward Forecast (Next 4 Weeks)
                </button>
                <button class="pill-btn ${subView === 'obs' ? 'active' : ''}" onclick="setDailySubView('obs')" style="${subView === 'obs' ? 'background:#0f172a; color:#fff; font-weight:700; border-color:#0f172a;' : 'background:#fff; color:#334155; border-color:#cbd5e1; font-weight:600;'}">
                    🌧️ Observed (Past 14 Days)
                </button>
                <button class="pill-btn ${subView === 'fcst' ? 'active' : ''}" onclick="setDailySubView('fcst')" style="${subView === 'fcst' ? 'background:#0284c7; color:#fff; font-weight:700; border-color:#0284c7;' : 'background:#fff; color:#334155; border-color:#cbd5e1; font-weight:600;'}">
                    ⚡ Forecast (Next 14 Days ECMWF)
                </button>
            </div>
            <div style="display:flex; align-items:center; gap:8px; font-size:11px; flex-wrap:wrap;">
                <span style="background:#f1f5f9; padding:3px 8px; border-radius:4px; border:1px solid #e2e8f0; color:#334155; font-weight:600;">
                    Observed: <strong>${formatShortDate(obsDates[0])} – ${formatShortDate(todayDate)}</strong>
                </span>
                <span style="background:#eff6ff; padding:3px 8px; border-radius:4px; border:1px solid #bfdbfe; color:#1d4ed8; font-weight:600;">
                    Forecast Horizon: <strong>${formatShortDate(fcDates[0])} – ${formatShortDate(fcDates[fcDates.length - 1])} (${fcDates.length} Days)</strong>
                </span>
            </div>
        </div>
    `;

    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

    // 3. Build Table Headers
    let thead = "";
    if (isTimelineView) {
        const seg1Title = (dateMid < forecastStartDate)
            ? `🌧️ 1ST 14 DAYS (OBSERVED ECMWF IFS/ERA5) • ${formatShortDate(dateStart)} – ${formatShortDate(dateMid)}`
            : `🔮 1ST 14 DAYS (ECMWF OPERATIONAL FORECAST) • ${formatShortDate(dateStart)} – ${formatShortDate(dateMid)}`;
        
        const seg2Title = (dateSeg2Start >= forecastStartDate)
            ? ((dateSeg2Start > (fcDates[13] || "")) ? `🔮 2ND 14 DAYS (ECMWF 51-MEMBER ENSEMBLE FORECAST) • ${formatShortDate(dateSeg2Start)} – ${formatShortDate(dateEnd)}` : `🔮 2ND 14 DAYS (ECMWF OPERATIONAL FORECAST) • ${formatShortDate(dateSeg2Start)} – ${formatShortDate(dateEnd)}`)
            : `🌧️ 2ND 14 DAYS (OBSERVED ECMWF IFS/ERA5) • ${formatShortDate(dateSeg2Start)} – ${formatShortDate(dateEnd)}`;

        thead = `
            <tr>
                <th rowspan="2" style="background:#f8fafc; border-bottom:2px solid var(--border-color); vertical-align:middle; min-width:65px;">Country</th>
                <th rowspan="2" style="background:#f8fafc; border-bottom:2px solid var(--border-color); vertical-align:middle; min-width:95px;">Region / Island</th>
                <th rowspan="2" style="background:#f8fafc; border-bottom:2px solid var(--border-color); vertical-align:middle; min-width:120px; border-right:2px solid #cbd5e1;">State / Province</th>
                <th colspan="15" style="text-align:center; background:#0f172a; color:#f8fafc; font-size:10.5px; font-weight:700; letter-spacing:0.5px; border-right:3px solid #0284c7; padding:6px 4px;">
                    ${seg1Title}
                </th>
                <th colspan="15" style="text-align:center; background:#1e1b4b; color:#38bdf8; font-size:10.5px; font-weight:700; letter-spacing:0.5px; border-right:3px solid #0284c7; padding:6px 4px;">
                    ${seg2Title}
                </th>
                <th colspan="2" style="text-align:center; background:#064e3b; color:#a7f3d0; font-size:10.5px; font-weight:700; letter-spacing:0.5px; padding:6px 4px;">
                    📊 28D WINDOW TOTAL
                </th>
            </tr>
            <tr>
        `;

        // 1st 14 days headers
        activeDates.slice(0, 14).forEach((d, i) => {
            const parts = d.split("-");
            const dObj = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
            const dayOfWeek = dayNames[dObj.getDay()];
            let tag = '<span class="obs-tag">OBS</span>';
            let colBg = '';
            if (d === todayDate) {
                tag = '<span class="today-tag">TODAY</span>';
                colBg = 'background:#f0fdf4;';
            } else if (d >= forecastStartDate) {
                tag = (d <= (fcDates[13] || "")) ? '<span class="fcst-tag">HRES</span>' : '<span class="fcst28-tag">ENS 51</span>';
                colBg = 'background:#f0f9ff;';
            }
            thead += `
                <th class="day-head" style="${colBg}" title="${d} (${d < forecastStartDate ? 'Observed' : 'Forecast'})">
                    <div class="day-name">${dayOfWeek}</div>
                    <div class="day-date">${parts[2]}/${parts[1]}</div>
                    ${tag}
                </th>
            `;
        });
        thead += `<th style="text-align:center; font-size:10px; font-weight:800; background:#f1f5f9; color:#0f172a; border-right:3px solid #0284c7; min-width:50px;" title="1st 14-Day Average (mm/day)">1st 14D Avg</th>`;

        // 2nd 14 days headers
        activeDates.slice(14, 28).forEach((d, i) => {
            const parts = d.split("-");
            const dObj = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
            const dayOfWeek = dayNames[dObj.getDay()];
            let tag = '<span class="obs-tag">OBS</span>';
            let colBg = '';
            if (d === todayDate) {
                tag = '<span class="today-tag">TODAY</span>';
                colBg = 'background:#f0fdf4;';
            } else if (d >= forecastStartDate) {
                tag = (d <= (fcDates[13] || "")) ? '<span class="fcst-tag">HRES</span>' : '<span class="fcst28-tag">ENS 51</span>';
                colBg = (d <= (fcDates[13] || "")) ? 'background:#f0f9ff;' : 'background:#faf5ff;';
            }
            thead += `
                <th class="day-head" style="${colBg}" title="${d} (${d < forecastStartDate ? 'Observed' : 'Forecast'})">
                    <div class="day-name">${dayOfWeek}</div>
                    <div class="day-date">${parts[2]}/${parts[1]}</div>
                    ${tag}
                </th>
            `;
        });
        thead += `<th style="text-align:center; font-size:10px; font-weight:800; background:#e0f2fe; color:#0369a1; border-right:3px solid #0284c7; min-width:50px;" title="2nd 14-Day Average (mm/day)">2nd 14D Avg</th>`;

        // 28D Full Summary Headers
        thead += `
            <th style="text-align:center; font-size:10px; font-weight:800; background:#ecfdf5; color:#047857; min-width:52px;" title="28-Day Window Daily Average (mm/day)">28D Avg</th>
            <th style="text-align:center; font-size:10px; font-weight:800; background:#d1fae5; color:#065f46; min-width:56px;" title="28-Day Window Cumulative Total (mm)">28D Total</th>
            </tr>
        `;

    } else if (subView === "obs") {
        const last14ObsDates = obsDates.slice(-14);
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
        const first14FcDates = fcDates.slice(0, 14);
        thead = `
            <tr>
                <th style="min-width:80px;">Country</th>
                <th style="min-width:105px;">Region / Island</th>
                <th style="min-width:140px;">State / Province</th>
        `;
        first14FcDates.forEach(d => {
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

    // 4. Build Table Body
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
                <td class="col-state" onclick="viewStateInMatrix('${lid}')" title="Click to view full 2010-2026 Year x Month Matrix" style="${isTimelineView ? 'border-right:2px solid #cbd5e1;' : ''}">${loc.name}</td>
        `;

        if (isTimelineView) {
            // Segment 1 (Days 0..13)
            let sumSeg1 = 0;
            let countSeg1 = 0;
            activeDates.slice(0, 14).forEach(d => {
                const val = (d < forecastStartDate) ? dailyDict[d] : forecastDict[d];
                if (val !== undefined && val !== null) {
                    sumSeg1 += val;
                    countSeg1++;
                    const c = getRainColor(val);
                    const tip = (d < forecastStartDate) ? `Observed ${d}: ${val.toFixed(1)} mm` : `🔮 Forecast ${d}: ${val.toFixed(1)} mm`;
                    const badgeClass = (d >= forecastStartDate) ? "rain-badge forecast-badge" : "rain-badge";
                    rowHtml += `
                        <td class="rain-cell">
                            <span class="${badgeClass}" style="background-color: ${c.bg}; color: ${c.text};" title="${tip}">
                                ${val.toFixed(1)}
                            </span>
                        </td>
                    `;
                } else {
                    rowHtml += `<td class="rain-cell"><span style="color:#cbd5e1;">-</span></td>`;
                }
            });

            const avgSeg1 = countSeg1 > 0 ? (sumSeg1 / countSeg1) : null;
            if (avgSeg1 !== null) {
                const ac1 = getRainColor(avgSeg1);
                rowHtml += `
                    <td class="rain-cell" style="border-right:3px solid #0284c7; background:#f8fafc;">
                        <span class="rain-badge" style="background-color: ${ac1.bg}; color: ${ac1.text}; font-weight:800;" title="1st 14D Total: ${sumSeg1.toFixed(1)} mm | Avg: ${avgSeg1.toFixed(1)} mm/day">
                            ${avgSeg1.toFixed(1)}
                        </span>
                    </td>
                `;
            } else {
                rowHtml += `<td class="rain-cell" style="border-right:3px solid #0284c7;">-</td>`;
            }

            // Segment 2 (Days 14..27)
            let sumSeg2 = 0;
            let countSeg2 = 0;
            activeDates.slice(14, 28).forEach(d => {
                const val = (d < forecastStartDate) ? dailyDict[d] : forecastDict[d];
                if (val !== undefined && val !== null) {
                    sumSeg2 += val;
                    countSeg2++;
                    const c = getRainColor(val);
                    const isEns = (d > (fcDates[13] || ""));
                    const tip = (d < forecastStartDate) ? `Observed ${d}: ${val.toFixed(1)} mm` : (isEns ? `🔮 SEAS5 Ensemble ${d}: ${val.toFixed(1)} mm` : `🔮 HRES Forecast ${d}: ${val.toFixed(1)} mm`);
                    const badgeClass = (d >= forecastStartDate) ? "rain-badge forecast-badge" : "rain-badge";
                    rowHtml += `
                        <td class="rain-cell">
                            <span class="${badgeClass}" style="background-color: ${c.bg}; color: ${c.text};" title="${tip}">
                                ${val.toFixed(1)}
                            </span>
                        </td>
                    `;
                } else {
                    rowHtml += `<td class="rain-cell"><span style="color:#cbd5e1;">-</span></td>`;
                }
            });

            const avgSeg2 = countSeg2 > 0 ? (sumSeg2 / countSeg2) : null;
            if (avgSeg2 !== null) {
                const ac2 = getRainColor(avgSeg2);
                rowHtml += `
                    <td class="rain-cell" style="border-right:3px solid #0284c7; background:#eff6ff;">
                        <span class="rain-badge" style="background-color: ${ac2.bg}; color: ${ac2.text}; font-weight:800;" title="2nd 14D Total: ${sumSeg2.toFixed(1)} mm | Avg: ${avgSeg2.toFixed(1)} mm/day">
                            ${avgSeg2.toFixed(1)}
                        </span>
                    </td>
                `;
            } else {
                rowHtml += `<td class="rain-cell" style="border-right:3px solid #0284c7;">-</td>`;
            }

            // Full 28D Window Summary
            const tot28 = sumSeg1 + sumSeg2;
            const count28 = countSeg1 + countSeg2;
            const avg28 = count28 > 0 ? (tot28 / count28) : null;
            if (avg28 !== null) {
                const acTot = getRainColor(avg28);
                rowHtml += `
                    <td class="rain-cell" style="background:#ecfdf5;">
                        <span class="rain-badge" style="background-color: ${acTot.bg}; color: ${acTot.text}; font-weight:900;" title="28-Day Window Avg: ${avg28.toFixed(1)} mm/day">
                            ${avg28.toFixed(1)}
                        </span>
                    </td>
                    <td class="rain-cell" style="background:#f0fdf4; font-weight:800; color:#065f46; font-size:11.5px;" title="28-Day Window Cumulative Total: ${tot28.toFixed(1)} mm">
                        ${Math.round(tot28)}mm
                    </td>
                `;
            } else {
                rowHtml += `<td class="rain-cell">-</td><td class="rain-cell">-</td>`;
            }

        } else if (subView === "obs") {
            const last14ObsDates = obsDates.slice(-14);
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
            const first14FcDates = fcDates.slice(0, 14);
            let sumFcst = 0;
            let countFcst = 0;
            first14FcDates.forEach(d => {
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
            ${navBarHtml}
            ${scopeToolbarHtml}
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
                const tip = `${wData.date_label}: ${avg.toFixed(1)} mm/day (${Math.round(wData.total_mm)} mm)`;
                rowHtml += `
                    <td class="rain-cell">
                        <span class="rain-badge" style="background-color: ${c.bg}; color: ${c.text};" title="${tip}">
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
                const isFcst = mInfo.is_forecast || (y === 2026 && m >= 10) || (y === 2027 && m <= 3);
                const subLabel = isFcst ? "Forecast" : `${Math.round(mInfo.total_mm)}mm`;
                const squareClass = isFcst ? "matrix-square-cell forecast-square" : "matrix-square-cell";
                const tip = isFcst ? `${monthNames[m-1]} ${y} (ECMWF SEAS5 Forecast): ${avg.toFixed(1)} mm/day (${Math.round(mInfo.total_mm)} mm in ${mInfo.days} days)` : `${monthNames[m-1]} ${y}: ${avg.toFixed(1)} mm/day (${mInfo.total_mm} mm in ${mInfo.days} days)`;
                
                let displayVal = avg.toFixed(1);
                let badgeClass = squareClass;
                let style = `background-color: ${c.bg}; color: ${c.text};`;

                if (currentFcstMetric === "anomaly") {
                    const bVal = (currentData.baseline_monthly && currentData.baseline_monthly[loc.id] && currentData.baseline_monthly[loc.id][m]) || 0;
                    if (bVal > 0) {
                        const anom = avg - bVal;
                        displayVal = (anom > 0 ? '+' : '') + anom.toFixed(1);
                        if (anom > 0.5) {
                            badgeClass = squareClass + " anomaly-surplus";
                            style = "";
                        } else if (anom < -0.5) {
                            badgeClass = squareClass + " anomaly-deficit";
                            style = "";
                        } else {
                            badgeClass = squareClass + " anomaly-normal";
                            style = "";
                        }
                    }
                }

                rowHtml += `
                    <td>
                        <div class="${badgeClass}" style="${style}" title="${tip}">
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
                const isFcst = (y === 2026 && m >= 10) || (y === 2027 && m <= 3);
                const subLabel = isFcst ? "Forecast" : "Comb";
                const squareClass = isFcst ? "matrix-square-cell forecast-square" : "matrix-square-cell";
                const tip = isFcst ? `${monthNames[m-1]} ${y} (ECMWF SEAS5 Forecast): Combined ${avg.toFixed(1)} mm/day (${selectedLocs.length} states)` : `${monthNames[m-1]} ${y}: ${avg.toFixed(1)} mm/day (${selectedLocs.length} states combined)`;
                
                let displayVal = avg.toFixed(1);
                let badgeClass = squareClass;
                let style = `background-color: ${c.bg}; color: ${c.text};`;

                if (currentFcstMetric === "anomaly") {
                    let bSum = 0; let bCount = 0;
                    selectedLocs.forEach(l => {
                        const bv = currentData.baseline_monthly && currentData.baseline_monthly[l.id] && currentData.baseline_monthly[l.id][m];
                        if (bv !== undefined) { bSum += bv; bCount++; }
                    });
                    const bVal = bCount > 0 ? (bSum / bCount) : 0;
                    if (bVal > 0) {
                        const anom = avg - bVal;
                        displayVal = (anom > 0 ? '+' : '') + anom.toFixed(1);
                        if (anom > 0.5) {
                            badgeClass = squareClass + " anomaly-surplus";
                            style = "";
                        } else if (anom < -0.5) {
                            badgeClass = squareClass + " anomaly-deficit";
                            style = "";
                        } else {
                            badgeClass = squareClass + " anomaly-normal";
                            style = "";
                        }
                    }
                }

                rowHtml += `
                    <td>
                        <div class="${badgeClass}" style="${style}" title="${tip}">
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
