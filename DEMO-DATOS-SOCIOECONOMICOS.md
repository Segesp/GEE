# 🎬 Demo: Datos Socioeconómicos

## Guía Rápida de Uso

### 🚀 Inicio Rápido

1. **Abrir la aplicación**
   ```
   http://localhost:3000
   ```

2. **Navegar a la sección**
   - Scroll hacia abajo hasta ver el icono 📊
   - Sección: **"Datos Socioeconómicos"**

3. **Explorar un barrio**
   - Seleccionar barrio: **Miraflores**
   - Año: **2020**
   - Ver resultados en 2-3 segundos

---

## 📊 Interpretación de Resultados

### Ejemplo: Miraflores (2020)

```
🏘️ Miraflores
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📈 RESUMEN
Barrio con densidad de 10,210 hab/km². Privación moderada. 
Área verde: 5.3 m²/persona (por debajo del estándar OMS de 9 m²/hab)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

👥 POBLACIÓN
├─ Total: 197,473 habitantes
├─ Densidad: 10,210 hab/km²
└─ Área: 19.34 km²

🏥 SERVICIOS
├─ Hospitales: 4 (0.2 por 10k hab)
├─ Colegios: 39 (1.97 por 10k hab)
├─ Parques: 5.3 m²/persona
└─ Score: 1.09 servicios por 10k hab

📉 PRIVACIÓN
├─ Índice: 0.374 (Privación moderada)
├─ Luminosidad nocturna: 59.34 nW·cm⁻²·sr⁻¹
└─ Acceso áreas verdes: 0.065 (NDVI)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## 🎯 Casos de Uso

### Caso 1: Comparar Barrios

**Objetivo**: Encontrar el barrio con mejor balance población-servicios

**Pasos**:
1. Seleccionar **Miraflores** → Anotar servicios per cápita: **1.09**
2. Seleccionar **San Isidro** → Comparar
3. Seleccionar **Surquillo** → Comparar

**Resultado Esperado**:
```
Ranking de Servicios per Cápita:
1. San Isidro: 1.45 ⭐
2. Miraflores: 1.09
3. Surquillo: 0.87
```

---

### Caso 2: Filtrar por Densidad Alta

**Objetivo**: Encontrar barrios sobrepoblados

**Pasos**:
1. Ajustar filtro de densidad:
   - Min: **8,000** hab/km²
   - Max: **30,000** hab/km²
2. Click en **"Aplicar filtros"**

**Resultado Esperado**:
```
Se encontraron 3 barrios:
• Miraflores (10,210 hab/km²)
• Surquillo (14,567 hab/km²)
• San Borja (11,234 hab/km²)
```

---

### Caso 3: Identificar Privación Alta

**Objetivo**: Detectar barrios con mayor necesidad de intervención

**Pasos**:
1. Ajustar filtro de privación:
   - Mínima: **0.5** (moderada-alta)
2. Click en **"Aplicar filtros"**

**Resultado Esperado**:
```
Barrios con privación ≥ 0.5:
• [Lista de barrios que cumplen el criterio]
```

---

### Caso 4: Análisis Temporal

**Objetivo**: Ver evolución poblacional de un barrio

**Pasos**:
1. Seleccionar **Miraflores**
2. Año: **2000** → Densidad: ~8,500 hab/km²
3. Cambiar a **2010** → Densidad: ~9,300 hab/km²
4. Cambiar a **2020** → Densidad: ~10,210 hab/km²

**Análisis**:
```
Crecimiento 2000-2020: +20%
Tendencia: Incremento sostenido
Implicaciones: Mayor presión sobre servicios e infraestructura
```

---

## 📥 Descarga de Datos

### Formato JSON

**Uso**: Integración con otras aplicaciones, análisis programático

**Ejemplo de uso**:
```bash
# Descargar desde la UI
1. Seleccionar barrio
2. Click en "📥 Descargar datos"
3. Elegir: 1 (JSON)

# O desde API directamente
curl http://localhost:3000/api/socioeconomic/miraflores?year=2020 \
  -o miraflores_2020.json
