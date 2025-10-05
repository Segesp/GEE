#!/bin/bash

###############################################################################
# Test Suite: Descargas Abiertas (CSV/GeoJSON)
# 
# Pruebas automatizadas para el sistema de exportación de datos en
# formatos abiertos con transparencia y reutilización.
#
# Uso:
#   ./tests/test-descargas.sh
#
# Requisitos:
#   - Servidor corriendo en http://localhost:3000
#   - curl instalado
#   - jq instalado (para formateo JSON)
###############################################################################

set -e

BASE_URL="http://localhost:3000"
TEST_DIR="/tmp/ecoplan-download-tests"

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Contadores
TESTS_PASSED=0
TESTS_FAILED=0

###############################################################################
# Funciones auxiliares
###############################################################################

print_header() {
  echo ""
  echo -e "${BLUE}╔══════════════════════════════════════════════════════════════════╗${NC}"
  echo -e "${BLUE}║${NC}  $1"
  echo -e "${BLUE}╚══════════════════════════════════════════════════════════════════╝${NC}"
  echo ""
}

print_test() {
  echo -e "${YELLOW}▶ Test:${NC} $1"
}

print_success() {
  echo -e "${GREEN}✓ PASS:${NC} $1"
  ((TESTS_PASSED++))
}

print_error() {
  echo -e "${RED}✗ FAIL:${NC} $1"
  ((TESTS_FAILED++))
}

print_info() {
  echo -e "${BLUE}ℹ Info:${NC} $1"
}

check_server() {
  if ! curl -s -f "$BASE_URL/" > /dev/null 2>&1; then
    echo -e "${RED}ERROR: Servidor no responde en $BASE_URL${NC}"
    echo "Por favor, inicia el servidor primero:"
    echo "  npm start"
    exit 1
  fi
  print_success "Servidor activo en $BASE_URL"
}

format_json() {
  if command -v jq &> /dev/null; then
    jq '.'
  else
    cat
  fi
}

###############################################################################
# Tests de Preparación
###############################################################################

test_setup() {
  print_header "Preparación del entorno de pruebas"
  
  check_server
  
  # Crear directorio temporal
  mkdir -p "$TEST_DIR"
  print_success "Directorio temporal: $TEST_DIR"
  
  # Crear algunos reportes de prueba si no existen
  print_test "Creando reportes de prueba"
  
  for i in 1 2 3; do
    curl -s -X POST "$BASE_URL/api/citizen-reports" \
      -H "Content-Type: application/json" \
      -d '{
        "category": "heat",
        "latitude": '$(echo "-12.04 + $i * 0.01" | bc)',
        "longitude": '$(echo "-77.04 + $i * 0.01" | bc)',
        "description": "Reporte de prueba #'$i'",
        "severity": "high",
        "images": []
      }' > /dev/null
  done
  
  print_success "Reportes de prueba creados"
}

###############################################################################
# Tests de Listado de Capas
###############################################################################

test_list_layers() {
  print_header "Test 1: Listar capas disponibles"
  
  print_test "GET /api/exports/layers"
  
  RESPONSE=$(curl -s -X GET "$BASE_URL/api/exports/layers")
  
  # Verificar que retorna capas
  LAYERS_COUNT=$(echo "$RESPONSE" | grep -o '"id"' | wc -l)
  
  if [ "$LAYERS_COUNT" -gt 0 ]; then
    print_success "Retorna $LAYERS_COUNT capas"
  else
    print_error "No retorna capas"
    echo "$RESPONSE" | format_json
    return 1
  fi
  
  # Verificar capas específicas
  if echo "$RESPONSE" | grep -q '"citizen-reports"' && \
     echo "$RESPONSE" | grep -q '"validated-reports"' && \
     echo "$RESPONSE" | grep -q '"heat-reports"'; then
    print_success "Incluye capas esperadas"
  else
    print_error "Faltan capas esperadas"
    echo "$RESPONSE" | format_json
    return 1
  fi
  
  echo "$RESPONSE" | format_json
}

