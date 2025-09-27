const express = require('express');
const ee = require('@google/earthengine');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Earth Engine authentication and initialization
let eeInitialized = false;

async function initializeEarthEngine() {
  try {
    const serviceAccountPath = process.env.GOOGLE_SERVICE_ACCOUNT_PATH || './service-account.json';
    
    // Check if service account file exists
    const fs = require('fs');
    if (!fs.existsSync(serviceAccountPath)) {
      console.warn('Service account JSON file not found. Please add your service account credentials.');
      console.warn('Copy your service account JSON file to:', serviceAccountPath);
      return false;
    }

    const serviceAccount = require(path.resolve(serviceAccountPath));
    
    // Authenticate with service account
    await ee.data.authenticateViaPrivateKey(serviceAccount);
    
    // Initialize the Earth Engine library
    await ee.initialize(null, null, () => {
      console.log('Earth Engine initialized successfully');
      eeInitialized = true;
    }, (error) => {
      console.error('Error initializing Earth Engine:', error);
      eeInitialized = false;
    });
    
    return true;
  } catch (error) {
    console.error('Failed to initialize Earth Engine:', error);
    return false;
  }
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
    
    // Get the tile URL from Earth Engine
    const tileUrl = image.getMap().getTileUrl({
      x: parseInt(x),
      y: parseInt(y),
      z: parseInt(z)
    });
    
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
    const mapId = await new Promise((resolve, reject) => {
      image.getMap({}, (obj, error) => {
        if (error) {
          reject(error);
        } else {
          resolve(obj);
        }
      });
    });

    res.json({
      mapId: mapId.mapid,
      token: mapId.token,
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

    const mapId = await new Promise((resolve, reject) => {
      image.getMap({}, (obj, error) => {
        if (error) {
          reject(error);
        } else {
          resolve(obj);
        }
      });
    });

    res.json({
      mapId: mapId.mapid,
      token: mapId.token,
      templateUrl: `${req.protocol}://${req.get('host')}/api/tiles/{z}/{x}/{y}?mapId=${mapId.mapid}&token=${mapId.token}`,
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

// Serve the frontend
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
async function startServer() {
  console.log('Starting GEE Tiles Server...');
  
  // Initialize Earth Engine
  await initializeEarthEngine();
  
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Earth Engine Status: ${eeInitialized ? 'Initialized' : 'Not Initialized'}`);
    if (!eeInitialized) {
      console.log('To use Earth Engine features, add your service account JSON file.');
    }
  });
}

startServer();