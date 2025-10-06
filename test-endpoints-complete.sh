#!/bin/bash

# ==============================================================================
# TEST COMPLETO DE ENDPOINTS - ECOPLAN GEE
# ==============================================================================
# Fecha: 6 de octubre de 2025
# Propósito: Verificar todos los endpoints del sistema incluyendo los 7 nuevos
#            servicios avanzados de metodologías NASA/Copernicus
# ==============================================================================

BASE_URL="http://localhost:3000"
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Geometría de prueba (Villa El Salvador, Lima)
GEOMETRY_VES='{
  "type": "Polygon",
  "coordinates": [[
    [-76.95, -12.20],
    [-76.95, -12.25],
    [-76.90, -12.25],
    [-76.90, -12.20],
    [-76.95, -12.20]
  ]]
}'

# Geometría pequeña para tests rápidos
GEOMETRY_SMALL='{
  "type": "Polygon",
  "coordinates": [[
    [-76.93, -12.22],
    [-76.93, -12.23],
    [-76.92, -12.23],
    [-76.92, -12.22],
    [-76.93, -12.22]
  ]]
}'

echo ""
echo "╔════════════════════════════════════════════════════════════════════════╗"
echo "║                                                                        ║"
echo "║           🧪  TEST COMPLETO DE ENDPOINTS - ECOPLAN GEE  🧪            ║"
echo "║                                                                        ║"
echo "╚════════════════════════════════════════════════════════════════════════╝"
echo ""

# ==============================================================================
# FUNCIÓN: Test de endpoint
# ==============================================================================
test_endpoint() {
    local method=$1
    local endpoint=$2
    local data=$3
    local description=$4
    local expected_status=${5:-200}
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    echo -n "[$TOTAL_TESTS] Testing: $description... "
    
    if [ "$method" == "GET" ]; then
        response=$(curl -s -w "\n%{http_code}" "$BASE_URL$endpoint" 2>/dev/null)
    else
        response=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL$endpoint" \
            -H "Content-Type: application/json" \
            -d "$data" 2>/dev/null)
    fi
    
    # Extraer código de estado
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    # Verificar respuesta
    if [ "$http_code" == "$expected_status" ]; then
        echo -e "${GREEN}✓ PASSED${NC} (HTTP $http_code)"
        PASSED_TESTS=$((PASSED_TESTS + 1))
        
        # Mostrar muestra de la respuesta (primeras 200 caracteres)
        if [ ${#body} -gt 0 ]; then
            echo "   Response: ${body:0:200}..."
        fi
    else
        echo -e "${RED}✗ FAILED${NC} (HTTP $http_code, expected $expected_status)"
        FAILED_TESTS=$((FAILED_TESTS + 1))
        
        # Mostrar error si existe
        if [ ${#body} -gt 0 ]; then
            echo "   Error: ${body:0:300}"
        fi
    fi
    
    echo ""
}

# ==============================================================================
# SECCIÓN 1: ENDPOINTS BÁSICOS
# ==============================================================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 SECCIÓN 1: ENDPOINTS BÁSICOS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

test_endpoint "GET" "/" "" "Página principal (index.html)"
test_endpoint "GET" "/hub.html" "" "Hub de navegación"
test_endpoint "GET" "/api-docs" "" "Documentación Swagger"
test_endpoint "GET" "/health" "" "Health check"

# ==============================================================================
# SECCIÓN 2: NUEVOS ENDPOINTS AVANZADOS - ISLA DE CALOR
# ==============================================================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🌡️  SECCIÓN 2: ISLA DE CALOR URBANO (ADVANCED)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Test 1: Análisis de Isla de Calor
test_endpoint "POST" "/api/advanced/heat-island" \
    "{
        \"geometry\": $GEOMETRY_SMALL,
        \"startDate\": \"2024-01-01\",
        \"endDate\": \"2024-01-31\"
    }" \
    "🌡️  Análisis Isla de Calor (IIC)"

# Test 2: Tendencias de Isla de Calor
test_endpoint "POST" "/api/advanced/heat-island/trends" \
    "{
        \"geometry\": $GEOMETRY_SMALL,
        \"years\": [2023, 2024]
    }" \
    "🌡️  Tendencias temporales Isla de Calor"

# ==============================================================================
# SECCIÓN 3: ÁREAS VERDES Y AGPH
# ==============================================================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🌳 SECCIÓN 3: ACCESO A ÁREAS VERDES (ADVANCED)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Test 3: Cálculo AGPH
test_endpoint "POST" "/api/advanced/green-space/agph" \
    "{
        \"geometry\": $GEOMETRY_SMALL,
        \"date\": \"2024-01-01\"
    }" \
    "🌳 Cálculo AGPH (Área Verde por Habitante)"

# Test 4: Accesibilidad a Parques
test_endpoint "POST" "/api/advanced/green-space/accessibility" \
    "{
        \"geometry\": $GEOMETRY_SMALL,
        \"date\": \"2024-01-01\",
        \"radii\": [300, 500, 1000]
    }" \
    "🌳 Accesibilidad a áreas verdes"

