/**
 * @fileoverview Servicio de Micro-encuestas de 1 Clic
 * @module services/microSurveyService
 * 
 * Implementa sistema ultraligero de recolección de contexto mediante
 * chips de respuesta rápida. Los resultados se agregan por barrio.
 */

const crypto = require('crypto');

/**
 * Servicio de Micro-encuestas
 * En producción conectaría con PostgreSQL/PostGIS
 * Para el MVP usa almacenamiento en memoria
 */
class MicroSurveyService {
  constructor() {
    // Almacenes en memoria
    this.responses = new Map(); // reportId -> Map(questionKey -> response)
    this.neighborhoodAggregations = new Map(); // neighborhood -> Map(questionKey -> Map(option -> count))
    this.neighborhoodCoverage = new Map(); // neighborhood -> coverage stats
    
    // Plantillas de preguntas
    this.surveyTemplates = this.initializeTemplates();
    
    // Configuración
    this.config = {
      maxQuestionsPerReport: 5,
      minResponsesForAggregation: 3,
      neighborhoodGridSize: 0.01 // ~1km para simplificar geocoding
    };
  }

  /**
   * Inicializa plantillas de micro-encuestas
   */
  initializeTemplates() {
    return [
      // Pregunta 1: Duración
      {
        questionKey: 'duration',
        questionText: '¿Hace cuánto persiste?',
        questionIcon: '⏱️',
        category: null, // aplica a todas
        options: [
          { value: 'hours', label: 'Horas', icon: '🕐' },
          { value: 'days', label: 'Días', icon: '📅' },
          { value: 'weeks', label: 'Semanas', icon: '📆' },
          { value: 'months', label: 'Meses+', icon: '📊' }
        ],
        displayOrder: 1,
        active: true
      },
      
      // Pregunta 2: Grupos vulnerables
      {
        questionKey: 'vulnerable_groups',
        questionText: '¿Afecta a grupos vulnerables?',
        questionIcon: '👥',
        category: null,
        options: [
          { value: 'elderly', label: 'Adultos mayores', icon: '👴' },
          { value: 'children', label: 'Niños', icon: '👶' },
          { value: 'disabled', label: 'Personas con discapacidad', icon: '♿' },
          { value: 'none', label: 'No específicamente', icon: '✅' }
        ],
        displayOrder: 2,
        active: true
      },
      
      // Pregunta 3: Lugares sensibles
      {
        questionKey: 'nearby_sensitive',
        questionText: '¿Cerca de lugar sensible?',
        questionIcon: '📍',
        category: null,
        options: [
          { value: 'school', label: 'Colegio', icon: '🏫' },
          { value: 'hospital', label: 'Hospital/Centro de salud', icon: '🏥' },
          { value: 'market', label: 'Mercado', icon: '🛒' },
          { value: 'park', label: 'Parque/Área verde', icon: '🌳' },
          { value: 'none', label: 'Ninguno cercano', icon: '❌' }
        ],
        displayOrder: 3,
        active: true
      },
      
      // Pregunta 4: Frecuencia
      {
        questionKey: 'frequency',
        questionText: '¿Con qué frecuencia ocurre?',
        questionIcon: '🔄',
        category: null,
        options: [
          { value: 'constant', label: 'Constante', icon: '🔴' },
          { value: 'daily', label: 'Diario', icon: '📆' },
          { value: 'weekly', label: 'Semanal', icon: '📅' },
          { value: 'occasional', label: 'Ocasional', icon: '🟡' }
        ],
        displayOrder: 4,
        active: true
      },
      
      // Pregunta 5: Impacto
      {
        questionKey: 'impact_level',
        questionText: '¿Qué tan grave es el impacto?',
        questionIcon: '⚠️',
        category: null,
        options: [
          { value: 'critical', label: 'Crítico', icon: '🚨' },
          { value: 'high', label: 'Alto', icon: '🔴' },
          { value: 'moderate', label: 'Moderado', icon: '🟡' },
          { value: 'low', label: 'Bajo', icon: '🟢' }
        ],
        displayOrder: 5,
        active: true
      },
      
      // Preguntas específicas por categoría
      {
        questionKey: 'heat_time',
        questionText: '¿Cuándo es más intenso el calor?',
        questionIcon: '🌡️',
        category: 'heat',
        options: [
          { value: 'morning', label: 'Mañana', icon: '🌅' },
          { value: 'midday', label: 'Mediodía', icon: '☀️' },
          { value: 'afternoon', label: 'Tarde', icon: '🌇' },
          { value: 'allday', label: 'Todo el día', icon: '🔥' }
        ],
        displayOrder: 6,
        active: true
      },
      
      {
        questionKey: 'green_access',
        questionText: '¿Hay acceso público al área verde?',
        questionIcon: '🌳',
        category: 'green',
        options: [
          { value: 'open', label: 'Sí, abierto', icon: '✅' },
          { value: 'restricted', label: 'Restringido', icon: '🚧' },
          { value: 'closed', label: 'Cerrado', icon: '🔒' },
          { value: 'unknown', label: 'No sé', icon: '❓' }
        ],
        displayOrder: 7,
        active: true
      },
      
      {
        questionKey: 'waste_volume',
        questionText: '¿Cuánta basura aproximadamente?',
        questionIcon: '🗑️',
        category: 'waste',
        options: [
          { value: 'bags_1_3', label: '1-3 bolsas', icon: '🗑️' },
          { value: 'bags_4_10', label: '4-10 bolsas', icon: '🗑️🗑️' },
          { value: 'pile', label: 'Montículo', icon: '⛰️' },
          { value: 'dumpsite', label: 'Botadero', icon: '🚨' }
        ],
        displayOrder: 8,
        active: true
      },
      
      {
        questionKey: 'flooding_depth',
        questionText: '¿Qué tan profunda es la inundación?',
        questionIcon: '💧',
        category: 'flooding',
        options: [
          { value: 'puddle', label: 'Charco', icon: '💧' },
          { value: 'ankle', label: 'Hasta tobillo', icon: '🦶' },
          { value: 'knee', label: 'Hasta rodilla', icon: '🦵' },
          { value: 'waist', label: 'Hasta cintura+', icon: '🚨' }
        ],
        displayOrder: 9,
        active: true
      }
    ];
  }

