/**
 * ═══════════════════════════════════════════════════════════════════════════
 * AIR AND WATER QUALITY SERVICE - GOOGLE EARTH ENGINE
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Service for monitoring air quality (AOD, NO₂) and water quality (Chlorophyll, NDWI)
 * using satellite data from NASA/Copernicus via Google Earth Engine.
 * 
 * Variables:
 * - AOD (Aerosol Optical Depth): MODIS MAIAC 1km
 * - NO₂ (Nitrogen Dioxide): Sentinel-5P TROPOMI ~7km
 * - Chlorophyll-a: Copernicus Marine ~4km
 * - NDWI (Normalized Difference Water Index): MODIS 463m
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

// District centers (sample)
const LIMA_DISTRICTS = {
  'lima-centro': { name: 'Lima Centro', lat: -12.046, lon: -77.028 },
  'miraflores': { name: 'Miraflores', lat: -12.120, lon: -77.028 },
  'san-isidro': { name: 'San Isidro', lat: -12.089, lon: -76.994 },
  'barranco': { name: 'Barranco', lat: -12.146, lon: -77.020 },
  'surco': { name: 'Surco', lat: -12.141, lon: -76.998 },
  'callao': { name: 'Callao', lat: -12.054, lon: -77.050 },
  'sjl': { name: 'San Juan de Lurigancho', lat: -12.041, lon: -76.937 }
};

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
 * Get AOD (Aerosol Optical Depth) data from MODIS MAIAC
 * @param {string} date - Date in YYYY-MM-DD format
 * @param {string} endDate - Optional end date for range
 * @returns {Promise<Object>} AOD data with statistics and map ID
 */
async function getAOD(date, endDate = null) {
  try {
    const limaBounds = getLimaBounds();
    
    // Calculate date range (if no endDate, use +1 day)
    const startDate = new Date(date);
    const finalEndDate = endDate ? new Date(endDate) : new Date(startDate.getTime() + 86400000);
    
    const collection = ee.ImageCollection('MODIS/061/MCD19A2_GRANULES')
      .filterBounds(limaBounds)
      .filterDate(startDate.toISOString().split('T')[0], finalEndDate.toISOString().split('T')[0])
      .select('Optical_Depth_055'); // AOD at 550nm

    const image = collection.sort('system:time_start', false).first();
    const aodScaled = image.multiply(0.001); // Scale factor
    const aodClipped = aodScaled.clip(limaBounds);

    // Get statistics
    const stats = await aodClipped.reduceRegion({
      reducer: ee.Reducer.mean()
        .combine(ee.Reducer.min(), '', true)
        .combine(ee.Reducer.max(), '', true)
        .combine(ee.Reducer.stdDev(), '', true),
      geometry: limaBounds,
      scale: 1000,
      maxPixels: 1e9
    }).getInfo();

    // Generate map ID for visualization
    const mapId = await aodClipped.getMap({
      min: 0,
      max: 0.5,
      palette: ['#2c7bb6', '#abd9e9', '#ffffbf', '#fdae61', '#d7191c']
    });

    return {
      variable: 'AOD',
      date: date,
      unit: 'unitless',
      source: 'MODIS/061/MCD19A2_GRANULES',
      resolution: '1 km',
      statistics: {
        mean: stats.Optical_Depth_055_mean || null,
        min: stats.Optical_Depth_055_min || null,
        max: stats.Optical_Depth_055_max || null,
        stdDev: stats.Optical_Depth_055_stdDev || null
      },
      mapId: mapId.mapid,
      token: mapId.token,
      interpretation: interpretAOD(stats.Optical_Depth_055_mean)
    };
  } catch (error) {
    console.error('Error getting AOD:', error);
    throw error;
  }
}

/**
 * Get NO₂ (Nitrogen Dioxide) data from Sentinel-5P TROPOMI
 * @param {string} date - Date in YYYY-MM-DD format
 * @param {string} endDate - Optional end date for range
 * @returns {Promise<Object>} NO₂ data with statistics and map ID
 */
