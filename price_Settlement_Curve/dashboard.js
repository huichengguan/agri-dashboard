let curvesData = null;
let activeCategory = 'all';
let searchQuery = '';
let chartsInstances = {};
let modalChart = null;

// Category Config with 'Curve' word removed from all titles
const CATEGORY_CONFIG = [
    { key: 'Energy', title: 'Energy', icon: '⚡' },
    { key: 'Grains & Oilseeds', title: 'Grains & Oilseeds', icon: '🌾' },
    { key: 'Softs', title: 'Soft Commodities', icon: '☕' },
    { key: 'Livestock & Dairy', title: 'Livestock & Dairy', icon: '🥩' },
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

function formatYYYYMMDD(d) {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// Price modes, mirroring the two workbooks (Settlement Prices Official / Settlement Prices Daily Curve)
const MODE_STORAGE_KEY = 'settlementCurveMode';
const MODE_INFO = {
    official: { name: 'Official', d3: 'Settlement', subtitle: 'Official settlement prices for all 3 dates' },
    daily: { name: 'Daily', d3: 'Latest', subtitle: 'Dates 1 & 2 settlement \u2022 Date 3 latest price (CF_LAST)' }
};

// The mode of the prices on screen (not necessarily the one selected for the next update)
function dataMode() {
    return (curvesData && MODE_INFO[curvesData.mode]) ? curvesData.mode : 'official';
}

function getSelectedMode() {
    const btn = document.querySelector('#modeToggle .mode-btn.active');
    return btn && MODE_INFO[btn.dataset.mode] ? btn.dataset.mode : dataMode();
}

function setSelectedMode(mode) {
    if (!MODE_INFO[mode]) return;
    document.querySelectorAll('#modeToggle .mode-btn').forEach(b => b.classList.toggle('active', b.dataset.mode === mode));
    try { localStorage.setItem(MODE_STORAGE_KEY, mode); } catch (e) {}
}

function storedMode() {
    try {
        const m = localStorage.getItem(MODE_STORAGE_KEY);
        return MODE_INFO[m] ? m : null;
    } catch (e) {
        return null;
    }
}

function date3Label(d3Date) {
    return `${d3Date} ${MODE_INFO[dataMode()].d3}`;
}

function escapeHtml(text) {
    return String(text).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

// Labels and warnings that depend on which prices are on screen
function applyDataLabels() {
    const info = MODE_INFO[dataMode()];
    const sub = document.getElementById('modeSubtitle');
    if (sub) sub.textContent = `${info.subtitle} \u2022 Powered by LSEG Workspace API`;
    const th = document.getElementById('d3Header');
    if (th) th.textContent = `Date 3 ${info.d3}`;
    const notesEl = document.getElementById('dataNotes');
    if (notesEl) {
        const notes = (curvesData && curvesData.notes) || [];
        notesEl.innerHTML = notes.length ? '<ul>' + notes.map(n => `<li>${escapeHtml(n)}</li>`).join('') + '</ul>' : '';
        notesEl.hidden = notes.length === 0;
    }
}

// Show the last saved update for a mode; returns false when that mode has none yet
async function switchMode(mode) {
    setSelectedMode(mode);
    if (mode === dataMode()) return true;
    const ok = await refreshFromServer(mode);
    if (!ok) showToast(`No ${MODE_INFO[mode].name} prices saved yet. Choose the dates and click Update Prices.`, 6000);
    return ok;
}

function syncDateInputs() {
    if (!curvesData || !curvesData.dates) return;
    const d1Input = document.getElementById('date1Input');
    const d2Input = document.getElementById('date2Input');
    const d3Input = document.getElementById('date3Input');
    if (d1Input && curvesData.dates.date1) d1Input.value = curvesData.dates.date1.substring(0, 10);
    if (d2Input && curvesData.dates.date2) d2Input.value = curvesData.dates.date2.substring(0, 10);
    if (d3Input && curvesData.dates.date3) d3Input.value = curvesData.dates.date3.substring(0, 10);
}

function handleDate3AutoFill() {
    const d3Input = document.getElementById('date3Input');
    const d2Input = document.getElementById('date2Input');
    const d1Input = document.getElementById('date1Input');
    if (!d3Input || !d3Input.value) return;

    const parts = d3Input.value.split('-');
    if (parts.length !== 3) return;
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) - 1;
    const d = parseInt(parts[2], 10);
    const d3Date = new Date(y, m, d);
    if (isNaN(d3Date.getTime())) return;

    // Roll Saturday/Sunday back to the preceding Friday
    const prevWeekday = (dt) => {
        while (dt.getDay() === 0 || dt.getDay() === 6) dt.setDate(dt.getDate() - 1);
        return dt;
    };

    // Date 2 = previous weekday before Date 3
    const d2Date = new Date(d3Date);
    d2Date.setDate(d2Date.getDate() - 1);
    prevWeekday(d2Date);

    // Date 1 = Date 3 - 28 days
    const d1Date = new Date(d3Date);
    d1Date.setDate(d1Date.getDate() - 28);
    prevWeekday(d1Date);

    if (d2Input) d2Input.value = formatYYYYMMDD(d2Date);
    if (d1Input) d1Input.value = formatYYYYMMDD(d1Date);
}

function initDashboard() {
    curvesData = loadCurvesData();
    if (!curvesData || !curvesData.curves) {
        console.error('curvesData is missing or invalid.');
        document.getElementById('mainContainer').innerHTML = '<div style="text-align: center; padding: 60px; color: #64748b; font-size: 16px;">Failed to load data. Please refresh or run settlement_engine.py.</div>';
        return;
    }
    syncDateInputs();
    setSelectedMode(storedMode() || dataMode());
    applyDataLabels();
    renderSegregatedCurves();
    setupEventListeners();
    checkLsegStatus();
    resumePendingUpdate();
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
                    label: `Date 3: ${date3Label(d3Date)}`,
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

    document.querySelectorAll('#modeToggle .mode-btn').forEach(btn => {
        btn.addEventListener('click', () => switchMode(btn.dataset.mode));
    });

    const d3Input = document.getElementById('date3Input');
    if (d3Input) {
        d3Input.addEventListener('change', handleDate3AutoFill);
        d3Input.addEventListener('input', handleDate3AutoFill);
    }

    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') closeModal();
    });
}

