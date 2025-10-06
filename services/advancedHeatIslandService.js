/**
 * @fileoverview Servicio avanzado de análisis de islas de calor urbanas
 * Implementa metodología detallada con fórmulas NASA/Copernicus:
 * - Índice de Isla de Calor (IIC)
 * - Exposición poblacional
 * - Análisis con MODIS LST, GHSL, GPW
 * - Detección de zonas de riesgo por calor extremo
 * 
 * @module services/advancedHeatIslandService
 */

const ee = require('@google/earthengine');

class AdvancedHeatIslandService {
  constructor() {
    this.initialized = false;
  }

  /**
   * Inicializa el servicio verificando que EE esté disponible
   */
  async initialize() {
    if (!this.initialized) {
      // Verificar que Earth Engine esté inicializado
      try {
        await ee.Number(1).getInfo();
        this.initialized = true;
        console.log('✅ AdvancedHeatIslandService inicializado');
      } catch (error) {
        console.error('❌ Error inicializando AdvancedHeatIslandService:', error);
        throw error;
      }
    }
  }

  /**
   * Convierte temperatura de formato raw MODIS a Celsius
   * Fórmula: LST_°C = (LST_raw × 0.02) - 273.15
   * 
   * @param {ee.Image} lstImage - Imagen MODIS LST raw
   * @returns {ee.Image} Temperatura en grados Celsius
   */
  convertLSTtoCelsius(lstImage) {
    return lstImage.multiply(0.02).subtract(273.15);
  }