# ==============================================================================
# SECCIÓN 4: CALIDAD DEL AIRE MULTI-CONTAMINANTE
# ==============================================================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "💨 SECCIÓN 4: CALIDAD DEL AIRE (ADVANCED)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Test 5: Análisis de Calidad del Aire
test_endpoint "POST" "/api/advanced/air-quality" \
    "{
        \"geometry\": $GEOMETRY_SMALL,
        \"startDate\": \"2024-01-01\",
        \"endDate\": \"2024-01-31\"
    }" \
    "💨 Análisis calidad del aire multi-contaminante"

# Test 6: Tendencias de Calidad del Aire
test_endpoint "POST" "/api/advanced/air-quality/trends" \
    "{
        \"geometry\": $GEOMETRY_SMALL,
        \"years\": [2023, 2024]
    }" \
    "💨 Tendencias temporales calidad del aire"

# ==============================================================================
# SECCIÓN 5: EXPANSIÓN URBANA
# ==============================================================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🏙️  SECCIÓN 5: EXPANSIÓN URBANA (ADVANCED)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Test 7: Análisis de Expansión Urbana
test_endpoint "POST" "/api/advanced/urban-expansion" \
    "{
        \"geometry\": $GEOMETRY_SMALL,
        \"startYear\": 2015,
        \"endYear\": 2023
    }" \
    "🏙️  Análisis expansión urbana GHSL"

# Test 8: Pérdida de Vegetación
test_endpoint "POST" "/api/advanced/urban-expansion/vegetation-loss" \
    "{
        \"geometry\": $GEOMETRY_SMALL,
        \"startDate\": \"2020-01-01\",
        \"endDate\": \"2024-01-01\"
    }" \
    "🏙️  Detección pérdida de vegetación"

# ==============================================================================
# SECCIÓN 6: RIESGO DE INUNDACIONES
# ==============================================================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🌊 SECCIÓN 6: RIESGO DE INUNDACIONES (ADVANCED)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Test 9: Análisis de Riesgo de Inundaciones
test_endpoint "POST" "/api/advanced/flood-risk" \
    "{
        \"geometry\": $GEOMETRY_SMALL,
        \"startDate\": \"2024-01-01\",
        \"endDate\": \"2024-03-31\"
    }" \
    "🌊 Análisis riesgo de inundaciones"

# Test 10: Problemas de Drenaje
test_endpoint "POST" "/api/advanced/flood-risk/drainage" \
    "{
        \"geometry\": $GEOMETRY_SMALL
    }" \
    "🌊 Identificación problemas de drenaje (TWI)"

