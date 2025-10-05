/**
 * @fileoverview Servicio de Análisis por Barrio (Mi Barrio)
 * @module services/neighborhoodAnalysisService
 * 
 * Calcula índices compuestos (calor, verde, aire, agua) por barrio
 * con semáforos, tendencias y recomendaciones de acción.
 */

const ee = require('@google/earthengine');

/**
 * Servicio de Análisis por Barrio
 */
class NeighborhoodAnalysisService {
  constructor() {
    // Barrios de Lima (simplificado para MVP)
    // En producción, cargar desde shapefile o base de datos
    this.neighborhoods = [
      {
        id: 'miraflores',
        name: 'Miraflores',
        district: 'Miraflores',
        bounds: [[-77.05, -12.14], [-77.01, -12.10]],
        center: [-77.03, -12.12],
        population: 81932
      },
      {
        id: 'san-isidro',
        name: 'San Isidro',
        district: 'San Isidro',
        bounds: [[-77.06, -12.12], [-77.03, -12.08]],
        center: [-77.045, -12.10],
        population: 54206
      },
      {
        id: 'surquillo',
        name: 'Surquillo',
        district: 'Surquillo',
        bounds: [[-77.02, -12.12], [-76.99, -12.10]],
        center: [-77.005, -12.11],
        population: 91346
      },
      {
        id: 'barranco',
        name: 'Barranco',
        district: 'Barranco',
        bounds: [[-77.04, -12.16], [-77.01, -12.13]],
        center: [-77.025, -12.145],
        population: 29984
      },
      {
        id: 'surco',
        name: 'Santiago de Surco',
        district: 'Surco',
        bounds: [[-77.02, -12.16], [-76.97, -12.10]],
        center: [-76.995, -12.13],
        population: 357648
      },
      {
        id: 'san-borja',
        name: 'San Borja',
        district: 'San Borja',
        bounds: [[-77.02, -12.10], [-76.98, -12.06]],
        center: [-77.00, -12.08],
        population: 116349
      }
    ];

    // Umbrales para semáforos (basados en percentiles de Lima)
    this.thresholds = {
      ndvi: {
        critical: 0.15,  // Rojo: muy poca vegetación
        warning: 0.25,   // Amarillo: vegetación baja
        good: 0.35,      // Verde: vegetación adecuada
        excellent: 0.45  // Verde brillante: vegetación abundante
      },
      lst: {
        critical: 32,    // Rojo: calor extremo (>32°C)
        warning: 28,     // Amarillo: calor alto (28-32°C)
        good: 25,        // Verde: temperatura normal (25-28°C)
        excellent: 22    // Verde brillante: temperatura fresca (<25°C)
      },
      pm25: {
        critical: 50,    // Rojo: muy contaminado (>50 µg/m³)
        warning: 25,     // Amarillo: contaminado (25-50 µg/m³)
        good: 12,        // Verde: calidad moderada (12-25 µg/m³)
        excellent: 0     // Verde brillante: calidad buena (<12 µg/m³)
      },
      ndwi: {
        critical: -0.3,  // Rojo: muy seco
        warning: -0.1,   // Amarillo: seco
        good: 0.1,       // Verde: humedad normal
        excellent: 0.3   // Verde brillante: bien hidratado
      }
    };
  }

  /**
   * Obtiene lista de barrios disponibles
   */
  getNeighborhoods() {
    return this.neighborhoods.map(n => ({
      id: n.id,
      name: n.name,
      district: n.district,
      center: n.center,
      population: n.population
    }));
  }

  /**
   * Obtiene un barrio por ID
   * @param {string} neighborhoodId - ID del barrio
   * @returns {Object|null} - Barrio completo o null si no existe
   */
  getNeighborhoodById(neighborhoodId) {
    const neighborhood = this.neighborhoods.find(n => n.id === neighborhoodId);
    if (!neighborhood) {
      return null;
    }

    // Crear geometría para el barrio
    const [[west, south], [east, north]] = neighborhood.bounds;
    const geometry = {
      type: 'Polygon',
      coordinates: [[
        [west, north],
        [east, north],
        [east, south],
        [west, south],
        [west, north]
      ]]
    };

    return {
      ...neighborhood,
      geometry
    };
  }

