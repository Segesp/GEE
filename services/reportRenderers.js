const escapeHtml = (value = '') => String(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

function formatNumber(value, options = {}) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '–';
  }
  try {
    return Number(value).toLocaleString('es-PE', {
      minimumFractionDigits: options.decimals ?? 2,
      maximumFractionDigits: options.decimals ?? 2
    });
  } catch (error) {
    return String(value);
  }
}

const indicatorMeta = [
  { key: 'vegetationHealth', label: 'NDVI medio', description: 'Índice de vigor de vegetación (Sentinel-2)', decimals: 3 },
  { key: 'surfaceTemperature', label: 'LST media (°C)', description: 'Temperatura superficial terrestre (Landsat 8/9)', decimals: 1 },
  { key: 'heatVulnerability', label: 'Índice de calor', description: 'Combinación LST + NDVI + densidad poblacional', decimals: 2 },
  { key: 'airQuality', label: 'Calidad del aire', description: 'Índice ponderado (AOD, NO₂, PM₂.₅)', decimals: 2 },
  { key: 'waterRisk', label: 'Riesgo hídrico', description: 'Impermeabilización + pendiente + NDWI', decimals: 2 },
  { key: 'greenPerCapita', label: 'Áreas verdes per cápita (m²/hab)', description: 'Superficie verde disponible por habitante', decimals: 1 },
  { key: 'greenDeficitRatio', label: 'Déficit de áreas verdes (%)', description: 'Población bajo los 9 m² recomendados', decimals: 1, transform: (value) => value != null ? value * 100 : value },
  { key: 'populationTotal', label: 'Población total (hab)', description: 'Censo GPWv4.11 filtrado al ROI', decimals: 0 },
  { key: 'greenAreaHa', label: 'Áreas verdes totales (ha)', description: 'Superficie verde estimada dentro del ROI', decimals: 1 }
];

function buildHighlightCards(indicators = {}) {
  const highlightKeys = [
    'vegetationHealth',
    'surfaceTemperature',
    'heatVulnerability',
    'greenPerCapita'
  ];

  const cards = highlightKeys
    .map((key) => indicatorMeta.find((meta) => meta.key === key))
    .filter(Boolean)
    .map((meta) => {
      const rawValue = indicators[meta.key];
      const value = typeof meta.transform === 'function' ? meta.transform(rawValue) : rawValue;
      return `
        <div class="highlight-card">
          <h3>${escapeHtml(meta.label)}</h3>
          <p class="highlight-value">${formatNumber(value, { decimals: meta.decimals })}</p>
          <p class="highlight-desc">${escapeHtml(meta.description)}</p>
        </div>
      `;
    });

  if (!cards.length) {
    return '';
  }

  return `<section class="highlights">${cards.join('\n')}</section>`;
}

function buildIndicatorRows(indicators = {}) {
  return indicatorMeta.map((meta) => {
    const rawValue = indicators[meta.key];
    const value = typeof meta.transform === 'function' ? meta.transform(rawValue) : rawValue;
    return `
      <tr>
        <th scope="row">${escapeHtml(meta.label)}</th>
        <td>${formatNumber(value, { decimals: meta.decimals })}</td>
        <td>${escapeHtml(meta.description)}</td>
      </tr>
    `;
  }).join('\n');
}

function buildRecommendationsList(recommendations = []) {
  if (!Array.isArray(recommendations) || !recommendations.length) {
    return '<p>No se encontraron recomendaciones específicas.</p>';
  }

  return `
    <ul>
      ${recommendations.map((item) => `<li>${escapeHtml(item)}</li>`).join('\n')}
    </ul>
  `;
}

function buildTimeSeriesSection(timeSeries = {}) {
  const entries = Object.entries(timeSeries)
    .filter(([, series]) => Array.isArray(series) && series.length)
    .map(([key, series]) => {
      const labelMap = {
        ndvi: 'NDVI',
        lst: 'LST (°C)',
        aod: 'AOD',
        no2: 'NO₂ (µmol·m⁻²)',
        pm25: 'PM₂.₅ (µg·m⁻³)'
      };
      const label = labelMap[key] || key.toUpperCase();
      const rows = series.slice(-12).map(({ date, value }) => `
        <tr>
          <td>${escapeHtml(date)}</td>
          <td>${formatNumber(value, { decimals: key === 'lst' ? 1 : 3 })}</td>
        </tr>
      `).join('\n');

      return `
        <section class="timeseries">
          <h3>${escapeHtml(label)}</h3>
          <table>
            <thead>
              <tr><th>Fecha</th><th>Valor</th></tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
          </table>
        </section>
      `;
    });

  if (!entries.length) {
    return '<p>No hay series temporales disponibles para el periodo solicitado.</p>';
  }

  return entries.join('\n');
}

