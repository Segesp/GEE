/**
 * ═══════════════════════════════════════════════════════════════════════════
 * VEGETATION AND HEAT ISLAND SERVICE - GOOGLE EARTH ENGINE
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Service for monitoring vegetation (NDVI) and urban heat islands (LST)
 * using satellite data from Sentinel-2, Landsat, and MODIS via Google Earth Engine.
 * 
 * Variables:
 * - NDVI (Normalized Difference Vegetation Index): Sentinel-2 10m + Landsat 30m
 * - LST (Land Surface Temperature): MODIS MOD11A2 1km, 8-day composite
 * - LST Anomaly: LST difference from climatology (2018-2022)
 * - SMOD (Settlement Model): GHSL Urban/Rural classification
 * 
 * Author: EcoPlan Team
 * Last updated: 2025-10-05
 * ═══════════════════════════════════════════════════════════════════════════
 */

const ee = require('@google/earthengine');

// Lima Metropolitan Area bounds
const LIMA_BOUNDS = {
  west: -77.2,
  south: -12.4,
  east: -76.7,
  north: -11.7
};

// Color palettes
const PALETTE_NDVI = ['#9e9e9e', '#d9f0a3', '#78c679', '#238443']; // gray -> green
const PALETTE_LST = ['#2c7bb6', '#abd9e9', '#ffffbf', '#fdae61', '#d7191c']; // blue -> red
const PALETTE_PRIORITY = ['#1a9850', '#fee08b', '#d73027']; // green -> yellow -> red

/**
 * Get Lima bounds as Earth Engine Geometry
 */
function getLimaBounds() {
  return ee.Geometry.Rectangle([
    LIMA_BOUNDS.west,
    LIMA_BOUNDS.south,
    LIMA_BOUNDS.east,
    LIMA_BOUNDS.north
  ]);
}

/**
 * Mask clouds for Sentinel-2
 */
function maskS2Clouds(image) {
  const qa = image.select('QA60');
  const cloudBitMask = 1 << 10;
  const cirrusBitMask = 1 << 11;
  const mask = qa.bitwiseAnd(cloudBitMask).eq(0)
    .and(qa.bitwiseAnd(cirrusBitMask).eq(0));
  return image.updateMask(mask);
}

/**
 * Calculate NDVI for Sentinel-2
 */
function calculateNDVI_S2(image) {
  const scaled = image.select(['B8', 'B4']).multiply(0.0001);
  const ndvi = scaled.normalizedDifference(['B8', 'B4'])
    .rename('NDVI')
    .copyProperties(image, ['system:time_start']);
  return ndvi;
}

/**
 * Mask clouds for Landsat 8/9
 */
function maskLandsatClouds(image) {
  const qa = image.select('QA_PIXEL');
  const dilatedCloud = (1 << 1);
  const cloud = (1 << 3);
  const cloudShadow = (1 << 4);
  const mask = qa.bitwiseAnd(dilatedCloud).eq(0)
    .and(qa.bitwiseAnd(cloud).eq(0))
    .and(qa.bitwiseAnd(cloudShadow).eq(0));
  return image.updateMask(mask);
}

/**
 * Calculate NDVI for Landsat 8/9
 */
function calculateNDVI_Landsat(image) {
  const scaled = image.select(['SR_B5', 'SR_B4']).multiply(0.0000275).add(-0.2);
  const ndvi = scaled.normalizedDifference(['SR_B5', 'SR_B4'])
    .rename('NDVI')
    .copyProperties(image, ['system:time_start']);
  return ndvi;
}

/**
 * Get monthly NDVI composite from Sentinel-2 and Landsat
 * @param {string} startDate - Start date in YYYY-MM-DD format
 * @param {string} endDate - End date in YYYY-MM-DD format
 * @returns {Promise<Object>} NDVI data with statistics and map ID
 */