# ==============================================================================
# SECCIÓN 7: ACCESO A ENERGÍA/ILUMINACIÓN
# ==============================================================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "💡 SECCIÓN 7: ACCESO A ENERGÍA (ADVANCED)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Test 11: Análisis de Acceso a Energía
test_endpoint "POST" "/api/advanced/energy-access" \
    "{
        \"geometry\": $GEOMETRY_SMALL,
        \"date\": \"2023-01-01\"
    }" \
    "💡 Análisis acceso a energía/iluminación"

# Test 12: Prioridades de Electrificación
test_endpoint "POST" "/api/advanced/energy-access/priorities" \
    "{
        \"geometry\": $GEOMETRY_SMALL,
        \"date\": \"2023-01-01\"
    }" \
    "💡 Identificación prioridades de electrificación"

# ==============================================================================
# SECCIÓN 8: SALUD Y CALOR EXTREMO
# ==============================================================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🏥 SECCIÓN 8: SALUD Y CALOR EXTREMO (ADVANCED)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Test 13: Vulnerabilidad de Salud por Calor
test_endpoint "POST" "/api/advanced/health/heat-vulnerability" \
    "{
        \"geometry\": $GEOMETRY_SMALL,
        \"startDate\": \"2024-01-01\",
        \"endDate\": \"2024-03-31\"
    }" \
    "🏥 Análisis vulnerabilidad salud por calor"

# Test 14: Ubicaciones Sugeridas para Instalaciones de Salud
test_endpoint "POST" "/api/advanced/health/facility-locations" \
    "{
        \"geometry\": $GEOMETRY_SMALL,
        \"startDate\": \"2024-01-01\",
        \"endDate\": \"2024-03-31\"
    }" \
    "🏥 Sugerencias ubicación instalaciones de salud"

# Test 15: Tendencias de Calor Extremo
test_endpoint "POST" "/api/advanced/health/heat-trends" \
    "{
        \"geometry\": $GEOMETRY_SMALL,
        \"years\": [2023, 2024]
    }" \
    "🏥 Tendencias temporales calor extremo"

# ==============================================================================
# SECCIÓN 9: ENDPOINTS EXISTENTES (VEGETACIÓN E ISLAS DE CALOR)
# ==============================================================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🌿 SECCIÓN 9: ENDPOINTS EXISTENTES - VEGETACIÓN"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Test 16: Análisis de Vegetación
test_endpoint "POST" "/api/vegetation/analyze" \
    "{
        \"geometry\": $GEOMETRY_SMALL,
        \"startDate\": \"2024-01-01\",
        \"endDate\": \"2024-01-31\"
    }" \
    "🌿 Análisis de vegetación (NDVI)"

# Test 17: Tendencias de Vegetación
test_endpoint "POST" "/api/vegetation/trends" \
    "{
        \"geometry\": $GEOMETRY_SMALL,
        \"years\": [2023, 2024]
    }" \
    "🌿 Tendencias temporales vegetación"

# Test 18: Análisis de Isla de Calor (endpoint original)
test_endpoint "POST" "/api/heat-island/analyze" \
    "{
        \"geometry\": $GEOMETRY_SMALL,
        \"startDate\": \"2024-01-01\",
        \"endDate\": \"2024-01-31\"
    }" \
    "🌡️  Análisis isla de calor (original)"

# ==============================================================================
# SECCIÓN 10: ENDPOINTS DE CALIDAD AIRE Y AGUA
# ==============================================================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "💧 SECCIÓN 10: CALIDAD AIRE Y AGUA (ORIGINAL)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Test 19: Análisis de Calidad del Aire (original)
test_endpoint "POST" "/api/air-quality/analyze" \
    "{
        \"geometry\": $GEOMETRY_SMALL,
        \"startDate\": \"2024-01-01\",
        \"endDate\": \"2024-01-31\"
    }" \
    "💨 Análisis calidad del aire (original)"

# Test 20: Análisis de Calidad del Agua
test_endpoint "POST" "/api/water-quality/analyze" \
    "{
        \"geometry\": $GEOMETRY_SMALL,
        \"startDate\": \"2024-01-01\",
        \"endDate\": \"2024-01-31\"
    }" \
    "💧 Análisis calidad del agua"

