/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ADVANCED DATA SERVICE - GOOGLE EARTH ENGINE
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Servicio avanzado que integra múltiples fuentes de datos:
 * - NASA Earthdata (FIRMS, VIIRS Black Marble, HLS)
 * - SEDAC/CIESIN (GPW, SDG Indicators)
 * - Copernicus (CAMS, Land Cover, DEM GLO-30)
 * - WorldPop (población 100m)
 * - WRI (Dynamic World, Forest Loss Drivers)
 * - GHSL (Built-up Surface)
 * 
 * Author: EcoPlan Team
 * Date: 2025-10-05
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

function getLimaBounds() {
  return ee.Geometry.Rectangle([
    LIMA_BOUNDS.west,
    LIMA_BOUNDS.south,
    LIMA_BOUNDS.east,
    LIMA_BOUNDS.north
  ]);
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 1. NASA FIRMS - FIRE DETECTION (Detección de Incendios)
 * ═══════════════════════════════════════════════════════════════════════════
 */
async function getFireDetection(startDate, endDate) {
  try {
    const limaBounds = getLimaBounds();
    
    // FIRMS dataset - Fire Information for Resource Management System
    const fires = ee.ImageCollection('FIRMS')
      .filterBounds(limaBounds)
      .filterDate(startDate, endDate)
      .select(['T21', 'confidence']); // T21 = brightness temperature, confidence
    
    // Count fire pixels
    const fireCount = fires.reduce(ee.Reducer.count());
    
    // Get statistics
    const stats = await fireCount.reduceRegion({
      reducer: ee.Reducer.mean().combine({
        reducer2: ee.Reducer.minMax(),
        sharedInputs: true
      }),
      geometry: limaBounds,
      scale: 1000,
      maxPixels: 1e9
    }).getInfo();
    
    // Get map visualization (solo banda T21)
    const visParams = {
      min: 300,
      max: 400,
      palette: ['yellow', 'orange', 'red']
    };
    
    const mapId = await fires.select('T21').mean().getMap(visParams);
    
    return {
      variable: 'Fire Detection',
      source: 'NASA FIRMS (MODIS/VIIRS)',
      startDate,
      endDate,
      resolution: '1 km',
      statistics: {
        fireCount: stats.T21_mean || 0,
        confidence: stats.confidence_mean || 0
      },
      mapId: mapId.mapid,
      token: mapId.token,
      interpretation: interpretFireDetection(stats.T21_mean || 0)
    };
  } catch (error) {
    console.error('Error in getFireDetection:', error);
    throw error;
  }
}

function interpretFireDetection(fireCount) {
  if (fireCount === 0) return 'No se detectaron incendios en el período';
  if (fireCount < 5) return 'Actividad de incendios baja';
  if (fireCount < 20) return 'Actividad de incendios moderada';
  return 'Actividad de incendios alta - requiere atención';
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 2. VIIRS BLACK MARBLE - NIGHTTIME LIGHTS (Luces Nocturnas)
 * ═══════════════════════════════════════════════════════════════════════════
 */
async function getNightLights(startDate, endDate) {
  try {
    const limaBounds = getLimaBounds();
    
    // VIIRS Black Marble - Nighttime lights
    const nightLights = ee.ImageCollection('NOAA/VIIRS/DNB/MONTHLY_V1/VCMSLCFG')
      .filterBounds(limaBounds)
      .filterDate(startDate, endDate)
      .select('avg_rad'); // Average radiance
    
    const composite = nightLights.median();
    
    // Get statistics
    const stats = await composite.reduceRegion({
      reducer: ee.Reducer.mean().combine({
        reducer2: ee.Reducer.minMax(),
        sharedInputs: true
      }).combine({
        reducer2: ee.Reducer.stdDev(),
        sharedInputs: true
      }),
      geometry: limaBounds,
      scale: 500,
      maxPixels: 1e9
    }).getInfo();
    
    // Visualization
    const visParams = {
      min: 0,
      max: 60,
      palette: ['000000', '0000ff', '00ff00', 'ffff00', 'ff0000']
    };
    
    const mapId = await composite.getMap(visParams);
    
    return {
      variable: 'Nighttime Lights',
      source: 'NOAA VIIRS Black Marble',
      startDate,
      endDate,
      resolution: '500 m',
      unit: 'nW/cm²/sr',
      statistics: {
        mean: stats.avg_rad_mean,
        min: stats.avg_rad_min,
        max: stats.avg_rad_max,
        stdDev: stats.avg_rad_stdDev
      },
      mapId: mapId.mapid,
      token: mapId.token,
      interpretation: interpretNightLights(stats.avg_rad_mean)
    };
  } catch (error) {
    console.error('Error in getNightLights:', error);
    throw error;
  }
}

function interpretNightLights(mean) {
  if (mean < 5) return 'Iluminación nocturna baja - área rural';
  if (mean < 20) return 'Iluminación moderada - área periurbana';
  if (mean < 40) return 'Iluminación alta - área urbana';
  return 'Iluminación muy alta - centro urbano denso';
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 3. SEDAC GPW - POPULATION DATA (Datos de Población)
 * ═══════════════════════════════════════════════════════════════════════════
 */
async function getPopulationData(year = 2020) {
  try {
    const limaBounds = getLimaBounds();
    
    // SEDAC GPW v4.11 - Population Count and Density
    // Note: GPW uses ImageCollection, need to filter by year
    const population = ee.ImageCollection('CIESIN/GPWv411/GPW_Population_Count')
      .filter(ee.Filter.date(year + '-01-01', year + '-12-31'))
      .first()
      .clip(limaBounds)
      .select('population_count');
    
    const density = ee.ImageCollection('CIESIN/GPWv411/GPW_Population_Density')
      .filter(ee.Filter.date(year + '-01-01', year + '-12-31'))
      .first()
      .clip(limaBounds)
      .select('population_density');
    
    // Get statistics
    const popStats = await population.reduceRegion({
      reducer: ee.Reducer.sum().combine({
        reducer2: ee.Reducer.mean(),
        sharedInputs: true
      }),
      geometry: limaBounds,
      scale: 1000,
      maxPixels: 1e9
    }).getInfo();
    
    const densityStats = await density.reduceRegion({
      reducer: ee.Reducer.mean().combine({
        reducer2: ee.Reducer.minMax(),
        sharedInputs: true
      }),
      geometry: limaBounds,
      scale: 1000,
      maxPixels: 1e9
    }).getInfo();
    
    // Visualization
    const visParams = {
      min: 0,
      max: 1000,
      palette: ['ffffcc', 'c7e9b4', '7fcdbb', '41b6c4', '2c7fb8', '253494']
    };
    
    const mapId = await density.getMap(visParams);
    
    return {
      variable: 'Population',
      source: 'SEDAC GPWv4.11',
      year,
      resolution: '~1 km (30 arc-seconds)',
      statistics: {
        totalPopulation: popStats.population_count_sum,
        avgPopulation: popStats.population_count_mean,
        avgDensity: densityStats.population_density_mean,
        minDensity: densityStats.population_density_min,
        maxDensity: densityStats.population_density_max
      },
      mapId: mapId.mapid,
      token: mapId.token,
      interpretation: `Población total estimada: ${Math.round(popStats.population_count_sum).toLocaleString()} habitantes`
    };
  } catch (error) {
    console.error('Error in getPopulationData:', error);
    throw error;
  }
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 4. WORLDPOP - HIGH RESOLUTION POPULATION (Población Alta Resolución)
 * ═══════════════════════════════════════════════════════════════════════════
 */
async function getWorldPopData(year = 2020) {
  try {
    const limaBounds = getLimaBounds();
    
    // WorldPop Global Project Population 100m
    const worldpop = ee.ImageCollection('WorldPop/GP/100m/pop')
      .filter(ee.Filter.eq('year', year))
      .select('population')
      .mosaic()
      .clip(limaBounds);
    
    // Get statistics
    const stats = await worldpop.reduceRegion({
      reducer: ee.Reducer.sum().combine({
        reducer2: ee.Reducer.mean(),
        sharedInputs: true
      }).combine({
        reducer2: ee.Reducer.minMax(),
        sharedInputs: true
      }),
      geometry: limaBounds,
      scale: 100,
      maxPixels: 1e9
    }).getInfo();
    
    // Visualization
    const visParams = {
      min: 0,
      max: 1000,
      palette: ['24126c', '1fff4f', 'd4ff50']
    };
    
    const mapId = await worldpop.getMap(visParams);
    
    return {
      variable: 'Population (High Resolution)',
      source: 'WorldPop Global Project',
      year,
      resolution: '100 m',
      statistics: {
        totalPopulation: stats.population_sum,
        avgPopulation: stats.population_mean,
        minPopulation: stats.population_min,
        maxPopulation: stats.population_max
      },
      mapId: mapId.mapid,
      token: mapId.token,
      interpretation: `Población total (WorldPop): ${Math.round(stats.population_sum).toLocaleString()} habitantes con resolución de 100m`
    };
  } catch (error) {
    console.error('Error in getWorldPopData:', error);
    throw error;
  }
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 5. GHSL BUILT-UP SURFACE (Superficie Construida)
 * ═══════════════════════════════════════════════════════════════════════════
 */
async function getBuiltUpSurface(year = 2020) {
  try {
    const limaBounds = getLimaBounds();
    
        // GHSL Built-up Surface - usar año específico
    const builtUp = ee.ImageCollection('JRC/GHSL/P2023A/GHS_BUILT_S')
      .filterBounds(limaBounds)
      .filterDate(year + '-01-01', year + '-12-31')
      .first();
    
    // Get statistics
    const stats = await builtUp.reduceRegion({
      reducer: ee.Reducer.sum().combine({
        reducer2: ee.Reducer.mean(),
        sharedInputs: true
      }),
      geometry: limaBounds,
      scale: 100,
      maxPixels: 1e9
    }).getInfo();
    
    // Visualization
    const visParams = {
      bands: ['built_surface'],
      min: 0,
      max: 10000,
      palette: ['000000', 'ff0000', 'ffff00', 'ffffff']
    };
    
    const mapId = await builtUp.getMap(visParams);
    
    const totalBuiltKm2 = (stats.built_surface_sum || 0) / 1e6; // m² to km²
    const nonResKm2 = (stats.built_surface_nres_sum || 0) / 1e6;
    
    return {
      variable: 'Built-up Surface',
      source: 'GHSL (Global Human Settlement Layer)',
      year,
      resolution: '100 m',
      unit: 'm² per 100m cell',
      statistics: {
        totalBuiltSurface_km2: totalBuiltKm2,
        nonResidentialSurface_km2: nonResKm2,
        residentialSurface_km2: totalBuiltKm2 - nonResKm2,
        avgBuiltDensity: stats.built_surface_mean
      },
      mapId: mapId.mapid,
      token: mapId.token,
      interpretation: `Superficie construida total: ${totalBuiltKm2.toFixed(2)} km² (${((nonResKm2/totalBuiltKm2)*100).toFixed(1)}% no residencial)`
    };
  } catch (error) {
    console.error('Error in getBuiltUpSurface:', error);
    throw error;
  }
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 6. COPERNICUS CAMS - ATMOSPHERIC COMPOSITION (Composición Atmosférica)
 * ═══════════════════════════════════════════════════════════════════════════
 */
async function getAtmosphericComposition(date) {
  try {
    const limaBounds = getLimaBounds();
    const dateObj = new Date(date);
    
    // CAMS Near Real-Time - bandas con sufijo _surface
    const cams = ee.ImageCollection('ECMWF/CAMS/NRT')
      .filterBounds(limaBounds)
      .filterDate(date, new Date(dateObj.getTime() + 86400000))
      .select(['total_aerosol_optical_depth_at_550nm_surface', 'total_column_nitrogen_dioxide_surface', 
               'total_column_carbon_monoxide_surface', 'gems_total_column_ozone_surface'])
      .mean();
    
    // Get statistics
    const stats = await cams.reduceRegion({
      reducer: ee.Reducer.mean().combine({
        reducer2: ee.Reducer.minMax(),
        sharedInputs: true
      }),
      geometry: limaBounds,
      scale: 40000, // ~40km native resolution
      maxPixels: 1e9
    }).getInfo();
    
    // Visualization for AOD
    const visParams = {
      bands: ['total_aerosol_optical_depth_at_550nm_surface'],
      min: 0,
      max: 0.5,
      palette: ['blue', 'green', 'yellow', 'orange', 'red']
    };
    
    const mapId = await cams.getMap(visParams);
    
    return {
      variable: 'Atmospheric Composition',
      source: 'Copernicus CAMS (ECMWF)',
      date,
      resolution: '~40 km',
      statistics: {
        aod_550nm: stats.total_aerosol_optical_depth_at_550nm_surface_mean,
        no2_column: stats.total_column_nitrogen_dioxide_surface_mean,
        co_column: stats.total_column_carbon_monoxide_surface_mean,
        ozone_column: stats.gems_total_column_ozone_surface_mean
      },
      mapId: mapId.mapid,
      token: mapId.token,
      interpretation: interpretCAMS(stats)
    };
  } catch (error) {
    console.error('Error in getAtmosphericComposition:', error);
    throw error;
  }
}

function interpretCAMS(stats) {
  const aod = stats.total_aerosol_optical_depth_550nm_mean || 0;
  if (aod < 0.1) return 'Calidad del aire: Excelente';
  if (aod < 0.2) return 'Calidad del aire: Buena';
  if (aod < 0.3) return 'Calidad del aire: Moderada';
  return 'Calidad del aire: Pobre - alta concentración de aerosoles';
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 7. DYNAMIC WORLD - NEAR REAL-TIME LAND COVER (Cobertura del Suelo)
 * ═══════════════════════════════════════════════════════════════════════════
 */
async function getDynamicWorldLandCover(startDate, endDate) {
  try {
    const limaBounds = getLimaBounds();
    
    // Dynamic World - 10m near real-time land cover
    const dw = ee.ImageCollection('GOOGLE/DYNAMICWORLD/V1')
      .filterBounds(limaBounds)
      .filterDate(startDate, endDate);
    
    // Get class with highest probability
    const classification = dw.select('label').mode(); // Most common class
    
    // Calculate area statistics for each class
    const classNames = ['water', 'trees', 'grass', 'flooded_vegetation', 
                       'crops', 'shrub_and_scrub', 'built', 'bare', 'snow_and_ice'];
    
    // Get probability layers
    const probabilityImage = dw.select(classNames).mean();
    
    const stats = await probabilityImage.reduceRegion({
      reducer: ee.Reducer.mean(),
      geometry: limaBounds,
      scale: 10,
      maxPixels: 1e9
    }).getInfo();
    
    // Visualization
    const visParams = {
      min: 0,
      max: 8,
      palette: ['419bdf', '397d49', '88b053', '7a87c6', 
                'e49635', 'dfc35a', 'c4281b', 'a59b8f', 'b39fe1']
    };
    
    const mapId = await classification.getMap(visParams);
    
    // Convert probabilities to percentages
    const coveragePercent = {};
    classNames.forEach(name => {
      coveragePercent[name] = ((stats[name] || 0) * 100).toFixed(2);
    });
    
    return {
      variable: 'Land Cover (Dynamic World)',
      source: 'Google Dynamic World (Sentinel-2)',
      startDate,
      endDate,
      resolution: '10 m',
      statistics: {
        coverage: coveragePercent,
        dominantClass: Object.keys(coveragePercent).reduce((a, b) => 
          parseFloat(coveragePercent[a]) > parseFloat(coveragePercent[b]) ? a : b
        )
      },
      mapId: mapId.mapid,
      token: mapId.token,
      interpretation: interpretDynamicWorld(coveragePercent)
    };
  } catch (error) {
    console.error('Error in getDynamicWorldLandCover:', error);
    throw error;
  }
}

function interpretDynamicWorld(coverage) {
  const built = parseFloat(coverage.built || 0);
  const trees = parseFloat(coverage.trees || 0);
  const grass = parseFloat(coverage.grass || 0);
  
  return `Área urbana construida: ${built.toFixed(1)}%, Vegetación arbórea: ${trees.toFixed(1)}%, Pastizales: ${grass.toFixed(1)}%`;
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 8. COPERNICUS DEM GLO-30 - ELEVATION DATA (Modelo Digital de Elevación)
 * ═══════════════════════════════════════════════════════════════════════════
 */
async function getElevationData() {
  try {
    const limaBounds = getLimaBounds();
    
    // Copernicus DEM GLO-30 - Digital Elevation Model 30m
    const dem = ee.ImageCollection('COPERNICUS/DEM/GLO30').mosaic().clip(limaBounds);
    
    // Calculate slope and aspect
    const elevation = dem.select('DEM');
    const slope = ee.Terrain.slope(elevation);
    const aspect = ee.Terrain.aspect(elevation);
    
    // Statistics
    const elevStats = await elevation.reduceRegion({
      reducer: ee.Reducer.mean()
        .combine(ee.Reducer.min(), '', true)
        .combine(ee.Reducer.max(), '', true)
        .combine(ee.Reducer.stdDev(), '', true),
      geometry: limaBounds,
      scale: 30,
      maxPixels: 1e9
    }).getInfo();
    
    const slopeStats = await slope.reduceRegion({
      reducer: ee.Reducer.mean()
        .combine(ee.Reducer.max(), '', true),
      geometry: limaBounds,
      scale: 30,
      maxPixels: 1e9
    }).getInfo();
    
    // Visualization parameters
    const visParams = {
      min: 0,
      max: 1000,
      palette: ['0000ff', '00ffff', '00ff00', 'ffff00', 'ff0000', 'ffffff']
    };
    
    const mapId = await elevation.getMap(visParams);
    
    return {
      variable: 'Elevation (DEM)',
      source: 'Copernicus DEM GLO-30',
      resolution: '30 m',
      unit: 'meters above sea level',
      statistics: {
        elevation: {
          mean_m: parseFloat(elevStats.DEM_mean?.toFixed(2) || 0),
          min_m: parseFloat(elevStats.DEM_min?.toFixed(2) || 0),
          max_m: parseFloat(elevStats.DEM_max?.toFixed(2) || 0),
          stdDev_m: parseFloat(elevStats.DEM_stdDev?.toFixed(2) || 0)
        },
        slope: {
          mean_degrees: parseFloat(slopeStats.slope_mean?.toFixed(2) || 0),
          max_degrees: parseFloat(slopeStats.slope_max?.toFixed(2) || 0)
        }
      },
      mapId: mapId.mapid,
      token: mapId.token,
      interpretation: interpretElevation(elevStats, slopeStats)
    };
  } catch (error) {
    console.error('Error in getElevationData:', error);
    throw error;
  }
}

function interpretElevation(elevStats, slopeStats) {
  const meanElev = elevStats.DEM_mean || 0;
  const maxElev = elevStats.DEM_max || 0;
  const meanSlope = slopeStats.slope_mean || 0;
  
  let interpretation = `Elevación promedio: ${meanElev.toFixed(0)} msnm, Máxima: ${maxElev.toFixed(0)} msnm. `;
  
  if (meanSlope < 5) {
    interpretation += 'Terreno predominantemente plano - ideal para desarrollo urbano.';
  } else if (meanSlope < 15) {
    interpretation += 'Terreno con pendiente moderada - requiere planificación urbana cuidadosa.';
  } else {
    interpretation += 'Terreno con pendientes pronunciadas - riesgo de deslizamientos, limitar urbanización.';
  }
  
  return interpretation;
}


/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 8. COMPREHENSIVE SOCIOECONOMIC ANALYSIS (Análisis Socioeconómico Completo)
 * ═══════════════════════════════════════════════════════════════════════════
 */
async function getSocioeconomicAnalysis(year = 2020, date = null) {
  try {
    if (!date) {
      const now = new Date();
      date = new Date(now.getTime() - 30 * 86400000).toISOString().split('T')[0]; // 30 days ago
    }
    
    const startDate = date;
    const endDate = new Date(new Date(date).getTime() + 30 * 86400000).toISOString().split('T')[0];
    
    // Ejecutar múltiples análisis en paralelo
    const [
      population,
      worldpop,
      builtUp,
      nightLights,
      landCover
    ] = await Promise.all([
      getPopulationData(year),
      getWorldPopData(year),
      getBuiltUpSurface(year),
      getNightLights(startDate, endDate),
      getDynamicWorldLandCover(startDate, endDate)
    ]);
    
    // Calculate derived indicators
    const populationDensity = population.statistics.totalPopulation / 
                              (builtUp.statistics.totalBuiltSurface_km2 || 1);
    
    const urbanizationRate = parseFloat(landCover.statistics.coverage.built || 0);
    
    return {
      analysisType: 'Comprehensive Socioeconomic Analysis',
      region: 'Lima Metropolitana',
      year,
      date: startDate,
      components: {
        population,
        worldpop,
        builtUp,
        nightLights,
        landCover
      },
      derivedIndicators: {
        populationDensity: Math.round(populationDensity),
        urbanizationRate: urbanizationRate.toFixed(2) + '%',
        developmentIndex: calculateDevelopmentIndex(
          populationDensity,
          urbanizationRate,
          nightLights.statistics.mean
        )
      },
      recommendations: generateRecommendations(
        populationDensity,
        urbanizationRate,
        parseFloat(landCover.statistics.coverage.trees || 0)
      )
    };
  } catch (error) {
    console.error('Error in getSocioeconomicAnalysis:', error);
    throw error;
  }
}

function calculateDevelopmentIndex(density, urbanRate, nightLights) {
  // Simple composite index (0-100)
  const normDensity = Math.min(density / 10000, 1) * 100;
  const normUrban = urbanRate;
  const normLights = Math.min(nightLights / 50, 1) * 100;
  
  return ((normDensity + normUrban + normLights) / 3).toFixed(2);
}

function generateRecommendations(density, urbanRate, treeCoverage) {
  const recommendations = [];
  
  if (density > 5000) {
    recommendations.push('Alta densidad poblacional - priorizar espacios públicos y áreas verdes');
  }
  
  if (urbanRate > 70) {
    recommendations.push('Alto grado de urbanización - necesario plan de gestión urbana sostenible');
  }
  
  if (treeCoverage < 15) {
    recommendations.push('Cobertura arbórea baja - implementar programa de reforestación urbana');
  }
  
  return recommendations.length > 0 ? recommendations : ['Indicadores dentro de rangos aceptables'];
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * EXPORTS
 * ═══════════════════════════════════════════════════════════════════════════
 */
module.exports = {
  // Fire and lights
  getFireDetection,
  getNightLights,
  
  // Population
  getPopulationData,
  getWorldPopData,
  
  // Built environment
  getBuiltUpSurface,
  getDynamicWorldLandCover,
  
  // Atmospheric
  getAtmosphericComposition,
  
  // Topography
  getElevationData,
  
  // Comprehensive analysis
  getSocioeconomicAnalysis
};
