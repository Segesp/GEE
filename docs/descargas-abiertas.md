# 📥 Descargas Abiertas (CSV/GeoJSON)

## Objetivo

Promover la **transparencia** y **reutilización** de datos mediante la descarga de reportes ciudadanos y capas derivadas en formatos estándar abiertos (CSV y GeoJSON).

## Características Principales

### 🎯 Funcionalidades Implementadas

1. **Múltiples Capas de Datos**
   - Todos los reportes ciudadanos
   - Reportes validados por la comunidad
   - Reportes filtrados por categoría (calor, áreas verdes, inundación, residuos)
   - Agregaciones por barrio
   - Resultados de micro-encuestas

2. **Formatos de Exportación**
   - **CSV**: Compatible con Excel, análisis estadístico, bases de datos
   - **GeoJSON**: Compatible con QGIS, ArcGIS, Leaflet, Mapbox

3. **Filtros Avanzados**
   - Rango de fechas (inicio-fin)
   - Categoría de reporte
   - Severidad
   - Estado (abierto, en progreso, resuelto)
   - Solo reportes validados

4. **Metadatos de Calidad**
   - Licencia CC BY 4.0
   - Atribución a "EcoPlan Community"
   - Fecha de generación
   - Conteo de registros
   - ID único de descarga
   - Información de contacto

---

## API Endpoints

### 1. Listar Capas Disponibles

```http
GET /api/exports/layers
```

**Respuesta:**
```json
{
  "layers": [
    {
      "id": "citizen-reports",
      "name": "Reportes Ciudadanos",
      "description": "Todos los reportes enviados por la comunidad",
      "formats": ["csv", "geojson"]
    },
    {
      "id": "validated-reports",
      "name": "Reportes Validados",
      "description": "Reportes confirmados por la comunidad",
      "formats": ["csv", "geojson"]
    }
  ],
  "totalLayers": 8
}
```

---

### 2. Descargar Datos

```http
GET /api/exports/download?layer={layerId}&format={format}
```

**Parámetros Query:**

| Parámetro | Tipo | Requerido | Descripción |
|-----------|------|-----------|-------------|
| `layer` | string | ✅ Sí | ID de la capa a descargar |
| `format` | string | ✅ Sí | `csv` o `geojson` |
| `startDate` | string | ❌ No | Fecha inicio (YYYY-MM-DD) |
| `endDate` | string | ❌ No | Fecha fin (YYYY-MM-DD) |
| `category` | string | ❌ No | Filtrar por categoría |
| `severity` | string | ❌ No | Filtrar por severidad |
| `status` | string | ❌ No | Filtrar por estado |
| `onlyValidated` | boolean | ❌ No | Solo reportes validados |

**Headers de Respuesta:**
```
Content-Type: text/csv; charset=utf-8
Content-Disposition: attachment; filename="ecoplan-citizen-reports-2025-10-05.csv"
X-Download-ID: a1b2c3d4e5f6
X-Record-Count: 1523
X-Generated: 2025-10-05T12:30:00.000Z
```

**Ejemplo CSV:**
```csv
ID,Categoría,Latitud,Longitud,Descripción,Severidad,Estado,Fecha Creación,Fecha Actualización,Estado Validación,Confirmaciones,Rechazos,Validado por Moderador
53e9c185,heat,-12.0464,-77.0428,"Isla de calor extrema",high,open,2025-10-05T02:55:51.517Z,2025-10-05T02:55:51.517Z,pending,0,0,No
```

**Ejemplo GeoJSON:**
```json
{
  "type": "FeatureCollection",
  "metadata": {
    "generated": "2025-10-05T12:30:00.000Z",
    "count": 1523,
    "source": "EcoPlan Citizen Reports",
    "license": "CC BY 4.0",
    "attribution": "EcoPlan Community"
  },
  "features": [
    {
      "type": "Feature",
      "geometry": {
        "type": "Point",
        "coordinates": [-77.0428, -12.0464]
      },
      "properties": {
        "id": "53e9c185",
        "category": "heat",
        "description": "Isla de calor extrema",
        "severity": "high",
        "status": "open",
        "createdAt": "2025-10-05T02:55:51.517Z",
        "validationStatus": "pending",
        "confirmations": 0,
        "rejections": 0
      }
    }
  ]
}
```

---

### 3. Estadísticas de Descargas

```http
GET /api/exports/stats
```

**Parámetros Query (opcionales):**
- `startDate`: Fecha inicio
- `endDate`: Fecha fin
- `layerId`: Filtrar por capa
- `format`: Filtrar por formato

