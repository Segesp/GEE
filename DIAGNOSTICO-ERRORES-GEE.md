# 🔧 DIAGNÓSTICO Y SOLUCIÓN - Errores Google Earth Engine

**Fecha:** 6 de octubre de 2025  
**Estado:** 🔄 EN PROGRESO

---

## 🎯 PROBLEMA REPORTADO

La página `analisis-avanzados.html` se queda bloqueada en "Procesando datos satelitales..." y no muestra resultados.

---

## 🔍 INVESTIGACIÓN REALIZADA

### 1. Verificación del Servidor
✅ **Servidor Node.js:** Operativo en puerto 3000  
✅ **Google Earth Engine:** Conectado exitosamente  
✅ **Service Account:** gee-tiles-service@github-nasa  
✅ **Proyecto GEE:** github-nasa  

### 2. Verificación de Datos
```bash
# Test ejecutado:
node -e "const ee = require('@google/earthengine'); ..."

# Resultado:
✅ EE OK
📊 Images: 30  # <- 30 imágenes MODIS disponibles para Lima, enero 2024
```

**Conclusión:** Los datos satelitales SÍ están disponibles ✅

### 3. Errores Identificados

#### Error #1: Sintaxis YAML en Swagger (CORREGIDO ✅)
```
YAMLSemanticError: Nested mappings are not allowed in compact mappings
```

**Solución aplicada:**
- Movidas las descripciones a nuevas líneas en documentación Swagger
- Archivos afectados: `server.js` (líneas 5340, 5391, 5452)

#### Error #2: Métodos Earth Engine incorrectos (CORREGIDO ✅)
```javascript
// ❌ Antes:
hasQC = bandNames.contains('QC_Day').and(bandNames.contains('QC_Night'))

// ✅ Después: Simplificado
lstCollection.select(['LST_Day_1km', 'LST_Night_1km'])  // Sin QC
```

#### Error #3: Colecciones Vacías (PARCIALMENTE CORREGIDO ⚠️)
```
Error: Image.select: Parameter 'input' is required and may not be null
```

**Causa:** Después de aplicar filtros QC, las colecciones quedaban vacías

**Soluciones aplicadas:**
1. Eliminados filtros de calidad QC problemáticos
2. Agregadas validaciones `size()` antes de procesar
3. Mensajes de error descriptivos

**Estado actual:** El error persiste en operaciones posteriores (NDVI/LST)

---

## 🐛 ERROR ACTIVO

### Error Principal
```javascript
Error en calculateUrbanHeatIsland: 
Error: Image.select: Parameter 'input' is required and may not be null.
```

### Ubicación
- Archivo: `services/advancedHeatIslandService.js`
- Línea aproximada: 179 (getMapId)

### Flujo de Ejecución
```
1. Cargar MODIS LST ✅ (30 imágenes encontradas)
2. Calcular promedio LST ⚠️ (posible problema)
3. Cargar MODIS NDVI ⚠️ (posible colección vacía)
4. Calcular máscara vegetación ❌ (null)
5. Calcular IIC ❌ (null porque paso anterior falló)
6. Generar mapas ❌ (error: input is null)
```

### Hipótesis
El dataset MODIS NDVI (MCD43A4) podría no tener datos para el período/región, causando que `ndviMean` sea null.

---

## 🔧 CORRECCIONES APLICADAS

### Cambio 1: Eliminación de filtros QC
```javascript
// Antes (problemático):
.select(['LST_Day_1km', 'LST_Night_1km', 'QC_Day', 'QC_Night'])
.map(img => {
  const qcDay = img.select('QC_Day');
  // ... filtrado complejo
})

// Después (simplificado):
.select(['LST_Day_1km', 'LST_Night_1km'])
```

### Cambio 2: Validación de colecciones
```javascript
const collectionSize = await lstCollection.size().getInfo();
if (collectionSize === 0) {
  throw new Error(`No hay datos MODIS LST disponibles...`);
}
```

