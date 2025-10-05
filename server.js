const express = require('express');
const ee = require('@google/earthengine');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const cron = require('node-cron');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./config/swagger');
const { configureReportsService, generateEcoPlanReport, renderEcoPlanReportHtml, renderEcoPlanReportCsv } = require('./services/reportsService');
const { uploadReportToGcs } = require('./services/reportDeliveryService');
const { renderHtmlToPdfBuffer } = require('./services/pdfService');
const {
  loadDistributionConfig,
  executeJob: runDistributionJobInternal,
  DEFAULT_CONFIG_PATH: DISTRIBUTION_CONFIG_PATH
} = require('./services/reportDistributionOrchestrator');
const reportRunsRepository = require('./services/reportRunsRepository');
const citizenReportsRepository = require('./services/citizenReportsRepository');
const reportValidationService = require('./services/reportValidationService');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

const DISTRIBUTION_ENABLED = process.env.REPORTS_DISTRIBUTION_ENABLED !== 'false';
const DISTRIBUTION_TOKEN = process.env.REPORTS_DISTRIBUTION_TOKEN || null;

let distributionManifestCache = null;
let distributionManifestLoadedAt = null;
let distributionManifestLastError = null;
let distributionWatcher = null;
const scheduledDistributionTasks = new Map();

const distributionBaseLogger = {
  info: (...args) => console.log('[distribution]', ...args),
  warn: (...args) => console.warn('[distribution]', ...args),
  error: (...args) => console.error('[distribution]', ...args)
};

const DEFAULT_EE_SCOPES = [
  'https://www.googleapis.com/auth/earthengine',
  'https://www.googleapis.com/auth/devstorage.full_control'
];

const CITIZEN_REPORT_CATEGORIES = new Set([
  'heat',
  'green',
  'flooding',
  'waste',
  'air',
  'water',
  'other'
]);
const MAX_CITIZEN_REPORT_DESCRIPTION_LENGTH = 2000;


// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// ============================================================================
// SWAGGER API DOCUMENTATION (Fase 10)
// ============================================================================
/**
 * @swagger
 * /:
 *   get:
 *     summary: Página principal de EcoPlan
 *     tags: [Frontend]
 *     responses:
 *       200:
 *         description: Aplicación web principal
 */
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'EcoPlan API Documentation',
  customfavIcon: '/favicon.ico'
}));