async function getNO2(date, endDate = null) {
  try {
    const limaBounds = getLimaBounds();
    
    // Calculate date range (if no endDate, use +1 day)
    const startDate = new Date(date);
    const finalEndDate = endDate ? new Date(endDate) : new Date(startDate.getTime() + 86400000);
    
    const collection = ee.ImageCollection('COPERNICUS/S5P/NRTI/L3_NO2')
      .filterBounds(limaBounds)
      .filterDate(startDate.toISOString().split('T')[0], finalEndDate.toISOString().split('T')[0])
      .select('NO2_column_number_density');

    const image = collection.sort('system:time_start', false).first();
    const no2Scaled = image.multiply(1e6); // Convert to μmol/m²
    const no2Clipped = no2Scaled.clip(limaBounds);

    // Get statistics
    const stats = await no2Clipped.reduceRegion({
      reducer: ee.Reducer.mean()
        .combine(ee.Reducer.min(), '', true)
        .combine(ee.Reducer.max(), '', true)
        .combine(ee.Reducer.stdDev(), '', true),
      geometry: limaBounds,
      scale: 7000,
      maxPixels: 1e9
    }).getInfo();

    // Generate map ID for visualization
    const mapId = await no2Clipped.getMap({
      min: 0,
      max: 200,
      palette: ['#2166ac', '#4393c3', '#92c5de', '#d1e5f0', '#fefefe', '#fee090', '#fdae61', '#f46d43', '#d73027']
    });

    return {
      variable: 'NO2',
      date: date,
      unit: 'μmol/m²',
      source: 'COPERNICUS/S5P/NRTI/L3_NO2',
      resolution: '~7 km',
      statistics: {
        mean: stats.NO2_column_number_density_mean || null,
        min: stats.NO2_column_number_density_min || null,
        max: stats.NO2_column_number_density_max || null,
        stdDev: stats.NO2_column_number_density_stdDev || null
      },
      mapId: mapId.mapid,
      token: mapId.token,
      interpretation: interpretNO2(stats.NO2_column_number_density_mean)
    };
  } catch (error) {
    console.error('Error getting NO2:', error);
    throw error;
  }
}

/**
 * Get Chlorophyll-a data from Copernicus Marine
 * @param {string} date - Date in YYYY-MM-DD format
 * @param {string} endDate - Optional end date for range
 * @returns {Promise<Object>} Chlorophyll data with statistics and map ID
 */
async function getChlorophyll(date, endDate = null) {
  try {
    const limaBounds = getLimaBounds();
    
    // Calculate date range (if no endDate, use +1 day)
    const startDate = new Date(date);
    const finalEndDate = endDate ? new Date(endDate) : new Date(startDate.getTime() + 86400000);
    
    const collection = ee.ImageCollection('NASA/OCEANDATA/MODIS-Aqua/L3SMI')
      .filterBounds(limaBounds)
      .filterDate(startDate.toISOString().split('T')[0], finalEndDate.toISOString().split('T')[0])
      .select('chlor_a');

    const image = collection.sort('system:time_start', false).first();
    const chlorClipped = image.clip(limaBounds);

    // Get statistics (log scale)
    const stats = await chlorClipped.reduceRegion({
      reducer: ee.Reducer.mean()
        .combine(ee.Reducer.min(), '', true)
        .combine(ee.Reducer.max(), '', true)
        .combine(ee.Reducer.stdDev(), '', true),
      geometry: limaBounds,
      scale: 4000,
      maxPixels: 1e9
    }).getInfo();

    // Generate map ID for visualization (log scale)
    const chlorLog = chlorClipped.log10();
    const mapId = await chlorLog.getMap({
      min: -2,
      max: 2,
      palette: ['#000033', '#000055', '#006699', '#0099cc', '#00cc99', '#66ff66', '#ccff00', '#ffff00', '#ff9900', '#ff0000']
    });

    return {
      variable: 'Chlorophyll-a',
      date: date,
      unit: 'mg/m³',
      source: 'NASA/OCEANDATA/MODIS-Aqua/L3SMI',
      resolution: '~4 km',
      statistics: {
        mean: stats.chlor_a_mean || null,
        min: stats.chlor_a_min || null,
        max: stats.chlor_a_max || null,
        stdDev: stats.chlor_a_stdDev || null
      },
      mapId: mapId.mapid,
      token: mapId.token,
      interpretation: interpretChlorophyll(stats.chlor_a_mean)
    };
  } catch (error) {
    console.error('Error getting Chlorophyll:', error);
    throw error;
  }
}

