# EcoPlan Urbano – Playbook de Implementación

Este playbook aterriza el "Manual metodológico para implementar EcoPlan Urbano" en el contexto del repositorio `GEE`. Cada fase describe entregables concretos, responsables sugeridos y artefactos del proyecto.

---

## 1. Definición y planificación inicial

| Acción | Detalle aplicado al proyecto | Artefactos vinculados |
| --- | --- | --- |
| Objetivos estratégicos | Monitorear vegetación, islas de calor, contaminación del aire y riesgo hídrico en Lima Metropolitana, entregando paneles interactivos y reportes automáticos. | `README.md` (sección Objetivos), endpoints `/api/ecoplan/*`, `/api/bloom/*`. |
| Problemas prioritarios | 1) Exposición a calor extremo, 2) Déficit de áreas verdes, 3) Contaminación atmosférica (AOD, NO₂, PM₂.₅), 4) Riesgo hídrico y drenaje. | `docs/indices/` (ver sección 5). |
| Alcance geográfico/temporal | AOI por distrito y metropolitano (presets GEE) con ventana temporal móvil de 10 años y análisis anual/mensual. | `server.js` (presets), `public/index.html` (controles de fecha). |
| Alianzas y actores | Autoridades locales (Municipalidad de Lima, SERPAR, MINAM), academia (PUCP, UNI), comunidades barriales, NASA Space Apps. | `docs/ecoplan-partnerships.md`. |
| Entregables | - Backend Node/Express + API REST.<br>- Notebook Python/geemap.<br>- Panel web Leaflet/Chart.js.<br>- Reportes automáticos (PDF/CSV). | `server.js`, `public/index.html`, `notebooks/ecoplan-analysis.ipynb` (nuevo), `docs/reporting/`. |
| Cronograma | Fases trimestrales: Piloto (Q1), Ajustes (Q2), Escalamiento (Q3), Operación (Q4). | `docs/ecoplan-roadmap.md`. |

## 2. Formación del equipo de trabajo

| Rol | Responsabilidades | Interacción |
| --- | --- | --- |
| Coordinación general | Gestión de cronograma, presupuesto, acuerdos institucionales. | Lidera reuniones quincenales y actualiza `docs/ecoplan-roadmap.md`. |
| Especialistas en teledetección | Configuran pipelines GEE, validan índices satelitales. | Mantienen scripts en `server.js`, `notebooks/`. |
| Analistas socioeconómicos | Preparan capas censales, indicadores de privación y validan resultados. | Actualizan `data/socio/`, scripts ETL. |
| Desarrolladores GIS | Backend/API, frontend Leaflet, integración con GeoServer (si aplica). | Repositorio `GEE`, despliegue en contenedores. |
| Participación ciudadana | Diseñan procesos de crowdsourcing y moderación de reportes. | `docs/participacion/`. |
| QA y validación | Pruebas automáticas (`npm test`), contraste con datos de campo. | Issues de GitHub, pipelines CI. |
| Legal/compliance | Licencias de datos, privacidad, lineamientos para reporte ciudadano. | `docs/legal.md`. |

## 3. Infraestructura tecnológica y entorno de desarrollo

### 3.1 Stack principal

- **Procesamiento satelital**: Google Earth Engine (colecciones Sentinel-2 SR, Landsat 8/9 L2, MODIS MOD11A2, S5P NO₂, SEDAC PM₂.₅).
- **Backend**: Node.js 20 + Express (REST, tareas asíncronas), integración futura con Celery/Cloud Tasks para actualizaciones programadas.
- **Frontend**: Leaflet 1.9 + Chart.js 4, próximamente React micro-front para módulos avanzados.
- **Base de datos**: PostgreSQL/PostGIS (no incluida aún; ver `docs/database-schema.sql`).
- **Almacenamiento**: Exportes GCS (`/api/export/gcs`), planificado soporte a Earth Engine Assets y Drive.
- **Seguridad**: Variables `.env`, servicio GCP IAM, autenticación futura por JWT (ver `docs/security-plan.md`).

### 3.2 Entorno local

1. Instalar dependencias Node (`npm install`).
2. Preparar entorno Python con `conda`/`venv` (ver `python/requirements.txt`).
3. Lanzar JupyterLab para notebooks (`notebooks/ecoplan-analysis.ipynb`).
4. Configurar Git flow (`main`, `develop`, branches feature/*).
5. Integración CI/CD pendiente (GitHub Actions con tests + despliegue). Detalles en `docs/devops-pipeline.md`.

### 3.3 Arquitectura de alto nivel

```
+----------------------+     +---------------------+     +----------------------+
|  Frontend Leaflet    | <-> |  API Express (GEE)  | <-> |  Google Earth Engine  |
|  - Mapas temáticos   |     |  - Endpoints /api/* |     |  - Cálculo índices    |
|  - Gráficos          |     |  - Programador CRON |     |  - Exportaciones      |
+----------+-----------+     +----------+----------+     +-----------+----------+
           ^                                  |                            |
           |                                  v                            v
           |                       +------------------+          +-------------------+
           |                       |  PostgreSQL/PostGIS |       |  GCS / Drive       |
           |                       +------------------+          +-------------------+
           |                                  |
           v                                  v
+-----------------------+        +----------------------+    +---------------------+
|  Participación cidad. |        |  Notebooks geemap    |    |  Reportes automáticos|
+-----------------------+        +----------------------+    +---------------------+
```

---

## Próximos artefactos

- `docs/ecoplan-partnerships.md`: mapa de actores y acuerdos.
- `docs/ecoplan-roadmap.md`: cronograma y hitos.
- `docs/devops-pipeline.md`: configuración CI/CD y despliegue.
- `docs/security-plan.md`: protocolos de autenticación y privacidad.
- `docs/database-schema.sql`: esquema inicial PostGIS.

Actualice este playbook a medida que se incorporen las fases restantes del manual. Cada commit debe vincular la fase atendida en el mensaje (ejemplo: `feat: add air quality index per manual phase 4.3`).
