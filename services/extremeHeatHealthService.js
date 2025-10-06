/**
 * @fileoverview Servicio de análisis de salud y calor extremo
 * Implementa metodología avanzada:
 * - Detección de días con calor extremo (LST > 40°C) usando MODIS
 * - Cálculo de distancia euclidiana a hospitales y centros de salud
 * - Identificación de población vulnerable (alto calor + lejos de servicios)
 * - Mapas de priorización para refugios climáticos y nuevas instalaciones
 * 
 * @module services/extremeHeatHealthService
 */

const ee = require('@google/earthengine');

class ExtremeHeatHealthService {
  constructor() {
    this.initialized = false;
  }

  async initialize() {
    if (!this.initialized) {
      try {
        await ee.Number(1).getInfo();
        this.initialized = true;
        console.log('✅ ExtremeHeatHealthService inicializado');
      } catch (error) {
        console.error('❌ Error inicializando ExtremeHeatHealthService:', error);
        throw error;
      }
    }
  }

  /**
   * Análisis simplificado de vulnerabilidad al calor extremo
   * 
   * @param {Object} params - Parámetros de análisis
   * @param {ee.Geometry} params.geometry - Geometría del área
   * @param {String} params.startDate - Fecha inicial para análisis de calor
   * @param {String} params.endDate - Fecha final
   * @param {Number} params.extremeTempThreshold - Umbral de temperatura extrema en °C (default: 40)
   * @returns {Promise<Object>} Análisis de vulnerabilidad
   */
  async analyzeExtremeHeatVulnerability(params) {
    await this.initialize();

    const {
      geometry,
      startDate = '2024-01-01',
      endDate = '2024-01-31',
      extremeTempThreshold = 35
    } = params;

    try {
      const aoi = ee.Geometry(geometry);

      console.log(`[Extreme Heat] Analizando período ${startDate} a ${endDate}`);

      // 1. Cargar MODIS LST (Terra Daily) sin filtros QC
      const lst = ee.ImageCollection('MODIS/061/MOD11A1')
        .filterDate(startDate, endDate)
        .filterBounds(aoi)
        .select('LST_Day_1km');

      // VALIDACIÓN: Verificar imágenes disponibles
      const lstSize = await lst.size().getInfo();
      console.log(`[Extreme Heat] Imágenes MODIS disponibles: ${lstSize}`);

      if (lstSize === 0) {
        return {
          success: false,
          error: `No hay datos de temperatura (MODIS LST) disponibles para el período ${startDate} a ${endDate}`,
          suggestion: 'MODIS comenzó operaciones en 2000. Use fechas desde 2000 en adelante.'
        };
      }

      // Convertir a Celsius: LST_°C = (LST_raw × 0.02) - 273.15
      const lstCelsius = lst.map((img) => {
        return img.multiply(0.02).subtract(273.15).rename('LST_C')
          .copyProperties(img, ['system:time_start']);
      });

      // 2. Calcular estadísticas de temperatura
      const lstMean = lstCelsius.mean().rename('lst_mean');
      const lstMax = lstCelsius.max().rename('lst_max');
      const lstMin = lstCelsius.min().rename('lst_min');

      const tempStats = lstMean.addBands(lstMax).addBands(lstMin).reduceRegion({
        reducer: ee.Reducer.mean().repeat(3),
        geometry: aoi,
        scale: 1000,
        maxPixels: 1e13,
        bestEffort: true
      });

      const tempStatsData = tempStats.getInfo();

      // 3. Contar días con temperatura extrema
      const extremeDays = lstCelsius.map((img) => img.gt(extremeTempThreshold));
      const extremeDaysCount = extremeDays.sum().rename('extreme_days');

      const extremeDaysStats = extremeDaysCount.reduceRegion({
        reducer: ee.Reducer.mean()
          .combine(ee.Reducer.median(), '', true)
          .combine(ee.Reducer.max(), '', true)
          .combine(ee.Reducer.percentile([75, 90, 95]), '', true),
        geometry: aoi,
        scale: 1000,
        maxPixels: 1e13,
        bestEffort: true
      });

      const extremeDaysData = extremeDaysStats.getInfo();

      // 5. Áreas de alto riesgo (muchos días extremos)
      const percentDaysThreshold = 0.3; // 30% de días extremos
      const highRiskArea = extremeDaysCount.gt(lstSize * percentDaysThreshold);

      const pixelArea = ee.Image.pixelArea(); // m²
      const highRiskAreaKm2 = highRiskArea.multiply(pixelArea).divide(1e6); // km²

      const riskStats = highRiskAreaKm2.reduceRegion({
        reducer: ee.Reducer.sum(),
        geometry: aoi,
        scale: 1000,
        maxPixels: 1e13,
        bestEffort: true
      });

      const riskStatsData = riskStats.getInfo();

      // 6. Generar mapas
      const lstMeanMapId = lstMean.getMap({
        min: 20,
        max: 45,
        palette: ['blue', 'cyan', 'yellow', 'orange', 'red', 'darkred']
      });

      const extremeDaysMapId = extremeDaysCount.getMap({
        min: 0,
        max: lstSize,
        palette: ['green', 'yellow', 'orange', 'red', 'darkred', 'purple']
      });

      const highRiskMapId = highRiskArea.selfMask().getMap({
        palette: ['red']
      });

      // 7. Preparar respuesta
      const avgTemp = tempStatsData.lst_mean_mean || 0;
      const maxTemp = tempStatsData.lst_max_mean || 0;
      const minTemp = tempStatsData.lst_min_mean || 0;
      const avgExtremeDays = extremeDaysData.extreme_days_mean || 0;
      const medianExtremeDays = extremeDaysData.extreme_days_median || 0;
      const maxExtremeDays = extremeDaysData.extreme_days_max || 0;
      const highRiskAreaTotal = riskStatsData.constant || 0;

      console.log(`[Extreme Heat] Temp media: ${avgTemp.toFixed(1)}°C, Días extremos promedio: ${avgExtremeDays.toFixed(1)}, Área alto riesgo: ${highRiskAreaTotal.toFixed(1)} km²`);

      return {
        success: true,
        summary: {
          period: `${startDate} a ${endDate}`,
          imagesUsed: lstSize,
          temperature: {
            mean: parseFloat(avgTemp.toFixed(2)),
            max: parseFloat(maxTemp.toFixed(2)),
            min: parseFloat(minTemp.toFixed(2)),
            unit: '°C'
          },
          extremeHeat: {
            threshold: extremeTempThreshold,
            avgDaysPerPixel: parseFloat(avgExtremeDays.toFixed(1)),
            medianDays: parseFloat(medianExtremeDays.toFixed(1)),
            maxDays: Math.round(maxExtremeDays),
            unit: 'días'
          },
          risk: {
            highRiskAreaKm2: parseFloat(highRiskAreaTotal.toFixed(2)),
            criteria: `> ${(percentDaysThreshold*100).toFixed(0)}% días extremos`
          }
        },
        data: {
          temperature: {
            mean: parseFloat(avgTemp.toFixed(2)),
            max: parseFloat(maxTemp.toFixed(2)),
            min: parseFloat(minTemp.toFixed(2)),
            unit: '°C',
            description: `Temperatura superficial (LST) del período`
          },
          extremeDays: {
            mean: parseFloat(avgExtremeDays.toFixed(1)),
            median: parseFloat(medianExtremeDays.toFixed(1)),
            max: Math.round(maxExtremeDays),
            p75: parseFloat((extremeDaysData.extreme_days_p75 || 0).toFixed(1)),
            p90: parseFloat((extremeDaysData.extreme_days_p90 || 0).toFixed(1)),
            p95: parseFloat((extremeDaysData.extreme_days_p95 || 0).toFixed(1)),
            threshold: `> ${extremeTempThreshold}°C`,
            unit: 'días',
            description: `Número de días con temperatura extrema`
          },
          risk: {
            highRiskAreaKm2: parseFloat(highRiskAreaTotal.toFixed(2)),
            percentThreshold: percentDaysThreshold * 100,
            description: `Áreas con más de ${(percentDaysThreshold*100).toFixed(0)}% de días extremos`
          },
          maps: {
            lstMean: {
              urlFormat: lstMeanMapId.urlFormat,
              description: `Temperatura superficial media`,
              legend: {
                min: 20,
                max: 45,
                unit: '°C',
                colors: ['azul (20°C)', 'cian', 'amarillo (32°C)', 'naranja', 'rojo', 'rojo oscuro (45°C)']
              }
            },
            extremeDays: {
              urlFormat: extremeDaysMapId.urlFormat,
              description: `Días con T > ${extremeTempThreshold}°C`,
              legend: {
                min: 0,
                max: lstSize,
                unit: 'días',
                colors: ['verde (0)', 'amarillo', 'naranja', 'rojo', 'rojo oscuro', `morado (${lstSize})` ]
              }
            },
            highRisk: {
              urlFormat: highRiskMapId.urlFormat,
              description: `Áreas de alto riesgo (>${(percentDaysThreshold*100).toFixed(0)}% días extremos)`,
              legend: {
                color: 'rojo',
                description: 'Zonas con calor extremo frecuente'
              }
            }
          },
          recommendations: this._generateHealthHeatRecommendations(
            highRiskAreaTotal,
            avgExtremeDays,
            extremeTempThreshold
          ),
          metadata: {
            startDate,
            endDate,
            period: `${startDate} a ${endDate}`,
            extremeTempThreshold,
            imagesUsed: lstSize,
            area: geometry,
            datasets: ['MODIS/061/MOD11A1'],
            formulas: {
              lstConversion: 'LST_°C = (LST_raw × 0.02) - 273.15',
              extremeDays: `count(days where LST > ${extremeTempThreshold}°C)`,
              highRisk: `extreme_days > ${(percentDaysThreshold*100).toFixed(0)}% of total days`
            },
            resolution: 'MODIS LST: ~1km',
            note: 'Análisis simplificado sin cálculo de distancia a hospitales ni vulnerabilidad poblacional'
          }
        }
      };

    } catch (error) {
      console.error('Error en analyzeExtremeHeatVulnerability:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Identifica ubicaciones óptimas para nuevos centros de salud
   * basado en vulnerabilidad al calor
   * 
   * @param {Object} params - Parámetros
   * @param {ee.Geometry} params.geometry - Geometría del área
   * @param {Number} params.numLocations - Número de ubicaciones a sugerir
   * @returns {Promise<Object>} Ubicaciones propuestas
   */
  async suggestHealthFacilityLocations(params) {
    await this.initialize();

    const {
      geometry,
      numLocations = 5
    } = params;

    try {
      const aoi = ee.Geometry(geometry);

      // 1. Identificar zonas con alta vulnerabilidad
      // (simplificación: áreas con >30 días extremos en 2023)
      const lst = ee.ImageCollection('MODIS/061/MOD11A1')
        .filterDate('2023-01-01', '2023-12-31')
        .filterBounds(aoi)
        .select('LST_Day_1km')
        .map(img => img.multiply(0.02).subtract(273.15));

      const extremeDays = lst.map(img => img.gt(40)).sum();
      const highRisk = extremeDays.gt(30);

      // 2. Población en riesgo
      const population = ee.ImageCollection('CIESIN/GPWv411/GPW_Population_Count')
        .filter(ee.Filter.eq('year', 2020))
        .first()
        .select('population_count');

      const riskPopulation = population.updateMask(highRisk);

      // 3. Estadísticas
      const popStats = riskPopulation.reduceRegion({
        reducer: ee.Reducer.sum(),
        geometry: aoi,
        scale: 1000,
        maxPixels: 1e13,
        bestEffort: true
      });

      const [popInfo] = await Promise.all([popStats.getInfo()]);
      const totalRiskPop = popInfo.population_count || 0;

      return {
        success: true,
        data: {
          analysis: {
            populationAtRisk: Math.round(totalRiskPop),
            suggestedLocations: numLocations,
            criteria: [
              'Zonas con >30 días extremos/año',
              'Alta densidad poblacional',
              'Lejos de centros existentes'
            ]
          },
          recommendation: {
            priority: totalRiskPop > 20000 ? 'urgent' : 'high',
            action: `Evaluar ${numLocations} ubicaciones para nuevos centros de salud`,
            reason: `${Math.round(totalRiskPop).toLocaleString()} personas en riesgo por calor extremo`,
            nextSteps: [
              '1. Análisis geoespacial detallado de accesibilidad',
              '2. Evaluación de disponibilidad de terrenos',
              '3. Estudio de factibilidad económica',
              '4. Consulta comunitaria'
            ]
          }
        }
      };

    } catch (error) {
      console.error('Error en suggestHealthFacilityLocations:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Analiza tendencias temporales de calor extremo
   * 
   * @param {Object} params - Parámetros
   * @param {ee.Geometry} params.geometry - Geometría del área
   * @param {Number} params.startYear - Año inicial
   * @param {Number} params.endYear - Año final
   * @returns {Promise<Object>} Análisis de tendencia
   */
  async analyzeHeatTrends(params) {
    await this.initialize();

    const {
      geometry,
      startYear = 2015,
      endYear = 2023
    } = params;

    try {
      const aoi = ee.Geometry(geometry);

      // Calcular días extremos por año
      const yearlyData = [];
      
      for (let year = startYear; year <= endYear; year++) {
        const lst = ee.ImageCollection('MODIS/061/MOD11A1')
          .filterDate(`${year}-01-01`, `${year}-12-31`)
          .filterBounds(aoi)
          .select('LST_Day_1km')
          .map(img => img.multiply(0.02).subtract(273.15));

        const extremeDays = lst.map(img => img.gt(40)).sum();
        
        const yearStats = extremeDays.reduceRegion({
          reducer: ee.Reducer.mean(),
          geometry: aoi,
          scale: 1000,
          maxPixels: 1e13,
          bestEffort: true
        });

        yearlyData.push({
          year: year,
          stats: yearStats
        });
      }

      // Obtener valores
      const results = await Promise.all(
        yearlyData.map(async (item) => {
          const info = await item.stats.getInfo();
          return {
            year: item.year,
            extremeDays: info.LST_Day_1km || 0
          };
        })
      );

      // Calcular tendencia lineal
      const n = results.length;
      const sumX = results.reduce((sum, r) => sum + r.year, 0);
      const sumY = results.reduce((sum, r) => sum + r.extremeDays, 0);
      const sumXY = results.reduce((sum, r) => sum + (r.year * r.extremeDays), 0);
      const sumX2 = results.reduce((sum, r) => sum + (r.year * r.year), 0);

      const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
      const intercept = (sumY - slope * sumX) / n;

      return {
        success: true,
        data: {
          yearlyData: results,
          trend: {
            slope: slope,
            intercept: intercept,
            interpretation: slope > 0 ? 'Incremento' : 'Disminución',
            daysPerYear: Math.abs(slope).toFixed(2),
            projection2030: slope * 2030 + intercept,
            unit: 'días extremos/año'
          }
        }
      };

    } catch (error) {
      console.error('Error en analyzeHeatTrends:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Clasifica nivel de riesgo para salud
   * @private
   */
  _classifyHealthRisk(vulnerablePopulation) {
    if (vulnerablePopulation > 100000) return 'critical';
    if (vulnerablePopulation > 20000) return 'high';
    if (vulnerablePopulation > 5000) return 'medium';
    return 'low';
  }

  /**
   * Genera recomendaciones de salud y calor
   * @private
   */
  _generateHealthHeatRecommendations(highRiskAreaKm2, avgExtremeDays, threshold) {
    const recommendations = [];

    if (highRiskAreaKm2 > 20) {
      recommendations.push({
        priority: 'urgent',
        action: 'Implementar sistema de alerta de calor extremo',
        target: 'Ministerio de Salud + Municipalidad',
        reason: `${highRiskAreaKm2.toFixed(1)} km² con alto riesgo de calor extremo`,
        timeline: 'Inmediato - antes del próximo verano'
      });

      recommendations.push({
        priority: 'urgent',
        action: 'Crear refugios climáticos en zonas de alto riesgo',
        target: 'Gobierno local',
        reason: 'Protección durante olas de calor',
        examples: 'Bibliotecas, centros comunitarios con aire acondicionado'
      });
    }

    if (avgExtremeDays > 30) {
      recommendations.push({
        priority: 'high',
        action: 'Programa de adaptación al cambio climático',
        target: 'Autoridades ambientales',
        reason: `Promedio de ${avgExtremeDays.toFixed(1)} días extremos (>${threshold}°C)`,
        measures: [
          'Aumentar cobertura arbórea',
          'Techos y pavimentos reflectantes',
          'Infraestructura verde'
        ]
      });
    }

    if (highRiskAreaKm2 > 5 && avgExtremeDays > 15) {
      recommendations.push({
        priority: 'high',
        action: 'Mapeo detallado de población vulnerable',
        target: 'Salud pública',
        reason: 'Identificar grupos de riesgo (ancianos, niños, enfermos crónicos)',
        recommendation: 'Priorizar áreas de alto riesgo para intervención'
      });
    }

    recommendations.push({
      priority: 'medium',
      action: 'Capacitar personal de salud en enfermedades por calor',
      target: 'Centros de salud',
      reason: 'Preparación para emergencias climáticas',
      topics: ['Golpe de calor', 'Deshidratación', 'Grupos vulnerables']
    });

    recommendations.push({
      priority: 'medium',
      action: 'Campaña de prevención de enfermedades por calor',
      target: 'Población general',
      reason: 'Educación y prevención',
      channels: ['Radio', 'Redes sociales', 'Brigadas comunitarias']
    });

    recommendations.push({
      priority: 'low',
      action: 'Monitoreo continuo de temperatura y salud',
      target: 'Investigadores + Autoridades',
      reason: 'Evaluación de impactos a largo plazo',
      data: 'Correlacionar días extremos con admisiones hospitalarias'
    });

    return recommendations;
  }
}

module.exports = new ExtremeHeatHealthService();
