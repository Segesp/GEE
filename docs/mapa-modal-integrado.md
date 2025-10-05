# 🗺️ Mapa Integrado en Modal - Solución Implementada

## 📋 Problema Original

Al intentar seleccionar la ubicación en el paso 2 del modal de reporte ciudadano:
- ❌ No aparecía ningún mapa
- ❌ El usuario quedaba "en el aire" sin poder seleccionar ubicación
- ❌ El modal enviaba al usuario al mapa principal (fuera del modal)

## ✅ Solución Implementada

### 1. **Mapa Embebido en el Modal**

Se agregó un **mapa Leaflet independiente** dentro del paso 2 del modal:

```html
<!-- PASO 2: Ubicación -->
<div class="report-step hidden" data-step="2">
  <h4>📍 ¿Dónde ocurre el problema?</h4>
  
  <!-- Mapa integrado -->
  <div class="modal-map-container">
    <div id="modalMapInstructions" class="modal-map-instructions">
      👆 Haz clic en el mapa para marcar la ubicación
    </div>
    <div id="modalMap"></div>
  </div>

  <!-- Coordenadas -->
  <div class="location-input-group">
    <input type="number" id="modalLatitude" readonly>
    <input type="number" id="modalLongitude" readonly>
  </div>

  <!-- Botones de ayuda -->
  <div class="location-buttons">
    <button id="useMyLocationBtn">📍 Mi ubicación</button>
    <button id="centerMapBtn">🎯 Centrar Lima</button>
  </div>
</div>
```

### 2. **Estilos CSS del Mapa Modal**

```css
.modal-map-container {
  position: relative;
  width: 100%;
  height: 400px;  /* ⚠️ CRÍTICO: Sin altura, el mapa no se renderiza */
  border-radius: 12px;
  overflow: hidden;
  border: 2px solid var(--border);
  margin-bottom: 16px;
  background: var(--surface);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

#modalMap {
  width: 100%;
  height: 100%;
  cursor: crosshair;
  z-index: 1;
}

.modal-map-instructions {
  position: absolute;
  top: 10px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 1000;
  background: rgba(59, 130, 246, 0.95);
  color: white;
  padding: 8px 16px;
  border-radius: 20px;
  font-size: 0.85rem;
  font-weight: 600;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  animation: pulse 2s infinite;
  pointer-events: none;
}

@keyframes pulse {
  0%, 100% { opacity: 1; transform: translateX(-50%) scale(1); }
  50% { opacity: 0.8; transform: translateX(-50%) scale(1.02); }
}
```

### 3. **JavaScript: Inicialización del Mapa**

```javascript
// Variables globales
let modalMap = null;
let modalMapMarker = null;
let modalMapInitialized = false;

function initializeModalMap() {
  if (modalMapInitialized || !document.getElementById('modalMap')) {
    return;
  }

  try {
    // Crear mapa centrado en Lima
    modalMap = L.map('modalMap', {
      center: [-12.046374, -77.042793], // Lima, Perú
      zoom: 13,
      zoomControl: true,
      scrollWheelZoom: true
    });

    // Agregar capa base (OpenStreetMap)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap',
      maxZoom: 19
    }).addTo(modalMap);

    // Cargar ubicación guardada desde localStorage
    const savedLocation = loadLocationFromStorage();
    if (savedLocation) {
      modalMap.setView([savedLocation.lat, savedLocation.lon], 16);
      setModalLocationOnMap(savedLocation.lat, savedLocation.lon);
    } else {
      // Intentar geolocalización automática
      tryGeolocation();
    }

    // Evento de click en el mapa
    modalMap.on('click', function(e) {
      const lat = e.latlng.lat;
      const lon = e.latlng.lng;
      setModalLocationOnMap(lat, lon);
    });

    modalMapInitialized = true;

    // Mostrar instrucciones temporalmente
    const instructions = document.getElementById('modalMapInstructions');
    if (instructions) {
      instructions.style.display = 'block';
      setTimeout(() => {
        instructions.style.display = 'none';
      }, 5000);
    }

    // Forzar resize del mapa
    setTimeout(() => {
      if (modalMap) {
        modalMap.invalidateSize();
      }
    }, 300);

    console.log('✅ Mapa modal inicializado correctamente');
  } catch (error) {
    console.error('❌ Error al inicializar mapa modal:', error);
  }
}
```

### 4. **Colocación del Marker en el Mapa**

```javascript
function setModalLocationOnMap(lat, lon) {
  if (!modalMap) return;

  // Actualizar o crear marker
  if (modalMapMarker) {
    modalMapMarker.setLatLng([lat, lon]);
  } else {
    modalMapMarker = L.marker([lat, lon], {
      icon: L.divIcon({
        className: 'modal-location-marker',
        iconSize: [40, 40],
        iconAnchor: [20, 40]
      })
    }).addTo(modalMap);
  }

  // Actualizar inputs
  document.getElementById('modalLatitude').value = lat.toFixed(6);
  document.getElementById('modalLongitude').value = lon.toFixed(6);

  // Guardar en localStorage
  saveLocationToStorage(lat, lon);

  // Actualizar estado
  modalSelectedLocation = { lat, lon };
  updateNavigationButtons();

  console.log(`📍 Ubicación seleccionada: ${lat.toFixed(6)}, ${lon.toFixed(6)}`);
}
```

