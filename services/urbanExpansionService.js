/**
 * @fileoverview Servicio de análisis de expansión urbana y pérdida de vegetación
 * Implementa metodología detallada:
 * - Análisis temporal GHSL (comparación entre años)
 * - Detección de transiciones: vegetación → construido
 * - Dynamic World para clasificación precisa
 * - Cuantificación de pérdida de áreas verdes
 * - Mapas de cambio por sector
 * 
 * @module services/urbanExpansionService
 */

const ee = require('@google/earthengine');

class UrbanExpansionService {
  constructor() {
    this.initialized = false;
    
    // Años disponibles en GHSL
    this.availableYears = [1975, 1980, 1985, 1990, 1995, 2000, 2005, 2010, 2015, 2020, 2025, 2030];
    
    // Clases de Dynamic World
    this.dwClasses = {
      water: 0,
      trees: 1,
      grass: 2,
      flooded_vegetation: 3,
      crops: 4,
      shrub_and_scrub: 5,
      built: 6,
      bare: 7,
      snow_and_ice: 8
    };
  }

  async initialize() {
    if (!this.initialized) {
      try {
        await ee.Number(1).getInfo();
        this.initialized = true;
        console.log('✅ UrbanExpansionService inicializado');
      } catch (error) {
        console.error('❌ Error inicializando UrbanExpansionService:', error);
        throw error;
      }
    }
  }

