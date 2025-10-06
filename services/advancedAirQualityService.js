/**
 * @fileoverview Servicio avanzado de monitoreo de calidad del aire
 * Implementa metodología detallada NASA/Copernicus:
 * - ECMWF/CAMS para PM2.5, AOD550, SO₂, CO
 * - Sentinel-5P TROPOMI para NO₂
 * - Filtrado de nubes y calidad
 * - Análisis de exposición poblacional
 * - Umbrales de alerta por contaminante
 * 
 * @module services/advancedAirQualityService
 */

const ee = require('@google/earthengine');

class AdvancedAirQualityService {
  constructor() {
    this.initialized = false;
    
    // Umbrales de alerta según estándares OMS y EPA
    this.thresholds = {
      no2: {
        low: 50,      // μmol/m² (buena calidad)
        medium: 100,   // μmol/m² (moderada)
        high: 150,     // μmol/m² (mala)
        critical: 200  // μmol/m² (muy mala)
      },
      pm25: {
        low: 15,       // μg/m³ (OMS 2021)
        medium: 35,    // μg/m³ (EPA)
        high: 55,      // μg/m³
        critical: 150  // μg/m³
      },
      aod550: {
        low: 0.1,      // Aerosol Optical Depth a 550nm
        medium: 0.3,
        high: 0.5,
        critical: 1.0
      },
      so2: {
        low: 20,       // ppb
        medium: 75,
        high: 185,
        critical: 304
      },
      co: {
        low: 4.4,      // ppm
        medium: 9.4,
        high: 12.4,
        critical: 15.4
      }
    };
  }

  async initialize() {
    if (!this.initialized) {
      try {
        await ee.Number(1).getInfo();
        this.initialized = true;
        console.log('✅ AdvancedAirQualityService inicializado');
      } catch (error) {
        console.error('❌ Error inicializando AdvancedAirQualityService:', error);
        throw error;
      }
    }
  }

