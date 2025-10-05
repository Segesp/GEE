#!/bin/bash

###############################################################################
# TEST: ÍNDICES AMBIENTALES COMPUESTOS - Punto 7
# 
# Valida la implementación de los 4 índices compuestos ambientales:
# - Vulnerabilidad al calor
# - Déficit de áreas verdes
# - Contaminación atmosférica
# - Riesgo hídrico
###############################################################################

set -e

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuración
BASE_URL="${BASE_URL:-http://localhost:3000}"
TIMEOUT=30
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Función para imprimir encabezados
print_header() {
  echo -e "\n${BLUE}════════════════════════════════════════════════════════════════${NC}"
  echo -e "${BLUE}$1${NC}"
  echo -e "${BLUE}════════════════════════════════════════════════════════════════${NC}\n"
}

# Función para test individual
run_test() {
  local test_name="$1"
  local test_command="$2"
  
  TOTAL_TESTS=$((TOTAL_TESTS + 1))
  echo -e "${YELLOW}Test ${TOTAL_TESTS}: ${test_name}${NC}"
  
  if eval "$test_command"; then
    echo -e "${GREEN}✓ PASSED${NC}\n"
    PASSED_TESTS=$((PASSED_TESTS + 1))
    return 0
  else
    echo -e "${RED}✗ FAILED${NC}\n"
    FAILED_TESTS=$((FAILED_TESTS + 1))
    return 1
  fi
}

# Función para verificar JSON
check_json_field() {
  local json="$1"
  local field="$2"
  local description="$3"
  
  if echo "$json" | jq -e "$field" > /dev/null 2>&1; then
    echo "  ✓ $description"
    return 0
  else
    echo "  ✗ $description (campo no encontrado: $field)"
    return 1
  fi
}

###############################################################################
# TESTS
###############################################################################

print_header "ÍNDICES AMBIENTALES COMPUESTOS - Test Suite"

echo "Configuración:"
echo "  Base URL: $BASE_URL"
echo "  Timeout: ${TIMEOUT}s"
echo ""

# Test 1: Servidor accesible
run_test "Servidor responde correctamente" \
  "curl -s -f --max-time $TIMEOUT $BASE_URL > /dev/null"

# Test 2: Obtener lista de barrios
NEIGHBORHOODS_RESPONSE=$(curl -s -f --max-time $TIMEOUT "$BASE_URL/api/neighborhoods")

run_test "API de barrios responde" \
  "[[ -n '$NEIGHBORHOODS_RESPONSE' ]]"

# Extraer primer barrio para tests
FIRST_NEIGHBORHOOD_ID=$(echo "$NEIGHBORHOODS_RESPONSE" | jq -r '.neighborhoods[0].id' 2>/dev/null)

if [[ -z "$FIRST_NEIGHBORHOOD_ID" || "$FIRST_NEIGHBORHOOD_ID" == "null" ]]; then
  echo -e "${RED}Error: No se pudo obtener ID de barrio${NC}"
  exit 1
fi

echo "  → Usando barrio ID: $FIRST_NEIGHBORHOOD_ID"
echo ""

# Test 3: GET /api/composite-indices/:id - Básico
print_header "Tests de API - GET /api/composite-indices/:id"

COMPOSITE_RESPONSE=$(curl -s -f --max-time $TIMEOUT \
  "$BASE_URL/api/composite-indices/$FIRST_NEIGHBORHOOD_ID")

run_test "Endpoint GET responde correctamente" \
  "[[ -n '$COMPOSITE_RESPONSE' ]]"

# Test 4: Estructura de respuesta
run_test "Respuesta tiene estructura correcta" \
  "echo '$COMPOSITE_RESPONSE' | jq -e '.neighborhoodId and .neighborhoodName and .totalIndex and .indices' > /dev/null"

# Test 5: Índice de vulnerabilidad al calor
run_test "Índice de vulnerabilidad al calor presente" \
  "echo '$COMPOSITE_RESPONSE' | jq -e '.indices.heatVulnerability.value' > /dev/null"

