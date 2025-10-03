# Manual metodológico para implementar EcoPlan Urbano con Google Earth Engine

> **Cobertura**: Todos los ejemplos usan el sistema de coordenadas WGS84 (`EPSG:4326`) y se asumen fechas en la zona horaria de Lima (UTC−5). Ajuste los rangos temporales a su contexto cuando sea necesario.

## Contenidos

1. [Preparación del entorno y acceso a Google Earth Engine](#1-preparación-del-entorno-y-acceso-a-google-earth-engine)
   - [1.1. Solicitar acceso a Google Earth Engine](#11-solicitar-acceso-a-google-earth-engine)
   - [1.2. Configurar un proyecto de Google Cloud y compartir activos](#12-configurar-un-proyecto-de-google-cloud-y-compartir-activos)
   - [1.3. Instalación y autenticación en Python](#13-instalación-y-autenticación-en-python)
   - [1.4. Consideraciones de cliente y servidor](#14-consideraciones-de-cliente-y-servidor)
2. [Definir la región de estudio y geometrías](#2-definir-la-región-de-estudio-y-geometrías)
3. [Ingesta y procesamiento de datos satelitales](#3-ingesta-y-procesamiento-de-datos-satelitales)
   - [3.1. Cálculo del NDVI (vegetación y espacios verdes)](#31-cálculo-del-ndvi-vegetación-y-espacios-verdes)
   - [3.2. Temperatura de superficie terrestre (LST) e islas de calor](#32-temperatura-de-superficie-terrestre-lst-e-islas-de-calor)
   - [3.3. Calidad del aire](#33-calidad-del-aire)
   - [3.4. Calidad del agua y drenaje urbano](#34-calidad-del-agua-y-drenaje-urbano)
   - [3.5. Datos socioeconómicos](#35-datos-socioeconómicos)
4. [Cálculo de índices compuestos y reducción de datos](#4-cálculo-de-índices-compuestos-y-reducción-de-datos)
5. [Creación de interfaces interactivas con Earth Engine Apps](#5-creación-de-interfaces-interactivas-con-earth-engine-apps)
6. [Integración con aplicaciones web externas (Python + geemap)](#6-integración-con-aplicaciones-web-externas-python--geemap)
7. [Exportación de datos y gestión de cuotas](#7-exportación-de-datos-y-gestión-de-cuotas)
8. [Buenas prácticas y recomendaciones finales](#8-buenas-prácticas-y-recomendaciones-finales)
9. [Recursos complementarios y bibliografía](#9-recursos-complementarios-y-bibliografía)

---

## 1. Preparación del entorno y acceso a Google Earth Engine

### 1.1. Solicitar acceso a Google Earth Engine

1. Ingrese a [https://earthengine.google.com/](https://earthengine.google.com/) con su correo institucional y solicite una cuenta indicando un uso no comercial.
2. Complete el formulario describiendo brevemente el proyecto **EcoPlan Urbano (EPU)** y su objetivo.
3. Una vez aprobada la cuenta, acceda al **Code Editor** en [https://code.earthengine.google.com/](https://code.earthengine.google.com/) y a las APIs REST/JavaScript/Python.

> 💡 *Tiempo de aprobación*: puede tardar entre horas y días. Revise el correo con el que se registró.

### 1.2. Configurar un proyecto de Google Cloud y compartir activos

1. Cree un proyecto de Google Cloud (por ejemplo, `ee-epu`) desde [console.cloud.google.com](https://console.cloud.google.com/).
2. Habilite la **API de Earth Engine** dentro de ese proyecto (IAM & Admin → APIs y servicios).
3. En el Code Editor, abra el panel **Apps** y cree una nueva aplicación. Seleccione el proyecto de Cloud, asigne un nombre y defina los permisos (pública o restringida).
4. Comparta todos los activos (imágenes, tablas, geometrías) empleados en la App marcándolos como *"Anyone can read"* o compartiéndolos con la cuenta del App. De lo contrario aparecerá el error `There was an error loading some parts of the map`.
5. Si la App muestra `app is not ready yet`, espere algunos minutos mientras los recursos se replican globalmente.

### 1.3. Instalación y autenticación en Python

La API de Python permite automatizar procesos, integrarse con backends y trabajar fuera del Code Editor. Se recomienda combinarla con [geemap](https://geemap.org/).

```bash
# Crear un entorno virtual (opcional)
python3 -m venv gee_env
source gee_env/bin/activate

# Instalar Earth Engine API y geemap
pip install earthengine-api geemap
```

**Script base en Python**:

```python
import ee
import geemap

# Autenticación (abre un navegador para conceder permisos)
ee.Authenticate()

ee.Initialize(project='ee-epu')  # opcional, use su proyecto de Cloud

# Crear un mapa interactivo centrado en Lima
Map = geemap.Map(center=[-12.0464, -77.0428], zoom=10)
Map
```

> ⚠️ *Uso de `getInfo()`*: evita recuperaciones masivas al cliente. Prefiera operaciones en el servidor y descargue resultados sólo cuando sea imprescindible.

### 1.4. Consideraciones de cliente y servidor

- **Modelo diferido**: las operaciones de objetos `ee.*` se ejecutan en los servidores de Google. En JavaScript, `print()` desencadena una llamada implícita a `getInfo()`.
- **Evitar `getInfo()` (Python)** cuando no sea estrictamente necesario; bloquea el script y transfiere los datos completos a su sesión local.
- **Control de flujo**: los bucles y condicionales del cliente no operan directamente sobre objetos `ee`. Use `map()` para iterar colecciones y `ee.Algorithms.If()` para condicionales específicas.
- **Procesamiento server-side**: diseña la lógica para permanecer en el servidor hasta la etapa final. Esto garantiza rendimiento y estabilidad.

Documentación: [Client vs. Server Guide](https://developers.google.com/earth-engine/guides/client_server).

---

## 2. Definir la región de estudio y geometrías

1. En el Code Editor, utilice la herramienta de dibujo para crear polígonos/puntos que delimiten el área de interés (AOI). Guárdela como `ee.FeatureCollection` para reutilizarla.
2. En Python puede definir la geometría manualmente:

```python
coords = [
    [-77.21, -12.05],
    [-76.77, -12.05],
    [-76.77, -12.39],
    [-77.21, -12.39],
    [-77.21, -12.05]
]
aoi = ee.Geometry.Polygon([coords])
```

> ✅ Siempre especifique **geometría** y **escala** al usar reductores como `reduceRegion` o `reduce`. Reduce errores y asegura consistencia espacial.

---

## 3. Ingesta y procesamiento de datos satelitales

### 3.1. Cálculo del NDVI (vegetación y espacios verdes)

**Concepto clave**: la vegetación sana refleja NIR y absorbe rojo. El Índice Normalizado de Vegetación (NDVI) se calcula como:

$$\text{NDVI} = \frac{\text{NIR} - \text{Rojo}}{\text{NIR} + \text{Rojo}}$$

Valores cercanos a 1 indican vegetación vigorosa; negativos representan agua o nubes.

#### 3.1.1. Seleccionar la colección adecuada

- **Landsat 8/9 (Colección 2)**: `LANDSAT/LC08/C02/T1_L2` (reflectancia superficial) o `LANDSAT/LC08/C02/T1` (TOA). Documentación: [Landsat Algorithms](https://developers.google.com/earth-engine/guides/landsat).
- **Sentinel-2**: `COPERNICUS/S2_SR_HARMONIZED`, con bandas B2 (azul), B3 (verde), B4 (rojo) y B8 (NIR).

#### 3.1.2. Filtrar por fechas y región

```javascript
// Code Editor (JavaScript)
var aoi = /* geometría importada */;
var startDate = '2024-01-01';
var endDate = '2024-12-31';

var collection = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
  .filterDate(startDate, endDate)
  .filterBounds(aoi)
  .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 20));
```

Filtrar por fecha, AOI y porcentaje de nubes acelera el procesamiento ([Best Practices](https://developers.google.com/earth-engine/guides/best_practices)).

#### 3.1.3. Máscara de nubes

**Landsat**: `ee.Algorithms.Landsat.simpleCloudScore()` genera una banda de nubosidad.

```javascript
function maskL8sr(image) {
  var cloudScore = ee.Algorithms.Landsat.simpleCloudScore(image).select('cloud');
  var mask = cloudScore.lte(20); // umbral de nubes
  return image.updateMask(mask);
}

var masked = collection.map(maskL8sr);
```

> ℹ️ `updateMask()` combina la máscara nueva con la existente (operación AND), evitando que se revelen píxeles erróneos ([Best Practices](https://developers.google.com/earth-engine/guides/best_practices)).

**Sentinel-2**: use `QA60` o algoritmos como [s2cloudless](https://developers.google.com/earth-engine/tutorials/community/sentinel-2-s2cloudless).

#### 3.1.4. Calcular NDVI por imagen

```javascript
function addNDVI(image) {
  var ndvi = image.normalizedDifference(['B8', 'B4']).rename('NDVI');
  return image.addBands(ndvi);
}

var withNDVI = masked.map(addNDVI);
```

`normalizedDifference()` computa $(B8 - B4)/(B8 + B4)$ automáticamente y se aplica con `map()` para mantener el cálculo en el servidor.

#### 3.1.5. Mosaico "píxel más verde"

Use `qualityMosaic('NDVI')` para seleccionar por píxel la imagen con NDVI máximo.

```javascript
var greenest = withNDVI.qualityMosaic('NDVI');
var ndviParams = {min: 0, max: 0.8, palette: ['blue', 'white', 'green']};

Map.addLayer(greenest.select('NDVI'), ndviParams, 'NDVI máximo');
Map.centerObject(aoi, 10);
```

### 3.2. Temperatura de superficie terrestre (LST) e islas de calor

**Concepto**: las ciudades concentran calor por superficies impermeables y escasez de vegetación, generando “islas de calor”. Para mapearlas se combinan LST, NDVI y datos socioeconómicos.

#### 3.2.1. Selección de datos

- **MODIS**: `MODIS/061/MOD11A2` proporciona LST de 8 días a 1 km.
- **Landsat**: `LANDSAT/LC08/C02/T1_L2` con banda térmica `ST_B10` y factores de escala.

#### 3.2.2. Conversión a grados Celsius (JavaScript)

```javascript
var landsat = ee.ImageCollection('LANDSAT/LC08/C02/T1_L2')
  .filterDate('2024-01-01', '2024-12-31')
  .filterBounds(aoi)
  .map(maskL8sr)
  .first();

var lstK = landsat.select('ST_B10').multiply(0.00341802).add(149);
var lstC = lstK.subtract(273.15).rename('LST_C');

Map.addLayer(
  lstC.clip(aoi),
  {min: 20, max: 40, palette: ['blue', 'yellow', 'red']},
  'LST (°C)'
);
```

> No use `reproject()` salvo justificación específica. Controle la escala mediante parámetros en reductores ([Scale Guide](https://developers.google.com/earth-engine/guides/scale)).

#### 3.2.3. Índice de vulnerabilidad al calor (Python)

```python
def normalize(image, min_val, max_val):
    return image.subtract(min_val).divide(max_val - min_val)

ndvi_norm = normalize(greenest.select('NDVI'), 0, 0.8)
lst_norm = normalize(lstC, 20, 40)  # ajustar rangos locales
pop = ee.Image('CIESIN/GPWv411/GPW_Population_Density').clip(aoi)
pop_norm = normalize(pop, 0, 10000)

heat_index = (
    lst_norm.multiply(0.5)
    .add(ndvi_norm.multiply(-0.3))
    .add(pop_norm.multiply(0.2))
    .rename('HeatVuln')
)

Map.addLayer(heat_index, {'min': -0.5, 'max': 1, 'palette': ['green', 'yellow', 'red']}, 'Índice de calor')
```

### 3.3. Calidad del aire

Fuentes recomendadas:

- **AOD (Aerosol Optical Depth)**: `MODIS/061/MOD08_M3` (mensual, ~1 km).
- **NO₂**: `COPERNICUS/S5P/NRTI/L3_NO2` (diario, 3.5 km).
- **PM₂.₅**: productos SEDAC como `SEDAC/ARC/POPULATION-COUNTS-2000-2020` o `COPERNICUS/S5P/OFFL/L3_AER_AI`.

Pasos clave:

1. Reproyectar o remuestrear las capas a una escala común.
2. Promediar valores por barrio con `reduceRegion` o `reduceRegions`.
3. Integrar con datos de tránsito (OpenStreetMap) o actividades industriales para contextualizar.

Documentación: [NASA Air Quality](https://www.earthdata.nasa.gov/topics/atmosphere/air-quality).

### 3.4. Calidad del agua y drenaje urbano

**Justificación científica**: Landsat monitoriza clorofila, fósforo y nitrógeno desde 1976, permitiendo detectar floraciones algales y alertas tempranas ([Landsat Water Quality](https://landsat.gsfc.nasa.gov/article/above-the-earth-below-the-surface-landsats-role-in-monitoring-water-quality/)).

Ejemplo (JavaScript) con NDWI:

```javascript
var waterCol = ee.ImageCollection('LANDSAT/LC08/C02/T1_L2')
  .filterDate('2024-01-01', '2024-12-31')
  .filterBounds(aoi)
  .map(maskL8sr)
  .map(function(img) {
    var ndwi = img.normalizedDifference(['SR_B3', 'SR_B5']).rename('NDWI');
    return img.addBands(ndwi);
  });

var maxNdwi = waterCol.qualityMosaic('NDWI');
Map.addLayer(
  maxNdwi.select('NDWI'),
  {min: -0.1, max: 0.5, palette: ['brown', 'blue', 'cyan']},
  'NDWI máximo'
);
```

Combine el NDWI con series de temperatura y precipitación para anticipar floraciones nocivas.

### 3.5. Datos socioeconómicos

Complementa el diagnóstico ambiental con indicadores sociales:

- **WorldPop**: `WorldPop/GP/100m/pop` (densidad poblacional).
- **GHSL**: `JRC/GHSL/P2023A/GHS_POP` (densidad y tamaño de asentamientos).
- **Colección urbana SEDAC**: contiene datos de islas de calor, acceso a espacios públicos y transporte.

> Ajuste todas las capas a la misma escala y geometría antes de integrarlas. Use `join` y `reduceRegions` para sumarizar por distritos o sectores censales.

---

## 4. Cálculo de índices compuestos y reducción de datos

**Objetivo**: sintetizar múltiples capas (NDVI, LST, contaminación, población, NDWI) en indicadores interpretables.

```javascript
var districts = ee.FeatureCollection('users/tu_usuario/distritos_lima');

var stacked = greenest.select('NDVI')
  .addBands(lst_norm)
  .addBands(pop_norm)
  .addBands(heat_index);

var stats = stacked.reduceRegions({
  collection: districts,
  reducer: ee.Reducer.mean().combine({
    reducer2: ee.Reducer.stdDev(),
    sharedInputs: true
  }),
  scale: 30,
  tileScale: 4
});
```

> Combinar reductores (`mean` + `stdDev`) en una sola operación reduce la cantidad de pasadas y uso de memoria ([Coding Best Practices](https://developers.google.com/earth-engine/guides/best_practices)).

Para series temporales, utilice `ui.Chart.image.series()` (JavaScript) o `geemap.chart.image()` (Python) indicando colección, geometría y escala. Guíe a los usuarios en la interpretación (p. ej., picos de LST alertan sobre olas de calor).

---

## 5. Creación de interfaces interactivas con Earth Engine Apps

Las Apps permiten compartir análisis con usuarios sin cuenta y personalizar controles. Recurso oficial: [Apps Guide](https://developers.google.com/earth-engine/guides/apps).

### 5.1. Estructura básica

```javascript
var boton = ui.Button('Actualizar mapa');
var slider = ui.Slider({min: 0, max: 1, value: 0.8, step: 0.1});
var opciones = ['NDVI', 'LST', 'Contaminación'];
var select = ui.Select({items: opciones, placeholder: 'Seleccione capa...'});

slider.onChange(function(valor) {
  Map.layers().get(0).setOpacity(valor);
});

select.onChange(function(opcion) {
  // Cambie la capa visible según "opcion"
});

var panel = ui.Panel({layout: ui.Panel.Layout.flow('vertical')});
panel.add(ui.Label('EcoPlan Urbano'));
panel.add(select);
panel.add(slider);
panel.add(boton);

ui.root.insert(0, panel);
```

- Los widgets `Slider`, `Select`, `Textbox`, etc., son mutables y sus propiedades pueden actualizarse sin recrearlos.
- `ui.Map` admite capas múltiples. Controle visibilidad y opacidad con `Map.layers()`.
- Active herramientas de dibujo con `Map.drawingTools().setShown(true)` y escuche eventos (`onDraw`, `onErase`) para recalcular índices dinámicamente ([UI Widgets](https://developers.google.com/earth-engine/guides/ui_widgets)).

### 5.2. Publicar la App

1. En el Code Editor seleccione **Apps → NEW APP**.
2. Defina el proyecto de Cloud, nombre, descripción y permisos.
3. Verifique que todos los activos estén compartidos con la App (o de forma pública).
4. Guarde y obtenga la URL final `https://USERNAME.users.earthengine.app/view/nombre`.
5. Para colaboración, configure la App como *Project-owned* y otorgue el rol **Earth Engine Apps Publisher** a los editores.

### 5.3. Errores comunes

- **Activos privados**: asegúrese de compartir imágenes y tablas; de lo contrario la App mostrará errores.
- **Propagación**: el mensaje `app is not ready yet` suele resolverse tras algunos minutos.
- **Geometrías visibles**: oculte o bloquee capas que no quiera mostrar antes de publicar.

---

## 6. Integración con aplicaciones web externas (Python + geemap)

Cuando se requiera un portal personalizado, combine Earth Engine con `geemap` o `folium`.

### 6.1. Mapas interactivos

```python
import ee
import geemap

ee.Initialize(project='ee-epu')

Map = geemap.Map(center=(-12.0464, -77.0428), zoom=10)

elevation = ee.Image('USGS/SRTMGL1_003')
vis_params = {'min': 0, 'max': 3000, 'palette': ['blue', 'green', 'red']}

Map.addLayer(elevation, vis_params, 'Elevación')
Map.addLayerControl()  # menú para activar/desactivar capas

Map.to_html('mapa_ecoplan.html', title='EcoPlan Urbano', width='100%', height='600px')
```

- `Map.to_html()` crea un archivo embebible en cualquier sitio web ([geemap export](https://geemap.org/notebooks/21_export_map_to_html_png/)).
- `Map.to_image()` y animaciones temporales (`Map.add_time_slider()`) permiten generar productos visuales adicionales.

### 6.2. Incrustar en portales web

1. Copie `mapa_ecoplan.html` a la carpeta pública de su sitio (Flask, Django o estático).
2. Ajuste el tamaño del contenedor `<iframe>` según el diseño del portal.
3. En frameworks con plantillas (Flask/Django), sirva el HTML desde `templates` y use `render_template()`.

---

## 7. Exportación de datos y gestión de cuotas

### 7.1. Exportar imágenes

```javascript
Export.image.toDrive({
  image: greenest.select('NDVI'),
  description: 'NDVI_Lima_2024',
  region: aoi,
  scale: 30,
  crs: 'EPSG:4326',
  fileFormat: 'GeoTIFF'
});
```

En Python, cree una tarea con `ee.batch.Export.image.toDrive()` y ejecútela con `task.start()`.

Parámetros críticos:

- `scale`: controla la resolución en metros (30 m para Landsat, 10 m para Sentinel-2).
- `region`: AOI a exportar (en WGS84).
- `crs`: sistema de referencia (mantenga `EPSG:4326` para compatibilidad global).

Use `Export.image.toCloudStorage()` o `Export.image.toAsset()` para otras salidas. Para assets, defina políticas de piramidado (`mean`, `max`, etc.). Documentación: [Exporting Images](https://developers.google.com/earth-engine/guides/exporting_images).

### 7.2. Monitoreo y límites de uso

1. Las exportaciones aparecen en la pestaña **Tasks** del Code Editor; presione `Run` para iniciarlas.
2. Earth Engine impone límites de tiempo/memoria. Errores como `User memory limit exceeded` sugieren convertir la operación en exportación o subdividir el procesamiento.
3. Consulte su consumo y cuotas en [https://code.earthengine.google.com/usage](https://code.earthengine.google.com/usage).

---

## 8. Buenas prácticas y recomendaciones finales

- **Filtrar temprano** por fecha, AOI y bandas antes de aplicar algoritmos pesados.
- **Usar `map()`** y funciones del servidor; evite bucles del cliente que no escalan.
- **Minimizar `reproject()`**; confíe en `scale` y zoom para controlar la resolución.
- **Preferir `updateMask()`** para mantener máscaras previas.
- **Combinar reductores** (`mean`, `stdDev`, `percentile`) en una sola operación.
- **Limitar `getInfo()`**; geemap presenta objetos en notebooks sin descargar todo.
- **Compartir activos correctamente** para Apps y colaboradores.
- **Documentar y versionar** scripts (Git/GitHub) e incluir parámetros y dependencias en `README.md`.

---

## 9. Recursos complementarios y bibliografía

- **Guías oficiales**
  - [Client vs. Server](https://developers.google.com/earth-engine/guides/client_server)
  - [Coding Best Practices](https://developers.google.com/earth-engine/guides/best_practices)
  - [Scale Guide](https://developers.google.com/earth-engine/guides/scale)
  - [Exporting Images](https://developers.google.com/earth-engine/guides/exporting_images)
  - [UI Widgets & Panels](https://developers.google.com/earth-engine/guides/ui)
  - [Earth Engine Apps](https://developers.google.com/earth-engine/guides/apps)
  - [NDVI & Quality Mosaic Tutorial](https://developers.google.com/earth-engine/tutorials/tutorial_api_06)
- **geemap**: Wu, Q. (2024). [Documentación oficial](https://geemap.org/)
- **Clima urbano y vegetación**: [NASA - Green Spaces Cooling Cities](https://science.nasa.gov/earth/climate-change/nasa-data-reveals-role-of-green-spaces-in-cooling-cities/)
- **Calidad del aire**: [NASA Earthdata - Air Quality](https://www.earthdata.nasa.gov/topics/atmosphere/air-quality)
- **Calidad del agua**: [Landsat Water Quality](https://landsat.gsfc.nasa.gov/article/above-the-earth-below-the-surface-landsats-role-in-monitoring-water-quality/)
- **Integración socioeconómica**: estudios de SEDAC y GHSL sobre desigualdades urbanas ([CIESIN datasets](https://sedac.ciesin.columbia.edu/)).

---

**Conclusión**: siguiendo estas fases podrá implementar EcoPlan Urbano sobre Google Earth Engine de manera reproducible, integrando componentes ambientales y socioeconómicos, generando índices compuestos, compartiendo resultados interactivos y cumpliendo las mejores prácticas de la comunidad y la documentación oficial.