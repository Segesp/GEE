/**
 * @fileoverview Servicio de análisis de acceso a energía y alumbrado público
 * Implementa metodología con VIIRS Black Marble:
 * - Luces nocturnas (VNP46A2) como proxy de electrificación
 * - Radiancia per cápita (nW/cm²·sr por habitante)
 * - Identificación de áreas con déficit de alumbrado
 * - Priorización para proyectos de electrificación
 * 
 * @module services/energyAccessService
 */

const ee = require('@google/earthengine');

class EnergyAccessService {
  constructor() {
    this.initialized = false;
  }

  async initialize() {
    if (!this.initialized) {
      try {
        await ee.Number(1).getInfo();
        this.initialized = true;
        console.log('✅ EnergyAccessService inicializado');
      } catch (error) {
        console.error('❌ Error inicializando EnergyAccessService:', error);
        throw error;
      }
    }
  }

  /**
   * Análisis simplificado de acceso a energía mediante luces nocturnas
   * 
   * @param {Object} params - Parámetros de análisis
   * @param {ee.Geometry} params.geometry - Geometría del área
   * @param {String} params.startDate - Fecha inicial
   * @param {String} params.endDate - Fecha final
   * @param {Number} params.lowLightThreshold - Umbral de radiancia baja (default: 5)
   * @returns {Promise<Object>} Análisis de acceso a energía
   */
  async analyzeEnergyAccess(params) {
    await this.initialize();

    const {
      geometry,
      startDate = '2023-01-01',
      endDate = '2023-12-31',
      lowLightThreshold = 5
    } = params;

    try {
      const aoi = ee.Geometry(geometry);

      console.log(`[Energy Access] Analizando período ${startDate} a ${endDate}`);

      // 1. Cargar VIIRS Black Marble (luces nocturnas)
      const blackMarble = ee.ImageCollection('NOAA/VIIRS/DNB/MONTHLY_V1/VCMSLCFG')
        .filterDate(startDate, endDate)
        .filterBounds(aoi)
        .select('avg_rad');

      // VALIDACIÓN: Verificar imágenes disponibles
      const viirsSize = await blackMarble.size().getInfo();
      console.log(`[Energy Access] Imágenes VIIRS disponibles: ${viirsSize}`);

      if (viirsSize === 0) {
        return {
          success: false,
          error: `No hay datos de VIIRS Black Marble disponibles para el período ${startDate} a ${endDate}`,
          suggestion: 'VIIRS comenzó operaciones en 2012. Use fechas desde 2012 en adelante.'
        };
      }

      // Calcular promedio del período
      const avgRadiance = blackMarble.mean().rename('radiance');

      // 2. Clasificar áreas por intensidad de luz
      const darkAreas = avgRadiance.lt(lowLightThreshold); // Sin/poco alumbrado
      const moderateAreas = avgRadiance.gte(lowLightThreshold).and(avgRadiance.lt(20));
      const brightAreas = avgRadiance.gte(20); // Bien iluminadas

      // 3. Calcular áreas (en km²)
      const pixelAreaKm2 = ee.Image.pixelArea().divide(1e6);
      const darkAreaKm2 = darkAreas.multiply(pixelAreaKm2);
      const moderateAreaKm2 = moderateAreas.multiply(pixelAreaKm2);
      const brightAreaKm2 = brightAreas.multiply(pixelAreaKm2);

      // 4. Estadísticas de radiancia
      const radianceStats = avgRadiance.reduceRegion({
        reducer: ee.Reducer.mean()
          .combine(ee.Reducer.median(), '', true)
          .combine(ee.Reducer.percentile([25, 75, 90]), '', true)
          .combine(ee.Reducer.max(), '', true),
        geometry: aoi,
        scale: 500,
        maxPixels: 1e13,
        bestEffort: true
      });

      // 5. Calcular áreas por categoría
      const areaStats = ee.Image([darkAreaKm2, moderateAreaKm2, brightAreaKm2]).reduceRegion({
        reducer: ee.Reducer.sum().repeat(3),
        geometry: aoi,
        scale: 500,
        maxPixels: 1e13,
        bestEffort: true
      });

      // 6. Generar mapas
      const radianceMap = avgRadiance.getMap({
        min: 0,
        max: 50,
        palette: ['000000', '330033', '663366', '996699', 'ffcc00', 'ffff00', 'ffffff']
      });

      const accessMap = darkAreas.add(moderateAreas.multiply(2)).add(brightAreas.multiply(3))
        .selfMask()
        .getMap({
          min: 1,
          max: 3,
          palette: ['red', 'yellow', 'green']
        });

      // 7. Obtener valores
      const [radianceInfo, areaInfo] = await Promise.all([
        radianceStats.getInfo(),
        areaStats.getInfo()
      ]);

      const darkArea = Number(areaInfo.sum || 0);
      const moderateArea = Number(areaInfo.sum_1 || 0);
      const brightArea = Number(areaInfo.sum_2 || 0);
      const totalArea = darkArea + moderateArea + brightArea;

      const radianceMean = Number(radianceInfo.radiance_mean || 0);

      console.log(`[Energy Access] Radiancia media: ${radianceMean.toFixed(2)} nW/cm²·sr, Áreas oscuras: ${darkArea.toFixed(2)} km²`);

      return {
        success: true,
        summary: {
          period: { startDate, endDate },
          imagesUsed: viirsSize,
          radiance: {
            mean: radianceInfo.radiance_mean,
            median: radianceInfo.radiance_median,
            unit: 'nW/cm²·sr'
          },
          coverage: {
            darkAreaKm2: darkArea,
            darkPercent: (darkArea / totalArea * 100).toFixed(1)
          }
        },
        data: {
          radiance: {
            mean: radianceInfo.radiance_mean,
            median: radianceInfo.radiance_median,
            p25: radianceInfo.radiance_p25,
            p75: radianceInfo.radiance_p75,
            p90: radianceInfo.radiance_p90,
            max: radianceInfo.radiance_max,
            unit: 'nW/cm²·sr',
            description: 'Radiancia promedio de luces nocturnas VIIRS'
          },
          coverage: {
            darkAreas: {
              areaKm2: darkArea,
              percentage: (darkArea / totalArea * 100).toFixed(1),
              threshold: `< ${lowLightThreshold}`,
              level: 'poor',
              description: 'Áreas con poca o ninguna iluminación nocturna'
            },
            moderateAreas: {
              areaKm2: moderateArea,
              percentage: (moderateArea / totalArea * 100).toFixed(1),
              threshold: `${lowLightThreshold} - 20`,
              level: 'moderate',
              description: 'Áreas con iluminación moderada'
            },
            brightAreas: {
              areaKm2: brightArea,
              percentage: (brightArea / totalArea * 100).toFixed(1),
              threshold: '≥ 20',
              level: 'good',
              description: 'Áreas bien iluminadas'
            }
          },
          maps: {
            radiance: {
              urlFormat: radianceMap.urlFormat,
              description: 'Radiancia de luces nocturnas (VIIRS)',
              legend: {
                min: 0,
                max: 50,
                unit: 'nW/cm²·sr',
                colors: ['negro', 'morado oscuro', 'morado', 'rosa', 'amarillo', 'amarillo brillante', 'blanco']
              }
            },
            accessLevel: {
              urlFormat: accessMap.urlFormat,
              description: 'Nivel de iluminación nocturna',
              legend: {
                categories: [
                  { value: 1, color: 'rojo', label: 'Oscuro (poca iluminación)' },
                  { value: 2, color: 'amarillo', label: 'Moderado' },
                  { value: 3, color: 'verde', label: 'Brillante (bien iluminado)' }
                ]
              }
            }
          },
          recommendations: this._generateEnergyRecommendations(darkArea, totalArea),
          metadata: {
            startDate,
            endDate,
            lowLightThreshold,
            area: geometry,
            datasets: ['NOAA/VIIRS/DNB/MONTHLY_V1/VCMSLCFG'],
            resolution: 'VIIRS: ~500m',
            note: 'Análisis simplificado sin cálculo per cápita. La radiancia nocturna es un proxy de electrificación y alumbrado público.',
            interpretation: {
              radiance: 'Mayor radiancia indica más iluminación artificial y posiblemente mejor acceso a electricidad',
              darkAreas: 'Áreas prioritarias para proyectos de electrificación o mejora de alumbrado público'
            }
          }
        }
      };

    } catch (error) {
      console.error('Error en analyzeEnergyAccess:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Identifica zonas prioritarias para proyectos de electrificación
   * 
   * @param {Object} params - Parámetros
   * @param {ee.Geometry} params.geometry - Geometría del área
   * @returns {Promise<Object>} Zonas priorizadas
   */
  async identifyElectrificationPriorities(params) {
    await this.initialize();

    const { geometry } = params;

    try {
      const aoi = ee.Geometry(geometry);

      // 1. Luces nocturnas muy bajas
      const blackMarble = ee.ImageCollection('NOAA/VIIRS/DNB/MONTHLY_V1/VCMSLCFG')
        .filterDate('2023-01-01', '2023-12-31')
        .filterBounds(aoi)
        .select('avg_rad')
        .mean();

      const lowLight = blackMarble.lt(0.5);

      // 2. Población presente
      const population = ee.ImageCollection('CIESIN/GPWv411/GPW_Population_Count')
        .filter(ee.Filter.eq('year', 2020))
        .first()
        .select('population_count');

      const inhabited = population.gt(50);

      // 3. Zonas prioritarias: baja luz + población
      const priority = lowLight.and(inhabited);

      const priorityPop = population.updateMask(priority);
      const priorityStats = priorityPop.reduceRegion({
        reducer: ee.Reducer.sum(),
        geometry: aoi,
        scale: 500,
        maxPixels: 1e13,
        bestEffort: true
      });

      const [priorityInfo] = await Promise.all([priorityStats.getInfo()]);
      const totalPriorityPop = priorityInfo.population_count || 0;

      return {
        success: true,
        data: {
          priorityAreas: {
            populationAffected: Math.round(totalPriorityPop),
            criteria: ['Radiancia < 0.5 nW/cm²·sr', 'Población > 50 hab/pixel'],
            urgency: totalPriorityPop > 10000 ? 'high' : totalPriorityPop > 1000 ? 'medium' : 'low'
          },
          recommendations: [
            {
              priority: 'urgent',
              action: 'Evaluar factibilidad de red eléctrica',
              target: 'Empresa distribuidora',
              reason: `${Math.round(totalPriorityPop).toLocaleString()} personas sin acceso adecuado`
            },
            {
              priority: 'high',
              action: 'Considerar soluciones alternativas (solar comunitaria)',
              target: 'Comunidad + ONGs',
              reason: 'Para áreas remotas sin cobertura de red'
            },
            {
              priority: 'medium',
              action: 'Mejorar alumbrado público en zonas oscuras',
              target: 'Municipalidad',
              reason: 'Seguridad ciudadana'
            }
          ]
        }
      };

    } catch (error) {
      console.error('Error en identifyElectrificationPriorities:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Compara cambios en electrificación a lo largo del tiempo
   * 
   * @param {Object} params - Parámetros
   * @param {ee.Geometry} params.geometry - Geometría del área
   * @param {String} params.startYear - Año inicial (YYYY)
   * @param {String} params.endYear - Año final (YYYY)
   * @returns {Promise<Object>} Análisis temporal
   */
  async analyzeElectrificationTrends(params) {
    await this.initialize();

    const {
      geometry,
      startYear = '2020',
      endYear = '2023'
    } = params;

    try {
      const aoi = ee.Geometry(geometry);

      // Radiancia al inicio
      const radianceStart = ee.ImageCollection('NOAA/VIIRS/DNB/MONTHLY_V1/VCMSLCFG')
        .filterDate(`${startYear}-01-01`, `${startYear}-12-31`)
        .filterBounds(aoi)
        .select('avg_rad')
        .mean();

      // Radiancia al final
      const radianceEnd = ee.ImageCollection('NOAA/VIIRS/DNB/MONTHLY_V1/VCMSLCFG')
        .filterDate(`${endYear}-01-01`, `${endYear}-12-31`)
        .filterBounds(aoi)
        .select('avg_rad')
        .mean();

      // Cambio absoluto y relativo
      const change = radianceEnd.subtract(radianceStart);
      const relativeChange = change.divide(radianceStart.add(0.1)).multiply(100);

      // Áreas con mejora significativa (>20% aumento)
      const improved = relativeChange.gt(20);
      const declined = relativeChange.lt(-20);

      const changeStats = change.reduceRegion({
        reducer: ee.Reducer.mean()
          .combine(ee.Reducer.median(), '', true)
          .combine(ee.Reducer.percentile([10, 90]), '', true),
        geometry: aoi,
        scale: 500,
        maxPixels: 1e13,
        bestEffort: true
      });

      const [changeInfo] = await Promise.all([changeStats.getInfo()]);

      return {
        success: true,
        data: {
          trends: {
            meanChange: changeInfo.avg_rad_mean,
            medianChange: changeInfo.avg_rad_median,
            p10: changeInfo.avg_rad_p10,
            p90: changeInfo.avg_rad_p90,
            unit: 'nW/cm²·sr',
            period: `${startYear} a ${endYear}`,
            interpretation: changeInfo.avg_rad_mean > 0 ? 'Mejora general' : 'Deterioro general'
          }
        }
      };

    } catch (error) {
      console.error('Error en analyzeElectrificationTrends:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Genera recomendaciones de electrificación
   * @private
   */
  _generateEnergyRecommendations(darkAreaKm2, totalAreaKm2) {
    const recommendations = [];

    const percentDark = (darkAreaKm2 / totalAreaKm2) * 100;

    if (percentDark > 30) {
      recommendations.push({
        priority: 'urgent',
        action: 'Auditoría de cobertura de alumbrado público',
        target: 'Empresa distribuidora + Municipalidad',
        reason: `${percentDark.toFixed(1)}% del área con iluminación deficiente (${darkAreaKm2.toFixed(1)} km²)`,
        estimatedCost: 'Alto - requiere inversión en infraestructura'
      });
    } else if (percentDark > 10) {
      recommendations.push({
        priority: 'high',
        action: 'Programa de mejora de alumbrado en zonas prioritarias',
        target: 'Gobierno local',
        reason: `${darkAreaKm2.toFixed(1)} km² con poca iluminación`,
        estimatedCost: 'Medio'
      });
    }

    recommendations.push({
      priority: 'medium',
      action: 'Estudiar viabilidad de energía solar comunitaria',
      target: 'ONGs + Comunidad',
      reason: 'Alternativa sustentable para áreas remotas',
      estimatedCost: 'Bajo a medio - paneles fotovoltaicos'
    });

    recommendations.push({
      priority: 'low',
      action: 'Campaña de eficiencia energética',
      target: 'Población general',
      reason: 'Optimizar uso de energía disponible',
      estimatedCost: 'Bajo - campañas educativas'
    });

    return recommendations;
  }
}

module.exports = new EnergyAccessService();
