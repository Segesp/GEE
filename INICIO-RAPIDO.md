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
