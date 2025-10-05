/****
═══════════════════════════════════════════════════════════════════════════
GEE • Plataforma temporal para NDVI (vegetación), LST (islas de calor) y filtros SMOD
═══════════════════════════════════════════════════════════════════════════

Autor: EcoPlan Team + Adaptado para Lima, Perú
Versión: 1.0
Fecha: 2025-01-05

Cómo usar:
1) Copia este script completo
2) Pega en https://code.earthengine.google.com/
3) Dibuja un polígono ROI sobre Lima (opcional) y pulsa "Usar ROI del dibujo"
4) Ajusta rango de fechas y "Mes a visualizar"
5) Activa/desactiva filtros por SMOD (grado de urbanización)
6) Revisa series temporales, tabla de eventos de islas de calor y prioridades por distrito

Datasets utilizados:
- NDVI: Sentinel-2 SR (10 m) + Landsat 8/9 L2 (30 m) → compuesto mensual (mediana)
- LST: MODIS MOD11A2 (8 días, ~1 km) Día/Noche; anomalía respecto 2018–2022
- SMOD: GHSL P2023A (100 m) — filtrado por grado de urbanización
- Población: GHSL GHS_POP 2020 (100 m)
- Distritos: Asset personalizado o FAO GAUL nivel 2 (provincias) como fallback

Metodología:
1. Compuesto mensual de NDVI (mediana de Sentinel-2 y Landsat)
2. Compuesto mensual de LST MODIS (media)
3. Climatología LST 2018-2022 por mes
4. Anomalía LST = LST mensual - Climatología
5. Filtro SMOD para análisis urbano/rural
6. Detección de islas de calor (umbral configurable)
7. Índice de prioridad: z(LST_anom) - z(NDVI) + z(sqrt(POP))
8. Exportación de GIFs animados

Límites y consideraciones:
- LST ≠ temperatura del aire (es temperatura superficial)
- Resolución MODIS (1 km) vs Sentinel-2 (10 m) - diferencia de escalas
- Nubes afectan NDVI (usar máscara de nubes)
- Anomalías LST son relativas a la climatología del período base

****/

// ═══════════════════════════════════════════════════════════════════════════
// 0) CONFIGURACIÓN Y UTILIDADES GENERALES
// ═══════════════════════════════════════════════════════════════════════════

// Paletas de colores
var paletteNDVI = ['#9e9e9e', '#d9f0a3', '#78c679', '#238443']; // gris→verde
var paletteDiv = ['#2c7bb6', '#abd9e9', '#ffffbf', '#fdae61', '#d7191c']; // azul→blanco→rojo
var palettePrior = ['#1a9850', '#fee08b', '#d73027']; // verde→amarillo→rojo
var paletteSMOD = ['#edf8fb','#b3cde3','#8c96c6','#8856a7','#810f7c']; // rural→urbano

// Funciones de utilidad
function fmtDate(d) {
  d = ee.Date(d);
  return ee.String(d.format('YYYY-MM'));
}

function rescale(img, min, max) { 
  return img.unitScale(min, max).clamp(0, 1); 
}

function buildMonthlySequence(startDate, endDate) {
  var dates = []; 
  var d = new Date(startDate.getTime()); 
  d.setUTCDate(1);
  while (d <= endDate) { 
    dates.push(new Date(d.getTime())); 
    d.setUTCMonth(d.getUTCMonth()+1);
  } 
  return dates; 
}

// ═══════════════════════════════════════════════════════════════════════════
// 1) COLECCIONES Y MÁSCARAS DE NUBES
// ═══════════════════════════════════════════════════════════════════════════

// Sentinel-2 SR
var S2 = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED');

function maskS2sr(image) { 
  var qa = image.select('QA60'); 
  var mask = qa.bitwiseAnd(1<<10).eq(0).and(qa.bitwiseAnd(1<<11).eq(0)); 
  return image.updateMask(mask);
} 

function ndviS2(image) { 
  var scaled = image.select(['B8','B4']).multiply(0.0001); 
  var ndvi = scaled.normalizedDifference(['B8','B4'])
    .rename('NDVI')
    .copyProperties(image,['system:time_start']); 
  return ndvi; 
}

// Landsat 8/9 L2
var L8 = ee.ImageCollection('LANDSAT/LC08/C02/T1_L2');
var L9 = ee.ImageCollection('LANDSAT/LC09/C02/T1_L2');

