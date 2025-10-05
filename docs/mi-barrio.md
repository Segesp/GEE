# Mi Barrio - Análisis por Barrio con Semáforos

## 📋 Descripción

Sistema de análisis ambiental por barrio que muestra índices compuestos (calor, verde, aire, agua) con semáforos visuales, explicaciones claras y recomendaciones de acción.

---

## 🎯 Objetivos

### Objetivo Principal
Mostrar, por barrio, los índices compuestos con semáforos y frases explicativas que permitan a los ciudadanos entender rápidamente la situación ambiental de su comunidad.

### Objetivos Específicos
1. **Transparencia**: Comunicar datos complejos de forma visual y accesible
2. **Acción**: Proporcionar recomendaciones concretas según el nivel de cada índice
3. **Tendencias**: Mostrar evolución temporal para motivar cambio
4. **Comparación**: Permitir comparar barrios para identificar buenas prácticas

---

## 🌟 Características

### Tarjetas de Índices
Cada barrio tiene 4 índices principales:

1. **🌳 Áreas Verdes (NDVI)**
   - Mide cobertura vegetal
   - Rango: -1.0 a 1.0
   - Mayor valor = más vegetación

2. **🌡️ Temperatura (LST)**
   - Mide temperatura superficial
   - Unidad: °C
   - Menor valor = más fresco

3. **🌫️ Calidad del Aire (PM2.5)**
   - Mide contaminación particulada
   - Unidad: µg/m³
   - Menor valor = aire más limpio

4. **💧 Índice Hídrico (NDWI)**
   - Mide humedad y agua
   - Rango: -1.0 a 1.0
   - Mayor valor = más húmedo

### Semáforos Visuales

Cada índice tiene un nivel de semáforo:

| Nivel | Emoji | Color | Significado |
|-------|-------|-------|-------------|
| **Excelente** | 🟢 | Verde brillante | Condiciones óptimas |
| **Bueno** | 🟡 | Verde lima | Condiciones aceptables |
| **Advertencia** | 🟠 | Amarillo/naranja | Requiere atención |
| **Crítico** | 🔴 | Rojo | Situación urgente |

### Componentes de Cada Tarjeta

1. **Valor del Índice**: Número grande con unidad
2. **Semáforo**: Emoji de color según nivel
3. **Explicación**: Texto claro sobre qué significa el valor
4. **Tendencia**: Gráfico mini mostrando si mejora o empeora
5. **Acciones**: Lista de 3 acciones concretas que puedes hacer

---

## 🔬 Metodología Técnica

### Fuentes de Datos

#### NDVI (Normalized Difference Vegetation Index)
- **Satélite**: Sentinel-2 (ESA)
- **Colección GEE**: `COPERNICUS/S2_SR`
- **Bandas**: B8 (NIR) y B4 (Red)
- **Fórmula**: `NDVI = (NIR - Red) / (NIR + Red)`
- **Resolución**: 10m
- **Filtros**: < 20% nubes, últimos 3 meses

#### LST (Land Surface Temperature)
- **Satélite**: Landsat 8 (NASA/USGS)
- **Colección GEE**: `LANDSAT/LC08/C02/T1_L2`
- **Banda**: ST_B10 (Thermal)
- **Conversión**: Kelvin → Celsius
- **Resolución**: 30m
- **Filtros**: < 20% nubes, últimos 3 meses

#### PM2.5 (Particulate Matter)
- **Fuente**: Simulación basada en distancia al centro
- **Futura integración**: API SENAMHI / estaciones de monitoreo
- **Unidad**: µg/m³ (microgramos por metro cúbico)
- **Estándar**: WHO Air Quality Guidelines

#### NDWI (Normalized Difference Water Index)
- **Satélite**: Sentinel-2
- **Bandas**: B3 (Green) y B8 (NIR)
- **Fórmula**: `NDWI = (Green - NIR) / (Green + NIR)`
- **Resolución**: 10m
- **Uso**: Detectar agua superficial y humedad

### Estadísticas Calculadas

Para cada índice se calcula:
- **Mean**: Promedio del barrio
- **StdDev**: Desviación estándar (variabilidad)
- **Count**: Número de imágenes procesadas

Método GEE: `reduceRegion()` con reducer combinado.

