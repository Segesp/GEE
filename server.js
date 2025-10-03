const express = require('express');
const ee = require('@google/earthengine');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Earth Engine authentication and initialization
let eeInitialized = false;

async function initializeEarthEngine() {
  try {
    const serviceAccountPath = process.env.GOOGLE_SERVICE_ACCOUNT_PATH || './service-account.json';
    const serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    
    // Check if service account file exists
    const fs = require('fs');
    let serviceAccount;

    if (serviceAccountJson) {
      try {
        serviceAccount = JSON.parse(serviceAccountJson);
        console.log('Using service account credentials from environment variable.');
      } catch (parseError) {
        console.error('Failed to parse GOOGLE_SERVICE_ACCOUNT_JSON environment variable.');
        throw parseError;
      }
    } else {
      if (!fs.existsSync(serviceAccountPath)) {
        console.warn('Service account JSON file not found. Please add your service account credentials.');
        console.warn('Copy your service account JSON file to:', serviceAccountPath);
        console.warn('Alternatively, set GOOGLE_SERVICE_ACCOUNT_JSON with the raw JSON string.');
        return false;
      }

      const fileContents = fs.readFileSync(path.resolve(serviceAccountPath), 'utf8');
      serviceAccount = JSON.parse(fileContents);
    }
    
    // Authenticate with service account
    await ee.data.authenticateViaPrivateKey(serviceAccount);
    
    // Initialize the Earth Engine library
    await ee.initialize(null, null, () => {
      console.log('Earth Engine initialized successfully');
      eeInitialized = true;
    }, (error) => {
      console.error('Error initializing Earth Engine:', error);
      eeInitialized = false;
    });
    
    return true;
  } catch (error) {
    console.error('Failed to initialize Earth Engine:', error);
    return false;
  }
}

// Helper function to get default dataset (Landsat 8 composite)
function getDefaultDataset() {
  return ee.ImageCollection('LANDSAT/LC08/C02/T1_TOA')
    .filterDate('2022-01-01', '2023-01-01')
    .median()
    .visualize({
      bands: ['B4', 'B3', 'B2'],
      min: 0,
      max: 0.3,
      gamma: 1.4
    });
}

// Presets de áreas de interés para Lima, Perú
const BLOOM_ROI_PRESETS = {
  costa_metropolitana: {
    geometry: {
      type: 'Polygon',
      coordinates: [[
        [-77.35, -12.45],
        [-76.95, -12.45],
        [-76.95, -11.65],
        [-77.35, -11.65],
        [-77.35, -12.45]
      ]]
    }
  },
  ancon: {
    geometry: {
      type: 'Polygon',
      coordinates: [[
        [-77.19, -11.87],
        [-77.08, -11.87],
        [-77.08, -11.70],
        [-77.19, -11.70],
        [-77.19, -11.87]
      ]]
    }
  },
  pantanos: {
    geometry: {
      type: 'Point',
      coordinates: [-76.999, -12.22]
    },
    buffer: 1500
  }
};

const BLOOM_ROI_META = {
  costa_metropolitana: { label: 'Costa Metropolitana de Lima', type: 'mar', defaultZoom: 11, bufferMeters: 400 },
  ancon: { label: 'Bahía de Ancón', type: 'mar', defaultZoom: 12, bufferMeters: 200 },
  pantanos: { label: 'Pantanos de Villa', type: 'humedal', defaultZoom: 13, bufferMeters: -200 }
};

function getPresetList() {
  return Object.entries(BLOOM_ROI_PRESETS).map(([key, preset]) => ({
    id: key,
    label: BLOOM_ROI_META[key]?.label || key,
    type: BLOOM_ROI_META[key]?.type || 'mar',
    geometry: preset.geometry,
    defaultBuffer: BLOOM_ROI_META[key]?.bufferMeters || preset.buffer || 0
  }));
}

function applyBufferToGeometry(geometry, meters = 0) {
  if (!meters || meters === 0) {
    return geometry;
  }
  return geometry.buffer(meters);
}

