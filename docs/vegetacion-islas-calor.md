# 🌳 Vegetación e Islas de Calor Urbano - EcoPlan

## 📋 Descripción General

Plataforma de análisis temporal para Lima que integra datos de vegetación (NDVI) y temperatura superficial (LST) con información demográfica y de urbanización, diseñada para detectar islas de calor urbano, identificar brechas de cobertura vegetal y priorizar intervenciones ambientales.

## 🎯 Objetivos

1. **Detección de Islas de Calor**: Identificar cuándo y dónde se intensifican las anomalías térmicas
2. **Brecha de Áreas Verdes**: Localizar sectores con NDVI bajo y alta temperatura
3. **Exposición de Población**: Ponderar calor y falta de vegetación por densidad poblacional
4. **Focalización Territorial**: Filtrar por tipología urbana (SMOD) y producir listados priorizados por distrito

## 🗂️ Estructura de Archivos

```
/workspaces/GEE/
├── public/
│   └── vegetacion-islas-calor.html     # Interfaz web de demostración
├── docs/
│   ├── vegetacion-islas-calor-gee-script.js  # Código completo para GEE
│   └── vegetacion-islas-calor.md             # Este archivo (documentación)
```

## 🛠️ Tecnologías Utilizadas

### Google Earth Engine
- **Plataforma**: Code Editor / JavaScript API
- **Datasets principales**:
  - `COPERNICUS/S2_SR_HARMONIZED` - Sentinel-2 SR (10m, 5 días)
  - `LANDSAT/LC08/C02/T1_L2` - Landsat 8 L2 (30m, 16 días)
  - `LANDSAT/LC09/C02/T1_L2` - Landsat 9 L2 (30m, 16 días)
  - `MODIS/061/MOD11A2` - MODIS LST (1km, 8 días)
  - `JRC/GHSL/P2023A/GHS_POP/2020` - Población GHSL (100m)
  - `JRC/GHSL/P2023A/GHS_SMOD_V2-0/2020` - Settlement Model (100m)
  - `FAO/GAUL/2015/level2` - Límites administrativos

### Frontend
- **HTML5** + **CSS3** (Variables CSS, Grid, Flexbox)
- **JavaScript** (ES6+)
- **Responsive Design** (Mobile-first)
- **Accesibilidad** (WCAG 2.1 AA)

## 📊 Metodología

### 1. Procesamiento de NDVI (Vegetación)

```javascript
// Compuesto mensual de Sentinel-2 + Landsat
NDVI = (NIR - RED) / (NIR + RED)

// Sentinel-2: Banda 8 (NIR) y Banda 4 (RED)
// Landsat 8/9: Banda 5 (NIR) y Banda 4 (RED)
// Agregación: Mediana mensual (reduce nubes)
// Resolución efectiva: 10-30 m
```

**Interpretación NDVI**:
- `0.0 - 0.2`: Suelo desnudo, agua, urbano denso
- `0.2 - 0.4`: Vegetación escasa, arbustos
- `0.4 - 0.6`: Vegetación moderada, parques
- `0.6 - 0.8+`: Vegetación densa, bosques

### 2. Procesamiento de LST (Temperatura Superficial)

```javascript
// MODIS MOD11A2 (8 días, 1 km)
LST_°C = (LST_raw × 0.02) - 273.15

// Climatología (2018-2022) por mes
LST_climatology = mean(LST_2018-2022, grouped_by_month)

// Anomalía térmica
LST_anomaly = LST_monthly - LST_climatology
```

**Interpretación LST Anomalía**:
- `< -1.0°C`: Más frío que lo normal
- `-1.0 a +1.0°C`: Temperatura normal
- `+1.0 a +2.5°C`: Anomalía moderada (precaución)
- `+2.5 a +4.0°C`: **Isla de calor significativa**
- `> +4.0°C`: **Isla de calor extrema**

### 3. Filtro SMOD (Grado de Urbanización)

GHSL Settlement Model clasifica cada pixel en:

| Código | Descripción | Uso en EcoPlan |
|--------|-------------|----------------|
| 10 | Agua | Excluido |
| 11-13 | **Rural** (baja densidad) | Filtrable |
| 21-23 | **Urbano/Periurbano** (media densidad) | Filtrable |
| 30 | **Centro urbano** (alta densidad) | Filtrable |

### 4. Índice de Prioridad

```javascript
// Normalización Z-score
z(x, min, max) = (x - min) / (max - min)

// Índice base
PRIOR = z(LST_anom, -1, 3) - z(NDVI, 0.2, 0.6)

// Índice ponderado por población (opcional)
PRIOR_EXP = PRIOR + z(sqrt(POP), 0, 70)
```

**Interpretación**:
- **PRIOR > 0.6**: Alta prioridad (calor alto + vegetación baja)
- **PRIOR 0.3-0.6**: Prioridad media
- **PRIOR < 0.3**: Prioridad baja

