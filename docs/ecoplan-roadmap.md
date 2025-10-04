# Hoja de ruta EcoPlan Urbano 2025

| Fase | Periodo | Objetivos | Entregables | Indicadores |
| --- | --- | --- | --- | --- |
| Piloto (Q1) | Ene–Mar 2025 | Configurar pipelines GEE, integrar NDVI/LST, lanzar panel Bloom/EcoPlan en beta. | Endpoints `/api/ecoplan/analyze`, dashboard Leaflet, notebook inicial geemap. | >80% endpoints operativos, prueba con 1 distrito. |
| Ajustes (Q2) | Abr–Jun 2025 | Añadir calidad del aire, riesgo hídrico, validación con datos locales, incorporar participación ciudadana mínima. | Endpoints de NO₂/PM₂.₅, NDWI & impermeabilización, módulo de reportes ciudadanos (MVP). | 3 datasets socioeconómicos integrados, sesiones de feedback con 2 municipalidades. |
| Escalamiento (Q3) | Jul–Sep 2025 | Preparar despliegue en nube, automatizar actualizaciones, publicar App Earth Engine y GeoServer. | Infraestructura IaC, CI/CD, servicios WMS, documentación swagger. | Tiempo de actualización <48h, uptime >99%. |
| Operación (Q4) | Oct–Dic 2025 | Generar reportes automáticos, consolidar alianzas, preparar replicación a otra ciudad (Callao / Arequipa). | Reportes PDF/CSV, manual de capacitación, plantilla de replicación. | 4 reportes trimestrales emitidos, comunidad de práctica activa. |

## Hitos clave

- **Hito 1**: Firma de convenios (Feb 2025).
- **Hito 2**: Validación de índices con mediciones de campo (Jun 2025).
- **Hito 3**: Lanzamiento beta público (Ago 2025).
- **Hito 4**: Reporte anual de resultados (Dic 2025).

## Gestión del proyecto

- Reuniones de seguimiento quincenales (coordinación + leads técnicos).
- Revisión de indicadores de uso y desempeño mensual (panel de métricas por implementar).
- Retroalimentación con comunidades cada trimestre.

## Riesgos y mitigación

| Riesgo | Probabilidad | Impacto | Mitigación |
| --- | --- | --- | --- |
| Falta de acceso a datos locales | Media | Alta | Establecer acuerdos tempranos, usar datasets abiertos de respaldo (SEDAC, WorldPop). |
| Limitaciones de cuotas GEE | Baja | Media | Gestionar cuentas de servicio adicionales y programar exportes fuera de horas pico. |
| Cambios institucionales | Media | Alta | Formalizar convenios multi-anuales, involucrar múltiples dependencias. |
| Aceptación ciudadana baja | Media | Media | Realizar campañas de sensibilización, ofrecer retroalimentación visible en la plataforma. |

## Dependencias

- Configuración de PostgreSQL/PostGIS (`docs/database-schema.sql`).
- Implementación de CI/CD (`docs/devops-pipeline.md`).
- Módulo de participación ciudadana (`docs/participacion/`).

Actualizar trimestralmente esta hoja de ruta y registrar en las notas de reunión los desvíos o cambios de alcance.