  /**
   * Análisis completo de calidad del aire con Sentinel-5P y CAMS
   * 
   * @param {Object} params - Parámetros de análisis
   * @param {ee.Geometry} params.geometry - Geometría del área
   * @param {String} params.startDate - Fecha inicial (YYYY-MM-DD)
   * @param {String} params.endDate - Fecha final (YYYY-MM-DD)
   * @param {Number} params.cloudThreshold - Umbral de fracción de nubes (default: 0.5)
   * @returns {Promise<Object>} Métricas de calidad del aire y exposición
   */
  async analyzeAirQuality(params) {
    await this.initialize();

    const {
      geometry,
      startDate = '2024-09-01',
      endDate = '2024-09-30',
      cloudThreshold = 0.5
    } = params;

    try {
      const aoi = ee.Geometry(geometry);

      // 1. NO₂ de Sentinel-5P TROPOMI
      const no2Collection = ee.ImageCollection('COPERNICUS/S5P/NRTI/L3_NO2')
        .filterDate(startDate, endDate)
        .filterBounds(aoi)
        .select('tropospheric_NO2_column_number_density');

      // Filtrar por fracción de nubes
      const no2Filtered = no2Collection.map((img) => {
        const cloudFraction = img.select('cloud_fraction');
        const mask = cloudFraction.lt(cloudThreshold);
        return img.updateMask(mask);
      });

      // Convertir a μmol/m² (multiplicar por 1e6)
      const no2Mean = no2Filtered.mean().multiply(1e6).rename('NO2');

      // 2. CAMS - Composición atmosférica
      const cams = ee.ImageCollection('ECMWF/CAMS/NRT')
        .filterDate(startDate, endDate)
        .filterBounds(aoi);

      const camsMean = cams.mean();

      // Extraer bandas de interés
      const aod550 = camsMean.select('total_aerosol_optical_depth_550nm').rename('AOD550');
      const pm25Surface = camsMean.select('particulate_matter_d_less_than_25_um_surface')
        .multiply(1e9) // kg/m³ a μg/m³
        .rename('PM25');
      const so2 = camsMean.select('sulphur_dioxide_surface')
        .multiply(1e9) // kg/m³ a μg/m³
        .rename('SO2');
      const co = camsMean.select('carbon_monoxide_surface')
        .multiply(1e9) // kg/m³ a μg/m³
        .rename('CO');

      // 3. Cargar población
      const population = ee.ImageCollection('CIESIN/GPWv411/GPW_Population_Count')
        .filter(ee.Filter.eq('year', 2020))
        .first()
        .select('population_count');

      // 4. Estadísticas por contaminante
      const stats = no2Mean
        .addBands(aod550)
        .addBands(pm25Surface)
        .addBands(so2)
        .addBands(co)
        .reduceRegion({
          reducer: ee.Reducer.mean()
            .combine(ee.Reducer.min(), '', true)
            .combine(ee.Reducer.max(), '', true)
            .combine(ee.Reducer.stdDev(), '', true)
            .combine(ee.Reducer.percentile([50, 75, 90, 95]), '', true),
          geometry: aoi,
          scale: 1000,
          maxPixels: 1e13,
          bestEffort: true
        });

      // 5. Análisis de exposición poblacional
      const exposureResults = await this._calculateExposure({
        no2: no2Mean,
        pm25: pm25Surface,
        aod: aod550,
        population: population,
        aoi: aoi
      });

      // 6. Generar mapas
      const no2MapId = no2Mean.getMap({
        min: 0,
        max: 200,
        palette: ['green', 'yellow', 'orange', 'red', 'purple']
      });

      const pm25MapId = pm25Surface.getMap({
        min: 0,
        max: 100,
        palette: ['green', 'yellow', 'orange', 'red', 'darkred']
      });

      const aod550MapId = aod550.getMap({
        min: 0,
        max: 1,
        palette: ['white', 'yellow', 'orange', 'red']
      });

      // 7. Obtener valores
      const [
        statsInfo,
        exposureInfo,
        no2MapInfo,
        pm25MapInfo,
        aod550MapInfo
      ] = await Promise.all([
        stats.getInfo(),
        Promise.resolve(exposureResults),
        no2MapId.getInfo(),
        pm25MapId.getInfo(),
        aod550MapId.getInfo()
      ]);

      // 8. Clasificar niveles de calidad
      const airQualityIndex = this._calculateAQI({
        no2: statsInfo.NO2_mean,
        pm25: statsInfo.PM25_mean,
        aod: statsInfo.AOD550_mean
      });

      return {
        success: true,
        data: {
          pollutants: {
            no2: {
              mean: statsInfo.NO2_mean,
              min: statsInfo.NO2_min,
              max: statsInfo.NO2_max,
              stdDev: statsInfo.NO2_stdDev,
              p50: statsInfo.NO2_p50,
              p95: statsInfo.NO2_p95,
              unit: 'μmol/m²',
              level: this._classifyLevel(statsInfo.NO2_mean, this.thresholds.no2),
              source: 'Sentinel-5P TROPOMI'
            },
            pm25: {
              mean: statsInfo.PM25_mean,
              min: statsInfo.PM25_min,
              max: statsInfo.PM25_max,
              stdDev: statsInfo.PM25_stdDev,
              p50: statsInfo.PM25_p50,
              p95: statsInfo.PM25_p95,
              unit: 'μg/m³',
              level: this._classifyLevel(statsInfo.PM25_mean, this.thresholds.pm25),
              whoStandard: 15,
              source: 'ECMWF CAMS'
            },
            aod550: {
              mean: statsInfo.AOD550_mean,
              min: statsInfo.AOD550_min,
              max: statsInfo.AOD550_max,
              stdDev: statsInfo.AOD550_stdDev,
              p50: statsInfo.AOD550_p50,
              p95: statsInfo.AOD550_p95,
              unit: 'adimensional',
              level: this._classifyLevel(statsInfo.AOD550_mean, this.thresholds.aod550),
              description: 'Profundidad óptica de aerosoles a 550nm',
              source: 'ECMWF CAMS'
            },
            so2: {
              mean: statsInfo.SO2_mean,
              min: statsInfo.SO2_min,
              max: statsInfo.SO2_max,
              unit: 'μg/m³',
              level: this._classifyLevel(statsInfo.SO2_mean, this.thresholds.so2),
              source: 'ECMWF CAMS'
            },
            co: {
              mean: statsInfo.CO_mean,
              min: statsInfo.CO_min,
              max: statsInfo.CO_max,
              unit: 'μg/m³',
              level: this._classifyLevel(statsInfo.CO_mean, this.thresholds.co),
              source: 'ECMWF CAMS'
            }
          },
          airQualityIndex: airQualityIndex,
          exposure: exposureInfo,
          maps: {
            no2: {
              urlFormat: no2MapInfo.urlFormat,
              description: 'Dióxido de Nitrógeno (NO₂) troposférico',
              legend: {
                min: 0,
                max: 200,
                unit: 'μmol/m²',
                colors: ['verde', 'amarillo', 'naranja', 'rojo', 'morado']
              }
            },
            pm25: {
              urlFormat: pm25MapInfo.urlFormat,
              description: 'Material Particulado PM2.5',
              legend: {
                min: 0,
                max: 100,
                unit: 'μg/m³',
                colors: ['verde', 'amarillo', 'naranja', 'rojo', 'rojo oscuro']
              }
            },
            aod550: {
              urlFormat: aod550MapInfo.urlFormat,
              description: 'Profundidad Óptica de Aerosoles (AOD)',
              legend: {
                min: 0,
                max: 1,
                colors: ['blanco', 'amarillo', 'naranja', 'rojo']
              }
            }
          },
          recommendations: this._generateRecommendations(airQualityIndex, exposureInfo),
          metadata: {
            startDate,
            endDate,
            cloudThreshold,
            area: geometry,
            datasets: [
              'COPERNICUS/S5P/NRTI/L3_NO2',
              'ECMWF/CAMS/NRT',
              'CIESIN/GPWv411/GPW_Population_Count'
            ],
            references: {
              whoStandards: 'OMS Air Quality Guidelines 2021',
              epaStandards: 'EPA National Ambient Air Quality Standards',
              resolution: 'Sentinel-5P: 7km, CAMS: ~40km'
            }
          }
        }
      };

    } catch (error) {
      console.error('Error en analyzeAirQuality:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Calcula exposición poblacional a contaminantes
   * @private
   */
  async _calculateExposure(params) {
    const { no2, pm25, aod, population, aoi } = params;

    // Definir umbrales de riesgo
    const no2HighRisk = no2.gt(this.thresholds.no2.high);
    const pm25HighRisk = pm25.gt(this.thresholds.pm25.medium);
    const aodHighRisk = aod.gt(this.thresholds.aod550.medium);

    // Combinar riesgos (al menos 2 de 3)
    const combinedRisk = no2HighRisk.add(pm25HighRisk).add(aodHighRisk).gte(2);

    // Población expuesta
    const exposedPop = population.updateMask(combinedRisk);

    const exposureStats = exposedPop.reduceRegion({
      reducer: ee.Reducer.sum(),
      geometry: aoi,
      scale: 1000,
      maxPixels: 1e13,
      bestEffort: true
    });

    const totalPopStats = population.reduceRegion({
      reducer: ee.Reducer.sum(),
      geometry: aoi,
      scale: 1000,
      maxPixels: 1e13,
      bestEffort: true
    });

    const [exposureInfo, totalPopInfo] = await Promise.all([
      exposureStats.getInfo(),
      totalPopStats.getInfo()
    ]);

    const exposedPopulation = exposureInfo.population_count || 0;
    const totalPopulation = totalPopInfo.population_count || 1;
    const exposurePercentage = (exposedPopulation / totalPopulation * 100);

    return {
      exposedPopulation: Math.round(exposedPopulation),
      totalPopulation: Math.round(totalPopulation),
      percentage: exposurePercentage.toFixed(2),
      riskLevel: exposurePercentage > 50 ? 'high' : exposurePercentage > 25 ? 'medium' : 'low',
      criteria: 'Al menos 2 de 3 contaminantes sobre umbral de riesgo'
    };
  }

  /**
   * Calcula Índice de Calidad del Aire (AQI) combinado
   * @private
   */
  _calculateAQI(values) {
    const { no2, pm25, aod } = values;

    // Normalizar cada valor (0-100 escala)
    const no2Score = Math.min(100, (no2 / this.thresholds.no2.critical) * 100);
    const pm25Score = Math.min(100, (pm25 / this.thresholds.pm25.critical) * 100);
    const aodScore = Math.min(100, (aod / this.thresholds.aod550.critical) * 100);

    // Promedio ponderado (PM2.5 tiene mayor peso)
    const aqi = (pm25Score * 0.5) + (no2Score * 0.3) + (aodScore * 0.2);

    let level, color, description;

    if (aqi <= 25) {
      level = 'excellent';
      color = 'green';
      description = 'Calidad del aire excelente';
    } else if (aqi <= 50) {
      level = 'good';
      color = 'yellow';
      description = 'Calidad del aire buena';
    } else if (aqi <= 75) {
      level = 'moderate';
      color = 'orange';
      description = 'Calidad del aire moderada - grupos sensibles en riesgo';
    } else {
      level = 'poor';
      color = 'red';
      description = 'Calidad del aire mala - toda la población en riesgo';
    }

    return {
      value: Math.round(aqi),
      level,
      color,
      description,
      components: {
        pm25: Math.round(pm25Score),
        no2: Math.round(no2Score),
        aod: Math.round(aodScore)
      }
    };
  }

  /**
   * Clasifica nivel de un contaminante
   * @private
   */
  _classifyLevel(value, thresholds) {
    if (value <= thresholds.low) return 'low';
    if (value <= thresholds.medium) return 'medium';
    if (value <= thresholds.high) return 'high';
    return 'critical';
  }

  /**
   * Genera recomendaciones basadas en AQI y exposición
   * @private
   */
  _generateRecommendations(aqi, exposure) {
    const recommendations = [];

    if (aqi.level === 'poor' || aqi.level === 'moderate') {
      recommendations.push({
        priority: 'high',
        target: 'Población general',
        action: 'Reducir actividades al aire libre',
        reason: `AQI: ${aqi.value} - ${aqi.description}`
      });
    }

    if (exposure.percentage > 25) {
      recommendations.push({
        priority: 'high',
        target: 'Autoridades',
        action: 'Implementar restricciones vehiculares',
        reason: `${exposure.percentage}% de población expuesta a múltiples contaminantes`
      });
    }

    if (aqi.components.pm25 > 50) {
      recommendations.push({
        priority: 'medium',
        target: 'Grupos sensibles',
        action: 'Usar mascarillas N95 al aire libre',
        reason: 'Niveles elevados de PM2.5'
      });
    }

    if (recommendations.length === 0) {
      recommendations.push({
        priority: 'low',
        target: 'Población general',
        action: 'Continuar con actividades normales',
        reason: 'Calidad del aire en niveles aceptables'
      });
    }

    return recommendations;
  }

  /**
   * Análisis temporal de calidad del aire (series de tiempo)
   * 
   * @param {Object} params - Parámetros
   * @param {ee.Geometry} params.geometry - Geometría del área
   * @param {Array<String>} params.months - Meses a analizar ['2024-01', '2024-02', ...]
   * @returns {Promise<Object>} Series temporales por contaminante
   */
  async analyzeTemporalTrends(params) {
    await this.initialize();

    const { geometry, months } = params;
    const results = [];

    for (const month of months) {
      const startDate = `${month}-01`;
      const endDate = `${month}-28`; // Simplificado

      const analysis = await this.analyzeAirQuality({
        geometry,
        startDate,
        endDate
      });

      if (analysis.success) {
        results.push({
          month: month,
          aqi: analysis.data.airQualityIndex.value,
          no2: analysis.data.pollutants.no2.mean,
          pm25: analysis.data.pollutants.pm25.mean,
          aod: analysis.data.pollutants.aod550.mean,
          exposedPopulation: analysis.data.exposure.exposedPopulation
        });
      }
    }

    return {
      success: true,
      data: {
        timeSeries: results,
        trend: this._calculateTrend(results, 'aqi'),
        summary: {
          avgAQI: results.reduce((sum, r) => sum + r.aqi, 0) / results.length,
          maxAQI: Math.max(...results.map(r => r.aqi)),
          minAQI: Math.min(...results.map(r => r.aqi))
        }
      }
    };
  }

  /**
   * Calcula tendencia simple
   * @private
   */
  _calculateTrend(data, field) {
    if (data.length < 2) return null;

    const n = data.length;
    const sumX = data.reduce((sum, d, i) => sum + i, 0);
    const sumY = data.reduce((sum, d) => sum + d[field], 0);
    const sumXY = data.reduce((sum, d, i) => sum + i * d[field], 0);
    const sumX2 = data.reduce((sum, d, i) => sum + i * i, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);

    return {
      slope,
      direction: slope > 1 ? 'worsening' : slope < -1 ? 'improving' : 'stable'
    };
  }
}

module.exports = new AdvancedAirQualityService();