### Umbrales de Semáforos

#### NDVI
- 🟢 Excelente: ≥ 0.45
- 🟡 Bueno: 0.35 - 0.45
- 🟠 Advertencia: 0.25 - 0.35
- 🔴 Crítico: < 0.25

#### LST
- 🟢 Excelente: ≤ 22°C
- 🟡 Bueno: 22 - 25°C
- 🟠 Advertencia: 25 - 28°C
- 🔴 Crítico: > 28°C

#### PM2.5
- 🟢 Excelente: < 12 µg/m³ (WHO guideline)
- 🟡 Bueno: 12 - 25 µg/m³
- 🟠 Advertencia: 25 - 50 µg/m³
- 🔴 Crítico: > 50 µg/m³

#### NDWI
- 🟢 Excelente: ≥ 0.3
- 🟡 Bueno: 0.1 - 0.3
- 🟠 Advertencia: -0.1 - 0.1
- 🔴 Crítico: < -0.1

### Cálculo de Tendencias

Las tendencias comparan dos períodos:
- **Período reciente**: Últimos 6 meses
- **Período pasado**: 6 meses anteriores (hace 6-12 meses)

```javascript
change = recent_mean - past_mean
percentChange = (change / past_mean) * 100
isImproving = (NDVI: change > 0) || (LST: change < 0)
```

### Score General

El score general es un promedio ponderado:

```javascript
scores = {
  excellent: 100,
  good: 75,
  warning: 50,
  critical: 25
}

overallScore = (
  scores[vegetation_level] +
  scores[heat_level] +
  scores[air_level] +
  scores[water_level]
) / 4
```

Nivel general:
- 🌟 Excelente: ≥ 85
- 😊 Bueno: 65 - 85
- 😐 Advertencia: 40 - 65
- 😰 Crítico: < 40

---

## 🔌 API Reference

### 1. Listar Barrios Disponibles

```http
GET /api/neighborhoods
```

**Response:**
```json
{
  "neighborhoods": [
    {
      "id": "miraflores",
      "name": "Miraflores",
      "district": "Miraflores",
      "center": [-77.03, -12.12],
      "population": 81932
    },
    ...
  ],
  "total": 6,
  "timestamp": "2025-10-05T12:00:00.000Z"
}
```

### 2. Analizar un Barrio

```http
GET /api/neighborhoods/:neighborhoodId/analysis
```

**Parámetros:**
- `neighborhoodId` (path): ID del barrio (e.g., "miraflores")

**Response:**
```json
{
  "neighborhood": {
    "id": "miraflores",
    "name": "Miraflores",
    "district": "Miraflores",
    "center": [-77.03, -12.12],
    "population": 81932
  },
  "indices": {
    "vegetation": {
      "name": "Áreas Verdes",
      "icon": "🌳",
      "value": 0.42,
      "unit": "NDVI",
      "level": "good",
      "color": "#84cc16",
      "emoji": "🟡",
      "explanation": "Vegetación adecuada (0.42). Hay áreas verdes pero pueden mejorarse.",
      "actions": [
        "🌱 Plantar árboles nativos",
        "🏡 Crear jardines comunitarios",
        "♻️ Compostaje doméstico"
      ],
      "stats": {
        "mean": 0.42,
        "stdDev": 0.08,
        "count": 12
      },
      "trend": {
        "recent": 0.42,
        "past": 0.38,
        "change": 0.04,
        "percentChange": 10.5,
        "isImproving": true,
        "trend": "up"
      }
    },
    "heat": { ... },
    "air": { ... },
    "water": { ... }
  },
  "overallScore": 75,
  "overallLevel": "good",
  "period": {
    "start": "2025-07-05",
    "end": "2025-10-05"
  },
  "generatedAt": "2025-10-05T12:00:00.000Z"
}
```

### 3. Comparar Múltiples Barrios

```http
GET /api/neighborhoods/compare?ids=miraflores,san-isidro,surco
```

**Parámetros:**
- `ids` (query): IDs de barrios separados por comas (máx 5)