### 5. Detección de Eventos de Islas de Calor

```javascript
// Criterio de detección
IF LST_anomaly > threshold THEN event = true

// Parámetros configurables:
// - Umbral (default: 2.0°C)
// - Período: Día (10:30 LT) o Noche (22:30 LT)
// - Área mínima (default: sin filtro)
```

## 🚀 Guía de Implementación

### Opción 1: Google Earth Engine Code Editor (Recomendado)

1. **Acceder al Code Editor**
   ```
   https://code.earthengine.google.com/
   ```

2. **Crear nuevo script**
   - File → New → Script
   - Nombrar: `ecoplan-vegetacion-islas-calor`

3. **Copiar código**
   - Abrir: `docs/vegetacion-islas-calor-gee-script.js`
   - Copiar todo el contenido
   - Pegar en el Code Editor

4. **Configurar ROI (opcional)**
   - Opción A: Dibujar polígono sobre Lima
   - Opción B: Usar ROI por defecto (pantalla actual)

5. **Cargar asset de distritos (opcional)**
   ```javascript
   // En el campo "Asset de distritos", ingresar:
   users/tu_usuario/Lima_Distritos
   ```
   
   Requisitos del asset:
   - Tipo: `ee.FeatureCollection`
   - Propiedad de nombre: `NOMB_DIST`, `NOMBRE`, `NAME` o similar
   - Geometría: Polígonos válidos

6. **Ejecutar script**
   - Click en botón "Run"
   - Esperar carga (~30-60 segundos)

7. **Interactuar con la aplicación**
   - Ajustar rango de fechas
   - Mover slider de mes
   - Activar/desactivar filtros SMOD
   - Revisar tablas y gráficos

### Opción 2: Publicar como GEE App

1. **En Code Editor**, después de ejecutar:
   ```
   Apps → Publish → New App
   ```

2. **Configurar app**:
   - Name: `EcoPlan - Vegetación e Islas de Calor`
   - Description: (descripción del proyecto)
   - Permissions: Public o Restricted

3. **Obtener URL pública**:
   ```
   https://tu_usuario.earthengine.app/view/ecoplan-vegetacion
   ```

4. **Compartir enlace** en la plataforma web principal

### Opción 3: Integración con API REST (Futuro)

**Arquitectura propuesta**:

```
┌─────────────┐
│  Frontend   │
│ (React/Vue) │
└──────┬──────┘
       │ HTTP
       ▼
┌─────────────┐
│  Backend    │
│ (Node.js)   │
└──────┬──────┘
       │ Python API
       ▼
┌─────────────┐
│ GEE Python  │
│   API       │
└─────────────┘
```

**Pasos**:

1. **Instalar Python API**:
   ```bash
   pip install earthengine-api
   ```

2. **Autenticar**:
   ```python
   import ee
   ee.Authenticate()
   ee.Initialize()
   ```

3. **Crear endpoint REST** (ejemplo):
   ```python
   @app.route('/api/vegetation/heat-islands', methods=['POST'])
   def get_heat_islands():
       roi = request.json['roi']
       start_date = request.json['start_date']
       end_date = request.json['end_date']
       
       # Procesar con GEE Python API
       result = process_heat_islands(roi, start_date, end_date)
       
       return jsonify(result)
   ```

## 📈 Casos de Uso

### 1. Planificación de Parques Urbanos

**Objetivo**: Identificar zonas con déficit de vegetación y alta temperatura

**Flujo**:
1. Filtrar por SMOD: Centro urbano (30)
2. Establecer umbral LST: +2.5°C
3. Revisar tabla de prioridades
4. Seleccionar distritos con PRIOR > 0.6 y NDVI < 0.3
5. Exportar lista de coordenadas para GIS

**Salida esperada**:
```
Distrito              | PRIOR | NDVI  | LST_anom | POP_sum
---------------------|-------|-------|----------|----------
San Juan de Lurigancho | 0.75  | 0.28  | +2.8°C   | 1,091,303
Lima Cercado          | 0.72  | 0.31  | +2.6°C   | 281,861
...
```

### 2. Monitoreo de Islas de Calor

**Objetivo**: Detectar eventos térmicos extremos para alertas tempranas

**Flujo**:
1. Seleccionar período: Verano (Dic-Mar)
2. Modo: Día (10:30 LT)
3. Umbral: +3.0°C
4. Revisar tabla de eventos
5. Correlacionar con reportes ciudadanos

**Salida esperada**:
```
Fecha   | Hora       | Área                    | LST_anom
--------|------------|-------------------------|----------
2024-01 | 10:30 día  | Lima Metropolitana      | +3.2°C ⚠️
2024-02 | 10:30 día  | San Juan de Lurigancho  | +3.5°C ⚠️
...
```

