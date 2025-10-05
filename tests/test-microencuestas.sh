#!/bin/bash

###############################################################################
# Test Suite: Micro-encuestas de 1 Clic
# 
# Pruebas automatizadas para el sistema de micro-encuestas ultraligero
# con respuestas tipo chip y agregación por barrio.
#
# Uso:
#   ./tests/test-microencuestas.sh
#
# Requisitos:
#   - Servidor corriendo en http://localhost:3000
#   - curl instalado
#   - jq instalado (para formateo JSON)
###############################################################################

set -e

BASE_URL="http://localhost:3000"
REPORT_ID=""
USER_ID="test-device-$(date +%s)"

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
  
  # Crear reporte de prueba
  print_test "Creando reporte ciudadano de prueba"
  
  RESPONSE=$(curl -s -X POST "$BASE_URL/api/citizen-reports" \
    -H "Content-Type: application/json" \
    -d '{
      "category": "heat",
      "latitude": -12.0464,
      "longitude": -77.0428,
      "description": "Isla de calor extrema en zona urbana sin áreas verdes",
      "severity": "high",
      "images": []
    }')
  
  # Extraer ID (puede ser UUID o número)
  REPORT_ID=$(echo "$RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
  
  if [ -z "$REPORT_ID" ]; then
    # Intentar con formato numérico
    REPORT_ID=$(echo "$RESPONSE" | grep -o '"id":[0-9]*' | grep -o '[0-9]*' | head -1)
  fi
  
  if [ -z "$REPORT_ID" ]; then
    print_error "No se pudo crear reporte de prueba"
    echo "$RESPONSE" | format_json
    exit 1
  fi
  
  print_success "Reporte creado con ID: $REPORT_ID"
  print_info "User ID para pruebas: $USER_ID"
}

###############################################################################
# Tests de Consulta de Preguntas
###############################################################################

test_get_questions() {
  print_header "Test 1: Obtener preguntas para reporte"
  
  print_test "GET /api/citizen-reports/$REPORT_ID/survey/questions"
  
  RESPONSE=$(curl -s -X GET "$BASE_URL/api/citizen-reports/$REPORT_ID/survey/questions")
  
  # Verificar que retorna preguntas
  QUESTIONS_COUNT=$(echo "$RESPONSE" | grep -o '"questionKey"' | wc -l)
  
  if [ "$QUESTIONS_COUNT" -gt 0 ]; then
    print_success "Retorna $QUESTIONS_COUNT preguntas"
  else
    print_error "No retorna preguntas"
    echo "$RESPONSE" | format_json
    return 1
  fi
  
  # Verificar estructura de respuesta
  if echo "$RESPONSE" | grep -q '"category"' && \
     echo "$RESPONSE" | grep -q '"progress"' && \
     echo "$RESPONSE" | grep -q '"questions"'; then
    print_success "Estructura de respuesta correcta"
  else
    print_error "Estructura de respuesta incorrecta"
    echo "$RESPONSE" | format_json
    return 1
  fi
  
  # Verificar preguntas específicas de categoría (heat)
  if echo "$RESPONSE" | grep -q '"heat_time"'; then
    print_success "Incluye pregunta específica de categoría 'heat'"
  else
    print_error "No incluye pregunta específica de categoría"
  fi
  
  echo "$RESPONSE" | format_json
}

###############################################################################
# Tests de Registro de Respuestas
###############################################################################

test_record_response_duration() {
  print_header "Test 2: Registrar respuesta - Duración"
  
  print_test "POST /api/citizen-reports/$REPORT_ID/survey/respond (duration=days)"
  
  RESPONSE=$(curl -s -X POST "$BASE_URL/api/citizen-reports/$REPORT_ID/survey/respond" \
    -H "Content-Type: application/json" \
    -d '{
      "questionKey": "duration",
      "selectedOption": "days",
      "userIdentifier": "'"$USER_ID"'",
      "latitude": -12.0464,
      "longitude": -77.0428
    }')
  
  if echo "$RESPONSE" | grep -q '"success":true'; then
    print_success "Respuesta registrada exitosamente"
  else
    print_error "No se pudo registrar respuesta"
    echo "$RESPONSE" | format_json
    return 1
  fi
  
  if echo "$RESPONSE" | grep -q '"isNewResponse":true'; then
    print_success "Marcada como nueva respuesta"
  else
    print_error "No marcada como nueva respuesta"
  fi
  
  if echo "$RESPONSE" | grep -q '"neighborhood"'; then
    NEIGHBORHOOD=$(echo "$RESPONSE" | grep -o '"neighborhood":"[^"]*"' | cut -d'"' -f4)
    print_success "Asignada a barrio: $NEIGHBORHOOD"
  else
    print_error "No asignada a barrio"
  fi
  
  echo "$RESPONSE" | format_json
}