// Endpoint para obtener el spec en JSON (útil para herramientas)
app.get('/api-docs.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});

console.log('📚 Swagger API Documentation habilitada en /api-docs');
// ============================================================================

// Earth Engine authentication and initialization
let eeInitialized = false;

function getConfiguredScopes() {
  const extraScopes = process.env.GOOGLE_EE_SCOPES;
  if (!extraScopes) {
    return DEFAULT_EE_SCOPES;
  }

  return extraScopes.split(',')
    .map((scope) => scope.trim())
    .filter(Boolean);
}

async function authenticateWithServiceAccount(serviceAccount, scopes) {
  return new Promise((resolve, reject) => {
    ee.data.authenticateViaPrivateKey(
      serviceAccount,
      () => {
        console.log(`Service account authenticated (${serviceAccount.client_email})`);
        resolve();
      },
      (error) => {
        console.error('Failed to authenticate Earth Engine service account:', error);
        reject(error);
      },
      scopes
    );
  });
}

async function initializeEarthEngine() {
  const fs = require('fs');

  try {
    const serviceAccountPath = process.env.GOOGLE_SERVICE_ACCOUNT_PATH || './service-account.json';
    const serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    const configuredProject = process.env.GOOGLE_EE_PROJECT || process.env.EE_PROJECT_ID;

    let serviceAccount;

    if (serviceAccountJson) {
      try {
        serviceAccount = JSON.parse(serviceAccountJson);
        console.log('Using service account credentials from environment variable.');
      } catch (parseError) {
        console.error('Failed to parse GOOGLE_SERVICE_ACCOUNT_JSON environment variable.');
        throw parseError;
      }
    } else {
      const resolvedPath = path.resolve(serviceAccountPath);

      if (!fs.existsSync(resolvedPath)) {
        console.warn('Service account JSON file not found. Please add your service account credentials.');
        console.warn('Copy your service account JSON file to:', serviceAccountPath);
        console.warn('Alternatively, set GOOGLE_SERVICE_ACCOUNT_JSON with the raw JSON string.');
        return false;
      }

      const fileContents = fs.readFileSync(resolvedPath, 'utf8');
      serviceAccount = JSON.parse(fileContents);
    }

    const projectId = configuredProject || serviceAccount.project_id || null;
    const scopes = getConfiguredScopes();

    await authenticateWithServiceAccount(serviceAccount, scopes);

    await new Promise((resolve, reject) => {
      ee.initialize(
        null,
        null,
        () => {
          eeInitialized = true;
          app.locals.eeProjectId = projectId;
          const projectSuffix = projectId ? ` (project: ${projectId})` : '';
          console.log(`Earth Engine initialized successfully${projectSuffix}`);
          resolve();
        },
        (error) => {
          eeInitialized = false;
          console.error('Error initializing Earth Engine:', error);
          reject(error);
        },
        null,
        projectId || undefined
      );
    });

    return true;
  } catch (error) {
    eeInitialized = false;
    console.error('Failed to initialize Earth Engine:', error);
    return false;
  }
}

function loadDistributionManifest(forceReload = false) {
  if (!DISTRIBUTION_ENABLED) {
    return null;
  }

  if (!forceReload && distributionManifestCache) {
    return distributionManifestCache;
  }

  try {
    const manifest = loadDistributionConfig();
    distributionManifestCache = manifest;
    distributionManifestLoadedAt = new Date();
    distributionManifestLastError = null;
    return manifest;
  } catch (error) {
    if (distributionManifestLastError !== error.message) {
      distributionBaseLogger.warn(`No se pudo cargar el manifiesto de distribución (${error.message})`);
    }
    distributionManifestLastError = error.message;
    distributionManifestCache = null;
    return null;
  }
}

function makeDistributionLogger(jobId = 'job', trigger = 'manual') {
  const prefix = `[distribution][${jobId}][${trigger}]`;
  return {
    info: (...args) => console.log(prefix, ...args),
    warn: (...args) => console.warn(prefix, ...args),
    error: (...args) => console.error(prefix, ...args)
  };
}

async function runDistributionJobConfig(jobConfig, defaults = {}, trigger = 'manual') {
  const jobId = jobConfig?.id || 'sin-id';
  const logger = makeDistributionLogger(jobId, trigger);

  if (!eeInitialized) {
    logger.warn('Earth Engine no inicializado; se omite ejecución.');
    return {
      jobId,
      status: 'skipped',
      reason: 'earth-engine-not-initialized',
      trigger
    };
  }

  try {
    const execution = await runDistributionJobInternal(jobConfig, defaults, { logger, trigger });
    return { ...execution, trigger };
  } catch (error) {
    logger.error(`Error al ejecutar job: ${error.message}`);
    return {
      jobId,
      status: 'error',
      error: error.message,
      trigger
    };
  }
}

async function runDistributionJobById(jobId, { trigger = 'manual', forceReload = false } = {}) {
  const manifest = loadDistributionManifest(forceReload);
  if (!manifest || !Array.isArray(manifest.jobs)) {
    return {
      jobId,
      status: 'skipped',
      reason: 'manifest-not-found',
      trigger
    };
  }

  const jobConfig = manifest.jobs.find((job) => job.id === jobId);
  if (!jobConfig) {
    return {
      jobId,
      status: 'not-found',
      trigger
    };
  }

  return runDistributionJobConfig(jobConfig, manifest.defaults || {}, trigger);
}

function clearDistributionSchedule() {
  for (const task of scheduledDistributionTasks.values()) {
    try {
      task.stop();
    } catch (error) {
      distributionBaseLogger.warn(`No se pudo detener tarea programada: ${error.message}`);
    }
  }
  scheduledDistributionTasks.clear();
}

function scheduleDistributionJobs(manifest) {
  clearDistributionSchedule();

  if (!manifest || !Array.isArray(manifest.jobs) || !manifest.jobs.length) {
    distributionBaseLogger.warn('No hay jobs de distribución configurados; scheduler inactivo.');
    return;
  }

  const defaults = manifest.defaults || {};
  const timezoneFallback = defaults.timezone || process.env.REPORTS_DISTRIBUTION_TZ;

  manifest.jobs.forEach((jobConfig, index) => {
    if (!jobConfig || !jobConfig.cron) {
      return;
    }

    const jobId = jobConfig.id || `job-${index + 1}`;
    const timezone = jobConfig.timezone || timezoneFallback;

    try {
      const task = cron.schedule(jobConfig.cron, () => {
        const handler = jobConfig.id
          ? runDistributionJobById(jobConfig.id, { trigger: 'cron' })
          : runDistributionJobConfig(jobConfig, defaults, 'cron');

        handler.catch((error) => {
          distributionBaseLogger.error(`Error en job ${jobId} programado: ${error.message}`);
        });
      }, {
        scheduled: true,
        timezone
      });

      scheduledDistributionTasks.set(jobId, task);
      distributionBaseLogger.info(`Programado job ${jobId} (${jobConfig.cron})${timezone ? ` TZ ${timezone}` : ''}`);

      const runOnBoot = jobConfig.runOnStart ?? defaults.runOnStart ?? process.env.REPORTS_DISTRIBUTION_RUN_ON_BOOT === 'true';
      if (runOnBoot) {
        setTimeout(() => {
          const handler = jobConfig.id
            ? runDistributionJobById(jobConfig.id, { trigger: 'startup' })
            : runDistributionJobConfig(jobConfig, defaults, 'startup');

          handler.catch((error) => {
            distributionBaseLogger.error(`Error en ejecución inicial de ${jobId}: ${error.message}`);
          });
        }, 2000);
      }
    } catch (error) {
      distributionBaseLogger.error(`No se pudo programar job ${jobId}: ${error.message}`);
    }
  });
}

function watchDistributionManifest() {
  if (!DISTRIBUTION_ENABLED) {
    return;
  }

  const configPath = DISTRIBUTION_CONFIG_PATH;
  if (!fs.existsSync(configPath)) {
    distributionBaseLogger.warn(`Archivo de manifiesto no encontrado en ${configPath}, watcher omitido.`);
    return;
  }

  if (distributionWatcher) {
    distributionWatcher.close();
  }

  distributionWatcher = fs.watch(configPath, { persistent: false }, (eventType) => {
    if (eventType === 'change' || eventType === 'rename') {
      setTimeout(() => {
        distributionBaseLogger.info('Manifiesto de distribución actualizado; recargando jobs...');
        const manifest = loadDistributionManifest(true);
        if (manifest) {
          scheduleDistributionJobs(manifest);
        }
      }, 100);
    }
  });
}

function initializeReportDistributionScheduler() {
  if (!DISTRIBUTION_ENABLED) {
    distributionBaseLogger.info('Scheduler de distribución deshabilitado (REPORTS_DISTRIBUTION_ENABLED=false)');
    return;
  }

  const manifest = loadDistributionManifest(true);
  if (!manifest) {
    distributionBaseLogger.warn('No se pudo cargar el manifiesto de distribución; scheduler desactivado.');
    return;
  }

  scheduleDistributionJobs(manifest);
  watchDistributionManifest();
}

function isDistributionAuthorized(req) {
  if (!DISTRIBUTION_TOKEN) {
    return true;
  }

  const token = req.headers['x-distribution-token']
    || req.headers['x-api-key']
    || req.query?.token
    || req.body?.token;

  return token === DISTRIBUTION_TOKEN;
}

// Helper function to get default dataset (Landsat 8 composite)
function getDefaultDataset() {
  return ee.ImageCollection('LANDSAT/LC08/C02/T1_TOA')
    .filterDate('2022-01-01', '2023-01-01')
    .median()
    .visualize({
      bands: ['B4', 'B3', 'B2'],
      min: 0,
      max: 0.3,
      gamma: 1.4
    });
}

function isValidLatitude(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric >= -90 && numeric <= 90;
}

function isValidLongitude(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric >= -180 && numeric <= 180;
}

function isValidEmail(value) {
  if (typeof value !== 'string' || !value.trim()) {
    return false;
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(value.trim());
}

function normalizeOptionalString(value, { maxLength = 200 } = {}) {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  return trimmed.slice(0, maxLength);
}

function validateCitizenReportPayload(payload = {}) {
  const errors = [];

  const rawCategory = typeof payload.category === 'string' ? payload.category.trim().toLowerCase() : '';
  const category = rawCategory && CITIZEN_REPORT_CATEGORIES.has(rawCategory) ? rawCategory : null;
  if (!category) {
    errors.push('Categoría inválida. Usa: heat, green, flooding, waste, air, water u other.');
  }

  const description = typeof payload.description === 'string' ? payload.description.trim() : '';
  if (!description) {
    errors.push('La descripción es obligatoria.');
  } else if (description.length > MAX_CITIZEN_REPORT_DESCRIPTION_LENGTH) {
    errors.push(`La descripción supera el máximo de ${MAX_CITIZEN_REPORT_DESCRIPTION_LENGTH} caracteres.`);
  }

  const latitude = Number(payload.latitude);
  const longitude = Number(payload.longitude);
  if (!isValidLatitude(latitude) || !isValidLongitude(longitude)) {
    errors.push('Ubicación inválida. Proporciona latitud y longitud válidas.');
  }

  const photoUrl = normalizeOptionalString(payload.photoUrl, { maxLength: 1000 });
  const contactName = normalizeOptionalString(payload.contactName, { maxLength: 120 });
  const contactEmailRaw = normalizeOptionalString(payload.contactEmail, { maxLength: 120 });
  const contactEmail = contactEmailRaw && isValidEmail(contactEmailRaw) ? contactEmailRaw : null;
  if (contactEmailRaw && !contactEmail) {
    errors.push('El correo de contacto no tiene un formato válido.');
  }

  return {
    errors,
    data: {
      category,
      description,
      latitude,
      longitude,
      photoUrl,
      contactName,
      contactEmail,
      status: 'open',
      source: 'citizen'
    }
  };
}

function mapCitizenReportToResponse(report) {
  if (!report) {
    return null;
  }
  return {
    id: report.id,
    category: report.category,
    description: report.description,
    latitude: report.latitude,
    longitude: report.longitude,
    photoUrl: report.photoUrl || null,
    contactName: report.contactName || null,
    contactEmail: report.contactEmail || null,
    status: report.status || 'open',
    createdAt: report.createdAt,
    updatedAt: report.updatedAt
  };
}

// Presets de áreas de interés para Lima, Perú
const BLOOM_ROI_PRESETS = {
  costa_metropolitana: {
    geometry: {
      type: 'Polygon',
      coordinates: [[
        [-77.35, -12.45],
        [-76.95, -12.45],
        [-76.95, -11.65],
        [-77.35, -11.65],
        [-77.35, -12.45]
      ]]
    }
  },
  ancon: {
    geometry: {
      type: 'Polygon',
      coordinates: [[
        [-77.19, -11.87],
        [-77.08, -11.87],
        [-77.08, -11.70],
        [-77.19, -11.70],
        [-77.19, -11.87]
      ]]
    }
  },
  pantanos: {
    geometry: {
      type: 'Point',
      coordinates: [-76.999, -12.22]
    },
    buffer: 1500
  }
};

const BLOOM_ROI_META = {
  costa_metropolitana: { label: 'Costa Metropolitana de Lima', type: 'mar', defaultZoom: 11, bufferMeters: 400 },
  ancon: { label: 'Bahía de Ancón', type: 'mar', defaultZoom: 12, bufferMeters: 200 },
  pantanos: { label: 'Pantanos de Villa', type: 'humedal', defaultZoom: 13, bufferMeters: -200 }
};

const ECOPLAN_ROI_PRESETS = {
  lima_metropolitana: {
    geometry: {
      type: 'Polygon',
      coordinates: [[
        [-77.21, -12.05],
        [-76.77, -12.05],
        [-76.77, -12.39],
        [-77.21, -12.39],
        [-77.21, -12.05]
      ]]
    }
  },
  lima_centro: {
    geometry: {
      type: 'Polygon',
      coordinates: [[
        [-77.10, -11.95],
        [-76.90, -11.95],
        [-76.90, -12.20],
        [-77.10, -12.20],
        [-77.10, -11.95]
      ]]
    }
  },
  callao: {
    geometry: {
      type: 'Polygon',
      coordinates: [[
        [-77.20, -11.90],
        [-76.99, -11.90],
        [-76.99, -12.12],
        [-77.20, -12.12],
        [-77.20, -11.90]
      ]]
    }
  }
};

const ECOPLAN_ROI_META = {
  lima_metropolitana: { label: 'Lima Metropolitana', type: 'urbano', defaultZoom: 10, bufferMeters: 0 },
  lima_centro: { label: 'Lima Centro', type: 'urbano', defaultZoom: 12, bufferMeters: 0 },
  callao: { label: 'Provincia Constitucional del Callao', type: 'urbano', defaultZoom: 12, bufferMeters: 0 }
};

function getPresetList() {
  return Object.entries(BLOOM_ROI_PRESETS).map(([key, preset]) => ({
    id: key,
    label: BLOOM_ROI_META[key]?.label || key,
    type: BLOOM_ROI_META[key]?.type || 'mar',
    geometry: preset.geometry,
    defaultBuffer: BLOOM_ROI_META[key]?.bufferMeters || preset.buffer || 0
  }));
}

function getEcoPlanPresetList() {
  return Object.entries(ECOPLAN_ROI_PRESETS).map(([key, preset]) => ({
    id: key,
    label: ECOPLAN_ROI_META[key]?.label || key,
    type: ECOPLAN_ROI_META[key]?.type || 'urbano',
    geometry: preset.geometry,
    defaultBuffer: ECOPLAN_ROI_META[key]?.bufferMeters || preset.buffer || 0
  }));
}

function applyBufferToGeometry(geometry, meters = 0) {
  if (!meters || meters === 0) {
    return geometry;
  }
  return geometry.buffer(meters);
}

function parseGeometry(input) {
  if (!input) {
    return null;
  }
  try {
    return ee.Geometry(input);
  } catch (error) {
    console.error('Invalid geometry payload', error);
    return null;
  }
}

function getRoiFromRequest({ preset = 'costa_metropolitana', geometry, buffer }) {
  const presetKey = preset in BLOOM_ROI_PRESETS ? preset : 'custom';
  if (presetKey === 'custom') {
    const customGeom = parseGeometry(geometry);
    if (!customGeom) {
      throw new Error('Custom geometry is required when preset is custom');
    }
    const bufferMeters = typeof buffer === 'number' ? buffer : 0;
    return {
      roi: applyBufferToGeometry(customGeom, bufferMeters),
      meta: { label: 'Custom ROI', type: 'mar', defaultZoom: 11, bufferMeters }
    };
  }

  const presetDef = BLOOM_ROI_PRESETS[presetKey];
  let baseGeom = ee.Geometry(presetDef.geometry);
  if (presetDef.geometry.type === 'Point') {
    baseGeom = baseGeom.buffer(presetDef.buffer || 0);
  }
  const meta = BLOOM_ROI_META[presetKey] || { type: 'mar', defaultZoom: 11, bufferMeters: 0 };
  const bufferMeters = typeof buffer === 'number' ? buffer : meta.bufferMeters || 0;
  return {
    roi: applyBufferToGeometry(baseGeom, bufferMeters),
    meta: { ...meta, bufferMeters }
  };
}

function getEcoPlanRoiFromRequest({ preset = 'lima_metropolitana', geometry, buffer }) {
  const presetKey = preset in ECOPLAN_ROI_PRESETS ? preset : 'custom';
  if (presetKey === 'custom') {
    const customGeom = parseGeometry(geometry);
    if (!customGeom) {
      throw new Error('Custom geometry is required when preset is custom');
    }
    const bufferMeters = typeof buffer === 'number' ? buffer : 0;
    return {
      roi: applyBufferToGeometry(customGeom, bufferMeters),
      meta: { label: 'Área personalizada', type: 'urbano', defaultZoom: 11, bufferMeters }
    };
  }

  const presetDef = ECOPLAN_ROI_PRESETS[presetKey];
  let baseGeom = ee.Geometry(presetDef.geometry);
  if (presetDef.geometry.type === 'Point') {
    baseGeom = baseGeom.buffer(presetDef.buffer || 0);
  }
  const meta = ECOPLAN_ROI_META[presetKey] || { type: 'urbano', defaultZoom: 11, bufferMeters: 0 };
  const bufferMeters = typeof buffer === 'number' ? buffer : meta.bufferMeters || 0;

  return {
    roi: applyBufferToGeometry(baseGeom, bufferMeters),
    meta: { ...meta, bufferMeters }
  };
}

function evaluateEeObject(eeObject) {
  return new Promise((resolve, reject) => {
    eeObject.evaluate((result, error) => {
      if (error) {
        reject(error);
      } else {
        resolve(result);
      }
    });
  });
}

function toDictionary(stats) {
  return ee.Dictionary(ee.Algorithms.If(stats, stats, {}));
}

function normalizeMapInfo(info) {
  if (!info) {
    return null;
  }

  const sanitized = {};
  Object.entries(info).forEach(([key, value]) => {
    if (typeof value !== 'function') {
      sanitized[key] = value;
    }
  });

  const rawMapId = sanitized.mapid || sanitized.mapId || sanitized.mapID || null;
  const token = sanitized.token || sanitized.accessToken || null;
  const hasPath = typeof rawMapId === 'string' && rawMapId.includes('/');
  const projectPath = hasPath ? rawMapId : rawMapId ? `projects/earthengine-legacy/maps/${rawMapId}` : null;
  const legacyId = hasPath && rawMapId.includes('/maps/') ? rawMapId.split('/maps/')[1] : rawMapId;

  const candidateUrl = sanitized.tileUrl
    || sanitized.tile_fetch_url
    || sanitized.tileFetchUrl
    || sanitized.urlFormat
    || sanitized.url
    || null;

  const legacyTemplate = legacyId
    ? `https://earthengine.googleapis.com/map/${legacyId}/{z}/{x}/{y}${token ? `?token=${token}` : ''}`
    : null;

  const v1Template = projectPath
    ? `https://earthengine.googleapis.com/v1/${projectPath}/tiles/{z}/{x}/{y}`
    : null;

  const tileUrl = candidateUrl || (token && legacyTemplate) || v1Template || legacyTemplate;

  return {
    ...sanitized,
    mapid: rawMapId,
    token,
    legacyMapId: legacyId,
    tileUrl,
    urlFormat: candidateUrl || v1Template || legacyTemplate,
    legacyTileUrl: legacyTemplate,
    v1TileUrl: v1Template,
    requiresToken: Boolean(token)
  };
}

function getMapFromImage(image, visParams = {}) {
  return new Promise((resolve, reject) => {
    image.getMap(visParams, (info, error) => {
      if (error) {
        reject(error);
      } else {
        resolve(normalizeMapInfo(info));
      }
    });
  });
}

function maskSentinel2(image) {
  const scl = image.select('SCL');
  const cloudShadow = scl.eq(3);
  const clouds = scl.eq(8).or(scl.eq(9)).or(scl.eq(10));
  const snow = scl.eq(11);
  const cirrus = scl.eq(7);
  const bad = cloudShadow.or(clouds).or(snow).or(cirrus);
  return image.updateMask(bad.not());
}

function maskL8sr(image) {
  const qa = image.select('QA_PIXEL');
  const cloudShadowMask = 1 << 3;
  const snowMask = 1 << 5;
  const cloudMask = 1 << 4;
  const cirrusMask = 1 << 2;

  const mask = qa.bitwiseAnd(cloudShadowMask).eq(0)
    .and(qa.bitwiseAnd(cloudMask).eq(0))
    .and(qa.bitwiseAnd(cirrusMask).eq(0))
    .and(qa.bitwiseAnd(snowMask).eq(0));

  return image.updateMask(mask);
}

function addLstCelsius(image) {
  const lstKelvin = image.select('ST_B10').multiply(0.00341802).add(149);
  const lstCelsius = lstKelvin.subtract(273.15).rename('LST_C');
  return image.addBands(lstCelsius);
}

function normalizeImage(image, minValue, maxValue) {
  const min = ee.Number(minValue);
  const max = ee.Number(maxValue);
  const range = max.subtract(min);
  const safeRange = ee.Number(ee.Algorithms.If(range.eq(0), 1, range));
  return image.subtract(min).divide(safeRange).clamp(0, 1);
}

function safeImageCollection(datasetId) {
  if (!datasetId) {
    return null;
  }
  try {
    return ee.ImageCollection(datasetId);
  } catch (error) {
    console.warn(`Dataset not available: ${datasetId}`, error);
    return null;
  }
}

function safeImage(datasetId) {
  if (!datasetId) {
    return null;
  }
  try {
    return ee.Image(datasetId);
  } catch (error) {
    console.warn(`Dataset not available: ${datasetId}`, error);
    return null;
  }
}

function addWaterMask(image, roiType = 'mar') {
  const ndwi = image.normalizedDifference(['B3', 'B8']).rename('NDWI');
  const ndvi = image.normalizedDifference(['B8', 'B4']);
  const scl = image.select('SCL');

  const baseWater = scl.eq(6);
  const expandedWater = baseWater.focal_max(1, 'square', 'pixels');
  const notCloud = scl.neq(3)
    .and(scl.neq(7))
    .and(scl.neq(8))
    .and(scl.neq(9))
    .and(scl.neq(10))
    .and(scl.neq(11));

  let waterMask = expandedWater;

  if (roiType === 'humedal') {
    const wetlandWater = ndwi.gt(0.15).and(ndvi.lt(0.4));
    waterMask = waterMask.or(wetlandWater);
  } else if (roiType === 'mar') {
    const spectralWater = ndwi.gt(0).and(ndvi.lt(0.2)).and(scl.eq(5).not());
    waterMask = waterMask.or(spectralWater);
  } else {
    const generalWater = ndwi.gt(0.1).and(ndvi.lt(0.25));
    waterMask = waterMask.or(generalWater);
  }

  waterMask = waterMask.and(notCloud)
    .focal_max(1, 'square', 'pixels')
    .focal_min(1, 'square', 'pixels');

  return image.addBands([
    ndwi,
    waterMask.rename('waterMask')
  ]);
}

function addAlgaeBands(image) {
  const scale = ee.Number(0.0001);
  const red = image.select('B4').multiply(scale);
  const redEdge = image.select('B5').multiply(scale);
  const nir = image.select('B8').multiply(scale);
  const nirAlt = image.select('B8A').multiply(scale);
  const swir1 = image.select('B11').multiply(scale);

  const ndci = redEdge.subtract(red).divide(redEdge.add(red)).rename('NDCI');

  const wlRed = 665;
  const wlNir = 842;
  const wlSwir = 1610;
  const baseline = red.add(
    swir1.subtract(red).multiply(
      ee.Number(wlNir - wlRed).divide(wlSwir - wlRed)
    )
  );
  const fai = nir.subtract(baseline).rename('FAI');
  const faiAlt = nirAlt.subtract(baseline).rename('FAI_B8A');

  return image.addBands([ndci, fai, faiAlt]);
}

function cleanMask(mask, minPixels = 12) {
  const connected = mask.selfMask().connectedPixelCount(100, true);
  return mask.updateMask(connected.gte(minPixels));
}

function applyBloomThresholds(image, thresholds, minPixelsClean) {
  const ndci = image.select('NDCI');
  const fai = image.select('FAI');
  const faiAlt = image.select('FAI_B8A');
  const waterMask = image.select('waterMask');

  const bloomRaw = ndci.gt(thresholds.ndci)
    .or(fai.gt(thresholds.fai))
    .or(faiAlt.gt(thresholds.faiAlt));

  const bloomClean = cleanMask(bloomRaw, minPixelsClean).rename('Bloom');
  return image.addBands(bloomClean.updateMask(waterMask));
}

async function buildBloomCollection(options) {
  const {
    preset = 'costa_metropolitana',
    geometry,
    buffer,
    start = '2024-10-01',
    end = '2025-10-02',
    cloudPercentage = 35,
    ndciThreshold = 0.1,
    faiThreshold = 0.005,
    adaptiveThreshold = true,
    roiType: roiTypeOverride,
    minPixelsClean = 12
  } = options || {};

  const { roi, meta } = getRoiFromRequest({ preset, geometry, buffer });
  const roiType = roiTypeOverride || meta.type || 'mar';

  const collection = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
    .filterBounds(roi)
    .filterDate(start, end)
    .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', cloudPercentage))
    .map(maskSentinel2)
    .map(addAlgaeBands)
    .map((image) => addWaterMask(image, roiType))
    .map((image) => image.updateMask(image.select('waterMask')));

  const compositeMedian = collection.median();
  const compositeP85 = collection.reduce(ee.Reducer.percentile([85]));

  let thresholds = {
    ndci: ee.Number(ndciThreshold),
    fai: ee.Number(faiThreshold),
    faiAlt: ee.Number(faiThreshold).multiply(0.6)
  };

  if (adaptiveThreshold) {
    const stats = compositeMedian.select(['NDCI', 'FAI', 'FAI_B8A']).reduceRegion({
      reducer: ee.Reducer.percentile([70, 85, 90, 95]),
      geometry: roi,
      scale: 20,
      maxPixels: 1e11,
      bestEffort: true
    });

    thresholds = {
      ndci: ee.Number(stats.get('NDCI_p85')).max(ndciThreshold),
      fai: ee.Number(stats.get('FAI_p90')).max(faiThreshold),
      faiAlt: ee.Number(stats.get('FAI_B8A_p90')).max(ee.Number(faiThreshold).multiply(0.5))
    };
  }

  const flaggedCollection = collection.map((image) =>
    applyBloomThresholds(image, thresholds, minPixelsClean)
  );

  const bloomMask = flaggedCollection.select('Bloom').max();
  const pixelArea = ee.Image.pixelArea().divide(1e6);

  const areaSeries = ee.FeatureCollection(flaggedCollection.map((image) => {
    const areaKm2 = image.select('Bloom').selfMask().multiply(pixelArea).reduceRegion({
      reducer: ee.Reducer.sum(),
      geometry: roi,
      scale: 20,
      maxPixels: 1e11,
      bestEffort: true
    }).get('Bloom');

    return ee.Feature(null, {
      date: image.date().format('YYYY-MM-dd'),
      area_km2: areaKm2
    });
  }));

  const thresholdsEvaluated = await evaluateEeObject(ee.Dictionary({
    ndci: thresholds.ndci,
    fai: thresholds.fai,
    faiAlt: thresholds.faiAlt
  }));

  return {
    roi,
    meta,
    collection: flaggedCollection,
    compositeMedian,
    compositeP85,
    bloomMask,
    thresholds,
    thresholdsEvaluated,
    areaSeries,
    pixelArea
  };
}

function createTimeSeries(collection, bandName, geometry, scale, propertyName) {
  return ee.FeatureCollection(collection.map((image) => {
    const value = image.select(bandName).reduceRegion({
      reducer: ee.Reducer.mean(),
      geometry,
      scale,
      maxPixels: 1e13,
      bestEffort: true
    }).get(bandName, null);

    return ee.Feature(null, {
      date: image.date().format('YYYY-MM-dd'),
      [propertyName]: value
    });
  })).filter(ee.Filter.notNull([propertyName]));
}

async function buildRegionalContext(options) {
  const {
    preset = 'costa_metropolitana',
    geometry,
    buffer,
    start = '2024-10-01',
    end = '2025-10-02',
    contextBuffer = 5000,
    chlorScale = 4000,
    sstScale = 25000,
    chlorDataset = 'NASA/OCEANDATA/MODIS-Aqua/L3SMI',
    sstDataset = 'NOAA/CDR/OISST/V2_1'
  } = options || {};

  const { roi, meta } = getRoiFromRequest({ preset, geometry, buffer });
  const contextGeom = roi.buffer(contextBuffer);

  const chlorCollection = ee.ImageCollection(chlorDataset)
    .select('chlor_a')
    .filterDate(start, end)
    .filterBounds(contextGeom)
    .map((image) => image.updateMask(image.gt(0)));

  const sstCollection = ee.ImageCollection(sstDataset)
    .select('sst')
    .filterDate(start, end)
    .filterBounds(contextGeom);

  const chlorMeanImage = chlorCollection.mean();
  const chlorMaxImage = chlorCollection.max();
  const chlorMinImage = chlorCollection.min();

  const sstMeanImage = sstCollection.mean();
  const sstMaxImage = sstCollection.max();
  const sstMinImage = sstCollection.min();

  const chlorSeries = createTimeSeries(chlorCollection, 'chlor_a', contextGeom, chlorScale, 'chlor_a');
  const sstSeries = createTimeSeries(sstCollection, 'sst', contextGeom, sstScale, 'sst');

  const safeReduce = (image, bandName, reducer, scale) => {
    const stats = ee.Dictionary(image.reduceRegion({
      reducer,
      geometry: contextGeom,
      scale,
      maxPixels: 1e13,
      bestEffort: true
    }));

    return ee.Algorithms.If(
      stats.contains(bandName),
      stats.get(bandName),
      null
    );
  };

  const [
    chlorLayer,
    sstLayer,
    chlorSeriesData,
    sstSeriesData,
    summaryValues,
    contextGeoJson
  ] = await Promise.all([
    getMapFromImage(chlorMeanImage, {
      min: 0,
      max: 10,
      palette: ['0d0887', '7e03a8', 'cc4778', 'f89540', 'f0f921']
    }),
    getMapFromImage(sstMeanImage, {
      min: 15,
      max: 30,
      palette: ['0021ff', '0ba9ff', '74ffdc', 'f9fd6c', 'ff5e3a']
    }),
    evaluateEeObject(chlorSeries),
    evaluateEeObject(sstSeries),
    evaluateEeObject(ee.Dictionary({
      chlor_mean: safeReduce(chlorMeanImage, 'chlor_a', ee.Reducer.mean(), chlorScale),
      chlor_max: safeReduce(chlorMaxImage, 'chlor_a', ee.Reducer.max(), chlorScale),
      chlor_min: safeReduce(chlorMinImage, 'chlor_a', ee.Reducer.min(), chlorScale),
      sst_mean: safeReduce(sstMeanImage, 'sst', ee.Reducer.mean(), sstScale),
      sst_max: safeReduce(sstMaxImage, 'sst', ee.Reducer.max(), sstScale),
      sst_min: safeReduce(sstMinImage, 'sst', ee.Reducer.min(), sstScale)
    })),
    evaluateEeObject(contextGeom)
  ]);

  return {
    meta,
    contextGeometry: contextGeoJson,
    layers: {
      chlorophyll: {
        ...chlorLayer,
        name: 'MODIS Chlorophyll-a'
      },
      sst: {
        ...sstLayer,
        name: 'OISST Sea Surface Temp'
      }
    },
    series: {
      chlorophyll: chlorSeriesData?.features || [],
      sst: sstSeriesData?.features || []
    },
    summary: summaryValues
  };
}

async function buildEcoPlanAnalysis(options) {
  const {
    preset = 'lima_metropolitana',
    geometry,
    buffer,
    start = '2024-01-01',
    end = '2024-12-31',
    cloudPercentage = 20,
    populationYear = 2020,
    districtsAsset,
    tileScale = 4,
    no2Dataset = 'COPERNICUS/S5P/OFFL/L3_NO2',
    no2Band = 'tropospheric_NO2_column_number_density',
    pm25Dataset = 'NASA/SEDAC/SDG/SDG11_6_2/PM2_5',
    pm25Band = 'PM2_5',
    srtmDataset = 'USGS/SRTMGL1_003'
  } = options || {};

  const { roi, meta } = getEcoPlanRoiFromRequest({ preset, geometry, buffer });

  const sentinelCollection = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
    .filterBounds(roi)
    .filterDate(start, end)
    .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', cloudPercentage))
    .map(maskSentinel2)
    .map((image) => {
      const ndvi = image.normalizedDifference(['B8', 'B4']).rename('NDVI');
      const ndwi = image.normalizedDifference(['B3', 'B8']).rename('NDWI');
      return image.addBands([ndvi, ndwi]);
    });

  let sentinelImageCount = 0;
  try {
    sentinelImageCount = await evaluateEeObject(sentinelCollection.size());
  } catch (error) {
    console.warn('Sentinel-2 collection unavailable for EcoPlan ROI:', error.message || error);
  }
  const hasSentinelData = sentinelImageCount && Number(sentinelImageCount) > 0;

  const ndviComposite = hasSentinelData
    ? sentinelCollection.qualityMosaic('NDVI').select('NDVI').clip(roi)
    : ee.Image.constant(0).rename('NDVI').clip(roi);

  const ndwiComposite = hasSentinelData
    ? sentinelCollection.mean().select('NDWI').clip(roi)
    : ee.Image.constant(0).rename('NDWI').clip(roi);

  const landsatCollection = ee.ImageCollection('LANDSAT/LC08/C02/T1_L2')
    .filterBounds(roi)
    .filterDate(start, end)
    .map(maskL8sr)
    .map(addLstCelsius);

  let landsatImageCount = 0;
  try {
    landsatImageCount = await evaluateEeObject(landsatCollection.size());
  } catch (error) {
    console.warn('Landsat collection unavailable for EcoPlan ROI:', error.message || error);
  }
  const hasLandsatData = landsatImageCount && Number(landsatImageCount) > 0;

  const lstComposite = hasLandsatData
    ? landsatCollection.median().select('LST_C').clip(roi)
    : ee.Image.constant(0).rename('LST_C').clip(roi);

  const ndviSeries = hasSentinelData
    ? createTimeSeries(sentinelCollection.select('NDVI'), 'NDVI', roi, 20, 'ndvi')
    : ee.FeatureCollection([]);

  const lstSeries = hasLandsatData
    ? createTimeSeries(landsatCollection.select('LST_C'), 'LST_C', roi, 30, 'lst_c')
    : ee.FeatureCollection([]);

  const populationDensityCollection = ee.ImageCollection('CIESIN/GPWv411/GPW_Population_Density')
    .filter(ee.Filter.eq('year', populationYear));

  let populationDensityImage = populationDensityCollection.first();
  populationDensityImage = ee.Image(ee.Algorithms.If(
    populationDensityImage,
    populationDensityImage,
    ee.ImageCollection('CIESIN/GPWv411/GPW_Population_Density').sort('year', false).first()
  ));
  populationDensityImage = ee.Image(populationDensityImage).select('population_density').clip(roi);

  const populationCountCollection = ee.ImageCollection('CIESIN/GPWv411/GPW_Population_Count')
    .filter(ee.Filter.eq('year', populationYear));

  let populationCountImage = populationCountCollection.first();
  populationCountImage = ee.Image(ee.Algorithms.If(
    populationCountImage,
    populationCountImage,
    ee.ImageCollection('CIESIN/GPWv411/GPW_Population_Count').sort('year', false).first()
  ));
  populationCountImage = ee.Image(populationCountImage).select('population_count').clip(roi);

  const ndviNorm = normalizeImage(ndviComposite, 0, 0.8);
  const lstNorm = normalizeImage(lstComposite, 20, 40);
  const popNorm = normalizeImage(populationDensityImage, 0, 10000);

  const heatImage = lstNorm.multiply(0.5)
    .add(ndviNorm.multiply(-0.3))
    .add(popNorm.multiply(0.2))
    .rename('HeatVulnerability')
    .clip(roi);

  const aodBand = 'Aerosol_Optical_Depth_Land_Ocean_Mean_Mean';
  const aodCollection = ee.ImageCollection('MODIS/061/MOD08_M3')
    .select(aodBand)
    .filterBounds(roi)
    .filterDate(start, end);

  let aodImageCount = 0;
  try {
    aodImageCount = await evaluateEeObject(aodCollection.size());
  } catch (error) {
    console.warn('AOD collection unavailable for EcoPlan ROI:', error.message || error);
  }
  const hasAodData = aodImageCount && Number(aodImageCount) > 0;

  const aodImage = hasAodData
    ? aodCollection.mean().rename('AOD').clip(roi)
    : ee.Image.constant(0).rename('AOD').clip(roi);

  const aodSeries = hasAodData
    ? createTimeSeries(aodCollection, aodBand, roi, 1000, 'aod')
    : ee.FeatureCollection([]);

  let ndbiComposite;
  if (hasSentinelData) {
    const ndbiCollection = sentinelCollection.map((image) =>
      image.normalizedDifference(['B11', 'B8']).rename('NDBI')
    );
    ndbiComposite = ndbiCollection.median().rename('NDBI').clip(roi);
  } else {
    ndbiComposite = ee.Image.constant(0).rename('NDBI').clip(roi);
  }
  const imperviousImage = normalizeImage(ndbiComposite, -0.2, 0.4).rename('Impervious');

  let srtmImage = safeImage(srtmDataset);
  if (!srtmImage) {
    srtmImage = ee.Image('USGS/SRTMGL1_003');
  }
  const slopeImage = ee.Terrain.slope(ee.Image(srtmImage)).rename('Slope').clip(roi);
  const slopeNorm = normalizeImage(slopeImage, 0, 45).rename('SlopeNorm');

  const ndwiNorm = normalizeImage(ndwiComposite, -0.1, 0.5).rename('NDWI_Norm');
  const drynessImage = ee.Image(1).subtract(ndwiNorm).rename('Dryness');

  const pixelArea = ee.Image.pixelArea();
  const greenMask = ndviComposite.gt(0.4);
  const greenAreaImage = greenMask.multiply(pixelArea).rename('GreenArea');

  const safePopulationPerPixel = populationCountImage.max(ee.Image.constant(1));
  const greenPerCapitaImage = greenAreaImage.divide(safePopulationPerPixel)
    .rename('GreenPerCapita');
  const greenDeficitImage = greenPerCapitaImage.lt(9).rename('GreenDeficit');

  const waterRiskImage = imperviousImage.multiply(0.5)
    .add(slopeNorm.multiply(0.3))
    .add(drynessImage.multiply(0.2))
    .rename('WaterRisk')
    .clamp(0, 1)
    .clip(roi);

  const no2Collection = safeImageCollection(no2Dataset);
  let no2Image = null;
  let no2Series = null;

  if (no2Collection) {
    const filteredNo2 = no2Collection
      .select(no2Band)
      .filterBounds(roi)
      .filterDate(start, end);
    no2Image = filteredNo2.mean().rename('NO2').clip(roi);
    no2Series = createTimeSeries(filteredNo2, no2Band, roi, 1113, 'no2');
  }

  const PM25_FROM_AOD_FACTOR = 160;
  let pm25Image = null;
  let pm25Series = null;

  if (pm25Dataset) {
    try {
      const pm25Collection = ee.ImageCollection(pm25Dataset)
        .select(pm25Band)
        .filterBounds(roi)
        .filterDate(start, end);

      const pm25Count = await evaluateEeObject(pm25Collection.size());
      if (pm25Count && Number(pm25Count) > 0) {
        pm25Image = pm25Collection.mean().rename('PM25').clip(roi);
        pm25Series = createTimeSeries(pm25Collection, pm25Band, roi, 1000, 'pm25');
      }
    } catch (error) {
      console.warn(`PM2.5 dataset unavailable (${pm25Dataset}):`, error.message || error);
    }

    if (!pm25Image) {
      try {
        const pm25ImageCandidate = ee.Image(pm25Dataset).select(pm25Band);
        const pm25Sample = await evaluateEeObject(pm25ImageCandidate.reduceRegion({
          reducer: ee.Reducer.mean(),
          geometry: roi,
          scale: 5000,
          maxPixels: 1e13,
          bestEffort: true
        }));

        if (pm25Sample && Object.keys(pm25Sample).length) {
          pm25Image = pm25ImageCandidate.rename('PM25').clip(roi);
        }
      } catch (error) {
        console.warn(`PM2.5 single-image fallback unavailable (${pm25Dataset}):`, error.message || error);
      }
    }
  }

  if (!pm25Image && hasAodData && aodImage) {
    pm25Image = aodImage.multiply(PM25_FROM_AOD_FACTOR).rename('PM25_est');
  }

  if (!pm25Series && hasAodData && aodSeries) {
    pm25Series = aodSeries.map((feature) => ee.Feature(null, {
      date: feature.get('date'),
      pm25: ee.Number(feature.get('aod')).multiply(PM25_FROM_AOD_FACTOR)
    })).filter(ee.Filter.notNull(['pm25']));
  }

  let airQualityIndexImage = null;
  const aodNorm = normalizeImage(aodImage, 0, 1.5);
  let no2Norm = null;
  let pm25Norm = null;

  if (no2Image) {
    no2Norm = normalizeImage(no2Image.multiply(1e4), 0, 150).rename('NO2_Norm');
  }

  if (pm25Image) {
    pm25Norm = normalizeImage(pm25Image, 0, 60).rename('PM25_Norm');
  }

  // Construir el índice de calidad del aire con las imágenes disponibles
  const airQualityComponents = [];
  const airQualityWeights = [];
  
  if (aodNorm) {
    airQualityComponents.push(aodNorm.multiply(0.5));
    airQualityWeights.push(0.5);
  }
  if (no2Norm) {
    airQualityComponents.push(no2Norm.multiply(0.3));
    airQualityWeights.push(0.3);
  }
  if (pm25Norm) {
    airQualityComponents.push(pm25Norm.multiply(0.2));
    airQualityWeights.push(0.2);
  }

  // Calcular el índice de calidad del aire
  if (airQualityComponents.length > 0) {
    let airQualitySum = airQualityComponents[0];
    for (let i = 1; i < airQualityComponents.length; i++) {
      airQualitySum = airQualitySum.add(airQualityComponents[i]);
    }
    const totalWeight = airQualityWeights.reduce((a, b) => a + b, 0);
    airQualityIndexImage = airQualitySum.divide(totalWeight).rename('AirQualityIndex');
  } else {
    // Si no hay datos, usar una imagen constante
    airQualityIndexImage = ee.Image.constant(0).rename('AirQualityIndex').clip(roi);
  }

  const summaryReducer = ee.Reducer.mean().combine({
    reducer2: ee.Reducer.minMax(),
    sharedInputs: true
  });

  const ndviStats = ndviComposite.reduceRegion({
    reducer: summaryReducer,
    geometry: roi,
    scale: 20,
    maxPixels: 1e11,
    bestEffort: true,
    tileScale
  });

  const lstStats = lstComposite.reduceRegion({
    reducer: summaryReducer,
    geometry: roi,
    scale: 30,
    maxPixels: 1e11,
    bestEffort: true,
    tileScale
  });

  const heatStats = heatImage.reduceRegion({
    reducer: summaryReducer,
    geometry: roi,
    scale: 100,
    maxPixels: 1e11,
    bestEffort: true,
    tileScale
  });

  const ndwiStats = ndwiComposite.reduceRegion({
    reducer: summaryReducer,
    geometry: roi,
    scale: 20,
    maxPixels: 1e11,
    bestEffort: true,
    tileScale
  });

  const aodStats = aodImage.reduceRegion({
    reducer: summaryReducer,
    geometry: roi,
    scale: 1000,
    maxPixels: 1e11,
    bestEffort: true,
    tileScale
  });

  const populationStats = populationDensityImage.reduceRegion({
    reducer: summaryReducer,
    geometry: roi,
    scale: 250,
    maxPixels: 1e11,
    bestEffort: true,
    tileScale
  });

  const populationCountStats = populationCountImage.reduceRegion({
    reducer: ee.Reducer.sum(),
    geometry: roi,
    scale: 250,
    maxPixels: 1e11,
    bestEffort: true,
    tileScale
  });

  const greenPerCapitaStats = greenPerCapitaImage.reduceRegion({
    reducer: summaryReducer,
    geometry: roi,
    scale: 30,
    maxPixels: 1e11,
    bestEffort: true,
    tileScale
  });

  const greenDeficitStats = greenDeficitImage.reduceRegion({
    reducer: ee.Reducer.mean(),
    geometry: roi,
    scale: 30,
    maxPixels: 1e11,
    bestEffort: true,
    tileScale
  });

  const imperviousStats = imperviousImage.reduceRegion({
    reducer: summaryReducer,
    geometry: roi,
    scale: 30,
    maxPixels: 1e11,
    bestEffort: true,
    tileScale
  });

  const waterRiskStats = waterRiskImage.reduceRegion({
    reducer: summaryReducer,
    geometry: roi,
    scale: 30,
    maxPixels: 1e11,
    bestEffort: true,
    tileScale
  });

  const airQualityStats = airQualityIndexImage.reduceRegion({
    reducer: summaryReducer,
    geometry: roi,
    scale: 1000,
    maxPixels: 1e11,
    bestEffort: true,
    tileScale
  });

  const no2Stats = no2Image ? no2Image.reduceRegion({
    reducer: summaryReducer,
    geometry: roi,
    scale: 1000,
    maxPixels: 1e11,
    bestEffort: true,
    tileScale
  }) : null;

  const pm25Stats = pm25Image ? pm25Image.reduceRegion({
    reducer: summaryReducer,
    geometry: roi,
    scale: 1000,
    maxPixels: 1e11,
    bestEffort: true,
    tileScale
  }) : null;

  const greenAreaStats = greenAreaImage.reduceRegion({
    reducer: ee.Reducer.sum(),
    geometry: roi,
    scale: 30,
    maxPixels: 1e11,
    bestEffort: true,
    tileScale
  });

  const ndviDict = toDictionary(ndviStats);
  const lstDict = toDictionary(lstStats);
  const heatDict = toDictionary(heatStats);
  const ndwiDict = toDictionary(ndwiStats);
  const aodDict = toDictionary(aodStats);
  const populationDict = toDictionary(populationStats);
  const populationCountDict = toDictionary(populationCountStats);
  const greenPerCapitaDict = toDictionary(greenPerCapitaStats);
  const greenDeficitDict = toDictionary(greenDeficitStats);
  const imperviousDict = toDictionary(imperviousStats);
  const waterRiskDict = toDictionary(waterRiskStats);
  const airQualityDict = toDictionary(airQualityStats);
  const no2Dict = toDictionary(no2Stats);
  const pm25Dict = toDictionary(pm25Stats);
  const greenAreaDict = toDictionary(greenAreaStats);

  const summary = ee.Dictionary({
    ndvi_mean: ndviDict.get('NDVI_mean', null),
    ndvi_min: ndviDict.get('NDVI_min', null),
    ndvi_max: ndviDict.get('NDVI_max', null),
    lst_mean: lstDict.get('LST_C_mean', null),
    lst_min: lstDict.get('LST_C_min', null),
    lst_max: lstDict.get('LST_C_max', null),
    heat_mean: heatDict.get('HeatVulnerability_mean', null),
    heat_min: heatDict.get('HeatVulnerability_min', null),
    heat_max: heatDict.get('HeatVulnerability_max', null),
    ndwi_mean: ndwiDict.get('NDWI_mean', null),
    ndwi_min: ndwiDict.get('NDWI_min', null),
    ndwi_max: ndwiDict.get('NDWI_max', null),
    aod_mean: aodDict.get('AOD_mean', null),
    aod_min: aodDict.get('AOD_min', null),
    aod_max: aodDict.get('AOD_max', null),
    population_mean: populationDict.get('population_density_mean', null),
    population_max: populationDict.get('population_density_max', null),
    population_total: populationCountDict.get('population_count', null),
    green_area_m2: greenAreaDict.get('GreenArea', null),
    green_per_capita_mean: ee.Algorithms.If(
      greenPerCapitaDict.contains('GreenPerCapita_mean'),
      greenPerCapitaDict.get('GreenPerCapita_mean'),
      ee.Algorithms.If(
        greenPerCapitaDict.contains('GreenPerCapita'),
        greenPerCapitaDict.get('GreenPerCapita'),
        null
      )
    ),
    green_per_capita_min: ee.Algorithms.If(
      greenPerCapitaDict.contains('GreenPerCapita_min'),
      greenPerCapitaDict.get('GreenPerCapita_min'),
      null
    ),
    green_per_capita_max: ee.Algorithms.If(
      greenPerCapitaDict.contains('GreenPerCapita_max'),
      greenPerCapitaDict.get('GreenPerCapita_max'),
      null
    ),
    green_deficit_ratio: ee.Algorithms.If(
      greenDeficitDict.contains('GreenDeficit'),
      greenDeficitDict.get('GreenDeficit'),
      null
    ),
    impervious_mean: imperviousDict.get('Impervious_mean', null),
    impervious_min: imperviousDict.get('Impervious_min', null),
    impervious_max: imperviousDict.get('Impervious_max', null),
    water_risk_mean: waterRiskDict.get('WaterRisk_mean', null),
    water_risk_min: waterRiskDict.get('WaterRisk_min', null),
    water_risk_max: waterRiskDict.get('WaterRisk_max', null),
    air_quality_mean: airQualityDict.get('AirQualityIndex_mean', null),
    air_quality_min: airQualityDict.get('AirQualityIndex_min', null),
    air_quality_max: airQualityDict.get('AirQualityIndex_max', null),
    no2_mean: no2Dict.get('NO2_mean', null),
    pm25_mean: ee.Algorithms.If(
      pm25Image,
      pm25Dict.get('PM25_mean', pm25Dict.get('PM25_est_mean', null)),
      null
    )
  });

  let boundaryStats = null;
  if (districtsAsset) {
    try {
      const boundaries = ee.FeatureCollection(districtsAsset);
      const combinedImage = ndviComposite.rename('NDVI')
        .addBands(lstComposite.rename('LST_C'))
        .addBands(heatImage.rename('HeatVulnerability'))
        .addBands(populationDensityImage.rename('population_density'));

      boundaryStats = combinedImage.reduceRegions({
        collection: boundaries,
        reducer: ee.Reducer.mean().combine({
          reducer2: ee.Reducer.stdDev(),
          sharedInputs: true
        }),
        scale: 120,
        maxPixels: 1e12,
        bestEffort: true,
        tileScale
      });
    } catch (error) {
      console.warn('Could not compute boundary statistics:', error);
    }
  }

  return {
    roi,
    meta,
    ndviImage: ndviComposite,
    lstImage: lstComposite,
    heatImage,
    ndwiImage: ndwiComposite,
    aodImage,
    no2Image,
    pm25Image,
    airQualityImage: airQualityIndexImage,
    imperviousImage,
    waterRiskImage,
    greenPerCapitaImage,
    greenDeficitImage,
    greenAreaImage,
    ndviSeries,
    lstSeries,
    aodSeries,
    no2Series,
    pm25Series,
    summary,
    boundaryStats
  };
}

configureReportsService({
  buildEcoPlanAnalysis,
  evaluateEeObject
});

// Routes

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    earthEngineInitialized: eeInitialized,
    timestamp: new Date().toISOString()
  });
});

