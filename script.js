// script.js
// This file is used by index.html
// Depends on: PapaParse (loaded in index.html) and Plotly

// Month filename mapping
const monthFileMap = {
    'june': 'june.csv',
    'july': 'july.csv',
    'august': 'august.csv',
    'september': 'september.csv',
    'overall': 'overall_monsoon.csv'
};

document.getElementById('loadBtn').addEventListener('click', () => {
    const year = document.getElementById('yearSelect').value;
    const month = document.getElementById('monthSelect').value;
    loadMonthData(year, month);
});

// helper: fetch CSV and parse via PapaParse; returns array of objects or null
async function loadCSV(path) {
    try {
        const res = await fetch(path);
        if (!res.ok) return null;
        const text = await res.text();
        const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
        return parsed.data;
    } catch (e) {
        console.error('CSV load error', path, e);
        return null;
    }
}

// normalize column keys - find the keys for district, actual, normal, departure
function detectColumns(rowObj) {
    const keys = Object.keys(rowObj || {});
    const o = { district: null, actual: null, normal: null, departure: null };
    keys.forEach(k => {
        const kn = k.trim().toLowerCase();
        if (kn.includes('district') || kn.includes('dist') || kn.includes('district name')) o.district = k;
        else if (kn.includes('actual') || kn.includes('actual r') || kn.includes('actual rf') || kn.includes('actual r/f')) o.actual = k;
        else if (kn.includes('normal') || kn.includes('normal r') || kn.includes('normal rf')) o.normal = k;
        else if (kn.includes('departure') || kn.includes('dep') || kn.includes('%')) o.departure = k;
    });
    // fallback: assign by position if null
    if (!o.district && keys.length>=1) o.district = keys[1] || keys[0];
    if (!o.actual && keys.length>=2) o.actual = keys[2] || keys[1];
    if (!o.normal && keys.length>=3) o.normal = keys[3] || keys[2];
    if (!o.departure && keys.length>=4) o.departure = keys[4] || keys[3];
    return o;
}

function safeNum(v){
    if (v===null || v===undefined) return NaN;
    const n = (''+v).replace(/,/g,'').trim();
    return isNaN(Number(n)) ? NaN : Number(n);
}

async function loadMonthData(year, month) {
    const status = document.getElementById('statusMessage');
    const barNotice = document.getElementById('barNotice');
    const depNotice = document.getElementById('depNotice');
    status.textContent = '';
    barNotice.textContent = '';
    depNotice.textContent = '';

    const fileName = monthFileMap[month] || `${month}.csv`;
    const path = `data/${year}/${fileName}`;

    const raw = await loadCSV(path);

    if (!raw || raw.length === 0) {
        // show "data not available" in UI areas
        status.textContent = `इस महीने का डेटा उपलब्ध नहीं है (${month}, ${year})`;
        document.getElementById('avgRain').textContent = '—';
        document.getElementById('avgDep').textContent = '—';
        document.getElementById('defCount').textContent = '—';
        document.getElementById('barChart').innerHTML = `<div class="p-6 text-red-600">इस महीने का डेटा उपलब्ध नहीं है (${month}, ${year})</div>`;
        document.getElementById('depChart').innerHTML = `<div class="p-6 text-red-600">इस महीने का डेटा उपलब्ध नहीं है (${month}, ${year})</div>`;
        document.getElementById('tableArea').innerHTML = '';
        return;
    }

    // detect columns
    const cols = detectColumns(raw[0]);

    // prepare arrays
    const districts = [];
    const actuals = [];
    const normals = [];
    const deps = [];

    for (const r of raw) {
        const d = (r[cols.district] || '').trim();
        if (!d) continue;
        const a = safeNum(r[cols.actual]);
        const n = safeNum(r[cols.normal]);
        let dp = safeNum(r[cols.departure]);
        // if departure not numeric but actual/normal exist, compute
        if (isNaN(dp) && !isNaN(a) && !isNaN(n) && n !== 0) {
            dp = ((a - n) / n) * 100;
        }
        districts.push(d);
        actuals.push(isNaN(a)?null:a);
        normals.push(isNaN(n)?null:n);
        deps.push(isNaN(dp)?null:Math.round(dp));
    }

    // summary stats
    const validActuals = actuals.filter(v=>v!==null && !isNaN(v));
    const avgRain = validActuals.length ? (validActuals.reduce((s,v)=>s+v,0)/validActuals.length).toFixed(1) : '—';
    const validDeps = deps.filter(v=>v!==null && !isNaN(v));
    const avgDep = validDeps.length ? (validDeps.reduce((s,v)=>s+v,0)/validDeps.length).toFixed(1) : '—';
    const deficitCount = validDeps.filter(v=>v < 0).length;

    document.getElementById('avgRain').textContent = avgRain === '—' ? '—' : `${avgRain} मिमी`;
    document.getElementById('avgDep').textContent = avgDep === '—' ? '—' : `${avgDep} %`;
    document.getElementById('defCount').textContent = deficitCount;

    // render charts
    renderBarChart(districts, actuals, normals);
    renderDepChart(districts, deps);

    // render table
    renderTable(districts, actuals, normals, deps);
}