run_test "Componentes de calor presentes" \
  "echo '$COMPOSITE_RESPONSE' | jq -e '.indices.heatVulnerability.components.lst and .indices.heatVulnerability.components.ndvi and .indices.heatVulnerability.components.density' > /dev/null"

# Test 6: Índice de áreas verdes
run_test "Índice de áreas verdes presente" \
  "echo '$COMPOSITE_RESPONSE' | jq -e '.indices.greenSpaceDeficit.value' > /dev/null"

run_test "Componentes de áreas verdes presentes" \
  "echo '$COMPOSITE_RESPONSE' | jq -e '.indices.greenSpaceDeficit.components.parkCoverage and .indices.greenSpaceDeficit.components.ndvi and .indices.greenSpaceDeficit.components.greenSpacePerCapita' > /dev/null"

# Test 7: Índice de contaminación
run_test "Índice de contaminación presente" \
  "echo '$COMPOSITE_RESPONSE' | jq -e '.indices.airPollution.value' > /dev/null"

run_test "Componentes de contaminación presentes" \
  "echo '$COMPOSITE_RESPONSE' | jq -e '.indices.airPollution.components.aod and .indices.airPollution.components.pm25 and .indices.airPollution.components.no2' > /dev/null"

# Test 8: Índice de riesgo hídrico
run_test "Índice de riesgo hídrico presente" \
  "echo '$COMPOSITE_RESPONSE' | jq -e '.indices.waterRisk.value' > /dev/null"

run_test "Componentes de riesgo hídrico presentes" \
  "echo '$COMPOSITE_RESPONSE' | jq -e '.indices.waterRisk.components.slope and .indices.waterRisk.components.impermeability and .indices.waterRisk.components.waterProximity' > /dev/null"

# Test 9: Rangos de valores (0-1)
print_header "Tests de Validación de Rangos"

run_test "Índice total entre 0 y 1" \
  "echo '$COMPOSITE_RESPONSE' | jq -e '.totalIndex >= 0 and .totalIndex <= 1' > /dev/null"

run_test "Índice de calor entre 0 y 1" \
  "echo '$COMPOSITE_RESPONSE' | jq -e '.indices.heatVulnerability.value >= 0 and .indices.heatVulnerability.value <= 1' > /dev/null"

run_test "Índice de áreas verdes entre 0 y 1" \
  "echo '$COMPOSITE_RESPONSE' | jq -e '.indices.greenSpaceDeficit.value >= 0 and .indices.greenSpaceDeficit.value <= 1' > /dev/null"

run_test "Índice de contaminación entre 0 y 1" \
  "echo '$COMPOSITE_RESPONSE' | jq -e '.indices.airPollution.value >= 0 and .indices.airPollution.value <= 1' > /dev/null"

run_test "Índice de agua entre 0 y 1" \
  "echo '$COMPOSITE_RESPONSE' | jq -e '.indices.waterRisk.value >= 0 and .indices.waterRisk.value <= 1' > /dev/null"

# Test 10: POST /api/composite-indices/compare
print_header "Tests de API - POST /api/composite-indices/compare"

# Obtener segundo barrio para comparación
SECOND_NEIGHBORHOOD_ID=$(echo "$NEIGHBORHOODS_RESPONSE" | jq -r '.neighborhoods[1].id' 2>/dev/null)

if [[ -n "$SECOND_NEIGHBORHOOD_ID" && "$SECOND_NEIGHBORHOOD_ID" != "null" ]]; then
  COMPARE_RESPONSE=$(curl -s -f --max-time $TIMEOUT \
    -X POST \
    -H "Content-Type: application/json" \
    -d "{\"neighborhoodIds\":[\"$FIRST_NEIGHBORHOOD_ID\",\"$SECOND_NEIGHBORHOOD_ID\"]}" \
    "$BASE_URL/api/composite-indices/compare")

  run_test "Endpoint de comparación responde" \
    "[[ -n '$COMPARE_RESPONSE' ]]"

  run_test "Comparación retorna array de 2 barrios" \
    "echo '$COMPARE_RESPONSE' | jq -e 'length == 2' > /dev/null"

  run_test "Cada barrio en comparación tiene todos los índices" \
    "echo '$COMPARE_RESPONSE' | jq -e '.[0].indices and .[1].indices' > /dev/null"