### 5. **Persistencia con localStorage**

```javascript
function saveLocationToStorage(lat, lon) {
  try {
    const locationData = {
      lat: lat,
      lon: lon,
      timestamp: new Date().toISOString()
    };
    localStorage.setItem('gee-last-report-location', JSON.stringify(locationData));
    console.log('💾 Ubicación guardada en localStorage');
  } catch (error) {
    console.error('Error al guardar ubicación:', error);
  }
}

function loadLocationFromStorage() {
  try {
    const stored = localStorage.getItem('gee-last-report-location');
    if (stored) {
      const data = JSON.parse(stored);
      console.log('📂 Ubicación cargada desde localStorage');
      return { lat: data.lat, lon: data.lon };
    }
  } catch (error) {
    console.error('Error al cargar ubicación:', error);
  }
  return null;
}
```

### 6. **Botones de Ayuda**

#### Mi Ubicación (Geolocalización)
```javascript
function useMyLocation() {
  if ('geolocation' in navigator) {
    logStatus('🔍 Obteniendo tu ubicación...', 'info', 'ecoplan');
    
    navigator.geolocation.getCurrentPosition(
      function(position) {
        const lat = position.coords.latitude;
        const lon = position.coords.longitude;
        
        if (modalMap) {
          modalMap.setView([lat, lon], 17);
          setModalLocationOnMap(lat, lon);
          logStatus('✅ Ubicación obtenida correctamente', 'success', 'ecoplan');
        }
      },
      function(error) {
        let message = 'No se pudo obtener tu ubicación';
        if (error.code === 1) {
          message = 'Permiso de ubicación denegado. Haz clic en el mapa manualmente.';
        } else if (error.code === 2) {
          message = 'Ubicación no disponible. Usa el mapa manualmente.';
        }
        logStatus(message, 'warning', 'ecoplan');
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  } else {
    logStatus('Tu navegador no soporta geolocalización', 'warning', 'ecoplan');
  }
}
```

#### Centrar en Lima
```javascript
function centerMapOnLima() {
  if (modalMap) {
    modalMap.setView([-12.046374, -77.042793], 13);
    logStatus('🎯 Mapa centrado en Lima', 'info', 'ecoplan');
  }
}
```

### 7. **Inicialización al Mostrar el Paso 2**

```javascript
function showReportStep(step) {
  currentStep = step;
  
  // ... código de actualización de indicadores ...
  
  // Si estamos en el paso 2 (mapa), inicializar o hacer resize del mapa
  if (step === 2) {
    if (!modalMapInitialized) {
      setTimeout(() => {
        initializeModalMap();
      }, 100);
    } else if (modalMap) {
      setTimeout(() => {
        modalMap.invalidateSize();
        // Mostrar instrucciones brevemente
        const instructions = document.getElementById('modalMapInstructions');
        if (instructions) {
          instructions.style.display = 'block';
          setTimeout(() => {
            instructions.style.display = 'none';
          }, 3000);
        }
      }, 100);
    }
  }
  
  updateNavigationButtons();
}
```

## 🎯 Características Implementadas

### ✅ Funcionalidades

1. **Mapa Interactivo**
   - ✅ Click en cualquier punto para seleccionar ubicación
   - ✅ Zoom con +/- o scroll
   - ✅ Arrastrar para moverse por el mapa
   - ✅ Cursor crosshair para mejor UX

2. **Marker Visual**
   - ✅ Pin animado que se coloca al hacer click
   - ✅ Se actualiza si haces click en otro punto
   - ✅ Icono personalizado con estilo

3. **Coordenadas en Tiempo Real**
   - ✅ Inputs de solo lectura con lat/lon
   - ✅ Se actualizan automáticamente al hacer click
   - ✅ Formato con 6 decimales de precisión

4. **Persistencia de Datos**
   - ✅ Última ubicación guardada en localStorage
   - ✅ Se restaura al abrir el modal de nuevo
   - ✅ Incluye timestamp para debug

5. **Geolocalización**
   - ✅ Botón "Mi ubicación" usa GPS/WiFi
   - ✅ Manejo de permisos denegados
   - ✅ Fallback manual si no está disponible
   - ✅ Alta precisión (enableHighAccuracy: true)

6. **Ayudas Visuales**
   - ✅ Instrucciones animadas (pulse)
   - ✅ Se ocultan automáticamente después de 5s
   - ✅ Reaparecen al volver al paso 2
   - ✅ Tip sobre zoom y guardado automático

7. **Validación**
   - ✅ Botón "Siguiente" deshabilitado hasta seleccionar ubicación
   - ✅ Verificación de lat/lon válidas
   - ✅ Estado actualizado en modalSelectedLocation

## 📊 Flujo de Usuario