// Get map tiles endpoint - XYZ format
app.get('/api/tiles/:z/:x/:y', async (req, res) => {
  if (!eeInitialized) {
    return res.status(503).json({ 
      error: 'Earth Engine not initialized',
      message: 'Please ensure service account credentials are properly configured'
    });
  }

  try {
    const { z, x, y } = req.params;
    
    // Get the default dataset or use query parameters to customize
    const image = getDefaultDataset();
    
    // Get map information and tile URL from Earth Engine
    const mapInfo = await new Promise((resolve, reject) => {
      image.getMap({}, (result, err) => {
        if (err) {
          reject(err);
        } else {
          resolve(result);
        }
      });
    });

    const tileUrl = ee.data.getTileUrl(
      mapInfo,
      parseInt(x, 10),
      parseInt(y, 10),
      parseInt(z, 10)
    );

    // Redirect to the Earth Engine tile URL
    res.redirect(tileUrl);
    
  } catch (error) {
    console.error('Error generating tile:', error);
    res.status(500).json({ 
      error: 'Failed to generate tile',
      message: error.message 
    });
  }
});

// Get map visualization parameters endpoint
app.get('/api/map/info', async (req, res) => {
  if (!eeInitialized) {
    return res.status(503).json({ 
      error: 'Earth Engine not initialized' 
    });
  }

  try {
    const image = getDefaultDataset();
    const mapInfo = await getMapFromImage(image, {});

    res.json({
      mapId: mapInfo?.mapid,
      token: mapInfo?.token,
      tileUrl: mapInfo?.tileUrl,
      tileFormat: 'xyz',
      baseUrl: `${req.protocol}://${req.get('host')}/api/tiles`,
      templateUrl: `${req.protocol}://${req.get('host')}/api/tiles/{z}/{x}/{y}`,
      description: 'Landsat 8 True Color Composite (2022)'
    });
    
  } catch (error) {
    console.error('Error getting map info:', error);
    res.status(500).json({ 
      error: 'Failed to get map info',
      message: error.message 
    });
  }
});

