# 🚀 Guía de Inicio Rápido - EcoPlan GEE

> **Documentación consolidada de todas las guías de inicio rápido del proyecto**

## 📑 Índice de Contenidos

1. [Guía General de Inicio Rápido](#guía-general)
2. [Módulo: Calidad de Aire y Agua](#módulo-aire-agua)
3. [Módulo: Índices Compuestos](#módulo-indices)
4. [Módulo: Datos Socioeconómicos](#módulo-socioeconomico)
5. [Módulo: Vegetación e Islas de Calor](#módulo-vegetacion)

---

# 🚀 Guía de Inicio Rápido - EcoPlan

## Bienvenido a EcoPlan

EcoPlan es una plataforma de ciencia ciudadana que combina reportes comunitarios con datos satelitales para monitorear y mejorar la calidad ambiental urbana.

---

## 🎯 ¿Qué puedo hacer con EcoPlan?

### Para Ciudadanos 👥

1. **Reportar Problemas Ambientales** 📸
   - Tomar foto del problema
   - Agregar ubicación GPS automática
   - Elegir categoría (calor, áreas verdes, inundación, etc.)
   - Enviar reporte en segundos

2. **Validar Reportes de Otros** ✅
   - Ver reportes cercanos
   - Votar "Confirmo" o "No es así"
   - Ayudar a filtrar reportes legítimos

3. **Responder Micro-encuestas** 📋
   - 1 clic por pregunta (sin teclado)
   - Agregar contexto valioso
   - Ver progreso del barrio

4. **Explorar el Mapa** 🗺️
   - Ver todos los reportes
   - Filtrar por categoría/severidad
   - Ver capas satelitales (NDVI, LST, PM2.5)

### Para Investigadores 🔬

1. **Descargar Datos Abiertos** 📥
   - Formato CSV para análisis estadístico
   - Formato GeoJSON para mapas
   - Licencia CC BY 4.0 (uso libre con atribución)
   - 8 capas disponibles

2. **Analizar Tendencias** 📊
   - Reportes por barrio
   - Series temporales
   - Correlaciones con datos satelitales
   - Resultados de encuestas agregados

3. **Publicar Investigaciones** 📄
   - Dataset citable
   - Metadatos completos
   - Atribución: "EcoPlan Community"

### Para Autoridades 🏛️

1. **Priorizar Acciones** 🎯
   - Ver reportes más urgentes
   - Identificar zonas críticas
   - Datos validados por la comunidad

2. **Monitorear Impacto** 📈
   - Antes y después de intervenciones
   - Reportes resueltos vs pendientes
   - Satisfacción ciudadana

3. **Tomar Decisiones Basadas en Datos** 💡
   - Evidencia georreferenciada
   - Correlación con índices satelitales
   - Participación ciudadana transparente

---

## 🚀 Inicio Rápido (5 minutos)

### Paso 1: Acceder a la Plataforma

```
👉 Abrir: http://localhost:3000
```

### Paso 2: Explorar el Mapa

1. Click en **"Explorar Reportes"**
2. Ver reportes existentes en el mapa
3. Usar filtros para refinar búsqueda
4. Click en un marcador para ver detalles

### Paso 3: Crear un Reporte

1. Click en **"➕ Nuevo Reporte"**
2. Tomar foto o subir desde galería
3. Elegir categoría (ej: 🔥 Calor)
4. Seleccionar severidad (baja/media/alta/crítica)
5. Agregar descripción
6. Click en **"📤 Enviar Reporte"**

### Paso 4: Validar Reportes

1. En el mapa, click en un reporte
2. En el popup, click **"Confirmo"** o **"No es así"**
3. ¡Listo! Tu validación se registra

### Paso 5: Responder Micro-encuesta

1. Ver un reporte en detalle
2. Aparecer preguntas con chips
3. Click en la respuesta que aplica
4. Ver mensaje de agradecimiento + progreso del barrio

### Paso 6: Descargar Datos

1. Scroll a **"📥 Descargas Abiertas"**
2. Seleccionar capa (ej: "Todos los reportes")
3. Elegir formato (CSV o GeoJSON)
4. Click en **"Descargar Datos"**
5. Archivo descarga automáticamente

---

## 💻 Para Desarrolladores

### Instalación Local

```bash
# 1. Clonar repositorio
git clone https://github.com/Segesp/GEE.git
cd GEE

# 2. Instalar dependencias
npm install

# 3. Configurar credenciales de Google Earth Engine
cp service-account.json.example service-account.json
# Editar service-account.json con tus credenciales

# 4. Iniciar servidor
npm start

# 5. Abrir navegador
open http://localhost:3000
```

### Ejecutar Tests

```bash
# Tests de validación comunitaria (11 casos)
./tests/test-validation.sh

# Tests de micro-encuestas (15 casos)
./tests/test-microencuestas.sh

# Tests de descargas abiertas (15 casos)
./tests/test-descargas.sh
```

### Estructura del Código

```
GEE/
├── services/              # Lógica de negocio
│   ├── reportValidationService.js
│   ├── microSurveyService.js
│   └── dataExportService.js
├── public/
│   └── index.html         # Frontend (Leaflet + UI)
├── docs/                  # Documentación técnica
│   ├── validation-comunitaria.md
│   ├── microencuestas-schema.sql
│   └── descargas-abiertas.md
├── tests/                 # Tests automatizados
│   ├── test-validation.sh
│   ├── test-microencuestas.sh
│   └── test-descargas.sh
└── server.js              # API REST (Express)
```

---

## 📚 Documentación Completa

### Guías de Usuario

- **Índice General**: [`INDICE-PROYECTO.md`](INDICE-PROYECTO.md)
- **Manual de Exploración**: [`docs/mvp-fase-explorar.md`](docs/mvp-fase-explorar.md)

### Documentación Técnica

1. **Validación Comunitaria**
   - Manual técnico: [`docs/validation-comunitaria.md`](docs/validation-comunitaria.md)
   - Resumen ejecutivo: [`IMPLEMENTACION-VALIDACION.md`](IMPLEMENTACION-VALIDACION.md)
   - Quick start: [`VALIDACION-RESUMEN.md`](VALIDACION-RESUMEN.md)

2. **Micro-encuestas**
   - Schema SQL: [`docs/microencuestas-schema.sql`](docs/microencuestas-schema.sql)

3. **Descargas Abiertas**
   - Manual completo: [`docs/descargas-abiertas.md`](docs/descargas-abiertas.md)
   - Resumen ejecutivo: [`IMPLEMENTACION-DESCARGAS.md`](IMPLEMENTACION-DESCARGAS.md)

### API Reference

Ver [`docs/descargas-abiertas.md`](docs/descargas-abiertas.md) para:
- 18 endpoints REST documentados
- Ejemplos de uso con curl
- Parámetros y respuestas
- Códigos de error

---

## 🎨 Casos de Uso Reales

### Caso 1: Investigación Académica

**Objetivo**: Analizar correlación entre islas de calor y falta de vegetación

```python
import pandas as pd
import geopandas as gpd
import matplotlib.pyplot as plt

# Descargar reportes de calor
heat_reports = pd.read_csv('http://localhost:3000/api/exports/download?layer=heat-reports&format=csv')

# Descargar reportes de áreas verdes
green_reports = gpd.read_file('http://localhost:3000/api/exports/download?layer=green-reports&format=geojson')

# Análisis espacial
# ... tu código aquí ...

# Publicar paper con atribución:
# "Datos de EcoPlan Community (CC BY 4.0)"
```

### Caso 2: Periodismo de Datos

**Objetivo**: Investigar zonas más afectadas por acumulación de residuos

```bash
# Descargar reportes de basura validados
curl "http://localhost:3000/api/exports/download?layer=waste-reports&format=csv&onlyValidated=true" -o basura-validada.csv

# Abrir en Excel/Google Sheets
# Crear tabla dinámica por barrio
# Generar gráficos para artículo
```

### Caso 3: Planificación Urbana Municipal

**Objetivo**: Priorizar inversión en áreas verdes

```bash
# Descargar agregaciones por barrio
curl "http://localhost:3000/api/exports/download?layer=neighborhood-aggregations&format=csv" -o barrios-stats.csv

# Importar en GIS (QGIS/ArcGIS)
# Cruzar con presupuesto municipal
# Generar mapa de prioridades
```

### Caso 4: Aplicación Web Personalizada

```javascript
// Cargar reportes en mapa web
fetch('/api/exports/download?layer=citizen-reports&format=geojson')
  .then(res => res.json())
  .then(data => {
    // Agregar a tu mapa Leaflet/Mapbox
    L.geoJSON(data, {
      onEachFeature: (feature, layer) => {
        layer.bindPopup(`
          <h3>${feature.properties.category}</h3>
          <p>${feature.properties.description}</p>
          <small>Severidad: ${feature.properties.severity}</small>
        `);
      }
    }).addTo(map);
  });
```

---

## 🤝 Contribuir

### ¿Cómo puedo ayudar?

1. **Reportar Problemas** 🐛
   - Encontraste un bug? [Crear issue](https://github.com/Segesp/GEE/issues)

2. **Sugerir Mejoras** 💡
   - Tienes ideas? [Abrir discussion](https://github.com/Segesp/GEE/discussions)

3. **Escribir Código** 👨‍💻
   - Fork del repo
   - Crear branch: `feature/mi-mejora`
   - Hacer commit
   - Abrir Pull Request

4. **Mejorar Documentación** 📝
   - Traducir a otros idiomas
   - Agregar tutoriales
   - Corregir errores

5. **Compartir Datos** 📊
   - Usar EcoPlan en tu ciudad
   - Publicar análisis
   - Mencionar en redes sociales

---

## 📊 Estadísticas del Proyecto

- **10,275 líneas de código** (backend + frontend + tests + docs)
- **41 tests automatizados** con ~93% passing
- **18 endpoints REST API** funcionales
- **8 capas de datos** disponibles para descarga
- **3 schemas SQL** para PostgreSQL/PostGIS
- **12 documentos técnicos** completos

---

## 🏆 Reconocimientos

Este proyecto está diseñado para promover:

- 🌍 **Ciencia Ciudadana**: Empoderamiento comunitario
- 🔓 **Datos Abiertos**: Transparencia total (CC BY 4.0)
- 🤝 **Colaboración**: Trabajo conjunto ciudadanos-gobierno
- 🌱 **Sostenibilidad**: Mejora del medio ambiente urbano
- 📈 **Evidencia**: Decisiones basadas en datos

---

## 📞 Soporte

- **GitHub Issues**: https://github.com/Segesp/GEE/issues
- **Documentación**: `/docs/`
- **Email**: (agregar email de contacto)

---

## 📜 Licencia

- **Código**: MIT License
- **Datos**: CC BY 4.0 (Creative Commons Attribution)
- **Documentación**: CC BY 4.0

---

## 🎉 ¡Empieza Ahora!

```bash
# 1. Instalar
git clone https://github.com/Segesp/GEE.git
cd GEE && npm install

# 2. Configurar
cp service-account.json.example service-account.json

# 3. Iniciar
npm start

# 4. Explorar
open http://localhost:3000
```

**¿Preguntas?** Lee la documentación en [`INDICE-PROYECTO.md`](INDICE-PROYECTO.md)

---

**EcoPlan** - Ciencia Ciudadana para un Futuro Sostenible 🌱
# 🚀 Inicio Rápido: Calidad de Aire y Agua

## ⚡ Acceso Inmediato (< 2 minutos)

### Opción 1: Demo Web Local

```bash
# Acceder directamente a la interfaz
http://localhost:3000/calidad-aire-agua.html
```

**¿Qué verás?**
- 🌍 Mapa interactivo de Lima Metropolitana
- 📊 Panel de controles (fecha, variables, configuración)
- 🎨 4 tabs para cambiar entre AOD, NO₂, Clorofila y NDWI
- 📈 Leyendas científicas dinámicas
- 📅 2,100+ días de datos disponibles (2020-presente)

---

## 🛠️ Opciones de Uso

### A. Visualización Rápida (Solo ver la interfaz)

1. **Abrir navegador**:
   ```
   http://localhost:3000/calidad-aire-agua.html
   ```

2. **Explorar controles**:
   - Selecciona una fecha (2020-01-01 a hoy)
   - Marca/desmarca variables (AOD, NO₂, Clorofila, NDWI)
   - Cambia entre tabs para ver diferentes leyendas
   - Haz clic en "Cargar Datos" (muestra alerta informativa)

3. **Ver mapa**:
   - Zoom in/out con scroll o controles
   - Pan arrastrando el mapa
   - Observa el rectángulo azul (área de Lima)

**Duración**: 2-5 minutos

---

### B. Análisis Real con Google Earth Engine

#### Requisitos Previos
- ✅ Cuenta de Google (Gmail)
- ✅ Navegador web moderno (Chrome, Firefox, Edge)

#### Pasos

**1. Obtener el script GEE**
```bash
# Ver el script en tu editor local
cat /workspaces/GEE/docs/calidad-aire-agua-gee-script.js

# O abrirlo con VS Code
code /workspaces/GEE/docs/calidad-aire-agua-gee-script.js
```

**2. Ir a Google Earth Engine Code Editor**
```
https://code.earthengine.google.com/
```

- Inicia sesión con tu cuenta de Google
- Si es primera vez, acepta los términos de uso
- Espera a que cargue el editor (~10 segundos)

**3. Copiar y pegar el script**
- Selecciona **todo** el contenido de `calidad-aire-agua-gee-script.js`
- Cópialo (Ctrl+C / Cmd+C)
- Pégalo en el panel de código del editor GEE (Ctrl+V / Cmd+V)

**4. Ejecutar**
- Haz clic en el botón **"Run"** (arriba del editor)
- O presiona **F5**
- Espera ~30-60 segundos (procesa miles de imágenes)

**5. Visualizar resultados**

En el **mapa** (derecha):
- 🔴 **AOD** - Aerosoles (capa roja)
- 🟡 **NO₂** - Dióxido de nitrógeno (capa amarilla)
- 🟢 **Clorofila** - Calidad de agua (capa verde)
- 🔵 **NDWI** - Índice de agua (capa azul)

En la **consola** (derecha abajo):
- 📊 4 gráficos de series temporales (2020-2025)
- 📈 Estadísticas zonales (media, mín, máx, desv. est.)
- 🏘️ Tabla de 7 distritos con valores
- ⚠️ Alertas (áreas con AOD > 0.3, NO₂ > 150)
- 🌐 URLs de GIBS/Worldview

**Duración**: 5-10 minutos

---

### C. Automatización Diaria (Avanzado)

#### Opción C1: Script Python Local

**1. Instalar dependencias**
```bash
pip install requests
```

**2. Crear script de descarga**
```python
# download_gibs.py
import requests
from datetime import datetime

GIBS_URL = "https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi"
BBOX = "-77.2,-12.4,-76.7,-11.7"
DATE = datetime.now().strftime('%Y-%m-%d')

params = {
    'SERVICE': 'WMS',
    'VERSION': '1.3.0',
    'REQUEST': 'GetMap',
    'FORMAT': 'image/png',
    'LAYERS': 'MODIS_Terra_Aerosol',
    'CRS': 'EPSG:4326',
    'BBOX': BBOX,
    'WIDTH': '1024',
    'HEIGHT': '1024',
    'TIME': DATE
}

response = requests.get(GIBS_URL, params=params)

if response.status_code == 200:
    with open(f'AOD_{DATE}.png', 'wb') as f:
        f.write(response.content)
    print(f"✅ Descargado AOD para {DATE}")
else:
    print(f"❌ Error: {response.status_code}")
```

**3. Ejecutar**
```bash
python download_gibs.py
```

**4. Automatizar con cron (Linux/macOS)**
```bash
# Editar crontab
crontab -e

# Añadir línea (ejecutar diariamente a las 8 AM)
0 8 * * * /usr/bin/python3 /path/to/download_gibs.py >> /var/log/ecoplan_gibs.log 2>&1
```

**Duración configuración**: 10-15 minutos  
**Ejecución automática**: Diaria

---

#### Opción C2: Google Cloud Function

**1. Crear archivo `main.py`**
```python
import ee

def download_gee_daily(request):
    ee.Initialize()
    
    lima = ee.Geometry.Rectangle([-77.2, -12.4, -76.7, -11.7])
    
    aod = ee.ImageCollection('MODIS/061/MCD19A2_GRANULES') \
        .filterBounds(lima) \
        .filterDate('2025-10-05', '2025-10-06') \
        .select('Optical_Depth_055') \
        .first() \
        .multiply(0.001)
    
    stats = aod.reduceRegion(
        reducer=ee.Reducer.mean(),
        geometry=lima,
        scale=1000
    ).getInfo()
    
    return {'status': 'success', 'aod_mean': stats.get('Optical_Depth_055')}
```

**2. Desplegar**
```bash
gcloud functions deploy download_gee_daily \
    --runtime python39 \
    --trigger-http \
    --allow-unauthenticated \
    --schedule "0 8 * * *"
```

**Duración configuración**: 20-30 minutos  
**Ejecución automática**: Diaria

---

## 📚 Documentación Completa

### Para Aprender Más

| Documento | Contenido | Líneas | Audiencia |
|-----------|-----------|--------|-----------|
| **calidad-aire-agua.md** | Metodología, implementación, casos de uso, limitaciones | ~1,400 | Desarrolladores, investigadores |
| **COMPLETADO-CALIDAD-AIRE-AGUA.md** | Resumen ejecutivo, archivos creados, estadísticas | ~600 | Gestores, stakeholders |
| **INICIO-RAPIDO-CALIDAD-AIRE-AGUA.md** | Esta guía (inicio rápido) | ~200 | Todos |

### Ubicación de Archivos

```
/workspaces/GEE/
├── public/
│   └── calidad-aire-agua.html          ← Interfaz web
├── docs/
│   ├── calidad-aire-agua-gee-script.js ← Script GEE completo
│   └── calidad-aire-agua.md            ← Documentación técnica
├── COMPLETADO-CALIDAD-AIRE-AGUA.md     ← Resumen de implementación
└── INICIO-RAPIDO-CALIDAD-AIRE-AGUA.md  ← Esta guía
```

---

## ❓ Preguntas Frecuentes

### ¿Necesito instalar algo para ver la demo web?
**No**. Solo abre `http://localhost:3000/calidad-aire-agua.html` en tu navegador (el servidor Node.js ya debe estar corriendo).

### ¿Necesito cuenta de Google Earth Engine?
**Sí, solo si quieres ejecutar el script GEE**. La cuenta es gratuita para uso no comercial. Regístrate en: https://earthengine.google.com/signup/

### ¿Los datos en la demo web son reales?
**No**. La interfaz web actual es una demo que muestra el diseño y controles. Para datos reales, ejecuta el script GEE en Code Editor.

### ¿Puedo usar esto para otras ciudades?
**Sí**. Solo cambia el `bbox` en el script GEE:
```javascript
var limaBounds = ee.Geometry.Rectangle({
  coords: [lon_min, lat_min, lon_max, lat_max],
  geodesic: false
});
```

### ¿Cuánto tiempo toma procesar los datos en GEE?
**~30-60 segundos** para todo el script completo (2020-2025, 4 variables, análisis, series temporales).

### ¿Puedo descargar los datos?
**Sí**. Descomenta las secciones `Export.image.toDrive()` o `Export.table.toDrive()` en el script GEE y ejecuta. Los archivos se guardarán en tu Google Drive.

### ¿Qué significa "NRTI"?
**Near Real-Time** (Casi tiempo real). Los datos están disponibles ~3 horas después de la observación satelital.

### ¿Cómo interpreto AOD = 0.25?
**Moderado**. Ver tabla en `docs/calidad-aire-agua.md` sección 5.1:
- 0.0-0.1: Excelente
- 0.1-0.2: Bueno
- 0.2-0.3: Moderado ← Aquí
- 0.3-0.5: Malo
- >0.5: Muy malo

### ¿Los datos funcionan en Lima durante el invierno (mayo-octubre)?
**Sí**. Aunque Lima tiene mayor cobertura nubosa en invierno (~20%), los satélites MODIS y Sentinel-5P tienen buena penetración y algoritmos de filtrado de nubes.

### ¿Puedo integrar esto con mi aplicación?
**Sí** (futuro). La Fase 2 del roadmap incluye una API REST con endpoints HTTP. Por ahora, puedes ejecutar el script GEE y exportar datos para consumo externo.

---

## 🎯 Casos de Uso Rápidos

### 1. Monitorear Calidad del Aire Hoy

```javascript
// En GEE Code Editor, modifica la fecha:
var singleDate = '2025-10-05'; // HOY

// Ejecuta el script
// Observa el mapa: ¿Zonas rojas (AOD alto) o amarillas (NO₂ alto)?
```

**Interpretación**:
- Zonas rojas = Alta contaminación particulada (tráfico, industria, polvo)
- Zonas amarillas = Alto NO₂ (combustión vehicular)

### 2. Detectar Eventos Extremos

```javascript
// Buscar en la consola GEE:
print('Área con alerta combinada (km²):', ...);

// Si > 100 km² → Evento significativo
// Si > 500 km² → Evento extremo (requiere acción inmediata)
```

### 3. Comparar con Mes Anterior

```javascript
// Cambiar fechas:
var startDate = '2025-09-01';
var endDate = '2025-09-30';

// Ejecutar
// Comparar series temporales: ¿Tendencia creciente o decreciente?
```

---

## 🔗 Enlaces Útiles

- **Demo Web**: http://localhost:3000/calidad-aire-agua.html
- **GEE Code Editor**: https://code.earthengine.google.com/
- **NASA Worldview**: https://worldview.earthdata.nasa.gov/
- **GIBS API Docs**: https://nasa-gibs.github.io/gibs-api-docs/
- **GEE Datasets**: https://developers.google.com/earth-engine/datasets

---

## 📞 Soporte

**¿Problemas o dudas?**

1. Revisa `docs/calidad-aire-agua.md` (documentación completa)
2. Revisa `COMPLETADO-CALIDAD-AIRE-AGUA.md` (resumen ejecutivo)
3. Contacta: ayuda@ecoplan.gob.pe
4. GitHub Issues: https://github.com/Segesp/GEE/issues

---

**⏱️ Tiempo estimado para estar operativo**: **< 10 minutos**

**⭐ ¡Comienza a monitorear la calidad de aire y agua de Lima ahora mismo!**
# 🚀 INICIO RÁPIDO - ÍNDICES AMBIENTALES COMPUESTOS

## ⚡ Prueba en 60 Segundos

### 1. Iniciar servidor (si no está corriendo)
```bash
cd /workspaces/GEE
node server.js
```

### 2. Probar endpoint principal
```bash
curl -s "http://localhost:3000/api/composite-indices/miraflores" | jq '.totalIndex, .indices.heatVulnerability.value'
```

**Salida esperada**:
```
0.314
0.569
```

### 3. Abrir en navegador
```
http://localhost:3000
```

Hacer scroll hasta la sección **"Índices Ambientales Compuestos"** (icono 🎯)

---

## 🎮 DEMO RÁPIDA

### Ejemplo 1: Ver índices de un barrio
```bash
curl -s "http://localhost:3000/api/composite-indices/barranco" | jq '{
  barrio: .neighborhoodName,
  indice_total: .totalIndex,
  calor: .indices.heatVulnerability.value,
  verde: .indices.greenSpaceDeficit.value,
  contaminacion: .indices.airPollution.value,
  agua: .indices.waterRisk.value
}'
```

### Ejemplo 2: Comparar 3 barrios
```bash
curl -s -X POST "http://localhost:3000/api/composite-indices/compare" \
  -H "Content-Type: application/json" \
  -d '{"neighborhoodIds": ["miraflores", "san-isidro", "barranco"]}' \
  | jq 'map({barrio: .neighborhoodName, total: .totalIndex})'
```

### Ejemplo 3: Simular escenario de mejora
```bash
curl -s -X POST "http://localhost:3000/api/composite-indices/scenario" \
  -H "Content-Type: application/json" \
  -d '{
    "neighborhoodId": "miraflores",
    "changes": {
      "vegetationIncrease": 0.3,
      "pollutionReduction": 0.2,
      "greenSpaceIncrease": 3
    }
  }' | jq '{
    antes: .before.totalIndex,
    despues: .after.totalIndex,
    mejora_porcentual: (.improvements.total * 100 | floor)
  }'
```

### Ejemplo 4: Pesos personalizados
```bash
curl -s -X POST "http://localhost:3000/api/composite-indices/custom-weights" \
  -H "Content-Type: application/json" \
  -d '{
    "neighborhoodId": "miraflores",
    "weights": {
      "heat": 0.5,
      "green": 0.2,
      "pollution": 0.2,
      "water": 0.1
    }
  }' | jq '.totalIndex'
```

---

## 🖥️ DEMO FRONTEND

### Paso a paso:

1. **Abrir**: http://localhost:3000
2. **Buscar sección**: "Índices Ambientales Compuestos" (🎯)
3. **Seleccionar barrio**: "Miraflores" en el dropdown
4. **Esperar cálculo**: ~9 segundos (Earth Engine procesando)
5. **Ver resultados**:
   - Tarjeta principal muestra índice total: **0.31**
   - 4 tarjetas coloreadas con cada índice
   - Gráfico radar visualizando los 4 valores

6. **Probar pesos personalizados**:
   - Mover slider "Calor" a 0.40
   - Mover slider "Verde" a 0.30
   - Mover slider "Contaminación" a 0.20
   - Mover slider "Agua" a 0.10
   - Verificar que suma = 1.00 (indicador verde)
   - Clicar "Aplicar pesos personalizados"
   - Ver nuevo índice total recalculado

7. **Simular escenario**:
   - Mover slider "Aumento vegetación" a 25%
   - Mover slider "Reducción contaminación" a 15%
   - Mover slider "Áreas verdes adicionales" a 2 m²/hab
   - Clicar "🎬 Simular escenario"
   - Ver mejoras proyectadas en cada índice

8. **Ver detalles**:
   - Clicar "Ver componentes" en tarjeta "Vulnerabilidad Calor"
   - Ver popup con componentes: LST, NDVI, densidad, vulnerabilidad
   - Ver fórmula y pesos aplicados

9. **Descargar datos**:
   - Clicar "📥 Descargar datos completos"
   - Se descarga JSON con toda la información

---

## 🧪 EJECUTAR TESTS

```bash
cd /workspaces/GEE
bash tests/test-indices-compuestos.sh
```

**Duración**: ~10 minutos (incluye múltiples llamadas a Earth Engine)

**Tests clave**:
- ✅ Test 3-12: Estructura de datos y componentes
- ✅ Test 13-17: Validación de rangos (0-1)
- ✅ Test 21-25: Simulador de escenarios
- ✅ Test 27-28: Pesos personalizados y validación

---

## 📊 DATOS DE EJEMPLO

### Miraflores
```json
{
  "totalIndex": 0.314,
  "interpretation": "Buena calidad ambiental",
  "indices": {
    "heat": 0.569,          // Alta vulnerabilidad al calor
    "green": 0.053,         // Áreas verdes adecuadas
    "pollution": 0.237,     // Aire de buena calidad
    "water": 0.355          // Riesgo hídrico moderado
  }
}
```

### Barranco
```json
{
  "totalIndex": 0.285,
  "interpretation": "Buena calidad ambiental",
  "indices": {
    "heat": 0.512,          // Vulnerabilidad moderada
    "green": 0.089,         // Áreas verdes cerca del estándar
    "pollution": 0.198,     // Aire limpio
    "water": 0.287          // Riesgo hídrico bajo
  }
}
```

---

## 🔍 VERIFICACIÓN RÁPIDA

### ¿El servidor está corriendo?
```bash
curl -s "http://localhost:3000/" | head -5
```
Debe mostrar HTML.

### ¿El endpoint funciona?
```bash
curl -s "http://localhost:3000/api/composite-indices/miraflores" | jq keys
```
Debe mostrar: `["indices", "metadata", "neighborhoodId", ...]`

### ¿Swagger está accesible?
```bash
curl -s "http://localhost:3000/api-docs" | grep composite-indices
```
Debe mostrar referencias al endpoint.

---

## 🐛 SOLUCIÓN DE PROBLEMAS

### Problema: "Cannot GET /api/composite-indices/..."
**Solución**: Reiniciar servidor
```bash
pkill -f "node server.js"
cd /workspaces/GEE
node server.js
```

### Problema: "Error calculating indices"
**Causas posibles**:
1. Credenciales Earth Engine no válidas
2. Geometría del barrio inválida
3. Timeout de Earth Engine (>30s)

**Solución**:
```bash
# Verificar credenciales
cat service-account.json | jq '.project_id'

# Ver logs del servidor
tail -50 /tmp/server_nuevo.log
```

### Problema: Tests fallan
**Causa**: Servidor no está corriendo o responde lento

**Solución**:
```bash
# Verificar que servidor responde
curl -s "http://localhost:3000/" > /dev/null && echo "OK" || echo "FAIL"

# Aumentar timeout en test script (línea 21)
# TIMEOUT=60  # en lugar de 30
```

---

## 📚 RECURSOS ADICIONALES

- **Documentación completa**: `/workspaces/GEE/IMPLEMENTACION-INDICES-COMPUESTOS.md`
- **Guía de completitud**: `/workspaces/GEE/COMPLETADO-INDICES-COMPUESTOS.md`
- **Swagger UI**: http://localhost:3000/api-docs
- **Tests**: `/workspaces/GEE/tests/test-indices-compuestos.sh`
- **Servicio backend**: `/workspaces/GEE/services/compositeIndicesService.js`
- **Frontend JS**: `/workspaces/GEE/public/js/compositeIndices.js`

---

## 🎯 CASOS DE USO RÁPIDOS

### Caso 1: Identificar barrio más vulnerable al calor
```bash
for barrio in miraflores san-isidro surquillo barranco surco san-borja; do
  echo -n "$barrio: "
  curl -s "http://localhost:3000/api/composite-indices/$barrio" \
    | jq -r '.indices.heatVulnerability.value'
done | sort -t: -k2 -nr
```

### Caso 2: Ranking de calidad ambiental
```bash
for barrio in miraflores san-isidro surquillo barranco surco san-borja; do
  echo -n "$barrio: "
  curl -s "http://localhost:3000/api/composite-indices/$barrio" \
    | jq -r '.totalIndex'
done | sort -t: -k2 -n
```

### Caso 3: Evaluar impacto de intervención
```bash
# Simular agregar 5 m²/hab de áreas verdes en Surquillo
curl -s -X POST "http://localhost:3000/api/composite-indices/scenario" \
  -H "Content-Type: application/json" \
  -d '{
    "neighborhoodId": "surquillo",
    "changes": {
      "vegetationIncrease": 0,
      "pollutionReduction": 0,
      "greenSpaceIncrease": 5
    }
  }' | jq '{
    verde_antes: .before.indices.greenSpaceDeficit.value,
    verde_despues: .after.indices.greenSpaceDeficit.value,
    mejora_puntos: ((.before.indices.greenSpaceDeficit.value - .after.indices.greenSpaceDeficit.value) * 100 | round / 100)
  }'
```

---

## ✅ CHECKLIST DE VERIFICACIÓN

- [ ] Servidor corriendo en puerto 3000
- [ ] Endpoint `/api/composite-indices/miraflores` responde
- [ ] Frontend muestra sección "Índices Ambientales Compuestos"
- [ ] Gráfico radar se renderiza correctamente
- [ ] Pesos personalizados suman 1.0 y se aplican
- [ ] Simulador de escenarios funciona
- [ ] Botón de descarga genera JSON
- [ ] Tests pasan (al menos los primeros 20)

---

**¿Listo?** ¡Abre http://localhost:3000 y explora los índices ambientales! 🚀
# 🚀 Inicio Rápido: Datos Socioeconómicos

## En 60 segundos

### 1. Iniciar servidor (10 segundos)
```bash
cd /workspaces/GEE
npm start
```

### 2. Abrir navegador (5 segundos)
```
http://localhost:3000
```

### 3. Scroll hasta sección (5 segundos)
Buscar el icono **📊 Datos Socioeconómicos**

### 4. Seleccionar y explorar (40 segundos)
```
Barrio: Miraflores
Año: 2020
[Automático] → Ver resultados
```

## ¡Listo! 🎉

---

## Ejemplo de Resultado

```
🏘️ MIRAFLORES (2020)
═══════════════════════════════════════════

Barrio con densidad de 10,210 hab/km². 
Privación moderada. 
Área verde: 5.3 m²/persona

👥 POBLACIÓN: 197,473 habitantes
   Densidad: 10,210 hab/km²
   Área: 19.34 km²

🏥 SERVICIOS: 1.09 per cápita
   4 hospitales
   39 colegios
   5.3 m²/hab de parques

📉 PRIVACIÓN: 0.374 (Moderada)
   Luminosidad: 59.34 nW·cm⁻²·sr⁻¹
   Acceso verde: 0.065
```

---

## Pruebas Rápidas

### Test API
```bash
curl http://localhost:3000/api/socioeconomic/miraflores?year=2020 | jq
```

### Test Suite Completa
```bash
bash tests/test-datos-socioeconomicos.sh
```

### Ver Documentación
```bash
open http://localhost:3000/api-docs
```

---

## Descargar Datos

1. Click en **📥 Descargar datos**
2. Elegir formato:
   - **1** = JSON (para programadores)
   - **2** = CSV (para Excel)
3. Archivo descargado automáticamente

---

## Casos de Uso Express

### Comparar 2 barrios
```bash
# Miraflores
curl -s http://localhost:3000/api/socioeconomic/miraflores?year=2020 | jq '.population.densityMean'

# San Isidro
curl -s http://localhost:3000/api/socioeconomic/san-isidro?year=2020 | jq '.population.densityMean'
```

### Filtrar barrios densos
```bash
curl -X POST http://localhost:3000/api/socioeconomic/filter \
  -H "Content-Type: application/json" \
  -d '{"densityMin":10000}' | jq '.total'
```

---

## Solución de Problemas

### Error: "Server not running"
```bash
# Verificar puerto
lsof -i :3000

# Reiniciar
pkill -f "node server.js"
npm start
```

### Error: "Earth Engine not initialized"
```bash
# Verificar service-account.json existe
ls -la service-account.json

# Ver logs
tail -f server.log
```

---

## Documentación Completa

- **Implementación**: `IMPLEMENTACION-DATOS-SOCIOECONOMICOS.md`
- **Demo**: `DEMO-DATOS-SOCIOECONOMICOS.md`
- **Resumen**: `RESUMEN-DATOS-SOCIOECONOMICOS.md`
- **Completado**: `COMPLETADO-PUNTO-6.md`

---

**¿Listo en 60 segundos? ¡Adelante! 🚀**
# 🚀 Inicio Rápido: Vegetación e Islas de Calor

## 📍 ¿Qué se implementó?

Una plataforma completa para analizar vegetación (NDVI) e islas de calor urbano (LST) en Lima usando Google Earth Engine.

## ⚡ Opciones de Uso

### 1️⃣ Ver Demo Local (Ahora Mismo)

```bash
# Si el servidor no está corriendo, inícialo:
cd /workspaces/GEE
node server.js

# Luego abre en tu navegador:
http://localhost:3000/vegetacion-islas-calor.html
```

**Qué verás**:
- Interfaz completa con 3 paneles
- Controles interactivos (sliders, filtros, fechas)
- Tablas de ejemplo con datos de Lima
- Guía de implementación integrada

### 2️⃣ Usar en Google Earth Engine (Funcionalidad Completa)

#### Paso 1: Copiar código
```bash
cat /workspaces/GEE/docs/vegetacion-islas-calor-gee-script.js
# O abre el archivo en tu editor y copia todo
```

#### Paso 2: Ir a GEE Code Editor
Abre: https://code.earthengine.google.com/

#### Paso 3: Pegar y ejecutar
1. File → New → Script
2. Pegar el código completo
3. Presionar "Run" (o F5)
4. ¡Listo! La app se cargará en 30-60 segundos

#### Paso 4: Interactuar
- Dibujar ROI sobre Lima (opcional)
- Ajustar rango de fechas
- Mover slider de mes
- Activar/desactivar filtros SMOD
- Ver mapas, gráficos y tablas
- Generar GIFs animados

### 3️⃣ Publicar como App Web (Opcional)

Desde GEE Code Editor después de ejecutar:
1. Apps → Publish → New App
2. Nombre: "EcoPlan - Vegetación e Islas de Calor"
3. Permissions: Public o Restricted
4. Copiar URL pública
5. ¡Compartir!

## 📊 ¿Qué hace la aplicación?

### Funcionalidades principales

✅ **NDVI (Vegetación)**
- Sentinel-2 (10m) + Landsat 8/9 (30m)
- Compuesto mensual (mediana)
- Detecta áreas verdes vs urbano denso

✅ **LST (Temperatura Superficial)**
- MODIS (1 km, 8 días)
- Anomalía vs climatología 2018-2022
- Identifica islas de calor

✅ **Filtros SMOD**
- Rural (11-13)
- Urbano/Periurbano (21-23)
- Centro urbano (30)

✅ **Tablas de Análisis**
- Eventos de islas de calor (fecha, hora, área, °C)
- Prioridades por distrito (PRIOR, NDVI, LST, población)

✅ **Visualizaciones**
- Mapas sincronizados (NDVI + LST)
- Series temporales interactivas
- GIFs animados

## 🎯 Casos de Uso Rápidos

### Caso 1: Encontrar zonas para nuevos parques
```
1. Filtro SMOD: Solo "Centro urbano"
2. Umbral LST: +2.5°C
3. Ver tabla de prioridades
4. Buscar: PRIOR > 0.6 y NDVI < 0.3
→ Estas son las zonas más críticas
```

### Caso 2: Detectar islas de calor
```
1. Período: Verano (Dic-Mar)
2. LST: Día (10:30 LT)
3. Umbral: +3.0°C
4. Ver tabla de eventos
→ Lista de eventos críticos con ubicación
```

### Caso 3: Monitorear cambios temporales
```
1. Rango: 2020-01-01 a hoy
2. Mover slider de mes
3. Observar mapas y gráficos
4. Generar GIF para ver evolución
→ Tendencias visuales de vegetación/calor
```

## 📁 Archivos Creados

```
/workspaces/GEE/
├── public/
│   └── vegetacion-islas-calor.html      ← DEMO WEB
├── docs/
│   ├── vegetacion-islas-calor-gee-script.js  ← CÓDIGO GEE
│   └── vegetacion-islas-calor.md        ← DOCUMENTACIÓN
├── tests/
│   └── test-vegetacion-islas-calor.sh   ← TESTS (51/51 ✅)
└── COMPLETADO-VEGETACION-ISLAS-CALOR.md ← ESTE README
```

## 🧪 Verificar Instalación

```bash
cd /workspaces/GEE
bash tests/test-vegetacion-islas-calor.sh
```

Debe mostrar: **✅ 51/51 tests pasados**

## 🔗 Navegación

La nueva página está enlazada desde:

- ✅ `transparencia.html` → "🌳 Vegetación & Calor"
- ✅ `tutoriales.html` → "🌳 Vegetación & Calor"
- ✅ `panel-autoridades.html` → Botón "🌳 Vegetación & Calor"
- ✅ `vegetacion-islas-calor.html` → Enlaces a todas las páginas

## 📖 Documentación Detallada

Para información completa:
```bash
cat /workspaces/GEE/docs/vegetacion-islas-calor.md
# O abre el archivo en tu editor
```

Incluye:
- Metodología científica paso a paso
- Descripción de todos los datasets
- Fórmulas y ecuaciones
- Guías de implementación (3 opciones)
- Casos de uso detallados
- Limitaciones y supuestos
- Extensiones futuras
- Referencias científicas

## 🎨 Paleta de Colores

**NDVI (Vegetación)**:
- Gris (#9e9e9e) → Verde claro (#d9f0a3) → Verde (#78c679) → Verde oscuro (#238443)
- Rango: 0.0 (sin vegetación) → 0.8 (vegetación densa)

**LST Anomalía (Calor)**:
- Azul (#2c7bb6) → Cian (#abd9e9) → Amarillo (#ffffbf) → Naranja (#fdae61) → Rojo (#d7191c)
- Rango: -2.5°C (más frío) → +3.5°C (isla de calor extrema)

**SMOD (Urbanización)**:
- Cian claro (#edf8fb) → Azul (#b3cde3) → Púrpura (#8c96c6) → Púrpura oscuro (#8856a7) → Morado (#810f7c)
- Rural (10-13) → Urbano (21-23) → Centro urbano (30)

## ⚡ Tips Rápidos

### Rendimiento
- Empezar con rangos pequeños (6-12 meses)
- Usar máscara de nubes activada
- Filtrar por SMOD reduce tiempo de procesamiento

### Calidad de Datos
- Verano (Dic-Mar): Mayor LST pero más nubes
- Invierno (Jun-Ago): Menos nubes pero LST más baja
- Óptimo: Primavera/Otoño (balance)

### Interpretación
- NDVI < 0.2: Urbano denso, prioritario para áreas verdes
- LST_anom > +2.5°C: Isla de calor significativa
- PRIOR > 0.6: Alta prioridad (calor + falta vegetación)

## 🐛 Solución de Problemas

### "Error loading script"
→ Asegúrate de estar autenticado en Earth Engine

### "No data found"
→ Verifica que el ROI esté sobre Lima

### "Too many images"
→ Reduce el rango de fechas o área de análisis

### "Computation timeout"
→ Usa escalas más gruesas (1000m en vez de 30m)

## 📞 Soporte

- **Email**: ayuda@ecoplan.gob.pe
- **Docs**: `/docs/vegetacion-islas-calor.md`
- **Tests**: `bash tests/test-vegetacion-islas-calor.sh`
- **API**: http://localhost:3000/api-docs

## 🎉 ¡Listo!

Tu implementación está completa y lista para usar. Puedes:

1. ✅ Ver demo local: `http://localhost:3000/vegetacion-islas-calor.html`
2. ✅ Copiar código GEE: `/docs/vegetacion-islas-calor-gee-script.js`
3. ✅ Leer documentación: `/docs/vegetacion-islas-calor.md`
4. ✅ Ejecutar tests: `bash tests/test-vegetacion-islas-calor.sh`

---

**Siguiente paso recomendado**: Abre la demo web y explora la interfaz, luego prueba el código completo en GEE Code Editor.

**⭐ ¡Disfruta analizando vegetación e islas de calor en Lima!**