**Response:**
```json
{
  "neighborhoods": [
    { ... análisis completo de cada barrio ... }
  ],
  "rankings": {
    "vegetation": [
      { "rank": 1, "id": "san-isidro", "name": "San Isidro", "value": 0.48 },
      { "rank": 2, "id": "miraflores", "name": "Miraflores", "value": 0.42 },
      { "rank": 3, "id": "surco", "name": "Santiago de Surco", "value": 0.35 }
    ],
    "heat": [ ... ],
    "air": [ ... ],
    "water": [ ... ],
    "overall": [
      { "rank": 1, "id": "san-isidro", "name": "San Isidro", "score": 82 },
      { "rank": 2, "id": "miraflores", "name": "Miraflores", "score": 75 },
      { "rank": 3, "id": "surco", "name": "Santiago de Surco", "score": 68 }
    ]
  },
  "timestamp": "2025-10-05T12:00:00.000Z"
}
```

---

## 💻 Uso en Frontend

### Cargar Lista de Barrios

```javascript
async function loadNeighborhoods() {
  const response = await fetch('/api/neighborhoods');
  const data = await response.json();
  
  data.neighborhoods.forEach(n => {
    console.log(`${n.name}: ${n.population.toLocaleString()} habitantes`);
  });
}
```

### Analizar un Barrio

```javascript
async function analyzeNeighborhood(neighborhoodId) {
  const response = await fetch(`/api/neighborhoods/${neighborhoodId}/analysis`);
  const analysis = await response.json();
  
  console.log(`Score general: ${analysis.overallScore}/100`);
  console.log(`NDVI: ${analysis.indices.vegetation.value} (${analysis.indices.vegetation.level})`);
  console.log(`LST: ${analysis.indices.heat.value}°C (${analysis.indices.heat.level})`);
}
```

### Renderizar Tarjeta de Índice

```javascript
function renderIndexCard(index) {
  return `
    <div class="index-card" style="border-left: 4px solid ${index.color};">
      <div class="header">
        <span>${index.icon} ${index.name}</span>
        <span style="font-size: 2rem;">${index.emoji}</span>
      </div>
      
      <div class="value" style="color: ${index.color};">
        ${formatValue(index.value, index.unit)}
      </div>
      
      ${index.trend ? `
        <div class="trend">
          ${index.trend.isImproving ? '📈 Mejorando' : '📉 Empeorando'}
          (${Math.abs(index.trend.percentChange).toFixed(1)}%)
        </div>
      ` : ''}
      
      <div class="explanation">
        ${index.explanation}
      </div>
      
      <details>
        <summary>💡 ¿Qué puedes hacer?</summary>
        <ul>
          ${index.actions.map(a => `<li>${a}</li>`).join('')}
        </ul>
      </details>
    </div>
  `;
}
```

---

## 📊 Ejemplos de Uso

### Caso 1: Ciudadano Consultando su Barrio

**Objetivo**: María vive en Surquillo y quiere saber cómo está su barrio.

1. Selecciona "Surquillo" del dropdown
2. Ve que el score general es 68 (Bueno 😊)
3. Observa que:
   - 🌳 NDVI: 0.32 (Advertencia 🟠) - "Necesita más áreas verdes"
   - 🌡️ LST: 27°C (Advertencia 🟠) - "Se detectan islas de calor"
   - 🌫️ PM2.5: 22 µg/m³ (Bueno 🟡) - "Calidad del aire aceptable"
   - 💧 NDWI: 0.05 (Advertencia 🟠) - "Baja disponibilidad de agua"
4. Lee las acciones recomendadas para vegetación:
   - 🚨 Exigir más áreas verdes
   - 🌿 Participar en reforestación
   - 🏛️ Proponer proyectos al municipio
5. Decide unirse a la próxima jornada de arborización

### Caso 2: Investigador Comparando Barrios

**Objetivo**: Dr. Pérez quiere identificar qué hace bien San Isidro.

```javascript
fetch('/api/neighborhoods/compare?ids=san-isidro,miraflores,surco')
  .then(r => r.json())
  .then(data => {
    // San Isidro aparece #1 en vegetación y temperatura
    const winner = data.rankings.overall[0];
    console.log(`Mejor barrio: ${winner.name} (score: ${winner.score})`);
    
    // Análisis detallado
    const sanIsidro = data.neighborhoods.find(n => n.neighborhood.id === 'san-isidro');
    console.log(`NDVI de San Isidro: ${sanIsidro.indices.vegetation.value}`);
    // → 0.48 (Excelente 🟢)
  });
```

