#!/bin/bash
#
# Script de pruebas automatizadas para "Mi Barrio"
# Sistema de análisis por barrio con semáforos
#

BASE_URL="http://localhost:3000"
TEMP_DIR="/tmp/ecoplan-mibarrio-tests"
PASS_COUNT=0
FAIL_COUNT=0

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Crear directorio temporal
mkdir -p "$TEMP_DIR"

echo "========================================="
echo "🏘️  EcoPlan - Tests de Mi Barrio"
echo "========================================="
echo ""

# Función para verificar si el servidor está corriendo
check_server() {
  echo -n "🔍 Verificando servidor... "
  if curl -sf "$BASE_URL" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ OK${NC}"
    return 0
  else
    echo -e "${RED}✗ FAIL${NC}"
    echo "   Error: Servidor no responde en $BASE_URL"
    echo "   Por favor inicia el servidor: node server.js"
    exit 1
  fi
}

# Función para test con verificación
run_test() {
  local test_name=$1
  local endpoint=$2
  local expected_status=${3:-200}
  local output_file="$TEMP_DIR/test_${PASS_COUNT}_${FAIL_COUNT}.json"
  
  echo ""
  echo -n "📋 Test: $test_name... "
  
  http_code=$(curl -s -o "$output_file" -w "%{http_code}" "$BASE_URL$endpoint")
  
  if [ "$http_code" -eq "$expected_status" ]; then
    echo -e "${GREEN}✓ PASS${NC} (HTTP $http_code)"
    PASS_COUNT=$((PASS_COUNT + 1))
    
    # Mostrar preview del JSON (primeras líneas)
    if [ -f "$output_file" ] && [ "$expected_status" -eq 200 ]; then
      echo -e "${BLUE}   Response preview:${NC}"
      jq -C '.' "$output_file" 2>/dev/null | head -n 10 || cat "$output_file" | head -n 10
    fi
    return 0
  else
    echo -e "${RED}✗ FAIL${NC} (Expected HTTP $expected_status, got $http_code)"
    FAIL_COUNT=$((FAIL_COUNT + 1))
    
    if [ -f "$output_file" ]; then
      echo -e "${RED}   Error response:${NC}"
      cat "$output_file"
    fi
    return 1
  fi
}

# Función para test con validación de campos JSON
run_test_with_validation() {
  local test_name=$1
  local endpoint=$2
  local jq_filter=$3
  local expected_value=$4
  local output_file="$TEMP_DIR/test_validation_${PASS_COUNT}_${FAIL_COUNT}.json"
  
  echo ""
  echo -n "📋 Test: $test_name... "
  
  http_code=$(curl -s -o "$output_file" -w "%{http_code}" "$BASE_URL$endpoint")
  
  if [ "$http_code" -ne 200 ]; then
    echo -e "${RED}✗ FAIL${NC} (HTTP $http_code)"
    FAIL_COUNT=$((FAIL_COUNT + 1))
    cat "$output_file"
    return 1
  fi
  
  actual_value=$(jq -r "$jq_filter" "$output_file" 2>/dev/null)
  
  if [ "$actual_value" = "$expected_value" ]; then
    echo -e "${GREEN}✓ PASS${NC}"
    echo -e "${BLUE}   $jq_filter = $actual_value${NC}"
    PASS_COUNT=$((PASS_COUNT + 1))
    return 0
  else
    echo -e "${RED}✗ FAIL${NC}"
    echo -e "${RED}   Expected: $expected_value${NC}"
    echo -e "${RED}   Actual: $actual_value${NC}"
    FAIL_COUNT=$((FAIL_COUNT + 1))
    return 1
  fi
}

# ============================================================================
# TESTS
# ============================================================================

check_server

echo ""
echo "================================================"
echo "📍 Grupo 1: Lista de Barrios"
echo "================================================"

run_test \
  "Listar barrios disponibles" \
  "/api/neighborhoods"

run_test_with_validation \
  "Verificar que hay al menos 3 barrios" \
  "/api/neighborhoods" \
  ".total" \
  "6"

run_test_with_validation \
  "Verificar que Miraflores está en la lista" \
  "/api/neighborhoods" \
  '.neighborhoods[] | select(.id == "miraflores") | .name' \
  "Miraflores"

run_test_with_validation \
  "Verificar población de San Isidro" \
  "/api/neighborhoods" \
  '.neighborhoods[] | select(.id == "san-isidro") | .population' \
  "54206"

echo ""
echo "================================================"
echo "🔬 Grupo 2: Análisis Individual de Barrios"
echo "================================================"

run_test \
  "Analizar Miraflores" \
  "/api/neighborhoods/miraflores/analysis"

run_test \
  "Analizar San Isidro" \
  "/api/neighborhoods/san-isidro/analysis"

