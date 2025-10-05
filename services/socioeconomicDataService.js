/**
 * Servicio de Datos Socioeconómicos
 * 
 * Maneja la integración de datos poblacionales (GPW v4), infraestructura social
 * e índices de privación para análisis de barrios.
 * 
 * Punto 6: Datos socioeconómicos
 * - Población: Gridded Population of the World (GPW v4) - SEDAC/NASA/CIESIN
 * - Infraestructura: Hospitales, colegios, parques, servicios públicos
 * - Privación: Índices de carencias básicas y nivel socioeconómico
 */

const ee = require('@google/earthengine');

class SocioeconomicDataService {
  constructor() {
    this.isInitialized = false;
  }

  /**
   * Inicializa el servicio de Earth Engine
   */
  async initialize() {
    if (this.isInitialized) return;
    
    try {
      // EE ya está inicializado por el servidor principal
      this.isInitialized = true;
      console.log('✓ SocioeconomicDataService initialized');
    } catch (error) {
      console.error('Error initializing SocioeconomicDataService:', error);
      throw error;
    }
  }

  /**
   * Calcula densidad poblacional usando GPW v4 (SEDAC)
   * Dataset: NASA SEDAC Gridded Population of the World Version 4
   * Resolución: 30 arc-segundos (~1km)
   * Años disponibles: 2000, 2005, 2010, 2015, 2020
   * 
   * @param {Object} geometry - Geometría del barrio (GeoJSON)
   * @param {number} year - Año de análisis (2000, 2005, 2010, 2015, 2020)
   * @returns {Promise<Object>} - Datos de población y densidad
   */
  async calculatePopulationDensity(geometry, year = 2020) {
    await this.initialize();

    try {
      const eeGeometry = ee.Geometry(geometry);
      const area = eeGeometry.area().divide(1000000); // km²

      // GPW v4: Population Density (usar imagen directa del año)
      // https://developers.google.com/earth-engine/datasets/catalog/CIESIN_GPWv411_GPW_Population_Density
      // El dataset tiene una imagen por año, no bandas múltiples
      const yearToImageId = {
        2000: 'CIESIN/GPWv411/GPW_Population_Density/gpw_v4_population_density_rev11_2000_30_sec',
        2005: 'CIESIN/GPWv411/GPW_Population_Density/gpw_v4_population_density_rev11_2005_30_sec',
        2010: 'CIESIN/GPWv411/GPW_Population_Density/gpw_v4_population_density_rev11_2010_30_sec',
        2015: 'CIESIN/GPWv411/GPW_Population_Density/gpw_v4_population_density_rev11_2015_30_sec',
        2020: 'CIESIN/GPWv411/GPW_Population_Density/gpw_v4_population_density_rev11_2020_30_sec'
      };

      const imageId = yearToImageId[year];
      if (!imageId) {
        throw new Error(`Año ${year} no disponible. Use: 2000, 2005, 2010, 2015, 2020`);
      }

      const popDensityImage = ee.Image(imageId).select('population_density');

      // Estadística zonal: densidad media en el barrio
      const stats = popDensityImage.reduceRegion({
        reducer: ee.Reducer.mean().combine({
          reducer2: ee.Reducer.sum(),
          sharedInputs: true
        }).combine({
          reducer2: ee.Reducer.max(),
          sharedInputs: true
        }).combine({
          reducer2: ee.Reducer.min(),
          sharedInputs: true
        }),
        geometry: eeGeometry,
        scale: 1000, // ~1km (resolución de GPW)
        maxPixels: 1e9
      });

      const statsData = await new Promise((resolve, reject) => {
        stats.evaluate((result, error) => {
          if (error) reject(error);
          else resolve(result);
        });
      });

      // Calcular población total estimada
      const bandName = 'population_density';
      const densityMean = statsData[`${bandName}_mean`] || 0;
      const areaValue = await new Promise((resolve, reject) => {
        area.evaluate((result, error) => {
          if (error) reject(error);
          else resolve(result);
        });
      });

      const populationTotal = densityMean * areaValue;

      return {
        year,
        densityMean: Math.round(densityMean * 100) / 100, // personas/km²
        densityMax: Math.round((statsData[`${bandName}_max`] || 0) * 100) / 100,
        densityMin: Math.round((statsData[`${bandName}_min`] || 0) * 100) / 100,
        populationTotal: Math.round(populationTotal),
        areaKm2: Math.round(areaValue * 100) / 100,
        source: 'GPW v4.11 (SEDAC/NASA/CIESIN)',
        resolution: '1km'
      };
    } catch (error) {
      console.error('Error calculating population density:', error);
      throw error;
    }
  }

  /**
   * Analiza infraestructura social en el barrio
   * Calcula servicios per cápita: hospitales, colegios, parques
   * 
   * @param {Object} geometry - Geometría del barrio
   * @param {Object} population - Datos de población
   * @param {Object} infrastructure - GeoJSON con infraestructura (opcional)
   * @returns {Promise<Object>} - Métricas de servicios per cápita
   */
  async calculateSocialInfrastructure(geometry, population, infrastructure = null) {
    await this.initialize();

    try {
      // Si se proporciona infraestructura externa, procesarla
      if (infrastructure) {
        return this._processCustomInfrastructure(geometry, population, infrastructure);
      }

      // Para MVP: generar datos sintéticos basados en características del barrio
      // En producción, esto se reemplazaría con datos reales de INEI, municipio, etc.
      const mockData = await this._generateMockInfrastructure(geometry, population);
      
      return mockData;
    } catch (error) {
      console.error('Error calculating social infrastructure:', error);
      throw error;
    }
  }

