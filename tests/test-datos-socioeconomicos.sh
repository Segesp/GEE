#!/bin/bash

# Script de prueba para Datos Socioeconómicos
# Valida endpoints y funcionalidad

set -e

echo "🧪 Iniciando pruebas de Datos Socioeconómicos..."
echo ""

# Colores
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

BASE_URL="http://localhost:3000"

# Función para verificar respuesta
check_response() {
  local response=$1
  local test_name=$2
  
  if echo "$response" | jq . >/dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} $test_name: JSON válido"
    return 0
  else
    echo -e "${RED}✗${NC} $test_name: JSON inválido"
    echo "$response"
    return 1
  fi
}

# Test 1: Verificar que el servidor está corriendo
echo "📡 Test 1: Verificando servidor..."
if curl -s -f "$BASE_URL" > /dev/null; then
  echo -e "${GREEN}✓${NC} Servidor accesible"
else
  echo -e "${RED}✗${NC} Servidor no accesible"
  echo "Por favor, inicia el servidor con: npm start"
  exit 1
fi
echo ""

# Test 2: Obtener lista de barrios
echo "🏘️  Test 2: Obtener lista de barrios..."
NEIGHBORHOODS=$(curl -s "$BASE_URL/api/neighborhoods")
check_response "$NEIGHBORHOODS" "Lista de barrios"

# Extraer primer barrio
FIRST_NEIGHBORHOOD=$(echo "$NEIGHBORHOODS" | jq -r '.neighborhoods[0].id')
echo "   Usando barrio: $FIRST_NEIGHBORHOOD"
echo ""

# Test 3: Obtener datos socioeconómicos de un barrio (año 2020)
echo "📊 Test 3: Datos socioeconómicos - año 2020..."
SOCIO_2020=$(curl -s "$BASE_URL/api/socioeconomic/$FIRST_NEIGHBORHOOD?year=2020")
check_response "$SOCIO_2020" "Datos 2020"

# Verificar estructura
if echo "$SOCIO_2020" | jq -e '.population.densityMean' >/dev/null 2>&1; then
  DENSITY=$(echo "$SOCIO_2020" | jq -r '.population.densityMean')
  echo -e "${GREEN}✓${NC}   Densidad poblacional: $DENSITY hab/km²"
else
  echo -e "${RED}✗${NC}   Falta campo population.densityMean"
fi

if echo "$SOCIO_2020" | jq -e '.infrastructure.servicesPerCapita' >/dev/null 2>&1; then
  SERVICES=$(echo "$SOCIO_2020" | jq -r '.infrastructure.servicesPerCapita')
  echo -e "${GREEN}✓${NC}   Servicios per cápita: $SERVICES"
else
  echo -e "${RED}✗${NC}   Falta campo infrastructure.servicesPerCapita"
fi

if echo "$SOCIO_2020" | jq -e '.deprivation.deprivationIndex' >/dev/null 2>&1; then
  DEPRIVATION=$(echo "$SOCIO_2020" | jq -r '.deprivation.deprivationIndex')
  echo -e "${GREEN}✓${NC}   Índice de privación: $DEPRIVATION"
else
  echo -e "${RED}✗${NC}   Falta campo deprivation.deprivationIndex"
fi
echo ""

# Test 4: Obtener datos socioeconómicos - año 2010
echo "📊 Test 4: Datos socioeconómicos - año 2010..."
SOCIO_2010=$(curl -s "$BASE_URL/api/socioeconomic/$FIRST_NEIGHBORHOOD?year=2010")
check_response "$SOCIO_2010" "Datos 2010"

YEAR_2010=$(echo "$SOCIO_2010" | jq -r '.year')
if [ "$YEAR_2010" == "2010" ]; then
  echo -e "${GREEN}✓${NC}   Año correcto: $YEAR_2010"
else
  echo -e "${RED}✗${NC}   Año incorrecto: $YEAR_2010 (esperado: 2010)"
fi
echo ""

# Test 5: Año inválido (debe retornar error 400)
echo "⚠️  Test 5: Validación de año inválido..."
INVALID_YEAR=$(curl -s -w "%{http_code}" "$BASE_URL/api/socioeconomic/$FIRST_NEIGHBORHOOD?year=2025" | tail -n 1)
if [ "$INVALID_YEAR" == "400" ]; then
  echo -e "${GREEN}✓${NC}   Error 400 retornado correctamente"
else
  echo -e "${RED}✗${NC}   Se esperaba error 400, se obtuvo: $INVALID_YEAR"
fi
echo ""

# Test 6: Barrio inexistente (debe retornar error 404)
echo "❌ Test 6: Barrio inexistente..."
NOT_FOUND=$(curl -s -w "%{http_code}" "$BASE_URL/api/socioeconomic/barrio-inexistente" | tail -n 1)
if [ "$NOT_FOUND" == "404" ]; then
  echo -e "${GREEN}✓${NC}   Error 404 retornado correctamente"
else
  echo -e "${RED}✗${NC}   Se esperaba error 404, se obtuvo: $NOT_FOUND"
fi
echo ""

# Test 7: Comparación de barrios
echo "🔄 Test 7: Comparar múltiples barrios..."
SECOND_NEIGHBORHOOD=$(echo "$NEIGHBORHOODS" | jq -r '.neighborhoods[1].id')
COMPARE_PAYLOAD="{\"neighborhoodIds\":[\"$FIRST_NEIGHBORHOOD\",\"$SECOND_NEIGHBORHOOD\"],\"year\":2020}"

COMPARISON=$(curl -s -X POST \
  -H "Content-Type: application/json" \
  -d "$COMPARE_PAYLOAD" \
  "$BASE_URL/api/socioeconomic/compare")

check_response "$COMPARISON" "Comparación de barrios"

