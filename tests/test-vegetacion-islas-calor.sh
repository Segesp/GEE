#!/bin/bash
# Test script para verificar la implementación de Vegetación e Islas de Calor

echo "═══════════════════════════════════════════════════════════════════"
echo "🌳 Test: Vegetación e Islas de Calor - EcoPlan"
echo "═══════════════════════════════════════════════════════════════════"
echo ""

# Colores
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Contador de tests
PASSED=0
FAILED=0

# Función para tests
test_file() {
    local file=$1
    local description=$2
    
    if [ -f "$file" ]; then
        echo -e "${GREEN}✓${NC} $description"
        ((PASSED++))
        return 0
    else
        echo -e "${RED}✗${NC} $description (no encontrado)"
        ((FAILED++))
        return 1
    fi
}

test_content() {
    local file=$1
    local pattern=$2
    local description=$3
    
    if grep -q "$pattern" "$file" 2>/dev/null; then
        echo -e "${GREEN}✓${NC} $description"
        ((PASSED++))
        return 0
    else
        echo -e "${RED}✗${NC} $description (contenido no encontrado)"
        ((FAILED++))
        return 1
    fi
}

echo "📁 Verificando archivos principales..."
echo ""

test_file "/workspaces/GEE/public/vegetacion-islas-calor.html" "HTML principal existe"
test_file "/workspaces/GEE/docs/vegetacion-islas-calor-gee-script.js" "Script GEE existe"
test_file "/workspaces/GEE/docs/vegetacion-islas-calor.md" "Documentación existe"

echo ""
echo "🔍 Verificando contenido HTML..."
echo ""

test_content "/workspaces/GEE/public/vegetacion-islas-calor.html" "Vegetación e Islas de Calor" "Título correcto"
test_content "/workspaces/GEE/public/vegetacion-islas-calor.html" "Google Earth Engine" "Referencia a GEE"
test_content "/workspaces/GEE/public/vegetacion-islas-calor.html" "NDVI" "Contiene NDVI"
test_content "/workspaces/GEE/public/vegetacion-islas-calor.html" "LST" "Contiene LST (temperatura)"
test_content "/workspaces/GEE/public/vegetacion-islas-calor.html" "SMOD" "Contiene SMOD (urbanización)"
test_content "/workspaces/GEE/public/vegetacion-islas-calor.html" "class=\"control-panel" "Panel de controles"
test_content "/workspaces/GEE/public/vegetacion-islas-calor.html" "class=\"maps-panel" "Panel de mapas"
test_content "/workspaces/GEE/public/vegetacion-islas-calor.html" "class=\"charts-panel" "Panel de gráficos"
test_content "/workspaces/GEE/public/vegetacion-islas-calor.html" "heatEventsTable" "Tabla de eventos"
test_content "/workspaces/GEE/public/vegetacion-islas-calor.html" "priorityTable" "Tabla de prioridades"

echo ""
echo "🔍 Verificando script GEE..."
echo ""

test_content "/workspaces/GEE/docs/vegetacion-islas-calor-gee-script.js" "COPERNICUS/S2_SR_HARMONIZED" "Dataset Sentinel-2"
test_content "/workspaces/GEE/docs/vegetacion-islas-calor-gee-script.js" "LANDSAT/LC08/C02/T1_L2" "Dataset Landsat 8"
test_content "/workspaces/GEE/docs/vegetacion-islas-calor-gee-script.js" "MODIS/061/MOD11A2" "Dataset MODIS LST"
test_content "/workspaces/GEE/docs/vegetacion-islas-calor-gee-script.js" "JRC/GHSL" "Dataset GHSL"
test_content "/workspaces/GEE/docs/vegetacion-islas-calor-gee-script.js" "function maskS2sr" "Función máscara S2"
test_content "/workspaces/GEE/docs/vegetacion-islas-calor-gee-script.js" "function ndviS2" "Función NDVI S2"
test_content "/workspaces/GEE/docs/vegetacion-islas-calor-gee-script.js" "function lstToC" "Función LST"
test_content "/workspaces/GEE/docs/vegetacion-islas-calor-gee-script.js" "function monthlyComposite" "Función compuesto mensual"
test_content "/workspaces/GEE/docs/vegetacion-islas-calor-gee-script.js" "function buildHeatIslandsTable" "Función tabla islas calor"
test_content "/workspaces/GEE/docs/vegetacion-islas-calor-gee-script.js" "function buildPriorityTable" "Función tabla prioridades"

echo ""
echo "🔍 Verificando documentación..."
echo ""