function parseGeometry(input) {
  if (!input) {
    return null;
  }
  try {
    return ee.Geometry(input);
  } catch (error) {
    console.error('Invalid geometry payload', error);
    return null;
  }
}

function getRoiFromRequest({ preset = 'costa_metropolitana', geometry, buffer }) {
  const presetKey = preset in BLOOM_ROI_PRESETS ? preset : 'custom';
  if (presetKey === 'custom') {
    const customGeom = parseGeometry(geometry);
    if (!customGeom) {
      throw new Error('Custom geometry is required when preset is custom');
    }
    const bufferMeters = typeof buffer === 'number' ? buffer : 0;
    return {
      roi: applyBufferToGeometry(customGeom, bufferMeters),
      meta: { label: 'Custom ROI', type: 'mar', defaultZoom: 11, bufferMeters }
    };
  }

  const presetDef = BLOOM_ROI_PRESETS[presetKey];
  let baseGeom = ee.Geometry(presetDef.geometry);
  if (presetDef.geometry.type === 'Point') {
    baseGeom = baseGeom.buffer(presetDef.buffer || 0);
  }
  const meta = BLOOM_ROI_META[presetKey] || { type: 'mar', defaultZoom: 11, bufferMeters: 0 };
  const bufferMeters = typeof buffer === 'number' ? buffer : meta.bufferMeters || 0;
  return {
    roi: applyBufferToGeometry(baseGeom, bufferMeters),
    meta: { ...meta, bufferMeters }
  };
}

function evaluateEeObject(eeObject) {
  return new Promise((resolve, reject) => {
    eeObject.evaluate((result, error) => {
      if (error) {
        reject(error);
      } else {
        resolve(result);
      }
    });
  });
}

function normalizeMapInfo(info) {
  if (!info) {
    return null;
  }

  const sanitized = {};
  Object.entries(info).forEach(([key, value]) => {
    if (typeof value !== 'function') {
      sanitized[key] = value;
    }
  });

  const rawMapId = sanitized.mapid || sanitized.mapId || sanitized.mapID || null;
  const token = sanitized.token || sanitized.accessToken || null;
  const hasPath = typeof rawMapId === 'string' && rawMapId.includes('/');
  const projectPath = hasPath ? rawMapId : rawMapId ? `projects/earthengine-legacy/maps/${rawMapId}` : null;
  const legacyId = hasPath && rawMapId.includes('/maps/') ? rawMapId.split('/maps/')[1] : rawMapId;

  const candidateUrl = sanitized.tileUrl
    || sanitized.tile_fetch_url
    || sanitized.tileFetchUrl
    || sanitized.urlFormat
    || sanitized.url
    || null;

  const legacyTemplate = legacyId
    ? `https://earthengine.googleapis.com/map/${legacyId}/{z}/{x}/{y}${token ? `?token=${token}` : ''}`
    : null;

  const v1Template = projectPath
    ? `https://earthengine.googleapis.com/v1/${projectPath}/tiles/{z}/{x}/{y}`
    : null;

  const tileUrl = candidateUrl || (token && legacyTemplate) || v1Template || legacyTemplate;

  return {
    ...sanitized,
    mapid: rawMapId,
    token,
    legacyMapId: legacyId,
    tileUrl,
    urlFormat: candidateUrl || v1Template || legacyTemplate,
    legacyTileUrl: legacyTemplate,
    v1TileUrl: v1Template,
    requiresToken: Boolean(token)
  };
}

function getMapFromImage(image, visParams = {}) {
  return new Promise((resolve, reject) => {
    image.getMap(visParams, (info, error) => {
      if (error) {
        reject(error);
      } else {
        resolve(normalizeMapInfo(info));
      }
    });
  });
}

function maskSentinel2(image) {
  const scl = image.select('SCL');
  const cloudShadow = scl.eq(3);
  const clouds = scl.eq(8).or(scl.eq(9)).or(scl.eq(10));
  const snow = scl.eq(11);
  const cirrus = scl.eq(7);
  const bad = cloudShadow.or(clouds).or(snow).or(cirrus);
  return image.updateMask(bad.not());
}

