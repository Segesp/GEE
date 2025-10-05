# 🚀 Inicio Rápido: Vegetación e Islas de Calor

## 📍 ¿Qué se implementó?

Una plataforma completa para analizar vegetación (NDVI) e islas de calor urbano (LST) en Lima usando Google Earth Engine.

## ⚡ Opciones de Uso

### 1️⃣ Ver Demo Local (Ahora Mismo)

```bash
# Si el servidor no está corriendo, inícialo:
cd /workspaces/GEE
node server.js

# Luego abre en tu navegador:
http://localhost:3000/vegetacion-islas-calor.html
```

**Qué verás**:
- Interfaz completa con 3 paneles
- Controles interactivos (sliders, filtros, fechas)
- Tablas de ejemplo con datos de Lima
- Guía de implementación integrada

### 2️⃣ Usar en Google Earth Engine (Funcionalidad Completa)

#### Paso 1: Copiar código
```bash
cat /workspaces/GEE/docs/vegetacion-islas-calor-gee-script.js
# O abre el archivo en tu editor y copia todo
```

#### Paso 2: Ir a GEE Code Editor
Abre: https://code.earthengine.google.com/

#### Paso 3: Pegar y ejecutar
1. File → New → Script
2. Pegar el código completo
3. Presionar "Run" (o F5)
4. ¡Listo! La app se cargará en 30-60 segundos

#### Paso 4: Interactuar
- Dibujar ROI sobre Lima (opcional)
- Ajustar rango de fechas
- Mover slider de mes
- Activar/desactivar filtros SMOD
- Ver mapas, gráficos y tablas
- Generar GIFs animados

### 3️⃣ Publicar como App Web (Opcional)

Desde GEE Code Editor después de ejecutar:
1. Apps → Publish → New App
2. Nombre: "EcoPlan - Vegetación e Islas de Calor"
3. Permissions: Public o Restricted
4. Copiar URL pública
5. ¡Compartir!

## 📊 ¿Qué hace la aplicación?

### Funcionalidades principales

✅ **NDVI (Vegetación)**
- Sentinel-2 (10m) + Landsat 8/9 (30m)
- Compuesto mensual (mediana)
- Detecta áreas verdes vs urbano denso

✅ **LST (Temperatura Superficial)**
- MODIS (1 km, 8 días)
- Anomalía vs climatología 2018-2022
- Identifica islas de calor

✅ **Filtros SMOD**
- Rural (11-13)
- Urbano/Periurbano (21-23)
- Centro urbano (30)

✅ **Tablas de Análisis**
- Eventos de islas de calor (fecha, hora, área, °C)
- Prioridades por distrito (PRIOR, NDVI, LST, población)

✅ **Visualizaciones**
- Mapas sincronizados (NDVI + LST)
- Series temporales interactivas
- GIFs animados

## 🎯 Casos de Uso Rápidos

### Caso 1: Encontrar zonas para nuevos parques
```
1. Filtro SMOD: Solo "Centro urbano"
2. Umbral LST: +2.5°C
3. Ver tabla de prioridades
4. Buscar: PRIOR > 0.6 y NDVI < 0.3
→ Estas son las zonas más críticas
```

### Caso 2: Detectar islas de calor
```
1. Período: Verano (Dic-Mar)
2. LST: Día (10:30 LT)
3. Umbral: +3.0°C
4. Ver tabla de eventos
→ Lista de eventos críticos con ubicación
```

### Caso 3: Monitorear cambios temporales
```
1. Rango: 2020-01-01 a hoy
2. Mover slider de mes
3. Observar mapas y gráficos
4. Generar GIF para ver evolución
→ Tendencias visuales de vegetación/calor
```

## 📁 Archivos Creados

```
/workspaces/GEE/
├── public/
│   └── vegetacion-islas-calor.html      ← DEMO WEB
├── docs/
│   ├── vegetacion-islas-calor-gee-script.js  ← CÓDIGO GEE
│   └── vegetacion-islas-calor.md        ← DOCUMENTACIÓN
├── tests/
│   └── test-vegetacion-islas-calor.sh   ← TESTS (51/51 ✅)
└── COMPLETADO-VEGETACION-ISLAS-CALOR.md ← ESTE README
```

