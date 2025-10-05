// ═════════════════════════════════════════════════════════════════════════════
// MONITOREO DIARIO DE CALIDAD DE AIRE Y AGUA - LIMA METROPOLITANA
// ═════════════════════════════════════════════════════════════════════════════
//
// Autor: EcoPlan Team
// Plataforma: Google Earth Engine
// Última actualización: 2025-10-05
//
// Descripción:
// Script para obtener automáticamente variables de calidad de aire (AOD, NO₂)
// y agua (Clorofila-a, NDWI) a escala diaria en Lima Metropolitana.
//
// Variables:
//   - AOD (Profundidad Óptica de Aerosoles): MODIS/061/MCD19A2_GRANULES
//   - NO₂ (Dióxido de Nitrógeno): COPERNICUS/S5P/NRTI/L3_NO2
//   - Clorofila-a: COPERNICUS/MARINE/SATELLITE_OCEAN_COLOR/V6 (para aguas costeras)
//   - NDWI (Índice de Agua Normalizado): MODIS/MCD43A4_006_NDWI
//
// ═════════════════════════════════════════════════════════════════════════════

// ═════════════════════════════════════════════════════════════════════════════
// 1. CONFIGURACIÓN INICIAL
// ═════════════════════════════════════════════════════════════════════════════

// Área de estudio: Lima Metropolitana (43 distritos + Callao)
// Coordenadas aproximadas que cubren toda el área metropolitana
var limaBounds = ee.Geometry.Rectangle({
  coords: [-77.2, -12.4, -76.7, -11.7],
  geodesic: false
});

// Visualizar área de estudio
Map.centerObject(limaBounds, 11);
Map.addLayer(limaBounds, {color: '00FFFF'}, 'Lima Metropolitana', false);

// Periodo de análisis
var startDate = '2025-01-01';
var endDate = '2025-10-05'; // Fecha actual

// Para demo rápida: último día disponible
var singleDate = '2025-10-04';

// ═════════════════════════════════════════════════════════════════════════════
// 2. FUNCIONES AUXILIARES
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Función para recortar una imagen al área de estudio
 */
function clipToLima(image) {
  return image.clip(limaBounds);
}

/**
 * Función para calcular estadísticas zonales
 */
function calculateStats(image, geometry, variable) {
  var stats = image.reduceRegion({
    reducer: ee.Reducer.mean()
      .combine(ee.Reducer.min(), '', true)
      .combine(ee.Reducer.max(), '', true)
      .combine(ee.Reducer.stdDev(), '', true),
    geometry: geometry,
    scale: 1000,
    maxPixels: 1e9
  });
  
  return ee.Feature(null, stats).set('variable', variable);
}

/**
 * Crear una tabla resumen de estadísticas
 */
function printStats(feature) {
  var dict = feature.toDictionary();
  print('Estadísticas:', dict);
}

// ═════════════════════════════════════════════════════════════════════════════
// 3. AOD (PROFUNDIDAD ÓPTICA DE AEROSOLES) - MODIS MAIAC
// ═════════════════════════════════════════════════════════════════════════════

print('═══════════════════════════════════════════════════════');
print('📊 AOD - Profundidad Óptica de Aerosoles (MODIS MAIAC)');
print('═══════════════════════════════════════════════════════');

// Cargar colección MODIS MAIAC
var aodCollection = ee.ImageCollection('MODIS/061/MCD19A2_GRANULES')
  .filterBounds(limaBounds)
  .filterDate(startDate, endDate)
  .select('Optical_Depth_055'); // AOD a 550 nm

// Obtener imagen más reciente
var aodImage = aodCollection
  .sort('system:time_start', false)
  .first();

// Escalar valores (factor 0.001)
var aodScaled = aodImage.multiply(0.001);

// Recortar a Lima
var aodLima = clipToLima(aodScaled);

// Visualización
var aodVis = {
  min: 0,
  max: 0.5,
  palette: ['006837', '31a354', '78c679', 'addd8e', 'fdae61', 'f46d43', 'd7191c']
};

Map.addLayer(aodLima, aodVis, '🔴 AOD (Aerosoles)', true);

// Estadísticas
var aodStats = calculateStats(aodLima, limaBounds, 'AOD');
print('Estadísticas AOD:', aodStats);