// Presets para EcoPlan Urbano
app.get('/api/ecoplan/presets', (req, res) => {
  res.json({
    presets: getEcoPlanPresetList()
  });
});

// Análisis EcoPlan Urbano
app.post('/api/ecoplan/analyze', async (req, res) => {
  if (!eeInitialized) {
    return res.status(503).json({
      error: 'Earth Engine not initialized'
    });
  }

  try {
    const options = req.body || {};
    const analysis = await buildEcoPlanAnalysis(options);

    const [
      ndviLayer,
      lstLayer,
      heatLayer,
      ndwiLayer,
      aodLayer,
      airLayer,
      imperviousLayer,
      waterLayer,
      greenPerCapitaLayer,
      greenDeficitLayer,
      no2Layer,
      pm25Layer,
      ndviSeries,
      lstSeries,
      aodSeries,
      no2Series,
      pm25Series,
      summary,
      roiGeoJson,
      boundaryStats
    ] = await Promise.all([
      getMapFromImage(analysis.ndviImage, {
        min: -0.2,
        max: 0.8,
        palette: ['#002651', '#0f5d2a', '#4fb043', '#f8e71c']
      }),
      getMapFromImage(analysis.lstImage, {
        min: 20,
        max: 40,
        palette: ['#0021ff', '#0ba9ff', '#74ffdc', '#f9fd6c', '#ff5e3a']
      }),
      getMapFromImage(analysis.heatImage, {
        min: -0.5,
        max: 1,
        palette: ['#2e7d32', '#fdd835', '#e53935']
      }),
      getMapFromImage(analysis.ndwiImage, {
        min: -0.1,
        max: 0.5,
        palette: ['#704214', '#0ea5e9', '#22d3ee']
      }),
      getMapFromImage(analysis.aodImage, {
        min: 0,
        max: 1.5,
        palette: ['#132a13', '#52b788', '#ffba08', '#d94801']
      }),
      getMapFromImage(analysis.airQualityImage, {
        min: 0,
        max: 1,
        palette: ['#00b3ff', '#fbbf24', '#ef4444']
      }),
      getMapFromImage(analysis.imperviousImage, {
        min: 0,
        max: 1,
        palette: ['#0ea5e9', '#facc15', '#7f1d1d']
      }),
      getMapFromImage(analysis.waterRiskImage, {
        min: 0,
        max: 1,
        palette: ['#0ea5e9', '#f97316', '#7f1d1d']
      }),
      getMapFromImage(analysis.greenPerCapitaImage, {
        min: 0,
        max: 30,
        palette: ['#7f1d1d', '#facc15', '#22c55e']
      }),
      getMapFromImage(analysis.greenDeficitImage, {
        min: 0,
        max: 1,
        palette: ['#22c55e', '#facc15', '#b91c1c']
      }),
      analysis.no2Image ? getMapFromImage(analysis.no2Image, {
        min: 0,
        max: 3e-4,
        palette: ['#0ea5e9', '#facc15', '#b91c1c']
      }) : Promise.resolve(null),
      analysis.pm25Image ? getMapFromImage(analysis.pm25Image, {
        min: 0,
        max: 80,
        palette: ['#22c55e', '#f97316', '#7f1d1d']
      }) : Promise.resolve(null),
      evaluateEeObject(analysis.ndviSeries),
      evaluateEeObject(analysis.lstSeries),
      evaluateEeObject(analysis.aodSeries),
      analysis.no2Series ? evaluateEeObject(analysis.no2Series) : Promise.resolve(null),
      analysis.pm25Series ? evaluateEeObject(analysis.pm25Series) : Promise.resolve(null),
      evaluateEeObject(analysis.summary),
      evaluateEeObject(analysis.roi),
      analysis.boundaryStats ? evaluateEeObject(analysis.boundaryStats) : Promise.resolve(null)
    ]);

    res.json({
      presetMeta: analysis.meta,
      layers: {
        ndvi: {
          ...ndviLayer,
          name: 'NDVI máximo (Sentinel-2)',
          min: -0.2,
          max: 0.8
        },
        lst: {
          ...lstLayer,
          name: 'Temperatura superficial (°C)',
          min: 20,
          max: 40
        },
        heat: {
          ...heatLayer,
          name: 'Índice de vulnerabilidad al calor',
          min: -0.5,
          max: 1
        },
        ndwi: {
          ...ndwiLayer,
          name: 'NDWI promedio',
          min: -0.1,
          max: 0.5
        },
        aod: {
          ...aodLayer,
          name: 'AOD promedio (MODIS)',
          min: 0,
          max: 1.5
        },
        airQuality: airLayer ? {
          ...airLayer,
          name: 'Índice de calidad del aire',
          min: 0,
          max: 1
        } : null,
        impervious: {
          ...imperviousLayer,
          name: 'Superficie impermeable (NDBI)',
          min: 0,
          max: 1
        },
        waterRisk: {
          ...waterLayer,
          name: 'Riesgo hídrico compuesto',
          min: 0,
          max: 1
        },
        greenPerCapita: {
          ...greenPerCapitaLayer,
          name: 'm² de áreas verdes por habitante',
          min: 0,
          max: 30
        },
        greenDeficit: {
          ...greenDeficitLayer,
          name: 'Déficit de áreas verdes (1 = déficit)',
          min: 0,
          max: 1
        },
        no2: no2Layer ? {
          ...no2Layer,
          name: 'NO₂ troposférico (S5P)',
          min: 0,
          max: 3e-4
        } : null,
        pm25: pm25Layer ? {
          ...pm25Layer,
          name: 'PM₂.₅ estimado',
          min: 0,
          max: 80
        } : null
      },
      summary,
      series: {
        ndvi: ndviSeries?.features || [],
        lst: lstSeries?.features || [],
        aod: aodSeries?.features || [],
        no2: no2Series?.features || [],
        pm25: pm25Series?.features || []
      },
      indices: {
        heat_vulnerability: summary?.heat_mean ?? null,
        air_quality: summary?.air_quality_mean ?? null,
        green_deficit: summary?.green_deficit_ratio ?? null,
        water_risk: summary?.water_risk_mean ?? null,
        green_per_capita: summary?.green_per_capita_mean ?? null
      },
      boundaryStats,
      roi: roiGeoJson,
      request: options
    });
  } catch (error) {
    console.error('Error generating EcoPlan analysis:', error);
    res.status(500).json({
      error: 'Failed to generate EcoPlan analysis',
      message: error.message
    });
  }
});

