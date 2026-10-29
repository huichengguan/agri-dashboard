/* ------------------ FORWARD CURVE FUNCTIONS (series-driven; live + historical as-of) ------------------ */
let curveAsOf = 'live';

function getCurveData() {
    if (curveAsOf === 'live') return curveData[curveActiveComm];
    const h = curveHistory && curveHistory.data ? curveHistory.data[curveAsOf] : null;
    return h ? h[curveActiveComm] : null;
}

function fmtDateLabel(iso) {
    const d = new Date(iso + 'T00:00:00');
    return d.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
}

function initCurveTabs() {
    const cTabs = document.getElementById('curve-comm-tabs');
    cTabs.innerHTML = '';
    Object.keys(curveData).forEach(comm => {
        const btn = document.createElement('button');
        btn.className = 'tab-btn' + (comm === curveActiveComm ? ' active' : '');
        btn.innerText = comm;
        btn.onclick = () => {
            curveActiveComm = comm;
            Array.from(cTabs.children).forEach(b => b.className = 'tab-btn' + (b.innerText === comm ? ' active' : ''));
            updateCurveChart();
        };
        cTabs.appendChild(btn);
    });
    initAsOfSelector();
}

function initAsOfSelector() {
    const sel = document.getElementById('curve-asof-select');
    if (!sel) return;
    sel.innerHTML = '';
    const live = document.createElement('option');
    live.value = 'live';
    live.textContent = 'Live — latest prints';
    sel.appendChild(live);
    const dates = (curveHistory && curveHistory.dates) ? curveHistory.dates : [];
    const grp1 = document.createElement('optgroup'); grp1.label = 'Last 7 working days';
    const grp2 = document.createElement('optgroup'); grp2.label = 'Weekly Thursdays (last 5 years)';
    dates.forEach((d, i) => {
        const o = document.createElement('option');
        o.value = d;
        o.textContent = fmtDateLabel(d);
        (i < 7 ? grp1 : grp2).appendChild(o);
    });
    sel.appendChild(grp1);
    sel.appendChild(grp2);
    sel.value = curveAsOf;
    sel.onchange = () => setCurveAsOf(sel.value);
}

function setCurveAsOf(v) {
    curveAsOf = v;
    const sel = document.getElementById('curve-asof-select');
    if (sel) sel.value = v;
    updateCurveChart();
}

function stepAsOf(dir) {
    // dir = +1 -> earlier date, -1 -> later date / live
    const order = ['live'].concat(curveHistory && curveHistory.dates ? curveHistory.dates : []);
    let i = order.indexOf(curveAsOf);
    i = Math.min(order.length - 1, Math.max(0, i + dir));
    setCurveAsOf(order[i]);
}

function setCurveMode(mode) {
    curveActiveMode = mode;
    const modeTabs = document.getElementById('curve-mode-tabs');
    Array.from(modeTabs.children).forEach(b => {
        if ((mode === 'flat' && b.innerText.includes('Outright Flat')) ||
            (mode === 'basis' && b.innerText.includes('Cash Basis'))) {
            b.className = 'tab-btn active';
        } else {
            b.className = 'tab-btn';
        }
    });
    updateCurveChart();
}

function cfText(asofMap, i) {
    return (asofMap && asofMap[i]) ? ` [CARRY-FORWARD from ${asofMap[i]}]` : '';
}

function seriesName(s, suffix) {
    return `${s.label} ${suffix}` + (s.tag ? ` (${s.tag})` : '');
}

function buildCurvePoints(months, arr, asofMap) {
    const x = [];
    const y = [];
    const customdata = [];
    let lastValidIdx = -1;

    for (let i = 0; i < months.length; i++) {
        const val = (arr && arr[i] !== null && arr[i] !== undefined) ? arr[i] : null;
        if (val !== null) {
            if (lastValidIdx !== -1 && (i - lastValidIdx) > 2) {
                // Gap is strictly greater than 2 months apart: break line
                x.push(months[lastValidIdx + 1]);
                y.push(null);
                customdata.push('');
            }
            // Gaps of 1 or 2 months are kept adjacent in the trace array,
            // so Plotly connects the 2 dots into a line without breaking
            x.push(months[i]);
            y.push(val);
            customdata.push(cfText(asofMap, i));
            lastValidIdx = i;
        }
    }
    return { x, y, customdata };
}