// Crear series temporales
var aodTimeSeries = ui.Chart.image.series({
  imageCollection: aodCollection.select('Optical_Depth_055').map(function(img) {
    return img.multiply(0.001).clip(limaBounds);
  }),
  region: limaBounds,
  reducer: ee.Reducer.mean(),
  scale: 1000
}).setOptions({
  title: 'Serie Temporal de AOD - Lima Metropolitana',
  vAxis: {title: 'AOD (adimensional)'},
  hAxis: {title: 'Fecha'},
  lineWidth: 2,
  pointSize: 4,
  colors: ['#d7191c']
});

print(aodTimeSeries);

// ═════════════════════════════════════════════════════════════════════════════
// 4. NO₂ (DIÓXIDO DE NITRÓGENO) - SENTINEL-5P TROPOMI
// ═════════════════════════════════════════════════════════════════════════════

print('═══════════════════════════════════════════════════════');
print('📊 NO₂ - Dióxido de Nitrógeno (Sentinel-5P TROPOMI)');
print('═══════════════════════════════════════════════════════');

// Cargar colección Sentinel-5P
var no2Collection = ee.ImageCollection('COPERNICUS/S5P/NRTI/L3_NO2')
  .filterBounds(limaBounds)
  .filterDate(startDate, endDate)
  .select('tropospheric_NO2_column_number_density');

// Obtener imagen más reciente
var no2Image = no2Collection
  .sort('system:time_start', false)
  .first();

// Convertir a μmol/m² (multiplicar por 1e6)
var no2Scaled = no2Image.multiply(1000000);

// Recortar a Lima
var no2Lima = clipToLima(no2Scaled);

// Visualización
var no2Vis = {
  min: 0,
  max: 200,
  palette: ['000080', '0000FF', '00FFFF', 'FFFF00', 'FF0000', '800000']
};

Map.addLayer(no2Lima, no2Vis, '🟡 NO₂ (Dióxido de Nitrógeno)', true);

// Estadísticas
var no2Stats = calculateStats(no2Lima, limaBounds, 'NO2');
print('Estadísticas NO₂:', no2Stats);

// Series temporales
var no2TimeSeries = ui.Chart.image.series({
  imageCollection: no2Collection.map(function(img) {
    return img.multiply(1000000).clip(limaBounds);
  }),
  region: limaBounds,
  reducer: ee.Reducer.mean(),
  scale: 7000
}).setOptions({
  title: 'Serie Temporal de NO₂ - Lima Metropolitana',
  vAxis: {title: 'NO₂ (μmol/m²)'},
  hAxis: {title: 'Fecha'},
  lineWidth: 2,
  pointSize: 4,
  colors: ['#f39c12']
});

print(no2TimeSeries);

// ═════════════════════════════════════════════════════════════════════════════
// 5. CLOROFILA-A - COPERNICUS MARINE (AGUAS COSTERAS)
// ═════════════════════════════════════════════════════════════════════════════

print('═══════════════════════════════════════════════════════');
print('📊 Clorofila-a (Copernicus Marine - Multisensor)');
print('═══════════════════════════════════════════════════════');

// Nota: Esta colección cubre principalmente áreas oceánicas
// Para Lima incluirá la costa y el Océano Pacífico cercano

var chlCollection = ee.ImageCollection('COPERNICUS/MARINE/SATELLITE_OCEAN_COLOR/V6')
  .filterBounds(limaBounds)
  .filterDate(startDate, endDate)
  .select('CHL');

// Verificar disponibilidad
var chlCount = chlCollection.size();
print('Imágenes de Clorofila disponibles:', chlCount);

// Obtener imagen más reciente (si hay)
var chlImage = chlCollection
  .sort('system:time_start', false)
  .first();

// Recortar a Lima (principalmente costa)
var chlLima = clipToLima(chlImage);

// Visualización (escala logarítmica típica para clorofila)
var chlVis = {
  min: 0.01,
  max: 10,
  palette: ['08306b', '2171b5', '6baed6', 'c6dbef', '238b45', '74c476']
};

Map.addLayer(chlLima, chlVis, '🟢 Clorofila-a (mg/m³)', true);

// Estadísticas (solo área costera)
var coastalArea = ee.Geometry.Rectangle([-77.2, -12.4, -77.0, -11.7]); // Costa oeste
var chlStats = calculateStats(chlLima, coastalArea, 'Clorofila');
print('Estadísticas Clorofila-a (costa):', chlStats);