```

**Estructura del JSON**:
```json
{
  "neighborhood": "Miraflores",
  "year": 2020,
  "population": { ... },
  "infrastructure": { ... },
  "deprivation": { ... },
  "normalized": { ... }
}
```

---

### Formato CSV

**Uso**: Excel, Google Sheets, análisis estadístico

**Ejemplo de uso**:
```bash
# Desde la UI
1. Click en "📥 Descargar datos"
2. Elegir: 2 (CSV)

# Archivo generado:
socioeconomic_Miraflores_2020.csv
```

**Ejemplo de CSV**:
```csv
Indicador,Valor,Unidad
Barrio,Miraflores,
Año,2020,
Población Total,197473,habitantes
Densidad Poblacional,10209.58,hab/km²
Área,19.34,km²
Hospitales,4,unidades
Colegios,39,unidades
Parques per Cápita,5.3,m²/hab
Índice de Privación,0.374,(0-1)
```

---

## 🔍 Tooltips Informativos

### Cómo usar los tooltips (ⓘ)

Cada indicador tiene un botón **ⓘ** que explica su significado:

**1. Densidad Poblacional (ⓘ)**
```
Densidad poblacional = Población total del barrio dividida por su 
área en km². 

Fuente: GPW v4.11 (SEDAC/NASA/CIESIN)
Resolución: ~1km
```

**2. Privación Relativa (ⓘ)**
```
Índice de privación relativa (0-1): proxy basado en luminosidad 
nocturna (VIIRS) y acceso a áreas verdes (NDVI). 

Mayor valor = mayor privación.

Nota: Para análisis definitivo, usar datos censales INEI.
```

**3. Servicios per Cápita (ⓘ)**
```
Servicios per cápita: promedio de hospitales y colegios por cada 
10,000 habitantes.

Nota MVP: Datos sintéticos - reemplazar con shapefile 
municipal/INEI.
```

---

## 📊 Gráfico de Barras Comparativo

### Interpretación del gráfico

El gráfico muestra 3 indicadores normalizados (0-1):

```
┌─────────────────────────────────────────┐
│ Comparación de Indicadores (0-1)       │
├─────────────────────────────────────────┤
│                                         │
│ Densidad          ████████ 0.34 🟡     │
│ Poblacional                             │
│                                         │
│ Servicios         ████ 0.22 🟢         │
│ per Cápita                              │
│                                         │
│ Privación         ███████ 0.37 🟡      │
│ Relativa                                │
│                                         │
└─────────────────────────────────────────┘

Leyenda:
🟢 Verde (0-0.33): Bajo
🟡 Amarillo (0.33-0.66): Moderado
🔴 Rojo (0.66-1): Alto
```

### Interpretación:

- **Densidad 0.34 (Moderada)**: El barrio no está sobrepoblado
- **Servicios 0.22 (Bajo)**: Buena disponibilidad de servicios
- **Privación 0.37 (Moderada)**: Nivel medio de desarrollo

---

## 🎯 Escenarios de Análisis

### Escenario A: Planificación Urbana

**Pregunta**: ¿Dónde construir un nuevo hospital?

**Proceso**:
1. Filtrar barrios con:
   - Densidad > 12,000 hab/km²
   - Servicios per cápita < 1.0
2. Ordenar por población total (mayor primero)
3. Verificar hospitales existentes
4. Seleccionar barrio con déficit mayor

**Decisión**: Priorizar barrio con:
- Alta población
- Baja disponibilidad de hospitales
- Fácil acceso (revisar en mapa)

---

### Escenario B: Política Social

**Pregunta**: ¿Qué barrios necesitan intervención social?

**Proceso**:
1. Filtrar por privación > 0.6 (alta)
2. Cruzar con baja luminosidad nocturna
3. Verificar acceso a áreas verdes (NDVI bajo)
4. Generar lista priorizada

**Acción**: Implementar programas de:
- Mejora de vivienda
- Acceso a servicios básicos
- Creación de áreas verdes

---

### Escenario C: Estudio Ambiental

**Pregunta**: ¿Correlación entre densidad y privación?

**Proceso**:
1. Obtener datos de todos los barrios
2. Descargar en CSV
3. Análisis estadístico en Excel/R:
   ```r
   cor(densidad, privacion)
   ```
4. Visualizar scatter plot

**Hallazgo Esperado**:
```
Correlación positiva débil (r = 0.3-0.4)
→ Mayor densidad tiende a mayor privación
→ Pero hay excepciones (ej: San Isidro)
```

---

## 🛠️ Tips y Trucos

### Tip 1: Comparación Rápida
```
Ctrl/Cmd + Click en el selector de barrio
→ Abrir en nueva pestaña
→ Comparar lado a lado
```

### Tip 2: Análisis Batch
```bash
# Obtener datos de todos los barrios
for barrio in miraflores san-isidro surquillo barranco surco san-borja
do
  curl -s "http://localhost:3000/api/socioeconomic/$barrio?year=2020" \
    > datos_${barrio}.json
