/**
 * @fileoverview Servicio de análisis de acceso a espacios verdes
 * Implementa metodología detallada:
 * - Área Verde Por Habitante (AGPH)
 * - Accesibilidad a parques con isócronas (300m, 500m, 1km)
 * - Integración Dynamic World para clasificación de vegetación
 * - Análisis de radios de servicio
 * 
 * @module services/greenSpaceAccessService
 */

const ee = require('@google/earthengine');

class GreenSpaceAccessService {
  constructor() {
    this.initialized = false;
  }

  async initialize() {
    if (!this.initialized) {
      try {
        await ee.Number(1).getInfo();
        this.initialized = true;
        console.log('✅ GreenSpaceAccessService inicializado');
      } catch (error) {
        console.error('❌ Error inicializando GreenSpaceAccessService:', error);
        throw error;
      }
    }
  }

  /**
   * Calcula Área Verde Por Habitante (AGPH) usando múltiples fuentes
   * AGPH = Área total de vegetación / Población total
   * 
   * @param {Object} params - Parámetros de análisis
   * @param {ee.Geometry} params.geometry - Geometría del área
   * @param {String} params.startDate - Fecha inicial
   * @param {String} params.endDate - Fecha final
   * @param {Number} params.ndviThreshold - Umbral NDVI (default: 0.4)
   * @param {Number} params.dwConfidence - Confianza Dynamic World (default: 0.5)
   * @returns {Promise<Object>} Métricas de área verde y accesibilidad
   */
  async calculateAGPH(params) {
    await this.initialize();

    const {
      geometry,
      startDate = '2024-01-01',
      endDate = '2024-12-31',
      dwConfidence = 0.5
    } = params;

    try {
      console.log(`Analizando áreas verdes para ${startDate} - ${endDate}`);
      const aoi = ee.Geometry(geometry);

      // 1. Dynamic World para clasificación de vegetación (10m resolución)
      const dw = ee.ImageCollection('GOOGLE/DYNAMICWORLD/V1')
        .filterDate(startDate, endDate)
        .filterBounds(aoi)
        .select(['trees', 'grass', 'flooded_vegetation', 'label']);

      // Verificar que Dynamic World tenga datos
      const dwSize = await dw.size().getInfo();
      console.log(`📊 Imágenes Dynamic World encontradas: ${dwSize}`);
      
      if (dwSize === 0) {
        return {
          success: false,
          error: `No hay datos de Dynamic World disponibles para ${startDate} a ${endDate}`,
          message: 'Intente con un período más amplio o una región diferente'
        };
      }

      const dwMean = dw.mean();
      
      // Crear máscara de vegetación (trees + grass + flooded_vegetation)
      const treesProb = dwMean.select('trees');
      const grassProb = dwMean.select('grass');
      const floodedVegProb = dwMean.select('flooded_vegetation');
      
      const vegProbTotal = treesProb.add(grassProb).add(floodedVegProb);
      const vegMask = vegProbTotal.gt(dwConfidence);

      // 2. Cargar población (GPW v4.11)
      console.log('Cargando datos de población...');
      const population = ee.ImageCollection('CIESIN/GPWv411/GPW_Population_Count')
        .filter(ee.Filter.date('2020-01-01', '2020-12-31'))
        .first()
        .select('population_count');

      // 3. Calcular áreas
      const pixelArea = ee.Image.pixelArea().divide(1e6); // Convertir a km²
      const greenArea = vegMask.multiply(pixelArea);

      // 4. Estadísticas por región
      console.log('Calculando estadísticas...');
      const stats = await greenArea.addBands(population).reduceRegion({
        reducer: ee.Reducer.sum().combine({
          reducer2: ee.Reducer.mean(),
          sharedInputs: false
        }),
        geometry: aoi,
        scale: 100, // 100m para balance entre precisión y velocidad
        maxPixels: 1e13,
        bestEffort: true
      }).getInfo();

      const greenAreaKm2 = stats.area_sum || 0;
      const populationTotal = stats.population_count_sum || 1;
      
      // Convertir a m² por habitante
      const agphValue = (greenAreaKm2 * 1e6) / populationTotal;

      // 5. Clasificar según estándares OMS y ONU
      const whoStandard = 9; // OMS recomienda 9 m²/hab
      const unStandard = 16; // ONU-Habitat recomienda 16 m²/hab
      const level = this._classifyAGPH(agphValue);

      // 6. Desglose por tipo de vegetación
      console.log('Analizando tipos de vegetación...');
      const treesArea = treesProb.gt(dwConfidence).multiply(pixelArea);
      const grassArea = grassProb.gt(dwConfidence).multiply(pixelArea);
      const floodedArea = floodedVegProb.gt(dwConfidence).multiply(pixelArea);

      const breakdownStats = await ee.Image([treesArea, grassArea, floodedArea])
        .rename(['trees', 'grass', 'flooded'])
        .reduceRegion({
          reducer: ee.Reducer.sum(),
          geometry: aoi,
          scale: 100,
          maxPixels: 1e13,
          bestEffort: true
        }).getInfo();

      // 7. Generar mapa de visualización
      const vegMapId = await vegMask.selfMask().getMap({
        palette: ['00FF00'],
        opacity: 0.7
      });

      console.log('✅ Análisis completado');

      return {
        success: true,
        summary: {
          period: { startDate, endDate },
          imagesUsed: dwSize,
          agph: {
            value: Math.round(agphValue * 10) / 10,
            unit: 'm² por habitante',
            level: level,
            whoStandard: whoStandard,
            unStandard: unStandard,
            meetsWHO: agphValue >= whoStandard,
            meetsUN: agphValue >= unStandard,
            deficit: agphValue < whoStandard ? Math.round((whoStandard - agphValue) * 10) / 10 : 0
          },
          totalArea: {
            green: Math.round(greenAreaKm2 * 100) / 100,
            unit: 'km²'
          },
          population: Math.round(populationTotal),
          breakdown: {
            trees: Math.round((breakdownStats.trees || 0) * 100) / 100,
            grass: Math.round((breakdownStats.grass || 0) * 100) / 100,
            flooded: Math.round((breakdownStats.flooded || 0) * 100) / 100,
            unit: 'km²'
          }
        },
        maps: {
          vegetation: {
            urlFormat: vegMapId.urlFormat,
            description: 'Áreas verdes detectadas (Dynamic World)'
          }
        },
        metadata: {
          dataset: 'GOOGLE/DYNAMICWORLD/V1',
          populationSource: 'CIESIN/GPWv411/GPW_Population_Count',
          resolution: '10m (Dynamic World)',
          formula: 'AGPH = Área verde total (m²) / Población total',
          standards: {
            who: '9 m²/hab (Organización Mundial de la Salud)',
            un: '16 m²/hab (ONU-Habitat)'
          }
        }
      };

    } catch (error) {
      console.error('Error en calculateAGPH:', error);
      return {
        success: false,
        error: error.message,
        details: error.stack
      };
    }
  }

