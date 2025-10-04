const { Storage } = require('@google-cloud/storage');

let storageInstance = null;

function getStorage() {
  if (!storageInstance) {
    storageInstance = new Storage();
  }
  return storageInstance;
}

function sanitizePathSegment(segment = '') {
  return segment
    .toString()
    .trim()
  .replace(/[^a-z0-9-_/]/gi, '_')
  .replace(/_{2,}/g, '_')
  .replace(/\/{2,}/g, '/');
}

function buildDestination({ prefix, filename, presetId, format, generatedAt }) {
  const safePrefix = prefix ? sanitizePathSegment(prefix) : 'reports/ecoplan';
  const safePreset = sanitizePathSegment(presetId || 'urbano');
  const safeFormat = sanitizePathSegment(format || 'json');
  const datePart = new Date(generatedAt || Date.now()).toISOString().split('T')[0];

  const destination = `${safePrefix}/${datePart}/${safePreset}/${sanitizePathSegment(filename || `reporte.${safeFormat}`)}`
    .replace(/\/{2,}/g, '/');

  return destination;
}

async function uploadReportToGcs({
  content,
  contentType,
  bucketName,
  destination,
  metadata = {},
  presetId,
  format,
  generatedAt,
  prefix
}) {
  if (!bucketName) {
    throw new Error('bucketName es requerido para subir el reporte a Cloud Storage.');
  }

  const storage = getStorage();
  const bucket = storage.bucket(bucketName);
  const finalDestination = destination || buildDestination({ prefix, filename: metadata.filename, presetId, format, generatedAt });
  const file = bucket.file(finalDestination);

  const buffer = Buffer.isBuffer(content) ? content : Buffer.from(content, 'utf8');

  await file.save(buffer, {
    contentType,
    resumable: false,
    metadata: {
      cacheControl: 'no-cache',
      ...metadata
    }
  });

  return {
    bucket: bucketName,
    path: finalDestination,
    publicUrl: `https://storage.googleapis.com/${bucketName}/${finalDestination}`,
    gsUri: `gs://${bucketName}/${finalDestination}`
  };
}

module.exports = {
  uploadReportToGcs
};
