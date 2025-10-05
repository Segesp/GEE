# MVP Fase 2: Explorar

## Objetivo
Ver reportes y capas clave en un mapa temático con filtros simples por categoría/fecha/barrio; listado con tarjetas mejoradas.

## Características Implementadas

### 1. Mapa con Clustering 🗺️
- **Leaflet.markercluster**: Agrupación inteligente de reportes cercanos
- **Markers personalizados**: Iconos por categoría con colores distintivos
- **Popups informativos**: Descripción, fecha, severidad y foto (si existe)
- **Zoom automático**: Click en tarjeta enfoca el reporte en el mapa

### 2. Filtros Avanzados 🔍

#### Búsqueda en Tiempo Real
- Campo de búsqueda con debounce (300ms)
- Busca en: descripción, barrio, categoría
- Ícono de búsqueda integrado

#### Filtros Múltiples
- **Categoría**: Verde, Calor, Inundación, Basura, Aire, Agua, Otro
- **Severidad**: Baja, Media, Alta
- **Rango de fechas**: Desde / Hasta
- **Botón Reset**: Limpia todos los filtros

### 3. Panel de Indicadores 📊

#### Métricas Clave
1. **Total Reportes**: Contador global
2. **Últimos 7 días**: Con tendencia porcentual
3. **Categoría principal**: Más reportada
4. **Alta Severidad**: Contador de casos urgentes

#### Características
- Diseño tipo card con gradientes
- Íconos descriptivos por métrica
- Indicadores de tendencia (📈/📉/➡️)
- Colores dinámicos según contexto

### 4. Lista con Tarjetas 🎴

#### Diseño de Tarjeta
```
┌─────────────────────────────────┐
│ [🌳 Verde]         [hace 2 días] │
│                                  │
│ Descripción del reporte...       │
│ 📍 -12.04567, -77.03456 · Mirafl│
│                                  │
│ ✅ Baja  [🗺️ Ver] [📸 Ver foto] │
└─────────────────────────────────┘
```

#### Interacciones
- **Hover**: Elevación y cambio de borde
- **Click en tarjeta**: Enfoca en mapa
- **Ver en mapa**: Abre popup del marker
- **Ver foto**: Abre imagen en nueva pestaña

### 5. Integración GEE 📡

#### Capas Satelitales Disponibles
1. **NDVI** (Índice de Vegetación)
   - Opacidad ajustable: 70%
   - Indicador de cobertura verde

2. **LST** (Temperatura Superficial)
   - Opacidad ajustable: 60%
   - Islas de calor urbanas

3. **PM₂.₅** (Calidad del Aire)
   - Opacidad ajustable: 65%
   - Contaminación atmosférica

4. **NDWI** (Índice de Agua)
   - Opacidad ajustable: 70%
   - Cuerpos de agua e inundaciones

#### Controles
- Checkbox para activar/desactivar capa
- Slider de opacidad (0-100%)
- Botón "Actualizar Capas"

### 6. Responsive Design 📱

#### Móvil
- Filtros apilados verticalmente
- Tarjetas de ancho completo
- Indicadores en grid adaptativo

#### Escritorio
- Filtros en línea horizontal
- Tarjetas con layout optimizado
- Sidebar de 360px máximo

## Métricas de Éxito

### Tiempo Medio de Búsqueda
- **Target**: < 10 segundos para encontrar un reporte
- **Cómo medirlo**: 
  - Tiempo desde selección de filtro hasta click en tarjeta
  - Analytics de interacciones con filtros

### Ratio Móvil/Escritorio
- **Target**: 60% móvil / 40% escritorio
- **Cómo medirlo**:
  - User-Agent analysis
  - Viewport width tracking
  - Engagement por dispositivo

### Engagement
- **Filtros usados por sesión**: Target > 2
- **Reportes explorados**: Target > 3
- **Tiempo en explorar**: Target > 2 minutos

## Tecnologías Utilizadas

### Frontend
- **Leaflet.js**: Librería de mapas
- **Leaflet.markercluster**: Plugin de clustering
- **Vanilla JavaScript**: Sin frameworks adicionales
- **CSS Grid/Flexbox**: Layout responsive