async function getNDVI(startDate, endDate) {
  try {
    const limaBounds = getLimaBounds();

    // Sentinel-2
    const s2NDVI = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
      .filterBounds(limaBounds)
      .filterDate(startDate, endDate)
      .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 30))
      .map(maskS2Clouds)
      .map(calculateNDVI_S2);

    // Landsat 8
    const l8NDVI = ee.ImageCollection('LANDSAT/LC08/C02/T1_L2')
      .filterBounds(limaBounds)
      .filterDate(startDate, endDate)
      .filter(ee.Filter.lt('CLOUD_COVER', 30))
      .map(maskLandsatClouds)
      .map(calculateNDVI_Landsat);

    // Landsat 9
    const l9NDVI = ee.ImageCollection('LANDSAT/LC09/C02/T1_L2')
      .filterBounds(limaBounds)
      .filterDate(startDate, endDate)
      .filter(ee.Filter.lt('CLOUD_COVER', 30))
      .map(maskLandsatClouds)
      .map(calculateNDVI_Landsat);

    // Merge collections and compute median
    const merged = s2NDVI.merge(l8NDVI).merge(l9NDVI);
    const ndviComposite = merged.median().clip(limaBounds);

    // Get statistics
    const stats = await ndviComposite.reduceRegion({
      reducer: ee.Reducer.mean()
        .combine(ee.Reducer.min(), '', true)
        .combine(ee.Reducer.max(), '', true)
        .combine(ee.Reducer.stdDev(), '', true),
      geometry: limaBounds,
      scale: 30,
      maxPixels: 1e9
    }).getInfo();

    // Generate map ID for visualization
    const mapId = await ndviComposite.getMap({
      min: 0,
      max: 0.8,
      palette: PALETTE_NDVI
    });

    return {
      variable: 'NDVI',
      startDate: startDate,
      endDate: endDate,
      unit: 'index (-1 to 1)',
      sources: ['Sentinel-2 SR', 'Landsat 8/9 L2'],
      resolution: '10-30 m',
      statistics: {
        mean: stats.NDVI_mean || null,
        min: stats.NDVI_min || null,
        max: stats.NDVI_max || null,
        stdDev: stats.NDVI_stdDev || null
      },
      mapId: mapId.mapid,
      token: mapId.token,
      interpretation: interpretNDVI(stats.NDVI_mean)
    };
  } catch (error) {
    console.error('Error getting NDVI:', error);
    throw error;
  }
}

/**
 * Get LST (Land Surface Temperature) from MODIS
 * @param {string} startDate - Start date in YYYY-MM-DD format
 * @param {string} endDate - End date in YYYY-MM-DD format
 * @param {string} timeOfDay - 'day' or 'night'
 * @returns {Promise<Object>} LST data with statistics and map ID
 */
async function getLST(startDate, endDate, timeOfDay = 'day') {
  try {
    const limaBounds = getLimaBounds();
    const bandName = timeOfDay === 'day' ? 'LST_Day_1km' : 'LST_Night_1km';

    const collection = ee.ImageCollection('MODIS/061/MOD11A2')
      .filterBounds(limaBounds)
      .filterDate(startDate, endDate)
      .select(bandName);

    // Convert to Celsius (scale 0.02, subtract 273.15)
    const lstComposite = collection.mean()
      .multiply(0.02)
      .subtract(273.15)
      .clip(limaBounds);

    // Get statistics
    const stats = await lstComposite.reduceRegion({
      reducer: ee.Reducer.mean()
        .combine(ee.Reducer.min(), '', true)
        .combine(ee.Reducer.max(), '', true)
        .combine(ee.Reducer.stdDev(), '', true),
      geometry: limaBounds,
      scale: 1000,
      maxPixels: 1e9
    }).getInfo();

    // Generate map ID for visualization
    const mapId = await lstComposite.getMap({
      min: 15,
      max: 35,
      palette: PALETTE_LST
    });

    return {
      variable: 'LST',
      timeOfDay: timeOfDay,
      startDate: startDate,
      endDate: endDate,
      unit: '°C',
      source: 'MODIS/061/MOD11A2',
      resolution: '1 km',
      statistics: {
        mean: stats[bandName + '_mean'] || null,
        min: stats[bandName + '_min'] || null,
        max: stats[bandName + '_max'] || null,
        stdDev: stats[bandName + '_stdDev'] || null
      },
      mapId: mapId.mapid,
      token: mapId.token,
      interpretation: interpretLST(stats[bandName + '_mean'], timeOfDay)
    };
  } catch (error) {
    console.error('Error getting LST:', error);
    throw error;
  }
}

/**
 * Calculate LST anomaly (difference from climatology)
 * @param {string} targetDate - Target date in YYYY-MM-DD format
 * @param {string} climStartDate - Climatology start date
 * @param {string} climEndDate - Climatology end date
 * @param {string} timeOfDay - 'day' or 'night'
 * @returns {Promise<Object>} LST anomaly data
 */