function maskLandsatL2(image){ 
  var qa = image.select('QA_PIXEL'); 
  var mask = qa.bitwiseAnd(1<<3).eq(0)
    .and(qa.bitwiseAnd(1<<4).eq(0))
    .and(qa.bitwiseAnd(1<<2).eq(0))
    .and(qa.bitwiseAnd(1<<5).eq(0)); 
  return image.updateMask(mask);
} 

function ndviLandsat(image){ 
  var red = image.select('SR_B4').multiply(0.0000275).add(-0.2); 
  var nir = image.select('SR_B5').multiply(0.0000275).add(-0.2); 
  var ndvi = nir.subtract(red).divide(nir.add(red))
    .rename('NDVI')
    .copyProperties(image,['system:time_start']); 
  return ndvi; 
}

// MODIS LST (8-días, 1 km)
var MODIS = ee.ImageCollection('MODIS/061/MOD11A2');

function lstToC(img, dayNight){ 
  var b = (dayNight === 'Noche') ? 'LST_Night_1km' : 'LST_Day_1km'; 
  var lst = img.select(b).multiply(0.02).subtract(273.15).rename('LST'); 
  return lst.copyProperties(img,['system:time_start']); 
}

// GHSL P2023A (100 m)
var ghsPop2020 = ee.Image('JRC/GHSL/P2023A/GHS_POP/2020').select('population_count');
var ghsBuilt2020 = ee.Image('JRC/GHSL/P2023A/GHS_BUILT_S/2020').select('built_surface');
var ghsSmod2020 = ee.Image('JRC/GHSL/P2023A/GHS_SMOD_V2-0/2020').select('smod_code');

// ═══════════════════════════════════════════════════════════════════════════
// 2) AGREGACIONES TEMPORALES
// ═══════════════════════════════════════════════════════════════════════════

function monthlyComposite(ic, reducer){
  var months = ee.List.sequence(1,12);
  var years = ee.List(ic.aggregate_array('system:time_start')
    .map(function(t){
      return ee.Date(ee.Number(t)).get('year');
    }))
    .distinct();
  
  var byMY = years.map(function(y){
    y = ee.Number(y);
    return months.map(function(m){ 
      var start = ee.Date.fromYMD(y,m,1); 
      var end = start.advance(1,'month'); 
      var img = ic.filterDate(start,end).reduce(reducer); 
      return img.set({
        'system:time_start': start.millis(),
        'year': y,
        'month': m
      });
    });
  }).flatten();
  
  return ee.ImageCollection(byMY)
    .filter(ee.Filter.listContains('system:band_names', 0).not());
}

function makeNDVIMonthly(start, end, maskClouds){
  var s2 = S2.filterDate(start,end).filterBounds(roi); 
  if(maskClouds) s2 = s2.map(maskS2sr); 
  s2 = s2.map(ndviS2);
  
  var ls = L8.merge(L9).filterDate(start,end).filterBounds(roi); 
  if(maskClouds) ls = ls.map(maskLandsatL2); 
  ls = ls.map(ndviLandsat);
  
  var ndviAll = s2.merge(ls); 
  return monthlyComposite(ndviAll, ee.Reducer.median()).select([0],['NDVI']);
}

function makeLSTMonthly(start, end, dayNight){ 
  var coll = MODIS.filterDate(start,end).filterBounds(roi)
    .map(function(img){
      return lstToC(img,dayNight);
    }); 
  return monthlyComposite(coll, ee.Reducer.mean()).select([0],['LST']); 
}

function makeLSTClimatology(dayNight){ 
  var coll = MODIS.filterDate('2018-01-01','2022-12-31').filterBounds(roi)
    .map(function(img){
      return lstToC(img,dayNight);
    }); 
  
  var months = ee.List.sequence(1,12); 
  var clim = ee.ImageCollection(months.map(function(m){
    m = ee.Number(m); 
    var mean = coll.filter(ee.Filter.calendarRange(m,m,'month')).mean()
      .set({'month':m}); 
    return mean.rename('LST');
  })); 
  
  return clim; 
}

