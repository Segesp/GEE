# 🌍 EcoPlan GEE - Índice del Proyecto

> **Plataforma de ciencia ciudadana que combina reportes comunitarios con datos satelitales de Google Earth Engine para monitorear problemas ambientales urbanos en Lima, Perú.**

---

## 📚 Documentación Principal

### 🏠 Archivos Esenciales
- **README.md** - Introducción general del proyecto
- **INDICE-PROYECTO.md** - Este archivo (índice completo)

### 📖 Documentación Consolidada (NUEVA ESTRUCTURA ✨)

| Archivo | Descripción | Contenido |
|---------|-------------|-----------|
| **[docs/GUIA-INICIO-RAPIDO.md](docs/GUIA-INICIO-RAPIDO.md)** | Guías de inicio rápido para todos los módulos | • Guía general<br>• Calidad Aire y Agua<br>• Índices Compuestos<br>• Datos Socioeconómicos<br>• Vegetación e Islas de Calor |
| **[docs/MODULOS-COMPLETADOS.md](docs/MODULOS-COMPLETADOS.md)** | Estado de completitud de cada módulo | • Calidad Aire y Agua ✅<br>• Índices Compuestos ✅<br>• Datos Socioeconómicos ✅<br>• Vegetación e Islas de Calor ✅ |
| **[docs/IMPLEMENTACION-TECNICA.md](docs/IMPLEMENTACION-TECNICA.md)** | Detalles técnicos de todas las implementaciones | • 11 implementaciones consolidadas<br>• Código, arquitectura, APIs<br>• Diagramas y ejemplos |
| **[docs/VALIDACION-TESTING.md](docs/VALIDACION-TESTING.md)** | Resultados de validación y testing | • Validación completada<br>• Tests de índices<br>• Resumen de pruebas |
| **[docs/RESUMEN-PROYECTO.md](docs/RESUMEN-PROYECTO.md)** | Resúmenes ejecutivos y visuales | • Resúmenes por módulo<br>• Estado final<br>• MVP completado<br>• Visualizaciones ASCII |
| **[docs/DEMOS-CASOS-USO.md](docs/DEMOS-CASOS-USO.md)** | Demos y casos de uso prácticos | • Demo socioeconómico<br>• Conclusión Mi Barrio<br>• Tests de layout visual |
| **[docs/CHANGELOG.md](docs/CHANGELOG.md)** | Historial de cambios y actualizaciones | • Proyecto completado<br>• Fixes aplicados<br>• Actualizaciones |

> **📦 Nota**: Los 35 archivos markdown antiguos fueron consolidados en estos 7 archivos organizados por tema.  
> **📂 Backup**: Los archivos originales están en `docs/archive-old-md/` para referencia.

---

## 🎯 Módulos del Sistema

### 1️⃣ Módulo: Reportes Ciudadanos
**Descripción**: Sistema de reportes comunitarios con foto, GPS y validación peer-to-peer

**Archivos principales**:
- `public/index.html` - Interfaz de reportes y exploración
- `services/citizenReportsRepository.js` - Repositorio de reportes
- `services/reportValidationService.js` - Sistema de validación

**Características**:
- 📸 Captura de foto con cámara/galería
- 📍 Geolocalización automática (GPS)
- 🏷️ 6 categorías: calor, áreas verdes, inundación, residuos, aire, agua
- ⚠️ 4 niveles de severidad
- 👍 Validación comunitaria con votación
- 🔍 Detección de duplicados

**Endpoints API**:
- `POST /api/citizen-reports` - Crear reporte
- `GET /api/citizen-reports` - Listar reportes
- `POST /api/citizen-reports/:id/validate` - Validar reporte
- `GET /api/citizen-reports/:id/duplicates` - Buscar duplicados

---

### 2️⃣ Módulo: Calidad de Aire y Agua
**Descripción**: Monitoreo de 4 variables ambientales con datos satelitales NASA/Copernicus

**Archivos principales**:
- `public/calidad-aire-agua.html` - Interfaz web interactiva
- `docs/calidad-aire-agua-gee-script.js` - Script Google Earth Engine (568 líneas)
- `docs/calidad-aire-agua.md` - Documentación técnica (1,113 líneas)

**Variables monitoreadas**:
1. **AOD** (Aerosol Optical Depth) - MODIS 1km, contaminación atmosférica
2. **NO₂** (Nitrogen Dioxide) - Sentinel-5P 7km, emisiones vehiculares
3. **Clorofila-a** - Copernicus Marine 4km, calidad agua costera
4. **NDWI** (Water Index) - MODIS 463m, humedad del suelo

