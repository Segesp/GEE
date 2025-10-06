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
   * Análisis simplificado de riesgo de inundaciones
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
      startDate = '2024-01-01',
      endDate = '2024-01-31',
      extremeThreshold = 50
    } = params;

    try {
      const aoi = ee.Geometry(geometry);

      console.log(`[Flood Risk] Analizando período ${startDate} a ${endDate}`);

      // 1. Precipitación de GPM IMERG (último año para rapidez)
      const gpm = ee.ImageCollection('NASA/GPM_L3/IMERG_V07')
        .filterDate(startDate, endDate)
        .filterBounds(aoi)
        .select('precipitation'); // Banda correcta: 'precipitation' (no 'precipitationCal')

      // VALIDACIÓN: Verificar imágenes disponibles
      const gpmSize = await gpm.size().getInfo();
      console.log(`[Flood Risk] Imágenes GPM disponibles: ${gpmSize}`);

      if (gpmSize === 0) {
        return {
          success: false,
          error: `No hay datos de precipitación (GPM) disponibles para el período ${startDate} a ${endDate}`,
          suggestion: 'GPM IMERG comenzó operaciones en 2000. Intente con fechas más recientes.'
        };
      }

      // Precipitación total del período (suma de todas las mediciones en mm)
      const totalPrecip = gpm.sum().multiply(0.5).rename('PRECIP_TOTAL'); // 0.5 = cada medición es 30min
      
      // Precipitación máxima diaria (aproximación: max de todas las mediciones)
      const maxPrecip = gpm.max().rename('PRECIP_MAX');

      // 2. Copernicus DEM para análisis topográfico
      const dem = ee.ImageCollection('COPERNICUS/DEM/GLO30')
        .select('DEM')
        .mosaic()
        .clip(aoi);

      // Pendiente en grados
      const slope = ee.Terrain.slope(dem);

      // Áreas de bajo drenaje (pendiente < 5 grados)
      const lowDrainage = slope.lt(5);

      // Áreas bajas (elevación < percentil 30)
      const elevMean = dem.reduceRegion({
        reducer: ee.Reducer.percentile([30]),
        geometry: aoi,
        scale: 100,
        maxPixels: 1e13,
        bestEffort: true
      });

      const elevInfo = await elevMean.getInfo();
      const lowElevThreshold = elevInfo.DEM_p30 || 100;
      const lowlands = dem.lt(lowElevThreshold);

      // 3. Calcular Riesgo de Inundación
      // Riesgo = (precipitación alta) + (pendiente baja) + (elevación baja)
      const highPrecip = totalPrecip.gt(extremeThreshold);
      const riskScore = highPrecip.add(lowDrainage).add(lowlands);
      
      // Riesgo alto = al menos 2 factores presentes
      const highRisk = riskScore.gte(2);

      // 4. Estadísticas de precipitación
      const precipStats = totalPrecip.addBands(maxPrecip).reduceRegion({
        reducer: ee.Reducer.mean()
          .combine(ee.Reducer.min(), '', true)
          .combine(ee.Reducer.max(), '', true)
          .combine(ee.Reducer.stdDev(), '', true),
        geometry: aoi,
        scale: 11000,
        maxPixels: 1e13,
        bestEffort: true
      });

      // 5. Área en riesgo
      const riskArea = highRisk.multiply(ee.Image.pixelArea()).divide(1e6); // a km²
      const riskStats = riskArea.reduceRegion({
        reducer: ee.Reducer.sum(),
        geometry: aoi,
        scale: 100,
        maxPixels: 1e13,
        bestEffort: true
      });

      // 6. Estadísticas topográficas
      const topoStats = slope.addBands(dem).reduceRegion({
        reducer: ee.Reducer.mean(),
        geometry: aoi,
        scale: 100,
        maxPixels: 1e13,
        bestEffort: true
      });

      // 7. Generar mapas
      const riskMapInfo = riskScore.getMap({
        min: 0,
        max: 3,
        palette: ['green', 'yellow', 'orange', 'red']
      });

      const precipMapInfo = totalPrecip.getMap({
        min: 0,
        max: 200,
        palette: ['white', 'lightblue', 'blue', 'darkblue', 'purple']
      });

      const slopeMapInfo = slope.getMap({
        min: 0,
        max: 30,
        palette: ['blue', 'green', 'yellow', 'orange', 'red']
      });

      // 8. Obtener todos los valores
      const [precipInfo, riskAreaInfo, topoInfo] = await Promise.all([
        precipStats.getInfo(),
        riskStats.getInfo(),
        topoStats.getInfo()
      ]);

      const riskLevel = this._classifyRisk(riskAreaInfo.constant || 0);

      console.log(`[Flood Risk] Precipitación total: ${precipInfo.PRECIP_TOTAL_mean.toFixed(1)} mm, Área en riesgo: ${(riskAreaInfo.constant || 0).toFixed(2)} km²`);

      return {
        success: true,
        summary: {
          period: { startDate, endDate },
          imagesUsed: gpmSize,
          precipitation: {
            total: precipInfo.PRECIP_TOTAL_mean,
            max: precipInfo.PRECIP_MAX_mean,
            unit: 'mm'
          },
          risk: {
            areaKm2: riskAreaInfo.constant || 0,
            level: riskLevel,
            threshold: extremeThreshold
          }
        },
        data: {
          precipitation: {
            totalMean: precipInfo.PRECIP_TOTAL_mean,
            totalMin: precipInfo.PRECIP_TOTAL_min,
            totalMax: precipInfo.PRECIP_TOTAL_max,
            maxDaily: precipInfo.PRECIP_MAX_mean,
            unit: 'mm',
            extremeThreshold: extremeThreshold,
            description: `Precipitación acumulada ${startDate} a ${endDate}`
          },
          topography: {
            meanSlope: topoInfo.slope,
            meanElevation: topoInfo.DEM,
            lowlandThreshold: lowElevThreshold,
            unit: 'grados (pendiente), metros (elevación)',
            description: 'Áreas con pendiente < 5° consideradas de bajo drenaje'
          },
          risk: {
            areaKm2: riskAreaInfo.constant || 0,
            level: riskLevel,
            criteria: [
              `Precipitación total > ${extremeThreshold} mm`,
              'Pendiente < 5° (bajo drenaje)',
              `Elevación < ${lowElevThreshold.toFixed(1)} m (zonas bajas)`
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
                colors: ['verde (bajo)', 'amarillo', 'naranja', 'rojo (alto)']
              }
            },
            precipitation: {
              urlFormat: precipMapInfo.urlFormat,
              description: 'Precipitación total acumulada',
              legend: {
                min: 0,
                max: 200,
                unit: 'mm',
                colors: ['blanco', 'azul claro', 'azul', 'azul oscuro', 'morado']
              }
            },
            slope: {
              urlFormat: slopeMapInfo.urlFormat,
              description: 'Pendiente del terreno',
              legend: {
                min: 0,
                max: 30,
                unit: 'grados',
                colors: ['azul (plano)', 'verde', 'amarillo', 'naranja', 'rojo (empinado)']
              }
            }
          },
          recommendations: this._generateFloodRecommendations(riskAreaInfo.constant || 0),
          metadata: {
            startDate,
            endDate,
            extremeThreshold,
            area: geometry,
            datasets: [
              'NASA/GPM_L3/IMERG_V07',
              'COPERNICUS/DEM/GLO30'
            ],
            formulas: {
              precipitation: 'Suma de mediciones cada 30min × 0.5',
              risk: 'Riesgo = Σ(precip_alta + pendiente_baja + elevación_baja) ≥ 2'
            },
            resolution: 'GPM: 11km, DEM: 30m',
            note: 'Análisis simplificado sin cálculo de población afectada'
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
      // GLO30 es una ImageCollection, no una Image individual
      const dem = ee.ImageCollection('COPERNICUS/DEM/GLO30')
        .select('DEM')
        .mosaic()  // Crear mosaico de todas las tiles
        .clip(aoi); // Recortar al área de interés
        
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
   * Clasifica nivel de riesgo basado en área afectada
   * @private
   */
  _classifyRisk(areaKm2) {
    if (areaKm2 > 100) return 'critical';
    if (areaKm2 > 50) return 'high';
    if (areaKm2 > 10) return 'medium';
    return 'low';
  }

  /**
   * Genera recomendaciones basadas en área en riesgo
   * @private
   */
  _generateFloodRecommendations(riskAreaKm2) {
    const recommendations = [];

    if (riskAreaKm2 > 50) {
      recommendations.push({
        priority: 'urgent',
        action: 'Implementar sistema de alerta temprana de inundaciones',
        target: 'Defensa Civil',
        reason: `${riskAreaKm2.toFixed(1)} km² en zona de alto riesgo`
      });

      recommendations.push({
        priority: 'high',
        action: 'Crear refugios temporales en zonas seguras',
        target: 'Municipalidad',
        reason: 'Área extensa vulnerable a inundaciones'
      });
    } else if (riskAreaKm2 > 10) {
      recommendations.push({
        priority: 'high',
        action: 'Reforzar infraestructura de drenaje en áreas identificadas',
        target: 'Obras públicas',
        reason: `${riskAreaKm2.toFixed(1)} km² requieren atención`
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
