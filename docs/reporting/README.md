# Reportes automáticos – EcoPlan Urbano

## Objetivo

Generar salidas periódicas (PDF, CSV, dashboards interactivos) que traduzcan los índices EcoPlan en recomendaciones accionables para autoridades y ciudadanía.

## Tipos de reportes

1. **Reporte ejecutivo trimestral**
   - Resumen de índices clave (calor, vegetación, aire, agua).
   - Recomendaciones priorizadas por distrito.
   - Anexos con metodología y fuentes.

2. **Alertas tempranas**
   - Emails/Notificaciones cuando un indicador supera umbrales (p. ej., LST > percentil 95).
   - Integración con API municipal para seguimiento.

3. **Dataset abierto**
   - Exportaciones CSV/GeoJSON para cada indicador.
   - Publicación en portal de datos abiertos con licencia CC-BY 4.0.

## Pipeline propuesto

1. Programador (cron/Cloud Scheduler) invoca `/api/reports/generate`.
2. Backend procesa indicadores (consultando PostGIS o directamente GEE) y formatea resultados.
3. Se genera archivo PDF (templating `report-templates/`) y CSV.
4. Se almacena en Cloud Storage y se envía notificación.

### API disponible

El backend expone `POST /api/reports/generate`, que reutiliza la lógica de EcoPlan para producir un resumen estructurado listo para plantillas o dashboards.

**Payload**

```json
{
   "preset": "lima_metropolitana",
   "start": "2024-01-01",
   "end": "2024-12-31",
   "cloudPercentage": 20,
   "populationYear": 2020,
   "districtsAsset": "users/<usuario>/distritos"
}
```

Todos los parámetros son opcionales; por defecto se emplean los presets urbanos y rangos anuales. La respuesta incluye `indicators`, `summary`, `timeSeries` (NDVI, LST, AOD, NO₂, PM₂.₅), `boundaryStats` (primeros 25 distritos) y recomendaciones automáticas.

Para obtener una salida HTML lista para compartir, añade `?format=html` en la URL (o incluye `"format": "html"` en el payload). El endpoint responderá con un documento HTML responsivo que resume indicadores, recomendaciones y tablas por distrito.

Para descargar un PDF listo para distribución agrega `?format=pdf` (o `"format": "pdf"`). La API genera el mismo HTML internamente y lo convierte en PDF usando Chromium headless (Puppeteer). El archivo se entrega con encabezados `Content-Type: application/pdf` y `Content-Disposition: attachment`. Asegúrate de que el servidor disponga de las dependencias del navegador (en Ubuntu basta con `apt-get install -y libx11-6 libx11-xcb1 libxcb1 libxcb-render0 libxcb-shm0 libxcomposite1 libxcursor1 libxdamage1 libxi6 libxtst6 libnss3 libxrandr2 libatk1.0-0 libxss1 libgtk-3-0 libdrm2 libgbm1`).

Para generar un CSV con los indicadores, series temporales y métricas por distrito añade `?format=csv` (o `"format": "csv"`). El backend genera un archivo con secciones separadas (metadatos, indicadores, series, distritos) listo para abrir en Excel o cargar en otra aplicación. Se entrega con `Content-Type: text/csv` y `Content-Disposition: attachment`.

### Entrega automática en Google Cloud Storage

Además del archivo en la respuesta HTTP, puedes registrar el reporte directamente en un bucket de Cloud Storage. Incluye en el payload:

```json
{
   "format": "pdf",
   "preset": "lima_metropolitana",
   "delivery": {
      "gcs": {
         "bucket": "mi-bucket-reportes",
         "prefix": "reportes/ecoplan",
         "path": "reportes/ecoplan/custom/nombre-personalizado.pdf"
      }
   }
}
```

- `bucket`: obligatorio (puede omitirse si configuras `REPORTS_GCS_BUCKET` en el `.env`).
- `prefix`: opcional; si no se indica, se usa `reports/ecoplan/AAAA-MM-DD/preset/`.
- `path`: opcional; si lo defines, se usa exactamente esa ruta dentro del bucket.

