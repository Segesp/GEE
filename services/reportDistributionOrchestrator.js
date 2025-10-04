const fs = require('fs');
const path = require('path');

const {
  generateEcoPlanReport,
  renderEcoPlanReportHtml,
  renderEcoPlanReportCsv
} = require('./reportsService');
const { renderHtmlToPdfBuffer } = require('./pdfService');
const { uploadReportToGcs } = require('./reportDeliveryService');
const { sendEmailNotification, sendSlackNotification } = require('./reportNotificationsService');
const reportRunsRepository = require('./reportRunsRepository');

const DEFAULT_CONFIG_PATH = path.resolve(process.cwd(), process.env.REPORT_DISTRIBUTION_CONFIG || 'config/report-distribution.json');

function createLogger(logger) {
  if (!logger) {
    return console;
  }

  return {
    info: typeof logger.info === 'function' ? logger.info.bind(logger) : console.log.bind(console),
    warn: typeof logger.warn === 'function' ? logger.warn.bind(logger) : console.warn.bind(console),
    error: typeof logger.error === 'function' ? logger.error.bind(logger) : console.error.bind(console)
  };
}

function loadDistributionConfig(customPath = DEFAULT_CONFIG_PATH) {
  const resolvedPath = path.resolve(customPath);

  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`No se encontró el manifiesto de distribución en ${resolvedPath}`);
  }

  const fileContents = fs.readFileSync(resolvedPath, 'utf8');
  try {
    return JSON.parse(fileContents);
  } catch (error) {
    throw new Error(`Error al parsear ${resolvedPath}: ${error.message}`);
  }
}

function deepMerge(target = {}, source = {}) {
  const output = { ...target };
  Object.entries(source).forEach(([key, value]) => {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      output[key] = deepMerge(target[key] || {}, value);
    } else {
      output[key] = value;
    }
  });
  return output;
}

function asDateOnlyString(inputDate) {
  const date = new Date(inputDate);
  if (Number.isNaN(date.getTime())) {
    return inputDate;
  }
  return date.toISOString().slice(0, 10);
}

function resolveDateToken(token, now = new Date()) {
  if (!token || typeof token !== 'string') {
    return token;
  }

  const trimmed = token.trim().toLowerCase();
  if (trimmed === 'today') {
    return asDateOnlyString(now);
  }

  const rollingMatch = trimmed.match(/^rolling:-?(\d+)([dwmy])$/);
  if (rollingMatch) {
    const [, amountRaw, unit] = rollingMatch;
    const amount = Number(amountRaw);
    const baseDate = new Date(now);

    switch (unit) {
      case 'd':
        baseDate.setDate(baseDate.getDate() - amount);
        break;
      case 'w':
        baseDate.setDate(baseDate.getDate() - amount * 7);
        break;
      case 'm':
        baseDate.setMonth(baseDate.getMonth() - amount);
        break;
      case 'y':
        baseDate.setFullYear(baseDate.getFullYear() - amount);
        break;
      default:
        break;
    }

    return asDateOnlyString(baseDate);
  }

  return token;
}

function resolvePayload(payload = {}, { now = new Date() } = {}) {
  const resolved = { ...payload };

  if (payload.start) {
    resolved.start = resolveDateToken(payload.start, now);
  }

  if (payload.end) {
    resolved.end = resolveDateToken(payload.end, now);
  }

  return resolved;
}

function sanitizeFilenameSegment(value = '') {
  return value
    .toString()
    .toLowerCase()
    .replace(/[^a-z0-9-_]/gi, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^_+|_+$/g, '') || 'ecoplan';
}

async function renderReportVariant({ report, format }) {
  if (format === 'csv') {
    const csv = renderEcoPlanReportCsv(report);
    return {
      buffer: Buffer.from(csv, 'utf8'),
      contentType: 'text/csv; charset=utf-8',
      extension: 'csv',
      body: csv
    };
  }

  if (format === 'html') {
    const html = renderEcoPlanReportHtml(report);
    return {
      buffer: Buffer.from(html, 'utf8'),
      contentType: 'text/html; charset=utf-8',
      extension: 'html',
      body: html
    };
  }

  if (format === 'pdf') {
    const html = renderEcoPlanReportHtml(report);
    const pdfBuffer = await renderHtmlToPdfBuffer(html, {
      format: 'A4',
      printBackground: true
    });
    return {
      buffer: pdfBuffer,
      contentType: 'application/pdf',
      extension: 'pdf',
      body: pdfBuffer
    };
  }

  const jsonString = JSON.stringify(report, null, 2);
  return {
    buffer: Buffer.from(jsonString, 'utf8'),
    contentType: 'application/json; charset=utf-8',
    extension: 'json',
    body: report
  };
}