else
  echo "  ⚠ Saltando tests de comparación (solo 1 barrio disponible)"
fi

# Test 11: POST /api/composite-indices/scenario
print_header "Tests de API - POST /api/composite-indices/scenario"

SCENARIO_RESPONSE=$(curl -s -f --max-time $TIMEOUT \
  -X POST \
  -H "Content-Type: application/json" \
  -d "{
    \"neighborhoodId\": \"$FIRST_NEIGHBORHOOD_ID\",
    \"changes\": {
      \"vegetationIncrease\": 0.2,
      \"pollutionReduction\": 0.15,
      \"greenSpaceIncrease\": 2
    }
  }" \
  "$BASE_URL/api/composite-indices/scenario")

run_test "Endpoint de escenario responde" \
  "[[ -n '$SCENARIO_RESPONSE' ]]"

run_test "Escenario retorna 'before' y 'after'" \
  "echo '$SCENARIO_RESPONSE' | jq -e '.before and .after' > /dev/null"

run_test "Escenario 'before' tiene índices completos" \
  "echo '$SCENARIO_RESPONSE' | jq -e '.before.indices.heatVulnerability and .before.indices.greenSpaceDeficit and .before.indices.airPollution and .before.indices.waterRisk' > /dev/null"

run_test "Escenario 'after' tiene índices completos" \
  "echo '$SCENARIO_RESPONSE' | jq -e '.after.indices.heatVulnerability and .after.indices.greenSpaceDeficit and .after.indices.airPollution and .after.indices.waterRisk' > /dev/null"

run_test "Escenario 'after' muestra mejoras" \
  "echo '$SCENARIO_RESPONSE' | jq -e '(.after.indices.greenSpaceDeficit.value < .before.indices.greenSpaceDeficit.value) or (.after.indices.heatVulnerability.value < .before.indices.heatVulnerability.value)' > /dev/null"

# Test 12: POST /api/composite-indices/custom-weights
print_header "Tests de API - POST /api/composite-indices/custom-weights"

CUSTOM_WEIGHTS_RESPONSE=$(curl -s -f --max-time $TIMEOUT \
  -X POST \
  -H "Content-Type: application/json" \
  -d "{
    \"neighborhoodId\": \"$FIRST_NEIGHBORHOOD_ID\",
    \"weights\": {
      \"heat\": 0.4,
      \"green\": 0.3,
      \"pollution\": 0.2,
      \"water\": 0.1
    }
  }" \
  "$BASE_URL/api/composite-indices/custom-weights")

run_test "Endpoint de pesos personalizados responde" \
  "[[ -n '$CUSTOM_WEIGHTS_RESPONSE' ]]"

run_test "Pesos personalizados retornan índices calculados" \
  "echo '$CUSTOM_WEIGHTS_RESPONSE' | jq -e '.totalIndex and .indices' > /dev/null"

# Test 13: Validación de pesos (deben sumar 1.0)
INVALID_WEIGHTS_RESPONSE=$(curl -s -w "\n%{http_code}" --max-time $TIMEOUT \
  -X POST \
  -H "Content-Type: application/json" \
  -d "{
    \"neighborhoodId\": \"$FIRST_NEIGHBORHOOD_ID\",
    \"weights\": {
      \"heat\": 0.3,
      \"green\": 0.3,
      \"pollution\": 0.3,
      \"water\": 0.3
    }
  }" \
  "$BASE_URL/api/composite-indices/custom-weights")

HTTP_CODE=$(echo "$INVALID_WEIGHTS_RESPONSE" | tail -n 1)

run_test "API rechaza pesos que no suman 1.0" \
  "[[ '$HTTP_CODE' -eq 400 ]]"

# Test 14: Archivos frontend
print_header "Tests de Frontend"

run_test "Archivo HTML principal existe" \
  "curl -s -f --max-time $TIMEOUT $BASE_URL/index.html > /dev/null"

run_test "HTML contiene sección de índices compuestos" \
  "curl -s --max-time $TIMEOUT $BASE_URL/index.html | grep -q 'Índices Ambientales Compuestos'"