// ============================================================================
// ENDPOINTS DE REPORTES CIUDADANOS (Fase 1)
// ============================================================================

/**
 * @swagger
 * /api/citizen-reports:
 *   get:
 *     summary: Listar reportes ciudadanos
 *     description: Obtiene una lista de reportes ambientales enviados por ciudadanos. Soporta filtros por estado, categoría y bounding box geográfico.
 *     tags: [Reportes Ciudadanos]
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 500
 *           default: 100
 *         description: Número máximo de reportes a retornar
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, validated, rejected]
 *         description: Filtrar por estado de validación
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *           enum: [heat, green, flooding, waste, air, water, other]
 *         description: Filtrar por categoría de problema ambiental
 *       - in: query
 *         name: bbox
 *         schema:
 *           type: string
 *           example: "-77.1,-12.2,-76.9,-12.0"
 *         description: Bounding box en formato "minLon,minLat,maxLon,maxLat"
 *     responses:
 *       200:
 *         description: Lista de reportes
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 reports:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/CitizenReport'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
app.get('/api/citizen-reports', async (req, res) => {
  try {
    const { limit, status, category, bbox } = req.query || {};
    const options = {};

    if (limit !== undefined) {
      const parsedLimit = Number(limit);
      if (Number.isFinite(parsedLimit)) {
        options.limit = Math.max(1, Math.min(parsedLimit, 500));
      }
    }

    if (status && typeof status === 'string') {
      options.status = status.trim().toLowerCase();
    }

    if (category && typeof category === 'string') {
      options.category = category.trim().toLowerCase();
    }

    if (bbox && typeof bbox === 'string') {
      const parts = bbox.split(',').map((value) => Number(value.trim()));
      if (parts.length === 4 && parts.every((value) => Number.isFinite(value))) {
        options.bbox = parts;
      }
    }

    const reports = await citizenReportsRepository.listReports(options);
    res.json({
      reports: (reports || []).map(mapCitizenReportToResponse)
    });
  } catch (error) {
    console.error('Error en GET /api/citizen-reports:', error);
    res.status(500).json({ error: 'No se pudo obtener el listado de reportes' });
  }
});

/**
 * @swagger
 * /api/citizen-reports:
 *   post:
 *     summary: Crear un nuevo reporte ciudadano
 *     description: Permite a un ciudadano reportar un problema ambiental con foto, ubicación GPS y descripción.
 *     tags: [Reportes Ciudadanos]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - category
 *               - latitude
 *               - longitude
 *             properties:
 *               category:
 *                 type: string
 *                 enum: [heat, green, flooding, waste, air, water, other]
 *                 example: heat
 *               latitude:
 *                 type: number
 *                 format: float
 *                 example: -12.0464
 *               longitude:
 *                 type: number
 *                 format: float
 *                 example: -77.0428
 *               description:
 *                 type: string
 *                 maxLength: 2000
 *                 example: "Fuerte calor en la esquina sin sombra"
 *               photoUrl:
 *                 type: string
 *                 format: uri
 *                 example: "https://storage.googleapis.com/ecoplan/photos/abc123.jpg"
 *     responses:
 *       201:
 *         description: Reporte creado exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                   format: uuid
 *                 message:
 *                   type: string
 *                   example: "Reporte creado exitosamente"
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
app.post('/api/citizen-reports', async (req, res) => {
  try {
    const payload = req.body || {};
    const { errors, data } = validateCitizenReportPayload(payload);

    if (errors.length) {
      return res.status(400).json({ errors });
    }

    const report = await citizenReportsRepository.createReport(data, { logger: console });
    if (!report) {
      return res.status(500).json({ error: 'No se pudo registrar el reporte' });
    }

    res.status(201).json({ report: mapCitizenReportToResponse(report) });
  } catch (error) {
    console.error('Error en POST /api/citizen-reports:', error);
    res.status(500).json({ error: 'No se pudo registrar el reporte' });
  }
});

// ============================================================================
// ENDPOINTS DE VALIDACIÓN COMUNITARIA
// ============================================================================

/**
 * POST /api/citizen-reports/:id/validate
 * Aplica una validación comunitaria a un reporte
 */
app.post('/api/citizen-reports/:id/validate', async (req, res) => {
  try {
    const reportId = parseInt(req.params.id, 10);
    if (!Number.isFinite(reportId)) {
      return res.status(400).json({ error: 'ID de reporte inválido' });
    }

    const { validationType, comment, newSeverity, duplicateOf } = req.body;
    
    // Validar tipo de validación
    const validTypes = ['confirm', 'reject', 'duplicate', 'update_severity'];
    if (!validTypes.includes(validationType)) {
      return res.status(400).json({ 
        error: 'Tipo de validación inválido',
        validTypes 
      });
    }

    // Validar severidad si se proporciona
    if (validationType === 'update_severity') {
      const validSeverities = ['low', 'medium', 'high'];
      if (!newSeverity || !validSeverities.includes(newSeverity)) {
        return res.status(400).json({ 
          error: 'Severidad inválida para update_severity',
          validSeverities 
        });
      }
    }

    // Identificador de usuario (IP hash o session)
    const userIdentifier = req.headers['x-forwarded-for'] || 
                          req.connection.remoteAddress || 
                          req.headers['user-agent'] || 
                          'anonymous';

    // Obtener todos los reportes (en producción esto sería una consulta DB)
    const allReports = await citizenReportsRepository.listReports({});
    
    // Aplicar validación
    const result = await reportValidationService.applyValidation({
      reportId,
      userIdentifier,
      validationType,
      comment,
      newSeverity,
      duplicateOf,
      reports: allReports
    });

    if (!result.success) {
      return res.status(400).json(result);
    }

    // Si el estado cambió, actualizar en el repositorio
    if (result.statusChanged) {
      const updatedReport = allReports.find(r => r.id === reportId);
      // En producción: await citizenReportsRepository.updateReport(reportId, updatedReport);
    }

    res.json(result);
  } catch (error) {
    console.error('Error en POST /api/citizen-reports/:id/validate:', error);
    res.status(500).json({ error: 'No se pudo procesar la validación' });
  }
});

/**
 * POST /api/citizen-reports/:id/moderate
 * Validación directa por moderador
 */
app.post('/api/citizen-reports/:id/moderate', async (req, res) => {
  try {
    const reportId = parseInt(req.params.id, 10);
    if (!Number.isFinite(reportId)) {
      return res.status(400).json({ error: 'ID de reporte inválido' });
    }

    const { moderatorIdentifier, newStatus, reason, newSeverity, duplicateOf } = req.body;
    
    if (!moderatorIdentifier) {
      return res.status(400).json({ error: 'Se requiere moderatorIdentifier' });
    }

    const validStatuses = ['moderator_validated', 'rejected', 'duplicate'];
    if (!validStatuses.includes(newStatus)) {
      return res.status(400).json({ 
        error: 'Estado inválido',
        validStatuses 
      });
    }

    const allReports = await citizenReportsRepository.listReports({});
    
    const result = await reportValidationService.moderatorValidate({
      reportId,
      moderatorIdentifier,
      newStatus,
      reason,
      newSeverity,
      duplicateOf,
      reports: allReports
    });

    if (!result.success) {
      return res.status(result.error.includes('moderador') ? 403 : 400).json(result);
    }

    res.json(result);
  } catch (error) {
    console.error('Error en POST /api/citizen-reports/:id/moderate:', error);
    res.status(500).json({ error: 'No se pudo procesar la moderación' });
  }
});

/**
 * GET /api/citizen-reports/:id/duplicates
 * Detecta reportes duplicados potenciales
 */
app.get('/api/citizen-reports/:id/duplicates', async (req, res) => {
  try {
    const reportId = parseInt(req.params.id, 10);
    if (!Number.isFinite(reportId)) {
      return res.status(400).json({ error: 'ID de reporte inválido' });
    }

    const allReports = await citizenReportsRepository.listReports({});
    const duplicates = reportValidationService.detectDuplicates(reportId, allReports);

    res.json({
      reportId,
      duplicatesFound: duplicates.length,
      duplicates: duplicates.map(d => ({
        ...d,
        report: mapCitizenReportToResponse(d.report)
      }))
    });
  } catch (error) {
    console.error('Error en GET /api/citizen-reports/:id/duplicates:', error);
    res.status(500).json({ error: 'No se pudo detectar duplicados' });
  }
});

/**
 * GET /api/citizen-reports/:id/history
 * Obtiene el historial de cambios de un reporte
 */
app.get('/api/citizen-reports/:id/history', async (req, res) => {
  try {
    const reportId = parseInt(req.params.id, 10);
    if (!Number.isFinite(reportId)) {
      return res.status(400).json({ error: 'ID de reporte inválido' });
    }

    const history = reportValidationService.getChangeHistory(reportId);
    const validations = reportValidationService.getReportValidations(reportId);

    res.json({
      reportId,
      history,
      validations: validations.map(v => ({
        ...v,
        userIdentifier: v.userIdentifier.substring(0, 8) + '...' // Ofuscar para privacidad
      }))
    });
  } catch (error) {
    console.error('Error en GET /api/citizen-reports/:id/history:', error);
    res.status(500).json({ error: 'No se pudo obtener el historial' });
  }
});

/**
 * GET /api/citizen-reports/:id/stats
 * Obtiene estadísticas detalladas de validación de un reporte
 */
app.get('/api/citizen-reports/:id/stats', async (req, res) => {
  try {
    const reportId = parseInt(req.params.id, 10);
    if (!Number.isFinite(reportId)) {
      return res.status(400).json({ error: 'ID de reporte inválido' });
    }

    const allReports = await citizenReportsRepository.listReports({});
    const stats = reportValidationService.getReportWithValidationStats(reportId, allReports);

    if (!stats) {
      return res.status(404).json({ error: 'Reporte no encontrado' });
    }

    res.json(stats);
  } catch (error) {
    console.error('Error en GET /api/citizen-reports/:id/stats:', error);
    res.status(500).json({ error: 'No se pudo obtener estadísticas' });
  }
});

/**
 * GET /api/validation/metrics
 * Obtiene métricas globales de validación
 */
app.get('/api/validation/metrics', async (req, res) => {
  try {
    const allReports = await citizenReportsRepository.listReports({});
    const metrics = reportValidationService.getValidationMetrics(allReports);

    res.json(metrics);
  } catch (error) {
    console.error('Error en GET /api/validation/metrics:', error);
    res.status(500).json({ error: 'No se pudo obtener métricas' });
  }
});

/**
 * GET /api/validation/moderators
 * Lista de moderadores activos
 */
app.get('/api/validation/moderators', async (req, res) => {
  try {
    const moderators = reportValidationService.getModerators();
    
    res.json({
      moderators: moderators.map(m => ({
        identifier: m.identifier,
        name: m.name,
        role: m.role,
        active: m.active,
        lastActivity: m.lastActivity
      }))
    });
  } catch (error) {
    console.error('Error en GET /api/validation/moderators:', error);
    res.status(500).json({ error: 'No se pudo obtener moderadores' });
  }
});

// ============================================================================
// FIN ENDPOINTS DE VALIDACIÓN COMUNITARIA
// ============================================================================

// ============================================================================
// MICRO-ENCUESTAS DE 1 CLIC
// ============================================================================
const microSurveyService = require('./services/microSurveyService');

/**
 * GET /api/citizen-reports/:id/survey/questions
 * Obtiene preguntas de micro-encuesta aplicables para un reporte
 */
app.get('/api/citizen-reports/:id/survey/questions', async (req, res) => {
  try {
    const reportId = parseInt(req.params.id, 10);
    if (!Number.isFinite(reportId)) {
      return res.status(400).json({ error: 'ID de reporte inválido' });
    }

    // Obtener reporte para conocer su categoría
    const allReports = await citizenReportsRepository.listReports({});
    const report = allReports.find(r => r.id === reportId);
    
    if (!report) {
      return res.status(404).json({ error: 'Reporte no encontrado' });
    }

    // Obtener preguntas aplicables
    const questions = microSurveyService.getQuestionsForReport(report.category);
    
    // Obtener progreso actual
    const progress = microSurveyService.getReportProgress(reportId, report.category);
    
    // Obtener respuestas existentes
    const existingResponses = microSurveyService.getReportResponses(reportId);

    res.json({
      reportId,
      category: report.category,
      questions,
      progress,
      existingResponses
    });
  } catch (error) {
    console.error('Error en GET /api/citizen-reports/:id/survey/questions:', error);
    res.status(500).json({ error: 'No se pudo obtener preguntas' });
  }
});

/**
 * POST /api/citizen-reports/:id/survey/respond
 * Registra respuesta de micro-encuesta
 * 
 * Body: {
 *   questionKey: 'duration',
 *   selectedOption: 'days',
 *   userIdentifier: 'device-uuid-or-ip',
 *   latitude: -12.0464,
 *   longitude: -77.0428
 * }
 */
app.post('/api/citizen-reports/:id/survey/respond', async (req, res) => {
  try {
    const reportId = parseInt(req.params.id, 10);
    if (!Number.isFinite(reportId)) {
      return res.status(400).json({ error: 'ID de reporte inválido' });
    }

    const { questionKey, selectedOption, userIdentifier, latitude, longitude } = req.body;

    // Validaciones
    if (!questionKey || !selectedOption) {
      return res.status(400).json({ 
        error: 'Faltan campos requeridos: questionKey, selectedOption' 
      });
    }

    if (!userIdentifier) {
      return res.status(400).json({ 
        error: 'Se requiere identificador de usuario (device ID o IP)' 
      });
    }

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return res.status(400).json({ 
        error: 'Coordenadas inválidas' 
      });
    }

    // Registrar respuesta
    const result = await microSurveyService.recordResponse({
      reportId,
      questionKey,
      selectedOption,
      userIdentifier,
      latitude,
      longitude
    });

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    // Respuesta con datos para el UX
    res.json({
      success: true,
      isNewResponse: result.isNewResponse,
      message: result.isNewResponse 
        ? '¡Gracias por tu respuesta!' 
        : 'Respuesta actualizada',
      neighborhood: result.neighborhood,
      district: result.district,
      progress: result.progress,
      neighborhoodStats: result.neighborhoodStats
    });
  } catch (error) {
    console.error('Error en POST /api/citizen-reports/:id/survey/respond:', error);
    res.status(500).json({ error: 'No se pudo registrar la respuesta' });
  }
});

