let curvesData = null;
let activeCategory = 'all';
let searchQuery = '';
let chartsInstances = {};
let modalChart = null;

// Category Config with 'Curve' word removed from all titles
const CATEGORY_CONFIG = [
    { key: 'Energy', title: 'Energy', icon: '⚡' },
    { key: 'Grains & Oilseeds', title: 'Grains & Oilseeds', icon: '🌾' },
    { key: 'Livestock & Dairy', title: 'Livestock & Dairy', icon: '🥩' },
    { key: 'Softs', title: 'Soft Commodities', icon: '☕' },
    { key: 'FX & Rates', title: 'Foreign Exchange & Interest Rates', icon: '💱' },
    { key: 'Metals', title: 'Metals', icon: '🪙' }
];

function loadCurvesData() {
    if (curvesData) return curvesData;
    const jsonEl = document.getElementById('curvesDataJson');
    if (jsonEl && jsonEl.textContent) {
        try {
            curvesData = JSON.parse(jsonEl.textContent);
            return curvesData;
        } catch (e) {
            console.error('Failed to parse curvesDataJson element:', e);
        }
    }
    if (window.CURVES_DATA) {
        curvesData = window.CURVES_DATA;
        return curvesData;
    }
    return null;
}

function initDashboard() {
    curvesData = loadCurvesData();
    if (!curvesData || !curvesData.curves) {
        console.error('curvesData is missing or invalid.');
        document.getElementById('mainContainer').innerHTML = '<div style="text-align: center; padding: 60px; color: #64748b; font-size: 16px;">Failed to load data. Please refresh or run settlement_engine.py.</div>';
        return;
    }
    renderSegregatedCurves();
    setupEventListeners();
    checkLsegStatus();
}

async function checkLsegStatus() {
    const badge = document.querySelector('.brand-badge');
    if (!badge) return;
    try {
        const resp = await fetch('http://127.0.0.1:8050/api/lseg_status');
        if (resp.ok) {
            const data = await resp.json();
            if (data.lseg_connected) {
                badge.innerHTML = '<span style="color: #10b981; font-size: 13px;">●</span> LSEG LIVE';
                badge.style.borderColor = '#10b981';
                badge.style.color = '#047857';
                badge.style.background = '#ecfdf5';
                badge.title = 'LSEG Workspace desktop session is active and connected';
            } else {
                badge.innerHTML = '<span style="color: #d97706; font-size: 13px;">○</span> LSEG OFFLINE';
                badge.style.borderColor = '#f59e0b';
                badge.style.color = '#b45309';
                badge.style.background = '#fffbeb';
                badge.title = 'Refinitiv / LSEG Workspace is closed on your PC. Please open Workspace and sign in to fetch live prices.';
            }
        }
    } catch (e) {}
}