function updateCurveChart() {
    const data = getCurveData();
    const noteEl = document.getElementById('curve-asof-note');
    const titleElem = document.getElementById('curve-chart-title');
    const showFlat = (curveActiveMode === 'flat');

    if (!data) {
        Plotly.purge('curve-chart-container');
        document.getElementById('curve-chart-container').innerHTML =
            '<div style="padding:40px;text-align:center;color:#64748b;">No data available for this date.</div>';
        document.getElementById('curve-table-head').innerHTML = '';
        document.getElementById('curve-table-body').innerHTML = '';
        return;
    }

    const unit = showFlat ? data.unit : (data.basis_unit || data.unit);
    const perspectiveStr = showFlat ? 'Outright Flat Price (Futures + Basis)' : 'Cash Basis Curves';
    const asofStr = curveAsOf === 'live' ? '' : ` · as of ${fmtDateLabel(curveAsOf)}`;
    if (titleElem) titleElem.innerText = `${curveActiveComm} Forward Term Structure — ${perspectiveStr}${asofStr}`;

    if (noteEl) {
        if (curveAsOf === 'live') {
            noteEl.innerHTML = 'Showing latest live prints.';
        } else {
            noteEl.innerHTML = `Showing the <b>CBOT settlement and basis prints of ${curveAsOf}</b> ` +
                `(delivery months counted from that date). Values marked <b>*</b> / [CARRY-FORWARD] had no print that day and use the last print within ${4} days. ` +
                `Series whose delivery-month mapping can't be reconstructed historically are omitted for past dates.`;
        }
    }

    const traces = [];
    const hasVals = arr => arr && arr.some(v => v !== null);

    // 1. Benchmark Futures
    if (showFlat) {
        traces.push({
            x: data.months, y: (data.cbot_fut_vals || data.cbot_vals), mode: 'lines+markers',
            name: 'CBOT Futures Benchmark',
            legendgroup: 'bench',
            legendgrouptitle: { text: '<b>BENCHMARKS</b>' },
            connectgaps: true,
            line: { color: '#000000', width: 3.5, dash: 'dash' }, marker: { size: 7, color: '#000000' },
            customdata: data.cbot_subnames.map((n, i) => n + cfText(data.cbot_asof, i)),
            hovertemplate: '<b>CBOT Benchmark</b>: %{y} ' + data.cbot_unit + '<br>Contract: %{customdata}<extra></extra>'
        });
        if (data.kc && hasVals(data.kc.vals)) {
            traces.push({
                x: data.months, y: (data.kc.fut_vals || data.kc.vals), mode: 'lines+markers',
                name: 'KC HRW Futures',
                legendgroup: 'bench',
                connectgaps: true,
                line: { color: '#78350f', width: 2.5, dash: 'dot' }, marker: { size: 6, color: '#78350f' },
                customdata: data.kc.subnames.map((n, i) => n + cfText(data.kc.asof, i)),
                hovertemplate: '<b>KC HRW Futures</b>: %{y} ' + data.cbot_unit + '<br>Contract: %{customdata}<extra></extra>'
            });
        }
        if (data.eur_corn && hasVals(data.eur_corn.vals)) {
            traces.push({
                x: data.months, y: data.eur_corn.vals, mode: 'lines+markers',
                name: '🇪🇺 Euronext Maize (c/bu)',
                legendgroup: 'bench',
                connectgaps: true,
                line: { color: '#0284c7', width: 2.5, dash: 'dashdot' }, marker: { size: 6, color: '#0284c7' },
                customdata: data.eur_corn.subnames.map((n, i) => {
                    if (!n) return '';
                    const cf = cfText(data.eur_corn.asof, i);
                    const nv = data.eur_corn.native_vals[i];
                    const usdMt = (data.eur_corn.usd_mt_vals && data.eur_corn.usd_mt_vals[i] !== null) ? data.eur_corn.usd_mt_vals[i].toFixed(2) : 'N/A';
                    return `${n} ($${usdMt}/MT · ${nv !== null ? nv.toFixed(2) : 'N/A'} EUR)${cf}`;
                }),
                hovertemplate: '<b>Euronext Maize Futures</b>: %{y} c/bu<br>Contract: %{customdata}<extra></extra>'
            });
        }
        if (data.eur_wheat && hasVals(data.eur_wheat.vals)) {
            traces.push({
                x: data.months, y: data.eur_wheat.vals, mode: 'lines+markers',
                name: '🇪🇺 Euronext Wheat (c/bu)',
                legendgroup: 'bench',
                connectgaps: true,
                line: { color: '#0284c7', width: 2.5, dash: 'dashdot' }, marker: { size: 6, color: '#0284c7' },
                customdata: data.eur_wheat.subnames.map((n, i) => {
                    if (!n) return '';
                    const cf = cfText(data.eur_wheat.asof, i);
                    const nv = data.eur_wheat.native_vals[i];
                    const usdMt = (data.eur_wheat.usd_mt_vals && data.eur_wheat.usd_mt_vals[i] !== null) ? data.eur_wheat.usd_mt_vals[i].toFixed(2) : 'N/A';
                    return `${n} ($${usdMt}/MT · ${nv !== null ? nv.toFixed(2) : 'N/A'} EUR)${cf}`;
                }),
                hovertemplate: '<b>Euronext Milling Wheat</b>: %{y} c/bu<br>Contract: %{customdata}<extra></extra>'
            });
        }
        if (data.ice_wheat && hasVals(data.ice_wheat.vals)) {
            traces.push({
                x: data.months, y: data.ice_wheat.vals, mode: 'lines+markers',
                name: '🇬🇧 ICE Feed Wheat (c/bu)',
                legendgroup: 'bench',
                connectgaps: true,
                line: { color: '#d97706', width: 2.5, dash: 'dot' }, marker: { size: 6, color: '#d97706' },
                customdata: data.ice_wheat.subnames.map((n, i) => {
                    if (!n) return '';
                    const cf = cfText(data.ice_wheat.asof, i);
                    const nv = data.ice_wheat.native_vals[i];
                    const usdMt = (data.ice_wheat.usd_mt_vals && data.ice_wheat.usd_mt_vals[i] !== null) ? data.ice_wheat.usd_mt_vals[i].toFixed(2) : 'N/A';
                    return `${n} ($${usdMt}/MT · ${nv !== null ? nv.toFixed(2) : 'N/A'} GBP)${cf}`;
                }),
                hovertemplate: '<b>ICE London Feed Wheat</b>: %{y} c/bu<br>Contract: %{customdata}<extra></extra>'
            });
        }
    }

    // 2. Origins (USA, Brazil, Argentina) — connect if <= 2 months apart; gaps > 2 stay isolated
    const originSeries = data.series.filter(s => s.loc_type !== 'dest');
    let firstOrigin = true;
    originSeries.forEach(s => {
        const arr = showFlat ? s.flat : s.basis;
        if (!hasVals(arr)) return;
        const asof = showFlat ? s.flat_asof : s.basis_asof;
        const pts = buildCurvePoints(data.months, arr, asof);
        const trace = {
            x: pts.x, y: pts.y, mode: 'lines+markers',
            name: seriesName(s, showFlat ? 'Flat' : 'Basis'),
            legendgroup: 'origin',
            line: { color: s.color, width: 2.5 },
            marker: { size: 6, color: s.color },
            connectgaps: false,
            customdata: pts.customdata,
            hovertemplate: `<b>${s.label} ${showFlat ? 'Flat' : 'Basis'}</b>: %{y} ${unit}%{customdata}<extra></extra>`,
        };
        if (firstOrigin) {
            trace.legendgrouptitle = { text: '<b>ORIGINS (US · Brazil · Argentina)</b>' };
            firstOrigin = false;
        }
        traces.push(trace);
    });

    // 3. Destinations (Europe, China) — connect if <= 2 months apart; gaps > 2 stay isolated
    const destSeries = data.series.filter(s => s.loc_type === 'dest');
    let firstDest = true;
    destSeries.forEach(s => {
        const arr = showFlat ? s.flat : s.basis;
        if (!hasVals(arr)) return;
        const asof = showFlat ? s.flat_asof : s.basis_asof;
        const pts = buildCurvePoints(data.months, arr, asof);
        const trace = {
            x: pts.x, y: pts.y, mode: 'lines+markers',
            name: seriesName(s, showFlat ? 'Flat' : 'Basis'),
            legendgroup: 'dest',
            line: { color: s.color, width: 2.5 },
            marker: { size: 6, color: s.color },
            connectgaps: false,
            customdata: pts.customdata,
            hovertemplate: `<b>${s.label} ${showFlat ? 'Flat' : 'Basis'}</b>: %{y} ${unit}%{customdata}<extra></extra>`,
        };
        if (firstDest) {
            trace.legendgrouptitle = { text: '<b>DESTINATIONS (Europe · China)</b>' };
            firstDest = false;
        }
        traces.push(trace);
    });

    const layout = {
        xaxis: {
            title: 'Contract Delivery Month / Tenor',
            categoryorder: 'array',
            categoryarray: data.months,
            showgrid: true,
            gridcolor: '#f1f5f9'
        },
        yaxis: { title: (showFlat ? 'Flat Price / CBOT' : 'Cash Basis') + ` (${unit})`, showgrid: true, gridcolor: '#e2e8f0', zeroline: true, zerolinecolor: '#cbd5e1' },
        plot_bgcolor: 'white', paper_bgcolor: 'white', hovermode: 'x unified',
        legend: {
            orientation: 'h',
            yanchor: 'bottom',
            y: 1.02,
            xanchor: 'center',
            x: 0.5,
            groupclick: 'toggleitem'
        },
        margin: { t: 65, l: 65, r: 30, b: 55 }
    };

    const container = document.getElementById('curve-chart-container');
    container.innerHTML = '';
    Plotly.newPlot('curve-chart-container', traces, layout, { responsive: true }).then(() => {
        syncCatPillButtons();
        attachLegendTitleHandlers();
        container.on('plotly_restyle', () => {
            syncCatPillButtons();
            setTimeout(attachLegendTitleHandlers, 50);
        });
    });
    renderCurveTable(data);
}

