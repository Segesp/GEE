# Participación ciudadana EcoPlan

Este módulo permite capturar reportes georreferenciados desde el dashboard para complementar los indicadores satelitales con observaciones locales.

## Flujo operativo

1. Cambia al modo **EcoPlan Urbano** en la interfaz.
2. En la tarjeta *Participación ciudadana*, elige la categoría de incidencia.
3. Haz clic en **Marcar en el mapa** y selecciona la ubicación exacta (latitud/longitud se completan automáticamente).
4. Describe el problema, adjunta evidencia opcional (URL) y añade datos de contacto si se necesita seguimiento.
5. Envía el formulario; el reporte aparece inmediatamente en la lista y en el mapa como un marcador temático.

Los reportes pueden refrescarse manualmente con el botón **Actualizar**. Cada entrada incluye acceso directo para recentrar el mapa y abrir la evidencia adjunta.

## API

### Crear reporte

```
POST /api/citizen-reports
Content-Type: application/json

{
  "category": "heat",           // heat, green, flooding, water, air, waste, other
  "description": "Sin sombra en el parque principal",
  "latitude": -12.0457,
  "longitude": -77.0312,
  "photoUrl": "https://ejemplo.org/fotos/123.jpg",            // opcional
  "contactName": "Brigada vecinal",
  "contactEmail": "brigada@example.com"                      // opcional
}
```

Campos obligatorios: `category`, `description`, `latitude`, `longitude`.

La respuesta exitosa (201) contiene el reporte normalizado. En caso de datos inválidos, el backend regresa `400` con un arreglo `errors` describiendo los campos a corregir.

### Listar reportes

```
GET /api/citizen-reports?limit=200&category=green&bbox=-77.2,-12.2,-76.9,-11.9
```

Query params admitidos:

| Parámetro | Descripción |
| --- | --- |
| `limit` | Cantidad máxima de registros (1–500, por defecto 100) |
| `status` | Filtra por estado (`open`, `resolved`, etc.) |
| `category` | Categoría de incidencia |
| `bbox` | Ventana geográfica `minLon,minLat,maxLon,maxLat` |

La respuesta contiene `reports` con campos listos para usarse en mapas, dashboards o integraciones municipales.

## Almacenamiento

Por defecto los reportes se guardan en `.data/citizen-reports.json`. Puedes cambiar la estrategia con variables de entorno:

```bash
CITIZEN_REPORTS_STORE=firestore
CITIZEN_REPORTS_COLLECTION=citizenReports
```

Si se detectan credenciales de Google Cloud (`GOOGLE_APPLICATION_CREDENTIALS`, `GOOGLE_SERVICE_ACCOUNT_JSON`, etc.), el repositorio intenta usar Firestore automáticamente. También existe la opción `CITIZEN_REPORTS_STORE=memory` para escenarios efímeros.

## Próximos pasos sugeridos

- Flujos de moderación y actualización de estado (`open`, `review`, `resolved`).
- Integración con canales municipales (correo, Slack o webhook) para alertas inmediatas.
- Exportación a CSV/GeoJSON y filtros por fecha.
- Notificaciones desde la interfaz cuando se carguen nuevos reportes.