function renderSegregatedCurves() {
    const main = document.getElementById('mainContainer');
    if (!main) return;
    main.innerHTML = '';

    // Destroy old Chart.js instances to avoid memory leaks
    Object.values(chartsInstances).forEach(ch => {
        try { ch.destroy(); } catch (e) {}
    });
    chartsInstances = {};

    const q = searchQuery.toLowerCase();
    const d1Date = (curvesData.dates && curvesData.dates.date1) ? curvesData.dates.date1.substring(0, 10) : 'Date 1';
    const d2Date = (curvesData.dates && curvesData.dates.date2) ? curvesData.dates.date2.substring(0, 10) : 'Date 2';
    const d3Date = (curvesData.dates && curvesData.dates.date3) ? curvesData.dates.date3.substring(0, 10) : 'Date 3';

    CATEGORY_CONFIG.forEach(cat => {
        if (activeCategory !== 'all' && activeCategory !== cat.key) return;

        const catCurves = curvesData.curves.filter(c => {
            if (c.category !== cat.key) return false;
            if (!q) return true;
            return c.title.toLowerCase().includes(q) || 
                   (c.exchange && c.exchange.toLowerCase().includes(q)) ||
                   (c.sheet && c.sheet.toLowerCase().includes(q)) ||
                   c.points.some(p => p.ric && p.ric.toLowerCase().includes(q));
        });

        if (catCurves.length === 0) return;

        // Section Container
        const section = document.createElement('section');
        section.className = 'category-section';
        section.id = 'section_' + cat.key.replace(/\s+/g, '_');

        section.innerHTML = `
            <div class="category-section-header">
                <div class="cat-header-title">
                    <span>${cat.icon}</span>
                    <span>${cat.title}</span>
                </div>
                <div class="cat-header-meta">${catCurves.length} Markets Active</div>
            </div>
            <div class="curves-grid" id="grid_${cat.key.replace(/\s+/g, '_')}"></div>
        `;

        main.appendChild(section);
        const grid = section.querySelector('.curves-grid');

        catCurves.forEach(c => {
            const card = document.createElement('div');
            card.className = 'curve-card';
            card.id = `card_${c.id}`;

            const m = c.metrics || {};
            const chg1dStr = (m.change_1d !== null && m.change_1d !== undefined) ? (m.change_1d > 0 ? `+${m.change_1d}` : `${m.change_1d}`) : '--';
            const chg1dPctStr = (m.change_1d_pct !== null && m.change_1d_pct !== undefined) ? (m.change_1d_pct > 0 ? `(+${m.change_1d_pct}%)` : `(${m.change_1d_pct}%)`) : '';
            const chg1dClass = m.change_1d > 0 ? 'pos' : (m.change_1d < 0 ? 'neg' : '');

            const chg1mStr = (m.change_1m !== null && m.change_1m !== undefined) ? (m.change_1m > 0 ? `+${m.change_1m}` : `${m.change_1m}`) : '--';
            const chg1mPctStr = (m.change_1m_pct !== null && m.change_1m_pct !== undefined) ? (m.change_1m_pct > 0 ? `(+${m.change_1m_pct}%)` : `(${m.change_1m_pct}%)`) : '';
            const chg1mClass = m.change_1m > 0 ? 'pos' : (m.change_1m < 0 ? 'neg' : '');

            let structTag = 'tag-flat';
            if (m.structure === 'Contango') structTag = 'tag-contango';
            if (m.structure === 'Backwardation') structTag = 'tag-backwardation';

            card.innerHTML = `
                <div class="card-header">
                    <div class="curve-title-clean">
                        <span>${c.title}</span>
                    </div>
                    <div class="card-badges">
                        ${c.exchange ? `<span class="tag tag-exchange">${c.exchange}</span>` : ''}
                        ${c.unit ? `<span class="tag tag-unit">${c.unit}</span>` : ''}
                        <span class="tag ${structTag}">${m.structure || 'Flat'}</span>
                        <button class="btn-expand" onclick="openModal('${c.id}')">Details</button>
                    </div>
                </div>

                <div class="kpi-row">
                    <div class="kpi-item">
                        <span class="kpi-caption">Active: ${m.active_contract || 'Prompt'}</span>
                        <span class="kpi-value">${(m.prompt_price !== null && m.prompt_price !== undefined) ? m.prompt_price : '--'}</span>
                    </div>
                    <div class="kpi-item" style="text-align: right;">
                        <span class="kpi-caption">1D Change</span>
                        <span class="kpi-value ${chg1dClass}">${chg1dStr} <small style="font-size: 9.5px;">${chg1dPctStr}</small></span>
                    </div>
                    <div class="kpi-item" style="text-align: right;">
                        <span class="kpi-caption">1M Change</span>
                        <span class="kpi-value ${chg1mClass}">${chg1mStr} <small style="font-size: 9.5px;">${chg1mPctStr}</small></span>
                    </div>
                </div>

                <div class="chart-box">
                    <canvas id="canvas_${c.id}"></canvas>
                </div>

                <div class="card-footer">
                    <div class="legend-inline">
                        <span class="legend-item"><span class="dot-d1">--</span> ${d1Date}</span>
                        <span class="legend-item"><span class="dot-d2">―</span> ${d2Date}</span>
                        <span class="legend-item"><span class="dot-d3">―</span> ${d3Date}</span>
                    </div>
                    <span>${c.points.length} tenors</span>
                </div>
            `;

            grid.appendChild(card);
            renderMiniChart(c);
        });
    });

    if (main.children.length === 0) {
        main.innerHTML = '<div style="text-align: center; padding: 60px 20px; color: var(--text-muted); font-size: 15px;">No markets found matching your filter criteria.</div>';
    }
}

function isFxTenorUpTo1Y(lbl) {
    if (!lbl || !String(lbl).trim()) return false;
    const l = String(lbl).trim().toUpperCase();
    if (l.endsWith('Y')) {
        const y = parseFloat(l.slice(0, -1));
        return !isNaN(y) && y <= 1.0;
    }
    return true;
}