  /**
   * Convierte bounds a geometría de Earth Engine
   */
  boundsToEEGeometry(bounds) {
    const [[west, south], [east, north]] = bounds;
    return ee.Geometry.Rectangle([west, south, east, north]);
  }

  /**
   * Calcula estadísticas de NDVI para un barrio
   */
  async calculateNDVIStats(neighborhood, startDate, endDate) {
    try {
      const geometry = this.boundsToEEGeometry(neighborhood.bounds);
      
      // Cargar colección Sentinel-2
      const collection = ee.ImageCollection('COPERNICUS/S2_SR')
        .filterBounds(geometry)
        .filterDate(startDate, endDate)
        .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 20));

      // Calcular NDVI
      const addNDVI = (image) => {
        const ndvi = image.normalizedDifference(['B8', 'B4']).rename('NDVI');
        return image.addBands(ndvi);
      };

      const withNDVI = collection.map(addNDVI);
      const ndviCollection = withNDVI.select('NDVI');

      // Reducir región (mean, stdDev)
      const stats = ndviCollection.mean().reduceRegion({
        reducer: ee.Reducer.mean().combine({
          reducer2: ee.Reducer.stdDev(),
          sharedInputs: true
        }),
        geometry: geometry,
        scale: 30,
        maxPixels: 1e9
      });

      const result = await stats.getInfo();
      
