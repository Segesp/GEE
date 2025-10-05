/**
 * @fileoverview Servicio de Exportación de Datos Abiertos
 * @module services/dataExportService
 * 
 * Permite exportar reportes ciudadanos y datos agregados en formatos
 * abiertos (CSV, GeoJSON) para transparencia y reutilización.
 */

const crypto = require('crypto');

/**
 * Servicio de Exportación de Datos Abiertos
 */
class DataExportService {
  constructor() {
    // Registro de descargas para métricas
    this.downloadRegistry = new Map(); // downloadId -> metadata
    this.downloadStats = {
      totalDownloads: 0,
      byFormat: { csv: 0, geojson: 0 },
      byLayer: {},
      byDate: new Map() // YYYY-MM-DD -> count
    };
    
    // Capas disponibles para descarga
    this.availableLayers = [
      {
        id: 'citizen-reports',
        name: 'Reportes Ciudadanos',
        description: 'Todos los reportes enviados por la comunidad',
        formats: ['csv', 'geojson'],
        fields: [
          'id', 'category', 'latitude', 'longitude', 'description',
          'severity', 'status', 'createdAt', 'updatedAt',
          'validationStatus', 'confirmations', 'rejections'
        ]
      },
      {
        id: 'validated-reports',
        name: 'Reportes Validados',
        description: 'Reportes confirmados por la comunidad',
        formats: ['csv', 'geojson'],
        fields: [
          'id', 'category', 'latitude', 'longitude', 'description',
          'severity', 'status', 'createdAt', 'validationStatus',
          'confirmations', 'moderatorValidated'
        ]
      },
      {
        id: 'heat-reports',
        name: 'Reportes de Calor',
        description: 'Islas de calor reportadas',
        formats: ['csv', 'geojson'],
        category: 'heat'
      },
      {
        id: 'green-reports',
        name: 'Reportes de Áreas Verdes',
        description: 'Falta o pérdida de vegetación',
        formats: ['csv', 'geojson'],
        category: 'green'
      },
      {
        id: 'flooding-reports',
        name: 'Reportes de Inundaciones',
        description: 'Zonas propensas a inundación',
        formats: ['csv', 'geojson'],
        category: 'flooding'
      },
      {
        id: 'waste-reports',
        name: 'Reportes de Residuos',
        description: 'Acumulación de basura',
        formats: ['csv', 'geojson'],
        category: 'waste'
      },
      {
        id: 'neighborhood-aggregations',
        name: 'Agregaciones por Barrio',
        description: 'Estadísticas agregadas por barrio',
        formats: ['csv', 'geojson']
      },
      {
        id: 'survey-results',
        name: 'Resultados de Micro-encuestas',
        description: 'Respuestas agregadas de micro-encuestas',
        formats: ['csv']
      }
    ];
  }

  /**
   * Obtiene capas disponibles para descarga
   */
  getAvailableLayers() {
    return this.availableLayers.map(layer => ({
      id: layer.id,
      name: layer.name,
      description: layer.description,
      formats: layer.formats
    }));
  }

  /**
   * Genera ID único para descarga
   */
  generateDownloadId() {
    return crypto.randomBytes(8).toString('hex');
  }

  /**
   * Registra una descarga
   */
  registerDownload(metadata) {
    const downloadId = this.generateDownloadId();
    const timestamp = new Date();
    const dateKey = timestamp.toISOString().split('T')[0];
    
    const downloadRecord = {
      downloadId,
      ...metadata,
      timestamp,
      ipAddress: metadata.ipAddress || 'unknown',
      userAgent: metadata.userAgent || 'unknown'
    };
    
    this.downloadRegistry.set(downloadId, downloadRecord);
    
    // Actualizar estadísticas
    this.downloadStats.totalDownloads++;
    this.downloadStats.byFormat[metadata.format] = 
      (this.downloadStats.byFormat[metadata.format] || 0) + 1;
    this.downloadStats.byLayer[metadata.layerId] = 
      (this.downloadStats.byLayer[metadata.layerId] || 0) + 1;
    
    const dateCount = this.downloadStats.byDate.get(dateKey) || 0;
    this.downloadStats.byDate.set(dateKey, dateCount + 1);
    
    return downloadId;
  }

