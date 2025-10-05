/**
 * @fileoverview Servicio de Validación Comunitaria para Reportes Ciudadanos
 * @module services/reportValidationService
 * 
 * Implementa el sistema completo de validación peer-to-peer:
 * - Confirmaciones y rechazos comunitarios
 * - Detección automática de duplicados
 * - Sistema de moderación
 * - Historial de cambios auditable
 * - Métricas de validación
 */

const crypto = require('crypto');

/**
 * Servicio de Validación de Reportes
 * En producción conectaría con PostgreSQL/PostGIS
 * Para el MVP usa almacenamiento en memoria
 */
class ReportValidationService {
  constructor() {
    // Almacenes en memoria (en producción sería PostgreSQL)
    this.validations = new Map(); // reportId -> [validations]
    this.changeHistory = new Map(); // reportId -> [changes]
    this.moderators = new Map(); // identifier -> moderator info
    this.duplicateCache = new Map(); // reportId -> [duplicate candidates]
    
    // Configuración
    this.config = {
      confirmationsThreshold: 3, // Confirmaciones necesarias para validar
      rejectionsThreshold: 3,    // Rechazos para marcar como inválido
      duplicatesThreshold: 2,     // Marcas de duplicado para considerar
      duplicateDistanceMeters: 100, // Radio de búsqueda de duplicados
      duplicateTimeWindowHours: 48, // Ventana temporal de duplicados
      textSimilarityThreshold: 0.3  // Umbral de similitud de texto
    };
    
    // Inicializar moderador admin
    this.addModerator('admin@ecoplan.pe', {
      name: 'Admin EcoPlan',
      email: 'admin@ecoplan.pe',
      role: 'admin'
    });
  }

  /**
   * Genera hash de identificador de usuario (para anonimización)
   * @param {string} identifier - IP, session ID, o user ID
   * @returns {string} Hash del identificador
   */
  hashUserIdentifier(identifier) {
    return crypto.createHash('sha256').update(identifier).digest('hex').substring(0, 16);
  }

  /**
   * Aplica una validación a un reporte
   * @param {Object} params - Parámetros de validación
   * @returns {Object} Resultado de la validación
   */
  async applyValidation({ reportId, userIdentifier, validationType, comment, newSeverity, duplicateOf, reports }) {
    const hashedUser = this.hashUserIdentifier(userIdentifier);
    
    // Validar que el reporte existe
    const report = reports.find(r => r.id === reportId);
    if (!report) {
      return { success: false, error: 'Reporte no encontrado' };
    }

    // Validar tipo de validación
    const validTypes = ['confirm', 'reject', 'duplicate', 'update_severity'];
    if (!validTypes.includes(validationType)) {
      return { success: false, error: 'Tipo de validación inválido' };
    }

    // Crear/actualizar validación
    if (!this.validations.has(reportId)) {
      this.validations.set(reportId, []);
    }

    const reportValidations = this.validations.get(reportId);
    
    // Verificar si el usuario ya validó este tipo
    const existingIndex = reportValidations.findIndex(
      v => v.userIdentifier === hashedUser && v.validationType === validationType
    );

    const validation = {
      id: existingIndex >= 0 ? reportValidations[existingIndex].id : Date.now(),
      reportId,
      userIdentifier: hashedUser,
      validationType,
      comment,
      newSeverity,
      duplicateOf,
      createdAt: new Date().toISOString()
    };

    if (existingIndex >= 0) {
      reportValidations[existingIndex] = validation;
    } else {
      reportValidations.push(validation);
    }

    // Contar validaciones
    const confirmations = reportValidations.filter(v => v.validationType === 'confirm').length;
    const rejections = reportValidations.filter(v => v.validationType === 'reject').length;
    const duplicates = reportValidations.filter(v => v.validationType === 'duplicate').length;

    const oldStatus = report.validationStatus || 'pending';
    let newStatus = oldStatus;
    let statusChanged = false;

    // Lógica de cambio de estado
    if (duplicates >= this.config.duplicatesThreshold) {
      newStatus = 'duplicate';
      report.validationStatus = newStatus;
      report.isDuplicateOf = duplicateOf;
      statusChanged = true;
      this.addChangeHistory(reportId, 'duplicate_marked', oldStatus, newStatus, 'community', 
        'Múltiples usuarios reportaron como duplicado');
    } 
    else if (rejections >= this.config.rejectionsThreshold) {
      newStatus = 'rejected';
      report.validationStatus = newStatus;
      statusChanged = true;
      this.addChangeHistory(reportId, 'status_change', oldStatus, newStatus, 'community', 
        'Rechazado por la comunidad');
    }
    else if (confirmations >= this.config.confirmationsThreshold && oldStatus === 'pending') {
      newStatus = 'community_validated';
      report.validationStatus = newStatus;
      report.validatedAt = new Date().toISOString();
      report.validatedBy = 'community';
      statusChanged = true;
      this.addChangeHistory(reportId, 'validated', oldStatus, newStatus, 'community', 
        'Validado por la comunidad');
    }

    // Actualizar contadores en el reporte
    report.confirmedCount = confirmations;
    report.rejectedCount = rejections;
    report.duplicateCount = duplicates;
    report.validationScore = confirmations - rejections;

    // Manejar actualización de severidad
    if (validationType === 'update_severity' && newSeverity) {
      const severityVotes = this.getSeverityVotes(reportId);
      const mostVoted = this.getMostVotedSeverity(severityVotes);
      
      if (mostVoted && severityVotes[mostVoted] >= 2) {
        const oldSeverity = report.severity;
        report.severity = mostVoted;
        this.addChangeHistory(reportId, 'severity_change', oldSeverity, mostVoted, 'community', 
          `Severidad actualizada por consenso (${severityVotes[mostVoted]} votos)`);
      }
    }

    return {
      success: true,
      reportId,
      validationType,
      confirmations,
      rejections,
      duplicates,
      currentStatus: newStatus,
      statusChanged,
      validationScore: report.validationScore
    };
  }