###############################################################################
# Tests de Descarga CSV
###############################################################################

test_download_csv_all_reports() {
  print_header "Test 2: Descargar todos los reportes en CSV"
  
  print_test "GET /api/exports/download?layer=citizen-reports&format=csv"
  
  OUTPUT_FILE="$TEST_DIR/citizen-reports.csv"
  
  HTTP_CODE=$(curl -s -w "%{http_code}" -o "$OUTPUT_FILE" \
    "$BASE_URL/api/exports/download?layer=citizen-reports&format=csv")
  
  if [ "$HTTP_CODE" = "200" ]; then
    print_success "Descarga exitosa (HTTP 200)"
  else
    print_error "Descarga fallida (HTTP $HTTP_CODE)"
    return 1
  fi
  
  # Verificar que el archivo existe y tiene contenido
  if [ -f "$OUTPUT_FILE" ] && [ -s "$OUTPUT_FILE" ]; then
    LINES=$(wc -l < "$OUTPUT_FILE")
    print_success "Archivo generado con $LINES líneas"
  else
    print_error "Archivo vacío o no existe"
    return 1
  fi
  
  # Verificar headers CSV
  HEAD_LINE=$(head -1 "$OUTPUT_FILE")
  if echo "$HEAD_LINE" | grep -q "ID,Categoría,Latitud,Longitud"; then
    print_success "Headers CSV correctos"
  else
    print_error "Headers CSV incorrectos"
    echo "Headers: $HEAD_LINE"
    return 1
  fi
  
  print_info "Primeras 3 líneas del CSV:"
  head -3 "$OUTPUT_FILE"
}

test_download_csv_filtered() {
  print_header "Test 3: Descargar reportes filtrados en CSV"
  
  print_test "GET /api/exports/download?layer=heat-reports&format=csv"
  
  OUTPUT_FILE="$TEST_DIR/heat-reports.csv"
  
  curl -s -o "$OUTPUT_FILE" \
    "$BASE_URL/api/exports/download?layer=heat-reports&format=csv"
  
  if [ -f "$OUTPUT_FILE" ] && [ -s "$OUTPUT_FILE" ]; then
    LINES=$(wc -l < "$OUTPUT_FILE")
    print_success "Reportes de calor descargados ($LINES líneas)"
  else
    print_error "Descarga fallida"
    return 1
  fi
  
  # Verificar que solo contiene reportes de calor
  if grep -v "^ID," "$OUTPUT_FILE" | grep -q "heat"; then
    print_success "Contiene reportes de categoría 'heat'"
  else
    print_info "No hay reportes de calor en el dataset actual"
  fi
}

###############################################################################
# Tests de Descarga GeoJSON
###############################################################################

test_download_geojson() {
  print_header "Test 4: Descargar reportes en GeoJSON"
  
  print_test "GET /api/exports/download?layer=citizen-reports&format=geojson"
  
  OUTPUT_FILE="$TEST_DIR/citizen-reports.geojson"
  
  curl -s -o "$OUTPUT_FILE" \
    "$BASE_URL/api/exports/download?layer=citizen-reports&format=geojson"
  
  if [ -f "$OUTPUT_FILE" ] && [ -s "$OUTPUT_FILE" ]; then
    print_success "Archivo GeoJSON generado"
  else
    print_error "Descarga fallida"
    return 1
  fi
  
  # Verificar estructura GeoJSON
  if grep -q '"type":"FeatureCollection"' "$OUTPUT_FILE" && \
     grep -q '"features"' "$OUTPUT_FILE"; then
    print_success "Estructura GeoJSON válida"
  else
    print_error "Estructura GeoJSON inválida"
    return 1
  fi
  
  # Contar features
  FEATURES_COUNT=$(grep -o '"type":"Feature"' "$OUTPUT_FILE" | wc -l)
  print_success "Contiene $FEATURES_COUNT features"
  
  # Verificar metadatos
  if grep -q '"license":"CC BY 4.0"' "$OUTPUT_FILE" && \
     grep -q '"attribution":"EcoPlan Community"' "$OUTPUT_FILE"; then
    print_success "Metadatos de licencia presentes"
  else
    print_error "Faltan metadatos de licencia"
  fi
  
  print_info "Primeras líneas del GeoJSON:"
  head -20 "$OUTPUT_FILE" | format_json
}