test_content "/workspaces/GEE/docs/vegetacion-islas-calor.md" "# 🌳 Vegetación e Islas de Calor" "Título markdown"
test_content "/workspaces/GEE/docs/vegetacion-islas-calor.md" "Metodología" "Sección metodología"
test_content "/workspaces/GEE/docs/vegetacion-islas-calor.md" "Guía de Implementación" "Guía de implementación"
test_content "/workspaces/GEE/docs/vegetacion-islas-calor.md" "Datasets" "Descripción datasets"
test_content "/workspaces/GEE/docs/vegetacion-islas-calor.md" "Casos de Uso" "Casos de uso"
test_content "/workspaces/GEE/docs/vegetacion-islas-calor.md" "Limitaciones" "Limitaciones"
test_content "/workspaces/GEE/docs/vegetacion-islas-calor.md" "Extensiones Futuras" "Extensiones futuras"

echo ""
echo "🔗 Verificando enlaces de navegación..."
echo ""

test_content "/workspaces/GEE/public/vegetacion-islas-calor.html" "href=\"/\"" "Enlace a inicio"
test_content "/workspaces/GEE/public/vegetacion-islas-calor.html" "href=\"panel-autoridades.html\"" "Enlace a panel autoridades"
test_content "/workspaces/GEE/public/vegetacion-islas-calor.html" "href=\"transparencia.html\"" "Enlace a transparencia"
test_content "/workspaces/GEE/public/vegetacion-islas-calor.html" "href=\"tutoriales.html\"" "Enlace a tutoriales"
test_content "/workspaces/GEE/public/vegetacion-islas-calor.html" "href=\"/api-docs\"" "Enlace a API docs"

# Verificar enlaces en otras páginas
test_content "/workspaces/GEE/public/transparencia.html" "vegetacion-islas-calor.html" "Enlace desde transparencia"
test_content "/workspaces/GEE/public/tutoriales.html" "vegetacion-islas-calor.html" "Enlace desde tutoriales"
test_content "/workspaces/GEE/public/panel-autoridades.html" "vegetacion-islas-calor.html" "Enlace desde panel autoridades"

echo ""
echo "📊 Verificando elementos interactivos..."
echo ""

test_content "/workspaces/GEE/public/vegetacion-islas-calor.html" "id=\"monthSlider\"" "Slider de mes"
test_content "/workspaces/GEE/public/vegetacion-islas-calor.html" "id=\"heatThreshold\"" "Slider de umbral"
test_content "/workspaces/GEE/public/vegetacion-islas-calor.html" "id=\"cloudMask\"" "Checkbox máscara nubes"
test_content "/workspaces/GEE/public/vegetacion-islas-calor.html" "id=\"lstSelect\"" "Selector LST día/noche"
test_content "/workspaces/GEE/public/vegetacion-islas-calor.html" "id=\"smodUrban\"" "Filtro SMOD urbano"
test_content "/workspaces/GEE/public/vegetacion-islas-calor.html" "id=\"startDate\"" "Input fecha inicio"
test_content "/workspaces/GEE/public/vegetacion-islas-calor.html" "id=\"endDate\"" "Input fecha fin"

echo ""
echo "🎨 Verificando estilos y accesibilidad..."
echo ""

test_content "/workspaces/GEE/public/vegetacion-islas-calor.html" "skip-to-content" "Skip to content link"
test_content "/workspaces/GEE/public/vegetacion-islas-calor.html" "role=\"banner\"" "ARIA role banner"
test_content "/workspaces/GEE/public/vegetacion-islas-calor.html" "role=\"navigation\"" "ARIA role navigation"
test_content "/workspaces/GEE/public/vegetacion-islas-calor.html" "aria-label" "ARIA labels"
test_content "/workspaces/GEE/public/vegetacion-islas-calor.html" "prefers-reduced-motion" "Media query reducción movimiento"
test_content "/workspaces/GEE/public/vegetacion-islas-calor.html" ":focus-visible" "Estilos focus visible"

echo ""
echo "═══════════════════════════════════════════════════════════════════"
echo "📊 RESUMEN DE TESTS"
echo "═══════════════════════════════════════════════════════════════════"
echo ""
echo -e "Tests pasados: ${GREEN}${PASSED}${NC}"
echo -e "Tests fallidos: ${RED}${FAILED}${NC}"
echo -e "Total: $((PASSED + FAILED))"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✅ TODOS LOS TESTS PASARON${NC}"
    echo ""
    echo "🎉 La implementación de Vegetación e Islas de Calor está completa!"
    echo ""
    echo "📋 Próximos pasos:"
    echo "   1. Abrir http://localhost:3000/vegetacion-islas-calor.html"
    echo "   2. Verificar que la interfaz se carga correctamente"
    echo "   3. Copiar el código GEE desde docs/vegetacion-islas-calor-gee-script.js"
    echo "   4. Pegar en https://code.earthengine.google.com/"
    echo "   5. Ejecutar el script en GEE Code Editor"
    echo ""
    exit 0
else
    echo -e "${YELLOW}⚠️  ALGUNOS TESTS FALLARON${NC}"
    echo ""
    echo "Por favor revisa los errores arriba."
    echo ""
    exit 1
fi
