# 🧭 Guía de Navegación Rápida - EcoPlan GEE

> **Encuentra rápidamente lo que necesitas en la documentación consolidada**

---

## 🎯 ¿Qué estás buscando?

### 🚀 "Quiero empezar a usar el sistema YA"
➡️ **[docs/GUIA-INICIO-RAPIDO.md](GUIA-INICIO-RAPIDO.md)**
- Guías de <5 minutos por módulo
- Paso a paso para cada herramienta
- Ejemplos prácticos inmediatos

---

### ✅ "¿Qué módulos están completos y funcionando?"
➡️ **[docs/MODULOS-COMPLETADOS.md](MODULOS-COMPLETADOS.md)**
- Estado de cada módulo (4 módulos principales)
- Características implementadas
- Tests pasados y métricas

---

### 🔧 "Necesito detalles técnicos de implementación"
➡️ **[docs/IMPLEMENTACION-TECNICA.md](IMPLEMENTACION-TECNICA.md)**
- 11 implementaciones consolidadas
- Arquitectura, código, APIs
- Diagramas y ejemplos de código

---

### 🧪 "¿Cómo están los tests y validaciones?"
➡️ **[docs/VALIDACION-TESTING.md](VALIDACION-TESTING.md)**
- Resultados de 171 tests automatizados
- Cobertura por módulo (94% promedio)
- Cómo ejecutar los tests

---

### 📊 "Necesito un resumen ejecutivo del proyecto"
➡️ **[docs/RESUMEN-PROYECTO.md](RESUMEN-PROYECTO.md)**
- Resúmenes visuales con ASCII art
- Estado final del MVP
- Métricas y estadísticas del proyecto

---

### 🎬 "Quiero ver demos y ejemplos de uso"
➡️ **[docs/DEMOS-CASOS-USO.md](DEMOS-CASOS-USO.md)**
- Demo de datos socioeconómicos
- Casos de uso reales (Mi Barrio)
- Tests de layout visual

---

### 📝 "¿Qué cambió en las últimas versiones?"
➡️ **[docs/CHANGELOG.md](CHANGELOG.md)**
- Historial completo de cambios
- Fixes aplicados
- Actualizaciones de módulos

---

## 🗺️ Navegación por Módulo Específico

### 🌍 Calidad de Aire y Agua
- **Inicio rápido**: [GUIA-INICIO-RAPIDO.md](GUIA-INICIO-RAPIDO.md) → Sección "Calidad Aire y Agua"
- **Docs técnicas**: [calidad-aire-agua.md](calidad-aire-agua.md)
- **Script GEE**: [calidad-aire-agua-gee-script.js](calidad-aire-agua-gee-script.js)
- **Estado**: [MODULOS-COMPLETADOS.md](MODULOS-COMPLETADOS.md) → Sección "Calidad Aire y Agua"

### 🌳 Vegetación e Islas de Calor
- **Inicio rápido**: [GUIA-INICIO-RAPIDO.md](GUIA-INICIO-RAPIDO.md) → Sección "Vegetación"
- **Docs técnicas**: [vegetacion-islas-calor.md](vegetacion-islas-calor.md)
- **Estado**: [MODULOS-COMPLETADOS.md](MODULOS-COMPLETADOS.md) → Sección "Vegetación"

### 📊 Índices Compuestos
- **Inicio rápido**: [GUIA-INICIO-RAPIDO.md](GUIA-INICIO-RAPIDO.md) → Sección "Índices"
- **Implementación**: [IMPLEMENTACION-TECNICA.md](IMPLEMENTACION-TECNICA.md) → Sección "Índices Compuestos"
- **Estado**: [MODULOS-COMPLETADOS.md](MODULOS-COMPLETADOS.md) → Sección "Índices"

### 👥 Datos Socioeconómicos
- **Inicio rápido**: [GUIA-INICIO-RAPIDO.md](GUIA-INICIO-RAPIDO.md) → Sección "Socioeconómico"
- **Implementación**: [IMPLEMENTACION-TECNICA.md](IMPLEMENTACION-TECNICA.md) → Sección "Datos Socioeconómicos"
- **Demo**: [DEMOS-CASOS-USO.md](DEMOS-CASOS-USO.md) → Sección "Demo Socioeconómico"