  /**
   * Obtiene preguntas aplicables para un reporte
   */
  getQuestionsForReport(reportCategory) {
    const questions = this.surveyTemplates
      .filter(t => t.active && (t.category === null || t.category === reportCategory))
      .sort((a, b) => a.displayOrder - b.displayOrder)
      .slice(0, this.config.maxQuestionsPerReport);
    
    return questions;
  }

  /**
   * Genera hash de identificador de usuario
   */
  hashUserIdentifier(identifier) {
    return crypto.createHash('sha256').update(identifier).digest('hex').substring(0, 16);
  }

  /**
   * Obtiene barrio simplificado desde coordenadas
   * (Geocoding simplificado para Lima)
   */
  getNeighborhoodFromLocation(latitude, longitude) {
    // Grid simplificado para agrupar por área
    const latGrid = Math.floor(latitude / this.config.neighborhoodGridSize);
    const lonGrid = Math.floor(longitude / this.config.neighborhoodGridSize);
    
    // Nombres simplificados de barrios de Lima
    let neighborhood = 'Desconocido';
    let district = 'Lima';
    
    // Zona de Lima Metropolitana (~-12.0, -77.0)
    if (latitude >= -12.2 && latitude <= -11.8 && longitude >= -77.2 && longitude <= -76.8) {
      // Simplificación: cuadrantes
      if (latitude > -12.0 && longitude > -77.0) {
        neighborhood = 'San Isidro Centro';
        district = 'San Isidro';
      } else if (latitude > -12.0) {
        neighborhood = 'Miraflores Norte';
        district = 'Miraflores';
      } else if (longitude > -77.0) {
        neighborhood = 'Surquillo Este';
        district = 'Surquillo';
      } else {
        neighborhood = 'Barranco Sur';
        district = 'Barranco';
      }
    }
    
    // Agregar identificador único de grid
    const gridId = `${latGrid}_${lonGrid}`;
    
    return {
      neighborhood,
      district,
      gridId,
      lat: latitude,
      lon: longitude
    };
  }

