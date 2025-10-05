# 🎯 Guía de Uso - EcoPlan con Google Earth Engine

## 📖 Introducción

Esta guía te mostrará cómo utilizar todas las funcionalidades de EcoPlan con datos satelitales reales de Google Earth Engine.

---

## 🚀 Inicio Rápido

### 1. Verificar que el Servidor Está Funcionando

```bash
# En la terminal
curl http://localhost:3000/api/health

# Respuesta esperada:
# {
#   "status": "ok",
#   "earthEngineInitialized": true,
#   "timestamp": "2025-10-05T..."
# }
```

### 2. Abrir el Hub Principal

Abre tu navegador en: **http://localhost:3000**

Verás 9 tarjetas con las herramientas disponibles:
- 📝 Reportes Ciudadanos
- 🌊 Calidad de Aire y Agua
- 🌳 Vegetación e Islas de Calor
- 🏛️ Panel para Autoridades
- 🏘️ Mi Barrio
- 📚 Tutoriales
- 🔒 Transparencia
- 📖 Documentación API
- 🛰️ Google Earth Engine

---

## 🌊 Herramienta: Calidad de Aire y Agua

### Acceso
http://localhost:3000/calidad-aire-agua.html

### Funcionalidades

#### ✅ Variables Disponibles
- **AOD** (Aerosol Optical Depth) - Calidad del aire
- **NO₂** (Dióxido de Nitrógeno) - Contaminación vehicular
- **Clorofila-a** - Calidad del agua costera
- **NDWI** (Normalized Difference Water Index) - Humedad

#### 📅 Cómo Usar

1. **Selecciona una fecha histórica** (recomendado: últimos 2 meses)
   ```
   Ejemplo: 2024-08-15
   ```

2. **Marca las variables que deseas analizar**
   - ☑️ AOD
   - ☑️ NO₂
   - ☑️ Clorofila
   - ☑️ NDWI

3. **Haz clic en "🔄 Cargar Datos"**

4. **Espera 5-30 segundos** - Verás un overlay de carga con mensaje:
   ```
   Procesando datos satelitales...
   Esto puede tomar entre 5-30 segundos
   ```

5. **Explora los resultados**
   - Los mapas se actualizarán con capas de GEE
   - Las estadísticas (media, min, max) se mostrarán
   - Usa las tabs para cambiar entre variables

#### 🔍 Ejemplo de Respuesta de API

```bash
curl "http://localhost:3000/api/air-water-quality/all?date=2024-08-15" | jq '.'
```

```json
{
  "date": "2024-08-15",
  "region": "Lima Metropolitana",
  "variables": [
    {
      "variable": "AOD",
      "date": "2024-08-15",
      "unit": "unitless",
      "source": "MODIS/061/MCD19A2_GRANULES",
      "resolution": "1 km",
      "statistics": {
        "mean": 0.234,
        "min": 0.089,
        "max": 0.567,
        "stdDev": 0.112
      },
      "mapId": "projects/github-nasa/maps/...",
      "token": "",
      "interpretation": "Calidad de aire: Moderada"
    },
    // ... más variables
  ]
}
```

#### 🎨 Interpretación de Colores

**AOD (Aerosoles):**
- 🟢 Verde (0.0 - 0.1): Excelente
- 🟡 Amarillo (0.1 - 0.2): Bueno
- 🟠 Naranja (0.2 - 0.3): Moderado
- 🔴 Rojo (0.3 - 0.5): Malo
- 🔴🔴 Rojo oscuro (> 0.5): Muy malo

**NO₂ (Dióxido de Nitrógeno):**
- 🔵 Azul (< 50 μmol/m²): Bajo
- 🟡 Amarillo (50 - 100): Moderado
- 🟠 Naranja (100 - 150): Alto
- 🔴 Rojo (150 - 200): Muy alto
- 🔴🔴 Rojo oscuro (> 200): Extremo

---

## 🌳 Herramienta: Vegetación e Islas de Calor

### Acceso
http://localhost:3000/vegetacion-islas-calor.html

### Funcionalidades

#### ✅ Análisis Disponibles
- **NDVI** (Normalized Difference Vegetation Index) - Cobertura vegetal
- **LST** (Land Surface Temperature) - Temperatura superficial
- **Anomalías LST** - Desviaciones respecto a climatología 2018-2022
- **Detección de Islas de Calor** - Eventos extremos de temperatura
- **Índice de Prioridad** - Rankings de distritos para intervenciones