### 3. Evaluación de Políticas Ambientales

**Objetivo**: Medir impacto de intervenciones (parques, techos verdes)

**Flujo**:
1. Establecer baseline: NDVI y LST pre-intervención
2. Implementar intervención (ej: Parque zonal)
3. Esperar 6-12 meses
4. Comparar NDVI y LST post-intervención
5. Cuantificar mejora

**Métricas clave**:
- Δ NDVI: +0.15 esperado (de 0.30 a 0.45)
- Δ LST: -1.5°C esperado
- Área de influencia: 500m buffer

## 🎨 Interfaz de Usuario

### Panel de Controles (Izquierda)

```
⚙️ Controles de Análisis
├── ROI (dibujo o por defecto)
├── Agregación temporal (Mensual/Trimestral/Anual)
├── Máscara de nubes ☑️
├── LST Día/Noche
├── Rango de fechas (date pickers)
├── Slider de mes (0-24)
├── Filtros SMOD
│   ├── ☑️ Centro urbano (30)
│   ├── ☑️ Ciudad/Periurbano (21-23)
│   └── ☑️ Rural (11-13)
├── Umbral isla de calor (slider: -1 a +5°C)
├── Botones GIF (NDVI / LST)
├── Leyendas de color
└── Asset de distritos (opcional)
```

### Mapas Sincronizados (Centro)

```
┌─────────────────────────────────┐
│  🌿 NDVI (Vegetación)           │
│  Mes: 2024-01                   │
│  ┌───────────────────────────┐  │
│  │                           │  │
│  │     Mapa interactivo      │  │
│  │     (Leaflet / GEE)       │  │
│  │                           │  │
│  └───────────────────────────┘  │
└─────────────────────────────────┘

┌─────────────────────────────────┐
│  🌡️ LST Anomalía (Islas Calor) │
│  Mes: 2024-01                   │
│  ┌───────────────────────────┐  │
│  │                           │  │
│  │     Mapa interactivo      │  │
│  │     (Leaflet / GEE)       │  │
│  │                           │  │
│  └───────────────────────────┘  │
└─────────────────────────────────┘
```

### Panel de Análisis (Derecha)

```
📊 Series Temporales y Tablas
├── Serie NDVI (promedio ROI)
│   └── 📈 Gráfico de líneas
├── Serie LST Anomalía
│   └── 📈 Gráfico de líneas
├── Tabla de Eventos de Islas de Calor
│   ├── Fecha | Hora | Área | LST_anom
│   └── (Filtrado por umbral)
└── Tabla de Prioridades por Distrito
    ├── Nombre | PRIOR | NDVI | LSTa | POP
    └── (Ordenado por PRIOR desc)
```

## 📊 Datasets y Resoluciones

| Dataset | Variable | Resolución Espacial | Resolución Temporal | Fuente |
|---------|----------|-------------------|---------------------|--------|
| Sentinel-2 SR | NDVI | 10 m | 5 días | ESA/Copernicus |
| Landsat 8/9 L2 | NDVI | 30 m | 16 días | USGS |
| MODIS MOD11A2 | LST | 1 km | 8 días | NASA |
| GHSL POP | Población | 100 m | Anual (2020) | JRC |
| GHSL SMOD | Urbanización | 100 m | Anual (2020) | JRC |
| FAO GAUL | Admin | Vector | Estático | FAO |

## ⚠️ Limitaciones y Supuestos

### Técnicas

1. **LST ≠ Temperatura del aire**
   - LST mide temperatura de superficie (techo, suelo, vegetación)
   - Temperatura del aire puede diferir en 3-8°C
   - Usar LST como proxy, no medición directa

2. **Diferencia de resoluciones**
   - NDVI: 10-30 m (detalle fino)
   - LST: 1 km (detalle grueso)
   - Agregación espacial puede suavizar anomalías locales

3. **Nubes afectan NDVI**
   - Aunque se aplica máscara, días nublados reducen observaciones
   - Compuestos mensuales mitigan pero no eliminan el problema
   - Verificar número de observaciones disponibles

4. **Climatología limitada**
   - Base: 2018-2022 (5 años)
   - Cambio climático puede desplazar baseline
   - Recalcular climatología periódicamente

### Metodológicas

1. **Índice de Prioridad es relativo**
   - Útil para comparar dentro de Lima
   - No extrapolable a otras ciudades sin calibración

2. **Población estática (2020)**
   - Crecimiento urbano no capturado
   - Actualizar con datos censales más recientes cuando estén disponibles

3. **Simplificación SMOD**
   - Clasifica en 3 categorías (Rural/Semi/Urbano)
   - Dentro de cada categoría hay heterogeneidad

## 🔮 Extensiones Futuras

### 1. Integración de NO₂ (Sentinel-5P)