function addLSTAnomaly(icMonthly, climMonthly){ 
  return icMonthly.map(function(img){ 
    var m = ee.Number(img.get('month')); 
    var clim = climMonthly.filter(ee.Filter.eq('month',m)).first(); 
    var anom = img.select('LST').subtract(clim.select('LST')).rename('LST_anom'); 
    return img.addBands(anom); 
  }); 
}

// ═══════════════════════════════════════════════════════════════════════════
// 3) INTERFAZ DE USUARIO BASE
// ═══════════════════════════════════════════════════════════════════════════

var control = ui.Panel({style:{width:'380px',padding:'8px'}});
var title = ui.Label('Panel temporal • NDVI & LST (Lima)',{fontWeight:'bold',fontSize:'16px'}); 
control.add(title);

// ROI inicial = pantalla actual
var roi = Map.getBounds(true); 
Map.centerObject(roi,10);

var dt = Map.drawingTools(); 
dt.setShown(true); 
dt.setDrawModes(['polygon']);

var useRoiBtn = ui.Button({
  label:'Usar ROI del dibujo',
  onClick:function(){ 
    if(dt.layers().length()===0) return; 
    var geom = dt.layers().get(0).getEeObject(); 
    if(geom){ 
      roi = geom; 
      Map.centerObject(roi,11); 
      refreshAll(); 
    } 
  }, 
  style:{width:'100%'}
}); 
control.add(useRoiBtn);

// Agregación temporal
var aggSelect = ui.Select({
  items:['Mensual','Trimestral','Anual'], 
  value:'Mensual', 
  onChange:function(){refreshAll();}
}); 
control.add(ui.Label('Agregación temporal')); 
control.add(aggSelect);

// Máscara de nubes
var cloudChk = ui.Checkbox({
  label:'Aplicar máscara de nubes (S2/Landsat)', 
  value:true, 
  onChange:refreshAll
}); 
control.add(cloudChk);

// LST Día/Noche
var lstSelect = ui.Select({
  items:['Día','Noche'], 
  value:'Día', 
  onChange:refreshAll
}); 
control.add(ui.Label('LST (MODIS)')); 
control.add(lstSelect);

// Rango de fechas
var rangeStart = new Date('2019-01-01T00:00:00Z'); 
var rangeEnd = new Date();
var rangeSlider = ui.DateSlider({
  start:rangeStart,
  end:rangeEnd,
  value:[new Date('2020-01-01'), new Date()], 
  period:30, 
  onChange:function(){rebuildMonthIndex();}
});
control.add(ui.Label('Rango de análisis')); 
control.add(rangeSlider);

// Índice de mes dentro del rango
var monthIndex = ui.Slider({
  min:0,
  max:1,
  step:1,
  value:0,
  onChange:function(){
    updateMapForIndex(); 
    buildPriorityTable(); 
  }
});
control.add(ui.Label('Mes a visualizar dentro del rango')); 
control.add(monthIndex);

// ═══════════════════════════════════════════════════════════════════════════
// SMOD: Filtros y Leyenda
// ═══════════════════════════════════════════════════════════════════════════

var smodPanel = ui.Panel();
var smodTitle = ui.Label('Filtro por SMOD (GHSL, grado de urbanización)');
var smodChkUC = ui.Checkbox({label:'Centro urbano (30)', value:true, onChange:updateMapForIndex});
var smodChkTS = ui.Checkbox({label:'Ciudad/Periurbano (21–23)', value:true, onChange:updateMapForIndex});
var smodChkRU = ui.Checkbox({label:'Rural (11–13)', value:true, onChange:updateMapForIndex});

smodPanel.add(smodTitle); 
smodPanel.add(ui.Panel([smodChkUC,smodChkTS,smodChkRU], ui.Panel.Layout.flow('horizontal'))); 
smodPanel.add(ui.Label('Leyenda SMOD (simplificada): Rural → Urbano')); 
smodPanel.add(makeColorBar(paletteSMOD, 10, 30));
control.add(smodPanel);

// Umbral de detección de isla de calor (anomalía LST)
var lstThr = ui.Slider({
  min:-1,
  max:5,
  step:0.1,
  value:2,
  label:'Umbral LST anóm. (°C)'
}); 
lstThr.onChange(function(){ buildHeatIslandsTable(); }); 
control.add(lstThr);