function renderMiniChart(c) {
    if (typeof Chart === 'undefined') {
        console.warn('Chart.js not loaded yet for', c.id);
        return;
    }
    const canvas = document.getElementById(`canvas_${c.id}`);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    let pts = c.points;
    if (c.category === 'FX & Rates' && c.id !== 'curve_61') {
        pts = pts.filter(p => isFxTenorUpTo1Y(p.display_label || p.contract_code || p.label));
    }

    const labels = pts.map(p => p.display_label || p.contract_code || p.label || p.ric);
    const d1Vals = pts.map(p => p.v1);
    const d2Vals = pts.map(p => p.v2);
    const d3Vals = pts.map(p => p.v3);

    const d1Date = (curvesData.dates && curvesData.dates.date1) ? curvesData.dates.date1.substring(0, 10) : 'Date 1';
    const d2Date = (curvesData.dates && curvesData.dates.date2) ? curvesData.dates.date2.substring(0, 10) : 'Date 2';
    const d3Date = (curvesData.dates && curvesData.dates.date3) ? curvesData.dates.date3.substring(0, 10) : 'Date 3';

    chartsInstances[c.id] = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: d1Date,
                    data: d1Vals,
                    borderColor: '#2563eb',
                    borderWidth: 1.5,
                    borderDash: [4, 4],
                    pointRadius: 2.5,
                    pointBackgroundColor: '#2563eb',
                    tension: 0.15,
                    spanGaps: true
                },
                {
                    label: d2Date,
                    data: d2Vals,
                    borderColor: '#d97706',
                    borderWidth: 1.8,
                    pointRadius: 3,
                    pointBackgroundColor: '#d97706',
                    tension: 0.15,
                    spanGaps: true
                },
                {
                    label: d3Date,
                    data: d3Vals,
                    borderColor: '#059669',
                    borderWidth: 2.5,
                    pointRadius: 3.5,
                    pointBackgroundColor: '#059669',
                    pointBorderColor: '#ffffff',
                    tension: 0.15,
                    spanGaps: true
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: 'rgba(15, 23, 42, 0.95)',
                    titleColor: '#ffffff',
                    bodyColor: '#cbd5e1',
                    borderColor: '#cbd5e1',
                    borderWidth: 1,
                    padding: 8,
                    displayColors: true,
                    callbacks: {
                        title: function(items) {
                            const idx = items[0].dataIndex;
                            const pt = c.points[idx];
                            return `${pt.display_label || pt.label} (${pt.ric || ''})`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: { color: '#f1f5f9' },
                    ticks: {
                        color: '#64748b',
                        font: { size: 9, family: "'JetBrains Mono', monospace" },
                        maxRotation: 45
                    }
                },
                y: {
                    grid: { color: '#f1f5f9' },
                    ticks: {
                        color: '#64748b',
                        font: { size: 9, family: "'JetBrains Mono', monospace" }
                    }
                }
            }
        }
    });
}