Cuando la subida es exitosa, el servidor agrega los encabezados `X-Report-Gcs-Uri` y `X-Report-Gcs-Url`. En el caso del formato JSON, el response body incluirá una sección `delivery.gcs` con la ruta almacenada. Asegúrate de que la cuenta de servicio tenga permisos `storage.objects.create` sobre el bucket destino.

### Uso desde el dashboard web

El panel `public/index.html` incluye un modo **EcoPlan** con botones para descargar el reporte usando los parámetros que tengas configurados en el formulario:

1. Abre `http://localhost:3000` y selecciona la pestaña **EcoPlan Urbano**.
2. Ajusta preset, fechas, nubosidad y otros campos igual que para el análisis interactivo.
3. Usa los botones **Descargar PDF**, **Abrir HTML** o **Descargar CSV** para generar el reporte. El PDF/CSV se descargan directamente y el HTML se abre en una nueva pestaña.
4. El dashboard muestra mensajes de estado en la sección “Estado EcoPlan”; si configuraste entrega en GCS desde el backend, el download continúa siendo local pero el servidor también devolverá la ruta almacenada.
5. Consulta la tarjeta **Historial de reportes** para ver las últimas ejecuciones del scheduler (hasta 20). Puedes filtrar por `jobId` y estado, pulsar **Actualizar** para reconsultar el API y abrir un modal con detalles completos (cronología, archivos generados con enlaces públicos, estado de notificaciones, métricas e incluso el payload enviado) haciendo clic en cualquier fila.

## Próximos pasos

- [x] Crear servicio `services/reportsService.js` con generación de reportes JSON.
- [x] Diseñar plantilla LaTeX/HTML para reporte ejecutivo.
- [ ] Configurar integraciones con correo (SendGrid) o canales municipales.
- [ ] Documentar métricas de impacto en `docs/ecoplan-roadmap.md`.

### Plan de automatización de distribución

1. **Orquestación y scheduling (Sprint 1)**
   - Definir un manifiesto `config/report-distribution.json` con presets, formatos, frecuencia y responsables.
   - Implementar un orquestador (`services/reportDistributionOrchestrator.js`) que recorra el manifiesto y llame a `/api/reports/generate` para cada entrada (PDF/CSV/HTML) reutilizando la subida opcional a GCS.
   - Habilitar programación doble: `node-cron` para entornos locales y Cloud Scheduler para producción (con autenticación mediante token/service account).
   - Registrar tiempos de ejecución y errores en un log estructurado (p. ej., Winston + Stackdriver) para facilitar el monitoreo.

2. **Notificaciones multicanal (Sprint 2)**
   - Integrar proveedor de correo (SendGrid) para notificar a los destinatarios configurados con asunto, resumen de indicadores y enlaces públicos (`X-Report-Gcs-Url`).
   - Añadir conector opcional a Slack/Teams mediante webhooks para alertas rápidas cuando la entrega falle o se detecten umbrales críticos.
   - Plantillar los mensajes en `templates/report-notification.*` incorporando recomendaciones clave y metadatos (fecha, preset, versión de la metodología).

3. **Catálogo y trazabilidad (Sprint 3)**
   - Persistir un manifiesto histórico en Firestore o Postgres (`reports_runs` con estado, formato, URL, hash y métricas) para auditoría.
   - Exponer `GET /api/reports/history` y `GET /api/reports/:id` para consumir el catálogo desde el dashboard o integraciones externas.
   - Añadir vista en el dashboard con tabla filtrable de ejecuciones recientes, estado y accesos directos a los archivos.

4. **Observabilidad y gobierno (Sprint 4)**
   - Configurar métricas y alertas (Google Cloud Monitoring) para latencia, tasas de error y disponibilidad de GCS.
   - Implementar reintentos con backoff exponencial y cuarentena automática de runs fallidas (requiere intervención manual para reintentar).
   - Definir política de retención y permisos en GCS (lifecycle para archivar a los 180 días, ACL por grupo municipal) y documentarla en `docs/security/storage.md`.