function addWaterMask(image, roiType = 'mar') {
  const ndwi = image.normalizedDifference(['B3', 'B8']).rename('NDWI');
  const water = ndwi.gt(0.1).or(image.select('SCL').eq(6));

  if (roiType === 'humedal') {
    const ndvi = image.normalizedDifference(['B8', 'B4']);
    return image.addBands(
      water.and(ndvi.lt(0.3)).rename('waterMask')
    );
  }

  return image.addBands(water.rename('waterMask'));
}

function addAlgaeBands(image) {
  const scale = ee.Number(0.0001);
  const red = image.select('B4').multiply(scale);
  const redEdge = image.select('B5').multiply(scale);
  const nir = image.select('B8').multiply(scale);
  const nirAlt = image.select('B8A').multiply(scale);
  const swir1 = image.select('B11').multiply(scale);

  const ndci = redEdge.subtract(red).divide(redEdge.add(red)).rename('NDCI');

  const wlRed = 665;
  const wlNir = 842;
  const wlSwir = 1610;
  const baseline = red.add(
    swir1.subtract(red).multiply(
      ee.Number(wlNir - wlRed).divide(wlSwir - wlRed)
    )
  );
  const fai = nir.subtract(baseline).rename('FAI');
  const faiAlt = nirAlt.subtract(baseline).rename('FAI_B8A');

  return image.addBands([ndci, fai, faiAlt]);
}

function cleanMask(mask, minPixels = 12) {
  const connected = mask.selfMask().connectedPixelCount(100, true);
  return mask.updateMask(connected.gte(minPixels));
}

function applyBloomThresholds(image, thresholds, minPixelsClean) {
  const ndci = image.select('NDCI');
  const fai = image.select('FAI');
  const faiAlt = image.select('FAI_B8A');
  const waterMask = image.select('waterMask');

  const bloomRaw = ndci.gt(thresholds.ndci)
    .or(fai.gt(thresholds.fai))
    .or(faiAlt.gt(thresholds.faiAlt));

  const bloomClean = cleanMask(bloomRaw, minPixelsClean).rename('Bloom');
  return image.addBands(bloomClean.updateMask(waterMask));
}

async function buildBloomCollection(options) {
  const {
    preset = 'costa_metropolitana',
    geometry,
    buffer,
    start = '2024-10-01',
    end = '2025-10-02',
    cloudPercentage = 35,
    ndciThreshold = 0.1,
    faiThreshold = 0.005,
    adaptiveThreshold = true,
    roiType: roiTypeOverride,
    minPixelsClean = 12
  } = options || {};

  const { roi, meta } = getRoiFromRequest({ preset, geometry, buffer });
  const roiType = roiTypeOverride || meta.type || 'mar';

  const collection = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
    .filterBounds(roi)
    .filterDate(start, end)
    .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', cloudPercentage))
    .map(maskSentinel2)
    .map(addAlgaeBands)
    .map((image) => addWaterMask(image, roiType))
    .map((image) => image.updateMask(image.select('waterMask')));

  const compositeMedian = collection.median();
  const compositeP85 = collection.reduce(ee.Reducer.percentile([85]));

  let thresholds = {
    ndci: ee.Number(ndciThreshold),
    fai: ee.Number(faiThreshold),
    faiAlt: ee.Number(faiThreshold).multiply(0.6)
  };

  if (adaptiveThreshold) {
    const stats = compositeMedian.select(['NDCI', 'FAI', 'FAI_B8A']).reduceRegion({
      reducer: ee.Reducer.percentile([70, 85, 90, 95]),
      geometry: roi,
      scale: 20,
      maxPixels: 1e11,
      bestEffort: true
    });

    thresholds = {
      ndci: ee.Number(stats.get('NDCI_p85')).max(ndciThreshold),
      fai: ee.Number(stats.get('FAI_p90')).max(faiThreshold),
      faiAlt: ee.Number(stats.get('FAI_B8A_p90')).max(ee.Number(faiThreshold).multiply(0.5))
    };
  }

  const flaggedCollection = collection.map((image) =>
    applyBloomThresholds(image, thresholds, minPixelsClean)
  );

  const bloomMask = flaggedCollection.select('Bloom').max();
  const pixelArea = ee.Image.pixelArea().divide(1e6);

  const areaSeries = ee.FeatureCollection(flaggedCollection.map((image) => {
    const areaKm2 = image.select('Bloom').selfMask().multiply(pixelArea).reduceRegion({
      reducer: ee.Reducer.sum(),
      geometry: roi,
      scale: 20,
      maxPixels: 1e11,
      bestEffort: true
    }).get('Bloom');

    return ee.Feature(null, {
      date: image.date().format('YYYY-MM-dd'),
      area_km2: areaKm2
    });
  }));

  const thresholdsEvaluated = await evaluateEeObject(ee.Dictionary({
    ndci: thresholds.ndci,
    fai: thresholds.fai,
    faiAlt: thresholds.faiAlt
  }));

  return {
    roi,
    meta,
    collection: flaggedCollection,
    compositeMedian,
    compositeP85,
    bloomMask,
    thresholds,
    thresholdsEvaluated,
    areaSeries,
    pixelArea
  };
}