**Características**:
- 🗺️ Mapa Leaflet con 4 tabs por variable
- 📅 Selector de fechas (2020-2025)
- 🎨 Paletas de colores científicas
- 📊 Series temporales en GEE
- 🚨 Sistema de alertas (AOD>0.3, NO₂>150)
- 📈 Análisis por 7 distritos de Lima

**Tests**: 85 tests automatizados (89% éxito)

**Documentación**: Ver `docs/GUIA-INICIO-RAPIDO.md` sección "Calidad Aire y Agua"

---

### 3️⃣ Módulo: Vegetación e Islas de Calor
**Descripción**: Análisis de NDVI y LST para monitorear vegetación y calor urbano

**Archivos principales**:
- `public/vegetacion-islas-calor.html` - Interfaz web (1,700+ líneas)
- `docs/vegetacion-islas-calor.md` - Documentación técnica

**Variables analizadas**:
1. **NDVI** (Normalized Difference Vegetation Index) - Landsat 8/9, vegetación saludable
2. **LST** (Land Surface Temperature) - MODIS Terra/Aqua, temperatura superficial

**Características**:
- 🌳 Análisis temporal de vegetación
- 🌡️ Detección de islas de calor urbanas
- 📊 Comparación entre distritos
- 🎨 Visualización con paletas de colores
- 📈 Gráficos de series temporales

**Documentación**: Ver `docs/GUIA-INICIO-RAPIDO.md` sección "Vegetación"

---

### 4️⃣ Módulo: Índices Compuestos
**Descripción**: Cálculo de índices de calidad ambiental combinando múltiples variables

**Archivos principales**:
- `services/compositeIndicesService.js` - Servicio de cálculo (450+ líneas)
- Tests automatizados integrados

**Índices calculados**:
1. **ICA** (Índice de Calidad Ambiental) = 0.6×AOD + 0.4×NO₂
2. **ISC** (Índice de Salud Costera) = función(Clorofila, NDWI)
3. **IVU** (Índice de Verdor Urbano) = función(NDVI, LST)

**Características**:
- 🔢 Cálculos matemáticos validados
- 📊 Agregación por distrito
- 📈 Series temporales de índices
- 🚨 Alertas por umbrales
- 💾 Caché de resultados

**API Endpoints**:
- `GET /api/composite-indices/:district` - Índices por distrito
- `GET /api/composite-indices/timeseries` - Series temporales

**Documentación**: Ver `docs/MODULOS-COMPLETADOS.md` sección "Índices Compuestos"

---

### 5️⃣ Módulo: Datos Socioeconómicos
**Descripción**: Integración de datos del INEI para análisis socioespacial

**Archivos principales**:
- `services/socioeconomicService.js` - Servicio de datos INEI
- `public/index.html` - Visualización en mapa

**Variables integradas**:
- 👥 Población por distrito
- 💰 Nivel socioeconómico (NSE A/B/C/D/E)
- 🏘️ Densidad poblacional
- 📊 Indicadores de pobreza

**Características**:
- 🗺️ Choropleth maps por distrito
- 🔍 Filtros por NSE y población
- 📈 Visualización de correlaciones
- 📊 Estadísticas descriptivas

**Documentación**: Ver `docs/IMPLEMENTACION-TECNICA.md` sección "Datos Socioeconómicos"

---

### 6️⃣ Módulo: Mi Barrio
**Descripción**: Análisis personalizado por barrio con recomendaciones contextuales

**Archivos principales**:
- `public/index.html` - Modal "Mi Barrio"
- Scripts GEE integrados

**Características**:
- 📍 Selección de ubicación por clic en mapa
- 🎯 Análisis local (radio 500m)
- 📊 Métricas personalizadas (NDVI, LST, calidad aire)
- 💡 Recomendaciones contextuales
- 📋 Reporte descargable PDF

**Flujo de uso**:
1. Usuario hace clic en "Mi Barrio"
2. Selecciona ubicación en mapa
3. Sistema analiza datos satelitales
4. Genera reporte con métricas y recomendaciones

**Documentación**: Ver `docs/mi-barrio.md`

---

### 7️⃣ Módulo: Panel de Autoridades
**Descripción**: Dashboard ejecutivo para tomadores de decisiones

**Archivos principales**:
- `public/panel-autoridades.html` - Interfaz ejecutiva
- `services/dataExportService.js` - Exportación de datos

