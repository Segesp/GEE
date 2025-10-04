function getNumber(value) {
  if (value === null || value === undefined) return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function toTimeSeries(features = [], property) {
  if (!Array.isArray(features)) return [];
  return features
    .map((feature) => {
      const date = feature?.properties?.date;
      const value = getNumber(feature?.properties?.[property] ?? feature?.properties?.value);
      if (!date || value === null) {
        return null;
      }
      return { date, value };
    })
    .filter(Boolean)
    .sort((a, b) => a.date.localeCompare(b.date));
}

function deriveIndicators(summary = {}) {
  const ndviMean = getNumber(summary.ndvi_mean);
  const lstMean = getNumber(summary.lst_mean);
  const heatMean = getNumber(summary.heat_mean);
  const airQualityMean = getNumber(summary.air_quality_mean);
  const waterRiskMean = getNumber(summary.water_risk_mean);
  const greenPerCapita = getNumber(summary.green_per_capita_mean);
  const greenDeficitRatio = getNumber(summary.green_deficit_ratio);
  const populationTotal = getNumber(summary.population_total);
  const greenAreaTotal = getNumber(summary.green_area_m2);

  return {
    vegetationHealth: ndviMean,
    surfaceTemperature: lstMean,
    heatVulnerability: heatMean,
    airQuality: airQualityMean,
    waterRisk: waterRiskMean,
    greenPerCapita,
    greenDeficitRatio,
    populationTotal,
    greenAreaHa: greenAreaTotal === null ? null : greenAreaTotal / 10000
  };
}

function buildNarrative(indicators) {
  const messages = [];

  if (indicators.heatVulnerability !== null) {
    if (indicators.heatVulnerability > 0.4) {
      messages.push('Alta vulnerabilidad al calor: priorizar infraestructura verde y refugios climáticos.');
    } else if (indicators.heatVulnerability > 0.2) {
      messages.push('Vulnerabilidad moderada al calor: monitorear zonas críticas y reforzar campañas de alerta.');
    } else {
      messages.push('Vulnerabilidad al calor controlada: mantener monitoreo y programas de mitigación.');
    }
  }

  if (indicators.airQuality !== null) {
    if (indicators.airQuality > 0.6) {
      messages.push('Calidad del aire deficiente: recomendar restricciones vehiculares o planes de movilidad sostenible.');
    } else if (indicators.airQuality > 0.4) {
      messages.push('Calidad del aire aceptable pero frágil: reforzar monitoreo de NO₂ y PM₂.₅.');
    } else {
      messages.push('Calidad del aire adecuada en el periodo analizado.');
    }
  }

  if (indicators.greenPerCapita !== null) {
    if (indicators.greenPerCapita < 9) {
      messages.push('Déficit de áreas verdes por habitante: impulsar proyectos de revegetación y parques de bolsillo.');
    } else {
      messages.push('Meta de áreas verdes por habitante alcanzada o superada.');
    }
  }

  if (indicators.waterRisk !== null) {
    if (indicators.waterRisk > 0.6) {
      messages.push('Riesgo hídrico elevado: integrar infraestructura de drenaje sostenible y captación pluvial.');
    } else if (indicators.waterRisk > 0.4) {
      messages.push('Riesgo hídrico moderado: revisar planes de drenaje en distritos prioritarios.');
    } else {
      messages.push('Riesgo hídrico controlado: mantener mantenimiento preventivo.');
    }
  }

  if (!messages.length) {
    messages.push('No se generaron recomendaciones específicas; revise parámetros del análisis.');
  }

  return messages;
}

function formatBoundaryStats(boundaryFeatures = []) {
  if (!Array.isArray(boundaryFeatures)) {
    return [];
  }

  return boundaryFeatures.map((feature) => {
    const props = feature?.properties || {};
    return {
      name: props.NOMBRE || props.NOM_DIST || props.distrito || props.DISTRICT || props.NAME || 'Área',
      ndviMean: getNumber(props.NDVI_mean),
      lstMean: getNumber(props.LST_C_mean),
      heatMean: getNumber(props.HeatVulnerability_mean),
      populationDensity: getNumber(props.population_density_mean)
    };
  });
}

const { renderEcoPlanReportHtml } = require('./reportRenderers');
const { renderEcoPlanReportCsv } = require('./reportCsvService');

let dependencies = {
  buildEcoPlanAnalysis: null,
  evaluateEeObject: null
};

function configureReportsService({ buildEcoPlanAnalysis, evaluateEeObject }) {
  dependencies = {
    buildEcoPlanAnalysis,
    evaluateEeObject
  };
}

async function generateEcoPlanReport(options = {}) {
  const { buildEcoPlanAnalysis, evaluateEeObject } = dependencies;
  if (typeof buildEcoPlanAnalysis !== 'function' || typeof evaluateEeObject !== 'function') {
    throw new Error('Reports service not configured: buildEcoPlanAnalysis or evaluateEeObject missing');
  }

  const analysis = await buildEcoPlanAnalysis(options);

  const [
    summary,
    ndviSeries,
    lstSeries,
    aodSeries,
    no2Series,
    pm25Series,
    boundaryStats
  ] = await Promise.all([
    evaluateEeObject(analysis.summary),
    evaluateEeObject(analysis.ndviSeries),
    evaluateEeObject(analysis.lstSeries),
    evaluateEeObject(analysis.aodSeries),
    analysis.no2Series ? evaluateEeObject(analysis.no2Series) : Promise.resolve(null),
    analysis.pm25Series ? evaluateEeObject(analysis.pm25Series) : Promise.resolve(null),
    analysis.boundaryStats ? evaluateEeObject(analysis.boundaryStats) : Promise.resolve(null)
  ]);

  const indicators = deriveIndicators(summary || {});
  const recommendations = buildNarrative({
    heatVulnerability: indicators.heatVulnerability,
    airQuality: indicators.airQuality,
    greenPerCapita: indicators.greenPerCapita,
    waterRisk: indicators.waterRisk,
    greenDeficitRatio: indicators.greenDeficitRatio
  });

  const timeSeries = {
    ndvi: toTimeSeries(ndviSeries?.features, 'ndvi'),
    lst: toTimeSeries(lstSeries?.features, 'lst_c'),
    aod: toTimeSeries(aodSeries?.features, 'aod'),
    no2: toTimeSeries(no2Series?.features, 'no2'),
    pm25: toTimeSeries(pm25Series?.features, 'pm25')
  };

  const report = {
    generatedAt: new Date().toISOString(),
    request: options,
    preset: analysis.meta,
    indicators,
    summary,
    timeSeries,
    boundaryStats: formatBoundaryStats(boundaryStats?.features).slice(0, 25),
    recommendations
  };

  return report;
}

module.exports = {
  configureReportsService,
  generateEcoPlanReport,
  renderEcoPlanReportHtml,
  renderEcoPlanReportCsv
};