  /**
   * Calcula índice de privación relativa
   * Basado en: acceso a servicios básicos, nivel de ingresos, déficit habitacional
   * 
   * @param {Object} geometry - Geometría del barrio
   * @param {Object} censusData - Datos censales (opcional)
   * @returns {Promise<Object>} - Índice de privación normalizado (0-1)
   */
  async calculateDeprivationIndex(geometry, censusData = null) {
    await this.initialize();

    try {
      // Si hay datos censales reales, procesarlos
      if (censusData) {
        return this._processCustomDeprivation(geometry, censusData);
      }

      // Para MVP: estimar privación usando proxy de Earth Engine
      // - Luminosidad nocturna (VIIRS) como proxy de desarrollo
      // - Acceso a áreas verdes (NDVI)
      // - Densidad de construcción (índice de construcción)
      
      const eeGeometry = ee.Geometry(geometry);

      // 1. Luminosidad nocturna (VIIRS Day/Night Band)
      const viirs = ee.ImageCollection('NOAA/VIIRS/DNB/MONTHLY_V1/VCMSLCFG')
        .filterDate('2023-01-01', '2023-12-31')
        .select('avg_rad')
        .mean();

      const nightlight = viirs.reduceRegion({
        reducer: ee.Reducer.mean(),
        geometry: eeGeometry,
        scale: 500,
        maxPixels: 1e9
      });

      // 2. NDVI medio (proxy de áreas verdes)
      const ndviImage = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
        .filterDate('2023-01-01', '2023-12-31')
        .filterBounds(eeGeometry)
        .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 20))
        .map(img => {
          const nir = img.select('B8');
          const red = img.select('B4');
          return img.addBands(nir.subtract(red).divide(nir.add(red)).rename('NDVI'));
        })
        .select('NDVI')
        .mean();

      const ndviStats = ndviImage.reduceRegion({
        reducer: ee.Reducer.mean(),
        geometry: eeGeometry,
        scale: 10,
        maxPixels: 1e9
      });

      // Evaluar métricas
      const [nightlightData, ndviData] = await Promise.all([
        new Promise((resolve, reject) => {
          nightlight.evaluate((result, error) => {
            if (error) reject(error);
            else resolve(result);
          });
        }),
        new Promise((resolve, reject) => {
          ndviStats.evaluate((result, error) => {
            if (error) reject(error);
            else resolve(result);
          });
        })
      ]);

      const avgRad = nightlightData.avg_rad || 0;
      const ndviMean = ndviData.NDVI || 0;

      // Normalizar índice de privación (0 = menos privado, 1 = más privado)
      // Menos luminosidad = más privación
      // Menos NDVI = más privación
      const nightlightNorm = 1 - Math.min(avgRad / 50, 1); // Normalizar asumiendo max ~50 nW·cm⁻²·sr⁻¹
      const ndviNorm = 1 - Math.max(0, Math.min(ndviMean, 1)); // Menos verde = más privación

      const deprivationIndex = (nightlightNorm * 0.6 + ndviNorm * 0.4); // Peso: 60% luz, 40% verde