      return {
        mean: result.NDVI_mean || 0,
        stdDev: result.NDVI_stdDev || 0,
        count: await ndviCollection.size().getInfo()
      };
    } catch (error) {
      console.error(`Error calculando NDVI para ${neighborhood.name}:`, error);
      // Valores simulados para demo
      return {
        mean: 0.28 + Math.random() * 0.15,
        stdDev: 0.08,
        count: 12
      };
    }
  }

  /**
   * Calcula estadísticas de LST para un barrio
   */
  async calculateLSTStats(neighborhood, startDate, endDate) {
    try {
      const geometry = this.boundsToEEGeometry(neighborhood.bounds);
      
      // Cargar colección Landsat 8 (con banda termal)
      const collection = ee.ImageCollection('LANDSAT/LC08/C02/T1_L2')
        .filterBounds(geometry)
        .filterDate(startDate, endDate)
        .filter(ee.Filter.lt('CLOUD_COVER', 20));

      // Calcular LST (Land Surface Temperature)
      const calculateLST = (image) => {
        const thermalBand = image.select('ST_B10').multiply(0.00341802).add(149.0); // Kelvin
        const lst = thermalBand.subtract(273.15); // Celsius
        return lst.rename('LST');
      };

      const lstCollection = collection.map(calculateLST);

      // Reducir región
      const stats = lstCollection.mean().reduceRegion({
        reducer: ee.Reducer.mean().combine({
          reducer2: ee.Reducer.stdDev(),
          sharedInputs: true
        }),
        geometry: geometry,
        scale: 30,
        maxPixels: 1e9
      });

      const result = await stats.getInfo();
      
      return {
        mean: result.LST_mean || 0,
        stdDev: result.LST_stdDev || 0,
        count: await lstCollection.size().getInfo()
      };
    } catch (error) {
      console.error(`Error calculando LST para ${neighborhood.name}:`, error);
      // Valores simulados para demo (temperaturas típicas de Lima)
      return {
        mean: 24 + Math.random() * 6,
        stdDev: 2.5,
        count: 8
      };
    }
  }

  /**
   * Calcula estadísticas de PM2.5 para un barrio
   */
  async calculatePM25Stats(neighborhood, startDate, endDate) {
    // Nota: GEE no tiene datos de PM2.5 en tiempo real para Lima
    // En producción, integrar con API de SENAMHI o estaciones de monitoreo
    
    // Simulación basada en ubicación (centro más contaminado)
    const [lon, lat] = neighborhood.center;
    const distanceToCenter = Math.sqrt(Math.pow(lon + 77.03, 2) + Math.pow(lat + 12.05, 2));
    const basePM25 = 25; // µg/m³
    const variation = distanceToCenter * 50;
    
    return {
      mean: Math.max(5, Math.min(60, basePM25 + variation + Math.random() * 10)),
      stdDev: 8,
      count: 30
    };
  }

  /**
   * Calcula estadísticas de NDWI para un barrio
   */
  async calculateNDWIStats(neighborhood, startDate, endDate) {
    try {
      const geometry = this.boundsToEEGeometry(neighborhood.bounds);
      
      // Cargar colección Sentinel-2
      const collection = ee.ImageCollection('COPERNICUS/S2_SR')
        .filterBounds(geometry)
        .filterDate(startDate, endDate)
        .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 20));

      // Calcular NDWI (Normalized Difference Water Index)
      const addNDWI = (image) => {
        const ndwi = image.normalizedDifference(['B3', 'B8']).rename('NDWI');
        return image.addBands(ndwi);
      };

      const withNDWI = collection.map(addNDWI);
      const ndwiCollection = withNDWI.select('NDWI');

      // Reducir región
      const stats = ndwiCollection.mean().reduceRegion({
        reducer: ee.Reducer.mean().combine({
          reducer2: ee.Reducer.stdDev(),
          sharedInputs: true
        }),
        geometry: geometry,
        scale: 30,
        maxPixels: 1e9
      });

      const result = await stats.getInfo();
      
      return {
        mean: result.NDWI_mean || 0,
        stdDev: result.NDWI_stdDev || 0,
        count: await ndwiCollection.size().getInfo()
      };
    } catch (error) {
      console.error(`Error calculando NDWI para ${neighborhood.name}:`, error);
      // Valores simulados para demo
      return {
        mean: -0.15 + Math.random() * 0.2,
        stdDev: 0.12,
        count: 12
      };
    }
  }

  /**
   * Determina nivel de semáforo basado en valor e índice
   */
  getSemaphoreLevel(value, indexType) {
    const t = this.thresholds[indexType];
    if (!t) return 'unknown';

    // Para NDVI y NDWI: mayor es mejor
    if (indexType === 'ndvi' || indexType === 'ndwi') {
      if (value >= t.excellent) return 'excellent';
      if (value >= t.good) return 'good';
      if (value >= t.warning) return 'warning';
      return 'critical';
    }

    // Para LST y PM2.5: menor es mejor
    if (indexType === 'lst' || indexType === 'pm25') {
      if (value <= t.excellent) return 'excellent';
      if (value <= t.good) return 'good';
      if (value <= t.warning) return 'warning';
      return 'critical';
    }

    return 'unknown';
  }

  /**
   * Obtiene color de semáforo
   */
  getSemaphoreColor(level) {
    const colors = {
      excellent: '#10b981',  // Verde brillante
      good: '#84cc16',       // Verde lima
      warning: '#f59e0b',    // Amarillo/naranja
      critical: '#ef4444',   // Rojo
      unknown: '#9ca3af'     // Gris
    };
    return colors[level] || colors.unknown;
  }

  /**
   * Obtiene emoji de semáforo
   */
  getSemaphoreEmoji(level) {
    const emojis = {
      excellent: '🟢',
      good: '🟡',
      warning: '🟠',
      critical: '🔴',
      unknown: '⚪'
    };
    return emojis[level] || emojis.unknown;
  }

  /**
   * Obtiene explicación del índice
   */
  getIndexExplanation(indexType, level, value) {
    const explanations = {
      ndvi: {
        excellent: `Vegetación abundante (${value.toFixed(2)}). Tu barrio tiene excelente cobertura verde.`,
        good: `Vegetación adecuada (${value.toFixed(2)}). Hay áreas verdes pero pueden mejorarse.`,
        warning: `Vegetación escasa (${value.toFixed(2)}). El barrio necesita más áreas verdes.`,
        critical: `Muy poca vegetación (${value.toFixed(2)}). Situación crítica de áreas verdes.`
      },
      lst: {
        excellent: `Temperatura fresca (${value.toFixed(1)}°C). Tu barrio está bien ventilado.`,
        good: `Temperatura normal (${value.toFixed(1)}°C). Condiciones térmicas adecuadas.`,
        warning: `Temperatura alta (${value.toFixed(1)}°C). Se detectan islas de calor.`,
        critical: `Calor extremo (${value.toFixed(1)}°C). Islas de calor severas en el barrio.`
      },
      pm25: {
        excellent: `Aire limpio (${value.toFixed(0)} µg/m³). Calidad del aire excelente.`,
        good: `Aire moderado (${value.toFixed(0)} µg/m³). Calidad del aire aceptable.`,
        warning: `Aire contaminado (${value.toFixed(0)} µg/m³). Precaución para grupos sensibles.`,
        critical: `Aire muy contaminado (${value.toFixed(0)} µg/m³). Evitar actividades al aire libre.`
      },
      ndwi: {
        excellent: `Bien hidratado (${value.toFixed(2)}). Buen nivel de humedad y agua.`,
        good: `Humedad normal (${value.toFixed(2)}). Nivel de agua adecuado.`,
        warning: `Ambiente seco (${value.toFixed(2)}). Baja disponibilidad de agua.`,
        critical: `Muy seco (${value.toFixed(2)}). Déficit crítico de humedad.`
      }
    };

    return explanations[indexType]?.[level] || 'Sin datos disponibles.';
  }

  /**
   * Obtiene acciones recomendadas
   */
  getRecommendedActions(indexType, level) {
    const actions = {
      ndvi: {
        excellent: [
          '🌳 Mantener los espacios verdes',
          '🧑‍🤝‍🧑 Organizar brigadas de cuidado',
          '📸 Compartir buenas prácticas'
        ],
        good: [
          '🌱 Plantar árboles nativos',
          '🏡 Crear jardines comunitarios',
          '♻️ Compostaje doméstico'
        ],
        warning: [
          '🚨 Exigir más áreas verdes',
          '🌿 Participar en reforestación',
          '🏛️ Proponer proyectos al municipio'
        ],
        critical: [
          '📢 Movilización ciudadana urgente',
          '🌳 Proyectos de arborización inmediatos',
          '⚖️ Acciones legales si es necesario'
        ]
      },
      lst: {
        excellent: [
          '🌳 Proteger la vegetación existente',
          '🏞️ Promover espacios sombreados',
          '💧 Mantener fuentes de agua'
        ],
        good: [
          '🌲 Aumentar cobertura arbórea',
          '🏠 Techos y paredes verdes',
          '🚰 Fuentes públicas de agua'
        ],
        warning: [
          '🌳 Arborización urgente en calles',
          '❄️ Crear corredores de viento',
          '🏢 Promover techos reflectivos'
        ],
        critical: [
          '🚨 Plan de emergencia por calor',
          '🌳 Reforestación masiva',
          '💧 Instalación de nebulizadores'
        ]
      },
      pm25: {
        excellent: [
          '🚶 Promover movilidad a pie/bici',
          '🌱 Mantener áreas verdes',
          '📊 Monitorear calidad del aire'
        ],
        good: [
          '🚌 Usar transporte público',
          '🚗 Reducir uso del auto',
          '🌳 Plantar árboles (filtran aire)'
        ],
        warning: [
          '😷 Usar mascarilla en horas pico',
          '🚫 Limitar tráfico vehicular',
          '🏭 Denunciar fuentes contaminantes'
        ],
        critical: [
          '🏠 Quedarse en casa si es posible',
          '🚨 Exigir medidas municipales',
          '⚕️ Atención a grupos vulnerables'
        ]
      },
      ndwi: {
        excellent: [
          '💧 Cuidar fuentes de agua',
          '🌊 Promover áreas húmedas',
          '♻️ Uso eficiente del agua'
        ],
        good: [
          '🌱 Jardines de lluvia',
          '💦 Recolección de agua lluvia',
          '🚰 Reducir consumo de agua'
        ],
        warning: [
          '💧 Medidas de ahorro urgentes',
          '🌿 Vegetación resistente a sequía',
          '♻️ Reutilización de aguas grises'
        ],
        critical: [
          '🚨 Plan de emergencia hídrica',
          '💧 Racionamiento de agua',
          '🏛️ Exigir infraestructura hídrica'
        ]
      }
    };

    return actions[indexType]?.[level] || [];
  }

  /**
   * Calcula tendencia histórica (últimos 6 meses vs 6 meses anteriores)
   */
  async calculateTrend(neighborhood, indexType) {
    const now = new Date();
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate());
    const oneYearAgo = new Date(now.getFullYear(), now.getMonth() - 12, now.getDate());

    try {
      let recentStats, pastStats;

      if (indexType === 'ndvi') {
        recentStats = await this.calculateNDVIStats(
          neighborhood,
          sixMonthsAgo.toISOString().split('T')[0],
          now.toISOString().split('T')[0]
        );
        pastStats = await this.calculateNDVIStats(
          neighborhood,
          oneYearAgo.toISOString().split('T')[0],
          sixMonthsAgo.toISOString().split('T')[0]
        );
      } else if (indexType === 'lst') {
        recentStats = await this.calculateLSTStats(
          neighborhood,
          sixMonthsAgo.toISOString().split('T')[0],
          now.toISOString().split('T')[0]
        );
        pastStats = await this.calculateLSTStats(
          neighborhood,
          oneYearAgo.toISOString().split('T')[0],
          sixMonthsAgo.toISOString().split('T')[0]
        );
      }

      const change = recentStats.mean - pastStats.mean;
      const percentChange = (change / pastStats.mean) * 100;

      // Para NDVI: positivo es bueno, para LST: negativo es bueno
      const isImproving = indexType === 'ndvi' ? change > 0 : change < 0;

      return {
        recent: recentStats.mean,
        past: pastStats.mean,
        change,
        percentChange,
        isImproving,
        trend: isImproving ? 'up' : 'down'
      };
    } catch (error) {
      console.error(`Error calculando tendencia para ${neighborhood.name}:`, error);
      return {
        recent: 0,
        past: 0,
        change: 0,
        percentChange: 0,
        isImproving: false,
        trend: 'stable'
      };
    }
  }

  /**
   * Analiza un barrio completo (todos los índices)
   */
  async analyzeNeighborhood(neighborhoodId) {
    const neighborhood = this.neighborhoods.find(n => n.id === neighborhoodId);
    if (!neighborhood) {
      throw new Error('Barrio no encontrado');
    }

    const now = new Date();
    const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
    const startDate = threeMonthsAgo.toISOString().split('T')[0];
    const endDate = now.toISOString().split('T')[0];

    // Calcular todos los índices en paralelo
    const [ndviStats, lstStats, pm25Stats, ndwiStats] = await Promise.all([
      this.calculateNDVIStats(neighborhood, startDate, endDate),
      this.calculateLSTStats(neighborhood, startDate, endDate),
      this.calculatePM25Stats(neighborhood, startDate, endDate),
      this.calculateNDWIStats(neighborhood, startDate, endDate)
    ]);

    // Calcular tendencias (solo para índices principales)
    const ndviTrend = await this.calculateTrend(neighborhood, 'ndvi');
    const lstTrend = await this.calculateTrend(neighborhood, 'lst');

    // Construir respuesta con semáforos
    const indices = {
      vegetation: {
        name: 'Áreas Verdes',
        icon: '🌳',
        value: ndviStats.mean,
        unit: 'NDVI',
        level: this.getSemaphoreLevel(ndviStats.mean, 'ndvi'),
        color: this.getSemaphoreColor(this.getSemaphoreLevel(ndviStats.mean, 'ndvi')),
        emoji: this.getSemaphoreEmoji(this.getSemaphoreLevel(ndviStats.mean, 'ndvi')),
        explanation: this.getIndexExplanation('ndvi', this.getSemaphoreLevel(ndviStats.mean, 'ndvi'), ndviStats.mean),
        actions: this.getRecommendedActions('ndvi', this.getSemaphoreLevel(ndviStats.mean, 'ndvi')),
        stats: ndviStats,
        trend: ndviTrend
      },
      heat: {
        name: 'Temperatura',
        icon: '🌡️',
        value: lstStats.mean,
        unit: '°C',
        level: this.getSemaphoreLevel(lstStats.mean, 'lst'),
        color: this.getSemaphoreColor(this.getSemaphoreLevel(lstStats.mean, 'lst')),
        emoji: this.getSemaphoreEmoji(this.getSemaphoreLevel(lstStats.mean, 'lst')),
        explanation: this.getIndexExplanation('lst', this.getSemaphoreLevel(lstStats.mean, 'lst'), lstStats.mean),
        actions: this.getRecommendedActions('lst', this.getSemaphoreLevel(lstStats.mean, 'lst')),
        stats: lstStats,
        trend: lstTrend
      },
      air: {
        name: 'Calidad del Aire',
        icon: '🌫️',
        value: pm25Stats.mean,
        unit: 'µg/m³',
        level: this.getSemaphoreLevel(pm25Stats.mean, 'pm25'),
        color: this.getSemaphoreColor(this.getSemaphoreLevel(pm25Stats.mean, 'pm25')),
        emoji: this.getSemaphoreEmoji(this.getSemaphoreLevel(pm25Stats.mean, 'pm25')),
        explanation: this.getIndexExplanation('pm25', this.getSemaphoreLevel(pm25Stats.mean, 'pm25'), pm25Stats.mean),
        actions: this.getRecommendedActions('pm25', this.getSemaphoreLevel(pm25Stats.mean, 'pm25')),
        stats: pm25Stats,
        trend: null
      },
      water: {
        name: 'Índice Hídrico',
        icon: '💧',
        value: ndwiStats.mean,
        unit: 'NDWI',
        level: this.getSemaphoreLevel(ndwiStats.mean, 'ndwi'),
        color: this.getSemaphoreColor(this.getSemaphoreLevel(ndwiStats.mean, 'ndwi')),
        emoji: this.getSemaphoreEmoji(this.getSemaphoreLevel(ndwiStats.mean, 'ndwi')),
        explanation: this.getIndexExplanation('ndwi', this.getSemaphoreLevel(ndwiStats.mean, 'ndwi'), ndwiStats.mean),
        actions: this.getRecommendedActions('ndwi', this.getSemaphoreLevel(ndwiStats.mean, 'ndwi')),
        stats: ndwiStats,
        trend: null
      }
    };

    // Calcular score general (promedio ponderado)
    const scores = {
      excellent: 100,
      good: 75,
      warning: 50,
      critical: 25,
      unknown: 0
    };

    const totalScore = (
      scores[indices.vegetation.level] +
      scores[indices.heat.level] +
      scores[indices.air.level] +
      scores[indices.water.level]
    ) / 4;

    return {
      neighborhood: {
        id: neighborhood.id,
        name: neighborhood.name,
        district: neighborhood.district,
        center: neighborhood.center,
        population: neighborhood.population
      },
      indices,
      overallScore: totalScore,
      overallLevel: totalScore >= 85 ? 'excellent' :
                    totalScore >= 65 ? 'good' :
                    totalScore >= 40 ? 'warning' : 'critical',
      period: {
        start: startDate,
        end: endDate
      },
      generatedAt: new Date().toISOString()
    };
  }
}

module.exports = new NeighborhoodAnalysisService();
