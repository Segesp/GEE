#!/bin/bash

# ═══════════════════════════════════════════════════════════════════════════════
# TEST SUITE: Calidad de Aire y Agua - EcoPlan
# ═══════════════════════════════════════════════════════════════════════════════
#
# Autor: EcoPlan Team
# Fecha: 2025-10-05
# Propósito: Validar la implementación completa del módulo de Calidad de Aire y Agua
#
# Uso:
#   bash tests/test-calidad-aire-agua.sh
#
# ═══════════════════════════════════════════════════════════════════════════════

# Colores para output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Contadores
TESTS_PASSED=0
TESTS_FAILED=0
TOTAL_TESTS=0

# Función para imprimir encabezado
print_header() {
    echo ""
    echo -e "${BLUE}═══════════════════════════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════════════════════════════════${NC}"
    echo ""
}

# Función para test individual
test_file() {
    local file=$1
    local description=$2
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    if [ -f "$file" ]; then
        echo -e "${GREEN}✓${NC} Test $TOTAL_TESTS: $description"
        TESTS_PASSED=$((TESTS_PASSED + 1))
        return 0
    else
        echo -e "${RED}✗${NC} Test $TOTAL_TESTS: $description - ARCHIVO NO ENCONTRADO"
        TESTS_FAILED=$((TESTS_FAILED + 1))
        return 1
    fi
}

# Función para test de contenido
test_content() {
    local file=$1
    local pattern=$2
    local description=$3
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    if grep -q "$pattern" "$file" 2>/dev/null; then
        echo -e "${GREEN}✓${NC} Test $TOTAL_TESTS: $description"
        TESTS_PASSED=$((TESTS_PASSED + 1))
        return 0
    else
        echo -e "${RED}✗${NC} Test $TOTAL_TESTS: $description - PATRÓN NO ENCONTRADO"
        TESTS_FAILED=$((TESTS_FAILED + 1))
        return 1
    fi
}

# Función para test de longitud mínima
test_min_length() {
    local file=$1
    local min_lines=$2
    local description=$3
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    if [ -f "$file" ]; then
        local lines=$(wc -l < "$file")
        if [ "$lines" -ge "$min_lines" ]; then
            echo -e "${GREEN}✓${NC} Test $TOTAL_TESTS: $description ($lines líneas)"
            TESTS_PASSED=$((TESTS_PASSED + 1))
            return 0
        else
            echo -e "${RED}✗${NC} Test $TOTAL_TESTS: $description - INSUFICIENTE ($lines < $min_lines líneas)"
            TESTS_FAILED=$((TESTS_FAILED + 1))
            return 1
        fi
    else
        echo -e "${RED}✗${NC} Test $TOTAL_TESTS: $description - ARCHIVO NO ENCONTRADO"
        TESTS_FAILED=$((TESTS_FAILED + 1))
        return 1
    fi
}

# ═══════════════════════════════════════════════════════════════════════════════
# INICIO DE TESTS
# ═══════════════════════════════════════════════════════════════════════════════

print_header "TEST SUITE: Calidad de Aire y Agua"

echo "Fecha: $(date)"
echo "Directorio: $(pwd)"
echo ""

# ═══════════════════════════════════════════════════════════════════════════════
# 1. TESTS DE ARCHIVOS PRINCIPALES
# ═══════════════════════════════════════════════════════════════════════════════

print_header "1. Archivos Principales"

test_file "public/calidad-aire-agua.html" "Interfaz web HTML existe"
test_file "docs/calidad-aire-agua-gee-script.js" "Script GEE JavaScript existe"
test_file "docs/calidad-aire-agua.md" "Documentación Markdown existe"
test_file "COMPLETADO-CALIDAD-AIRE-AGUA.md" "Archivo de resumen existe"
test_file "INICIO-RAPIDO-CALIDAD-AIRE-AGUA.md" "Guía de inicio rápido existe"

# ═══════════════════════════════════════════════════════════════════════════════
# 2. TESTS DE CONTENIDO HTML
# ═══════════════════════════════════════════════════════════════════════════════

print_header "2. Contenido de la Interfaz Web"

HTML_FILE="public/calidad-aire-agua.html"

