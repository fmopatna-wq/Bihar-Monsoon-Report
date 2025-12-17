// script.js
// This file contains all the JavaScript logic for comparison.html
// Dependencies: PapaParse and Plotly (loaded in comparison.html)

// --- Global Variables and Constants ---
const RAINFALL_COLORS_HEX = {
    'LARGE EXCESS': '#1565c0', 
    'EXCESS': '#4fc3f7',       
    'NORMAL': '#4caf50',       
    'DEFICIENT': '#e53935',    
    'LARGE DEFICIENT': '#ffd700', 
    'NO RAIN': '#ffffff',      
    'MISSING': '#9CA3AF'       
};

let comparisonData = []; // Monthly comparison data (for selected month)
let overallData = {};    // Overall monsoon data (June-Sep)

/**
 * विचलन के आधार पर श्रेणी निर्धारित करता है। (IMD standard criteria)
 */
function getRainfallStatus(deviation) {
    if (deviation === null || isNaN(deviation)) return 'MISSING';
    const dev = parseFloat(deviation);
    if (dev >= 60) return 'LARGE EXCESS';
    if (dev >= 20) return 'EXCESS';
    if (dev >= -19) return 'NORMAL';
    if (dev >= -59) return 'DEFICIENT';
    if (dev >= -99) return 'LARGE DEFICIENT';
    if (dev <= -100) return 'NO RAIN';
    return 'MISSING';
}

// --- Data Fetching Functions ---

/**
 * Fetch and parse monthly district data (e.g., june_2024.csv).
 */
function fetchMonthlyData(year, month) {
    const url = `${month}_${year}.csv`;
    return new Promise((resolve, reject) => {
        Papa.parse(url, {
            download: true,
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
                console.log(`Successfully loaded: ${url}`, results.data.length);
                const data = results.data.map(d => ({
                    district: d['DISTRICT NAME'] ? d['DISTRICT NAME'].toUpperCase() : 'UNKNOWN',
                    actual: parseFloat(d['Actual R/F (mm)']) || 0,
                    normal: parseFloat(d['Normal R/F (mm)']) || 0,
                    deviation: parseFloat(d.Departure) || null,
                    status: getRainfallStatus(d.Departure),
                }));
                resolve(data);
            },
            error: (error) => {
                 console.error(`Error loading file: ${url}. Resolving with empty data.`, error);
                 resolve([]); 
            }
        });
    });
}

/**
 * Fetch and parse overall monsoon data (e.g., overall_monsoon_2025.csv).
 */
function fetchOverallMonsoonData(year) {
    const url = `overall_monsoon_${year}.csv`;
    return new Promise((resolve, reject) => {
        Papa.parse(url, {
            download: true,
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
                console.log(`Successfully loaded: ${url}`, results.data.length);
                const dataMap = {};
                results.data.forEach(d => {
                    dataMap[d['DISTRICT NAME'].toUpperCase()] = parseFloat(d['Actual R/F (mm)']) || 0;
                });
                resolve(dataMap);
            },
            error: (error) => {
                 console.error(`Error loading file: ${url}. Resolving with empty object.`, error);
                 resolve({}); 
            }
        });
    });
}

/**
 * Main function to fetch data based on selected filters and merge/process it.
 * Called on initial load and whenever filters change (via onchange in HTML).
 */
async function loadDataAndRender() {
    // Get filter values from comparison.html selectors
    const year1 = document.getElementById('year1Select').value;
    const year2 = document.getElementById('year2Select').value;
    const month = document.getElementById('monthSelect').value;
    
    console.log(`Loading new data for comparison: Y1=${year1}, Y2=${year2}, Month=${month}`);

    if (!year1 || !year2 || !month) return;
    
    try {
        // Fetch all 4 required datasets concurrently
        const [dataY1, dataY2, overallY1, overallY2] = await Promise.all([
            fetchMonthlyData(year1, month),
            fetchMonthlyData(year2, month),
            fetchOverallMonsoonData(year1),
            fetchOverallMonsoonData(year2)
        ]);

        // Store overall data for Chart 3
        overallData = { [year1]: overallY1, [year2]: overallY2 };
        
        // --- Merge the monthly data (Comparison Logic) ---
        comparisonData = dataY1.map(d1 => {
            // Find corresponding data from Year 2, default to 0/MISSING if not found
            const d2 = dataY2.find(d => d.district === d1.district) || { actual: 0, deviation: null, status: 'MISSING' };
            const actual1 = d1.actual;
            const actual2 = d2.actual;
            return {
                district: d1.district,
                actual1: actual1,
                deviation1: d1.deviation,
                status1: d1.status,
                actual2: actual2,
                deviation2: d2.deviation,
                status2: d2.status,
                difference: actual1 - actual2,
            };
        }).sort((a, b) => a.district.localeCompare(b.district));
        
        console.log("Data merged successfully. Rendering dashboard elements.");
        renderDashboardElements(comparisonData, year1, year2, month);

    } catch (error) {
        console.error("Critical Error during data fetching/merging:", error);
        alert("डेटा लोड करने में गंभीर त्रुटि। कृपया सुनिश्चित करें कि सभी CSV फ़ाइलें मौजूद हैं और उनके नाम सही हैं।");
    }
}