/**
 * GET /api/surveys/neighborhood/:name/progress
 * Obtiene progreso de respuestas en un barrio
 */
app.get('/api/surveys/neighborhood/:name/progress', async (req, res) => {
  try {
    const neighborhood = decodeURIComponent(req.params.name);
    const stats = microSurveyService.getNeighborhoodStats(neighborhood);

    res.json({
      neighborhood,
      ...stats
    });
  } catch (error) {
    console.error('Error en GET /api/surveys/neighborhood/:name/progress:', error);
    res.status(500).json({ error: 'No se pudo obtener progreso del barrio' });
  }
});

/**
 * GET /api/surveys/neighborhood/:name/results
 * Obtiene resultados agregados de un barrio
 */
app.get('/api/surveys/neighborhood/:name/results', async (req, res) => {
  try {
    const neighborhood = decodeURIComponent(req.params.name);
    const aggregations = microSurveyService.getNeighborhoodAggregations(neighborhood);
    const stats = microSurveyService.getNeighborhoodStats(neighborhood);

    res.json({
      neighborhood,
      stats,
      aggregations
    });
  } catch (error) {
    console.error('Error en GET /api/surveys/neighborhood/:name/results:', error);
    res.status(500).json({ error: 'No se pudo obtener resultados del barrio' });
  }
});

/**
 * GET /api/surveys/metrics
 * Obtiene métricas globales de micro-encuestas
 */
app.get('/api/surveys/metrics', async (req, res) => {
  try {
    const metrics = microSurveyService.getGlobalMetrics();
    const topNeighborhoods = microSurveyService.getTopNeighborhoods(10);

    res.json({
      metrics,
      topNeighborhoods
    });
  } catch (error) {
    console.error('Error en GET /api/surveys/metrics:', error);
    res.status(500).json({ error: 'No se pudo obtener métricas' });
  }
});

/**
 * GET /api/surveys/templates
 * Obtiene todas las plantillas de preguntas
 */
app.get('/api/surveys/templates', async (req, res) => {
  try {
    const category = req.query.category || null;
    const templates = microSurveyService.getTemplates(category);

    res.json({
      templates,
      totalQuestions: templates.length
    });
  } catch (error) {
    console.error('Error en GET /api/surveys/templates:', error);
    res.status(500).json({ error: 'No se pudo obtener plantillas' });
  }
});

// ============================================================================
// FIN ENDPOINTS DE MICRO-ENCUESTAS
// ============================================================================

// ============================================================================
// DESCARGAS ABIERTAS (CSV/GeoJSON)
// ============================================================================
const dataExportService = require('./services/dataExportService');

/**
 * GET /api/exports/layers
 * Lista capas disponibles para descarga
 */
app.get('/api/exports/layers', async (req, res) => {
  try {
    const layers = dataExportService.getAvailableLayers();
    
    res.json({
      layers,
      totalLayers: layers.length
    });
  } catch (error) {
    console.error('Error en GET /api/exports/layers:', error);
    res.status(500).json({ error: 'No se pudo obtener capas' });
  }
});

/**
 * GET /api/exports/download
 * Descarga datos en formato especificado
 * 
 * Query params:
 *   - layer: ID de la capa (citizen-reports, validated-reports, etc.)
 *   - format: csv o geojson
 *   - startDate: Fecha inicio (opcional)
 *   - endDate: Fecha fin (opcional)
 *   - category: Filtrar por categoría (opcional)
 *   - validationStatus: Filtrar por estado validación (opcional)
 *   - onlyValidated: true/false (opcional)
 */