#### 📅 Cómo Usar

1. **Configura el rango de fechas**
   ```
   Fecha inicio: 2024-01-01
   Fecha fin:    2024-03-31
   ```

2. **Ajusta controles opcionales**
   - Umbral de detección de islas de calor: **2.0°C** (default)
   - LST día/noche: **Día (~10:30 LT)** (default)
   - Máscara de nubes: **Activada** ✅

3. **Haz clic en "🔄 Cargar Análisis"**

4. **Espera mientras GEE procesa** (15-30 segundos para análisis completo)

5. **Explora los resultados**
   - **Mapa NDVI**: Muestra vegetación (verde = alta, café = baja)
   - **Mapa LST Anomalía**: Muestra islas de calor (rojo = caliente, azul = fresco)
   - **Tabla de Eventos**: Lista de islas de calor detectadas
   - **Tabla de Prioridades**: Distritos ordenados por urgencia de intervención

#### 🔍 Ejemplo de Respuesta de API

```bash
curl "http://localhost:3000/api/vegetation-heat/analysis?startDate=2024-01-01&endDate=2024-03-31" | jq '.'
```

```json
{
  "startDate": "2024-01-01",
  "endDate": "2024-03-31",
  "region": "Lima Metropolitana",
  "ndvi": {
    "variable": "NDVI",
    "statistics": {
      "mean": 0.0266,
      "min": -0.9950,
      "max": 0.8360,
      "stdDev": 0.1285
    },
    "mapId": "projects/github-nasa/maps/...",
    "interpretation": "Vegetación: Baja cobertura (urbano)"
  },
  "lst": {
    "variable": "LST",
    "statistics": {
      "mean": 28.5,
      "min": 15.2,
      "max": 42.8,
      "stdDev": 4.7
    },
    "mapId": "projects/github-nasa/maps/...",
    "unit": "°C"
  },
  "heatIslands": {
    "threshold": 2.0,
    "events": [
      {
        "date": "2024-01-15",
        "timeOfDay": "day",
        "anomaly": 3.2,
        "area_km2": 15.7
      },
      // ... más eventos
    ]
  }
}
```

#### 🎨 Interpretación de Colores

**NDVI (Vegetación):**
- ⚫ Gris (0.0 - 0.2): Suelo desnudo/urbano
- 🟡 Amarillo (0.2 - 0.4): Vegetación dispersa
- 🟢 Verde claro (0.4 - 0.6): Vegetación moderada
- 🟢🟢 Verde oscuro (0.6 - 0.8): Vegetación densa

**LST Anomalía:**
- 🔵 Azul (-2.5 a 0°C): Más fresco que lo normal
- ⚪ Blanco (0 a 0.5°C): Normal
- 🟡 Amarillo (0.5 a 2.0°C): Ligeramente cálido
- 🟠 Naranja (2.0 a 3.0°C): Isla de calor moderada
- 🔴 Rojo (> 3.0°C): Isla de calor severa

---

## 🔌 API REST - Endpoints Completos

### Calidad de Aire y Agua

#### 1. Todas las Variables
```bash
GET /api/air-water-quality/all?date=2024-08-15

curl "http://localhost:3000/api/air-water-quality/all?date=2024-08-15"
```

#### 2. AOD Individual
```bash
GET /api/air-water-quality/aod?date=2024-08-15

curl "http://localhost:3000/api/air-water-quality/aod?date=2024-08-15"
```

#### 3. NO₂ Individual
```bash
GET /api/air-water-quality/no2?date=2024-08-15

curl "http://localhost:3000/api/air-water-quality/no2?date=2024-08-15"
```

#### 4. Clorofila Individual
```bash
GET /api/air-water-quality/chlorophyll?date=2024-08-15

curl "http://localhost:3000/api/air-water-quality/chlorophyll?date=2024-08-15"
```

#### 5. NDWI Individual
```bash
GET /api/air-water-quality/ndwi?date=2024-08-15

curl "http://localhost:3000/api/air-water-quality/ndwi?date=2024-08-15"
```