function renderBarChart(districts, actuals, normals) {
    const x = districts;
    const trace1 = { x, y: actuals, name: 'Actual', type: 'bar' };
    const trace2 = { x, y: normals, name: 'Normal', type: 'bar' };
    const layout = {
        barmode: 'group',
        margin: { t: 30, b: 160 },
        xaxis: { tickangle: -45, automargin: true },
        legend: { orientation: 'h', y: 1.05 },
    };
    Plotly.react('barChart', [trace1, trace2], layout, {responsive:true});
}

function renderDepChart(districts, deps) {
    const colors = deps.map(v => {
        if (v === null || isNaN(v)) return '#9CA3AF'; // gray
        if (v <= -50) return '#DC2626'; // red
        if (v < -25) return '#F97316'; // orange
        if (v < 0) return '#FBBF24'; // yellow
        if (v === 0) return '#10B981'; // green
        return '#3B82F6'; // blue for positive
    });
    const data = [{ x: districts, y: deps, type: 'bar', marker:{ color: colors } }];
    const layout = { margin:{t:30, b:160}, xaxis:{tickangle:-45, automargin:true}, yaxis:{title:'Departure %'} };
    Plotly.react('depChart', data, layout, {responsive:true});
}

function renderTable(districts, actuals, normals, deps) {
    const container = document.getElementById('tableArea');
    const tbl = document.createElement('table');
    tbl.className = 'min-w-full text-sm';
    tbl.innerHTML = `
        <thead class="bg-gray-100 sticky top-0">
            <tr>
                <th class="px-3 py-2 text-left">जिला</th>
                <th class="px-3 py-2 text-right">Actual (मिमी)</th>
                <th class="px-3 py-2 text-right">Normal (मिमी)</th>
                <th class="px-3 py-2 text-right">Departure (%)</th>
            </tr>
        </thead>
        <tbody></tbody>
    `;
    const tbody = tbl.querySelector('tbody');

    for (let i = 0; i < districts.length; i++) {
        const d = districts[i];
        const a = actuals[i]===null? '—': actuals[i].toFixed(1);
        const n = normals[i]===null? '—': normals[i].toFixed(1);
        const dp = deps[i]===null? '—': `${deps[i]}%`;
        const colorClass = (deps[i]===null)? 'text-gray-500' :
            (deps[i] <= -50) ? 'text-red-600' :
            (deps[i] < -25) ? 'text-orange-600' :
            (deps[i] < 0) ? 'text-yellow-600' :
            (deps[i] === 0) ? 'text-green-600' : 'text-blue-600';

        const tr = document.createElement('tr');
        tr.className = 'border-b';
        tr.innerHTML = `
            <td class="px-3 py-2">${d}</td>
            <td class="px-3 py-2 text-right">${a}</td>
            <td class="px-3 py-2 text-right">${n}</td>
            <td class="px-3 py-2 text-right ${colorClass} font-medium">${dp}</td>
        `;
        tbody.appendChild(tr);
    }

    container.innerHTML = '';
    container.appendChild(tbl);
}

// on load, auto open 2025 june
document.addEventListener('DOMContentLoaded', () => {
    // default values already set in HTML, trigger load
    const defaultYear = document.getElementById('yearSelect').value;
    const defaultMonth = document.getElementById('monthSelect').value;
    loadMonthData(defaultYear, defaultMonth);
});

// --- Dark Mode / Theme Toggle Logic ---

// फ़ंक्शन 1: Dark Mode को टॉगल करता है और लोकल स्टोरेज में स्थिति को सेव करता है
function toggleDarkMode() {
    const html = document.documentElement;
    const isDark = html.classList.toggle('dark'); // 'dark' क्लास को टॉगल करता है

    // स्थिति को लोकल स्टोरेज में सेव करता है
    if (isDark) {
        localStorage.setItem('theme', 'dark');
    } else {
        localStorage.setItem('theme', 'light');
    }
}

// फ़ंक्शन 2: पेज लोड होने पर लोकल स्टोरेज से स्थिति को पढ़ता है और लागू करता है
function loadDarkMode() {
    const savedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

    // यदि थीम सेव है और 'dark' है, या सेव नहीं है लेकिन सिस्टम प्रेफरेंस 'dark' है
    if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
        document.documentElement.classList.add('dark');
    } else {
        document.documentElement.classList.remove('dark');
    }
}


// --- Event Listeners and Initial Load ---

// ऑन लोड, Dark Mode को तुरंत लागू करें
loadDarkMode();


document.getElementById('loadBtn').addEventListener('click', () => {
    const year = document.getElementById('yearSelect').value;
    const month = document.getElementById('monthSelect').value;
    loadMonthData(year, month);
});

// !!! नया: Dark Mode टॉगल बटन पर इवेंट लिसनर जोड़ें !!!
document.addEventListener('DOMContentLoaded', () => {
    // 1. Dark Mode टॉगल बटन ढूंढें (मान लें कि इसकी ID 'theme-toggle' है)
    const toggleButton = document.getElementById('theme-toggle');
    if (toggleButton) {
        toggleButton.addEventListener('click', toggleDarkMode);
    }
    
    // 2. डेटा लोडिंग
    const defaultYear = document.getElementById('yearSelect').value;
    const defaultMonth = document.getElementById('monthSelect').value;
    loadMonthData(defaultYear, defaultMonth);
});