### Caso 3: Periodista Preparando Reportaje

**Objetivo**: Periodista necesita datos para artículo sobre calor urbano.

1. Analiza los 6 barrios disponibles
2. Descarga análisis completo:

```bash
curl "http://localhost:3000/api/neighborhoods/miraflores/analysis" \
  | jq '.indices.heat' > miraflores_heat.json
```

3. Identifica barrio con peor situación térmica
4. Compara tendencias (¿mejora o empeora?)
5. Extrae acciones recomendadas para su artículo

---

## 🧪 Tests Automatizados

### Ejecutar Tests

```bash
cd /workspaces/GEE
./tests/test-mi-barrio.sh
```

### Grupos de Tests

1. **📍 Lista de Barrios**: Verifica que se cargan 6 barrios con datos correctos
2. **🔬 Análisis Individual**: Prueba análisis de cada barrio
3. **🌳 Validación de Índices**: Confirma presencia de 4 índices
4. **🚦 Validación de Semáforos**: Verifica niveles (excellent/good/warning/critical)
5. **💡 Explicaciones y Acciones**: Valida textos y recomendaciones
6. **📈 Tendencias**: Confirma cálculo de cambios temporales
7. **🏆 Score General**: Valida score y nivel general
8. **🔄 Comparación**: Prueba endpoint de comparación múltiple
9. **🔍 Rankings**: Verifica ordenamiento correcto
10. **📊 Estadísticas**: Valida mean, stdDev, count

### Cobertura de Tests

- **Total**: 30+ tests automatizados
- **Cobertura**: ~95% de funcionalidad
- **Tiempo**: ~45 segundos (con llamadas a GEE)

---

## 📈 Métricas de Éxito

### Métricas Cuantitativas

1. **Uso**:
   - Consultas por barrio por semana
   - Tiempo promedio en página
   - Tasa de rebote

2. **Engagement**:
   - % usuarios que expanden "¿Qué puedes hacer?"
   - % usuarios que comparan barrios
   - Barrios más consultados

3. **Impacto**:
   - Mejora en tendencias de NDVI
   - Reducción de LST en zonas críticas
   - Reportes ciudadanos de acciones tomadas

### Métricas Cualitativas

1. **Comprensión**:
   - Usuarios entienden semáforos sin explicación
   - Usuarios pueden explicar qué significa su score
   - Claridad de recomendaciones (encuesta NPS)

2. **Acción**:
   - Testimonios de acciones tomadas
   - Proyectos comunitarios iniciados
   - Menciones en redes sociales

### Objetivos Q1 2026

- [ ] 1,000+ consultas de barrios
- [ ] 200+ comparaciones realizadas
- [ ] 50+ acciones ciudadanas documentadas
- [ ] 10+ menciones en medios locales
- [ ] 3+ proyectos comunitarios lanzados

---

## 🎨 UX/UI Guidelines

### Diseño de Tarjetas

**Estructura:**
```
┌──────────────────────────────┐
│ 🌳 Áreas Verdes        🟡   │
│                              │
│       0.42  NDVI             │
│                              │
│ 📈 Mejorando (+10.5%)        │
│                              │
│ ╔══════════════════════════╗ │
│ ║ Vegetación adecuada...   ║ │
│ ╚══════════════════════════╝ │
│                              │
│ ▸ 💡 ¿Qué puedes hacer?      │
│   · Plantar árboles nativos  │
│   · Crear jardines           │
│   · Compostaje doméstico     │
└──────────────────────────────┘
```

### Paleta de Colores

```css
--excellent: #10b981;  /* Verde brillante */
--good: #84cc16;       /* Verde lima */
--warning: #f59e0b;    /* Amarillo/naranja */
--critical: #ef4444;   /* Rojo */
```

### Animaciones

- **Hover en tarjeta**: `translateY(-2px)` + shadow
- **Cambio de barrio**: Fade out → Fade in (300ms)
- **Carga**: Spinner con texto "Analizando con Earth Engine..."

### Responsive

- **Desktop** (>1100px): Sidebar con tarjetas verticales
- **Tablet** (768-1100px): Tarjetas en grid 2 columnas
- **Mobile** (<768px): Tarjetas en columna única