  /**
   * Exporta reportes ciudadanos a CSV
   */
  exportReportsToCSV(reports, options = {}) {
    const { includeValidation = true, includePhotos = false } = options;
    
    // Headers
    const headers = [
      'ID',
      'Categoría',
      'Latitud',
      'Longitud',
      'Descripción',
      'Severidad',
      'Estado',
      'Fecha Creación',
      'Fecha Actualización'
    ];
    
    if (includeValidation) {
      headers.push(
        'Estado Validación',
        'Confirmaciones',
        'Rechazos',
        'Validado por Moderador'
      );
    }
    
    if (includePhotos) {
      headers.push('URL Foto');
    }
    
    // Escape CSV field
    const escapeCSV = (field) => {
      if (field === null || field === undefined) return '';
      const str = String(field);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };
    
    // Build rows
    const rows = [headers.join(',')];
    
    for (const report of reports) {
      const row = [
        escapeCSV(report.id),
        escapeCSV(report.category),
        escapeCSV(report.latitude),
        escapeCSV(report.longitude),
        escapeCSV(report.description),
        escapeCSV(report.severity),
        escapeCSV(report.status),
        escapeCSV(report.createdAt),
        escapeCSV(report.updatedAt)
      ];
      
      if (includeValidation) {
        row.push(
          escapeCSV(report.validationStatus || 'pending'),
          escapeCSV(report.confirmations || 0),
          escapeCSV(report.rejections || 0),
          escapeCSV(report.moderatorValidated ? 'Sí' : 'No')
        );
      }
      
      if (includePhotos) {
        row.push(escapeCSV(report.photoUrl || ''));
      }
      
      rows.push(row.join(','));
    }
    
    return rows.join('\n');
  }

  /**
   * Exporta reportes ciudadanos a GeoJSON
   */
  exportReportsToGeoJSON(reports, options = {}) {
    const { includeValidation = true, includePhotos = false } = options;
    
    const features = reports.map(report => {
      const properties = {
        id: report.id,
        category: report.category,
        description: report.description,
        severity: report.severity,
        status: report.status,
        createdAt: report.createdAt,
        updatedAt: report.updatedAt
      };
      
      if (includeValidation) {
        properties.validationStatus = report.validationStatus || 'pending';
        properties.confirmations = report.confirmations || 0;
        properties.rejections = report.rejections || 0;
        properties.moderatorValidated = report.moderatorValidated || false;
      }
      
      if (includePhotos && report.photoUrl) {
        properties.photoUrl = report.photoUrl;
      }
      
      return {
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [report.longitude, report.latitude]
        },
        properties
      };
    });
    