**Respuesta:**
```json
{
  "stats": {
    "totalDownloads": 1247,
    "byFormat": {
      "csv": 823,
      "geojson": 424
    },
    "byLayer": {
      "citizen-reports": 564,
      "validated-reports": 312,
      "heat-reports": 201
    },
    "byDate": {
      "2025-10-05": 45,
      "2025-10-04": 38
    },
    "recentDownloads": [
      {
        "downloadId": "a1b2c3d4",
        "layerId": "citizen-reports",
        "format": "csv",
        "timestamp": "2025-10-05T12:30:00.000Z",
        "recordCount": 1523
      }
    ]
  },
  "topLayers": [
    {
      "layerId": "citizen-reports",
      "name": "Reportes Ciudadanos",
      "downloads": 564
    }
  ]
}
```

---

### 4. Metadatos de Capa

```http
GET /api/exports/metadata/{layerId}?format={format}
```

**Respuesta:**
```json
{
  "layerId": "citizen-reports",
  "layerName": "Reportes Ciudadanos",
  "format": "csv",
  "recordCount": 1523,
  "generated": "2025-10-05T12:30:00.000Z",
  "license": "CC BY 4.0",
  "attribution": "EcoPlan Community",
  "source": "EcoPlan Citizen Science Platform",
  "version": "1.0",
  "description": "Todos los reportes enviados por la comunidad",
  "contact": "https://github.com/Segesp/GEE"
}
```

---

## Interfaz de Usuario

### Ubicación

La sección de **Descargas Abiertas** se encuentra en el panel lateral derecho de la interfaz de "Explorar Reportes", después de la sección de Capas Satelitales.

### Controles

1. **Selector de Capa**: Dropdown con 8 capas disponibles
2. **Selector de Formato**: CSV o GeoJSON
3. **Checkbox "Solo validados"**: Filtrar reportes confirmados
4. **Filtro de Fechas (Opcional)**: Acordeón con rango de fechas
5. **Botón de Descarga**: Genera y descarga el archivo
6. **Info de Licencia**: CC BY 4.0 con atribución
7. **Estadísticas de Uso**: Total de descargas y de la semana

### Experiencia de Usuario

1. **Selección**: Usuario elige capa y formato
2. **Feedback Visual**: 
   - Botón cambia a "⏳ Generando descarga..."
   - Al completar: "✅ Descargado (N registros)"
3. **Notificación**: Toast animado con ID de descarga
4. **Archivo**: Descarga automática del navegador

---

## Capas Disponibles

### 1. Reportes Ciudadanos
- **ID**: `citizen-reports`
- **Formatos**: CSV, GeoJSON
- **Campos**: 13 columnas con datos completos + validación

### 2. Reportes Validados
- **ID**: `validated-reports`
- **Formatos**: CSV, GeoJSON
- **Filtro**: Solo reportes confirmados por comunidad

### 3. Reportes de Calor
- **ID**: `heat-reports`
- **Formatos**: CSV, GeoJSON
- **Filtro**: `category = heat`

### 4. Reportes de Áreas Verdes
- **ID**: `green-reports`
- **Formatos**: CSV, GeoJSON
- **Filtro**: `category = green`

### 5. Reportes de Inundación
- **ID**: `flooding-reports`
- **Formatos**: CSV, GeoJSON
- **Filtro**: `category = flooding`

### 6. Reportes de Residuos
- **ID**: `waste-reports`
- **Formatos**: CSV, GeoJSON
- **Filtro**: `category = waste`

### 7. Agregaciones por Barrio
- **ID**: `neighborhood-aggregations`
- **Formatos**: CSV únicamente
- **Datos**: Estadísticas agregadas por barrio/distrito

### 8. Resultados de Micro-encuestas
- **ID**: `survey-results`
- **Formatos**: CSV únicamente
- **Datos**: Respuestas agregadas de micro-encuestas por barrio

---

## Métricas de Éxito

### KPIs Principales

1. **Número de Descargas**
   - Total acumulado
   - Por período (día, semana, mes)
   - Por capa
   - Por formato

2. **Reutilizaciones Reportadas**
   - Menciones en medios
   - Posts en redes sociales
   - Proyectos académicos
   - Análisis independientes

3. **Calidad de Datos**
   - Integridad (% campos completos)
   - Actualidad (tiempo desde última actualización)
   - Cobertura geográfica

---

## Licencia y Atribución

### Licencia: CC BY 4.0

Los datos están bajo licencia **Creative Commons Attribution 4.0 International**.

**Esto significa que puedes:**
- ✅ Compartir: copiar y redistribuir
- ✅ Adaptar: remezclar, transformar y crear a partir del material
- ✅ Uso comercial

**Bajo estas condiciones:**
- 📝 **Atribución**: Debes dar crédito apropiado, proporcionar un enlace a la licencia e indicar si se hicieron cambios

