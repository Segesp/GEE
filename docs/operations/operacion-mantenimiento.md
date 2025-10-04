# Operación y mantenimiento del ecosistema EcoPlan Urbano

> **Propósito:** ofrecer un playbook operativo que garantice continuidad, calidad de datos y resiliencia de la plataforma EcoPlan Urbano (backend Node.js + frontend Leaflet + notebooks geoespaciales).

## 1. Roles y responsabilidades

| Rol | Responsabilidades core | Herramientas | Frecuencia |
| --- | --- | --- | --- |
| **Líder técnico** | Aprobar releases, coordinar arquitectura, priorizar hotfixes | GitHub, Google Cloud, Grafana | Semanal |
| **Operaciones (DevOps)** | Ejecutar despliegues, monitorear salud del servicio, mantener CI/CD | GitHub Actions, Cloud Run/VM, Secret Manager | Diario |
| **Analista geoespacial** | Validar indicadores (NDVI, LST, NO₂, PM₂.₅, riesgo hídrico), revisar notebooks | Earth Engine, geemap, QGIS | Quincenal |
| **Gestión social / participación** | Coordinar sesiones ciudadanas, recopilar feedback de barrios | Plan de participación, formularios | Mensual |
| **Seguridad / Datos** | Gobernanza de credenciales, auditorías de acceso, planes de contingencia | IAM, Secret Manager, gitleaks | Trimestral |

## 2. Flujo operativo estándar

1. **Planificación**
   - Revisar tablero de issues priorizados.
   - Definir alcance de release (indicadores, datasets, mejoras front, documentación).
2. **Desarrollo**
   - Branch `feature/<tema>`; aplicar guía de commits convencionales.
   - Ejecutar `npm test` y pruebas locales sobre notebooks relevantes (`papermill` o `jupyter nbconvert --execute`).
3. **Validación previa**
   - Revisar checklist (sección 3).
   - Completar `docs/ecoplan-implementation-audit.md` con hallazgos y capturas.
4. **Despliegue**
   - Ejecutar pipeline CI/CD (GitHub Actions) o correr manualmente los comandos descritos en la sección 4.
5. **Post-despliegue**
   - Validar estado de endpoints y dashboards.
   - Registrar resultados en `docs/reporting/README.md`.

## 3. Checklist de validación

### 3.1. Código y datos

- [ ] `npm test` sin fallos (incluye `test-server.js`).
- [ ] Linter sin errores (pendiente de habilitar: `npm run lint`).
- [ ] Notebook `notebooks/ecoplan-analysis.ipynb` ejecutado sin celdas fallidas.
- [ ] Validación visual: confirmar que los mapas NDVI, LST y capas ambientales renderizan en `/public/index.html`.
- [ ] Revisar payload `POST /api/ecoplan/analyze` (usar `curl` o Thunder Client) y verificar nuevos campos: `air_quality`, `water_risk`, `green_per_capita`, `no2`, `pm25`.
- [ ] Confirmar que los presets urbanos se cargan (chequear logs `logStatus` en modo EcoPlan).

### 3.2. Seguridad y credenciales

- [ ] Credenciales vigentes (`GOOGLE_SERVICE_ACCOUNT_JSON`, `GOOGLE_EE_PROJECT`).
- [ ] Rotación trimestral de claves de servicio (ver `docs/security-plan.md`).
- [ ] Revisión de permisos en assets GEE (datos compartidos con Apps y servicio backend).

### 3.3. Datos externos

- [ ] Sentinel-2 y Landsat con fechas actualizadas (`start`, `end`).
- [ ] Verificar disponibilidad de productos S5P NO₂ y SEDAC PM₂.₅ en el rango solicitado.
- [ ] Notificar si hay nuevas versiones de colecciones (MODIS v6.1, GPWv4.11, etc.).

## 4. Despliegue controlado

> *La infraestructura objetivo recomendada es Google Cloud Run con imágenes Docker multi-stage.*

1. Construir imagen:
   ```bash
   docker build -t gcr.io/<project>/ecoplan-api:$(git rev-parse --short HEAD) .
   ```
2. Ejecutar pruebas en contenedor (opcional):
   ```bash
   docker run --rm --env-file .env.local gcr.io/<project>/ecoplan-api:.... npm test
   ```
3. Publicar imagen en Artifact Registry:
   ```bash
   docker push gcr.io/<project>/ecoplan-api:TAG
   ```
4. Desplegar en Cloud Run:
   ```bash
   gcloud run deploy ecoplan-api \
     --image gcr.io/<project>/ecoplan-api:TAG \
     --region us-central1 \
     --allow-unauthenticated \
     --set-env-vars GOOGLE_EE_PROJECT=... \
     --set-secrets GOOGLE_SERVICE_ACCOUNT_JSON=projects/<project>/secrets/gee-service-account:latest
   ```