function createTimeSeries(collection, bandName, geometry, scale, propertyName) {
  return ee.FeatureCollection(collection.map((image) => {
    const value = image.select(bandName).reduceRegion({
      reducer: ee.Reducer.mean(),
      geometry,
      scale,
      maxPixels: 1e13,
      bestEffort: true
    }).get(bandName, null);

    return ee.Feature(null, {
      date: image.date().format('YYYY-MM-dd'),
      [propertyName]: value
    });
  })).filter(ee.Filter.notNull([propertyName]));
}

async function buildRegionalContext(options) {
  const {
    preset = 'costa_metropolitana',
    geometry,
    buffer,
    start = '2024-10-01',
    end = '2025-10-02',
    contextBuffer = 5000,
    chlorScale = 4000,
    sstScale = 25000,
    chlorDataset = 'NASA/OCEANDATA/MODIS-Aqua/L3SMI',
    sstDataset = 'NOAA/CDR/OISST/V2_1'
  } = options || {};

  const { roi, meta } = getRoiFromRequest({ preset, geometry, buffer });
  const contextGeom = roi.buffer(contextBuffer);

  const chlorCollection = ee.ImageCollection(chlorDataset)
    .select('chlor_a')
    .filterDate(start, end)
    .filterBounds(contextGeom)
    .map((image) => image.updateMask(image.gt(0)));

  const sstCollection = ee.ImageCollection(sstDataset)
    .select('sst')
    .filterDate(start, end)
    .filterBounds(contextGeom);

  const chlorMeanImage = chlorCollection.mean();
  const chlorMaxImage = chlorCollection.max();
  const chlorMinImage = chlorCollection.min();

  const sstMeanImage = sstCollection.mean();
  const sstMaxImage = sstCollection.max();
  const sstMinImage = sstCollection.min();

  const chlorSeries = createTimeSeries(chlorCollection, 'chlor_a', contextGeom, chlorScale, 'chlor_a');
  const sstSeries = createTimeSeries(sstCollection, 'sst', contextGeom, sstScale, 'sst');

  const safeReduce = (image, bandName, reducer, scale) => {
    const stats = ee.Dictionary(image.reduceRegion({
      reducer,
      geometry: contextGeom,
      scale,
      maxPixels: 1e13,
      bestEffort: true
    }));

    return ee.Algorithms.If(
      stats.contains(bandName),
      stats.get(bandName),
      null
    );
  };

  const [
    chlorLayer,
    sstLayer,
    chlorSeriesData,
    sstSeriesData,
    summaryValues,
    contextGeoJson
  ] = await Promise.all([
    getMapFromImage(chlorMeanImage, {
      min: 0,
      max: 10,
      palette: ['0d0887', '7e03a8', 'cc4778', 'f89540', 'f0f921']
    }),
    getMapFromImage(sstMeanImage, {
      min: 15,
      max: 30,
      palette: ['0021ff', '0ba9ff', '74ffdc', 'f9fd6c', 'ff5e3a']
    }),
    evaluateEeObject(chlorSeries),
    evaluateEeObject(sstSeries),
    evaluateEeObject(ee.Dictionary({
      chlor_mean: safeReduce(chlorMeanImage, 'chlor_a', ee.Reducer.mean(), chlorScale),
      chlor_max: safeReduce(chlorMaxImage, 'chlor_a', ee.Reducer.max(), chlorScale),
      chlor_min: safeReduce(chlorMinImage, 'chlor_a', ee.Reducer.min(), chlorScale),
      sst_mean: safeReduce(sstMeanImage, 'sst', ee.Reducer.mean(), sstScale),
      sst_max: safeReduce(sstMaxImage, 'sst', ee.Reducer.max(), sstScale),
      sst_min: safeReduce(sstMinImage, 'sst', ee.Reducer.min(), sstScale)
    })),
    evaluateEeObject(contextGeom)
  ]);

  return {
    meta,
    contextGeometry: contextGeoJson,
    layers: {
      chlorophyll: {
        ...chlorLayer,
        name: 'MODIS Chlorophyll-a'
      },
      sst: {
        ...sstLayer,
        name: 'OISST Sea Surface Temp'
      }
    },
    series: {
      chlorophyll: chlorSeriesData?.features || [],
      sst: sstSeriesData?.features || []
    },
    summary: summaryValues
  };
}