run_test \
  "Analizar Surquillo" \
  "/api/neighborhoods/surquillo/analysis"

run_test \
  "Barrio inexistente (debe fallar)" \
  "/api/neighborhoods/barrio-falso/analysis" \
  404

echo ""
echo "================================================"
echo "🌳 Grupo 3: Validación de Índices"
echo "================================================"

# Guardar análisis de Miraflores para validaciones
MIRAFLORES_FILE="$TEMP_DIR/miraflores_analysis.json"
curl -s "$BASE_URL/api/neighborhoods/miraflores/analysis" > "$MIRAFLORES_FILE"

run_test_with_validation \
  "Verificar que NDVI está presente" \
  "/api/neighborhoods/miraflores/analysis" \
  ".indices.vegetation.name" \
  "Áreas Verdes"

run_test_with_validation \
  "Verificar que LST está presente" \
  "/api/neighborhoods/miraflores/analysis" \
  ".indices.heat.name" \
  "Temperatura"

run_test_with_validation \
  "Verificar que PM2.5 está presente" \
  "/api/neighborhoods/miraflores/analysis" \
  ".indices.air.name" \
  "Calidad del Aire"

run_test_with_validation \
  "Verificar que NDWI está presente" \
  "/api/neighborhoods/miraflores/analysis" \
  ".indices.water.name" \
  "Índice Hídrico"

echo ""
echo "================================================"
echo "🚦 Grupo 4: Validación de Semáforos"
echo "================================================"

echo ""
echo -n "📋 Test: Verificar que cada índice tiene semáforo... "
vegetation_level=$(jq -r '.indices.vegetation.level' "$MIRAFLORES_FILE")
heat_level=$(jq -r '.indices.heat.level' "$MIRAFLORES_FILE")
air_level=$(jq -r '.indices.air.level' "$MIRAFLORES_FILE")
water_level=$(jq -r '.indices.water.level' "$MIRAFLORES_FILE")

if [[ "$vegetation_level" =~ ^(excellent|good|warning|critical)$ ]] && \
   [[ "$heat_level" =~ ^(excellent|good|warning|critical)$ ]] && \
   [[ "$air_level" =~ ^(excellent|good|warning|critical)$ ]] && \
   [[ "$water_level" =~ ^(excellent|good|warning|critical)$ ]]; then
  echo -e "${GREEN}✓ PASS${NC}"
  echo -e "${BLUE}   vegetation: $vegetation_level${NC}"
  echo -e "${BLUE}   heat: $heat_level${NC}"
  echo -e "${BLUE}   air: $air_level${NC}"
  echo -e "${BLUE}   water: $water_level${NC}"
  PASS_COUNT=$((PASS_COUNT + 1))
else
  echo -e "${RED}✗ FAIL${NC}"
  echo -e "${RED}   Niveles inválidos detectados${NC}"
  FAIL_COUNT=$((FAIL_COUNT + 1))
fi

echo ""
echo -n "📋 Test: Verificar que cada índice tiene emoji... "
vegetation_emoji=$(jq -r '.indices.vegetation.emoji' "$MIRAFLORES_FILE")
heat_emoji=$(jq -r '.indices.heat.emoji' "$MIRAFLORES_FILE")
air_emoji=$(jq -r '.indices.air.emoji' "$MIRAFLORES_FILE")
water_emoji=$(jq -r '.indices.water.emoji' "$MIRAFLORES_FILE")

if [ -n "$vegetation_emoji" ] && [ -n "$heat_emoji" ] && [ -n "$air_emoji" ] && [ -n "$water_emoji" ]; then
  echo -e "${GREEN}✓ PASS${NC}"
  echo -e "${BLUE}   vegetation: $vegetation_emoji${NC}"
  echo -e "${BLUE}   heat: $heat_emoji${NC}"
  echo -e "${BLUE}   air: $air_emoji${NC}"
  echo -e "${BLUE}   water: $water_emoji${NC}"
  PASS_COUNT=$((PASS_COUNT + 1))
else
  echo -e "${RED}✗ FAIL${NC}"
  FAIL_COUNT=$((FAIL_COUNT + 1))
fi

echo ""
echo "================================================"
echo "💡 Grupo 5: Validación de Explicaciones y Acciones"
echo "================================================"

echo ""
echo -n "📋 Test: Verificar que cada índice tiene explicación... "
veg_explanation=$(jq -r '.indices.vegetation.explanation' "$MIRAFLORES_FILE")
heat_explanation=$(jq -r '.indices.heat.explanation' "$MIRAFLORES_FILE")