// --- Dashboard Rendering Function ---

function renderDashboardElements(data, year1, year2, month) {
    
    // 1. Update Titles
    document.getElementById('chart1Title').textContent = `जिलेवार Actual Rainfall तुलना (${year1} vs ${year2} - ${month})`;
    document.getElementById('chart2Title').textContent = `जिलेवार वास्तविक वर्षा अंतर (${year1} - ${year2} - ${month})`;
    document.getElementById('chart3Title').textContent = `Overall Actual Rainfall तुलना (${year1} vs ${year2} - Full Monsoon)`;
    document.getElementById('chart4Title').textContent = `वर्षा वितरण मैट्रिक्स (Heatmap - वास्तविक वर्षा) (${year1} vs ${year2} - ${month})`;


    // 2. Render Components (Charts and Table)
    displayComparisonTable(data);
    updateChart1(data, year1, year2, month); // Comparison Bar/Line and Difference Bar
    updateChart3(overallData, year1, year2); // Overall Monsoon Comparison
    updateChart4(data, year1, year2);        // Heatmap
}


// 1 & 2. Actual Rainfall Comparison (Bar + Line) and Difference (Bar)
function updateChart1(data, year1, year2, month) {
    const districts = data.map(d => d.district);
    const actual1 = data.map(d => d.actual1);
    const actual2 = data.map(d => d.actual2);
    const difference = data.map(d => d.difference);

    const isDarkMode = document.documentElement.classList.contains('dark');

    // Chart 1: Actual Rainfall Comparison (Bar + Line)
    const trace1 = {
        x: districts,
        y: actual1,
        name: `Actual R/F (${year1})`,
        type: 'bar',
        marker: { color: 'rgba(46, 139, 87, 0.8)' } 
    };

    const trace2 = {
        x: districts,
        y: actual2,
        name: `Actual R/F (${year2})`,
        type: 'bar',
        marker: { color: 'rgba(79, 195, 247, 0.8)' } 
    };
    
    // Line chart for the difference
    const trace3 = {
        x: districts,
        y: difference,
        name: 'Difference (Y1 - Y2)',
        type: 'scatter',
        mode: 'lines+markers',
        yaxis: 'y2', 
        line: { color: 'red', width: 2 },
        marker: { color: 'red', size: 6 }
    };

    const layout1 = {
        barmode: 'group',
        height: 500,
        xaxis: { title: 'जिला' },
        yaxis: { title: 'वास्तविक वर्षा (mm)' },
        yaxis2: { 
            title: 'वर्षा अंतर (mm)',
            overlaying: 'y',
            side: 'right',
            showgrid: false,
            zeroline: true,
            zerolinecolor: isDarkMode ? '#A0AEC0' : '#E2E8F0',
            zerolinewidth: 1
        },
        margin: { t: 50, b: 100 },
        title: false, 
        paper_bgcolor: isDarkMode ? '#2d3748' : '#ffffff',
        plot_bgcolor: isDarkMode ? '#2d3748' : '#ffffff',
        font: { color: isDarkMode ? 'white' : 'black' },
        legend: { orientation: 'h', y: -0.2 }
    };

    Plotly.newPlot('rainfallComparisonChart', [trace1, trace2, trace3], layout1, { responsive: true, displayModeBar: false });

    // Chart 2: District Rainfall Difference (Bar)
    const traceDiff = {
        x: districts,
        y: difference,
        name: 'Difference (Y1 - Y2)',
        type: 'bar',
        marker: {
            color: difference.map(diff => diff > 0 ? 'rgba(46, 139, 87, 0.8)' : 'rgba(229, 57, 53, 0.8)') 
        }
    };
    
    const layout2 = {
        height: 450,
        xaxis: { title: 'जिला' },
        yaxis: { title: 'वर्षा अंतर (Y1 - Y2) (mm)' },
        margin: { t: 50, b: 100 },
        title: false, 
        paper_bgcolor: isDarkMode ? '#2d3748' : '#ffffff',
        plot_bgcolor: isDarkMode ? '#2d3748' : '#ffffff',
        font: { color: isDarkMode ? 'white' : 'black' }
    };

    Plotly.newPlot('differenceBarChart', [traceDiff], layout2, { responsive: true, displayModeBar: false });
}


