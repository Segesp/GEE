const fs = require('fs');
const fsPromises = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const { Firestore } = require('@google-cloud/firestore');

const DEFAULT_FILE_PATH = path.resolve(process.cwd(), '.data/citizen-reports.json');
const DEFAULT_COLLECTION = process.env.CITIZEN_REPORTS_COLLECTION || 'citizenReports';
const STORE_STRATEGY = (process.env.CITIZEN_REPORTS_STORE || '').toLowerCase();

let storeInstance = null;
let initializing = null;

function pickDefined(source = {}, keys = []) {
  const result = {};
  keys.forEach((key) => {
    const value = source[key];
    if (value !== undefined) {
      result[key] = value;
    }
  });
  return result;
}

function getLogger(logger) {
  if (logger && typeof logger === 'object') {
    return {
      info: typeof logger.info === 'function' ? logger.info.bind(logger) : console.log.bind(console),
      warn: typeof logger.warn === 'function' ? logger.warn.bind(logger) : console.warn.bind(console),
      error: typeof logger.error === 'function' ? logger.error.bind(logger) : console.error.bind(console)
    };
  }
  return {
    info: console.log.bind(console),
    warn: console.warn.bind(console),
    error: console.error.bind(console)
  };
}

function normalizeCoordinate(value) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function normalizeReport(record = {}) {
  if (!record || typeof record !== 'object') {
    return null;
  }

  const normalized = {
    id: record.id,
    category: record.category,
    description: record.description,
    latitude: normalizeCoordinate(record.latitude),
    longitude: normalizeCoordinate(record.longitude),
    photoUrl: record.photoUrl || null,
    contactName: record.contactName || null,
    contactEmail: record.contactEmail || null,
    status: record.status || 'open',
    source: record.source || 'citizen',
    createdAt: record.createdAt,
    updatedAt: record.updatedAt
  };

  return normalized;
}

class InMemoryStore {
  constructor() {
    this.items = [];
  }

  async createReport(report) {
    this.items.push(report);
    return normalizeReport(report);
  }

  async listReports({ limit = 100, bbox, status, category } = {}) {
    let results = [...this.items];
    if (status) {
      results = results.filter((item) => item.status === status);
    }
    if (category) {
      results = results.filter((item) => item.category === category);
    }
    if (bbox && Array.isArray(bbox) && bbox.length === 4) {
      const [minLng, minLat, maxLng, maxLat] = bbox.map((value) => Number(value));
      results = results.filter((item) => {
        if (typeof item.latitude !== 'number' || typeof item.longitude !== 'number') {
          return false;
        }
        return item.latitude >= minLat
          && item.latitude <= maxLat
          && item.longitude >= minLng
          && item.longitude <= maxLng;
      });
    }
    return results
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
      .slice(0, Math.max(1, Math.min(Number(limit) || 100, 500)))
      .map(normalizeReport);
  }

  async getReport(id) {
    return normalizeReport(this.items.find((item) => item.id === id));
  }

  async updateReport(id, patch = {}) {
    const index = this.items.findIndex((item) => item.id === id);
    if (index === -1) {
      return null;
    }
    this.items[index] = { ...this.items[index], ...patch };
    return normalizeReport(this.items[index]);
  }
}

class FileStore {
  constructor(filePath = DEFAULT_FILE_PATH) {
    this.filePath = filePath;
    this.ready = false;
  }

  async ensureReady() {
    if (this.ready) {
      return;
    }

    const dir = path.dirname(this.filePath);
    await fsPromises.mkdir(dir, { recursive: true });

    try {
      await fsPromises.access(this.filePath, fs.constants.F_OK);
    } catch (error) {
      await fsPromises.writeFile(this.filePath, '[]', 'utf8');
    }

    this.ready = true;
  }

  async readAll() {
    await this.ensureReady();
    try {
      const content = await fsPromises.readFile(this.filePath, 'utf8');
      const parsed = JSON.parse(content);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      return [];
    }
  }

  async writeAll(items) {
    await this.ensureReady();
    await fsPromises.writeFile(this.filePath, JSON.stringify(items, null, 2), 'utf8');
  }

  async createReport(report) {
    const items = await this.readAll();
    items.push(report);
    await this.writeAll(items);
    return normalizeReport(report);
  }

  async listReports(options = {}) {
    const { limit = 100, bbox, status, category } = options;
    const items = await this.readAll();
    let results = items;
    if (status) {
      results = results.filter((item) => item.status === status);
    }
    if (category) {
      results = results.filter((item) => item.category === category);
    }
    if (bbox && Array.isArray(bbox) && bbox.length === 4) {
      const [minLng, minLat, maxLng, maxLat] = bbox.map((value) => Number(value));
      results = results.filter((item) => {
        if (typeof item.latitude !== 'number' || typeof item.longitude !== 'number') {
          return false;
        }
        return item.latitude >= minLat
          && item.latitude <= maxLat
          && item.longitude >= minLng
          && item.longitude <= maxLng;
      });
    }

    return results
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
      .slice(0, Math.max(1, Math.min(Number(limit) || 100, 500)))
      .map(normalizeReport);
  }