### Atribución Recomendada

```
Datos de EcoPlan Community
Fuente: https://github.com/Segesp/GEE
Licencia: CC BY 4.0
```

---

## Ejemplos de Uso

### 1. Análisis en Excel/Google Sheets

```bash
# Descargar CSV
curl "http://localhost:3000/api/exports/download?layer=citizen-reports&format=csv" -o reportes.csv

# Abrir en Excel
```

### 2. Visualización en QGIS

```bash
# Descargar GeoJSON
curl "http://localhost:3000/api/exports/download?layer=validated-reports&format=geojson" -o reportes-validados.geojson

# Importar en QGIS: Layer > Add Layer > Add Vector Layer
```

### 3. Análisis con Python/Pandas

```python
import pandas as pd
import requests

# Descargar y cargar CSV
url = "http://localhost:3000/api/exports/download?layer=heat-reports&format=csv&onlyValidated=true"
df = pd.read_csv(url)

# Análisis
print(f"Total reportes: {len(df)}")
print(f"Promedio severidad: {df['Severidad'].value_counts()}")
```

### 4. Mapa web con Leaflet

```javascript
// Cargar GeoJSON
fetch('/api/exports/download?layer=citizen-reports&format=geojson')
  .then(res => res.json())
  .then(data => {
    L.geoJSON(data, {
      pointToLayer: (feature, latlng) => {
        return L.circleMarker(latlng, {
          radius: 8,
          fillColor: getCategoryColor(feature.properties.category),
          color: '#fff',
          weight: 1,
          opacity: 1,
          fillOpacity: 0.8
        });
      }
    }).addTo(map);
  });
```

---

## Seguridad y Privacidad

### Datos Incluidos
- ✅ Categoría, ubicación, descripción
- ✅ Severidad, estado, fechas
- ✅ Datos de validación agregados

### Datos Excluidos (Privacidad)
- ❌ Nombres de contacto
- ❌ Emails
- ❌ IPs de usuarios
- ❌ Identificadores de dispositivos
- ❌ Datos personales

### Rate Limiting

- **Límite**: 100 descargas por hora por IP
- **Tamaño máximo**: 50,000 registros por descarga
- **Formatos**: Solo CSV y GeoJSON permitidos

---

## Roadmap

### Fase 1: MVP ✅ (Actual)
- [x] Exportación CSV básica
- [x] Exportación GeoJSON
- [x] Filtros de fecha y categoría
- [x] UI intuitiva
- [x] Estadísticas de descargas

### Fase 2: Mejoras Q1 2026
- [ ] API Key para usuarios registrados
- [ ] Descargas programadas (cron jobs)
- [ ] Formato Shapefile (.shp)
- [ ] Formato KML para Google Earth
- [ ] Webhooks para actualizaciones

### Fase 3: Avanzado Q2 2026
- [ ] API GraphQL para consultas flexibles
- [ ] Data packages (JSON + datos)
- [ ] Streaming para grandes volúmenes
- [ ] Compresión ZIP automática
- [ ] CDN para archivos estáticos

---

## Soporte Técnico

### Problemas Comunes

**1. Error: "Capa no encontrada"**
- Verifica que el `layerId` sea válido
- Consulta `/api/exports/layers` para ver capas disponibles

**2. Error: "GeoJSON no disponible"**
- Algunas capas (agregaciones, encuestas) solo soportan CSV
- Cambia el formato a `csv`

**3. Descarga vacía (0 registros)**
- Revisa tus filtros (fechas, categoría, validación)
- Puede no haber datos que cumplan los criterios

**4. Archivo muy grande**
- Usa filtros de fecha para reducir tamaño
- Considera descargar por categorías

### Contacto

- **GitHub Issues**: https://github.com/Segesp/GEE/issues
- **Documentación**: /docs/
- **Email**: (agregar email de contacto)

---

## Métricas de Impacto

### Objetivos de Reutilización

- **Corto plazo** (3 meses): 50+ descargas, 3+ proyectos usando los datos
- **Medio plazo** (6 meses): 200+ descargas, 10+ menciones en redes/medios
- **Largo plazo** (12 meses): 500+ descargas, 5+ publicaciones académicas

### Tracking

Las descargas se registran con:
- Download ID único
- Timestamp
- IP address (anonimizada)
- User agent
- Capa y formato
- Filtros aplicados

---

## Changelog

### v1.0.0 - 2025-10-05
- ✅ Implementación inicial
- ✅ 8 capas disponibles
- ✅ Formatos CSV y GeoJSON
- ✅ Filtros avanzados
- ✅ UI integrada
- ✅ Estadísticas de uso
- ✅ Licencia CC BY 4.0