// Routes

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    earthEngineInitialized: eeInitialized,
    timestamp: new Date().toISOString()
  });
});

// Get map tiles endpoint - XYZ format
app.get('/api/tiles/:z/:x/:y', async (req, res) => {
  if (!eeInitialized) {
    return res.status(503).json({ 
      error: 'Earth Engine not initialized',
      message: 'Please ensure service account credentials are properly configured'
    });
  }

  try {
    const { z, x, y } = req.params;
    
    // Get the default dataset or use query parameters to customize
    const image = getDefaultDataset();
    
    // Get map information and tile URL from Earth Engine
    const mapInfo = await new Promise((resolve, reject) => {
      image.getMap({}, (result, err) => {
        if (err) {
          reject(err);
        } else {
          resolve(result);
        }
      });
    });

    const tileUrl = ee.data.getTileUrl(
      mapInfo,
      parseInt(x, 10),
      parseInt(y, 10),
      parseInt(z, 10)
    );

    // Redirect to the Earth Engine tile URL
    res.redirect(tileUrl);
    
  } catch (error) {
    console.error('Error generating tile:', error);
    res.status(500).json({ 
      error: 'Failed to generate tile',
      message: error.message 
    });
  }
});

// Get map visualization parameters endpoint
app.get('/api/map/info', async (req, res) => {
  if (!eeInitialized) {
    return res.status(503).json({ 
      error: 'Earth Engine not initialized' 
    });
  }

  try {
    const image = getDefaultDataset();
    const mapInfo = await getMapFromImage(image, {});

    res.json({
      mapId: mapInfo?.mapid,
      token: mapInfo?.token,
      tileUrl: mapInfo?.tileUrl,
      tileFormat: 'xyz',
      baseUrl: `${req.protocol}://${req.get('host')}/api/tiles`,
      templateUrl: `${req.protocol}://${req.get('host')}/api/tiles/{z}/{x}/{y}`,
      description: 'Landsat 8 True Color Composite (2022)'
    });
    
  } catch (error) {
    console.error('Error getting map info:', error);
    res.status(500).json({ 
      error: 'Failed to get map info',
      message: error.message 
    });
  }
});

// Obtener presets de ROI disponibles
app.get('/api/bloom/presets', (req, res) => {
  res.json({
    presets: getPresetList()
  });
});

