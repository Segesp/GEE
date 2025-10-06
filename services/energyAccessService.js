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
   * Análisis completo de acceso a energía mediante luces nocturnas
   * 
   * @param {Object} params - Parámetros de análisis
   * @param {ee.Geometry} params.geometry - Geometría del área
   * @param {String} params.startDate - Fecha inicial
   * @param {String} params.endDate - Fecha final
   * @param {Number} params.poorAccessThreshold - Umbral de radiancia per cápita (default: 0.5)
   * @param {Boolean} params.analyzeByDistrict - Si se analiza por distritos
   * @returns {Promise<Object>} Análisis de acceso a energía
   */
  async analyzeEnergyAccess(params) {
    await this.initialize();

    const {
      geometry,
      startDate = '2023-01-01',
      endDate = '2023-12-31',
      poorAccessThreshold = 0.5,
      analyzeByDistrict = false
    } = params;

    try {
      const aoi = ee.Geometry(geometry);

      // 1. Cargar VIIRS Black Marble VNP46A2
      // Dataset de luces nocturnas corregido por BRDF y rellenado
      const blackMarble = ee.ImageCollection('NOAA/VIIRS/DNB/MONTHLY_V1/VCMSLCFG')
        .filterDate(startDate, endDate)
        .filterBounds(aoi)
        .select('avg_rad'); // Radiancia promedio mensual

      // Calcular promedio del período
      const avgRadiance = blackMarble.mean().rename('radiance');

      // 2. Cargar población
      const population = ee.ImageCollection('CIESIN/GPWv411/GPW_Population_Count')
        .filter(ee.Filter.eq('year', 2020))
        .first()
        .select('population_count');

      // 3. Calcular radiancia per cápita
      // Unidad: nW/cm²·sr por habitante
      const radiancePerCapita = avgRadiance
        .divide(population.add(1)) // Evitar división por 0
        .rename('radiance_per_capita');

      // 4. Identificar áreas con pobre acceso
      // Umbral bajo: < 0.5 nW/cm²·sr por habitante
      const poorAccess = radiancePerCapita.lt(poorAccessThreshold);
      const moderateAccess = radiancePerCapita.gte(poorAccessThreshold)
        .and(radiancePerCapita.lt(2.0));
      const goodAccess = radiancePerCapita.gte(2.0);

      // 5. Calcular estadísticas por categoría
      const popPoor = population.updateMask(poorAccess);
      const popModerate = population.updateMask(moderateAccess);
      const popGood = population.updateMask(goodAccess);

      const stats = ee.Image([popPoor, popModerate, popGood]).reduceRegion({
        reducer: ee.Reducer.sum().repeat(3),
        geometry: aoi,
        scale: 500,
        maxPixels: 1e13,
        bestEffort: true
      });

      // 6. Estadísticas de radiancia general
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

      const perCapitaStats = radiancePerCapita.reduceRegion({
        reducer: ee.Reducer.mean()
          .combine(ee.Reducer.median(), '', true)
          .combine(ee.Reducer.percentile([10, 25, 75]), '', true),
        geometry: aoi,
        scale: 500,
        maxPixels: 1e13,
        bestEffort: true
      });

      // 7. Detectar "manchas oscuras" (áreas con radiancia < 0.1)
      const darkSpots = avgRadiance.lt(0.1);
      const darkSpotsWithPop = darkSpots.and(population.gt(100));
      
      const darkPopulation = population.updateMask(darkSpotsWithPop);
      const darkStats = darkPopulation.reduceRegion({
        reducer: ee.Reducer.sum(),
        geometry: aoi,
        scale: 500,
        maxPixels: 1e13,
        bestEffort: true
      });

      // 8. Generar mapas
      const radianceMapId = avgRadiance.getMap({
        min: 0,
        max: 20,
        palette: ['000000', '330033', '663366', '996699', 'ffcc00', 'ffff00', 'ffffff']
      });

      const perCapitaMapId = radiancePerCapita.getMap({
        min: 0,
        max: 5,
        palette: ['8b0000', 'ff0000', 'ff8c00', 'ffd700', 'ffff00', '00ff00', '00ffff']
      });

      const accessMapId = poorAccess.add(moderateAccess.multiply(2)).add(goodAccess.multiply(3))
        .getMap({
          min: 1,
          max: 3,
          palette: ['red', 'yellow', 'green']
        });

      // 9. Obtener valores
      const [
        statsInfo,
        radianceInfo,
        perCapitaInfo,
        darkInfo,
        radianceMap,
        perCapitaMap,
        accessMap
      ] = await Promise.all([
        stats.getInfo(),
        radianceStats.getInfo(),
        perCapitaStats.getInfo(),
        darkStats.getInfo(),
        radianceMapId.getInfo(),
        perCapitaMapId.getInfo(),
        accessMapId.getInfo()
      ]);

      const popPoorAccess = statsInfo.sum || 0;
      const popModerateAccess = statsInfo.sum_1 || 0;
      const popGoodAccess = statsInfo.sum_2 || 0;
      const totalPop = popPoorAccess + popModerateAccess + popGoodAccess;

      const darkPopCount = darkInfo.sum || 0;

      return {
        success: true,
        data: {
          radiance: {
            mean: radianceInfo.radiance_mean,
            median: radianceInfo.radiance_median,
            p25: radianceInfo.radiance_p25,
            p75: radianceInfo.radiance_p75,
            p90: radianceInfo.radiance_p90,
            max: radianceInfo.radiance_max,
            unit: 'nW/cm²·sr',
            description: 'Radiancia promedio de luces nocturnas'
          },
          perCapita: {
            mean: perCapitaInfo.radiance_per_capita_mean,
            median: perCapitaInfo.radiance_per_capita_median,
            p10: perCapitaInfo.radiance_per_capita_p10,
            p25: perCapitaInfo.radiance_per_capita_p25,
            p75: perCapitaInfo.radiance_per_capita_p75,
            unit: 'nW/cm²·sr por habitante',
            description: 'Radiancia normalizada por población'
          },
          access: {
            poorAccess: {
              population: Math.round(popPoorAccess),
              percentage: ((popPoorAccess / totalPop) * 100).toFixed(1),
              threshold: `< ${poorAccessThreshold}`,
              level: 'critical',
              description: 'Población con acceso deficiente a alumbrado/energía'
            },
            moderateAccess: {
              population: Math.round(popModerateAccess),
              percentage: ((popModerateAccess / totalPop) * 100).toFixed(1),
              threshold: `${poorAccessThreshold} - 2.0`,
              level: 'medium',
              description: 'Población con acceso moderado'
            },
            goodAccess: {
              population: Math.round(popGoodAccess),
              percentage: ((popGoodAccess / totalPop) * 100).toFixed(1),
              threshold: '≥ 2.0',
              level: 'good',
              description: 'Población con buen acceso'
            }
          },
          darkSpots: {
            population: Math.round(darkPopCount),
            percentage: ((darkPopCount / totalPop) * 100).toFixed(1),
            threshold: '< 0.1 nW/cm²·sr',
            description: 'Áreas prácticamente sin iluminación nocturna'
          },
          maps: {
            radiance: {
              urlFormat: radianceMap.urlFormat,
              description: 'Radiancia de luces nocturnas',
              legend: {
                min: 0,
                max: 20,
                unit: 'nW/cm²·sr',
                colors: ['negro', 'morado oscuro', 'morado', 'rosa', 'amarillo', 'amarillo brillante', 'blanco']
              }
            },
            perCapita: {
              urlFormat: perCapitaMap.urlFormat,
              description: 'Radiancia per cápita',
              legend: {
                min: 0,
                max: 5,
                unit: 'nW/cm²·sr por hab',
                colors: ['rojo oscuro', 'rojo', 'naranja', 'dorado', 'amarillo', 'verde', 'cian']
              }
            },
            accessLevel: {
              urlFormat: accessMap.urlFormat,
              description: 'Nivel de acceso a alumbrado/energía',
              legend: {
                categories: [
                  { value: 1, color: 'rojo', label: 'Deficiente' },
                  { value: 2, color: 'amarillo', label: 'Moderado' },
                  { value: 3, color: 'verde', label: 'Bueno' }
                ]
              }
            }
          },
          recommendations: this._generateEnergyRecommendations(
            popPoorAccess,
            darkPopCount,
            totalPop
          ),
          metadata: {
            startDate,
            endDate,
            period: `${startDate} a ${endDate}`,
            poorAccessThreshold,
            area: geometry,
            datasets: [
              'NOAA/VIIRS/DNB/MONTHLY_V1/VCMSLCFG',
              'CIESIN/GPWv411/GPW_Population_Count'
            ],
            formulas: {
              radiancePerCapita: 'radiancia_promedio / población',
              accessLevel: `poor: < ${poorAccessThreshold}, moderate: ${poorAccessThreshold}-2.0, good: ≥ 2.0`
            },
            resolution: 'VIIRS: 500m, GPW: ~1km',
            interpretation: {
              radiance: 'Mayor radiancia indica más iluminación artificial',
              perCapita: 'Normalizado por población, evita sesgo de densidad',
              darkSpots: 'Zonas con población pero sin iluminación nocturna'
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
  _generateEnergyRecommendations(popPoorAccess, darkPopCount, totalPop) {
    const recommendations = [];

    const percentPoor = (popPoorAccess / totalPop) * 100;

    if (percentPoor > 30) {
      recommendations.push({
        priority: 'urgent',
        action: 'Auditoría de cobertura eléctrica y alumbrado público',
        target: 'Empresa distribuidora + Municipalidad',
        reason: `${percentPoor.toFixed(1)}% de la población con acceso deficiente`,
        estimatedCost: 'Alto - requiere inversión en infraestructura'
      });
    }

    if (darkPopCount > 5000) {
      recommendations.push({
        priority: 'urgent',
        action: 'Instalar alumbrado público en "manchas oscuras"',
        target: 'Municipalidad',
        reason: `${Math.round(darkPopCount).toLocaleString()} personas en zonas sin iluminación`,
        estimatedCost: 'Medio - instalación de postes y luminarias LED'
      });
    }

    if (percentPoor > 10 && percentPoor <= 30) {
      recommendations.push({
        priority: 'high',
        action: 'Programa de mejora de alumbrado en barrios prioritarios',
        target: 'Gobierno local',
        reason: 'Acceso deficiente en áreas específicas',
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
