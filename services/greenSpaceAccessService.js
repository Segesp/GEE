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
      ndviThreshold = 0.4,
      dwConfidence = 0.5
    } = params;

    try {
      const aoi = ee.Geometry(geometry);

      // 1. NDVI de MODIS para detectar vegetación general
      const ndviCollection = ee.ImageCollection('MODIS/MCD43A4_006_NDVI')
        .filterDate(startDate, endDate)
        .filterBounds(aoi);

      const ndviMean = ndviCollection.mean().select('NDVI');
      const vegMaskNDVI = ndviMean.gt(ndviThreshold);

      // 2. Dynamic World para clasificación detallada (10m resolución)
      const dw = ee.ImageCollection('GOOGLE/DYNAMICWORLD/V1')
        .filterDate(startDate, endDate)
        .filterBounds(aoi)
        .select(['trees', 'grass', 'flooded_vegetation', 'crops']);

      const dwMean = dw.mean();
      
      // Crear máscara de vegetación (trees + grass + flooded_vegetation)
      const treesProb = dwMean.select('trees');
      const grassProb = dwMean.select('grass');
      const floodedVegProb = dwMean.select('flooded_vegetation');
      
      const vegProbTotal = treesProb.add(grassProb).add(floodedVegProb);
      const vegMaskDW = vegProbTotal.gt(dwConfidence);

      // 3. Cargar población (GPW v4.11)
      const population = ee.ImageCollection('CIESIN/GPWv411/GPW_Population_Count')
        .filter(ee.Filter.eq('year', 2020))
        .first()
        .select('population_count');

      // 4. Calcular área de píxel y área verde total
      const pixelArea = ee.Image.pixelArea(); // m²
      const greenArea = vegMaskDW.multiply(pixelArea); // m² de vegetación

      // 5. Reducir por región
      const stats = greenArea.addBands(population).reduceRegion({
        reducer: ee.Reducer.sum().repeat(2),
        geometry: aoi,
        scale: 10, // Usar resolución de Dynamic World (10m)
        maxPixels: 1e13,
        bestEffort: true
      });

      const [statsInfo] = await Promise.all([stats.getInfo()]);

      const greenAreaTotal = statsInfo.sum || 0; // m²
      const populationTotal = statsInfo.sum_1 || 1; // habitantes

      // 6. Calcular AGPH (m² por habitante)
      const agph = greenAreaTotal / populationTotal;

      // 7. Clasificar según estándar OMS (9 m²/hab)
      const whoStandard = 9;
      const deficit = whoStandard - agph;
      const level = this._classifyAGPH(agph);

      // 8. Desglose por tipo de vegetación
      const treesArea = treesProb.gt(dwConfidence).multiply(pixelArea);
      const grassArea = grassProb.gt(dwConfidence).multiply(pixelArea);
      const floodedArea = floodedVegProb.gt(dwConfidence).multiply(pixelArea);

      const breakdownStats = treesArea
        .addBands(grassArea)
        .addBands(floodedArea)
        .reduceRegion({
          reducer: ee.Reducer.sum().repeat(3),
          geometry: aoi,
          scale: 10,
          maxPixels: 1e13,
          bestEffort: true
        });

      const [breakdownInfo] = await Promise.all([breakdownStats.getInfo()]);

      return {
        success: true,
        data: {
          agph: {
            value: agph,
            unit: 'm² por habitante',
            level: level,
            whoStandard: whoStandard,
            deficit: deficit > 0 ? deficit : 0,
            compliance: agph >= whoStandard ? 'Cumple' : 'No cumple'
          },
          greenSpace: {
            totalArea: greenAreaTotal,
            unit: 'm²',
            hectares: greenAreaTotal / 10000,
            breakdown: {
              trees: breakdownInfo.sum || 0,
              grass: breakdownInfo.sum_1 || 0,
              floodedVegetation: breakdownInfo.sum_2 || 0
            }
          },
          population: {
            total: populationTotal,
            unit: 'habitantes'
          },
          metadata: {
            startDate,
            endDate,
            ndviThreshold,
            dwConfidence,
            area: geometry,
            datasets: [
              'MODIS/MCD43A4_006_NDVI',
              'GOOGLE/DYNAMICWORLD/V1',
              'CIESIN/GPWv411/GPW_Population_Count'
            ],
            formulas: {
              agph: 'AGPH = Área total de vegetación (m²) / Población total',
              ndvi: 'NDVI = (NIR - Red) / (NIR + Red)'
            },
            references: {
              whoStandard: 'OMS recomienda mínimo 9 m²/habitante',
              resolution: 'Dynamic World: 10m, MODIS NDVI: 500m'
            }
          }
        }
      };

    } catch (error) {
      console.error('Error en calculateAGPH:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Análisis de accesibilidad a parques con isócronas
   * Calcula población dentro de 300m, 500m y 1km de parques
   * 
   * @param {Object} params - Parámetros
   * @param {ee.Geometry} params.geometry - Área de estudio
   * @param {ee.FeatureCollection|Array} params.parks - Parques (puntos o polígonos)
   * @param {Array<Number>} params.distances - Distancias de análisis [300, 500, 1000]
   * @returns {Promise<Object>} Métricas de accesibilidad
   */
  async analyzeParkAccessibility(params) {
    await this.initialize();

    const {
      geometry,
      parks,
      distances = [300, 500, 1000]
    } = params;

    try {
      const aoi = ee.Geometry(geometry);
      
      // Convertir parques a FeatureCollection si es necesario
      let parksFC;
      if (Array.isArray(parks)) {
        // Array de {lat, lng, name}
        const features = parks.map(p => 
          ee.Feature(ee.Geometry.Point([p.lng, p.lat]), {name: p.name})
        );
        parksFC = ee.FeatureCollection(features);
      } else {
        parksFC = ee.FeatureCollection(parks);
      }

      // Cargar población
      const population = ee.ImageCollection('CIESIN/GPWv411/GPW_Population_Count')
        .filter(ee.Filter.eq('year', 2020))
        .first()
        .select('population_count');

      // Convertir parques a raster
      const parksRaster = parksFC.reduceToImage({
        properties: ['system:index'],
        reducer: ee.Reducer.first()
      }).unmask(0).gt(0);

      // Calcular distancia euclidiana a parques (en metros)
      const distanceToPark = parksRaster.not().fastDistanceTransform({
        neighborhood: 256,
        units: 'pixels',
        metric: 'squared_euclidean'
      }).sqrt().multiply(ee.Image.pixelArea().sqrt());

      const results = {};

      // Calcular población dentro de cada radio
      for (const distance of distances) {
        const withinDistance = distanceToPark.lte(distance);
        const populationNear = population.updateMask(withinDistance);
        
        const stats = populationNear.reduceRegion({
          reducer: ee.Reducer.sum(),
          geometry: aoi,
          scale: 100,
          maxPixels: 1e13,
          bestEffort: true
        });

        const [statsInfo] = await Promise.all([stats.getInfo()]);
        results[`within_${distance}m`] = statsInfo.population_count || 0;
      }

      // Población total del área
      const totalPopStats = population.reduceRegion({
        reducer: ee.Reducer.sum(),
        geometry: aoi,
        scale: 100,
        maxPixels: 1e13,
        bestEffort: true
      });

      const [totalPopInfo] = await Promise.all([totalPopStats.getInfo()]);
      const totalPop = totalPopInfo.population_count || 1;

      // Calcular porcentajes
      const accessibility = {};
      for (const distance of distances) {
        const pop = results[`within_${distance}m`];
        accessibility[`within_${distance}m`] = {
          population: pop,
          percentage: (pop / totalPop * 100).toFixed(2),
          level: this._classifyAccessibility(pop / totalPop * 100, distance)
        };
      }

      // Contar número de parques
      const parksCount = await parksFC.size().getInfo();

      // Generar mapa de distancia
      const distanceMapId = distanceToPark.getMap({
        min: 0,
        max: 1000,
        palette: ['green', 'yellow', 'orange', 'red']
      });

      const [distanceMapInfo] = await Promise.all([distanceMapId.getInfo()]);

      return {
        success: true,
        data: {
          parks: {
            count: parksCount,
            density: (parksCount / (totalPop / 10000)).toFixed(2) // parques por 10k hab
          },
          accessibility: accessibility,
          population: {
            total: totalPop,
            unit: 'habitantes'
          },
          maps: {
            distance: {
              urlFormat: distanceMapInfo.urlFormat,
              description: 'Distancia a parque más cercano (metros)',
              legend: {
                min: 0,
                max: 1000,
                colors: ['verde', 'amarillo', 'naranja', 'rojo'],
                units: 'metros'
              }
            }
          },
          recommendations: this._generateAccessibilityRecommendations(accessibility, totalPop),
          metadata: {
            distances: distances,
            standard: 'Se recomienda que >75% de población viva a <300m de un parque',
            datasets: ['CIESIN/GPWv411/GPW_Population_Count']
          }
        }
      };

    } catch (error) {
      console.error('Error en analyzeParkAccessibility:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Análisis comparativo AGPH por barrio
   * 
   * @param {Object} params - Parámetros
   * @param {Array<Object>} params.neighborhoods - Array de {name, geometry}
   * @param {String} params.startDate - Fecha inicial
   * @param {String} params.endDate - Fecha final
   * @returns {Promise<Object>} Ranking de barrios por AGPH
   */
  async compareNeighborhoods(params) {
    await this.initialize();

    const {
      neighborhoods,
      startDate = '2024-01-01',
      endDate = '2024-12-31'
    } = params;

    try {
      const results = [];

      for (const neighborhood of neighborhoods) {
        const analysis = await this.calculateAGPH({
          geometry: neighborhood.geometry,
          startDate,
          endDate
        });

        if (analysis.success) {
          results.push({
            name: neighborhood.name,
            agph: analysis.data.agph.value,
            level: analysis.data.agph.level,
            greenAreaHa: analysis.data.greenSpace.hectares,
            population: analysis.data.population.total,
            deficit: analysis.data.agph.deficit
          });
        }
      }

      // Ordenar por AGPH (de mayor a menor)
      results.sort((a, b) => b.agph - a.agph);

      // Asignar rankings
      results.forEach((r, idx) => {
        r.rank = idx + 1;
      });

      return {
        success: true,
        data: {
          ranking: results,
          summary: {
            totalNeighborhoods: results.length,
            excellent: results.filter(r => r.level === 'excellent').length,
            good: results.filter(r => r.level === 'good').length,
            fair: results.filter(r => r.level === 'fair').length,
            poor: results.filter(r => r.level === 'poor').length,
            average: results.reduce((sum, r) => sum + r.agph, 0) / results.length
          }
        }
      };

    } catch (error) {
      console.error('Error en compareNeighborhoods:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Clasifica AGPH según estándares
   * @private
   */
  _classifyAGPH(agph) {
    if (agph >= 15) return 'excellent'; // >15 m²/hab
    if (agph >= 9) return 'good';        // 9-15 m²/hab (OMS)
    if (agph >= 5) return 'fair';        // 5-9 m²/hab
    return 'poor';                        // <5 m²/hab
  }

  /**
   * Clasifica accesibilidad a parques
   * @private
   */
  _classifyAccessibility(percentage, distance) {
    if (distance === 300) {
      if (percentage >= 75) return 'excellent';
      if (percentage >= 50) return 'good';
      if (percentage >= 25) return 'fair';
      return 'poor';
    } else if (distance === 500) {
      if (percentage >= 85) return 'excellent';
      if (percentage >= 65) return 'good';
      if (percentage >= 40) return 'fair';
      return 'poor';
    } else {
      if (percentage >= 95) return 'excellent';
      if (percentage >= 80) return 'good';
      if (percentage >= 60) return 'fair';
      return 'poor';
    }
  }

  /**
   * Genera recomendaciones de accesibilidad
   * @private
   */
  _generateAccessibilityRecommendations(accessibility, totalPop) {
    const recommendations = [];
    
    const within300 = parseFloat(accessibility.within_300m.percentage);
    
    if (within300 < 50) {
      recommendations.push({
        priority: 'high',
        action: 'Crear nuevos parques de barrio',
        reason: `Solo ${within300.toFixed(1)}% de población tiene acceso a <300m`,
        target: 'Incrementar a >75%'
      });
    } else if (within300 < 75) {
      recommendations.push({
        priority: 'medium',
        action: 'Expandir parques existentes',
        reason: `${within300.toFixed(1)}% tiene acceso, cercano al objetivo`,
        target: 'Incrementar a >75%'
      });
    } else {
      recommendations.push({
        priority: 'low',
        action: 'Mantener y mejorar calidad',
        reason: `${within300.toFixed(1)}% tiene buen acceso`,
        target: 'Mantener >75%'
      });
    }

    return recommendations;
  }
}

module.exports = new GreenSpaceAccessService();