// Obtener capas de mapa para detección de bloom
app.post('/api/bloom/map', async (req, res) => {
  if (!eeInitialized) {
    return res.status(503).json({
      error: 'Earth Engine not initialized'
    });
  }

  try {
    const options = req.body || {};

    const bloomData = await buildBloomCollection(options);

    const [bloomMap, ndciMap, faiMap, trueColorMap] = await Promise.all([
      getMapFromImage(bloomData.bloomMask, { palette: ['#ff00ff'], min: 0, max: 1 }),
      getMapFromImage(bloomData.compositeMedian.select('NDCI'), { min: -0.3, max: 0.5, palette: ['0015ff','00fff7','fff600','ff2a00'] }),
      getMapFromImage(bloomData.compositeMedian.select('FAI'), { min: -0.03, max: 0.03, palette: ['0000ff','ffffff','ff0000'] }),
      getMapFromImage(bloomData.compositeMedian.select(['B4','B3','B2']), { min: 0.03, max: 0.3 })
    ]);

    const roiGeoJson = await evaluateEeObject(bloomData.roi);

    res.json({
      presetMeta: bloomData.meta,
      thresholds: bloomData.thresholdsEvaluated,
      layers: {
        bloom: {
          ...bloomMap,
          name: 'Bloom Mask',
          palette: ['#ff00ff']
        },
        ndci: {
          ...ndciMap,
          name: 'NDCI Median',
          palette: ['0015ff','00fff7','fff600','ff2a00'],
          min: -0.3,
          max: 0.5
        },
        fai: {
          ...faiMap,
          name: 'FAI Median',
          palette: ['0000ff','ffffff','ff0000'],
          min: -0.03,
          max: 0.03
        },
        trueColor: {
          ...trueColorMap,
          name: 'True Color'
        }
      },
      roi: roiGeoJson,
      request: {
        ...options
      }
    });
  } catch (error) {
    console.error('Error generating bloom map:', error);
    res.status(500).json({
      error: 'Failed to generate bloom layers',
      message: error.message
    });
  }
});

// Obtener estadísticas temporales de bloom
app.post('/api/bloom/stats', async (req, res) => {
  if (!eeInitialized) {
    return res.status(503).json({
      error: 'Earth Engine not initialized'
    });
  }

  try {
    const options = req.body || {};
    const bloomData = await buildBloomCollection(options);

    const areaSeries = await evaluateEeObject(bloomData.areaSeries);

    res.json({
      presetMeta: bloomData.meta,
      thresholds: bloomData.thresholdsEvaluated,
      areaSeries,
      request: options
    });
  } catch (error) {
    console.error('Error generating bloom stats:', error);
    res.status(500).json({
      error: 'Failed to generate bloom statistics',
      message: error.message
    });
  }
});

// Obtener contexto regional (clorofila/SST) alrededor del ROI
app.post('/api/bloom/context', async (req, res) => {
  if (!eeInitialized) {
    return res.status(503).json({
      error: 'Earth Engine not initialized'
    });
  }

  try {
    const options = req.body || {};
    const contextData = await buildRegionalContext(options);
    res.json({
      presetMeta: contextData.meta,
      summary: contextData.summary,
      series: contextData.series,
      layers: contextData.layers,
      contextGeometry: contextData.contextGeometry,
      request: options
    });
  } catch (error) {
    console.error('Error generating regional context:', error);
    res.status(500).json({
      error: 'Failed to generate regional context',
      message: error.message
    });
  }
});