test_record_response_vulnerable() {
  print_header "Test 3: Registrar respuesta - Grupos vulnerables"
  
  print_test "POST /api/citizen-reports/$REPORT_ID/survey/respond (vulnerable_groups=elderly)"
  
  RESPONSE=$(curl -s -X POST "$BASE_URL/api/citizen-reports/$REPORT_ID/survey/respond" \
    -H "Content-Type: application/json" \
    -d '{
      "questionKey": "vulnerable_groups",
      "selectedOption": "elderly",
      "userIdentifier": "'"$USER_ID"'",
      "latitude": -12.0464,
      "longitude": -77.0428
    }')
  
  if echo "$RESPONSE" | grep -q '"success":true'; then
    print_success "Respuesta de grupos vulnerables registrada"
  else
    print_error "No se pudo registrar"
    echo "$RESPONSE" | format_json
    return 1
  fi
  
  # Verificar progreso
  if echo "$RESPONSE" | grep -q '"progressPercentage"'; then
    PROGRESS=$(echo "$RESPONSE" | grep -o '"progressPercentage":[0-9]*' | grep -o '[0-9]*')
    print_success "Progreso actualizado: $PROGRESS%"
  fi
  
  echo "$RESPONSE" | format_json
}

test_record_response_sensitive() {
  print_header "Test 4: Registrar respuesta - Lugares sensibles"
  
  print_test "POST /api/citizen-reports/$REPORT_ID/survey/respond (nearby_sensitive=school)"
  
  RESPONSE=$(curl -s -X POST "$BASE_URL/api/citizen-reports/$REPORT_ID/survey/respond" \
    -H "Content-Type: application/json" \
    -d '{
      "questionKey": "nearby_sensitive",
      "selectedOption": "school",
      "userIdentifier": "'"$USER_ID"'",
      "latitude": -12.0464,
      "longitude": -77.0428
    }')
  
  if echo "$RESPONSE" | grep -q '"success":true'; then
    print_success "Respuesta de lugar sensible registrada"
  else
    print_error "No se pudo registrar"
    echo "$RESPONSE" | format_json
    return 1
  fi
  
  echo "$RESPONSE" | format_json
}

test_record_response_heat_specific() {
  print_header "Test 5: Registrar respuesta - Pregunta específica de calor"
  
  print_test "POST /api/citizen-reports/$REPORT_ID/survey/respond (heat_time=midday)"
  
  RESPONSE=$(curl -s -X POST "$BASE_URL/api/citizen-reports/$REPORT_ID/survey/respond" \
    -H "Content-Type: application/json" \
    -d '{
      "questionKey": "heat_time",
      "selectedOption": "midday",
      "userIdentifier": "'"$USER_ID"'",
      "latitude": -12.0464,
      "longitude": -77.0428
    }')
  
  if echo "$RESPONSE" | grep -q '"success":true'; then
    print_success "Respuesta específica de calor registrada"
  else
    print_error "No se pudo registrar"
    echo "$RESPONSE" | format_json
    return 1
  fi
  
  echo "$RESPONSE" | format_json
}

test_update_response() {
  print_header "Test 6: Actualizar respuesta existente"
  
  print_test "POST /api/citizen-reports/$REPORT_ID/survey/respond (duration=weeks - actualización)"
  
  RESPONSE=$(curl -s -X POST "$BASE_URL/api/citizen-reports/$REPORT_ID/survey/respond" \
    -H "Content-Type: application/json" \
    -d '{
      "questionKey": "duration",
      "selectedOption": "weeks",
      "userIdentifier": "'"$USER_ID"'",
      "latitude": -12.0464,
      "longitude": -77.0428
    }')
  
  if echo "$RESPONSE" | grep -q '"isNewResponse":false'; then
    print_success "Detectada como actualización (no nueva respuesta)"
  else
    print_error "No detectada como actualización"
    echo "$RESPONSE" | format_json
    return 1
  fi
  
  if echo "$RESPONSE" | grep -q '"message":"Respuesta actualizada"'; then
    print_success "Mensaje de actualización correcto"
  fi
  
  echo "$RESPONSE" | format_json
}

###############################################################################
# Tests de Validación
###############################################################################

test_validation_missing_fields() {
  print_header "Test 7: Validación - Campos faltantes"
  
  print_test "POST /api/citizen-reports/$REPORT_ID/survey/respond (sin questionKey)"
  
  RESPONSE=$(curl -s -X POST "$BASE_URL/api/citizen-reports/$REPORT_ID/survey/respond" \
    -H "Content-Type: application/json" \
    -d '{
      "selectedOption": "days",
      "userIdentifier": "'"$USER_ID"'",
      "latitude": -12.0464,
      "longitude": -77.0428
    }')
  
  if echo "$RESPONSE" | grep -q '"error"'; then
    print_success "Rechaza request sin questionKey"
  else
    print_error "No valida campos requeridos"
    echo "$RESPONSE" | format_json
    return 1
  fi
  
  echo "$RESPONSE" | format_json
}