/**
 * Get NDWI (Normalized Difference Water Index) data from MODIS
 * @param {string} date - Date in YYYY-MM-DD format
 * @param {string} endDate - Optional end date for range
 * @returns {Promise<Object>} NDWI data with statistics and map ID
 */
async function getNDWI(date, endDate = null) {
  try {
    const limaBounds = getLimaBounds();
    
    // Calculate date range (if no endDate, use +1 day)
    const startDate = new Date(date);
    const finalEndDate = endDate ? new Date(endDate) : new Date(startDate.getTime() + 86400000);
    
    const collection = ee.ImageCollection('MODIS/006/MCD43A4')
      .filterBounds(limaBounds)
      .filterDate(startDate.toISOString().split('T')[0], finalEndDate.toISOString().split('T')[0])
      .select(['Nadir_Reflectance_Band2', 'Nadir_Reflectance_Band6']);

    const image = collection.sort('system:time_start', false).first();
    const scaled = image.multiply(0.0001);
    const ndwi = scaled.normalizedDifference(['Nadir_Reflectance_Band2', 'Nadir_Reflectance_Band6'])
      .rename('NDWI');
    const ndwiClipped = ndwi.clip(limaBounds);

    // Get statistics
    const stats = await ndwiClipped.reduceRegion({
      reducer: ee.Reducer.mean()
        .combine(ee.Reducer.min(), '', true)
        .combine(ee.Reducer.max(), '', true)
        .combine(ee.Reducer.stdDev(), '', true),
      geometry: limaBounds,
      scale: 463,
      maxPixels: 1e9
    }).getInfo();

    // Generate map ID for visualization
    const mapId = await ndwiClipped.getMap({
      min: -0.5,
      max: 0.5,
      palette: ['#8B4513', '#D2B48C', '#F0E68C', '#E0FFFF', '#87CEEB', '#4169E1', '#00008B']
    });

    return {
      variable: 'NDWI',
      date: date,
      unit: 'index (-1 to 1)',
      source: 'MODIS/006/MCD43A4',
      resolution: '463 m',
      statistics: {
        mean: stats.NDWI_mean || null,
        min: stats.NDWI_min || null,
        max: stats.NDWI_max || null,
        stdDev: stats.NDWI_stdDev || null
      },
      mapId: mapId.mapid,
      token: mapId.token,
      interpretation: interpretNDWI(stats.NDWI_mean)
    };
  } catch (error) {
    console.error('Error getting NDWI:', error);
    throw error;
  }
}

/**
 * Get all air and water quality variables for a specific date
 * @param {string} date - Date in YYYY-MM-DD format
 * @returns {Promise<Object>} Combined data for all variables
 */
async function getAllVariables(date) {
  try {
    const [aod, no2, chlorophyll, ndwi] = await Promise.all([
      getAOD(date),
      getNO2(date),
      getChlorophyll(date),
      getNDWI(date)
    ]);

    return {
      date: date,
      variables: {
        aod,
        no2,
        chlorophyll,
        ndwi
      },
      bounds: LIMA_BOUNDS,
      generatedAt: new Date().toISOString()
    };
  } catch (error) {
    console.error('Error getting all variables:', error);
    throw error;
  }
}

/**
 * Get time series data for a specific variable
 * @param {string} variable - Variable name (aod, no2, chlorophyll, ndwi)
 * @param {string} startDate - Start date in YYYY-MM-DD format
 * @param {string} endDate - End date in YYYY-MM-DD format
 * @param {string} district - Optional district ID
 * @returns {Promise<Object>} Time series data
 */
