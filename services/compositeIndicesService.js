/**
 * Servicio de Índices Compuestos Ambientales
 * Punto 7: Vulnerabilidad al calor, déficit áreas verdes, contaminación, riesgo hídrico
 * 
 * Calcula 4 índices compuestos por barrio:
 * 1. Vulnerabilidad al Calor (MODIS LST + NDVI + densidad + vulnerabilidad poblacional)
 * 2. Déficit de Áreas Verdes (parques + NDVI + población)
 * 3. Contaminación Atmosférica (AOD + PM2.5 + NO2 + densidad)
 * 4. Riesgo Hídrico (DEM + impermeabilidad + distancia cauces + pendiente)
 */

const ee = require('@google/earthengine');

class CompositeIndicesService {
  constructor() {
    this.isInitialized = false;
    
    // Pesos para índice de vulnerabilidad al calor
    this.heatWeights = {
      temperature: 0.4,
      vegetation: 0.3,
      density: 0.2,
      vulnerability: 0.1
    };

    // Umbrales de referencia para normalización
    this.thresholds = {
      lst: { min: 273.15 + 15, max: 273.15 + 40 }, // 15-40°C
      ndvi: { min: 0, max: 0.8 },
      density: { min: 0, max: 30000 }, // hab/km²
      aod: { min: 0, max: 1 },
      pm25: { min: 0, max: 100 }, // µg/m³
      imperviousness: { min: 0, max: 100 }, // %
      slope: { min: 0, max: 30 }, // grados
      elevation: { min: 0, max: 5000 } // metros
    };
  }

  /**
   * Inicializa el servicio
   */
  async initialize() {
    if (this.isInitialized) return;
    this.isInitialized = true;
    console.log('✓ CompositeIndicesService initialized');
  }

  /**
   * 1. ÍNDICE DE VULNERABILIDAD AL CALOR
   * Combina: LST (MODIS), NDVI, densidad poblacional, vulnerabilidad
   */
  async calculateHeatVulnerability(geometry, population, options = {}) {
    await this.initialize();

    const {
      startDate = '2023-01-01',
      endDate = '2023-12-31',
      vulnerabilityFactor = 0.5 // Factor de vulnerabilidad (0-1)
    } = options;

    try {
      const eeGeometry = ee.Geometry(geometry);

      // 1.1 Temperatura de superficie (MODIS LST)
      // MOD11A1: LST diaria a 1km
      const modisLST = ee.ImageCollection('MODIS/061/MOD11A1')
        .filterDate(startDate, endDate)
        .filterBounds(eeGeometry)
        .select('LST_Day_1km');

      const lstMean = modisLST.mean().multiply(0.02).subtract(273.15); // Kelvin a Celsius

      const lstStats = lstMean.reduceRegion({
        reducer: ee.Reducer.mean(),
        geometry: eeGeometry,
        scale: 1000,
        maxPixels: 1e9
      });

      // 1.2 Índice de vegetación (MODIS NDVI)
      // MOD13A1: NDVI cada 16 días a 500m
      const modisNDVI = ee.ImageCollection('MODIS/061/MOD13A1')
        .filterDate(startDate, endDate)
        .filterBounds(eeGeometry)
        .select('NDVI');

      const ndviMean = modisNDVI.mean().multiply(0.0001); // Factor de escala

      const ndviStats = ndviMean.reduceRegion({
        reducer: ee.Reducer.mean(),
        geometry: eeGeometry,
        scale: 500,
        maxPixels: 1e9
      });

      // 1.3 Evaluar resultados
      const [lstData, ndviData] = await Promise.all([
        new Promise((resolve, reject) => {
          lstStats.evaluate((result, error) => {
            if (error) reject(error);
            else resolve(result);
          });
        }),
        new Promise((resolve, reject) => {
          ndviStats.evaluate((result, error) => {
            if (error) reject(error);
            else resolve(result);
          });
        })
      ]);

      const temperature = lstData.LST_Day_1km || 25;
      const ndvi = ndviData.NDVI || 0.3;
      const densityValue = population?.densityMean || 5000;

      // 1.4 Normalizar componentes (0-1)
      const tempNorm = this._normalize(temperature, 15, 40);
      const vegNorm = 1 - this._normalize(ndvi, 0, 0.8); // Invertir: menos verde = más vulnerable
      const densNorm = this._normalize(densityValue, 0, 30000);
      const vulnNorm = vulnerabilityFactor;

      // 1.5 Calcular índice compuesto ponderado
      const heatVulnerabilityIndex = 
        (tempNorm * this.heatWeights.temperature) +
        (vegNorm * this.heatWeights.vegetation) +
        (densNorm * this.heatWeights.density) +
        (vulnNorm * this.heatWeights.vulnerability);

      return {
        index: Math.round(heatVulnerabilityIndex * 1000) / 1000,
        components: {
          temperature: {
            value: Math.round(temperature * 10) / 10,
            normalized: Math.round(tempNorm * 1000) / 1000,
            weight: this.heatWeights.temperature
          },
          vegetation: {
            value: Math.round(ndvi * 1000) / 1000,
            normalized: Math.round(vegNorm * 1000) / 1000,
            weight: this.heatWeights.vegetation
          },
          density: {
            value: Math.round(densityValue),
            normalized: Math.round(densNorm * 1000) / 1000,
            weight: this.heatWeights.density
          },
          vulnerability: {
            value: vulnerabilityFactor,
            normalized: vulnNorm,
            weight: this.heatWeights.vulnerability
          }
        },
        interpretation: this._interpretHeatVulnerability(heatVulnerabilityIndex),
        source: 'MODIS LST (MOD11A1) + NDVI (MOD13A1)'
      };
    } catch (error) {
      console.error('Error calculating heat vulnerability:', error);
      throw error;
    }
  }