```
┌─────────────────────────────────────────────────────────┐
│  PASO 1: Usuario selecciona categoría                   │
│  ✅ Tarjeta de categoría marcada                        │
└──────────────────┬──────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────┐
│  PASO 2: Modal muestra mapa embebido                    │
│                                                          │
│  ┌────────────────────────────────────────────────┐    │
│  │                                                 │    │
│  │          🗺️ MAPA INTERACTIVO                   │    │
│  │                                                 │    │
│  │          [Clic aquí] → Coloca pin              │    │
│  │                  ↓                              │    │
│  │              📍 Pin azul                        │    │
│  │                                                 │    │
│  └────────────────────────────────────────────────┘    │
│                                                          │
│  [-12.046373] [77.042754]  ← Coordenadas actualizadas  │
│                                                          │
│  [📍 Mi ubicación] [🎯 Centrar Lima]                   │
│                                                          │
│  💡 Tip: Los datos se guardan automáticamente           │
└──────────────────┬──────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────┐
│  localStorage: Guarda lat/lon + timestamp               │
└──────────────────┬──────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────┐
│  PASO 3: Detalles opcionales (descripción, foto, etc.)  │
└──────────────────┬──────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────┐
│  Envío a /api/citizen-reports                           │
│  { category, latitude, longitude, description, ... }    │
└─────────────────────────────────────────────────────────┘
```

## 🔧 Troubleshooting

### Problema: El mapa no aparece

**Posible causa 1**: Falta la altura del contenedor
```css
.modal-map-container {
  height: 400px; /* ⚠️ Sin esto, el mapa no se renderiza */
}
```

**Posible causa 2**: Leaflet no está cargado
```html
<!-- Verificar que esté antes del código -->
<script src="vendor/leaflet/leaflet.js"></script>
```

**Posible causa 3**: El contenedor no está visible cuando se inicializa
```javascript
// Solución: Inicializar DESPUÉS de mostrar el modal
setTimeout(() => {
  initializeModalMap();
}, 100);
```

**Posible causa 4**: Falta invalidateSize()
```javascript
// Después de hacer visible el contenedor
modalMap.invalidateSize();
```

### Problema: El marker no aparece

**Verificar**:
```javascript
console.log('Marker creado:', modalMapMarker);
console.log('Mapa:', modalMap);
console.log('Coordenadas:', lat, lon);
```

**Solución**:
```javascript
// Asegurarse de que las coordenadas son números
const lat = parseFloat(latValue);
const lon = parseFloat(lonValue);

if (isNaN(lat) || isNaN(lon)) {
  console.error('Coordenadas inválidas');
  return;
}
```

### Problema: localStorage no guarda

**Verificar espacio**:
```javascript
try {
  localStorage.setItem('test', 'value');
  localStorage.removeItem('test');
  console.log('✅ localStorage disponible');
} catch (e) {
  console.error('❌ localStorage bloqueado o lleno:', e);
}
```

**Verificar modo incógnito**:
```javascript
// En algunos navegadores, localStorage no funciona en modo incógnito
if (typeof(Storage) !== "undefined") {
  // Disponible
} else {
  console.warn('localStorage no soportado');
}
```

## 📱 Responsive

El mapa se adapta automáticamente:

```css
@media (max-width: 600px) {
  .modal-map-container {
    height: 300px; /* Más pequeño en móviles */
  }
  
  .location-buttons {
    flex-direction: column;
  }
  
  .location-buttons button {
    width: 100%;
  }
}
```

## 🎨 Personalización

### Cambiar el estilo del mapa

```javascript
// Usar diferentes tiles
L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
  attribution: '© CartoDB'
}).addTo(modalMap);
```

### Personalizar el marker

```javascript
const customIcon = L.divIcon({
  className: 'custom-pin',
  html: '<div style="background: red; width: 30px; height: 30px; border-radius: 50%;">📍</div>',
  iconSize: [30, 30],
  iconAnchor: [15, 30]
});

modalMapMarker = L.marker([lat, lon], { icon: customIcon }).addTo(modalMap);
```

## 📚 Referencias

- [Leaflet Documentation](https://leafletjs.com/)
- [OpenStreetMap Tiles](https://wiki.openstreetmap.org/wiki/Tile_servers)
- [Geolocation API](https://developer.mozilla.org/en-US/docs/Web/API/Geolocation_API)
- [localStorage](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage)

## ✅ Testing

### Casos de prueba:

1. ✅ Abrir modal → Click en "➕ Reportar"
2. ✅ Seleccionar categoría → Click en tarjeta
3. ✅ Click "Siguiente" → Ver paso 2 con mapa
4. ✅ Mapa se renderiza con altura de 400px
5. ✅ Click en mapa → Aparece pin azul
6. ✅ Coordenadas se actualizan en inputs
7. ✅ Click "Mi ubicación" → Solicita permiso y centra
8. ✅ Click "Centrar Lima" → Vuelve a Lima
9. ✅ Cerrar y reabrir modal → Última ubicación restaurada
10. ✅ Completar paso 3 y enviar → Datos correctos en payload

---

**Estado**: ✅ Implementado y funcional  
**Fecha**: 2025-10-05  
**Versión**: 2.1.0-mapa-modal