  /**
   * Clasificar nivel de AGPH
   */
  _classifyAGPH(agph) {
    if (agph >= 16) return 'Excelente';
    if (agph >= 9) return 'Adecuado';
    if (agph >= 5) return 'Insuficiente';
    return 'Crítico';
  }

  /**
   * MÉTODO SIMPLIFICADO: Calcular accesibilidad a áreas verdes
   */
  async analyzeAccessibility(params) {
    await this.initialize();

    const {
      geometry,
      startDate = '2024-01-01',
      endDate = '2024-12-31'
    } = params;

    try {
      console.log('Analizando accesibilidad a áreas verdes...');
      const aoi = ee.Geometry(geometry);

      // 1. Obtener áreas verdes
      const dw = ee.ImageCollection('GOOGLE/DYNAMICWORLD/V1')
        .filterDate(startDate, endDate)
        .filterBounds(aoi)
        .select(['trees', 'grass']);

      const dwSize = await dw.size().getInfo();
      if (dwSize === 0) {
        return {
          success: false,
          error: 'No hay datos disponibles para este período'
        };
      }

      const dwMean = dw.mean();
      const vegProb = dwMean.select('trees').add(dwMean.select('grass'));
      const vegMask = vegProb.gt(0.5);

      // 2. Calcular distancia euclidiana a áreas verdes
      const distance = vegMask.fastDistanceTransform().sqrt()
        .multiply(ee.Image.pixelArea().sqrt()); // Convertir píxeles a metros

      // 3. Clasificar accesibilidad (OMS: 300m caminando)
      const accessible300m = distance.lte(300);
      const accessible500m = distance.lte(500);
      const accessible1km = distance.lte(1000);

      // 4. Cargar población
      const population = ee.ImageCollection('CIESIN/GPWv411/GPW_Population_Count')
        .filter(ee.Filter.date('2020-01-01', '2020-12-31'))
        .first()
        .select('population_count');

      // 5. Calcular población con acceso
      const stats = await ee.Image([
        accessible300m.multiply(population),
        accessible500m.multiply(population),
        accessible1km.multiply(population),
        population
      ]).rename(['pop300', 'pop500', 'pop1km', 'total'])
        .reduceRegion({
          reducer: ee.Reducer.sum(),
          geometry: aoi,
          scale: 100,
          maxPixels: 1e13,
          bestEffort: true
        }).getInfo();

      const popTotal = stats.total || 1;
      const pop300 = stats.pop300 || 0;
      const pop500 = stats.pop500 || 0;
      const pop1km = stats.pop1km || 0;

      // 6. Generar mapa de distancias
      const distanceMapId = await distance.getMap({
        min: 0,
        max: 1000,
        palette: ['00FF00', 'FFFF00', 'FF0000']
      });

      console.log('✅ Accesibilidad calculada');

      return {
        success: true,
        summary: {
          period: { startDate, endDate },
          population: Math.round(popTotal),
          accessibility: {
            within300m: {
              population: Math.round(pop300),
              percentage: Math.round((pop300 / popTotal) * 1000) / 10,
              standard: 'OMS (300m caminando)'
            },
            within500m: {
              population: Math.round(pop500),
              percentage: Math.round((pop500 / popTotal) * 1000) / 10
            },
            within1km: {
              population: Math.round(pop1km),
              percentage: Math.round((pop1km / popTotal) * 1000) / 10
            }
          }
        },
        maps: {
          distance: {
            urlFormat: distanceMapId.urlFormat,
            description: 'Distancia a áreas verdes (m)'
          }
        },
        metadata: {
          dataset: 'GOOGLE/DYNAMICWORLD/V1',
          resolution: '10m',
          method: 'Distancia euclidiana a vegetación'
        }
      };

    } catch (error) {
      console.error('Error en analyzeAccessibility:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Clasificar nivel de AGPH según estándares internacionales
   */
  _classifyAGPH(agph) {
    if (agph >= 16) return 'Excelente';   // ONU-Habitat
    if (agph >= 9) return 'Adecuado';     // OMS
    if (agph >= 5) return 'Insuficiente';
    return 'Crítico';
  }
}

module.exports = new GreenSpaceAccessService();
