# 🚀 Inicio Rápido: Calidad de Aire y Agua

## ⚡ Acceso Inmediato (< 2 minutos)

### Opción 1: Demo Web Local

```bash
# Acceder directamente a la interfaz
http://localhost:3000/calidad-aire-agua.html
```

**¿Qué verás?**
- 🌍 Mapa interactivo de Lima Metropolitana
- 📊 Panel de controles (fecha, variables, configuración)
- 🎨 4 tabs para cambiar entre AOD, NO₂, Clorofila y NDWI
- 📈 Leyendas científicas dinámicas
- 📅 2,100+ días de datos disponibles (2020-presente)

---

## 🛠️ Opciones de Uso

### A. Visualización Rápida (Solo ver la interfaz)

1. **Abrir navegador**:
   ```
   http://localhost:3000/calidad-aire-agua.html
   ```

2. **Explorar controles**:
   - Selecciona una fecha (2020-01-01 a hoy)
   - Marca/desmarca variables (AOD, NO₂, Clorofila, NDWI)
   - Cambia entre tabs para ver diferentes leyendas
   - Haz clic en "Cargar Datos" (muestra alerta informativa)

3. **Ver mapa**:
   - Zoom in/out con scroll o controles
   - Pan arrastrando el mapa
   - Observa el rectángulo azul (área de Lima)

**Duración**: 2-5 minutos

---

### B. Análisis Real con Google Earth Engine

#### Requisitos Previos
- ✅ Cuenta de Google (Gmail)
- ✅ Navegador web moderno (Chrome, Firefox, Edge)

#### Pasos

**1. Obtener el script GEE**
```bash
# Ver el script en tu editor local
cat /workspaces/GEE/docs/calidad-aire-agua-gee-script.js

# O abrirlo con VS Code
code /workspaces/GEE/docs/calidad-aire-agua-gee-script.js
```

**2. Ir a Google Earth Engine Code Editor**
```
https://code.earthengine.google.com/
```

- Inicia sesión con tu cuenta de Google
- Si es primera vez, acepta los términos de uso
- Espera a que cargue el editor (~10 segundos)

**3. Copiar y pegar el script**
- Selecciona **todo** el contenido de `calidad-aire-agua-gee-script.js`
- Cópialo (Ctrl+C / Cmd+C)
- Pégalo en el panel de código del editor GEE (Ctrl+V / Cmd+V)

**4. Ejecutar**
- Haz clic en el botón **"Run"** (arriba del editor)
- O presiona **F5**
- Espera ~30-60 segundos (procesa miles de imágenes)

**5. Visualizar resultados**

En el **mapa** (derecha):
- 🔴 **AOD** - Aerosoles (capa roja)
- 🟡 **NO₂** - Dióxido de nitrógeno (capa amarilla)
- 🟢 **Clorofila** - Calidad de agua (capa verde)
- 🔵 **NDWI** - Índice de agua (capa azul)

En la **consola** (derecha abajo):
- 📊 4 gráficos de series temporales (2020-2025)
- 📈 Estadísticas zonales (media, mín, máx, desv. est.)
- 🏘️ Tabla de 7 distritos con valores
- ⚠️ Alertas (áreas con AOD > 0.3, NO₂ > 150)
- 🌐 URLs de GIBS/Worldview

**Duración**: 5-10 minutos

---

### C. Automatización Diaria (Avanzado)

#### Opción C1: Script Python Local

**1. Instalar dependencias**
```bash
pip install requests
```

**2. Crear script de descarga**
```python
# download_gibs.py
import requests
from datetime import datetime

GIBS_URL = "https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi"
BBOX = "-77.2,-12.4,-76.7,-11.7"
DATE = datetime.now().strftime('%Y-%m-%d')

params = {
    'SERVICE': 'WMS',
    'VERSION': '1.3.0',
    'REQUEST': 'GetMap',
    'FORMAT': 'image/png',
    'LAYERS': 'MODIS_Terra_Aerosol',
    'CRS': 'EPSG:4326',
    'BBOX': BBOX,
    'WIDTH': '1024',
    'HEIGHT': '1024',
    'TIME': DATE
}

response = requests.get(GIBS_URL, params=params)

if response.status_code == 200:
    with open(f'AOD_{DATE}.png', 'wb') as f:
        f.write(response.content)
    print(f"✅ Descargado AOD para {DATE}")
else:
    print(f"❌ Error: {response.status_code}")
```

**3. Ejecutar**
```bash
python download_gibs.py
```

**4. Automatizar con cron (Linux/macOS)**
```bash
# Editar crontab
crontab -e

# Añadir línea (ejecutar diariamente a las 8 AM)
0 8 * * * /usr/bin/python3 /path/to/download_gibs.py >> /var/log/ecoplan_gibs.log 2>&1
```

**Duración configuración**: 10-15 minutos  
**Ejecución automática**: Diaria

---

#### Opción C2: Google Cloud Function

**1. Crear archivo `main.py`**
```python
import ee

def download_gee_daily(request):
    ee.Initialize()
    
    lima = ee.Geometry.Rectangle([-77.2, -12.4, -76.7, -11.7])
    
    aod = ee.ImageCollection('MODIS/061/MCD19A2_GRANULES') \
        .filterBounds(lima) \
        .filterDate('2025-10-05', '2025-10-06') \
        .select('Optical_Depth_055') \
        .first() \
        .multiply(0.001)
    
    stats = aod.reduceRegion(
        reducer=ee.Reducer.mean(),
        geometry=lima,
        scale=1000
    ).getInfo()
    
    return {'status': 'success', 'aod_mean': stats.get('Optical_Depth_055')}
```