function openModal(curveId) {
    const c = curvesData.curves.find(x => x.id === curveId);
    if (!c) return;

    document.getElementById('modalTitle').innerText = c.title;
    document.getElementById('modalMeta').innerText = `${c.category} • ${c.exchange || ''} • ${c.description || ''} (${c.unit || ''})`;

    const tbody = document.getElementById('modalTableBody');
    tbody.innerHTML = '';

    let pts = c.points;
    if (c.category === 'FX & Rates' && c.id !== 'curve_61') {
        pts = pts.filter(p => isFxTenorUpTo1Y(p.display_label || p.contract_code || p.label));
    }

    pts.forEach(p => {
        const v1 = (p.v1 !== null && p.v1 !== undefined) ? p.v1 : '--';
        const v2 = (p.v2 !== null && p.v2 !== undefined) ? p.v2 : '--';
        const v3 = (p.v3 !== null && p.v3 !== undefined) ? p.v3 : '--';

        let diff1d = '--', diff1dPct = '', diff1dClass = '';
        if (p.v3 !== null && p.v3 !== undefined && p.v2 !== null && p.v2 !== undefined) {
            const d = Math.round((p.v3 - p.v2) * 10000) / 10000;
            diff1d = d > 0 ? `+${d}` : `${d}`;
            diff1dClass = d > 0 ? 'pos' : (d < 0 ? 'neg' : '');
            if (p.v2 !== 0) {
                const pct = Math.round(((d / p.v2) * 100) * 100) / 100;
                diff1dPct = pct > 0 ? `(+${pct}%)` : `(${pct}%)`;
            }
        }

        let diff1m = '--', diff1mPct = '', diff1mClass = '';
        if (p.v3 !== null && p.v3 !== undefined && p.v1 !== null && p.v1 !== undefined) {
            const d = Math.round((p.v3 - p.v1) * 10000) / 10000;
            diff1m = d > 0 ? `+${d}` : `${d}`;
            diff1mClass = d > 0 ? 'pos' : (d < 0 ? 'neg' : '');
            if (p.v1 !== 0) {
                const pct = Math.round(((d / p.v1) * 100) * 100) / 100;
                diff1mPct = pct > 0 ? `(+${pct}%)` : `(${pct}%)`;
            }
        }

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${p.display_label || p.label}</strong></td>
            <td style="color: #2563eb;">${p.ric || '--'}</td>
            <td>${v1}</td>
            <td>${v2}</td>
            <td style="font-weight: 700;">${v3}</td>
            <td class="${diff1dClass}">${diff1d}</td>
            <td class="${diff1dClass}">${diff1dPct}</td>
            <td class="${diff1mClass}">${diff1m}</td>
            <td class="${diff1mClass}">${diff1mPct}</td>
        `;
        tbody.appendChild(tr);
    });

    if (modalChart) {
        try { modalChart.destroy(); } catch (e) {}
    }
    const canvas = document.getElementById('modalChartCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const labels = pts.map(p => p.display_label || p.label || p.ric);
    const d1Vals = pts.map(p => p.v1);
    const d2Vals = pts.map(p => p.v2);
    const d3Vals = pts.map(p => p.v3);

    const d1Date = (curvesData.dates && curvesData.dates.date1) ? curvesData.dates.date1.substring(0, 10) : 'Date 1';
    const d2Date = (curvesData.dates && curvesData.dates.date2) ? curvesData.dates.date2.substring(0, 10) : 'Date 2';
    const d3Date = (curvesData.dates && curvesData.dates.date3) ? curvesData.dates.date3.substring(0, 10) : 'Date 3';

    modalChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: `Date 1: ${d1Date}`,
                    data: d1Vals,
                    borderColor: '#2563eb',
                    borderWidth: 2,
                    borderDash: [5, 5],
                    pointRadius: 4,
                    pointBackgroundColor: '#2563eb',
                    tension: 0.15,
                    spanGaps: true
                },
                {
                    label: `Date 2: ${d2Date}`,
                    data: d2Vals,
                    borderColor: '#d97706',
                    borderWidth: 2.2,
                    pointRadius: 4.5,
                    pointBackgroundColor: '#d97706',
                    tension: 0.15,
                    spanGaps: true
                },
                {
                    label: `Date 3: ${d3Date}`,
                    data: d3Vals,
                    borderColor: '#059669',
                    borderWidth: 3,
                    pointRadius: 5.5,
                    pointBackgroundColor: '#059669',
                    pointBorderColor: '#ffffff',
                    tension: 0.15,
                    spanGaps: true
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    labels: {
                        color: '#1e293b',
                        font: { size: 12, family: "'Plus Jakarta Sans', sans-serif", weight: '700' }
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(15, 23, 42, 0.95)',
                    titleColor: '#ffffff',
                    bodyColor: '#cbd5e1',
                    padding: 10
                }
            },
            scales: {
                x: {
                    grid: { color: '#f1f5f9' },
                    ticks: {
                        color: '#475569',
                        font: { size: 11, family: "'JetBrains Mono', monospace" }
                    }
                },
                y: {
                    grid: { color: '#f1f5f9' },
                    ticks: {
                        color: '#475569',
                        font: { size: 11, family: "'JetBrains Mono', monospace" }
                    }
                }
            }
        }
    });

    document.getElementById('modalOverlay').style.display = 'flex';
}

function closeModal() {
    document.getElementById('modalOverlay').style.display = 'none';
    if (modalChart) {
        try { modalChart.destroy(); } catch (e) {}
        modalChart = null;
    }
}

function setupEventListeners() {
    document.querySelectorAll('#categoryTabs .tab-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('#categoryTabs .tab-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            activeCategory = this.getAttribute('data-cat');
            renderSegregatedCurves();
        });
    });

    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', function(e) {
            searchQuery = e.target.value.trim();
            renderSegregatedCurves();
        });
    }

    const modalOverlay = document.getElementById('modalOverlay');
    if (modalOverlay) {
        modalOverlay.addEventListener('click', function(e) {
            if (e.target === this) closeModal();
        });
    }

    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') closeModal();
    });
}

async function handleUpdateDates() {
    const d1 = document.getElementById('date1Input').value;
    const d2 = document.getElementById('date2Input').value;
    const d3 = document.getElementById('date3Input').value;

    if (!d1 || !d2 || !d3) {
        showToast('Please select all 3 dates.');
        return;
    }

    const btn = document.querySelector('.btn-update');
    const origHTML = btn.innerHTML;
    btn.innerHTML = `
        <svg class="spin-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
        </svg>
        <span>Updating LSEG...</span>
    `;
    btn.style.opacity = '0.7';
    btn.disabled = true;

    showToast(`Querying LSEG Workspace for ${d1}, ${d2}, ${d3}...`, 8000);

    const apiBase = window.location.protocol === 'file:' ? 'http://127.0.0.1:8050' : '';
    let success = false;

    // 1. Try local HTTP server first
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 60000);
        const resp = await fetch(apiBase + '/api/fetch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ date1: d1, date2: d2, date3: d3 }),
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        if (resp.ok) {
            const res = await resp.json();
            curvesData = res;
            renderSegregatedCurves();
            showToast(`✓ Successfully updated 66 markets from LSEG Workspace for ${d1}, ${d2}, ${d3}!`, 5000);
            checkLsegStatus();
            success = true;
        } else if (resp.status === 503) {
            const errData = await resp.json();
            showToast(`⚠️ ${errData.message || 'LSEG Workspace is closed. Please open Refinitiv Workspace on your PC and click Update Prices.'}`, 9000);
            checkLsegStatus();
            btn.innerHTML = origHTML;
            btn.style.opacity = '1';
            btn.disabled = false;
            return;
        }
    } catch (err) {
        // Server might be offline; fall back to background protocol handler
    }

    // 2. If server was offline, trigger Windows background updater protocol silently
    if (!success) {
        try {
            showToast('Launching background LSEG updater... Fetching 66 markets...', 10000);
            const iframe = document.createElement('iframe');
            iframe.style.display = 'none';
            iframe.src = `lseg-update://update?d1=${encodeURIComponent(d1)}&d2=${encodeURIComponent(d2)}&d3=${encodeURIComponent(d3)}`;
            document.body.appendChild(iframe);
            setTimeout(() => { try { iframe.remove(); } catch (e) {} }, 3000);

            // Poll for completion up to 45 seconds
            const startTime = Date.now();
            while (Date.now() - startTime < 45000) {
                await new Promise(r => setTimeout(r, 2000));
                try {
                    const checkResp = await fetch('http://127.0.0.1:8050/api/curves');
                    if (checkResp.ok) {
                        const checkData = await checkResp.json();
                        const curDates = checkData.dates || {};
                        if (curDates.date1 === d1 && curDates.date2 === d2 && curDates.date3 === d3) {
                            curvesData = checkData;
                            renderSegregatedCurves();
                            showToast(`✓ Successfully updated 66 markets from LSEG Workspace for ${d1}, ${d2}, ${d3}!`, 5000);
                            success = true;
                            break;
                        }
                    }
                } catch (e) {
                    // Server still starting up
                }
            }
            if (!success) {
                showToast('LSEG update in progress. Dashboard will refresh shortly.', 5000);
            }
        } catch (e) {
            showToast('Unable to start background updater: ' + e.message, 5000);
        }
    }

    btn.innerHTML = origHTML;
    btn.style.opacity = '1';
    btn.disabled = false;
}