done

# Consolidar
jq -s '.' datos_*.json > todos_barrios.json
```

### Tip 3: Exportar a Excel
```
1. Descargar cada barrio en CSV
2. Abrir en Excel
3. Crear tabla dinámica
4. Gráficos comparativos automáticos
```

---

## ❓ FAQ

### ¿Por qué los datos de infraestructura son sintéticos?

**R**: En esta versión MVP, los datos de hospitales, colegios y parques son **estimaciones** basadas en la densidad poblacional. Para producción, deben reemplazarse con shapefiles reales de MINSA, MINEDU y municipios.

### ¿El índice de privación es real?

**R**: Es un **proxy** calculado con luminosidad nocturna (VIIRS) y acceso a áreas verdes (NDVI). Para análisis definitivo, usar datos censales del INEI con variables socioeconómicas reales.

### ¿Puedo confiar en los datos de población?

**R**: **Sí**. Los datos de población provienen del **GPW v4.11** (SEDAC/NASA/CIESIN), un dataset científico validado internacionalmente. Es confiable para análisis a escala de barrio.

### ¿Qué hacer si un barrio no aparece?

**R**: Actualmente hay 6 barrios de Lima. Para agregar más:
1. Editar `/services/neighborhoodAnalysisService.js`
2. Agregar nuevo barrio con coordenadas
3. Reiniciar servidor

### ¿Cómo integrar con mi SIG?

**R**: Dos opciones:
1. **API**: `curl http://localhost:3000/api/socioeconomic/barrio`
2. **Descarga**: Usar formato JSON/CSV y importar a QGIS/ArcGIS

---

## 🎓 Recursos de Aprendizaje

### Entender los Datasets

1. **GPW v4**: https://sedac.ciesin.columbia.edu/data/collection/gpw-v4
   - Tutorial: https://sedac.ciesin.columbia.edu/data/set/gpw-v4-population-density-rev11/docs
   - Paper: https://doi.org/10.7927/H49C6VHW

2. **VIIRS**: https://ngdc.noaa.gov/eog/viirs/download_dnb_composites.html
   - Qué mide: Emisión de luz nocturna (proxy de actividad económica)

3. **Sentinel-2**: https://sentinels.copernicus.eu/web/sentinel/user-guides/sentinel-2-msi
   - NDVI: https://eos.com/make-an-analysis/ndvi/

### Análisis Socioeconómico

- **OMS - Áreas Verdes**: https://www.who.int/sustainable-development/cities/health-risks/urban-green-space/en/
- **Índices de Privación**: https://www.ine.es/metodologia/t25/t2530p467.pdf
- **Densidad Urbana**: https://www.lincolninst.edu/publications/articles/2021-01-understanding-urban-density

---

## 📞 Soporte

### Reportar un problema

```bash
# Verificar logs del servidor
tail -f /workspaces/GEE/server.log

# Ejecutar tests
bash tests/test-datos-socioeconomicos.sh

# Ver documentación API
open http://localhost:3000/api-docs
```

### Consultas técnicas

- **Documentación**: `/IMPLEMENTACION-DATOS-SOCIOECONOMICOS.md`
- **Código fuente**: `/services/socioeconomicDataService.js`
- **Tests**: `/tests/test-datos-socioeconomicos.sh`

---

**¡Disfruta explorando los datos socioeconómicos de Lima! 🎉**

_Última actualización: 5 de octubre de 2025_
