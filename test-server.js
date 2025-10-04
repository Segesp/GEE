#!/usr/bin/env node

/**
 * Simple test script to validate the GEE Tiles Server setup
 * This can be run to test all endpoints without a service account
 */

const http = require('http');
const net = require('net');
const { spawn } = require('child_process');
const path = require('path');

const DEFAULT_PORT = parseInt(process.env.TEST_SERVER_PORT || process.env.PORT || '4000', 10);
const SERVER_START_TIMEOUT = parseInt(process.env.TEST_SERVER_TIMEOUT || '15000', 10);
const SERVER_SHUTDOWN_TIMEOUT = parseInt(process.env.TEST_SERVER_SHUTDOWN || '5000', 10);
const EE_READY_TIMEOUT = parseInt(process.env.TEST_SERVER_EE_TIMEOUT || '20000', 10);
const EE_READY_INTERVAL = parseInt(process.env.TEST_SERVER_EE_INTERVAL || '500', 10);

let BASE_URL = `http://127.0.0.1:${DEFAULT_PORT}`;
let serverProcess = null;

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Simple HTTP request helper
function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });
    
    req.on('error', reject);
    
    if (options.body) {
      req.write(options.body);
    }
    
    req.end();
  });
}

async function startServer() {
  if (serverProcess) {
    return { port: new URL(BASE_URL).port || DEFAULT_PORT };
  }

  const port = await findAvailablePort(DEFAULT_PORT);
  BASE_URL = `http://127.0.0.1:${port}`;

  const env = { ...process.env, PORT: String(port) };
  const child = spawn(process.execPath, ['server.js'], {
    cwd: path.resolve(__dirname),
    env,
    stdio: ['ignore', 'pipe', 'pipe']
  });

  serverProcess = child;

  return new Promise((resolve, reject) => {
    let resolved = false;
    const startupTimer = setTimeout(() => {
      if (!resolved) {
        try {
          child.kill('SIGTERM');
        } catch (error) {
          // ignore
        }
        reject(new Error(`Server did not start within ${SERVER_START_TIMEOUT} ms`));
      }
    }, SERVER_START_TIMEOUT);

    const handleReady = (data) => {
      const text = data.toString();
      process.stdout.write(`[server] ${text}`);
      const match = text.match(/Server running on http:\/\/[^:]+:(\d+)/);
      if (match) {
        BASE_URL = `http://127.0.0.1:${match[1]}`;
      }
      if (!resolved && /Server running on http:\/\//.test(text)) {
        resolved = true;
        clearTimeout(startupTimer);
        child.stdout.off('data', handleReady);
        child.stderr.off('data', handleError);
        resolve({ port });
      }
    };

    const handleError = (data) => {
      process.stderr.write(`[server:err] ${data}`);
    };

    child.stdout.on('data', handleReady);
    child.stderr.on('data', handleError);

    child.once('error', (error) => {
      if (!resolved) {
        clearTimeout(startupTimer);
        child.stdout.off('data', handleReady);
        child.stderr.off('data', handleError);
        reject(error);
      }
    });

    child.once('exit', (code) => {
      serverProcess = null;
      if (!resolved) {
        clearTimeout(startupTimer);
        child.stdout.off('data', handleReady);
        child.stderr.off('data', handleError);
        reject(new Error(`Server exited with code ${code}`));
      }
    });
  });
}

async function waitForInitialization(maxAttempts = 10, delayMs = 1500) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const result = await makeRequest(`${BASE_URL}/api/health`);
      if (result.status === 200 && result.data && result.data.earthEngineInitialized) {
        return true;
      }
    } catch (error) {
      // Ignore and retry
    }
    await sleep(delayMs);
  }

  console.warn('⚠️  Earth Engine did not report as initialized within the expected time window.');
  return false;
}

function findAvailablePort(preferredPort) {
  return new Promise((resolve, reject) => {
    const server = net.createServer();

    const tryPort = (portToTry) => {
      server.once('error', (error) => {
        if (portToTry !== 0 && error.code === 'EADDRINUSE') {
          server.close(() => tryPort(0));
        } else {
          server.close(() => reject(error));
        }
      });

      server.once('listening', () => {
        const address = server.address();
        const selectedPort = typeof address === 'object' && address ? address.port : portToTry;
        server.close(() => resolve(selectedPort));
      });

      server.listen({ port: portToTry, host: '127.0.0.1' });
    };

    tryPort(preferredPort);
  });
}

async function stopServer(signal = 'SIGINT') {
  if (!serverProcess) {
    return;
  }

  const child = serverProcess;
  serverProcess = null;

  await new Promise((resolve) => {
    const shutdownTimer = setTimeout(() => {
      if (!child.killed) {
        child.kill('SIGTERM');
      }
    }, SERVER_SHUTDOWN_TIMEOUT);

    const onExit = () => {
      clearTimeout(shutdownTimer);
      resolve();
    };

    if (child.exitCode !== null || child.signalCode !== null) {
      onExit();
      return;
    }

    child.once('exit', onExit);

    try {
      child.kill(signal);
    } catch (error) {
      clearTimeout(shutdownTimer);
      resolve();
    }
  });
}