// 3. Overall Monsoon Comparison (Bar)
function updateChart3(overallData, year1, year2) {
    const districts = Object.keys(overallData[year1] || {}).sort();
    const actualY1 = districts.map(d => overallData[year1][d] || 0);
    const actualY2 = districts.map(d => overallData[year2][d] || 0);
    
    const isDarkMode = document.documentElement.classList.contains('dark');

    const trace1 = {
        x: districts,
        y: actualY1,
        name: `Actual R/F (${year1})`,
        type: 'bar',
        marker: { color: 'rgba(46, 139, 87, 0.8)' }
    };

    const trace2 = {
        x: districts,
        y: actualY2,
        name: `Actual R/F (${year2})`,
        type: 'bar',
        marker: { color: 'rgba(79, 195, 247, 0.8)' }
    };

    const layout = {
        barmode: 'group',
        height: 450,
        xaxis: { title: 'जिला' },
        yaxis: { title: 'वास्तविक वर्षा (mm)' },
        margin: { t: 50, b: 100 },
        title: false,
        paper_bgcolor: isDarkMode ? '#2d3748' : '#ffffff',
        plot_bgcolor: isDarkMode ? '#2d3748' : '#ffffff',
        font: { color: isDarkMode ? 'white' : 'black' },
        legend: { orientation: 'h', y: -0.2 }
    };

    Plotly.newPlot('overallMonsoonComparisonChart', [trace1, trace2], layout, { responsive: true, displayModeBar: false });
}


// 4. Heatmap: Actual Rainfall
function updateChart4(data, year1, year2) {
    const districts = data.map(d => d.district);
    const actualY1 = data.map(d => d.actual1);
    const actualY2 = data.map(d => d.actual2);
    
    const isDarkMode = document.documentElement.classList.contains('dark');
    
    // The Z-axis data for the heatmap
    const zData = [actualY1, actualY2];
    
    const trace = {
        z: zData,
        x: districts,
        y: [year1, year2], 
        type: 'heatmap',
        hoverongaps: false,
        colorscale: [ 
            [0, 'rgb(240, 249, 255)'], [0.2, 'rgb(200, 220, 240)'], 
            [0.4, 'rgb(100, 150, 200)'], [0.6, 'rgb(50, 100, 180)'], 
            [0.8, 'rgb(20, 50, 150)'], [1, 'rgb(0, 0, 100)']
        ],
        colorbar: { title: 'Actual R/F (mm)' }
    };

    const layout = {
        height: 450,
        xaxis: { title: 'जिला' },
        yaxis: { title: 'वर्ष' },
        margin: { t: 50, b: 100 },
        title: false,
        paper_bgcolor: isDarkMode ? '#2d3748' : '#ffffff',
        plot_bgcolor: isDarkMode ? '#2d3748' : '#ffffff',
        font: { color: isDarkMode ? 'white' : 'black' }
    };

    Plotly.newPlot('heatmapChart', [trace], layout, { responsive: true, displayModeBar: false });
}