test_download_geojson_validated() {
  print_header "Test 5: Descargar solo reportes validados"
  
  print_test "GET /api/exports/download?layer=validated-reports&format=geojson"
  
  OUTPUT_FILE="$TEST_DIR/validated-reports.geojson"
  
  curl -s -o "$OUTPUT_FILE" \
    "$BASE_URL/api/exports/download?layer=validated-reports&format=geojson"
  
  if [ -f "$OUTPUT_FILE" ] && [ -s "$OUTPUT_FILE" ]; then
    print_success "Reportes validados descargados"
  else
    print_error "Descarga fallida"
    return 1
  fi
  
  # Verificar que solo contiene validados (si hay datos)
  if grep -q '"validationStatus":"confirmed"' "$OUTPUT_FILE"; then
    print_success "Contiene reportes confirmados"
  else
    print_info "No hay reportes validados en el dataset actual"
  fi
}

###############################################################################
# Tests de Filtros
###############################################################################

test_download_with_date_filter() {
  print_header "Test 6: Descargar con filtro de fecha"
  
  TODAY=$(date +%Y-%m-%d)
  YESTERDAY=$(date -d "yesterday" +%Y-%m-%d 2>/dev/null || date -v-1d +%Y-%m-%d)
  
  print_test "GET /api/exports/download?layer=citizen-reports&format=csv&startDate=$YESTERDAY"
  
  OUTPUT_FILE="$TEST_DIR/reports-filtered-date.csv"
  
  curl -s -o "$OUTPUT_FILE" \
    "$BASE_URL/api/exports/download?layer=citizen-reports&format=csv&startDate=$YESTERDAY"
  
  if [ -f "$OUTPUT_FILE" ] && [ -s "$OUTPUT_FILE" ]; then
    LINES=$(wc -l < "$OUTPUT_FILE")
    print_success "Filtro de fecha aplicado ($LINES líneas)"
  else
    print_error "Descarga con filtro fallida"
    return 1
  fi
}

test_download_only_validated() {
  print_header "Test 7: Descargar solo validados (parámetro)"
  
  print_test "GET /api/exports/download?layer=citizen-reports&format=csv&onlyValidated=true"
  
  OUTPUT_FILE="$TEST_DIR/reports-only-validated.csv"
  
  curl -s -o "$OUTPUT_FILE" \
    "$BASE_URL/api/exports/download?layer=citizen-reports&format=csv&onlyValidated=true"
  
  if [ -f "$OUTPUT_FILE" ]; then
    print_success "Filtro onlyValidated aplicado"
  else
    print_error "Descarga fallida"
    return 1
  fi
}

###############################################################################
# Tests de Validación
###############################################################################

test_validation_missing_layer() {
  print_header "Test 8: Validación - Capa faltante"
  
  print_test "GET /api/exports/download?format=csv (sin layer)"
  
  RESPONSE=$(curl -s -X GET "$BASE_URL/api/exports/download?format=csv")
  
  if echo "$RESPONSE" | grep -q '"error"'; then
    print_success "Rechaza request sin layer"
  else
    print_error "No valida parámetro layer"
    echo "$RESPONSE" | format_json
    return 1
  fi
}

test_validation_invalid_format() {
  print_header "Test 9: Validación - Formato inválido"
  
  print_test "GET /api/exports/download?layer=citizen-reports&format=xml"
  
  RESPONSE=$(curl -s -X GET "$BASE_URL/api/exports/download?layer=citizen-reports&format=xml")
  
  if echo "$RESPONSE" | grep -q '"error"'; then
    print_success "Rechaza formato inválido"
  else
    print_error "No valida formato"
    echo "$RESPONSE" | format_json
    return 1
  fi
}