function resolveGcsConfig(jobDelivery = {}, defaultDelivery = {}) {
  const merged = deepMerge(defaultDelivery || {}, jobDelivery || {});
  if (!merged.gcs) {
    return null;
  }

  const bucketEnvKey = merged.gcs.bucketEnv || null;
  const bucketFromEnv = bucketEnvKey ? process.env[bucketEnvKey] : null;
  const bucket = merged.gcs.bucket || bucketFromEnv || process.env.REPORTS_GCS_BUCKET;

  return {
    ...merged.gcs,
    bucket
  };
}

function mergeUniqueStrings(...lists) {
  const combined = [];
  lists.forEach((list) => {
    if (!list) return;
    if (typeof list === 'string') {
      combined.push(...list.split(',').map((item) => item.trim()).filter(Boolean));
    } else if (Array.isArray(list)) {
      combined.push(...list.map((item) => (typeof item === 'string' ? item.trim() : null)).filter(Boolean));
    }
  });
  return [...new Set(combined)];
}

function resolveNotificationsConfig(jobNotifications = {}, defaultNotifications = {}) {
  const merged = deepMerge(defaultNotifications || {}, jobNotifications || {});

  const emailEnabled = merged.email?.enabled;
  const slackEnabled = merged.slack?.enabled;

  if (!emailEnabled && !slackEnabled) {
    return null;
  }

  const emailConfig = emailEnabled ? {
    ...merged.email,
    recipients: mergeUniqueStrings(
      defaultNotifications?.email?.recipients,
      jobNotifications?.email?.recipients,
      merged.email?.recipients
    ),
    cc: mergeUniqueStrings(
      defaultNotifications?.email?.cc,
      jobNotifications?.email?.cc,
      merged.email?.cc
    ),
    bcc: mergeUniqueStrings(
      defaultNotifications?.email?.bcc,
      jobNotifications?.email?.bcc,
      merged.email?.bcc
    ),
    from: merged.email?.from
      || (merged.email?.fromEnv && process.env[merged.email.fromEnv])
      || process.env.REPORTS_EMAIL_FROM,
    fromName: merged.email?.fromName
      || process.env.REPORTS_EMAIL_NAME,
    apiKey: merged.email?.apiKey
      || (merged.email?.apiKeyEnv && process.env[merged.email.apiKeyEnv])
      || process.env.SENDGRID_API_KEY,
    timezone: merged.email?.timezone
      || merged.timezone
      || defaultNotifications?.timezone
      || process.env.REPORTS_DISTRIBUTION_TZ
  } : null;

  const slackWebhook = slackEnabled
    ? jobNotifications?.slack?.webhookUrl
      || (jobNotifications?.slack?.webhookEnv && process.env[jobNotifications.slack.webhookEnv])
      || merged.slack?.webhookUrl
      || (merged.slack?.webhookEnv && process.env[merged.slack.webhookEnv])
      || defaultNotifications?.slack?.webhookUrl
      || (defaultNotifications?.slack?.webhookEnv && process.env[defaultNotifications.slack.webhookEnv])
      || process.env.REPORTS_SLACK_WEBHOOK
    : null;

  const slackConfig = slackEnabled ? {
    ...merged.slack,
    webhookUrl: slackWebhook
  } : null;

  return {
    email: emailConfig,
    slack: slackConfig,
    timezone: merged.timezone
      || defaultNotifications?.timezone
      || process.env.REPORTS_DISTRIBUTION_TZ
  };
}

function formatNumber(value) {
  if (value === null || value === undefined) {
    return '—';
  }
  if (typeof value !== 'number') {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      return String(value);
    }
    return parsed.toFixed(2);
  }
  return value.toFixed(2);
}

function formatDateTime(value, timezone) {
  if (!value) {
    return 'N/D';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }
  try {
    return date.toLocaleString('es-PE', {
      timeZone: timezone || 'UTC',
      dateStyle: 'medium',
      timeStyle: 'short'
    });
  } catch (error) {
    return date.toISOString();
  }
}

function buildNotificationContext({ jobId, presetId, report, resolvedPayload, results, status, trigger }) {
  const presetName = report?.preset?.label || presetId;
  const recommendations = Array.isArray(report?.recommendations)
    ? report.recommendations.slice(0, 3)
    : [];
  const indicators = report?.indicators || {};

  return {
    jobId,
    presetId,
    presetName,
    generatedAt: report?.generatedAt,
    request: resolvedPayload,
    recommendations,
    indicators,
    results,
    status,
    trigger
  };
}

