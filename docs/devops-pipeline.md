# DevOps Pipeline – EcoPlan Urbano

## Objetivo

Garantizar despliegues confiables de la API Node.js, del frontend Leaflet y de los notebooks de análisis siguiendo el manual metodológico.

## Componentes

1. **Repositorio principal (`GEE`)**
   - Monorepo con backend (`server.js`), frontend (`public/`), docs (`docs/`), notebooks (`notebooks/`).
   - Convención de ramas: `main` (estable), `develop` (integración), `feature/*` (trabajo puntual).

2. **Integración continua (CI)**
   - GitHub Actions (pendiente de creación) con los siguientes jobs:
     - `lint-and-test`: ejecuta `npm ci` + `npm test` (requiere secretos `GOOGLE_SERVICE_ACCOUNT_JSON` y `GOOGLE_EE_PROJECT`).
     - `notebook-smoke`: usa `papermill` para validar notebooks clave (`notebooks/ecoplan-analysis.ipynb`).
     - `docs-check`: verifica enlaces y consistencia (herramientas como `markdownlint`).
   - Condición de protección: PRs a `main` deben pasar todos los jobs.

3. **Entrega continua (CD)**
   - Despliegue a contenedor (Cloud Run / Docker Swarm) usando imagen multi-stage.
   - Variables de entorno gestionadas vía Secret Manager.
   - Paso adicional para publicar Earth Engine App (script en `scripts/deploy-ee-app.js`, pendiente).

4. **Infraestructura**
   - Plantilla Terraform (por crear) para aprovisionar Cloud Run, Cloud Storage y Postgres administrado.
   - Monitorización con Google Cloud Monitoring + alertas de cuotas GEE.

## Flujo sugerido

1. Desarrollador crea branch `feature/<fase-manual>`.
2. Implementa cambios, ejecuta `npm test` y actualiza documentación.
3. Abre PR → se ejecutan pipelines CI.
4. Revisión cruzada por otro integrante (QA o líder técnico).
5. Tras aprobación, merge a `develop`.
6. Release: etiquetar (`vX.Y.Z`), desplegar a `staging`, validar, luego promover a `main/producción`.

## Próximos pasos

- [ ] Crear workflow GitHub Actions con jobs descritos.
- [ ] Definir política de versionado semántico.
- [ ] Preparar script de despliegue automatizado (`scripts/deploy.sh`).
- [ ] Integrar escaneo de seguridad (Dependabot, npm audit, gitleaks).

Mantener este documento sincronizado con la evolución del pipeline y registrar cambios mayores en el changelog del repositorio.