async function getLSTAnomaly(targetDate, climStartDate, climEndDate, timeOfDay = 'day') {
  try {
    const limaBounds = getLimaBounds();
    const bandName = timeOfDay === 'day' ? 'LST_Day_1km' : 'LST_Night_1km';

    // Get target month LST
    const targetMonth = new Date(targetDate).getMonth() + 1;
    const targetYear = new Date(targetDate).getFullYear();
    const monthStart = `${targetYear}-${String(targetMonth).padStart(2, '0')}-01`;
    const monthEnd = new Date(targetYear, targetMonth, 0).toISOString().split('T')[0];

    const targetLST = ee.ImageCollection('MODIS/061/MOD11A2')
      .filterBounds(limaBounds)
      .filterDate(monthStart, monthEnd)
      .select(bandName)
      .mean()
      .multiply(0.02)
      .subtract(273.15);

    // Get climatology for same month across years
    const climCollection = ee.ImageCollection('MODIS/061/MOD11A2')
      .filterBounds(limaBounds)
      .filterDate(climStartDate, climEndDate)
      .select(bandName)
      .filter(ee.Filter.calendarRange(targetMonth, targetMonth, 'month'));

    const climatology = climCollection.mean()
      .multiply(0.02)
      .subtract(273.15);

    // Calculate anomaly
    const anomaly = targetLST.subtract(climatology).clip(limaBounds);

    // Get statistics
    const stats = await anomaly.reduceRegion({
      reducer: ee.Reducer.mean()
        .combine(ee.Reducer.min(), '', true)
        .combine(ee.Reducer.max(), '', true)
        .combine(ee.Reducer.stdDev(), '', true),
      geometry: limaBounds,
      scale: 1000,
      maxPixels: 1e9
    }).getInfo();

    // Generate map ID for visualization
    const mapId = await anomaly.getMap({
      min: -3,
      max: 3,
      palette: PALETTE_LST
    });

    return {
      variable: 'LST_Anomaly',
      timeOfDay: timeOfDay,
      targetDate: targetDate,
      climatologyPeriod: `${climStartDate} to ${climEndDate}`,
      unit: '°C (anomaly)',
      source: 'MODIS/061/MOD11A2',
      resolution: '1 km',
      statistics: {
        mean: stats[bandName + '_mean'] || null,
        min: stats[bandName + '_min'] || null,
        max: stats[bandName + '_max'] || null,
        stdDev: stats[bandName + '_stdDev'] || null
      },
      mapId: mapId.mapid,
      token: mapId.token,
      interpretation: interpretLSTAnomaly(stats[bandName + '_mean'])
    };
  } catch (error) {
    console.error('Error getting LST anomaly:', error);
    throw error;
  }
}

/**
 * Detect heat island events
 * @param {string} startDate - Start date in YYYY-MM-DD format
 * @param {string} endDate - End date in YYYY-MM-DD format
 * @param {number} threshold - Temperature threshold in °C (default: 30)
 * @returns {Promise<Object>} Heat island events data
 */
async function detectHeatIslands(startDate, endDate, threshold = 30) {
  try {
    const limaBounds = getLimaBounds();

    const collection = ee.ImageCollection('MODIS/061/MOD11A2')
      .filterBounds(limaBounds)
      .filterDate(startDate, endDate)
      .select('LST_Day_1km');

    // Convert to Celsius and find areas above threshold
    const heatIslands = collection.map(img => {
      const lstCelsius = img.multiply(0.02).subtract(273.15);
      const hot = lstCelsius.gt(threshold);
      return hot.selfMask().copyProperties(img, ['system:time_start']);
    });

    // Count events per pixel
    const eventCount = heatIslands.sum().clip(limaBounds);

    // Calculate affected area
    const pixelArea = ee.Image.pixelArea();
    const area = eventCount.gt(0).multiply(pixelArea)
      .reduceRegion({
        reducer: ee.Reducer.sum(),
        geometry: limaBounds,
        scale: 1000,
        maxPixels: 1e9
      });

    const areaKm2 = await area.getInfo();

    // Generate map ID
    const mapId = await eventCount.getMap({
      min: 0,
      max: 10,
      palette: ['#ffffcc', '#ffeda0', '#fed976', '#feb24c', '#fd8d3c', '#fc4e2a', '#e31a1c', '#bd0026', '#800026']
    });

    return {
      variable: 'Heat_Island_Events',
      startDate: startDate,
      endDate: endDate,
      threshold: threshold,
      unit: '°C',
      affectedArea: (areaKm2.LST_Day_1km || 0) / 1e6, // Convert to km²
      mapId: mapId.mapid,
      token: mapId.token,
      generatedAt: new Date().toISOString()
    };
  } catch (error) {
    console.error('Error detecting heat islands:', error);
    throw error;
  }
}