  /**
   * 2. ÍNDICE DE DÉFICIT DE ÁREAS VERDES
   * Calcula déficit basado en m²/hab vs estándar OMS (9 m²/hab)
   */
  async calculateGreenSpaceDeficit(geometry, population, parks = null) {
    await this.initialize();

    try {
      const eeGeometry = ee.Geometry(geometry);
      const popTotal = population?.populationTotal || 10000;

      let greenAreaKm2 = 0;

      if (parks && parks.areaKm2) {
        // Usar datos de parques si están disponibles
        greenAreaKm2 = parks.areaKm2;
      } else {
        // Derivar áreas verdes usando NDVI > umbral
        const sentinel2 = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
          .filterDate('2023-01-01', '2023-12-31')
          .filterBounds(eeGeometry)
          .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 20))
          .map(img => {
            const nir = img.select('B8');
            const red = img.select('B4');
            const ndvi = nir.subtract(red).divide(nir.add(red)).rename('NDVI');
            return img.addBands(ndvi);
          });

        const ndviMean = sentinel2.select('NDVI').mean();
        
        // Áreas verdes: NDVI > 0.4
        const greenMask = ndviMean.gt(0.4);
        const greenPixelArea = greenMask.multiply(ee.Image.pixelArea());

        const areaStats = greenPixelArea.reduceRegion({
          reducer: ee.Reducer.sum(),
          geometry: eeGeometry,
          scale: 10,
          maxPixels: 1e9
        });

        const areaData = await new Promise((resolve, reject) => {
          areaStats.evaluate((result, error) => {
            if (error) reject(error);
            else resolve(result);
          });
        });

        greenAreaKm2 = (areaData.NDVI || 0) / 1000000; // m² a km²
      }

      // Calcular m²/habitante
      const greenPerCapitaM2 = (greenAreaKm2 * 1000000) / popTotal;

      // OMS recomienda 9 m²/hab mínimo
      const omsStandard = 9;
      const deficit = Math.max(0, omsStandard - greenPerCapitaM2);
      
      // Normalizar déficit (0-1): mayor déficit = peor
      const deficitNorm = Math.min(deficit / omsStandard, 1);