function renderEcoPlanReportHtml(report) {
  if (!report || typeof report !== 'object') {
    throw new Error('Reporte inválido.');
  }

  const { generatedAt, request = {}, preset = {}, indicators = {}, recommendations = [], timeSeries = {}, boundaryStats = [] } = report;

  const boundaryTable = Array.isArray(boundaryStats) && boundaryStats.length
    ? `
      <table class="boundary">
        <thead>
          <tr>
            <th>Área</th>
            <th>NDVI</th>
            <th>LST (°C)</th>
            <th>Índice de calor</th>
            <th>Densidad (hab/km²)</th>
          </tr>
        </thead>
        <tbody>
          ${boundaryStats.slice(0, 15).map((item) => `
            <tr>
              <td>${escapeHtml(item.name || 'Área')}</td>
              <td>${formatNumber(item.ndviMean, { decimals: 3 })}</td>
              <td>${formatNumber(item.lstMean, { decimals: 1 })}</td>
              <td>${formatNumber(item.heatMean, { decimals: 2 })}</td>
              <td>${formatNumber(item.populationDensity, { decimals: 0 })}</td>
            </tr>
          `).join('\n')}
        </tbody>
      </table>
    `
    : '<p>No se generaron estadísticas por distrito. Añade un asset de límites en la solicitud.</p>';

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <title>Reporte EcoPlan Urbano – ${escapeHtml(preset.label || 'Zona urbana')}</title>
  <style>
    :root { color-scheme: light; }
    body { font-family: 'Inter', system-ui, sans-serif; margin: 0; padding: 32px; color: #0f172a; background: #f8fafc; }
    header { border-bottom: 2px solid #cbd5f5; margin-bottom: 28px; padding-bottom: 20px; display: flex; flex-direction: column; gap: 6px; }
    h1 { margin: 0; font-size: 2.1rem; color: #0f172a; }
    h2 { margin-top: 36px; font-size: 1.4rem; color: #1e40af; }
    h3 { margin-bottom: 12px; color: #1d4ed8; }
    table { border-collapse: collapse; width: 100%; margin: 18px 0; background: #fff; box-shadow: 0 4px 16px rgba(15, 23, 42, 0.08); border-radius: 12px; overflow: hidden; }
    th, td { border: 1px solid #e2e8f0; padding: 12px; text-align: left; font-size: 0.9rem; }
    th { background: #eff6ff; font-weight: 600; letter-spacing: 0.02em; }
    section.timeseries { page-break-inside: avoid; margin-bottom: 24px; }
    ul { padding-left: 20px; line-height: 1.45; }
    .metadata { font-size: 0.9rem; color: #475569; }
    .highlights { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin: 24px 0; }
    .highlight-card { background: linear-gradient(135deg, #e0f2fe, #f0f9ff); border-radius: 16px; padding: 18px; box-shadow: 0 6px 18px rgba(15, 23, 42, 0.12); }
    .highlight-card h3 { margin: 0 0 6px 0; font-size: 1rem; color: #1d4ed8; }
    .highlight-value { margin: 0; font-size: 1.8rem; font-weight: 700; color: #0f172a; }
    .highlight-desc { margin: 6px 0 0 0; font-size: 0.85rem; color: #475569; }
    .executive-summary { background: #fff; padding: 20px; border-radius: 16px; box-shadow: 0 6px 20px rgba(15, 23, 42, 0.1); }
    .executive-summary p { margin: 0 0 12px 0; line-height: 1.5; }
    footer { border-top: 1px solid #cbd5f5; margin-top: 32px; padding-top: 12px; }
    @page { margin: 25mm 20mm; }
    @media print {
      body { background: #fff; }
      .highlight-card { box-shadow: none; }
      table { box-shadow: none; }
    }
  </style>
</head>
<body>
  <header>
    <h1>Reporte EcoPlan Urbano</h1>
    <p class="metadata">Área: <strong>${escapeHtml(preset.label || request.preset || 'Preset no especificado')}</strong></p>
    <p class="metadata">Periodo: ${escapeHtml(request.start || 'Sin inicio')} – ${escapeHtml(request.end || 'Sin fin')}</p>
    <p class="metadata">Generado: ${escapeHtml(new Date(generatedAt || Date.now()).toLocaleString('es-PE'))}</p>
  </header>

  ${buildHighlightCards(indicators)}

  <section class="executive-summary">
    <h2>Resumen ejecutivo</h2>
    <p>El análisis integra índices de vegetación (NDVI), temperatura de superficie (LST), calidad del aire (AOD, NO₂, PM₂.₅) y acceso a espacios públicos para priorizar intervenciones urbanas basadas en evidencia.</p>
    ${recommendations.length ? `<p><strong>Recomendación prioritaria:</strong> ${escapeHtml(recommendations[0])}</p>` : ''}
    ${recommendations.length > 1 ? `<p><strong>Recomendación secundaria:</strong> ${escapeHtml(recommendations[1])}</p>` : ''}
  </section>

  <section>
    <h2>Indicadores clave</h2>
    <table>
      <thead>
        <tr>
          <th>Indicador</th>
          <th>Valor</th>
          <th>Descripción</th>
        </tr>
      </thead>
      <tbody>
        ${buildIndicatorRows(indicators)}
      </tbody>
    </table>
  </section>

  <section>
    <h2>Recomendaciones</h2>
    ${buildRecommendationsList(recommendations)}
  </section>

  <section>
    <h2>Series temporales (últimos 12 registros)</h2>
    ${buildTimeSeriesSection(timeSeries)}
  </section>

  <section>
    <h2>Indicadores por distrito</h2>
    ${boundaryTable}
  </section>

  <footer class="metadata">
    <p>EcoPlan Urbano – Automatizado con Google Earth Engine y la API EcoPlan GEE.</p>
  </footer>
</body>
</html>`;
}

module.exports = {
  renderEcoPlanReportHtml,
  indicatorMeta
};