# ==============================================================================
# SECCIÓN 11: PÁGINAS HTML
# ==============================================================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🌐 SECCIÓN 11: PÁGINAS HTML"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

test_endpoint "GET" "/analisis-avanzados.html" "" "🆕 Interfaz Análisis Avanzados"
test_endpoint "GET" "/vegetacion-islas-calor.html" "" "🌿 Interfaz Vegetación e Islas"
test_endpoint "GET" "/calidad-aire-agua.html" "" "💧 Interfaz Calidad Aire/Agua"
test_endpoint "GET" "/datos-avanzados.html" "" "📊 Interfaz Datos Avanzados"
test_endpoint "GET" "/panel-autoridades.html" "" "🏛️  Panel Autoridades"
test_endpoint "GET" "/transparencia.html" "" "📖 Página Transparencia"
test_endpoint "GET" "/tutoriales.html" "" "📚 Página Tutoriales"

# ==============================================================================
# RESUMEN FINAL
# ==============================================================================
echo ""
echo "╔════════════════════════════════════════════════════════════════════════╗"
echo "║                                                                        ║"
echo "║                       📊 RESUMEN DE TESTS                             ║"
echo "║                                                                        ║"
echo "╚════════════════════════════════════════════════════════════════════════╝"
echo ""
echo "Total de tests ejecutados:    $TOTAL_TESTS"
echo -e "${GREEN}Tests exitosos:               $PASSED_TESTS${NC}"
echo -e "${RED}Tests fallidos:               $FAILED_TESTS${NC}"
echo ""

# Calcular porcentaje de éxito
if [ $TOTAL_TESTS -gt 0 ]; then
    SUCCESS_RATE=$(awk "BEGIN {printf \"%.1f\", ($PASSED_TESTS/$TOTAL_TESTS)*100}")
    echo "Tasa de éxito:                $SUCCESS_RATE%"
    echo ""
    
    if [ $FAILED_TESTS -eq 0 ]; then
        echo -e "${GREEN}╔════════════════════════════════════════════════════════════════════════╗${NC}"
        echo -e "${GREEN}║                                                                        ║${NC}"
        echo -e "${GREEN}║              ✅  TODOS LOS TESTS PASARON EXITOSAMENTE  ✅             ║${NC}"
        echo -e "${GREEN}║                                                                        ║${NC}"
        echo -e "${GREEN}╚════════════════════════════════════════════════════════════════════════╝${NC}"
    else
        echo -e "${YELLOW}╔════════════════════════════════════════════════════════════════════════╗${NC}"
        echo -e "${YELLOW}║                                                                        ║${NC}"
        echo -e "${YELLOW}║              ⚠️  ALGUNOS TESTS FALLARON  ⚠️                           ║${NC}"
        echo -e "${YELLOW}║                                                                        ║${NC}"
        echo -e "${YELLOW}║  Revisa los errores arriba para más detalles                          ║${NC}"
        echo -e "${YELLOW}║                                                                        ║${NC}"
        echo -e "${YELLOW}╚════════════════════════════════════════════════════════════════════════╝${NC}"
    fi
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Detalles de endpoints testeados:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "🌡️  Isla de Calor:          2 endpoints"
echo "🌳 Áreas Verdes:            2 endpoints"
echo "💨 Calidad del Aire:        2 endpoints"
echo "🏙️  Expansión Urbana:        2 endpoints"
echo "🌊 Riesgo Inundaciones:     2 endpoints"
echo "💡 Acceso a Energía:        2 endpoints"
echo "🏥 Salud y Calor:           3 endpoints"
echo "🌿 Vegetación (original):   2 endpoints"
echo "💧 Aire/Agua (original):    2 endpoints"
echo "🌐 Páginas HTML:            8 páginas"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Total:                      27 endpoints/páginas verificados"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Salir con código de error si hubo fallos
if [ $FAILED_TESTS -gt 0 ]; then
    exit 1
else
    exit 0
fi