function showToast(message, duration = 4500) {
    let toast = document.getElementById('toastNotification');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'toastNotification';
        toast.className = 'toast-notification';
        document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => {
        toast.classList.remove('show');
    }, duration);
}

function getYYMMDDSubject() {
    let d3 = (curvesData && curvesData.dates && curvesData.dates.date3) ? curvesData.dates.date3.substring(0, 10) : '';
    if (d3) {
        const parts = d3.split('-');
        if (parts.length === 3) {
            return parts[0].substring(2) + parts[1] + parts[2] + ' Daily Curve';
        }
    }
    const now = new Date();
    const yy = String(now.getFullYear()).substring(2);
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    return yy + mm + dd + ' Daily Curve';
}

function generateEmlBlob(base64Png, subject) {
    const boundary = "----=_Part_Snap_" + Math.random().toString(36).substring(2);
    const cleanB64 = base64Png.replace(/^data:image\/png;base64,/, '');
    const wrappedB64 = cleanB64.match(/.{1,76}/g).join('\r\n');

    const eml = 
`X-Unsent: 1\r
Subject: ${subject}\r
MIME-Version: 1.0\r
Content-Type: multipart/related; boundary="${boundary}"\r
\r
--${boundary}\r
Content-Type: text/html; charset="utf-8"\r
Content-Transfer-Encoding: 7bit\r
\r
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%;">
  <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="width: 100%; background-color: #f1f5f9; margin: 0; padding: 12px 0;">
    <tr>
      <td align="center" style="padding: 0 8px;">
        <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="max-width: 1600px; width: 100%; background-color: #ffffff; border: 1px solid #cbd5e1; border-radius: 8px;">
          <tr>
            <td align="center" style="padding: 0;">
              <img src="cid:dashboard_snapshot" alt="${subject}" width="100%" style="width: 100%; max-width: 100%; height: auto; display: block; margin: 0 auto; border-radius: 6px;" />
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>\r
\r
--${boundary}\r
Content-Type: image/png; name="Settlement_Dashboard.png"\r
Content-Transfer-Encoding: base64\r
Content-ID: <dashboard_snapshot>\r
Content-Disposition: inline; filename="Settlement_Dashboard.png"\r
\r
${wrappedB64}\r
\r
--${boundary}--\r
`;
    return new Blob([eml], { type: 'message/rfc822' });
}