// Series temporales (costa)
var chlTimeSeries = ui.Chart.image.series({
  imageCollection: chlCollection.map(function(img) {
    return img.clip(coastalArea);
  }),
  region: coastalArea,
  reducer: ee.Reducer.mean(),
  scale: 4000
}).setOptions({
  title: 'Serie Temporal de Clorofila-a - Costa de Lima',
  vAxis: {title: 'Clorofila-a (mg/m³)', logScale: true},
  hAxis: {title: 'Fecha'},
  lineWidth: 2,
  pointSize: 4,
  colors: ['#27ae60']
});

print(chlTimeSeries);

// ═════════════════════════════════════════════════════════════════════════════
// 6. NDWI (ÍNDICE DE AGUA NORMALIZADO) - MODIS
// ═════════════════════════════════════════════════════════════════════════════

print('═══════════════════════════════════════════════════════');
print('📊 NDWI - Índice de Agua Normalizado (MODIS)');
print('═══════════════════════════════════════════════════════');

// Cargar colección MODIS NDWI
var ndwiCollection = ee.ImageCollection('MODIS/MCD43A4_006_NDWI')
  .filterBounds(limaBounds)
  .filterDate(startDate, endDate);

// Obtener imagen más reciente
var ndwiImage = ndwiCollection
  .sort('system:time_start', false)
  .first();

// Recortar a Lima
var ndwiLima = clipToLima(ndwiImage);

// Visualización
var ndwiVis = {
  min: -0.5,
  max: 0.5,
  palette: ['8c510a', 'd8b365', 'f6e8c3', 'c7eae5', '5ab4ac', '01665e']
};

Map.addLayer(ndwiLima, ndwiVis, '🔵 NDWI (Índice de Agua)', true);

// Estadísticas
var ndwiStats = calculateStats(ndwiLima, limaBounds, 'NDWI');
print('Estadísticas NDWI:', ndwiStats);

// Series temporales
var ndwiTimeSeries = ui.Chart.image.series({
  imageCollection: ndwiCollection.map(function(img) {
    return img.clip(limaBounds);
  }),
  region: limaBounds,
  reducer: ee.Reducer.mean(),
  scale: 500
}).setOptions({
  title: 'Serie Temporal de NDWI - Lima Metropolitana',
  vAxis: {title: 'NDWI (adimensional)'},
  hAxis: {title: 'Fecha'},
  lineWidth: 2,
  pointSize: 4,
  colors: ['#3498db']
});

print(ndwiTimeSeries);

// ═════════════════════════════════════════════════════════════════════════════
// 7. COMPARACIÓN MULTIVARIABLE
// ═════════════════════════════════════════════════════════════════════════════

print('═══════════════════════════════════════════════════════');
print('📊 Comparación Multivariable');
print('═══════════════════════════════════════════════════════');

// Crear compuesto RGB falso color
// R: AOD (calidad aire), G: NDWI (agua), B: NO₂ (contaminación)
var composite = ee.Image.cat([
  aodLima.unitScale(0, 0.5),
  ndwiLima.unitScale(-0.5, 0.5),
  no2Lima.unitScale(0, 200)
]).rename(['AOD', 'NDWI', 'NO2']);

Map.addLayer(composite, {min: 0, max: 1}, '🎨 Compuesto RGB (AOD-NDWI-NO2)', false);

// ═════════════════════════════════════════════════════════════════════════════
// 8. TABLA RESUMEN DE DISTRITOS
// ═════════════════════════════════════════════════════════════════════════════

print('═══════════════════════════════════════════════════════');
print('📊 Análisis por Distritos (Muestra)');
print('═══════════════════════════════════════════════════════');