#### 6. Series Temporales
```bash
GET /api/air-water-quality/timeseries?variable=aod&startDate=2024-01-01&endDate=2024-03-31&district=lima-centro

curl "http://localhost:3000/api/air-water-quality/timeseries?variable=aod&startDate=2024-01-01&endDate=2024-03-31"
```

### Vegetación e Islas de Calor

#### 1. NDVI
```bash
GET /api/vegetation-heat/ndvi?startDate=2024-01-01&endDate=2024-03-31

curl "http://localhost:3000/api/vegetation-heat/ndvi?startDate=2024-01-01&endDate=2024-03-31"
```

#### 2. LST (Temperatura Superficial)
```bash
GET /api/vegetation-heat/lst?startDate=2024-01-01&endDate=2024-03-31&timeOfDay=day

curl "http://localhost:3000/api/vegetation-heat/lst?startDate=2024-01-01&endDate=2024-03-31&timeOfDay=day"
```

#### 3. Anomalía LST
```bash
GET /api/vegetation-heat/lst-anomaly?targetDate=2024-08-15&timeOfDay=day

curl "http://localhost:3000/api/vegetation-heat/lst-anomaly?targetDate=2024-08-15&timeOfDay=day"
```

#### 4. Detección de Islas de Calor
```bash
GET /api/vegetation-heat/heat-islands?startDate=2024-01-01&endDate=2024-03-31&threshold=2.0

curl "http://localhost:3000/api/vegetation-heat/heat-islands?startDate=2024-01-01&endDate=2024-03-31&threshold=2.0"
```

#### 5. Análisis Completo
```bash
GET /api/vegetation-heat/analysis?startDate=2024-01-01&endDate=2024-03-31

curl "http://localhost:3000/api/vegetation-heat/analysis?startDate=2024-01-01&endDate=2024-03-31"
```

#### 6. Índice de Prioridad
```bash
GET /api/vegetation-heat/priority?date=2024-08-15

curl "http://localhost:3000/api/vegetation-heat/priority?date=2024-08-15"
```

---

## 🗺️ Integración con Leaflet

### Agregar Capa GEE a un Mapa Leaflet

```javascript
// Obtener datos de la API
const response = await fetch('/api/air-water-quality/aod?date=2024-08-15');
const data = await response.json();

// Extraer mapId y token
const { mapId, token } = data;

// Construir URL de tiles
const tileUrl = `https://earthengine.googleapis.com/v1alpha/projects/github-nasa/maps/${mapId}/tiles/{z}/{x}/{y}`;

// Agregar capa al mapa
const geeLayer = L.tileLayer(tileUrl, {
    attribution: 'Google Earth Engine',
    maxZoom: 20,
    opacity: 0.7
});

geeLayer.addTo(map);
```

### Cambiar entre Capas

```javascript
// Array para almacenar capas
const layers = {
    aod: null,
    no2: null,
    chl: null,
    ndwi: null
};

// Función para cambiar capa visible
function showLayer(variableName) {
    Object.keys(layers).forEach(key => {
        if (layers[key]) {
            if (key === variableName) {
                layers[key].setOpacity(0.7); // Mostrar
            } else {
                layers[key].setOpacity(0);   // Ocultar
            }
        }
    });
}

// Uso
showLayer('aod'); // Muestra solo AOD
```

---

## 📊 Ejemplos de Uso Práctico

### Caso 1: Monitoreo de Calidad del Aire Mensual

```bash
# Obtener datos de AOD para todo enero 2024
for day in {01..31}; do
    curl -s "http://localhost:3000/api/air-water-quality/aod?date=2024-01-$day" \
    | jq '.statistics.mean' >> aod_january.txt
done

# Calcular promedio
awk '{sum+=$1; count++} END {print sum/count}' aod_january.txt
```

### Caso 2: Detección de Eventos de Calor

```javascript
// En frontend JavaScript
async function monitorHeatEvents() {
    const response = await fetch(
        '/api/vegetation-heat/heat-islands?startDate=2024-01-01&endDate=2024-12-31&threshold=2.5'
    );
    
    const data = await response.json();
    const criticalEvents = data.events.filter(e => e.anomaly > 3.0);
    
    if (criticalEvents.length > 0) {
        alert(`⚠️ Se detectaron ${criticalEvents.length} eventos críticos de islas de calor`);
        
        // Mostrar en tabla
        criticalEvents.forEach(event => {
            console.log(`${event.date}: +${event.anomaly}°C`);
        });
    }
}
```

### Caso 3: Ranking de Distritos para Intervención Verde

```bash
# Obtener índice de prioridad
curl -s "http://localhost:3000/api/vegetation-heat/priority?date=2024-08-15" \
| jq '.priorities | sort_by(-.priority) | .[:5] | .[] | "\(.name): \(.priority)"'