function toggleCurveCategory(grpKey) {
    const el = document.getElementById('curve-chart-container');
    if (!el || !el.data) return;
    const indices = [];
    el.data.forEach((t, i) => {
        if (t.legendgroup === grpKey) indices.push(i);
    });
    if (indices.length === 0) return;
    const anyVis = indices.some(i => el.data[i].visible !== 'legendonly' && el.data[i].visible !== false);
    const newVis = anyVis ? 'legendonly' : true;
    Plotly.restyle('curve-chart-container', { visible: newVis }, indices);
    syncCatPillButtons();
    setTimeout(attachLegendTitleHandlers, 100);
}

function syncCatPillButtons() {
    const el = document.getElementById('curve-chart-container');
    if (!el || !el.data) return;
    const groups = ['bench', 'origin', 'dest'];
    groups.forEach(g => {
        const btn = document.getElementById('pill-cat-' + g);
        const stateEl = document.getElementById('state-cat-' + g);
        if (!btn) return;
        const groupTraces = el.data.filter(t => t.legendgroup === g);
        if (groupTraces.length === 0) {
            btn.style.display = 'none';
            return;
        }
        btn.style.display = 'inline-flex';
        const visCount = groupTraces.filter(t => t.visible !== 'legendonly' && t.visible !== false).length;
        if (visCount === groupTraces.length) {
            btn.className = 'cat-pill-btn active';
            if (stateEl) stateEl.innerText = 'ALL ON';
        } else if (visCount === 0) {
            btn.className = 'cat-pill-btn off';
            if (stateEl) stateEl.innerText = 'ALL OFF';
        } else {
            btn.className = 'cat-pill-btn active';
            if (stateEl) stateEl.innerText = `${visCount}/${groupTraces.length} ON`;
        }
    });
}