**2. Desplegar**
```bash
gcloud functions deploy download_gee_daily \
    --runtime python39 \
    --trigger-http \
    --allow-unauthenticated \
    --schedule "0 8 * * *"
```

**Duración configuración**: 20-30 minutos  
**Ejecución automática**: Diaria

---

## 📚 Documentación Completa

### Para Aprender Más

| Documento | Contenido | Líneas | Audiencia |
|-----------|-----------|--------|-----------|
| **calidad-aire-agua.md** | Metodología, implementación, casos de uso, limitaciones | ~1,400 | Desarrolladores, investigadores |
| **COMPLETADO-CALIDAD-AIRE-AGUA.md** | Resumen ejecutivo, archivos creados, estadísticas | ~600 | Gestores, stakeholders |
| **INICIO-RAPIDO-CALIDAD-AIRE-AGUA.md** | Esta guía (inicio rápido) | ~200 | Todos |

### Ubicación de Archivos

```
/workspaces/GEE/
├── public/
│   └── calidad-aire-agua.html          ← Interfaz web
├── docs/
│   ├── calidad-aire-agua-gee-script.js ← Script GEE completo
│   └── calidad-aire-agua.md            ← Documentación técnica
├── COMPLETADO-CALIDAD-AIRE-AGUA.md     ← Resumen de implementación
└── INICIO-RAPIDO-CALIDAD-AIRE-AGUA.md  ← Esta guía
```

---

## ❓ Preguntas Frecuentes

### ¿Necesito instalar algo para ver la demo web?
**No**. Solo abre `http://localhost:3000/calidad-aire-agua.html` en tu navegador (el servidor Node.js ya debe estar corriendo).

### ¿Necesito cuenta de Google Earth Engine?
**Sí, solo si quieres ejecutar el script GEE**. La cuenta es gratuita para uso no comercial. Regístrate en: https://earthengine.google.com/signup/

### ¿Los datos en la demo web son reales?
**No**. La interfaz web actual es una demo que muestra el diseño y controles. Para datos reales, ejecuta el script GEE en Code Editor.

### ¿Puedo usar esto para otras ciudades?
**Sí**. Solo cambia el `bbox` en el script GEE:
```javascript
var limaBounds = ee.Geometry.Rectangle({
  coords: [lon_min, lat_min, lon_max, lat_max],
  geodesic: false
});
```

### ¿Cuánto tiempo toma procesar los datos en GEE?
**~30-60 segundos** para todo el script completo (2020-2025, 4 variables, análisis, series temporales).

### ¿Puedo descargar los datos?
**Sí**. Descomenta las secciones `Export.image.toDrive()` o `Export.table.toDrive()` en el script GEE y ejecuta. Los archivos se guardarán en tu Google Drive.

### ¿Qué significa "NRTI"?
**Near Real-Time** (Casi tiempo real). Los datos están disponibles ~3 horas después de la observación satelital.

### ¿Cómo interpreto AOD = 0.25?
**Moderado**. Ver tabla en `docs/calidad-aire-agua.md` sección 5.1:
- 0.0-0.1: Excelente
- 0.1-0.2: Bueno
- 0.2-0.3: Moderado ← Aquí
- 0.3-0.5: Malo
- >0.5: Muy malo

### ¿Los datos funcionan en Lima durante el invierno (mayo-octubre)?
**Sí**. Aunque Lima tiene mayor cobertura nubosa en invierno (~20%), los satélites MODIS y Sentinel-5P tienen buena penetración y algoritmos de filtrado de nubes.

### ¿Puedo integrar esto con mi aplicación?
**Sí** (futuro). La Fase 2 del roadmap incluye una API REST con endpoints HTTP. Por ahora, puedes ejecutar el script GEE y exportar datos para consumo externo.

---

## 🎯 Casos de Uso Rápidos

### 1. Monitorear Calidad del Aire Hoy

```javascript
// En GEE Code Editor, modifica la fecha:
var singleDate = '2025-10-05'; // HOY

// Ejecuta el script
// Observa el mapa: ¿Zonas rojas (AOD alto) o amarillas (NO₂ alto)?
```

**Interpretación**:
- Zonas rojas = Alta contaminación particulada (tráfico, industria, polvo)
- Zonas amarillas = Alto NO₂ (combustión vehicular)

### 2. Detectar Eventos Extremos

```javascript
// Buscar en la consola GEE:
print('Área con alerta combinada (km²):', ...);

// Si > 100 km² → Evento significativo
// Si > 500 km² → Evento extremo (requiere acción inmediata)
```

### 3. Comparar con Mes Anterior

```javascript
// Cambiar fechas:
var startDate = '2025-09-01';
var endDate = '2025-09-30';

// Ejecutar
// Comparar series temporales: ¿Tendencia creciente o decreciente?
```

---

## 🔗 Enlaces Útiles

- **Demo Web**: http://localhost:3000/calidad-aire-agua.html
- **GEE Code Editor**: https://code.earthengine.google.com/
- **NASA Worldview**: https://worldview.earthdata.nasa.gov/
- **GIBS API Docs**: https://nasa-gibs.github.io/gibs-api-docs/
- **GEE Datasets**: https://developers.google.com/earth-engine/datasets

---

## 📞 Soporte

**¿Problemas o dudas?**

1. Revisa `docs/calidad-aire-agua.md` (documentación completa)
2. Revisa `COMPLETADO-CALIDAD-AIRE-AGUA.md` (resumen ejecutivo)
3. Contacta: ayuda@ecoplan.gob.pe
4. GitHub Issues: https://github.com/Segesp/GEE/issues

---

**⏱️ Tiempo estimado para estar operativo**: **< 10 minutos**

**⭐ ¡Comienza a monitorear la calidad de aire y agua de Lima ahora mismo!**