// Botones GIF
var gifPanel = ui.Panel({layout:ui.Panel.Layout.flow('horizontal')});
var gifNDVIbtn = ui.Button('GIF NDVI', function(){ makeGif('NDVI'); });
var gifLSTbtn = ui.Button('GIF LST (anom)', function(){ makeGif('LST_anom'); });
gifPanel.add(gifNDVIbtn); 
gifPanel.add(gifLSTbtn); 
control.add(gifPanel);

// Panel de leyendas
var legend = ui.Panel({style:{margin:'8px 0'}}); 
control.add(legend);

// ═══════════════════════════════════════════════════════════════════════════
// Layout Principal: Mapas Vinculados
// ═══════════════════════════════════════════════════════════════════════════

ui.root.clear();
var leftMap = ui.Map(); 
var rightMap = ui.Map(); 
ui.Map.Linker([leftMap,rightMap]);
var split = ui.SplitPanel({
  firstPanel:leftMap,
  secondPanel:rightMap,
  orientation:'horizontal',
  wipe:true
});
ui.root.add(ui.SplitPanel({
  firstPanel:control,
  secondPanel:split,
  orientation:'horizontal',
  wipe:false
}));

// Panel de charts + tablas (derecha)
var chartsPanel = ui.Panel({style:{width:'420px',padding:'8px'}});
ui.root.add(chartsPanel);

// ═══════════════════════════════════════════════════════════════════════════
// 4) ESTADO Y REFRESCO
// ═══════════════════════════════════════════════════════════════════════════

var monthsListJS = []; 
var ndviMonthlyIC = null; 
var lstMonthlyIC = null;
var currentNdviImg = null;
var currentLstImg = null;
var currentPriorityImg = null;
var currentMonthLabel = null;

// Admin (distritos si el usuario carga asset, o provincias GAUL)
var adminFC = null; 
var adminNameProp = null; 
var adminAssetText = ui.Textbox({
  placeholder:'Asset de distritos (opcional): users/tu_usuario/Lima_Distritos'
});
var loadAdminBtn = ui.Button('Cargar distritos', function(){ 
  loadAdminFromAsset(adminAssetText.getValue()); 
});
control.add(ui.Label('Unidades administrativas')); 
control.add(ui.Panel([adminAssetText, loadAdminBtn], ui.Panel.Layout.flow('horizontal')));

function loadAdminDefault(){
  var gaul2 = ee.FeatureCollection('FAO/GAUL/2015/level2');
  // Filtra Región Lima (ADM1=Lima) y recorta al ROI
  adminFC = gaul2.filter(ee.Filter.eq('ADM1_NAME','Lima')).filterBounds(roi);
  adminNameProp = 'ADM2_NAME'; // provincias (fallback)
}

function loadAdminFromAsset(assetId){
  try{ 
    adminFC = ee.FeatureCollection(assetId).filterBounds(roi); 
  } catch(err){ 
    print('Error cargando asset, usando GAUL nivel 2 (provincias).'); 
    loadAdminDefault(); 
  }
  // Intento de detectar nombre
  adminNameProp = guessNameProp(adminFC);
  refreshAll();
}

function guessNameProp(fc){
  var cand = ['NOMB_DIST','NOMBDIST','NOMBRE','name','NAME','district','DIST_NAME','ADM2_NAME'];
  var props = ee.Feature(fc.first()).propertyNames();
  var found = ee.String('');
  cand.forEach(function(c){ 
    found = ee.Algorithms.If(props.contains(c), ee.String(c), found); 
  });
  return ee.String(found).getInfo() || 'ADM2_NAME';
}

function rebuildMonthIndex(){ 
  var val = rangeSlider.getValue(); 
  var s = val.start(); 
  var e = val.end(); 
  monthsListJS = buildMonthlySequence(s,e); 
  monthIndex.setMin(0); 
  monthIndex.setMax(Math.max(monthsListJS.length-1,0)); 
  monthIndex.setValue(0); 
  refreshAll(); 
}

function refreshAll(){
  if(!adminFC) { loadAdminDefault(); }
  var val = rangeSlider.getValue(); 
  var s = ee.Date(val.start()); 
  var e = ee.Date(val.end());
  var maskClouds = cloudChk.getValue(); 
  var dayNight = lstSelect.getValue();
  
  ndviMonthlyIC = makeNDVIMonthly(s,e,maskClouds);
  var lstMonthly = makeLSTMonthly(s,e,dayNight); 
  var clim = makeLSTClimatology(dayNight); 
  lstMonthlyIC = addLSTAnomaly(lstMonthly,clim);
  
  updateMapForIndex(); 
  buildCharts(); 
  buildLegend(); 
  buildHeatIslandsTable(); 
  buildPriorityTable();
}