/**
 * Get combined vegetation and heat analysis
 * @param {string} startDate - Start date in YYYY-MM-DD format
 * @param {string} endDate - End date in YYYY-MM-DD format
 * @returns {Promise<Object>} Combined NDVI and LST data
 */
async function getVegetationHeatAnalysis(startDate, endDate) {
  try {
    const [ndvi, lstDay, lstNight, heatIslands] = await Promise.all([
      getNDVI(startDate, endDate),
      getLST(startDate, endDate, 'day'),
      getLST(startDate, endDate, 'night'),
      detectHeatIslands(startDate, endDate, 30)
    ]);

    return {
      startDate: startDate,
      endDate: endDate,
      analysis: {
        ndvi,
        lstDay,
        lstNight,
        heatIslands
      },
      bounds: LIMA_BOUNDS,
      generatedAt: new Date().toISOString()
    };
  } catch (error) {
    console.error('Error getting vegetation and heat analysis:', error);
    throw error;
  }
}

/**
 * Calculate priority index for interventions
 * Priority = z(LST_anomaly) - z(NDVI) + z(sqrt(population))
 * @param {string} date - Date in YYYY-MM-DD format
 * @returns {Promise<Object>} Priority index data
 */
async function calculatePriorityIndex(date) {
  try {
    const limaBounds = getLimaBounds();

    // Get LST anomaly
    const lstData = await getLSTAnomaly(date, '2018-01-01', '2022-12-31', 'day');
    
    // Get NDVI
    const monthStart = date.substring(0, 7) + '-01';
    const monthEnd = new Date(date.substring(0, 4), parseInt(date.substring(5, 7)), 0)
      .toISOString().split('T')[0];
    const ndviData = await getNDVI(monthStart, monthEnd);

    // Get population (GHS-POP 2020)
    const population = ee.Image('JRC/GHSL/P2023A/GHS_POP/2020')
      .select('population_count')
      .clip(limaBounds);

    // This is a simplified version - full implementation would calculate z-scores
    // For now, return the individual components
    return {
      date: date,
      components: {
        lstAnomaly: lstData,
        ndvi: ndviData,
        populationAvailable: true
      },
      message: 'Priority index components calculated. Full z-score normalization requires statistical processing.',
      generatedAt: new Date().toISOString()
    };
  } catch (error) {
    console.error('Error calculating priority index:', error);
    throw error;
  }
}

/**
 * Interpret NDVI values
 */
function interpretNDVI(value) {
  if (value === null) return 'No data available';
  if (value < 0) return 'Water or non-vegetated';
  if (value < 0.2) return 'Sparse vegetation or bare soil';
  if (value < 0.4) return 'Moderate vegetation';
  if (value < 0.6) return 'Good vegetation';
  return 'Dense vegetation';
}

/**
 * Interpret LST values
 */
function interpretLST(value, timeOfDay) {
  if (value === null) return 'No data available';
  const isDay = timeOfDay === 'day';
  
  if (isDay) {
    if (value < 20) return 'Cool';
    if (value < 25) return 'Comfortable';
    if (value < 30) return 'Warm';
    if (value < 35) return 'Hot';
    return 'Very hot (heat island)';
  } else {
    if (value < 15) return 'Cool night';
    if (value < 20) return 'Comfortable night';
    if (value < 25) return 'Warm night';
    return 'Hot night (heat retention)';
  }
}

/**
 * Interpret LST anomaly values
 */
function interpretLSTAnomaly(value) {
  if (value === null) return 'No data available';
  if (value < -2) return 'Much cooler than average';
  if (value < -1) return 'Cooler than average';
  if (value < 1) return 'Near average';
  if (value < 2) return 'Warmer than average';
  return 'Much warmer than average (anomaly)';
}

module.exports = {
  getNDVI,
  getLST,
  getLSTAnomaly,
  detectHeatIslands,
  getVegetationHeatAnalysis,
  calculatePriorityIndex,
  LIMA_BOUNDS
};
