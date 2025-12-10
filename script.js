// script.js
// This file is used by index.html
// Depends on: PapaParse (loaded in index.html) and Plotly

// ** <<< districts to bold in charts and table >>> **
const DISTRICTS_TO_BOLD = ['ARARIA', 'GAYA', 'PATNA', 'WEST CHAMPARAN'];

// --- NEW: Central Color Scheme using HEX values ---
const RAINFALL_COLORS_HEX = {
    'LARGE EXCESS': '#1565c0', // dark blue (+60 and above)
    'EXCESS': '#4fc3f7',      // light blue (+20 to +59)
    'NORMAL': '#4caf50',      // green (-19 to +19)
    'DEFICIENT': '#e53935',    // red (-20 to -59)
    'LARGE DEFICIENT': '#ffd700', // yellow (-60 to -99)
    'NO RAIN': '#ffffff',      // white (-100)
    'MISSING': '#9CA3AF'       // gray (for null/NaN)
};

/**
 * विचलन के आधार पर श्रेणी निर्धारित करता है। (IMD standard criteria)
 */
function getRainfallStatus(deviation) {
    if (deviation === null || isNaN(deviation)) return 'MISSING';
    if (deviation >= 60) return 'LARGE EXCESS';
    if (deviation > 19) return 'EXCESS';
    if (deviation >= -19) return 'NORMAL';
    if (deviation >= -59) return 'DEFICIENT';
    if (deviation === -100) return 'NO RAIN';
    return 'LARGE DEFICIENT'; // covers -60 to -99
}

// Month filename mapping
const monthFileMap = {
    'june': 'june.csv',
    'july': 'july.csv',
    'august': 'august.csv',
    'september': 'september.csv',
    'overall': 'overall_monsoon.csv'
};

// --- Initialization and Event Listener Setup ---
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
    const deficitCount = validDeps.filter(v=>v < -19).length; // Deficient or worse (< -19)

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
    // New bolding logic for X-axis ticks
    const isDark = document.documentElement.classList.contains('dark');
    const fontColor = isDark ? '#cbd5e1' : '#334155';
    const boldColor = isDark ? '#60A5FA' : '#1D4ED8'; 

    const tickFontColors = districts.map(d => DISTRICTS_TO_BOLD.includes(d.toUpperCase()) ? boldColor : fontColor);
    const tickFontWeights = districts.map(d => DISTRICTS_TO_BOLD.includes(d.toUpperCase()) ? 900 : 'normal');
    const tickFontSizes = districts.map(d => DISTRICTS_TO_BOLD.includes(d.toUpperCase()) ? 11 : 10);
    // End bolding logic

    const x = districts;
    const trace1 = { x, y: actuals, name: 'Actual', type: 'bar', marker: { color: '#2563eb' } };
    const trace2 = { x, y: normals, name: 'Normal', type: 'bar', marker: { color: '#0d9488' } };
    const layout = {
        barmode: 'group',
        margin: { t: 30, b: 160 },
        xaxis: { 
            tickangle: -45, 
            automargin: true,
            // Custom font applied here
            tickfont: {
                size: tickFontSizes,
                color: tickFontColors,
                weight: tickFontWeights
            }
        },
        legend: { orientation: 'h', y: 1.05 },
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        font: { color: fontColor }
    };
    Plotly.react('barChart', [trace1, trace2], layout, {responsive:true});
}

/**
 * Departure Chart (Bar) - NEW COLOR LOGIC APPLIED
 */
function renderDepChart(districts, deps) {
    // New bolding logic for X-axis ticks
    const isDark = document.documentElement.classList.contains('dark');
    const fontColor = isDark ? '#cbd5e1' : '#334155';
    const boldColor = isDark ? '#60A5FA' : '#1D4ED8'; 

    const tickFontColors = districts.map(d => DISTRICTS_TO_BOLD.includes(d.toUpperCase()) ? boldColor : fontColor);
    const tickFontWeights = districts.map(d => DISTRICTS_TO_BOLD.includes(d.toUpperCase()) ? 900 : 'normal');
    const tickFontSizes = districts.map(d => DISTRICTS_TO_BOLD.includes(d.toUpperCase()) ? 11 : 10);
    // End bolding logic

    const colors = deps.map(v => {
        const status = getRainfallStatus(v);
        return RAINFALL_COLORS_HEX[status] || RAINFALL_COLORS_HEX['MISSING'];
    });

    const data = [{ x: districts, y: deps, type: 'bar', marker:{ color: colors } }];
    const layout = { 
        margin:{t:30, b:160}, 
        xaxis:{
            tickangle:-45, 
            automargin:true,
            // Custom font applied here
            tickfont: {
                size: tickFontSizes,
                color: tickFontColors,
                weight: tickFontWeights
            }
        }, 
        yaxis:{title:'Departure %'},
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        font: { color: fontColor }
    };
    Plotly.react('depChart', data, layout, {responsive:true});
}