function getSMODMask(){
  var uc = smodChkUC.getValue(); 
  var ts = smodChkTS.getValue(); 
  var ru = smodChkRU.getValue();
  var sel = ee.Image(0);
  
  if(ru) sel = sel.or(ghsSmod2020.eq(11)).or(ghsSmod2020.eq(12)).or(ghsSmod2020.eq(13));
  if(ts) sel = sel.or(ghsSmod2020.eq(21)).or(ghsSmod2020.eq(22)).or(ghsSmod2020.eq(23));
  if(uc) sel = sel.or(ghsSmod2020.eq(30));
  
  // Si todo apagado, no enmascarar (para no ver todo vacío)
  var any = uc || ts || ru; 
  return any ? sel.rename('smodMask') : ee.Image(1).rename('smodMask');
}

function updateMapForIndex(){
  leftMap.layers().reset(); 
  rightMap.layers().reset();
  if(!monthsListJS.length) return;
  
  var idx = monthIndex.getValue(); 
  var jsDate = monthsListJS[idx]; 
  var start = ee.Date(jsDate).getRange('month').start(); 
  var label = fmtDate(start); 
  currentMonthLabel = label.getInfo();
  
  var y = ee.Number(ee.Date(jsDate).get('year')); 
  var m = ee.Number(ee.Date(jsDate).get('month'));
  
  var ndviImg = ee.Image(ndviMonthlyIC
    .filter(ee.Filter.and(ee.Filter.eq('year',y), ee.Filter.eq('month',m)))
    .first()); 
  ndviImg = ee.Image(ndviImg).unmask().rename('NDVI');
  
  var lstImg = ee.Image(lstMonthlyIC
    .filter(ee.Filter.and(ee.Filter.eq('year',y), ee.Filter.eq('month',m)))
    .first()); 
  lstImg = ee.Image(lstImg).unmask().rename(['LST','LST_anom']);

  // Filtro SMOD
  var smodMask = getSMODMask().reproject({crs: ghsSmod2020.projection()});
  ndviImg = ndviImg.updateMask(smodMask);
  lstImg = lstImg.updateMask(smodMask);

  // Índice de prioridad
  var priority = rescale(lstImg.select('LST_anom'), -1, 3)
    .subtract(rescale(ndviImg, 0.2, 0.6))
    .rename('PRIOR');

  // Guardar actuales
  currentNdviImg = ndviImg; 
  currentLstImg = lstImg; 
  currentPriorityImg = priority;

  var visNDVI = {min:0.0, max:0.8, palette:paletteNDVI};
  var visAnom = {min:-2.5, max:3.5, palette:paletteDiv};
  var visPrior = {min:-1, max:1, palette:palettePrior};

  leftMap.addLayer(ndviImg, visNDVI, 'NDVI '+currentMonthLabel);
  leftMap.addLayer(priority, visPrior, 'Prioridad (LST anom − NDVI) '+currentMonthLabel, false);
  
  rightMap.addLayer(lstImg.select('LST_anom'), visAnom, 'LST anóm. °C '+currentMonthLabel);
  rightMap.addLayer(lstImg.select('LST'), {
    min:15,
    max:40,
    palette:['#313695','#74add1','#ffffbf','#f46d43','#a50026']
  }, 'LST °C '+currentMonthLabel, false);

  leftMap.centerObject(roi,10); 
  rightMap.centerObject(roi,10);
}

function buildLegend(){
  legend.clear();
  legend.add(ui.Label('Leyenda NDVI')); 
  legend.add(makeColorBar(paletteNDVI, 0, 0.8));
  legend.add(ui.Label('Leyenda LST anóm. (°C)')); 
  legend.add(makeColorBar(paletteDiv, -2.5, 3.5));
}