async function waitForEarthEngineReady(timeoutMs = EE_READY_TIMEOUT, intervalMs = EE_READY_INTERVAL) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const health = await makeRequest(`${BASE_URL}/api/health`);
      if (health.status === 200 && health.data && health.data.earthEngineInitialized) {
        const elapsed = Date.now() - startedAt;
        console.log(`✅ Earth Engine ready after ${elapsed} ms`);
        return true;
      }
    } catch (error) {
      // Ignore and retry
    }

    await delay(intervalMs);
  }

  console.log(`⚠️  Earth Engine not ready after ${timeoutMs} ms`);
  return false;
}

// Test functions
async function testHealthEndpoint() {
  console.log('🔍 Testing health endpoint...');
  try {
    const result = await makeRequest(`${BASE_URL}/api/health`);
    console.log(`✅ Health check: Status ${result.status}`);
    console.log(`   Server status: ${result.data.status}`);
    console.log(`   Earth Engine: ${result.data.earthEngineInitialized ? 'Connected' : 'Not configured'}`);
    return result.status === 200;
  } catch (error) {
    console.log(`❌ Health check failed: ${error.message}`);
    return false;
  }
}

async function testTileEndpoint() {
  console.log('🗺️  Testing tile endpoint...');
  try {
    const result = await makeRequest(`${BASE_URL}/api/tiles/10/512/384`, { method: 'HEAD' });
    console.log(`   Tile endpoint: Status ${result.status}`);
    
    if (result.status === 503) {
      console.log('✅ Expected 503 (Earth Engine not configured)');
      return true;
    } else if (result.status === 302 || result.status === 200) {
      console.log('✅ Tile endpoint working (redirecting to Earth Engine)');
      return true;
    } else {
      console.log('❌ Unexpected status code');
      return false;
    }
  } catch (error) {
    console.log(`❌ Tile test failed: ${error.message}`);
    return false;
  }
}

async function testMapInfoEndpoint() {
  console.log('ℹ️  Testing map info endpoint...');
  try {
    const result = await makeRequest(`${BASE_URL}/api/map/info`);
    console.log(`   Map info: Status ${result.status}`);
    
    if (result.status === 503) {
      console.log('✅ Expected 503 (Earth Engine not configured)');
      return true;
    } else if (result.status === 200 && result.data.mapId) {
      console.log('✅ Map info working');
      console.log(`   Template URL: ${result.data.templateUrl}`);
      return true;
    } else {
      console.log('❌ Unexpected response');
      return false;
    }
  } catch (error) {
    console.log(`❌ Map info test failed: ${error.message}`);
    return false;
  }
}

async function testCustomMapEndpoint() {
  console.log('🎨 Testing custom map endpoint...');
  try {
    const customConfig = {
      collection: 'LANDSAT/LC08/C02/T1_TOA',
      dateStart: '2022-01-01',
      dateEnd: '2023-01-01',
      bands: ['B4', 'B3', 'B2']
    };
    
    const result = await makeRequest(`${BASE_URL}/api/map/custom`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(customConfig)
    });
    
    console.log(`   Custom map: Status ${result.status}`);
    
    if (result.status === 503) {
      console.log('✅ Expected 503 (Earth Engine not configured)');
      return true;
    } else if (result.status === 200 && result.data.mapId) {
      console.log('✅ Custom map working');
      return true;
    } else {
      console.log('❌ Unexpected response');
      return false;
    }
  } catch (error) {
    console.log(`❌ Custom map test failed: ${error.message}`);
    return false;
  }
}