// Definir algunos distritos principales (centros aproximados)
var districts = ee.FeatureCollection([
  ee.Feature(ee.Geometry.Point([-77.028, -12.046]), {name: 'Lima Centro', distrito: 'Lima'}),
  ee.Feature(ee.Geometry.Point([-77.028, -12.120]), {name: 'Miraflores', distrito: 'Miraflores'}),
  ee.Feature(ee.Geometry.Point([-76.994, -12.089]), {name: 'San Isidro', distrito: 'San Isidro'}),
  ee.Feature(ee.Geometry.Point([-77.050, -12.054]), {name: 'Callao', distrito: 'Callao'}),
  ee.Feature(ee.Geometry.Point([-76.937, -12.041]), {name: 'San Juan de Lurigancho', distrito: 'SJL'}),
  ee.Feature(ee.Geometry.Point([-77.078, -11.889]), {name: 'Ancón', distrito: 'Ancón'}),
  ee.Feature(ee.Geometry.Point([-76.867, -12.193]), {name: 'Villa El Salvador', distrito: 'VES'})
]);

// Función para extraer valores en puntos
function extractValues(feature) {
  var point = feature.geometry();
  var buffer = point.buffer(1000); // 1 km radio
  
  var aodValue = aodLima.reduceRegion({
    reducer: ee.Reducer.mean(),
    geometry: buffer,
    scale: 1000
  }).get('Optical_Depth_055');
  
  var no2Value = no2Lima.reduceRegion({
    reducer: ee.Reducer.mean(),
    geometry: buffer,
    scale: 7000
  }).get('tropospheric_NO2_column_number_density');
  
  var ndwiValue = ndwiLima.reduceRegion({
    reducer: ee.Reducer.mean(),
    geometry: buffer,
    scale: 500
  }).get('NDWI');
  
  return feature.set({
    'AOD': aodValue,
    'NO2_umol_m2': no2Value,
    'NDWI': ndwiValue
  });
}

// Aplicar extracción
var districtData = districts.map(extractValues);

// Imprimir tabla
print('Datos por Distrito:', districtData);

// Exportar como tabla (opcional)
// Export.table.toDrive({
//   collection: districtData,
//   description: 'CalidadAireAgua_Distritos_Lima',
//   fileFormat: 'CSV'
// });

// ═════════════════════════════════════════════════════════════════════════════
// 9. ALERTAS Y UMBRALES
// ═════════════════════════════════════════════════════════════════════════════

print('═══════════════════════════════════════════════════════');
print('⚠️  Análisis de Umbrales y Alertas');
print('═══════════════════════════════════════════════════════');

// Umbrales de referencia
var AOD_THRESHOLD_MALO = 0.3;
var NO2_THRESHOLD_ALTO = 150; // μmol/m²

// Máscara de áreas con alta contaminación
var aodAlta = aodLima.gt(AOD_THRESHOLD_MALO);
var no2Alto = no2Lima.gt(NO2_THRESHOLD_ALTO);

// Combinar alertas
var alertaCombinada = aodAlta.and(no2Alto);

// Visualizar zonas de alerta
Map.addLayer(aodAlta.selfMask(), {palette: ['red']}, '⚠️ AOD Alto (>0.3)', false);
Map.addLayer(no2Alto.selfMask(), {palette: ['orange']}, '⚠️ NO₂ Alto (>150)', false);
Map.addLayer(alertaCombinada.selfMask(), {palette: ['darkred']}, '🚨 Alerta Combinada', false);

// Calcular área afectada
var areaAlerta = alertaCombinada.multiply(ee.Image.pixelArea())
  .reduceRegion({
    reducer: ee.Reducer.sum(),
    geometry: limaBounds,
    scale: 1000,
    maxPixels: 1e9
  });

print('Área con alerta combinada (km²):', 
      ee.Number(areaAlerta.get('constant')).divide(1e6));

// ═════════════════════════════════════════════════════════════════════════════
// 10. EXPORTACIÓN DE DATOS
// ═════════════════════════════════════════════════════════════════════════════

print('═══════════════════════════════════════════════════════');
print('💾 Opciones de Exportación');
print('═══════════════════════════════════════════════════════');

// Crear stack multibanda
var multiband = ee.Image.cat([
  aodLima.rename('AOD'),
  no2Lima.rename('NO2'),
  ndwiLima.rename('NDWI')
]);

// Descomentar para exportar a Google Drive
/*
Export.image.toDrive({
  image: multiband,
  description: 'CalidadAireAgua_Lima_' + singleDate.replace(/-/g, ''),
  folder: 'EcoPlan_GEE',
  region: limaBounds,
  scale: 1000,
  crs: 'EPSG:4326',
  maxPixels: 1e9
});
*/