      return {
        deprivationIndex: Math.round(deprivationIndex * 1000) / 1000, // 0-1
        nightlightRadiance: Math.round(avgRad * 100) / 100,
        greenSpaceAccess: Math.round(ndviMean * 1000) / 1000,
        interpretation: this._interpretDeprivation(deprivationIndex),
        source: 'Estimación basada en VIIRS y Sentinel-2',
        note: 'Índice proxy. Para análisis definitivo usar datos censales INEI.'
      };
    } catch (error) {
      console.error('Error calculating deprivation index:', error);
      throw error;
    }
  }

  /**
   * Combina todos los datos socioeconómicos del barrio
   * 
   * @param {Object} geometry - Geometría del barrio (GeoJSON)
   * @param {string} neighborhoodName - Nombre del barrio
   * @param {number} year - Año de análisis
   * @returns {Promise<Object>} - Datos socioeconómicos completos
   */
  async getNeighborhoodSocioeconomicData(geometry, neighborhoodName, year = 2020) {
    await this.initialize();

    try {
      // Calcular en paralelo
      const [population, deprivation] = await Promise.all([
        this.calculatePopulationDensity(geometry, year),
        this.calculateDeprivationIndex(geometry)
      ]);

      // Infraestructura (depende de población)
      const infrastructure = await this.calculateSocialInfrastructure(geometry, population);

      // Normalizar valores para visualización (0-1)
      const normalized = this._normalizeIndicators({
        population,
        infrastructure,
        deprivation
      });

      return {
        neighborhood: neighborhoodName,
        year,
        timestamp: new Date().toISOString(),
        population,
        infrastructure,
        deprivation,
        normalized,
        summary: this._generateSummary(population, infrastructure, deprivation)
      };
    } catch (error) {
      console.error('Error getting neighborhood socioeconomic data:', error);
      throw error;
    }
  }

  /**
   * Filtra barrios según criterios socioeconómicos
   * 
   * @param {Array} neighborhoods - Lista de barrios con datos
   * @param {Object} filters - Filtros a aplicar
   * @returns {Array} - Barrios filtrados
   */
  filterNeighborhoods(neighborhoods, filters) {
    return neighborhoods.filter(n => {
      const { densityMin, densityMax, deprivationMin, servicesMin } = filters;

      const density = n.population.densityMean;
      const deprivation = n.deprivation.deprivationIndex;
      const services = n.infrastructure.servicesPerCapita;

      if (densityMin !== undefined && density < densityMin) return false;
      if (densityMax !== undefined && density > densityMax) return false;
      if (deprivationMin !== undefined && deprivation < deprivationMin) return false;
      if (servicesMin !== undefined && services < servicesMin) return false;

      return true;
    });
  }

  // ==================== MÉTODOS PRIVADOS ====================

  /**
   * Genera infraestructura mock para MVP
   */
  async _generateMockInfrastructure(geometry, population) {
    const popTotal = population.populationTotal;
    const density = population.densityMean;

    // Estimar servicios basado en densidad (valores realistas para Lima)
    const hospitalsCount = Math.max(1, Math.round(popTotal / 50000));
    const schoolsCount = Math.max(2, Math.round(popTotal / 5000));
    const parksArea = Math.max(0.5, population.areaKm2 * (0.05 + Math.random() * 0.1)); // 5-15% área

    const hospitalsPerCapita = (hospitalsCount / popTotal) * 10000; // por cada 10k hab
    const schoolsPerCapita = (schoolsCount / popTotal) * 10000;
    const parkAreaPerCapita = (parksArea * 1000000) / popTotal; // m² por persona

    return {
      hospitals: {
        count: hospitalsCount,
        perCapita: Math.round(hospitalsPerCapita * 100) / 100
      },
      schools: {
        count: schoolsCount,
        perCapita: Math.round(schoolsPerCapita * 100) / 100
      },
      parks: {
        areaKm2: Math.round(parksArea * 100) / 100,
        perCapitaM2: Math.round(parkAreaPerCapita * 10) / 10
      },
      servicesPerCapita: Math.round(((hospitalsPerCapita + schoolsPerCapita) / 2) * 100) / 100,
      source: 'Estimación basada en densidad poblacional',
      note: 'Datos sintéticos MVP. Reemplazar con shapefile municipal/INEI.'
    };
  }

  /**
   * Procesa infraestructura custom (GeoJSON proporcionado)
   */
  _processCustomInfrastructure(geometry, population, infrastructure) {
    // TODO: Implementar cuando se tenga GeoJSON real
    // Contar features dentro del polígono del barrio
    // Calcular per cápita
    return this._generateMockInfrastructure(geometry, population);
  }

  /**
   * Procesa datos de privación custom (censo)
   */
  _processCustomDeprivation(geometry, censusData) {
    // TODO: Implementar con datos reales de INEI
    return {
      deprivationIndex: censusData.deprivationIndex || 0.5,
      source: 'Datos censales'
    };
  }

  /**
   * Interpreta el índice de privación
   */
  _interpretDeprivation(index) {
    if (index < 0.25) return 'Bajo nivel de privación';
    if (index < 0.5) return 'Privación moderada';
    if (index < 0.75) return 'Privación alta';
    return 'Privación muy alta';
  }

  /**
   * Normaliza indicadores para comparación (0-1)
   */
  _normalizeIndicators(data) {
    // Valores de referencia para Lima (aproximados)
    const maxDensity = 30000; // personas/km²
    const maxServicesPerCapita = 5; // servicios por 10k habitantes
    
    const densityNorm = Math.min(data.population.densityMean / maxDensity, 1);
    const servicesNorm = Math.min(data.infrastructure.servicesPerCapita / maxServicesPerCapita, 1);
    const deprivationNorm = data.deprivation.deprivationIndex; // Ya está 0-1

    return {
      density: Math.round(densityNorm * 1000) / 1000,
      services: Math.round(servicesNorm * 1000) / 1000,
      deprivation: Math.round(deprivationNorm * 1000) / 1000
    };
  }

  /**
   * Genera resumen textual
   */
  _generateSummary(population, infrastructure, deprivation) {
    const density = population.densityMean;
    const deprivationLevel = deprivation.interpretation;
    const parks = infrastructure.parks.perCapitaM2;

    let summary = `Barrio con densidad de ${Math.round(density)} hab/km². `;
    summary += `${deprivationLevel}. `;
    summary += `Área verde: ${parks.toFixed(1)} m²/persona`;
    
    if (parks < 9) {
      summary += ' (por debajo del estándar OMS de 9 m²/hab)';
    } else {
      summary += ' (cumple estándar OMS)';
    }

    return summary;
  }
}

module.exports = new SocioeconomicDataService();
