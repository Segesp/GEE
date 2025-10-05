#!/bin/bash

# ═══════════════════════════════════════════════════════════════════════════
# TEST ALL ECOPLAN GEE ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════
# Este script prueba todos los 21 endpoints implementados
# Fecha: 5 de octubre, 2025
# ═══════════════════════════════════════════════════════════════════════════

echo "╔═══════════════════════════════════════════════════════════════════╗"
echo "║                                                                   ║"
echo "║        🧪 TESTING ALL ECOPLAN GEE ENDPOINTS (21 TOTAL)           ║"
echo "║                                                                   ║"
echo "╚═══════════════════════════════════════════════════════════════════╝"
echo ""

BASE_URL="http://localhost:3000"
PASSED=0
FAILED=0
TOTAL=0

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test function
test_endpoint() {
    local name="$1"
    local url="$2"
    local expected_field="$3"
    
    TOTAL=$((TOTAL + 1))
    echo -e "${BLUE}[$TOTAL]${NC} Testing: ${YELLOW}$name${NC}"
    echo "    URL: $url"
    
    response=$(curl -s "$url")
    
    if echo "$response" | grep -q "error"; then
        echo -e "    ${RED}✗ FAILED${NC} - Error in response"
        echo "    Response: $(echo $response | head -c 200)..."
        FAILED=$((FAILED + 1))
        return 1
    fi
    
    if echo "$response" | grep -q "$expected_field"; then
        echo -e "    ${GREEN}✓ PASSED${NC} - Field '$expected_field' found"
        PASSED=$((PASSED + 1))
        return 0
    else
        echo -e "    ${RED}✗ FAILED${NC} - Field '$expected_field' not found"
        echo "    Response: $(echo $response | head -c 200)..."
        FAILED=$((FAILED + 1))
        return 1
    fi
}

echo ""
echo "┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓"
echo "┃ 🌊 CALIDAD DE AIRE Y AGUA (6 endpoints)                          ┃"
echo "┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛"
echo ""

test_endpoint "AOD - Aerosol Optical Depth" \
    "$BASE_URL/api/air-water-quality/aod?startDate=2024-01-01&endDate=2024-01-31" \
    "meanAOD"

test_endpoint "NO₂ - Nitrogen Dioxide" \
    "$BASE_URL/api/air-water-quality/no2?startDate=2024-01-01&endDate=2024-01-31" \
    "meanNO2"

test_endpoint "Chlorophyll-a" \
    "$BASE_URL/api/air-water-quality/chlorophyll?startDate=2024-01-01&endDate=2024-01-31" \
    "meanChlorophyll"

test_endpoint "NDWI - Water Index" \
    "$BASE_URL/api/air-water-quality/ndwi?startDate=2024-01-01&endDate=2024-01-31" \
    "meanNDWI"

test_endpoint "All Air/Water Quality Variables" \
    "$BASE_URL/api/air-water-quality/all?startDate=2024-01-01&endDate=2024-01-31" \
    "aod"

test_endpoint "Time Series Analysis" \
    "$BASE_URL/api/air-water-quality/timeseries?startDate=2024-01-01&endDate=2024-12-31&interval=monthly" \
    "timeseries"

echo ""
echo "┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓"
echo "┃ 🌳 VEGETACIÓN E ISLAS DE CALOR (6 endpoints)                     ┃"
echo "┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛"
echo ""

test_endpoint "NDVI - Vegetation Index" \
    "$BASE_URL/api/vegetation-heat/ndvi?startDate=2024-01-01&endDate=2024-01-31" \
    "meanNDVI"

test_endpoint "LST - Land Surface Temperature" \
    "$BASE_URL/api/vegetation-heat/lst?startDate=2024-01-01&endDate=2024-01-31" \
    "meanDayTemp"

test_endpoint "LST Anomaly Detection" \
    "$BASE_URL/api/vegetation-heat/lst-anomaly?startDate=2024-08-01&endDate=2024-08-31" \
    "anomalyMean"

test_endpoint "Heat Islands Detection" \
    "$BASE_URL/api/vegetation-heat/heat-islands?startDate=2024-08-01&endDate=2024-08-31" \
    "heatIslands"

test_endpoint "Vegetation & Heat Analysis" \
    "$BASE_URL/api/vegetation-heat/analysis?startDate=2024-01-01&endDate=2024-01-31" \
    "ndvi"

test_endpoint "Priority Areas Identification" \
    "$BASE_URL/api/vegetation-heat/priority?startDate=2024-08-01&endDate=2024-08-31" \
    "priorityAreas"

echo ""
echo "┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓"
echo "┃ 🛰️  DATOS AVANZADOS NASA/SEDAC/COPERNICUS (9 endpoints)         ┃"
echo "┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛"
echo ""

test_endpoint "Fire Detection (NASA FIRMS)" \
    "$BASE_URL/api/advanced/fire-detection?startDate=2024-08-01&endDate=2024-08-31" \
    "fireCount"

test_endpoint "Night Lights (VIIRS)" \
    "$BASE_URL/api/advanced/night-lights?startDate=2024-01-01&endDate=2024-01-31" \
    "avgRadiance"

test_endpoint "Population (SEDAC GPW)" \
    "$BASE_URL/api/advanced/population?year=2020" \
    "totalPopulation"

test_endpoint "WorldPop High Resolution" \
    "$BASE_URL/api/advanced/worldpop?year=2020" \
    "totalPopulation"

test_endpoint "Built-up Surface (GHSL)" \
    "$BASE_URL/api/advanced/built-up?year=2020" \
    "totalBuiltSurface_km2"

test_endpoint "Atmospheric Composition (CAMS)" \
    "$BASE_URL/api/advanced/atmospheric?date=2024-08-15" \
    "aod_550nm"

test_endpoint "Land Cover (Dynamic World)" \
    "$BASE_URL/api/advanced/land-cover?startDate=2024-08-01&endDate=2024-08-31" \
    "dominantClass"

test_endpoint "Elevation (Copernicus DEM)" \
    "$BASE_URL/api/advanced/elevation" \
    "elevation"

test_endpoint "Socioeconomic Analysis (Comprehensive)" \
    "$BASE_URL/api/advanced/socioeconomic?year=2020" \
    "derivedIndicators"

echo ""
echo "╔═══════════════════════════════════════════════════════════════════╗"
echo "║                                                                   ║"
echo "║                    📊 TEST RESULTS SUMMARY                        ║"
echo "║                                                                   ║"
echo "╚═══════════════════════════════════════════════════════════════════╝"
echo ""
echo -e "Total Tests:  ${BLUE}$TOTAL${NC}"
echo -e "Passed:       ${GREEN}$PASSED${NC}"
echo -e "Failed:       ${RED}$FAILED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ ALL TESTS PASSED! 🎉${NC}"
    echo ""
    echo "All 21 endpoints are working correctly!"
    exit 0
else
    echo -e "${RED}✗ SOME TESTS FAILED${NC}"
    echo ""
    echo "Please check the failed endpoints above."
    exit 1
fi
