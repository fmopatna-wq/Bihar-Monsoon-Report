import geopandas as gpd
import os

# 1. फ़ाइल पथ परिभाषित करें
SHAPEFILE_PATH = '../Bihar_FINAL_DATA.shp' 
GEOJSON_DIR = '../data/geojson/'
GEOJSON_FILE_NAME = 'bihar_august_data.json'

# GeoJSON फ़ोल्डर बनाएँ, यदि वह मौजूद नहीं है
if not os.path.exists(GEOJSON_DIR):
    os.makedirs(GEOJSON_DIR)

# 2. GeoDataFrame लोड करें (जिसमें सारा डेटा मर्ज हो चुका है)
try:
    gdf = gpd.read_file(SHAPEFILE_PATH)
    print(f"✅ Shapefile '{SHAPEFILE_PATH}' सफलतापूर्वक लोड हो गया।")
except Exception as e:
    print(f"❌ त्रुटि: Shapefile लोड नहीं हो सका। {e}")
    exit()

# 3. GeoJSON फ़ॉर्मेट में सेव करें
FULL_GEOJSON_PATH = os.path.join(GEOJSON_DIR, GEOJSON_FILE_NAME)

# to_file() विधि GeoJSON फ़ॉर्मेट में सेव करने के लिए उपयोग की जाती है
gdf.to_file(
    FULL_GEOJSON_PATH,
    driver='GeoJSON' # यह ड्राइवर GeoJSON फ़ाइल बनाता है
)

print(f"\n✨ GeoJSON फ़ाइल सफलतापूर्वक सेव हो गई: {FULL_GEOJSON_PATH}")
print("अब आप इस .json फ़ाइल का उपयोग करके वेब मैप बना सकते हैं।")