  /**
   * Validación directa por moderador
   */
  async moderatorValidate({ reportId, moderatorIdentifier, newStatus, reason, newSeverity, duplicateOf, reports }) {
    // Verificar que es moderador
    const moderator = this.moderators.get(moderatorIdentifier);
    if (!moderator || !moderator.active) {
      return { success: false, error: 'Usuario no es moderador activo' };
    }

    const report = reports.find(r => r.id === reportId);
    if (!report) {
      return { success: false, error: 'Reporte no encontrado' };
    }

    const oldStatus = report.validationStatus || 'pending';
    const oldSeverity = report.severity;

    // Aplicar cambios
    report.validationStatus = newStatus;
    report.validatedAt = new Date().toISOString();
    report.validatedBy = moderatorIdentifier;
    
    if (newSeverity) {
      report.severity = newSeverity;
    }
    
    if (duplicateOf) {
      report.isDuplicateOf = duplicateOf;
    }

    // Registrar en historial
    this.addChangeHistory(reportId, 'moderated', oldStatus, newStatus, moderatorIdentifier, reason);
    
    if (newSeverity && newSeverity !== oldSeverity) {
      this.addChangeHistory(reportId, 'severity_change', oldSeverity, newSeverity, moderatorIdentifier, 
        'Moderador ajustó severidad');
    }

    // Actualizar última actividad del moderador
    moderator.lastActivity = new Date().toISOString();

    return {
      success: true,
      reportId,
      oldStatus,
      newStatus,
      moderatedBy: moderatorIdentifier,
      moderatorName: moderator.name
    };
  }

