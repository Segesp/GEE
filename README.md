# Google Earth Engine Tiles Server

A Node.js server that provides XYZ tile service for Google Earth Engine datasets with a web-based map viewer.

## Features

- 🌍 **XYZ Tile Service**: Serve Earth Engine imagery as standard XYZ map tiles
- 🗺️ **Web Interface**: Interactive map viewer using Leaflet
- 🔐 **Service Account Authentication**: Secure authentication with Google Cloud Service Account
- 📊 **Multiple Datasets**: Support for Landsat, Sentinel, and custom collections
- 🎨 **Visualization Parameters**: Customizable band combinations and styling
- 🚀 **RESTful API**: Clean API endpoints for integration

## Quick Start Checklist

- [ ] **Cloud Project with EE API enabled** ([Google Cloud Console](https://console.cloud.google.com/))
- [ ] **Service Account + JSON (backend)** ([Service Account Setup](https://developers.google.com/earth-engine/guides/service_account))
- [ ] **Node.js with @google/earthengine: authenticate → initialize**
- [ ] **Endpoint that delivers tiles XYZ via getMap/getTileUrl**
- [ ] **Frontend adds the tile layer with that URL**
- [ ] **(Optional) Exports to GCS / tiles pre-generated**

## Prerequisites

1. **Google Cloud Project** with Earth Engine API enabled
2. **Service Account** with Earth Engine permissions
3. **Node.js** (version 14 or higher)
4. **Service Account JSON file**

## Setup Instructions

### 1. Google Cloud Setup

1. Create a Google Cloud Project at [Google Cloud Console](https://console.cloud.google.com/)
2. Enable the Google Earth Engine API:
   - Go to APIs & Services > Library
   - Search for "Earth Engine API"
   - Click "Enable"

### 2. Service Account Setup

1. Go to IAM & Admin > Service Accounts
2. Create a new service account:
   - Name: `gee-tiles-service`
   - Description: `Service account for GEE tiles server`
3. Grant the following roles:
   - `Earth Engine Resource Admin`
   - `Earth Engine Resource Reader` 
4. Create and download a JSON key file

### 3. Project Setup

1. Clone this repository:
   ```bash
   git clone <repository-url>
   cd GEE
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure environment:
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. Add your service account JSON file:
   ```bash
   # Place your service account JSON file as:
   ./service-account.json
   ```

### 4. Running the Application

1. Start the development server:
   ```bash
   npm run dev
   ```

2. Or start the production server:
   ```bash
   npm start
   ```

3. Open your browser and visit: `http://localhost:3000`

## API Endpoints

### Health Check
```
GET /api/health
```
Returns server status and Earth Engine connection status.

### Default Dataset Tiles
```
GET /api/tiles/{z}/{x}/{y}
```
Returns XYZ tiles for the default Landsat 8 dataset.

### Map Information
```
GET /api/map/info
```
Returns map metadata and tile URL template.

### Custom Dataset
```
POST /api/map/custom
Content-Type: application/json

{
  "collection": "LANDSAT/LC08/C02/T1_TOA",
  "dateStart": "2022-01-01",
  "dateEnd": "2023-01-01",
  "bands": ["B4", "B3", "B2"],
  "min": 0,
  "max": 0.3,
  "gamma": 1.4
}
```

## Usage Examples

### Leaflet Integration

```javascript
// Add Earth Engine tiles to Leaflet map
const eeLayer = L.tileLayer('http://localhost:3000/api/tiles/{z}/{x}/{y}', {
    attribution: 'Google Earth Engine',
    maxZoom: 18
});

map.addLayer(eeLayer);
```

### OpenLayers Integration

```javascript
// Add Earth Engine tiles to OpenLayers
const eeSource = new ol.source.XYZ({
    url: 'http://localhost:3000/api/tiles/{z}/{x}/{y}'
});

const eeLayer = new ol.layer.Tile({
    source: eeSource
});

map.addLayer(eeLayer);
```

## Configuration

### Environment Variables

Create a `.env` file with the following variables:

```bash
# Google Earth Engine Configuration
GOOGLE_SERVICE_ACCOUNT_PATH=./service-account.json

# Server Configuration  
PORT=3000

# Optional: Google Cloud Storage for exports
GCS_BUCKET_NAME=your-bucket-name
```

### Service Account Permissions

Your service account needs the following permissions:
- Earth Engine Resource Admin (for full access)
- Earth Engine Resource Reader (for read-only access)

## Available Datasets

The server supports any Google Earth Engine dataset. Common examples include:

- **Landsat 8**: `LANDSAT/LC08/C02/T1_TOA`
- **Landsat 9**: `LANDSAT/LC09/C02/T1_TOA`  
- **Sentinel-2**: `COPERNICUS/S2_SR`
- **MODIS**: `MODIS/006/MOD13Q1`
- **Dynamic World**: `GOOGLE/DYNAMICWORLD/V1`

## Troubleshooting

### Common Issues

1. **"Earth Engine not initialized"**
   - Check that your service account JSON file exists
   - Verify the file path in `.env` 
   - Ensure the service account has proper permissions

2. **"Failed to generate tile"**
   - Check your internet connection
   - Verify Earth Engine API is enabled in Google Cloud
   - Check server logs for detailed error messages

3. **Tiles not loading in frontend**
   - Check browser console for errors
   - Verify the server is running on the correct port
   - Test API endpoints directly

### Getting Help

1. Check the server logs for detailed error messages
2. Test API endpoints using curl or Postman
3. Verify Google Cloud project setup and permissions

## Development

### Project Structure

```
.
├── server.js          # Main server file
├── package.json       # Dependencies and scripts
├── .env.example      # Environment variables template
├── public/           # Frontend files
│   └── index.html    # Web interface
└── README.md         # This file
```

### Adding New Features

1. **New Dataset Support**: Add dataset configurations in `server.js`
2. **Custom Visualizations**: Extend the `/api/map/custom` endpoint
3. **Export Features**: Implement GCS export functionality
4. **Authentication**: Add user authentication if needed

## License

MIT License - see LICENSE file for details.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## Resources

- [Google Earth Engine Documentation](https://developers.google.com/earth-engine)
- [Earth Engine JavaScript API](https://developers.google.com/earth-engine/apidocs)
- [Service Account Setup Guide](https://developers.google.com/earth-engine/guides/service_account)
- [Leaflet Documentation](https://leafletjs.com/)