  /**
   * Registra una respuesta de micro-encuesta
   */
  async recordResponse({ reportId, questionKey, selectedOption, userIdentifier, latitude, longitude }) {
    const hashedUser = this.hashUserIdentifier(userIdentifier);
    
    // Validar pregunta existe
    const template = this.surveyTemplates.find(t => t.questionKey === questionKey);
    if (!template) {
      return { success: false, error: 'Pregunta no encontrada' };
    }
    
    // Validar opción existe
    const option = template.options.find(o => o.value === selectedOption);
    if (!option) {
      return { success: false, error: 'Opción inválida' };
    }
    
    // Obtener ubicación (barrio)
    const location = this.getNeighborhoodFromLocation(latitude, longitude);
    
    // Guardar respuesta por reporte
    if (!this.responses.has(reportId)) {
      this.responses.set(reportId, new Map());
    }
    
    const reportResponses = this.responses.get(reportId);
    const responseKey = `${questionKey}_${hashedUser}`;
    const isNewResponse = !reportResponses.has(responseKey);
    
    reportResponses.set(responseKey, {
      questionKey,
      selectedOption,
      userIdentifier: hashedUser,
      location,
      createdAt: new Date().toISOString()
    });
    
    // Actualizar agregaciones por barrio
    this.updateNeighborhoodAggregations(location.neighborhood, questionKey, selectedOption);
    
    // Actualizar cobertura
    this.updateNeighborhoodCoverage(location.neighborhood, location.district, reportId, hashedUser);
    
    // Calcular progreso
    const progress = this.getReportProgress(reportId, template.category);
    
    return {
      success: true,
      isNewResponse,
      neighborhood: location.neighborhood,
      district: location.district,
      progress,
      neighborhoodStats: this.getNeighborhoodStats(location.neighborhood)
    };
  }

  /**
   * Actualiza agregaciones por barrio
   */
  updateNeighborhoodAggregations(neighborhood, questionKey, selectedOption) {
    if (!this.neighborhoodAggregations.has(neighborhood)) {
      this.neighborhoodAggregations.set(neighborhood, new Map());
    }
    
    const neighborhoodData = this.neighborhoodAggregations.get(neighborhood);
    
    if (!neighborhoodData.has(questionKey)) {
      neighborhoodData.set(questionKey, new Map());
    }
    
    const questionData = neighborhoodData.get(questionKey);
    const currentCount = questionData.get(selectedOption) || 0;
    questionData.set(selectedOption, currentCount + 1);
  }

  /**
   * Actualiza cobertura del barrio
   */
  updateNeighborhoodCoverage(neighborhood, district, reportId, userIdentifier) {
    if (!this.neighborhoodCoverage.has(neighborhood)) {
      this.neighborhoodCoverage.set(neighborhood, {
        neighborhood,
        district,
        reportIds: new Set(),
        userIds: new Set(),
        totalResponses: 0,
        lastResponseAt: null
      });
    }
    
    const coverage = this.neighborhoodCoverage.get(neighborhood);
    coverage.reportIds.add(reportId);
    coverage.userIds.add(userIdentifier);
    coverage.totalResponses++;
    coverage.lastResponseAt = new Date().toISOString();
  }

  /**
   * Obtiene progreso de encuestas para un reporte
   */
  getReportProgress(reportId, category) {
    const applicableQuestions = this.getQuestionsForReport(category);
    const totalQuestions = applicableQuestions.length;
    
    const reportResponses = this.responses.get(reportId) || new Map();
    
    // Contar preguntas únicas respondidas
    const answeredQuestions = new Set();
    for (const [key, response] of reportResponses) {
      answeredQuestions.add(response.questionKey);
    }
    
    const answeredCount = answeredQuestions.size;
    const progressPercentage = totalQuestions > 0 
      ? Math.round((answeredCount / totalQuestions) * 100) 
      : 0;
    
    return {
      totalQuestions,
      answeredQuestions: answeredCount,
      progressPercentage,
      isComplete: answeredCount >= totalQuestions
    };
  }

  /**
   * Obtiene estadísticas del barrio
   */
  getNeighborhoodStats(neighborhood) {
    const coverage = this.neighborhoodCoverage.get(neighborhood);
    if (!coverage) {
      return {
        neighborhood,
        totalReports: 0,
        totalResponses: 0,
        uniqueRespondents: 0,
        responseRate: 0,
        lastResponseAt: null
      };
    }
    
    const totalReports = coverage.reportIds.size;
    const totalResponses = coverage.totalResponses;
    const uniqueRespondents = coverage.userIds.size;
    const responseRate = totalReports > 0 
      ? Math.round((totalResponses / totalReports) * 100) 
      : 0;
    
    return {
      neighborhood: coverage.neighborhood,
      district: coverage.district,
      totalReports,
      totalResponses,
      uniqueRespondents,
      responseRate,
      lastResponseAt: coverage.lastResponseAt
    };
  }

