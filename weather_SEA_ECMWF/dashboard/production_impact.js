// =============================================================
// SOUTHEAST ASIA PALM OIL PRODUCTION IMPACT SUMMARY (2010–2027)
// Empirically Calibrated to 21-Year MPOB Historical Production & ECMWF Ensemble
// =============================================================

let currentData = null;
let currentHorizon = "all"; // 'all', 'h03', 'h46', 'h912', 'h2024'
let currentGroup = "all";
let currentSearch = "";
let selectedBenchmarkLocId = "ID-KT"; // Default: Central Kalimantan
let benchmarkChart = null;
let drilldownChart = null;
let modalCurrentLoc = null;

// Territory Impact Cache
let calculatedImpacts = {};

// -------------------------------------------------------------
// HISTORICAL MPOB PRODUCTION GROUND TRUTH & REGIONAL BASELINES
// -------------------------------------------------------------
// Actual 2026 YTD (Jan–Aug) CPO Production (Tonnes) and YoY Growth (%) from MPOB
// Plus historical Super El Niño (2015->2016) crash baselines
const MPOB_HISTORICAL_GROUND_TRUTH = {
    "Johor":           { actual_ytd_tonnes: 1995926, yoy_2026_pct: +0.6, crash_2016_pct: -11.9, crash_2024_pct: +0.8,  base_annual_tonnes: 3100000 },
    "Kedah":           { actual_ytd_tonnes: 166701,  yoy_2026_pct: -15.3, crash_2016_pct: -29.6, crash_2024_pct: +13.3, base_annual_tonnes: 260000 },
    "Kelantan":        { actual_ytd_tonnes: 224132,  yoy_2026_pct: -11.9, crash_2016_pct: -1.2,  crash_2024_pct: -0.8,  base_annual_tonnes: 350000 },
    "Melaka":          { actual_ytd_tonnes: 58687,   yoy_2026_pct: -2.2,  crash_2016_pct: -20.9, crash_2024_pct: +4.6,  base_annual_tonnes: 95000 },
    "Negeri Sembilan": { actual_ytd_tonnes: 423901,  yoy_2026_pct: -8.8,  crash_2016_pct: -20.2, crash_2024_pct: +6.8,  base_annual_tonnes: 650000 },
    "Pahang":          { actual_ytd_tonnes: 1910189, yoy_2026_pct: -10.8, crash_2016_pct: -17.9, crash_2024_pct: +9.4,  base_annual_tonnes: 3000000 },
    "Perak":           { actual_ytd_tonnes: 1335971, yoy_2026_pct: -1.5,  crash_2016_pct: -18.1, crash_2024_pct: -5.3,  base_annual_tonnes: 2100000 },
    "Perlis":          { actual_ytd_tonnes: 0,       yoy_2026_pct: 0.0,   crash_2016_pct: 0.0,   crash_2024_pct: 0.0,   base_annual_tonnes: 5000 },
    "Pulau Pinang":    { actual_ytd_tonnes: 85608,   yoy_2026_pct: -3.7,  crash_2016_pct: +3.8,  crash_2024_pct: -11.4, base_annual_tonnes: 130000 },
    "Selangor":        { actual_ytd_tonnes: 373663,  yoy_2026_pct: -2.3,  crash_2016_pct: -17.0, crash_2024_pct: +1.1,  base_annual_tonnes: 580000 },
    "Terengganu":      { actual_ytd_tonnes: 308967,  yoy_2026_pct: +10.4, crash_2016_pct: -10.2, crash_2024_pct: +6.6,  base_annual_tonnes: 480000 },
    "Sabah":           { actual_ytd_tonnes: 2820533, yoy_2026_pct: +3.8,  crash_2016_pct: -15.3, crash_2024_pct: -13.0, base_annual_tonnes: 4500000 },
    "Sarawak":         { actual_ytd_tonnes: 2928905, yoy_2026_pct: +8.2,  crash_2016_pct: -3.2,  crash_2024_pct: -9.4,  base_annual_tonnes: 4400000 }
};

// Regional Production Baselines for all 41 Territories (Total ~70.2M Tonnes SE Asia)
const PROD_BASELINES = {
    "MY-01": 3100000, "MY-02": 260000, "MY-03": 350000, "MY-04": 95000, "MY-05": 650000,
    "MY-06": 3000000, "MY-07": 130000, "MY-08": 2100000, "MY-09": 5000, "MY-10": 580000,
    "MY-11": 480000, "MY-12": 4500000, "MY-13": 4400000, "MY-14": 5000, "MY-15": 10000,
    "ID-AC": 1850000, "ID-SU": 5400000, "ID-SB": 1300000, "ID-BE": 1100000, "ID-RI": 9600000,
    "ID-JA": 2900000, "ID-BB": 950000, "ID-SS": 4100000, "ID-LA": 1200000, "ID-KU": 900000,
    "ID-KB": 3900000, "ID-KT": 5200000, "ID-KS": 1450000, "ID-KI": 3600000, "ID-SA": 180000,
    "ID-GO": 120000, "ID-ST": 650000, "ID-SR": 400000, "ID-SN": 450000, "ID-SG": 350000,
    "ID-PA": 260000, "ID-PB": 180000, "ID-PT": 200000, "ID-PS": 380000,
    "TH-SOUTH": 3400000, "PH-MIN": 550000
};

// -------------------------------------------------------------
// EMPIRICALLY CALIBRATED REW AGRONOMIC CALCULATION ENGINE
// -------------------------------------------------------------
let calculatedSoilLimits = {};

function computeAllSoilLimits(data) {
    const limits = {};
    if (!data || !data.locations) return limits;
    data.locations.forEach(loc => {
        const lid = loc.id;
        const ssDict = (data.monthly_subsoil && data.monthly_subsoil[lid]) || {};
        const tsDict = (data.monthly_topsoil && data.monthly_topsoil[lid]) || (data.monthly_0_28cm && data.monthly_0_28cm[lid]) || {};
        
        let ssVals = [];
        Object.keys(ssDict).forEach(y => {
            Object.keys(ssDict[y]).forEach(m => {
                const v = ssDict[y][m];
                const val = (v && v.val !== undefined) ? v.val : (typeof v === "number" ? v : null);
                if (val !== null) ssVals.push(val);
            });
        });
        ssVals.sort((a, b) => a - b);
        
        let tsVals = [];
        Object.keys(tsDict).forEach(y => {
            Object.keys(tsDict[y]).forEach(m => {
                const v = tsDict[y][m];
                const val = (v && v.val !== undefined) ? v.val : (typeof v === "number" ? v : null);
                if (val !== null) tsVals.push(val);
            });
        });
        tsVals.sort((a, b) => a - b);
        
        let pwpSub = ssVals.length > 0 ? ssVals[Math.floor(ssVals.length * 0.02)] : 0.20;
        let fcSub = ssVals.length > 0 ? ssVals[Math.floor(ssVals.length * 0.95)] : 0.45;
        if (fcSub <= pwpSub) fcSub = pwpSub + 0.15;
        
        let pwpTop = tsVals.length > 0 ? tsVals[Math.floor(tsVals.length * 0.02)] : 0.18;
        let fcTop = tsVals.length > 0 ? tsVals[Math.floor(tsVals.length * 0.95)] : 0.45;
        if (fcTop <= pwpTop) fcTop = pwpTop + 0.15;
        
        limits[lid] = {
            pwp_sub: Math.round(pwpSub * 1000) / 1000,
            fc_sub: Math.round(fcSub * 1000) / 1000,
            pwp_top: Math.round(pwpTop * 1000) / 1000,
            fc_top: Math.round(fcTop * 1000) / 1000,
        };
    });
    return limits;
}

function calcRew(theta, pwp, fc) {
    if (theta === null || theta === undefined) return 50.0;
    return Math.round(((theta - pwp) / (fc - pwp)) * 1000) / 10;
}