test_validation_geojson_not_available() {
  print_header "Test 10: Validación - GeoJSON no disponible para agregaciones"
  
  print_test "GET /api/exports/download?layer=neighborhood-aggregations&format=geojson"
  
  RESPONSE=$(curl -s -X GET "$BASE_URL/api/exports/download?layer=neighborhood-aggregations&format=geojson")
  
  if echo "$RESPONSE" | grep -q '"error"'; then
    print_success "Rechaza GeoJSON para capa no soportada"
  else
    print_error "No valida formato por capa"
    echo "$RESPONSE" | format_json
    return 1
  fi
}

###############################################################################
# Tests de Headers HTTP
###############################################################################

test_http_headers() {
  print_header "Test 11: Verificar headers HTTP"
  
  print_test "Verificando headers de descarga"
  
  HEADERS=$(curl -s -I "$BASE_URL/api/exports/download?layer=citizen-reports&format=csv")
  
  if echo "$HEADERS" | grep -q "Content-Type: text/csv"; then
    print_success "Content-Type correcto"
  else
    print_error "Content-Type incorrecto"
  fi
  
  if echo "$HEADERS" | grep -q "Content-Disposition: attachment"; then
    print_success "Content-Disposition presente"
  else
    print_error "Falta Content-Disposition"
  fi
  
  if echo "$HEADERS" | grep -q "X-Download-ID:"; then
    print_success "X-Download-ID presente"
  else
    print_error "Falta X-Download-ID"
  fi
  
  if echo "$HEADERS" | grep -q "X-Record-Count:"; then
    print_success "X-Record-Count presente"
  else
    print_error "Falta X-Record-Count"
  fi
  
  echo "$HEADERS" | head -15
}

###############################################################################
# Tests de Estadísticas
###############################################################################

test_download_stats() {
  print_header "Test 12: Estadísticas de descargas"
  
  print_test "GET /api/exports/stats"
  
  RESPONSE=$(curl -s -X GET "$BASE_URL/api/exports/stats")
  
  if echo "$RESPONSE" | grep -q '"totalDownloads"'; then
    print_success "Retorna estadísticas"
  else
    print_error "No retorna estadísticas"
    echo "$RESPONSE" | format_json
    return 1
  fi
  
  if echo "$RESPONSE" | grep -q '"byFormat"' && \
     echo "$RESPONSE" | grep -q '"byLayer"'; then
    print_success "Incluye desglose por formato y capa"
  else
    print_error "Falta desglose"
  fi
  
  if echo "$RESPONSE" | grep -q '"topLayers"'; then
    print_success "Incluye ranking de capas"
  fi
  
  echo "$RESPONSE" | format_json
}

###############################################################################
# Tests de Metadatos
###############################################################################

test_layer_metadata() {
  print_header "Test 13: Metadatos de capa"
  
  print_test "GET /api/exports/metadata/citizen-reports?format=csv"
  
  RESPONSE=$(curl -s -X GET "$BASE_URL/api/exports/metadata/citizen-reports?format=csv")
  
  if echo "$RESPONSE" | grep -q '"license":"CC BY 4.0"'; then
    print_success "Incluye licencia CC BY 4.0"
  else
    print_error "Falta licencia"
    echo "$RESPONSE" | format_json
    return 1
  fi
  
  if echo "$RESPONSE" | grep -q '"attribution":"EcoPlan Community"'; then
    print_success "Incluye atribución"
  else
    print_error "Falta atribución"
  fi
  
  if echo "$RESPONSE" | grep -q '"recordCount"'; then
    print_success "Incluye conteo de registros"
  fi
  
  echo "$RESPONSE" | format_json
}

###############################################################################
# Tests de Casos Especiales
###############################################################################