async function exportToOutlook() {
    const btn = document.getElementById('btn-outlook') || document.querySelector('.btn-outlook');
    const originalHTML = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `
        <svg class="spin-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
        </svg>
        <span>Opening Outlook Classic...</span>
    `;

    const subject = getYYMMDDSubject();
    let opened = false;

    // 1. Try local HTTP dispatcher service first (port 8050)
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000);
        const resp = await fetch('http://127.0.0.1:8050/open_outlook', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ subject: subject }),
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        if (resp.ok) {
            opened = true;
            showToast(`Draft created in Outlook Classic: ${subject} (Send button enabled)!`);
        }
    } catch (e) {
        // Local HTTP service offline or slow; fall back to protocol handler
    }

    // 2. If HTTP service is offline, trigger registered Windows OS protocol handler directly
    // This directly executes outlook_draft_generator.py via pythonw.exe into Outlook Classic
    if (!opened) {
        try {
            const iframe = document.createElement('iframe');
            iframe.style.display = 'none';
            iframe.src = 'lseg-outlook:draft';
            document.body.appendChild(iframe);
            setTimeout(() => {
                try { iframe.remove(); } catch (e) {}
            }, 3000);
            opened = true;
            showToast(`Opening Outlook Classic: ${subject}...`);
        } catch (e) {
            console.error('Protocol handler error:', e);
        }
    }

    // 3. Simultaneously copy snapshot image to clipboard for convenient pasting
    try {
        const container = document.getElementById('mainContainer');
        if (typeof html2canvas !== 'undefined' && container) {
            html2canvas(container, {
                scale: 1.2,
                useCORS: true,
                logging: false,
                backgroundColor: '#f8fafc'
            }).then(canvas => {
                canvas.toBlob(async (blob) => {
                    if (blob && navigator.clipboard && navigator.clipboard.write) {
                        try {
                            await navigator.clipboard.write([
                                new ClipboardItem({ 'image/png': blob })
                            ]);
                        } catch (err) {}
                    }
                }, 'image/png');
            }).catch(() => {});
        }
    } catch (e) {}

    setTimeout(() => {
        btn.disabled = false;
        btn.innerHTML = originalHTML;
    }, 2500);
}

const handleCreateOutlookDraft = exportToOutlook;

// Ensure initDashboard runs when DOM is loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDashboard);
} else {
    initDashboard();
}