function makeColorBar(palette,min,max){
  var colorBar = ui.Thumbnail({
    image: ee.Image.pixelLonLat().select(0), 
    params:{
      bbox:[0,0,1,0.1],
      dimensions:'256x20',
      format:'png',
      min:0,
      max:1,
      palette:palette
    }, 
    style:{stretch:'horizontal',margin:'0px 8px',maxHeight:'24px'}
  });
  
  var labels = ui.Panel({layout:ui.Panel.Layout.flow('horizontal')}); 
  labels.add(ui.Label(min)); 
  labels.add(ui.Label({
    value:(min+max)/2,
    style:{textAlign:'center',stretch:'horizontal'}
  })); 
  labels.add(ui.Label(max)); 
  
  return ui.Panel([colorBar,labels]);
}

// ═══════════════════════════════════════════════════════════════════════════
// 5) CHARTS - Series Temporales
// ═══════════════════════════════════════════════════════════════════════════

function buildCharts(){
  chartsPanel.clear(); 
  chartsPanel.add(ui.Label('Series temporales (ROI)', {fontWeight:'bold'}));
  
  var ndvi = ndviMonthlyIC; 
  var lst = lstMonthlyIC;
  
  var chartNDVI = ui.Chart.image.series({
    imageCollection: ndvi.select('NDVI'), 
    region: roi, 
    reducer: ee.Reducer.mean(), 
    scale: 30, 
    xProperty:'system:time_start'
  }).setOptions({
    title:'NDVI (promedio ROI)', 
    vAxis:{title:'NDVI'}, 
    hAxis:{title:'Fecha'}, 
    legend:'none'
  });
  
  var chartLSTa = ui.Chart.image.series({
    imageCollection: lst.select('LST_anom'), 
    region: roi, 
    reducer: ee.Reducer.mean(), 
    scale: 1000, 
    xProperty:'system:time_start'
  }).setOptions({
    title:'LST anomalía (°C) prom. ROI', 
    vAxis:{title:'°C'}, 
    hAxis:{title:'Fecha'}, 
    legend:'none'
  });
  
  chartsPanel.add(chartNDVI); 
  chartsPanel.add(chartLSTa);
}

// ═══════════════════════════════════════════════════════════════════════════
// 6) TABLAS: Eventos de Calor y Prioridades por Distrito
// ═══════════════════════════════════════════════════════════════════════════

function buildHeatIslandsTable(){
  // Tabla: (Fecha, Hora aprox., Área administrativa, LST_anom media)
  if(!adminFC) return;
  
  var thr = lstThr.getValue();
  var periodStr = lstSelect.getValue(); // 'Día' o 'Noche'
  var adfc = adminFC.filterBounds(roi);
  var monthsList = ee.ImageCollection(lstMonthlyIC);
  
  var fc = monthsList.map(function(img){
    var date = ee.Date(img.get('system:time_start'));
    var anom = ee.Image(img).select('LST_anom');
    var rr = anom.reduceRegions({
      collection: adfc, 
      reducer: ee.Reducer.mean(), 
      scale: 1000
    });
    rr = rr.filter(ee.Filter.greaterThan('mean', thr));
    rr = rr.map(function(f){
      var name = ee.Algorithms.If(
        f.propertyNames().contains(adminNameProp), 
        f.get(adminNameProp), 
        f.get('ADM2_NAME')
      );
      return f.set({
        'Fecha': date.format('YYYY-MM'),
        'Hora (aprox.)': (periodStr==='Día') ? '10:30 LT (Terra, día)' : '22:30 LT (Terra, noche)',
        'Área administrativa': name,
        'LST_anom (°C)': f.get('mean')
      });
    });
    return rr;
  }).flatten();

  var table = ui.Chart.feature.byFeature(
    fc, 
    ['Fecha','Hora (aprox.)','Área administrativa','LST_anom (°C)']
  )
    .setChartType('Table')
    .setOptions({
      title: 'Eventos de islas de calor detectadas (anomalía > '+thr+' °C)'
    });

  chartsPanel.add(ui.Label(
    'Eventos de islas de calor (rango seleccionado)', 
    {fontWeight:'bold', margin:'12px 0 4px 0'}
  ));
  chartsPanel.add(table);
}