function attachLegendTitleHandlers() {
    const chart = document.getElementById('curve-chart-container');
    if (!chart) return;
    const titles = chart.querySelectorAll('.legendgrouptitletext');
    titles.forEach(el => {
        el.style.cursor = 'pointer';
        el.title = 'Click to toggle all in this category';
        el.onclick = (e) => {
            e.stopPropagation();
            const txt = (el.textContent || '').toUpperCase();
            if (txt.includes('BENCHMARK')) toggleCurveCategory('bench');
            else if (txt.includes('ORIGIN')) toggleCurveCategory('origin');
            else if (txt.includes('DESTINATION')) toggleCurveCategory('dest');
        };
    });
}

function renderCurveTable(data) {
    const thead = document.getElementById('curve-table-head');
    const tbody = document.getElementById('curve-table-body');
    const unit = data.unit;
    const groups = data.series.filter(s => (s.basis && s.basis.some(v => v !== null)) || (s.flat && s.flat.some(v => v !== null)));
    const hasKC = data.kc && data.kc.vals.some(v => v !== null);
    const hasEurCorn = data.eur_corn && data.eur_corn.vals.some(v => v !== null);
    const hasEurWheat = data.eur_wheat && data.eur_wheat.vals.some(v => v !== null);
    const hasIceWheat = data.ice_wheat && data.ice_wheat.vals.some(v => v !== null);

    let r1 = `<tr>
        <th rowspan="2" class="col-sticky-1" style="text-align:left; vertical-align:middle;">Delivery Month</th>
        <th rowspan="2" class="col-sticky-2" style="text-align:left; vertical-align:middle;">CBOT Contract</th>
        <th rowspan="2" class="col-sticky-3 col-cbot-head cell-cbot">
            <div class="cbot-th-title">CBOT</div>
            <div class="cbot-th-unit">(${data.cbot_unit})</div>
        </th>` +
        (hasKC ? `<th rowspan="2" class="col-num col-cbot-head cell-cbot">
            <div class="cbot-th-title">KC HRW</div>
            <div class="cbot-th-unit">(${data.cbot_unit})</div>
        </th>` : '') +
        (hasEurCorn ? `<th rowspan="2" class="col-num col-eur-head cell-eur" title="Euronext Paris Maize converted to cents/bu (EUR/MT converted via EUR/USD and MT/bu factor)">
            <div class="cbot-th-title">Euronext Maize</div>
            <div class="cbot-th-unit">(cents/bu)</div>
        </th>` : '') +
        (hasEurWheat ? `<th rowspan="2" class="col-num col-eur-head cell-eur" title="Euronext Paris Milling Wheat No. 2 converted to cents/bu (EUR/MT converted via EUR/USD and MT/bu factor)">
            <div class="cbot-th-title">Euronext Wheat</div>
            <div class="cbot-th-unit">(cents/bu)</div>
        </th>` : '') +
        (hasIceWheat ? `<th rowspan="2" class="col-num col-ice-head cell-ice" title="ICE Europe London Feed Wheat converted to cents/bu (GBP/MT converted via GBP/USD and MT/bu factor)">
            <div class="cbot-th-title">ICE Feed Wheat</div>
            <div class="cbot-th-unit">(cents/bu)</div>
        </th>` : '');

    let r2 = '<tr>';
    groups.forEach(g => {
        const isDest = (g.loc_type === 'dest');
        const badgeHtml = isDest
            ? '<span class="badge badge-dest">DEST</span>'
            : '<span class="badge badge-origin">ORIGIN</span>';
        r1 += `<th colspan="2" class="group-header group-start" title="${g.tag || ''}">
            <div style="display:flex; align-items:center; justify-content:center; gap:5px; margin-bottom:2px;">
                ${badgeHtml}
                <span>${g.label}</span>
            </div>
            ${g.tag ? `<div class="grp-tag">${g.tag}</div>` : ''}
        </th>`;
        r2 += `<th class="sub-th col-num group-start">Basis</th><th class="sub-th col-num">Flat Price</th>`;
    });
    r1 += '</tr>'; r2 += '</tr>';
    thead.innerHTML = r1 + r2;

    const fmt = v => v !== null && v !== undefined ? v.toFixed(2) : '<span class="na-val">N/A</span>';
    const cell = (v, asofMap, i, cls) => {
        const cf = v !== null && asofMap && asofMap[i];
        return `<td class="${cls}${cf ? ' cf-cell' : ''}"${cf ? ` title="[CARRY-FORWARD from ${asofMap[i]}]"` : ''}>${fmt(v)}${cf ? '*' : ''}</td>`;
    };
    const cellWithSub = (cbuVal, usdMtVal, natVal, curr, subname, asofMap, i, cls) => {
        if (cbuVal === null || cbuVal === undefined) {
            return `<td class="${cls}" style="color:#94a3b8; text-align:right; font-weight:normal;">—</td>`;
        }
        const cf = asofMap && asofMap[i];
        const tip = `${subname}: ${fmt(cbuVal)} c/bu ($${usdMtVal !== null ? usdMtVal.toFixed(2) : 'N/A'}/MT · ${natVal !== null ? natVal.toFixed(2) : 'N/A'} ${curr}/MT)` + (cf ? ` [CARRY-FORWARD from ${asofMap[i]}]` : '');
        return `<td class="${cls}${cf ? ' cf-cell' : ''}" title="${tip}">
            <div>${fmt(cbuVal)}${cf ? '*' : ''}</div>
            <div class="bench-sub-txt">$${usdMtVal !== null ? usdMtVal.toFixed(1) : ''}/mt · ${natVal !== null ? natVal.toFixed(0) : ''} ${curr}</div>
        </td>`;
    };

    tbody.innerHTML = '';
    data.months.forEach((m, i) => {
        const tr = document.createElement('tr');
        let h = `<td class="col-sticky-1">${m}</td>
            <td class="col-sticky-2"><span class="badge badge-cbot">${data.cbot_subnames[i] || 'N/A'}</span></td>` +
            cell(data.cbot_vals[i], data.cbot_asof, i, 'col-sticky-3 cell-cbot') +
            (hasKC ? cell(data.kc.vals[i], data.kc.asof, i, 'col-num cell-cbot') : '') +
            (hasEurCorn ? cellWithSub(data.eur_corn.vals[i], data.eur_corn.usd_mt_vals ? data.eur_corn.usd_mt_vals[i] : null, data.eur_corn.native_vals[i], data.eur_corn.native_curr, data.eur_corn.subnames[i], data.eur_corn.asof, i, 'col-num cell-eur') : '') +
            (hasEurWheat ? cellWithSub(data.eur_wheat.vals[i], data.eur_wheat.usd_mt_vals ? data.eur_wheat.usd_mt_vals[i] : null, data.eur_wheat.native_vals[i], data.eur_wheat.native_curr, data.eur_wheat.subnames[i], data.eur_wheat.asof, i, 'col-num cell-eur') : '') +
            (hasIceWheat ? cellWithSub(data.ice_wheat.vals[i], data.ice_wheat.usd_mt_vals ? data.ice_wheat.usd_mt_vals[i] : null, data.ice_wheat.native_vals[i], data.ice_wheat.native_curr, data.ice_wheat.subnames[i], data.ice_wheat.asof, i, 'col-num cell-ice') : '');

        groups.forEach(g => {
            const b = g.basis[i], f = g.flat[i];
            h += cell(b, g.basis_asof, i, 'col-num cell-basis group-start');
            h += cell(f, g.flat_asof, i, 'col-num cell-flat');
        });
        tr.innerHTML = h;
        tbody.appendChild(tr);
    });
}