function buildEmailContent(context, notificationsConfig = {}) {
  const timezone = notificationsConfig.email?.timezone || notificationsConfig.timezone;
  const generatedLabel = formatDateTime(context.generatedAt, timezone);

  const resultItemsHtml = context.results.map((entry) => {
    const statusLabel = entry.status === 'success'
      ? (entry.gcs?.publicUrl
        ? `<a href="${entry.gcs.publicUrl}">Descargar</a>`
        : 'Generado localmente')
      : `Error: ${entry.error || 'sin detalle'}`;
    return `<li><strong>${entry.format.toUpperCase()}</strong>: ${statusLabel}</li>`;
  }).join('\n');

  const resultItemsText = context.results.map((entry) => {
    const statusLabel = entry.status === 'success'
      ? (entry.gcs?.publicUrl || 'Generado localmente')
      : `Error: ${entry.error || 'sin detalle'}`;
    return `• ${entry.format.toUpperCase()}: ${statusLabel}`;
  }).join('\n');

  const indicatorRowsHtml = Object.entries({
    vegetationHealth: 'Salud de vegetación (NDVI)',
    surfaceTemperature: 'Temperatura superficial (°C)',
    heatVulnerability: 'Vulnerabilidad al calor',
    airQuality: 'Calidad del aire',
    waterRisk: 'Riesgo hídrico',
    greenPerCapita: 'Áreas verdes per cápita (m²)',
    greenDeficitRatio: 'Déficit de áreas verdes'
  }).map(([key, label]) => {
    if (context.indicators[key] === undefined || context.indicators[key] === null) {
      return null;
    }
    return `<tr><td>${label}</td><td style="text-align:right;">${formatNumber(context.indicators[key])}</td></tr>`;
  }).filter(Boolean).join('\n');

  const recommendationsHtml = context.recommendations.length
    ? `<ul>${context.recommendations.map((rec) => `<li>${rec}</li>`).join('')}</ul>`
    : '<p>No se registraron recomendaciones destacadas.</p>';

  const recommendationsText = context.recommendations.length
    ? context.recommendations.map((rec) => `• ${rec}`).join('\n')
    : 'No se registraron recomendaciones destacadas.';

  const html = `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <title>Reporte ${context.jobId}</title>
    <style>
      body { font-family: 'Segoe UI', Roboto, sans-serif; color: #1f2937; }
      h1, h2 { color: #0f172a; }
      table { width: 100%; border-collapse: collapse; margin-top: 8px; }
      th, td { padding: 6px 8px; border-bottom: 1px solid #e2e8f0; }
      th { text-align: left; background: #f1f5f9; }
      ul { padding-left: 18px; }
    </style>
  </head>
  <body>
    <h1>EcoPlan · ${context.presetName}</h1>
    <p><strong>Job:</strong> ${context.jobId} (${context.status.toUpperCase()})</p>
    <p><strong>Generado:</strong> ${generatedLabel}</p>
    <p><strong>Disparador:</strong> ${context.trigger}</p>

    <h2>Resultados</h2>
    <ul>${resultItemsHtml}</ul>

    <h2>Indicadores clave</h2>
    ${indicatorRowsHtml ? `<table><tbody>${indicatorRowsHtml}</tbody></table>` : '<p>No hubo indicadores disponibles.</p>'}

    <h2>Recomendaciones destacadas</h2>
    ${recommendationsHtml}
  </body>
</html>`;

  const text = [`EcoPlan · ${context.presetName}`,
    `Job: ${context.jobId} (${context.status.toUpperCase()})`,
    `Generado: ${generatedLabel}`,
    `Disparador: ${context.trigger}`,
    '',
    'Resultados:',
    resultItemsText,
    '',
    'Indicadores clave:',
    Object.entries({
      vegetationHealth: 'Salud de vegetación (NDVI)',
      surfaceTemperature: 'Temperatura superficial (°C)',
      heatVulnerability: 'Vulnerabilidad al calor',
      airQuality: 'Calidad del aire',
      waterRisk: 'Riesgo hídrico',
      greenPerCapita: 'Áreas verdes per cápita (m²)',
      greenDeficitRatio: 'Déficit de áreas verdes'
    }).map(([key, label]) => {
      if (context.indicators[key] === undefined || context.indicators[key] === null) {
        return null;
      }
      return `• ${label}: ${formatNumber(context.indicators[key])}`;
    }).filter(Boolean).join('\n'),
    '',
    'Recomendaciones:',
    recommendationsText
  ].filter(Boolean).join('\n');

  return { html, text };
}

