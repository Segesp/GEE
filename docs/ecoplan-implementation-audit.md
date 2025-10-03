# Auditoría de implementación EcoPlan Urbano

Fecha: 2025-03-17

## Resumen del manual metodológico

El documento [`docs/manual-ecoplan-gee.md`](./manual-ecoplan-gee.md) establece los siguientes bloques de trabajo para EcoPlan Urbano con Google Earth Engine:

1. **Preparación del entorno y acceso**: solicitud de cuenta Earth Engine, configuración de proyecto en Google Cloud, autenticación con Python/geemap y consideraciones cliente-servidor.
2. **Definición de geometrías**: construcción de áreas de interés (AOI) en el Code Editor o mediante coordenadas.
3. **Ingesta y procesamiento**: pipelines para NDVI, LST/islas de calor, calidad del aire, calidad del agua/drenaje y datos socioeconómicos.
4. **Índices compuestos**: síntesis de variables mediante reductores y mosaicos de calidad.
5. **Interfaces (Earth Engine Apps)**: paneles interactivos nativos con widgets UI.
6. **Integración externa (Python + geemap)**: mapas incrustables y exportables a HTML.
7. **Exportación y cuotas**: tareas a Drive/GCS y monitoreo de límites.
8. **Buenas prácticas**: filtrado temprano, máscaras, evitar `getInfo`, combinación de reductores.
9. **Recursos**: enlaces a guías y bibliografía complementaria.

## Matriz de cobertura

| Bloque manual | Requisito clave | Evidencia en el repositorio | Estado |
| --- | --- | --- | --- |
| 1. Entorno y acceso | Habilitar proyecto de Cloud + scopes + servicio | `README.md` documenta creación de proyecto y uso de `service-account.json`; `server.js` implementa inicialización con scopes configurables y logs de estado. | ✅ Cumplido |
| 1. Entorno y acceso | Compartición de assets y guía para Apps | No hay referencia en `README.md` ni en el frontend sobre compartir assets para Apps; sólo se menciona autenticación. | ⚠️ Parcial |
| 1. Entorno y acceso | Instalación Python + geemap | El repositorio no incluye scripts ni instrucciones Python (`requirements.txt` ausente). | ❌ No cubierto |
| 1. Entorno y acceso | Buenas prácticas cliente/servidor | `server.js` evita `getInfo`, usa evaluaciones diferidas (`evaluateEeObject`) y `updateMask`, alineado con las recomendaciones del manual. | ✅ Cumplido |
| 2. Geometrías | AOI predefinidas y buffers configurables | Presets y buffers en `server.js` (`getEcoPlanRoiFromRequest`, `ECOPLAN_ROI_PRESETS`) y UI correspondiente en `public/index.html`. | ✅ Cumplido |
| 3.1 NDVI | NDVI con Sentinel-2, máscara de nubes, `qualityMosaic` | `buildEcoPlanAnalysis` genera NDVI (`normalizedDifference`), aplica `maskSentinel2` y `qualityMosaic`. | ✅ Cumplido |
| 3.2 LST | Conversión LST a °C y combinación con NDVI/población | `addLstCelsius` transforma `ST_B10` y se usa en el índice de calor que mezcla LST, NDVI y densidad poblacional. | ✅ Cumplido |
| 3.3 Calidad del aire | Integración de contaminantes (AOD, NO₂, PM2.5) | Implementación sólo incorpora AOD (MODIS MOD08_M3) y serie temporal básica; no hay integración de NO₂/PM2.5 ni remuestreo multi-capa. | ⚠️ Parcial |
| 3.4 Agua y drenaje | NDWI + indicadores hidrológicos | Se calcula NDWI promedio, pero no se enlaza con precipitaciones ni se generan indicadores específicos de drenaje urbano. | ⚠️ Parcial |
| 3.5 Socioeconómico | Capas poblacionales | Uso de `CIESIN/GPWv411` con selección por año y normalización; el panel muestra medias y máximos. | ✅ Cumplido |
| 4. Índices compuestos | Reductores combinados y `reduceRegions` | Se construye `HeatVulnerability` y, si se provee `districtsAsset`, se ejecuta `reduceRegions` con media+desv. estándar. | ✅ Cumplido |
| 5. Earth Engine Apps | UI nativa con `ui.Panel`, `ui.Map`, etc. | No existe carpeta ni scripts de Apps; la UI actual es una SPA Leaflet/Chart.js externa. | ❌ No cubierto |
| 6. Integración externa (Python + geemap) | Scripts o docs `geemap` | Ausente; sólo hay backend Node y frontend web. | ❌ No cubierto |
| 7. Exportación y cuotas | Exportaciones a Drive/GCS y seguimiento | Endpoint `/api/export/gcs` lanza `ee.batch.Export.image.toCloudStorage`, pero no hay `Export.toDrive` ni tracking real de tareas/cuotas. | ⚠️ Parcial |
| 8. Buenas prácticas | Filtros tempranos, máscaras, `tileScale`, combinaciones | Código aplica filtros (`filterDate`, `filterBounds`, `filter lt CLOUDY`), máscaras (`updateMask`), normalizaciones y `tileScale` en reductores. | ✅ Cumplido |
| 9. Recursos | Referencias accesibles | La guía original (manual) permanece intacta; no se replican enlaces en README pero sí en el manual. | ✅ Cumplido |

## Observaciones clave

- El frontend EcoPlan (`public/index.html`) refleja la mayor parte de la analítica del manual (NDVI, LST, NDWI, AOD, población), pero requiere más capas para calidad del aire y del agua si se busca alineación total.
- Falta entregar los componentes propuestos en el manual para **Earth Engine Apps** y para la **automatización Python/geemap**, que son capítulos completos del documento.
- El endpoint de exportación es funcional, pero el monitoreo de cuotas y el soporte a Drive/Assets sigue pendiente.
- No se encontró documentación sobre el proceso de compartir assets cuando se despliegan Apps o cuando se usan `FeatureCollections` personalizadas; es una de las advertencias del manual.

## Recomendaciones

1. **Completar capas ambientales**: añadir al backend indicadores de NO₂/PM₂.₅ (S5P) y métricas hidrológicas adicionales (p. ej. inundaciones, precipitación) para cumplir el Capítulo 3 por completo.
2. **Publicar una App nativa**: crear un script en el Earth Engine Code Editor que replique el flujo EcoPlan y documentar su URL. Esto cubriría el Capítulo 5.
3. **Agregar notebook Python/geemap**: incluir un cuaderno de ejemplo que inicialice `geemap`, genere mapas y los exporte a HTML, siguiendo la sección 6.
4. **Mejorar exportaciones**: exponer endpoints o scripts para `Export.image.toDrive` y registrar estados de tarea (quizá con Firestore/Redis) para alinear la sección 7.
5. **Documentar sharing y cuotas**: ampliar `README.md` con pasos de compartición de assets y enlaces directos a la consola de uso/cuotas.

---

> Esta auditoría se basa en el estado del repositorio al commit actual dentro del contenedor de desarrollo. Actualice este informe si se realizan nuevos aportes.
