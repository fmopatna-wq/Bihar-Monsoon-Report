// मानसून आगमन का डेटा स्टोर करने के लिए
let monsoonArrivalData = [];

// यह फंक्शन सिर्फ मानसून वाले डिब्बे को अपडेट करेगा
function updateMonsoonUI(year) {
  const data = monsoonArrivalData.find(
    (d) => d.Year && d.Year.toString().trim() === year.toString(),
  );
  const container = document.getElementById("monsoonDetails");
  if (!container) return;

  if (!data) {
    container.innerHTML = `<div class="col-span-3 text-center py-6 text-gray-500 italic lang-hi">वर्ष ${year} के लिए डेटा उपलब्ध नहीं है।</div>
                               <div class="col-span-3 text-center py-6 text-gray-500 italic lang-en">Data not available for year ${year}.</div>`;
    return;
  }

  // तारीख फॉर्मेट करने के लिए
  const formatDate = (str) => {
    if (!str) return { en: "N/A", hi: "N/A" };

    // Robust parsing: replace . / space with -
    const cleanStr = str.replace(/[\/\.\s,]+/g, "-").trim();
    const p = cleanStr.split("-");

    const monthsEn = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
    const monthsHi = [
      "जनवरी",
      "फरवरी",
      "मार्च",
      "अप्रैल",
      "मई",
      "जून",
      "जुलाई",
      "अगस्त",
      "सितंबर",
      "अक्टूबर",
      "नवंबर",
      "दिसंबर",
    ];

    let day, monthIdx, yr;

    if (p.length === 3) {
      day = parseInt(p[0]);
      monthIdx = parseInt(p[1]) - 1;
      yr = parseInt(p[2]);
      if (yr < 100) yr += 2000;
    } else {
      // Fallback if parsing fails
      return { en: str, hi: str };
    }

    if (isNaN(day) || isNaN(monthIdx) || isNaN(yr)) return { en: str, hi: str };

    return {
      en: `${day} ${monthsEn[monthIdx]} ${yr}`,
      hi: `${day} ${monthsHi[monthIdx]} ${yr}`,
    };
  };

  const onset = formatDate(data["Date of onset"]);
  const withdrawal = formatDate(data["Date  of   Withdrawal"]);

  // स्टे पीरियड (दिन) की गणना
  const parseDateObj = (str) => {
    if (!str) return null;
    const cleanStr = str.replace(/[\/\.\s,]+/g, "-").trim();
    const p = cleanStr.split("-");
    if (p.length !== 3) return null;
    let y = parseInt(p[2]);
    if (y < 100) y += 2000;
    return new Date(y, parseInt(p[1]) - 1, parseInt(p[0]));
  };

  const d1 = parseDateObj(data["Date of onset"]);
  const d2 = parseDateObj(data["Date  of   Withdrawal"]);
  const stayDays = Math.floor((d2 - d1) / (1000 * 60 * 60 * 24));

  container.innerHTML = `
        <div class="p-4 rounded-xl bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500 shadow-sm">
            <p class="text-xs font-bold text-blue-600 uppercase mb-1">Date of Onset</p>
            <p class="text-lg font-bold text-gray-800 dark:text-gray-200">
                <span class="lang-hi">मानसून आगमन: <span class="text-blue-700 dark:text-blue-400 font-bold">${onset.hi}</span></span>
                <span class="lang-en">Monsoon Arrival: <span class="text-blue-700 dark:text-blue-400 font-bold">${onset.en}</span></span>
            </p>
        </div>

        <div class="p-4 rounded-xl bg-orange-50 dark:bg-orange-900/20 border-l-4 border-orange-500 shadow-sm">
            <p class="text-xs font-bold text-orange-600 uppercase mb-1">Date of Withdrawal</p>
            <p class="text-lg font-bold text-gray-800 dark:text-gray-200">
                <span class="lang-hi">मानसून वापसी: <span class="text-orange-700 dark:text-orange-400 font-bold">${withdrawal.hi}</span></span>
                <span class="lang-en">Monsoon Withdrawal: <span class="text-orange-700 dark:text-orange-400 font-bold">${withdrawal.en}</span></span>
            </p>
        </div>

        <div class="p-4 rounded-xl bg-green-50 dark:bg-green-900/20 border-l-4 border-primary shadow-sm">
            <p class="text-xs font-bold text-primary uppercase mb-1">Stay Period</p>
            <p class="text-xl font-bold text-primary">
                <span class="lang-hi">बिहार में प्रवास: ${stayDays} दिन</span>
                <span class="lang-en">Days in Bihar: ${stayDays} Days</span>
            </p>
        </div>
    `;
}

// मानसून CSV को लोड करने का काम
Papa.parse("Onset and Withdrawal of SW monsoon over Bihar.csv", {
  download: true,
  header: true,
  skipEmptyLines: true,
  complete: function (results) {
    monsoonArrivalData = results.data;
    // डिफ़ॉल्ट रूप से जो साल चुना है उसे दिखाएं
    const initialYear = document.getElementById("yearSelect").value;
    updateMonsoonUI(initialYear);
  },
});