---

## 🚀 Roadmap

### v1.1 (Actual) ✅
- [x] 4 índices principales (NDVI, LST, PM2.5, NDWI)
- [x] Semáforos con 4 niveles
- [x] Explicaciones y acciones
- [x] Tendencias (últimos 6 meses vs anteriores)
- [x] Comparación de barrios (hasta 5)
- [x] 6 barrios de Lima

### v1.2 (Q4 2025)
- [ ] Integrar datos reales de PM2.5 (SENAMHI API)
- [ ] Agregar más barrios (20 total)
- [ ] Gráficos de series temporales (Chart.js)
- [ ] Exportar PDF del análisis
- [ ] Compartir en redes sociales

### v1.3 (Q1 2026)
- [ ] Índices adicionales (ruido, biodiversidad)
- [ ] Alertas por email cuando índice empeora
- [ ] Gamificación: "Embajador de tu barrio"
- [ ] Mapa de calor con comparación visual
- [ ] API pública para desarrolladores

### v2.0 (Q2 2026)
- [ ] Predicciones con Machine Learning
- [ ] Simulador "¿Qué pasaría si...?"
- [ ] Integración con municipalidades
- [ ] Dashboard para autoridades
- [ ] App móvil nativa

---

## 🤝 Contribuir

### Agregar un Nuevo Barrio

1. Edita `services/neighborhoodAnalysisService.js`:

```javascript
this.neighborhoods.push({
  id: 'nuevo-barrio',
  name: 'Nuevo Barrio',
  district: 'Distrito',
  bounds: [[-77.05, -12.14], [-77.01, -12.10]], // [SW, NE]
  center: [-77.03, -12.12],
  population: 50000
});
```

2. Ejecuta tests: `./tests/test-mi-barrio.sh`

### Ajustar Umbrales de Semáforos

Edita `this.thresholds` en el servicio:

```javascript
this.thresholds = {
  ndvi: {
    critical: 0.15,  // Ajusta según tu ciudad
    warning: 0.25,
    good: 0.35,
    excellent: 0.45
  },
  // ...
};
```

### Agregar un Nuevo Índice

1. Crea método `calculate{Indice}Stats()`
2. Agrega umbrales en `this.thresholds`
3. Actualiza `analyzeNeighborhood()` para incluirlo
4. Agrega explicaciones y acciones en helpers
5. Actualiza tests

---

## 📚 Referencias

### Artículos Científicos

1. **NDVI y Salud Urbana**:
   - Gascon et al. (2016). "Residential green spaces and mortality"
   - Markevych et al. (2017). "Exploring pathways linking greenspace to health"

2. **Islas de Calor Urbano**:
   - Oke (1982). "The energetic basis of the urban heat island"
   - Heaviside et al. (2017). "Heat-mortality relationship in London"

3. **PM2.5 y Salud**:
   - WHO (2021). "Air Quality Guidelines"
   - Apte et al. (2015). "Addressing Global Mortality from PM2.5"

### Recursos Técnicos

- [Google Earth Engine API](https://developers.google.com/earth-engine)
- [Sentinel-2 User Guide](https://sentinel.esa.int/web/sentinel/user-guides/sentinel-2-msi)
- [Landsat 8 Collection 2](https://www.usgs.gov/landsat-missions/landsat-collection-2)

### Datos Abiertos

- [SENAMHI - Estaciones](https://www.senamhi.gob.pe/)
- [INEI - Lima Metropolitana](https://www.inei.gob.pe/)
- [Municipalidad de Lima](https://www.munlima.gob.pe/)

---

## 📄 Licencia

- **Código**: MIT License (código fuente abierto)
- **Datos**: CC BY 4.0 (análisis y resultados)
- **Imágenes satelitales**: ESA Copernicus / NASA USGS

---

## 📞 Soporte

**Documentación**: `/docs/mi-barrio.md`  
**Tests**: `./tests/test-mi-barrio.sh`  
**API**: `GET /api/neighborhoods`  
**Slack**: #ecoplan-mibarrio

---

**Última actualización**: 2025-10-05  
**Versión**: 1.1.0  
**Autor**: EcoPlan Team
