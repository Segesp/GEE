#!/bin/bash

# ═══════════════════════════════════════════════════════════════════════════
# TEST ALL ECOPLAN GEE ENDPOINTS - VERSION CORREGIDA
# ═══════════════════════════════════════════════════════════════════════════
# Este script prueba todos los 21 endpoints con los parámetros correctos
# Fecha: 5 de octubre, 2025
# ═══════════════════════════════════════════════════════════════════════════

echo "╔═══════════════════════════════════════════════════════════════════╗"
echo "║                                                                   ║"
echo "║        🧪 TESTING ALL ECOPLAN GEE ENDPOINTS (21 TOTAL)           ║"
echo "║                   (VERSIÓN CORREGIDA)                             ║"
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

# Test function with detailed output
test_endpoint() {
    local name="$1"
    local url="$2"
    local check_type="$3"  # "field" o "no_error"
    local expected="$4"
    
    TOTAL=$((TOTAL + 1))
    echo -e "${BLUE}[$TOTAL]${NC} Testing: ${YELLOW}$name${NC}"
    
    response=$(curl -s "$url")
    
    # Check for errors first
    if echo "$response" | grep -q '"error"'; then
        echo -e "    ${RED}✗ FAILED${NC} - Error in response"
        error_msg=$(echo "$response" | jq -r '.error // .message // "Unknown error"' 2>/dev/null || echo "Parse error")
        echo "    Error: $error_msg"
        FAILED=$((FAILED + 1))
        return 1
    fi
    
    # Check based on type
    if [ "$check_type" = "field" ]; then
        if echo "$response" | jq -e "$expected" > /dev/null 2>&1; then
            echo -e "    ${GREEN}✓ PASSED${NC} - Field '$expected' found"
            PASSED=$((PASSED + 1))
            return 0
        else
            echo -e "    ${RED}✗ FAILED${NC} - Field '$expected' not found"
            FAILED=$((FAILED + 1))
            return 1
        fi
    elif [ "$check_type" = "no_error" ]; then
        echo -e "    ${GREEN}✓ PASSED${NC} - No errors"
        PASSED=$((PASSED + 1))
        return 0
    fi
}

echo ""
echo "┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓"
echo "┃ 🌊 CALIDAD DE AIRE Y AGUA (6 endpoints)                          ┃"
echo "┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛"
echo ""

test_endpoint "AOD - Aerosol Optical Depth" \
    "$BASE_URL/api/air-water-quality/aod?date=2024-01-15" \
    "field" ".statistics.meanAOD"

test_endpoint "NO₂ - Nitrogen Dioxide" \
    "$BASE_URL/api/air-water-quality/no2?date=2024-01-15" \
    "field" ".statistics.meanNO2"

test_endpoint "Chlorophyll-a" \
    "$BASE_URL/api/air-water-quality/chlorophyll?date=2024-01-15" \
    "field" ".statistics.meanChlorophyll"

test_endpoint "NDWI - Water Index" \
    "$BASE_URL/api/air-water-quality/ndwi?date=2024-01-15" \
    "field" ".statistics.meanNDWI"

test_endpoint "All Air/Water Quality Variables" \
    "$BASE_URL/api/air-water-quality/all?date=2024-01-15" \
    "field" ".aod"

test_endpoint "Time Series Analysis" \
    "$BASE_URL/api/air-water-quality/timeseries?variable=aod&startDate=2024-01-01&endDate=2024-03-31&interval=monthly" \
    "field" ".timeseries"

echo ""
echo "┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓"
echo "┃ 🌳 VEGETACIÓN E ISLAS DE CALOR (6 endpoints)                     ┃"
echo "┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛"
echo ""

test_endpoint "NDVI - Vegetation Index" \
    "$BASE_URL/api/vegetation-heat/ndvi?startDate=2024-01-01&endDate=2024-01-31" \
    "field" ".statistics.mean"

test_endpoint "LST - Land Surface Temperature" \
    "$BASE_URL/api/vegetation-heat/lst?startDate=2024-01-01&endDate=2024-01-31" \
    "field" ".statistics.mean"

test_endpoint "LST Anomaly Detection" \
    "$BASE_URL/api/vegetation-heat/lst-anomaly?targetDate=2024-08-15" \
    "field" ".anomalyMean"

test_endpoint "Heat Islands Detection" \
    "$BASE_URL/api/vegetation-heat/heat-islands?startDate=2024-08-01&endDate=2024-08-31" \
    "field" ".affectedArea"

test_endpoint "Vegetation & Heat Analysis" \
    "$BASE_URL/api/vegetation-heat/analysis?startDate=2024-01-01&endDate=2024-01-31" \
    "field" ".ndvi"

test_endpoint "Priority Areas Identification" \
    "$BASE_URL/api/vegetation-heat/priority?date=2024-08-15" \
    "field" ".priorityAreas"

echo ""
echo "┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓"
echo "┃ 🛰️  DATOS AVANZADOS NASA/SEDAC/COPERNICUS (9 endpoints)         ┃"
echo "┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛"
echo ""

test_endpoint "Fire Detection (NASA FIRMS)" \
    "$BASE_URL/api/advanced/fire-detection?startDate=2024-08-01&endDate=2024-08-31" \
    "field" ".statistics.fireCount"

test_endpoint "Night Lights (VIIRS)" \
    "$BASE_URL/api/advanced/night-lights?startDate=2024-01-01&endDate=2024-01-31" \
    "field" ".statistics.mean"

test_endpoint "Population (SEDAC GPW)" \
    "$BASE_URL/api/advanced/population?year=2020" \
    "field" ".statistics.totalPopulation"

test_endpoint "WorldPop High Resolution" \
    "$BASE_URL/api/advanced/worldpop?year=2020" \
    "field" ".statistics.totalPopulation"

test_endpoint "Built-up Surface (GHSL)" \
    "$BASE_URL/api/advanced/built-up?year=2020" \
    "field" ".statistics.totalBuiltSurface_km2"

test_endpoint "Atmospheric Composition (CAMS)" \
    "$BASE_URL/api/advanced/atmospheric?date=2024-08-15" \
    "field" ".statistics.aod_550nm"

test_endpoint "Land Cover (Dynamic World)" \
    "$BASE_URL/api/advanced/land-cover?startDate=2024-08-01&endDate=2024-08-31" \
    "field" ".statistics.dominantClass"

test_endpoint "Elevation (Copernicus DEM)" \
    "$BASE_URL/api/advanced/elevation" \
    "field" ".statistics.elevation"

test_endpoint "Socioeconomic Analysis (Comprehensive)" \
    "$BASE_URL/api/advanced/socioeconomic?year=2020" \
    "field" ".derivedIndicators"

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

PERCENTAGE=$((PASSED * 100 / TOTAL))
echo -e "Success Rate: ${BLUE}${PERCENTAGE}%${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ ALL TESTS PASSED! 🎉${NC}"
    echo ""
    echo "All 21 endpoints are working correctly!"
    exit 0
else
    echo -e "${YELLOW}⚠ $FAILED endpoint(s) need attention${NC}"
    echo ""
    echo "Please check the failed endpoints above."
    exit 1
fi