### 🏘️ Mi Barrio
- **Docs técnicas**: [mi-barrio.md](mi-barrio.md)
- **Implementación**: [IMPLEMENTACION-TECNICA.md](IMPLEMENTACION-TECNICA.md) → Sección "Mi Barrio"
- **Conclusión**: [DEMOS-CASOS-USO.md](DEMOS-CASOS-USO.md) → Sección "Conclusión Mi Barrio"

---

## 👤 Navegación por Rol

### 👨‍💻 Soy Desarrollador
**Ruta recomendada**:
1. [INDICE-PROYECTO.md](../INDICE-PROYECTO.md) - Visión general
2. [IMPLEMENTACION-TECNICA.md](IMPLEMENTACION-TECNICA.md) - Detalles de código
3. [VALIDACION-TESTING.md](VALIDACION-TESTING.md) - Ejecutar tests
4. [GUIA-INICIO-RAPIDO.md](GUIA-INICIO-RAPIDO.md) - Probar módulos

**Archivos clave**:
- `server.js` - Backend principal
- `services/` - Lógica de negocio
- `public/*.html` - Interfaces web
- `tests/` - Suites de testing

---

### 👨‍🔬 Soy Investigador
**Ruta recomendada**:
1. [RESUMEN-PROYECTO.md](RESUMEN-PROYECTO.md) - Contexto general
2. [calidad-aire-agua.md](calidad-aire-agua.md) - Metodología científica
3. [vegetacion-islas-calor.md](vegetacion-islas-calor.md) - Análisis NDVI/LST
4. [DEMOS-CASOS-USO.md](DEMOS-CASOS-USO.md) - Ejemplos de análisis

**Scripts GEE**:
- `docs/calidad-aire-agua-gee-script.js` - AOD, NO₂, Clorofila, NDWI
- `docs/vegetacion-islas-calor-gee-script.js` - NDVI, LST

---

### 👔 Soy Autoridad/Tomador de Decisiones
**Ruta recomendada**:
1. [RESUMEN-PROYECTO.md](RESUMEN-PROYECTO.md) - Resumen ejecutivo
2. [MODULOS-COMPLETADOS.md](MODULOS-COMPLETADOS.md) - Qué está listo
3. [DEMOS-CASOS-USO.md](DEMOS-CASOS-USO.md) - Casos de uso prácticos

**Interfaces clave**:
- `public/panel-autoridades.html` - Dashboard ejecutivo
- `public/transparencia.html` - Datos abiertos
- `http://localhost:3000/api-docs` - API REST

---

### 🧑‍💼 Soy Usuario Final/Ciudadano
**Ruta recomendada**:
1. [GUIA-INICIO-RAPIDO.md](GUIA-INICIO-RAPIDO.md) - Cómo empezar
2. [manual-ecoplan-gee.md](manual-ecoplan-gee.md) - Manual de usuario
3. `public/tutoriales.html` - Tutoriales en video

**Páginas web**:
- `http://localhost:3000` - Reportar problemas
- `http://localhost:3000/calidad-aire-agua.html` - Ver calidad aire/agua
- `http://localhost:3000/vegetacion-islas-calor.html` - Ver vegetación

---

## 🔍 Búsqueda por Tema

### 🌡️ Temperatura y Calor
- [vegetacion-islas-calor.md](vegetacion-islas-calor.md) → LST (Land Surface Temperature)
- [IMPLEMENTACION-TECNICA.md](IMPLEMENTACION-TECNICA.md) → Sección "Vegetación"

### 🌳 Áreas Verdes y Vegetación
- [vegetacion-islas-calor.md](vegetacion-islas-calor.md) → NDVI
- [DEMOS-CASOS-USO.md](DEMOS-CASOS-USO.md) → Casos de uso

### 💨 Contaminación del Aire
- [calidad-aire-agua.md](calidad-aire-agua.md) → AOD, NO₂
- [GUIA-INICIO-RAPIDO.md](GUIA-INICIO-RAPIDO.md) → Sección "Aire y Agua"