// Descomentar para exportar a Earth Engine Asset
/*
Export.image.toAsset({
  image: multiband,
  description: 'CalidadAireAgua_Lima_Asset',
  assetId: 'users/YOUR_USERNAME/CalidadAireAgua_Lima',
  region: limaBounds,
  scale: 1000,
  crs: 'EPSG:4326',
  maxPixels: 1e9
});
*/

print('Para exportar datos, descomenta las secciones Export en el código.');

// ═════════════════════════════════════════════════════════════════════════════
// 11. INTEGRACIÓN CON NASA GIBS/WORLDVIEW
// ═════════════════════════════════════════════════════════════════════════════

print('═══════════════════════════════════════════════════════');
print('🌐 URLs de GIBS/Worldview para Visualización Rápida');
print('═══════════════════════════════════════════════════════');

// Construir URLs WMS de GIBS
var bbox = '-77.2,-12.4,-76.7,-11.7';
var width = '1024';
var height = '1024';
var date = '2025-10-04';

var gibsBaseURL = 'https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi';

var wmsParams = '?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap' +
                '&FORMAT=image/png&TRANSPARENT=TRUE' +
                '&CRS=EPSG:4326' +
                '&BBOX=' + bbox +
                '&WIDTH=' + width +
                '&HEIGHT=' + height +
                '&TIME=' + date;

// URLs para cada variable
var urlAOD = gibsBaseURL + wmsParams + '&LAYERS=MODIS_Terra_Aerosol';
var urlNO2 = gibsBaseURL + wmsParams + '&LAYERS=S5P_NO2_Column_Density';
var urlChl = gibsBaseURL + wmsParams + '&LAYERS=COPERNICUS_OCEAN_CHL_L3_NRT_OBS';

print('URL WMS para AOD:', urlAOD);
print('URL WMS para NO₂:', urlNO2);
print('URL WMS para Clorofila:', urlChl);
print('');
print('Copia estas URLs en un navegador para ver mosaicos GIBS prediseñados.');

// ═════════════════════════════════════════════════════════════════════════════
// 12. DOCUMENTACIÓN Y REFERENCIAS
// ═════════════════════════════════════════════════════════════════════════════

print('═══════════════════════════════════════════════════════');
print('📚 Referencias y Documentación');
print('═══════════════════════════════════════════════════════');

print('Colecciones utilizadas:');
print('- AOD: MODIS/061/MCD19A2_GRANULES (MAIAC, 1 km)');
print('- NO₂: COPERNICUS/S5P/NRTI/L3_NO2 (TROPOMI, ~7 km)');
print('- Clorofila: COPERNICUS/MARINE/SATELLITE_OCEAN_COLOR/V6 (~4 km)');
print('- NDWI: MODIS/MCD43A4_006_NDWI (463 m)');
print('');
print('Referencias:');
print('- NASA Worldview: https://worldview.earthdata.nasa.gov/');
print('- GIBS: https://wiki.earthdata.nasa.gov/display/GIBS');
print('- GEE Data Catalog: https://developers.google.com/earth-engine/datasets');
print('');
print('═══════════════════════════════════════════════════════');
print('✅ Script completado exitosamente');
print('═══════════════════════════════════════════════════════');

// Agregar leyenda personalizada al mapa
var legend = ui.Panel({
  style: {
    position: 'bottom-left',
    padding: '8px 15px'
  }
});

var legendTitle = ui.Label({
  value: 'Variables Ambientales',
  style: {
    fontWeight: 'bold',
    fontSize: '16px',
    margin: '0 0 8px 0'
  }
});

legend.add(legendTitle);

var makeRow = function(color, name) {
  var colorBox = ui.Label({
    style: {
      backgroundColor: color,
      padding: '10px',
      margin: '0 8px 0 0'
    }
  });
  
  var description = ui.Label({
    value: name,
    style: {margin: '0 0 4px 0'}
  });
  
  return ui.Panel({
    widgets: [colorBox, description],
    layout: ui.Panel.Layout.Flow('horizontal')
  });
};

legend.add(makeRow('#d7191c', 'AOD Alto (>0.3)'));
legend.add(makeRow('#f39c12', 'NO₂ Alto (>150 μmol/m²)'));
legend.add(makeRow('#27ae60', 'Clorofila Moderada'));
legend.add(makeRow('#3498db', 'NDWI: Agua/Humedad'));

Map.add(legend);