## 🧪 Verificar Instalación

```bash
cd /workspaces/GEE
bash tests/test-vegetacion-islas-calor.sh
```

Debe mostrar: **✅ 51/51 tests pasados**

## 🔗 Navegación

La nueva página está enlazada desde:

- ✅ `transparencia.html` → "🌳 Vegetación & Calor"
- ✅ `tutoriales.html` → "🌳 Vegetación & Calor"
- ✅ `panel-autoridades.html` → Botón "🌳 Vegetación & Calor"
- ✅ `vegetacion-islas-calor.html` → Enlaces a todas las páginas

## 📖 Documentación Detallada

Para información completa:
```bash
cat /workspaces/GEE/docs/vegetacion-islas-calor.md
# O abre el archivo en tu editor
```

Incluye:
- Metodología científica paso a paso
- Descripción de todos los datasets
- Fórmulas y ecuaciones
- Guías de implementación (3 opciones)
- Casos de uso detallados
- Limitaciones y supuestos
- Extensiones futuras
- Referencias científicas

## 🎨 Paleta de Colores

**NDVI (Vegetación)**:
- Gris (#9e9e9e) → Verde claro (#d9f0a3) → Verde (#78c679) → Verde oscuro (#238443)
- Rango: 0.0 (sin vegetación) → 0.8 (vegetación densa)

**LST Anomalía (Calor)**:
- Azul (#2c7bb6) → Cian (#abd9e9) → Amarillo (#ffffbf) → Naranja (#fdae61) → Rojo (#d7191c)
- Rango: -2.5°C (más frío) → +3.5°C (isla de calor extrema)

**SMOD (Urbanización)**:
- Cian claro (#edf8fb) → Azul (#b3cde3) → Púrpura (#8c96c6) → Púrpura oscuro (#8856a7) → Morado (#810f7c)
- Rural (10-13) → Urbano (21-23) → Centro urbano (30)

## ⚡ Tips Rápidos

### Rendimiento
- Empezar con rangos pequeños (6-12 meses)
- Usar máscara de nubes activada
- Filtrar por SMOD reduce tiempo de procesamiento

### Calidad de Datos
- Verano (Dic-Mar): Mayor LST pero más nubes
- Invierno (Jun-Ago): Menos nubes pero LST más baja
- Óptimo: Primavera/Otoño (balance)

### Interpretación
- NDVI < 0.2: Urbano denso, prioritario para áreas verdes
- LST_anom > +2.5°C: Isla de calor significativa
- PRIOR > 0.6: Alta prioridad (calor + falta vegetación)

## 🐛 Solución de Problemas

### "Error loading script"
→ Asegúrate de estar autenticado en Earth Engine

### "No data found"
→ Verifica que el ROI esté sobre Lima

### "Too many images"
→ Reduce el rango de fechas o área de análisis

### "Computation timeout"
→ Usa escalas más gruesas (1000m en vez de 30m)

## 📞 Soporte

- **Email**: ayuda@ecoplan.gob.pe
- **Docs**: `/docs/vegetacion-islas-calor.md`
- **Tests**: `bash tests/test-vegetacion-islas-calor.sh`
- **API**: http://localhost:3000/api-docs

## 🎉 ¡Listo!

Tu implementación está completa y lista para usar. Puedes:

1. ✅ Ver demo local: `http://localhost:3000/vegetacion-islas-calor.html`
2. ✅ Copiar código GEE: `/docs/vegetacion-islas-calor-gee-script.js`
3. ✅ Leer documentación: `/docs/vegetacion-islas-calor.md`
4. ✅ Ejecutar tests: `bash tests/test-vegetacion-islas-calor.sh`

---

**Siguiente paso recomendado**: Abre la demo web y explora la interfaz, luego prueba el código completo en GEE Code Editor.

**⭐ ¡Disfruta analizando vegetación e islas de calor en Lima!**