### 💧 Calidad del Agua
- [calidad-aire-agua.md](calidad-aire-agua.md) → Clorofila, NDWI
- [IMPLEMENTACION-TECNICA.md](IMPLEMENTACION-TECNICA.md) → Análisis costero

### 📊 Datos Socioeconómicos
- [IMPLEMENTACION-TECNICA.md](IMPLEMENTACION-TECNICA.md) → Sección "Datos Socioeconómicos"
- [DEMOS-CASOS-USO.md](DEMOS-CASOS-USO.md) → Demo INEI

### 🗺️ Mapas y Visualización
- [mapa-modal-integrado.md](mapa-modal-integrado.md) - Integración Leaflet
- [IMPLEMENTACION-TECNICA.md](IMPLEMENTACION-TECNICA.md) → Layout Mapa

### ✅ Validación y Reportes
- [validation-comunitaria.md](validation-comunitaria.md) - Sistema peer-to-peer
- [VALIDACION-TESTING.md](VALIDACION-TESTING.md) - Tests automatizados

### 🔌 API y Transparencia
- [IMPLEMENTACION-TECNICA.md](IMPLEMENTACION-TECNICA.md) → Sección "API Transparencia"
- `http://localhost:3000/api-docs` - Swagger docs

---

## 📚 Estructura de Archivos MD Consolidados

```
docs/
├── GUIA-INICIO-RAPIDO.md        (36 KB) - 5 guías consolidadas
├── MODULOS-COMPLETADOS.md       (50 KB) - 4 módulos consolidados
├── IMPLEMENTACION-TECNICA.md    (179 KB) - 11 implementaciones consolidadas
├── VALIDACION-TESTING.md        (39 KB) - 3 validaciones consolidadas
├── RESUMEN-PROYECTO.md          (132 KB) - 6 resúmenes consolidados
├── DEMOS-CASOS-USO.md           (28 KB) - 3 demos consolidados
├── CHANGELOG.md                 (29 KB) - 3 changelogs consolidados
├── NAVEGACION-RAPIDA.md         (Este archivo)
│
├── calidad-aire-agua.md         (37 KB) - Docs técnicas aire/agua
├── vegetacion-islas-calor.md    (17 KB) - Docs técnicas vegetación
├── mi-barrio.md                 (18 KB) - Docs técnicas Mi Barrio
├── manual-ecoplan-gee.md        (21 KB) - Manual de usuario
├── mapa-modal-integrado.md      (17 KB) - Integración mapas
├── validation-comunitaria.md    (21 KB) - Sistema validación
│
└── archive-old-md/              (36 archivos backup)
    └── [Archivos originales preservados]
```

---

## ⚡ Accesos Directos Frecuentes

### 🔥 Top 5 Más Usados

1. **Inicio Rápido General**  
   `docs/GUIA-INICIO-RAPIDO.md`

2. **Estado de Módulos**  
   `docs/MODULOS-COMPLETADOS.md`

3. **Detalles Técnicos**  
   `docs/IMPLEMENTACION-TECNICA.md`

4. **Índice Maestro**  
   `INDICE-PROYECTO.md`

5. **Scripts GEE**  
   `docs/calidad-aire-agua-gee-script.js`

---

## 🆘 Soporte y Ayuda

### ❓ "No encuentro lo que busco"
1. Revisa el **[INDICE-PROYECTO.md](../INDICE-PROYECTO.md)** completo
2. Usa la búsqueda de archivos (Ctrl+P en VS Code)
3. Busca palabras clave en `docs/IMPLEMENTACION-TECNICA.md` (es el más completo)

### 🐛 "Encontré un error en la documentación"
1. Abre issue en GitHub con etiqueta `documentation`
2. Especifica archivo y sección
3. Sugiere corrección

### 💡 "Quiero sugerir una mejora"
1. Abre issue con etiqueta `enhancement`
2. Describe el problema que resuelve
3. Propón la mejora

---

## 📞 Contacto

- **Email**: ayuda@ecoplan.gob.pe
- **GitHub**: https://github.com/Segesp/GEE
- **API Docs**: http://localhost:3000/api-docs

---

**Última actualización**: 2025-10-05  
**Versión**: 1.0.0  
**Archivos consolidados**: 7 archivos temáticos (de 36 originales)