// 5. Detailed Comparison Table
function displayComparisonTable(data) {
    const tbody = document.getElementById('comparisonTableBody');
    tbody.innerHTML = '';
    const year1 = document.getElementById('year1Select').value;
    const year2 = document.getElementById('year2Select').value;

    // Update Table Headers
    document.getElementById('thYear1').textContent = year1;
    document.getElementById('thYear2').textContent = year2;

    data.forEach(d => {
        const tr = document.createElement('tr');
        tr.className = "bg-white border-b hover:bg-gray-50 dark:hover:bg-gray-700";

        // --- Status Cell 1 (Y1) ---
        const statusText1 = d.status1;
        const bgColor1 = RAINFALL_COLORS_HEX[statusText1] || RAINFALL_COLORS_HEX['MISSING'];
        let textColor1 = 'black';
        if (['LARGE EXCESS', 'DEFICIENT', 'NORMAL'].includes(statusText1)) {
            textColor1 = 'white';
        }
        const cellStyle1 = `background-color: ${bgColor1}; color: ${textColor1};`;
        
        // --- Status Cell 2 (Y2) ---
        const statusText2 = d.status2;
        const bgColor2 = RAINFALL_COLORS_HEX[statusText2] || RAINFALL_COLORS_HEX['MISSING'];
        let textColor2 = 'black';
        if (['LARGE EXCESS', 'DEFICIENT', 'NORMAL'].includes(statusText2)) {
            textColor2 = 'white';
        }
        const cellStyle2 = `background-color: ${bgColor2}; color: ${textColor2};`;

        tr.innerHTML = `
            <td class="px-6 py-4 font-medium text-gray-900 dark:text-white whitespace-nowrap">${d.district}</td>
            <td class="px-6 py-4 text-right">${d.actual1.toFixed(1)}</td>
            <td class="px-6 py-4 text-right">${d.actual2.toFixed(1)}</td>
            <td class="px-6 py-4 text-right font-bold">${d.difference > 0 ? '+' : ''}${d.difference.toFixed(1)}</td>
            <td class="px-6 py-4 text-center font-bold" style="${cellStyle1}">${statusText1} (${d.deviation1 !== null ? d.deviation1.toFixed(0) + '%' : 'N/A'})</td>
            <td class="px-6 py-4 text-center font-bold" style="${cellStyle2}">${statusText2} (${d.deviation2 !== null ? d.deviation2.toFixed(0) + '%' : 'N/A'})</td>
        `;
        tbody.appendChild(tr);
    });
    
    // Handle Deviation Status Header based on data availability
    const isDeviationAvailable = data.some(d => d.deviation1 !== null || d.deviation2 !== null);
    const thStatus1 = document.getElementById('thStatus1');
    const thStatus2 = document.getElementById('thStatus2');

    if (!isDeviationAvailable) {
        // Update to show selected years in the header
        thStatus1.innerHTML = `Status (${year1} Dev N/A)`; 
        thStatus2.innerHTML = `Status (${year2} Dev N/A)`;
    } else {
        thStatus1.innerHTML = `Status (${year1} Dev)`;
        thStatus2.innerHTML = `Status (${year2} Dev)`;
    }
}

// --- Search Functionality ---
function filterComparisonTable() {
    const input = document.getElementById('searchTable');
    const filter = input.value.toUpperCase();
    const tableBody = document.getElementById('comparisonTableBody');
    const tr = tableBody.getElementsByTagName('tr');

    for (let i = 0; i < tr.length; i++) {
        const td = tr[i].getElementsByTagName('td')[0]; 
        if (td) {
            const txtValue = td.textContent || td.innerText;
            if (txtValue.toUpperCase().indexOf(filter) > -1) {
                tr[i].style.display = '';
            } else {
                tr[i].style.display = 'none';
            }
        }       
    }
}

// --- Utility Functions ---

function populateSelectors() {
    const currentYear = new Date().getFullYear();
    // Generate current year and 4 previous years
    const years = Array.from({ length: 5 }, (v, i) => currentYear - i); 
    const months = ['june', 'july', 'august', 'september'];

    const year1Select = document.getElementById('year1Select');
    const year2Select = document.getElementById('year2Select');
    const monthSelect = document.getElementById('monthSelect');

    // Populate Years
    years.forEach(year => {
        const option1 = new Option(year, year);
        const option2 = new Option(year, year);
        year1Select.add(option1);
        year2Select.add(option2);
    });
    year1Select.value = currentYear;
    year2Select.value = currentYear - 1; 
    
    // Populate Months
    months.forEach(month => {
        const option = new Option(month.charAt(0).toUpperCase() + month.slice(1), month);
        monthSelect.add(option);
    });
    monthSelect.value = 'june';
}

function toggleDarkMode() {
    document.documentElement.classList.toggle('dark');
    // Re-render charts to apply dark mode theme colors
    renderDashboardElements(comparisonData, 
                            document.getElementById('year1Select').value, 
                            document.getElementById('year2Select').value, 
                            document.getElementById('monthSelect').value);
}


// Initialize Dashboard
document.addEventListener('DOMContentLoaded', () => {
    populateSelectors();
    loadDataAndRender(); // Initial data fetch and render
    
    // Add event listeners to selectors to reload data on change
    document.getElementById('year1Select').addEventListener('change', loadDataAndRender);
    document.getElementById('year2Select').addEventListener('change', loadDataAndRender);
    document.getElementById('monthSelect').addEventListener('change', loadDataAndRender);
    
    // Add event listener for table search
    document.getElementById('searchTable').addEventListener('keyup', filterComparisonTable);
    
    // Add event listener for dark mode toggle (assuming button ID is 'darkModeToggle')
    const darkModeBtn = document.getElementById('darkModeToggle');
    if (darkModeBtn) {
        darkModeBtn.addEventListener('click', toggleDarkMode);
    }
});