```javascript
// Dataset: COPERNICUS/S5P/NRTI/L3_NO2
var S5P = ee.ImageCollection('COPERNICUS/S5P/NRTI/L3_NO2')
  .select('NO2_column_number_density')
  .filterDate(start, end)
  .filterBounds(roi);

// Promedio mensual
var NO2_monthly = monthlyComposite(S5P, ee.Reducer.mean());

// Correlación con LST y NDVI
```

### 2. Accesibilidad Peatonal

**Datasets sugeridos**:
- OpenStreetMap (red vial, espacios públicos)
- Global Walking Accessibility Index

**Análisis**:
- Calcular distancia a parque más cercano
- Cruzar con NDVI bajo y LST alta
- Priorizar según accesibilidad

### 3. Matrix Bivariada 3×3

**Concepto**: Clasificar cada pixel en matriz NDVI × LST

```
         LST Bajo | LST Medio | LST Alto
---------|---------|-----------|----------
NDVI Alto|  Verde  |  Alerta   | Urgente
NDVI Medio| OK     | Moderado  | Prioritario
NDVI Bajo| Oportunidad | Crítico | Extremo
```

**Visualización**: Mapa con 9 colores distintos

### 4. Alertas Automáticas

**Trigger**: LST_anomaly > 3.0°C en distrito X

**Acción**:
1. Enviar notificación a autoridades locales
2. Generar reporte PDF automático
3. Publicar en dashboard público
4. Activar protocolo de respuesta (ej: activar fuentes, abrir parques)

### 5. Exportación Avanzada

**Formatos adicionales**:
- GeoTIFF (raster de NDVI/LST)
- Shapefile (vectores de distritos con stats)
- CSV (series temporales)
- PDF (reporte ejecutivo)

**API de exportación**:
```javascript
Export.table.toDrive({
  collection: priorityTable,
  description: 'EcoPlan_Prioridades_' + year + '_' + month,
  fileFormat: 'CSV'
});
```

## 📚 Referencias

### Científicas

1. **NDVI y Temperatura Superficial**
   - Weng, Q. (2009). *Thermal infrared remote sensing for urban climate and environmental studies*. ISPRS Journal of Photogrammetry and Remote Sensing, 64(3), 335-344.

2. **Islas de Calor Urbano**
   - Oke, T. R. (1982). *The energetic basis of the urban heat island*. Quarterly Journal of the Royal Meteorological Society, 108(455), 1-24.

3. **Vegetación y Mitigación Térmica**
   - Akbari, H., et al. (2001). *Cool surfaces and shade trees to reduce energy use and improve air quality in urban areas*. Solar Energy, 70(3), 295-310.

### Técnicas

- [Google Earth Engine Documentation](https://developers.google.com/earth-engine)
- [Sentinel-2 User Guide](https://sentinels.copernicus.eu/web/sentinel/user-guides/sentinel-2-msi)
- [MODIS LST Product Guide](https://lpdaac.usgs.gov/products/mod11a2v061/)
- [GHSL Data Package](https://ghsl.jrc.ec.europa.eu/download.php)

### Proyectos Similares

- [Urban Heat Watch](https://www.urbanheatwatch.org/) (NOAA)
- [Heat & Health Tracker](https://ephtracking.cdc.gov/Applications/heatTracker/) (CDC)
- [European Heat Risk Dashboard](https://climate.copernicus.eu/)

## 🤝 Contribuciones

### Cómo Contribuir

1. **Fork** el repositorio
2. **Crear rama** de feature: `git checkout -b feature/nueva-funcionalidad`
3. **Commit** cambios: `git commit -m 'Añadir nueva funcionalidad'`
4. **Push** a la rama: `git push origin feature/nueva-funcionalidad`
5. **Abrir Pull Request**

### Áreas de Mejora

- [ ] Optimización de procesamiento (reducir tiempo de carga)
- [ ] Integración con API Python de GEE
- [ ] Más paletas de colores (accesibilidad para daltónicos)
- [ ] Exportación de reportes PDF
- [ ] Dashboard en tiempo real
- [ ] Alertas push para autoridades
- [ ] Comparador temporal (antes/después)

## 📧 Contacto y Soporte

- **Email**: ayuda@ecoplan.gob.pe
- **GitHub**: https://github.com/Segesp/GEE
- **Documentación**: `/docs/vegetacion-islas-calor.md`
- **API REST**: https://ecoplan.gob.pe/api-docs

## 📄 Licencia

Este proyecto es parte de **EcoPlan** - Plataforma de Monitoreo Ambiental Urbano.

**Código**: MIT License  
**Datos**: CC BY 4.0 (atribución requerida)

---

**Versión**: 1.0.0  
**Última actualización**: 2025-01-05  
**Autores**: EcoPlan Team + Comunidad

---

**⭐ Si este proyecto te resulta útil, considera darle una estrella en GitHub!**
