const fs = require('fs');
const fsPromises = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const { Firestore } = require('@google-cloud/firestore');

const DEFAULT_FILE_PATH = path.resolve(process.cwd(), '.data/report-runs.json');
const DEFAULT_COLLECTION = process.env.REPORTS_RUNS_COLLECTION || 'reportRuns';
const STORE_STRATEGY = (process.env.REPORTS_RUNS_STORE || '').toLowerCase();

let storeInstance = null;
let initializing = null;

function removeUndefinedFields(obj = {}) {
  return Object.fromEntries(
    Object.entries(obj).filter(([, value]) => value !== undefined)
  );
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

function sanitizeRequestPayload(payload = {}) {
  if (!payload || typeof payload !== 'object') {
    return {};
  }

  const clone = JSON.parse(JSON.stringify(payload));
  delete clone.delivery;
  delete clone.notifications;
  delete clone.token;
  delete clone.apiKey;

  return clone;
}

function computeRequestHash(data) {
  try {
    return crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex');
  } catch (error) {
    return null;
  }
}

class InMemoryStore {
  constructor() {
    this.items = [];
  }

  async createRun(data) {
    this.items.push(data);
    return data;
  }

  async updateRun(id, patch) {
    const index = this.items.findIndex((item) => item.id === id);
    if (index === -1) {
      return null;
    }
    this.items[index] = { ...this.items[index], ...patch };
    return this.items[index];
  }

  async getRun(id) {
    return this.items.find((item) => item.id === id) || null;
  }

  async listRuns({ jobId, limit = 50, status } = {}) {
    let results = [...this.items];
    if (jobId) {
      results = results.filter((item) => item.jobId === jobId);
    }
    if (status) {
      results = results.filter((item) => item.status === status);
    }
    return results
      .sort((a, b) => new Date(b.startedAt || 0) - new Date(a.startedAt || 0))
      .slice(0, limit);
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
    const content = await fsPromises.readFile(this.filePath, 'utf8');
    try {
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

  async createRun(data) {
    const items = await this.readAll();
    items.push(data);
    await this.writeAll(items);
    return data;
  }

  async updateRun(id, patch) {
    const items = await this.readAll();
    const index = items.findIndex((item) => item.id === id);
    if (index === -1) {
      return null;
    }
    items[index] = { ...items[index], ...patch };
    await this.writeAll(items);
    return items[index];
  }

  async getRun(id) {
    const items = await this.readAll();
    return items.find((item) => item.id === id) || null;
  }

  async listRuns({ jobId, limit = 50, status } = {}) {
    const items = await this.readAll();
    let results = items;
    if (jobId) {
      results = results.filter((item) => item.jobId === jobId);
    }
    if (status) {
      results = results.filter((item) => item.status === status);
    }
    return results
      .sort((a, b) => new Date(b.startedAt || 0) - new Date(a.startedAt || 0))
      .slice(0, limit);
  }
}

class FirestoreStore {
  constructor(collectionName = DEFAULT_COLLECTION) {
    this.collectionName = collectionName;
    this.firestore = new Firestore();
    this.collection = this.firestore.collection(this.collectionName);
  }

  async createRun(data) {
    await this.collection.doc(data.id).set(data, { merge: false });
    return data;
  }

  async updateRun(id, patch) {
    await this.collection.doc(id).set(patch, { merge: true });
    const snapshot = await this.collection.doc(id).get();
    return snapshot.exists ? snapshot.data() : null;
  }

  async getRun(id) {
    const snapshot = await this.collection.doc(id).get();
    return snapshot.exists ? snapshot.data() : null;
  }

  async listRuns({ jobId, limit = 50, status } = {}) {
    let query = this.collection.orderBy('startedAt', 'desc').limit(limit);

    if (jobId) {
      query = query.where('jobId', '==', jobId);
    }

    if (status) {
      query = query.where('status', '==', status);
    }

    const snapshot = await query.get();
    return snapshot.docs.map((doc) => doc.data());
  }
}

async function createStore() {
  if (STORE_STRATEGY === 'file') {
    return new FileStore();
  }

  if (STORE_STRATEGY === 'memory') {
    return new InMemoryStore();
  }

  const hasExplicitFirestore = STORE_STRATEGY === 'firestore';
  const hasCredentials = process.env.GOOGLE_APPLICATION_CREDENTIALS
    || process.env.GOOGLE_SERVICE_ACCOUNT_JSON
    || process.env.GCLOUD_PROJECT
    || process.env.GOOGLE_CLOUD_PROJECT;

  if (hasExplicitFirestore || hasCredentials) {
    try {
      return new FirestoreStore();
    } catch (error) {
      const logger = getLogger();
      logger.warn('[reportRunsRepository] Firestore no disponible, usando FileStore:', error.message);
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

async function createRun({
  jobId,
  presetId,
  presetName,
  trigger,
  request,
  startedAt,
  status,
  logger
}) {
  try {
    const store = await getStore();
    const sanitizedRequest = sanitizeRequestPayload(request);
    const hash = computeRequestHash({ jobId, presetId, trigger, request: sanitizedRequest });
    const data = {
      id: crypto.randomUUID(),
      jobId,
      presetId,
      presetName,
      trigger,
      status: status || 'running',
      startedAt,
      request: sanitizedRequest,
      hash,
      createdAt: startedAt,
      updatedAt: startedAt
    };
    await store.createRun(data);
    return data;
  } catch (error) {
    const log = getLogger(logger);
    log.warn('[reportRunsRepository] No se pudo crear el run:', error.message);
    return null;
  }
}

async function updateRun(id, patch = {}, logger) {
  if (!id) {
    return null;
  }

  try {
    const store = await getStore();
    const sanitizedPatch = removeUndefinedFields({ ...patch, updatedAt: new Date().toISOString() });
    return await store.updateRun(id, sanitizedPatch);
  } catch (error) {
    const log = getLogger(logger);
    log.warn('[reportRunsRepository] No se pudo actualizar el run:', error.message);
    return null;
  }
}

async function completeRun(id, data = {}, logger) {
  if (!id) {
    return null;
  }

  const patch = removeUndefinedFields({
    status: data.status,
    completedAt: data.completedAt,
    durationMs: data.durationMs,
    generatedAt: data.generatedAt,
    results: data.results,
    notifications: data.notifications,
    metrics: data.metrics,
    delivery: data.delivery,
    error: data.error || null
  });

  return updateRun(id, patch, logger);
}

async function getRun(id) {
  const store = await getStore();
  return store.getRun(id);
}

async function listRuns(options = {}) {
  const store = await getStore();
  return store.listRuns(options);
}

module.exports = {
  createRun,
  completeRun,
  updateRun,
  getRun,
  listRuns
};