  /**
   * Obtiene agregaciones de un barrio
   */
  getNeighborhoodAggregations(neighborhood) {
    const neighborhoodData = this.neighborhoodAggregations.get(neighborhood);
    if (!neighborhoodData) {
      return {};
    }
    
    const result = {};
    
    for (const [questionKey, optionsMap] of neighborhoodData) {
      const template = this.surveyTemplates.find(t => t.questionKey === questionKey);
      if (!template) continue;
      
      // Calcular total de respuestas para esta pregunta
      const totalResponses = Array.from(optionsMap.values()).reduce((a, b) => a + b, 0);
      
      // Construir distribución con porcentajes
      const distribution = [];
      for (const [option, count] of optionsMap) {
        const optionData = template.options.find(o => o.value === option);
        const percentage = totalResponses > 0 
          ? Math.round((count / totalResponses) * 100) 
          : 0;
        
        distribution.push({
          value: option,
          label: optionData?.label || option,
          icon: optionData?.icon || '',
          count,
          percentage
        });
      }
      
      // Ordenar por count descendente
      distribution.sort((a, b) => b.count - a.count);
      
      result[questionKey] = {
        questionText: template.questionText,
        questionIcon: template.questionIcon,
        totalResponses,
        distribution,
        topAnswer: distribution[0] || null
      };
    }
    
    return result;
  }

  /**
   * Obtiene respuestas de un reporte específico
   */
  getReportResponses(reportId) {
    const reportResponses = this.responses.get(reportId);
    if (!reportResponses) {
      return [];
    }
    
    const responses = [];
    const uniqueQuestions = new Map();
    
    for (const [key, response] of reportResponses) {
      const template = this.surveyTemplates.find(t => t.questionKey === response.questionKey);
      if (!template) continue;
      
      const option = template.options.find(o => o.value === response.selectedOption);
      
      // Agrupar por pregunta (última respuesta gana)
      uniqueQuestions.set(response.questionKey, {
        questionKey: response.questionKey,
        questionText: template.questionText,
        questionIcon: template.questionIcon,
        selectedOption: response.selectedOption,
        selectedLabel: option?.label || response.selectedOption,
        selectedIcon: option?.icon || '',
        createdAt: response.createdAt
      });
    }
    
    return Array.from(uniqueQuestions.values());
  }

  /**
   * Obtiene métricas globales de micro-encuestas
   */
  getGlobalMetrics() {
    const totalNeighborhoods = this.neighborhoodCoverage.size;
    let totalResponses = 0;
    let totalReports = new Set();
    let totalRespondents = new Set();
    
    for (const coverage of this.neighborhoodCoverage.values()) {
      totalResponses += coverage.totalResponses;
      coverage.reportIds.forEach(id => totalReports.add(id));
      coverage.userIds.forEach(id => totalRespondents.add(id));
    }
    
    // Calcular cobertura de barrios (con al menos X respuestas)
    const minResponses = this.config.minResponsesForAggregation;
    const neighborhoodsWithData = Array.from(this.neighborhoodCoverage.values())
      .filter(c => c.totalResponses >= minResponses).length;
    
    const neighborhoodCoveragePercent = totalNeighborhoods > 0
      ? Math.round((neighborhoodsWithData / totalNeighborhoods) * 100)
      : 0;
    
    // Tasa de respuesta promedio
    let totalResponseRate = 0;
    let neighborhoodsWithReports = 0;
    
    for (const coverage of this.neighborhoodCoverage.values()) {
      if (coverage.reportIds.size > 0) {
        const rate = (coverage.totalResponses / coverage.reportIds.size) * 100;
        totalResponseRate += rate;
        neighborhoodsWithReports++;
      }
    }
    
    const avgResponseRate = neighborhoodsWithReports > 0
      ? Math.round(totalResponseRate / neighborhoodsWithReports)
      : 0;
    
    return {
      totalNeighborhoods,
      neighborhoodsWithData,
      neighborhoodCoveragePercent,
      totalResponses,
      totalReports: totalReports.size,
      totalRespondents: totalRespondents.size,
      avgResponseRate,
      minResponsesForAggregation: minResponses
    };
  }

  /**
   * Obtiene top barrios por actividad
   */
  getTopNeighborhoods(limit = 10) {
    const neighborhoods = Array.from(this.neighborhoodCoverage.values())
      .map(c => this.getNeighborhoodStats(c.neighborhood))
      .sort((a, b) => b.totalResponses - a.totalResponses)
      .slice(0, limit);
    
    return neighborhoods;
  }

  /**
   * Obtiene todas las plantillas de preguntas
   */
  getTemplates(category = null) {
    return this.surveyTemplates
      .filter(t => t.active && (category === null || t.category === null || t.category === category))
      .sort((a, b) => a.displayOrder - b.displayOrder);
  }
}

module.exports = new MicroSurveyService();