function buildPriorityTable(){
  if(!adminFC || !currentPriorityImg) return;
  
  var adfc = adminFC.filterBounds(roi);
  var stack = currentPriorityImg
    .addBands(currentNdviImg)
    .addBands(currentLstImg.select('LST_anom'));
  stack = stack.rename(['PRIOR','NDVI','LST_anom']);
  
  var means = stack.reduceRegions({
    collection: adfc, 
    reducer: ee.Reducer.mean().repeat(3).withOutputs(['PRIOR_mean','NDVI_mean','LSTa_mean']), 
    scale: 250
  });
  
  // Añadir población (suma)
  means = means.map(function(f){
    var pop = ghsPop2020.reduceRegion({
      reducer: ee.Reducer.sum(), 
      geometry: f.geometry(), 
      scale: 100, 
      maxPixels: 1e8
    });
    return f.set({'POP_sum': pop.get('population_count')});
  });
  
  // Nombre admin robusto
  means = means.map(function(f){ 
    var name = ee.Algorithms.If(
      f.propertyNames().contains(adminNameProp), 
      f.get(adminNameProp), 
      f.get('ADM2_NAME')
    ); 
    return f.set({'Nombre': name}); 
  });

  var sorted = ee.FeatureCollection(means).sort('PRIOR_mean', false);
  var table = ui.Chart.feature.byFeature(
    sorted, 
    ['Nombre','PRIOR_mean','NDVI_mean','LSTa_mean','POP_sum']
  )
    .setChartType('Table')
    .setOptions({
      title: 'Prioridades por distrito/provincia — '+ currentMonthLabel, 
      allowHtml:true
    });

  chartsPanel.add(ui.Label(
    'Tabla de prioridades por distrito/provincia (mes actual)', 
    {fontWeight:'bold', margin:'12px 0 4px 0'}
  ));
  chartsPanel.add(table);
}

// ═══════════════════════════════════════════════════════════════════════════
// 7) GIFs (Thumbnail Animado)
// ═══════════════════════════════════════════════════════════════════════════

function makeGif(which){
  var ic, vis, label;
  
  if(which==='NDVI'){ 
    ic = ndviMonthlyIC.select('NDVI'); 
    vis = {min:0.0, max:0.8, palette:paletteNDVI}; 
    label = 'NDVI'; 
  } else { 
    ic = lstMonthlyIC.select('LST_anom'); 
    vis = {min:-2.5, max:3.5, palette:paletteDiv}; 
    label = 'LST_anom'; 
  }
  
  var videoArgs = {
    region:roi, 
    dimensions:800, 
    framesPerSecond:2, 
    crs:'EPSG:3857', 
    min:vis.min, 
    max:vis.max, 
    palette:vis.palette
  };
  
  var thumb = ui.Thumbnail(ic, videoArgs); 
  chartsPanel.add(ui.Label('Animación '+label+' (previsualización)')); 
  chartsPanel.add(thumb);
}

// ═══════════════════════════════════════════════════════════════════════════
// 8) INICIALIZACIÓN
// ═══════════════════════════════════════════════════════════════════════════

rebuildMonthIndex();

print('═══════════════════════════════════════════════════════════════════');
print('🌍 EcoPlan - Vegetación e Islas de Calor Urbano');
print('═══════════════════════════════════════════════════════════════════');
print('');
print('✅ Aplicación cargada correctamente');
print('');
print('📍 Instrucciones:');
print('1. Dibuja un ROI sobre Lima o usa el ROI actual');
print('2. Ajusta rango de fechas (por defecto: 2020-01-01 hasta hoy)');
print('3. Selecciona mes a visualizar con el slider');
print('4. Activa/desactiva filtros SMOD (urbano/periurbano/rural)');
print('5. Define umbral de isla de calor (por defecto: 2°C)');
print('6. Revisa mapas, series temporales y tablas');
print('7. Genera GIFs animados (NDVI o LST anomalía)');
print('');
print('📊 Datasets utilizados:');
print('  - NDVI: Sentinel-2 SR + Landsat 8/9 L2');
print('  - LST: MODIS MOD11A2 (8 días, 1 km)');
print('  - SMOD: GHSL P2023A (100 m)');
print('  - Población: GHSL GHS_POP 2020');
print('  - Admin: FAO GAUL nivel 2 (o asset personalizado)');
print('');
print('🎯 Índice de Prioridad = z(LST_anom) - z(NDVI) + z(sqrt(POP))');
print('');
print('═══════════════════════════════════════════════════════════════════');

// FIN DEL SCRIPT