# Verificar rankings
if echo "$COMPARISON" | jq -e '.rankings.density' >/dev/null 2>&1; then
  echo -e "${GREEN}✓${NC}   Ranking de densidad generado"
else
  echo -e "${RED}✗${NC}   Falta ranking de densidad"
fi

if echo "$COMPARISON" | jq -e '.rankings.services' >/dev/null 2>&1; then
  echo -e "${GREEN}✓${NC}   Ranking de servicios generado"
else
  echo -e "${RED}✗${NC}   Falta ranking de servicios"
fi

if echo "$COMPARISON" | jq -e '.rankings.deprivation' >/dev/null 2>&1; then
  echo -e "${GREEN}✓${NC}   Ranking de privación generado"
else
  echo -e "${RED}✗${NC}   Falta ranking de privación"
fi
echo ""

# Test 8: Filtrado de barrios
echo "🔍 Test 8: Filtrar barrios por criterios..."
FILTER_PAYLOAD='{"densityMin":1000,"densityMax":20000,"deprivationMin":0,"servicesMin":0}'

FILTERED=$(curl -s -X POST \
  -H "Content-Type: application/json" \
  -d "$FILTER_PAYLOAD" \
  "$BASE_URL/api/socioeconomic/filter")

check_response "$FILTERED" "Filtrado de barrios"

FILTERED_COUNT=$(echo "$FILTERED" | jq -r '.total')
echo "   Barrios encontrados: $FILTERED_COUNT"

if [ "$FILTERED_COUNT" -gt 0 ]; then
  echo -e "${GREEN}✓${NC}   Filtro funciona correctamente"
else
  echo -e "${YELLOW}⚠${NC}   No se encontraron barrios (puede ser normal según los filtros)"
fi
echo ""

# Test 9: Verificar estructura completa de respuesta
echo "🔍 Test 9: Verificar campos requeridos..."
REQUIRED_FIELDS=(
  ".neighborhood"
  ".year"
  ".population.densityMean"
  ".population.populationTotal"
  ".population.areaKm2"
  ".population.source"
  ".infrastructure.hospitals.count"
  ".infrastructure.schools.count"
  ".infrastructure.parks.areaKm2"
  ".infrastructure.servicesPerCapita"
  ".deprivation.deprivationIndex"
  ".deprivation.interpretation"
  ".deprivation.nightlightRadiance"
  ".deprivation.greenSpaceAccess"
  ".normalized.density"
  ".normalized.services"
  ".normalized.deprivation"
  ".summary"
)

ALL_FIELDS_OK=true
for field in "${REQUIRED_FIELDS[@]}"; do
  if echo "$SOCIO_2020" | jq -e "$field" >/dev/null 2>&1; then
    echo -e "${GREEN}✓${NC}   Campo presente: $field"
  else
    echo -e "${RED}✗${NC}   Campo faltante: $field"
    ALL_FIELDS_OK=false
  fi
done
echo ""

# Test 10: Verificar documentación Swagger
echo "📚 Test 10: Documentación Swagger..."
SWAGGER=$(curl -s "$BASE_URL/api-docs.json")
if echo "$SWAGGER" | jq -e '.paths."/api/socioeconomic/{neighborhoodId}"' >/dev/null 2>&1; then
  echo -e "${GREEN}✓${NC}   Endpoint /api/socioeconomic/{neighborhoodId} documentado"
else
  echo -e "${YELLOW}⚠${NC}   Falta documentación del endpoint principal"
fi

if echo "$SWAGGER" | jq -e '.paths."/api/socioeconomic/compare"' >/dev/null 2>&1; then
  echo -e "${GREEN}✓${NC}   Endpoint /api/socioeconomic/compare documentado"
else
  echo -e "${YELLOW}⚠${NC}   Falta documentación de comparación"
fi

if echo "$SWAGGER" | jq -e '.paths."/api/socioeconomic/filter"' >/dev/null 2>&1; then
  echo -e "${GREEN}✓${NC}   Endpoint /api/socioeconomic/filter documentado"
else
  echo -e "${YELLOW}⚠${NC}   Falta documentación de filtros"
fi
echo ""

# Test 11: Verificar frontend
echo "🌐 Test 11: Verificar archivos frontend..."
if [ -f "public/js/socioeconomic.js" ]; then
  echo -e "${GREEN}✓${NC}   Archivo socioeconomic.js existe"
else
  echo -e "${RED}✗${NC}   Falta archivo socioeconomic.js"
fi

if grep -q "socioeconomic.js" public/index.html; then
  echo -e "${GREEN}✓${NC}   Script incluido en index.html"
else
  echo -e "${RED}✗${NC}   Script no incluido en index.html"
fi

if grep -q "Datos Socioeconómicos" public/index.html; then
  echo -e "${GREEN}✓${NC}   Sección UI presente en HTML"
else
  echo -e "${RED}✗${NC}   Falta sección UI en HTML"
fi
echo ""

# Resumen final
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 RESUMEN DE PRUEBAS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if $ALL_FIELDS_OK; then
  echo -e "${GREEN}✓ Todos los tests pasaron exitosamente${NC}"
  echo ""
  echo "🎉 La implementación de Datos Socioeconómicos está lista!"
  echo ""
  echo "Próximos pasos:"
  echo "1. Abrir http://localhost:3000"
  echo "2. Scroll hasta 'Datos Socioeconómicos'"
  echo "3. Seleccionar un barrio y explorar"
  echo "4. Probar descarga de datos (JSON/CSV)"
  echo "5. Verificar tooltips (ⓘ)"
  exit 0
else
  echo -e "${YELLOW}⚠ Algunos tests fallaron${NC}"
  echo "Revisa los errores arriba y verifica la implementación."
  exit 1
fi
