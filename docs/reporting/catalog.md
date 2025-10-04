# Catálogo de ejecuciones de reportes EcoPlan

## Objetivo

Registrar cada ejecución del scheduler de reportes (manual o programada) con metadatos suficientes para auditar, volver a descargar archivos y analizar tendencias de generación.

## Almacenamiento propuesto

| Ambiente | Backend | Detalles |
| --- | --- | --- |
| Producción / staging | Firestore (modo Datastore) | Usa la librería oficial `@google-cloud/firestore`, colección `reportRuns`. ACL mediante la misma cuenta de servicio que el servidor. |
| Desarrollo local / CI | Archivo JSON (`.data/report-runs.json`) | Persistencia ligera para pruebas. Evita dependencia en Firestore durante test `npm test`. |

### Selección dinámica

1. Si `REPORTS_RUNS_STORE` = `firestore` **o** existe `GOOGLE_APPLICATION_CREDENTIALS`, se inicializa Firestore.
2. Si el paso anterior falla o `REPORTS_RUNS_STORE` = `file`, se usa el adaptador de archivo.
3. Como último recurso, se emplea un adaptador en memoria (no persiste). Útil para pruebas unitarias.

## Esquema de datos

Cada documento/registro representa una ejecución (`run`). Un job puede generar múltiples runs (por reintentos, disparadores manuales, etc.). Campos sugeridos:

| Campo | Tipo | Descripción |
| --- | --- | --- |
| `id` | `string` | UUID v4 generado por el orquestador. |
| `jobId` | `string` | ID del job (`config/report-distribution.json`). |
| `presetId` | `string` | ID del preset usado (ej. `lima_metropolitana`). |
| `presetName` | `string` | Etiqueta legible (`report.preset.label`). |
| `trigger` | `"cron" \| "startup" \| "manual" \| "scheduler" \| "retry"` | Origen de la ejecución. |
| `status` | `"success" \| "partial" \| "error" \| "skipped"` | Resultado agregado. |
| `startedAt` | `string (ISO)` | Momento en que se inicia el job. |
| `completedAt` | `string (ISO)` | Momento en que finaliza. |
| `durationMs` | `number` | Diferencia `completedAt - startedAt`. |
| `generatedAt` | `string (ISO)` | Timestamp del reporte (`report.generatedAt`). |
| `request` | `object` | Payload efectivo usado: preset, fechas, filtros (se eliminarán credenciales o campos sensibles). |
| `results` | `Array<object>` | Entrada por formato. Ver estructura abajo. |
| `notifications` | `object` | Estado de correo/Slack (`status`, `recipients`, `error`). |
| `delivery` | `object` | Destinos extra (p.e. GCS). |
| `metrics` | `object` | Indicadores clave (NDVI, LST, etc.) para dashboards. |
| `hash` | `string` | Hash SHA-256 del payload + preset + fechas para detectar duplicados. |
| `error` | `object` | Campo opcional con detalles en caso de fallo. |

### Estructura `results[]`

```json
{
  "format": "pdf",
  "status": "success",
  "bytes": 382144,
  "gcs": {
    "bucket": "mi-bucket",
    "path": "reports/ecoplan/...",
    "publicUrl": "https://...",
    "gsUri": "gs://..."
  },
  "error": null
}
```

### Estructura `notifications`

```json
{
  "email": {
    "status": "sent",
    "recipients": ["equipo@municipio.gob.pe"],
    "error": null
  },
  "slack": {
    "status": "skipped",
    "error": "missing-webhook"
  }
}
```

## Índices y consultas

- **Firestore**: crear índice compuesto (`jobId`, `completedAt` descendente) para listados recientes. Opcional: índice (`hash`, `status`) para detectar duplicados.
- **Archivo**: ordenar en memoria por `completedAt` y limitar a 100 registros en endpoints.

## API planeada

- `GET /api/reports/history?jobId=...&limit=50`: devuelve runs ordenados por `completedAt DESC`.
- `GET /api/reports/history/:id`: retorna un run con todos sus campos.
- `POST /api/reports/history/:id/retry` *(futuro)*: vuelve a ejecutar un run fallido (requiere token y validaciones).

## Sanitización y privacidad

- Nunca almacenar payloads completos si incluyen secretos (ej. `delivery.gcs.path` personalizado con credenciales). Se guardará sólo lo necesario para reproducir el reporte.
- En resultados, exponer únicamente URLs públicas o `gsUri`. URLs firmadas deberán omitirse o guardarse con caducidad.
- Aplicar `reportRunsRepository.sanitizePayload(payload)` antes de persistir.

## Plan de implementación

1. **Repositorio** (`services/reportRunsRepository.js`): interfaz `saveRun`, `getRun`, `listRuns`, `updateRun` (para actualizaciones parciales si se decide registrar progreso).
2. **Integración**: envolver llamadas a `executeJob` para registrar `startedAt` / `completedAt`, guardar resultados y estado final.
3. **API**: rutas Express que consuman el repositorio con paginación básica.
4. **Frontend**: tabla en dashboard (paginación simple, filtros por job y estado).

Este documento guía las decisiones de persistencia y servirá como punto de referencia para el Sprint 3 del pipeline de reportes EcoPlan.