  /**
   * Detecta reportes duplicados potenciales
   */
  detectDuplicates(reportId, reports) {
    const report = reports.find(r => r.id === reportId);
    if (!report) return [];

    const candidates = reports.filter(r => {
      if (r.id === reportId) return false;
      if (r.validationStatus === 'duplicate') return false;
      if (r.reportType !== report.reportType) return false;

      // Distancia espacial
      const distance = this.calculateDistance(
        report.latitude, report.longitude,
        r.latitude, r.longitude
      );
      if (distance > this.config.duplicateDistanceMeters) return false;

      // Distancia temporal
      const timeDiff = Math.abs(
        new Date(r.reportedAt) - new Date(report.reportedAt)
      ) / (1000 * 60 * 60); // horas
      if (timeDiff > this.config.duplicateTimeWindowHours) return false;

      // Similitud de texto
      const similarity = this.calculateTextSimilarity(
        report.description || '',
        r.description || ''
      );
      if (similarity < this.config.textSimilarityThreshold) return false;

      return true;
    });

    // Calcular score compuesto para cada candidato
    const duplicatesWithScore = candidates.map(candidate => {
      const distance = this.calculateDistance(
        report.latitude, report.longitude,
        candidate.latitude, candidate.longitude
      );
      const timeDiff = Math.abs(
        new Date(candidate.reportedAt) - new Date(report.reportedAt)
      ) / (1000 * 60 * 60);
      const similarity = this.calculateTextSimilarity(
        report.description || '',
        candidate.description || ''
      );

      const score = 
        (1 - distance / this.config.duplicateDistanceMeters) * 0.4 +
        (1 - timeDiff / this.config.duplicateTimeWindowHours) * 0.3 +
        similarity * 0.3;

      return {
        duplicateId: candidate.id,
        distanceMeters: Math.round(distance),
        hoursApart: Math.round(timeDiff * 10) / 10,
        textSimilarity: Math.round(similarity * 100) / 100,
        duplicateScore: Math.round(score * 100) / 100,
        report: candidate
      };
    });

    // Ordenar por score descendente
    duplicatesWithScore.sort((a, b) => b.duplicateScore - a.duplicateScore);

    // Cachear resultados
    this.duplicateCache.set(reportId, duplicatesWithScore);

    return duplicatesWithScore;
  }

  /**
   * Calcula distancia Haversine entre dos puntos
   */
  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371000; // Radio de la Tierra en metros
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  /**
   * Calcula similitud de texto (coeficiente de Dice)
   */
  calculateTextSimilarity(text1, text2) {
    const bigrams1 = this.getBigrams(text1.toLowerCase());
    const bigrams2 = this.getBigrams(text2.toLowerCase());
    
    const intersection = bigrams1.filter(b => bigrams2.includes(b)).length;
    const union = bigrams1.length + bigrams2.length;
    
    return union === 0 ? 0 : (2.0 * intersection) / union;
  }

  /**
   * Obtiene bigramas de un texto
   */
  getBigrams(text) {
    const bigrams = [];
    for (let i = 0; i < text.length - 1; i++) {
      bigrams.push(text.slice(i, i + 2));
    }
    return bigrams;
  }

  /**
   * Obtiene votos de severidad para un reporte
   */
  getSeverityVotes(reportId) {
    const reportValidations = this.validations.get(reportId) || [];
    const votes = {};
    
    reportValidations
      .filter(v => v.validationType === 'update_severity' && v.newSeverity)
      .forEach(v => {
        votes[v.newSeverity] = (votes[v.newSeverity] || 0) + 1;
      });
    
    return votes;
  }

  /**
   * Obtiene la severidad más votada
   */
  getMostVotedSeverity(votes) {
    let maxVotes = 0;
    let mostVoted = null;
    
    for (const [severity, count] of Object.entries(votes)) {
      if (count > maxVotes) {
        maxVotes = count;
        mostVoted = severity;
      }
    }
    
    return mostVoted;
  }

  /**
   * Agrega entrada al historial de cambios
   */
  addChangeHistory(reportId, changeType, oldValue, newValue, changedBy, reason) {
    if (!this.changeHistory.has(reportId)) {
      this.changeHistory.set(reportId, []);
    }

    this.changeHistory.get(reportId).push({
      id: Date.now(),
      reportId,
      changeType,
      oldValue,
      newValue,
      changedBy,
      reason,
      createdAt: new Date().toISOString()
    });
  }

  /**
   * Obtiene historial de cambios de un reporte
   */
  getChangeHistory(reportId) {
    return this.changeHistory.get(reportId) || [];
  }

  /**
   * Obtiene validaciones de un reporte
   */
  getReportValidations(reportId) {
    return this.validations.get(reportId) || [];
  }

