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

      console.log(`[Air Quality] Analizando período ${startDate} a ${endDate}`);

      // 1. NO₂ de Sentinel-5P TROPOMI (usar dataset OFFL para mayor cobertura histórica)
      const no2Collection = ee.ImageCollection('COPERNICUS/S5P/OFFL/L3_NO2')
        .filterDate(startDate, endDate)
        .filterBounds(aoi);

      // VALIDACIÓN: Verificar que hay imágenes disponibles
      const no2Size = await no2Collection.size().getInfo();
      console.log(`[Air Quality] Imágenes NO2 disponibles: ${no2Size}`);
      
      if (no2Size === 0) {
        return {
          success: false,
          error: `No hay datos de NO2 (Sentinel-5P) disponibles para el área y período especificado (${startDate} a ${endDate})`,
          suggestion: 'Sentinel-5P comenzó operaciones en 2018. Intente con fechas desde 2019 en adelante'
        };
      }

      // Seleccionar solo NO2 troposférico
      const no2Band = no2Collection.select('tropospheric_NO2_column_number_density');
      
      // Convertir a μmol/m² (multiplicar por 1e6)
      const no2Mean = no2Band.mean().multiply(1e6).rename('NO2');

      // 2. CAMS - Usar dataset regular (no NRT) para mayor cobertura
      const cams = ee.ImageCollection('ECMWF/CAMS/NRT')
        .filterDate(startDate, endDate)
        .filterBounds(aoi);

      // VALIDACIÓN: Verificar disponibilidad CAMS
      const camsSize = await cams.size().getInfo();
      console.log(`[Air Quality] Imágenes CAMS disponibles: ${camsSize}`);
      
      if (camsSize === 0) {
        // Si no hay CAMS NRT, solo usar NO2
        console.warn('[Air Quality] CAMS no disponible, continuando solo con NO2');
        
        // Estadísticas solo de NO2
        const no2Stats = no2Mean.reduceRegion({
          reducer: ee.Reducer.mean()
            .combine(ee.Reducer.min(), '', true)
            .combine(ee.Reducer.max(), '', true)
            .combine(ee.Reducer.stdDev(), '', true),
          geometry: aoi,
          scale: 1000,
          maxPixels: 1e13,
          bestEffort: true
        });

        const no2MapId = no2Mean.getMap({
          min: 0,
          max: 200,
          palette: ['green', 'yellow', 'orange', 'red', 'purple']
        });

        const [no2StatsInfo, no2MapInfo] = await Promise.all([
          no2Stats.getInfo(),
          no2MapId.getInfo()
        ]);

        return {
          success: true,
          summary: {
            period: { startDate, endDate },
            imagesUsed: { no2: no2Size, cams: 0 },
            note: 'Solo NO2 disponible (CAMS sin datos para este período)'
          },
          data: {
            pollutants: {
              no2: {
                mean: no2StatsInfo.NO2_mean,
                min: no2StatsInfo.NO2_min,
                max: no2StatsInfo.NO2_max,
                stdDev: no2StatsInfo.NO2_stdDev,
                unit: 'μmol/m²',
                level: this._classifyLevel(no2StatsInfo.NO2_mean, this.thresholds.no2),
                source: 'Sentinel-5P TROPOMI OFFL'
              }
            },
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
              }
            },
            metadata: {
              startDate,
              endDate,
              area: geometry,
              datasets: ['COPERNICUS/S5P/OFFL/L3_NO2'],
              note: 'Análisis limitado a NO2. PM2.5 y otros contaminantes requieren datos CAMS.'
            }
          }
        };
      }

      const camsMean = cams.mean();

      // Extraer bandas de interés (nombres actualizados según CAMS NRT)
      const aod550 = camsMean.select('total_aerosol_optical_depth_at_550nm_surface').rename('AOD550');
      const pm25Surface = camsMean.select('particulate_matter_d_less_than_25_um_surface')
        .multiply(1e9) // kg/m³ a μg/m³
        .rename('PM25');
      const so2 = camsMean.select('total_column_sulphur_dioxide_surface')
        .multiply(1e9) // mol/m² a μg/m³ (aprox)
        .rename('SO2');
      const co = camsMean.select('total_column_carbon_monoxide_surface')
        .multiply(1e9) // mol/m² a μg/m³ (aprox)
        .rename('CO');

      // 3. Cargar población
      const population = ee.ImageCollection('CIESIN/GPWv411/GPW_Population_Count')
        .filter(ee.Filter.eq('year', 2020))
        // 3. Estadísticas por contaminante (solo NO2, PM25, AOD principales)
      const stats = no2Mean
        .addBands(aod550)
        .addBands(pm25Surface)
        .reduceRegion({
          reducer: ee.Reducer.mean()
            .combine(ee.Reducer.min(), '', true)
            .combine(ee.Reducer.max(), '', true)
            .combine(ee.Reducer.stdDev(), '', true),
          geometry: aoi,
          scale: 1000,
          maxPixels: 1e13,
          bestEffort: true
        });

      // 4. Generar mapas (getMap() retorna directamente el objeto con urlFormat)
      const no2MapInfo = no2Mean.getMap({
        min: 0,
        max: 200,
        palette: ['green', 'yellow', 'orange', 'red', 'purple']
      });

      const pm25MapInfo = pm25Surface.getMap({
        min: 0,
        max: 100,
        palette: ['green', 'yellow', 'orange', 'red', 'darkred']
      });

      const aod550MapInfo = aod550.getMap({
        min: 0,
        max: 1,
        palette: ['white', 'yellow', 'orange', 'red']
      });

      // 5. Obtener valores (solo stats necesita getInfo)
      const statsInfo = await stats.getInfo();

      // 6. Clasificar niveles de calidad
      const airQualityIndex = this._calculateAQI({
        no2: statsInfo.NO2_mean,
        pm25: statsInfo.PM25_mean,
        aod: statsInfo.AOD550_mean
      });

      console.log(`[Air Quality] AQI: ${airQualityIndex.value}, NO2: ${statsInfo.NO2_mean.toFixed(2)} μmol/m², PM2.5: ${statsInfo.PM25_mean.toFixed(2)} μg/m³`);

      return {
        success: true,
        summary: {
          period: { startDate, endDate },
          imagesUsed: {
            no2: no2Size,
            cams: camsSize
          },
          airQualityIndex: {
            value: airQualityIndex.value,
            level: airQualityIndex.level,
            description: airQualityIndex.description
          },
          primaryConcern: this._identifyPrimaryConcern({
            no2: statsInfo.NO2_mean,
            pm25: statsInfo.PM25_mean,
            aod: statsInfo.AOD550_mean
          })
        },
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
            }
          },
          airQualityIndex: airQualityIndex,
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
            },
            recommendations: this._generateSimpleRecommendations(airQualityIndex),
            metadata: {
              startDate,
              endDate,
              area: geometry,
              datasets: [
                'COPERNICUS/S5P/OFFL/L3_NO2',
                'ECMWF/CAMS/NRT'
              ],
              references: {
                whoStandards: 'OMS Air Quality Guidelines 2021',
                epaStandards: 'EPA National Ambient Air Quality Standards',
                resolution: 'Sentinel-5P: 5.5km, CAMS: ~40km'
              },
              note: 'Análisis simplificado sin cálculo de exposición poblacional'
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
   * Genera recomendaciones simples basadas en AQI
   * @private
   */
  _generateSimpleRecommendations(aqi) {
    const recommendations = [];

    if (aqi.level === 'poor' || aqi.level === 'moderate') {
      recommendations.push({
        priority: 'high',
        action: 'Reducir actividades al aire libre',
        target: 'Población general, especialmente grupos sensibles'
      });
      recommendations.push({
        priority: 'medium',
        action: 'Monitorear síntomas respiratorios',
        target: 'Personas con asma, EPOC o condiciones cardíacas'
      });
    }

    if (aqi.level === 'poor') {
      recommendations.push({
        priority: 'high',
        action: 'Implementar restricciones vehiculares',
        target: 'Autoridades municipales'
      });
    }

    return recommendations;
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
   * Identifica el contaminante con mayor concentración relativa
   * @private
   */
  _identifyPrimaryConcern(values) {
    const { no2, pm25, aod } = values;
    
    const scores = {
      no2: (no2 / this.thresholds.no2.critical) * 100,
      pm25: (pm25 / this.thresholds.pm25.critical) * 100,
      aod: (aod / this.thresholds.aod550.critical) * 100
    };

    const max = Math.max(scores.no2, scores.pm25, scores.aod);
    
    if (scores.pm25 === max) return 'PM2.5 (Material Particulado)';
    if (scores.no2 === max) return 'NO₂ (Dióxido de Nitrógeno)';
    return 'AOD (Aerosoles)';
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
   * @param {Array<Number>} params.years - Años a analizar [2020, 2021, 2022, ...]
   * @returns {Promise<Object>} Series temporales por contaminante
   */
  async analyzeTemporalTrends(params) {
    await this.initialize();

    const { geometry, years } = params;
    
    // Validar que years sea un array
    if (!Array.isArray(years)) {
      throw new Error('Parameter "years" must be an array');
    }

    const results = [];

    // Analizar cada año completo
    for (const year of years) {
      const startDate = `${year}-01-01`;
      const endDate = `${year}-12-31`;

      try {
        const analysis = await this.analyzeAirQuality({
          geometry,
          startDate,
          endDate
        });

        if (analysis.success && analysis.data) {
          results.push({
            year: year,
            aqi: analysis.data.airQualityIndex.value,
            no2: analysis.data.pollutants.no2.mean,
            pm25: analysis.data.pollutants.pm25.mean,
            aod: analysis.data.pollutants.aod550.mean,
            exposedPopulation: analysis.data.exposure.exposedPopulation
          });
        }
      } catch (error) {
        console.warn(`Error analyzing year ${year}:`, error.message);
        // Continuar con el siguiente año
      }
    }

    // Validar que tengamos resultados
    if (results.length === 0) {
      return {
        success: true,
        data: {
          timeSeries: [],
          trend: null,
          summary: {
            avgAQI: 0,
            maxAQI: 0,
            minAQI: 0
          },
          interpretation: 'No se obtuvieron datos para los años solicitados'
        }
      };
    }

    return {
      success: true,
      data: {
        timeSeries: results,
        trend: this._calculateTrend(results, 'aqi'),
        summary: {
          avgAQI: Math.round(results.reduce((sum, r) => sum + r.aqi, 0) / results.length),
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