test_content "$HTML_FILE" "Calidad de Aire y Agua" "Título principal presente"
test_content "$HTML_FILE" "AOD" "Variable AOD presente"
test_content "$HTML_FILE" "NO₂" "Variable NO₂ presente"
test_content "$HTML_FILE" "Clorofila" "Variable Clorofila presente"
test_content "$HTML_FILE" "NDWI" "Variable NDWI presente"
test_content "$HTML_FILE" "MODIS" "Referencia a MODIS presente"
test_content "$HTML_FILE" "Sentinel-5P" "Referencia a Sentinel-5P presente"
test_content "$HTML_FILE" "Copernicus" "Referencia a Copernicus presente"
test_content "$HTML_FILE" "Lima Metropolitana" "Área de estudio mencionada"
test_content "$HTML_FILE" "<nav" "Navegación presente"
test_content "$HTML_FILE" "aria-label" "Etiquetas de accesibilidad presentes"
test_content "$HTML_FILE" "skip-to-content" "Skip to content link presente"
test_content "$HTML_FILE" "leaflet" "Librería Leaflet integrada"
test_content "$HTML_FILE" "id=\"map\"" "Elemento de mapa presente"
test_content "$HTML_FILE" "type=\"date\"" "Control de fecha presente"
test_content "$HTML_FILE" "type=\"checkbox\"" "Checkboxes presentes"
test_content "$HTML_FILE" "role=\"tab\"" "Tabs ARIA presentes"
test_content "$HTML_FILE" "vegetacion-islas-calor" "Link a vegetación presente"
test_content "$HTML_FILE" "transparencia" "Link a transparencia presente"
test_content "$HTML_FILE" "/api-docs" "Link a API docs presente"

# ═══════════════════════════════════════════════════════════════════════════════
# 3. TESTS DE CONTENIDO DEL SCRIPT GEE
# ═══════════════════════════════════════════════════════════════════════════════

print_header "3. Contenido del Script GEE"

GEE_FILE="docs/calidad-aire-agua-gee-script.js"

test_content "$GEE_FILE" "MODIS/061/MCD19A2_GRANULES" "Colección AOD presente"
test_content "$GEE_FILE" "COPERNICUS/S5P/NRTI/L3_NO2" "Colección NO₂ presente"
test_content "$GEE_FILE" "COPERNICUS/MARINE/SATELLITE_OCEAN_COLOR" "Colección Clorofila presente"
test_content "$GEE_FILE" "MODIS/MCD43A4_006_NDWI" "Colección NDWI presente"
test_content "$GEE_FILE" "ee.Geometry.Rectangle" "Geometría de Lima definida"
test_content "$GEE_FILE" "-77.2" "Coordenadas de Lima presentes"
test_content "$GEE_FILE" "filterBounds" "Filtro espacial presente"
test_content "$GEE_FILE" "filterDate" "Filtro temporal presente"
test_content "$GEE_FILE" "multiply(0.001)" "Escalado de AOD presente"
test_content "$GEE_FILE" "multiply(1000000)" "Escalado de NO₂ presente"
test_content "$GEE_FILE" "clip(limaBounds)" "Recorte a Lima presente"
test_content "$GEE_FILE" "Map.addLayer" "Visualización en mapa presente"
test_content "$GEE_FILE" "ui.Chart.image.series" "Series temporales presentes"
test_content "$GEE_FILE" "reduceRegion" "Estadísticas zonales presentes"
test_content "$GEE_FILE" "gt(" "Umbrales de alerta presentes"
test_content "$GEE_FILE" "Export.image" "Exportación de imágenes presente"
test_content "$GEE_FILE" "GIBS" "Integración con GIBS mencionada"
test_content "$GEE_FILE" "WMS" "Servicio WMS mencionado"

# ═══════════════════════════════════════════════════════════════════════════════
# 4. TESTS DE DOCUMENTACIÓN
# ═══════════════════════════════════════════════════════════════════════════════

print_header "4. Contenido de la Documentación"

DOC_FILE="docs/calidad-aire-agua.md"

test_content "$DOC_FILE" "# Monitoreo Diario" "Título principal presente"
test_content "$DOC_FILE" "## Metodología" "Sección de metodología presente"
test_content "$DOC_FILE" "## Variables Monitoreadas" "Sección de variables presente"
test_content "$DOC_FILE" "AOD" "Documentación de AOD presente"
test_content "$DOC_FILE" "NO₂" "Documentación de NO₂ presente"
test_content "$DOC_FILE" "Clorofila" "Documentación de Clorofila presente"
test_content "$DOC_FILE" "NDWI" "Documentación de NDWI presente"
test_content "$DOC_FILE" "Google Earth Engine" "GEE documentado"
test_content "$DOC_FILE" "NASA GIBS" "GIBS documentado"
test_content "$DOC_FILE" "## Casos de Uso" "Casos de uso presentes"
test_content "$DOC_FILE" "## Limitaciones" "Limitaciones documentadas"
test_content "$DOC_FILE" "## Roadmap" "Roadmap presente"
test_content "$DOC_FILE" "## Referencias" "Referencias presentes"
test_content "$DOC_FILE" "https://" "Enlaces externos presentes"

# ═══════════════════════════════════════════════════════════════════════════════
# 5. TESTS DE LONGITUD DE ARCHIVOS
# ═══════════════════════════════════════════════════════════════════════════════

print_header "5. Longitud de Archivos"

test_min_length "public/calidad-aire-agua.html" 900 "HTML tiene longitud mínima"
test_min_length "docs/calidad-aire-agua-gee-script.js" 500 "Script GEE tiene longitud mínima"
test_min_length "docs/calidad-aire-agua.md" 1200 "Documentación tiene longitud mínima"
test_min_length "COMPLETADO-CALIDAD-AIRE-AGUA.md" 400 "Resumen tiene longitud mínima"