  /**
   * Obtiene métricas de validación globales
   */
  getValidationMetrics(reports) {
    const total = reports.length;
    const communityValidated = reports.filter(r => r.validationStatus === 'community_validated').length;
    const moderatorValidated = reports.filter(r => r.validationStatus === 'moderator_validated').length;
    const rejected = reports.filter(r => r.validationStatus === 'rejected').length;
    const duplicates = reports.filter(r => r.validationStatus === 'duplicate').length;
    const pending = reports.filter(r => r.validationStatus === 'pending' || !r.validationStatus).length;

    const validated = communityValidated + moderatorValidated;
    const pctValidated = total > 0 ? Math.round((validated / total) * 100 * 100) / 100 : 0;
    const pctCommunityValidated = total > 0 ? Math.round((communityValidated / total) * 100 * 100) / 100 : 0;

    // Calcular tiempos promedio de validación
    const validatedReports = reports.filter(r => r.validatedAt);
    let avgHoursToValidation = 0;
    let medianHoursToValidation = 0;

    if (validatedReports.length > 0) {
      const times = validatedReports.map(r => {
        const reported = new Date(r.reportedAt);
        const validated = new Date(r.validatedAt);
        return (validated - reported) / (1000 * 60 * 60); // horas
      }).sort((a, b) => a - b);

      avgHoursToValidation = Math.round((times.reduce((a, b) => a + b, 0) / times.length) * 100) / 100;
      medianHoursToValidation = times[Math.floor(times.length / 2)];
    }

    // Validados por severidad
    const validatedBySeverity = {
      low: reports.filter(r => ['community_validated', 'moderator_validated'].includes(r.validationStatus) && r.severity === 'low').length,
      medium: reports.filter(r => ['community_validated', 'moderator_validated'].includes(r.validationStatus) && r.severity === 'medium').length,
      high: reports.filter(r => ['community_validated', 'moderator_validated'].includes(r.validationStatus) && r.severity === 'high').length
    };

    return {
      totalReports: total,
      communityValidated,
      moderatorValidated,
      rejected,
      duplicates,
      pending,
      pctValidated,
      pctCommunityValidated,
      avgHoursToValidation,
      medianHoursToValidation,
      validatedBySeverity
    };
  }

  /**
   * Agrega un moderador
   */
  addModerator(identifier, info) {
    this.moderators.set(identifier, {
      identifier,
      name: info.name || 'Moderador',
      email: info.email || '',
      role: info.role || 'moderator',
      active: true,
      createdAt: new Date().toISOString(),
      lastActivity: null
    });
  }

  /**
   * Obtiene lista de moderadores
   */
  getModerators() {
    return Array.from(this.moderators.values());
  }

  /**
   * Verifica si un identificador es moderador
   */
  isModerator(identifier) {
    const moderator = this.moderators.get(identifier);
    return moderator && moderator.active;
  }

  /**
   * Obtiene estadísticas extendidas de un reporte
   */
  getReportWithValidationStats(reportId, reports) {
    const report = reports.find(r => r.id === reportId);
    if (!report) return null;

    const validations = this.getReportValidations(reportId);
    const history = this.getChangeHistory(reportId);
    const duplicates = this.duplicateCache.get(reportId) || [];

    const uniqueValidators = new Set(validations.map(v => v.userIdentifier)).size;
    
    const reportedAt = new Date(report.reportedAt);
    const now = new Date();
    const hoursSinceReport = (now - reportedAt) / (1000 * 60 * 60);

    let hoursToValidation = null;
    if (report.validatedAt) {
      const validatedAt = new Date(report.validatedAt);
      hoursToValidation = (validatedAt - reportedAt) / (1000 * 60 * 60);
    }

    return {
      ...report,
      totalValidations: validations.length,
      uniqueValidators,
      potentialDuplicates: duplicates.length,
      changeCount: history.length,
      lastChangeAt: history.length > 0 ? history[history.length - 1].createdAt : null,
      hoursSinceReport: Math.round(hoursSinceReport * 100) / 100,
      hoursToValidation: hoursToValidation ? Math.round(hoursToValidation * 100) / 100 : null,
      validations,
      history,
      duplicateCandidates: duplicates.slice(0, 5) // Top 5 duplicados
    };
  }
}

module.exports = new ReportValidationService();