> **Resultado esperado:** al finalizar los cuatro sprints, los reportes EcoPlan se generan según calendario, se notifican automáticamente a los actores clave, quedan catalogados con trazabilidad completa y cuentan con monitoreo/seguridad alineados a las necesidades municipales.

### Scheduler operativo (Sprint 1 implementado)

- **Manifiesto configurable**: el archivo `config/report-distribution.json` lista cada job con `id`, `cron`, `formats`, `payload`, `delivery` y `notifications`. Se admiten *placeholders* como `"rolling:-30d"` (últimos 30 días) o `"today"` en los parámetros de fecha.
- **Orquestador reutilizable**: `services/reportDistributionOrchestrator.js` genera un solo reporte base por job y produce las variantes HTML/PDF/CSV/JSON, subiéndolas automáticamente a GCS si está configurado.
- **Scheduling integrado**: `server.js` carga el manifiesto al arrancar, programa los cron con `node-cron` (respeta `job.timezone`, `defaults.timezone` o la variable `REPORTS_DISTRIBUTION_TZ`) y vuelve a cargarlos cuando el archivo cambia.
- **Hooks manuales / Cloud Scheduler**: `POST /api/reports/distribution/run` permite ejecutar todos los jobs o uno específico (enviar `{ "jobId": "ecoplan-trimestral" }`). Si defines `REPORTS_DISTRIBUTION_TOKEN`, el endpoint exige el encabezado `x-distribution-token` (ideal para Cloud Scheduler o GitHub Actions).
- **Variables de entorno**:
   - `REPORTS_DISTRIBUTION_ENABLED` (`true` por defecto): desactiva todo el scheduler cuando es `false`.
   - `REPORT_DISTRIBUTION_CONFIG`: ruta alternativa del manifiesto (por defecto `config/report-distribution.json`).
   - `REPORTS_DISTRIBUTION_TZ`: zona horaria global (fallback para jobs sin `timezone`).
   - `REPORTS_DISTRIBUTION_RUN_ON_BOOT`: ejecuta cada job una vez al iniciar si se establece en `true` (o `runOnStart: true` por job).
   - `REPORTS_SLACK_WEBHOOK`: se usa como destino cuando el manifiesto define `notifications.slack.webhookEnv`.
- **Logs estructurados**: toda ejecución escribe prefijos como `[distribution][ecoplan-trimestral][cron]` en consola (aprovechables por Cloud Logging). Cuando Earth Engine no está inicializado o el manifiesto no existe, el job se marca como `skipped` y se registra el motivo.

### Notificaciones multicanal (Sprint 2 implementado)

- **Correo electrónico (SendGrid)**: si `notifications.email.enabled` es `true`, el orquestador sintetiza un resumen con indicadores clave, recomendaciones y enlaces de GCS por formato. Se requiere `SENDGRID_API_KEY` y un remitente (`REPORTS_EMAIL_FROM`, opcionalmente `REPORTS_EMAIL_NAME`). El asunto se puede fijar con `notifications.email.subject` o mediante la variable `REPORTS_EMAIL_SUBJECT_PREFIX`.
- **Slack/Webhooks**: si `notifications.slack.enabled` es `true`, se publica un mensaje (texto plano) en el webhook definido por `notifications.slack.webhookUrl`, `notifications.slack.webhookEnv` o `REPORTS_SLACK_WEBHOOK`. Se incluye el estado del job, hora de generación, recursos disponibles y el canal opcional (`notifications.slack.channel`).
- **Merge de configuración**: los arreglos `recipients`, `cc` y `bcc` se combinan entre `defaults.notifications` y cada job. Los placeholders `rolling:-30d` o `today` en `payload` se resuelven antes de enviar el reporte, por lo que es seguro incluirlos en la notificación.
- **Resultados en la API**: la respuesta de `/api/reports/distribution/run` agrega un campo `notifications` por job con el estado de envío (`sent`, `skipped`, `error`), útil para debugging.
- **Fallback seguro**: si falta API key, remitente o webhook, el job continúa marcando la notificación como omitida y registrando el motivo en los logs (`[distribution][job][trigger]`).

Contribuciones: abrir issues con etiqueta `reports` para definir nuevos formatos o requerimientos.