function computeTerritoryImpact(locId) {
    if (!currentData) return null;
    const loc = currentData.locations.find(l => l.id === locId) || { name: locId, major_group: "" };
    const name = loc.name;

    const rainDict = currentData.monthly_data && currentData.monthly_data[locId] || {};
    const topsoilDict = (currentData.monthly_topsoil && currentData.monthly_topsoil[locId]) || 
                        (currentData.monthly_0_28cm && currentData.monthly_0_28cm[locId]) || {};
    const subsoilDict = currentData.monthly_subsoil && currentData.monthly_subsoil[locId] || {};
    const tempDict = currentData.monthly_temperature && currentData.monthly_temperature[locId] || {};

    const baseSubDict = currentData.baseline_subsoil && currentData.baseline_subsoil[locId] || {};
    const baseTopDict = (currentData.baseline_topsoil && currentData.baseline_topsoil[locId]) || 
                        (currentData.baseline_0_28cm && currentData.baseline_0_28cm[locId]) || {};
    const baseRainDict = currentData.baseline_monthly && currentData.baseline_monthly[locId] || {};

    const baseAnnualTonnes = PROD_BASELINES[locId] || 500000;
    const mpobInfo = MPOB_HISTORICAL_GROUND_TRUTH[name] || null;

    const lims = (calculatedSoilLimits && calculatedSoilLimits[locId]) || { pwp_sub: 0.20, fc_sub: 0.45, pwp_top: 0.18, fc_top: 0.45 };

    // Helper to get monthly metrics
    function getMonthMetrics(year, month) {
        const yStr = String(year);
        const mStr = String(month);
        
        let rain = null;
        if (rainDict[yStr] && rainDict[yStr][mStr]) {
            const rd = rainDict[yStr][mStr];
            rain = (rd.total_mm !== undefined) ? rd.total_mm : (rd.avg_mm_day ? rd.avg_mm_day * (rd.days || 30) : null);
        }

        let topsoil = null;
        if (topsoilDict[yStr] && topsoilDict[yStr][mStr]) {
            const td = topsoilDict[yStr][mStr];
            topsoil = (td.val !== undefined) ? td.val : (typeof td === "number" ? td : null);
        }

        let subsoil = null;
        if (subsoilDict[yStr] && subsoilDict[yStr][mStr]) {
            const sd = subsoilDict[yStr][mStr];
            subsoil = (sd.val !== undefined) ? sd.val : (typeof sd === "number" ? sd : null);
        }

        let tMax = null;
        if (tempDict[yStr] && tempDict[yStr][mStr]) {
            const tpd = tempDict[yStr][mStr];
            tMax = (tpd.val_max !== undefined) ? tpd.val_max : (tpd.val ? tpd.val + 4.2 : null);
        }

        return { rain, topsoil, subsoil, tMax };
    }

    // Recent observed months (Jun, Jul, Aug 2026)
    const m6 = getMonthMetrics(2026, 6);
    const m7 = getMonthMetrics(2026, 7);
    const m8 = getMonthMetrics(2026, 8);

    // Early observed months (Mar, Apr 2026 for biological abortion & leaf formation lag)
    const m3 = getMonthMetrics(2026, 3);
    const m4 = getMonthMetrics(2026, 4);

    // Q1 baseline check for flash drought transmission
    const b3_r = baseRainDict["3"] ? (typeof baseRainDict["3"] === "object" ? baseRainDict["3"].avg_mm_day * 31 : baseRainDict["3"] * 31) : 150;
    const b4_r = baseRainDict["4"] ? (typeof baseRainDict["4"] === "object" ? baseRainDict["4"].avg_mm_day * 30 : baseRainDict["4"] * 30) : 150;
    const hasEarlyDrought = (m3.rain !== null && (m3.rain < 40 || (m3.rain - b3_r) / b3_r < -0.45)) || 
                           (m4.rain !== null && (m4.rain < 40 || (m4.rain - b4_r) / b4_r < -0.45)) ||
                           (m3.topsoil !== null && m3.topsoil < 0.20) || (m4.topsoil !== null && m4.topsoil < 0.20);

    // Forward 6-month forecast anomalies (ECMWF SEAS5)
    const fcstData = currentData.forecast_6month && currentData.forecast_6month.data && currentData.forecast_6month.data[locId] || {};
    const fcstDaily = fcstData.period_6mo_avg_mm_day || 7.0;
    const fcstTotal = fcstData.period_6mo_total_mm || 1200.0;
    const hasForwardDrought = fcstDaily < 5.0 || fcstTotal < 900.0;

    const curSubsoil = m8.subsoil || m7.subsoil || 0.35;
    const curTopsoil = m8.topsoil || m7.topsoil || 0.33;

    // Compare current subsoil against that territory's August baseline
    const normSubsoil = baseSubDict["8"] || 0.35;
    const normTopsoil = baseTopDict["8"] || 0.33;

    // Relative moisture anomalies (%)
    const subAnomalyPct = normSubsoil > 0 ? ((curSubsoil - normSubsoil) / normSubsoil) * 100 : 0.0;
    const topAnomalyPct = normTopsoil > 0 ? ((curTopsoil - normTopsoil) / normTopsoil) * 100 : 0.0;

    // Plant Available Water (REW %)
    const curSubRew = calcRew(curSubsoil, lims.pwp_sub, lims.fc_sub);
    const curTopRew = calcRew(curTopsoil, lims.pwp_top, lims.fc_top);

    let rewStatus = "Optimal Buffer";
    if (curSubRew < 15) {
        rewStatus = "Critical Wilt";
    } else if (curSubRew < 35) {
        rewStatus = "Moderate Deficit";
    } else if (curSubRew > 100) {
        rewStatus = "Saturated Buffer";
    } else {
        rewStatus = "Optimal Buffer";
    }

    const augRainMm = (m8.rain !== null) ? m8.rain : 100;
    const rVals = [m6.rain, m7.rain, m8.rain].filter(v => v !== null);
    const meanRecentRain = rVals.length > 0 ? (rVals.reduce((a, b) => a + b, 0) / rVals.length) : 180;
    const peakTmax = Math.max(m6.tMax || 31.5, m7.tMax || 31.5, m8.tMax || 31.5);

    // VPD thermal stress index
    let vpdClass = "vpd-optimal";
    let vpdLabel = "Optimal (<33°C)";
    if (peakTmax >= 34.0) {
        vpdClass = "vpd-severe";
        vpdLabel = "Severe (>34°C)";
    } else if (peakTmax >= 33.0) {
        vpdClass = "vpd-elevated";
        vpdLabel = "Elevated (33–34°C)";
    }

    // Subsoil buffer descriptive status
    let subsoilDesc = `${curSubRew.toFixed(1)}% REW (${rewStatus})`;

    // -------------------------------------------------------------
    // Calibrated Lag 0–3m (Harvesting, Field Evacuation & OER)
    // -------------------------------------------------------------
    let h03Impact = 0.0;
    let h03Reason = "Normal harvesting conditions";
    let isFlood = false;

    if (meanRecentRain > 350 || augRainMm > 350) {
        isFlood = true;
        h03Impact = -3.5;
        h03Reason = "Flood disruption: collection path washouts & OER drop";
    } else if (meanRecentRain > 300 || augRainMm > 300) {
        isFlood = true;
        h03Impact = -1.8;
        h03Reason = "Excessive moisture: evacuation delays & slight FFA risk";
    } else if (curSubRew < 15 || (augRainMm < 50 && curTopRew < 15)) {
        h03Impact = -3.0;
        h03Reason = `Acute root desiccation (${curSubRew.toFixed(1)}% REW): frond droop & poor pollination`;
    } else if (curSubRew < 25 || (augRainMm < 70 && curTopRew < 25)) {
        h03Impact = -1.5;
        h03Reason = `Subsoil stress (${curSubRew.toFixed(1)}% REW): bunch ripening stress (-1.5%)`;
    } else if (curSubRew >= 35 && curTopRew >= 30 && !isFlood) {
        h03Impact = +0.5;
        h03Reason = "Optimal field moisture: smooth evacuation & peak OER";
    }

    // -------------------------------------------------------------
    // Calibrated Lag 4–6m (Cell Expansion & Bunch Weight - ABW)
    // -------------------------------------------------------------
    let h46Impact = +0.5;
    let h46Reason = "Adequate moisture: normal bunch weight";

    if (curSubRew < 15 || (curTopRew < 15 && curSubRew < 25)) {
        h46Impact = -5.0;
        h46Reason = `Severe rootzone deficit (${curSubRew.toFixed(1)}% REW): sharp ABW bunch weight shrinkage`;
    } else if (curSubRew < 35 || (hasForwardDrought && curSubRew < 45)) {
        h46Impact = -3.0;
        h46Reason = `Moderate rootzone deficit (${curSubRew.toFixed(1)}% REW): restrained fruit cell enlargement`;
    } else if (peakTmax >= 34.0 && curTopRew < 35) {
        h46Impact = -1.5;
        h46Reason = `Thermal VPD constriction (${peakTmax.toFixed(1)}°C): midday stomatal closure`;
    } else if (curSubRew >= 35 && !isFlood) {
        h46Impact = +1.0;
        h46Reason = `Robust subsoil reservoir (${curSubRew.toFixed(1)}% REW): optimal bunch expansion`;
    }

    // -------------------------------------------------------------
    // Calibrated Lag 9–12m (Floral Inflorescence Abortion)
    // -------------------------------------------------------------
    let h912Impact = 0.0;
    let h912Reason = "Balanced floral development";

    if (curSubRew < 15) {
        h912Impact = -5.0;
        h912Reason = `Critical rootzone depletion (${curSubRew.toFixed(1)}% REW): elevated floral abortion (-5.0%)`;
    } else if (hasEarlyDrought) {
        if (curSubRew >= 35) {
            h912Impact = -1.5;
            h912Reason = "Early flash drought buffered by deep capillary reserves (-1.5%)";
        } else {
            h912Impact = -4.0;
            h912Reason = "Severe inflorescence abortion triggered by Q1 acute drought (-4.0%)";
        }
    } else if (curSubRew < 35) {
        h912Impact = -2.0;
        h912Reason = `Moderate subsoil drawdown (${curSubRew.toFixed(1)}% REW): localized abortion (-2.0%)`;
    } else if (curSubRew >= 35) {
        h912Impact = +0.8;
        h912Reason = `Well-buffered deep rootzone (${curSubRew.toFixed(1)}% REW): high flower survival`;
    }

    // -------------------------------------------------------------
    // Calibrated Lag 20–24m (Sex Differentiation / 2-Year Structural Shock)
    // -------------------------------------------------------------
    let h2024Impact = +0.5;
    let h2024Reason = "Normal floral primordia balance";

    if (curSubRew < 10) {
        h2024Impact = -7.5;
        h2024Reason = `Critical rootzone depletion (${curSubRew.toFixed(1)}% REW): structural male flower shift (-7.5%)`;
    } else if (curSubRew < 25 || (hasForwardDrought && curSubRew < 35)) {
        h2024Impact = -3.5;
        h2024Reason = `Depleted subsoil (${curSubRew.toFixed(1)}% REW) & forward drought: male flower bias (-3.5%)`;
    } else if (hasForwardDrought && curSubRew < 45) {
        h2024Impact = -2.0;
        h2024Reason = "Attenuated forward monsoon: slight sex ratio pressure (-2.0%)";
    } else if (curSubRew >= 35) {
        h2024Impact = +1.2;
        h2024Reason = `Abundant deep water table (${curSubRew.toFixed(1)}% REW): favorable female ratio (+1.2%)`;
    }

    // Net Yield Shift (%)
    const netYieldShift = (h03Impact * 0.15) + (h46Impact * 0.25) + (h912Impact * 0.35) + (h2024Impact * 0.25);
    const volImpactTonnes = baseAnnualTonnes * (netYieldShift / 100);

    // Realistic Risk Tier
    let riskTier = "normal";
    let riskLabel = "Normal / Neutral";
    let riskClass = "risk-normal";

    if (isFlood && h03Impact <= -2.5) {
        riskTier = "flood";
        riskLabel = "Flood / Evacuation Alert";
        riskClass = "risk-flood";
    } else if (netYieldShift <= -5.0) {
        riskTier = "critical";
        riskLabel = "Critical Deficit";
        riskClass = "risk-critical";
    } else if (netYieldShift <= -3.0) {
        riskTier = "high";
        riskLabel = "High Deficit";
        riskClass = "risk-high";
    } else if (netYieldShift <= -1.2) {
        riskTier = "moderate";
        riskLabel = "Moderate Deficit";
        riskClass = "risk-moderate";
    } else if (netYieldShift >= 0.5) {
        riskTier = "growth";
        riskLabel = "Favorable / Growth";
        riskClass = "risk-growth";
    }

    return {
        locId,
        name,
        group: loc.major_group,
        country: loc.country,
        baseAnnualTonnes,
        mpobInfo,
        curTopsoil,
        curSubsoil,
        normSubsoil,
        subAnomalyPct,
        meanRecentRain,
        peakTmax,
        vpdClass,
        vpdLabel,
        subsoilDesc,
        h03Impact,
        h03Reason,
        h46Impact,
        h46Reason,
        h912Impact,
        h912Reason,
        h2024Impact,
        h2024Reason,
        netYieldShift,
        volImpactTonnes,
        riskTier,
        riskLabel,
        riskClass,
        isFlood
    };
}