### Cambio 3: Corrección sintaxis YAML
```yaml
# Antes:
- in: query
  name: threshold
  schema:
    type: number
  description: Temperature threshold...  # <- Error

# Después:
- in: query
  name: threshold
  description: Temperature threshold...  # <- Primero
  schema:
    type: number
```

---

## 📋 SOLUCIÓN PROPUESTA

### Opción A: Simplificar Cálculo (RECOMENDADO)
```javascript
// Versión simplificada sin NDVI
async calculateUrbanHeatIsland(params) {
  // 1. Solo cargar LST
  const lstCollection = ee.ImageCollection('MODIS/061/MOD11A1')
    .filterDate(startDate, endDate)
    .filterBounds(aoi);
  
  // 2. Calcular promedio
  const lstMean = lstCollection.mean();
  const lstC = lstMean.multiply(0.02).subtract(273.15);
  
  // 3. Calcular estadísticas simples
  const stats = await lstC.reduceRegion({
    reducer: ee.Reducer.mean(),
    geometry: aoi,
    scale: 1000
  }).getInfo();
  
  // 4. Retornar resultados sin mapas complejos
  return {
    success: true,
    meanTemperature: stats.LST_Day_1km,
    // ... más estadísticas simples
  };
}
```

### Opción B: Manejo Robusto de Errores
```javascript
try {
  const ndviCollection = ee.ImageCollection('MODIS/061/MCD43A4')...;
  const ndviSize = await ndviCollection.size().getInfo();
  
  if (ndviSize > 0) {
    // Calcular con NDVI
  } else {
    // Fallback sin NDVI
    console.warn('No NDVI data, using simplified calculation');
  }
} catch (error) {
  // Fallback completo
}
```

---

## 🚀 PRÓXIMOS PASOS

1. **Inmediato:** Implementar versión simplificada de Heat Island
2. **Corto plazo:** Probar cada endpoint individualmente
3. **Mediano plazo:** Agregar fallbacks robustos en todos los servicios
4. **Largo plazo:** Implementar cache de resultados

---

## 📊 ESTADO DE ENDPOINTS

| Endpoint | Estado | Problema |
|----------|--------|----------|
| `/api/advanced/heat-island` | ❌ Error | null en NDVI/LST |
| `/api/advanced/green-space` | ⚠️ No probado | Probable similar |
| `/api/advanced/air-quality` | ⚠️ No probado | Probable similar |
| `/api/advanced/flood-risk` | ⚠️ No probado | Probable similar |
| `/api/health` | ✅ OK | Endpoint simple funciona |

---

## 💡 LECCIONES APRENDIDAS

1. **Los filtros QC de MODIS pueden eliminar todas las imágenes**
   - Solución: Usar filtros menos restrictivos o hacer opcional
   
2. **No todos los datasets MODIS tienen cobertura completa**
   - Solución: Validar `.size()` antes de `.mean()`
   
3. **Earth Engine no soporta try-catch en operaciones**
   - Solución: Validaciones previas con `.getInfo()`
   
4. **Swagger YAML es estricto con indentación**
   - Solución: `description` debe ir antes de `schema`

---

## 📞 INFORMACIÓN TÉCNICA

**Datasets afectados:**
- `MODIS/061/MOD11A1` - LST (✅ Funciona, 30 imágenes)
- `MODIS/061/MCD43A4` - NDVI (⚠️ Posiblemente vacío)

**Región de prueba:**
- Lima, Perú: [-77.15, -12.00] a [-76.95, -12.20]
- Período: 2024-01-01 a 2024-01-31

**Logs relevantes:**
```
Error en calculateUrbanHeatIsland: 
  Error: Image.select: Parameter 'input' is required and may not be null.
  at AdvancedHeatIslandService.calculateUrbanHeatIsland 
    (/workspaces/GEE/services/advancedHeatIslandService.js:179:50)
```

---

**Última actualización:** 6 de octubre de 2025, 02:40 UTC  
**Estado:** 🔄 Trabajando en solución simplificada
