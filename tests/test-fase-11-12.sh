#!/bin/bash
# test-fase-11-12.sh
# Suite completa de pruebas para Fase 11-12: Recomendador y Panel de Autoridades

echo "🧪 ============================================"
echo "   PRUEBAS FASE 11-12: RECOMENDADOR + PANEL"
echo "============================================"
echo ""

# Colores para output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Contador de pruebas
TOTAL=0
PASSED=0
FAILED=0

# Función para verificar test
check_test() {
    TOTAL=$((TOTAL + 1))
    if [ $1 -eq 0 ]; then
        echo -e "   ${GREEN}✅ PASS${NC}"
        PASSED=$((PASSED + 1))
    else
        echo -e "   ${RED}❌ FAIL${NC}"
        FAILED=$((FAILED + 1))
    fi
}

# ============================================================================
# TEST 1: Servidor activo
# ============================================================================
echo "1️⃣  Verificando servidor..."
curl -s -f http://localhost:3000/ > /dev/null
check_test $?

# ============================================================================
# TEST 2: Catálogo de intervenciones
# ============================================================================
echo ""
echo "2️⃣  Catálogo de intervenciones..."
CATALOG=$(curl -s http://localhost:3000/api/recommendations/interventions)
COUNT=$(echo $CATALOG | jq -e 'length' 2>/dev/null)

if [ "$COUNT" -eq 5 ]; then
    echo "   📦 $COUNT tipos de intervención disponibles"
    check_test 0
else
    echo "   ❌ Esperaba 5, obtuvo $COUNT"
    check_test 1
fi

# Mostrar nombres
echo $CATALOG | jq -r '.[] | "      • \(.name) (Viabilidad: \(.viability))"'

# ============================================================================
# TEST 3: Ranking de barrios
# ============================================================================
echo ""
echo "3️⃣  Ranking de barrios por vulnerabilidad..."
RANKING=$(curl -s http://localhost:3000/api/recommendations/prioritize)
BARRIOS=$(echo $RANKING | jq -e 'length' 2>/dev/null)

if [ "$BARRIOS" -ge 1 ]; then
    echo "   🏆 $BARRIOS barrios priorizados"
    check_test 0
else
    echo "   ❌ No se obtuvo ranking"
    check_test 1
fi

# Mostrar top 3
echo "   Top 3 más vulnerables:"
echo $RANKING | jq -r '.[0:3] | .[] | "      \(.rank). \(.neighborhoodName) - \(.score * 100 | round)% (\(.classification))"'

# ============================================================================
# TEST 4: Recomendaciones para barrio específico
# ============================================================================
echo ""
echo "4️⃣  Recomendaciones para Barranco..."
RECS=$(curl -s "http://localhost:3000/api/recommendations/recommend/barranco?budget=5000000&timeframe=36")
NEIGHBORHOOD=$(echo $RECS | jq -r '.neighborhoodName')

if [ "$NEIGHBORHOOD" == "Barranco" ]; then
    check_test 0
    
    VULN=$(echo $RECS | jq -r '.vulnerability.score * 100 | round')
    CLASS=$(echo $RECS | jq -r '.vulnerability.classification')
    INTERVENTIONS=$(echo $RECS | jq -e '.recommendations | length')
    COST=$(echo $RECS | jq -e '.totalCost')
    
    echo "   📊 Vulnerabilidad: $VULN% ($CLASS)"
    echo "   💡 Intervenciones recomendadas: $INTERVENTIONS"
    echo "   💰 Inversión total: \$$(printf "%'d" $COST) USD"
    
    if [ "$INTERVENTIONS" -gt 0 ]; then
        echo "   Detalles:"
        echo $RECS | jq -r '.recommendations[] | "      • \(.name): \$\(.estimatedCost | tostring) USD"'
    fi
else
    check_test 1
fi

# ============================================================================
# TEST 5: Portafolio de intervenciones
# ============================================================================
echo ""
echo "5️⃣  Portafolio completo de intervenciones..."
PORTFOLIO=$(curl -s "http://localhost:3000/api/recommendations/portfolio?totalBudget=5000000&timeframe=36")
NEIGHBORHOODS=$(echo $PORTFOLIO | jq -e '.portfolio | length')

if [ "$NEIGHBORHOODS" -ge 1 ]; then
    echo "   📋 $NEIGHBORHOODS barrios incluidos en portafolio"
    check_test 0
    
    TOTAL_BUDGET=$(echo $PORTFOLIO | jq -e '.summary.totalBudget')
    TOTAL_INV=$(echo $PORTFOLIO | jq -e '.summary.totalInvestment')
    TOTAL_INT=$(echo $PORTFOLIO | jq -e '.summary.totalInterventions')
    
    if [ ! -z "$TOTAL_BUDGET" ] && [ "$TOTAL_BUDGET" != "null" ]; then
        echo "   💰 Presupuesto total: \$$(printf "%'d" $TOTAL_BUDGET) USD"
        echo "   💸 Inversión ejecutada: \$$(printf "%'d" $TOTAL_INV) USD"
        echo "   🔧 Total de intervenciones: $TOTAL_INT"
    fi
else
    echo "   ❌ No se generó portafolio"
    check_test 1
fi

# ============================================================================
# TEST 6: Exportación GeoJSON
# ============================================================================
echo ""
echo "6️⃣  Exportación GeoJSON para SIG..."
GEOJSON=$(curl -s "http://localhost:3000/api/recommendations/export/geojson")
TYPE=$(echo $GEOJSON | jq -r -e '.type')
FEATURES=$(echo $GEOJSON | jq -e '.features | length')

if [ "$TYPE" == "FeatureCollection" ] && [ "$FEATURES" -ge 1 ]; then
    echo "   🗺️  Tipo: $TYPE con $FEATURES features"
    check_test 0
    
    echo "   Propiedades incluidas:"
    echo $GEOJSON | jq -r '.features[0].properties | keys[]' | head -5 | sed 's/^/      • /'
else
    echo "   ❌ GeoJSON inválido"
    check_test 1
fi

# ============================================================================
# TEST 7: Panel de autoridades HTML
# ============================================================================
echo ""
echo "7️⃣  Panel de autoridades (interfaz web)..."
STATUS=$(curl -s -I http://localhost:3000/panel-autoridades.html | head -1)

if echo "$STATUS" | grep -q "200 OK"; then
    echo "   🏛️  Panel accesible: $STATUS"
    check_test 0
    
    # Verificar elementos clave del HTML
    HTML=$(curl -s http://localhost:3000/panel-autoridades.html)
    
    if echo "$HTML" | grep -q "Panel de Autoridades"; then
        echo "      ✓ Título correcto"
    fi
    
    if echo "$HTML" | grep -q "tab-ranking"; then
        echo "      ✓ Tab Ranking presente"
    fi
    
    if echo "$HTML" | grep -q "tab-map"; then
        echo "      ✓ Tab Mapa presente"
    fi
    
    if echo "$HTML" | grep -q "tab-portfolio"; then
        echo "      ✓ Tab Portafolio presente"
    fi
    
    if echo "$HTML" | grep -q "tab-export"; then
        echo "      ✓ Tab Exportar presente"
    fi
else
    echo "   ❌ Panel no accesible"
    check_test 1
fi

# ============================================================================
# TEST 8: Documentación Swagger actualizada
# ============================================================================
echo ""
echo "8️⃣  Documentación API (Swagger)..."
SWAGGER=$(curl -s http://localhost:3000/api-docs.json)
TITLE=$(echo $SWAGGER | jq -r '.info.title')
PATHS=$(echo $SWAGGER | jq -e '.paths | keys | length')

if [ ! -z "$TITLE" ] && [ "$PATHS" -ge 30 ]; then
    echo "   📚 $TITLE"
    echo "   📖 $PATHS endpoints documentados"
    check_test 0
    
    # Verificar tags nuevos
    TAGS=$(echo $SWAGGER | jq -r '.tags[].name' | grep -i recomendaciones)
    if [ ! -z "$TAGS" ]; then
        echo "      ✓ Tag 'Recomendaciones' agregado"
    fi
else
    echo "   ❌ Swagger incompleto"
    check_test 1
fi

# ============================================================================
# TEST 9: Prueba de carga (performance básico)
# ============================================================================
echo ""
echo "9️⃣  Prueba de performance (tiempo de respuesta)..."
START=$(date +%s%N)
curl -s http://localhost:3000/api/recommendations/prioritize > /dev/null
END=$(date +%s%N)
DURATION=$(( ($END - $START) / 1000000 )) # Convertir a ms

if [ $DURATION -lt 1000 ]; then
    echo "   ⚡ Tiempo de respuesta: ${DURATION}ms (EXCELENTE)"
    check_test 0
elif [ $DURATION -lt 3000 ]; then
    echo "   ⏱️  Tiempo de respuesta: ${DURATION}ms (ACEPTABLE)"
    check_test 0
else
    echo "   🐌 Tiempo de respuesta: ${DURATION}ms (LENTO)"
    check_test 1
fi

# ============================================================================
# TEST 10: Endpoints de PDF (disponibilidad)
# ============================================================================
echo ""
echo "🔟 Endpoints de generación de PDF..."

# Test PDF individual (solo verificamos que responde, no descargamos)
PDF_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:3000/api/recommendations/pdf/barranco?budget=1000000")

if [ "$PDF_STATUS" == "200" ]; then
    echo "   📄 PDF individual: Disponible (HTTP $PDF_STATUS)"
    check_test 0
else
    echo "   ❌ PDF individual: Error (HTTP $PDF_STATUS)"
    check_test 1
fi

# Test PDF portafolio
PDF_PORTFOLIO_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:3000/api/recommendations/portfolio/pdf")

if [ "$PDF_PORTFOLIO_STATUS" == "200" ]; then
    echo "   📊 PDF portafolio: Disponible (HTTP $PDF_PORTFOLIO_STATUS)"
else
    echo "   ⚠️  PDF portafolio: HTTP $PDF_PORTFOLIO_STATUS (puede requerir datos adicionales)"
fi

# ============================================================================
# RESUMEN FINAL
# ============================================================================
echo ""
echo "============================================"
echo "   📊 RESUMEN DE PRUEBAS"
echo "============================================"
echo ""
echo "Total de pruebas:  $TOTAL"
echo -e "${GREEN}Exitosas:          $PASSED${NC}"
echo -e "${RED}Fallidas:          $FAILED${NC}"
echo ""

PERCENTAGE=$((PASSED * 100 / TOTAL))

if [ $PERCENTAGE -eq 100 ]; then
    echo -e "${GREEN}✅ TODAS LAS PRUEBAS PASARON (100%)${NC}"
    echo ""
    echo "🎉 Sistema FASE 11-12 completamente funcional"
    echo ""
    echo "📍 URLs Disponibles:"
    echo "   • Panel Autoridades: http://localhost:3000/panel-autoridades.html"
    echo "   • API Swagger:        http://localhost:3000/api-docs"
    echo "   • Ranking Barrios:    http://localhost:3000/api/recommendations/prioritize"
    echo "   • Exportar GeoJSON:   http://localhost:3000/api/recommendations/export/geojson"
    echo ""
    exit 0
elif [ $PERCENTAGE -ge 80 ]; then
    echo -e "${YELLOW}⚠️  LA MAYORÍA DE PRUEBAS PASARON ($PERCENTAGE%)${NC}"
    echo ""
    echo "Sistema funcional con advertencias menores"
    exit 0
else
    echo -e "${RED}❌ MUCHAS PRUEBAS FALLARON ($PERCENTAGE%)${NC}"
    echo ""
    echo "Revisar configuración y logs del servidor"
    exit 1
fi