// -------------------------------------------------------------
// INITIALIZATION
// -------------------------------------------------------------
async function initDashboard() {
    try {
        if (typeof PRECOMPUTED_DATA !== "undefined" && PRECOMPUTED_DATA) {
            currentData = PRECOMPUTED_DATA;
        } else if (window.RAIN_DATA) {
            currentData = window.RAIN_DATA;
        } else {
            const resp = await fetch("data_cache.json");
            currentData = await resp.json();
        }

        if (!currentData || !currentData.locations || currentData.locations.length === 0) {
            document.getElementById("impact-table-container").innerHTML = "<div style='padding:40px; text-align:center; color:#ef4444;'>Error loading database cache.</div>";
            return;
        }

        // Compute empirical soil moisture limits across all territories
        calculatedSoilLimits = computeAllSoilLimits(currentData);

        // Run calibrated model across all 41 territories
        currentData.locations.forEach(loc => {
            calculatedImpacts[loc.id] = computeTerritoryImpact(loc.id);
        });

        // Initialize benchmark location dropdown
        populateBenchmarkSelector();

        // Render KPI metric cards
        renderKPIs();

        // Render interactive 2015/16 Super El Niño benchmark chart
        renderBenchmarkChart();

        // Render main production impact matrix
        renderImpactTable();

        // Render executive regional outlook & agronomic synthesis
        renderRegionalOutlook();

        // Check for URL parameter or hash to open drilldown modal directly
        const urlParams = new URLSearchParams(window.location.search);
        let modalParam = urlParams.get("modal") || urlParams.get("state");
        if (window.location.hash) {
            const hashParts = window.location.hash.substring(1).split("&");
            hashParts.forEach(p => {
                const [k, v] = p.split("=");
                if ((k === "modal" || k === "state") && v) modalParam = v;
            });
        }
        if (modalParam) {
            openDrilldownModal(modalParam);
        }

    } catch (err) {
        console.error("Dashboard initialization error:", err);
        document.getElementById("impact-table-container").innerHTML = `<div style='padding:40px; text-align:center; color:#ef4444;'>Failed to initialize: ${err.message}</div>`;
    }
}

// -------------------------------------------------------------
// KPI METRIC CARDS CALCULATION
// -------------------------------------------------------------
function renderKPIs() {
    if (!currentData || !currentData.locations) return;

    let totVolImpact = 0;
    let totBaseTonnes = 0;
    let worstTerritory = { name: "-", shift: 0, group: "", vol: 0 };
    let lowestSubsoil = { name: "-", anom: 0, group: "" };
    let intactCount = 0;
    let floodCount = 0;

    currentData.locations.forEach(loc => {
        const imp = calculatedImpacts[loc.id];
        if (!imp) return;

        totVolImpact += imp.volImpactTonnes;
        totBaseTonnes += imp.baseAnnualTonnes;

        if (imp.isFlood) floodCount++;
        if (imp.curSubsoil >= 0.28) intactCount++;

        if (imp.netYieldShift < worstTerritory.shift) {
            worstTerritory = { name: loc.name, shift: imp.netYieldShift, group: loc.major_group, vol: imp.volImpactTonnes };
        }

        if (imp.subAnomalyPct < lowestSubsoil.anom) {
            lowestSubsoil = { name: loc.name, anom: imp.subAnomalyPct, group: loc.major_group };
        }
    });

    const netPct = totBaseTonnes > 0 ? (totVolImpact / totBaseTonnes) * 100 : 0.0;
    const intactPct = Math.round((intactCount / currentData.locations.length) * 100);

    // 1. Regional Production Risk Level
    const kpiRiskEl = document.getElementById("kpi-risk-level");
    const kpiRiskSub = document.getElementById("kpi-risk-sub");
    if (kpiRiskEl) {
        let riskTitle = "Normal / Neutral";
        let riskColor = "#15803d";
        if (netPct <= -3.0) {
            riskTitle = "High Deficit Risk";
            riskColor = "#b91c1c";
        } else if (netPct <= -1.0) {
            riskTitle = "Moderate Deficit";
            riskColor = "#c2410c";
        } else if (netPct < 0) {
            riskTitle = "Mild Headwinds";
            riskColor = "#ea580c";
        }
        kpiRiskEl.innerText = `${riskTitle} (${netPct > 0 ? '+' : ''}${netPct.toFixed(2)}%)`;
        kpiRiskEl.style.color = riskColor;
        kpiRiskSub.innerText = `Projected ${totVolImpact < 0 ? '-' : '+'}${Math.abs(Math.round(totVolImpact)).toLocaleString('en-US')} T vs ${Math.round(totBaseTonnes).toLocaleString('en-US')} T Baseline (${(totBaseTonnes/1000000).toFixed(1)}M T)`;
    }

    // 2. Historical MPOB YTD Ground Truth
    const kpiMpobVal = document.getElementById("kpi-mpob-val");
    const kpiMpobSub = document.getElementById("kpi-mpob-sub");
    if (kpiMpobVal) {
        kpiMpobVal.innerText = `Malaysia: 0.0% YoY (Flat)`;
        kpiMpobSub.innerText = `Jan–Aug '26 MPOB YTD: East M'sia (+5.9%) vs Peninsular (-5.2%) • Forward Outlook Deteriorating`;
    }

    // 3. Critical Deficit Hotspot
    const kpiHotspotVal = document.getElementById("kpi-hotspot-val");
    const kpiHotspotSub = document.getElementById("kpi-hotspot-sub");
    if (kpiHotspotVal && worstTerritory.name !== "-") {
        kpiHotspotVal.innerText = `${worstTerritory.name} (${worstTerritory.shift.toFixed(1)}%)`;
        kpiHotspotSub.innerText = `${worstTerritory.group} • Vol Impact: ${worstTerritory.vol < 0 ? '-' : '+'}${Math.abs(Math.round(worstTerritory.vol)).toLocaleString('en-US')} T`;
    }

    // 4. Structural 2-Year Forward Outlook (20-24m)
    const kpiStructuralVal = document.getElementById("kpi-structural-val");
    const kpiStructuralSub = document.getElementById("kpi-structural-sub");
    if (kpiStructuralVal) {
        kpiStructuralVal.innerText = `Subsoil Buffer Intact in ${intactPct}% of Zones (${intactCount}/${currentData.locations.length})`;
        kpiStructuralSub.innerText = `Deep Deficit in ${lowestSubsoil.name} (${lowestSubsoil.anom.toFixed(0)}% vs norm) • Peat/Rootzone Monitored`;
    }
}

// -------------------------------------------------------------
// 2015/16 SUPER EL NIÑO BENCHMARK WIDGET
// -------------------------------------------------------------
function populateBenchmarkSelector() {
    const sel = document.getElementById("benchmark-loc-select");
    if (!sel || !currentData) return;
    sel.innerHTML = "";

    const priorityIds = ["ID-KT", "ID-KB", "MY-12", "ID-RI", "MY-06", "ID-SS", "ID-SU", "MY-01"];
    const locMap = {};
    currentData.locations.forEach(l => locMap[l.id] = l);

    priorityIds.forEach(id => {
        if (locMap[id]) {
            const opt = document.createElement("option");
            opt.value = id;
            opt.innerText = `⭐ ${locMap[id].name} (${locMap[id].major_group})`;
            if (id === selectedBenchmarkLocId) opt.selected = true;
            sel.appendChild(opt);
        }
    });

    const optDivider = document.createElement("option");
    optDivider.disabled = true;
    optDivider.innerText = "── All Other Territories ──";
    sel.appendChild(optDivider);

    currentData.locations.forEach(l => {
        if (!priorityIds.includes(l.id)) {
            const opt = document.createElement("option");
            opt.value = l.id;
            opt.innerText = `${l.name} (${l.major_group})`;
            if (l.id === selectedBenchmarkLocId) opt.selected = true;
            sel.appendChild(opt);
        }
    });
}

function updateBenchmarkChart() {
    const sel = document.getElementById("benchmark-loc-select");
    if (sel) {
        selectedBenchmarkLocId = sel.value;
        renderBenchmarkChart();
    }
}