run_test "Archivo JS de índices compuestos existe" \
  "curl -s -f --max-time $TIMEOUT $BASE_URL/js/compositeIndices.js > /dev/null"

run_test "JS contiene funciones principales" \
  "curl -s --max-time $TIMEOUT $BASE_URL/js/compositeIndices.js | grep -q 'loadCompositeIndices\\|displayResults\\|simulateScenario'"

# Test 15: Documentación Swagger
print_header "Tests de Documentación"

SWAGGER_RESPONSE=$(curl -s --max-time $TIMEOUT "$BASE_URL/api-docs")

run_test "Documentación Swagger accesible" \
  "[[ -n '$SWAGGER_RESPONSE' ]]"

run_test "Swagger documenta endpoint de índices compuestos" \
  "echo '$SWAGGER_RESPONSE' | grep -q '/api/composite-indices/{neighborhoodId}'"

run_test "Swagger documenta endpoint de comparación" \
  "echo '$SWAGGER_RESPONSE' | grep -q '/api/composite-indices/compare'"

run_test "Swagger documenta endpoint de escenarios" \
  "echo '$SWAGGER_RESPONSE' | grep -q '/api/composite-indices/scenario'"

run_test "Swagger documenta endpoint de pesos personalizados" \
  "echo '$SWAGGER_RESPONSE' | grep -q '/api/composite-indices/custom-weights'"

# Test 16: Datasets utilizados
print_header "Tests de Datasets"

run_test "Respuesta incluye metadata de datasets" \
  "echo '$COMPOSITE_RESPONSE' | jq -e '.metadata.datasets' > /dev/null"

run_test "Metadata incluye MODIS LST" \
  "echo '$COMPOSITE_RESPONSE' | jq -e '.metadata.datasets[] | select(.name==\"MODIS/006/MOD11A1\")' > /dev/null"

run_test "Metadata incluye MODIS NDVI" \
  "echo '$COMPOSITE_RESPONSE' | jq -e '.metadata.datasets[] | select(.name==\"MODIS/006/MOD13A1\")' > /dev/null"

run_test "Metadata incluye MODIS AOD" \
  "echo '$COMPOSITE_RESPONSE' | jq -e '.metadata.datasets[] | select(.name==\"MODIS/006/MCD19A2_GRANULES\")' > /dev/null"

run_test "Metadata incluye Sentinel-2" \
  "echo '$COMPOSITE_RESPONSE' | jq -e '.metadata.datasets[] | select(.name==\"COPERNICUS/S2_SR_HARMONIZED\")' > /dev/null"

run_test "Metadata incluye Sentinel-5P" \
  "echo '$COMPOSITE_RESPONSE' | jq -e '.metadata.datasets[] | select(.name==\"COPERNICUS/S5P/OFFL/L3_NO2\")' > /dev/null"

run_test "Metadata incluye SRTM" \
  "echo '$COMPOSITE_RESPONSE' | jq -e '.metadata.datasets[] | select(.name==\"USGS/SRTMGL1_003\")' > /dev/null"

###############################################################################
# RESUMEN
###############################################################################

print_header "RESUMEN DE TESTS"

echo -e "Total de tests: ${BLUE}${TOTAL_TESTS}${NC}"
echo -e "Pasados: ${GREEN}${PASSED_TESTS}${NC}"
echo -e "Fallidos: ${RED}${FAILED_TESTS}${NC}"
echo ""

if [[ $FAILED_TESTS -eq 0 ]]; then
  echo -e "${GREEN}✓ Todos los tests pasaron correctamente${NC}"
  echo ""
  echo "📊 Implementación completa de Índices Compuestos:"
  echo "   • 4 índices ambientales calculados"
  echo "   • Pesos personalizados funcionales"
  echo "   • Simulador de escenarios operativo"
  echo "   • 6 datasets Earth Engine integrados"
  echo "   • Frontend completo con Chart.js"
  exit 0
else
  echo -e "${RED}✗ Algunos tests fallaron${NC}"
  echo ""
  echo "Por favor revisa los errores arriba."
  exit 1
fi