function buildSlackPayload(context, notificationsConfig = {}) {
  const timezone = notificationsConfig.slack?.timezone || notificationsConfig.timezone;
  const generatedLabel = formatDateTime(context.generatedAt, timezone);

  const resultsText = context.results.map((entry) => {
    const statusLabel = entry.status === 'success'
      ? (entry.gcs?.publicUrl || 'Generado localmente')
      : `Error: ${entry.error || 'sin detalle'}`;
    return `• ${entry.format.toUpperCase()}: ${statusLabel}`;
  }).join('\n');

  const recommendationsText = context.recommendations.length
    ? context.recommendations.map((rec) => `• ${rec}`).join('\n')
    : 'No se registraron recomendaciones destacadas.';

  const text = `EcoPlan · ${context.presetName}\n` +
    `Job: ${context.jobId} (${context.status.toUpperCase()})\n` +
    `Generado: ${generatedLabel}\n` +
    `Disparador: ${context.trigger}\n\n` +
    `Resultados:\n${resultsText}\n\n` +
    `Recomendaciones:\n${recommendationsText}`;

  if (notificationsConfig.slack?.channel) {
    return {
      text,
      channel: notificationsConfig.slack.channel
    };
  }

  return { text };
}

async function dispatchNotificationsForJob({
  notificationsConfig,
  context,
  logger
}) {
  if (!notificationsConfig) {
    return null;
  }

  const results = {};

  if (notificationsConfig.email?.enabled) {
    const subject = notificationsConfig.email.subject
      || `${process.env.REPORTS_EMAIL_SUBJECT_PREFIX || 'EcoPlan'} · ${context.presetName} · ${formatDateTime(context.generatedAt, notificationsConfig.email.timezone || notificationsConfig.timezone)}`;
    const emailContent = buildEmailContent(context, notificationsConfig);

    results.email = await sendEmailNotification({
      subject,
      html: emailContent.html,
      text: emailContent.text,
      recipients: notificationsConfig.email.recipients,
      cc: notificationsConfig.email.cc,
      bcc: notificationsConfig.email.bcc,
      from: notificationsConfig.email.from,
      fromName: notificationsConfig.email.fromName,
      apiKey: notificationsConfig.email.apiKey,
      logger
    });
  }

  if (notificationsConfig.slack?.enabled) {
    const slackPayload = buildSlackPayload(context, notificationsConfig);
    results.slack = await sendSlackNotification({
      webhookUrl: notificationsConfig.slack.webhookUrl,
      payload: slackPayload,
      logger
    });
  }

  return results;
}

async function uploadIfNeeded({
  gcsConfig,
  buffer,
  contentType,
  filename,
  format,
  presetId,
  generatedAt
}) {
  if (!gcsConfig || !gcsConfig.bucket) {
    return null;
  }

  return uploadReportToGcs({
    content: buffer,
    contentType,
    bucketName: gcsConfig.bucket,
    destination: gcsConfig.path,
    prefix: gcsConfig.prefix,
    metadata: {
      filename,
      format,
      preset: presetId
    },
    presetId,
    format,
    generatedAt
  });
}

