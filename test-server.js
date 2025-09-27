#!/usr/bin/env node

/**
 * Simple test script to validate the GEE Tiles Server setup
 * This can be run to test all endpoints without a service account
 */

const http = require('http');

const BASE_URL = 'http://localhost:3000';

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

async function runAllTests() {
  console.log('🚀 Starting GEE Tiles Server API Tests\n');
  
  const tests = [
    testHealthEndpoint,
    testTileEndpoint,
    testMapInfoEndpoint,
    testCustomMapEndpoint
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
    console.log('\n⚠️  Some tests failed. Check the server is running on port 3000.');
    process.exit(1);
  }
}

// Run tests if this script is executed directly
if (require.main === module) {
  runAllTests().catch(console.error);
}

module.exports = { runAllTests, testHealthEndpoint, testTileEndpoint, testMapInfoEndpoint, testCustomMapEndpoint };