**Características**:
- 📊 KPIs principales (reportes, validación, urgentes)
- 🗺️ Mapa de calor de reportes
- 📈 Gráficos de tendencias
- 🎯 Recomendaciones priorizadas
- 📥 Exportación CSV/JSON
- 🔔 Sistema de alertas

**Secciones**:
1. Indicadores clave
2. Mapa interactivo
3. Rankings de problemas
4. Portafolio de intervenciones
5. Sistema de exportación

**Documentación**: Ver `docs/IMPLEMENTACION-TECNICA.md` sección "Recomendador Panel"

---

### 8️⃣ Módulo: Simulador de Accesibilidad
**Descripción**: Análisis de accesibilidad a áreas verdes y servicios

**Archivos principales**:
- Integrado en `public/index.html`
- Servicio de cálculo de distancias

**Características**:
- 🚶 Isócronas de accesibilidad (5/10/15 min)
- 🌳 Distancia a áreas verdes
- 🏥 Proximidad a servicios
- 📊 Análisis de cobertura

**Documentación**: Ver `docs/IMPLEMENTACION-TECNICA.md` sección "Simulador Accesibilidad"

---

### 9️⃣ Módulo: API de Transparencia
**Descripción**: API REST pública para acceso abierto a datos

**Archivos principales**:
- `public/transparencia.html` - Página de transparencia
- `config/swagger.js` - Documentación OpenAPI

**Endpoints públicos**:
- `GET /api/citizen-reports` - Reportes ciudadanos
- `GET /api/composite-indices/:district` - Índices compuestos
- `GET /api/satellite/ndvi` - Datos NDVI
- `GET /api/satellite/lst` - Datos LST
- `GET /api-docs` - Documentación Swagger

**Características**:
- 📖 Documentación interactiva Swagger
- 🔓 Acceso sin autenticación (datos públicos)
- 📊 Formatos: JSON, CSV
- 📈 Rate limiting: 100 req/min

**Documentación**: Ver `docs/IMPLEMENTACION-TECNICA.md` sección "API Transparencia"

---

### 🔟 Módulo: Sistema de Descargas
**Descripción**: Exportación de datos y reportes en múltiples formatos

**Archivos principales**:
- `services/dataExportService.js` - Servicio de exportación
- `services/reportGenerationService.js` - Generación de PDFs

**Formatos soportados**:
- 📄 JSON (datos crudos)
- 📊 CSV (tabular)
- 📋 PDF (reportes visuales)
- 🗺️ GeoJSON (datos geoespaciales)

**Características**:
- 🔍 Filtros personalizables
- 📅 Rango de fechas
- 🎨 Templates personalizados
- 📦 Compresión ZIP para lotes

**Documentación**: Ver `docs/IMPLEMENTACION-TECNICA.md` sección "Sistema Descargas"

---

## 🛠️ Arquitectura Técnica

### Stack Tecnológico

**Frontend**:
- HTML5, CSS3 (Grid, Flexbox)
- JavaScript ES6+
- Leaflet.js 1.9.4 (mapas)
- Chart.js (gráficos)

**Backend**:
- Node.js + Express
- PostgreSQL (base de datos)
- Google Earth Engine (procesamiento satelital)

**APIs Externas**:
- Google Earth Engine JavaScript API
- NASA GIBS/Worldview
- Copernicus Data
- INEI (datos socioeconómicos)

**DevOps**:
- Docker (contenedores)
- GitHub Actions (CI/CD)
- Bash scripts (testing)

---

### Estructura de Directorios