  /**
   * Calcula el Índice de Isla de Calor (IIC) para un área
   * IIC = LST_°C - LST_vegetación_promedio
   * 
   * @param {Object} params - Parámetros de análisis
   * @param {ee.Geometry} params.geometry - Geometría del área de estudio
   * @param {String} params.startDate - Fecha inicial (YYYY-MM-DD)
   * @param {String} params.endDate - Fecha final (YYYY-MM-DD)
   * @param {Number} params.ndviThreshold - Umbral NDVI para vegetación (default: 0.4)
   * @returns {Promise<Object>} Resultados con mapas y estadísticas
   */
  async calculateUrbanHeatIsland(params) {
    await this.initialize();

    const {
      geometry,
      startDate = '2024-01-01',
      endDate = '2024-12-31',
      ndviThreshold = 0.4
    } = params;

    try {
      const aoi = ee.Geometry(geometry);

      // 1. Cargar LST de MODIS (diurna y nocturna)
      const lstCollection = ee.ImageCollection('MODIS/061/MOD11A1')
        .filterDate(startDate, endDate)
        .filterBounds(aoi)
        .select(['LST_Day_1km', 'LST_Night_1km']);

      // Aplicar filtro de calidad (QC_Day y QC_Night)
      const lstFiltered = lstCollection.map((img) => {
        const qcDay = img.select('QC_Day');
        const qcNight = img.select('QC_Night');
        // Bits 0-1 = 0 indica buena calidad
        const goodQuality = qcDay.bitwiseAnd(3).eq(0)
          .and(qcNight.bitwiseAnd(3).eq(0));
        return img.updateMask(goodQuality);
      });

      // 2. Calcular LST promedio en °C
      const lstMean = lstFiltered.mean();
      const lstDayC = this.convertLSTtoCelsius(lstMean.select('LST_Day_1km'));
      const lstNightC = this.convertLSTtoCelsius(lstMean.select('LST_Night_1km'));

      // 3. Calcular NDVI de MODIS para identificar vegetación
      const ndviCollection = ee.ImageCollection('MODIS/061/MCD43A4')
        .filterDate(startDate, endDate)
        .filterBounds(aoi);

      const ndviMean = ndviCollection.map((img) => {
        const nir = img.select('Nadir_Reflectance_Band2'); // NIR
        const red = img.select('Nadir_Reflectance_Band1'); // Red
        const ndvi = nir.subtract(red).divide(nir.add(red)).rename('NDVI');
        return ndvi;
      }).mean();

      // 4. Máscara de vegetación (NDVI > umbral)
      const vegMask = ndviMean.gt(ndviThreshold);

      // 5. Calcular LST promedio en áreas vegetadas
      const lstVegStats = lstDayC.updateMask(vegMask).reduceRegion({
        reducer: ee.Reducer.mean(),
        geometry: aoi,
        scale: 1000,
        maxPixels: 1e13,
        bestEffort: true
      });

      const lstVegMean = ee.Number(lstVegStats.get('LST_Day_1km'));

      // 6. Calcular Índice de Isla de Calor (IIC)
      // IIC = LST - LST_vegetación
      const iic = lstDayC.subtract(lstVegMean).rename('IIC');

      // 7. Cargar superficie construida (GHSL)
      const ghsl = ee.ImageCollection('JRC/GHSL/P2023A/GHS_BUILT_S')
        .filter(ee.Filter.eq('year', 2020))
        .first()
        .select('built_surface');

      const builtMask = ghsl.gt(0);

      // 8. Cargar población (GPW v4.11)
      const population = ee.ImageCollection('CIESIN/GPWv411/GPW_Population_Count')
        .filter(ee.Filter.eq('year', 2020))
        .first()
        .select('population_count');

      // 9. Calcular exposición poblacional
      // Exposición = IIC × Población (solo en zonas construidas)
      const exposure = iic.updateMask(builtMask).multiply(population)
        .rename('exposure');

      // 10. Estadísticas generales
      const stats = iic.updateMask(builtMask).reduceRegion({
        reducer: ee.Reducer.mean()
          .combine(ee.Reducer.min(), '', true)
          .combine(ee.Reducer.max(), '', true)
          .combine(ee.Reducer.stdDev(), '', true),
        geometry: aoi,
        scale: 1000,
        maxPixels: 1e13,
        bestEffort: true
      });

      const exposureStats = exposure.reduceRegion({
        reducer: ee.Reducer.sum(),
        geometry: aoi,
        scale: 1000,
        maxPixels: 1e13,
        bestEffort: true
      });

      // 11. Detectar zonas de alto riesgo (IIC > 5°C)
      const highRiskMask = iic.gt(5).and(builtMask);
      const highRiskPop = population.updateMask(highRiskMask);
      const highRiskPopTotal = highRiskPop.reduceRegion({
        reducer: ee.Reducer.sum(),
        geometry: aoi,
        scale: 1000,
        maxPixels: 1e13,
        bestEffort: true
      });

      // 12. Generar URLs de mapas
      const iicMapId = iic.updateMask(builtMask).getMap({
        min: 0,
        max: 10,
        palette: ['yellow', 'orange', 'red', 'darkred']
      });

      const exposureMapId = exposure.getMap({
        min: 0,
        max: 1000,
        palette: ['white', 'yellow', 'orange', 'red', 'purple']
      });

      // 13. Obtener valores
      const [
        statsInfo,
        exposureInfo,
        highRiskPopInfo,
        lstVegMeanInfo,
        iicMapInfo,
        exposureMapInfo
      ] = await Promise.all([
        stats.getInfo(),
        exposureStats.getInfo(),
        highRiskPopTotal.getInfo(),
        lstVegMean.getInfo(),
        iicMapId.getInfo(),
        exposureMapId.getInfo()
      ]);

      return {
        success: true,
        data: {
          iic: {
            mean: statsInfo.IIC_mean,
            min: statsInfo.IIC_min,
            max: statsInfo.IIC_max,
            stdDev: statsInfo.IIC_stdDev
          },
          referenceTemperature: {
            vegetationMean: lstVegMeanInfo,
            description: 'Temperatura promedio en áreas vegetadas (NDVI > ' + ndviThreshold + ')'
          },
          exposure: {
            total: exposureInfo.exposure,
            unit: '°C × habitantes',
            description: 'Suma de (IIC × población) en zonas construidas'
          },
          highRisk: {
            populationAffected: highRiskPopInfo.population_count || 0,
            threshold: 5,
            unit: '°C',
            description: 'Población en zonas con IIC > 5°C'
          },
          maps: {
            iic: {
              urlFormat: iicMapInfo.urlFormat,
              description: 'Índice de Isla de Calor (IIC) en °C',
              legend: {
                min: 0,
                max: 10,
                colors: ['amarillo', 'naranja', 'rojo', 'rojo oscuro']
              }
            },
            exposure: {
              urlFormat: exposureMapInfo.urlFormat,
              description: 'Exposición poblacional al calor urbano',
              legend: {
                min: 0,
                max: 1000,
                colors: ['blanco', 'amarillo', 'naranja', 'rojo', 'morado']
              }
            }
          },
          metadata: {
            startDate,
            endDate,
            ndviThreshold,
            area: geometry,
            datasets: [
              'MODIS/061/MOD11A1 (LST)',
              'MODIS/061/MCD43A4 (NDVI)',
              'JRC/GHSL/P2023A/GHS_BUILT_S',
              'CIESIN/GPWv411/GPW_Population_Count'
            ],
            formulas: {
              lstConversion: 'LST_°C = (LST_raw × 0.02) - 273.15',
              iic: 'IIC = LST_°C - LST_vegetación_promedio',
              exposure: 'Exposición = IIC × Población'
            }
          }
        }
      };

    } catch (error) {
      console.error('Error en calculateUrbanHeatIsland:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Análisis temporal de islas de calor (comparación interanual)
   * 
   * @param {Object} params - Parámetros de análisis
   * @param {ee.Geometry} params.geometry - Geometría del área
   * @param {Array<Number>} params.years - Años a comparar [2015, 2020, 2024]
   * @returns {Promise<Object>} Series temporales y tendencias
   */
  async analyzeHeatIslandTrends(params) {
    await this.initialize();

    const {
      geometry,
      years = [2015, 2020, 2024]
    } = params;

    try {
      const aoi = ee.Geometry(geometry);
      const results = [];

      for (const year of years) {
        const startDate = `${year}-01-01`;
        const endDate = `${year}-12-31`;

        const yearResult = await this.calculateUrbanHeatIsland({
          geometry: aoi,
          startDate,
          endDate
        });

        if (yearResult.success) {
          results.push({
            year,
            iicMean: yearResult.data.iic.mean,
            iicMax: yearResult.data.iic.max,
            exposureTotal: yearResult.data.exposure.total,
            highRiskPop: yearResult.data.highRisk.populationAffected
          });
        }
      }

      // Calcular tendencias
      const trend = this._calculateTrend(results);

      return {
        success: true,
        data: {
          timeSeries: results,
          trend: trend,
          interpretation: this._interpretTrend(trend)
        }
      };

    } catch (error) {
      console.error('Error en analyzeHeatIslandTrends:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Análisis de islas de calor por distrito/barrio
   * 
   * @param {Object} params - Parámetros
   * @param {Array<Object>} params.districts - Array de {name, geometry}
   * @param {String} params.startDate - Fecha inicial
   * @param {String} params.endDate - Fecha final
   * @returns {Promise<Object>} Ranking de distritos por severidad
   */
  async analyzeByDistrict(params) {
    await this.initialize();

    const {
      districts,
      startDate = '2024-01-01',
      endDate = '2024-12-31'
    } = params;

    try {
      const results = [];

      for (const district of districts) {
        const analysis = await this.calculateUrbanHeatIsland({
          geometry: district.geometry,
          startDate,
          endDate
        });

        if (analysis.success) {
          results.push({
            name: district.name,
            iicMean: analysis.data.iic.mean,
            iicMax: analysis.data.iic.max,
            exposureTotal: analysis.data.exposure.total,
            highRiskPop: analysis.data.highRisk.populationAffected
          });
        }
      }

      // Ordenar por exposición total (de mayor a menor)
      results.sort((a, b) => b.exposureTotal - a.exposureTotal);

      // Asignar rankings
      results.forEach((r, idx) => {
        r.rank = idx + 1;
        r.severity = this._getSeverityLevel(r.iicMean);
      });

      return {
        success: true,
        data: {
          ranking: results,
          summary: {
            totalDistricts: results.length,
            highSeverity: results.filter(r => r.severity === 'high').length,
            mediumSeverity: results.filter(r => r.severity === 'medium').length,
            lowSeverity: results.filter(r => r.severity === 'low').length
          }
        }
      };

    } catch (error) {
      console.error('Error en analyzeByDistrict:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Calcula tendencia lineal simple
   * @private
   */
  _calculateTrend(data) {
    if (data.length < 2) return null;

    const n = data.length;
    const sumX = data.reduce((sum, d, i) => sum + i, 0);
    const sumY = data.reduce((sum, d) => sum + d.iicMean, 0);
    const sumXY = data.reduce((sum, d, i) => sum + i * d.iicMean, 0);
    const sumX2 = data.reduce((sum, d, i) => sum + i * i, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    return {
      slope,
      intercept,
      direction: slope > 0.1 ? 'increasing' : slope < -0.1 ? 'decreasing' : 'stable'
    };
  }

  /**
   * Interpreta tendencia
   * @private
   */
  _interpretTrend(trend) {
    if (!trend) return 'Datos insuficientes';

    if (trend.direction === 'increasing') {
      return `Las islas de calor están intensificándose (${trend.slope.toFixed(3)}°C/año). Se requiere acción urgente.`;
    } else if (trend.direction === 'decreasing') {
      return `Las islas de calor están disminuyendo (${trend.slope.toFixed(3)}°C/año). Las medidas están funcionando.`;
    } else {
      return `Las islas de calor se mantienen estables. Continuar monitoreo.`;
    }
  }

  /**
   * Determina nivel de severidad
   * @private
   */
  _getSeverityLevel(iicMean) {
    if (iicMean > 6) return 'high';
    if (iicMean > 3) return 'medium';
    return 'low';
  }
}

module.exports = new AdvancedHeatIslandService();