// Obtener capas de contexto regional (MODIS / SST)
// Custom dataset endpoint with visualization parameters
app.post('/api/map/custom', async (req, res) => {
  if (!eeInitialized) {
    return res.status(503).json({ 
      error: 'Earth Engine not initialized' 
    });
  }

  try {
    const { 
      collection = 'LANDSAT/LC08/C02/T1_TOA',
      dateStart = '2022-01-01',
      dateEnd = '2023-01-01',
      bands = ['B4', 'B3', 'B2'],
      min = 0,
      max = 0.3,
      gamma = 1.4
    } = req.body;

    const image = ee.ImageCollection(collection)
      .filterDate(dateStart, dateEnd)
      .median()
      .visualize({
        bands: bands,
        min: min,
        max: max,
        gamma: gamma
      });

    const mapInfo = await getMapFromImage(image, {});

    res.json({
      mapId: mapInfo?.mapid,
      token: mapInfo?.token,
      tileUrl: mapInfo?.tileUrl,
      templateUrl: mapInfo?.tileUrl,
      configuration: {
        collection,
        dateStart,
        dateEnd,
        bands,
        min,
        max,
        gamma
      }
    });
    
  } catch (error) {
    console.error('Error creating custom map:', error);
    res.status(500).json({ 
      error: 'Failed to create custom map',
      message: error.message 
    });
  }
});

// Optional: Export to Google Cloud Storage endpoint
app.post('/api/export/gcs', async (req, res) => {
  if (!eeInitialized) {
    return res.status(503).json({ 
      error: 'Earth Engine not initialized' 
    });
  }

  try {
    const { 
      collection = 'LANDSAT/LC08/C02/T1_TOA',
      dateStart = '2022-01-01',
      dateEnd = '2023-01-01',
      bands = ['B4', 'B3', 'B2'],
      region = null, // GeoJSON geometry
      scale = 30,
      description = 'GEE_Export',
      bucketName = process.env.GCS_BUCKET_NAME
    } = req.body;

    if (!bucketName) {
      return res.status(400).json({
        error: 'GCS bucket name not configured',
        message: 'Please set GCS_BUCKET_NAME in your environment variables'
      });
    }

    // Create the image
    let image = ee.ImageCollection(collection)
      .filterDate(dateStart, dateEnd)
      .median()
      .select(bands);

    // Define export region (default to a small area if not provided)
    let exportRegion = region;
    if (!exportRegion) {
      // Default to San Francisco Bay Area
      exportRegion = ee.Geometry.Rectangle([-122.5, 37.4, -122.3, 37.8]);
    } else {
      exportRegion = ee.Geometry(region);
    }

    // Start the export task
    const exportTask = ee.batch.Export.image.toCloudStorage({
      image: image,
      description: description,
      bucket: bucketName,
      fileNamePrefix: `gee-export/${description}`,
      region: exportRegion,
      scale: scale,
      maxPixels: 1e9,
      fileFormat: 'GeoTIFF'
    });

    // Start the task
    exportTask.start();

    res.json({
      success: true,
      taskId: exportTask.id || 'unknown',
      description: description,
      bucket: bucketName,
      message: 'Export task started successfully',
      parameters: {
        collection,
        dateStart,
        dateEnd,
        bands,
        scale,
        region: exportRegion.getInfo()
      }
    });
    
  } catch (error) {
    console.error('Error starting export:', error);
    res.status(500).json({ 
      error: 'Failed to start export',
      message: error.message 
    });
  }
});

// Get export task status
app.get('/api/export/status/:taskId', async (req, res) => {
  if (!eeInitialized) {
    return res.status(503).json({ 
      error: 'Earth Engine not initialized' 
    });
  }

  try {
    const { taskId } = req.params;
    
    // Note: This is a simplified implementation
    // In a real application, you would track tasks in a database
    res.json({
      taskId: taskId,
      status: 'unknown',
      message: 'Task status tracking not fully implemented. Check Google Earth Engine Console for task status.'
    });
    
  } catch (error) {
    console.error('Error getting export status:', error);
    res.status(500).json({ 
      error: 'Failed to get export status',
      message: error.message 
    });
  }
});

// Serve the frontend
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
async function startServer() {
  console.log('Starting GEE Tiles Server...');
  
  // Initialize Earth Engine
  await initializeEarthEngine();
  
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Earth Engine Status: ${eeInitialized ? 'Initialized' : 'Not Initialized'}`);
    if (!eeInitialized) {
      console.log('To use Earth Engine features, add your service account JSON file.');
    }
  });
}

startServer();