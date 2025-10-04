const { indicatorMeta } = require('./reportRenderers');

function escapeCsv(value) {
  if (value === null || value === undefined) {
    return '';
  }

  const stringValue = String(value);
  if (stringValue.length === 0) {
    return '';
  }

  const needsQuotes = /[",\n\r]/.test(stringValue) || stringValue.startsWith(' ') || stringValue.endsWith(' ');
  const escaped = stringValue.replace(/"/g, '""');
  return needsQuotes ? `"${escaped}"` : escaped;
}

function csvRow(columns = []) {
  return columns.map(escapeCsv).join(',');
}

function formatNumber(value, decimals = 2) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return '';
  }
  return Number(value).toFixed(decimals);
}

function transformIndicatorValue(meta, indicators = {}) {
  const rawValue = indicators[meta.key];
  const value = typeof meta.transform === 'function' ? meta.transform(rawValue) : rawValue;
  return formatNumber(value, meta.decimals ?? 2);
}

function buildIndicatorsSection(report) {
  const lines = [];
  lines.push('Indicadores clave');
  lines.push(csvRow(['Indicador', 'Valor', 'Descripción']));

  indicatorMeta.forEach((meta) => {
    lines.push(csvRow([
      meta.label,
      transformIndicatorValue(meta, report.indicators),
      meta.description
    ]));
  });

  return lines;
}

function buildTimeSeriesSection(report) {
  const labelMap = {
    ndvi: 'NDVI',
    lst: 'LST (°C)',
    aod: 'AOD',
    no2: 'NO₂ (µmol·m⁻²)',
    pm25: 'PM₂.₅ (µg·m⁻³)'
  };

  const lines = [];
  lines.push('Series temporales');
  lines.push(csvRow(['Serie', 'Fecha', 'Valor']));

  const timeSeries = report.timeSeries || {};
  Object.entries(timeSeries).forEach(([key, series]) => {
    if (!Array.isArray(series) || !series.length) {
      return;
    }

    series.forEach(({ date, value }) => {
      const decimals = key === 'lst' ? 1 : 3;
      lines.push(csvRow([
        labelMap[key] || key.toUpperCase(),
        date,
        formatNumber(value, decimals)
      ]));
    });
  });

  if (lines.length === 2) {
    // Solo encabezados (sin datos)
    lines.push(csvRow(['(sin datos)', '', '']));
  }

  return lines;
}

function buildBoundarySection(report) {
  const lines = [];
  lines.push('Indicadores por distrito');
  lines.push(csvRow(['Área', 'NDVI medio', 'LST media (°C)', 'Índice de calor', 'Densidad (hab/km²)']));

  const stats = Array.isArray(report.boundaryStats) ? report.boundaryStats : [];
  if (!stats.length) {
    lines.push(csvRow(['(sin estadísticas)', '', '', '', '']));
    return lines;
  }

  stats.forEach((item) => {
    lines.push(csvRow([
      item.name || 'Área',
      formatNumber(item.ndviMean, 3),
      formatNumber(item.lstMean, 1),
      formatNumber(item.heatMean, 2),
      formatNumber(item.populationDensity, 0)
    ]));
  });

  return lines;
}

function buildMetadataSection(report) {
  const lines = [];
  lines.push('Metadatos');
  lines.push(csvRow(['Campo', 'Valor']));

  const areaLabel = report?.preset?.label || report?.request?.preset || 'Sin etiqueta';
  const presetId = report?.preset?.id || report?.request?.preset || 'desconocido';
  const areaType = report?.preset?.type || 'desconocido';
  const start = report?.request?.start || 'no definido';
  const end = report?.request?.end || 'no definido';
  const generatedAt = report?.generatedAt || new Date().toISOString();

  lines.push(csvRow(['Área analizada', areaLabel]));
  lines.push(csvRow(['Preset', presetId]));
  lines.push(csvRow(['Tipo de área', areaType]));
  lines.push(csvRow(['Periodo de análisis', `${start} – ${end}`]));
  lines.push(csvRow(['Generado en', generatedAt]));

  const recommendationPrincipal = Array.isArray(report.recommendations) && report.recommendations.length
    ? report.recommendations[0]
    : 'No se generaron recomendaciones';

  lines.push(csvRow(['Recomendación prioritaria', recommendationPrincipal]));

  return lines;
}

function renderEcoPlanReportCsv(report) {
  if (!report || typeof report !== 'object') {
    throw new Error('Reporte inválido para exportar CSV.');
  }

  const sections = [
    buildMetadataSection(report),
    [''],
    buildIndicatorsSection(report),
    [''],
    buildTimeSeriesSection(report),
    [''],
    buildBoundarySection(report)
  ];

  const flattenedLines = sections.flat();
  return `${flattenedLines.join('\n')}\n`;
}

module.exports = {
  renderEcoPlanReportCsv
};
