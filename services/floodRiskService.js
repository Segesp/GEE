/**
 * @fileoverview Servicio de evaluación de riesgo de inundaciones
 * Implementa metodología detallada:
 * - GPM IMERG para precipitación extrema (percentil 90)
 * - Copernicus DEM para TWI (Topographic Wetness Index)
 * - Matriz de riesgo: precipitación × topografía × población
 * - Identificación de zonas vulnerables
 * 
 * @module services/floodRiskService
 */

const ee = require('@google/earthengine');

class FloodRiskService {
  constructor() {
    this.initialized = false;
  }

  async initialize() {
    if (!this.initialized) {
      try {
        await ee.Number(1).getInfo();
        this.initialized = true;
        console.log('✅ FloodRiskService inicializado');
      } catch (error) {
        console.error('❌ Error inicializando FloodRiskService:', error);
        throw error;
      }
    }
  }

  /**
   * Análisis completo de riesgo de inundaciones
   * 
   * @param {Object} params - Parámetros de análisis
   * @param {ee.Geometry} params.geometry - Geometría del área
   * @param {String} params.startDate - Fecha inicial para análisis de lluvia
   * @param {String} params.endDate - Fecha final
   * @param {Number} params.extremeThreshold - Umbral de lluvia extrema en mm (default: 100)
   * @returns {Promise<Object>} Análisis de riesgo y mapas
   */
  async analyzeFloodRisk(params) {
    await this.initialize();

    const {
      geometry,
      startDate = '2015-01-01',
      endDate = '2024-12-31',
      extremeThreshold = 100
    } = params;

    try {
      const aoi = ee.Geometry(geometry);

      // 1. Precipitación extrema de GPM IMERG
      const gpm = ee.ImageCollection('NASA/GPM_L3/IMERG_V07')
        .filterDate(startDate, endDate)
        .filterBounds(aoi)
        .select('precipitationCal');

      // Convertir a precipitación diaria (acumular cada día)
      const days = ee.List.sequence(
        ee.Date(startDate).millis(),
        ee.Date(endDate).millis(),
        24 * 60 * 60 * 1000 // 1 día en ms
      );

      const dailyPrecip = ee.ImageCollection.fromImages(
        days.map((day) => {
          const start = ee.Date(day);
          const end = start.advance(1, 'day');
          const dayImages = gpm.filterDate(start, end);
          return dayImages.sum()
            .set('system:time_start', start.millis())
            .set('date', start.format('YYYY-MM-dd'));
        })
      );

      // Calcular percentil 90 (precipitaciones extremas)
      const p90 = dailyPrecip.reduce(ee.Reducer.percentile([90])).rename('P90');

      // 2. Copernicus DEM para análisis topográfico
      const dem = ee.Image('COPERNICUS/DEM/GLO30').select('DEM');

      // Rellenar valores sin datos
      const filled = dem.unmask(0).focal_min(1, 'square', 'pixels');

      // 3. Calcular pendiente (en radianes)
      const slope = ee.Terrain.slope(filled).multiply(Math.PI / 180);

      // 4. Calcular TWI (Topographic Wetness Index)
      // TWI = ln(a / tan(β))
      // donde 'a' es área de contribución aguas arriba y 'β' es pendiente
      
      // Simplificación: usar acumulación de flujo como proxy de 'a'
      const flowAccumulation = filled.focal_mean(5, 'square', 'pixels')
        .divide(filled.add(1)); // Proxy simplificado

      const twi = flowAccumulation
        .divide(slope.tan().add(0.001)) // Evitar división por 0
        .log()
        .rename('TWI');

      // 5. Identificar zonas bajas (< percentil 25 de elevación)
      const elevStats = filled.reduceRegion({
        reducer: ee.Reducer.percentile([25]),
        geometry: aoi,
        scale: 30,
        maxPixels: 1e13,
        bestEffort: true
      });

      const [elevP25Info] = await Promise.all([elevStats.getInfo()]);
      const lowlandThreshold = elevP25Info.DEM_p25 || 0;
      const lowlands = filled.lte(lowlandThreshold);

      // 6. Matriz de Riesgo
      // Riesgo = (P90 > umbral) AND (TWI > media) AND (elevación baja)
      const twiStats = twi.reduceRegion({
        reducer: ee.Reducer.mean(),
        geometry: aoi,
        scale: 30,
        maxPixels: 1e13,
        bestEffort: true
      });

      const [twiMeanInfo] = await Promise.all([twiStats.getInfo()]);
      const twiMean = twiMeanInfo.TWI || 0;

      const highPrecip = p90.gt(extremeThreshold);
      const highTWI = twi.gt(twiMean);

      // Riesgo alto: cumple al menos 2 de 3 criterios
      const riskScore = highPrecip.add(highTWI).add(lowlands);
      const highRisk = riskScore.gte(2);

      // 7. Cargar población e infraestructura
      const population = ee.ImageCollection('CIESIN/GPWv411/GPW_Population_Count')
        .filter(ee.Filter.eq('year', 2020))
        .first()
        .select('population_count');

      const built = ee.ImageCollection('JRC/GHSL/P2023A/GHS_BUILT_S')
        .filter(ee.Filter.eq('year', 2020))
        .first()
        .select('built_surface')
        .gt(0);

      // 8. Población e infraestructura en riesgo
      const popRisk = population.updateMask(highRisk);
      const infraRisk = built.updateMask(highRisk);

      const riskStats = popRisk.addBands(infraRisk).reduceRegion({
        reducer: ee.Reducer.sum().repeat(2),
        geometry: aoi,
        scale: 100,
        maxPixels: 1e13,
        bestEffort: true
      });

      // 9. Estadísticas generales
      const precipStats = p90.reduceRegion({
        reducer: ee.Reducer.mean()
          .combine(ee.Reducer.max(), '', true)
          .combine(ee.Reducer.percentile([75, 90, 95]), '', true),
        geometry: aoi,
        scale: 11000,
        maxPixels: 1e13,
        bestEffort: true
      });

      // 10. Generar mapas
      const riskMapId = riskScore.getMap({
        min: 0,
        max: 3,
        palette: ['green', 'yellow', 'orange', 'red']
      });

      const p90MapId = p90.getMap({
        min: 0,
        max: 200,
        palette: ['white', 'lightblue', 'blue', 'darkblue', 'purple']
      });

      const twiMapId = twi.getMap({
        min: 0,
        max: 15,
        palette: ['brown', 'yellow', 'lightblue', 'blue']
      });

      // 11. Obtener valores
      const [
        riskInfo,
        precipInfo,
        riskMapInfo,
        p90MapInfo,
        twiMapInfo
      ] = await Promise.all([
        riskStats.getInfo(),
        precipStats.getInfo(),
        riskMapId.getInfo(),
        p90MapId.getInfo(),
        twiMapId.getInfo()
      ]);

      const popAtRisk = riskInfo.sum || 0;
      const infraAtRisk = riskInfo.sum_1 || 0;

      return {
        success: true,
        data: {
          precipitation: {
            p90Mean: precipInfo.P90_mean,
            p90Max: precipInfo.P90_max,
            p75: precipInfo.P90_p75,
            p95: precipInfo.P90_p95,
            unit: 'mm/día',
            extremeThreshold: extremeThreshold,
            description: 'Percentil 90 de precipitación diaria (2015-2024)'
          },
          topography: {
            twiMean: twiMean,
            lowlandThreshold: lowlandThreshold,
            unit: 'metros (elevación)',
            description: 'Índice de humedad topográfica y zonas bajas'
          },
          risk: {
            populationAffected: Math.round(popAtRisk),
            infrastructureAreaM2: Math.round(infraAtRisk),
            level: this._classifyRisk(popAtRisk),
            criteria: [
              `Precipitación P90 > ${extremeThreshold} mm`,
              `TWI > ${twiMean.toFixed(2)}`,
              `Elevación < ${lowlandThreshold.toFixed(1)} m`
            ],
            description: 'Zonas que cumplen al menos 2 de 3 criterios'
          },
          maps: {
            riskScore: {
              urlFormat: riskMapInfo.urlFormat,
              description: 'Puntaje de riesgo de inundación (0-3)',
              legend: {
                min: 0,
                max: 3,
                colors: ['verde (bajo)', 'amarillo', 'naranja', 'rojo (alto)'],
                description: '0=sin riesgo, 3=todos los factores'
              }
            },
            precipitation: {
              urlFormat: p90MapInfo.urlFormat,
              description: 'Precipitación extrema (P90)',
              legend: {
                min: 0,
                max: 200,
                unit: 'mm/día',
                colors: ['blanco', 'azul claro', 'azul', 'azul oscuro', 'morado']
              }
            },
            twi: {
              urlFormat: twiMapInfo.urlFormat,
              description: 'Índice de Humedad Topográfica (TWI)',
              legend: {
                min: 0,
                max: 15,
                colors: ['café (seco)', 'amarillo', 'azul claro', 'azul (húmedo)']
              }
            }
          },
          recommendations: this._generateFloodRecommendations(popAtRisk, infraAtRisk),
          metadata: {
            startDate,
            endDate,
            period: `${startDate} a ${endDate}`,
            extremeThreshold,
            area: geometry,
            datasets: [
              'NASA/GPM_L3/IMERG_V07',
              'COPERNICUS/DEM/GLO30',
              'CIESIN/GPWv411/GPW_Population_Count',
              'JRC/GHSL/P2023A/GHS_BUILT_S'
            ],
            formulas: {
              p90: 'Percentil 90 de precipitación diaria acumulada',
              twi: 'TWI = ln(área_contribución / tan(pendiente))',
              risk: 'Riesgo = Σ(precipitación_extrema + TWI_alto + elevación_baja) ≥ 2'
            },
            resolution: 'GPM: 11km, DEM: 30m'
          }
        }
      };

    } catch (error) {
      console.error('Error en analyzeFloodRisk:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Identifica zonas críticas de drenaje deficiente
   * 
   * @param {Object} params - Parámetros
   * @param {ee.Geometry} params.geometry - Geometría del área
   * @returns {Promise<Object>} Análisis de drenaje
   */
  async analyzeDrainageIssues(params) {
    await this.initialize();

    const { geometry } = params;

    try {
      const aoi = ee.Geometry(geometry);

      // 1. Cargar DEM
      const dem = ee.Image('COPERNICUS/DEM/GLO30').select('DEM');
      const filled = dem.unmask(0).focal_min(1, 'square', 'pixels');

      // 2. Calcular dirección de flujo
      const flowDirection = ee.Algorithms.Terrain(filled).select('aspect');

      // 3. Detectar depresiones (zonas sin salida)
      const flowAccumulation = filled.focal_mean(9, 'square', 'pixels');
      const depressions = filled.lt(flowAccumulation.subtract(5)); // Simplificación

      // 4. Áreas con pendiente muy baja (< 2%)
      const slope = ee.Terrain.slope(filled);
      const flatAreas = slope.lt(2);

      // 5. Combinar factores de mal drenaje
      const poorDrainage = depressions.or(flatAreas);

      // 6. Área afectada
      const pixelArea = ee.Image.pixelArea().divide(10000); // hectáreas
      const affectedArea = poorDrainage.multiply(pixelArea);

      const areaStats = affectedArea.reduceRegion({
        reducer: ee.Reducer.sum(),
        geometry: aoi,
        scale: 30,
        maxPixels: 1e13,
        bestEffort: true
      });

      const [areaInfo] = await Promise.all([areaStats.getInfo()]);
      const totalAffectedHa = areaInfo.constant || 0;

      return {
        success: true,
        data: {
          poorDrainage: {
            areaHectares: totalAffectedHa.toFixed(2),
            severity: totalAffectedHa > 100 ? 'high' : totalAffectedHa > 50 ? 'medium' : 'low',
            factors: ['Depresiones topográficas', 'Pendiente < 2%']
          },
          recommendations: [
            {
              priority: totalAffectedHa > 100 ? 'urgent' : 'medium',
              action: 'Mejorar sistemas de drenaje pluvial',
              target: 'Infraestructura municipal',
              areas: `${totalAffectedHa.toFixed(0)} hectáreas identificadas`
            }
          ]
        }
      };

    } catch (error) {
      console.error('Error en analyzeDrainageIssues:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Clasifica nivel de riesgo
   * @private
   */
  _classifyRisk(populationAffected) {
    if (populationAffected > 50000) return 'critical';
    if (populationAffected > 10000) return 'high';
    if (populationAffected > 1000) return 'medium';
    return 'low';
  }

  /**
   * Genera recomendaciones de mitigación
   * @private
   */
  _generateFloodRecommendations(popAtRisk, infraAtRisk) {
    const recommendations = [];

    if (popAtRisk > 10000) {
      recommendations.push({
        priority: 'urgent',
        action: 'Implementar sistema de alerta temprana de inundaciones',
        target: 'Defensa Civil',
        reason: `${Math.round(popAtRisk).toLocaleString()} personas en zonas de riesgo`
      });

      recommendations.push({
        priority: 'urgent',
        action: 'Crear refugios temporales en zonas seguras',
        target: 'Municipalidad',
        reason: 'Alta población vulnerable'
      });
    }

    if (infraAtRisk > 100000) {
      recommendations.push({
        priority: 'high',
        action: 'Reforzar infraestructura de drenaje',
        target: 'Obras públicas',
        reason: `${(infraAtRisk/10000).toFixed(1)} hectáreas de construcciones en riesgo`
      });
    }

    recommendations.push({
      priority: 'medium',
      action: 'Mapear y limpiar canales de drenaje existentes',
      target: 'Comunidad + municipalidad',
      reason: 'Mantenimiento preventivo'
    });

    recommendations.push({
      priority: 'low',
      action: 'Campañas de educación sobre riesgo de inundaciones',
      target: 'Población general',
      reason: 'Preparación comunitaria'
    });

    return recommendations;
  }
}

module.exports = new FloodRiskService();
