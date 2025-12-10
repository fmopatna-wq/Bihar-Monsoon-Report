// public/assets/js/data_loader.js

/**
 * CSV फ़ाइल को फ़ेच करता है और Papa Parse का उपयोग करके उसे JavaScript Objects के Array में पार्स करता है।
 * @param {string} year - चयनित वर्ष (e.g., '2025')
 * @param {string} periodKey - चयनित अवधि (e.g., 'july' या 'overall_monsoon')
 * @returns {Promise<Array<Object>>} - CSV डेटा का JSON प्रतिनिधित्व
 */
async function loadCSVData(year, periodKey) {
    // फ़ाइल पाथ आपके फ़ोल्डर स्ट्रक्चर के अनुसार
    const filePath = `data/${year}/${periodKey}.csv`; 

    try {
        console.log(`Fetching data from: ${filePath}`);
        
        const response = await fetch(filePath);
        
        if (!response.ok) {
            throw new Error(`Data file not found: ${filePath}`);
        }
        
        const csvText = await response.text();
        
        return new Promise((resolve, reject) => {
            // Papa Parse का उपयोग करके CSV को पार्स करें
            Papa.parse(csvText, {
                header: true, // हैडर रो को ऑब्जेक्ट की कुंजी (Keys) के रूप में उपयोग करें
                skipEmptyLines: true,
                dynamicTyping: true, // संख्यात्मक डेटा को नंबर के रूप में पार्स करें
                complete: function(results) {
                    if (results.errors.length) {
                        console.error("Papa Parse Errors:", results.errors);
                        reject(new Error("CSV parsing failed."));
                        return;
                    }
                    console.log(`Successfully loaded ${results.data.length} records.`);
                    resolve(results.data);
                },
                error: function(err) {
                    reject(err);
                }
            });
        });

    } catch (error) {
        console.error("Failed to load CSV:", error);
        throw error;
    }
}