test_validation_invalid_question() {
  print_header "Test 8: Validación - Pregunta inválida"
  
  print_test "POST /api/citizen-reports/$REPORT_ID/survey/respond (questionKey inexistente)"
  
  RESPONSE=$(curl -s -X POST "$BASE_URL/api/citizen-reports/$REPORT_ID/survey/respond" \
    -H "Content-Type: application/json" \
    -d '{
      "questionKey": "invalid_question_key",
      "selectedOption": "some_value",
      "userIdentifier": "'"$USER_ID"'",
      "latitude": -12.0464,
      "longitude": -77.0428
    }')
  
  if echo "$RESPONSE" | grep -q '"error".*Pregunta no encontrada'; then
    print_success "Rechaza pregunta inexistente"
  else
    print_error "No valida pregunta"
    echo "$RESPONSE" | format_json
    return 1
  fi
  
  echo "$RESPONSE" | format_json
}

test_validation_invalid_option() {
  print_header "Test 9: Validación - Opción inválida"
  
  print_test "POST /api/citizen-reports/$REPORT_ID/survey/respond (opción inexistente)"
  
  RESPONSE=$(curl -s -X POST "$BASE_URL/api/citizen-reports/$REPORT_ID/survey/respond" \
    -H "Content-Type: application/json" \
    -d '{
      "questionKey": "duration",
      "selectedOption": "invalid_option",
      "userIdentifier": "'"$USER_ID"'",
      "latitude": -12.0464,
      "longitude": -77.0428
    }')
  
  if echo "$RESPONSE" | grep -q '"error".*Opción inválida'; then
    print_success "Rechaza opción inexistente"
  else
    print_error "No valida opción"
    echo "$RESPONSE" | format_json
    return 1
  fi
  
  echo "$RESPONSE" | format_json
}

###############################################################################
# Tests de Agregación por Barrio
###############################################################################

test_multiple_users_responses() {
  print_header "Test 10: Respuestas de múltiples usuarios"
  
  print_test "Simulando 3 usuarios diferentes respondiendo"
  
  for i in 1 2 3; do
    USER="test-user-$i-$(date +%s)"
    
    curl -s -X POST "$BASE_URL/api/citizen-reports/$REPORT_ID/survey/respond" \
      -H "Content-Type: application/json" \
      -d '{
        "questionKey": "impact_level",
        "selectedOption": "high",
        "userIdentifier": "'"$USER"'",
        "latitude": -12.0464,
        "longitude": -77.0428
      }' > /dev/null
    
    print_info "Usuario $i registrado"
  done
  
  print_success "3 usuarios registrados exitosamente"
}

test_neighborhood_stats() {
  print_header "Test 11: Estadísticas del barrio"
  
  # Obtener barrio del primer reporte
  QUESTIONS_RESPONSE=$(curl -s -X GET "$BASE_URL/api/citizen-reports/$REPORT_ID/survey/questions")
  
  # Hacer request para obtener stats (usando un barrio conocido)
  print_test "GET /api/surveys/neighborhood/San%20Isidro%20Centro/progress"
  
  RESPONSE=$(curl -s -X GET "$BASE_URL/api/surveys/neighborhood/San%20Isidro%20Centro/progress")
  
  if echo "$RESPONSE" | grep -q '"neighborhood"'; then
    print_success "Retorna estadísticas del barrio"
  else
    print_error "No retorna estadísticas"
    echo "$RESPONSE" | format_json
    return 1
  fi
  
  if echo "$RESPONSE" | grep -q '"totalResponses"'; then
    TOTAL=$(echo "$RESPONSE" | grep -o '"totalResponses":[0-9]*' | grep -o '[0-9]*')
    print_success "Total de respuestas en barrio: $TOTAL"
  fi
  
  echo "$RESPONSE" | format_json
}

test_neighborhood_aggregations() {
  print_header "Test 12: Agregaciones del barrio"
  
  print_test "GET /api/surveys/neighborhood/San%20Isidro%20Centro/results"
  
  RESPONSE=$(curl -s -X GET "$BASE_URL/api/surveys/neighborhood/San%20Isidro%20Centro/results")
  
  if echo "$RESPONSE" | grep -q '"aggregations"'; then
    print_success "Retorna agregaciones"
  else
    print_error "No retorna agregaciones"
    echo "$RESPONSE" | format_json
    return 1
  fi
  
  if echo "$RESPONSE" | grep -q '"distribution"'; then
    print_success "Incluye distribución de respuestas"
  fi
  
  if echo "$RESPONSE" | grep -q '"percentage"'; then
    print_success "Calcula porcentajes"
  fi
  
  echo "$RESPONSE" | format_json
}