async function executeJob(jobConfig, manifestDefaults = {}, { logger, now = new Date(), trigger = 'manual' } = {}) {
  const log = createLogger(logger);
  const startedAtDate = new Date();
  const startedAt = startedAtDate.toISOString();

  const formats = Array.isArray(jobConfig.formats) && jobConfig.formats.length
    ? jobConfig.formats
    : (manifestDefaults.formats || ['json']);

  const effectivePayload = deepMerge(manifestDefaults.payload || {}, jobConfig.payload || {});
  const resolvedPayload = resolvePayload({ ...effectivePayload }, { now });
  delete resolvedPayload.format; // formato se maneja por ciclo de variantes

  const jobId = jobConfig.id || `job-${Math.random().toString(36).slice(2, 8)}`;
  const presetId = resolvedPayload.preset || manifestDefaults.preset || 'ecoplan';

  log.info(`[distribution] Ejecutando job ${jobId} con preset ${presetId}`);

  let runRecord = null;
  try {
    runRecord = await reportRunsRepository.createRun({
      jobId,
      presetId,
      presetName: jobConfig.presetName || jobConfig.description || null,
      trigger,
      request: resolvedPayload,
      startedAt,
      status: 'running',
      logger: log
    });
  } catch (error) {
    log.warn(`[distribution] Job ${jobId} - no se pudo registrar el inicio: ${error.message}`);
  }

  let report = null;
  const results = [];
  let notifications = null;
  let status = 'success';
  let errorInfo = null;

  const notificationsConfig = resolveNotificationsConfig(jobConfig.notifications, manifestDefaults.notifications);

  try {
    report = await generateEcoPlanReport(resolvedPayload);

    if (runRecord?.id && report?.preset?.label) {
      await reportRunsRepository.updateRun(runRecord.id, {
        presetName: report.preset.label,
        presetId: report.preset.id || presetId,
        generatedAt: report.generatedAt,
        metrics: report.indicators || null
      }, log);
    }

    const baseFilename = `ecoplan-${sanitizeFilenameSegment(presetId)}-${asDateOnlyString(report.generatedAt || now)}`;

    for (const format of formats) {
      try {
        const variant = await renderReportVariant({ report, format });
        const filename = `${baseFilename}.${variant.extension}`;
        const gcsConfig = resolveGcsConfig(jobConfig.delivery, manifestDefaults.delivery);
        const uploadResult = await uploadIfNeeded({
          gcsConfig,
          buffer: variant.buffer,
          contentType: variant.contentType,
          filename,
          format,
          presetId,
          generatedAt: report.generatedAt || now
        });

        results.push({
          format,
          filename,
          gcs: uploadResult,
          bytes: variant.buffer.length,
          status: 'success'
        });

        log.info(`[distribution] Job ${jobId} - formato ${format} generado${uploadResult ? ` y subido a ${uploadResult.gsUri}` : ''}`);
      } catch (formatError) {
        log.error(`[distribution] Job ${jobId} - error en formato ${format}: ${formatError.message}`);
        results.push({
          format,
          status: 'error',
          error: formatError.message
        });
      }
    }

    const hasErrors = results.some((entry) => entry.status !== 'success');
    status = hasErrors ? 'partial' : 'success';

    if (notificationsConfig && (notificationsConfig.email?.enabled || notificationsConfig.slack?.enabled)) {
      const context = buildNotificationContext({
        jobId,
        presetId,
        report,
        resolvedPayload,
        results,
        status,
        trigger
      });

      try {
        notifications = await dispatchNotificationsForJob({
          notificationsConfig,
          context,
          logger: log
        });
      } catch (notificationError) {
        log.error(`[distribution] Job ${jobId} - notificaciones fallaron: ${notificationError.message}`);
        notifications = {
          status: 'error',
          error: notificationError.message
        };
      }
    }
  } catch (error) {
    status = 'error';
    errorInfo = {
      message: error.message,
      stack: error.stack
    };
    log.error(`[distribution] Job ${jobId} - ejecución falló: ${error.message}`);
    throw error;
  } finally {
    if (runRecord?.id) {
      const completedAtDate = new Date();
      const delivery = results
        .filter((entry) => entry.gcs)
        .map((entry) => ({
          format: entry.format,
          bucket: entry.gcs.bucket,
          path: entry.gcs.path,
          publicUrl: entry.gcs.publicUrl,
          gsUri: entry.gcs.gsUri
        }));

      await reportRunsRepository.completeRun(runRecord.id, {
        status,
        completedAt: completedAtDate.toISOString(),
        durationMs: completedAtDate.getTime() - startedAtDate.getTime(),
        generatedAt: report?.generatedAt,
        results,
        notifications,
        metrics: report?.indicators || null,
        delivery: delivery.length ? { gcs: delivery } : null,
        error: errorInfo
      }, log);
    }
  }

  return {
    jobId,
    presetId,
    generatedAt: report?.generatedAt,
    status,
    results,
    notifications
  };
}

async function executeAllJobs(manifest, { logger, now = new Date(), trigger = 'manual' } = {}) {
  const log = createLogger(logger);
  const { defaults = {}, jobs = [] } = manifest || {};

  if (!Array.isArray(jobs) || !jobs.length) {
    log.warn('[distribution] No hay jobs configurados en el manifiesto');
    return [];
  }

  const executions = [];
  for (const jobConfig of jobs) {
    try {
  const execution = await executeJob(jobConfig, defaults, { logger, now, trigger });
      executions.push(execution);
    } catch (error) {
      const jobId = jobConfig.id || 'sin-id';
      log.error(`[distribution] Error ejecutando job ${jobId}: ${error.message}`);
      executions.push({
        jobId,
        status: 'error',
        error: error.message
      });
    }
  }

  return executions;
}

module.exports = {
  DEFAULT_CONFIG_PATH,
  loadDistributionConfig,
  executeJob,
  executeAllJobs,
  resolvePayload,
  resolveDateToken
};