async function testBloomMapEndpoint() {
  console.log('🌊 Testing bloom map endpoint...');
  try {
    const payload = {
      preset: 'costa_metropolitana',
      start: '2024-10-01',
      end: '2025-01-01',
      adaptiveThreshold: false
    };

    const result = await makeRequest(`${BASE_URL}/api/bloom/map`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    console.log(`   Bloom map: Status ${result.status}`);

    if (result.status === 503) {
      console.log('✅ Expected 503 (Earth Engine not configured)');
      return true;
    } else if (result.status === 200 && result.data.layers && result.data.layers.bloom) {
      console.log('✅ Bloom map layers available');
      return true;
    } else {
      console.log('❌ Unexpected response');
      return false;
    }
  } catch (error) {
    console.log(`❌ Bloom map test failed: ${error.message}`);
    return false;
  }
}

async function testBloomStatsEndpoint() {
  console.log('📈 Testing bloom stats endpoint...');
  try {
    const payload = {
      preset: 'ancon',
      start: '2024-10-01',
      end: '2024-12-31',
      adaptiveThreshold: false
    };

    const result = await makeRequest(`${BASE_URL}/api/bloom/stats`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    console.log(`   Bloom stats: Status ${result.status}`);

    if (result.status === 503) {
      console.log('✅ Expected 503 (Earth Engine not configured)');
      return true;
    } else if (result.status === 200 && result.data.areaSeries && Array.isArray(result.data.areaSeries.features)) {
      console.log(`✅ Bloom stats returned ${result.data.areaSeries.features.length} entries`);
      return true;
    } else {
      console.log('❌ Unexpected response');
      return false;
    }
  } catch (error) {
    console.log(`❌ Bloom stats test failed: ${error.message}`);
    return false;
  }
}

async function testBloomContextEndpoint() {
  console.log('🌐 Testing bloom context endpoint...');
  try {
    const payload = {
      preset: 'costa_metropolitana',
      start: '2024-10-01',
      end: '2025-01-01',
      contextBuffer: 8000
    };

    const result = await makeRequest(`${BASE_URL}/api/bloom/context`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    console.log(`   Bloom context: Status ${result.status}`);

    if (result.status === 503) {
      console.log('✅ Expected 503 (Earth Engine not configured)');
      return true;
    } else if (result.status === 200 && result.data.layers && result.data.layers.chlorophyll) {
      console.log('✅ Bloom context layers available');
      return true;
    } else {
      console.log('❌ Unexpected response');
      return false;
    }
  } catch (error) {
    console.log(`❌ Bloom context test failed: ${error.message}`);
    return false;
  }
}

async function testCitizenReportsListEndpoint() {
  console.log('🧑‍🤝‍🧑 Testing citizen reports list endpoint...');
  try {
    const result = await makeRequest(`${BASE_URL}/api/citizen-reports`);
    console.log(`   Citizen reports list: Status ${result.status}`);

    if (result.status === 200 && result.data && Array.isArray(result.data.reports)) {
      console.log(`✅ Citizen reports list returned ${result.data.reports.length} items`);
      return true;
    }

    console.log('❌ Unexpected response');
    return false;
  } catch (error) {
    console.log(`❌ Citizen reports list test failed: ${error.message}`);
    return false;
  }
}

async function testCitizenReportsCreateEndpoint() {
  console.log('📝 Testing citizen reports create endpoint...');
  try {
    const payload = {
      category: 'other',
      description: 'Incidencia de prueba automatizada para el dashboard EcoPlan',
      latitude: -12.05 + (Math.random() - 0.5) * 0.1,
      longitude: -77.05 + (Math.random() - 0.5) * 0.1
    };

    const result = await makeRequest(`${BASE_URL}/api/citizen-reports`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    console.log(`   Citizen reports create: Status ${result.status}`);

    if (result.status === 201 && result.data && result.data.report && result.data.report.id) {
      console.log('✅ Citizen report created successfully');
      return true;
    } else if (result.status === 400) {
      console.log('❌ Validation failed when creating citizen report');
      return false;
    }

    console.log('❌ Unexpected response');
    return false;
  } catch (error) {
    console.log(`❌ Citizen reports create test failed: ${error.message}`);
    return false;
  }
}

async function runAllTests() {
  console.log('🚀 Starting GEE Tiles Server API Tests\n');

  await waitForEarthEngineReady();
  
  const tests = [
    testHealthEndpoint,
    testTileEndpoint,
    testMapInfoEndpoint,
    testCustomMapEndpoint,
    testBloomMapEndpoint,
    testBloomStatsEndpoint,
    testBloomContextEndpoint,
    testCitizenReportsListEndpoint,
    testCitizenReportsCreateEndpoint
  ];
  
  let passed = 0;
  let failed = 0;
  
  for (const test of tests) {
    const result = await test();
    if (result) {
      passed++;
    } else {
      failed++;
    }
    console.log('');
  }
  
  console.log('📊 Test Results:');
  console.log(`   ✅ Passed: ${passed}`);
  console.log(`   ❌ Failed: ${failed}`);
  
  if (failed === 0) {
    console.log('\n🎉 All tests passed! The server is working correctly.');
    console.log('\n📝 Next steps:');
    console.log('   1. Add your service-account.json file to enable Earth Engine');
    console.log('   2. Restart the server');
    console.log('   3. Test again to see full functionality');
  } else {
    console.log('\n⚠️  Some tests failed. Revisa la salida del servidor anterior.');
  }

  return { passed, failed };
}

// Run tests if this script is executed directly
if (require.main === module) {
  (async () => {
    try {
      await startServer();
      const { failed } = await runAllTests();
      if (failed > 0) {
        process.exitCode = 1;
      }
    } catch (error) {
      console.error('❌ Test runner error:', error.message);
      process.exitCode = 1;
    } finally {
      await stopServer();
    }
  })();
}

module.exports = {
  runAllTests,
  testHealthEndpoint,
  testTileEndpoint,
  testMapInfoEndpoint,
  testCustomMapEndpoint,
  testBloomMapEndpoint,
  testBloomStatsEndpoint,
  testBloomContextEndpoint,
  testCitizenReportsListEndpoint,
  testCitizenReportsCreateEndpoint,
  startServer,
  stopServer,
  waitForEarthEngineReady
};