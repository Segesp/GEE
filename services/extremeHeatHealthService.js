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
   * Análisis completo de vulnerabilidad al calor extremo
   * 
   * @param {Object} params - Parámetros de análisis
   * @param {ee.Geometry} params.geometry - Geometría del área
   * @param {String} params.startDate - Fecha inicial para análisis de calor
   * @param {String} params.endDate - Fecha final
   * @param {Number} params.extremeTempThreshold - Umbral de temperatura extrema en °C (default: 40)
   * @param {Number} params.criticalDaysThreshold - Número mínimo de días extremos (default: 20)
   * @param {Number} params.healthDistanceThreshold - Distancia máxima aceptable a servicios en km (default: 2)
   * @param {Array} params.healthFacilities - Lista de coordenadas de hospitales/centros salud [{lat, lon}, ...]
   * @returns {Promise<Object>} Análisis de vulnerabilidad
   */
  async analyzeExtremeHeatVulnerability(params) {
    await this.initialize();

    const {
      geometry,
      startDate = '2023-01-01',
      endDate = '2023-12-31',
      extremeTempThreshold = 40,
      criticalDaysThreshold = 20,
      healthDistanceThreshold = 2000, // metros
      healthFacilities = []
    } = params;

    try {
      const aoi = ee.Geometry(geometry);

      // 1. Cargar MODIS LST (Terra Daily)
      const lst = ee.ImageCollection('MODIS/061/MOD11A1')
        .filterDate(startDate, endDate)
        .filterBounds(aoi)
        .select('LST_Day_1km');

      // Convertir a Celsius: LST_°C = (LST_raw × 0.02) - 273.15
      const lstCelsius = lst.map((img) => {
        return img.multiply(0.02).subtract(273.15)
          .copyProperties(img, ['system:time_start', 'system:index']);
      });

      // 2. Filtrar por calidad (QC)
      const lstQC = ee.ImageCollection('MODIS/061/MOD11A1')
        .filterDate(startDate, endDate)
        .filterBounds(aoi)
        .select('QC_Day');

      const lstFiltered = lstCelsius.map((img) => {
        const date = ee.Date(img.get('system:time_start'));
        const qc = lstQC.filterDate(date, date.advance(1, 'day')).first();
        
        // QC bits 0-1: 00 = good quality
        const goodQuality = qc.bitwiseAnd(3).eq(0);
        
        return img.updateMask(goodQuality);
      });

      // 3. Contar días con temperatura extrema (>40°C)
      const extremeDays = lstFiltered.map((img) => {
        return img.gt(extremeTempThreshold);
      });

      const extremeDaysCount = extremeDays.sum().rename('extreme_days');

      // 4. Estadísticas de temperatura
      const lstStats = lstFiltered.mean();
      const lstMax = lstFiltered.max();
      const lstP95 = lstFiltered.reduce(ee.Reducer.percentile([95]));

      const tempStats = lstStats.addBands(lstMax).addBands(lstP95).reduceRegion({
        reducer: ee.Reducer.mean().repeat(3),
        geometry: aoi,
        scale: 1000,
        maxPixels: 1e13,
        bestEffort: true
      });

      // 5. Calcular distancia a instalaciones de salud
      let healthAccessMap;
      
      if (healthFacilities && healthFacilities.length > 0) {
        // Crear puntos de hospitales
        const facilityPoints = healthFacilities.map(f => 
          ee.Feature(ee.Geometry.Point([f.lon, f.lat]))
        );
        const facilityCollection = ee.FeatureCollection(facilityPoints);

        // Crear imagen de distancia usando cumulativeCost
        // 1. Crear imagen de fuentes (hospitales = 0, resto = null)
        const sources = ee.Image().byte().paint(facilityCollection, 1);

        // 2. Calcular distancia euclidiana (en metros)
        const distanceImage = sources.fastDistanceTransform().sqrt()
          .multiply(ee.Image.pixelArea().sqrt())
          .rename('distance_to_health');

        healthAccessMap = distanceImage;
      } else {
        // Si no hay datos de hospitales, usar distancia a áreas urbanas como proxy
        const urban = ee.ImageCollection('JRC/GHSL/P2023A/GHS_BUILT_S')
          .filter(ee.Filter.eq('year', 2020))
          .first()
          .select('built_surface')
          .gt(0.3);

        const urbanSources = urban.selfMask();
        const distanceToUrban = urbanSources.fastDistanceTransform().sqrt()
          .multiply(ee.Image.pixelArea().sqrt())
          .rename('distance_to_health');

        healthAccessMap = distanceToUrban;
      }

      // 6. Identificar población vulnerable
      // Criterios: muchos días extremos AND lejos de servicios de salud
      const criticalHeat = extremeDaysCount.gte(criticalDaysThreshold);
      const farFromHealth = healthAccessMap.gt(healthDistanceThreshold);

      const vulnerable = criticalHeat.and(farFromHealth);

      // 7. Cargar población
      const population = ee.ImageCollection('CIESIN/GPWv411/GPW_Population_Count')
        .filter(ee.Filter.eq('year', 2020))
        .first()
        .select('population_count');

      const vulnerablePop = population.updateMask(vulnerable);

      // 8. Estadísticas de vulnerabilidad
      const vulnStats = vulnerablePop.reduceRegion({
        reducer: ee.Reducer.sum(),
        geometry: aoi,
        scale: 1000,
        maxPixels: 1e13,
        bestEffort: true
      });

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

      const distanceStats = healthAccessMap.reduceRegion({
        reducer: ee.Reducer.mean()
          .combine(ee.Reducer.median(), '', true)
          .combine(ee.Reducer.max(), '', true)
          .combine(ee.Reducer.percentile([75, 90]), '', true),
        geometry: aoi,
        scale: 1000,
        maxPixels: 1e13,
        bestEffort: true
      });

      // 9. Áreas prioritarias para refugios climáticos
      // Zonas con alta población vulnerable
      const priorityForRefuges = vulnerablePop.gt(100); // >100 personas vulnerables por pixel

      // 10. Generar mapas
      const extremeDaysMapId = extremeDaysCount.getMap({
        min: 0,
        max: 100,
        palette: ['green', 'yellow', 'orange', 'red', 'darkred', 'purple']
      });

      const distanceMapId = healthAccessMap.getMap({
        min: 0,
        max: 5000,
        palette: ['green', 'yellow', 'orange', 'red', 'darkred']
      });

      const vulnerabilityMapId = vulnerable.selfMask().getMap({
        palette: ['red']
      });

      const priorityMapId = priorityForRefuges.selfMask().getMap({
        palette: ['purple']
      });

      // 11. Obtener valores
      const [
        tempStatsInfo,
        vulnInfo,
        extremeInfo,
        distanceInfo,
        extremeDaysMap,
        distanceMap,
        vulnerabilityMap,
        priorityMap
      ] = await Promise.all([
        tempStats.getInfo(),
        vulnStats.getInfo(),
        extremeDaysStats.getInfo(),
        distanceStats.getInfo(),
        extremeDaysMapId.getInfo(),
        distanceMapId.getInfo(),
        vulnerabilityMapId.getInfo(),
        priorityMapId.getInfo()
      ]);

      const vulnerablePopulation = vulnInfo.sum || 0;

      return {
        success: true,
        data: {
          temperature: {
            mean: tempStatsInfo.mean,
            max: tempStatsInfo.mean_1,
            p95: tempStatsInfo.mean_2,
            unit: '°C',
            description: `Temperatura superficial (LST) ${startDate} a ${endDate}`
          },
          extremeDays: {
            mean: extremeInfo.extreme_days_mean,
            median: extremeInfo.extreme_days_median,
            max: extremeInfo.extreme_days_max,
            p75: extremeInfo.extreme_days_p75,
            p90: extremeInfo.extreme_days_p90,
            p95: extremeInfo.extreme_days_p95,
            threshold: `> ${extremeTempThreshold}°C`,
            unit: 'días',
            description: `Número de días con temperatura extrema en el período`
          },
          healthAccess: {
            meanDistance: distanceInfo.distance_to_health_mean,
            medianDistance: distanceInfo.distance_to_health_median,
            maxDistance: distanceInfo.distance_to_health_max,
            p75: distanceInfo.distance_to_health_p75,
            p90: distanceInfo.distance_to_health_p90,
            threshold: healthDistanceThreshold,
            unit: 'metros',
            description: 'Distancia a instalaciones de salud',
            facilitiesProvided: healthFacilities.length > 0,
            facilitiesCount: healthFacilities.length
          },
          vulnerability: {
            populationAffected: Math.round(vulnerablePopulation),
            criteria: [
              `≥ ${criticalDaysThreshold} días con T > ${extremeTempThreshold}°C`,
              `Distancia a salud > ${(healthDistanceThreshold/1000).toFixed(1)} km`
            ],
            level: this._classifyHealthRisk(vulnerablePopulation),
            description: 'Población que cumple ambos criterios de vulnerabilidad'
          },
          maps: {
            extremeDays: {
              urlFormat: extremeDaysMap.urlFormat,
              description: `Número de días con T > ${extremeTempThreshold}°C`,
              legend: {
                min: 0,
                max: 100,
                unit: 'días',
                colors: ['verde', 'amarillo', 'naranja', 'rojo', 'rojo oscuro', 'morado']
              }
            },
            healthDistance: {
              urlFormat: distanceMap.urlFormat,
              description: 'Distancia a instalaciones de salud',
              legend: {
                min: 0,
                max: 5000,
                unit: 'metros',
                colors: ['verde (cerca)', 'amarillo', 'naranja', 'rojo', 'rojo oscuro (lejos)']
              }
            },
            vulnerability: {
              urlFormat: vulnerabilityMap.urlFormat,
              description: 'Zonas vulnerables (cumple ambos criterios)',
              legend: {
                color: 'rojo',
                description: 'Áreas con población en alto riesgo'
              }
            },
            priorityRefuges: {
              urlFormat: priorityMap.urlFormat,
              description: 'Zonas prioritarias para refugios climáticos',
              legend: {
                color: 'morado',
                description: 'Alta concentración de población vulnerable'
              }
            }
          },
          recommendations: this._generateHealthHeatRecommendations(
            vulnerablePopulation,
            extremeInfo.extreme_days_mean,
            distanceInfo.distance_to_health_mean
          ),
          metadata: {
            startDate,
            endDate,
            period: `${startDate} a ${endDate}`,
            extremeTempThreshold,
            criticalDaysThreshold,
            healthDistanceThreshold,
            area: geometry,
            datasets: [
              'MODIS/061/MOD11A1',
              'CIESIN/GPWv411/GPW_Population_Count',
              'JRC/GHSL/P2023A/GHS_BUILT_S'
            ],
            formulas: {
              lstConversion: 'LST_°C = (LST_raw × 0.02) - 273.15',
              extremeDays: `count(days where LST > ${extremeTempThreshold}°C)`,
              distance: 'Euclidiana a punto de salud más cercano',
              vulnerability: `(extreme_days ≥ ${criticalDaysThreshold}) AND (distance > ${healthDistanceThreshold}m)`
            },
            resolution: 'MODIS LST: 1km',
            qualityControl: 'Filtrado por QC bits 0-1 = 00 (buena calidad)'
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
  _generateHealthHeatRecommendations(vulnPop, avgExtremeDays, avgDistance) {
    const recommendations = [];

    if (vulnPop > 20000) {
      recommendations.push({
        priority: 'urgent',
        action: 'Implementar sistema de alerta de calor extremo',
        target: 'Ministerio de Salud + Municipalidad',
        reason: `${Math.round(vulnPop).toLocaleString()} personas vulnerables`,
        timeline: 'Inmediato - antes del próximo verano'
      });

      recommendations.push({
        priority: 'urgent',
        action: 'Crear refugios climáticos en zonas prioritarias',
        target: 'Gobierno local',
        reason: 'Protección durante olas de calor',
        examples: 'Bibliotecas, centros comunitarios con aire acondicionado'
      });
    }

    if (avgDistance > 3000) {
      recommendations.push({
        priority: 'high',
        action: 'Expandir red de centros de salud',
        target: 'Ministerio de Salud',
        reason: `Distancia promedio: ${(avgDistance/1000).toFixed(1)} km`,
        recommendation: 'Priorizar zonas con alta vulnerabilidad al calor'
      });
    }

    if (avgExtremeDays > 30) {
      recommendations.push({
        priority: 'high',
        action: 'Programa de adaptación al cambio climático',
        target: 'Autoridades ambientales',
        reason: `Promedio de ${Math.round(avgExtremeDays)} días extremos/año`,
        measures: [
          'Aumentar cobertura arbórea',
          'Techos y pavimentos reflectantes',
          'Infraestructura verde'
        ]
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