      return {
        index: Math.round(deficitNorm * 1000) / 1000,
        components: {
          greenAreaKm2: Math.round(greenAreaKm2 * 100) / 100,
          greenPerCapitaM2: Math.round(greenPerCapitaM2 * 10) / 10,
          omsStandard: omsStandard,
          deficit: Math.round(deficit * 10) / 10,
          population: popTotal
        },
        interpretation: this._interpretGreenDeficit(deficitNorm),
        compliance: greenPerCapitaM2 >= omsStandard ? 'Cumple OMS' : 'No cumple OMS',
        source: parks ? 'Datos de parques municipales' : 'Derivado de NDVI (Sentinel-2)'
      };
    } catch (error) {
      console.error('Error calculating green space deficit:', error);
      throw error;
    }
  }

  /**
   * 3. ÍNDICE DE CONTAMINACIÓN ATMOSFÉRICA
   * Combina: AOD (MODIS), PM2.5, NO2 (Sentinel-5P), ponderado por densidad
   */
  async calculateAirPollution(geometry, population) {
    await this.initialize();

    try {
      const eeGeometry = ee.Geometry(geometry);
      const densityValue = population?.densityMean || 5000;

      // 3.1 Aerosol Optical Depth (MODIS)
      const modisAOD = ee.ImageCollection('MODIS/061/MCD19A2_GRANULES')
        .filterDate('2023-01-01', '2023-12-31')
        .filterBounds(eeGeometry)
        .select('Optical_Depth_047');

      const aodMean = modisAOD.mean().multiply(0.001); // Factor de escala

      const aodStats = aodMean.reduceRegion({
        reducer: ee.Reducer.mean(),
        geometry: eeGeometry,
        scale: 1000,
        maxPixels: 1e9
      });

      // 3.2 NO2 troposférico (Sentinel-5P)
      const no2 = ee.ImageCollection('COPERNICUS/S5P/OFFL/L3_NO2')
        .filterDate('2023-01-01', '2023-12-31')
        .filterBounds(eeGeometry)
        .select('tropospheric_NO2_column_number_density');

      const no2Mean = no2.mean();

      const no2Stats = no2Mean.reduceRegion({
        reducer: ee.Reducer.mean(),
        geometry: eeGeometry,
        scale: 1000,
        maxPixels: 1e9
      });

      // Evaluar
      const [aodData, no2Data] = await Promise.all([
        new Promise((resolve, reject) => {
          aodStats.evaluate((result, error) => {
            if (error) reject(error);
            else resolve(result);
          });
        }),
        new Promise((resolve, reject) => {
          no2Stats.evaluate((result, error) => {
            if (error) reject(error);
            else resolve(result);
          });
        })
      ]);

      const aod = aodData.Optical_Depth_047 || 0.2;
      const no2Value = (no2Data.tropospheric_NO2_column_number_density || 0.0001) * 1e6; // mol/m² a µmol/m²

      // 3.3 Estimar PM2.5 usando AOD (correlación empírica)
      const pm25Estimated = aod * 50; // Aproximación: AOD * factor

      // 3.4 Normalizar componentes
      const aodNorm = this._normalize(aod, 0, 1);
      const pm25Norm = this._normalize(pm25Estimated, 0, 100);
      const no2Norm = this._normalize(no2Value, 0, 150);

      // 3.5 Índice compuesto
      const pollutionIndex = (aodNorm * 0.4 + pm25Norm * 0.4 + no2Norm * 0.2);

      // 3.6 Ponderar por densidad poblacional (exposición)
      const densNorm = this._normalize(densityValue, 0, 30000);
      const exposureWeighted = pollutionIndex * (0.7 + 0.3 * densNorm);

      return {
        index: Math.round(exposureWeighted * 1000) / 1000,
        components: {
          aod: {
            value: Math.round(aod * 1000) / 1000,
            normalized: Math.round(aodNorm * 1000) / 1000
          },
          pm25: {
            value: Math.round(pm25Estimated * 10) / 10,
            normalized: Math.round(pm25Norm * 1000) / 1000,
            unit: 'µg/m³'
          },
          no2: {
            value: Math.round(no2Value * 10) / 10,
            normalized: Math.round(no2Norm * 1000) / 1000,
            unit: 'µmol/m²'
          },
          density: {
            value: Math.round(densityValue),
            normalized: Math.round(densNorm * 1000) / 1000
          }
        },
        interpretation: this._interpretPollution(exposureWeighted),
        source: 'MODIS AOD + Sentinel-5P NO2',
        note: 'PM2.5 estimado desde AOD. Para mayor precisión usar estaciones de monitoreo.'
      };
    } catch (error) {
      console.error('Error calculating air pollution:', error);
      throw error;
    }
  }

  /**
   * 4. ÍNDICE DE RIESGO HÍDRICO
   * Combina: pendiente (DEM), impermeabilidad, distancia a cauces
   */
  async calculateWaterRisk(geometry) {
    await this.initialize();

    try {
      const eeGeometry = ee.Geometry(geometry);

      // 4.1 Digital Elevation Model (SRTM)
      const srtm = ee.Image('USGS/SRTMGL1_003');
      const elevation = srtm.select('elevation');

      // Calcular pendiente
      const slope = ee.Terrain.slope(elevation);

      const slopeStats = slope.reduceRegion({
        reducer: ee.Reducer.mean(),
        geometry: eeGeometry,
        scale: 30,
        maxPixels: 1e9
      });

      // 4.2 Impermeabilidad (derivada de clasificación de uso de suelo)
      // Usar MODIS Land Cover como proxy
      const modisLC = ee.ImageCollection('MODIS/061/MCD12Q1')
        .filterDate('2022-01-01', '2023-01-01')
        .first()
        .select('LC_Type1');

      // Clases urbanas/impermeables: 13 (urbano)
      const imperviousMask = modisLC.eq(13);
      const imperviousArea = imperviousMask.multiply(ee.Image.pixelArea());

      const totalArea = ee.Image.pixelArea().reduceRegion({
        reducer: ee.Reducer.sum(),
        geometry: eeGeometry,
        scale: 500,
        maxPixels: 1e9
      });

      const imperviousAreaSum = imperviousArea.reduceRegion({
        reducer: ee.Reducer.sum(),
        geometry: eeGeometry,
        scale: 500,
        maxPixels: 1e9
      });

      // 4.3 Evaluar
      const [slopeData, totalAreaData, imperviousData] = await Promise.all([
        new Promise((resolve, reject) => {
          slopeStats.evaluate((result, error) => {
            if (error) reject(error);
            else resolve(result);
          });
        }),
        new Promise((resolve, reject) => {
          totalArea.evaluate((result, error) => {
            if (error) reject(error);
            else resolve(result);
          });
        }),
        new Promise((resolve, reject) => {
          imperviousAreaSum.evaluate((result, error) => {
            if (error) reject(error);
            else resolve(result);
          });
        })
      ]);

      const slopeValue = slopeData.slope || 5;
      const imperviousPercent = ((imperviousData.LC_Type1 || 0) / (totalAreaData.area || 1)) * 100;

      // 4.4 Distancia a cauces (simplificado: usar proxy de NDWI)
      const sentinel2 = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
        .filterDate('2023-01-01', '2023-12-31')
        .filterBounds(eeGeometry)
        .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 20))
        .map(img => {
          const green = img.select('B3');
          const nir = img.select('B8');
          const ndwi = green.subtract(nir).divide(green.add(nir)).rename('NDWI');
          return img.addBands(ndwi);
        });

      const ndwiMean = sentinel2.select('NDWI').mean();

      const ndwiStats = ndwiMean.reduceRegion({
        reducer: ee.Reducer.mean(),
        geometry: eeGeometry,
        scale: 10,
        maxPixels: 1e9
      });

      const ndwiData = await new Promise((resolve, reject) => {
        ndwiStats.evaluate((result, error) => {
          if (error) reject(error);
          else resolve(result);
        });
      });

      const ndwi = ndwiData.NDWI || -0.2;

      // 4.5 Normalizar componentes
      const slopeNorm = this._normalize(slopeValue, 0, 30);
      const imperviousNorm = this._normalize(imperviousPercent, 0, 100);
      const waterProximityNorm = this._normalize(Math.abs(ndwi), 0, 0.5); // Más NDWI = más cerca agua

      // 4.6 Calcular índice de riesgo
      // Mayor pendiente + mayor impermeabilidad + cercanía a agua = mayor riesgo
      const waterRiskIndex = 
        (slopeNorm * 0.3) +
        (imperviousNorm * 0.4) +
        (waterProximityNorm * 0.3);

      return {
        index: Math.round(waterRiskIndex * 1000) / 1000,
        components: {
          slope: {
            value: Math.round(slopeValue * 10) / 10,
            normalized: Math.round(slopeNorm * 1000) / 1000,
            unit: 'grados'
          },
          imperviousness: {
            value: Math.round(imperviousPercent * 10) / 10,
            normalized: Math.round(imperviousNorm * 1000) / 1000,
            unit: '%'
          },
          waterProximity: {
            ndwi: Math.round(ndwi * 1000) / 1000,
            normalized: Math.round(waterProximityNorm * 1000) / 1000
          }
        },
        interpretation: this._interpretWaterRisk(waterRiskIndex),
        source: 'SRTM DEM + MODIS Land Cover + Sentinel-2 NDWI'
      };
    } catch (error) {
      console.error('Error calculating water risk:', error);
      throw error;
    }
  }

  /**
   * Calcula todos los índices compuestos para un barrio
   */
  async calculateAllIndices(geometry, neighborhoodName, population, options = {}) {
    await this.initialize();

    try {
      console.log(`Calculando índices compuestos para ${neighborhoodName}...`);

      const [heatVuln, greenDeficit, airPollution, waterRisk] = await Promise.all([
        this.calculateHeatVulnerability(geometry, population, options),
        this.calculateGreenSpaceDeficit(geometry, population, options.parks),
        this.calculateAirPollution(geometry, population),
        this.calculateWaterRisk(geometry)
      ]);

      // Índice ambiental total (promedio ponderado)
      const totalIndex = 
        (heatVuln.index * 0.3) +
        (greenDeficit.index * 0.25) +
        (airPollution.index * 0.25) +
        (waterRisk.index * 0.2);

      return {
        neighborhood: neighborhoodName,
        timestamp: new Date().toISOString(),
        indices: {
          heatVulnerability: heatVuln,
          greenSpaceDeficit: greenDeficit,
          airPollution: airPollution,
          waterRisk: waterRisk
        },
        totalEnvironmentalIndex: {
          value: Math.round(totalIndex * 1000) / 1000,
          interpretation: this._interpretTotal(totalIndex),
          weights: {
            heat: 0.3,
            green: 0.25,
            pollution: 0.25,
            water: 0.2
          }
        },
        summary: this._generateSummary(heatVuln, greenDeficit, airPollution, waterRisk)
      };
    } catch (error) {
      console.error('Error calculating all indices:', error);
      throw error;
    }
  }

  /**
   * Simula escenario de mejora ambiental
   */
  simulateScenario(baselineIndices, scenario) {
    const { 
      vegetationIncrease = 0,    // % aumento
      pollutionReduction = 0,     // % reducción
      greenSpaceIncrease = 0      // m² adicionales per cápita
    } = scenario;

    const modified = JSON.parse(JSON.stringify(baselineIndices));

    // Modificar índice de calor (más vegetación reduce temperatura)
    if (vegetationIncrease > 0) {
      const heatReduction = vegetationIncrease * 0.3; // 30% de impacto
      modified.indices.heatVulnerability.index = Math.max(0, 
        modified.indices.heatVulnerability.index - (heatReduction / 100));
    }

    // Modificar contaminación
    if (pollutionReduction > 0) {
      modified.indices.airPollution.index = Math.max(0,
        modified.indices.airPollution.index * (1 - pollutionReduction / 100));
    }

    // Modificar déficit de áreas verdes
    if (greenSpaceIncrease > 0) {
      const currentGreen = modified.indices.greenSpaceDeficit.components.greenPerCapitaM2;
      const newGreen = currentGreen + greenSpaceIncrease;
      const newDeficit = Math.max(0, 9 - newGreen);
      modified.indices.greenSpaceDeficit.index = Math.min(newDeficit / 9, 1);
      modified.indices.greenSpaceDeficit.components.greenPerCapitaM2 = newGreen;
    }

    // Recalcular índice total
    const newTotal = 
      (modified.indices.heatVulnerability.index * 0.3) +
      (modified.indices.greenSpaceDeficit.index * 0.25) +
      (modified.indices.airPollution.index * 0.25) +
      (modified.indices.waterRisk.index * 0.2);

    modified.totalEnvironmentalIndex.value = Math.round(newTotal * 1000) / 1000;
    modified.scenario = scenario;
    modified.isSimulation = true;

    return {
      baseline: baselineIndices,
      modified: modified,
      improvement: {
        heat: baselineIndices.indices.heatVulnerability.index - modified.indices.heatVulnerability.index,
        green: baselineIndices.indices.greenSpaceDeficit.index - modified.indices.greenSpaceDeficit.index,
        pollution: baselineIndices.indices.airPollution.index - modified.indices.airPollution.index,
        total: baselineIndices.totalEnvironmentalIndex.value - modified.totalEnvironmentalIndex.value
      }
    };
  }

  // ==================== MÉTODOS PRIVADOS ====================

  _normalize(value, min, max) {
    return Math.max(0, Math.min(1, (value - min) / (max - min)));
  }

  _interpretHeatVulnerability(index) {
    if (index < 0.25) return 'Baja vulnerabilidad al calor';
    if (index < 0.5) return 'Vulnerabilidad moderada';
    if (index < 0.75) return 'Alta vulnerabilidad al calor';
    return 'Vulnerabilidad crítica al calor';
  }

  _interpretGreenDeficit(index) {
    if (index < 0.25) return 'Áreas verdes suficientes';
    if (index < 0.5) return 'Déficit moderado de áreas verdes';
    if (index < 0.75) return 'Déficit alto de áreas verdes';
    return 'Déficit crítico de áreas verdes';
  }

  _interpretPollution(index) {
    if (index < 0.25) return 'Calidad del aire buena';
    if (index < 0.5) return 'Calidad del aire moderada';
    if (index < 0.75) return 'Contaminación alta';
    return 'Contaminación crítica';
  }

  _interpretWaterRisk(index) {
    if (index < 0.25) return 'Riesgo hídrico bajo';
    if (index < 0.5) return 'Riesgo hídrico moderado';
    if (index < 0.75) return 'Riesgo hídrico alto';
    return 'Riesgo hídrico crítico';
  }

  _interpretTotal(index) {
    if (index < 0.25) return 'Excelente calidad ambiental';
    if (index < 0.5) return 'Buena calidad ambiental';
    if (index < 0.75) return 'Calidad ambiental deficiente';
    return 'Calidad ambiental crítica';
  }

  _generateSummary(heat, green, pollution, water) {
    const issues = [];
    if (heat.index > 0.5) issues.push('vulnerabilidad al calor');
    if (green.index > 0.5) issues.push('déficit de áreas verdes');
    if (pollution.index > 0.5) issues.push('contaminación atmosférica');
    if (water.index > 0.5) issues.push('riesgo hídrico');

    if (issues.length === 0) {
      return 'Barrio con buena calidad ambiental en todos los indicadores.';
    } else {
      return `Barrio con desafíos en: ${issues.join(', ')}.`;
    }
  }
}

module.exports = new CompositeIndicesService();