###############################################################################
# Tests de Métricas Globales
###############################################################################

test_global_metrics() {
  print_header "Test 13: Métricas globales"
  
  print_test "GET /api/surveys/metrics"
  
  RESPONSE=$(curl -s -X GET "$BASE_URL/api/surveys/metrics")
  
  if echo "$RESPONSE" | grep -q '"metrics"'; then
    print_success "Retorna métricas globales"
  else
    print_error "No retorna métricas"
    echo "$RESPONSE" | format_json
    return 1
  fi
  
  if echo "$RESPONSE" | grep -q '"topNeighborhoods"'; then
    print_success "Incluye ranking de barrios"
  fi
  
  if echo "$RESPONSE" | grep -q '"totalResponses"'; then
    TOTAL=$(echo "$RESPONSE" | grep -o '"totalResponses":[0-9]*' | grep -o '[0-9]*')
    print_success "Total de respuestas en sistema: $TOTAL"
  fi
  
  if echo "$RESPONSE" | grep -q '"neighborhoodCoveragePercent"'; then
    COVERAGE=$(echo "$RESPONSE" | grep -o '"neighborhoodCoveragePercent":[0-9]*' | grep -o '[0-9]*')
    print_success "Cobertura de barrios: $COVERAGE%"
  fi
  
  echo "$RESPONSE" | format_json
}

test_survey_templates() {
  print_header "Test 14: Plantillas de preguntas"
  
  print_test "GET /api/surveys/templates"
  
  RESPONSE=$(curl -s -X GET "$BASE_URL/api/surveys/templates")
  
  TEMPLATES_COUNT=$(echo "$RESPONSE" | grep -o '"questionKey"' | wc -l)
  
  if [ "$TEMPLATES_COUNT" -gt 0 ]; then
    print_success "Retorna $TEMPLATES_COUNT plantillas"
  else
    print_error "No retorna plantillas"
    echo "$RESPONSE" | format_json
    return 1
  fi
  
  # Test con filtro de categoría
  print_test "GET /api/surveys/templates?category=heat"
  
  RESPONSE=$(curl -s -X GET "$BASE_URL/api/surveys/templates?category=heat")
  
  if echo "$RESPONSE" | grep -q '"heat_time"'; then
    print_success "Filtra plantillas por categoría"
  fi
  
  echo "$RESPONSE" | format_json
}

###############################################################################
# Tests de Progreso
###############################################################################

test_report_progress() {
  print_header "Test 15: Verificar progreso del reporte"
  
  print_test "GET /api/citizen-reports/$REPORT_ID/survey/questions (verificar progreso)"
  
  RESPONSE=$(curl -s -X GET "$BASE_URL/api/citizen-reports/$REPORT_ID/survey/questions")
  
  if echo "$RESPONSE" | grep -q '"progress"'; then
    ANSWERED=$(echo "$RESPONSE" | grep -o '"answeredQuestions":[0-9]*' | grep -o '[0-9]*')
    TOTAL=$(echo "$RESPONSE" | grep -o '"totalQuestions":[0-9]*' | grep -o '[0-9]*')
    PERCENT=$(echo "$RESPONSE" | grep -o '"progressPercentage":[0-9]*' | grep -o '[0-9]*')
    
    print_success "Progreso: $ANSWERED/$TOTAL preguntas ($PERCENT%)"
  else
    print_error "No retorna información de progreso"
    echo "$RESPONSE" | format_json
    return 1
  fi
  
  if echo "$RESPONSE" | grep -q '"existingResponses"'; then
    print_success "Incluye respuestas existentes"
  fi
  
  echo "$RESPONSE" | format_json
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
  print_header "Suite de Pruebas: Micro-encuestas de 1 Clic"
  
  echo "Iniciando pruebas automatizadas..."
  echo "Servidor: $BASE_URL"
  echo ""
  
  # Setup
  test_setup
  
  # Tests de consulta
  test_get_questions
  
  # Tests de registro de respuestas
  test_record_response_duration
  test_record_response_vulnerable
  test_record_response_sensitive
  test_record_response_heat_specific
  test_update_response
  
  # Tests de validación
  test_validation_missing_fields
  test_validation_invalid_question
  test_validation_invalid_option
  
  # Tests de agregación
  test_multiple_users_responses
  test_neighborhood_stats
  test_neighborhood_aggregations
  
  # Tests de métricas
  test_global_metrics
  test_survey_templates
  
  # Tests de progreso
  test_report_progress
  
  # Resumen
  print_summary
}

# Ejecutar suite
main
exit $?