    return {
      type: 'FeatureCollection',
      metadata: {
        generated: new Date().toISOString(),
        count: features.length,
        source: 'EcoPlan Citizen Reports',
        license: 'CC BY 4.0',
        attribution: 'EcoPlan Community'
      },
      features
    };
  }

  /**
   * Exporta agregaciones de barrio a CSV
   */
  exportNeighborhoodAggregationsToCSV(aggregations) {
    const headers = [
      'Barrio',
      'Distrito',
      'Total Reportes',
      'Reportes Calor',
      'Reportes Áreas Verdes',
      'Reportes Inundación',
      'Reportes Residuos',
      'Reportes Validados',
      'Tasa Respuesta Encuestas (%)',
      'Última Actividad'
    ];
    
    const escapeCSV = (field) => {
      if (field === null || field === undefined) return '';
      const str = String(field);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };
    
    const rows = [headers.join(',')];
    
    for (const agg of aggregations) {
      const row = [
        escapeCSV(agg.neighborhood),
        escapeCSV(agg.district),
        escapeCSV(agg.totalReports || 0),
        escapeCSV(agg.heatReports || 0),
        escapeCSV(agg.greenReports || 0),
        escapeCSV(agg.floodingReports || 0),
        escapeCSV(agg.wasteReports || 0),
        escapeCSV(agg.validatedReports || 0),
        escapeCSV(agg.surveyResponseRate || 0),
        escapeCSV(agg.lastActivity || '')
      ];
      
      rows.push(row.join(','));
    }
    
    return rows.join('\n');
  }

  /**
   * Exporta resultados de micro-encuestas a CSV
   */
  exportSurveyResultsToCSV(surveyResults) {
    const headers = [
      'Barrio',
      'Pregunta',
      'Opción',
      'Respuestas',
      'Porcentaje',
      'Total Respuestas Pregunta'
    ];
    
    const escapeCSV = (field) => {
      if (field === null || field === undefined) return '';
      const str = String(field);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };
    
    const rows = [headers.join(',')];
    
    for (const result of surveyResults) {
      for (const [questionKey, questionData] of Object.entries(result.aggregations)) {
        for (const distribution of questionData.distribution) {
          const row = [
            escapeCSV(result.neighborhood),
            escapeCSV(questionData.questionText),
            escapeCSV(distribution.label),
            escapeCSV(distribution.count),
            escapeCSV(distribution.percentage),
            escapeCSV(questionData.totalResponses)
          ];
          
          rows.push(row.join(','));
        }
      }
    }
    
    return rows.join('\n');
  }

  /**
   * Filtra reportes por criterios
   */
  filterReports(reports, criteria) {
    let filtered = [...reports];
    
    // Filtrar por categoría
    if (criteria.category) {
      filtered = filtered.filter(r => r.category === criteria.category);
    }
    
    // Filtrar por rango de fechas
    if (criteria.startDate) {
      const startDate = new Date(criteria.startDate);
      filtered = filtered.filter(r => new Date(r.createdAt) >= startDate);
    }
    
    if (criteria.endDate) {
      const endDate = new Date(criteria.endDate);
      filtered = filtered.filter(r => new Date(r.createdAt) <= endDate);
    }
    
    // Filtrar por estado de validación
    if (criteria.validationStatus) {
      filtered = filtered.filter(r => 
        (r.validationStatus || 'pending') === criteria.validationStatus
      );
    }
    
    // Filtrar por severidad
    if (criteria.severity) {
      filtered = filtered.filter(r => r.severity === criteria.severity);
    }
    
    // Filtrar por estado
    if (criteria.status) {
      filtered = filtered.filter(r => r.status === criteria.status);
    }
    
    // Filtrar solo validados
    if (criteria.onlyValidated) {
      filtered = filtered.filter(r => 
        r.validationStatus === 'confirmed' || r.moderatorValidated
      );
    }
    
    return filtered;
  }

  /**
   * Obtiene estadísticas de descargas
   */
  getDownloadStats(options = {}) {
    const { startDate, endDate, layerId, format } = options;
    
    let downloads = Array.from(this.downloadRegistry.values());
    
    // Filtrar por fecha
    if (startDate) {
      const start = new Date(startDate);
      downloads = downloads.filter(d => new Date(d.timestamp) >= start);
    }
    
    if (endDate) {
      const end = new Date(endDate);
      downloads = downloads.filter(d => new Date(d.timestamp) <= end);
    }
    
    // Filtrar por capa
    if (layerId) {
      downloads = downloads.filter(d => d.layerId === layerId);
    }
    
    // Filtrar por formato
    if (format) {
      downloads = downloads.filter(d => d.format === format);
    }
    
    // Calcular estadísticas
    const stats = {
      totalDownloads: downloads.length,
      byFormat: {},
      byLayer: {},
      byDate: {},
      recentDownloads: downloads
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        .slice(0, 10)
        .map(d => ({
          downloadId: d.downloadId,
          layerId: d.layerId,
          format: d.format,
          timestamp: d.timestamp,
          recordCount: d.recordCount
        }))
    };
    
    // Agrupar por formato
    for (const download of downloads) {
      stats.byFormat[download.format] = 
        (stats.byFormat[download.format] || 0) + 1;
    }
    
    // Agrupar por capa
    for (const download of downloads) {
      stats.byLayer[download.layerId] = 
        (stats.byLayer[download.layerId] || 0) + 1;
    }
    
    // Agrupar por fecha
    for (const download of downloads) {
      const dateKey = download.timestamp.toISOString().split('T')[0];
      stats.byDate[dateKey] = (stats.byDate[dateKey] || 0) + 1;
    }
    
    return stats;
  }

  /**
   * Obtiene capas más descargadas
   */
  getTopLayers(limit = 5) {
    const layerCounts = Object.entries(this.downloadStats.byLayer)
      .map(([layerId, count]) => {
        const layer = this.availableLayers.find(l => l.id === layerId);
        return {
          layerId,
          name: layer?.name || layerId,
          downloads: count
        };
      })
      .sort((a, b) => b.downloads - a.downloads)
      .slice(0, limit);
    
    return layerCounts;
  }

  /**
   * Genera metadatos de descarga
   */
  generateDownloadMetadata(layerId, format, recordCount) {
    const layer = this.availableLayers.find(l => l.id === layerId);
    
    return {
      layerId,
      layerName: layer?.name || layerId,
      format,
      recordCount,
      generated: new Date().toISOString(),
      license: 'CC BY 4.0',
      attribution: 'EcoPlan Community',
      source: 'EcoPlan Citizen Science Platform',
      version: '1.0',
      description: layer?.description || 'Datos abiertos de EcoPlan',
      contact: 'https://github.com/Segesp/GEE'
    };
  }
}

module.exports = new DataExportService();
