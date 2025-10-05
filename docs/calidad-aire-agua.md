# Monitoreo Diario de Calidad de Aire y Agua - Lima Metropolitana

## 📋 Índice

1. [Resumen Ejecutivo](#resumen-ejecutivo)
2. [Objetivo](#objetivo)
3. [Metodología](#metodología)
4. [Elección de Fuentes de Datos](#elección-de-fuentes-de-datos)
5. [Variables Monitoreadas](#variables-monitoreadas)
6. [Implementación en Google Earth Engine](#implementación-en-google-earth-engine)
7. [Integración con NASA GIBS/Worldview](#integración-con-nasa-gibsworldview)
8. [Automatización de Descargas](#automatización-de-descargas)
9. [Casos de Uso](#casos-de-uso)
10. [Limitaciones y Consideraciones](#limitaciones-y-consideraciones)
11. [Roadmap y Extensiones Futuras](#roadmap-y-extensiones-futuras)
12. [Referencias](#referencias)

---

## 1. Resumen Ejecutivo

Este documento presenta una metodología y prototipo de herramienta para **monitoreo automático diario** de variables de calidad de aire y agua en Lima Metropolitana, utilizando datos satelitales de NASA/ESA procesados en Google Earth Engine (GEE) y visualizados mediante NASA GIBS/Worldview.

### Variables Implementadas

| Variable | Indicador | Resolución | Actualización | Fuente |
|----------|-----------|------------|---------------|--------|
| **AOD** | Profundidad óptica de aerosoles | 1 km | Diaria | MODIS MAIAC |
| **NO₂** | Columna troposférica | ~7 km | Diaria | Sentinel-5P TROPOMI |
| **Clorofila-a** | Concentración superficial | ~4 km | Diaria | Copernicus Marine |
| **NDWI** | Índice de agua normalizado | 463 m | Diaria | MODIS MCD43A4 |

### Beneficios

- ✅ **Automatización completa**: Obtención diaria sin intervención manual
- ✅ **Escalabilidad**: Fácil extensión a otras ciudades o regiones
- ✅ **Acceso libre**: Todas las fuentes son datos públicos y gratuitos
- ✅ **Procesamiento en la nube**: Sin requerimientos de infraestructura local
- ✅ **Integración simple**: API REST lista para consumir desde aplicaciones web

---

## 2. Objetivo

Diseñar e implementar un sistema de monitoreo ambiental que:

1. **Obtenga automáticamente** datos satelitales de calidad de aire (AOD, NO₂) y agua (Clorofila, NDWI)
2. **Procese** las variables en Google Earth Engine
3. **Visualice** resultados mediante mapas interactivos (GIBS) y series temporales
4. **Genere indicadores** de gestión ambiental para Lima Metropolitana
5. **Detecte automáticamente** eventos de contaminación que excedan umbrales

### Casos de Uso Principales

- 📊 **Autoridades ambientales**: Monitoreo continuo y alertas tempranas
- 🏙️ **Planificadores urbanos**: Identificar zonas de alta contaminación para intervenciones
- 🔬 **Investigadores**: Análisis de tendencias temporales y correlaciones
- 👥 **Ciudadanía**: Transparencia y acceso a datos ambientales en tiempo real

---

## 3. Metodología

### 3.1 Flujo de Trabajo General

```
┌─────────────────────────────────────────────────────────────────┐
│                    FLUJO DE TRABAJO COMPLETO                     │
└─────────────────────────────────────────────────────────────────┘

1️⃣  DEFINICIÓN DE ÁREA Y PERIODO
    ├─ Polígono de Lima Metropolitana (43 distritos)
    ├─ Bbox: -77.2, -12.4, -76.7, -11.7
    └─ Periodo: 2020-presente (diario)

2️⃣  CONSULTA DE CATÁLOGOS
    ├─ Google Earth Engine Data Catalog
    ├─ NASA GIBS Visualization Product Catalog
    └─ Verificación de disponibilidad temporal

3️⃣  INGESTA DE DATOS
    ├─ Opción A: GEE (valores numéricos, análisis cuantitativo)
    │   ├─ MODIS/061/MCD19A2_GRANULES (AOD)
    │   ├─ COPERNICUS/S5P/NRTI/L3_NO2 (NO₂)
    │   ├─ COPERNICUS/MARINE/SATELLITE_OCEAN_COLOR/V6 (Clorofila)
    │   └─ MODIS/MCD43A4_006_NDWI (NDWI)
    │
    └─ Opción B: GIBS WMS (mosaicos prediseñados, visualización rápida)
        ├─ https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi
        └─ Parámetros: LAYERS, BBOX, TIME, WIDTH, HEIGHT

4️⃣  PROCESAMIENTO
    ├─ Recorte espacial al área de estudio
    ├─ Escalado de valores (factores de conversión)
    ├─ Filtrado de nubes y calidad (QA bands)
    └─ Cálculo de estadísticas zonales

5️⃣  ANÁLISIS
    ├─ Series temporales (tendencias)
    ├─ Comparación con umbrales de referencia
    ├─ Detección de eventos extremos
    └─ Correlaciones entre variables

6️⃣  VISUALIZACIÓN
    ├─ Mapas interactivos (Leaflet + GIBS tiles)
    ├─ Gráficos de series temporales
    ├─ Tablas de datos por distrito
    └─ Alertas visuales (zonas críticas)

7️⃣  EXPORTACIÓN
    ├─ GeoTIFF (rasters para SIG)
    ├─ CSV (series temporales y estadísticas)
    ├─ PDF (reportes automáticos)
    └─ API REST (consumo por aplicaciones)
```

### 3.2 Área de Estudio

**Lima Metropolitana** comprende 43 distritos de la provincia de Lima más la provincia del Callao, con una superficie aproximada de **2,800 km²** y una población de más de **10 millones de habitantes**.

**Coordenadas de la bounding box:**
- **Longitud**: -77.2° a -76.7° W
- **Latitud**: -12.4° a -11.7° S
- **Sistema de referencia**: EPSG:4326 (WGS84)

### 3.3 Resolución Temporal

- **Frecuencia de actualización**: Diaria
- **Periodo histórico**: 2020-01-01 hasta presente
- **Total de observaciones**: ~2,100 días (más de 5 años)
- **Calendario de descarga**: Automatizado mediante cron jobs o Cloud Functions

---

## 4. Elección de Fuentes de Datos

### 4.1 Worldview y GIBS

**NASA Worldview** es un visor interactivo que permite:
- Navegación temporal (slider de fechas)
- Comparación lado a lado de capas
- Animaciones temporales
- Descarga de imágenes en alta resolución

**GIBS (Global Imagery Browse Services)** proporciona:
- Mosaicos prediseñados con simbología científica
- Actualización diaria (mayoría de productos)
- Servicios estandarizados OGC: **WMTS**, **WMS**, **TWMS**
- Más de **1,000 visualizaciones** disponibles

#### Ventajas de GIBS

✅ **Rápido**: Mosaicos pre-renderizados, sin procesamiento server-side  
✅ **Estándar**: Compatible con cualquier cliente WMS/WMTS (QGIS, Leaflet, OpenLayers)  
✅ **Gratuito**: Sin autenticación ni cuotas de uso  
✅ **Actualizado**: Productos NRTI (Near Real-Time) disponibles en <3 horas  

#### Limitaciones de GIBS

❌ **Solo visualización**: Devuelve imágenes PNG/JPEG, no valores radiométricos  
❌ **Simbología fija**: No se puede cambiar la paleta de colores  
❌ **Sin análisis**: Para estadísticas se requiere GEE u otra plataforma  

**Recomendación**: Usar GIBS para **visualización web rápida** y GEE para **análisis cuantitativo**.

### 4.2 Google Earth Engine

**Google Earth Engine** es una plataforma de análisis geoespacial basada en la nube que proporciona:

- Catálogo de **petabytes** de datos satelitales públicos
- Procesamiento paralelo masivo (sin límites de RAM local)
- API JavaScript y Python para scripting
- Exportación a Google Drive, Cloud Storage o Assets

#### Colecciones Relevantes

| Variable | Dataset GEE | Resolución | Cadencia | Banda/Variable |
|----------|-------------|------------|----------|----------------|
| **AOD** | `MODIS/061/MCD19A2_GRANULES` | 1 km | Diaria | `Optical_Depth_055` |
| **NO₂** | `COPERNICUS/S5P/NRTI/L3_NO2` | 7 km | Diaria | `tropospheric_NO2_column_number_density` |
| **Clorofila** | `COPERNICUS/MARINE/SATELLITE_OCEAN_COLOR/V6` | 4 km | Diaria | `CHL` |
| **NDWI** | `MODIS/MCD43A4_006_NDWI` | 463 m | Diaria | `NDWI` |

#### Ventajas de GEE

✅ **Valores numéricos**: Acceso directo a reflectancias, concentraciones, índices  
✅ **Análisis avanzado**: Estadísticas zonales, series temporales, machine learning  
✅ **Escalable**: Procesa regiones de cualquier tamaño  
✅ **Flexible**: Control total sobre visualización y exportación  

#### Limitaciones de GEE

❌ **Requiere autenticación**: Cuenta de Google (gratuita para uso académico/no comercial)  
❌ **Cuotas de uso**: Límites en procesamiento y almacenamiento (generosos pero finitos)  
❌ **Curva de aprendizaje**: Requiere conocimientos de programación  

---

## 5. Variables Monitoreadas

### 5.1 AOD (Aerosol Optical Depth) - Profundidad Óptica de Aerosoles

**Descripción**: Medida de la extinción de la luz solar por aerosoles (partículas en suspensión) en la atmósfera. Valores altos indican mayor concentración de contaminantes particulados (PM2.5, PM10, polvo, humo).

**Fuente**: MODIS Terra/Aqua procesado con algoritmo MAIAC (Multi-Angle Implementation of Atmospheric Correction)

**Colección GEE**: `MODIS/061/MCD19A2_GRANULES`  
**Banda**: `Optical_Depth_055` (AOD a 550 nm)  
**Factor de escala**: 0.001  
**Resolución espacial**: 1 km  
**Resolución temporal**: Diaria  

**Unidades**: Adimensional (típicamente 0.0 - 1.0+)

**Interpretación**:
- **0.0 - 0.1**: Excelente (aire muy limpio)
- **0.1 - 0.2**: Bueno (aire limpio)
- **0.2 - 0.3**: Moderado (contaminación ligera)
- **0.3 - 0.5**: Malo (contaminación significativa)
- **> 0.5**: Muy malo (contaminación severa, eventos extremos)

**Capa GIBS**: `MODIS_Terra_Aerosol` o `MODIS_Aqua_Aerosol`

**Paleta de colores** (verde → amarillo → rojo):
```javascript
['006837', '31a354', '78c679', 'addd8e', 'fdae61', 'f46d43', 'd7191c']
```

**Aplicaciones**:
- Monitoreo de calidad del aire
- Detección de incendios y quemas agrícolas
- Validación de modelos de transporte atmosférico
- Alertas de salud pública (enfermedades respiratorias)

### 5.2 NO₂ (Nitrogen Dioxide) - Dióxido de Nitrógeno

**Descripción**: Gas contaminante producido principalmente por combustión de vehículos, centrales eléctricas e industrias. Es un precursor del ozono troposférico y la lluvia ácida.

**Fuente**: Sentinel-5 Precursor (Sentinel-5P) instrumento TROPOMI (TROPOspheric Monitoring Instrument)

**Colección GEE**: `COPERNICUS/S5P/NRTI/L3_NO2`  
**Banda**: `tropospheric_NO2_column_number_density`  
**Factor de escala**: 1 × 10⁶ (para convertir a μmol/m²)  
**Resolución espacial**: ~7 km (nadir)  
**Resolución temporal**: Diaria (NRTI: Near Real-Time)  

**Unidades**: μmol/m² (micromoles por metro cuadrado)

**Interpretación**:
- **< 50 μmol/m²**: Bajo (fondo rural/oceánico)
- **50 - 100**: Moderado (áreas urbanas con tráfico ligero)
- **100 - 150**: Alto (centros urbanos densos)
- **150 - 200**: Muy alto (zonas industriales, horas pico)
- **> 200**: Extremo (eventos de congestión severa)

**Capa GIBS**: `S5P_NO2_Column_Density`

**Paleta de colores** (azul → amarillo → rojo):
```javascript
['000080', '0000FF', '00FFFF', 'FFFF00', 'FF0000', '800000']
```

**Aplicaciones**:
- Monitoreo de emisiones vehiculares
- Evaluación de políticas de transporte (pico y placa, peajes)
- Identificación de fuentes industriales
- Estudios de calidad del aire urbano

### 5.3 Clorofila-a (Chlorophyll-a)

**Descripción**: Pigmento fotosintético presente en fitoplancton y algas. Su concentración en agua indica productividad primaria y puede señalar eutrofización (exceso de nutrientes).

**Fuente**: Copernicus Marine Service - Multisensor (SeaWiFS, MODIS Aqua/Terra, VIIRS, OLCI)

**Colección GEE**: `COPERNICUS/MARINE/SATELLITE_OCEAN_COLOR/V6`  
**Banda**: `CHL`  
**Resolución espacial**: ~4 km  
**Resolución temporal**: Diaria  

**Unidades**: mg/m³ (miligramos por metro cúbico)

**Interpretación**:
- **< 0.1 mg/m³**: Oligotrófico (aguas pobres en nutrientes, muy claras)
- **0.1 - 0.3**: Bajo (aguas oceánicas típicas)
- **0.3 - 1.0**: Moderado (aguas costeras productivas)
- **1.0 - 3.0**: Alto (aguas ricas en nutrientes)
- **> 3.0**: Eutrófico (riesgo de floraciones algales, hipoxia)

**Capa GIBS**: `COPERNICUS_OCEAN_CHL_L3_NRT_OBS`

**Paleta de colores** (azul oscuro → verde):
```javascript
['08306b', '2171b5', '6baed6', 'c6dbef', '238b45', '74c476']
```

**Aplicaciones**:
- Monitoreo de calidad de agua costera
- Detección de floraciones algales nocivas (HABs)
- Evaluación de eutrofización
- Impacto de descargas de ríos y efluentes

**Nota para Lima**: La clorofila se mide principalmente en áreas oceánicas. En Lima es útil para monitorear la costa del Pacífico y detectar eventos de surgencia (upwelling) que traen nutrientes profundos.

### 5.4 NDWI (Normalized Difference Water Index) - Índice de Agua Normalizado

**Descripción**: Índice que refleja el contenido de agua en suelo, vegetación y cuerpos de agua. Calculado como `(NIR - SWIR) / (NIR + SWIR)` o `(Green - NIR) / (Green + NIR)` dependiendo del sensor.

**Fuente**: MODIS MCD43A4 (producto de reflectancia BRDF-ajustada)

**Colección GEE**: `MODIS/MCD43A4_006_NDWI`  
**Banda**: `NDWI`  
**Resolución espacial**: 463 m  
**Resolución temporal**: Diaria  

**Unidades**: Adimensional (típicamente -1.0 a +1.0)

**Interpretación**:
- **< -0.3**: Tierra seca, rocas, construcciones
- **-0.3 - 0.0**: Vegetación con baja humedad
- **0.0 - 0.2**: Suelo húmedo, vegetación verde
- **0.2 - 0.4**: Suelo saturado, humedales
- **> 0.4**: Cuerpos de agua (ríos, lagos, océano)

**Capa GIBS**: `MODIS_NDWI` (del producto MCD43A4)

**Paleta de colores** (marrón → beige → verde-azul):
```javascript
['8c510a', 'd8b365', 'f6e8c3', 'c7eae5', '5ab4ac', '01665e']
```

**Aplicaciones**:
- Mapeo de cuerpos de agua y humedales
- Monitoreo de sequías (humedad del suelo)
- Detección de inundaciones
- Evaluación de riego agrícola

**Nota para Lima**: Lima es una ciudad desértica con escasas precipitaciones. NDWI es útil para:
- Monitorear el río Rímac y sus afluentes
- Detectar áreas de riego urbano (parques, jardines)
- Evaluar la disponibilidad de agua superficial

---

## 6. Implementación en Google Earth Engine

### 6.1 Estructura del Script

El script completo está disponible en: **`docs/calidad-aire-agua-gee-script.js`**

**Componentes principales**:

1. **Configuración inicial** (líneas 1-30)
   - Definición del área de estudio (bbox de Lima)
   - Periodo de análisis (fechas)
   - Centrado del mapa

2. **Funciones auxiliares** (líneas 31-60)
   - `clipToLima()`: Recorte espacial
   - `calculateStats()`: Estadísticas zonales
   - `printStats()`: Imprimir resultados

3. **AOD - Aerosoles** (líneas 61-120)
   - Carga de colección MODIS MAIAC
   - Escalado de valores (× 0.001)
   - Visualización y estadísticas
   - Series temporales

4. **NO₂ - Dióxido de Nitrógeno** (líneas 121-180)
   - Carga de colección Sentinel-5P
   - Escalado a μmol/m² (× 1e6)
   - Visualización y estadísticas
   - Series temporales

5. **Clorofila-a** (líneas 181-240)
   - Carga de colección Copernicus Marine
   - Enfoque en área costera
   - Visualización con escala logarítmica
   - Series temporales

6. **NDWI - Índice de Agua** (líneas 241-300)
   - Carga de colección MODIS
   - Visualización con paleta divergente
   - Estadísticas y series temporales

7. **Comparación multivariable** (líneas 301-320)
   - Compuesto RGB falso color
   - Combinación AOD-NDWI-NO₂

8. **Análisis por distritos** (líneas 321-380)
   - Extracción de valores en puntos (7 distritos muestra)
   - Tabla de resultados
   - Exportación a CSV

9. **Alertas y umbrales** (líneas 381-420)
   - Detección de AOD > 0.3 y NO₂ > 150
   - Máscara de zonas críticas
   - Cálculo de área afectada

10. **Exportación de datos** (líneas 421-460)
    - GeoTIFF multibanda a Drive
    - Asset de Earth Engine
    - Configuración de parámetros

11. **Integración con GIBS** (líneas 461-490)
    - Construcción de URLs WMS
    - Ejemplos para AOD, NO₂, Clorofila

12. **Documentación** (líneas 491-550)
    - Referencias a datasets
    - Leyenda personalizada en el mapa

### 6.2 Ejecución del Script

**Opción 1: Code Editor Online**

1. Ir a: https://code.earthengine.google.com/
2. Copiar el contenido de `docs/calidad-aire-agua-gee-script.js`
3. Pegar en el editor
4. Hacer clic en **Run** (o presionar F5)
5. Esperar ~30-60 segundos (procesa 2,100+ imágenes)
6. Visualizar resultados en el mapa y la consola

**Opción 2: Python API (Local/Cloud)**

```python
import ee
ee.Initialize()

# Definir área de estudio
lima_bounds = ee.Geometry.Rectangle([-77.2, -12.4, -76.7, -11.7])

# AOD
aod_collection = ee.ImageCollection('MODIS/061/MCD19A2_GRANULES') \
    .filterBounds(lima_bounds) \
    .filterDate('2025-01-01', '2025-10-05') \
    .select('Optical_Depth_055')

aod_image = aod_collection.sort('system:time_start', False).first()
aod_scaled = aod_image.multiply(0.001).clip(lima_bounds)

# Obtener URL de thumbnail para visualización
url = aod_scaled.getThumbURL({
    'min': 0, 'max': 0.5,
    'palette': ['006837', '31a354', '78c679', 'fdae61', 'd7191c'],
    'dimensions': 512
})

print(url)
```

### 6.3 Resultados Esperados

Al ejecutar el script completo se obtiene:

1. **Mapas interactivos** (4 capas):
   - 🔴 AOD (Aerosoles)
   - 🟡 NO₂ (Dióxido de Nitrógeno)
   - 🟢 Clorofila-a
   - 🔵 NDWI (Índice de Agua)

2. **Series temporales** (4 gráficos):
   - Evolución diaria 2020-2025
   - Detección de tendencias estacionales
   - Identificación de eventos extremos

3. **Estadísticas zonales**:
   - Media, mín, máx, desviación estándar
   - Por variable y periodo

4. **Tabla de distritos**:
   - Valores promedio en 7 distritos muestra
   - Exportable a CSV

5. **Alertas automáticas**:
   - Máscara de zonas con AOD > 0.3
   - Máscara de zonas con NO₂ > 150 μmol/m²
   - Área total afectada (km²)

---

## 7. Integración con NASA GIBS/Worldview

### 7.1 Servicios GIBS Disponibles

GIBS ofrece tres tipos de servicios OGC:

#### WMTS (Web Map Tile Service)

**Ventajas**: Rápido, cache-friendly, estándar de facto para web mapping  
**URL base**: `https://gibs.earthdata.nasa.gov/wmts/epsg4326/best/`  
**Estructura del tile**: `{LayerIdentifier}/default/{Time}/{TileMatrixSet}/{TileMatrix}/{TileRow}/{TileCol}.{FormatExt}`

**Ejemplo**:
```
https://gibs.earthdata.nasa.gov/wmts/epsg4326/best/MODIS_Terra_Aerosol/default/2025-10-04/250m/5/10/12.png
```

#### WMS (Web Map Service)

**Ventajas**: Flexible, permite bbox personalizado, compatible con SIG de escritorio  
**URL base**: `https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi`  
**Parámetros principales**: `SERVICE`, `VERSION`, `REQUEST`, `LAYERS`, `BBOX`, `WIDTH`, `HEIGHT`, `TIME`, `FORMAT`

**Ejemplo**:
```
https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi?
  SERVICE=WMS&
  VERSION=1.3.0&
  REQUEST=GetMap&
  FORMAT=image/png&
  TRANSPARENT=TRUE&
  LAYERS=MODIS_Terra_Aerosol&
  CRS=EPSG:4326&
  BBOX=-77.2,-12.4,-76.7,-11.7&
  WIDTH=1024&
  HEIGHT=1024&
  TIME=2025-10-04
```

#### TWMS (Tiled WMS)

Variante híbrida que combina ventajas de WMTS (tiling) y WMS (flexibilidad).

### 7.2 Capas GIBS Recomendadas

| Variable | Layer Identifier GIBS | Periodo disponible | Resolución |
|----------|----------------------|---------------------|------------|
| **AOD** | `MODIS_Terra_Aerosol` | 2000-presente | 1 km |
| **AOD** | `MODIS_Aqua_Aerosol` | 2002-presente | 1 km |
| **NO₂** | `S5P_NO2_Column_Density` | 2018-presente | 7 km |
| **Clorofila** | `COPERNICUS_OCEAN_CHL_L3_NRT_OBS` | 2016-presente | 4 km |
| **NDWI** | `MODIS_NDWI` | 2000-presente | 463 m |

**Catálogo completo**: https://nasa-gibs.github.io/gibs-api-docs/available-visualizations/

### 7.3 Integración con Leaflet

Ejemplo de código JavaScript para añadir capa GIBS a un mapa Leaflet:

```javascript
// Inicializar mapa
var map = L.map('map').setView([-12.05, -76.95], 11);

// Capa base
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

// Función para construir URL de tile GIBS
function gibsTileUrl(layerName, date) {
  return 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/' + layerName +
         '/default/' + date + '/{tileMatrixSet}/{z}/{y}/{x}.png';
}

// Añadir capa AOD
var aodLayer = L.tileLayer(gibsTileUrl('MODIS_Terra_Aerosol', '2025-10-04'), {
  tileMatrixSet: 'GoogleMapsCompatible_Level9',
  tileSize: 256,
  attribution: 'NASA GIBS'
}).addTo(map);

// Añadir capa NO₂
var no2Layer = L.tileLayer(gibsTileUrl('S5P_NO2_Column_Density', '2025-10-04'), {
  tileMatrixSet: 'GoogleMapsCompatible_Level9',
  tileSize: 256,
  attribution: 'NASA GIBS / ESA Copernicus'
});

// Control de capas
L.control.layers({}, {
  'AOD (Aerosoles)': aodLayer,
  'NO₂ (Dióxido de Nitrógeno)': no2Layer
}).addTo(map);
```

### 7.4 Limitaciones de GIBS para Análisis Cuantitativo

⚠️ **Importante**: GIBS devuelve **imágenes prediseñadas** (PNG/JPEG), no valores radiométricos originales.

**Implicaciones**:
- ❌ No se pueden extraer valores numéricos de píxeles
- ❌ No se pueden calcular estadísticas (media, máx, mín)
- ❌ No se pueden aplicar umbrales personalizados
- ✅ Sí se puede usar para visualización rápida
- ✅ Sí se puede combinar con capas vectoriales
- ✅ Sí se puede usar en aplicaciones web sin backend

**Solución**: Para análisis cuantitativo, usar **Google Earth Engine** o descargar **datos crudos** de NASA Earthdata.

---

## 8. Automatización de Descargas

### 8.1 Script Python para Descarga WMS desde GIBS

```python
import requests
from datetime import datetime, timedelta
import os

# Configuración
GIBS_BASE_URL = "https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi"
LIMA_BBOX = "-77.2,-12.4,-76.7,-11.7"
OUTPUT_DIR = "./gibs_downloads"

# Parámetros WMS
WMS_PARAMS = {
    'SERVICE': 'WMS',
    'VERSION': '1.3.0',
    'REQUEST': 'GetMap',
    'FORMAT': 'image/geotiff',  # o 'image/png'
    'TRANSPARENT': 'TRUE',
    'CRS': 'EPSG:4326',
    'BBOX': LIMA_BBOX,
    'WIDTH': '1024',
    'HEIGHT': '1024'
}

# Capas a descargar
LAYERS = {
    'AOD': 'MODIS_Terra_Aerosol',
    'NO2': 'S5P_NO2_Column_Density',
    'CHL': 'COPERNICUS_OCEAN_CHL_L3_NRT_OBS',
    'NDWI': 'MODIS_NDWI'
}

def download_gibs_layer(layer_name, layer_id, date_str):
    """
    Descarga una capa GIBS para una fecha específica
    
    Args:
        layer_name (str): Nombre descriptivo (e.g., 'AOD')
        layer_id (str): Identificador GIBS (e.g., 'MODIS_Terra_Aerosol')
        date_str (str): Fecha en formato 'YYYY-MM-DD'
    """
    params = WMS_PARAMS.copy()
    params['LAYERS'] = layer_id
    params['TIME'] = date_str
    
    response = requests.get(GIBS_BASE_URL, params=params, timeout=60)
    
    if response.status_code == 200:
        # Crear directorio si no existe
        os.makedirs(OUTPUT_DIR, exist_ok=True)
        
        # Guardar archivo
        filename = f"{layer_name}_{date_str.replace('-', '')}.tif"
        filepath = os.path.join(OUTPUT_DIR, filename)
        
        with open(filepath, 'wb') as f:
            f.write(response.content)
        
        print(f"✅ Descargado: {filename} ({len(response.content)} bytes)")
        return filepath
    else:
        print(f"❌ Error descargando {layer_name} para {date_str}: HTTP {response.status_code}")
        return None

def download_daily_data(date):
    """
    Descarga todas las capas para una fecha
    
    Args:
        date (datetime): Fecha objetivo
    """
    date_str = date.strftime('%Y-%m-%d')
    print(f"\n{'='*60}")
    print(f"Descargando datos para {date_str}")
    print(f"{'='*60}")
    
    for layer_name, layer_id in LAYERS.items():
        download_gibs_layer(layer_name, layer_id, date_str)

# Ejemplo: Descargar última semana
if __name__ == '__main__':
    today = datetime.now()
    
    for i in range(7):
        date = today - timedelta(days=i)
        download_daily_data(date)
    
    print(f"\n✅ Descarga completada. Archivos guardados en: {OUTPUT_DIR}")
```

### 8.2 Automatización con Cron (Linux/macOS)

Crear un script bash `download_gibs_daily.sh`:

```bash
#!/bin/bash

# Activar entorno virtual Python (si aplica)
source /path/to/venv/bin/activate

# Ejecutar script de descarga
python3 /path/to/download_gibs.py

# Enviar notificación (opcional)
echo "Descarga GIBS completada: $(date)" | mail -s "EcoPlan GIBS" admin@example.com
```

Añadir a crontab (ejecutar diariamente a las 6 AM):

```bash
0 6 * * * /path/to/download_gibs_daily.sh >> /var/log/ecoplan_gibs.log 2>&1
```

### 8.3 Automatización con Google Cloud Functions

Para ejecutar el script GEE automáticamente:

```python
# main.py (Cloud Function)
import ee
from datetime import datetime

def download_gee_data(request):
    """
    Cloud Function para ejecutar análisis GEE diario
    """
    # Inicializar Earth Engine
    ee.Initialize()
    
    # Obtener fecha actual
    today = datetime.now().strftime('%Y-%m-%d')
    
    # Definir área
    lima_bounds = ee.Geometry.Rectangle([-77.2, -12.4, -76.7, -11.7])
    
    # AOD
    aod = ee.ImageCollection('MODIS/061/MCD19A2_GRANULES') \
        .filterBounds(lima_bounds) \
        .filterDate(today, today) \
        .select('Optical_Depth_055') \
        .first() \
        .multiply(0.001) \
        .clip(lima_bounds)
    
    # Calcular estadísticas
    stats = aod.reduceRegion(
        reducer=ee.Reducer.mean(),
        geometry=lima_bounds,
        scale=1000
    ).getInfo()
    
    # Guardar en Cloud Storage o BigQuery
    # ... (implementar según necesidad)
    
    return {'status': 'success', 'date': today, 'aod_mean': stats.get('Optical_Depth_055')}
```

Desplegar:

```bash
gcloud functions deploy download_gee_data \
    --runtime python39 \
    --trigger-http \
    --allow-unauthenticated \
    --schedule "0 8 * * *"  # Diario a las 8 AM
```

---

## 9. Casos de Uso

### 9.1 Monitoreo de Calidad del Aire Urbano

**Problema**: Lima enfrenta altos niveles de contaminación atmosférica, especialmente por tráfico vehicular e industrias.

**Solución**:
1. Monitorear **AOD** diariamente para detectar días con alta concentración de aerosoles
2. Correlacionar con **NO₂** para identificar fuentes (tráfico vs industria)
3. Generar alertas cuando AOD > 0.3 o NO₂ > 150 μmol/m²
4. Crear mapa de "hotspots" con zonas de mayor riesgo

**Indicador de gestión**:
```
Índice de Calidad de Aire (ICA) = 
  0.6 × (AOD normalizado) + 0.4 × (NO₂ normalizado)
  
Donde:
  AOD normalizado = min(AOD / 0.5, 1.0)
  NO₂ normalizado = min(NO₂ / 200, 1.0)
```

**Aplicación**: Dashboard en tiempo real para autoridades ambientales (DIGESA, SENAMHI).

### 9.2 Evaluación de Políticas de Transporte

**Problema**: ¿Las medidas de restricción vehicular (pico y placa) reducen efectivamente la contaminación?

**Solución**:
1. Comparar niveles de **NO₂** en días con/sin restricción
2. Analizar tendencias temporales antes/después de implementación de políticas
3. Evaluar diferencias espaciales (centro vs periferia)

**Análisis estadístico**:
- Test t de Student para comparar medias
- Análisis de varianza (ANOVA) por día de la semana
- Regresión lineal con variables dummy (política activa/inactiva)

**Aplicación**: Reportes para Ministerio de Transportes y Municipalidad de Lima.

### 9.3 Monitoreo de Calidad de Agua Costera

**Problema**: Descargas de efluentes y surgencias oceánicas afectan la calidad del agua en la costa de Lima.

**Solución**:
1. Monitorear **Clorofila-a** en la franja costera (0-5 km de la costa)
2. Detectar eventos de eutrofización (Chl > 3.0 mg/m³)
3. Correlacionar con **NDWI** en desembocaduras de ríos (Rímac, Chillón)
4. Alertar a autoridades (DIGESA, DICAPI) sobre floraciones algales nocivas

**Indicador de gestión**:
```
Índice de Salud Costera (ISC) = 
  - 0.7 × log(Clorofila) + 0.3 × NDWI_costero
  
Interpretación:
  ISC > 0.7: Excelente
  ISC 0.4-0.7: Bueno
  ISC 0.2-0.4: Regular
  ISC < 0.2: Malo (acción requerida)
```

**Aplicación**: Sistema de alertas para playas (DIGESA) y pescadores artesanales.

### 9.4 Detección de Incendios y Quemas Agrícolas

**Problema**: Quemas agrícolas en valles periféricos afectan la calidad del aire en Lima.

**Solución**:
1. Detectar picos súbitos de **AOD** (> 0.5) en zonas agrícolas
2. Validar con **NO₂** elevado (combustión)
3. Integrar con datos térmicos (MODIS Fire/VIIRS)
4. Geolocalizar fuentes de emisión

**Algoritmo de detección**:
```javascript
// En GEE
var anomalyAOD = aodDaily.gt(aodMean.add(aodStdDev.multiply(2)));
var fireAlert = anomalyAOD.and(no2Daily.gt(100));
```

**Aplicación**: Alertas tempranas para bomberos y autoridades agrícolas (SENASA).

---

## 10. Limitaciones y Consideraciones

### 10.1 Limitaciones Técnicas

#### Resolución Espacial

- **AOD (1 km)**: Adecuada para análisis a nivel de distrito, insuficiente para nivel de calle
- **NO₂ (7 km)**: Útil para tendencias regionales, limitada para fuentes puntuales
- **Clorofila (4 km)**: Apropiada para costa, no detecta cuerpos de agua pequeños
- **NDWI (463 m)**: Mejor resolución, adecuada para ríos y lagunas

**Implicación**: Para análisis a escala de manzana o edificio se requieren sensores de mayor resolución (Sentinel-2 a 10-20m) o estaciones terrestres.

#### Resolución Temporal

- **Cadencia diaria**: Excelente para monitoreo continuo
- **Nubes**: En Lima (costa desértica) la cobertura nubosa es mínima (~10-20% en invierno)
- **Hora de paso**: MODIS ~10:30 AM/PM, Sentinel-5P ~13:30 PM (hora local)

**Implicación**: Los datos representan condiciones en momentos específicos del día, no promedios diarios continuos.

#### Cobertura Geográfica

- **AOD y NO₂**: Cobertura global completa
- **Clorofila**: Principalmente océanos y grandes lagos, limitada en ríos
- **NDWI**: Cobertura terrestre global

**Implicación**: Para monitoreo de ríos pequeños o aguas interiores se requieren sensores ópticos de mayor resolución.

### 10.2 Limitaciones Científicas

#### Validación con Datos In Situ

Los datos satelitales requieren validación con mediciones terrestres:

- **AOD**: Comparar con fotómetros AERONET (si disponibles en Lima)
- **NO₂**: Validar con estaciones de monitoreo de SENAMHI
- **Clorofila**: Muestreo in situ con fluorómetros
- **NDWI**: Verificar con mediciones de humedad de suelo

**Recomendación**: Establecer campaña de validación durante 6-12 meses.

#### Factores de Confusión

- **Nubes**: Pueden enmascarar señales (usar bandas QA para filtrar)
- **Aerosoles naturales**: Polvo del desierto, sal marina (difícil distinguir de contaminación)
- **Topografía**: Lima tiene colinas que afectan la dispersión de contaminantes
- **Surgencias oceánicas**: Clorofila elevada puede ser natural (no eutrofización)

**Mitigación**: Análisis de series temporales largas para identificar patrones normales vs anómalos.

#### Incertidumbres

- **AOD**: ±0.05 (error absoluto) o ±15% (error relativo)
- **NO₂**: ±25-50% (mayor incertidumbre en áreas urbanas contaminadas)
- **Clorofila**: ±35% (sensible a turbidez y material suspendido)
- **NDWI**: ±0.05 (afectado por sombras y reflectancia superficial)

**Implicación**: Interpretar valores con cautela, enfocarse en tendencias relativas más que valores absolutos.

### 10.3 Limitaciones Operativas

#### Dependencia de Servicios Cloud

- **GEE**: Cuotas de uso (generosas pero finitas)
- **GIBS**: Sin SLA (Service Level Agreement), posibles interrupciones
- **Internet**: Requiere conectividad estable para descargas

**Mitigación**: Implementar cache local, respaldos, y redundancia de fuentes.

#### Latencia de Datos

- **MODIS**: ~3-5 horas (NRT)
- **Sentinel-5P**: ~3 horas (NRTI)
- **Copernicus Marine**: ~24-48 horas

**Implicación**: No es tiempo real estricto, pero suficiente para alertas tempranas.

#### Expertise Requerido

- Conocimientos de teledetección
- Programación (JavaScript/Python)
- Interpretación de datos ambientales
- Gestión de APIs y servicios web

**Mitigación**: Capacitación de personal, documentación clara, interfaz web simplificada para usuarios finales.

---

## 11. Roadmap y Extensiones Futuras

### Fase 1: MVP (Completado) ✅

- [x] Interfaz web demo con controles y mapa
- [x] Script GEE completo para 4 variables
- [x] Documentación técnica exhaustiva
- [x] Integración con GIBS/Worldview

### Fase 2: API REST (Próximo) 🔄

**Objetivo**: Exponer datos mediante endpoints HTTP para consumo por aplicaciones.

**Endpoints propuestos**:
```
GET /api/air-quality/aod?date=YYYY-MM-DD&district=Miraflores
GET /api/air-quality/no2?date=YYYY-MM-DD&bbox=-77.2,-12.4,-76.7,-11.7
GET /api/water-quality/chlorophyll?date=YYYY-MM-DD
GET /api/water-quality/ndwi?date=YYYY-MM-DD
GET /api/timeseries/aod?start=YYYY-MM-DD&end=YYYY-MM-DD&district=Lima
```

**Tecnología**: Node.js + Express + Earth Engine Python API

### Fase 3: Alertas Automáticas 🔔

**Funcionalidades**:
- Monitoreo continuo (cron job cada 6 horas)
- Detección de umbrales excedidos
- Notificaciones por email/SMS/Telegram
- Dashboard de alertas activas

**Criterios de alerta**:
- AOD > 0.3 en >20% del área
- NO₂ > 150 μmol/m² en >30% del área
- Clorofila > 3.0 mg/m³ en costa
- Tendencia creciente por 3+ días consecutivos

### Fase 4: Predicción (Machine Learning) 🤖

**Objetivo**: Predecir valores de AOD/NO₂ 24-48 horas en el futuro.

**Enfoque**:
- Variables predictoras: Meteorología (viento, temperatura, presión), hora del día, día de la semana, mes
- Modelos: Random Forest, LSTM (redes neuronales recurrentes)
- Entrenamiento: 3-5 años de datos históricos
- Validación: Cross-validation temporal

**Aplicación**: Alertas preventivas ("mañana se espera mala calidad del aire").

### Fase 5: Integración con Sensores IoT 📡

**Objetivo**: Fusionar datos satelitales con mediciones terrestres en tiempo real.

**Componentes**:
- Red de sensores de bajo costo (PM2.5, NO₂, O₃)
- Estaciones meteorológicas
- Transmisión por LoRaWAN o NB-IoT
- Asimilación de datos (calibración satelital con in situ)

**Beneficio**: Mayor precisión y cobertura espaciotemporal.

### Fase 6: Análisis Multiescala 🌐

**Extensiones geográficas**:
- Otras ciudades del Perú (Arequipa, Trujillo, Cusco)
- Región andina (Perú, Bolivia, Ecuador)
- América Latina completa

**Análisis integrados**:
- Correlación AOD con hospitalizaciones por enfermedades respiratorias
- Impacto de NO₂ en productividad agrícola
- Efectos de clorofila en pesca artesanal

---

## 12. Referencias

### Datasets y Colecciones

1. **MODIS MAIAC AOD**  
   Lyapustin, A., et al. (2018). "MODIS Collection 6 MAIAC algorithm"  
   https://developers.google.com/earth-engine/datasets/catalog/MODIS_061_MCD19A2_GRANULES

2. **Sentinel-5P TROPOMI NO₂**  
   Copernicus Sentinel-5P (2021). "Nitrogen Dioxide (NO₂) Product"  
   https://developers.google.com/earth-engine/datasets/catalog/COPERNICUS_S5P_NRTI_L3_NO2

3. **Copernicus Marine Chlorophyll**  
   Copernicus Marine Service (2023). "Ocean Colour L3 Product"  
   https://developers.google.com/earth-engine/datasets/catalog/COPERNICUS_MARINE_SATELLITE_OCEAN_COLOR_V6

4. **MODIS NDWI**  
   MODIS Science Team (2021). "MCD43A4 BRDF/Albedo Product"  
   https://developers.google.com/earth-engine/datasets/catalog/MODIS_MCD43A4_006_NDWI

### Herramientas y Plataformas

5. **NASA Worldview**  
   https://worldview.earthdata.nasa.gov/

6. **NASA GIBS API Documentation**  
   https://nasa-gibs.github.io/gibs-api-docs/

7. **Google Earth Engine**  
   Gorelick, N., et al. (2017). "Google Earth Engine: Planetary-scale geospatial analysis for everyone"  
   https://earthengine.google.com/

8. **GIBS Visualization Product Catalog**  
   https://nasa-gibs.github.io/gibs-api-docs/available-visualizations/

### Publicaciones Científicas

9. **AOD y Salud Pública**  
   World Health Organization (2021). "WHO global air quality guidelines"

10. **NO₂ en Ciudades Latinoamericanas**  
    Belalcázar, L., et al. (2020). "Air quality in Latin American cities"  
    _Atmospheric Environment_, 237, 117686.

11. **Eutrofización Costera**  
    Anderson, D. M., et al. (2002). "Harmful algal blooms and eutrophication"  
    _Journal of Environmental Management_, 52(2), 77-93.

### Documentación Técnica

12. **WMS/WMTS Standards**  
    Open Geospatial Consortium (2010). "OpenGIS Web Map Service (WMS) Implementation Specification"  
    https://www.ogc.org/standards/wms

13. **Earth Engine JavaScript API**  
    https://developers.google.com/earth-engine/guides

14. **Earth Engine Python API**  
    https://developers.google.com/earth-engine/guides/python_install

---

## Apéndices

### Apéndice A: Glosario

- **AOD**: Aerosol Optical Depth (Profundidad Óptica de Aerosoles)
- **BBOX**: Bounding Box (Cuadro delimitador geográfico)
- **GEE**: Google Earth Engine
- **GIBS**: Global Imagery Browse Services
- **MAIAC**: Multi-Angle Implementation of Atmospheric Correction
- **NDWI**: Normalized Difference Water Index
- **NO₂**: Dióxido de Nitrógeno
- **NRTI**: Near Real-Time (Casi tiempo real, <3 horas)
- **TROPOMI**: TROPOspheric Monitoring Instrument
- **WMS**: Web Map Service
- **WMTS**: Web Map Tile Service

### Apéndice B: Códigos de Ejemplo

Ver archivos:
- `docs/calidad-aire-agua-gee-script.js` - Script completo de Google Earth Engine
- `public/calidad-aire-agua.html` - Interfaz web interactiva
- Ejemplos Python en sección 8.1

### Apéndice C: Contacto y Soporte

**Equipo EcoPlan**  
Email: ayuda@ecoplan.gob.pe  
GitHub: https://github.com/Segesp/GEE  
Documentación: http://localhost:3000/api-docs

---

**Versión**: 1.0.0  
**Fecha**: 2025-10-05  
**Autor**: EcoPlan Team  
**Licencia**: MIT

---

**⭐ Implementación completa de monitoreo de calidad de aire y agua para Lima Metropolitana**