app.get('/api/exports/download', async (req, res) => {
  try {
    const {
      layer: layerId,
      format,
      startDate,
      endDate,
      category,
      validationStatus,
      severity,
      status,
      onlyValidated
    } = req.query;

    // Validaciones
    if (!layerId) {
      return res.status(400).json({ error: 'Parámetro "layer" requerido' });
    }

    if (!format || !['csv', 'geojson'].includes(format)) {
      return res.status(400).json({ 
        error: 'Parámetro "format" debe ser "csv" o "geojson"' 
      });
    }

    // Obtener datos según la capa
    let data;
    let filename;
    let contentType;
    let recordCount = 0;

    // Preparar criterios de filtrado
    const filterCriteria = {
      category,
      startDate,
      endDate,
      validationStatus,
      severity,
      status,
      onlyValidated: onlyValidated === 'true'
    };

    if (layerId.includes('reports')) {
      // Capas de reportes ciudadanos
      const allReports = await citizenReportsRepository.listReports({});
      let reports = allReports;

      // Filtrar por categoría específica si la capa lo indica
      if (layerId === 'heat-reports') {
        filterCriteria.category = 'heat';
      } else if (layerId === 'green-reports') {
        filterCriteria.category = 'green';
      } else if (layerId === 'flooding-reports') {
        filterCriteria.category = 'flooding';
      } else if (layerId === 'waste-reports') {
        filterCriteria.category = 'waste';
      } else if (layerId === 'validated-reports') {
        filterCriteria.onlyValidated = true;
      }

      // Aplicar filtros
      reports = dataExportService.filterReports(reports, filterCriteria);
      recordCount = reports.length;

      // Enriquecer con datos de validación
      const enrichedReports = reports.map(report => {
        const validations = reportValidationService.getReportValidations(report.id);
        const confirmations = validations.filter(v => v.vote === 'confirm').length;
        const rejections = validations.filter(v => v.vote === 'reject').length;
        
        return {
          ...report,
          confirmations,
          rejections,
          validationStatus: report.status === 'confirmed' ? 'confirmed' : 
                           report.status === 'rejected' ? 'rejected' : 'pending',
          moderatorValidated: false // TODO: implementar lógica de moderador
        };
      });

      if (format === 'csv') {
        data = dataExportService.exportReportsToCSV(enrichedReports, {
          includeValidation: true,
          includePhotos: true
        });
        contentType = 'text/csv; charset=utf-8';
        filename = `ecoplan-${layerId}-${new Date().toISOString().split('T')[0]}.csv`;
      } else {
        data = JSON.stringify(
          dataExportService.exportReportsToGeoJSON(enrichedReports, {
            includeValidation: true,
            includePhotos: true
          }),
          null,
          2
        );
        contentType = 'application/geo+json; charset=utf-8';
        filename = `ecoplan-${layerId}-${new Date().toISOString().split('T')[0]}.geojson`;
      }
    } else if (layerId === 'neighborhood-aggregations') {
      // Agregaciones por barrio (simulado - en producción vendría de la BD)
      const neighborhoods = [
        {
          neighborhood: 'San Isidro Centro',
          district: 'San Isidro',
          totalReports: 15,
          heatReports: 8,
          greenReports: 4,
          floodingReports: 2,
          wasteReports: 1,
          validatedReports: 12,
          surveyResponseRate: 75,
          lastActivity: new Date().toISOString()
        }
        // TODO: Obtener agregaciones reales
      ];

      recordCount = neighborhoods.length;

      if (format === 'csv') {
        data = dataExportService.exportNeighborhoodAggregationsToCSV(neighborhoods);
        contentType = 'text/csv; charset=utf-8';
        filename = `ecoplan-${layerId}-${new Date().toISOString().split('T')[0]}.csv`;
      } else {
        return res.status(400).json({ 
          error: 'GeoJSON no disponible para agregaciones de barrio' 
        });
      }
    } else if (layerId === 'survey-results') {
      // Resultados de micro-encuestas
      const surveyResults = [
        {
          neighborhood: 'San Isidro Centro',
          aggregations: microSurveyService.getNeighborhoodAggregations('San Isidro Centro')
        }
        // TODO: Obtener todos los barrios
      ];

      recordCount = surveyResults.length;

      if (format === 'csv') {
        data = dataExportService.exportSurveyResultsToCSV(surveyResults);
        contentType = 'text/csv; charset=utf-8';
        filename = `ecoplan-${layerId}-${new Date().toISOString().split('T')[0]}.csv`;
      } else {
        return res.status(400).json({ 
          error: 'GeoJSON no disponible para resultados de encuestas' 
        });
      }
    } else {
      return res.status(404).json({ error: 'Capa no encontrada' });
    }

    // Registrar descarga
    const downloadId = dataExportService.registerDownload({
      layerId,
      format,
      recordCount,
      filterCriteria,
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    // Enviar respuesta con headers apropiados
    res.set({
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="${filename}"`,
      'X-Download-ID': downloadId,
      'X-Record-Count': recordCount,
      'X-Generated': new Date().toISOString()
    });

    res.send(data);
  } catch (error) {
    console.error('Error en GET /api/exports/download:', error);
    res.status(500).json({ error: 'No se pudo generar la descarga' });
  }
});

/**
 * GET /api/exports/stats
 * Obtiene estadísticas de descargas
 */
app.get('/api/exports/stats', async (req, res) => {
  try {
    const { startDate, endDate, layerId, format } = req.query;
    
    const stats = dataExportService.getDownloadStats({
      startDate,
      endDate,
      layerId,
      format
    });

    const topLayers = dataExportService.getTopLayers(5);

    res.json({
      stats,
      topLayers
    });
  } catch (error) {
    console.error('Error en GET /api/exports/stats:', error);
    res.status(500).json({ error: 'No se pudo obtener estadísticas' });
  }
});

/**
 * GET /api/exports/metadata/:layerId
 * Obtiene metadatos de una capa
 */
app.get('/api/exports/metadata/:layerId', async (req, res) => {
  try {
    const { layerId } = req.params;
    const { format } = req.query;

    if (!format || !['csv', 'geojson'].includes(format)) {
      return res.status(400).json({ 
        error: 'Parámetro "format" debe ser "csv" o "geojson"' 
      });
    }

    // Obtener conteo de registros
    let recordCount = 0;
    if (layerId.includes('reports')) {
      const allReports = await citizenReportsRepository.listReports({});
      recordCount = allReports.length;
    }

    const metadata = dataExportService.generateDownloadMetadata(
      layerId,
      format,
      recordCount
    );

    res.json(metadata);
  } catch (error) {
    console.error('Error en GET /api/exports/metadata/:layerId:', error);
    res.status(500).json({ error: 'No se pudo obtener metadatos' });
  }
});

// ============================================================================
// FIN ENDPOINTS DE DESCARGAS ABIERTAS
// ============================================================================

// ============================================================================
// MI BARRIO - ANÁLISIS POR BARRIO CON SEMÁFOROS (Fase 6)
// ============================================================================
const neighborhoodAnalysisService = require('./services/neighborhoodAnalysisService');

/**
 * @swagger
 * /api/neighborhoods:
 *   get:
 *     summary: Listar barrios disponibles
 *     description: Retorna la lista de 12 barrios de Lima con análisis ambiental disponible
 *     tags: [Análisis de Barrios]
 *     responses:
 *       200:
 *         description: Lista de barrios
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 neighborhoods:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         example: "san-juan-lurigancho"
 *                       name:
 *                         type: string
 *                         example: "San Juan de Lurigancho"
 *                       population:
 *                         type: integer
 *                         example: 1091303
 *                 total:
 *                   type: integer
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
app.get('/api/neighborhoods', async (req, res) => {
  try {
    const neighborhoods = neighborhoodAnalysisService.getNeighborhoods();
    res.json({
      neighborhoods,
      total: neighborhoods.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error en GET /api/neighborhoods:', error);
    res.status(500).json({ error: 'No se pudo obtener lista de barrios' });
  }
});

/**
 * @swagger
 * /api/neighborhoods/{neighborhoodId}/analysis:
 *   get:
 *     summary: Análisis completo de un barrio (Mi Barrio)
 *     description: Retorna indicadores ambientales con semáforos 🟢🟡🔴 para un barrio específico. Incluye temperatura, vegetación, calidad del aire, agua, biodiversidad y recomendaciones personalizadas.
 *     tags: [Análisis de Barrios]
 *     parameters:
 *       - in: path
 *         name: neighborhoodId
 *         required: true
 *         schema:
 *           type: string
 *           example: "san-juan-lurigancho"
 *         description: ID del barrio (slug)
 *     responses:
 *       200:
 *         description: Análisis completo del barrio
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/NeighborhoodAnalysis'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       503:
 *         description: Earth Engine no disponible
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
app.get('/api/neighborhoods/:neighborhoodId/analysis', async (req, res) => {
  try {
    const { neighborhoodId } = req.params;
    
    if (!eeInitialized) {
      return res.status(503).json({
        error: 'Earth Engine no está inicializado',
        message: 'Por favor espera unos segundos e intenta nuevamente'
      });
    }

    const analysis = await neighborhoodAnalysisService.analyzeNeighborhood(neighborhoodId);
    
    res.json(analysis);
  } catch (error) {
    console.error(`Error en GET /api/neighborhoods/${req.params.neighborhoodId}/analysis:`, error);
    
    if (error.message === 'Barrio no encontrado') {
      return res.status(404).json({ error: error.message });
    }
    
    res.status(500).json({ 
      error: 'No se pudo analizar el barrio',
      message: error.message 
    });
  }
});

/**
 * GET /api/neighborhoods/compare
 * Compara múltiples barrios (máx 5)
 */
app.get('/api/neighborhoods/compare', async (req, res) => {
  try {
    const neighborhoodIds = req.query.ids?.split(',') || [];
    
    if (neighborhoodIds.length === 0) {
      return res.status(400).json({ 
        error: 'Parámetro "ids" requerido',
        example: '/api/neighborhoods/compare?ids=miraflores,san-isidro,surco'
      });
    }

    if (neighborhoodIds.length > 5) {
      return res.status(400).json({ 
        error: 'Máximo 5 barrios permitidos para comparación'
      });
    }

    if (!eeInitialized) {
      return res.status(503).json({
        error: 'Earth Engine no está inicializado'
      });
    }

    // Analizar todos los barrios en paralelo
    const analyses = await Promise.all(
      neighborhoodIds.map(id => neighborhoodAnalysisService.analyzeNeighborhood(id))
    );

    // Calcular rankings
    const rankings = {
      vegetation: analyses.sort((a, b) => b.indices.vegetation.value - a.indices.vegetation.value),
      heat: analyses.sort((a, b) => a.indices.heat.value - b.indices.heat.value),
      air: analyses.sort((a, b) => a.indices.air.value - b.indices.air.value),
      water: analyses.sort((a, b) => b.indices.water.value - a.indices.water.value),
      overall: analyses.sort((a, b) => b.overallScore - a.overallScore)
    };

    res.json({
      neighborhoods: analyses,
      rankings: {
        vegetation: rankings.vegetation.map((a, i) => ({ rank: i + 1, id: a.neighborhood.id, name: a.neighborhood.name, value: a.indices.vegetation.value })),
        heat: rankings.heat.map((a, i) => ({ rank: i + 1, id: a.neighborhood.id, name: a.neighborhood.name, value: a.indices.heat.value })),
        air: rankings.air.map((a, i) => ({ rank: i + 1, id: a.neighborhood.id, name: a.neighborhood.name, value: a.indices.air.value })),
        water: rankings.water.map((a, i) => ({ rank: i + 1, id: a.neighborhood.id, name: a.neighborhood.name, value: a.indices.water.value })),
        overall: rankings.overall.map((a, i) => ({ rank: i + 1, id: a.neighborhood.id, name: a.neighborhood.name, score: a.overallScore }))
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error en GET /api/neighborhoods/compare:', error);
    res.status(500).json({ 
      error: 'No se pudo comparar barrios',
      message: error.message 
    });
  }
});

// ============================================================================
// FIN ENDPOINTS DE MI BARRIO
// ============================================================================

// ============================================================================
// SIMULADOR DE ESCENARIOS ("¿Y SI...?") - Fase 7
// ============================================================================
const scenarioSimulatorService = require('./services/scenarioSimulatorService');

/**
 * @swagger
 * /api/simulator/interventions:
 *   get:
 *     summary: Listar tipos de intervención disponibles
 *     description: Retorna los 4 tipos de intervenciones ambientales que se pueden simular (parques urbanos, techos verdes, pintura reflectiva, plantación de árboles)
 *     tags: [Simulador]
 *     responses:
 *       200:
 *         description: Lista de intervenciones
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 interventions:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         example: "urban_park"
 *                       name:
 *                         type: string
 *                         example: "Parque Urbano"
 *                       description:
 *                         type: string
 *                       unit:
 *                         type: string
 *                         example: "hectáreas"
 *                       icon:
 *                         type: string
 *                         example: "🌳"
 *                 total:
 *                   type: integer
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
app.get('/api/simulator/interventions', (req, res) => {
  try {
    const interventions = scenarioSimulatorService.getInterventionTypes();
    res.json({
      interventions,
      total: interventions.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error en GET /api/simulator/interventions:', error);
    res.status(500).json({ error: 'No se pudo obtener tipos de intervención' });
  }
});

/**
 * @swagger
 * /api/simulator/simulate:
 *   post:
 *     summary: Simular impacto de una intervención ambiental
 *     description: Calcula el impacto estimado de una intervención (parque, techos verdes, etc.) usando coeficientes científicos. Retorna reducción de temperatura, aumento de vegetación, mejora de calidad del aire, y más.
 *     tags: [Simulador]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - interventionType
 *               - area
 *             properties:
 *               interventionType:
 *                 type: string
 *                 enum: [urban_park, green_roof, cool_paint, tree_planting]
 *                 example: "urban_park"
 *               area:
 *                 type: number
 *                 format: float
 *                 example: 1.5
 *                 description: "Área en hectáreas (o número de unidades según tipo)"
 *               neighborhoodId:
 *                 type: string
 *                 example: "san-juan-lurigancho"
 *                 description: "Opcional: contextualiza recomendaciones al barrio"
 *     responses:
 *       200:
 *         description: Simulación exitosa
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SimulationResult'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
app.post('/api/simulator/simulate', (req, res) => {
  try {
    const { interventionType, area, neighborhoodId } = req.body;

    if (!interventionType || area === undefined) {
      return res.status(400).json({
        error: 'Parámetros requeridos: interventionType, area'
      });
    }

    const simulation = scenarioSimulatorService.simulateIntervention(
      interventionType,
      parseFloat(area),
      neighborhoodId
    );

    res.json(simulation);
  } catch (error) {
    console.error('Error en POST /api/simulator/simulate:', error);
    
    if (error.message.includes('no válido') || error.message.includes('fuera de rango')) {
      return res.status(400).json({ error: error.message });
    }
    
    res.status(500).json({ 
      error: 'No se pudo simular la intervención',
      message: error.message 
    });
  }
});

/**
 * POST /api/simulator/compare
 * Compara múltiples escenarios
 * 
 * Body: {
 *   scenarios: [
 *     { interventionType, area, neighborhoodId? },
 *     ...
 *   ]
 * }
 */
app.post('/api/simulator/compare', (req, res) => {
  try {
    const { scenarios } = req.body;

    if (!scenarios || !Array.isArray(scenarios)) {
      return res.status(400).json({
        error: 'Se requiere array "scenarios" con 2-4 escenarios'
      });
    }

    const comparison = scenarioSimulatorService.compareScenarios(scenarios);
    res.json(comparison);
  } catch (error) {
    console.error('Error en POST /api/simulator/compare:', error);
    
    if (error.message.includes('entre 2 y 4')) {
      return res.status(400).json({ error: error.message });
    }
    
    res.status(500).json({ 
      error: 'No se pudo comparar escenarios',
      message: error.message 
    });
  }
});

/**
 * GET /api/simulator/recommended/:neighborhoodId
 * Obtiene escenarios recomendados para un barrio
 */
app.get('/api/simulator/recommended/:neighborhoodId', (req, res) => {
  try {
    const { neighborhoodId } = req.params;
    
    const scenarios = scenarioSimulatorService.getRecommendedScenarios(neighborhoodId);
    
    res.json({
      neighborhoodId,
      scenarios,
      total: scenarios.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error(`Error en GET /api/simulator/recommended/${req.params.neighborhoodId}:`, error);
    
    if (error.message === 'Barrio no encontrado') {
      return res.status(404).json({ error: error.message });
    }
    
    res.status(500).json({ 
      error: 'No se pudo obtener escenarios recomendados',
      message: error.message 
    });
  }
});

// ============================================================================
// FIN ENDPOINTS DEL SIMULADOR
// ============================================================================

// Generación de reportes EcoPlan
app.post('/api/reports/generate', async (req, res) => {
    if (!eeInitialized) {
      return res.status(503).json({
        error: 'Earth Engine not initialized'
      });
    }

    try {
      const options = req.body || {};
      const requestedFormat = req.query?.format || options.format;
      const {
        format: _ignored,
        delivery = {},
        ...analysisOptions
      } = options;
      const format = typeof requestedFormat === 'string' ? requestedFormat.toLowerCase() : 'json';

      const report = await generateEcoPlanReport(analysisOptions);
      const presetId = report?.preset?.id || analysisOptions?.preset || 'urbano';
      const filenameBase = `ecoplan-report-${presetId.replace(/[^a-z0-9-_]/gi, '_')}`;

      let payloadBuffer = null;
      let bodyToSend = null;
      let contentType = 'application/json; charset=utf-8';
      let sendResponse;
      let extension = 'json';

      if (format === 'csv') {
        const csv = renderEcoPlanReportCsv(report);
        payloadBuffer = Buffer.from(csv, 'utf8');
        bodyToSend = csv;
        contentType = 'text/csv; charset=utf-8';
        extension = 'csv';
        sendResponse = () => {
          const filename = `${filenameBase}.csv`;
          res.set({
            'Content-Type': contentType,
            'Content-Disposition': `attachment; filename="${filename}"`
          });
          res.send(bodyToSend);
        };
      } else if (format === 'html') {
        const html = renderEcoPlanReportHtml(report);
        payloadBuffer = Buffer.from(html, 'utf8');
        bodyToSend = html;
        contentType = 'text/html; charset=utf-8';
        extension = 'html';
        sendResponse = () => {
          res.set('Content-Type', contentType);
          res.send(bodyToSend);
        };
      } else if (format === 'pdf') {
        const html = renderEcoPlanReportHtml(report);
        const pdfBuffer = await renderHtmlToPdfBuffer(html, {
          format: 'A4',
          printBackground: true
        });
        payloadBuffer = pdfBuffer;
        bodyToSend = pdfBuffer;
        contentType = 'application/pdf';
        extension = 'pdf';
        sendResponse = () => {
          const filename = `${filenameBase}.pdf`;
          res.set({
            'Content-Type': contentType,
            'Content-Disposition': `attachment; filename="${filename}"`
          });
          res.send(bodyToSend);
        };
      } else {
        const jsonBody = { ...report };
        const jsonString = JSON.stringify(jsonBody, null, 2);
        payloadBuffer = Buffer.from(jsonString, 'utf8');
        bodyToSend = jsonBody;
        contentType = 'application/json; charset=utf-8';
        extension = 'json';
        sendResponse = (mutatedBody) => {
          if (mutatedBody) {
            res.json(mutatedBody);
          } else {
            res.json(jsonBody);
          }
        };
      }

      let gcsResult = null;
      const gcsConfig = delivery?.gcs;
      if (gcsConfig) {
        const bucketName = gcsConfig.bucket || process.env.REPORTS_GCS_BUCKET;
        if (!bucketName) {
          throw new Error('Debe proporcionar delivery.gcs.bucket o configurar REPORTS_GCS_BUCKET.');
        }

        const filename = `${filenameBase}.${extension}`;
        gcsResult = await uploadReportToGcs({
          content: payloadBuffer,
          contentType,
          bucketName,
          destination: gcsConfig.path,
          prefix: gcsConfig.prefix,
          metadata: {
            filename,
            format,
            preset: presetId
          },
          presetId,
          format,
          generatedAt: report.generatedAt
        });

        res.set('X-Report-Gcs-Uri', gcsResult.gsUri);
        res.set('X-Report-Gcs-Url', gcsResult.publicUrl);
      }

      if (format === 'json' && typeof sendResponse === 'function') {
        const responseBody = gcsResult ? { ...bodyToSend, delivery: { ...(bodyToSend.delivery || {}), gcs: gcsResult } } : bodyToSend;
        sendResponse(responseBody);
      } else if (typeof sendResponse === 'function') {
        sendResponse();
      } else {
        res.json(report);
      }
    } catch (error) {
      console.error('Error generating EcoPlan report:', error);
      res.status(500).json({
        error: 'Failed to generate EcoPlan report',
        message: error.message
      });
    }
  });

app.post('/api/reports/distribution/run', async (req, res) => {
  if (!DISTRIBUTION_ENABLED) {
    return res.status(503).json({
      error: 'Report distribution disabled'
    });
  }

  if (!isDistributionAuthorized(req)) {
    return res.status(401).json({
      error: 'Unauthorized'
    });
  }

  const trigger = req.headers['x-cloudscheduler'] ? 'scheduler' : 'manual';
  const { jobId, reload } = req.body || {};

  try {
    if (jobId) {
      const execution = await runDistributionJobById(jobId, {
        trigger,
        forceReload: Boolean(reload)
      });

      const statusCode = execution.status === 'not-found' ? 404 : 200;
      return res.status(statusCode).json({
        ok: execution.status !== 'not-found',
        trigger,
        manifestLoadedAt: distributionManifestLoadedAt,
        execution
      });
    }

    const manifest = loadDistributionManifest(Boolean(reload));
    if (!manifest || !Array.isArray(manifest.jobs) || !manifest.jobs.length) {
      return res.status(404).json({
        error: 'No distribution jobs configured'
      });
    }

    const defaults = manifest.defaults || {};
    const executions = [];
    for (const jobConfig of manifest.jobs) {
      const execution = await runDistributionJobConfig(jobConfig, defaults, trigger);
      executions.push(execution);
    }

    return res.json({
      ok: true,
      trigger,
      manifestLoadedAt: distributionManifestLoadedAt,
      executions
    });
  } catch (error) {
    console.error('Error al ejecutar distribución de reportes:', error);
    res.status(500).json({
      error: 'Failed to execute distribution',
      message: error.message
    });
  }
});

  app.get('/api/reports/history', async (req, res) => {
    try {
      const { jobId, status, limit } = req.query || {};
      const parsedLimit = Number.parseInt(limit, 10);
      const finalLimit = Number.isFinite(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), 200) : 50;

      const runs = await reportRunsRepository.listRuns({
        jobId: typeof jobId === 'string' && jobId.trim() ? jobId.trim() : undefined,
        status: typeof status === 'string' && status.trim() ? status.trim() : undefined,
        limit: finalLimit
      });

      res.json({
        runs,
        meta: {
          count: runs.length,
          limit: finalLimit
        }
      });
    } catch (error) {
      console.error('Error al listar historial de reportes:', error);
      res.status(500).json({
        error: 'Failed to list report history',
        message: error.message
      });
    }
  });

  app.get('/api/reports/history/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const run = await reportRunsRepository.getRun(id);

      if (!run) {
        return res.status(404).json({
          error: 'Run not found'
        });
      }

      res.json(run);
    } catch (error) {
      console.error('Error al obtener run de reportes:', error);
      res.status(500).json({
        error: 'Failed to get report run',
        message: error.message
      });
    }
  });

// Obtener presets de ROI disponibles
app.get('/api/bloom/presets', (req, res) => {
  res.json({
    presets: getPresetList()
  });
});

// Obtener capas de mapa para detección de bloom
app.post('/api/bloom/map', async (req, res) => {
  if (!eeInitialized) {
    return res.status(503).json({
      error: 'Earth Engine not initialized'
    });
  }

  try {
    const options = req.body || {};

    const bloomData = await buildBloomCollection(options);

    const [bloomMap, ndciMap, faiMap, trueColorMap] = await Promise.all([
      getMapFromImage(bloomData.bloomMask, { palette: ['#ff00ff'], min: 0, max: 1 }),
      getMapFromImage(bloomData.compositeMedian.select('NDCI'), { min: -0.3, max: 0.5, palette: ['0015ff','00fff7','fff600','ff2a00'] }),
      getMapFromImage(bloomData.compositeMedian.select('FAI'), { min: -0.03, max: 0.03, palette: ['0000ff','ffffff','ff0000'] }),
      getMapFromImage(bloomData.compositeMedian.select(['B4','B3','B2']), { min: 0.03, max: 0.3 })
    ]);

    const roiGeoJson = await evaluateEeObject(bloomData.roi);

    res.json({
      presetMeta: bloomData.meta,
      thresholds: bloomData.thresholdsEvaluated,
      layers: {
        bloom: {
          ...bloomMap,
          name: 'Bloom Mask',
          palette: ['#ff00ff']
        },
        ndci: {
          ...ndciMap,
          name: 'NDCI Median',
          palette: ['0015ff','00fff7','fff600','ff2a00'],
          min: -0.3,
          max: 0.5
        },
        fai: {
          ...faiMap,
          name: 'FAI Median',
          palette: ['0000ff','ffffff','ff0000'],
          min: -0.03,
          max: 0.03
        },
        trueColor: {
          ...trueColorMap,
          name: 'True Color'
        }
      },
      roi: roiGeoJson,
      request: {
        ...options
      }
    });
  } catch (error) {
    console.error('Error generating bloom map:', error);
    res.status(500).json({
      error: 'Failed to generate bloom layers',
      message: error.message
    });
  }
});

// Obtener estadísticas temporales de bloom
app.post('/api/bloom/stats', async (req, res) => {
  if (!eeInitialized) {
    return res.status(503).json({
      error: 'Earth Engine not initialized'
    });
  }

  try {
    const options = req.body || {};
    const bloomData = await buildBloomCollection(options);

    const areaSeries = await evaluateEeObject(bloomData.areaSeries);

    res.json({
      presetMeta: bloomData.meta,
      thresholds: bloomData.thresholdsEvaluated,
      areaSeries,
      request: options
    });
  } catch (error) {
    console.error('Error generating bloom stats:', error);
    res.status(500).json({
      error: 'Failed to generate bloom statistics',
      message: error.message
    });
  }
});

// Obtener contexto regional (clorofila/SST) alrededor del ROI
app.post('/api/bloom/context', async (req, res) => {
  if (!eeInitialized) {
    return res.status(503).json({
      error: 'Earth Engine not initialized'
    });
  }

  try {
    const options = req.body || {};
    const contextData = await buildRegionalContext(options);
    res.json({
      presetMeta: contextData.meta,
      summary: contextData.summary,
      series: contextData.series,
      layers: contextData.layers,
      contextGeometry: contextData.contextGeometry,
      request: options
    });
  } catch (error) {
    console.error('Error generating regional context:', error);
    res.status(500).json({
      error: 'Failed to generate regional context',
      message: error.message
    });
  }
});

// Obtener capas de contexto regional (MODIS / SST)
// Custom dataset endpoint with visualization parameters
app.post('/api/map/custom', async (req, res) => {
  if (!eeInitialized) {
    return res.status(503).json({ 
      error: 'Earth Engine not initialized' 
    });
  }

  try {
    const { 
      collection = 'LANDSAT/LC08/C02/T1_TOA',
      dateStart = '2022-01-01',
      dateEnd = '2023-01-01',
      bands = ['B4', 'B3', 'B2'],
      min = 0,
      max = 0.3,
      gamma = 1.4
    } = req.body;

    const image = ee.ImageCollection(collection)
      .filterDate(dateStart, dateEnd)
      .median()
      .visualize({
        bands: bands,
        min: min,
        max: max,
        gamma: gamma
      });

    const mapInfo = await getMapFromImage(image, {});

    res.json({
      mapId: mapInfo?.mapid,
      token: mapInfo?.token,
      tileUrl: mapInfo?.tileUrl,
      templateUrl: mapInfo?.tileUrl,
      configuration: {
        collection,
        dateStart,
        dateEnd,
        bands,
        min,
        max,
        gamma
      }
    });
    
  } catch (error) {
    console.error('Error creating custom map:', error);
    res.status(500).json({ 
      error: 'Failed to create custom map',
      message: error.message 
    });
  }
});

// Optional: Export to Google Cloud Storage endpoint
app.post('/api/export/gcs', async (req, res) => {
  if (!eeInitialized) {
    return res.status(503).json({ 
      error: 'Earth Engine not initialized' 
    });
  }

  try {
    const { 
      collection = 'LANDSAT/LC08/C02/T1_TOA',
      dateStart = '2022-01-01',
      dateEnd = '2023-01-01',
      bands = ['B4', 'B3', 'B2'],
      region = null, // GeoJSON geometry
      scale = 30,
      description = 'GEE_Export',
      bucketName = process.env.GCS_BUCKET_NAME
    } = req.body;

    if (!bucketName) {
      return res.status(400).json({
        error: 'GCS bucket name not configured',
        message: 'Please set GCS_BUCKET_NAME in your environment variables'
      });
    }

    // Create the image
    let image = ee.ImageCollection(collection)
      .filterDate(dateStart, dateEnd)
      .median()
      .select(bands);

    // Define export region (default to a small area if not provided)
    let exportRegion = region;
    if (!exportRegion) {
      // Default to San Francisco Bay Area
      exportRegion = ee.Geometry.Rectangle([-122.5, 37.4, -122.3, 37.8]);
    } else {
      exportRegion = ee.Geometry(region);
    }

    // Start the export task
    const exportTask = ee.batch.Export.image.toCloudStorage({
      image: image,
      description: description,
      bucket: bucketName,
      fileNamePrefix: `gee-export/${description}`,
      region: exportRegion,
      scale: scale,
      maxPixels: 1e9,
      fileFormat: 'GeoTIFF'
    });

    // Start the task
    exportTask.start();

    res.json({
      success: true,
      taskId: exportTask.id || 'unknown',
      description: description,
      bucket: bucketName,
      message: 'Export task started successfully',
      parameters: {
        collection,
        dateStart,
        dateEnd,
        bands,
        scale,
        region: exportRegion.getInfo()
      }
    });
    
  } catch (error) {
    console.error('Error starting export:', error);
    res.status(500).json({ 
      error: 'Failed to start export',
      message: error.message 
    });
  }
});

// Get export task status
app.get('/api/export/status/:taskId', async (req, res) => {
  if (!eeInitialized) {
    return res.status(503).json({ 
      error: 'Earth Engine not initialized' 
    });
  }

  try {
    const { taskId } = req.params;
    
    // Note: This is a simplified implementation
    // In a real application, you would track tasks in a database
    res.json({
      taskId: taskId,
      status: 'unknown',
      message: 'Task status tracking not fully implemented. Check Google Earth Engine Console for task status.'
    });
    
  } catch (error) {
    console.error('Error getting export status:', error);
    res.status(500).json({ 
      error: 'Failed to get export status',
      message: error.message 
    });
  }
});

// ============================================================================
// INTERVENTION RECOMMENDATIONS & PRIORITIZATION (Phase 11-12)
// ============================================================================

const interventionRecommenderService = require('./services/interventionRecommenderService');
const recommendationPdfService = require('./services/recommendationPdfService');

/**
 * @swagger
 * /api/recommendations/prioritize:
 *   get:
 *     summary: Priorizar barrios por vulnerabilidad
 *     description: Obtiene un ranking de todos los barrios ordenados por índice de vulnerabilidad usando metodología AHP/TOPSIS
 *     tags: [Recomendaciones]
 *     parameters:
 *       - in: query
 *         name: neighborhoods
 *         schema:
 *           type: string
 *         description: IDs de barrios separados por coma (opcional, por defecto todos)
 *     responses:
 *       200:
 *         description: Ranking de barrios por vulnerabilidad
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   rank:
 *                     type: integer
 *                   neighborhoodId:
 *                     type: string
 *                   neighborhoodName:
 *                     type: string
 *                   score:
 *                     type: number
 *                   classification:
 *                     type: string
 *                     enum: [critical, high, medium, low]
 *                   priority:
 *                     type: integer
 *                   population:
 *                     type: integer
 *                   breakdown:
 *                     type: object
 */
app.get('/api/recommendations/prioritize', async (req, res) => {
  try {
    const neighborhoodIds = req.query.neighborhoods 
      ? req.query.neighborhoods.split(',')
      : null;

    const ranking = await interventionRecommenderService.prioritizeNeighborhoods(neighborhoodIds);

    res.json(ranking);
  } catch (error) {
    console.error('Error prioritizing neighborhoods:', error);
    res.status(500).json({ 
      error: 'Failed to prioritize neighborhoods',
      message: error.message 
    });
  }
});

/**
 * @swagger
 * /api/recommendations/recommend/{neighborhoodId}:
 *   get:
 *     summary: Recomendar intervenciones para un barrio
 *     description: Genera recomendaciones de intervenciones ambientales priorizadas por costo-beneficio
 *     tags: [Recomendaciones]
 *     parameters:
 *       - in: path
 *         name: neighborhoodId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del barrio
 *       - in: query
 *         name: budget
 *         schema:
 *           type: number
 *           default: 1000000
 *         description: Presupuesto disponible en USD
 *       - in: query
 *         name: timeframe
 *         schema:
 *           type: integer
 *           default: 24
 *         description: Plazo de implementación en meses
 *       - in: query
 *         name: maxInterventions
 *         schema:
 *           type: integer
 *           default: 5
 *         description: Número máximo de intervenciones a recomendar
 *     responses:
 *       200:
 *         description: Recomendaciones de intervenciones
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 neighborhoodId:
 *                   type: string
 *                 neighborhoodName:
 *                   type: string
 *                 vulnerability:
 *                   type: object
 *                 recommendations:
 *                   type: array
 *                   items:
 *                     type: object
 *                 totalCost:
 *                   type: number
 *                 combinedImpact:
 *                   type: object
 */
app.get('/api/recommendations/recommend/:neighborhoodId', async (req, res) => {
  try {
    const { neighborhoodId } = req.params;
    const budget = parseFloat(req.query.budget) || 1000000;
    const timeframe = parseInt(req.query.timeframe) || 24;
    const maxInterventions = parseInt(req.query.maxInterventions) || 5;

    const recommendations = await interventionRecommenderService.recommendInterventions(
      neighborhoodId,
      { budget, timeframe, maxInterventions }
    );

    res.json(recommendations);
  } catch (error) {
    console.error('Error generating recommendations:', error);
    res.status(500).json({ 
      error: 'Failed to generate recommendations',
      message: error.message 
    });
  }
});

/**
 * @swagger
 * /api/recommendations/portfolio:
 *   get:
 *     summary: Generar portafolio de intervenciones
 *     description: Genera un portafolio optimizado de intervenciones para múltiples barrios
 *     tags: [Recomendaciones]
 *     parameters:
 *       - in: query
 *         name: totalBudget
 *         schema:
 *           type: number
 *           default: 5000000
 *         description: Presupuesto total en USD
 *       - in: query
 *         name: timeframe
 *         schema:
 *           type: integer
 *           default: 36
 *         description: Plazo en meses
 *       - in: query
 *         name: neighborhoods
 *         schema:
 *           type: string
 *         description: IDs de barrios separados por coma (opcional)
 *     responses:
 *       200:
 *         description: Portafolio de intervenciones
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 portfolio:
 *                   type: array
 *                 summary:
 *                   type: object
 */
app.get('/api/recommendations/portfolio', async (req, res) => {
  try {
    const totalBudget = parseFloat(req.query.totalBudget) || 5000000;
    const timeframe = parseInt(req.query.timeframe) || 36;
    const neighborhoodIds = req.query.neighborhoods 
      ? req.query.neighborhoods.split(',')
      : null;

    const portfolio = await interventionRecommenderService.generateInterventionPortfolio({
      totalBudget,
      timeframe,
      neighborhoodIds
    });

    res.json(portfolio);
  } catch (error) {
    console.error('Error generating portfolio:', error);
    res.status(500).json({ 
      error: 'Failed to generate portfolio',
      message: error.message 
    });
  }
});

/**
 * @swagger
 * /api/recommendations/pdf/{neighborhoodId}:
 *   get:
 *     summary: Generar PDF de recomendaciones
 *     description: Genera un reporte PDF automático con recomendaciones para un barrio
 *     tags: [Recomendaciones]
 *     parameters:
 *       - in: path
 *         name: neighborhoodId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: budget
 *         schema:
 *           type: number
 *           default: 1000000
 *       - in: query
 *         name: timeframe
 *         schema:
 *           type: integer
 *           default: 24
 *     responses:
 *       200:
 *         description: PDF del reporte
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 */
app.get('/api/recommendations/pdf/:neighborhoodId', async (req, res) => {
  try {
    const { neighborhoodId } = req.params;
    const budget = parseFloat(req.query.budget) || 1000000;
    const timeframe = parseInt(req.query.timeframe) || 24;

    // Generar recomendaciones
    const recommendations = await interventionRecommenderService.recommendInterventions(
      neighborhoodId,
      { budget, timeframe }
    );

    // Generar PDF
    const pdfPath = await recommendationPdfService.generateNeighborhoodReport(recommendations);

    // Enviar PDF
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="recomendaciones_${neighborhoodId}.pdf"`);
    
    const fileStream = fs.createReadStream(pdfPath);
    fileStream.pipe(res);

    // Eliminar archivo temporal después de enviarlo
    fileStream.on('end', () => {
      fs.unlink(pdfPath, (err) => {
        if (err) console.error('Error deleting temp PDF:', err);
      });
    });

  } catch (error) {
    console.error('Error generating PDF:', error);
    res.status(500).json({ 
      error: 'Failed to generate PDF',
      message: error.message 
    });
  }
});

/**
 * @swagger
 * /api/recommendations/portfolio/pdf:
 *   get:
 *     summary: Generar PDF de portafolio
 *     description: Genera un reporte PDF del portafolio completo de intervenciones
 *     tags: [Recomendaciones]
 *     parameters:
 *       - in: query
 *         name: totalBudget
 *         schema:
 *           type: number
 *           default: 5000000
 *       - in: query
 *         name: timeframe
 *         schema:
 *           type: integer
 *           default: 36
 *     responses:
 *       200:
 *         description: PDF del portafolio
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 */
app.get('/api/recommendations/portfolio/pdf', async (req, res) => {
  try {
    const totalBudget = parseFloat(req.query.totalBudget) || 5000000;
    const timeframe = parseInt(req.query.timeframe) || 36;
    const neighborhoodIds = req.query.neighborhoods 
      ? req.query.neighborhoods.split(',')
      : null;

    // Generar portafolio
    const portfolio = await interventionRecommenderService.generateInterventionPortfolio({
      totalBudget,
      timeframe,
      neighborhoodIds
    });

    // Generar PDF
    const pdfPath = await recommendationPdfService.generatePortfolioReport(portfolio);

    // Enviar PDF
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="portafolio_intervenciones.pdf"');
    
    const fileStream = fs.createReadStream(pdfPath);
    fileStream.pipe(res);

    // Eliminar archivo temporal después de enviarlo
    fileStream.on('end', () => {
      fs.unlink(pdfPath, (err) => {
        if (err) console.error('Error deleting temp PDF:', err);
      });
    });

  } catch (error) {
    console.error('Error generating portfolio PDF:', error);
    res.status(500).json({ 
      error: 'Failed to generate portfolio PDF',
      message: error.message 
    });
  }
});

/**
 * @swagger
 * /api/recommendations/interventions:
 *   get:
 *     summary: Obtener catálogo de intervenciones
 *     description: Retorna el catálogo de todos los tipos de intervenciones disponibles
 *     tags: [Recomendaciones]
 *     responses:
 *       200:
 *         description: Catálogo de intervenciones
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                   name:
 *                     type: string
 *                   description:
 *                     type: string
 *                   targetCriteria:
 *                     type: array
 *                   viability:
 *                     type: string
 *                   cobenefits:
 *                     type: array
 */
app.get('/api/recommendations/interventions', (req, res) => {
  try {
    const catalog = interventionRecommenderService.getInterventionCatalog();
    res.json(catalog);
  } catch (error) {
    console.error('Error getting intervention catalog:', error);
    res.status(500).json({ 
      error: 'Failed to get intervention catalog',
      message: error.message 
    });
  }
});

/**
 * @swagger
 * /api/recommendations/export/geojson:
 *   get:
 *     summary: Exportar ranking como GeoJSON
 *     description: Exporta el ranking de barrios en formato GeoJSON para SIG
 *     tags: [Recomendaciones]
 *     responses:
 *       200:
 *         description: GeoJSON del ranking
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 */
app.get('/api/recommendations/export/geojson', async (req, res) => {
  try {
    const ranking = await interventionRecommenderService.prioritizeNeighborhoods();

    // Convertir a GeoJSON
    const geojson = {
      type: 'FeatureCollection',
      features: ranking.map(neighborhood => ({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [
            -77.0428 + (Math.random() - 0.5) * 0.2, // lng (placeholder)
            -12.0464 + (Math.random() - 0.5) * 0.2  // lat (placeholder)
          ]
        },
        properties: {
          id: neighborhood.neighborhoodId,
          name: neighborhood.neighborhoodName,
          rank: neighborhood.rank,
          vulnerability_score: neighborhood.score,
          classification: neighborhood.classification,
          priority: neighborhood.priority,
          population: neighborhood.population
        }
      }))
    };

    res.json(geojson);
  } catch (error) {
    console.error('Error exporting GeoJSON:', error);
    res.status(500).json({ 
      error: 'Failed to export GeoJSON',
      message: error.message 
    });
  }
});

// Serve the frontend
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
async function startServer() {
  console.log('Starting GEE Tiles Server...');
  
  // Initialize Earth Engine
  await initializeEarthEngine();
  initializeReportDistributionScheduler();
  
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Earth Engine Status: ${eeInitialized ? 'Initialized' : 'Not Initialized'}`);
    if (!eeInitialized) {
      console.log('To use Earth Engine features, add your service account JSON file.');
    }
  });
}

if (require.main === module) {
  startServer();
}

module.exports = {
  app,
  startServer,
  buildEcoPlanAnalysis,
  buildBloomCollection,
  buildRegionalContext,
  evaluateEeObject,
  getMapFromImage,
  getEcoPlanPresetList,
  getPresetList,
  initializeEarthEngine,
  isEarthEngineInitialized: () => eeInitialized
};