# Resultado ejemplo:
# "San Juan de Lurigancho: 0.82"
# "Ate: 0.75"
# "Villa María del Triunfo: 0.68"
# "Comas: 0.62"
# "Lima Centro: 0.58"
```

---

## 🛠️ Troubleshooting

### Problema: "No data available"

**Síntomas:**
```json
{
  "statistics": {
    "mean": null,
    "min": null,
    "max": null
  },
  "interpretation": "No data available"
}
```

**Causas posibles:**
1. Fecha muy reciente (datos aún no procesados)
2. Fecha fuera del rango de disponibilidad del dataset
3. Cobertura de nubes 100% (no hay píxeles válidos)

**Soluciones:**
- Usa fechas con al menos 7 días de antigüedad
- Intenta con diferentes fechas históricas
- Para vegetación, usa rangos de fechas más largos (ej: 3 meses) para obtener composites más robustos

### Problema: Loading infinito

**Síntomas:**
El overlay de carga no desaparece después de 30+ segundos.

**Soluciones:**
1. Revisa la consola del navegador (F12) para errores JavaScript
2. Verifica el estado del servidor:
   ```bash
   curl http://localhost:3000/api/health
   ```
3. Revisa los logs del servidor:
   ```bash
   tail -f /workspaces/GEE/server.log
   ```
4. Reinicia el servidor:
   ```bash
   pkill -f "node server.js"
   cd /workspaces/GEE && node server.js > server.log 2>&1 &
   ```

### Problema: Mapas no se visualizan

**Síntomas:**
Los mapas están vacíos o muestran solo el mapa base.

**Soluciones:**
1. Verifica que mapId no sea null en la respuesta de la API
2. Comprueba la consola del navegador para errores de red
3. Verifica que tienes conexión a internet (las tiles vienen de GEE servers)
4. Intenta con un zoom diferente o recentraliza el mapa

---

## 📈 Mejores Prácticas

### 1. Selección de Fechas
- **Calidad de Aire y Agua**: Usa fechas individuales con 7-14 días de antigüedad
- **Vegetación e Islas de Calor**: Usa rangos de 1-3 meses para mejores composites

### 2. Rendimiento
- Evita hacer muchas consultas simultáneas (espera que una termine antes de la siguiente)
- Los resultados son más rápidos si otros usuarios ya consultaron fechas similares (caché futuro)
- Las consultas de análisis completo tardan más que consultas individuales

### 3. Interpretación de Resultados
- LST Anomalía es más útil que LST absoluta para detectar islas de calor
- NDVI < 0.2 indica áreas urbanas con poca vegetación (oportunidad de intervención)
- AOD > 0.3 indica calidad de aire preocupante (considera alertas)

### 4. Integración en Aplicaciones
- Usa async/await para manejo de promesas
- Implementa manejo de errores robusto (try/catch)
- Muestra indicadores de carga siempre (UX)
- Cacha resultados en localStorage para consultas repetidas

---

## 📚 Recursos Adicionales

- **Swagger UI Interactivo**: http://localhost:3000/api-docs
- **Documentación Completa**: `/workspaces/GEE/INTEGRACION-API-COMPLETADA.md`
- **Guía de Implementación**: `/workspaces/GEE/IMPLEMENTACION-GEE-COMPLETA.md`
- **Google Earth Engine Docs**: https://developers.google.com/earth-engine
- **Leaflet Documentation**: https://leafletjs.com/reference.html

---

## 🎉 ¡Listo para Usar!

Ahora tienes acceso completo a datos satelitales reales de Google Earth Engine para monitorear la calidad ambiental de Lima Metropolitana. 

**¿Preguntas?** Revisa los ejemplos de código o consulta la documentación de la API.

**¿Encontraste un bug?** Revisa la sección de Troubleshooting o verifica los logs del servidor.

**¡Feliz monitoreo ambiental!** 🌍🛰️✨