const API_BASE = window.location.protocol === 'file:' ? 'http://127.0.0.1:8050' : '';
const UPDATE_STALE_MS = 15 * 60 * 1000;

function setDateInputs(dates) {
    if (!dates) return;
    const ids = { date1: 'date1Input', date2: 'date2Input', date3: 'date3Input' };
    Object.keys(ids).forEach(k => {
        const el = document.getElementById(ids[k]);
        if (el && dates[k]) el.value = String(dates[k]).substring(0, 10);
    });
}

function setUpdateButtonBusy(busy) {
    const btn = document.querySelector('.btn-update');
    if (!btn) return;
    if (busy) {
        if (!btn.dataset.origHtml) btn.dataset.origHtml = btn.innerHTML;
        btn.innerHTML = `
        <svg class="spin-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
        </svg>
        <span>Updating LSEG...</span>
    `;
        btn.style.opacity = '0.7';
        btn.disabled = true;
    } else {
        if (btn.dataset.origHtml) btn.innerHTML = btn.dataset.origHtml;
        delete btn.dataset.origHtml;
        btn.style.opacity = '1';
        btn.disabled = false;
    }
}

async function fetchUpdateStatus() {
    try {
        const resp = await fetch(API_BASE + '/api/status', { cache: 'no-store' });
        if (!resp.ok) return null;
        const st = await resp.json();
        // A 'fetching' status left behind by a crashed updater must not block the page forever
        if (st.status === 'fetching' && st.timestamp) {
            const started = new Date(st.timestamp.replace(' ', 'T'));
            if (!isNaN(started.getTime()) && Date.now() - started.getTime() > UPDATE_STALE_MS) st.status = 'stale';
        }
        return st;
    } catch (e) {
        return null;
    }
}

// Load the latest saved curves from the server (the copy embedded in index.html can be older)
async function refreshFromServer(mode) {
    try {
        const query = mode ? '?mode=' + encodeURIComponent(mode) : '';
        const resp = await fetch(API_BASE + '/api/curves' + query, { cache: 'no-store' });
        if (!resp.ok) return false;
        const data = await resp.json();
        if (!data || !data.curves) return false;
        const changed = !curvesData || curvesData.last_updated !== data.last_updated;
        curvesData = data;
        const jsonEl = document.getElementById('curvesDataJson');
        if (jsonEl) jsonEl.textContent = JSON.stringify(data);
        syncDateInputs();
        applyDataLabels();
        if (changed) renderSegregatedCurves();
        return true;
    } catch (e) {
        return false;
    }
}