```
/workspaces/GEE/
├── public/                          # Frontend files
│   ├── index.html                   # Página principal
│   ├── calidad-aire-agua.html       # Módulo aire/agua
│   ├── vegetacion-islas-calor.html  # Módulo vegetación
│   ├── panel-autoridades.html       # Dashboard autoridades
│   ├── transparencia.html           # Página de transparencia
│   ├── tutoriales.html              # Tutoriales
│   └── js/                          # Scripts JavaScript
│
├── services/                        # Backend services
│   ├── citizenReportsRepository.js  # Repositorio reportes
│   ├── reportValidationService.js   # Validación
│   ├── compositeIndicesService.js   # Índices compuestos
│   ├── dataExportService.js         # Exportación
│   ├── socioeconomicService.js      # Datos INEI
│   └── reportGenerationService.js   # PDFs
│
├── docs/                            # 📚 DOCUMENTACIÓN CONSOLIDADA ✨
│   ├── GUIA-INICIO-RAPIDO.md        # ⚡ Guías de inicio (5 en 1)
│   ├── MODULOS-COMPLETADOS.md       # ✅ Estado de módulos (4 en 1)
│   ├── IMPLEMENTACION-TECNICA.md    # 🔧 Detalles técnicos (11 en 1)
│   ├── VALIDACION-TESTING.md        # 🧪 Tests y validación (3 en 1)
│   ├── RESUMEN-PROYECTO.md          # 📊 Resúmenes ejecutivos (6 en 1)
│   ├── DEMOS-CASOS-USO.md           # 🎬 Demos y ejemplos (3 en 1)
│   ├── CHANGELOG.md                 # 📝 Historial de cambios (3 en 1)
│   ├── calidad-aire-agua.md         # Docs módulo aire/agua
│   ├── vegetacion-islas-calor.md    # Docs módulo vegetación
│   ├── mi-barrio.md                 # Docs módulo Mi Barrio
│   ├── manual-ecoplan-gee.md        # Manual de usuario
│   └── archive-old-md/              # 📦 Archivos antiguos (36 backups)
│
├── tests/                           # Testing suites
│   ├── test-calidad-aire-agua.sh    # Tests aire/agua (85 tests)
│   ├── test-validation.sh           # Tests validación
│   └── test-datos-socioeconomicos.sh # Tests socioeconómico
│
├── config/                          # Configuración
│   ├── swagger.js                   # OpenAPI spec
│   └── report-distribution.json     # Config reportes
│
├── server.js                        # Servidor Express
├── package.json                     # Dependencias Node
├── README.md                        # README principal
└── INDICE-PROYECTO.md              # 📍 Este archivo (índice maestro)

```

---

## 📊 Métricas del Proyecto

### Líneas de Código

| Componente | Líneas |
|------------|--------|
| Frontend (HTML/CSS/JS) | ~15,000 |
| Backend (Node.js) | ~8,000 |
| Documentación (MD) | ~16,400 |
| Tests (Bash/JS) | ~2,000 |
| **TOTAL** | **~41,400** |

### Archivos por Tipo

| Tipo | Cantidad |
|------|----------|
| HTML | 6 páginas |
| JavaScript (backend) | 15 servicios |
| JavaScript (frontend) | 20+ scripts |
| Markdown (docs consolidados) | 7 archivos |
| Markdown (docs técnicos) | 15 archivos |
| Tests | 10+ suites |
| SQL schemas | 3 archivos |

### Cobertura de Tests

| Módulo | Tests | Éxito |
|--------|-------|-------|
| Calidad Aire/Agua | 85 | 89% |
| Validación | 11 | 100% |
| Índices Compuestos | 45 | 95% |
| Socioeconómico | 30 | 93% |
| **PROMEDIO** | **171** | **94%** |

### Consolidación de Documentación

| Métrica | Antes | Después | Mejora |
|---------|-------|---------|--------|
| Archivos MD (raíz) | 36 | 2 | ⬇️ 94% |
| Archivos MD (docs) | 15 | 22 | ⬆️ +7 consolidados |
| Navegabilidad | ⚠️ Dispersa | ✅ Organizada | 🎯 Por tema |
| Mantenibilidad | ⚠️ Compleja | ✅ Simple | 🔧 Centralizada |

---

## 🚀 Inicio Rápido

### Opción 1: Usar la Aplicación Web

1. **Iniciar servidor**:
   ```bash
   cd /workspaces/GEE
   node server.js
   ```

2. **Abrir en navegador**:
   - Página principal: http://localhost:3000
   - Calidad aire/agua: http://localhost:3000/calidad-aire-agua.html
   - Vegetación: http://localhost:3000/vegetacion-islas-calor.html
   - Panel autoridades: http://localhost:3000/panel-autoridades.html
   - API docs: http://localhost:3000/api-docs

### Opción 2: Usar Google Earth Engine

1. **Copiar script**:
   ```bash
   cat /workspaces/GEE/docs/calidad-aire-agua-gee-script.js
   ```

2. **Abrir GEE Code Editor**:
   - Ir a: https://code.earthengine.google.com/

3. **Pegar y ejecutar**:
   - Pegar código copiado
   - Presionar "Run" (F5)
   - Ver resultados en mapa y consola

### Opción 3: Ejecutar Tests

```bash
# Tests de calidad aire/agua
bash /workspaces/GEE/tests/test-calidad-aire-agua.sh

# Tests de validación
bash /workspaces/GEE/tests/test-validation.sh

# Tests de datos socioeconómicos
bash /workspaces/GEE/tests/test-datos-socioeconomicos.sh
```