# ═══════════════════════════════════════════════════════════════════════════════
# 6. TESTS DE INTEGRACIÓN CON PÁGINAS EXISTENTES
# ═══════════════════════════════════════════════════════════════════════════════

print_header "6. Integración con Páginas Existentes"

test_content "public/transparencia.html" "calidad-aire-agua.html" "Link en transparencia.html"
test_content "public/tutoriales.html" "calidad-aire-agua.html" "Link en tutoriales.html"
test_content "public/panel-autoridades.html" "calidad-aire-agua.html" "Link en panel-autoridades.html"

# ═══════════════════════════════════════════════════════════════════════════════
# 7. TESTS DE ELEMENTOS INTERACTIVOS
# ═══════════════════════════════════════════════════════════════════════════════

print_header "7. Elementos Interactivos"

test_content "$HTML_FILE" "getElementById" "Manipulación DOM presente"
test_content "$HTML_FILE" "addEventListener" "Event listeners presentes"
test_content "$HTML_FILE" "onclick=" "Handlers de eventos presentes"
test_content "$HTML_FILE" "L.map(" "Inicialización de mapa Leaflet"
test_content "$HTML_FILE" "L.tileLayer(" "Capa base de mapa presente"
test_content "$HTML_FILE" "L.rectangle(" "Rectángulo de Lima presente"

# ═══════════════════════════════════════════════════════════════════════════════
# 8. TESTS DE ACCESIBILIDAD
# ═══════════════════════════════════════════════════════════════════════════════

print_header "8. Accesibilidad (WCAG 2.1)"

test_content "$HTML_FILE" "lang=\"es\"" "Atributo lang presente"
test_content "$HTML_FILE" "alt=" "Atributos alt presentes"
test_content "$HTML_FILE" "aria-label=" "ARIA labels presentes"
test_content "$HTML_FILE" "aria-describedby=" "ARIA describedby presente"
test_content "$HTML_FILE" "role=" "Roles ARIA presentes"
test_content "$HTML_FILE" "focus-visible" "Estilos de focus visibles"
test_content "$HTML_FILE" "sr-only" "Clase screen-reader-only presente"

# ═══════════════════════════════════════════════════════════════════════════════
# 9. TESTS DE RESPONSIVE DESIGN
# ═══════════════════════════════════════════════════════════════════════════════

print_header "9. Responsive Design"

test_content "$HTML_FILE" "@media" "Media queries presentes"
test_content "$HTML_FILE" "viewport" "Meta viewport presente"
test_content "$HTML_FILE" "max-width: 1024px" "Breakpoint tablet presente"
test_content "$HTML_FILE" "max-width: 768px" "Breakpoint móvil presente"

# ═══════════════════════════════════════════════════════════════════════════════
# 10. TESTS DE PALETAS DE COLORES
# ═══════════════════════════════════════════════════════════════════════════════

print_header "10. Paletas de Colores Científicas"

test_content "$HTML_FILE" "#006837" "Paleta AOD presente"
test_content "$HTML_FILE" "#000080" "Paleta NO₂ presente"
test_content "$HTML_FILE" "#08306b" "Paleta Clorofila presente"
test_content "$HTML_FILE" "#8c510a" "Paleta NDWI presente"

# ═══════════════════════════════════════════════════════════════════════════════
# RESUMEN FINAL
# ═══════════════════════════════════════════════════════════════════════════════

print_header "RESUMEN DE TESTS"

echo ""
echo -e "${BLUE}Total de tests:${NC}     $TOTAL_TESTS"
echo -e "${GREEN}Tests pasados:${NC}     $TESTS_PASSED"
echo -e "${RED}Tests fallidos:${NC}    $TESTS_FAILED"
echo ""

# Calcular porcentaje
if [ $TOTAL_TESTS -gt 0 ]; then
    PERCENTAGE=$((TESTS_PASSED * 100 / TOTAL_TESTS))
    echo -e "${BLUE}Porcentaje de éxito:${NC} $PERCENTAGE%"
    echo ""
fi

# Resultado final
if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}═══════════════════════════════════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}  ✅ TODOS LOS TESTS PASARON EXITOSAMENTE${NC}"
    echo -e "${GREEN}═══════════════════════════════════════════════════════════════════════════════${NC}"
    echo ""
    exit 0
else
    echo -e "${RED}═══════════════════════════════════════════════════════════════════════════════${NC}"
    echo -e "${RED}  ❌ ALGUNOS TESTS FALLARON${NC}"
    echo -e "${RED}═══════════════════════════════════════════════════════════════════════════════${NC}"
    echo ""
    echo -e "${YELLOW}Por favor revisa los errores arriba y corrige los archivos necesarios.${NC}"
    echo ""
    exit 1
fi