  /**
   * Analiza expansión urbana entre dos años usando GHSL (simplificado)
   * 
   * @param {Object} params - Parámetros de análisis
   * @param {ee.Geometry} params.geometry - Geometría del área
   * @param {Number} params.yearStart - Año inicial (1975-2030)
   * @param {Number} params.yearEnd - Año final (1975-2030)
   * @returns {Promise<Object>} Métricas de expansión y mapas
   */
  async analyzeUrbanExpansion(params) {
    await this.initialize();

    const {
      geometry,
      yearStart = 2015,
      yearEnd = 2020
    } = params;

    try {
      const aoi = ee.Geometry(geometry);

      console.log(`[Urban Expansion] Analizando ${yearStart} → ${yearEnd}`);

      // Validar años
      if (!this.availableYears.includes(yearStart) || !this.availableYears.includes(yearEnd)) {
        return {
          success: false,
          error: `Años deben estar en: ${this.availableYears.join(', ')}`,
          suggestion: 'Use años entre 1975 y 2030 en intervalos de 5 años'
        };
      }

      // 1. Cargar GHSL para ambos años
      const ghslCollection = ee.ImageCollection('JRC/GHSL/P2023A/GHS_BUILT_S');
      
      const ghslStart = ghslCollection
        .filterBounds(aoi)
        .filterDate(`${yearStart}-01-01`, `${yearStart}-12-31`)
        .first();

      const ghslEnd = ghslCollection
        .filterBounds(aoi)
        .filterDate(`${yearEnd}-01-01`, `${yearEnd}-12-31`)
        .first();

      // Verificar que existan datos
      if (!ghslStart || !ghslEnd) {
        return {
          success: false,
          error: `No hay datos de GHSL para los años ${yearStart} o ${yearEnd}`,
          suggestion: 'Intente con años diferentes'
        };
      }

      const builtStart_band = ghslStart.select('built_surface');
      const builtEnd_band = ghslEnd.select('built_surface');

      // 2. Áreas construidas en cada año (convertir a km²)
      const builtStart = builtStart_band.gt(0).multiply(ee.Image.pixelArea()).divide(1e6);
      const builtEnd = builtEnd_band.gt(0).multiply(ee.Image.pixelArea()).divide(1e6);

      // 3. Nueva urbanización (donde antes no había construcción)
      const newUrban = builtStart_band.eq(0).and(builtEnd_band.gt(0));
      const newUrbanArea = newUrban.multiply(ee.Image.pixelArea()).divide(1e6);

      // 4. Calcular estadísticas
      const statsStart = builtStart.reduceRegion({
        reducer: ee.Reducer.sum(),
        geometry: aoi,
        scale: 100,
        maxPixels: 1e13,
        bestEffort: true
      });

      const statsEnd = builtEnd.reduceRegion({
        reducer: ee.Reducer.sum(),
        geometry: aoi,
        scale: 100,
        maxPixels: 1e13,
        bestEffort: true
      });

      const statsNew = newUrbanArea.reduceRegion({
        reducer: ee.Reducer.sum(),
        geometry: aoi,
        scale: 100,
        maxPixels: 1e13,
        bestEffort: true
      });

      // 5. Generar mapas
      const builtStartVis = builtStart_band.gt(0).selfMask();
      const builtEndVis = builtEnd_band.gt(0).selfMask();
      const newUrbanVis = newUrban.selfMask();

      const builtStartMap = builtStartVis.getMap({
        palette: ['yellow']
      });

      const builtEndMap = builtEndVis.getMap({
        palette: ['orange']
      });

      const newUrbanMap = newUrbanVis.getMap({
        palette: ['red']
      });

      // 6. Obtener todos los valores
      const [startInfo, endInfo, newInfo] = await Promise.all([
        statsStart.getInfo(),
        statsEnd.getInfo(),
        statsNew.getInfo()
      ]);

      const areaStart = startInfo.constant || 0;
      const areaEnd = endInfo.constant || 0;
      const areaNew = newInfo.constant || 0;
      const expansion = areaEnd - areaStart;
      const expansionPercent = areaStart > 0 ? (expansion / areaStart * 100) : 0;

      console.log(`[Urban Expansion] ${yearStart}: ${areaStart.toFixed(2)} km² → ${yearEnd}: ${areaEnd.toFixed(2)} km² (+${expansion.toFixed(2)} km²)`);

      return {
        success: true,
        summary: {
          period: { yearStart, yearEnd, years: yearEnd - yearStart },
          expansion: {
            totalKm2: expansion,
            percentChange: expansionPercent,
            newUrbanKm2: areaNew
          }
        },
        data: {
          builtArea: {
            start: areaStart,
            end: areaEnd,
            change: expansion,
            changePercent: expansionPercent,
            unit: 'km²',
            period: `${yearStart}-${yearEnd}`
          },
          newUrbanization: {
            areaKm2: areaNew,
            description: 'Áreas que pasaron de no construido a construido',
            annualRate: areaNew / (yearEnd - yearStart),
            unit: 'km²/año'
          },
          maps: {
            builtStart: {
              urlFormat: builtStartMap.urlFormat,
              description: `Áreas construidas en ${yearStart}`,
              legend: { color: 'amarillo' }
            },
            builtEnd: {
              urlFormat: builtEndMap.urlFormat,
              description: `Áreas construidas en ${yearEnd}`,
              legend: { color: 'naranja' }
            },
            newUrban: {
              urlFormat: newUrbanMap.urlFormat,
              description: 'Nuevas áreas urbanizadas (expansión)',
              legend: { color: 'rojo' }
            }
          },
          metadata: {
            yearStart,
            yearEnd,
            period: yearEnd - yearStart,
            area: geometry,
            datasets: ['JRC/GHSL/P2023A/GHS_BUILT_S'],
            resolution: 'GHSL: 100m',
            availableYears: this.availableYears.join(', '),
            note: 'Análisis simplificado sin cálculo de pérdida de vegetación'
          }
        }
      };

    } catch (error) {
      console.error('Error en analyzeUrbanExpansion:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
  /**
   * Detecta transiciones de vegetación a construido usando Dynamic World
   * 
   * @param {Object} params - Parámetros
   * @param {ee.Geometry} params.geometry - Geometría del área
   * @param {Number} params.yearStart - Año inicial (2015-2024)
   * @param {Number} params.yearEnd - Año final (2015-2024)
   * @returns {Promise<Object>} Análisis de pérdida de vegetación
   */
  async analyzeVegetationLoss(params) {
    await this.initialize();

    const {
      geometry,
      yearStart = 2015,
      yearEnd = 2020
    } = params;

    try {
      const aoi = ee.Geometry(geometry);

      // 1. Cargar Dynamic World para ambos períodos
      const dwStart = ee.ImageCollection('GOOGLE/DYNAMICWORLD/V1')
        .filterDate(`${yearStart}-01-01`, `${yearStart}-12-31`)
        .filterBounds(aoi)
        .select(['trees', 'grass', 'flooded_vegetation', 'built']);

      const dwEnd = ee.ImageCollection('GOOGLE/DYNAMICWORLD/V1')
        .filterDate(`${yearEnd}-01-01`, `${yearEnd}-12-31`)
        .filterBounds(aoi)
        .select(['trees', 'grass', 'flooded_vegetation', 'built']);

      // 2. Calcular probabilidades promedio
      const dwStartMean = dwStart.mean();
      const dwEndMean = dwEnd.mean();

      // 3. Crear máscaras de vegetación y construido
      const vegStart = dwStartMean.select('trees')
        .add(dwStartMean.select('grass'))
        .add(dwStartMean.select('flooded_vegetation'));

      const vegEnd = dwEndMean.select('trees')
        .add(dwEndMean.select('grass'))
        .add(dwEndMean.select('flooded_vegetation'));

      const builtStart = dwStartMean.select('built');
      const builtEnd = dwEndMean.select('built');

      // 4. Detectar transición: vegetación → construido
      // Criterio: prob_veg_start > 0.5 AND prob_built_end > 0.5
      const veg2built = vegStart.gt(0.5).and(builtEnd.gt(0.5));

      // 5. Calcular área perdida
      const pixelArea10m = ee.Image.pixelArea().divide(10000); // a hectáreas
      const lossArea = veg2built.multiply(pixelArea10m);

      const lossStats = lossArea.reduceRegion({
        reducer: ee.Reducer.sum(),
        geometry: aoi,
        scale: 10,
        maxPixels: 1e13,
        bestEffort: true
      });

      // 6. Desglosar por tipo de vegetación perdida
      const treesLost = dwStartMean.select('trees').gt(0.5)
        .and(builtEnd.gt(0.5))
        .multiply(pixelArea10m);

      const grassLost = dwStartMean.select('grass').gt(0.5)
        .and(builtEnd.gt(0.5))
        .multiply(pixelArea10m);

      const breakdownStats = treesLost.addBands(grassLost).reduceRegion({
        reducer: ee.Reducer.sum().repeat(2),
        geometry: aoi,
        scale: 10,
        maxPixels: 1e13,
        bestEffort: true
      });

      // 7. Generar mapas
      const lossMapId = veg2built.updateMask(veg2built).getMap({
        palette: ['purple']
      });

      const vegChangeMapId = vegEnd.subtract(vegStart).getMap({
        min: -1,
        max: 1,
        palette: ['red', 'white', 'green']
      });

      // 8. Obtener valores
      const [lossInfo, breakdownInfo, lossMapInfo, vegChangeMapInfo] = await Promise.all([
        lossStats.getInfo(),
        breakdownStats.getInfo(),
        lossMapId.getInfo(),
        vegChangeMapId.getInfo()
      ]);

      const totalLossHa = lossInfo.constant || 0;
      const treesLostHa = breakdownInfo.sum || 0;
      const grassLostHa = breakdownInfo.sum_1 || 0;

      return {
        success: true,
        data: {
          vegetationLoss: {
            totalHectares: totalLossHa.toFixed(2),
            breakdown: {
              trees: treesLostHa.toFixed(2),
              grass: grassLostHa.toFixed(2)
            },
            period: `${yearStart}-${yearEnd}`,
            annualRate: (totalLossHa / (yearEnd - yearStart)).toFixed(2),
            severity: this._classifyLossSeverity(totalLossHa)
          },
          maps: {
            transition: {
              urlFormat: lossMapInfo.urlFormat,
              description: 'Áreas donde vegetación se convirtió en construido',
              legend: {
                color: 'morado',
                description: 'Transición vegetación → construido'
              }
            },
            vegetationChange: {
              urlFormat: vegChangeMapInfo.urlFormat,
              description: 'Cambio neto de vegetación',
              legend: {
                min: -1,
                max: 1,
                colors: ['rojo (pérdida)', 'blanco (sin cambio)', 'verde (ganancia)']
              }
            }
          },
          recommendations: this._generateLossRecommendations(totalLossHa, yearEnd - yearStart),
          metadata: {
            yearStart,
            yearEnd,
            period: yearEnd - yearStart,
            area: geometry,
            datasets: ['GOOGLE/DYNAMICWORLD/V1'],
            resolution: '10m',
            method: 'Probabilidad de clase > 0.5',
            vegClasses: ['trees', 'grass', 'flooded_vegetation']
          }
        }
      };

    } catch (error) {
      console.error('Error en analyzeVegetationLoss:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Análisis por sectores/distritos
   * 
   * @param {Object} params - Parámetros
   * @param {Array<Object>} params.sectors - Array de {name, geometry}
   * @param {Number} params.yearStart - Año inicial
   * @param {Number} params.yearEnd - Año final
   * @returns {Promise<Object>} Ranking de sectores por expansión
   */
  async analyzeBySector(params) {
    await this.initialize();

    const { sectors, yearStart, yearEnd } = params;

    try {
      const results = [];

      for (const sector of sectors) {
        const expansion = await this.analyzeUrbanExpansion({
          geometry: sector.geometry,
          yearStart,
          yearEnd
        });

        const vegLoss = await this.analyzeVegetationLoss({
          geometry: sector.geometry,
          yearStart,
          yearEnd
        });

        if (expansion.success && vegLoss.success) {
          results.push({
            name: sector.name,
            expansionHa: parseFloat(expansion.data.expansion.totalHectares),
            vegLossHa: parseFloat(vegLoss.data.vegetationLoss.totalHectares),
            popGrowth: expansion.data.population.growth,
            severity: vegLoss.data.vegetationLoss.severity
          });
        }
      }

      // Ordenar por pérdida de vegetación (mayor a menor)
      results.sort((a, b) => b.vegLossHa - a.vegLossHa);

      // Asignar rankings
      results.forEach((r, idx) => {
        r.rank = idx + 1;
        r.urgency = r.vegLossHa > 10 ? 'high' : r.vegLossHa > 5 ? 'medium' : 'low';
      });

      return {
        success: true,
        data: {
          ranking: results,
          summary: {
            totalSectors: results.length,
            totalExpansionHa: results.reduce((sum, r) => sum + r.expansionHa, 0).toFixed(2),
            totalVegLossHa: results.reduce((sum, r) => sum + r.vegLossHa, 0).toFixed(2),
            highUrgency: results.filter(r => r.urgency === 'high').length
          }
        }
      };

    } catch (error) {
      console.error('Error en analyzeBySector:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Encuentra año de población más cercano disponible
   * @private
   */
  _nearestPopYear(year) {
    const availablePop = [2000, 2005, 2010, 2015, 2020];
    return availablePop.reduce((prev, curr) => 
      Math.abs(curr - year) < Math.abs(prev - year) ? curr : prev
    );
  }

  /**
   * Interpreta magnitud de expansión
   * @private
   */
  _interpretExpansion(hectares, years) {
    const annualRate = hectares / years;
    
    if (annualRate > 50) {
      return 'Expansión muy rápida - Requiere planificación urgente';
    } else if (annualRate > 20) {
      return 'Expansión rápida - Monitoreo continuo necesario';
    } else if (annualRate > 5) {
      return 'Expansión moderada - Desarrollo controlado';
    } else {
      return 'Expansión lenta - Crecimiento orgánico';
    }
  }

  /**
   * Clasifica severidad de pérdida de vegetación
   * @private
   */
  _classifyLossSeverity(hectares) {
    if (hectares > 100) return 'critical';
    if (hectares > 50) return 'high';
    if (hectares > 20) return 'medium';
    return 'low';
  }

  /**
   * Genera recomendaciones de mitigación
   * @private
   */
  _generateLossRecommendations(hectaresLost, years) {
    const recommendations = [];
    const annualLoss = hectaresLost / years;

    if (annualLoss > 10) {
      recommendations.push({
        priority: 'urgent',
        action: 'Implementar moratoria de construcción en áreas verdes',
        target: 'Autoridades municipales',
        reason: `Se están perdiendo ${annualLoss.toFixed(1)} ha/año de vegetación`
      });
      
      recommendations.push({
        priority: 'high',
        action: 'Crear corredores ecológicos protegidos',
        target: 'Planificación urbana',
        reason: 'Conectar áreas verdes remanentes'
      });
    } else if (annualLoss > 5) {
      recommendations.push({
        priority: 'medium',
        action: 'Programas de reforestación urbana',
        target: 'Comunidad y municipalidad',
        reason: 'Compensar pérdida de vegetación'
      });
    } else {
      recommendations.push({
        priority: 'low',
        action: 'Mantener monitoreo regular',
        target: 'Observatorio ambiental',
        reason: 'Pérdida controlada, vigilar tendencias'
      });
    }

    return recommendations;
  }
}

module.exports = new UrbanExpansionService();