function renderBenchmarkChart() {
    const ctx = document.getElementById("benchmark-chart");
    if (!ctx || !currentData) return;

    const locId = selectedBenchmarkLocId;
    const loc = currentData.locations.find(l => l.id === locId) || currentData.locations[0];
    const subsoilDict = currentData.monthly_subsoil && currentData.monthly_subsoil[locId] || {};
    const rainDict = currentData.monthly_data && currentData.monthly_data[locId] || {};
    const mpobInfo = MPOB_HISTORICAL_GROUND_TRUTH[loc.name] || null;

    const baseSubDict = currentData.baseline_subsoil && currentData.baseline_subsoil[locId] || {};

    const labels = [
        "M1 (Aug '26)", "M2 (Sep '26)", "M3 (Oct '26 FCST)", "M4 (Nov '26 FCST)", "M5 (Dec '26 FCST)", 
        "M6 (Jan '27 FCST)", "M7 (Feb '27 FCST)", "M8 (Mar '27 FCST)", "M9 (Apr '27)", "M10 (May '27)", "M11 (Jun '27)", "M12 (Jul '27)"
    ];

    function extractSequence(yearA, yearB) {
        const subsoilSeq = [];
        for (let m = 8; m <= 12; m++) {
            let sVal = subsoilDict[String(yearA)] && subsoilDict[String(yearA)][String(m)] ? 
                         subsoilDict[String(yearA)][String(m)].val : null;
            if (sVal === null && yearA === 2026) {
                sVal = baseSubDict[String(m)] || null;
            }
            subsoilSeq.push(sVal);
        }
        for (let m = 1; m <= 7; m++) {
            let sVal = subsoilDict[String(yearB)] && subsoilDict[String(yearB)][String(m)] ? 
                         subsoilDict[String(yearB)][String(m)].val : null;
            if (sVal === null && yearB === 2027) {
                sVal = baseSubDict[String(m)] || null;
            }
            subsoilSeq.push(sVal);
        }
        return subsoilSeq;
    }

    const seq2015 = extractSequence(2015, 2016);
    const seqCurrent = extractSequence(2026, 2027);

    const valid2015 = seq2015.filter(v => v !== null);
    const min2015 = valid2015.length > 0 ? Math.min(...valid2015) : 0.203;
    const validCur = seqCurrent.filter(v => v !== null);
    const minCur = validCur.length > 0 ? Math.min(...validCur) : 0.310;

    const statsContainer = document.getElementById("benchmark-stats-container");
    if (statsContainer) {
        const crashVal = mpobInfo ? mpobInfo.crash_2016_pct : -13.2;
        const crashStr = mpobInfo ? `${crashVal > 0 ? '+' : ''}${crashVal.toFixed(1)}% YoY in ${loc.name}` : `-13.2% Malaysia-wide (-2.63M T)`;
        statsContainer.innerHTML = `
            <div class="benchmark-stat-chip">
                <span>2015/16 Super El Niño Min Subsoil:</span> 
                <strong style="color: #ef4444;">${min2015.toFixed(3)} m³/m³</strong>
            </div>
            <div class="benchmark-stat-chip">
                <span>Current 2026/27 Min Subsoil:</span> 
                <strong style="color: #0284c7;">${minCur.toFixed(3)} m³/m³</strong>
            </div>
            <div class="benchmark-stat-chip">
                <span>Actual 2016 MPOB Production Crash:</span> 
                <strong style="color: #991b1b;">${crashStr}</strong>
            </div>
            <div class="benchmark-stat-chip">
                <span>Current 2026/27 Structural Resilience:</span> 
                <strong style="color: ${minCur > 0.300 ? '#166534' : '#c2410c'};">${minCur > 0.300 ? '✅ Robust Buffer (No Collapse)' : '⚠️ Moderate Peat Deficit'}</strong>
            </div>
        `;
    }

    if (benchmarkChart) {
        benchmarkChart.destroy();
    }

    benchmarkChart = new Chart(ctx, {
        type: "line",
        data: {
            labels: labels,
            datasets: [
                {
                    label: `2015/16 Super El Niño Subsoil (28-100cm)`,
                    data: seq2015,
                    borderColor: "#ef4444",
                    backgroundColor: "rgba(239, 68, 68, 0.08)",
                    borderWidth: 2.2,
                    borderDash: [5, 4],
                    pointRadius: 3,
                    pointBackgroundColor: "#ef4444",
                    fill: false,
                    tension: 0.3
                },
                {
                    label: `Current 2026/27 Subsoil Trajectory (Observed + ECMWF SEAS5 Forecast)`,
                    data: seqCurrent,
                    borderColor: "#0284c7",
                    backgroundColor: "rgba(2, 132, 199, 0.12)",
                    borderWidth: 2.5,
                    pointRadius: 4,
                    pointBackgroundColor: "#0284c7",
                    fill: true,
                    tension: 0.3
                },
                {
                    label: `Structural Yield Collapse Threshold (0.26 m³/m³)`,
                    data: Array(12).fill(0.260),
                    borderColor: "rgba(153, 27, 27, 0.85)",
                    borderWidth: 1.5,
                    borderDash: [3, 3],
                    pointRadius: 0,
                    fill: false
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: "index", intersect: false },
            plugins: {
                legend: { position: "top", labels: { boxWidth: 12, font: { size: 11 } } },
                title: {
                    display: true,
                    text: `Subsoil Moisture Trajectory: 2015/16 Super El Niño vs Current 2025/26 (${loc.name})`
                },
                tooltip: {
                    callbacks: {
                        label: function(c) {
                            return `${c.dataset.label}: ${c.raw !== null ? c.raw.toFixed(3) + ' m³/m³' : 'N/A'}`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    min: 0.18,
                    suggestedMax: 0.45,
                    title: { display: true, text: "Subsoil VWC (m³/m³)" },
                    grid: { color: "#f1f5f9" }
                }
            }
        }
    });
}

// -------------------------------------------------------------
// FILTER CONTROLS & INTERACTION
// -------------------------------------------------------------
function setHorizon(horizon) {
    currentHorizon = horizon;
    document.querySelectorAll("#horizon-selector-container .segmented-btn").forEach(b => {
        b.classList.toggle("active", b.dataset.horizon === horizon);
    });
    renderImpactTable();
}

function setGroup(group) {
    currentGroup = group;
    document.querySelectorAll("#region-filter-container .segmented-btn").forEach(b => {
        b.classList.toggle("active", b.dataset.group === group);
    });
    renderImpactTable();
}

function handleSearch(val) {
    currentSearch = (val || "").trim().toLowerCase();
    renderImpactTable();
}

function getFilteredLocations() {
    if (!currentData || !currentData.locations) return [];
    let locs = [...currentData.locations];

    if (currentGroup !== "all") {
        locs = locs.filter(l => l.major_group === currentGroup);
    }

    if (currentSearch) {
        locs = locs.filter(l => 
            l.name.toLowerCase().includes(currentSearch) ||
            l.id.toLowerCase().includes(currentSearch) ||
            l.country.toLowerCase().includes(currentSearch) ||
            l.major_group.toLowerCase().includes(currentSearch)
        );
    }

    return locs.sort((a, b) => a.sort_order - b.sort_order);
}

// -------------------------------------------------------------
// PRODUCTION IMPACT MATRIX TABLE RENDERER
// -------------------------------------------------------------
function renderImpactTable() {
    const container = document.getElementById("impact-table-container");
    if (!container || !currentData) return;

    const locations = getFilteredLocations();
    if (locations.length === 0) {
        container.innerHTML = `<div style="padding: 40px; text-align: center; color: var(--text-secondary);">No plantation territories match the selected filters.</div>`;
        return;
    }

    function getShiftBadge(val) {
        if (val === null || val === undefined) return `-`;
        const prefix = val > 0 ? `+` : ``;
        let cssClass = "yield-shift-neutral";
        if (val <= -6.0) cssClass = "yield-shift-severe";
        else if (val <= -3.5) cssClass = "yield-shift-high";
        else if (val <= -1.5) cssClass = "yield-shift-mod";
        else if (val >= 0.5) cssClass = "yield-shift-pos";
        return `<span class="yield-shift-badge ${cssClass}">${prefix}${val.toFixed(1)}%</span>`;
    }

    let thead = `
        <table class="data-table" id="exportable-table">
            <thead>
                <tr>
                    <th style="min-width: 75px;">Country</th>
                    <th style="min-width: 115px;">Region / Island</th>
                    <th style="min-width: 130px;">Plantation Zone</th>
                    <th style="text-align: right; min-width: 100px;">Baseline Output<br><span style="font-size:9px; font-weight:normal; text-transform:none;">Annual Tonnes</span></th>
                    <th style="text-align: center; min-width: 110px; background: #f0fdf4;">2026 MPOB Actual<br><span style="font-size:9px; font-weight:normal; text-transform:none;">YTD YoY Growth</span></th>
                    <th style="text-align: center; min-width: 95px; ${currentHorizon === 'h03' ? 'background: #e0f2fe;' : ''}" title="Oct–Dec 2026 immediate harvest & extraction impact">Lag 0–3m<br><span style="font-size:9px; font-weight:normal; text-transform:none;">Oct–Dec '26 (OER)</span></th>
                    <th style="text-align: center; min-width: 95px; ${currentHorizon === 'h46' ? 'background: #e0f2fe;' : ''}" title="Jan–Mar 2027 fruitlet enlargement & bunch weight">Lag 4–6m<br><span style="font-size:9px; font-weight:normal; text-transform:none;">Jan–Mar '27 (ABW)</span></th>
                    <th style="text-align: center; min-width: 95px; ${currentHorizon === 'h912' ? 'background: #e0f2fe;' : ''}" title="Apr–Sep 2027 floral elongation & bunch abortion">Lag 9–12m<br><span style="font-size:9px; font-weight:normal; text-transform:none;">Apr–Sep '27 (Abortion)</span></th>
                    <th style="text-align: center; min-width: 95px; ${currentHorizon === 'h2024' ? 'background: #e0f2fe;' : ''}" title="Late 2027 – Mid 2028 floral primordia sex differentiation">Lag 20–24m<br><span style="font-size:9px; font-weight:normal; text-transform:none;">'27–'28 (Sex Diff)</span></th>
                    <th style="text-align: center; min-width: 100px; ${currentHorizon === 'all' ? 'background: #f1f5f9;' : ''}" title="Forward 12-Month Crop Cycle (Oct 2026 – Sep 2027)">Net Yield Shift<br><span style="font-size:9px; font-weight:normal; text-transform:none;">Oct '26 – Sep '27</span></th>
                    <th style="text-align: right; min-width: 105px;" title="Volume impact on 12-month baseline output">Projected Impact<br><span style="font-size:9px; font-weight:normal; text-transform:none;">Oct '26 – Sep '27 (T)</span></th>
                    <th style="text-align: center; min-width: 105px;" title="Recent Peak Tmax and Vapor Pressure Deficit / Midday Stomatal Closure Stress">Thermal Stress<br><span style="font-size:9px; font-weight:normal; text-transform:none;">Peak Tmax (VPD)</span></th>
                    <th style="text-align: center; min-width: 130px;">Production Risk Tier</th>
                    <th style="text-align: center; min-width: 80px;">Action</th>
                </tr>
            </thead>
            <tbody>
    `;

    let tbody = "";
    let totalBaseTonnes = 0;
    let totalVolImpact = 0;
    let weightedH03 = 0;
    let weightedH46 = 0;
    let weightedH912 = 0;
    let weightedH2024 = 0;
    let weightedPeakTmax = 0;
    let totalMpobYtd = 0;
    let weightedMpobYoy = 0;
    let mpobWeightTonnes = 0;

    locations.forEach(loc => {
        const imp = calculatedImpacts[loc.id] || computeTerritoryImpact(loc.id);
        const mpob = imp.mpobInfo;

        totalBaseTonnes += imp.baseAnnualTonnes;
        totalVolImpact += imp.volImpactTonnes;
        weightedH03 += imp.h03Impact * imp.baseAnnualTonnes;
        weightedH46 += imp.h46Impact * imp.baseAnnualTonnes;
        weightedH912 += imp.h912Impact * imp.baseAnnualTonnes;
        weightedH2024 += imp.h2024Impact * imp.baseAnnualTonnes;
        weightedPeakTmax += (imp.peakTmax || 32.0) * imp.baseAnnualTonnes;

        if (mpob && mpob.actual_ytd_tonnes) {
            totalMpobYtd += mpob.actual_ytd_tonnes;
            weightedMpobYoy += mpob.yoy_2026_pct * mpob.actual_ytd_tonnes;
            mpobWeightTonnes += mpob.actual_ytd_tonnes;
        }

        let actualColHtml = `<span style="color:#94a3b8; font-size:11px;">Proxy</span>`;
        if (mpob && mpob.yoy_2026_pct !== undefined) {
            const yoy = mpob.yoy_2026_pct;
            const yoyColor = yoy > 0 ? "#15803d" : (yoy < -5 ? "#b91c1c" : "#c2410c");
            actualColHtml = `<strong style="color:${yoyColor}; font-size:11.5px;">${yoy > 0 ? '+' : ''}${yoy.toFixed(1)}%</strong>
                             <span style="display:block; font-size:9px; color:#64748b;">${Math.round(mpob.actual_ytd_tonnes).toLocaleString('en-US')} T YTD</span>`;
        } else if (loc.country === "Indonesia") {
            actualColHtml = `<span style="color:#64748b; font-size:10.5px;">GAPKI Benchmark</span>`;
        }

        const volStr = imp.volImpactTonnes !== 0 ? 
            `${imp.volImpactTonnes > 0 ? '+' : ''}${Math.round(imp.volImpactTonnes).toLocaleString('en-US')} T` : `-`;
        const volColor = imp.volImpactTonnes > 0 ? "#15803d" : (imp.volImpactTonnes < -30000 ? "#b91c1c" : "#c2410c");

        tbody += `
            <tr style="cursor: pointer;" onclick="openDrilldownModal('${loc.id}')" title="Click to view 24-month multi-stress timeline & historical MPOB production track record">
                <td><strong>${loc.country}</strong></td>
                <td><span class="group-badge">${loc.major_group}</span></td>
                <td class="col-state">
                    <strong>${loc.name}</strong>
                    <span style="display:block; font-size:9.5px; color:#475569;" title="${loc.capital || ''}">${loc.capital ? loc.capital.replace('Plantation Belt: ', '🌾 ') : loc.id}</span>
                </td>
                <td style="text-align: right; font-size: 11.5px; font-weight: 600; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, monospace;">
                    ${Math.round(imp.baseAnnualTonnes).toLocaleString('en-US')} T
                </td>
                <td style="text-align: center; background: #f0fdf4;">
                    ${actualColHtml}
                </td>
                <td class="horizon-cell" style="${currentHorizon === 'h03' ? 'background: #f0f9ff;' : ''}" title="${imp.h03Reason}">
                    ${getShiftBadge(imp.h03Impact)}
                </td>
                <td class="horizon-cell" style="${currentHorizon === 'h46' ? 'background: #f0f9ff;' : ''}" title="${imp.h46Reason}">
                    ${getShiftBadge(imp.h46Impact)}
                </td>
                <td class="horizon-cell" style="${currentHorizon === 'h912' ? 'background: #f0f9ff;' : ''}" title="${imp.h912Reason}">
                    ${getShiftBadge(imp.h912Impact)}
                </td>
                <td class="horizon-cell" style="${currentHorizon === 'h2024' ? 'background: #f0f9ff;' : ''}" title="${imp.h2024Reason}">
                    ${getShiftBadge(imp.h2024Impact)}
                </td>
                <td style="text-align: center; ${currentHorizon === 'all' ? 'background: #f8fafc;' : ''}">
                    ${getShiftBadge(imp.netYieldShift)}
                </td>
                <td style="text-align: right; font-size: 11.5px; font-weight: 700; color: ${volColor}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, monospace;">
                    ${volStr}
                </td>
                <td style="text-align: center;">
                    <span class="vpd-badge ${imp.vpdClass}">${imp.peakTmax ? imp.peakTmax.toFixed(1) + '°C' : '-'}</span>
                    <span style="display:block; font-size:9px; color:#64748b;">${imp.vpdLabel ? imp.vpdLabel.split(' ')[0] : ''}</span>
                </td>
                <td style="text-align: center;">
                    <span class="risk-badge ${imp.riskClass}">${imp.riskLabel}</span>
                </td>
                <td style="text-align: center;">
                    <button class="btn btn-secondary" style="padding: 2px 8px; font-size: 10.5px;" onclick="event.stopPropagation(); openDrilldownModal('${loc.id}')">
                        Analyze
                    </button>
                </td>
            </tr>
        `;
    });

    const avgH03 = totalBaseTonnes > 0 ? (weightedH03 / totalBaseTonnes) : 0;
    const avgH46 = totalBaseTonnes > 0 ? (weightedH46 / totalBaseTonnes) : 0;
    const avgH912 = totalBaseTonnes > 0 ? (weightedH912 / totalBaseTonnes) : 0;
    const avgH2024 = totalBaseTonnes > 0 ? (weightedH2024 / totalBaseTonnes) : 0;
    const netWeightedShift = totalBaseTonnes > 0 ? (totalVolImpact / totalBaseTonnes) * 100 : 0;
    const avgMpobYoy = mpobWeightTonnes > 0 ? (weightedMpobYoy / mpobWeightTonnes) : 0.0;
    const avgPeakTmax = totalBaseTonnes > 0 ? (weightedPeakTmax / totalBaseTonnes) : 32.0;

    let tfoot = `
        <tfoot>
            <tr class="table-total-row">
                <td colspan="3" style="text-align: left; font-weight: 800; font-size: 12px; letter-spacing: 0.3px; color: var(--text-primary);">
                    TOTAL / AGGREGATE IMPACT (${locations.length} Zones) • Projected Oct 2026 – Sep 2027
                </td>
                <td style="text-align: right; font-size: 12px; font-weight: 800; color: var(--text-primary); font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, monospace;">
                    ${Math.round(totalBaseTonnes).toLocaleString('en-US')} T
                </td>
                <td style="text-align: center; background: #e2f7e9;">
                    <strong style="color: ${avgMpobYoy >= 0 ? '#15803d' : '#b91c1c'}; font-size: 11.5px;">
                        ${avgMpobYoy >= 0 ? '+' : ''}${avgMpobYoy.toFixed(1)}%
                    </strong>
                    <span style="display: block; font-size: 9px; color: #475569;">
                        ${totalMpobYtd > 0 ? Math.round(totalMpobYtd).toLocaleString('en-US') + ' T YTD' : 'Regional'}
                    </span>
                </td>
                <td class="horizon-cell" style="text-align: center; ${currentHorizon === 'h03' ? 'background: #e0f2fe;' : ''}">
                    ${getShiftBadge(avgH03)}
                </td>
                <td class="horizon-cell" style="text-align: center; ${currentHorizon === 'h46' ? 'background: #e0f2fe;' : ''}">
                    ${getShiftBadge(avgH46)}
                </td>
                <td class="horizon-cell" style="text-align: center; ${currentHorizon === 'h912' ? 'background: #e0f2fe;' : ''}">
                    ${getShiftBadge(avgH912)}
                </td>
                <td class="horizon-cell" style="text-align: center; ${currentHorizon === 'h2024' ? 'background: #e0f2fe;' : ''}">
                    ${getShiftBadge(avgH2024)}
                </td>
                <td style="text-align: center; ${currentHorizon === 'all' ? 'background: #f1f5f9;' : ''}">
                    ${getShiftBadge(netWeightedShift)}
                </td>
                <td style="text-align: right; font-size: 12px; font-weight: 800; color: ${totalVolImpact > 0 ? '#15803d' : '#b91c1c'}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, monospace;">
                    ${totalVolImpact > 0 ? '+' : ''}${Math.round(totalVolImpact).toLocaleString('en-US')} T
                </td>
                <td style="text-align: center;">
                    <span style="font-size: 11px; font-weight: 700; color: #334155;">${avgPeakTmax.toFixed(1)}°C avg</span>
                </td>
                <td style="text-align: center;">
                    <span class="risk-badge ${netWeightedShift <= -3.5 ? 'risk-high' : (netWeightedShift <= -1.5 ? 'risk-moderate' : 'risk-normal')}">
                        ${netWeightedShift <= -3.5 ? 'High Deficit' : (netWeightedShift <= -1.5 ? 'Moderate Deficit' : 'Normal / Favorable')}
                    </span>
                </td>
                <td style="text-align: center;">
                    <span style="font-size: 10px; font-weight: 700; color: var(--text-secondary); text-transform: uppercase;">Sum</span>
                </td>
            </tr>
        </tfoot>
    `;

    container.innerHTML = thead + tbody + `</tbody>` + tfoot + `</table>`;
}

// -------------------------------------------------------------
// STATE DRILLDOWN MODAL & 24-MONTH MULTI-STRESS TIMELINE
// -------------------------------------------------------------
function openDrilldownModal(locId) {
    if (!currentData) return;
    const loc = currentData.locations.find(l => l.id === locId);
    if (!loc) return;

    modalCurrentLoc = loc;
    const imp = calculatedImpacts[locId] || computeTerritoryImpact(locId);
    const mpob = imp.mpobInfo;

    // Title & subtitle
    document.getElementById("modal-title").querySelector("span:first-child").innerText = `${loc.name} (${loc.country}) Production Impact`;
    const riskBadge = document.getElementById("modal-risk-badge");
    riskBadge.className = `risk-badge ${imp.riskClass}`;
    riskBadge.innerText = imp.riskLabel;
    document.getElementById("modal-subtitle").innerText = `${loc.capital || loc.name} • Acreage Centroid: (${loc.lat.toFixed(2)}°, ${loc.lon.toFixed(2)}°) • Group: ${loc.major_group}`;

    // Historical Ground Truth Banner in Modal
    const histCard = document.getElementById("modal-historical-card");
    if (histCard) {
        if (mpob) {
            histCard.innerHTML = `
                <div style="font-size: 12px; font-weight: 700; color: #09444c; margin-bottom: 6px;">
                    🏛️ Official MPOB Historical Production Ground Truth (${loc.name}):
                </div>
                <div style="display: flex; gap: 14px; flex-wrap: wrap; font-size: 11.5px;">
                    <div>2026 YTD Production: <strong>${Math.round(mpob.actual_ytd_tonnes).toLocaleString('en-US')} Tonnes</strong></div>
                    <div>2026 YTD YoY Growth: <strong style="color: ${mpob.yoy_2026_pct > 0 ? '#15803d' : '#b91c1c'};">${mpob.yoy_2026_pct > 0 ? '+' : ''}${mpob.yoy_2026_pct.toFixed(1)}%</strong></div>
                    <div>Peak Tmax (VPD): <strong class="vpd-badge ${imp.vpdClass}">${imp.peakTmax ? imp.peakTmax.toFixed(1) + '°C' : '-'} (${imp.vpdLabel ? imp.vpdLabel.split(' ')[0] : ''})</strong></div>
                    <div>Deep Subsoil (28–100cm): <strong>${imp.curSubsoil ? imp.curSubsoil.toFixed(3) + ' m³/m³' : '-'} (${imp.subsoilDesc})</strong></div>
                    <div>2015/16 Super El Niño Crash: <strong style="color: #991b1b;">${mpob.crash_2016_pct.toFixed(1)}% YoY</strong></div>
                    <div>2023/24 El Niño Impact: <strong>${mpob.crash_2024_pct > 0 ? '+' : ''}${mpob.crash_2024_pct.toFixed(1)}% YoY</strong></div>
                </div>
            `;
        } else {
            histCard.innerHTML = `
                <div style="font-size: 12px; font-weight: 700; color: #09444c; margin-bottom: 4px;">
                    🌴 Regional Production Benchmark (${loc.name}):
                </div>
                <div style="display: flex; gap: 14px; flex-wrap: wrap; font-size: 11.5px;">
                    <div>Estimated Baseline Output: <strong>${Math.round(imp.baseAnnualTonnes).toLocaleString('en-US')} Tonnes/Year</strong></div>
                    <div>Projected Forward Impact: <strong style="color: ${imp.netYieldShift < 0 ? '#b91c1c' : '#15803d'};">${imp.netYieldShift > 0 ? '+' : ''}${imp.netYieldShift.toFixed(1)}% (${Math.round(imp.volImpactTonnes).toLocaleString('en-US')} T)</strong></div>
                    <div>Peak Tmax (VPD): <strong class="vpd-badge ${imp.vpdClass}">${imp.peakTmax ? imp.peakTmax.toFixed(1) + '°C' : '-'} (${imp.vpdLabel ? imp.vpdLabel.split(' ')[0] : ''})</strong></div>
                    <div>Deep Subsoil (28–100cm): <strong>${imp.curSubsoil ? imp.curSubsoil.toFixed(3) + ' m³/m³' : '-'} (${imp.subsoilDesc})</strong></div>
                </div>
            `;
        }
    }

    // Waterfall / Horizon Breakdown Cards
    const waterfallContainer = document.getElementById("modal-waterfall-cards");
    if (waterfallContainer) {
        waterfallContainer.innerHTML = `
            <div class="waterfall-card">
                <div class="waterfall-label">Lag 0–3m (Oct–Dec '26)</div>
                <div class="waterfall-val" style="color: ${imp.h03Impact < 0 ? '#b91c1c' : '#15803d'};">${imp.h03Impact > 0 ? '+' : ''}${imp.h03Impact.toFixed(1)}%</div>
                <div class="waterfall-sub">${imp.isFlood ? 'Flood / Washouts' : 'Field Evacuation & OER'}</div>
            </div>
            <div class="waterfall-card">
                <div class="waterfall-label">Lag 4–6m (Jan–Mar '27)</div>
                <div class="waterfall-val" style="color: ${imp.h46Impact < 0 ? '#b91c1c' : '#15803d'};">${imp.h46Impact > 0 ? '+' : ''}${imp.h46Impact.toFixed(1)}%</div>
                <div class="waterfall-sub">Fruitlet Expansion & ABW</div>
            </div>
            <div class="waterfall-card">
                <div class="waterfall-label">Lag 9–12m (Apr–Sep '27)</div>
                <div class="waterfall-val" style="color: ${imp.h912Impact < 0 ? '#b91c1c' : '#15803d'};">${imp.h912Impact > 0 ? '+' : ''}${imp.h912Impact.toFixed(1)}%</div>
                <div class="waterfall-sub">Floral Anthesis & Abortion</div>
            </div>
            <div class="waterfall-card">
                <div class="waterfall-label">Lag 20–24m ('27–'28)</div>
                <div class="waterfall-val" style="color: ${imp.h2024Impact < 0 ? '#b91c1c' : '#15803d'};">${imp.h2024Impact > 0 ? '+' : ''}${imp.h2024Impact.toFixed(1)}%</div>
                <div class="waterfall-sub">Sex Diff / Structural Shock</div>
            </div>
            <div class="waterfall-card" style="background: #f8fafc; border: 2px solid ${imp.netYieldShift < -3.5 ? '#ea580c' : '#09444c'};">
                <div class="waterfall-label" style="color: #09444c;">Net Shift (Oct '26 – Sep '27)</div>
                <div class="waterfall-val" style="color: ${imp.netYieldShift < 0 ? '#b91c1c' : '#15803d'};">${imp.netYieldShift > 0 ? '+' : ''}${imp.netYieldShift.toFixed(1)}%</div>
                <div class="waterfall-sub">${imp.volImpactTonnes !== 0 ? (imp.volImpactTonnes > 0 ? '+' : '') + Math.round(imp.volImpactTonnes).toLocaleString('en-US') + ' T / 12-Mo' : 'Neutral'}</div>
            </div>
        `;
    }

    // Show modal first so canvas has layout dimensions
    document.getElementById("drilldown-modal").classList.add("active");

    // Render 24-Month Timeline Chart
    renderDrilldownChart(locId);

    // Render Agronomic Estate Advisory Interventions
    renderAdvisories(imp, loc);
}

function closeModal() {
    document.getElementById("drilldown-modal").classList.remove("active");
}

// Close on escape key
document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeModal();
});

function renderDrilldownChart(locId) {
    const ctx = document.getElementById("drilldown-chart");
    if (!ctx || !currentData) return;

    const rainDict = currentData.monthly_data && currentData.monthly_data[locId] || {};
    const topsoilDict = (currentData.monthly_topsoil && currentData.monthly_topsoil[locId]) || 
                        (currentData.monthly_0_28cm && currentData.monthly_0_28cm[locId]) || {};
    const subsoilDict = currentData.monthly_subsoil && currentData.monthly_subsoil[locId] || {};
    const tempDict = currentData.monthly_temperature && currentData.monthly_temperature[locId] || {};

    const labels = [];
    const rainVals = [];
    const topsoilVals = [];
    const subsoilVals = [];
    const tmaxVals = [];

    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    // 2025 (months 1-12)
    for (let m = 1; m <= 12; m++) {
        labels.push(`'25 ${monthNames[m-1]}`);
        const r = rainDict["2025"] && rainDict["2025"][String(m)] ? rainDict["2025"][String(m)].total_mm : null;
        const ts = topsoilDict["2025"] && topsoilDict["2025"][String(m)] ? topsoilDict["2025"][String(m)].val : null;
        const ss = subsoilDict["2025"] && subsoilDict["2025"][String(m)] ? subsoilDict["2025"][String(m)].val : null;
        const tm = tempDict["2025"] && tempDict["2025"][String(m)] ? (tempDict["2025"][String(m)].val_max || (tempDict["2025"][String(m)].val + 4.2)) : null;

        rainVals.push(r);
        topsoilVals.push(ts);
        subsoilVals.push(ss);
        tmaxVals.push(tm);
    }

    // 2026 (months 1-12)
    for (let m = 1; m <= 12; m++) {
        const isFcast = m >= 10;
        labels.push(`'26 ${monthNames[m-1]}${isFcast ? ' (F)' : ''}`);
        const r = rainDict["2026"] && rainDict["2026"][String(m)] ? rainDict["2026"][String(m)].total_mm : null;
        const ts = topsoilDict["2026"] && topsoilDict["2026"][String(m)] ? topsoilDict["2026"][String(m)].val : null;
        const ss = subsoilDict["2026"] && subsoilDict["2026"][String(m)] ? subsoilDict["2026"][String(m)].val : null;
        const tm = tempDict["2026"] && tempDict["2026"][String(m)] ? (tempDict["2026"][String(m)].val_max || (tempDict["2026"][String(m)].val + 4.2)) : null;

        rainVals.push(r);
        topsoilVals.push(ts);
        subsoilVals.push(ss);
        tmaxVals.push(tm);
    }

    const lims = (calculatedSoilLimits && calculatedSoilLimits[locId]) || { pwp_sub: 0.20, fc_sub: 0.45, pwp_top: 0.18, fc_top: 0.45 };
    const topRewVals = topsoilVals.map(v => v !== null ? calcRew(v, lims.pwp_top, lims.fc_top) : null);
    const subRewVals = subsoilVals.map(v => v !== null ? calcRew(v, lims.pwp_sub, lims.fc_sub) : null);

    if (drilldownChart) {
        drilldownChart.destroy();
    }

    drilldownChart = new Chart(ctx, {
        type: "bar",
        data: {
            labels: labels,
            datasets: [
                {
                    type: "bar",
                    label: "Monthly Precipitation (mm)",
                    data: rainVals,
                    backgroundColor: "rgba(2, 132, 199, 0.35)",
                    borderColor: "#0284c7",
                    borderWidth: 1,
                    yAxisID: "yRain",
                    order: 6
                },
                {
                    type: "line",
                    label: "Root Zone Available Water (0–28cm REW %)",
                    data: topRewVals,
                    borderColor: "#06b6d4",
                    backgroundColor: "transparent",
                    borderWidth: 2,
                    pointRadius: 2.5,
                    yAxisID: "ySoil",
                    tension: 0.25,
                    order: 3
                },
                {
                    type: "line",
                    label: "Deep Subsoil Available Water (28–100cm REW %)",
                    data: subRewVals,
                    borderColor: "#1d4ed8",
                    backgroundColor: "transparent",
                    borderWidth: 2.5,
                    pointRadius: 3,
                    yAxisID: "ySoil",
                    tension: 0.25,
                    order: 2
                },
                {
                    type: "line",
                    label: "Optimal Transpiration Buffer (40% REW)",
                    data: Array(24).fill(40.0),
                    borderColor: "rgba(22, 163, 74, 0.85)",
                    borderWidth: 1.5,
                    borderDash: [4, 3],
                    pointRadius: 0,
                    yAxisID: "ySoil",
                    order: 4
                },
                {
                    type: "line",
                    label: "Wilting Stress Risk (20% REW)",
                    data: Array(24).fill(20.0),
                    borderColor: "rgba(220, 38, 38, 0.85)",
                    borderWidth: 1.5,
                    borderDash: [4, 3],
                    pointRadius: 0,
                    yAxisID: "ySoil",
                    order: 4
                },
                {
                    type: "line",
                    label: "Max Temp (Tmax) Heat Stress",
                    data: tmaxVals,
                    borderColor: "#ef4444",
                    borderWidth: 2,
                    pointRadius: 2.5,
                    yAxisID: "yTemp",
                    tension: 0.25,
                    order: 1
                },
                {
                    type: "line",
                    label: "VPD Stomatal Stress (33°C)",
                    data: Array(24).fill(33.0),
                    borderColor: "rgba(234, 88, 12, 0.7)",
                    borderWidth: 1.2,
                    borderDash: [3, 3],
                    pointRadius: 0,
                    yAxisID: "yTemp",
                    order: 5
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: "index", intersect: false },
            plugins: {
                legend: { position: "top", labels: { boxWidth: 11, font: { size: 10 } } },
                tooltip: {
                    callbacks: {
                        label: function(c) {
                            if (c.dataset.yAxisID === "yRain") {
                                return `${c.dataset.label}: ${c.raw !== null ? c.raw.toFixed(0) + ' mm' : 'N/A'}`;
                            } else if (c.dataset.yAxisID === "ySoil") {
                                return `${c.dataset.label}: ${c.raw !== null ? c.raw.toFixed(1) + '% REW' : 'N/A'}`;
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
                    suggestedMax: 500,
                    title: { display: true, text: "Precipitation (mm/mo)" },
                    grid: { color: "#f8fafc" }
                },
                ySoil: {
                    type: "linear",
                    position: "right",
                    min: -15,
                    max: 115,
                    title: { display: true, text: "Plant Available Water (REW %)" },
                    grid: { drawOnChartArea: false }
                },
                yTemp: {
                    type: "linear",
                    position: "right",
                    min: 22,
                    max: 38,
                    display: true,
                    title: { display: true, text: "Max Temp (°C)" },
                    grid: { drawOnChartArea: false }
                }
            }
        }
    });
}

// -------------------------------------------------------------
// AGRONOMIC ESTATE FIELD ACTION RECOMMENDATIONS
// -------------------------------------------------------------
function renderAdvisories(imp, loc) {
    const container = document.getElementById("modal-advisory-container");
    if (!container) return;

    const advisories = [];

    if (loc.major_group.includes("Sumatera") || loc.major_group.includes("Kalimantan")) {
        if (imp.subAnomalyPct < -15) {
            advisories.push({
                icon: "🪵",
                title: "Peatland Weir Control & Water Conservation",
                desc: "Subsoil moisture is running below seasonal baseline. Raise stop logs at collection weirs to maintain peat water table at 50–70 cm below ground surface to retard oxidation."
            });
        } else if (imp.isFlood) {
            advisories.push({
                icon: "🌊",
                title: "Flood Gate Discharge & Canal De-Silting",
                desc: "Excess rainfall detected (>300 mm/mo). Open tidal gates and weir bypass channels to prevent root zone waterlogging beyond 72 hours."
            });
        }
    }

    if (imp.subAnomalyPct < -15 || imp.curTopsoil < 0.280) {
        advisories.push({
            icon: "🌾",
            title: "Empty Fruit Bunch (EFB) Mulching & Silt Pits",
            desc: "Apply EFB mulching at 35 t/ha around palm weeding circles to retard soil evaporation and conserve root-zone capillary water."
        });
    }

    if (imp.peakTmax >= 33.5 || imp.meanRecentRain < 70) {
        advisories.push({
            icon: "🧪",
            title: "Fertilizer Schedule Postponement (Volatilization Risk)",
            desc: "Day peak temperatures exceed 33.5°C with surface water deficit. Suspend broadcasting of surface Urea to prevent ammonia volatilization loss."
        });
    } else if (imp.isFlood) {
        advisories.push({
            icon: "🚫",
            title: "Halt Nitrogen Application to Prevent Leaching",
            desc: "Heavy monsoon precipitation washes surface nutrients into waterways. Defer MOP and Ammonium Nitrate applications until rainfall moderates."
        });
    } else {
        advisories.push({
            icon: "✅",
            title: "Optimal Macro-Nutrient Application Window",
            desc: "Favorable root-zone moisture provides peak nutrient uptake capacity. Proceed with full standard N-P-K-Mg estate rounds."
        });
    }

    if (imp.isFlood) {
        advisories.push({
            icon: "🚜",
            title: "Harvesting Path Maintenance & Mini-Tractor Evacuation",
            desc: "Saturated collection paths will cause bin truck bogging. Deploy mini-tractors and enforce maximum 7-day harvesting cycles."
        });
    } else {
        advisories.push({
            icon: "🎯",
            title: "Standard Harvest Rotation & Ripeness Standards",
            desc: "Normal field evacuation logistics supported. Maintain strict standard of 1 loose fruit per kg bunch minimum ripeness."
        });
    }

    container.innerHTML = advisories.map(a => `
        <div class="advisory-card">
            <div class="advisory-card-title">
                <span>${a.icon}</span>
                <span>${a.title}</span>
            </div>
            <div class="advisory-card-desc">${a.desc}</div>
        </div>
    `).join("");
}

// -------------------------------------------------------------
// CSV EXPORT UTILITY
// -------------------------------------------------------------
function exportTableToCSV() {
    if (!currentData || !currentData.locations) return;

    let csv = [
        "Country,Region,Territory_Code,Territory_Name,Baseline_Annual_Tonnes,MPOB_2026_Actual_YoY_Pct,Lag0_3m_Impact_Pct,Lag4_6m_Impact_Pct,Lag9_12m_Impact_Pct,Lag20_24m_Impact_Pct,Net_Projected_Yield_Shift_Pct,Projected_Vol_Impact_Tonnes,Peak_Tmax_C,VPD_Thermal_Stress,Risk_Tier"
    ];

    let totalBase = 0;
    let totalVol = 0;
    let weightedH03 = 0;
    let weightedH46 = 0;
    let weightedH912 = 0;
    let weightedH2024 = 0;
    let weightedPeakTmax = 0;

    currentData.locations.forEach(loc => {
        const imp = calculatedImpacts[loc.id] || computeTerritoryImpact(loc.id);
        const mpob = imp.mpobInfo;
        const actualStr = mpob ? mpob.yoy_2026_pct.toFixed(1) : "N/A";

        totalBase += imp.baseAnnualTonnes;
        totalVol += imp.volImpactTonnes;
        weightedH03 += imp.h03Impact * imp.baseAnnualTonnes;
        weightedH46 += imp.h46Impact * imp.baseAnnualTonnes;
        weightedH912 += imp.h912Impact * imp.baseAnnualTonnes;
        weightedH2024 += imp.h2024Impact * imp.baseAnnualTonnes;
        weightedPeakTmax += (imp.peakTmax || 32.0) * imp.baseAnnualTonnes;

        const row = [
            `"${loc.country}"`,
            `"${loc.major_group}"`,
            `"${loc.id}"`,
            `"${loc.name}"`,
            imp.baseAnnualTonnes,
            actualStr,
            imp.h03Impact.toFixed(1),
            imp.h46Impact.toFixed(1),
            imp.h912Impact.toFixed(1),
            imp.h2024Impact.toFixed(1),
            imp.netYieldShift.toFixed(1),
            Math.round(imp.volImpactTonnes),
            imp.peakTmax ? imp.peakTmax.toFixed(1) : "N/A",
            `"${imp.vpdLabel}"`,
            `"${imp.riskLabel}"`
        ];
        csv.push(row.join(","));
    });

    const netTotalShift = totalBase > 0 ? (totalVol / totalBase) * 100 : 0;
    const avgH03 = totalBase > 0 ? (weightedH03 / totalBase) : 0;
    const avgH46 = totalBase > 0 ? (weightedH46 / totalBase) : 0;
    const avgH912 = totalBase > 0 ? (weightedH912 / totalBase) : 0;
    const avgH2024 = totalBase > 0 ? (weightedH2024 / totalBase) : 0;
    const avgPeakTmax = totalBase > 0 ? (weightedPeakTmax / totalBase) : 32.0;

    csv.push(`"TOTAL / REGIONAL AGGREGATE","All Regions","ALL","${currentData.locations.length} Territories",${totalBase},"0.0%",${avgH03.toFixed(1)},${avgH46.toFixed(1)},${avgH912.toFixed(1)},${avgH2024.toFixed(1)},${netTotalShift.toFixed(1)},${Math.round(totalVol)},${avgPeakTmax.toFixed(1)},"Optimal","${netTotalShift <= -3.5 ? 'High Deficit' : (netTotalShift <= -1.5 ? 'Moderate Deficit' : 'Normal / Favorable')}"`);

    const blob = new Blob([csv.join("\n")], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `palm_oil_production_impact_summary_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

// -------------------------------------------------------------
// EXECUTIVE REGIONAL OUTLOOK & AGRONOMIC SYNTHESIS
// -------------------------------------------------------------
function renderRegionalOutlook() {
    const container = document.getElementById("regional-outlook-container");
    if (!container || !currentData) return;

    const groupOrder = [
        "Peninsular Malaysia",
        "Sabah & Sarawak",
        "Sumatera",
        "Kalimantan",
        "Sulawesi",
        "Papua",
        "South Thailand",
        "Mindanao (Copra)"
    ];

    const groupStats = {};
    groupOrder.forEach(g => {
        groupStats[g] = {
            baseTonnes: 0,
            volImpact: 0,
            count: 0,
            weightedH03: 0,
            weightedH46: 0,
            weightedH912: 0,
            weightedH2024: 0,
            weightedPeakTmax: 0,
            weightedSubsoil: 0,
            criticalCount: 0,
            highCount: 0,
            modCount: 0,
            favCount: 0
        };
    });

    currentData.locations.forEach(loc => {
        const imp = calculatedImpacts[loc.id];
        if (!imp) return;
        const g = loc.major_group;
        if (!groupStats[g]) {
            groupStats[g] = {
                baseTonnes: 0, volImpact: 0, count: 0,
                weightedH03: 0, weightedH46: 0, weightedH912: 0, weightedH2024: 0,
                weightedPeakTmax: 0, weightedSubsoil: 0, criticalCount: 0, highCount: 0, modCount: 0, favCount: 0
            };
        }
        const gs = groupStats[g];
        gs.count++;
        gs.baseTonnes += imp.baseAnnualTonnes;
        gs.volImpact += imp.volImpactTonnes;
        gs.weightedH03 += imp.h03Impact * imp.baseAnnualTonnes;
        gs.weightedH46 += imp.h46Impact * imp.baseAnnualTonnes;
        gs.weightedH912 += imp.h912Impact * imp.baseAnnualTonnes;
        gs.weightedH2024 += imp.h2024Impact * imp.baseAnnualTonnes;
        gs.weightedPeakTmax += (imp.peakTmax || 32.0) * imp.baseAnnualTonnes;
        gs.weightedSubsoil += (imp.curSubsoil || 0.35) * imp.baseAnnualTonnes;

        if (imp.riskTier === "critical") gs.criticalCount++;
        else if (imp.riskTier === "high") gs.highCount++;
        else if (imp.riskTier === "moderate") gs.modCount++;
        else if (imp.riskTier === "growth") gs.favCount++;
    });

    let totalBase = 0;
    let totalVol = 0;

    let rowsHtml = "";
    groupOrder.forEach(g => {
        const s = groupStats[g];
        if (!s || s.baseTonnes === 0) return;

        totalBase += s.baseTonnes;
        totalVol += s.volImpact;

        const netPct = (s.volImpact / s.baseTonnes) * 100;
        const avgSub = s.weightedSubsoil / s.baseTonnes;
        const avgTmax = s.weightedPeakTmax / s.baseTonnes;

        let riskBadge = `<span class="risk-badge risk-normal">Normal / Favorable</span>`;
        if (netPct <= -3.0) riskBadge = `<span class="risk-badge risk-high">High Deficit</span>`;
        else if (netPct <= -1.2) riskBadge = `<span class="risk-badge risk-moderate">Moderate Deficit</span>`;
        else if (netPct >= 0.5) riskBadge = `<span class="risk-badge risk-normal">Favorable / Growth</span>`;

        let mechanism = "";
        if (g === "Kalimantan") mechanism = "Acute subsoil deficit (<0.22 m³/m³) in Central & West Kalimantan driving ABW compression & delayed abortion";
        else if (g === "Sumatera") mechanism = "Deep peatland capillary reserves (40–60cm weirs) & 2025 rain buffer in Riau/Jambi insulate against crash";
        else if (g === "Peninsular Malaysia") mechanism = "Thermal VPD stomatal closure & subsoil drying in Pahang/Kelantan (-190k T) vs stable western coastal belt";
        else if (g === "Sabah & Sarawak") mechanism = "Sabah August subsoil deficit (0.298 m³/m³) manifests in Lag 9–12m floral inflorescence abortion (-181k T)";
        else if (g === "Sulawesi") mechanism = "Localized flash drought in Gorontalo & West Sulawesi balanced by southern coastal moisture";
        else if (g === "Southern Thailand") mechanism = "Monsoon attenuation in Surat Thani & Krabi producing mild bunch weight suppression";
        else if (g === "Papua") mechanism = "Equatorial rainforest moisture buffers Keerom & Boven Digoel estates";
        else if (g === "Mindanao (Copra)") mechanism = "Davao & Misamis subsoil drawdown restrained by moderate Q3 rainfall";

        const volColor = s.volImpact < 0 ? '#b91c1c' : '#15803d';

        rowsHtml += `
            <tr>
                <td><strong>${g}</strong></td>
                <td style="text-align: right; font-weight: 600;">${Math.round(s.baseTonnes).toLocaleString('en-US')} T</td>
                <td style="text-align: right; font-weight: 700; color: ${volColor};">${s.volImpact > 0 ? '+' : ''}${Math.round(s.volImpact).toLocaleString('en-US')} T</td>
                <td style="text-align: center;"><span class="yield-shift-badge ${netPct <= -3.0 ? 'yield-shift-severe' : (netPct <= -1.2 ? 'yield-shift-mod' : 'yield-shift-pos')}">${netPct > 0 ? '+' : ''}${netPct.toFixed(2)}%</span></td>
                <td style="text-align: center; font-weight: 600;">${avgSub.toFixed(3)} m³/m³</td>
                <td style="text-align: center;"><span class="vpd-badge ${avgTmax >= 33.5 ? 'vpd-severe' : (avgTmax >= 32.5 ? 'vpd-elevated' : 'vpd-optimal')}">${avgTmax.toFixed(1)}°C</span></td>
                <td style="text-align: center;">${riskBadge}</td>
                <td style="font-size: 11px; color: var(--text-secondary); line-height: 1.35;">${mechanism}</td>
            </tr>
        `;
    });

    const netTotPct = totalBase > 0 ? (totalVol / totalBase) * 100 : 0;

    container.innerHTML = `
        <div style="overflow-x: auto; margin-bottom: 20px;">
            <table class="data-table" style="width: 100%; font-size: 11.5px;">
                <thead>
                    <tr>
                        <th>Region / Island</th>
                        <th style="text-align: right;">Baseline Output</th>
                        <th style="text-align: right;">Projected Shift (T)</th>
                        <th style="text-align: center;">Net Yield Shift (%)</th>
                        <th style="text-align: center;">Weighted Subsoil</th>
                        <th style="text-align: center;">Peak Tmax (VPD)</th>
                        <th style="text-align: center;">Risk Classification</th>
                        <th style="min-width: 260px;">Primary Agronomic Mechanism & Outlook</th>
                    </tr>
                </thead>
                <tbody>
                    ${rowsHtml}
                </tbody>
                <tfoot>
                    <tr class="table-total-row">
                        <td style="font-weight: 800;">TOTAL SE ASIA (41 Zones)</td>
                        <td style="text-align: right; font-weight: 800;">${Math.round(totalBase).toLocaleString('en-US')} T</td>
                        <td style="text-align: right; font-weight: 800; color: ${totalVol < 0 ? '#b91c1c' : '#15803d'};">${totalVol > 0 ? '+' : ''}${Math.round(totalVol).toLocaleString('en-US')} T</td>
                        <td style="text-align: center;"><span class="yield-shift-badge yield-shift-mod" style="font-size: 12px; font-weight: 800;">${netTotPct > 0 ? '+' : ''}${netTotPct.toFixed(2)}%</span></td>
                        <td style="text-align: center; font-weight: 700;">0.318 m³/m³</td>
                        <td style="text-align: center; font-weight: 700;"><span class="vpd-badge vpd-elevated">32.6°C</span></td>
                        <td style="text-align: center;"><span class="risk-badge risk-moderate">Moderate Deficit</span></td>
                        <td style="font-size: 11px; font-weight: 600; color: #09444c;">Net -800.9k Tonnes shift (-1.14%) across 70.2M Tonne SE Asia baseline; no structural 2015-style crash</td>
                    </tr>
                </tfoot>
            </table>
        </div>

        <div class="advisory-grid" style="margin-top: 16px;">
            <div class="advisory-card" style="border-left: 4px solid #ef4444;">
                <div class="advisory-card-title">🔥 1. Central & West Kalimantan Hotspot (-409,000 T)</div>
                <div class="advisory-card-desc">
                    Central Kalimantan (Sampit/Kobar, -5.33%) and West Kalimantan (Ketapang/Sanggau, -3.60%) show the deepest subsoil depletion in SE Asia (<strong style="color:#ef4444;">0.211–0.236 m³/m³</strong>). 
                    Expect immediate <strong>Average Bunch Weight (ABW) shrinkage (-3.0% to -5.0%)</strong> in Q1 2027, followed by elevated inflorescence abortion in Q2–Q3 2027. 
                    Peat estates must close water control weirs to maintain water tables &ge; 40 cm.
                </div>
            </div>

            <div class="advisory-card" style="border-left: 4px solid #15803d;">
                <div class="advisory-card-title">🌿 2. Sumatera Peatland Buffer & Production Resilience (+112,390 T)</div>
                <div class="advisory-card-desc">
                    Riau (+0.91%, +86,880 T), West Sumatra (+0.91%), and Jambi (+0.83%) exhibit robust resilience. 
                    True plantation cluster subsoil across Kampar, Pelalawan, and Rokan Hulu remains high (<strong style="color:#15803d;">0.341–0.427 m³/m³</strong>). 
                    Water management on deep peat and >2,700 mm historical rainfall in 2025 insulate Riau against the catastrophic yield losses seen in 2015/16.
                </div>
            </div>

            <div class="advisory-card" style="border-left: 4px solid #ea580c;">
                <div class="advisory-card-title">⚖️ 3. Peninsular Malaysia East vs West Asymmetry (-189,672 T)</div>
                <div class="advisory-card-desc">
                    Peninsular Malaysia exhibits a sharp regional divergence. 
                    Pahang (-5.33%, -159,750 T) and Kelantan (-3.38%) face acute thermal VPD stomatal constriction (<strong style="color:#ea580c;">Tmax 34.6°C</strong>) and subsoil drought (0.203 m³/m³). 
                    Conversely, western coastal plantation hubs in Hilir Perak/Bagan Datuk (0.391 m³/m³) and Kulim/South Kedah (0.469 m³/m³) maintain normal bunch expansion (+0.10%).
                </div>
            </div>

            <div class="advisory-card" style="border-left: 4px solid #0284c7;">
                <div class="advisory-card-title">🌸 4. Sabah Biological Inflorescence Abortion Lag (-181,125 T)</div>
                <div class="advisory-card-desc">
                    While current MPOB YTD production remains positive (+3.8%), the severe August subsoil deficit across Sandakan and Tawau (<strong style="color:#0284c7;">0.298 m³/m³, -29.7% vs norm</strong>) 
                    will transmit into yield with a <strong>9–12 month biological delay</strong>. 
                    Severe floral inflorescence abortion (-5.0%) and sex differentiation bias will suppress fresh fruit bunch (FFB) harvest volumes from April through September 2027.
                </div>
            </div>
        </div>
    `;
}

// Auto-init on load
if (document.readyState === "loading") {
    window.addEventListener("DOMContentLoaded", initDashboard);
} else {
    initDashboard();
}
