# Plan de participación ciudadana – EcoPlan Urbano

## Objetivos

1. Capturar evidencia local sobre falta de áreas verdes, inundaciones, contaminación.
2. Integrar reportes ciudadanos como insumo de validación y ajuste de índices.
3. Fortalecer la apropiación comunitaria de la plataforma EcoPlan.

## Estrategia

1. **Fase piloto** (Q2 2025): prueba con 2 distritos (San Juan de Lurigancho, Villa El Salvador).
2. **Escala metropolitana** (Q3 2025): habilitar reportes para toda Lima y Callao.
3. **Replicación** (Q4 2025 en adelante): incluir nuevas ciudades vía plantillas configurables.

## Canal tecnológico

- Aplicación web responsiva (PWA) conectada a endpoint `/api/citizen-reports` (pendiente de implementación).
- Posibilidad futura de app móvil híbrida (Ionic/React Native).
- Integración con autenticación básica (cuentas municipales, opción anónima con captcha).

## Flujo de reporte

1. Usuario selecciona tipo de incidente (falta de árboles, inundación, basura, humo, etc.).
2. Adjunta foto/texto, geolocalización automática o manual.
3. Sistema almacena en base de datos (`citizen_reports`), asigna estado `pendiente`.
4. Moderación verifica y clasifica (algoritmo + revisión manual).
5. Notificación de seguimiento al usuario y actualización en panel de indicadores.

## Incentivos

- Reconocimientos digitales (insignias, ranking de barrios comprometidos).
- Publicación de historias de éxito en la página principal.
- Vinculación con campañas municipales (plantación de árboles, brigadas anti-inundación).

## Métricas

| Indicador | Meta 2025 |
| --- | --- |
| Reportes recibidos | ≥ 500 |
| Reportes validados | ≥ 70 % |
| Respuesta promedio | < 7 días |

## Cronograma de acciones

- Abril 2025: diseño UX/UI del formulario.
- Mayo 2025: desarrollo MVP y pruebas internas.
- Junio 2025: lanzamiento piloto y campaña comunicacional.
- Agosto 2025: integración con panel EcoPlan.
- Octubre 2025: evaluación de impacto y mejoras.

Actualizar este plan con resultados de campo y retroalimentación de las comunidades.