### Backend (Endpoints necesarios)
```javascript
// Existente
GET /api/citizen-reports?limit=200

// Futuros (para capas GEE)
GET /api/gee/ndvi-tiles?bounds=...
GET /api/gee/lst-tiles?bounds=...
GET /api/gee/pm25-tiles?bounds=...
GET /api/gee/ndwi-tiles?bounds=...
```

## Próximos Pasos

### Fase 3: Analizar (Dashboards)
- Gráficos de tendencias temporales
- Heatmaps de concentración
- Análisis de correlación con índices GEE
- Exportación de datos

### Mejoras Futuras
1. **Geocodificación inversa**: Mostrar direcciones legibles
2. **Filtro por barrio/distrito**: Dropdown con opciones
3. **Clustering por severidad**: Colores en clusters
4. **Búsqueda geográfica**: "Cerca de mí"
5. **Capas GEE reales**: Integrar tiles del servidor
6. **Caché inteligente**: LocalStorage para reportes
7. **Notificaciones**: Alertas de nuevos reportes en área de interés

## Estructura de Archivos

```
/workspaces/GEE/
├── public/
│   ├── index.html (5609 líneas)
│   │   ├── CSS: Estilos para .explore-* y .report-card
│   │   ├── HTML: Sección de filtros y capas GEE
│   │   └── JS: Funciones initializeExploreSystem(), applyExploreFilters(), etc.
│   └── vendor/
│       └── leaflet-markercluster/
│           ├── leaflet.markercluster.js
│           ├── MarkerCluster.css
│           └── MarkerCluster.Default.css
└── docs/
    └── mvp-fase-explorar.md (este archivo)
```

## Código Clave

### Inicialización del Clustering
```javascript
exploreMarkerCluster = L.markerClusterGroup({
  chunkedLoading: true,
  spiderfyOnMaxZoom: true,
  showCoverageOnHover: false,
  zoomToBoundsOnClick: true,
  maxClusterRadius: 50
});
map.addLayer(exploreMarkerCluster);
```

### Aplicación de Filtros
```javascript
function applyExploreFilters() {
  exploreFilteredReports = citizenReports.filter(report => {
    // Búsqueda textual
    if (exploreFilters.search) {
      const searchLower = exploreFilters.search.toLowerCase();
      const matches = /* ... */;
      if (!matches) return false;
    }
    
    // Filtros de categoría, severidad, fechas
    // ...
    
    return true;
  });
  
  // Re-renderizar todo
  renderExploreIndicators();
  renderExploreReportsList();
  renderExploreMarkers();
}
```

### Creación de Tarjetas
```javascript
function createReportCard(report) {
  const card = document.createElement('div');
  card.className = 'report-card';
  
  card.innerHTML = `
    <div class="report-card-header">...</div>
    <div class="report-card-body">...</div>
    <div class="report-card-footer">...</div>
  `;
  
  card.addEventListener('click', () => focusReportOnMap(report.id));
  return card;
}
```

## Testing

### Casos de Prueba
1. ✅ Búsqueda retorna resultados correctos
2. ✅ Filtros se aplican en combinación
3. ✅ Reset limpia todos los filtros
4. ✅ Indicadores calculan métricas correctas
5. ✅ Tarjetas se renderizan con datos completos
6. ✅ Clustering agrupa markers cercanos
7. ✅ Click en tarjeta enfoca mapa
8. ⏳ Capas GEE se cargan correctamente (pendiente backend)

### Pruebas Manuales
```bash
# 1. Crear reportes de prueba
curl -X POST http://localhost:3000/api/citizen-reports \
  -H "Content-Type: application/json" \
  -d '{"category":"green","description":"Prueba","latitude":-12.05,"longitude":-77.03}'

# 2. Verificar filtros en UI
# - Buscar por "prueba"
# - Filtrar por categoría "Verde"
# - Rango de fechas: hoy

# 3. Verificar indicadores
# - Total debe coincidir con cantidad de reportes
# - Últimos 7 días debe incluir reporte nuevo
```

## Referencias

- [Leaflet.markercluster Documentation](https://github.com/Leaflet/Leaflet.markercluster)
- [Google Earth Engine Tile Servers](https://developers.google.com/earth-engine/guides/image_visualization)
- [MVP Playbook](../docs/ecoplan-project-playbook.md)