/**
 * Detail Table Rendering - NEW COLOR LOGIC APPLIED (Cell Background & Row Bolding)
 */
function renderTable(districts, actuals, normals, deps) {
    const container = document.getElementById('tableArea');
    const tbl = document.createElement('table');
    tbl.className = 'min-w-full text-sm';
    tbl.innerHTML = `
        <thead class="bg-gray-100 dark:bg-gray-900 sticky top-0">
            <tr>
                <th class="px-3 py-2 text-left">जिला</th>
                <th class="px-3 py-2 text-right">Actual (मिमी)</th>
                <th class="px-3 py-2 text-right">Normal (मिमी)</th>
                <th class="px-3 py-2 text-center">Departure (%)</th>
            </tr>
        </thead>
        <tbody></tbody>
    `;
    const tbody = tbl.querySelector('tbody');

    for (let i = 0; i < districts.length; i++) {
        const d = districts[i];
        const a = actuals[i]===null? '—': actuals[i].toFixed(1);
        const n = normals[i]===null? '—': normals[i].toFixed(1);
        const dp = deps[i]===null? '—': `${deps[i] > 0 ? '+' : ''}${deps[i]}%`;
        
        // Determine status, background color, and text color for contrast
        const statusText = getRainfallStatus(deps[i]);
        const bgColor = RAINFALL_COLORS_HEX[statusText];
        
        let textColor = 'black'; 
        if (statusText === 'LARGE EXCESS' || statusText === 'DEFICIENT' || statusText === 'NORMAL' || statusText === 'MISSING') {
            textColor = 'white'; // White text for dark/non-white backgrounds
        } 
        // NO RAIN (white) and LARGE DEFICIENT (yellow) use black text

        const departureCellStyle = `background-color: ${bgColor}; color: ${textColor};`;

        // ** NEW TABLE ROW BOLD LOGIC **
        const isBoldRow = DISTRICTS_TO_BOLD.includes(d.toUpperCase());
        const districtTextClass = isBoldRow ? 'font-extrabold text-blue-700 dark:text-blue-400' : 'text-gray-900 dark:text-white';
        const rowClass = isBoldRow ? 'bg-blue-50/50 dark:bg-gray-700/50' : '';
        
        const tr = document.createElement('tr');
        tr.className = `${rowClass} border-b hover:bg-gray-50 dark:hover:bg-gray-700`;
        tr.innerHTML = `
            <td class="px-3 py-2 ${districtTextClass}">${d}</td>
            <td class="px-3 py-2 text-right">${a}</td>
            <td class="px-3 py-2 text-right">${n}</td>
            <td class="px-3 py-2 text-center font-medium" style="${departureCellStyle}">${dp}</td>
        `;
        tbody.appendChild(tr);
    }

    container.innerHTML = '';
    container.appendChild(tbl);
}

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
    // Charts need to be re-rendered to respect new background/font colors
    const year = document.getElementById('yearSelect').value;
    const month = document.getElementById('monthSelect').value;
    loadMonthData(year, month);
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

// Dark Mode टॉगल बटन पर इवेंट लिसनर जोड़ें 
document.addEventListener('DOMContentLoaded', () => {
    const toggleButton = document.getElementById('theme-toggle');
    if (toggleButton) {
        toggleButton.addEventListener('click', toggleDarkMode);
    }
    
    // डेटा लोडिंग
    const defaultYear = document.getElementById('yearSelect').value;
    const defaultMonth = document.getElementById('monthSelect').value;
    loadMonthData(defaultYear, defaultMonth);
});