if [ ${#veg_explanation} -gt 20 ] && [ ${#heat_explanation} -gt 20 ]; then
  echo -e "${GREEN}✓ PASS${NC}"
  echo -e "${BLUE}   Vegetation: ${veg_explanation:0:60}...${NC}"
  echo -e "${BLUE}   Heat: ${heat_explanation:0:60}...${NC}"
  PASS_COUNT=$((PASS_COUNT + 1))
else
  echo -e "${RED}✗ FAIL${NC}"
  FAIL_COUNT=$((FAIL_COUNT + 1))
fi

echo ""
echo -n "📋 Test: Verificar que cada índice tiene acciones recomendadas... "
veg_actions_count=$(jq '.indices.vegetation.actions | length' "$MIRAFLORES_FILE")
heat_actions_count=$(jq '.indices.heat.actions | length' "$MIRAFLORES_FILE")

if [ "$veg_actions_count" -ge 3 ] && [ "$heat_actions_count" -ge 3 ]; then
  echo -e "${GREEN}✓ PASS${NC}"
  echo -e "${BLUE}   Vegetation: $veg_actions_count acciones${NC}"
  echo -e "${BLUE}   Heat: $heat_actions_count acciones${NC}"
  PASS_COUNT=$((PASS_COUNT + 1))
else
  echo -e "${RED}✗ FAIL${NC}"
  FAIL_COUNT=$((FAIL_COUNT + 1))
fi

echo ""
echo "================================================"
echo "📈 Grupo 6: Validación de Tendencias"
echo "================================================"

echo ""
echo -n "📋 Test: Verificar que vegetation tiene tendencia... "
veg_trend_change=$(jq -r '.indices.vegetation.trend.change' "$MIRAFLORES_FILE")
veg_trend_improving=$(jq -r '.indices.vegetation.trend.isImproving' "$MIRAFLORES_FILE")

if [ "$veg_trend_change" != "null" ] && [ "$veg_trend_improving" != "null" ]; then
  echo -e "${GREEN}✓ PASS${NC}"
  echo -e "${BLUE}   Change: $veg_trend_change${NC}"
  echo -e "${BLUE}   Improving: $veg_trend_improving${NC}"
  PASS_COUNT=$((PASS_COUNT + 1))
else
  echo -e "${RED}✗ FAIL${NC}"
  FAIL_COUNT=$((FAIL_COUNT + 1))
fi

echo ""
echo -n "📋 Test: Verificar que heat tiene tendencia... "
heat_trend_change=$(jq -r '.indices.heat.trend.change' "$MIRAFLORES_FILE")
heat_trend_improving=$(jq -r '.indices.heat.trend.isImproving' "$MIRAFLORES_FILE")

if [ "$heat_trend_change" != "null" ] && [ "$heat_trend_improving" != "null" ]; then
  echo -e "${GREEN}✓ PASS${NC}"
  echo -e "${BLUE}   Change: $heat_trend_change${NC}"
  echo -e "${BLUE}   Improving: $heat_trend_improving${NC}"
  PASS_COUNT=$((PASS_COUNT + 1))
else
  echo -e "${RED}✗ FAIL${NC}"
  FAIL_COUNT=$((FAIL_COUNT + 1))
fi

echo ""
echo "================================================"
echo "🏆 Grupo 7: Score General"
echo "================================================"

run_test_with_validation \
  "Verificar que hay score general" \
  "/api/neighborhoods/miraflores/analysis" \
  ".overallScore | type" \
  "number"

run_test_with_validation \
  "Verificar que hay nivel general" \
  "/api/neighborhoods/miraflores/analysis" \
  ".overallLevel" \
  "excellent"

echo ""
echo "================================================"
echo "🔄 Grupo 8: Comparación de Barrios"
echo "================================================"

run_test \
  "Comparar 2 barrios (Miraflores y San Isidro)" \
  "/api/neighborhoods/compare?ids=miraflores,san-isidro"

run_test \
  "Comparar 3 barrios" \
  "/api/neighborhoods/compare?ids=miraflores,san-isidro,surquillo"

run_test \
  "Comparar sin parámetro ids (debe fallar)" \
  "/api/neighborhoods/compare" \
  400

run_test \
  "Comparar más de 5 barrios (debe fallar)" \
  "/api/neighborhoods/compare?ids=miraflores,san-isidro,surquillo,barranco,surco,san-borja" \
  400

echo ""
echo "================================================"
echo "🔍 Grupo 9: Validación de Rankings"
echo "================================================"

COMPARE_FILE="$TEMP_DIR/compare_analysis.json"
curl -s "$BASE_URL/api/neighborhoods/compare?ids=miraflores,san-isidro,surquillo" > "$COMPARE_FILE"

echo ""
echo -n "📋 Test: Verificar que hay rankings... "
veg_ranking=$(jq '.rankings.vegetation | length' "$COMPARE_FILE")
overall_ranking=$(jq '.rankings.overall | length' "$COMPARE_FILE")

if [ "$veg_ranking" -eq 3 ] && [ "$overall_ranking" -eq 3 ]; then
  echo -e "${GREEN}✓ PASS${NC}"
  echo -e "${BLUE}   Vegetation ranking: $veg_ranking barrios${NC}"
  echo -e "${BLUE}   Overall ranking: $overall_ranking barrios${NC}"
  PASS_COUNT=$((PASS_COUNT + 1))
else
  echo -e "${RED}✗ FAIL${NC}"
  FAIL_COUNT=$((FAIL_COUNT + 1))
fi

echo ""
echo -n "📋 Test: Verificar orden de ranking (rank 1, 2, 3)... "
rank1=$(jq -r '.rankings.overall[0].rank' "$COMPARE_FILE")
rank2=$(jq -r '.rankings.overall[1].rank' "$COMPARE_FILE")
rank3=$(jq -r '.rankings.overall[2].rank' "$COMPARE_FILE")

if [ "$rank1" -eq 1 ] && [ "$rank2" -eq 2 ] && [ "$rank3" -eq 3 ]; then
  echo -e "${GREEN}✓ PASS${NC}"
  winner=$(jq -r '.rankings.overall[0].name' "$COMPARE_FILE")
  echo -e "${BLUE}   Ganador: $winner${NC}"
  PASS_COUNT=$((PASS_COUNT + 1))
else
  echo -e "${RED}✗ FAIL${NC}"
  FAIL_COUNT=$((FAIL_COUNT + 1))
fi

echo ""
echo "================================================"
echo "📊 Grupo 10: Validación de Estadísticas"
echo "================================================"

echo ""
echo -n "📋 Test: Verificar estadísticas de NDVI... "
ndvi_mean=$(jq -r '.indices.vegetation.stats.mean' "$MIRAFLORES_FILE")
ndvi_stddev=$(jq -r '.indices.vegetation.stats.stdDev' "$MIRAFLORES_FILE")
ndvi_count=$(jq -r '.indices.vegetation.stats.count' "$MIRAFLORES_FILE")

if [ "$ndvi_mean" != "null" ] && [ "$ndvi_stddev" != "null" ] && [ "$ndvi_count" -gt 0 ]; then
  echo -e "${GREEN}✓ PASS${NC}"
  echo -e "${BLUE}   Mean: $ndvi_mean${NC}"
  echo -e "${BLUE}   StdDev: $ndvi_stddev${NC}"
  echo -e "${BLUE}   Count: $ndvi_count imágenes${NC}"
  PASS_COUNT=$((PASS_COUNT + 1))
else
  echo -e "${RED}✗ FAIL${NC}"
  FAIL_COUNT=$((FAIL_COUNT + 1))
fi

echo ""
echo -n "📋 Test: Verificar estadísticas de LST... "
lst_mean=$(jq -r '.indices.heat.stats.mean' "$MIRAFLORES_FILE")
lst_stddev=$(jq -r '.indices.heat.stats.stdDev' "$MIRAFLORES_FILE")
lst_count=$(jq -r '.indices.heat.stats.count' "$MIRAFLORES_FILE")

if [ "$lst_mean" != "null" ] && [ "$lst_stddev" != "null" ] && [ "$lst_count" -gt 0 ]; then
  echo -e "${GREEN}✓ PASS${NC}"
  echo -e "${BLUE}   Mean: $lst_mean °C${NC}"
  echo -e "${BLUE}   StdDev: $lst_stddev${NC}"
  echo -e "${BLUE}   Count: $lst_count imágenes${NC}"
  PASS_COUNT=$((PASS_COUNT + 1))
else
  echo -e "${RED}✗ FAIL${NC}"
  FAIL_COUNT=$((FAIL_COUNT + 1))
fi

# ============================================================================
# RESUMEN FINAL
# ============================================================================

echo ""
echo "========================================="
echo "📊 RESUMEN DE TESTS"
echo "========================================="
echo ""
echo -e "Total de tests ejecutados: $((PASS_COUNT + FAIL_COUNT))"
echo -e "${GREEN}Tests pasados: $PASS_COUNT${NC}"
echo -e "${RED}Tests fallados: $FAIL_COUNT${NC}"

if [ $FAIL_COUNT -eq 0 ]; then
  echo ""
  echo -e "${GREEN}✅ ¡TODOS LOS TESTS PASARON!${NC}"
  echo ""
  exit 0
else
  echo ""
  echo -e "${RED}❌ ALGUNOS TESTS FALLARON${NC}"
  echo ""
  echo "Archivos de salida guardados en: $TEMP_DIR"
  exit 1
fi