async function getTimeSeries(variable, startDate, endDate, district = null) {
  try {
    const limaBounds = getLimaBounds();
    const geometry = district && LIMA_DISTRICTS[district]
      ? ee.Geometry.Point([LIMA_DISTRICTS[district].lon, LIMA_DISTRICTS[district].lat]).buffer(2000)
      : limaBounds;

    let collection, bandName, scaleFactor;

    switch (variable) {
      case 'aod':
        collection = ee.ImageCollection('MODIS/061/MCD19A2_GRANULES')
          .select('Optical_Depth_055');
        bandName = 'Optical_Depth_055';
        scaleFactor = 0.001;
        break;
      case 'no2':
        collection = ee.ImageCollection('COPERNICUS/S5P/NRTI/L3_NO2')
          .select('NO2_column_number_density');
        bandName = 'NO2_column_number_density';
        scaleFactor = 1e6;
        break;
      case 'chlorophyll':
        collection = ee.ImageCollection('NASA/OCEANDATA/MODIS-Aqua/L3SMI')
          .select('chlor_a');
        bandName = 'chlor_a';
        scaleFactor = 1;
        break;
      case 'ndwi':
        // NDWI requires calculation from bands
        collection = ee.ImageCollection('MODIS/006/MCD43A4')
          .select(['Nadir_Reflectance_Band2', 'Nadir_Reflectance_Band6'])
          .map(img => {
            const scaled = img.multiply(0.0001);
            return scaled.normalizedDifference(['Nadir_Reflectance_Band2', 'Nadir_Reflectance_Band6'])
              .rename('NDWI')
              .copyProperties(img, ['system:time_start']);
          });
        bandName = 'NDWI';
        scaleFactor = 1;
        break;
      default:
        throw new Error(`Unknown variable: ${variable}`);
    }

    collection = collection
      .filterBounds(geometry)
      .filterDate(startDate, endDate);

    // Extract time series
    const chart = await collection.map(img => {
      const value = img.reduceRegion({
        reducer: ee.Reducer.mean(),
        geometry: geometry,
        scale: 1000,
        maxPixels: 1e9
      }).get(bandName);

      return ee.Feature(null, {
        date: img.date().format('YYYY-MM-dd'),
        value: ee.Number(value).multiply(scaleFactor)
      });
    }).getInfo();

    return {
      variable: variable,
      startDate: startDate,
      endDate: endDate,
      district: district ? LIMA_DISTRICTS[district].name : 'Lima Metropolitana',
      data: chart.features.map(f => f.properties),
      generatedAt: new Date().toISOString()
    };
  } catch (error) {
    console.error('Error getting time series:', error);
    throw error;
  }
}

/**
 * Interpret AOD values
 */
function interpretAOD(value) {
  if (value === null) return 'No data available';
  if (value < 0.1) return 'Excellent (very low aerosol)';
  if (value < 0.2) return 'Good (low aerosol)';
  if (value < 0.3) return 'Moderate';
  if (value < 0.5) return 'Poor (high aerosol)';
  return 'Very poor (very high aerosol)';
}

/**
 * Interpret NO₂ values
 */
function interpretNO2(value) {
  if (value === null) return 'No data available';
  if (value < 50) return 'Excellent (very low NO₂)';
  if (value < 100) return 'Good (low NO₂)';
  if (value < 150) return 'Moderate';
  if (value < 200) return 'Poor (high NO₂)';
  return 'Very poor (very high NO₂)';
}

/**
 * Interpret Chlorophyll values
 */
function interpretChlorophyll(value) {
  if (value === null) return 'No data available';
  if (value < 0.1) return 'Oligotrophic (very low productivity)';
  if (value < 1) return 'Mesotrophic (moderate productivity)';
  if (value < 10) return 'Eutrophic (high productivity)';
  return 'Hypereutrophic (very high productivity)';
}

/**
 * Interpret NDWI values
 */
function interpretNDWI(value) {
  if (value === null) return 'No data available';
  if (value < -0.3) return 'Very dry (no water)';
  if (value < -0.1) return 'Dry';
  if (value < 0.1) return 'Moderate moisture';
  if (value < 0.3) return 'Wet';
  return 'Water body';
}

module.exports = {
  getAOD,
  getNO2,
  getChlorophyll,
  getNDWI,
  getAllVariables,
  getTimeSeries,
  LIMA_DISTRICTS,
  LIMA_BOUNDS
};