// Poll the server until the running update finishes, keeping the requested dates in the inputs
async function waitForUpdate(requested, maxWaitMs = 16 * 60 * 1000) {
    setUpdateButtonBusy(true);
    setDateInputs(requested);
    const startTime = Date.now();
    let sawRunning = false;
    try {
        while (Date.now() - startTime < maxWaitMs) {
            await new Promise(r => setTimeout(r, 2000));
            const st = await fetchUpdateStatus();
            if (!st) continue; // server still starting up
            if (st.status === 'fetching' || st.status === 'starting') {
                sawRunning = true;
                if (st.data && st.data.date3) setDateInputs(st.data);
                if (st.data && st.data.mode) setSelectedMode(st.data.mode);
                continue;
            }
            if (st.status === 'completed') {
                const d = st.data || {};
                // Ignore a 'completed' left over from a previous run until ours has been seen running
                if (!sawRunning && requested && (d.date3 !== requested.date3 || (requested.mode && d.mode !== requested.mode)) && Date.now() - startTime < 20000) continue;
                await refreshFromServer(d.mode || (requested && requested.mode));
                const modeName = MODE_INFO[d.mode] ? ` (${MODE_INFO[d.mode].name})` : '';
                const warn = (d.notes && d.notes.length) ? ` ${d.notes.length} warning(s) shown above the charts.` : '';
                showToast(`✓ Updated ${d.total_curves || 66} markets${modeName} for ${d.date1}, ${d.date2}, ${d.date3}.${warn}`, 6000);
                checkLsegStatus();
                return true;
            }
            if (st.status === 'error') {
                showToast(`⚠️ ${st.message || 'LSEG update failed.'}`, 9000);
                syncDateInputs();
                checkLsegStatus();
                return false;
            }
        }
        showToast('LSEG update is still running. Refresh the page later to see it.', 6000);
        return false;
    } finally {
        setUpdateButtonBusy(false);
    }
}

// On page load: pick up the newest saved data, and if an update is still running show its dates and wait for it
async function resumePendingUpdate() {
    const st = await fetchUpdateStatus();
    if (st && (st.status === 'fetching' || st.status === 'starting')) {
        const d = st.data || {};
        if (d.date3) showToast(`LSEG update in progress for ${d.date1}, ${d.date2}, ${d.date3}...`, 6000);
        await waitForUpdate(d.date3 ? d : null);
    } else if (!(await refreshFromServer(getSelectedMode()))) {
        await refreshFromServer();
    }
}

async function handleUpdateDates() {
    const d1 = document.getElementById('date1Input').value;
    const d2 = document.getElementById('date2Input').value;
    const d3 = document.getElementById('date3Input').value;

    if (!d1 || !d2 || !d3) {
        showToast('Please select all 3 dates.');
        return;
    }
    const mode = getSelectedMode();
    const requested = { date1: d1, date2: d2, date3: d3, mode: mode };

    setUpdateButtonBusy(true);
    showToast(`Querying LSEG Workspace (${MODE_INFO[mode].name}) for ${d1}, ${d2}, ${d3}...`, 8000);

    // 1. Ask the local server to start the update (it runs in the background; we poll its status)
    let resp = null;
    try {
        resp = await fetch(API_BASE + '/api/fetch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requested)
        });
    } catch (err) {
        resp = null; // server offline
    }

    if (resp && resp.status === 503) {
        const errData = await resp.json().catch(() => ({}));
        showToast(`⚠️ ${errData.message || 'LSEG Workspace is closed. Please open Refinitiv Workspace on your PC and click Update Prices.'}`, 9000);
        checkLsegStatus();
        setUpdateButtonBusy(false);
        return;
    }
    if (resp && resp.status === 409) {
        showToast('An LSEG update is already running. Waiting for it to finish...', 6000);
        const st = await fetchUpdateStatus();
        await waitForUpdate(st && st.data && st.data.date3 ? st.data : null);
        return;
    }
    if (resp && resp.ok) {
        await waitForUpdate(requested);
        return;
    }

    // 2. Server offline: trigger the Windows background updater protocol (it also starts the server)
    try {
        showToast('Launching background LSEG updater... Fetching 66 markets...', 10000);
        const iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        iframe.src = `lseg-update://update?d1=${encodeURIComponent(d1)}&d2=${encodeURIComponent(d2)}&d3=${encodeURIComponent(d3)}&mode=${encodeURIComponent(mode)}`;
        document.body.appendChild(iframe);
        setTimeout(() => { try { iframe.remove(); } catch (e) {} }, 3000);
        await waitForUpdate(requested);
    } catch (e) {
        showToast('Unable to start background updater: ' + e.message, 5000);
        setUpdateButtonBusy(false);
    }
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
            body: JSON.stringify({ subject: subject, mode: dataMode() }),
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