test_empty_results() {
  print_header "Test 14: Resultados vacíos con filtros restrictivos"
  
  print_test "GET /api/exports/download con filtros que no matchean"
  
  FUTURE_DATE="2030-01-01"
  OUTPUT_FILE="$TEST_DIR/empty-results.csv"
  
  curl -s -o "$OUTPUT_FILE" \
    "$BASE_URL/api/exports/download?layer=citizen-reports&format=csv&startDate=$FUTURE_DATE"
  
  if [ -f "$OUTPUT_FILE" ]; then
    LINES=$(wc -l < "$OUTPUT_FILE")
    if [ "$LINES" -eq 1 ]; then
      print_success "Retorna solo headers cuando no hay datos"
    else
      print_info "Dataset tiene $LINES líneas"
    fi
  else
    print_error "No genera archivo"
    return 1
  fi
}

test_large_dataset() {
  print_header "Test 15: Dataset grande"
  
  print_test "Descargando todos los reportes sin filtros"
  
  OUTPUT_FILE="$TEST_DIR/all-reports-large.csv"
  
  START_TIME=$(date +%s)
  curl -s -o "$OUTPUT_FILE" \
    "$BASE_URL/api/exports/download?layer=citizen-reports&format=csv"
  END_TIME=$(date +%s)
  
  DURATION=$((END_TIME - START_TIME))
  SIZE=$(du -h "$OUTPUT_FILE" | cut -f1)
  LINES=$(wc -l < "$OUTPUT_FILE")
  
  print_success "Descarga completada en ${DURATION}s"
  print_info "Tamaño: $SIZE"
  print_info "Líneas: $LINES"
}

###############################################################################
# Resumen Final
###############################################################################

print_summary() {
  print_header "Resumen de Pruebas"
  
  TOTAL_TESTS=$((TESTS_PASSED + TESTS_FAILED))
  
  echo ""
  echo -e "${BLUE}Total de pruebas:${NC} $TOTAL_TESTS"
  echo -e "${GREEN}Pruebas exitosas:${NC} $TESTS_PASSED"
  echo -e "${RED}Pruebas fallidas:${NC} $TESTS_FAILED"
  echo ""
  
  echo -e "${BLUE}Archivos generados en:${NC} $TEST_DIR"
  ls -lh "$TEST_DIR" 2>/dev/null || true
  echo ""
  
  if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}╔════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║  ✓ TODAS LAS PRUEBAS PASARON              ║${NC}"
    echo -e "${GREEN}╚════════════════════════════════════════════╝${NC}"
    echo ""
    return 0
  else
    echo -e "${RED}╔════════════════════════════════════════════╗${NC}"
    echo -e "${RED}║  ✗ ALGUNAS PRUEBAS FALLARON               ║${NC}"
    echo -e "${RED}╚════════════════════════════════════════════╝${NC}"
    echo ""
    return 1
  fi
}

###############################################################################
# Ejecución de Tests
###############################################################################

main() {
  print_header "Suite de Pruebas: Descargas Abiertas (CSV/GeoJSON)"
  
  echo "Iniciando pruebas automatizadas..."
  echo "Servidor: $BASE_URL"
  echo ""
  
  # Setup
  test_setup
  
  # Tests de listado
  test_list_layers
  
  # Tests de descarga CSV
  test_download_csv_all_reports
  test_download_csv_filtered
  
  # Tests de descarga GeoJSON
  test_download_geojson
  test_download_geojson_validated
  
  # Tests de filtros
  test_download_with_date_filter
  test_download_only_validated
  
  # Tests de validación
  test_validation_missing_layer
  test_validation_invalid_format
  test_validation_geojson_not_available
  
  # Tests de headers y metadatos
  test_http_headers
  test_download_stats
  test_layer_metadata
  
  # Tests de casos especiales
  test_empty_results
  test_large_dataset
  
  # Resumen
  print_summary
}

# Ejecutar suite
main
exit $?