  async getReport(id) {
    const items = await this.readAll();
    return normalizeReport(items.find((item) => item.id === id));
  }

  async updateReport(id, patch = {}) {
    const items = await this.readAll();
    const index = items.findIndex((item) => item.id === id);
    if (index === -1) {
      return null;
    }
    items[index] = { ...items[index], ...patch };
    await this.writeAll(items);
    return normalizeReport(items[index]);
  }
}

class FirestoreStore {
  constructor(collection = DEFAULT_COLLECTION) {
    this.collection = new Firestore().collection(collection);
  }

  async createReport(report) {
    await this.collection.doc(report.id).set(report, { merge: false });
    return normalizeReport(report);
  }

  async listReports({ limit = 100, bbox, status, category } = {}) {
    let query = this.collection.orderBy('createdAt', 'desc').limit(limit);

    if (status) {
      query = query.where('status', '==', status);
    }
    if (category) {
      query = query.where('category', '==', category);
    }

    const snapshot = await query.get();
    let results = snapshot.docs.map((doc) => doc.data());

    if (bbox && Array.isArray(bbox) && bbox.length === 4) {
      const [minLng, minLat, maxLng, maxLat] = bbox.map((value) => Number(value));
      results = results.filter((item) => {
        if (typeof item.latitude !== 'number' || typeof item.longitude !== 'number') {
          return false;
        }
        return item.latitude >= minLat
          && item.latitude <= maxLat
          && item.longitude >= minLng
          && item.longitude <= maxLng;
      });
    }

    return results.map(normalizeReport);
  }

  async getReport(id) {
    const snapshot = await this.collection.doc(id).get();
    return snapshot.exists ? normalizeReport(snapshot.data()) : null;
  }

  async updateReport(id, patch = {}) {
    await this.collection.doc(id).set(patch, { merge: true });
    const snapshot = await this.collection.doc(id).get();
    return snapshot.exists ? normalizeReport(snapshot.data()) : null;
  }
}

async function createStore() {
  if (STORE_STRATEGY === 'memory') {
    return new InMemoryStore();
  }

  if (STORE_STRATEGY === 'file' || !STORE_STRATEGY) {
    return new FileStore();
  }

  if (STORE_STRATEGY === 'firestore') {
    return new FirestoreStore();
  }

  const hasFirestoreCredentials = process.env.GOOGLE_APPLICATION_CREDENTIALS
    || process.env.GOOGLE_SERVICE_ACCOUNT_JSON
    || process.env.GCLOUD_PROJECT
    || process.env.GOOGLE_CLOUD_PROJECT;

  if (hasFirestoreCredentials) {
    try {
      return new FirestoreStore();
    } catch (error) {
      const logger = getLogger();
      logger.warn('[citizenReportsRepository] Firestore no disponible, usando FileStore:', error.message);
    }
  }

  return new FileStore();
}

async function getStore() {
  if (storeInstance) {
    return storeInstance;
  }
  if (!initializing) {
    initializing = createStore()
      .then((store) => {
        storeInstance = store;
        return storeInstance;
      })
      .finally(() => {
        initializing = null;
      });
  }
  return initializing;
}

function baseReportData(payload = {}) {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    category: payload.category,
    description: payload.description,
    latitude: normalizeCoordinate(payload.latitude),
    longitude: normalizeCoordinate(payload.longitude),
    photoUrl: payload.photoUrl || null,
    contactName: payload.contactName || null,
    contactEmail: payload.contactEmail || null,
    status: payload.status || 'open',
    source: payload.source || 'citizen',
    createdAt: payload.createdAt || now,
    updatedAt: payload.updatedAt || now
  };
}

async function createReport(payload = {}, logger) {
  try {
    const store = await getStore();
    const report = baseReportData(payload);
    return await store.createReport(report);
  } catch (error) {
    const log = getLogger(logger);
    log.warn('[citizenReportsRepository] No se pudo crear el reporte:', error.message);
    return null;
  }
}

async function listReports(options = {}) {
  const store = await getStore();
  return store.listReports(options);
}

async function getReport(id) {
  if (!id) {
    return null;
  }
  const store = await getStore();
  return store.getReport(id);
}

async function updateReport(id, patch = {}, logger) {
  if (!id) {
    return null;
  }
  try {
    const store = await getStore();
    const safePatch = {
      ...pickDefined(patch, ['category', 'description', 'latitude', 'longitude', 'photoUrl', 'contactName', 'contactEmail', 'status']),
      updatedAt: new Date().toISOString()
    };
    return store.updateReport(id, safePatch);
  } catch (error) {
    const log = getLogger(logger);
    log.warn('[citizenReportsRepository] No se pudo actualizar el reporte:', error.message);
    return null;
  }
}

module.exports = {
  createReport,
  listReports,
  getReport,
  updateReport
};