5. Actualizar frontend:
   - Publicar `public/` en hosting estático (Cloud Storage + CDN o Vercel).
   - Enviar la URL del backend como variable `VITE_API_BASE` si se migra a SPA/React (pendiente refactor).

## 5. Monitoreo y alertas

| Indicador | Fuente | Umbral | Acción |
| --------- | ------ | ------ | ------ |
| Latencia `GET /api/health` | Cloud Monitoring | > 1.5 s (p95) durante 15 min | Escalar instancia, revisar logs |
| Errores 5xx | Cloud Logging | > 5 en 10 minutos | Abrir incidente, revisar despliegue reciente |
| Cuotas GEE (`queries_per_day`) | Earth Engine Admin | > 80 % de cuota diaria | Coordinar con Google para aumentar límite o optimizar consultas |
| Uso RAM / CPU (Cloud Run) | Cloud Monitoring | > 70 % sostenido | Ajustar atributos de instancia (memory 1 GiB, concurrency 20) |
| Desviación NDVI/LST vs. valores esperados | Notebook QA | > 2σ respecto a serie histórica | Revisar máscaras de nubes o cambios de colección |

Alertas se configuran vía Google Cloud → Monitoring → Alerting. Destinatarios: canal de Slack `#ecoplan-ops` y correo del líder técnico.

## 6. Mantenimiento preventivo

- **Semanal**
  - Revisar logs de errores en Cloud Run.
  - Ejecutar `npm audit` y registrar vulnerabilidades críticas.
  - Validar integridad de datasets en Earth Engine (usar script `scripts/check-datasets.js`, pendiente).
- **Mensual**
  - Reprocesar indicadores principales con nuevas fechas y publicar reporte mensual.
  - Actualizar `docs/reporting/README.md` con hallazgos clave.
  - Revisar participación ciudadana (sesiones/feedback) y priorizar requerimientos.
- **Trimestral**
  - Rotar credenciales. Actualizar dependencias (`npm outdated`, `pip list --outdated`).
  - Test de recuperación ante desastres: restaurar assets desde backup y desplegar entorno en staging.

## 7. Gestión de datos y backups

1. **Backups de Earth Engine**
   - Exportar tablas críticas (`ee.FeatureCollection`) a Google Cloud Storage (`Export.table.toDrive`) semanalmente.
   - Versionar shapefiles / GeoJSON en el repositorio (`data/` privada o repo separado).
2. **Base de datos relacional (futura)**
   - Si se adopta Postgres, habilitar `pg_dump` diario y retención de 14 días.
   - Documentar esquema en `docs/database-schema.sql` (mantener sincronizado).
3. **Artefactos de notebooks**
   - Guardar HTML renderizado (`jupyter nbconvert --to html`) en carpeta `reports/`.
   - Usar `DVC` o `lakeFS` si se incorporan raster pesados.

## 8. Participación ciudadana y comunicación

- Integrar resultados de talleres ciudadanos en `docs/participacion/plan-participacion.md`.
- Publicar dashboards en sesiones comunitarias, recoger inquietudes y convertirlas en issues etiquetados `participación`.
- Mantener un calendario público de entregables y actividades (ver `docs/ecoplan-roadmap.md`).

## 9. Gestión de incidentes

1. **Detección**: alerta automática o reporte de usuario.
2. **Evaluación**
   - Clasificar severidad (S1 crítico: servicio caído; S2 degradado; S3 consulta).
   - Estimar alcance (número de usuarios/sectores impactados).
3. **Mitigación**
   - Aplicar rollback (`gcloud run services update-traffic --to-revisions=REV`) o hotfix.
   - Comunicar estado por Slack + correo.
4. **Post-mortem** (en 48 h)
   - Resumen, causa raíz, acciones correctivas/preventivas.
   - Registrar en `docs/reporting/README.md` sección “Incidentes”.

## 10. Checklist rápido (operador on-call)

- [ ] Health check responde `200`.
- [ ] Mapas se visualizan (capas NDVI, LST, NO₂, PM₂.₅, agua, áreas verdes).
- [ ] Logs sin errores nuevos (Cloud Logging).
- [ ] Cuotas de Earth Engine bajo 70 %.
- [ ] Último backup completo < 7 días.
- [ ] Documentación actualizada (audit log).

Mantén este manual en sincronía con la evolución del proyecto. Cada release mayor debe actualizar las secciones de despliegue, monitoreo y mantenimiento preventivo.
