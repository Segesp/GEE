# Google Earth Engine Tiles Server

A Node.js server that provides XYZ tile service for Google Earth Engine datasets with a web-based map viewer.

## Features

- 🌍 **XYZ Tile Service**: Serve Earth Engine imagery as standard XYZ map tiles
- 🗺️ **Web Interface**: Interactive map viewer using Leaflet
- 🌐 **Bloom Dashboard**: Panel interactivo (Leaflet + Chart.js) con presets regionales para Lima
- 🔐 **Service Account Authentication**: Secure authentication with Google Cloud Service Account
- 📊 **Multiple Datasets**: Support for Landsat, Sentinel, and custom collections
- 🎨 **Visualization Parameters**: Customizable band combinations and styling
- 🚀 **RESTful API**: Clean API endpoints for integration
- 🧭 **Contexto Regional**: Mapas y series temporales MODIS (clorofila) + NOAA OISST (temperatura)

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

### Bloom ROI Presets
```
GET /api/bloom/presets
```
Lista los presets configurados para Lima (costa metropolitana, Bahía de Ancón, Pantanos de Villa) incluyendo sus geometrías base y metadatos.

### Bloom Map Layers
```
POST /api/bloom/map
Content-Type: application/json

{
   "preset": "costa_metropolitana",
   "start": "2024-10-01",
   "end": "2025-01-01",
   "cloudPercentage": 35,
   "ndciThreshold": 0.1,
   "faiThreshold": 0.005,
   "adaptiveThreshold": true,
   "minPixelsClean": 12,
   "buffer": 400
}
```
Devuelve `mapId` y `token` para cuatro capas (`bloom`, `ndci`, `fai`, `trueColor`), los umbrales aplicados y la geometría final del ROI. Si `preset` es `custom`, envía un objeto GeoJSON en `geometry`.

### Bloom Statistics
```
POST /api/bloom/stats
Content-Type: application/json

{
   "preset": "ancon",
   "start": "2024-10-01",
   "end": "2024-12-31",
   "adaptiveThreshold": false
}
```
Entrega una `FeatureCollection` con el área diaria de bloom (km²) y los umbrales utilizados. Ideal para dashboards o análisis temporal.

### Bloom Contexto Regional
````
POST /api/bloom/context
Content-Type: application/json

{
   "preset": "costa_metropolitana",
   "start": "2024-10-01",
   "end": "2025-01-01",
   "contextBuffer": 8000,
   "chlorDataset": "NASA/OCEANDATA/MODIS-Aqua/L3SMI",
   "sstDataset": "NOAA/CDR/OISST/V2_1"
}
````
Devuelve un paquete con:

- `layers`: Tiles XYZ para clorofila (MODIS Aqua) y temperatura superficial del mar (NOAA OISST)
- `series`: Series temporales promedio sobre el buffer definido
- `summary`: Estadísticos básicos (mínimo/máximo/promedio) para cada variable
- `contextGeometry`: Geometría del buffer en GeoJSON para sobreponer en el visor

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

## Bloom Detection for Lima, Perú

El servidor expone la lógica de Sentinel-2 adaptada al litoral de Lima para detectar floraciones algales mediante NDCI/FAI:

- **Presets:** `costa_metropolitana`, `ancon`, `pantanos` (consulta `GET /api/bloom/presets`). Puedes enviar `preset: "custom"` con tu propio GeoJSON.
- **Buffer dinámico:** Cada preset trae un buffer sugerido (p. ej. +400 m mar adentro). Ajusta `buffer` en la petición para acercarte/alejarte de costa.
- **Máscaras:** Se aplican máscaras de nubes (SCL), agua (NDWI + clase 6) y limpieza morfológica (`minPixelsClean`) para reducir ruido por espuma.
- **Umbrales:** Envíalos fijos (`ndciThreshold`, `faiThreshold`) o activa `adaptiveThreshold` para calcular percentiles locales (P85/P90) y combinarlos con tus límites.
- **Capas resultantes:** Cada llamada a `/api/bloom/map` devuelve cuatro capas (True Color, NDCI, FAI, Bloom) listas para usarse como tiles XYZ.
- **Series temporales:** `/api/bloom/stats` entrega el área diaria (km²) detectada; ideal para gráficas o alertas.

Consejos rápidos:

1. **Costa abierta:** Si queda ruido por rompiente, incrementa `minPixelsClean` a 18–20 o aplica un buffer adicional positivo.
2. **Ancón / aguas someras:** Reduce `cloudPercentage` (<25) y evalúa `faiThreshold` ≥ 0.01 para evitar sedimentos.
3. **Pantanos de Villa:** Usa `buffer` negativo para recortar bordes y mantén `roiType` humedal (se aplica filtro NDVI < 0.3).
4. **Calibración:** Ajusta umbrales con los histogramas e integra muestreos in situ de clorofila-a/ficocianina cuando estén disponibles.

## Bloom Dashboard Web

El archivo `public/index.html` ofrece un panel moderno con mapa Leaflet y gráficas Chart.js que consume los endpoints `/api/bloom/*`:

- **Mapa dinámico:** Capas True Color, NDCI, FAI y Bloom con control de visibilidad.
- **Contexto regional:** Cargado automáticamente tras cada análisis (clorofila MODIS + SST NOAA).
- **Series temporales:** Área diaria de bloom y promedios regionales listos para graficar.
- **Panel de control:** Selección de preset, fechas, umbrales, buffers y modo adaptativo.

### Cómo usarlo

1. Inicia el servidor backend:
   ```bash
   npm start
   ```
2. Abre `http://localhost:3000` en tu navegador.
3. Escoge un preset (p. ej. *costa_metropolitana*), ajusta fechas y pulsa **Actualizar análisis**.
4. Explora los resultados: mapa principal, tarjetas de resumen y series temporales.
5. Ajusta el buffer regional (km) para ampliar/restringir el contexto MODIS/NOAA.

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

## Testing

Las pruebas automáticas validan los endpoints principales (tiles, mapas personalizados y bloom completo). Para ejecutarlas:

1. Abre una terminal y levanta el servidor:
   ```bash
   npm start
   ```
2. En otra terminal ejecuta la suite:
   ```bash
   npm test
   ```

Las pruebas esperan respuestas 200/302 cuando Earth Engine está configurado. Si faltan credenciales, verás `503` como resultado esperado para la mayoría de endpoints.

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