---

## 📖 Guías Detalladas

### Para Usuarios Finales
- **[Manual de Usuario](docs/manual-ecoplan-gee.md)** - Cómo usar la plataforma
- **[Tutoriales](public/tutoriales.html)** - Videos y guías paso a paso
- **[Inicio Rápido](docs/GUIA-INICIO-RAPIDO.md)** - Empezar en <5 minutos por módulo

### Para Desarrolladores
- **[Implementación Técnica](docs/IMPLEMENTACION-TECNICA.md)** - Detalles de código (11 módulos)
- **[API Docs](http://localhost:3000/api-docs)** - Documentación Swagger interactiva
- **[Validación y Testing](docs/VALIDACION-TESTING.md)** - Cómo ejecutar tests

### Para Investigadores
- **[Calidad Aire/Agua](docs/calidad-aire-agua.md)** - Metodología científica detallada
- **[Vegetación](docs/vegetacion-islas-calor.md)** - Análisis NDVI/LST con referencias
- **[Casos de Uso](docs/DEMOS-CASOS-USO.md)** - Ejemplos de análisis prácticos

### Para Autoridades
- **[Panel de Autoridades](public/panel-autoridades.html)** - Dashboard ejecutivo
- **[Resumen Proyecto](docs/RESUMEN-PROYECTO.md)** - Visión general consolidada
- **[Transparencia](public/transparencia.html)** - Acceso abierto a datos

---

## 🛣️ Roadmap

### ✅ Fase 1: MVP Completado (2024 Q4 - 2025 Q1)
- Sistema de reportes ciudadanos
- Validación comunitaria
- 4 módulos satelitales (aire, agua, vegetación, calor)
- API REST pública
- Panel de autoridades
- **Documentación consolidada** (nuevo ✨)

### 🚧 Fase 2: Automatización y Alertas (2025 Q2)
- Sistema de alertas en tiempo real
- Procesamiento automático diario
- Notificaciones email/SMS/Telegram
- Integración con cron jobs / Cloud Functions

### 🔮 Fase 3: Machine Learning (2025 Q3)
- Predicción de AOD/NO₂ 24-48 horas
- Clasificación automática de reportes
- Detección de anomalías
- Modelos Random Forest / LSTM

### 🌐 Fase 4: Expansión (2025 Q4)
- Integración IoT con sensores terrestres
- Análisis multiescala (otras ciudades)
- App móvil nativa (iOS/Android)
- Dashboard empresarial

---

## 🤝 Contribuir

### Reportar Bugs
1. Abrir issue en GitHub con etiqueta `bug`
2. Incluir: descripción, pasos para reproducir, capturas de pantalla
3. Especificar navegador/OS

### Sugerir Funcionalidades
1. Abrir issue con etiqueta `enhancement`
2. Describir problema que resuelve
3. Proponer solución

### Enviar Pull Requests
1. Fork del repositorio
2. Crear rama: `git checkout -b feature/nueva-funcionalidad`
3. Commit cambios: `git commit -am 'Add nueva funcionalidad'`
4. Push: `git push origin feature/nueva-funcionalidad`
5. Abrir Pull Request con descripción detallada

---

## 📞 Contacto y Soporte

- **Email**: ayuda@ecoplan.gob.pe
- **GitHub**: https://github.com/Segesp/GEE
- **Documentación**: http://localhost:3000/api-docs
- **Issues**: https://github.com/Segesp/GEE/issues

---

## 📜 Licencia

Este proyecto está bajo licencia MIT. Ver archivo `LICENSE` para más detalles.

---

## 🙏 Agradecimientos

- Google Earth Engine team
- NASA GIBS/Worldview
- Copernicus Programme
- INEI (Instituto Nacional de Estadística e Informática, Perú)
- Comunidad de ciencia ciudadana de Lima

---

## 📚 Referencias

1. Google Earth Engine: https://earthengine.google.com/
2. NASA GIBS: https://earthdata.nasa.gov/eosdis/science-system-description/eosdis-components/gibs
3. Copernicus: https://www.copernicus.eu/en
4. Leaflet.js: https://leafletjs.com/
5. INEI: https://www.inei.gob.pe/

---

**Última actualización**: 2025-10-05  
**Versión del proyecto**: 1.0.0  
**Estado**: ✅ MVP Completado y en Producción  
**Documentación**: ✨ Consolidada y organizada (36 archivos → 7 archivos por tema)
